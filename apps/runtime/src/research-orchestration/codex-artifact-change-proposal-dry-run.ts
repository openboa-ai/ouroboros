import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { CodexCliArtifactChangeProposalProviderAdapter } from "../providers/codex-cli-artifact-change-proposal-provider";
import type { ArtifactChangeProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import {
  planArtifactChangeProposalFromLocalStore,
  type PlanArtifactChangeProposalFromLocalStoreOutcome
} from "./local-store-proposal-loop";

export const codexArtifactChangeProposalDryRunFixtureIds = {
  task: "trading-evaluation-task-codex-research-dry-run-001",
  sourceFinding: "research-finding-codex-research-dry-run-next-001",
  antiHackingFinding: "research-finding-codex-research-dry-run-anti-001",
  priorLineage: "artifact-lineage-codex-research-dry-run-v1",
  priorRunnableArtifact: "research-runnable-artifact-codex-research-dry-run-seed-v1"
} as const;

export interface CodexArtifactChangeProposalDryRunInput {
  store_root?: string;
  store?: LocalStore;
  provider_adapter?: ArtifactChangeProposalProviderAdapter;
  parent_runnable_artifact_ref?: Ref;
  idempotency_key?: string;
  created_at?: string;
  initialize_store?: boolean;
  seed_fixture_findings?: boolean;
  working_directory?: string;
  output_path?: string;
  schema_path?: string;
  codex_command?: string;
  codex_model?: string;
  codex_timeout_ms?: number;
}

export type CodexArtifactChangeProposalDryRunOutcome =
  | {
      status: "materialized";
      store_root: string;
      idempotency_key: string;
      outcome: PlanArtifactChangeProposalFromLocalStoreOutcome;
    }
  | {
      status: "failed";
      store_root: string;
      idempotency_key: string;
      failure_reason: string;
    };

export async function runCodexArtifactChangeProposalDryRun(
  input: CodexArtifactChangeProposalDryRunInput = {}
): Promise<CodexArtifactChangeProposalDryRunOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexArtifactChangeProposalDryRunFindings(store, input.created_at);
  }

  const idempotencyKey = input.idempotency_key ?? "codex-artifact-change-proposal-dry-run";
  const providerAdapter = input.provider_adapter ?? new CodexCliArtifactChangeProposalProviderAdapter({
    workingDirectory: input.working_directory,
    outputPath: input.output_path,
    schemaPath: input.schema_path,
    command: input.codex_command,
    model: input.codex_model,
    timeoutMs: input.codex_timeout_ms
  });

  try {
    const outcome = await planArtifactChangeProposalFromLocalStore({
      store,
      task: codexArtifactChangeProposalDryRunTask(input.created_at),
      provider_adapter: providerAdapter,
      parent_runnable_artifact_ref: input.parent_runnable_artifact_ref,
      idempotency_key: idempotencyKey,
      created_at: input.created_at
    });
    return {
      status: "materialized",
      store_root: store.root(),
      idempotency_key: idempotencyKey,
      outcome
    };
  } catch (error) {
    return {
      status: "failed",
      store_root: store.root(),
      idempotency_key: idempotencyKey,
      failure_reason: error instanceof Error ? error.message : "unknown_research_proposal_dry_run_failure"
    };
  }
}

export async function seedCodexArtifactChangeProposalDryRunFindings(
  store: LocalStore,
  createdAt = "2026-05-12T00:00:00.000Z"
): Promise<void> {
  const existingFindings = await store.listResearchFindings();
  const sourceFinding = codexArtifactChangeProposalDryRunFinding(
    codexArtifactChangeProposalDryRunFixtureIds.sourceFinding,
    "next_artifact_hint",
    createdAt
  );
  const antiHackingFinding = codexArtifactChangeProposalDryRunFinding(
    codexArtifactChangeProposalDryRunFixtureIds.antiHackingFinding,
    "anti_hacking_case",
    createdAt
  );
  if (!existingFindings.some((finding) => finding.research_finding_id === sourceFinding.research_finding_id)) {
    await store.recordResearchFinding(sourceFinding);
  }
  if (!existingFindings.some((finding) => finding.research_finding_id === antiHackingFinding.research_finding_id)) {
    await store.recordResearchFinding(antiHackingFinding);
  }

  const existingLineages = await store.listArtifactLineages();
  if (!existingLineages.some((lineage) =>
    lineage.artifact_lineage_id === codexArtifactChangeProposalDryRunFixtureIds.priorLineage
  )) {
    await store.recordArtifactLineage(codexArtifactChangeProposalDryRunLineage(sourceFinding, createdAt));
  }
}

export function codexArtifactChangeProposalDryRunTask(
  createdAt = "2026-05-12T00:00:00.000Z"
): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: codexArtifactChangeProposalDryRunFixtureIds.task,
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
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function codexArtifactChangeProposalDryRunFinding(
  findingId: string,
  findingKind: ResearchFindingRecord["finding_kind"],
  createdAt: string
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-codex-research-dry-run-001"),
    research_direction_ref: ref("research_direction", "research-direction-codex-research-dry-run-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-codex-research-dry-run-001"),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      "trading-evaluation-result-codex-research-dry-run-001"
    ),
    finding_kind: findingKind,
    summary: `Codex research dry-run ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: createdAt,
    authority_status: "research_trace_only"
  };
}

function codexArtifactChangeProposalDryRunLineage(
  sourceFinding: ResearchFindingRecord,
  createdAt: string
): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: codexArtifactChangeProposalDryRunFixtureIds.priorLineage,
    child_runnable_artifact_ref: ref(
      "runnable_artifact",
      codexArtifactChangeProposalDryRunFixtureIds.priorRunnableArtifact
    ),
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-codex-research-root-v1"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: createdAt,
    authority_status: "lineage_only"
  };
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
