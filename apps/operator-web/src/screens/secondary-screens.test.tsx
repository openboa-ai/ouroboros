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
    paper_trading_board: {
      entries: []
    },
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
        evidence_quality: {
          qualification_reasons: [],
          blocker_groups: []
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

  it("does not start a candidate-default paper run from an active Trading review", () => {
    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={mismatchedReviewOperator()}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );
    const startButton = Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g))
      .map((match) => match[0])
      .find((button) => button.includes("Start paper"));

    expect(startButton).toContain('disabled=""');
    expect(startButton).toContain("Exact Trading review run restart is unavailable");
  });

  it("binds Evidence readback to the active review evaluation", () => {
    const markup = renderToStaticMarkup(
      <EvidenceScreen operator={mismatchedReviewOperator()} />
    );

    expect(markup).toContain("review-evaluation");
    expect(markup).not.toContain("selected-evaluation");
  });

  it("renders the active Trading review provenance packet", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.review_packet.provenance = {
      market_data_source: "binance_production_public_websocket",
      latest_public_execution_source: "rest_fallback",
      latest_public_execution_freshness: "stale",
      latest_public_execution_ws_connected: false,
      latest_public_execution_rest_fallback_used: true,
      latest_public_execution_stream_marker: "review-stream-marker",
      latest_fill_status: "partially_filled",
      order_book: {
        sync_status: "recovering",
        last_update_id: "order-book-update-42",
        previous_final_update_id: "order-book-update-40",
        gap_detected: true,
        depth_level_count: 12,
        authority_status: "read_only"
      }
    };

    const markup = renderToStaticMarkup(
      <EvidenceScreen operator={operator} />
    );

    expect(markup).toContain("Binance Production Public Websocket");
    expect(markup).toContain("Rest Fallback");
    expect(markup).toContain("Stale");
    expect(markup).toContain("Disconnected");
    expect(markup).toContain("Used");
    expect(markup).toContain("review-stream-marker");
    expect(markup).toContain("Partially Filled");
    expect(markup).toContain("Recovering");
    expect(markup).toContain("order-book-update-42");
    expect(markup).toContain("order-book-update-40");
    expect(markup).toContain("12 levels");
    expect(markup).toContain("Detected");
    expect(markup).toContain("Read Only");
  });

  it("uses the selected paper evaluation before a Trading review target exists", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.active_candidate_id = undefined;
    operator.selected_paper_trading_evaluation.profit_loss = {
      revenue_usdt: 100,
      cost_usdt: 9,
      net_revenue_usdt: 91,
      net_return_pct: 9.1
    };
    operator.selected_paper_trading_evaluation.latest_order_request_id = "selected-order";
    operator.selected_paper_trading_evaluation.latest_gateway_outcome = "selected-gateway";
    operator.selected_paper_trading_evaluation.latest_execution_status = "selected-execution";
    operator.trading_review.review_packet.performance.profit_loss = {
      revenue_usdt: 5,
      cost_usdt: 1,
      net_revenue_usdt: 4,
      net_return_pct: 0.4
    };
    operator.trading_review.review_packet.ledger = {
      evidence_status: "not_observed",
      ledger_chain_complete: false,
      authority_status: "not_live"
    };
    operator.paper_trading_board.entries = [{
      candidate_id: "selected-candidate",
      evaluation_id: "selected-evaluation",
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["failed_observation_ratio_exceeded"],
      blocker_density: {
        top_blocker: "failed_observation_ratio_exceeded"
      }
    }] as never;

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
    expect(tradingMarkup).toContain("91.00 USDT");
    expect(tradingMarkup).not.toContain("4.00 USDT");
    expect(tradingMarkup).toContain("Blocked By Quality");
    expect(tradingMarkup).toContain("Failed Observation Ratio Exceeded");
    expect(tradingMarkup).toContain("Chain complete");
    expect(evidenceMarkup).toContain("selected-order");
    expect(evidenceMarkup).toContain("selected-gateway");
    expect(evidenceMarkup).toContain("selected-execution");
  });

  it("allows a persisted running paper evaluation to be stopped while its runner needs resume", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.paper_trading_evaluation.status = "running";
    operator.trading_review.paper_trading_evaluation.runner_active = false;
    operator.trading_review.review_packet.runner.runner_status = "needs_resume";
    operator.trading_review.review_packet.runner.runner_active = false;

    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );
    const stopButton = Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g))
      .map((match) => match[0])
      .find((button) => button.includes("Stop"));

    expect(stopButton).toBeDefined();
    expect(stopButton).not.toContain(' disabled=""');
  });

  it("allows an active review persisted paper evaluation to resume only when its runner needs resume", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.paper_trading_evaluation.status = "running";
    operator.trading_review.paper_trading_evaluation.runner_active = false;
    operator.trading_review.review_packet.runner.runner_status = "needs_resume";
    operator.trading_review.review_packet.runner.runner_active = false;

    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );
    const resumeButton = Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g))
      .map((match) => match[0])
      .find((button) => button.includes("Resume paper"));

    expect(resumeButton).toBeDefined();
    expect(resumeButton).not.toContain(' disabled=""');
    expect(resumeButton).toContain("Resume the persisted exact review TradingRun");
  });

  it("renders actionable blocker-group details for the active Trading review", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.review_packet.evidence_quality.blocker_groups = [{
      group_kind: "observation_quality",
      severity: "blocked",
      blockers: ["failed_observation_ratio_exceeded"],
      summary: "Too many paper observations failed.",
      next_action: "Stabilize the runner before collecting more evidence."
    }];

    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Review blocker groups");
    expect(markup).toContain("Observation Quality");
    expect(markup).toContain("Failed Observation Ratio Exceeded");
    expect(markup).toContain("Too many paper observations failed.");
    expect(markup).toContain("Stabilize the runner before collecting more evidence.");
  });

  it("renders the shared first-viewport recommendation from the active review packet", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.review_packet.next_action =
      "Open the active Trading review candidate before running Trading controls.";
    operator.trading_review.review_packet.verdict.severity = "mismatch";
    operator.trading_review.review_packet.verdict.top_blocker = "arena_selection_mismatch";

    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Recommended action");
    expect(markup).toContain("Open the active Trading review candidate before running Trading controls.");
    expect(markup).toContain("mismatch / arena_selection_mismatch / runner inactive / selected target mismatch");
  });

  it("renders account, position, order, fill, and failure context from the review packet risk", () => {
    const operator = mismatchedReviewOperator();
    operator.trading_review.review_packet.risk = {
      open_order_count: 2,
      account: {
        equity_usdt: "1004",
        available_balance_usdt: "900",
        wallet_balance_usdt: "1000",
        margin_reserved_usdt: "100",
        authority_status: "not_live"
      },
      position: {
        symbol: "BTCUSDT",
        side: "long",
        quantity: "0.01",
        notional_usdt: "600",
        average_entry_price: "59000",
        mark_price: "60000",
        authority_status: "not_live"
      },
      latest_fill_status: "partially_filled",
      latest_failure_reason: "risk-check-lag",
      latest_failure: {
        failure_kind: "risk_rejection",
        reason: "risk-check-lag",
        summary: "Risk readback lagged the latest fill.",
        next_action: "Refresh paper risk before another observation.",
        authority_status: "not_live"
      }
    };

    const markup = renderToStaticMarkup(
      <TradingScreen
        operator={operator}
        commandRunning={false}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Paper risk");
    expect(markup).toContain("1004 USDT");
    expect(markup).toContain("900 USDT");
    expect(markup).toContain("Long 0.01 BTCUSDT");
    expect(markup).toContain("600 USDT");
    expect(markup).toContain("Partially Filled");
    expect(markup).toContain("Risk readback lagged the latest fill.");
    expect(markup).toContain("Refresh paper risk before another observation.");
  });

  it("renders the shared remediation pointer for failed commands", () => {
    const operator = mismatchedReviewOperator();
    operator.latest_commands = [{
      command_id: "command-1",
      command_kind: "trading_candidate.promote",
      status: "failed",
      requested_at: "2026-07-18T00:00:00.000Z",
      completed_at: "2026-07-18T00:00:01.000Z",
      error: "paper_qualification_required",
      authority_status: "not_live"
    }];

    const markup = renderToStaticMarkup(<EvidenceScreen operator={operator} />);

    expect(markup).toContain("paper_qualification_required");
    expect(markup).toContain("Review Trading review packet, Paper Board");
    expect(markup).toContain("Review the Trading review packet blockers and Paper Board qualification before retrying promotion.");
  });
});
