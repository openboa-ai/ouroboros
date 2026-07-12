import { describe, expect, it } from "vitest";
import {
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  type ResearchControlCampaignOutcomeRecord
} from "./index";

describe("ResearchControlCampaignOutcome", () => {
  it("accepts one terminal same-comparator adaptive-higher observation", () => {
    expect(researchControlCampaignOutcomeHasRuntimeShape(outcomeFixture()))
      .toBe(true);
  });

  it("accepts equal observed rates without a winner", () => {
    const outcome = outcomeFixture();
    outcome.arms[1] = structuredClone(outcome.arms[0]);
    outcome.arms[1].arm_kind = "static_control";
    outcome.arms[1].allocation_mode = "static_control";
    outcome.arms[1].slot_results = outcome.arms[1].slot_results.map(
      (slot, index) => reidentifySlot(slot, "static", index + 1)
    );
    outcome.observed_rate_difference = 0;
    outcome.observed_result = "rates_equal";

    expect(researchControlCampaignOutcomeHasRuntimeShape(outcome)).toBe(true);
  });

  it("accepts a static-higher bounded observation", () => {
    const outcome = outcomeFixture();
    const adaptive = outcome.arms[0];
    adaptive.slot_results = [
      paperSlot("adaptive", 1, "not_reproduced"),
      noCandidateSlot("adaptive", 2)
    ];
    adaptive.metrics = {
      slot_count: 2,
      admitted_candidate_slot_count: 1,
      no_admitted_candidate_count: 1,
      qualified_discovery_count: 0,
      not_reproduced_count: 1,
      evidence_ineligible_count: 0,
      paper_slot_expired_count: 0,
      qualified_discovery_rate: 0
    };
    const control = outcome.arms[1];
    control.slot_results = [
      paperSlot("static", 1, "qualified_improvement"),
      paperSlot("static", 2, "evidence_ineligible")
    ];
    control.metrics = {
      slot_count: 2,
      admitted_candidate_slot_count: 2,
      no_admitted_candidate_count: 0,
      qualified_discovery_count: 1,
      not_reproduced_count: 0,
      evidence_ineligible_count: 1,
      paper_slot_expired_count: 0,
      qualified_discovery_rate: 0.5
    };
    outcome.observed_rate_difference = -0.5;
    outcome.observed_result = "static_rate_higher";

    expect(researchControlCampaignOutcomeHasRuntimeShape(outcome)).toBe(true);
  });

  it("makes an all-no-candidate policy absence explicit", () => {
    const outcome = outcomeFixture();
    for (const arm of outcome.arms) {
      arm.slot_results = [
        noCandidateSlot(arm.arm_kind, 1),
        noCandidateSlot(arm.arm_kind, 2)
      ];
      arm.metrics = {
        slot_count: 2,
        admitted_candidate_slot_count: 0,
        no_admitted_candidate_count: 2,
        qualified_discovery_count: 0,
        not_reproduced_count: 0,
        evidence_ineligible_count: 0,
        paper_slot_expired_count: 0,
        qualified_discovery_rate: 0
      };
    }
    outcome.shared_evaluation_policy_status =
      "not_applicable_no_reserved_candidates";
    outcome.observed_rate_difference = 0;
    outcome.observed_result = "rates_equal";

    expect(researchControlCampaignOutcomeHasRuntimeShape(outcome)).toBe(true);
  });

  it("binds every terminal slot and metric into the digest input", () => {
    const baseline = outcomeFixture();
    const baselineInput = researchControlCampaignOutcomeDigestInput(baseline);
    const changed = structuredClone(baseline);
    const changedSlot = changed.arms[0].slot_results[0]!;
    if (changedSlot.terminal_status === "no_admitted_candidate") {
      throw new Error("fixture_expected_paper_slot");
    }
    changedSlot.research_release_digest = digest("9");

    expect(researchControlCampaignOutcomeDigestInput(changed)).not.toBe(
      baselineInput
    );
  });

  it.each([
    ["extra winner field", (value: any) => { value.winner = "adaptive"; }],
    ["unavailable comparator", (value: any) => {
      value.paper_comparator = {
        comparator_status: "unavailable",
        reason: "no_trading_promotion_at_commitment"
      };
    }],
    ["malformed comparator digest", (value: any) => {
      value.paper_comparator.trading_promotion_digest = "sha256:short";
    }],
    ["missing shared policy", (value: any) => {
      delete value.shared_evaluation_policy_digest;
    }],
    ["wrong shared policy status", (value: any) => {
      value.shared_evaluation_policy_status =
        "not_applicable_no_reserved_candidates";
    }],
    ["reversed arms", (value: any) => { value.arms.reverse(); }],
    ["unequal denominators", (value: any) => {
      value.arms[1].slot_results.pop();
      value.arms[1].metrics.slot_count = 1;
      value.arms[1].metrics.admitted_candidate_slot_count = 1;
      value.arms[1].metrics.evidence_ineligible_count = 0;
    }],
    ["non-contiguous sequence", (value: any) => {
      value.arms[0].slot_results[0].sequence = 2;
    }],
    ["duplicate tick ref", (value: any) => {
      value.arms[0].slot_results[1].tick_ref =
        value.arms[0].slot_results[0].tick_ref;
    }],
    ["duplicate release", (value: any) => {
      value.arms[1].slot_results[1].research_release_ref =
        value.arms[1].slot_results[0].research_release_ref;
    }],
    ["no candidate with paper evidence", (value: any) => {
      value.arms[0].slot_results[1].research_release_ref = {
        record_kind: "paper_trading_comparison_research_release",
        id: "forbidden-release"
      };
    }],
    ["qualified slot without credit", (value: any) => {
      value.arms[0].slot_results[0].discovery_credit = 0;
    }],
    ["nonqualified slot with credit", (value: any) => {
      value.arms[1].slot_results[0].discovery_credit = 1;
    }],
    ["release kind mismatch", (value: any) => {
      value.arms[1].slot_results[0].release_kind = "confirmed_improvement";
    }],
    ["candidate ref malformed", (value: any) => {
      value.arms[0].slot_results[0].candidate_ref.record_kind =
        "candidate_version";
    }],
    ["metric conservation drift", (value: any) => {
      value.arms[0].metrics.qualified_discovery_count = 2;
    }],
    ["rate drift", (value: any) => {
      value.arms[0].metrics.qualified_discovery_rate = 0.6;
    }],
    ["difference drift", (value: any) => {
      value.observed_rate_difference = 0.4;
    }],
    ["result drift", (value: any) => {
      value.observed_result = "rates_equal";
    }],
    ["causal winner claim", (value: any) => {
      value.causal_conclusion = "adaptive_policy_wins";
    }],
    ["policy replacement", (value: any) => {
      value.policy_replacement_eligibility = "eligible";
    }],
    ["promotion authority", (value: any) => {
      value.promotion_authority = true;
    }],
    ["order authority", (value: any) => {
      value.order_submission_authority = true;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }],
    ["noncanonical time", (value: any) => {
      value.adjudicated_at = "2026-07-12 11:00:00";
    }]
  ])("rejects %s", (_label, mutate) => {
    const outcome = outcomeFixture() as any;
    mutate(outcome);
    expect(researchControlCampaignOutcomeHasRuntimeShape(outcome)).toBe(false);
  });
});

