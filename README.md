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
architecture. On macOS/Linux, set the locked backend Python path like this.
In Windows PowerShell, use
`$env:DESKTOP_PYTHON = (Resolve-Path ..\recognize_cctv\desktop\.venv\Scripts\python.exe).Path`.

```bash
nvm use 24.14.0
export DESKTOP_PYTHON="$(cd ../recognize_cctv && pwd)/desktop/.venv/bin/python"

# Optional: verify which accelerator the backend environment can use.
"$DESKTOP_PYTHON" -c 'import torch; print("CUDA:", torch.cuda.is_available()); print("MPS:", torch.backends.mps.is_available())'

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
or jump and may be less accurate when caches are cold; 100% appears only after
every stage finishes. This command already includes clean, so no separate
clean step is needed:

```bash
npm run desktop:rebuild
```

The selected build must run on its target OS because PyInstaller creates a
platform-specific FastAPI backend. The command checks the OS and architecture
before cleaning anything, and stops with guidance if the selected target is
not supported on the current machine. macOS uses the machine's current
architecture (Apple Silicon arm64 or Intel x64); Windows supports x64; Linux
builds should run on Ubuntu 24.04 x64 and produce AppImage and `.deb` installers.
For example, choose macOS on a Mac, Windows on Windows x64, or Linux on Ubuntu
24.04 x64. You can skip the prompt by passing a target explicitly, for example
`npm run desktop:rebuild -- --mac --arm64` or `npm run desktop:rebuild -- --win --x64`.
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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
