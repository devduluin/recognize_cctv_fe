const fs = require('node:fs');
const path = require('node:path');

function documentationResponse(url, output) {
  let relative;
  let type;
  if (url.pathname === '/__manual/index.html') {
    relative = 'index.html'; type = 'text/html; charset=utf-8';
  } else {
    const image = /^\/__manual\/screenshots\/([\w-]+\.png)$/.exec(url.pathname);
    if (!image) return new Response('Not found', { status: 404 });
    relative = path.join('screenshots', image[1]); type = 'image/png';
  }
  try { return new Response(fs.readFileSync(path.join(output, relative)), { headers: { 'Content-Type': type } }); }
  catch { return new Response('Documentation asset missing', { status: 404 }); }
}

function validatePackage(output) {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  if (manifest.complete !== true || manifest.fixture_data !== true || !Array.isArray(manifest.screenshots) ||
      manifest.screenshots.length !== 9 || new Set(manifest.screenshots).size !== 9) throw new Error('Paket dokumentasi belum selesai.');
  for (const name of manifest.screenshots) {
    if (typeof name !== 'string' || !/^[\w-]+$/.test(name)) throw new Error('Nama screenshot tidak valid.');
    const bytes = fs.readFileSync(path.join(output, 'screenshots', `${name}.png`));
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Screenshot tidak valid: ${name}`);
  }
  if (fs.readFileSync(path.join(output, 'Visitor-Counter-Manual.pdf')).subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF dokumentasi belum tersedia atau tidak valid.');
  return manifest;
}
module.exports = { documentationResponse, validatePackage };
