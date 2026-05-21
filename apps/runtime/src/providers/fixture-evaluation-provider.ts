import type { EvaluationExecutionMode, Ref } from "@ouroboros/domain";
import type {
  CandidateEvaluationRequest,
  EvaluationProviderAdapter,
  EvaluationProviderFailureReason,
  EvaluationProviderProbeResult,
  EvaluationProviderResult
} from "./runtime-provider-adapter";
import { safeId } from "../safe-id";

const supportedExecutionModes: EvaluationExecutionMode[] = [
  "host_local",
  "containerized_local",
  "containerized_remote"
];

export interface FixtureEvaluationProviderOptions {
  evaluatorRef?: Ref;
  failureReason?: EvaluationProviderFailureReason;
  metrics?: Record<string, boolean | number | string>;
}

export class FixtureEvaluationProviderAdapter implements EvaluationProviderAdapter {
  private readonly evaluatorRef: Ref;
  private readonly failureReason?: EvaluationProviderFailureReason;
  private readonly metrics: Record<string, boolean | number | string>;

  constructor(options: FixtureEvaluationProviderOptions = {}) {
    this.evaluatorRef = options.evaluatorRef ?? {
      record_kind: "evaluation_provider",
      id: "deterministic-backtest-fixture"
    };
    this.failureReason = options.failureReason;
    this.metrics = options.metrics ?? {
      fixture_only: true,
      total_trades: 0,
      max_drawdown_bps: 0,
      net_return_bps: 0
    };
  }

  async probeEvaluation(): Promise<EvaluationProviderProbeResult> {
    if (this.failureReason === "evaluation_provider_unavailable") {
      return {
        provider_kind: "fixture_only",
        evaluator_ref: this.evaluatorRef,
        readiness_status: "blocked_or_not_installed",
        supported_execution_modes: supportedExecutionModes,
        failure_reason: this.failureReason
      };
    }

    return {
      provider_kind: "fixture_only",
      evaluator_ref: this.evaluatorRef,
      readiness_status: "active_verified",
      supported_execution_modes: supportedExecutionModes
    };
  }

  async runCandidateEvaluation(request: CandidateEvaluationRequest): Promise<EvaluationProviderResult> {
    const traceRef = this.traceRef(request);
    const outputArtifactRefs = this.outputArtifactRefs(request);
    const debugArtifactRefs = this.debugArtifactRefs(request);

    const requestFailure = this.validateRequest(request);
    if (requestFailure) {
      return {
        status: "failed",
        failure_reason: requestFailure,
        trace_ref: traceRef,
        output_artifact_refs: outputArtifactRefs,
        debug_artifact_refs: debugArtifactRefs,
        evaluator_ref: this.evaluatorRef
      };
    }

    if (this.failureReason) {
      return {
        status: "failed",
        failure_reason: this.failureReason,
        trace_ref: traceRef,
        output_artifact_refs: outputArtifactRefs,
        debug_artifact_refs: debugArtifactRefs,
        evaluator_ref: this.evaluatorRef
      };
    }

    return {
      status: "succeeded",
      trace_ref: traceRef,
      output_artifact_refs: outputArtifactRefs,
      debug_artifact_refs: debugArtifactRefs,
      evaluator_ref: this.evaluatorRef,
      metrics: this.metrics
    };
  }

  private validateRequest(request: CandidateEvaluationRequest): EvaluationProviderFailureReason | undefined {
    if (
      !request.candidate_id ||
      !request.candidate_version_id ||
      !request.idempotency_key ||
      !request.trace_id ||
      !request.stage_binding_ref ||
      request.stage_binding_ref.record_kind !== "stage_binding"
    ) {
      return "invalid_evaluation_request";
    }

    if (request.execution_mode !== undefined && !supportedExecutionModes.includes(request.execution_mode)) {
      return "unsupported_execution_mode";
    }

    return undefined;
  }

  private traceRef(request: CandidateEvaluationRequest): Ref {
    return {
      record_kind: "trace_placeholder",
      id: request.trace_id || `evaluation-trace-${safeId(request.idempotency_key || "invalid-request")}`
    };
  }

  private outputArtifactRefs(request: CandidateEvaluationRequest): Ref[] {
    return [
      {
        record_kind: "evaluation_provider_output_artifact",
        id: `fixture-evaluation-output-${safeId(request.idempotency_key || "invalid-request")}`
      }
    ];
  }

  private debugArtifactRefs(request: CandidateEvaluationRequest): Ref[] {
    return [
      {
        record_kind: "debug_artifact",
        id: `fixture-evaluation-debug-${safeId(request.idempotency_key || "invalid-request")}`
      }
    ];
  }
}
