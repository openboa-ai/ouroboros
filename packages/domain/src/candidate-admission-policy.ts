export type CandidateAdmissionResearchWorkerOutcome = "changed" | "unchanged" | "failed";

export type CandidateAdmissionExperimentStatus = "evaluated" | "failed";

export type CandidateAdmissionEvaluationStatus =
  | "accepted"
  | "quarantined_for_review"
  | "disqualified";

export type CandidateAdmissionEvidenceDisposition =
  | "not_counted"
  | "counted"
  | "quarantined_for_review";

export type CandidateAdmissionStatus = "admitted" | "duplicate" | "quarantined";

export type CandidateAdmissionPaperHandoffConformanceStatus = "passed" | "rejected";

export type CandidateAdmissionBehaviorComparisonStatus =
  | "distinct"
  | "duplicate"
  | "unavailable";

export type CandidateAdmissionReason =
  | "evaluation_accepted"
  | "research_worker_failed"
  | "no_candidate_change"
  | "experiment_failed"
  | "evaluation_disqualified"
  | "evaluation_quarantined"
  | "evidence_already_counted"
  | "evidence_quarantined"
  | "paper_handoff_conformance_failed"
  | "behavior_duplicate"
  | "behavior_fingerprint_unavailable";

export interface CandidateAdmissionPolicyInput {
  research_worker_outcome: CandidateAdmissionResearchWorkerOutcome;
  experiment_status: CandidateAdmissionExperimentStatus;
  evaluation_status: CandidateAdmissionEvaluationStatus;
  evidence_disposition: CandidateAdmissionEvidenceDisposition;
  paper_handoff_conformance_status?: CandidateAdmissionPaperHandoffConformanceStatus;
  behavior_comparison_status?: CandidateAdmissionBehaviorComparisonStatus;
}

export interface CandidateAdmissionArtifactComparisonInput {
  research_worker_failed: boolean;
  source_artifact_digest: string;
  submitted_artifact_digest: string;
}

export interface CandidateAdmissionDecision {
  status: CandidateAdmissionStatus;
  reason: CandidateAdmissionReason;
  runnable_paper_handoff: boolean;
  authority_status: "not_live";
}

interface CandidateAdmissionRecordRef {
  record_kind: string;
  id: string;
}

export interface CandidateAdmissionDecisionRecord
  extends CandidateAdmissionPolicyInput,
    CandidateAdmissionDecision {
  record_kind: "candidate_admission_decision";
  version: 1;
  candidate_admission_decision_id: string;
  research_preflight_commitment_ref?: CandidateAdmissionRecordRef;
  research_preflight_commitment_digest?: string;
  source_system_code_ref: CandidateAdmissionRecordRef;
  system_code_ref: CandidateAdmissionRecordRef;
  experiment_run_ref: CandidateAdmissionRecordRef;
  trading_evaluation_result_ref: CandidateAdmissionRecordRef;
  research_finding_ref: CandidateAdmissionRecordRef;
  source_artifact_digest: string;
  submitted_artifact_digest: string;
  paper_trading_handoff_conformance_ref?: CandidateAdmissionRecordRef;
  paper_trading_handoff_conformance_digest?: string;
  research_behavior_fingerprint_ref?: CandidateAdmissionRecordRef;
  research_behavior_fingerprint_digest?: string;
  matching_research_behavior_fingerprint_ref?: CandidateAdmissionRecordRef;
  matching_research_behavior_fingerprint_digest?: string;
  decided_at: string;
}

export function deriveCandidateAdmissionResearchWorkerOutcome(
  input: CandidateAdmissionArtifactComparisonInput
): CandidateAdmissionResearchWorkerOutcome {
  if (input.research_worker_failed) {
    return "failed";
  }
  return input.source_artifact_digest === input.submitted_artifact_digest
    ? "unchanged"
    : "changed";
}

