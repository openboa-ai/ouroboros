import { createHash } from "node:crypto";
import {
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonTickRecord,
  type PaperTradingMarketDataSourceKind,
  type PaperTradingPublicExecutionSnapshotSummary,
  type PublicMarketLivenessSurfaceRecord
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { MarketSnapshot } from "../research/types";
import { paperTradingMarketDataConfigurationDigest } from "./commitment";

export type ComparisonMarketDataViewErrorCode =
  | "invalid_paper_trading_comparison_tick"
  | "paper_trading_comparison_tick_digest_mismatch"
  | "paper_trading_comparison_market_configuration_mismatch"
  | "comparison_market_liveness_surface_unavailable";

export class ComparisonMarketDataViewError extends Error {
  constructor(
    readonly code: ComparisonMarketDataViewErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ComparisonMarketDataViewError";
  }
}

export interface ComparisonMarketDataViewOptions {
  source: GatewayMarketDataPort;
  tick: PaperTradingComparisonTickRecord;
}

export class ComparisonMarketDataView implements GatewayMarketDataPort {
  readonly provider_kind = "binance_production_public_market_data" as const;
  readonly source_kind: PaperTradingMarketDataSourceKind;
  readonly rest_base_url: string;
  readonly required_endpoints: readonly string[];
  readonly authority_status = "read_only" as const;
  private readonly tick: PaperTradingComparisonTickRecord;

  constructor(options: ComparisonMarketDataViewOptions) {
    if (!paperTradingComparisonTickHasRuntimeShape(options.tick)) {
      throw new ComparisonMarketDataViewError(
        "invalid_paper_trading_comparison_tick",
        "Comparison market data view requires one valid first tick."
      );
    }
    const expectedTickDigest = `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(options.tick))
      .digest("hex")}`;
    if (options.tick.tick_digest !== expectedTickDigest) {
      throw new ComparisonMarketDataViewError(
        "paper_trading_comparison_tick_digest_mismatch",
        "Comparison market data view tick digest does not match canonical content."
      );
    }
    if (
      options.tick.market_data_configuration_digest !==
        paperTradingMarketDataConfigurationDigest(options.source)
    ) {
      throw new ComparisonMarketDataViewError(
        "paper_trading_comparison_market_configuration_mismatch",
        "Comparison market data view source identity differs from the frozen tick."
      );
    }

    this.source_kind = options.source.source_kind;
    this.rest_base_url = options.source.rest_base_url;
    this.required_endpoints = [...options.source.required_endpoints];
    this.tick = structuredClone(options.tick);
  }

  async readMarketSnapshot(
    _input: { observedAt?: string } = {}
  ): Promise<MarketSnapshot> {
    const {
      authority_status: _authorityStatus,
      ...market
    } = this.tick.market_snapshot;
    return structuredClone(market) as MarketSnapshot;
  }

  async readPublicExecutionSnapshot(
    _input: { observedAt?: string } = {}
  ): Promise<PaperTradingPublicExecutionSnapshotSummary> {
    return structuredClone(this.tick.public_execution_snapshot);
  }

  async readPublicMarketLivenessSurface(
    _input: { observedAt?: string } = {}
  ): Promise<PublicMarketLivenessSurfaceRecord> {
    throw new ComparisonMarketDataViewError(
      "comparison_market_liveness_surface_unavailable",
      "Comparison tick does not contain a public market liveness surface."
    );
  }
}
