import React from "react";
import { renderToString } from "ink";
import { describe, expect, it } from "vitest";
import { OUROBOROS_COMMAND_DESCRIPTORS, type OperatorReadModel } from "@ouroboros/domain";
import {
  OperatorTuiScreen,
  operatorTuiActionForInput,
  operatorTuiCommandForAction
} from "@ouroboros/operator-tui";

describe("Operator TUI action console", () => {
  it("renders status, leaderboard, selected candidate, provider, and command log", () => {
    const output = renderToString(
      <OperatorTuiScreen
        operator={fixtureOperator()}
        cursor={0}
        message="arena.tick succeeded"
      />
    );

    expect(output).toContain("Ouroboros Action Console");
    expect(output).toContain("Arena: running / ticks 3");
    expect(output).toContain("Researcher provider: fixture");
    expect(output).toContain("Agent profile: Fixture / authenticated");
    expect(output).toContain("Operator authority: not_live / live disabled");
    expect(output).not.toContain("Authority: not_live / live disabled");
    expect(output).toContain("> #1 candidate-profitable");
    expect(output).toContain("Trading promotion: promoted_for_trading_review / collecting_paper_evidence");
    expect(output).toContain("Trading review: promoted_for_trading_review / candidate-profitable / selected");
    expect(output).toContain("matches");
    expect(output).toContain("Trading review packet: collecting / top min_observation_count_not_met / next");
    expect(output.indexOf("Trading review packet:")).toBeLessThan(
      output.indexOf("Trading promotion:")
    );
    expect(output).toContain("Continue paper trading until the evidence window qualifies.");
    expect(output).toContain("Review subject: candidate-profitable / promoted 2026-05-16T00:00:04.000Z /");
    expect(output).toContain("selected matches");
    expect(output).toContain("Review evidence window: 1 obs / 0 failed / 60000ms / first");
    expect(output).toContain("2026-05-16T00:00:03.000Z / last 2026-05-16T00:00:03.000Z");
    expect(output).toContain("Review blockers: evidence_window / collecting / min_observation_count_not_met");
    expect(output).toContain("min_elapsed_ms_not_met");
    expect(output).toContain("Paper evidence window is not mature enough for review.");
    expect(output).toContain("next Continue paper observations until count and elapsed-time gates qualify.");
    expect(output).toContain("Review authority: not_live / mlp_paper_only / live_exchange=false");
    expect(output).toContain("private_read=false, order_submission=false, credentials=false");
    expect(output).toContain("Review runner: active / run running / next 2026-05-16T00:01:03.000Z");
    expect(output).toContain("Review ledger: complete_chain / chain complete / gateway dry_run_only");
    expect(output).toContain("execution dry_run_recorded");
    expect(output).toContain("Review lineage: available / trend_following / parent candidate-parent");
    expect(output).toContain("Candidate produced non-negative net revenue after costs.");
    expect(output).toContain("Review lineage learning: rank #1 / collecting_evidence / 4.952 net USDT / 1 obs");
    expect(output).toContain("next Continue paper observations until count and elapsed-time gates qualify.");
    expect(output).toContain("Review provenance: binance_production_public_websocket / websocket_primary /");
    expect(output).toContain("fresh / WS connected / marker binance-ws-aggTrade-991 / fill filled / order book");
    expect(output).toContain("synced update 11");
    expect(output).toContain("Review risk: equity 10004.952 USDT / available 10003.652 USDT / position long");
    expect(output).toContain("0.001 BTCUSDT notional 65 / open 0 / fill filled");
    expect(output).toContain("dry_run_recorded");
    expect(output).toContain("Paper Trading Evaluation: running");
    expect(output).not.toContain("PaperTradingEvaluation:");
    expect(output).toContain("Paper Board");
    expect(output).toContain("#1 candidate-profitable 4.95 USDT / collecting_evidence / gate");
    expect(output).toContain("collecting_paper_evidence");
    expect(output).toContain("window 1 obs, 0 failed, 60000ms");
    expect(output).toContain("paper runner active, market provenance binance_production_public_websocket /");
    expect(output).toContain("websocket_primary, paper fill filled, paper open orders 0");
    expect(output).not.toContain("   runner active, market");
    expect(output).toContain("trend insufficient_history / delta 0.00 USDT / return 0.00% / 0 obs /");
    expect(output).toContain("not_promotion_authority; blockers 2 / density 2 / failed 0 / top");
    expect(output).toContain("min_observation_count_not_met / not_promotion_authority");
    expect(output).toContain("min_observation_count_not_met, min_elapsed_ms_not_met");
    expect(output).toContain("Paper runner: active / next 2026-05-16T00:01:03.000Z");
    expect(output).not.toContain("Runner: active / next 2026-05-16T00:01:03.000Z");
    expect(output).toContain("Paper score: 4.95 USDT / observations 1");
    expect(output).toContain("Paper market snapshot: BTCUSDT 65000.00 @ 2026-05-16T00:00:03.000Z");
    expect(output).not.toContain("Market: BTCUSDT 65000.00 @ 2026-05-16T00:00:03.000Z");
    expect(output).toContain("Gateway market data: binance_production_public_websocket");
    expect(output).not.toContain("Market data: binance_production_public_websocket");
    expect(output).toMatch(/Public execution evidence:\s+binance_production_public_websocket\s+\/\s+websocket_primary\s+\//);
    expect(output).not.toContain("Public execution: binance_production_public_websocket");
    expect(output).toContain("fresh / WS connected / marker binance-ws-aggTrade-991");
    expect(output).toContain("Public order book evidence: synced / update 11");
    expect(output).not.toContain("Order book: synced / update 11");
    expect(output).toContain("Paper decision: order_request buy limit 0.001 @ 65000");
    expect(output).toContain("Paper account: equity 10004.952 USDT / long 0.001 BTCUSDT / open 0");
    expect(output).toContain("Paper fill: filled 0.001 @ 60000 / trade agg-60000-001");
    expect(output).not.toContain("Decision: order_request buy limit 0.001 @ 65000");
    expect(output).not.toContain("Account: equity 10004.952 USDT / long 0.001 BTCUSDT / open 0");
    expect(output).not.toContain("Fill: filled 0.001 @ 60000 / trade agg-60000-001");
    expect(output).toContain("Paper ledger chain: complete");
    expect(output).not.toContain("Ledger chain: complete");
    expect(output).toContain("Latest Ticks");
    expect(output).toContain("tick-1 / completed / 1 created / 1 failed / not_live");
    expect(output).toContain("evaluated_arena_leader -> candidate-parent");
    expect(output).toContain("Parent Trading System");
    expect(output).toContain("9.83 USDT");
    expect(output).toContain("trend_following:created -> candidate-profitable");
    expect(output).toContain("mean_reversion:failed ->");
    expect(output).toContain("fixture direction failed");
    expect(output).toContain("trend_following: 6 provider / 0 runner / 2 scenarios / 1000ms /");
    expect(output).toContain("not_promotion_authority");
    expect(output).toContain("Codex: configured");
    expect(output).toContain("arena.tick: succeeded");
    expect(output).toContain("Keys: r refresh");
  });

  it("points failed promotion commands back to visible blocker surfaces", () => {
    const operator = fixtureOperator();
    operator.latest_commands = [{
      command_id: "command-promote-failed",
      command_kind: "trading_candidate.promote",
      status: "failed",
      requested_at: "2026-05-27T00:00:00.000Z",
      completed_at: "2026-05-27T00:00:01.000Z",
      error: "paper_trading_qualification_required",
      authority_status: "not_live"
    }];

    const output = renderToString(
      <OperatorTuiScreen
        operator={operator}
        cursor={0}
      />
    );

    expect(output).toContain("trading_candidate.promote: failed / paper_trading_qualification_required");
    expect(output).toContain("Trading review promotion");
    expect(output).toContain("Trading review packet, Paper Board");
    expect(output).toContain("Review the Trading review packet blockers and Paper Board qualification before");
    expect(output).toContain("retrying promotion.");
    expect(output).toContain("not_live");
  });

  it("renders classified paper failure remediation before raw failure text", () => {
    const operator = fixtureOperator();
    operator.selected_paper_trading_evaluation.latest_failure_reason = "fake public execution stream unavailable";
    operator.selected_paper_trading_evaluation.latest_failure = {
      failure_kind: "public_execution_evidence_gap",
      reason: "fake public execution stream unavailable",
      summary: "Paper fill or execution evidence could not be tied to public execution data.",
      next_action: "Restore public execution evidence before trusting fills or paper score.",
      authority_status: "not_live"
    };
    const output = renderToString(
      <OperatorTuiScreen
        operator={operator}
        cursor={0}
      />
    );

    expect(output).toContain("Failure: public_execution_evidence_gap");
    expect(output).toContain("Paper fill or execution evidence could");
    expect(output).toContain("not be tied to public execution data.");
    expect(output).toContain("Restore public execution evidence");
    expect(output).toContain("raw fake public execution stream");
  });

  it("renders a restart recovery hint when a persisted paper evaluation needs resume", () => {
    const operator = fixtureOperator();
    operator.selected_paper_trading_evaluation = {
      ...operator.selected_paper_trading_evaluation,
      status: "running",
      runner_active: false
    };

    const output = renderToString(
      <OperatorTuiScreen
        operator={operator}
        cursor={0}
      />
    );

    expect(output).toContain("Paper Trading Evaluation: running");
    expect(output).not.toContain("PaperTradingEvaluation:");
    expect(output).toContain("Paper runner: needs resume / persisted running, timer inactive / next");
    expect(output).not.toContain("Runner: needs resume / persisted running, timer inactive / next");
  });

  it("maps keyboard input to action console actions", () => {
    expect(operatorTuiActionForInput("r", {})).toBe("refresh");
    expect(operatorTuiActionForInput("t", {})).toBe("tick");
    expect(operatorTuiActionForInput("s", {})).toBe("toggle_running");
    expect(operatorTuiActionForInput("m", {})).toBe("promote_trading_candidate");
    expect(operatorTuiActionForInput("e", {})).toBe("start_paper_trading");
    expect(operatorTuiActionForInput("o", {})).toBe("observe_paper_trading");
    expect(operatorTuiActionForInput("x", {})).toBe("stop_paper_trading");
    expect(operatorTuiActionForInput("p", {})).toBe("toggle_provider");
    expect(operatorTuiActionForInput("a", {})).toBe("setup_provider");
    expect(operatorTuiActionForInput("l", {})).toBe("start_provider_login");
    expect(operatorTuiActionForInput("v", {})).toBe("probe_provider");
    expect(operatorTuiActionForInput("", { upArrow: true })).toBe("select_previous");
    expect(operatorTuiActionForInput("", { downArrow: true })).toBe("select_next");
    expect(operatorTuiActionForInput("", { return: true })).toBe("select_current");
    expect(operatorTuiActionForInput("q", {})).toBe("quit");
  });

  it("keeps the selected cursor visible when the leaderboard has more rows than the TUI window", () => {
    const operator = fixtureOperator();
    operator.candidate_arena.leaderboard = Array.from({ length: 10 }, (_, index) => ({
      ...operator.candidate_arena.leaderboard[0],
      rank: index + 1,
      candidate_id: `candidate-${index + 1}`,
      display_name: `candidate-${index + 1}`
    }));

    const output = renderToString(
      <OperatorTuiScreen
        operator={operator}
        cursor={9}
      />
    );

    expect(output).toContain("> #10 candidate-10");
    expect(output).not.toContain("#1 candidate-1");
  });

  it("dispatches runtime commands for TUI actions", () => {
    expect(operatorTuiCommandForAction("tick", fixtureOperator(), 0)).toEqual({
      command_kind: "arena.tick"
    });
    expect(operatorTuiCommandForAction("toggle_running", fixtureOperator(), 0)).toEqual({
      command_kind: "arena.stop"
    });
    expect(operatorTuiCommandForAction("select_current", fixtureOperator(), 0)).toEqual({
      command_kind: "candidate.select",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("promote_trading_candidate", fixtureOperator(), 0)).toEqual({
      command_kind: "trading_candidate.promote",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("start_paper_trading", fixtureOperator(), 0)).toEqual({
      command_kind: "trading_run.start",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("observe_paper_trading", fixtureOperator(), 0)).toEqual({
      command_kind: "trading_run.observe",
      payload: { trading_run_id: "trading-run-candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("stop_paper_trading", fixtureOperator(), 0)).toEqual({
      command_kind: "trading_run.stop",
      payload: { trading_run_id: "trading-run-candidate-profitable" }
    });
    const mismatchOperator: OperatorReadModel = {
      ...fixtureOperator(),
      selected_candidate_id: "candidate-other",
      selected_paper_trading_evaluation: {
        ...fixtureOperator().selected_paper_trading_evaluation,
        trading_run_id: "trading-run-candidate-other"
      },
      trading_review: {
        ...fixtureOperator().trading_review,
        selected_candidate_id: "candidate-other",
        selected_matches_trading_review: false,
        paper_trading_evaluation: {
          ...fixtureOperator().trading_review.paper_trading_evaluation,
          trading_run_id: "trading-run-promoted-review"
        }
      }
    };
    expect(operatorTuiCommandForAction("observe_paper_trading", mismatchOperator, 0)).toEqual({
      command_kind: "trading_run.observe",
      payload: { trading_run_id: "trading-run-promoted-review" }
    });
    expect(operatorTuiCommandForAction("stop_paper_trading", mismatchOperator, 0)).toEqual({
      command_kind: "trading_run.stop",
      payload: { trading_run_id: "trading-run-promoted-review" }
    });
    expect(operatorTuiCommandForAction("toggle_provider", fixtureOperator(), 0)).toEqual({
      command_kind: "researcher.provider.select",
      payload: { provider: "codex" }
    });
    expect(operatorTuiCommandForAction("setup_provider", fixtureOperator(), 0)).toEqual({
      command_kind: "agent_provider.setup",
      payload: { provider: "fixture" }
    });
    expect(operatorTuiCommandForAction("start_provider_login", fixtureOperator(), 0)).toEqual({
      command_kind: "agent_provider.login.start",
      payload: { provider: "fixture" }
    });
    expect(operatorTuiCommandForAction("probe_provider", fixtureOperator(), 0)).toEqual({
      command_kind: "agent_provider.probe",
      payload: { provider: "fixture" }
    });
  });
});

function fixtureOperator(): OperatorReadModel {
  return {
    operator_kind: "ouroboros_operator",
    command_descriptors: OUROBOROS_COMMAND_DESCRIPTORS,
    candidate_arena: {
      arena_kind: "candidate_arena",
      runner_status: "running",
      tick_count: 3,
      active_researchers: [],
      leaderboard: [
        {
          rank: 1,
          candidate_id: "candidate-profitable",
          display_name: "candidate-profitable",
          direction_kind: "trend_following",
          status: "accepted",
          latest_finding: "Positive revenue after cost.",
          profit_loss: {
            revenue_usdt: 12,
            cost_usdt: 2.17,
            net_revenue_usdt: 9.83,
            net_return_pct: 0.0983
          },
          authority_status: "not_live"
        }
      ],
      latest_candidates: [],
      latest_ticks: [
        {
          tick_id: "tick-1",
          started_at: "2026-05-24T00:00:00.000Z",
          completed_at: "2026-05-24T00:00:01.000Z",
          status: "completed",
          source_candidate: {
            source_kind: "evaluated_arena_leader",
            candidate_id: "candidate-parent",
            display_name: "Parent Trading System",
            net_revenue_usdt: 9.83,
            authority_status: "not_live"
          },
          created_candidate_ids: ["candidate-profitable"],
          direction_results: [
            {
              direction_kind: "trend_following",
              status: "created",
              candidate_id: "candidate-profitable",
              finding: "Positive revenue after cost.",
              net_revenue_usdt: 9.83,
              research_efficiency: {
                provider_request_total: 6,
                runner_command_total: 0,
                scenario_count: 2,
                elapsed_ms: 1000,
                authority_status: "not_promotion_authority"
              }
            },
            {
              direction_kind: "mean_reversion",
              status: "failed",
              error: "fixture direction failed"
            }
          ],
          authority_status: "not_live"
        }
      ],
      finding_clusters: [],
      live_disabled: true,
      authority_status: "not_live"
    },
    selected_candidate_id: "candidate-profitable",
    selected_candidate: null,
    selected_paper_evidence: {
      status: "ledger_chain_complete",
      ledger_chain_complete: true,
      ledger_chain_count: 1,
      authority_status: "not_live"
    },
    selected_paper_trading_evaluation: {
      evaluation_kind: "paper_trading_evaluation",
      status: "running",
      trading_run_id: "trading-run-candidate-profitable",
      trading_run_status: "running",
      runner_active: true,
      next_observation_at: "2026-05-16T00:01:03.000Z",
      observation_count: 1,
      ledger_chain_complete: true,
      profit_loss: {
        revenue_usdt: 5,
        cost_usdt: 0.048,
        net_revenue_usdt: 4.952,
        net_return_pct: 0.04952
      },
      latest_gateway_outcome: "dry_run_only",
      latest_execution_status: "dry_run_recorded",
      latest_market_snapshot: {
        symbol: "BTCUSDT",
        price: 65_000,
        moving_average_fast: 65_025,
        moving_average_slow: 64_975,
        volatility: 0.001,
        expected_direction: "long",
        observed_at: "2026-05-16T00:00:03.000Z",
        source_kind: "binance_production_public_rest",
        authority_status: "read_only"
      },
      latest_decision: {
        decision_kind: "order_request",
        source_kind: "trading_system_decision",
        reason: "trading_system_order_request",
        observed_at: "2026-05-16T00:00:03.000Z",
        order_request: {
          intent_kind: "place_order",
          symbol: "BTCUSDT",
          side: "buy",
          order_type: "limit",
          quantity: "0.001",
          limit_price: "65000"
        },
        authority_status: "trace_only"
      },
      paper_account_snapshot: {
        wallet_balance_usdt: "9999.952",
        available_balance_usdt: "10003.652",
        equity_usdt: "10004.952",
        realized_pnl_usdt: "0",
        unrealized_pnl_usdt: "5",
        fee_paid_usdt: "0.024",
        slippage_paid_usdt: "0.018",
        funding_paid_usdt: "0.006",
        margin_reserved_usdt: "1.3",
        position: {
          symbol: "BTCUSDT",
          quantity: "0.001",
          side: "long",
          average_entry_price: "60000",
          mark_price: "65000",
          notional_usdt: "65"
        },
        open_order_count: 0,
        authority_status: "not_live"
      },
      open_orders: [],
      latest_fill: {
        fill_id: "paper-fill-order-1-fill-1",
        order_id: "paper-order-1",
        fill_status: "filled",
        fill_price: "60000",
        fill_quantity: "0.001",
        fee_usdt: "0.024",
        slippage_usdt: "0.018",
        funding_usdt: "0.006",
        trade_time: "2026-05-16T00:00:03.500Z",
        source_trade_id: "agg-60000-001"
      },
      latest_public_execution_snapshot: {
        symbol: "BTCUSDT",
        observed_at: "2026-05-16T00:00:03.000Z",
        source_kind: "binance_production_public_websocket",
        source_priority: "websocket_primary",
        freshness: "fresh",
        ws_connected: true,
        rest_fallback_used: false,
        gap_detected: false,
        last_update_id: "11",
        stream_marker: "binance-ws-aggTrade-991",
        agg_trades: [],
        order_book: {
          symbol: "BTCUSDT",
          observed_at: "2026-05-16T00:00:03.000Z",
          source_kind: "binance_production_public_hybrid",
          sync_status: "synced",
          last_update_id: "11",
          top_bid_price: "64999.9",
          top_bid_quantity: "1.2",
          top_ask_price: "65000.1",
          top_ask_quantity: "1.1",
          gap_detected: false,
          authority_status: "read_only"
        },
        authority_status: "read_only"
      },
      market_data_source: "binance_production_public_websocket",
      account_provider: "fake_paper_account",
      executor: "fake_paper_order_executor",
      score_source: "paper_trading_engine",
      authority_status: "not_live"
    },
    paper_trading_board: {
      board_kind: "paper_trading_board",
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      evaluation_authority: "continuous_paper_trading",
      entries: [
        {
          rank: 1,
          candidate_id: "candidate-profitable",
          display_name: "candidate-profitable",
          evaluation_id: "paper-evaluation-candidate-profitable",
          status: "running",
          runner_status: "active",
          promotion_gate_status: "collecting_paper_evidence",
          qualification_status: "collecting_evidence",
          qualification_reasons: [
            "min_observation_count_not_met",
            "min_elapsed_ms_not_met"
          ],
          evidence_window: {
            observation_count: 1,
            elapsed_ms: 60_000,
            failed_observation_count: 0,
            first_observed_at: "2026-05-16T00:00:03.000Z",
            last_observed_at: "2026-05-16T00:00:03.000Z"
          },
          risk_summary: {
            open_order_count: 0,
            latest_fill_status: "filled"
          },
          trend: {
            direction: "insufficient_history",
            net_revenue_delta_usdt: 0,
            net_return_delta_pct: 0,
            observation_count_delta: 0,
            authority_status: "not_promotion_authority"
          },
          blocker_density: {
            blocker_count: 2,
            blocker_density: 2,
            failed_observation_ratio: 0,
            top_blocker: "min_observation_count_not_met",
            authority_status: "not_promotion_authority"
          },
          observation_count: 1,
          trading_run_id: "trading-run-candidate-profitable",
          last_observed_at: "2026-05-16T00:00:03.000Z",
          next_observation_at: "2026-05-16T00:01:03.000Z",
          profit_loss: {
            revenue_usdt: 5,
            cost_usdt: 0.048,
            net_revenue_usdt: 4.952,
            net_return_pct: 0.04952
          },
          market_data_source: "binance_production_public_websocket",
          latest_public_execution_source: "websocket_primary",
          latest_fill_status: "filled",
          open_order_count: 0,
          authority_status: "not_live"
        }
      ],
      live_disabled: true,
      authority_status: "not_live"
    },
    trading_promotion: {
      promotion_kind: "trading_promotion",
      status: "promoted_for_trading_review",
      readiness_status: "collecting_paper_evidence",
      candidate_id: "candidate-profitable",
      candidate_version_id: "candidate-version-profitable",
      display_name: "candidate-profitable",
      promoted_at: "2026-05-16T00:00:04.000Z",
      paper_trading_evaluation_id: "paper-evaluation-candidate-profitable",
      paper_qualification_status: "collecting_evidence",
      paper_qualification_reasons: [
        "min_observation_count_not_met",
        "min_elapsed_ms_not_met"
      ],
      paper_evidence_window: {
        observation_count: 1,
        elapsed_ms: 60_000,
        failed_observation_count: 0,
        first_observed_at: "2026-05-16T00:00:03.000Z",
        last_observed_at: "2026-05-16T00:00:03.000Z"
      },
      paper_profit_loss: {
        revenue_usdt: 5,
        cost_usdt: 0.048,
        net_revenue_usdt: 4.952,
        net_return_pct: 0.04952
      },
      runner_status: "active",
      next_action: "Continue paper trading until the evidence window qualifies.",
      live_disabled_reason: "mlp_paper_only",
      authority_status: "not_live"
    },
    trading_review: {
      review_kind: "trading_review",
      status: "promoted_for_trading_review",
      readiness_status: "collecting_paper_evidence",
      active_candidate_id: "candidate-profitable",
      active_candidate_version_id: "candidate-version-profitable",
      display_name: "candidate-profitable",
      promoted_at: "2026-05-16T00:00:04.000Z",
      paper_trading_evaluation_id: "paper-evaluation-candidate-profitable",
      paper_qualification_status: "collecting_evidence",
      paper_qualification_reasons: [
        "min_observation_count_not_met",
        "min_elapsed_ms_not_met"
      ],
      paper_evidence_window: {
        observation_count: 1,
        elapsed_ms: 60_000,
        failed_observation_count: 0
      },
      paper_profit_loss: {
        revenue_usdt: 5,
        cost_usdt: 0.048,
        net_revenue_usdt: 4.952,
        net_return_pct: 0.04952
      },
      paper_trading_evaluation: {
        evaluation_kind: "paper_trading_evaluation",
        status: "running",
        trading_run_id: "trading-run-candidate-profitable",
        trading_run_status: "running",
        runner_active: true,
        observation_count: 1,
        ledger_chain_complete: true,
        profit_loss: {
          revenue_usdt: 5,
          cost_usdt: 0.048,
          net_revenue_usdt: 4.952,
          net_return_pct: 0.04952
        },
        market_data_source: "binance_production_public_websocket",
        account_provider: "fake_paper_account",
        executor: "fake_paper_order_executor",
        score_source: "paper_trading_engine",
        authority_status: "not_live"
      },
      runner_status: "active",
      selected_candidate_id: "candidate-profitable",
      selected_matches_trading_review: true,
      review_packet: {
        packet_kind: "trading_review_packet",
        verdict: {
          readiness_status: "collecting_paper_evidence",
          qualification_status: "collecting_evidence",
          severity: "collecting",
          top_blocker: "min_observation_count_not_met"
        },
        subject: {
          candidate_id: "candidate-profitable",
          candidate_version_id: "candidate-version-profitable",
          display_name: "candidate-profitable",
          paper_trading_evaluation_id: "paper-evaluation-candidate-profitable",
          promoted_at: "2026-05-16T00:00:04.000Z",
          selected_candidate_id: "candidate-profitable",
          selected_matches_trading_review: true
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
            failed_observation_count: 0,
            first_observed_at: "2026-05-16T00:00:03.000Z",
            last_observed_at: "2026-05-16T00:00:03.000Z"
          },
          qualification_reasons: [
            "min_observation_count_not_met",
            "min_elapsed_ms_not_met"
          ],
          blocker_groups: [
            {
              group_kind: "evidence_window",
              severity: "collecting",
              blockers: [
                "min_observation_count_not_met",
                "min_elapsed_ms_not_met"
              ],
              summary: "Paper evidence window is not mature enough for review.",
              next_action: "Continue paper observations until count and elapsed-time gates qualify."
            }
          ]
        },
        provenance: {
          market_data_source: "binance_production_public_websocket",
          latest_public_execution_source: "websocket_primary",
          latest_public_execution_freshness: "fresh",
          latest_public_execution_ws_connected: true,
          latest_public_execution_rest_fallback_used: false,
          latest_public_execution_stream_marker: "binance-ws-aggTrade-991",
          latest_fill_status: "filled",
          order_book: {
            sync_status: "synced",
            last_update_id: "11",
            gap_detected: false,
            authority_status: "read_only"
          }
        },
        risk: {
          open_order_count: 0,
          account: {
            equity_usdt: "10004.952",
            available_balance_usdt: "10003.652",
            wallet_balance_usdt: "9999.952",
            margin_reserved_usdt: "1.3",
            authority_status: "not_live"
          },
          position: {
            symbol: "BTCUSDT",
            side: "long",
            quantity: "0.001",
            notional_usdt: "65",
            average_entry_price: "60000",
            mark_price: "65000",
            authority_status: "not_live"
          },
          latest_fill_status: "filled"
        },
        runner: {
          runner_status: "active",
          runner_active: true,
          trading_run_status: "running",
          next_observation_at: "2026-05-16T00:01:03.000Z",
          authority_status: "not_live"
        },
        ledger: {
          evidence_status: "complete_chain",
          ledger_chain_complete: true,
          latest_gateway_outcome: "dry_run_only",
          latest_execution_status: "dry_run_recorded",
          latest_decision_kind: "order_request",
          authority_status: "not_live"
        },
        lineage: {
          lineage_status: "available",
          direction_kind: "trend_following",
          parent_candidate_id: "candidate-parent",
          parent_candidate_version_id: "candidate-version-parent",
          generated_by_agent: true,
          latest_finding: "Candidate produced non-negative net revenue after costs.",
          evaluation_status: "accepted",
          evaluation_score: 9.83,
          paper_board_learning: {
            rank: 1,
            net_revenue_usdt: 4.952,
            net_return_pct: 0.04952,
            observation_count: 1,
            qualification_status: "collecting_evidence",
            qualification_reasons: [
              "min_observation_count_not_met",
              "min_elapsed_ms_not_met"
            ],
            top_blocker: "min_observation_count_not_met",
            summary: "Paper board rank #1: 4.952 net_revenue_usdt, 0.04952 net_return_pct, 1 observations, collecting_evidence.",
            next_research_focus: "Continue paper observations until count and elapsed-time gates qualify.",
            authority_status: "lineage_only"
          },
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
        next_action: "Continue paper trading until the evidence window qualifies."
      },
      next_action: "Continue paper trading until the evidence window qualifies.",
      live_disabled_reason: "mlp_paper_only",
      authority_status: "not_live"
    },
    researcher_provider: {
      selected_provider: "fixture",
      available_providers: ["codex", "fixture"],
      authority_status: "research_only"
    },
    agent_profiles: [
      {
        profile_id: "codex",
        label: "Codex",
        provider: "codex",
        status: "configured",
        managed_home: "/tmp/ouroboros/agent-profiles/codex/home",
        managed_provider_home: "/tmp/ouroboros/agent-profiles/codex/codex-home",
        authority_status: "no_trading_authority"
      },
      {
        profile_id: "fixture",
        label: "Fixture",
        provider: "fixture",
        status: "authenticated",
        managed_home: "/tmp/ouroboros/agent-profiles/fixture/home",
        managed_provider_home: "/tmp/ouroboros/agent-profiles/fixture/codex-home",
        authority_status: "no_trading_authority"
      }
    ],
    latest_commands: [
      {
        command_id: "command-1",
        command_kind: "arena.tick",
        status: "succeeded",
        requested_at: "2026-05-27T00:00:00.000Z",
        completed_at: "2026-05-27T00:00:01.000Z",
        authority_status: "not_live"
      }
    ],
    live_disabled: true,
    authority_status: "not_live"
  };
}
