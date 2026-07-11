import { createHash } from "node:crypto";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickAcknowledgementDigestInput,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSideResultRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonTickRecord,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord
} from "@ouroboros/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaperTradingComparisonSessionPort } from "../../ports/paper-comparison-session";
import type {
  OuroborosStorePort,
  PreparedPaperTradingComparisonCheckpointSide,
  RecordPaperTradingComparisonPairedCheckpointInput
} from "../../ports/store";
import {
  PaperTradingComparisonCheckpointCoordinator
} from "./comparison-checkpoint-coordinator";
import type {
  PaperTradingComparisonRuntimeActivationResult
} from "./comparison-runtime-activation-coordinator";

describe("PaperTradingComparisonCheckpointCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists intent before concurrently preparing and atomically committing both sides", async () => {
    const fixture = checkpointCoordinatorFixture();
    expect(paperTradingComparisonActivationHasRuntimeShape(fixture.activation)).toBe(true);
    expect(paperTradingComparisonActivationAttemptHasRuntimeShape(
      fixture.activationAttempt
    )).toBe(true);

    const pending = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(pending, fixture.preparationInputs);
    expect(fixture.events.slice(0, 3)).toEqual([
      "checkpoint-attempt:recorded",
      "prepare:champion",
      "prepare:challenger"
    ]);
    expect(fixture.preparationInputs[0]?.tick).toEqual(fixture.tick);
    expect(fixture.preparationInputs[1]?.tick).toEqual(fixture.tick);
    expect(fixture.preparationInputs[0]?.tick).not.toBe(fixture.preparationInputs[1]?.tick);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion",
      attempt,
      fixture.tick,
      fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(preparedCheckpointSide(
      "challenger",
      attempt,
      fixture.tick,
      fixture.evaluations.challenger
    ));

    const outcome = await pending;

    expect(outcome.outcome_status).toBe("paired");
    expect(fixture.pairedWrites).toHaveLength(1);
    expect(fixture.events.at(-1)).toBe("checkpoint:paired");
    expect(fixture.stopCalls).toEqual([]);
  });

  it("replays an exact paired outcome without refreshing either side", async () => {
    const fixture = checkpointCoordinatorFixture();
    const first = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(first, fixture.preparationInputs);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(preparedCheckpointSide(
      "challenger", attempt, fixture.tick, fixture.evaluations.challenger
    ));
    const recorded = await first;
    const preparationCount = fixture.preparationInputs.length;

    await expect(fixture.coordinator.captureFirst(fixture.input)).resolves.toEqual(recorded);
    expect(fixture.preparationInputs).toHaveLength(preparationCount);
    expect(fixture.pairedWrites).toHaveLength(1);
  });

  it("cleans both sides before recording incomplete when one preparation fails", async () => {
    const fixture = checkpointCoordinatorFixture();
    const pending = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(pending, fixture.preparationInputs);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));
    fixture.preparations.challenger.reject(Object.assign(
      new Error("sandbox read failed"),
      { code: "paper_trading_comparison_checkpoint_side_failed" }
    ));

    const outcome = await pending;

    expect(outcome).toMatchObject({
      outcome_status: "incomplete",
      outcome_reason: "side_preparation_failed",
      stable_error_code: "paper_trading_comparison_checkpoint_side_failed"
    });
    expect(fixture.stopCalls).toEqual([{
      attemptId: fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      reason: "handoff_cleanup"
    }]);
    expect(fixture.events.slice(-2)).toEqual([
      "activation:handoff-cleanup",
      "checkpoint:incomplete"
    ]);
    expect(fixture.pairedWrites).toEqual([]);
  });

  it("cleans both sides when a fulfilled preparation exceeds the frozen request cap", async () => {
    const fixture = checkpointCoordinatorFixture();
    const pending = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(pending, fixture.preparationInputs);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(withPreparedDigest({
      ...preparedCheckpointSide(
        "challenger", attempt, fixture.tick, fixture.evaluations.challenger
      ),
      provider_request_count_after: 6
    }));

    await expect(pending).resolves.toMatchObject({
      outcome_status: "incomplete",
      outcome_reason: "provider_request_budget_exceeded"
    });
    expect(fixture.stopCalls).toHaveLength(1);
    expect(fixture.pairedWrites).toEqual([]);
  });

  it("times out an unresponsive side and records no one-sided economic evidence", async () => {
    vi.useFakeTimers();
    const fixture = checkpointCoordinatorFixture();
    const pending = fixture.coordinator.captureFirst(fixture.input);
    await vi.waitFor(() => expect(fixture.preparationInputs).toHaveLength(2));
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));

    await vi.advanceTimersByTimeAsync(60_000);

    await expect(pending).resolves.toMatchObject({
      outcome_status: "incomplete",
      outcome_reason: "side_preparation_timed_out"
    });
    expect(fixture.pairedWrites).toEqual([]);
    expect(fixture.stopCalls).toHaveLength(1);
  });

  it("treats a persisted paired bundle as success when commit acknowledgement is lost", async () => {
    const fixture = checkpointCoordinatorFixture({ throwAfterPairedCommit: true });
    const pending = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(pending, fixture.preparationInputs);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(preparedCheckpointSide(
      "challenger", attempt, fixture.tick, fixture.evaluations.challenger
    ));

    await expect(pending).resolves.toMatchObject({ outcome_status: "paired" });
    expect(fixture.pairedWrites).toHaveLength(1);
    expect(fixture.stopCalls).toEqual([]);
  });

  it("commits paired negative evidence before stopping a failed candidate", async () => {
    const fixture = checkpointCoordinatorFixture();
    const pending = fixture.coordinator.captureFirst(fixture.input);
    await waitForPreparations(pending, fixture.preparationInputs);
    const attempt = fixture.checkpointAttempts[0]!;
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion", attempt, fixture.tick, fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(failedPreparedCheckpointSide(
      "challenger", attempt, fixture.tick, fixture.evaluations.challenger
    ));

    await expect(pending).resolves.toMatchObject({
      outcome_status: "paired",
      challenger: { observation_status: "failed" }
    });
    expect(fixture.events.slice(-2)).toEqual([
      "checkpoint:paired",
      "activation:handoff-cleanup"
    ]);
  });

  it("persists attempt 2 before advancing both owned role-bound views", async () => {
    const fixture = checkpointCoordinatorFixture();
    const repeated = fixture.seedRepeatedCheckpoint();

    const attempt = await fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    });

    expect(attempt).toMatchObject({
      checkpoint_sequence: 2,
      tick_ref: { id: repeated.nextTick.paper_trading_comparison_tick_id },
      previous_checkpoint_outcome_ref: {
        id: repeated.firstOutcome.paper_trading_comparison_checkpoint_outcome_id
      }
    });
    expect(fixture.events.slice(-3)).toEqual([
      "checkpoint-attempt:recorded",
      "advance:champion",
      "advance:challenger"
    ]);
    expect(fixture.advanceInputs).toHaveLength(2);
    expect(fixture.advanceInputs.map((input) => input.tick)).toEqual([
      repeated.nextTick,
      repeated.nextTick
    ]);
    expect(fixture.preparationInputs).toEqual([]);
    const advanceCount = fixture.advanceInputs.length;

    await expect(fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    })).resolves.toEqual(attempt);
    expect(fixture.advanceInputs).toHaveLength(advanceCount);
  });

  it("cleans both sides and records incomplete when one repeated view advance fails", async () => {
    const fixture = checkpointCoordinatorFixture({
      advanceFailureRole: "challenger"
    });
    const repeated = fixture.seedRepeatedCheckpoint();

    await expect(fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_checkpoint_side_preparation_failed"
    });

    expect(fixture.checkpointOutcomes.at(-1)).toMatchObject({
      checkpoint_sequence: 2,
      outcome_status: "incomplete",
      outcome_reason: "side_preparation_failed",
      stable_error_code:
        "paper_trading_comparison_checkpoint_view_advance_failed"
    });
    expect(fixture.stopCalls).toHaveLength(1);
    expect(fixture.pairedWrites).toEqual([]);
    expect(fixture.preparationInputs).toEqual([]);
  });

  it("completes one owned repeated checkpoint and replays its paired outcome", async () => {
    const fixture = checkpointCoordinatorFixture();
    const repeated = fixture.seedRepeatedCheckpoint();
    const attempt = await fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    });
    fixture.acknowledgeRepeatedTick(attempt);

    const pending = fixture.coordinator.completeNext({
      checkpointAttemptId: attempt.paper_trading_comparison_checkpoint_attempt_id
    });
    await waitForPreparations(pending, fixture.preparationInputs);
    fixture.preparations.champion.resolve(preparedCheckpointSide(
      "champion",
      attempt,
      repeated.nextTick,
      fixture.evaluations.champion
    ));
    fixture.preparations.challenger.resolve(preparedCheckpointSide(
      "challenger",
      attempt,
      repeated.nextTick,
      fixture.evaluations.challenger
    ));

    const outcome = await pending;
    expect(outcome).toMatchObject({
      checkpoint_sequence: 2,
      outcome_status: "paired",
      next_action: "capture_next_tick",
      champion: {
        tick_acknowledgement_ref: { id: "champion-acknowledgement-2" }
      },
      challenger: {
        tick_acknowledgement_ref: { id: "challenger-acknowledgement-2" }
      }
    });
    expect(fixture.pairedWrites).toHaveLength(1);
    const preparationCount = fixture.preparationInputs.length;

    await expect(fixture.coordinator.completeNext({
      checkpointAttemptId: attempt.paper_trading_comparison_checkpoint_attempt_id
    })).resolves.toEqual(outcome);
    expect(fixture.preparationInputs).toHaveLength(preparationCount);
    expect(fixture.stopCalls).toEqual([]);
  });

  it("cleans an owned repeated attempt when either current tick acknowledgement is missing", async () => {
    const fixture = checkpointCoordinatorFixture();
    const repeated = fixture.seedRepeatedCheckpoint();
    const attempt = await fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    });

    await expect(fixture.coordinator.completeNext({
      checkpointAttemptId: attempt.paper_trading_comparison_checkpoint_attempt_id
    })).resolves.toMatchObject({
      checkpoint_sequence: 2,
      outcome_status: "incomplete",
      outcome_reason: "side_preparation_failed",
      stable_error_code: "paper_trading_comparison_checkpoint_graph_invalid"
    });
    expect(fixture.preparationInputs).toEqual([]);
    expect(fixture.stopCalls).toHaveLength(1);
    expect(fixture.pairedWrites).toEqual([]);
  });

  it("refuses restart completion and recovers an open repeated attempt without decisions", async () => {
    const fixture = checkpointCoordinatorFixture();
    const repeated = fixture.seedRepeatedCheckpoint();
    const attempt = await fixture.coordinator.beginNext({
      activationId: fixture.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        fixture.activationAttempt.paper_trading_comparison_activation_attempt_id,
      tickId: repeated.nextTick.paper_trading_comparison_tick_id,
      idempotencyKey: "checkpoint-002"
    });
    const restarted = fixture.createCoordinator();

    await expect(restarted.completeNext({
      checkpointAttemptId: attempt.paper_trading_comparison_checkpoint_attempt_id
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_checkpoint_not_owned"
    });
    await expect(restarted.recoverIncompleteCheckpoints()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkpoint_sequence: 2,
          outcome_status: "incomplete",
          outcome_reason: "restart_cleanup"
        })
      ])
    );
    expect(fixture.preparationInputs).toEqual([]);
    expect(fixture.stopCalls).toEqual([]);
    expect(fixture.activationRecoveryCalls).toBe(1);
  });

  it("recovers an open intent by cleanup without re-preparing candidate decisions", async () => {
    const fixture = checkpointCoordinatorFixture({ owned: false });
    const attempt = checkpointAttemptFixture(fixture);
    fixture.checkpointAttempts.push(attempt);

    const outcomes = await fixture.coordinator.recoverIncompleteCheckpoints();

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      outcome_status: "incomplete",
      outcome_reason: "restart_cleanup",
      stable_error_code: "paper_trading_comparison_checkpoint_restart_cleanup"
    });
    expect(fixture.activationRecoveryCalls).toBe(1);
    expect(fixture.preparationInputs).toEqual([]);
  });

  it("rematerializes a paired bundle then recovers unowned runtime sessions", async () => {
    const fixture = checkpointCoordinatorFixture({ owned: false });
    const attempt = checkpointAttemptFixture(fixture);
    const prepared = {
      champion: preparedCheckpointSide(
        "champion", attempt, fixture.tick, fixture.evaluations.champion
      ),
      challenger: preparedCheckpointSide(
        "challenger", attempt, fixture.tick, fixture.evaluations.challenger
      )
    };
    const paired = pairedCheckpointOutcome(attempt, prepared);
    fixture.checkpointAttempts.push(attempt);
    fixture.checkpointOutcomes.push(paired);

    await expect(fixture.coordinator.recoverIncompleteCheckpoints())
      .resolves.toEqual([paired]);
    expect(fixture.activationRecoveryCalls).toBe(1);
    expect(fixture.preparationInputs).toEqual([]);
  });
});

