import type {
  AarProposalProviderAttribution,
  AarProposalProviderProbeResult,
  AarProposalProviderRequest,
  AarProposalProviderResult,
  Ref
} from "@ouroboros/domain";
import type { AarProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import { DeterministicAarProposalPlanner } from "./deterministic-proposal-planner";

export interface FixtureAarProposalProviderAdapterOptions {
  model?: string;
  planner?: DeterministicAarProposalPlanner;
  failureReason?: Extract<
    AarProposalProviderResult,
    { status: "failed" }
  >["failure_reason"];
}

export class FixtureAarProposalProviderAdapter implements AarProposalProviderAdapter {
  private readonly provider: AarProposalProviderAttribution;
  private readonly planner: DeterministicAarProposalPlanner;
  private readonly failureReason?: Extract<
    AarProposalProviderResult,
    { status: "failed" }
  >["failure_reason"];

  constructor(options: FixtureAarProposalProviderAdapterOptions = {}) {
    this.provider = {
      provider_kind: "fixture_only",
      model: options.model ?? "deterministic-aar-proposal-planner-fixture",
      invocation_surface: "deterministic-aar-proposal-planner-fixture-adapter"
    };
    this.planner = options.planner ?? new DeterministicAarProposalPlanner();
    this.failureReason = options.failureReason;
  }

  async probeAarProposal(): Promise<AarProposalProviderProbeResult> {
    return {
      ...this.provider,
      readiness_status: this.failureReason ? "candidate_unverified" : "active_verified",
      supported_purposes: ["aar_artifact_proposal_generation"],
      failure_reason: this.failureReason
    };
  }

  async runAarProposalGeneration(
    request: AarProposalProviderRequest
  ): Promise<AarProposalProviderResult> {
    if (this.failureReason) {
      return this.failureResult(request, this.failureReason);
    }

    if (!isValidRequest(request)) {
      return this.failureResult(request, "invalid_aar_proposal_request");
    }

    try {
      const outcome = this.planner.plan({
        task: request.task,
        findings: request.findings,
        existing_lineages: request.existing_lineages,
        parent_runnable_artifact_ref: request.parent_runnable_artifact_ref,
        idempotency_key: request.idempotency_key,
        created_at: request.created_at
      });

      return {
        status: "succeeded",
        provider: this.provider,
        output: {
          output_kind: "aar_artifact_proposal_input",
          trading_evaluation_task_ref: outcome.proposal.trading_evaluation_task_ref,
          source_finding_refs: outcome.proposal.source_finding_refs,
          anti_hacking_finding_refs: outcome.proposal.anti_hacking_finding_refs,
          parent_runnable_artifact_ref: outcome.proposal.parent_runnable_artifact_ref,
          proposal_summary: outcome.proposal.proposal_summary,
          requested_change_summary: outcome.proposal.requested_change_summary,
          expected_improvement_summary: outcome.proposal.expected_improvement_summary,
          proposed_artifact_refs: [
            ref("fixture_provider_artifact_hint", outcome.runnable_artifact.runnable_artifact_id)
          ],
          output_authority_status: "proposal_input_only"
        },
        agent_run_ref: request.agent_run_ref,
        agent_event_refs: [agentEventRef(request)],
        trace_ref: request.trace_ref,
        provider_output_artifact_refs: [providerOutputArtifactRef(request)],
        debug_artifact_refs: [
          ref("debug_artifact", `fixture-aar-proposal-planner-debug-${safeId(request.idempotency_key)}`)
        ],
        idempotency_key: request.idempotency_key,
        authority_status: "proposal_input_only"
      };
    } catch (error) {
      return this.failureResult(
        request,
        error instanceof Error && error.message === "no_eligible_aar_finding"
          ? "no_eligible_aar_finding"
          : error instanceof Error && error.message.startsWith("unsupported_")
          ? "unsupported_aar_proposal_task"
          : "aar_proposal_provider_failed"
      );
    }
  }

  private failureResult(
    request: AarProposalProviderRequest,
    failureReason: Extract<AarProposalProviderResult, { status: "failed" }>["failure_reason"]
  ): AarProposalProviderResult {
    return {
      status: "failed",
      provider: this.provider,
      failure_reason: failureReason,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [agentEventRef(request)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [providerOutputArtifactRef(request)],
      debug_artifact_refs: [
        ref("debug_artifact", `fixture-aar-proposal-planner-debug-${safeId(request.idempotency_key)}`)
      ],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

function isValidRequest(request: AarProposalProviderRequest): boolean {
  return (
    Boolean(request.idempotency_key) &&
    request.agent_run_ref.record_kind === "agent_run" &&
    request.trace_ref.record_kind === "trace_placeholder" &&
    request.task.record_kind === "trading_evaluation_task" &&
    Array.isArray(request.findings)
  );
}

function agentEventRef(request: AarProposalProviderRequest): Ref {
  return ref("agent_event", `agent-event-fixture-aar-proposal-${safeId(request.idempotency_key)}`);
}

function providerOutputArtifactRef(request: AarProposalProviderRequest): Ref {
  return ref(
    "aar_proposal_provider_output_artifact",
    `fixture-aar-proposal-provider-output-${safeId(request.idempotency_key)}`
  );
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
