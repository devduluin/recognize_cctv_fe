# Panduan Penggunaan Visitor Counter

Panduan untuk administrator, operator, dan pembaca laporan. Nama tombol mengikuti kode aplikasi saat panduan ini dibuat. Menu yang tersedia mengikuti izin akun Anda. Screenshot dalam paket dokumentasi menggunakan data contoh, bukan data operasional.

**Status gambar:** file sumber panduan tidak menyertakan screenshot yang belum diambil. Jalankan workflow **Application Manual** untuk mendapatkan panduan HTML, screenshot PNG dari UI aplikasi, serta PDF. Petunjuk ada di [pemeliharaan panduan](capture.md).

## 1. Mulai menggunakan aplikasi

### Desktop Windows dan macOS

1. Pasang aplikasi dari installer yang diberikan administrator. Di macOS, gunakan paket yang sesuai dengan Apple Silicon atau Intel.
2. Buka Visitor Counter dan tunggu proses persiapan selesai. Layanan lokal berjalan bersama aplikasi; Anda tidak perlu menjalankan Python atau Node.js sendiri.
3. Masuk menggunakan akun desktop. Jika belum punya akun, gunakan pendaftaran yang tersedia atau minta akun kepada administrator workspace.
4. Pastikan workspace benar sebelum membuat Event atau menghubungkan sinkronisasi.
5. Untuk selesai bekerja, hentikan monitoring yang sedang berjalan lalu keluar melalui aplikasi.

Sesi login desktop disimpan terenkripsi dan dipulihkan saat aplikasi dibuka kembali selama token masih valid. Setelah memasang versi dengan fitur ini, lakukan login sekali. Memilih **Keluar**, token kedaluwarsa, perubahan password yang mencabut sesi, atau akun yang dinonaktifkan/dihapus akan memerlukan login kembali.

Desktop menyimpan data lokal sehingga dapat digunakan tanpa internet. Kamera jaringan tetap membutuhkan koneksi ke jaringan kamera. Tanpa internet tidak selalu berarti kamera tidak bisa diakses.

### Web

Buka alamat aplikasi yang diberikan administrator, lalu masuk dengan akun server. Web memerlukan koneksi ke server. Web tidak menjadi aplikasi offline hanya karena desktop sudah dipasang.

Akun desktop dan server digunakan pada lingkungan masing-masing. Menggunakan email yang sama belum otomatis memindahkan data: hubungkan sinkronisasi dari desktop terlebih dahulu.

![Halaman masuk aplikasi](screenshots/01-login.png)

## 2. Mengenal navigasi

| Kelompok | Menu | Digunakan untuk |
| --- | --- | --- |
| Ringkasan | Dashboard | Melihat statistik pengunjung menurut tanggal dan Event. |
| Operasional | Event | Membuat Event, membuka monitoring, dan menganalisis video. |
| Operasional | Kamera | Mengelola sumber kamera workspace. |
| Administrasi | Pengguna | Membuat akun dan mengubah izin akses. |
| Administrasi | Pengaturan | Mengatur sistem, profil, tampilan dashboard, dan sinkronisasi. |

Jika suatu menu tidak muncul, administrator perlu memeriksa izin akun. Mengganti alamat halaman secara manual tidak memberikan izin tambahan.

## 3. Membaca Dashboard

1. Buka **Dashboard**.
2. Pilih tanggal yang ingin diperiksa dan filter Event jika tersedia.
3. Baca jumlah masuk serta grafik per jam. Perhatikan zona waktu workspace ketika membandingkan laporan.
4. Bandingkan kategori gender yang diketahui dan yang belum diketahui; nilai yang belum diketahui tetap perlu diperhitungkan.
5. Jika data baru berasal dari perangkat lain, pastikan desktop selesai menyinkronkan sebelum membandingkan angka.

Jumlah lintasan masuk, jumlah keluar, dan identitas pengunjung unik mempunyai arti berbeda. Jangan menganggap semua angka tersebut sebagai jumlah orang yang sedang berada di lokasi. Periksa judul indikator dan periode yang sedang dipilih.

![Dashboard dan statistik per jam](screenshots/02-dashboard.png)

## 4. Menambahkan dan mengelola kamera

