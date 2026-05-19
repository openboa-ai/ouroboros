import { describe, expect, it } from "vitest";
import type {
  Ref,
  SandboxRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import {
  evaluateSystemCodeForResearch,
  runtimeTraceRefsFor
} from "../src/research-evaluation/system-code-research-submission";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("system code automated research evaluation submission", () => {
  it("links SDX/SBX runtime output as trace material while using sealed evaluator output for results", () => {
    const sandbox = sandboxSandbox();
    const task = fixtureTradingEvaluationTask();

    const outcome = evaluateSystemCodeForResearch({
      sandbox: sandbox,
      research_worker_ref: ref("research_worker", "research-worker-market-trend-001"),
      research_direction_ref: ref("research_direction", "research-direction-market-trend-v1"),
      task,
      experiment_id: "experiment-run-runtime-clock-001",
      submitted_at: "2026-05-11T12:00:00.000Z",
      scenario: "accepted_oos_survives_costs"
    });

    expect(outcome.experiment).toMatchObject({
      record_kind: "experiment_run",
      experiment_run_id: "experiment-run-runtime-clock-001",
      system_code_ref: sandbox.system_code_ref,
      sandbox_ref: ref(
        "sandbox",
        sandbox.sandbox_id
      ),
      trading_evaluation_task_ref: ref("trading_evaluation_task", task.trading_evaluation_task_id),
      status: "evaluated",
      authority_status: "not_live"
    });
    expect(outcome.runtime_trace_refs).toEqual([
      ref("trace_placeholder", "trace-runtime-self-report-clock-001"),
      ref("sandbox_log", "runtime-log-clock-001"),
      ref("runtime_heartbeat", "runtime-heartbeat-clock-001"),
      ref("sandbox_command_evidence", "sandbox-command-evidence-clock-001")
    ]);
    expect(outcome.experiment.runtime_trace_refs).toEqual(outcome.runtime_trace_refs);
    expect(outcome.evaluation_result).toMatchObject({
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1")
    });
    expect(outcome.evaluation_result.evaluator_trace_ref).not.toEqual(outcome.experiment.trace_ref);
  });

  it("keeps runtime trace self-report from becoming counted evidence", () => {
    const sandbox = sandboxSandbox({
      systemCodeId: "research-system-code-market-lookahead-leakage-001"
    });
    const outcome = evaluateSystemCodeForResearch({
      sandbox: sandbox,
      research_worker_ref: ref("research_worker", "research-worker-market-leakage-001"),
      research_direction_ref: ref("research_direction", "research-direction-market-leakage-v1"),
      task: fixtureTradingEvaluationTask(),
      submitted_at: "2026-05-11T12:01:00.000Z"
    });

    expect(outcome.evaluation_result.result_status).toBe("disqualified");
    expect(outcome.evaluation_result.disqualification_reason).toBe("lookahead_leakage");
    expect(outcome.evaluation_result.evidence_disposition).toBe("quarantined_for_review");
    expect(outcome.evaluation_result.authority_status).toBe("not_counted");
    expect(outcome.runtime_trace_refs.map((traceRef) => traceRef.record_kind)).toContain("sandbox_log");
    expect(outcome.evaluation_result.metric_refs.map((metricRef) => metricRef.record_kind)).toEqual([
      "metric_snapshot"
    ]);
  });
});

function sandboxSandbox(options: { systemCodeId?: string } = {}): SandboxRecord {
  return {
    record_kind: "sandbox",
    version: 1,
    sandbox_id: "sandbox-clock-001",
    adapter_kind: "docker_sandboxes_sbx",
    system_code_ref: ref(
      "system_code",
      options.systemCodeId ?? "research-system-code-market-accepted-001"
    ),
    runtime_ref: ref("trading_run", "runtime-clock-paper-v1"),
    sandbox_placement_ref: ref("sandbox_placement", "sandbox-placement-sdx-clock-v1"),
    lifecycle_status: "running",
    sandbox_name: "ouro-s6-clock-001",
    sandbox_ref: ref("docker_sandbox", "ouro-s6-clock-001"),
    created_at: "2026-05-11T11:59:00.000Z",
    started_at: "2026-05-11T11:59:01.000Z",
    last_heartbeat_at: "2026-05-11T11:59:02.000Z",
    log_refs: [ref("sandbox_log", "runtime-log-clock-001")],
    heartbeat_refs: [ref("runtime_heartbeat", "runtime-heartbeat-clock-001")],
    command_evidence_refs: [ref("sandbox_command_evidence", "sandbox-command-evidence-clock-001")],
    trace_ref: ref("trace_placeholder", "trace-runtime-self-report-clock-001"),
    authority_status: "not_live"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-runtime-submission-001",
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
    created_at: "2026-05-11T11:58:00.000Z",
    authority_status: "not_live"
  };
}

if (false) {
  const refs = runtimeTraceRefsFor(sandboxSandbox());
  void refs;
}
