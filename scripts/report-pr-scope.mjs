#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const MAX_PRODUCTION_FILES = 8;
const MAX_PRODUCTION_CHANGED_LINES = 800;
const args = parseArgs(process.argv.slice(2));
const repo = path.resolve(args.repo ?? process.cwd());
const baseRef = requireArgument(args, "base");
const headRef = requireArgument(args, "head");
const baseCommit = resolveCommit(repo, baseRef, "base");
const headCommit = resolveCommit(repo, headRef, "head");
const files = readDiff(repo, baseCommit, headCommit);
const categories = summarize(files);
const overBudget = {
  files: categories.production.file_count > MAX_PRODUCTION_FILES,
  lines: categories.production.changed_lines > MAX_PRODUCTION_CHANGED_LINES,
  any: false
};
overBudget.any = overBudget.files || overBudget.lines;
const rationaleValue = args.rationale?.trim() || null;
const rationale = { provided: rationaleValue !== null, value: rationaleValue };
const result = !overBudget.any
  ? "within_budget"
  : rationale.provided
    ? "rationale_recorded"
    : "rationale_required";

const report = {
  record_kind: "pr_scope_report",
  version: 1,
  base: { ref: baseRef, commit: baseCommit },
  head: { ref: headRef, commit: headCommit },
  categories,
  thresholds: {
    production_files: MAX_PRODUCTION_FILES,
    production_changed_lines: MAX_PRODUCTION_CHANGED_LINES
  },
  over_budget: overBudget,
  rationale,
  result
};

console.log(JSON.stringify(report, null, 2));
if (result === "rationale_recorded") {
  console.error("WARNING scope budget exceeded; atomicity rationale recorded");
} else if (result === "rationale_required") {
  console.error("ERROR scope budget exceeded; reassess outcome scope or provide --rationale");
  process.exitCode = 2;
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
    if (!["repo", "base", "head", "rationale"].includes(name)) {
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
  if (!value || value.startsWith("-")) {
    failUsage(`missing or invalid --${name}`);
  }
  return value;
}

function resolveCommit(repoPath, ref, label) {
  return gitText(
    repoPath,
    ["rev-parse", "--verify", `${ref}^{commit}`],
    `invalid --${label} ref: ${ref}`
  );
}

function readDiff(repoPath, base, head) {
  const output = gitRaw(
    repoPath,
    ["diff", "--numstat", "--no-renames", "-z", `${base}...${head}`, "--"],
    "unable to read Git diff"
  );
  return output
    .split("\0")
    .filter(Boolean)
    .map(parseNumstat)
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

function parseNumstat(record) {
  const firstTab = record.indexOf("\t");
  const secondTab = record.indexOf("\t", firstTab + 1);
  if (firstTab === -1 || secondTab === -1) {
    failUsage("unable to parse Git numstat output");
  }
  const additions = record.slice(0, firstTab);
  const deletions = record.slice(firstTab + 1, secondTab);
  const binary = additions === "-" || deletions === "-";
  return {
    path: record.slice(secondTab + 1),
    additions: binary ? 0 : Number(additions),
    deletions: binary ? 0 : Number(deletions),
    binary
  };
}

function summarize(files) {
  const categories = {
    production: emptyCategory(),
    tests: emptyCategory(),
    docs: emptyCategory(),
    generated: emptyCategory()
  };
  for (const file of files) {
    const category = categories[classify(file.path)];
    category.files.push(file);
    category.file_count += 1;
    category.additions += file.additions;
    category.deletions += file.deletions;
    category.changed_lines += file.additions + file.deletions;
  }
  return categories;
}

function emptyCategory() {
  return {
    file_count: 0,
    additions: 0,
    deletions: 0,
    changed_lines: 0,
    files: []
  };
}

function classify(pathname) {
  if (
    /(^|\/)(dist|build|coverage)\//.test(pathname) ||
    /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(
      pathname
    ) ||
    /\.(generated|gen)\.[^/]+$/.test(pathname)
  ) {
    return "generated";
  }
  if (
    /(^|\/)(__tests__|test|tests)\//.test(pathname) ||
    /\.(test|spec)\.[^/]+$/.test(pathname)
  ) {
    return "tests";
  }
  if (pathname.startsWith("docs/") || pathname.endsWith(".md")) {
    return "docs";
  }
  return "production";
}

function gitText(repoPath, commandArgs, errorMessage) {
  return gitRaw(repoPath, commandArgs, errorMessage).trim();
}

function gitRaw(repoPath, commandArgs, errorMessage) {
  const result = spawnSync("git", ["-C", repoPath, ...commandArgs], { encoding: "utf8" });
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || "git command failed";
    failUsage(`${errorMessage}: ${detail}`);
  }
  return result.stdout;
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
