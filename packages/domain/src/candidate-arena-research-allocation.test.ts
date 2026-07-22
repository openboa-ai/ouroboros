import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  sanitizeResearchEvidenceText,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaResearchAllocationSignal
} from "./index";

describe("CandidateArenaResearchAllocation", () => {
  it("accepts canonical adaptive, static-control, and explicit allocations", () => {
    expect(candidateArenaResearchAllocationHasRuntimeShape(
      adaptiveAllocationFixture()
    )).toBe(true);
    expect(candidateArenaResearchAllocationHasRuntimeShape(
      staticAllocationFixture()
    )).toBe(true);
    expect(candidateArenaResearchAllocationHasRuntimeShape(
      explicitAllocationFixture()
    )).toBe(true);
  });

  it("accepts an exact approved-policy basis only for adaptive allocation", () => {
    const allocation = adaptiveAllocationFixture();
    allocation.allocation_policy_basis = approvedPolicyBasis();

    expect(candidateArenaResearchAllocationHasRuntimeShape(allocation)).toBe(true);
  });

  it("accepts an exact approved-generalization basis only for adaptive allocation", () => {
    const allocation = adaptiveAllocationFixture();
    allocation.allocation_policy_basis = approvedGeneralizationPolicyBasis();

    expect(candidateArenaResearchAllocationHasRuntimeShape(allocation)).toBe(true);
  });

  it("binds one exact Research trigger into allocation identity", () => {
    const allocation = {
      ...adaptiveAllocationFixture(),
      trigger: {
        trigger_kind: "arena_event",
        trigger_id: "research-trigger-adaptive-tick-2",
        goal: "Use the latest Arena evidence in a bounded Research tick.",
        triggered_at: "2026-07-12T09:59:00.000Z",
        source_ref: {
          record_kind: "paper_trading_evaluation",
          id: "paper-evaluation-a"
        },
        evidence_artifact_ref: {
          record_kind: "research_evidence_artifact",
          id: "research-evidence-a"
        },
        evidence_artifact_digest: `sha256:${"e".repeat(64)}`,
        authority_status: "research_only"
      }
    } as CandidateArenaResearchAllocationRecord;

    expect(candidateArenaResearchAllocationHasRuntimeShape(allocation)).toBe(true);
    const changed = structuredClone(allocation);
    changed.trigger!.evidence_artifact_digest = `sha256:${"f".repeat(64)}`;
    expect(candidateArenaResearchAllocationDigestInput(changed)).not.toBe(
      candidateArenaResearchAllocationDigestInput(allocation)
    );
  });

  it("freezes every scheduling and authority field in digest input", () => {
    const baseline = adaptiveAllocationFixture();
    const baselineDigestInput = candidateArenaResearchAllocationDigestInput(
      baseline
    );
    const mutations: Array<(value: CandidateArenaResearchAllocationRecord) => void> = [
      (value) => { value.allocation_mode = "static_control"; },
      (value) => { value.allocation_policy_basis = { basis_kind: "explicit_request" }; },
      (value) => { value.policy.concurrency_limit = 1 as 2; },
      (value) => { value.signal_snapshot[0]!.focus_score = 4; },
      (value) => { value.selected_directions.reverse(); },
      (value) => { value.selected_directions[0]!.experiment_budget = 1; },
      (value) => { value.deferred_directions.reverse(); },
      (value) => { value.source_tick_refs[0]!.id = "different-tick"; },
      (value) => { value.allocated_at = "2026-07-12T11:00:00.000Z"; },
      (value) => { value.promotion_authority = true as false; }
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(candidateArenaResearchAllocationDigestInput(changed)).not.toBe(
        baselineDigestInput
      );
    }
  });

  it.each([
    ["unknown mode", (value: any) => { value.allocation_mode = "learned"; }],
    ["missing policy basis", (value: any) => {
      delete value.allocation_policy_basis;
    }],
    ["static repository-default basis", (value: any) => {
      value.allocation_mode = "static_control";
      value.allocation_policy_basis = { basis_kind: "repository_default" };
    }],
    ["malformed policy-decision basis", (value: any) => {
      value.allocation_policy_basis = approvedPolicyBasis();
      value.allocation_policy_basis.policy_decision_digest = "sha256:short";
    }],
    ["malformed generalization-policy basis", (value: any) => {
      value.allocation_policy_basis = approvedGeneralizationPolicyBasis();
      value.allocation_policy_basis.generalization_outcome_ref.record_kind =
        "research_control_study_outcome";
    }],
    ["policy drift", (value: any) => { value.policy.concurrency_limit = 3; }],
    ["duplicate signal", (value: any) => {
      value.signal_snapshot.push(structuredClone(value.signal_snapshot[0]));
    }],
    ["non-finite signal", (value: any) => {
      value.signal_snapshot[0].focus_score = Number.NaN;
    }],
    ["duplicate selected direction", (value: any) => {
      value.selected_directions[1].direction_kind =
        value.selected_directions[0].direction_kind;
    }],
    ["non-contiguous priority", (value: any) => {
      value.selected_directions[0].priority = 2;
    }],
    ["wrong focus budget", (value: any) => {
      value.selected_directions[0].experiment_budget = 1;
    }],
    ["wrong exploration budget", (value: any) => {
      value.selected_directions[2].experiment_budget = 2;
    }],
    ["too many focus selections", (value: any) => {
      value.selected_directions[2].selection_kind = "focus";
      value.selected_directions[2].experiment_budget = 2;
    }],
    ["missing exploration floor", (value: any) => {
      value.selected_directions[2].selection_kind = "focus";
    }],
    ["selected deferred overlap", (value: any) => {
      value.deferred_directions[0] =
        value.selected_directions[0].direction_kind;
    }],
    ["omitted default direction", (value: any) => {
      value.deferred_directions.pop();
    }],
    ["budget above maximum", (value: any) => {
      value.selected_directions[0].experiment_budget = 4;
    }],
    ["non-canonical time", (value: any) => {
      value.allocated_at = "2026-07-12 10:00:00";
    }],
    ["empty digest", (value: any) => { value.allocation_digest = ""; }],
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
  ])("rejects invalid %s", (_label, mutate) => {
    const allocation = adaptiveAllocationFixture() as any;
    mutate(allocation);
    expect(candidateArenaResearchAllocationHasRuntimeShape(allocation)).toBe(false);
  });

  it.each([
    ["empty explicit directions", (value: any) => {
      value.selected_directions = [];
    }],
    ["explicit signal snapshot", (value: any) => {
      value.signal_snapshot = allocationSignals();
    }],
    ["wrong explicit budget", (value: any) => {
      value.selected_directions[0].experiment_budget = 2;
    }]
  ])("rejects invalid explicit %s", (_label, mutate) => {
    const allocation = explicitAllocationFixture() as any;
    mutate(allocation);
    expect(candidateArenaResearchAllocationHasRuntimeShape(allocation)).toBe(false);
  });

  it("removes credentials, key material, URLs, and host paths from research text", () => {
    const keyLabel = ["PRIVATE", "KEY"].join(" ");
    const unsafe = [
      '{"apiKey":"json-secret","password":"password-secret"}',
      "Authorization: Basic YmFzaWMtc2VjcmV0",
      "Authorization: Bearer bearer-secret",
      `-----BEGIN ${keyLabel}-----\nkey-body-secret\n-----END ${keyLabel}-----`,
      "https://url-user:url-secret@example.test/private?token=query-secret",
      "/Users/private-owner/project/evidence.json",
      "C:\\Users\\private-owner\\project\\evidence.json"
    ].join("\n");

    const sanitized = sanitizeResearchEvidenceText(unsafe);

    for (const secret of [
      "json-secret",
      "password-secret",
      "YmFzaWMtc2VjcmV0",
      "bearer-secret",
      "key-body-secret",
      "url-secret",
      "query-secret",
      "private-owner"
    ]) {
      expect(sanitized).not.toContain(secret);
    }
    expect(sanitized).toContain("[redacted]");
    expect(sanitized).toContain("[external-url]");
    expect(sanitized).toContain("[private-path]");
  });

  it("redacts adversarial and unterminated PEM-like input without backtracking", () => {
    const repeatedHeaders = ["-----", "BEGIN ", ",", "-----"]
      .join("")
      .repeat(20_000);
    const unterminated = [
      "before\n-----",
      "BEGIN ",
      ["PRIVATE", "KEY"].join(" "),
      "-----\nsecret-without-footer"
    ].join("");

    expect(sanitizeResearchEvidenceText(repeatedHeaders)).toBe(
      "[redacted-key-material]"
    );
    expect(sanitizeResearchEvidenceText(unterminated)).toBe(
      "before\n[redacted-key-material]"
    );
  });
});

