import { describe, expect, it } from "vitest";
import {
  decideCandidateAdmission,
  deriveCandidateAdmissionResearchWorkerOutcome
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
});
