import type {
  ArtifactRunResult,
  OrderRequest,
  TradingEvaluationResult,
  TradingEvaluationMetric,
  TradingProfitLoss,
  ReplayTradingScenario
} from "./types";
import type { TradingEvaluationDisqualificationReason } from "@ouroboros/domain";
import { validateOrderRequest } from "./replay-trading-api-provider";
import {
  isConformantTradingResearchProviderRequest,
  isDeclaredTradingResearchProviderEndpoint,
  tradingResearchOrderRequestFrom
} from "./provider-protocol";

const ZERO_PROFIT_LOSS: TradingProfitLoss = {
  revenue_usdt: 0,
  cost_usdt: 0,
  net_revenue_usdt: 0,
  net_return_pct: 0
};

export function evaluateTradingRun(
  run: ArtifactRunResult,
  scenario?: ReplayTradingScenario
): TradingEvaluationResult {
  const boundaryViolation = tradingResearchEvaluatorBoundaryViolation(run);
  if (boundaryViolation) {
    return disqualifiedResult(
      boundaryViolation,
      boundaryViolation === "lookahead_leakage"
        ? "Artifact emitted evaluator-only or future outcome fields."
        : "Artifact probed an undeclared provider or evaluator endpoint."
    );
  }

  if (run.status === "crashed") {
    return disqualifiedResult(
      "runtime_crash",
      "Artifact crashed before producing a valid trading run.",
      "no_order_request",
      [metric("runtime", 0, run.error ?? "artifact crashed")]
    );
  }
  if (!scenario) {
    return disqualifiedResult(
      "unreproducible",
      "External evaluator scenario is required for ResearchPreflight."
    );
  }

  const decision = latestReplayDecision(run.events, scenario);
  const validationRequest = [...run.provider_requests]
    .reverse()
    .find((request) => request.method === "POST" && request.path === "/orders/validate");
  const submittedOrder = tradingResearchOrderRequestFrom(validationRequest?.body);
  const usedProviderBoundary = requiredProviderRequestsPresent(
    run,
    decision?.kind === "order_request"
  );

  if (!decision) {
    return disqualifiedResult(
      "no_order_request",
      "Artifact did not emit an order request, hold, or no-action decision.",
      "no_order_request",
      [
        metric("provider_boundary", usedProviderBoundary ? 0.2 : 0, "provider boundary usage"),
        metric("trading_system_decision", 0, "missing externally observable decision event")
      ]
    );
  }
  const orderIntent = decision.order;
  if (decision.kind === "order_request" &&
    (!submittedOrder || !sameOrderRequest(orderIntent, submittedOrder))) {
    return disqualifiedResult(
      "runtime_self_report_only",
      "Candidate order event did not match the externally recorded validation request."
    );
  }
  if (decision.kind === "no_order" && validationRequest &&
    (!submittedOrder || !isHoldOrder(submittedOrder))) {
    return disqualifiedResult(
      "runtime_self_report_only",
      "Candidate no-order decision did not match the externally recorded validation request."
    );
  }

  const validation = decision.kind === "no_order"
    ? { accepted: true, reason: "no_order_request", notional: 0, risk_fraction: 0 }
    : validateOrderRequest(submittedOrder!, scenario.market, scenario.account);
  if (!validation.accepted) {
    return disqualifiedResult(
      "risk_validation_failed",
      `External pre-trade validation rejected the order: ${validation.reason}.`
    );
  }
  if (!usedProviderBoundary) {
    return disqualifiedResult(
      "runtime_self_report_only",
      "Candidate did not complete the declared external provider protocol."
    );
  }

  const profitLoss = profitLossForOrder(orderIntent, validation, scenario);
  const directionMetric = signalDirectionMetric(scenario.market.expected_direction, orderIntent.side);
  const providerBoundaryScore = usedProviderBoundary ? 0.2 : 0;
  const validationScore = decision.kind === "order_request" && validation.accepted ? 0.15 : 0;
  const riskScore = riskFitScore(
    validation.risk_fraction,
    scenario.account.target_risk_fraction,
    scenario.market.expected_direction
  );
  const explanationScore = orderIntent.reason && orderIntent.reason.length >= 12 ? 0.1 : 0;
  const complexityPenalty = Math.min(0.1, Math.max(0, run.events.length - 8) * 0.01);
  const score = clampScore(
    providerBoundaryScore +
    directionMetric.score +
    validationScore +
    riskScore +
    profitScore(profitLoss) +
    explanationScore -
    complexityPenalty
  );
  const accepted = validation.accepted && usedProviderBoundary && score > 0;

  const metrics: TradingEvaluationMetric[] = [
    metric(
      "provider_boundary",
      providerBoundaryScore,
      decision.kind === "no_order"
        ? "market and account reads went through the external provider"
        : "market/account/order validation went through the external provider"
    ),
    metric("signal_direction", directionMetric.score, directionMetric.detail),
    metric("net_revenue", profitScore(profitLoss), `net revenue ${profitLoss.net_revenue_usdt.toFixed(6)} USDT after costs`),
    metric("risk_fit", riskScore, "risk fraction closeness to the hidden replay target"),
    metric(
      decision.kind === "no_order" ? "no_order_continuity" : "pre_trade_validation",
      validationScore,
      validation.reason
    ),
    metric("rationale", explanationScore, "order request includes a useful rationale")
  ];
  if (complexityPenalty > 0) {
    metrics.push(metric("complexity_penalty", -complexityPenalty, "extra event surface adds audit cost"));
  }

  return {
    status: accepted ? "accepted" : "disqualified",
    score,
    metrics,
    summary: accepted
      ? decision.kind === "no_order"
        ? "Accepted explicit no-order decision with externally observed provider reads."
        : `Accepted order request with net revenue ${profitLoss.net_revenue_usdt.toFixed(6)} USDT after costs.`
      : `Rejected order request with score ${score.toFixed(3)}.`,
    risk_decision: decision.kind === "no_order"
      ? "no_order_request"
      : validation.accepted ? "valid_order_request" : "invalid_order_request",
    profit_loss: profitLoss
  };
}

