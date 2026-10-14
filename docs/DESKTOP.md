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

Build separately on each native platform. desktop:build expects DESKTOP_PYTHON, verifies/provisions model checksums, packages FastAPI in PyInstaller onedir, builds Next standalone, copies static/public files and bundles a separately downloaded Node runtime. It copies FFmpeg from the locked imageio-ffmpeg wheel. Node/MediaMTX archive checksums are committed in desktop-assets.lock.json. To intentionally update them, change desktop.config.json and run `node scripts/desktop/prepare.cjs --lock-assets`, then review the checksum diff. Build resources and caches are ignored by Git.

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

The workflow validates updater SHA-512 metadata, merges both macOS file lists, includes Linux AppImage update metadata, generates SHA256SUMS.txt and publishes a draft only after all platform builds pass, then makes it public. Keep release assets/metadata together. Downloads/installations use electron-updater's platform mechanisms; Python and Next are not updated independently. Users can postpone download or installation. Main-process menus provide manual update checks and installation.

## Validation status

Unit tests do not prove installation or updating works. Before official release, record successful native frozen-backend/model tests, packaged SSR/API/Server Action/login tests, clean Windows and Linux installations, macOS launch on both architectures, signature/notarization checks and real N-to-N+1 updates preserving user data on supported updater platforms. Verify failure/offline recovery. Production readiness must not be claimed until all gates pass.
