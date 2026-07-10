import http from "node:http";
import type {
  MarketSnapshot,
  OrderRequest,
  OrderValidationResult,
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  ReplayTradingScenario,
  TradingApiAccountState,
  TradingApiMarketSnapshot,
  TradingProviderRequestLog
} from "./types";

const MAX_REPLAY_PROVIDER_BODY_BYTES = 64 * 1024;

export const defaultReplayTradingScenario: ReplayTradingScenario = {
  id: "trend_long",
  description: "Trend-following replay regime where fast average is above slow average.",
  market: {
    symbol: "BTCUSDT",
    price: 60000,
    moving_average_fast: 60300,
    moving_average_slow: 60000,
    volatility: 0.018,
    expected_direction: "long",
    observed_at: "2026-05-12T00:00:00.000Z"
  },
  account: {
    equity: 10_000,
    max_position_notional: 350,
    max_risk_fraction: 0.03,
    target_risk_fraction: 0.02
  },
  outcome: {
    exit_price: 60_900,
    fee_bps: 4,
    slippage_bps: 3,
    funding_bps: 1
  }
};

export const defaultReplayTradingScenarioSet: ReplayTradingScenario[] = [
  defaultReplayTradingScenario,
  {
    id: "range_flat",
    description: "Range-bound replay regime where no directional position should be opened.",
    market: {
      symbol: "BTCUSDT",
      price: 60100,
      moving_average_fast: 60000,
      moving_average_slow: 60000,
      volatility: 0.009,
      expected_direction: "flat",
      observed_at: "2026-05-12T00:05:00.000Z"
    },
    account: {
      equity: 10_000,
      max_position_notional: 350,
      max_risk_fraction: 0.03,
      target_risk_fraction: 0
    },
    outcome: {
      exit_price: 60_100,
      fee_bps: 4,
      slippage_bps: 3,
      funding_bps: 1
    }
  }
];

export interface ReplayTradingApiProviderOptions {
  listen_host?: string;
  base_host?: string;
  sandbox_host?: string;
}

export async function startReplayTradingApiProvider(
  input: ReplayTradingCandidateInput = toReplayTradingCandidateInput(defaultReplayTradingScenario),
  options: ReplayTradingApiProviderOptions = {}
): Promise<ReplayTradingApiProviderSession> {
  const candidateInput = toReplayTradingCandidateInput(input);
  const requestLog: TradingProviderRequestLog[] = [];
  const server = http.createServer(async (request, response) => {
    const path = request.url ?? "/";
    const method = request.method ?? "GET";
    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        sendJson(response, 413, { error: "request_body_too_large" });
        requestLog.push(logRequest(method, path, undefined, 413));
        return;
      }
      throw error;
    }

    if (method === "GET" && path === "/market/snapshot") {
      sendJson(response, 200, candidateInput.market);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    if (method === "GET" && path === "/account/state") {
      sendJson(response, 200, candidateInput.account);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    if (method === "POST" && path === "/orders/validate") {
      const validation = validateOrderRequest(body, candidateInput.market, candidateInput.account);
      sendJson(response, 200, validation);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    sendJson(response, 404, { error: "not_found" });
    requestLog.push(logRequest(method, path, body, 404));
  });

  await listen(server, options.listen_host ?? "127.0.0.1");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Replay trading API provider did not bind to a TCP port");
  }

  const baseHost = options.base_host ?? "127.0.0.1";
  return {
    base_url: providerBaseUrl(baseHost, address.port),
    sandbox_base_url: options.sandbox_host
      ? providerBaseUrl(options.sandbox_host, address.port)
      : undefined,
    close: () => close(server),
    requests: () => [...requestLog],
    candidate_input: candidateInput
  };
}

export function toReplayTradingCandidateInput(
  input: Pick<ReplayTradingScenario, "market" | "account"> | ReplayTradingCandidateInput
): ReplayTradingCandidateInput {
  return {
    market: toTradingApiMarketSnapshot(input.market),
    account: toTradingApiAccountState(input.account)
  };
}

