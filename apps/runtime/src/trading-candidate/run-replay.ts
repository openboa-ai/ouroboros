import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  DockerSandboxesSbxTradingArtifactRunner,
  HostTradingArtifactRunner,
  readTradingSystemManifest,
  type TradingArtifactRunner
} from "../trading-research/artifact-runner";
import { defaultReplayTradingScenarioSet } from "../trading-research/replay-trading-api-provider";
import { runTradingReplaySet } from "../trading-research/replay-set-runner";
import type { ReplayTradingScenario, TradingArtifactRunnerKind } from "../trading-research/types";

export const DEFAULT_CANDIDATE_ROOT = path.join(".ouroboros", "trading-system-candidates");
export const DEFAULT_RUN_ROOT = path.join(".ouroboros", "trading-system-replay-runs");

const knownArgs = new Set([
  "candidate-id",
  "candidate-root",
  "help",
  "json",
  "run-id",
  "run-root",
  "runner",
  "sbx-home",
  "sbx-path",
  "scenario",
  "timeout-ms",
  "workspace"
]);

interface CliOptions {
  candidateId: string;
  candidateRoot: string;
  runRoot: string;
  runId?: string;
  runnerKind: TradingArtifactRunnerKind;
  scenarioIds: string[];
  timeoutMs?: number;
  sbxPath?: string;
  sbxHome?: string;
  workspacePath?: string;
  json: boolean;
}

interface CandidateBundle {
  candidateDir: string;
  candidate: Record<string, unknown>;
  runnableArtifact: Record<string, unknown>;
  promotion?: Record<string, unknown>;
  artifactDir: string;
  artifactDigest: string;
}

export interface RunPromotedCandidateReplayInput {
  candidate_id: string;
  candidate_root?: string;
  run_root?: string;
  run_id?: string;
  runner_kind?: TradingArtifactRunnerKind;
  scenario_ids?: string[];
  timeout_ms?: number;
  sbx_path?: string;
  sbx_home?: string;
  workspace_path?: string;
}

export interface ReplayRunRecord {
  record_kind: "trading_system_replay_run";
  version: 1;
  run_id: string;
  candidate_id: string;
  candidate_ref: { record_kind: "trading_system_candidate"; id: string };
  runnable_artifact_ref?: { record_kind: string; id: string };
  source_candidate_dir: string;
  promoted_artifact_dir: string;
  artifact_digest: string;
  runner_kind: TradingArtifactRunnerKind;
  scenario_ids: string[];
  status: "accepted" | "rejected";
  run_status: "completed" | "failed";
  score: number;
  risk_decision: string;
  scenario_accepted: number;
  scenario_total: number;
  provider_request_total: number;
  runner_command_total: number;
  output_dir: string;
  events_path: string;
  scenario_results: unknown[];
  started_at: string;
  completed_at: string;
  authority_status: "not_live";
  no_authority: {
    live_exchange: false;
    order_authority: false;
    credentials: false;
    paper_trading: false;
  };
  provenance: {
    promotion_id?: string;
    source_session_id?: string;
  };
}

export class ReplayRunError extends Error {
  constructor(
    readonly reason: string,
    message: string,
    readonly exitCode: 1 | 2 = 2
  ) {
    super(message);
    this.name = "ReplayRunError";
  }
}

