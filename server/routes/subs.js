import express from "express";
import mongoose from "mongoose";
import { User, validate } from "../../database/models/users.js";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

router.get(
  "/",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const { subs } = await User.findById(decoded._id).select("subs");
      res.send(subs);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

router.post(
  "/",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const user = await User.findById(decoded._id);
      user.subs.push(req.body);
      await user.save();

      res.send(user.subs);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

router.delete(
  "/",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const user = await User.findById(decoded._id);
      user.subs = user.subs.filter(
        (sub) => sub.channelId !== req.body.channelId,
      );
      await user.save();

      res.send(user.subs);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

export default router;
