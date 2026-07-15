import { createHash } from "node:crypto";
import {
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  isCandidateAdmissionDecisionConsistent,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  researchBehaviorFingerprintDigestInput,
  researchBehaviorFingerprintHasRuntimeShape,
  researchMemoryControlPairOutcomeDigestInput,
  researchMemoryControlPairOutcomeHasRuntimeShape,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyHasRuntimeShape,
  researchMemoryControlStudyOutcomeDigestInput,
  researchMemoryControlStudyOutcomeHasRuntimeShape,
  researchPreflightCommitmentDigestInput,
  researchPreflightCommitmentHasRuntimeShape,
  researchWorkerCheckpointDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  type CandidateAdmissionDecisionRecord,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaResearchEfficiencyReadModel,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ResearchBehaviorFingerprintRecord,
  type ResearchMemoryControlAdmissionEvidence,
  type ResearchMemoryControlAllocationEvidence,
  type ResearchMemoryControlArmKind,
  type ResearchMemoryControlArmResult,
  type ResearchMemoryControlArmTerminalStatus,
  type ResearchMemoryControlFailureKind,
  type ResearchMemoryControlPairIneligibilityReason,
  type ResearchMemoryControlPairOutcomeRecord,
  type ResearchMemoryControlPairPlan,
  type ResearchMemoryControlPreflightEvidence,
  type ResearchMemoryControlResourceSummary,
  type ResearchMemoryControlStudyOutcomeRecord,
  type ResearchMemoryControlStudyRecord,
  type ResearchMemoryControlTickEvidence,
  type ResearchMemoryControlWorkerEvidence,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerRecord
} from "@ouroboros/domain";
import { exactTwoSidedSignTestPValue } from
  "./research-control-study-outcome";

export interface ResearchMemoryControlArmEvidenceInput {
  armKind: ResearchMemoryControlArmKind;
  terminalStatus: ResearchMemoryControlArmTerminalStatus;
  tick?: CandidateArenaTickRecord;
  preflight?: ResearchPreflightCommitmentRecord;
  checkpoint?: ResearchWorkerCheckpointRecord;
  researchWorker?: ResearchWorkerRecord;
  allocation?: CandidateArenaResearchAllocationRecord;
  resourceSummary?: ResearchMemoryControlResourceSummary;
  admission?: CandidateAdmissionDecisionRecord;
  fingerprint?: ResearchBehaviorFingerprintRecord;
  failureKind?: ResearchMemoryControlFailureKind;
}

export interface DecideResearchMemoryControlPairOutcomeInput {
  study: ResearchMemoryControlStudyRecord;
  pairIndex: number;
  releasedMemory: ResearchMemoryControlArmEvidenceInput;
  memoryMasked: ResearchMemoryControlArmEvidenceInput;
  terminalAt: string;
}

export interface DecideResearchMemoryControlStudyOutcomeInput {
  study: ResearchMemoryControlStudyRecord;
  pairOutcomes: ResearchMemoryControlPairOutcomeRecord[];
  adjudicatedAt: string;
}

export class ResearchMemoryControlPairOutcomeDecisionError extends Error {
  readonly code = "invalid_research_memory_control_pair_outcome_input";

  constructor() {
    super("ResearchMemoryControlPairOutcome decision input is invalid.");
    this.name = "ResearchMemoryControlPairOutcomeDecisionError";
  }
}

export class ResearchMemoryControlStudyOutcomeDecisionError extends Error {
  readonly code = "invalid_research_memory_control_study_outcome_input";

  constructor() {
    super("ResearchMemoryControlStudyOutcome decision input is invalid.");
    this.name = "ResearchMemoryControlStudyOutcomeDecisionError";
  }
}

