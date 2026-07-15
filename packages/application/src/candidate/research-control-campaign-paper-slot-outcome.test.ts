import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperStartBatchDigestInput,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignPaperSlotTerminalEvidence
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import {
  decideResearchControlCampaignPaperSlotOutcome,
  decideResearchControlCampaignPaperStartIneligibleSlotOutcome,
  ResearchControlCampaignPaperSlotOutcomeDecisionError,
  ResearchControlCampaignPaperSlotOutcomeService,
  ResearchControlCampaignPaperSlotOutcomeServiceError
} from "./research-control-campaign-paper-slot-outcome";
import { researchControlCampaignPaperStartBatchId } from
  "./research-control-campaign-paper-start-batch";

describe("ResearchControlCampaignPaperSlotOutcome application", () => {
  it.each([
    ["source_not_improved"],
    ["evidence_ineligible"]
  ] as const)("closes an exact scheduled source verdict as %s", (status) => {
    const schedule = scheduleFixture();
    const evidence = sourceVerdictEvidence(status);
    const scheduledSlot = schedule.arms[0].slots[0]!;
    if (scheduledSlot.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_slot");
    }

    const outcome = decideResearchControlCampaignPaperSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: evidence,
      terminalAt: "2026-07-12T12:00:00.000Z"
    });

    expect(outcome).toMatchObject({
      arm_kind: "adaptive_treatment",
      sequence: 1,
      candidate_ref: scheduledSlot.candidate_ref,
      terminal_evidence: evidence,
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      live_exchange_authority: false
    });
  });

  it("derives the same append identity for the same schedule slot", () => {
    const schedule = scheduleFixture();
    const first = decideResearchControlCampaignPaperSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: sourceVerdictEvidence("source_not_improved"),
      terminalAt: "2026-07-12T12:00:00.000Z"
    });
    const changedEvidence = decideResearchControlCampaignPaperSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: sourceVerdictEvidence("evidence_ineligible"),
      terminalAt: "2026-07-12T12:00:00.000Z"
    });

    expect(changedEvidence.research_control_campaign_paper_slot_outcome_id)
      .toBe(first.research_control_campaign_paper_slot_outcome_id);
    expect(changedEvidence.slot_outcome_digest).not.toBe(
      first.slot_outcome_digest
    );
  });

  it("derives source-start terminal evidence from one exact ineligible batch", () => {
    const schedule = scheduleFixture();
    const batch = startBatchFixture(schedule);

    const outcome = decideResearchControlCampaignPaperStartIneligibleSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      startBatch: batch
    });

    expect(outcome.terminal_evidence).toEqual({
      evidence_kind: "source_start_ineligible",
      start_batch_ref: {
        record_kind: "research_control_campaign_paper_start_batch",
        id: batch.research_control_campaign_paper_start_batch_id
      },
      start_batch_digest: batch.start_batch_digest,
      terminal_status: "evidence_ineligible",
      reason: "first_tick_incomplete",
      persisted_first_tick_refs: [],
      persisted_first_tick_digests: [],
      evaluated_at: batch.evaluated_at
    });
    expect(outcome.terminal_at).toBe(batch.evaluated_at);
  });

  it.each([
    ["ready batch", (batch: ResearchControlCampaignPaperStartBatchRecord) => {
      batch.batch_status = "single_ready";
      delete batch.ineligible_reason;
      batch.shared_market_snapshot_digest = digest("8");
      batch.shared_public_execution_snapshot_digest = digest("9");
      resealStartBatch(batch);
    }],
    ["schedule substitution", (
      batch: ResearchControlCampaignPaperStartBatchRecord
    ) => {
      batch.schedule_ref.id = "other-schedule";
      resealStartBatch(batch);
    }],
    ["source side substitution", (
      batch: ResearchControlCampaignPaperStartBatchRecord
    ) => {
      batch.sides[0]!.source_comparison_ref.id = "other-comparison";
      resealStartBatch(batch);
    }]
  ])("rejects %s for source-start terminal evidence", (_label, mutate) => {
    const schedule = scheduleFixture();
    const batch = startBatchFixture(schedule);
    mutate(batch);

    expect(() => decideResearchControlCampaignPaperStartIneligibleSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      startBatch: batch
    })).toThrow(ResearchControlCampaignPaperSlotOutcomeDecisionError);
  });

  it.each([
    ["missing arm", (schedule: ResearchControlCampaignPaperScheduleRecord,
      input: { sequence: number; terminalAt: string }) => {
      schedule.arms[0].arm_kind = "static_control";
      resealSchedule(schedule);
    }],
    ["empty report slot", (schedule: ResearchControlCampaignPaperScheduleRecord,
      _input: { sequence: number; terminalAt: string }) => {
      schedule.arms[0].slots[0] = {
        sequence: 1,
        tick_ref: { record_kind: "candidate_arena_tick", id: "adaptive-tick-1" },
        slot_status: "no_admitted_candidate"
      };
      resealSchedule(schedule);
    }],
    ["unknown sequence", (_schedule: ResearchControlCampaignPaperScheduleRecord,
      input: { sequence: number; terminalAt: string }) => {
      input.sequence = 2;
    }],
    ["terminal before schedule", (_schedule: ResearchControlCampaignPaperScheduleRecord,
      input: { sequence: number; terminalAt: string }) => {
      input.terminalAt = "2026-07-12T10:59:59.999Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const schedule = scheduleFixture();
    const input = {
      sequence: 1,
      terminalAt: "2026-07-12T12:00:00.000Z"
    };
    mutate(schedule, input);

    expect(() => decideResearchControlCampaignPaperSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: input.sequence,
      terminalEvidence: sourceVerdictEvidence("source_not_improved"),
      terminalAt: input.terminalAt
    })).toThrow(ResearchControlCampaignPaperSlotOutcomeDecisionError);
  });

  it("rejects a schedule content digest mismatch", () => {
    const schedule = scheduleFixture();
    schedule.schedule_digest = digest("f");

    expect(() => decideResearchControlCampaignPaperSlotOutcome({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: sourceVerdictEvidence("source_not_improved"),
      terminalAt: "2026-07-12T12:00:00.000Z"
    })).toThrow(ResearchControlCampaignPaperSlotOutcomeDecisionError);
  });

  it("persists once and replays the exact terminal outcome", async () => {
    const schedule = scheduleFixture();
    const store = new SlotOutcomeStoreDouble(schedule);
    const service = new ResearchControlCampaignPaperSlotOutcomeService({
      store: store as unknown as OuroborosStorePort
    });
    const request = {
      schedule,
      armKind: "adaptive_treatment" as const,
      sequence: 1,
      terminalEvidence: sourceVerdictEvidence("source_not_improved"),
      terminalAt: "2026-07-12T12:00:00.000Z"
    };

    const first = await service.record(request);
    const replay = await service.record(request);

    expect(replay).toEqual(first);
    expect(store.outcomeWrites).toBe(1);
  });

  it("rejects a store that changes terminal evidence", async () => {
    const schedule = scheduleFixture();
    const store = new SlotOutcomeStoreDouble(schedule);
    store.changeRecordedOutcome = true;
    const service = new ResearchControlCampaignPaperSlotOutcomeService({
      store: store as unknown as OuroborosStorePort
    });

    await expect(service.record({
      schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: sourceVerdictEvidence("source_not_improved"),
      terminalAt: "2026-07-12T12:00:00.000Z"
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_slot_outcome_persistence_conflict"
    } satisfies Partial<ResearchControlCampaignPaperSlotOutcomeServiceError>);
  });
});

