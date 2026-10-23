import bcrypt from "bcrypt";
import { User, validate } from "../../database/models/users.js";
import express from "express";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import { HttpError } from "../validation/request.js";
import { findUserByEmail, loadUser } from "../services/user-library.js";

export function createUsersRouter(UserModel = User) {
  const router = express.Router();

  router.get(
    "/me",
    auth,
    asyncMiddleware(async (req, res) => {
      const user = await loadUser(UserModel, req.user._id);
      res.json({ _id: user._id, name: user.name });
    }),
  );

  router.post(
    "/",
    asyncMiddleware(async (req, res) => {
      const { error, value } = validate(req.body);
      if (error) throw new HttpError(400, error.details[0].message);
      if (await findUserByEmail(UserModel, value.email)) {
        throw new HttpError(409, "An account with this email already exists.");
      }

      const user = new UserModel({
        name: value.name,
        email: value.email,
        password: await bcrypt.hash(value.password, 10),
      });
      await user.save();
      const token = user.generateAuthToken();
      res.header("x-auth-token", token).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token,
      });
    }),
  );

  return router;
}

export default createUsersRouter();
