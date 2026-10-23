// Production-only PWA lifecycle checks. No live MongoDB or YouTube access.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { build } from "vite";
import { createApp } from "../server/app.js";
import { CDP, chromeExecutable } from "./browser-helpers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(tmpdir(), "ytso-pwa-test-"));
const profile = path.join(temporary, "profile");
const output = process.env.QA_OUTPUT_DIR || path.join(temporary, "report");
await mkdir(output, { recursive: true });
const report = { checks: [], runtimeErrors: [], screenshots: [] };
const servers = [];
const browsers = [];
let chrome;
let browser;
let debugPort;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, label, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function check(label, action) {
  await action();
  report.checks.push(label);
  console.log(`PASS ${label}`);
}
async function connect(targetId) {
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/list`)
  ).json();
  const target = targetId
    ? targets.find((item) => item.id === targetId)
    : targets.find((item) => item.type === "page");
  const connection = new CDP(target.webSocketDebuggerUrl);
  browsers.push(connection);
  await connection.connect();
  connection.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    report.runtimeErrors.push(
      exceptionDetails.exception?.description || exceptionDetails.text,
    );
  });
  await Promise.all([
    connection.send("Page.enable"),
    connection.send("Runtime.enable"),
    connection.send("Network.enable"),
  ]);
  // Tests never contact YouTube, thumbnail hosts, or any external account.
  await connection.send("Network.setBlockedURLs", {
    urls: ["https://*", "http://images.invalid/*"],
  });
  return connection;
}
async function navigate(connection, url, heading) {
  await connection.send("Page.navigate", { url });
  await until(
    () =>
      connection.evaluate(
        `location.href === ${JSON.stringify(url)} && !!document.querySelector('main')`,
      ),
    "navigation",
  );
  if (heading)
    await until(
      () =>
        connection.evaluate(
          `document.querySelector('h1')?.textContent === ${JSON.stringify(heading)}`,
        ),
      heading,
    );
}
async function text(connection, value) {
  await until(
    () =>
      connection.evaluate(
        `document.body.innerText.includes(${JSON.stringify(value)})`,
      ),
    value,
  );
}
async function offline(connection, value) {
  await connection.send("Network.emulateNetworkConditions", {
    offline: value,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await until(
    () => connection.evaluate(`navigator.onLine === ${!value}`),
    `online=${!value}`,
  );
}
async function cacheEntries(connection) {
  return connection.evaluate(`(async () => {
    const entries = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) {
      entries.push({name, url:request.url, token:request.headers.get('x-auth-token')});
    }
    return entries;
  })()`);
}
async function screenshot(connection, name) {
  const result = await connection.send("Page.captureScreenshot", {
    format: "png",
  });
  const filename = path.join(output, `${name}.png`);
  await writeFile(filename, Buffer.from(result.data, "base64"));
  report.screenshots.push(filename);
}

const sessionToken = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ _id: "507f1f77bcf86cd799439000", name: "PWA Tester", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
const categoryId = "507f1f77bcf86cd799439011";
async function fixture(stripPrefix, releaseA, releaseB) {
  let release = "a";
  let networkAvailable = true;
  let unavailableAsset = "";
  const requests = [];
  const router = express.Router();
  router.post("/auth", (_req, res) => res.json({ token: sessionToken }));
  router.get("/subs", (_req, res) =>
    res.json([
      {
        channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
        subName: "Private fixture channel",
        channelDesc: "Private account data",
        channelThumbnails: {},
      },
    ]),
  );
  router.get("/categories", (_req, res) =>
    res.json([
      { _id: categoryId, categoryName: "Private fixture category", subs: [] },
    ]),
  );
  router.get("/categories/subs", (_req, res) =>
    res.json({
      _id: categoryId,
      categoryName: "Private fixture category",
      subs: [],
    }),
  );
  const apps = Object.fromEntries(
    [
      ["a", releaseA],
      ["b", releaseB],
    ].map(([key, directory]) => [
      key,
      createApp({
        environment: "production",
        distDirectory: directory,
        apiRouter: router,
      }),
    ]),
  );
  const server = createServer((req, res) => {
    requests.push({ url: req.url, method: req.method });
    // Also block the server during offline checks: a worker cannot pass by
    // making its own network request outside the page's emulated connection.
    if (!networkAvailable) {
      req.socket.destroy();
      return;
    }
    if (unavailableAsset && req.url.split("?")[0] === unavailableAsset) {
      res.writeHead(503, { "Cache-Control": "no-store" });
      res.end("Incomplete test release");
      return;
    }
    if (stripPrefix && req.url.startsWith("/ytso/")) req.url = req.url.slice(5);
    apps[release](req, res);
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    update: () => {
      release = "b";
    },
    network: (value) => {
      networkAvailable = value;
    },
    failAsset: (value) => {
      unavailableAsset = value;
    },
    requests,
  };
}

try {
  const releaseA = path.join(temporary, "release-a");
  const releaseB = path.join(temporary, "release-b");
  await cp(path.join(root, "dist"), releaseA, { recursive: true });
  await check(
    "Built manifest, base paths, branding, and PNG dimensions are valid",
    async () => {
      const html = await readFile(path.join(releaseA, "index.html"), "utf8");
      assert.match(html, /rel="manifest" href="\/ytso\/manifest.webmanifest"/);
      assert.match(html, /href="\/ytso\/favicon.ico"/);
      const manifest = JSON.parse(
        await readFile(path.join(releaseA, "manifest.webmanifest"), "utf8"),
      );
      assert.equal(manifest.name, "YouTube Subscription Organizer");
      assert.equal(manifest.short_name, "YTSO");
      for (const key of ["id", "start_url", "scope"])
        assert.equal(manifest[key], "/ytso/");
      assert.equal(manifest.display, "standalone");
      for (const key of ["theme_color", "background_color"])
        assert.equal(manifest[key], "#101715");
      assert.deepEqual(
        manifest.icons.map((icon) => [icon.sizes, icon.purpose]),
        [
          ["192x192", "any"],
          ["512x512", "any"],
          ["512x512", "maskable"],
        ],
      );
      for (const icon of manifest.icons) {
        assert.equal(icon.type, "image/png");
        assert.ok(icon.src.startsWith("/ytso/icons/"));
        const png = await readFile(
          path.join(releaseA, icon.src.slice("/ytso/".length)),
        );
        assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.equal(
          `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,
          icon.sizes,
        );
        assert.equal(png[25], 2, "Icons are opaque RGB PNGs");
      }
    },
  );
  // Build a genuinely different release without changing any workspace files.
  await build({
    configFile: path.join(root, "vite.config.ts"),
    logLevel: "warn",
    build: { outDir: releaseB, emptyOutDir: true },
    plugins: [
      {
        name: "pwa-test-second-release",
        transform(code, id) {
          if (
            id
              .replaceAll("\\", "/")
              .endsWith("/src/features/categories/CategoriesPage.tsx")
          )
            return code.replace("Your categories", "Updated categories");
        },
        transformIndexHtml(html) {
          return html.replace(
            "<head>",
            '<head><meta name="pwa-test-release" content="b">',
          );
        },
      },
    ],
  });
  chrome = spawn(
    chromeExecutable(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--disable-default-apps",
      "--metrics-recording-only",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  let launchError;
  chrome.on("error", (error) => {
    launchError = error;
  });
  await until(async () => {
    if (launchError) throw launchError;
    try {
      debugPort = Number(
        (
          await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
        ).split("\n")[0],
      );
      return !!debugPort;
    } catch {
      return false;
    }
  }, "Chrome debugger");
  browser = await connect();

  for (const stripPrefix of [false, true]) {
    const server = await fixture(stripPrefix, releaseA, releaseB);
    const { origin } = server;
    const label = stripPrefix
      ? "stripped proxy prefix"
      : "preserved proxy prefix";
    await check(
      `Production registration, scope, manifest, MIME types and no-store API (${label})`,
      async () => {
        for (const [file, type] of [
          ["sw.js", /javascript/],
          ["manifest.webmanifest", /application\/manifest\+json/],
        ]) {
          const response = await fetch(`${origin}/ytso/${file}`);
          assert.equal(response.status, 200);
          assert.match(response.headers.get("content-type"), type);
          assert.match(response.headers.get("cache-control"), /no-cache/);
          await response.text();
        }
        await browser.send("Network.setCookie", {
          name: "x-auth-token",
          value: sessionToken,
          url: `${origin}/ytso/`,
          path: "/ytso",
        });
        await navigate(browser, `${origin}/ytso/channels`, "Channels");
        await text(browser, "Private fixture channel");
        await until(
          () => browser.evaluate("!!navigator.serviceWorker.controller"),
          "controlling service worker",
        );
        const registration = await browser.evaluate(
          "navigator.serviceWorker.ready.then(r=>({scope:r.scope,url:r.active.scriptURL}))",
        );
        assert.deepEqual(registration, {
          scope: `${origin}/ytso/`,
          url: `${origin}/ytso/sw.js`,
        });
        const appManifest = await browser.send("Page.getAppManifest");
        assert.equal(appManifest.url, `${origin}/ytso/manifest.webmanifest`);
        assert.deepEqual(appManifest.errors, []);
      await until(async () => {
        const result = await browser.send("Page.getInstallabilityErrors");
        return result.installabilityErrors.length === 0;
      }, "Chromium reports no installation blockers");
        const responses =
          await browser.evaluate(`Promise.all(['/ytso/api/subs','/api/subs','/ytso/health','/health','/ytso/api/auth'].map(async path=>{
        const r=await fetch(path,{cache:'no-store',headers:{'x-auth-token':${JSON.stringify(sessionToken)}},...(path.endsWith('/auth')?{method:'POST'}:{})});
        return {path,status:r.status,cache:r.headers.get('cache-control')};
      }))`);
        for (const response of responses) {
          assert.equal(response.status, 200, response.path);
          assert.equal(response.cache, "no-store", response.path);
        }
        const entries = await cacheEntries(browser);
        assert.ok(
          entries.some((entry) => entry.url.includes("/ytso/index.html")),
        );
        for (const entry of entries) {
          assert.equal(entry.token, null);
          assert.doesNotMatch(
            entry.url,
            /\/api(?:\/|\?)|\/health|youtube|googleapis/,
          );
          assert.match(
            new URL(entry.url).pathname,
            /^\/ytso\/(?:index\.html|manifest\.webmanifest|favicon\.ico|assets\/[^/]+|icons\/[^/]+)$/,
          );
        }
      },
    );
    await check(
      `Offline deep links load the shell and show connectivity errors without signing out (${label})`,
      async () => {
        await navigate(browser, `${origin}/ytso/categories`, "Categories");
        await text(browser, "Private fixture category");
        await browser.evaluate(
          "document.querySelector('section[aria-labelledby=create-category-title] input').focus()",
        );
        await browser.send("Input.insertText", { text: "Offline category" });
        server.network(false);
        await offline(browser, true);
        await text(browser, "You're offline");
        await browser.evaluate(
          "document.querySelector('section[aria-labelledby=create-category-title] form').requestSubmit()",
        );
        await until(
          () =>
            browser.evaluate(
              "!!document.querySelector('section[aria-labelledby=create-category-title] [role=alert]')",
            ),
          "offline write fails visibly",
        );
        assert.equal(
          await browser.evaluate(
            "document.querySelector('section[aria-labelledby=create-category-title] input').value",
          ),
          "Offline category",
        );
        for (const [route, heading] of [
          ["channels", "Channels"],
          ["categories", "Categories"],
          [`categories/${categoryId}`, null],
        ]) {
          await navigate(browser, `${origin}/ytso/${route}`, heading);
          await text(browser, "You're offline");
          await until(
            () => browser.evaluate("!!document.querySelector('[role=alert]')"),
            "visible offline request error",
          );
          assert.equal(
            await browser.evaluate("location.pathname.includes('/login')"),
            false,
          );
          assert.equal(
            await browser.evaluate(
              "document.body.innerText.includes('Start your collection') || document.body.innerText.includes('Build your first feed')",
            ),
            false,
          );
        }
        // Direct fetches bypass the UI's offline guard and must still never receive
        // cached API/health data or the navigation fallback's HTML.
        const responses =
          await browser.evaluate(`Promise.all(['/ytso/api/subs','/api/subs','/ytso/health','/health','/ytso/api/auth'].map(async path=>{
        try { const r=await fetch(path,{cache:'no-store',...(path.endsWith('/auth')?{method:'POST'}:{})}); return r.ok; } catch { return false; }
      }))`);
        assert.deepEqual(responses, [false, false, false, false, false]);
        assert.ok(
          (await browser.evaluate("document.cookie")).includes(sessionToken),
        );
        await screenshot(
          browser,
          stripPrefix ? "offline-stripped" : "offline-preserved",
        );
        server.network(true);
        await offline(browser, false);
        await navigate(browser, `${origin}/ytso/channels`, "Channels");
        await text(browser, "Private fixture channel");
        assert.equal(
          server.requests.filter(
            (request) =>
              request.method === "POST" &&
              request.url.endsWith("/api/categories"),
          ).length,
          0,
          "Offline writes are never queued or replayed",
        );
      },
    );
    if (stripPrefix) continue;

    let secondary;
    await check(
      "An incomplete release fails installation without replacing the working version",
      async () => {
        const html = await readFile(path.join(releaseB, "index.html"), "utf8");
        const entry = html.match(/<script[^>]+src="([^"]+)"/)[1];
        server.update();
        server.failAsset(entry);
        await browser.evaluate(`navigator.serviceWorker.getRegistration('/ytso/').then(async r=>{
        window.__failedInstall = false;
        r.addEventListener('updatefound',()=>{
          const worker = r.installing;
          worker.addEventListener('statechange',()=>{
            if(worker.state==='redundant') window.__failedInstall=true;
          });
        }, {once:true});
        await r.update();
        return true;
      })`);
        await until(
          () => browser.evaluate("window.__failedInstall"),
          "incomplete worker becomes redundant",
        );
        assert.equal(
          await browser.evaluate(
            "!!document.querySelector('meta[name=pwa-test-release]')",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "navigator.serviceWorker.getRegistration('/ytso/').then(r=>!!r.waiting)",
          ),
          false,
        );
        assert.equal(
          await browser.evaluate(
            "document.body.innerText.includes('Refresh to update')",
          ),
          false,
        );
        await text(browser, "Private fixture channel");
        server.failAsset("");
      },
    );
    await check(
      "A second release waits; Later preserves an active form and never reloads automatically",
      async () => {
        const { targetId } = await browser.send("Target.createTarget", {
          url: `${origin}/ytso/channels`,
        });
        secondary = await connect(targetId);
        await text(secondary, "Private fixture channel");
        await secondary.evaluate("window.__oldTab = true");
        await browser.evaluate(
          "document.querySelector('#channel-filter').focus(); window.__oldTab = true",
        );
        await browser.send("Input.insertText", { text: "Private" });
        server.update();
        await browser.evaluate(
          "navigator.serviceWorker.getRegistration('/ytso/').then(r=>r.update()).then(()=>true)",
        );
        await text(browser, "Refresh to update");
        await until(
          () =>
            browser.evaluate(
              "navigator.serviceWorker.getRegistration('/ytso/').then(r=>!!r.waiting)",
            ),
          "waiting worker",
        );
        await delay(1000);
        assert.equal(
          await browser.evaluate(
            "window.__oldTab && document.querySelector('#channel-filter').value === 'Private'",
          ),
          true,
        );
        assert.equal(
          await browser.evaluate(
            "!!document.querySelector('meta[name=pwa-test-release]')",
          ),
          false,
        );
        await browser.evaluate(
          "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Later').click()",
        );
        assert.equal(
          await browser.evaluate(
            "document.body.innerText.includes('Refresh to update')",
          ),
          false,
        );
        // Reopening the app rediscovers an already-waiting update.
        await navigate(browser, `${origin}/ytso/channels`, "Channels");
        await text(browser, "Refresh to update");
      },
    );
    await check(
      "Explicit refresh applies the new shell; another tab keeps its old assets and is not reloaded",
      async () => {
        await browser.evaluate(
          "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Refresh to update').click()",
        );
        await until(async () => {
          try {
            return await browser.evaluate(
              "document.querySelector('meta[name=pwa-test-release]')?.content === 'b'",
            );
          } catch {
            return false;
          }
        }, "new release after consent");
        await text(browser, "Private fixture channel");
        assert.equal(await secondary.evaluate("window.__oldTab"), true);
        await text(secondary, "Refresh to update");
        assert.ok(
          new Set((await cacheEntries(browser)).map((entry) => entry.name))
            .size >= 2,
          "Older tab retains its precache",
        );
        // This tab has never imported CategoriesPage. Its old lazy chunk no longer
        // exists on the new server, so only retention of the old cache can serve it.
        await offline(secondary, true);
        await secondary.evaluate(
          "document.querySelector('nav a[href=\"/ytso/categories\"]').click()",
        );
        await until(
          () =>
            secondary.evaluate(
              "document.querySelector('h1')?.textContent === 'Categories'",
            ),
          "old lazy chunk while offline",
        );
        await text(secondary, "You're offline");
        await secondary.evaluate(
          "Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Refresh to update').click()",
        );
        await until(async () => {
          try {
            return await secondary.evaluate(
              "document.querySelector('meta[name=pwa-test-release]')?.content === 'b'",
            );
          } catch {
            return false;
          }
        }, "second tab explicitly updates offline");
        await until(
          async () =>
            new Set((await cacheEntries(browser)).map((entry) => entry.name))
              .size === 1,
          "old cache cleanup after all tabs update",
        );
        await offline(secondary, false);
        await secondary.send("Page.close");
      },
    );
  }
  assert.deepEqual(report.runtimeErrors, [], "No unhandled browser exceptions");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
  if (browser)
    try {
      report.page = await browser.evaluate(
        "({url:location.href,text:document.body.innerText})",
      );
      await screenshot(browser, "failure");
    } catch {
      /* Browser may already be closed or navigating. */
    }
} finally {
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  if (browser)
    try {
      await browser.send("Browser.close");
    } catch {
      /* Already closed. */
    }
  for (const connection of browsers) connection.close();
  if (chrome && chrome.exitCode === null) {
    const exited = once(chrome, "exit");
    chrome.kill();
    await Promise.race([exited, delay(5000)]);
  }
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  // Keep diagnostics, but bound recursive cleanup to this suite's unique directory.
  assert.equal(path.dirname(path.resolve(temporary)), path.resolve(tmpdir()));
  assert.ok(path.basename(temporary).startsWith("ytso-pwa-test-"));
  for (const directory of [
    profile,
    path.join(temporary, "release-a"),
    path.join(temporary, "release-b"),
  ]) {
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(temporary),
    );
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
  console.log(
    `${report.status === "passed" ? "PASS" : "FAIL"}: ${report.checks.length} PWA scenarios. Report: ${path.join(output, "report.json")}`,
  );
}
