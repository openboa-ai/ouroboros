import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  researchControlCampaignPaperStartBatchDigestInput,
  researchControlCampaignPaperStartBatchHasRuntimeShape,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonTickRecord,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperScheduleSlot,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignPaperStartBatchSide,
  type ResearchControlCampaignRecord
} from "@ouroboros/domain";

type BoundResearchControlCampaign = ResearchControlCampaignRecord & {
  paper_comparator: Extract<
    ResearchControlCampaignRecord["paper_comparator"],
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignRecord["paper_evaluation_protocol"],
    { protocol_status: "bound" }
  >;
};

export interface ResearchControlCampaignPaperStartBatchSource {
  armKind: ResearchControlCampaignArmKind;
  comparison: PaperTradingComparisonCommitmentRecord;
  firstTick?: PaperTradingComparisonTickRecord;
}

export interface DecideResearchControlCampaignPaperStartBatchInput {
  campaign: ResearchControlCampaignRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
  sequence: number;
  sources: ResearchControlCampaignPaperStartBatchSource[];
  sourceStartDeadlineAt: string;
  evaluatedAt: string;
}

export class ResearchControlCampaignPaperStartBatchDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_paper_start_batch_input";

  constructor() {
    super("ResearchControlCampaignPaperStartBatch decision input is invalid.");
    this.name = "ResearchControlCampaignPaperStartBatchDecisionError";
  }
}

