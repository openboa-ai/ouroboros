import { describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ArtifactChangeProposalRecord,
  ResearchFindingRecord,
  ResearchOrchestrationRunRecord,
  Ref,
  RunnableArtifactRecord,
  TradingEvaluationTaskRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("automated research orchestration proposal contracts", () => {
  it("models a proposal run from shared finding to next opaque runnable artifact", () => {
    const task = fixtureTradingEvaluationTask();
    const sourceFinding = researchFinding("research-finding-market-trend-cost-survival-001", "next_artifact_hint");
    const antiHackingFinding = researchFinding("research-finding-market-lookahead-leakage-001", "anti_hacking_case");
    const proposal = artifactProposal({
      sourceFinding,
      antiHackingFinding,
      task
    });
    const run = orchestrationRun({
      sourceFinding,
      antiHackingFinding,
      proposal,
      task
    });
    const artifact = proposedRunnableArtifact(proposal, sourceFinding);
    const lineage = artifactLineage(sourceFinding, proposal);

    expect(proposal).toMatchObject({
      record_kind: "artifact_change_proposal",
      proposed_runnable_artifact_ref: ref("runnable_artifact", artifact.runnable_artifact_id),
      parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-trend-python-001"),
      source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
      anti_hacking_finding_refs: [ref("research_finding", antiHackingFinding.research_finding_id)],
      status: "proposed",
      authority_status: "proposal_only"
    });
    expect(run).toMatchObject({
      record_kind: "research_orchestration_run",
      input_finding_refs: [
        ref("research_finding", sourceFinding.research_finding_id),
        ref("research_finding", antiHackingFinding.research_finding_id)
      ],
      output_artifact_proposal_ref: ref("artifact_change_proposal", proposal.artifact_change_proposal_id),
      output_runnable_artifact_ref: ref("runnable_artifact", artifact.runnable_artifact_id),
      output_lineage_ref: ref("artifact_lineage", lineage.artifact_lineage_id),
      status: "proposed",
      authority_status: "research_only"
    });
    expect(artifact.record_kind).toBe("runnable_artifact");
    expect(artifact.provenance_refs).toEqual([
      ref("artifact_change_proposal", proposal.artifact_change_proposal_id),
      ref("research_finding", sourceFinding.research_finding_id)
    ]);
    expect(lineage.source_finding_refs).toEqual([ref("research_finding", sourceFinding.research_finding_id)]);
    expect(JSON.stringify({ proposal, run, artifact, lineage })).not.toMatch(
      /strategy_internals|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/
    );
  });
});

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-orchestration-001",
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
    created_at: "2026-05-11T14:00:00.000Z",
    authority_status: "not_live"
  };
}

function researchFinding(findingId: string, findingKind: ResearchFindingRecord["finding_kind"]): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-market-trend-001"),
    research_direction_ref: ref("research_direction", "research-direction-market-trend-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-market-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-market-trend-001"),
    finding_kind: findingKind,
    summary: "Fixture finding for a next opaque artifact proposal.",
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T14:01:00.000Z",
    authority_status: "research_trace_only"
  };
}

function artifactProposal(input: {
  sourceFinding: ResearchFindingRecord;
  antiHackingFinding: ResearchFindingRecord;
  task: TradingEvaluationTaskRecord;
}): ArtifactChangeProposalRecord {
  return {
    record_kind: "artifact_change_proposal",
    version: 1,
    artifact_change_proposal_id: "artifact-change-proposal-market-trend-v2",
    research_worker_ref: input.sourceFinding.research_worker_ref,
    research_direction_ref: input.sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    proposed_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-trend-python-002"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-trend-python-001"),
    source_finding_refs: [ref("research_finding", input.sourceFinding.research_finding_id)],
    anti_hacking_finding_refs: [ref("research_finding", input.antiHackingFinding.research_finding_id)],
    proposal_summary: "Create the next opaque generic market trend artifact candidate from the accepted finding.",
    requested_change_summary: "Reduce drawdown pressure while preserving cost survival.",
    expected_improvement_summary: "Higher held-out stability under the same sealed evaluator.",
    created_at: "2026-05-11T14:02:00.000Z",
    status: "proposed",
    authority_status: "proposal_only"
  };
}

