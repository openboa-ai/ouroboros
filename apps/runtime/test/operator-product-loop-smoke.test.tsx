import React from "react";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToString } from "ink";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runOuroborosCli } from "@ouroboros/cli";
import type {
  CandidateArenaReadModel,
  OperatorReadModel,
  OuroborosCommandKind,
  OuroborosCommandRequest
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import { OperatorTuiScreen } from "@ouroboros/operator-tui";
import { buildServer } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-product-loop-smoke-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("operator product loop smoke", () => {
  it("runs status, provider setup, arena tick, selection, paper evidence, and readback through shared surfaces", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      marketDataPort: fakeGatewayMarketDataPort({
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "product-loop-fill",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:02.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });
    const runtimeBaseUrl = "http://runtime.test";
    const fetcher = serverFetch(server);

    try {
      const initialStatus = await runOuroborosCli(["status"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(initialStatus.exitCode, initialStatus.stderr).toBe(0);
      expect(initialStatus.stdout).toContain("Ouroboros status");
      expect(initialStatus.stdout).toContain("Arena: stopped");
      expect(initialStatus.stdout).toContain("Selected candidate: none");
      expect(initialStatus.stdout).toContain("Paper evidence: not_run");
      expect(initialStatus.stdout).toContain("PaperTradingEvaluation: not_started");
      expect(initialStatus.stdout).toContain("Live authority: disabled / not_live");

      await postCommand(server, {
        command_kind: "agent_provider.setup",
        payload: { provider: "fixture" }
      });
      const probed = await postCommand(server, {
        command_kind: "agent_provider.probe",
        payload: { provider: "fixture" }
      });
      expect(probed.operator.agent_profiles).toContainEqual(expect.objectContaining({
        provider: "fixture",
        status: "authenticated",
        authority_status: "no_trading_authority"
      }));

      const providerSelected = await runOuroborosCli(
        ["researcher", "provider", "set", "fixture"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(providerSelected.exitCode, providerSelected.stderr).toBe(0);
      expect(providerSelected.stdout).toContain("OK Researcher provider selected: fixture.");

      const tick = await runOuroborosCli(["arena", "tick", "--json"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(tick.exitCode, tick.stderr).toBe(0);
      const tickBody = JSON.parse(tick.stdout) as {
        result: {
          created_candidate_count: number;
          created_candidate_ids: string[];
          arena: CandidateArenaReadModel;
        };
        operator: OperatorReadModel;
      };
      expect(
        tickBody.result.created_candidate_count,
        JSON.stringify(tickBody.result.arena.latest_ticks[0]?.direction_results, null, 2)
      ).toBeGreaterThan(1);
      expect(tickBody.result.created_candidate_ids).not.toContain(FIXTURE_CANDIDATE_ID);
      expect(tickBody.operator.candidate_arena.leaderboard.length).toBeGreaterThanOrEqual(
        tickBody.result.created_candidate_count
      );
      expect(sortedByNetRevenue(tickBody.operator.candidate_arena)).toBe(true);
      expect(tickBody.operator.candidate_arena.latest_ticks[0]).toMatchObject({
        status: "completed",
        authority_status: "not_live"
      });

      const leader = tickBody.operator.candidate_arena.leaderboard[0]!;
      const selected = await runOuroborosCli(
        ["candidate", "select", leader.candidate_id, "--json"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(selected.exitCode, selected.stderr).toBe(0);
      const selectedBody = JSON.parse(selected.stdout) as { operator: OperatorReadModel };
      expect(selectedBody.operator.selected_candidate_id).toBe(leader.candidate_id);
      expect(selectedBody.operator.selected_paper_evidence).toMatchObject({
        status: "not_run",
        ledger_chain_complete: false,
        authority_status: "not_live"
      });

      const evidence = await runOuroborosCli(
        ["candidate", "paper", "start", leader.candidate_id, "--json"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(evidence.exitCode, evidence.stderr).toBe(0);
      const evidenceBody = JSON.parse(evidence.stdout) as { operator: OperatorReadModel };
      expect(evidenceBody.operator).toMatchObject({
        selected_candidate_id: leader.candidate_id,
        selected_paper_trading_evaluation: {
          evaluation_kind: "paper_trading_evaluation",
          status: "running",
          runner_active: true,
          interval_ms: 60_000,
          observation_count: 1,
          ledger_chain_complete: true,
          latest_market_snapshot: {
            symbol: "BTCUSDT",
            source_kind: "binance_production_public_rest",
            authority_status: "read_only"
          },
          latest_decision: {
            decision_kind: "order_request",
            source_kind: "trading_system_decision",
            authority_status: "trace_only"
          },
          paper_account_snapshot: {
            position: {
              side: "long",
              quantity: "0.001"
            },
            open_order_count: 0
          },
          latest_fill: {
            fill_status: "filled",
            fill_quantity: "0.001",
            fill_price: "60000"
          },
          authority_status: "not_live"
        },
        selected_paper_evidence: {
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: expect.any(Number),
          latest_order_request_id: expect.any(String),
          latest_gateway_outcome: "dry_run_only",
          latest_execution_status: "dry_run_recorded",
          authority_status: "not_live"
        },
        live_disabled: true,
        authority_status: "not_live"
      });

      const tradingRunId = evidenceBody.operator.selected_paper_trading_evaluation.trading_run_id;
      expect(tradingRunId).toEqual(expect.any(String));
      const observed = await runOuroborosCli(
        ["trading-run", "observe", tradingRunId!, "--json"],
        { runtimeBaseUrl, fetch: fetcher }
      );
      expect(observed.exitCode, observed.stderr).toBe(0);
      const observedBody = JSON.parse(observed.stdout) as { operator: OperatorReadModel };
      expect(observedBody.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 2,
        ledger_chain_complete: true,
        authority_status: "not_live"
      });
      const evaluationId = observedBody.operator.selected_paper_trading_evaluation.evaluation_id;
      expect(evaluationId).toEqual(expect.any(String));
      const observations = await store.listPaperTradingObservations(evaluationId!);
      const observedCandidate = await store.getCandidateForTradingRun(tradingRunId!);
      expect(observations[0]?.ledger_ref?.id).toBe(observedCandidate?.ledger?.chains[0]?.chain_id);
      expect(observations.at(-1)?.ledger_ref).toBeUndefined();

      const finalStatus = await runOuroborosCli(["--json", "status"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(finalStatus.exitCode, finalStatus.stderr).toBe(0);
      const finalOperator = JSON.parse(finalStatus.stdout) as OperatorReadModel;
      expect(finalOperator.selected_paper_evidence).toMatchObject({
        status: "ledger_chain_complete",
        ledger_chain_complete: true,
        latest_order_request_id: expect.any(String),
        latest_gateway_outcome: "dry_run_only",
        latest_execution_status: "dry_run_recorded",
        authority_status: "not_live"
      });
      expect(finalOperator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        interval_ms: 60_000,
        observation_count: 2,
        ledger_chain_complete: true,
        latest_market_snapshot: {
          symbol: "BTCUSDT",
          authority_status: "read_only"
        },
        latest_decision: {
          decision_kind: "hold",
          authority_status: "trace_only"
        },
        paper_account_snapshot: {
          position: {
            side: "long",
            quantity: "0.001"
          },
          open_order_count: 0
        },
        authority_status: "not_live"
      });
      expect(finalOperator.latest_commands.map((command) => command.command_kind)).toEqual(
        expect.arrayContaining([
          "arena.tick",
          "candidate.select",
          "trading_run.start",
          "trading_run.observe",
          "researcher.provider.select"
        ])
      );

      const restartedServer = await buildServer({
        store: new LocalStore(tmpDir),
        marketDataPort: fakeGatewayMarketDataPort()
      });
      try {
        const restartedOperator = await restartedServer.inject({
          method: "GET",
          url: "/api/operator"
        });
        expect(restartedOperator.statusCode, restartedOperator.body).toBe(200);
        expect(restartedOperator.json().operator).toMatchObject({
          selected_candidate_id: leader.candidate_id,
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true,
            latest_gateway_outcome: "dry_run_only",
            latest_execution_status: "dry_run_recorded",
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: {
            status: "running",
            runner_active: false,
            observation_count: 2,
            ledger_chain_complete: true,
            latest_decision: {
              decision_kind: "hold",
              authority_status: "trace_only"
            },
            authority_status: "not_live"
          }
        });
        const resumed = await restartedServer.inject({
          method: "POST",
          url: "/api/commands",
          payload: {
            command_kind: "trading_run.start",
            payload: { candidate_id: leader.candidate_id }
          }
        });
        expect(resumed.statusCode, resumed.body).toBe(200);
        expect(resumed.json()).toMatchObject({
          result: {
            status: "resumed",
            runner_status: "running"
          },
          operator: {
            selected_paper_trading_evaluation: {
              status: "running",
              runner_active: true,
              observation_count: 3,
              authority_status: "not_live"
            }
          }
        });
      } finally {
        await restartedServer.close();
      }

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${leader.candidate_id}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: leader.candidate_id,
        ledger: {
          has_activity: true,
          chain_complete: true,
          authority_status: "not_live"
        }
      });

      const tui = renderToString(
        <OperatorTuiScreen
          operator={finalOperator}
          cursor={0}
          message="product loop smoke"
        />
      );
      expect(tui).toContain("Ouroboros Action Console");
      expect(tui).toContain("Researcher provider: fixture");
      expect(tui).toContain("Authority: not_live / live disabled");
      expect(tui).toContain(`Selected Candidate\n${leader.candidate_id}`);
      expect(tui).toContain("PaperTradingEvaluation: running");
      expect(tui).toContain("Decision: hold");
      expect(tui).toContain("Account: equity");
      expect(tui).toContain("Ledger chain: complete");
      expect(tui).toContain("trading_run.observe: succeeded");
    } finally {
      await server.close();
    }
  });
});

function sortedByNetRevenue(arena: CandidateArenaReadModel): boolean {
  return arena.leaderboard.every((entry, index, entries) =>
    index === 0
      || entries[index - 1]!.profit_loss.net_revenue_usdt >= entry.profit_loss.net_revenue_usdt
  );
}

async function postCommand(
  server: Awaited<ReturnType<typeof buildServer>>,
  request: OuroborosCommandRequest
): Promise<{
  command: { command_kind: OuroborosCommandKind; status: string };
  operator: OperatorReadModel;
}> {
  const response = await server.inject({
    method: "POST",
    url: "/api/commands",
    payload: request
  });
  expect(response.statusCode, response.body).toBe(200);
  return response.json();
}

function serverFetch(server: Awaited<ReturnType<typeof buildServer>>) {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
    const method = init?.method === "POST" ? "POST" : "GET";
    const response = await server.inject({
      method,
      url: `${url.pathname}${url.search}`,
      payload
    });
    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      status: response.statusCode,
      json: async () => response.json(),
      text: async () => response.body
    } as unknown as Response;
  };
}
