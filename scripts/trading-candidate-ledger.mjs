#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = path.join(".ouroboros", "trading-system-candidates");
const DEFAULT_LIMIT = 10;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run trading:candidate:ledger
       npm run trading:candidate:ledger -- --limit 5
       npm run trading:candidate:ledger -- --root <path> --json

Lists local TradingSystemCandidate promotions without running agents, providers, sandboxes, or audits.

Options:
  --root <path>       Candidate promotion root. Default: ${DEFAULT_ROOT}
  --limit <number>    Max candidates to print. Default: ${DEFAULT_LIMIT}
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

let candidates;
try {
  candidates = await readCandidates(root);
} catch (error) {
  if (error?.code === "ENOENT") {
    candidates = [];
  } else {
    console.error(`ERROR failed to read trading candidate ledger: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const selected = candidates
  .sort((left, right) => Date.parse(right.promoted_at ?? "") - Date.parse(left.promoted_at ?? ""))
  .slice(0, limit);

if (args.json === "true") {
  console.log(JSON.stringify({ root, limit, candidates: selected }, null, 2));
  process.exit(0);
}

console.log("Trading candidate ledger");
console.log(`root=${root}`);
console.log(`limit=${limit}`);
console.log(`candidates=${selected.length}`);
for (const candidate of selected) {
  console.log(
    `candidate ${candidate.candidate_id} gate=${candidate.gate} source_session=${candidate.source_session_id} authority=${candidate.authority_status}`
  );
  console.log(
    `  completion_status=${candidate.completion_status} seeded_stability_status=${candidate.seeded_stability_status} artifact_digest=${candidate.artifact_digest}`
  );
  console.log(`  candidate_dir=${candidate.candidate_dir}`);
  console.log(`  promoted_at=${candidate.promoted_at}`);
}

async function readCandidates(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidateDir = path.join(rootPath, entry.name);
    try {
      const candidate = JSON.parse(await readFile(path.join(candidateDir, "candidate.json"), "utf8"));
      const promotion = JSON.parse(await readFile(path.join(candidateDir, "promotion.json"), "utf8"));
      candidates.push({
        candidate_id: candidate.candidate_id,
        candidate_dir: candidateDir,
        gate: promotion.gate,
        source_session_id: promotion.source?.session_id,
        notebook_path: promotion.source?.notebook_path,
        source_best_artifact_dir: promotion.source?.source_best_artifact_dir,
        completion_status: promotion.gate_status?.completion_status,
        seeded_stability_status: promotion.gate_status?.seeded_stability_status,
        artifact_digest: promotion.artifact_digest,
        promoted_at: promotion.promoted_at,
        authority_status: candidate.authority_status ?? promotion.authority_status ?? "not_live"
      });
    } catch {
      // Ignore partially written local output directories.
    }
  }
  return candidates;
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
