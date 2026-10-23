import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  cp,
  chmod,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";

const candidateId = "a".repeat(40);
const previousId = "b".repeat(40);
const root = path.resolve(import.meta.dirname, "..");
const runtime = {
  jwtPrivateKey: "new-jwt",
  db: "new-db",
  YOUTUBE_API_KEY: "new-youtube",
  PORT: "3000",
  TRUST_PROXY_HOPS: "1",
};
const fixtureCommand = `#!/usr/bin/env node
import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const base=process.env.FIXTURE_BASE;
const command=path.basename(process.argv[1]);
const args=process.argv.slice(2);
const behavior=JSON.parse(readFileSync(base+'/behavior.json','utf8'));
const read=()=>JSON.parse(readFileSync(base+'/live.json','utf8'));
const log=value=>appendFileSync(base+'/calls',JSON.stringify(value)+'\\n');
if(command==='npm') {
 log({command,args});
 if(behavior.prepareFail) process.exit(1);
} else if(command==='pm2') {
 if(args[0]==='jlist') { const app=read().apps[0]; console.log(JSON.stringify(app?[{name:'ytso',pm2_env:{...app.env,env:app.env,pm_cwd:app.cwd,pm_exec_path:path.join(app.cwd,'server/index.js'),exec_mode:'fork_mode',instances:1}}]:[])); }
 else if(args[0]==='startOrReload') {
  const config=JSON.parse(readFileSync(args[1],'utf8'));
  const candidate=config.apps[0].env.YTSO_RELEASE_ID==='${candidateId}';
  log({command,action:'activate',candidate});
  if(candidate && behavior.activationFail || !candidate && behavior.rollbackFail) {
   if(candidate && behavior.partialStart) {
    const app=config.apps[0];
    if(behavior.partialStart==='unexpected') app.env.YTSO_RELEASE_ID='${previousId}';
    if(behavior.partialStart==='unidentified') delete app.env.YTSO_RELEASE_ID;
    if(behavior.partialStart==='other-directory') app.cwd=base+'/releases/old';
    writeFileSync(base+'/live.json',JSON.stringify(config));
   }
   if(candidate && behavior.failRollbackHealth) writeFileSync(base+'/behavior.json',JSON.stringify({...behavior,rollbackWrongIdentity:true}));
   process.exit(1);
  }
  writeFileSync(base+'/live.json',JSON.stringify(config));
  if(candidate && behavior.interrupt) { writeFileSync(base+'/activated','ready'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000); }
  if(!candidate && behavior.interruptRollback) { writeFileSync(base+'/recovering','ready'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000); }
 } else if(args[0]==='save') log({command,action:'save',releaseId:read().apps[0]?.env.YTSO_RELEASE_ID});
 else if(args[0]==='delete') { log({command,action:'delete'}); writeFileSync(base+'/live.json','{"apps":[]}'); }
 else process.exit(1);
} else if(command==='curl') {
 const app=read().apps[0];
 if(!app) process.exit(1);
 console.log(JSON.stringify({status:'ok',releaseId:behavior.wrongIdentity && app.env.YTSO_RELEASE_ID==='${candidateId}' || behavior.rollbackWrongIdentity && app.env.YTSO_RELEASE_ID==='${previousId}'?'stale':app.env.YTSO_RELEASE_ID}));
} else if(command==='sleep') process.exit(0);
else process.exit(1);
`;

