const fs = require('node:fs');
const path = require('node:path');

function ensureNpmOnPath(env = process.env, nodeExecutable = process.execPath, platform = process.platform) {
  const nodeBin = path.dirname(nodeExecutable);
  const npmNames = platform === 'win32' ? ['npm.cmd', 'npm.exe'] : ['npm'];
  const currentPath = env.PATH || env.Path || '';
  const directories = currentPath.split(path.delimiter).filter(Boolean);
  const normalized = directory => path.resolve(directory).toLowerCase();
  const existing = new Set(directories.map(normalized));
  const additions = [];

  if (npmNames.some(name => fs.existsSync(path.join(nodeBin, name))) && !existing.has(normalized(nodeBin))) {
    additions.push(nodeBin);
    existing.add(normalized(nodeBin));
  }
  // Native packaging delegates macOS signing to codesign in /usr/bin. Some
  // GUI-launched npm environments omit the system tool directories from PATH.
  if (platform === 'darwin' || platform === 'linux') {
    for (const directory of ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
      if (fs.existsSync(directory) && !existing.has(normalized(directory))) {
        additions.push(directory);
        existing.add(normalized(directory));
      }
    }
  }
  if (additions.length === 0) return env;

  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  return { ...env, [pathKey]: [...additions, ...directories].join(path.delimiter) };
}

module.exports = { ensureNpmOnPath };
