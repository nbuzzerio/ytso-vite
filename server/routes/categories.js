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
      const { categories } = await User.findById(decoded._id).select(
        "categories",
      );
      res.send(categories);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

router.get(
  "/subs",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const { categories } = await User.findById(decoded._id).select(
        "categories",
      );
      const category = categories.filter((category) =>
        category._id.equals(req.query.id),
      );

      res.send(category[0]);
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
      user.categories.push({
        categoryName: req.body.category,
        subs: [],
      });
      await user.save();

      res.send(user.categories);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

router.put(
  "/",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const user = await User.findById(decoded._id);

      const category = user.categories.filter((category) =>
        category._id.equals(req.body.categoryId),
      );

      category[0].subs.push(req.body.sub);
      await user.save();

      res.send(category[0]);
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
      user.categories = user.categories.filter(
        (category) => category.categoryName !== req.body.categoryName,
      );
      await user.save();
      res.send(user.categories);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

router.delete(
  "/sub",
  auth,
  asyncMiddleware(async (req, res) => {
    const token = req.header("x-auth-token");
    const decoded = jwt.verify(token, process.env.jwtPrivateKey);

    try {
      const user = await User.findById(decoded._id);
      const category = user.categories.filter((category) =>
        category._id.equals(req.body.categoryId),
      );
      category[0].subs = category[0].subs.filter(
        (sub) => sub.channelId !== req.body.channelId,
      );
      await user.save();
      res.send(category[0].subs);
    } catch (ex) {
      for (let field in ex.errors) {
        console.log(ex.errors[field].message);
      }
    }
  }),
);

export default router;
