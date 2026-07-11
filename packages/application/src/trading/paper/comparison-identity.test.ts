import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paperTradingComparisonIdsForIdempotencyKey } from "./comparison-identity";

describe("paper trading comparison identity", () => {
  it("preserves the coordinator comparison IDs for an existing key", () => {
    expect(paperTradingComparisonIdsForIdempotencyKey(
      "paper-comparison-coordinator-001"
    )).toEqual({
      preparation_id: "paper-trading-comparison-preparation-74f7a27ffac400ff",
      comparison_commitment_id: "paper-trading-comparison-74f7a27ffac400ff"
    });
  });

  it("hashes the original non-empty key without normalizing it", () => {
    const key = " comparison-key ";
    const suffix = createHash("sha256").update(key).digest("hex").slice(0, 16);

    expect(paperTradingComparisonIdsForIdempotencyKey(key)).toEqual({
      preparation_id: `paper-trading-comparison-preparation-${suffix}`,
      comparison_commitment_id: `paper-trading-comparison-${suffix}`
    });
  });

  it.each(["", " ", "\n\t"])("rejects an empty key: %j", (key) => {
    expect(() => paperTradingComparisonIdsForIdempotencyKey(key)).toThrow(
      "Paper comparison idempotency key is required."
    );
  });
});
