import type {
  GatewayResultAuthorityStatus,
  LedgerInput,
  TradingRuntimeEnvironment
} from "@ouroboros/domain";
import {
  BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL
} from "./environment";
import { recordPaperExecutionResult } from "./paper-execution";
import { startReplayTradingApiProvider } from "../research/replay-trading-api-provider";
import type {
  AccountState,
  MarketSnapshot,
  ReplayTradingApiProviderSession
} from "../research/types";
import {
  type PaperGatewayOrderRequest,
  validatePaperGatewayOrderRequest
} from "./validation";

export const LIVE_GATEWAY_DISABLED_REASON = "live_gateway_not_enabled_in_mlp";

export const PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS = [
  "/fapi/v1/time",
  "/fapi/v1/exchangeInfo",
  "/fapi/v1/premiumIndex?symbol=BTCUSDT",
  "/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=30"
] as const;

export interface GatewayRuntimeBinding {
  environment: TradingRuntimeEnvironment;
  status: "enabled" | "disabled";
  disabled_reason?: typeof LIVE_GATEWAY_DISABLED_REASON;
  marketData: BinanceProductionPublicMarketDataProvider;
  account: PaperAccountProvider | LiveAccountProvider;
  executor: PaperOrderExecutor | LiveOrderExecutor;
  ledger: LedgerRecorder;
  live_exchange_authority: false;
  order_submission_authority: false;
}

export interface BinanceProductionPublicMarketDataProvider {
  provider_kind: "binance_production_public_market_data";
  source_kind: "binance_production_public_rest";
  rest_base_url: typeof BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL;
  required_endpoints: typeof PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS;
  authority_status: "read_only";
  readMarketSnapshot(): Promise<MarketSnapshot>;
}

export interface PaperAccountProvider {
  provider_kind: "fake_paper_account";
  state: AccountState;
  authority_status: "not_live";
}

export interface LiveAccountProvider {
  provider_kind: "live_account";
  status: "disabled";
  disabled_reason: typeof LIVE_GATEWAY_DISABLED_REASON;
  authority_status: "not_live";
}

export interface PaperOrderExecutor {
  executor_kind: "fake_paper_order_executor";
  order_submission_authority: false;
  authority_status: GatewayResultAuthorityStatus;
}

export interface LiveOrderExecutor {
  executor_kind: "live_order_executor";
  status: "disabled";
  disabled_reason: typeof LIVE_GATEWAY_DISABLED_REASON;
  order_submission_authority: false;
  authority_status: "not_live";
}

export interface LedgerRecorder {
  recorder_kind: "fake_ledger" | "ledger";
  chain: "OrderRequest -> GatewayResult -> ExecutionResult";
  authority_status: "not_live";
}

export interface CreateGatewayRuntimeBindingInput {
  environment?: TradingRuntimeEnvironment;
  marketDataClient?: BinancePublicMarketDataClient;
  paperAccount?: AccountState;
}

export interface BinanceRestResponse<T> {
  data(): Promise<T>;
}

export interface BinancePublicMarketDataClient {
  exchangeInformation(): Promise<BinanceRestResponse<BinanceExchangeInformationPayload>>;
  markPrice(input?: { symbol?: string }): Promise<BinanceRestResponse<BinanceMarkPricePayload | BinanceMarkPricePayload[]>>;
  checkServerTime(): Promise<BinanceRestResponse<BinanceServerTimePayload>>;
  klineCandlestickData(input: { symbol: "BTCUSDT"; interval: "1m"; limit: 30 }): Promise<BinanceRestResponse<BinanceKlineCandlestickPayload>>;
}

export type GatewayOrderExecution = Pick<
  LedgerInput,
  "intent" | "gateway_result" | "execution_result"
>;

