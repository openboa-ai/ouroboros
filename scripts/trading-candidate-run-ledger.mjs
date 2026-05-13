#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = path.join(".ouroboros", "trader-system-candidate-runs");
const DEFAULT_LIMIT = 10;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run trading:candidate:run:ledger
       npm run trading:candidate:run:ledger -- --limit 5
       npm run trading:candidate:run:ledger -- --root <path> --json

Lists local TraderSystemCandidate replay runs without running agents, providers, sandboxes, or audits.

Options:
  --root <path>       Candidate run root. Default: ${DEFAULT_ROOT}
  --limit <number>    Max runs to print. Default: ${DEFAULT_LIMIT}
  --json              Print machine-readable JSON.

Exit codes:
  0  ledger printed
  1  usage or filesystem error
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? DEFAULT_ROOT);
const limit = parsePositiveInteger(args.limit ?? String(DEFAULT_LIMIT), "--limit");

let runs;
try {
  runs = await readRuns(root);
} catch (error) {
  if (error?.code === "ENOENT") {
    runs = [];
  } else {
    console.error(`ERROR failed to read trading candidate run ledger: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const selected = runs
  .sort((left, right) => Date.parse(right.completed_at ?? "") - Date.parse(left.completed_at ?? ""))
  .slice(0, limit);

if (args.json === "true") {
  console.log(JSON.stringify({ root, limit, runs: selected }, null, 2));
  process.exit(0);
}

console.log("Trading candidate run ledger");
console.log(`root=${root}`);
console.log(`limit=${limit}`);
console.log(`runs=${selected.length}`);
for (const run of selected) {
  console.log(
    `run ${run.run_id} candidate=${run.candidate_id} runner=${run.runner_kind} status=${run.status} authority=${run.authority_status}`
  );
  console.log(
    `  scenarios=${run.scenario_accepted}/${run.scenario_total} accepted provider_requests=${run.provider_request_total} runner_commands=${run.runner_command_total}`
  );
  console.log(`  artifact_digest=${run.artifact_digest}`);
  console.log(`  run_dir=${run.run_dir}`);
  console.log(`  completed_at=${run.completed_at}`);
}

async function readRuns(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = path.join(rootPath, entry.name);
    try {
      const run = JSON.parse(await readFile(path.join(runDir, "run.json"), "utf8"));
      runs.push({
        run_id: run.run_id,
        run_dir: runDir,
        candidate_id: run.candidate_id,
        runner_kind: run.runner_kind,
        status: run.status,
        run_status: run.run_status,
        scenario_accepted: run.scenario_accepted,
        scenario_total: run.scenario_total,
        provider_request_total: run.provider_request_total,
        runner_command_total: run.runner_command_total,
        artifact_digest: run.artifact_digest,
        completed_at: run.completed_at,
        authority_status: run.authority_status ?? "not_live"
      });
    } catch {
      // Ignore partially written local output directories.
    }
  }
  return runs;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (key === "json") {
      parsed[key] = "true";
      continue;
    }
    if (!["root", "limit"].includes(key)) {
      failUsage(`unknown option: --${key}`);
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      failUsage(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    failUsage(`${label} must be a positive integer`);
  }
  return parsed;
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
