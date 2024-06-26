import Joi from "joi";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 255,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 1024,
  },
  categories: {
    type: [
      {
        categoryName: {
          type: String,
        },
        subs: {
          type: [
            {
              subName: {
                type: String,
              },
              channelId: {
                type: String,
              },
              channelDesc: {
                type: String,
              },
              channelThumbnails: {
                default: {
                  type: String,
                },
                medium: {
                  type: String,
                },
                high: {
                  type: String,
                },
              },
            },
          ],
          sparse: true,
        },
      },
    ],
    sparse: true,
  },
  subs: {
    type: [
      {
        subName: {
          type: String,
        },
        channelId: {
          type: String,
        },
        channelDesc: {
          type: String,
        },
        channelThumbnails: {
          default: {
            type: String,
          },
          medium: {
            type: String,
          },
          high: {
            type: String,
          },
        },
      },
    ],
    sparse: true,
  },
  groups: {
    type: [
      {
        groupName: {
          type: String,
        },
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Groups" },
      },
    ],
    sparse: true,
  },
  isAdmin: {
    type: Boolean,
  },
});

userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { _id: this._id, isAdmin: this.isAdmin, name: this.name },
    process.env.jwtPrivateKey,
  );
};

const User = mongoose.model("YTSO-User", userSchema);

function validateUser(user) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().min(5).max(225).required().email(),
    password: Joi.string().min(5).max(255).required(),
  });

  return schema.validate(user);
}

export { User, validateUser as validate };
