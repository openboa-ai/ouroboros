import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointAttemptHasRuntimeShape,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonCheckpointOutcomeHasRuntimeShape,
  paperTradingComparisonCheckpointWriteContextHasRuntimeShape,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCheckpointSideEvidence,
  type PaperTradingComparisonCheckpointWriteContext
} from "./index";

describe("paper comparison checkpoint domain", () => {
  it("canonically binds checkpoint attempt and outcome evidence", () => {
    const attempt = validAttempt();
    const outcome = validPairedOutcome();

    expect(paperTradingComparisonCheckpointAttemptDigestInput({
      ...attempt,
      paper_trading_comparison_checkpoint_attempt_id: "different",
      attempt_digest: "sha256:different"
    })).toBe(paperTradingComparisonCheckpointAttemptDigestInput(attempt));
    expect(paperTradingComparisonCheckpointAttemptDigestInput({
      ...attempt,
      checkpoint_deadline_at: "2026-07-11T00:01:00.001Z"
    })).not.toBe(paperTradingComparisonCheckpointAttemptDigestInput(attempt));

    expect(paperTradingComparisonCheckpointOutcomeDigestInput({
      ...outcome,
      paper_trading_comparison_checkpoint_outcome_id: "different",
      outcome_digest: "sha256:different"
    })).toBe(paperTradingComparisonCheckpointOutcomeDigestInput(outcome));
    expect(paperTradingComparisonCheckpointOutcomeDigestInput({
      ...outcome,
      completed_at: "2026-07-11T00:00:11.001Z"
    })).not.toBe(paperTradingComparisonCheckpointOutcomeDigestInput(outcome));
  });

  it("accepts one complete first-checkpoint attempt, paired outcome, incomplete outcome, and context", () => {
    expect(paperTradingComparisonCheckpointAttemptHasRuntimeShape(validAttempt())).toBe(true);
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(
      validPairedOutcome()
    )).toBe(true);
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(
      validIncompleteOutcome()
    )).toBe(true);
    expect(paperTradingComparisonCheckpointWriteContextHasRuntimeShape(
      validWriteContext()
    )).toBe(true);
  });

  it("accepts an acknowledgement-bound repeated checkpoint", () => {
    expect(paperTradingComparisonCheckpointAttemptHasRuntimeShape(validNextAttempt())).toBe(true);
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(
      validNextPairedOutcome()
    )).toBe(true);
    expect(paperTradingComparisonCheckpointWriteContextHasRuntimeShape({
      ...validWriteContext(),
      checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: "checkpoint-attempt-2"
      },
      checkpoint_attempt_digest: "sha256:checkpoint-attempt-2",
      operation: "advance_tick_view"
    })).toBe(true);
  });

  it.each([
    ["null", () => null],
    ["wrong activation ref", (record: any) => {
      record.paper_trading_comparison_activation_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong activation attempt ref", (record: any) => {
      record.paper_trading_comparison_activation_attempt_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong activation outcome ref", (record: any) => {
      record.activation_outcome_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong tick ref", (record: any) => {
      record.tick_ref.record_kind = "wrong";
      return record;
    }],
    ["later sequence without predecessor", (record: any) => {
      record.checkpoint_sequence = 2;
      return record;
    }],
    ["duplicate side runtime", (record: any) => {
      record.challenger.trading_run_ref = record.champion.trading_run_ref;
      return record;
    }],
    ["wrong side role", (record: any) => {
      record.challenger.role = "champion";
      return record;
    }],
    ["negative provider baseline", (record: any) => {
      record.champion.provider_request_count_before = -1;
      return record;
    }],
    ["non-ISO attempt time", (record: any) => {
      record.attempted_at = "bad";
      return record;
    }],
    ["reverse deadline", (record: any) => {
      record.checkpoint_deadline_at = "2026-07-11T00:00:00.999Z";
      return record;
    }],
    ["deadline over sixty seconds", (record: any) => {
      record.checkpoint_deadline_at = "2026-07-11T00:01:01.001Z";
      return record;
    }],
    ["wrong status", (record: any) => {
      record.attempt_status = "running";
      return record;
    }],
    ["live authority", (record: any) => {
      record.live_exchange_authority = true;
      return record;
    }]
  ])("returns false without throwing for malformed checkpoint attempt: %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validAttempt()));
    expect(() => paperTradingComparisonCheckpointAttemptHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonCheckpointAttemptHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["missing previous outcome ref", (record: any) => {
      delete record.previous_checkpoint_outcome_ref;
    }],
    ["missing previous outcome digest", (record: any) => {
      delete record.previous_checkpoint_outcome_digest;
    }],
    ["wrong previous outcome kind", (record: any) => {
      record.previous_checkpoint_outcome_ref.record_kind = "wrong";
    }],
    ["first sequence with previous outcome", (record: any) => {
      record.checkpoint_sequence = 1;
    }]
  ])("rejects malformed repeated checkpoint attempt: %s", (_label, mutate) => {
    const malformed = structuredClone(validNextAttempt()) as any;
    mutate(malformed);
    expect(() => paperTradingComparisonCheckpointAttemptHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonCheckpointAttemptHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["paired", () => validPairedOutcome()],
    ["paired negative evidence", () => ({
      ...validPairedOutcome(),
      champion: {
        ...validPairedOutcome().champion,
        observation_status: "failed"
      },
      next_action: "close_failed_comparison"
    })],
    ["incomplete preparation failure", () => validIncompleteOutcome()],
    ["incomplete cleanup", () => ({
      ...validIncompleteOutcome(),
      outcome_reason: "restart_cleanup",
      next_action: "recover_cleanup"
    })]
  ])("accepts valid checkpoint outcome combination: %s", (_label, build) => {
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(build())).toBe(true);
  });

  it.each([
    ["paired missing champion", (record: any) => {
      delete record.champion;
    }],
    ["paired missing challenger", (record: any) => {
      delete record.challenger;
    }],
    ["paired wrong reason", (record: any) => {
      record.outcome_reason = "side_preparation_failed";
    }],
    ["paired duplicate observation", (record: any) => {
      record.challenger.observation_ref = record.champion.observation_ref;
    }],
    ["paired cross-role evidence", (record: any) => {
      record.challenger.role = "champion";
    }],
    ["paired negative requests", (record: any) => {
      record.champion.provider_request_count_after = -1;
    }],
    ["paired wrong action", (record: any) => {
      record.next_action = "recover_cleanup";
    }],
    ["incomplete with champion evidence", (record: any) => {
      record.outcome_status = "incomplete";
      record.outcome_reason = "side_preparation_failed";
      record.next_action = "close_failed_comparison";
      delete record.challenger;
    }],
    ["incomplete with challenger evidence", (record: any) => {
      record.outcome_status = "incomplete";
      record.outcome_reason = "side_preparation_failed";
      record.next_action = "close_failed_comparison";
      delete record.champion;
    }],
    ["incomplete paired reason", (record: any) => {
      record.outcome_status = "incomplete";
      delete record.champion;
      delete record.challenger;
    }],
    ["incomplete paired action", (record: any) => {
      record.outcome_status = "incomplete";
      record.outcome_reason = "side_preparation_failed";
      delete record.champion;
      delete record.challenger;
    }],
    ["non-ISO completion", (record: any) => {
      record.completed_at = "bad";
    }],
    ["live authority", (record: any) => {
      record.order_submission_authority = true;
    }]
  ])("rejects malformed checkpoint outcome combination: %s", (_label, mutate) => {
    const malformed = structuredClone(validPairedOutcome()) as any;
    mutate(malformed);
    expect(() => paperTradingComparisonCheckpointOutcomeHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["missing champion acknowledgement ref", (record: any) => {
      delete record.champion.tick_acknowledgement_ref;
    }],
    ["missing challenger acknowledgement digest", (record: any) => {
      delete record.challenger.tick_acknowledgement_digest;
    }],
    ["wrong acknowledgement kind", (record: any) => {
      record.champion.tick_acknowledgement_ref.record_kind = "wrong";
    }],
    ["shared acknowledgement", (record: any) => {
      record.challenger.tick_acknowledgement_ref = record.champion.tick_acknowledgement_ref;
    }],
    ["repeated outcome with first action", (record: any) => {
      record.next_action = "serve_and_acknowledge_current_tick";
    }],
    ["first outcome with acknowledgement", (record: any) => {
      record.checkpoint_sequence = 1;
      record.next_action = "serve_and_acknowledge_current_tick";
    }]
  ])("rejects malformed repeated checkpoint outcome: %s", (_label, mutate) => {
    const malformed = structuredClone(validNextPairedOutcome()) as any;
    mutate(malformed);
    expect(() => paperTradingComparisonCheckpointOutcomeHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonCheckpointOutcomeHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["null", null],
    ["wrong activation outcome kind", {
      ...validWriteContext(),
      activation_outcome_ref: { record_kind: "wrong", id: "activation-outcome-1" }
    }],
    ["wrong checkpoint attempt kind", {
      ...validWriteContext(),
      checkpoint_attempt_ref: { record_kind: "wrong", id: "checkpoint-attempt-1" }
    }],
    ["wrong role", { ...validWriteContext(), role: "peer" }],
    ["wrong operation", { ...validWriteContext(), operation: "record_observation" }],
    ["empty digest", { ...validWriteContext(), checkpoint_attempt_digest: "" }]
  ])("rejects malformed checkpoint write context: %s", (_label, value) => {
    expect(() => paperTradingComparisonCheckpointWriteContextHasRuntimeShape(value)).not.toThrow();
    expect(paperTradingComparisonCheckpointWriteContextHasRuntimeShape(value)).toBe(false);
  });
});

