import { describe, expect, it } from "vitest";
import type {
  EvaluationComparisonSetRecord,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  Ref,
  StageBindingRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("stage-bound evaluation domain records", () => {
  it("models a non-live backtest evaluation run for one candidate version", () => {
    const candidateRef = ref("trader_system_candidate", "candidate-btc-breakout");
    const candidateVersionRef = ref("candidate_version", "candidate-version-btc-breakout-v1");
    const stageBindingRef = ref("stage_binding", "stage-binding-backtest-v1");
    const traceRef = ref("trace_placeholder", "trace-backtest-evaluation-v1");
    const runtimePlacementRef = ref("runtime_placement", "runtime-placement-host-local");
    const handsEnvironmentRef = ref("hands_environment", "hands-environment-fixture");
    const evaluatorRef = ref("evaluation_provider", "deterministic-backtest-fixture");

    const stageBinding = {
      record_kind: "stage_binding",
      version: 1,
      stage_binding_id: "stage-binding-backtest-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      runtime_placement_ref: runtimePlacementRef,
      hands_environment_ref: handsEnvironmentRef,
      data_window_ref: ref("backtest_data_window", "btc-perp-2026-01"),
      simulator_ref: ref("backtest_simulator", "fixture-simulator-v1"),
      created_at: "2026-05-05T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies StageBindingRecord;

    const evaluationRun = {
      record_kind: "evaluation_run_record",
      version: 1,
      evaluation_run_record_id: "evaluation-run-backtest-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: traceRef,
      evaluator_ref: evaluatorRef,
      status: "succeeded",
      created_at: "2026-05-05T00:00:30.000Z",
      started_at: "2026-05-05T00:01:00.000Z",
      completed_at: "2026-05-05T00:03:00.000Z",
      authority_status: "not_counted"
    } satisfies EvaluationRunRecord;

    const comparisonSet = {
      record_kind: "evaluation_comparison_set",
      version: 1,
      evaluation_comparison_set_id: "evaluation-comparison-set-backtest-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      comparability_status: "comparable",
      comparability_reason: "single_backtest_run",
      created_at: "2026-05-05T00:03:30.000Z",
      authority_status: "not_counted"
    } satisfies EvaluationComparisonSetRecord;

    const sealingDecision = {
      record_kind: "evidence_sealing_decision",
      version: 1,
      evidence_sealing_decision_id: "evidence-sealing-decision-backtest-v1",
      evaluation_comparison_set_ref: ref(
        "evaluation_comparison_set",
        comparisonSet.evaluation_comparison_set_id
      ),
      evaluation_run_refs: [ref("evaluation_run_record", evaluationRun.evaluation_run_record_id)],
      evidence_disposition: "not_counted",
      disposition_reason: "fixture_only",
      created_at: "2026-05-05T00:04:00.000Z",
      sealed_at: "2026-05-05T00:04:00.000Z",
      authority_status: "not_counted"
    } satisfies EvidenceSealingDecisionRecord;

    expect(stageBinding.candidate_version_ref).toEqual(candidateVersionRef);
    expect(evaluationRun.stage_binding_ref).toEqual(stageBindingRef);
    expect(evaluationRun.trace_ref).toEqual(traceRef);
    expect(comparisonSet.evaluation_run_refs).toHaveLength(1);
    expect(sealingDecision.evidence_disposition).toBe("not_counted");
    expect(sealingDecision.authority_status).not.toBe("counted");
  });
});
