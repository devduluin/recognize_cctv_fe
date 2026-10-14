const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const run = (script, args = []) => execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  windowsHide: true,
});

run('clean.cjs');
run('build.cjs');
execFileSync(process.execPath, [
  path.join(root, 'node_modules/electron-builder/cli.js'),
  '--config', path.join(root, 'electron-builder.cjs'),
  '--publish', 'never',
  ...process.argv.slice(2),
], { cwd: root, stdio: 'inherit', env: process.env, windowsHide: true });