1. Buka **Kamera**, lalu pilih **Tambahkan Kamera**.
2. Masukkan nama yang mudah dikenali, misalnya “Pintu Utama”.
3. Isi sumber kamera sesuai perangkat dan jaringan yang digunakan. Untuk kamera RTSP, minta URL yang benar dari pengelola kamera.
4. Simpan konfigurasi, kemudian periksa koneksi atau preview yang tersedia.
5. Gunakan nama yang konsisten karena kamera akan dipilih lagi saat membuat Event.

Pastikan komputer desktop dapat menjangkau kamera. Pada web, yang harus dapat menjangkau kamera adalah server pemrosesan. URL yang bisa dibuka di laptop belum tentu bisa diakses server.

URL RTSP dapat berisi kredensial kamera. Jangan menyalinnya ke screenshot atau laporan yang dibagikan. Hentikan monitoring terkait sebelum mengganti sumber kamera.

### Mendapatkan URL RTSP Hikvision

Siapkan alamat IP kamera atau NVR/DVR, port RTSP, akun perangkat yang memiliki izin live view, serta nomor channel. Akun perangkat berbeda dari akun Visitor Counter atau akun aplikasi Hik-Connect. Nama menu dapat berbeda menurut model dan firmware.

1. Hubungkan komputer dan perangkat ke jaringan yang saling terjangkau. Lihat alamat IP pada pengaturan jaringan kamera/NVR atau daftar perangkat router; bila tidak memiliki akses, minta pengelola kamera memeriksanya.
2. Masuk ke pengaturan perangkat dan periksa port RTSP. Port bawaan umumnya **554**; gunakan port aktual jika pernah diubah.
3. Jika menggunakan kamera IP secara langsung, gunakan IP kamera dan channel 1. Jika melalui NVR/DVR, gunakan IP serta akun NVR/DVR, lalu pilih channel tempat kamera terdaftar.
4. Susun URL menggunakan pola di bawah. Ganti username, password, IP, port, dan nomor stream dengan konfigurasi perangkat sendiri.
5. Uji pada VLC melalui menu pembukaan network stream. Di macOS, biasanya **File → Open Network**; di Windows, **Media → Open Network Stream**. Pastikan gambar muncul dari mesin yang akan memproses kamera.
6. Masukkan URL yang berhasil diuji ke **Kamera → Tambahkan Kamera**, simpan, lalu periksa preview aplikasi.

Pola URL: `rtsp://USERNAME:PASSWORD@IP_PERANGKAT:554/Streaming/Channels/101`

Contoh dengan kredensial dan IP fiktif: `rtsp://operator:ContohPassword123@192.0.2.10:554/Streaming/Channels/101`. Alamat ini hanya contoh dokumentasi, bukan perangkat yang bisa langsung dihubungkan.

| Akhiran URL | Kamera/channel | Jenis stream |
| --- | --- | --- |
| 101 | 1 | Main stream |
| 102 | 1 | Sub stream |
| 201 | 2 pada NVR/DVR | Main stream |
| 202 | 2 pada NVR/DVR | Sub stream |

Nomor stream mengikuti pola **nomor channel × 100 + jenis stream**, dengan 1 untuk main dan 2 untuk sub. Main stream biasanya memberi detail lebih tinggi; sub stream biasanya lebih ringan, tetapi detail wajah dapat berkurang.

Jika username atau password mengandung karakter pemisah URL, lakukan percent-encoding hanya pada bagian kredensial, misalnya `@` menjadi `%40`, `#` menjadi `%23`, dan `%` menjadi `%25`. Jangan membagikan URL yang sudah berisi password asli.

### Jika RTSP Hikvision belum berhasil

| Gejala | Yang perlu diperiksa |
| --- | --- |
| Tidak tersambung atau timeout | IP, port RTSP aktual, rute jaringan, firewall, dan apakah perangkat online. |
| Autentikasi ditolak | Akun perangkat, password, izin live view/channel, dan encoding karakter khusus. |
| Kamera yang tampil tidak sesuai | Nomor channel NVR/DVR; uji 101/102 untuk channel 1 atau 201/202 untuk channel 2. |
| VLC berhasil tetapi aplikasi gagal | Uji dari mesin backend yang sama, periksa sumber tersimpan dan dukungan codec pada instalasi aplikasi. |

