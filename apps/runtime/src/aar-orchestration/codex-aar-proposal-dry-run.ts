import type {
  AarArtifactLineageRecord,
  AarFindingRecord,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { CodexCliAarProposalProviderAdapter } from "../providers/codex-cli-aar-proposal-provider";
import type { AarProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import {
  planAarProposalFromLocalStore,
  type PlanAarProposalFromLocalStoreOutcome
} from "./local-store-proposal-loop";

export const codexAarProposalDryRunFixtureIds = {
  task: "trading-evaluation-task-codex-aar-dry-run-001",
  sourceFinding: "aar-finding-codex-aar-dry-run-next-001",
  antiHackingFinding: "aar-finding-codex-aar-dry-run-anti-001",
  priorLineage: "aar-artifact-lineage-codex-aar-dry-run-v1",
  priorRunnableArtifact: "aar-runnable-artifact-codex-aar-dry-run-seed-v1"
} as const;

export interface CodexAarProposalDryRunInput {
  store_root?: string;
  store?: LocalStore;
  provider_adapter?: AarProposalProviderAdapter;
  idempotency_key?: string;
  created_at?: string;
  initialize_store?: boolean;
  seed_fixture_findings?: boolean;
  working_directory?: string;
  output_path?: string;
  schema_path?: string;
  codex_command?: string;
  codex_model?: string;
}

export type CodexAarProposalDryRunOutcome =
  | {
      status: "materialized";
      store_root: string;
      idempotency_key: string;
      outcome: PlanAarProposalFromLocalStoreOutcome;
    }
  | {
      status: "failed";
      store_root: string;
      idempotency_key: string;
      failure_reason: string;
    };

export async function runCodexAarProposalDryRun(
  input: CodexAarProposalDryRunInput = {}
): Promise<CodexAarProposalDryRunOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexAarProposalDryRunFindings(store, input.created_at);
  }

  const idempotencyKey = input.idempotency_key ?? "codex-aar-proposal-dry-run";
  const providerAdapter = input.provider_adapter ?? new CodexCliAarProposalProviderAdapter({
    workingDirectory: input.working_directory,
    outputPath: input.output_path,
    schemaPath: input.schema_path,
    command: input.codex_command,
    model: input.codex_model
  });

  try {
    const outcome = await planAarProposalFromLocalStore({
      store,
      task: codexAarProposalDryRunTask(input.created_at),
      provider_adapter: providerAdapter,
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
      failure_reason: error instanceof Error ? error.message : "unknown_aar_proposal_dry_run_failure"
    };
  }
}

export async function seedCodexAarProposalDryRunFindings(
  store: LocalStore,
  createdAt = "2026-05-12T00:00:00.000Z"
): Promise<void> {
  const existingFindings = await store.listAarFindings();
  const sourceFinding = codexAarProposalDryRunFinding(
    codexAarProposalDryRunFixtureIds.sourceFinding,
    "next_artifact_hint",
    createdAt
  );
  const antiHackingFinding = codexAarProposalDryRunFinding(
    codexAarProposalDryRunFixtureIds.antiHackingFinding,
    "anti_hacking_case",
    createdAt
  );
  if (!existingFindings.some((finding) => finding.aar_finding_id === sourceFinding.aar_finding_id)) {
    await store.recordAarFinding(sourceFinding);
  }
  if (!existingFindings.some((finding) => finding.aar_finding_id === antiHackingFinding.aar_finding_id)) {
    await store.recordAarFinding(antiHackingFinding);
  }

  const existingLineages = await store.listAarArtifactLineages();
  if (!existingLineages.some((lineage) =>
    lineage.aar_artifact_lineage_id === codexAarProposalDryRunFixtureIds.priorLineage
  )) {
    await store.recordAarArtifactLineage(codexAarProposalDryRunLineage(sourceFinding, createdAt));
  }
}

export function codexAarProposalDryRunTask(
  createdAt = "2026-05-12T00:00:00.000Z"
): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: codexAarProposalDryRunFixtureIds.task,
    market_scope: "binance_btc_perpetual_futures",
    stage: "backtest",
    data_window_ref: ref("data_window", "btc-perp-fixture-window"),
    fee_model_ref: ref("fee_model", "binance-btc-perp-fixture-fees"),
    funding_model_ref: ref("funding_model", "binance-btc-perp-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "btc-perp-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "btc-perp-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "btc-perp-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "btc-perp-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "btc-perp-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function codexAarProposalDryRunFinding(
  findingId: string,
  findingKind: AarFindingRecord["finding_kind"],
  createdAt: string
): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: findingId,
    researcher_ref: ref("aar_researcher", "aar-researcher-codex-aar-dry-run-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-codex-aar-dry-run-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-codex-aar-dry-run-001"),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      "trading-evaluation-result-codex-aar-dry-run-001"
    ),
    finding_kind: findingKind,
    summary: `Codex AAR dry-run ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: createdAt,
    authority_status: "research_trace_only"
  };
}

function codexAarProposalDryRunLineage(
  sourceFinding: AarFindingRecord,
  createdAt: string
): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: codexAarProposalDryRunFixtureIds.priorLineage,
    child_runnable_artifact_ref: ref(
      "runnable_artifact",
      codexAarProposalDryRunFixtureIds.priorRunnableArtifact
    ),
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-codex-aar-root-v1"),
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    created_by_researcher_ref: sourceFinding.researcher_ref,
    created_at: createdAt,
    authority_status: "lineage_only"
  };
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
