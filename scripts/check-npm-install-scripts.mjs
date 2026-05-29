#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const allowedInstallScripts = new Map([
  ["node_modules/esbuild", { version: "0.27.7" }],
  ["node_modules/fsevents", { version: "2.3.3", optional: true }],
  ["node_modules/msw", { version: "2.14.6" }]
]);

const args = parseArgs(process.argv.slice(2));
const packageLockPath = path.resolve(args["package-lock"] ?? "package-lock.json");

try {
  const lock = JSON.parse(await readFile(packageLockPath, "utf8"));
  const problems = checkInstallScripts(lock);
  if (problems.length > 0) {
    fail(`npm install-script guard failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  }
  console.log(`npm install-script guard passed (${allowedInstallScripts.size} allowlisted packages).`);
} catch (error) {
  if (error instanceof SyntaxError) {
    fail(`${packageLockPath}: invalid JSON: ${error.message}`);
  }
  throw error;
}

function checkInstallScripts(lock) {
  const packages = lock?.packages;
  if (!packages || typeof packages !== "object") {
    return ["package-lock.json is missing a packages object"];
  }

  const problems = [];
  for (const [packagePath, entry] of Object.entries(packages)) {
    if (!entry || typeof entry !== "object" || entry.hasInstallScript !== true) {
      continue;
    }

    const version = String(entry.version ?? "unknown");
    const allowed = allowedInstallScripts.get(packagePath);
    if (!allowed) {
      problems.push(`${packagePath}@${version} has an unallowlisted install script`);
      continue;
    }
    if (version !== allowed.version) {
      problems.push(`${packagePath}@${version} install script is allowlisted only for ${allowed.version}`);
    }
    if (allowed.optional && entry.optional !== true) {
      problems.push(`${packagePath}@${version} must remain optional while allowlisted`);
    }
  }

  return problems;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      fail(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${arg}`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