function validAttempt(): PaperTradingComparisonCheckpointAttemptRecord {
  return {
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id: "checkpoint-attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "activation-attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:activation-attempt",
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "activation-outcome-1"
    },
    activation_outcome_digest: "sha256:activation-outcome",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-1"
    },
    tick_digest: "sha256:tick",
    checkpoint_sequence: 1,
    champion: validAttemptSide("champion"),
    challenger: validAttemptSide("challenger"),
    attempted_at: "2026-07-11T00:00:01.000Z",
    checkpoint_deadline_at: "2026-07-11T00:01:01.000Z",
    attempt_status: "preparing",
    attempt_digest: "sha256:checkpoint-attempt",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validNextAttempt(): PaperTradingComparisonCheckpointAttemptRecord {
  return {
    ...validAttempt(),
    paper_trading_comparison_checkpoint_attempt_id: "checkpoint-attempt-2",
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-2"
    },
    tick_digest: "sha256:tick-2",
    checkpoint_sequence: 2,
    previous_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: "checkpoint-outcome-1"
    },
    previous_checkpoint_outcome_digest: "sha256:checkpoint-outcome-1",
    champion: {
      ...validAttemptSide("champion"),
      evaluation_record_digest: "sha256:champion-evaluation-after-1",
      observation_chain_digest: "sha256:champion-observations-after-1",
      provider_request_count_before: 6
    },
    challenger: {
      ...validAttemptSide("challenger"),
      evaluation_record_digest: "sha256:challenger-evaluation-after-1",
      observation_chain_digest: "sha256:challenger-observations-after-1",
      provider_request_count_before: 7
    },
    attempted_at: "2026-07-11T00:01:01.000Z",
    checkpoint_deadline_at: "2026-07-11T00:02:01.000Z",
    attempt_digest: "sha256:checkpoint-attempt-2"
  };
}

