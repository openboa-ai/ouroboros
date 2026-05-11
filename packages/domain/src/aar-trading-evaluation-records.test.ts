import { describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarExperimentRecord,
  AarFindingRecord,
  AarResearchDirectionRecord,
  AarResearcherRecord,
  Ref,
  RunnableArtifactRecord,
  TradingEvaluationDisqualificationReason,
  TradingEvaluationResultRecord,
  TradingEvaluationTaskRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const trendDirection = {
  record_kind: "aar_research_direction",
  version: 1,
  aar_research_direction_id: "aar-direction-btc-trend-v1",
  direction_kind: "trend_following",
  market_scope: "binance_btc_perpetual_futures",
  prompt_seed: "Explore robust BTC perpetual trend behavior without choosing a specific indicator upfront.",
  diversity_axis: "price-continuation",
  created_at: "2026-05-11T10:00:00.000Z",
  authority_status: "research_seed_only"
} satisfies AarResearchDirectionRecord;

const fundingDirection = {
  record_kind: "aar_research_direction",
  version: 1,
  aar_research_direction_id: "aar-direction-btc-funding-risk-v1",
  direction_kind: "funding_aware_risk",
  market_scope: "binance_btc_perpetual_futures",
  prompt_seed: "Explore whether funding and liquidation-aware risk constraints improve BTC perpetual survivability.",
  diversity_axis: "carry-and-risk",
  created_at: "2026-05-11T10:00:01.000Z",
  authority_status: "research_seed_only"
} satisfies AarResearchDirectionRecord;

const clockArtifactRef = ref("runnable_artifact", "fixture-runnable-artifact-clock-python-001");
const candidateArtifactRef = ref("runnable_artifact", "aar-runnable-artifact-btc-trend-python-001");

describe("BTC perp AAR trading evaluation contracts", () => {
  it("models multiple AAR researchers and opaque artifact experiments for one BTC perp task", () => {
    const trendResearcher = {
      record_kind: "aar_researcher",
      version: 1,
      aar_researcher_id: "aar-researcher-btc-trend-001",
      display_name: "BTC trend AAR",
      model: "claude-opus-researcher-fixture",
      provider_kind: "fixture_only",
      research_direction_ref: ref("aar_research_direction", trendDirection.aar_research_direction_id),
      sandbox_policy_ref: ref("sandbox_policy", "sandbox-policy-sdx-researcher-v1"),
      budget_policy_ref: ref("research_budget_policy", "budget-policy-fixture-v1"),
      created_at: "2026-05-11T10:01:00.000Z",
      status: "active",
      authority_status: "research_only"
    } satisfies AarResearcherRecord;

    const fundingResearcher = {
      record_kind: "aar_researcher",
      version: 1,
      aar_researcher_id: "aar-researcher-btc-funding-001",
      display_name: "BTC funding-risk AAR",
      model: "claude-opus-researcher-fixture",
      provider_kind: "fixture_only",
      research_direction_ref: ref("aar_research_direction", fundingDirection.aar_research_direction_id),
      sandbox_policy_ref: ref("sandbox_policy", "sandbox-policy-sdx-researcher-v1"),
      budget_policy_ref: ref("research_budget_policy", "budget-policy-fixture-v1"),
      created_at: "2026-05-11T10:01:01.000Z",
      status: "active",
      authority_status: "research_only"
    } satisfies AarResearcherRecord;

    const evaluationTask = btcPerpEvaluationTask();

    const trendExperiment = {
      record_kind: "aar_experiment",
      version: 1,
      aar_experiment_id: "aar-experiment-btc-trend-001",
      researcher_ref: ref("aar_researcher", trendResearcher.aar_researcher_id),
      research_direction_ref: trendResearcher.research_direction_ref,
      runnable_artifact_ref: candidateArtifactRef,
      trading_evaluation_task_ref: ref(
        "trading_evaluation_task",
        evaluationTask.trading_evaluation_task_id
      ),
      sandbox_runtime_instance_ref: ref("sandbox_runtime_instance", "sandbox-runtime-instance-trend-001"),
      trace_ref: ref("trace_placeholder", "trace-aar-experiment-btc-trend-001"),
      submitted_at: "2026-05-11T10:02:00.000Z",
      status: "submitted",
      authority_status: "not_live"
    } satisfies AarExperimentRecord;

    const fundingExperiment = {
      record_kind: "aar_experiment",
      version: 1,
      aar_experiment_id: "aar-experiment-btc-funding-001",
      researcher_ref: ref("aar_researcher", fundingResearcher.aar_researcher_id),
      research_direction_ref: fundingResearcher.research_direction_ref,
      runnable_artifact_ref: clockArtifactRef,
      trading_evaluation_task_ref: ref(
        "trading_evaluation_task",
        evaluationTask.trading_evaluation_task_id
      ),
      sandbox_runtime_instance_ref: ref("sandbox_runtime_instance", "sandbox-runtime-instance-funding-001"),
      trace_ref: ref("trace_placeholder", "trace-aar-experiment-btc-funding-001"),
      submitted_at: "2026-05-11T10:02:01.000Z",
      status: "submitted",
      authority_status: "not_live"
    } satisfies AarExperimentRecord;

    expect(trendResearcher.research_direction_ref.id).not.toBe(fundingResearcher.research_direction_ref.id);
    expect(evaluationTask.market_scope).toBe("binance_btc_perpetual_futures");
    expect(evaluationTask.stage).toBe("backtest");
    expect(trendExperiment.runnable_artifact_ref.record_kind).toBe("runnable_artifact");
    expect(fundingExperiment.runnable_artifact_ref.record_kind).toBe("runnable_artifact");
    expect(Object.keys(trendExperiment)).not.toContain("strategy_internals");
    expect(Object.keys(fundingExperiment)).not.toContain("strategy_internals");
  });

  it("records sealed evaluator outcomes separately from promotion evidence", () => {
    const task = btcPerpEvaluationTask();
    const acceptedExperimentRef = ref("aar_experiment", "aar-experiment-btc-trend-001");
    const disqualifiedExperimentRef = ref("aar_experiment", "aar-experiment-btc-funding-001");

    const acceptedResult = {
      record_kind: "trading_evaluation_result",
      version: 1,
      trading_evaluation_result_id: "trading-evaluation-result-btc-trend-001",
      aar_experiment_ref: acceptedExperimentRef,
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
      result_status: "accepted",
      evidence_disposition: "not_counted",
      score_summary: {
        total_score: 0.71,
        oos_score: 0.76,
        drawdown_score: 0.68,
        turnover_score: 0.83,
        cost_survival_score: 0.65,
        reproducibility_score: 0.79,
        complexity_penalty: 0.12
      },
      metric_refs: [
        ref("metric_snapshot", "metric-btc-trend-oos-v1"),
        ref("metric_snapshot", "metric-btc-trend-drawdown-v1")
      ],
      evaluator_trace_ref: ref("trace_placeholder", "trace-sealed-evaluator-btc-trend-001"),
      completed_at: "2026-05-11T10:03:00.000Z",
      authority_status: "not_counted"
    } satisfies TradingEvaluationResultRecord;

    const disqualifiedResult = {
      record_kind: "trading_evaluation_result",
      version: 1,
      trading_evaluation_result_id: "trading-evaluation-result-btc-funding-001",
      aar_experiment_ref: disqualifiedExperimentRef,
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
      result_status: "disqualified",
      evidence_disposition: "quarantined_for_review",
      score_summary: {
        total_score: 0,
        oos_score: 0,
        drawdown_score: 0,
        turnover_score: 0,
        cost_survival_score: 0,
        reproducibility_score: 0,
        complexity_penalty: 1
      },
      metric_refs: [],
      evaluator_trace_ref: ref("trace_placeholder", "trace-sealed-evaluator-btc-funding-001"),
      disqualification_reason: "lookahead_leakage",
      quarantine_reason: "manual_review_required",
      completed_at: "2026-05-11T10:03:01.000Z",
      authority_status: "not_counted"
    } satisfies TradingEvaluationResultRecord;

    const disqualificationReasons = [
      "lookahead_leakage",
      "data_leakage",
      "survivorship_bias",
      "cost_model_bypass",
      "funding_ignored",
      "liquidation_ignored",
      "seed_cherry_pick",
      "oos_overfit",
      "unreproducible",
      "runtime_self_report_only"
    ] satisfies TradingEvaluationDisqualificationReason[];

    expect(acceptedResult.result_status).toBe("accepted");
    expect(acceptedResult.evidence_disposition).toBe("not_counted");
    expect(disqualifiedResult.result_status).toBe("disqualified");
    expect(disqualifiedResult.disqualification_reason).toBe("lookahead_leakage");
    expect(disqualificationReasons).toContain("runtime_self_report_only");
    expect(acceptedResult.score_summary.total_score).toBeGreaterThan(acceptedResult.score_summary.complexity_penalty);
  });

  it("links AAR findings to next artifact lineage without creating live authority", () => {
    const finding = {
      record_kind: "aar_finding",
      version: 1,
      aar_finding_id: "aar-finding-btc-trend-cost-survival-001",
      researcher_ref: ref("aar_researcher", "aar-researcher-btc-trend-001"),
      research_direction_ref: ref("aar_research_direction", trendDirection.aar_research_direction_id),
      aar_experiment_ref: ref("aar_experiment", "aar-experiment-btc-trend-001"),
      trading_evaluation_result_ref: ref(
        "trading_evaluation_result",
        "trading-evaluation-result-btc-trend-001"
      ),
      finding_kind: "next_artifact_hint",
      summary: "Cost survival improved in OOS windows, but drawdown pressure needs a smaller risk budget.",
      supporting_record_refs: [
        ref("metric_snapshot", "metric-btc-trend-oos-v1"),
        ref("metric_snapshot", "metric-btc-trend-drawdown-v1")
      ],
      created_at: "2026-05-11T10:04:00.000Z",
      authority_status: "research_trace_only"
    } satisfies AarFindingRecord;

    const lineage = {
      record_kind: "aar_artifact_lineage",
      version: 1,
      aar_artifact_lineage_id: "aar-artifact-lineage-btc-trend-001-to-002",
      parent_runnable_artifact_ref: candidateArtifactRef,
      child_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-python-002"),
      source_finding_refs: [ref("aar_finding", finding.aar_finding_id)],
      created_by_researcher_ref: finding.researcher_ref,
      created_at: "2026-05-11T10:05:00.000Z",
      authority_status: "lineage_only"
    } satisfies AarArtifactLineageRecord;

    expect(finding.authority_status).toBe("research_trace_only");
    expect(lineage.source_finding_refs).toEqual([ref("aar_finding", finding.aar_finding_id)]);
    expect(lineage.parent_runnable_artifact_ref?.record_kind).toBe("runnable_artifact");
    expect(lineage.child_runnable_artifact_ref.record_kind).toBe("runnable_artifact");
    expect(Object.keys(lineage)).not.toContain("promotion_decision_ref");
    expect(Object.keys(lineage)).not.toContain("live_order_authority");
  });
});

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-walk-forward-001",
    market_scope: "binance_btc_perpetual_futures",
    stage: "backtest",
    data_window_ref: ref("data_window", "btc-perp-2024-2026-walk-forward-v1"),
    fee_model_ref: ref("fee_model", "binance-btc-perp-taker-maker-fees-v1"),
    funding_model_ref: ref("funding_model", "binance-btc-perp-funding-replay-v1"),
    slippage_model_ref: ref("slippage_model", "btc-perp-liquidity-slippage-v1"),
    leverage_limit_ref: ref("leverage_limit", "btc-perp-max-leverage-fixture-v1"),
    liquidation_model_ref: ref("liquidation_model", "btc-perp-liquidation-fixture-v1"),
    heldout_policy_ref: ref("heldout_policy", "btc-perp-walk-forward-oos-v1"),
    evaluation_policy_ref: ref("evaluation_policy", "btc-perp-aar-anti-hacking-v1"),
    evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
    created_at: "2026-05-11T10:02:00.000Z",
    authority_status: "not_live"
  };
}