export function createGatewayRuntimeBinding(
  input: CreateGatewayRuntimeBindingInput = {}
): GatewayRuntimeBinding {
  const environment = input.environment ?? "paper";
  const marketData = createBinanceProductionPublicMarketDataProvider({
    client: input.marketDataClient
  });

  if (environment === "live") {
    return {
      environment,
      status: "disabled",
      disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
      marketData,
      account: {
        provider_kind: "live_account",
        status: "disabled",
        disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
        authority_status: "not_live"
      },
      executor: {
        executor_kind: "live_order_executor",
        status: "disabled",
        disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
        order_submission_authority: false,
        authority_status: "not_live"
      },
      ledger: {
        recorder_kind: "ledger",
        chain: "OrderRequest -> GatewayResult -> ExecutionResult",
        authority_status: "not_live"
      },
      live_exchange_authority: false,
      order_submission_authority: false
    };
  }

  return {
    environment,
    status: "enabled",
    marketData,
    account: {
      provider_kind: "fake_paper_account",
      state: input.paperAccount ?? defaultPaperAccount(),
      authority_status: "not_live"
    },
    executor: {
      executor_kind: "fake_paper_order_executor",
      order_submission_authority: false,
      authority_status: "dry_run_only"
    },
    ledger: {
      recorder_kind: "fake_ledger",
      chain: "OrderRequest -> GatewayResult -> ExecutionResult",
      authority_status: "not_live"
    },
    live_exchange_authority: false,
    order_submission_authority: false
  };
}

export async function startPaperTradingApiProvider(
  binding: GatewayRuntimeBinding
): Promise<ReplayTradingApiProviderSession> {
  assertPaperBindingEnabled(binding);
  const market = await binding.marketData.readMarketSnapshot();
  return startReplayTradingApiProvider({
    id: "binance-production-public-paper",
    description: "Paper TradingApiProvider backed by Binance production public BTCUSDT market data.",
    market,
    account: binding.account.state,
    outcome: {
      exit_price: market.price,
      fee_bps: 4,
      slippage_bps: 3,
      funding_bps: 1
    }
  });
}

export async function executeGatewayOrderRequest(
  binding: GatewayRuntimeBinding,
  orderRequest: PaperGatewayOrderRequest
): Promise<GatewayOrderExecution> {
  assertPaperBindingEnabled(binding);
  const side = orderRequest.side === "buy" || orderRequest.side === "sell"
    ? orderRequest.side
    : undefined;
  const orderType = orderRequest.order_type === "market" || orderRequest.order_type === "limit"
    ? orderRequest.order_type
    : undefined;
  const gatewayResult = validatePaperGatewayOrderRequest(orderRequest);
  return {
    intent: {
      intent_kind: "place_order",
      side,
      order_type: orderType,
      quantity: orderRequest.quantity,
      limit_price: orderRequest.limit_price
    },
    gateway_result: gatewayResult,
    execution_result: recordPaperExecutionResult(gatewayResult)
  };
}

function createBinanceProductionPublicMarketDataProvider(input: {
  client?: BinancePublicMarketDataClient;
} = {}): BinanceProductionPublicMarketDataProvider {
  const client = input.client ?? createFetchBinancePublicMarketDataClient(BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL);
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_rest",
    rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
    required_endpoints: PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS,
    authority_status: "read_only",
    readMarketSnapshot: () => readBinanceBtcUsdtMarketSnapshot({ client })
  };
}

interface BinanceExchangeInformationPayload {
  serverTime?: number | bigint;
  symbols?: Array<{
    symbol?: string;
    contractType?: string;
    status?: string;
  }>;
}

interface BinanceMarkPricePayload {
  symbol?: string;
  markPrice?: string;
  time?: number | bigint;
}

interface BinanceServerTimePayload {
  serverTime?: number | bigint;
}

type BinanceKlineCandlestickPayload = Array<Array<number | string>>;

