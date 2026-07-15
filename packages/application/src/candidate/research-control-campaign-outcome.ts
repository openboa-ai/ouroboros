import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  researchControlCampaignPaperSlotOutcomeDigestInput,
  researchControlCampaignPaperSlotOutcomeHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignOutcomeArm,
  type ResearchControlCampaignOutcomeArmMetrics,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignOutcomeSlotResult,
  type ResearchControlCampaignPaperCandidateSlot,
  type ResearchControlCampaignPaperScheduleArm,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperScheduleSlot,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";

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

export interface ResearchControlCampaignOutcomeArmEvidence {
  armKind: ResearchControlCampaignArmKind;
  slotOutcomes: ResearchControlCampaignPaperSlotOutcomeRecord[];
}

export interface AdjudicateResearchControlCampaignOutcomeInput {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
  arms: readonly [
    ResearchControlCampaignOutcomeArmEvidence,
    ResearchControlCampaignOutcomeArmEvidence
  ];
  adjudicatedAt: string;
}

export class ResearchControlCampaignOutcomeDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_outcome_decision_input";

  constructor() {
    super("ResearchControlCampaignOutcome decision input is invalid.");
    this.name = "ResearchControlCampaignOutcomeDecisionError";
  }
}

export type ResearchControlCampaignOutcomeServiceErrorCode =
  | "research_control_campaign_outcome_graph_invalid"
  | "research_control_campaign_outcome_conflict"
  | "research_control_campaign_outcome_persistence_conflict";

export class ResearchControlCampaignOutcomeServiceError extends Error {
  constructor(
    readonly code: ResearchControlCampaignOutcomeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlCampaignOutcomeServiceError";
  }
}

export class ResearchControlCampaignOutcomeService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async replay(input: {
    campaign: ResearchControlCampaignRecord;
    report: ResearchControlCampaignReportRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
  }): Promise<ResearchControlCampaignOutcomeRecord | undefined> {
    const existing = await this.options.store.getResearchControlCampaignOutcome(
      researchControlCampaignOutcomeId(input.report)
    );
    if (!existing) return undefined;
    if (!outcomeMatchesGraph(
      existing,
      input.campaign,
      input.report,
      input.schedule
    ) || !await this.storeGraphMatches(
      input.campaign,
      input.report,
      input.schedule
    )) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_conflict",
        "Persisted ResearchControlCampaignOutcome conflicts with its frozen graph."
      );
    }
    return existing;
  }

  async adjudicate(
    input: Omit<AdjudicateResearchControlCampaignOutcomeInput, "adjudicatedAt">
  ): Promise<ResearchControlCampaignOutcomeRecord> {
    const replay = await this.replay({
      campaign: input.campaign,
      report: input.report,
      schedule: input.schedule
    });
    if (replay) return replay;

    if (!await this.storeGraphMatches(
      input.campaign,
      input.report,
      input.schedule
    ) || !await this.slotOutcomesMatchStore(input.arms)) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_graph_invalid",
        "ResearchControlCampaignOutcome source graph is absent or mismatched."
      );
    }
    const outcome = adjudicateResearchControlCampaignOutcome({
      ...input,
      adjudicatedAt: this.now()
    });
    const recorded = await this.options.store.recordResearchControlCampaignOutcome(
      outcome
    );
    if (!isDeepStrictEqual(recorded, outcome) || !outcomeMatchesGraph(
      recorded,
      input.campaign,
      input.report,
      input.schedule
    )) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaignOutcome evidence."
      );
    }
    return recorded;
  }

  private async storeGraphMatches(
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord,
    schedule: ResearchControlCampaignPaperScheduleRecord
  ): Promise<boolean> {
    const [storedCampaign, storedReport, storedSchedule] = await Promise.all([
      this.options.store.getResearchControlCampaign(
        campaign.research_control_campaign_id
      ),
      this.options.store.getResearchControlCampaignReport(
        report.research_control_campaign_report_id
      ),
      this.options.store.getResearchControlCampaignPaperSchedule(
        schedule.research_control_campaign_paper_schedule_id
      )
    ]);
    return isDeepStrictEqual(storedCampaign, campaign) &&
      isDeepStrictEqual(storedReport, report) &&
      isDeepStrictEqual(storedSchedule, schedule);
  }

  private async slotOutcomesMatchStore(
    arms: readonly [
      ResearchControlCampaignOutcomeArmEvidence,
      ResearchControlCampaignOutcomeArmEvidence
    ]
  ): Promise<boolean> {
    const outcomes = arms.flatMap((arm) => arm.slotOutcomes);
    const stored = await Promise.all(outcomes.map((outcome) =>
      this.options.store.getResearchControlCampaignPaperSlotOutcome(
        outcome.research_control_campaign_paper_slot_outcome_id
      )
    ));
    return stored.every((record, index) =>
      isDeepStrictEqual(record, outcomes[index])
    );
  }
}

