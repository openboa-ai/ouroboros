import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  CandidateLatestValidationStateReadModel,
  ReplayRunCommandEvidenceReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunComparisonRunReadModel,
  ReplayRunComparisonVerdict,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunMetricReadModel,
  ReplayRunValidationStateReadModel,
  ReplayRunValidationStateStatus,
  ReplayRunScenarioReadModel
} from "@ouroboros/domain";

export const DEFAULT_REPLAY_RUN_ROOT = path.join(".ouroboros", "trading-system-replay-runs");

export interface ListReplayRunEvidenceInput {
  root?: string;
  candidate_id?: string;
  limit?: number;
}

export interface GetReplayRunDetailInput {
  root?: string;
  candidate_id: string;
  run_id: string;
}

export interface GetReplayRunComparisonInput {
  root?: string;
  candidate_id: string;
  run_id: string;
  baseline_run_id: string;
}

export interface GetReplayRunValidationStateInput {
  root?: string;
  candidate_id: string;
  run_id: string;
  baseline_run_id?: string;
}

export interface GetCandidateLatestValidationStateInput {
  root?: string;
  candidate_id: string;
}

interface RawReplayRunRecord {
  run_id?: unknown;
  candidate_id?: unknown;
  runner_kind?: unknown;
  status?: unknown;
  run_status?: unknown;
  scenario_accepted?: unknown;
  scenario_total?: unknown;
  provider_request_total?: unknown;
  runner_command_total?: unknown;
  artifact_digest?: unknown;
  score?: unknown;
  risk_decision?: unknown;
  scenario_ids?: unknown;
  output_dir?: unknown;
  events_path?: unknown;
  scenario_results?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  authority_status?: unknown;
  no_authority?: unknown;
  provenance?: unknown;
}

export async function listReplayRunEvidence(
  input: ListReplayRunEvidenceInput = {}
): Promise<ReplayRunEvidenceReadModel[]> {
  const root = safeAbsoluteRoot(input.root ?? DEFAULT_REPLAY_RUN_ROOT);
  const limit = input.limit ?? 10;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const runs: ReplayRunEvidenceReadModel[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = resolvePathInsideRoot(root, [entry.name], "run_dir");
    const run = await readRunIfPresent(resolvePathInsideRoot(runDir, ["run.json"], "run_record"), runDir);
    if (!run || (input.candidate_id && run.candidate_id !== input.candidate_id)) {
      continue;
    }
    runs.push(run);
  }

  return runs
    .sort((left, right) => Date.parse(right.completed_at) - Date.parse(left.completed_at))
    .slice(0, limit);
}

export async function getReplayRunDetail(
  input: GetReplayRunDetailInput
): Promise<ReplayRunDetailReadModel | undefined> {
  if (!isPathSafeId(input.run_id)) {
    return undefined;
  }
  const root = safeAbsoluteRoot(input.root ?? DEFAULT_REPLAY_RUN_ROOT);
  const runDir = resolvePathInsideRoot(root, [input.run_id], "run_id");
  const run = await readRunDetailIfPresent(resolvePathInsideRoot(runDir, ["run.json"], "run_record"), runDir);
  if (!run || run.candidate_id !== input.candidate_id) {
    return undefined;
  }
  return run;
}