function orchestrationRun(input: {
  sourceFinding: ResearchFindingRecord;
  antiHackingFinding: ResearchFindingRecord;
  proposal: ArtifactChangeProposalRecord;
  task: TradingEvaluationTaskRecord;
}): ResearchOrchestrationRunRecord {
  return {
    record_kind: "research_orchestration_run",
    version: 1,
    research_orchestration_run_id: "research-orchestration-run-market-trend-v2",
    research_worker_ref: input.sourceFinding.research_worker_ref,
    research_direction_ref: input.sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    input_finding_refs: [
      ref("research_finding", input.sourceFinding.research_finding_id),
      ref("research_finding", input.antiHackingFinding.research_finding_id)
    ],
    input_lineage_refs: [ref("artifact_lineage", "artifact-lineage-market-trend-001")],
    output_artifact_proposal_ref: ref(
      "artifact_change_proposal",
      input.proposal.artifact_change_proposal_id
    ),
    output_runnable_artifact_ref: input.proposal.proposed_runnable_artifact_ref,
    output_lineage_ref: ref("artifact_lineage", "artifact-lineage-market-trend-001-to-002"),
    trace_ref: ref("trace_placeholder", "trace-research-orchestration-market-trend-v2"),
    started_at: "2026-05-11T14:02:00.000Z",
    completed_at: "2026-05-11T14:02:01.000Z",
    status: "proposed",
    authority_status: "research_only"
  };
}

function proposedRunnableArtifact(
  proposal: ArtifactChangeProposalRecord,
  sourceFinding: ResearchFindingRecord
): RunnableArtifactRecord {
  return {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: proposal.proposed_runnable_artifact_ref.id,
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:artifact-change-proposal-market-trend-python-002",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
    },
    secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
    capability_policy_ref: ref("capability_policy", "fixture-artifact-change-proposal"),
    artifact_runtime_contract_ref: ref("artifact_runtime_contract", "artifact-runtime-contract-python-clock-v1"),
    provenance_refs: [
      ref("artifact_change_proposal", proposal.artifact_change_proposal_id),
      ref("research_finding", sourceFinding.research_finding_id)
    ],
    status: "registered",
    created_at: "2026-05-11T14:02:00.000Z",
    authority_status: "not_live"
  };
}

function artifactLineage(
  sourceFinding: ResearchFindingRecord,
  proposal: ArtifactChangeProposalRecord
): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-market-trend-001-to-002",
    child_runnable_artifact_ref: proposal.proposed_runnable_artifact_ref,
    parent_runnable_artifact_ref: proposal.parent_runnable_artifact_ref,
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: "2026-05-11T14:02:00.000Z",
    authority_status: "lineage_only"
  };
}

if (false) {
  const _proposalWithStrategyInternals = {
    ...artifactProposal({
      sourceFinding: researchFinding("finding", "next_artifact_hint"),
      antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
      task: fixtureTradingEvaluationTask()
    }),
    // @ts-expect-error artifact change proposals must not normalize strategy internals.
    strategy_internals: { indicator: "rsi", lookback: 14 }
  } satisfies ArtifactChangeProposalRecord;

  const _proposalWithRawCredentials = {
    ...artifactProposal({
      sourceFinding: researchFinding("finding", "next_artifact_hint"),
      antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
      task: fixtureTradingEvaluationTask()
    }),
    // @ts-expect-error artifact change proposals must not carry ExternalTradingApiProvider credential material.
    venue_credentials: { api_key: "redacted", api_secret: "redacted" }
  } satisfies ArtifactChangeProposalRecord;

  const _proposalWithPaperAuthority = {
    ...artifactProposal({
      sourceFinding: researchFinding("finding", "next_artifact_hint"),
      antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
      task: fixtureTradingEvaluationTask()
    }),
    // @ts-expect-error artifact change proposals cannot authorize paper orders.
    paper_order_authority: true
  } satisfies ArtifactChangeProposalRecord;

  const _proposalWithCountedAuthority = {
    ...artifactProposal({
      sourceFinding: researchFinding("finding", "next_artifact_hint"),
      antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
      task: fixtureTradingEvaluationTask()
    }),
    // @ts-expect-error artifact change proposals are proposal-only, not counted evidence.
    authority_status: "counted"
  } satisfies ArtifactChangeProposalRecord;

  const _runWithPromotionAuthority = {
    ...orchestrationRun({
      sourceFinding: researchFinding("finding", "next_artifact_hint"),
      antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
      proposal: artifactProposal({
        sourceFinding: researchFinding("finding", "next_artifact_hint"),
        antiHackingFinding: researchFinding("anti-hacking", "anti_hacking_case"),
        task: fixtureTradingEvaluationTask()
      }),
      task: fixtureTradingEvaluationTask()
    }),
    // @ts-expect-error automated research orchestration runs cannot carry promotion decisions.
    promotion_decision_ref: ref("promotion_decision", "promotion")
  } satisfies ResearchOrchestrationRunRecord;

  void _proposalWithStrategyInternals;
  void _proposalWithRawCredentials;
  void _proposalWithPaperAuthority;
  void _proposalWithCountedAuthority;
  void _runWithPromotionAuthority;
}
