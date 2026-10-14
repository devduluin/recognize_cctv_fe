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

To rebuild the installer after changing the frontend or backend, run from this
repository on the target Mac. Apple Silicon builds use `arm64`; Intel Macs use
`x64`:

```bash
nvm use 24.14.0
export DESKTOP_PYTHON="$(cd ../recognize_cctv && pwd)/desktop/.venv/bin/python"

# Optional: verify which accelerator the backend environment can use.
"$DESKTOP_PYTHON" -c 'import torch; print("CUDA:", torch.cuda.is_available()); print("MPS:", torch.backends.mps.is_available())'

npm run desktop:build
npm run desktop:package -- --mac --arm64
node scripts/desktop/packaged-smoke.cjs
```

The installer and app archive are written to `dist-desktop/`. Replace
`--arm64` with `--x64` when building on an Intel Mac. The build bundles the
local sibling backend source, so backend changes are included. Inference
selects CUDA, Apple MPS, or CPU based on what the installed runtime reports;
if MPS reports unavailable, the app uses CPU. Windows installers must be built
on Windows x64 or through the Windows GitHub Actions job.

Every `npm run desktop:build` prints and embeds the SemVer from `package.json`
plus a newly randomized six-digit build number. Both appear in Pengaturan →
Sistem Kamera → Tentang aplikasi. The build number identifies that particular
build; it does not replace or increment the release version.

For a clean rebuild, remove the generated app/build outputs, then run the build
commands above again:

```bash
rm -rf .next resources dist-desktop ../recognize_cctv/desktop/build
npm run desktop:build
npm run desktop:package -- --mac --arm64
```

This keeps `desktop-cache/` (verified Node.js and MediaMTX downloads) and the
backend Python environment so they can be reused. The installed application's
SQLite database and other user data live separately under macOS Application
Support and are not part of these build folders. To remove only old installers,
delete `dist-desktop/` before packaging.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
