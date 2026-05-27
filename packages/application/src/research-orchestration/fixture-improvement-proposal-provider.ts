import type {
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderProbeResult,
  ImprovementProposalProviderRequest,
  ImprovementProposalProviderResult,
  Ref
} from "@ouroboros/domain";
import type { ImprovementProposalProviderAdapter } from "@ouroboros/adapters/providers/runtime-provider-adapter";
import { safeId } from "../safe-id";
import { DeterministicImprovementProposalPlanner } from "./deterministic-proposal-planner";

export interface FixtureImprovementProposalProviderAdapterOptions {
  model?: string;
  planner?: DeterministicImprovementProposalPlanner;
  failureReason?: Extract<
    ImprovementProposalProviderResult,
    { status: "failed" }
  >["failure_reason"];
}

export class FixtureImprovementProposalProviderAdapter implements ImprovementProposalProviderAdapter {
  private readonly provider: ImprovementProposalProviderAttribution;
  private readonly planner: DeterministicImprovementProposalPlanner;
  private readonly failureReason?: Extract<
    ImprovementProposalProviderResult,
    { status: "failed" }
  >["failure_reason"];

  constructor(options: FixtureImprovementProposalProviderAdapterOptions = {}) {
    this.provider = {
      provider_kind: "fixture_only",
      model: options.model ?? "deterministic-improvement-proposal-planner-fixture",
      invocation_surface: "deterministic-improvement-proposal-planner-fixture-adapter"
    };
    this.planner = options.planner ?? new DeterministicImprovementProposalPlanner();
    this.failureReason = options.failureReason;
  }

  async probeImprovementProposal(): Promise<ImprovementProposalProviderProbeResult> {
    return {
      ...this.provider,
      readiness_status: this.failureReason ? "candidate_unverified" : "active_verified",
      supported_purposes: ["improvement_proposal_generation"],
      failure_reason: this.failureReason
    };
  }

  async runImprovementProposalGeneration(
    request: ImprovementProposalProviderRequest
  ): Promise<ImprovementProposalProviderResult> {
    if (this.failureReason) {
      return this.failureResult(request, this.failureReason);
    }

    if (!isValidRequest(request)) {
      return this.failureResult(request, "invalid_improvement_proposal_request");
    }

    try {
      const outcome = this.planner.plan({
        task: request.task,
        findings: request.findings,
        existing_lineages: request.existing_lineages,
        parent_system_code_ref: request.parent_system_code_ref,
        idempotency_key: request.idempotency_key,
        created_at: request.created_at
      });

      return {
        status: "succeeded",
        provider: this.provider,
        output: {
          output_kind: "improvement_proposal_input",
          trading_evaluation_task_ref: outcome.proposal.trading_evaluation_task_ref,
          source_finding_refs: outcome.proposal.source_finding_refs,
          anti_hacking_finding_refs: outcome.proposal.anti_hacking_finding_refs,
          parent_system_code_ref: outcome.proposal.parent_system_code_ref,
          proposal_summary: outcome.proposal.proposal_summary,
          requested_change_summary: outcome.proposal.requested_change_summary,
          expected_improvement_summary: outcome.proposal.expected_improvement_summary,
          proposed_artifact_refs: [
            ref("fixture_provider_artifact_hint", outcome.system_code.system_code_id)
          ],
          output_authority_status: "proposal_input_only"
        },
        agent_run_ref: request.agent_run_ref,
        agent_event_refs: [agentEventRef(request)],
        trace_ref: request.trace_ref,
        provider_output_artifact_refs: [providerOutputArtifactRef(request)],
        debug_artifact_refs: [
          ref("debug_artifact", `fixture-improvement-proposal-planner-debug-${safeId(request.idempotency_key)}`)
        ],
        idempotency_key: request.idempotency_key,
        authority_status: "proposal_input_only"
      };
    } catch (error) {
      return this.failureResult(
        request,
        error instanceof Error && error.message === "no_eligible_research_finding"
          ? "no_eligible_research_finding"
          : error instanceof Error && error.message.startsWith("unsupported_")
          ? "unsupported_improvement_proposal_task"
          : "improvement_proposal_provider_failed"
      );
    }
  }

  private failureResult(
    request: ImprovementProposalProviderRequest,
    failureReason: Extract<ImprovementProposalProviderResult, { status: "failed" }>["failure_reason"]
  ): ImprovementProposalProviderResult {
    return {
      status: "failed",
      provider: this.provider,
      failure_reason: failureReason,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [agentEventRef(request)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [providerOutputArtifactRef(request)],
      debug_artifact_refs: [
        ref("debug_artifact", `fixture-improvement-proposal-planner-debug-${safeId(request.idempotency_key)}`)
      ],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

function isValidRequest(request: ImprovementProposalProviderRequest): boolean {
  return (
    Boolean(request.idempotency_key) &&
    request.agent_run_ref.record_kind === "agent_run" &&
    request.trace_ref.record_kind === "trace_placeholder" &&
    request.task.record_kind === "trading_evaluation_task" &&
    Array.isArray(request.findings)
  );
}

function agentEventRef(request: ImprovementProposalProviderRequest): Ref {
  return ref("agent_event", `agent-event-fixture-improvement-proposal-${safeId(request.idempotency_key)}`);
}

function providerOutputArtifactRef(request: ImprovementProposalProviderRequest): Ref {
  return ref(
    "improvement_proposal_provider_output_artifact",
    `fixture-improvement-proposal-provider-output-${safeId(request.idempotency_key)}`
  );
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
