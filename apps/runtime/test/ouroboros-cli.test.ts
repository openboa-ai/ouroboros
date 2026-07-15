import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OUROBOROS_COMMAND_DESCRIPTORS, type OperatorReadModel } from "@ouroboros/domain";
import { parseOuroborosCliArgs, runOuroborosCli } from "@ouroboros/cli";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-cli-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("ouroboros CLI", () => {
  it("maps product-facing arena commands to the shared command endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const result = await runOuroborosCli(["arena", "tick"], {
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
          command: {
            command_id: "command-1",
            command_kind: "arena.tick",
            status: "succeeded"
          },
          result: {
            created_candidate_count: 1
          },
          operator: fixtureOperator()
        });
      },
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: "http://runtime.test/api/commands",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command_kind: "arena.tick" })
      }
    });
    expect(result.stdout).toContain("OK arena.tick succeeded.");
    expect(result.stdout).toContain("Ouroboros status");
    expect(result.stdout).toContain("Researcher provider: fixture");
  });

  it("adds the operator API token header to runtime command calls when configured", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const result = await runOuroborosCli(["arena", "tick"], {
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
          command: {
            command_id: "command-1",
            command_kind: "arena.tick",
            status: "succeeded"
          },
          operator: fixtureOperator()
        });
      },
      runtimeBaseUrl: "http://runtime.test",
      operatorApiToken: "cli-token"
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://runtime.test/api/commands");
    expect(new Headers(calls[0]?.init?.headers).get("content-type")).toBe("application/json");
    expect(new Headers(calls[0]?.init?.headers).get("x-ouroboros-operator-token")).toBe("cli-token");
  });

  it("returns machine-readable command output with --json", async () => {
    const result = await runOuroborosCli(["arena", "tick", "--json"], {
      fetch: async () => jsonResponse({
        command: {
          command_id: "command-1",
          command_kind: "arena.tick",
          status: "succeeded"
        },
        result: {
          created_candidate_count: 1
        },
        operator: fixtureOperator()
      }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: {
        command_kind: "arena.tick",
        status: "succeeded"
      },
      operator: {
        researcher_provider: {
          selected_provider: "fixture"
        }
      }
    });
  });

  it("formats operator status as the default CLI surface", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const result = await runOuroborosCli(["status"], {
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({ operator: fixtureOperator() });
      },
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([{ url: "http://runtime.test/api/operator", init: undefined }]);
    expect(result.stdout).toContain("Ouroboros status");
    expect(result.stdout).toContain("Arena: running (3 ticks, 1 candidates)");
    expect(result.stdout).toContain("Latest tick: tick-1 / completed / 1 created / 1 failed / not_live");
    expect(result.stdout).toContain("Latest tick source: evaluated_arena_leader -> candidate-parent / Parent Trading System / 9.83 USDT / not_live");
    expect(result.stdout).toContain("Latest tick directions: trend_following:created -> candidate-profitable; mean_reversion:failed -> fixture direction failed");
    expect(result.stdout).toContain("Latest tick efficiency: trend_following: 6 provider / 0 runner / 2 scenarios / 1000ms / not_promotion_authority");
    expect(result.stdout).toContain("Leader: #1 candidate-profitable 9.83 USDT (0.0983%)");
    expect(result.stdout).toContain("Paper evidence: ledger_chain_complete");
    expect(result.stdout).toContain("Trading review: promoted_for_trading_review / collecting_paper_evidence / candidate-profitable / selected matches");
    expect(result.stdout).toContain("Trading review packet: collecting / top min_observation_count_not_met / next Continue paper trading until the evidence window qualifies.");
    expect(result.stdout.indexOf("Trading review packet:")).toBeLessThan(
      result.stdout.indexOf("Trading promotion:")
    );
    expect(result.stdout).toContain("Trading review subject: candidate-profitable / promoted 2026-05-16T00:00:04.000Z / selected matches");
    expect(result.stdout).toContain("Trading review evidence window: 1 obs / 0 failed / 60000ms / first 2026-05-16T00:00:03.000Z / last 2026-05-16T00:00:03.000Z");
    expect(result.stdout).toContain("Trading review blockers: evidence_window / collecting / min_observation_count_not_met, min_elapsed_ms_not_met / Paper evidence window is not mature enough for review. / next Continue paper observations until count and elapsed-time gates qualify.");
    expect(result.stdout).toContain("Trading review authority: not_live / mlp_paper_only / live_exchange=false, private_read=false, order_submission=false, credentials=false");
    expect(result.stdout).toContain("Trading review runner: active / run running / next 2026-05-16T00:01:03.000Z");
    expect(result.stdout).toContain("Trading review ledger: complete_chain / chain complete / gateway dry_run_only / execution dry_run_recorded");
    expect(result.stdout).toContain("Trading review lineage: available / trend_following / parent candidate-parent / Candidate produced non-negative net revenue after costs.");
    expect(result.stdout).toContain("Trading review lineage learning: rank #1 / collecting_evidence / 4.952 net USDT / 1 obs / top min_observation_count_not_met / next Continue paper observations until count and elapsed-time gates qualify.");
    expect(result.stdout).toContain("Trading review provenance: binance_production_public_websocket / websocket_primary / fresh / WS connected / marker binance-ws-aggTrade-991 / fill filled / order book synced update 11");
    expect(result.stdout).toContain("Trading review risk: equity 10004.952 USDT / available 10003.652 USDT / position long 0.001 BTCUSDT notional 65 / open 0 / fill filled");
    expect(result.stdout).toContain("Paper Trading Evaluation: running (1 observations, 4.95 USDT)");
    expect(result.stdout).not.toContain("PaperTradingEvaluation:");
    expect(result.stdout).toContain("Paper board: #1 candidate-profitable 4.95 USDT / collecting_evidence / gate collecting_paper_evidence");
    expect(result.stdout).toContain("Paper board trend: insufficient_history / delta 0.00 USDT / return 0.0000% / 0 obs / not_promotion_authority");
    expect(result.stdout).toContain("Paper board blockers: 2 blockers / density 2 / failed 0 / top min_observation_count_not_met / not_promotion_authority");
    expect(result.stdout).toContain("Paper qualification: observations 1, failed 0, elapsed 60000ms / min_observation_count_not_met, min_elapsed_ms_not_met");
    expect(result.stdout).toContain("Paper board quality: paper runner active, market provenance binance_production_public_websocket / websocket_primary, paper fill filled, paper open orders 0");
    expect(result.stdout).not.toContain("Paper board quality: runner active, market");
    expect(result.stdout).toContain("Paper runner: active / interval 60000ms / next 2026-05-16T00:01:03.000Z");
    expect(result.stdout).toContain("Paper market snapshot: BTCUSDT 65000.00 USDT @ 2026-05-16T00:00:03.000Z");
    expect(result.stdout).not.toContain("Market snapshot: BTCUSDT 65000.00 USDT");
    expect(result.stdout).toContain("Gateway market data: binance_production_public_websocket");
    expect(result.stdout).not.toContain("Market data: binance_production_public_websocket");
    expect(result.stdout).toContain("Public execution evidence: binance_production_public_websocket / websocket_primary / fresh / WS connected / marker binance-ws-aggTrade-991");
    expect(result.stdout).not.toContain("Public execution: binance_production_public_websocket");
    expect(result.stdout).toContain("Public order book evidence: synced / update 11");
    expect(result.stdout).not.toContain("Order book: synced / update 11");
    expect(result.stdout).toContain("Paper decision: order_request buy limit 0.001 @ 65000 (trading_system_order_request)");
    expect(result.stdout).toContain("Paper account: equity 10004.95 USDT / long 0.001 BTCUSDT @ 60000 / open orders 0");
    expect(result.stdout).toContain("Paper fill: filled 0.001 @ 60000 / trade agg-60000-001");
  });

  it.each([
    ["awaiting_allocation", 0, 0],
    ["allocated", 1, 0],
    ["completed_tick", 1, 1]
  ] as const)("formats %s research policy application without granting authority", async (
    applicationStatus,
    allocationCount,
    completedTickCount
  ) => {
    const operator = fixtureOperator();
    operator.candidate_arena.research_generalization =
      fixtureCollectingResearchGeneralization(applicationStatus);
    const result = await runOuroborosCli(["status"], {
      fetch: async () => jsonResponse({ operator }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "Research generalization: collecting / protocols 2 / outcomes 1 / assigned 2/6 / terminal 1/6 / inference generalization_not_supported / latest decision not_approved / latest mode none / effective mode adaptive_default"
    );
    expect(result.stdout).toContain(
      `application ${applicationStatus} / allocations ${allocationCount} / completed ticks ${completedTickCount}`
    );
    expect(result.stdout).toContain(
      "next collect_precommitted_studies / not_promotion_authority"
    );
  });

  it("adds the operator API token header to runtime status calls when configured", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const result = await runOuroborosCli(["status"], {
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({ operator: fixtureOperator() });
      },
      runtimeBaseUrl: "http://runtime.test",
      operatorApiToken: "cli-status-token"
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://runtime.test/api/operator");
    expect(new Headers(calls[0]?.init?.headers).get("x-ouroboros-operator-token")).toBe("cli-status-token");
  });

  it("points failed promotion commands back to visible blocker surfaces", async () => {
    const result = await runOuroborosCli(["status"], {
      fetch: async () => jsonResponse({
        operator: fixtureOperator({
          latest_commands: [{
            command_id: "command-promote-failed",
            command_kind: "trading_candidate.promote",
            status: "failed",
            requested_at: "2026-05-27T00:00:00.000Z",
            completed_at: "2026-05-27T00:00:01.000Z",
            error: "paper_trading_qualification_required",
            authority_status: "not_live"
          }]
        })
      }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Latest command: trading_candidate.promote failed / paper_trading_qualification_required");
    expect(result.stdout).toContain("Latest command remediation: Trading review promotion / Trading review packet, Paper Board / Review the Trading review packet blockers and Paper Board qualification before retrying promotion. / not_live");
  });

  it("formats classified paper failure remediation before raw failure text", async () => {
    const operator = fixtureOperator();
    operator.selected_paper_trading_evaluation.latest_failure_reason = "fake public execution stream unavailable";
    operator.selected_paper_trading_evaluation.latest_failure = {
      failure_kind: "public_execution_evidence_gap",
      reason: "fake public execution stream unavailable",
      summary: "Paper fill or execution evidence could not be tied to public execution data.",
      next_action: "Restore public execution evidence before trusting fills or paper score.",
      authority_status: "not_live"
    };
    const result = await runOuroborosCli(["status"], {
      fetch: async () => jsonResponse({ operator }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "Paper failure: public_execution_evidence_gap / Paper fill or execution evidence could not be tied to public execution data. / next Restore public execution evidence before trusting fills or paper score. / raw fake public execution stream unavailable"
    );
  });

  it("formats restart recovery when a persisted paper evaluation needs a runner resume", async () => {
    const operator = fixtureOperator();
    const result = await runOuroborosCli(["status"], {
      fetch: async () =>
        jsonResponse({
          operator: fixtureOperator({
            selected_paper_trading_evaluation: {
              ...operator.selected_paper_trading_evaluation,
              status: "running",
              runner_active: false
            }
          })
        }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      "Paper runner: needs resume / persisted running, timer inactive / interval 60000ms / next 2026-05-16T00:01:03.000Z"
    );
  });

  it("returns operator status JSON for automation", async () => {
    const result = await runOuroborosCli(["--json", "status"], {
      fetch: async () => jsonResponse({ operator: fixtureOperator() }),
      runtimeBaseUrl: "http://runtime.test"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      candidate_arena: {
        runner_status: "running"
      },
      researcher_provider: {
        selected_provider: "fixture"
      }
    });
  });

  it("prints installed CLI help as a successful command", async () => {
    const result = await runOuroborosCli(["--help"], {
      fetch: async () => {
        throw new Error("help should not call runtime fetch");
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ouroboros <command>");
    expect(result.stdout).toContain("ouroboros agent status|setup|login|probe codex|fixture");
  });

  it("keeps provider names as agent setup values instead of role-scoped profile commands", () => {
    expect(parseOuroborosCliArgs(["agent", "setup", "codex"])).toEqual({
      mode: "agent",
      action: "setup",
      provider: "codex"
    });
    expect(() => parseOuroborosCliArgs(["codex:runtime", "--", "setup", "researcher"]))
      .toThrow(/Usage: ouroboros/);
    expect(() => parseOuroborosCliArgs(["profile", "setup", "researcher"]))
      .toThrow(/Usage: ouroboros/);
  });

  it("sets up managed agent providers through the installed CLI without the runtime server", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const result = await runOuroborosCli(["agent", "setup", "codex"], {
      storeRoot: tmpDir,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        throw new Error("agent setup should not call runtime fetch");
      }
    });

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([]);
    expect(result.stdout).toContain("OK Agent provider codex: configured");
    expect(result.stdout).toContain("Agent profile authority:");
    expect(result.stdout).not.toContain("\nAuthority:");
    expect(result.stdout).toContain(path.join(tmpDir, "agent-profiles", "codex", "codex-home"));
  });

  it("runs Codex device login in the terminal with the managed profile environment", async () => {
    const spawnCalls: Array<{
      file: string;
      args: string[];
      env?: NodeJS.ProcessEnv;
    }> = [];

    const result = await runOuroborosCli(["agent", "login", "codex"], {
      storeRoot: tmpDir,
      profileSpawnFile: async (file, args, options) => {
        spawnCalls.push({ file, args, env: options?.env });
        return { exitCode: 0 };
      },
      fetch: async () => {
        throw new Error("agent login should not call runtime fetch");
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("OK Agent provider codex: authenticated");
    expect(spawnCalls).toEqual([
      expect.objectContaining({
        file: "codex",
        args: ["login", "--device-auth"],
        env: expect.objectContaining({
          CODEX_HOME: path.join(tmpDir, "agent-profiles", "codex", "codex-home"),
          HOME: path.join(tmpDir, "agent-profiles", "codex", "home")
        })
      })
    ]);
  });

  it("probes managed agent providers locally without calling the command endpoint", async () => {
    await runOuroborosCli(["agent", "setup", "codex"], { storeRoot: tmpDir });
    const execCalls: Array<{ file: string; args: string[]; env?: NodeJS.ProcessEnv }> = [];

    const result = await runOuroborosCli(["agent", "probe", "codex"], {
      storeRoot: tmpDir,
      profileExecFile: async (file, args, options) => {
        execCalls.push({ file, args, env: options?.env });
        return { stdout: args.includes("--version") ? "codex 9.9.9\n" : "authenticated\n", stderr: "" };
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Version: codex 9.9.9");
    expect(execCalls.map((call) => call.args)).toEqual([
      ["--version"],
      ["login", "status"]
    ]);
  });

  it("maps researcher provider selection to the shared runtime command endpoint", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const result = await runOuroborosCli(["researcher", "provider", "set", "codex"], {
      runtimeBaseUrl: "http://runtime.test",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
          command: {
            command_id: "command-researcher-provider",
            command_kind: "researcher.provider.select",
            status: "succeeded"
          },
          operator: fixtureOperator({
            researcher_provider: {
              selected_provider: "codex",
              available_providers: ["codex", "fixture"],
              authority_status: "research_only"
            }
          })
        });
      }
    });

    expect(result.exitCode).toBe(0);
    expect(calls[0]).toMatchObject({
      url: "http://runtime.test/api/commands",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          command_kind: "researcher.provider.select",
          payload: { provider: "codex" }
        })
      }
    });
  });

  it("formats command API errors with next steps", async () => {
    const result = await runOuroborosCli(["researcher", "provider", "set", "codex"], {
      runtimeBaseUrl: "http://runtime.test",
      fetch: async () => ({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({
          error: "agent_provider_not_configured",
          required_command: "ouroboros agent setup codex"
        })
      } as Response)
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Ouroboros command failed: agent_provider_not_configured");
    expect(result.stderr).toContain("Next step: ouroboros agent setup codex");
  });

  it("formats paper evidence failures with the candidate and next action", async () => {
    const result = await runOuroborosCli(["candidate", "evidence", "run", "candidate-alpha"], {
      runtimeBaseUrl: "http://runtime.test",
      fetch: async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({
          error: "trading_run_failed",
          reason: "invalid_ledger_input",
          system_id: "candidate-alpha"
        })
      } as Response)
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Ouroboros command failed: trading_run_failed");
    expect(result.stderr).toContain("Reason: invalid_ledger_input");
    expect(result.stderr).toContain("Candidate: candidate-alpha");
    expect(result.stderr).toContain("Next step: select an accepted candidate with runnable paper evidence");
  });

  it("prints a runtime startup hint when command endpoint is unreachable", async () => {
    const result = await runOuroborosCli(["researcher", "provider", "set", "codex"], {
      runtimeBaseUrl: "http://127.0.0.1:4173",
      fetch: async () => {
        throw new TypeError("fetch failed");
      }
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Ouroboros runtime is not reachable at http://127.0.0.1:4173");
    expect(result.stderr).toContain("Start it in another terminal with: ouroboros runtime serve");
    expect(result.stderr).toContain("Original error: fetch failed");
  });

  it("maps selected candidate paper evidence to the command endpoint", () => {
    expect(parseOuroborosCliArgs(["candidate", "evidence", "run", "candidate-alpha"])).toEqual({
      mode: "command",
      request: {
        command_kind: "candidate.paper_evidence.run",
        payload: {
          candidate_id: "candidate-alpha"
        }
      }
    });
  });

  it("maps selected candidate paper trading commands to the command endpoint", () => {
    expect(parseOuroborosCliArgs(["candidate", "promote", "candidate-alpha"])).toEqual({
      mode: "command",
      request: {
        command_kind: "trading_candidate.promote",
        payload: {
          candidate_id: "candidate-alpha"
        }
      }
    });
    expect(parseOuroborosCliArgs(["candidate", "paper", "start", "candidate-alpha"])).toEqual({
      mode: "command",
      request: {
        command_kind: "trading_run.start",
        payload: {
          candidate_id: "candidate-alpha"
        }
      }
    });
    expect(parseOuroborosCliArgs(["trading-run", "observe", "trading-run-alpha"])).toEqual({
      mode: "command",
      request: {
        command_kind: "trading_run.observe",
        payload: {
          trading_run_id: "trading-run-alpha"
        }
      }
    });
    expect(parseOuroborosCliArgs(["trading-run", "stop", "trading-run-alpha"])).toEqual({
      mode: "command",
      request: {
        command_kind: "trading_run.stop",
        payload: {
          trading_run_id: "trading-run-alpha"
        }
      }
    });
  });

  it("keeps the Ink TUI on the shared operator read model path", () => {
    expect(parseOuroborosCliArgs(["tui"])).toEqual({
      mode: "tui"
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

function fixtureOperator(
  overrides: Partial<OperatorReadModel> = {}
): OperatorReadModel {
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
      interval_ms: 60_000,
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
    agent_profiles: [],
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
    authority_status: "not_live",
    ...overrides
  };
}

function fixtureCollectingResearchGeneralization(
  applicationStatus: "awaiting_allocation" | "allocated" | "completed_tick" =
    "completed_tick"
):
  OperatorReadModel["candidate_arena"]["research_generalization"] {
  return {
    status: "collecting",
    protocol_count: 2,
    outcome_count: 1,
    active_protocol: {
      research_generalization_protocol_id: "research-generalization-protocol-1",
      committed_at: "2026-07-13T00:00:00.000Z",
      collection_deadline_at: "2026-10-11T00:00:00.000Z",
      status: "collecting",
      planned_study_count: 6,
      assigned_study_count: 2,
      terminal_study_count: 1,
      condition_blocks: [
        {
          condition_block: "long",
          planned_study_count: 2,
          assigned_study_count: 1,
          terminal_study_count: 1
        },
        {
          condition_block: "short",
          planned_study_count: 2,
          assigned_study_count: 1,
          terminal_study_count: 0
        },
        {
          condition_block: "flat",
          planned_study_count: 2,
          assigned_study_count: 0,
          terminal_study_count: 0
        }
      ],
      next_action: "collect_precommitted_studies",
      authority_status: "research_only"
    },
    latest_outcome: fixtureLatestResearchGeneralizationOutcome(),
    latest_policy_decision: fixtureLatestResearchGeneralizationPolicyDecision(),
    effective_policy_decision:
      fixtureEffectiveResearchGeneralizationPolicyDecision(applicationStatus),
    authority_status: "not_promotion_authority"
  };
}

function fixtureLatestResearchGeneralizationOutcome(): NonNullable<
  OperatorReadModel["candidate_arena"]["research_generalization"]["latest_outcome"]
> {
  return {
    research_generalization_outcome_id: "research-generalization-outcome-latest",
    research_generalization_protocol_id: "research-generalization-protocol-closed",
    inference_status: "generalization_not_supported",
    adjudicated_at: "2026-07-12T00:00:00.000Z",
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: 5,
    tied_study_count: 1,
    missing_study_count: 0,
    ineligible_study_count: 0,
    distinct_baseline_count: 4,
    equal_weight_mean_rate_difference: -0.1,
    exact_sign_test_p_value: 0.21875,
    harmful_condition_blocks: ["flat"],
    policy_decision_eligibility: "not_eligible",
    next_action: "retain_negative_generalization_evidence",
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function fixtureLatestResearchGeneralizationPolicyDecision(): NonNullable<
  OperatorReadModel["candidate_arena"]["research_generalization"]["latest_policy_decision"]
> {
  return {
    research_generalization_policy_decision_id:
      "research-generalization-policy-decision-latest",
    research_generalization_protocol_id: "research-generalization-protocol-closed",
    research_generalization_outcome_id: "research-generalization-outcome-latest",
    decision_status: "not_approved",
    decision_reason: "generalization_outcome_not_eligible",
    effective_default_mode: null,
    decided_at: "2026-07-12T00:00:01.000Z",
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
}

function fixtureEffectiveResearchGeneralizationPolicyDecision(
  applicationStatus: "awaiting_allocation" | "allocated" | "completed_tick"
): NonNullable<
  OperatorReadModel["candidate_arena"]["research_generalization"]["effective_policy_decision"]
> {
  const allocated = applicationStatus !== "awaiting_allocation";
  const completed = applicationStatus === "completed_tick";
  return {
    research_generalization_policy_decision_id:
      "research-generalization-policy-decision-effective",
    research_generalization_protocol_id:
      "research-generalization-protocol-effective",
    research_generalization_outcome_id:
      "research-generalization-outcome-effective",
    effective_default_mode: "adaptive_default",
    decided_at: "2026-06-12T00:00:01.000Z",
    application: {
      application_status: applicationStatus,
      allocation_count: allocated ? 1 : 0,
      completed_tick_count: completed ? 1 : 0,
      latest_allocation: allocated
        ? {
            candidate_arena_research_allocation_id:
              "candidate-arena-research-allocation-effective",
            tick_id: "candidate-arena-tick-effective",
            allocated_at: "2026-06-12T00:00:02.000Z",
            completed_at: completed ? "2026-06-12T00:00:04.000Z" : null
          }
        : null
    },
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
}
