import { test } from "node:test";
import assert from "node:assert/strict";
import { connectStatusStream } from "../components/events/status-stream.ts";

function setup(refresh = async () => {}) {
  let time = 0;
  let id = 0;
  const timers = new Map();
  const listeners = {};
  const source = { close() { this.closed = true; }, addEventListener(name, fn) { listeners[name] = fn; } };
  let polls = 0;
  const disconnect = connectStatusStream({
    url: "local", refresh: (signal) => { polls++; return refresh(signal); }, receive: () => {},
    createStream: () => source, now: () => time,
    every: (fn, ms) => { timers.set(++id, {fn, ms}); return id; }, cancel: (id) => timers.delete(id),
  });
  return {source, listeners, timers, disconnect, get polls() { return polls; }, tick(ms) { time += ms; for (const t of [...timers.values()]) t.fn(); }};
}

test("reconnecting SSE starts fallback immediately and recovery stops it", async () => {
  const env = setup();
  env.source.onerror();
  assert.equal(env.polls, 1);
  assert.equal(env.timers.size, 2);
  env.source.onmessage({data: JSON.stringify({result: {in_count: 1}})});
  assert.equal(env.timers.size, 1);
  env.disconnect();
  assert.equal(env.timers.size, 0);
  assert.equal(env.source.closed, true);
});

test("a silent open stream triggers fallback but heartbeats prevent it", () => {
  const env = setup();
  env.tick(9000);
  env.listeners.heartbeat();
  env.tick(9000);
  assert.equal(env.polls, 0);
  env.tick(2000);
  assert.equal(env.polls, 1);
  env.disconnect();
});

test("slow fallback requests do not overlap and cleanup blocks callbacks", async () => {
  let finish;
  const env = setup(() => new Promise(resolve => {finish = resolve;}));
  env.source.onerror();
  env.tick(12000);
  assert.equal(env.polls, 1);
  env.disconnect();
  finish();
  await Promise.resolve();
  env.source.onerror();
  assert.equal(env.polls, 1);
  assert.equal(env.timers.size, 0);
});


test("recovery aborts a stale HTTP response before it can overwrite SSE", async () => {
  let signal;
  let finish;
  const env = setup((requestSignal) => {
    signal = requestSignal;
    return new Promise(resolve => { finish = resolve; });
  });
  env.source.onerror();
  assert.equal(signal.aborted, false);
  env.source.onmessage({data: JSON.stringify({result: {in_count: 2}})});
  assert.equal(signal.aborted, true);
  finish();
  env.disconnect();
});
