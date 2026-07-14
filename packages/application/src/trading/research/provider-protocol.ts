import type { OrderRequest, TradingProviderRequestLog } from "./types";

const ORDER_VALIDATION_FIELDS = new Set([
  "symbol",
  "side",
  "quantity",
  "order_type",
  "reason",
  "limit_price"
]);

export function isDeclaredTradingResearchProviderEndpoint(
  request: TradingProviderRequestLog
): boolean {
  return (request.method === "GET" && request.path === "/market/snapshot") ||
    (request.method === "GET" && request.path === "/account/state") ||
    (request.method === "POST" && request.path === "/orders/validate");
}

export function isConformantTradingResearchProviderRequest(
  request: TradingProviderRequestLog
): boolean {
  if (!isDeclaredTradingResearchProviderEndpoint(request)) {
    return false;
  }
  if (request.method === "GET") {
    return request.body === undefined || request.body === null;
  }
  return tradingResearchOrderRequestFrom(request.body) !== undefined;
}

export function tradingResearchOrderRequestFrom(
  value: unknown,
  allowAdditionalFields = false
): OrderRequest | undefined {
  if (!isRecord(value) ||
    (!allowAdditionalFields &&
      Object.keys(value).some((key) => !ORDER_VALIDATION_FIELDS.has(key)))) {
    return undefined;
  }
  if (typeof value.symbol !== "string" ||
    (value.side !== "buy" && value.side !== "sell" && value.side !== "hold") ||
    (value.order_type !== "market" && value.order_type !== "limit" &&
      value.order_type !== "none") ||
    typeof value.quantity !== "number" || !Number.isFinite(value.quantity) ||
    (value.reason !== undefined && typeof value.reason !== "string")) {
    return undefined;
  }
  if (value.order_type === "limit") {
    if (!isPositiveDecimalString(value.limit_price)) {
      return undefined;
    }
  } else if (value.limit_price !== undefined) {
    return undefined;
  }
  return {
    symbol: value.symbol,
    side: value.side,
    quantity: value.quantity,
    order_type: value.order_type,
    ...(value.limit_price === undefined ? {} : { limit_price: value.limit_price }),
    ...(value.reason === undefined ? {} : { reason: value.reason })
  };
}

function isPositiveDecimalString(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
