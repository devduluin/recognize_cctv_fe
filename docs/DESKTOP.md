# Visitor Counter desktop — Tauri

Runtime desktop sekarang menggunakan Tauri 2. Next.js standalone tetap dijalankan
oleh Node.js bundel; FastAPI/PyInstaller dan layanan media dikelola otomatis.
Source, dependensi, konfigurasi installer dan automatic updater runtime lama telah
dihapus. Data pengguna yang sudah ada tetap dipertahankan.

Panduan: [setup Tauri, perintah dan status validasi](../tauri/README.md).

- Development: `npm run desktop:dev` atau `npm run tauri:dev`.
- Siapkan Node/media: `npm run desktop:assets`.
- Build resource Python dan Next.js: `npm run desktop:resources`.
- Build aplikasi dan installer: `npm run desktop:build` atau `npm run tauri:build`.
- Kemas ulang hasil release yang sudah ada: `npm run desktop:package`.
- Tes host: `npm run desktop:test` dan `npm run tauri:check`.

Build memilih APP/DMG di macOS dan NSIS di Windows. Output berada di
`src-tauri/target/release/bundle/` (`macos/Visitor Counter.app`, `dmg/`, atau `nsis/`).
`desktop:package` memakai executable dan resource yang sudah ada; gunakan full
build setelah perubahan backend/frontend. Signing/notarization distribusi,
instalasi di mesin bersih serta updater masih perlu diuji sebelum rilis produksi.

Profil lokal tetap berada di `~/Library/Application Support/Visitor Counter`
(macOS) atau `%APPDATA%/Visitor Counter` (Windows). Jangan menghapus profil ketika
mengganti runtime. Sesi Tauri menggunakan kunci OS dan `tauri-auth-session.enc`;
file sesi versi lama dipertahankan, tetapi mungkin diperlukan login sekali.

`desktop.config.json` mengunci sumber backend dan versi runtime. Workflow
**Tauri native validation** hanya dijalankan manual, menguji Windows x64, macOS
arm64/x64, dan tidak memublikasikan release. Lockfile Rust awal harus ditinjau dan
dicommit sebelum mengaktifkan rilis yang dapat direproduksi.
