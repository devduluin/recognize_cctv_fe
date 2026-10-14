const path = require('node:path');
const { runWithProgress } = require('./progress.cjs');
const { selectTargetArgs } = require('./platform-selector.cjs');

const root = path.resolve(__dirname, '../..');

async function main() {
  const targetArgs = await selectTargetArgs();
  await runWithProgress(process.execPath, [path.join(__dirname, 'clean.cjs')], {
    cwd: root, label: 'Membersihkan output build lama',
  });
  await runWithProgress(process.execPath, [path.join(__dirname, 'build.cjs')], {
    cwd: root, label: 'Membangun backend dan frontend',
  });
  await runWithProgress(process.execPath, [path.join(__dirname, 'package.cjs'), ...targetArgs], {
    cwd: root, label: 'Menyiapkan installer desktop',
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
