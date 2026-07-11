import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointAttemptHasRuntimeShape,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonCheckpointOutcomeHasRuntimeShape,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickAcknowledgementHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingComparisonTickCaptureWriteContext,
  type PaperTradingComparisonTickRecord,
  type PaperTradingPublicExecutionSnapshotSummary
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import { isStoreErrorLike, type OuroborosStorePort } from "../../ports/store";
import type { MarketSnapshot } from "../research/types";
import { paperTradingMarketDataConfigurationDigest } from "./commitment";
import {
  ComparisonMarketDataView,
  type ComparisonMarketDataViewOptions
} from "./comparison-market-data-view";
import type {
  PaperTradingComparisonCoordinator,
  VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";
import { marketSnapshotSummary } from "./evaluation";

export type PaperTradingComparisonTickErrorCode =
  | "invalid_paper_trading_comparison_tick_input"
  | "paper_trading_comparison_not_found"
  | "paper_trading_comparison_tick_graph_invalid"
  | "paper_trading_comparison_tick_not_owned"
  | "paper_trading_comparison_next_tick_conflict"
  | "paper_trading_comparison_market_configuration_mismatch"
  | "paper_trading_comparison_first_tick_conflict"
  | "paper_trading_comparison_tick_idempotency_conflict"
  | "paper_trading_comparison_market_read_failed"
  | "paper_trading_comparison_tick_ineligible"
  | "paper_trading_comparison_tick_persistence_failed";

export class PaperTradingComparisonTickError extends Error {
  constructor(
    readonly code: PaperTradingComparisonTickErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonTickError";
  }
}

export interface PaperTradingComparisonTickCoordinatorOptions {
  store: OuroborosStorePort;
  comparisons: Pick<PaperTradingComparisonCoordinator, "reload">;
  marketData: GatewayMarketDataPort;
  activations?: {
    ownsRunningAttempt(attemptId: string): boolean;
  };
  now?: () => string;
}

export interface CapturedPaperTradingComparisonTick {
  tick: PaperTradingComparisonTickRecord;
  marketDataView: ComparisonMarketDataView;
}

export interface CapturedPaperTradingComparisonFirstTick
  extends CapturedPaperTradingComparisonTick {
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
}

interface LoadedNextTickGraph {
  activation: PaperTradingComparisonActivationRecord;
  activationAttempt: PaperTradingComparisonActivationAttemptRecord;
  activationOutcome: PaperTradingComparisonActivationOutcomeRecord;
  comparison: PaperTradingComparisonCommitmentRecord;
  previousCheckpointAttempt: PaperTradingComparisonCheckpointAttemptRecord;
  previousCheckpointOutcome: PaperTradingComparisonCheckpointOutcomeRecord;
  previousTick: PaperTradingComparisonTickRecord;
  acknowledgements: Record<
    "champion" | "challenger",
    PaperTradingComparisonTickAcknowledgementRecord
  >;
  nextSequence: number;
}

export class PaperTradingComparisonTickCoordinator {
  private readonly now: () => string;
  private captureQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: PaperTradingComparisonTickCoordinatorOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  captureFirstTick(input: {
    comparisonId: string;
    idempotencyKey: string;
  }): Promise<CapturedPaperTradingComparisonFirstTick> {
    return this.withCaptureQueue(() => this.captureFirstTickUnlocked(input));
  }

  captureNextTick(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<CapturedPaperTradingComparisonTick> {
    return this.withCaptureQueue(() => this.captureNextTickUnlocked(input));
  }

  private withCaptureQueue<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.captureQueue.then(task);
    this.captureQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async captureFirstTickUnlocked(input: {
    comparisonId: string;
    idempotencyKey: string;
  }): Promise<CapturedPaperTradingComparisonFirstTick> {
    const comparisonId = input.comparisonId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    if (!comparisonId || !idempotencyKey) {
      throw new PaperTradingComparisonTickError(
        "invalid_paper_trading_comparison_tick_input",
        "Paper comparison ID and first-tick idempotency key are required."
      );
    }
    const tickId = comparisonTickId(comparisonId, idempotencyKey);
    const existing = await this.readTick(tickId);
    const comparison = await this.loadVerifiedComparison(comparisonId);
    this.assertMarketConfiguration(comparison);

    if (existing) {
      this.assertTickMatchesComparison(existing, comparison, tickId);
      await this.assertSoleFirstTick(existing);
      return this.capturedResult(comparison, existing);
    }

    const currentTicks = await this.readTicks(comparisonId);
    if (currentTicks.length > 0) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_first_tick_conflict",
        "Paper comparison already has a different first tick."
      );
    }

    let market: MarketSnapshot;
    let publicExecution: PaperTradingPublicExecutionSnapshotSummary;
    try {
      [market, publicExecution] = await Promise.all([
        this.options.marketData.readMarketSnapshot(),
        this.options.marketData.readPublicExecutionSnapshot()
      ]);
    } catch {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_market_read_failed",
        "Gateway public market evidence could not be captured."
      );
    }

    const observedAt = this.now();
    if (market.symbol !== "BTCUSDT" || market.source_kind === undefined) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_ineligible",
        "Gateway public market evidence is not eligible for a first comparison tick."
      );
    }
    const draft: PaperTradingComparisonTickRecord = {
      record_kind: "paper_trading_comparison_tick",
      version: 1,
      paper_trading_comparison_tick_id: tickId,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: comparison.commitment.paper_trading_comparison_commitment_id
      },
      paper_trading_comparison_commitment_digest:
        comparison.commitment.commitment_digest,
      sequence: 1,
      market_data_configuration_digest:
        comparison.commitment.market_data_configuration_digest,
      market_snapshot: marketSnapshotSummary(market),
      public_execution_snapshot: structuredClone(publicExecution),
      observed_at: observedAt,
      tick_digest: "",
      authority_status: "not_live"
    };
    const tick = withTickDigest(draft);
    if (
      !paperTradingComparisonTickHasRuntimeShape(tick) ||
      Date.parse(tick.observed_at) < Date.parse(comparison.commitment.committed_at) ||
      Date.parse(tick.observed_at) < Date.parse(tick.market_snapshot.observed_at) ||
      Date.parse(tick.observed_at) <
        Date.parse(tick.public_execution_snapshot.observed_at)
    ) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_ineligible",
        "Gateway public market evidence is not eligible for a first comparison tick."
      );
    }

    try {
      await this.options.store.recordPaperTradingComparisonTick(tick);
    } catch (error) {
      if (
        isStoreErrorLike(error) &&
        error.code === "paper_trading_comparison_first_tick_conflict"
      ) {
        throw new PaperTradingComparisonTickError(
          "paper_trading_comparison_first_tick_conflict",
          "Paper comparison already has a different first tick."
        );
      }
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_persistence_failed",
        "Paper comparison first tick could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }

    const persisted = await this.readTick(tickId);
    if (!persisted || !samePersistedRecord(persisted, tick)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_persistence_failed",
        "Persisted paper comparison first tick does not match the captured record."
      );
    }
    const reloadedComparison = await this.loadVerifiedComparison(comparisonId);
    this.assertMarketConfiguration(reloadedComparison);
    this.assertTickMatchesComparison(persisted, reloadedComparison, tickId);
    await this.assertSoleFirstTick(persisted);
    return this.capturedResult(reloadedComparison, persisted);
  }

  private async captureNextTickUnlocked(input: {
    activationId: string;
    activationAttemptId: string;
    idempotencyKey: string;
  }): Promise<CapturedPaperTradingComparisonTick> {
    const activationId = input.activationId.trim();
    const activationAttemptId = input.activationAttemptId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    if (!activationId || !activationAttemptId || !idempotencyKey) {
      throw new PaperTradingComparisonTickError(
        "invalid_paper_trading_comparison_tick_input",
        "Activation, activation attempt, and next-tick idempotency identities are required."
      );
    }
    if (!this.options.activations?.ownsRunningAttempt(activationAttemptId)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_not_owned",
        "Next comparison tick requires the in-process owned running attempt."
      );
    }

    const graph = await this.loadNextTickGraph(activationId, activationAttemptId);
    this.assertMarketConfigurationDigest(graph.comparison.market_data_configuration_digest);
    const tickId = nextComparisonTickId(
      activationAttemptId,
      graph.nextSequence,
      idempotencyKey
    );
    const authority = nextTickCaptureWriteContext(graph);
    const existing = await this.readTick(tickId);
    if (existing) {
      this.assertNextTickMatchesGraph(existing, graph, tickId);
      try {
        await this.options.store.recordPaperTradingComparisonTick(existing, authority);
      } catch (error) {
        throw this.nextTickPersistenceError(error);
      }
      return this.capturedTickResult(existing);
    }

    const now = this.readCaptureTime();
    const minimumObservedAt = Date.parse(graph.previousTick.observed_at) +
      graph.comparison.comparison_policy.interval_ms;
    const maximumObservedAt = Date.parse(graph.activationAttempt.attempted_at) +
      graph.comparison.comparison_policy.maximum_elapsed_ms;
    if (Date.parse(now) < minimumObservedAt || Date.parse(now) > maximumObservedAt ||
      graph.nextSequence > graph.comparison.comparison_policy.maximum_observation_count) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_next_tick_conflict",
        "Next comparison tick is outside the frozen cadence, count, or elapsed window."
      );
    }

    let market: MarketSnapshot;
    let publicExecution: PaperTradingPublicExecutionSnapshotSummary;
    try {
      [market, publicExecution] = await Promise.all([
        this.options.marketData.readMarketSnapshot(),
        this.options.marketData.readPublicExecutionSnapshot()
      ]);
    } catch {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_market_read_failed",
        "Gateway public market evidence could not be captured."
      );
    }
    const draft: PaperTradingComparisonTickRecord = {
      record_kind: "paper_trading_comparison_tick",
      version: 1,
      paper_trading_comparison_tick_id: tickId,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: graph.comparison.paper_trading_comparison_commitment_id
      },
      paper_trading_comparison_commitment_digest: graph.comparison.commitment_digest,
      sequence: graph.nextSequence,
      previous_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: graph.previousTick.paper_trading_comparison_tick_id
      },
      previous_tick_digest: graph.previousTick.tick_digest,
      market_data_configuration_digest: graph.comparison.market_data_configuration_digest,
      market_snapshot: marketSnapshotSummary(market),
      public_execution_snapshot: structuredClone(publicExecution),
      observed_at: now,
      tick_digest: "",
      authority_status: "not_live"
    };
    const tick = withTickDigest(draft);
    this.assertNextTickMatchesGraph(tick, graph, tickId);
    try {
      await this.options.store.recordPaperTradingComparisonTick(tick, authority);
    } catch (error) {
      throw this.nextTickPersistenceError(error);
    }
    const persisted = await this.readTick(tickId);
    if (!persisted || !samePersistedRecord(persisted, tick)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_persistence_failed",
        "Persisted next comparison tick does not match the captured record."
      );
    }
    return this.capturedTickResult(persisted);
  }

  private async loadNextTickGraph(
    activationId: string,
    activationAttemptId: string
  ): Promise<LoadedNextTickGraph> {
    let activation: unknown;
    let activationAttempt: unknown;
    try {
      [activation, activationAttempt] = await Promise.all([
        this.options.store.getPaperTradingComparisonActivation(activationId),
        this.options.store.getPaperTradingComparisonActivationAttempt(activationAttemptId)
      ]);
    } catch {
      throw this.nextTickGraphInvalid();
    }
    if (!paperTradingComparisonActivationHasRuntimeShape(activation) ||
      activation.paper_trading_comparison_activation_id !== activationId ||
      activation.activation_digest !== canonicalDigest(
        paperTradingComparisonActivationDigestInput(activation)
      ) ||
      !paperTradingComparisonActivationAttemptHasRuntimeShape(activationAttempt) ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !== activationAttemptId ||
      activationAttempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(activationAttempt)
      ) ||
      !paperTradingComparisonRefsEqual(
        activationAttempt.paper_trading_comparison_activation_ref,
        { record_kind: "paper_trading_comparison_activation", id: activationId }
      ) ||
      activationAttempt.paper_trading_comparison_activation_digest !==
        activation.activation_digest) {
      throw this.nextTickGraphInvalid();
    }

    let comparison: unknown;
    let activationAttempts: unknown;
    let activationOutcomes: unknown;
    let checkpointAttempts: unknown;
    let ticks: unknown;
    let acknowledgements: unknown;
    try {
      [comparison, activationAttempts, activationOutcomes, checkpointAttempts, ticks,
        acknowledgements] = await Promise.all([
          this.options.store.getPaperTradingComparisonCommitment(
            activation.paper_trading_comparison_commitment_ref.id
          ),
          this.options.store.listPaperTradingComparisonActivationAttempts(activationId),
          this.options.store.listPaperTradingComparisonActivationOutcomes(activationAttemptId),
          this.options.store.listPaperTradingComparisonCheckpointAttempts(activationAttemptId),
          this.options.store.listPaperTradingComparisonTicks(
            activation.paper_trading_comparison_commitment_ref.id
          ),
          this.options.store.listPaperTradingComparisonTickAcknowledgements(activationAttemptId)
        ]);
    } catch {
      throw this.nextTickGraphInvalid();
    }
    if (!paperTradingComparisonCommitmentHasRuntimeShape(comparison) ||
      comparison.commitment_digest !== canonicalDigest(
        paperTradingComparisonCommitmentDigestInput(comparison)
      ) ||
      !paperTradingComparisonRefsEqual(
        activation.paper_trading_comparison_commitment_ref,
        {
          record_kind: "paper_trading_comparison_commitment",
          id: comparison.paper_trading_comparison_commitment_id
        }
      ) ||
      activation.paper_trading_comparison_commitment_digest !== comparison.commitment_digest ||
      !Array.isArray(activationAttempts) ||
      !isDeepStrictEqual(activationAttempts.at(-1), activationAttempt) ||
      !Array.isArray(activationOutcomes) ||
      !Array.isArray(checkpointAttempts) || checkpointAttempts.length === 0 ||
      !Array.isArray(ticks) ||
      !Array.isArray(acknowledgements)) {
      throw this.nextTickGraphInvalid();
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
      throw this.nextTickGraphInvalid();
    }

    const typedTicks: PaperTradingComparisonTickRecord[] = [];
    for (let index = 0; index < ticks.length; index += 1) {
      const tick = ticks[index];
      const previous = typedTicks[index - 1];
      if (!paperTradingComparisonTickHasRuntimeShape(tick) ||
        tick.sequence !== index + 1 ||
        tick.tick_digest !== canonicalDigest(paperTradingComparisonTickDigestInput(tick)) ||
        tick.paper_trading_comparison_commitment_ref.id !==
          comparison.paper_trading_comparison_commitment_id ||
        tick.paper_trading_comparison_commitment_digest !== comparison.commitment_digest ||
        (previous && (!paperTradingComparisonRefsEqual(tick.previous_tick_ref, {
          record_kind: "paper_trading_comparison_tick",
          id: previous.paper_trading_comparison_tick_id
        }) || tick.previous_tick_digest !== previous.tick_digest))) {
        throw this.nextTickGraphInvalid();
      }
      typedTicks.push(tick);
    }

    const typedCheckpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[] = [];
    const checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
    for (let index = 0; index < checkpointAttempts.length; index += 1) {
      const checkpointAttempt = checkpointAttempts[index];
      if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(checkpointAttempt) ||
        checkpointAttempt.checkpoint_sequence !== index + 1 ||
        checkpointAttempt.attempt_digest !== canonicalDigest(
          paperTradingComparisonCheckpointAttemptDigestInput(checkpointAttempt)
        ) ||
        checkpointAttempt.paper_trading_comparison_activation_attempt_ref.id !==
          activationAttemptId ||
        checkpointAttempt.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        checkpointAttempt.tick_ref.id !== typedTicks[index]?.paper_trading_comparison_tick_id ||
        checkpointAttempt.tick_digest !== typedTicks[index]?.tick_digest) {
        throw this.nextTickGraphInvalid();
      }
      const outcomes = await this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      ).catch(() => {
        throw this.nextTickGraphInvalid();
      });
      const outcome = outcomes[0];
      if (outcomes.length !== 1 ||
        !paperTradingComparisonCheckpointOutcomeHasRuntimeShape(outcome) ||
        outcome.outcome_status !== "paired" ||
        outcome.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
        outcome.checkpoint_attempt_ref.id !==
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
        outcome.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
        outcome.outcome_digest !== canonicalDigest(
          paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
        ) ||
        outcome.champion?.observation_status === "failed" ||
        outcome.challenger?.observation_status === "failed") {
        throw this.nextTickGraphInvalid();
      }
      typedCheckpointAttempts.push(checkpointAttempt);
      checkpointOutcomes.push(outcome);
    }

    const nextSequence = typedCheckpointAttempts.length + 1;
    if (typedTicks.length < nextSequence - 1 || typedTicks.length > nextSequence ||
      nextSequence > comparison.comparison_policy.maximum_observation_count) {
      throw this.nextTickGraphInvalid();
    }
    const previousTick = typedTicks[nextSequence - 2];
    const previousCheckpointAttempt = typedCheckpointAttempts.at(-1);
    const previousCheckpointOutcome = checkpointOutcomes.at(-1);
    if (!previousTick || !previousCheckpointAttempt || !previousCheckpointOutcome ||
      previousCheckpointOutcome.checkpoint_sequence !== nextSequence - 1 ||
      previousCheckpointOutcome.next_action !== (nextSequence === 2
        ? "serve_and_acknowledge_current_tick"
        : "capture_next_tick")) {
      throw this.nextTickGraphInvalid();
    }

    const typedAcknowledgements = acknowledgements.filter(
      paperTradingComparisonTickAcknowledgementHasRuntimeShape
    );
    if (typedAcknowledgements.length !== acknowledgements.length) {
      throw this.nextTickGraphInvalid();
    }
    const roleAcknowledgements = {} as LoadedNextTickGraph["acknowledgements"];
    for (const role of ["champion", "challenger"] as const) {
      const matches = typedAcknowledgements.filter((record) =>
        record.role === role &&
        record.tick_ref.id === previousTick.paper_trading_comparison_tick_id
      );
      const acknowledgement = matches[0];
      if (matches.length !== 1 || !acknowledgement ||
        acknowledgement.acknowledgement_digest !== canonicalDigest(
          paperTradingComparisonTickAcknowledgementDigestInput(acknowledgement)
        ) ||
        acknowledgement.paper_trading_comparison_activation_attempt_ref.id !==
          activationAttemptId ||
        acknowledgement.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        acknowledgement.trading_run_ref.id !== activationAttempt[role].trading_run_ref.id ||
        acknowledgement.tick_digest !== previousTick.tick_digest ||
        acknowledgement.tick_sequence !== previousTick.sequence) {
        throw this.nextTickGraphInvalid();
      }
      roleAcknowledgements[role] = acknowledgement;
    }

    return {
      activation,
      activationAttempt,
      activationOutcome,
      comparison,
      previousCheckpointAttempt,
      previousCheckpointOutcome,
      previousTick,
      acknowledgements: roleAcknowledgements,
      nextSequence
    };
  }

  private assertMarketConfigurationDigest(expected: string): void {
    if (expected !== paperTradingMarketDataConfigurationDigest(this.options.marketData)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_market_configuration_mismatch",
        "Gateway market configuration differs from the frozen comparison."
      );
    }
  }

  private readCaptureTime(): string {
    const value = this.now();
    if (!exactIsoTimestamp(value)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_ineligible",
        "Next comparison tick capture time is invalid."
      );
    }
    return value;
  }

  private assertNextTickMatchesGraph(
    tick: unknown,
    graph: LoadedNextTickGraph,
    expectedTickId: string
  ): asserts tick is PaperTradingComparisonTickRecord {
    if (!paperTradingComparisonTickHasRuntimeShape(tick)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_ineligible",
        "Gateway public market evidence is not eligible for a next comparison tick."
      );
    }
    if (tick.paper_trading_comparison_tick_id !== expectedTickId ||
      tick.tick_digest !== canonicalDigest(paperTradingComparisonTickDigestInput(tick)) ||
      tick.sequence !== graph.nextSequence ||
      !paperTradingComparisonRefsEqual(tick.previous_tick_ref, {
        record_kind: "paper_trading_comparison_tick",
        id: graph.previousTick.paper_trading_comparison_tick_id
      }) ||
      tick.previous_tick_digest !== graph.previousTick.tick_digest ||
      tick.paper_trading_comparison_commitment_ref.id !==
        graph.comparison.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !== graph.comparison.commitment_digest ||
      tick.market_data_configuration_digest !==
        graph.comparison.market_data_configuration_digest ||
      Date.parse(tick.observed_at) < Date.parse(graph.previousTick.observed_at) +
        graph.comparison.comparison_policy.interval_ms ||
      Date.parse(tick.observed_at) < Date.parse(tick.market_snapshot.observed_at) ||
      Date.parse(tick.observed_at) < Date.parse(tick.public_execution_snapshot.observed_at)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_next_tick_conflict",
        "Next comparison tick does not match its frozen predecessor and policy."
      );
    }
  }

  private nextTickPersistenceError(error: unknown): PaperTradingComparisonTickError {
    const reason = isStoreErrorLike(error) ? error.code : undefined;
    const diagnostic = error instanceof Error ? error.message : undefined;
    const conflict = reason?.includes("capture_") || reason?.includes("sequence_conflict");
    return new PaperTradingComparisonTickError(
      conflict
        ? "paper_trading_comparison_next_tick_conflict"
        : "paper_trading_comparison_tick_persistence_failed",
      conflict
        ? `Next comparison tick conflicts with persisted comparison state${
            diagnostic ? `: ${diagnostic}` : reason ? `: ${reason}` : ""
          }.`
        : `Next comparison tick could not be persisted${
            diagnostic ? `: ${diagnostic}` : reason ? `: ${reason}` : ""
          }.`,
      { ...(reason ? { reason } : {}), ...(diagnostic ? { diagnostic } : {}) }
    );
  }

  private nextTickGraphInvalid(): PaperTradingComparisonTickError {
    return new PaperTradingComparisonTickError(
      "paper_trading_comparison_tick_graph_invalid",
      "Repeated paper comparison tick graph is invalid or incomplete."
    );
  }

  private async loadVerifiedComparison(
    comparisonId: string
  ): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
    let comparison: VerifiedPaperTradingComparisonCommitmentGraph | undefined;
    try {
      comparison = await this.options.comparisons.reload(comparisonId);
    } catch {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_graph_invalid",
        "Paper comparison commitment graph could not be verified."
      );
    }
    if (!comparison) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_not_found",
        "Paper comparison commitment was not found."
      );
    }
    const commitment = comparison.commitment as unknown;
    if (
      !isRecord(commitment) ||
      commitment.paper_trading_comparison_commitment_id !== comparisonId ||
      !nonEmptyString(commitment.commitment_digest) ||
      !nonEmptyString(commitment.market_data_configuration_digest) ||
      !exactIsoTimestamp(commitment.committed_at) ||
      comparison.verification?.status !== "verified" ||
      comparison.verification.activation_authority !== "not_granted"
    ) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_graph_invalid",
        "Paper comparison commitment graph has invalid verified state."
      );
    }
    return comparison;
  }

  private assertMarketConfiguration(
    comparison: VerifiedPaperTradingComparisonCommitmentGraph
  ): void {
    if (
      comparison.commitment.market_data_configuration_digest !==
        paperTradingMarketDataConfigurationDigest(this.options.marketData)
    ) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_market_configuration_mismatch",
        "Gateway market configuration differs from the frozen comparison."
      );
    }
  }

  private assertTickMatchesComparison(
    tick: unknown,
    comparison: VerifiedPaperTradingComparisonCommitmentGraph,
    expectedTickId: string
  ): asserts tick is PaperTradingComparisonTickRecord {
    if (!paperTradingComparisonTickHasRuntimeShape(tick)) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_graph_invalid",
        "Persisted first tick has invalid runtime shape."
      );
    }
    const expectedDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(tick))
      .digest("hex")}`;
    if (
      tick.paper_trading_comparison_tick_id !== expectedTickId ||
      tick.tick_digest !== expectedDigest ||
      tick.paper_trading_comparison_commitment_ref.id !==
        comparison.commitment.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !==
        comparison.commitment.commitment_digest ||
      tick.market_data_configuration_digest !==
        comparison.commitment.market_data_configuration_digest ||
      Date.parse(tick.observed_at) < Date.parse(comparison.commitment.committed_at) ||
      Date.parse(tick.observed_at) < Date.parse(tick.market_snapshot.observed_at) ||
      Date.parse(tick.observed_at) <
        Date.parse(tick.public_execution_snapshot.observed_at)
    ) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_idempotency_conflict",
        "Persisted first tick does not match the requested comparison capture."
      );
    }
  }

  private async assertSoleFirstTick(
    expected: PaperTradingComparisonTickRecord
  ): Promise<void> {
    const records = await this.readTicks(
      expected.paper_trading_comparison_commitment_ref.id
    );
    if (
      records.length !== 1 ||
      !isDeepStrictEqual(records[0], expected)
    ) {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_first_tick_conflict",
        "Paper comparison first-tick collection is not singular and exact."
      );
    }
  }

  private async readTick(
    tickId: string
  ): Promise<PaperTradingComparisonTickRecord | undefined> {
    try {
      return await this.options.store.getPaperTradingComparisonTick(tickId);
    } catch {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_graph_invalid",
        "Persisted paper comparison tick could not be read."
      );
    }
  }

  private async readTicks(
    comparisonId: string
  ): Promise<PaperTradingComparisonTickRecord[]> {
    try {
      return await this.options.store.listPaperTradingComparisonTicks(comparisonId);
    } catch {
      throw new PaperTradingComparisonTickError(
        "paper_trading_comparison_tick_graph_invalid",
        "Persisted paper comparison tick collection could not be read."
      );
    }
  }

  private capturedResult(
    comparison: VerifiedPaperTradingComparisonCommitmentGraph,
    tick: PaperTradingComparisonTickRecord
  ): CapturedPaperTradingComparisonFirstTick {
    const viewOptions: ComparisonMarketDataViewOptions = {
      source: this.options.marketData,
      tick
    };
    return {
      comparison,
      tick: structuredClone(tick),
      marketDataView: new ComparisonMarketDataView(viewOptions)
    };
  }

  private capturedTickResult(
    tick: PaperTradingComparisonTickRecord
  ): CapturedPaperTradingComparisonTick {
    return {
      tick: structuredClone(tick),
      marketDataView: new ComparisonMarketDataView({
        source: this.options.marketData,
        tick
      })
    };
  }
}

function comparisonTickId(comparisonId: string, idempotencyKey: string): string {
  const suffix = createHash("sha256")
    .update(`${comparisonId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 16);
  return `paper-trading-comparison-tick-${suffix}`;
}

