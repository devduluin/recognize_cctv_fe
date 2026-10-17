# Build installer Windows dari Mac

Workflow **Build Windows EXE** di `.github/workflows/windows-exe.yml` hanya
membangun Windows x64. Backend PyInstaller dibangun native di `windows-2025`,
beserta Next.js standalone, Node.js, MediaMTX, FFmpeg dan installer NSIS `.exe`.
Mac Anda hanya dipakai untuk mengubah source dan memicu workflow melalui browser.

## Menjalankan

1. Commit dan push perubahan frontend serta backend ke repositori masing-masing.
   Pastikan workflow tersedia pada default branch repositori frontend agar tombol
   manual GitHub Actions tersedia.
2. Buka repositori frontend → **Actions → Build Windows EXE → Run workflow**.
3. Pilih branch frontend yang akan dibangun.
4. Isi `backend_ref` dengan **commit SHA backend lengkap, 40 karakter** untuk
   menyertakan perubahan backend terbaru. Input kosong memakai `backendRef` dari
   `desktop.config.json`; input kosong tidak otomatis mengambil backend terbaru.
   Alternatifnya, perbarui pin tersebut dalam source sebelum menjalankan workflow.
5. Tunggu job berhasil, lalu unduh artifact
   `windows-exe-x64-<versi>-<nomor-run>` pada halaman run. Artifact disimpan 7 hari.
6. Ekstrak ZIP artifact dan jalankan `Visitor-Counter-<versi>-win-x64.exe` di
   komputer Windows. Nama tepat mengikuti konfigurasi electron-builder.

Workflow memakai versi Node.js/Python dari `desktop.config.json`, Python dari
`desktop/uv.lock`, serta frontend dari `package-lock.json`. Versi aplikasi tetap
bersumber dari `package.json`; menjalankan build tidak menaikkan versi.

## Akses source backend

Jika repo backend privat, sediakan secret **DESKTOP_SOURCE_TOKEN** yang memiliki
izin baca contents pada repo backend. Secret dapat ditempatkan pada environment
**desktop-development** yang dipakai job ini. Token bawaan `github.token` dipakai
jika secret tidak diisi, tetapi tidak memberi akses ke repo privat lain secara
otomatis. Kredensial tidak dibundel ke aplikasi dan checkout tidak menyimpannya
sebagai konfigurasi Git untuk langkah berikutnya.

Tidak ada environment variable runtime aplikasi baru. `DESKTOP_RELEASE=false`,
`DESKTOP_PYTHON`, `DESKTOP_BACKEND_ROOT` dan variabel `EXPECTED_*` dalam workflow
hanya mengatur build/validasi CI. Build tidak memerlukan database produksi.

## Pemeriksaan dan hasil

Build memeriksa CUDA dari executable backend hasil PyInstaller melalui
`--runtime-info`. Kemampuan runtime disimpan pada `build-manifest.json` sebagai
`inferenceRuntime` dan ditampilkan di ringkasan Actions. `cuda_built` menunjukkan
dukungan CUDA paket; `cuda_available` menunjukkan GPU/driver di mesin build saja.
Runner GitHub tanpa GPU tetap dapat menghasilkan paket dengan runtime CUDA.
Paket CPU-only tetap valid dan diberi peringatan saat build; pemeriksaan ini tidak
mengubah dependency PyTorch menjadi versi CUDA secara otomatis.

Frontend dan backend harus sama-sama memuat perubahan runtime ini. Setelah
commit/push backend, gunakan SHA tersebut pada input **backend_ref** saat Run
workflow atau perbarui pin `desktop.config.json`. Backend lama yang belum mengenal
`--runtime-info` tidak dapat dipakai oleh build baru ini.

Artifact hanya diunggah setelah semua langkah wajib berhasil:

- Tes backend, lint/test/typecheck frontend dan tes lifecycle desktop.
- Build PyInstaller Windows, standalone frontend dan resource target Windows x64.
- Startup aplikasi hasil packaging dua kali untuk memeriksa layanan lokal dan
  persistensi data uji.
- Instalasi NSIS secara silent di direktori sementara runner, dilanjutkan startup
  aplikasi terpasang dua kali. Data uji memakai direktori sementara terisolasi.
- Pemeriksaan header executable, versi, platform/arsitektur dan SHA kedua source.

Hasil unduhan berisi installer, `build-manifest.json`, `SHA256SUMS.txt`, serta
blockmap/metadata updater jika dihasilkan. Untuk memeriksa checksum dari Mac,
jalankan di folder artifact yang sudah diekstrak:

```bash
shasum -a 256 -c SHA256SUMS.txt
```

`packaged-smoke.cjs` tetap bisa dipakai seperti sebelumnya. Untuk menguji aplikasi
terpasang, gunakan:

```bash
node scripts/desktop/packaged-smoke.cjs --executable "C:/path/Visitor Counter.exe"
```

Workflow ini menghasilkan **build pengembangan**, tidak menerbitkan GitHub
Release, dan tidak memasok sertifikat signing produksi. Installer dapat belum
bertanda tangan. Checksum memeriksa keutuhan unduhan; checksum bukan pengganti
code signing. Gunakan workflow `Desktop native builds` yang sudah ada untuk
release resmi dengan persyaratan signing dan metadata update-nya.

Pemeriksaan otomatis pada runner bukan pengganti uji upgrade dari versi sebelumnya,
pengujian kamera/model pada perangkat nyata, atau pengujian Windows 10/11 bersih.
