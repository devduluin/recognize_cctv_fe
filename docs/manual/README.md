# Panduan Penggunaan Visitor Counter

Panduan untuk administrator, operator, dan pembaca laporan. Nama tombol mengikuti kode aplikasi saat panduan ini dibuat. Menu yang tersedia mengikuti izin akun Anda. Screenshot dalam paket dokumentasi menggunakan data contoh, bukan data operasional.

**Status gambar:** file sumber panduan tidak menyertakan screenshot yang belum diambil. Jalankan workflow **Application Manual** untuk mendapatkan panduan HTML, screenshot PNG dari UI aplikasi, serta PDF. Petunjuk ada di [pemeliharaan panduan](capture.md).

## 1. Mulai menggunakan aplikasi

### Desktop Windows dan macOS

1. Pasang aplikasi dari installer yang diberikan administrator. Di macOS, gunakan paket yang sesuai dengan Apple Silicon atau Intel.
2. Buka Visitor Counter dan tunggu proses persiapan selesai. Layanan lokal berjalan bersama aplikasi; Anda tidak perlu menjalankan Python atau Node.js sendiri.
3. Masuk menggunakan akun desktop. Jika belum punya akun, gunakan pendaftaran yang tersedia atau minta akun kepada administrator workspace.
4. Pastikan workspace benar sebelum membuat Event atau menghubungkan sinkronisasi.
5. Menutup jendela tidak menghentikan aplikasi: monitoring kamera tetap berjalan di latar belakang. Buka kembali melalui ikon Visitor Counter di menu bar (macOS) atau system tray (Windows), atau klik ikon di Dock pada macOS.
6. Untuk selesai bekerja, hentikan monitoring yang sedang berjalan lalu pilih **Keluar** dari ikon menu bar/system tray, atau tekan ⌘Q di macOS.

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

### Penempatan kamera di gerbang

Penempatan kamera menentukan akurasi lebih dari pengaturan apa pun. Setiap orang perlu terlihat utuh, wajahnya cukup besar, dan gambarnya tajam saat melewati garis hitung. Jika kamera terlalu rendah atau terlalu dekat, badan terpotong dan wajah buram, sehingga orang yang sama mudah tercatat sebagai pengunjung baru.

| Ukuran | Acuan | Alasan |
| --- | --- | --- |
| Tinggi kamera dari lantai | 2,5 – 3,5 m | Di atas kepala, sehingga orang di belakang tidak tertutup orang di depannya. |
| Sudut menunduk | 15° – 30° | Wajah tetap terlihat dari depan dan badan tidak terpotong. |
| Jarak kamera ke garis hitung | 4 – 6 m | Orang tampak utuh beberapa langkah sebelum garis. Lensa 4 mm cocok untuk jarak ini; lensa 2,8 mm sekitar 3 – 4 m. |
| Tinggi orang di gambar saat di garis | 40 – 60 % | Kepala sampai kaki masuk bingkai. Lebih dari 70 % berarti terlalu dekat. |
| Lebar wajah di gambar 1280 px | minimal 80 px | Cukup detail untuk pengenalan wajah setelah gambar diperkecil untuk deteksi. |
| Kecepatan rana (shutter) | 1/250 s atau lebih cepat | Menghilangkan blur pada orang yang berjalan cepat. Tambah cahaya bila gambar menjadi gelap. |
| Posisi garis hitung di gambar | 30 – 70 % | Jauh dari tepi bingkai, tegak lurus arah jalan, dengan mode dua garis. |

![Tampak samping: posisi sekarang dibanding posisi yang disarankan](diagrams/gerbang-samping.svg)

![Denah gerbang: kamera masuk di dalam area menghadap orang yang datang](diagrams/gerbang-denah.svg)

![Tampilan di layar kamera: orang utuh di zona hitung, jauh dari tepi bingkai](diagrams/gerbang-layar.svg)

Langkah pemasangan:

1. Pasang kamera di dinding atau tiang di dalam area, setinggi 2,5 – 3,5 m, menghadap gerbang.
2. Arahkan kamera menunduk 15° – 30° sampai lantai di gerbang berada di tengah bawah gambar.
3. Di menu kamera, set shutter 1/250 s. Aktifkan WDR bila gerbang membelakangi cahaya terang.
4. Di aplikasi, buka Edit Event, aktifkan **Gunakan 2 Garis & Crossing Zone**, atur garis horizontal di 50 – 70 %, dan pilih peran kamera **Masuk**.
5. Minta 2 – 3 orang berjalan masuk dengan langkah normal dan cepat. Periksa foto capture: badan utuh, wajah tajam, dan tidak ada yang tercatat ganda.

