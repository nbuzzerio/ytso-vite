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

| Layer             | Tools                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Frontend          | React 18, Vite, TypeScript, React Router, Tailwind CSS               |
| Data fetching     | TanStack React Query and a shared typed fetch client                 |
| Forms             | React Hook Form and Yup                                              |
| Backend           | Node.js 24+, Express, JavaScript ES modules                          |
| Database          | MongoDB with Mongoose                                                |
| Server validation | Joi                                                                  |
| Testing           | Node's built-in test runner and a Chrome/Chromium browser harness    |
| Hosting           | Express serves the Vite build; hosted Actions deploy over SSH to PM2 |

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

The GitHub workflow runs `npm ci`, lint, Node tests, Linux deployment integration tests, the build, and both browser suites on hosted Ubuntu runners. Failed browser checks retain screenshots and a diagnostic report. Deployment uses a second hosted runner and native OpenSSH/SCP, with no self-hosted runner or third-party deployment action. It downloads only the verified release artifact from the same workflow run. Pull requests never deploy; deployment additionally requires `master`, `DEPLOY_ENABLED=true`, and the `production` GitHub environment's approval rules.

### One-time manual administrator setup

These steps change infrastructure and credentials. They are not performed by the workflow or authorized by repository implementation alone.

1. Identify the Unix account and `PM2_HOME` that already own the `ytso` process. Use that same PM2 instance; another account normally creates a separate daemon. Prefer a dedicated non-root YTSO account. If the existing app belongs to root or an account shared by unrelated services, resolve that access boundary separately before enabling deployment. Do not grant unrestricted sudo or use a root SSH deployment key.
2. Confirm Node.js 24, npm, PM2, Bash, Python 3.11+, GNU `tar`, `curl`, `flock`, `setsid`, `timeout`, `nohup`, and `realpath`. Set a stable noninteractive SSH `PATH` containing the intended Node/npm/PM2 versions; the hosted runner's `setup-node` does not install Node on the droplet. Native package fallback builds may require Python, make, and a C++ compiler. The droplet needs outbound npm registry access; it needs neither GitHub credentials nor the repository checkout.
3. Preserve the existing absolute base directory, normally `/home/ACCOUNT/apps/ytso`. It must be owned by the deployment account and contain no symlink path components. Provision account-owned `incoming`, `releases`, and `deployments` subdirectories with mode `0700`. Keep existing release directories, PM2 startup service, saved process state, reverse proxy, TLS, port, MongoDB access, and `/ytso/` configuration intact. Ensure sufficient disk space for dependencies and retained releases.
4. Generate a dedicated Ed25519 deployment key on a trusted administrator machine, for example `ssh-keygen -t ed25519 -f ytso-actions -C ytso-actions`. Install only the public key in the chosen account's `authorized_keys`. Use `restrict` to disable PTY, agent/X11, and port forwarding. This still permits shell execution and SFTP; it is not a command sandbox. A forced-command policy requires a separately reviewed dispatcher supporting both transfer and deployment commands. Store the private key as the GitHub environment secret below, then protect/remove the administrator's temporary copy according to your credential policy. An unattended key has no passphrase; its account permissions and GitHub access are the security boundary.
5. Obtain and verify the server's SSH host-key fingerprint through the DigitalOcean console or another trusted administrative channel. Populate `DEPLOY_KNOWN_HOSTS` with the verified OpenSSH known-hosts line, using `[hostname]:port` for a nonstandard port. Do not bootstrap trust from an unchecked `ssh-keyscan` in Actions. Both SSH and SCP require `StrictHostKeyChecking=yes`; a changed host key stops deployment until an administrator verifies and updates the pin.
6. Confirm the droplet's firewall permits SSH from the intended hosted runner. Standard GitHub-hosted runner addresses change; a fixed administrator-IP allowlist will block them. Choose an approved network access policy before enabling deployment. This workflow does not open firewall ports, call the DigitalOcean API, or provision a VPN.
7. Create a GitHub `production` environment, restrict deployment branches to `master`, and require a human reviewer. Keep `DEPLOY_ENABLED` absent or `false` until setup, review, and local verification are complete. Configure the following names without printing their values.