export function decideResearchMemoryControlPairOutcome(
  input: DecideResearchMemoryControlPairOutcomeInput
): ResearchMemoryControlPairOutcomeRecord {
  try {
    assertExactStudy(input?.study, invalidPairDecision);
    const pairIndex = positivePairIndex(input?.pairIndex);
    const pairPlan = input.study.pair_plans[pairIndex - 1];
    if (!pairPlan || pairPlan.pair_index !== pairIndex) {
      throw invalidPairDecision();
    }
    const terminalAt = canonicalTime(input.terminalAt, invalidPairDecision);
    if (Date.parse(terminalAt) < Date.parse(input.study.committed_at)) {
      throw invalidPairDecision();
    }
    let released = buildArmResult({
      study: input.study,
      pairPlan,
      expectedArmKind: "released_memory_treatment",
      evidence: input.releasedMemory,
      terminalAt
    });
    let masked = buildArmResult({
      study: input.study,
      pairPlan,
      expectedArmKind: "memory_masked_control",
      evidence: input.memoryMasked,
      terminalAt
    });
    let ineligibilityReason = pairIneligibilityReason(released, masked);
    if (!ineligibilityReason && !memoryContrastMatches(released, masked)) {
      ineligibilityReason = "missing_memory_contrast";
      released = markArmIneligible(released, ineligibilityReason);
      masked = markArmIneligible(masked, ineligibilityReason);
    }
    const initialStartSkew = initialStartSkewMs(released, masked);
    if (!ineligibilityReason && (!pairedExperimentEvidenceMatches(
      released,
      masked,
      pairPlan.direction_kind
    ) || initialStartSkew === null || initialStartSkew >
      input.study.policy.maximum_within_pair_start_skew_ms)) {
      ineligibilityReason = "malformed_evidence_graph";
      released = markArmIneligible(released, ineligibilityReason);
      masked = markArmIneligible(masked, ineligibilityReason);
    }
    if (ineligibilityReason) {
      if (released.ineligibility_reason !== ineligibilityReason &&
        masked.ineligibility_reason !== ineligibilityReason) {
        released = markArmIneligible(released, ineligibilityReason);
      }
    }
    const eligible = ineligibilityReason === null;
    const record: ResearchMemoryControlPairOutcomeRecord = {
      record_kind: "research_memory_control_pair_outcome",
      version: 1,
      research_memory_control_pair_outcome_id:
        researchMemoryControlPairOutcomeId(
          input.study.research_memory_control_study_id,
          pairIndex
        ),
      study_ref: {
        record_kind: "research_memory_control_study",
        id: input.study.research_memory_control_study_id
      },
      study_digest: input.study.study_digest,
      pair_index: pairIndex,
      pair_plan_digest: canonicalDigest(pairPlan),
      research_direction_ref: { ...pairPlan.research_direction_ref },
      direction_kind: pairPlan.direction_kind,
      released_memory: released,
      memory_masked: masked,
      eligibility_status: eligible ? "eligible" : "ineligible",
      ineligibility_reason: ineligibilityReason,
      initial_start_skew_ms: initialStartSkew,
      paired_difference: eligible
        ? (masked.exact_repeat_indicator! -
          released.exact_repeat_indicator!) as -1 | 0 | 1
        : null,
      terminal_at: terminalAt,
      pair_outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.pair_outcome_digest = canonicalDigest(
      researchMemoryControlPairOutcomeDigestInput(record)
    );
    if (!researchMemoryControlPairOutcomeHasRuntimeShape(record)) {
      throw invalidPairDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchMemoryControlPairOutcomeDecisionError) {
      throw error;
    }
    throw invalidPairDecision();
  }
}

export function decideResearchMemoryControlStudyOutcome(
  input: DecideResearchMemoryControlStudyOutcomeInput
): ResearchMemoryControlStudyOutcomeRecord {
  try {
    assertExactStudy(input?.study, invalidStudyOutcomeDecision);
    if (!Array.isArray(input?.pairOutcomes) ||
      input.pairOutcomes.length !== input.study.pair_plans.length) {
      throw invalidStudyOutcomeDecision();
    }
    const adjudicatedAt = canonicalTime(
      input.adjudicatedAt,
      invalidStudyOutcomeDecision
    );
    assertPairOutcomes(input.study, input.pairOutcomes, adjudicatedAt);
    const eligible = input.pairOutcomes.filter(
      (pair) => pair.eligibility_status === "eligible"
    );
    const differences = eligible.map((pair) => pair.paired_difference!);
    const favorable = differences.filter((difference) => difference > 0).length;
    const unfavorable = differences.filter((difference) => difference < 0).length;
    const tied = differences.length - favorable - unfavorable;
    const nonTied = favorable + unfavorable;
    const mean = differences.length === 0
      ? null
      : round6(
          differences.reduce<number>((sum, difference) => sum + difference, 0) /
            differences.length
        );
    const pValue = exactTwoSidedSignTestPValue(favorable, unfavorable);
    const supported = nonTied >=
        input.study.analysis_policy.minimum_non_tied_pair_count &&
      favorable > unfavorable &&
      pValue <= input.study.analysis_policy.alpha && mean !== null &&
      mean > input.study.analysis_policy.minimum_mean_paired_difference;
    const inference = nonTied <
        input.study.analysis_policy.minimum_non_tied_pair_count
      ? "insufficient_memory_control_evidence" as const
      : supported
      ? "memory_effect_supported" as const
      : "memory_effect_not_supported" as const;
    const record: ResearchMemoryControlStudyOutcomeRecord = {
      record_kind: "research_memory_control_study_outcome",
      version: 1,
      research_memory_control_study_outcome_id:
        researchMemoryControlStudyOutcomeId(
          input.study.research_memory_control_study_id
        ),
      study_ref: {
        record_kind: "research_memory_control_study",
        id: input.study.research_memory_control_study_id
      },
      study_digest: input.study.study_digest,
      pair_results: input.pairOutcomes.map((pair) => ({
        pair_index: pair.pair_index,
        pair_outcome_ref: {
          record_kind: "research_memory_control_pair_outcome",
          id: pair.research_memory_control_pair_outcome_id
        },
        pair_outcome_digest: pair.pair_outcome_digest,
        eligibility_status: pair.eligibility_status,
        ineligibility_reason: pair.ineligibility_reason,
        paired_difference: pair.paired_difference
      })),
      planned_pair_count: input.study.pair_plans.length,
      completed_pair_count: input.pairOutcomes.length,
      eligible_pair_count: eligible.length,
      ineligible_pair_count: input.pairOutcomes.length - eligible.length,
      favorable_pair_count: favorable,
      unfavorable_pair_count: unfavorable,
      tied_pair_count: tied,
      non_tied_pair_count: nonTied,
      mean_paired_difference: mean,
      exact_sign_test_p_value: pValue,
      inference_status: inference,
      causal_scope: "same_baseline_paired_exact_repeat_effect_only",
      memory_policy_decision_eligibility: "not_eligible",
      next_action: supported
        ? "review_memory_evidence_without_automatic_policy_change"
        : "retain_current_memory_policy_and_redesign_study",
      adjudicated_at: adjudicatedAt,
      study_outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.study_outcome_digest = canonicalDigest(
      researchMemoryControlStudyOutcomeDigestInput(record)
    );
    if (!researchMemoryControlStudyOutcomeHasRuntimeShape(record)) {
      throw invalidStudyOutcomeDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchMemoryControlStudyOutcomeDecisionError) {
      throw error;
    }
    throw invalidStudyOutcomeDecision();
  }
}

export function researchMemoryControlPairOutcomeId(
  studyId: string,
  pairIndex: number
): string {
  const key = `${canonicalString(studyId, invalidPairDecision)}:${
    positivePairIndex(pairIndex)
  }`;
  return `research-memory-control-pair-outcome-${digestHex(key).slice(0, 20)}`;
}

export function researchMemoryControlStudyOutcomeId(studyId: string): string {
  return `research-memory-control-study-outcome-${digestHex(
    canonicalString(studyId, invalidStudyOutcomeDecision)
  ).slice(0, 20)}`;
}

function buildArmResult(input: {
  study: ResearchMemoryControlStudyRecord;
  pairPlan: ResearchMemoryControlPairPlan;
  expectedArmKind: ResearchMemoryControlArmKind;
  evidence: ResearchMemoryControlArmEvidenceInput;
  terminalAt: string;
}): ResearchMemoryControlArmResult {
  if (!input.evidence || input.evidence.armKind !== input.expectedArmKind) {
    throw invalidPairDecision();
  }
  const plan = input.expectedArmKind === "released_memory_treatment"
    ? input.pairPlan.released_memory_treatment
    : input.pairPlan.memory_masked_control;
  assertTerminalEvidenceShape(input.evidence);
  const result = exactDirectionResult(
    input.evidence.tick,
    plan.tick_id,
    input.pairPlan.direction_kind
  );
  assertPreflightSubstitution(
    input.study,
    input.pairPlan,
    plan.tick_id,
    input.expectedArmKind,
    input.evidence.preflight
  );
  const tickPreflightMatches = tickPreflightEvidenceMatches(
    input.evidence.tick,
    result,
    input.evidence.preflight
  );
  const workerEvidence = compactWorkerEvidence(
    input.study,
    input.pairPlan,
    input.evidence.researchWorker,
    input.evidence.preflight
  );
  const allocationEvidence = compactAllocationEvidence(
    input.pairPlan,
    plan.tick_id,
    input.evidence.allocation,
    input.evidence.preflight,
    input.evidence.tick
  );
  const checkpointMatches = checkpointEvidenceMatches({
    checkpoint: input.evidence.checkpoint,
    preflight: input.evidence.preflight,
    researchWorker: input.evidence.researchWorker,
    admission: input.evidence.admission,
    plannedTickId: plan.tick_id,
    directionRefId: input.pairPlan.research_direction_ref.id
  });
  assertEvidenceTimes(input.evidence, input.terminalAt);
  const tickEvidence = compactTickEvidence(input.evidence.tick, result);
  const preflightEvidence = compactPreflightEvidence(input.evidence.preflight);
  const admissionEvidence = compactAdmissionEvidence(
    input.evidence.admission,
    input.evidence.preflight,
    result
  );
  const resourceSummary = compactResourceSummary(result?.research_efficiency) ??
    compactExplicitResourceSummary(input.evidence.resourceSummary);
  const opportunityProtocolMatches = preflightOpportunityProtocolMatches(
    input.study,
    input.evidence.preflight
  );
  const base = {
    arm_kind: input.expectedArmKind,
    memory_mode: plan.memory_mode,
    planned_tick_id: plan.tick_id,
    terminal_status: input.evidence.terminalStatus,
    failure_kind: input.evidence.failureKind ?? null,
    tick_evidence: tickEvidence,
    preflight_evidence: preflightEvidence,
    worker_evidence: workerEvidence,
    allocation_evidence: allocationEvidence,
    admission_evidence: admissionEvidence,
    resource_summary: resourceSummary
  };
  const terminalReason = terminalIneligibilityReason(input.evidence);
  if (terminalReason) {
    const boundEffectEvidence = Boolean(
      preflightEvidence && workerEvidence && allocationEvidence &&
      opportunityProtocolMatches && tickPreflightMatches && checkpointMatches
    );
    const beforeAnyEffect = terminalBeforeAnyEffect(
      input.evidence,
      tickEvidence,
      preflightEvidence,
      workerEvidence,
      allocationEvidence,
      admissionEvidence,
      resourceSummary
    );
    if ((!boundEffectEvidence && !beforeAnyEffect) || !resourceSummary ||
      (terminalReason === "no_submission" && !tickEvidence)) {
      return ineligibleArm(base, "malformed_evidence_graph");
    }
    return ineligibleArm(base, terminalReason);
  }
  if (!input.evidence.tick || !result || !input.evidence.preflight ||
    !input.evidence.admission || !workerEvidence || !allocationEvidence ||
    !admissionEvidence || !resourceSummary || !opportunityProtocolMatches ||
    !tickPreflightMatches || !checkpointMatches) {
    return ineligibleArm(base, "malformed_evidence_graph");
  }
  if (!completedEvidenceMatches(
    input.evidence,
    result,
    input.evidence.admission
  )) {
    return ineligibleArm(base, "malformed_evidence_graph");
  }
  const admission = input.evidence.admission;
  if (admission.research_worker_outcome === "failed") {
    return ineligibleArm({
      ...base,
      terminal_status: "worker_failed",
      failure_kind: "research_worker_failed"
    }, "worker_or_platform_failure");
  }
  if (admission.research_worker_outcome === "unchanged") {
    return eligibleArm(base, "exact_repeat", 1);
  }
  if (admission.behavior_comparison_status === "unavailable" ||
    !admission.research_behavior_fingerprint_ref ||
    !admission.research_behavior_fingerprint_digest ||
    !input.evidence.fingerprint) {
    return ineligibleArm(base, "behavior_fingerprint_unavailable");
  }
  if (!fingerprintEvidenceMatches(
    input.evidence.fingerprint,
    input.evidence.preflight,
    admission
  )) {
    return ineligibleArm(base, "malformed_evidence_graph");
  }
  if (admission.behavior_comparison_status === "duplicate") {
    return eligibleArm(base, "exact_repeat", 1);
  }
  if (admission.behavior_comparison_status === "distinct") {
    return eligibleArm(base, "distinct_behavior", 0);
  }
  return ineligibleArm(base, "malformed_evidence_graph");
}

function checkpointEvidenceMatches(input: {
  checkpoint: ResearchWorkerCheckpointRecord | undefined;
  preflight: ResearchPreflightCommitmentRecord | undefined;
  researchWorker: ResearchWorkerRecord | undefined;
  admission: CandidateAdmissionDecisionRecord | undefined;
  plannedTickId: string;
  directionRefId: string;
}): boolean {
  const checkpoint = input.checkpoint;
  const preflight = input.preflight;
  const worker = input.researchWorker;
  if (!checkpoint || !preflight || !worker ||
    !researchWorkerCheckpointHasRuntimeShape(checkpoint) ||
    canonicalDigest(researchWorkerCheckpointDigestInput(checkpoint)) !==
      checkpoint.checkpoint_digest || checkpoint.candidate_arena_tick_id !==
      input.plannedTickId || checkpoint.research_preflight_commitment_ref.id !==
      preflight.research_preflight_commitment_id ||
    checkpoint.research_preflight_commitment_digest !==
      preflight.commitment_digest || checkpoint.research_worker_ref.id !==
      worker.research_worker_id || checkpoint.research_direction_ref.id !==
      input.directionRefId || checkpoint.workspace_key !== worker.workspace_key) {
    return false;
  }
  const admissionRef = checkpoint.candidate_admission_decision_ref;
  return input.admission
    ? checkpoint.terminal_status === "completed" &&
      checkpoint.terminal_reason === "admission_recorded" &&
      admissionRef?.id === input.admission.candidate_admission_decision_id
    : admissionRef === undefined && (
      (checkpoint.terminal_status === "completed" &&
        checkpoint.terminal_reason === "finished_without_submission") ||
      (checkpoint.terminal_status === "failed_closed" && [
        "execution_failed",
        "restart_recovery"
      ].includes(checkpoint.terminal_reason))
    );
}

function terminalBeforeAnyEffect(
  evidence: ResearchMemoryControlArmEvidenceInput,
  tick: ResearchMemoryControlTickEvidence | null,
  preflight: ResearchMemoryControlPreflightEvidence | null,
  worker: ResearchMemoryControlWorkerEvidence | null,
  allocation: ResearchMemoryControlAllocationEvidence | null,
  admission: ResearchMemoryControlAdmissionEvidence | null,
  resource: ResearchMemoryControlResourceSummary | null
): boolean {
  return (evidence.terminalStatus === "platform_failed" ||
      evidence.terminalStatus === "interrupted") &&
    tick === null && preflight === null && worker === null &&
    allocation === null && admission === null && !evidence.checkpoint &&
    !evidence.fingerprint &&
    resource !== null && resource.provider_request_total === 0 &&
    resource.runner_command_total === 0 && resource.scenario_count === 0 &&
    resource.elapsed_ms === 0;
}

function exactDirectionResult(
  tick: CandidateArenaTickRecord | undefined,
  plannedTickId: string,
  directionKind: ResearchMemoryControlPairPlan["direction_kind"]
): CandidateArenaTickDirectionResultReadModel | undefined {
  if (!tick) return undefined;
  if (tick.record_kind !== "candidate_arena_tick" || tick.version !== 1 ||
    !nonEmpty(tick.candidate_arena_tick_id) || tick.tick_id !== plannedTickId ||
    !canonicalTimeOrFalse(tick.started_at) ||
    !canonicalTimeOrFalse(tick.completed_at) ||
    Date.parse(tick.completed_at) < Date.parse(tick.started_at) ||
    !["completed", "completed_with_errors", "failed"].includes(tick.status) ||
    tick.authority_status !== "not_live" ||
    !Array.isArray(tick.direction_results) ||
    tick.direction_results.length !== 1 ||
    tick.direction_results[0]?.direction_kind !== directionKind) {
    throw invalidPairDecision();
  }
  return tick.direction_results[0];
}

function assertPreflightSubstitution(
  study: ResearchMemoryControlStudyRecord,
  pairPlan: ResearchMemoryControlPairPlan,
  plannedTickId: string,
  armKind: ResearchMemoryControlArmKind,
  preflight: ResearchPreflightCommitmentRecord | undefined
): void {
  if (!preflight) return;
  if (!researchPreflightCommitmentHasRuntimeShape(preflight) ||
    canonicalDigest(researchPreflightCommitmentDigestInput(preflight)) !==
      preflight.commitment_digest ||
    preflight.candidate_arena_tick_id !== plannedTickId ||
    preflight.research_direction_ref.id !==
      pairPlan.research_direction_ref.id ||
    preflight.source_system_code_ref.id !== study.source.system_code_ref.id ||
    preflight.source_artifact_digest !==
      study.source.research_artifact_closure_digest ||
    preflight.development_policy.submission_limit !==
      study.policy.development_submission_limit_per_worker ||
    preflight.memory_policy?.memory_mode !== (armKind ===
      "released_memory_treatment" ? "released_memory" : "memory_masked") ||
    preflight.memory_policy.control_assignment?.study_ref.id !==
      study.research_memory_control_study_id ||
    preflight.memory_policy.control_assignment?.study_digest !==
      study.study_digest ||
    preflight.memory_policy.control_assignment?.pair_index !==
      pairPlan.pair_index ||
    preflight.memory_policy.control_assignment?.arm_kind !== armKind) {
    throw invalidPairDecision();
  }
}

function tickPreflightEvidenceMatches(
  tick: CandidateArenaTickRecord | undefined,
  result: CandidateArenaTickDirectionResultReadModel | undefined,
  preflight: ResearchPreflightCommitmentRecord | undefined
): boolean {
  if (!tick || !result || !preflight) return true;
  return !((result.research_preflight &&
      result.research_preflight.commitment_id !==
        preflight.research_preflight_commitment_id) ||
    (tick.research_allocation_ref && tick.research_allocation_ref.id !==
      preflight.research_allocation_ref.id) ||
    (tick.research_allocation_digest && tick.research_allocation_digest !==
      preflight.research_allocation_digest));
}

function compactWorkerEvidence(
  study: ResearchMemoryControlStudyRecord,
  pairPlan: ResearchMemoryControlPairPlan,
  worker: ResearchWorkerRecord | undefined,
  preflight: ResearchPreflightCommitmentRecord | undefined
): ResearchMemoryControlWorkerEvidence | null {
  if (!worker) return null;
  const expectedProviderKind = study.research_agent.provider === "codex"
    ? "codex_cli"
    : study.research_agent.provider === "claude_code"
    ? "claude_code"
    : "fixture_only";
  const expectedModel = study.research_agent.model!;
  if (worker.record_kind !== "research_worker" || worker.version !== 1 ||
    !nonEmpty(worker.research_worker_id) ||
    worker.model !== expectedModel ||
    worker.provider_kind !== expectedProviderKind ||
    worker.agent_profile_id !== study.research_agent_profile_id ||
    worker.research_direction_ref.record_kind !== "research_direction" ||
    worker.research_direction_ref.id !== pairPlan.research_direction_ref.id ||
    worker.lifecycle_protocol !== "research_worker_checkpoint_v1" ||
    !canonicalTimeOrFalse(worker.created_at) || worker.status !== "active" ||
    worker.authority_status !== "research_only" ||
    (preflight && preflight.research_worker_ref.id !==
      worker.research_worker_id)) {
    return null;
  }
  return {
    worker_ref: {
      record_kind: "research_worker",
      id: worker.research_worker_id
    },
    agent_profile_id: worker.agent_profile_id,
    provider_kind: worker.provider_kind,
    model: worker.model
  };
}

function compactAllocationEvidence(
  pairPlan: ResearchMemoryControlPairPlan,
  plannedTickId: string,
  allocation: CandidateArenaResearchAllocationRecord | undefined,
  preflight: ResearchPreflightCommitmentRecord | undefined,
  tick: CandidateArenaTickRecord | undefined
): ResearchMemoryControlAllocationEvidence | null {
  if (!allocation) return null;
  const selection = allocation.selected_directions[0];
  if (!candidateArenaResearchAllocationHasRuntimeShape(allocation) ||
    canonicalDigest(candidateArenaResearchAllocationDigestInput(allocation)) !==
      allocation.allocation_digest || allocation.tick_id !== plannedTickId ||
    allocation.allocation_mode !== "explicit" ||
    allocation.allocation_policy_basis.basis_kind !== "explicit_request" ||
    allocation.selected_directions.length !== 1 || !selection ||
    selection.direction_kind !== pairPlan.direction_kind ||
    selection.selection_kind !== "explicit" || selection.priority !== 1 ||
    selection.experiment_budget !== 1 || selection.signal_score !== 0 ||
    (preflight && (preflight.research_allocation_ref.id !==
      allocation.candidate_arena_research_allocation_id ||
      preflight.research_allocation_digest !== allocation.allocation_digest)) ||
    (tick && (tick.research_allocation_ref?.id !==
      allocation.candidate_arena_research_allocation_id ||
      tick.research_allocation_digest !== allocation.allocation_digest))) {
    return null;
  }
  return {
    allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    allocation_digest: allocation.allocation_digest,
    allocation_mode: "explicit",
    allocation_policy_digest: canonicalDigest(allocation.policy),
    direction_kind: selection.direction_kind,
    selection_kind: "explicit",
    experiment_budget: 1
  };
}

function completedEvidenceMatches(
  evidence: ResearchMemoryControlArmEvidenceInput,
  result: CandidateArenaTickDirectionResultReadModel,
  admission: CandidateAdmissionDecisionRecord
): boolean {
  const tick = evidence.tick;
  const preflight = evidence.preflight;
  const preflightReadModel = result.research_preflight;
  if (evidence.terminalStatus !== "completed" ||
    !tick || !preflight || !preflightReadModel ||
    !["created", "duplicate", "quarantined"].includes(result.status) ||
    preflightReadModel.commitment_id !==
      preflight.research_preflight_commitment_id ||
    preflightReadModel.development_submission_count !== 1 ||
    tick.research_allocation_ref?.id !== preflight.research_allocation_ref.id ||
    tick.research_allocation_digest !== preflight.research_allocation_digest) {
    return false;
  }
  return result.status === "created"
    ? admission.status === "admitted"
    : result.status === admission.status;
}

function compactTickEvidence(
  tick: CandidateArenaTickRecord | undefined,
  result: CandidateArenaTickDirectionResultReadModel | undefined
): ResearchMemoryControlTickEvidence | null {
  return tick && result ? {
    tick_ref: {
      record_kind: "candidate_arena_tick",
      id: tick.candidate_arena_tick_id
    },
    tick_id: tick.tick_id,
    tick_digest: canonicalDigest(tick),
    started_at: tick.started_at,
    completed_at: tick.completed_at,
    tick_status: tick.status,
    direction_result_status: result.status
  } : null;
}

function compactPreflightEvidence(
  preflight: ResearchPreflightCommitmentRecord | undefined
): ResearchMemoryControlPreflightEvidence | null {
  return preflight?.memory_policy ? {
    commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: preflight.research_preflight_commitment_id
    },
    commitment_digest: preflight.commitment_digest,
    development_suite_version: preflight.development_policy.suite_version,
    development_suite_digest: preflight.development_policy.suite_digest,
    sealed_suite_version: preflight.sealed_admission_policy.suite_version,
    sealed_generator_version:
      preflight.sealed_admission_policy.generator_version,
    sealed_suite_digest: preflight.sealed_admission_policy.suite_digest,
    sealed_rotation_commitment_digest:
      preflight.sealed_admission_policy.rotation_commitment_digest,
    memory_policy: structuredClone(preflight.memory_policy)
  } : null;
}

function preflightOpportunityProtocolMatches(
  study: ResearchMemoryControlStudyRecord,
  preflight: ResearchPreflightCommitmentRecord | undefined
): boolean {
  const protocol = study.opportunity_protocol;
  return Boolean(preflight &&
    preflight.development_policy.suite_version ===
      protocol.development_suite_version &&
    preflight.development_policy.suite_digest ===
      protocol.development_suite_digest &&
    preflight.sealed_admission_policy.suite_version ===
      protocol.sealed_suite_version &&
    preflight.sealed_admission_policy.generator_version ===
      protocol.sealed_generator_version &&
    preflight.sealed_admission_policy.rotation_commitment_digest ===
      protocol.sealed_rotation_commitment_digest &&
    preflight.sealed_admission_policy.suite_digest ===
      protocol.sealed_suite_digest);
}

function compactAdmissionEvidence(
  admission: CandidateAdmissionDecisionRecord | undefined,
  preflight: ResearchPreflightCommitmentRecord | undefined,
  result: CandidateArenaTickDirectionResultReadModel | undefined
): ResearchMemoryControlAdmissionEvidence | null {
  if (!admission) return null;
  if (!isCandidateAdmissionDecisionConsistent(admission) ||
    (preflight && (
      admission.research_preflight_commitment_ref?.id !==
        preflight.research_preflight_commitment_id ||
      admission.research_preflight_commitment_digest !==
        preflight.commitment_digest
    )) || (result && (
      result.admission_decision_id !==
        admission.candidate_admission_decision_id ||
      result.admission_reason !== admission.reason
    ))) {
    return null;
  }
  return {
    decision_ref: {
      record_kind: "candidate_admission_decision",
      id: admission.candidate_admission_decision_id
    },
    decision_digest: canonicalDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(admission)
    ),
    status: admission.status,
    reason: admission.reason,
    research_worker_outcome: admission.research_worker_outcome,
    behavior_comparison_status:
      admission.behavior_comparison_status ?? null,
    fingerprint_ref: admission.research_behavior_fingerprint_ref
      ? { ...admission.research_behavior_fingerprint_ref }
      : null,
    fingerprint_digest:
      admission.research_behavior_fingerprint_digest ?? null,
    matching_fingerprint_ref:
      admission.matching_research_behavior_fingerprint_ref
        ? { ...admission.matching_research_behavior_fingerprint_ref }
        : null,
    matching_fingerprint_digest:
      admission.matching_research_behavior_fingerprint_digest ?? null
  };
}

