# Desktop validation plan

The only desktop window runtime is Tauri 2. Shared Node service supervision lives
in `desktop/`. The authoritative application version remains root `package.json`.

Preserve FastAPI/PyInstaller, Next.js standalone and its bundled Node.js runtime.
Validate startup/shutdown/crashes, persistent data, OS-encrypted login, SSR, proxy
API, Server Actions, video, permissions, downloads and upgrade behavior on Windows
x64 and macOS arm64/x64. No externally hosted FE/BE or system Python/Node should be
required by an eventual installed release.

Current commands and production release blockers are documented in
[DESKTOP.md](DESKTOP.md) and [the Tauri guide](../tauri/README.md). Installer signing,
notarization, verified updates and native end-to-end validation remain mandatory.
