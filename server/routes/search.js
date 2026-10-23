import express from "express";
import Joi from "joi";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import { channelId, validateRequest } from "../validation/request.js";
import { createYoutubeService } from "../services/youtube.js";

const pageToken = Joi.string()
  .max(1024)
  .pattern(/^[A-Za-z0-9_+=/-]+$/);

export function createSearchRouter(provider = createYoutubeService()) {
  const router = express.Router();
  router.use(auth);

  router.get(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({
          q: Joi.string().trim().min(1).max(200).required(),
          nextPageToken: pageToken,
        }),
        req.query,
      );
      res.json(await provider.search(input.q, input.nextPageToken));
    }),
  );

  router.get(
    "/subVideos",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({
          channelId: channelId.required(),
          nextPageToken: pageToken,
        }),
        req.query,
      );
      res.json(await provider.videos(input.channelId, input.nextPageToken));
    }),
  );

  return router;
}

export default createSearchRouter();
