import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7000;

// Serve static files from the 'dist' folder
app.use(express.static(__dirname + "/dist"));

// Define a catch-all route to serve 'index.html'
app.get("*", (req, res) => {
  res.sendFile(__dirname + "/dist/index.html");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
