'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachDevWebSocket } = require('../tauri/dev-websocket.cjs');
class Socket extends EventEmitter {
  writes = []; destroyed = false;
  write(data) { this.writes.push(data.toString()); }
  end(data) { if (data) this.write(data); }
  destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('close'); } }
  pipe(target) { this.target = target; return target; }
  setTimeout() {}
}
function fixture(development = true) {
  const server = new EventEmitter(), calls = [];
  const transport = { request(url, options) {
    const request = new Socket();
    calls.push({ url, options, request });
    return request;
  } };
  const close = attachDevWebSocket(server, { runtime: { development, frontendOrigin: 'http://127.0.0.1:4000', windowToken: 'trusted-window-token' }, transport,
    getOrigin: () => 'http://127.0.0.1:5000', authorized: req => req.headers.cookie === 'valid-cookie' });
  const upgrade = (changes = {}) => {
    const socket = new Socket();
    const req = { url: '/_next/hmr?id=document123', method: 'GET', headers: { host: '127.0.0.1:5000', origin: 'http://127.0.0.1:5000', cookie: 'valid-cookie', upgrade: 'websocket', 'sec-websocket-key': 'key', 'sec-websocket-version': '13', ...changes.headers }, ...changes };
    // Preserve full default headers while allowing selective overrides.
    req.headers = { host: '127.0.0.1:5000', origin: 'http://127.0.0.1:5000', cookie: 'valid-cookie', upgrade: 'websocket', 'sec-websocket-key': 'key', 'sec-websocket-version': '13', ...changes.headers };
    server.emit('upgrade', req, socket, Buffer.from('client-head'));
    return socket;
  };
  return { upgrade, calls, close };
}
test('development HMR uses fixed local upstream and trusted token; preserves document ID and upgrade head', () => {
  const { upgrade, calls, close } = fixture();
  const socket = upgrade({ headers: { 'x-desktop-window-token': 'forged', authorization: 'untrusted' } });
  const { url, options, request } = calls[0];
  assert.equal(url.href, 'http://127.0.0.1:4000/_next/hmr?id=document123');
  assert.equal(options.headers.origin, 'http://127.0.0.1:4000');
  assert.equal(options.headers['x-desktop-window-token'], 'trusted-window-token');
  assert.equal(options.headers.authorization, undefined);
  assert.equal(options.headers.cookie, undefined);
  const peer = new Socket();
  request.emit('upgrade', { statusCode: 101, headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-accept': 'accepted' } }, peer, Buffer.from('server-head'));
  assert.match(socket.writes[0], /^HTTP\/1.1 101/);
  assert.equal(peer.writes[0], 'client-head');
  assert.equal(socket.writes[1], 'server-head');
  assert.equal(peer.target, socket);
  assert.equal(socket.target, peer);
  close();
  assert.equal(socket.destroyed, true);
  assert.equal(peer.destroyed, true);
});
test('development socket rejects foreign origins, host spoofing, missing session and arbitrary targets', () => {
  const { upgrade, calls, close } = fixture();
  for (const headers of [{ origin: 'https://hostile.example' }, { origin: undefined }, { cookie: '' }, { host: 'attacker.example' }]) {
    assert.match(upgrade({ headers }).writes[0], /403 Forbidden/);
  }
  assert.match(upgrade({ url: '/other' }).writes[0], /404 Not Found/);
  assert.equal(calls.length, 0);
  close();
});
test('production gateway does not expose development sockets', () => {
  const { upgrade, calls, close } = fixture(false);
  assert.match(upgrade().writes[0], /404 Not Found/);
  assert.equal(calls.length, 0);
  close();
});
test('upstream failure closes pending sockets and requests', () => {
  const { upgrade, calls, close } = fixture();
  const socket = upgrade();
  calls[0].request.emit('error', new Error('service unavailable'));
  assert.equal(socket.destroyed, true);
  assert.equal(calls[0].request.destroyed, true);
  close();
});
