import { describe, expect, it } from "vitest";
import {
  researchControlCampaignPaperSlotOutcomeDigestInput,
  researchControlCampaignPaperSlotOutcomeHasRuntimeShape,
  type PaperTradingComparisonResearchReleaseKind,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignPaperSlotTerminalStatus
} from "./index";

describe("ResearchControlCampaignPaperSlotOutcome", () => {
  it.each([
    ["challenger_not_improved", "source_not_improved"],
    ["comparison_ineligible", "evidence_ineligible"]
  ] as const)("accepts terminal source verdict %s", (_verdict, status) => {
    const outcome = slotOutcomeFixture();
    outcome.terminal_evidence = {
      evidence_kind: "source_verdict",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "source-comparison-001"
      },
      source_comparison_digest: digest("a"),
      source_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "source-verdict-001"
      },
      source_verdict_digest: digest("b"),
      terminal_status: status
    };

    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it("accepts a missed source start deadline", () => {
    const outcome = slotOutcomeFixture();
    outcome.terminal_evidence = {
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired",
      expired_at: outcome.terminal_at
    };

    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it.each([
    ["first_tick_incomplete", 1],
    ["cross_arm_first_tick_mismatch", 2],
    ["source_start_deadline_missed", 2]
  ] as const)("accepts source start terminal %s", (reason, tickCount) => {
    const outcome = slotOutcomeFixture();
    outcome.terminal_evidence = {
      evidence_kind: "source_start_ineligible",
      start_batch_ref: {
        record_kind: "research_control_campaign_paper_start_batch",
        id: "paper-start-batch-001"
      },
      start_batch_digest: digest("9"),
      terminal_status: "evidence_ineligible",
      reason,
      persisted_first_tick_refs: Array.from({ length: tickCount }, (_, index) => ({
        record_kind: "paper_trading_comparison_tick",
        id: `first-tick-${index + 1}`
      })),
      persisted_first_tick_digests: Array.from(
        { length: tickCount },
        (_, index) => digest(String(index + 1))
      ),
      evaluated_at: outcome.terminal_at
    };

    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it("accepts an improved source whose confirmation precommit expired", () => {
    const outcome = slotOutcomeFixture();
    outcome.terminal_evidence = {
      evidence_kind: "confirmation_precommit_expired",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "source-comparison-001"
      },
      source_comparison_digest: digest("a"),
      source_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "source-verdict-improved"
      },
      source_verdict_digest: digest("b"),
      terminal_status: "paper_slot_expired",
      expired_at: outcome.terminal_at
    };

    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it.each([
    ["confirmed_improvement", "qualified_improvement"],
    ["challenger_not_reproduced", "not_reproduced"],
    ["comparison_evidence_ineligible", "evidence_ineligible"],
    ["campaign_slot_expired", "paper_slot_expired"]
  ] as const)("accepts confirmation release %s", (releaseKind, status) => {
    const outcome = slotOutcomeFixture();
    outcome.terminal_evidence = confirmationRelease(releaseKind, status);

    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it("binds the terminal evidence into the digest input", () => {
    const baseline = slotOutcomeFixture();
    const changed = structuredClone(baseline);
    changed.terminal_evidence = {
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired",
      expired_at: changed.terminal_at
    };

    expect(researchControlCampaignPaperSlotOutcomeDigestInput(changed))
      .not.toBe(researchControlCampaignPaperSlotOutcomeDigestInput(baseline));
  });

  it.each([
    ["extra root field", (value: any) => { value.retry = true; }],
    ["malformed schedule ref", (value: any) => {
      value.schedule_ref.record_kind = "research_control_campaign_report";
    }],
    ["sequence zero", (value: any) => { value.sequence = 0; }],
    ["malformed candidate ref", (value: any) => {
      value.candidate_ref.record_kind = "candidate_version";
    }],
    ["short artifact digest", (value: any) => {
      value.system_code_artifact_digest = "sha256:short";
    }],
    ["source verdict qualified directly", (value: any) => {
      value.terminal_evidence.terminal_status = "qualified_improvement";
    }],
    ["source expiry time drift", (value: any) => {
      value.terminal_evidence = {
        evidence_kind: "source_slot_expired",
        terminal_status: "paper_slot_expired",
        expired_at: "2026-07-12T11:59:59.000Z"
      };
    }],
    ["free-form batch reason", (value: any) => {
      value.terminal_evidence = {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_start_batch",
          id: "paper-start-batch-001"
        },
        start_batch_digest: digest("9"),
        terminal_status: "evidence_ineligible",
        reason: "provider_failed",
        persisted_first_tick_refs: [],
        persisted_first_tick_digests: [],
        evaluated_at: value.terminal_at
      };
    }],
    ["mismatched tick arrays", (value: any) => {
      value.terminal_evidence = {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_start_batch",
          id: "paper-start-batch-001"
        },
        start_batch_digest: digest("9"),
        terminal_status: "evidence_ineligible",
        reason: "first_tick_incomplete",
        persisted_first_tick_refs: [{
          record_kind: "paper_trading_comparison_tick",
          id: "first-tick-1"
        }],
        persisted_first_tick_digests: [],
        evaluated_at: value.terminal_at
      };
    }],
    ["duplicate first ticks", (value: any) => {
      const ref = {
        record_kind: "paper_trading_comparison_tick",
        id: "first-tick-1"
      };
      value.terminal_evidence = {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_start_batch",
          id: "paper-start-batch-001"
        },
        start_batch_digest: digest("9"),
        terminal_status: "evidence_ineligible",
        reason: "cross_arm_first_tick_mismatch",
        persisted_first_tick_refs: [ref, ref],
        persisted_first_tick_digests: [digest("1"), digest("2")],
        evaluated_at: value.terminal_at
      };
    }],
    ["malformed start batch ref", (value: any) => {
      value.terminal_evidence = {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_schedule",
          id: "paper-start-batch-001"
        },
        start_batch_digest: digest("9"),
        terminal_status: "evidence_ineligible",
        reason: "first_tick_incomplete",
        persisted_first_tick_refs: [],
        persisted_first_tick_digests: [],
        evaluated_at: value.terminal_at
      };
    }],
    ["release/status mismatch", (value: any) => {
      value.terminal_evidence = confirmationRelease(
        "confirmed_improvement",
        "not_reproduced"
      );
    }],
    ["noncanonical terminal time", (value: any) => {
      value.terminal_at = "2026-07-12 12:00:00";
    }],
    ["evaluation authority widened", (value: any) => {
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
  ])("rejects %s", (_label, mutate) => {
    const outcome = slotOutcomeFixture() as any;
    mutate(outcome);
    expect(researchControlCampaignPaperSlotOutcomeHasRuntimeShape(outcome))
      .toBe(false);
  });
});

function slotOutcomeFixture(): ResearchControlCampaignPaperSlotOutcomeRecord {
  return {
    record_kind: "research_control_campaign_paper_slot_outcome",
    version: 1,
    research_control_campaign_paper_slot_outcome_id:
      "research-control-campaign-paper-slot-outcome-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: "research-control-campaign-paper-schedule-001"
    },
    schedule_digest: digest("1"),
    arm_kind: "adaptive_treatment",
    sequence: 1,
    tick_ref: {
      record_kind: "candidate_arena_tick",
      id: "adaptive-tick-1"
    },
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "adaptive-candidate-1"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "adaptive-version-1"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: "adaptive-system-code-1"
    },
    system_code_artifact_digest: digest("2"),
    admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: "adaptive-admission-1"
    },
    source_comparison_idempotency_key:
      "research-control-paper:campaign:adaptive:slot:1:source",
    source_preparation_id: "source-preparation-adaptive-1",
    source_comparison_commitment_id: "source-comparison-adaptive-1",
    terminal_evidence: {
      evidence_kind: "source_verdict",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "source-comparison-001"
      },
      source_comparison_digest: digest("a"),
      source_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "source-verdict-001"
      },
      source_verdict_digest: digest("b"),
      terminal_status: "source_not_improved"
    },
    terminal_at: "2026-07-12T12:00:00.000Z",
    slot_outcome_digest: digest("3"),
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function confirmationRelease(
  releaseKind: PaperTradingComparisonResearchReleaseKind,
  status: Exclude<
    ResearchControlCampaignPaperSlotTerminalStatus,
    "source_not_improved"
  >
) {
  return {
    evidence_kind: "confirmation_release" as const,
    confirmation_campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "confirmation-campaign-001"
    },
    confirmation_campaign_digest: digest("4"),
    confirmation_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: "confirmation-outcome-001"
    },
    confirmation_outcome_digest: digest("5"),
    research_release_ref: {
      record_kind: "paper_trading_comparison_research_release",
      id: "research-release-001"
    },
    research_release_digest: digest("6"),
    release_kind: releaseKind,
    terminal_status: status
  };
}

function digest(seed: string): string {
  return `sha256:${seed.repeat(64).slice(0, 64)}`;
}
