import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchMemoryControlPairOutcomeHasRuntimeShape,
  researchMemoryControlStudyOutcomeHasRuntimeShape,
  researchPreflightCommitmentDigestInput,
  researchWorkerCheckpointDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type CandidateArenaResearchAllocationRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchMemoryControlArmKind,
  type ResearchMemoryControlPairIneligibilityReason,
  type ResearchMemoryControlPairOutcomeRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord
} from "@ouroboros/domain";
import {
  decideResearchMemoryControlStudy
} from "./research-memory-control-study";
import {
  ResearchMemoryControlPairOutcomeDecisionError,
  ResearchMemoryControlStudyOutcomeDecisionError,
  decideResearchMemoryControlPairOutcome,
  decideResearchMemoryControlStudyOutcome,
  researchMemoryControlPairOutcomeId,
  researchMemoryControlStudyOutcomeId,
  type ResearchMemoryControlArmEvidenceInput
} from "./research-memory-control-study-outcome";

describe("ResearchMemoryControlPairOutcome decision", () => {
  it("classifies external exact behavior evidence as +1, 0, or -1", () => {
    const study = studyFixture();
    const favorable = pairOutcome(study, 1, "distinct", "behavior_duplicate");
    const tied = pairOutcome(study, 2, "unchanged", "behavior_duplicate");
    const adverse = pairOutcome(study, 3, "unchanged", "distinct");

    expect(favorable.paired_difference).toBe(1);
    expect(tied.paired_difference).toBe(0);
    expect(adverse.paired_difference).toBe(-1);
    expect(favorable.research_memory_control_pair_outcome_id).toBe(
      researchMemoryControlPairOutcomeId(
        study.research_memory_control_study_id,
        1
      )
    );
    expect(researchMemoryControlPairOutcomeHasRuntimeShape(favorable)).toBe(
      true
    );
    expect(favorable.released_memory).toMatchObject({
      observation: "distinct_behavior",
      exact_repeat_indicator: 0,
      ineligibility_reason: null
    });
    expect(favorable.memory_masked).toMatchObject({
      observation: "exact_repeat",
      exact_repeat_indicator: 1,
      ineligibility_reason: null
    });
    expect(favorable).toMatchObject({
      eligibility_status: "eligible",
      ineligibility_reason: null,
      evaluation_authority: "external_to_trading_systems",
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
  });

  it.each([
    ["no_submission", "no_submission", "distinct"],
    ["worker_or_platform_failure", "worker_failed", "distinct"],
    ["behavior_fingerprint_unavailable", "fingerprint_unavailable", "distinct"],
    ["malformed_evidence_graph", "malformed", "distinct"],
    ["malformed_evidence_graph", "missing_resources", "distinct"],
    ["malformed_evidence_graph", "opportunity_mismatch", "distinct"],
    ["missing_memory_contrast", "distinct", "missing_contrast"],
    ["interrupted_or_unpaired_run", "interrupted", "distinct"]
  ] as const)("retains %s as terminal ineligible evidence", (
    expectedReason,
    releasedObservation,
    maskedObservation
  ) => {
    const study = studyFixture();
    const outcome = pairOutcome(
      study,
      1,
      releasedObservation,
      maskedObservation
    );

    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe(
      expectedReason satisfies ResearchMemoryControlPairIneligibilityReason
    );
    expect(outcome.paired_difference).toBeNull();
    expect(researchMemoryControlPairOutcomeHasRuntimeShape(outcome)).toBe(true);
  });

  it("rejects pair-index and planned-tick substitution", () => {
    const study = studyFixture();
    const pair = study.pair_plans[0]!;
    const released = armEvidence(study, pair.pair_index,
      "released_memory_treatment", "distinct");
    released.tick!.tick_id = "substituted-tick";

    expect(() => decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: released,
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    })).toThrow(ResearchMemoryControlPairOutcomeDecisionError);
  });

  it("retains agent-profile confounding and missing allocation as ineligible", () => {
    const study = studyFixture();
    const mutations: Array<(worker: ResearchWorkerRecord) => void> = [
      (worker) => { worker.model = "different-model"; },
      (worker) => { worker.provider_kind = "claude_code"; },
      (worker) => { worker.agent_profile_id = "different-profile"; }
    ];
    for (const mutate of mutations) {
      const masked = armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      );
      mutate(masked.researchWorker);
      const outcome = decideResearchMemoryControlPairOutcome({
        study,
        pairIndex: 1,
        releasedMemory: armEvidence(
          study,
          1,
          "released_memory_treatment",
          "distinct"
        ),
        memoryMasked: masked,
        terminalAt: "2026-07-13T05:01:00.000Z"
      });
      expect(outcome.eligibility_status).toBe("ineligible");
      expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
    }

    const withoutAllocation = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    delete (withoutAllocation as Partial<CompleteArmEvidence>).allocation;
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "distinct"
      ),
      memoryMasked: withoutAllocation,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("makes a pair ineligible when its arms use different workers", () => {
    const study = studyFixture();
    const masked = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    masked.researchWorker.research_worker_id = "different-research-worker";
    masked.preflight!.research_worker_ref.id = "different-research-worker";
    masked.preflight!.commitment_digest = sha256(
      researchPreflightCommitmentDigestInput(masked.preflight!)
    );
    masked.admission!.research_preflight_commitment_digest =
      masked.preflight!.commitment_digest;

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "distinct"
      ),
      memoryMasked: masked,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("retains tick-to-allocation linkage drift as malformed evidence", () => {
    const study = studyFixture();
    const masked = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    masked.tick!.research_allocation_digest = digest("9");

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "distinct"
      ),
      memoryMasked: masked,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("retains inconsistent admission linkage as malformed evidence", () => {
    const study = studyFixture();
    const masked = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    masked.admission!.reason = "behavior_duplicate";

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "distinct"
      ),
      memoryMasked: masked,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("rejects sequential pair starts outside the concurrent-start bound", () => {
    const study = studyFixture();
    const masked = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    masked.tick!.started_at = "2026-07-13T05:00:40.000Z";
    masked.tick!.completed_at = "2026-07-13T05:00:55.000Z";

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "distinct"
      ),
      memoryMasked: masked,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("requires every pair to use the study-precommitted opportunity protocol", () => {
    const study = studyFixture();
    const released = armEvidence(
      study,
      1,
      "released_memory_treatment",
      "unchanged"
    );
    const masked = armEvidence(
      study,
      1,
      "memory_masked_control",
      "unchanged"
    );
    for (const evidence of [released, masked]) {
      evidence.preflight!.development_policy.suite_digest = digest("9");
      evidence.preflight!.commitment_digest = sha256(
        researchPreflightCommitmentDigestInput(evidence.preflight!)
      );
      evidence.admission!.research_preflight_commitment_digest =
        evidence.preflight!.commitment_digest;
    }

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: released,
      memoryMasked: masked,
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("retains completed admission failure as coherent worker failure", () => {
    const study = studyFixture();
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: armEvidence(
        study,
        1,
        "released_memory_treatment",
        "admission_failed"
      ),
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });

    expect(outcome.ineligibility_reason).toBe("worker_or_platform_failure");
    expect(outcome.released_memory).toMatchObject({
      terminal_status: "worker_failed",
      failure_kind: "research_worker_failed",
      observation: "ineligible",
      resource_summary: {
        provider_request_total: 1,
        runner_command_total: 2,
        scenario_count: 3,
        elapsed_ms: 4
      }
    });
  });

  it("retains bounded resource evidence for interrupted arms", () => {
    const study = studyFixture();
    const outcome = pairOutcome(study, 1, "interrupted", "unchanged");

    expect(outcome.released_memory.resource_summary).toEqual({
      provider_request_total: 0,
      runner_command_total: 0,
      scenario_count: 0,
      elapsed_ms: 0
    });
  });

  it("retains interruption before any arm effect with an explicit zero summary", () => {
    const study = studyFixture();
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: {
        armKind: "released_memory_treatment",
        terminalStatus: "interrupted",
        failureKind: "restart_interrupted",
        resourceSummary: {
          provider_request_total: 0,
          runner_command_total: 0,
          scenario_count: 0,
          elapsed_ms: 0
        }
      },
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });

    expect(outcome.ineligibility_reason).toBe("interrupted_or_unpaired_run");
    expect(outcome.released_memory).toMatchObject({
      terminal_status: "interrupted",
      preflight_evidence: null,
      worker_evidence: null,
      allocation_evidence: null,
      resource_summary: {
        provider_request_total: 0,
        runner_command_total: 0,
        scenario_count: 0,
        elapsed_ms: 0
      }
    });
  });

  it("retains provider failure before any arm effect with an explicit zero summary", () => {
    const study = studyFixture();
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: {
        armKind: "released_memory_treatment",
        terminalStatus: "platform_failed",
        failureKind: "provider_failed",
        resourceSummary: {
          provider_request_total: 0,
          runner_command_total: 0,
          scenario_count: 0,
          elapsed_ms: 0
        }
      },
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });

    expect(outcome.ineligibility_reason).toBe("worker_or_platform_failure");
    expect(outcome.released_memory).toMatchObject({
      terminal_status: "platform_failed",
      failure_kind: "provider_failed",
      preflight_evidence: null,
      resource_summary: {
        provider_request_total: 0,
        runner_command_total: 0,
        scenario_count: 0,
        elapsed_ms: 0
      }
    });
  });

  it("makes interruption without bounded resource evidence malformed", () => {
    const study = studyFixture();
    const interrupted = armEvidence(
      study,
      1,
      "released_memory_treatment",
      "interrupted"
    );
    delete interrupted.resourceSummary;
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: interrupted,
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });

    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
    expect(outcome.released_memory.resource_summary).toBeNull();
  });

  it("makes completed arm evidence without its exact checkpoint malformed", () => {
    const study = studyFixture();
    const released = armEvidence(
      study,
      1,
      "released_memory_treatment",
      "distinct"
    );
    delete released.checkpoint;
    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: released,
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });

    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("makes stale fingerprint content ineligible", () => {
    const study = studyFixture();
    const released = armEvidence(
      study,
      1,
      "released_memory_treatment",
      "distinct"
    );
    released.fingerprint!.observations[0]!.scenario_id = "tampered-scenario";

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: released,
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });

  it("makes a recomputed fingerprint from another suite ineligible", () => {
    const study = studyFixture();
    const released = armEvidence(
      study,
      1,
      "released_memory_treatment",
      "distinct"
    );
    released.fingerprint!.development_suite_digest = digest("9");
    released.fingerprint!.fingerprint_digest = sha256(
      researchBehaviorFingerprintDigestInput(released.fingerprint!)
    );
    released.admission!.research_behavior_fingerprint_digest =
      released.fingerprint!.fingerprint_digest;

    const outcome = decideResearchMemoryControlPairOutcome({
      study,
      pairIndex: 1,
      releasedMemory: released,
      memoryMasked: armEvidence(
        study,
        1,
        "memory_masked_control",
        "unchanged"
      ),
      terminalAt: "2026-07-13T05:01:00.000Z"
    });
    expect(outcome.eligibility_status).toBe("ineligible");
    expect(outcome.ineligibility_reason).toBe("malformed_evidence_graph");
  });
});