| Hindari | Akibatnya |
| --- | --- |
| Kamera setinggi kepala atau kurang dari 3 m dari garis hitung | Badan terpotong, wajah buram, dan potongan tubuh di tepi gambar tercatat sebagai pengunjung. |
| Garis hitung di dekat tepi gambar atau sejajar arah jalan | Orang belum terlihat utuh saat melintas, atau lintasan tidak terbaca. |
| Menghadap pintu kaca atau langit terang tanpa WDR | Wajah gelap dan sulit dikenali. |
| Antrean yang berdiri tepat di garis hitung | Gerakan kecil orang yang berdiri dapat terbaca sebagai lintasan. Pindahkan garis ke area orang berjalan. |
| Satu kamera untuk masuk dan keluar sekaligus | Wajah hanya terlihat dari satu arah. Gunakan kamera kedua yang menghadap arah sebaliknya, atau pisahkan jalur keluar. |

Angka di atas adalah titik awal, bukan jaminan. Lensa, tinggi plafon, dan lebar gerbang berbeda di setiap lokasi; sesuaikan dengan preview di aplikasi dan uji jalan sebelum event dimulai.

## 5. Membuat Event

1. Buka **Event** dan pilih **Buat Event**.
2. Isi nama, lokasi, tanggal, rentang waktu, dan kapasitas sesuai kebutuhan.
3. Di bagian **Kamera event**, pilih kamera yang akan digunakan.
4. Pilih **Metode pengukuran** per kamera: **Akumulasi keluar/masuk** untuk kamera di pintu, atau **Keramaian** untuk kamera yang mengamati area venue. Lihat bagian **Mengukur keramaian** di bab 6.
5. Untuk kamera akumulasi, atur **Peran kamera**: masuk, keluar, atau otomatis sesuai kebutuhan pintu dan arah gerak orang.
6. Sesuaikan posisi dan orientasi garis hitung. Gunakan mirror atau pembalikan arah hanya jika sesuai tampilan kamera.
7. Aktifkan **Deteksi gender pengunjung** jika gender diperlukan, lalu atur **Gender kamera** per kamera: otomatis (AI), laki-laki, atau perempuan. Lihat bagian **Gender per kamera** di bab 6.
8. Periksa jadwal otomatis bila digunakan, lalu simpan Event.
9. Buka detail Event dan lakukan uji lintasan sebelum digunakan untuk penghitungan operasional.

Uji satu orang melewati garis masuk dan keluar. Bandingkan arah gerak dengan perubahan angka. Hindari garis di area antrean yang membuat orang berkali-kali menyeberang atau area yang tertutup benda.

Satu Event dapat menggabungkan beberapa jenis kamera, misalnya kamera pintu masuk dengan **Akumulasi keluar/masuk** dan kamera venue dengan **Keramaian**, atau dua pintu terpisah dengan **Gender kamera** laki-laki dan perempuan.

Untuk Event beberapa hari dengan jadwal otomatis, monitoring dimulai pada jam mulai dan berhenti pada jam selesai setiap hari selama rentang tanggal Event. Sesi hari sebelumnya yang sudah selesai tidak menghalangi hari berikutnya. Jika monitoring dihentikan manual di tengah jadwal hari itu, aplikasi tidak memulainya lagi sampai jadwal hari berikutnya.

![Daftar Event](screenshots/04-events.png)

![Form pembuatan Event](screenshots/05-create-event.png)

### Pengaturan lanjutan

Mulai dengan nilai bawaan. Detail gambar, interval pemrosesan frame, dan ambang keyakinan memengaruhi beban komputer serta hasil deteksi. Ubah satu parameter setiap kali, lalu bandingkan hasil dengan hitungan manual pada kondisi kamera yang sama. Menambah detail gambar tidak menjamin hasil selalu lebih akurat.

Hanya nilai yang Anda ubah yang disimpan pada Event; nilai lain mengikuti rekomendasi aplikasi, termasuk bila rekomendasi diperbarui pada versi berikutnya. Jika pengenalan wajah memakai ArcFace, **Ketelitian mengenali orang yang sama** dinonaktifkan karena ArcFace memakai ambang dari paket modelnya sendiri; formulir menampilkan ambang yang berlaku.