function adaptiveAllocationFixture(): CandidateArenaResearchAllocationRecord {
  return {
    ...allocationBase("adaptive_default"),
    signal_snapshot: allocationSignals(),
    selected_directions: [
      {
        direction_kind: "execution_cost_robustness",
        selection_kind: "focus",
        priority: 1,
        experiment_budget: 2,
        signal_score: 37,
        reasons: [
          "public_execution_evidence_gap:observation_quality:paper_evaluation_failed"
        ]
      },
      {
        direction_kind: "mean_reversion",
        selection_kind: "focus",
        priority: 2,
        experiment_budget: 2,
        signal_score: 21,
        reasons: ["research_efficiency_budget:low_cost_latency"]
      },
      {
        direction_kind: "trend_following",
        selection_kind: "exploration",
        priority: 3,
        experiment_budget: 1,
        signal_score: -10,
        reasons: ["exploration_floor"]
      }
    ],
    deferred_directions: ["volatility_regime", "funding_aware_risk"]
  };
}

function staticAllocationFixture(): CandidateArenaResearchAllocationRecord {
  return {
    ...allocationBase("static_control"),
    signal_snapshot: allocationSignals(),
    selected_directions: [
      staticSelection("trend_following", 1, 2),
      staticSelection("mean_reversion", 2, 2),
      staticSelection("volatility_regime", 3, 1)
    ],
    deferred_directions: [
      "funding_aware_risk",
      "execution_cost_robustness"
    ]
  };
}

