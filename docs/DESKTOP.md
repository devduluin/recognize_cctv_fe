# Desktop development and releases

The desktop coordinator is this repository. The backend stays in sibling `recognize_cctv`, or the path specified by `DESKTOP_BACKEND_ROOT`. Read `DESKTOP-PLAN.md` for architecture and compatibility choices. Existing Docker/web deployments remain available.

The authoritative desktop version is root package.json. Keep it at MAJOR.MINOR.PATCH. Do not bump it for ordinary development. Each `desktop:build` also generates a random six-digit build number shown with the version under Settings → System Camera → About Application. The build number is recorded in the packaged manifest and is not the release version. Each release needs a CHANGELOG entry and docs/releases/VERSION.md. Update desktop.config.json's immutable backendRef after committing the backend desktop implementation. CI refuses a backend checkout without desktop_backend.py. Developer checkout files may differ from the committed reference; local packaging includes the local files, while release CI always checks out the explicit reference.

## Development

Install Node 24.14.0 and Python 3.12.15 for development only. End users use bundled runtimes.

```sh
npm ci
node scripts/desktop/prepare.cjs
cd ../recognize_cctv
python -m pip install uv==0.9.5
uv sync --project desktop --locked
desktop/.venv/bin/python tools/prepare_models.py --models-dir models
desktop/.venv/bin/python -c 'from keras_facenet import FaceNet; FaceNet()'
cd ../recognize_cctv_fe
npm run desktop:dev
```

Set DESKTOP_PYTHON to the absolute locked environment interpreter (Windows: desktop/.venv/Scripts/python.exe; macOS: desktop/.venv/bin/python). The dev command otherwise resolves the existing Pipenv interpreter. Set DESKTOP_NODE to an absolute Node executable only when launching Electron directly; the dev script passes its Node executable. Development starts Next in dev mode with hot reload and FastAPI from source. Restart Electron after Python changes; backend reload is deliberately disabled to retain a single camera runtime owner.

## Native packaging

```sh
npm run desktop:build
npm run desktop:package
node scripts/desktop/packaged-smoke.cjs
```

Build separately on each native platform. desktop:build expects DESKTOP_PYTHON, verifies/provisions model checksums, packages FastAPI in PyInstaller onedir, builds Next standalone, copies static/public files and bundles a separately downloaded Node runtime. It copies FFmpeg from the locked imageio-ffmpeg wheel. The backend uses direct YOLO detection and doesn't call Ultralytics tracking, so PyInstaller excludes optional tracker modules that otherwise try to install `lap` through pip during analysis; `YOLO_AUTOINSTALL=false` also prevents runtime package installation. If tracking is added later, declare and lock its dependencies in `desktop/pyproject.toml` before including those modules. Node/MediaMTX archive checksums are committed in desktop-assets.lock.json. To intentionally update them, change desktop.config.json and run `node scripts/desktop/prepare.cjs --lock-assets`, then review the checksum diff. Build resources and caches are ignored by Git.

Windows output: NSIS .exe for x64. macOS output: .app, .dmg and .zip for the native arm64 or x64 architecture. Linux x64 output: AppImage and `.deb`; AppImage is used for automatic updates. ZIP is required for macOS updater metadata. Build on the matching native OS and architecture. Linux builds are validated on Ubuntu 24.04 and currently target x64 with glibc-based distributions; AppImage systems need FUSE 2 or a compatible FUSE runtime. The build runs a frozen-backend model self-test before building Next. Development packages are not official signed releases, and do not check updates automatically.

## Persistent data

Electron uses app.getPath('userData') with a stable Visitor Counter name. Its `data/` directory holds visitor.sqlite, the generated jwt-secret, settings, vectors, captures/uploads, recordings, logs and backups. Next standalone is copied to versioned `next-runtime/` directories so caches never write into a read-only signed installation. Installers replace application resources and retain this data. NSIS also retains app data on uninstall.

If startup reports that the frontend stopped and `data/logs/frontend.log` says `Cannot find module 'next'`, quit the app and remove only the cached runtime for the installed version: `rm -rf "$HOME/Library/Application Support/Visitor Counter/next-runtime/0.1.0"` on macOS. Reopen the app to copy its bundled Next.js runtime again. This cache is separate from `data/`, so the SQLite database and user files remain intact. Current builds validate the standalone dependencies and Next build ID, then repair a stale same-version cache automatically.

