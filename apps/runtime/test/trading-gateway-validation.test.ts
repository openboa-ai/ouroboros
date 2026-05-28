import { describe, expect, it } from "vitest";
import { validatePaperGatewayOrderRequest } from "@ouroboros/application/trading/gateway/validation";

describe("paper Gateway validation", () => {
  it("allows the fixture BTCUSDT paper order as dry-run only", () => {
    expect(validatePaperGatewayOrderRequest({
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000"
    })).toMatchObject({
      decision_outcome: "dry_run_only",
      decision_reason: "dry_run_allowed"
    });
  });

  it("rejects order requests outside the fixture Gateway scope", () => {
    expect(validatePaperGatewayOrderRequest({
      intent_kind: "place_order",
      symbol: "ETHUSDT",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000"
    })).toMatchObject({
      decision_outcome: "rejected",
      decision_reason: "fixture_only"
    });
  });

  it("rejects non-positive paper quantities without exchange authority", () => {
    expect(validatePaperGatewayOrderRequest({
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "limit",
      quantity: "0",
      limit_price: "60000"
    })).toMatchObject({
      decision_outcome: "rejected",
      decision_reason: "risk_limit_exceeded"
    });
  });
});
