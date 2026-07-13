import { describe, expect, it } from "vitest";
import {
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  type ResearchControlStudyOutcomeRecord
} from "./index";

describe("ResearchControlStudyOutcome", () => {
  it("accepts six all-positive replications as supported", () => {
    const outcome = outcomeFixture([1, 0.8, 0.6, 0.4, 0.2, 0.1]);
    expect(researchControlStudyOutcomeHasRuntimeShape(outcome)).toBe(true);
    expect(outcome).toMatchObject({
      adaptive_positive_count: 6,
      static_positive_count: 0,
      tied_count: 0,
      non_tied_count: 6,
      mean_rate_difference: 0.516667,
      exact_sign_test_p_value: 0.03125,
      inference_status: "adaptive_effect_supported",
      policy_decision_eligibility:
        "eligible_for_separate_policy_decision",
      next_action: "review_research_allocation_policy"
    });
  });

  it("removes identity and digest from canonical outcome input", () => {
    const outcome = outcomeFixture([1, 1, 1, 1, 1, 1]);
    const changed = structuredClone(outcome);
    changed.research_control_study_outcome_id = "other-outcome";
    changed.study_outcome_digest = digest("f");
    expect(researchControlStudyOutcomeDigestInput(changed)).toBe(
      researchControlStudyOutcomeDigestInput(outcome)
    );
  });

  it.each([
    ["missing result", (value: any) => {
      value.replication_results.pop();
    }],
    ["reordered result", (value: any) => {
      value.replication_results.reverse();
    }],
    ["duplicate campaign", (value: any) => {
      value.replication_results[1].campaign_ref.id =
        value.replication_results[0].campaign_ref.id;
    }],
    ["planned count drift", (value: any) => {
      value.planned_replication_count = 5;
    }],
    ["positive count drift", (value: any) => {
      value.adaptive_positive_count = 5;
    }],
    ["mean drift", (value: any) => {
      value.mean_rate_difference = 0.5;
    }],
    ["p-value drift", (value: any) => {
      value.exact_sign_test_p_value = 0.05;
    }],
    ["inference drift", (value: any) => {
      value.inference_status = "adaptive_effect_not_supported";
    }],
    ["eligibility drift", (value: any) => {
      value.policy_decision_eligibility = "not_eligible";
    }],
    ["next action drift", (value: any) => {
      value.next_action = "accumulate_or_redesign_precommitted_study";
    }],
    ["out-of-range difference", (value: any) => {
      value.replication_results[0].observed_rate_difference = 1.1;
    }],
    ["extra field", (value: any) => { value.winner = "adaptive"; }],
    ["policy replacement authority", (value: any) => {
      value.policy_replacement_authority = true;
    }],
    ["promotion authority", (value: any) => {
      value.promotion_authority = true;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }]
  ])("rejects %s", (_label, mutate) => {
    const outcome = outcomeFixture([1, 0.8, 0.6, 0.4, 0.2, 0.1]) as any;
    mutate(outcome);
    expect(researchControlStudyOutcomeHasRuntimeShape(outcome)).toBe(false);
  });

  it.each([
    [[1, 1, 1, 1, 1, 0], "insufficient_non_tied_replications", 0.0625],
    [[1, 1, 1, 1, 1, 1, -1], "adaptive_effect_not_supported", 0.125],
    [[-1, -1, -1, -1, -1, -1], "adaptive_effect_not_supported", 0.03125],
    [[0, 0, 0, 0, 0, 0], "insufficient_non_tied_replications", 1]
  ] as const)("validates inference for %j", (
    differences,
    inference,
    pValue
  ) => {
    const outcome = outcomeFixture([...differences]);
    expect(researchControlStudyOutcomeHasRuntimeShape(outcome)).toBe(true);
    expect(outcome.inference_status).toBe(inference);
    expect(outcome.exact_sign_test_p_value).toBe(pValue);
  });
});

function outcomeFixture(
  differences: number[]
): ResearchControlStudyOutcomeRecord {
  const positive = differences.filter((value) => value > 0).length;
  const negative = differences.filter((value) => value < 0).length;
  const tied = differences.length - positive - negative;
  const nonTied = positive + negative;
  const mean = round6(
    differences.reduce((sum, value) => sum + value, 0) / differences.length
  );
  const pValue = signPValue(positive, negative);
  const supported = nonTied >= 6 && positive > negative && pValue <= 0.05 &&
    mean > 0;
  const inference = nonTied < 6
    ? "insufficient_non_tied_replications" as const
    : supported
    ? "adaptive_effect_supported" as const
    : "adaptive_effect_not_supported" as const;
  return {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id: "study-outcome-001",
    study_ref: {
      record_kind: "research_control_study",
      id: "study-001"
    },
    study_digest: digest("1"),
    replication_results: differences.map((difference, index) => ({
      replication_index: index + 1,
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: `campaign-${index + 1}`
      },
      campaign_digest: digest(String((index % 8) + 2)),
      campaign_outcome_ref: {
        record_kind: "research_control_campaign_outcome",
        id: `campaign-outcome-${index + 1}`
      },
      campaign_outcome_digest: digest(String((index % 8) + 2)),
      observed_rate_difference: difference
    })),
    planned_replication_count: differences.length,
    completed_replication_count: differences.length,
    adaptive_positive_count: positive,
    static_positive_count: negative,
    tied_count: tied,
    non_tied_count: nonTied,
    mean_rate_difference: mean,
    exact_sign_test_p_value: pValue,
    inference_status: inference,
    causal_scope: "same_baseline_stochastic_replication_only",
    policy_decision_eligibility: supported
      ? "eligible_for_separate_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_research_allocation_policy"
      : "accumulate_or_redesign_precommitted_study",
    adjudicated_at: "2026-07-12T12:00:00.000Z",
    study_outcome_digest: digest("a"),
    evaluation_authority: "external_to_trading_systems",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function signPValue(positive: number, negative: number): number {
  const n = positive + negative;
  if (n === 0) return 1;
  const k = Math.min(positive, negative);
  let sum = 0;
  for (let index = 0; index <= k; index += 1) {
    sum += combination(n, index);
  }
  return round6(Math.min(1, 2 * sum / 2 ** n));
}

function combination(n: number, k: number): number {
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = result * (n - index + 1) / index;
  }
  return result;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
