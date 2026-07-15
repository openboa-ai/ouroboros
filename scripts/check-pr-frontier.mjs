#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ALLOWED_OPTIONS = new Set([
  "mode",
  "repo",
  "pr-head",
  "pr-base",
  "pr-title",
  "pr-body",
  "scope-base",
  "scope-head"
]);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const repo = path.resolve(args.repo ?? process.cwd());

if (args.mode === "pull-request") {
  runPullRequest(args);
} else if (args.mode === "local") {
  runLocal(args);
} else {
  failUsage("--mode must be local or pull-request");
}

function runLocal(input) {
  rejectOptions(input, "local", ["pr-head", "pr-base", "pr-title", "pr-body"]);
  const scopeBase = input["scope-base"]
    ? requireRefArgument(input, "scope-base")
    : "origin/main";
  const scopeHead = input["scope-head"] ? requireRefArgument(input, "scope-head") : "HEAD";
  runComponent("check-pr-identity.mjs", ["--mode", "local", "--repo", repo]);
  runScope(scopeBase, scopeHead);
}

function runPullRequest(input) {
  const prHead = requireArgument(input, "pr-head");
  const prBase = requireArgument(input, "pr-base");
  const prTitle = requireArgument(input, "pr-title");
  const prBody = requireArgument(input, "pr-body");
  const scopeBase = requireRefArgument(input, "scope-base");
  const scopeHead = requireRefArgument(input, "scope-head");

  runComponent("check-pr-identity.mjs", [
    "--mode",
    "pull-request",
    "--head",
    prHead,
    "--base",
    prBase,
    "--title",
    prTitle,
    "--body",
    prBody
  ]);
  runScope(scopeBase, scopeHead);
}

function runScope(scopeBase, scopeHead) {
  const componentArgs = [
    "--repo",
    repo,
    "--base",
    scopeBase,
    "--head",
    scopeHead
  ];
  const rationale = readScopeRationale(scopeHead);
  if (rationale) {
    componentArgs.push("--rationale", rationale);
  }
  runComponent("report-pr-scope.mjs", componentArgs);
}

function readScopeRationale(scopeHead) {
  const headCommit = gitText(
    [
      "rev-parse",
      "--verify",
      `${scopeHead}^{commit}`
    ],
    `invalid --scope-head ref: ${scopeHead}`
  );
  return gitText(
    ["log", "-1", "--format=%(trailers:key=Scope-Rationale,valueonly)", headCommit],
    `unable to read Scope-Rationale from ${scopeHead}`
  );
}

function gitText(commandArgs, errorMessage) {
  const result = spawnSync("git", ["-C", repo, ...commandArgs], { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || "git command failed";
    failUsage(`${errorMessage}: ${detail}`);
  }
  return result.stdout.trim();
}

function runComponent(filename, componentArgs) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, filename), ...componentArgs], {
    encoding: "utf8"
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.error) {
    failUsage(`unable to run ${filename}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 2) {
    const option = rawArgs[index];
    const value = rawArgs[index + 1];
    if (!option?.startsWith("--") || value === undefined) {
      failUsage(`invalid argument near ${option ?? "end of input"}`);
    }
    const name = option.slice(2);
    if (!ALLOWED_OPTIONS.has(name)) {
      failUsage(`unknown option: --${name}`);
    }
    if (Object.hasOwn(parsed, name)) {
      failUsage(`duplicate option: --${name}`);
    }
    parsed[name] = value;
  }
  return parsed;
}

function requireArgument(parsed, name) {
  const value = parsed[name];
  if (!value) {
    failUsage(`missing --${name}`);
  }
  return value;
}

function requireRefArgument(parsed, name) {
  const value = requireArgument(parsed, name);
  if (value.startsWith("-")) {
    failUsage(`missing or invalid --${name}`);
  }
  return value;
}

function rejectOptions(parsed, mode, names) {
  for (const name of names) {
    if (Object.hasOwn(parsed, name)) {
      failUsage(`option --${name} is not valid for ${mode} mode`);
    }
  }
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
