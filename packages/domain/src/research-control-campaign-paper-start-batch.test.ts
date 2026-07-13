import { describe, expect, it } from "vitest";
import {
  researchControlCampaignPaperStartBatchDigestInput,
  researchControlCampaignPaperStartBatchHasRuntimeShape,
  type ResearchControlCampaignPaperStartBatchRecord
} from "./index";

describe("ResearchControlCampaignPaperStartBatch", () => {
  it.each([
    ["paired ready", pairedReadyFixture()],
    ["single ready", singleReadyFixture()],
    ["start incomplete", startIncompleteFixture()],
    ["single start incomplete", singleStartIncompleteFixture()],
    ["paired mismatch", pairedMismatchFixture()],
    ["start deadline missed", startDeadlineMissedFixture()]
  ])("accepts an authority-closed %s record", (_label, batch) => {
    expect(researchControlCampaignPaperStartBatchHasRuntimeShape(batch))
      .toBe(true);
  });

  it("binds every cross-arm start fact into the digest input", () => {
    const baseline = pairedReadyFixture();
    const changed = structuredClone(baseline);
    changed.sides[1]!.first_tick_digest = digest("9");

    expect(researchControlCampaignPaperStartBatchDigestInput(changed)).not.toBe(
      researchControlCampaignPaperStartBatchDigestInput(baseline)
    );
  });

  it.each([
    ["extra root field", (value: any) => { value.winner = "adaptive"; }],
    ["wrong schedule ref", (value: any) => {
      value.schedule_ref.record_kind = "research_control_campaign_report";
    }],
    ["zero sequence", (value: any) => { value.sequence = 0; }],
    ["reversed paired arm order", (value: any) => { value.sides.reverse(); }],
    ["duplicate arm", (value: any) => {
      value.sides[1].arm_kind = value.sides[0].arm_kind;
    }],
    ["duplicate comparison", (value: any) => {
      value.sides[1].source_comparison_ref =
        value.sides[0].source_comparison_ref;
    }],
    ["duplicate first tick", (value: any) => {
      value.sides[1].first_tick_ref = value.sides[0].first_tick_ref;
    }],
    ["partial first tick closure", (value: any) => {
      delete value.sides[0].first_tick_digest;
    }],
    ["single record with two sides", (value: any) => {
      value.batch_status = "single_ready";
    }],
    ["paired ready missing a tick", (value: any) => {
      delete value.sides[1].first_tick_ref;
      delete value.sides[1].first_tick_digest;
      delete value.sides[1].first_tick_observed_at;
    }],
    ["paired ready with reason", (value: any) => {
      value.ineligible_reason = "cross_arm_first_tick_mismatch";
    }],
    ["paired ready without shared market digest", (value: any) => {
      delete value.shared_market_snapshot_digest;
    }],
    ["paired ready without shared execution digest", (value: any) => {
      delete value.shared_public_execution_snapshot_digest;
    }],
    ["incomplete with both ticks", (value: any) => {
      Object.assign(value.sides[1], firstTick("static"));
    }, startIncompleteFixture()],
    ["incomplete before deadline", (value: any) => {
      value.evaluated_at = "2026-07-12T12:09:59.999Z";
    }, startIncompleteFixture()],
    ["mismatch missing a tick", (value: any) => {
      delete value.sides[1].first_tick_ref;
      delete value.sides[1].first_tick_digest;
      delete value.sides[1].first_tick_observed_at;
    }, pairedMismatchFixture()],
    ["mismatch with one side", (value: any) => {
      value.sides.pop();
    }, pairedMismatchFixture()],
    ["ready tick after deadline", (value: any) => {
      value.sides[1].first_tick_observed_at = "2026-07-12T12:10:00.001Z";
      value.evaluated_at = "2026-07-12T12:10:00.001Z";
    }],
    ["deadline missed without a late tick", (value: any) => {
      value.sides[1].first_tick_observed_at = "2026-07-12T12:09:59.999Z";
      value.evaluated_at = "2026-07-12T12:10:00.000Z";
    }, startDeadlineMissedFixture()],
    ["ineligible with shared digests", (value: any) => {
      value.shared_market_snapshot_digest = digest("7");
      value.shared_public_execution_snapshot_digest = digest("8");
    }, pairedMismatchFixture()],
    ["evaluation before a persisted tick", (value: any) => {
      value.evaluated_at = "2026-07-12T12:00:00.000Z";
    }],
    ["noncanonical deadline", (value: any) => {
      value.source_start_deadline_at = "2026-07-12 12:10:00";
    }],
    ["short schedule digest", (value: any) => {
      value.schedule_digest = "sha256:short";
    }],
    ["evaluation authority changed", (value: any) => {
      value.evaluation_authority = "trading_system";
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
  ])("rejects %s", (...args) => {
    const [_label, mutate, supplied] = args;
    const batch = structuredClone(
      supplied ?? pairedReadyFixture()
    ) as any;
    mutate(batch);
    expect(researchControlCampaignPaperStartBatchHasRuntimeShape(batch))
      .toBe(false);
  });
});

function pairedReadyFixture(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...baseFixture(),
    batch_status: "paired_ready",
    sides: [
      completeSide("adaptive_treatment", "adaptive"),
      completeSide("static_control", "static")
    ],
    shared_market_snapshot_digest: digest("7"),
    shared_public_execution_snapshot_digest: digest("8"),
    evaluated_at: "2026-07-12T12:00:02.000Z"
  };
}

function singleReadyFixture(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...baseFixture(),
    batch_status: "single_ready",
    sides: [completeSide("adaptive_treatment", "adaptive")],
    shared_market_snapshot_digest: digest("7"),
    shared_public_execution_snapshot_digest: digest("8"),
    evaluated_at: "2026-07-12T12:00:01.000Z"
  };
}

