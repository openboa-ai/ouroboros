import { createHash } from "node:crypto";
import type {
  GatewayResultOutcome,
  PaperTradingDecisionOrderRequestSummary,
  Ref
} from "@ouroboros/domain";

export type TradingSystemPaperEventKind =
  | "order_request"
  | "cancel_order"
  | "hold"
  | "no_action";

export interface TradingSystemPaperOrderRequestEvent {
  event_id: string;
  event_kind: "order_request";
  observed_at: string;
  order_request: PaperTradingDecisionOrderRequestSummary;
}

export interface PaperTradingErrorEvent {
  event_id: string;
  event_kind: "error";
  observed_at: string;
  reason: string;
}

export type PaperTradingSystemEvent =
  | (TradingSystemPaperOrderRequestEvent & {
      ledger_ref?: Ref;
      gateway_outcome: GatewayResultOutcome;
    })
  | {
      event_id: string;
      event_kind: "cancel_order";
      observed_at: string;
      order_id?: string;
      reason: string;
    }
  | {
      event_id: string;
      event_kind: "hold" | "no_action" | "error";
      observed_at: string;
      reason: string;
    };

export type ParsedTradingSystemPaperEvent =
  | TradingSystemPaperOrderRequestEvent
  | {
      event_id: string;
      event_kind: "cancel_order";
      observed_at: string;
      order_id?: string;
      reason: string;
    }
  | {
      event_id: string;
      event_kind: "hold" | "no_action";
      observed_at: string;
      reason: string;
    }
  | PaperTradingErrorEvent;

export interface TradingSystemPaperEventParseInput {
  sandboxId: string;
  lineIndex: number;
  fallbackObservedAt?: string;
}

export type TradingSystemPaperEventParseResult =
  | {
      status: "accepted";
      event: ParsedTradingSystemPaperEvent;
    }
  | {
      status: "rejected";
      event: PaperTradingErrorEvent;
      reason: string;
    }
  | {
      status: "ignored";
      reason: string;
    };

export const TRADING_SYSTEM_PAPER_EVENT_REQUIRED_FIELDS = {
  common: ["event", "event_id", "instance_id", "at", "authority_status"],
  order_request: ["intent_kind", "symbol", "side", "order_type", "quantity"],
  limit_order_request: ["limit_price"],
  cancel_order: ["reason"],
  hold: ["reason"],
  no_action: ["reason"]
} as const;

export const TRADING_SYSTEM_PAPER_EVENT_EXAMPLES = {
  order_request: {
    event: "order_request",
    event_id: "paper-smoke-order-0001",
    instance_id: "paper-smoke-system",
    at: "2026-05-16T00:00:03.000Z",
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    reason: "sample bounded BTCUSDT paper order"
  },
  cancel_order: {
    event: "cancel_order",
    event_id: "paper-smoke-cancel-0001",
    instance_id: "paper-smoke-system",
    at: "2026-05-16T00:01:03.000Z",
    authority_status: "trace_only",
    order_id: "paper-order-paper-smoke-order-0001",
    reason: "sample cancel of remaining paper quantity"
  },
  hold: {
    event: "hold",
    event_id: "paper-smoke-hold-0001",
    instance_id: "paper-smoke-system",
    at: "2026-05-16T00:02:03.000Z",
    authority_status: "trace_only",
    reason: "no fresh setup after the initial paper order"
  },
  no_action: {
    event: "no_action",
    event_id: "paper-smoke-no-action-0001",
    instance_id: "paper-smoke-system",
    at: "2026-05-16T00:03:03.000Z",
    authority_status: "trace_only",
    reason: "paper runtime heartbeat without an order"
  }
} as const;

export function parseTradingSystemPaperEventLine(
  line: string,
  input: TradingSystemPaperEventParseInput
): TradingSystemPaperEventParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { status: "ignored", reason: "not_json" };
  }
  if (!isRecord(raw)) {
    return { status: "ignored", reason: "not_object" };
  }
  if (!isKnownPaperEventKind(raw.event)) {
    return { status: "ignored", reason: "not_paper_trading_system_event" };
  }

  const eventId = stableTradingSystemEventId(raw.event_id, line, input.sandboxId, input.lineIndex);
  const observedAt = typeof raw.at === "string" && raw.at.trim() ? raw.at : undefined;
  const commonRejection = validateCommonProtocol(raw, observedAt);
  if (commonRejection) {
    const errorObservedAt = commonRejection === "invalid_at"
      ? input.fallbackObservedAt
      : observedAt ?? input.fallbackObservedAt;
    return rejectedPaperEvent(eventId, errorObservedAt, commonRejection);
  }
  if (hasForbiddenAuthorityField(raw)) {
    return rejectedPaperEvent(eventId, observedAt, "forbidden_private_or_live_authority");
  }
  const acceptedObservedAt = observedAt as string;

  if (raw.event === "order_request") {
    const orderRequest = parseOrderRequestProtocol(raw);
    if ("reason" in orderRequest) {
      return rejectedPaperEvent(eventId, acceptedObservedAt, orderRequest.reason);
    }
    return {
      status: "accepted",
      event: {
        event_id: eventId,
        event_kind: "order_request",
        observed_at: acceptedObservedAt,
        order_request: orderRequest.order_request
      }
    };
  }

  if (raw.event === "cancel_order") {
    if (typeof raw.reason !== "string" || !raw.reason.trim()) {
      return rejectedPaperEvent(eventId, acceptedObservedAt, "missing_cancel_order_reason");
    }
    return {
      status: "accepted",
      event: {
        event_id: eventId,
        event_kind: "cancel_order",
        observed_at: acceptedObservedAt,
        order_id: typeof raw.order_id === "string" && raw.order_id.trim() ? raw.order_id : undefined,
        reason: raw.reason
      }
    };
  }

  if (typeof raw.reason !== "string" || !raw.reason.trim()) {
    return rejectedPaperEvent(eventId, acceptedObservedAt, `missing_${raw.event}_reason`);
  }
  return {
    status: "accepted",
    event: {
      event_id: eventId,
      event_kind: raw.event,
      observed_at: acceptedObservedAt,
      reason: raw.reason
    }
  };
}

