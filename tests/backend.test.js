import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../database/models/users.js";
import { Groups } from "../database/models/groups.js";
import { createAuthRouter } from "../server/routes/auth.js";
import { createUsersRouter } from "../server/routes/users.js";
import { createSubsRouter } from "../server/routes/subs.js";
import { createCategoriesRouter } from "../server/routes/categories.js";
import { createGroupsRouter } from "../server/routes/groups.js";
import { createSearchRouter } from "../server/routes/search.js";
import errorHandler from "../server/middleware/error.js";
import { createYoutubeService } from "../server/services/youtube.js";
import { updateLibrary } from "../server/services/user-library.js";
import {
  serializeCategory,
  serializeChannels,
} from "../server/services/library-response.js";

// No .env loading, MongoDB connection, or external API requests in this suite.
const previousKey = process.env.jwtPrivateKey;
process.env.jwtPrivateKey = "isolated-backend-regression-key-not-a-real-secret";
after(() => {
  if (previousKey === undefined) delete process.env.jwtPrivateKey;
  else process.env.jwtPrivateKey = previousKey;
});

const ids = {
  first: "aaaaaaaaaaaaaaaaaaaaaaaa",
  second: "bbbbbbbbbbbbbbbbbbbbbbbb",
  category: "cccccccccccccccccccccccc",
  otherCategory: "dddddddddddddddddddddddd",
};
const channel = {
  subName: "Example channel",
  channelId: "UC_example_channel",
  channelDesc: "A sample saved channel",
  channelThumbnails: { medium: "https://example.test/channel.jpg" },
};

