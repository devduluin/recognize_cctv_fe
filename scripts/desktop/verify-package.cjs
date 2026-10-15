const fs = require('node:fs');
const path = require('node:path');
module.exports = async context => {
  const root = context.electronPlatformName === 'darwin' ? path.join(context.appOutDir, 'Visitor Counter.app/Contents/Resources') : path.join(context.appOutDir, 'resources');
  const win = context.electronPlatformName === 'win32';
  // Also handle resources staged by older builds, which preserved public asset
  // symlinks pointing outside the app. Signing requires a self-contained bundle.
  const sourcePublic = path.join(context.packager.projectDir, 'resources/next/public');
  if (fs.existsSync(sourcePublic)) {
    const packagedPublic = path.join(root, 'next/public');
    fs.rmSync(packagedPublic, { recursive: true, force: true });
    fs.cpSync(sourcePublic, packagedPublic, { recursive: true, dereference: true });
  }
  // electron-builder filters nested node_modules from extraResources. Next's
  // standalone server needs its traced packages at runtime, so restore them.
  const sourceNextModules = path.join(context.packager.projectDir, 'resources/next/node_modules');
  const packagedNextModules = path.join(root, 'next/node_modules');
  if (fs.existsSync(sourceNextModules) && !fs.existsSync(path.join(packagedNextModules, 'next/package.json'))) {
    fs.cpSync(sourceNextModules, packagedNextModules, { recursive: true, dereference: true });
  }
  for (const file of [`backend/visitor-backend${win ? '.exe' : ''}`, `node/node${win ? '.exe' : ''}`, `media/ffmpeg${win ? '.exe' : ''}`, `media/mediamtx${win ? '.exe' : ''}`, 'next/server.js', 'next/.next/BUILD_ID', 'next/node_modules/next/package.json']) {
    if (!fs.existsSync(path.join(root, file))) throw new Error(`Packaged resource missing: ${file}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build-manifest.json'), 'utf8'));
  if (manifest.version !== context.packager.appInfo.version || manifest.platform !== context.electronPlatformName) throw new Error('Packaged runtime/version mismatch.');
  if (!/^\d{6}$/.test(String(manifest.buildNumber || ''))) throw new Error('Packaged runtime is missing its six-digit build number.');
  function inspect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.env') || ['jwt-secret', 'visitor.sqlite'].includes(entry.name)) throw new Error(`Private runtime data in installer: ${entry.name}`);
      if (entry.isSymbolicLink()) {
        const file = path.join(directory, entry.name);
        const target = fs.readlinkSync(file);
        let resolved;
        try { resolved = fs.realpathSync(file); }
        catch { throw new Error(`Broken packaged symlink: ${file} -> ${target}`); }
        const relative = path.relative(fs.realpathSync(root), resolved);
        if (path.isAbsolute(target) || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          throw new Error(`Invalid packaged symlink: ${file} -> ${target}`);
        }
      }
      if (entry.isDirectory()) inspect(path.join(directory, entry.name));
    }
  }
  inspect(root);
};
