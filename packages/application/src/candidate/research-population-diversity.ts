import {
  RESEARCH_DIRECTION_KINDS,
  researchPopulationDiversityHasRuntimeShape,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaTickRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchDirectionKind,
  type ResearchDirectionRecord,
  type ResearchDiversityDistributionReadModel,
  type ResearchPopulationDiversityDirectionReadModel,
  type ResearchPopulationDiversityObservedBehaviorReadModel,
  type ResearchPopulationDiversityReadModel,
  type ResearchPreflightCommitmentRecord
} from "@ouroboros/domain";

export interface BuildResearchPopulationDiversityInput {
  ticks: CandidateArenaTickRecord[];
  directions: ResearchDirectionRecord[];
  commitments: ResearchPreflightCommitmentRecord[];
  fingerprints: ResearchBehaviorFingerprintRecord[];
  admissions: CandidateAdmissionDecisionRecord[];
}

export type ResearchPopulationDiversityEvidenceErrorReason =
  | "invalid_input"
  | "duplicate_commitment"
  | "missing_research_direction"
  | "missing_tick_direction_result"
  | "fingerprint_policy_mismatch"
  | "conflicting_commitment_fingerprint"
  | "conflicting_commitment_admission"
  | "derived_read_model_invalid";

export class ResearchPopulationDiversityEvidenceError extends Error {
  readonly code = "invalid_research_population_diversity_evidence";

  constructor(readonly reason: ResearchPopulationDiversityEvidenceErrorReason) {
    super(`ResearchPopulationDiversity evidence is invalid: ${reason}.`);
    this.name = "ResearchPopulationDiversityEvidenceError";
  }
}

interface DirectionAccumulator {
  attemptCount: number;
  observedBehaviorCount: number;
  behaviorKeys: Set<string>;
  admittedSubmissionCount: number;
  exactBehaviorDuplicateCount: number;
}