## 6. Monitoring kamera pada Event

1. Buka Event yang benar dari daftar.
2. Periksa kamera, garis hitung, tanggal, serta status kesiapan.
3. Pilih **Mulai** untuk menjalankan monitoring. Pantau status koneksi dan perubahan hitungan.
4. Gunakan kontrol jeda atau berhenti sesuai kebutuhan yang tersedia. Jangan menganggap menutup tab browser otomatis menghentikan layanan monitoring di server.
5. Periksa catatan pengunjung dan statistik setelah pengujian.

Jika kamera terputus, periksa jaringan dan sumber kamera. Tunggu proses sambung ulang; jika masih tersangkut, pilih **Restart kamera** pada kontrol sesi. Aksi ini menghentikan koneksi lama dan memulai ulang seluruh kamera event di latar belakang, sambil melanjutkan sesi yang sama dan mempertahankan data hitungan. Pemantauan terjeda selama restart. Tombol tersedia bagi akun dengan izin kontrol monitoring. Jika restart gagal, periksa pesan status sebelum mencoba lagi; jangan memakai Reset Event karena tindakan itu menghapus data event.

### Gender per kamera

Aktifkan **Deteksi gender pengunjung** pada aturan penghitungan Event terlebih dahulu; setelah itu pengaturan kamera menampilkan **Gender kamera**: **Otomatis (AI)**, **Laki-laki**, atau **Perempuan**. Jika deteksi gender dimatikan, pilihan ini disembunyikan dan tidak dipakai, tetapi tetap tersimpan untuk saat deteksi gender diaktifkan kembali. Pilih Laki-laki atau Perempuan untuk pintu atau area khusus, misalnya pintu masuk pria dan wanita yang terpisah. Semua orang yang dihitung kamera itu dicatat dengan gender tersebut tanpa model AI, dan perkiraan AI dari kamera lain tidak mengubahnya. **Otomatis (AI)** memperkirakan gender dari wajah atau tubuh. Pengaturan ini tidak berlaku untuk kamera **Keramaian**.

### Mengukur keramaian

Edit Event, buka pengaturan kamera, lalu pilih **Metode pengukuran → Keramaian**. Atur batas kiri, atas, kanan, dan bawah dalam persen sambil memeriksa preview. Pada mode ini, orang dihitung berdasarkan titik tengah tubuh yang terlihat di dalam area, tanpa syarat garis, identitas, atau gender. Total masuk/keluar tidak ditambah oleh kamera **Keramaian**.

Panel **Keramaian** menampilkan jumlah orang yang terlihat per kamera, terpisah dari panel **Akumulasi Keluar/Masuk**. Satu event dapat memakai keduanya, misalnya kamera pintu masuk dengan **Akumulasi keluar/masuk** dan kamera venue dengan **Keramaian**. Untuk menghitung seluruh gambar, atur zona 0–100%. Angka ini dapat naik atau turun dan bukan total tiket maupun pengunjung unik. Kamera berbeda tidak dijumlahkan karena pandangannya dapat tumpang tindih. Jika data belum tersedia atau frame terlalu lama, aplikasi menampilkan status tidak tersedia, bukan angka nol.

**AI FPS** menunjukkan jumlah pemeriksaan AI yang selesai, berbeda dari kelancaran video. Di Pengaturan Lanjutan tersedia **Preset gerbang ramai** untuk setiap gambar dan target 20 pemeriksaan/detik. Target tidak menjamin perangkat mampu mencapainya. Mode **Keramaian** tetap dapat melewatkan orang yang tertutup penuh, terlalu kecil, atau blur; uji terhadap hitungan manual sebelum digunakan operasional.

Angka **Keramaian** saat ini hanya ditampilkan secara langsung; riwayatnya belum disimpan dan belum masuk laporan.

### Pengunjung baru vs kembali

Di bawah statistik per jam pada detail Event, panel **Pengunjung Baru vs Kembali** menampilkan per tanggal berapa pengunjung yang baru pertama kali datang dan berapa yang kembali dari hari sebelumnya dalam Event yang sama. Ini berguna untuk Event beberapa hari, misalnya pameran tiga hari.

