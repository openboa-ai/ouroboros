import { describe, expect, it } from "vitest";
import {
  candidateArenaTickAuthorityGraphHasRuntimeShape,
  candidateArenaTickHasRuntimeShape,
  type CandidateArenaTickRecord
} from "./index";

describe("candidateArenaTickHasRuntimeShape", () => {
  it("accepts the canonical bound terminal tick shape", () => {
    expect(candidateArenaTickHasRuntimeShape(tickFixture())).toBe(true);
  });

  it.each([
    ["record id", "candidate_arena_tick_id"],
    ["tick id", "tick_id"]
  ] as const)("accepts a canonical 200-character %s and rejects longer identifiers", (
    _label,
    field
  ) => {
    const exactBoundary = tickFixture();
    exactBoundary[field] = "a".repeat(200);
    expect(candidateArenaTickHasRuntimeShape(exactBoundary)).toBe(true);

    for (const length of [201, 500, 501]) {
      const overBoundary = tickFixture();
      overBoundary[field] = "a".repeat(length);
      expect(candidateArenaTickHasRuntimeShape(overBoundary),
        `${field}:${length}`).toBe(false);
    }
  });

  it.each([
    ["leading dash", "-tick"],
    ["trailing dash", "tick-"],
    ["space", "tick drift"],
    ["unicode", "tick-δ"]
  ])("rejects a noncanonical %s identifier", (_label, identifier) => {
    const tick = tickFixture();
    tick.tick_id = identifier;

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(false);
  });

  it("accepts a 200-character compact commitment id and rejects longer ids", () => {
    const exactBoundary = createdTickFixture();
    exactBoundary.direction_results[0]!.research_preflight!.commitment_id =
      "c".repeat(200);
    expect(candidateArenaTickHasRuntimeShape(exactBoundary)).toBe(true);

    for (const length of [201, 500, 501]) {
      const overBoundary = createdTickFixture();
      overBoundary.direction_results[0]!.research_preflight!.commitment_id =
        "c".repeat(length);
      expect(candidateArenaTickHasRuntimeShape(overBoundary),
        `commitment_id:${length}`).toBe(false);
    }
  });

  it.each([
    {
      name: "source candidate id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.source_candidate = {
          source_kind: "explicit_candidate",
          candidate_id: id,
          display_name: "Candidate",
          authority_status: "not_live"
        };
      }
    },
    {
      name: "created candidate ref",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.created_candidate_refs[0]!.id = id;
      }
    },
    {
      name: "direction candidate id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.direction_results[0]!.candidate_id = id;
      }
    },
    {
      name: "admission decision id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.direction_results[0]!.admission_decision_id = id;
      }
    },
    {
      name: "conformance id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.direction_results[0]!.paper_handoff_conformance!.conformance_id = id;
      }
    },
    {
      name: "egress attestation id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.direction_results[0]!.paper_handoff_conformance!
          .candidate_egress_attestation = {
            attestation_id: id,
            verification_status: "verified",
            enforcement_result: "enforced",
            network_policy_digest: `sha256:${"e".repeat(64)}`,
            denial_summary: {
              required_probe_count: 7,
              start_denied_probe_count: 7,
              end_denied_probe_count: 7,
              unexpected_allow_count: 0
            },
            authority_status: "research_only"
          };
      }
    },
    {
      name: "research allocation ref",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.research_allocation_ref!.id = id;
      }
    },
    {
      name: "paper continuation candidate id",
      mutate: (tick: CandidateArenaTickRecord, id: string) => {
        tick.paper_trading_continuation = {
          status: "started",
          command_kind: "trading_run.start",
          selected_candidate_id: id,
          authority_status: "not_live"
        };
      }
    }
  ])("bounds nested projection identifier: $name", ({ mutate }) => {
    const exactBoundary = createdTickFixture();
    mutate(exactBoundary, "a".repeat(200));
    expect(candidateArenaTickHasRuntimeShape(exactBoundary)).toBe(true);

    for (const length of [201, 500, 501]) {
      const overBoundary = createdTickFixture();
      mutate(overBoundary, "a".repeat(length));
      expect(candidateArenaTickHasRuntimeShape(overBoundary), `${length}`)
        .toBe(false);
    }
  });

  it.each([
    ["candidate", (result: any) => { result.candidate_id = "candidate-forged"; }],
    ["admission", (result: any) => {
      result.admission_decision_id = "admission-forged";
      result.admission_reason = "research_worker_failed";
    }],
    ["admission ref", (result: any) => {
      result.candidate_admission_decision_ref = {
        record_kind: "candidate_admission_decision",
        id: "admission-forged"
      };
    }],
    ["admission digest", (result: any) => {
      result.admission_decision_digest = `sha256:${"a".repeat(64)}`;
    }],
    ["admission status", (result: any) => {
      result.admission_status = "admitted";
    }],
    ["net revenue", (result: any) => { result.net_revenue_usdt = 1; }],
    ["handoff", (result: any) => {
      result.paper_handoff_conformance = {
        conformance_id: "conformance-forged",
        status: "rejected",
        reason: "runner_crash",
        authority_status: "research_only"
      };
    }]
  ])("rejects a failed result carrying contradictory %s evidence", (
    _label,
    mutate
  ) => {
    const tick = tickFixture();
    mutate(tick.direction_results[0]);

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(false);
  });

  it("accepts lifecycle-only evidence on the exact failed result variant", () => {
    const tick = tickFixture();
    tick.direction_results[0] = {
      direction_kind: "trend_following",
      status: "failed",
      agent_provider: "fixture",
      agent_model: "fixture-model",
      finding: "Research stopped before candidate materialization.",
      error: "Research failed closed.",
      research_efficiency: {
        provider_request_total: 1,
        runner_command_total: 0,
        scenario_count: 0,
        elapsed_ms: 1,
        authority_status: "not_promotion_authority"
      },
      research_preflight: {
        commitment_id: "commitment-failed",
        development_submission_count: 0,
        sealed_terminal_status: "not_run",
        reason: "execution_failed",
        authority_status: "not_promotion_authority"
      }
    };

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(true);
  });

  it("accepts completed_with_errors only for mixed failed and non-failed results", () => {
    const tick = createdTickFixture();
    tick.status = "completed_with_errors";
    tick.direction_results.push({
      direction_kind: "mean_reversion",
      status: "failed",
      error: "Research failed closed."
    });

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(true);
  });

  it.each([
    ["completed", ["failed"]],
    ["completed_with_errors", ["failed"]],
    ["completed_with_errors", ["created"]],
    ["failed", ["failed", "created"]]
  ] as const)("rejects aggregate status %s for direction results %j", (
    status,
    resultStatuses
  ) => {
    const tick = createdTickFixture();
    tick.status = status;
    tick.direction_results = resultStatuses.map((resultStatus, index) =>
      resultStatus === "failed"
        ? {
            direction_kind: index === 0 ? "trend_following" : "mean_reversion",
            status: "failed",
            error: "Research failed closed."
          }
        : {
            ...structuredClone(createdTickFixture().direction_results[0]!),
            direction_kind: index === 0 ? "trend_following" : "mean_reversion"
          }
    );

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(false);
  });

  it("rejects malformed direction, compact conformance, and no-submission shapes", () => {
    const missingFailure = tickFixture();
    delete missingFailure.direction_results[0]!.error;
    expect(candidateArenaTickHasRuntimeShape(missingFailure)).toBe(false);

    const compactExtra = tickFixture();
    compactExtra.status = "completed";
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
    contradictoryNoSubmission.status = "completed";
    contradictoryNoSubmission.direction_results[0] = {
      direction_kind: "trend_following",
      status: "no_submission",
      finding: "No submission selected.",
      candidate_id: "forged-candidate"
    };
    expect(candidateArenaTickHasRuntimeShape(contradictoryNoSubmission)).toBe(false);
  });

  it.each([
    ["passed", "runner_crash"],
    ["rejected", "passed"]
  ] as const)("rejects inconsistent compact conformance %s/%s", (status, reason) => {
    const inconsistent = tickFixture();
    inconsistent.status = "completed";
    inconsistent.direction_results[0] = {
      direction_kind: "trend_following",
      status: "created",
      candidate_id: "candidate-1",
      paper_handoff_conformance: {
        conformance_id: "conformance-1",
        status,
        reason,
        authority_status: "research_only"
      }
    };

    expect(candidateArenaTickHasRuntimeShape(inconsistent)).toBe(false);
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
    malformedPolicyDigest.status = "completed";
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

  it("accepts an exactly bound created candidate result", () => {
    expect(candidateArenaTickHasRuntimeShape(createdTickFixture())).toBe(true);
    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(
      createdTickFixture()
    )).toBe(true);
  });

  it.each([
    {
      name: "missing admission",
      mutate: (tick: CandidateArenaTickRecord) => {
        delete tick.direction_results[0]!.admission_decision_id;
      }
    },
    {
      name: "missing handoff conformance",
      mutate: (tick: CandidateArenaTickRecord) => {
        delete tick.direction_results[0]!.paper_handoff_conformance;
      }
    },
    {
      name: "rejected handoff",
      mutate: (tick: CandidateArenaTickRecord) => {
        tick.direction_results[0]!.admission_reason =
          "paper_handoff_conformance_failed";
        tick.direction_results[0]!.paper_handoff_conformance = {
          conformance_id: "conformance-created",
          status: "rejected",
          reason: "runner_crash",
          authority_status: "research_only"
        };
      }
    },
    {
      name: "mismatched created candidate ref",
      mutate: (tick: CandidateArenaTickRecord) => {
        tick.created_candidate_refs[0]!.id = "candidate-other";
      }
    }
  ])("rejects a created result with $name", ({ mutate }) => {
    const tick = createdTickFixture();
    mutate(tick);

    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(false);
  });

  it("rejects a handoff-failed quarantine carrying passed handoff authority", () => {
    const tick = createdTickFixture();
    tick.created_candidate_refs = [];
    tick.direction_results[0] = {
      direction_kind: "trend_following",
      status: "quarantined",
      finding: "Evaluation was quarantined.",
      admission_decision_id: "admission-created",
      admission_reason: "paper_handoff_conformance_failed",
      paper_handoff_conformance: {
        conformance_id: "conformance-created",
        status: "passed",
        reason: "passed",
        authority_status: "research_only"
      }
    };

    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(false);
  });

  it("rejects an evaluation quarantine carrying unrelated passed handoff", () => {
    const tick = createdTickFixture();
    tick.created_candidate_refs = [];
    tick.direction_results[0] = {
      direction_kind: "trend_following",
      status: "quarantined",
      finding: "Evaluation was quarantined.",
      admission_decision_id: "admission-created",
      admission_reason: "evaluation_quarantined",
      paper_handoff_conformance: {
        conformance_id: "conformance-created",
        status: "passed",
        reason: "passed",
        authority_status: "research_only"
      }
    };

    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(false);
  });

  it("accepts passed handoff evidence quarantined by a later fingerprint gate", () => {
    const tick = createdTickFixture();
    tick.created_candidate_refs = [];
    tick.direction_results[0] = {
      direction_kind: "trend_following",
      status: "quarantined",
      finding: "Behavior observations were unavailable.",
      admission_decision_id: "admission-created",
      admission_reason: "behavior_fingerprint_unavailable",
      paper_handoff_conformance: {
        conformance_id: "conformance-created",
        status: "passed",
        reason: "passed",
        authority_status: "research_only"
      }
    };

    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(true);
  });

  it("rejects a bound candidate claimed by multiple directions", () => {
    const tick = createdTickFixture();
    tick.direction_results.push({
      ...tick.direction_results[0]!,
      direction_kind: "mean_reversion"
    });

    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(false);
  });

  it("accepts an authority-free legacy v1 tick in strict projections", () => {
    const tick = createdTickFixture();
    delete tick.research_allocation_ref;
    delete tick.research_allocation_digest;
    delete tick.direction_results[0]!.admission_decision_id;
    delete tick.direction_results[0]!.admission_reason;
    delete tick.direction_results[0]!.paper_handoff_conformance;

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(true);
    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(true);
  });

  it("rejects a legacy v1 created result carrying rejected authority", () => {
    const tick = createdTickFixture();
    delete tick.research_allocation_ref;
    delete tick.research_allocation_digest;
    tick.direction_results[0]!.admission_reason =
      "paper_handoff_conformance_failed";
    tick.direction_results[0]!.paper_handoff_conformance = {
      conformance_id: "conformance-created",
      status: "rejected",
      reason: "runner_crash",
      authority_status: "research_only"
    };

    expect(candidateArenaTickHasRuntimeShape(tick)).toBe(true);
    expect(candidateArenaTickAuthorityGraphHasRuntimeShape(tick)).toBe(false);
  });
});

function createdTickFixture(): CandidateArenaTickRecord {
  return {
    ...tickFixture(),
    status: "completed",
    created_candidate_refs: [{
      record_kind: "trading_system_candidate",
      id: "candidate-created"
    }],
    direction_results: [{
      direction_kind: "trend_following",
      status: "created",
      candidate_id: "candidate-created",
      finding: "Candidate admitted with an exact paper handoff.",
      admission_decision_id: "admission-created",
      admission_reason: "evaluation_accepted",
      research_preflight: {
        commitment_id: "commitment-created",
        development_submission_count: 1,
        sealed_terminal_status: "accepted",
        reason: "accepted",
        authority_status: "not_promotion_authority"
      },
      paper_handoff_conformance: {
        conformance_id: "conformance-created",
        status: "passed",
        reason: "passed",
        authority_status: "research_only"
      }
    }],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-created"
    },
    research_allocation_digest: `sha256:${"0".repeat(64)}`
  };
}

function tickFixture(): CandidateArenaTickRecord {
  return {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: "candidate-arena-tick-1",
    tick_id: "tick-1",
    started_at: "2026-07-23T00:00:00.000Z",
    completed_at: "2026-07-23T00:00:01.000Z",
    status: "failed",
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
