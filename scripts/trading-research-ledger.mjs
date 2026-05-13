#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_ROOT = path.join(".ouroboros", "trading-research");
const DEFAULT_LIMIT = 10;
const STATUS_VALUES = new Set(["all", "pass", "blocked", "incomplete", "invalid"]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run trading:research:ledger
       npm run trading:research:ledger -- --limit 5
       npm run trading:research:ledger -- --root <path> --json

Lists local Trading AAR notebook runs without executing Codex, SDX, or an audit.

Options:
  --root <path>       Directory containing <session>/notebook.json files.
                      Default: ${DEFAULT_ROOT}
  --limit <number>    Max runs to print. Default: ${DEFAULT_LIMIT}
  --status <status>   all, pass, blocked, incomplete, invalid. Default: all
  --json              Print machine-readable JSON.

Completion status is a ledger summary, not a replacement for the S10 audit gate.
Use npm run audit:s10-trading-research for completion proof.

Exit codes:
  0  ledger printed
  1  usage, filesystem, or JSON parse error
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root ?? DEFAULT_ROOT);
const limit = parsePositiveInteger(args.limit ?? String(DEFAULT_LIMIT), "--limit");
const statusFilter = args.status ?? "all";
if (!STATUS_VALUES.has(statusFilter)) {
  failUsage(`--status must be one of ${Array.from(STATUS_VALUES).join(", ")}`);
}

