import type {
  PaperTradingDecisionOrderRequestSummary,
  PaperTradingDecisionSummary
} from "@ouroboros/domain";
import type { MarketSnapshot } from "../research/types";

export interface PaperObservationInput {
  sequence: number;
  marketSnapshot: MarketSnapshot;
  paperOrderRequestMode?: "valid" | "rejected";
}

export type TradingSystemDecision =
  | {
      decision_kind: "order_request";
      order_request: PaperTradingDecisionOrderRequestSummary;
      summary: PaperTradingDecisionSummary;
    }
  | {
      decision_kind: "hold";
      summary: PaperTradingDecisionSummary;
    };

export function decidePaperTradingObservation(input: PaperObservationInput): TradingSystemDecision {
  const market = input.marketSnapshot;
  if (market.expected_direction === "flat" || market.moving_average_fast === market.moving_average_slow) {
    return {
      decision_kind: "hold",
      summary: {
        decision_kind: "hold",
        source_kind: "trading_system_decision",
        reason: "flat_market_snapshot",
        observed_at: market.observed_at,
        authority_status: "trace_only"
      }
    };
  }

  const side = market.expected_direction === "short" || market.moving_average_fast < market.moving_average_slow
    ? "sell"
    : "buy";
  const quantity = input.paperOrderRequestMode === "rejected" ? "0" : "0.001";
  const orderRequest: PaperTradingDecisionOrderRequestSummary = {
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side,
    order_type: "limit",
    quantity,
    limit_price: formatDecisionLimitPrice(market.price)
  };

  return {
    decision_kind: "order_request",
    order_request: orderRequest,
    summary: {
      decision_kind: "order_request",
      source_kind: "trading_system_decision",
      reason: side === "sell" ? "short_market_snapshot" : "long_market_snapshot",
      observed_at: market.observed_at,
      order_request: orderRequest,
      authority_status: "trace_only"
    }
  };
}

function formatDecisionLimitPrice(price: number): string {
  if (!Number.isFinite(price)) {
    return "0";
  }
  return Number.isInteger(price)
    ? String(price)
    : price.toFixed(2).replace(/\.?0+$/, "");
}
