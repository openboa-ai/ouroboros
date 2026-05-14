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

export interface DeterministicArtifactChangeProposalPlannerInput {
  task: TradingEvaluationTaskRecord;
  findings: ResearchFindingRecord[];
  existing_lineages?: ArtifactLineageRecord[];
  parent_runnable_artifact_ref?: Ref;
  idempotency_key?: string;
  created_at?: string;
  artifact_path?: string;
  artifact_runtime_contract_ref?: Ref;
  secret_policy_ref?: Ref;
  capability_policy_ref?: Ref;
}

export interface DeterministicArtifactChangeProposalPlannerOutcome {
  run: ResearchOrchestrationRunRecord;
  proposal: ArtifactChangeProposalRecord;
  runnable_artifact: RunnableArtifactRecord;
  lineage: ArtifactLineageRecord;
  source_finding: ResearchFindingRecord;
  anti_hacking_findings: ResearchFindingRecord[];
}

export class DeterministicArtifactChangeProposalPlanner {
  plan(input: DeterministicArtifactChangeProposalPlannerInput): DeterministicArtifactChangeProposalPlannerOutcome {
    assertBacktestEvaluationTask(input.task);
    const sourceFinding = selectSourceFinding(input.findings);
    if (!sourceFinding) {
      throw new Error("no_eligible_research_finding");
    }

    const antiHackingFindings = input.findings
      .filter((finding) => finding.finding_kind === "anti_hacking_case")
      .sort(compareFindings);
    const parentRunnableArtifactRef = input.parent_runnable_artifact_ref
      ?? parentArtifactRefFromLineage(sourceFinding, input.existing_lineages);
    const createdAt = input.created_at ?? new Date().toISOString();
    const suffix = stableSuffix(input.idempotency_key ?? [
      input.task.trading_evaluation_task_id,
      sourceFinding.research_finding_id,
      parentRunnableArtifactRef?.id ?? "root"
    ].join(":"));
    const proposedArtifactRef = ref("runnable_artifact", `research-runnable-artifact-proposal-${suffix}`);
    const proposalRef = ref("artifact_change_proposal", `artifact-change-proposal-${suffix}`);
    const lineageRef = ref("artifact_lineage", `artifact-lineage-${suffix}`);
    const runRef = ref("research_orchestration_run", `research-orchestration-run-${suffix}`);
    const sourceFindingRef = ref("research_finding", sourceFinding.research_finding_id);
    const antiHackingFindingRefs = antiHackingFindings.map((finding) =>
      ref("research_finding", finding.research_finding_id)
    );
    const inputLineageRefs = (input.existing_lineages ?? [])
      .filter((lineage) => lineageIncludesFinding(lineage, sourceFinding.research_finding_id))
      .sort(compareLineages)
      .map((lineage) => ref("artifact_lineage", lineage.artifact_lineage_id));

    const proposal: ArtifactChangeProposalRecord = stripUndefined({
      record_kind: "artifact_change_proposal",
      version: 1,
      artifact_change_proposal_id: proposalRef.id,
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
      proposed_runnable_artifact_ref: proposedArtifactRef,
      parent_runnable_artifact_ref: parentRunnableArtifactRef,
      source_finding_refs: [sourceFindingRef],
      anti_hacking_finding_refs: antiHackingFindingRefs.length ? antiHackingFindingRefs : undefined,
      proposal_summary: `Fixture artifact change proposal from ${sourceFinding.research_finding_id}`,
      requested_change_summary: requestedChangeSummary(sourceFinding, antiHackingFindings),
      expected_improvement_summary: "Improve held-out generic trading robustness under the same sealed evaluator.",
      created_at: createdAt,
      status: "proposed",
      authority_status: "proposal_only"
    } satisfies ArtifactChangeProposalRecord);

    const runnableArtifact: RunnableArtifactRecord = {
      record_kind: "runnable_artifact",
      version: 1,
      runnable_artifact_id: proposedArtifactRef.id,
      artifact_kind: "python_file",
      artifact_path: input.artifact_path ?? "fixtures/trading-systems/clock.py",
      artifact_digest: `sha256:${stableDigest(proposal.artifact_change_proposal_id)}`,
      runtime_kind: "python",
      entrypoint: ["python", input.artifact_path ?? "fixtures/trading-systems/clock.py"],
      declared_output_contract: {
        contract_kind: "opaque_runtime_boundary",
        declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
      },
      artifact_runtime_contract_ref: input.artifact_runtime_contract_ref,
      secret_policy_ref: input.secret_policy_ref ?? ref("secret_policy", "no-raw-secrets"),
      capability_policy_ref: input.capability_policy_ref ?? ref("capability_policy", "fixture-artifact-change-proposal"),
      provenance_refs: [proposalRef, sourceFindingRef],
      status: "registered",
      created_at: createdAt,
      authority_status: "not_live"
    };

    const lineage: ArtifactLineageRecord = stripUndefined({
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: lineageRef.id,
      child_runnable_artifact_ref: proposedArtifactRef,
      parent_runnable_artifact_ref: parentRunnableArtifactRef,
      source_finding_refs: [sourceFindingRef],
      created_by_research_worker_ref: sourceFinding.research_worker_ref,
      created_at: createdAt,
      authority_status: "lineage_only"
    } satisfies ArtifactLineageRecord);

    const run: ResearchOrchestrationRunRecord = stripUndefined({
      record_kind: "research_orchestration_run",
      version: 1,
      research_orchestration_run_id: runRef.id,
      research_worker_ref: sourceFinding.research_worker_ref,
      research_direction_ref: sourceFinding.research_direction_ref,
      trading_evaluation_task_ref: ref("trading_evaluation_task", input.task.trading_evaluation_task_id),
      input_finding_refs: [sourceFindingRef, ...antiHackingFindingRefs],
      input_lineage_refs: inputLineageRefs.length ? inputLineageRefs : undefined,
      output_artifact_proposal_ref: proposalRef,
      output_runnable_artifact_ref: proposedArtifactRef,
      output_lineage_ref: lineageRef,
      trace_ref: ref("trace_placeholder", `trace-research-orchestration-${suffix}`),
      started_at: createdAt,
      completed_at: createdAt,
      status: "proposed",
      authority_status: "research_only"
    } satisfies ResearchOrchestrationRunRecord);

    return {
      run,
      proposal,
      runnable_artifact: runnableArtifact,
      lineage,
      source_finding: sourceFinding,
      anti_hacking_findings: antiHackingFindings
    };
  }
}

