import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  researchControlCampaignPaperStartBatchDigestInput,
  researchControlCampaignPaperStartBatchHasRuntimeShape,
  researchControlCampaignPaperSlotOutcomeDigestInput,
  researchControlCampaignPaperSlotOutcomeHasRuntimeShape,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignPaperSlotTerminalEvidence
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { researchControlCampaignPaperStartBatchId } from
  "./research-control-campaign-paper-start-batch";

export interface DecideResearchControlCampaignPaperSlotOutcomeInput {
  schedule: ResearchControlCampaignPaperScheduleRecord;
  armKind: ResearchControlCampaignArmKind;
  sequence: number;
  terminalEvidence: ResearchControlCampaignPaperSlotTerminalEvidence;
  terminalAt: string;
}

export class ResearchControlCampaignPaperSlotOutcomeDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_paper_slot_outcome_input";

  constructor() {
    super("ResearchControlCampaignPaperSlotOutcome decision input is invalid.");
    this.name = "ResearchControlCampaignPaperSlotOutcomeDecisionError";
  }
}

export type ResearchControlCampaignPaperSlotOutcomeServiceErrorCode =
  | "research_control_campaign_paper_slot_outcome_graph_invalid"
  | "research_control_campaign_paper_slot_outcome_conflict"
  | "research_control_campaign_paper_slot_outcome_persistence_conflict";

export class ResearchControlCampaignPaperSlotOutcomeServiceError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperSlotOutcomeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlCampaignPaperSlotOutcomeServiceError";
  }
}

export class ResearchControlCampaignPaperSlotOutcomeService {
  constructor(private readonly options: { store: OuroborosStorePort }) {}

  async record(
    input: DecideResearchControlCampaignPaperSlotOutcomeInput
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    const storedSchedule = await this.options.store
      .getResearchControlCampaignPaperSchedule(
        input.schedule.research_control_campaign_paper_schedule_id
      );
    if (!isDeepStrictEqual(storedSchedule, input.schedule)) {
      throw new ResearchControlCampaignPaperSlotOutcomeServiceError(
        "research_control_campaign_paper_slot_outcome_graph_invalid",
        "ResearchControlCampaignPaperSlotOutcome schedule is absent or mismatched."
      );
    }

    const outcomeId = researchControlCampaignPaperSlotOutcomeId(
      input.schedule,
      input.armKind,
      input.sequence
    );
    const existing = await this.options.store
      .getResearchControlCampaignPaperSlotOutcome(outcomeId);
    if (existing) {
      const requested = decideResearchControlCampaignPaperSlotOutcome(input);
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlCampaignPaperSlotOutcomeServiceError(
          "research_control_campaign_paper_slot_outcome_conflict",
          "ResearchControlCampaignPaperSlotOutcome conflicts with terminal evidence."
        );
      }
      return existing;
    }

    const outcome = decideResearchControlCampaignPaperSlotOutcome(input);
    const recorded = await this.options.store
      .recordResearchControlCampaignPaperSlotOutcome(outcome);
    if (!researchControlCampaignPaperSlotOutcomeHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, outcome)) {
      throw new ResearchControlCampaignPaperSlotOutcomeServiceError(
        "research_control_campaign_paper_slot_outcome_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaignPaperSlotOutcome evidence."
      );
    }
    return recorded;
  }
}