describe("ResearchMemoryControlStudyOutcome decision", () => {
  it("supports six favorable non-tied pairs at exact p=0.03125", () => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((pair) => pairOutcome(
      study,
      pair.pair_index,
      "distinct",
      "behavior_duplicate"
    ));

    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });

    expect(outcome.research_memory_control_study_outcome_id).toBe(
      researchMemoryControlStudyOutcomeId(
        study.research_memory_control_study_id
      )
    );
    expect(outcome).toMatchObject({
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
      memory_policy_decision_eligibility: "not_eligible",
      evaluation_authority: "external_to_trading_systems",
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(researchMemoryControlStudyOutcomeHasRuntimeShape(outcome)).toBe(true);
  });

  it.each([
    ["tied only", () => ["distinct", "distinct"] as const,
      "insufficient_memory_control_evidence"],
    ["adverse", () => ["unchanged", "distinct"] as const,
      "memory_effect_not_supported"],
    ["non-positive mean", (index: number) => index < 3
      ? ["distinct", "unchanged"] as const
      : ["unchanged", "distinct"] as const,
    "memory_effect_not_supported"],
    ["one ineligible", (index: number) => index === 0
      ? ["no_submission", "unchanged"] as const
      : ["distinct", "unchanged"] as const,
    "insufficient_memory_control_evidence"],
    ["one malformed opportunity", (index: number) => index === 0
      ? ["opportunity_mismatch", "unchanged"] as const
      : ["distinct", "unchanged"] as const,
    "insufficient_memory_control_evidence"]
  ])("does not support %s evidence", (_label, observations, expected) => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((pair, index) => {
      const [released, masked] = observations(index);
      return pairOutcome(study, pair.pair_index, released, masked);
    });

    const outcome = decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs,
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    });

    expect(outcome.inference_status).toBe(expected);
    expect(outcome.memory_policy_decision_eligibility).toBe("not_eligible");
  });

  it("requires every exact pair outcome in canonical order", () => {
    const study = studyFixture();
    const pairs = study.pair_plans.map((pair) => pairOutcome(
      study,
      pair.pair_index,
      "distinct",
      "unchanged"
    ));

    expect(() => decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs.slice(0, 5),
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    })).toThrow(ResearchMemoryControlStudyOutcomeDecisionError);

    expect(() => decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: [pairs[1]!, pairs[0]!, ...pairs.slice(2)],
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    })).toThrow(ResearchMemoryControlStudyOutcomeDecisionError);

    expect(() => decideResearchMemoryControlStudyOutcome({
      study,
      pairOutcomes: pairs.map((pair, index) => index === 0
        ? { ...pair, promotion_authority: true as false }
        : pair),
      adjudicatedAt: "2026-07-13T06:00:00.000Z"
    })).toThrow(ResearchMemoryControlStudyOutcomeDecisionError);
  });
});