export async function getReplayRunComparison(
  input: GetReplayRunComparisonInput
): Promise<ReplayRunComparisonReadModel | undefined> {
  const [selected, baseline] = await Promise.all([
    getReplayRunDetail({
      root: input.root,
      candidate_id: input.candidate_id,
      run_id: input.run_id
    }),
    getReplayRunDetail({
      root: input.root,
      candidate_id: input.candidate_id,
      run_id: input.baseline_run_id
    })
  ]);
  if (!selected || !baseline) {
    return undefined;
  }

  const deltas = {
    score: roundDelta(selected.score - baseline.score),
    scenario_accepted: selected.scenario_accepted - baseline.scenario_accepted,
    scenario_total: selected.scenario_total - baseline.scenario_total,
    provider_request_total: selected.provider_request_total - baseline.provider_request_total,
    runner_command_total: selected.runner_command_total - baseline.runner_command_total
  };
  const verdict = replayRunComparisonVerdict(selected, baseline, deltas);

  return {
    candidate_id: input.candidate_id,
    selected: replayRunComparisonRun(selected),
    baseline: replayRunComparisonRun(baseline),
    baseline_selection: "explicit_baseline_run_id",
    deltas,
    risk_transition: `${baseline.risk_decision} -> ${selected.risk_decision}`,
    verdict,
    verdict_reason: replayRunComparisonReason(verdict, deltas),
    authority_status: "not_live",
    validation_label: "comparison_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  };
}

export async function getReplayRunValidationState(
  input: GetReplayRunValidationStateInput
): Promise<ReplayRunValidationStateReadModel | undefined> {
  const selected = await getReplayRunDetail({
    root: input.root,
    candidate_id: input.candidate_id,
    run_id: input.run_id
  });
  if (!selected) {
    return undefined;
  }

  const comparison = input.baseline_run_id
    ? await getReplayRunComparison({
        root: input.root,
        candidate_id: input.candidate_id,
        run_id: input.run_id,
        baseline_run_id: input.baseline_run_id
      })
    : undefined;
  const validationState = replayRunValidationStateStatus(selected, comparison);

  return {
    candidate_id: input.candidate_id,
    selected_run_id: selected.run_id,
    baseline_run_id: comparison?.baseline.run_id ?? input.baseline_run_id,
    comparison_verdict: comparison?.verdict,
    validation_state: validationState,
    reasons: replayRunValidationStateReasons(validationState, selected, comparison),
    required_next_evidence: replayRunValidationStateNextEvidence(validationState),
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  };
}

export async function getCandidateLatestValidationState(
  input: GetCandidateLatestValidationStateInput
): Promise<CandidateLatestValidationStateReadModel> {
  const runs = await listReplayRunEvidence({
    root: input.root,
    candidate_id: input.candidate_id,
    limit: 10
  });
  const selectedRun = runs[0];
  if (!selectedRun) {
    return noReplayRunValidationState(input.candidate_id);
  }

  const baselineRun = runs.find((run) => run.run_id !== selectedRun.run_id);
  const validationState = await getReplayRunValidationState({
    root: input.root,
    candidate_id: input.candidate_id,
    run_id: selectedRun.run_id,
    baseline_run_id: baselineRun?.run_id
  });
  if (validationState) {
    return validationState;
  }

  return incompleteLatestValidationState(input.candidate_id, selectedRun.run_id, baselineRun?.run_id);
}

async function readRunIfPresent(
  pathname: string,
  runDir: string
): Promise<ReplayRunEvidenceReadModel | undefined> {
  try {
    const raw = JSON.parse(await readFile(pathname, "utf8")) as RawReplayRunRecord;
    const runId = stringValue(raw.run_id);
    const candidateId = stringValue(raw.candidate_id);
    const runnerKind = stringValue(raw.runner_kind);
    const status = stringValue(raw.status);
    const runStatus = stringValue(raw.run_status);
    const artifactDigest = stringValue(raw.artifact_digest);
    const completedAt = stringValue(raw.completed_at);
    if (!runId || !candidateId || !runnerKind || !status || !runStatus || !artifactDigest || !completedAt) {
      return undefined;
    }
    return {
      run_id: runId,
      run_dir: runDir,
      candidate_id: candidateId,
      runner_kind: runnerKind,
      status,
      run_status: runStatus,
      scenario_accepted: numberValue(raw.scenario_accepted),
      scenario_total: numberValue(raw.scenario_total),
      provider_request_total: numberValue(raw.provider_request_total),
      runner_command_total: numberValue(raw.runner_command_total),
      artifact_digest: artifactDigest,
      completed_at: completedAt,
      authority_status: stringValue(raw.authority_status) ?? "not_live"
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function readRunDetailIfPresent(
  pathname: string,
  runDir: string
): Promise<ReplayRunDetailReadModel | undefined> {
  try {
    const raw = JSON.parse(await readFile(pathname, "utf8")) as RawReplayRunRecord;
    const summary = toReplayRunEvidence(raw, runDir);
    const outputDir = stringValue(raw.output_dir);
    const eventsPath = stringValue(raw.events_path);
    const startedAt = stringValue(raw.started_at);
    if (!summary || !outputDir || !eventsPath || !startedAt) {
      return undefined;
    }
    return {
      ...summary,
      score: numberValue(raw.score),
      risk_decision: stringValue(raw.risk_decision) ?? "unknown",
      scenario_ids: stringArrayValue(raw.scenario_ids),
      output_dir: outputDir,
      events_path: eventsPath,
      started_at: startedAt,
      no_authority: noAuthorityValue(raw.no_authority),
      provenance: provenanceValue(raw.provenance),
      scenarios: scenarioResultsValue(raw.scenario_results)
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function toReplayRunEvidence(
  raw: RawReplayRunRecord,
  runDir: string
): ReplayRunEvidenceReadModel | undefined {
  const runId = stringValue(raw.run_id);
  const candidateId = stringValue(raw.candidate_id);
  const runnerKind = stringValue(raw.runner_kind);
  const status = stringValue(raw.status);
  const runStatus = stringValue(raw.run_status);
  const artifactDigest = stringValue(raw.artifact_digest);
  const completedAt = stringValue(raw.completed_at);
  if (!runId || !candidateId || !runnerKind || !status || !runStatus || !artifactDigest || !completedAt) {
    return undefined;
  }
  return {
    run_id: runId,
    run_dir: runDir,
    candidate_id: candidateId,
    runner_kind: runnerKind,
    status,
    run_status: runStatus,
    scenario_accepted: numberValue(raw.scenario_accepted),
    scenario_total: numberValue(raw.scenario_total),
    provider_request_total: numberValue(raw.provider_request_total),
    runner_command_total: numberValue(raw.runner_command_total),
    artifact_digest: artifactDigest,
    completed_at: completedAt,
    authority_status: stringValue(raw.authority_status) ?? "not_live"
  };
}

function scenarioResultsValue(value: unknown): ReplayRunScenarioReadModel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const raw = item as Record<string, unknown>;
    const scenarioId = stringValue(raw.scenario_id);
    const runnerKind = stringValue(raw.runner_kind);
    const status = stringValue(raw.status);
    const runStatus = stringValue(raw.run_status);
    const riskDecision = stringValue(raw.risk_decision);
    const summary = stringValue(raw.summary);
    const eventsPath = stringValue(raw.events_path);
    if (!scenarioId || !runnerKind || !status || !runStatus || !riskDecision || !summary || !eventsPath) {
      return [];
    }
    return [{
      scenario_id: scenarioId,
      runner_kind: runnerKind,
      sandbox_name: stringValue(raw.sandbox_name),
      status,
      run_status: runStatus,
      score: numberValue(raw.score),
      risk_decision: riskDecision,
      summary,
      events_path: eventsPath,
      provider_request_count: numberValue(raw.provider_request_count),
      runner_command_count: numberValue(raw.runner_command_count),
      metrics: metricValues(raw.metrics),
      runner_command_evidence: commandEvidenceValues(raw.runner_command_evidence)
    }];
  });
}

function metricValues(value: unknown): ReplayRunMetricReadModel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const raw = item as Record<string, unknown>;
    const name = stringValue(raw.name);
    const detail = stringValue(raw.detail);
    if (!name || !detail) {
      return [];
    }
    return [{
      name,
      score: numberValue(raw.score),
      detail
    }];
  });
}

function commandEvidenceValues(value: unknown): ReplayRunCommandEvidenceReadModel[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const raw = item as Record<string, unknown>;
    const command = stringArrayValue(raw.command);
    const stdoutPreview = stringValue(raw.stdout_preview);
    const stderrPreview = stringValue(raw.stderr_preview);
    const startedAt = stringValue(raw.started_at);
    const completedAt = stringValue(raw.completed_at);
    if (
      command.length === 0 ||
      stdoutPreview === undefined ||
      stderrPreview === undefined ||
      !startedAt ||
      !completedAt
    ) {
      return [];
    }
    return [{
      command,
      exit_code: nullableNumberValue(raw.exit_code),
      signal: stringValue(raw.signal),
      timed_out: booleanValue(raw.timed_out),
      error_message: stringValue(raw.error_message),
      stdout_preview: stdoutPreview,
      stderr_preview: stderrPreview,
      started_at: startedAt,
      completed_at: completedAt
    }];
  });
}

