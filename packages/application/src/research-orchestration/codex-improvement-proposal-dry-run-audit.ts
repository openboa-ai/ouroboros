import { readdir } from "node:fs/promises";
import path from "node:path";
import type {
  ImprovementProposalMaterializationAttemptRecord,
  ImprovementProposalProviderProbeResult,
  Ref
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { CodexCliImprovementProposalProviderAdapter } from "@ouroboros/adapters/providers/codex-cli-improvement-proposal-provider";
import type { ImprovementProposalProviderAdapter } from "@ouroboros/adapters/providers/runtime-provider-adapter";
import {
  runCodexImprovementProposalDryRun,
  seedCodexImprovementProposalDryRunFindings,
  type CodexImprovementProposalDryRunInput,
  type CodexImprovementProposalDryRunOutcome
} from "./codex-improvement-proposal-dry-run";

export interface CodexImprovementProposalDryRunAuditInput extends Omit<
  CodexImprovementProposalDryRunInput,
  "provider_adapter"
> {
  provider_adapter?: ImprovementProposalProviderAdapter;
}

export interface CodexImprovementProposalStoreSnapshot {
  improvement_proposal_materialization_attempts: number;
  improvement_proposals: number;
  system_codes: number;
  artifact_lineages: number;
  research_orchestration_runs: number;
}

export interface CodexImprovementProposalDryRunAuditAttemptSummary {
  status: ImprovementProposalMaterializationAttemptRecord["status"];
  validation_status: ImprovementProposalMaterializationAttemptRecord["validation_status"];
  failure_reason?: ImprovementProposalMaterializationAttemptRecord["failure_reason"];
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  authority_status: ImprovementProposalMaterializationAttemptRecord["authority_status"];
}

export interface CodexImprovementProposalDryRunAuditOutcome {
  probe: ImprovementProposalProviderProbeResult;
  dry_run: CodexImprovementProposalDryRunOutcome;
  before: CodexImprovementProposalStoreSnapshot;
  after: CodexImprovementProposalStoreSnapshot;
  delta: CodexImprovementProposalStoreSnapshot;
  latest_attempt?: CodexImprovementProposalDryRunAuditAttemptSummary;
}

export async function runCodexImprovementProposalDryRunAudit(
  input: CodexImprovementProposalDryRunAuditInput = {}
): Promise<CodexImprovementProposalDryRunAuditOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexImprovementProposalDryRunFindings(store, input.created_at);
  }

  const providerAdapter = input.provider_adapter ?? new CodexCliImprovementProposalProviderAdapter({
    workingDirectory: input.working_directory,
    outputPath: input.output_path,
    schemaPath: input.schema_path,
    command: input.codex_command,
    model: input.codex_model,
    timeoutMs: input.codex_timeout_ms
  });

  const before = await snapshotStore(store);
  const probe = await probeImprovementProposalProvider(providerAdapter);
  const dryRun = await runCodexImprovementProposalDryRun({
    ...input,
    store,
    provider_adapter: providerAdapter,
    initialize_store: false,
    seed_fixture_findings: false
  });
  const after = await snapshotStore(store);
  const attempts = await store.listImprovementProposalMaterializationAttempts();
  const latestAttempt = attempts[attempts.length - 1];

  return {
    probe,
    dry_run: dryRun,
    before,
    after,
    delta: subtractSnapshot(after, before),
    latest_attempt: latestAttempt ? summarizeAttempt(latestAttempt) : undefined
  };
}

async function probeImprovementProposalProvider(
  providerAdapter: ImprovementProposalProviderAdapter
): Promise<ImprovementProposalProviderProbeResult> {
  if (providerAdapter.probeImprovementProposal) {
    return providerAdapter.probeImprovementProposal();
  }
  return {
    provider_kind: "fixture_only",
    model: "unknown",
    invocation_surface: "probe unavailable",
    readiness_status: "candidate_unverified",
    supported_purposes: ["improvement_proposal_generation"],
    failure_reason: "unsupported_improvement_proposal_provider"
  };
}

async function snapshotStore(store: LocalStore): Promise<CodexImprovementProposalStoreSnapshot> {
  const root = store.root();
  return {
    improvement_proposal_materialization_attempts: await countCollectionItems(root, "improvement-proposal-materialization-attempts"),
    improvement_proposals: await countCollectionItems(root, "improvement-proposals"),
    system_codes: await countCollectionItems(root, "system-codes"),
    artifact_lineages: await countCollectionItems(root, "artifact-lineages"),
    research_orchestration_runs: await countCollectionItems(root, "research-orchestration-runs")
  };
}

async function countCollectionItems(root: string, collection: string): Promise<number> {
  try {
    const entries = await readdir(path.join(root, collection, "items"), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

function subtractSnapshot(
  after: CodexImprovementProposalStoreSnapshot,
  before: CodexImprovementProposalStoreSnapshot
): CodexImprovementProposalStoreSnapshot {
  return {
    improvement_proposal_materialization_attempts:
      after.improvement_proposal_materialization_attempts - before.improvement_proposal_materialization_attempts,
    improvement_proposals: after.improvement_proposals - before.improvement_proposals,
    system_codes: after.system_codes - before.system_codes,
    artifact_lineages: after.artifact_lineages - before.artifact_lineages,
    research_orchestration_runs: after.research_orchestration_runs - before.research_orchestration_runs
  };
}

function summarizeAttempt(
  attempt: ImprovementProposalMaterializationAttemptRecord
): CodexImprovementProposalDryRunAuditAttemptSummary {
  return {
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    provider_output_artifact_refs: attempt.provider_output_artifact_refs,
    debug_artifact_refs: attempt.debug_artifact_refs,
    authority_status: attempt.authority_status
  };
}
