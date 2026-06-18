import { describe, expect, it } from "vitest";
import {
  buildTradingFirstViewportRecommendation,
  type TradingFirstViewportRecommendationInput,
  type TradingReviewPacketReadModel
} from "./index";

describe("buildTradingFirstViewportRecommendation", () => {
  it("uses TradingReviewPacket next action before compatibility fallback signals", () => {
    const recommendation = buildTradingFirstViewportRecommendation({
      trading_review_packet: tradingReviewPacketFixture({
        next_action: "Continue paper trading until the evidence window qualifies.",
        severity: "collecting",
        top_blocker: "min_observation_count_not_met",
        runner_status: "active",
        selected_matches_trading_review: true
      }),
      compatibility: {
        risk_status: "breach",
        runtime_lifecycle_status: "running",
        has_improvement_proposal: true,
        has_ledger_evidence: true,
        has_replay_evidence: true
      }
    });

    expect(recommendation).toEqual({
      label: "Recommended action",
      value: "Continue paper trading until the evidence window qualifies.",
      detail: "collecting / min_observation_count_not_met / runner active",
      tone: "warning",
      authority_status: "read_only"
    });
  });

  it("marks mismatch and blocked review packets as danger without changing the packet action", () => {
    const mismatch = buildTradingFirstViewportRecommendation({
      trading_review_packet: tradingReviewPacketFixture({
        next_action: "Open the active Trading review candidate before running Trading controls.",
        severity: "mismatch",
        top_blocker: "arena_selection_mismatch",
        selected_matches_trading_review: false
      })
    });
    const blocked = buildTradingFirstViewportRecommendation({
      trading_review_packet: tradingReviewPacketFixture({
        next_action: "Restore public execution evidence before trusting fills or paper score.",
        severity: "blocked",
        top_blocker: "fill_public_execution_evidence_missing",
        runner_status: "needs_resume",
        selected_matches_trading_review: true
      })
    });

    expect(mismatch).toMatchObject({
      value: "Open the active Trading review candidate before running Trading controls.",
      detail: "mismatch / arena_selection_mismatch / selected target mismatch",
      tone: "danger"
    });
    expect(blocked).toMatchObject({
      value: "Restore public execution evidence before trusting fills or paper score.",
      detail: "blocked / fill_public_execution_evidence_missing / runner needs_resume",
      tone: "danger"
    });
  });

  it("uses ready packet severity as a good read-only recommendation", () => {
    const recommendation = buildTradingFirstViewportRecommendation({
      trading_review_packet: tradingReviewPacketFixture({
        next_action: "Review qualified paper evidence for Trading promotion.",
        severity: "ready",
        selected_matches_trading_review: true
      })
    });

    expect(recommendation).toMatchObject({
      value: "Review qualified paper evidence for Trading promotion.",
      detail: "ready / none",
      tone: "good",
      authority_status: "read_only"
    });
  });

  it("falls back to compatibility-cycle recommendations only when no packet exists", () => {
    const breach = buildTradingFirstViewportRecommendation({
      compatibility: {
        risk_status: "breach",
        runtime_lifecycle_status: "running"
      }
    });
    const firstCycle = buildTradingFirstViewportRecommendation({});

    expect(breach).toMatchObject({
      value: "Stop and inspect",
      detail: "Risk status is breach; stop the Trading Run before considering another cycle.",
      tone: "danger"
    });
    expect(firstCycle).toMatchObject({
      value: "Run first cycle",
      detail: "No complete request/result chain is visible yet; run the fixture paper cycle to create decision evidence.",
      tone: "warning"
    });
  });

  it("keeps compatibility change proposal identity when falling back to the old cycle recommendation", () => {
    const recommendation = buildTradingFirstViewportRecommendation({
      compatibility: {
        has_improvement_proposal: true,
        improvement_proposal_id: "proposal-001"
      }
    });

    expect(recommendation).toMatchObject({
      value: "Run next cycle",
      detail: "Improvement produced proposal-001; review the handoff and start the next paper cycle.",
      tone: "good",
      authority_status: "read_only"
    });
  });
});

function tradingReviewPacketFixture(
  input: {
    next_action: string;
    severity: TradingReviewPacketReadModel["verdict"]["severity"];
    top_blocker?: TradingReviewPacketReadModel["verdict"]["top_blocker"];
    runner_status?: NonNullable<TradingFirstViewportRecommendationInput["trading_review_packet"]>["runner"]["runner_status"];
    selected_matches_trading_review: boolean;
  }
): TradingReviewPacketReadModel {
  return {
    packet_kind: "trading_review_packet",
    verdict: {
      readiness_status: "collecting_paper_evidence",
      qualification_status: input.severity === "ready" ? "qualified" : "collecting_evidence",
      severity: input.severity,
      top_blocker: input.top_blocker
    },
    subject: {
      candidate_id: "candidate-profitable",
      candidate_version_id: "candidate-profitable-v1",
      display_name: "candidate-profitable",
      paper_trading_evaluation_id: "paper-evaluation-candidate-profitable",
      promoted_at: "2026-05-16T00:00:04.000Z",
      selected_candidate_id: "candidate-profitable",
      selected_matches_trading_review: input.selected_matches_trading_review
    },
    performance: {
      rank: 1,
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      profit_loss: {
        revenue_usdt: 5,
        cost_usdt: 0.048,
        net_revenue_usdt: 4.952,
        net_return_pct: 0.04952
      }
    },
    evidence_quality: {
      evidence_window: {
        observation_count: 1,
        elapsed_ms: 60_000,
        failed_observation_count: 0
      },
      qualification_reasons: input.top_blocker === "min_observation_count_not_met" ||
        input.top_blocker === "fill_public_execution_evidence_missing"
        ? [input.top_blocker]
        : [],
      blocker_groups: []
    },
    provenance: {},
    risk: {
      open_order_count: 0
    },
    runner: {
      runner_status: input.runner_status,
      runner_active: input.runner_status === "active",
      authority_status: "not_live"
    },
    ledger: {
      evidence_status: "not_observed",
      ledger_chain_complete: false,
      authority_status: "not_live"
    },
    lineage: {
      lineage_status: "available",
      authority_status: "lineage_only"
    },
    authority: {
      authority_status: "not_live",
      live_disabled_reason: "mlp_paper_only",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      }
    },
    next_action: input.next_action
  };
}