export function decideCandidateAdmission(
  input: CandidateAdmissionPolicyInput
): CandidateAdmissionDecision {
  if (input.research_worker_outcome === "failed") {
    return rejected("quarantined", "research_worker_failed");
  }
  if (input.research_worker_outcome === "unchanged") {
    return rejected("duplicate", "no_candidate_change");
  }
  if (input.experiment_status === "failed") {
    return rejected("quarantined", "experiment_failed");
  }
  if (input.paper_handoff_conformance_status === "rejected") {
    return rejected("quarantined", "paper_handoff_conformance_failed");
  }
  if (input.evaluation_status === "quarantined_for_review") {
    return rejected("quarantined", "evaluation_quarantined");
  }
  if (input.evaluation_status === "disqualified") {
    return rejected("quarantined", "evaluation_disqualified");
  }
  if (input.evidence_disposition === "counted") {
    return rejected("quarantined", "evidence_already_counted");
  }
  if (input.evidence_disposition === "quarantined_for_review") {
    return rejected("quarantined", "evidence_quarantined");
  }
  if (input.behavior_comparison_status === "unavailable") {
    return rejected("quarantined", "behavior_fingerprint_unavailable");
  }
  if (input.behavior_comparison_status === "duplicate") {
    return rejected("duplicate", "behavior_duplicate");
  }
  return {
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    authority_status: "not_live"
  };
}

export function isCandidateAdmissionDecisionConsistent(
  record: CandidateAdmissionDecisionRecord
): boolean {
  const expected = decideCandidateAdmission(record);
  const conformanceFields = [
    record.paper_handoff_conformance_status,
    record.paper_trading_handoff_conformance_ref,
    record.paper_trading_handoff_conformance_digest
  ];
  const conformanceFieldCount = conformanceFields.filter((value) => value !== undefined).length;
  const conformanceLinkageIsConsistent = conformanceFieldCount === 0 || (
    conformanceFieldCount === conformanceFields.length &&
    (record.paper_handoff_conformance_status === "passed" ||
      record.paper_handoff_conformance_status === "rejected") &&
    record.paper_trading_handoff_conformance_ref?.record_kind ===
      "paper_trading_handoff_conformance" &&
    typeof record.paper_trading_handoff_conformance_ref.id === "string" &&
    record.paper_trading_handoff_conformance_ref.id.length > 0 &&
    typeof record.paper_trading_handoff_conformance_digest === "string" &&
    record.paper_trading_handoff_conformance_digest.length > 0
  );
  const artifactComparisonIsConsistent = record.research_worker_outcome === "failed" ||
    record.research_worker_outcome === deriveCandidateAdmissionResearchWorkerOutcome({
      research_worker_failed: false,
      source_artifact_digest: record.source_artifact_digest,
      submitted_artifact_digest: record.submitted_artifact_digest
    });
  return conformanceLinkageIsConsistent &&
    behaviorFingerprintLinkageIsConsistent(record) &&
    artifactComparisonIsConsistent &&
    record.status === expected.status &&
    record.reason === expected.reason &&
    record.runnable_paper_handoff === expected.runnable_paper_handoff &&
    record.authority_status === expected.authority_status;
}

function behaviorFingerprintLinkageIsConsistent(
  record: CandidateAdmissionDecisionRecord
): boolean {
  const currentRef = record.research_behavior_fingerprint_ref;
  const currentDigest = record.research_behavior_fingerprint_digest;
  const matchingRef = record.matching_research_behavior_fingerprint_ref;
  const matchingDigest = record.matching_research_behavior_fingerprint_digest;
  if (record.behavior_comparison_status === undefined) {
    return currentRef === undefined && currentDigest === undefined &&
      matchingRef === undefined && matchingDigest === undefined;
  }
  if (record.behavior_comparison_status === "unavailable") {
    return currentRef === undefined && currentDigest === undefined &&
      matchingRef === undefined && matchingDigest === undefined;
  }
  const currentIsValid = currentRef?.record_kind === "research_behavior_fingerprint" &&
    typeof currentRef.id === "string" && currentRef.id.length > 0 &&
    typeof currentDigest === "string" && currentDigest.length > 0;
  if (record.behavior_comparison_status === "distinct") {
    return currentIsValid && matchingRef === undefined && matchingDigest === undefined;
  }
  if (record.behavior_comparison_status === "duplicate") {
    return currentIsValid &&
      matchingRef?.record_kind === "research_behavior_fingerprint" &&
      typeof matchingRef.id === "string" && matchingRef.id.length > 0 &&
      matchingRef.id !== currentRef?.id &&
      typeof matchingDigest === "string" && matchingDigest.length > 0 &&
      matchingDigest === currentDigest;
  }
  return false;
}

function rejected(
  status: Exclude<CandidateAdmissionStatus, "admitted">,
  reason: Exclude<CandidateAdmissionReason, "evaluation_accepted">
): CandidateAdmissionDecision {
  return {
    status,
    reason,
    runnable_paper_handoff: false,
    authority_status: "not_live"
  };
}