function scheduleFixture(): ResearchControlCampaignPaperScheduleRecord {
  const schedule: ResearchControlCampaignPaperScheduleRecord = {
    record_kind: "research_control_campaign_paper_schedule",
    version: 1,
    research_control_campaign_paper_schedule_id: "paper-schedule-001",
    campaign_ref: { record_kind: "research_control_campaign", id: "campaign-001" },
    campaign_digest: digest("1"),
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: "report-001"
    },
    report_digest: digest("2"),
    paper_comparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: { record_kind: "trading_promotion", id: "promotion-001" },
      trading_promotion_digest: digest("3"),
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "champion-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "champion-version"
      },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "champion-evaluation"
      }
    },
    paper_evaluation_protocol_digest: digest("4"),
    arms: [
      {
        arm_kind: "adaptive_treatment",
        slots: [candidateSlot("adaptive")]
      },
      {
        arm_kind: "static_control",
        slots: [{
          sequence: 1,
          tick_ref: { record_kind: "candidate_arena_tick", id: "static-tick-1" },
          slot_status: "no_admitted_candidate"
        }]
      }
    ],
    committed_at: "2026-07-12T11:00:00.000Z",
    schedule_digest: digest("0"),
    paper_evaluation_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealSchedule(schedule);
  return schedule;
}

