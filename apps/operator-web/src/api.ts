import type {
  ImprovementReadModel,
  AgentProfileProviderKind,
  CandidateArenaReadModel,
  LedgerInput,
  LedgerReadModel,
  LedgerWriteOutcome,
  OperatorReadModel,
  OuroborosCommandKind,
  OuroborosCommandRequest,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateSummaryReadModel,
  FullCycleLineageReadModel,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPostureWriteInput,
  RunControlAuditInput,
  RunControlAuditOutcome,
  SandboxDetailReadModel,
  TradingGatewayEnvironmentReadModel,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";

const runtimeBaseUrl = import.meta.env.VITE_OUROBOROS_RUNTIME_URL ?? "http://127.0.0.1:4173";

export async function fetchCandidateSummaries(): Promise<CandidateSummaryReadModel[]> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates`);
  if (!response.ok) {
    throw new Error(`Failed to load candidates: ${response.status}`);
  }
  const body = (await response.json()) as { candidates: CandidateSummaryReadModel[] };
  return body.candidates;
}

export async function fetchCandidate(candidateId: string): Promise<CandidateInspectReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidateId}`);
  if (!response.ok) {
    throw new Error(`Failed to load candidate ${candidateId}: ${response.status}`);
  }
  return (await response.json()) as CandidateInspectReadModel;
}

export async function fetchCandidateMaterializationAttempts(): Promise<CandidateMaterializationAttemptReadModel[]> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidate-materialization-attempts`);
  if (!response.ok) {
    throw new Error(`Failed to load materialization attempts: ${response.status}`);
  }
  const body = (await response.json()) as { attempts: CandidateMaterializationAttemptReadModel[] };
  return body.attempts;
}

export async function fetchTradingExecutionModeContracts(): Promise<TradingSystemExecutionModeContractReadModel[]> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-execution-modes`);
  if (!response.ok) {
    throw new Error(`Failed to load trading execution modes: ${response.status}`);
  }
  const body = (await response.json()) as { modes: TradingSystemExecutionModeContractReadModel[] };
  return body.modes;
}

export async function fetchTradingGatewayEnvironment(): Promise<TradingGatewayEnvironmentReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-gateway/environment`);
  if (!response.ok) {
    throw new Error(`Failed to load trading gateway environment: ${response.status}`);
  }
  const body = (await response.json()) as { trading_gateway_environment: TradingGatewayEnvironmentReadModel };
  return body.trading_gateway_environment;
}

export type TradingResearchAgentSelection = "codex" | "fixture";

export interface TradingResearchRuntimeReadModel {
  default_agent: TradingResearchAgentSelection;
  available_agents: TradingResearchAgentSelection[];
  iterations: number;
  agents: Array<{
    agent: TradingResearchAgentSelection;
    provider: TradingResearchAgentSelection;
    readiness_status: "active_verified" | "blocked_or_not_installed";
    permission_policy: "artifact_workspace_only" | "fixture_only";
    model?: string;
    command?: string;
    timeout_ms?: number;
    reasoning_effort?: "low" | "medium" | "high" | "xhigh";
    version?: string;
    failure_reason?: string;
  }>;
}

export async function fetchTradingResearchRuntime(): Promise<TradingResearchRuntimeReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-research/runtime`);
  if (!response.ok) {
    throw new Error(`Failed to load trading research runtime: ${response.status}`);
  }
  const body = (await response.json()) as { trading_research_runtime: TradingResearchRuntimeReadModel };
  return body.trading_research_runtime;
}

export async function fetchCandidateArena(): Promise<CandidateArenaReadModel> {
  const operator = await fetchOperatorReadModel();
  return operator.candidate_arena;
}

