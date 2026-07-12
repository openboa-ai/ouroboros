import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  CandidateAdmissionDecisionRecord,
  CandidateArenaTickRecord,
  ResearchBehaviorFingerprintRecord,
  ResearchDirectionKind,
  ResearchDirectionRecord,
  ResearchPreflightCommitmentRecord
} from "@ouroboros/domain";
import {
  buildResearchPopulationDiversity,
  ResearchPopulationDiversityEvidenceError,
  type BuildResearchPopulationDiversityInput
} from "./research-population-diversity";

describe("buildResearchPopulationDiversity", () => {
  it("returns closed insufficient evidence for an empty window", () => {
    expect(buildResearchPopulationDiversity(emptyInput())).toEqual({
      protocol_version: "research_population_diversity_v1",
      window_tick_count: 0,
      assigned_directions: {
        measurement_status: "insufficient_evidence",
        sample_count: 0,
        unique_count: 0,
        entropy_bits: 0,
        normalized_entropy: 0
      },
      observed_behaviors: {
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
      },
      by_direction: [],
      tick_series: [],
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    });
  });

  it("computes exact known direction and same-suite behavior entropy", () => {
    const ticks = [
      tick("tick-2", "2026-07-12T10:02:00.000Z", ["mean_reversion", "trend_following"]),
      tick("tick-1", "2026-07-12T10:01:00.000Z", ["volatility_regime", "trend_following"])
    ];
    const commitments = [
      commitment("tick-2", "mean_reversion"),
      commitment("tick-2", "trend_following"),
      commitment("tick-1", "volatility_regime"),
      commitment("tick-1", "trend_following")
    ];
    const fingerprints = [
      fingerprint(commitments[0]!, "behavior-b"),
      fingerprint(commitments[1]!, "behavior-a"),
      fingerprint(commitments[2]!, "behavior-c"),
      fingerprint(commitments[3]!, "behavior-a")
    ];

    expect(buildResearchPopulationDiversity({
      ticks,
      directions: directions("trend_following", "mean_reversion", "volatility_regime"),
      commitments,
      fingerprints,
      admissions: []
    })).toEqual({
      protocol_version: "research_population_diversity_v1",
      window_tick_count: 2,
      assigned_directions: {
        measurement_status: "measured",
        sample_count: 4,
        unique_count: 3,
        entropy_bits: 1.5,
        normalized_entropy: 0.75
      },
      observed_behaviors: {
        measurement_status: "measured",
        sample_count: 4,
        unique_count: 3,
        entropy_bits: 1.5,
        normalized_entropy: 0.75,
        cohort_count: 1,
        admitted_submission_count: 0,
        exact_behavior_duplicate_count: 0,
        artifact_duplicate_count: 0,
        unavailable_fingerprint_count: 0
      },
      by_direction: [
        directionRow("trend_following", 2, 2, 1),
        directionRow("mean_reversion", 1, 1, 1),
        directionRow("volatility_regime", 1, 1, 1)
      ],
      tick_series: [
        tickDiversity("tick-2", "2026-07-12T10:02:00.000Z", 2, 2, 2, 2),
        tickDiversity("tick-1", "2026-07-12T10:01:00.000Z", 2, 2, 2, 2)
      ],
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    });
  });

  it("keeps an earlier diverse cross-section separate from latest behavior collapse", () => {
    const ticks = [
      tick(
        "tick-2",
        "2026-07-12T10:02:00.000Z",
        ["trend_following", "mean_reversion", "volatility_regime"]
      ),
      tick(
        "tick-1",
        "2026-07-12T10:01:00.000Z",
        ["trend_following", "mean_reversion", "volatility_regime"]
      )
    ];
    const commitments = ticks.flatMap((entry) => entry.direction_results.map((result) =>
      commitment(entry.tick_id, result.direction_kind)
    ));
    const result = buildResearchPopulationDiversity({
      ticks,
      directions: directions("trend_following", "mean_reversion", "volatility_regime"),
      commitments,
      fingerprints: [
        fingerprint(commitments[0]!, "behavior-a"),
        fingerprint(commitments[1]!, "behavior-a"),
        fingerprint(commitments[2]!, "behavior-a"),
        fingerprint(commitments[3]!, "behavior-a"),
        fingerprint(commitments[4]!, "behavior-b"),
        fingerprint(commitments[5]!, "behavior-c")
      ],
      admissions: []
    });

    expect(result.tick_series.map((entry) => ({
      tick_id: entry.tick_id,
      assigned_entropy: entry.assigned_directions.normalized_entropy,
      observed_unique: entry.observed_behaviors.unique_count,
      observed_entropy: entry.observed_behaviors.normalized_entropy
    }))).toEqual([
      {
        tick_id: "tick-2",
        assigned_entropy: 1,
        observed_unique: 1,
        observed_entropy: 0
      },
      {
        tick_id: "tick-1",
        assigned_entropy: 1,
        observed_unique: 3,
        observed_entropy: 1
      }
    ]);
    expect(result.observed_behaviors).toMatchObject({
      measurement_status: "measured",
      sample_count: 6,
      unique_count: 3
    });
  });

  it("keeps single-cohort ticks measurable across a window suite transition", () => {
    const ticks = [
      tick("tick-2", "2026-07-12T10:02:00.000Z", ["trend_following", "mean_reversion"]),
      tick("tick-1", "2026-07-12T10:01:00.000Z", ["trend_following", "mean_reversion"])
    ];
    const commitments = [
      commitment("tick-2", "trend_following", digest("suite-b")),
      commitment("tick-2", "mean_reversion", digest("suite-b")),
      commitment("tick-1", "trend_following", digest("suite-a")),
      commitment("tick-1", "mean_reversion", digest("suite-a"))
    ];
    const result = buildResearchPopulationDiversity({
      ticks,
      directions: directions("trend_following", "mean_reversion"),
      commitments,
      fingerprints: [
        fingerprint(commitments[0]!, "behavior-a"),
        fingerprint(commitments[1]!, "behavior-b"),
        fingerprint(commitments[2]!, "behavior-a"),
        fingerprint(commitments[3]!, "behavior-b")
      ],
      admissions: []
    });

    expect(result.observed_behaviors).toEqual({
      measurement_status: "incomparable_suites",
      sample_count: 4,
      cohort_count: 2,
      admitted_submission_count: 0,
      exact_behavior_duplicate_count: 0,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 0
    });
    expect(result.tick_series.map((entry) => entry.observed_behaviors)).toEqual([
      measuredDistributionWithCounts(2, 2, 1, 1),
      measuredDistributionWithCounts(2, 2, 1, 1)
    ]);
  });

  it("keeps assigned labels and observed behavior as orthogonal distributions", () => {
    const sameDirectionTicks = [
      tick("tick-2", "2026-07-12T10:02:00.000Z", ["trend_following"]),
      tick("tick-1", "2026-07-12T10:01:00.000Z", ["trend_following"])
    ];
    const sameDirectionCommitments = sameDirectionTicks.map((entry) =>
      commitment(entry.tick_id, "trend_following")
    );
    const differentBehavior = buildResearchPopulationDiversity({
      ticks: sameDirectionTicks,
      directions: directions("trend_following"),
      commitments: sameDirectionCommitments,
      fingerprints: [
        fingerprint(sameDirectionCommitments[0]!, "behavior-a"),
        fingerprint(sameDirectionCommitments[1]!, "behavior-b")
      ],
      admissions: []
    });
    expect(differentBehavior.assigned_directions).toMatchObject({
      unique_count: 1,
      entropy_bits: 0,
      normalized_entropy: 0
    });
    expect(differentBehavior.observed_behaviors).toMatchObject({
      unique_count: 2,
      entropy_bits: 1,
      normalized_entropy: 1
    });

    const differentDirectionTick = tick(
      "tick-3",
      "2026-07-12T10:03:00.000Z",
      ["trend_following", "mean_reversion"]
    );
    const differentDirectionCommitments = [
      commitment("tick-3", "trend_following"),
      commitment("tick-3", "mean_reversion")
    ];
    const sameBehavior = buildResearchPopulationDiversity({
      ticks: [differentDirectionTick],
      directions: directions("trend_following", "mean_reversion"),
      commitments: differentDirectionCommitments,
      fingerprints: differentDirectionCommitments.map((entry) =>
        fingerprint(entry, "behavior-a")
      ),
      admissions: []
    });
    expect(sameBehavior.assigned_directions).toMatchObject({
      unique_count: 2,
      entropy_bits: 1,
      normalized_entropy: 1
    });
    expect(sameBehavior.observed_behaviors).toMatchObject({
      unique_count: 1,
      entropy_bits: 0,
      normalized_entropy: 0
    });
  });

  it("rounds non-uniform Shannon entropy and normalization to six places", () => {
    const result = buildResearchPopulationDiversity({
      ...emptyInput(),
      ticks: [
        tick("tick-2", "2026-07-12T10:02:00.000Z", ["trend_following"]),
        tick(
          "tick-1",
          "2026-07-12T10:01:00.000Z",
          ["trend_following", "mean_reversion"]
        )
      ]
    });

    expect(result.assigned_directions).toEqual({
      measurement_status: "measured",
      sample_count: 3,
      unique_count: 2,
      entropy_bits: 0.918296,
      normalized_entropy: 0.57938
    });
  });

  it("counts admission outcomes separately without fabricating missing behavior", () => {
    const arenaTick = tick("tick-1", "2026-07-12T10:01:00.000Z", [
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk"
    ]);
    const commitments = [
      commitment("tick-1", "trend_following"),
      commitment("tick-1", "mean_reversion"),
      commitment("tick-1", "volatility_regime"),
      commitment("tick-1", "funding_aware_risk")
    ];
    const fingerprints = [
      fingerprint(commitments[0]!, "behavior-a"),
      fingerprint(commitments[1]!, "behavior-a")
    ];
    const result = buildResearchPopulationDiversity({
      ticks: [arenaTick],
      directions: directions(
        "trend_following",
        "mean_reversion",
        "volatility_regime",
        "funding_aware_risk"
      ),
      commitments,
      fingerprints,
      admissions: [
        admission(commitments[0]!, "admitted"),
        admission(commitments[1]!, "behavior_duplicate"),
        admission(commitments[2]!, "artifact_duplicate"),
        admission(commitments[3]!, "fingerprint_unavailable")
      ]
    });

    expect(result.observed_behaviors).toEqual({
      measurement_status: "measured",
      sample_count: 2,
      unique_count: 1,
      entropy_bits: 0,
      normalized_entropy: 0,
      cohort_count: 1,
      admitted_submission_count: 1,
      exact_behavior_duplicate_count: 1,
      artifact_duplicate_count: 1,
      unavailable_fingerprint_count: 1
    });
    expect(result.by_direction).toEqual([
      directionRow("trend_following", 1, 1, 1, 1, 0),
      directionRow("mean_reversion", 1, 1, 1, 0, 1),
      directionRow("volatility_regime", 1, 0, 0),
      directionRow("funding_aware_risk", 1, 0, 0)
    ]);
    expect(result.tick_series[0]).toEqual({
      tick_id: "tick-1",
      completed_at: "2026-07-12T10:01:00.000Z",
      assigned_directions: {
        measurement_status: "measured",
        sample_count: 4,
        unique_count: 4,
        entropy_bits: 2,
        normalized_entropy: 1
      },
      observed_behaviors: result.observed_behaviors,
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    });
  });

  it("fails closed across protocol or development-suite cohorts", () => {
    const arenaTick = tick(
      "tick-1",
      "2026-07-12T10:01:00.000Z",
      ["trend_following", "mean_reversion"]
    );
    const commitments = [
      commitment("tick-1", "trend_following", digest("suite-a")),
      commitment("tick-1", "mean_reversion", digest("suite-b"))
    ];
    const result = buildResearchPopulationDiversity({
      ticks: [arenaTick],
      directions: directions("trend_following", "mean_reversion"),
      commitments,
      fingerprints: commitments.map((entry) => fingerprint(entry, "behavior-a")),
      admissions: []
    });

    expect(result.observed_behaviors).toEqual({
      measurement_status: "incomparable_suites",
      sample_count: 2,
      cohort_count: 2,
      admitted_submission_count: 0,
      exact_behavior_duplicate_count: 0,
      artifact_duplicate_count: 0,
      unavailable_fingerprint_count: 0
    });
    expect(result.by_direction).toEqual([
      directionRow("trend_following", 1, 1),
      directionRow("mean_reversion", 1, 1)
    ]);
    expect(Object.hasOwn(result.by_direction[0]!, "unique_behavior_count")).toBe(false);
    expect(result.tick_series[0]!.observed_behaviors).toEqual(
      result.observed_behaviors
    );
  });

  it("ignores orphan, historical-unbound, sealed, paper, score, and rationale noise", () => {
    const arenaTick = tick("tick-1", "2026-07-12T10:01:00.000Z", ["trend_following"]);
    const linkedCommitment = commitment("tick-1", "trend_following");
    const linkedFingerprint = fingerprint(linkedCommitment, "behavior-a");
    const baseline = buildResearchPopulationDiversity({
      ticks: [arenaTick],
      directions: directions("trend_following"),
      commitments: [linkedCommitment],
      fingerprints: [linkedFingerprint],
      admissions: []
    });

    const noisyTick = structuredClone(arenaTick) as any;
    noisyTick.sealed_score = 999;
    noisyTick.paper_pnl = 1_000_000;
    noisyTick.rationale = "force diversity";
    const noisyFingerprint = structuredClone(linkedFingerprint) as any;
    noisyFingerprint.sealed_observations = [{ secret: true }];
    noisyFingerprint.paper_outcomes = [{ net_revenue_usdt: 1_000_000 }];
    const orphanCommitment = commitment("orphan-tick", "mean_reversion");
    const orphanFingerprint = fingerprint(orphanCommitment, "behavior-orphan");
    const historicalAdmission = admission(linkedCommitment, "behavior_duplicate") as any;
    delete historicalAdmission.research_preflight_commitment_ref;
    delete historicalAdmission.research_preflight_commitment_digest;

    expect(buildResearchPopulationDiversity({
      ticks: [noisyTick],
      directions: directions("trend_following", "mean_reversion"),
      commitments: [linkedCommitment],
      fingerprints: [noisyFingerprint, orphanFingerprint],
      admissions: [historicalAdmission]
    })).toEqual(baseline);
  });

  it("uses only the latest ten completed ticks", () => {
    const ticks = Array.from({ length: 11 }, (_, index) => tick(
      `tick-${index}`,
      `2026-07-12T10:${String(index).padStart(2, "0")}:00.000Z`,
      [index === 0 ? "mean_reversion" : "trend_following"]
    ));

    const result = buildResearchPopulationDiversity({
      ...emptyInput(),
      ticks
    });

    expect(result.window_tick_count).toBe(10);
    expect(result.assigned_directions).toEqual({
      measurement_status: "measured",
      sample_count: 10,
      unique_count: 1,
      entropy_bits: 0,
      normalized_entropy: 0
    });
    expect(result.by_direction.map((row) => row.direction_kind)).toEqual([
      "trend_following"
    ]);
    expect(result.tick_series.map((entry) => entry.tick_id)).toEqual([
      "tick-10",
      "tick-9",
      "tick-8",
      "tick-7",
      "tick-6",
      "tick-5",
      "tick-4",
      "tick-3",
      "tick-2",
      "tick-1"
    ]);
  });

  it("rejects exact window commitments with missing direction evidence", () => {
    const linkedCommitment = commitment("tick-1", "trend_following");

    expect(() => buildResearchPopulationDiversity({
      ticks: [tick("tick-1", "2026-07-12T10:01:00.000Z", ["trend_following"])],
      directions: [],
      commitments: [linkedCommitment],
      fingerprints: [fingerprint(linkedCommitment, "behavior-a")],
      admissions: []
    })).toThrowError(ResearchPopulationDiversityEvidenceError);
    try {
      buildResearchPopulationDiversity({
        ticks: [tick("tick-1", "2026-07-12T10:01:00.000Z", ["trend_following"])],
        directions: [],
        commitments: [linkedCommitment],
        fingerprints: [],
        admissions: []
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "invalid_research_population_diversity_evidence",
        reason: "missing_research_direction"
      });
    }
  });
});

