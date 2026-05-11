import { describe, expect, it } from "vitest";
import type {
  AarFindingRecord,
  AarProposalProviderAttribution,
  AarProposalProviderFailureReason,
  AarProposalProviderProbeResult,
  AarProposalProviderRequest,
  AarProposalProviderResult,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import type { AarProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("AarProposalProviderAdapter contract", () => {
  it("exposes a Codex-first AAR proposal provider seam without real provider execution", async () => {
    const adapter = new FixtureAarProposalProviderAdapter();
    const request = validRequest();

    await expect(adapter.probeAarProposal?.()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      readiness_status: "active_verified",
      supported_purposes: ["aar_artifact_proposal_generation"]
    });

    const result = await adapter.runAarProposalGeneration(request);

    expect(result).toMatchObject({
      status: "succeeded",
      provider: {
        provider_kind: "codex_cli",
        model: "gpt-5.4"
      },
      output: {
        output_kind: "aar_artifact_proposal_input",
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
      ref("aar_proposal_provider_output_artifact", "fixture-aar-provider-output-runtime-contract")
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /aar_artifact_proposal_id|strategy_internals|strategy_schema|binance_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("returns adapter failures as trace material without proposal output", async () => {
    const adapter = new FixtureAarProposalProviderAdapter("aar_proposal_provider_failed");
    const result = await adapter.runAarProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "aar_proposal_provider_failed",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
  });
});

class FixtureAarProposalProviderAdapter implements AarProposalProviderAdapter {
  private readonly failureReason?: AarProposalProviderFailureReason;
  private readonly provider: AarProposalProviderAttribution = {
    provider_kind: "codex_cli",
    model: "gpt-5.4",
    invocation_surface: "fixture aar proposal provider contract"
  };

  constructor(failureReason?: AarProposalProviderFailureReason) {
    this.failureReason = failureReason;
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
    const base = {
      provider: this.provider,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [ref("agent_event", "agent-event-aar-provider-runtime-contract")],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [
        ref("aar_proposal_provider_output_artifact", "fixture-aar-provider-output-runtime-contract")
      ],
      debug_artifact_refs: [ref("debug_artifact", "fixture-aar-provider-debug-runtime-contract")],
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
        failure_reason: this.failureReason ?? "invalid_aar_proposal_request"
      };
    }

    return {
      status: "succeeded",
      ...base,
      output: {
        output_kind: "aar_artifact_proposal_input",
        trading_evaluation_task_ref: ref(
          "trading_evaluation_task",
          request.task.trading_evaluation_task_id
        ),
        source_finding_refs: [ref("aar_finding", request.findings[0].aar_finding_id)],
        anti_hacking_finding_refs: request.findings
          .filter((finding) => finding.finding_kind === "anti_hacking_case")
          .map((finding) => ref("aar_finding", finding.aar_finding_id)),
        parent_runnable_artifact_ref: request.parent_runnable_artifact_ref,
        proposal_summary: "Fixture provider proposal input for the next opaque BTC perp artifact.",
        requested_change_summary: "Preserve sealed evaluator constraints while improving robustness.",
        expected_improvement_summary: "Higher held-out robustness after later materialization.",
        proposed_artifact_refs: [ref("provider_artifact_hint", "fixture-opaque-python-artifact-hint")],
        output_authority_status: "proposal_input_only"
      }
    };
  }
}

function validRequest(): AarProposalProviderRequest {
  const task = btcPerpEvaluationTask();
  const sourceFinding = aarFinding("aar-finding-runtime-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = aarFinding(
    "aar-finding-runtime-provider-anti-hacking-001",
    "anti_hacking_case"
  );

  return {
    idempotency_key: "runtime-aar-proposal-provider-contract-001",
    task,
    findings: [sourceFinding, antiHackingFinding],
    existing_lineage_refs: [ref("aar_artifact_lineage", "aar-artifact-lineage-runtime-provider-v1")],
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-runtime-provider-v1"),
    input_artifact_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    requested_output_contract_ref: ref("artifact_runtime_contract", "artifact-runtime-contract-python-clock-v1"),
    agent_run_ref: ref("agent_run", "agent-run-aar-provider-runtime-contract"),
    trace_ref: ref("trace_placeholder", "trace-aar-provider-runtime-contract")
  };
}

function aarFinding(
  findingId: string,
  findingKind: AarFindingRecord["finding_kind"]
): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: findingId,
    researcher_ref: ref("aar_researcher", "aar-researcher-runtime-provider-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-runtime-provider-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-runtime-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-runtime-provider-001"),
    finding_kind: findingKind,
    summary: `Runtime provider contract ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T18:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-runtime-provider-contract-001",
    market_scope: "binance_btc_perpetual_futures",
    stage: "backtest",
    data_window_ref: ref("data_window", "btc-perp-fixture-window"),
    fee_model_ref: ref("fee_model", "binance-btc-perp-fixture-fees"),
    funding_model_ref: ref("funding_model", "binance-btc-perp-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "btc-perp-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "btc-perp-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "btc-perp-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "btc-perp-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "btc-perp-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
    created_at: "2026-05-11T18:00:00.000Z",
    authority_status: "not_live"
  };
}
