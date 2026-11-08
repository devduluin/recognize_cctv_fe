# Windows desktop build

The desktop runtime is Tauri 2. Build on Windows x64 because the Python backend is
packaged for the host platform. Prepare Rust/MSVC/WebView2, frontend dependencies,
and the locked Python environment as described in [the Tauri guide](../tauri/README.md).

Run `npm run desktop:build` from the frontend root to build the backend, Next.js
runtime, and Windows MSI installer in one step. The MSI is written to
`src-tauri/target/release/bundle/msi/`.

Run `npm run desktop:package` to repackage existing release resources without
rebuilding the backend or frontend. Before either command, quit Visitor Counter
from its system tray menu; closing the window only hides it and leaves processes
running that can lock the executable and resources.

Build on Windows x64. The MSI has been generated successfully locally; installation
on a clean machine still needs verification before production distribution. Use
**Tauri native validation** for manual CI validation. The workflow does not publish
releases or distribute the unbundled executable as an installer.
