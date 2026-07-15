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
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeReason,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationOutcomeStatus,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonActivationSideResultOutcome,
  type PaperTradingComparisonActivationSideResultRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingComparisonTickRecord,
  type PaperTradingComparisonWindowClosureEvidence
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type {
  PaperTradingComparisonSessionPort,
  PaperTradingComparisonSessionSideStatus
} from "../../ports/paper-comparison-session";
import { isStoreErrorLike, type OuroborosStorePort } from "../../ports/store";
import { ComparisonMarketDataView } from "./comparison-market-data-view";

export type PaperTradingComparisonRuntimeActivationErrorCode =
  | "invalid_paper_trading_comparison_runtime_activation_input"
  | "paper_trading_comparison_runtime_activation_not_found"
  | "paper_trading_comparison_runtime_activation_graph_invalid"
  | "paper_trading_comparison_runtime_activation_attempt_conflict"
  | "paper_trading_comparison_runtime_activation_attempt_incomplete"
  | "paper_trading_comparison_runtime_activation_attempt_persistence_failed"
  | "paper_trading_comparison_runtime_activation_attempt_not_owned"
  | "paper_trading_comparison_runtime_activation_recovery_failed"
  | "paper_trading_comparison_runtime_activation_outcome_persistence_failed";

export class PaperTradingComparisonRuntimeActivationError extends Error {
  constructor(
    readonly code: PaperTradingComparisonRuntimeActivationErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonRuntimeActivationError";
  }
}

export interface PaperTradingComparisonRuntimeActivationCoordinatorOptions {
  store: OuroborosStorePort;
  sessions: PaperTradingComparisonSessionPort;
  marketData: GatewayMarketDataPort;
  now?: () => string;
}

export interface PaperTradingComparisonRuntimeActivationResult {
  status: PaperTradingComparisonActivationOutcomeStatus;
  activation: PaperTradingComparisonActivationRecord;
  attempt: PaperTradingComparisonActivationAttemptRecord;
  championResult?: PaperTradingComparisonActivationSideResultRecord;
  challengerResult?: PaperTradingComparisonActivationSideResultRecord;
  outcome: PaperTradingComparisonActivationOutcomeRecord;
  marketDataView?: ComparisonMarketDataView;
  authority_status: "not_live";
}

type Role = "champion" | "challenger";

interface StartSettlement {
  role: Role;
  effectStartedAt: string;
  effectCompletedAt: string;
  kind: "resolved" | "failed" | "timed_out";
  status?: PaperTradingComparisonSessionSideStatus;
  stableErrorCode?: string;
  latePromise?: Promise<PaperTradingComparisonSessionSideStatus>;
}

interface PersistedStartEvidence {
  records: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>;
  persistenceFailed: boolean;
  reason: PaperTradingComparisonActivationOutcomeReason;
}

interface CleanupEvidence {
  records: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>;
  persistenceFailed: boolean;
  clean: boolean;
}

const ROLES: readonly Role[] = ["champion", "challenger"];
const STABLE_SESSION_ERROR_CODES = new Set([
  "invalid_paper_trading_comparison_runtime_write_context",
  "paper_trading_comparison_activation_aborted",
  "paper_trading_comparison_cleanup_deadline_mismatch",
  "paper_trading_comparison_commitment_mismatch",
  "paper_trading_comparison_deadline_exceeded",
  "paper_trading_comparison_deadline_invalid",
  "paper_trading_comparison_provider_request_limit_invalid",
  "paper_trading_comparison_provider_request_limit_mismatch",
  "paper_trading_comparison_resolved_artifact_mismatch",
  "paper_trading_comparison_runtime_write_context_mismatch",
  "paper_trading_comparison_runtime_write_context_not_found",
  "paper_trading_comparison_session_start_failed",
  "paper_trading_comparison_side_reference_not_found",
  "paper_trading_comparison_side_state_mismatch",
  "paper_trading_comparison_start_deadline_mismatch",
  "paper_trading_comparison_transient_sandbox_cleanup_failed",
  "paper_trading_comparison_transient_sandbox_cleanup_unresolved",
  "paper_trading_comparison_transient_sandbox_cleanup_unavailable"
]);

export class PaperTradingComparisonRuntimeActivationCoordinator {
  private readonly now: () => string;
  private activationQueue: Promise<void> = Promise.resolve();
  private readonly ownedRunningAttemptIds = new Set<string>();