Desktop SQLite migration 1 initializes the current model schema. Startup validates its stored schema fingerprint and version. Schema changes require a new explicit migration; mismatches create a SQLite online backup and refuse startup. Existing PostgreSQL Alembic migrations remain the server deployment path. Do not point desktop storage at the production PostgreSQL database or copy an unversioned database into the desktop data directory.

Optional private `data/desktop.env` supports existing inference/SMTP configuration. Desktop startup forces security-sensitive fields and persistent paths; do not put production database credentials in it. JWT secrets remain in data/jwt-secret, never the installer. Existing RabbitMQ integration requires a configured broker; it is not replaced with a local mock. Mail/password-reset delivery requires SMTP configuration as before. Models and the verified FaceNet cache are bundled; do not require runtime model downloads.

Desktop environment contract (internal, never NEXT_PUBLIC): DESKTOP_MODE, APP_DATA_DIR, APP_RESOURCE_DIR, FACENET_CACHE_DIR, DESKTOP_FRONTEND_ORIGIN, DESKTOP_BACKEND_ORIGIN, DESKTOP_SERVICE_TOKEN and DESKTOP_WINDOW_TOKEN. Electron generates service/window tokens per launch. `DESKTOP_BUILD=true` disables web upstream rewrites for the standalone desktop build. Public backend URL is empty so browser requests stay on the local frontend. Existing JWT and tenant access are retained behind the service capability. Both application servers and MediaMTX listeners bind loopback.

## CI and official releases

Run Desktop native builds manually for development packages, optionally supplying a backend commit SHA. Official releases use a `desktop-vVERSION` tag that must match package.json. All native jobs must succeed before release assembly.

Configure protected `desktop-production` GitHub environments and secrets. DESKTOP_SOURCE_TOKEN is required to read a private backend repository. DESKTOP_RELEASE_TOKEN is required if publishing to a separate release repository. Neither token is shipped in the client. Set desktop.config.json releaseOwner/releaseRepository to a public GitHub Releases feed; the publication job refuses a private feed. An authenticated distribution service is required for a private feed and is not simulated by embedding a GitHub token.

For signing, provide WINDOWS_CSC_LINK and WINDOWS_CSC_KEY_PASSWORD plus MACOS_CSC_LINK and MACOS_CSC_KEY_PASSWORD. Windows certificate publisher must match windowsPublisherName in desktop.config.json. macOS needs a Developer ID Application certificate plus APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID for notarization. Production packaging requires signing and macOS notarization; it never disables platform signature verification.

The Windows unsigned option removes inherited `CSC_*` / `WIN_CSC_*` signing variables from the packaging child process; certificate links must not be set to empty strings because electron-builder interprets them as a file path. macOS always requires certificate signing because its launcher UUID adjustment invalidates Electron's original signature; skipping signing causes `CODESIGNING: Invalid Page` at launch. A local Apple Development certificate is sufficient for development testing; official releases require Developer ID signing and notarization. To retry only packaging an already built macOS development bundle, run `DESKTOP_REQUIRE_SIGNING=true CSC_IDENTITY_AUTO_DISCOVERY=true npm run desktop:package -- --mac`. This does not rebuild backend or frontend resources.

The workflow validates updater SHA-512 metadata, merges both macOS file lists, includes Linux AppImage update metadata, generates SHA256SUMS.txt and publishes a draft only after all platform builds pass, then makes it public. Keep release assets/metadata together. Downloads/installations use electron-updater's platform mechanisms; Python and Next are not updated independently. Users can postpone download or installation. Main-process menus provide manual update checks and installation.

## Validation status

Unit tests do not prove installation or updating works. Before official release, record successful native frozen-backend/model tests, packaged SSR/API/Server Action/login tests, clean Windows and Linux installations, macOS launch on both architectures, signature/notarization checks and real N-to-N+1 updates preserving user data on supported updater platforms. Verify failure/offline recovery. Production readiness must not be claimed until all gates pass.

### Sesi login setelah restart

Desktop menyimpan token login dan profil sesi dalam `data/auth-session.enc` di direktori userData, menggunakan [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) dengan penyimpanan kunci OS. Password tidak disimpan. Sesi tidak bergantung pada port layanan lokal yang berubah setiap startup. Tidak ada variabel environment baru.

