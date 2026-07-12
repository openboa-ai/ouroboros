import { describe, expect, it } from "vitest";
import {
  researchPopulationDiversityHasRuntimeShape,
  type ResearchPopulationDiversityReadModel
} from "./index";

describe("ResearchPopulationDiversity", () => {
  it("accepts measured assigned-direction and same-suite behavior distributions", () => {
    expect(researchPopulationDiversityHasRuntimeShape(measuredFixture())).toBe(true);
  });

  it("accepts an empty completed-tick window as insufficient evidence", () => {
    const readModel = measuredFixture();
    readModel.window_tick_count = 0;
    readModel.assigned_directions = {
      measurement_status: "insufficient_evidence",
      sample_count: 0,
      unique_count: 0,
      entropy_bits: 0,
      normalized_entropy: 0
    };
    readModel.observed_behaviors = {
      measurement_status: "insufficient_evidence",
      sample_count: 0,
      unique_count: 0,
      entropy_bits: 0,
      normalized_entropy: 0,
      cohort_count: 0,
      admitted_submission_count: 0,
      exact_behavior_duplicate_count: 0,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 0
    };
    readModel.by_direction = [];
    readModel.tick_series = [];

    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(true);
  });

  it("accepts incomparable behavior cohorts only without synthetic diversity", () => {
    const readModel = measuredFixture();
    readModel.observed_behaviors = {
      measurement_status: "incomparable_suites",
      sample_count: 2,
      cohort_count: 2,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 1,
      unavailable_fingerprint_count: 1
    };
    for (const row of readModel.by_direction) {
      delete row.unique_behavior_count;
    }

    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(true);

    readModel.by_direction[0]!.unique_behavior_count = 1;
    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(false);
  });

  it("accepts a tick-local incomparable cohort without synthetic metrics", () => {
    const readModel = measuredFixture();
    readModel.observed_behaviors = {
      measurement_status: "incomparable_suites",
      sample_count: 2,
      cohort_count: 2,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 1,
      unavailable_fingerprint_count: 1
    };
    for (const row of readModel.by_direction) {
      delete row.unique_behavior_count;
    }
    readModel.tick_series[0]!.observed_behaviors = {
      measurement_status: "incomparable_suites",
      sample_count: 1,
      cohort_count: 2,
      admitted_submission_count: 0,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 1
    } as any;

    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(false);

    readModel.tick_series[0]!.observed_behaviors = {
      measurement_status: "incomparable_suites",
      sample_count: 2,
      cohort_count: 2,
      admitted_submission_count: 0,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 1
    };
    readModel.tick_series[1]!.observed_behaviors = {
      measurement_status: "insufficient_evidence",
      sample_count: 0,
      unique_count: 0,
      entropy_bits: 0,
      normalized_entropy: 0,
      cohort_count: 0,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 0,
      artifact_duplicate_count: 1,
      unavailable_fingerprint_count: 0
    };
    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(true);
  });

  it.each([
    ["extra top-level identity", (value: any) => { value.fingerprint_digest = "sha256:raw"; }],
    ["extra observed identity", (value: any) => {
      value.observed_behaviors.development_suite_digest = "sha256:raw";
    }],
    ["missing tick series", (value: any) => { delete value.tick_series; }],
    ["extra tick identity", (value: any) => {
      value.tick_series[0].fingerprint_digest = "sha256:raw";
    }],
    ["tick series length mismatch", (value: any) => { value.tick_series.pop(); }],
    ["duplicate tick id", (value: any) => {
      value.tick_series[1].tick_id = value.tick_series[0].tick_id;
    }],
    ["non-canonical tick order", (value: any) => { value.tick_series.reverse(); }],
    ["invalid tick completion time", (value: any) => {
      value.tick_series[0].completed_at = "2026-07-12 11:00:00";
    }],
    ["tick assigned incomparable", (value: any) => {
      value.tick_series[0].assigned_directions = {
        measurement_status: "incomparable_suites",
        sample_count: 2
      };
    }],
    ["tick synthetic incomparable entropy", (value: any) => {
      value.tick_series[0].observed_behaviors = {
        measurement_status: "incomparable_suites",
        sample_count: 2,
        unique_count: 1,
        entropy_bits: 0,
        normalized_entropy: 0,
        cohort_count: 2,
        admitted_submission_count: 0,
        exact_behavior_duplicate_count: 0,
        artifact_duplicate_count: 0,
        unavailable_fingerprint_count: 0
      };
    }],
    ["tick classification total above attempts", (value: any) => {
      value.tick_series[0].observed_behaviors.artifact_duplicate_count = 2;
    }],
    ["tick sample total mismatch", (value: any) => {
      value.tick_series[0].assigned_directions.sample_count = 3;
      value.tick_series[0].assigned_directions.unique_count = 2;
    }],
    ["tick evaluation authority", (value: any) => {
      value.tick_series[0].evaluation_authority = true;
    }],
    ["unknown protocol", (value: any) => {
      value.protocol_version = "research_population_diversity_v2";
    }],
    ["negative tick count", (value: any) => { value.window_tick_count = -1; }],
    ["oversized tick window", (value: any) => { value.window_tick_count = 11; }],
    ["negative sample count", (value: any) => {
      value.assigned_directions.sample_count = -1;
    }],
    ["non-finite entropy", (value: any) => {
      value.assigned_directions.entropy_bits = Number.NaN;
    }],
    ["normalized entropy below zero", (value: any) => {
      value.assigned_directions.normalized_entropy = -0.1;
    }],
    ["normalized entropy above one", (value: any) => {
      value.assigned_directions.normalized_entropy = 1.1;
    }],
    ["unique count above samples", (value: any) => {
      value.observed_behaviors.unique_count = 5;
    }],
    ["measured singleton", (value: any) => {
      value.assigned_directions = {
        measurement_status: "measured",
        sample_count: 1,
        unique_count: 1,
        entropy_bits: 0,
        normalized_entropy: 0
      };
      value.by_direction[0].attempt_count = 1;
      value.by_direction[1].attempt_count = 0;
    }],
    ["insufficient multi-sample distribution", (value: any) => {
      value.assigned_directions.measurement_status = "insufficient_evidence";
    }],
    ["assigned incomparable status", (value: any) => {
      value.assigned_directions = {
        measurement_status: "incomparable_suites",
        sample_count: 4
      };
    }],
    ["single cohort marked incomparable", (value: any) => {
      value.observed_behaviors = {
        measurement_status: "incomparable_suites",
        sample_count: 2,
        cohort_count: 1,
        admitted_submission_count: 2,
        exact_behavior_duplicate_count: 1,
        artifact_duplicate_count: 1,
        unavailable_fingerprint_count: 1
      };
    }],
    ["synthetic incomparable entropy", (value: any) => {
      value.observed_behaviors = {
        measurement_status: "incomparable_suites",
        sample_count: 2,
        unique_count: 3,
        entropy_bits: 1.5,
        normalized_entropy: 0.75,
        cohort_count: 2,
        admitted_submission_count: 2,
        exact_behavior_duplicate_count: 1,
        artifact_duplicate_count: 1,
        unavailable_fingerprint_count: 1
      };
    }],
    ["duplicate direction row", (value: any) => {
      value.by_direction[1].direction_kind = value.by_direction[0].direction_kind;
    }],
    ["non-canonical direction order", (value: any) => {
      value.by_direction.reverse();
    }],
    ["direction unique count above comparable count", (value: any) => {
      value.by_direction[0].unique_behavior_count = 3;
    }],
    ["assigned sample mismatch", (value: any) => {
      value.assigned_directions.sample_count = 5;
    }],
    ["behavior sample mismatch", (value: any) => {
      value.observed_behaviors.sample_count = 3;
    }],
    ["admitted count mismatch", (value: any) => {
      value.observed_behaviors.admitted_submission_count = 3;
    }],
    ["duplicate count mismatch", (value: any) => {
      value.observed_behaviors.exact_behavior_duplicate_count = 2;
    }],
    ["classification total above attempts", (value: any) => {
      value.observed_behaviors.artifact_duplicate_count = 2;
    }],
    ["evaluation authority", (value: any) => { value.evaluation_authority = true; }],
    ["promotion authority", (value: any) => { value.promotion_authority = true; }],
    ["wrong authority status", (value: any) => {
      value.authority_status = "not_live";
    }]
  ])("rejects %s", (_label, mutate) => {
    const readModel = measuredFixture() as any;
    mutate(readModel);

    expect(() => researchPopulationDiversityHasRuntimeShape(readModel)).not.toThrow();
    expect(researchPopulationDiversityHasRuntimeShape(readModel)).toBe(false);
  });
});

