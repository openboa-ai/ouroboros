import type {
  BoundedRuntimeAuthorityInput,
  BoundedRuntimeAuthorityOutcome,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateSummaryReadModel,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPostureWriteInput,
  RuntimeControlAuditInput,
  RuntimeControlAuditOutcome,
  TradingLedgerReadModel,
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

export type RuntimeAuthorityCommandPayload = Omit<BoundedRuntimeAuthorityInput, "candidate_id">;

export type RuntimeAuthorityCommandOutcome = BoundedRuntimeAuthorityOutcome & {
  status: "recorded";
};

export interface TradingLoopRunOutcome {
  status: "recorded";
  order_intent: BoundedRuntimeAuthorityOutcome["order_intent_draft"];
  gateway_decision: BoundedRuntimeAuthorityOutcome["gateway_decision"];
  execution_attempt: BoundedRuntimeAuthorityOutcome["execution_attempt"];
  trading_ledger: TradingLedgerReadModel;
}

export type RuntimeControlCommandPayload = Omit<RuntimeControlAuditInput, "candidate_id">;

export type RuntimeControlCommandOutcome = RuntimeControlAuditOutcome & {
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

export function runtimeAuthorityCommandPayload(
  candidate: CandidateInspectReadModel
): RuntimeAuthorityCommandPayload {
  return {
    idempotency_key: [
      "operator-web-runtime-authority",
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
    gateway_decision: {
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      }
    },
    execution_attempt: {
      execution_mode: "host_local",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: [
          "trace-operator-web-runtime-authority",
          candidate.candidate_id,
          candidate.candidate_version.candidate_version_id
        ].join("-")
      }
    }
  };
}

export function runtimeControlPausePayload(
  candidate: CandidateInspectReadModel
): RuntimeControlCommandPayload {
  return {
    idempotency_key: [
      "operator-web-runtime-control-pause",
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
      reason_summary: "Operator requested bounded paper-runtime pause from operator-web.",
      trace_ref: {
        record_kind: "trace_placeholder",
        id: [
          "trace-operator-web-runtime-control-pause",
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

export async function recordReplayRuntimeAuthority(
  candidate: CandidateInspectReadModel
): Promise<RuntimeAuthorityCommandOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidate.candidate_id}/runtime-authority`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runtimeAuthorityCommandPayload(candidate))
  });
  if (!response.ok) {
    throw new Error(`Failed to record runtime authority for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as RuntimeAuthorityCommandOutcome;
}

export async function runTradingLoop(
  candidate: CandidateInspectReadModel
): Promise<TradingLoopRunOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidate.candidate_id}/trading-loop-runs`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to run trading loop for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as TradingLoopRunOutcome;
}

export async function recordReplayRuntimeControl(
  candidate: CandidateInspectReadModel
): Promise<RuntimeControlCommandOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidate.candidate_id}/runtime-control`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runtimeControlPausePayload(candidate))
  });
  if (!response.ok) {
    throw new Error(`Failed to record runtime control for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as RuntimeControlCommandOutcome;
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
