const path = require('node:path');
const { runWithProgress } = require('./progress.cjs');

const root = path.resolve(__dirname, '../..');
const target = process.argv.slice(2);
const label = `Membuat installer${target.length ? ` (${target.join(' ')})` : ''}`;

runWithProgress(process.execPath, [
  path.join(root, 'node_modules/electron-builder/cli.js'),
  '--config', path.join(root, 'electron-builder.cjs'),
  '--publish', 'never',
  ...target,
], { cwd: root, label }).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
