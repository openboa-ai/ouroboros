import { describe, expect, it } from "vitest";
import {
  parseTradingSystemPaperEventLine,
  TRADING_SYSTEM_PAPER_EVENT_EXAMPLES,
  TRADING_SYSTEM_PAPER_EVENT_REQUIRED_FIELDS
} from "@ouroboros/application/trading/paper/events";

describe("TradingSystem paper event protocol", () => {
  it("accepts canonical order, cancel, hold, and no_action JSONL events", () => {
    for (const [name, example] of Object.entries(TRADING_SYSTEM_PAPER_EVENT_EXAMPLES)) {
      const parsed = parseTradingSystemPaperEventLine(JSON.stringify(example), {
        sandboxId: "sandbox-paper-event-protocol",
        lineIndex: 0
      });

      expect(parsed, name).toMatchObject({
        status: "accepted",
        event: {
          event_id: example.event_id,
          event_kind: example.event
        }
      });
    }
  });

  it("rejects malformed order requests before Gateway or fake account mutation", () => {
    const malformed = {
      ...TRADING_SYSTEM_PAPER_EVENT_EXAMPLES.order_request,
      event_id: "paper-smoke-order-malformed",
      limit_price: undefined
    };

    const parsed = parseTradingSystemPaperEventLine(JSON.stringify(malformed), {
      sandboxId: "sandbox-paper-event-protocol",
      lineIndex: 1
    });

    expect(parsed).toMatchObject({
      status: "rejected",
      reason: "limit_order_request_requires_decimal_limit_price",
      event: {
        event_kind: "error",
        event_id: "paper-smoke-order-malformed"
      }
    });
  });

  it("rejects private or live authority attempts as protocol errors", () => {
    const liveAttempt = {
      ...TRADING_SYSTEM_PAPER_EVENT_EXAMPLES.order_request,
      event_id: "paper-smoke-order-live-attempt",
      runtime_environment: "live",
      signed_request: true
    };

    const parsed = parseTradingSystemPaperEventLine(JSON.stringify(liveAttempt), {
      sandboxId: "sandbox-paper-event-protocol",
      lineIndex: 2
    });

    expect(parsed).toMatchObject({
      status: "rejected",
      reason: "forbidden_private_or_live_authority",
      event: {
        event_kind: "error",
        event_id: "paper-smoke-order-live-attempt"
      }
    });
  });

  it("documents the required JSON fields for each paper event kind", () => {
    expect(TRADING_SYSTEM_PAPER_EVENT_REQUIRED_FIELDS).toMatchObject({
      common: ["event", "event_id", "instance_id", "at", "authority_status"],
      order_request: ["intent_kind", "symbol", "side", "order_type", "quantity"],
      limit_order_request: ["limit_price"],
      cancel_order: ["reason"],
      hold: ["reason"],
      no_action: ["reason"]
    });
  });
});
