import { describe, expect, it, vi } from "vitest";
import type {
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingPublicExecutionSnapshotSummary
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { OuroborosStorePort } from "../../ports/store";
import type { MarketSnapshot } from "../research/types";
import { paperTradingMarketDataConfigurationDigest } from "./commitment";
import type { VerifiedPaperTradingComparisonCommitmentGraph } from "./comparison-coordinator";
import {
  PaperTradingComparisonTickCoordinator,
  PaperTradingComparisonTickError
} from "./comparison-tick-coordinator";

describe("PaperTradingComparisonTickCoordinator", () => {
  it("rejects an unowned next tick before Store graph or Gateway reads", async () => {
    const fixture = captureFixture();
    const coordinator = new PaperTradingComparisonTickCoordinator({
      store: fixture.store,
      comparisons: fixture.comparisons,
      marketData: fixture.marketData,
      activations: { ownsRunningAttempt: () => false },
      now: () => "2026-07-11T00:01:01.000Z"
    });

    await expect(coordinator.captureNextTick({
      activationId: "activation-1",
      activationAttemptId: "activation-attempt-1",
      idempotencyKey: "unowned-next-tick"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_not_owned"
    });
    expect(fixture.comparisons.reload).not.toHaveBeenCalled();
    expect(fixture.marketData.readMarketSnapshot).not.toHaveBeenCalled();
    expect(fixture.marketData.readPublicExecutionSnapshot).not.toHaveBeenCalled();
    expect(fixture.records).toEqual([]);
  });

  it("captures one shared first tick after verifying the inert graph", async () => {
    const fixture = captureFixture();

    const captured = await fixture.coordinator.captureFirstTick({
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "first-tick"
    });

    expect(fixture.comparisons.reload).toHaveBeenCalledTimes(2);
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.records).toEqual([captured.tick]);
    expect(captured.tick).toMatchObject({
      sequence: 1,
      observed_at: "2026-07-11T00:00:01.000Z",
      paper_trading_comparison_commitment_ref: {
        id: fixture.graph.commitment.paper_trading_comparison_commitment_id
      },
      paper_trading_comparison_commitment_digest:
        fixture.graph.commitment.commitment_digest,
      market_data_configuration_digest:
        fixture.graph.commitment.market_data_configuration_digest,
      authority_status: "not_live"
    });
    expect(captured.comparison.verification).toEqual({
      status: "verified",
      activation_authority: "not_granted"
    });

    await captured.marketDataView.readMarketSnapshot();
    await captured.marketDataView.readPublicExecutionSnapshot();
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("revalidates but performs no Gateway read for an exact retry", async () => {
    const fixture = captureFixture();
    const input = {
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "exact-retry"
    };
    const first = await fixture.coordinator.captureFirstTick(input);
    const marketReads = vi.mocked(fixture.marketData.readMarketSnapshot).mock.calls.length;
    const executionReads = vi.mocked(
      fixture.marketData.readPublicExecutionSnapshot
    ).mock.calls.length;

    const replay = await fixture.coordinator.captureFirstTick(input);

    expect(replay.tick).toEqual(first.tick);
    expect(fixture.comparisons.reload).toHaveBeenCalledTimes(3);
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(marketReads);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(
      executionReads
    );
    expect(fixture.records).toHaveLength(1);
  });

  it("rejects an alternate first tick before another Gateway read", async () => {
    const fixture = captureFixture();
    const comparisonId = fixture.graph.commitment.paper_trading_comparison_commitment_id;
    await fixture.coordinator.captureFirstTick({
      comparisonId,
      idempotencyKey: "winner"
    });

    await expect(fixture.coordinator.captureFirstTick({
      comparisonId,
      idempotencyKey: "alternate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_first_tick_conflict"
    });
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects missing graph and market configuration drift before Gateway reads", async () => {
    const missing = captureFixture({ missingGraph: true });
    await expect(missing.coordinator.captureFirstTick({
      comparisonId: "paper-comparison-001",
      idempotencyKey: "missing"
    })).rejects.toMatchObject({ code: "paper_trading_comparison_not_found" });
    expect(missing.marketData.readMarketSnapshot).not.toHaveBeenCalled();

    const drifted = captureFixture({ configurationDrift: true });
    await expect(drifted.coordinator.captureFirstTick({
      comparisonId: drifted.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "drift"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_market_configuration_mismatch"
    });
    expect(drifted.marketData.readMarketSnapshot).not.toHaveBeenCalled();
    expect(drifted.marketData.readPublicExecutionSnapshot).not.toHaveBeenCalled();
  });

  it("revalidates an existing tick before returning it", async () => {
    const fixture = captureFixture();
    const input = {
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "revalidate"
    };
    await fixture.coordinator.captureFirstTick(input);
    vi.mocked(fixture.comparisons.reload).mockResolvedValueOnce(undefined);

    await expect(fixture.coordinator.captureFirstTick(input)).rejects.toMatchObject({
      code: "paper_trading_comparison_not_found"
    });
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("fails closed on a malformed stored tick without throwing a raw TypeError", async () => {
    const fixture = captureFixture();
    const input = {
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "malformed-retry"
    };
    const captured = await fixture.coordinator.captureFirstTick(input);
    fixture.records[0] = {
      paper_trading_comparison_tick_id:
        captured.tick.paper_trading_comparison_tick_id
    } as PaperTradingComparisonTickRecord;

    await expect(fixture.coordinator.captureFirstTick(input)).rejects.toMatchObject({
      code: "paper_trading_comparison_tick_graph_invalid"
    });
  });

  it("persists no tick when either Gateway read fails", async () => {
    const fixture = captureFixture({ marketReadFailure: true });

    await expect(fixture.coordinator.captureFirstTick({
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "read-failure"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_market_read_failed"
    });
    expect(fixture.records).toEqual([]);
  });

  it.each([
    ["stale market", { market: { freshness: "stale" } }],
    ["market gap", { market: { gap_detected: true } }],
    ["wrong symbol", { market: { symbol: "ETHUSDT" } }],
    ["missing source kind", { market: { source_kind: undefined } }],
    ["stale execution", { execution: { freshness: "stale" } }],
    ["execution gap", { execution: { gap_detected: true } }]
  ] as const)("persists no tick for %s", async (_label, mutation) => {
    const fixture = captureFixture({ evidenceMutation: mutation });

    await expect(fixture.coordinator.captureFirstTick({
      comparisonId: fixture.graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: _label
    })).rejects.toMatchObject({ code: "paper_trading_comparison_tick_ineligible" });
    expect(fixture.records).toEqual([]);
  });

  it("serializes competing first-tick captures and performs one read pair", async () => {
    const fixture = captureFixture();
    const comparisonId = fixture.graph.commitment.paper_trading_comparison_commitment_id;

    const results = await Promise.allSettled([
      fixture.coordinator.captureFirstTick({ comparisonId, idempotencyKey: "concurrent-a" }),
      fixture.coordinator.captureFirstTick({ comparisonId, idempotencyKey: "concurrent-b" })
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({
      code: "paper_trading_comparison_first_tick_conflict"
    });
    expect(fixture.records).toHaveLength(1);
    expect(fixture.marketData.readMarketSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.marketData.readPublicExecutionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects empty capture identity", async () => {
    const fixture = captureFixture();
    await expect(fixture.coordinator.captureFirstTick({
      comparisonId: "",
      idempotencyKey: ""
    })).rejects.toBeInstanceOf(PaperTradingComparisonTickError);
    expect(fixture.marketData.readMarketSnapshot).not.toHaveBeenCalled();
  });
});

interface CaptureFixtureOptions {
  missingGraph?: boolean;
  configurationDrift?: boolean;
  marketReadFailure?: boolean;
  evidenceMutation?: {
    market?: Record<string, unknown>;
    execution?: Record<string, unknown>;
  };
}

function captureFixture(options: CaptureFixtureOptions = {}) {
  const records: PaperTradingComparisonTickRecord[] = [];
  const marketData = marketDataPort(options);
  const graph = verifiedGraph(
    options.configurationDrift
      ? "sha256:drifted-market-configuration"
      : paperTradingMarketDataConfigurationDigest(marketData)
  );
  const store = {
    async getPaperTradingComparisonTick(tickId: string) {
      return records.find((record) => record.paper_trading_comparison_tick_id === tickId);
    },
    async listPaperTradingComparisonTicks(comparisonId: string) {
      return records.filter((record) =>
        record.paper_trading_comparison_commitment_ref.id === comparisonId
      );
    },
    async recordPaperTradingComparisonTick(tick: PaperTradingComparisonTickRecord) {
      records.push(structuredClone(tick));
      return structuredClone(tick);
    }
  } as OuroborosStorePort;
  const comparisons = {
    reload: vi.fn(async () => options.missingGraph ? undefined : graph)
  };
  const coordinator = new PaperTradingComparisonTickCoordinator({
    store,
    comparisons,
    marketData,
    now: () => "2026-07-11T00:00:01.000Z"
  });
  return { coordinator, store, comparisons, graph, marketData, records };
}

function verifiedGraph(
  marketDataConfigurationDigest: string
): VerifiedPaperTradingComparisonCommitmentGraph {
  const commitment = {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "paper-comparison-001",
    commitment_digest: "sha256:comparison",
    market_data_configuration_digest: marketDataConfigurationDigest,
    committed_at: "2026-07-10T00:00:00.000Z"
  } as PaperTradingComparisonCommitmentRecord;
  return {
    commitment,
    verification: {
      status: "verified",
      activation_authority: "not_granted"
    }
  } as VerifiedPaperTradingComparisonCommitmentGraph;
}

function marketDataPort(options: CaptureFixtureOptions): GatewayMarketDataPort {
  const market = {
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
    ...options.evidenceMutation?.market
  } as MarketSnapshot;
  const execution = {
    symbol: "BTCUSDT",
    observed_at: "2026-07-11T00:00:00.000Z",
    source_kind: "binance_production_public_rest",
    source_priority: "rest_fallback",
    freshness: "fresh",
    ws_connected: false,
    rest_fallback_used: true,
    gap_detected: false,
    stream_marker: "public-execution-capture-001",
    agg_trades: [],
    authority_status: "read_only",
    ...options.evidenceMutation?.execution
  } as PaperTradingPublicExecutionSnapshotSummary;
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: ["/market", "/execution"],
    authority_status: "read_only",
    readMarketSnapshot: vi.fn(async () => {
      if (options.marketReadFailure) {
        throw new Error("injected_market_failure");
      }
      return structuredClone(market);
    }),
    readPublicExecutionSnapshot: vi.fn(async () => structuredClone(execution)),
    readPublicMarketLivenessSurface: vi.fn(async () => {
      throw new Error("not_used");
    })
  };
}