Pengunjung yang kembali dikenali dari wajah atau badan yang sama dengan hari sebelumnya, sehingga hasilnya mengikuti kualitas pencocokan identitas. Kunjungan ulang tidak menambah jumlah **Visitor unik**. Pencocokan hanya berlaku di dalam satu Event; pengunjung tidak dicocokkan antar Event yang berbeda. Hari dihitung menurut zona waktu workspace. Jika retensi data sudah menghapus data wajah sebuah Event, pengunjung lama tidak lagi dapat dikenali bila Event itu dijalankan kembali.

### Heatmap pengunjung

Panel **Heatmap Pengunjung** pada detail Event menunjukkan di bagian mana dalam pandangan setiap kamera pengunjung paling lama berada, dan ke arah mana mereka biasanya bergerak.

1. Pilih **Kamera** yang ingin dilihat.
2. Pilih **Hari** tertentu atau **Seluruh event**.
3. Baca warna: biru berarti singkat atau jarang dilalui, merah berarti paling lama orang berada di area itu. Panah putih menunjukkan arah gerak dominan.

Gunakan heatmap untuk menentukan area booth atau sponsor yang paling ramai, area yang jarang didatangi, titik penumpukan di dekat pintu, dan penempatan papan petunjuk. **Total kehadiran terekam** adalah jumlah waktu kehadiran seluruh orang yang terlihat, bukan jumlah orang.

Heatmap hanya mencakup area yang terlihat kamera dan mengikuti sudut pandang kamera, bukan denah lantai. Setiap kamera mempunyai heatmap sendiri. Gambar latar diambil dari kamera saat monitoring dimulai; jika **Simpan foto pengunjung** dimatikan, heatmap tetap tersedia tanpa gambar latar. Data heatmap disimpan per 15 menit, sehingga data beberapa menit terakhir monitoring yang masih berjalan dapat belum tampil.

### Koreksi dan tangkapan tertunda

Pencocokan identitas berjalan otomatis melalui wajah dan seluruh badan; penggabungan pengunjung secara manual tidak tersedia. **Riwayat koreksi** pada Capture Pengunjung tetap menampilkan penggabungan lama dan dapat membatalkannya. Lintasan yang belum memiliki bukti identitas, misalnya hanya kepala yang terlihat di tepi gambar pada kamera yang biasanya mendeteksi badan orang, tidak langsung dicatat sebagai pengunjung baru dan ditampilkan sebagai **Lintasan belum terhitung**. Kamera dari atas yang hanya melihat kepala tetap menghitung dari kepala. Tangkapan yang belum teridentifikasi tidak selalu berarti lintasannya tidak dihitung; periksa catatan dan indikator yang ditampilkan.

Deteksi gender merupakan perkiraan visual. Wajah yang kecil, gelap, tertutup, atau tampak dari samping dapat menghasilkan kategori belum diketahui atau hasil yang keliru. Aplikasi mengumpulkan bukti dari beberapa pengamatan dan dapat meninjau ulang hasil; ini tidak menjamin ketepatan pada setiap orang.

Gender yang belum diketahui saat pengunjung tercatat tetap dapat terisi kemudian, ketika orang yang sama terlihat lagi dengan wajah yang jelas di kamera event tersebut; catatan dan statistiknya ikut diperbarui. Untuk orang yang jarang menghadap kamera, aktifkan **Perkirakan dari badan bila wajah tidak terlihat** di bawah **Deteksi gender pengunjung** pada Edit Event. Perkiraan dari badan hanya dipakai bila keyakinannya minimal 85%, tetapi lebih mudah keliru daripada perkiraan dari wajah. Setelah mengaktifkannya, periksa beberapa capture dan matikan kembali bila banyak yang salah. Perubahan berlaku setelah monitoring dihentikan lalu dimulai lagi.

## 7. Menganalisis rekaman video

1. Buka detail Event tujuan, lalu pilih **Upload Video**.
2. Pilih rekaman dari komputer.
3. Isi **Waktu awal rekaman** sesuai waktu sebenarnya, bukan waktu unggah. Nilai ini menentukan waktu hasil pada Event dan laporan.
4. Periksa opsi analisis, lalu mulai proses dan tunggu sampai selesai.
5. Periksa ringkasan dan hasil Event setelah proses berhasil selesai. Jika dibatalkan atau gagal, jangan menganggap hasil sementara sudah menjadi data final Event.

