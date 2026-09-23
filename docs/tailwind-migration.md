# Verifikasi migrasi Tailwind

## Lingkup

Styling dashboard yang sebelumnya memakai selector khusus di `app/globals.css` dipindahkan ke utility Tailwind v4 dan komponen dalam `components/ui`. File global berkurang dari 1.064 menjadi 52 baris, berisi tema dan aturan dasar aksesibilitas. Tidak ada class CSS lama yang masih dipakai oleh halaman.

Halaman yang diperbarui: dashboard, daftar event, daftar kamera, detail/monitor pengunjung, pengaturan sistem, pengaturan profil/dashboard, sidebar, modal, rangkuman, dan preview kamera. Autentikasi dan monitoring CCTV lama sudah memakai Tailwind dan tetap menggunakan komponennya yang ada. API, state form, dan logika backend tidak diubah.

Panduan komponen: [components/ui/README.md](../components/ui/README.md).

## Tampilan dan perilaku

Arah visual tetap mengikuti UI-Figma dan implementasi sebelum migrasi: dashboard administrasi CCTV, ENERGY 1 / RHYTHM 2 / MOTION 1. Ukuran, warna, radius, bayangan, font Arial, serta breakpoint lama dipertahankan. Tinggi baris teks disamakan secara eksplisit karena default utility Tailwind berbeda dari CSS sebelumnya.

- 22 screenshot sebelum/sesudah mencakup delapan halaman dan tiga modal pada lebar 1.440 dan 375px. Semua dimensi halaman tetap sama. Selisih piksel berada di rentang 0–1,5% dengan ambang selisih kanal warna 20/255; pembanding awal memakai development, hasil akhir memakai production sehingga indikator development juga dihitung sebagai perbedaan. Ini bukan klaim kesamaan piksel mutlak.
- Posisi dan ukuran judul halaman utama cocok dengan pembanding. Perbedaan terukur tersisa pada posisi judul modal event desktop sebesar 0,5px dan halaman latar saat modal rangkuman terbuka sebesar 8px.
- Tidak ada overflow horizontal halaman pada pengujian tersebut, termasuk 18 pemeriksaan tambahan pada lebar 600, 700, 768, 900, 1.024, dan 1.200px.
- Scroll Rincian Per Jam tetap independen dan dapat dioperasikan lewat keyboard.
- Uji browser memeriksa pencarian, sort, submit/edit event, submit kamera, modal test kamera, switch lewat Space, unggah/simpan/muat ulang logo, fullscreen, navigasi mobile, dan Escape untuk menutup modal. Tidak ada error JavaScript.

Data dan respons API dalam pengujian browser menggunakan fixture. Pengujian tidak menulis ke akun nyata atau menguji perangkat kamera fisik.

## Pemeriksaan kode

- PASS: `npm run build -- --webpack`, 16 route berhasil dibangun.
- PASS: ESLint semua berkas yang diubah dan seluruh `components/ui` tanpa error atau warning.
- PASS: `git diff --check`.
- `tsc --noEmit` masih melaporkan error yang sudah ada di `app/recognize_cctv/page.tsx` (63) dan `app/reset-password/page.tsx` (1); tidak ada error pada berkas migrasi. Build mengikuti konfigurasi proyek yang sudah melewati pemeriksaan tipe.

## Delivery Gate antislop

- PASS, Hard Gate: tidak menambah aset, klaim, angka produk, navigasi, atau tema; hasil visual mengikuti pembanding. Label, disabled/loading/error state, fokus modal, Escape, keyboard switch/scroll, dan ukuran mobile dipertahankan dan diuji sesuai cakupan di atas.
- PASS, Purpose: warna navy, bayangan panel, radius, ikon, serta aksen grafik berasal dari tampilan pengguna yang sudah ada. Tidak ada dekorasi atau animasi baru.
- PASS, Liveliness: hierarki judul/filter, metrik, grafik, dan rincian tetap sama. Dials dan identitas visual mengikuti referensi yang sudah disetujui.
- PASS, Craftsmanship: utility dibagi ke komponen bertipe dengan props native; variasi tombol eksplisit, token warna terpusat, tanpa ketergantungan baru. Build production dan pembandingan browser memverifikasi implementasi.

Screenshot dan harness sementara berada di `/private/tmp/ml-tailwind-*`, tidak ditambahkan sebagai aset aplikasi.
