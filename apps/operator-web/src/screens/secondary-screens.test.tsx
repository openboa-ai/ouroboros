import type {
  OperatorReadModel,
  PaperTradingEvaluationReadModel
} from "@ouroboros/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EvidenceScreen, TradingScreen } from "./secondary-screens";

function paperEvaluation(
  candidateId: string,
  evaluationId: string,
  tradingRunId: string
): PaperTradingEvaluationReadModel {
  return {
    evaluation_kind: "paper_trading_evaluation",
    evaluation_id: evaluationId,
    status: "stopped",
    candidate_id: candidateId,
    trading_run_id: tradingRunId,
    runner_active: false,
    observation_count: 4,
    ledger_chain_complete: true,
    profit_loss: {
      revenue_usdt: 6,
      cost_usdt: 2,
      net_revenue_usdt: 4,
      net_return_pct: 0.4
    },
    market_data_source: "binance_production_public_rest",
    account_provider: "fake_paper_account",
    executor: "fake_paper_order_executor",
    score_source: "paper_trading_engine",
    authority_status: "not_live"
  };
}

function mismatchedReviewOperator(): OperatorReadModel {
  const selectedEvaluation = paperEvaluation(
    "selected-candidate",
    "selected-evaluation",
    "selected-run"
  );
  const reviewEvaluation = paperEvaluation(
    "review-candidate",
    "review-evaluation",
    "review-run"
  );

  return {
    selected_candidate_id: "selected-candidate",
    selected_paper_trading_evaluation: selectedEvaluation,
    latest_commands: [],
    trading_review: {
      active_candidate_id: "review-candidate",
      readiness_status: "collecting_paper_evidence",
      paper_qualification_reasons: [],
      paper_trading_evaluation: reviewEvaluation,
      selected_candidate_id: "selected-candidate",
      selected_matches_trading_review: false,
      next_action: "Continue review evidence",
      review_packet: {
        subject: {
          selected_candidate_id: "selected-candidate",
          selected_matches_trading_review: false
        },
        performance: {
          primary_rank_metric: "net_revenue_usdt",
          secondary_rank_metric: "net_return_pct",
          profit_loss: reviewEvaluation.profit_loss
        },
        verdict: {
          readiness_status: "collecting_paper_evidence",
          severity: "warning"
        },
        runner: {
          runner_status: "inactive",
          runner_active: false,
          authority_status: "not_live"
        },
        ledger: {
          evidence_status: "complete_chain",
          ledger_chain_complete: true,
          authority_status: "not_live"
        },
        provenance: {},
        lineage: {
          lineage_status: "missing"
        }
      }
    }
  } as unknown as OperatorReadModel;
}

describe("review-scoped secondary screens", () => {
  it("binds Trading commands and readback to the active review evaluation", () => {
    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={mismatchedReviewOperator()}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("review-evaluation");
    expect(markup).toContain("review-run");
    expect(markup).not.toContain("selected-evaluation");
    expect(markup).not.toContain("selected-run");
  });

  it("binds Evidence readback to the active review evaluation", () => {
    const markup = renderToStaticMarkup(
      <EvidenceScreen operator={mismatchedReviewOperator()} />
    );

    expect(markup).toContain("review-evaluation");
    expect(markup).not.toContain("selected-evaluation");
  });

  it("uses the selected paper evaluation before a Trading review target exists", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.active_candidate_id = undefined;

    const tradingMarkup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );
    const evidenceMarkup = renderToStaticMarkup(
      <EvidenceScreen operator={operator} />
    );

    for (const markup of [tradingMarkup, evidenceMarkup]) {
      expect(markup).toContain("selected-evaluation");
      expect(markup).not.toContain("review-evaluation");
    }
  });
});
