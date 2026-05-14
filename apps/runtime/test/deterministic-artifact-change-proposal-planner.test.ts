import { describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { DeterministicArtifactChangeProposalPlanner } from "../src/research-orchestration/deterministic-proposal-planner";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("deterministic artifact change proposal planner", () => {
  it("proposes the next opaque artifact from eligible findings and anti-hacking constraints", () => {
    const planner = new DeterministicArtifactChangeProposalPlanner();
    const sourceFinding = researchFinding({
      id: "research-finding-market-trend-cost-survival-001",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T15:00:00.000Z"
    });
    const antiHackingFinding = researchFinding({
      id: "research-finding-market-lookahead-leakage-001",
      findingKind: "anti_hacking_case",
      createdAt: "2026-05-11T15:00:01.000Z"
    });
    const lineage = artifactLineage(sourceFinding);

    const outcome = planner.plan({
      task: fixtureTradingEvaluationTask(),
      findings: [antiHackingFinding, sourceFinding],
      existing_lineages: [lineage],
      idempotency_key: "planner-test-stable",
      created_at: "2026-05-11T15:01:00.000Z"
    });

    expect(outcome.source_finding).toEqual(sourceFinding);
    expect(outcome.anti_hacking_findings).toEqual([antiHackingFinding]);
    expect(outcome.proposal).toMatchObject({
      record_kind: "artifact_change_proposal",
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      source_finding_refs: [{ record_kind: "research_finding", id: sourceFinding.research_finding_id }],
      anti_hacking_finding_refs: [{ record_kind: "research_finding", id: antiHackingFinding.research_finding_id }],
      parent_runnable_artifact_ref: lineage.child_runnable_artifact_ref,
      status: "proposed",
      authority_status: "proposal_only"
    });
    expect(outcome.runnable_artifact).toMatchObject({
      record_kind: "runnable_artifact",
      artifact_kind: "python_file",
      artifact_path: "fixtures/trading-systems/clock.py",
      runtime_kind: "python",
      status: "registered",
      authority_status: "not_live"
    });
    expect(outcome.runnable_artifact.provenance_refs).toEqual([
      { record_kind: "artifact_change_proposal", id: outcome.proposal.artifact_change_proposal_id },
      { record_kind: "research_finding", id: sourceFinding.research_finding_id }
    ]);
    expect(outcome.lineage).toMatchObject({
      child_runnable_artifact_ref: outcome.proposal.proposed_runnable_artifact_ref,
      parent_runnable_artifact_ref: lineage.child_runnable_artifact_ref,
      source_finding_refs: [{ record_kind: "research_finding", id: sourceFinding.research_finding_id }],
      authority_status: "lineage_only"
    });
    expect(outcome.run).toMatchObject({
      input_finding_refs: [
        { record_kind: "research_finding", id: sourceFinding.research_finding_id },
        { record_kind: "research_finding", id: antiHackingFinding.research_finding_id }
      ],
      input_lineage_refs: [{ record_kind: "artifact_lineage", id: lineage.artifact_lineage_id }],
      output_artifact_proposal_ref: {
        record_kind: "artifact_change_proposal",
        id: outcome.proposal.artifact_change_proposal_id
      },
      output_runnable_artifact_ref: outcome.proposal.proposed_runnable_artifact_ref,
      output_lineage_ref: { record_kind: "artifact_lineage", id: outcome.lineage.artifact_lineage_id },
      status: "proposed",
      authority_status: "research_only"
    });

    const recordSurface = JSON.stringify(outcome);
    expect(recordSurface).toContain("Preserve anti-hacking constraints");
    expect(recordSurface).not.toMatch(
      /strategy_internals|strategy_schema|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("is stable for the same idempotency key", () => {
    const planner = new DeterministicArtifactChangeProposalPlanner();
    const input = {
      task: fixtureTradingEvaluationTask(),
      findings: [
        researchFinding({
          id: "research-finding-market-trend-positive-001",
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
    const planner = new DeterministicArtifactChangeProposalPlanner();

    expect(() =>
      planner.plan({
        task: fixtureTradingEvaluationTask(),
        findings: [
          researchFinding({
            id: "research-finding-market-lookahead-only",
            findingKind: "anti_hacking_case",
            createdAt: "2026-05-11T15:04:00.000Z"
          })
        ],
        idempotency_key: "no-source"
      })
    ).toThrow("no_eligible_research_finding");
    expect(() =>
      planner.plan({
        task: {
          ...fixtureTradingEvaluationTask(),
          market_scope: "unsupported_external_trading_fixture" as "external_trading_api_fixture"
        },
        findings: [
          researchFinding({
            id: "research-finding-market-positive",
            findingKind: "positive_result",
            createdAt: "2026-05-11T15:05:00.000Z"
          })
        ]
      })
    ).toThrow("unsupported_market_scope");
  });
});

function researchFinding(input: {
  id: string;
  findingKind: ResearchFindingRecord["finding_kind"];
  createdAt: string;
}): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: input.id,
    research_worker_ref: ref("research_worker", "research-worker-market-trend-001"),
    research_direction_ref: ref("research_direction", "research-direction-market-trend-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-market-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-market-trend-001"),
    finding_kind: input.findingKind,
    summary: `Fixture ${input.findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${input.id}-metric`)],
    created_at: input.createdAt,
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: ResearchFindingRecord): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-market-trend-v1",
    child_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-trend-v1"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-seed-v1"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: "2026-05-11T15:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-planner-001",
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
    created_at: "2026-05-11T15:00:00.000Z",
    authority_status: "not_live"
  };
}
