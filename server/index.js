import express from "express";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import config from "./startup/config.js";
import logger from "./startup/logger.js";
import initDatabase from "../database/index.js";
import validation from "./startup/validation.js";
import routes from "./startup/routes.js";
import production from "./startup/production.js";
import rateLimiter from "./startup/rateLimiter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();
initDatabase(logger);
validation();

const dev = process.env.NODE_ENV !== "production";
const app = express();

if (!dev) {
  rateLimiter(app);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'dist' folder (one level up from the current directory)
app.use(express.static(path.join(__dirname, "../dist")));

routes(app);
production(app);

// Define a catch-all route to serve 'index.html'
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});

const listener = app.listen(process.env.PORT || 3000, (err) => {
  if (err) throw err;
  logger.info(`> Ready on http://localhost:${process.env.PORT || 3000}`);
});

export default listener;