| Name                     | Type                            | Required / default                                               |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------- |
| `DEPLOY_SSH_PRIVATE_KEY` | Production environment secret   | Dedicated private SSH key; required                              |
| `jwtPrivateKey`          | Production environment secret   | Existing JWT signing key; required                               |
| `db`                     | Production environment secret   | Existing MongoDB connection string; required                     |
| `YOUTUBE_API_KEY`        | Production environment secret   | Existing YouTube API key; required                               |
| `PORT`                   | Optional environment secret     | Preserve existing upstream port; default `3000`                  |
| `DEPLOY_ENABLED`         | Repository variable             | Explicit activation gate; only literal `true` enables deployment |
| `DEPLOY_HOST`            | Production environment variable | DNS hostname or IPv4 address; required                           |
| `DEPLOY_USER`            | Production environment variable | Non-root application/deployment account; required                |
| `DEPLOY_SSH_PORT`        | Optional environment variable   | Default `22`                                                     |
| `DEPLOY_BASE_DIR`        | Production environment variable | Existing absolute YTSO base directory; required                  |
| `DEPLOY_KNOWN_HOSTS`     | Production environment variable | Independently verified server host-key line(s); required         |
| `TRUST_PROXY_HOPS`       | Optional environment variable   | Preserve actual trusted proxy topology; default `0`              |

Host-key pins are public but integrity-sensitive. Restrict who can change deployment settings and workflows. Host, user, and directory inputs allow no shell metacharacters or spaces; this implementation supports DNS/IPv4 SSH destinations. No DigitalOcean API token or GitHub PAT is needed. Keep application secrets out of build artifacts and source control. PM2's process dump and the deployment configuration snapshots contain runtime credentials and must remain accessible only to their owner. Do not print `pm2 jlist`, configuration JSON, or protected worker logs into Actions output.

### Automated deployment

The hosted runner verifies the artifact checksum, creates a unique incoming directory for the run and attempt, and uploads the archive, scripts, and a private runtime JSON file. Runtime values are serialized as data rather than inserted into remote shell commands. The archive embeds the full commit SHA. Before extraction, the droplet verifies its digest and identity, required files, size limits, and safe regular-file/directory entries; links and traversal paths are rejected.

`scripts/deploy-release.sh` starts a detached, time-bounded host worker. An SSH disconnect or Actions cancellation does not terminate its activation/rollback work. The worker holds a host-side `flock` through preparation, activation, and rollback; Actions also serializes production deployment jobs. A competing host worker reports `busy` without touching PM2.

The worker creates `releases/<short-SHA>-<random-suffix>`, installs using `HUSKY=0 NODE_ENV=production npm ci --omit=dev`, and keeps dependency lifecycle scripts enabled. The preparation helper skips Husky before importing development tooling. The current application continues serving during validation and installation. Before switching, the worker snapshots the existing YTSO PM2 environment, directory, identity, interpreter, arguments, and execution mode into owner-only storage, and verifies the previous app's health. A legacy app returning HTML from `/health` fails this preflight and requires manual migration planning.

Activation uses PM2's existing `startOrReload` model and preserves its fork/cluster layout. Readiness requires JSON `status: "ok"` plus the exact candidate SHA before `pm2 save`. A failed activation restores the previous configuration, credentials, port, and identity; it verifies rollback before saving. Failed rollback leaves the previously saved PM2 state untouched and blocks subsequent activations. On a first installation with no previous process, a failed candidate is removed without saving it. No database schema migration or proxy change is performed. Fork-mode reload can briefly interrupt requests; this migration does not promise zero-downtime activation or change the process topology.

Private files under `deployments/<job>/` include atomic, flushed `status.json`, `previous.json`, and an activation marker. `active-deployment` records the last worker. The worker is limited to 20 minutes, installation to 10 minutes, with up to three additional minutes for forced termination after timeout. Actions polls for up to 24 minutes inside a 30-minute job. A failed or timed-out poll is not proof that the host worker stopped.

### Initial deployment and human approval

After reviewing the repository changes and completing manual setup, cancel the obsolete workflow waiting for a self-hosted runner. Its existing non-canceling concurrency group can otherwise block the replacement workflow; changing YAML cannot alter that queued run. Canceling that queued run does not stop the application.

