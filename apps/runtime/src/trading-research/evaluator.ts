import type {
  ArtifactRunResult,
  OrderRequest,
  OrderValidationResult,
  TradingEvaluationMetric,
  TradingEvaluationResult
} from "./types";

export function evaluateTradingRun(run: ArtifactRunResult): TradingEvaluationResult {
  if (run.status === "crashed") {
    return {
      status: "disqualified",
      score: 0,
      metrics: [
        {
          name: "runtime",
          score: 0,
          detail: run.error ?? "artifact crashed"
        }
      ],
      summary: "Artifact crashed before producing a valid trading run.",
      risk_decision: "no_order_request"
    };
  }

  const orderIntent = latestPayload<OrderRequest>(run.events, "order_request");
  const validation = latestPayload<OrderValidationResult>(run.events, "order_validation");
  const market = latestPayload<{ expected_direction?: string }>(run.events, "market_snapshot");
  const account = latestPayload<{ target_risk_fraction?: number }>(run.events, "account_state");
  const providerPaths = new Set(run.provider_requests.map((request) => request.path));
  const usedProviderBoundary = providerPaths.has("/market/snapshot") &&
    providerPaths.has("/account/state") &&
    providerPaths.has("/orders/validate");

  if (!orderIntent) {
    return {
      status: "disqualified",
      score: 0,
      metrics: [
        metric("provider_boundary", usedProviderBoundary ? 0.2 : 0, "provider boundary usage"),
        metric("order_request", 0, "missing order request event")
      ],
      summary: "Artifact did not emit an order request.",
      risk_decision: "no_order_request"
    };
  }

  const directionMetric = signalDirectionMetric(market?.expected_direction, orderIntent.side);
  const providerBoundaryScore = usedProviderBoundary ? 0.2 : 0;
  const validationScore = validation?.accepted ? 0.15 : 0;
  const riskScore = validation ? riskFitScore(
    validation.risk_fraction,
    account?.target_risk_fraction,
    market?.expected_direction
  ) : 0;
  const explanationScore = orderIntent.reason && orderIntent.reason.length >= 12 ? 0.1 : 0;
  const complexityPenalty = Math.min(0.1, Math.max(0, run.events.length - 8) * 0.01);
  const score = clampScore(
    providerBoundaryScore +
    directionMetric.score +
    validationScore +
    riskScore +
    explanationScore -
    complexityPenalty
  );
  const accepted = Boolean(validation?.accepted) && usedProviderBoundary && score > 0;

  const metrics: TradingEvaluationMetric[] = [
    metric("provider_boundary", providerBoundaryScore, "market/account/order validation went through the external provider"),
    metric("signal_direction", directionMetric.score, directionMetric.detail),
    metric("risk_fit", riskScore, "risk fraction closeness to the hidden replay target"),
    metric("pre_trade_validation", validationScore, validation?.reason ?? "missing validation"),
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
      ? `Accepted order request with score ${score.toFixed(3)}.`
      : `Rejected order request with score ${score.toFixed(3)}.`,
    risk_decision: validation?.accepted ? "valid_order_request" : "invalid_order_request"
  };
}

function latestPayload<T>(events: Array<Record<string, unknown>>, eventName: string): T | undefined {
  for (const event of [...events].reverse()) {
    if (event.event === eventName) {
      return event as T;
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

function metric(name: string, score: number, detail: string): TradingEvaluationMetric {
  return { name, score: clampScore(score), detail };
}

function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 1_000) / 1_000;
}
