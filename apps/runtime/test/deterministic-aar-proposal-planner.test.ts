import { describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarFindingRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { DeterministicAarProposalPlanner } from "../src/aar-orchestration/deterministic-proposal-planner";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("deterministic AAR proposal planner", () => {
  it("proposes the next opaque artifact from eligible findings and anti-hacking constraints", () => {
    const planner = new DeterministicAarProposalPlanner();
    const sourceFinding = aarFinding({
      id: "aar-finding-btc-trend-cost-survival-001",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T15:00:00.000Z"
    });
    const antiHackingFinding = aarFinding({
      id: "aar-finding-btc-lookahead-leakage-001",
      findingKind: "anti_hacking_case",
      createdAt: "2026-05-11T15:00:01.000Z"
    });
    const lineage = artifactLineage(sourceFinding);

    const outcome = planner.plan({
      task: btcPerpEvaluationTask(),
      findings: [antiHackingFinding, sourceFinding],
      existing_lineages: [lineage],
      idempotency_key: "planner-test-stable",
      created_at: "2026-05-11T15:01:00.000Z"
    });

    expect(outcome.source_finding).toEqual(sourceFinding);
    expect(outcome.anti_hacking_findings).toEqual([antiHackingFinding]);
    expect(outcome.proposal).toMatchObject({
      record_kind: "aar_artifact_proposal",
      researcher_ref: sourceFinding.researcher_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      source_finding_refs: [{ record_kind: "aar_finding", id: sourceFinding.aar_finding_id }],
      anti_hacking_finding_refs: [{ record_kind: "aar_finding", id: antiHackingFinding.aar_finding_id }],
      parent_runnable_artifact_ref: lineage.child_runnable_artifact_ref,
      status: "proposed",
      authority_status: "proposal_only"
    });
    expect(outcome.runnable_artifact).toMatchObject({
      record_kind: "runnable_artifact",
      artifact_kind: "python_file",
      artifact_path: "fixtures/trader-systems/clock.py",
      runtime_kind: "python",
      status: "registered",
      authority_status: "not_live"
    });
    expect(outcome.runnable_artifact.provenance_refs).toEqual([
      { record_kind: "aar_artifact_proposal", id: outcome.proposal.aar_artifact_proposal_id },
      { record_kind: "aar_finding", id: sourceFinding.aar_finding_id }
    ]);
    expect(outcome.lineage).toMatchObject({
      child_runnable_artifact_ref: outcome.proposal.proposed_runnable_artifact_ref,
      parent_runnable_artifact_ref: lineage.child_runnable_artifact_ref,
      source_finding_refs: [{ record_kind: "aar_finding", id: sourceFinding.aar_finding_id }],
      authority_status: "lineage_only"
    });
    expect(outcome.run).toMatchObject({
      input_finding_refs: [
        { record_kind: "aar_finding", id: sourceFinding.aar_finding_id },
        { record_kind: "aar_finding", id: antiHackingFinding.aar_finding_id }
      ],
      input_lineage_refs: [{ record_kind: "aar_artifact_lineage", id: lineage.aar_artifact_lineage_id }],
      output_artifact_proposal_ref: {
        record_kind: "aar_artifact_proposal",
        id: outcome.proposal.aar_artifact_proposal_id
      },
      output_runnable_artifact_ref: outcome.proposal.proposed_runnable_artifact_ref,
      output_lineage_ref: { record_kind: "aar_artifact_lineage", id: outcome.lineage.aar_artifact_lineage_id },
      status: "proposed",
      authority_status: "research_only"
    });

    const recordSurface = JSON.stringify(outcome);
    expect(recordSurface).toContain("Preserve anti-hacking constraints");
    expect(recordSurface).not.toMatch(
      /strategy_internals|strategy_schema|binance_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("is stable for the same idempotency key", () => {
    const planner = new DeterministicAarProposalPlanner();
    const input = {
      task: btcPerpEvaluationTask(),
      findings: [
        aarFinding({
          id: "aar-finding-btc-trend-positive-001",
          findingKind: "positive_result",
          createdAt: "2026-05-11T15:02:00.000Z"
        })
      ],
      idempotency_key: "same-input",
      created_at: "2026-05-11T15:03:00.000Z"
    };

    expect(planner.plan(input)).toEqual(planner.plan(input));
  });

  it("rejects missing eligible findings and unsupported task scope", () => {
    const planner = new DeterministicAarProposalPlanner();

    expect(() =>
      planner.plan({
        task: btcPerpEvaluationTask(),
        findings: [
          aarFinding({
            id: "aar-finding-btc-lookahead-only",
            findingKind: "anti_hacking_case",
            createdAt: "2026-05-11T15:04:00.000Z"
          })
        ],
        idempotency_key: "no-source"
      })
    ).toThrow("no_eligible_aar_finding");
    expect(() =>
      planner.plan({
        task: {
          ...btcPerpEvaluationTask(),
          market_scope: "eth_perpetual_futures" as "binance_btc_perpetual_futures"
        },
        findings: [
          aarFinding({
            id: "aar-finding-btc-positive",
            findingKind: "positive_result",
            createdAt: "2026-05-11T15:05:00.000Z"
          })
        ]
      })
    ).toThrow("unsupported_market_scope");
  });
});

function aarFinding(input: {
  id: string;
  findingKind: AarFindingRecord["finding_kind"];
  createdAt: string;
}): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: input.id,
    researcher_ref: ref("aar_researcher", "aar-researcher-btc-trend-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-btc-trend-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-btc-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-btc-trend-001"),
    finding_kind: input.findingKind,
    summary: `Fixture ${input.findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${input.id}-metric`)],
    created_at: input.createdAt,
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: AarFindingRecord): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: "aar-artifact-lineage-btc-trend-v1",
    child_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-v1"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-seed-v1"),
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    created_by_researcher_ref: sourceFinding.researcher_ref,
    created_at: "2026-05-11T15:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-planner-001",
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
    created_at: "2026-05-11T15:00:00.000Z",
    authority_status: "not_live"
  };
}
