#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_MIN_ITERATIONS = 2;
const DEFAULT_MIN_SCORE = 1;
const DEFAULT_MIN_PROVIDER_REQUESTS = 3;
const DEFAULT_MIN_RUNNER_COMMANDS = 5;
const DEFAULT_SCENARIOS = ["trend_long", "range_flat"];
const DEFAULT_RUNNER_KIND = "docker_sandboxes_sbx";
const DEFAULT_AGENT_PROVIDER = "codex";
const DEFAULT_MODE = "replay";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run audit:trading-research:seeded-stability -- --session-id <id>
       npm run audit:trading-research:seeded-stability -- --notebook <path>
       npm run audit:trading-research:seeded-stability -- --notebook <path> --seed-artifact <path>

Audits a Trading research seeded stability notebook.

This is different from the S10 completion audit:
- S10 proves Codex can edit and improve a seed artifact.
- Seeded stability proves a prior best artifact can be rerun through Codex/replay/SDX and remain accepted.
- no_change Codex behavior is allowed when replay/SDX evidence still passes.

Default stability gates:
- agent.provider is codex
- mode is replay
- at least two iterations are recorded
- best score is at least 1 and best artifact points at a kept artifact
- at least one keep decision exists, but the kept artifact does not need a Codex edit
- no agent failure is recorded
- each iteration has accepted replay evaluation evidence
- each required scenario ran in Docker Sandboxes sbx/sdx and was accepted
- each scenario includes provider request evidence and sandbox lifecycle command evidence
- each scenario proves replay-provider-sidecar.py plus TRADING_API_BASE_URL ran inside the sandbox

Options:
  --session-id <id>              Read .ouroboros/trading-research/<id>/notebook.json
  --notebook <path>              Read an explicit notebook path
  --notebook-path <path>         Alias for --notebook
  --seed-artifact <path>         Optional seed artifact path for no-change digest comparison
  --min-iterations <number>      Default: ${DEFAULT_MIN_ITERATIONS}
  --min-score <number>           Default: ${DEFAULT_MIN_SCORE}

Exit codes:
  0  seeded stability evidence passed
  1  usage, file, or JSON parse error
  2  seeded stability evidence is missing or incomplete
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const minIterations = parseNumberArg(args["min-iterations"], DEFAULT_MIN_ITERATIONS);
const minScore = parseNumberArg(args["min-score"], DEFAULT_MIN_SCORE);
const notebookPath = resolveNotebookPath(args);
const seedArtifactPath = args["seed-artifact"] ? path.resolve(args["seed-artifact"]) : undefined;

if (!notebookPath) {
  console.error("ERROR missing --session-id or --notebook");
  process.exit(1);
}