export async function runReplayFromCli(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const options = parseArgs(argv);
  try {
    const record = await runPromotedCandidateReplay({
      candidate_id: options.candidateId,
      candidate_root: options.candidateRoot,
      run_root: options.runRoot,
      run_id: options.runId,
      runner_kind: options.runnerKind,
      scenario_ids: options.scenarioIds,
      timeout_ms: options.timeoutMs,
      sbx_path: options.sbxPath,
      sbx_home: options.sbxHome,
      workspace_path: options.workspacePath
    });

    if (options.json) {
      console.log(JSON.stringify(record, null, 2));
    } else {
      printRunResult(record);
    }

    if (record.status !== "accepted") {
      process.exitCode = 2;
    }
  } catch (error) {
    if (error instanceof ReplayRunError) {
      if (options.json) {
        console.log(JSON.stringify({
          status: "failed",
          candidate_id: options.candidateId,
          reason: error.reason,
          message: error.message
        }, null, 2));
      } else {
        printCandidateFailure(options.candidateId, error.message);
      }
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
}

export async function runPromotedCandidateReplay(
  input: RunPromotedCandidateReplayInput
): Promise<ReplayRunRecord> {
  assertPathSafeId(input.candidate_id, "candidate_id");
  if (input.run_id) {
    assertPathSafeId(input.run_id, "run_id");
  }

  const options = {
    candidateId: input.candidate_id,
    candidateRoot: path.resolve(input.candidate_root ?? DEFAULT_CANDIDATE_ROOT),
    runRoot: path.resolve(input.run_root ?? DEFAULT_RUN_ROOT),
    runId: input.run_id,
    runnerKind: input.runner_kind ?? "host_process",
    scenarioIds: input.scenario_ids ?? [],
    timeoutMs: input.timeout_ms,
    sbxPath: input.sbx_path,
    sbxHome: input.sbx_home,
    workspacePath: input.workspace_path
  };
  const bundle = await loadCandidateBundle(options.candidateRoot, options.candidateId);
  const manifest = await readTradingSystemManifest(bundle.artifactDir);
  const scenarios = selectedScenarios(options.scenarioIds);
  const runId = options.runId ?? defaultRunId(options.candidateId, new Date());
  const runDir = path.join(options.runRoot, runId);
  const outputDir = path.join(runDir, "output");
  const startedAt = new Date().toISOString();

  const runner = artifactRunnerFor(options);
  const replay = await runTradingReplaySet({
    artifact_dir: bundle.artifactDir,
    manifest,
    output_dir: outputDir,
    scenarios,
    artifact_runner: runner
  });
  const completedAt = new Date().toISOString();
  const scenarioAccepted = replay.scenario_results.filter((scenario) => scenario.status === "accepted").length;
  const scenarioTotal = replay.scenario_results.length;
  const providerRequestTotal = replay.scenario_results.reduce(
    (total, scenario) => total + scenario.provider_request_count,
    0
  );
  const runnerCommandTotal = replay.scenario_results.reduce(
    (total, scenario) => total + scenario.runner_command_count,
    0
  );
  const completed = replay.scenario_results.every((scenario) => scenario.run_status === "completed");
  const accepted = completed && replay.evaluation.status === "accepted";

  const record: ReplayRunRecord = {
    record_kind: "trading_system_replay_run",
    version: 1,
    run_id: runId,
    candidate_id: options.candidateId,
    candidate_ref: { record_kind: "trading_system_candidate", id: options.candidateId },
    runnable_artifact_ref: refValue(bundle.runnableArtifact.runnable_artifact_id, "runnable_artifact"),
    source_candidate_dir: bundle.candidateDir,
    promoted_artifact_dir: bundle.artifactDir,
    artifact_digest: bundle.artifactDigest,
    runner_kind: runner.kind,
    scenario_ids: scenarios.map((scenario) => scenario.id),
    status: accepted ? "accepted" : "rejected",
    run_status: completed ? "completed" : "failed",
    score: replay.evaluation.score,
    risk_decision: replay.evaluation.risk_decision,
    scenario_accepted: scenarioAccepted,
    scenario_total: scenarioTotal,
    provider_request_total: providerRequestTotal,
    runner_command_total: runnerCommandTotal,
    output_dir: outputDir,
    events_path: replay.events_path,
    scenario_results: replay.scenario_results,
    started_at: startedAt,
    completed_at: completedAt,
    authority_status: "not_live",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    provenance: {
      promotion_id: stringValue(bundle.promotion?.promotion_id),
      source_session_id: sourceSessionId(bundle.promotion)
    }
  };

  await mkdir(runDir, { recursive: true });
  await writeJson(path.join(runDir, "run.json"), record);
  await rebuildRunIndex(options.runRoot);

  return record;
}

function printHelp(): void {
  console.log(`Usage: npm run trading:replay:run -- --candidate-id <id>
       npm run trading:replay:run -- --candidate-id <id> --runner docker_sandboxes_sbx

Runs a promoted TradingSystemCandidate by candidate id through replay scenarios.

Options:
  --candidate-id <id>      Required promoted candidate id.
  --candidate-root <path>  Default: ${DEFAULT_CANDIDATE_ROOT}
  --run-root <path>        Default: ${DEFAULT_RUN_ROOT}
  --run-id <id>            Optional stable run id override.
  --runner <kind>          host_process or docker_sandboxes_sbx. Default: host_process.
  --scenario <id[,id]>     Optional scenario filter. Can be repeated.
  --timeout-ms <number>    Per sbx command timeout for docker_sandboxes_sbx.
  --sbx-path <path>        sbx/sdx command path for docker_sandboxes_sbx.
  --sbx-home <path>        Optional HOME for isolated sbx/sdx state.
  --workspace <path>       Optional sbx workspace path. Default: repo cwd.
  --json                   Print machine-readable run record.

Exit codes:
  0  replay run accepted
  1  usage, file, or JSON error
  2  candidate missing, candidate artifact invalid, or replay rejected
`);
}

function parseArgs(rawArgs: string[]): CliOptions {
  const parsed: Record<string, string | string[]> = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!knownArgs.has(key)) {
      failUsage(`unknown option: --${key}`);
    }
    if (key === "json") {
      parsed[key] = "true";
      continue;
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      failUsage(`missing value for --${key}`);
    }
    if (key === "scenario") {
      parsed[key] = [...asStringArray(parsed[key]), next];
    } else {
      parsed[key] = next;
    }
    index += 1;
  }

  const candidateId = stringValue(parsed["candidate-id"]);
  if (!candidateId) {
    failUsage("missing --candidate-id");
  }
  validatePathSafeId(candidateId, "--candidate-id");

  return {
    candidateId,
    candidateRoot: path.resolve(stringValue(parsed["candidate-root"]) ?? DEFAULT_CANDIDATE_ROOT),
    runRoot: path.resolve(stringValue(parsed["run-root"]) ?? DEFAULT_RUN_ROOT),
    runId: stringValue(parsed["run-id"]),
    runnerKind: parseRunnerKind(stringValue(parsed.runner)),
    scenarioIds: parseScenarioIds(asStringArray(parsed.scenario)),
    timeoutMs: optionalPositiveInteger(stringValue(parsed["timeout-ms"]), "--timeout-ms"),
    sbxPath: stringValue(parsed["sbx-path"]),
    sbxHome: stringValue(parsed["sbx-home"]),
    workspacePath: stringValue(parsed.workspace),
    json: parsed.json === "true"
  };
}

