import { describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ExperimentRunRecord,
  ResearchFindingRecord,
  ResearchDirectionRecord,
  ResearchWorkerRecord,
  Ref,
  SystemCodeRecord,
  TradingEvaluationDisqualificationReason,
  TradingEvaluationResultRecord,
  TradingEvaluationTaskRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

const trendDirection = {
  record_kind: "research_direction",
  version: 1,
  research_direction_id: "research-direction-market-trend-v1",
  direction_kind: "trend_following",
  market_scope: "external_trading_api_fixture",
  prompt_seed: "Explore robust generic trading trend behavior without choosing a specific indicator upfront.",
  diversity_axis: "price-continuation",
  created_at: "2026-05-11T10:00:00.000Z",
  authority_status: "research_seed_only"
} satisfies ResearchDirectionRecord;

const fundingDirection = {
  record_kind: "research_direction",
  version: 1,
  research_direction_id: "research-direction-market-funding-risk-v1",
  direction_kind: "funding_aware_risk",
  market_scope: "external_trading_api_fixture",
  prompt_seed: "Explore whether funding and liquidation-aware risk constraints improve generic trading survivability.",
  diversity_axis: "carry-and-risk",
  created_at: "2026-05-11T10:00:01.000Z",
  authority_status: "research_seed_only"
} satisfies ResearchDirectionRecord;

const clockArtifactRef = ref("system_code", "fixture-system-code-clock-python-001");
const candidateArtifactRef = ref("system_code", "research-system-code-market-trend-python-001");

describe("generic trading automated research trading evaluation contracts", () => {
  it("models multiple research workers and opaque artifact experiments for one generic trading task", () => {
    const trendResearcher = {
      record_kind: "research_worker",
      version: 1,
      research_worker_id: "research-worker-market-trend-001",
      display_name: "generic market trend automated research",
      model: "claude-opus-researcher-fixture",
      provider_kind: "fixture_only",
      research_direction_ref: ref("research_direction", trendDirection.research_direction_id),
      sandbox_policy_ref: ref("sandbox_policy", "sandbox-policy-sdx-researcher-v1"),
      budget_policy_ref: ref("research_budget_policy", "budget-policy-fixture-v1"),
      created_at: "2026-05-11T10:01:00.000Z",
      status: "active",
      authority_status: "research_only"
    } satisfies ResearchWorkerRecord;

    const fundingResearcher = {
      record_kind: "research_worker",
      version: 1,
      research_worker_id: "research-worker-market-funding-001",
      display_name: "generic market funding-risk automated research",
      model: "claude-opus-researcher-fixture",
      provider_kind: "fixture_only",
      research_direction_ref: ref("research_direction", fundingDirection.research_direction_id),
      sandbox_policy_ref: ref("sandbox_policy", "sandbox-policy-sdx-researcher-v1"),
      budget_policy_ref: ref("research_budget_policy", "budget-policy-fixture-v1"),
      created_at: "2026-05-11T10:01:01.000Z",
      status: "active",
      authority_status: "research_only"
    } satisfies ResearchWorkerRecord;

    const evaluationTask = fixtureTradingEvaluationTask();

    const trendExperiment = {
      record_kind: "experiment_run",
      version: 1,
      experiment_run_id: "experiment-run-market-trend-001",
      research_worker_ref: ref("research_worker", trendResearcher.research_worker_id),
      research_direction_ref: trendResearcher.research_direction_ref,
      system_code_ref: candidateArtifactRef,
      trading_evaluation_task_ref: ref(
        "trading_evaluation_task",
        evaluationTask.trading_evaluation_task_id
      ),
      sandbox_ref: ref("sandbox", "sandbox-trend-001"),
      trace_ref: ref("trace_placeholder", "trace-experiment-run-market-trend-001"),
      submitted_at: "2026-05-11T10:02:00.000Z",
      status: "submitted",
      authority_status: "not_live"
    } satisfies ExperimentRunRecord;

    const fundingExperiment = {
      record_kind: "experiment_run",
      version: 1,
      experiment_run_id: "experiment-run-market-funding-001",
      research_worker_ref: ref("research_worker", fundingResearcher.research_worker_id),
      research_direction_ref: fundingResearcher.research_direction_ref,
      system_code_ref: clockArtifactRef,
      trading_evaluation_task_ref: ref(
        "trading_evaluation_task",
        evaluationTask.trading_evaluation_task_id
      ),
      sandbox_ref: ref("sandbox", "sandbox-funding-001"),
      trace_ref: ref("trace_placeholder", "trace-experiment-run-market-funding-001"),
      submitted_at: "2026-05-11T10:02:01.000Z",
      status: "submitted",
      authority_status: "not_live"
    } satisfies ExperimentRunRecord;

    expect(trendResearcher.research_direction_ref.id).not.toBe(fundingResearcher.research_direction_ref.id);
    expect(evaluationTask.market_scope).toBe("external_trading_api_fixture");
    expect(evaluationTask.stage).toBe("backtest");
    expect(trendExperiment.system_code_ref.record_kind).toBe("system_code");
    expect(fundingExperiment.system_code_ref.record_kind).toBe("system_code");
    expect(Object.keys(trendExperiment)).not.toContain("strategy_internals");
    expect(Object.keys(fundingExperiment)).not.toContain("strategy_internals");
  });

  it("records sealed evaluator outcomes separately from promotion evidence", () => {
    const task = fixtureTradingEvaluationTask();
    const acceptedExperimentRef = ref("experiment_run", "experiment-run-market-trend-001");
    const disqualifiedExperimentRef = ref("experiment_run", "experiment-run-market-funding-001");

    const acceptedResult = {
      record_kind: "trading_evaluation_result",
      version: 1,
      trading_evaluation_result_id: "trading-evaluation-result-market-trend-001",
      experiment_run_ref: acceptedExperimentRef,
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
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
        ref("metric_snapshot", "metric-market-trend-oos-v1"),
        ref("metric_snapshot", "metric-market-trend-drawdown-v1")
      ],
      evaluator_trace_ref: ref("trace_placeholder", "trace-sealed-evaluator-market-trend-001"),
      completed_at: "2026-05-11T10:03:00.000Z",
      authority_status: "not_counted"
    } satisfies TradingEvaluationResultRecord;

    const disqualifiedResult = {
      record_kind: "trading_evaluation_result",
      version: 1,
      trading_evaluation_result_id: "trading-evaluation-result-market-funding-001",
      experiment_run_ref: disqualifiedExperimentRef,
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
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
      evaluator_trace_ref: ref("trace_placeholder", "trace-sealed-evaluator-market-funding-001"),
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

  it("links automated research findings to next artifact lineage without creating live authority", () => {
    const finding = {
      record_kind: "research_finding",
      version: 1,
      research_finding_id: "research-finding-market-trend-cost-survival-001",
      research_worker_ref: ref("research_worker", "research-worker-market-trend-001"),
      research_direction_ref: ref("research_direction", trendDirection.research_direction_id),
      experiment_run_ref: ref("experiment_run", "experiment-run-market-trend-001"),
      trading_evaluation_result_ref: ref(
        "trading_evaluation_result",
        "trading-evaluation-result-market-trend-001"
      ),
      finding_kind: "next_artifact_hint",
      summary: "Cost survival improved in OOS windows, but drawdown pressure needs a smaller risk budget.",
      supporting_record_refs: [
        ref("metric_snapshot", "metric-market-trend-oos-v1"),
        ref("metric_snapshot", "metric-market-trend-drawdown-v1")
      ],
      created_at: "2026-05-11T10:04:00.000Z",
      authority_status: "research_trace_only"
    } satisfies ResearchFindingRecord;

    const lineage = {
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: "artifact-lineage-market-trend-001-to-002",
      parent_system_code_ref: candidateArtifactRef,
      child_system_code_ref: ref("system_code", "research-system-code-market-trend-python-002"),
      source_finding_refs: [ref("research_finding", finding.research_finding_id)],
      created_by_research_worker_ref: finding.research_worker_ref,
      created_at: "2026-05-11T10:05:00.000Z",
      authority_status: "lineage_only"
    } satisfies ArtifactLineageRecord;

    expect(finding.authority_status).toBe("research_trace_only");
    expect(lineage.source_finding_refs).toEqual([ref("research_finding", finding.research_finding_id)]);
    expect(lineage.parent_system_code_ref?.record_kind).toBe("system_code");
    expect(lineage.child_system_code_ref.record_kind).toBe("system_code");
    expect(Object.keys(lineage)).not.toContain("promotion_decision_ref");
    expect(Object.keys(lineage)).not.toContain("live_order_authority");
  });
});

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-walk-forward-001",
    market_scope: "external_trading_api_fixture",
    stage: "backtest",
    data_window_ref: ref("data_window", "sealed-replay-2024-2026-walk-forward-v1"),
    fee_model_ref: ref("fee_model", "external-api-replay-taker-maker-fees-v1"),
    funding_model_ref: ref("funding_model", "external-api-replay-funding-replay-v1"),
    slippage_model_ref: ref("slippage_model", "sealed-replay-liquidity-slippage-v1"),
    leverage_limit_ref: ref("leverage_limit", "sealed-replay-max-leverage-fixture-v1"),
    liquidation_model_ref: ref("liquidation_model", "sealed-replay-liquidation-fixture-v1"),
    heldout_policy_ref: ref("heldout_policy", "sealed-replay-walk-forward-oos-v1"),
    evaluation_policy_ref: ref("evaluation_policy", "sealed-replay-research-anti-hacking-v1"),
    evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
    created_at: "2026-05-11T10:02:00.000Z",
    authority_status: "not_live"
  };
}

if (false) {
  const _taskWithPaperAuthority = {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "invalid-paper-task",
    market_scope: "external_trading_api_fixture",
    // @ts-expect-error S6-01 evaluation contracts are backtest-only and carry no paper authority.
    stage: "paper",
    data_window_ref: ref("data_window", "sealed-replay-window"),
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
    ...fixtureTradingEvaluationTask(),
    // @ts-expect-error ExternalTradingApiProvider credentials or raw secret material must not enter evaluation tasks.
    venue_credentials: { api_key: "redacted", api_secret: "redacted" }
  } satisfies TradingEvaluationTaskRecord;

  const _experimentWithStrategyInternals = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "invalid-strategy-normalized-experiment",
    research_worker_ref: ref("research_worker", "researcher"),
    research_direction_ref: ref("research_direction", "direction"),
    system_code_ref: ref("system_code", "artifact"),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "task"),
    submitted_at: "2026-05-11T10:07:00.000Z",
    status: "submitted",
    authority_status: "not_live",
    // @ts-expect-error automated research experiments reference opaque artifacts, not normalized strategy internals.
    strategy_internals: { lookback_window: 14, indicator: "rsi" }
  } satisfies ExperimentRunRecord;

  const _experimentWithLiveAuthority = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "invalid-live-authority-experiment",
    research_worker_ref: ref("research_worker", "researcher"),
    research_direction_ref: ref("research_direction", "direction"),
    system_code_ref: ref("system_code", "artifact"),
    trading_evaluation_task_ref: ref("trading_evaluation_task", "task"),
    submitted_at: "2026-05-11T10:08:00.000Z",
    status: "submitted",
    authority_status: "not_live",
    // @ts-expect-error automated research experiments cannot carry live order authority.
    live_order_authority: true
  } satisfies ExperimentRunRecord;

  const _artifactWithNormalizedStrategy = {
    record_kind: "system_code",
    version: 1,
    system_code_id: "invalid-normalized-strategy-artifact",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:fixture",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trading-systems/clock.py"],
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
    // @ts-expect-error System code records remain opaque and cannot normalize strategy fields.
    moving_average_lookback: 50
  } satisfies SystemCodeRecord;

  void _taskWithPaperAuthority;
  void _taskWithRawSecrets;
  void _experimentWithStrategyInternals;
  void _experimentWithLiveAuthority;
  void _artifactWithNormalizedStrategy;
}
