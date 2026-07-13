import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  type ResearchControlCampaignArmReport,
  type ResearchControlCampaignPaperScheduleArm,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperScheduleSlot,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { paperTradingComparisonIdsForIdempotencyKey } from
  "../trading/paper/comparison-identity";

type SchedulableResearchControlCampaign = ResearchControlCampaignRecord & {
  paper_comparator: Extract<
    ResearchControlCampaignRecord["paper_comparator"],
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignRecord["paper_evaluation_protocol"],
    { protocol_status: "bound" }
  >;
};

export interface DecideResearchControlCampaignPaperScheduleInput {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  committedAt: string;
}

export type ResearchControlCampaignPaperScheduleCommitRequest = Omit<
  DecideResearchControlCampaignPaperScheduleInput,
  "committedAt"
>;

export class ResearchControlCampaignPaperScheduleDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_paper_schedule_input";

  constructor() {
    super("ResearchControlCampaignPaperSchedule decision input is invalid.");
    this.name = "ResearchControlCampaignPaperScheduleDecisionError";
  }
}

export type ResearchControlCampaignPaperScheduleServiceErrorCode =
  | "research_control_campaign_paper_schedule_graph_invalid"
  | "research_control_campaign_paper_schedule_conflict"
  | "research_control_campaign_paper_schedule_persistence_conflict";

export class ResearchControlCampaignPaperScheduleServiceError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperScheduleServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlCampaignPaperScheduleServiceError";
  }
}

export class ResearchControlCampaignPaperScheduleService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async commit(
    input: ResearchControlCampaignPaperScheduleCommitRequest
  ): Promise<ResearchControlCampaignPaperScheduleRecord> {
    if (!await this.storeGraphMatches(input.campaign, input.report)) {
      throw new ResearchControlCampaignPaperScheduleServiceError(
        "research_control_campaign_paper_schedule_graph_invalid",
        "ResearchControlCampaignPaperSchedule source graph is absent or mismatched."
      );
    }

    const scheduleId = researchControlCampaignPaperScheduleId(input.report);
    const existing = await this.options.store
      .getResearchControlCampaignPaperSchedule(scheduleId);
    if (existing) {
      const requested = decideResearchControlCampaignPaperSchedule({
        ...input,
        committedAt: existing.committed_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlCampaignPaperScheduleServiceError(
          "research_control_campaign_paper_schedule_conflict",
          "ResearchControlCampaignPaperSchedule conflicts with frozen evidence."
        );
      }
      return existing;
    }

    const schedule = decideResearchControlCampaignPaperSchedule({
      ...input,
      committedAt: this.now()
    });
    const recorded = await this.options.store
      .recordResearchControlCampaignPaperSchedule(schedule);
    if (!researchControlCampaignPaperScheduleHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, schedule)) {
      throw new ResearchControlCampaignPaperScheduleServiceError(
        "research_control_campaign_paper_schedule_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaignPaperSchedule evidence."
      );
    }
    return recorded;
  }

  private async storeGraphMatches(
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord
  ): Promise<boolean> {
    const [storedCampaign, storedReport] = await Promise.all([
      this.options.store.getResearchControlCampaign(
        campaign.research_control_campaign_id
      ),
      this.options.store.getResearchControlCampaignReport(
        report.research_control_campaign_report_id
      )
    ]);
    return isDeepStrictEqual(storedCampaign, campaign) &&
      isDeepStrictEqual(storedReport, report);
  }
}

