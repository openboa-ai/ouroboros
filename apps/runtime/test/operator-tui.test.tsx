import React from "react";
import { renderToString } from "ink";
import { describe, expect, it } from "vitest";
import type { OperatorReadModel } from "@ouroboros/domain";
import {
  OperatorTuiScreen,
  operatorTuiActionForInput,
  operatorTuiCommandForAction
} from "../src/operator-tui";

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
    expect(output).toContain("> #1 candidate-profitable");
    expect(output).toContain("Paper evidence: ledger_chain_complete");
    expect(output).toContain("Codex: configured");
    expect(output).toContain("arena.tick: succeeded");
    expect(output).toContain("Keys: r refresh");
  });

  it("maps keyboard input to action console actions", () => {
    expect(operatorTuiActionForInput("r", {})).toBe("refresh");
    expect(operatorTuiActionForInput("t", {})).toBe("tick");
    expect(operatorTuiActionForInput("s", {})).toBe("toggle_running");
    expect(operatorTuiActionForInput("e", {})).toBe("run_paper_evidence");
    expect(operatorTuiActionForInput("p", {})).toBe("toggle_provider");
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
    expect(operatorTuiCommandForAction("run_paper_evidence", fixtureOperator(), 0)).toEqual({
      command_kind: "candidate.paper_evidence.run",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("toggle_provider", fixtureOperator(), 0)).toEqual({
      command_kind: "researcher.provider.select",
      payload: { provider: "codex" }
    });
  });
});

function fixtureOperator(): OperatorReadModel {
  return {
    operator_kind: "ouroboros_operator",
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
