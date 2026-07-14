import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonActivationSideResultHasRuntimeShape,
  paperTradingComparisonBaselineEvaluation,
  paperTradingComparisonEvaluationHasZeroEvidenceActivationState,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonRuntimeControlIdempotencyKey,
  paperTradingComparisonRuntimeWriteContextHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationPolicy,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonActivationSideResultRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord
} from "./index";

describe("paper comparison runtime activation domain", () => {
  it("reconstructs the exact frozen baseline and accepts only zero-evidence lifecycle transitions", () => {
    const commitment = qualificationCommitment();
    const baseline = paperTradingComparisonBaselineEvaluation(
      commitment,
      { record_kind: "paper_trading_evaluation", id: "evaluation-champion" }
    );
    const manuallyFrozen = baselineEvaluation(commitment);
    const frozenDigest = digest(
      paperTradingComparisonEvaluationRecordDigestInput(manuallyFrozen)
    );

    expect(baseline).toEqual(manuallyFrozen);
    expect(digest(paperTradingComparisonEvaluationRecordDigestInput(baseline)))
      .toBe(frozenDigest);
    expect(paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      baseline,
      manuallyFrozen,
      "not_started"
    )).toBe(true);
    expect(paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      {
        ...baseline,
        status: "running",
        next_observation_at: "2026-07-11T00:01:01.000Z"
      },
      baseline,
      "running"
    )).toBe(true);
    expect(paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      {
        ...baseline,
        status: "stopped",
        stopped_at: "2026-07-11T00:00:10.000Z"
      },
      baseline,
      "stopped"
    )).toBe(true);
    const contaminatedBaseline = {
      ...baseline,
      next_observation_at: "2026-07-11T00:01:00.000Z"
    };
    expect(paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      contaminatedBaseline,
      contaminatedBaseline,
      "not_started"
    )).toBe(false);
  });

  it.each([
    ["observation count", (record: any) => { record.observation_count = 1; }],
    ["score", (record: any) => { record.latest_score.net_revenue_usdt = 1; }],
    ["account", (record: any) => { record.paper_account_snapshot.equity_usdt = "10001"; }],
    ["open order", (record: any) => { record.open_orders = [{}]; }],
    ["processed event", (record: any) => { record.processed_trading_system_event_ids = ["event"]; }],
    ["processed trade", (record: any) => { record.processed_public_trade_ids = ["trade"]; }],
    ["commitment ref", (record: any) => { record.paper_trading_evaluation_commitment_ref.id = "other"; }],
    ["candidate ref", (record: any) => { record.candidate_ref.id = "other"; }],
    ["interval", (record: any) => { record.interval_ms += 1; }],
    ["started at", (record: any) => { record.started_at = "2026-07-11T00:00:00.001Z"; }],
    ["last observed", (record: any) => { record.last_observed_at = "2026-07-11T00:00:02.000Z"; }],
    ["latest fill", (record: any) => { record.latest_fill = {}; }],
    ["public execution", (record: any) => { record.latest_public_execution_snapshot = {}; }],
    ["failure", (record: any) => { record.latest_failure_reason = "failed"; }],
    ["authority", (record: any) => { record.authority_status = "live"; }]
  ])("rejects zero-evidence activation state drift in %s", (_label, mutate) => {
    const baseline = baselineEvaluation(qualificationCommitment());
    const running = {
      ...structuredClone(baseline),
      status: "running" as const,
      next_observation_at: "2026-07-11T00:01:01.000Z"
    };
    mutate(running);

    expect(() => paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      running,
      baseline,
      "running"
    )).not.toThrow();
    expect(paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
      running,
      baseline,
      "running"
    )).toBe(false);
  });

  it("canonically binds attempt, side-result, and outcome evidence", () => {
    const attempt = validAttempt();
    const result = validSideResult();
    const outcome = validOutcome();

    expect(paperTradingComparisonActivationAttemptDigestInput({
      ...attempt,
      paper_trading_comparison_activation_attempt_id: "different",
      attempt_digest: "sha256:different"
    })).toBe(paperTradingComparisonActivationAttemptDigestInput(attempt));
    expect(paperTradingComparisonActivationAttemptDigestInput({
      ...attempt,
      start_deadline_at: "2026-07-11T00:01:02.000Z"
    })).not.toBe(paperTradingComparisonActivationAttemptDigestInput(attempt));

    expect(paperTradingComparisonActivationSideResultDigestInput({
      ...result,
      paper_trading_comparison_activation_side_result_id: "different",
      side_result_digest: "sha256:different"
    })).toBe(paperTradingComparisonActivationSideResultDigestInput(result));
    expect(paperTradingComparisonActivationSideResultDigestInput({
      ...result,
      provider_request_count: 2
    })).not.toBe(paperTradingComparisonActivationSideResultDigestInput(result));

    expect(paperTradingComparisonActivationOutcomeDigestInput({
      ...outcome,
      paper_trading_comparison_activation_outcome_id: "different",
      outcome_digest: "sha256:different"
    })).toBe(paperTradingComparisonActivationOutcomeDigestInput(outcome));
    expect(paperTradingComparisonActivationOutcomeDigestInput({
      ...outcome,
      completed_at: "2026-07-11T00:00:04.000Z"
    })).not.toBe(paperTradingComparisonActivationOutcomeDigestInput(outcome));
    const handoff = {
      ...outcome,
      outcome_sequence: 2,
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: outcome.paper_trading_comparison_activation_outcome_id
      },
      outcome_status: "stopped_cleanly" as const,
      outcome_reason: "handoff_cleanup" as const,
      window_closure: validWindowClosure(),
      next_action: "checkpoint_handoff_complete" as const,
      completed_at: "2026-07-11T00:03:01.000Z"
    };
    expect(paperTradingComparisonActivationOutcomeDigestInput({
      ...handoff,
      window_closure: {
        ...handoff.window_closure,
        requested_at: "2026-07-11T00:03:00.001Z"
      }
    })).not.toBe(paperTradingComparisonActivationOutcomeDigestInput(handoff));
  });

  it("accepts one complete attempt, side result, outcome, and runtime write context", () => {
    expect(paperTradingComparisonActivationAttemptHasRuntimeShape(validAttempt())).toBe(true);
    expect(paperTradingComparisonActivationSideResultHasRuntimeShape(validSideResult())).toBe(true);
    expect(paperTradingComparisonActivationOutcomeHasRuntimeShape(validOutcome())).toBe(true);
    expect(paperTradingComparisonRuntimeWriteContextHasRuntimeShape(
      validRuntimeWriteContext()
    )).toBe(true);
    expect(paperTradingComparisonRuntimeControlIdempotencyKey(
      validRuntimeWriteContext()
    )).toBe("paper-comparison-run-control:attempt-1:champion:start");
  });

  it.each([
    ["null", () => null],
    ["wrong activation ref", (record: any) => { record.paper_trading_comparison_activation_ref.record_kind = "wrong"; return record; }],
    ["duplicate side", (record: any) => { record.challenger.trading_run_ref = record.champion.trading_run_ref; return record; }],
    ["zero sequence", (record: any) => { record.attempt_sequence = 0; return record; }],
    ["wrong retry index", (record: any) => { record.retry_index = 1; return record; }],
    ["retry over policy", (record: any) => { record.attempt_sequence = 5; record.retry_index = 4; return record; }],
    ["serial start", (record: any) => { record.start_mode = "serial"; return record; }],
    ["wrong status", (record: any) => { record.attempt_status = "running"; return record; }],
    ["non-ISO attempt", (record: any) => { record.attempted_at = "bad"; return record; }],
    ["wrong deadline", (record: any) => { record.start_deadline_at = "2026-07-11T00:00:59.999Z"; return record; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; return record; }]
  ])("returns false without throwing for malformed attempt %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validAttempt()));
    expect(() => paperTradingComparisonActivationAttemptHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonActivationAttemptHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["start success", () => validSideResult()],
    ["start failure", () => ({
      ...validSideResult(),
      outcome: "failed",
      runtime_lifecycle_status: "registered",
      evaluation_status: "not_started",
      sandbox_ref: undefined,
      stable_error_code: "sandbox_start_failed"
    })],
    ["start timeout", () => ({
      ...validSideResult(),
      outcome: "timed_out",
      runtime_lifecycle_status: "unknown",
      evaluation_status: "unknown",
      sandbox_ref: undefined,
      stable_error_code: "activation_start_timed_out"
    })],
    ["stop success", () => ({
      ...validSideResult(),
      operation_sequence: 2,
      operation: "stop",
      reason: "partial_start_cleanup",
      outcome: "succeeded",
      runtime_lifecycle_status: "stopped",
      evaluation_status: "stopped"
    })],
    ["stop after failed checkpoint", () => ({
      ...validSideResult(),
      operation_sequence: 2,
      operation: "stop",
      reason: "handoff_cleanup",
      outcome: "succeeded",
      runtime_lifecycle_status: "stopped",
      evaluation_status: "failed"
    })],
    ["stop not running", () => ({
      ...validSideResult(),
      operation_sequence: 2,
      operation: "stop",
      reason: "restart_cleanup",
      outcome: "not_running",
      runtime_lifecycle_status: "registered",
      evaluation_status: "not_started",
      sandbox_ref: undefined
    })]
  ])("accepts valid side-result combination: %s", (_label, build) => {
    expect(paperTradingComparisonActivationSideResultHasRuntimeShape(build())).toBe(true);
  });

  it.each([
    ["start cleanup reason", (record: any) => { record.reason = "partial_start_cleanup"; }],
    ["stop start reason", (record: any) => { record.operation = "stop"; }],
    ["successful start without sandbox", (record: any) => { delete record.sandbox_ref; }],
    ["successful start not running", (record: any) => { record.runtime_lifecycle_status = "registered"; }],
    ["failure without code", (record: any) => { record.outcome = "failed"; delete record.stable_error_code; }],
    ["success with code", (record: any) => { record.stable_error_code = "unexpected"; }],
    ["negative requests", (record: any) => { record.provider_request_count = -1; }],
    ["reverse time", (record: any) => { record.effect_completed_at = "2026-07-11T00:00:00.999Z"; }],
    ["wrong role", (record: any) => { record.role = "peer"; }],
    ["live authority", (record: any) => { record.authority_status = "live"; }]
  ])("rejects malformed side-result combination: %s", (_label, mutate) => {
    const malformed = structuredClone(validSideResult());
    mutate(malformed);
    expect(() => paperTradingComparisonActivationSideResultHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonActivationSideResultHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["both running", () => validOutcome()],
    ["stopped cleanly", () => ({
      ...validOutcome(),
      outcome_status: "stopped_cleanly",
      outcome_reason: "start_failed",
      next_action: "retry_activation"
    })],
    ["cleanup required", () => ({
      ...validOutcome(),
      outcome_status: "cleanup_required",
      outcome_reason: "cleanup_failed",
      next_action: "recover_cleanup",
      challenger_latest_result_ref: undefined
    })],
    ["second recovery outcome", () => ({
      ...validOutcome(),
      paper_trading_comparison_activation_outcome_id: "outcome-2",
      outcome_sequence: 2,
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: "outcome-1"
      },
      outcome_status: "stopped_cleanly",
      outcome_reason: "restart_cleanup",
      next_action: "retry_activation"
    })],
    ["checkpoint handoff complete", () => ({
      ...validOutcome(),
      paper_trading_comparison_activation_outcome_id: "outcome-2",
      outcome_sequence: 2,
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: "outcome-1"
      },
      outcome_status: "stopped_cleanly",
      outcome_reason: "handoff_cleanup",
      next_action: "checkpoint_handoff_complete"
    })],
    ["checkpoint handoff with sealed window closure", () => ({
      ...validOutcome(),
      paper_trading_comparison_activation_outcome_id: "outcome-2",
      outcome_sequence: 2,
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: "outcome-1"
      },
      outcome_status: "stopped_cleanly",
      outcome_reason: "handoff_cleanup",
      window_closure: validWindowClosure(),
      next_action: "checkpoint_handoff_complete",
      completed_at: "2026-07-11T00:03:01.000Z"
    })]
  ])("accepts valid activation outcome combination: %s", (_label, build) => {
    expect(paperTradingComparisonActivationOutcomeHasRuntimeShape(build())).toBe(true);
  });

  it.each([
    ["sequence one with previous", (record: any) => { record.previous_outcome_ref = { record_kind: "paper_trading_comparison_activation_outcome", id: "prior" }; }],
    ["sequence two without previous", (record: any) => { record.outcome_sequence = 2; }],
    ["running wrong reason", (record: any) => { record.outcome_reason = "start_failed"; }],
    ["running wrong action", (record: any) => { record.next_action = "retry_activation"; }],
    ["running missing side", (record: any) => { delete record.challenger_latest_result_ref; }],
    ["running duplicate side", (record: any) => { record.challenger_latest_result_ref = record.champion_latest_result_ref; }],
    ["stopped capture action", (record: any) => { record.outcome_status = "stopped_cleanly"; record.outcome_reason = "start_failed"; }],
    ["handoff retry action", (record: any) => { record.outcome_status = "stopped_cleanly"; record.outcome_reason = "handoff_cleanup"; record.next_action = "retry_activation"; }],
    ["closure on non-handoff", (record: any) => { record.window_closure = validWindowClosure(); }],
    ["closure after completion", (record: any) => {
      record.outcome_status = "stopped_cleanly";
      record.outcome_reason = "handoff_cleanup";
      record.next_action = "checkpoint_handoff_complete";
      record.window_closure = validWindowClosure();
      record.completed_at = "2026-07-11T00:02:59.999Z";
    }],
    ["closure with unpaired overflow", (record: any) => {
      record.outcome_status = "stopped_cleanly";
      record.outcome_reason = "handoff_cleanup";
      record.next_action = "checkpoint_handoff_complete";
      record.window_closure = {
        ...validWindowClosure(),
        paired_checkpoint_count: 4
      };
      record.completed_at = "2026-07-11T00:03:01.000Z";
    }],
    ["complete closure without outcome ref", (record: any) => {
      record.outcome_status = "stopped_cleanly";
      record.outcome_reason = "handoff_cleanup";
      record.next_action = "checkpoint_handoff_complete";
      record.window_closure = validWindowClosure();
      delete record.window_closure.latest_checkpoint_outcome_ref;
      record.completed_at = "2026-07-11T00:03:01.000Z";
    }],
    ["cleanup retry action", (record: any) => { record.outcome_status = "cleanup_required"; record.outcome_reason = "cleanup_failed"; }],
    ["non-ISO completion", (record: any) => { record.completed_at = "bad"; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; }]
  ])("rejects malformed activation outcome combination: %s", (_label, mutate) => {
    const malformed = structuredClone(validOutcome());
    mutate(malformed);
    expect(() => paperTradingComparisonActivationOutcomeHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonActivationOutcomeHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["null", null],
    ["wrong attempt kind", {
      ...validRuntimeWriteContext(),
      paper_trading_comparison_activation_attempt_ref: { record_kind: "wrong", id: "attempt" }
    }],
    ["wrong role", { ...validRuntimeWriteContext(), role: "peer" }],
    ["wrong operation", { ...validRuntimeWriteContext(), operation: "observe" }],
    ["empty digest", { ...validRuntimeWriteContext(), paper_trading_comparison_activation_digest: "" }]
  ])("rejects malformed runtime write context: %s", (_label, value) => {
    expect(() => paperTradingComparisonRuntimeWriteContextHasRuntimeShape(value)).not.toThrow();
    expect(paperTradingComparisonRuntimeWriteContextHasRuntimeShape(value)).toBe(false);
  });
});

