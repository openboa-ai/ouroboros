import { describe, expect, it } from "vitest";
import {
  researchMemoryControlStudyHasRuntimeShape,
  type ResearchExperimentBaselineSnapshot,
  type ResearchExperimentSource
} from "@ouroboros/domain";
import type { ManagedResearchAgent } from "../trading/research/types";
import {
  ResearchMemoryControlStudyDecisionError,
  decideResearchMemoryControlStudy,
  researchMemoryControlStudyId
} from "./research-memory-control-study";

describe("ResearchMemoryControlStudy decision", () => {
  it("precommits six canonical fresh-baseline memory pairs", () => {
    const study = decideResearchMemoryControlStudy(studyInput());

    expect(researchMemoryControlStudyHasRuntimeShape(study)).toBe(true);
    expect(study.research_memory_control_study_id).toBe(
      researchMemoryControlStudyId("memory-control-study-001")
    );
    expect(study.pair_plans).toHaveLength(6);
    expect(study.pair_plans.map((pair) => pair.pair_index)).toEqual([
      1, 2, 3, 4, 5, 6
    ]);
    expect(new Set(study.pair_plans.flatMap((pair) => [
      pair.released_memory_treatment.tick_id,
      pair.memory_masked_control.tick_id
    ])).size).toBe(12);
    expect(study.pair_plans.every((pair) =>
      pair.released_memory_treatment.memory_mode === "released_memory" &&
      pair.released_memory_treatment.arm_kind ===
        "released_memory_treatment" &&
      pair.memory_masked_control.memory_mode === "memory_masked" &&
      pair.memory_masked_control.arm_kind === "memory_masked_control"
    )).toBe(true);
    expect(new Set(study.pair_plans.map((pair) => pair.direction_kind)).size)
      .toBe(2);
    expect(study.policy).toMatchObject({
      pair_count: 6,
      allocation_mode: "explicit",
      development_submission_limit_per_worker: 1,
      sealed_submission_limit_per_worker: 1,
      baseline_copy_policy: "fresh_verified_copy_per_arm",
      within_pair_start_policy: "concurrent_initial_sides",
      maximum_within_pair_start_skew_ms: 5_000,
      across_pair_execution_policy: "sequential"
    });
    expect(study.analysis_policy).toMatchObject({
      policy_version: "paired_exact_repeat_sign_test_v1",
      significance_method: "two_sided_exact_sign_test",
      alpha: 0.05,
      minimum_non_tied_pair_count: 6,
      minimum_mean_paired_difference: 0
    });
    expect(study.research_agent_profile_id).toBe("codex-research-agent");
    expect(study.opportunity_protocol).toEqual({
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("a"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("b"),
      sealed_suite_digest: digest("c")
    });
    expect(study).toMatchObject({
      research_scheduling_authority: true,
      evaluation_authority: false,
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    });
  });

  it("returns byte-equivalent commitments for exact replay", () => {
    expect(decideResearchMemoryControlStudy(studyInput())).toEqual(
      decideResearchMemoryControlStudy(studyInput())
    );
  });

  it.each([
    ["five pairs", (value: any) => { value.directions.length = 5; }],
    ["thirty-one pairs", (value: any) => {
      value.directions = Array.from({ length: 31 }, (_, index) => ({
        research_direction_id: `research-direction-${index + 1}`,
        direction_kind: index % 2 ? "mean_reversion" : "trend_following"
      }));
    }],
    ["one distinct direction", (value: any) => {
      value.directions = value.directions.map((direction: any) => ({
        ...direction,
        direction_kind: "trend_following"
      }));
    }],
    ["empty direction record", (value: any) => {
      value.directions[1].research_direction_id = "";
    }],
    ["legacy baseline policy", (value: any) => {
      value.baseline.exclusion_policy =
        "research_control_campaign_evidence_only";
    }],
    ["empty baseline", (value: any) => {
      value.baseline.regular_file_count = 0;
    }],
    ["baseline above file bound", (value: any) => {
      value.baseline.regular_file_count = 10_001;
    }],
    ["empty source", (value: any) => {
      value.source.candidate_ref.id = "";
    }],
    ["malformed source closure", (value: any) => {
      value.source.research_artifact_closure_digest = "sha256:short";
    }],
    ["missing agent profile", (value: any) => {
      value.researchAgent.id = "";
    }],
    ["missing exact model", (value: any) => {
      delete value.researchAgent.model;
    }],
    ["malformed opportunity protocol", (value: any) => {
      value.opportunityProtocol.development_suite_digest = "sha256:short";
    }],
    ["fixture permission widening", (value: any) => {
      value.researchAgent = {
        id: "fixture-agent",
        provider: "fixture",
        permission_policy: "artifact_workspace_only"
      };
    }],
    ["noncanonical time", (value: any) => {
      value.committedAt = "2026-07-13 05:00:00";
    }]
  ])("rejects %s before any pair effect", (_label, mutate) => {
    const input = studyInput() as any;
    mutate(input);
    expect(() => decideResearchMemoryControlStudy(input)).toThrow(
      ResearchMemoryControlStudyDecisionError
    );
  });
});

export function studyInput() {
  return {
    idempotencyKey: "memory-control-study-001",
    baseline: baselineFixture(),
    source: sourceFixture(),
    researchAgent: agentFixture(),
    opportunityProtocol: {
      development_suite_version: "research_development_replay_v1" as const,
      development_suite_digest: digest("a"),
      sealed_suite_version: "research_sealed_admission_v1" as const,
      sealed_generator_version: "research_scenario_generator_v1" as const,
      sealed_rotation_commitment_digest: digest("b"),
      sealed_suite_digest: digest("c")
    },
    directions: Array.from({ length: 6 }, (_, index) => ({
      research_direction_id: index % 2 === 0
        ? "research-direction-trend"
        : "research-direction-mean",
      direction_kind: index % 2 === 0
        ? "trend_following" as const
        : "mean_reversion" as const
    })),
    maximumBaselineRegularFileCount: 10_000,
    maximumBaselineTotalBytes: 1_000_000_000,
    committedAt: "2026-07-13T05:00:00.000Z"
  };
}

function baselineFixture(): ResearchExperimentBaselineSnapshot {
  return {
    protocol_version: "local_store_regular_files_v1",
    snapshot_digest: digest("1"),
    regular_file_count: 10,
    total_bytes: 1_000,
    exclusion_policy: "research_experiment_evidence_only"
  };
}

function sourceFixture(): ResearchExperimentSource {
  return {
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "source-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "source-candidate-version"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: "source-system-code"
    },
    system_code_artifact_digest: digest("2"),
    system_code_record_digest: digest("3"),
    research_artifact_protocol: "single_file_python_v1",
    research_artifact_closure_digest: digest("4")
  };
}

function agentFixture(): ManagedResearchAgent & { model: string } {
  return {
    id: "codex-research-agent",
    provider: "codex",
    model: "gpt-5.4",
    permission_policy: "artifact_workspace_only"
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