function validAttemptSide(role: "champion" | "challenger") {
  return {
    role,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    evaluation_record_digest: `sha256:${role}-evaluation`,
    observation_chain_digest: `sha256:${role}-observations`,
    provider_request_count_before: role === "champion" ? 2 : 3
  } as const;
}

function validSideEvidence(
  role: "champion" | "challenger"
): PaperTradingComparisonCheckpointSideEvidence {
  return {
    role,
    observation_ref: {
      record_kind: "paper_trading_observation",
      id: `${role}-observation-1`
    },
    observation_record_digest: `sha256:${role}-observation`,
    evaluation_record_digest: `sha256:${role}-evaluation-after`,
    ledger_chain_refs: role === "champion"
      ? [{ record_kind: "ledger_chain", id: "champion-ledger-1" }]
      : [],
    observation_status: role === "champion" ? "recorded" : "no_order",
    consumed_event_count: role === "champion" ? 1 : 0,
    provider_request_count_after: role === "champion" ? 4 : 3
  };
}

function validPairedOutcome(): PaperTradingComparisonCheckpointOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id: "checkpoint-outcome-1",
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: "checkpoint-attempt-1"
    },
    checkpoint_attempt_digest: "sha256:checkpoint-attempt",
    tick_ref: { record_kind: "paper_trading_comparison_tick", id: "tick-1" },
    tick_digest: "sha256:tick",
    checkpoint_sequence: 1,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: validSideEvidence("champion"),
    challenger: validSideEvidence("challenger"),
    next_action: "serve_and_acknowledge_current_tick",
    completed_at: "2026-07-11T00:00:11.000Z",
    outcome_digest: "sha256:checkpoint-outcome",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validNextPairedOutcome(): PaperTradingComparisonCheckpointOutcomeRecord {
  const attempt = validNextAttempt();
  return {
    ...validPairedOutcome(),
    paper_trading_comparison_checkpoint_outcome_id: "checkpoint-outcome-2",
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    checkpoint_sequence: 2,
    champion: {
      ...validSideEvidence("champion"),
      observation_ref: {
        record_kind: "paper_trading_observation",
        id: "champion-observation-2"
      },
      tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: "champion-ack-2"
      },
      tick_acknowledgement_digest: "sha256:champion-ack-2"
    },
    challenger: {
      ...validSideEvidence("challenger"),
      observation_ref: {
        record_kind: "paper_trading_observation",
        id: "challenger-observation-2"
      },
      tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: "challenger-ack-2"
      },
      tick_acknowledgement_digest: "sha256:challenger-ack-2"
    },
    next_action: "capture_next_tick",
    completed_at: "2026-07-11T00:01:11.000Z",
    outcome_digest: "sha256:checkpoint-outcome-2"
  };
}

function validIncompleteOutcome(): PaperTradingComparisonCheckpointOutcomeRecord {
  const paired = validPairedOutcome();
  const { champion: _champion, challenger: _challenger, ...base } = paired;
  return {
    ...base,
    outcome_status: "incomplete",
    outcome_reason: "side_preparation_failed",
    stable_error_code: "sandbox_log_read_failed",
    next_action: "close_failed_comparison"
  };
}

function validWriteContext(): PaperTradingComparisonCheckpointWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "activation-attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:activation-attempt",
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "activation-outcome-1"
    },
    activation_outcome_digest: "sha256:activation-outcome",
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: "checkpoint-attempt-1"
    },
    checkpoint_attempt_digest: "sha256:checkpoint-attempt",
    role: "champion",
    operation: "refresh_sandbox_evidence"
  };
}