export function buildResearchPopulationDiversity(
  input: BuildResearchPopulationDiversityInput
): ResearchPopulationDiversityReadModel {
  assertInput(input);
  const windowTicks = [...input.ticks]
    .sort((left, right) =>
      right.completed_at.localeCompare(left.completed_at) ||
      right.tick_id.localeCompare(left.tick_id)
    )
    .slice(0, 10);
  const windowTickIds = new Set(windowTicks.map((tick) => tick.tick_id));
  const tickById = new Map(windowTicks.map((tick) => [tick.tick_id, tick]));
  const directionById = directionRecordMap(input.directions);
  const accumulators = new Map<ResearchDirectionKind, DirectionAccumulator>(
    RESEARCH_DIRECTION_KINDS.map((direction) => [direction, emptyAccumulator()])
  );

  for (const tick of windowTicks) {
    for (const result of tick.direction_results) {
      accumulators.get(result.direction_kind)!.attemptCount += 1;
    }
  }

  const commitmentById = new Map<string, ResearchPreflightCommitmentRecord>();
  const directionByCommitmentId = new Map<string, ResearchDirectionKind>();
  for (const commitment of input.commitments) {
    if (!windowTickIds.has(commitment.candidate_arena_tick_id)) continue;
    if (commitmentById.has(commitment.research_preflight_commitment_id)) {
      throw invalidEvidence("duplicate_commitment");
    }
    const direction = directionById.get(commitment.research_direction_ref.id);
    if (!direction) throw invalidEvidence("missing_research_direction");
    const tick = tickById.get(commitment.candidate_arena_tick_id)!;
    if (!tick.direction_results.some((result) =>
      result.direction_kind === direction.direction_kind
    )) {
      throw invalidEvidence("missing_tick_direction_result");
    }
    commitmentById.set(commitment.research_preflight_commitment_id, commitment);
    directionByCommitmentId.set(
      commitment.research_preflight_commitment_id,
      direction.direction_kind
    );
  }

  const fingerprintsByCommitment = new Map<string, ResearchBehaviorFingerprintRecord>();
  const behaviorKeys: string[] = [];
  const cohortKeys = new Set<string>();
  for (const fingerprint of input.fingerprints) {
    const commitmentId = fingerprint.research_preflight_commitment_ref.id;
    const commitment = commitmentById.get(commitmentId);
    if (!commitment ||
      fingerprint.research_preflight_commitment_digest !== commitment.commitment_digest) {
      continue;
    }
    if (fingerprint.development_suite_version !==
        commitment.development_policy.suite_version ||
      fingerprint.development_suite_digest !== commitment.development_policy.suite_digest) {
      throw invalidEvidence("fingerprint_policy_mismatch");
    }
    const previous = fingerprintsByCommitment.get(commitmentId);
    if (previous) {
      if (previous.research_behavior_fingerprint_id ===
        fingerprint.research_behavior_fingerprint_id) {
        continue;
      }
      throw invalidEvidence("conflicting_commitment_fingerprint");
    }
    fingerprintsByCommitment.set(commitmentId, fingerprint);
    const behaviorKey = exactBehaviorKey(fingerprint);
    behaviorKeys.push(behaviorKey);
    cohortKeys.add(exactCohortKey(fingerprint));
    const direction = directionByCommitmentId.get(commitmentId)!;
    const accumulator = accumulators.get(direction)!;
    accumulator.observedBehaviorCount += 1;
    accumulator.behaviorKeys.add(behaviorKey);
  }

  const admissionsByCommitment = new Set<string>();
  let artifactDuplicateCount = 0;
  let unavailableFingerprintCount = 0;
  for (const admission of input.admissions) {
    const commitmentId = admission.research_preflight_commitment_ref?.id;
    if (!commitmentId) continue;
    const commitment = commitmentById.get(commitmentId);
    if (!commitment ||
      admission.research_preflight_commitment_digest !== commitment.commitment_digest) {
      continue;
    }
    if (admissionsByCommitment.has(commitmentId)) {
      throw invalidEvidence("conflicting_commitment_admission");
    }
    admissionsByCommitment.add(commitmentId);
    const accumulator = accumulators.get(directionByCommitmentId.get(commitmentId)!)!;
    if (admission.status === "admitted" &&
      admission.reason === "evaluation_accepted") {
      accumulator.admittedSubmissionCount += 1;
    } else if (admission.status === "duplicate" &&
      admission.reason === "behavior_duplicate") {
      accumulator.exactBehaviorDuplicateCount += 1;
    } else if (admission.status === "duplicate" &&
      admission.reason === "no_candidate_change") {
      artifactDuplicateCount += 1;
    } else if (admission.status === "quarantined" &&
      admission.reason === "behavior_fingerprint_unavailable") {
      unavailableFingerprintCount += 1;
    }
  }

  const assignedDirectionKeys = windowTicks.flatMap((tick) =>
    tick.direction_results.map((result) => result.direction_kind)
  );
  const observedBehaviors = behaviorDistribution({
    behaviorKeys,
    cohortCount: cohortKeys.size,
    admittedSubmissionCount: total(accumulators, "admittedSubmissionCount"),
    exactBehaviorDuplicateCount: total(accumulators, "exactBehaviorDuplicateCount"),
    artifactDuplicateCount,
    unavailableFingerprintCount
  });
  const behaviorIsComparable =
    observedBehaviors.measurement_status !== "incomparable_suites";
  const byDirection = RESEARCH_DIRECTION_KINDS.flatMap((direction) => {
    const accumulator = accumulators.get(direction)!;
    if (accumulator.attemptCount === 0 &&
      accumulator.observedBehaviorCount === 0 &&
      accumulator.admittedSubmissionCount === 0 &&
      accumulator.exactBehaviorDuplicateCount === 0) {
      return [];
    }
    return [{
      direction_kind: direction,
      attempt_count: accumulator.attemptCount,
      observed_behavior_count: accumulator.observedBehaviorCount,
      ...(behaviorIsComparable
        ? { unique_behavior_count: accumulator.behaviorKeys.size }
        : {}),
      admitted_submission_count: accumulator.admittedSubmissionCount,
      exact_behavior_duplicate_count: accumulator.exactBehaviorDuplicateCount
    } satisfies ResearchPopulationDiversityDirectionReadModel];
  });
  const result: ResearchPopulationDiversityReadModel = {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: windowTicks.length,
    assigned_directions: comparableDistribution(
      assignedDirectionKeys,
      RESEARCH_DIRECTION_KINDS.length
    ),
    observed_behaviors: observedBehaviors,
    by_direction: byDirection,
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
  if (!researchPopulationDiversityHasRuntimeShape(result)) {
    throw invalidEvidence("derived_read_model_invalid");
  }
  return result;
}

function behaviorDistribution(input: {
  behaviorKeys: string[];
  cohortCount: number;
  admittedSubmissionCount: number;
  exactBehaviorDuplicateCount: number;
  artifactDuplicateCount: number;
  unavailableFingerprintCount: number;
}): ResearchPopulationDiversityObservedBehaviorReadModel {
  const counts = {
    cohort_count: input.cohortCount,
    admitted_submission_count: input.admittedSubmissionCount,
    exact_behavior_duplicate_count: input.exactBehaviorDuplicateCount,
    artifact_duplicate_count: input.artifactDuplicateCount,
    unavailable_fingerprint_count: input.unavailableFingerprintCount
  };
  if (input.cohortCount > 1) {
    return {
      measurement_status: "incomparable_suites",
      sample_count: input.behaviorKeys.length,
      ...counts
    };
  }
  return {
    ...comparableDistribution(input.behaviorKeys, input.behaviorKeys.length),
    ...counts
  };
}

function comparableDistribution(
  samples: readonly string[],
  maximumCategoryCount: number
): ResearchDiversityDistributionReadModel {
  const frequencies = new Map<string, number>();
  for (const sample of samples) {
    frequencies.set(sample, (frequencies.get(sample) ?? 0) + 1);
  }
  const sampleCount = samples.length;
  const uniqueCount = frequencies.size;
  if (sampleCount < 2) {
    return {
      measurement_status: "insufficient_evidence",
      sample_count: sampleCount,
      unique_count: uniqueCount,
      entropy_bits: 0,
      normalized_entropy: 0
    };
  }
  const entropy = [...frequencies.values()].reduce((sum, count) => {
    const probability = count / sampleCount;
    return sum - probability * Math.log2(probability);
  }, 0);
  const maximumEntropy = Math.log2(Math.min(sampleCount, maximumCategoryCount));
  return {
    measurement_status: "measured",
    sample_count: sampleCount,
    unique_count: uniqueCount,
    entropy_bits: roundMetric(entropy),
    normalized_entropy: roundMetric(maximumEntropy === 0 ? 0 : entropy / maximumEntropy)
  };
}

function directionRecordMap(
  directions: ResearchDirectionRecord[]
): Map<string, ResearchDirectionRecord> {
  const result = new Map<string, ResearchDirectionRecord>();
  for (const direction of directions) {
    const previous = result.get(direction.research_direction_id);
    if (previous && previous.direction_kind !== direction.direction_kind) {
      throw invalidEvidence("missing_research_direction");
    }
    result.set(direction.research_direction_id, direction);
  }
  return result;
}

function emptyAccumulator(): DirectionAccumulator {
  return {
    attemptCount: 0,
    observedBehaviorCount: 0,
    behaviorKeys: new Set(),
    admittedSubmissionCount: 0,
    exactBehaviorDuplicateCount: 0
  };
}

function exactCohortKey(fingerprint: ResearchBehaviorFingerprintRecord): string {
  return JSON.stringify([
    fingerprint.protocol_version,
    fingerprint.development_suite_version,
    fingerprint.development_suite_digest
  ]);
}

function exactBehaviorKey(fingerprint: ResearchBehaviorFingerprintRecord): string {
  return JSON.stringify([
    fingerprint.protocol_version,
    fingerprint.development_suite_version,
    fingerprint.development_suite_digest,
    fingerprint.fingerprint_digest
  ]);
}

function total(
  accumulators: Map<ResearchDirectionKind, DirectionAccumulator>,
  field: "admittedSubmissionCount" | "exactBehaviorDuplicateCount"
): number {
  return [...accumulators.values()].reduce(
    (sum, accumulator) => sum + accumulator[field],
    0
  );
}

function roundMetric(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertInput(
  input: BuildResearchPopulationDiversityInput
): void {
  if (!input || !Array.isArray(input.ticks) || !Array.isArray(input.directions) ||
    !Array.isArray(input.commitments) || !Array.isArray(input.fingerprints) ||
    !Array.isArray(input.admissions)) {
    throw invalidEvidence("invalid_input");
  }
}

function invalidEvidence(
  reason: ResearchPopulationDiversityEvidenceErrorReason
): ResearchPopulationDiversityEvidenceError {
  return new ResearchPopulationDiversityEvidenceError(reason);
}
