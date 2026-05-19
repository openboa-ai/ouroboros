import { describe, expect, it } from "vitest";
import type {
  ResearchFindingRecord,
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderFailureReason,
  ImprovementProposalProviderProbeResult,
  ImprovementProposalProviderRequest,
  ImprovementProposalProviderResult,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import type { ImprovementProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("ImprovementProposalProviderAdapter contract", () => {
  it("exposes a Codex-first improvement proposal provider seam without real provider execution", async () => {
    const adapter = new FixtureImprovementProposalProviderAdapter();
    const request = validRequest();

    await expect(adapter.probeImprovementProposal?.()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      readiness_status: "active_verified",
      supported_purposes: ["improvement_proposal_generation"]
    });

    const result = await adapter.runImprovementProposalGeneration(request);

    expect(result).toMatchObject({
      status: "succeeded",
      provider: {
        provider_kind: "codex_cli",
        model: "gpt-5.4"
      },
      output: {
        output_kind: "improvement_proposal_input",
        trading_evaluation_task_ref: ref(
          "trading_evaluation_task",
          request.task.trading_evaluation_task_id
        ),
        output_authority_status: "proposal_input_only"
      },
      agent_run_ref: request.agent_run_ref,
      trace_ref: request.trace_ref,
      authority_status: "proposal_input_only"
    });
    expect(result.provider_output_artifact_refs).toEqual([
      ref("improvement_proposal_provider_output_artifact", "fixture-research-provider-output-runtime-contract")
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /improvement_proposal_id|strategy_internals|strategy_schema|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("returns adapter failures as trace material without proposal output", async () => {
    const adapter = new FixtureImprovementProposalProviderAdapter("improvement_proposal_provider_failed");
    const result = await adapter.runImprovementProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "improvement_proposal_provider_failed",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
  });
});

class FixtureImprovementProposalProviderAdapter implements ImprovementProposalProviderAdapter {
  private readonly failureReason?: ImprovementProposalProviderFailureReason;
  private readonly provider: ImprovementProposalProviderAttribution = {
    provider_kind: "codex_cli",
    model: "gpt-5.4",
    invocation_surface: "fixture research proposal provider contract"
  };

  constructor(failureReason?: ImprovementProposalProviderFailureReason) {
    this.failureReason = failureReason;
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
    const base = {
      provider: this.provider,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [ref("agent_event", "agent-event-research-provider-runtime-contract")],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [
        ref("improvement_proposal_provider_output_artifact", "fixture-research-provider-output-runtime-contract")
      ],
      debug_artifact_refs: [ref("debug_artifact", "fixture-research-provider-debug-runtime-contract")],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only" as const
    };

    if (
      this.failureReason ||
      request.agent_run_ref.record_kind !== "agent_run" ||
      request.trace_ref.record_kind !== "trace_placeholder"
    ) {
      return {
        status: "failed",
        ...base,
        failure_reason: this.failureReason ?? "invalid_improvement_proposal_request"
      };
    }

    return {
      status: "succeeded",
      ...base,
      output: {
        output_kind: "improvement_proposal_input",
        trading_evaluation_task_ref: ref(
          "trading_evaluation_task",
          request.task.trading_evaluation_task_id
        ),
        source_finding_refs: [ref("research_finding", request.findings[0].research_finding_id)],
        anti_hacking_finding_refs: request.findings
          .filter((finding) => finding.finding_kind === "anti_hacking_case")
          .map((finding) => ref("research_finding", finding.research_finding_id)),
        parent_system_code_ref: request.parent_system_code_ref,
        proposal_summary: "Fixture provider proposal input for the next opaque generic trading artifact.",
        requested_change_summary: "Preserve sealed evaluator constraints while improving robustness.",
        expected_improvement_summary: "Higher held-out robustness after later materialization.",
        proposed_artifact_refs: [ref("provider_artifact_hint", "fixture-opaque-python-artifact-hint")],
        output_authority_status: "proposal_input_only"
      }
    };
  }
}

function validRequest(): ImprovementProposalProviderRequest {
  const task = fixtureTradingEvaluationTask();
  const sourceFinding = researchFinding("research-finding-runtime-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = researchFinding(
    "research-finding-runtime-provider-anti-hacking-001",
    "anti_hacking_case"
  );

  return {
    idempotency_key: "runtime-improvement-proposal-provider-contract-001",
    task,
    findings: [sourceFinding, antiHackingFinding],
    existing_lineage_refs: [ref("artifact_lineage", "artifact-lineage-runtime-provider-v1")],
    parent_system_code_ref: ref("system_code", "research-system-code-runtime-provider-v1"),
    input_artifact_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    requested_output_contract_ref: ref("artifact_runtime_contract", "artifact-runtime-contract-python-clock-v1"),
    agent_run_ref: ref("agent_run", "agent-run-research-provider-runtime-contract"),
    trace_ref: ref("trace_placeholder", "trace-research-provider-runtime-contract")
  };
}

function researchFinding(
  findingId: string,
  findingKind: ResearchFindingRecord["finding_kind"]
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-runtime-provider-001"),
    research_direction_ref: ref("research_direction", "research-direction-runtime-provider-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-runtime-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-runtime-provider-001"),
    finding_kind: findingKind,
    summary: `Runtime provider contract ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T18:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-runtime-provider-contract-001",
    market_scope: "external_trading_api_fixture",
    stage: "backtest",
    data_window_ref: ref("data_window", "sealed-replay-fixture-window"),
    fee_model_ref: ref("fee_model", "external-api-replay-fixture-fees"),
    funding_model_ref: ref("funding_model", "external-api-replay-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "sealed-replay-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "sealed-replay-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "sealed-replay-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "sealed-replay-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "sealed-replay-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
    created_at: "2026-05-11T18:00:00.000Z",
    authority_status: "not_live"
  };
}
