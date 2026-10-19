'use strict';
const http = require('node:http');
const { randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } = require('node:crypto');

function sessionEncryption(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex || '')) throw new Error('OS credential key is unavailable.');
  const key = Buffer.from(hex, 'hex');
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'os-keychain',
    encryptString(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
    },
    decryptString(value) {
      const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(12, 28));
      return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
const bridge = `(() => {
  function request(method, body) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, '/__desktop/auth', false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(body === undefined ? null : JSON.stringify(body));
    if (xhr.status !== 200) throw new Error('Penyimpanan sesi desktop gagal.');
    return JSON.parse(xhr.responseText);
  }
  if (!sessionStorage.getItem('tauri-auth-initialized')) {
    const session = request('GET').session;
    if (session) { localStorage.setItem('auth_token', session.token); localStorage.setItem('user_info', JSON.stringify(session.user)); }
    else { localStorage.removeItem('auth_token'); localStorage.removeItem('user_info'); }
    sessionStorage.setItem('tauri-auth-initialized', '1');
  }
  window.desktopAuthSession = { save: value => request('POST', value), clear: () => request('DELETE') };
  window.desktopCameraNetwork = { check: async source => {
    const response = await fetch('/__desktop/camera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) });
    return response.json();
  }};
})();`;
function equal(a, b) { return typeof a === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
async function jsonBody(request) {
  const parts = []; let bytes = 0;
  for await (const part of request) {
    bytes += part.length;
    if (bytes > 65536) throw new Error('Request too large');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
async function createGateway({ runtime, authStore, checkCamera, transport = http }) {
  const session = randomBytes(32).toString('hex'), bootstrap = randomBytes(32).toString('hex');
  let used = false, origin;
  const server = transport.createServer(async (req, res) => {
    const fail = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ message })); };
    try {
      if (req.headers.host !== new URL(origin).host) return fail(403, 'Host denied');
      if (req.headers.origin && req.headers.origin !== origin) return fail(403, 'Origin denied');
      const url = new URL(req.url, origin);
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method === 'GET' && !used && equal(url.pathname, `/__desktop/bootstrap/${bootstrap}`)) {
        used = true;
        res.writeHead(303, { 'Set-Cookie': `visitor_tauri=${session}; HttpOnly; SameSite=Strict; Path=/`, Location: '/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('visitor_tauri='))?.slice(14);
      if (!equal(cookie, session)) return fail(403, 'Local application access denied');
      if (url.pathname === '/__desktop/bridge.js' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end(bridge);
      }
      if (url.pathname === '/__desktop/auth') {
        if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ session: authStore.read() })); }
        if (req.method === 'POST') authStore.write(await jsonBody(req));
        else if (req.method === 'DELETE') authStore.clear();
        else return fail(405, 'Method denied');
        return fail(200, 'OK');
      }
      if (url.pathname === '/__desktop/camera' && req.method === 'POST') {
        const result = await checkCamera((await jsonBody(req)).source, authStore.read());
        res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(result));
      }
      let targetOrigin = runtime.frontendOrigin, pathname = url.pathname;
      for (const [prefix, target] of [['/__media/whep', runtime.mediaWhepOrigin], ['/__media/hls', runtime.mediaHlsOrigin]]) {
        if (pathname.startsWith(prefix + '/')) { targetOrigin = target; pathname = pathname.slice(prefix.length); break; }
      }
      const target = new URL(targetOrigin);
      const headers = { ...req.headers, host: target.host, 'accept-encoding': 'identity' };
      headers.cookie = (req.headers.cookie || '').split(';').filter(x => !x.trim().startsWith('visitor_tauri=')).join(';');
      delete headers.authorization;
      if (req.headers.authorization) headers.authorization = req.headers.authorization;
      delete headers['x-desktop-service-token']; delete headers['x-desktop-window-token'];
      if (headers.origin) headers.origin = runtime.frontendOrigin;
      if (targetOrigin === runtime.frontendOrigin) {
        headers['x-desktop-window-token'] = runtime.windowToken;
        // Server Actions compare Origin with X-Forwarded-Host.
        headers['x-forwarded-host'] = target.host;
      } else {
        headers.authorization = 'Basic ' + Buffer.from(`desktop:${runtime.serviceToken}`).toString('base64');
        if (headers.origin) headers.origin = origin;
      }
      const upstream = transport.request(new URL(pathname + url.search, target), { method: req.method, headers }, response => {
        response.on('error', () => res.destroy());
        const outputHeaders = { ...response.headers };
        delete outputHeaders['content-length'];
        const rewrite = value => String(value).replaceAll(runtime.mediaWhepOrigin, origin + '/__media/whep').replaceAll(runtime.mediaHlsOrigin, origin + '/__media/hls');
        if (outputHeaders.location) {
          const location = new URL(outputHeaders.location, target);
          if (location.origin === targetOrigin) outputHeaders.location = targetOrigin === runtime.frontendOrigin ? location.pathname + location.search : origin + (targetOrigin === runtime.mediaWhepOrigin ? '/__media/whep' : '/__media/hls') + location.pathname + location.search;
        }
        const type = outputHeaders['content-type'] || '';
        // Stream SSE, video, RSC and uploads without buffering. Only small JSON
        // API responses and HTML documents need URL/bridge adaptation.
        const streamMetadata = /\/(?:stream-urls|camera-stream|camera-preview-url|camera-previews)\/?$/.test(url.pathname);
        if ((type.includes('application/json') && streamMetadata) || type.includes('text/html')) {
          const parts = []; let bytes = 0;
          response.on('data', chunk => { bytes += chunk.length; if (bytes > 32 * 1024 * 1024) { response.destroy(); res.destroy(); } else parts.push(chunk); });
          response.on('end', () => {
            if (res.destroyed) return;
            let body = rewrite(Buffer.concat(parts).toString('utf8'));
            if (type.includes('text/html')) body = body.replace('<head>', '<head><script src="/__desktop/bridge.js"></script>');
            delete outputHeaders.etag;
            outputHeaders['cache-control'] = 'no-store';
            res.writeHead(response.statusCode, outputHeaders); res.end(body);
          });
        } else { res.writeHead(response.statusCode, outputHeaders); response.pipe(res); }
      });
      upstream.on('error', () => { if (!res.headersSent) fail(502, 'Local service unavailable'); else res.destroy(); });
      res.on('close', () => upstream.destroy()); req.pipe(upstream);
    } catch { if (!res.headersSent) fail(400, 'Invalid local request'); else res.destroy(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, bootstrapUrl: `${origin}/__desktop/bootstrap/${bootstrap}`, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
module.exports = { createGateway, sessionEncryption };
