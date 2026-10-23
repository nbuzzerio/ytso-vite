import express from "express";
import auth from "../middleware/auth.js";
import asyncMiddleware from "../middleware/async.js";
import jwt from "jsonwebtoken";
import { Groups, validate } from "../../database/models/groups.js";
import { User } from "../../database/models/users.js";
import { HttpError, objectId, validateRequest } from "../validation/request.js";
import { loadUser, updateLibrary } from "../services/user-library.js";

export function createGroupsRouter({
  UserModel = User,
  GroupModel = Groups,
} = {}) {
  const router = express.Router();
  router.use(auth);

  function invite(temporary) {
    return asyncMiddleware(async (req, res) => {
      const id = validateRequest(objectId.required(), req.params.id);
      await loadUser(UserModel, req.user._id);
      const group = await GroupModel.findById(id);
      if (!group) throw new HttpError(404, "Group not found.");
      if (
        !group.members.some(
          (member) => String(member.member_id) === req.user._id,
        )
      ) {
        throw new HttpError(
          403,
          "You must be a member to create an invitation.",
        );
      }
      res.json({ inviteKey: group.generateInviteKey(temporary) });
    });
  }

  router.get("/invite/:id", invite(false));
  router.get("/timed-invite/:id", invite(true));

  router.post(
    "/",
    asyncMiddleware(async (req, res) => {
      // Owner and membership fields are never accepted from the client.
      const { error, value } = validate(req.body);
      if (error) throw new HttpError(400, error.details[0].message);
      const owner = await loadUser(UserModel, req.user._id);
      const group = new GroupModel({
        name: value.name,
        owner_id: owner._id,
        owner_name: owner.name,
        members: [
          { member_id: owner._id, member_name: owner.name, isAdmin: true },
        ],
      });
      await group.save();
      try {
        await updateLibrary(UserModel, req.user._id, (user) => {
          user.groups.push({ groupName: group.name, groupId: group._id });
        });
      } catch (error) {
        // Compensate when the account update fails without requiring a Mongo replica set.
        await GroupModel.deleteOne({ _id: group._id }).catch(() => {});
        throw error;
      }
      res.json(group);
    }),
  );

  router.post(
    "/join/:id",
    asyncMiddleware(async (req, res) => {
      let invite;
      try {
        invite = jwt.verify(req.params.id, process.env.jwtPrivateKey, {
          algorithms: ["HS256"],
          audience: "ytso-group-invite",
          issuer: "ytso",
        });
        if (!Number.isFinite(invite.exp)) throw new Error("Missing expiration");
      } catch {
        throw new HttpError(400, "This invitation is invalid or has expired.");
      }
      const id = validateRequest(objectId.required(), invite.groupId);
      const newcomer = await loadUser(UserModel, req.user._id);
      let group;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        group = await GroupModel.findById(id);
        if (!group) throw new HttpError(404, "Group not found.");
        if (
          group.members.some(
            (member) => String(member.member_id) === req.user._id,
          )
        )
          break;
        group.members.push({
          member_id: newcomer._id,
          member_name: newcomer.name,
          isAdmin: false,
        });
        try {
          await group.save();
          break;
        } catch (error) {
          if (error.name !== "VersionError" || attempt === 2) throw error;
        }
      }
      // An already joined group is safe to retry and repairs a previously interrupted account update.
      await updateLibrary(UserModel, req.user._id, (user) => {
        if (
          !user.groups.some(
            (item) => String(item.groupId) === String(group._id),
          )
        ) {
          user.groups.push({ groupName: group.name, groupId: group._id });
        }
      });
      res.json(group);
    }),
  );

  return router;
}

export default createGroupsRouter();