function outcomeFixture(): ResearchControlCampaignOutcomeRecord {
  return {
    record_kind: "research_control_campaign_outcome",
    version: 1,
    research_control_campaign_outcome_id:
      "research-control-campaign-outcome-001",
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
    shared_evaluation_policy_status: "bound",
    shared_evaluation_policy_digest: digest("4"),
    arms: [
      {
        arm_kind: "adaptive_treatment",
        allocation_mode: "adaptive_default",
        slot_results: [
          paperSlot("adaptive", 1, "qualified_improvement"),
          noCandidateSlot("adaptive", 2)
        ],
        metrics: {
          slot_count: 2,
          admitted_candidate_slot_count: 1,
          no_admitted_candidate_count: 1,
          qualified_discovery_count: 1,
          not_reproduced_count: 0,
          evidence_ineligible_count: 0,
          paper_slot_expired_count: 0,
          qualified_discovery_rate: 0.5
        }
      },
      {
        arm_kind: "static_control",
        allocation_mode: "static_control",
        slot_results: [
          paperSlot("static", 1, "not_reproduced"),
          paperSlot("static", 2, "evidence_ineligible")
        ],
        metrics: {
          slot_count: 2,
          admitted_candidate_slot_count: 2,
          no_admitted_candidate_count: 0,
          qualified_discovery_count: 0,
          not_reproduced_count: 1,
          evidence_ineligible_count: 1,
          paper_slot_expired_count: 0,
          qualified_discovery_rate: 0
        }
      }
    ],
    observed_rate_difference: 0.5,
    observed_result: "adaptive_rate_higher",
    causal_conclusion: "single_campaign_observation_only",
    policy_replacement_eligibility: "not_eligible",
    next_action: "accumulate_replicated_control_campaigns",
    adjudicated_at: "2026-07-12T11:00:00.000Z",
    outcome_digest: digest("5"),
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function paperSlot(
  prefix: string,
  sequence: number,
  status:
    | "qualified_improvement"
    | "not_reproduced"
    | "evidence_ineligible"
    | "paper_slot_expired"
): ResearchControlCampaignOutcomeRecord["arms"][number]["slot_results"][number] {
  const releaseKind = {
    qualified_improvement: "confirmed_improvement",
    not_reproduced: "challenger_not_reproduced",
    evidence_ineligible: "comparison_evidence_ineligible",
    paper_slot_expired: "campaign_slot_expired"
  } as const;
  return {
    sequence,
    tick_ref: {
      record_kind: "candidate_arena_tick",
      id: `${prefix}-tick-${sequence}`
    },
    terminal_status: status,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${prefix}-candidate-${sequence}`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${prefix}-version-${sequence}`
    },
    system_code_ref: {
      record_kind: "system_code",
      id: `${prefix}-code-${sequence}`
    },
    system_code_artifact_digest: digest(prefix === "adaptive" ? "6" : "7"),
    confirmation_campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: `${prefix}-confirmation-${sequence}`
    },
    confirmation_campaign_digest: digest("8"),
    confirmation_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: `${prefix}-confirmation-outcome-${sequence}`
    },
    confirmation_outcome_digest: digest("9"),
    research_release_ref: {
      record_kind: "paper_trading_comparison_research_release",
      id: `${prefix}-release-${sequence}`
    },
    research_release_digest: digest("a"),
    release_kind: releaseKind[status],
    discovery_credit: status === "qualified_improvement" ? 1 : 0
  };
}

function noCandidateSlot(
  prefix: string,
  sequence: number
): ResearchControlCampaignOutcomeRecord["arms"][number]["slot_results"][number] {
  return {
    sequence,
    tick_ref: {
      record_kind: "candidate_arena_tick",
      id: `${prefix}-tick-${sequence}`
    },
    terminal_status: "no_admitted_candidate",
    discovery_credit: 0
  };
}

function reidentifySlot(
  slot: ResearchControlCampaignOutcomeRecord["arms"][number]["slot_results"][number],
  prefix: string,
  sequence: number
) {
  return slot.terminal_status === "no_admitted_candidate"
    ? noCandidateSlot(prefix, sequence)
    : paperSlot(prefix, sequence, slot.terminal_status);
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
