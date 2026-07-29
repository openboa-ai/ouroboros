#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDesktopBuildCommand } from "../../../scripts/operator-desktop-build-storage.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const args = process.argv.slice(2);
const result = runDesktopBuildCommand({
  repoRoot,
  label: `tauri:${args[0] ?? "help"}`,
  command: "tauri",
  args,
  cwd: desktopRoot
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