async function harness(t, options = {}) {
  const users = new Map();
  const groups = new Map();
  const persistUser = (data) => {
    const document = new User(data);
    document.save = async () => {
      if (options.failSave)
        throw new Error("private database connection details");
      users.set(String(document._id), document);
      return document;
    };
    users.set(String(document._id), document);
    return document;
  };
  const first = persistUser({
    _id: ids.first,
    name: "First User",
    email: "first@example.com",
    password: "unused-test-password",
    subs: [channel],
    categories: [
      { _id: ids.category, categoryName: "Music", subs: [] },
      { _id: ids.otherCategory, categoryName: "Science", subs: [] },
    ],
  });
  const second = persistUser({
    _id: ids.second,
    name: "Second User",
    email: "second@example.com",
    password: "unused-test-password",
  });
  class UserModel {
    constructor(data) {
      return persistUser(data);
    }
    static async findById(id) {
      if (options.failFind)
        throw new Error("private database connection details");
      return users.get(String(id)) || null;
    }
    static async findOne(query) {
      if (options.failFind)
        throw new Error("private database connection details");
      return (
        [...users.values()].find((user) =>
          query.email instanceof RegExp
            ? query.email.test(user.email)
            : query.email === user.email,
        ) || null
      );
    }
    static find(query) {
      return {
        async limit(count) {
          if (options.failFind)
            throw new Error("private database connection details");
          return [...users.values()]
            .filter((user) => query.email.test(user.email))
            .slice(0, count);
        },
      };
    }
  }
  class GroupModel {
    constructor(data) {
      const document = new Groups(data);
      document.save = async () => {
        groups.set(String(document._id), document);
        return document;
      };
      return document;
    }
    static async findById(id) {
      return groups.get(String(id)) || null;
    }
    static async deleteOne(query) {
      groups.delete(String(query._id));
    }
  }
  const app = express();
  app.locals.logger = { error() {} };
  app.use(express.json());
  app.use("/auth", createAuthRouter(UserModel));
  app.use("/users", createUsersRouter(UserModel));
  app.use("/subs", createSubsRouter(UserModel));
  app.use("/categories", createCategoriesRouter(UserModel));
  app.use("/groups", createGroupsRouter({ UserModel, GroupModel }));
  app.use(
    "/search",
    createSearchRouter(
      options.provider || {
        async search() {
          return { items: [] };
        },
        async videos() {
          return { items: [] };
        },
      },
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const token = first.generateAuthToken();
  async function request(
    path,
    { method = "GET", body, authToken = token } = {},
  ) {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method,
        headers: {
          ...(authToken ? { "x-auth-token": authToken } : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  }
  return { request, first, second, users, groups, UserModel, GroupModel };
}

test("sessions expire after 30 days and reject expired, legacy, or invitation tokens", async (t) => {
  const { request, first } = await harness(t);
  const token = first.generateAuthToken();
  const decoded = jwt.verify(token, process.env.jwtPrivateKey);
  assert.equal(decoded.exp - decoded.iat, 30 * 24 * 60 * 60);
  const expired = jwt.sign({ _id: ids.first }, process.env.jwtPrivateKey, {
    expiresIn: -1,
    audience: "ytso-session",
    issuer: "ytso",
  });
  const legacy = jwt.sign({ _id: ids.first }, process.env.jwtPrivateKey);
  const invite = new Groups({
    name: "A group",
    owner_id: first._id,
    owner_name: first.name,
  }).generateInviteKey();
  for (const authToken of [undefined, expired, legacy, invite]) {
    const result = await request("/subs", { authToken: authToken || "" });
    assert.equal(result.status, 401);
    assert.equal(typeof result.body.error, "string");
  }
  assert.equal((await request("/subs")).status, 200);
});

test("saving channels is idempotent and validates input", async (t) => {
  const { request, first } = await harness(t);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await request("/subs", { method: "POST", body: channel });
    assert.equal(result.status, 200);
    assert.equal(result.body.length, 1);
  }
  assert.equal(first.subs.length, 1);
  const restored = await request("/subs", {
    method: "POST",
    body: { ...channel, _id: ids.category, channelId: "another-channel" },
  });
  assert.equal(restored.status, 200);
  assert.notEqual(restored.body[1]._id, ids.category);
  assert.equal(
    (await request("/subs", { method: "POST", body: { channelId: "bad id" } }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/subs", {
        method: "POST",
        body: { ...channel, owner_id: ids.second },
      })
    ).status,
    400,
  );
});

test("membership uses the authenticated user's saved channel and ignores spoofed metadata", async (t) => {
  const { request, first, second } = await harness(t);
  const body = {
    categoryId: ids.category,
    sub: { ...channel, subName: "Spoofed title" },
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await request("/categories", { method: "PUT", body });
    assert.equal(result.status, 200);
    assert.equal(result.body.subs.length, 1);
    assert.equal(result.body.subs[0].subName, channel.subName);
  }
  assert.equal(first.categories[0].subs.length, 1);
  assert.equal(second.categories.length, 0);
  assert.equal(
    (
      await request("/categories", {
        method: "PUT",
        body: { categoryId: ids.category, sub: { channelId: "not-saved" } },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/categories", {
        method: "PUT",
        body: { ...body, categoryId: ids.second },
      })
    ).status,
    404,
  );
});

test("removing a saved channel removes every category copy and supports repeated removal", async (t) => {
  const { request, first } = await harness(t);
  for (const category of first.categories) category.subs.push(channel);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await request("/subs", {
      method: "DELETE",
      body: { channelId: channel.channelId },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, []);
  }
  assert.ok(first.categories.every((category) => category.subs.length === 0));
});

test("categories have trimmed unique names and can be renamed and deleted by ID", async (t) => {
  const { request, first } = await harness(t);
  assert.equal(
    (
      await request("/categories", {
        method: "POST",
        body: { category: " music " },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/categories", {
        method: "POST",
        body: { category: "   " },
      })
    ).status,
    400,
  );
  const created = await request("/categories", {
    method: "POST",
    body: { category: "  Learning  " },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.at(-1).categoryName, "Learning");
  assert.equal(
    (
      await request("/categories", {
        method: "PATCH",
        body: { categoryId: ids.category, categoryName: " SCIENCE " },
      })
    ).status,
    409,
  );
  const renamed = await request("/categories", {
    method: "PATCH",
    body: { categoryId: ids.category, categoryName: "  Listening  " },
  });
  assert.equal(renamed.body.categoryName, "Listening");
  // Existing duplicate names cannot cause a multi-category deletion.
  first.categories[1].categoryName = "Listening";
  const removed = await request("/categories", {
    method: "DELETE",
    body: { categoryId: ids.category },
  });
  assert.equal(removed.status, 200);
  assert.ok(
    removed.body.some((category) => category._id === ids.otherCategory),
  );
  assert.ok(!removed.body.some((category) => category._id === ids.category));
  assert.equal(
    (
      await request("/categories", {
        method: "DELETE",
        body: { categoryName: "Listening" },
      })
    ).status,
    400,
  );
});

test("missing category and account paths return promptly with JSON errors", async (t) => {
  const { request, users } = await harness(t);
  assert.equal(
    (await request(`/categories/subs?id=${ids.second}`)).status,
    404,
  );
  assert.equal((await request("/categories/subs?id=invalid")).status, 400);
  assert.equal(
    (
      await request("/categories/sub", {
        method: "DELETE",
        body: { categoryId: ids.second, channelId: channel.channelId },
      })
    ).status,
    404,
  );
  users.delete(ids.first);
  assert.equal((await request("/subs")).status, 401);
});

test("legacy incomplete embedded records remain editable without destructive cleanup", async (t) => {
  const { request, first } = await harness(t);
  first.subs.push({ channelId: "legacy-channel" });
  first.subs.push({});
  first.categories.push({ subs: [{ channelId: "legacy-channel" }, {}] });
  const legacyCategory = first.categories[2];
  const categoryId = String(legacyCategory._id);
  const originalChannel = first.subs[1].toObject();
  const originalCategory = legacyCategory.toObject();
  const assertChannel = (entry) => {
    assert.equal(entry.subName, "Unnamed channel");
    assert.equal(entry.channelDesc, "");
    assert.deepEqual(entry.channelThumbnails, {
      default: "",
      medium: "",
      high: "",
    });
  };
  const assertCategory = (entry) => {
    assert.equal(entry.categoryName, "Unnamed category");
    assertChannel(entry.subs[0]);
    assertChannel(entry.subs[1]);
    assert.equal(entry.subs[1].channelId, "");
  };
  assert.equal(first.validateSync(), undefined);
  const saved = await request("/subs");
  assertChannel(saved.body[1]);
  assert.equal(saved.body[2].channelId, "");
  assertCategory((await request("/categories")).body[2]);
  assertCategory((await request(`/categories/subs?id=${categoryId}`)).body);

  for (const [method, body] of [
    ["POST", channel],
    ["DELETE", { channelId: "not-present" }],
  ]) {
    const result = await request("/subs", { method, body });
    assert.equal(result.status, 200);
    assertChannel(result.body[1]);
  }
  const result = await request("/categories", {
    method: "POST",
    body: { category: "New category" },
  });
  assert.equal(result.status, 200);
  assertCategory(result.body[2]);
  const membership = await request("/categories", {
    method: "PUT",
    body: { categoryId, sub: { channelId: "legacy-channel" } },
  });
  assertCategory(membership.body);
  const deleted = await request("/categories", {
    method: "DELETE",
    body: { categoryId: ids.second },
  });
  assertCategory(deleted.body[2]);
  const removed = await request("/categories/sub", {
    method: "DELETE",
    body: { categoryId, channelId: "not-present" },
  });
  assertChannel(removed.body[0]);
  assert.deepEqual(first.subs[1].toObject(), originalChannel);
  assert.deepEqual(legacyCategory.toObject(), originalCategory);
  assert.equal(first.subs[1].channelId, "legacy-channel");
  assert.equal(first.categories[2].categoryName, undefined);
  assert.equal(first.categories.at(-1).categoryName, "New category");

  // Renaming deliberately changes only the requested label, while nested legacy
  // metadata still receives the same response defaults as a GET request.
  const renamed = await request("/categories", {
    method: "PATCH",
    body: { categoryId, categoryName: "Repaired label" },
  });
  assert.equal(renamed.body.categoryName, "Repaired label");
  assertChannel(renamed.body.subs[0]);
  assert.equal(legacyCategory.subs[0].subName, undefined);
});

test("library serializers handle missing arrays and IDs without inventing identifiers", () => {
  const legacy = Object.freeze({ categoryName: "   " });
  assert.deepEqual(serializeCategory(legacy), {
    _id: "",
    categoryName: "Unnamed category",
    subs: [],
  });
  assert.deepEqual(serializeChannels(undefined), []);
  assert.equal(serializeChannels([null])[0].channelId, "");
  assert.equal(legacy.categoryName, "   ");
});

test("a failed database operation produces a safe JSON error without hanging", async (t) => {
  const { request } = await harness(t, { failFind: true });
  for (const [path, options] of [
    ["/subs", {}],
    [
      "/auth",
      {
        method: "POST",
        body: { email: "first@example.com", password: "example-password" },
      },
    ],
    [
      "/users",
      {
        method: "POST",
        body: {
          name: "Example User",
          email: "new@example.com",
          password: "example-password",
        },
      },
    ],
  ]) {
    const result = await request(path, options);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "Something went wrong. Please try again.");
    assert.ok(!JSON.stringify(result.body).includes("database"));
  }
});

test("library mutation retries a concurrent save against the latest document", async () => {
  let reads = 0;
  const latest = { subs: [channel], async save() {} };
  const stale = {
    subs: [],
    async save() {
      throw Object.assign(new Error("changed"), { name: "VersionError" });
    },
  };
  const UserModel = {
    async findById() {
      reads += 1;
      return reads === 1 ? stale : latest;
    },
  };
  const result = await updateLibrary(UserModel, ids.first, (user) => {
    if (!user.subs.some((sub) => sub.channelId === channel.channelId))
      user.subs.push(channel);
    return user.subs;
  });
  assert.equal(reads, 2);
  assert.equal(result.length, 1);
});

test("group creation rejects ownership spoofing and derives owner from the session", async (t) => {
  const { request, first, second, groups } = await harness(t);
  const spoofed = await request("/groups", {
    method: "POST",
    body: { name: "A group", owner_id: ids.second, owner_name: second.name },
  });
  assert.equal(spoofed.status, 400);
  assert.equal(second.groups.length, 0);
  assert.equal(groups.size, 0);
  const created = await request("/groups", {
    method: "POST",
    body: { name: "A group" },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.owner_id, ids.first);
  assert.equal(created.body.members[0].member_id, ids.first);
  assert.equal(first.groups.length, 1);
  assert.equal(second.groups.length, 0);
});

test("group creation compensates when its account update fails", async (t) => {
  const { request, groups } = await harness(t, { failSave: true });
  const result = await request("/groups", {
    method: "POST",
    body: { name: "A group" },
  });
  assert.equal(result.status, 500);
  assert.equal(groups.size, 0);
});

test("signed invitations have expiry, survive document reload, and joins are idempotent", async (t) => {
  const { request, second, groups } = await harness(t);
  const created = await request("/groups", {
    method: "POST",
    body: { name: "A group" },
  });
  const groupId = created.body._id;
  assert.equal(
    (
      await request(`/groups/invite/${groupId}`, {
        authToken: second.generateAuthToken(),
      })
    ).status,
    403,
  );
  const result = await request(`/groups/timed-invite/${groupId}`);
  const decoded = jwt.verify(result.body.inviteKey, process.env.jwtPrivateKey, {
    audience: "ytso-group-invite",
  });
  assert.equal(decoded.exp - decoded.iat, 30 * 60);
  const longInvite = await request(`/groups/invite/${groupId}`);
  const longDecoded = jwt.decode(longInvite.body.inviteKey);
  assert.equal(longDecoded.exp - longDecoded.iat, 7 * 24 * 60 * 60);
  // A fresh model instance verifies with the same configured key, without process-local crypto state.
  const reloaded = new Groups(groups.get(groupId).toObject());
  assert.equal(
    jwt.verify(reloaded.generateInviteKey(), process.env.jwtPrivateKey).groupId,
    groupId,
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.equal(
      (
        await request(`/groups/join/${result.body.inviteKey}`, {
          method: "POST",
          authToken: second.generateAuthToken(),
        })
      ).status,
      200,
    );
  }
  assert.equal(groups.get(groupId).members.length, 2);
  assert.equal(second.groups.length, 1);
  assert.equal(
    (await request("/groups/join/not-a-token", { method: "POST" })).status,
    400,
  );
});

test("signup rejects duplicate accounts and bcrypt-truncated passwords; /me omits private fields", async (t) => {
  const { request } = await harness(t);
  const duplicate = await request("/users", {
    method: "POST",
    body: {
      name: "A Person",
      email: "FIRST@EXAMPLE.COM",
      password: "valid-password",
    },
  });
  assert.equal(duplicate.status, 409);
  const tooLong = await request("/users", {
    method: "POST",
    body: {
      name: "A Person",
      email: "new@example.com",
      password: "\u00e9".repeat(40),
    },
  });
  assert.equal(tooLong.status, 400);
  assert.match(tooLong.body.error, /72 UTF-8 bytes/);
  const me = await request("/users/me");
  assert.deepEqual(Object.keys(me.body).sort(), ["_id", "name"]);
});

test("login accepts legacy mixed-case email and returns a scoped expiring session", async (t) => {
  const { request, first } = await harness(t);
  first.password = await bcrypt.hash("test-password", 4);
  // Simulate an old account hydrated before the lowercasing setter was introduced.
  first._doc.email = "Mixed.Case@Example.Com";
  const loggedIn = await request("/auth", {
    method: "POST",
    body: { email: "MIXED.CASE@example.com", password: "test-password" },
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(jwt.decode(loggedIn.body.token).aud, "ytso-session");
  assert.equal(
    (
      await request("/auth", {
        method: "POST",
        body: { email: "mixed.case@example.com", password: "wrong-password" },
      })
    ).status,
    400,
  );
});

test("legacy email case collisions select only exact accounts and reject ambiguous fallback", async (t) => {
  const { request, first, second } = await harness(t);
  first._doc.email = "Alice@Example.Com";
  second._doc.email = "alice@example.com";
  first.password = await bcrypt.hash("first-password", 4);
  second.password = await bcrypt.hash("second-password", 4);

  for (const [email, password, expectedId] of [
    ["  Alice@Example.Com  ", "first-password", ids.first],
    ["alice@example.com", "second-password", ids.second],
  ]) {
    const result = await request("/auth", {
      method: "POST",
      body: { email, password },
    });
    assert.equal(result.status, 200);
    assert.equal(jwt.decode(result.body.token)._id, expectedId);
  }
  for (const [email, password] of [
    ["ALICE@example.com", "first-password"],
    ["ALICE@example.com", "second-password"],
    ["Alice@Example.Com", "second-password"],
    ["alice@example.com", "first-password"],
  ]) {
    const result = await request("/auth", {
      method: "POST",
      body: { email, password },
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "Invalid email or password.");
  }
  const duplicate = await request("/users", {
    method: "POST",
    body: {
      name: "New Alice",
      email: "ALICE@example.com",
      password: "new-password",
    },
  });
  assert.equal(duplicate.status, 409);
});

test("search rejects invalid queries and awaits provider errors", async (t) => {
  let searches = 0;
  const { request } = await harness(t, {
    provider: {
      async search() {
        searches += 1;
        throw Object.assign(new Error("Try later."), { status: 503 });
      },
      async videos() {
        return { items: [] };
      },
    },
  });
  assert.equal((await request("/search?q=%20%20")).status, 400);
  assert.equal(searches, 0);
  const failed = await request("/search?q=music");
  assert.equal(failed.status, 503);
  assert.equal(failed.body.error, "Try later.");
  assert.equal(
    (await request("/search/subVideos?channelId=bad%20id")).status,
    400,
  );
});

test("YouTube upload pagination uses playlist tokens and caches channel resolution", async () => {
  const channelCalls = [];
  const videoCalls = [];
  const provider = createYoutubeService({
    getApiKey: () => "fixture-key",
    youtube: {
      channels: {
        async list(params) {
          channelCalls.push(params);
          return {
            data: {
              items: [
                {
                  contentDetails: {
                    relatedPlaylists: { uploads: "upload-playlist" },
                  },
                },
              ],
            },
          };
        },
      },
      playlistItems: {
        async list(params) {
          videoCalls.push(params);
          return { data: { items: [{ id: params.pageToken || "first" }] } };
        },
      },
    },
  });
  await provider.videos(channel.channelId);
  await provider.videos(channel.channelId, "next-page");
  await provider.videos(channel.channelId, "next-page");
  assert.equal(channelCalls.length, 1);
  assert.equal(videoCalls.length, 2);
  assert.equal(videoCalls[1].pageToken, "next-page");
  assert.equal(videoCalls[1].playlistId, "upload-playlist");
  assert.equal(channelCalls[0].pageToken, undefined);
});

test("YouTube quota failures never expose provider credentials or response objects", async () => {
  const provider = createYoutubeService({
    getApiKey: () => "private-fixture-key",
    youtube: {
      search: {
        async list() {
          throw {
            response: { status: 403 },
            message: "https://provider.test?key=private-fixture-key",
          };
        },
      },
    },
  });
  await assert.rejects(provider.search("music"), (error) => {
    assert.equal(error.status, 503);
    assert.ok(!error.message.includes("private-fixture-key"));
    return true;
  });
  const missing = createYoutubeService({
    getApiKey: () => "fixture-key",
    youtube: {
      channels: {
        async list() {
          return { data: { items: [] } };
        },
      },
    },
  });
  await assert.rejects(missing.videos(channel.channelId), { status: 404 });
});
