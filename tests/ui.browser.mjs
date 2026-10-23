// Real Chromium interactions with a private Vite server and in-memory API fixtures.
// No database, YouTube credentials, or browser automation dependency is required.
import assert from "node:assert/strict";
import { CDP, chromeExecutable } from "./browser-helpers.mjs";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.QA_OUTPUT_DIR
  ? path.resolve(process.env.QA_OUTPUT_DIR)
  : await mkdtemp(path.join(tmpdir(), "ytso-ui-regression-"));
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), "ytso-browser-profile-"));
const report = {
  checks: [],
  screenshots: [],
  runtimeErrors: [],
  consoleErrors: [],
  requests: [],
  cancelledRequests: 0,
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      throw new Error(`Wait failed: ${label}`, { cause: error });
    }
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

const channel = (character, name) => ({
  channelId: `UC${character.repeat(22)}`,
  subName: name,
  channelDesc: `Videos from ${name}, with useful ideas and new discoveries.`,
  channelThumbnails: {
    default: "https://images.invalid/default.png",
    medium: "https://images.invalid/medium.png",
    high: "https://images.invalid/high.png",
  },
});
const lab = channel("a", "Curious Lab");
const maker = channel("b", "Maker Workshop");
const music = channel("c", "Science & Music / Café");
const fourth = channel(
  "d",
  "A channel with a deliberately long descriptive title for narrow screen coverage",
);
const initialCategoryId = "507f1f77bcf86cd799439011";
const state = {
  channels: [lab, maker],
  categories: [
    { _id: initialCategoryId, categoryName: "Learning", subs: [lab, maker] },
  ],
  feedFailure: true,
  failChannels: false,
  delayFeed: false,
  delayedRequests: 0,
  nextCategory: 12,
  secondAccount: false,
  delayCategoryList: false,
  delayedLists: 0,
};
function token(name = "Browser Tester") {
  return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ _id: state.secondAccount ? "507f1f77bcf86cd799439099" : "507f1f77bcf86cd799439000", name, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test-signature`;
}
function searchItem(item) {
  return {
    id: { channelId: item.channelId },
    snippet: {
      channelTitle: item.subName,
      description: item.channelDesc,
      thumbnails: Object.fromEntries(
        Object.entries(item.channelThumbnails).map(([key, url]) => [
          key,
          { url },
        ]),
      ),
    },
  };
}
function video(item) {
  return {
    contentDetails: { videoId: item.channelId.slice(2, 13) },
    snippet: {
      title: `${item.subName}: a new idea`,
      channelTitle: item.subName,
      channelId: item.channelId,
      publishedAt: "2026-10-20T12:00:00.000Z",
      thumbnails: {
        default: { url: "https://images.invalid/video.png" },
        medium: { url: "https://images.invalid/video.png" },
        high: { url: "https://images.invalid/video.png" },
      },
    },
  };
}

async function mockApi(request) {
  const url = new URL(request.url);
  const endpoint = url.pathname.slice("/ytso/api".length);
  const body = request.postData ? JSON.parse(request.postData) : {};
  report.requests.push({
    method: request.method,
    path: endpoint,
    query: url.search,
    body,
  });
  const success = (value) => ({ status: 200, body: value });
  if (endpoint === "/auth" || endpoint === "/users")
    return success({
      token: token(state.secondAccount ? "Second Account" : "Browser Tester"),
    });
  if (endpoint === "/subs") {
    if (request.method === "GET" && state.failChannels)
      return {
        status: 503,
        body: { error: "Saved channels are temporarily unavailable." },
      };
    if (
      request.method === "POST" &&
      !state.channels.some((item) => item.channelId === body.channelId)
    )
      state.channels.push(body);
    if (request.method === "DELETE") {
      state.channels = state.channels.filter(
        (item) => item.channelId !== body.channelId,
      );
      state.categories.forEach((category) => {
        category.subs = category.subs.filter(
          (item) => item.channelId !== body.channelId,
        );
      });
    }
    return success(state.channels);
  }
  if (endpoint === "/categories") {
    if (request.method === "GET" && state.delayCategoryList) {
      state.delayCategoryList = false;
      state.delayedLists++;
      const snapshot = structuredClone(state.categories);
      await delay(1500);
      return success(snapshot);
    }
    if (request.method === "POST") {
      state.categories.push({
        _id: `507f1f77bcf86cd7994390${state.nextCategory++}`,
        categoryName: body.category,
        subs: [],
      });
      await delay(1000);
    }
    if (request.method === "DELETE")
      state.categories = state.categories.filter(
        (category) => category._id !== body.categoryId,
      );
    if (["PUT", "PATCH"].includes(request.method)) {
      const category = state.categories.find(
        (item) => item._id === body.categoryId,
      );
      assert.ok(category, "Mutation targeted an existing category ID");
      if (request.method === "PATCH") category.categoryName = body.categoryName;
      else if (
        !category.subs.some((item) => item.channelId === body.sub.channelId)
      )
        category.subs.push(body.sub);
      return success(category);
    }
    return success(state.categories);
  }
  if (endpoint === "/categories/subs") {
    const category = state.categories.find(
      (item) => item._id === url.searchParams.get("id"),
    );
    return category
      ? success(category)
      : { status: 404, body: { error: "Category not found." } };
  }
  if (endpoint === "/categories/sub") {
    const category = state.categories.find(
      (item) => item._id === body.categoryId,
    );
    category.subs = category.subs.filter(
      (item) => item.channelId !== body.channelId,
    );
    return success(category.subs);
  }
  if (endpoint === "/search")
    return success(
      url.searchParams.has("nextPageToken")
        ? { items: [searchItem(music), searchItem(fourth)] }
        : {
            items: [searchItem(music), searchItem(lab)],
            nextPageToken: "second-page",
          },
    );
  if (endpoint === "/search/subVideos") {
    const id = url.searchParams.get("channelId");
    if (state.delayFeed) {
      state.delayedRequests++;
      await delay(1500);
    }
    if (id === maker.channelId && state.feedFailure)
      return {
        status: 503,
        body: { error: "One channel feed is unavailable." },
      };
    return success({
      items: [
        video(
          [lab, maker, music, fourth].find((item) => item.channelId === id),
        ),
      ],
    });
  }
  throw new Error(`Unexpected API request: ${request.method} ${endpoint}`);
}

let vite;
let chrome;
let browser;
let origin;
let launchError;
let serverLog = "";
let errorFeedbackBackground;
let currentCheck;
const interceptionErrors = [];

async function waitText(text) {
  await until(
    () =>
      browser.evaluate(
        `document.body?.innerText.includes(${JSON.stringify(text)}) ?? false`,
      ),
    `text ${text}`,
  );
}
async function heading(text) {
  await until(
    () =>
      browser.evaluate(
        `document.querySelector('h1')?.textContent === ${JSON.stringify(text)}`,
      ),
    `heading ${text}`,
  );
}
async function navigate(route) {
  await browser.send("Page.navigate", { url: `${origin}${route}` });
}
async function click(selector) {
  const point = await browser.evaluate(
    `(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element || element.disabled) return null; element.scrollIntoView({block:'center'}); const rect = element.getBoundingClientRect(); return {x:rect.x + rect.width/2,y:rect.y + rect.height/2}; })()`,
  );
  assert.ok(point, `Enabled clickable element exists: ${selector}`);
  await browser.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await browser.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...point,
  });
}
async function clickText(text, scope = "document") {
  const id = `browser-target-${Date.now()}`;
  const found = await browser.evaluate(
    `(() => { const element = Array.from(${scope}.querySelectorAll('button,a')).find(node => node.textContent.trim() === ${JSON.stringify(text)} && !node.disabled); if (!element) return false; element.setAttribute('data-browser-target', ${JSON.stringify(id)}); return true; })()`,
  );
  assert.ok(found, `Enabled action exists: ${text}`);
  await click(`[data-browser-target="${id}"]`);
}
async function key(keyName, code = keyName) {
  const virtualKey = { Enter: 13, Tab: 9, Escape: 27, a: 65 }[keyName];
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: keyName,
    code,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
    ...(keyName === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}),
  });
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: keyName,
    code,
    windowsVirtualKeyCode: virtualKey,
    nativeVirtualKeyCode: virtualKey,
  });
}
async function type(selector, text) {
  await click(selector);
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    modifiers: 2,
    windowsVirtualKeyCode: 65,
  });
  await browser.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    modifiers: 2,
    windowsVirtualKeyCode: 65,
  });
  await browser.send("Input.insertText", { text });
}
async function screenshot(name) {
  await browser.evaluate("window.scrollTo(0,0)");
  const result = await browser.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const filename = path.join(output, `${name}.png`);
  await writeFile(filename, Buffer.from(result.data, "base64"));
  report.screenshots.push(filename);
}
async function check(label, action) {
  currentCheck = label;
  await action();
  report.checks.push(label);
  console.log(`PASS ${label}`);
}
async function noOverflow() {
  const widths = await browser.evaluate(
    "({document:document.documentElement.scrollWidth, viewport:innerWidth})",
  );
  assert.ok(
    widths.document <= widths.viewport,
    `No horizontal overflow: ${JSON.stringify(widths)}`,
  );
  assert.equal(
    await browser.evaluate("document.querySelectorAll('main').length"),
    1,
    "One main landmark",
  );
}

try {
  const port = await availablePort();
  origin = `http://127.0.0.1:${port}`;
  vite = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  vite.on("error", (error) => {
    launchError = error;
  });
  vite.stdout.on("data", (data) => {
    serverLog += data.toString();
  });
  vite.stderr.on("data", (data) => {
    serverLog += data.toString();
  });
  await until(async () => {
    if (launchError) throw launchError;
    try {
      return (await fetch(`${origin}/ytso/`)).ok;
    } catch {
      return false;
    }
  }, "private Vite server");
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
  chrome.on("error", (error) => {
    launchError = error;
  });
  let debugPort;
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
  const targets = await (
    await fetch(`http://127.0.0.1:${debugPort}/json/list`)
  ).json();
  browser = new CDP(
    targets.find((target) => target.type === "page").webSocketDebuggerUrl,
  );
  await browser.connect();
  browser.on("Runtime.exceptionThrown", ({ exceptionDetails }) =>
    report.runtimeErrors.push(
      exceptionDetails.exception?.description || exceptionDetails.text,
    ),
  );
  browser.on("Runtime.consoleAPICalled", ({ type, args }) => {
    if (type === "error")
      report.consoleErrors.push(
        args.map((arg) => arg.value || arg.description).join(" "),
      );
  });
  browser.on("Network.loadingFailed", ({ canceled }) => {
    if (canceled) report.cancelledRequests++;
  });
  browser.on("Fetch.requestPaused", async ({ requestId, request }) => {
    try {
      const url = new URL(request.url);
      if (url.origin === origin && url.pathname.startsWith("/ytso/api/")) {
        const response = await mockApi(request);
        await browser.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: response.status,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
          ],
          body: Buffer.from(JSON.stringify(response.body)).toString("base64"),
        });
      } else if (
        url.origin === origin ||
        ["data:", "blob:"].includes(url.protocol)
      )
        await browser.send("Fetch.continueRequest", { requestId });
      else {
        // Never contact external image/video hosts. Their UI requests receive local fixtures.
        const isImage = /images\.invalid/.test(url.hostname);
        await browser.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: 200,
          responseHeaders: [
            {
              name: "Content-Type",
              value: isImage ? "image/svg+xml" : "text/html",
            },
          ],
          body: Buffer.from(
            isImage
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#a9bec6"/></svg>'
              : "<!doctype html><title>Local player fixture</title>",
          ).toString("base64"),
        });
      }
    } catch (error) {
      // A consumed AbortSignal can cancel a paused request before its response arrives.
      if (
        !/Invalid InterceptionId|Invalid requestId|No resource with given identifier/.test(
          error.message,
        )
      )
        interceptionErrors.push(error.message);
    }
  });
  await Promise.all([
    browser.send("Page.enable"),
    browser.send("Runtime.enable"),
    browser.send("Network.enable"),
    browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] }),
    browser.send("Emulation.setDeviceMetricsOverride", {
      width: 1365,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    }),
  ]);
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source:
      "{ const realNow = Date.now.bind(Date); window.__qaClockOffset = 0; Date.now = () => realNow() + window.__qaClockOffset; }",
  });
  await browser.send("Network.setCookie", {
    name: "x-auth-token",
    value: token(),
    url: `${origin}/ytso/`,
    path: "/ytso",
  });

  await check(
    "Text waits handle a document before its body exists",
    async () => {
      assert.equal(
        await browser.evaluate(
          `document.open(); document.write('<!doctype html><html><head><title>Navigation fixture</title>'); document.body === null`,
        ),
        true,
      );
      await assert.rejects(
        browser.evaluate("document.body.innerText.includes('Ready')"),
        /Cannot read properties of null.*innerText/,
      );
      await Promise.all([
        waitText("Ready"),
        browser.evaluate(
          `document.write('</head><body>Ready</body></html>'); document.close()`,
        ),
      ]);
      await assert.rejects(
        until(
          () =>
            browser.evaluate(
              "document.querySelector('#missing')?.textContent === 'Ready'",
            ),
          "text in #missing",
          1,
        ),
        /Timed out: text in #missing/,
      );
      await assert.rejects(
        until(
          () =>
            browser.evaluate("throw new Error('Unexpected predicate error')"),
          "broken predicate",
        ),
        (error) =>
          error.message === "Wait failed: broken predicate" &&
          /Unexpected predicate error/.test(error.cause.message),
      );
    },
  );

  await check(
    "Session restoration preserves a protected detail URL; partial feeds recover",
    async () => {
      await navigate("/");
      await until(
        () =>
          browser.evaluate(
            "location.pathname.startsWith('/ytso') && (document.body?.innerText.includes('Browser Tester') ?? false)",
          ),
        "root redirect preserves scoped session cookie",
      );
      await navigate(`/ytso/categories/${initialCategoryId}`);
      await heading("Learning");
      assert.equal(
        await browser.evaluate("location.pathname"),
        `/ytso/categories/${initialCategoryId}`,
      );
      await waitText("Couldn’t load Maker Workshop");
      errorFeedbackBackground = await browser.evaluate(
        "getComputedStyle(document.querySelector('.feedback-error')).backgroundColor",
      );
      assert.ok(
        !["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"].includes(
          errorFeedbackBackground,
        ),
        "Error feedback has a visible background",
      );
      await waitText("Curious Lab: a new idea");
      state.feedFailure = false;
      await clickText("Try again");
      await waitText("Maker Workshop: a new idea");
      await until(
        () => browser.evaluate("!document.querySelector('[role=alert]')"),
        "feed error cleared",
      );
      assert.equal(
        await browser.evaluate("document.querySelectorAll('iframe').length"),
        0,
      );
      await browser.evaluate(
        `document.querySelector('button[aria-label="Play Curious Lab: a new idea"]').focus()`,
      );
      await key("Enter");
      await until(
        () =>
          browser.evaluate("document.querySelectorAll('iframe').length === 1"),
        "keyboard starts one player",
      );
      await click('button[aria-label="Play Maker Workshop: a new idea"]');
      assert.equal(
        await browser.evaluate("document.querySelectorAll('iframe').length"),
        1,
      );
      assert.ok(
        await browser.evaluate("!!document.querySelector('iframe').title"),
      );
      await clickText("Close player");
      await noOverflow();
      await screenshot("desktop-category");
    },
  );

  await check(
    "Leaving a loading feed aborts requests without unhandled errors",
    async () => {
      state.delayFeed = true;
      await clickText("Refresh feed");
      await until(() => state.delayedRequests > 0, "delayed feed request");
      await click('nav[aria-label="Main navigation"] a[href="/ytso/channels"]');
      await heading("Channels");
      await waitText("Saved channels (2)");
      await delay(1700);
      state.delayFeed = false;
      assert.ok(
        report.cancelledRequests > 0,
        "Network observed canceled feed requests",
      );
    },
  );

  await check(
    "Enter submits an encoded search; pagination deduplicates and stops",
    async () => {
      const query = "science & music/日本語";
      await type("#youtube-search", query);
      await key("Enter");
      await waitText(`2 results for “${query}”`);
      await clickText("Load more channels");
      await waitText(`3 results for “${query}”`);
      await waitText("You’ve reached the end of these results.");
      const searches = report.requests.filter(
        (request) => request.path === "/search",
      );
      assert.equal(searches.length, 2);
      assert.equal(new URLSearchParams(searches[0].query).get("q"), query);
      assert.equal(
        new URLSearchParams(searches[1].query).get("nextPageToken"),
        "second-page",
      );
      assert.equal(
        await browser.evaluate(
          "Array.from(document.querySelectorAll('button')).filter(button=>button.textContent==='Load more channels').length",
        ),
        0,
      );
      await click(`button[aria-label="Save ${music.subName}"]`);
      await waitText("Saved channels (3)");
      await waitText(`${music.subName} saved.`);
      const successBackground = await browser.evaluate(
        "getComputedStyle(document.querySelector('.feedback-success')).backgroundColor",
      );
      assert.ok(
        !["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"].includes(successBackground),
        "Success feedback has a visible background",
      );
      assert.notEqual(
        successBackground,
        errorFeedbackBackground,
        "Success and error feedback are visually distinct",
      );
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await noOverflow();
      await screenshot("mobile-channels");
      await type("#channel-filter", "Maker");
      assert.equal(
        await browser.evaluate(
          "document.querySelectorAll('section[aria-labelledby=\"saved-channels-title\"] article').length",
        ),
        1,
      );
      await type("#channel-filter", "");
      await noOverflow();
    },
  );

  let createdId;
  await check(
    "Category writes cancel stale list reads, lock conflicting actions, and support Enter/rename",
    async () => {
      state.delayCategoryList = true;
      await browser.evaluate("window.__qaClockOffset += 61_000");
      await click(
        'nav[aria-label="Main navigation"] a[href="/ytso/categories"]',
      );
      await heading("Categories");
      await until(
        () => state.delayedLists > 0,
        "background category list read",
      );
      const createInput =
        'section[aria-labelledby="create-category-title"] input';
      await type(createInput, "New category");
      await key("Enter");
      await until(
        () => state.categories.length === 2,
        "category write started",
      );
      await until(
        () =>
          browser.evaluate(
            "document.querySelector('button[aria-label=\"Rename Learning\"]').disabled",
          ),
        "rename locked during creation",
        1000,
      );
      assert.ok(
        await browser.evaluate(
          "document.querySelector('section[aria-labelledby=\"create-category-title\"] button[type=submit]').disabled",
        ),
        "Creation is locked during writes",
      );
      await waitText("“New category” created.");
      await delay(1700);
      await waitText("Your categories (2)");
      createdId = state.categories.find(
        (category) => category.categoryName === "New category",
      )._id;
      await click('button[aria-label="Rename New category"]');
      await type("article input", "Ideas & experiments");
      await key("Enter");
      await waitText("Category renamed.");
      assert.equal(
        state.categories.find((category) => category._id === createdId)
          .categoryName,
        "Ideas & experiments",
      );
      await type(createInput, "ideas & experiments");
      await key("Enter");
      await waitText("A category with this name already exists.");
      assert.equal(state.categories.length, 2);
      await noOverflow();
      await type(createInput, "");
      await screenshot("mobile-categories");
    },
  );

  await check(
    "Category membership adds, removes, and restores with real Undo",
    async () => {
      await clickText("Ideas & experiments");
      await heading("Ideas & experiments");
      await clickText("Add channels");
      await waitText("Add saved channels");
      await click(`button[aria-label="Add ${music.subName} to this category"]`);
      await waitText(`${music.subName} added to this category.`);
      const currentCategory = () =>
        state.categories.find((category) => category._id === createdId);
      assert.equal(currentCategory().subs.length, 1);
      await click(
        `button[aria-label="Remove ${music.subName} from this category"]`,
      );
      await waitText(`${music.subName} removed from this category.`);
      assert.equal(currentCategory().subs.length, 0);
      assert.equal(state.channels.length, 3);
      await clickText("Undo");
      await waitText(`${music.subName} restored to this category.`);
      assert.equal(currentCategory().subs.length, 1);
      await clickText("Feed");
      await waitText(`${music.subName}: a new idea`);
      await click(`button[aria-label="Play ${music.subName}: a new idea"]`);
      const player = await browser.evaluate(
        "(() => { const frame=document.querySelector('iframe'); const rect=frame.getBoundingClientRect(); return {width:rect.width,height:rect.height,referrerPolicy:frame.referrerPolicy}; })()",
      );
      assert.ok(
        player.width >= 200 && player.height >= 200,
        "Mobile player meets YouTube's 200×200 minimum viewport",
      );
      assert.equal(player.referrerPolicy, "strict-origin-when-cross-origin");
      await clickText("Close player");
      await noOverflow();
      await navigate(`/ytso/categories/Legacy-name?id=${createdId}`);
      await heading("Ideas & experiments");
      await waitText(`${music.subName}: a new idea`);
      await screenshot("mobile-category-feed");
    },
  );

  await check(
    "Category and saved-channel deletion require explicit confirmation",
    async () => {
      await clickText("← All categories");
      await heading("Categories");
      await click('button[aria-label="Delete Ideas & experiments"]');
      assert.equal(state.categories.length, 2);
      await clickText("Cancel");
      assert.equal(state.categories.length, 2);
      await click('button[aria-label="Delete Ideas & experiments"]');
      await clickText("Delete category");
      await waitText("“Ideas & experiments” deleted.");
      assert.equal(state.categories.length, 1);
      assert.equal(state.channels.length, 3);
      await click('nav[aria-label="Main navigation"] a[href="/ytso/channels"]');
      await heading("Channels");
      await click(
        `button[aria-label="Remove ${lab.subName} from saved channels"]`,
      );
      assert.equal(state.channels.length, 3);
      await clickText("Cancel");
      assert.equal(state.channels.length, 3);
      await click(
        `button[aria-label="Remove ${lab.subName} from saved channels"]`,
      );
      await clickText("Confirm removal");
      await waitText(`${lab.subName} removed from your collection.`);
      assert.equal(state.channels.length, 2);
      assert.equal(state.categories[0].subs.length, 1);
    },
  );

  await check(
    "Saved-channel request errors show a working retry action",
    async () => {
      state.failChannels = true;
      await navigate("/ytso/channels");
      await heading("Channels");
      await waitText("Saved channels are temporarily unavailable.");
      state.failChannels = false;
      await clickText("Try again");
      await waitText("Saved channels (2)");
      await noOverflow();
    },
  );

  await check(
    "Sign out clears the session; keyboard sign in restores the requested route without old account data",
    async () => {
      await clickText("Sign out");
      await waitText("Good channels.");
      assert.ok(
        !(await browser.evaluate("document.cookie")).includes("x-auth-token="),
      );
      state.secondAccount = true;
      state.channels = [];
      state.categories = [];
      await navigate("/ytso/channels?from=browser-test");
      await heading("Welcome back");
      await type("#email", "browser@example.test");
      await type("#password", "local-test-password");
      await browser.evaluate(
        "document.querySelector('button[aria-label=\"Show password\"]').focus()",
      );
      await key("Enter");
      assert.equal(
        await browser.evaluate("document.querySelector('#password').type"),
        "text",
      );
      const contrast = await browser.evaluate(
        `(() => { const style = getComputedStyle(document.querySelector('#password')); const luminance = color => color.match(/\\d+/g).slice(0,3).map(Number).map(v => { v/=255; return v<=.04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0); const a=luminance(style.color), b=luminance(style.backgroundColor); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); })()`,
      );
      assert.ok(
        contrast >= 4.5,
        `Typed login text contrast ${contrast.toFixed(2)}:1`,
      );
      await noOverflow();
      await screenshot("mobile-login-typed");
      await browser.evaluate("document.querySelector('#password').focus()");
      await key("Enter");
      await heading("Channels");
      await waitText("Start your collection");
      assert.equal(
        await browser.evaluate("location.pathname + location.search"),
        "/ytso/channels?from=browser-test",
      );
      assert.ok(
        !(await browser.evaluate("document.body.innerText")).includes(
          "Maker Workshop",
        ),
      );
      await clickText("Sign out");
      await waitText("Good channels.");
      await noOverflow();
      await screenshot("mobile-home");
    },
  );

  assert.deepEqual(interceptionErrors, [], "All API requests matched fixtures");
  assert.deepEqual(report.runtimeErrors, [], "No unhandled browser errors");
  assert.deepEqual(report.consoleErrors, [], "No console errors");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failedCheck = currentCheck;
  report.error = error.stack;
  report.cause = error.cause?.stack;
  report.serverLog = serverLog.slice(-5000);
  report.interceptionErrors = interceptionErrors;
  if (browser) {
    try {
      report.page = await browser.evaluate(
        "({url:location.href,readyState:document.readyState,title:document.title,bodyPresent:!!document.body,text:document.body?.innerText,html:document.documentElement?.outerHTML})",
      );
    } catch (diagnosticError) {
      report.pageDiagnosticError = diagnosticError.message;
    }
    try {
      await screenshot("failure");
    } catch (diagnosticError) {
      report.screenshotError = diagnosticError.message;
    }
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  if (browser) {
    try {
      await browser.send("Browser.close");
    } catch {
      /* Chrome may already be closed. */
    }
    browser.close();
  }
  chrome?.kill();
  vite?.kill();
  // Only remove the uniquely created browser profile after checking its absolute boundary.
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()));
  assert.ok(path.basename(profile).startsWith("ytso-browser-profile-"));
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  console.log(
    `${report.status === "passed" ? "PASS" : "FAIL"}: ${report.checks.length} browser scenarios. Report: ${path.join(output, "report.json")}`,
  );
}
