import { describe, expect, it } from "vitest";
import type {
  Ref,
  SandboxRuntimeInstanceRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import {
  evaluateRuntimeArtifactForAar,
  runtimeTraceRefsFor
} from "../src/aar-evaluation/runtime-artifact-submission";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("runtime artifact AAR evaluation submission", () => {
  it("links SDX/SBX runtime output as trace material while using sealed evaluator output for results", () => {
    const runtimeInstance = sandboxRuntimeInstance();
    const task = btcPerpEvaluationTask();

    const outcome = evaluateRuntimeArtifactForAar({
      runtime_instance: runtimeInstance,
      researcher_ref: ref("aar_researcher", "aar-researcher-btc-trend-001"),
      research_direction_ref: ref("aar_research_direction", "aar-direction-btc-trend-v1"),
      task,
      experiment_id: "aar-experiment-runtime-clock-001",
      submitted_at: "2026-05-11T12:00:00.000Z",
      scenario: "accepted_oos_survives_costs"
    });

    expect(outcome.experiment).toMatchObject({
      record_kind: "aar_experiment",
      aar_experiment_id: "aar-experiment-runtime-clock-001",
      runnable_artifact_ref: runtimeInstance.runnable_artifact_ref,
      sandbox_runtime_instance_ref: ref(
        "sandbox_runtime_instance",
        runtimeInstance.sandbox_runtime_instance_id
      ),
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      status: "evaluated",
      authority_status: "not_live"
    });
    expect(outcome.runtime_trace_refs).toEqual([
      ref("trace_placeholder", "trace-runtime-self-report-clock-001"),
      ref("runtime_instance_log", "runtime-log-clock-001"),
      ref("runtime_heartbeat", "runtime-heartbeat-clock-001"),
      ref("sandbox_command_evidence", "sandbox-command-evidence-clock-001")
    ]);
    expect(outcome.experiment.runtime_trace_refs).toEqual(outcome.runtime_trace_refs);
    expect(outcome.evaluation_result).toMatchObject({
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1")
    });
    expect(outcome.evaluation_result.evaluator_trace_ref).not.toEqual(outcome.experiment.trace_ref);
  });

  it("keeps runtime trace self-report from becoming counted evidence", () => {
    const runtimeInstance = sandboxRuntimeInstance({
      runnableArtifactId: "aar-runnable-artifact-btc-lookahead-leakage-001"
    });
    const outcome = evaluateRuntimeArtifactForAar({
      runtime_instance: runtimeInstance,
      researcher_ref: ref("aar_researcher", "aar-researcher-btc-leakage-001"),
      research_direction_ref: ref("aar_research_direction", "aar-direction-btc-leakage-v1"),
      task: btcPerpEvaluationTask(),
      submitted_at: "2026-05-11T12:01:00.000Z"
    });

    expect(outcome.evaluation_result.result_status).toBe("disqualified");
    expect(outcome.evaluation_result.disqualification_reason).toBe("lookahead_leakage");
    expect(outcome.evaluation_result.evidence_disposition).toBe("quarantined_for_review");
    expect(outcome.evaluation_result.authority_status).toBe("not_counted");
    expect(outcome.runtime_trace_refs.map((traceRef) => traceRef.record_kind)).toContain("runtime_instance_log");
    expect(outcome.evaluation_result.metric_refs.map((metricRef) => metricRef.record_kind)).toEqual([
      "metric_snapshot"
    ]);
  });
});

function sandboxRuntimeInstance(options: { runnableArtifactId?: string } = {}): SandboxRuntimeInstanceRecord {
  return {
    record_kind: "sandbox_runtime_instance",
    version: 1,
    sandbox_runtime_instance_id: "sandbox-runtime-instance-clock-001",
    adapter_kind: "docker_sandboxes_sbx",
    runnable_artifact_ref: ref(
      "runnable_artifact",
      options.runnableArtifactId ?? "aar-runnable-artifact-btc-accepted-001"
    ),
    runtime_ref: ref("trader_system_runtime", "runtime-clock-paper-v1"),
    runtime_placement_ref: ref("runtime_placement", "runtime-placement-sdx-clock-v1"),
    lifecycle_status: "running",
    sandbox_name: "ouro-s6-clock-001",
    sandbox_ref: ref("docker_sandbox", "ouro-s6-clock-001"),
    created_at: "2026-05-11T11:59:00.000Z",
    started_at: "2026-05-11T11:59:01.000Z",
    last_heartbeat_at: "2026-05-11T11:59:02.000Z",
    log_refs: [ref("runtime_instance_log", "runtime-log-clock-001")],
    heartbeat_refs: [ref("runtime_heartbeat", "runtime-heartbeat-clock-001")],
    command_evidence_refs: [ref("sandbox_command_evidence", "sandbox-command-evidence-clock-001")],
    trace_ref: ref("trace_placeholder", "trace-runtime-self-report-clock-001"),
    authority_status: "not_live"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-runtime-submission-001",
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
    created_at: "2026-05-11T11:58:00.000Z",
    authority_status: "not_live"
  };
}

if (false) {
  const refs = runtimeTraceRefsFor(sandboxRuntimeInstance());
  void refs;
}
