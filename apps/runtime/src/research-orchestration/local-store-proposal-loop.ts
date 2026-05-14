import { createHash } from "node:crypto";
import type {
  ArtifactLineageRecord,
  ArtifactChangeProposalRecord,
  ResearchFindingRecord,
  ResearchOrchestrationRunRecord,
  Ref,
  RunnableArtifactRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import type { ArtifactChangeProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import { FixtureArtifactChangeProposalProviderAdapter } from "./fixture-artifact-change-proposal-provider";

export interface PlanArtifactChangeProposalFromLocalStoreInput {
  store: LocalStore;
  task: TradingEvaluationTaskRecord;
  provider_adapter?: ArtifactChangeProposalProviderAdapter;
  idempotency_key?: string;
  created_at?: string;
}

export interface PlanArtifactChangeProposalFromLocalStoreOutcome {
  run: ResearchOrchestrationRunRecord;
  proposal: ArtifactChangeProposalRecord;
  runnable_artifact: RunnableArtifactRecord;
  lineage: ArtifactLineageRecord;
  source_finding: ResearchFindingRecord;
  anti_hacking_findings: ResearchFindingRecord[];
}

export async function planArtifactChangeProposalFromLocalStore(
  input: PlanArtifactChangeProposalFromLocalStoreInput
): Promise<PlanArtifactChangeProposalFromLocalStoreOutcome> {
  const findings = await input.store.listResearchFindings();
  if (findings.length === 0) {
    throw new Error("no_research_findings");
  }
  const existingLineages = await input.store.listArtifactLineages();
  const idempotencyKey = input.idempotency_key ?? defaultIdempotencyKey(input.task, findings, existingLineages);
  const suffix = stableSuffix(idempotencyKey);
  const providerAdapter = input.provider_adapter ?? new FixtureArtifactChangeProposalProviderAdapter();
  const providerResult = await providerAdapter.runArtifactChangeProposalGeneration({
    idempotency_key: idempotencyKey,
    task: input.task,
    findings,
    existing_lineages: existingLineages,
    existing_lineage_refs: existingLineages.map((lineage) =>
      ref("artifact_lineage", lineage.artifact_lineage_id)
    ),
    input_artifact_refs: findings.map((finding) => ref("research_finding", finding.research_finding_id)),
    agent_run_ref: ref("agent_run", `agent-run-artifact-change-proposal-provider-${suffix}`),
    trace_ref: ref("trace_placeholder", `trace-research-orchestration-${suffix}`),
    created_at: input.created_at
  });

  if (providerResult.status === "failed") {
    await input.store.recordArtifactChangeProposalProviderFailure({
      idempotency_key: idempotencyKey,
      provider_result: providerResult,
      created_at: input.created_at
    });
    throw new Error(providerResult.failure_reason);
  }

  const materialized = await input.store.materializeArtifactChangeProposal({
    idempotency_key: idempotencyKey,
    provider_result: providerResult,
    created_at: input.created_at
  });
  if (materialized.status === "failed") {
    throw new Error(materialized.attempt.failure_reason ?? "artifact_change_proposal_materialization_failed");
  }

  const sourceFinding = findingForRef(findings, providerResult.output.source_finding_refs[0]);
  if (!sourceFinding) {
    throw new Error("artifact_change_proposal_source_finding_not_found");
  }
  const antiHackingFindings = (providerResult.output.anti_hacking_finding_refs ?? [])
    .map((findingRef) => findingForRef(findings, findingRef))
    .filter((finding): finding is ResearchFindingRecord => finding !== undefined);
  const run: ResearchOrchestrationRunRecord = {
    record_kind: "research_orchestration_run",
    version: 1,
    research_orchestration_run_id: `research-orchestration-run-${suffix}`,
    research_worker_ref: sourceFinding.research_worker_ref,
    research_direction_ref: sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: providerResult.output.trading_evaluation_task_ref,
    input_finding_refs: [
      ...providerResult.output.source_finding_refs,
      ...(providerResult.output.anti_hacking_finding_refs ?? [])
    ],
    input_lineage_refs: inputLineageRefsForSource(existingLineages, sourceFinding),
    output_artifact_proposal_ref: ref(
      "artifact_change_proposal",
      materialized.proposal.artifact_change_proposal_id
    ),
    output_runnable_artifact_ref: ref(
      "runnable_artifact",
      materialized.runnable_artifact.runnable_artifact_id
    ),
    output_lineage_ref: ref("artifact_lineage", materialized.lineage.artifact_lineage_id),
    trace_ref: providerResult.trace_ref,
    started_at: input.created_at ?? new Date().toISOString(),
    completed_at: input.created_at ?? new Date().toISOString(),
    status: "proposed",
    authority_status: "research_only"
  };

  await input.store.recordResearchOrchestrationRun(run);

  return {
    run,
    proposal: materialized.proposal,
    runnable_artifact: materialized.runnable_artifact,
    lineage: materialized.lineage,
    source_finding: sourceFinding,
    anti_hacking_findings: antiHackingFindings
  };
}

function inputLineageRefsForSource(
  lineages: ArtifactLineageRecord[],
  sourceFinding: ResearchFindingRecord
): Ref[] | undefined {
  const lineageRefs = lineages
    .filter((lineage) =>
      lineage.source_finding_refs.some((findingRef) => findingRef.id === sourceFinding.research_finding_id)
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((lineage) => ref("artifact_lineage", lineage.artifact_lineage_id));
  return lineageRefs.length ? lineageRefs : undefined;
}

function findingForRef(findings: ResearchFindingRecord[], findingRef: Ref): ResearchFindingRecord | undefined {
  return findings.find((finding) => finding.research_finding_id === findingRef.id);
}

function defaultIdempotencyKey(
  task: TradingEvaluationTaskRecord,
  findings: ResearchFindingRecord[],
  lineages: ArtifactLineageRecord[]
): string {
  return [
    task.trading_evaluation_task_id,
    ...findings.map((finding) => finding.research_finding_id).sort(),
    ...lineages.map((lineage) => lineage.artifact_lineage_id).sort()
  ].join(":");
}

function stableSuffix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