function checkpointCoordinatorFixture(
  options: {
    throwAfterPairedCommit?: boolean;
    owned?: boolean;
    advanceFailureRole?: "champion" | "challenger";
  } = {}
) {
  const tick = validTick();
  const ticks = [tick];
  const activation = validActivation(tick);
  const activationAttempt = validActivationAttempt(activation);
  const startResults = (["champion", "challenger"] as const).map((role) =>
    validStartResult(activationAttempt, role)
  );
  const activationOutcome = validActivationOutcome(activationAttempt, startResults);
  const evaluations = {
    champion: runningEvaluation(activation.champion, "champion"),
    challenger: runningEvaluation(activation.challenger, "challenger")
  };
  const observations: Record<
    "champion" | "challenger",
    PaperTradingObservationRecord[]
  > = { champion: [], challenger: [] };
  const events: string[] = [];
  const checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[] = [];
  const checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
  const tickAcknowledgements: PaperTradingComparisonTickAcknowledgementRecord[] = [];
  const pairedWrites: RecordPaperTradingComparisonPairedCheckpointInput[] = [];
  const preparationInputs: Array<
    Parameters<PaperTradingComparisonSessionPort["prepareComparisonCheckpointSide"]>[0]
  > = [];
  const advanceInputs: Array<
    Parameters<PaperTradingComparisonSessionPort["advanceComparisonCheckpointSide"]>[0]
  > = [];
  const preparations = {
    champion: deferred<PreparedPaperTradingComparisonCheckpointSide>(),
    challenger: deferred<PreparedPaperTradingComparisonCheckpointSide>()
  };
  const stopCalls: Array<{ attemptId: string; reason: "handoff_cleanup" }> = [];
  let activationRecoveryCalls = 0;

  const store = {
    async listPaperTradingComparisonCommitments() {
      return [{
        paper_trading_comparison_commitment_id:
          activation.paper_trading_comparison_commitment_ref.id
      }];
    },
    async getPaperTradingComparisonActivation(id: string) {
      return id === activation.paper_trading_comparison_activation_id
        ? structuredClone(activation)
        : undefined;
    },
    async listPaperTradingComparisonActivations() {
      return [structuredClone(activation)];
    },
    async getPaperTradingComparisonActivationAttempt(id: string) {
      return id === activationAttempt.paper_trading_comparison_activation_attempt_id
        ? structuredClone(activationAttempt)
        : undefined;
    },
    async listPaperTradingComparisonActivationAttempts() {
      return [structuredClone(activationAttempt)];
    },
    async listPaperTradingComparisonActivationSideResults() {
      return structuredClone(startResults);
    },
    async getPaperTradingComparisonActivationOutcome(id: string) {
      return id === activationOutcome.paper_trading_comparison_activation_outcome_id
        ? structuredClone(activationOutcome)
        : undefined;
    },
    async listPaperTradingComparisonActivationOutcomes() {
      return [structuredClone(activationOutcome)];
    },
    async getPaperTradingComparisonTick(id: string) {
      return structuredClone(ticks.find((record) =>
        record.paper_trading_comparison_tick_id === id
      ));
    },
    async listPaperTradingComparisonTicks() {
      return structuredClone(ticks);
    },
    async listPaperTradingComparisonTickAcknowledgements() {
      return structuredClone(tickAcknowledgements);
    },
    async getPaperTradingEvaluation(id: string) {
      return Object.values(evaluations).find((evaluation) =>
        evaluation.paper_trading_evaluation_id === id
      );
    },
    async listPaperTradingObservations(evaluationId: string) {
      const role = evaluations.champion.paper_trading_evaluation_id === evaluationId
        ? "champion"
        : "challenger";
      return structuredClone(observations[role]);
    },
    async getPaperTradingComparisonCheckpointAttempt(id: string) {
      return structuredClone(checkpointAttempts.find((attempt) =>
        attempt.paper_trading_comparison_checkpoint_attempt_id === id
      ));
    },
    async listPaperTradingComparisonCheckpointAttempts() {
      return structuredClone(checkpointAttempts);
    },
    async recordPaperTradingComparisonCheckpointAttempt(
      attempt: PaperTradingComparisonCheckpointAttemptRecord
    ) {
      events.push("checkpoint-attempt:recorded");
      checkpointAttempts.push(structuredClone(attempt));
      return structuredClone(attempt);
    },
    async getPaperTradingComparisonCheckpointOutcome(id: string) {
      return structuredClone(checkpointOutcomes.find((outcome) =>
        outcome.paper_trading_comparison_checkpoint_outcome_id === id
      ));
    },
    async listPaperTradingComparisonCheckpointOutcomes(attemptId: string) {
      return structuredClone(checkpointOutcomes.filter((outcome) =>
        outcome.checkpoint_attempt_ref.id === attemptId
      ));
    },
    async recordPaperTradingComparisonPairedCheckpoint(
      input: RecordPaperTradingComparisonPairedCheckpointInput
    ) {
      events.push("checkpoint:paired");
      pairedWrites.push(structuredClone(input));
      checkpointOutcomes.push(structuredClone(input.outcome));
      if (options.throwAfterPairedCommit) throw new Error("acknowledgement lost");
      return structuredClone(input.outcome);
    },
    async recordPaperTradingComparisonCheckpointOutcome(
      outcome: PaperTradingComparisonCheckpointOutcomeRecord
    ) {
      events.push("checkpoint:incomplete");
      checkpointOutcomes.push(structuredClone(outcome));
      return structuredClone(outcome);
    },
    async recoverPaperTradingComparisonCheckpointTransactions() {
      return structuredClone(checkpointOutcomes.filter((outcome) =>
        outcome.outcome_status === "paired"
      ));
    }
  } as unknown as OuroborosStorePort;
  const sessions = {
    async inspectComparisonSide(input: Parameters<
      PaperTradingComparisonSessionPort["inspectComparisonSide"]
    >[0]) {
      return {
        role: input.side.role,
        trading_run_ref: { ...input.side.trading_run_ref },
        paper_trading_evaluation_ref: { ...input.side.paper_trading_evaluation_ref },
        sandbox_ref: { record_kind: "sandbox", id: `${input.side.role}-sandbox` },
        runtime_lifecycle_status: "running",
        evaluation_status: "running",
        sandbox_lifecycle_status: "running",
        provider_request_count: 2,
        provider_session_active: true,
        observed_at: "2026-07-11T00:01:07.000Z",
        authority_status: "not_live"
      } as const;
    },
    async advanceComparisonCheckpointSide(input: Parameters<
      PaperTradingComparisonSessionPort["advanceComparisonCheckpointSide"]
    >[0]) {
      events.push(`advance:${input.side.role}`);
      advanceInputs.push(structuredClone(input));
      if (options.advanceFailureRole === input.side.role) {
        throw Object.assign(new Error("view advance failed"), {
          code: "paper_trading_comparison_checkpoint_view_advance_failed"
        });
      }
    },
    async prepareComparisonCheckpointSide(input: Parameters<
      PaperTradingComparisonSessionPort["prepareComparisonCheckpointSide"]
    >[0]) {
      events.push(`prepare:${input.side.role}`);
      preparationInputs.push(structuredClone(input));
      return preparations[input.side.role].promise;
    }
  } as unknown as PaperTradingComparisonSessionPort;
  const activations = {
    ownsRunningAttempt(id: string) {
      return options.owned !== false &&
        id === activationAttempt.paper_trading_comparison_activation_attempt_id;
    },
    async stopOwnedAttempt(input: { attemptId: string; reason: "handoff_cleanup" }) {
      events.push("activation:handoff-cleanup");
      stopCalls.push(structuredClone(input));
      return { status: "stopped_cleanly" } as PaperTradingComparisonRuntimeActivationResult;
    },
    async recoverIncompleteActivations() {
      activationRecoveryCalls += 1;
      return checkpointAttempts.map(() => ({
        status: "stopped_cleanly",
        attempt: structuredClone(activationAttempt)
      } as PaperTradingComparisonRuntimeActivationResult));
    }
  };
  let currentNow = "2026-07-11T00:00:08.000Z";
  const createCoordinator = () => new PaperTradingComparisonCheckpointCoordinator({
    store,
    sessions,
    activations,
    now: () => currentNow
  });
  const coordinator = createCoordinator();
  const seedRepeatedCheckpoint = () => {
    const firstAttempt = checkpointAttemptFixture({
      activation,
      activationAttempt,
      activationOutcome,
      tick,
      evaluations
    });
    const firstPrepared = {
      champion: preparedCheckpointSide(
        "champion",
        firstAttempt,
        tick,
        evaluations.champion
      ),
      challenger: preparedCheckpointSide(
        "challenger",
        firstAttempt,
        tick,
        evaluations.challenger
      )
    };
    const firstOutcome = pairedCheckpointOutcome(firstAttempt, firstPrepared);
    checkpointAttempts.push(structuredClone(firstAttempt));
    checkpointOutcomes.push(structuredClone(firstOutcome));
    for (const role of ["champion", "challenger"] as const) {
      evaluations[role] = structuredClone(firstPrepared[role].evaluation);
      observations[role] = [structuredClone(firstPrepared[role].observation)];
    }
    const nextTick = validNextTick(tick);
    ticks.push(structuredClone(nextTick));
    currentNow = "2026-07-11T00:01:08.000Z";
    return { firstAttempt, firstPrepared, firstOutcome, nextTick };
  };
  const acknowledgeRepeatedTick = (
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ) => {
    const records = (["champion", "challenger"] as const).map((role) =>
      validTickAcknowledgement(attempt, role)
    );
    tickAcknowledgements.push(...structuredClone(records));
    return records;
  };
  return {
    coordinator,
    createCoordinator,
    input: {
      activationId: activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        activationAttempt.paper_trading_comparison_activation_attempt_id,
      idempotencyKey: "checkpoint-001"
    },
    tick,
    activation,
    activationAttempt,
    activationOutcome,
    evaluations,
    observations,
    ticks,
    events,
    checkpointAttempts,
    checkpointOutcomes,
    pairedWrites,
    preparationInputs,
    advanceInputs,
    preparations,
    stopCalls,
    seedRepeatedCheckpoint,
    acknowledgeRepeatedTick,
    get activationRecoveryCalls() { return activationRecoveryCalls; }
  };
}