export async function fetchOperatorReadModel(): Promise<OperatorReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/operator`);
  if (!response.ok) {
    throw new Error(`Failed to load Ouroboros operator: ${response.status}`);
  }
  const body = (await response.json()) as { operator: OperatorReadModel };
  return body.operator;
}

export async function startCandidateArena(): Promise<CandidateArenaReadModel> {
  return runCandidateArenaCommand("start");
}

export async function stopCandidateArena(): Promise<CandidateArenaReadModel> {
  return runCandidateArenaCommand("stop");
}

export async function tickCandidateArena(): Promise<CandidateArenaReadModel> {
  return runCandidateArenaCommand("tick");
}

export async function runCandidateArenaCommand(
  command: "status" | "start" | "stop" | "tick"
): Promise<CandidateArenaReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: `arena.${command}` as OuroborosCommandKind
  });
  return body.operator.candidate_arena;
}

export async function selectCandidateForOperator(candidateId: string): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "candidate.select",
    payload: { candidate_id: candidateId }
  });
  return body.operator;
}

export async function runPaperEvidenceForCandidate(candidateId: string): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "candidate.paper_evidence.run",
    payload: { candidate_id: candidateId }
  });
  return body.operator;
}

export async function setupAgentProvider(provider: AgentProfileProviderKind): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "agent_provider.setup",
    payload: { provider }
  });
  return body.operator;
}

export async function probeAgentProvider(provider: AgentProfileProviderKind): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "agent_provider.probe",
    payload: { provider }
  });
  return body.operator;
}

export async function startAgentProviderLogin(provider: AgentProfileProviderKind): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "agent_provider.login.start",
    payload: { provider }
  });
  return body.operator;
}

export async function selectResearcherProvider(provider: "codex" | "fixture"): Promise<OperatorReadModel> {
  const body = await submitOuroborosCommand({
    command_kind: "researcher.provider.select",
    payload: { provider }
  });
  return body.operator;
}

export async function submitOuroborosCommand(
  request: OuroborosCommandRequest
): Promise<{ operator: OperatorReadModel; result?: unknown }> {
  const response = await fetch(`${runtimeBaseUrl}/api/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request.payload ? request : { command_kind: request.command_kind })
  });
  if (!response.ok) {
    throw new Error(`Failed to run Ouroboros command ${request.command_kind}: ${response.status}`);
  }
  return (await response.json()) as { operator: OperatorReadModel; result?: unknown };
}

export async function fetchReplayRunEvidence(candidateId: string): Promise<ReplayRunEvidenceReadModel[]> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidateId}/replay-runs?limit=5`);
  if (!response.ok) {
    throw new Error(`Failed to load replay runs for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { runs: ReplayRunEvidenceReadModel[] };
  return body.runs;
}

export async function fetchReplayRunDetail(
  candidateId: string,
  runId: string
): Promise<ReplayRunDetailReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidateId}/replay-runs/${runId}`);
  if (!response.ok) {
    throw new Error(`Failed to load replay run ${runId} for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { run: ReplayRunDetailReadModel };
  return body.run;
}