Batas bawaan yang ditampilkan aplikasi adalah 500 MB dan 30 menit; ikuti batas yang tampil jika konfigurasi server berubah. Video sumber tidak menjadi arsip rekaman permanen melalui fitur analisis ini.

Hasil analisis juga menambah heatmap Event sebagai kamera tersendiri bernama **Video: nama file**. Jika **Simpan foto pengunjung** dimatikan, preview frame selama proses analisis dan foto capture tidak ditampilkan.

Mengunggah file yang sama sebagai analisis baru dapat menambah hasil lagi. Hindari unggah ulang jika hasil pertama sudah masuk. Identitas hasil analisis video tidak otomatis digabung dengan identitas kamera langsung atau video lainnya.

## 8. Laporan dan ekspor

1. Buka detail Event yang ingin dilaporkan.
2. Periksa periode, zona waktu, status monitoring, dan kelengkapan sinkronisasi.
3. Gunakan aksi laporan atau unduh yang tersedia untuk akun Anda.
4. Buka file hasil unduhan dan periksa nama Event, rentang waktu, serta total sebelum dibagikan.

Isi laporan menurut format:

| Format | Isi |
| --- | --- |
| PDF | Ringkasan pengunjung, distribusi gender, distribusi per jam, **Pengunjung Baru vs Kembali per Hari**, **Heatmap Pengunjung** per kamera, dan sesi monitoring. |
| Excel | Sheet **Aktivitas**, **Harian** (baru vs kembali per tanggal), dan **Heatmap** (gambar per kamera). |
| CSV | Tabel aktivitas saja. |

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

Dua pengaturan privasi berlaku untuk seluruh workspace:

- **Simpan foto pengunjung.** Matikan agar aplikasi hanya menyimpan angka. Foto capture pengunjung, foto tangkapan tertunda, preview analisis video, dan gambar latar heatmap tidak disimpan. Pencocokan wajah selama Event tetap berjalan sehingga visitor unik dan pengunjung kembali tetap dihitung. Perubahan berlaku setelah monitoring dihentikan lalu dimulai lagi, dan tidak menghapus foto yang sudah tersimpan.
- **Retensi foto dan data wajah.** Pilih 7 hari sampai 1 tahun, atau **Simpan selamanya**. Foto, data wajah dan badan, serta gambar latar heatmap yang lebih lama dari periode tersebut dihapus otomatis, diperiksa sekitar setiap jam. Data wajah sebuah Event dihapus setelah Event itu tidak aktif selama periode retensi. Jumlah pengunjung, catatan kunjungan, statistik, heatmap, dan laporan tetap tersimpan. Setelah data wajah dihapus, pembatalan penggabungan lama hanya mengembalikan catatan, dan pengunjung lama tidak dikenali lagi.

Data ini termasuk data pribadi. Tentukan periode retensi sesuai kebijakan privasi organisasi dan ketentuan perlindungan data pribadi yang berlaku. Salinan cadangan database desktop di folder **backups** tidak ikut dibersihkan oleh retensi.

![Pengaturan sistem dan zona waktu](screenshots/08-settings.png)

### Profil Saya dan Pengaturan Dashboard

Gunakan **Profil Saya** untuk mengelola profil akun sendiri. Gunakan **Pengaturan Dashboard** untuk nama atau logo tampilan workspace sesuai izin yang tersedia. Periksa hasil perubahan setelah disimpan.

## 11. Sinkronisasi desktop dan server

### Menghubungkan pertama kali

1. Di desktop, buka **Pengaturan → Sinkronisasi**.
2. Pilih **API backend** dan masukkan URL server, misalnya `https://api.example.com`, atau pilih **PostgreSQL langsung** seperti petunjuk di bawah.
3. Gunakan akun server dengan email dan tipe akun yang sama dengan akun desktop, serta izin sinkronisasi yang sesuai.
4. Isi nama perangkat yang mudah dibedakan dari desktop lain.
5. Hubungkan akun dan tunggu sinkronisasi selesai. Password server tidak perlu dimasukkan setiap kali sinkronisasi normal berjalan.
6. Periksa status, waktu keberhasilan terakhir, jumlah dikirim/diterima, konflik, serta perubahan yang masih tertunda.

### PostgreSQL langsung tanpa backend web

