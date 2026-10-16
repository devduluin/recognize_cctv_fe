const { test } = require('node:test');
const assert = require('node:assert/strict');
const { uniqueMachOUuids } = require('../scripts/desktop/macos-identity.cjs');

function thin(cpu = 0x100000c) {
  const data = Buffer.alloc(64, 0);
  data.writeUInt32LE(0xfeedfacf, 0);
  data.writeUInt32LE(cpu, 4);
  data.writeUInt32LE(1, 16);
  data.writeUInt32LE(24, 20);
  data.writeUInt32LE(0x1b, 32);
  data.writeUInt32LE(24, 36);
  data.fill(17, 40, 56);
  return data;
}
test('UUIDs are application/launcher/architecture specific and idempotent; other bytes stay intact', () => {
  const original = thin();
  const changed = uniqueMachOUuids(original, 'com.example.app:main');
  assert.deepEqual(original, thin());
  assert.notDeepEqual(changed.subarray(40, 56), original.subarray(40, 56));
  assert.deepEqual(changed.subarray(0, 40), original.subarray(0, 40));
  assert.deepEqual(changed.subarray(56), original.subarray(56));
  assert.deepEqual(uniqueMachOUuids(changed, 'com.example.app:main'), changed);
  for (const [input, identity] of [[original, 'com.other.app:main'], [original, 'com.example.app:helper'], [thin(0x1000007), 'com.example.app:main']]) {
    assert.notDeepEqual(uniqueMachOUuids(input, identity).subarray(40, 56), changed.subarray(40, 56));
  }
});
for (const wide of [false, true]) test(`universal ${wide ? 64 : 32} bit table updates both architectures`, () => {
  const data = Buffer.alloc(256);
  data.writeUInt32BE(wide ? 0xcafebabf : 0xcafebabe, 0);
  data.writeUInt32BE(2, 4);
  for (let i = 0; i < 2; i++) {
    const entry = 8 + i * (wide ? 32 : 20), offset = 80 + i * 80;
    if (wide) {
      data.writeBigUInt64BE(BigInt(offset), entry + 8);
      data.writeBigUInt64BE(64n, entry + 16);
    } else {
      data.writeUInt32BE(offset, entry + 8);
      data.writeUInt32BE(64, entry + 12);
    }
    thin(i ? 0x1000007 : 0x100000c).copy(data, offset);
  }
  const changed = uniqueMachOUuids(data, 'app:main');
  assert.deepEqual(changed.subarray(80, 144), uniqueMachOUuids(data.subarray(80, 144), 'app:main'));
  assert.deepEqual(changed.subarray(160, 224), uniqueMachOUuids(data.subarray(160, 224), 'app:main'));
});
test('malformed binaries fail without modifying input', () => {
  for (const bad of [Buffer.alloc(0), Buffer.alloc(64), thin().subarray(0, 48)]) assert.throws(() => uniqueMachOUuids(bad, 'app'));
  const bad = thin();
  bad.writeUInt32LE(0, 36);
  const before = Buffer.from(bad);
  assert.throws(() => uniqueMachOUuids(bad, 'app'));
  assert.deepEqual(bad, before);
});
