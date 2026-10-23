import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runtimeConfig, states } from "./deploy-state.mjs";

export function connectionConfig(environment) {
  const host = environment.DEPLOY_HOST || "";
  const user = environment.DEPLOY_USER || "";
  const port = environment.DEPLOY_SSH_PORT || "22";
  const base = environment.DEPLOY_BASE_DIR || "";
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) ||
    !/^[a-z_][a-z0-9_-]*$/.test(user) ||
    user === "root" ||
    !/^\d+$/.test(port) ||
    Number(port) < 1 ||
    Number(port) > 65535 ||
    !/^\/[a-zA-Z0-9_./-]+$/.test(base) ||
    path.posix.normalize(base) !== base ||
    base === "/" ||
    base.endsWith("/")
  )
    throw new Error("Invalid SSH deployment configuration");
  if (
    !environment.DEPLOY_KNOWN_HOSTS?.trim() ||
    !environment.DEPLOY_SSH_PRIVATE_KEY?.trim()
  )
    throw new Error("Missing deployment key or verified host keys");
  return { host, user, port, base };
}

async function deploy() {
  const config = connectionConfig(process.env);
  const releaseId = process.env.GITHUB_SHA || "";
  const run = process.env.GITHUB_RUN_ID || "";
  const attempt = process.env.GITHUB_RUN_ATTEMPT || "";
  if (
    !/^[0-9a-f]{40}$/.test(releaseId) ||
    !/^\d+$/.test(run) ||
    !/^\d+$/.test(attempt)
  )
    throw new Error("Invalid workflow identity");
  const artifactDirectory = process.env.YTSO_ARTIFACT_DIR;
  if (!artifactDirectory) throw new Error("Missing release artifact directory");
  const archive = path.join(artifactDirectory, "ytso-release.tar.gz");
  const digest = createHash("sha256")
    .update(readFileSync(archive))
    .digest("hex");
  if (
    readFileSync(`${archive}.sha256`, "utf8").trim() !==
    `${digest}  ytso-release.tar.gz`
  )
    throw new Error("Artifact checksum mismatch");
  const runtime = runtimeConfig({
    jwtPrivateKey: process.env.jwtPrivateKey,
    db: process.env.db,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    PORT: process.env.PORT || "3000",
    TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS || "0",
  });
  const temporary = mkdtempSync(path.join(tmpdir(), "ytso-ssh-"));
  try {
    const key = path.join(temporary, "identity");
    const knownHosts = path.join(temporary, "known_hosts");
    const runtimeFile = path.join(temporary, "runtime.json");
    writeFileSync(key, `${process.env.DEPLOY_SSH_PRIVATE_KEY.trim()}\n`, {
      mode: 0o600,
    });
    writeFileSync(knownHosts, `${process.env.DEPLOY_KNOWN_HOSTS.trim()}\n`, {
      mode: 0o600,
    });
    writeFileSync(runtimeFile, JSON.stringify(runtime), { mode: 0o600 });
    const options = [
      "-F",
      "/dev/null",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=yes",
      "-o",
      "GlobalKnownHostsFile=/dev/null",
      "-o",
      "UpdateHostKeys=no",
      "-o",
      `UserKnownHostsFile=${knownHosts}`,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "ConnectTimeout=10",
      "-o",
      "ServerAliveInterval=10",
      "-o",
      "ServerAliveCountMax=2",
      "-o",
      "LogLevel=ERROR",
      "-i",
      key,
    ];
    const target = `${config.user}@${config.host}`;
    const childEnvironment = { ...process.env };
    for (const name of [
      "DEPLOY_SSH_PRIVATE_KEY",
      "jwtPrivateKey",
      "db",
      "YOUTUBE_API_KEY",
    ])
      delete childEnvironment[name];
    const execute = (program, args, timeout = 45000) => {
      const result = spawnSync(program, args, {
        encoding: "utf8",
        timeout,
        maxBuffer: 65536,
        env: childEnvironment,
      });
      if (result.status !== 0)
        throw new Error(
          "SSH deployment transport failed; verify connectivity, key, host pin, and permissions",
        );
      return result.stdout.trim();
    };
    const remote = (command) =>
      execute("ssh", [...options, "-p", config.port, target, command]);
    const incoming = remote(
      `umask 077; test -d ${config.base} && test -O ${config.base} && test ! -L ${config.base} && test "$(realpath -e ${config.base})" = ${config.base} && mkdir -p ${config.base}/incoming && test ! -L ${config.base}/incoming && mktemp -d ${config.base}/incoming/${run}-${attempt}-XXXXXX`,
    );
    const job = path.posix.basename(incoming);
    if (
      !new RegExp(`^${run}-${attempt}-[a-zA-Z0-9]{6}$`).test(job) ||
      incoming !== `${config.base}/incoming/${job}`
    )
      throw new Error("Invalid remote incoming directory");
    console.log(`YTSO deployment ${job}; release ${releaseId}`);
    const scripts = path.dirname(fileURLToPath(import.meta.url));
    execute(
      "scp",
      [
        ...options,
        "-P",
        config.port,
        archive,
        runtimeFile,
        ...["deploy-release.sh", "deploy-state.mjs", "validate-release.py"].map(
          (name) => path.join(scripts, name),
        ),
        `${target}:${incoming}/`,
      ],
      180000,
    );
    const command = `bash ${incoming}/deploy-release.sh`;
    remote(`${command} start ${config.base} ${job} ${releaseId} ${digest}`);
    const deadline = Date.now() + 24 * 60 * 1000;
    let lastState;
    while (Date.now() < deadline) {
      let status;
      try {
        status = JSON.parse(remote(`${command} status ${config.base} ${job}`));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (!states.has(status.state) || status.releaseId !== releaseId)
        throw new Error("Invalid remote deployment status");
      if (lastState !== status.state)
        console.log(`Deployment status: ${status.state}`);
      lastState = status.state;
      if (status.state === "succeeded") return;
      if (
        [
          "rolled_back",
          "preparation_failed",
          "activation_failed",
          "rollback_failed",
          "interrupted",
          "busy",
          "blocked",
        ].includes(status.state)
      )
        throw new Error(
          `Deployment ended with status ${status.state}; use the documented host recovery procedure`,
        );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error(
      "Deployment polling timed out; the host worker may continue. Check its durable status before retrying",
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  deploy().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
