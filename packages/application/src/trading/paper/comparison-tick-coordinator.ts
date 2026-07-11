import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
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
  now?: () => string;
}

export interface CapturedPaperTradingComparisonFirstTick {
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
  tick: PaperTradingComparisonTickRecord;
  marketDataView: ComparisonMarketDataView;
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
}

function comparisonTickId(comparisonId: string, idempotencyKey: string): string {
  const suffix = createHash("sha256")
    .update(`${comparisonId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 16);
  return `paper-trading-comparison-tick-${suffix}`;
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
