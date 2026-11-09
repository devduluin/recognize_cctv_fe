# Windows desktop build

The desktop runtime is Tauri 2. Build on Windows x64 because the Python backend is
packaged for the host platform. Prepare Rust/MSVC/WebView2, frontend dependencies,
and the locked Python environment as described in [the Tauri guide](../tauri/README.md).

Run `npm run desktop:build` from the frontend root to build the backend, Next.js
runtime, and Windows MSI installer in one step. The MSI is written to
`src-tauri/target/release/bundle/msi/`.

### Split cabinets

The Windows payload (mainly CUDA PyTorch, about 6.4 GB uncompressed) exceeds the
~2 GiB limit of a single WiX cabinet and of an MSI with embedded cabinets; the
default Tauri template fails in `light.exe` with `LGHT0001 ... CreateCabFinish`.
`src-tauri/wix/main.wxs` is the default `tauri-bundler` 2.10.4 template with one
change: `MediaTemplate` writes external cabinets `app1.cab`, `app2.cab`, ... of at
most ~1 GiB uncompressed each. `scripts/tauri/run.cjs` moves them from
`src-tauri/target/release/wix/x64/` to `bundle/msi/` after build or package.

Distribute the `.msi` together with every `app*.cab` file in the same folder (for
example as one ZIP). The MSI cannot install without its cabinets. When upgrading
Tauri, compare the custom template with the new `tauri-bundler` template.

### Release assets

The **Desktop release** workflow runs `node scripts/tauri/release.cjs collect`, which
reads the MSI `Media` table and fails unless `bundle/msi/` holds exactly the cabinets
the MSI references (no missing or stale `app*.cab`). It publishes, as separate
GitHub release assets (each must stay under the 2 GiB asset limit):

- `VisitorCounter_<version>_windows-x86_64.msi` (renamed; the MSI looks up cabinets
  by name in its own folder, so the cabinets keep their `app<N>.cab` names);
- every `app<N>.cab`;
- `VisitorCounter_<version>_windows-x86_64.SHA256SUMS.txt`, re-checked by the publish
  job after the artifact transfer.

The draft release notes tell users to download the MSI and all cabinets into one
folder. A single ZIP is not used because the payload (about 3.7 GB) exceeds 2 GiB.

### Updates on Windows

Decision: Windows builds ship **without** the Tauri updater, and `latest.json` lists
only the macOS packages. `scripts/tauri/run.cjs` ignores `DESKTOP_UPDATER_PUBKEY` on
Windows, so there is no tray "Periksa pembaruan" item and no `.msi.sig`. Signature
verification is unchanged for macOS. To update Windows, quit Visitor Counter from the
tray and install the newer MSI (with its cabinets) over the old one; the template's
`MajorUpgrade` replaces the previous version and the profile in `%APPDATA%` is kept.

Why: `tauri-plugin-updater` 2.14 downloads one signed URL into memory and installs
it. A plain `.msi` fails without its cabinets (error 1311). A ZIP holding the MSI and
cabinets would work technically (the plugin extracts the whole ZIP and runs the MSI
from that folder) but is about 3.7 GB: above the GitHub 2 GiB asset limit and held
entirely in RAM during the update. Options considered for later:

- Signed ZIP on storage without the 2 GiB limit (S3/R2) via a separate Windows
  endpoint: smallest change, but needs about 4 GB free RAM plus temp disk at update time.
- WiX Burn bootstrapper with remote payloads: small signed updater artifact that
  downloads and hash-checks the MSI and cabinets; needs a Burn bundle and NSIS-style
  argument handling to be tested.
- A smaller Windows payload (e.g. CPU/DirectML instead of CUDA) that fits one file again.

Run `npm run desktop:package` to repackage existing release resources without
rebuilding the backend or frontend. Before either command, quit Visitor Counter
from its system tray menu; closing the window only hides it and leaves processes
running that can lock the executable and resources.

Build on Windows x64. The MSI has been generated successfully locally; installation
on a clean machine still needs verification before production distribution. Use
**Tauri native validation** for manual CI validation. The workflow does not publish
releases or distribute the unbundled executable as an installer.
