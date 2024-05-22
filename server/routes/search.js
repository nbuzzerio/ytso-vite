import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const router = express.Router();

router.get(
  "/",
  auth,
  asyncMiddleware(async (req, res) => {
    const youtube = google.youtube("v3");

    youtube.search
      .list({
        auth: process.env.YOUTUBE_API_KEY,
        part: "snippet",
        q: req.query.q,
        type: "channel",
        pageToken: req.query.nextPageToken,
      })
      .then((response) => {
        res.send({
          items: response.data.items,
          nextPageToken: response.data.nextPageToken,
        });
      })
      .catch((err) => res.send(err));
  }),
);

router.get(
  "/subVideos",
  auth,
  asyncMiddleware(async (req, res) => {
    const youtube = google.youtube("v3");

    youtube.channels
      .list({
        auth: process.env.YOUTUBE_API_KEY,
        id: req.query.channelId,
        part: "contentDetails",
        maxResults: 10,
        pageToken: req.query.nextPageToken,
      })
      .then((response) => {
        youtube.playlistItems
          .list({
            auth: process.env.YOUTUBE_API_KEY,
            playlistId:
              response.data.items[0].contentDetails.relatedPlaylists.uploads,
            part: "snippet, contentDetails",
            maxResults: 10,
          })
          .then((response) => {
            res.send(response.data);
          })
          .catch((err) => res.send(err));
      })
      .catch((err) => res.send(err));
  }),
);

export default router;
