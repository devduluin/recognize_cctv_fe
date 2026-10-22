'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');

function browserExecutable(env = process.env, platform = process.platform, exists = fs.existsSync) {
  if (env.DOCS_BROWSER_PATH) {
    if (!exists(env.DOCS_BROWSER_PATH)) throw new Error('DOCS_BROWSER_PATH tidak ditemukan.');
    return env.DOCS_BROWSER_PATH;
  }
  const candidates = platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : platform === 'win32'
      ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).flatMap(root => [path.win32.join(root, 'Google/Chrome/Application/chrome.exe'), path.win32.join(root, 'Microsoft/Edge/Application/msedge.exe')])
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const executable = candidates.find(exists);
  if (!executable) throw new Error('Chrome/Edge/Chromium belum tersedia untuk capture dokumentasi. Install browser atau set DOCS_BROWSER_PATH.');
  return executable;
}
class CDP extends EventEmitter {
  constructor(socket) {
    super(); this.socket = socket; this.sequence = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = this.pending.get(message.id);
        if (!item) return;
        clearTimeout(item.timer); this.pending.delete(message.id);
        if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
      } else if (message.method) this.emit(message.method, message.params);
    });
    const stop = () => { for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser documentation capture disconnected.')); } this.pending.clear(); };
    socket.addEventListener('close', stop); socket.addEventListener('error', stop);
  }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Browser capture timed out: ${method}`)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async evaluate(expression) {
    const value = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || 'Documentation page script failed');
    return value.result?.value;
  }
}
async function launchBrowser(profile) {
  const child = spawn(browserExecutable(), ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'inherit'] });
  let failure; child.once('error', error => { failure = error; });
  try {
    let port;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw new Error('Browser berhenti sebelum capture siap.');
      try { const value = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; if (/^\d+$/.test(value)) { port = Number(value); break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!port) throw new Error('Browser debugging endpoint tidak siap.');
    const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Browser capture target tidak tersedia.');
    const target = await response.json();
    const url = new URL(target.webSocketDebuggerUrl);
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' || Number(url.port) !== port || url.protocol !== 'ws:') throw new Error('Invalid browser debugger origin.');
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Browser debugger failed')), { once: true }); });
    return { child, client: new CDP(socket), close: async () => { socket.close(); child.kill(); } };
  } catch (error) { child.kill(); throw error; }
}
module.exports = { browserExecutable, CDP, launchBrowser };
