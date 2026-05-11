import { describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarArtifactProposalRecord,
  AarFindingRecord,
  AarOrchestrationRunRecord,
  Ref,
  RunnableArtifactRecord,
  TradingEvaluationTaskRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("AAR orchestration proposal contracts", () => {
  it("models a proposal run from shared finding to next opaque runnable artifact", () => {
    const task = btcPerpEvaluationTask();
    const sourceFinding = aarFinding("aar-finding-btc-trend-cost-survival-001", "next_artifact_hint");
    const antiHackingFinding = aarFinding("aar-finding-btc-lookahead-leakage-001", "anti_hacking_case");
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
      record_kind: "aar_artifact_proposal",
      proposed_runnable_artifact_ref: ref("runnable_artifact", artifact.runnable_artifact_id),
      parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-python-001"),
      source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
      anti_hacking_finding_refs: [ref("aar_finding", antiHackingFinding.aar_finding_id)],
      status: "proposed",
      authority_status: "proposal_only"
    });
    expect(run).toMatchObject({
      record_kind: "aar_orchestration_run",
      input_finding_refs: [
        ref("aar_finding", sourceFinding.aar_finding_id),
        ref("aar_finding", antiHackingFinding.aar_finding_id)
      ],
      output_artifact_proposal_ref: ref("aar_artifact_proposal", proposal.aar_artifact_proposal_id),
      output_runnable_artifact_ref: ref("runnable_artifact", artifact.runnable_artifact_id),
      output_lineage_ref: ref("aar_artifact_lineage", lineage.aar_artifact_lineage_id),
      status: "proposed",
      authority_status: "research_only"
    });
    expect(artifact.record_kind).toBe("runnable_artifact");
    expect(artifact.provenance_refs).toEqual([
      ref("aar_artifact_proposal", proposal.aar_artifact_proposal_id),
      ref("aar_finding", sourceFinding.aar_finding_id)
    ]);
    expect(lineage.source_finding_refs).toEqual([ref("aar_finding", sourceFinding.aar_finding_id)]);
    expect(JSON.stringify({ proposal, run, artifact, lineage })).not.toMatch(
      /strategy_internals|binance_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/
    );
  });
});

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-orchestration-001",
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
    created_at: "2026-05-11T14:00:00.000Z",
    authority_status: "not_live"
  };
}

function aarFinding(findingId: string, findingKind: AarFindingRecord["finding_kind"]): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: findingId,
    researcher_ref: ref("aar_researcher", "aar-researcher-btc-trend-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-btc-trend-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-btc-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-btc-trend-001"),
    finding_kind: findingKind,
    summary: "Fixture finding for a next opaque artifact proposal.",
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T14:01:00.000Z",
    authority_status: "research_trace_only"
  };
}

function artifactProposal(input: {
  sourceFinding: AarFindingRecord;
  antiHackingFinding: AarFindingRecord;
  task: TradingEvaluationTaskRecord;
}): AarArtifactProposalRecord {
  return {
    record_kind: "aar_artifact_proposal",
    version: 1,
    aar_artifact_proposal_id: "aar-artifact-proposal-btc-trend-v2",
    researcher_ref: input.sourceFinding.researcher_ref,
    research_direction_ref: input.sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    proposed_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-python-002"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-python-001"),
    source_finding_refs: [ref("aar_finding", input.sourceFinding.aar_finding_id)],
    anti_hacking_finding_refs: [ref("aar_finding", input.antiHackingFinding.aar_finding_id)],
    proposal_summary: "Create the next opaque BTC trend artifact candidate from the accepted finding.",
    requested_change_summary: "Reduce drawdown pressure while preserving cost survival.",
    expected_improvement_summary: "Higher held-out stability under the same sealed evaluator.",
    created_at: "2026-05-11T14:02:00.000Z",
    status: "proposed",
    authority_status: "proposal_only"
  };
}

function orchestrationRun(input: {
  sourceFinding: AarFindingRecord;
  antiHackingFinding: AarFindingRecord;
  proposal: AarArtifactProposalRecord;
  task: TradingEvaluationTaskRecord;
}): AarOrchestrationRunRecord {
  return {
    record_kind: "aar_orchestration_run",
    version: 1,
    aar_orchestration_run_id: "aar-orchestration-run-btc-trend-v2",
    researcher_ref: input.sourceFinding.researcher_ref,
    research_direction_ref: input.sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    input_finding_refs: [
      ref("aar_finding", input.sourceFinding.aar_finding_id),
      ref("aar_finding", input.antiHackingFinding.aar_finding_id)
    ],
    input_lineage_refs: [ref("aar_artifact_lineage", "aar-artifact-lineage-btc-trend-001")],
    output_artifact_proposal_ref: ref(
      "aar_artifact_proposal",
      input.proposal.aar_artifact_proposal_id
    ),
    output_runnable_artifact_ref: input.proposal.proposed_runnable_artifact_ref,
    output_lineage_ref: ref("aar_artifact_lineage", "aar-artifact-lineage-btc-trend-001-to-002"),
    trace_ref: ref("trace_placeholder", "trace-aar-orchestration-btc-trend-v2"),
    started_at: "2026-05-11T14:02:00.000Z",
    completed_at: "2026-05-11T14:02:01.000Z",
    status: "proposed",
    authority_status: "research_only"
  };
}