function emptyInput(): BuildResearchPopulationDiversityInput {
  return {
    ticks: [],
    directions: [],
    commitments: [],
    fingerprints: [],
    admissions: []
  };
}

function tick(
  tickId: string,
  completedAt: string,
  directionKinds: ResearchDirectionKind[]
): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-${tickId}`,
    tick_id: tickId,
    started_at: new Date(Date.parse(completedAt) - 1_000).toISOString(),
    completed_at: completedAt,
    status: "completed",
    created_candidate_refs: [],
    direction_results: directionKinds.map((direction_kind) => ({
      direction_kind,
      status: "created"
    })),
    authority_status: "not_live"
  };
}

function directions(...directionKinds: ResearchDirectionKind[]): ResearchDirectionRecord[] {
  return directionKinds.map((direction_kind) => ({
    record_kind: "research_direction",
    version: 1,
    research_direction_id: `direction-${direction_kind}`,
    direction_kind,
    market_scope: "external_trading_api_fixture",
    prompt_seed: `Explore ${direction_kind}`,
    created_at: "2026-07-12T10:00:00.000Z",
    authority_status: "research_seed_only"
  }));
}

function commitment(
  tickId: string,
  directionKind: ResearchDirectionKind,
  suiteDigest = digest("suite-a")
): ResearchPreflightCommitmentRecord {
  const id = `commitment-${tickId}-${directionKind}`;
  return {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id: id,
    candidate_arena_tick_id: tickId,
    research_direction_ref: {
      record_kind: "research_direction",
      id: `direction-${directionKind}`
    },
    research_worker_ref: {
      record_kind: "research_worker",
      id: `worker-${directionKind}`
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: `allocation-${tickId}`
    },
    research_allocation_digest: digest(`allocation-${tickId}`),
    source_system_code_ref: { record_kind: "system_code", id: `source-${tickId}` },
    source_artifact_digest: digest(`source-${tickId}`),
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: suiteDigest,
      submission_limit: 2,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest(`rotation-${tickId}`),
      suite_digest: digest(`sealed-${tickId}`),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-12T10:00:00.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest(id)
  };
}

function fingerprint(
  linkedCommitment: ResearchPreflightCommitmentRecord,
  behavior: string
): ResearchBehaviorFingerprintRecord {
  return {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id:
      `fingerprint-${linkedCommitment.research_preflight_commitment_id}-${behavior}`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: linkedCommitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: linkedCommitment.commitment_digest,
    system_code_ref: {
      record_kind: "system_code",
      id: `system-${linkedCommitment.research_preflight_commitment_id}`
    },
    system_code_artifact_digest: digest(`system-${linkedCommitment.research_preflight_commitment_id}`),
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: linkedCommitment.development_policy.suite_version,
    development_suite_digest: linkedCommitment.development_policy.suite_digest,
    observations: [{
      scenario_id: "development-scenario",
      decision: {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 0,
        order_type: "none"
      }
    }],
    observation_count: 1,
    fingerprint_digest: digest(behavior),
    created_at: "2026-07-12T10:00:01.000Z",
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function admission(
  linkedCommitment: ResearchPreflightCommitmentRecord,
  classification: "admitted" | "behavior_duplicate" | "artifact_duplicate" |
    "fingerprint_unavailable"
): CandidateAdmissionDecisionRecord {
  const artifactDuplicate = classification === "artifact_duplicate";
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id:
      `admission-${linkedCommitment.research_preflight_commitment_id}`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: linkedCommitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: linkedCommitment.commitment_digest,
    source_system_code_ref: { record_kind: "system_code", id: "source" },
    system_code_ref: { record_kind: "system_code", id: "submitted" },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation"
    },
    research_finding_ref: { record_kind: "research_finding", id: "finding" },
    source_artifact_digest: digest("source"),
    submitted_artifact_digest: artifactDuplicate ? digest("source") : digest("submitted"),
    research_worker_outcome: artifactDuplicate ? "unchanged" : "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    ...(classification === "behavior_duplicate"
      ? { behavior_comparison_status: "duplicate" as const }
      : classification === "fingerprint_unavailable"
        ? { behavior_comparison_status: "unavailable" as const }
        : classification === "admitted"
          ? { behavior_comparison_status: "distinct" as const }
          : {}),
    status: classification === "admitted"
      ? "admitted"
      : classification === "artifact_duplicate" || classification === "behavior_duplicate"
        ? "duplicate"
        : "quarantined",
    reason: classification === "admitted"
      ? "evaluation_accepted"
      : classification === "artifact_duplicate"
        ? "no_candidate_change"
        : classification === "behavior_duplicate"
          ? "behavior_duplicate"
          : "behavior_fingerprint_unavailable",
    runnable_paper_handoff: classification === "admitted",
    decided_at: "2026-07-12T10:00:02.000Z",
    authority_status: "not_live"
  };
}

function directionRow(
  direction_kind: ResearchDirectionKind,
  attempt_count: number,
  observed_behavior_count: number,
  unique_behavior_count?: number,
  admitted_submission_count = 0,
  exact_behavior_duplicate_count = 0
) {
  return {
    direction_kind,
    attempt_count,
    observed_behavior_count,
    ...(unique_behavior_count === undefined ? {} : { unique_behavior_count }),
    admitted_submission_count,
    exact_behavior_duplicate_count
  };
}

function tickDiversity(
  tick_id: string,
  completed_at: string,
  assignedSampleCount: number,
  assignedUniqueCount: number,
  behaviorSampleCount: number,
  behaviorUniqueCount: number
) {
  return {
    tick_id,
    completed_at,
    assigned_directions: distribution(
      assignedSampleCount,
      assignedUniqueCount,
      assignedUniqueCount === assignedSampleCount ? 1 : 0
    ),
    observed_behaviors: measuredDistributionWithCounts(
      behaviorSampleCount,
      behaviorUniqueCount,
      behaviorUniqueCount === behaviorSampleCount ? 1 : 0,
      behaviorUniqueCount === behaviorSampleCount ? 1 : 0
    ),
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function distribution(
  sample_count: number,
  unique_count: number,
  normalized_entropy: number
) {
  return {
    measurement_status: "measured" as const,
    sample_count,
    unique_count,
    entropy_bits: normalized_entropy === 1 ? Math.log2(sample_count) : 0,
    normalized_entropy
  };
}

function measuredDistributionWithCounts(
  sample_count: number,
  unique_count: number,
  entropy_bits: number,
  normalized_entropy: number
) {
  return {
    measurement_status: "measured" as const,
    sample_count,
    unique_count,
    entropy_bits,
    normalized_entropy,
    cohort_count: 1,
    admitted_submission_count: 0,
    exact_behavior_duplicate_count: 0,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
