#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const appPath = path.join(
  desktopRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Ouroboros Operator.app"
);

run("tauri", ["build"], desktopRoot);

if (process.platform === "darwin" && existsSync(appPath)) {
  run("codesign", ["--force", "--deep", "--sign", "-", appPath], repoRoot);
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
