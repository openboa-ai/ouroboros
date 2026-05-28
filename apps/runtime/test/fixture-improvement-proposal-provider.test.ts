import { describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  ImprovementProposalProviderRequest,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { FixtureImprovementProposalProviderAdapter } from "@ouroboros/application/research/orchestration/fixture-improvement-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("FixtureImprovementProposalProviderAdapter", () => {
  it("wraps the deterministic planner behind the improvement proposal provider adapter", async () => {
    const adapter = new FixtureImprovementProposalProviderAdapter();
    const request = validRequest();

    await expect(adapter.probeImprovementProposal()).resolves.toMatchObject({
      provider_kind: "fixture_only",
      readiness_status: "active_verified",
      supported_purposes: ["improvement_proposal_generation"]
    });

    const result = await adapter.runImprovementProposalGeneration(request);

    expect(result).toMatchObject({
      status: "succeeded",
      provider: {
        provider_kind: "fixture_only",
        model: "deterministic-improvement-proposal-planner-fixture"
      },
      output: {
        output_kind: "improvement_proposal_input",
        source_finding_refs: [ref("research_finding", "research-finding-fixture-provider-next-001")],
        anti_hacking_finding_refs: [
          ref("research_finding", "research-finding-fixture-provider-anti-001")
        ],
        parent_system_code_ref: ref("system_code", "research-system-code-fixture-provider-v1"),
        output_authority_status: "proposal_input_only"
      },
      trace_ref: request.trace_ref,
      authority_status: "proposal_input_only"
    });
    expect(JSON.stringify(result)).not.toMatch(
      /improvement_proposal_id|strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
  });

  it("maps deterministic planner failures to adapter failures", async () => {
    const adapter = new FixtureImprovementProposalProviderAdapter();
    const result = await adapter.runImprovementProposalGeneration({
      ...validRequest(),
      findings: [researchFinding("research-finding-fixture-provider-anti-only", "anti_hacking_case")]
    });

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "no_eligible_research_finding",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
  });
});

function validRequest(): ImprovementProposalProviderRequest {
  const sourceFinding = researchFinding("research-finding-fixture-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = researchFinding("research-finding-fixture-provider-anti-001", "anti_hacking_case");
  return {
    idempotency_key: "fixture-improvement-proposal-provider",
    task: fixtureTradingEvaluationTask(),
    findings: [sourceFinding, antiHackingFinding],
    existing_lineages: [artifactLineage(sourceFinding)],
    existing_lineage_refs: [ref("artifact_lineage", "artifact-lineage-fixture-provider-v1")],
    input_artifact_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    agent_run_ref: ref("agent_run", "agent-run-fixture-improvement-proposal-provider"),
    trace_ref: ref("trace_placeholder", "trace-fixture-improvement-proposal-provider"),
    created_at: "2026-05-11T19:00:00.000Z"
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
    research_worker_ref: ref("research_worker", "research-worker-fixture-provider-001"),
    research_direction_ref: ref("research_direction", "research-direction-fixture-provider-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-fixture-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-fixture-provider-001"),
    finding_kind: findingKind,
    summary: `Fixture provider ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T19:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: ResearchFindingRecord): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-fixture-provider-v1",
    child_system_code_ref: ref("system_code", "research-system-code-fixture-provider-v1"),
    parent_system_code_ref: ref("system_code", "research-system-code-fixture-provider-seed"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: "2026-05-11T19:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-fixture-provider-001",
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
    created_at: "2026-05-11T19:00:00.000Z",
    authority_status: "not_live"
  };
}