function validAttempt(): PaperTradingComparisonActivationAttemptRecord {
  return {
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id: "attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-1"
    },
    first_tick_digest: "sha256:tick",
    champion: activationSide("champion"),
    challenger: activationSide("challenger"),
    activation_policy: activationPolicy(),
    attempt_sequence: 1,
    retry_index: 0,
    start_mode: "parallel",
    attempt_status: "starting",
    attempted_at: "2026-07-11T00:00:01.000Z",
    start_deadline_at: "2026-07-11T00:01:01.000Z",
    attempt_digest: "sha256:attempt",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validSideResult(): PaperTradingComparisonActivationSideResultRecord {
  return {
    record_kind: "paper_trading_comparison_activation_side_result",
    version: 1,
    paper_trading_comparison_activation_side_result_id: "attempt-1-champion-start-1",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:attempt",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    role: "champion",
    operation_sequence: 1,
    operation: "start",
    reason: "symmetric_start",
    outcome: "succeeded",
    trading_run_ref: { record_kind: "trading_run", id: "champion-run" },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "champion-evaluation"
    },
    sandbox_ref: { record_kind: "sandbox", id: "champion-sandbox" },
    runtime_lifecycle_status: "running",
    evaluation_status: "running",
    provider_request_count: 1,
    effect_started_at: "2026-07-11T00:00:01.000Z",
    effect_completed_at: "2026-07-11T00:00:02.000Z",
    side_result_digest: "sha256:side-result",
    authority_status: "not_live"
  };
}

function validOutcome(): PaperTradingComparisonActivationOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_activation_outcome",
    version: 1,
    paper_trading_comparison_activation_outcome_id: "outcome-1",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:attempt",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    outcome_sequence: 1,
    outcome_status: "both_running",
    outcome_reason: "started_within_policy",
    champion_latest_result_ref: {
      record_kind: "paper_trading_comparison_activation_side_result",
      id: "champion-result"
    },
    challenger_latest_result_ref: {
      record_kind: "paper_trading_comparison_activation_side_result",
      id: "challenger-result"
    },
    next_action: "capture_first_paired_checkpoint",
    completed_at: "2026-07-11T00:00:03.000Z",
    outcome_digest: "sha256:outcome",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validWindowClosure() {
  return {
    protocol_version: "paper_trading_comparison_window_closure_v1" as const,
    requested_at: "2026-07-11T00:03:00.000Z",
    tick_count: 3,
    checkpoint_attempt_count: 3,
    paired_checkpoint_count: 3,
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-3"
    },
    latest_tick_observed_at: "2026-07-11T00:02:00.000Z",
    latest_checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: "checkpoint-attempt-3"
    },
    latest_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: "checkpoint-outcome-3"
    }
  };
}

function validRuntimeWriteContext(): PaperTradingComparisonRuntimeWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:attempt",
    role: "champion",
    operation: "start"
  };
}

