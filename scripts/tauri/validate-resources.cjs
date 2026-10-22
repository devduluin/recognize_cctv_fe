'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Validate before copying/signing. Never allow links into a developer machine or
// user profile, or links that will break when the installed app is relocated.
function validateResources(root) {
  const base = fs.realpathSync(root);
  let links = 0, savedBytes = 0;
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const relative = path.relative(base, file);
        if (path.isAbsolute(fs.readlinkSync(file))) throw new Error(`Absolute resource symlink: ${relative}`);
        let target;
        try { target = fs.realpathSync(file); } catch { throw new Error(`Broken resource symlink: ${relative}`); }
        const targetRelative = path.relative(base, target);
        if (targetRelative === '..' || targetRelative.startsWith('..' + path.sep) || path.isAbsolute(targetRelative)) {
          throw new Error(`Resource symlink escapes bundle: ${relative}`);
        }
        links++;
        const stat = fs.statSync(file);
        if (stat.isFile()) savedBytes += stat.size;
      } else if (entry.isDirectory()) visit(file);
    }
  }
  visit(base);
  return { links, savedBytes };
}
if (require.main === module) {
  const { links, savedBytes } = validateResources(path.resolve(__dirname, '../../resources'));
  console.log(`Validated ${links} internal resource symlinks; avoiding ${(savedBytes / 1024 ** 2).toFixed(1)} MiB of duplicate library copies on macOS.`);
}
module.exports = { validateResources };