  constructor(
    private readonly options: PaperTradingComparisonRuntimeActivationCoordinatorOptions
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  start(input: {
    activationId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonRuntimeActivationResult> {
    return this.withActivationQueue(() => this.startUnlocked(input));
  }

  recoverIncompleteActivations(): Promise<
    PaperTradingComparisonRuntimeActivationResult[]
  > {
    return this.withActivationQueue(() => this.recoverIncompleteActivationsUnlocked());
  }

  ownsRunningAttempt(attemptId: string): boolean {
    return typeof attemptId === "string" && this.ownedRunningAttemptIds.has(attemptId);
  }

  async stopOwnedAttempt(input: {
    attemptId: string;
    reason: "handoff_cleanup";
  }): Promise<PaperTradingComparisonRuntimeActivationResult> {
    const normalized = normalizeStopInput(input);
    if (!this.ownedRunningAttemptIds.has(normalized.attemptId)) {
      throw attemptNotOwned();
    }
    const requestedAt = this.readNow(
      "paper_trading_comparison_runtime_activation_attempt_incomplete"
    );
    const windowClosure = this.captureWindowClosure(
      normalized.attemptId,
      requestedAt
    ).catch(() => undefined);
    return this.withActivationQueue(async () => this.stopOwnedAttemptUnlocked(
      normalized,
      await windowClosure
    ));
  }

  private withActivationQueue<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.activationQueue.then(task);
    this.activationQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async startUnlocked(input: {
    activationId: string;
    idempotencyKey: string;
  }): Promise<PaperTradingComparisonRuntimeActivationResult> {
    const normalized = normalizeInput(input);
    const graph = await this.loadActivationGraph(normalized.activationId);
    let marketDataView: ComparisonMarketDataView;
    try {
      marketDataView = new ComparisonMarketDataView({
        source: this.options.marketData,
        tick: graph.tick
      });
    } catch {
      throw graphInvalid();
    }
    const attemptId = deterministicRecordId(
      "paper-comparison-activation-attempt",
      `${normalized.activationId}:${normalized.idempotencyKey}`
    );
    const existing = await this.readAttempt(attemptId);
    const attempts = await this.readAttempts(graph.activation);
    if (existing) {
      if (!attempts.some((attempt) => isDeepStrictEqual(attempt, existing))) {
        throw graphInvalid();
      }
      return this.replayExisting(graph.activation, graph.tick, existing, marketDataView);
    }

    let attemptedAt = this.readNow(
      "paper_trading_comparison_runtime_activation_attempt_persistence_failed"
    );
    const latestAttempt = attempts.at(-1);
    if (latestAttempt) {
      const priorEvidence = await this.readAttemptEvidence(latestAttempt);
      const priorOutcome = priorEvidence.outcomes.at(-1);
      if (!priorOutcome || priorOutcome.outcome_status !== "stopped_cleanly") {
        throw new PaperTradingComparisonRuntimeActivationError(
          "paper_trading_comparison_runtime_activation_attempt_conflict",
          "Paper comparison activation retry requires a stopped-cleanly prior attempt."
        );
      }
      attemptedAt = new Date(Math.max(
        Date.parse(attemptedAt),
        Date.parse(priorOutcome.completed_at) + 1
      )).toISOString();
    }
    const attempt = buildAttempt({
      activation: graph.activation,
      attemptId,
      attemptSequence: attempts.length + 1,
      attemptedAt
    });
    await this.persistAttempt(attempt);

    const startDeadlineAt = attempt.start_deadline_at;
    const controller = new AbortController();
    const startDeadline = deadlineSignal(startDeadlineAt, this.now, controller);
    const startEffects = ROLES.map((role) => this.beginStart({
      attempt,
      role,
      marketDataView,
      signal: controller.signal,
      deadline: startDeadline.promise
    }));
    const settlements = await Promise.all(startEffects.map((effect) => effect.settled));
    for (const effect of startEffects) {
      if (effect.latePromise) {
        this.observeLateStart(attempt, effect.role, effect.latePromise);
      }
    }

    const startEvidence = await this.persistStartEvidence(attempt, settlements);
    const policyInspection = startEvidence.persistenceFailed
      ? undefined
      : await this.inspectBoth(attempt, "start", startDeadline.promise);
    const adjudicatedAt = this.readNow(
      "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
    );
    const policyReason = this.evaluateStartPolicy(
      attempt,
      settlements,
      startEvidence,
      policyInspection,
      adjudicatedAt
    );
    if (policyReason === "started_within_policy") {
      startDeadline.cancel();
      let outcome: PaperTradingComparisonActivationOutcomeRecord;
      try {
        outcome = await this.persistOutcome({
          attempt,
          priorOutcomes: [],
          status: "both_running",
          reason: policyReason,
          results: startEvidence.records,
          completedAt: adjudicatedAt
        });
      } catch (error) {
        controller.abort();
        await this.cleanupBoth(
          attempt,
          startEvidence.records,
          new Set()
        ).catch(() => undefined);
        throw error;
      }
      this.ownedRunningAttemptIds.add(
        attempt.paper_trading_comparison_activation_attempt_id
      );
      return activationResult(
        graph.activation,
        attempt,
        startEvidence.records,
        outcome,
        marketDataView
      );
    }

    controller.abort();
    startDeadline.cancel();
    const unresolvedStartRoles = new Set(settlements
      .filter((settlement) => settlement.kind === "timed_out")
      .map((settlement) => settlement.role));
    const cleanup = await this.cleanupBoth(
      attempt,
      startEvidence.records,
      unresolvedStartRoles
    );
    const outcomeStatus: PaperTradingComparisonActivationOutcomeStatus =
      cleanup.clean && !startEvidence.persistenceFailed && !cleanup.persistenceFailed
        ? "stopped_cleanly"
        : "cleanup_required";
    const outcomeReason: PaperTradingComparisonActivationOutcomeReason =
      startEvidence.persistenceFailed || cleanup.persistenceFailed
        ? "side_result_persistence_failed"
        : unresolvedStartRoles.size > 0
          ? policyReason
        : outcomeStatus === "cleanup_required"
          ? "cleanup_failed"
          : policyReason;
    const outcome = await this.persistOutcome({
      attempt,
      priorOutcomes: [],
      status: outcomeStatus,
      reason: outcomeReason,
      results: cleanup.records,
      completedAt: this.readNow(
        "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
      )
    });
    return activationResult(
      graph.activation,
      attempt,
      cleanup.records,
      outcome
    );
  }

  private async captureWindowClosure(
    attemptId: string,
    requestedAt: string
  ): Promise<PaperTradingComparisonWindowClosureEvidence> {
    let snapshotValue: unknown;
    try {
      snapshotValue = await this.options.store
        .snapshotPaperTradingComparisonWindowClosureGraph(attemptId);
    } catch {
      throw graphInvalid();
    }
    if (!isRecord(snapshotValue) ||
      !Array.isArray(snapshotValue.activation_outcomes) ||
      !Array.isArray(snapshotValue.ticks) ||
      !Array.isArray(snapshotValue.checkpoint_attempts) ||
      !Array.isArray(snapshotValue.checkpoint_outcomes)) throw graphInvalid();
    const activationAttempt = snapshotValue.activation_attempt;
    if (!paperTradingComparisonActivationAttemptHasRuntimeShape(activationAttempt) ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !== attemptId ||
      activationAttempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(activationAttempt)
      )) throw graphInvalid();
    const requestedTime = Date.parse(requestedAt);
    if (Date.parse(activationAttempt.attempted_at) > requestedTime) {
      throw graphInvalid();
    }
    const activationOutcomes: PaperTradingComparisonActivationOutcomeRecord[] = [];
    for (let index = 0; index < snapshotValue.activation_outcomes.length; index += 1) {
      const value = snapshotValue.activation_outcomes[index];
      const previous = activationOutcomes[index - 1];
      if (!paperTradingComparisonActivationOutcomeHasRuntimeShape(value) ||
        value.outcome_sequence !== index + 1 ||
        value.paper_trading_comparison_activation_attempt_ref.id !== attemptId ||
        value.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        value.outcome_digest !== canonicalDigest(
          paperTradingComparisonActivationOutcomeDigestInput(value)
        ) ||
        Date.parse(value.completed_at) > requestedTime ||
        (index === 0
          ? value.previous_outcome_ref !== undefined
          : value.previous_outcome_ref?.id !==
              previous?.paper_trading_comparison_activation_outcome_id)) {
        throw graphInvalid();
      }
      activationOutcomes.push(value);
    }
    const runningOutcome = activationOutcomes.at(-1);
    if (!runningOutcome || runningOutcome.outcome_status !== "both_running") {
      throw graphInvalid();
    }

    const ticks: PaperTradingComparisonTickRecord[] = [];
    for (let index = 0; index < snapshotValue.ticks.length; index += 1) {
      const value = snapshotValue.ticks[index];
      const previous = ticks[index - 1];
      if (!paperTradingComparisonTickHasRuntimeShape(value) ||
        value.sequence !== index + 1 ||
        value.tick_digest !== canonicalDigest(
          paperTradingComparisonTickDigestInput(value)
        ) ||
        value.paper_trading_comparison_commitment_ref.id !==
          activationAttempt.paper_trading_comparison_commitment_ref.id ||
        value.paper_trading_comparison_commitment_digest !==
          activationAttempt.paper_trading_comparison_commitment_digest ||
        (index === 0
          ? value.paper_trading_comparison_tick_id !==
              activationAttempt.first_tick_ref.id ||
            value.tick_digest !== activationAttempt.first_tick_digest
          : value.previous_tick_ref?.id !==
              previous?.paper_trading_comparison_tick_id ||
            value.previous_tick_digest !== previous?.tick_digest) ||
        Date.parse(value.observed_at) > requestedTime) {
        throw graphInvalid();
      }
      ticks.push(value);
    }
    if (ticks.length === 0) throw graphInvalid();

    const checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[] = [];
    for (let index = 0; index < snapshotValue.checkpoint_attempts.length; index += 1) {
      const value = snapshotValue.checkpoint_attempts[index];
      const tick = ticks[index];
      if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(value) || !tick ||
        value.checkpoint_sequence !== index + 1 ||
        value.attempt_digest !== canonicalDigest(
          paperTradingComparisonCheckpointAttemptDigestInput(value)
        ) ||
        value.paper_trading_comparison_activation_attempt_ref.id !== attemptId ||
        value.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        value.paper_trading_comparison_commitment_ref.id !==
          activationAttempt.paper_trading_comparison_commitment_ref.id ||
        value.paper_trading_comparison_commitment_digest !==
          activationAttempt.paper_trading_comparison_commitment_digest ||
        value.activation_outcome_ref.id !==
          runningOutcome.paper_trading_comparison_activation_outcome_id ||
        value.activation_outcome_digest !== runningOutcome.outcome_digest ||
        value.tick_ref.id !== tick.paper_trading_comparison_tick_id ||
        value.tick_digest !== tick.tick_digest ||
        Date.parse(value.attempted_at) < Date.parse(tick.observed_at) ||
        Date.parse(value.attempted_at) > requestedTime) {
        throw graphInvalid();
      }
      checkpointAttempts.push(value);
    }
    if (checkpointAttempts.length > ticks.length) throw graphInvalid();

    let previousOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
    let latestOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
    let pairedCount = 0;
    const checkpointOutcomes = snapshotValue.checkpoint_outcomes;
    const seenOutcomeIds = new Set<string>();
    for (let index = 0; index < checkpointAttempts.length; index += 1) {
      const checkpointAttempt = checkpointAttempts[index]!;
      const outcomeValues = checkpointOutcomes.filter((value) =>
        isRecord(value) && isRecord(value.checkpoint_attempt_ref) &&
        value.checkpoint_attempt_ref.id ===
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      );
      if (outcomeValues.length > 1) throw graphInvalid();
      if (index === 0
        ? checkpointAttempt.previous_checkpoint_outcome_ref !== undefined ||
          checkpointAttempt.previous_checkpoint_outcome_digest !== undefined
        : checkpointAttempt.previous_checkpoint_outcome_ref?.id !==
            previousOutcome?.paper_trading_comparison_checkpoint_outcome_id ||
          checkpointAttempt.previous_checkpoint_outcome_digest !==
            previousOutcome?.outcome_digest ||
          Date.parse(previousOutcome?.completed_at ?? "") >
            Date.parse(checkpointAttempt.attempted_at) ||
          previousOutcome?.outcome_status === "incomplete") {
        throw graphInvalid();
      }
      const value = outcomeValues[0];
      if (value === undefined) {
        if (index !== checkpointAttempts.length - 1) throw graphInvalid();
        latestOutcome = undefined;
        continue;
      }
      if (!paperTradingComparisonCheckpointOutcomeHasRuntimeShape(value) ||
        value.outcome_digest !== canonicalDigest(
          paperTradingComparisonCheckpointOutcomeDigestInput(value)
        ) ||
        value.checkpoint_attempt_ref.id !==
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
        value.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
        value.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
        value.tick_ref.id !== checkpointAttempt.tick_ref.id ||
        value.tick_digest !== checkpointAttempt.tick_digest ||
        Date.parse(value.completed_at) > requestedTime) {
        throw graphInvalid();
      }
      seenOutcomeIds.add(value.paper_trading_comparison_checkpoint_outcome_id);
      previousOutcome = value;
      latestOutcome = value;
      if (value.outcome_status === "paired") pairedCount += 1;
      if (value.outcome_status === "incomplete" &&
        index !== checkpointAttempts.length - 1) throw graphInvalid();
    }
    if (seenOutcomeIds.size !== checkpointOutcomes.length) throw graphInvalid();

    const latestTick = ticks.at(-1)!;
    const latestAttempt = checkpointAttempts.at(-1);
    return {
      protocol_version: "paper_trading_comparison_window_closure_v1",
      requested_at: requestedAt,
      tick_count: ticks.length,
      checkpoint_attempt_count: checkpointAttempts.length,
      paired_checkpoint_count: pairedCount,
      latest_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: latestTick.paper_trading_comparison_tick_id
      },
      latest_tick_observed_at: latestTick.observed_at,
      ...(latestAttempt ? {
        latest_checkpoint_attempt_ref: {
          record_kind: "paper_trading_comparison_checkpoint_attempt",
          id: latestAttempt.paper_trading_comparison_checkpoint_attempt_id
        }
      } : {}),
      ...(latestOutcome ? {
        latest_checkpoint_outcome_ref: {
          record_kind: "paper_trading_comparison_checkpoint_outcome",
          id: latestOutcome.paper_trading_comparison_checkpoint_outcome_id
        }
      } : {})
    };
  }