function disqualifiedResult(
  reason: TradingEvaluationDisqualificationReason,
  summary: string,
  riskDecision: TradingEvaluationResult["risk_decision"] = "invalid_order_request",
  metrics: TradingEvaluationMetric[] = [metric("external_evidence", 0, summary)]
): TradingEvaluationResult {
  return {
    status: "disqualified",
    score: 0,
    metrics,
    summary,
    risk_decision: riskDecision,
    profit_loss: ZERO_PROFIT_LOSS,
    disqualification_reason: reason
  };
}

export function tradingResearchEvaluatorBoundaryViolation(
  run: Pick<ArtifactRunResult, "events" | "provider_requests">
): TradingEvaluationDisqualificationReason | undefined {
  const unexpectedRequest = run.provider_requests.some((request) =>
    !isDeclaredTradingResearchProviderEndpoint(request)
  );
  if (unexpectedRequest) {
    return "data_leakage";
  }

  const payloadViolation = tradingResearchEvaluatorPayloadViolation(run);
  if (payloadViolation) {
    return payloadViolation;
  }

  if (run.provider_requests.some((request) =>
    !isConformantTradingResearchProviderRequest(request)
  )) {
    return "runtime_self_report_only";
  }
  return undefined;
}

export function tradingResearchEvaluatorPayloadViolation(
  run: Pick<ArtifactRunResult, "events" | "provider_requests">
): "lookahead_leakage" | "runtime_self_report_only" | undefined {
  for (const request of run.provider_requests) {
    const keys = nestedKeys(request.body);
    if (keys.some((key) => LOOKAHEAD_FIELD_NAMES.has(key))) {
      return "lookahead_leakage";
    }
    if (keys.some((key) => CANDIDATE_SELF_REPORT_FIELD_NAMES.has(key))) {
      return "runtime_self_report_only";
    }
  }

  for (const event of run.events) {
    const keys = nestedKeys(event);
    if (keys.some((key) => LOOKAHEAD_FIELD_NAMES.has(key))) {
      return "lookahead_leakage";
    }
    if (keys.some((key) => CANDIDATE_SELF_REPORT_FIELD_NAMES.has(key))) {
      return "runtime_self_report_only";
    }
  }
  return undefined;
}

const LOOKAHEAD_FIELD_NAMES = new Set([
  "expecteddirection",
  "expectedanswer",
  "evaluatoroutcome",
  "futureevent",
  "futureprice",
  "outcome",
  "exitprice",
  "feebps",
  "fundingbps",
  "rotationseed",
  "scenarioid",
  "scenarioresult",
  "scenarioresults",
  "sealedseed",
  "sealedsuitedigest",
  "slippagebps",
  "targetriskfraction"
]);

const CANDIDATE_SELF_REPORT_FIELD_NAMES = new Set([
  "costusdt",
  "disqualificationreason",
  "evaluationscore",
  "netreturnpct",
  "netrevenueusdt",
  "profitloss",
  "revenueusdt"
]);

function nestedKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(nestedKeys);
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nested]) => [normalizeBoundaryFieldName(key), ...nestedKeys(nested)]
  );
}

function normalizeBoundaryFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function requiredProviderRequestsPresent(
  run: ArtifactRunResult,
  requireOrderValidation: boolean
): boolean {
  const requiredRequests = [
    ["GET", "/market/snapshot"],
    ["GET", "/account/state"]
  ];
  if (requireOrderValidation) {
    requiredRequests.push(["POST", "/orders/validate"]);
  }
  return requiredRequests.every(([method, path]) => run.provider_requests.some((request) =>
    request.method === method && request.path === path &&
    request.response_status === 200 &&
    isConformantTradingResearchProviderRequest(request)
  ));
}

function sameOrderRequest(left: OrderRequest, right: OrderRequest): boolean {
  return left.symbol === right.symbol &&
    left.side === right.side &&
    Object.is(left.quantity, right.quantity) &&
    left.order_type === right.order_type &&
    left.limit_price === right.limit_price &&
    left.reason === right.reason;
}

function isHoldOrder(order: OrderRequest): boolean {
  return order.side === "hold" && order.order_type === "none" && Object.is(order.quantity, 0);
}

function latestReplayDecision(
  events: Array<Record<string, unknown>>,
  scenario: ReplayTradingScenario
): { kind: "order_request" | "no_order"; order: OrderRequest } | undefined {
  for (const event of [...events].reverse()) {
    if (event.event === "order_request") {
      const order = tradingResearchOrderRequestFrom(event, true);
      return order ? { kind: "order_request", order } : undefined;
    }
    if (event.event === "hold" || event.event === "no_action") {
      return {
        kind: "no_order",
        order: {
          symbol: scenario.market.symbol,
          side: "hold",
          quantity: 0,
          order_type: "none",
          ...(typeof event.reason === "string" ? { reason: event.reason } : {})
        }
      };
    }
  }
  return undefined;
}

function signalDirectionMetric(
  expectedDirection: string | undefined,
  side: OrderRequest["side"]
): TradingEvaluationMetric {
  if (expectedDirection === "long") {
    return metric("signal_direction", side === "buy" ? 0.25 : 0, "long replay regime expects a buy intent");
  }
  if (expectedDirection === "short") {
    return metric("signal_direction", side === "sell" ? 0.25 : 0, "short replay regime expects a sell intent");
  }
  if (expectedDirection === "flat") {
    return metric("signal_direction", side === "hold" ? 0.25 : 0, "flat replay regime expects a hold intent");
  }
  return metric("signal_direction", 0, "unknown replay direction");
}

function riskFitScore(
  riskFraction: number,
  targetRiskFraction: number | undefined,
  expectedDirection: string | undefined
): number {
  if (expectedDirection === "flat") {
    return riskFraction === 0 ? 0.3 : 0;
  }
  const targetRisk = targetRiskFraction && targetRiskFraction > 0 ? targetRiskFraction : 0.02;
  if (!Number.isFinite(riskFraction) || riskFraction <= 0) {
    return 0;
  }
  const miss = Math.abs(riskFraction - targetRisk) / targetRisk;
  return clampScore(0.3 * Math.max(0, 1 - miss));
}

function profitLossForOrder(
  order: OrderRequest,
  validation: { accepted: boolean; notional: number },
  scenario: ReplayTradingScenario | undefined
): TradingProfitLoss {
  if (!scenario || !validation.accepted || order.side === "hold" || order.order_type === "none") {
    return ZERO_PROFIT_LOSS;
  }
  const quantity = Math.abs(order.quantity);
  const entryPrice = scenario.market.price;
  const exitPrice = scenario.outcome.exit_price;
  const notional = validation.notional || quantity * entryPrice;
  const revenue = order.side === "buy"
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity;
  const costBps = scenario.outcome.fee_bps + scenario.outcome.slippage_bps + scenario.outcome.funding_bps;
  const cost = notional * costBps / 10_000;
  const netRevenue = revenue - cost;
  const netReturn = scenario.account.equity > 0
    ? netRevenue / scenario.account.equity * 100
    : 0;
  return {
    revenue_usdt: round(revenue),
    cost_usdt: round(cost),
    net_revenue_usdt: round(netRevenue),
    net_return_pct: round(netReturn)
  };
}

function profitScore(profitLoss: TradingProfitLoss): number {
  if (profitLoss.net_revenue_usdt < 0) {
    return 0;
  }
  return 0.2;
}

function metric(name: string, score: number, detail: string): TradingEvaluationMetric {
  return { name, score: clampScore(score), detail };
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 1_000) / 1_000;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