async function loadCandidateBundle(candidateRoot: string, candidateId: string): Promise<CandidateBundle> {
  const candidateDir = path.join(candidateRoot, candidateId);
  if (!await directoryExists(candidateDir)) {
    throw new ReplayRunError(
      "candidate_not_found",
      "candidate bundle exists"
    );
  }
  const artifactDir = path.join(candidateDir, "artifact");
  if (!await directoryExists(artifactDir)) {
    throw new ReplayRunError(
      "candidate_artifact_missing",
      "candidate artifact snapshot exists"
    );
  }

  try {
    const candidate = await readJson(path.join(candidateDir, "candidate.json"));
    const runnableArtifact = await readJson(path.join(candidateDir, "runnable-artifact.json"));
    const promotion = await readOptionalJson(path.join(candidateDir, "promotion.json"));
    const artifactDigest = await artifactDigestFor(artifactDir);
    const declaredDigest = stringValue(runnableArtifact.artifact_digest);
    if (declaredDigest && declaredDigest !== artifactDigest) {
      throw new ReplayRunError(
        "artifact_digest_mismatch",
        `artifact digest matches runnable artifact (${declaredDigest})`
      );
    }
    if (candidate.authority_status !== "not_live" || runnableArtifact.authority_status !== "not_live") {
      throw new ReplayRunError(
        "candidate_authority_not_live_required",
        "candidate and runnable artifact authority_status == not_live"
      );
    }
    return {
      candidateDir,
      candidate,
      runnableArtifact,
      promotion,
      artifactDir,
      artifactDigest
    };
  } catch (error) {
    if (error instanceof ReplayRunError) {
      throw error;
    }
    throw new ReplayRunError(
      "candidate_bundle_read_failed",
      `failed to read candidate bundle: ${error instanceof Error ? error.message : String(error)}`,
      1
    );
  }
}

function selectedScenarios(requestedIds: string[]): ReplayTradingScenario[] {
  if (requestedIds.length === 0) {
    return defaultReplayTradingScenarioSet;
  }
  const scenarios = [];
  for (const scenarioId of requestedIds) {
    const scenario = defaultReplayTradingScenarioSet.find((item) => item.id === scenarioId);
    if (!scenario) {
      throw new ReplayRunError(
        "unknown_replay_scenario",
        `unknown replay scenario: ${scenarioId}`,
        1
      );
    }
    scenarios.push(scenario);
  }
  return scenarios;
}

function artifactRunnerFor(
  options: Pick<CliOptions, "runnerKind" | "sbxPath" | "sbxHome" | "workspacePath" | "timeoutMs">
): TradingArtifactRunner {
  if (options.runnerKind === "docker_sandboxes_sbx") {
    return new DockerSandboxesSbxTradingArtifactRunner({
      sbxPath: options.sbxPath,
      sbxHome: options.sbxHome,
      workspacePath: options.workspacePath,
      commandTimeoutMs: options.timeoutMs,
      sandboxNamePrefix: "ouro-s18-candidate"
    });
  }
  return new HostTradingArtifactRunner();
}