function nextComparisonTickId(
  activationAttemptId: string,
  sequence: number,
  idempotencyKey: string
): string {
  const suffix = createHash("sha256")
    .update(`${activationAttemptId}:${sequence}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 16);
  return `paper-trading-comparison-tick-${suffix}`;
}

function nextTickCaptureWriteContext(
  graph: LoadedNextTickGraph
): PaperTradingComparisonTickCaptureWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: graph.activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: graph.activation.activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: graph.activationAttempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: graph.activationAttempt.attempt_digest,
    previous_checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: graph.previousCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
    },
    previous_checkpoint_attempt_digest: graph.previousCheckpointAttempt.attempt_digest,
    previous_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: graph.previousCheckpointOutcome.paper_trading_comparison_checkpoint_outcome_id
    },
    previous_checkpoint_outcome_digest: graph.previousCheckpointOutcome.outcome_digest,
    operation: "capture_next_tick"
  };
}

function withTickDigest(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  return {
    ...tick,
    tick_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(tick))
      .digest("hex")}`
  };
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function exactIsoTimestamp(value: unknown): value is string {
  if (!nonEmptyString(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function samePersistedRecord(left: unknown, right: unknown): boolean {
  try {
    return paperTradingComparisonPersistedRecordDigestInput(left) ===
      paperTradingComparisonPersistedRecordDigestInput(right);
  } catch {
    return false;
  }
}
