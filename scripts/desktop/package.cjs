const path = require('node:path');
const { runWithProgress } = require('./progress.cjs');
const { ensureNpmOnPath } = require('./npm-path.cjs');
const { signingEnvironment } = require('./platform-selector.cjs');

const root = path.resolve(__dirname, '../..');
const target = process.argv.slice(2);
const label = `Membuat installer${target.length ? ` (${target.join(' ')})` : ''}`;
const env = process.env.DESKTOP_REQUIRE_SIGNING === 'false'
  ? signingEnvironment(false)
  : { ...process.env };

runWithProgress(process.execPath, [
  path.join(root, 'node_modules/electron-builder/cli.js'),
  '--config', path.join(root, 'electron-builder.cjs'),
  '--publish', 'never',
  ...target,
], { cwd: root, label, env: ensureNpmOnPath(env) }).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
