import { describe, expect, it } from "vitest";
import {
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperScheduleHasRuntimeShape,
  type ResearchControlCampaignPaperScheduleRecord
} from "./index";

describe("ResearchControlCampaignPaperSchedule", () => {
  it("accepts an authority-closed paired schedule with exact slot variants", () => {
    expect(researchControlCampaignPaperScheduleHasRuntimeShape(scheduleFixture()))
      .toBe(true);
  });

  it("binds every source reservation into the schedule digest input", () => {
    const baseline = scheduleFixture();
    const changed = structuredClone(baseline);
    const slot = changed.arms[0].slots[0]!;
    if (slot.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_slot");
    }
    slot.source_comparison_commitment_id = "paper-comparison-changed";

    expect(researchControlCampaignPaperScheduleDigestInput(changed)).not.toBe(
      researchControlCampaignPaperScheduleDigestInput(baseline)
    );
  });

  it.each([
    ["extra root field", (value: any) => { value.winner = "adaptive"; }],
    ["reversed arm order", (value: any) => { value.arms.reverse(); }],
    ["unequal arm slot counts", (value: any) => { value.arms[1].slots.pop(); }],
    ["non-contiguous sequence", (value: any) => {
      value.arms[0].slots[1].sequence = 3;
    }],
    ["duplicate tick identity", (value: any) => {
      value.arms[1].slots[0].tick_ref = value.arms[0].slots[0].tick_ref;
    }],
    ["candidate field on empty slot", (value: any) => {
      value.arms[0].slots[1].candidate_ref = {
        record_kind: "trading_system_candidate",
        id: "forbidden"
      };
    }],
    ["malformed candidate ref", (value: any) => {
      value.arms[0].slots[0].candidate_ref.record_kind = "candidate_version";
    }],
    ["duplicate source idempotency key", (value: any) => {
      value.arms[1].slots[0].source_comparison_idempotency_key =
        value.arms[0].slots[0].source_comparison_idempotency_key;
    }],
    ["duplicate source preparation", (value: any) => {
      value.arms[1].slots[0].source_preparation_id =
        value.arms[0].slots[0].source_preparation_id;
    }],
    ["duplicate source commitment", (value: any) => {
      value.arms[1].slots[0].source_comparison_commitment_id =
        value.arms[0].slots[0].source_comparison_commitment_id;
    }],
    ["different source delay", (value: any) => {
      value.arms[1].slots[1].maximum_source_start_delay_ms += 1;
    }],
    ["non-positive source delay", (value: any) => {
      value.arms[0].slots[0].maximum_source_start_delay_ms = 0;
    }],
    ["short campaign digest", (value: any) => {
      value.campaign_digest = "sha256:short";
    }],
    ["unavailable comparator", (value: any) => {
      value.paper_comparator = {
        comparator_status: "unavailable",
        reason: "no_trading_promotion_at_commitment"
      };
    }],
    ["noncanonical commit time", (value: any) => {
      value.committed_at = "2026-07-12 12:00:00";
    }],
    ["paper scheduling authority removed", (value: any) => {
      value.paper_evaluation_scheduling_authority = false;
    }],
    ["promotion authority widened", (value: any) => {
      value.promotion_authority = true;
    }],
    ["order authority widened", (value: any) => {
      value.order_submission_authority = true;
    }],
    ["live authority widened", (value: any) => {
      value.live_exchange_authority = true;
    }]
  ])("rejects %s", (_label, mutate) => {
    const schedule = scheduleFixture() as any;
    mutate(schedule);
    expect(researchControlCampaignPaperScheduleHasRuntimeShape(schedule))
      .toBe(false);
  });
});

function scheduleFixture(): ResearchControlCampaignPaperScheduleRecord {
  return {
    record_kind: "research_control_campaign_paper_schedule",
    version: 1,
    research_control_campaign_paper_schedule_id:
      "research-control-campaign-paper-schedule-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: "research-control-campaign-001"
    },
    campaign_digest: digest("1"),
    report_ref: {
      record_kind: "research_control_campaign_report",
      id: "research-control-campaign-report-001"
    },
    report_digest: digest("2"),
    paper_comparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: "trading-promotion-001"
      },
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
        slots: [
          candidateSlot("adaptive", 1),
          noCandidateSlot("adaptive", 2)
        ]
      },
      {
        arm_kind: "static_control",
        slots: [
          candidateSlot("static", 1),
          candidateSlot("static", 2)
        ]
      }
    ],
    committed_at: "2026-07-12T12:00:00.000Z",
    schedule_digest: digest("5"),
    paper_evaluation_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function candidateSlot(arm: "adaptive" | "static", sequence: number) {
  return {
    sequence,
    tick_ref: {
      record_kind: "candidate_arena_tick" as const,
      id: `${arm}-tick-${sequence}`
    },
    slot_status: "candidate_scheduled" as const,
    candidate_ref: {
      record_kind: "trading_system_candidate" as const,
      id: `${arm}-candidate-${sequence}`
    },
    candidate_version_ref: {
      record_kind: "candidate_version" as const,
      id: `${arm}-version-${sequence}`
    },
    system_code_ref: {
      record_kind: "system_code" as const,
      id: `${arm}-system-code-${sequence}`
    },
    system_code_artifact_digest: digest(sequence.toString()),
    admission_decision_ref: {
      record_kind: "candidate_admission_decision" as const,
      id: `${arm}-admission-${sequence}`
    },
    source_comparison_idempotency_key:
      `research-control-paper:campaign:${arm}:slot:${sequence}:source`,
    source_preparation_id: `source-preparation-${arm}-${sequence}`,
    source_comparison_commitment_id: `source-comparison-${arm}-${sequence}`,
    maximum_source_start_delay_ms: 120_000
  };
}

function noCandidateSlot(arm: "adaptive" | "static", sequence: number) {
  return {
    sequence,
    tick_ref: {
      record_kind: "candidate_arena_tick" as const,
      id: `${arm}-tick-${sequence}`
    },
    slot_status: "no_admitted_candidate" as const
  };
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}
