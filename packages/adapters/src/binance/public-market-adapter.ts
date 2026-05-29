import {
  type ConfigurationDerivativesTradingUsdsFutures,
  DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL,
  DerivativesTradingUsdsFutures
} from "@binance/derivatives-trading-usds-futures";
import type {
  PaperTradingPublicExecutionSnapshotSummary,
  PublicMarketLivenessSurfaceRecord
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "@ouroboros/application/ports/market-data";
import { PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS } from "@ouroboros/application/trading/gateway/runtime-binding";
import type { MarketSnapshot } from "@ouroboros/application/trading/research/types";
import {
  BinanceMarketDataHub,
  type BinanceMarketDataHubOptions
} from "./market-data-hub";

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

export interface BinancePublicMarketDataClient extends BinancePublicMarketLivenessClient {
  klineCandlestickData(
    requestParameters: { symbol: "BTCUSDT"; interval: "1m"; limit: 30 }
  ): Promise<BinanceRestResponse<BinanceKlineCandlestickPayload>>;
}

export interface BinancePublicMarketAdapterOptions {
  client: BinancePublicMarketLivenessClient;
  observedAt?: string;
}

export interface BinancePublicMarketSdkAdapterOptions {
  restBaseUrl: string;
  client?: BinancePublicMarketDataClient;
  cache?: BinancePublicMarketCacheOptions | false;
  webSocket?: BinanceMarketDataHub | (Omit<BinanceMarketDataHubOptions, "restBaseUrl"> & { enabled?: boolean }) | false;
}

export interface BinancePublicMarketCacheOptions {
  exchangeInfoTtlMs?: number;
  serverTimeTtlMs?: number;
  markPriceTtlMs?: number;
  klinesTtlMs?: number;
  publicExecutionTtlMs?: number;
  now?: () => number;
}

export const DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS = {
  exchangeInfoTtlMs: 60 * 60 * 1_000,
  serverTimeTtlMs: 5_000,
  markPriceTtlMs: 5_000,
  klinesTtlMs: 30_000,
  publicExecutionTtlMs: 5_000
} as const;

export class BinancePublicMarketSdkAdapter implements GatewayMarketDataPort {
  readonly provider_kind = "binance_production_public_market_data" as const;
  readonly source_kind = "binance_production_public_hybrid" as const;
  readonly required_endpoints = PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS;
  readonly authority_status = "read_only" as const;
  private readonly client: BinancePublicMarketDataClient;
  private readonly publicExecutionCache: PublicExecutionSnapshotCache | undefined;
  private readonly marketDataHub: BinanceMarketDataHub | undefined;
  readonly rest_base_url: string;

  constructor(options: BinancePublicMarketSdkAdapterOptions) {
    this.rest_base_url = options.restBaseUrl;
    const client = options.client ?? createOfficialBinanceUsdsFuturesPublicMarketClient(options.restBaseUrl);
    this.client = options.cache === false
      ? client
      : new CachedBinancePublicMarketDataClient(client, options.cache);
    this.publicExecutionCache = options.cache === false
      ? undefined
      : new PublicExecutionSnapshotCache({
          ttlMs: options.cache?.publicExecutionTtlMs ??
            DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.publicExecutionTtlMs,
          now: options.cache?.now
        });
    this.marketDataHub = createOptionalMarketDataHub({
      restBaseUrl: options.restBaseUrl,
      webSocket: options.webSocket
    });
  }

  readBtcUsdtPublicMarketLivenessSurface(
    observedAt = new Date().toISOString()
  ): Promise<PublicMarketLivenessSurfaceRecord> {
    return readBinanceBtcUsdtPublicMarketLivenessSurface({
      client: this.client,
      observedAt
    });
  }

  readPublicMarketLivenessSurface(input: { observedAt?: string } = {}): Promise<PublicMarketLivenessSurfaceRecord> {
    return this.readBtcUsdtPublicMarketLivenessSurface(input.observedAt);
  }

  readMarketSnapshot(input: { observedAt?: string } = {}): Promise<MarketSnapshot> {
    const restSnapshot = () => readBinanceBtcUsdtMarketSnapshot({
      client: this.client,
      observedAt: input.observedAt
    });
    return this.marketDataHub
      ? this.marketDataHub.readMarketSnapshot({
          observedAt: input.observedAt,
          restSnapshot
        })
      : restSnapshot();
  }

  readPublicExecutionSnapshot(
    input: { observedAt?: string } = {}
  ): Promise<PaperTradingPublicExecutionSnapshotSummary> {
    const restExecutionSnapshot = () => this.publicExecutionCache
      ? this.publicExecutionCache.read(
          `BTCUSDT:${input.observedAt ?? "latest"}`,
          () => readBinanceBtcUsdtPublicExecutionSnapshot({
            restBaseUrl: this.rest_base_url,
            observedAt: input.observedAt
          })
        )
      : readBinanceBtcUsdtPublicExecutionSnapshot({
          restBaseUrl: this.rest_base_url,
          observedAt: input.observedAt
        });
    return this.marketDataHub
      ? this.marketDataHub.readPublicExecutionSnapshot({
          observedAt: input.observedAt,
          restExecutionSnapshot
        })
      : restExecutionSnapshot();
  }
}

function createOptionalMarketDataHub(input: {
  restBaseUrl: string;
  webSocket?: BinancePublicMarketSdkAdapterOptions["webSocket"];
}): BinanceMarketDataHub | undefined {
  const webSocket = input.webSocket;
  if (webSocket === undefined || webSocket === false) {
    return undefined;
  }
  if (webSocket instanceof BinanceMarketDataHub) {
    return webSocket;
  }
  if (webSocket.enabled === false) {
    return undefined;
  }
  return new BinanceMarketDataHub({
    ...webSocket,
    restBaseUrl: input.restBaseUrl
  });
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

type BinanceKlineCandlestickPayload = BinanceKlineCandlestickItem[];

type BinanceKlineCandlestickItem = Array<number | string>;

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

class CachedBinancePublicMarketDataClient implements BinancePublicMarketDataClient {
  private readonly cache = new Map<string, { expiresAt: number; payload: unknown }>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly ttl: Required<Omit<BinancePublicMarketCacheOptions, "now">>;
  private readonly now: () => number;

  constructor(
    private readonly client: BinancePublicMarketDataClient,
    options: BinancePublicMarketCacheOptions = {}
  ) {
    this.ttl = {
      exchangeInfoTtlMs: options.exchangeInfoTtlMs ?? DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.exchangeInfoTtlMs,
      serverTimeTtlMs: options.serverTimeTtlMs ?? DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.serverTimeTtlMs,
      markPriceTtlMs: options.markPriceTtlMs ?? DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.markPriceTtlMs,
      klinesTtlMs: options.klinesTtlMs ?? DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.klinesTtlMs,
      publicExecutionTtlMs: options.publicExecutionTtlMs ??
        DEFAULT_BINANCE_PUBLIC_MARKET_CACHE_TTLS.publicExecutionTtlMs
    };
    this.now = options.now ?? Date.now;
  }

  checkServerTime(): Promise<BinanceRestResponse<BinanceServerTimePayload>> {
    return this.cached("time", this.ttl.serverTimeTtlMs, () => this.client.checkServerTime());
  }

  exchangeInformation(): Promise<BinanceRestResponse<BinanceExchangeInformationPayload>> {
    return this.cached("exchange-info", this.ttl.exchangeInfoTtlMs, () => this.client.exchangeInformation());
  }

  markPrice(
    requestParameters?: { symbol?: string }
  ): Promise<BinanceRestResponse<BinanceMarkPricePayload | BinanceMarkPricePayload[]>> {
    return this.cached(
      `mark-price:${requestParameters?.symbol ?? "all"}`,
      this.ttl.markPriceTtlMs,
      () => this.client.markPrice(requestParameters)
    );
  }

  klineCandlestickData(
    requestParameters: { symbol: "BTCUSDT"; interval: "1m"; limit: 30 }
  ): Promise<BinanceRestResponse<BinanceKlineCandlestickPayload>> {
    return this.cached(
      `klines:${requestParameters.symbol}:${requestParameters.interval}:${requestParameters.limit}`,
      this.ttl.klinesTtlMs,
      () => this.client.klineCandlestickData(requestParameters)
    );
  }

  private async cached<T>(
    key: string,
    ttlMs: number,
    load: () => Promise<BinanceRestResponse<T>>
  ): Promise<BinanceRestResponse<T>> {
    const cached = this.cache.get(key);
    const now = this.now();
    if (cached && cached.expiresAt > now) {
      return responseFromPayload(cached.payload as T);
    }

    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return responseFromPayload(await existing);
    }

    const request = load()
      .then((response) => response.data())
      .then((payload) => {
        this.cache.set(key, {
          payload,
          expiresAt: this.now() + ttlMs
        });
        return payload;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, request);
    return responseFromPayload(await request);
  }
}

class PublicExecutionSnapshotCache {
  private cached?: { key: string; expiresAt: number; payload: PaperTradingPublicExecutionSnapshotSummary };
  private inFlight?: { key: string; promise: Promise<PaperTradingPublicExecutionSnapshotSummary> };
  private readonly now: () => number;

  constructor(private readonly input: {
    ttlMs: number;
    now?: () => number;
  }) {
    this.now = input.now ?? Date.now;
  }

  async read(
    key: string,
    load: () => Promise<PaperTradingPublicExecutionSnapshotSummary>
  ): Promise<PaperTradingPublicExecutionSnapshotSummary> {
    const now = this.now();
    if (this.cached && this.cached.key === key && this.cached.expiresAt > now) {
      return this.cached.payload;
    }
    if (this.inFlight?.key === key) {
      return this.inFlight.promise;
    }
    const promise = load()
      .then((payload) => {
        this.cached = {
          key,
          payload,
          expiresAt: this.now() + this.input.ttlMs
        };
        return payload;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    this.inFlight = { key, promise };
    return promise;
  }
}

function responseFromPayload<T>(payload: T): BinanceRestResponse<T> {
  return {
    async data() {
      return payload;
    }
  };
}

interface BinanceBookTickerPayload {
  symbol?: string;
  bidPrice?: string;
  bidQty?: string;
  askPrice?: string;
  askQty?: string;
  time?: number | bigint;
}

interface BinanceAggTradePayload {
  a?: number | bigint;
  p?: string;
  q?: string;
  T?: number | bigint;
  m?: boolean;
}

export function createOfficialBinanceUsdsFuturesPublicMarketClient(
  basePath = DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL
): BinancePublicMarketDataClient {
  // The official package type requires credentials globally, but these public REST calls do not.
  const publicRestConfiguration = {
    configurationRestAPI: {
      basePath
    }
  } as unknown as ConfigurationDerivativesTradingUsdsFutures;
  const client = new DerivativesTradingUsdsFutures(publicRestConfiguration);
  return client.restAPI as BinancePublicMarketDataClient;
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

export async function readBinanceBtcUsdtMarketSnapshot({
  client,
  observedAt
}: {
  client: BinancePublicMarketDataClient;
  observedAt?: string;
}): Promise<MarketSnapshot> {
  const serverTime = await client.checkServerTime().then((response) => response.data());
  const exchangeInfo = await client.exchangeInformation().then((response) => response.data());
  const markPricePayload = await client.markPrice({ symbol: "BTCUSDT" }).then((response) => response.data());
  const klinePayload = await client.klineCandlestickData({
    symbol: "BTCUSDT",
    interval: "1m",
    limit: 30
  }).then((response) => response.data());

  const symbol = exchangeInfo.symbols?.find((candidate) => candidate.symbol === "BTCUSDT");
  if (!symbol) {
    throw new Error("Binance exchangeInformation response did not include BTCUSDT.");
  }

  const markPrice = normalizeMarkPricePayload(markPricePayload);
  const closes = klinePayload
    .map((item) => decimalNumber(item[4]))
    .filter((value) => Number.isFinite(value));
  if (closes.length < 2) {
    throw new Error("Binance BTCUSDT kline response did not include enough close prices.");
  }

  const fastAverage = average(closes.slice(-Math.min(5, closes.length)));
  const slowAverage = average(closes);
  const observedEpochMs = observedAt
    ? Date.parse(observedAt)
    : requiredEpochMs(serverTime.serverTime ?? markPrice.time ?? exchangeInfo.serverTime, "server time");
  if (!Number.isFinite(observedEpochMs)) {
    throw new Error(`Invalid observedAt timestamp: ${observedAt}`);
  }

  return {
    symbol: "BTCUSDT",
    price: decimalNumber(requiredString(markPrice.markPrice, "mark price")),
    moving_average_fast: roundMarketNumber(fastAverage),
    moving_average_slow: roundMarketNumber(slowAverage),
    volatility: roundMarketNumber(closeVolatility(closes)),
    expected_direction: expectedDirection(fastAverage, slowAverage),
    observed_at: epochMsToIso(observedEpochMs)
  };
}

export async function readBinanceBtcUsdtPublicExecutionSnapshot({
  restBaseUrl,
  observedAt = new Date().toISOString()
}: {
  restBaseUrl: string;
  observedAt?: string;
}): Promise<PaperTradingPublicExecutionSnapshotSummary> {
  const baseUrl = trimTrailingSlashes(restBaseUrl);
  const [bookTicker, aggTrades] = await Promise.all([
    fetchBinancePublicJson<BinanceBookTickerPayload>(
      `${baseUrl}/fapi/v1/ticker/bookTicker?symbol=BTCUSDT`
    ),
    fetchBinancePublicJson<BinanceAggTradePayload[]>(
      `${baseUrl}/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100`
    )
  ]);
  if (bookTicker.symbol !== "BTCUSDT") {
    throw new Error("Binance bookTicker response did not include BTCUSDT.");
  }
  return {
    symbol: "BTCUSDT",
    observed_at: observedAt,
    source_kind: "binance_production_public_rest",
    source_priority: "rest_fallback",
    freshness: "fresh",
    ws_connected: false,
    rest_fallback_used: true,
    gap_detected: false,
    stream_marker: `binance-public-execution-${Date.parse(observedAt)}`,
    book_ticker: {
      bid_price: requiredString(bookTicker.bidPrice, "bookTicker bid price"),
      bid_quantity: requiredString(bookTicker.bidQty, "bookTicker bid quantity"),
      ask_price: requiredString(bookTicker.askPrice, "bookTicker ask price"),
      ask_quantity: requiredString(bookTicker.askQty, "bookTicker ask quantity"),
      event_time: bookTicker.time === undefined ? observedAt : epochMsToIso(requiredEpochMs(bookTicker.time, "bookTicker time"))
    },
    agg_trades: aggTrades.map((trade) => ({
      trade_id: String(requiredEpochMs(trade.a, "aggTrade id")),
      price: requiredString(trade.p, "aggTrade price"),
      quantity: requiredString(trade.q, "aggTrade quantity"),
      trade_time: epochMsToIso(requiredEpochMs(trade.T, "aggTrade time")),
      is_buyer_maker: trade.m
    })),
    authority_status: "read_only"
  };
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}

async function fetchBinancePublicJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance public market request failed: ${response.status}`);
  }
  return await response.json() as T;
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

function decimalNumber(value: number | string | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return Number.NaN;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function closeVolatility(closes: number[]): number {
  const returns = closes.slice(1).map((close, index) => {
    const previous = closes[index];
    return previous > 0 ? (close - previous) / previous : 0;
  });
  if (returns.length === 0) {
    return 0;
  }
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2)));
}

function expectedDirection(
  fastAverage: number,
  slowAverage: number
): MarketSnapshot["expected_direction"] {
  const threshold = Math.max(1, slowAverage * 0.00005);
  if (fastAverage > slowAverage + threshold) {
    return "long";
  }
  if (fastAverage < slowAverage - threshold) {
    return "short";
  }
  return "flat";
}

function roundMarketNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
