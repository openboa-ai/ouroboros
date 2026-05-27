import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OperatorReadModel } from "@ouroboros/domain";
import { parseOuroborosCliArgs, runOuroborosCli } from "../src/ouroboros-cli";

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
    expect(result.stdout).toContain("Leader: #1 candidate-profitable 9.83 USDT (0.0983%)");
    expect(result.stdout).toContain("Paper evidence: ledger_chain_complete");
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
