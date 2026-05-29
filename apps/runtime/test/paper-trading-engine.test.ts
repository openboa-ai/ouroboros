import { describe, expect, it } from "vitest";
import type {
  GatewayResultOutcome,
  PaperTradingDecisionOrderRequestSummary,
  PaperTradingPublicExecutionSnapshotSummary
} from "@ouroboros/domain";
import {
  applyPaperTradingCheckpoint,
  initialPaperTradingEngineState,
  type PaperTradingEngineState,
  type PaperTradingSystemEvent
} from "@ouroboros/application/trading/paper/engine";

describe("PaperTradingEngine", () => {
  it("persists a partial limit fill and fills the remaining quantity from later public trades", () => {
    const orderEvent = orderRequestEvent({
      eventId: "event-limit-buy",
      quantity: "0.001",
      limitPrice: "60000"
    });

    const partial = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [{
          trade_id: "agg-partial",
          price: "60000",
          quantity: "0.0004",
          trade_time: "2026-05-16T00:00:03.500Z"
        }]
      }),
      events: [orderEvent]
    });

    expect(partial.account.position).toMatchObject({
      side: "long",
      quantity: "0.0004",
      average_entry_price: "60000"
    });
    expect(partial.openOrders).toMatchObject([{
      status: "partially_filled",
      cumulative_filled_quantity: "0.0004",
      remaining_quantity: "0.0006"
    }]);

    const completed = applyPaperTradingCheckpoint({
      previous: partial,
      marketPrice: 60_100,
      observedAt: "2026-05-16T00:01:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [{
          trade_id: "agg-complete",
          price: "60000",
          quantity: "0.001",
          trade_time: "2026-05-16T00:01:03.500Z"
        }]
      }),
      events: []
    });

    expect(completed.openOrders).toEqual([]);
    expect(completed.account.position).toMatchObject({
      side: "long",
      quantity: "0.001",
      average_entry_price: "60000",
      mark_price: "60100"
    });
    expect(completed.latestFill).toMatchObject({
      fill_status: "filled",
      fill_quantity: "0.0006",
      fill_price: "60000"
    });
  });

  it("cancels remaining open quantity without changing the fake account position", () => {
    const opened = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({ trades: [] }),
      events: [orderRequestEvent({
        eventId: "event-open-limit",
        quantity: "0.001",
        limitPrice: "59900"
      })]
    });

    expect(opened.openOrders).toHaveLength(1);
    const canceled = applyPaperTradingCheckpoint({
      previous: opened,
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:01:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({ trades: [] }),
      events: [{
        event_id: "event-cancel",
        event_kind: "cancel_order",
        observed_at: "2026-05-16T00:01:03.000Z",
        order_id: opened.openOrders[0]!.order_id
      }]
    });

    expect(canceled.openOrders).toEqual([]);
    expect(canceled.account.position).toMatchObject({
      side: "flat",
      quantity: "0"
    });
  });

  it("ignores public aggTrades that happened before the paper order was created", () => {
    const checkpoint = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [
          {
            trade_id: "agg-before-order",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:02.999Z"
          },
          {
            trade_id: "agg-after-order",
            price: "60000",
            quantity: "0.0004",
            trade_time: "2026-05-16T00:00:03.500Z"
          }
        ]
      }),
      events: [orderRequestEvent({
        eventId: "event-limit-filter",
        quantity: "0.001",
        limitPrice: "60000"
      })]
    });

    expect(checkpoint.account.position).toMatchObject({
      side: "long",
      quantity: "0.0004"
    });
    expect(checkpoint.openOrders).toMatchObject([{
      status: "partially_filled",
      remaining_quantity: "0.0006"
    }]);
    expect(checkpoint.processedPublicTradeIds).toEqual(["agg-after-order"]);
  });

  it("uses the TradingSystem event time as the paper order creation time", () => {
    const checkpoint = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [
          {
            trade_id: "agg-before-event",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
          },
          {
            trade_id: "agg-after-event",
            price: "60000",
            quantity: "0.0004",
            trade_time: "2026-05-16T00:00:04.500Z"
          }
        ]
      }),
      events: [orderRequestEvent({
        eventId: "event-created-after-checkpoint",
        observedAt: "2026-05-16T00:00:04.000Z",
        quantity: "0.001",
        limitPrice: "60000"
      })]
    });

    expect(checkpoint.account.position).toMatchObject({
      side: "long",
      quantity: "0.0004"
    });
    expect(checkpoint.openOrders).toMatchObject([{
      status: "partially_filled",
      created_at: "2026-05-16T00:00:04.000Z",
      remaining_quantity: "0.0006"
    }]);
    expect(checkpoint.processedPublicTradeIds).toEqual(["agg-after-event"]);
  });

  it("fills market orders from public bookTicker evidence", () => {
    const filled = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        askPrice: "60001",
        bidPrice: "59999",
        trades: []
      }),
      events: [orderRequestEvent({
        eventId: "event-market-buy",
        orderType: "market",
        quantity: "0.001"
      })]
    });

    expect(filled.openOrders).toEqual([]);
    expect(filled.account.position).toMatchObject({
      side: "long",
      quantity: "0.001",
      average_entry_price: "60001"
    });
    expect(filled.latestFill).toMatchObject({
      fill_status: "filled",
      fill_price: "60001",
      fill_quantity: "0.001"
    });
  });

  it("caps market order fills to the quoted public book quantity", () => {
    const partial = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        askPrice: "60001",
        askQuantity: "0.0004",
        bidPrice: "59999",
        trades: []
      }),
      events: [orderRequestEvent({
        eventId: "event-market-buy-larger-than-book",
        orderType: "market",
        quantity: "0.001"
      })]
    });

    expect(partial.account.position).toMatchObject({
      side: "long",
      quantity: "0.0004",
      average_entry_price: "60001"
    });
    expect(partial.openOrders).toMatchObject([{
      status: "partially_filled",
      cumulative_filled_quantity: "0.0004",
      remaining_quantity: "0.0006"
    }]);
    expect(partial.latestFill).toMatchObject({
      fill_status: "partially_filled",
      fill_quantity: "0.0004",
      fill_price: "60001"
    });
  });

  it("shares residual public aggTrade quantity across multiple matching limit orders in one checkpoint", () => {
    const filled = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [{
          trade_id: "agg-shared-liquidity",
          price: "60000",
          quantity: "0.002",
          trade_time: "2026-05-16T00:00:03.500Z"
        }]
      }),
      events: [
        orderRequestEvent({
          eventId: "event-shared-limit-a",
          quantity: "0.001",
          limitPrice: "60000"
        }),
        orderRequestEvent({
          eventId: "event-shared-limit-b",
          quantity: "0.001",
          limitPrice: "60000"
        })
      ]
    });

    expect(filled.openOrders).toEqual([]);
    expect(filled.account.position).toMatchObject({
      side: "long",
      quantity: "0.002",
      average_entry_price: "60000"
    });
    expect(filled.processedPublicTradeIds).toEqual(["agg-shared-liquidity"]);
  });

  it("reports filled status when one limit order completes across multiple public trades in one checkpoint", () => {
    const filled = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        trades: [
          {
            trade_id: "agg-same-order-partial",
            price: "60000",
            quantity: "0.0004",
            trade_time: "2026-05-16T00:00:03.500Z"
          },
          {
            trade_id: "agg-same-order-final",
            price: "60000",
            quantity: "0.0006",
            trade_time: "2026-05-16T00:00:03.600Z"
          }
        ]
      }),
      events: [orderRequestEvent({
        eventId: "event-multi-trade-complete",
        quantity: "0.001",
        limitPrice: "60000"
      })]
    });

    expect(filled.openOrders).toEqual([]);
    expect(filled.latestFill).toMatchObject({
      fill_status: "filled",
      fill_quantity: "0.0006",
      source_trade_id: "agg-same-order-final"
    });
  });

  it("restores short position sign when marking an existing paper position", () => {
    const short = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      publicExecutionSnapshot: publicExecutionSnapshot({
        askPrice: "60001",
        bidPrice: "59999",
        trades: []
      }),
      events: [orderRequestEvent({
        eventId: "event-market-sell",
        side: "sell",
        orderType: "market",
        quantity: "0.001"
      })]
    });

    const marked = applyPaperTradingCheckpoint({
      previous: short,
      marketPrice: 59_000,
      observedAt: "2026-05-16T00:01:03.000Z",
      events: []
    });

    expect(marked.account.position).toMatchObject({
      side: "short",
      quantity: "0.001",
      average_entry_price: "59999",
      mark_price: "59000"
    });
    expect(Number(marked.account.unrealized_pnl_usdt)).toBeGreaterThan(0);
  });

  it("requires public execution evidence before processing executable orders", () => {
    expect(() => applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      events: [orderRequestEvent({
        eventId: "event-needs-stream",
        quantity: "0.001",
        limitPrice: "60000"
      })]
    })).toThrow("public_execution_stream_unavailable");
  });

  it("records rejected order events without account mutation", () => {
    const rejected = applyPaperTradingCheckpoint({
      previous: initialPaperTradingEngineState(),
      marketPrice: 60_000,
      observedAt: "2026-05-16T00:00:03.000Z",
      events: [orderRequestEvent({
        eventId: "event-risk-rejected",
        quantity: "0",
        limitPrice: "60000",
        gatewayOutcome: "rejected"
      })]
    });

    expect(rejected.processedTradingSystemEventIds).toEqual(["event-risk-rejected"]);
    expect(rejected.openOrders).toEqual([]);
    expect(rejected.account.position).toMatchObject({
      side: "flat",
      quantity: "0"
    });
    expect(rejected.account.equity_usdt).toBe("10000");
  });
});

