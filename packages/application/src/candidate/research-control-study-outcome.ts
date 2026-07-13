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
import type { OuroborosStorePort } from "../ports/store";
import { researchControlStudyConditionFromCampaign } from
  "./research-control-study";

export interface ResearchControlStudyReplicationClosure {
  campaign: ResearchControlCampaignRecord;
  outcome: ResearchControlCampaignOutcomeRecord;
}

export interface DecideResearchControlStudyOutcomeInput {
  study: ResearchControlStudyRecord;
  replications: ResearchControlStudyReplicationClosure[];
  adjudicatedAt: string;
}

export type ResearchControlStudyOutcomeAdjudicationRequest = Omit<
  DecideResearchControlStudyOutcomeInput,
  "adjudicatedAt"
>;

export class ResearchControlStudyOutcomeDecisionError extends Error {
  readonly code = "invalid_research_control_study_outcome_input";

  constructor() {
    super("ResearchControlStudyOutcome decision input is invalid.");
    this.name = "ResearchControlStudyOutcomeDecisionError";
  }
}

export type ResearchControlStudyOutcomeServiceErrorCode =
  | "research_control_study_outcome_graph_invalid"
  | "research_control_study_outcome_conflict"
  | "research_control_study_outcome_persistence_conflict";

export class ResearchControlStudyOutcomeServiceError extends Error {
  constructor(
    readonly code: ResearchControlStudyOutcomeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlStudyOutcomeServiceError";
  }
}

export class ResearchControlStudyOutcomeService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async adjudicate(
    input: ResearchControlStudyOutcomeAdjudicationRequest
  ): Promise<ResearchControlStudyOutcomeRecord> {
    if (!await this.storeGraphMatches(input)) {
      throw new ResearchControlStudyOutcomeServiceError(
        "research_control_study_outcome_graph_invalid",
        "ResearchControlStudyOutcome source graph is absent or mismatched."
      );
    }
    const outcomeId = researchControlStudyOutcomeId(input.study);
    const existing = await this.options.store.getResearchControlStudyOutcome(
      outcomeId
    );
    if (existing) {
      const requested = decideResearchControlStudyOutcome({
        ...input,
        adjudicatedAt: existing.adjudicated_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlStudyOutcomeServiceError(
          "research_control_study_outcome_conflict",
          "ResearchControlStudyOutcome conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const outcome = decideResearchControlStudyOutcome({
      ...input,
      adjudicatedAt: this.now()
    });
    const recorded = await this.options.store.recordResearchControlStudyOutcome(
      outcome
    );
    if (!researchControlStudyOutcomeHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, outcome)) {
      throw new ResearchControlStudyOutcomeServiceError(
        "research_control_study_outcome_persistence_conflict",
        "Store did not preserve exact ResearchControlStudyOutcome evidence."
      );
    }
    return recorded;
  }

  private async storeGraphMatches(
    input: ResearchControlStudyOutcomeAdjudicationRequest
  ): Promise<boolean> {
    const study = await this.options.store.getResearchControlStudy(
      input.study.research_control_study_id
    );
    if (!isDeepStrictEqual(study, input.study)) return false;
    const graphs = await Promise.all(input.replications.map(async (entry) => {
      const [campaign, outcome] = await Promise.all([
        this.options.store.getResearchControlCampaign(
          entry.campaign.research_control_campaign_id
        ),
        this.options.store.getResearchControlCampaignOutcome(
          entry.outcome.research_control_campaign_outcome_id
        )
      ]);
      return isDeepStrictEqual(campaign, entry.campaign) &&
        isDeepStrictEqual(outcome, entry.outcome);
    }));
    return graphs.every(Boolean);
  }
}