function replayRunComparisonRun(run: ReplayRunDetailReadModel): ReplayRunComparisonRunReadModel {
  return {
    run_id: run.run_id,
    status: run.status,
    run_status: run.run_status,
    score: run.score,
    risk_decision: run.risk_decision,
    scenario_accepted: run.scenario_accepted,
    scenario_total: run.scenario_total,
    provider_request_total: run.provider_request_total,
    runner_command_total: run.runner_command_total,
    completed_at: run.completed_at,
    authority_status: run.authority_status
  };
}

function replayRunComparisonVerdict(
  selected: ReplayRunDetailReadModel,
  baseline: ReplayRunDetailReadModel,
  deltas: ReplayRunComparisonReadModel["deltas"]
): ReplayRunComparisonVerdict {
  if (selected.scenario_total === 0 || baseline.scenario_total === 0) {
    return "incomparable";
  }
  if (selected.status !== "accepted" || selected.run_status !== "completed") {
    return "regressed";
  }
  if (baseline.status !== "accepted" || baseline.run_status !== "completed") {
    return "improved";
  }
  if (deltas.score < 0 || deltas.scenario_accepted < 0) {
    return "regressed";
  }
  if (deltas.score > 0 || deltas.scenario_accepted > 0) {
    return "improved";
  }
  return "unchanged";
}

