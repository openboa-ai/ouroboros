#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_RESEARCH_ROOT = path.join(".ouroboros", "trading-research");
const DEFAULT_CANDIDATE_ROOT = path.join(".ouroboros", "trader-system-candidates");
const GATE_VALUES = new Set(["completion", "seeded-stability"]);
const REQUIRED_SCENARIOS = ["trend_long", "range_flat"];

const knownArgs = new Set([
  "candidate-id",
  "candidate-root",
  "gate",
  "help",
  "json",
  "notebook",
  "print-only",
  "research-root",
  "seed-artifact",
  "session-id"
]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run trading:research:promote-candidate -- --session-id <id> --gate completion
       npm run trading:research:promote-candidate -- --session-id <id> --gate seeded-stability --seed-artifact <path>
       npm run trading:research:promote-candidate -- --notebook <path> --gate seeded-stability --seed-artifact <path>

Promotes a verified Trading AAR notebook best artifact into a local TraderSystemCandidate record.

Options:
  --session-id <id>        Read <research-root>/<id>/notebook.json.
  --notebook <path>        Read an explicit notebook path.
  --gate <gate>            completion or seeded-stability. Required.
  --seed-artifact <path>   Required for seeded-stability digest comparison.
  --candidate-id <id>      Optional stable candidate id override.
  --research-root <path>   Default: ${DEFAULT_RESEARCH_ROOT}
  --candidate-root <path>  Default: ${DEFAULT_CANDIDATE_ROOT}
  --json                   Print machine-readable JSON.
  --print-only             Validate and print the promotion target without writing files.

Exit codes:
  0  candidate promoted, or print-only validation passed
  1  usage, file, or JSON error
  2  selected promotion gate did not pass
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const gate = args.gate;
if (!gate || !GATE_VALUES.has(gate)) {
  failUsage(`--gate must be one of ${Array.from(GATE_VALUES).join(", ")}`);
}

const candidateRoot = path.resolve(args["candidate-root"] ?? DEFAULT_CANDIDATE_ROOT);
const notebookPath = resolveNotebookPath(args);
let notebook;
try {
  notebook = JSON.parse(await readFile(notebookPath, "utf8"));
} catch (error) {
  console.error(`ERROR failed to read notebook: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const sessionId = stringValue(notebook?.session_id) ?? path.basename(path.dirname(notebookPath));
const bestArtifactDir = stringValue(notebook?.best_artifact_dir);
if (!bestArtifactDir) {
  console.log("PROMOTION_RESULT failed");
  console.log("MISSING notebook.best_artifact_dir");
  process.exit(2);
}
if (!await directoryExists(bestArtifactDir)) {
  console.log("PROMOTION_RESULT failed");
  console.log("MISSING notebook.best_artifact_dir exists");
  process.exit(2);
}

const seedArtifactPath = args["seed-artifact"] ? path.resolve(args["seed-artifact"]) : undefined;
const gateSummary = await summarizeNotebookGate(notebook, bestArtifactDir, seedArtifactPath);
const selectedStatus = gate === "completion"
  ? gateSummary.completion_status
  : gateSummary.seeded_stability_status;
const selectedMissing = gate === "completion"
  ? gateSummary.completion_missing
  : gateSummary.seeded_stability_missing;

if (selectedStatus !== "pass") {
  printFailure(gate, selectedStatus, selectedMissing);
  process.exit(2);
}

const sourceDigest = await artifactDigest(bestArtifactDir);
const suffix = stableSuffix(`${sessionId}:${gate}:${sourceDigest}`);
const candidateId = args["candidate-id"] ?? `trader-system-candidate-${suffix}`;
validateCandidateId(candidateId);
const candidateVersionId = `${candidateId}-v1`;
const runnableArtifactId = `runnable-artifact-${suffix}`;
const promotionId = `trading-research-promotion-${suffix}`;
const candidateDir = path.join(candidateRoot, candidateId);
const promotedArtifactDir = path.join(candidateDir, "artifact");
const manifest = await readArtifactManifest(bestArtifactDir);
const promotedAt = new Date().toISOString();

const refs = {
  candidate: ref("trader_system_candidate", candidateId),
  candidateVersion: ref("candidate_version", candidateVersionId),
  runnableArtifact: ref("runnable_artifact", runnableArtifactId),
  notebook: ref("trading_research_notebook", sessionId),
  promotion: ref("trading_research_candidate_promotion", promotionId)
};

const candidate = {
  record_kind: "trader_system_candidate",
  version: 1,
  candidate_id: candidateId,
  display_name: `Trading AAR candidate ${sessionId}`,
  status: "materialized",
  active_version_id: candidateVersionId,
  provenance_refs: [refs.notebook, refs.runnableArtifact, refs.promotion],
  title: `Trading AAR candidate from ${sessionId}`,
  system_summary: `Promoted from Trading AAR ${gate} gate using artifact ${manifest.id ?? "unknown"}.`,
  candidate_status: "handoff_ready",
  evaluation_handoff_ready: true,
  active_runnable_artifact_ref: refs.runnableArtifact,
  authority_status: "not_live"
};

const candidateVersion = {
  record_kind: "candidate_version",
  version: 1,
  candidate_version_id: candidateVersionId,
  candidate_id: candidateId,
  version_label: "trading-aar-v1",
  spec_ref: ref("trader_system_spec", `${candidateId}-spec`),
  program_ref: ref("trader_system_program", `${candidateId}-program`),
  capability_package_refs: [ref("capability_package", `${candidateId}-capabilities`)],
  runtime_ref: ref("trader_system_runtime", `${candidateId}-runtime`),
  trace_placeholder_ref: ref("trace_placeholder", `${candidateId}-trace`),
  runnable_artifact_ref: refs.runnableArtifact
};

const runnableArtifact = {
  record_kind: "runnable_artifact",
  version: 1,
  runnable_artifact_id: runnableArtifactId,
  artifact_kind: "python_file",
  artifact_path: promotedArtifactDir,
  artifact_digest: sourceDigest,
  runtime_kind: "python",
  entrypoint: asArray(manifest.entrypoint).map(String),
  declared_output_contract: {
    contract_kind: "opaque_runtime_boundary",
    declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_intent"]
  },
  secret_policy_ref: ref("secret_policy", "secret-policy-no-raw-values-v1"),
  capability_policy_ref: ref("capability_policy", "capability-policy-trading-replay-readonly-v1"),
  provenance_refs: [refs.notebook, refs.promotion],
  status: "registered",
  created_at: promotedAt,
  authority_status: "not_live"
};

const promotion = {
  record_kind: "trading_research_candidate_promotion",
  version: 1,
  promotion_id: promotionId,
  candidate_ref: refs.candidate,
  candidate_version_ref: refs.candidateVersion,
  runnable_artifact_ref: refs.runnableArtifact,
  source: {
    session_id: sessionId,
    notebook_path: notebookPath,
    source_best_artifact_dir: bestArtifactDir,
    seed_artifact_path: seedArtifactPath
  },
  gate,
  gate_status: gateSummary,
  artifact_manifest: manifest,
  artifact_digest: sourceDigest,
  evidence_summary: gateSummary.evidence_summary,
  promoted_at: promotedAt,
  evidence_disposition: "not_counted",
  authority_status: "not_live",
  no_authority: {
    live_exchange: false,
    order_authority: false,
    credentials: false,
    paper_trading: false
  }
};

if (args["print-only"] !== "true") {
  await mkdir(candidateDir, { recursive: true });
  await rm(promotedArtifactDir, { recursive: true, force: true });
  await cp(bestArtifactDir, promotedArtifactDir, { recursive: true });
  await writeJson(path.join(candidateDir, "candidate.json"), candidate);
  await writeJson(path.join(candidateDir, "candidate-version.json"), candidateVersion);
  await writeJson(path.join(candidateDir, "runnable-artifact.json"), runnableArtifact);
  await writeJson(path.join(candidateDir, "promotion.json"), promotion);
  await rebuildCandidateIndex(candidateRoot);
}

const outcome = {
  candidate_id: candidateId,
  candidate_dir: candidateDir,
  gate,
  completion_status: gateSummary.completion_status,
  seeded_stability_status: gateSummary.seeded_stability_status,
  artifact_digest: sourceDigest,
  notebook_path: notebookPath,
  source_best_artifact_dir: bestArtifactDir,
  promoted_artifact_dir: promotedArtifactDir,
  authority_status: "not_live",
  print_only: args["print-only"] === "true"
};

if (args.json === "true") {
  console.log(JSON.stringify(outcome, null, 2));
} else {
  console.log("Trading AAR candidate promotion");
  console.log(`candidate_id=${candidateId}`);
  console.log(`gate=${gate}`);
  console.log(`completion_status=${gateSummary.completion_status}`);
  console.log(`seeded_stability_status=${gateSummary.seeded_stability_status}`);
  console.log(`artifact_digest=${sourceDigest}`);
  console.log(`notebook=${notebookPath}`);
  console.log(`source_best_artifact=${bestArtifactDir}`);
  console.log(`candidate_dir=${candidateDir}`);
  console.log("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");
  if (args["print-only"] === "true") {
    console.log("PRINT_ONLY true");
  }
  console.log("PROMOTION_RESULT promoted");
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!knownArgs.has(key)) {
      failUsage(`unknown option: --${key}`);
    }
    if (key === "json" || key === "print-only") {
      parsed[key] = "true";
      continue;
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      failUsage(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }
  if (parsed["session-id"] && parsed.notebook) {
    failUsage("--session-id and --notebook cannot be combined");
  }
  return parsed;
}

function resolveNotebookPath(parsedArgs) {
  if (parsedArgs.notebook) {
    return path.resolve(parsedArgs.notebook);
  }
  if (parsedArgs["session-id"]) {
    validateSessionId(parsedArgs["session-id"]);
    return path.resolve(
      parsedArgs["research-root"] ?? DEFAULT_RESEARCH_ROOT,
      parsedArgs["session-id"],
      "notebook.json"
    );
  }
  failUsage("missing --session-id or --notebook");
}

async function summarizeNotebookGate(notebook, bestArtifactDir, seedArtifactPath) {
  const entries = asArray(notebook?.entries);
  const scenarios = entries.flatMap((entry) => asArray(entry?.evaluation?.scenario_results));
  const evidenceSummary = {
    scenario_accepted: scenarios.filter((scenario) => (
      scenario?.status === "accepted" && scenario?.run_status === "completed"
    )).length,
    scenario_total: scenarios.length,
    provider_request_total: scenarios.reduce((total, scenario) => (
      total + numberValue(scenario?.provider_request_count)
    ), 0),
    runner_command_total: scenarios.reduce((total, scenario) => (
      total + numberValue(scenario?.runner_command_count)
    ), 0)
  };
  const completionMissing = await completionMissingFor(notebook, entries, scenarios, bestArtifactDir);
  const seededStabilityMissing = await seededStabilityMissingFor(
    notebook,
    entries,
    scenarios,
    bestArtifactDir,
    seedArtifactPath
  );
  return {
    completion_status: statusFor(entries, completionMissing),
    completion_missing: completionMissing,
    seeded_stability_status: statusFor(entries, seededStabilityMissing),
    seeded_stability_missing: seededStabilityMissing,
    evidence_summary: evidenceSummary
  };
}

async function completionMissingFor(notebook, entries, scenarios, bestArtifactDir) {
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
  } else if (!await directoryExists(bestArtifactDir)) {
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
  addAcceptedScenarioMissing(missing, entries, scenarios);
  return missing;
}

async function seededStabilityMissingFor(notebook, entries, scenarios, bestArtifactDir, seedArtifactPath) {
  const missing = [];
  if (notebook?.agent?.provider !== "codex") {
    missing.push("agent.provider == codex");
  }
  if (notebook?.mode !== "replay") {
    missing.push("mode == replay");
  }
  if (!stringValue(notebook?.program_path)) {
    missing.push("program_path");
  }
  if (!Number.isFinite(notebook?.best_score) || notebook.best_score < 1) {
    missing.push("best_score >= 1");
  }
  if (!stringValue(notebook?.best_artifact_dir)) {
    missing.push("best_artifact_dir");
  } else if (!bestArtifactDir.includes("kept-artifact")) {
    missing.push("best_artifact_dir includes kept-artifact");
  } else if (!await directoryExists(bestArtifactDir)) {
    missing.push("best_artifact_dir exists");
  }
  if (entries.length < 2) {
    missing.push("entries >= 2");
  }
  if (!entries.some((entry) => entry?.decision === "keep")) {
    missing.push("at least one keep decision");
  }
  if (entries.some((entry) => entry?.agent_status === "failed")) {
    missing.push("no agent_status failed entries");
  }
  if (entries.some((entry) => stringValue(entry?.agent_failure_reason))) {
    missing.push("no agent_failure_reason entries");
  }
  for (const entry of entries) {
    addSeededEntryMissing(missing, entry);
  }
  if (scenarios.length === 0) {
    missing.push("scenario_results");
  }
  if (!seedArtifactPath) {
    missing.push("seed_artifact required for seeded-stability promotion");
  } else {
    await addSeedDigestMissing(missing, seedArtifactPath, entries[0], bestArtifactDir);
  }
  return missing;
}

function addAcceptedScenarioMissing(missing, entries, scenarios) {
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
}

function addSeededEntryMissing(missing, entry) {
  const label = `iteration ${entry?.iteration ?? "<missing>"}`;
  if (!Number.isFinite(entry?.iteration) || entry.iteration < 1) {
    missing.push(`${label} iteration`);
  }
  if (!stringValue(entry?.decision)) {
    missing.push(`${label} decision`);
  }
  if (!Number.isFinite(entry?.score) || entry.score < 1) {
    missing.push(`${label} score >= 1`);
  }
  const agentStatus = stringValue(entry?.agent_status);
  if (!agentStatus) {
    missing.push(`${label} agent_status`);
  } else if (!["edited", "no_change"].includes(agentStatus)) {
    missing.push(`${label} agent_status is edited or no_change`);
  }
  if (!stringValue(entry?.artifact_dir)) {
    missing.push(`${label} artifact_dir`);
  }
  if (!stringValue(entry?.events_path)) {
    missing.push(`${label} events_path`);
  }
  if (entry?.evaluation?.status !== "accepted") {
    missing.push(`${label} evaluation.status == accepted`);
  }
  if (!Number.isFinite(entry?.evaluation?.score) || entry.evaluation.score < 1) {
    missing.push(`${label} evaluation.score >= 1`);
  }
  if (entry?.evaluation?.risk_decision !== "valid_order_intent") {
    missing.push(`${label} evaluation.risk_decision == valid_order_intent`);
  }
  const scenarioResults = asArray(entry?.evaluation?.scenario_results);
  for (const scenarioId of REQUIRED_SCENARIOS) {
    if (!scenarioResults.some((scenario) => scenario?.scenario_id === scenarioId)) {
      missing.push(`${label} scenario ${scenarioId}`);
    }
  }
  for (const scenario of scenarioResults) {
    addSeededScenarioMissing(missing, label, scenario);
  }
}

function addSeededScenarioMissing(missing, entryLabel, scenario) {
  const scenarioId = stringValue(scenario?.scenario_id) || "<missing-scenario>";
  const label = `${entryLabel} scenario ${scenarioId}`;
  if (scenario?.runner_kind !== "docker_sandboxes_sbx") {
    missing.push(`${label} runner_kind == docker_sandboxes_sbx`);
  }
  if (scenario?.run_status !== "completed") {
    missing.push(`${label} run_status == completed`);
  }
  if (scenario?.status !== "accepted") {
    missing.push(`${label} status == accepted`);
  }
  if (!Number.isFinite(scenario?.score) || scenario.score < 1) {
    missing.push(`${label} score >= 1`);
  }
  if (scenario?.risk_decision !== "valid_order_intent") {
    missing.push(`${label} risk_decision == valid_order_intent`);
  }
  if (!stringValue(scenario?.events_path)) {
    missing.push(`${label} events_path`);
  }
  if (numberValue(scenario?.provider_request_count) < 3) {
    missing.push(`${label} provider_request_count >= 3`);
  }
  if (numberValue(scenario?.runner_command_count) < 5) {
    missing.push(`${label} runner_command_count >= 5`);
  }
  const commandEvidence = asArray(scenario?.runner_command_evidence);
  if (commandEvidence.length < 5) {
    missing.push(`${label} runner_command_evidence.length >= 5`);
  }
  requireLifecycleCommand(missing, commandEvidence, "version", label);
  requireLifecycleCommand(missing, commandEvidence, "create", label);
  requireLifecycleCommand(missing, commandEvidence, "exec", label);
  requireLifecycleCommand(missing, commandEvidence, "stop", label);
  requireLifecycleCommand(missing, commandEvidence, "rm", label);
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

function requireLifecycleCommand(missing, commandEvidence, token, label) {
  if (!commandEvidence.some((evidence) => asArray(evidence?.command).map(String).includes(token))) {
    missing.push(`${label} ${token} command evidence`);
  }
}

function commandText(evidence) {
  return asArray(evidence?.command).map(String).join(" ");
}

async function addSeedDigestMissing(missing, seedArtifactPath, firstEntry, bestArtifactDir) {
  if (!await directoryExists(seedArtifactPath)) {
    missing.push("seed_artifact exists");
    return;
  }
  const editablePaths = await editablePathsFromManifest(seedArtifactPath);
  const firstCandidate = stringValue(firstEntry?.artifact_dir);
  if (!firstCandidate || !await directoryExists(firstCandidate)) {
    missing.push("first candidate artifact_dir exists for seed comparison");
    return;
  }
  if (!await artifactDigestsMatch(seedArtifactPath, firstCandidate, editablePaths)) {
    missing.push("seed artifact matches first candidate editable files");
  }
  if (!await artifactDigestsMatch(seedArtifactPath, bestArtifactDir, editablePaths)) {
    missing.push("seed artifact matches best artifact editable files");
  }
}

async function editablePathsFromManifest(artifactDir) {
  const manifest = await readArtifactManifest(artifactDir);
  const editablePaths = asArray(manifest?.editable_paths).map(String).filter(Boolean);
  return editablePaths.length ? editablePaths : ["run.py"];
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

async function readArtifactManifest(artifactDir) {
  try {
    return JSON.parse(await readFile(path.join(artifactDir, "manifest.json"), "utf8"));
  } catch (error) {
    console.error(`ERROR failed to read artifact manifest: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function artifactDigest(artifactDir) {
  const hash = createHash("sha256");
  for (const file of await listFiles(artifactDir)) {
    const relativePath = path.relative(artifactDir, file).split(path.sep).join("/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const pathname = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(pathname));
    } else if (entry.isFile()) {
      files.push(pathname);
    }
  }
  return files.sort();
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

async function writeJson(pathname, value) {
  await mkdir(path.dirname(pathname), { recursive: true });
  await writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function rebuildCandidateIndex(root) {
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const candidate = JSON.parse(await readFile(path.join(root, entry.name, "candidate.json"), "utf8"));
      const promotion = JSON.parse(await readFile(path.join(root, entry.name, "promotion.json"), "utf8"));
      candidates.push({
        candidate_id: candidate.candidate_id,
        candidate_dir: path.join(root, entry.name),
        gate: promotion.gate,
        source_session_id: promotion.source?.session_id,
        completion_status: promotion.gate_status?.completion_status,
        seeded_stability_status: promotion.gate_status?.seeded_stability_status,
        artifact_digest: promotion.artifact_digest,
        promoted_at: promotion.promoted_at,
        authority_status: candidate.authority_status ?? promotion.authority_status
      });
    } catch {
      // Ignore partially written local output directories.
    }
  }
  candidates.sort((left, right) => Date.parse(right.promoted_at ?? "") - Date.parse(left.promoted_at ?? ""));
  await writeJson(path.join(root, "index.json"), {
    record_kind: "trader_system_candidate_index",
    version: 1,
    root,
    candidates
  });
}

function printFailure(gate, status, missing) {
  console.log("Trading AAR candidate promotion");
  console.log(`gate=${gate}`);
  console.log(`gate_status=${status}`);
  for (const item of missing) {
    console.log(`MISSING ${item}`);
  }
  console.log("PROMOTION_RESULT failed");
}

function statusFor(entries, missing) {
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
  return "incomplete";
}

function stableSuffix(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function validateSessionId(sessionId) {
  if (!sessionId || sessionId.includes("/") || sessionId.includes("\\") || sessionId.includes("..")) {
    failUsage("--session-id must be a simple path-safe id");
  }
}

function validateCandidateId(candidateId) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(candidateId) || candidateId.includes("..")) {
    failUsage("--candidate-id must be path-safe");
  }
}

function ref(record_kind, id) {
  return { record_kind, id };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  return Number.isFinite(value) ? value : 0;
}

function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
