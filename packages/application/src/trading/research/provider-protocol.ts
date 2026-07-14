import type { TradingProviderRequestLog } from "./types";

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
  return isOrderValidationBody(request.body);
}

function isOrderValidationBody(value: unknown): boolean {
  if (!isRecord(value) ||
    Object.keys(value).some((key) => !ORDER_VALIDATION_FIELDS.has(key))) {
    return false;
  }
  if (typeof value.symbol !== "string" ||
    (value.side !== "buy" && value.side !== "sell" && value.side !== "hold") ||
    (value.order_type !== "market" && value.order_type !== "limit" &&
      value.order_type !== "none") ||
    typeof value.quantity !== "number" || !Number.isFinite(value.quantity) ||
    (value.reason !== undefined && typeof value.reason !== "string")) {
    return false;
  }
  if (value.order_type === "limit") {
    return isPositiveDecimal(value.limit_price);
  }
  return value.limit_price === undefined;
}

function isPositiveDecimal(value: unknown): boolean {
  if (typeof value !== "number" && typeof value !== "string") {
    return false;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