function startIncompleteFixture(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...baseFixture(),
    batch_status: "ineligible",
    sides: [
      completeSide("adaptive_treatment", "adaptive"),
      sourceSide("static_control", "static")
    ],
    ineligible_reason: "first_tick_incomplete",
    evaluated_at: "2026-07-12T12:10:00.000Z"
  };
}

function singleStartIncompleteFixture():
  ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...baseFixture(),
    batch_status: "ineligible",
    sides: [sourceSide("adaptive_treatment", "adaptive")],
    ineligible_reason: "first_tick_incomplete",
    evaluated_at: "2026-07-12T12:10:00.000Z"
  };
}

function pairedMismatchFixture(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...baseFixture(),
    batch_status: "ineligible",
    sides: [
      completeSide("adaptive_treatment", "adaptive"),
      completeSide("static_control", "static")
    ],
    ineligible_reason: "cross_arm_first_tick_mismatch",
    evaluated_at: "2026-07-12T12:00:02.000Z"
  };
}

function startDeadlineMissedFixture():
  ResearchControlCampaignPaperStartBatchRecord {
  const record = pairedMismatchFixture();
  record.ineligible_reason = "source_start_deadline_missed";
  record.sides[1]!.first_tick_observed_at = "2026-07-12T12:10:00.001Z";
  record.evaluated_at = "2026-07-12T12:10:00.001Z";
  return record;
}

function baseFixture() {
  return {
    record_kind: "research_control_campaign_paper_start_batch" as const,
    version: 1 as const,
    research_control_campaign_paper_start_batch_id:
      "research-control-campaign-paper-start-batch-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule" as const,
      id: "research-control-campaign-paper-schedule-001"
    },
    schedule_digest: digest("1"),
    sequence: 1,
    source_start_deadline_at: "2026-07-12T12:10:00.000Z",
    start_batch_digest: digest("2"),
    evaluation_authority: "external_to_trading_systems" as const,
    promotion_authority: false as const,
    order_submission_authority: false as const,
    live_exchange_authority: false as const,
    authority_status: "not_live" as const
  };
}

function completeSide(
  armKind: "adaptive_treatment" | "static_control",
  token: "adaptive" | "static"
) {
  return {
    ...sourceSide(armKind, token),
    ...firstTick(token)
  };
}

function sourceSide(
  armKind: "adaptive_treatment" | "static_control",
  token: "adaptive" | "static"
) {
  return {
    arm_kind: armKind,
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment" as const,
      id: `${token}-source-comparison`
    },
    source_comparison_digest: digest(token === "adaptive" ? "3" : "4")
  };
}

function firstTick(token: "adaptive" | "static") {
  return {
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick" as const,
      id: `${token}-first-tick`
    },
    first_tick_digest: digest(token === "adaptive" ? "5" : "6"),
    first_tick_observed_at: token === "adaptive"
      ? "2026-07-12T12:00:01.000Z"
      : "2026-07-12T12:00:02.000Z"
  };
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}