function assertBacktestEvaluationTask(task: TradingEvaluationTaskRecord): void {
  if (task.market_scope !== "external_trading_api_fixture") {
    throw new Error("unsupported_market_scope");
  }
  if (task.stage !== "backtest") {
    throw new Error("unsupported_evaluation_stage");
  }
}

function selectSourceFinding(findings: ResearchFindingRecord[]): ResearchFindingRecord | undefined {
  return findings
    .filter((finding) =>
      finding.finding_kind === "next_artifact_hint" ||
      finding.finding_kind === "positive_result"
    )
    .sort(compareFindings)
    .at(-1);
}

function parentArtifactRefFromLineage(
  sourceFinding: ResearchFindingRecord,
  lineages: ArtifactLineageRecord[] = []
): Ref | undefined {
  return lineages
    .filter((lineage) => lineageIncludesFinding(lineage, sourceFinding.research_finding_id))
    .sort(compareLineages)
    .at(-1)
    ?.child_runnable_artifact_ref;
}

function requestedChangeSummary(
  sourceFinding: ResearchFindingRecord,
  antiHackingFindings: ResearchFindingRecord[]
): string {
  const constraintSuffix = antiHackingFindings.length
    ? ` Preserve anti-hacking constraints from ${antiHackingFindings.length} rejected finding(s).`
    : "";
  return `Continue from ${sourceFinding.finding_kind} while keeping the artifact opaque.${constraintSuffix}`;
}

function compareFindings(a: ResearchFindingRecord, b: ResearchFindingRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.research_finding_id.localeCompare(b.research_finding_id);
}

function compareLineages(a: ArtifactLineageRecord, b: ArtifactLineageRecord): number {
  const timeCompare = a.created_at.localeCompare(b.created_at);
  if (timeCompare !== 0) {
    return timeCompare;
  }
  return a.artifact_lineage_id.localeCompare(b.artifact_lineage_id);
}

function lineageIncludesFinding(lineage: ArtifactLineageRecord, findingId: string): boolean {
  return lineage.source_finding_refs.some((findingRef) => findingRef.id === findingId);
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function stableSuffix(value: string): string {
  return stableDigest(value).slice(0, 16);
}

function stableDigest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}
