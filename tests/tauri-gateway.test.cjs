'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGateway, sessionEncryption } = require('../tauri/gateway.cjs');
const { AuthSessionStore } = require('../electron/auth-session.cjs');
async function fixture(t) {
  const { EventEmitter } = require('node:events');
  const { Readable, Writable } = require('node:stream');
  const requests = [];
  const origin = 'http://127.0.0.1:38000';
  const whep = 'http://127.0.0.1:38002', hls = 'http://127.0.0.1:38003';
  let handler;
  const server = Object.assign(new EventEmitter(), {
    listen(port, host, done) { assert.equal(host, '127.0.0.1'); queueMicrotask(done); },
    address: () => ({ port: 38001 }), close: done => done(), closeAllConnections() {},
  });
  const transport = {
    createServer(callback) { handler = callback; return server; },
    request(url, options, callback) {
      requests.push({ url: url.pathname, headers: options.headers });
      const outgoing = new Writable({ write(chunk, encoding, done) { done(); } });
      outgoing.on('finish', () => {
        let type = 'application/json', data = JSON.stringify({ url: whep + '/camera/index.m3u8' });
        let headers = {}, statusCode = 200;
        if (url.pathname === '/page') { type = 'text/html'; data = '<html><head></head><body>SSR works</body></html>'; }
        if (url.pathname === '/stream') { type = 'text/event-stream'; data = 'data: first\n\ndata: second\n\n'; }
        if (url.pathname === '/camera/whep') { headers.location = '/camera/whep/session'; statusCode = 201; data = 'sdp'; }
        const response = Readable.from([Buffer.from(data)]);
        Object.assign(response, { statusCode, headers: { 'content-type': type, ...headers } });
        callback(response);
      });
      return outgoing;
    },
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-tauri-test-'));
  const store = new AuthSessionStore(directory, sessionEncryption('a'.repeat(64)));
  const gateway = await createGateway({ transport, runtime: { frontendOrigin: origin, mediaWhepOrigin: whep, mediaHlsOrigin: hls, windowToken: 'window-secret', serviceToken: 'service-secret' }, authStore: store, checkCamera: async () => ({ ok: true }) });
  t.after(async () => { await gateway.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  async function localFetch(url, options = {}) {
    const target = new URL(url);
    const request = Readable.from(options.body ? [Buffer.from(options.body)] : []);
    Object.assign(request, { url: target.pathname + target.search, method: options.method || 'GET', headers: { host: target.host, ...options.headers } });
    let status = 200; const headers = new Headers(), chunks = [];
    const response = new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    response.setHeader = (key, value) => headers.set(key, value);
    response.writeHead = (code, values) => { response.headersSent = true; status = code; for (const [key, value] of Object.entries(values)) headers.set(key, value); };
    const finished = new Promise((resolve, reject) => { response.on('finish', resolve); response.on('error', reject); });
    await handler(request, response); await finished;
    return new Response(Buffer.concat(chunks), { status, headers });
  }
  const boot = await localFetch(gateway.bootstrapUrl, { redirect: 'manual' });
  const cookie = boot.headers.get('set-cookie').split(';')[0];
  return { gateway, store, requests, cookie, fetch: localFetch, request: (url, options = {}) => localFetch(gateway.origin + url, { ...options, headers: { cookie, ...options.headers } }) };
}
test('gateway requires bootstrap session, rejects foreign origins and consumes bootstrap once', async t => {
  const { gateway, request, fetch } = await fixture(t);
  assert.equal((await fetch(gateway.origin + '/page')).status, 403);
  assert.equal((await fetch(gateway.bootstrapUrl, { redirect: 'manual' })).status, 403);
  assert.equal((await request('/page', { headers: { origin: 'https://hostile.example' } })).status, 403);
  const response = await request('/page');
  assert.match(await response.text(), /<head><script src="\/__desktop\/bridge.js"><\/script>/);
});
test('gateway adds native token and rewrites media URLs, session locations and origins', async t => {
  const { gateway, request, requests } = await fixture(t);
  const json = await (await request('/api/v1/events/camera-stream', { headers: { origin: gateway.origin } })).json();
  assert.match(json.url, /\/__media\/whep\/camera\/index.m3u8$/);
  assert.equal(requests[0].headers['x-desktop-window-token'], 'window-secret');
  assert.equal(requests[0].headers.cookie.includes('visitor_tauri'), false);
  assert.equal(requests[0].headers.origin, requests[0].headers['x-forwarded-host'] && `http://${requests[0].headers['x-forwarded-host']}`);
  const response = await request('/__media/whep/camera/whep', { method: 'POST', body: 'sdp', redirect: 'manual' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), gateway.origin + '/__media/whep/camera/whep/session');
  assert.equal(requests[1].headers.authorization, 'Basic ' + Buffer.from('desktop:service-secret').toString('base64'));
});
test('session save is encrypted, restored, cleared and invalid input rejected', async t => {
  const { request, store } = await fixture(t);
  const session = { token: 'private-token', user: { id: 'user', email: 'user@example.com' } };
  assert.equal((await request('/__desktop/auth', { method: 'POST', body: JSON.stringify(session) })).status, 200);
  assert.equal(fs.readFileSync(store.file).includes(Buffer.from(session.token)), false);
  assert.deepEqual((await (await request('/__desktop/auth')).json()).session, session);
  assert.equal((await request('/__desktop/auth', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await request('/__desktop/auth', { method: 'DELETE' })).status, 200);
  assert.equal((await (await request('/__desktop/auth')).json()).session, null);
});
test('gateway preserves streaming event content and response type', async t => {
  const { request } = await fixture(t);
  const response = await request('/stream');
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(Buffer.from(first.value).toString(), /data: first/);
  await reader.cancel();
});
test('encrypted session rejects tampering and wrong OS key', () => {
  const cipher = sessionEncryption('a'.repeat(64));
  const data = cipher.encryptString('secret');
  assert.equal(cipher.decryptString(data), 'secret');
  assert.throws(() => sessionEncryption('b'.repeat(64)).decryptString(data));
  data[data.length - 1] ^= 1;
  assert.throws(() => cipher.decryptString(data));
});

test('shared profile lock prevents simultaneous Electron/Tauri writers and releases safely', () => {
  const { acquireProfile } = require('../electron/profile-lock.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'visitor-profile-test-'));
  try {
    const release = acquireProfile(directory);
    assert.throws(() => acquireProfile(directory), /sudah berjalan/);
    release();
    const again = acquireProfile(directory);
    release(); // An old owner must not remove a newer lease.
    assert.throws(() => acquireProfile(directory), /sudah berjalan/);
    again();
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
