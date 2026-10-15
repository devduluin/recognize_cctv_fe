const path = require('node:path');
const { runWithProgress } = require('./progress.cjs');

runWithProgress(process.execPath, [path.join(__dirname, 'build.cjs')], {
  cwd: path.resolve(__dirname, '../..'),
  label: 'Membangun backend dan frontend',
}).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
