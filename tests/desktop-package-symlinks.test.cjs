const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const verify = require('../scripts/desktop/verify-package.cjs');

function fixture(t) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-package-'));
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  const appOutDir = path.join(projectDir, 'out');
  const root = path.join(appOutDir, 'Visitor Counter.app/Contents/Resources');
  for (const name of ['backend/visitor-backend', 'node/node', 'media/ffmpeg', 'media/mediamtx', 'next/server.js', 'next/.next/BUILD_ID', 'next/node_modules/next/package.json']) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), '{}');
  }
  fs.writeFileSync(path.join(root, 'build-manifest.json'), JSON.stringify({ version: '0.1.0', platform: 'darwin', buildNumber: '123456' }));
  return { projectDir, root, context: { appOutDir, electronPlatformName: 'darwin', packager: { projectDir, appInfo: { version: '0.1.0' } } } };
}

test('packaging materializes public symlinks from previously staged resources', async t => {
  const { projectDir, root, context } = fixture(t);
  const samples = path.join(projectDir, 'samples');
  fs.mkdirSync(samples);
  fs.writeFileSync(path.join(samples, 'clip.txt'), 'sample');
  const staged = path.join(projectDir, 'resources/next/public');
  fs.mkdirSync(staged, { recursive: true });
  fs.symlinkSync(samples, path.join(staged, 'samples'), 'dir');
  await verify(context);
  const packaged = path.join(root, 'next/public/samples');
  assert.equal(fs.lstatSync(packaged).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(path.join(packaged, 'clip.txt'), 'utf8'), 'sample');
});

for (const kind of ['absolute', 'escaping', 'broken', 'internal']) {
  test(`packaged ${kind} symlink validation`, async t => {
    const { projectDir, root, context } = fixture(t);
    fs.writeFileSync(path.join(projectDir, 'outside'), 'outside');
    const target = kind === 'absolute' ? path.join(root, 'next/server.js')
      : kind === 'escaping' ? path.relative(root, path.join(projectDir, 'outside'))
      : kind === 'broken' ? 'missing' : 'next/server.js';
    fs.symlinkSync(target, path.join(root, 'link'));
    if (kind === 'internal') await verify(context);
    else await assert.rejects(verify(context), /packaged symlink/);
  });
}
