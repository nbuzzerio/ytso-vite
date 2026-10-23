import Joi from "joi";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const channelSchema = new mongoose.Schema({
  // Request schemas validate new records. Preserve permissive embedded schemas so
  // unrelated edits do not force a destructive cleanup of older library records.
  subName: String,
  channelId: String,
  channelDesc: String,
  channelThumbnails: {
    default: String,
    medium: String,
    high: String,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 5,
      maxlength: 255,
      unique: true,
    },
    password: { type: String, required: true, minlength: 5, maxlength: 1024 },
    categories: [
      {
        categoryName: String,
        subs: [channelSchema],
      },
    ],
    subs: [channelSchema],
    groups: [
      {
        groupName: String,
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: "YTSO-groups" },
      },
    ],
    isAdmin: Boolean,
  },
  { optimisticConcurrency: true },
);

userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { _id: String(this._id), isAdmin: this.isAdmin, name: this.name },
    process.env.jwtPrivateKey,
    {
      algorithm: "HS256",
      expiresIn: "30d",
      audience: "ytso-session",
      issuer: "ytso",
    },
  );
};

const User = mongoose.model("YTSO-User", userSchema);

function validateUser(user) {
  return Joi.object({
    name: Joi.string().trim().min(3).max(50).required(),
    email: Joi.string().trim().lowercase().min(5).max(255).email().required(),
    password: Joi.string()
      .min(5)
      .max(72)
      .custom((value, helpers) => {
        if (Buffer.byteLength(value, "utf8") > 72)
          return helpers.message("Password must be at most 72 UTF-8 bytes.");
        return value;
      })
      .required(),
  })
    .required()
    .validate(user);
}

export { User, validateUser as validate };
