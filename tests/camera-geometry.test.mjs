import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../components/camera/counting-line-geometry.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleResult = { exports: {} };
vm.runInNewContext(compiled, { module: moduleResult, exports: moduleResult.exports });
const { countingLineGeometry, containedVideoRect } = moduleResult.exports;

test("overlays stay inside the picture instead of stretching across letterboxing", () => {
  const rect = containedVideoRect(320, 320, 1920, 1080);
  assert.equal(rect.left, 0);
  assert.equal(rect.top, 70);
  assert.equal(rect.width, 320);
  assert.equal(rect.height, 180);
  const portrait = containedVideoRect(640, 360, 720, 1280);
  assert.equal(portrait.top, 0);
  assert.equal(portrait.height, 360);
  assert.equal(portrait.width, 202.5);
  assert.equal(portrait.left, 218.75);
  assert.equal(containedVideoRect(320, 320, 0, 0), null);
});

test("fullscreen resize preserves normalized boundary locations", () => {
  const normal = containedVideoRect(640, 360, 1920, 1080);
  const fullscreen = containedVideoRect(1920, 1200, 1920, 1080);
  const line = countingLineGeometry(1920, 1080, { linePosition: 0.43, lineOrientation: "vertical" }).lines[0];
  const ratio = line.labelPoint.x / 1920;
  assert.equal((normal.left + ratio * normal.width - normal.left) / normal.width, ratio);
  assert.equal((fullscreen.left + ratio * fullscreen.width - fullscreen.left) / fullscreen.width, ratio);
});

test("tilted, mirrored boundaries retain their offsets and swap visible direction", () => {
  const config = { linePosition: 0.43, lineAngle: 30, lineOrientation: "vertical", twoLineCounting: true };
  const normal = countingLineGeometry(1280, 720, config);
  const mirrored = countingLineGeometry(1280, 720, { ...config, mirror: true });
  for (let i = 0; i < 2; i++) {
    assert.equal(mirrored.lines[i].start.x, 1279 - normal.lines[i].start.x);
    assert.equal(mirrored.lines[i].start.y, normal.lines[i].start.y);
    assert.equal(mirrored.lines[i].offset, normal.lines[i].offset);
  }
  assert.notEqual(normal.lines[0].start.x, normal.lines[0].end.x);
  assert.equal(normal.entryArrow, "→");
  assert.equal(mirrored.entryArrow, "←");
});

test("off-center zones clamp boundaries like the backend", () => {
  const geometry = countingLineGeometry(853, 479, { linePosition: 0.01, zoneWidthRatio: 0.5 });
  assert.equal(geometry.lines[0].offset, -4);
  assert.equal(geometry.lines[1].offset, 119);
  assert.equal(countingLineGeometry(853, 479, { twoLineCounting: false }).lines.length, 1);
});

if (process.env.COUNTING_GEOMETRY_FIXTURES) {
  test("frontend endpoints agree with Python counting geometry across camera configurations", () => {
    const fixtures = JSON.parse(fs.readFileSync(process.env.COUNTING_GEOMETRY_FIXTURES, "utf8"));
    for (const fixture of fixtures) {
      const geometry = countingLineGeometry(fixture.width, fixture.height, fixture.config);
      assert.equal(geometry.lines.length, fixture.lines.length);
      geometry.lines.forEach((line, index) => {
        const expected = fixture.lines[index];
        assert.equal(line.offset, expected.offset);
        for (const endpoint of ["start", "end"]) for (const axis of ["x", "y"]) {
          assert.ok(Math.abs(line[endpoint][axis] - expected[endpoint][axis]) <= 1, JSON.stringify(fixture));
        }
      });
    }
  });
}
