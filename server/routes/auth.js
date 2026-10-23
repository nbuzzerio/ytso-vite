import { User } from "../../database/models/users.js";
import express from "express";
import Joi from "joi";
import bcrypt from "bcrypt";
import asyncMiddleware from "../middleware/async.js";
import { HttpError, validateRequest } from "../validation/request.js";
import { findUserForLogin } from "../services/user-library.js";

const credentials = Joi.object({
  email: Joi.string().trim().min(5).max(255).email().required(),
  password: Joi.string().min(5).max(255).required(),
});

export function createAuthRouter(UserModel = User) {
  const router = express.Router();
  router.post(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(credentials, req.body);
      const user = await findUserForLogin(UserModel, input.email);
      if (!user || !(await bcrypt.compare(input.password, user.password))) {
        throw new HttpError(400, "Invalid email or password.");
      }
      res.json({ token: user.generateAuthToken() });
    }),
  );
  return router;
}

export default createAuthRouter();
