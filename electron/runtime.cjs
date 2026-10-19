const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { EventEmitter } = require('node:events');
const { acquireProfile } = require('./profile-lock.cjs');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

async function mediaPorts(excluded, allocate = freePort) {
  const used = new Set(excluded);
  const ports = [];
  for (let attempt = 0; ports.length < 5 && attempt < 100; attempt++) {
    const port = await allocate();
    if (!used.has(port)) { used.add(port); ports.push(port); }
  }
  if (ports.length !== 5) throw new Error('Cannot allocate distinct media ports.');
  return ports;
}

function persistentPaths(userData) {
  const data = path.join(userData, 'data');
  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  for (const directory of ['logs', 'recordings', 'video_uploads', 'vector_db', 'backups']) fs.mkdirSync(path.join(data, directory), { recursive: true, mode: 0o700 });
  const secret = path.join(data, 'jwt-secret');
  if (!fs.existsSync(secret)) fs.writeFileSync(secret, randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  if (fs.readFileSync(secret, 'utf8').trim().length < 32) throw new Error('The local JWT secret is invalid. Restore it from your backup.');
  return { data, logs: path.join(data, 'logs'), secret };
}

function ensureNextRuntime(sourceDirectory, nextDirectory) {
  const buildIdFile = path.join('.next', 'BUILD_ID');
  const sourceBuildId = path.join(sourceDirectory, buildIdFile);
  const expectedBuildId = fs.existsSync(sourceBuildId) ? fs.readFileSync(sourceBuildId, 'utf8').trim() : '';
  const isUsable = directory => {
    if (!fs.existsSync(path.join(directory, 'server.js')) ||
        !fs.existsSync(path.join(directory, 'node_modules', 'next', 'package.json'))) return false;
    if (!expectedBuildId) return true;
    const installedBuildId = path.join(directory, buildIdFile);
    return fs.existsSync(installedBuildId) && fs.readFileSync(installedBuildId, 'utf8').trim() === expectedBuildId;
  };
  if (isUsable(nextDirectory)) return nextDirectory;

  const temporary = `${nextDirectory}.partial-${process.pid}`;
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(nextDirectory), { recursive: true });
  fs.cpSync(sourceDirectory, temporary, { recursive: true });
  if (!isUsable(temporary)) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw new Error('The bundled Next.js runtime is incomplete. Rebuild the desktop installer.');
  }
  fs.rmSync(nextDirectory, { recursive: true, force: true });
  fs.renameSync(temporary, nextDirectory);
  return nextDirectory;
}

async function waitForService(url, headers, alive, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!alive()) throw new Error('A local service exited before startup completed.');
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.json()).ok === true) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local service startup timed out. Check the desktop logs.');
}

function scrubbedEnvironment() {
  // Keep OS runtime variables, not credentials/configuration from a developer shell.
  const result = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL', 'SSL_CERT_FILE']) {
    if (process.env[key]) result[key] = process.env[key];
  }
  return result;
}

class DesktopRuntime extends EventEmitter {
  constructor({ resources, userData, version = '0.1.0', validation = false, development = false, frontendRoot, backendRoot, python, node }) {
    super();
    Object.assign(this, { resources, userData, version, validation, development, frontendRoot, backendRoot, python, node });
    this.paths = persistentPaths(userData);
    this.children = [];
    this.stopping = false;
    this.serviceToken = randomBytes(32).toString('hex');
    this.windowToken = randomBytes(32).toString('hex');
  }

  startChild(name, executable, args, cwd, env, { managedStartup = false } = {}) {
    if (this.stopping) throw new Error('Application is shutting down.');
    if (!executable || !fs.existsSync(executable)) throw new Error(`Missing bundled ${name} executable.`);
    const log = fs.openSync(path.join(this.paths.logs, `${name}.log`), 'a');
    const child = spawn(executable, args, { cwd, env: { ...scrubbedEnvironment(), ...env }, windowsHide: true, stdio: ['pipe', log, log], detached: process.platform !== 'win32' });
    child.desktopStarting = managedStartup;
    fs.closeSync(log);
    this.children.push({ name, child });
    child.once('error', error => { child.desktopStartError = error; if (!this.stopping && !child.desktopStarting) this.emit('failure', new Error(`${name} failed to start: ${error.message}`)); });
    child.once('exit', (code, signal) => { if (!this.stopping && !child.desktopStarting) this.emit('failure', new Error(`${name} stopped unexpectedly (${code ?? signal}).`)); });
    return child;
  }