function activationSide(role: "champion" | "challenger"): PaperTradingComparisonActivationSide {
  return {
    role,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    }
  };
}

function activationPolicy(): PaperTradingComparisonActivationPolicy {
  return paperTradingComparisonActivationPolicyFor(comparisonPolicy());
}

function comparisonPolicy(): PaperTradingComparisonPolicy {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: "bootstrap",
    symbol: "BTCUSDT",
    interval_ms: 60_000,
    minimum_observation_count: 30,
    minimum_elapsed_ms: 1_800_000,
    maximum_observation_count: 120,
    maximum_elapsed_ms: 7_200_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 500,
    maximum_retry_count_per_side: 3,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 10,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  };
}

function qualificationCommitment(): PaperTradingEvaluationCommitmentRecord {
  return {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "commitment-champion",
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate-champion" },
    candidate_version_ref: { record_kind: "candidate_version", id: "version-champion" },
    trading_run_ref: { record_kind: "trading_run", id: "champion-run" },
    system_code_ref: { record_kind: "system_code", id: "code-champion" },
    system_code_artifact_digest: "sha256:code",
    resolved_artifact_digest: "sha256:resolved",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "run.py"]
    },
    provider_identity: { runtime_provider_kind: "none", qualification_eligible: true },
    capability_policy_ref: { record_kind: "capability_policy", id: "capability" },
    secret_policy_ref: { record_kind: "secret_policy", id: "secret" },
    policy_identity: {
      market_data_policy_version: "market",
      gateway_policy_version: "gateway",
      cost_policy_version: "cost",
      funding_policy_version: "funding",
      slippage_policy_version: "slippage",
      fill_policy_version: "fill",
      risk_policy_version: "risk",
      paper_account_policy_version: "account",
      decision_event_protocol_version: "decision",
      persistent_state_boundary_version: "state"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: "sha256:market",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "sealed_until_adjudication",
      eligibility_policy_version: "eligibility-v1"
    },
    initial_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    committed_at: "2026-07-11T00:00:00.000Z",
    commitment_digest: "sha256:commitment",
    authority_status: "not_live"
  };
}

function baselineEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "evaluation-champion",
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
    paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function digest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}
