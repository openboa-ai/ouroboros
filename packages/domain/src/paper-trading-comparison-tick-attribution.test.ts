import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickAcknowledgementHasRuntimeShape,
  paperTradingComparisonTickContextHasRuntimeShape,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickDeliveryHasRuntimeShape,
  paperTradingComparisonTickIOWriteContextHasRuntimeShape,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingComparisonTickContext,
  type PaperTradingComparisonTickDeliveryRecord,
  type PaperTradingComparisonTickIOWriteContext
} from "./index";

describe("paper comparison served-tick attribution domain", () => {
  it("canonically binds delivery and acknowledgement evidence", () => {
    const delivery = validDelivery();
    const acknowledgement = validAcknowledgement();

    expect(paperTradingComparisonTickDeliveryDigestInput({
      ...delivery,
      paper_trading_comparison_tick_delivery_id: "different",
      delivery_digest: "sha256:different"
    })).toBe(paperTradingComparisonTickDeliveryDigestInput(delivery));
    expect(paperTradingComparisonTickDeliveryDigestInput({
      ...delivery,
      provider_request_count_at_delivery: 5
    })).not.toBe(paperTradingComparisonTickDeliveryDigestInput(delivery));

    expect(paperTradingComparisonTickAcknowledgementDigestInput({
      ...acknowledgement,
      paper_trading_comparison_tick_acknowledgement_id: "different",
      acknowledgement_digest: "sha256:different"
    })).toBe(paperTradingComparisonTickAcknowledgementDigestInput(acknowledgement));
    expect(paperTradingComparisonTickAcknowledgementDigestInput({
      ...acknowledgement,
      provider_request_count_at_acknowledgement: 6
    })).not.toBe(paperTradingComparisonTickAcknowledgementDigestInput(acknowledgement));
  });

  it("accepts complete delivery, acknowledgement, response context, and write authority", () => {
    expect(paperTradingComparisonTickDeliveryHasRuntimeShape(validDelivery())).toBe(true);
    expect(
      paperTradingComparisonTickAcknowledgementHasRuntimeShape(validAcknowledgement())
    ).toBe(true);
    expect(paperTradingComparisonTickContextHasRuntimeShape(validContext())).toBe(true);
    expect(
      paperTradingComparisonTickIOWriteContextHasRuntimeShape(validWriteContext())
    ).toBe(true);
  });

  it("accepts role-bound attribution for a later positive tick sequence", () => {
    const delivery = {
      ...validDelivery(),
      paper_trading_comparison_tick_delivery_id: "activation-attempt-1:champion:tick-2",
      tick_ref: { record_kind: "paper_trading_comparison_tick", id: "tick-2" },
      tick_digest: "sha256:tick-2",
      tick_sequence: 2
    } satisfies PaperTradingComparisonTickDeliveryRecord;
    const acknowledgement = {
      ...validAcknowledgement(),
      paper_trading_comparison_tick_acknowledgement_id:
        "activation-attempt-1:champion:tick-2:acknowledgement",
      delivery_ref: {
        record_kind: "paper_trading_comparison_tick_delivery",
        id: delivery.paper_trading_comparison_tick_delivery_id
      },
      delivery_digest: delivery.delivery_digest,
      tick_ref: delivery.tick_ref,
      tick_digest: delivery.tick_digest,
      tick_sequence: delivery.tick_sequence
    } satisfies PaperTradingComparisonTickAcknowledgementRecord;

    expect(paperTradingComparisonTickDeliveryHasRuntimeShape(delivery)).toBe(true);
    expect(paperTradingComparisonTickAcknowledgementHasRuntimeShape(acknowledgement)).toBe(true);
  });

  it.each([
    ["null", () => null],
    ["wrong record kind", (record: any) => {
      record.record_kind = "paper_trading_comparison_tick_acknowledgement";
      return record;
    }],
    ["wrong activation ref", (record: any) => {
      record.paper_trading_comparison_activation_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong activation attempt ref", (record: any) => {
      record.paper_trading_comparison_activation_attempt_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong role", (record: any) => {
      record.role = "peer";
      return record;
    }],
    ["wrong trading run ref", (record: any) => {
      record.trading_run_ref.record_kind = "paper_trading_evaluation";
      return record;
    }],
    ["wrong tick ref", (record: any) => {
      record.tick_ref.record_kind = "wrong";
      return record;
    }],
    ["zero tick sequence", (record: any) => {
      record.tick_sequence = 0;
      return record;
    }],
    ["zero provider request count", (record: any) => {
      record.provider_request_count_at_delivery = 0;
      return record;
    }],
    ["wrong endpoint", (record: any) => {
      record.endpoint = "GET /account";
      return record;
    }],
    ["non-ISO delivery time", (record: any) => {
      record.delivered_at = "bad";
      return record;
    }],
    ["empty delivery digest", (record: any) => {
      record.delivery_digest = "";
      return record;
    }],
    ["live authority", (record: any) => {
      record.live_exchange_authority = true;
      return record;
    }],
    ["order authority", (record: any) => {
      record.order_submission_authority = true;
      return record;
    }],
    ["extra private authority", (record: any) => {
      record.private_exchange_access = "allowed";
      return record;
    }]
  ])("rejects malformed tick delivery without throwing: %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validDelivery()));
    expect(() => paperTradingComparisonTickDeliveryHasRuntimeShape(malformed)).not.toThrow();
    expect(paperTradingComparisonTickDeliveryHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["null", () => null],
    ["wrong record kind", (record: any) => {
      record.record_kind = "paper_trading_comparison_tick_delivery";
      return record;
    }],
    ["wrong delivery ref", (record: any) => {
      record.delivery_ref.record_kind = "wrong";
      return record;
    }],
    ["empty delivery digest", (record: any) => {
      record.delivery_digest = "";
      return record;
    }],
    ["wrong activation attempt ref", (record: any) => {
      record.paper_trading_comparison_activation_attempt_ref.record_kind = "wrong";
      return record;
    }],
    ["wrong role", (record: any) => {
      record.role = "peer";
      return record;
    }],
    ["wrong trading run ref", (record: any) => {
      record.trading_run_ref.record_kind = "paper_trading_evaluation";
      return record;
    }],
    ["wrong tick ref", (record: any) => {
      record.tick_ref.record_kind = "wrong";
      return record;
    }],
    ["zero tick sequence", (record: any) => {
      record.tick_sequence = 0;
      return record;
    }],
    ["zero provider request count", (record: any) => {
      record.provider_request_count_at_acknowledgement = 0;
      return record;
    }],
    ["wrong endpoint", (record: any) => {
      record.endpoint = "POST /orders/validate";
      return record;
    }],
    ["non-ISO acknowledgement time", (record: any) => {
      record.acknowledged_at = "bad";
      return record;
    }],
    ["empty acknowledgement digest", (record: any) => {
      record.acknowledgement_digest = "";
      return record;
    }],
    ["live authority", (record: any) => {
      record.live_exchange_authority = true;
      return record;
    }],
    ["order authority", (record: any) => {
      record.order_submission_authority = true;
      return record;
    }],
    ["extra private authority", (record: any) => {
      record.private_exchange_access = "allowed";
      return record;
    }]
  ])("rejects malformed tick acknowledgement without throwing: %s", (_label, mutate) => {
    const malformed = mutate(structuredClone(validAcknowledgement()));
    expect(() =>
      paperTradingComparisonTickAcknowledgementHasRuntimeShape(malformed)
    ).not.toThrow();
    expect(paperTradingComparisonTickAcknowledgementHasRuntimeShape(malformed)).toBe(false);
  });

  it.each([
    ["null", null],
    ["partial context", {
      ...validContext(),
      delivery_digest: undefined
    }],
    ["wrong tick ref", {
      ...validContext(),
      tick_ref: { record_kind: "wrong", id: "tick-1" }
    }],
    ["zero tick sequence", { ...validContext(), tick_sequence: 0 }],
    ["wrong delivery ref", {
      ...validContext(),
      delivery_ref: { record_kind: "wrong", id: "delivery-1" }
    }],
    ["empty delivery digest", { ...validContext(), delivery_digest: "" }],
    ["extra authority", { ...validContext(), live_exchange_authority: false }]
  ])("rejects malformed candidate response context: %s", (_label, value) => {
    expect(() => paperTradingComparisonTickContextHasRuntimeShape(value)).not.toThrow();
    expect(paperTradingComparisonTickContextHasRuntimeShape(value)).toBe(false);
  });

  it.each([
    ["null", null],
    ["wrong activation ref", {
      ...validWriteContext(),
      paper_trading_comparison_activation_ref: { record_kind: "wrong", id: "activation-1" }
    }],
    ["wrong activation attempt ref", {
      ...validWriteContext(),
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "wrong",
        id: "activation-attempt-1"
      }
    }],
    ["wrong role", { ...validWriteContext(), role: "peer" }],
    ["wrong trading run ref", {
      ...validWriteContext(),
      trading_run_ref: { record_kind: "paper_trading_evaluation", id: "champion-run" }
    }],
    ["wrong tick ref", {
      ...validWriteContext(),
      tick_ref: { record_kind: "wrong", id: "tick-1" }
    }],
    ["empty tick digest", { ...validWriteContext(), tick_digest: "" }],
    ["wrong operation", { ...validWriteContext(), operation: "record_observation" }],
    ["extra authority", { ...validWriteContext(), order_submission_authority: false }]
  ])("rejects malformed tick IO write context: %s", (_label, value) => {
    expect(() => paperTradingComparisonTickIOWriteContextHasRuntimeShape(value)).not.toThrow();
    expect(paperTradingComparisonTickIOWriteContextHasRuntimeShape(value)).toBe(false);
  });
});