  async start() {
    this.releaseProfile = acquireProfile(this.paths.data);
    const frontendPort = await freePort();
    let backendPort = await freePort();
    while (backendPort === frontendPort) backendPort = await freePort();
    this.frontendOrigin = `http://127.0.0.1:${frontendPort}`;
    this.backendOrigin = `http://127.0.0.1:${backendPort}`;
    const executable = process.platform === 'win32' ? 'visitor-backend.exe' : 'visitor-backend';
    const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
    const backendAssets = this.development ? this.backendRoot : path.join(this.resources, 'backend', '_internal');
    const backendCommand = this.development ? this.python : path.join(this.resources, 'backend', executable);
    const backendArgs = [...(this.development ? [path.join(this.backendRoot, 'desktop_backend.py')] : []), '--data-dir', this.paths.data, '--resources', backendAssets, '--port', String(backendPort), '--frontend-origin', this.frontendOrigin];
    await this.startMedia();
    const backend = this.startChild('backend', backendCommand, backendArgs, this.paths.data, {
      YOLO_AUTOINSTALL: 'false',
      DESKTOP_SERVICE_TOKEN: this.serviceToken, MEDIAMTX_ENABLED: 'true', MEDIAMTX_NETWORK_MODE: 'host',
      MEDIAMTX_API_URL: this.mediaApiOrigin, MEDIAMTX_RTSP_URL: this.mediaRtspOrigin,
      MEDIAMTX_WHEP_URL: this.mediaWhepOrigin, MEDIAMTX_HLS_URL: this.mediaHlsOrigin,
      MEDIAMTX_RECORDINGS_DIR: path.join(this.paths.data, 'recordings'),
      MEDIAMTX_BROWSER_STREAMS_ENABLED: 'true',
      FFMPEG_PATH: path.join(this.resources, 'media', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
      DESKTOP_RESOURCE_ROOT: this.resources,
    });
    await waitForService(`${this.backendOrigin}/desktop-health`, { 'X-Desktop-Service-Token': this.serviceToken }, () => backend.exitCode === null && !this.stopping);
    const nextDirectory = this.development ? this.frontendRoot : path.join(this.userData, 'next-runtime', this.version);
    if (!this.development) {
      // The app version can stay the same across local rebuilds. Validate the
      // standalone dependencies/build ID instead of trusting server.js alone.
      ensureNextRuntime(path.join(this.resources, 'next'), nextDirectory);
    }
    const nextNode = this.development ? this.node : path.join(this.resources, 'node', nodeName);
    const nextArgs = this.development ? [path.join(this.frontendRoot, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)] : [path.join(nextDirectory, 'server.js')];
    const frontend = this.startChild('frontend', nextNode, nextArgs, nextDirectory, {
      PORT: String(frontendPort), HOSTNAME: '127.0.0.1', NODE_ENV: this.development ? 'development' : 'production',
      NEXT_TELEMETRY_DISABLED: '1', DESKTOP_MODE: 'true', DESKTOP_BUILD: 'true',
      NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV: '', NEXT_PUBLIC_APP_MODE: 'multi_tenant',
      DESKTOP_BACKEND_ORIGIN: this.backendOrigin, DESKTOP_FRONTEND_ORIGIN: this.frontendOrigin,
      DESKTOP_SERVICE_TOKEN: this.serviceToken, DESKTOP_WINDOW_TOKEN: this.windowToken,
      DESKTOP_VALIDATION: this.validation ? 'true' : 'false', APP_DATA_DIR: this.paths.data,
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.from(fs.readFileSync(this.paths.secret, 'utf8').trim().slice(0, 64), 'hex').toString('base64'),
    });
    await waitForService(`${this.frontendOrigin}/desktop-health`, { 'X-Desktop-Window-Token': this.windowToken }, () => frontend.exitCode === null && !this.stopping, this.development ? 180000 : 120000);
    return this.frontendOrigin;
  }

  async startMedia() {
    const excluded = [this.frontendOrigin, this.backendOrigin].filter(Boolean).map(origin => Number(new URL(origin).port));
    for (let attempt = 0; attempt < 3; attempt++) {
      const ports = await mediaPorts(excluded, this.allocateMediaPort);
      excluded.push(...ports);
      try { await this.startMediaAttempt(ports); return; }
      catch (error) {
        if (error.code !== 'MEDIA_PORT_BUSY' || attempt === 2) throw error;
      }
    }
  }

  async startMediaAttempt(ports) {
    const [api, rtsp, whep, hls, ice] = ports;
    this.mediaApiOrigin = `http://desktop:${this.serviceToken}@127.0.0.1:${api}`;
    this.mediaRtspOrigin = `rtsp://desktop:${this.serviceToken}@127.0.0.1:${rtsp}`;
    this.mediaWhepOrigin = `http://127.0.0.1:${whep}`;
    this.mediaHlsOrigin = `http://127.0.0.1:${hls}`;
    const config = path.join(this.paths.data, 'mediamtx.yml');
    const recordingPath = path.join(this.paths.data, 'recordings', '%path', '%Y-%m-%d_%H-%M-%S-%f').replaceAll('\\', '/');
    fs.writeFileSync(config, `logLevel: warn\nauthInternalUsers:\n  - user: desktop\n    pass: ${this.serviceToken}\n    ips: [127.0.0.1]\n    permissions:\n      - action: api\n      - action: read\n      - action: publish\n      - action: playback\napi: yes\napiAddress: 127.0.0.1:${api}\nrtspAddress: 127.0.0.1:${rtsp}\nrtspTransports: [tcp]\nrtmp: no\nsrt: no\nmoq: no\nhlsAddress: 127.0.0.1:${hls}\nhlsAllowOrigins: [${JSON.stringify(this.frontendOrigin)}]\nwebrtcAddress: 127.0.0.1:${whep}\nwebrtcAllowOrigins: [${JSON.stringify(this.frontendOrigin)}]\nwebrtcLocalUDPAddress: ''\nwebrtcLocalTCPAddress: 127.0.0.1:${ice}\nwebrtcAdditionalHosts: [127.0.0.1]\npathDefaults:\n  source: publisher\n  record: yes\n  recordPath: ${JSON.stringify(recordingPath)}\n  recordFormat: fmp4\npaths: {}\n`, { mode: 0o600 });
    const logFile = path.join(this.paths.logs, 'mediamtx.log');
    const logOffset = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
    const media = this.startChild('mediamtx', path.join(this.resources, 'media', process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx'), [config], this.paths.data, {}, { managedStartup: true });
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (this.stopping) throw new Error('Application is shutting down.');
      if (media.desktopStartError) throw new Error('MediaMTX executable could not start.');
      if (media.exitCode !== null || media.signalCode) {
        const recentLog = fs.existsSync(logFile) ? fs.readFileSync(logFile).subarray(logOffset).toString() : '';
        const busy = /bind:.*(?:address already in use|Only one usage of each socket address)/i.test(recentLog);
        const error = new Error(busy ? 'Port layanan media sedang digunakan. Tutup aplikasi lalu coba lagi.' : `MediaMTX failed to start (${media.exitCode ?? media.signalCode}). Check mediamtx.log.`);
        if (busy) error.code = 'MEDIA_PORT_BUSY';
        throw error;
      }
      try { if ((await fetch(`http://127.0.0.1:${api}/v3/config/global/get`, { headers: { Authorization: `Basic ${Buffer.from(`desktop:${this.serviceToken}`).toString('base64')}` }, signal: AbortSignal.timeout(1000) })).ok && media.exitCode === null && !media.signalCode) { media.desktopStarting = false; return; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    media.kill('SIGTERM');
    throw new Error('MediaMTX startup timed out.');
  }

  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.stopPromise = (async () => {
      for (const { child } of [...this.children].reverse()) {
        if (child.exitCode !== null || !child.pid) continue;
        // Backend watches stdin for a graceful shutdown command on both OSes.
        child.stdin?.end('shutdown\n');
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2500))]);
        if (child.exitCode !== null) continue;
        if (process.platform !== 'win32') { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
        try { child.kill('SIGTERM'); } catch {}
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 4000))]);
        if (child.exitCode === null) {
          if (process.platform === 'win32') {
            await new Promise(resolve => { const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }); kill.once('exit', resolve); kill.once('error', resolve); });
          } else {
            try { process.kill(-child.pid, 'SIGKILL'); } catch {}
            try { child.kill('SIGKILL'); } catch {}
          }
          // Give Node's child_process watcher a moment to observe forced exits.
          await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1500))]);
        }
      }
      this.releaseProfile?.();
    })();
    return this.stopPromise;
  }
}

module.exports = { DesktopRuntime, freePort, mediaPorts, persistentPaths, ensureNextRuntime, waitForService, scrubbedEnvironment };
