import { readdir } from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactChangeProposalMaterializationAttemptRecord,
  ArtifactChangeProposalProviderProbeResult,
  Ref
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { CodexCliArtifactChangeProposalProviderAdapter } from "../providers/codex-cli-artifact-change-proposal-provider";
import type { ArtifactChangeProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import {
  runCodexArtifactChangeProposalDryRun,
  seedCodexArtifactChangeProposalDryRunFindings,
  type CodexArtifactChangeProposalDryRunInput,
  type CodexArtifactChangeProposalDryRunOutcome
} from "./codex-artifact-change-proposal-dry-run";

export interface CodexArtifactChangeProposalDryRunAuditInput extends Omit<
  CodexArtifactChangeProposalDryRunInput,
  "provider_adapter"
> {
  provider_adapter?: ArtifactChangeProposalProviderAdapter;
}

export interface CodexArtifactChangeProposalStoreSnapshot {
  artifact_change_proposal_materialization_attempts: number;
  artifact_change_proposals: number;
  runnable_artifacts: number;
  artifact_lineages: number;
  research_orchestration_runs: number;
}

export interface CodexArtifactChangeProposalDryRunAuditAttemptSummary {
  status: ArtifactChangeProposalMaterializationAttemptRecord["status"];
  validation_status: ArtifactChangeProposalMaterializationAttemptRecord["validation_status"];
  failure_reason?: ArtifactChangeProposalMaterializationAttemptRecord["failure_reason"];
  provider_output_artifact_refs: Ref[];
  debug_artifact_refs: Ref[];
  authority_status: ArtifactChangeProposalMaterializationAttemptRecord["authority_status"];
}

export interface CodexArtifactChangeProposalDryRunAuditOutcome {
  probe: ArtifactChangeProposalProviderProbeResult;
  dry_run: CodexArtifactChangeProposalDryRunOutcome;
  before: CodexArtifactChangeProposalStoreSnapshot;
  after: CodexArtifactChangeProposalStoreSnapshot;
  delta: CodexArtifactChangeProposalStoreSnapshot;
  latest_attempt?: CodexArtifactChangeProposalDryRunAuditAttemptSummary;
}

export async function runCodexArtifactChangeProposalDryRunAudit(
  input: CodexArtifactChangeProposalDryRunAuditInput = {}
): Promise<CodexArtifactChangeProposalDryRunAuditOutcome> {
  const store = input.store ?? new LocalStore(input.store_root);
  if (input.initialize_store ?? true) {
    await store.initialize();
  }
  if (input.seed_fixture_findings ?? true) {
    await seedCodexArtifactChangeProposalDryRunFindings(store, input.created_at);
  }

  const providerAdapter = input.provider_adapter ?? new CodexCliArtifactChangeProposalProviderAdapter({
    workingDirectory: input.working_directory,
    outputPath: input.output_path,
    schemaPath: input.schema_path,
    command: input.codex_command,
    model: input.codex_model,
    timeoutMs: input.codex_timeout_ms
  });

  const before = await snapshotStore(store);
  const probe = await probeArtifactChangeProposalProvider(providerAdapter);
  const dryRun = await runCodexArtifactChangeProposalDryRun({
    ...input,
    store,
    provider_adapter: providerAdapter,
    initialize_store: false,
    seed_fixture_findings: false
  });
  const after = await snapshotStore(store);
  const attempts = await store.listArtifactChangeProposalMaterializationAttempts();
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

async function probeArtifactChangeProposalProvider(
  providerAdapter: ArtifactChangeProposalProviderAdapter
): Promise<ArtifactChangeProposalProviderProbeResult> {
  if (providerAdapter.probeArtifactChangeProposal) {
    return providerAdapter.probeArtifactChangeProposal();
  }
  return {
    provider_kind: "fixture_only",
    model: "unknown",
    invocation_surface: "probe unavailable",
    readiness_status: "candidate_unverified",
    supported_purposes: ["artifact_change_proposal_generation"],
    failure_reason: "unsupported_artifact_change_proposal_provider"
  };
}

async function snapshotStore(store: LocalStore): Promise<CodexArtifactChangeProposalStoreSnapshot> {
  const root = store.root();
  return {
    artifact_change_proposal_materialization_attempts: await countCollectionItems(root, "artifact-change-proposal-materialization-attempts"),
    artifact_change_proposals: await countCollectionItems(root, "artifact-change-proposals"),
    runnable_artifacts: await countCollectionItems(root, "runnable-artifacts"),
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
  after: CodexArtifactChangeProposalStoreSnapshot,
  before: CodexArtifactChangeProposalStoreSnapshot
): CodexArtifactChangeProposalStoreSnapshot {
  return {
    artifact_change_proposal_materialization_attempts:
      after.artifact_change_proposal_materialization_attempts - before.artifact_change_proposal_materialization_attempts,
    artifact_change_proposals: after.artifact_change_proposals - before.artifact_change_proposals,
    runnable_artifacts: after.runnable_artifacts - before.runnable_artifacts,
    artifact_lineages: after.artifact_lineages - before.artifact_lineages,
    research_orchestration_runs: after.research_orchestration_runs - before.research_orchestration_runs
  };
}

function summarizeAttempt(
  attempt: ArtifactChangeProposalMaterializationAttemptRecord
): CodexArtifactChangeProposalDryRunAuditAttemptSummary {
  return {
    status: attempt.status,
    validation_status: attempt.validation_status,
    failure_reason: attempt.failure_reason,
    provider_output_artifact_refs: attempt.provider_output_artifact_refs,
    debug_artifact_refs: attempt.debug_artifact_refs,
    authority_status: attempt.authority_status
  };
}
