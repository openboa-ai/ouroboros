import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  type TradingPromotionRecord
} from "./index";

describe("paper trading comparison promotion evidence", () => {
  it("accepts one comparison-confirmed paper-only promotion", () => {
    expect(paperTradingComparisonTradingPromotionHasRuntimeShape(
      promotionFixture()
    )).toBe(true);
  });

  it("freezes the whole comparison confirmation basis", () => {
    const promotion = promotionFixture();

    expect(paperTradingComparisonTradingPromotionDigestInput(promotion)).toBe(
      paperTradingComparisonPersistedRecordDigestInput(promotion)
    );
    const changed = structuredClone(promotion) as TradingPromotionRecord & {
      comparison_confirmation: { final_verdict_digest: string };
    };
    changed.comparison_confirmation.final_verdict_digest = "sha256:changed-verdict";
    expect(paperTradingComparisonTradingPromotionDigestInput(changed)).not.toBe(
      paperTradingComparisonTradingPromotionDigestInput(promotion)
    );
  });

  it.each([
    ["missing basis", (value: any) => {
      delete value.comparison_confirmation;
    }],
    ["basis kind", (value: any) => {
      value.comparison_confirmation.basis_kind = "single_verdict";
    }],
    ["campaign ref", (value: any) => {
      value.comparison_confirmation.campaign_ref.record_kind =
        "paper_trading_comparison_verdict";
    }],
    ["outcome ref", (value: any) => {
      value.comparison_confirmation.campaign_outcome_ref.record_kind =
        "paper_trading_comparison_confirmation_campaign";
    }],
    ["final verdict ref", (value: any) => {
      value.comparison_confirmation.final_verdict_ref.record_kind =
        "paper_trading_comparison_confirmation_campaign_outcome";
    }],
    ["campaign digest", (value: any) => {
      value.comparison_confirmation.campaign_digest = "";
    }],
    ["outcome digest", (value: any) => {
      value.comparison_confirmation.campaign_outcome_digest = "";
    }],
    ["verdict digest", (value: any) => {
      value.comparison_confirmation.final_verdict_digest = "";
    }],
    ["promotion time", (value: any) => {
      value.promoted_at = "2026-07-12 09:00:00";
    }],
    ["authority", (value: any) => {
      value.authority_status = "live";
    }]
  ])("rejects invalid %s", (_label, mutate) => {
    const promotion = promotionFixture() as any;
    mutate(promotion);

    expect(paperTradingComparisonTradingPromotionHasRuntimeShape(promotion))
      .toBe(false);
  });
});

function promotionFixture(): TradingPromotionRecord & {
  comparison_confirmation: {
    basis_kind: "paper_trading_comparison_confirmation";
    campaign_ref: { record_kind: string; id: string };
    campaign_digest: string;
    campaign_outcome_ref: { record_kind: string; id: string };
    campaign_outcome_digest: string;
    final_verdict_ref: { record_kind: string; id: string };
    final_verdict_digest: string;
  };
} {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-campaign-001-outcome",
    status: "promoted_for_trading_review",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "challenger"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "challenger-v1"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "challenger-final-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "campaign-001"
      },
      campaign_digest: "sha256:campaign",
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "campaign-001-outcome"
      },
      campaign_outcome_digest: "sha256:outcome",
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "campaign-001-slot-2-verdict"
      },
      final_verdict_digest: "sha256:verdict"
    },
    promoted_at: "2026-07-12T09:00:00.000Z",
    authority_status: "not_live"
  };
}
