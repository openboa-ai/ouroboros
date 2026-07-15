import { describe, expect, it } from "vitest";
import {
  researchMemoryControlPairOutcomeDigestInput,
  researchMemoryControlPairOutcomeHasRuntimeShape,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyHasRuntimeShape,
  researchMemoryControlStudyOutcomeDigestInput,
  researchMemoryControlStudyOutcomeHasRuntimeShape,
  type ResearchMemoryControlPairOutcomeRecord,
  type ResearchMemoryControlStudyOutcomeRecord,
  type ResearchMemoryControlStudyRecord
} from "./index";

describe("ResearchMemoryControlStudy domain records", () => {
  it("accepts exact research-only study, pair, and inference records", () => {
    expect(researchMemoryControlStudyHasRuntimeShape(studyFixture())).toBe(true);
    expect(researchMemoryControlPairOutcomeHasRuntimeShape(
      pairFixture(1)
    )).toBe(true);
    expect(researchMemoryControlStudyOutcomeHasRuntimeShape(
      outcomeFixture()
    )).toBe(true);
  });

  it("binds every causal field into canonical digest inputs", () => {
    const study = studyFixture();
    const pair = pairFixture(1);
    const outcome = outcomeFixture();
    const changedStudy = structuredClone(study);
    changedStudy.pair_plans[0]!.direction_kind = "volatility_regime";
    const changedPair = structuredClone(pair);
    changedPair.memory_masked.admission_evidence!.decision_digest = digest("9");
    const changedOutcome = structuredClone(outcome);
    changedOutcome.pair_results[0]!.paired_difference = -1;

    expect(researchMemoryControlStudyDigestInput(changedStudy)).not.toBe(
      researchMemoryControlStudyDigestInput(study)
    );
    expect(researchMemoryControlPairOutcomeDigestInput(changedPair)).not.toBe(
      researchMemoryControlPairOutcomeDigestInput(pair)
    );
    expect(researchMemoryControlStudyOutcomeDigestInput(changedOutcome)).not
      .toBe(researchMemoryControlStudyOutcomeDigestInput(outcome));
  });

  it("rejects completed evidence mislabeled as no submission", () => {
    const pair = pairFixture(1);
    pair.released_memory = {
      ...pair.released_memory,
      terminal_status: "completed",
      failure_kind: null,
      tick_evidence: null,
      preflight_evidence: null,
      admission_evidence: null,
      resource_summary: null,
      observation: "ineligible",
      exact_repeat_indicator: null,
      ineligibility_reason: "no_submission"
    };
    pair.eligibility_status = "ineligible";
    pair.ineligibility_reason = "no_submission";
    pair.paired_difference = null;

    expect(researchMemoryControlPairOutcomeHasRuntimeShape(pair)).toBe(false);
  });

  it.each([
    ["study evaluation authority", () => {
      const value = studyFixture() as any;
      value.evaluation_authority = true;
      return ["study", value] as const;
    }],
    ["duplicate study tick", () => {
      const value = studyFixture() as any;
      value.pair_plans[1].released_memory_treatment.tick_id =
        value.pair_plans[0].released_memory_treatment.tick_id;
      return ["study", value] as const;
    }],
    ["study without exact model", () => {
      const value = studyFixture() as any;
      delete value.research_agent.model;
      return ["study", value] as const;
    }],
    ["study with malformed opportunity protocol", () => {
      const value = studyFixture() as any;
      value.opportunity_protocol.sealed_suite_digest = "sha256:short";
      return ["study", value] as const;
    }],
    ["pair promotion authority", () => {
      const value = pairFixture(1) as any;
      value.promotion_authority = true;
      return ["pair", value] as const;
    }],
    ["pair worker identity drift", () => {
      const value = pairFixture(1) as any;
      value.memory_masked.worker_evidence.model = "different-model";
      return ["pair", value] as const;
    }],
    ["pair opportunity protocol drift", () => {
      const value = pairFixture(1) as any;
      value.memory_masked.preflight_evidence.development_suite_digest =
        digest("9");
      return ["pair", value] as const;
    }],
    ["pair start skew outside policy", () => {
      const value = pairFixture(1) as any;
      value.memory_masked.tick_evidence.started_at =
        "2026-07-13T05:00:40.000Z";
      value.initial_start_skew_ms = 10_000;
      return ["pair", value] as const;
    }],
    ["eligible pair missing resource evidence", () => {
      const value = pairFixture(1) as any;
      value.memory_masked.resource_summary = null;
      return ["pair", value] as const;
    }],
    ["failed arm missing resource evidence", () => {
      const value = pairFixture(1) as any;
      value.released_memory.terminal_status = "worker_failed";
      value.released_memory.failure_kind = "research_worker_failed";
      value.released_memory.resource_summary = null;
      value.released_memory.observation = "ineligible";
      value.released_memory.exact_repeat_indicator = null;
      value.released_memory.ineligibility_reason =
        "worker_or_platform_failure";
      value.eligibility_status = "ineligible";
      value.ineligibility_reason = "worker_or_platform_failure";
      value.paired_difference = null;
      return ["pair", value] as const;
    }],
    ["ineligible pair with zero difference", () => {
      const value = pairFixture(1) as any;
      value.eligibility_status = "ineligible";
      value.ineligibility_reason = "no_submission";
      return ["pair", value] as const;
    }],
    ["outcome replacement authority", () => {
      const value = outcomeFixture() as any;
      value.memory_policy_replacement_authority = true;
      return ["outcome", value] as const;
    }],
    ["outcome count drift", () => {
      const value = outcomeFixture() as any;
      value.favorable_pair_count = 5;
      return ["outcome", value] as const;
    }]
  ])("rejects %s", (_label, fixture) => {
    const [kind, value] = fixture();
    const valid = kind === "study"
      ? researchMemoryControlStudyHasRuntimeShape(value)
      : kind === "pair"
      ? researchMemoryControlPairOutcomeHasRuntimeShape(value)
      : researchMemoryControlStudyOutcomeHasRuntimeShape(value);
    expect(valid).toBe(false);
  });
});

