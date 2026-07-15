import { describe, expect, it } from "vitest";
import {
  researchGeneralizationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionHasRuntimeShape,
  type ResearchGeneralizationPolicyDecisionRecord
} from "./index";

describe("ResearchGeneralizationPolicyDecision", () => {
  it("accepts one approved exact generalized adaptive policy decision", () => {
    expect(researchGeneralizationPolicyDecisionHasRuntimeShape(
      decisionFixture("approved")
    )).toBe(true);
  });

  it("accepts a not-approved decision without an effective mode", () => {
    const decision = decisionFixture("not_approved");
    expect(decision.effective_default_mode).toBeNull();
    expect(researchGeneralizationPolicyDecisionHasRuntimeShape(decision))
      .toBe(true);
  });

  it("removes deterministic identity and digest from canonical digest input", () => {
    const decision = decisionFixture("approved");
    const changed = structuredClone(decision);
    changed.research_generalization_policy_decision_id = "other-decision";
    changed.policy_decision_digest = digest("f");
    expect(researchGeneralizationPolicyDecisionDigestInput(changed)).toBe(
      researchGeneralizationPolicyDecisionDigestInput(decision)
    );
  });

  it.each([
    ["wrong record kind", (value: any) => {
      value.record_kind = "research_allocation_policy_decision";
    }],
    ["wrong protocol ref", (value: any) => {
      value.protocol_ref.record_kind = "research_control_study";
    }],
    ["wrong outcome ref", (value: any) => {
      value.generalization_outcome_ref.record_kind =
        "research_control_study_outcome";
    }],
    ["bad protocol digest", (value: any) => {
      value.protocol_digest = "pending";
    }],
    ["bad outcome digest", (value: any) => {
      value.generalization_outcome_digest = "pending";
    }],
    ["static target mode", (value: any) => {
      value.decision_policy.target_allocation_mode = "static_control";
    }],
    ["wrong required inference", (value: any) => {
      value.decision_policy.required_inference_status =
        "generalization_not_supported";
    }],
    ["wrong required scope", (value: any) => {
      value.decision_policy.required_causal_scope =
        "same_baseline_stochastic_replication_only";
    }],
    ["wrong required eligibility", (value: any) => {
      value.decision_policy.required_policy_decision_eligibility =
        "not_eligible";
    }],
    ["wrong application scope", (value: any) => {
      value.decision_policy.application_scope = "all_candidate_arena_ticks";
    }],
    ["static effective mode", (value: any) => {
      value.effective_default_mode = "static_control";
    }],
    ["approved null mode", (value: any) => {
      value.effective_default_mode = null;
    }],
    ["not-approved adaptive mode", (value: any) => {
      value.decision_status = "not_approved";
      value.decision_reason = "generalization_outcome_not_eligible";
    }],
    ["approved ineligible reason", (value: any) => {
      value.decision_reason = "generalization_outcome_not_eligible";
    }],
    ["bad target digest", (value: any) => {
      value.target_allocation_policy_digest = "pending";
    }],
    ["bad decision time", (value: any) => {
      value.decided_at = "today";
    }],
    ["extra field", (value: any) => {
      value.static_wins = true;
    }],
    ["selection authority closed", (value: any) => {
      value.research_policy_selection_authority = false;
    }],
    ["evaluation authority", (value: any) => {
      value.evaluation_authority = true;
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
    ["wrong authority status", (value: any) => {
      value.authority_status = "not_live";
    }]
  ])("rejects %s", (label, mutate) => {
    const decision = decisionFixture("approved") as any;
    mutate(decision);
    expect(
      researchGeneralizationPolicyDecisionHasRuntimeShape(decision),
      String(label)
    ).toBe(false);
  });
});

function decisionFixture(
  status: "approved" | "not_approved"
): ResearchGeneralizationPolicyDecisionRecord {
  return {
    record_kind: "research_generalization_policy_decision",
    version: 1,
    research_generalization_policy_decision_id:
      "generalization-policy-decision-001",
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: "generalization-protocol-001"
    },
    protocol_digest: digest("1"),
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: "generalization-outcome-001"
    },
    generalization_outcome_digest: digest("2"),
    target_allocation_policy_digest: digest("3"),
    decision_policy: {
      policy_version: "generalization_supported_adaptive_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "generalization_supported",
      required_causal_scope:
        "pre_effect_market_condition_blocked_cross_baseline_study_effects",
      required_policy_decision_eligibility:
        "eligible_for_separate_generalization_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: status,
    decision_reason: status === "approved"
      ? "supported_cross_condition_adaptive_effect"
      : "generalization_outcome_not_eligible",
    effective_default_mode: status === "approved" ? "adaptive_default" : null,
    decided_at: "2026-07-13T13:00:00.000Z",
    policy_decision_digest: digest("4"),
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
