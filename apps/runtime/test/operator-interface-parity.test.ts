import { describe, expect, it } from "vitest";
import {
  OUROBOROS_COMMAND_DESCRIPTORS,
  OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS,
  type OperatorReadModel,
  type OuroborosCommandRequest
} from "@ouroboros/domain";
import { parseOuroborosCliArgs, runOuroborosCli } from "@ouroboros/cli";
import { operatorTuiCommandForAction } from "@ouroboros/operator-tui";

describe("operator interface parity", () => {
  it("defines the product loop command surface as the shared interface contract", () => {
    expect(OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS).toEqual([
      "arena.status",
      "arena.start",
      "arena.stop",
      "arena.tick",
      "candidate.select",
      "trading_candidate.promote",
      "trading_run.start",
      "trading_run.observe",
      "trading_run.stop",
      "agent_provider.status",
      "agent_provider.setup",
      "agent_provider.login.start",
      "agent_provider.probe",
      "researcher.provider.select"
    ]);
  });

  it("maps CLI product loop actions to command requests or the managed local agent controller", async () => {
    const cliCommandCases: Array<{
      args: string[];
      request: OuroborosCommandRequest;
    }> = [
      { args: ["arena", "status"], request: { command_kind: "arena.status" } },
      { args: ["arena", "start"], request: { command_kind: "arena.start" } },
      { args: ["arena", "stop"], request: { command_kind: "arena.stop" } },
      { args: ["arena", "tick"], request: { command_kind: "arena.tick" } },
      {
        args: ["candidate", "select", "candidate-profitable"],
        request: {
          command_kind: "candidate.select",
          payload: { candidate_id: "candidate-profitable" }
        }
      },
      {
        args: ["candidate", "promote", "candidate-profitable"],
        request: {
          command_kind: "trading_candidate.promote",
          payload: { candidate_id: "candidate-profitable" }
        }
      },
      {
        args: ["candidate", "paper", "start", "candidate-profitable"],
        request: {
          command_kind: "trading_run.start",
          payload: { candidate_id: "candidate-profitable" }
        }
      },
      {
        args: ["trading-run", "observe", "trading-run-candidate-profitable"],
        request: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: "trading-run-candidate-profitable" }
        }
      },
      {
        args: ["trading-run", "stop", "trading-run-candidate-profitable"],
        request: {
          command_kind: "trading_run.stop",
          payload: { trading_run_id: "trading-run-candidate-profitable" }
        }
      },
      {
        args: ["researcher", "provider", "set", "codex"],
        request: {
          command_kind: "researcher.provider.select",
          payload: { provider: "codex" }
        }
      }
    ];

    for (const item of cliCommandCases) {
      expect(parseOuroborosCliArgs(item.args)).toEqual({
        mode: "command",
        request: item.request
      });
    }

    expect(parseOuroborosCliArgs(["agent", "status", "codex"])).toEqual({
      mode: "agent",
      action: "status",
      provider: "codex"
    });
    expect(parseOuroborosCliArgs(["agent", "setup", "codex"])).toMatchObject({
      mode: "agent",
      action: "setup",
      provider: "codex"
    });
    expect(parseOuroborosCliArgs(["agent", "login", "codex"])).toMatchObject({
      mode: "agent",
      action: "login",
      provider: "codex"
    });
    expect(parseOuroborosCliArgs(["agent", "probe", "codex"])).toMatchObject({
      mode: "agent",
      action: "probe",
      provider: "codex"
    });

    const result = await runOuroborosCli(["status"], {
      runtimeBaseUrl: "http://runtime.test",
      fetch: async (url) => {
        expect(String(url)).toBe("http://runtime.test/api/operator");
        return jsonResponse({ operator: fixtureOperator() });
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Ouroboros status");
  });

  it("maps TUI action-console controls to the same product loop commands", () => {
    const runningOperator = fixtureOperator();
    const stoppedOperator = {
      ...runningOperator,
      candidate_arena: {
        ...runningOperator.candidate_arena,
        runner_status: "stopped"
      }
    } satisfies OperatorReadModel;

    expect(operatorTuiCommandForAction("refresh", runningOperator, 0)).toBeUndefined();
    expect(operatorTuiCommandForAction("tick", runningOperator, 0)).toEqual({
      command_kind: "arena.tick"
    });
    expect(operatorTuiCommandForAction("toggle_running", runningOperator, 0)).toEqual({
      command_kind: "arena.stop"
    });
    expect(operatorTuiCommandForAction("toggle_running", stoppedOperator, 0)).toEqual({
      command_kind: "arena.start"
    });
    expect(operatorTuiCommandForAction("select_current", runningOperator, 0)).toEqual({
      command_kind: "candidate.select",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("promote_trading_candidate", runningOperator, 0)).toEqual({
      command_kind: "trading_candidate.promote",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("start_paper_trading", runningOperator, 0)).toEqual({
      command_kind: "trading_run.start",
      payload: { candidate_id: "candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("observe_paper_trading", runningOperator, 0)).toEqual({
      command_kind: "trading_run.observe",
      payload: { trading_run_id: "trading-run-candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("stop_paper_trading", runningOperator, 0)).toEqual({
      command_kind: "trading_run.stop",
      payload: { trading_run_id: "trading-run-candidate-profitable" }
    });
    expect(operatorTuiCommandForAction("toggle_provider", runningOperator, 0)).toEqual({
      command_kind: "researcher.provider.select",
      payload: { provider: "codex" }
    });
    expect(operatorTuiCommandForAction("setup_provider", runningOperator, 0)).toEqual({
      command_kind: "agent_provider.setup",
      payload: { provider: "fixture" }
    });
    expect(operatorTuiCommandForAction("start_provider_login", runningOperator, 0)).toEqual({
      command_kind: "agent_provider.login.start",
      payload: { provider: "fixture" }
    });
    expect(operatorTuiCommandForAction("probe_provider", runningOperator, 0)).toEqual({
      command_kind: "agent_provider.probe",
      payload: { provider: "fixture" }
    });
  });

});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function fixtureOperator(): OperatorReadModel {
  return {
    operator_kind: "ouroboros_operator",
    command_descriptors: OUROBOROS_COMMAND_DESCRIPTORS,
    candidate_arena: {
      arena_kind: "candidate_arena",
      runner_status: "running",
      tick_count: 3,
      active_researchers: [
        {
          researcher_id: "researcher-trend",
          direction_kind: "trend_following",
          status: "active",
          authority_status: "research_only"
        }
      ],
      leaderboard: [
        {
          rank: 1,
          candidate_id: "candidate-profitable",
          display_name: "candidate-profitable",
          direction_kind: "trend_following",
          parent_candidate_id: "candidate-parent",
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
      latest_gateway_outcome: "dry_run_only",
      latest_execution_status: "dry_run_recorded",
      authority_status: "not_live"
    },
    selected_paper_trading_evaluation: {
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
      latest_gateway_outcome: "dry_run_only",
      latest_execution_status: "dry_run_recorded",
      market_data_source: "binance_production_public_rest",
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
            failed_observation_count: 0
          },
          risk_summary: {
            open_order_count: 0
          },
          observation_count: 1,
          trading_run_id: "trading-run-candidate-profitable",
          profit_loss: {
            revenue_usdt: 5,
            cost_usdt: 0.048,
            net_revenue_usdt: 4.952,
            net_return_pct: 0.04952
          },
          market_data_source: "binance_production_public_rest",
          open_order_count: 0,
          authority_status: "not_live"
        }
      ],
      live_disabled: true,
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
