import { createHash } from "node:crypto";
import type {
  AarArtifactLineageRecord,
  AarArtifactProposalRecord,
  AarFindingRecord,
  AarOrchestrationRunRecord,
  Ref,
  RunnableArtifactRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import type { AarProposalProviderAdapter } from "../providers/runtime-provider-adapter";
import { FixtureAarProposalProviderAdapter } from "./fixture-aar-proposal-provider";

export interface PlanAarProposalFromLocalStoreInput {
  store: LocalStore;
  task: TradingEvaluationTaskRecord;
  provider_adapter?: AarProposalProviderAdapter;
  idempotency_key?: string;
  created_at?: string;
}

export interface PlanAarProposalFromLocalStoreOutcome {
  run: AarOrchestrationRunRecord;
  proposal: AarArtifactProposalRecord;
  runnable_artifact: RunnableArtifactRecord;
  lineage: AarArtifactLineageRecord;
  source_finding: AarFindingRecord;
  anti_hacking_findings: AarFindingRecord[];
}

export async function planAarProposalFromLocalStore(
  input: PlanAarProposalFromLocalStoreInput
): Promise<PlanAarProposalFromLocalStoreOutcome> {
  const findings = await input.store.listAarFindings();
  if (findings.length === 0) {
    throw new Error("no_aar_findings");
  }
  const existingLineages = await input.store.listAarArtifactLineages();
  const idempotencyKey = input.idempotency_key ?? defaultIdempotencyKey(input.task, findings, existingLineages);
  const suffix = stableSuffix(idempotencyKey);
  const providerAdapter = input.provider_adapter ?? new FixtureAarProposalProviderAdapter();
  const providerResult = await providerAdapter.runAarProposalGeneration({
    idempotency_key: idempotencyKey,
    task: input.task,
    findings,
    existing_lineages: existingLineages,
    existing_lineage_refs: existingLineages.map((lineage) =>
      ref("aar_artifact_lineage", lineage.aar_artifact_lineage_id)
    ),
    input_artifact_refs: findings.map((finding) => ref("aar_finding", finding.aar_finding_id)),
    agent_run_ref: ref("agent_run", `agent-run-aar-proposal-provider-${suffix}`),
    trace_ref: ref("trace_placeholder", `trace-aar-orchestration-${suffix}`),
    created_at: input.created_at
  });

  if (providerResult.status === "failed") {
    await input.store.recordAarProposalProviderFailure({
      idempotency_key: idempotencyKey,
      provider_result: providerResult,
      created_at: input.created_at
    });
    throw new Error(providerResult.failure_reason);
  }

  const materialized = await input.store.materializeAarProposal({
    idempotency_key: idempotencyKey,
    provider_result: providerResult,
    created_at: input.created_at
  });
  if (materialized.status === "failed") {
    throw new Error(materialized.attempt.failure_reason ?? "aar_proposal_materialization_failed");
  }

  const sourceFinding = findingForRef(findings, providerResult.output.source_finding_refs[0]);
  if (!sourceFinding) {
    throw new Error("aar_proposal_source_finding_not_found");
  }
  const antiHackingFindings = (providerResult.output.anti_hacking_finding_refs ?? [])
    .map((findingRef) => findingForRef(findings, findingRef))
    .filter((finding): finding is AarFindingRecord => finding !== undefined);
  const run: AarOrchestrationRunRecord = {
    record_kind: "aar_orchestration_run",
    version: 1,
    aar_orchestration_run_id: `aar-orchestration-run-${suffix}`,
    researcher_ref: sourceFinding.researcher_ref,
    research_direction_ref: sourceFinding.research_direction_ref,
    trading_evaluation_task_ref: providerResult.output.trading_evaluation_task_ref,
    input_finding_refs: [
      ...providerResult.output.source_finding_refs,
      ...(providerResult.output.anti_hacking_finding_refs ?? [])
    ],
    input_lineage_refs: inputLineageRefsForSource(existingLineages, sourceFinding),
    output_artifact_proposal_ref: ref(
      "aar_artifact_proposal",
      materialized.proposal.aar_artifact_proposal_id
    ),
    output_runnable_artifact_ref: ref(
      "runnable_artifact",
      materialized.runnable_artifact.runnable_artifact_id
    ),
    output_lineage_ref: ref("aar_artifact_lineage", materialized.lineage.aar_artifact_lineage_id),
    trace_ref: providerResult.trace_ref,
    started_at: input.created_at ?? new Date().toISOString(),
    completed_at: input.created_at ?? new Date().toISOString(),
    status: "proposed",
    authority_status: "research_only"
  };

  await input.store.recordAarOrchestrationRun(run);

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
  lineages: AarArtifactLineageRecord[],
  sourceFinding: AarFindingRecord
): Ref[] | undefined {
  const lineageRefs = lineages
    .filter((lineage) =>
      lineage.source_finding_refs.some((findingRef) => findingRef.id === sourceFinding.aar_finding_id)
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((lineage) => ref("aar_artifact_lineage", lineage.aar_artifact_lineage_id));
  return lineageRefs.length ? lineageRefs : undefined;
}

function findingForRef(findings: AarFindingRecord[], findingRef: Ref): AarFindingRecord | undefined {
  return findings.find((finding) => finding.aar_finding_id === findingRef.id);
}

function defaultIdempotencyKey(
  task: TradingEvaluationTaskRecord,
  findings: AarFindingRecord[],
  lineages: AarArtifactLineageRecord[]
): string {
  return [
    task.trading_evaluation_task_id,
    ...findings.map((finding) => finding.aar_finding_id).sort(),
    ...lineages.map((lineage) => lineage.aar_artifact_lineage_id).sort()
  ].join(":");
}

function stableSuffix(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}
