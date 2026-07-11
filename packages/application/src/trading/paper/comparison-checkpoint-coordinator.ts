import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonActivationSideResultHasRuntimeShape,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointAttemptHasRuntimeShape,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonCheckpointOutcomeHasRuntimeShape,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSideResultRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeReason,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCheckpointWriteContext,
  type PaperTradingComparisonTickRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord
} from "@ouroboros/domain";
import type { PaperTradingComparisonSessionPort } from "../../ports/paper-comparison-session";
import {
  isStoreErrorLike,
  type OuroborosStorePort,
  type PreparedPaperTradingComparisonCheckpointSide
} from "../../ports/store";
import type {
  PaperTradingComparisonRuntimeActivationCoordinator,
  PaperTradingComparisonRuntimeActivationResult
} from "./comparison-runtime-activation-coordinator";

type Role = "champion" | "challenger";

const ROLES: readonly Role[] = ["champion", "challenger"];
const CHECKPOINT_TIMEOUT_MS = 60_000;

export type PaperTradingComparisonCheckpointCoordinatorErrorCode =
  | "invalid_paper_trading_comparison_checkpoint_input"
  | "paper_trading_comparison_checkpoint_graph_invalid"
  | "paper_trading_comparison_checkpoint_not_owned"
  | "paper_trading_comparison_checkpoint_deadline_exceeded"
  | "paper_trading_comparison_checkpoint_side_preparation_failed"
  | "paper_trading_comparison_checkpoint_cleanup_failed"
  | "paper_trading_comparison_checkpoint_persistence_failed"
  | "paper_trading_comparison_checkpoint_recovery_failed";

export class PaperTradingComparisonCheckpointCoordinatorError extends Error {
  constructor(
    readonly code: PaperTradingComparisonCheckpointCoordinatorErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonCheckpointCoordinatorError";
  }
}

type ActivationCoordinatorPort = Pick<
  PaperTradingComparisonRuntimeActivationCoordinator,
  "ownsRunningAttempt" | "stopOwnedAttempt" | "recoverIncompleteActivations"
>;

export interface PaperTradingComparisonCheckpointCoordinatorOptions {
  store: OuroborosStorePort;
  sessions: PaperTradingComparisonSessionPort;
  activations: ActivationCoordinatorPort;
  now?: () => string;
}

interface LoadedCheckpointGraph {
  activation: PaperTradingComparisonActivationRecord;
  activationAttempt: PaperTradingComparisonActivationAttemptRecord;
  activationOutcome: PaperTradingComparisonActivationOutcomeRecord;
  tick: PaperTradingComparisonTickRecord;
  startResults: Record<Role, PaperTradingComparisonActivationSideResultRecord>;
  evaluations: Record<Role, PaperTradingEvaluationRecord>;
  observations: Record<Role, PaperTradingObservationRecord[]>;
}

interface SidePreparationSettlement {
  role: Role;
  status: "fulfilled" | "rejected" | "timed_out";
  prepared?: PreparedPaperTradingComparisonCheckpointSide;
  stableErrorCode?: string;
}

export class PaperTradingComparisonCheckpointCoordinator {
  private readonly now: () => string;
  private checkpointQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: PaperTradingComparisonCheckpointCoordinatorOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  captureFirst(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    return this.withCheckpointQueue(() => this.captureFirstUnlocked(input));
  }

  recoverIncompleteCheckpoints(): Promise<PaperTradingComparisonCheckpointOutcomeRecord[]> {
    return this.withCheckpointQueue(() => this.recoverIncompleteCheckpointsUnlocked());
  }

