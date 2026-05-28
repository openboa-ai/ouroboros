import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import type { ImprovementProposalProviderAdapter } from "../../ports/provider";
import type { OuroborosStorePort } from "../../ports/store";
import {
  planImprovementProposalFromLocalStore,
  type PlanImprovementProposalFromLocalStoreOutcome
} from "./local-store-proposal-loop";
import { FixtureImprovementProposalProviderAdapter } from "./fixture-improvement-proposal-provider";

export const codexImprovementProposalDryRunFixtureIds = {
  task: "trading-evaluation-task-codex-research-dry-run-001",
  sourceFinding: "research-finding-codex-research-dry-run-next-001",
  antiHackingFinding: "research-finding-codex-research-dry-run-anti-001",
  priorLineage: "artifact-lineage-codex-research-dry-run-v1",
  priorSystemCode: "research-system-code-codex-research-dry-run-seed-v1"
} as const;

export interface CodexImprovementProposalDryRunInput {
  store_root?: string;
  store?: OuroborosStorePort;
  provider_adapter?: ImprovementProposalProviderAdapter;
  parent_system_code_ref?: Ref;
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

export type CodexImprovementProposalDryRunOutcome =
  | {
      status: "materialized";
      store_root: string;
      idempotency_key: string;
      outcome: PlanImprovementProposalFromLocalStoreOutcome;
    }
  | {
      status: "failed";
      store_root: string;
      idempotency_key: string;
      failure_reason: string;
    };

export async function runCodexImprovementProposalDryRun(
  input: CodexImprovementProposalDryRunInput = {}
): Promise<CodexImprovementProposalDryRunOutcome> {
  const store = input.store;
  if (!store) {
    return {
      status: "failed",
      store_root: input.store_root ?? "",
      idempotency_key: input.idempotency_key ?? "codex-improvement-proposal-dry-run",
      failure_reason: "store_port_required"
    };
  }
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexImprovementProposalDryRunFindings(store, input.created_at);
  }

  const idempotencyKey = input.idempotency_key ?? "codex-improvement-proposal-dry-run";
  const providerAdapter = input.provider_adapter ?? new FixtureImprovementProposalProviderAdapter();

  try {
    const outcome = await planImprovementProposalFromLocalStore({
      store,
      task: codexImprovementProposalDryRunTask(input.created_at),
      provider_adapter: providerAdapter,
      parent_system_code_ref: input.parent_system_code_ref,
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

export async function seedCodexImprovementProposalDryRunFindings(
  store: OuroborosStorePort,
  createdAt = "2026-05-12T00:00:00.000Z"
): Promise<void> {
  const existingFindings = await store.listResearchFindings();
  const sourceFinding = codexImprovementProposalDryRunFinding(
    codexImprovementProposalDryRunFixtureIds.sourceFinding,
    "next_artifact_hint",
    createdAt
  );
  const antiHackingFinding = codexImprovementProposalDryRunFinding(
    codexImprovementProposalDryRunFixtureIds.antiHackingFinding,
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
    lineage.artifact_lineage_id === codexImprovementProposalDryRunFixtureIds.priorLineage
  )) {
    await store.recordArtifactLineage(codexImprovementProposalDryRunLineage(sourceFinding, createdAt));
  }
}

export function codexImprovementProposalDryRunTask(
  createdAt = "2026-05-12T00:00:00.000Z"
): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: codexImprovementProposalDryRunFixtureIds.task,
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

function codexImprovementProposalDryRunFinding(
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

function codexImprovementProposalDryRunLineage(
  sourceFinding: ResearchFindingRecord,
  createdAt: string
): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: codexImprovementProposalDryRunFixtureIds.priorLineage,
    child_system_code_ref: ref(
      "system_code",
      codexImprovementProposalDryRunFixtureIds.priorSystemCode
    ),
    parent_system_code_ref: ref("system_code", "research-system-code-codex-research-root-v1"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: createdAt,
    authority_status: "lineage_only"
  };
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
