# 📺 YouTube Subscription Organizer (Rebuild)

A full-stack rebuild of the original YouTube Subscription Organizer using **React, Vite, TypeScript, and Express**. Save YouTube channels, organize them into categories, and browse the latest uploads in a chronological feed.

Saved channels and categories belong to this application. Saving or removing a channel does **not** change subscriptions on YouTube.

## 🚀 Why This Project Matters

This rebuild brings together a responsive interface, server-side validation, and a persistent MongoDB data model. The code is organized around authentication, channels, and categories, with a shared typed API client and React Query handling caching and request state.

Highlights include:

- Explicit channel and category actions with visible loading, empty, error, and success states
- Keyboard-friendly forms, responsive cards, and persistent navigation
- Authenticated ownership checks, expiring sessions, and duplicate membership protection
- Isolated regression tests that do not require a live database or YouTube account
- A production app factory, consistent routing, and CI checks before deployment

## 🧠 Features

- **Saved channels** — Keep a local channel library, filter by name, and see category membership.
- **Channel discovery** — Search YouTube, save results, and load additional pages.
- **Categories** — Create, rename, and delete categories. Deleting a category preserves saved channels.
- **Category membership** — Add saved channels or remove them from a category with an undo action.
- **Chronological feeds** — Browse up to ten recent uploads per channel, sorted newest first, with on-demand video playback.
- **Library overview** — See saved-channel and category counts with shortcuts after signing in.

## ⚙️ Tech Stack

| Layer             | Tools                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| Frontend          | React 18, Vite, TypeScript, React Router, Tailwind CSS                  |
| Data fetching     | TanStack React Query and a shared typed fetch client                    |
| Forms             | React Hook Form and Yup                                                 |
| Backend           | Node.js 24+, Express, JavaScript ES modules                             |
| Database          | MongoDB with Mongoose                                                   |
| Server validation | Joi                                                                     |
| Testing           | Node's built-in test runner and a Chrome/Chromium browser harness       |
| Hosting           | Express serves the Vite build; a self-hosted runner deploys through PM2 |

## 🧪 Getting Started

Use **Node.js 24 or newer**. The Node tests import TypeScript through Node's built-in type stripping; browser checks use the built-in WebSocket client.

1. Install the locked dependencies:

   ```bash
   npm ci
   ```

2. Copy `example.env` to `.env` and configure the server:

   | Variable           | Purpose                                                                                                |
   | ------------------ | ------------------------------------------------------------------------------------------------------ |
   | `NODE_ENV`         | `development`, `test`, or `production`; defaults to development                                        |
   | `jwtPrivateKey`    | A long random secret for signing sessions                                                              |
   | `db`               | MongoDB connection string for development and production                                               |
   | `testdb`           | Separate MongoDB connection string only when running the server with `NODE_ENV=test`                   |
   | `YOUTUBE_API_KEY`  | YouTube Data API v3 key for channel search and feeds                                                   |
   | `PORT`             | Express port; defaults to 3000                                                                         |
   | `TRUST_PROXY_HOPS` | Defaults to 0; set to 1 only behind exactly one trusted proxy that overwrites forwarded client headers |

   Keep these values server-side. Never add a `VITE_` prefix to secrets or commit `.env`.

3. Start MongoDB, then run the API and frontend in separate terminals:

   ```bash
   npm run server-dev
   ```

   ```bash
   npm run dev
   ```

4. Open the Vite URL with the `/ytso/` path (normally `http://localhost:5173/ytso/`). Vite forwards `/ytso/api` to Express on port 3000. If you change the backend port, update the proxy target in `vite.config.ts`.

### Production locally

```bash
npm run build
npm start
```

Set `NODE_ENV=production` in the environment or `.env` before starting. Open `http://localhost:3000/ytso/` (or your configured port). The server waits for MongoDB before listening. `GET /health` and `GET /ytso/health` return JSON readiness and a nonsecret `releaseId` from `YTSO_RELEASE_ID` (null for local runs); a disconnected database returns HTTP 503.