  private withCheckpointQueue<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.checkpointQueue.then(task);
    this.checkpointQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async captureFirstUnlocked(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    const normalized = normalizeCaptureInput(input);
    const graph = await this.loadCheckpointGraph(
      normalized.activationId,
      normalized.activationAttemptId
    );
    const attemptId = deterministicRecordId(
      "paper-comparison-checkpoint-attempt",
      `${normalized.activationAttemptId}:${normalized.idempotencyKey}:1`
    );
    const existing = await this.options.store.getPaperTradingComparisonCheckpointAttempt(
      attemptId
    );
    if (existing) {
      this.assertExistingAttemptMatchesGraph(existing, graph);
      const outcomes = await this.readCheckpointOutcomes(existing);
      const outcome = outcomes.at(-1);
      if (outcome) return outcome;
      return this.failAttempt({
        attempt: existing,
        reason: "restart_cleanup",
        stableErrorCode: "paper_trading_comparison_checkpoint_open_attempt_replayed"
      });
    }
    if (!this.options.activations.ownsRunningAttempt(normalized.activationAttemptId)) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_not_owned",
        "Paper comparison checkpoint requires the in-process owned running attempt."
      );
    }

    const attemptedAt = new Date(Math.max(
      Date.parse(this.readNow()),
      Date.parse(graph.activationOutcome.completed_at) + 1
    )).toISOString();
    const checkpointDeadlineAt = new Date(
      Date.parse(attemptedAt) + CHECKPOINT_TIMEOUT_MS
    ).toISOString();
    const attempt = buildCheckpointAttempt({
      graph,
      attemptId,
      attemptedAt,
      checkpointDeadlineAt
    });
    await this.persistCheckpointAttempt(attempt);

    const controller = new AbortController();
    const deadline = deadlineSignal(
      attempt.checkpoint_deadline_at,
      this.readNow(),
      controller
    );
    const settlements = await Promise.all(ROLES.map((role) =>
      this.prepareSide({ attempt, graph, role, controller, deadline: deadline.promise })
    ));
    deadline.cancel();
    const rejected = settlements.find((settlement) => settlement.status !== "fulfilled");
    if (rejected) {
      controller.abort();
      return this.failAttempt({
        attempt,
        reason: rejected.status === "timed_out"
          ? "side_preparation_timed_out"
          : rejected.stableErrorCode ===
              "paper_trading_comparison_provider_request_budget_exceeded"
            ? "provider_request_budget_exceeded"
            : "side_preparation_failed",
        stableErrorCode: rejected.stableErrorCode ??
          "paper_trading_comparison_checkpoint_side_preparation_failed"
      });
    }

    const prepared = Object.fromEntries(settlements.map((settlement) => [
      settlement.role,
      settlement.prepared!
    ])) as Record<Role, PreparedPaperTradingComparisonCheckpointSide>;
    try {
      for (const role of ROLES) {
        this.assertPreparedSide(prepared[role], attempt, graph, role);
      }
    } catch (error) {
      const requestBudgetExceeded = ROLES.some((role) =>
        prepared[role].provider_request_count_after >
          graph.activationAttempt.activation_policy
            .maximum_provider_request_count_per_side
      );
      return this.failAttempt({
        attempt,
        reason: requestBudgetExceeded
          ? "provider_request_budget_exceeded"
          : "side_preparation_failed",
        stableErrorCode: stableErrorCode(
          error,
          "paper_trading_comparison_checkpoint_side_preparation_failed"
        )
      });
    }
    const completedAt = this.readNow();
    if (Date.parse(completedAt) > Date.parse(attempt.checkpoint_deadline_at)) {
      return this.failAttempt({
        attempt,
        reason: "checkpoint_deadline_exceeded",
        stableErrorCode: "paper_trading_comparison_checkpoint_deadline_exceeded"
      });
    }
    const outcome = buildPairedOutcome({ attempt, prepared, completedAt });
    try {
      const persisted = await this.options.store.recordPaperTradingComparisonPairedCheckpoint({
        attempt,
        outcome,
        champion: prepared.champion,
        challenger: prepared.challenger
      });
      if (!isDeepStrictEqual(persisted, outcome)) throw new Error("paired reload mismatch");
    } catch (error) {
      const recovered = await this.readExactOutcome(outcome);
      if (recovered) return recovered;
      return this.failAttempt({
        attempt,
        reason: "paired_persistence_failed",
        stableErrorCode: isStoreErrorLike(error)
          ? error.code
          : "paper_trading_comparison_checkpoint_persistence_failed"
      });
    }
    if (ROLES.some((role) => prepared[role].evaluation.status === "failed")) {
      await this.stopAfterPairedCandidateFailure(attempt);
    }
    return outcome;
  }

  private async loadCheckpointGraph(
    activationId: string,
    activationAttemptId: string
  ): Promise<LoadedCheckpointGraph> {
    let activation: unknown;
    let activationAttempt: unknown;
    try {
      [activation, activationAttempt] = await Promise.all([
        this.options.store.getPaperTradingComparisonActivation(activationId),
        this.options.store.getPaperTradingComparisonActivationAttempt(activationAttemptId)
      ]);
    } catch {
      throw graphInvalid();
    }
    if (!paperTradingComparisonActivationHasRuntimeShape(activation) ||
      activation.paper_trading_comparison_activation_id !== activationId ||
      activation.activation_digest !== canonicalDigest(
        paperTradingComparisonActivationDigestInput(activation)
      ) ||
      !paperTradingComparisonActivationAttemptHasRuntimeShape(activationAttempt) ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !==
        activationAttemptId ||
      activationAttempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(activationAttempt)
      ) ||
      activationAttempt.paper_trading_comparison_activation_ref.id !== activationId ||
      activationAttempt.paper_trading_comparison_activation_digest !==
        activation.activation_digest) {
      throw graphInvalid();
    }
    let attempts: unknown;
    let activationOutcomes: unknown;
    let sideResults: unknown;
    let tick: unknown;
    let ticks: unknown;
    let activations: unknown;
    try {
      [attempts, activationOutcomes, sideResults, tick, ticks, activations] =
        await Promise.all([
          this.options.store.listPaperTradingComparisonActivationAttempts(activationId),
          this.options.store.listPaperTradingComparisonActivationOutcomes(
            activationAttemptId
          ),
          this.options.store.listPaperTradingComparisonActivationSideResults(
            activationAttemptId
          ),
          this.options.store.getPaperTradingComparisonTick(
            activationAttempt.first_tick_ref.id
          ),
          this.options.store.listPaperTradingComparisonTicks(
            activation.paper_trading_comparison_commitment_ref.id
          ),
          this.options.store.listPaperTradingComparisonActivations(
            activation.paper_trading_comparison_commitment_ref.id
          )
        ]);
    } catch {
      throw graphInvalid();
    }
    if (!Array.isArray(attempts) ||
      !isDeepStrictEqual(attempts.at(-1), activationAttempt) ||
      !Array.isArray(activationOutcomes) ||
      !Array.isArray(sideResults) ||
      !paperTradingComparisonTickHasRuntimeShape(tick) ||
      tick.tick_digest !== canonicalDigest(paperTradingComparisonTickDigestInput(tick)) ||
      tick.paper_trading_comparison_tick_id !== activationAttempt.first_tick_ref.id ||
      tick.tick_digest !== activationAttempt.first_tick_digest ||
      !Array.isArray(ticks) || ticks.length !== 1 || !isDeepStrictEqual(ticks[0], tick) ||
      !Array.isArray(activations) || activations.length !== 1 ||
      !isDeepStrictEqual(activations[0], activation)) {
      throw graphInvalid();
    }
    const activationOutcome = activationOutcomes.at(-1);
    if (!paperTradingComparisonActivationOutcomeHasRuntimeShape(activationOutcome) ||
      activationOutcome.outcome_status !== "both_running" ||
      activationOutcome.paper_trading_comparison_activation_attempt_ref.id !==
        activationAttemptId ||
      activationOutcome.paper_trading_comparison_activation_attempt_digest !==
        activationAttempt.attempt_digest ||
      activationOutcome.outcome_digest !== canonicalDigest(
        paperTradingComparisonActivationOutcomeDigestInput(activationOutcome)
      )) {
      throw graphInvalid();
    }
    const latestStartResults = {} as Record<
      Role,
      PaperTradingComparisonActivationSideResultRecord
    >;
    for (const role of ROLES) {
      const roleResults = sideResults.filter((value): value is
        PaperTradingComparisonActivationSideResultRecord =>
        paperTradingComparisonActivationSideResultHasRuntimeShape(value) &&
        value.role === role
      );
      const result = roleResults.at(-1);
      if (!result || result.operation !== "start" || result.outcome !== "succeeded" ||
        result.side_result_digest !== canonicalDigest(
          paperTradingComparisonActivationSideResultDigestInput(result)
        ) ||
        result.paper_trading_comparison_activation_attempt_ref.id !==
          activationAttemptId ||
        !paperTradingComparisonRefsEqual(
          result.trading_run_ref,
          activationAttempt[role].trading_run_ref
        ) ||
        !paperTradingComparisonRefsEqual(
          result.paper_trading_evaluation_ref,
          activationAttempt[role].paper_trading_evaluation_ref
        )) {
        throw graphInvalid();
      }
      latestStartResults[role] = result;
    }
    const evaluations = {} as Record<Role, PaperTradingEvaluationRecord>;
    const observations = {} as Record<Role, PaperTradingObservationRecord[]>;
    for (const role of ROLES) {
      const evaluation = await this.options.store.getPaperTradingEvaluation(
        activationAttempt[role].paper_trading_evaluation_ref.id
      );
      const sideObservations = await this.options.store.listPaperTradingObservations(
        activationAttempt[role].paper_trading_evaluation_ref.id
      );
      if (!evaluation || evaluation.status !== "running" ||
        evaluation.observation_count !== 0 || !Array.isArray(sideObservations) ||
        sideObservations.length !== 0 ||
        evaluation.trading_run_ref.id !==
          activationAttempt[role].trading_run_ref.id) {
        throw graphInvalid();
      }
      evaluations[role] = evaluation;
      observations[role] = sideObservations;
    }
    return {
      activation,
      activationAttempt,
      activationOutcome,
      tick,
      startResults: latestStartResults,
      evaluations,
      observations
    };
  }

  private assertExistingAttemptMatchesGraph(
    attempt: PaperTradingComparisonCheckpointAttemptRecord,
    graph: LoadedCheckpointGraph
  ): void {
    if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(attempt) ||
      attempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(attempt)
      ) ||
      attempt.paper_trading_comparison_activation_ref.id !==
        graph.activation.paper_trading_comparison_activation_id ||
      attempt.paper_trading_comparison_activation_digest !==
        graph.activation.activation_digest ||
      attempt.paper_trading_comparison_activation_attempt_ref.id !==
        graph.activationAttempt.paper_trading_comparison_activation_attempt_id ||
      attempt.paper_trading_comparison_activation_attempt_digest !==
        graph.activationAttempt.attempt_digest ||
      attempt.activation_outcome_ref.id !==
        graph.activationOutcome.paper_trading_comparison_activation_outcome_id ||
      attempt.activation_outcome_digest !== graph.activationOutcome.outcome_digest ||
      attempt.tick_ref.id !== graph.tick.paper_trading_comparison_tick_id ||
      attempt.tick_digest !== graph.tick.tick_digest) {
      throw graphInvalid();
    }
  }

  private async persistCheckpointAttempt(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<void> {
    try {
      const persisted = await this.options.store
        .recordPaperTradingComparisonCheckpointAttempt(attempt);
      const reloaded = await this.options.store.getPaperTradingComparisonCheckpointAttempt(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      );
      if (!isDeepStrictEqual(persisted, attempt) || !isDeepStrictEqual(reloaded, attempt)) {
        throw new Error("checkpoint attempt reload mismatch");
      }
    } catch (error) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_persistence_failed",
        "Paper comparison checkpoint attempt could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }
  }

  private async prepareSide(input: {
    attempt: PaperTradingComparisonCheckpointAttemptRecord;
    graph: LoadedCheckpointGraph;
    role: Role;
    controller: AbortController;
    deadline: Promise<void>;
  }): Promise<SidePreparationSettlement> {
    const authority = checkpointWriteContext(input.attempt, input.role);
    const raw = Promise.resolve().then(() =>
      this.options.sessions.prepareComparisonCheckpointSide({
        side: structuredClone(input.graph.activationAttempt[input.role]),
        authority,
        tick: structuredClone(input.graph.tick),
        deadlineAt: input.attempt.checkpoint_deadline_at,
        maximumProviderRequestCount:
          input.graph.activationAttempt.activation_policy
            .maximum_provider_request_count_per_side,
        signal: input.controller.signal
      })
    );
    return Promise.race([
      raw.then<SidePreparationSettlement, SidePreparationSettlement>(
        (prepared) => ({ role: input.role, status: "fulfilled", prepared }),
        (error) => ({
          role: input.role,
          status: "rejected",
          stableErrorCode: stableErrorCode(
            error,
            "paper_trading_comparison_checkpoint_side_preparation_failed"
          )
        })
      ),
      input.deadline.then<SidePreparationSettlement>(() => ({
        role: input.role,
        status: "timed_out",
        stableErrorCode: "paper_trading_comparison_checkpoint_side_timed_out"
      }))
    ]);
  }

  private assertPreparedSide(
    prepared: PreparedPaperTradingComparisonCheckpointSide,
    attempt: PaperTradingComparisonCheckpointAttemptRecord,
    graph: LoadedCheckpointGraph,
    role: Role
  ): void {
    const { preparation_digest: _digest, ...payload } = prepared;
    const baselineRequestCount = attempt[role].provider_request_count_before;
    if (prepared.role !== role ||
      prepared.preparation_digest !== canonicalRecordDigest(payload) ||
      prepared.ledger_inputs.length !== prepared.ledger_outcomes.length ||
      !Number.isInteger(prepared.consumed_event_count) ||
      prepared.consumed_event_count < 0 ||
      !Number.isInteger(prepared.provider_request_count_after) ||
      prepared.provider_request_count_after < baselineRequestCount ||
      prepared.provider_request_count_after >
        graph.activationAttempt.activation_policy.maximum_provider_request_count_per_side ||
      prepared.observation.paper_trading_evaluation_ref.id !==
        attempt[role].paper_trading_evaluation_ref.id ||
      prepared.observation.paper_trading_comparison_tick_ref?.id !== attempt.tick_ref.id ||
      prepared.observation.paper_trading_comparison_tick_digest !== attempt.tick_digest ||
      prepared.observation.paper_trading_comparison_checkpoint_attempt_ref?.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      prepared.observation.paper_trading_comparison_checkpoint_attempt_digest !==
        attempt.attempt_digest ||
      prepared.evaluation.paper_trading_evaluation_id !==
        attempt[role].paper_trading_evaluation_ref.id ||
      prepared.evaluation.observation_count !== 1 ||
      prepared.evaluation.last_observed_at !== graph.tick.observed_at) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_side_preparation_failed",
        `Paper comparison ${role} checkpoint preparation is malformed.`
      );
    }
  }

  private async failAttempt(input: {
    attempt: PaperTradingComparisonCheckpointAttemptRecord;
    reason: Exclude<PaperTradingComparisonCheckpointOutcomeReason, "paired_checkpoint_recorded">;
    stableErrorCode: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    let cleanup: PaperTradingComparisonRuntimeActivationResult;
    try {
      cleanup = await this.options.activations.stopOwnedAttempt({
        attemptId: input.attempt.paper_trading_comparison_activation_attempt_ref.id,
        reason: "handoff_cleanup"
      });
    } catch (error) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_cleanup_failed",
        "Paper comparison checkpoint failure could not stop both sides.",
        { reason: stableErrorCode(error, "paper_trading_comparison_checkpoint_cleanup_failed") }
      );
    }
    if (cleanup.status !== "stopped_cleanly") {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_cleanup_failed",
        "Paper comparison checkpoint failure did not stop both sides cleanly."
      );
    }
    return this.persistIncompleteOutcome(input);
  }

  private async persistIncompleteOutcome(input: {
    attempt: PaperTradingComparisonCheckpointAttemptRecord;
    reason: Exclude<PaperTradingComparisonCheckpointOutcomeReason, "paired_checkpoint_recorded">;
    stableErrorCode: string;
  }): Promise<PaperTradingComparisonCheckpointOutcomeRecord> {
    const existingOutcomes = await this.readCheckpointOutcomes(input.attempt);
    const existing = existingOutcomes.at(-1);
    if (existing) return existing;
    const outcome = buildIncompleteOutcome({
      attempt: input.attempt,
      reason: input.reason,
      stableErrorCode: input.stableErrorCode,
      completedAt: this.readNow()
    });
    try {
      const persisted = await this.options.store
        .recordPaperTradingComparisonCheckpointOutcome(outcome);
      const reloaded = await this.options.store.getPaperTradingComparisonCheckpointOutcome(
        outcome.paper_trading_comparison_checkpoint_outcome_id
      );
      if (!isDeepStrictEqual(persisted, outcome) || !isDeepStrictEqual(reloaded, outcome)) {
        throw new Error("incomplete outcome reload mismatch");
      }
      return outcome;
    } catch (error) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_persistence_failed",
        "Paper comparison incomplete checkpoint outcome could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }
  }

  private async stopAfterPairedCandidateFailure(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<void> {
    const cleanup = await this.options.activations.stopOwnedAttempt({
      attemptId: attempt.paper_trading_comparison_activation_attempt_ref.id,
      reason: "handoff_cleanup"
    });
    if (cleanup.status !== "stopped_cleanly") {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_cleanup_failed",
        "Failed candidate checkpoint was paired but its sessions did not stop cleanly."
      );
    }
  }

  private async readCheckpointOutcomes(
    attempt: PaperTradingComparisonCheckpointAttemptRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord[]> {
    const outcomes = await this.options.store.listPaperTradingComparisonCheckpointOutcomes(
      attempt.paper_trading_comparison_checkpoint_attempt_id
    );
    if (!Array.isArray(outcomes) || outcomes.some((outcome) =>
      !paperTradingComparisonCheckpointOutcomeHasRuntimeShape(outcome) ||
      outcome.checkpoint_attempt_ref.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      outcome.checkpoint_attempt_digest !== attempt.attempt_digest ||
      outcome.outcome_digest !== canonicalDigest(
        paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
      ))) {
      throw graphInvalid();
    }
    return outcomes;
  }

  private async readExactOutcome(
    expected: PaperTradingComparisonCheckpointOutcomeRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord | undefined> {
    try {
      const direct = await this.options.store.getPaperTradingComparisonCheckpointOutcome(
        expected.paper_trading_comparison_checkpoint_outcome_id
      );
      return isDeepStrictEqual(direct, expected) ? direct : undefined;
    } catch {
      return undefined;
    }
  }

  private async recoverIncompleteCheckpointsUnlocked(): Promise<
    PaperTradingComparisonCheckpointOutcomeRecord[]
  > {
    let recoveredBundles: PaperTradingComparisonCheckpointOutcomeRecord[];
    try {
      recoveredBundles = await this.options.store
        .recoverPaperTradingComparisonCheckpointTransactions();
    } catch (error) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_recovery_failed",
        "Paper comparison checkpoint transactions could not be recovered.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }
    let commitments: unknown;
    try {
      commitments = await this.options.store.listPaperTradingComparisonCommitments();
    } catch {
      throw recoveryFailed("Paper comparison commitments could not be scanned.");
    }
    if (!Array.isArray(commitments)) {
      throw recoveryFailed("Paper comparison commitment scan returned an invalid value.");
    }
    const checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[] = [];
    for (const commitment of commitments) {
      if (!isRecord(commitment) ||
        typeof commitment.paper_trading_comparison_commitment_id !== "string") {
        throw recoveryFailed("Paper comparison commitment scan returned malformed identity.");
      }
      const activations = await this.options.store.listPaperTradingComparisonActivations(
        commitment.paper_trading_comparison_commitment_id
      );
      if (!Array.isArray(activations) || activations.some((activation) =>
        !paperTradingComparisonActivationHasRuntimeShape(activation))) {
        throw recoveryFailed("Paper comparison activation scan returned malformed evidence.");
      }
      for (const activation of activations) {
        const attempts = await this.options.store.listPaperTradingComparisonActivationAttempts(
          activation.paper_trading_comparison_activation_id
        );
        if (!Array.isArray(attempts) || attempts.some((attempt) =>
          !paperTradingComparisonActivationAttemptHasRuntimeShape(attempt))) {
          throw recoveryFailed("Paper comparison activation attempt scan is malformed.");
        }
        for (const activationAttempt of attempts) {
          const checkpoints = await this.options.store
            .listPaperTradingComparisonCheckpointAttempts(
              activationAttempt.paper_trading_comparison_activation_attempt_id
            );
          if (!Array.isArray(checkpoints) || checkpoints.some((checkpoint) =>
            !paperTradingComparisonCheckpointAttemptHasRuntimeShape(checkpoint) ||
            checkpoint.attempt_digest !== canonicalDigest(
              paperTradingComparisonCheckpointAttemptDigestInput(checkpoint)
            ))) {
            throw recoveryFailed("Paper comparison checkpoint attempt scan is malformed.");
          }
          checkpointAttempts.push(...checkpoints);
        }
      }
    }
    if (checkpointAttempts.length === 0) return recoveredBundles;

    let activationRecovery: PaperTradingComparisonRuntimeActivationResult[];
    try {
      activationRecovery = await this.options.activations.recoverIncompleteActivations();
    } catch (error) {
      throw recoveryFailed(
        "Paper comparison activation recovery failed before checkpoint reconciliation.",
        stableErrorCode(error, "paper_trading_comparison_checkpoint_recovery_failed")
      );
    }
    const outcomes = new Map<string, PaperTradingComparisonCheckpointOutcomeRecord>();
    for (const outcome of recoveredBundles) {
      outcomes.set(outcome.paper_trading_comparison_checkpoint_outcome_id, outcome);
    }
    for (const attempt of checkpointAttempts.sort((left, right) =>
      left.attempted_at.localeCompare(right.attempted_at) ||
      left.paper_trading_comparison_checkpoint_attempt_id.localeCompare(
        right.paper_trading_comparison_checkpoint_attempt_id
      ))) {
      const existing = (await this.readCheckpointOutcomes(attempt)).at(-1);
      if (existing) {
        outcomes.set(existing.paper_trading_comparison_checkpoint_outcome_id, existing);
        continue;
      }
      const activationRecovered = activationRecovery.find((result) =>
        result.attempt.paper_trading_comparison_activation_attempt_id ===
          attempt.paper_trading_comparison_activation_attempt_ref.id
      );
      if (!activationRecovered || activationRecovered.status !== "stopped_cleanly") {
        throw recoveryFailed(
          "Open paper comparison checkpoint intent did not recover both runtime sides."
        );
      }
      const incomplete = await this.persistIncompleteOutcome({
        attempt,
        reason: "restart_cleanup",
        stableErrorCode: "paper_trading_comparison_checkpoint_restart_cleanup"
      });
      outcomes.set(incomplete.paper_trading_comparison_checkpoint_outcome_id, incomplete);
    }
    return [...outcomes.values()].sort((left, right) =>
      left.completed_at.localeCompare(right.completed_at) ||
      left.paper_trading_comparison_checkpoint_outcome_id.localeCompare(
        right.paper_trading_comparison_checkpoint_outcome_id
      )
    );
  }

  private readNow(): string {
    const value = this.now();
    if (!exactIsoTimestamp(value)) {
      throw new PaperTradingComparisonCheckpointCoordinatorError(
        "paper_trading_comparison_checkpoint_graph_invalid",
        "Paper comparison checkpoint clock returned an invalid timestamp."
      );
    }
    return value;
  }
}

function buildCheckpointAttempt(input: {
  graph: LoadedCheckpointGraph;
  attemptId: string;
  attemptedAt: string;
  checkpointDeadlineAt: string;
}): PaperTradingComparisonCheckpointAttemptRecord {
  const side = (role: Role) => ({
    role,
    trading_run_ref: {
      ...input.graph.activationAttempt[role].trading_run_ref
    },
    paper_trading_evaluation_ref: {
      ...input.graph.activationAttempt[role].paper_trading_evaluation_ref
    },
    evaluation_record_digest: canonicalDigest(
      paperTradingComparisonEvaluationRecordDigestInput(
        input.graph.evaluations[role]
      )
    ),
    observation_chain_digest: canonicalDigest(
      paperTradingComparisonObservationChainDigestInput(
        input.graph.observations[role]
      )
    ),
    provider_request_count_before:
      input.graph.startResults[role].provider_request_count
  });
  const attempt: PaperTradingComparisonCheckpointAttemptRecord = {
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id: input.attemptId,
    paper_trading_comparison_activation_ref: {
      ...input.graph.activationAttempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      input.graph.activationAttempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: input.graph.activationAttempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest:
      input.graph.activationAttempt.attempt_digest,
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: input.graph.activationOutcome.paper_trading_comparison_activation_outcome_id
    },
    activation_outcome_digest: input.graph.activationOutcome.outcome_digest,
    paper_trading_comparison_commitment_ref: {
      ...input.graph.activationAttempt.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      input.graph.activationAttempt.paper_trading_comparison_commitment_digest,
    tick_ref: { ...input.graph.activationAttempt.first_tick_ref },
    tick_digest: input.graph.activationAttempt.first_tick_digest,
    checkpoint_sequence: 1,
    champion: side("champion"),
    challenger: side("challenger"),
    attempted_at: input.attemptedAt,
    checkpoint_deadline_at: input.checkpointDeadlineAt,
    attempt_status: "preparing",
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return {
    ...attempt,
    attempt_digest: canonicalDigest(
      paperTradingComparisonCheckpointAttemptDigestInput(attempt)
    )
  };
}

function checkpointWriteContext(
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  role: Role
): PaperTradingComparisonCheckpointWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      ...attempt.paper_trading_comparison_activation_attempt_ref
    },
    paper_trading_comparison_activation_attempt_digest:
      attempt.paper_trading_comparison_activation_attempt_digest,
    activation_outcome_ref: { ...attempt.activation_outcome_ref },
    activation_outcome_digest: attempt.activation_outcome_digest,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    role,
    operation: "refresh_sandbox_evidence"
  };
}