export function adjudicateResearchControlCampaignOutcome(
  input: AdjudicateResearchControlCampaignOutcomeInput
): ResearchControlCampaignOutcomeRecord {
  try {
    assertSourceGraph(input);
    const adjudicatedAt = canonicalTime(input.adjudicatedAt);
    const arms: [
      ResearchControlCampaignOutcomeArm,
      ResearchControlCampaignOutcomeArm
    ] = [
      buildOutcomeArm(
        input,
        input.report.arms[0],
        input.schedule.arms[0],
        input.arms[0],
        adjudicatedAt
      ),
      buildOutcomeArm(
        input,
        input.report.arms[1],
        input.schedule.arms[1],
        input.arms[1],
        adjudicatedAt
      )
    ];
    const observedRateDifference = round6(
      arms[0].metrics.qualified_discovery_rate -
        arms[1].metrics.qualified_discovery_rate
    );
    const record: ResearchControlCampaignOutcomeRecord = {
      record_kind: "research_control_campaign_outcome",
      version: 1,
      research_control_campaign_outcome_id:
        researchControlCampaignOutcomeId(input.report),
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
      schedule_ref: {
        record_kind: "research_control_campaign_paper_schedule",
        id: input.schedule.research_control_campaign_paper_schedule_id
      },
      schedule_digest: input.schedule.schedule_digest,
      paper_comparator: structuredClone(input.campaign.paper_comparator),
      shared_evaluation_policy_status: "bound",
      shared_evaluation_policy_digest:
        input.campaign.paper_evaluation_protocol.protocol_digest,
      arms,
      observed_rate_difference: observedRateDifference,
      observed_result: observedRateDifference > 0
        ? "adaptive_rate_higher"
        : observedRateDifference < 0
        ? "static_rate_higher"
        : "rates_equal",
      causal_conclusion: "single_campaign_observation_only",
      policy_replacement_eligibility: "not_eligible",
      next_action: "accumulate_replicated_control_campaigns",
      adjudicated_at: adjudicatedAt,
      outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.outcome_digest = canonicalDigest(
      researchControlCampaignOutcomeDigestInput(record)
    );
    if (!researchControlCampaignOutcomeHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignOutcomeDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchControlCampaignOutcomeId(
  report: ResearchControlCampaignReportRecord
): string {
  const id = canonicalString(report?.research_control_campaign_report_id);
  return `research-control-campaign-outcome-${digestHex(id).slice(0, 20)}`;
}

function assertSourceGraph(
  input: AdjudicateResearchControlCampaignOutcomeInput
): asserts input is AdjudicateResearchControlCampaignOutcomeInput & {
  campaign: BoundResearchControlCampaign;
} {
  if (!input || !researchControlCampaignHasRuntimeShape(input.campaign) ||
    !researchControlCampaignReportHasRuntimeShape(input.report) ||
    !researchControlCampaignPaperScheduleHasRuntimeShape(input.schedule) ||
    input.campaign.paper_comparator.comparator_status !== "trading_review" ||
    input.campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
    canonicalDigest(researchControlCampaignDigestInput(input.campaign)) !==
      input.campaign.campaign_digest || canonicalDigest(
        researchControlCampaignPaperEvaluationProtocolDigestInput(
          input.campaign.paper_evaluation_protocol
        )
      ) !== input.campaign.paper_evaluation_protocol.protocol_digest ||
    canonicalDigest(researchControlCampaignReportDigestInput(input.report)) !==
      input.report.report_digest || canonicalDigest(
        researchControlCampaignPaperScheduleDigestInput(input.schedule)
      ) !== input.schedule.schedule_digest ||
    !paperTradingComparisonRefsEqual(input.report.campaign_ref, {
      record_kind: "research_control_campaign",
      id: input.campaign.research_control_campaign_id
    }) || input.report.campaign_digest !== input.campaign.campaign_digest ||
    !paperTradingComparisonRefsEqual(input.schedule.campaign_ref, {
      record_kind: "research_control_campaign",
      id: input.campaign.research_control_campaign_id
    }) || input.schedule.campaign_digest !== input.campaign.campaign_digest ||
    !paperTradingComparisonRefsEqual(input.schedule.report_ref, {
      record_kind: "research_control_campaign_report",
      id: input.report.research_control_campaign_report_id
    }) || input.schedule.report_digest !== input.report.report_digest ||
    !isDeepStrictEqual(
      input.schedule.paper_comparator,
      input.campaign.paper_comparator
    ) || input.schedule.paper_evaluation_protocol_digest !==
      input.campaign.paper_evaluation_protocol.protocol_digest ||
    Date.parse(input.report.completed_at) <
      Date.parse(input.campaign.committed_at) ||
    Date.parse(input.schedule.committed_at) <
      Date.parse(input.report.completed_at) ||
    input.report.arms.some((reportArm, armIndex) =>
      !scheduleArmMatchesReport(input.schedule.arms[armIndex]!, reportArm)
    ) || !Array.isArray(input.arms) || input.arms.length !== 2 ||
    input.arms[0]?.armKind !== "adaptive_treatment" ||
    input.arms[1]?.armKind !== "static_control") {
    throw invalidDecision();
  }
}

function scheduleArmMatchesReport(
  scheduleArm: ResearchControlCampaignPaperScheduleArm,
  reportArm: ResearchControlCampaignReportRecord["arms"][number]
): boolean {
  return scheduleArm.arm_kind === reportArm.arm_kind &&
    scheduleArm.slots.length === reportArm.paper_candidate_slots.length &&
    scheduleArm.slots.every((slot, index) =>
      scheduleSlotMatchesReport(slot, reportArm.paper_candidate_slots[index]!)
    );
}

function scheduleSlotMatchesReport(
  scheduleSlot: ResearchControlCampaignPaperScheduleSlot,
  reportSlot: ResearchControlCampaignPaperCandidateSlot
): boolean {
  if (scheduleSlot.sequence !== reportSlot.sequence ||
    !paperTradingComparisonRefsEqual(scheduleSlot.tick_ref, reportSlot.tick_ref) ||
    scheduleSlot.slot_status === "no_admitted_candidate" ||
    reportSlot.status === "no_admitted_candidate") {
    return scheduleSlot.slot_status === "no_admitted_candidate" &&
      reportSlot.status === "no_admitted_candidate";
  }
  return paperTradingComparisonRefsEqual(
    scheduleSlot.candidate_ref,
    reportSlot.candidate_ref
  ) && paperTradingComparisonRefsEqual(
    scheduleSlot.candidate_version_ref,
    reportSlot.candidate_version_ref
  ) && paperTradingComparisonRefsEqual(
    scheduleSlot.system_code_ref,
    reportSlot.system_code_ref
  ) && scheduleSlot.system_code_artifact_digest ===
    reportSlot.system_code_artifact_digest &&
    paperTradingComparisonRefsEqual(
      scheduleSlot.admission_decision_ref,
      reportSlot.admission_decision_ref
    );
}

function buildOutcomeArm(
  input: AdjudicateResearchControlCampaignOutcomeInput & {
    campaign: BoundResearchControlCampaign;
  },
  reportArm: ResearchControlCampaignReportRecord["arms"][number],
  scheduleArm: ResearchControlCampaignPaperScheduleArm,
  evidence: ResearchControlCampaignOutcomeArmEvidence,
  adjudicatedAt: string
): ResearchControlCampaignOutcomeArm {
  if (!evidence || evidence.armKind !== reportArm.arm_kind ||
    scheduleArm.arm_kind !== reportArm.arm_kind ||
    !Array.isArray(evidence.slotOutcomes)) {
    throw invalidDecision();
  }
  const outcomes = uniqueOutcomeMap(evidence.slotOutcomes);
  const slotResults = reportArm.paper_candidate_slots.map((reportSlot, index) => {
    const scheduleSlot = scheduleArm.slots[index]!;
    const key = slotKey(reportSlot.sequence, reportSlot.tick_ref);
    const slotOutcome = outcomes.get(key);
    if (reportSlot.status === "no_admitted_candidate") {
      if (slotOutcome || scheduleSlot.slot_status !== "no_admitted_candidate") {
        throw invalidDecision();
      }
      return {
        sequence: reportSlot.sequence,
        tick_ref: { ...reportSlot.tick_ref },
        terminal_status: "no_admitted_candidate",
        discovery_credit: 0
      } satisfies ResearchControlCampaignOutcomeSlotResult;
    }
    if (!slotOutcome || scheduleSlot.slot_status !== "candidate_scheduled") {
      throw invalidDecision();
    }
    outcomes.delete(key);
    return buildPaperSlotResult(
      input.schedule,
      scheduleSlot,
      slotOutcome,
      adjudicatedAt
    );
  });
  if (outcomes.size !== 0) throw invalidDecision();
  return {
    arm_kind: reportArm.arm_kind,
    allocation_mode: reportArm.allocation_mode,
    slot_results: slotResults,
    metrics: buildMetrics(slotResults)
  };
}

function buildPaperSlotResult(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >,
  outcome: ResearchControlCampaignPaperSlotOutcomeRecord,
  adjudicatedAt: string
): ResearchControlCampaignOutcomeSlotResult {
  if (!researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome) ||
    canonicalDigest(
      researchControlCampaignPaperSlotOutcomeDigestInput(outcome)
    ) !== outcome.slot_outcome_digest ||
    !paperTradingComparisonRefsEqual(outcome.schedule_ref, {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    }) || outcome.schedule_digest !== schedule.schedule_digest ||
    outcome.sequence !== slot.sequence ||
    !paperTradingComparisonRefsEqual(outcome.tick_ref, slot.tick_ref) ||
    !paperTradingComparisonRefsEqual(outcome.candidate_ref, slot.candidate_ref) ||
    !paperTradingComparisonRefsEqual(
      outcome.candidate_version_ref,
      slot.candidate_version_ref
    ) || !paperTradingComparisonRefsEqual(
      outcome.system_code_ref,
      slot.system_code_ref
    ) || outcome.system_code_artifact_digest !==
      slot.system_code_artifact_digest ||
    !paperTradingComparisonRefsEqual(
      outcome.admission_decision_ref,
      slot.admission_decision_ref
    ) || outcome.source_comparison_idempotency_key !==
      slot.source_comparison_idempotency_key ||
    outcome.source_preparation_id !== slot.source_preparation_id ||
    outcome.source_comparison_commitment_id !==
      slot.source_comparison_commitment_id ||
    Date.parse(outcome.terminal_at) < Date.parse(schedule.committed_at) ||
    Date.parse(adjudicatedAt) < Date.parse(outcome.terminal_at)) {
    throw invalidDecision();
  }
  const terminalStatus = outcome.terminal_evidence.terminal_status;
  return {
    sequence: slot.sequence,
    tick_ref: { ...slot.tick_ref },
    terminal_status: terminalStatus,
    candidate_ref: { ...slot.candidate_ref },
    candidate_version_ref: { ...slot.candidate_version_ref },
    system_code_ref: { ...slot.system_code_ref },
    system_code_artifact_digest: slot.system_code_artifact_digest,
    paper_slot_outcome_ref: {
      record_kind: "research_control_campaign_paper_slot_outcome",
      id: outcome.research_control_campaign_paper_slot_outcome_id
    },
    paper_slot_outcome_digest: outcome.slot_outcome_digest,
    discovery_credit: terminalStatus === "qualified_improvement" ? 1 : 0
  };
}

function buildMetrics(
  slots: readonly ResearchControlCampaignOutcomeSlotResult[]
): ResearchControlCampaignOutcomeArmMetrics {
  const count = (status: ResearchControlCampaignOutcomeSlotResult["terminal_status"]) =>
    slots.filter((slot) => slot.terminal_status === status).length;
  const noCandidate = count("no_admitted_candidate");
  const qualified = count("qualified_improvement");
  return {
    slot_count: slots.length,
    admitted_candidate_slot_count: slots.length - noCandidate,
    no_admitted_candidate_count: noCandidate,
    qualified_discovery_count: qualified,
    source_not_improved_count: count("source_not_improved"),
    not_reproduced_count: count("not_reproduced"),
    evidence_ineligible_count: count("evidence_ineligible"),
    paper_slot_expired_count: count("paper_slot_expired"),
    qualified_discovery_rate: round6(qualified / slots.length)
  };
}

function uniqueOutcomeMap(
  outcomes: ResearchControlCampaignPaperSlotOutcomeRecord[]
): Map<string, ResearchControlCampaignPaperSlotOutcomeRecord> {
  const result = new Map<string, ResearchControlCampaignPaperSlotOutcomeRecord>();
  const ids = new Set<string>();
  for (const outcome of outcomes) {
    if (!outcome || ids.has(
      outcome.research_control_campaign_paper_slot_outcome_id
    )) {
      throw invalidDecision();
    }
    const key = slotKey(outcome.sequence, outcome.tick_ref);
    if (result.has(key)) throw invalidDecision();
    ids.add(outcome.research_control_campaign_paper_slot_outcome_id);
    result.set(key, outcome);
  }
  return result;
}

function slotKey(
  sequence: number,
  tickRef: { record_kind: string; id: string }
): string {
  if (!Number.isInteger(sequence) || sequence < 1 ||
    tickRef?.record_kind !== "candidate_arena_tick" ||
    !canonicalStringOrUndefined(tickRef.id)) {
    throw invalidDecision();
  }
  return `${sequence}:${tickRef.record_kind}:${tickRef.id}`;
}

function outcomeMatchesGraph(
  outcome: ResearchControlCampaignOutcomeRecord,
  campaign: ResearchControlCampaignRecord,
  report: ResearchControlCampaignReportRecord,
  schedule: ResearchControlCampaignPaperScheduleRecord
): boolean {
  return researchControlCampaignOutcomeHasRuntimeShape(outcome) &&
    canonicalDigest(researchControlCampaignOutcomeDigestInput(outcome)) ===
      outcome.outcome_digest && paperTradingComparisonRefsEqual(
        outcome.campaign_ref,
        {
          record_kind: "research_control_campaign",
          id: campaign.research_control_campaign_id
        }
      ) && outcome.campaign_digest === campaign.campaign_digest &&
    paperTradingComparisonRefsEqual(outcome.report_ref, {
      record_kind: "research_control_campaign_report",
      id: report.research_control_campaign_report_id
    }) && outcome.report_digest === report.report_digest &&
    paperTradingComparisonRefsEqual(outcome.schedule_ref, {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    }) && outcome.schedule_digest === schedule.schedule_digest &&
    isDeepStrictEqual(outcome.paper_comparator, campaign.paper_comparator);
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
  if (!canonicalStringOrUndefined(value) || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalStringOrUndefined(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) &&
    value.trim() === value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function invalidDecision(): ResearchControlCampaignOutcomeDecisionError {
  return new ResearchControlCampaignOutcomeDecisionError();
}