function replayRunComparisonReason(
  verdict: ReplayRunComparisonVerdict,
  deltas: ReplayRunComparisonReadModel["deltas"]
): string {
  switch (verdict) {
    case "improved":
      return `selected run improved score by ${deltas.score} and accepted scenarios by ${deltas.scenario_accepted}`;
    case "regressed":
      return `selected run regressed score by ${deltas.score} or accepted scenarios by ${deltas.scenario_accepted}`;
    case "unchanged":
      return "selected run matched baseline score and accepted scenario count";
    case "incomparable":
      return "selected and baseline runs do not share enough scenario coverage";
  }
}

function replayRunValidationStateStatus(
  selected: ReplayRunDetailReadModel,
  comparison?: ReplayRunComparisonReadModel
): ReplayRunValidationStateStatus {
  if (!comparison) {
    return "comparison_required";
  }
  if (
    selected.status !== "accepted" ||
    selected.run_status !== "completed" ||
    comparison.verdict === "regressed" ||
    comparison.verdict === "incomparable"
  ) {
    return "validation_blocked";
  }
  if (
    comparison.verdict === "unchanged" ||
    selected.scenario_accepted < selected.scenario_total ||
    selected.score < 0.8
  ) {
    return "human_review_required";
  }
  return "passes_replay_checks";
}

function replayRunValidationStateReasons(
  validationState: ReplayRunValidationStateStatus,
  selected: ReplayRunDetailReadModel,
  comparison?: ReplayRunComparisonReadModel
): string[] {
  switch (validationState) {
    case "passes_replay_checks":
      return [
        "selected run improved against baseline",
        "all selected scenarios were accepted",
        "selected score meets the evidence threshold"
      ];
    case "human_review_required":
      return [
        comparison?.verdict === "unchanged"
          ? "selected run did not improve against baseline"
          : "selected run passed comparison but needs human review",
        selected.scenario_accepted < selected.scenario_total
          ? "not all selected scenarios were accepted"
          : "selected scenario coverage is accepted",
        selected.score < 0.8
          ? "selected score is below evidence threshold"
          : "selected score meets evidence threshold"
      ];
    case "validation_blocked":
      return [
        selected.status !== "accepted" || selected.run_status !== "completed"
          ? "selected run is not accepted and completed"
          : `comparison verdict is ${comparison?.verdict ?? "missing"}`,
        "validation state cannot advance without non-regressed replay evidence"
      ];
    case "comparison_required":
      return [
        "no baseline run was available for evidence comparison",
        "validation state cannot advance from a single run"
      ];
  }
}

