import { describe, expect, it } from "vitest";
import {
  candidateArenaTickHasRuntimeShape,
  type CandidateArenaTickRecord
} from "./index";

describe("candidateArenaTickHasRuntimeShape", () => {
  it("accepts the canonical bound terminal tick shape", () => {
    expect(candidateArenaTickHasRuntimeShape(tickFixture())).toBe(true);
  });

  it("rejects malformed direction, compact conformance, and no-submission shapes", () => {
    const missingFailure = tickFixture();
    delete missingFailure.direction_results[0]!.error;
    expect(candidateArenaTickHasRuntimeShape(missingFailure)).toBe(false);

    const compactExtra = tickFixture();
    compactExtra.direction_results[0] = {
      direction_kind: "trend_following",
      status: "created",
      candidate_id: "candidate-1",
      paper_handoff_conformance: {
        conformance_id: "conformance-1",
        status: "passed",
        reason: "passed",
        authority_status: "research_only",
        extra: true
      } as never
    };
    expect(candidateArenaTickHasRuntimeShape(compactExtra)).toBe(false);

    const contradictoryNoSubmission = tickFixture();
    contradictoryNoSubmission.direction_results[0] = {
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "No submission selected.",
      candidate_id: "forged-candidate"
    };
    expect(candidateArenaTickHasRuntimeShape(contradictoryNoSubmission)).toBe(false);
  });

  it("preserves LocalStore rejection of whitespace-only identifiers and evidence", () => {
    const whitespaceId = tickFixture();
    whitespaceId.candidate_arena_tick_id = "   ";
    expect(candidateArenaTickHasRuntimeShape(whitespaceId)).toBe(false);

    const whitespaceError = tickFixture();
    whitespaceError.direction_results[0]!.error = " \t ";
    expect(candidateArenaTickHasRuntimeShape(whitespaceError)).toBe(false);

    const whitespaceAllocationDigest = tickFixture();
    whitespaceAllocationDigest.research_allocation_digest = "   ";
    expect(candidateArenaTickHasRuntimeShape(whitespaceAllocationDigest)).toBe(false);
  });

  it("requires the historical strict digest format only for compact egress policy", () => {
    const malformedPolicyDigest = tickFixture();
    malformedPolicyDigest.direction_results[0] = {
      direction_kind: "trend_following",
      status: "created",
      candidate_id: "candidate-1",
      paper_handoff_conformance: {
        conformance_id: "conformance-1",
        status: "passed",
        reason: "passed",
        candidate_egress_attestation: {
          attestation_id: "attestation-1",
          verification_status: "verified",
          enforcement_result: "enforced",
          network_policy_digest: "historical-non-sha-digest",
          denial_summary: {
            required_probe_count: 3,
            start_denied_probe_count: 3,
            end_denied_probe_count: 3,
            unexpected_allow_count: 0
          },
          authority_status: "research_only"
        },
        authority_status: "research_only"
      }
    };
    expect(candidateArenaTickHasRuntimeShape(malformedPolicyDigest)).toBe(false);

    const historicalAllocationDigest = tickFixture();
    historicalAllocationDigest.research_allocation_digest = "historical-digest-v0";
    expect(candidateArenaTickHasRuntimeShape(historicalAllocationDigest)).toBe(true);
  });

  it.each([
    ["malformed legacy start", "started_at", "legacy-start-timestamp"],
    ["noncanonical start", "started_at", "2026-07-23T00:00:00Z"],
    ["noncanonical completion", "completed_at", "2026-07-23T00:00:01Z"]
  ] as const)("rejects %s", (_label, field, timestamp) => {
    const malformed = tickFixture();
    malformed[field] = timestamp;

    expect(candidateArenaTickHasRuntimeShape(malformed)).toBe(false);
  });

  it("rejects completion before start", () => {
    const reversed = tickFixture();
    reversed.started_at = "2026-07-23T00:00:02.000Z";
    reversed.completed_at = "2026-07-23T00:00:01.000Z";
    expect(candidateArenaTickHasRuntimeShape(reversed)).toBe(false);
  });

  it("accepts the equal-time boundary", () => {
    const equal = tickFixture();
    equal.completed_at = equal.started_at;
    expect(candidateArenaTickHasRuntimeShape(equal)).toBe(true);
  });
});

function tickFixture(): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: "candidate-arena-tick-1",
    tick_id: "tick-1",
    started_at: "2026-07-23T00:00:00.000Z",
    completed_at: "2026-07-23T00:00:01.000Z",
    status: "completed_with_errors",
    created_candidate_refs: [],
    direction_results: [{
      direction_kind: "trend_following",
      status: "failed",
      error: "Research failed closed."
    }],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-1"
    },
    research_allocation_digest: `sha256:${"1".repeat(64)}`,
    authority_status: "not_live"
  };
}
