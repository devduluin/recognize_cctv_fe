'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DesktopRuntime } = require('../desktop/runtime.cjs');
const { AuthSessionStore, restoreSession } = require('../desktop/auth-session.cjs');
const { checkCameraNetwork } = require('../desktop/camera-network.cjs');
const { createGateway, sessionEncryption } = require('./gateway.cjs');
const { resolveBackendPython } = require('../scripts/desktop/python-path.cjs');

async function main() {
  const root = path.resolve(__dirname, '..');
  const development = process.argv.includes('--development');
  const userData = process.env.VISITOR_TAURI_DATA;
  if (!userData || !path.isAbsolute(userData)) throw new Error('Application data directory is missing.');
  const backendRoot = path.resolve(process.env.DESKTOP_BACKEND_ROOT || path.join(root, '../recognize_cctv'));
  const runtime = new DesktopRuntime({ resources: path.join(root, 'resources'), userData,
    version: require('../package.json').version, development, frontendRoot: root, backendRoot,
    python: development ? resolveBackendPython(backendRoot, process.env.DESKTOP_PYTHON) : undefined,
    node: process.execPath });
  const store = new AuthSessionStore(runtime.paths.data, sessionEncryption(process.env.VISITOR_TAURI_KEY));
  store.file = path.join(runtime.paths.data, 'tauri-auth-session.enc');
  delete process.env.VISITOR_TAURI_KEY;
  let gateway, closing = false;
  const stage = value => process.stdout.write(JSON.stringify({ stage: value }) + '\n');
  runtime.on('startup-stage', stage);
  const startup = runtime.start();
  async function stop(code) {
    if (closing) return;
    closing = true;
    runtime.stopping = true;
    await startup.catch(() => {});
    if (gateway) await gateway.close();
    await runtime.stop();
    process.exit(code);
  }
  runtime.on('failure', () => { console.error('Local service stopped; inspect application logs.'); void stop(1); });
  process.stdin.setEncoding('utf8');
  let input = '';
  process.stdin.on('data', part => { input += part; if (input.includes('\n')) void stop(0); });
  process.stdin.on('end', () => void stop(0));
  process.on('SIGTERM', () => void stop(0));
  process.on('SIGINT', () => void stop(0));
  try {
    await startup;
    if (closing) return;
    stage('session');
    await restoreSession(store, runtime);
    stage('interface');
    gateway = await createGateway({ runtime, authStore: store,
      checkCamera: (source, session) => checkCameraNetwork(source, { runtime, token: session?.token }) });
    if (closing) { await gateway.close(); return; }
    // This private pipe is consumed by Rust; never log the URL/token to disk.
    process.stdout.write(JSON.stringify({ ready: gateway.bootstrapUrl }) + '\n');
  } catch (error) {
    fs.appendFileSync(path.join(runtime.paths.logs, 'tauri-host.log'), `${new Date().toISOString()} ${error.message}\n`);
    console.error('Tauri services failed to start. Inspect tauri-host.log.');
    await stop(1);
  }
}
if (require.main === module) main().catch(() => { console.error('Tauri host initialization failed.'); process.exitCode = 1; });