function studyFixture(): ResearchMemoryControlStudyRecord {
  const studyId = "research-memory-control-study-aaaaaaaaaaaaaaaaaaaa";
  return {
    record_kind: "research_memory_control_study",
    version: 1,
    research_memory_control_study_id: studyId,
    idempotency_key: "memory-control-domain-fixture",
    hypothesis: "released_memory_reduces_exact_behavior_repeats",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: digest("1"),
      regular_file_count: 10,
      total_bytes: 1_000,
      exclusion_policy: "research_experiment_evidence_only"
    },
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "source-candidate"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "source-version"
      },
      system_code_ref: { record_kind: "system_code", id: "source-code" },
      system_code_artifact_digest: digest("2"),
      system_code_record_digest: digest("3"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("4")
    },
    research_agent: {
      provider: "codex",
      model: "gpt-5.4",
      permission_policy: "artifact_workspace_only",
      identity_digest: digest("5")
    },
    research_agent_profile_id: "managed-agent-codex-trading-research",
    opportunity_protocol: {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("a"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("b"),
      sealed_suite_digest: digest("c")
    },
    pair_plans: Array.from({ length: 6 }, (_, index) => ({
      pair_index: index + 1,
      research_direction_ref: {
        record_kind: "research_direction",
        id: `research-direction-${index + 1}`
      },
      direction_kind: index % 2 === 0
        ? "trend_following" as const
        : "mean_reversion" as const,
      released_memory_treatment: {
        arm_kind: "released_memory_treatment" as const,
        memory_mode: "released_memory" as const,
        tick_id: `memory-study-tick-${index + 1}-released`
      },
      memory_masked_control: {
        arm_kind: "memory_masked_control" as const,
        memory_mode: "memory_masked" as const,
        tick_id: `memory-study-tick-${index + 1}-masked`
      }
    })),
    policy: {
      policy_version: "research_memory_control_study_v1",
      pair_count: 6,
      allocation_mode: "explicit",
      development_submission_limit_per_worker: 1,
      sealed_submission_limit_per_worker: 1,
      baseline_copy_policy: "fresh_verified_copy_per_arm",
      within_pair_start_policy: "concurrent_initial_sides",
      maximum_within_pair_start_skew_ms: 5_000,
      across_pair_execution_policy: "sequential",
      maximum_baseline_regular_file_count: 10_000,
      maximum_baseline_total_bytes: 1_000_000_000
    },
    analysis_policy: {
      policy_version: "paired_exact_repeat_sign_test_v1",
      primary_estimand:
        "mean_masked_minus_released_memory_exact_repeat_indicator",
      significance_method: "two_sided_exact_sign_test",
      alpha: 0.05,
      minimum_non_tied_pair_count: 6,
      tie_policy: "exclude_from_sign_test_include_in_mean",
      ineligible_pair_policy: "retain_in_counts_exclude_from_inference",
      minimum_mean_paired_difference: 0
    },
    committed_at: "2026-07-13T05:00:00.000Z",
    study_digest: digest("6"),
    research_scheduling_authority: true,
    evaluation_authority: false,
    memory_policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function pairFixture(pairIndex: number): ResearchMemoryControlPairOutcomeRecord {
  const study = studyFixture();
  const pair = study.pair_plans[pairIndex - 1]!;
  return {
    record_kind: "research_memory_control_pair_outcome",
    version: 1,
    research_memory_control_pair_outcome_id:
      `research-memory-control-pair-outcome-${String(pairIndex).padStart(20, "a")}`,
    study_ref: {
      record_kind: "research_memory_control_study",
      id: study.research_memory_control_study_id
    },
    study_digest: study.study_digest,
    pair_index: pairIndex,
    pair_plan_digest: digest("7"),
    research_direction_ref: { ...pair.research_direction_ref },
    direction_kind: pair.direction_kind,
    released_memory: armResult(
      study,
      pairIndex,
      "released_memory_treatment",
      0
    ),
    memory_masked: armResult(
      study,
      pairIndex,
      "memory_masked_control",
      1
    ),
    eligibility_status: "eligible",
    ineligibility_reason: null,
    initial_start_skew_ms: 0,
    paired_difference: 1,
    terminal_at: "2026-07-13T05:01:00.000Z",
    pair_outcome_digest: digest("8"),
    evaluation_authority: "external_to_trading_systems",
    memory_policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function armResult(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: "released_memory_treatment" | "memory_masked_control",
  indicator: 0 | 1
) {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  return {
    arm_kind: armKind,
    memory_mode: plan.memory_mode,
    planned_tick_id: plan.tick_id,
    terminal_status: "completed" as const,
    failure_kind: null,
    tick_evidence: {
      tick_ref: {
        record_kind: "candidate_arena_tick",
        id: `${plan.tick_id}-record`
      },
      tick_id: plan.tick_id,
      tick_digest: digest("a"),
      started_at: "2026-07-13T05:00:30.000Z",
      completed_at: "2026-07-13T05:00:50.000Z",
      tick_status: "completed" as const,
      direction_result_status: indicator ? "duplicate" as const : "created" as const
    },
    preflight_evidence: {
      commitment_ref: {
        record_kind: "research_preflight_commitment",
        id: `${plan.tick_id}-preflight`
      },
      commitment_digest: digest("b"),
      development_suite_version: "research_development_replay_v1" as const,
      development_suite_digest: digest("1"),
      sealed_suite_version: "research_sealed_admission_v1" as const,
      sealed_generator_version: "research_scenario_generator_v1" as const,
      sealed_suite_digest: digest("2"),
      sealed_rotation_commitment_digest: digest("3"),
      memory_policy: {
        protocol_version: "research_worker_memory_v1" as const,
        memory_mode: plan.memory_mode,
        memory_source_digest: digest("c"),
        available_memory_item_count: 3,
        arena_context_digest: armKind === "released_memory_treatment"
          ? digest("d")
          : digest("e"),
        prior_checkpoint: { disposition: "none_available" as const },
        control_assignment: {
          study_ref: {
            record_kind: "research_memory_control_study",
            id: study.research_memory_control_study_id
          },
          study_digest: study.study_digest,
          pair_index: pairIndex,
          arm_kind: armKind
        }
      }
    },
    worker_evidence: {
      worker_ref: {
        record_kind: "research_worker",
        id: `research-worker-${pair.direction_kind}`
      },
      agent_profile_id: study.research_agent_profile_id,
      provider_kind: "codex_cli" as const,
      model: "gpt-5.4"
    },
    allocation_evidence: {
      allocation_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: `${plan.tick_id}-allocation`
      },
      allocation_digest: digest("4"),
      allocation_mode: "explicit" as const,
      allocation_policy_digest: digest("5"),
      direction_kind: pair.direction_kind,
      selection_kind: "explicit" as const,
      experiment_budget: 1 as const
    },
    admission_evidence: {
      decision_ref: {
        record_kind: "candidate_admission_decision",
        id: `${plan.tick_id}-admission`
      },
      decision_digest: digest("f"),
      status: indicator ? "duplicate" as const : "admitted" as const,
      reason: indicator ? "no_candidate_change" as const :
        "evaluation_accepted" as const,
      research_worker_outcome: indicator ? "unchanged" as const : "changed" as const,
      behavior_comparison_status: indicator ? null : "distinct" as const,
      fingerprint_ref: indicator ? null : {
        record_kind: "research_behavior_fingerprint",
        id: `${plan.tick_id}-fingerprint`
      },
      fingerprint_digest: indicator ? null : digest("0"),
      matching_fingerprint_ref: null,
      matching_fingerprint_digest: null
    },
    resource_summary: {
      provider_request_total: 1,
      runner_command_total: 2,
      scenario_count: 3,
      elapsed_ms: 4
    },
    observation: indicator ? "exact_repeat" as const :
      "distinct_behavior" as const,
    exact_repeat_indicator: indicator,
    ineligibility_reason: null
  };
}

function outcomeFixture(): ResearchMemoryControlStudyOutcomeRecord {
  const study = studyFixture();
  return {
    record_kind: "research_memory_control_study_outcome",
    version: 1,
    research_memory_control_study_outcome_id:
      "research-memory-control-study-outcome-aaaaaaaaaaaaaaaaaaaa",
    study_ref: {
      record_kind: "research_memory_control_study",
      id: study.research_memory_control_study_id
    },
    study_digest: study.study_digest,
    pair_results: Array.from({ length: 6 }, (_, index) => ({
      pair_index: index + 1,
      pair_outcome_ref: {
        record_kind: "research_memory_control_pair_outcome",
        id: `pair-outcome-${index + 1}`
      },
      pair_outcome_digest: digest("8"),
      eligibility_status: "eligible" as const,
      ineligibility_reason: null,
      paired_difference: 1 as const
    })),
    planned_pair_count: 6,
    completed_pair_count: 6,
    eligible_pair_count: 6,
    ineligible_pair_count: 0,
    favorable_pair_count: 6,
    unfavorable_pair_count: 0,
    tied_pair_count: 0,
    non_tied_pair_count: 6,
    mean_paired_difference: 1,
    exact_sign_test_p_value: 0.03125,
    inference_status: "memory_effect_supported",
    causal_scope: "same_baseline_paired_exact_repeat_effect_only",
    memory_policy_decision_eligibility: "not_eligible",
    next_action: "review_memory_evidence_without_automatic_policy_change",
    adjudicated_at: "2026-07-13T06:00:00.000Z",
    study_outcome_digest: digest("9"),
    evaluation_authority: "external_to_trading_systems",
    memory_policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
