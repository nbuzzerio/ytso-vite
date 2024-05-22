import express from "express";
import auth from "../routes/auth.js";
import users from "../routes/users.js";
import groups from "../routes/groups.js";
import search from "../routes/search.js";
import subs from "../routes/subs.js";
import categories from "../routes/categories.js";
import error from "../middleware/error.js";

export default function (server) {
  server.use(express.json());
  server.use((req, res, next) => {
    res.set("Content-Security-Policy", "script-src 'self' 'unsafe-eval';");
    return next();
  });

  server.use("/api/auth", auth);
  server.use("/api/users", users);
  server.use("/api/groups", groups);
  server.use("/api/search", search);
  server.use("/api/subs", subs);
  server.use("/api/categories", categories);
  server.use(error);
}
