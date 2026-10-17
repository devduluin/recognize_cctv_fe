const config = require('./desktop.config.json');
const release = process.env.DESKTOP_RELEASE === 'true';
module.exports = {
  appId: 'com.duluin.visitorcounter', productName: 'Visitor Counter',
  directories: { output: 'dist-desktop' },
  files: ['electron/**', 'scripts/desktop/window-smoke.cjs', 'package.json', '!**/.env*'],
  extraResources: [
    { from: 'resources/backend', to: 'backend' }, { from: 'resources/next', to: 'next' },
    { from: 'resources/node', to: 'node' }, { from: 'resources/media', to: 'media' },
    { from: 'resources/build-manifest.json', to: 'build-manifest.json' },
  ],
  // afterPack modifies Mach-O UUIDs, invalidating Electron's original signature.
  // Never emit a macOS bundle without signing those launchers again.
  asar: true, forceCodeSigning: process.platform === 'darwin' || release || process.env.DESKTOP_REQUIRE_SIGNING === 'true',
  extraMetadata: { desktopRelease: release },
  artifactName: 'Visitor-Counter-${version}-${os}-${arch}.${ext}',
  publish: [{ provider: 'github', owner: config.releaseOwner, repo: config.releaseRepository, releaseType: 'draft' }],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], signtoolOptions: { publisherName: config.windowsPublisherName } },
  linux: { target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }], category: 'Utility', maintainer: 'Duluin', executableName: 'visitor-counter', icon: 'electron/linux-icon.png' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
  mac: { target: ['dmg', 'zip'], category: 'public.app-category.business', hardenedRuntime: true,
    extendInfo: { NSLocalNetworkUsageDescription: 'Visitor Counter memerlukan akses jaringan lokal untuk terhubung ke kamera CCTV dan NVR melalui RTSP.' },
    entitlements: 'electron/entitlements.mac.plist', entitlementsInherit: 'electron/entitlements.mac.plist',
    // Local signing is for development/testing and avoids a network timestamp
    // request for every bundled native library. Official releases retain Apple's
    // default timestamp service and notarization requirements.
    timestamp: release ? undefined : 'none',
    notarize: release, binaries: ['Contents/Resources/node/node', 'Contents/Resources/backend/visitor-backend', 'Contents/Resources/media/mediamtx', 'Contents/Resources/media/ffmpeg'],
  },
  afterPack: 'scripts/desktop/verify-package.cjs',
};
