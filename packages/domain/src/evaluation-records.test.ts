import { describe, expect, it } from "vitest";
import type {
  EvaluationComparisonSetRecord,
  EvidenceClassificationRecord,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  Ref,
  RuntimePlacementRecord,
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

  it("models physical runtime placement separately from runtime authority", () => {
    const hostLocalPlacement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-host-local",
      placement_kind: "host_local",
      tooling_kind: "host_process",
      service_name: "runtime",
      local_store_root: ".ouroboros/dev-store",
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    const containerizedLocalPlacement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-compose-local",
      placement_kind: "containerized_local",
      tooling_kind: "docker_compose",
      service_name: "runtime",
      compose_project: "ouroboros-local",
      local_store_root: "/data/ouroboros-store",
      network_ref: ref("network", "ouroboros-local"),
      volume_ref: ref("volume", "ouroboros-store"),
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    const containerizedRemotePlacement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-sandbox-remote",
      placement_kind: "containerized_remote",
      tooling_kind: "docker_sandbox",
      service_name: "runtime",
      sandbox_template_ref: ref("sandbox_template", "docker-sandbox-compose"),
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    const providerManagedPlacement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-provider-managed",
      placement_kind: "provider_managed",
      tooling_kind: "provider_session",
      endpoint_ref: ref("provider_session", "provider-session-not-launched"),
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    const endpointBackedPlacement = {
      record_kind: "runtime_placement",
      version: 1,
      runtime_placement_id: "runtime-placement-endpoint-backed",
      placement_kind: "endpoint_backed",
      tooling_kind: "http_endpoint",
      endpoint_ref: ref("runtime_endpoint", "runtime-endpoint-not-launched"),
      authority_status: "not_launched"
    } satisfies RuntimePlacementRecord;

    expect(hostLocalPlacement.placement_kind).toBe("host_local");
    expect(containerizedLocalPlacement.volume_ref).toEqual(ref("volume", "ouroboros-store"));
    expect(containerizedRemotePlacement.tooling_kind).toBe("docker_sandbox");
    expect(providerManagedPlacement.authority_status).toBe("not_launched");
    expect(endpointBackedPlacement.authority_status).toBe("not_launched");
  });

  it("models explicit evidence classification records around a sealing decision", () => {
    const candidateRef = ref("trader_system_candidate", "candidate-btc-breakout");
    const candidateVersionRef = ref("candidate_version", "candidate-version-btc-breakout-v1");
    const evaluationRunRef = ref("evaluation_run_record", "evaluation-run-backtest-v1");
    const sealingDecisionRef = ref("evidence_sealing_decision", "evidence-sealing-decision-backtest-v1");

    const traceDebugClassification = {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: "evidence-classification-trace-debug-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      evaluation_run_ref: evaluationRunRef,
      classified_ref: ref("trace_placeholder", "trace-backtest-evaluation-v1"),
      classification_kind: "trace_debug_material",
      classification_status: "trace_only",
      classification_reason: "provider_output_trace_only",
      created_at: "2026-05-05T00:04:00.000Z",
      authority_status: "not_counted"
    } satisfies EvidenceClassificationRecord;

    const countedClassification = {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: "evidence-classification-counted-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      evaluation_run_ref: evaluationRunRef,
      classified_ref: ref("fixture_evidence", "sealed-backtest-summary-v1"),
      classification_kind: "counted_evidence",
      classification_status: "counted",
      classification_reason: "sealed_counted_fixture_only_allowed_by_test",
      created_at: "2026-05-05T00:05:00.000Z",
      sealed_by_decision_ref: sealingDecisionRef,
      authority_status: "counted"
    } satisfies EvidenceClassificationRecord;

    const rejectedClassification = {
      record_kind: "evidence_classification",
      version: 1,
      evidence_classification_id: "evidence-classification-rejected-v1",
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      evaluation_run_ref: evaluationRunRef,
      classified_ref: ref("evaluation_provider_output_artifact", "provider-output-v1"),
      classification_kind: "rejected_evidence",
      classification_status: "rejected",
      classification_reason: "method_not_authoritative",
      created_at: "2026-05-05T00:06:00.000Z",
      sealed_by_decision_ref: sealingDecisionRef,
      authority_status: "not_counted"
    } satisfies EvidenceClassificationRecord;

    expect(traceDebugClassification.authority_status).toBe("not_counted");
    expect(countedClassification.authority_status).toBe("counted");
    expect(rejectedClassification.classification_status).toBe("rejected");
  });
});
