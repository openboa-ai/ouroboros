import http from "node:http";
import type {
  GatewayResultAuthorityStatus,
  LedgerInput,
  TradingRuntimeEnvironment
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import { recordPaperExecutionResult } from "./paper-execution";
import { validateOrderRequest } from "../research/replay-trading-api-provider";
import type {
  AccountState,
  MarketSnapshot,
  ReplayTradingApiProviderSession,
  TradingProviderRequestLog
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
  "/fapi/v1/klines?symbol=BTCUSDT&interval=1m&limit=30",
  "/fapi/v1/ticker/bookTicker?symbol=BTCUSDT",
  "/fapi/v1/aggTrades?symbol=BTCUSDT&limit=100",
  "/fapi/v1/depth?symbol=BTCUSDT&limit=1000",
  "wss://fstream.binance.com/public/stream?streams=btcusdt@bookTicker/btcusdt@depth@100ms",
  "wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/btcusdt@markPrice@1s/btcusdt@kline_1m"
] as const;

export interface GatewayRuntimeBinding {
  environment: TradingRuntimeEnvironment;
  status: "enabled" | "disabled";
  disabled_reason?: typeof LIVE_GATEWAY_DISABLED_REASON;
  marketData: GatewayMarketDataPort;
  account: PaperAccountProvider | LiveAccountProvider;
  executor: PaperOrderExecutor | LiveOrderExecutor;
  ledger: LedgerRecorder;
  live_exchange_authority: false;
  order_submission_authority: false;
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
  marketData?: GatewayMarketDataPort;
  paperAccount?: AccountState;
}

export interface PaperTradingApiProviderOptions {
  listen_host?: string;
  base_host?: string;
  sandbox_host?: string;
  request_log_limit?: number;
  readAccountState?: () => AccountState | Promise<AccountState>;
}

export type GatewayOrderExecution = Pick<
  LedgerInput,
  "intent" | "gateway_result" | "execution_result"
>;

export function createGatewayRuntimeBinding(
  input: CreateGatewayRuntimeBindingInput = {}
): GatewayRuntimeBinding {
  const environment = input.environment ?? "paper";
  const marketData = input.marketData ?? missingGatewayMarketDataPort();

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
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions = {}
): Promise<ReplayTradingApiProviderSession> {
  assertPaperBindingEnabled(binding);
  const requestLogLimit = options.request_log_limit ?? 200;
  const requestLog: TradingProviderRequestLog[] = [];
  const readAccountState = async () => options.readAccountState
    ? options.readAccountState()
    : binding.account.state;
  const initialMarket = await initialPaperProviderMarketSnapshot(binding);
  const initialAccount = await initialPaperProviderAccountState(binding.account.state, readAccountState);
  const server = http.createServer(async (request, response) => {
    const body = await readJsonBody(request);
    const method = request.method ?? "GET";
    const path = requestPath(request.url);
    try {
      if (method === "GET" && path === "/market/snapshot") {
        const market = await binding.marketData.readMarketSnapshot();
        sendJson(response, 200, market);
        pushBoundedRequestLog(requestLog, logRequest(method, path, body, 200), requestLogLimit);
        return;
      }

      if (method === "GET" && path === "/account/state") {
        const account = await readAccountState();
        sendJson(response, 200, account);
        pushBoundedRequestLog(requestLog, logRequest(method, path, body, 200), requestLogLimit);
        return;
      }

      if (method === "POST" && path === "/orders/validate") {
        const [market, account] = await Promise.all([
          binding.marketData.readMarketSnapshot(),
          readAccountState()
        ]);
        const validation = validateOrderRequest(body, market, account);
        sendJson(response, 200, validation);
        pushBoundedRequestLog(requestLog, logRequest(method, path, body, 200), requestLogLimit);
        return;
      }

      sendJson(response, 404, { error: "not_found" });
      pushBoundedRequestLog(requestLog, logRequest(method, path, body, 404), requestLogLimit);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "paper_runtime_api_unavailable";
      sendJson(response, 503, {
        error: "paper_runtime_api_unavailable",
        reason,
        authority_status: "not_live"
      });
      pushBoundedRequestLog(requestLog, logRequest(method, path, body, 503), requestLogLimit);
    }
  });

  await listen(server, options.listen_host ?? "127.0.0.1");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Paper trading API provider did not bind to a TCP port");
  }
  const baseHost = options.base_host ?? "127.0.0.1";

  return {
    base_url: providerBaseUrl(baseHost, address.port),
    sandbox_base_url: options.sandbox_host
      ? providerBaseUrl(options.sandbox_host, address.port)
      : undefined,
    close: () => close(server),
    requests: () => [...requestLog],
    scenario: {
      id: "binance-production-public-paper",
      description: "Paper TradingApiProvider backed by Binance production public BTCUSDT market data.",
      market: initialMarket,
      account: initialAccount,
      outcome: {
        exit_price: initialMarket.price,
        fee_bps: 4,
        slippage_bps: 3,
        funding_bps: 1
      }
    }
  };
}

async function initialPaperProviderMarketSnapshot(
  binding: GatewayRuntimeBinding
): Promise<MarketSnapshot> {
  try {
    return await binding.marketData.readMarketSnapshot();
  } catch {
    return {
      symbol: "BTCUSDT",
      price: 0,
      moving_average_fast: 0,
      moving_average_slow: 0,
      volatility: 0,
      expected_direction: "flat",
      observed_at: new Date().toISOString(),
      source_kind: "binance_production_public_hybrid",
      freshness: "stale"
    };
  }
}

async function initialPaperProviderAccountState(
  fallbackAccount: AccountState,
  readAccountState: () => Promise<AccountState>
): Promise<AccountState> {
  try {
    return await readAccountState();
  } catch {
    return fallbackAccount;
  }
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

function missingGatewayMarketDataPort(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "unconfigured",
    required_endpoints: PAPER_RUNTIME_REQUIRED_PUBLIC_ENDPOINTS,
    authority_status: "read_only",
    async readMarketSnapshot() {
      throw new Error("gateway_market_data_port_not_configured");
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("gateway_market_data_port_not_configured");
    },
    async readPublicExecutionSnapshot() {
      throw new Error("gateway_public_execution_stream_not_configured");
    }
  };
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

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { malformed_json: raw };
  }
}

function requestPath(rawUrl: string | undefined): string {
  try {
    return new URL(rawUrl ?? "/", "http://localhost").pathname;
  } catch {
    return rawUrl ?? "/";
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json"
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function logRequest(
  method: string,
  path: string,
  body: unknown,
  responseStatus: number
): TradingProviderRequestLog {
  return {
    at: new Date().toISOString(),
    method,
    path,
    body,
    response_status: responseStatus
  };
}

function pushBoundedRequestLog(
  requestLog: TradingProviderRequestLog[],
  entry: TradingProviderRequestLog,
  limit: number
): void {
  if (limit <= 0) {
    return;
  }
  requestLog.push(entry);
  if (requestLog.length > limit) {
    requestLog.splice(0, requestLog.length - limit);
  }
}

function listen(server: http.Server, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function providerBaseUrl(host: string, port: number): string {
  return `http://${formatHostForUrl(host)}:${port}`;
}

function formatHostForUrl(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
