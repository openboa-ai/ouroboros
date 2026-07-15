import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { researchControlStudyConditionFromCampaign } from
  "@ouroboros/application/candidate/research-control-study";
import { decideResearchControlStudyOutcome } from
  "@ouroboros/application/candidate/research-control-study-outcome";

export type ResearchControlStudyNextAction =
  | {
      action: "run_campaign";
      replicationIndex: number;
      campaignId: string;
      campaignIdempotencyKey: string;
      resume: boolean;
    }
  | { action: "adjudicate_study" }
  | { action: "complete" };

export interface ResearchControlStudyReplicationEvidence {
  replicationIndex: number;
  campaign?: ResearchControlCampaignRecord;
  outcome?: ResearchControlCampaignOutcomeRecord;
}

export interface ProjectResearchControlStudyNextActionInput {
  study: ResearchControlStudyRecord;
  replications: ResearchControlStudyReplicationEvidence[];
  studyOutcome?: ResearchControlStudyOutcomeRecord;
}

export class ResearchControlStudyNextActionError extends Error {
  readonly code = "research_control_study_next_action_graph_invalid";

  constructor(message: string) {
    super(message);
    this.name = "ResearchControlStudyNextActionError";
  }
}

export function projectResearchControlStudyNextAction(
  input: ProjectResearchControlStudyNextActionInput
): ResearchControlStudyNextAction {
  const study = validateStudy(input?.study);
  if (!Array.isArray(input?.replications) ||
    input.replications.length !== study.replications.length) {
    throw invalidGraph("Study replication evidence cardinality is invalid.");
  }
  let firstIncomplete: number | undefined;
  const closures: Array<{
    campaign: ResearchControlCampaignRecord;
    outcome: ResearchControlCampaignOutcomeRecord;
  }> = [];
  const campaignIds = new Set<string>();
  const outcomeIds = new Set<string>();
  for (let index = 0; index < study.replications.length; index += 1) {
    const planned = study.replications[index]!;
    const evidence = input.replications[index];
    if (!evidence || !evidenceHasExactKeys(evidence) ||
      evidence.replicationIndex !== planned.replication_index) {
      throw invalidGraph("Study replication evidence ordering is invalid.");
    }
    if (!evidence.campaign) {
      if (evidence.outcome) {
        throw invalidGraph("Study outcome evidence has no campaign.");
      }
      firstIncomplete ??= index;
      continue;
    }
    if (firstIncomplete !== undefined) {
      throw invalidGraph("Study evidence crossed an incomplete replication.");
    }
    validateCampaign(study, planned, evidence.campaign);
    if (campaignIds.has(evidence.campaign.research_control_campaign_id)) {
      throw invalidGraph("Study campaign evidence is duplicated.");
    }
    campaignIds.add(evidence.campaign.research_control_campaign_id);
    if (!evidence.outcome) {
      firstIncomplete = index;
      continue;
    }
    validateCampaignOutcome(evidence.campaign, evidence.outcome);
    if (outcomeIds.has(
      evidence.outcome.research_control_campaign_outcome_id
    )) {
      throw invalidGraph("Study campaign outcome evidence is duplicated.");
    }
    outcomeIds.add(evidence.outcome.research_control_campaign_outcome_id);
    closures.push({
      campaign: evidence.campaign,
      outcome: evidence.outcome
    });
  }

  if (input.studyOutcome) {
    if (firstIncomplete !== undefined || closures.length !==
        study.replications.length) {
      throw invalidGraph("Study outcome precedes complete source closure.");
    }
    validateStudyOutcome(study, closures, input.studyOutcome);
    return { action: "complete" };
  }
  if (firstIncomplete === undefined) {
    return { action: "adjudicate_study" };
  }
  const planned = study.replications[firstIncomplete]!;
  const evidence = input.replications[firstIncomplete]!;
  return {
    action: "run_campaign",
    replicationIndex: planned.replication_index,
    campaignId: planned.campaign_ref.id,
    campaignIdempotencyKey: planned.campaign_idempotency_key,
    resume: evidence.campaign !== undefined
  };
}

