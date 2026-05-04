import type {
  CandidateMaterializationFailureReason,
  CandidateMaterializationInput,
  ProviderKind,
  Ref
} from "@ouroboros/domain";

export interface ProviderProbeResult {
  provider_kind: ProviderKind;
  model: string;
  readiness_status: "active_verified" | "blocked_or_not_installed" | "candidate_unverified";
  version?: string;
  failure_reason?: CandidateMaterializationFailureReason;
}

export interface CandidateGenerationRequest {
  prompt: string;
}

export type CandidateGenerationProviderResult =
  | {
      status: "succeeded";
      output: CandidateMaterializationInput;
    }
  | {
      status: "failed";
      failure_reason: CandidateMaterializationFailureReason;
      idempotency_key: string;
      provider_kind: ProviderKind;
      model: string;
      agent_run_id: string;
      trace_id: string;
      artifact_refs: Ref[];
    };

export interface RuntimeProviderAdapter {
  probe(): Promise<ProviderProbeResult>;
  runCandidateGeneration(request: CandidateGenerationRequest): Promise<CandidateGenerationProviderResult>;
}