function compactResourceSummary(
  efficiency: CandidateArenaResearchEfficiencyReadModel | undefined
): ResearchMemoryControlResourceSummary | null {
  if (!efficiency || [
    efficiency.provider_request_total,
    efficiency.runner_command_total,
    efficiency.scenario_count,
    efficiency.elapsed_ms
  ].some((value) => !Number.isInteger(value) || value < 0) ||
    efficiency.authority_status !== "not_promotion_authority") {
    return null;
  }
  return {
    provider_request_total: efficiency.provider_request_total,
    runner_command_total: efficiency.runner_command_total,
    scenario_count: efficiency.scenario_count,
    elapsed_ms: efficiency.elapsed_ms
  };
}

function compactExplicitResourceSummary(
  summary: ResearchMemoryControlResourceSummary | undefined
): ResearchMemoryControlResourceSummary | null {
  if (!summary || [
    summary.provider_request_total,
    summary.runner_command_total,
    summary.scenario_count,
    summary.elapsed_ms
  ].some((value) => !Number.isInteger(value) || value < 0)) {
    return null;
  }
  return {
    provider_request_total: summary.provider_request_total,
    runner_command_total: summary.runner_command_total,
    scenario_count: summary.scenario_count,
    elapsed_ms: summary.elapsed_ms
  };
}