async function rebuildRunIndex(runRoot: string): Promise<void> {
  await mkdir(runRoot, { recursive: true });
  const entries = await readdir(runRoot, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      const run = await readJson(path.join(runRoot, entry.name, "run.json"));
      runs.push({
        run_id: run.run_id,
        candidate_id: run.candidate_id,
        runner_kind: run.runner_kind,
        status: run.status,
        run_status: run.run_status,
        scenario_accepted: run.scenario_accepted,
        scenario_total: run.scenario_total,
        artifact_digest: run.artifact_digest,
        completed_at: run.completed_at,
        authority_status: run.authority_status
      });
    } catch {
      // Ignore partially written local output directories.
    }
  }
  runs.sort((left, right) => Date.parse(String(right.completed_at ?? "")) - Date.parse(String(left.completed_at ?? "")));
  await writeJson(path.join(runRoot, "index.json"), {
    record_kind: "trading_system_replay_run_index",
    version: 1,
    root: runRoot,
    runs
  });
}

function printRunResult(record: ReplayRunRecord): void {
  console.log("Trading replay run");
  console.log(`run_id=${record.run_id}`);
  console.log(`candidate_id=${record.candidate_id}`);
  console.log(`runner_kind=${record.runner_kind}`);
  console.log(`status=${record.status}`);
  console.log(`run_status=${record.run_status}`);
  console.log(`scenarios=${record.scenario_accepted}/${record.scenario_total} accepted`);
  console.log(`provider_requests=${record.provider_request_total}`);
  console.log(`runner_commands=${record.runner_command_total}`);
  console.log(`artifact_digest=${record.artifact_digest}`);
  console.log(`run_dir=${path.dirname(path.dirname(record.events_path))}`);
  console.log("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");
  console.log(`CANDIDATE_RUN_RESULT ${record.status}`);
}

function printCandidateFailure(candidateId: string, missing: string): void {
  console.log("Trading replay run");
  console.log(`candidate_id=${candidateId}`);
  console.log(`MISSING ${missing}`);
  console.log("CANDIDATE_RUN_RESULT failed");
}

async function readJson(pathname: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(pathname, "utf8")) as Record<string, unknown>;
}

async function readOptionalJson(pathname: string): Promise<Record<string, unknown> | undefined> {
  try {
    return await readJson(pathname);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeJson(pathname: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(pathname), { recursive: true });
  await writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function directoryExists(pathname: string): Promise<boolean> {
  try {
    return (await stat(pathname)).isDirectory();
  } catch {
    return false;
  }
}

async function artifactDigestFor(artifactDir: string): Promise<string> {
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

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
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

function refValue(value: unknown, recordKind: string): { record_kind: string; id: string } | undefined {
  const id = stringValue(value);
  return id ? { record_kind: recordKind, id } : undefined;
}

function sourceSessionId(promotion: Record<string, unknown> | undefined): string | undefined {
  const source = promotion?.source;
  if (!source || typeof source !== "object") {
    return undefined;
  }
  return stringValue((source as Record<string, unknown>).session_id);
}

function parseRunnerKind(value: string | undefined): TradingArtifactRunnerKind {
  if (!value || value === "host" || value === "host_process") {
    return "host_process";
  }
  if (value === "sbx" || value === "sdx" || value === "docker_sandboxes_sbx") {
    return "docker_sandboxes_sbx";
  }
  failUsage("--runner must be host_process or docker_sandboxes_sbx");
}

function parseScenarioIds(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function optionalPositiveInteger(value: string | undefined, label: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    failUsage(`${label} must be a positive integer`);
  }
  return parsed;
}

function defaultRunId(candidateId: string, date: Date): string {
  return `replay-run-${safeId(candidateId)}-${timestampId(date)}`;
}

function timestampId(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, "").replace("T", "t").replace("Z", "z");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "empty";
}

function validatePathSafeId(value: string, label: string): void {
  if (!/^[a-zA-Z0-9._:-]+$/.test(value) || value.includes("..")) {
    failUsage(`${label} must be path-safe`);
  }
}

function assertPathSafeId(value: string, label: string): void {
  if (!/^[a-zA-Z0-9._:-]+$/.test(value) || value.includes("..")) {
    throw new ReplayRunError(
      "invalid_path_safe_id",
      `${label} must be path-safe`,
      1
    );
  }
}

function asStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" ? [value] : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function failUsage(message: string): never {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

const currentModulePath = path.resolve(fileURLToPath(import.meta.url));
const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (executedPath === currentModulePath) {
  runReplayFromCli().catch((error: unknown) => {
    console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
