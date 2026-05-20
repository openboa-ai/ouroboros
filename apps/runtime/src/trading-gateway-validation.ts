import type { LedgerInput } from "@ouroboros/domain";

export interface PaperGatewayOrderRequest {
  intent_kind: string;
  symbol: string;
  side?: string;
  order_type?: string;
  quantity?: string;
  limit_price?: string;
}

export function validatePaperGatewayOrderRequest(
  orderRequest: PaperGatewayOrderRequest
): LedgerInput["gateway_result"] {
  const rejectedReason = paperGatewayRejectedReason(orderRequest);
  if (rejectedReason) {
    return {
      decision_outcome: "rejected",
      decision_reason: rejectedReason,
      policy_ref: paperGatewayPolicyRef()
    };
  }

  return {
    decision_outcome: "dry_run_only",
    decision_reason: "dry_run_allowed",
    policy_ref: paperGatewayPolicyRef()
  };
}

function paperGatewayRejectedReason(
  orderRequest: PaperGatewayOrderRequest
): LedgerInput["gateway_result"]["decision_reason"] | undefined {
  if (
    orderRequest.intent_kind !== "place_order" ||
    orderRequest.symbol !== "BTCUSDT" ||
    !isPaperGatewaySide(orderRequest.side) ||
    !isPaperGatewayOrderType(orderRequest.order_type)
  ) {
    return "fixture_only";
  }

  if (!isPositiveDecimalString(orderRequest.quantity)) {
    return "risk_limit_exceeded";
  }

  if (orderRequest.order_type === "limit" && !isPositiveDecimalString(orderRequest.limit_price)) {
    return "risk_limit_exceeded";
  }

  if (orderRequest.order_type === "market" && orderRequest.limit_price !== undefined) {
    return "fixture_only";
  }

  return undefined;
}

function isPaperGatewaySide(value: unknown): value is "buy" | "sell" {
  return value === "buy" || value === "sell";
}

function isPaperGatewayOrderType(value: unknown): value is "market" | "limit" {
  return value === "market" || value === "limit";
}

function isPositiveDecimalString(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]+(?:\.[0-9]+)?$/.test(value)) {
    return false;
  }
  return Number(value) > 0;
}

function paperGatewayPolicyRef() {
  return {
    record_kind: "runtime_operating_policy",
    id: "runtime-operating-policy-paper-v1"
  } as const;
}
