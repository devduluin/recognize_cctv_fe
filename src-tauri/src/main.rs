#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader, Write}, path::PathBuf, process::{Child, Command, Stdio}, sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex}, time::{Duration, Instant}};
use rand::RngCore;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct Services { child: Mutex<Child>, stopping: AtomicBool }
fn credential_key() -> Result<String, Box<dyn std::error::Error>> {
    let entry = keyring::Entry::new("com.duluin.visitorcounter.tauri", "session-key")?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            let mut bytes = [0u8; 32]; rand::rngs::OsRng.fill_bytes(&mut bytes);
            let key: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            entry.set_password(&key)?; Ok(key)
        },
        Err(error) => Err(error.into()),
    }
}
fn start(app: &tauri::App) -> Result<(Arc<Services>, BufReader<std::process::ChildStdout>, String), Box<dyn std::error::Error>> {
    let root = if cfg!(debug_assertions) { PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap().to_path_buf() }
        else { app.path().resource_dir()?.join("runtime") };
    let data_root = app.path().app_data_dir()?;
    // Reuse Electron's OS-appropriate profile so the SQLite DB and photos remain.
    let user_data = data_root.parent().ok_or("Invalid application data path")?.join("Visitor Counter");
    let node = root.join("resources/node").join(if cfg!(windows) { "node.exe" } else { "node" });
    let mut command = Command::new(node);
    command.arg(root.join("tauri/host.cjs")).current_dir(&root)
        .env("VISITOR_TAURI_DATA", user_data).env("VISITOR_TAURI_KEY", credential_key()?)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit());
    if cfg!(debug_assertions) { command.arg("--development"); }
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn()?;
    let stdout = child.stdout.take().ok_or("Host output unavailable")?;
    let services = Arc::new(Services { child: Mutex::new(child), stopping: AtomicBool::new(false) });
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout); let mut line = String::new();
        let result = reader.read_line(&mut line).map(|_| line);
        let _ = tx.send((reader, result));
    });
    let result = rx.recv_timeout(Duration::from_secs(240));
    match result {
        Ok((reader, Ok(line))) => {
            let validated = (|| -> Result<String, Box<dyn std::error::Error>> {
            let payload: serde_json::Value = serde_json::from_str(&line)?;
            let url = payload["ready"].as_str().ok_or("Host startup failed")?.to_string();
            let parsed = tauri::Url::parse(&url)?;
            if parsed.scheme() != "http" || parsed.host_str() != Some("127.0.0.1") || !parsed.path().starts_with("/__desktop/bootstrap/") { return Err("Invalid local startup address".into()); }
            Ok(url)
            })();
            match validated { Ok(url) => Ok((services, reader, url)), Err(error) => { shutdown(&services); Err(error) } }
        },
        _ => { shutdown(&services); Err("Local service startup failed or timed out. Check application logs.".into()) },
    }
}
fn shutdown(services: &Services) {
    if services.stopping.swap(true, Ordering::SeqCst) { return; }
    if let Ok(mut child) = services.child.lock() {
        if let Some(mut stdin) = child.stdin.take() { let _ = stdin.write_all(b"shutdown\n"); }
        let deadline = Instant::now() + Duration::from_secs(35);
        while Instant::now() < deadline {
            if let Ok(Some(_)) = child.try_wait() { return; }
            std::thread::sleep(Duration::from_millis(100));
        }
        let _ = child.kill(); let _ = child.wait();
    }
}
fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.set_focus(); }
        }))
        .setup(|app| {
            let (services, mut output, url) = start(app)?;
            app.manage(services.clone());
            let target = tauri::Url::parse(&url)?;
            let allowed_origin = target.origin();
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(target))
                .title("Visitor Counter").inner_size(1440.0, 960.0).min_inner_size(960.0, 640.0)
                .on_navigation(move |url| url.origin() == allowed_origin)
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build();
            if let Err(error) = window { shutdown(&services); return Err(error.into()); }
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut line = String::new(); while output.read_line(&mut line).is_ok_and(|n| n > 0) { line.clear(); }
                if !services.stopping.load(Ordering::SeqCst) { handle.exit(1); }
            });
            Ok(())
        })
        .build(tauri::generate_context!()).expect("Visitor Counter Tauri startup failed");
    app.run(|handle, event| {
        if let tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::Destroyed, .. } = &event {
            handle.exit(0);
        }
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let Some(services) = handle.try_state::<Arc<Services>>() else { return; };
            if !services.stopping.load(Ordering::SeqCst) {
                api.prevent_exit(); let services = services.inner().clone(); let app = handle.clone();
                std::thread::spawn(move || { shutdown(&services); app.exit(0); });
            }
        }
    });
}
