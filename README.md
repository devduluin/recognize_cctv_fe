This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Desktop — Tauri

The desktop runtime is Tauri 2. FastAPI/PyInstaller and Next.js standalone continue
running as managed local services, with bundled Node.js and media executables.

```sh
npm ci
npm run desktop:assets
npm run desktop:dev
```

Development requires Rust, Tauri CLI, and the backend's locked Python environment.
See [the setup and verification guide](tauri/README.md).

- `npm run desktop:resources`: build platform-specific Python/Next.js resources.
- `npm run desktop:build`: build resources and the native app/installer (macOS APP/DMG, Windows NSIS).
- `npm run desktop:package`: bundle an existing release build without rebuilding Python or Next.js.
- `npm run desktop:test`: test the shared local-service host and Tauri gateway.
- `npm run docs:generate`: generate screenshots/PDF using headless Chrome/Edge.

App bundles include the local runtime resources. macOS output is under
`src-tauri/target/release/bundle/macos` and `bundle/dmg`; Windows output is under
`src-tauri/target/release/bundle/nsis`. Packaging an existing build requires its
resources to be current; otherwise use the full `desktop:build` command.
Signing, verified updates and native video/upgrade tests remain release blockers.
Existing local databases, photos and recordings remain in the original application
profile. Do not delete that profile when switching runtime.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Desktop database synchronization is available in **Pengaturan → Sinkronisasi**.
Deploy the matching backend sync protocol over HTTPS, then connect with the same
account email/type in the desktop app. Sync requires authentication and workspace
authorization; no additional environment flag is needed.
After connecting, background sync runs automatically (30 seconds by default).
Offline changes stay local and retry when the server becomes reachable. Pause or
change the interval in settings; **Sinkronkan sekarang** remains available.
Both desktop and server backends must use sync protocol v4.
This includes workspace operational SQL records and stored photos; video files,
Chroma indexes, login credentials, and device scheduling remain separate.
See [the backend sync guide](../recognize_cctv/docs/database-sync.md) for setup,
conflict handling, retry behavior, and verification limits.

The **Pengguna** menu provides workspace user creation, editing, role presets,
custom feature permissions, and account activation. Run the matching backend's
Alembic migrations before deploying the web UI; desktop startup migrates its
SQLite schema with a backup. See [user management](../recognize_cctv/docs/user-management.md)
for setup, security behavior, and verification limits.

Deteksi Video tersedia melalui **Event → Detail Event → Upload Video**. Masukkan
waktu awal rekaman agar statistik per jam sesuai. Hasil yang selesai tersimpan
pada laporan event; menu Deteksi Video terpisah kini mengarah ke daftar event.
Identitas video terpisah dari kamera langsung/video lain; upload ulang file yang
sama dapat menambah hitungan lagi. Backend dan frontend perlu dibangun ulang.
Tidak ada environment variable baru untuk perubahan ini.

Pada Pengaturan → Sinkronisasi database, setelah server terhubung, pilih
**Manual saja** atau **Manual + otomatis**. Periode otomatis tersedia dari
15 detik sampai 1 jam (15/30 detik, 1/5/10/15/30 menit, atau 1 jam). Tombol
**Sinkronkan sekarang** tersedia pada kedua mode. Periode dihitung setelah
proses sebelumnya selesai; percobaan ulang saat offline memakai jeda bertahap.
Pilihan mode/periode tersimpan lokal dan tidak membutuhkan environment variable baru.


Sync v3 menampilkan rincian perbedaan yang aman dan riwayat proses. Web menampilkan
perangkat milik akun beserta aksi cabut akses; desktop menyediakan mode manual dan
periodik. Token akses diperbarui otomatis selama kredensial perangkat 90 hari masih
berlaku. Perubahan email setelah pengikatan tidak memutus workspace. Server perlu
migrasi `alembic upgrade head` dan backend/frontend desktop harus dibangun ulang.
File video dan indeks wajah serta akun/permission tetap di luar sync operasional.

Panduan lengkap penggunaan aplikasi: [Manual Visitor Counter](docs/manual/README.md).
Untuk menghasilkan HTML, PDF, dan screenshot UI dengan data contoh, lihat [petunjuk dokumentasi](docs/manual/capture.md) atau jalankan workflow **Application Manual**.
