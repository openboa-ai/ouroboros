#!/usr/bin/env node
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = path.join(".ouroboros", "trading-research");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run trading:research:best-artifact
       npm run trading:research:best-artifact -- --artifact-only
       npm run trading:research:best-artifact -- --json

Selects the newest passing local Codex replay SDX Trading research best artifact.

Options:
  --root <path>       Directory containing <session>/notebook.json files.
                      Default: ${DEFAULT_ROOT}
  --json              Print machine-readable JSON.
  --artifact-only     Print only the selected best artifact path.

This command is read-only. It does not execute Codex, SDX, trading research, or audits.
The S10 audit command remains the completion proof gate.

Exit codes:
  0  best artifact selected
  1  usage or filesystem error
  2  no passing local best artifact found
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? DEFAULT_ROOT);

let candidates;
try {
  candidates = await readCandidates(root);
} catch (error) {
  console.error(`ERROR failed to read trading research notebooks: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const selected = candidates
  .filter((candidate) => candidate.status === "pass")
  .sort((left, right) => right.sort_time - left.sort_time)[0];

if (!selected) {
  const failure = {
    root,
    scanned_notebooks: candidates.length,
    pass_candidates: 0,
    message: "NO_PASSING_TRADING_RESEARCH_BEST_ARTIFACT"
  };
  if (args.json === "true") {
    console.log(JSON.stringify(failure, null, 2));
  } else if (args["artifact-only"] !== "true") {
    console.log("Trading research best artifact");
    console.log(`root=${root}`);
    console.log(`scanned_notebooks=${candidates.length}`);
    console.log("NO_PASSING_TRADING_RESEARCH_BEST_ARTIFACT");
  }
  process.exit(2);
}

if (args["artifact-only"] === "true") {
  console.log(selected.best_artifact_dir);
  process.exit(0);
}

if (args.json === "true") {
  console.log(JSON.stringify(publicCandidate(selected, root, candidates.length), null, 2));
  process.exit(0);
}

console.log("Trading research best artifact");
console.log(`root=${root}`);
console.log(`scanned_notebooks=${candidates.length}`);
console.log(`session_id=${selected.session_id}`);
console.log(`completed_at=${selected.completed_at}`);
console.log(`best_score=${selected.best_score}`);
console.log(`best_artifact=${selected.best_artifact_dir}`);
console.log(`notebook=${selected.notebook_path}`);
console.log(`decisions=${formatDecisionCounts(selected.decision_counts)}`);
console.log(`runner_kinds=${selected.runner_kinds.join(",")}`);
console.log(`scenarios=${selected.scenario_accepted}/${selected.scenario_total} accepted`);
console.log(`provider_requests=${selected.provider_request_total}`);
console.log(`runner_commands=${selected.runner_command_total}`);
console.log("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");

async function readCandidates(rootPath) {
  const rootEntries = await readdir(rootPath, { withFileTypes: true });
  const candidates = [];
  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const notebookPath = path.join(rootPath, entry.name, "notebook.json");
    let notebookStat;
    try {
      notebookStat = await stat(notebookPath);
    } catch {
      continue;
    }
    let notebook;
    try {
      notebook = JSON.parse(await readFile(notebookPath, "utf8"));
    } catch {
      continue;
    }
    candidates.push(await summarizeNotebook(notebook, notebookPath, notebookStat));
  }
  return candidates;
}

async function summarizeNotebook(notebook, notebookPath, notebookStat) {
  const entries = asArray(notebook?.entries);
  const scenarios = entries.flatMap((entry) => asArray(entry?.evaluation?.scenario_results));
  const decisionCounts = {};
  for (const entry of entries) {
    const decision = stringValue(entry?.decision) ?? "unknown";
    decisionCounts[decision] = (decisionCounts[decision] ?? 0) + 1;
  }
  const runnerKinds = Array.from(new Set(scenarios.map((scenario) => scenario?.runner_kind).filter(Boolean))).sort();
  const completedAt = latestCompletedAt(entries) ?? new Date(notebookStat.mtimeMs).toISOString();
  const sortTime = Date.parse(completedAt);
  const bestArtifactDir = stringValue(notebook?.best_artifact_dir);
  const artifactExists = bestArtifactDir ? await directoryExists(bestArtifactDir) : false;
  const scenarioAccepted = scenarios.filter((scenario) => (
    scenario?.status === "accepted" && scenario?.run_status === "completed"
  )).length;
  const providerRequestTotal = scenarios.reduce((total, scenario) => total + numberValue(scenario?.provider_request_count), 0);
  const runnerCommandTotal = scenarios.reduce((total, scenario) => total + numberValue(scenario?.runner_command_count), 0);
  const missing = completionMissing(notebook, entries, scenarios, artifactExists);
  return {
    session_id: stringValue(notebook?.session_id) ?? path.basename(path.dirname(notebookPath)),
    status: missing.length === 0 ? "pass" : "not_pass",
    missing,
    completed_at: completedAt,
    sort_time: Number.isFinite(sortTime) ? sortTime : notebookStat.mtimeMs,
    agent_provider: stringValue(notebook?.agent?.provider) ?? "<missing>",
    mode: stringValue(notebook?.mode) ?? "<missing>",
    entry_count: entries.length,
    decision_counts: decisionCounts,
    best_score: numberOrUndefined(notebook?.best_score),
    best_artifact_dir: bestArtifactDir,
    notebook_path: notebookPath,
    runner_kinds: runnerKinds,
    scenario_accepted: scenarioAccepted,
    scenario_total: scenarios.length,
    provider_request_total: providerRequestTotal,
    runner_command_total: runnerCommandTotal
  };
}

function completionMissing(notebook, entries, scenarios, artifactExists) {
  const missing = [];
  if (notebook?.agent?.provider !== "codex") {
    missing.push("agent.provider == codex");
  }
  if (notebook?.mode !== "replay") {
    missing.push("mode == replay");
  }
  if (!Number.isFinite(notebook?.best_score) || notebook.best_score < 1) {
    missing.push("best_score >= 1");
  }
  if (!stringValue(notebook?.best_artifact_dir)) {
    missing.push("best_artifact_dir");
  } else if (!artifactExists) {
    missing.push("best_artifact_dir exists");
  }
  if (entries.length < 2) {
    missing.push("entries >= 2");
  }
  if (!entries.some((entry) => (
    entry?.decision === "keep"
    && entry?.agent_status === "edited"
    && asArray(entry?.agent_changed_paths).length > 0
  ))) {
    missing.push("kept edited artifact");
  }
  for (const entry of entries) {
    if (entry?.evaluation?.status !== "accepted") {
      missing.push(`iteration ${entry?.iteration ?? "<missing>"} evaluation.status == accepted`);
    }
  }
  if (scenarios.length === 0) {
    missing.push("scenario_results");
  }
  for (const scenario of scenarios) {
    const label = scenario?.scenario_id ?? "<missing-scenario>";
    if (scenario?.runner_kind !== "docker_sandboxes_sbx") {
      missing.push(`${label} runner_kind == docker_sandboxes_sbx`);
    }
    if (scenario?.run_status !== "completed") {
      missing.push(`${label} run_status == completed`);
    }
    if (scenario?.status !== "accepted") {
      missing.push(`${label} status == accepted`);
    }
    if (numberValue(scenario?.provider_request_count) < 3) {
      missing.push(`${label} provider_request_count >= 3`);
    }
    if (numberValue(scenario?.runner_command_count) < 5) {
      missing.push(`${label} runner_command_count >= 5`);
    }
  }
  return missing;
}

function publicCandidate(candidate, root, scannedNotebooks) {
  return {
    root,
    scanned_notebooks: scannedNotebooks,
    session_id: candidate.session_id,
    completed_at: candidate.completed_at,
    agent_provider: candidate.agent_provider,
    mode: candidate.mode,
    entry_count: candidate.entry_count,
    decision_counts: candidate.decision_counts,
    best_score: candidate.best_score,
    best_artifact_dir: candidate.best_artifact_dir,
    notebook_path: candidate.notebook_path,
    runner_kinds: candidate.runner_kinds,
    scenario_accepted: candidate.scenario_accepted,
    scenario_total: candidate.scenario_total,
    provider_request_total: candidate.provider_request_total,
    runner_command_total: candidate.runner_command_total
  };
}

async function directoryExists(pathname) {
  try {
    return (await stat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

function latestCompletedAt(entries) {
  const timestamps = entries
    .map((entry) => stringValue(entry?.completed_at))
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time);
  return timestamps[0]?.value;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (key === "json" || key === "artifact-only") {
      parsed[key] = "true";
      continue;
    }
    if (key !== "root") {
      failUsage(`unknown option: --${key}`);
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      failUsage(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }
  if (parsed.json === "true" && parsed["artifact-only"] === "true") {
    failUsage("--json and --artifact-only cannot be combined");
  }
  return parsed;
}

function formatDecisionCounts(counts) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([key, value]) => `${key}:${value}`).join(",") : "none";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  return Number.isFinite(value) ? value : 0;
}

function numberOrUndefined(value) {
  return Number.isFinite(value) ? value : undefined;
}

function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
