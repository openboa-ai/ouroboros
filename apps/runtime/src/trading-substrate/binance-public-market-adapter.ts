import {
  type ConfigurationDerivativesTradingUsdsFutures,
  DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL,
  DerivativesTradingUsdsFutures
} from "@binance/derivatives-trading-usds-futures";
import type { PublicMarketLivenessSurfaceRecord } from "@ouroboros/domain";

export interface BinanceRestResponse<T> {
  data(): Promise<T>;
}

export interface BinancePublicMarketLivenessClient {
  exchangeInformation(): Promise<BinanceRestResponse<BinanceExchangeInformationPayload>>;
  markPrice(
    requestParameters?: { symbol?: string }
  ): Promise<BinanceRestResponse<BinanceMarkPricePayload | BinanceMarkPricePayload[]>>;
  checkServerTime(): Promise<BinanceRestResponse<BinanceServerTimePayload>>;
}

export interface BinancePublicMarketAdapterOptions {
  client: BinancePublicMarketLivenessClient;
  observedAt?: string;
}

export interface BinancePublicMarketSdkAdapterOptions {
  restBaseUrl: string;
  client?: BinancePublicMarketLivenessClient;
}

export class BinancePublicMarketSdkAdapter {
  private readonly client: BinancePublicMarketLivenessClient;

  constructor(options: BinancePublicMarketSdkAdapterOptions) {
    this.client = options.client ?? createOfficialBinanceUsdsFuturesPublicMarketClient(options.restBaseUrl);
  }

  readBtcUsdtPublicMarketLivenessSurface(
    observedAt = new Date().toISOString()
  ): Promise<PublicMarketLivenessSurfaceRecord> {
    return readBinanceBtcUsdtPublicMarketLivenessSurface({
      client: this.client,
      observedAt
    });
  }
}

interface BinanceExchangeInformationPayload {
  serverTime?: number | bigint;
  symbols?: BinanceExchangeInformationSymbol[];
}

interface BinanceExchangeInformationSymbol {
  symbol?: string;
  contractType?: string;
  status?: string;
  filters?: BinanceExchangeInformationFilter[];
}

interface BinanceExchangeInformationFilter {
  filterType?: string;
  tickSize?: string;
  minQty?: string;
  stepSize?: string;
  notional?: string;
}

interface BinanceMarkPricePayload {
  symbol?: string;
  markPrice?: string;
  indexPrice?: string;
  estimatedSettlePrice?: string;
  lastFundingRate?: string;
  interestRate?: string;
  nextFundingTime?: number | bigint;
  time?: number | bigint;
}

interface BinanceServerTimePayload {
  serverTime?: number | bigint;
}

const binanceUsdsFuturesConnectorTransport = {
  transport_kind: "official_binance_connector",
  repository: "binance/binance-connector-js",
  package_name: "@binance/derivatives-trading-usds-futures",
  api_family: "derivatives_trading_usds_futures",
  supported_endpoints: ["rest_api", "websocket_api", "websocket_streams"],
  production_base_url: "https://fapi.binance.com",
  testnet_base_url: "https://demo-fapi.binance.com",
  integration_role: "transport_only",
  authority_status: "not_live"
} as const;

export function createOfficialBinanceUsdsFuturesPublicMarketClient(
  basePath = DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL
): BinancePublicMarketLivenessClient {
  // The official package type requires credentials globally, but these public REST calls do not.
  const publicRestConfiguration = {
    configurationRestAPI: {
      basePath
    }
  } as unknown as ConfigurationDerivativesTradingUsdsFutures;
  const client = new DerivativesTradingUsdsFutures(publicRestConfiguration);
  return client.restAPI;
}

