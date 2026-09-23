import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { clearDashboardProfileCache, dashboardProfileRequest } from "../components/dashboard-profile.ts";

let token;
let workspace;
let now;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const profile = { name: "Workspace A", logo: "" };
const response = (value = profile, status = 200) => new Response(
  JSON.stringify(status === 200 ? { result: { profile: value } } : { detail: "Try again" }),
  { status, headers: { "Content-Type": "application/json" } },
);
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  clearDashboardProfileCache();
  token = "test-account-a";
  workspace = "workspace-a";
  now = 1000;
  mock.method(Date, "now", () => now);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key) => key === "auth_token" ? token : JSON.stringify({ id: "test-user", company_id: workspace }) },
  });
});

afterEach(() => {
  mock.restoreAll();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

test("concurrent consumers and navigation share one request", async () => {
  const pending = deferred();
  const fetch = mock.method(globalThis, "fetch", () => pending.promise);
  const first = dashboardProfileRequest();
  const second = dashboardProfileRequest();
  assert.equal(fetch.mock.callCount(), 1);
  pending.resolve(response());
  assert.deepEqual(await first, profile);
  assert.deepEqual(await second, profile);
  for (let i = 0; i < 10; i++) assert.deepEqual(await dashboardProfileRequest(), profile);
  assert.equal(fetch.mock.callCount(), 1);
});

test("unmounting one consumer does not cancel another consumer", async () => {
  const pending = deferred();
  const fetch = mock.method(globalThis, "fetch", () => pending.promise);
  const controller = new AbortController();
  const first = dashboardProfileRequest(undefined, controller.signal);
  const second = dashboardProfileRequest();
  controller.abort();
  const rejected = assert.rejects(first, { name: "AbortError" });
  pending.resolve(response());
  await rejected;
  assert.deepEqual(await second, profile);
  assert.equal(fetch.mock.callCount(), 1);
});

test("cached reads expire after one minute", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => response());
  await dashboardProfileRequest();
  now += 59_999;
  await dashboardProfileRequest();
  assert.equal(fetch.mock.callCount(), 1);
  now++;
  await dashboardProfileRequest();
  assert.equal(fetch.mock.callCount(), 2);
});

test("account changes, workspace changes and logout invalidate cached reads", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => response());
  await dashboardProfileRequest();
  token = "test-account-b";
  await dashboardProfileRequest();
  workspace = "workspace-b";
  await dashboardProfileRequest();
  clearDashboardProfileCache();
  await dashboardProfileRequest();
  assert.equal(fetch.mock.callCount(), 4);
});

test("saving replaces cached data and a stale read cannot overwrite it", async () => {
  const oldRead = deferred();
  const save = deferred();
  const fetch = mock.method(globalThis, "fetch", (_url, options) => options.method === "PUT" ? save.promise : oldRead.promise);
  const initial = dashboardProfileRequest();
  const updated = { name: "Updated workspace", logo: "new-logo" };
  const saving = dashboardProfileRequest(updated);
  const duringSave = dashboardProfileRequest();
  assert.equal(fetch.mock.callCount(), 2);
  save.resolve(response(updated));
  assert.deepEqual(await saving, updated);
  assert.deepEqual(await duringSave, updated);
  oldRead.resolve(response());
  await initial;
  assert.deepEqual(await dashboardProfileRequest(), updated);
  assert.equal(fetch.mock.callCount(), 2);
});

test("failed reads are not cached", async () => {
  const fetch = mock.method(globalThis, "fetch", async () => response(null, 429));
  await assert.rejects(dashboardProfileRequest(), /Try again/);
  fetch.mock.mockImplementation(async () => response());
  assert.deepEqual(await dashboardProfileRequest(), profile);
  assert.equal(fetch.mock.callCount(), 2);
});

test("aborting a cached consumer prevents delivery", async () => {
  mock.method(globalThis, "fetch", async () => response());
  await dashboardProfileRequest();
  const controller = new AbortController();
  const read = dashboardProfileRequest(undefined, controller.signal);
  controller.abort();
  await assert.rejects(read, { name: "AbortError" });
});
