import { readdir } from "node:fs/promises";
import path from "node:path";
import type {
  AarProposalMaterializationAttemptRecord,
  AarProposalProviderProbeResult,
  Ref
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { CodexCliAarProposalProviderAdapter } from "../providers/codex-cli-aar-proposal-provider";
import type { AarProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import {
  runCodexAarProposalDryRun,
  seedCodexAarProposalDryRunFindings,
  type CodexAarProposalDryRunInput,
  type CodexAarProposalDryRunOutcome
} from "./codex-aar-proposal-dry-run";

export interface CodexAarProposalDryRunAuditInput extends Omit<
  CodexAarProposalDryRunInput,
  "provider_adapter"
> {
  provider_adapter?: AarProposalProviderAdapter;
}

export interface CodexAarProposalStoreSnapshot {
  aar_proposal_materialization_attempts: number;
  aar_artifact_proposals: number;
  runnable_artifacts: number;
  aar_artifact_lineages: number;
  aar_orchestration_runs: number;
}

export interface CodexAarProposalDryRunAuditAttemptSummary {
  status: AarProposalMaterializationAttemptRecord["status"];
  validation_status: AarProposalMaterializationAttemptRecord["validation_status"];
  failure_reason?: AarProposalMaterializationAttemptRecord["failure_reason"];
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  authority_status: AarProposalMaterializationAttemptRecord["authority_status"];
}

export interface CodexAarProposalDryRunAuditOutcome {
  probe: AarProposalProviderProbeResult;
  dry_run: CodexAarProposalDryRunOutcome;
  before: CodexAarProposalStoreSnapshot;
  after: CodexAarProposalStoreSnapshot;
  delta: CodexAarProposalStoreSnapshot;
  latest_attempt?: CodexAarProposalDryRunAuditAttemptSummary;
}

export async function runCodexAarProposalDryRunAudit(
  input: CodexAarProposalDryRunAuditInput = {}
): Promise<CodexAarProposalDryRunAuditOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexAarProposalDryRunFindings(store, input.created_at);
  }

  const providerAdapter = input.provider_adapter ?? new CodexCliAarProposalProviderAdapter({
    workingDirectory: input.working_directory,
    outputPath: input.output_path,
    schemaPath: input.schema_path,
    command: input.codex_command,
    model: input.codex_model,
    timeoutMs: input.codex_timeout_ms
  });

  const before = await snapshotStore(store);
  const probe = await probeAarProvider(providerAdapter);
  const dryRun = await runCodexAarProposalDryRun({
    ...input,
    store,
    provider_adapter: providerAdapter,
    initialize_store: false,
    seed_fixture_findings: false
  });
  const after = await snapshotStore(store);
  const attempts = await store.listAarProposalMaterializationAttempts();
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

async function probeAarProvider(
  providerAdapter: AarProposalProviderAdapter
): Promise<AarProposalProviderProbeResult> {
  if (providerAdapter.probeAarProposal) {
    return providerAdapter.probeAarProposal();
  }
  return {
    provider_kind: "fixture_only",
    model: "unknown",
    invocation_surface: "probe unavailable",
    readiness_status: "candidate_unverified",
    supported_purposes: ["aar_artifact_proposal_generation"],
    failure_reason: "unsupported_aar_proposal_provider"
  };
}

async function snapshotStore(store: LocalStore): Promise<CodexAarProposalStoreSnapshot> {
  const root = store.root();
  return {
    aar_proposal_materialization_attempts: await countCollectionItems(root, "aar-proposal-materialization-attempts"),
    aar_artifact_proposals: await countCollectionItems(root, "aar-artifact-proposals"),
    runnable_artifacts: await countCollectionItems(root, "runnable-artifacts"),
    aar_artifact_lineages: await countCollectionItems(root, "aar-artifact-lineages"),
    aar_orchestration_runs: await countCollectionItems(root, "aar-orchestration-runs")
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
  after: CodexAarProposalStoreSnapshot,
  before: CodexAarProposalStoreSnapshot
): CodexAarProposalStoreSnapshot {
  return {
    aar_proposal_materialization_attempts:
      after.aar_proposal_materialization_attempts - before.aar_proposal_materialization_attempts,
    aar_artifact_proposals: after.aar_artifact_proposals - before.aar_artifact_proposals,
    runnable_artifacts: after.runnable_artifacts - before.runnable_artifacts,
    aar_artifact_lineages: after.aar_artifact_lineages - before.aar_artifact_lineages,
    aar_orchestration_runs: after.aar_orchestration_runs - before.aar_orchestration_runs
  };
}

function summarizeAttempt(
  attempt: AarProposalMaterializationAttemptRecord
): CodexAarProposalDryRunAuditAttemptSummary {
  return {
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    provider_output_artifact_refs: attempt.provider_output_artifact_refs,
    debug_artifact_refs: attempt.debug_artifact_refs,
    authority_status: attempt.authority_status
  };
}