function fingerprintEvidenceMatches(
  fingerprint: ResearchBehaviorFingerprintRecord,
  preflight: ResearchPreflightCommitmentRecord,
  admission: CandidateAdmissionDecisionRecord
): boolean {
  return researchBehaviorFingerprintHasRuntimeShape(fingerprint) &&
    canonicalDigest(researchBehaviorFingerprintDigestInput(fingerprint)) ===
      fingerprint.fingerprint_digest &&
    fingerprint.research_behavior_fingerprint_id ===
      admission.research_behavior_fingerprint_ref?.id &&
    fingerprint.fingerprint_digest ===
      admission.research_behavior_fingerprint_digest &&
    fingerprint.research_preflight_commitment_ref.id ===
      preflight.research_preflight_commitment_id &&
    fingerprint.research_preflight_commitment_digest ===
      preflight.commitment_digest && fingerprint.system_code_ref.id ===
      admission.system_code_ref.id && fingerprint.system_code_artifact_digest ===
      admission.submitted_artifact_digest &&
    fingerprint.development_suite_version ===
      preflight.development_policy.suite_version &&
    fingerprint.development_suite_digest ===
      preflight.development_policy.suite_digest;
}

function assertTerminalEvidenceShape(
  evidence: ResearchMemoryControlArmEvidenceInput
): void {
  const failed = evidence.terminalStatus === "worker_failed" ||
    evidence.terminalStatus === "platform_failed" ||
    evidence.terminalStatus === "interrupted";
  if (![
    "completed",
    "no_submission",
    "worker_failed",
    "platform_failed",
    "interrupted"
  ].includes(evidence.terminalStatus) || failed !==
    (evidence.failureKind !== undefined) || (evidence.failureKind !== undefined &&
      ![
        "research_worker_failed",
        "provider_failed",
        "runner_failed",
        "restart_interrupted",
        "evidence_reconstruction_failed"
      ].includes(evidence.failureKind))) {
    throw invalidPairDecision();
  }
}

