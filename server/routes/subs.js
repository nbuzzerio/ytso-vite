import express from "express";
import Joi from "joi";
import { User } from "../../database/models/users.js";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import { channel, channelId, validateRequest } from "../validation/request.js";
import { loadUser, updateLibrary } from "../services/user-library.js";
import { serializeChannels } from "../services/library-response.js";

export function createSubsRouter(UserModel = User) {
  const router = express.Router();
  router.use(auth);

  router.get(
    "/",
    asyncMiddleware(async (req, res) => {
      const user = await loadUser(UserModel, req.user._id);
      res.json(serializeChannels(user.subs));
    }),
  );

  router.post(
    "/",
    asyncMiddleware(async (req, res) => {
      const savedChannel = validateRequest(channel, req.body);
      const subs = await updateLibrary(UserModel, req.user._id, (user) => {
        if (
          !user.subs.some((item) => item.channelId === savedChannel.channelId)
        ) {
          user.subs.push(savedChannel);
        }
        return user.subs;
      });
      res.json(serializeChannels(subs));
    }),
  );

  router.delete(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({ channelId: channelId.required() }),
        req.body,
      );
      const subs = await updateLibrary(UserModel, req.user._id, (user) => {
        user.subs = user.subs.filter(
          (item) => item.channelId !== input.channelId,
        );
        for (const category of user.categories) {
          category.subs = category.subs.filter(
            (item) => item.channelId !== input.channelId,
          );
        }
        return user.subs;
      });
      res.json(serializeChannels(subs));
    }),
  );

  return router;
}

export default createSubsRouter();