type ObservationKind =
  | "distinct"
  | "unchanged"
  | "behavior_duplicate"
  | "fingerprint_unavailable"
  | "no_submission"
  | "worker_failed"
  | "malformed"
  | "missing_resources"
  | "opportunity_mismatch"
  | "admission_failed"
  | "missing_contrast"
  | "interrupted";

type CompleteArmEvidence = ResearchMemoryControlArmEvidenceInput & {
  researchWorker: ResearchWorkerRecord;
  allocation: CandidateArenaResearchAllocationRecord;
};

function pairOutcome(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  releasedObservation: ObservationKind,
  maskedObservation: ObservationKind
): ResearchMemoryControlPairOutcomeRecord {
  return decideResearchMemoryControlPairOutcome({
    study,
    pairIndex,
    releasedMemory: armEvidence(
      study,
      pairIndex,
      "released_memory_treatment",
      releasedObservation
    ),
    memoryMasked: armEvidence(
      study,
      pairIndex,
      "memory_masked_control",
      maskedObservation
    ),
    terminalAt: `2026-07-13T05:${String(pairIndex).padStart(2, "0")}:00.000Z`
  });
}

function armEvidence(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind,
  observation: ObservationKind
): CompleteArmEvidence {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const allocation = allocationFixture(study, pairIndex, armKind);
  const preflight = preflightFixture(
    study,
    pairIndex,
    armKind,
    observation === "missing_contrast" ? digest("9") : digest("8"),
    allocation,
    observation === "opportunity_mismatch" ? digest("9") : digest("a")
  );
  const researchWorker = researchWorkerFixture(study, pairIndex);
  if (observation === "interrupted") {
    return {
      armKind,
      terminalStatus: "interrupted" as const,
      preflight,
      allocation,
      researchWorker,
      checkpoint: checkpointFixture(
        preflight,
        researchWorker,
        undefined,
        observation
      ),
      resourceSummary: {
        provider_request_total: 0,
        runner_command_total: 0,
        scenario_count: 0,
        elapsed_ms: 0
      },
      failureKind: "restart_interrupted" as const
    };
  }
  const admission = [
    "distinct",
    "unchanged",
    "behavior_duplicate",
    "fingerprint_unavailable",
    "malformed",
    "missing_resources",
    "opportunity_mismatch",
    "admission_failed",
    "missing_contrast"
  ].includes(observation)
    ? admissionFixture(preflight, observation)
    : undefined;
  const fingerprint = admission?.research_behavior_fingerprint_ref
    ? fingerprintFixture(preflight, admission)
    : undefined;
  const checkpoint = checkpointFixture(
    preflight,
    researchWorker,
    admission,
    observation
  );
  const tick = tickFixture(
    pairIndex,
    pair.direction_kind,
    plan.tick_id,
    preflight,
    observation,
    admission
  );
  if (observation === "missing_resources") {
    delete tick.direction_results[0]!.research_efficiency;
  }
  return {
    armKind,
    terminalStatus: observation === "no_submission"
      ? "no_submission" as const
      : observation === "worker_failed"
      ? "worker_failed" as const
      : "completed" as const,
    tick,
    allocation,
    researchWorker,
    checkpoint,
    ...(observation === "malformed" ? {} : { preflight }),
    ...(admission ? { admission } : {}),
    ...(fingerprint ? { fingerprint } : {}),
    ...(observation === "worker_failed"
      ? { failureKind: "research_worker_failed" as const }
      : {})
  };
}

function researchWorkerFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number
): ResearchWorkerRecord {
  const pair = study.pair_plans[pairIndex - 1]!;
  return {
    record_kind: "research_worker",
    version: 1,
    research_worker_id: `research-worker-${pair.direction_kind}`,
    display_name: `${pair.direction_kind} ResearchWorker`,
    model: study.research_agent.model!,
    provider_kind: study.research_agent.provider === "codex"
      ? "codex_cli"
      : study.research_agent.provider === "claude_code"
      ? "claude_code"
      : "fixture_only",
    agent_profile_id: study.research_agent_profile_id,
    research_direction_ref: { ...pair.research_direction_ref },
    workspace_key: `candidate-arena-workers/research-worker-${
      pair.direction_kind.replaceAll("_", "-")
    }`,
    lifecycle_protocol: "research_worker_checkpoint_v1",
    created_at: "2026-07-13T05:00:10.000Z",
    status: "active",
    authority_status: "research_only"
  };
}

function checkpointFixture(
  preflight: ResearchPreflightCommitmentRecord,
  worker: ResearchWorkerRecord,
  admission: CandidateAdmissionDecisionRecord | undefined,
  observation: ObservationKind
): ResearchWorkerCheckpointRecord {
  const recordedSubmissionCount = admission ? 1 : 0;
  const failed = observation === "worker_failed" ||
    observation === "interrupted";
  const record: ResearchWorkerCheckpointRecord = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id:
      `checkpoint-${preflight.research_preflight_commitment_id}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: worker.research_worker_id
    },
    research_direction_ref: { ...preflight.research_direction_ref },
    candidate_arena_tick_id: preflight.candidate_arena_tick_id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    workspace_key: worker.workspace_key!,
    development_budget: {
      submission_limit: preflight.development_policy.submission_limit,
      recorded_submission_count: recordedSubmissionCount,
      cumulative_committed_submission_limit:
        preflight.development_policy.submission_limit,
      cumulative_recorded_submission_count: recordedSubmissionCount,
      remaining_submission_authority: 0
    },
    notebook: {
      protocol_version: "research_worker_notebook_v1",
      total_entry_count: recordedSubmissionCount,
      recent_entries: admission ? [{
        sequence: 1,
        candidate_arena_tick_id: preflight.candidate_arena_tick_id,
        iteration: 1,
        decision: "keep",
        agent_status: admission.research_worker_outcome === "unchanged"
          ? "no_change"
          : "edited",
        score: 1,
        summary: "Bounded ResearchMemoryControlStudy checkpoint fixture.",
        evaluation_status: "accepted",
        risk_decision: "no_order_request",
        net_revenue_usdt: 0
      }] : []
    },
    terminal_status: failed ? "failed_closed" : "completed",
    terminal_reason: observation === "interrupted"
      ? "restart_recovery"
      : observation === "worker_failed"
      ? "execution_failed"
      : observation === "no_submission"
      ? "finished_without_submission"
      : "admission_recorded",
    ...(admission
      ? {
          candidate_admission_decision_ref: {
            record_kind: "candidate_admission_decision",
            id: admission.candidate_admission_decision_id
          }
        }
      : {}),
    closed_at: admission?.decided_at ?? "2026-07-13T05:00:55.000Z",
    checkpoint_digest: digest("0"),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.checkpoint_digest = sha256(
    researchWorkerCheckpointDigestInput(record)
  );
  return record;
}

function allocationFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind
): CandidateArenaResearchAllocationRecord {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const defaultDirections = [
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "execution_cost_robustness"
  ] as const;
  const record: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id:
      `research-allocation-${pairIndex}-${plan.memory_mode}`,
    tick_id: plan.tick_id,
    allocation_mode: "explicit",
    allocation_policy_basis: { basis_kind: "explicit_request" },
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: [],
    signal_snapshot: [],
    selected_directions: [{
      direction_kind: pair.direction_kind,
      selection_kind: "explicit",
      priority: 1,
      experiment_budget: 1,
      signal_score: 0,
      reasons: ["explicit_direction"]
    }],
    deferred_directions: defaultDirections.filter(
      (direction) => direction !== pair.direction_kind
    ),
    allocated_at: "2026-07-13T05:00:20.000Z",
    allocation_digest: digest("0"),
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.allocation_digest = sha256(
    candidateArenaResearchAllocationDigestInput(record)
  );
  return record;
}

function preflightFixture(
  study: ResearchMemoryControlStudyRecord,
  pairIndex: number,
  armKind: ResearchMemoryControlArmKind,
  memorySourceDigest: string,
  allocation: CandidateArenaResearchAllocationRecord,
  developmentSuiteDigest: string
): ResearchPreflightCommitmentRecord {
  const pair = study.pair_plans[pairIndex - 1]!;
  const plan = armKind === "released_memory_treatment"
    ? pair.released_memory_treatment
    : pair.memory_masked_control;
  const record: ResearchPreflightCommitmentRecord = {
    record_kind: "research_preflight_commitment",
    version: 1,
    research_preflight_commitment_id:
      `research-preflight-${pairIndex}-${plan.memory_mode}`,
    candidate_arena_tick_id: plan.tick_id,
    research_direction_ref: { ...pair.research_direction_ref },
    research_worker_ref: {
      record_kind: "research_worker",
      id: `research-worker-${pair.direction_kind}`
    },
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    source_system_code_ref: { ...study.source.system_code_ref },
    source_artifact_digest: study.source.research_artifact_closure_digest,
    memory_policy: {
      protocol_version: "research_worker_memory_v1",
      memory_mode: plan.memory_mode,
      memory_source_digest: memorySourceDigest,
      available_memory_item_count: 3,
      arena_context_digest: plan.memory_mode === "released_memory"
        ? digest("6")
        : digest("7"),
      prior_checkpoint: { disposition: "none_available" },
      control_assignment: {
        study_ref: {
          record_kind: "research_memory_control_study",
          id: study.research_memory_control_study_id
        },
        study_digest: study.study_digest,
        pair_index: pairIndex,
        arm_kind: armKind
      }
    },
    development_policy: {
      suite_version: "research_development_replay_v1",
      suite_digest: developmentSuiteDigest,
      submission_limit: 1,
      feedback_release: "aggregate_after_each_submission"
    },
    sealed_admission_policy: {
      suite_version: "research_sealed_admission_v1",
      generator_version: "research_scenario_generator_v1",
      rotation_commitment_digest: digest("b"),
      suite_digest: digest("c"),
      submission_limit: 1,
      feedback_release: "terminal_after_freeze"
    },
    committed_at: "2026-07-13T05:00:30.000Z",
    research_preflight_authority: true,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live",
    commitment_digest: digest("0")
  };
  record.commitment_digest = sha256(
    researchPreflightCommitmentDigestInput(record)
  );
  return record;
}

function admissionFixture(
  preflight: ResearchPreflightCommitmentRecord,
  observation: ObservationKind
): CandidateAdmissionDecisionRecord {
  const unchanged = observation === "unchanged";
  const duplicate = observation === "behavior_duplicate";
  const unavailable = observation === "fingerprint_unavailable";
  const failed = observation === "admission_failed";
  const sourceDigest = digest("d");
  const submittedDigest = unchanged ? sourceDigest : digest("e");
  const behavior = unchanged || failed
    ? {}
    : unavailable
    ? { behavior_comparison_status: "unavailable" as const }
    : duplicate
    ? {
        behavior_comparison_status: "duplicate" as const,
        research_behavior_fingerprint_ref: {
          record_kind: "research_behavior_fingerprint",
          id: `${preflight.research_preflight_commitment_id}-fingerprint`
        },
        research_behavior_fingerprint_digest: digest("f"),
        matching_research_behavior_fingerprint_ref: {
          record_kind: "research_behavior_fingerprint",
          id: "prior-matching-fingerprint"
        },
        matching_research_behavior_fingerprint_digest: digest("f")
      }
    : {
        behavior_comparison_status: "distinct" as const,
        research_behavior_fingerprint_ref: {
          record_kind: "research_behavior_fingerprint",
          id: `${preflight.research_preflight_commitment_id}-fingerprint`
        },
        research_behavior_fingerprint_digest: digest("f")
      };
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id:
      `${preflight.research_preflight_commitment_id}-admission`,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    source_system_code_ref: { ...preflight.source_system_code_ref },
    system_code_ref: {
      record_kind: "system_code",
      id: `${preflight.research_preflight_commitment_id}-system-code`
    },
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: `${preflight.research_preflight_commitment_id}-experiment`
    },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: `${preflight.research_preflight_commitment_id}-evaluation`
    },
    research_finding_ref: {
      record_kind: "research_finding",
      id: `${preflight.research_preflight_commitment_id}-finding`
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: submittedDigest,
    research_worker_outcome: failed ? "failed" : unchanged
      ? "unchanged"
      : "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    ...behavior,
    status: failed ? "quarantined" : unchanged || duplicate
      ? "duplicate" : unavailable
      ? "quarantined"
      : "admitted",
    reason: failed ? "research_worker_failed" : unchanged
      ? "no_candidate_change" : duplicate
      ? "behavior_duplicate"
      : unavailable
      ? "behavior_fingerprint_unavailable"
      : "evaluation_accepted",
    runnable_paper_handoff: !(failed || unchanged || duplicate || unavailable),
    decided_at: "2026-07-13T05:00:45.000Z",
    authority_status: "not_live"
  };
}

function fingerprintFixture(
  preflight: ResearchPreflightCommitmentRecord,
  admission: CandidateAdmissionDecisionRecord
): ResearchBehaviorFingerprintRecord {
  const record: ResearchBehaviorFingerprintRecord = {
    record_kind: "research_behavior_fingerprint",
    version: 1,
    research_behavior_fingerprint_id:
      admission.research_behavior_fingerprint_ref!.id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: preflight.commitment_digest,
    system_code_ref: { ...admission.system_code_ref },
    system_code_artifact_digest: admission.submitted_artifact_digest,
    protocol_version: "research_behavior_fingerprint_v1",
    development_suite_version: "research_development_replay_v1",
    development_suite_digest: preflight.development_policy.suite_digest,
    observations: [{
      scenario_id: "scenario-001",
      decision: {
        symbol: "BTCUSDT",
        side: "hold",
        quantity: 0,
        order_type: "none"
      }
    }],
    observation_count: 1,
    fingerprint_digest: digest("0"),
    created_at: "2026-07-13T05:00:40.000Z",
    duplicate_detection_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  record.fingerprint_digest = sha256(
    researchBehaviorFingerprintDigestInput(record)
  );
  admission.research_behavior_fingerprint_digest = record.fingerprint_digest;
  if (admission.behavior_comparison_status === "duplicate") {
    admission.matching_research_behavior_fingerprint_digest =
      record.fingerprint_digest;
  }
  return record;
}

function tickFixture(
  pairIndex: number,
  directionKind: ResearchMemoryControlStudyRecord["pair_plans"][number]["direction_kind"],
  tickId: string,
  preflight: ResearchPreflightCommitmentRecord,
  observation: ObservationKind,
  admission: CandidateAdmissionDecisionRecord | undefined
): CandidateArenaTickRecord {
  const status: CandidateArenaTickDirectionResultReadModel["status"] =
    observation === "no_submission" ? "no_submission" :
    observation === "worker_failed" ? "failed" :
    observation === "unchanged" || observation === "behavior_duplicate"
      ? "duplicate"
      : observation === "fingerprint_unavailable" ||
          observation === "admission_failed"
      ? "quarantined"
      : "created";
  const result: CandidateArenaTickDirectionResultReadModel = {
    direction_kind: directionKind,
    status,
    agent_provider: "codex",
    ...(admission ? {
      admission_decision_id: admission.candidate_admission_decision_id,
      admission_reason: admission.reason
    } : {}),
    research_efficiency: {
      provider_request_total: 1,
      runner_command_total: 2,
      scenario_count: 3,
      elapsed_ms: 4,
      authority_status: "not_promotion_authority"
    },
    research_preflight: {
      commitment_id: preflight.research_preflight_commitment_id,
      development_submission_count: observation === "no_submission" ? 0 : 1,
      sealed_terminal_status: observation === "worker_failed"
        ? "not_run"
        : observation === "no_submission"
        ? "not_run"
        : status === "created" ? "accepted" : "rejected",
      reason: observation === "worker_failed" ? "execution_failed" :
        observation === "no_submission" ? "no_development_winner" :
        status === "created" ? "accepted" : "candidate_rejected",
      authority_status: "not_promotion_authority"
    }
  };
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: `candidate-arena-tick-${pairIndex}-${tickId}`,
    tick_id: tickId,
    started_at: "2026-07-13T05:00:30.000Z",
    completed_at: "2026-07-13T05:00:50.000Z",
    status: status === "failed" ? "completed_with_errors" : "completed",
    created_candidate_refs: status === "created" ? [{
      record_kind: "trading_system_candidate",
      id: `${tickId}-candidate`
    }] : [],
    direction_results: [result],
    research_allocation_ref: { ...preflight.research_allocation_ref },
    research_allocation_digest: preflight.research_allocation_digest,
    authority_status: "not_live"
  };
}

function studyFixture(): ResearchMemoryControlStudyRecord {
  return decideResearchMemoryControlStudy({
    idempotencyKey: "memory-control-outcome-study",
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
    researchAgent: {
      id: "codex-agent",
      provider: "codex",
      model: "gpt-5.4",
      permission_policy: "artifact_workspace_only"
    },
    opportunityProtocol: {
      development_suite_version: "research_development_replay_v1",
      development_suite_digest: digest("a"),
      sealed_suite_version: "research_sealed_admission_v1",
      sealed_generator_version: "research_scenario_generator_v1",
      sealed_rotation_commitment_digest: digest("b"),
      sealed_suite_digest: digest("c")
    },
    directions: Array.from({ length: 6 }, (_, index) => ({
      research_direction_id: `direction-${index + 1}`,
      direction_kind: index % 2 === 0
        ? "trend_following" as const
        : "mean_reversion" as const
    })),
    committedAt: "2026-07-13T05:00:00.000Z"
  });
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
