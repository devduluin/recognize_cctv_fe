// Install previously captured, complete documentation assets before a web/desktop build.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'artifacts/manual');
const { validatePackage } = require('./package-output.cjs');
const manifest = validatePackage(source);
const target = path.join(root, 'public/manual/screenshots');
fs.mkdirSync(target, { recursive: true });
for (const name of manifest.screenshots) fs.copyFileSync(path.join(source, 'screenshots', `${name}.png`), path.join(target, `${name}.png`));
console.log('Screenshot dipasang. Build ulang aplikasi untuk menyertakannya dalam deployment.');