function candidateSlot(suffix: string) {
  return {
    sequence: 1,
    tick_ref: {
      record_kind: "candidate_arena_tick" as const,
      id: `${suffix}-tick-1`
    },
    slot_status: "candidate_scheduled" as const,
    candidate_ref: {
      record_kind: "trading_system_candidate" as const,
      id: `${suffix}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version" as const,
      id: `${suffix}-version`
    },
    system_code_ref: {
      record_kind: "system_code" as const,
      id: `${suffix}-code`
    },
    system_code_artifact_digest: digest("5"),
    admission_decision_ref: {
      record_kind: "candidate_admission_decision" as const,
      id: `${suffix}-admission`
    },
    source_comparison_idempotency_key: `source-key-${suffix}`,
    source_preparation_id: `source-preparation-${suffix}`,
    source_comparison_commitment_id: `source-comparison-${suffix}`,
    maximum_source_start_delay_ms: 600_000
  };
}

function sourceVerdictEvidence(
  status: "source_not_improved" | "evidence_ineligible"
): ResearchControlCampaignPaperSlotTerminalEvidence {
  return {
    evidence_kind: "source_verdict",
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "source-comparison-adaptive"
    },
    source_comparison_digest: digest("6"),
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict-adaptive"
    },
    source_verdict_digest: digest("7"),
    terminal_status: status
  };
}

function startBatchFixture(
  schedule: ResearchControlCampaignPaperScheduleRecord
): ResearchControlCampaignPaperStartBatchRecord {
  const batch: ResearchControlCampaignPaperStartBatchRecord = {
    record_kind: "research_control_campaign_paper_start_batch",
    version: 1,
    research_control_campaign_paper_start_batch_id:
      researchControlCampaignPaperStartBatchId(schedule, 1),
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: schedule.schedule_digest,
    sequence: 1,
    batch_status: "ineligible",
    sides: [{
      arm_kind: "adaptive_treatment",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "source-comparison-adaptive"
      },
      source_comparison_digest: digest("6")
    }],
    source_start_deadline_at: "2026-07-12T11:10:00.000Z",
    ineligible_reason: "first_tick_incomplete",
    evaluated_at: "2026-07-12T11:10:00.000Z",
    start_batch_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
  resealStartBatch(batch);
  return batch;
}

function resealSchedule(schedule: ResearchControlCampaignPaperScheduleRecord): void {
  schedule.schedule_digest = canonicalDigest(
    researchControlCampaignPaperScheduleDigestInput(schedule)
  );
}

function resealStartBatch(
  batch: ResearchControlCampaignPaperStartBatchRecord
): void {
  batch.start_batch_digest = canonicalDigest(
    researchControlCampaignPaperStartBatchDigestInput(batch)
  );
}

function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(
    typeof value === "string"
      ? value
      : paperTradingComparisonPersistedRecordDigestInput(value)
  ).digest("hex")}`;
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}

class SlotOutcomeStoreDouble {
  readonly outcomes = new Map<string, ResearchControlCampaignPaperSlotOutcomeRecord>();
  outcomeWrites = 0;
  changeRecordedOutcome = false;

  constructor(private readonly schedule: ResearchControlCampaignPaperScheduleRecord) {}

  async getResearchControlCampaignPaperSchedule(id: string) {
    return id === this.schedule.research_control_campaign_paper_schedule_id
      ? this.schedule
      : undefined;
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return this.outcomes.get(id);
  }

  async recordResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    this.outcomeWrites += 1;
    const recorded = structuredClone(outcome);
    if (this.changeRecordedOutcome) {
      recorded.terminal_at = "2026-07-12T12:00:01.000Z";
    }
    this.outcomes.set(
      outcome.research_control_campaign_paper_slot_outcome_id,
      recorded
    );
    return recorded;
  }
}
