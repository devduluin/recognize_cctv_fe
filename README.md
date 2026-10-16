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

## Build the desktop installer

Desktop builds use the backend in the sibling `recognize_cctv` directory. Use
Node.js 24.14.0 and the backend's locked Python environment. On a fresh checkout,
prepare those dependencies and the verified models once:

```bash
nvm install 24.14.0
nvm use 24.14.0
npm ci

cd ../recognize_cctv
python3 -m pip install uv==0.9.5
uv sync --project desktop --locked
desktop/.venv/bin/python tools/prepare_models.py --models-dir models
desktop/.venv/bin/python -c 'from keras_facenet import FaceNet; FaceNet()'
cd ../recognize_cctv_fe
```

To build after changing the frontend or backend, run on the target OS and
architecture. The build automatically finds the locked Python environment at
`../recognize_cctv/desktop/.venv`. Set `DESKTOP_PYTHON` only if that environment
is stored somewhere else. Create the environment first on a fresh checkout as
shown above.

```bash
nvm use 24.14.0
BACKEND_PYTHON="$(cd ../recognize_cctv && pwd)/desktop/.venv/bin/python"

# Optional: verify which accelerator the backend environment can use.
"$BACKEND_PYTHON" -c 'import torch; print("CUDA:", torch.cuda.is_available()); print("MPS:", torch.backends.mps.is_available())'

npm run desktop:clean
npm run desktop:build
npm run desktop:package -- --mac --arm64
```

Replace the package target with `--mac --x64` on Intel Mac, `--win --x64` on
Windows x64, or `--linux --x64` on Ubuntu 24.04 x64. Linux creates AppImage and
`.deb` installers. The installer and app archive are written to
`dist-desktop/`. The build bundles the local sibling backend source, so backend
changes are included. Inference selects CUDA, Apple MPS, or CPU based on what
the installed runtime reports; if MPS reports unavailable, the app uses CPU.

Every `npm run desktop:build` prints and embeds the SemVer from `package.json`
plus a newly randomized six-digit build number. Both appear in Pengaturan →
Sistem Kamera → Tentang aplikasi. The build number identifies that particular
build; it does not replace or increment the release version.

For a one-command clean build and installer, run `npm run desktop:rebuild`.
Without arguments, it shows a numbered menu: `1` for macOS, `2` for Windows,
and `3` for Linux. After you choose, it cleans generated outputs, rebuilds the
backend and Next.js app, and packages the installer. During quiet parts of a
build or macOS signing, the command shows a spinner with an estimated overall
percentage and current stage; detailed tool logs still appear as they are
produced. It also shows an estimated remaining time for the current stage.
Both percentage and remaining time are time-based estimates, so they can pause
or jump and may be less accurate when caches are cold. If a stage takes longer
than estimated, the display reports how long the estimate has been exceeded;
100% appears only after every stage finishes. This command already includes
clean, so no separate clean step is needed:

```bash
npm run desktop:rebuild
```

The selected build must run on its target OS because PyInstaller creates a
platform-specific FastAPI backend. The command checks the OS and architecture
before cleaning anything, and stops with guidance if the selected target is
not supported on the current machine. For another OS, commit and push the
changes and run the `Desktop native builds` workflow from GitHub Actions; its
manual workflow currently builds the full platform matrix. macOS uses the machine's current
architecture (Apple Silicon arm64 or Intel x64); Windows supports x64; Linux
builds should run on Ubuntu 24.04 x64 and produce AppImage and `.deb` installers.
For example, choose macOS on a Mac, Windows on Windows x64, or Linux on Ubuntu
24.04 x64. You can skip the prompt by passing a target explicitly, for example
`npm run desktop:rebuild -- --mac --arm64` or `npm run desktop:rebuild -- --win --x64`.
After choosing macOS or Windows, the menu asks whether to sign the build.
Choose signed only when the matching signing certificate and credentials are
available; the build is configured to fail instead of silently producing an
unsigned installer. Choose unsigned for local development. Linux packages do
not use this code-signing selection. In a non-interactive terminal the command
defaults to unsigned. Official GitHub Release builds retain their required
signing and notarization checks independently of this local build choice.
Locally signed development builds skip Apple's per-file timestamp service to
avoid network delays; do not use these artifacts as official releases.
The separate
`desktop:build` and `desktop:package` commands remain available when you only
need one build stage. `desktop:clean` removes `.next/`, `resources/`,
`dist-desktop/`, and the backend PyInstaller work directory. It keeps
`desktop-cache/` (verified Node.js and MediaMTX downloads) and the backend
Python environment for reuse. Installed app data, including the SQLite
database, is stored separately under the operating system's application data
directory and is unaffected.

On macOS, local packaging may spend time signing the large bundled application.
For a development build, disable automatic signing-identity discovery:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:package -- --mac --arm64
```

This packages already-built resources. To clean, rebuild, and package in one
command, use `CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:rebuild -- --mac --arm64`.
Official releases must use the configured signing certificate and notarization;
do not disable signing for release builds.

If macOS signing reports `invalid destination for symbolic link in bundle`,
retry with `npm run desktop:package -- --mac --arm64` after applying the packaging
fix. Public assets such as `public/samples` are copied as actual files, including
when reusing previously staged resources. Other absolute, escaping, or broken
resource symlinks fail validation before signing with their offending path.
No additional environment variables are required.

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
Both desktop and server backends must use sync protocol v3.
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
