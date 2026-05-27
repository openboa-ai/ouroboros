import type {
  CandidateMaterializationFailureReason,
  CandidateMaterializationInput,
  EvaluationExecutionMode,
  ImprovementProposalProviderProbeResult,
  ImprovementProposalProviderRequest,
  ImprovementProposalProviderResult,
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

export type EvaluationProviderFailureReason =
  | "evaluation_provider_unavailable"
  | "evaluation_provider_failed"
  | "invalid_evaluation_request"
  | "unsupported_execution_mode";

export interface EvaluationProviderProbeResult {
  provider_kind: ProviderKind;
  evaluator_ref: Ref;
  readiness_status: "active_verified" | "blocked_or_not_installed" | "candidate_unverified";
  supported_execution_modes: EvaluationExecutionMode[];
  failure_reason?: EvaluationProviderFailureReason;
}

export interface CandidateEvaluationRequest {
  candidate_id: string;
  candidate_version_id: string;
  stage_binding_ref: Ref;
  trace_id: string;
  idempotency_key: string;
  execution_mode?: EvaluationExecutionMode;
}

export type EvaluationProviderResult =
  | {
      status: "succeeded";
      trace_ref: Ref;
      output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      evaluator_ref: Ref;
      metrics?: Record<string, boolean | number | string>;
    }
  | {
      status: "failed";
      failure_reason: EvaluationProviderFailureReason;
      trace_ref: Ref;
      output_artifact_refs: Ref[];
      debug_artifact_refs: Ref[];
      evaluator_ref: Ref;
    };

export interface EvaluationProviderAdapter {
  probeEvaluation?(): Promise<EvaluationProviderProbeResult>;
  runCandidateEvaluation(request: CandidateEvaluationRequest): Promise<EvaluationProviderResult>;
}

export interface ImprovementProposalProviderAdapter {
  probeImprovementProposal?(): Promise<ImprovementProposalProviderProbeResult>;
  runImprovementProposalGeneration(request: ImprovementProposalProviderRequest): Promise<ImprovementProposalProviderResult>;
}
