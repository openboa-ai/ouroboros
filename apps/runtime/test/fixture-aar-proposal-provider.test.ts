import { describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarFindingRecord,
  AarProposalProviderRequest,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { FixtureAarProposalProviderAdapter } from "../src/aar-orchestration/fixture-aar-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("FixtureAarProposalProviderAdapter", () => {
  it("wraps the deterministic planner behind the AAR proposal provider adapter", async () => {
    const adapter = new FixtureAarProposalProviderAdapter();
    const request = validRequest();

    await expect(adapter.probeAarProposal()).resolves.toMatchObject({
      provider_kind: "fixture_only",
      readiness_status: "active_verified",
      supported_purposes: ["aar_artifact_proposal_generation"]
    });

    const result = await adapter.runAarProposalGeneration(request);

    expect(result).toMatchObject({
      status: "succeeded",
      provider: {
        provider_kind: "fixture_only",
        model: "deterministic-aar-proposal-planner-fixture"
      },
      output: {
        output_kind: "aar_artifact_proposal_input",
        source_finding_refs: [ref("aar_finding", "aar-finding-fixture-provider-next-001")],
        anti_hacking_finding_refs: [
          ref("aar_finding", "aar-finding-fixture-provider-anti-001")
        ],
        parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-fixture-provider-v1"),
        output_authority_status: "proposal_input_only"
      },
      trace_ref: request.trace_ref,
      authority_status: "proposal_input_only"
    });
    expect(JSON.stringify(result)).not.toMatch(
      /aar_artifact_proposal_id|strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
  });

  it("maps deterministic planner failures to adapter failures", async () => {
    const adapter = new FixtureAarProposalProviderAdapter();
    const result = await adapter.runAarProposalGeneration({
      ...validRequest(),
      findings: [aarFinding("aar-finding-fixture-provider-anti-only", "anti_hacking_case")]
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "no_eligible_aar_finding",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
  });
});

function validRequest(): AarProposalProviderRequest {
  const sourceFinding = aarFinding("aar-finding-fixture-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = aarFinding("aar-finding-fixture-provider-anti-001", "anti_hacking_case");
  return {
    idempotency_key: "fixture-aar-proposal-provider",
    task: btcPerpEvaluationTask(),
    findings: [sourceFinding, antiHackingFinding],
    existing_lineages: [artifactLineage(sourceFinding)],
    existing_lineage_refs: [ref("aar_artifact_lineage", "aar-artifact-lineage-fixture-provider-v1")],
    input_artifact_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    agent_run_ref: ref("agent_run", "agent-run-fixture-aar-proposal-provider"),
    trace_ref: ref("trace_placeholder", "trace-fixture-aar-proposal-provider"),
    created_at: "2026-05-11T19:00:00.000Z"
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
    researcher_ref: ref("aar_researcher", "aar-researcher-fixture-provider-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-fixture-provider-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-fixture-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-fixture-provider-001"),
    finding_kind: findingKind,
    summary: `Fixture provider ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T19:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: AarFindingRecord): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: "aar-artifact-lineage-fixture-provider-v1",
    child_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-fixture-provider-v1"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-fixture-provider-seed"),
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    created_by_researcher_ref: sourceFinding.researcher_ref,
    created_at: "2026-05-11T19:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-fixture-provider-001",
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
    created_at: "2026-05-11T19:00:00.000Z",
    authority_status: "not_live"
  };
}
