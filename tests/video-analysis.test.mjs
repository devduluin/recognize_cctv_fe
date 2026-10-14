import assert from "node:assert/strict";
import { test } from "node:test";
import { validateVideo, videoTime, videoUploadUrl } from "../components/video-analysis-api.ts";

test("upload encodes filenames and sends explicit line and gender options", () => {
  const url = new URL(videoUploadUrl("https://api.test/api/v1/event_visitor", { name: "gate & in.mp4" }, { line_position: 0.4, line_orientation: "vertical", reverse_direction: true, gender_enabled: false }));
  assert.equal(url.searchParams.get("filename"), "gate & in.mp4");
  assert.equal(url.searchParams.get("line_position"), "0.4");
  assert.equal(url.searchParams.get("reverse_direction"), "true");
  assert.equal(url.searchParams.get("gender_enabled"), "false");
});

test("empty, unsupported and oversized videos are rejected before upload", () => {
  assert.match(validateVideo({ name: "test.mp4", size: 0 }, 100), /kosong/);
  assert.match(validateVideo({ name: "test.exe", size: 10 }, 100), /Pilih video/);
  assert.match(validateVideo({ name: "test.mp4", size: 101 }, 100), /maksimal/);
  assert.equal(validateVideo({ name: "test.MOV", size: 100 }, 100), "");
});

test("crossings display source video offsets", () => {
  assert.equal(videoTime(0), "00:00");
  assert.equal(videoTime(65.3), "01:05");
  assert.equal(videoTime(1800), "30:00");
});