function explicitAllocationFixture(): CandidateArenaResearchAllocationRecord {
  return {
    ...allocationBase("explicit"),
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: "other",
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["explicit_direction"]
    }],
    deferred_directions: [
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ]
  };
}

function allocationBase(
  allocationMode: CandidateArenaResearchAllocationRecord["allocation_mode"]
): Omit<
  CandidateArenaResearchAllocationRecord,
  "signal_snapshot" | "selected_directions" | "deferred_directions"
> {
  return {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id:
      "candidate-arena-research-allocation-adaptive-tick-2",
    tick_id: "adaptive-tick-2",
    allocation_mode: allocationMode,
    allocation_policy_basis: allocationMode === "adaptive_default"
      ? { basis_kind: "repository_default" }
      : { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [{
      record_kind: "candidate_arena_tick",
      id: "candidate-arena-tick-adaptive-tick-1"
    }],
    allocated_at: "2026-07-12T10:00:00.000Z",
    allocation_digest: "sha256:abc123",
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function approvedPolicyBasis() {
  return {
    basis_kind: "research_allocation_policy_decision" as const,
    policy_decision_ref: {
      record_kind: "research_allocation_policy_decision",
      id: "research-allocation-policy-decision-study-outcome"
    },
    policy_decision_digest: `sha256:${"a".repeat(64)}`,
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: "research-control-study-outcome-study"
    },
    study_outcome_digest: `sha256:${"b".repeat(64)}`
  };
}

function approvedGeneralizationPolicyBasis() {
  return {
    basis_kind: "research_generalization_policy_decision" as const,
    policy_decision_ref: {
      record_kind: "research_generalization_policy_decision",
      id: "research-generalization-policy-decision-outcome"
    },
    policy_decision_digest: `sha256:${"c".repeat(64)}`,
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: "research-generalization-outcome-protocol"
    },
    generalization_outcome_digest: `sha256:${"d".repeat(64)}`
  };
}

function staticSelection(
  directionKind: CandidateArenaResearchAllocationRecord[
    "selected_directions"
  ][number]["direction_kind"],
  priority: number,
  experimentBudget: number
): CandidateArenaResearchAllocationRecord["selected_directions"][number] {
  return {
    direction_kind: directionKind,
    selection_kind: "static_control",
    priority,
    experiment_budget: experimentBudget,
    signal_score: 0,
    reasons: ["static_control"]
  };
}

function allocationSignals(): CandidateArenaResearchAllocationSignal[] {
  return [
    allocationSignal("trend_following", -10, ["recent_outcome:failed"]),
    allocationSignal("mean_reversion", 21, [
      "research_efficiency_budget:low_cost_latency"
    ]),
    allocationSignal("volatility_regime", 0, []),
    allocationSignal("funding_aware_risk", 0, []),
    allocationSignal("execution_cost_robustness", 37, [
      "public_execution_evidence_gap:observation_quality:paper_evaluation_failed"
    ])
  ];
}

function allocationSignal(
  directionKind: CandidateArenaResearchAllocationSignal["direction_kind"],
  focusScore: number,
  reasons: string[]
): CandidateArenaResearchAllocationSignal {
  return {
    direction_kind: directionKind,
    finding_pressure_score: directionKind === "execution_cost_robustness" ? 37 : 0,
    research_efficiency_score: directionKind === "mean_reversion" ? 21 : 0,
    recent_outcome_score: directionKind === "trend_following" ? -10 : 0,
    focus_score: focusScore,
    completed_selection_count: directionKind === "trend_following" ? 1 : 0,
    ...(directionKind === "trend_following"
      ? {
          last_completed_allocation_ref: {
            record_kind: "candidate_arena_research_allocation",
            id: "candidate-arena-research-allocation-adaptive-tick-1"
          }
        }
      : {}),
    source_candidate_ids: directionKind === "execution_cost_robustness"
      ? ["candidate-001"]
      : [],
    source_tick_ids: directionKind === "volatility_regime" ||
        directionKind === "funding_aware_risk" ||
        directionKind === "execution_cost_robustness"
      ? []
      : ["adaptive-tick-1"],
    reasons
  };
}