export async function fetchReplayRunComparison(
  candidateId: string,
  runId: string,
  baselineRunId: string
): Promise<ReplayRunComparisonReadModel> {
  const response = await fetch(
    `${runtimeBaseUrl}/api/candidates/${candidateId}/replay-runs/${runId}/comparison?baseline_run_id=${encodeURIComponent(baselineRunId)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to compare replay run ${runId} for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { comparison: ReplayRunComparisonReadModel };
  return body.comparison;
}

export async function fetchReplayRunValidationState(
  candidateId: string,
  runId: string,
  baselineRunId?: string
): Promise<ReplayRunValidationStateReadModel> {
  const query = baselineRunId ? `?baseline_run_id=${encodeURIComponent(baselineRunId)}` : "";
  const response = await fetch(
    `${runtimeBaseUrl}/api/candidates/${candidateId}/replay-runs/${runId}/validation-state${query}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load replay run validation state ${runId} for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { validation_state: ReplayRunValidationStateReadModel };
  return body.validation_state;
}

export type LedgerCommandPayload = Omit<LedgerInput, "candidate_id">;

export type LedgerCommandOutcome = LedgerWriteOutcome & {
  status: "recorded";
};

export interface TradingRunOutcome {
  status: "started";
  trading_run_id: string;
  trading_run: {
    ref: { record_kind: "trading_run"; id: string };
    stage: string;
    lifecycle_status?: string;
    authority_status: "not_live";
  };
  trading_system?: CandidateInspectReadModel["trading_system"];
  run_control?: CandidateInspectReadModel["runtime"]["run_control"];
  sandbox?: SandboxDetailReadModel;
  transcript?: CandidateInspectReadModel["runtime"]["transcript"];
  order_request: LedgerReadModel["latest_order_request"];
  gateway_result: LedgerReadModel["latest_gateway_result"];
  execution_result: LedgerReadModel["latest_execution_result"];
  ledger: LedgerReadModel;
  trading_gateway_environment: TradingGatewayEnvironmentReadModel;
}

export type PaperOrderRequestSelection = "rejected";

export interface StartTradingRunInput {
  paper_order_request?: PaperOrderRequestSelection;
  research_agent?: TradingResearchAgentSelection;
  research_iterations?: number;
}

export interface TradingRunObserveOutcome {
  status: "observed";
  trading_run_id: string;
  trading_run: TradingRunOutcome["trading_run"];
  trading_system?: CandidateInspectReadModel["trading_system"];
  ledger?: LedgerReadModel;
  run_control?: CandidateInspectReadModel["runtime"]["run_control"];
  sandbox?: SandboxDetailReadModel;
  transcript?: CandidateInspectReadModel["runtime"]["transcript"];
}

export interface TradingRunStopOutcome {
  status: "stopped";
  trading_run_id: string;
  trading_run: TradingRunOutcome["trading_run"];
  trading_system?: CandidateInspectReadModel["trading_system"];
  ledger?: LedgerReadModel;
  run_control?: CandidateInspectReadModel["runtime"]["run_control"];
  sandbox?: SandboxDetailReadModel;
  transcript?: CandidateInspectReadModel["runtime"]["transcript"];
}

export interface ImprovementOutcome {
  status: "evaluated";
  proposal: {
    proposal_id: string;
  };
  experiment: {
    experiment_id: string;
  };
  trading_evaluation_result: {
    result_id: string;
  };
  improvement: ImprovementReadModel;
}

export type FullCycleOutcome = Omit<TradingRunOutcome, "status"> & {
  status: "completed";
  source_system_id: string;
  source_candidate_version_id: string;
  agent_research: {
    session_id: string;
    run_root: string;
    notebook_path: string;
    agent: {
      id: string;
      provider: "codex" | "claude_code" | "fixture";
      model?: string;
      permission_policy: "artifact_workspace_only" | "fixture_only";
    };
    best_score?: number;
    best_artifact_dir: string;
    latest_decision: "keep" | "discard" | "crash";
    latest_summary: string;
  };
  system_code_handoff: {
    system_code_id: string;
    artifact_path: string;
    artifact_digest: string;
    runtime_kind: "python";
    declared_output_kinds: string[];
    generated_by_agent: true;
    authority_status: "not_live";
  };
  full_cycle_lineage?: FullCycleLineageReadModel;
  backtest: {
    status: string;
    score: number;
    risk_decision: string;
    summary: string;
    scenario_results?: Array<{
      scenario_id: string;
      status: string;
      score: number;
      risk_decision: string;
      summary: string;
    }>;
  };
  next_trading_system: CandidateInspectReadModel;
  paper_trading: {
    run_status: string;
    events_path: string;
    provider_request_count: number;
    authority_status: "not_live";
  };
};

export type RunControlCommandPayload = Omit<RunControlAuditInput, "candidate_id">;

export type RunControlCommandOutcome = RunControlAuditOutcome & {
  status: "recorded";
};

export type PrivateReadinessPostureCommandPayload = PrivateReadinessPostureWriteInput;

export type PrivateReadinessPostureDraft = Pick<
  PrivateReadinessPostureWriteInput,
  | "operator_approval_gate"
  | "jurisdiction_risk_gate"
  | "live_binding_gate"
  | "secret_handling_gate"
  | "stop_behavior_gate"
>;

export interface PrivateReadinessPostureCommandOutcome {
  status: "recorded";
  posture: PrivateReadinessPostureReadModel;
}

export interface ReplayRunCommandPayload {
  runner_kind: "host_process";
}

export interface ReplayRunOutcome {
  candidate_id: string;
  run: ReplayRunEvidenceReadModel;
}

export function ledgerCommandPayload(
  candidate: CandidateInspectReadModel
): LedgerCommandPayload {
  return {
    idempotency_key: [
      "operator-web-ledger",
      candidate.candidate_id,
      candidate.candidate_version.candidate_version_id
    ].join("-"),
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    intent: {
      intent_kind: "place_order",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000"
    },
    gateway_result: {
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      }
    },
    execution_result: {
      execution_mode: "host_local",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: [
          "trace-operator-web-ledger",
          candidate.candidate_id,
          candidate.candidate_version.candidate_version_id
        ].join("-")
      }
    }
  };
}