Untuk akses dari luar jaringan lokasi, koordinasikan koneksi jaringan dengan pengelola. Alamat IP lokal kamera tidak otomatis bisa dijangkau server web di internet.

Referensi format: [Dokumentasi resmi RTSP Hikvision](https://www.hikvision.com/content/dam/hikvision/ca/bulletin/technical-bulletin/technical-article/tb_rtsp_and_http_urls_120915us.pdf).

![Daftar kamera workspace](screenshots/03-cameras.png)

## 5. Membuat Event

1. Buka **Event** dan pilih **Buat Event**.
2. Isi nama, lokasi, tanggal, rentang waktu, dan kapasitas sesuai kebutuhan.
3. Di bagian **Kamera event**, pilih kamera yang akan digunakan.
4. Atur arah hitung per kamera: masuk, keluar, atau otomatis sesuai kebutuhan pintu dan arah gerak orang.
5. Sesuaikan posisi dan orientasi garis hitung. Gunakan mirror atau pembalikan arah hanya jika sesuai tampilan kamera.
6. Aktifkan **Deteksi gender pengunjung** jika memang diperlukan.
7. Periksa jadwal otomatis bila digunakan, lalu simpan Event.
8. Buka detail Event dan lakukan uji lintasan sebelum digunakan untuk penghitungan operasional.

Uji satu orang melewati garis masuk dan keluar. Bandingkan arah gerak dengan perubahan angka. Hindari garis di area antrean yang membuat orang berkali-kali menyeberang atau area yang tertutup benda.

Pengaturan gender saat ini merupakan deteksi visual pada Event. Aplikasi belum menyediakan aturan “pintu ini khusus perempuan/laki-laki” sebagai pengganti hasil model.

![Daftar Event](screenshots/04-events.png)

![Form pembuatan Event](screenshots/05-create-event.png)

### Pengaturan lanjutan

Mulai dengan nilai bawaan. Detail gambar, interval pemrosesan frame, dan ambang keyakinan memengaruhi beban komputer serta hasil deteksi. Ubah satu parameter setiap kali, lalu bandingkan hasil dengan hitungan manual pada kondisi kamera yang sama. Menambah detail gambar tidak menjamin hasil selalu lebih akurat.

## 6. Monitoring kamera pada Event

1. Buka Event yang benar dari daftar.
2. Periksa kamera, garis hitung, tanggal, serta status kesiapan.
3. Pilih **Mulai** untuk menjalankan monitoring. Pantau status koneksi dan perubahan hitungan.
4. Gunakan kontrol jeda atau berhenti sesuai kebutuhan yang tersedia. Jangan menganggap menutup tab browser otomatis menghentikan layanan monitoring di server.
5. Periksa catatan pengunjung dan statistik setelah pengujian.

Jika kamera terputus, periksa jaringan dan sumber kamera. Tunggu proses sambung ulang; jika status meminta tindakan, hentikan lalu mulai kembali monitoring setelah jaringan pulih.

### Koreksi dan tangkapan tertunda

Jika akun memiliki izin koreksi, gunakan fitur review pengunjung yang tersedia pada detail Event. Periksa waktu, arah lintasan, dan bukti foto sebelum menggabungkan atau mengoreksi identitas. Tangkapan yang belum teridentifikasi tidak selalu berarti lintasannya tidak dihitung; periksa catatan dan indikator yang ditampilkan.

Deteksi gender merupakan perkiraan visual. Wajah yang kecil, gelap, tertutup, atau tampak dari samping dapat menghasilkan kategori belum diketahui atau hasil yang keliru. Aplikasi mengumpulkan bukti dari beberapa pengamatan dan dapat meninjau ulang hasil; ini tidak menjamin ketepatan pada setiap orang.

## 7. Menganalisis rekaman video

1. Buka detail Event tujuan, lalu pilih **Upload Video**.
2. Pilih rekaman dari komputer.
3. Isi **Waktu awal rekaman** sesuai waktu sebenarnya, bukan waktu unggah. Nilai ini menentukan waktu hasil pada Event dan laporan.
4. Periksa opsi analisis, lalu mulai proses dan tunggu sampai selesai.
5. Periksa ringkasan dan hasil Event setelah proses berhasil selesai. Jika dibatalkan atau gagal, jangan menganggap hasil sementara sudah menjadi data final Event.

Batas bawaan yang ditampilkan aplikasi adalah 500 MB dan 30 menit; ikuti batas yang tampil jika konfigurasi server berubah. Video sumber tidak menjadi arsip rekaman permanen melalui fitur analisis ini.

Mengunggah file yang sama sebagai analisis baru dapat menambah hasil lagi. Hindari unggah ulang jika hasil pertama sudah masuk. Identitas hasil analisis video tidak otomatis digabung dengan identitas kamera langsung atau video lainnya.

## 8. Laporan dan ekspor

1. Buka detail Event yang ingin dilaporkan.
2. Periksa periode, zona waktu, status monitoring, dan kelengkapan sinkronisasi.
3. Gunakan aksi laporan atau unduh yang tersedia untuk akun Anda.
4. Buka file hasil unduhan dan periksa nama Event, rentang waktu, serta total sebelum dibagikan.

Akun tanpa izin laporan tidak dapat mengunduh laporan. Jika monitoring masih aktif, angka dapat berubah setelah file diekspor.

### Reset atau hapus Event

Reset menghapus data hasil Event sesuai konfirmasi aplikasi. Hapus Event dan reset bukan cara memperbaiki filter tanggal. Pastikan cadangan atau laporan yang dibutuhkan sudah tersedia sebelum menyetujui **Hapus Data dan Reset**. Penghapusan yang disinkronkan juga dapat memengaruhi salinan di server atau desktop lain.

## 9. Pengguna dan hak akses

Menu **Pengguna** tersedia bagi akun dengan izin pengelolaan pengguna.

1. Buka **Pengguna**, lalu **Tambah pengguna**.
2. Isi nama, email, password awal, peran, dan status aktif.
3. Pilih peran yang sesuai. Jika perlu, aktifkan **Sesuaikan izin per fitur** untuk pengguna selain administrator.
4. Simpan, lalu minta pengguna masuk menggunakan akunnya sendiri.
5. Untuk perubahan, pilih **Ubah** pada pengguna yang benar, sesuaikan peran atau izin, lalu simpan.

| Peran bawaan | Kemampuan utama |
| --- | --- |
| Administrator | Seluruh izin, termasuk pengaturan, sinkronisasi, dan pengguna. |
| Operator | Melihat/mengubah Event, mengontrol monitoring, melihat kamera, laporan, koreksi, analisis video, dan melihat rekaman. |
| Viewer | Membaca Event/statistik, laporan, dan rekaman. |

Operator bawaan tidak otomatis dapat mengubah kamera atau mengelola pengguna. Viewer tidak mengontrol monitoring atau mengubah konfigurasi kamera. Izin khusus dapat mengubah kemampuan peran selain administrator; periksa daftar izin aktual, bukan hanya nama perannya.

Izin **Sinkronisasi seluruh data workspace** memiliki cakupan luas karena proses sinkronisasi dapat membaca, mengubah, dan menghapus data. Berikan kepada pengguna yang memang bertanggung jawab terhadap data workspace.

Perubahan pengguna dan izin tidak direplikasi sebagai bagian data sinkronisasi workspace. Kelola akun pada lingkungan yang digunakan. Pencabutan akses server tidak menghapus data yang sudah tersimpan pada desktop offline.

### Menghapus pengguna

1. Pada daftar **Pengguna**, pilih **Hapus** pada akun yang benar.
2. Periksa nama dan email pada dialog, lalu pilih **Hapus pengguna** untuk mengonfirmasi atau **Batal** untuk membatalkan.
3. Setelah berhasil, akun tidak dapat login dan sesi lamanya tidak dapat dipakai untuk permintaan berikutnya. Event, laporan, dan data workspace tetap tersedia.

Anda tidak dapat menghapus akun sendiri atau pemilik workspace personal. Hanya Admin yang dapat menghapus akun Admin, dan workspace harus tetap memiliki Admin aktif. Jika data akun sudah berubah sejak daftar dimuat, muat ulang daftar sebelum mencoba lagi. Penghapusan bersifat permanen; gunakan status nonaktif jika hanya ingin menonaktifkan sementara.

Penghapusan akun berlaku pada lingkungan tempat tindakan dilakukan. Akun server dan akun pada desktop lain tidak ikut dihapus melalui sinkronisasi database workspace.

![Daftar pengguna](screenshots/06-users.png)

![Form pengguna dan izin per fitur](screenshots/07-user-permissions.png)

## 10. Pengaturan aplikasi

### Sistem Kamera

Buka **Pengaturan → Sistem Kamera**. Atur **Status Mesin AI** dan **Zona waktu global**, lalu pilih **Simpan**. Menonaktifkan mesin AI menonaktifkan semua kamera. Zona waktu dipakai pada jadwal Event, statistik, dan laporan.

![Pengaturan sistem dan zona waktu](screenshots/08-settings.png)

### Profil Saya dan Pengaturan Dashboard

Gunakan **Profil Saya** untuk mengelola profil akun sendiri. Gunakan **Pengaturan Dashboard** untuk nama atau logo tampilan workspace sesuai izin yang tersedia. Periksa hasil perubahan setelah disimpan.

## 11. Sinkronisasi desktop dan server

### Menghubungkan pertama kali

1. Di desktop, buka **Pengaturan → Sinkronisasi**.
2. Masukkan URL API server yang diberikan administrator; contoh format: `https://api.example.com`.
3. Gunakan akun server dengan email dan tipe akun yang sama dengan akun desktop, serta izin sinkronisasi yang sesuai.
4. Isi nama perangkat yang mudah dibedakan dari desktop lain.
5. Hubungkan akun dan tunggu sinkronisasi selesai. Password server tidak perlu dimasukkan setiap kali sinkronisasi normal berjalan.
6. Periksa status, waktu keberhasilan terakhir, jumlah dikirim/diterima, konflik, serta perubahan yang masih tertunda.

### Manual dan otomatis

Pilih **Manual saja** jika sinkronisasi hanya dijalankan melalui **Sinkronkan sekarang**. Pilih **Manual + otomatis** untuk sinkronisasi berkala dan tentukan periode yang tersedia. Simpan perubahan pengaturan. Tombol manual tetap dapat digunakan pada mode otomatis.

Sinkronisasi otomatis berjalan selama aplikasi desktop dan layanan lokalnya berjalan, koneksi tersedia, dan akses server masih valid. Periode bukan jaminan semua data langsung identik; konflik, proses aktif, gangguan jaringan, atau akses kedaluwarsa perlu diselesaikan.

![Sinkronisasi manual dan periodik](screenshots/09-sync.png)

### Alur web → desktop dan desktop → web

1. Perubahan di web tersimpan pada server.
2. Desktop yang terhubung mengirim perubahan lokal dan mengambil perubahan server saat sinkronisasi berjalan.
3. Desktop lain mengambil perubahan pada putaran sinkronisasinya sendiri.
4. Ketika desktop offline, pekerjaan lokal tetap tersimpan. Jalankan sinkronisasi setelah koneksi pulih.
5. Buka atau muat ulang halaman tujuan untuk memeriksa hasil setelah status sinkronisasi selesai.

Tidak perlu membuka web agar desktop mengirim perubahan; server harus dapat dijangkau. Sinkronisasi bukan pemindahan database secara utuh setiap kali tombol ditekan.

### Cakupan dan batas

Disinkronkan: profil, workspace, tampilan dashboard, kamera, pengaturan, Event, sesi, kunjungan, foto terkait, tangkapan tertunda, dan koreksi. Rekaman video serta indeks pengenalan wajah disimpan terpisah dan belum disinkronkan melalui fitur database ini. Karena itu, hasil data yang sama belum menjamin semua perangkat memiliki arsip video atau indeks pengenalan yang sama.

### Konflik dan perubahan tertunda

1. Jika ada konflik, buka **Lihat perbedaan**.
2. Bandingkan versi lokal dengan server dan periksa apakah salah satu versi merupakan penghapusan.
3. Pilih versi yang benar sesuai informasi operasional, kemudian jalankan kembali sinkronisasi bila diminta.
4. Periksa kembali jumlah konflik dan perubahan tertunda sampai selesai.

Konfigurasi tertentu dapat ditunda selama monitoring aktif. Selesaikan monitoring dengan aman, lalu sinkronkan lagi. Jangan memilih versi secara sembarang hanya untuk menghilangkan notifikasi.

### Perangkat dan pencabutan akses

Pada web, halaman Sinkronisasi menampilkan perangkat yang terhubung ke akun. Gunakan **Cabut akses** jika perangkat hilang atau tidak digunakan. Desktop yang aksesnya dicabut harus dihubungkan ulang untuk melanjutkan sinkronisasi. Data lokal yang sudah ada tetap perlu dikelola pada perangkat tersebut.

## 12. Prosedur kerja harian

1. Buka aplikasi, masuk, dan periksa workspace serta tanggal.
2. Jika memakai desktop dengan server, periksa hasil sinkronisasi awal.
3. Periksa jaringan kamera, pilih Event, dan lakukan uji lintasan singkat.
4. Mulai monitoring dan pantau status kamera secara berkala.
5. Review catatan atau koreksi yang diperlukan.
6. Setelah kegiatan selesai, hentikan monitoring dan periksa laporan.
7. Sinkronkan, selesaikan konflik/tertunda, lalu tutup aplikasi.

## 13. Mengatasi masalah

| Gejala | Pemeriksaan dan tindakan |
| --- | --- |
| “Statistik belum dapat dimuat” | Periksa login, workspace, tanggal/Event, dan layanan backend. Di desktop, pastikan aplikasi selesai memulai; offline tetap memerlukan backend lokal. Di web, periksa koneksi server. Setelah penyebab pulih, pilih Coba lagi. |
| “Gagal memuat preview kamera” | Periksa izin akun dan status monitoring terlebih dahulu. Kemudian periksa jaringan kamera, URL sumber, serta keterjangkauan dari mesin pemrosesan. Minta administrator memeriksa respons layanan jika viewer tetap gagal melihat preview. |
| Data web dan desktop berbeda | Pastikan server/workspace benar, lihat sinkronisasi terakhir, konflik, dan perubahan tertunda. Jalankan Sinkronkan sekarang, lalu muat ulang halaman. |
| Sinkronisasi tidak berjalan saat offline | Data lokal tetap tersedia. Pulihkan internet dan periksa akses server; jadwal otomatis tidak dapat menjangkau server tanpa koneksi. |
| Menu hilang atau aksi ditolak | Minta administrator memeriksa izin aktual dan status akun. Masuk kembali bila sesi sudah tidak valid. |
| Angka terlihat berbeda dari hitungan manual | Periksa filter, zona waktu, arti indikator, arah garis, duplikasi analisis video, dan kualitas kamera. Lakukan pengujian lintasan terkontrol sebelum mengubah parameter. |
| Gender belum diketahui/keliru | Periksa sudut, pencahayaan, ukuran wajah, dan penghalang. Gunakan review yang tersedia; jangan menganggap nilai model sebagai data identitas yang pasti. |
| Analisis video gagal | Periksa format yang didukung, ukuran/durasi, waktu awal rekaman, dan kapasitas komputer. Periksa status hasil sebelum mengunggah ulang. |
| Desktop gagal dibuka | Catat versi aplikasi, OS/arsitektur, dan pesan kesalahan. Hubungi pengelola aplikasi; jangan menghapus direktori data sebagai langkah pertama. |

Saat melapor, sertakan versi aplikasi, waktu kejadian, menu/Event terkait, langkah pengulangan, dan pesan kesalahan. Tutupi password, token, URL kamera berkredensial, serta foto pengunjung yang tidak diperlukan.

## 14. Pemeliharaan dan pembaruan

Gunakan installer atau pembaruan resmi dari pengelola aplikasi. Jadwalkan pembaruan setelah monitoring selesai dan data penting dicadangkan. Periksa versi dan pastikan data tetap tersedia setelah membuka aplikasi kembali. Ketersediaan pembaruan otomatis bergantung pada konfigurasi distribusi dan rilis yang digunakan.

Untuk pengelola teknis, petunjuk build Windows tersedia di [panduan build installer](../windows-exe-build.md). Panduan ini menjelaskan penggunaan aplikasi; pemasangan server dan pemulihan cadangan operasional dikelola administrator.
