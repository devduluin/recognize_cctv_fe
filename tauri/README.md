# Desktop Tauri — status pengembangan

Tauri 2 adalah satu-satunya runtime jendela desktop. Next.js tetap menggunakan
standalone dan Node.js yang dibundel. FastAPI/PyInstaller, MediaMTX, FFmpeg,
API, SSR, serta UI dipertahankan. Tidak memakai static export.

## Status verifikasi

Kode host/gateway dan tes keamanan tersedia. Kompilasi Rust, jendela WebView,
installer, penandatanganan, serta kamera nyata BELUM terverifikasi. Pada pengujian awal Rust/Cargo belum tersedia; sandbox juga menolak listen localhost.
Tes gateway memakai transport HTTP dalam memori dan bukan pengujian WebView.
Pengunduhan Rust juga gagal karena DNS `static.rust-lang.org` tidak dapat diakses.
Runtime sebelumnya, dependensi serta workflow installernya sudah dihapus.
Tauri CLI dan dependensi native tetap dibutuhkan untuk validasi; aplikasi belum siap produksi.

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

Build aplikasi native dengan resource backend/frontend produksi:

```sh
npm run tauri:build
```

Build menggunakan pipeline `scripts/desktop/build.cjs` untuk PyInstaller,
Next.js standalone, model, dan Node. Setelah itu `cargo tauri build --bundles app,dmg -- --locked`
di macOS atau `cargo tauri build --bundles nsis -- --locked` di Windows mengompilasi dan mengemas aplikasi.
Dependensi Cargo harus sudah tersedia atau dapat diunduh.
Hasil berada di `src-tauri/target/release/bundle/macos/Visitor Counter.app`,
`bundle/dmg/`, atau `bundle/nsis/`.

Jika release executable dan resource sudah dibangun, jalankan `npm run desktop:package`
untuk packaging saja. Perintah ini tidak membangun ulang kode; gunakan full build
setelah perubahan backend/frontend. Installer, signing/notarization distribusi dan
peluncuran di mesin bersih masih perlu validasi native sebelum rilis produksi.
Versi aplikasi berasal dari `package.json` melalui `tauri.conf.json`.

## Lifecycle dan keamanan

1. Host Rust memperoleh kunci sesi dari Keychain macOS atau Credential Manager Windows.
2. Node menjalankan pengelola layanan bersama di `desktop/`.
3. FastAPI dan Next sehat sebelum jendela utama dibuat.
4. Gateway hanya bind 127.0.0.1 dan hanya meneruskan ke layanan yang ditentukan.
5. URL bootstrap sekali pakai membuat cookie HttpOnly/SameSite=Strict dan
   memuat dokumen lokal sebelum navigasi. Dokumen ini memverifikasi sesi lewat
   `/__desktop/session-check`, baru membuka workspace. Ini menghindari hilangnya
   cookie Strict pada redirect lintas origin dari layar startup Tauri. Jika
   cookie belum tersedia, tampilkan petunjuk pemulihan tanpa membuka workspace.
   Gateway memeriksa Host, Origin, dan cookie sebelum meneruskan request dengan token lokal.
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

Profil memakai folder aplikasi yang sudah ada: `~/Library/Application Support/Visitor Counter`
atau `%APPDATA%/Visitor Counter`. Tidak memindahkan/menghapus database, foto, model,
atau rekaman. Lock profil mencegah dua proses host desktop memakai data yang sama;
jangan jalankan aplikasi versi lama secara bersamaan.
Sesi login Tauri memakai `tauri-auth-session.enc`; file sesi versi lama dipertahankan,
namun tidak dapat langsung didekripsi oleh Tauri. Login sekali setelah beralih.
Cadangkan folder profil sebelum pengujian terhadap data operasional.

## Pekerjaan sebelum migrasi rilis dinyatakan selesai

- Cargo.lock tersedia dan kompilasi native macOS telah berhasil. Commit lockfile
  tersebut dan gunakan `--locked` untuk build berikutnya. Distribusi installer
  tetap memerlukan pengujian native dan penandatanganan sebelum rilis.
- Verifikasi macOS arm64/x64 dan Windows, startup/shutdown normal dan crash,
  login ulang, profil lama, SSR, API proxy, Server Actions, dan download laporan.
