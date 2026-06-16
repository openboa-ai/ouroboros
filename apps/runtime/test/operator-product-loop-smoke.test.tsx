import React from "react";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToString } from "ink";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import { validateOrderRequest } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingScenario,
  TradingProviderRequestLog,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import type { SandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
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
  it("runs an arena-generated fixture TradingSystem through the real deterministic paper sandbox", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            expected_direction: "long"
          },
          {
            price: 65_000,
            expected_direction: "long"
          }
        ],
        executionSnapshots: [{
          book_ticker: {
            bid_price: "64999",
            bid_quantity: "1.000",
            ask_price: "65001",
            ask_quantity: "1.000"
          }
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      await postCommand(server, {
        command_kind: "agent_provider.setup",
        payload: { provider: "fixture" }
      });
      await postCommand(server, {
        command_kind: "agent_provider.probe",
        payload: { provider: "fixture" }
      });
      await postCommand(server, {
        command_kind: "researcher.provider.select",
        payload: { provider: "fixture" }
      });
      const tick = await postCommand(server, {
        command_kind: "arena.tick",
        payload: {}
      });
      const leader = tick.operator.candidate_arena.leaderboard[0]!;

      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: leader.candidate_id }
      });
      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: leader.candidate_id }
      });

      expect(started.operator.selected_candidate_id).toBe(leader.candidate_id);
      expect(started.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("running");
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 1,
        ledger_chain_complete: true,
        latest_decision: {
          decision_kind: "order_request",
          source_kind: "trading_system_decision",
          authority_status: "trace_only"
        },
        latest_fill: {
          fill_status: "filled",
          fill_price: "65001"
        },
        paper_account_snapshot: {
          position: {
            side: "long"
          },
          open_order_count: 0,
          authority_status: "not_live"
        },
        authority_status: "not_live"
      });
      expect(started.operator.paper_trading_board.entries[0]).toMatchObject({
        candidate_id: leader.candidate_id,
        latest_fill_status: "filled",
        open_order_count: 0
      });
      expect(started.operator.selected_paper_evidence).toMatchObject({
        status: "ledger_chain_complete",
        ledger_chain_complete: true,
        latest_gateway_outcome: "dry_run_only",
        latest_execution_status: "dry_run_recorded",
        authority_status: "not_live"
      });
    } finally {
      await server.close();
    }
  });

  it("runs status, provider setup, arena tick, selection, paper evidence, and readback through shared surfaces", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: fixedOrderLogSandboxAdapter(paperOrderRequestLine({
          at: "2026-05-16T00:00:03.000Z",
          quantity: "0.001"
        }), paperHoldLine("2026-05-16T00:01:03.000Z"))
      },
      candidateArenaArtifactRunner: networklessReplayArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 65_000,
            observed_at: "2026-05-16T00:01:03.000Z"
          },
          {
            price: 65_000,
            observed_at: "2026-05-16T00:02:03.000Z"
          }
        ],
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "product-loop-fill",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
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

      const humanStatus = await runOuroborosCli(["status"], {
        runtimeBaseUrl,
        fetch: fetcher
      });
      expect(humanStatus.exitCode, humanStatus.stderr).toBe(0);
      expect(humanStatus.stdout).toContain("PaperTradingEvaluation: running");
      expect(humanStatus.stdout).toContain("Market data:");
      expect(humanStatus.stdout).toContain("Public execution:");
      expect(humanStatus.stdout).toContain("Paper decision: hold");
      expect(humanStatus.stdout).toContain("Paper account: equity");
      expect(humanStatus.stdout).toContain("Paper fill: filled 0.001 @ 60000 / trade product-loop-fill");

      const restartedServer = await buildServer({
        store: new LocalStore(tmpDir),
        sandboxAdapters: {
          deterministic_test: fixedOrderLogSandboxAdapter(paperOrderRequestLine({
            at: "2026-05-16T00:00:03.000Z",
            quantity: "0.001"
          }), paperHoldLine("2026-05-16T00:01:03.000Z"))
        },
        marketDataPort: fakeGatewayMarketDataPort(),
        paperTradingApiProviderFactory: networklessPaperTradingApiProvider
      });
      try {
        const restartedOperator = await restartedServer.inject({
          method: "GET",
          url: "/api/operator"
        });
        expect(restartedOperator.statusCode, restartedOperator.body).toBe(200);
        const restartedOperatorBody = restartedOperator.json() as { operator: OperatorReadModel };
        expect(restartedOperatorBody.operator).toMatchObject({
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
        const restartedHumanStatus = await runOuroborosCli(["status"], {
          runtimeBaseUrl,
          fetch: serverFetch(restartedServer)
        });
        expect(restartedHumanStatus.exitCode, restartedHumanStatus.stderr).toBe(0);
        expect(restartedHumanStatus.stdout).toContain(
          "Paper runner: needs resume / persisted running, timer inactive"
        );
        const restartedTui = renderToString(
          <OperatorTuiScreen
            operator={restartedOperatorBody.operator}
            cursor={0}
          />
        );
        expect(restartedTui).toContain("Runner: needs resume / persisted running, timer inactive");
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
      expect(tui).toContain("Public execution:");
      expect(tui).toContain("runner active, market binance_production_public_rest / websocket_primary,");
      expect(tui).toContain("fill filled, open 0");
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

function paperOrderRequestLine(input: { at: string; quantity: string }): string {
  return JSON.stringify({
    at: input.at,
    authority_status: "trace_only",
    event: "order_request",
    event_id: "operator-smoke-order-0001",
    instance_id: "operator-smoke-paper-runtime",
    intent_kind: "place_order",
    limit_price: "60000",
    order_type: "limit",
    quantity: input.quantity,
    side: "buy",
    symbol: "BTCUSDT"
  });
}

function paperHoldLine(at: string): string {
  return JSON.stringify({
    at,
    authority_status: "trace_only",
    event: "hold",
    event_id: "operator-smoke-hold-0001",
    instance_id: "operator-smoke-paper-runtime",
    reason: "sample paper TradingSystem emitted no fresh order"
  });
}

function fixedOrderLogSandboxAdapter(orderLine: string, holdLine: string): SandboxAdapter {
  let refreshCount = 0;
  return {
    kind: "deterministic_test",
    async startArtifactInstance(input) {
      const sandboxRef = { record_kind: "sandbox", id: input.instance_id };
      const placementRef = { record_kind: "sandbox_placement", id: input.sandbox_placement_id };
      return {
        placement: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder",
          authority_status: "not_launched"
        },
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [{ record_kind: "sandbox_log", id: `sandbox-log-${input.instance_id}-start` }],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          lines: [orderLine],
          captured_at: input.created_at,
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus() {
      return {};
    },
    async getArtifactInstanceLogs(instance) {
      refreshCount += 1;
      const sandboxId = instance.sandbox_id;
      return {
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${sandboxId}-refresh-${refreshCount}`,
          sandbox_ref: { record_kind: "sandbox", id: sandboxId },
          lines: refreshCount === 1 ? [orderLine] : [orderLine, holdLine],
          captured_at: `2026-05-16T00:0${refreshCount}:03.000Z`,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance) {
      return {
        lifecycle_status: "stopped",
        stopped_at: instance.stopped_at ?? "2026-05-16T00:02:03.000Z"
      };
    }
  };
}

function networklessReplayArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async run(input) {
      await mkdir(input.output_dir, { recursive: true });
      const eventsPath = path.join(input.output_dir, "events.jsonl");
      const market = input.provider.scenario.market;
      const account = input.provider.scenario.account;
      const orderRequest = market.expected_direction === "flat"
        ? {
            symbol: market.symbol,
            side: "hold" as const,
            quantity: 0,
            order_type: "none" as const,
            reason: "flat replay regime holds through provider validation"
          }
        : {
            symbol: market.symbol,
            side: market.expected_direction === "short" ? "sell" as const : "buy" as const,
            quantity: Number((account.equity * account.target_risk_fraction / market.price).toFixed(8)),
            order_type: "market" as const,
            reason: "networkless smoke runner preserves TradingApiProvider boundary events"
          };
      const validation = validateOrderRequest(orderRequest, market, account);
      const events: TradingSystemEvent[] = [
        { event: "market_snapshot", ...market },
        { event: "account_state", ...account },
        { event: "order_request", ...orderRequest },
        { event: "order_validation", ...validation },
        { event: "run_complete", accepted: validation.accepted }
      ];
      await writeFile(
        eventsPath,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
        "utf8"
      );
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerBoundaryRequests()
      };
    }
  };
}

function paperDirectArenaArtifactRunner(): TradingArtifactRunner {
  const replayRunner = networklessReplayArtifactRunner();
  return {
    kind: "host_process",
    async run(input) {
      await writeFile(path.join(input.artifact_dir, "run.py"), paperDirectArenaArtifact(), "utf8");
      return replayRunner.run(input);
    }
  };
}

function paperDirectArenaArtifact(): string {
  return `#!/usr/bin/env python3
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def append_line(line, log_path, heartbeat_path=None):
    print(line, flush=True)
    if log_path is not None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\\n")
    if heartbeat_path is not None:
        heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
        heartbeat_path.write_text(line + "\\n", encoding="utf-8")


parser = argparse.ArgumentParser()
parser.add_argument("--instance-id", required=True)
parser.add_argument("--ticks", type=int, default=0)
parser.add_argument("--interval-ms", type=int, default=1000)
parser.add_argument("--log-file")
parser.add_argument("--heartbeat-file")
parser.add_argument("--start-at", required=True)
parser.add_argument("--paper-order-request", default="valid")
args = parser.parse_args()

log_path = Path(args.log_file) if args.log_file else None
heartbeat_path = Path(args.heartbeat_file) if args.heartbeat_file else None
append_line(json.dumps({
    "event": "order_request",
    "event_id": f"{args.instance_id}:order-request:0001",
    "instance_id": args.instance_id,
    "at": args.start_at,
    "authority_status": "trace_only",
    "intent_kind": "place_order",
    "symbol": "BTCUSDT",
    "side": "buy",
    "order_type": "market",
    "quantity": "0.001",
    "reason": "paper-direct arena fixture order",
}, sort_keys=True), log_path)

tick = 0
while True:
    tick += 1
    append_line(json.dumps({
        "event": "runtime_heartbeat",
        "instance_id": args.instance_id,
        "tick": tick,
        "at": utc_now(),
    }, sort_keys=True), log_path, heartbeat_path)
    if args.ticks and tick >= args.ticks:
        break
    time.sleep(args.interval_ms / 1000)

append_line(json.dumps({
    "event": "runtime_stopped",
    "instance_id": args.instance_id,
    "tick": tick,
    "at": utc_now(),
}, sort_keys=True), log_path)
`;
}

async function networklessReplayTradingApiProvider(
  scenario: ReplayTradingScenario
): Promise<ReplayTradingApiProviderSession> {
  const requests: TradingProviderRequestLog[] = [];
  return {
    base_url: `http://replay-provider.test/${scenario.id}`,
    close: async () => undefined,
    requests: () => [...requests],
    scenario
  };
}

async function networklessPaperTradingApiProvider(
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions
): Promise<ReplayTradingApiProviderSession> {
  const market = await binding.marketData.readMarketSnapshot();
  const account = options.readAccountState
    ? await options.readAccountState()
    : binding.account.provider_kind === "fake_paper_account"
      ? binding.account.state
      : {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        };
  return {
    base_url: "http://paper-runtime.test",
    sandbox_base_url: "http://paper-runtime.test",
    close: async () => undefined,
    requests: () => [],
    scenario: {
      id: "networkless-paper-runtime",
      description: "Networkless paper runtime provider used by operator product-loop smoke.",
      market,
      account,
      outcome: {
        exit_price: market.price,
        fee_bps: 4,
        slippage_bps: 3,
        funding_bps: 1
      }
    }
  };
}

function providerBoundaryRequests(): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate")
  ];
}

function providerRequest(method: string, requestPath: string): TradingProviderRequestLog {
  return {
    at: "2026-05-16T00:00:00.000Z",
    method,
    path: requestPath,
    response_status: 200
  };
}