function validTick(): PaperTradingComparisonTickRecord {
  const draft: PaperTradingComparisonTickRecord = {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "checkpoint-tick-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison-1",
    sequence: 1,
    market_data_configuration_digest: "sha256:market-1",
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-11T00:00:00.000Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "checkpoint-tick-1",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:00.000Z",
    tick_digest: "",
    authority_status: "not_live"
  };
  return withDigest(draft, "tick_digest", paperTradingComparisonTickDigestInput);
}

function validNextTick(
  previous: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  const draft: PaperTradingComparisonTickRecord = {
    ...structuredClone(previous),
    paper_trading_comparison_tick_id: "checkpoint-tick-2",
    sequence: 2,
    previous_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: previous.paper_trading_comparison_tick_id
    },
    previous_tick_digest: previous.tick_digest,
    market_snapshot: {
      ...structuredClone(previous.market_snapshot),
      price: previous.market_snapshot.price + 100,
      observed_at: "2026-07-11T00:01:00.000Z"
    },
    public_execution_snapshot: {
      ...structuredClone(previous.public_execution_snapshot),
      observed_at: "2026-07-11T00:01:00.000Z",
      stream_marker: "checkpoint-tick-2"
    },
    observed_at: "2026-07-11T00:01:00.000Z",
    tick_digest: ""
  };
  return withDigest(draft, "tick_digest", paperTradingComparisonTickDigestInput);
}

