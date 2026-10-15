const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfig({ release, requireSigning }) {
  const priorRelease = process.env.DESKTOP_RELEASE;
  const priorRequireSigning = process.env.DESKTOP_REQUIRE_SIGNING;
  process.env.DESKTOP_RELEASE = release ? 'true' : 'false';
  process.env.DESKTOP_REQUIRE_SIGNING = requireSigning ? 'true' : 'false';
  try {
    delete require.cache[require.resolve('../electron-builder.cjs')];
    return require('../electron-builder.cjs');
  } finally {
    if (priorRelease === undefined) delete process.env.DESKTOP_RELEASE;
    else process.env.DESKTOP_RELEASE = priorRelease;
    if (priorRequireSigning === undefined) delete process.env.DESKTOP_REQUIRE_SIGNING;
    else process.env.DESKTOP_REQUIRE_SIGNING = priorRequireSigning;
  }
}

test('local signed builds disable remote timestamp requests', () => {
  const config = loadConfig({ release: false, requireSigning: true });
  assert.equal(config.forceCodeSigning, true);
  assert.equal(config.mac.timestamp, 'none');
  assert.equal(config.mac.notarize, false);
});

test('official releases keep Apple timestamping, signing, and notarization', () => {
  const config = loadConfig({ release: true, requireSigning: false });
  assert.equal(config.forceCodeSigning, true);
  assert.equal(config.mac.timestamp, undefined);
  assert.equal(config.mac.notarize, true);
});
