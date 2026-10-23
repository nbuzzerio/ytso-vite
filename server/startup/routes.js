import express from "express";
import auth from "../routes/auth.js";
import users from "../routes/users.js";
import groups from "../routes/groups.js";
import search from "../routes/search.js";
import subs from "../routes/subs.js";
import categories from "../routes/categories.js";
import error from "../middleware/error.js";

export default function createApiRouter() {
  const router = express.Router();
  router.use("/auth", auth);
  router.use("/users", users);
  router.use("/groups", groups);
  router.use("/search", search);
  router.use("/subs", subs);
  router.use("/categories", categories);
  router.use(error);
  return router;
}
