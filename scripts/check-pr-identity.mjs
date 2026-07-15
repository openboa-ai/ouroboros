#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ALLOWED_OPTIONS = new Set(["mode", "head", "base", "title", "body", "repo"]);
const args = parseArgs(process.argv.slice(2));

if (args.mode === "pull-request") {
  rejectModeOptions(args, "pull-request", ["repo"]);
  validatePullRequest(args);
} else if (args.mode === "local") {
  rejectModeOptions(args, "local", ["head", "base", "title", "body"]);
  validateLocal(args);
} else {
  failUsage("--mode must be local or pull-request");
}

function validatePullRequest(input) {
  requireMetadata(input, "head");
  const headMatch = input.head.match(/^codex\/(OURO-[1-9]\d*)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (!headMatch) {
    failValidation("invalid --head: expected codex/OURO-NNN-short-slug");
  }

  requireMetadata(input, "title");
  const titleMatch = input.title.match(/^\[(OURO-[1-9]\d*)\] [^\n]+$/);
  const titleIssues = input.title.match(/OURO-[1-9]\d*/g) ?? [];
  if (!titleMatch || titleIssues.length !== 1) {
    failValidation(
      "invalid --title: expected [OURO-NNN] <short task title> with exactly one issue identifier"
    );
  }

  requireMetadata(input, "body");
  const bodyMatch = input.body.match(/^(OURO-[1-9]\d*)\n?$/);
  if (!bodyMatch) {
    failValidation("invalid --body: expected exactly OURO-NNN");
  }

  requireMetadata(input, "base");
  if (input.base === input.head) {
    failValidation("invalid --base: must identify a branch different from --head");
  }

  const [headIssue, titleIssue, bodyIssue] = [headMatch[1], titleMatch[1], bodyMatch[1]];
  if (titleIssue !== headIssue || bodyIssue !== headIssue) {
    failValidation(`identity mismatch: head=${headIssue} title=${titleIssue} body=${bodyIssue}`);
  }

  printValid({ mode: "pull-request", issue: headIssue, head: input.head, base: input.base });
}

function validateLocal(input) {
  const repo = path.resolve(input.repo ?? process.cwd());
  const gitDir = resolveGitPath(repo, gitValue(repo, ["rev-parse", "--git-dir"]));
  const commonDir = resolveGitPath(repo, gitValue(repo, ["rev-parse", "--git-common-dir"]));
  const superproject = gitValue(repo, ["rev-parse", "--show-superproject-working-tree"]);

  if (superproject || gitDir === commonDir) {
    failValidation(
      "invalid worktree: root control checkout is not an implementation workspace"
    );
  }

  const branch = gitValue(repo, ["branch", "--show-current"]);
  const branchMatch = branch.match(/^codex\/(OURO-[1-9]\d*)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (!branchMatch) {
    failValidation(
      "invalid branch: linked worktree must check out codex/OURO-NNN-short-slug"
    );
  }

  printValid({ mode: "local", issue: branchMatch[1], branch, repo });
}

function printValid(values) {
  console.log("PR identity validation");
  for (const [name, value] of Object.entries(values)) {
    console.log(`${name}=${value}`);
  }
  console.log("PR_IDENTITY_RESULT valid");
}

function gitValue(repo, commandArgs) {
  const result = spawnSync("git", ["-C", repo, ...commandArgs], { encoding: "utf8" });
  if (result.status !== 0) {
    failUsage(`unable to read Git metadata in ${repo}: ${result.stderr.trim() || "git command failed"}`);
  }
  return result.stdout.trim();
}

function resolveGitPath(repo, pathname) {
  return path.resolve(repo, pathname);
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

function rejectModeOptions(parsed, mode, rejected) {
  for (const name of rejected) {
    if (Object.hasOwn(parsed, name)) {
      failUsage(`option --${name} is not valid for ${mode} mode`);
    }
  }
}

function requireMetadata(parsed, name) {
  if (!parsed[name]) {
    failValidation(`missing --${name}`);
  }
}

function failValidation(message) {
  console.error(`ERROR ${message}`);
  console.error("PR_IDENTITY_RESULT invalid");
  process.exit(2);
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
