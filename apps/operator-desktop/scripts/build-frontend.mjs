#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const sourceDist = path.join(repoRoot, "apps", "operator-web", "dist");
const tauriDist = path.join(desktopRoot, "src-tauri", "dist");

run("npm", ["run", "build", "-w", "@ouroboros/operator-web"], repoRoot);

const sourceIndex = path.join(sourceDist, "index.html");
if (!existsSync(sourceIndex)) {
  console.error(`operator web build did not create ${sourceIndex}`);
  process.exit(1);
}

await rm(tauriDist, { recursive: true, force: true });
await cp(sourceDist, tauriDist, { recursive: true });

const tauriIndex = path.join(tauriDist, "index.html");
if (!existsSync(tauriIndex)) {
  console.error(`operator desktop frontend copy did not create ${tauriIndex}`);
  process.exit(1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