  private async stopOwnedAttemptUnlocked(input: {
    attemptId: string;
    reason: "handoff_cleanup";
  }, windowClosure?: PaperTradingComparisonWindowClosureEvidence): Promise<
    PaperTradingComparisonRuntimeActivationResult
  > {
    if (!this.ownedRunningAttemptIds.has(input.attemptId)) {
      throw attemptNotOwned();
    }
    const attempt = await this.readAttempt(input.attemptId);
    if (!attempt) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_not_found",
        "Owned paper comparison activation attempt was not found."
      );
    }
    const graph = await this.loadActivationGraph(
      attempt.paper_trading_comparison_activation_ref.id,
      { allowProgressedTicks: true }
    );
    const attempts = await this.readAttempts(graph.activation);
    if (!isDeepStrictEqual(attempts.at(-1), attempt)) {
      throw graphInvalid();
    }
    const evidence = await this.readAttemptEvidence(attempt);
    const priorOutcome = evidence.outcomes.at(-1);
    if (!priorOutcome || priorOutcome.outcome_status !== "both_running") {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_incomplete",
        "Owned paper comparison activation attempt is not the active both-running outcome."
      );
    }
    const latest = latestResults(evidence.results);
    if (ROLES.some((role) => latest[role]?.operation !== "start" ||
      latest[role]?.outcome !== "succeeded")) {
      throw graphInvalid();
    }
    const nextOperationSequence = Object.fromEntries(ROLES.map((role) => [
      role,
      evidence.results.filter((result) => result.role === role).length + 1
    ])) as Record<Role, number>;
    const cleanup = await this.cleanupBoth(attempt, latest, new Set(), {
      reason: input.reason,
      nextOperationSequence
    });
    this.ownedRunningAttemptIds.delete(input.attemptId);
    const missingEvidence = ROLES.some((role) => cleanup.records[role] === undefined);
    const status: PaperTradingComparisonActivationOutcomeStatus =
      cleanup.clean && !cleanup.persistenceFailed && !missingEvidence
        ? "stopped_cleanly"
        : "cleanup_required";
    const reason: PaperTradingComparisonActivationOutcomeReason =
      cleanup.persistenceFailed || missingEvidence
        ? "side_result_persistence_failed"
        : cleanup.clean
          ? "handoff_cleanup"
          : "cleanup_failed";
    const outcome = await this.persistOutcome({
      attempt,
      priorOutcomes: evidence.outcomes,
      status,
      reason,
      results: cleanup.records,
      ...(status === "stopped_cleanly" && reason === "handoff_cleanup" &&
        windowClosure ? { windowClosure } : {}),
      completedAt: this.readNow(
        "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
      )
    });
    return activationResult(graph.activation, attempt, cleanup.records, outcome);
  }

  private async recoverIncompleteActivationsUnlocked(): Promise<
    PaperTradingComparisonRuntimeActivationResult[]
  > {
    let commitments: unknown;
    try {
      commitments = await this.options.store.listPaperTradingComparisonCommitments();
    } catch {
      throw recoveryFailed("Paper comparison commitments could not be scanned for recovery.");
    }
    if (!Array.isArray(commitments)) {
      throw recoveryFailed("Paper comparison commitment scan returned an invalid value.");
    }
    const activationIds = new Set<string>();
    for (const commitment of commitments) {
      if (!isRecord(commitment) ||
        typeof commitment.paper_trading_comparison_commitment_id !== "string") {
        throw recoveryFailed("Paper comparison commitment scan returned malformed identity.");
      }
      let activations: unknown;
      try {
        activations = await this.options.store.listPaperTradingComparisonActivations(
          commitment.paper_trading_comparison_commitment_id
        );
      } catch {
        throw recoveryFailed("Paper comparison activation scan failed.");
      }
      if (!Array.isArray(activations) || activations.some((activation) =>
        !paperTradingComparisonActivationHasRuntimeShape(activation))) {
        throw recoveryFailed("Paper comparison activation scan returned malformed evidence.");
      }
      for (const activation of activations) {
        activationIds.add(activation.paper_trading_comparison_activation_id);
      }
    }

    const recovered: PaperTradingComparisonRuntimeActivationResult[] = [];
    for (const activationId of [...activationIds].sort()) {
      const graph = await this.loadActivationGraph(
        activationId,
        { allowProgressedTicks: true }
      );
      const attempts = await this.readAttempts(graph.activation);
      for (const attempt of attempts) {
        const evidence = await this.readAttemptEvidence(attempt);
        if (evidence.outcomes.at(-1)?.outcome_status === "stopped_cleanly") {
          continue;
        }
        recovered.push(await this.recoverAttempt(
          graph.activation,
          attempt,
          evidence.results,
          evidence.outcomes
        ));
      }
    }
    return recovered;
  }

  private async recoverAttempt(
    activation: PaperTradingComparisonActivationRecord,
    attempt: PaperTradingComparisonActivationAttemptRecord,
    existingResults: PaperTradingComparisonActivationSideResultRecord[],
    priorOutcomes: PaperTradingComparisonActivationOutcomeRecord[]
  ): Promise<PaperTradingComparisonRuntimeActivationResult> {
    this.ownedRunningAttemptIds.delete(
      attempt.paper_trading_comparison_activation_attempt_id
    );
    const results = [...existingResults];
    const latest = latestResults(results);
    let evidencePersistenceFailed = false;
    if (priorOutcomes.length === 0) {
      const recoveredAt = this.readNow(
        "paper_trading_comparison_runtime_activation_recovery_failed"
      );
      for (const role of ROLES) {
        if (latest[role]) continue;
        const unknownStart = startResult(attempt, {
          role,
          effectStartedAt: attempt.attempted_at,
          effectCompletedAt: recoveredAt,
          kind: "timed_out",
          stableErrorCode: "paper_trading_comparison_restart_start_state_unknown"
        });
        try {
          const persisted = await this.persistSideResult(unknownStart);
          results.push(persisted);
          latest[role] = persisted;
        } catch {
          evidencePersistenceFailed = true;
        }
      }
    }

    const nextOperationSequence = Object.fromEntries(ROLES.map((role) => [
      role,
      results.filter((result) => result.role === role).length + 1
    ])) as Record<Role, number>;
    const unresolvedRecoveryRoles = new Set(ROLES.filter((role) => {
      const result = latest[role];
      return Boolean(result && !result.sandbox_ref && (
        result.outcome === "timed_out" ||
        result.stable_error_code ===
          "paper_trading_comparison_transient_sandbox_cleanup_failed" ||
        result.stable_error_code ===
          "paper_trading_comparison_transient_sandbox_cleanup_unavailable" ||
        result.stable_error_code ===
          "paper_trading_comparison_transient_sandbox_cleanup_unresolved"
      ));
    }));
    const cleanup = await this.cleanupBoth(
      attempt,
      latest,
      unresolvedRecoveryRoles,
      { reason: "restart_cleanup", nextOperationSequence }
    );
    const missingEvidence = ROLES.some((role) => cleanup.records[role] === undefined);
    const status: PaperTradingComparisonActivationOutcomeStatus =
      cleanup.clean && !cleanup.persistenceFailed && !evidencePersistenceFailed &&
        !missingEvidence
        ? "stopped_cleanly"
        : "cleanup_required";
    const reason: PaperTradingComparisonActivationOutcomeReason =
      cleanup.persistenceFailed || evidencePersistenceFailed || missingEvidence
        ? "side_result_persistence_failed"
        : "restart_cleanup";
    const outcome = await this.persistOutcome({
      attempt,
      priorOutcomes,
      status,
      reason,
      results: cleanup.records,
      completedAt: this.readNow(
        "paper_trading_comparison_runtime_activation_recovery_failed"
      )
    });
    return activationResult(activation, attempt, cleanup.records, outcome);
  }

  private async loadActivationGraph(
    activationId: string,
    options: { allowProgressedTicks?: boolean } = {}
  ): Promise<{
    activation: PaperTradingComparisonActivationRecord;
    tick: PaperTradingComparisonTickRecord;
  }> {
    let activation: unknown;
    try {
      activation = await this.options.store.getPaperTradingComparisonActivation(
        activationId
      );
    } catch {
      throw graphInvalid();
    }
    if (activation === undefined) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_not_found",
        "Paper comparison runtime activation was not found."
      );
    }
    if (!paperTradingComparisonActivationHasRuntimeShape(activation) ||
      activation.paper_trading_comparison_activation_id !== activationId ||
      activation.activation_digest !== canonicalDigest(
        paperTradingComparisonActivationDigestInput(activation)
      )) {
      throw graphInvalid();
    }

    let tick: unknown;
    let activations: unknown;
    let ticks: unknown;
    try {
      [tick, activations, ticks] = await Promise.all([
        this.options.store.getPaperTradingComparisonTick(activation.first_tick_ref.id),
        this.options.store.listPaperTradingComparisonActivations(
          activation.paper_trading_comparison_commitment_ref.id
        ),
        this.options.store.listPaperTradingComparisonTicks(
          activation.paper_trading_comparison_commitment_ref.id
        )
      ]);
    } catch {
      throw graphInvalid();
    }
    if (!paperTradingComparisonTickHasRuntimeShape(tick) ||
      tick.paper_trading_comparison_tick_id !== activation.first_tick_ref.id ||
      tick.tick_digest !== activation.first_tick_digest ||
      tick.tick_digest !== canonicalDigest(paperTradingComparisonTickDigestInput(tick)) ||
      tick.sequence !== 1 ||
      !paperTradingComparisonRefsEqual(
        tick.paper_trading_comparison_commitment_ref,
        activation.paper_trading_comparison_commitment_ref
      ) ||
      tick.paper_trading_comparison_commitment_digest !==
        activation.paper_trading_comparison_commitment_digest ||
      tick.market_data_configuration_digest !==
        activation.market_data_configuration_digest ||
      !Array.isArray(activations) || activations.length !== 1 ||
      !isDeepStrictEqual(activations[0], activation) ||
      !Array.isArray(ticks) || ticks.length === 0 ||
      options.allowProgressedTicks !== true && ticks.length !== 1 ||
      !isDeepStrictEqual(ticks[0], tick) ||
      ticks.some((record, index) =>
        !paperTradingComparisonTickHasRuntimeShape(record) ||
        record.tick_digest !== canonicalDigest(
          paperTradingComparisonTickDigestInput(record)
        ) ||
        record.sequence !== index + 1 ||
        !paperTradingComparisonRefsEqual(
          record.paper_trading_comparison_commitment_ref,
          activation.paper_trading_comparison_commitment_ref
        ) ||
        record.paper_trading_comparison_commitment_digest !==
          activation.paper_trading_comparison_commitment_digest ||
        record.market_data_configuration_digest !==
          activation.market_data_configuration_digest ||
        (index === 0
          ? record.previous_tick_ref !== undefined ||
            record.previous_tick_digest !== undefined
          : record.previous_tick_ref?.id !==
              (ticks[index - 1] as PaperTradingComparisonTickRecord)
                .paper_trading_comparison_tick_id ||
            record.previous_tick_digest !==
              (ticks[index - 1] as PaperTradingComparisonTickRecord).tick_digest)
      )) {
      throw graphInvalid();
    }
    return { activation, tick };
  }

  private async readAttempt(
    attemptId: string
  ): Promise<PaperTradingComparisonActivationAttemptRecord | undefined> {
    try {
      return await this.options.store.getPaperTradingComparisonActivationAttempt(attemptId);
    } catch {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_persistence_failed",
        "Paper comparison activation attempt could not be read."
      );
    }
  }

  private async readAttempts(
    activation: PaperTradingComparisonActivationRecord
  ): Promise<PaperTradingComparisonActivationAttemptRecord[]> {
    let attempts: unknown;
    try {
      attempts = await this.options.store.listPaperTradingComparisonActivationAttempts(
        activation.paper_trading_comparison_activation_id
      );
    } catch {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_persistence_failed",
        "Paper comparison activation attempts could not be read."
      );
    }
    if (!Array.isArray(attempts) || attempts.some((attempt, index) =>
      !paperTradingComparisonActivationAttemptHasRuntimeShape(attempt) ||
      attempt.attempt_sequence !== index + 1 ||
      attempt.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      attempt.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      attempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(attempt)
      ))) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_graph_invalid",
        "Paper comparison activation attempt chain is invalid."
      );
    }
    return attempts;
  }

  private async persistAttempt(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<void> {
    try {
      const persisted = await this.options.store
        .recordPaperTradingComparisonActivationAttempt(attempt);
      const reloaded = await this.options.store.getPaperTradingComparisonActivationAttempt(
        attempt.paper_trading_comparison_activation_attempt_id
      );
      if (!isDeepStrictEqual(persisted, attempt) || !isDeepStrictEqual(reloaded, attempt)) {
        throw new Error("attempt reload mismatch");
      }
    } catch (error) {
      if (isStoreErrorLike(error) && error.code.includes("state_conflict")) {
        throw new PaperTradingComparisonRuntimeActivationError(
          "paper_trading_comparison_runtime_activation_attempt_conflict",
          "Paper comparison activation cannot admit another attempt.",
          { reason: error.code }
        );
      }
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_persistence_failed",
        "Paper comparison activation attempt could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }
  }

  private beginStart(input: {
    attempt: PaperTradingComparisonActivationAttemptRecord;
    role: Role;
    marketDataView: ComparisonMarketDataView;
    signal: AbortSignal;
    deadline: Promise<void>;
  }): {
    role: Role;
    settled: Promise<StartSettlement>;
    latePromise?: Promise<PaperTradingComparisonSessionSideStatus>;
  } {
    const effectStartedAt = this.readNow(
      "paper_trading_comparison_runtime_activation_attempt_persistence_failed"
    );
    const authority = runtimeWriteContext(input.attempt, input.role, "start");
    const raw = Promise.resolve().then(() => this.options.sessions.startComparisonSide({
      side: structuredClone(input.attempt[input.role]),
      authority,
      marketData: input.marketDataView,
      deadlineAt: input.attempt.start_deadline_at,
      maximumProviderRequestCount:
        input.attempt.activation_policy.maximum_provider_request_count_per_side,
      signal: input.signal
    }));
    const resolved = raw.then<StartSettlement, StartSettlement>(
      (status) => ({
        role: input.role,
        effectStartedAt,
        effectCompletedAt: this.readNow(
          "paper_trading_comparison_runtime_activation_attempt_persistence_failed"
        ),
        kind: "resolved",
        status
      }),
      (error) => ({
        role: input.role,
        effectStartedAt,
        effectCompletedAt: this.readNow(
          "paper_trading_comparison_runtime_activation_attempt_persistence_failed"
        ),
        kind: "failed",
        stableErrorCode: stableSessionErrorCode(error, "start")
      })
    );
    let timedOut = false;
    const settled = Promise.race([
      resolved,
      input.deadline.then<StartSettlement>(() => {
        timedOut = true;
        return {
          role: input.role,
          effectStartedAt,
          effectCompletedAt: input.attempt.start_deadline_at,
          kind: "timed_out",
          stableErrorCode: "paper_trading_comparison_start_timed_out",
          latePromise: raw
        };
      })
    ]);
    return {
      role: input.role,
      settled,
      get latePromise() { return timedOut ? raw : undefined; }
    };
  }

  private async persistStartEvidence(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    settlements: StartSettlement[]
  ): Promise<PersistedStartEvidence> {
    const records: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>> = {};
    let persistenceFailed = false;
    let reason: PaperTradingComparisonActivationOutcomeReason = "started_within_policy";
    for (const role of ROLES) {
      const settlement = settlements.find((candidate) => candidate.role === role)!;
      const result = startResult(attempt, settlement);
      if (result.stable_error_code ===
        "paper_trading_comparison_provider_request_budget_exceeded") {
        reason = "provider_request_budget_exceeded";
      } else if (result.stable_error_code ===
        "paper_trading_comparison_activation_elapsed_exceeded") {
        reason = "activation_elapsed_exceeded";
      } else if (result.outcome === "timed_out" &&
        reason === "started_within_policy") {
        reason = "start_timed_out";
      } else if (result.outcome === "failed" &&
        reason === "started_within_policy") {
        reason = "start_failed";
      }
      try {
        records[role] = await this.persistSideResult(result);
      } catch {
        persistenceFailed = true;
      }
    }
    if (persistenceFailed) reason = "side_result_persistence_failed";
    return { records, persistenceFailed, reason };
  }

  private async inspectBoth(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    operation: "start" | "stop",
    deadline: Promise<void>
  ): Promise<Partial<Record<Role, PaperTradingComparisonSessionSideStatus>>> {
    const entries = await Promise.all(ROLES.map(async (role) => {
      const inspected = Promise.resolve().then(() =>
        this.options.sessions.inspectComparisonSide({
          side: structuredClone(attempt[role]),
          authority: runtimeWriteContext(attempt, role, operation)
        })
      );
      try {
        const status = await Promise.race([
          inspected,
          deadline.then(() => undefined)
        ]);
        return [role, status] as const;
      } catch {
        return [role, undefined] as const;
      }
    }));
    return Object.fromEntries(entries);
  }

  private evaluateStartPolicy(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    settlements: StartSettlement[],
    evidence: PersistedStartEvidence,
    inspection: Partial<Record<Role, PaperTradingComparisonSessionSideStatus>> | undefined,
    adjudicatedAt: string
  ): PaperTradingComparisonActivationOutcomeReason {
    if (evidence.persistenceFailed) return "side_result_persistence_failed";
    if (evidence.reason !== "started_within_policy") return evidence.reason;
    const statuses = ROLES.map((role) => inspection?.[role]);
    const returnedStatuses = ROLES.map((role) =>
      settlements.find((settlement) => settlement.role === role)?.status
    );
    if (statuses.some((status, index) => {
      const role = ROLES[index]!;
      const returned = returnedStatuses[index];
      const settlement = settlements.find((candidate) => candidate.role === role)!;
      if (!validRunningStatus(status, attempt[role]) ||
        !validRunningStatus(returned, attempt[role])) {
        return true;
      }
      return !paperTradingComparisonRefsEqual(status.sandbox_ref, returned.sandbox_ref) ||
        status.sandbox_started_at !== returned.sandbox_started_at ||
        status.provider_request_count < returned.provider_request_count ||
        Date.parse(status.sandbox_started_at!) < Date.parse(attempt.attempted_at) ||
        Date.parse(status.sandbox_started_at!) > Date.parse(settlement.effectCompletedAt);
    })) {
      return "start_failed";
    }
    const completionTimes = settlements.map((settlement) =>
      Date.parse(settlement.effectCompletedAt)
    );
    if (completionTimes.some((time) => time > Date.parse(attempt.start_deadline_at)) ||
      Date.parse(adjudicatedAt) > Date.parse(attempt.start_deadline_at)) {
      return "activation_elapsed_exceeded";
    }
    if (statuses.some((status) => status!.provider_request_count >
      attempt.activation_policy.maximum_provider_request_count_per_side)) {
      return "provider_request_budget_exceeded";
    }
    const startedTimes = statuses.map((status) => Date.parse(status!.sandbox_started_at!));
    if (Math.abs(startedTimes[0]! - startedTimes[1]!) >
      attempt.activation_policy.maximum_start_skew_ms) {
      return "start_skew_exceeded";
    }
    return "started_within_policy";
  }

  private async cleanupBoth(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    startRecords: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>,
    unresolvedStartRoles: ReadonlySet<Role>,
    options: {
      reason?: PaperTradingComparisonActivationSideResultRecord["reason"];
      nextOperationSequence?: Partial<Record<Role, number>>;
    } = {}
  ): Promise<CleanupEvidence> {
    const cleanupDeadlineAt = new Date(
      Date.parse(this.readNow(
        "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
      )) + attempt.activation_policy.cleanup_timeout_ms
    ).toISOString();
    const cleanupDeadline = deadlineSignal(cleanupDeadlineAt, this.now);
    const settlements = ROLES.map((role) => this.cleanupSide({
      attempt,
      role,
      deadlineAt: cleanupDeadlineAt,
      deadline: cleanupDeadline.promise,
      reason: options.reason ?? "policy_cleanup"
    }));
    const settled = await Promise.all(settlements);
    cleanupDeadline.cancel();
    const records: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>> = {
      ...startRecords
    };
    let persistenceFailed = false;
    let clean = true;
    for (const role of ROLES) {
      const startRecord = startRecords[role];
      const side = settled.find((candidate) => candidate.role === role)!;
      if (!startRecord) {
        persistenceFailed = true;
        clean = false;
        continue;
      }
      if (unresolvedStartRoles.has(role)) {
        clean = false;
        continue;
      }
      const result = stopResult(
        attempt,
        side,
        options.nextOperationSequence?.[role] ?? 2,
        options.reason ?? "policy_cleanup"
      );
      if (result.outcome !== "succeeded" && result.outcome !== "not_running") {
        clean = false;
      }
      try {
        records[role] = await this.persistSideResult(result);
      } catch {
        persistenceFailed = true;
        clean = false;
      }
    }
    return { records, persistenceFailed, clean };
  }

  private async cleanupSide(input: {
    attempt: PaperTradingComparisonActivationAttemptRecord;
    role: Role;
    deadlineAt: string;
    deadline: Promise<void>;
    reason: PaperTradingComparisonActivationSideResultRecord["reason"];
  }): Promise<StartSettlement> {
    const effectStartedAt = this.readNow(
      "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
    );
    const authority = runtimeWriteContext(input.attempt, input.role, "stop");
    const raw = Promise.resolve().then(() => this.options.sessions.stopComparisonSide({
      side: structuredClone(input.attempt[input.role]),
      authority,
      deadlineAt: input.deadlineAt,
      reason: input.reason
    }));
    const resolved = raw.then<StartSettlement, StartSettlement>(
      async (status) => {
        let inspected: PaperTradingComparisonSessionSideStatus | undefined;
        try {
          inspected = await Promise.race([
            this.options.sessions.inspectComparisonSide({
              side: structuredClone(input.attempt[input.role]),
              authority
            }),
            input.deadline.then(() => undefined)
          ]);
        } catch {
          inspected = undefined;
        }
        if (!validInactiveStatus(status, input.attempt[input.role]) ||
          !validInactiveStatus(inspected, input.attempt[input.role])) {
          return {
            role: input.role,
            effectStartedAt,
            effectCompletedAt: this.readNow(
              "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
            ),
            kind: "failed",
            stableErrorCode: "paper_trading_comparison_cleanup_status_invalid"
          };
        }
        return {
          role: input.role,
          effectStartedAt,
          effectCompletedAt: this.readNow(
            "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
          ),
          kind: "resolved",
          status: inspected
        };
      },
      (error) => ({
        role: input.role,
        effectStartedAt,
        effectCompletedAt: this.readNow(
          "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
        ),
        kind: "failed",
        stableErrorCode: stableSessionErrorCode(error, "cleanup")
      })
    );
    return Promise.race([
      resolved,
      input.deadline.then<StartSettlement>(() => ({
        role: input.role,
        effectStartedAt,
        effectCompletedAt: input.deadlineAt,
        kind: "timed_out",
        stableErrorCode: "paper_trading_comparison_cleanup_timed_out",
        latePromise: raw
      }))
    ]);
  }

  private observeLateStart(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    role: Role,
    late: Promise<PaperTradingComparisonSessionSideStatus>
  ): void {
    void late.then(
      async () => {
        const deadlineAt = new Date(
          Date.parse(this.readNow(
            "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
          )) + attempt.activation_policy.cleanup_timeout_ms
        ).toISOString();
        await this.options.sessions.stopComparisonSide({
          side: structuredClone(attempt[role]),
          authority: runtimeWriteContext(attempt, role, "stop"),
          deadlineAt,
          reason: "policy_cleanup"
        });
      },
      () => undefined
    ).catch(() => undefined);
  }

  private async persistSideResult(
    result: PaperTradingComparisonActivationSideResultRecord
  ): Promise<PaperTradingComparisonActivationSideResultRecord> {
    const persisted = await this.options.store
      .recordPaperTradingComparisonActivationSideResult(result);
    const reloaded = await this.options.store.getPaperTradingComparisonActivationSideResult(
      result.paper_trading_comparison_activation_side_result_id
    );
    if (!isDeepStrictEqual(persisted, result) || !isDeepStrictEqual(reloaded, result)) {
      throw new Error("side result reload mismatch");
    }
    return result;
  }

  private async persistOutcome(input: {
    attempt: PaperTradingComparisonActivationAttemptRecord;
    priorOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
    status: PaperTradingComparisonActivationOutcomeStatus;
    reason: PaperTradingComparisonActivationOutcomeReason;
    results: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>;
    windowClosure?: PaperTradingComparisonWindowClosureEvidence;
    completedAt: string;
  }): Promise<PaperTradingComparisonActivationOutcomeRecord> {
    const outcome = buildOutcome(input);
    try {
      const persisted = await this.options.store
        .recordPaperTradingComparisonActivationOutcome(outcome);
      const reloaded = await this.options.store.getPaperTradingComparisonActivationOutcome(
        outcome.paper_trading_comparison_activation_outcome_id
      );
      if (!isDeepStrictEqual(persisted, outcome) || !isDeepStrictEqual(reloaded, outcome)) {
        throw new Error("outcome reload mismatch");
      }
      return outcome;
    } catch (error) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_outcome_persistence_failed",
        "Paper comparison activation outcome could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }
  }

  private async replayExisting(
    activation: PaperTradingComparisonActivationRecord,
    _tick: PaperTradingComparisonTickRecord,
    attempt: PaperTradingComparisonActivationAttemptRecord,
    marketDataView: ComparisonMarketDataView
  ): Promise<PaperTradingComparisonRuntimeActivationResult> {
    if (!paperTradingComparisonActivationAttemptHasRuntimeShape(attempt) ||
      attempt.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      attempt.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      attempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(attempt)
      )) {
      throw graphInvalid();
    }
    let results: PaperTradingComparisonActivationSideResultRecord[];
    let outcomes: PaperTradingComparisonActivationOutcomeRecord[];
    try {
      [results, outcomes] = await Promise.all([
        this.options.store.listPaperTradingComparisonActivationSideResults(
          attempt.paper_trading_comparison_activation_attempt_id
        ),
        this.options.store.listPaperTradingComparisonActivationOutcomes(
          attempt.paper_trading_comparison_activation_attempt_id
        )
      ]);
    } catch {
      throw graphInvalid();
    }
    const outcome = outcomes.at(-1);
    if (!outcome) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_incomplete",
        "Paper comparison activation attempt requires reconciliation before reuse."
      );
    }
    if (outcome.outcome_status === "both_running" &&
      !this.ownedRunningAttemptIds.has(
        attempt.paper_trading_comparison_activation_attempt_id
      )) {
      throw new PaperTradingComparisonRuntimeActivationError(
        "paper_trading_comparison_runtime_activation_attempt_incomplete",
        "Paper comparison both-running attempt is unowned and requires restart recovery."
      );
    }
    if (outcome.outcome_status === "both_running") {
      const inspectionDeadlineAt = new Date(
        Date.parse(this.readNow(
          "paper_trading_comparison_runtime_activation_attempt_incomplete"
        )) + attempt.activation_policy.cleanup_timeout_ms
      ).toISOString();
      const inspectionDeadline = deadlineSignal(inspectionDeadlineAt, this.now);
      const inspection = await this.inspectBoth(
        attempt,
        "start",
        inspectionDeadline.promise
      );
      inspectionDeadline.cancel();
      const statuses = ROLES.map((role) => inspection[role]);
      const startedTimes = statuses.map((status, index) =>
        validRunningStatus(status, attempt[ROLES[index]!])
          ? Date.parse(status.sandbox_started_at!)
          : Number.NaN
      );
      if (statuses.some((status, index) =>
        !validRunningStatus(status, attempt[ROLES[index]!]) ||
        status.provider_request_count >
          attempt.activation_policy.maximum_provider_request_count_per_side
      ) || startedTimes.some((time) => !Number.isFinite(time)) ||
        Math.abs(startedTimes[0]! - startedTimes[1]!) >
          attempt.activation_policy.maximum_start_skew_ms) {
        this.ownedRunningAttemptIds.delete(
          attempt.paper_trading_comparison_activation_attempt_id
        );
        throw new PaperTradingComparisonRuntimeActivationError(
          "paper_trading_comparison_runtime_activation_attempt_incomplete",
          "Paper comparison both-running attempt no longer has owned running sessions."
        );
      }
    }
    if (results.some((result) =>
      !paperTradingComparisonActivationSideResultHasRuntimeShape(result) ||
      result.side_result_digest !== canonicalDigest(
        paperTradingComparisonActivationSideResultDigestInput(result)
      )) || outcomes.some((candidate, index) =>
      !paperTradingComparisonActivationOutcomeHasRuntimeShape(candidate) ||
      candidate.outcome_sequence !== index + 1 ||
      candidate.outcome_digest !== canonicalDigest(
        paperTradingComparisonActivationOutcomeDigestInput(candidate)
      ))) {
      throw graphInvalid();
    }
    const latest = latestResults(results);
    return activationResult(
      activation,
      attempt,
      latest,
      outcome,
      outcome.outcome_status === "both_running" ? marketDataView : undefined
    );
  }

  private async readAttemptEvidence(
    attempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<{
    results: PaperTradingComparisonActivationSideResultRecord[];
    outcomes: PaperTradingComparisonActivationOutcomeRecord[];
  }> {
    let results: PaperTradingComparisonActivationSideResultRecord[];
    let outcomes: PaperTradingComparisonActivationOutcomeRecord[];
    try {
      [results, outcomes] = await Promise.all([
        this.options.store.listPaperTradingComparisonActivationSideResults(
          attempt.paper_trading_comparison_activation_attempt_id
        ),
        this.options.store.listPaperTradingComparisonActivationOutcomes(
          attempt.paper_trading_comparison_activation_attempt_id
        )
      ]);
    } catch {
      throw recoveryFailed("Paper comparison attempt evidence could not be read.");
    }
    for (const role of ROLES) {
      const roleResults = results.filter((result) => result.role === role);
      if (roleResults.some((result, index) =>
        result.operation_sequence !== index + 1)) {
        throw recoveryFailed("Paper comparison side result chain is not contiguous.");
      }
    }
    if (results.some((result) =>
      !paperTradingComparisonActivationSideResultHasRuntimeShape(result) ||
      result.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      result.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      result.side_result_digest !== canonicalDigest(
        paperTradingComparisonActivationSideResultDigestInput(result)
      )) || outcomes.some((outcome, index) =>
      !paperTradingComparisonActivationOutcomeHasRuntimeShape(outcome) ||
      outcome.outcome_sequence !== index + 1 ||
      outcome.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      outcome.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      outcome.outcome_digest !== canonicalDigest(
        paperTradingComparisonActivationOutcomeDigestInput(outcome)
      ))) {
      throw recoveryFailed("Paper comparison attempt evidence is malformed.");
    }
    return { results, outcomes };
  }

  private readNow(code: PaperTradingComparisonRuntimeActivationErrorCode): string {
    const now = this.now();
    if (!exactIsoTimestamp(now)) {
      throw new PaperTradingComparisonRuntimeActivationError(
        code,
        "Paper comparison activation clock returned an invalid timestamp."
      );
    }
    return now;
  }
}

