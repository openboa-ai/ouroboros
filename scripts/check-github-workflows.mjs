#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

const fullShaPattern = /^[0-9a-f]{40}$/;
const workflowExtensions = new Set([".yml", ".yaml"]);

const args = parseArgs(process.argv.slice(2));
const workflowsDir = path.resolve(args["workflows-dir"] ?? ".github/workflows");
const pinsFile = path.resolve(args["pins-file"] ?? ".github/action-pins.json");

const pins = await loadPins(pinsFile);
const problems = [];

for (const workflowPath of await workflowFiles(workflowsDir)) {
  const workflow = await loadWorkflow(workflowPath);
  const relativePath = path.relative(process.cwd(), workflowPath) || workflowPath;
  const workflowName = path.basename(workflowPath);
  checkWorkflow(workflow, workflowName, relativePath, pins, problems);
}

if (problems.length > 0) {
  console.error(`GitHub workflow security checks failed:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}

console.log(`GitHub workflow security checks passed (${pins.size} action pins allowlisted).`);

async function loadPins(filePath) {
  const body = JSON.parse(await readFile(filePath, "utf8"));
  const pins = body?.pins;
  if (!Array.isArray(pins)) {
    fail(`${filePath}: pins must be an array`);
  }

  const allowed = new Set();
  for (const pin of pins) {
    if (!pin || typeof pin !== "object") {
      fail(`${filePath}: every pin must be an object`);
    }
    const uses = pin.uses;
    const tag = pin.tag;
    if (typeof uses !== "string" || typeof tag !== "string") {
      fail(`${filePath}: every pin must include string uses and tag fields`);
    }
    const { ref } = splitUses(uses);
    if (!fullShaPattern.test(ref)) {
      fail(`${filePath}: ${uses} must include a full 40-character commit SHA`);
    }
    allowed.add(uses);
  }
  return allowed;
}

async function workflowFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && workflowExtensions.has(path.extname(entry.name)))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function loadWorkflow(filePath) {
  const body = await readFile(filePath, "utf8");
  const parsed = yaml.load(body);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${filePath}: workflow must parse to a YAML object`);
  }
  return parsed;
}

function checkWorkflow(workflow, workflowName, relativePath, pins, problems) {
  const triggers = workflow.on;
  if (hasPullRequestTarget(triggers)) {
    problems.push(`${workflowName}: pull_request_target is not allowed`);
  }

  checkPermissions(workflow.permissions, workflowName, relativePath, problems);

  for (const uses of collectUses(workflow)) {
    if (uses.startsWith("./")) {
      continue;
    }
    const { ownerRepo, ref } = splitUses(uses);
    if (!ownerRepo || !ref) {
      problems.push(`${workflowName}: ${uses} must include an owner/repo@ref action reference`);
      continue;
    }
    if (!fullShaPattern.test(ref)) {
      problems.push(`${uses} must use a full 40-character commit SHA`);
      continue;
    }
    if (!pins.has(uses)) {
      problems.push(`${workflowName}: ${uses} is not listed in ${path.relative(process.cwd(), pinsFile)}`);
    }
  }
}

function hasPullRequestTarget(triggers) {
  if (typeof triggers === "string") {
    return triggers === "pull_request_target";
  }
  if (Array.isArray(triggers)) {
    return triggers.includes("pull_request_target");
  }
  return Boolean(triggers && typeof triggers === "object" && Object.hasOwn(triggers, "pull_request_target"));
}

function checkPermissions(permissions, workflowName, relativePath, problems) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    problems.push(`${workflowName}: missing top-level permissions`);
    return;
  }

  for (const [scope, value] of Object.entries(permissions)) {
    if (value !== "write") {
      continue;
    }
    if (scope === "security-events" && relativePath === ".github/workflows/codeql.yml") {
      continue;
    }
    problems.push(`${workflowName}: unexpected write permission ${scope}: write`);
  }
}

function collectUses(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectUses(item, found);
    }
    return found;
  }
  if (!value || typeof value !== "object") {
    return found;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === "uses" && typeof nested === "string") {
      found.push(nested);
      continue;
    }
    collectUses(nested, found);
  }
  return found;
}

function splitUses(uses) {
  const atIndex = uses.lastIndexOf("@");
  if (atIndex === -1) {
    return { ownerRepo: uses, ref: "" };
  }
  return {
    ownerRepo: uses.slice(0, atIndex),
    ref: uses.slice(atIndex + 1)
  };
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
