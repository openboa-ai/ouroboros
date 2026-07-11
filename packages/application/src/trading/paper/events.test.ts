import { describe, expect, it } from "vitest";
import { parseTradingSystemPaperEventLine } from "./events";

const acknowledgementAttribution = {
  comparison_tick_acknowledgement_ref: {
    record_kind: "paper_trading_comparison_tick_acknowledgement",
    id: "ack-1"
  },
  comparison_tick_acknowledgement_digest: "sha256:acknowledgement"
} as const;

describe("paper trading event acknowledgement attribution", () => {
  it.each([
    ["order", {
      ...baseEvent("order_request", "event-order-1"),
      intent_kind: "place_order",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      reason: "attributed order"
    }],
    ["cancel", {
      ...baseEvent("cancel_order", "event-cancel-1"),
      order_id: "paper-order-1",
      reason: "attributed cancel"
    }],
    ["hold", {
      ...baseEvent("hold", "event-hold-1"),
      reason: "attributed hold"
    }],
    ["no action", {
      ...baseEvent("no_action", "event-no-action-1"),
      reason: "attributed no action"
    }]
  ])("preserves exact acknowledgement lineage for %s", (_label, event) => {
    const parsed = parseTradingSystemPaperEventLine(
      JSON.stringify({ ...event, ...acknowledgementAttribution }),
      { sandboxId: "sandbox-1", lineIndex: 0 }
    );

    expect(parsed.status).toBe("accepted");
    if (parsed.status !== "accepted") throw new Error("expected accepted event");
    expect(parsed.event).toMatchObject(acknowledgementAttribution);
  });

  it.each([
    ["reference only", {
      comparison_tick_acknowledgement_ref:
        acknowledgementAttribution.comparison_tick_acknowledgement_ref
    }],
    ["digest only", {
      comparison_tick_acknowledgement_digest:
        acknowledgementAttribution.comparison_tick_acknowledgement_digest
    }],
    ["wrong reference kind", {
      ...acknowledgementAttribution,
      comparison_tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_delivery",
        id: "ack-1"
      }
    }],
    ["empty reference id", {
      ...acknowledgementAttribution,
      comparison_tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: ""
      }
    }],
    ["malformed digest", {
      ...acknowledgementAttribution,
      comparison_tick_acknowledgement_digest: "acknowledgement"
    }],
    ["nested extra authority", {
      ...acknowledgementAttribution,
      comparison_tick_acknowledgement_ref: {
        ...acknowledgementAttribution.comparison_tick_acknowledgement_ref,
        live_exchange_authority: false
      }
    }],
    ["top-level extra authority", {
      ...acknowledgementAttribution,
      comparison_tick_order_submission_authority: true
    }]
  ])("rejects %s without silently stripping attribution", (_label, attribution) => {
    const parsed = parseTradingSystemPaperEventLine(
      JSON.stringify({
        ...baseEvent("hold", "event-invalid-attribution"),
        reason: "must not be accepted",
        ...attribution
      }),
      { sandboxId: "sandbox-1", lineIndex: 0 }
    );

    expect(parsed).toMatchObject({
      status: "rejected",
      reason: "comparison_tick_acknowledgement_attribution_invalid",
      event: {
        event_kind: "error",
        reason: "comparison_tick_acknowledgement_attribution_invalid"
      }
    });
  });
});

function baseEvent(event: string, eventId: string) {
  return {
    event,
    event_id: eventId,
    instance_id: "sandbox-1",
    at: "2026-07-11T00:00:04.000Z",
    authority_status: "trace_only"
  };
}