let runs;
try {
  runs = await readRuns(root);
} catch (error) {
  console.error(`ERROR failed to read trading research ledger: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const filteredRuns = runs
  .filter((run) => statusFilter === "all" || run.status === statusFilter)
  .sort((left, right) => right.sort_time - left.sort_time)
  .slice(0, limit);

if (args.json === "true") {
  console.log(JSON.stringify({
    root,
    status_filter: statusFilter,
    limit,
    runs: filteredRuns.map(publicRun)
  }, null, 2));
  process.exit(0);
}

console.log("Trading AAR run ledger");
console.log(`root=${root}`);
console.log(`status_filter=${statusFilter}`);
console.log(`limit=${limit}`);
console.log(`runs=${filteredRuns.length}`);
for (const run of filteredRuns) {
  printRun(run);
}

async function readRuns(rootPath) {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const notebookPath = path.join(rootPath, entry.name, "notebook.json");
    let fileStat;
    try {
      fileStat = await stat(notebookPath);
    } catch {
      continue;
    }
    let notebook;
    try {
      notebook = JSON.parse(await readFile(notebookPath, "utf8"));
    } catch (error) {
      runs.push(invalidRun(entry.name, notebookPath, fileStat, error));
      continue;
    }
    runs.push(summarizeNotebook(notebook, notebookPath, fileStat));
  }
  return runs;
}

function summarizeNotebook(notebook, notebookPath, fileStat) {
  const entries = asArray(notebook?.entries);
  const scenarioResults = entries.flatMap((entry) => asArray(entry?.evaluation?.scenario_results));
  const decisionCounts = {};
  for (const entry of entries) {
    const decision = stringValue(entry?.decision) ?? "unknown";
    decisionCounts[decision] = (decisionCounts[decision] ?? 0) + 1;
  }
  const runnerKinds = Array.from(new Set(scenarioResults.map((scenario) => scenario?.runner_kind).filter(Boolean))).sort();
  const scenarioAccepted = scenarioResults.filter((scenario) => (
    scenario?.status === "accepted" && scenario?.run_status === "completed"
  )).length;
  const providerRequestTotal = scenarioResults.reduce((total, scenario) => (
    total + numberValue(scenario?.provider_request_count)
  ), 0);
  const runnerCommandTotal = scenarioResults.reduce((total, scenario) => (
    total + numberValue(scenario?.runner_command_count)
  ), 0);
  const completedAt = latestCompletedAt(entries);
  const sortTime = completedAt ? Date.parse(completedAt) : fileStat.mtimeMs;
  const missing = completionMissing(notebook, entries, scenarioResults);
  const status = statusFor(notebook, entries, missing);
  return {
    session_id: stringValue(notebook?.session_id) ?? path.basename(path.dirname(notebookPath)),
    status,
    missing,
    agent_provider: stringValue(notebook?.agent?.provider) ?? "<missing>",
    mode: stringValue(notebook?.mode) ?? "<missing>",
    entry_count: entries.length,
    decision_counts: decisionCounts,
    best_score: numberOrUndefined(notebook?.best_score),
    best_artifact_dir: stringValue(notebook?.best_artifact_dir),
    notebook_path: notebookPath,
    completed_at: completedAt ?? new Date(fileStat.mtimeMs).toISOString(),
    sort_time: Number.isFinite(sortTime) ? sortTime : fileStat.mtimeMs,
    runner_kinds: runnerKinds,
    scenario_accepted: scenarioAccepted,
    scenario_total: scenarioResults.length,
    provider_request_total: providerRequestTotal,
    runner_command_total: runnerCommandTotal
  };
}

function invalidRun(sessionId, notebookPath, fileStat, error) {
  return {
    session_id: sessionId,
    status: "invalid",
    missing: [`invalid notebook JSON: ${error instanceof Error ? error.message : String(error)}`],
    agent_provider: "<missing>",
    mode: "<missing>",
    entry_count: 0,
    decision_counts: {},
    best_score: undefined,
    best_artifact_dir: undefined,
    notebook_path: notebookPath,
    completed_at: new Date(fileStat.mtimeMs).toISOString(),
    sort_time: fileStat.mtimeMs,
    runner_kinds: [],
    scenario_accepted: 0,
    scenario_total: 0,
    provider_request_total: 0,
    runner_command_total: 0
  };
}

function completionMissing(notebook, entries, scenarioResults) {
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
  if (scenarioResults.length === 0) {
    missing.push("scenario_results");
  }
  for (const scenario of scenarioResults) {
    const label = `${scenario?.scenario_id ?? "<missing-scenario>"}`;
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

function statusFor(notebook, entries, missing) {
  if (missing.length === 0) {
    return "pass";
  }
  const failureText = JSON.stringify({
    failure_reasons: entries.map((entry) => entry?.agent_failure_reason),
    metrics: entries.flatMap((entry) => asArray(entry?.evaluation?.metrics).map((metric) => metric?.detail))
  }).toLowerCase();
  if (
    entries.some((entry) => entry?.agent_status === "failed")
    || failureText.includes("environment_blocked")
    || failureText.includes("operation not permitted")
    || failureText.includes("failed to initialize")
    || failureText.includes("unavailable")
  ) {
    return "blocked";
  }
  if (notebook?.status === "invalid") {
    return "invalid";
  }
  return "incomplete";
}

function printRun(run) {
  console.log(`run ${run.session_id} status=${run.status} completed_at=${run.completed_at}`);
  console.log(
    `  agent=${run.agent_provider} mode=${run.mode} entries=${run.entry_count} decisions=${formatDecisionCounts(run.decision_counts)} best_score=${formatValue(run.best_score)}`
  );
  console.log(
    `  runners=${run.runner_kinds.length ? run.runner_kinds.join(",") : "none"} scenarios=${run.scenario_accepted}/${run.scenario_total} accepted provider_requests=${run.provider_request_total} runner_commands=${run.runner_command_total}`
  );
  console.log(`  notebook=${run.notebook_path}`);
  if (run.best_artifact_dir) {
    console.log(`  best_artifact=${run.best_artifact_dir}`);
  }
  if (run.status !== "pass" && run.missing.length > 0) {
    console.log(`  missing=${run.missing.slice(0, 4).join("; ")}${run.missing.length > 4 ? `; +${run.missing.length - 4} more` : ""}`);
  }
}

function publicRun(run) {
  return {
    session_id: run.session_id,
    status: run.status,
    completed_at: run.completed_at,
    agent_provider: run.agent_provider,
    mode: run.mode,
    entry_count: run.entry_count,
    decision_counts: run.decision_counts,
    best_score: run.best_score,
    runner_kinds: run.runner_kinds,
    scenario_accepted: run.scenario_accepted,
    scenario_total: run.scenario_total,
    provider_request_total: run.provider_request_total,
    runner_command_total: run.runner_command_total,
    notebook_path: run.notebook_path,
    best_artifact_dir: run.best_artifact_dir,
    missing: run.missing
  };
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
    if (key === "json") {
      parsed[key] = "true";
      continue;
    }
    if (!["root", "limit", "status"].includes(key)) {
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

function formatDecisionCounts(counts) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([key, value]) => `${key}:${value}`).join(",") : "none";
}

function formatValue(value) {
  return value === undefined ? "<missing>" : String(value);
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
