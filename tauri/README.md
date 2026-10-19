# Migrasi Tauri — jalur percobaan

Tauri 2 menggantikan jendela Electron pada jalur ini. Next.js tetap menggunakan
standalone dan Node.js yang dibundel. FastAPI/PyInstaller, MediaMTX, FFmpeg,
API, SSR, serta UI dipertahankan. Tidak memakai static export.

## Status verifikasi

Kode host/gateway dan tes keamanan tersedia. Kompilasi Rust, jendela WebView,
installer, penandatanganan, serta kamera nyata BELUM terverifikasi. Mesin kerja
saat implementasi tidak memiliki Rust/Cargo; sandbox juga menolak listen localhost.
Tes gateway memakai transport HTTP dalam memori dan bukan pengujian WebView.
Pengunduhan Rust juga gagal karena DNS `static.rust-lang.org` tidak dapat diakses.
Tes packaging Electron yang dijalankan terpisah memiliki dua kegagalan pada fixture
macOS (`No packaged macOS launchers found`); file hook/tes itu tidak diubah oleh migrasi ini.
Ini belum menggantikan jalur rilis Electron dan belum siap produksi.

## Menjalankan

Prasyarat pengembang:

- Rust stable dan Cargo; pada Windows gunakan MSVC serta prasyarat WebView2/Tauri.
- macOS: Xcode Command Line Tools. Build ARM64/Intel dari toolchain/mesin yang sesuai.
- Tauri CLI: `cargo install tauri-cli --version "^2" --locked`.
- Dependensi frontend terpasang lewat lockfile: `npm ci`.
- Environment backend `desktop/.venv` telah disiapkan sesuai panduan backend.
- Node dan media bundel disiapkan: `npm run desktop:assets`.

Di folder frontend:

```sh
npm run tauri:dev
```

Perintah ini memakai Python dari `../recognize_cctv/desktop/.venv`, Next.js dev,
serta Node/media dari `resources`. Tidak perlu menjalankan FE/BE secara manual.
Konfigurasi pengembangan yang sudah ada tetap didukung: `DESKTOP_BACKEND_ROOT`
menentukan lokasi backend, `DESKTOP_PYTHON` memilih executable Python.

Validasi host/gateway:

```sh
npm run tauri:check
```

Build executable native percobaan dengan resource backend/frontend produksi:

```sh
npm run tauri:build
```

Build menggunakan pipeline `scripts/desktop/build.cjs` untuk PyInstaller,
Next.js standalone, model, dan Node. Setelah itu `cargo tauri build --no-bundle`
mengompilasi host native. Tahap ini membutuhkan jaringan untuk dependensi Cargo.
Executable belum menjadi installer mandiri; resource belum dikemas oleh tahap
`--no-bundle`. Jangan menyalin executable tersebut ke komputer pengguna.
Versi aplikasi berasal dari `package.json` melalui `tauri.conf.json`.

## Lifecycle dan keamanan

1. Host Rust memperoleh kunci sesi dari Keychain macOS atau Credential Manager Windows.
2. Node menjalankan pengelola layanan yang sama seperti Electron.
3. FastAPI dan Next sehat sebelum jendela utama dibuat.
4. Gateway hanya bind 127.0.0.1 dan hanya meneruskan ke layanan yang ditentukan.
5. URL bootstrap sekali pakai membuat cookie HttpOnly/SameSite=Strict. Gateway
   memeriksa Host, Origin, dan cookie sebelum meneruskan request dengan token lokal.
6. Stream WHEP/HLS diarahkan melalui gateway; kredensial layanan tidak diberikan
   ke JavaScript. SSE dan data video diteruskan sebagai stream.
7. Bridge hanya menyediakan penyimpanan sesi dan pemeriksaan kamera; tidak ada
   akses shell, filesystem, atau IPC Rust generik dari halaman web.
8. Token login disimpan terenkripsi AES-256-GCM; kuncinya berada di penyimpanan OS.
9. Saat aplikasi ditutup, Rust mengirim shutdown; Node menghentikan layanan.
   EOF pada pipe Rust juga memicu shutdown. Pembukaan instance kedua difokuskan
   ke jendela yang ada.

`VISITOR_TAURI_DATA` dan `VISITOR_TAURI_KEY` adalah variabel internal yang dibuat
host Rust, bukan konfigurasi .env pengguna. Kunci dihapus dari environment Node
setelah encryption store dibuat dan tidak diteruskan ke layanan anak.

## Data dan kompatibilitas

Profil memakai folder Electron yang ada: `~/Library/Application Support/Visitor Counter`
atau `%APPDATA%/Visitor Counter`. Tidak memindahkan/menghapus database, foto, model,
atau rekaman. Lock profil dipakai bersama oleh kode Electron dan Tauri terbaru;
jangan jalankan Electron versi lama secara bersamaan karena belum mengenali lock.
Sesi login Tauri memakai `tauri-auth-session.enc`; file sesi Electron dipertahankan,
namun tidak dapat langsung didekripsi oleh Tauri. Login sekali setelah beralih.
Cadangkan folder profil sebelum pengujian terhadap data operasional.

## Pekerjaan sebelum migrasi rilis dinyatakan selesai

- Kompilasi native dan commit Cargo.lock hasil resolver; build CI selanjutnya
  wajib menggunakan lock tersebut. Saat ini dependency Rust belum dikunci secara
  transitif karena Cargo belum tersedia. Jangan menerbitkan build ini.
- Verifikasi macOS arm64/x64 dan Windows, startup/shutdown normal dan crash,
  login ulang, profil lama, SSR, API proxy, Server Actions, dan download laporan.
- Uji WebRTC, WHEP session DELETE, HLS playlist/segmen, SSE, izin Local Network,
  serta codec pada WKWebView dan WebView2. Perbedaan WebView dapat memengaruhi video.
- WebSocket HMR development belum diteruskan gateway; reload halaman saat diperlukan.
- Migrasikan automatic updater Electron ke Tauri updater dengan verifikasi tanda
  tangan, metadata GitHub Releases, aksi manual dan UI progres. Belum tersedia.
- Siapkan signing semua binary pendamping, notarization macOS dan installer NSIS;
  tidak menonaktifkan pemeriksaan signature untuk melewati kegagalan build.
- Tambahkan CI native ketiga target dan uji installer/upgrade bersih. Workflow
  Electron tetap dipertahankan sampai seluruh gerbang ini lulus.

Referensi: https://v2.tauri.app/start/frontend/nextjs/,
https://v2.tauri.app/develop/sidecar/,
https://v2.tauri.app/start/prerequisites/.
