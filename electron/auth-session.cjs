'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validSession(value) {
  return !!value && typeof value.token === 'string' && value.token.length > 0 && value.token.length <= 16384 &&
    !!value.user && typeof value.user.id === 'string' && typeof value.user.email === 'string' &&
    Buffer.byteLength(JSON.stringify(value)) <= 65536;
}

function sanitizedSession(session) {
  const keys = ['id', 'email', 'full_name', 'account_type', 'company_id', 'workspace_id', 'role', 'permissions', 'custom_permissions', 'is_active'];
  return { token: session.token, user: Object.fromEntries(keys.filter(key => key in session.user).map(key => [key, session.user[key]])) };
}

class AuthSessionStore {
  constructor(directory, encryption, platform = process.platform) {
    this.file = path.join(directory, 'auth-session.enc');
    this.encryption = encryption;
    this.platform = platform;
  }
  available() {
    return this.encryption.isEncryptionAvailable() &&
      (this.platform !== 'linux' || this.encryption.getSelectedStorageBackend?.() !== 'basic_text');
  }
  read() {
    if (!fs.existsSync(this.file) || !this.available()) return null;
    try {
      const bytes = fs.readFileSync(this.file);
      if (bytes.length > 131072) return null;
      const session = JSON.parse(this.encryption.decryptString(bytes));
      return validSession(session) ? session : null;
    } catch { return null; } // Unreadable credentials never grant access.
  }
  write(session) {
    if (!validSession(session)) throw new Error('Sesi desktop tidak valid.');
    if (!this.available()) throw new Error('Penyimpanan sesi terenkripsi belum tersedia. Periksa keychain atau penyimpanan kredensial OS.');
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const temporary = this.file + '.tmp';
    try {
      fs.writeFileSync(temporary, this.encryption.encryptString(JSON.stringify(sanitizedSession(session))), { mode: 0o600 });
      fs.renameSync(temporary, this.file);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  clear() { fs.rmSync(this.file, { force: true }); }
}

async function restoreSession(store, runtime, request = fetch) {
  const session = store.read();
  if (!session) return null;
  const response = await request(`${runtime.backendOrigin}/api/v1/auth/me`, { headers: {
    Authorization: `Bearer ${session.token}`, 'X-Desktop-Service-Token': runtime.serviceToken,
  }, signal: AbortSignal.timeout(10000) });
  if (response.status === 401 || response.status === 403) { store.clear(); return null; }
  if (!response.ok) throw new Error('Sesi tersimpan belum dapat diverifikasi. Buka kembali aplikasi untuk mencoba lagi.');
  const payload = await response.json();
  const restored = { token: session.token, user: payload?.result?.user };
  if (!validSession(restored)) throw new Error('Respons validasi sesi desktop tidak lengkap.');
  store.write(restored);
  return restored;
}

function trustedSender(event, window, origin) {
  try {
    return event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame &&
      new URL(event.senderFrame.url).origin === origin;
  } catch { return false; }
}
module.exports = { AuthSessionStore, restoreSession, trustedSender, validSession };
