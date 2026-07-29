#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDesktopReleaseSourceState,
  captureDesktopReleaseSourceState,
  inspectDesktopBuildStorage,
  invalidateDesktopReleaseStamp,
  preflightDesktopBuildStorage,
  runDesktopBuildCommand,
  writeDesktopReleaseStamp
} from "../../../scripts/operator-desktop-build-storage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const appPath = inspectDesktopBuildStorage(repoRoot).app_bundle_path;

let result;
try {
  result = runDesktopBuildCommand({
    repoRoot,
    label: "tauri:package",
    command: "tauri",
    args: ["build"],
    cwd: desktopRoot,
    beforeSpawn: () => {
      const sourceAtStart = captureDesktopReleaseSourceState(repoRoot);
      invalidateDesktopReleaseStamp(repoRoot);
      return sourceAtStart;
    },
    afterSuccess: (_preflight, sourceAtStart) => {
      if (!existsSync(appPath)) {
        throw new Error(`operator_desktop_release_app_missing:${appPath}`);
      }
      assertDesktopReleaseSourceState(repoRoot, sourceAtStart);
      if (process.platform === "darwin") {
        run("codesign", ["--force", "--deep", "--sign", "-", appPath], repoRoot);
      }
      const postflight = preflightDesktopBuildStorage(repoRoot);
      if (postflight.status !== "ready") {
        throw new Error(`operator_desktop_package_storage_postflight_failed:${JSON.stringify(postflight)}`);
      }
      writeDesktopReleaseStamp(repoRoot, appPath, sourceAtStart);
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`operator_desktop_package_command_failed:${command}:${result.status ?? 1}`);
  }
}