function assertEvidenceTimes(
  evidence: ResearchMemoryControlArmEvidenceInput,
  terminalAt: string
): void {
  const times = [
    evidence.tick?.started_at,
    evidence.tick?.completed_at,
    evidence.preflight?.committed_at,
    evidence.checkpoint?.closed_at,
    evidence.researchWorker?.created_at,
    evidence.allocation?.allocated_at,
    evidence.admission?.decided_at,
    evidence.fingerprint?.created_at
  ].filter((time): time is string => time !== undefined);
  if (times.some((time) => !canonicalTimeOrFalse(time) ||
    Date.parse(time) > Date.parse(terminalAt))) {
    throw invalidPairDecision();
  }
}

function terminalIneligibilityReason(
  evidence: ResearchMemoryControlArmEvidenceInput
): ResearchMemoryControlPairIneligibilityReason | null {
  if (evidence.terminalStatus === "interrupted") {
    return "interrupted_or_unpaired_run";
  }
  if (evidence.terminalStatus === "worker_failed" ||
    evidence.terminalStatus === "platform_failed") {
    return "worker_or_platform_failure";
  }
  if (evidence.terminalStatus === "no_submission") return "no_submission";
  return null;
}

function pairIneligibilityReason(
  released: ResearchMemoryControlArmResult,
  masked: ResearchMemoryControlArmResult
): ResearchMemoryControlPairIneligibilityReason | null {
  const reasons = [released.ineligibility_reason, masked.ineligibility_reason];
  for (const reason of [
    "interrupted_or_unpaired_run",
    "worker_or_platform_failure",
    "no_submission",
    "behavior_fingerprint_unavailable",
    "malformed_evidence_graph",
    "missing_memory_contrast"
  ] as const) {
    if (reasons.includes(reason)) return reason;
  }
  return null;
}