function validateCommonProtocol(
  raw: Record<string, unknown>,
  observedAt?: string
): string | undefined {
  if (typeof raw.event_id !== "string" || !raw.event_id.trim()) {
    return "missing_event_id";
  }
  if (typeof raw.instance_id !== "string" || !raw.instance_id.trim()) {
    return "missing_instance_id";
  }
  if (!observedAt) {
    return "missing_at";
  }
  if (!isValidPaperEventTimestamp(observedAt)) {
    return "invalid_at";
  }
  if (raw.authority_status !== "trace_only") {
    return "authority_status_must_be_trace_only";
  }
  return undefined;
}

function parseOrderRequestProtocol(
  raw: Record<string, unknown>
): { order_request: PaperTradingDecisionOrderRequestSummary } | { reason: string } {
  if (raw.intent_kind !== "place_order") {
    return { reason: "order_request_intent_kind_must_be_place_order" };
  }
  if (raw.symbol !== "BTCUSDT") {
    return { reason: "order_request_symbol_must_be_BTCUSDT" };
  }
  if (!isOrderSide(raw.side)) {
    return { reason: "order_request_side_must_be_buy_or_sell" };
  }
  if (!isOrderType(raw.order_type)) {
    return { reason: "order_request_type_must_be_market_or_limit" };
  }
  if (!isDecimalString(raw.quantity)) {
    return { reason: "order_request_quantity_must_be_decimal_string" };
  }
  if (raw.order_type === "limit") {
    if (!isDecimalString(raw.limit_price)) {
      return { reason: "limit_order_request_requires_decimal_limit_price" };
    }
  }
  if (raw.limit_price !== undefined && !isDecimalString(raw.limit_price)) {
    return { reason: "order_request_limit_price_must_be_decimal_string" };
  }
  return {
    order_request: {
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: raw.side,
      order_type: raw.order_type,
      quantity: raw.quantity,
      limit_price: raw.limit_price
    }
  };
}

function rejectedPaperEvent(
  eventId: string,
  observedAt: string | undefined,
  reason: string
): TradingSystemPaperEventParseResult {
  return {
    status: "rejected",
    reason,
    event: {
      event_id: eventId,
      event_kind: "error",
      observed_at: observedAt ?? new Date(0).toISOString(),
      reason
    }
  };
}

function stableTradingSystemEventId(
  explicitEventId: unknown,
  line: string,
  sandboxId: string,
  lineIndex: number
): string {
  if (typeof explicitEventId === "string" && explicitEventId.trim()) {
    return explicitEventId;
  }
  return `trading-system-event-${createHash("sha256")
    .update(`${sandboxId}:${lineIndex}:${line}`)
    .digest("hex")
    .slice(0, 20)}`;
}

function hasForbiddenAuthorityField(raw: Record<string, unknown>): boolean {
  if (raw.runtime_environment === "live") {
    return true;
  }
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (
      normalizedKey === "liveexchangeauthority" ||
      normalizedKey === "ordersubmissionauthority" ||
      normalizedKey === "privateaccountread" ||
      normalizedKey === "signedrequest" ||
      normalizedKey === "userdata" ||
      normalizedKey === "userdatastream" ||
      normalizedKey === "listenkey" ||
      normalizedKey === "leverage" ||
      normalizedKey === "margin" ||
      normalizedKey === "apikey" ||
      normalizedKey === "signature"
    ) {
      return Boolean(value);
    }
  }
  return false;
}

function isKnownPaperEventKind(value: unknown): value is TradingSystemPaperEventKind {
  return value === "order_request" || value === "cancel_order" || value === "hold" || value === "no_action";
}

function isOrderSide(value: unknown): value is "buy" | "sell" {
  return value === "buy" || value === "sell";
}

function isOrderType(value: unknown): value is "market" | "limit" {
  return value === "market" || value === "limit";
}

function isValidPaperEventTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