function validActivation(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonActivationRecord {
  const side = (role: "champion" | "challenger") => ({
    role,
    trading_run_ref: { record_kind: "trading_run" as const, id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment" as const,
      id: `${role}-evaluation-commitment`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation" as const,
      id: `${role}-evaluation`
    }
  });
  const draft: PaperTradingComparisonActivationRecord = {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: "activation-1",
    paper_trading_comparison_commitment_ref: {
      ...tick.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      tick.paper_trading_comparison_commitment_digest,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    first_tick_digest: tick.tick_digest,
    champion: side("champion"),
    challenger: side("challenger"),
    market_data_configuration_digest: tick.market_data_configuration_digest,
    activation_policy: {
      policy_version: "paper-comparison-activation-v1",
      maximum_start_skew_ms: 5_000,
      maximum_retry_count_per_side: 3,
      maximum_provider_request_count_per_side: 5,
      maximum_activation_elapsed_ms: 60_000,
      cleanup_timeout_ms: 10_000,
      require_both_running_before_observation: true,
      partial_start_policy: "stop_started_side_before_retry",
      restart_policy: "recover_both_or_stop_both",
      market_view_policy: "first_tick_then_contiguous_persisted_ticks"
    },
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: "2026-07-11T00:00:01.000Z",
    activation_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  };
  return withDigest(draft, "activation_digest", paperTradingComparisonActivationDigestInput);
}

function validActivationAttempt(
  activation: PaperTradingComparisonActivationRecord
): PaperTradingComparisonActivationAttemptRecord {
  const draft: PaperTradingComparisonActivationAttemptRecord = {
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id: "activation-attempt-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: activation.activation_digest,
    paper_trading_comparison_commitment_ref: {
      ...activation.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      activation.paper_trading_comparison_commitment_digest,
    first_tick_ref: { ...activation.first_tick_ref },
    first_tick_digest: activation.first_tick_digest,
    champion: structuredClone(activation.champion),
    challenger: structuredClone(activation.challenger),
    activation_policy: structuredClone(activation.activation_policy),
    attempt_sequence: 1,
    retry_index: 0,
    start_mode: "parallel",
    attempt_status: "starting",
    attempted_at: "2026-07-11T00:00:02.000Z",
    start_deadline_at: "2026-07-11T00:01:02.000Z",
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "attempt_digest",
    paperTradingComparisonActivationAttemptDigestInput
  );
}

function validStartResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger"
): PaperTradingComparisonActivationSideResultRecord {
  const draft: PaperTradingComparisonActivationSideResultRecord = {
    record_kind: "paper_trading_comparison_activation_side_result",
    version: 1,
    paper_trading_comparison_activation_side_result_id: `${role}-start-result`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    role,
    operation_sequence: 1,
    operation: "start",
    reason: "symmetric_start",
    outcome: "succeeded",
    trading_run_ref: { ...attempt[role].trading_run_ref },
    paper_trading_evaluation_ref: {
      ...attempt[role].paper_trading_evaluation_ref
    },
    sandbox_ref: { record_kind: "sandbox", id: `${role}-sandbox` },
    runtime_lifecycle_status: "running",
    evaluation_status: "running",
    provider_request_count: 2,
    effect_started_at: "2026-07-11T00:00:03.000Z",
    effect_completed_at: "2026-07-11T00:00:05.000Z",
    side_result_digest: "",
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "side_result_digest",
    paperTradingComparisonActivationSideResultDigestInput
  );
}

function validActivationOutcome(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  results: PaperTradingComparisonActivationSideResultRecord[]
): PaperTradingComparisonActivationOutcomeRecord {
  const draft: PaperTradingComparisonActivationOutcomeRecord = {
    record_kind: "paper_trading_comparison_activation_outcome",
    version: 1,
    paper_trading_comparison_activation_outcome_id: "activation-outcome-1",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    outcome_sequence: 1,
    outcome_status: "both_running",
    outcome_reason: "started_within_policy",
    champion_latest_result_ref: {
      record_kind: "paper_trading_comparison_activation_side_result",
      id: results.find((result) => result.role === "champion")!
        .paper_trading_comparison_activation_side_result_id
    },
    challenger_latest_result_ref: {
      record_kind: "paper_trading_comparison_activation_side_result",
      id: results.find((result) => result.role === "challenger")!
        .paper_trading_comparison_activation_side_result_id
    },
    next_action: "capture_first_paired_checkpoint",
    completed_at: "2026-07-11T00:00:06.000Z",
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "outcome_digest",
    paperTradingComparisonActivationOutcomeDigestInput
  );
}

function runningEvaluation(
  side: PaperTradingComparisonActivationRecord["champion"],
  role: "champion" | "challenger"
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: side.paper_trading_evaluation_ref.id,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...side.paper_trading_evaluation_commitment_ref
    },
    status: "running",
    interval_ms: 60_000,
    observation_count: 0,
    started_at: "2026-07-11T00:00:03.000Z",
    next_observation_at: "2026-07-11T00:01:03.000Z",
    latest_score: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
    paper_account_snapshot: structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function preparedCheckpointSide(
  role: "champion" | "challenger",
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  tick: PaperTradingComparisonTickRecord,
  current: PaperTradingEvaluationRecord
): PreparedPaperTradingComparisonCheckpointSide {
  const sequence = attempt.checkpoint_sequence;
  const acknowledgement = sequence > 1
    ? validTickAcknowledgement(attempt, role)
    : undefined;
  const observation: PaperTradingObservationRecord = {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `${role}-observation-${sequence}`,
    paper_trading_evaluation_ref: { ...attempt[role].paper_trading_evaluation_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-evaluation-commitment`
    },
    paper_trading_comparison_tick_ref: { ...attempt.tick_ref },
    paper_trading_comparison_tick_digest: attempt.tick_digest,
    ...(sequence > 1 ? {
      paper_trading_comparison_tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: acknowledgement!
          .paper_trading_comparison_tick_acknowledgement_id
      },
      paper_trading_comparison_tick_acknowledgement_digest:
        acknowledgement!.acknowledgement_digest
    } : {}),
    paper_trading_comparison_checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    paper_trading_comparison_checkpoint_attempt_digest: attempt.attempt_digest,
    candidate_ref: { ...current.candidate_ref },
    candidate_version_ref: { ...current.candidate_version_ref },
    trading_run_ref: { ...current.trading_run_ref },
    sequence,
    status: "no_order",
    observed_at: tick.observed_at,
    market_snapshot: structuredClone(tick.market_snapshot),
    public_execution_snapshot: structuredClone(tick.public_execution_snapshot),
    paper_account_snapshot: structuredClone(current.paper_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: structuredClone(
      current.processed_trading_system_event_ids ?? []
    ),
    processed_public_trade_ids: structuredClone(
      current.processed_public_trade_ids ?? []
    ),
    score_delta: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
    cumulative_score: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
    authority_status: "not_live"
  };
  const evaluation: PaperTradingEvaluationRecord = {
    ...structuredClone(current),
    observation_count: current.observation_count + 1,
    last_observed_at: tick.observed_at,
    next_observation_at: new Date(
      Date.parse(tick.observed_at) + current.interval_ms
    ).toISOString(),
    latest_public_execution_snapshot: structuredClone(tick.public_execution_snapshot)
  };
  const withoutDigest = {
    role,
    ledger_inputs: [],
    ledger_outcomes: [],
    observation,
    evaluation,
    consumed_event_count: 0,
    provider_request_count_after: attempt[role].provider_request_count_before
  };
  return {
    ...withoutDigest,
    preparation_digest: canonicalRecordDigest(withoutDigest)
  };
}

function validTickAcknowledgement(
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  role: "champion" | "challenger"
): PaperTradingComparisonTickAcknowledgementRecord {
  const draft: PaperTradingComparisonTickAcknowledgementRecord = {
    record_kind: "paper_trading_comparison_tick_acknowledgement",
    version: 1,
    paper_trading_comparison_tick_acknowledgement_id:
      `${role}-acknowledgement-${attempt.checkpoint_sequence}`,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery",
      id: `${role}-delivery-${attempt.checkpoint_sequence}`
    },
    delivery_digest: `sha256:${role}-delivery-${attempt.checkpoint_sequence}`,
    paper_trading_comparison_activation_attempt_ref: {
      ...attempt.paper_trading_comparison_activation_attempt_ref
    },
    paper_trading_comparison_activation_attempt_digest:
      attempt.paper_trading_comparison_activation_attempt_digest,
    role,
    trading_run_ref: { ...attempt[role].trading_run_ref },
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    tick_sequence: attempt.checkpoint_sequence,
    provider_request_count_at_acknowledgement:
      attempt[role].provider_request_count_before,
    endpoint: "POST /comparison/tick/ack",
    acknowledged_at: "2026-07-11T00:01:08.500Z",
    acknowledgement_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "acknowledgement_digest",
    paperTradingComparisonTickAcknowledgementDigestInput
  );
}

function failedPreparedCheckpointSide(
  role: "champion" | "challenger",
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  tick: PaperTradingComparisonTickRecord,
  current: PaperTradingEvaluationRecord
): PreparedPaperTradingComparisonCheckpointSide {
  const prepared = preparedCheckpointSide(role, attempt, tick, current);
  const withoutDigest = {
    ...prepared,
    observation: {
      ...prepared.observation,
      status: "failed" as const,
      failure_reason: "candidate_protocol_error"
    },
    evaluation: {
      ...prepared.evaluation,
      status: "failed" as const,
      next_observation_at: undefined,
      latest_failure_reason: "candidate_protocol_error"
    },
    preparation_digest: undefined
  };
  const { preparation_digest: _digest, ...payload } = withoutDigest;
  return {
    ...payload,
    preparation_digest: canonicalRecordDigest(payload)
  };
}

function withPreparedDigest(
  prepared: PreparedPaperTradingComparisonCheckpointSide
): PreparedPaperTradingComparisonCheckpointSide {
  const { preparation_digest: _digest, ...payload } = prepared;
  return {
    ...payload,
    preparation_digest: canonicalRecordDigest(payload)
  };
}

function checkpointAttemptFixture(fixture: {
  activation: PaperTradingComparisonActivationRecord;
  activationAttempt: PaperTradingComparisonActivationAttemptRecord;
  activationOutcome: PaperTradingComparisonActivationOutcomeRecord;
  tick: PaperTradingComparisonTickRecord;
  evaluations: Record<"champion" | "challenger", PaperTradingEvaluationRecord>;
}): PaperTradingComparisonCheckpointAttemptRecord {
  const side = (role: "champion" | "challenger") => ({
    role,
    trading_run_ref: { ...fixture.activationAttempt[role].trading_run_ref },
    paper_trading_evaluation_ref: {
      ...fixture.activationAttempt[role].paper_trading_evaluation_ref
    },
    evaluation_record_digest: canonicalDigest(
      paperTradingComparisonEvaluationRecordDigestInput(fixture.evaluations[role])
    ),
    observation_chain_digest: canonicalDigest(
      paperTradingComparisonObservationChainDigestInput([])
    ),
    provider_request_count_before: 2
  });
  const draft: PaperTradingComparisonCheckpointAttemptRecord = {
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id: "recovery-checkpoint-attempt-1",
    paper_trading_comparison_activation_ref: {
      ...fixture.activationAttempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      fixture.activationAttempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.activationAttempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest:
      fixture.activationAttempt.attempt_digest,
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: fixture.activationOutcome.paper_trading_comparison_activation_outcome_id
    },
    activation_outcome_digest: fixture.activationOutcome.outcome_digest,
    paper_trading_comparison_commitment_ref: {
      ...fixture.activationAttempt.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      fixture.activationAttempt.paper_trading_comparison_commitment_digest,
    tick_ref: { ...fixture.activationAttempt.first_tick_ref },
    tick_digest: fixture.activationAttempt.first_tick_digest,
    checkpoint_sequence: 1,
    champion: side("champion"),
    challenger: side("challenger"),
    attempted_at: "2026-07-11T00:00:08.000Z",
    checkpoint_deadline_at: "2026-07-11T00:01:08.000Z",
    attempt_status: "preparing",
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "attempt_digest",
    paperTradingComparisonCheckpointAttemptDigestInput
  );
}

function pairedCheckpointOutcome(
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  prepared: Record<"champion" | "challenger", PreparedPaperTradingComparisonCheckpointSide>
): PaperTradingComparisonCheckpointOutcomeRecord {
  const side = (role: "champion" | "challenger") => ({
    role,
    observation_ref: {
      record_kind: "paper_trading_observation" as const,
      id: prepared[role].observation.paper_trading_observation_id
    },
    observation_record_digest: canonicalRecordDigest(prepared[role].observation),
    evaluation_record_digest: canonicalDigest(
      paperTradingComparisonEvaluationRecordDigestInput(prepared[role].evaluation)
    ),
    ledger_chain_refs: [],
    observation_status: prepared[role].observation.status,
    consumed_event_count: prepared[role].consumed_event_count,
    provider_request_count_after: prepared[role].provider_request_count_after,
    ...(attempt.checkpoint_sequence > 1 ? {
      tick_acknowledgement_ref: {
        ...prepared[role].observation
          .paper_trading_comparison_tick_acknowledgement_ref!
      },
      tick_acknowledgement_digest: prepared[role].observation
        .paper_trading_comparison_tick_acknowledgement_digest!
    } : {})
  });
  const draft: PaperTradingComparisonCheckpointOutcomeRecord = {
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id:
      `recovery-checkpoint-outcome-${attempt.checkpoint_sequence}`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    checkpoint_sequence: attempt.checkpoint_sequence,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: side("champion"),
    challenger: side("challenger"),
    next_action: attempt.checkpoint_sequence === 1
      ? "serve_and_acknowledge_current_tick"
      : "capture_next_tick",
    completed_at: attempt.checkpoint_sequence === 1
      ? "2026-07-11T00:00:09.000Z"
      : "2026-07-11T00:01:09.000Z",
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return withDigest(
    draft,
    "outcome_digest",
    paperTradingComparisonCheckpointOutcomeDigestInput
  );
}

function withDigest<T extends object, K extends keyof T>(
  value: T,
  key: K,
  digestInput: (record: T) => string
): T {
  return {
    ...value,
    [key]: canonicalDigest(digestInput(value))
  };
}

function canonicalRecordDigest(value: unknown): string {
  return canonicalDigest(paperTradingComparisonPersistedRecordDigestInput(value));
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForPreparations(
  pending: Promise<unknown>,
  inputs: unknown[]
): Promise<void> {
  await Promise.race([
    pending.then(
      () => Promise.reject(new Error("checkpoint settled before both preparations")),
      (error) => Promise.reject(error)
    ),
    vi.waitFor(() => expect(inputs).toHaveLength(2))
  ]);
}