function memoryContrastMatches(
  released: ResearchMemoryControlArmResult,
  masked: ResearchMemoryControlArmResult
): boolean {
  const releasedPolicy = released.preflight_evidence?.memory_policy;
  const maskedPolicy = masked.preflight_evidence?.memory_policy;
  return Boolean(releasedPolicy && maskedPolicy &&
    releasedPolicy.available_memory_item_count > 0 &&
    releasedPolicy.available_memory_item_count ===
      maskedPolicy.available_memory_item_count &&
    releasedPolicy.memory_source_digest === maskedPolicy.memory_source_digest);
}

function pairedExperimentEvidenceMatches(
  released: ResearchMemoryControlArmResult,
  masked: ResearchMemoryControlArmResult,
  directionKind: ResearchMemoryControlPairPlan["direction_kind"]
): boolean {
  const releasedWorker = released.worker_evidence;
  const maskedWorker = masked.worker_evidence;
  const releasedAllocation = released.allocation_evidence;
  const maskedAllocation = masked.allocation_evidence;
  const releasedPreflight = released.preflight_evidence;
  const maskedPreflight = masked.preflight_evidence;
  return Boolean(releasedWorker && maskedWorker && releasedAllocation &&
    maskedAllocation && releasedPreflight && maskedPreflight &&
    releasedWorker.worker_ref.id === maskedWorker.worker_ref.id &&
    releasedWorker.agent_profile_id === maskedWorker.agent_profile_id &&
    releasedWorker.provider_kind === maskedWorker.provider_kind &&
    releasedWorker.model === maskedWorker.model &&
    releasedAllocation.allocation_mode === maskedAllocation.allocation_mode &&
    releasedAllocation.allocation_policy_digest ===
      maskedAllocation.allocation_policy_digest &&
    releasedAllocation.direction_kind === directionKind &&
    maskedAllocation.direction_kind === directionKind &&
    releasedAllocation.selection_kind === maskedAllocation.selection_kind &&
    releasedAllocation.experiment_budget ===
      maskedAllocation.experiment_budget &&
    releasedPreflight.development_suite_version ===
      maskedPreflight.development_suite_version &&
    releasedPreflight.development_suite_digest ===
      maskedPreflight.development_suite_digest &&
    releasedPreflight.sealed_suite_version ===
      maskedPreflight.sealed_suite_version &&
    releasedPreflight.sealed_generator_version ===
      maskedPreflight.sealed_generator_version &&
    releasedPreflight.sealed_suite_digest ===
      maskedPreflight.sealed_suite_digest &&
    releasedPreflight.sealed_rotation_commitment_digest ===
      maskedPreflight.sealed_rotation_commitment_digest);
}