Sebelum membuka jendela, aplikasi memeriksa token melalui `/api/v1/auth/me` pada backend lokal dan menggunakan profil/izin terbaru. Token kedaluwarsa, akun nonaktif/dihapus, atau sesi dicabut memerlukan login lagi. Kegagalan layanan sementara tidak menghapus token tersimpan. Tombol Keluar dan ganti akun menghapus sesi terenkripsi dan sesi halaman. Jika penyimpanan terenkripsi OS tidak tersedia, aplikasi tidak memakai fallback plaintext.

Setelah memasang versi yang berisi perbaikan ini, login sekali agar sesi baru tersimpan. Installer perlu dibangun ulang. Akun web tetap memakai perilaku sesi yang sudah ada; autentikasi lokal desktop tidak ikut dihapus hanya karena akses sinkronisasi server dicabut. Uji packaged smoke sekarang memeriksa sesi yang pulih sebelum login pada startup kedua. Pengujian unit memakai enkripsi uji; Keychain/DPAPI asli dan UI packaged tetap perlu diverifikasi pada OS target.


### RTSP berhasil di Terminal tetapi gagal di aplikasi macOS

Periksa `data/logs/mediamtx.log`. Jika ada `dial tcp <IP>:554: connect: no route to host`, MediaMTX belum menerima video dari kamera; perpindahan WebRTC ke HLS tidak memperbaiki koneksi sumber. Tes `nc` dari Terminal hanya membuktikan akses proses Terminal.

Buka **System Settings → Privacy & Security → Local Network**, aktifkan **Visitor Counter** jika tercantum, lalu tutup dan buka kembali aplikasi. Jika aplikasi belum tercantum, build dan pasang ulang paket yang menyertakan `NSLocalNetworkUsageDescription`; setujui permintaan jaringan lokal saat menguji kamera. Gunakan identitas signing yang konsisten antar build. Jangan mengedit Info.plist aplikasi terpasang karena dapat membatalkan tanda tangan.

Menurut [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy), akses jaringan helper dihitung sebagai akses aplikasi yang menjalankannya. Konfigurasi packaging macOS kini menyertakan penjelasan izin jaringan lokal. Perubahan ini mendeklarasikan kebutuhan akses; izin tetap diberikan pengguna melalui macOS. Jika sudah diizinkan tetapi log tetap sama, periksa jaringan/VPN/filter aplikasi dan apakah aplikasi yang dibuka merupakan salinan installer terbaru. Tidak ada perubahan pada URL kamera atau penonaktifan keamanan jaringan.

### Clean uninstall macOS

Tutup Visitor Counter dengan **Command+Q**, lalu gunakan script dari root repository frontend:

```sh
# Preview tanpa perubahan
zsh scripts/desktop/uninstall-macos.command --purge-data --dry-run

# Hapus aplikasi dan seluruh data lokal aktif (database, akun, rekaman, sesi, cache)
zsh scripts/desktop/uninstall-macos.command --purge-data

# Alternatif: uninstall aplikasi/cache dengan mempertahankan data dan sesi
zsh scripts/desktop/uninstall-macos.command --keep-data
```

Pilih hanya satu mode. Script menolak berjalan selama proses aplikasi terpasang masih aktif dan memverifikasi bundle ID sebelum memindahkan aplikasi. Semua target dipindahkan ke subfolder khusus Trash, sehingga dapat dipulihkan sampai pengguna mengosongkannya. Jika izin file menolak pemindahan, script melaporkan kegagalan dan tidak mengklaim uninstall selesai. Tidak menggunakan sudo atau menghapus berkas konfigurasi jaringan bersama. Source code, artifact build, data server, item Keychain OS, dan daftar Local Network tidak diubah. Script tidak dapat dijalankan oleh agent dalam sandbox karena target berada di luar direktori workspace; pengguna menjalankannya sendiri melalui Terminal.

Izin browser Electron dan izin Local Network macOS merupakan dua lapisan berbeda. Handler desktop mengizinkan `local-network`, `local-network-access`, dan `loopback-network` hanya untuk frame utama pada origin frontend lokal aktif, selain izin media/fullscreen yang sudah ada. Origin lain, port lain, dan iframe tetap ditolak. Perubahan ini tidak memberikan izin OS kepada MediaMTX dan tidak mengubah pengaturan macOS. Penolakan helper dengan `no route to host` tetap perlu ditelusuri terpisah. Definisi izin diverifikasi terhadap `electron.d.ts` dari versi Electron yang terpasang.

