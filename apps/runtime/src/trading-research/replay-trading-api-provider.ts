import http from "node:http";
import type {
  AccountState,
  MarketSnapshot,
  OrderIntent,
  OrderValidationResult,
  ReplayTradingApiProviderSession,
  ReplayTradingScenario,
  TradingProviderRequestLog
} from "./types";

export const defaultReplayTradingScenario: ReplayTradingScenario = {
  id: "trend_long",
  description: "Trend-following replay regime where fast average is above slow average.",
  market: {
    symbol: "SYNTH-USD",
    price: 100,
    moving_average_fast: 103,
    moving_average_slow: 100,
    volatility: 0.018,
    expected_direction: "long",
    observed_at: "2026-05-12T00:00:00.000Z"
  },
  account: {
    equity: 10_000,
    max_position_notional: 350,
    max_risk_fraction: 0.03,
    target_risk_fraction: 0.02
  }
};

export const defaultReplayTradingScenarioSet: ReplayTradingScenario[] = [
  defaultReplayTradingScenario,
  {
    id: "range_flat",
    description: "Range-bound replay regime where no directional position should be opened.",
    market: {
      symbol: "SYNTH-USD",
      price: 101,
      moving_average_fast: 100,
      moving_average_slow: 100,
      volatility: 0.009,
      expected_direction: "flat",
      observed_at: "2026-05-12T00:05:00.000Z"
    },
    account: {
      equity: 10_000,
      max_position_notional: 350,
      max_risk_fraction: 0.03,
      target_risk_fraction: 0
    }
  }
];

export async function startReplayTradingApiProvider(
  scenario: ReplayTradingScenario = defaultReplayTradingScenario
): Promise<ReplayTradingApiProviderSession> {
  const requestLog: TradingProviderRequestLog[] = [];
  const server = http.createServer(async (request, response) => {
    const body = await readJsonBody(request);
    const path = request.url ?? "/";
    const method = request.method ?? "GET";

    if (method === "GET" && path === "/market/snapshot") {
      sendJson(response, 200, scenario.market);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    if (method === "GET" && path === "/account/state") {
      sendJson(response, 200, scenario.account);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    if (method === "POST" && path === "/orders/validate") {
      const validation = validateOrderIntent(body, scenario.market, scenario.account);
      sendJson(response, 200, validation);
      requestLog.push(logRequest(method, path, body, 200));
      return;
    }

    sendJson(response, 404, { error: "not_found" });
    requestLog.push(logRequest(method, path, body, 404));
  });

  await listen(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Replay trading API provider did not bind to a TCP port");
  }

  return {
    base_url: `http://127.0.0.1:${address.port}`,
    close: () => close(server),
    requests: () => [...requestLog],
    scenario
  };
}

export function validateOrderIntent(
  body: unknown,
  market: MarketSnapshot,
  account: AccountState
): OrderValidationResult {
  const intent = isOrderIntent(body) ? body : undefined;
  if (!intent) {
    return {
      accepted: false,
      reason: "malformed_order_intent",
      notional: 0,
      risk_fraction: 0
    };
  }
  if (intent.side === "hold" || intent.order_type === "none") {
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

function isOrderIntent(value: unknown): value is OrderIntent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<OrderIntent>;
  return (
    typeof candidate.symbol === "string" &&
    ["buy", "sell", "hold"].includes(String(candidate.side)) &&
    typeof candidate.quantity === "number" &&
    ["market", "limit", "none"].includes(String(candidate.order_type))
  );
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

function listen(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
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
