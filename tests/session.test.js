import test from "node:test";
import assert from "node:assert/strict";
import { decodeSession, isSessionValid } from "../src/features/auth/session.ts";

const now = 1_800_000_000_000;
const token = (claims) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test-signature`;

test("browser session accepts future expiry and preserves Unicode names", () => {
  const value = token({
    _id: "0123456789abcdef01234567",
    name: "Zoë 音楽",
    exp: now / 1000 + 60,
  });
  assert.equal(isSessionValid(value, now), true);
  assert.equal(decodeSession(value).name, "Zoë 音楽");
});

test("expired, non-expiring and malformed sessions cannot open protected screens", () => {
  for (const value of [
    "",
    "not-a-token",
    token({ _id: "user", exp: now / 1000 }),
    token({ _id: "user", exp: now / 1000 - 60 }),
    token({ _id: "user" }),
    token({ _id: "user", exp: "9999999999" }),
    token({ exp: now / 1000 + 60 }),
  ]) {
    assert.equal(isSessionValid(value, now), false);
  }
});