if (false) {
  const _taskWithPaperAuthority = {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "invalid-paper-task",
    market_scope: "binance_btc_perpetual_futures",
    // @ts-expect-error S6-01 evaluation contracts are backtest-only and carry no paper authority.
    stage: "paper",
    data_window_ref: ref("data_window", "btc-perp-window"),
    fee_model_ref: ref("fee_model", "fees"),
    funding_model_ref: ref("funding_model", "funding"),
    slippage_model_ref: ref("slippage_model", "slippage"),
    leverage_limit_ref: ref("leverage_limit", "leverage"),
    liquidation_model_ref: ref("liquidation_model", "liquidation"),
    heldout_policy_ref: ref("heldout_policy", "heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "policy"),
    created_at: "2026-05-11T10:06:00.000Z",
    authority_status: "not_live"
  } satisfies TradingEvaluationTaskRecord;

  const _taskWithRawSecrets = {
    ...btcPerpEvaluationTask(),
    // @ts-expect-error Binance credentials or raw secret material must not enter evaluation tasks.
    binance_credentials: { api_key: "redacted", api_secret: "redacted" }
  } satisfies TradingEvaluationTaskRecord;

  const _experimentWithStrategyInternals = {
    record_kind: "aar_experiment",
    version: 1,
    aar_experiment_id: "invalid-strategy-normalized-experiment",
    researcher_ref: ref("aar_researcher", "researcher"),
    research_direction_ref: ref("aar_research_direction", "direction"),
    runnable_artifact_ref: ref("runnable_artifact", "artifact"),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "task"),
    submitted_at: "2026-05-11T10:07:00.000Z",
    status: "submitted",
    authority_status: "not_live",
    // @ts-expect-error AAR experiments reference opaque artifacts, not normalized strategy internals.
    strategy_internals: { lookback_window: 14, indicator: "rsi" }
  } satisfies AarExperimentRecord;

  const _experimentWithLiveAuthority = {
    record_kind: "aar_experiment",
    version: 1,
    aar_experiment_id: "invalid-live-authority-experiment",
    researcher_ref: ref("aar_researcher", "researcher"),
    research_direction_ref: ref("aar_research_direction", "direction"),
    runnable_artifact_ref: ref("runnable_artifact", "artifact"),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "task"),
    submitted_at: "2026-05-11T10:08:00.000Z",
    status: "submitted",
    authority_status: "not_live",
    // @ts-expect-error AAR experiments cannot carry live order authority.
    live_order_authority: true
  } satisfies AarExperimentRecord;

  const _artifactWithNormalizedStrategy = {
    record_kind: "runnable_artifact",
    version: 1,
    runnable_artifact_id: "invalid-normalized-strategy-artifact",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trader-systems/clock.py",
    artifact_digest: "sha256:fixture",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trader-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat"]
    },
    secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
    capability_policy_ref: ref("capability_policy", "fixture"),
    provenance_refs: [],
    status: "registered",
    created_at: "2026-05-11T10:09:00.000Z",
    authority_status: "not_live",
    // @ts-expect-error Runnable artifacts remain opaque and cannot normalize strategy fields.
    moving_average_lookback: 50
  } satisfies RunnableArtifactRecord;

  void _taskWithPaperAuthority;
  void _taskWithRawSecrets;
  void _experimentWithStrategyInternals;
  void _experimentWithLiveAuthority;
  void _artifactWithNormalizedStrategy;
}
