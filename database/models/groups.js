import Joi from "joi";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const groupsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "YTSO-User",
    },
    owner_name: { type: String, required: true },
    members: [
      {
        member_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "YTSO-User",
        },
        member_name: { type: String, required: true },
        isAdmin: Boolean,
      },
    ],
  },
  { optimisticConcurrency: true },
);

groupsSchema.methods.generateInviteKey = function (temporary = false) {
  return jwt.sign({ groupId: String(this._id) }, process.env.jwtPrivateKey, {
    algorithm: "HS256",
    audience: "ytso-group-invite",
    issuer: "ytso",
    expiresIn: temporary ? "30m" : "7d",
  });
};

const Groups = mongoose.model("YTSO-groups", groupsSchema);

function validate(groups) {
  return Joi.object({
    name: Joi.string().trim().min(3).max(50).required(),
  })
    .required()
    .validate(groups);
}

export { Groups, validate };