function normalizeInput(input: {
  activationId: string;
  idempotencyKey: string;
}): { activationId: string; idempotencyKey: string } {
  if (!isRecord(input) || typeof input.activationId !== "string" ||
    typeof input.idempotencyKey !== "string") {
    throw invalidInput();
  }
  const activationId = input.activationId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!activationId || !idempotencyKey) throw invalidInput();
  return { activationId, idempotencyKey };
}

function normalizeStopInput(input: {
  attemptId: string;
  reason: "handoff_cleanup";
}): { attemptId: string; reason: "handoff_cleanup" } {
  if (!isRecord(input) || typeof input.attemptId !== "string" ||
    input.attemptId.trim() !== input.attemptId || !input.attemptId ||
    input.reason !== "handoff_cleanup") throw invalidInput();
  return { attemptId: input.attemptId, reason: input.reason };
}

function buildAttempt(input: {
  activation: PaperTradingComparisonActivationRecord;
  attemptId: string;
  attemptSequence: number;
  attemptedAt: string;
}): PaperTradingComparisonActivationAttemptRecord {
  const attempt: PaperTradingComparisonActivationAttemptRecord = {
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id: input.attemptId,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: input.activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: input.activation.activation_digest,
    paper_trading_comparison_commitment_ref: {
      ...input.activation.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      input.activation.paper_trading_comparison_commitment_digest,
    first_tick_ref: { ...input.activation.first_tick_ref },
    first_tick_digest: input.activation.first_tick_digest,
    champion: structuredClone(input.activation.champion),
    challenger: structuredClone(input.activation.challenger),
    activation_policy: structuredClone(input.activation.activation_policy),
    attempt_sequence: input.attemptSequence,
    retry_index: input.attemptSequence - 1,
    start_mode: "parallel",
    attempt_status: "starting",
    attempted_at: input.attemptedAt,
    start_deadline_at: new Date(
      Date.parse(input.attemptedAt) +
        input.activation.activation_policy.maximum_activation_elapsed_ms
    ).toISOString(),
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return {
    ...attempt,
    attempt_digest: canonicalDigest(
      paperTradingComparisonActivationAttemptDigestInput(attempt)
    )
  };
}

function startResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  settlement: StartSettlement
): PaperTradingComparisonActivationSideResultRecord {
  const side = attempt[settlement.role];
  const status = validSessionStatus(settlement.status, side)
    ? settlement.status
    : undefined;
  const actualRequestCount = status?.provider_request_count ?? 0;
  const requestCount = Math.min(
    actualRequestCount,
    attempt.activation_policy.maximum_provider_request_count_per_side
  );
  let outcome: PaperTradingComparisonActivationSideResultOutcome;
  let stableErrorCode: string | undefined;
  if (settlement.kind === "timed_out") {
    outcome = "timed_out";
    stableErrorCode = settlement.stableErrorCode;
  } else if (settlement.kind === "failed") {
    outcome = "failed";
    stableErrorCode = settlement.stableErrorCode;
  } else if (!status || !validRunningStatus(status, side)) {
    outcome = "failed";
    stableErrorCode = "paper_trading_comparison_session_status_invalid";
  } else if (actualRequestCount >
    attempt.activation_policy.maximum_provider_request_count_per_side) {
    outcome = "failed";
    stableErrorCode = "paper_trading_comparison_provider_request_budget_exceeded";
  } else if (Date.parse(settlement.effectCompletedAt) >
    Date.parse(attempt.start_deadline_at)) {
    outcome = "failed";
    stableErrorCode = "paper_trading_comparison_activation_elapsed_exceeded";
  } else {
    outcome = "succeeded";
  }
  return withSideResultDigest({
    record_kind: "paper_trading_comparison_activation_side_result",
    version: 1,
    paper_trading_comparison_activation_side_result_id: deterministicRecordId(
      "paper-comparison-activation-side-result",
      `${attempt.paper_trading_comparison_activation_attempt_id}:${settlement.role}:start:1`
    ),
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
    role: settlement.role,
    operation_sequence: 1,
    operation: "start",
    reason: "symmetric_start",
    outcome,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref },
    ...(status?.sandbox_ref ? { sandbox_ref: { ...status.sandbox_ref } } : {}),
    runtime_lifecycle_status: status?.runtime_lifecycle_status ?? "unknown",
    evaluation_status: status?.evaluation_status ?? "unknown",
    provider_request_count: requestCount,
    effect_started_at: settlement.effectStartedAt,
    effect_completed_at: settlement.effectCompletedAt,
    ...(stableErrorCode ? { stable_error_code: stableErrorCode } : {}),
    side_result_digest: "",
    authority_status: "not_live"
  });
}

function stopResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  settlement: StartSettlement,
  operationSequence: number,
  reason: PaperTradingComparisonActivationSideResultRecord["reason"]
): PaperTradingComparisonActivationSideResultRecord {
  const side = attempt[settlement.role];
  const status = validSessionStatus(settlement.status, side)
    ? settlement.status
    : undefined;
  let outcome: PaperTradingComparisonActivationSideResultOutcome;
  let stableErrorCode: string | undefined;
  if (settlement.kind === "timed_out") {
    outcome = "timed_out";
    stableErrorCode = settlement.stableErrorCode;
  } else if (settlement.kind === "failed" || !status ||
    !validInactiveStatus(status, side)) {
    outcome = "failed";
    stableErrorCode = settlement.stableErrorCode ??
      "paper_trading_comparison_cleanup_status_invalid";
  } else if (status.runtime_lifecycle_status === "registered" &&
    status.evaluation_status === "not_started") {
    outcome = "not_running";
  } else {
    outcome = "succeeded";
  }
  return withSideResultDigest({
    record_kind: "paper_trading_comparison_activation_side_result",
    version: 1,
    paper_trading_comparison_activation_side_result_id: deterministicRecordId(
      "paper-comparison-activation-side-result",
      `${attempt.paper_trading_comparison_activation_attempt_id}:${settlement.role}:stop:${operationSequence}`
    ),
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
    role: settlement.role,
    operation_sequence: operationSequence,
    operation: "stop",
    reason,
    outcome,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref },
    ...(status?.sandbox_ref ? { sandbox_ref: { ...status.sandbox_ref } } : {}),
    runtime_lifecycle_status: status?.runtime_lifecycle_status ?? "unknown",
    evaluation_status: status?.evaluation_status ?? "unknown",
    provider_request_count: Math.min(
      status?.provider_request_count ?? 0,
      attempt.activation_policy.maximum_provider_request_count_per_side
    ),
    effect_started_at: settlement.effectStartedAt,
    effect_completed_at: settlement.effectCompletedAt,
    ...(stableErrorCode ? { stable_error_code: stableErrorCode } : {}),
    side_result_digest: "",
    authority_status: "not_live"
  });
}