export function decideResearchControlCampaignPaperStartBatch(
  input: DecideResearchControlCampaignPaperStartBatchInput
): ResearchControlCampaignPaperStartBatchRecord {
  try {
    const graph = assertSourceGraph(input);
    const evaluatedAt = canonicalTime(input.evaluatedAt);
    const sourceStartDeadlineAt = canonicalTime(input.sourceStartDeadlineAt);
    const evaluatedMs = Date.parse(evaluatedAt);
    const deadlineMs = Date.parse(sourceStartDeadlineAt);
    const ticks = graph.sources.flatMap((source) =>
      source.firstTick ? [source.firstTick] : []
    );
    const latestTickMs = Math.max(...ticks.map((tick) =>
      Date.parse(tick.observed_at)), Number.NEGATIVE_INFINITY);
    if (evaluatedMs < latestTickMs) throw invalidDecision();

    const sides = graph.sources.map(sourceSide);
    const common = {
      record_kind: "research_control_campaign_paper_start_batch" as const,
      version: 1 as const,
      research_control_campaign_paper_start_batch_id:
        researchControlCampaignPaperStartBatchId(input.schedule, input.sequence),
      schedule_ref: {
        record_kind: "research_control_campaign_paper_schedule" as const,
        id: input.schedule.research_control_campaign_paper_schedule_id
      },
      schedule_digest: input.schedule.schedule_digest,
      sequence: input.sequence,
      sides,
      source_start_deadline_at: sourceStartDeadlineAt,
      evaluated_at: evaluatedAt,
      start_batch_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems" as const,
      promotion_authority: false as const,
      order_submission_authority: false as const,
      live_exchange_authority: false as const,
      authority_status: "not_live" as const
    };
    let record: ResearchControlCampaignPaperStartBatchRecord;
    if (ticks.length < graph.sources.length) {
      if (evaluatedMs < deadlineMs) throw invalidDecision();
      record = {
        ...common,
        batch_status: "ineligible",
        ineligible_reason: "first_tick_incomplete"
      };
    } else if (latestTickMs > deadlineMs) {
      record = {
        ...common,
        batch_status: "ineligible",
        ineligible_reason: "source_start_deadline_missed"
      };
    } else if (ticks.length === 2 && firstTicksMismatch(
      ticks[0]!,
      ticks[1]!,
      graph.campaign.paper_evaluation_protocol.schedule_policy
        .maximum_cross_arm_first_tick_skew_ms
    )) {
      record = {
        ...common,
        batch_status: "ineligible",
        ineligible_reason: "cross_arm_first_tick_mismatch"
      };
    } else {
      const anchor = ticks[0]!;
      record = {
        ...common,
        batch_status: ticks.length === 1 ? "single_ready" : "paired_ready",
        shared_market_snapshot_digest: canonicalDigest(anchor.market_snapshot),
        shared_public_execution_snapshot_digest: canonicalDigest(
          anchor.public_execution_snapshot
        )
      };
    }
    record.start_batch_digest = canonicalDigest(
      researchControlCampaignPaperStartBatchDigestInput(record)
    );
    if (!researchControlCampaignPaperStartBatchHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignPaperStartBatchDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchControlCampaignPaperStartBatchId(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  sequence: number
): string {
  const source = `${canonicalString(
    schedule?.research_control_campaign_paper_schedule_id
  )}:${canonicalSequence(sequence)}`;
  return `research-control-campaign-paper-start-batch-${
    digestHex(source).slice(0, 20)
  }`;
}

function assertSourceGraph(
  input: DecideResearchControlCampaignPaperStartBatchInput
): {
  campaign: BoundResearchControlCampaign;
  sources: ResearchControlCampaignPaperStartBatchSource[];
} {
  if (!input || !researchControlCampaignHasRuntimeShape(input.campaign) ||
    !researchControlCampaignPaperScheduleHasRuntimeShape(input.schedule) ||
    input.campaign.paper_comparator.comparator_status !== "trading_review" ||
    input.campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
    canonicalDigest(researchControlCampaignDigestInput(input.campaign)) !==
      input.campaign.campaign_digest || canonicalDigest(
        researchControlCampaignPaperEvaluationProtocolDigestInput(
          input.campaign.paper_evaluation_protocol
        )
      ) !== input.campaign.paper_evaluation_protocol.protocol_digest ||
    canonicalDigest(
      researchControlCampaignPaperScheduleDigestInput(input.schedule)
    ) !== input.schedule.schedule_digest ||
    !paperTradingComparisonRefsEqual(input.schedule.campaign_ref, {
      record_kind: "research_control_campaign",
      id: input.campaign.research_control_campaign_id
    }) || input.schedule.campaign_digest !== input.campaign.campaign_digest ||
    !isDeepStrictEqual(
      input.schedule.paper_comparator,
      input.campaign.paper_comparator
    ) || input.schedule.paper_evaluation_protocol_digest !==
      input.campaign.paper_evaluation_protocol.protocol_digest ||
    !Number.isInteger(input.sequence) || input.sequence < 1 ||
    !Array.isArray(input.sources)) {
    throw invalidDecision();
  }
  const campaign = input.campaign as BoundResearchControlCampaign;
  const slots = candidateSlotsForSequence(input.schedule, input.sequence);
  if (slots.length < 1 || slots.length > 2 ||
    input.sources.length !== slots.length) {
    throw invalidDecision();
  }
  const deadline = canonicalTime(input.sourceStartDeadlineAt);
  if (input.sequence === 1) {
    const delay = Math.max(...slots.map(({ slot }) =>
      slot.maximum_source_start_delay_ms
    ));
    const expected = new Date(
      Date.parse(input.schedule.committed_at) + delay
    ).toISOString();
    if (deadline !== expected) throw invalidDecision();
  } else if (Date.parse(deadline) <= Date.parse(input.schedule.committed_at)) {
    throw invalidDecision();
  }
  input.sources.forEach((source, index) => {
    const expected = slots[index]!;
    if (source.armKind !== expected.armKind ||
      !sourceComparisonMatches(
        source.comparison,
        expected.slot,
        campaign,
        deadline
      ) || source.firstTick && !firstTickMatches(
        source.firstTick,
        source.comparison
      )) {
      throw invalidDecision();
    }
  });
  return { campaign, sources: input.sources };
}

function candidateSlotsForSequence(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  sequence: number
): Array<{
  armKind: ResearchControlCampaignArmKind;
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >;
}> {
  return schedule.arms.flatMap((arm) => {
    const slot = arm.slots.find((candidate) => candidate.sequence === sequence);
    return slot?.slot_status === "candidate_scheduled"
      ? [{ armKind: arm.arm_kind, slot }]
      : [];
  });
}

function sourceComparisonMatches(
  comparison: PaperTradingComparisonCommitmentRecord,
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >,
  campaign: BoundResearchControlCampaign,
  deadline: string
): boolean {
  const selection = comparison?.champion_selection;
  return paperTradingComparisonCommitmentHasRuntimeShape(comparison) &&
    canonicalDigest(paperTradingComparisonCommitmentDigestInput(comparison)) ===
      comparison.commitment_digest &&
    comparison.paper_trading_comparison_commitment_id ===
      slot.source_comparison_commitment_id &&
    comparison.preparation_ref.id === slot.source_preparation_id &&
    paperTradingComparisonRefsEqual(
      comparison.champion.candidate_ref,
      campaign.paper_comparator.candidate_ref
    ) && paperTradingComparisonRefsEqual(
      comparison.champion.candidate_version_ref,
      campaign.paper_comparator.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(
      comparison.challenger.candidate_ref,
      slot.candidate_ref
    ) && paperTradingComparisonRefsEqual(
      comparison.challenger.candidate_version_ref,
      slot.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(
      comparison.challenger.system_code_ref,
      slot.system_code_ref
    ) && comparison.challenger.system_code_artifact_digest ===
      slot.system_code_artifact_digest && paperTradingComparisonRefsEqual(
        comparison.challenger.candidate_admission_decision_ref,
        slot.admission_decision_ref
      ) && selection.selection_kind === "trading_review" &&
    paperTradingComparisonRefsEqual(
      selection.trading_promotion_ref,
      campaign.paper_comparator.trading_promotion_ref
    ) && selection.trading_promotion_digest ===
      campaign.paper_comparator.trading_promotion_digest &&
    paperTradingComparisonRefsEqual(
      selection.paper_trading_evaluation_ref,
      campaign.paper_comparator.paper_trading_evaluation_ref
    ) && isDeepStrictEqual(
      comparison.comparison_policy,
      campaign.paper_evaluation_protocol.comparison_policy
    ) && comparison.market_data_configuration_digest ===
      campaign.paper_evaluation_protocol.market_data_configuration_digest &&
    isDeepStrictEqual(
      comparison.paper_policy_identity,
      campaign.paper_evaluation_protocol.paper_policy_identity
    ) && Date.parse(comparison.committed_at) >
      Date.parse(campaign.committed_at) && Date.parse(comparison.committed_at) <=
      Date.parse(deadline);
}

function firstTickMatches(
  tick: PaperTradingComparisonTickRecord,
  comparison: PaperTradingComparisonCommitmentRecord
): boolean {
  return paperTradingComparisonTickHasRuntimeShape(tick) &&
    canonicalDigest(paperTradingComparisonTickDigestInput(tick)) ===
      tick.tick_digest && tick.sequence === 1 &&
    paperTradingComparisonRefsEqual(
      tick.paper_trading_comparison_commitment_ref,
      {
        record_kind: "paper_trading_comparison_commitment",
        id: comparison.paper_trading_comparison_commitment_id
      }
    ) && tick.paper_trading_comparison_commitment_digest ===
      comparison.commitment_digest && tick.market_data_configuration_digest ===
      comparison.market_data_configuration_digest &&
    Date.parse(tick.observed_at) >= Date.parse(comparison.committed_at) &&
    Date.parse(tick.observed_at) >= Date.parse(tick.market_snapshot.observed_at) &&
    Date.parse(tick.observed_at) >=
      Date.parse(tick.public_execution_snapshot.observed_at);
}

function sourceSide(
  source: ResearchControlCampaignPaperStartBatchSource
): ResearchControlCampaignPaperStartBatchSide {
  return {
    arm_kind: source.armKind,
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: source.comparison.paper_trading_comparison_commitment_id
    },
    source_comparison_digest: source.comparison.commitment_digest,
    ...(source.firstTick ? {
      first_tick_ref: {
        record_kind: "paper_trading_comparison_tick" as const,
        id: source.firstTick.paper_trading_comparison_tick_id
      },
      first_tick_digest: source.firstTick.tick_digest,
      first_tick_observed_at: source.firstTick.observed_at
    } : {})
  };
}

function firstTicksMismatch(
  left: PaperTradingComparisonTickRecord,
  right: PaperTradingComparisonTickRecord,
  maximumSkewMs: number
): boolean {
  return Math.abs(Date.parse(left.observed_at) - Date.parse(right.observed_at)) >
      maximumSkewMs || !isDeepStrictEqual(
        left.market_snapshot,
        right.market_snapshot
      ) || !isDeepStrictEqual(
        left.public_execution_snapshot,
        right.public_execution_snapshot
      );
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${digestHex(text)}`;
}

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function canonicalString(value: unknown): string {
  if (typeof value !== "string" || !value || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalSequence(value: unknown): string {
  if (!Number.isInteger(value) || Number(value) < 1) throw invalidDecision();
  return String(value);
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function invalidDecision(): ResearchControlCampaignPaperStartBatchDecisionError {
  return new ResearchControlCampaignPaperStartBatchDecisionError();
}
