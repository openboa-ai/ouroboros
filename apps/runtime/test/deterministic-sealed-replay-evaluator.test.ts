import { describe, expect, it } from "vitest";
import type {
  ExperimentRunRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { DeterministicSealedReplayEvaluator } from "../src/research-evaluation/deterministic-sealed-replay-evaluator";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("DeterministicSealedReplayEvaluator", () => {
  it("returns accepted non-counted external evaluation results for robust fixture submissions", () => {
    const evaluator = new DeterministicSealedReplayEvaluator();
    const task = fixtureTradingEvaluationTask();
    const experiment = researchExperiment("experiment-run-accepted", "research-system-code-market-accepted-001", task);

    const result = evaluator.evaluate({
      experiment,
      task,
      completed_at: "2026-05-11T11:00:00.000Z"
    });

    expect(result).toMatchObject({
      record_kind: "trading_evaluation_result",
      trading_evaluation_result_id: "trading-evaluation-result-experiment-run-accepted",
      experiment_run_ref: ref("experiment_run", experiment.experiment_run_id),
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
    expect(result.evaluator_trace_ref.id).toBe("trace-sealed-replay-experiment-run-accepted");
    expect(result.evaluator_trace_ref).not.toEqual(experiment.trace_ref);
    expect(result.metric_refs.map((metric) => metric.id)).toEqual([
      "metric-experiment-run-accepted-oos",
      "metric-experiment-run-accepted-cost-survival",
      "metric-experiment-run-accepted-drawdown"
    ]);
    expect(result.score_summary.total_score).toBeGreaterThan(result.score_summary.complexity_penalty);
  });

  it("covers quarantined and disqualified fixture outcomes without counting evidence", () => {
    const evaluator = new DeterministicSealedReplayEvaluator();
    const task = fixtureTradingEvaluationTask();
    const quarantined = evaluator.evaluate({
      experiment: researchExperiment("experiment-run-unstable", "research-system-code-market-unstable-001", task),
      task,
      completed_at: "2026-05-11T11:00:01.000Z"
    });
    const disqualified = evaluator.evaluate({
      experiment: researchExperiment("experiment-run-leakage", "research-system-code-market-lookahead-leakage-001", task),
      task,
      completed_at: "2026-05-11T11:00:02.000Z"
    });

    expect(quarantined).toMatchObject({
      result_status: "quarantined_for_review",
      evidence_disposition: "quarantined_for_review",
      quarantine_reason: "metric_instability",
      authority_status: "not_counted"
    });
    expect(disqualified).toMatchObject({
      result_status: "disqualified",
      evidence_disposition: "quarantined_for_review",
      disqualification_reason: "lookahead_leakage",
      quarantine_reason: "manual_review_required",
      authority_status: "not_counted"
    });
    expect(disqualified.score_summary.total_score).toBe(0);
  });

  it("requires submissions to match the sealed generic trading backtest task", () => {
    const evaluator = new DeterministicSealedReplayEvaluator();
    const task = fixtureTradingEvaluationTask();
    const experiment = researchExperiment("experiment-run-task-mismatch", "research-system-code-market-accepted-001", {
      ...task,
      trading_evaluation_task_id: "different-task"
    });

    expect(() => evaluator.evaluate({ experiment, task })).toThrow("experiment_task_mismatch");
  });
});

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-fixture-001",
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
    created_at: "2026-05-11T10:30:00.000Z",
    authority_status: "not_live"
  };
}

function researchExperiment(
  experimentId: string,
  systemCodeId: string,
  task: TradingEvaluationTaskRecord
): ExperimentRunRecord {
  return {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: experimentId,
    research_worker_ref: ref("research_worker", "research-worker-fixture"),
    research_direction_ref: ref("research_direction", "research-direction-fixture"),
    system_code_ref: ref("system_code", systemCodeId),
    trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
    sandbox_ref: ref("sandbox", `sandbox-${experimentId}`),
    trace_ref: ref("trace_placeholder", `runtime-self-report-trace-${experimentId}`),
    submitted_at: "2026-05-11T10:31:00.000Z",
    status: "submitted",
    authority_status: "not_live"
  };
}

it("keeps sealed evaluator evidence input boundaries checked", () => {
  const evaluator = new DeterministicSealedReplayEvaluator();
  const task = fixtureTradingEvaluationTask();
  const experiment = researchExperiment("invalid-runtime-self-report", "artifact", task);

  evaluator.evaluate({
    experiment,
    task,
    // @ts-expect-error sealed evaluator submissions do not accept runtime-local self-report logs as evidence.
    runtime_log_lines: ["claimed pnl is high"]
  });
});
