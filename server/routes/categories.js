import express from "express";
import Joi from "joi";
import { User } from "../../database/models/users.js";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import {
  categoryName,
  channelId,
  objectId,
  validateRequest,
  findCategory,
  HttpError,
} from "../validation/request.js";
import { loadUser, updateLibrary } from "../services/user-library.js";
import {
  serializeCategories,
  serializeCategory,
  serializeChannels,
} from "../services/library-response.js";

function assertUniqueName(user, name, excludedId) {
  if (
    user.categories.some(
      (category) =>
        String(category._id) !== excludedId &&
        typeof category.categoryName === "string" &&
        category.categoryName.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new HttpError(409, "A category with this name already exists.");
  }
}

export function createCategoriesRouter(UserModel = User) {
  const router = express.Router();
  router.use(auth);

  router.get(
    "/",
    asyncMiddleware(async (req, res) => {
      const user = await loadUser(UserModel, req.user._id);
      res.json(serializeCategories(user.categories));
    }),
  );

  router.get(
    "/subs",
    asyncMiddleware(async (req, res) => {
      const { id } = validateRequest(
        Joi.object({ id: objectId.required() }),
        req.query,
      );
      const user = await loadUser(UserModel, req.user._id);
      res.json(serializeCategory(findCategory(user, id)));
    }),
  );

  router.post(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({ category: categoryName.required() }),
        req.body,
      );
      const categories = await updateLibrary(
        UserModel,
        req.user._id,
        (user) => {
          assertUniqueName(user, input.category);
          user.categories.push({ categoryName: input.category, subs: [] });
          return user.categories;
        },
      );
      res.json(serializeCategories(categories));
    }),
  );

  router.patch(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({
          categoryId: objectId.required(),
          categoryName: categoryName.required(),
        }),
        req.body,
      );
      const category = await updateLibrary(UserModel, req.user._id, (user) => {
        const category = findCategory(user, input.categoryId);
        assertUniqueName(user, input.categoryName, input.categoryId);
        category.categoryName = input.categoryName;
        return category;
      });
      res.json(serializeCategory(category));
    }),
  );

  router.put(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({
          categoryId: objectId.required(),
          // Metadata from older clients is accepted, but the saved record is authoritative.
          sub: Joi.object({ channelId: channelId.required() })
            .unknown(true)
            .required(),
        }),
        req.body,
      );
      const category = await updateLibrary(UserModel, req.user._id, (user) => {
        const category = findCategory(user, input.categoryId);
        const savedChannel = user.subs.find(
          (item) => item.channelId === input.sub.channelId,
        );
        if (!savedChannel)
          throw new HttpError(
            404,
            "Save this channel before adding it to a category.",
          );
        if (
          !category.subs.some(
            (item) => item.channelId === savedChannel.channelId,
          )
        ) {
          const record = savedChannel.toObject
            ? savedChannel.toObject()
            : { ...savedChannel };
          delete record._id;
          category.subs.push(record);
        }
        return category;
      });
      res.json(serializeCategory(category));
    }),
  );

  router.delete(
    "/",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({ categoryId: objectId.required() }),
        req.body,
      );
      const categories = await updateLibrary(
        UserModel,
        req.user._id,
        (user) => {
          // Repeating a delete is harmless, including after another tab already removed it.
          user.categories = user.categories.filter(
            (item) => String(item._id) !== input.categoryId,
          );
          return user.categories;
        },
      );
      res.json(serializeCategories(categories));
    }),
  );

  router.delete(
    "/sub",
    asyncMiddleware(async (req, res) => {
      const input = validateRequest(
        Joi.object({
          categoryId: objectId.required(),
          channelId: channelId.required(),
        }),
        req.body,
      );
      const subs = await updateLibrary(UserModel, req.user._id, (user) => {
        const category = findCategory(user, input.categoryId);
        category.subs = category.subs.filter(
          (item) => item.channelId !== input.channelId,
        );
        return category.subs;
      });
      res.json(serializeChannels(subs));
    }),
  );

  return router;
}

export default createCategoriesRouter();
