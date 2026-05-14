import type {
  ExperimentRunRecord,
  Ref,
  SandboxRuntimeInstanceRecord,
  TradingEvaluationResultRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  evaluateRuntimeArtifactForResearch,
  type RuntimeArtifactResearchEvaluationOutcome
} from "../research-evaluation/runtime-artifact-submission";
import {
  DeterministicSandboxRuntimeAdapter,
  type SandboxRuntimeAdapter
} from "../runtime-instances/sandbox-runtime-adapter";
import {
  codexArtifactChangeProposalDryRunTask,
  runCodexArtifactChangeProposalDryRun,
  type CodexArtifactChangeProposalDryRunInput,
  type CodexArtifactChangeProposalDryRunOutcome
} from "./codex-artifact-change-proposal-dry-run";
import type { PlanArtifactChangeProposalFromLocalStoreOutcome } from "./local-store-proposal-loop";

export interface CodexArtifactChangeProposalEvaluationDryRunInput extends CodexArtifactChangeProposalDryRunInput {
  runtime_adapter?: SandboxRuntimeAdapter;
  runtime_instance_id?: string;
  sandbox_name?: string;
  runtime_placement_id?: string;
  runtime_test_ticks?: number;
  runtime_interval_ms?: number;
  experiment_id?: string;
  submitted_at?: string;
}

export type CodexArtifactChangeProposalEvaluationDryRunOutcome =
  | {
      status: "evaluated";
      store_root: string;
      idempotency_key: string;
      proposal: PlanArtifactChangeProposalFromLocalStoreOutcome;
      runtime_instance: SandboxRuntimeInstanceRecord;
      experiment: ExperimentRunRecord;
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
      proposal_dry_run?: CodexArtifactChangeProposalDryRunOutcome;
    };

export async function runCodexArtifactChangeProposalEvaluationDryRun(
  input: CodexArtifactChangeProposalEvaluationDryRunInput = {}
): Promise<CodexArtifactChangeProposalEvaluationDryRunOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  const idempotencyKey = input.idempotency_key ?? "codex-artifact-change-proposal-evaluation-dry-run";
  const createdAt = input.created_at ?? new Date().toISOString();
  const submittedAt = input.submitted_at ?? createdAt;
  const suffix = safeId(idempotencyKey);

  const proposalDryRun = await runCodexArtifactChangeProposalDryRun({
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
    instance_id: input.runtime_instance_id ?? `sandbox-runtime-instance-codex-research-${suffix}`,
    sandbox_name: input.sandbox_name ?? `ouro-s9-codex-research-${suffix}`,
    runtime_placement_id: input.runtime_placement_id ?? `runtime-placement-codex-research-${suffix}`,
    created_at: createdAt,
    trace_ref: ref("trace_placeholder", `trace-runtime-codex-research-${suffix}`),
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

  const task = codexArtifactChangeProposalDryRunTask(createdAt);
  const evaluationOutcome = evaluateRuntimeArtifactForResearch({
    runtime_instance: runtimeStart.instance,
    research_worker_ref: proposalDryRun.outcome.proposal.research_worker_ref,
    research_direction_ref: proposalDryRun.outcome.proposal.research_direction_ref,
    task,
    experiment_id: input.experiment_id ?? `experiment-run-codex-research-${suffix}`,
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
        ?? ref("trace_placeholder", `trace-research-orchestration-${suffix}`),
      runtime_trace_ref: evaluationOutcome.experiment.trace_ref
        ?? ref("trace_placeholder", `trace-runtime-codex-research-${suffix}`),
      evaluator_trace_ref: evaluationOutcome.evaluation_result.evaluator_trace_ref
    }
  };
}

async function persistEvaluationOutcome(
  store: LocalStore,
  outcome: RuntimeArtifactResearchEvaluationOutcome
): Promise<void> {
  await store.recordExperimentRun(outcome.experiment);
  await store.recordTradingEvaluationResult(outcome.evaluation_result);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