export async function readBinanceBtcUsdtPublicMarketLivenessSurface({
  client,
  observedAt = new Date().toISOString()
}: BinancePublicMarketAdapterOptions): Promise<PublicMarketLivenessSurfaceRecord> {
  const [exchangeInfo, markPricePayload, serverTime] = await Promise.all([
    client.exchangeInformation().then((response) => response.data()),
    client.markPrice({ symbol: "BTCUSDT" }).then((response) => response.data()),
    client.checkServerTime().then((response) => response.data())
  ]);
  const symbol = exchangeInfo.symbols?.find((candidate) => candidate.symbol === "BTCUSDT");
  if (!symbol) {
    throw new Error("Binance exchangeInformation response did not include BTCUSDT.");
  }

  const markPrice = normalizeMarkPricePayload(markPricePayload);
  const priceFilter = requiredFilter(symbol, "PRICE_FILTER");
  const quantityFilter = requiredFilter(symbol, "LOT_SIZE");
  const minNotionalFilter = optionalFilter(symbol, "MIN_NOTIONAL");
  const markTime = requiredEpochMs(markPrice.time, "mark price time");
  const nextFundingTime = requiredEpochMs(markPrice.nextFundingTime, "next funding time");
  const effectiveServerTime = serverTime.serverTime ?? exchangeInfo.serverTime;
  const observedEpochMs = Date.parse(observedAt);
  if (!Number.isFinite(observedEpochMs)) {
    throw new Error(`Invalid observedAt timestamp: ${observedAt}`);
  }

  return {
    record_kind: "public_market_liveness_surface",
    version: 1,
    public_market_liveness_surface_id: `binance-btcusdt-public-market-liveness-${observedEpochMs}`,
    surface_family: "public_market_liveness",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    symbol_status: requiredString(symbol.status, "symbol status"),
    contract_type: requiredString(symbol.contractType, "contract type"),
    price_tick_size: requiredString(priceFilter.tickSize, "price tick size"),
    quantity_step_size: requiredString(quantityFilter.stepSize, "quantity step size"),
    min_quantity: requiredString(quantityFilter.minQty, "minimum quantity"),
    min_notional: minNotionalFilter?.notional,
    mark_price: requiredString(markPrice.markPrice, "mark price"),
    index_price: requiredString(markPrice.indexPrice, "index price"),
    estimated_settle_price: markPrice.estimatedSettlePrice,
    funding_rate: requiredString(markPrice.lastFundingRate, "funding rate"),
    interest_rate: markPrice.interestRate,
    next_funding_time: epochMsToIso(nextFundingTime),
    server_time: epochMsToIso(requiredEpochMs(effectiveServerTime, "server time")),
    source_timestamp: epochMsToIso(markTime),
    observed_at: observedAt,
    updated_at: observedAt,
    freshness: "fresh",
    liveness: "connected",
    source_kind: "binance_market_data_rest",
    source_ref: {
      record_kind: "binance_rest_endpoint",
      id: "fapi-v1-exchangeInfo-premiumIndex-time"
    },
    transport: binanceUsdsFuturesConnectorTransport,
    fixture_backed: false,
    simulated: false,
    no_authority: {
      live_exchange: false,
      order_submission: false,
      credentials: false
    },
    authority_status: "read_only"
  };
}

function normalizeMarkPricePayload(
  payload: BinanceMarkPricePayload | BinanceMarkPricePayload[]
): BinanceMarkPricePayload {
  const markPrice = Array.isArray(payload)
    ? payload.find((candidate) => candidate.symbol === "BTCUSDT")
    : payload;
  if (!markPrice || markPrice.symbol !== "BTCUSDT") {
    throw new Error("Binance markPrice response did not include BTCUSDT.");
  }
  return markPrice;
}

function requiredFilter(
  symbol: BinanceExchangeInformationSymbol,
  filterType: string
): BinanceExchangeInformationFilter {
  const filter = optionalFilter(symbol, filterType);
  if (!filter) {
    throw new Error(`Binance exchangeInformation BTCUSDT response is missing ${filterType}.`);
  }
  return filter;
}

function optionalFilter(
  symbol: BinanceExchangeInformationSymbol,
  filterType: string
): BinanceExchangeInformationFilter | undefined {
  return symbol.filters?.find((filter) => filter.filterType === filterType);
}

function requiredString(value: string | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`Binance public market response is missing ${fieldName}.`);
  }
  return value;
}

function requiredEpochMs(value: number | bigint | undefined, fieldName: string): number {
  if (value === undefined) {
    throw new Error(`Binance public market response is missing ${fieldName}.`);
  }
  return Number(value);
}

function epochMsToIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}
