import type { TradingEvaluationTaskRecord } from "@ouroboros/domain";
import type { LocalStore } from "@ouroboros/local-store";
import {
  DeterministicAarProposalPlanner,
  type DeterministicAarProposalPlannerOutcome
} from "./deterministic-proposal-planner";

export interface PlanAarProposalFromLocalStoreInput {
  store: LocalStore;
  task: TradingEvaluationTaskRecord;
  planner?: DeterministicAarProposalPlanner;
  idempotency_key?: string;
  created_at?: string;
}

export interface PlanAarProposalFromLocalStoreOutcome
  extends DeterministicAarProposalPlannerOutcome {}

export async function planAarProposalFromLocalStore(
  input: PlanAarProposalFromLocalStoreInput
): Promise<PlanAarProposalFromLocalStoreOutcome> {
  const findings = await input.store.listAarFindings();
  if (findings.length === 0) {
    throw new Error("no_aar_findings");
  }
  const existingLineages = await input.store.listAarArtifactLineages();
  const planner = input.planner ?? new DeterministicAarProposalPlanner();
  const outcome = planner.plan({
    task: input.task,
    findings,
    existing_lineages: existingLineages,
    idempotency_key: input.idempotency_key,
    created_at: input.created_at
  });

  await input.store.recordAarArtifactProposal(outcome.proposal);
  await input.store.recordRunnableArtifact(outcome.runnable_artifact);
  await input.store.recordAarArtifactLineage(outcome.lineage);
  await input.store.recordAarOrchestrationRun(outcome.run);

  return outcome;
}