export function decideResearchControlStudyOutcome(
  input: DecideResearchControlStudyOutcomeInput
): ResearchControlStudyOutcomeRecord {
  try {
    assertStudyGraph(input);
    const adjudicatedAt = canonicalTime(input.adjudicatedAt);
    if (input.replications.some((entry) =>
      Date.parse(entry.outcome.adjudicated_at) > Date.parse(adjudicatedAt)
    )) {
      throw invalidDecision();
    }
    const differences = input.replications.map(
      (entry) => entry.outcome.observed_rate_difference
    );
    const adaptivePositive = differences.filter((value) => value > 0).length;
    const staticPositive = differences.filter((value) => value < 0).length;
    const tied = differences.length - adaptivePositive - staticPositive;
    const nonTied = adaptivePositive + staticPositive;
    const mean = round6(
      differences.reduce((sum, value) => sum + value, 0) /
        differences.length
    );
    const pValue = exactTwoSidedSignTestPValue(
      adaptivePositive,
      staticPositive
    );
    const supported = nonTied >=
        input.study.analysis_policy.minimum_non_tied_replication_count &&
      adaptivePositive > staticPositive &&
      pValue <= input.study.analysis_policy.alpha &&
      mean > input.study.analysis_policy.minimum_mean_rate_difference;
    const inference = nonTied <
        input.study.analysis_policy.minimum_non_tied_replication_count
      ? "insufficient_non_tied_replications" as const
      : supported
      ? "adaptive_effect_supported" as const
      : "adaptive_effect_not_supported" as const;
    const record: ResearchControlStudyOutcomeRecord = {
      record_kind: "research_control_study_outcome",
      version: 1,
      research_control_study_outcome_id: researchControlStudyOutcomeId(
        input.study
      ),
      study_ref: {
        record_kind: "research_control_study",
        id: input.study.research_control_study_id
      },
      study_digest: input.study.study_digest,
      replication_results: input.replications.map((entry, index) => ({
        replication_index: index + 1,
        campaign_ref: {
          record_kind: "research_control_campaign",
          id: entry.campaign.research_control_campaign_id
        },
        campaign_digest: entry.campaign.campaign_digest,
        campaign_outcome_ref: {
          record_kind: "research_control_campaign_outcome",
          id: entry.outcome.research_control_campaign_outcome_id
        },
        campaign_outcome_digest: entry.outcome.outcome_digest,
        observed_rate_difference: entry.outcome.observed_rate_difference
      })),
      planned_replication_count: differences.length,
      completed_replication_count: differences.length,
      adaptive_positive_count: adaptivePositive,
      static_positive_count: staticPositive,
      tied_count: tied,
      non_tied_count: nonTied,
      mean_rate_difference: mean,
      exact_sign_test_p_value: pValue,
      inference_status: inference,
      causal_scope: "same_baseline_stochastic_replication_only",
      policy_decision_eligibility: supported
        ? "eligible_for_separate_policy_decision"
        : "not_eligible",
      next_action: supported
        ? "review_research_allocation_policy"
        : "accumulate_or_redesign_precommitted_study",
      adjudicated_at: adjudicatedAt,
      study_outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.study_outcome_digest = canonicalDigest(
      researchControlStudyOutcomeDigestInput(record)
    );
    if (!researchControlStudyOutcomeHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlStudyOutcomeDecisionError) throw error;
    throw invalidDecision();
  }
}

export function exactTwoSidedSignTestPValue(
  adaptivePositive: number,
  staticPositive: number
): number {
  if (!Number.isInteger(adaptivePositive) || adaptivePositive < 0 ||
    !Number.isInteger(staticPositive) || staticPositive < 0 ||
    adaptivePositive + staticPositive > 30) {
    throw invalidDecision();
  }
  const count = adaptivePositive + staticPositive;
  if (count === 0) return 1;
  const lowerTail = Math.min(adaptivePositive, staticPositive);
  let combinations = 0;
  for (let index = 0; index <= lowerTail; index += 1) {
    combinations += combination(count, index);
  }
  return round6(Math.min(1, 2 * combinations / 2 ** count));
}

export function researchControlStudyOutcomeId(
  study: ResearchControlStudyRecord
): string {
  const studyId = canonicalString(study?.research_control_study_id);
  return `research-control-study-outcome-${digestHex(studyId).slice(0, 20)}`;
}

function assertStudyGraph(input: DecideResearchControlStudyOutcomeInput): void {
  if (!input || !researchControlStudyHasRuntimeShape(input.study) ||
    canonicalDigest(researchControlStudyConditionDigestInput(
      input.study.condition
    )) !== input.study.condition.condition_digest ||
    canonicalDigest(researchControlStudyDigestInput(input.study)) !==
      input.study.study_digest || !Array.isArray(input.replications) ||
    input.replications.length !== input.study.replications.length) {
    throw invalidDecision();
  }
  for (let index = 0; index < input.study.replications.length; index += 1) {
    const planned = input.study.replications[index]!;
    const closure = input.replications[index];
    if (!closure || !researchControlCampaignHasRuntimeShape(closure.campaign) ||
      canonicalDigest(researchControlCampaignDigestInput(closure.campaign)) !==
        closure.campaign.campaign_digest ||
      !researchControlCampaignOutcomeHasRuntimeShape(closure.outcome) ||
      canonicalDigest(researchControlCampaignOutcomeDigestInput(
        closure.outcome
      )) !== closure.outcome.outcome_digest ||
      planned.replication_index !== index + 1 ||
      closure.campaign.research_control_campaign_id !== planned.campaign_ref.id ||
      closure.campaign.idempotency_key !== planned.campaign_idempotency_key ||
      closure.campaign.baseline.snapshot_digest !==
        planned.expected_baseline_snapshot_digest ||
      Date.parse(closure.campaign.committed_at) <=
        Date.parse(input.study.committed_at) ||
      !isDeepStrictEqual(
        researchControlStudyConditionFromCampaign(closure.campaign),
        input.study.condition
      ) || closure.outcome.campaign_ref.id !==
        closure.campaign.research_control_campaign_id ||
      closure.outcome.campaign_digest !== closure.campaign.campaign_digest ||
      Date.parse(closure.outcome.adjudicated_at) <
        Date.parse(closure.campaign.committed_at)) {
      throw invalidDecision();
    }
  }
}

function combination(count: number, selected: number): number {
  let result = 1;
  for (let index = 1; index <= selected; index += 1) {
    result = result * (count - index + 1) / index;
  }
  return result;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function canonicalDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${digestHex(canonical)}`;
}

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function canonicalString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function invalidDecision(): ResearchControlStudyOutcomeDecisionError {
  return new ResearchControlStudyOutcomeDecisionError();
}
