import type {
  AarExperimentRecord,
  Ref,
  SandboxRuntimeInstanceRecord,
  TradingEvaluationResultRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import {
  DeterministicBtcPerpSealedEvaluator,
  type BtcPerpFixtureEvaluationScenario
} from "./btc-perp-sealed-evaluator";

export interface RuntimeArtifactAarEvaluationInput {
  runtime_instance: SandboxRuntimeInstanceRecord;
  researcher_ref: Ref;
  research_direction_ref: Ref;
  task: TradingEvaluationTaskRecord;
  experiment_id?: string;
  submitted_at?: string;
  scenario?: BtcPerpFixtureEvaluationScenario;
  evaluator?: DeterministicBtcPerpSealedEvaluator;
}

export interface RuntimeArtifactAarEvaluationOutcome {
  experiment: AarExperimentRecord;
  evaluation_result: TradingEvaluationResultRecord;
  runtime_trace_refs: Ref[];
}

export function evaluateRuntimeArtifactForAar(
  input: RuntimeArtifactAarEvaluationInput
): RuntimeArtifactAarEvaluationOutcome {
  const runtimeTraceRefs = runtimeTraceRefsFor(input.runtime_instance);
  const experimentId = input.experiment_id
    ?? `aar-experiment-${safeId(input.runtime_instance.sandbox_runtime_instance_id)}`;
  const experiment = {
    record_kind: "aar_experiment",
    version: 1,
    aar_experiment_id: experimentId,
    researcher_ref: input.researcher_ref,
    research_direction_ref: input.research_direction_ref,
    runnable_artifact_ref: input.runtime_instance.runnable_artifact_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    sandbox_runtime_instance_ref: ref(
      "sandbox_runtime_instance",
      input.runtime_instance.sandbox_runtime_instance_id
    ),
    runtime_trace_refs: runtimeTraceRefs,
    trace_ref: input.runtime_instance.trace_ref
      ?? ref("trace_placeholder", `trace-${safeId(experimentId)}-runtime-self-report`),
    submitted_at: input.submitted_at ?? new Date().toISOString(),
    status: "evaluated",
    authority_status: "not_live"
  } satisfies AarExperimentRecord;

  const evaluator = input.evaluator ?? new DeterministicBtcPerpSealedEvaluator();
  const evaluationResult = evaluator.evaluate({
    experiment,
    task: input.task,
    scenario: input.scenario,
    completed_at: input.submitted_at
  });

  return {
    experiment,
    evaluation_result: evaluationResult,
    runtime_trace_refs: runtimeTraceRefs
  };
}

export function runtimeTraceRefsFor(instance: SandboxRuntimeInstanceRecord): Ref[] {
  return [
    ...(instance.trace_ref ? [instance.trace_ref] : []),
    ...instance.log_refs,
    ...instance.heartbeat_refs,
    ...(instance.command_evidence_refs ?? [])
  ];
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