`npm run preview` previews the frontend build only; use Express for a complete production-like application.

### Installable app (PWA)

The production build generates `/ytso/manifest.webmanifest` and `/ytso/sw.js` using `vite-plugin-pwa` 2.x, whose peer dependencies include the installed Vite 7.x. The manifest uses `/ytso/` for its stable app ID, start URL, and scope. The 192px/512px PNGs and separate maskable icon in `public/icons/` reuse the existing filing-cabinet branding, with the dark theme's background. The maskable artwork is inset inside the central safe area. The original favicon is preserved.

Install from the **HTTPS production URL ending in `/ytso/`**:

- **Android (Chrome):** open the browser menu and choose **Install and create shortcut → Install** (older versions may say **Add to home screen**). Launch YTSO from its home-screen/app-drawer icon. See [Chrome's installation instructions](https://support.google.com/chrome/answer/9658361?hl=en&co=GENIE.Platform%3DAndroid).
- **Desktop (Chrome or Edge):** use the address bar's install icon, or the browser menu's install-app action. Launch it from the installed app shortcut.

Supported browsers open the installed app in a standalone window. Installation is browser-controlled; no custom install prompt is required. Service workers require HTTPS, except trusted local development origins such as `http://localhost`. A phone visiting a PC's plain HTTP LAN address is not a production PWA test. Normal `npm run dev` intentionally does **not** register a service worker; test a production build with Express or run the isolated PWA suite below.

After one successful load and completed service-worker installation, the static interface and lazy-loaded application routes are available offline. Library contents, signing in/up, YouTube search, thumbnails, playback, and all saved changes require connectivity. Existing in-memory results may remain visible until the page closes; account data is never persisted by the PWA. An accessible offline notice and request errors explain unavailable data without showing an empty library or clearing a valid session. Offline writes fail immediately and are never queued for reconnection. There is no background sync, push, or offline write support.

Only build-time public resources are precached. API/health requests and external YouTube resources have no service-worker cache handler; API fetches and API/health HTTP responses also use `no-store`. Navigation fallback is confined to `/ytso/` and excludes API, health, and file URLs. The worker and manifest revalidate over HTTP, while hashed assets retain immutable HTTP caching. Both preserved-prefix and stripped-prefix reverse proxies are supported without changing PM2 or the readiness endpoint. Reverse proxies must preserve these cache policies and serve the worker/manifest as files, not rewrite them to HTML.

Updates are checked on launch, returning to a visible app, reconnecting, and hourly while open. A fully installed update displays **Refresh to update** and **Later**. No tab automatically reloads: accepting refresh reloads that tab, while other open tabs receive the same choice. Refresh is disabled during a library mutation and warns about unsaved form changes. A failed/incomplete installation leaves the working worker active. Each shell version has its own precache; older tabs can still load their original hashed chunks after another tab updates. Old caches are deleted once all open YTSO tabs report the current version, or a later version check finds the older tabs closed. Unknown/suspended tabs conservatively retain their cache. Browser storage eviction or clearing site data can remove offline availability; reconnect to restore it.

Before a human-approved production release, manually verify installation and standalone launching on a real Android device and a desktop browser over the final HTTPS proxy. Check maskable-icon cropping, an offline relaunch after installation, and the update prompt across two open windows. The automated tests use isolated local production servers and fixtures; they do not deploy or validate live database access, YouTube playback, OS-level installation, or the actual droplet's proxy configuration.

## 🧪 Testing

```bash
npm run lint
npm test
npm run build
npm run test:ui
npm run test:pwa
```

- **Lint** checks frontend TypeScript, backend JavaScript, and test scripts.
- **Node tests** cover session parsing, authentication and ownership, category membership, pagination/provider errors, production routing, headers, and rate limiting using injected fixtures.
- **Browser checks** launch a private Vite server and Chrome/Chromium, intercept API requests, and exercise desktop/mobile flows. Set `CHROME_PATH` if the browser is not found automatically. Set `QA_OUTPUT_DIR` to choose where screenshots and the report are saved; otherwise they go into a temporary directory.
- **PWA checks** require `npm run build` first, then launch separate production Express servers and a clean Chrome profile. They verify the generated manifest/icons, both proxy path modes, registration/scope, offline deep links and failed writes, absence of API/health caching, failed update installation, explicit update consent, old-tab chunk retention, and cache cleanup. A second release is built only in a uniquely created temporary directory; normal dev-server browser checks remain separate. CI runs both browser suites before packaging and saves their diagnostics on failure.
- Unit and browser tests do not require `.env`, MongoDB, or a YouTube key. Live provider playback, database connectivity, and deployment still need environment-specific verification.

## 📂 Project Structure

```text
src/
  app/                  Providers, library overview, and root redirect
  features/
    auth/               Session handling and protected routes
    channels/           Saved channels, search, cards, and query hooks
    categories/         Category management, membership, and feeds
    pwa/                Service worker, offline notice, and update lifecycle
  lib/                  Typed API client and shared domain types
  shared/ui/            Loading, empty, error, and feedback components
  components/           Navigation
  pages/                Layout, homepage, and error pages
  assets/               Imported static assets
server/
  app.js                App factory without database or listener side effects
  index.js              Configuration, database readiness, and server lifecycle
  routes/               API handlers and injectable router factories
  services/             YouTube provider integration
  validation/           Shared request validation
  middleware/           Authentication and consistent error handling
  startup/              Routing, security headers, rate limits, and configuration
database/
  index.js              Awaited MongoDB connection
  models/               Mongoose schemas
tests/                  Node regressions and browser harness
example.env             Server configuration template
.github/workflows/      Verification and deployment workflow
```

## Hosting and Deployment

The public browser base is `/ytso/`. Express serves assets and SPA deep links both with and without that prefix, and exposes APIs at `/ytso/api` and `/api`. This supports reverse proxies that either preserve `/ytso` or strip it before forwarding. Unknown API endpoints return JSON 404 responses instead of the SPA. Serve all application paths from the same origin.

Production middleware applies compression and security headers before API and static handlers. The content security policy allows YouTube iframe hosts and thumbnail domains without `unsafe-eval`. Authentication attempts and YouTube searches have their own rate limits; static files and ordinary library requests do not share those limits.

The GitHub workflow runs `npm ci`, lint, Node tests, the build, and browser checks on a hosted runner for pull requests and pushes to `master`. Failed browser checks retain screenshots and a diagnostic report as an artifact. A successful `master` push (or manual run on `master`) deploys the verified artifact using the existing **Linux self-hosted runner and PM2** model. Pull requests never run deployment.

The deployment host needs Bash, `tar`, `curl`, PM2 on `PATH`, and write access to `$HOME/apps/ytso/releases`. Configure repository secrets `jwtPrivateKey`, `db`, `YOUTUBE_API_KEY`, and optionally `PORT`; configure the `TRUST_PROXY_HOPS` repository variable if required by your proxy topology. The workflow creates an isolated release directory and installs dependencies before switching PM2. Readiness checks have bounded request times and require JSON `status: "ok"` plus the expected commit SHA as `releaseId` before saving the process state. It does not stop the running app before installation/build verification.

If activation fails, the workflow attempts to restore the previous directory, port, and release ID, then verifies readiness and the prior identity when available. A legacy server that returns SPA HTML from `/health` does not count as a verified rollback; the workflow reports that manual verification is needed and preserves the existing saved PM2 state. Release directories are retained for rollback; plan periodic cleanup on the deployment host.

## Compatibility Notes

Existing saved-channel and category documents remain compatible; this update does not require a database migration. Membership is validated and deduplicated while retaining the existing embedded document format.

New sessions expire after 30 days. Old sessions without an expiration or the current token audience/issuer require users to sign in again once.

Group invitations now use signed tokens. Regenerate invitations created by the previous implementation.

## 🧑‍💻 Developer Takeaways

This project demonstrates feature-oriented React organization, typed API access, server-side ownership validation, fixture-based regression tests, and a deployment process that validates a replacement before activating it.
