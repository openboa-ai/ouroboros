import type { CandidateEvaluationRunOutcome } from "@ouroboros/domain";
import {
  candidateEvaluationRunRecordId,
  isStoreErrorLike,
  type OuroborosStorePort
} from "./ports/store-ports";
import type {
  CandidateEvaluationRequest,
  EvaluationProviderAdapter,
  EvaluationProviderFailureReason,
  EvaluationProviderResult
} from "./ports/provider-ports";

export type CandidateEvaluationFailureReason =
  | EvaluationProviderFailureReason
  | string
  | "evaluation_store_failed";

export type CandidateEvaluationRuntimeOutcome =
  | {
      status: "created";
      provider_result: Extract<EvaluationProviderResult, { status: "succeeded" }>;
      evaluation: CandidateEvaluationRunOutcome;
    }
  | {
      status: "failed";
      failure_reason: CandidateEvaluationFailureReason;
      candidate_id: string;
      candidate_version_id: string;
      idempotency_key: string;
      provider_result?: EvaluationProviderResult;
      store_error?: {
        code: CandidateEvaluationFailureReason;
        message: string;
        details?: Record<string, unknown>;
      };
    };

export async function runCandidateEvaluation(
  store: OuroborosStorePort,
  evaluationProviderAdapter: EvaluationProviderAdapter,
  request: CandidateEvaluationRequest
): Promise<CandidateEvaluationRuntimeOutcome> {
  const existingEvaluation = await store.getCandidateEvaluationRun(
    candidateEvaluationRunRecordId({
      candidate_id: request.candidate_id,
      candidate_version_id: request.candidate_version_id,
      idempotency_key: request.idempotency_key
    })
  );
  if (existingEvaluation) {
    return {
      status: "created",
      provider_result: {
        status: "succeeded",
        trace_ref: existingEvaluation.evaluation_run.trace_ref,
        output_artifact_refs: existingEvaluation.trace.provider_output_artifact_refs ?? [],
        debug_artifact_refs: existingEvaluation.trace.debug_artifact_refs ?? [],
        evaluator_ref: existingEvaluation.evaluation_run.evaluator_ref ?? {
          record_kind: "evaluation_provider",
          id: "existing_evaluation_run"
        }
      },
      evaluation: existingEvaluation
    };
  }

  const providerResult = await evaluationProviderAdapter.runCandidateEvaluation(request);
  if (providerResult.status === "failed") {
    return {
      status: "failed",
      failure_reason: providerResult.failure_reason,
      candidate_id: request.candidate_id,
      candidate_version_id: request.candidate_version_id,
      idempotency_key: request.idempotency_key,
      provider_result: providerResult
    };
  }

  try {
    const evaluation = await store.createEvaluationRunForCandidate({
      idempotency_key: request.idempotency_key,
      candidate_id: request.candidate_id,
      candidate_version_id: request.candidate_version_id,
      stage: "backtest",
      execution_mode: request.execution_mode,
      trace_ref: providerResult.trace_ref,
      evaluator_ref: providerResult.evaluator_ref,
      provider_output_artifact_refs: providerResult.output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs
    });

    return {
      status: "created",
      provider_result: providerResult,
      evaluation
    };
  } catch (error) {
    if (isStoreErrorLike(error)) {
      return {
        status: "failed",
        failure_reason: error.code,
        candidate_id: request.candidate_id,
        candidate_version_id: request.candidate_version_id,
        idempotency_key: request.idempotency_key,
        provider_result: providerResult,
        store_error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
    }

    return {
      status: "failed",
      failure_reason: "evaluation_store_failed",
      candidate_id: request.candidate_id,
      candidate_version_id: request.candidate_version_id,
      idempotency_key: request.idempotency_key,
      provider_result: providerResult,
      store_error: {
        code: "evaluation_store_failed",
        message: error instanceof Error ? error.message : "unknown evaluation store failure"
      }
    };
  }
}