function replayRunValidationStateNextEvidence(validationState: ReplayRunValidationStateStatus): string[] {
  switch (validationState) {
    case "passes_replay_checks":
      return [
        "human review of replay evidence",
        "future promotion issue with explicit authority scope"
      ];
    case "human_review_required":
      return [
        "additional replay run or manual review",
        "confirm comparison deltas before promotion consideration"
      ];
    case "validation_blocked":
      return [
        "new accepted replay run with non-regressed comparison",
        "inspect failed or regressed scenario evidence"
      ];
    case "comparison_required":
      return [
        "record at least one baseline replay run",
        "compare selected run against baseline before posture review"
      ];
  }
}

function noReplayRunValidationState(candidateId: string): CandidateLatestValidationStateReadModel {
  return {
    candidate_id: candidateId,
    validation_state: "replay_required",
    reasons: [
      "no replay-run evidence has been recorded",
      "validation state cannot be inferred without replay evidence"
    ],
    required_next_evidence: [
      "record at least one candidate replay run",
      "record a second replay run to establish a comparison baseline"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: noAuthorityFalse()
  };
}

function incompleteLatestValidationState(
  candidateId: string,
  selectedRunId: string,
  baselineRunId: string | undefined
): CandidateLatestValidationStateReadModel {
  return {
    candidate_id: candidateId,
    selected_run_id: selectedRunId,
    baseline_run_id: baselineRunId,
    validation_state: "validation_blocked",
    reasons: [
      "latest replay run detail is incomplete",
      "validation state requires full replay detail evidence"
    ],
    required_next_evidence: [
      "rerun candidate replay to record full run detail",
      baselineRunId ? "inspect latest run detail fields before posture review" : "record a baseline replay run"
    ],
    authority_status: "not_live",
    validation_label: "validation_state_not_authority",
    no_authority: noAuthorityFalse()
  };
}

function noAuthorityFalse(): CandidateLatestValidationStateReadModel["no_authority"] {
  return {
    live_exchange: false,
    order_authority: false,
    credentials: false,
    paper_trading: false
  };
}

function roundDelta(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function noAuthorityValue(value: unknown): ReplayRunDetailReadModel["no_authority"] {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    live_exchange: raw.live_exchange === true,
    order_authority: raw.order_authority === true,
    credentials: raw.credentials === true,
    paper_trading: raw.paper_trading === true
  };
}

function provenanceValue(value: unknown): ReplayRunDetailReadModel["provenance"] {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    promotion_id: stringValue(raw.promotion_id),
    source_session_id: stringValue(raw.source_session_id)
  };
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function nullableNumberValue(value: unknown): number | null {
  return Number.isFinite(value) ? value as number : null;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function isPathSafeId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]+$/.test(value) && !value.includes("..");
}

function safeAbsoluteRoot(rootPath: string): string {
  return path.resolve(rootPath);
}

function resolvePathInsideRoot(rootPath: string, segments: string[], label: string): string {
  const safeRoot = safeAbsoluteRoot(rootPath);
  const resolved = path.resolve(safeRoot, ...segments);
  const rootPrefix = safeRoot.endsWith(path.sep) ? safeRoot : `${safeRoot}${path.sep}`;
  if (resolved !== safeRoot && !resolved.startsWith(rootPrefix)) {
    throw new Error(`${label} must stay under its configured root`);
  }
  return resolved;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number {
  return Number.isFinite(value) ? value as number : 0;
}