let notebook;
try {
  notebook = JSON.parse(await readFile(notebookPath, "utf8"));
} catch (error) {
  console.error(`ERROR failed to read notebook: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const missing = [];
const entries = asArray(notebook?.entries);
const bestScore = finiteNumber(notebook?.best_score);
const bestArtifactDir = stringValue(notebook?.best_artifact_dir);
const sessionId = stringValue(notebook?.session_id);
const mode = stringValue(notebook?.mode);
const agentProvider = stringValue(notebook?.agent?.provider);
const programPath = stringValue(notebook?.program_path);

requireValue(sessionId, "notebook.session_id");
requireEqual(agentProvider, DEFAULT_AGENT_PROVIDER, "agent.provider");
requireEqual(mode, DEFAULT_MODE, "notebook.mode");
requireValue(programPath, "notebook.program_path");
requireAtLeast(bestScore, minScore, "notebook.best_score");
requireValue(bestArtifactDir, "notebook.best_artifact_dir");
if (bestArtifactDir && !bestArtifactDir.includes("kept-artifact")) {
  missing.push("notebook.best_artifact_dir includes kept-artifact");
}
requireAtLeast(entries.length, minIterations, "notebook.entries.length");

const keptEntries = entries.filter((entry) => entry?.decision === "keep");
if (keptEntries.length === 0) {
  missing.push("at least one keep decision");
}
if (
  bestArtifactDir &&
  keptEntries.length > 0 &&
  !keptEntries.some((entry) => bestArtifactDir === stringValue(entry?.artifact_dir) || bestArtifactDir.includes(iterationSlug(entry)))
) {
  missing.push("best artifact corresponds to a kept iteration");
}
if (entries.some((entry) => entry?.agent_status === "failed")) {
  missing.push("no agent_status failed entries");
}
if (entries.some((entry) => stringValue(entry?.agent_failure_reason))) {
  missing.push("no agent_failure_reason entries");
}

for (const entry of entries) {
  auditEntry(entry);
}

let seedComparison;
if (seedArtifactPath) {
  seedComparison = await auditSeedStability(seedArtifactPath, entries[0], bestArtifactDir);
}

console.log("Trading research seeded stability audit");
console.log(`notebook=${notebookPath}`);
console.log(`session_id=${sessionId || "<missing>"}`);
console.log(`agent_provider=${agentProvider || "<missing>"}`);
console.log(`mode=${mode || "<missing>"}`);
console.log(`program_path=${programPath || "<missing>"}`);
console.log(`best_score=${formatNumber(bestScore)}`);
console.log(`best_artifact_dir=${bestArtifactDir || "<missing>"}`);
console.log(`iterations=${entries.length}`);
console.log(`required_scenarios=${DEFAULT_SCENARIOS.join(",")}`);
console.log(`required_runner=${DEFAULT_RUNNER_KIND}`);
if (seedArtifactPath) {
  console.log(`seed_artifact=${seedArtifactPath}`);
}
for (const entry of entries) {
  printEntrySummary(entry);
}
if (seedComparison) {
  console.log(`seed_candidate_digest_match=${seedComparison.candidate_match}`);
  console.log(`seed_best_artifact_digest_match=${seedComparison.best_match}`);
  console.log(`seed_editable_paths=${seedComparison.editable_paths.join(",") || "none"}`);
}

if (missing.length > 0) {
  for (const item of missing) {
    console.log(`MISSING ${item}`);
  }
  console.log("AUDIT_RESULT failed");
  process.exitCode = 2;
} else {
  console.log("PASS seeded Codex SDX replay stability evidence is complete");
  console.log("EVIDENCE_BOUNDARY notebook_command_evidence_only");
  console.log("NO_AUTHORITY live_exchange=false order_authority=false counted_evidence=false promotion=false");
  console.log("AUDIT_RESULT passed");
}

function auditEntry(entry) {
  const label = entryLabel(entry);
  requireAtLeast(finiteNumber(entry?.iteration), 1, `${label} iteration`);
  requireValue(stringValue(entry?.decision), `${label} decision`);
  requireAtLeast(finiteNumber(entry?.score), minScore, `${label} score`);
  const agentStatus = stringValue(entry?.agent_status);
  requireValue(agentStatus, `${label} agent_status`);
  if (agentStatus && !["edited", "no_change"].includes(agentStatus)) {
    missing.push(`${label} agent_status is edited or no_change`);
  }
  requireValue(stringValue(entry?.artifact_dir), `${label} artifact_dir`);
  requireValue(stringValue(entry?.events_path), `${label} events_path`);
  requireEqual(stringValue(entry?.evaluation?.status), "accepted", `${label} evaluation.status`);
  requireAtLeast(finiteNumber(entry?.evaluation?.score), minScore, `${label} evaluation.score`);
  requireEqual(stringValue(entry?.evaluation?.risk_decision), "valid_order_request", `${label} evaluation.risk_decision`);

  const scenarioResults = asArray(entry?.evaluation?.scenario_results);
  if (scenarioResults.length === 0) {
    missing.push(`${label} evaluation.scenario_results`);
  }
  for (const scenarioId of DEFAULT_SCENARIOS) {
    if (!scenarioResults.some((scenario) => scenario?.scenario_id === scenarioId)) {
      missing.push(`${label} scenario ${scenarioId}`);
    }
  }
  for (const scenario of scenarioResults) {
    auditScenario(label, scenario);
  }
}

function auditScenario(entryLabelText, scenario) {
  const scenarioId = stringValue(scenario?.scenario_id) || "<missing-scenario>";
  const label = `${entryLabelText} scenario ${scenarioId}`;
  requireEqual(stringValue(scenario?.runner_kind), DEFAULT_RUNNER_KIND, `${label} runner_kind`);
  requireEqual(stringValue(scenario?.run_status), "completed", `${label} run_status`);
  requireEqual(stringValue(scenario?.status), "accepted", `${label} status`);
  requireAtLeast(finiteNumber(scenario?.score), minScore, `${label} score`);
  requireEqual(stringValue(scenario?.risk_decision), "valid_order_request", `${label} risk_decision`);
  requireValue(stringValue(scenario?.events_path), `${label} events_path`);
  requireAtLeast(finiteNumber(scenario?.provider_request_count), DEFAULT_MIN_PROVIDER_REQUESTS, `${label} provider_request_count`);
  requireAtLeast(finiteNumber(scenario?.runner_command_count), DEFAULT_MIN_RUNNER_COMMANDS, `${label} runner_command_count`);

  const commandEvidence = asArray(scenario?.runner_command_evidence);
  requireAtLeast(commandEvidence.length, DEFAULT_MIN_RUNNER_COMMANDS, `${label} runner_command_evidence.length`);
  requireLifecycleCommand(commandEvidence, "version", label);
  requireLifecycleCommand(commandEvidence, "create", label);
  requireLifecycleCommand(commandEvidence, "exec", label);
  requireLifecycleCommand(commandEvidence, "stop", label);
  requireLifecycleCommand(commandEvidence, "rm", label);
  if (!commandEvidence.some((evidence) => commandText(evidence).includes("replay-provider-sidecar.py"))) {
    missing.push(`${label} sidecar command evidence`);
  }
  if (!commandEvidence.some((evidence) => commandText(evidence).includes("TRADING_API_BASE_URL='http://127.0.0.1:"))) {
    missing.push(`${label} sandbox-local Trading API base URL evidence`);
  }
  if (commandEvidence.some((evidence) => evidence?.exit_code !== 0)) {
    missing.push(`${label} command evidence exit_code 0`);
  }
  if (commandEvidence.some((evidence) => evidence?.timed_out === true)) {
    missing.push(`${label} command evidence not timed out`);
  }
}

async function auditSeedStability(seedPath, firstEntry, bestArtifactPath) {
  if (!await directoryExists(seedPath)) {
    missing.push("seed_artifact exists");
    return { candidate_match: false, best_match: false, editable_paths: [] };
  }
  const editablePaths = await editablePathsFromManifest(seedPath);
  const firstCandidate = stringValue(firstEntry?.artifact_dir);
  if (!firstCandidate || !await directoryExists(firstCandidate)) {
    missing.push("first candidate artifact_dir exists for seed comparison");
    return { candidate_match: false, best_match: false, editable_paths: editablePaths };
  }
  if (!bestArtifactPath || !await directoryExists(bestArtifactPath)) {
    missing.push("best_artifact_dir exists for seed comparison");
    return { candidate_match: false, best_match: false, editable_paths: editablePaths };
  }
  const candidateMatch = await artifactDigestsMatch(seedPath, firstCandidate, editablePaths);
  const bestMatch = await artifactDigestsMatch(seedPath, bestArtifactPath, editablePaths);
  if (!candidateMatch) {
    missing.push("seed artifact matches first candidate editable files");
  }
  if (!bestMatch) {
    missing.push("seed artifact matches best artifact editable files");
  }
  return {
    candidate_match: candidateMatch,
    best_match: bestMatch,
    editable_paths: editablePaths
  };
}

async function artifactDigestsMatch(leftDir, rightDir, relativePaths) {
  for (const relativePath of relativePaths) {
    const leftDigest = await fileDigest(path.join(leftDir, relativePath));
    const rightDigest = await fileDigest(path.join(rightDir, relativePath));
    if (!leftDigest || !rightDigest || leftDigest !== rightDigest) {
      return false;
    }
  }
  return true;
}

async function editablePathsFromManifest(artifactDir) {
  try {
    const manifest = JSON.parse(await readFile(path.join(artifactDir, "manifest.json"), "utf8"));
    const editablePaths = Array.isArray(manifest.editable_paths)
      ? manifest.editable_paths.filter((value) => typeof value === "string")
      : [];
    return editablePaths.length > 0 ? editablePaths.sort() : ["run.py"];
  } catch {
    return ["run.py"];
  }
}

async function fileDigest(pathname) {
  try {
    return createHash("sha256").update(await readFile(pathname)).digest("hex");
  } catch {
    return undefined;
  }
}

async function directoryExists(pathname) {
  try {
    return (await stat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

function printEntrySummary(entry) {
  const changedPaths = asArray(entry?.agent_changed_paths);
  console.log(
    `iteration ${entry?.iteration ?? "<missing>"}: decision=${entry?.decision ?? "<missing>"} score=${formatNumber(finiteNumber(entry?.score))} agent_status=${entry?.agent_status ?? "<missing>"} changed_paths=${changedPaths.length > 0 ? changedPaths.join(",") : "none"}`
  );
  for (const scenario of asArray(entry?.evaluation?.scenario_results)) {
    console.log(
      `  ${scenario?.scenario_id ?? "<missing>"}: runner=${scenario?.runner_kind ?? "<missing>"} run=${scenario?.run_status ?? "<missing>"} status=${scenario?.status ?? "<missing>"} score=${formatNumber(finiteNumber(scenario?.score))} provider_requests=${scenario?.provider_request_count ?? "<missing>"} runner_commands=${scenario?.runner_command_count ?? "<missing>"} sandbox=${scenario?.sandbox_name ?? "<missing>"}`
    );
  }
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!["session-id", "notebook", "notebook-path", "seed-artifact", "min-iterations", "min-score"].includes(key)) {
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

function resolveNotebookPath(parsedArgs) {
  const explicitPath = parsedArgs.notebook ?? parsedArgs["notebook-path"];
  if (explicitPath) {
    return path.resolve(explicitPath);
  }
  const sessionIdArg = parsedArgs["session-id"];
  if (!sessionIdArg) {
    return undefined;
  }
  if (sessionIdArg.includes("/") || sessionIdArg.includes("\\") || sessionIdArg.includes("..")) {
    failUsage("invalid --session-id");
  }
  return path.resolve(".ouroboros", "trading-research", sessionIdArg, "notebook.json");
}

function parseNumberArg(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    failUsage(`invalid number: ${value}`);
  }
  return parsed;
}

function requireValue(value, label) {
  if (value === undefined || value === null || value === "") {
    missing.push(label);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    missing.push(`${label} == ${expected}`);
  }
}

function requireAtLeast(actual, expected, label) {
  if (!Number.isFinite(actual) || actual < expected) {
    missing.push(`${label} >= ${expected}`);
  }
}

function requireLifecycleCommand(commandEvidence, action, label) {
  if (!commandEvidence.some((evidence) => evidenceAction(evidence) === action)) {
    missing.push(`${label} sbx ${action} command evidence`);
  }
}

function evidenceAction(evidence) {
  const command = asArray(evidence?.command);
  if (command.length < 2) {
    return undefined;
  }
  return command[1];
}

function commandText(evidence) {
  return asArray(evidence?.command).join(" ");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : undefined;
}

function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}

function entryLabel(entry) {
  return `iteration ${entry?.iteration ?? "<missing>"}`;
}

function iterationSlug(entry) {
  const iteration = finiteNumber(entry?.iteration);
  return iteration === undefined ? "<missing>" : `/iterations/${String(iteration).padStart(3, "0")}/`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(value) : "<missing>";
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