export function runControlPausePayload(
  candidate: CandidateInspectReadModel
): RunControlCommandPayload {
  return {
    idempotency_key: [
      "operator-web-run-control-pause",
      candidate.candidate_id,
      candidate.candidate_version.candidate_version_id
    ].join("-"),
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    command: {
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: {
        record_kind: "operator",
        id: "operator-web"
      },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      reason: "operator_request",
      reason_summary: "Operator requested a paper trading run pause from operator-web.",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: [
          "trace-operator-web-run-control-pause",
          candidate.candidate_id,
          candidate.candidate_version.candidate_version_id
        ].join("-")
      }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: {
        record_kind: "runtime_policy_engine",
        id: "runtime-policy-engine-fixture"
      },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      resulting_lifecycle_status: "paused"
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      actor_kind: "human_operator",
      actor_ref: {
        record_kind: "operator",
        id: "operator-web"
      },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime pause recorded by operator-web through runtime API."
    }
  };
}

export function privateReadinessPostureDraftFromCandidate(
  candidate: CandidateInspectReadModel
): PrivateReadinessPostureDraft {
  const posture = candidate.trading_substrate?.latest_private_readiness_posture;
  return {
    operator_approval_gate: posture?.operator_approval_gate ?? privateReadinessGate(
      "not_ready",
      "operator_live_private_read_approval_missing"
    ),
    jurisdiction_risk_gate: posture?.jurisdiction_risk_gate ?? privateReadinessGate(
      "review_required",
      "operator_jurisdiction_not_recorded"
    ),
    live_binding_gate: posture?.live_binding_gate ?? privateReadinessGate(
      "not_ready",
      "live_binding_profile_not_configured"
    ),
    secret_handling_gate: posture?.secret_handling_gate ?? privateReadinessGate(
      "not_ready",
      "secret_handling_profile_not_configured"
    ),
    stop_behavior_gate: posture?.stop_behavior_gate ?? privateReadinessGate(
      "not_ready",
      "operator_stop_behavior_not_recorded"
    )
  };
}

export function privateReadinessPosturePayload(
  candidate: CandidateInspectReadModel,
  draft: PrivateReadinessPostureDraft = privateReadinessPostureDraftFromCandidate(candidate)
): PrivateReadinessPostureCommandPayload {
  const posture = candidate.trading_substrate?.latest_private_readiness_posture;
  const preflight = candidate.trading_substrate?.latest_private_readiness_preflight_surface;
  const draftSuffix = stablePostureDraftSuffix(draft);
  return {
    idempotency_key: [
      "operator-web-private-readiness-posture",
      candidate.candidate_id,
      candidate.candidate_version.candidate_version_id,
      draftSuffix
    ].join("-"),
    venue: posture?.venue ?? preflight?.venue ?? "binance_usd_m_futures",
    instrument: posture?.instrument ?? preflight?.instrument ?? "BTCUSDT",
    product_category: posture?.product_category ?? preflight?.product_category ?? "perpetual_futures",
    operator_approval_gate: draft.operator_approval_gate,
    jurisdiction_risk_gate: draft.jurisdiction_risk_gate,
    live_binding_gate: draft.live_binding_gate,
    secret_handling_gate: draft.secret_handling_gate,
    stop_behavior_gate: draft.stop_behavior_gate,
    secret_reference_configured: posture?.secret_reference_configured ?? false,
    secret_reference_ref: posture?.secret_reference_ref,
    source_ref: {
      record_kind: "operator",
      id: "operator-web"
    }
  };
}

