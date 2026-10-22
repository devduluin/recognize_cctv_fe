# Visitor Counter — Frontend & Desktop

Antarmuka web Visitor Counter (Next.js) dan aplikasi desktop-nya (Tauri 2) untuk Windows
dan macOS. Backend FastAPI ada di repo [recognize_cctv](../recognize_cctv/README.md).

Panduan pengguna lengkap: [Manual Visitor Counter](docs/manual/README.md).

## Fitur

- Kelola event, kamera (master CCTV), dan pengaturan per kamera: arah Masuk/Keluar,
  garis atau zona, dan gender cowok/cewek/auto (muncul kalau deteksi gender aktif).
- Monitoring langsung dengan preview WebRTC/HLS/MJPEG dan overlay garis/zona.
- Statistik per jam/hari, pengunjung baru vs kembali, heatmap pengunjung, dan laporan
  PDF/Excel.
- Upload rekaman video dari **Detail Event → Upload Video**.
- Pengaturan privasi (simpan foto, masa simpan data), pengguna dan izin, serta
  sinkronisasi database desktop ke server.

## Menjalankan versi web

Kebutuhan: Node.js 24 dan backend yang sudah berjalan.

```bash
npm ci
cp .env.example .env    # isi NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV dengan URL backend
npm run dev             # http://localhost:3000
```

| Variabel | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV` | URL backend, misalnya `http://localhost:8000`. |
| `NEXT_PUBLIC_APP_MODE` | `multi_tenant` atau `single_tenant`. |
| `IS_MAINTANANCE` | `true` menampilkan halaman maintenance. |

Variabel `NEXT_PUBLIC_*` ikut ter-bundle ke browser saat build. Jangan isi dengan
rahasia, dan build ulang setelah mengubahnya.

Pemeriksaan sebelum commit:

```bash
npm run lint && npm run typecheck && npm test
```

Deploy web produksi (Docker): [docs/PRODUCTION.md](docs/PRODUCTION.md).

## Aplikasi desktop

Aplikasi desktop menjalankan backend (PyInstaller) dan Next.js standalone sebagai
layanan lokal di `127.0.0.1`, lalu menampilkannya di jendela Tauri. Pengguna tidak
perlu memasang Python atau Node.js.

Kebutuhan development: Rust, Tauri CLI (`cargo install tauri-cli --version "^2" --locked`),
dan environment Python backend (`uv sync --project desktop --locked` di `../recognize_cctv`).

```bash
npm run desktop:assets     # unduh Node.js dan MediaMTX yang dikunci
npm run desktop:dev        # jalankan desktop dalam mode development
npm run desktop:build      # build backend + Next.js + installer
npm run desktop:package    # kemas ulang build yang sudah ada tanpa rebuild
npm run desktop:test       # tes host layanan lokal dan Tauri
```

Hasil build ada di `src-tauri/target/release/bundle/`: `macos/` dan `dmg/` di macOS,
`nsis/` di Windows. Build harus dilakukan di OS tujuan, karena backend PyInstaller
tidak bisa di-cross-compile. Tambahkan `CI=true` agar Finder tidak membuka DMG saat build.

Data pengguna disimpan di luar folder aplikasi dan tidak terhapus saat update:
`~/Library/Application Support/Visitor Counter` (macOS) atau
`%APPDATA%\Visitor Counter` (Windows).

Detail setup, struktur, dan status validasi: [tauri/README.md](tauri/README.md).

## Rilis dan pembaruan otomatis

Versi aplikasi hanya ditentukan di `package.json`.

1. Naikkan `version` di `package.json`.
2. Tambahkan bagian `## <versi>` di [CHANGELOG.md](CHANGELOG.md). Isinya tampil
   sebagai catatan rilis di dialog update.
3. Commit, buat tag `v<versi>`, lalu push tag-nya.
4. Workflow **Desktop release** membangun Windows x64, macOS arm64, dan macOS Intel,
   lalu membuat **draft** GitHub Release beserta `latest.json`.
5. Uji installer dari draft. Setelah draft dipublikasikan, aplikasi yang terpasang
   akan menawarkan update.

Update ditandatangani dan hanya aktif kalau `DESKTOP_UPDATER_PUBKEY` (repository
variable) dan `TAURI_SIGNING_PRIVATE_KEY` (secret) diisi. Signing macOS memakai secret
`APPLE_*`. Cara membuat kunci dan daftar lengkap variabelnya ada di
[tauri/README.md](tauri/README.md#pembaruan-otomatis).

## Dokumentasi

| Topik | Dokumen |
| --- | --- |
| Manual pengguna | [docs/manual/README.md](docs/manual/README.md) |
| Membuat ulang screenshot/PDF manual | [docs/manual/capture.md](docs/manual/capture.md) (`npm run docs:generate`) |
| Desktop Tauri | [tauri/README.md](tauri/README.md), [docs/DESKTOP.md](docs/DESKTOP.md) |
| Build Windows | [docs/windows-exe-build.md](docs/windows-exe-build.md) |
| Deploy web | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| Sinkronisasi database | [../recognize_cctv/docs/database-sync.md](../recognize_cctv/docs/database-sync.md) |
| Pengguna dan izin | [../recognize_cctv/docs/user-management.md](../recognize_cctv/docs/user-management.md) |
| Riwayat perubahan | [CHANGELOG.md](CHANGELOG.md) |
