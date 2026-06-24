#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const appPath = join(
  repoRoot,
  "apps",
  "operator-desktop",
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "Ouroboros Operator.app"
);
const appExecutable = join(appPath, "Contents", "MacOS", "ouroboros-operator-desktop");

if (process.platform !== "darwin") {
  console.error("open_operator_desktop_app_requires_macos");
  process.exit(1);
}

if (!existsSync(appPath)) {
  console.error(`operator_desktop_app_bundle_missing:${appPath}`);
  console.error("Run npm run package:operator-desktop first.");
  process.exit(1);
}

if (!existsSync(appExecutable)) {
  console.error(`operator_desktop_app_executable_missing:${appExecutable}`);
  process.exit(1);
}

const result = spawnSync("open", ["-n", appPath], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (!result.error && result.status === 0) {
  process.exit(0);
}

const openError = result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? "unknown";
console.error(`operator_desktop_open_failed:${openError}`);
console.error("operator_desktop_open_fallback:direct_executable");

const child = spawn(appExecutable, [], {
  cwd: repoRoot,
  detached: true,
  stdio: "ignore"
});
child.unref();

await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 500));

if (child.exitCode !== null) {
  console.error(`operator_desktop_direct_launch_exited:${child.exitCode}`);
  process.exit(child.exitCode ?? 1);
}

console.log(`operator_desktop_app_started:${child.pid}`);