function buildOutcome(input: {
  attempt: PaperTradingComparisonActivationAttemptRecord;
  priorOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
  status: PaperTradingComparisonActivationOutcomeStatus;
  reason: PaperTradingComparisonActivationOutcomeReason;
  results: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>;
  windowClosure?: PaperTradingComparisonWindowClosureEvidence;
  completedAt: string;
}): PaperTradingComparisonActivationOutcomeRecord {
  const sequence = input.priorOutcomes.length + 1;
  const outcome: PaperTradingComparisonActivationOutcomeRecord = {
    record_kind: "paper_trading_comparison_activation_outcome",
    version: 1,
    paper_trading_comparison_activation_outcome_id: deterministicRecordId(
      "paper-comparison-activation-outcome",
      `${input.attempt.paper_trading_comparison_activation_attempt_id}:${sequence}`
    ),
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: input.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: input.attempt.attempt_digest,
    paper_trading_comparison_activation_ref: {
      ...input.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      input.attempt.paper_trading_comparison_activation_digest,
    outcome_sequence: sequence,
    ...(sequence > 1 ? {
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: input.priorOutcomes.at(-1)!
          .paper_trading_comparison_activation_outcome_id
      }
    } : {}),
    outcome_status: input.status,
    outcome_reason: input.reason,
    ...(input.results.champion ? {
      champion_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: input.results.champion.paper_trading_comparison_activation_side_result_id
      }
    } : {}),
    ...(input.results.challenger ? {
      challenger_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: input.results.challenger.paper_trading_comparison_activation_side_result_id
      }
    } : {}),
    ...(input.windowClosure ? {
      window_closure: structuredClone(input.windowClosure)
    } : {}),
    next_action: input.status === "both_running"
      ? "capture_first_paired_checkpoint"
      : input.status === "stopped_cleanly"
        ? input.reason === "handoff_cleanup"
          ? "checkpoint_handoff_complete"
          : "retry_activation"
        : "recover_cleanup",
    completed_at: input.completedAt,
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  return {
    ...outcome,
    outcome_digest: canonicalDigest(
      paperTradingComparisonActivationOutcomeDigestInput(outcome)
    )
  };
}

