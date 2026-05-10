import type {
  BoundedRuntimeAuthorityInput,
  BoundedRuntimeAuthorityOutcome,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateSummaryReadModel
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

export type RuntimeAuthorityCommandPayload = Omit<BoundedRuntimeAuthorityInput, "candidate_id">;

export type RuntimeAuthorityCommandOutcome = BoundedRuntimeAuthorityOutcome & {
  status: "recorded";
};

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