### MediaMTX berhenti karena port terpakai

Jika `mediamtx.log` mencatat `bind: address already in use`, startup MediaMTX gagal membuka salah satu listener lokal. Pemilihan port media kini mengecualikan port frontend/backend dan semua port percobaan sebelumnya. Runtime mencoba ulang maksimal tiga kali khusus untuk kegagalan bind tersebut, sebelum layanan lain diluncurkan. Error konfigurasi atau executable tetap langsung dilaporkan; proses yang berhenti setelah sehat tetap memicu notifikasi kegagalan layanan. Tidak ada perubahan environment atau migrasi data. Perubahan runtime masuk melalui packaging Electron ulang; jangan menghentikan proses lain yang memakai port tersebut secara sembarang.

### Kamera bekerja dari Terminal tetapi gagal dari Finder

Untuk Test Kamera pada macOS, aplikasi kini memeriksa koneksi TCP RTSP dari proses utama Visitor Counter sebelum meminta preview MediaMTX. Ini merupakan pemeriksaan sumber kamera yang diminta pengguna, agar macOS dapat mengatribusikan permintaan LAN ke aplikasi utama. Jika sistem menampilkan permintaan akses jaringan lokal, pengguna perlu menyetujuinya dan mengulangi Test Kamera. Deklarasi Info.plist saja tidak otomatis memberikan izin.

Bridge `desktopCameraNetwork.check` dibatasi ke frame utama pada origin aplikasi aktif, membutuhkan token sesi dan izin `cameras.read` yang diverifikasi ulang ke backend. Pemeriksaan socket hanya berlaku untuk alamat IPv4 privat/link-local literal dengan skema RTSP/RTSPS. Sumber DNS, IPv6, loopback, dan alamat publik tetap memakai jalur backend yang sudah ada. Tidak mengirim username/password ke kamera pada pemeriksaan TCP dan tidak mencatat URL berkredensial. Kegagalan menampilkan pesan jaringan yang dapat ditindaklanjuti sebelum beralih ke pemutar. Windows/Linux dan web mempertahankan jalur pengujian sebelumnya. Tidak ada environment baru.

Perubahan ini memerlukan build frontend desktop dan packaging ulang. Pengujian otomatis memverifikasi validasi IPC/sumber, izin pengguna, timeout, dan penutupan socket dengan mock; dialog izin OS serta keberhasilan playback saat dibuka dari Finder perlu diuji di Mac target. Jika akses masih ditolak meskipun izin sudah diberikan, periksa identitas/tanda tangan aplikasi dan filter jaringan macOS; jangan mereset konfigurasi jaringan seluruh aplikasi.
# Identitas macOS dan akses kamera jaringan lokal

Jika aplikasi dapat mengakses kamera saat dijalankan dari Terminal tetapi gagal
dari Finder, periksa juga identitas executable. Electron bawaan dapat membawa
Mach-O `LC_UUID` yang sama pada aplikasi berbeda; macOS kemudian dapat mencatat
Visitor Counter sebagai `com.github.Electron`, sekalipun bundle ID dan signature
benar. Referensi: https://github.com/electron-userland/electron-builder/issues/10297.

Hook `scripts/desktop/verify-package.cjs` menjalankan `macos-identity.cjs` pada
launcher utama dan helper di staging macOS sebelum signing. UUID diturunkan dari
app ID, jalur launcher, dan arsitektur, sehingga stabil serta berbeda dari Electron
bawaan. Electron Framework tidak diubah. UUID launcher yang berubah tidak lagi
cocok dengan dSYM launcher Electron bawaan; dSYM framework tetap sesuai.
Windows tidak terpengaruh. Tidak ada variabel lingkungan tambahan.

Untuk memasukkan perbaikan ini ke installer dengan resources yang sudah siap:
`npm run desktop:package -- --mac`. Tutup aplikasi lama, pasang hasil baru ke
Applications, lalu jalankan dari Finder dan izinkan Local Network bila diminta.
Jangan mengubah executable aplikasi yang sudah ditandatangani secara manual.
Tes binary dan unit tidak menggantikan verifikasi akses kamera dari Finder pada
macOS pengguna; izin dan cache identitas sistem tetap perlu diuji setelah instalasi.

