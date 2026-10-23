import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  healthy,
  previousConfig,
  runtimeConfig,
} from "../scripts/deploy-state.mjs";
import { connectionConfig } from "../scripts/ssh-deploy.mjs";

const runtime = {
  jwtPrivateKey: "fixture-jwt",
  db: "fixture-db",
  YOUTUBE_API_KEY: "fixture-youtube",
  PORT: "3000",
  TRUST_PROXY_HOPS: "1",
};
const connection = {
  DEPLOY_HOST: "example.test",
  DEPLOY_USER: "ytso",
  DEPLOY_BASE_DIR: "/home/ytso/apps/ytso",
  DEPLOY_SSH_PRIVATE_KEY: "fixture-key",
  DEPLOY_KNOWN_HOSTS: "fixture-host-key",
};

test("SSH deployment rejects command injection, ambiguous paths, and missing host pins", () => {
  assert.equal(connectionConfig(connection).port, "22");
  for (const changes of [
    { DEPLOY_HOST: "-oProxyCommand=bad" },
    { DEPLOY_HOST: "host;bad" },
    { DEPLOY_USER: "root;bad" },
    { DEPLOY_USER: "root" },
    { DEPLOY_BASE_DIR: "/tmp/../etc" },
    { DEPLOY_BASE_DIR: "/" },
    { DEPLOY_BASE_DIR: "/tmp/app/" },
    { DEPLOY_BASE_DIR: "/tmp/app name" },
    { DEPLOY_SSH_PORT: "0" },
    { DEPLOY_SSH_PORT: "65536" },
    { DEPLOY_KNOWN_HOSTS: "" },
  ])
    assert.throws(() => connectionConfig({ ...connection, ...changes }));
});

test("runtime configuration validates without interpolating or exposing secret contents", () => {
  const value = "fixture'\n$(not-a-command)";
  assert.equal(
    runtimeConfig({ ...runtime, jwtPrivateKey: value, extra: "ignored" })
      .jwtPrivateKey,
    value,
  );
  assert.equal(
    runtimeConfig({ ...runtime, extra: "ignored" }).extra,
    undefined,
  );
  for (const changes of [
    { db: "" },
    { PORT: "0" },
    { PORT: "bad" },
    { TRUST_PROXY_HOPS: "-1" },
  ]) {
    assert.throws(() => runtimeConfig({ ...runtime, ...changes }));
  }
});

test("readiness requires JSON status and exact release identity, including legacy identity", () => {
  assert.ok(healthy({ status: "ok", releaseId: "expected" }, "expected"));
  assert.ok(healthy({ status: "ok", releaseId: null }, ""));
  for (const body of [
    null,
    "<html>ok</html>",
    { status: "ok", releaseId: "stale" },
    { status: "unavailable", releaseId: "expected" },
  ]) {
    assert.equal(healthy(body, "expected"), false);
  }
  assert.equal(healthy({ status: "ok", releaseId: "unexpected" }, ""), false);
});

test("rollback snapshot retains previous runtime credentials, execution mode, and identity", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ytso-deploy-snapshot-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "server"));
  await writeFile(path.join(directory, "server/index.js"), "");
  const snapshot = previousConfig([
    { name: "unrelated" },
    {
      name: "ytso",
      pm2_env: {
        pm_cwd: directory,
        exec_mode: "cluster_mode",
        instances: 2,
        env: { ...runtime, db: "old-database" },
        db: "actual-old-database",
        YTSO_RELEASE_ID: "old-release",
        PORT: "3001",
      },
    },
  ]);
  assert.equal(snapshot.apps[0].env.db, "actual-old-database");
  assert.equal(snapshot.apps[0].env.PORT, "3001");
  assert.equal(snapshot.apps[0].env.YTSO_RELEASE_ID, "old-release");
  assert.equal(snapshot.apps[0].exec_mode, "cluster");
  assert.equal(snapshot.apps[0].instances, 2);
  assert.deepEqual(previousConfig([]), { apps: [] });
});

test("production preparation succeeds without Husky or development dependencies", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ytso-prepare-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await copyFile(
    new URL("../scripts/prepare.mjs", import.meta.url),
    path.join(directory, "prepare.mjs"),
  );
  for (const environment of [{ HUSKY: "0" }, { NODE_ENV: "production" }]) {
    const result = spawnSync(
      process.execPath,
      [path.join(directory, "prepare.mjs")],
      { env: { ...process.env, ...environment }, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
  }
});

test("status-token validates the complete status and emits only the exact state", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ytso-status-token-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "status.json");
  const helper = new URL("../scripts/deploy-state.mjs", import.meta.url);
  const invoke = (command) =>
    spawnSync(process.execPath, [fileURLToPath(helper), command, filename], {
      encoding: "utf8",
    });
  const releaseId = "a".repeat(40);
  await writeFile(
    filename,
    JSON.stringify(
      { releaseId, note: '"state":"succeeded"', state: "preparing" },
      null,
      2,
    ),
  );
  assert.equal(invoke("status-token").stdout, "preparing\n");
  assert.equal(invoke("release-token").stdout, `${releaseId}\n`);
  for (const value of [
    null,
    {},
    { state: "unknown", releaseId },
    { state: "succeeded", releaseId: "bad" },
    { state: ["succeeded"], releaseId },
  ]) {
    await writeFile(filename, JSON.stringify(value));
    const result = invoke("status-token");
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
  await writeFile(filename, "{invalid");
  assert.equal(invoke("status-token").status, 1);
});

test("previous-token distinguishes an empty snapshot from unreadable or invalid state", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ytso-previous-token-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "previous.json");
  const helper = new URL("../scripts/deploy-state.mjs", import.meta.url);
  const invoke = () =>
    spawnSync(
      process.execPath,
      [fileURLToPath(helper), "previous-token", filename],
      { encoding: "utf8" },
    );
  assert.equal(invoke().status, 1);
  await writeFile(filename, '{"apps":[]}');
  assert.equal(invoke().stdout, "absent\n");
  for (const content of ["{invalid", "null", '{"apps":{}}', '{"apps":[{}]}']) {
    await writeFile(filename, content);
    const result = invoke();
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
});
