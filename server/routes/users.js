import bcrypt from "bcrypt";
import { User, validate } from "../../database/models/users.js";
import mongoose from "mongoose";
import express from "express";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select("name");

  res.send(user);
});

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send({ error: error.details[0].message });

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send({ error: "User already registered." });

  const { name, email, password } = req.body;

  user = new User({
    name: name,
    email: email,
    password: password,
  });

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  const token = user.generateAuthToken();
  try {
    const result = await user.save();

    res.header("x-auth-token", token).send({
      _id: result._id,
      name: result.name,
      email: result.email,
      token: token,
    });
  } catch (ex) {
    for (let field in ex.errors) {
      console.log(ex.errors[field].message);
    }
  }
});

export default router;
