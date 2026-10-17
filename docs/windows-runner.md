# Runner frontend dan backend di Windows

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
