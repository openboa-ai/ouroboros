import type {
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationSlotResultStatus
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import {
  decidePaperTradingComparisonResearchRelease,
  PaperTradingComparisonResearchReleaseDecisionError
} from "./comparison-research-release-decision";

describe("paper trading comparison research release decision", () => {
  it.each([
    [["challenger_improved", "challenger_improved"], {
      release_kind: "confirmed_improvement",
      finding_kind: "positive_result",
      next_research_focus:
        "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence."
    }],
    [["challenger_improved", "challenger_not_improved"], {
      release_kind: "challenger_not_reproduced",
      finding_kind: "negative_result",
      next_research_focus:
        "Explain non-reproduction, preserve the negative result, and generate differentiated candidates under new prospective evidence."
    }],
    [["comparison_ineligible", "comparison_ineligible"], {
      release_kind: "comparison_evidence_ineligible",
      finding_kind: "failure_analysis",
      next_research_focus:
        "Repair comparison evidence and protocol quality before making an economic interpretation."
    }],
    [["slot_expired", "slot_expired"], {
      release_kind: "campaign_slot_expired",
      finding_kind: "failure_analysis",
      next_research_focus:
        "Repair campaign scheduling and recovery before making an economic interpretation."
    }]
  ] as const)("classifies %s", (statuses, expected) => {
    const outcome = outcomeFixture([...statuses]);

    expect(decidePaperTradingComparisonResearchRelease(outcome)).toEqual({
      ...expected,
      summary: `Paper comparison confirmation campaign campaign-001: ` +
        `improved=${outcome.improved_count}, ` +
        `not_improved=${outcome.not_improved_count}, ` +
        `ineligible=${outcome.ineligible_count}, ` +
        `expired=${outcome.expired_count}; release=${expected.release_kind}.`
    });
  });

  it("prioritizes an observed non-improvement over ineligible evidence", () => {
    expect(decidePaperTradingComparisonResearchRelease(outcomeFixture([
      "challenger_not_improved",
      "comparison_ineligible"
    ])).release_kind).toBe("challenger_not_reproduced");
  });

  it("prioritizes ineligible evidence over expiry", () => {
    expect(decidePaperTradingComparisonResearchRelease(outcomeFixture([
      "comparison_ineligible",
      "slot_expired"
    ])).release_kind).toBe("comparison_evidence_ineligible");
  });

  it.each([
    ["count drift", (value: any) => {
      value.improved_count += 1;
    }],
    ["partial slots", (value: any) => {
      value.slot_results.pop();
    }],
    ["reordered slots", (value: any) => {
      value.slot_results.reverse();
    }],
    ["duplicate slots", (value: any) => {
      value.slot_results[1].paper_trading_comparison_commitment_ref = {
        ...value.slot_results[0].paper_trading_comparison_commitment_ref
      };
    }],
    ["non-terminal shape", (value: any) => {
      value.release_status = "released";
    }]
  ])("rejects %s", (_label, mutate) => {
    const outcome = outcomeFixture([
      "challenger_improved",
      "challenger_improved"
    ]) as any;
    mutate(outcome);

    expect(() => decidePaperTradingComparisonResearchRelease(outcome))
      .toThrowError(PaperTradingComparisonResearchReleaseDecisionError);
    expect(() => decidePaperTradingComparisonResearchRelease(outcome))
      .toThrowError(expect.objectContaining({
        code: "invalid_paper_trading_comparison_research_release_decision_input"
      }));
  });

  it("is deterministic and does not mutate the outcome", () => {
    const outcome = outcomeFixture([
      "challenger_not_improved",
      "comparison_ineligible"
    ]);
    const before = structuredClone(outcome);

    const first = decidePaperTradingComparisonResearchRelease(outcome);
    const second = decidePaperTradingComparisonResearchRelease(outcome);

    expect(first).toEqual(second);
    expect(outcome).toEqual(before);
  });
});

function outcomeFixture(
  statuses: PaperTradingComparisonConfirmationSlotResultStatus[]
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const counts = {
    improved_count: statuses.filter((status) =>
      status === "challenger_improved").length,
    not_improved_count: statuses.filter((status) =>
      status === "challenger_not_improved").length,
    ineligible_count: statuses.filter((status) =>
      status === "comparison_ineligible").length,
    expired_count: statuses.filter((status) => status === "slot_expired").length
  };
  const confirmed = counts.improved_count === statuses.length;
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      "campaign-001-outcome",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "campaign-001"
    },
    campaign_digest: "sha256:campaign",
    slot_results: statuses.map((status, index) => ({
      slot_index: index + 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: `paper-trading-comparison-${index === 0
          ? "1111111111111111"
          : "2222222222222222"}`
      },
      status,
      ...(status !== "slot_expired" ? {
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `slot-verdict-${index + 1}`
        },
        verdict_digest: `sha256:slot-verdict-${index + 1}`,
        window_started_at: `2026-07-12T0${4 + index}:00:00.000Z`,
        window_ended_at: `2026-07-12T0${4 + index}:30:00.000Z`
      } : {})
    })),
    ...counts,
    campaign_outcome: confirmed ? "confirmed_improvement" : "not_confirmed",
    decision_rule: "all_reserved_windows_must_improve",
    promotion_eligibility: confirmed ? "eligible" : "not_eligible",
    release_status: "sealed",
    next_action: confirmed
      ? "review_for_trading_promotion"
      : "return_to_candidate_arena",
    evaluated_at: "2026-07-12T07:00:00.000Z",
    outcome_digest: "sha256:campaign-outcome",
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}
