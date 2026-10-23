import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const states = new Set([
  "queued",
  "preparing",
  "activating",
  "verifying",
  "rolling_back",
  "succeeded",
  "rolled_back",
  "preparation_failed",
  "activation_failed",
  "rollback_failed",
  "interrupted",
  "busy",
  "blocked",
]);

export function runtimeConfig(value) {
  const keys = [
    "jwtPrivateKey",
    "db",
    "YOUTUBE_API_KEY",
    "PORT",
    "TRUST_PROXY_HOPS",
  ];
  if (!value || keys.some((key) => typeof value[key] !== "string"))
    throw new Error("Invalid runtime configuration");
  if (keys.slice(0, 3).some((key) => !value[key] || value[key].length > 65536))
    throw new Error("Missing runtime configuration");
  if (
    !/^\d+$/.test(value.PORT) ||
    Number(value.PORT) < 1 ||
    Number(value.PORT) > 65535 ||
    !/^\d+$/.test(value.TRUST_PROXY_HOPS) ||
    Number(value.TRUST_PROXY_HOPS) > 100
  )
    throw new Error("Invalid port or proxy configuration");
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

export function previousConfig(processes) {
  const matches = processes.filter((item) => item.name === "ytso");
  if (!matches.length) return { apps: [] };
  const previous = matches[0].pm2_env;
  if (
    !previous ||
    !path.isAbsolute(previous.pm_cwd || "") ||
    !existsSync(path.join(previous.pm_cwd, "server/index.js"))
  )
    throw new Error("Previous release is unavailable");
  if (
    matches.some(
      (item) =>
        item.pm2_env.pm_cwd !== previous.pm_cwd ||
        item.pm2_env.YTSO_RELEASE_ID !== previous.YTSO_RELEASE_ID,
    )
  )
    throw new Error("Inconsistent PM2 release");
  const environment = { ...previous.env };
  for (const key of [
    "NODE_ENV",
    "jwtPrivateKey",
    "db",
    "YOUTUBE_API_KEY",
    "PORT",
    "TRUST_PROXY_HOPS",
    "YTSO_RELEASE_ID",
  ]) {
    environment[key] = previous[key] ?? environment[key] ?? "";
  }
  environment.YTSO_RELEASE_ID ||= "";
  environment.PORT ||= "3000";
  return {
    apps: [
      {
        name: "ytso",
        script: previous.pm_exec_path || "server/index.js",
        cwd: previous.pm_cwd,
        interpreter: previous.exec_interpreter || "node",
        exec_mode: previous.exec_mode === "cluster_mode" ? "cluster" : "fork",
        instances: previous.instances || matches.length,
        args: previous.args,
        node_args: previous.node_args,
        wait_ready: previous.wait_ready ?? true,
        listen_timeout: previous.listen_timeout || 15000,
        kill_timeout: previous.kill_timeout || 12000,
        env: environment,
      },
    ],
  };
}

export function healthy(body, releaseId) {
  return (
    body?.status === "ok" &&
    (releaseId ? body.releaseId === releaseId : body.releaseId == null)
  );
}

function writePrivate(filename, value, raw = false) {
  const temporary = `${filename}.${process.pid}.tmp`;
  writeFileSync(temporary, raw ? value : JSON.stringify(value), {
    mode: 0o600,
  });
  const descriptor = openSync(temporary, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, filename);
  const directory = openSync(path.dirname(filename), "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
}

function pm2(args) {
  const result = spawnSync("pm2", args, {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error("PM2 command failed");
  return result.stdout;
}

function main([command, filename, ...args]) {
  const read = () => JSON.parse(readFileSync(filename, "utf8"));
  if (command === "write-status") {
    const [state, releaseId] = args;
    if (!states.has(state) || !/^[0-9a-f]{40}$/.test(releaseId))
      throw new Error("Invalid deployment status");
    writePrivate(filename, { state, releaseId });
  } else if (command === "write-pointer") {
    if (!/^[0-9]+-[0-9]+-[a-zA-Z0-9]{6}$/.test(args[0]))
      throw new Error("Invalid deployment pointer");
    writePrivate(filename, `${args[0]}\n`, true);
  } else if (command === "mark") {
    writePrivate(filename, { activationStarted: true });
  } else if (["status", "status-token", "release-token"].includes(command)) {
    const value = read();
    if (
      !value ||
      typeof value.state !== "string" ||
      !states.has(value.state) ||
      typeof value.releaseId !== "string" ||
      !/^[0-9a-f]{40}$/.test(value.releaseId)
    )
      throw new Error("Invalid deployment status");
    if (command === "status-token") console.log(value.state);
    else if (command === "release-token") console.log(value.releaseId);
    else
      console.log(
        JSON.stringify({ state: value.state, releaseId: value.releaseId }),
      );
  } else if (command === "snapshot") {
    writePrivate(filename, previousConfig(JSON.parse(pm2(["jlist"]))));
  } else if (command === "candidate") {
    const [releaseDirectory, releaseId, previousFilename] = args;
    const environment = runtimeConfig(read());
    const previous = JSON.parse(readFileSync(previousFilename, "utf8")).apps[0];
    writePrivate(path.join(path.dirname(filename), "candidate.json"), {
      apps: [
        {
          name: "ytso",
          script: "server/index.js",
          cwd: releaseDirectory,
          interpreter: process.execPath,
          wait_ready: true,
          exec_mode: previous?.exec_mode || "fork",
          instances: previous?.instances || 1,
          listen_timeout: 15000,
          kill_timeout: 12000,
          env: {
            ...environment,
            NODE_ENV: "production",
            YTSO_RELEASE_ID: releaseId,
          },
        },
      ],
    });
  } else if (command === "previous-token") {
    const value = read();
    if (
      !value ||
      !Array.isArray(value.apps) ||
      value.apps.length > 1 ||
      (value.apps.length &&
        (value.apps[0]?.name !== "ytso" ||
          !path.isAbsolute(value.apps[0].cwd || "") ||
          !value.apps[0].env ||
          typeof value.apps[0].env !== "object" ||
          Array.isArray(value.apps[0].env)))
    )
      throw new Error("Invalid rollback snapshot");
    console.log(value.apps.length ? "present" : "absent");
  } else if (command === "activate") {
    const config = read();
    if (config.apps.length !== 1 || config.apps[0].name !== "ytso")
      throw new Error("Invalid PM2 configuration");
    pm2(["startOrReload", filename, "--only", "ytso", "--update-env"]);
  } else if (command === "remove-candidate") {
    const matches = JSON.parse(pm2(["jlist"])).filter(
      (item) => item.name === "ytso",
    );
    const candidate = read().apps[0];
    const releaseId = candidate.env.YTSO_RELEASE_ID;
    if (
      !/^[0-9a-f]{40}$/.test(releaseId) ||
      matches.some(
        (item) =>
          item.pm2_env?.YTSO_RELEASE_ID !== releaseId ||
          item.pm2_env.pm_cwd !== candidate.cwd ||
          item.pm2_env.pm_exec_path !==
            path.resolve(candidate.cwd, candidate.script),
      )
    )
      throw new Error("Unexpected live release");
    if (matches.length) pm2(["delete", "ytso"]);
  } else if (command === "save") {
    pm2(["save"]);
  } else if (command === "health") {
    const application = read().apps[0];
    const port = String(application.env.PORT || "3000");
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      throw new Error("Invalid health port");
    const response = spawnSync(
      "curl",
      [
        "--fail",
        "--silent",
        "--connect-timeout",
        "2",
        "--max-time",
        "5",
        "--max-filesize",
        "65536",
        "--header",
        "Accept: application/json",
        `http://127.0.0.1:${port}/health`,
      ],
      { encoding: "utf8", timeout: 7000, maxBuffer: 65536 },
    );
    if (
      response.status !== 0 ||
      !healthy(JSON.parse(response.stdout), application.env.YTSO_RELEASE_ID)
    )
      process.exitCode = 1;
  } else {
    throw new Error("Unknown deployment operation");
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (Number(process.versions.node.split(".")[0]) < 24)
      throw new Error("Node 24 required");
    main(process.argv.slice(2));
  } catch {
    console.error(
      "YTSO deployment operation failed; inspect protected host diagnostics.",
    );
    process.exitCode = 1;
  }
}
