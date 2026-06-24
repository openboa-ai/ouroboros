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
const bundleIdentifier = "ai.openboa.ouroboros.operator";
const launchServicesRegister = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

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

const result = spawnSync("open", ["-n", "-a", appPath], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (!result.error && result.status === 0) {
  console.log(`operator_desktop_app_opened:${appPath}`);
  process.exit(0);
}

const openError = result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? "unknown";
console.error(`operator_desktop_open_failed:${openError}`);
console.error("operator_desktop_open_retry:register_bundle");

const registerResult = spawnSync(launchServicesRegister, ["-f", appPath], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (registerResult.error || registerResult.status !== 0) {
  const registerError = registerResult.error?.message
    ?? registerResult.stderr?.trim()
    ?? registerResult.stdout?.trim()
    ?? "unknown";
  console.error(`operator_desktop_register_failed:${registerError}`);
} else {
  console.error("operator_desktop_register_succeeded");
}

const bundleResult = spawnSync("open", ["-n", "-b", bundleIdentifier], {
  cwd: repoRoot,
  encoding: "utf8"
});

if (!bundleResult.error && bundleResult.status === 0) {
  console.log(`operator_desktop_app_opened:${bundleIdentifier}`);
  process.exit(0);
}

const bundleError = bundleResult.error?.message
  ?? bundleResult.stderr?.trim()
  ?? bundleResult.stdout?.trim()
  ?? "unknown";
console.error(`operator_desktop_bundle_open_failed:${bundleError}`);
console.error("operator_desktop_open_fallback:direct_executable");

const child = spawn(appExecutable, [], {
  cwd: repoRoot,
  detached: true,
  stdio: "ignore"
});
child.unref();

await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 1500));

if (child.exitCode !== null) {
  console.error(`operator_desktop_direct_launch_exited:${child.exitCode}`);
  process.exit(child.exitCode ?? 1);
}

console.log(`operator_desktop_app_started:${child.pid}`);
