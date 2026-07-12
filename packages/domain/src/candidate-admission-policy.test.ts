import { describe, expect, it } from "vitest";
import {
  decideCandidateAdmission,
  deriveCandidateAdmissionResearchWorkerOutcome,
  isCandidateAdmissionDecisionConsistent,
  type CandidateAdmissionDecisionRecord
} from "./candidate-admission-policy";

describe("candidate admission policy", () => {
  it("derives changed or unchanged from artifact digests instead of worker self-report", () => {
    expect(deriveCandidateAdmissionResearchWorkerOutcome({
      research_worker_failed: false,
      source_artifact_digest: "sha256:same",
      submitted_artifact_digest: "sha256:same"
    })).toBe("unchanged");
    expect(deriveCandidateAdmissionResearchWorkerOutcome({
      research_worker_failed: false,
      source_artifact_digest: "sha256:source",
      submitted_artifact_digest: "sha256:submitted"
    })).toBe("changed");
    expect(deriveCandidateAdmissionResearchWorkerOutcome({
      research_worker_failed: true,
      source_artifact_digest: "sha256:source",
      submitted_artifact_digest: "sha256:submitted"
    })).toBe("failed");
  });

  it("admits an externally accepted changed candidate", () => {
    expect(decideCandidateAdmission({
      research_worker_outcome: "changed",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted"
    })).toEqual({
      status: "admitted",
      reason: "evaluation_accepted",
      runnable_paper_handoff: true,
      authority_status: "not_live"
    });
  });

  it("admits a new runnable handoff only with passed conformance", () => {
    expect(decideCandidateAdmission({
      research_worker_outcome: "changed",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted",
      paper_handoff_conformance_status: "passed"
    })).toEqual({
      status: "admitted",
      reason: "evaluation_accepted",
      runnable_paper_handoff: true,
      authority_status: "not_live"
    });

    expect(decideCandidateAdmission({
      research_worker_outcome: "changed",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted",
      paper_handoff_conformance_status: "rejected"
    })).toEqual({
      status: "quarantined",
      reason: "paper_handoff_conformance_failed",
      runnable_paper_handoff: false,
      authority_status: "not_live"
    });
  });

  it("requires all-or-none exact conformance linkage on new admission records", () => {
    const legacy = admissionRecord();
    expect(isCandidateAdmissionDecisionConsistent(legacy)).toBe(true);

    const linked: CandidateAdmissionDecisionRecord = {
      ...legacy,
      paper_handoff_conformance_status: "passed",
      paper_trading_handoff_conformance_ref: {
        record_kind: "paper_trading_handoff_conformance",
        id: "paper-handoff-conformance-system-code-001"
      },
      paper_trading_handoff_conformance_digest: "sha256:conformance"
    };
    expect(isCandidateAdmissionDecisionConsistent(linked)).toBe(true);
    expect(isCandidateAdmissionDecisionConsistent({
      ...linked,
      paper_trading_handoff_conformance_digest: undefined
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);
    expect(isCandidateAdmissionDecisionConsistent({
      ...linked,
      paper_handoff_conformance_status: "rejected"
    })).toBe(false);
  });

  it.each([
    ["failed", "evaluated", "accepted", "not_counted", "research_worker_failed"],
    ["changed", "failed", "accepted", "not_counted", "experiment_failed"],
    ["changed", "evaluated", "quarantined_for_review", "not_counted", "evaluation_quarantined"],
    ["changed", "evaluated", "disqualified", "quarantined_for_review", "evaluation_disqualified"],
    ["changed", "evaluated", "accepted", "counted", "evidence_already_counted"],
    ["changed", "evaluated", "accepted", "quarantined_for_review", "evidence_quarantined"]
  ] as const)(
    "quarantines invalid research output with reason %s/%s/%s/%s",
    (
      research_worker_outcome,
      experiment_status,
      evaluation_status,
      evidence_disposition,
      reason
    ) => {
      expect(decideCandidateAdmission({
        research_worker_outcome,
        experiment_status,
        evaluation_status,
        evidence_disposition
      })).toEqual({
        status: "quarantined",
        reason,
        runnable_paper_handoff: false,
        authority_status: "not_live"
      });
    }
  );

  it("classifies unchanged output as duplicate before evaluation status can admit it", () => {
    expect(decideCandidateAdmission({
      research_worker_outcome: "unchanged",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted"
    })).toEqual({
      status: "duplicate",
      reason: "no_candidate_change",
      runnable_paper_handoff: false,
      authority_status: "not_live"
    });
  });

  it.each([
    ["distinct", "admitted", "evaluation_accepted", true],
    ["duplicate", "duplicate", "behavior_duplicate", false],
    ["unavailable", "quarantined", "behavior_fingerprint_unavailable", false]
  ] as const)(
    "applies %s behavior comparison only after otherwise valid admission evidence",
    (behaviorStatus, status, reason, runnablePaperHandoff) => {
      expect(decideCandidateAdmission({
        research_worker_outcome: "changed",
        experiment_status: "evaluated",
        evaluation_status: "accepted",
        evidence_disposition: "not_counted",
        paper_handoff_conformance_status: "passed",
        behavior_comparison_status: behaviorStatus
      } as any)).toEqual({
        status,
        reason,
        runnable_paper_handoff: runnablePaperHandoff,
        authority_status: "not_live"
      });
    }
  );

  it.each([
    ["failed", "evaluated", "accepted", "not_counted", "research_worker_failed"],
    ["changed", "failed", "accepted", "not_counted", "experiment_failed"],
    ["changed", "evaluated", "disqualified", "quarantined_for_review", "evaluation_disqualified"],
    ["changed", "evaluated", "accepted", "counted", "evidence_already_counted"]
  ] as const)(
    "keeps causal safety reason %s/%s/%s/%s ahead of behavior duplicate",
    (
      researchWorkerOutcome,
      experimentStatus,
      evaluationStatus,
      evidenceDisposition,
      reason
    ) => {
      expect(decideCandidateAdmission({
        research_worker_outcome: researchWorkerOutcome,
        experiment_status: experimentStatus,
        evaluation_status: evaluationStatus,
        evidence_disposition: evidenceDisposition,
        behavior_comparison_status: "duplicate"
      } as any)).toEqual(expect.objectContaining({
        status: "quarantined",
        reason
      }));
    }
  );

  it("requires exact all-or-none behavior fingerprint linkage", () => {
    const distinct = behaviorAdmissionRecord("distinct");
    expect(isCandidateAdmissionDecisionConsistent(distinct)).toBe(true);
    expect(isCandidateAdmissionDecisionConsistent({
      ...distinct,
      research_behavior_fingerprint_digest: undefined
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);
    expect(isCandidateAdmissionDecisionConsistent({
      ...distinct,
      matching_research_behavior_fingerprint_ref: {
        record_kind: "research_behavior_fingerprint",
        id: "unexpected-match"
      },
      matching_research_behavior_fingerprint_digest: "sha256:unexpected"
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);

    const duplicate = behaviorAdmissionRecord("duplicate");
    expect(isCandidateAdmissionDecisionConsistent(duplicate)).toBe(true);
    expect(isCandidateAdmissionDecisionConsistent({
      ...duplicate,
      matching_research_behavior_fingerprint_digest: "sha256:different"
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);
    expect(isCandidateAdmissionDecisionConsistent({
      ...duplicate,
      matching_research_behavior_fingerprint_ref:
        duplicate.research_behavior_fingerprint_ref
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);

    const unavailable = behaviorAdmissionRecord("unavailable");
    expect(isCandidateAdmissionDecisionConsistent(unavailable)).toBe(true);
    expect(isCandidateAdmissionDecisionConsistent({
      ...unavailable,
      research_behavior_fingerprint_ref: distinct.research_behavior_fingerprint_ref,
      research_behavior_fingerprint_digest: distinct.research_behavior_fingerprint_digest
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);

    expect(isCandidateAdmissionDecisionConsistent({
      ...admissionRecord(),
      research_behavior_fingerprint_ref: distinct.research_behavior_fingerprint_ref,
      research_behavior_fingerprint_digest: distinct.research_behavior_fingerprint_digest
    } as unknown as CandidateAdmissionDecisionRecord)).toBe(false);
  });
});

function behaviorAdmissionRecord(
  behaviorStatus: "distinct" | "duplicate" | "unavailable"
): CandidateAdmissionDecisionRecord {
  const input = {
    research_worker_outcome: "changed" as const,
    experiment_status: "evaluated" as const,
    evaluation_status: "accepted" as const,
    evidence_disposition: "not_counted" as const,
    behavior_comparison_status: behaviorStatus
  };
  const decision = decideCandidateAdmission(input as any);
  return {
    ...admissionRecord(),
    ...input,
    ...decision,
    ...(behaviorStatus === "unavailable"
      ? {}
      : {
          research_behavior_fingerprint_ref: {
            record_kind: "research_behavior_fingerprint",
            id: "behavior-fingerprint-current"
          },
          research_behavior_fingerprint_digest: "sha256:behavior"
        }),
    ...(behaviorStatus === "duplicate"
      ? {
          matching_research_behavior_fingerprint_ref: {
            record_kind: "research_behavior_fingerprint",
            id: "behavior-fingerprint-prior"
          },
          matching_research_behavior_fingerprint_digest: "sha256:behavior"
        }
      : {})
  } as CandidateAdmissionDecisionRecord;
}

function admissionRecord(): CandidateAdmissionDecisionRecord {
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: "candidate-admission-decision-001",
    source_system_code_ref: { record_kind: "system_code", id: "system-code-source" },
    system_code_ref: { record_kind: "system_code", id: "system-code-001" },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-001" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "trading-evaluation-result-001"
    },
    research_finding_ref: { record_kind: "research_finding", id: "research-finding-001" },
    source_artifact_digest: "sha256:source",
    submitted_artifact_digest: "sha256:submitted",
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    decided_at: "2026-07-12T10:00:02.000Z",
    authority_status: "not_live"
  };
}