function measuredFixture(): ResearchPopulationDiversityReadModel {
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 2,
    assigned_directions: {
      measurement_status: "measured",
      sample_count: 4,
      unique_count: 2,
      entropy_bits: 1,
      normalized_entropy: 0.5
    },
    observed_behaviors: {
      measurement_status: "measured",
      sample_count: 2,
      unique_count: 2,
      entropy_bits: 1,
      normalized_entropy: 1,
      cohort_count: 1,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 1,
      unavailable_fingerprint_count: 1
    },
    by_direction: [
      {
        direction_kind: "trend_following",
        attempt_count: 2,
        observed_behavior_count: 1,
        unique_behavior_count: 1,
        admitted_submission_count: 0,
        exact_behavior_duplicate_count: 1
      },
      {
        direction_kind: "mean_reversion",
        attempt_count: 2,
        observed_behavior_count: 1,
        unique_behavior_count: 1,
        admitted_submission_count: 1,
        exact_behavior_duplicate_count: 0
      }
    ],
    tick_series: [
      {
        tick_id: "tick-2",
        completed_at: "2026-07-12T11:00:00.000Z",
        assigned_directions: {
          measurement_status: "measured",
          sample_count: 2,
          unique_count: 2,
          entropy_bits: 1,
          normalized_entropy: 1
        },
        observed_behaviors: {
          measurement_status: "insufficient_evidence",
          sample_count: 1,
          unique_count: 1,
          entropy_bits: 0,
          normalized_entropy: 0,
          cohort_count: 1,
          admitted_submission_count: 0,
          exact_behavior_duplicate_count: 1,
          artifact_duplicate_count: 0,
          unavailable_fingerprint_count: 1
        },
        evaluation_authority: false,
        promotion_authority: false,
        authority_status: "not_promotion_authority"
      },
      {
        tick_id: "tick-1",
        completed_at: "2026-07-12T10:00:00.000Z",
        assigned_directions: {
          measurement_status: "measured",
          sample_count: 2,
          unique_count: 2,
          entropy_bits: 1,
          normalized_entropy: 1
        },
        observed_behaviors: {
          measurement_status: "insufficient_evidence",
          sample_count: 1,
          unique_count: 1,
          entropy_bits: 0,
          normalized_entropy: 0,
          cohort_count: 1,
          admitted_submission_count: 1,
          exact_behavior_duplicate_count: 0,
          artifact_duplicate_count: 1,
          unavailable_fingerprint_count: 0
        },
        evaluation_authority: false,
        promotion_authority: false,
        authority_status: "not_promotion_authority"
      }
    ],
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}