export function toTradingApiAccountState(account: TradingApiAccountState): TradingApiAccountState {
  return {
    equity: account.equity,
    max_position_notional: account.max_position_notional,
    max_risk_fraction: account.max_risk_fraction
  };
}

export function toTradingApiMarketSnapshot(market: TradingApiMarketSnapshot): TradingApiMarketSnapshot {
  return {
    symbol: market.symbol,
    price: market.price,
    moving_average_fast: market.moving_average_fast,
    moving_average_slow: market.moving_average_slow,
    volatility: market.volatility,
    observed_at: market.observed_at,
    ...(market.source_kind === undefined ? {} : { source_kind: market.source_kind }),
    ...(market.source_priority === undefined ? {} : { source_priority: market.source_priority }),
    ...(market.freshness === undefined ? {} : { freshness: market.freshness }),
    ...(market.ws_connected === undefined ? {} : { ws_connected: market.ws_connected }),
    ...(market.rest_fallback_used === undefined ? {} : { rest_fallback_used: market.rest_fallback_used }),
    ...(market.gap_detected === undefined ? {} : { gap_detected: market.gap_detected }),
    ...(market.last_update_id === undefined ? {} : { last_update_id: market.last_update_id }),
    ...(market.stream_marker === undefined ? {} : { stream_marker: market.stream_marker })
  };
}

export function validateOrderRequest(
  body: unknown,
  market: TradingApiMarketSnapshot,
  account: TradingApiAccountState
): OrderValidationResult {
  const intent = isOrderRequest(body) ? body : undefined;
  if (!intent || intent.symbol !== market.symbol) {
    return {
      accepted: false,
      reason: "malformed_order_request",
      notional: 0,
      risk_fraction: 0
    };
  }
  const isHoldIntent = intent.side === "hold" &&
    intent.order_type === "none" &&
    Object.is(intent.quantity, 0);
  const isDirectionalIntent = (intent.side === "buy" || intent.side === "sell") &&
    (intent.order_type === "market" || intent.order_type === "limit") &&
    Number.isFinite(intent.quantity) &&
    intent.quantity > 0;
  if (!isHoldIntent && !isDirectionalIntent) {
    return {
      accepted: false,
      reason: "malformed_order_request",
      notional: 0,
      risk_fraction: 0
    };
  }
  if (isHoldIntent) {
    return {
      accepted: true,
      reason: "hold_intent",
      notional: 0,
      risk_fraction: 0
    };
  }

  const notional = Math.abs(intent.quantity) * market.price;
  const riskFraction = account.equity > 0 ? notional / account.equity : 0;
  const accepted = Number.isFinite(notional) &&
    notional > 0 &&
    notional <= account.max_position_notional &&
    riskFraction <= account.max_risk_fraction;

  return {
    accepted,
    reason: accepted ? "risk_limits_passed" : "risk_limits_rejected",
    notional: round(notional),
    risk_fraction: round(riskFraction)
  };
}

function isOrderRequest(value: unknown): value is OrderRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const allowedFields = new Set(["symbol", "side", "quantity", "order_type", "reason"]);
  if (Object.keys(value).some((key) => !allowedFields.has(key))) {
    return false;
  }
  const candidate = value as Partial<OrderRequest>;
  return (
    typeof candidate.symbol === "string" &&
    ["buy", "sell", "hold"].includes(String(candidate.side)) &&
    typeof candidate.quantity === "number" &&
    ["market", "limit", "none"].includes(String(candidate.order_type))
  );
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_REPLAY_PROVIDER_BODY_BYTES) {
      throw new RequestBodyTooLargeError();
    }
    chunks.push(buffer);
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

class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
    this.name = "RequestBodyTooLargeError";
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

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function providerBaseUrl(host: string, port: number): string {
  return `http://${formatHostForUrl(host)}:${port}`;
}

function formatHostForUrl(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