function orderRequestEvent(input: {
  eventId: string;
  observedAt?: string;
  side?: "buy" | "sell";
  orderType?: "market" | "limit";
  quantity: string;
  limitPrice?: string;
  gatewayOutcome?: GatewayResultOutcome;
}): PaperTradingSystemEvent {
  const orderRequest: PaperTradingDecisionOrderRequestSummary = {
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: input.side ?? "buy",
    order_type: input.orderType ?? "limit",
    quantity: input.quantity,
    limit_price: input.limitPrice
  };
  return {
    event_id: input.eventId,
    event_kind: "order_request",
    observed_at: input.observedAt ?? "2026-05-16T00:00:03.000Z",
    order_request: orderRequest,
    gateway_outcome: input.gatewayOutcome ?? "dry_run_only"
  };
}

function publicExecutionSnapshot(input: {
  trades: PaperTradingPublicExecutionSnapshotSummary["agg_trades"];
  askPrice?: string;
  askQuantity?: string;
  bidPrice?: string;
  bidQuantity?: string;
}): PaperTradingPublicExecutionSnapshotSummary {
  return {
    symbol: "BTCUSDT",
    observed_at: "2026-05-16T00:00:03.000Z",
    source_kind: "binance_production_public_stream",
    stream_marker: "test-public-execution",
    book_ticker: {
      bid_price: input.bidPrice ?? "59999",
      bid_quantity: input.bidQuantity ?? "1.000",
      ask_price: input.askPrice ?? "60001",
      ask_quantity: input.askQuantity ?? "1.000",
      event_time: "2026-05-16T00:00:02.000Z"
    },
    agg_trades: input.trades,
    authority_status: "read_only"
  };
}