function buildPairedOutcome(input: {
  attempt: PaperTradingComparisonCheckpointAttemptRecord;
  prepared: Record<Role, PreparedPaperTradingComparisonCheckpointSide>;
  completedAt: string;
}): PaperTradingComparisonCheckpointOutcomeRecord {
  const side = (role: Role) => ({
    role,
    observation_ref: {
      record_kind: "paper_trading_observation" as const,
      id: input.prepared[role].observation.paper_trading_observation_id
    },
    observation_record_digest: canonicalRecordDigest(
      input.prepared[role].observation
    ),
    evaluation_record_digest: canonicalDigest(
      paperTradingComparisonEvaluationRecordDigestInput(
        input.prepared[role].evaluation
      )
    ),
    ledger_chain_refs: input.prepared[role].ledger_outcomes.map((ledger) => ({
      record_kind: "ledger_chain" as const,
      id: ledger.order_request.order_request_id
    })),
    observation_status: input.prepared[role].observation.status,
    consumed_event_count: input.prepared[role].consumed_event_count,
    provider_request_count_after:
      input.prepared[role].provider_request_count_after
  });
  const outcome: PaperTradingComparisonCheckpointOutcomeRecord = {
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id: deterministicRecordId(
      "paper-comparison-checkpoint-outcome",
      input.attempt.paper_trading_comparison_checkpoint_attempt_id
    ),
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: input.attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: input.attempt.attempt_digest,
    tick_ref: { ...input.attempt.tick_ref },
    tick_digest: input.attempt.tick_digest,
    checkpoint_sequence: 1,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: side("champion"),
    challenger: side("challenger"),
    next_action: "design_attributed_next_tick",
    completed_at: input.completedAt,
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return {
    ...outcome,
    outcome_digest: canonicalDigest(
      paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
    )
  };
}

function buildIncompleteOutcome(input: {
  attempt: PaperTradingComparisonCheckpointAttemptRecord;
  reason: Exclude<PaperTradingComparisonCheckpointOutcomeReason, "paired_checkpoint_recorded">;
  stableErrorCode: string;
  completedAt: string;
}): PaperTradingComparisonCheckpointOutcomeRecord {
  const outcome: PaperTradingComparisonCheckpointOutcomeRecord = {
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id: deterministicRecordId(
      "paper-comparison-checkpoint-outcome",
      input.attempt.paper_trading_comparison_checkpoint_attempt_id
    ),
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: input.attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: input.attempt.attempt_digest,
    tick_ref: { ...input.attempt.tick_ref },
    tick_digest: input.attempt.tick_digest,
    checkpoint_sequence: 1,
    outcome_status: "incomplete",
    outcome_reason: input.reason,
    stable_error_code: input.stableErrorCode,
    next_action: input.reason === "paired_persistence_failed" ||
      input.reason === "restart_cleanup"
      ? "recover_cleanup"
      : "close_failed_comparison",
    completed_at: input.completedAt,
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return {
    ...outcome,
    outcome_digest: canonicalDigest(
      paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
    )
  };
}

function normalizeCaptureInput(input: {
  activationId: string;
  activationAttemptId: string;
  idempotencyKey: string;
}) {
  if (!isRecord(input)) throw invalidInput();
  const activationId = normalizeNonEmptyString(input.activationId);
  const activationAttemptId = normalizeNonEmptyString(input.activationAttemptId);
  const idempotencyKey = normalizeNonEmptyString(input.idempotencyKey);
  if (!activationId || !activationAttemptId || !idempotencyKey) throw invalidInput();
  return { activationId, activationAttemptId, idempotencyKey };
}

function normalizeNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function invalidInput(): PaperTradingComparisonCheckpointCoordinatorError {
  return new PaperTradingComparisonCheckpointCoordinatorError(
    "invalid_paper_trading_comparison_checkpoint_input",
    "Paper comparison checkpoint input is invalid."
  );
}

function graphInvalid(): PaperTradingComparisonCheckpointCoordinatorError {
  return new PaperTradingComparisonCheckpointCoordinatorError(
    "paper_trading_comparison_checkpoint_graph_invalid",
    "Paper comparison checkpoint graph is missing, malformed, or stale."
  );
}

function recoveryFailed(
  message: string,
  reason?: string
): PaperTradingComparisonCheckpointCoordinatorError {
  return new PaperTradingComparisonCheckpointCoordinatorError(
    "paper_trading_comparison_checkpoint_recovery_failed",
    message,
    reason ? { reason } : {}
  );
}

function canonicalRecordDigest(value: unknown): string {
  return canonicalDigest(paperTradingComparisonPersistedRecordDigestInput(value));
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function deterministicRecordId(prefix: string, source: string): string {
  const digest = createHash("sha256").update(source).digest("hex").slice(0, 20);
  return `${prefix}-${digest}`;
}

function stableErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error &&
    typeof (error as { code?: unknown }).code === "string"
    ? (error as Error & { code: string }).code
    : fallback;
}

function exactIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function deadlineSignal(
  deadlineAt: string,
  now: string,
  controller: AbortController
): { promise: Promise<void>; cancel: () => void } {
  const delay = Math.max(0, Date.parse(deadlineAt) - Date.parse(now));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, delay);
  });
  return {
    promise,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
