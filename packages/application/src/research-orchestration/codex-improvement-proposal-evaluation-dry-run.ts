import type {
  ExperimentRunRecord,
  Ref,
  SandboxRecord,
  TradingEvaluationResultRecord
} from "@ouroboros/domain";
import {
  evaluateSystemCodeForResearch,
  type SystemCodeResearchEvaluationOutcome
} from "../research-evaluation/system-code-research-submission";
import { safeId } from "../safe-id";
import type { SandboxAdapterPort } from "../ports/sandbox-ports";
import type { OuroborosStorePort } from "../ports/store-ports";
import {
  codexImprovementProposalDryRunTask,
  runCodexImprovementProposalDryRun,
  type CodexImprovementProposalDryRunInput,
  type CodexImprovementProposalDryRunOutcome
} from "./codex-improvement-proposal-dry-run";
import type { PlanImprovementProposalFromLocalStoreOutcome } from "./local-store-proposal-loop";

export interface CodexImprovementProposalEvaluationDryRunInput extends CodexImprovementProposalDryRunInput {
  runtime_adapter?: SandboxAdapterPort;
  sandbox_id?: string;
  sandbox_name?: string;
  sandbox_placement_id?: string;
  runtime_test_ticks?: number;
  runtime_interval_ms?: number;
  experiment_id?: string;
  submitted_at?: string;
}

export type CodexImprovementProposalEvaluationDryRunOutcome =
  | {
      status: "evaluated";
      store_root: string;
      idempotency_key: string;
      proposal: PlanImprovementProposalFromLocalStoreOutcome;
      sandbox: SandboxRecord;
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
      proposal_dry_run?: CodexImprovementProposalDryRunOutcome;
    };

export async function runCodexImprovementProposalEvaluationDryRun(
  input: CodexImprovementProposalEvaluationDryRunInput = {}
): Promise<CodexImprovementProposalEvaluationDryRunOutcome> {
  const store = input.store;
  const idempotencyKey = input.idempotency_key ?? "codex-improvement-proposal-evaluation-dry-run";
  const createdAt = input.created_at ?? new Date().toISOString();
  const submittedAt = input.submitted_at ?? createdAt;
  const suffix = safeId(idempotencyKey);
  if (!store) {
    return {
      status: "failed",
      store_root: input.store_root ?? "",
      idempotency_key: idempotencyKey,
      failure_reason: "store_port_required"
    };
  }

  const proposalDryRun = await runCodexImprovementProposalDryRun({
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

  const runtimeAdapter = input.runtime_adapter;
  if (!runtimeAdapter) {
    return {
      status: "failed",
      store_root: store.root(),
      idempotency_key: idempotencyKey,
      failure_reason: "sandbox_adapter_port_required",
      proposal_dry_run: proposalDryRun
    };
  }
  const runtimeStart = await runtimeAdapter.startArtifactInstance({
    artifact: proposalDryRun.outcome.system_code,
    instance_id: input.sandbox_id ?? `sandbox-codex-research-${suffix}`,
    sandbox_name: input.sandbox_name ?? `ouro-s9-codex-research-${suffix}`,
    sandbox_placement_id: input.sandbox_placement_id ?? `sandbox-placement-codex-research-${suffix}`,
    created_at: createdAt,
    trace_ref: ref("trace_placeholder", `trace-runtime-codex-research-${suffix}`),
    test_ticks: input.runtime_test_ticks ?? 2,
    interval_ms: input.runtime_interval_ms
  });
  await store.recordSandboxStart({
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
      failure_reason: "sandbox_failed",
      proposal_dry_run: proposalDryRun
    };
  }

  const task = codexImprovementProposalDryRunTask(createdAt);
  const evaluationOutcome = evaluateSystemCodeForResearch({
    sandbox: runtimeStart.instance,
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
    sandbox: runtimeStart.instance,
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
  store: OuroborosStorePort,
  outcome: SystemCodeResearchEvaluationOutcome
): Promise<void> {
  await store.recordExperimentRun(outcome.experiment);
  await store.recordTradingEvaluationResult(outcome.evaluation_result);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