function withSideResultDigest(
  result: PaperTradingComparisonActivationSideResultRecord
): PaperTradingComparisonActivationSideResultRecord {
  return {
    ...result,
    side_result_digest: canonicalDigest(
      paperTradingComparisonActivationSideResultDigestInput(result)
    )
  };
}

function activationResult(
  activation: PaperTradingComparisonActivationRecord,
  attempt: PaperTradingComparisonActivationAttemptRecord,
  results: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>>,
  outcome: PaperTradingComparisonActivationOutcomeRecord,
  marketDataView?: ComparisonMarketDataView
): PaperTradingComparisonRuntimeActivationResult {
  return {
    status: outcome.outcome_status,
    activation: structuredClone(activation),
    attempt: structuredClone(attempt),
    ...(results.champion ? { championResult: structuredClone(results.champion) } : {}),
    ...(results.challenger
      ? { challengerResult: structuredClone(results.challenger) }
      : {}),
    outcome: structuredClone(outcome),
    ...(marketDataView ? { marketDataView } : {}),
    authority_status: "not_live"
  };
}

function latestResults(
  results: PaperTradingComparisonActivationSideResultRecord[]
): Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>> {
  const latest: Partial<Record<Role, PaperTradingComparisonActivationSideResultRecord>> = {};
  for (const result of results) latest[result.role] = result;
  return latest;
}

