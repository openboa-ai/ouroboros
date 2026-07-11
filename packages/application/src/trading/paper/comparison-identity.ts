import { createHash } from "node:crypto";

export interface PaperTradingComparisonIds {
  preparation_id: string;
  comparison_commitment_id: string;
}

export class PaperTradingComparisonIdentityError extends Error {
  readonly code = "invalid_paper_trading_comparison_idempotency_key";

  constructor() {
    super("Paper comparison idempotency key is required.");
    this.name = "PaperTradingComparisonIdentityError";
  }
}

export function paperTradingComparisonIdsForIdempotencyKey(
  idempotencyKey: string
): PaperTradingComparisonIds {
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
    throw new PaperTradingComparisonIdentityError();
  }
  const suffix = createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 16);
  return {
    preparation_id: `paper-trading-comparison-preparation-${suffix}`,
    comparison_commitment_id: `paper-trading-comparison-${suffix}`
  };
}