function validDelivery(): PaperTradingComparisonTickDeliveryRecord {
  return {
    record_kind: "paper_trading_comparison_tick_delivery",
    version: 1,
    paper_trading_comparison_tick_delivery_id: "activation-attempt-1:champion:tick-1",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-1"
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "activation-attempt-1"
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:activation-attempt",
    role: "champion",
    trading_run_ref: { record_kind: "trading_run", id: "champion-run" },
    tick_ref: { record_kind: "paper_trading_comparison_tick", id: "tick-1" },
    tick_digest: "sha256:tick",
    tick_sequence: 1,
    provider_request_count_at_delivery: 4,
    endpoint: "GET /market/snapshot",
    delivered_at: "2026-07-11T00:00:12.000Z",
    delivery_digest: "sha256:delivery",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validAcknowledgement(): PaperTradingComparisonTickAcknowledgementRecord {
  const delivery = validDelivery();
  return {
    record_kind: "paper_trading_comparison_tick_acknowledgement",
    version: 1,
    paper_trading_comparison_tick_acknowledgement_id:
      "activation-attempt-1:champion:tick-1:acknowledgement",
    delivery_ref: {
      record_kind: delivery.record_kind,
      id: delivery.paper_trading_comparison_tick_delivery_id
    },
    delivery_digest: delivery.delivery_digest,
    paper_trading_comparison_activation_attempt_ref:
      delivery.paper_trading_comparison_activation_attempt_ref,
    paper_trading_comparison_activation_attempt_digest:
      delivery.paper_trading_comparison_activation_attempt_digest,
    role: delivery.role,
    trading_run_ref: delivery.trading_run_ref,
    tick_ref: delivery.tick_ref,
    tick_digest: delivery.tick_digest,
    tick_sequence: delivery.tick_sequence,
    provider_request_count_at_acknowledgement: 5,
    endpoint: "POST /comparison/tick/ack",
    acknowledged_at: "2026-07-11T00:00:13.000Z",
    acknowledgement_digest: "sha256:acknowledgement",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function validContext(): PaperTradingComparisonTickContext {
  const delivery = validDelivery();
  return {
    tick_ref: delivery.tick_ref,
    tick_digest: delivery.tick_digest,
    tick_sequence: delivery.tick_sequence,
    delivery_ref: {
      record_kind: delivery.record_kind,
      id: delivery.paper_trading_comparison_tick_delivery_id
    },
    delivery_digest: delivery.delivery_digest
  };
}

function validWriteContext(): PaperTradingComparisonTickIOWriteContext {
  const delivery = validDelivery();
  return {
    paper_trading_comparison_activation_ref:
      delivery.paper_trading_comparison_activation_ref,
    paper_trading_comparison_activation_digest:
      delivery.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref:
      delivery.paper_trading_comparison_activation_attempt_ref,
    paper_trading_comparison_activation_attempt_digest:
      delivery.paper_trading_comparison_activation_attempt_digest,
    role: delivery.role,
    trading_run_ref: delivery.trading_run_ref,
    tick_ref: delivery.tick_ref,
    tick_digest: delivery.tick_digest,
    operation: "deliver_market_snapshot"
  };
}
