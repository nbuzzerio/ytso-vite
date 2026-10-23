import mongoose from "mongoose";
import { createApp } from "./app.js";
import config from "./startup/config.js";
import logger from "./startup/logger.js";
import initDatabase from "../database/index.js";
import createApiRouter from "./startup/routes.js";

async function start() {
  const settings = config();
  await initDatabase(logger, settings.databaseUri);

  const app = createApp({
    apiRouter: createApiRouter(),
    environment: settings.environment,
    readiness: () => mongoose.connection.readyState === 1,
    releaseId: process.env.YTSO_RELEASE_ID || null,
    logger,
    trustProxy: settings.trustProxy,
  });
  const listener = app.listen(settings.port, () => {
    logger.info(`Ready on port ${listener.address().port}`);
    // PM2 can wait until the database and HTTP listener are ready.
    if (process.send) process.send("ready");
  });
  listener.on("error", (error) => {
    logger.error("HTTP server failed to start", { message: error.message });
    process.exitCode = 1;
    mongoose.disconnect();
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10_000).unref();
    listener.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

start().catch((error) => {
  // Database errors can contain connection strings, so do not log their contents.
  logger.error(
    "Server startup failed. Check the server configuration and database availability.",
    {
      name: error.name,
    },
  );
  process.exitCode = 1;
});
