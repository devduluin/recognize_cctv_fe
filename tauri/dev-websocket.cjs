'use strict';
// Only the authenticated local Next.js development socket is exposed.
function attachDevWebSocket(server, { runtime, transport, getOrigin, authorized }) {
  const sockets = new Set();
  const requests = new Set();
  server.on('upgrade', (req, socket, head) => {
    const deny = code => { socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    let url;
    try { url = new URL(req.url, getOrigin()); } catch { return deny('400 Bad Request'); }
    const origin = getOrigin();
    if (req.headers.host !== new URL(origin).host || req.headers.origin !== origin || !authorized(req)) return deny('403 Forbidden');
    if (!runtime.development || !['/_next/hmr', '/_next/webpack-hmr'].includes(url.pathname)) return deny('404 Not Found');
    if (req.method !== 'GET' || req.headers.upgrade?.toLowerCase() !== 'websocket') return deny('400 Bad Request');
    const target = new URL(runtime.frontendOrigin);
    const headers = {
      host: target.host, origin: runtime.frontendOrigin,
      connection: 'Upgrade', upgrade: 'websocket',
      'x-desktop-window-token': runtime.windowToken,
      'x-forwarded-host': target.host,
    };
    for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions']) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    sockets.add(socket);
    let peer, cleaning = false;
    const upstream = transport.request(new URL(url.pathname + url.search, target), { method: 'GET', headers });
    requests.add(upstream);
    const cleanup = () => { if (cleaning) return; cleaning = true; sockets.delete(socket); if (peer) { sockets.delete(peer); peer.destroy(); } requests.delete(upstream); upstream.destroy(); socket.destroy(); };
    socket.once('error', cleanup);
    socket.once('close', cleanup);
    upstream.once('error', () => { deny('502 Bad Gateway'); cleanup(); });
    upstream.once('response', () => { deny('502 Bad Gateway'); cleanup(); });
    upstream.setTimeout(10000, () => { deny('504 Gateway Timeout'); cleanup(); });
    upstream.once('upgrade', (response, connection, upstreamHead) => {
      if (socket.destroyed || response.statusCode !== 101) { connection.destroy(); cleanup(); return; }
      peer = connection;
      sockets.add(peer);
      upstream.setTimeout(0);
      socket.setTimeout(0); peer.setTimeout(0);
      peer.once('error', cleanup); peer.once('close', cleanup);
      const responseHeaders = Object.entries(response.headers).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : [value]).map(item => `${key}: ${item}`));
      socket.write(['HTTP/1.1 101 Switching Protocols', ...responseHeaders, '', ''].join('\r\n'));
      if (head.length) peer.write(head);
      if (upstreamHead.length) socket.write(upstreamHead);
      socket.pipe(peer); peer.pipe(socket);
    });
    upstream.end();
  });
  return () => {
    for (const request of [...requests]) request.destroy();
    for (const socket of [...sockets]) socket.destroy();
    requests.clear(); sockets.clear();
  };
}
module.exports = { attachDevWebSocket };