export function decideResearchControlCampaignPaperSlotOutcome(
  input: DecideResearchControlCampaignPaperSlotOutcomeInput
): ResearchControlCampaignPaperSlotOutcomeRecord {
  try {
    if (!input || !researchControlCampaignPaperScheduleHasRuntimeShape(
      input.schedule
    ) || canonicalDigest(
      researchControlCampaignPaperScheduleDigestInput(input.schedule)
    ) !== input.schedule.schedule_digest ||
      !Number.isInteger(input.sequence) || input.sequence < 1) {
      throw invalidDecision();
    }
    const arm = input.schedule.arms.find((candidate) =>
      candidate.arm_kind === input.armKind
    );
    const slot = arm?.slots.find((candidate) =>
      candidate.sequence === input.sequence
    );
    if (!arm || !slot || slot.slot_status !== "candidate_scheduled") {
      throw invalidDecision();
    }
    const terminalAt = canonicalTime(input.terminalAt);
    if (Date.parse(terminalAt) < Date.parse(input.schedule.committed_at)) {
      throw invalidDecision();
    }
    const record: ResearchControlCampaignPaperSlotOutcomeRecord = {
      record_kind: "research_control_campaign_paper_slot_outcome",
      version: 1,
      research_control_campaign_paper_slot_outcome_id:
        researchControlCampaignPaperSlotOutcomeId(
          input.schedule,
          input.armKind,
          input.sequence
        ),
      schedule_ref: {
        record_kind: "research_control_campaign_paper_schedule",
        id: input.schedule.research_control_campaign_paper_schedule_id
      },
      schedule_digest: input.schedule.schedule_digest,
      arm_kind: input.armKind,
      sequence: input.sequence,
      tick_ref: { ...slot.tick_ref },
      candidate_ref: { ...slot.candidate_ref },
      candidate_version_ref: { ...slot.candidate_version_ref },
      system_code_ref: { ...slot.system_code_ref },
      system_code_artifact_digest: slot.system_code_artifact_digest,
      admission_decision_ref: { ...slot.admission_decision_ref },
      source_comparison_idempotency_key:
        slot.source_comparison_idempotency_key,
      source_preparation_id: slot.source_preparation_id,
      source_comparison_commitment_id:
        slot.source_comparison_commitment_id,
      terminal_evidence: structuredClone(input.terminalEvidence),
      terminal_at: terminalAt,
      slot_outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.slot_outcome_digest = canonicalDigest(
      researchControlCampaignPaperSlotOutcomeDigestInput(record)
    );
    if (!researchControlCampaignPaperSlotOutcomeHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignPaperSlotOutcomeDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function decideResearchControlCampaignPaperStartIneligibleSlotOutcome(
  input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    armKind: ResearchControlCampaignArmKind;
    sequence: number;
    startBatch: ResearchControlCampaignPaperStartBatchRecord;
  }
): ResearchControlCampaignPaperSlotOutcomeRecord {
  try {
    const batch = input?.startBatch;
    if (!researchControlCampaignPaperStartBatchHasRuntimeShape(batch) ||
      canonicalDigest(
        researchControlCampaignPaperStartBatchDigestInput(batch)
      ) !== batch.start_batch_digest || batch.batch_status !== "ineligible" ||
      !batch.ineligible_reason || batch.schedule_ref.record_kind !==
        "research_control_campaign_paper_schedule" ||
      batch.schedule_ref.id !==
        input.schedule.research_control_campaign_paper_schedule_id ||
      batch.schedule_digest !== input.schedule.schedule_digest ||
      batch.sequence !== input.sequence ||
      batch.research_control_campaign_paper_start_batch_id !==
        researchControlCampaignPaperStartBatchId(
          input.schedule,
          input.sequence
        )) {
      throw invalidDecision();
    }
    const scheduledArm = input.schedule.arms.find((arm) =>
      arm.arm_kind === input.armKind
    );
    const scheduledSlot = scheduledArm?.slots.find((slot) =>
      slot.sequence === input.sequence
    );
    const batchSide = batch.sides.find((side) =>
      side.arm_kind === input.armKind
    );
    if (scheduledSlot?.slot_status !== "candidate_scheduled" || !batchSide ||
      batchSide.source_comparison_ref.id !==
        scheduledSlot.source_comparison_commitment_id) {
      throw invalidDecision();
    }
    const tickSides = batch.sides.filter((side) => side.first_tick_ref);
    return decideResearchControlCampaignPaperSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.sequence,
      terminalEvidence: {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_start_batch",
          id: batch.research_control_campaign_paper_start_batch_id
        },
        start_batch_digest: batch.start_batch_digest,
        terminal_status: "evidence_ineligible",
        reason: batch.ineligible_reason,
        persisted_first_tick_refs: tickSides.map((side) => ({
          ...side.first_tick_ref!
        })),
        persisted_first_tick_digests: tickSides.map((side) =>
          side.first_tick_digest!),
        evaluated_at: batch.evaluated_at
      },
      terminalAt: batch.evaluated_at
    });
  } catch (error) {
    if (error instanceof ResearchControlCampaignPaperSlotOutcomeDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchControlCampaignPaperSlotOutcomeId(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: ResearchControlCampaignArmKind,
  sequence: number
): string {
  const source = [
    canonicalString(schedule?.research_control_campaign_paper_schedule_id),
    canonicalString(armKind),
    canonicalSequence(sequence)
  ].join(":");
  return `research-control-campaign-paper-slot-outcome-${
    digestHex(source).slice(0, 20)
  }`;
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

function invalidDecision(): ResearchControlCampaignPaperSlotOutcomeDecisionError {
  return new ResearchControlCampaignPaperSlotOutcomeDecisionError();
}
