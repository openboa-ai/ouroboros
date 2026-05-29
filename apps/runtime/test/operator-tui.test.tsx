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
    expect(output).toContain("> #1 candidate-profitable");
    expect(output).toContain("PaperTradingEvaluation: running");
    expect(output).toContain("Runner: active / next 2026-05-16T00:01:03.000Z");
    expect(output).toContain("Paper score: 4.95 USDT / observations 1");
    expect(output).toContain("Market: BTCUSDT 65000.00 @ 2026-05-16T00:00:03.000Z");
    expect(output).toContain("Decision: order_request buy limit 0.001 @ 65000");
    expect(output).toContain("Codex: configured");
    expect(output).toContain("arena.tick: succeeded");
    expect(output).toContain("Keys: r refresh");
  });

  it("maps keyboard input to action console actions", () => {
    expect(operatorTuiActionForInput("r", {})).toBe("refresh");
    expect(operatorTuiActionForInput("t", {})).toBe("tick");
    expect(operatorTuiActionForInput("s", {})).toBe("toggle_running");
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
      latest_ticks: [],
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
        reason: "long_market_snapshot",
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
      market_data_source: "binance_production_public_rest",
      account_provider: "fake_paper_account",
      executor: "fake_paper_order_executor",
      score_source: "paper_gateway_ledger",
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
