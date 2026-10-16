const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, user } = require('../scripts/docs/fixtures.cjs');
const root = path.resolve(__dirname, '..');

test('documentation API fixtures reject writes and unknown endpoints', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(fixture(new URL('http://127.0.0.1/api/v1/events'), method), undefined);
  }
  assert.equal(fixture(new URL('http://127.0.0.1/api/v1/not-documented')), undefined);
  assert.equal(user.email.endsWith('@example.test'), true);
  assert.equal('password' in user, false);
});

test('dashboard fixture matches the requested reporting date and totals', () => {
  const { result } = fixture(new URL('http://127.0.0.1/api/v1/event_visitor/statistics/hourly?date=2027-01-03'));
  assert.equal(result.date, '2027-01-03');
  assert.equal(result.hours.length, 24);
  assert.equal(result.hours.reduce((sum, hour) => sum + hour.in_count, 0), result.total_in);
  assert.equal(result.male_count + result.female_count + result.unknown_gender_count, result.total_in);
});

test('every screenshot referenced in the guide has an automatic capture step', () => {
  const manual = fs.readFileSync(path.join(root, 'docs/manual/README.md'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'scripts/docs/capture-window.cjs'), 'utf8');
  const names = [...manual.matchAll(/\]\(screenshots\/([\w-]+)\.png\)/g)].map(match => match[1]);
  assert.equal(names.length, 9);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(script.includes(`capture('${name}')`), name);
  for (const match of manual.matchAll(/\]\(([^)]+\.md)\)/g)) {
    assert.ok(fs.existsSync(path.resolve(root, 'docs/manual', match[1])), match[1]);
  }
});

test('dashboard preview catalog uses safe sample metadata without opening camera streams', () => {
  const { result: cameras } = fixture(new URL(`http://127.0.0.1/api/v1/cctv/camera-previews?company_id=${user.workspace_id}`));
  assert.equal(cameras.length, 1);
  assert.equal(cameras[0].name, 'Pintu Utama (contoh)');
  assert.equal(cameras[0].has_source, true);
  assert.equal(cameras[0].status, 'offline');
  assert.ok(!('rtsp_url' in cameras[0]));
  assert.ok(!('camera_source' in cameras[0]));
  assert.equal(fixture(new URL('http://127.0.0.1/api/v1/events/camera-stream'), 'POST'), undefined);
});

const os = require('node:os');
const { documentationResponse, validatePackage } = require('../scripts/docs/package-output.cjs');

test('PDF page and images are served over the same origin without allowing other files', async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-assets-test-'));
  try {
    fs.mkdirSync(path.join(output, 'screenshots'));
    fs.writeFileSync(path.join(output, 'index.html'), '<html>Guide</html>');
    fs.writeFileSync(path.join(output, 'screenshots', '01-login.png'), 'image');
    const response = documentationResponse(new URL('http://127.0.0.1/__manual/index.html'), output);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /text\/html/);
    assert.equal(await response.text(), '<html>Guide</html>');
    assert.equal(documentationResponse(new URL('http://127.0.0.1/__manual/screenshots/01-login.png'), output).status, 200);
    for (const name of ['manifest.json', 'secrets.env', 'screenshots/../../secrets.env', 'screenshots/missing.png']) {
      assert.equal(documentationResponse(new URL(`http://127.0.0.1/__manual/${name}`), output).status, 404);
    }
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});

test('an incomplete or missing PDF cannot be reported as a completed capture', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-completion-test-'));
  try {
    const screenshots = Array.from({ length: 9 }, (_, i) => `screenshot-${i}`);
    fs.mkdirSync(path.join(output, 'screenshots'));
    for (const name of screenshots) fs.writeFileSync(path.join(output, 'screenshots', `${name}.png`), Buffer.from([137,80,78,71,13,10,26,10]));
    const manifest = { fixture_data: true, screenshots };
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest));
    assert.throws(() => validatePackage(output), /belum selesai/);
    manifest.complete = true;
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest));
    assert.throws(() => validatePackage(output));
    fs.writeFileSync(path.join(output, 'Visitor-Counter-Manual.pdf'), 'invalid');
    assert.throws(() => validatePackage(output), /PDF/);
    fs.writeFileSync(path.join(output, 'Visitor-Counter-Manual.pdf'), '%PDF-1.7\n');
    assert.equal(validatePackage(output).complete, true);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