**Approval checkpoint:** an administrator must explicitly approve the first production deployment before setting repository variable `DEPLOY_ENABLED=true` and approving the first job in the protected `production` environment. Do not enable this gate merely to validate repository code. Preparing SSH access, changing firewall rules, publishing these changes, and activating a release each require their own applicable authorization.

For the approved first run, use `master` and verify all CI checks, the displayed deployment job ID, final `succeeded` status, expected SHA at loopback `/health`, and the public HTTPS `/ytso/` route. Confirm the existing port, proxy behavior, PM2 startup persistence, and rollback release remain intact. The workflow logs only deployment identity and sanitized status; it never retrieves host worker logs.

### Status, interruption recovery, and rollback

These are manual operational commands on the droplet, run as the application account after appropriate authorization. Replace `BASE` and `JOB` with the configured base and the exact job ID printed by Actions:

```bash
bash BASE/incoming/JOB/deploy-release.sh status BASE JOB
bash BASE/incoming/JOB/deploy-release.sh recover BASE JOB
```

`status` returns only the state and candidate release SHA. `recover` starts a detached recovery worker for the current active deployment and uses the same lock. If a new job reports `blocked`, recover the older job named by the nonsecret `BASE/active-deployment` file, not the blocked job. If the original worker still holds the lock, recovery does not interfere with it. For a worker killed during activation or a host reboot, recovery restores the durable previous configuration and verifies its identity; interrupted preparation is marked failed without altering PM2. Later deployments refuse to proceed while an earlier activation has unresolved state. Re-run `status` until recovery reaches `rolled_back` or `preparation_failed`; `activation_failed` means there was no previous application and the failed first candidate was removed.

For `rollback_failed`, inspect only protected host diagnostics and correct the underlying problem before retrying recovery. Do not delete the lock, edit the active pointer, invoke `pm2 save`, or remove snapshots to bypass an unresolved deployment. Recovery must be run when orphaned activation commands are quiescent; if an administrator kills processes, terminate the detached deployment process group rather than only its shell. Recovery verifies the current active-job pointer and does not roll back an unrelated newer deployment. A healthy `succeeded` deployment is not automatically reverted by `recover`; a discretionary rollback of a successful release requires a separately approved operator procedure using the protected previous configuration and health checks.

Recovery fails closed if the previous snapshot is unreadable or malformed; it never treats that failure as an empty first installation. Failed first-install cleanup deletes a YTSO process only when its release SHA, working directory, and script path all match the candidate. An unexpected, unidentified, or unrelated process remains untouched, reports `rollback_failed`, and blocks further activation pending administrator review. Workers use validated status tokens rather than matching serialized JSON; a completed job cannot be replayed to overwrite its original rollback snapshot. Interrupted recovery can be retried with the same durable snapshot.

The lock survives SSH disconnects and is released by process exit, not by deleting its file. PM2's existing boot service remains responsible for reboot recovery; after boot, resolve any interrupted deployment before another activation. Archive uploads interrupted before `start` leave the running app unchanged. Retain incoming scripts as well as release directories for recovery. Plan owner-only, bounded cleanup of completed deployments under the same lock, retaining the active release, rollback target, their scripts/configuration, and any unresolved deployment. No automatic release deletion is included.

Run `npm run test:deploy` on Linux with Bash, Python 3.11+, GNU utilities, and Node 24. The isolated tests use temporary directories and fake PM2/network tools, plus a real offline npm lifecycle fixture; they never contact DigitalOcean. They cover archive validation, preparation/activation failures, identity checks, rollback, locking, hard interruption, SSH option enforcement, and production-only installation. The ordinary `npm test` suite remains cross-platform.

## Compatibility Notes

Existing saved-channel and category documents remain compatible; this update does not require a database migration. Membership is validated and deduplicated while retaining the existing embedded document format.

New sessions expire after 30 days. Old sessions without an expiration or the current token audience/issuer require users to sign in again once.

Group invitations now use signed tokens. Regenerate invitations created by the previous implementation.

## 🧑‍💻 Developer Takeaways

This project demonstrates feature-oriented React organization, typed API access, server-side ownership validation, fixture-based regression tests, and a deployment process that validates a replacement before activating it.
