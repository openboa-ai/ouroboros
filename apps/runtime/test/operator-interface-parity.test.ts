import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
      "arena.cycle",
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

  it("documents every primary product-loop command in the interface parity guide", () => {
    const interfaceParityDoc = readFileSync(new URL("../../../docs/interface-parity.md", import.meta.url), "utf8");
    const productLoopCommandList = interfaceParityDoc.slice(
      interfaceParityDoc.indexOf("`packages/domain` marks the primary loop subset"),
      interfaceParityDoc.indexOf("These are the commands that must stay visible")
    );
    const documentedCommandKinds = [...productLoopCommandList.matchAll(/- `([^`]+)`/g)]
      .map((match) => match[1]);

    expect(documentedCommandKinds).toEqual([...OUROBOROS_PRODUCT_LOOP_COMMAND_KINDS]);
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
      { args: ["arena", "cycle"], request: { command_kind: "arena.cycle" } },
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
    expect(operatorTuiCommandForAction("cycle", runningOperator, 0)).toEqual({
      command_kind: "arena.cycle"
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
      research_generalization: {
        status: "not_started",
        protocol_count: 0,
        outcome_count: 0,
        active_protocol: null,
        latest_outcome: null,
        latest_policy_decision: null,
        effective_policy_decision: null,
        authority_status: "not_promotion_authority"
      },
      research_population_diversity: {
        protocol_version: "research_population_diversity_v1",
        window_tick_count: 0,
        assigned_directions: {
          measurement_status: "insufficient_evidence",
          sample_count: 0,
          unique_count: 0,
          entropy_bits: 0,
          normalized_entropy: 0
        },
        observed_behaviors: {
          measurement_status: "insufficient_evidence",
          sample_count: 0,
          unique_count: 0,
          entropy_bits: 0,
          normalized_entropy: 0,
          cohort_count: 0,
          admitted_submission_count: 0,
          exact_behavior_duplicate_count: 0,
          artifact_duplicate_count: 0,
          unavailable_fingerprint_count: 0
        },
        by_direction: [],
        tick_series: [],
        evaluation_authority: false,
        promotion_authority: false,
        authority_status: "not_promotion_authority"
      },
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
    trading_review: {
      review_kind: "trading_review",
      status: "promoted_for_trading_review",
      readiness_status: "collecting_paper_evidence",
      active_candidate_id: "candidate-profitable",
      active_candidate_version_id: "candidate-version-profitable",
      display_name: "candidate-profitable",
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
        market_data_source: "binance_production_public_rest",
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
            failed_observation_count: 0
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
          market_data_source: "binance_production_public_rest"
        },
        risk: {
          open_order_count: 0
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
