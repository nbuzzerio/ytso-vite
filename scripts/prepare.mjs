import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.HUSKY !== "0" && process.env.NODE_ENV !== "production") {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/husky/lib/bin.js", import.meta.url),
      ),
      "install",
    ],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
}
