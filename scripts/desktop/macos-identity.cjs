const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

// macOS Local Network privacy identifies executables by LC_UUID. Electron's
// prebuilt launchers share it across applications: electron-builder#10297.
// Run only on staged launchers, before signing; leave Electron Framework alone.
function uniqueMachOUuids(input, identity) {
  if (!identity) throw new Error('Missing application executable identity');
  const output = Buffer.from(input);
  function slice(start, size) {
    const end = start + size;
    if (!Number.isSafeInteger(end) || start < 0 || size < 32 || end > output.length) throw new Error('Invalid Mach-O slice');
    const magic = output.readUInt32BE(start);
    const little = magic === 0xcffaedfe || magic === 0xcefaedfe;
    if (![0xcffaedfe, 0xcefaedfe, 0xfeedfacf, 0xfeedface].includes(magic)) throw new Error('Unsupported Mach-O header');
    const read = offset => little ? output.readUInt32LE(offset) : output.readUInt32BE(offset);
    const headerSize = magic === 0xcffaedfe || magic === 0xfeedfacf ? 32 : 28;
    const count = read(start + 16);
    const commandsEnd = start + headerSize + read(start + 20);
    if (commandsEnd > end) throw new Error('Truncated Mach-O commands');
    let cursor = start + headerSize;
    let found = false;
    for (let i = 0; i < count; i++) {
      if (cursor + 8 > commandsEnd) throw new Error('Truncated Mach-O command');
      const command = read(cursor), length = read(cursor + 4);
      if (length < 8 || cursor + length > commandsEnd) throw new Error('Invalid Mach-O command length');
      if (command === 0x1b) {
        if (found || length !== 24) throw new Error('Invalid Mach-O UUID command');
        const uuid = createHash('sha256').update(`${identity}:${read(start + 4)}:${read(start + 8)}`).digest().subarray(0, 16);
        uuid[6] = (uuid[6] & 15) | 0x50;
        uuid[8] = (uuid[8] & 63) | 0x80;
        uuid.copy(output, cursor + 8);
        found = true;
      }
      cursor += length;
    }
    if (!found || cursor !== commandsEnd) throw new Error('Missing UUID or malformed Mach-O commands');
  }
  if (output.length < 4) throw new Error('Truncated Mach-O header');
  const magic = output.readUInt32BE(0);
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    if (output.length < 8) throw new Error('Truncated universal Mach-O header');
    const count = output.readUInt32BE(4), stride = magic === 0xcafebabf ? 32 : 20;
    const tableEnd = 8 + count * stride;
    if (!count || tableEnd > output.length) throw new Error('Invalid universal Mach-O table');
    const ranges = [];
    for (let i = 0; i < count; i++) {
      const entry = 8 + i * stride;
      const offset = stride === 32 ? Number(output.readBigUInt64BE(entry + 8)) : output.readUInt32BE(entry + 8);
      const size = stride === 32 ? Number(output.readBigUInt64BE(entry + 16)) : output.readUInt32BE(entry + 12);
      if (offset < tableEnd || ranges.some(([a, b]) => offset < b && offset + size > a)) throw new Error('Overlapping Mach-O slices');
      slice(offset, size);
      ranges.push([offset, offset + size]);
    }
  } else slice(0, output.length);
  return output;
}

function prepareMacIdentity(appPath, appId) {
  const launchers = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.framework')) continue;
        visit(file);
      } else if (entry.isFile() && path.basename(directory) === 'MacOS') {
        const identity = `${appId}:${path.relative(appPath, file).split(path.sep).join('/')}`;
        launchers.push([file, uniqueMachOUuids(fs.readFileSync(file), identity)]);
      }
    }
  }
  visit(appPath);
  if (!launchers.length) throw new Error('No packaged macOS launchers found');
  // Validate all launchers before changing any file. writeFile preserves mode.
  for (const [file, contents] of launchers) fs.writeFileSync(file, contents);
  console.log(`Assigned application-specific Mach-O UUIDs to ${launchers.length} macOS launchers before signing.`);
}
module.exports = { uniqueMachOUuids, prepareMacIdentity };
