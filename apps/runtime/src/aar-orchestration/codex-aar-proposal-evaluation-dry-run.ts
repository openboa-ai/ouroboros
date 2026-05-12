import type {
  AarExperimentRecord,
  Ref,
  SandboxRuntimeInstanceRecord,
  TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  evaluateRuntimeArtifactForAar,
  type RuntimeArtifactAarEvaluationOutcome
} from "../aar-evaluation/runtime-artifact-submission";
import {
  DeterministicSandboxRuntimeAdapter,
  type SandboxRuntimeAdapter
} from "../runtime-instances/sandbox-runtime-adapter";
import {
  codexAarProposalDryRunTask,
  runCodexAarProposalDryRun,
  type CodexAarProposalDryRunInput,
  type CodexAarProposalDryRunOutcome
} from "./codex-aar-proposal-dry-run";
import type { PlanAarProposalFromLocalStoreOutcome } from "./local-store-proposal-loop";

export interface CodexAarProposalEvaluationDryRunInput extends CodexAarProposalDryRunInput {
  runtime_adapter?: SandboxRuntimeAdapter;
  runtime_instance_id?: string;
  sandbox_name?: string;
  runtime_placement_id?: string;
  runtime_test_ticks?: number;
  runtime_interval_ms?: number;
  experiment_id?: string;
  submitted_at?: string;
}

export type CodexAarProposalEvaluationDryRunOutcome =
  | {
      status: "evaluated";
      store_root: string;
      idempotency_key: string;
      proposal: PlanAarProposalFromLocalStoreOutcome;
      runtime_instance: SandboxRuntimeInstanceRecord;
      experiment: AarExperimentRecord;
      evaluation_result: TradingEvaluationResultRecord;
      trace_refs: {
        provider_trace_ref: Ref;
        runtime_trace_ref: Ref;
        evaluator_trace_ref: Ref;
      };
    }
  | {
      status: "failed";
      store_root: string;
      idempotency_key: string;
      failure_reason: string;
      proposal_dry_run?: CodexAarProposalDryRunOutcome;
    };

export async function runCodexAarProposalEvaluationDryRun(
  input: CodexAarProposalEvaluationDryRunInput = {}
): Promise<CodexAarProposalEvaluationDryRunOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  const idempotencyKey = input.idempotency_key ?? "codex-aar-proposal-evaluation-dry-run";
  const createdAt = input.created_at ?? new Date().toISOString();
  const submittedAt = input.submitted_at ?? createdAt;
  const suffix = safeId(idempotencyKey);

  const proposalDryRun = await runCodexAarProposalDryRun({
    ...input,
    store,
    idempotency_key: idempotencyKey,
    created_at: createdAt
  });
  if (proposalDryRun.status === "failed") {
    return {
      status: "failed",
      store_root: store.root(),
      idempotency_key: idempotencyKey,
      failure_reason: proposalDryRun.failure_reason,
      proposal_dry_run: proposalDryRun
    };
  }

  const runtimeAdapter = input.runtime_adapter ?? new DeterministicSandboxRuntimeAdapter();
  const runtimeStart = await runtimeAdapter.startArtifactInstance({
    artifact: proposalDryRun.outcome.runnable_artifact,
    instance_id: input.runtime_instance_id ?? `sandbox-runtime-instance-codex-aar-${suffix}`,
    sandbox_name: input.sandbox_name ?? `ouro-s9-codex-aar-${suffix}`,
    runtime_placement_id: input.runtime_placement_id ?? `runtime-placement-codex-aar-${suffix}`,
    created_at: createdAt,
    trace_ref: ref("trace_placeholder", `trace-runtime-codex-aar-${suffix}`),
    test_ticks: input.runtime_test_ticks ?? 2,
    interval_ms: input.runtime_interval_ms
  });
  await store.recordRuntimeInstanceStart({
    instance: runtimeStart.instance,
    placement: runtimeStart.placement,
    logs: runtimeStart.logs,
    heartbeats: runtimeStart.heartbeats,
    command_evidence: runtimeStart.command_evidence
  });

  if (runtimeStart.instance.lifecycle_status === "failed") {
    return {
      status: "failed",
      store_root: store.root(),
      idempotency_key: idempotencyKey,
      failure_reason: "runtime_instance_failed",
      proposal_dry_run: proposalDryRun
    };
  }

  const task = codexAarProposalDryRunTask(createdAt);
  const evaluationOutcome = evaluateRuntimeArtifactForAar({
    runtime_instance: runtimeStart.instance,
    researcher_ref: proposalDryRun.outcome.proposal.researcher_ref,
    research_direction_ref: proposalDryRun.outcome.proposal.research_direction_ref,
    task,
    experiment_id: input.experiment_id ?? `aar-experiment-codex-aar-${suffix}`,
    submitted_at: submittedAt
  });
  await persistEvaluationOutcome(store, evaluationOutcome);

  return {
    status: "evaluated",
    store_root: store.root(),
    idempotency_key: idempotencyKey,
    proposal: proposalDryRun.outcome,
    runtime_instance: runtimeStart.instance,
    experiment: evaluationOutcome.experiment,
    evaluation_result: evaluationOutcome.evaluation_result,
    trace_refs: {
      provider_trace_ref: proposalDryRun.outcome.run.trace_ref
        ?? ref("trace_placeholder", `trace-aar-orchestration-${suffix}`),
      runtime_trace_ref: evaluationOutcome.experiment.trace_ref
        ?? ref("trace_placeholder", `trace-runtime-codex-aar-${suffix}`),
      evaluator_trace_ref: evaluationOutcome.evaluation_result.evaluator_trace_ref
    }
  };
}

async function persistEvaluationOutcome(
  store: LocalStore,
  outcome: RuntimeArtifactAarEvaluationOutcome
): Promise<void> {
  await store.recordAarExperiment(outcome.experiment);
  await store.recordTradingEvaluationResult(outcome.evaluation_result);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
