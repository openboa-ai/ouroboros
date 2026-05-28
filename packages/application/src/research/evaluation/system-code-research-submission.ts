import type {
  ExperimentRunRecord,
  Ref,
  SandboxRecord,
  TradingEvaluationResultRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import {
  DeterministicSealedReplayEvaluator,
  type SealedReplayEvaluationScenario
} from "./deterministic-sealed-replay-evaluator";
import { safeId } from "../../safe-id";

export interface SystemCodeResearchEvaluationInput {
  sandbox: SandboxRecord;
  research_worker_ref: Ref;
  research_direction_ref: Ref;
  task: TradingEvaluationTaskRecord;
  experiment_id?: string;
  submitted_at?: string;
  scenario?: SealedReplayEvaluationScenario;
  evaluator?: DeterministicSealedReplayEvaluator;
}

export interface SystemCodeResearchEvaluationOutcome {
  experiment: ExperimentRunRecord;
  evaluation_result: TradingEvaluationResultRecord;
  runtime_trace_refs: Ref[];
}

export function evaluateSystemCodeForResearch(
  input: SystemCodeResearchEvaluationInput
): SystemCodeResearchEvaluationOutcome {
  const runtimeTraceRefs = runtimeTraceRefsFor(input.sandbox);
  const experimentId = input.experiment_id
    ?? `experiment-run-${safeId(input.sandbox.sandbox_id)}`;
  const experiment = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: experimentId,
    research_worker_ref: input.research_worker_ref,
    research_direction_ref: input.research_direction_ref,
    system_code_ref: input.sandbox.system_code_ref,
    trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
    sandbox_ref: ref(
      "sandbox",
      input.sandbox.sandbox_id
    ),
    runtime_trace_refs: runtimeTraceRefs,
    trace_ref: input.sandbox.trace_ref
      ?? ref("trace_placeholder", `trace-${safeId(experimentId)}-runtime-self-report`),
    submitted_at: input.submitted_at ?? new Date().toISOString(),
    status: "evaluated",
    authority_status: "not_live"
  } satisfies ExperimentRunRecord;

  const evaluator = input.evaluator ?? new DeterministicSealedReplayEvaluator();
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

export function runtimeTraceRefsFor(instance: SandboxRecord): Ref[] {
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
