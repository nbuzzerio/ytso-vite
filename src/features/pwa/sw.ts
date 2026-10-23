/// <reference lib="webworker" />
import { cacheNames, clientsClaim, setCacheNameDetails } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const manifest = self.__WB_MANIFEST.map((entry) =>
  typeof entry === "string" ? { url: entry, revision: null } : entry,
);
const base = new URL(self.registration.scope).pathname;
// A distinct precache lets older open tabs keep loading their own lazy chunks.
const revision = manifest.find(
  (entry) => entry.url === "index.html",
)!.revision!;
const prefix = `ytso-${base.replace(/\W/g, "_")}`;
setCacheNameDetails({ prefix, suffix: revision });
precacheAndRoute(manifest, { ignoreURLParametersMatching: [] });
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${base}index.html`), {
    allowlist: [/^\/ytso\//],
    denylist: [
      /^\/ytso\/(?:api|health)(?:\/|\?|$)/,
      /\/[^/?]+\.[^/?]+(?:\?|$)/,
    ],
  }),
);

// Read only old, versioned build assets. Never add runtime responses to caches.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith(`${base}assets/`) &&
    /-[\w-]+\.(?:js|css|png|ico|webp)$/.test(url.pathname) &&
    !url.search &&
    !request.headers.has("x-auth-token"),
  async ({ request }) => {
    for (const name of await caches.keys()) {
      if (!name.startsWith(`${prefix}-precache-`)) continue;
      const cached = await (
        await caches.open(name)
      ).match(request, {
        ignoreSearch: true, // Workbox's internal revision parameter, never an API URL.
      });
      if (cached) return cached;
    }
    return fetch(request);
  },
);

const clientEntries = new Map<string, string>();
const currentScripts = new Set(
  manifest
    .filter((entry) => entry.url.endsWith(".js"))
    .map((entry) => new URL(entry.url, self.registration.scope).pathname),
);
async function cleanUnusedVersions() {
  // An active older worker must not delete the next worker's installing cache.
  if (self.registration.installing || self.registration.waiting) return;
  const windows = (
    await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  ).filter((client) => client.url.startsWith(self.registration.scope));
  // Unknown/older tabs retain their precache until they refresh or close.
  if (
    windows.some(
      (client) => !currentScripts.has(clientEntries.get(client.id) || ""),
    )
  )
    return;
  for (const name of await caches.keys()) {
    if (self.registration.installing || self.registration.waiting) return;
    if (name.startsWith(`${prefix}-precache-`) && name !== cacheNames.precache)
      await caches.delete(name);
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    // Sent only by an explicit Refresh action; installation never skips waiting.
    event.waitUntil(self.skipWaiting());
  } else if (
    event.data?.type === "YTSO_CLIENT_READY" &&
    event.source &&
    "id" in event.source
  ) {
    clientEntries.set(event.source.id, event.data.entry);
    event.waitUntil(cleanUnusedVersions());
  }
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope))
          client.postMessage({ type: "YTSO_REPORT_VERSION" });
      }
      await cleanUnusedVersions();
    })(),
  );
});
