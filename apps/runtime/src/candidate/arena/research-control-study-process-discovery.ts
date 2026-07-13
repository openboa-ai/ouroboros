import { createHash } from "node:crypto";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { researchControlStudyOutcomeId } from
  "@ouroboros/application/candidate/research-control-study-outcome";

export class ResearchControlStudyProcessDiscoveryError extends Error {
  readonly code = "research_control_study_process_graph_invalid";

  constructor(message: string) {
    super(message);
    this.name = "ResearchControlStudyProcessDiscoveryError";
  }
}

export function discoverResearchControlStudyProcessQueue(input: {
  studies: ResearchControlStudyRecord[];
  outcomes: ResearchControlStudyOutcomeRecord[];
}): ResearchControlStudyRecord[] {
  if (!Array.isArray(input?.studies) || !Array.isArray(input?.outcomes)) {
    throw invalidGraph("ResearchControlStudy process discovery input is invalid.");
  }
  const studies = new Map<string, ResearchControlStudyRecord>();
  for (const study of input.studies) {
    validateStudy(study);
    if (studies.has(study.research_control_study_id)) {
      throw invalidGraph("ResearchControlStudy identity is duplicated.");
    }
    studies.set(study.research_control_study_id, study);
  }

  const outcomeIds = new Set<string>();
  const outcomesByStudy = new Map<string, ResearchControlStudyOutcomeRecord>();
  for (const outcome of input.outcomes) {
    validateOutcome(outcome);
    if (outcomeIds.has(outcome.research_control_study_outcome_id)) {
      throw invalidGraph("ResearchControlStudyOutcome identity is duplicated.");
    }
    outcomeIds.add(outcome.research_control_study_outcome_id);
    const study = studies.get(outcome.study_ref.id);
    if (!study) {
      throw invalidGraph("ResearchControlStudyOutcome has no source study.");
    }
    if (outcomesByStudy.has(study.research_control_study_id)) {
      throw invalidGraph("ResearchControlStudy has ambiguous outcomes.");
    }
    if (outcome.research_control_study_outcome_id !==
        researchControlStudyOutcomeId(study) ||
      outcome.study_digest !== study.study_digest ||
      Date.parse(outcome.adjudicated_at) < Date.parse(study.committed_at)) {
      throw invalidGraph("ResearchControlStudyOutcome differs from its study.");
    }
    outcomesByStudy.set(study.research_control_study_id, outcome);
  }

  return [...studies.values()]
    .filter((study) => !outcomesByStudy.has(study.research_control_study_id))
    .sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_control_study_id.localeCompare(
        right.research_control_study_id
      )
    )
    .map((study) => structuredClone(study));
}

function validateStudy(study: unknown): asserts study is ResearchControlStudyRecord {
  if (!researchControlStudyHasRuntimeShape(study) ||
    study.condition.condition_digest !== exactDigest(
      researchControlStudyConditionDigestInput(study.condition)
    ) || study.study_digest !== exactDigest(
      researchControlStudyDigestInput(study)
    ) || study.condition.allocation_policy_digest !== exactDigest(
      paperTradingComparisonPersistedRecordDigestInput(
        study.condition.allocation_policy
      )
    )) {
    throw invalidGraph("ResearchControlStudy is malformed or corrupt.");
  }
}

function validateOutcome(
  outcome: unknown
): asserts outcome is ResearchControlStudyOutcomeRecord {
  if (!researchControlStudyOutcomeHasRuntimeShape(outcome) ||
    outcome.study_outcome_digest !== exactDigest(
      researchControlStudyOutcomeDigestInput(outcome)
    )) {
    throw invalidGraph("ResearchControlStudyOutcome is malformed or corrupt.");
  }
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function invalidGraph(message: string): ResearchControlStudyProcessDiscoveryError {
  return new ResearchControlStudyProcessDiscoveryError(message);
}
