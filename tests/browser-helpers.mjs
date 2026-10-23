// Shared Chrome transport; each suite still uses its own server, profile, and origin.
import { existsSync } from "node:fs";
import path from "node:path";

export function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA &&
      path.join(
        process.env.LOCALAPPDATA,
        "Google/Chrome/Application/chrome.exe",
      ),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const executable = candidates.find(
    (candidate) => candidate && existsSync(candidate),
  );
  if (!executable)
    throw new Error(
      "Chrome/Chromium was not found. Set CHROME_PATH to its executable.",
    );
  return executable;
}

export class CDP {
  nextId = 0;
  pending = new Map();
  listeners = new Map();
  constructor(url) {
    this.socket = new globalThis.WebSocket(url);
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(message.id);
        if (message.error)
          request.reject(
            new Error(`${request.method}: ${message.error.message}`),
          );
        else request.resolve(message.result);
      } else {
        for (const listener of this.listeners.get(message.method) || [])
          void listener(message.params);
      }
    });
  }
  on(method, listener) {
    this.listeners.set(method, [
      ...(this.listeners.get(method) || []),
      listener,
    ]);
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timed out: ${method}`));
      }, 15_000);
      this.pending.set(id, { method, resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  }
  close() {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Browser closed"));
    }
    this.pending.clear();
    this.socket.close();
  }
}