export function decideResearchControlCampaignPaperSchedule(
  input: DecideResearchControlCampaignPaperScheduleInput
): ResearchControlCampaignPaperScheduleRecord {
  try {
    assertSourceGraph(input);
    const committedAt = canonicalTime(input.committedAt);
    if (Date.parse(committedAt) < Date.parse(input.report.completed_at)) {
      throw invalidDecision();
    }
    const maximumSourceStartDelayMs =
      input.campaign.paper_evaluation_protocol.comparison_policy
        .maximum_elapsed_ms;
    const record: ResearchControlCampaignPaperScheduleRecord = {
      record_kind: "research_control_campaign_paper_schedule",
      version: 1,
      research_control_campaign_paper_schedule_id:
        researchControlCampaignPaperScheduleId(input.report),
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: input.campaign.research_control_campaign_id
      },
      campaign_digest: input.campaign.campaign_digest,
      report_ref: {
        record_kind: "research_control_campaign_report",
        id: input.report.research_control_campaign_report_id
      },
      report_digest: input.report.report_digest,
      paper_comparator: structuredClone(input.campaign.paper_comparator),
      paper_evaluation_protocol_digest:
        input.campaign.paper_evaluation_protocol.protocol_digest,
      arms: [
        buildScheduleArm(
          input.campaign,
          input.report.arms[0],
          "adaptive",
          maximumSourceStartDelayMs
        ),
        buildScheduleArm(
          input.campaign,
          input.report.arms[1],
          "static",
          maximumSourceStartDelayMs
        )
      ],
      committed_at: committedAt,
      schedule_digest: pendingDigest(),
      paper_evaluation_scheduling_authority: true,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.schedule_digest = canonicalDigest(
      researchControlCampaignPaperScheduleDigestInput(record)
    );
    if (!researchControlCampaignPaperScheduleHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignPaperScheduleDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchControlCampaignPaperScheduleId(
  report: ResearchControlCampaignReportRecord
): string {
  const reportId = canonicalString(report?.research_control_campaign_report_id);
  return `research-control-campaign-paper-schedule-${
    digestHex(reportId).slice(0, 20)
  }`;
}

function assertSourceGraph(
  input: DecideResearchControlCampaignPaperScheduleInput
): asserts input is DecideResearchControlCampaignPaperScheduleInput & {
  campaign: SchedulableResearchControlCampaign;
} {
  if (!input || !researchControlCampaignHasRuntimeShape(input.campaign) ||
    !researchControlCampaignReportHasRuntimeShape(input.report) ||
    input.campaign.paper_comparator.comparator_status !== "trading_review" ||
    input.campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
    canonicalDigest(researchControlCampaignDigestInput(input.campaign)) !==
      input.campaign.campaign_digest || canonicalDigest(
        researchControlCampaignPaperEvaluationProtocolDigestInput(
          input.campaign.paper_evaluation_protocol
        )
      ) !== input.campaign.paper_evaluation_protocol.protocol_digest ||
    canonicalDigest(researchControlCampaignReportDigestInput(input.report)) !==
      input.report.report_digest || !paperTradingComparisonRefsEqual(
        input.report.campaign_ref,
        {
          record_kind: "research_control_campaign",
          id: input.campaign.research_control_campaign_id
        }
      ) || input.report.campaign_digest !== input.campaign.campaign_digest ||
    Date.parse(input.report.completed_at) <
      Date.parse(input.campaign.committed_at) ||
    input.report.arms.some((arm, index) =>
      !reportArmMatchesCampaign(arm, input.campaign.arms[index]!,
        input.campaign.policy.paper_candidate_slot_count_per_arm)
    )) {
    throw invalidDecision();
  }
}

function reportArmMatchesCampaign(
  reportArm: ResearchControlCampaignArmReport,
  campaignArm: ResearchControlCampaignRecord["arms"][number],
  slotCount: number
): boolean {
  return reportArm.arm_kind === campaignArm.arm_kind &&
    reportArm.allocation_mode === campaignArm.allocation_mode &&
    paperTradingComparisonRefsEqual(reportArm.arm_intent_ref, {
      record_kind: "research_control_campaign_arm_intent",
      id: campaignArm.research_control_campaign_arm_intent_id
    }) && reportArm.paper_candidate_slots.length === slotCount;
}

function buildScheduleArm(
  campaign: SchedulableResearchControlCampaign,
  reportArm: ResearchControlCampaignArmReport,
  armToken: "adaptive" | "static",
  maximumSourceStartDelayMs: number
): ResearchControlCampaignPaperScheduleArm {
  return {
    arm_kind: reportArm.arm_kind,
    slots: reportArm.paper_candidate_slots.map((slot) => {
      if (slot.status === "no_admitted_candidate") {
        return {
          sequence: slot.sequence,
          tick_ref: { ...slot.tick_ref },
          slot_status: "no_admitted_candidate"
        } satisfies ResearchControlCampaignPaperScheduleSlot;
      }
      const idempotencyKey = `research-control-paper:${
        campaign.research_control_campaign_id
      }:${armToken}:slot:${slot.sequence}:source`;
      const ids = paperTradingComparisonIdsForIdempotencyKey(idempotencyKey);
      return {
        sequence: slot.sequence,
        tick_ref: { ...slot.tick_ref },
        slot_status: "candidate_scheduled",
        candidate_ref: { ...slot.candidate_ref },
        candidate_version_ref: { ...slot.candidate_version_ref },
        system_code_ref: { ...slot.system_code_ref },
        system_code_artifact_digest: slot.system_code_artifact_digest,
        admission_decision_ref: { ...slot.admission_decision_ref },
        source_comparison_idempotency_key: idempotencyKey,
        source_preparation_id: ids.preparation_id,
        source_comparison_commitment_id: ids.comparison_commitment_id,
        maximum_source_start_delay_ms: maximumSourceStartDelayMs
      } satisfies ResearchControlCampaignPaperScheduleSlot;
    })
  };
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

function invalidDecision(): ResearchControlCampaignPaperScheduleDecisionError {
  return new ResearchControlCampaignPaperScheduleDecisionError();
}
