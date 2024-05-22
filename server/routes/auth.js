import { User } from "../../database/models/users.js";
import mongoose from "mongoose";
import express from "express";
import Joi from "joi";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/", async (req, res) => {
  const { error } = validateUser(req.body);
  if (error) return res.status(400).send({ error: error.details[0].message });

  let user = await User.findOne({ email: req.body.email });
  if (!user)
    return res.status(400).send({ error: "Invalid email or password." });

  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (!validPassword)
    return res.status(400).send({ error: "Invalid email or password." });

  const token = user.generateAuthToken();

  res.send({ token });
});

function validateUser(req) {
  const schema = Joi.object({
    email: Joi.string().min(5).max(225).required().email(),
    password: Joi.string().min(5).max(255).required(),
  });

  return schema.validate(req);
}

export default router;
