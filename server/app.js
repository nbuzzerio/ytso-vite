import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import production from "./startup/production.js";
import rateLimiter from "./startup/rateLimiter.js";

const defaultDistDirectory = fileURLToPath(
  new URL("../dist/", import.meta.url),
);

// This factory performs no database connections, environment-file reads, or listening.
export function createApp({
  apiRouter = express.Router(),
  distDirectory = defaultDistDirectory,
  environment = "development",
  readiness = () => true,
  releaseId = null,
  logger,
  trustProxy = false,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.locals.logger = logger;
  production(app, { environment });
  app.use(["/ytso/api", "/api"], (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  const health = (_req, res) => {
    const ready = readiness();
    res.set("Cache-Control", "no-store");
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ok" : "unavailable", releaseId });
  };
  app.get(["/health", "/ytso/health"], health);

  const api = express.Router();
  if (environment === "production") rateLimiter(api);
  api.use(apiRouter);
  api.use((_req, res) =>
    res.status(404).json({ error: "API endpoint not found." }),
  );
  app.use(["/ytso/api", "/api"], api);

  const assets = express.static(distDirectory, {
    index: false,
    setHeaders(res, filePath) {
      if (path.basename(filePath) === "sw.js") {
        res.set("Content-Type", "application/javascript");
        res.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
      } else if (filePath.endsWith(".webmanifest")) {
        res.set("Content-Type", "application/manifest+json");
        res.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.set("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  });
  // Both mounts support proxies that preserve or strip the public /ytso prefix.
  app.use("/ytso", assets);
  app.use(assets);
  app.get("*", (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) return next();
    res.set("Cache-Control", "no-cache");
    res.sendFile(path.join(distDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "Resource not found." }),
  );
  // Includes malformed JSON and static-file errors outside the API router.
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;
    res.status(status).json({
      error:
        status === 400
          ? "Invalid request body."
          : status === 413
            ? "Request is too large."
            : "Request could not be completed.",
    });
  });
  return app;
}
