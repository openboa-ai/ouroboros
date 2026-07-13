import type {
  PaperTradingMarketDataSourceKind,
  PaperTradingPublicExecutionSnapshotSummary,
  PublicMarketLivenessSurfaceRecord,
  ResearchGeneralizationPublicKlineWindowInput
} from "@ouroboros/domain";
import type { MarketSnapshot } from "../trading/research/types";

export interface PublicMarketDataClient {
  getServerTime(): Promise<unknown>;
  getExchangeInfo(): Promise<unknown>;
  getPremiumIndex(input: { symbol: string }): Promise<unknown>;
  getKlines(input: { symbol: string; interval: string; limit: number }): Promise<unknown>;
}

export interface GatewayMarketDataPort {
  provider_kind: "binance_production_public_market_data";
  source_kind: PaperTradingMarketDataSourceKind;
  rest_base_url: string;
  required_endpoints: readonly string[];
  authority_status: "read_only";
  readMarketSnapshot(input?: { observedAt?: string }): Promise<MarketSnapshot>;
  readPublicKlineWindow?(input: {
    symbol: "BTCUSDT";
    interval: "1m";
    limit: 30;
    observedAt: string;
  }): Promise<ResearchGeneralizationPublicKlineWindowInput>;
  readPublicMarketLivenessSurface(input?: { observedAt?: string }): Promise<PublicMarketLivenessSurfaceRecord>;
  readPublicExecutionSnapshot(input?: { observedAt?: string }): Promise<PaperTradingPublicExecutionSnapshotSummary>;
}
