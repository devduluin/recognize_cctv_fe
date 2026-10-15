# Desktop implementation plan

The workspace has two independent repositories. `recognize_cctv_fe` coordinates Electron packaging, and its root package.json supplies the sole desktop version. `recognize_cctv` remains the backend repository. CI checks out the backend commit recorded in desktop.config.json. Update that commit after merging backend desktop changes; source tokens remain CI-only.

Existing FastAPI entry: main.py, Uvicorn, SQLAlchemy/PostgreSQL, JWT authentication, camera inference, MediaMTX, FFmpeg, Chroma. Existing Next.js entry: app/layout.tsx, App Router, React client screens and standalone Node server. There are no existing Next API Route or Server Action implementations to migrate. The desktop build keeps server rendering and adds a streaming API proxy using runtime loopback ports. Web deployments retain their configured upstream.

Stages:
1. Desktop backend entry, private data paths, explicit SQLite baseline migration, per-launch service authorization. Validate schema persistence, login, tenant boundaries and loopback access.
2. Electron process supervisor, standalone Next routing, Node runtime, streaming tools. Validate startup, crashes, shutdown, SSR, API forwarding and a real Server Action.
3. Native PyInstaller onedir builds with models/native libraries and native platform locks. Validate the frozen executable, then NSIS and macOS DMG/ZIP packaging.
4. Version-matched GitHub release builds, signatures/notarization, updater prompts/progress/postponement. Validate update metadata and require all three platform jobs to pass before publishing.

Focused changes: backend desktop_backend.py, app/desktop/*, desktop packaging/locks, database desktop branch and asset paths; frontend electron/*, scripts/desktop/*, desktop.config.json, electron-builder.cjs, proxy.ts, API/static proxy routes, desktop-health, Next configuration, package manifests, tests, workflow, release documentation.

Risks: TensorFlow 2.20 and recent PyTorch do not supply macOS Intel wheels; Intel uses platform-specific pinned versions and must pass the same counting tests. Historic PostgreSQL Alembic migrations are not portable; desktop uses an explicit versioned SQLite baseline, and refuses schema drift rather than silently changing a user's database. Installer size/native model packaging, Windows subprocess termination, signed macOS subprocess libraries, camera/recording permissions, changing localhost ports and Server Actions are validation gates. Private GitHub repositories need public release distribution or an authenticated service; never embed a repository token in an installer.

No Windows installer, macOS updater, signing or notarization claim is valid until the respective platform tests have actually run. Packaging and production release validation are separate from development builds.
