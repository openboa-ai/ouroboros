import { describe, expect, it } from "vitest";
import {
  researchAllocationPolicyDecisionDigestInput,
  researchAllocationPolicyDecisionHasRuntimeShape,
  type ResearchAllocationPolicyDecisionRecord
} from "./index";

describe("ResearchAllocationPolicyDecision", () => {
  it("accepts one approved exact adaptive policy decision", () => {
    expect(researchAllocationPolicyDecisionHasRuntimeShape(
      decisionFixture("approved")
    )).toBe(true);
  });

  it("accepts a not-approved decision without an effective mode", () => {
    const decision = decisionFixture("not_approved");
    expect(decision.effective_default_mode).toBeNull();
    expect(researchAllocationPolicyDecisionHasRuntimeShape(decision)).toBe(true);
  });

  it("removes identity and digest from canonical digest input", () => {
    const decision = decisionFixture("approved");
    const changed = structuredClone(decision);
    changed.research_allocation_policy_decision_id = "other-decision";
    changed.policy_decision_digest = digest("f");
    expect(researchAllocationPolicyDecisionDigestInput(changed)).toBe(
      researchAllocationPolicyDecisionDigestInput(decision)
    );
  });

  it.each([
    ["static target mode", (value: any) => {
      value.decision_policy.target_allocation_mode = "static_control";
    }],
    ["static effective mode", (value: any) => {
      value.effective_default_mode = "static_control";
    }],
    ["approved null mode", (value: any) => {
      value.effective_default_mode = null;
    }],
    ["not-approved adaptive mode", (value: any) => {
      value.decision_status = "not_approved";
      value.decision_reason = "study_outcome_not_eligible";
    }],
    ["approved ineligible reason", (value: any) => {
      value.decision_reason = "study_outcome_not_eligible";
    }],
    ["wrong application scope", (value: any) => {
      value.decision_policy.application_scope = "all_campaigns";
    }],
    ["bad target digest", (value: any) => {
      value.target_allocation_policy_digest = "pending";
    }],
    ["bad decision time", (value: any) => {
      value.decided_at = "today";
    }],
    ["extra field", (value: any) => { value.static_wins = true; }],
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
    }]
  ])("rejects %s", (label, mutate) => {
    const decision = decisionFixture("approved") as any;
    mutate(decision);
    expect(
      researchAllocationPolicyDecisionHasRuntimeShape(decision),
      String(label)
    ).toBe(false);
  });
});

function decisionFixture(
  status: "approved" | "not_approved"
): ResearchAllocationPolicyDecisionRecord {
  return {
    record_kind: "research_allocation_policy_decision",
    version: 1,
    research_allocation_policy_decision_id: "policy-decision-001",
    study_ref: {
      record_kind: "research_control_study",
      id: "study-001"
    },
    study_digest: digest("1"),
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: "study-outcome-001"
    },
    study_outcome_digest: digest("2"),
    target_allocation_policy_digest: digest("3"),
    decision_policy: {
      policy_version: "adaptive_supported_effect_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "adaptive_effect_supported",
      required_causal_scope: "same_baseline_stochastic_replication_only",
      required_policy_decision_eligibility:
        "eligible_for_separate_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: status,
    decision_reason: status === "approved"
      ? "supported_same_baseline_adaptive_effect"
      : "study_outcome_not_eligible",
    effective_default_mode: status === "approved" ? "adaptive_default" : null,
    decided_at: "2026-07-12T13:00:00.000Z",
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