function initialStartSkewMs(
  released: ResearchMemoryControlArmResult,
  masked: ResearchMemoryControlArmResult
): number | null {
  const releasedStartedAt = released.tick_evidence?.started_at;
  const maskedStartedAt = masked.tick_evidence?.started_at;
  return releasedStartedAt && maskedStartedAt
    ? Math.abs(Date.parse(releasedStartedAt) - Date.parse(maskedStartedAt))
    : null;
}

function eligibleArm(
  base: Omit<ResearchMemoryControlArmResult,
    "observation" | "exact_repeat_indicator" | "ineligibility_reason">,
  observation: "exact_repeat" | "distinct_behavior",
  indicator: 0 | 1
): ResearchMemoryControlArmResult {
  return {
    ...base,
    observation,
    exact_repeat_indicator: indicator,
    ineligibility_reason: null
  };
}

function ineligibleArm(
  base: Omit<ResearchMemoryControlArmResult,
    "observation" | "exact_repeat_indicator" | "ineligibility_reason">,
  reason: ResearchMemoryControlPairIneligibilityReason
): ResearchMemoryControlArmResult {
  return {
    ...base,
    observation: "ineligible",
    exact_repeat_indicator: null,
    ineligibility_reason: reason
  };
}

function markArmIneligible(
  arm: ResearchMemoryControlArmResult,
  reason: ResearchMemoryControlPairIneligibilityReason
): ResearchMemoryControlArmResult {
  return {
    ...arm,
    observation: "ineligible",
    exact_repeat_indicator: null,
    ineligibility_reason: reason
  };
}

