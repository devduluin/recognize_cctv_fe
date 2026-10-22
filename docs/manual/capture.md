# Membuat paket panduan dan screenshot

Sumber panduan: [README.md](README.md). Semua screenshot menggunakan UI Next.js asli dengan respons API contoh yang terisolasi. Tidak ada database, kamera langsung, kredensial asli, atau backend produksi yang dipakai. Screenshot ini menjelaskan penggunaan UI; bukan bukti bahwa integrasi kamera, backend, atau sinkronisasi sudah lolos pengujian.

## Satu perintah di Mac atau Windows

Dari root repository frontend, setelah `npm ci`, jalankan:

```sh
npm run docs:generate
```

Perintah ini membangun UI dengan konfigurasi API contoh, mengambil sembilan screenshot asli melalui Chrome/Edge/Chromium headless, membuat PDF, lalu otomatis memasang gambar ke `public/manual/screenshots/`. Server lokal dan sesi browser sementara ditutup setelah capture. Tidak ada login ke server produksi atau kamera sungguhan.

Buka kembali **Manual Guide** setelah menjalankan aplikasi. Jika memakai server development yang sudah aktif, mulai ulang agar perubahan folder public terbaca. Untuk server production atau installer, lakukan build ulang seperti biasa setelah gambar terpasang. Capture membutuhkan lingkungan yang mengizinkan server localhost dan browser headless berjalan.

## GitHub Actions

1. Push perubahan dokumentasi ke repository frontend. Workflow manual harus sudah ada di default branch agar tombol Run workflow tersedia.
2. Buka **Actions → Application Manual → Run workflow**, lalu pilih branch yang ingin didokumentasikan.
3. Setelah berhasil, unduh artifact `visitor-counter-manual-<nomor run>` dan ekstrak seluruh isinya.
4. Buka `index.html` atau `Visitor-Counter-Manual.pdf`. Folder `screenshots/` berisi sembilan PNG; `manifest.json` mencatat versi, commit, waktu capture, dan penggunaan data contoh.

Workflow tidak memublikasikan release dan tidak memerlukan secret server. Bila fixture tidak mencakup API yang dipakai halaman, request eksternal muncul, halaman menampilkan alert, atau gambar gagal dibuat, workflow gagal dan tidak mengunggah paket sebagai hasil sukses.

Screenshot meliputi login, dashboard, kamera, daftar Event, form Event, daftar pengguna, form izin, sistem kamera, dan sinkronisasi. Bagian monitoring langsung, analisis video, dan koreksi dijelaskan dalam teks; screenshot kamera/foto pengunjung nyata tidak diambil otomatis.

## Lokal

Gunakan Node sesuai `desktop.config.json` dan sesi desktop Windows/macOS yang dapat menjalankan browser headless. Jalankan dari root repository frontend setelah dependensi terpasang (`npm ci`).

```sh
npm run docs:check
npm run docs:build
```

Perintah kedua hanya membuat HTML tanpa screenshot/PDF. `docs:capture` memasang gambar otomatis setelah pengambilan berhasil. Untuk paket lengkap, build Next dengan variabel build berikut (PowerShell):

```powershell
$env:DESKTOP_BUILD = 'true'
$env:NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV = ''
$env:IS_MAINTENANCE = 'false'
$env:NEXT_PUBLIC_IS_MAINTENANCE = 'false'
$env:IS_MAINTANANCE = 'false'
$env:NEXT_PUBLIC_IS_MAINTANANCE = 'false'
npm run build -- --webpack
npm run docs:capture
```

Di macOS (zsh/bash):

```sh
DESKTOP_BUILD=true NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV='' IS_MAINTENANCE=false NEXT_PUBLIC_IS_MAINTENANCE=false IS_MAINTANANCE=false NEXT_PUBLIC_IS_MAINTANANCE=false npm run build -- --webpack
npm run docs:capture
```

Variabel tersebut sudah digunakan aplikasi; tidak ada variabel runtime baru. Gunakan checkout bersih tanpa konfigurasi `.env` produksi: nilai public Next.js masuk ke hasil build. Capture menolak permintaan jaringan di luar server lokal dan akan gagal jika build masih mengarah ke backend eksternal.

Hasil ada di `artifacts/manual/` dan diabaikan Git. HTML, Markdown, PNG, dan PDF perlu dibagikan sebagai satu paket jika tautan gambar ingin tetap berfungsi. Untuk HTML saja, screenshot baru tersedia setelah capture berhasil. Jangan menyatakan paket lengkap sebelum workflow/capture selesai.

## Memperbarui panduan

Ubah README, sesuaikan fixture dan langkah capture bila label/endpoint UI berubah, lalu jalankan ulang pemeriksaan serta capture. API contoh sengaja menolak mutasi dan endpoint yang tidak dikenal. Perubahan fixture tidak memengaruhi perilaku aplikasi produksi. Jangan menambahkan foto pengunjung atau password asli ke fixture.

## Menampilkan panduan di panel aplikasi

Tombol **Manual Guide** di header membuka `/manual-guide`. Semua akun yang sudah login dapat membacanya tanpa izin administrator. Teks memakai sumber README yang sama dan disertakan dalam Next.js standalone, sehingga tersedia di desktop offline. Screenshot yang belum tersedia tidak ditampilkan sebagai gambar rusak.

Untuk menyertakan screenshot dalam web/desktop, ekstrak hasil workflow ke `artifacts/manual/` pada checkout yang akan dibangun, lalu jalankan:

```sh
npm run docs:assets
npm run build
```

Untuk paket desktop, jalankan build desktop seperti biasa setelah `docs:assets`. Script menyalin sembilan PNG ke `public/manual/screenshots/`; folder public ikut dibundel oleh proses packaging yang ada. Aset hasil capture diabaikan Git. Teks tetap dapat dibaca jika deployment belum menyertakan screenshot.

Ekspor PDF memakai server lokal yang sama dengan capture UI; akses file HTML melalui `file://` tidak diperlukan. Manifest baru ditandai `complete` setelah sembilan screenshot dan PDF berhasil dibuat. Proses induk dan pemasangan aset memvalidasi kelengkapan tersebut, sehingga kegagalan ekspor atau penghentian browser headless tidak dapat dilaporkan sebagai capture sukses. Paket lama tanpa tanda kelengkapan harus dibuat ulang dengan `npm run docs:capture`.

Capture memerlukan Chrome, Edge, atau Chromium terpasang pada mesin dokumentasi.
Jika lokasi browser tidak standar, set `DOCS_BROWSER_PATH` ke executable browser.
Ini hanya prasyarat generator dokumentasi, bukan dependensi aplikasi desktop.
Tidak diperlukan perubahan atau penonaktifan sandbox browser.
