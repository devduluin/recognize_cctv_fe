# Runner frontend dan backend di Windows

Untuk menjalankan tanpa jendela CMD/PowerShell, klik dua kali `run-windows.vbs`.
Buat shortcut Desktop dari file VBS tersebut; biarkan file asli di repo.
Browser tetap dibuka setelah kedua layanan siap. `stop-windows.vbs` menghentikan
paksa pohon proses runner background maupun terminal untuk checkout ini; tunggu pekerjaan
deteksi/upload selesai sebelum menggunakannya. Menutup browser tidak menghentikan
server. Runner memeriksa PID dan waktu mulai agar PID yang dipakai ulang tidak
menghentikan proses lain. PID anak Python/Node juga dicatat saat startup agar
tetap bisa dihentikan bila shell induk sudah keluar. Jangan menjalankan stop saat startup masih berlangsung.
Setelah stop berhasil, dialog konfirmasi muncul; tab browser tidak ditutup otomatis.
Jika skrip lama belum mencatat proses (terutama peluncuran lewat CMD), hentikan
server lama dengan Ctrl+C satu kali, lalu gunakan runner terbaru. Jangan menyalin
file VBS sendirian ke Desktop; buat shortcut ke file asli pada checkout yang sama.
Error startup ditampilkan melalui dialog dan proses startup yang sudah dimulai
dibersihkan. Log disimpan pada `%LOCALAPPDATA%\VisitorCounterRunner\<project-id>`
(terpisah per lokasi checkout), ditimpa pada peluncuran berikutnya. Perlakukan log
backend sebagai data lokal yang mungkin sensitif. VBScript/Windows Script Host
harus tersedia dan diizinkan pada Windows. Alternatif untuk diagnosis adalah
`run-windows.cmd` yang tetap menampilkan terminal. Mode background belum diuji
langsung pada Windows dari lingkungan macOS ini.

Klik dua kali `run-windows.cmd` di folder frontend. Untuk shortcut Desktop,
klik kanan file tersebut → Show more options → Send to → Desktop (create shortcut).
Shortcut tetap menunjuk ke checkout ini; jangan pindahkan file CMD sendirian.

Persiapan sekali pada Windows: instal Node.js sesuai `desktop.config.json`,
Python 3.12 dan uv; letakkan repo frontend dan backend berdampingan.
Dari folder frontend jalankan:

```powershell
uv sync --project ..\recognize_cctv\desktop --locked --python 3.12
npm ci --include=dev
```

Siapkan `.env` backend mengikuti `.env.example` dan dokumentasi backend,
termasuk database yang dapat diakses, autentikasi, migrasi serta layanan media
yang dibutuhkan. Runner tidak membuat/migrasi database atau menjalankan MediaMTX.
Ini menjalankan mode web development dari source, bukan mode desktop SQLite.

Runner membuka terminal backend (127.0.0.1:8000) dan Next.js development
(127.0.0.1:3000). Runner menunggu respons HTTP 200 dari kedua layanan,
lalu otomatis membuka http://127.0.0.1:3000 pada browser default. Halaman awal
mengikuti autentikasi aplikasi (login bila belum memiliki sesi).
Jika belum siap dalam sekitar 3 menit, runner menampilkan error; kedua terminal
tetap terbuka untuk diagnosis. Setelah server siap, URL juga bisa dibuka manual.
Perubahan source frontend mengikuti Next.js dev; setelah mengubah source backend,
hentikan kedua server lalu jalankan runner lagi. Backend tidak memakai reload.
Error startup tetap terlihat pada terminal masing-masing.

Tekan Ctrl+C di kedua terminal untuk menghentikan server. Runner menolak port
yang sudah dipakai agar tidak sengaja menjalankan server ganda. Tidak ada proses
lain yang dihentikan otomatis. Kedua layanan hanya bind ke loopback.

URL API frontend ditetapkan hanya pada proses yang dijalankan; file `.env`
tidak ditimpa. Backend tetap membaca `.env` miliknya. Untuk lokasi backend atau
environment Python khusus, variabel yang sudah ada `DESKTOP_BACKEND_ROOT` dan
`DESKTOP_PYTHON` juga didukung; gunakan path absolut. Tidak ada variabel baru.

Windows PowerShell menjalankan skrip dengan ExecutionPolicy Bypass hanya untuk
proses runner; kebijakan permanen sistem tidak diubah. Kebijakan organisasi dapat
tetap membatasi eksekusi. Perilaku launch Windows perlu diverifikasi di Windows.

`npm test` menjalankan uji lifecycle proses runner hanya pada Windows: mode
terminal/background, penghentian anak proses saat induknya sudah keluar, dan
perlindungan PID lama. Uji tersebut dilewati pada macOS/Linux.