function validateStudy(value: unknown): ResearchControlStudyRecord {
  if (!researchControlStudyHasRuntimeShape(value) ||
    canonicalDigest(researchControlStudyConditionDigestInput(
      value.condition
    )) !== value.condition.condition_digest ||
    canonicalDigest(researchControlStudyDigestInput(value)) !==
      value.study_digest) {
    throw invalidGraph("ResearchControlStudy is malformed or corrupt.");
  }
  return value;
}

function validateCampaign(
  study: ResearchControlStudyRecord,
  planned: ResearchControlStudyRecord["replications"][number],
  campaign: ResearchControlCampaignRecord
): void {
  let condition;
  try {
    condition = researchControlStudyConditionFromCampaign(campaign);
  } catch {
    throw invalidGraph("Planned campaign is malformed or corrupt.");
  }
  if (!researchControlCampaignHasRuntimeShape(campaign) ||
    canonicalDigest(researchControlCampaignDigestInput(campaign)) !==
      campaign.campaign_digest ||
    campaign.research_control_campaign_id !== planned.campaign_ref.id ||
    campaign.idempotency_key !== planned.campaign_idempotency_key ||
    campaign.baseline.snapshot_digest !==
      planned.expected_baseline_snapshot_digest ||
    Date.parse(campaign.committed_at) <= Date.parse(study.committed_at) ||
    !isDeepStrictEqual(condition, study.condition)) {
    throw invalidGraph("Planned campaign differs from its study commitment.");
  }
}

function validateCampaignOutcome(
  campaign: ResearchControlCampaignRecord,
  outcome: ResearchControlCampaignOutcomeRecord
): void {
  if (!researchControlCampaignOutcomeHasRuntimeShape(outcome) ||
    canonicalDigest(researchControlCampaignOutcomeDigestInput(outcome)) !==
      outcome.outcome_digest ||
    outcome.campaign_ref.id !== campaign.research_control_campaign_id ||
    outcome.campaign_digest !== campaign.campaign_digest ||
    Date.parse(outcome.adjudicated_at) < Date.parse(campaign.committed_at)) {
    throw invalidGraph("Campaign outcome differs from its campaign.");
  }
}

function validateStudyOutcome(
  study: ResearchControlStudyRecord,
  closures: Array<{
    campaign: ResearchControlCampaignRecord;
    outcome: ResearchControlCampaignOutcomeRecord;
  }>,
  outcome: ResearchControlStudyOutcomeRecord
): void {
  if (!researchControlStudyOutcomeHasRuntimeShape(outcome) ||
    canonicalDigest(researchControlStudyOutcomeDigestInput(outcome)) !==
      outcome.study_outcome_digest || outcome.study_ref.id !==
      study.research_control_study_id || outcome.study_digest !==
      study.study_digest) {
    throw invalidGraph("ResearchControlStudyOutcome is malformed or mismatched.");
  }
  let expected;
  try {
    expected = decideResearchControlStudyOutcome({
      study,
      replications: closures,
      adjudicatedAt: outcome.adjudicated_at
    });
  } catch {
    throw invalidGraph("ResearchControlStudyOutcome source graph is invalid.");
  }
  if (!isDeepStrictEqual(expected, outcome)) {
    throw invalidGraph("ResearchControlStudyOutcome differs from exact inference.");
  }
}

function evidenceHasExactKeys(
  evidence: ResearchControlStudyReplicationEvidence
): boolean {
  const expected = [
    "replicationIndex",
    ...(evidence.campaign ? ["campaign"] : []),
    ...(evidence.outcome ? ["outcome"] : [])
  ].sort();
  return isDeepStrictEqual(Object.keys(evidence).sort(), expected);
}

function canonicalDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function invalidGraph(message: string): ResearchControlStudyNextActionError {
  return new ResearchControlStudyNextActionError(message);
}
