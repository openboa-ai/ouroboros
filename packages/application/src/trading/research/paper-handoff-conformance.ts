import type {
  PaperTradingHandoffConformanceReason,
  PaperTradingHandoffConformanceStatus
} from "@ouroboros/domain";
import { parseTradingSystemPaperEventLine } from "../paper/events";
import { tradingResearchEvaluatorBoundaryViolation } from "./evaluator";
import type {
  TradingArtifactPaperHandoffProbeResult,
  TradingProviderRequestLog,
  TradingSystemEvent
} from "./types";

export const PAPER_TRADING_HANDOFF_CONFORMANCE_MAX_PROVIDER_REQUESTS = 8;

export type PaperTradingHandoffConformanceInfrastructureErrorCode =
  | "runner_unavailable"
  | "sandbox_create_failed"
  | "provider_start_failed"
  | "probe_cleanup_failed";

export class PaperTradingHandoffConformanceInfrastructureError extends Error {
  readonly candidate_rejection = false;

  constructor(
    readonly code: PaperTradingHandoffConformanceInfrastructureErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PaperTradingHandoffConformanceInfrastructureError";
  }
}

export interface PaperTradingHandoffConformanceEvaluation {
  status: PaperTradingHandoffConformanceStatus;
  reason: PaperTradingHandoffConformanceReason;
  provider_request_count: number;
  decision_event_kind?: "order_request" | "hold" | "no_action";
  heartbeat_count: number;
  runtime_stopped: boolean;
  runnable_paper_handoff: boolean;
}

export function evaluatePaperTradingHandoffProbe(
  probe: TradingArtifactPaperHandoffProbeResult
): PaperTradingHandoffConformanceEvaluation {
  const jsonEvents = probe.output_lines.flatMap(parseJsonEvent);
  const observed = observedProtocolSummary(jsonEvents, probe.instance_id);
  const base = {
    provider_request_count: probe.provider_requests.length,
    ...(observed.decisionKind === undefined
      ? {}
      : { decision_event_kind: observed.decisionKind }),
    heartbeat_count: observed.heartbeatCount,
    runtime_stopped: observed.runtimeStopped
  };

  if (probe.timed_out) {
    return rejected("execution_timed_out", base);
  }
  if (probe.status !== "completed" || (probe.exit_code !== undefined && probe.exit_code !== 0)) {
    return rejected("runner_crash", base);
  }
  if (probe.provider_requests.length > PAPER_TRADING_HANDOFF_CONFORMANCE_MAX_PROVIDER_REQUESTS) {
    return rejected("provider_request_limit_exceeded", base);
  }
  if (probe.provider_requests.some((request) => !isDeclaredProviderRequest(request))) {
    return rejected("provider_protocol_violation", base);
  }

  const boundaryViolation = tradingResearchEvaluatorBoundaryViolation({
    events: jsonEvents,
    provider_requests: probe.provider_requests
  });
  if (boundaryViolation === "lookahead_leakage") {
    return rejected("hidden_evaluator_field", base);
  }
  if (boundaryViolation === "runtime_self_report_only") {
    return rejected("candidate_self_report", base);
  }
  if (jsonEvents.some(hasPrivateOrLiveAuthority) ||
    probe.provider_requests.some((request) => hasPrivateOrLiveAuthority(request.body))) {
    return rejected("private_or_live_authority", base);
  }
  if (!requiredProviderRequestsComplete(probe.provider_requests)) {
    return rejected("provider_protocol_incomplete", base);
  }
  if (observed.paperEventRejected) {
    return rejected("paper_event_invalid", base);
  }
  if (observed.instanceMismatch) {
    return rejected("instance_identity_mismatch", base);
  }
  if (observed.decisionCount === 0) {
    return rejected("paper_decision_missing", base);
  }
  if (observed.decisionCount !== 1) {
    return rejected("paper_decision_ambiguous", base);
  }
  if (!providerValidationMatchesDecision(
    probe.provider_requests,
    observed.decisionKind,
    observed.orderRequest
  )) {
    return rejected("provider_protocol_violation", base);
  }
  if (observed.heartbeatCount === 0) {
    return rejected("runtime_heartbeat_missing", base);
  }
  if (!observed.runtimeStopped) {
    return rejected("runtime_stop_missing", base);
  }

  return {
    status: "passed",
    reason: "passed",
    ...base,
    decision_event_kind: observed.decisionKind!,
    runnable_paper_handoff: true
  };
}

function rejected(
  reason: Exclude<PaperTradingHandoffConformanceReason, "passed">,
  evidence: Omit<PaperTradingHandoffConformanceEvaluation, "status" | "reason" | "runnable_paper_handoff">
): PaperTradingHandoffConformanceEvaluation {
  return {
    status: "rejected",
    reason,
    ...evidence,
    runnable_paper_handoff: false
  };
}