async function fixture(context, behavior = {}) {
  assert.equal(
    process.platform,
    "linux",
    "Deployment integration tests require Linux, Bash, flock, Python 3, and Node 24",
  );
  const base = await mkdtemp(path.join(tmpdir(), "ytso-deployment-test-"));
  context.after(async () => {
    assert.equal(path.dirname(base), path.resolve(tmpdir()));
    assert.ok(path.basename(base).startsWith("ytso-deployment-test-"));
    await rm(base, { recursive: true, force: true });
  });
  for (const directory of [
    "incoming",
    "releases/old/server",
    "deployments",
    "bin",
    "bundle/dist",
    "bundle/server",
    "bundle/database",
    "bundle/scripts",
  ])
    await mkdir(path.join(base, directory), { recursive: true });
  await writeFile(path.join(base, "releases/old/server/index.js"), "");
  await writeFile(path.join(base, "behavior.json"), JSON.stringify(behavior));
  await writeFile(path.join(base, "calls"), "");
  await writeFile(
    path.join(base, "live.json"),
    JSON.stringify({
      apps: [
        {
          name: "ytso",
          cwd: path.join(base, "releases/old"),
          env: {
            ...runtime,
            db: "old-db",
            jwtPrivateKey: "old-jwt",
            PORT: "3001",
            YTSO_RELEASE_ID: previousId,
          },
        },
      ],
    }),
  );
  for (const name of ["npm", "pm2", "curl", "sleep"]) {
    const filename = path.join(base, "bin", name);
    await writeFile(filename, fixtureCommand);
    await chmod(filename, 0o755);
  }
  for (const filename of [
    "dist/index.html",
    "dist/sw.js",
    "dist/manifest.webmanifest",
    "server/index.js",
    "server/app.js",
    "database/index.js",
    "package-lock.json",
    "scripts/prepare.mjs",
  ])
    await writeFile(path.join(base, "bundle", filename), "fixture");
  await writeFile(
    path.join(base, "bundle/package.json"),
    JSON.stringify({
      name: "ytso",
      scripts: { prepare: "node scripts/prepare.mjs" },
    }),
  );
  await writeFile(path.join(base, "bundle/release-id.txt"), candidateId);
  const environment = {
    ...process.env,
    FIXTURE_BASE: base,
    PATH: `${base}/bin:${path.dirname(process.execPath)}:${process.env.PATH}`,
  };
  const command = (args, options = {}) =>
    spawnSync("bash", args, {
      env: environment,
      encoding: "utf8",
      timeout: 20000,
      ...options,
    });
  const job = async (id = "1-1-ABCdef") => {
    const incoming = path.join(base, "incoming", id);
    await mkdir(incoming);
    for (const filename of [
      "deploy-release.sh",
      "deploy-state.mjs",
      "validate-release.py",
    ])
      await cp(
        path.join(root, "scripts", filename),
        path.join(incoming, filename),
      );
    const archive = path.join(incoming, "ytso-release.tar.gz");
    const result = spawnSync(
      "tar",
      [
        "-czf",
        archive,
        "-C",
        path.join(base, "bundle"),
        "dist",
        "server",
        "database",
        "scripts",
        "package.json",
        "package-lock.json",
        "release-id.txt",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    await writeFile(
      path.join(incoming, "runtime.json"),
      JSON.stringify(runtime),
      { mode: 0o600 },
    );
    const digest = createHash("sha256")
      .update(await readFile(archive))
      .digest("hex");
    const script = path.join(incoming, "deploy-release.sh");
    const initialize = command([
      script,
      "start",
      base,
      id,
      candidateId,
      digest,
    ]);
    assert.equal(initialize.status, 0, initialize.stderr);
    return { id, incoming, script, digest };
  };
  const status = async (id) => {
    try {
      return JSON.parse(
        await readFile(
          path.join(base, "deployments", id, "status.json"),
          "utf8",
        ),
      ).state;
    } catch {
      return null;
    }
  };
  const wait = async (id, terminal) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const value = await status(id);
      if (terminal.includes(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(
      `Deployment ${id} did not settle; status=${await status(id)}; log=${await readFile(path.join(base, "deployments", id, "worker.log"), "utf8")}`,
    );
  };
  const calls = async () =>
    (await readFile(path.join(base, "calls"), "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  return { base, environment, command, job, status, wait, calls };
}

async function waitForFile(filename) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await access(filename);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  assert.fail(`Fixture did not reach ${filename}`);
}

function signalWorker(setup, deployment, operation, signal) {
  const processes = spawnSync("ps", ["-eo", "pid,pgid,args"], {
    encoding: "utf8",
  }).stdout;
  const worker = processes
    .split("\n")
    .find(
      (line) =>
        line.includes(`bash ${deployment.script} ${operation} ${setup.base}`) &&
        line.includes("timeout --signal=TERM"),
    );
  assert.ok(worker, "Detached deployment supervisor exists");
  process.kill(-Number(worker.trim().split(/\s+/)[1]), signal);
}

test("valid artifact installs production dependencies and saves only its verified identity", async (context) => {
  const setup = await fixture(context);
  const deployment = await setup.job();
  assert.equal(
    await setup.wait(deployment.id, ["succeeded", "preparation_failed"]),
    "succeeded",
  );
  const calls = await setup.calls();
  assert.ok(
    calls.find((call) => call.command === "npm").args.includes("--omit=dev"),
  );
  assert.equal(
    calls.filter((call) => call.action === "save")[0].releaseId,
    candidateId,
  );
  await assert.rejects(access(path.join(deployment.incoming, "runtime.json")));
});

test("failed first activation with no previous process is removed without saving", async (context) => {
  const setup = await fixture(context, { activationFail: true });
  await writeFile(path.join(setup.base, "live.json"), '{"apps":[]}');
  const deployment = await setup.job();
  assert.equal(
    await setup.wait(deployment.id, ["activation_failed", "rollback_failed"]),
    "activation_failed",
  );
  assert.equal(
    (await setup.calls()).filter((call) => call.action === "save").length,
    0,
  );
});

for (const partialStart of [
  "candidate",
  "unexpected",
  "unidentified",
  "other-directory",
]) {
  test(`failed first activation with ${partialStart} PM2 state only removes its own identified candidate`, async (context) => {
    const setup = await fixture(context, {
      activationFail: true,
      partialStart,
    });
    await writeFile(path.join(setup.base, "live.json"), '{"apps":[]}');
    const deployment = await setup.job();
    const ownCandidate = partialStart === "candidate";
    assert.equal(
      await setup.wait(deployment.id, ["activation_failed", "rollback_failed"]),
      ownCandidate ? "activation_failed" : "rollback_failed",
    );
    const calls = await setup.calls();
    assert.equal(
      calls.filter((call) => call.action === "delete").length,
      ownCandidate ? 1 : 0,
    );
    assert.equal(calls.filter((call) => call.action === "save").length, 0);
    const live = JSON.parse(
      await readFile(path.join(setup.base, "live.json"), "utf8"),
    );
    assert.equal(live.apps.length, ownCandidate ? 0 : 1);
    if (!ownCandidate) {
      assert.equal(
        live.apps[0].env.YTSO_RELEASE_ID,
        partialStart === "unexpected"
          ? previousId
          : partialStart === "unidentified"
            ? undefined
            : candidateId,
      );
      const next = await setup.job("2-1-ABCdef");
      assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
    }
  });
}

test("preparation failure leaves the running application and saved PM2 state untouched", async (context) => {
  const setup = await fixture(context, { prepareFail: true });
  const deployment = await setup.job();
  assert.equal(
    await setup.wait(deployment.id, ["preparation_failed"]),
    "preparation_failed",
  );
  assert.equal(
    (await setup.calls()).filter((call) => call.command === "pm2").length,
    0,
  );
});

for (const [label, behavior] of [
  ["activation failure", { activationFail: true }],
  ["wrong release identity", { wrongIdentity: true }],
]) {
  test(`${label} restores previous configuration and verifies rollback before saving`, async (context) => {
    const setup = await fixture(context, behavior);
    const deployment = await setup.job();
    assert.equal(
      await setup.wait(deployment.id, ["rolled_back", "rollback_failed"]),
      "rolled_back",
    );
    const live = JSON.parse(
      await readFile(path.join(setup.base, "live.json"), "utf8"),
    );
    assert.equal(live.apps[0].env.db, "old-db");
    assert.equal(live.apps[0].env.jwtPrivateKey, "old-jwt");
    assert.equal(live.apps[0].env.PORT, "3001");
    assert.equal(live.apps[0].env.YTSO_RELEASE_ID, previousId);
    assert.deepEqual(
      (await setup.calls())
        .filter((call) => call.action === "save")
        .map((call) => call.releaseId),
      [previousId],
    );
  });
}

test("failed rollback never saves an unverified PM2 process list and blocks later activation", async (context) => {
  const setup = await fixture(context, {
    activationFail: true,
    rollbackFail: true,
  });
  const deployment = await setup.job();
  assert.equal(
    await setup.wait(deployment.id, ["rollback_failed"]),
    "rollback_failed",
  );
  assert.equal(
    (await setup.calls()).filter((call) => call.action === "save").length,
    0,
  );
  const next = await setup.job("2-1-ABCdef");
  assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
});

test("concurrent deployment attempts fail safely without touching PM2", async (context) => {
  const setup = await fixture(context);
  const lock = spawn(
    "flock",
    [
      path.join(setup.base, "deploy.lock"),
      "bash",
      "-c",
      "echo locked; read -r release",
    ],
    { env: setup.environment, stdio: ["pipe", "pipe", "pipe"] },
  );
  await once(lock.stdout, "data");
  try {
    const deployment = await setup.job();
    assert.equal(await setup.wait(deployment.id, ["busy"]), "busy");
    assert.deepEqual(await setup.calls(), []);
  } finally {
    lock.stdin.end("release\n");
    await once(lock, "exit");
  }
});

test("interrupted activation is recovered from the durable snapshot before future deployments", async (context) => {
  const setup = await fixture(context, { interrupt: true });
  const deployment = await setup.job();
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await access(path.join(setup.base, "activated"));
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  await access(path.join(setup.base, "activated"));
  const processList = spawnSync("ps", ["-eo", "pid,pgid,args"], {
    encoding: "utf8",
  }).stdout;
  const worker = processList
    .split("\n")
    .find(
      (line) =>
        line.includes(`bash ${deployment.script} run ${setup.base}`) &&
        line.includes("timeout --signal=TERM"),
    );
  assert.ok(worker, "Detached deployment supervisor exists");
  const group = Number(worker.trim().split(/\s+/)[1]);
  process.kill(-group, "SIGKILL");
  await writeFile(path.join(setup.base, "behavior.json"), "{}");
  const next = await setup.job("2-1-ABCdef");
  assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
  assert.equal(
    setup.command([deployment.script, "recover", setup.base, deployment.id])
      .status,
    0,
  );
  assert.equal(
    await setup.wait(deployment.id, ["rolled_back", "rollback_failed"]),
    "rolled_back",
  );
  assert.equal(
    JSON.parse(await readFile(path.join(setup.base, "live.json"), "utf8"))
      .apps[0].env.YTSO_RELEASE_ID,
    previousId,
  );
  const retry = await setup.job("3-1-ABCdef");
  assert.equal(await setup.wait(retry.id, ["succeeded"]), "succeeded");
});

test("termination during detached activation rolls back before releasing the lock", async (context) => {
  const setup = await fixture(context, { interrupt: true });
  const deployment = await setup.job();
  await waitForFile(path.join(setup.base, "activated"));
  signalWorker(setup, deployment, "run", "SIGTERM");
  assert.equal(
    await setup.wait(deployment.id, ["rolled_back", "rollback_failed"]),
    "rolled_back",
  );
  assert.deepEqual(
    (await setup.calls())
      .filter((call) => call.action === "save")
      .map((call) => call.releaseId),
    [previousId],
  );
});

test("a corrupt rollback snapshot never becomes permission to delete a running candidate", async (context) => {
  const setup = await fixture(context, { interrupt: true });
  const deployment = await setup.job();
  await waitForFile(path.join(setup.base, "activated"));
  signalWorker(setup, deployment, "run", "SIGKILL");
  await writeFile(
    path.join(setup.base, "deployments", deployment.id, "previous.json"),
    "{invalid",
  );
  assert.equal(
    setup.command([deployment.script, "recover", setup.base, deployment.id])
      .status,
    0,
  );
  assert.equal(
    await setup.wait(deployment.id, ["rollback_failed"]),
    "rollback_failed",
  );
  assert.equal(
    (await setup.calls()).filter((call) =>
      ["delete", "save"].includes(call.action),
    ).length,
    0,
  );
  assert.equal(
    JSON.parse(await readFile(path.join(setup.base, "live.json"), "utf8"))
      .apps[0].env.YTSO_RELEASE_ID,
    candidateId,
  );
  const next = await setup.job("2-1-ABCdef");
  assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
});

test("recovery interrupted during rollback retains its snapshot and can safely resume", async (context) => {
  const setup = await fixture(context, { interrupt: true });
  const deployment = await setup.job();
  await waitForFile(path.join(setup.base, "activated"));
  signalWorker(setup, deployment, "run", "SIGKILL");
  await writeFile(
    path.join(setup.base, "behavior.json"),
    JSON.stringify({ interruptRollback: true }),
  );
  assert.equal(
    setup.command([deployment.script, "recover", setup.base, deployment.id])
      .status,
    0,
  );
  await waitForFile(path.join(setup.base, "recovering"));
  signalWorker(setup, deployment, "recovery-worker", "SIGKILL");
  assert.equal(await setup.status(deployment.id), "rolling_back");
  const next = await setup.job("2-1-ABCdef");
  assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
  await writeFile(path.join(setup.base, "behavior.json"), "{}");
  assert.equal(
    setup.command([deployment.script, "recover", setup.base, deployment.id])
      .status,
    0,
  );
  assert.equal(
    await setup.wait(deployment.id, ["rolled_back", "rollback_failed"]),
    "rolled_back",
  );
  assert.deepEqual(
    (await setup.calls())
      .filter((call) => call.action === "save")
      .map((call) => call.releaseId),
    [previousId],
  );
});

test("a completed job cannot be replayed or overwrite its rollback snapshot", async (context) => {
  const setup = await fixture(context);
  const deployment = await setup.job();
  assert.equal(await setup.wait(deployment.id, ["succeeded"]), "succeeded");
  const snapshot = await readFile(
    path.join(setup.base, "deployments", deployment.id, "previous.json"),
    "utf8",
  );
  const before = await setup.calls();
  assert.equal(
    setup.command([
      deployment.script,
      "run",
      setup.base,
      deployment.id,
      candidateId,
      deployment.digest,
    ]).status,
    64,
  );
  assert.deepEqual(await setup.calls(), before);
  assert.equal(
    await readFile(
      path.join(setup.base, "deployments", deployment.id, "previous.json"),
      "utf8",
    ),
    snapshot,
  );
});

test("invalid prior deployment status blocks a new worker without touching PM2", async (context) => {
  const setup = await fixture(context);
  const deployment = await setup.job();
  assert.equal(await setup.wait(deployment.id, ["succeeded"]), "succeeded");
  const before = await setup.calls();
  await writeFile(
    path.join(setup.base, "deployments", deployment.id, "status.json"),
    "{invalid",
  );
  const next = await setup.job("2-1-ABCdef");
  assert.equal(await setup.wait(next.id, ["blocked"]), "blocked");
  assert.deepEqual(await setup.calls(), before);
});

test("artifact validation rejects corrupt, incomplete, linked, traversing, and mismatched releases", async (context) => {
  const setup = await fixture(context);
  const validator = path.join(root, "scripts/validate-release.py");
  const archive = path.join(setup.base, "bad.tar.gz");
  const program = `import tarfile,io,sys\narchive,kind,sha=sys.argv[1:]\nwith tarfile.open(archive,'w:gz') as bundle:\n info=tarfile.TarInfo('../escape' if kind=='traversal' else 'server/link' if kind=='link' else 'release-id.txt')\n if kind=='link':\n  info.type=tarfile.SYMTYPE;info.linkname='/tmp/escape';bundle.addfile(info)\n else:\n  data=('wrong' if kind=='identity' else sha).encode();info.size=len(data);bundle.addfile(info,io.BytesIO(data))\n`;
  for (const kind of [
    "traversal",
    "link",
    "identity",
    "incomplete",
    "corrupt",
  ]) {
    assert.equal(
      spawnSync("python3", ["-c", program, archive, kind, candidateId]).status,
      0,
    );
    const digest =
      kind === "corrupt"
        ? "0".repeat(64)
        : createHash("sha256")
            .update(await readFile(archive))
            .digest("hex");
    const result = spawnSync(
      "python3",
      [validator, archive, digest, candidateId],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1, kind);
    assert.equal(result.stderr.trim(), "YTSO artifact validation failed");
  }
  await assert.rejects(access(path.join(setup.base, "escape")));
});

test("a rollback with the wrong health identity is never saved", async (context) => {
  const setup = await fixture(context, {
    activationFail: true,
    failRollbackHealth: true,
  });
  const deployment = await setup.job();
  assert.equal(
    await setup.wait(deployment.id, ["rollback_failed"]),
    "rollback_failed",
  );
  assert.equal(
    (await setup.calls()).filter((call) => call.action === "save").length,
    0,
  );
});

test("native SSH/SCP transport pins the host and uploads runtime values outside command arguments", async (context) => {
  const setup = await fixture(context);
  const archive = path.join(setup.base, "ytso-release.tar.gz");
  assert.equal(
    spawnSync("tar", [
      "-czf",
      archive,
      "-C",
      path.join(setup.base, "bundle"),
      "dist",
      "server",
      "database",
      "scripts",
      "package.json",
      "package-lock.json",
      "release-id.txt",
    ]).status,
    0,
  );
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(`${archive}.sha256`, `${digest}  ytso-release.tar.gz\n`);
  const transport = `#!/usr/bin/env node
import {appendFileSync,copyFileSync,readFileSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const args=process.argv.slice(2);
const key=args[args.indexOf('-i')+1];
if((statSync(key).mode & 0o777)!==0o600 || process.env.jwtPrivateKey || process.env.DEPLOY_SSH_PRIVATE_KEY) process.exit(1);
appendFileSync(process.env.FIXTURE_BASE+'/transport',JSON.stringify(args)+'\\n');
if(path.basename(process.argv[1])==='ssh') {
 const result=spawnSync('bash',['-c',args.at(-1)],{encoding:'utf8',env:process.env});
 process.stdout.write(result.stdout || '');process.exit(result.status ?? 1);
} else {
 const destination=args.at(-1).split(':')[1];
 for(const source of args.slice(args.lastIndexOf('-P')+2,-1)) copyFileSync(source,path.join(destination,path.basename(source)));
}
`;
  for (const command of ["ssh", "scp"]) {
    await writeFile(path.join(setup.base, "bin", command), transport);
    await chmod(path.join(setup.base, "bin", command), 0o755);
  }
  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(root, "scripts/ssh-deploy.mjs")],
      {
        env: {
          ...setup.environment,
          ...runtime,
          GITHUB_SHA: candidateId,
          GITHUB_RUN_ID: "77",
          GITHUB_RUN_ATTEMPT: "1",
          DEPLOY_HOST: "example.test",
          DEPLOY_USER: "ytso",
          DEPLOY_BASE_DIR: setup.base,
          DEPLOY_SSH_PRIVATE_KEY: "fixture-private-key",
          DEPLOY_KNOWN_HOSTS: "fixture-known-host",
          YTSO_ARTIFACT_DIR: setup.base,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("exit", (code) => resolve({ code, output }));
  });
  assert.equal(result.code, 0, result.output);
  assert.ok(result.output.includes("succeeded"));
  assert.ok(!result.output.includes(runtime.db));
  const transportCalls = (
    await readFile(path.join(setup.base, "transport"), "utf8")
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  for (const args of transportCalls) {
    assert.ok(args.includes("StrictHostKeyChecking=yes"));
    assert.ok(args.includes("IdentitiesOnly=yes"));
    assert.ok(args.includes("BatchMode=yes"));
    assert.ok(!JSON.stringify(args).includes(runtime.jwtPrivateKey));
  }
});

test("real npm production installation skips missing Husky while dependency lifecycle scripts still run", async (context) => {
  const setup = await fixture(context);
  const directory = path.join(setup.base, "production-install");
  await mkdir(path.join(directory, "scripts"), { recursive: true });
  await mkdir(path.join(directory, "native"));
  await cp(
    path.join(root, "scripts/prepare.mjs"),
    path.join(directory, "scripts/prepare.mjs"),
  );
  await writeFile(
    path.join(directory, "native/package.json"),
    JSON.stringify({
      name: "native-fixture",
      version: "1.0.0",
      scripts: { install: "node install.cjs" },
    }),
  );
  await writeFile(
    path.join(directory, "native/install.cjs"),
    "require('node:fs').writeFileSync('installed','yes')",
  );
  const npm = (args) =>
    spawnSync(
      process.execPath,
      [
        process.env.npm_execpath,
        ...args,
        "--offline",
        "--cache",
        path.join(setup.base, "npm-cache"),
        "--no-audit",
        "--no-fund",
      ],
      {
        cwd: directory,
        env: { ...process.env, HUSKY: "0", NODE_ENV: "production" },
        encoding: "utf8",
        timeout: 20000,
      },
    );
  const packed = npm(["pack", "./native", "--ignore-scripts"]);
  assert.equal(packed.status, 0, packed.stderr);
  await writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "ytso",
      version: "1.0.0",
      scripts: { prepare: "node scripts/prepare.mjs" },
      dependencies: { "native-fixture": "file:./native-fixture-1.0.0.tgz" },
    }),
  );
  const locked = npm(["install", "--package-lock-only", "--ignore-scripts"]);
  assert.equal(locked.status, 0, locked.stderr);
  const installed = npm(["ci", "--omit=dev"]);
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(
    await readFile(
      path.join(directory, "node_modules/native-fixture/installed"),
      "utf8",
    ),
    "yes",
  );
  await assert.rejects(access(path.join(directory, "node_modules/husky")));
});
