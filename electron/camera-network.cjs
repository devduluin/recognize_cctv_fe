'use strict';
const net = require('node:net');

function cameraTarget(source) {
  if (typeof source !== 'string' || source.length > 4096) throw new Error('Alamat kamera tidak valid.');
  const url = new URL(source);
  if (!['rtsp:', 'rtsps:'].includes(url.protocol)) throw new Error('Pemeriksaan ini khusus kamera RTSP.');
  const host = url.hostname;
  // Only probe literal private IPv4 camera addresses. Other sources keep their
  // existing backend path; no arbitrary DNS or public-network socket API is exposed.
  if (net.isIP(host) !== 4) return null;
  const [a, b] = host.split('.').map(Number);
  if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254))) return null;
  return { host, port: Number(url.port || 554) };
}

async function checkCameraNetwork(source, { token, runtime, platform = process.platform, request = fetch, connect = net.createConnection, timeout = 7000 }) {
  const denied = { ok: false, message: 'Anda tidak memiliki izin untuk menguji sumber kamera.' };
  if (!token) return denied;
  let target;
  try { target = cameraTarget(source); }
  catch { return { ok: false, message: 'Alamat kamera RTSP tidak valid.' }; }
  if (!target || platform !== 'darwin') return { ok: true, skipped: true };
  try {
    const response = await request(`${runtime.backendOrigin}/api/v1/auth/me`, { headers: {
      Authorization: `Bearer ${token}`, 'X-Desktop-Service-Token': runtime.serviceToken,
    }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return denied;
    const payload = await response.json();
    if (!payload?.result?.user?.permissions?.includes('cameras.read')) return denied;
  } catch { return { ok: false, message: 'Hak akses pengujian kamera belum dapat diperiksa. Coba lagi.' }; }

  // This is a real user-requested camera reachability check from the app's main
  // process, so macOS can attribute LAN access to Visitor Counter itself.
  return new Promise(resolve => {
    let socket, timer, finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(result);
    };
    const failure = code => {
      if (['EHOSTUNREACH', 'ENETUNREACH', 'EACCES', 'EPERM'].includes(code)) {
        finish({ ok: false, message: 'Visitor Counter tidak dapat menjangkau kamera dari aplikasi macOS. Izinkan akses Local Network jika diminta, lalu klik Test Kamera lagi. Periksa juga pengaturan jaringan lokal/VPN.' });
      } else if (code === 'ECONNREFUSED') {
        finish({ ok: false, message: 'Port RTSP kamera menolak koneksi. Periksa port dan status kamera.' });
      } else finish({ ok: false, message: 'Kamera tidak merespons dari Visitor Counter. Periksa izin Local Network dan koneksi, lalu coba lagi.' });
    };
    timer = setTimeout(() => failure('ETIMEDOUT'), timeout);
    try {
      socket = connect(target);
      socket.once('connect', () => finish({ ok: true }));
      socket.once('error', error => failure(error.code));
    } catch { failure('CONNECT_FAILED'); }
  });
}
module.exports = { cameraTarget, checkCameraNetwork };
