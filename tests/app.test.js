import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createApp } from "../server/app.js";

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "ytso-app-test-"));
  await mkdir(path.join(directory, "assets"));
  await writeFile(
    path.join(directory, "index.html"),
    '<!doctype html><title>YTSO test</title><div id="root"></div>',
  );
  await writeFile(
    path.join(directory, "assets", "app-test.js"),
    "console.log('asset');",
  );
  const app = createApp({
    distDirectory: directory,
    environment: "production",
    ...options,
  });
  const listener = app.listen(0, "127.0.0.1");
  await once(listener, "listening");
  t.after(async () => {
    const closed = new Promise((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
    listener.closeAllConnections();
    await closed;
    // Restrict recursive cleanup to the test's uniquely created temporary folder.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("ytso-app-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  return (url, init) =>
    fetch(`http://127.0.0.1:${listener.address().port}${url}`, init);
}

test("production API and SPA routes work with preserved and stripped prefixes", async (t) => {
  const router = express.Router();
  router.get("/categories", (_req, res) => res.json([{ _id: "category-id" }]));
  const request = await fixture(t, { apiRouter: router });
  for (const url of ["/ytso/api/categories", "/api/categories"]) {
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ _id: "category-id" }]);
  }
  for (const url of [
    "/ytso/",
    "/ytso/categories/category-id",
    "/",
    "/categories/category-id",
  ]) {
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /YTSO test/);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  }
  for (const url of ["/ytso/assets/app-test.js", "/assets/app-test.js"]) {
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /immutable/);
    assert.match(await response.text(), /console.log/);
  }
});

test("unknown APIs and missing assets do not return the SPA HTML", async (t) => {
  const request = await fixture(t);
  for (const url of [
    "/ytso/api/missing",
    "/api/missing",
    "/ytso/assets/missing.js",
    "/assets/missing.css",
  ]) {
    const response = await request(url, { headers: { Accept: "text/html" } });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.ok((await response.json()).error);
  }
});

test("security headers and compression apply before API and static handlers", async (t) => {
  const router = express.Router();
  router.get("/large", (_req, res) =>
    res.json({ content: "test content ".repeat(500) }),
  );
  const request = await fixture(t, { apiRouter: router });
  for (const url of ["/ytso/", "/ytso/assets/app-test.js", "/ytso/api/large"]) {
    const response = await request(url, {
      headers: { "Accept-Encoding": "gzip" },
    });
    const csp = response.headers.get("content-security-policy");
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.doesNotMatch(csp, /unsafe-eval/);
    assert.match(csp, /frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/);
    assert.match(csp, /img-src[^;]*https:\/\/yt3\.googleusercontent\.com/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(
      response.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
    );
    assert.equal(response.headers.get("x-powered-by"), null);
    if (url.endsWith("/large"))
      assert.equal(response.headers.get("content-encoding"), "gzip");
    await response.text();
  }
});

test("readiness reflects database availability without exposing configuration", async (t) => {
  let ready = true;
  const request = await fixture(t, { readiness: () => ready });
  const healthy = await request("/ytso/health");
  assert.equal(healthy.status, 200);
  assert.deepEqual(await healthy.json(), { status: "ok", releaseId: null });
  assert.equal(healthy.headers.get("cache-control"), "no-store");
  ready = false;
  const unavailable = await request("/health");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    status: "unavailable",
    releaseId: null,
  });
});

test("readiness identifies the deployed release on both health routes", async (t) => {
  const releaseId = "1234567890abcdef1234567890abcdef12345678";
  const request = await fixture(t, { releaseId });
  for (const url of ["/health", "/ytso/health"]) {
    const response = await request(url, {
      headers: { Accept: "application/json" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), { status: "ok", releaseId });
  }
});

test("failed authentication is limited across API aliases without limiting pages or ordinary APIs", async (t) => {
  const router = express.Router();
  router.post("/auth", (_req, res) =>
    res.status(400).json({ error: "Invalid credentials." }),
  );
  router.get("/subs", (_req, res) => res.json([]));
  const request = await fixture(t, { apiRouter: router });
  for (let index = 0; index < 20; index += 1) {
    const prefix = index % 2 ? "/api" : "/ytso/api";
    const response = await request(`${prefix}/auth`, { method: "POST" });
    assert.equal(response.status, 400);
    await response.text();
  }
  const limited = await request("/ytso/api/auth", { method: "POST" });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  assert.ok((await limited.json()).error);
  for (const url of [
    "/ytso/",
    "/ytso/assets/app-test.js",
    "/ytso/api/subs",
    "/health",
  ]) {
    const response = await request(url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("ratelimit"), null);
    await response.text();
  }
});

test("malformed JSON receives a useful API error rather than an HTML error page", async (t) => {
  const request = await fixture(t);
  const response = await request("/ytso/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request body." });
});