function assertPairOutcomes(
  study: ResearchMemoryControlStudyRecord,
  pairs: ResearchMemoryControlPairOutcomeRecord[],
  adjudicatedAt: string
): void {
  for (let index = 0; index < study.pair_plans.length; index += 1) {
    const plan = study.pair_plans[index]!;
    const pair = pairs[index];
    if (!pair || !researchMemoryControlPairOutcomeHasRuntimeShape(pair) ||
      canonicalDigest(researchMemoryControlPairOutcomeDigestInput(pair)) !==
        pair.pair_outcome_digest || pair.pair_index !== index + 1 ||
      pair.research_memory_control_pair_outcome_id !==
        researchMemoryControlPairOutcomeId(
          study.research_memory_control_study_id,
          index + 1
        ) || pair.study_ref.id !== study.research_memory_control_study_id ||
      pair.study_digest !== study.study_digest || pair.pair_plan_digest !==
        canonicalDigest(plan) || pair.research_direction_ref.id !==
        plan.research_direction_ref.id || pair.direction_kind !==
        plan.direction_kind || pair.released_memory.planned_tick_id !==
        plan.released_memory_treatment.tick_id ||
      pair.memory_masked.planned_tick_id !==
        plan.memory_masked_control.tick_id ||
      !armOpportunityEvidenceMatchesStudy(pair.released_memory, study) ||
      !armOpportunityEvidenceMatchesStudy(pair.memory_masked, study) ||
      Date.parse(pair.terminal_at) > Date.parse(adjudicatedAt)) {
      throw invalidStudyOutcomeDecision();
    }
  }
}

function armOpportunityEvidenceMatchesStudy(
  arm: ResearchMemoryControlArmResult,
  study: ResearchMemoryControlStudyRecord
): boolean {
  const evidence = arm.preflight_evidence;
  const protocol = study.opportunity_protocol;
  if (!evidence) {
    return arm.ineligibility_reason === "malformed_evidence_graph" ||
      (arm.terminal_status === "interrupted" &&
        arm.ineligibility_reason === "interrupted_or_unpaired_run") ||
      (arm.terminal_status === "platform_failed" &&
        arm.ineligibility_reason === "worker_or_platform_failure");
  }
  const matches = evidence.development_suite_version ===
    protocol.development_suite_version && evidence.development_suite_digest ===
    protocol.development_suite_digest && evidence.sealed_suite_digest ===
    protocol.sealed_suite_digest && evidence.sealed_suite_version ===
    protocol.sealed_suite_version && evidence.sealed_generator_version ===
    protocol.sealed_generator_version &&
    evidence.sealed_rotation_commitment_digest ===
      protocol.sealed_rotation_commitment_digest;
  return matches || arm.ineligibility_reason === "malformed_evidence_graph";
}

function assertExactStudy(
  study: ResearchMemoryControlStudyRecord,
  errorFactory: () => Error
): void {
  if (!researchMemoryControlStudyHasRuntimeShape(study) ||
    canonicalDigest(researchMemoryControlStudyDigestInput(study)) !==
      study.study_digest) {
    throw errorFactory();
  }
}

function positivePairIndex(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 30) {
    throw invalidPairDecision();
  }
  return Number(value);
}

function canonicalTime(
  value: unknown,
  errorFactory: () => Error
): string {
  const time = canonicalString(value, errorFactory);
  if (!canonicalTimeOrFalse(time)) throw errorFactory();
  return time;
}

function canonicalTimeOrFalse(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    new Date(value).toISOString() === value;
}

function canonicalString(
  value: unknown,
  errorFactory: () => Error
): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw errorFactory();
  }
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function invalidPairDecision(): ResearchMemoryControlPairOutcomeDecisionError {
  return new ResearchMemoryControlPairOutcomeDecisionError();
}

function invalidStudyOutcomeDecision():
ResearchMemoryControlStudyOutcomeDecisionError {
  return new ResearchMemoryControlStudyOutcomeDecisionError();
}