function runtimeWriteContext(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: Role,
  operation: "start" | "stop"
): PaperTradingComparisonRuntimeWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    role,
    operation
  };
}

function validRunningStatus(
  value: unknown,
  side: PaperTradingComparisonActivationSide
): value is PaperTradingComparisonSessionSideStatus {
  return validSessionStatus(value, side) &&
    value.runtime_lifecycle_status === "running" &&
    value.evaluation_status === "running" &&
    value.sandbox_lifecycle_status === "running" &&
    value.sandbox_ref?.record_kind === "sandbox" &&
    exactIsoTimestamp(value.sandbox_started_at) &&
    value.provider_session_active;
}

function validInactiveStatus(
  value: unknown,
  side: PaperTradingComparisonActivationSide
): value is PaperTradingComparisonSessionSideStatus {
  return validSessionStatus(value, side) &&
    (value.runtime_lifecycle_status === "registered" ||
      value.runtime_lifecycle_status === "stopped") &&
    (value.evaluation_status === "not_started" ||
      value.evaluation_status === "stopped" ||
      value.evaluation_status === "failed") &&
    (value.sandbox_lifecycle_status === undefined ||
      value.sandbox_lifecycle_status === "stopped" ||
      value.sandbox_lifecycle_status === "removed") &&
    !value.provider_session_active;
}

function validSessionStatus(
  value: unknown,
  side: PaperTradingComparisonActivationSide
): value is PaperTradingComparisonSessionSideStatus {
  return isRecord(value) &&
    value.role === side.role &&
    paperTradingComparisonRefsEqual(value.trading_run_ref, side.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      value.paper_trading_evaluation_ref,
      side.paper_trading_evaluation_ref
    ) &&
    Number.isInteger(value.provider_request_count) &&
    (value.provider_request_count as number) >= 0 &&
    typeof value.provider_session_active === "boolean" &&
    exactIsoTimestamp(value.observed_at) &&
    value.authority_status === "not_live";
}

function deadlineSignal(
  deadlineAt: string,
  now: () => string,
  controller?: AbortController
): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    const current = now();
    const delay = exactIsoTimestamp(current)
      ? Math.max(0, Date.parse(deadlineAt) - Date.parse(current))
      : 0;
    timer = setTimeout(() => {
      controller?.abort();
      resolve();
    }, delay);
    (timer as { unref?: () => void }).unref?.();
  });
  return {
    promise,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer);
    }
  };
}

function stableSessionErrorCode(error: unknown, phase: "start" | "cleanup"): string {
  if (isRecord(error) && typeof error.code === "string" &&
    STABLE_SESSION_ERROR_CODES.has(error.code)) {
    return error.code;
  }
  return phase === "start"
    ? "paper_trading_comparison_session_start_failed"
    : "paper_trading_comparison_session_cleanup_failed";
}

function deterministicRecordId(prefix: string, input: string): string {
  return `${prefix}-${createHash("sha256").update(input).digest("hex").slice(0, 32)}`;
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function exactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidInput(): PaperTradingComparisonRuntimeActivationError {
  return new PaperTradingComparisonRuntimeActivationError(
    "invalid_paper_trading_comparison_runtime_activation_input",
    "Paper comparison activation ID and idempotency key are required."
  );
}

function attemptNotOwned(): PaperTradingComparisonRuntimeActivationError {
  return new PaperTradingComparisonRuntimeActivationError(
    "paper_trading_comparison_runtime_activation_attempt_not_owned",
    "Paper comparison activation attempt is not owned by this coordinator."
  );
}

function graphInvalid(): PaperTradingComparisonRuntimeActivationError {
  return new PaperTradingComparisonRuntimeActivationError(
    "paper_trading_comparison_runtime_activation_graph_invalid",
    "Paper comparison runtime activation graph is invalid."
  );
}

function recoveryFailed(message: string): PaperTradingComparisonRuntimeActivationError {
  return new PaperTradingComparisonRuntimeActivationError(
    "paper_trading_comparison_runtime_activation_recovery_failed",
    message
  );
}