export async function recordLedger(
  candidate: CandidateInspectReadModel
): Promise<LedgerCommandOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-systems/${candidate.candidate_id}/ledger`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ledgerCommandPayload(candidate))
  });
  if (!response.ok) {
    throw new Error(`Failed to record ledger for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as LedgerCommandOutcome;
}

export async function startTradingRun(
  candidate: CandidateInspectReadModel,
  input: StartTradingRunInput = {}
): Promise<TradingRunOutcome> {
  const hasBody = input.paper_order_request !== undefined;
  const response = await fetch(`${runtimeBaseUrl}/api/trading-systems/${candidate.candidate_id}/trading-runs`, {
    method: "POST",
    ...(hasBody
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      : {})
  });
  if (!response.ok) {
    throw new Error(`Failed to start trading run for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as TradingRunOutcome;
}

export async function observeTradingRun(
  candidate: CandidateInspectReadModel
): Promise<TradingRunObserveOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-runs/${candidate.runtime.ref.id}/observe`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to observe trading run ${candidate.runtime.ref.id}: ${response.status}`);
  }
  return (await response.json()) as TradingRunObserveOutcome;
}

export async function stopTradingRun(
  candidate: CandidateInspectReadModel
): Promise<TradingRunStopOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-runs/${candidate.runtime.ref.id}/stop`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to stop trading run ${candidate.runtime.ref.id}: ${response.status}`);
  }
  return (await response.json()) as TradingRunStopOutcome;
}

export async function recordImprovement(
  candidate: CandidateInspectReadModel
): Promise<ImprovementOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-systems/${candidate.candidate_id}/improvements`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to record improvement for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as ImprovementOutcome;
}

export async function runFullCycle(
  candidate: CandidateInspectReadModel,
  input: StartTradingRunInput = {}
): Promise<FullCycleOutcome> {
  const hasBody = Object.keys(input).length > 0;
  const response = await fetch(`${runtimeBaseUrl}/api/trading-systems/${candidate.candidate_id}/full-cycle-runs`, {
    method: "POST",
    ...(hasBody
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input)
        }
      : {})
  });
  if (!response.ok) {
    throw new Error(`Failed to run full cycle for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as FullCycleOutcome;
}

export async function recordRunControl(
  candidate: CandidateInspectReadModel
): Promise<RunControlCommandOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-systems/${candidate.candidate_id}/run-control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runControlPausePayload(candidate))
  });
  if (!response.ok) {
    throw new Error(`Failed to record run control for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as RunControlCommandOutcome;
}

export async function recordPrivateReadinessPosture(
  candidate: CandidateInspectReadModel,
  draft?: PrivateReadinessPostureDraft
): Promise<PrivateReadinessPostureCommandOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/trading-substrate/private-readiness-posture`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(privateReadinessPosturePayload(candidate, draft))
  });
  if (!response.ok) {
    throw new Error(`Failed to record private-readiness posture for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as PrivateReadinessPostureCommandOutcome;
}

export function replayRunPayload(): ReplayRunCommandPayload {
  return {
    runner_kind: "host_process"
  };
}

function privateReadinessGate(
  status: PrivateReadinessPolicyGateInput["status"],
  reason: string
): PrivateReadinessPolicyGateInput {
  return { status, reason };
}

function stablePostureDraftSuffix(draft: PrivateReadinessPostureDraft): string {
  const serialized = JSON.stringify({
    operator_approval_gate: draft.operator_approval_gate,
    jurisdiction_risk_gate: draft.jurisdiction_risk_gate,
    live_binding_gate: draft.live_binding_gate,
    secret_handling_gate: draft.secret_handling_gate,
    stop_behavior_gate: draft.stop_behavior_gate
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `draft-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function runReplay(
  candidate: CandidateInspectReadModel
): Promise<ReplayRunOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidate.candidate_id}/replay-runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(replayRunPayload())
  });
  if (!response.ok) {
    throw new Error(`Failed to run candidate replay for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as ReplayRunOutcome;
}
