import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { visitorFetch } from "../components/auth/visitor-api.ts";
import { consumeCameraFrames } from "../components/camera-frames.ts";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
afterEach(() => {
  mock.restoreAll();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

test("visitor requests preserve body, headers, and cancellation while adding Bearer auth", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { getItem: () => "visitor-token" },
  });
  const fetch = mock.method(globalThis, "fetch", async () => new Response());
  const controller = new AbortController();
  await visitorFetch("/api/v1/event_visitor/start", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: "{}", signal: controller.signal,
  });
  const [url, init] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/v1/event_visitor/start");
  assert.equal(init.headers.get("Authorization"), "Bearer visitor-token");
  assert.equal(init.headers.get("Content-Type"), "application/json");
  assert.equal(init.body, "{}");
  assert.equal(init.signal, controller.signal);
});

test("missing login rejects without sending an unauthenticated request", async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { getItem: () => null },
  });
  const fetch = mock.method(globalThis, "fetch");
  await assert.rejects(visitorFetch("/api/v1/events"), /masuk kembali/);
  assert.equal(fetch.mock.callCount(), 0);
});

function packet(bytes) {
  const output = new Uint8Array(4 + bytes.length);
  new DataView(output.buffer).setUint32(0, bytes.length);
  output.set(bytes, 4);
  return output;
}

test("stream decodes fragmented headers and multiple frames and cancels on unmount", async () => {
  const controller = new AbortController();
  const bytes = new Uint8Array([...packet([1, 2, 3]), ...packet([4, 5])]);
  let cancelled = false;
  const body = new ReadableStream({
    start(stream) {
      for (const [start, end] of [[0, 1], [1, 3], [3, 5], [5, 8], [8, bytes.length]]) {
        stream.enqueue(bytes.slice(start, end));
      }
    },
    cancel() { cancelled = true; },
  });
  const frames = [];
  await consumeCameraFrames(new Response(body, {
    headers: { "Content-Type": "application/x-camera-frames" },
  }), controller.signal, async (jpeg) => {
    frames.push(Array.from(jpeg));
    if (frames.length === 2) controller.abort();
  });
  assert.deepEqual(frames, [[1, 2, 3], [4, 5]]);
  assert.equal(cancelled, true);
});

test("invalid frame lengths and truncated streams fail instead of buffering forever", async () => {
  for (const size of [0, 8 * 1024 * 1024 + 1]) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, size);
    await assert.rejects(consumeCameraFrames(new Response(bytes, {
      headers: { "Content-Type": "application/x-camera-frames" },
    }), new AbortController().signal, async () => {}), /tidak valid/);
  }
  await assert.rejects(consumeCameraFrames(new Response(packet([1, 2]).slice(0, 5), {
    headers: { "Content-Type": "application/x-camera-frames" },
  }), new AbortController().signal, async () => {}), /terputus/);
});

test("expired authentication and unexpected content types do not decode as video", async () => {
  for (const response of [new Response("Unauthorized", { status: 401 }), new Response("html")]) {
    await assert.rejects(consumeCameraFrames(
      response, new AbortController().signal, async () => assert.fail("Unexpected frame"),
    ), /tidak tersedia/);
  }
});
