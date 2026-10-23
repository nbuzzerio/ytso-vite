import Joi from "joi";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const objectId = Joi.string().hex().length(24);
export const channelId = Joi.string().pattern(/^[A-Za-z0-9_-]{1,128}$/);
export const categoryName = Joi.string().trim().min(1).max(80);

const thumbnail = Joi.string()
  .uri({ scheme: ["https"] })
  .max(2048)
  .allow("");
export const channel = Joi.object({
  // A previously returned channel can be restored, but its database ID is regenerated.
  _id: objectId.strip(),
  subName: Joi.string().trim().min(1).max(200).required(),
  channelId: channelId.required(),
  channelDesc: Joi.string().max(10000).allow("").default(""),
  channelThumbnails: Joi.object({
    default: thumbnail,
    medium: thumbnail,
    high: thumbnail,
  }).default({}),
});

export function validateRequest(schema, input) {
  const { error, value } = schema
    .required()
    .validate(input, { abortEarly: true });
  if (error) throw new HttpError(400, error.details[0].message);
  return value;
}

export function findCategory(user, id) {
  const category = user.categories.find((item) => String(item._id) === id);
  if (!category) throw new HttpError(404, "Category not found.");
  return category;
}
