# Windows desktop build

The desktop runtime is Tauri 2. Build on Windows x64 because the Python backend is
packaged for the host platform. Prepare Rust/MSVC/WebView2, frontend dependencies,
and the locked Python environment as described in [the Tauri guide](../tauri/README.md).

`npm run desktop:build` builds resources and a Windows NSIS installer.
`npm run desktop:package` packages an existing release build and current resources.
The installer is written to `src-tauri/target/release/bundle/nsis/`.
NSIS packaging and clean-machine installation still require Windows verification
before production distribution. The old Windows installer workflow has been
removed. Use **Tauri native validation** for manual CI validation. The workflow does not publish releases or distribute the
unbundled executable as an installer.
