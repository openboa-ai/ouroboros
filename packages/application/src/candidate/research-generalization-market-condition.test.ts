import { describe, expect, it } from "vitest";
import type {
  ResearchGeneralizationPublicKlineWindowInput
} from "@ouroboros/domain";
import {
  decideResearchGeneralizationMarketCondition,
  RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY,
  ResearchGeneralizationMarketConditionDecisionError
} from "./research-generalization-market-condition";

describe("ResearchGeneralization market condition", () => {
  it.each([
    ["long", Array.from({ length: 30 }, (_, index) => 100 + index)],
    ["short", Array.from({ length: 30 }, (_, index) => 130 - index)],
    ["flat", Array.from({ length: 30 }, () => 100)]
  ] as const)("classifies an exact closed-kline %s block", (block, closes) => {
    const condition = decideResearchGeneralizationMarketCondition({
      publicKlineWindow: klineWindow([...closes]),
      classifiedAt: "2026-07-13T00:30:31.000Z"
    });

    expect(condition.condition_block).toBe(block);
    expect(condition.classifier_policy).toEqual(
      RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY
    );
    expect(condition.public_kline_window.klines).toHaveLength(30);
    expect(condition.public_kline_window.window_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(condition.classification_digest)
      .toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(condition.evaluation_authority).toBe(false);
    expect(condition.authority_status).toBe("public_evidence_only");
  });

  it("keeps the exact directional threshold inside the flat block", () => {
    const threshold = RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY
      .directional_gap_ratio_threshold;
    const lastClose = 500 * (1 + threshold) / (5 - threshold);
    const condition = decideResearchGeneralizationMarketCondition({
      publicKlineWindow: klineWindow([
        ...Array.from({ length: 25 }, () => 100),
        ...Array.from({ length: 5 }, () => lastClose)
      ]),
      classifiedAt: "2026-07-13T00:30:31.000Z"
    });

    expect(condition.directional_gap_ratio).toBeCloseTo(threshold, 12);
    expect(condition.condition_block).toBe("flat");
  });

  it("replays exact evidence and digests", () => {
    const input = {
      publicKlineWindow: klineWindow(
        Array.from({ length: 30 }, (_, index) => 60_000 + index)
      ),
      classifiedAt: "2026-07-13T00:30:31.000Z"
    };

    expect(decideResearchGeneralizationMarketCondition(input)).toEqual(
      decideResearchGeneralizationMarketCondition(structuredClone(input))
    );
  });

  it.each([
    ["wrong symbol", (window: any) => {
      window.symbol = "ETHUSDT";
    }],
    ["wrong sample count", (window: any) => {
      window.klines.pop();
      window.sample_count = 29;
    }],
    ["gapped window", (window: any) => {
      window.klines[10].open_time = "2026-07-13T00:11:00.000Z";
    }],
    ["duplicate window", (window: any) => {
      window.klines[10] = structuredClone(window.klines[9]);
    }],
    ["future close", (window: any) => {
      window.klines[29].close_time = "2026-07-13T00:30:59.999Z";
    }],
    ["non-public source", (window: any) => {
      window.source.source_kind = "private_user_stream";
    }],
    ["invalid close", (window: any) => {
      window.klines[4].close_price = "NaN";
    }],
    ["classification before observation", (_window: any, input: any) => {
      input.classifiedAt = "2026-07-13T00:30:29.000Z";
    }]
  ])("rejects %s", (_label, mutate) => {
    const input = {
      publicKlineWindow: klineWindow(Array.from({ length: 30 }, () => 100)),
      classifiedAt: "2026-07-13T00:30:31.000Z"
    };
    mutate(input.publicKlineWindow, input);

    expect(() => decideResearchGeneralizationMarketCondition(input as never))
      .toThrow(ResearchGeneralizationMarketConditionDecisionError);
  });
});

function klineWindow(
  closes: number[]
): ResearchGeneralizationPublicKlineWindowInput {
  const start = Date.parse("2026-07-13T00:00:00.000Z");
  return {
    symbol: "BTCUSDT",
    interval: "1m",
    sample_count: 30,
    observed_at: "2026-07-13T00:30:30.000Z",
    closed_window_end_at: "2026-07-13T00:29:59.999Z",
    source: {
      provider_kind: "binance_production_public_market_data",
      source_kind: "binance_production_public_rest",
      rest_base_url: "https://fapi.binance.com",
      endpoint: "/fapi/v1/klines",
      authority_status: "read_only"
    },
    klines: closes.map((close, index) => ({
      open_time: new Date(start + index * 60_000).toISOString(),
      close_time: new Date(start + (index + 1) * 60_000 - 1).toISOString(),
      close_price: String(close)
    })),
    authority_status: "read_only"
  };
}
