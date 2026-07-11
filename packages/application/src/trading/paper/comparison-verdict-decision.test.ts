import type {
  PaperTradingComparisonQualificationResult,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import {
  decidePaperTradingComparisonVerdict,
  PaperTradingComparisonVerdictDecisionError
} from "./comparison-verdict-decision";

describe("paper trading comparison verdict decision", () => {
  it("marks a strictly positive lift at the frozen threshold as improved", () => {
    expect(decidePaperTradingComparisonVerdict({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: 10,
      championScore: score(2, 1),
      challengerScore: score(12, 2)
    })).toEqual({
      verdict_outcome: "challenger_improved",
      champion: { net_revenue_usdt: 2, cost_usdt: 1 },
      challenger: { net_revenue_usdt: 12, cost_usdt: 2 },
      metric: {
        metric_kind: "net_revenue_usdt",
        champion_value_usdt: 2,
        challenger_value_usdt: 12,
        observed_lift_usdt: 10,
        minimum_lift_usdt: 10
      },
      confirmation_disposition: "requires_precommitted_campaign",
      next_action: "precommit_confirmation_campaign"
    });
  });

  it.each([
    ["below threshold", 2, 11, 10],
    ["equal", 2, 2, 0],
    ["regressed", 2, 1, 0]
  ])("marks %s qualified evidence as not improved", (_label, champion, challenger, minimum) => {
    expect(decidePaperTradingComparisonVerdict({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: minimum,
      championScore: score(champion, 1),
      challengerScore: score(challenger, 1)
    })).toMatchObject({
      verdict_outcome: "challenger_not_improved",
      confirmation_disposition: "not_applicable",
      next_action: "return_to_candidate_arena"
    });
  });

  it("rounds stored score values before deriving a six-decimal lift", () => {
    const result = decidePaperTradingComparisonVerdict({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: 0.100001,
      championScore: score(0.1234564, 0.0000004),
      challengerScore: score(0.2234566, 0.0000006)
    });

    expect(result).toMatchObject({
      verdict_outcome: "challenger_improved",
      champion: { net_revenue_usdt: 0.123456, cost_usdt: 0 },
      challenger: { net_revenue_usdt: 0.223457, cost_usdt: 0.000001 },
      metric: { observed_lift_usdt: 0.100001 }
    });
  });

  it("returns ineligible without economic fields for settled unqualified evidence", () => {
    const result = decidePaperTradingComparisonVerdict({
      pairQualification: ineligiblePair(),
      minimumLiftUsdt: 10
    });

    expect(result).toEqual({
      verdict_outcome: "comparison_ineligible",
      confirmation_disposition: "not_applicable",
      next_action: "repair_evidence_or_rerun_comparison"
    });
    expect("metric" in result).toBe(false);
    expect("champion" in result).toBe(false);
    expect("challenger" in result).toBe(false);
  });

  it.each([
    ["negative minimum", () => ({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: -1,
      championScore: score(0, 0),
      challengerScore: score(1, 0)
    })],
    ["non-finite minimum", () => ({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: Number.NaN,
      championScore: score(0, 0),
      challengerScore: score(1, 0)
    })],
    ["missing qualified score", () => ({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: 0,
      championScore: score(0, 0)
    })],
    ["score-bearing ineligible evidence", () => ({
      pairQualification: ineligiblePair(),
      minimumLiftUsdt: 0,
      championScore: score(0, 0),
      challengerScore: score(0, 0)
    })],
    ["non-finite score", () => ({
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: 0,
      championScore: score(0, 0),
      challengerScore: { ...score(1, 0), net_revenue_usdt: Number.POSITIVE_INFINITY }
    })],
    ["qualified pair with unqualified side", () => {
      const pair = qualifiedPair();
      pair.challenger = {
        ...pair.challenger,
        qualification_status: "collecting_evidence",
        qualification_reasons: ["min_observation_count_not_met"]
      };
      return {
        pairQualification: pair,
        minimumLiftUsdt: 0,
        championScore: score(0, 0),
        challengerScore: score(1, 0)
      };
    }]
  ])("rejects %s", (_label, input) => {
    expect(() => decidePaperTradingComparisonVerdict(input()))
      .toThrowError(PaperTradingComparisonVerdictDecisionError);
    expect(() => decidePaperTradingComparisonVerdict(input())).toThrowError(
      expect.objectContaining({
        code: "invalid_paper_trading_comparison_verdict_decision_input"
      })
    );
  });

  it("is deterministic and does not mutate qualification or score inputs", () => {
    const input = {
      pairQualification: qualifiedPair(),
      minimumLiftUsdt: 1,
      championScore: score(1, 1),
      challengerScore: score(3, 2)
    };
    const before = structuredClone(input);

    const first = decidePaperTradingComparisonVerdict(input);
    const second = decidePaperTradingComparisonVerdict(input);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
  });
});

function qualifiedPair(): PaperTradingComparisonQualificationResult {
  return {
    comparison_id: "comparison-001",
    activation_id: "activation-001",
    activation_attempt_id: "activation-attempt-001",
    qualification_status: "qualified",
    qualification_reasons: [],
    checkpoint_count: 3,
    champion: sideQualification("qualified"),
    challenger: sideQualification("qualified"),
    authority_status: "not_verdict"
  };
}

function ineligiblePair(): PaperTradingComparisonQualificationResult {
  return {
    ...qualifiedPair(),
    qualification_status: "not_qualified",
    qualification_reasons: ["comparison_minimum_observation_count_not_met"],
    checkpoint_count: 2,
    champion: sideQualification("collecting_evidence"),
    challenger: sideQualification("collecting_evidence")
  };
}

function sideQualification(status: "qualified" | "collecting_evidence") {
  return {
    qualification_status: status,
    qualification_reasons: status === "qualified"
      ? []
      : ["min_observation_count_not_met" as const],
    evidence_window: {
      observation_count: status === "qualified" ? 3 : 2,
      elapsed_ms: status === "qualified" ? 120_000 : 60_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T00:00:00.000Z",
      last_observed_at: "2026-07-12T00:02:00.000Z"
    }
  } as const;
}

function score(netRevenue: number, cost: number): TradingProfitLossReadModel {
  return {
    revenue_usdt: netRevenue + cost,
    cost_usdt: cost,
    net_revenue_usdt: netRevenue,
    net_return_pct: netRevenue / 100
  };
}