function observedProtocolSummary(events: TradingSystemEvent[], instanceId: string): {
  decisionCount: number;
  decisionKind?: "order_request" | "hold" | "no_action";
  orderRequest?: {
    symbol: "BTCUSDT";
    side: "buy" | "sell";
    order_type: "market" | "limit";
    quantity: string;
    limit_price?: string;
  };
  heartbeatCount: number;
  runtimeStopped: boolean;
  paperEventRejected: boolean;
  instanceMismatch: boolean;
} {
  let decisionCount = 0;
  let decisionKind: "order_request" | "hold" | "no_action" | undefined;
  let orderRequest: {
    symbol: "BTCUSDT";
    side: "buy" | "sell";
    order_type: "market" | "limit";
    quantity: string;
    limit_price?: string;
  } | undefined;
  let heartbeatCount = 0;
  let runtimeStopped = false;
  let paperEventRejected = false;
  let instanceMismatch = false;

  for (const [index, event] of events.entries()) {
    const eventKind = event.event;
    if (eventKind === "order_request" || eventKind === "hold" || eventKind === "no_action" ||
      eventKind === "cancel_order") {
      if (event.instance_id !== instanceId) {
        instanceMismatch = true;
      }
      const parsed = parseTradingSystemPaperEventLine(JSON.stringify(event), {
        sandboxId: instanceId,
        lineIndex: index,
        fallbackObservedAt: "1970-01-01T00:00:00.000Z"
      });
      if (parsed.status !== "accepted" ||
        parsed.event.event_kind === "cancel_order" ||
        parsed.event.event_kind === "error") {
        paperEventRejected = true;
        continue;
      }
      decisionCount += 1;
      decisionKind = parsed.event.event_kind;
      if (parsed.event.event_kind === "order_request") {
        orderRequest = parsed.event.order_request;
      }
      continue;
    }
    if (eventKind === "runtime_heartbeat") {
      heartbeatCount += 1;
      if (event.instance_id !== instanceId) instanceMismatch = true;
      continue;
    }
    if (eventKind === "runtime_stopped") {
      runtimeStopped = true;
      if (event.instance_id !== instanceId) instanceMismatch = true;
    }
  }
  return {
    decisionCount,
    decisionKind,
    orderRequest,
    heartbeatCount,
    runtimeStopped,
    paperEventRejected,
    instanceMismatch
  };
}

function providerValidationMatchesDecision(
  requests: TradingProviderRequestLog[],
  decisionKind: "order_request" | "hold" | "no_action" | undefined,
  orderRequest: {
    symbol: "BTCUSDT";
    side: "buy" | "sell";
    order_type: "market" | "limit";
    quantity: string;
    limit_price?: string;
  } | undefined
): boolean {
  const request = [...requests].reverse().find((item) =>
    item.method === "POST" && item.path === "/orders/validate" && item.response_status === 200
  );
  if (!request || !isRecord(request.body)) {
    return false;
  }
  if (decisionKind === "hold" || decisionKind === "no_action") {
    return request.body.symbol === "BTCUSDT" &&
      request.body.side === "hold" &&
      request.body.order_type === "none" &&
      Object.is(request.body.quantity, 0);
  }
  if (decisionKind !== "order_request" || !orderRequest) {
    return false;
  }
  const quantity = typeof request.body.quantity === "number"
    ? String(request.body.quantity)
    : request.body.quantity;
  return request.body.symbol === orderRequest.symbol &&
    request.body.side === orderRequest.side &&
    request.body.order_type === orderRequest.order_type &&
    quantity === normalizedDecimal(orderRequest.quantity) &&
    (orderRequest.order_type !== "limit" ||
      normalizedDecimal(request.body.limit_price) === normalizedDecimal(orderRequest.limit_price));
}

function requiredProviderRequestsComplete(requests: TradingProviderRequestLog[]): boolean {
  return [
    ["GET", "/market/snapshot"],
    ["GET", "/account/state"],
    ["POST", "/orders/validate"]
  ].every(([method, path]) => requests.some((request) =>
    request.method === method && request.path === path && request.response_status === 200
  ));
}

function isDeclaredProviderRequest(request: TradingProviderRequestLog): boolean {
  return (request.method === "GET" && request.path === "/market/snapshot") ||
    (request.method === "GET" && request.path === "/account/state") ||
    (request.method === "POST" && request.path === "/orders/validate");
}

function parseJsonEvent(line: string): TradingSystemEvent[] {
  try {
    const value = JSON.parse(line);
    return isRecord(value) ? [value as TradingSystemEvent] : [];
  } catch {
    return [];
  }
}

const PRIVATE_OR_LIVE_KEYS = new Set([
  "apikey",
  "credentials",
  "listenkey",
  "liveexchangeauthority",
  "ordersubmissionauthority",
  "privateaccountread",
  "signedrequest",
  "signature",
  "userdata",
  "userdatastream"
]);

function hasPrivateOrLiveAuthority(value: unknown): boolean {
  if (!isRecord(value)) {
    return Array.isArray(value) && value.some(hasPrivateOrLiveAuthority);
  }
  if (value.runtime_environment === "live") {
    return true;
  }
  return Object.entries(value).some(([key, nested]) => {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    return (PRIVATE_OR_LIVE_KEYS.has(normalizedKey) && Boolean(nested)) ||
      hasPrivateOrLiveAuthority(nested);
  });
}

function normalizedDecimal(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