- Uji WebRTC, WHEP session DELETE, HLS playlist/segmen, SSE, izin Local Network,
  serta codec pada WKWebView dan WebView2. Perbedaan WebView dapat memengaruhi video.
- Gateway meneruskan WebSocket development Next.js (`/_next/hmr` dan `/_next/webpack-hmr`) hanya untuk sesi desktop yang sah dan origin lokal yang sama. Target selalu server frontend lokal; koneksi ini dinonaktifkan dalam production. Ini juga menjaga kanal debug development agar hydration tidak tertahan. Validasi HMR di WebView native masih perlu dilakukan di macOS/Windows.
- Implementasikan Tauri updater dengan verifikasi tanda
  tangan, metadata GitHub Releases, aksi manual dan UI progres. Belum tersedia.
- Siapkan signing semua binary pendamping, notarization macOS dan installer NSIS;
  tidak menonaktifkan pemeriksaan signature untuk melewati kegagalan build.
- Tambahkan CI native ketiga target dan uji installer/upgrade bersih. Workflow
  validasi native tidak memublikasikan release sampai seluruh gerbang ini lulus.

Referensi: https://v2.tauri.app/start/frontend/nextjs/,
https://v2.tauri.app/develop/sidecar/,
https://v2.tauri.app/start/prerequisites/.

### Startup window

The bundled `src-tauri/bootstrap/index.html` opens immediately while local services start on a background thread. Its icon is bundled locally; it makes no network requests. Status messages come from service startup stages over the private host stdout pipe, followed by session restoration and gateway readiness. No fabricated percentage is displayed. The window opens the authenticated local workspace only after health checks pass. Startup failures remain visible with instructions to close and reopen the application. Closing during startup cancels startup and stops managed services. Reduced-motion settings are respected.

Validate with `npm run desktop:test` and `cargo check --manifest-path src-tauri/Cargo.toml --locked --offline`. Native rendering and close-during-startup behavior still require a manual macOS/Windows run.

### macOS resource size

`tauri.macos.conf.json` copies the resource directory through `bundle.macOS.files`
to `Contents/Resources/runtime/resources`. Tauri's directory copy preserves
PyInstaller's relative library symlinks before signing. The generic resource map
dereferences file symlinks and previously added about 1.17 GiB of duplicate ML
libraries. Windows keeps the generic resource map in `tauri.windows.conf.json`.

`beforeBundleCommand` runs `scripts/tauri/validate-resources.cjs`, rejecting
absolute, broken, or out-of-bundle links. It never deletes models or libraries.
Repackage existing resources with `npm run desktop:package`; for APP-only checks,
use `cargo tauri bundle --bundles app --ci`. Direct Cargo commands also run the
resource validation hook.

Measured macOS APP after this change: 2.94 GiB (about 3.0 GiB allocated), versus
about 4.2 GiB allocated previously. Native macOS signing/notarization remains a
separate release gate; do not treat a successful size check as signing validation.

### Build resource optimization

`desktop:build` removes TensorFlow/PyTorch C++ development headers from generated
backend resources before running the backend self-test. Inference libraries,
Python modules, FaceNet, gender, Re-ID and selectable YOLO weights remain. Exported
`*.directml.onnx`/`*.directml.json` files are retained on Windows and omitted on
macOS, where the DirectML adapter is not used. Source models and virtual
environments are never pruned.

Copied MP4 samples are encoded as H.264, CRF 20, preset fast, using two encoder
threads. Resolution, frame rate and audio streams are preserved. Each candidate
must decode without errors and be smaller before replacing the generated copy.
Original source samples remain unchanged. Compression is lossy; identical
recognition results are not guaranteed and require separate accuracy evaluation.
`desktop-cache/compressed-samples` caches outputs by source content, encoder and
compression profile; repeated optimization avoids another generation of lossy
encoding. The cache is excluded from application resources and Git.

Latest measured optimized APP: **2.71 GiB**, down from 2.94 GiB after symlink
repair (about 232 MiB additional reduction). Seven sample videos became smaller;
the 4K sample kept its original because re-encoding was larger. All eight videos
retained their original dimensions, frame rate, frame count and duration.