function proposedRunnableArtifact(
  proposal: AarArtifactProposalRecord,
  sourceFinding: AarFindingRecord
): RunnableArtifactRecord {
  return {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: proposal.proposed_runnable_artifact_ref.id,
    artifact_kind: "python_file",
    artifact_path: "fixtures/trader-systems/clock.py",
    artifact_digest: "sha256:aar-proposal-btc-trend-python-002",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trader-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
    },
    secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
    capability_policy_ref: ref("capability_policy", "fixture-aar-proposal"),
    artifact_runtime_contract_ref: ref("artifact_runtime_contract", "artifact-runtime-contract-python-clock-v1"),
    provenance_refs: [
      ref("aar_artifact_proposal", proposal.aar_artifact_proposal_id),
      ref("aar_finding", sourceFinding.aar_finding_id)
    ],
    status: "registered",
    created_at: "2026-05-11T14:02:00.000Z",
    authority_status: "not_live"
  };
}

function artifactLineage(
  sourceFinding: AarFindingRecord,
  proposal: AarArtifactProposalRecord
): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: "aar-artifact-lineage-btc-trend-001-to-002",
    child_runnable_artifact_ref: proposal.proposed_runnable_artifact_ref,
    parent_runnable_artifact_ref: proposal.parent_runnable_artifact_ref,
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    created_by_researcher_ref: sourceFinding.researcher_ref,
    created_at: "2026-05-11T14:02:00.000Z",
    authority_status: "lineage_only"
  };
}

if (false) {
  const _proposalWithStrategyInternals = {
    ...artifactProposal({
      sourceFinding: aarFinding("finding", "next_artifact_hint"),
      antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
      task: btcPerpEvaluationTask()
    }),
    // @ts-expect-error AAR artifact proposals must not normalize strategy internals.
    strategy_internals: { indicator: "rsi", lookback: 14 }
  } satisfies AarArtifactProposalRecord;

  const _proposalWithRawCredentials = {
    ...artifactProposal({
      sourceFinding: aarFinding("finding", "next_artifact_hint"),
      antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
      task: btcPerpEvaluationTask()
    }),
    // @ts-expect-error AAR artifact proposals must not carry Binance credential material.
    binance_credentials: { api_key: "redacted", api_secret: "redacted" }
  } satisfies AarArtifactProposalRecord;

  const _proposalWithPaperAuthority = {
    ...artifactProposal({
      sourceFinding: aarFinding("finding", "next_artifact_hint"),
      antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
      task: btcPerpEvaluationTask()
    }),
    // @ts-expect-error AAR artifact proposals cannot authorize paper orders.
    paper_order_authority: true
  } satisfies AarArtifactProposalRecord;

  const _proposalWithCountedAuthority = {
    ...artifactProposal({
      sourceFinding: aarFinding("finding", "next_artifact_hint"),
      antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
      task: btcPerpEvaluationTask()
    }),
    // @ts-expect-error AAR artifact proposals are proposal-only, not counted evidence.
    authority_status: "counted"
  } satisfies AarArtifactProposalRecord;

  const _runWithPromotionAuthority = {
    ...orchestrationRun({
      sourceFinding: aarFinding("finding", "next_artifact_hint"),
      antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
      proposal: artifactProposal({
        sourceFinding: aarFinding("finding", "next_artifact_hint"),
        antiHackingFinding: aarFinding("anti-hacking", "anti_hacking_case"),
        task: btcPerpEvaluationTask()
      }),
      task: btcPerpEvaluationTask()
    }),
    // @ts-expect-error AAR orchestration runs cannot carry promotion decisions.
    promotion_decision_ref: ref("promotion_decision", "promotion")
  } satisfies AarOrchestrationRunRecord;

  void _proposalWithStrategyInternals;
  void _proposalWithRawCredentials;
  void _proposalWithPaperAuthority;
  void _proposalWithCountedAuthority;
  void _runWithPromotionAuthority;
}
