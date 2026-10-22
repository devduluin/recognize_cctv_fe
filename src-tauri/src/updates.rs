//! Signed updates from the configured release feed, driven from the tray.
//!
//! The web UI has no Tauri access, so every prompt is a native dialog and download
//! progress is shown on the tray menu item. Monitoring keeps running while an update
//! downloads; local services are stopped only when the user chooses to install.
use std::sync::{Arc, Mutex};

use tauri::{menu::MenuItem, AppHandle, Manager, Wry};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::{Update, UpdaterExt};

const CHECK_LABEL: &str = "Periksa pembaruan";

enum Phase {
    Idle,
    Busy,
    Ready(Box<Update>, Arc<Vec<u8>>),
}

pub struct Updates {
    item: MenuItem<Wry>,
    phase: Mutex<Phase>,
}

impl Updates {
    pub fn new(item: MenuItem<Wry>) -> Self {
        Self { item, phase: Mutex::new(Phase::Idle) }
    }
}

pub fn menu_item(app: &AppHandle) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, "updates", CHECK_LABEL, true, None::<&str>)
}

/// Tray action: install a downloaded update, or check for a new one.
pub fn on_menu(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || run(&app, true));
}

/// Quiet check after startup; the user only hears about an available update.
pub fn check_after_startup(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(20));
        run(&app, false);
    });
}

fn run(app: &AppHandle, manual: bool) {
    let Some(updates) = app.try_state::<Updates>() else { return };
    let ready = {
        let mut phase = updates.phase.lock().unwrap();
        match &*phase {
            Phase::Busy => return,
            Phase::Ready(update, bytes) => Some(((**update).clone(), bytes.clone())),
            Phase::Idle => {
                *phase = Phase::Busy;
                None
            }
        }
    };
    if let Some((update, bytes)) = ready {
        offer_install(app, &updates, update, bytes);
        return;
    }
    set_label(&updates, "Memeriksa pembaruan…", false);
    let current = app.package_info().version.to_string();
    let checked = app.updater().map_err(|error| error.to_string()).and_then(|updater| {
        tauri::async_runtime::block_on(updater.check()).map_err(|error| error.to_string())
    });
    let update = match checked {
        Ok(Some(update)) => update,
        Ok(None) => {
            if manual {
                message(app, MessageDialogKind::Info, &format!("Visitor Counter v{current} sudah versi terbaru."));
            }
            return reset(&updates);
        }
        Err(error) => {
            eprintln!("Update check failed: {error}");
            if manual {
                message(app, MessageDialogKind::Warning, "Pemeriksaan pembaruan gagal. Periksa koneksi internet lalu coba lagi.");
            }
            return reset(&updates);
        }
    };
    let notes = update.body.as_deref().map(str::trim).filter(|notes| !notes.is_empty()).unwrap_or("Tidak ada catatan rilis.");
    let accepted = ask(
        app,
        &format!(
            "Versi {} tersedia (terpasang v{current}).\n\nCatatan rilis:\n{notes}\n\nUnduh sekarang? Monitoring tetap berjalan selama pengunduhan.",
            update.version
        ),
        "Unduh",
    );
    if !accepted {
        return reset(&updates);
    }
    let mut downloaded = 0usize;
    let mut shown = None;
    let result = tauri::async_runtime::block_on(update.download(
        |chunk, total| {
            downloaded += chunk;
            let percent = total.filter(|total| *total > 0).map(|total| (downloaded as u64 * 100 / total).min(100));
            if percent != shown {
                shown = percent;
                let label = percent.map_or("Mengunduh pembaruan…".into(), |percent| format!("Mengunduh pembaruan… {percent}%"));
                set_label(&updates, &label, false);
            }
        },
        || {},
    ));
    match result {
        Ok(bytes) => {
            let bytes = Arc::new(bytes);
            *updates.phase.lock().unwrap() = Phase::Ready(Box::new(update.clone()), bytes.clone());
            set_label(&updates, &format!("Pasang pembaruan v{}", update.version), true);
            offer_install(app, &updates, update, bytes);
        }
        Err(error) => {
            eprintln!("Update download failed: {error}");
            message(app, MessageDialogKind::Warning, "Pengunduhan pembaruan gagal atau tanda tangan tidak valid. Aplikasi tetap berjalan; coba lagi dari menu tray.");
            reset(&updates);
        }
    }
}

fn offer_install(app: &AppHandle, updates: &Updates, update: Update, bytes: Arc<Vec<u8>>) {
    let accepted = ask(
        app,
        &format!(
            "Pembaruan v{} siap dipasang.\n\nMonitoring kamera akan berhenti sebentar dan aplikasi dimulai ulang. Data, foto, dan pengaturan tidak dihapus.\n\nPasang sekarang?",
            update.version
        ),
        "Pasang sekarang",
    );
    if !accepted {
        // Postponed: the downloaded update stays available from the tray.
        return;
    }
    set_label(updates, "Memasang pembaruan…", false);
    // Installers replace files the local services hold open; stop them first.
    crate::stop_services(app);
    match update.install(bytes.as_slice()) {
        Ok(()) => app.restart(),
        Err(error) => {
            eprintln!("Update install failed: {error}");
            message(app, MessageDialogKind::Error, "Pemasangan pembaruan gagal. Aplikasi akan dimulai ulang dengan versi yang terpasang; data tidak berubah.");
            app.restart();
        }
    }
}

fn reset(updates: &Updates) {
    *updates.phase.lock().unwrap() = Phase::Idle;
    set_label(updates, CHECK_LABEL, true);
}

fn set_label(updates: &Updates, text: &str, enabled: bool) {
    let _ = updates.item.set_text(text);
    let _ = updates.item.set_enabled(enabled);
}

fn ask(app: &AppHandle, text: &str, accept: &str) -> bool {
    app.dialog()
        .message(text)
        .title("Pembaruan Visitor Counter")
        .buttons(MessageDialogButtons::OkCancelCustom(accept.into(), "Nanti".into()))
        .blocking_show()
}

fn message(app: &AppHandle, kind: MessageDialogKind, text: &str) {
    app.dialog().message(text).title("Pembaruan Visitor Counter").kind(kind).blocking_show();
}
