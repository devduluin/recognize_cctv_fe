'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
function acquireProfile(directory) {
  const file = path.join(directory, 'desktop-runtime.lock');
  const token = randomBytes(16).toString('hex');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
      return () => { try { if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file); } catch {} };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('Profil desktop terkunci. Periksa proses aplikasi sebelum memulihkan lock.'); }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error('Invalid desktop profile lock.');
      try { process.kill(owner.pid, 0); }
      catch (error) {
        if (error.code === 'ESRCH') { fs.unlinkSync(file); continue; }
        throw new Error('Profil desktop sedang digunakan atau tidak dapat diperiksa.');
      }
      throw new Error('Visitor Counter sudah berjalan menggunakan profil ini. Tutup aplikasi lain terlebih dahulu.');
    }
  }
  throw new Error('Profil desktop tidak dapat dikunci.');
}
module.exports = { acquireProfile };