function createFetchBinancePublicMarketDataClient(baseUrl: string): BinancePublicMarketDataClient {
  const readJson = async <T>(pathname: string): Promise<BinanceRestResponse<T>> => {
    const response = await fetch(`${baseUrl}${pathname}`);
    if (!response.ok) {
      throw new Error(`binance_public_market_http_${response.status}`);
    }
    const body = await response.json() as T;
    return { data: async () => body };
  };
  return {
    checkServerTime: () => readJson<BinanceServerTimePayload>("/fapi/v1/time"),
    exchangeInformation: () => readJson<BinanceExchangeInformationPayload>("/fapi/v1/exchangeInfo"),
    markPrice: (input) => readJson<BinanceMarkPricePayload | BinanceMarkPricePayload[]>(
      `/fapi/v1/premiumIndex${input?.symbol ? `?symbol=${encodeURIComponent(input.symbol)}` : ""}`
    ),
    klineCandlestickData: (input) => readJson<BinanceKlineCandlestickPayload>(
      `/fapi/v1/klines?symbol=${input.symbol}&interval=${input.interval}&limit=${input.limit}`
    )
  };
}

async function readBinanceBtcUsdtMarketSnapshot(input: {
  client: BinancePublicMarketDataClient;
  observedAt?: string;
}): Promise<MarketSnapshot> {
  const serverTime = await input.client.checkServerTime().then((response) => response.data());
  const exchangeInfo = await input.client.exchangeInformation().then((response) => response.data());
  const markPricePayload = await input.client.markPrice({ symbol: "BTCUSDT" }).then((response) => response.data());
  const klinePayload = await input.client.klineCandlestickData({
    symbol: "BTCUSDT",
    interval: "1m",
    limit: 30
  }).then((response) => response.data());

  const symbol = exchangeInfo.symbols?.find((candidate) => candidate.symbol === "BTCUSDT");
  if (!symbol) {
    throw new Error("binance_public_market_missing_btcusdt");
  }
  const markPrice = normalizeMarkPricePayload(markPricePayload);
  const closes = klinePayload
    .map((item) => Number(item[4]))
    .filter((value) => Number.isFinite(value));
  if (closes.length < 2) {
    throw new Error("binance_public_market_insufficient_klines");
  }
  const fastAverage = average(closes.slice(-Math.min(5, closes.length)));
  const slowAverage = average(closes);
  const observedEpochMs = input.observedAt
    ? Date.parse(input.observedAt)
    : Number(serverTime.serverTime ?? markPrice.time ?? exchangeInfo.serverTime ?? Date.now());
  return {
    symbol: "BTCUSDT",
    price: Number(markPrice.markPrice),
    moving_average_fast: roundMarketNumber(fastAverage),
    moving_average_slow: roundMarketNumber(slowAverage),
    volatility: roundMarketNumber(closeVolatility(closes)),
    expected_direction: fastAverage > slowAverage ? "long" : fastAverage < slowAverage ? "short" : "flat",
    observed_at: new Date(observedEpochMs).toISOString()
  };
}

function normalizeMarkPricePayload(payload: BinanceMarkPricePayload | BinanceMarkPricePayload[]): BinanceMarkPricePayload {
  const markPrice = Array.isArray(payload)
    ? payload.find((candidate) => candidate.symbol === "BTCUSDT")
    : payload;
  if (!markPrice || markPrice.symbol !== "BTCUSDT") {
    throw new Error("binance_public_market_missing_mark_price");
  }
  return markPrice;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function closeVolatility(values: number[]): number {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2))) / mean;
}

function roundMarketNumber(value: number): number {
  return Math.round(value * 100_000_000) / 100_000_000;
}

function assertPaperBindingEnabled(
  binding: GatewayRuntimeBinding
): asserts binding is GatewayRuntimeBinding & {
  environment: "paper";
  status: "enabled";
  account: PaperAccountProvider;
  executor: PaperOrderExecutor;
  ledger: LedgerRecorder & { recorder_kind: "fake_ledger" };
} {
  if (binding.environment === "live" || binding.status === "disabled") {
    throw new Error(binding.disabled_reason ?? LIVE_GATEWAY_DISABLED_REASON);
  }
}

function defaultPaperAccount(): AccountState {
  return {
    equity: 10_000,
    max_position_notional: 350,
    max_risk_fraction: 0.03,
    target_risk_fraction: 0.02
  };
}
