# Login, register, dan onboarding

Ketiga halaman memakai tampilan navy/putih yang mengikuti dashboard. Panel pengantar desktop menjelaskan fungsi kamera, event, dan statistik; mobile menampilkan merek dan form secara ringkas. Nama produk menggunakan `defaultDashboardProfile` yang sudah ada.

Komponen bersama berada di `components/auth/auth-ui.tsx`: `AuthShell`, `AuthField`, `AuthSubmit`, `AuthAlert`, dan `AccountChoice`. Field memiliki hubungan label/input, petunjuk password, toggle visibilitas, serta state disabled. Onboarding menggunakan radio native, indikator tahap Akun/Workspace, dan field perusahaan kondisional. Komponen yang sama juga memperbarui tampilan pemulihan password.

`auth-api.ts` menyatukan penanganan respons dan penyimpanan sesi. Akun yang sudah selesai setup langsung masuk dashboard; akun yang belum selesai diarahkan ke onboarding. Pergantian akun membersihkan sesi dan cache branding. Endpoint backend tidak berubah.

## Verifikasi

- Build Webpack dan ESLint seluruh berkas autentikasi yang diubah lulus.
- Browser production: 24 tampilan pada lebar 1.440, 768, 375, dan 320px, mencakup login, register, onboarding personal/perusahaan, forgot-password, dan reset-password. Tidak ada overflow horizontal atau error JavaScript.
- Uji interaksi: tampil/sembunyikan password; login gagal, loading, dan sukses; pendaftaran; onboarding personal/perusahaan; payload perusahaan; radio dengan ArrowDown; pengalihan akun selesai setup; keluar untuk menggunakan akun lain; penjagaan onboarding tanpa sesi.
- Pembesaran teks 200% pada login mobile 375px tidak menghasilkan overflow.
- Screenshot login desktop dan onboarding perusahaan mobile diperiksa secara visual. Screenshot pengujian berada di `/private/tmp/ml-auth-new`, tidak menjadi aset aplikasi.
- Request browser memakai fixture, sehingga tes tidak membuat akun atau perusahaan sungguhan.
- Pemeriksaan TypeScript penuh tidak lagi melaporkan error pada reset-password; error lama pada halaman monitoring CCTV masih ada.

## Delivery Gate antislop

- PASS, Hard Gate: label dan state dapat dikenali, alur form diuji, tautan menggunakan route yang ada, mobile tidak overflow. Tidak menambahkan logo ilustrasi, statistik, testimoni, atau klaim keamanan. Merek memakai inisial komponen yang sudah tersedia.
- PASS, kontras: teks sekunder `#607596` di putih 4,69:1; teks panel `#cbd8f0` di navy 8,84:1; teks pilihan akun `#52647f` di latar terpilih 5,46:1; border kontrol `#7b8ba3` di putih 3,46:1 memenuhi batas nonteks 3:1. Fokus input dan radio terlihat; keyboard diuji.
- PASS, Purpose: navy menyambungkan autentikasi dengan dashboard; panel pengantar hanya hadir saat ruang desktop cukup. Ikon kamera, kalender, pengunjung, akun, dan perusahaan menjelaskan fungsi masing-masing.
- PASS, Liveliness: ENERGY 1 / RHYTHM 2 / MOTION 1; judul dan tombol submit menjadi fokus form, whitespace memisahkan label dan alur, warna aksen berasal dari identitas dashboard. Tidak ada animasi dekoratif; spinner hanya saat request berjalan.
- PASS, Craftsmanship: layout dan kontrol Tailwind reusable, ukuran sentuh minimal 44px untuk tombol, form perusahaan muncul sesuai pilihan, dan state loading/error ditampilkan sebagai teks.
