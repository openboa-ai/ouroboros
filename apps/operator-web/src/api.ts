import type {
  BoundedRuntimeAuthorityInput,
  BoundedRuntimeAuthorityOutcome,
  CandidateRunComparisonReadModel,
  CandidateRunDetailReadModel,
  CandidateRunEvidenceReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateSummaryReadModel,
  RuntimeControlAuditInput,
  RuntimeControlAuditOutcome
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

export async function fetchCandidateRunEvidence(candidateId: string): Promise<CandidateRunEvidenceReadModel[]> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidateId}/candidate-runs?limit=5`);
  if (!response.ok) {
    throw new Error(`Failed to load candidate runs for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { runs: CandidateRunEvidenceReadModel[] };
  return body.runs;
}

export async function fetchCandidateRunDetail(
  candidateId: string,
  runId: string
): Promise<CandidateRunDetailReadModel> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidateId}/candidate-runs/${runId}`);
  if (!response.ok) {
    throw new Error(`Failed to load candidate run ${runId} for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { run: CandidateRunDetailReadModel };
  return body.run;
}

export async function fetchCandidateRunComparison(
  candidateId: string,
  runId: string,
  baselineRunId: string
): Promise<CandidateRunComparisonReadModel> {
  const response = await fetch(
    `${runtimeBaseUrl}/api/candidates/${candidateId}/candidate-runs/${runId}/comparison?baseline_run_id=${encodeURIComponent(baselineRunId)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to compare candidate run ${runId} for ${candidateId}: ${response.status}`);
  }
  const body = (await response.json()) as { comparison: CandidateRunComparisonReadModel };
  return body.comparison;
}

export type RuntimeAuthorityCommandPayload = Omit<BoundedRuntimeAuthorityInput, "candidate_id">;

export type RuntimeAuthorityCommandOutcome = BoundedRuntimeAuthorityOutcome & {
  status: "recorded";
};

export type RuntimeControlCommandPayload = Omit<RuntimeControlAuditInput, "candidate_id">;

export type RuntimeControlCommandOutcome = RuntimeControlAuditOutcome & {
  status: "recorded";
};

export interface CandidateReplayRunCommandPayload {
  runner_kind: "host_process";
}

export interface CandidateReplayRunOutcome {
  candidate_id: string;
  run: CandidateRunEvidenceReadModel;
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

export async function recordCandidateRuntimeAuthority(
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

export async function recordCandidateRuntimeControl(
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

export function candidateReplayRunPayload(): CandidateReplayRunCommandPayload {
  return {
    runner_kind: "host_process"
  };
}

export async function runCandidateReplay(
  candidate: CandidateInspectReadModel
): Promise<CandidateReplayRunOutcome> {
  const response = await fetch(`${runtimeBaseUrl}/api/candidates/${candidate.candidate_id}/candidate-runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(candidateReplayRunPayload())
  });
  if (!response.ok) {
    throw new Error(`Failed to run candidate replay for ${candidate.candidate_id}: ${response.status}`);
  }
  return (await response.json()) as CandidateReplayRunOutcome;
}