Pilih **PostgreSQL langsung**, lalu isi host, port, nama database, username/password database, serta schema yang diberikan administrator. Email dan password akun aplikasi tetap diperlukan untuk memverifikasi akses workspace; akun aplikasi berbeda dari akun database. Kredensial database disimpan terenkripsi pada desktop; password akun aplikasi tidak disimpan.

Jika PostgreSQL Docker berjalan pada komputer yang sama, gunakan `127.0.0.1` dan port host yang dipublikasikan. Jika pada komputer lain, gunakan IP atau DNS komputer Docker. Host selain localhost memerlukan TLS dan sertifikat server valid; masukkan lokasi file CA pada komputer desktop jika diperlukan. Skema database harus sudah dimigrasikan oleh administrator.

Backend web tidak harus aktif untuk mode ini. PostgreSQL harus berjalan dan dapat dijangkau; desktop tetap menyimpan pekerjaan lokal ketika offline. Jika backend web sedang hidup, upload perubahan/penghapusan data lama dapat ditunda untuk melindungi proses monitoring server. Download dan penambahan record baru tetap mengikuti perlindungan monitoring yang berlaku.

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

Disinkronkan: profil, workspace, tampilan dashboard, kamera, pengaturan (termasuk pengaturan foto dan retensi), Event, sesi, kunjungan, foto terkait, tangkapan tertunda, koreksi, heatmap, dan gambar latar heatmap. Penghapusan foto oleh retensi juga disinkronkan. Desktop dan server harus memakai versi aplikasi yang sama; versi yang berbeda ditolak sebelum data dikirim. Rekaman video serta indeks pengenalan wajah disimpan terpisah dan belum disinkronkan melalui fitur database ini. Karena itu, hasil data yang sama belum menjamin semua perangkat memiliki arsip video atau indeks pengenalan yang sama.

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
6. Setelah kegiatan selesai, hentikan monitoring dan periksa laporan, termasuk heatmap dan pengunjung kembali untuk Event beberapa hari.
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
| Gender kamera khusus tercatat keliru | Periksa **Gender kamera** pada pengaturan kamera Event. Orang yang salah masuk pintu khusus tetap dicatat dengan gender kamera tersebut; kamera bergender tetap yang mencatat paling akhir yang berlaku. |
| Heatmap kosong | Pastikan monitoring sudah berjalan beberapa menit dan orang terlihat di kamera tersebut. Pilih **Seluruh event** atau tanggal yang benar. Event yang dibuat sebelum fitur heatmap tidak mempunyai data heatmap untuk sesi lama. |
| Heatmap tanpa gambar latar | **Simpan foto pengunjung** sedang nonaktif, retensi sudah menghapus gambar latar, atau monitoring belum pernah dimulai dengan versi ini. Warna dan panah tetap dapat dibaca. |
| Event beberapa hari tidak mulai otomatis | Periksa **jadwal otomatis**, tanggal mulai/selesai, jam operasional, dan **Status Mesin AI**. Jika monitoring dihentikan manual hari ini, aplikasi baru memulai lagi pada jadwal hari berikutnya. |
| Analisis video gagal | Periksa format yang didukung, ukuran/durasi, waktu awal rekaman, dan kapasitas komputer. Periksa status hasil sebelum mengunggah ulang. |
| Desktop gagal dibuka | Catat versi aplikasi, OS/arsitektur, dan pesan kesalahan. Hubungi pengelola aplikasi; jangan menghapus direktori data sebagai langkah pertama. |

Saat melapor, sertakan versi aplikasi, waktu kejadian, menu/Event terkait, langkah pengulangan, dan pesan kesalahan. Tutupi password, token, URL kamera berkredensial, serta foto pengunjung yang tidak diperlukan.

## 14. Pemeliharaan dan pembaruan

Gunakan installer atau pembaruan resmi dari pengelola aplikasi. Jadwalkan pembaruan setelah monitoring selesai dan data penting dicadangkan. Periksa versi dan pastikan data tetap tersedia setelah membuka aplikasi kembali. Ketersediaan pembaruan otomatis bergantung pada konfigurasi distribusi dan rilis yang digunakan.

Untuk pengelola teknis, petunjuk build Windows tersedia di [panduan build installer](../windows-exe-build.md). Panduan ini menjelaskan penggunaan aplikasi; pemasangan server dan pemulihan cadangan operasional dikelola administrator.
