import React from "react";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderToString } from "ink";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import { ArenaPaperRuntimeService } from
  "@ouroboros/application/trading/paper/arena-runtime";
import {
  validateOrderRequest
} from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  ReplayTradingApiProviderSession,
  ReplayTradingCandidateInput,
  TradingProviderRequestLog,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import {
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
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
import { passingPaperHandoffProbe } from "./helpers/paper-handoff";
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
      arenaPaperCapacity: 2,
      paperTradingEvaluationIntervalMs: 50,
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
      const conformanceBeforeStart = await store.listPaperTradingHandoffConformances();
      expect(conformanceBeforeStart.length).toBeGreaterThan(0);
      expect(conformanceBeforeStart.every((record) => record.status === "passed")).toBe(true);

      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: leader.candidate_id }
      });
      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: leader.candidate_id }
      });
      const repeated = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: leader.candidate_id }
      });
      const observedOperator = await waitForOperator(server, (operator) =>
        operator.selected_candidate_id === leader.candidate_id
        && operator.selected_paper_trading_evaluation.status === "running"
        && operator.selected_paper_trading_evaluation.runner_active
        && operator.selected_paper_trading_evaluation.ledger_chain_complete
        && operator.selected_paper_trading_evaluation.latest_fill?.fill_status === "filled"
      );

      expect(started.operator.selected_candidate_id).toBe(leader.candidate_id);
      expect(repeated.operator.selected_candidate_id).toBe(leader.candidate_id);
      await expect(store.listPaperTradingHandoffConformances())
        .resolves.toEqual(conformanceBeforeStart);
      expect(observedOperator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("running");
      expect(observedOperator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: expect.any(Number),
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
      expect(observedOperator.paper_trading_board.entries.find((entry) =>
        entry.candidate_id === leader.candidate_id
      )).toMatchObject({
        candidate_id: leader.candidate_id,
        latest_fill_status: "filled",
        open_order_count: 0
      });
      expect(observedOperator.selected_paper_evidence).toMatchObject({
        status: "ledger_chain_complete",
        ledger_chain_complete: true,
        latest_gateway_outcome: "dry_run_only",
        latest_execution_status: "dry_run_recorded",
        authority_status: "not_live"
      });
      const evaluations = await store.listPaperTradingEvaluations();
      const runningCandidates = await Promise.all(evaluations.map((evaluation) =>
        store.getCandidate(evaluation.candidate_ref.id)
      ));
      const sandboxes = runningCandidates.map((candidate) =>
        candidate?.runtime.sandbox
      );
      const ledgerChainIds = runningCandidates.flatMap((candidate) =>
        candidate?.ledger?.chains.map((chain) => chain.chain_id) ?? []
      );
      expect(evaluations).toHaveLength(2);
      expect(new Set(evaluations.map((evaluation) =>
        evaluation.paper_trading_evaluation_id
      )).size).toBe(2);
      expect(new Set(evaluations.map((evaluation) =>
        evaluation.trading_run_ref.id
      )).size).toBe(2);
      expect(new Set(sandboxes.map((sandbox) => sandbox?.sandbox_id)).size)
        .toBe(2);
      expect(new Set(sandboxes.map((sandbox) => sandbox?.workspace_key)).size)
        .toBe(2);
      expect(sandboxes.every((sandbox) => sandbox?.generation === 1)).toBe(true);
      expect(new Set(ledgerChainIds).size).toBe(ledgerChainIds.length);
    } finally {
      await server.close();
    }
  });

  it("runs one autonomous arena cycle into selected continuous paper trading", async () => {
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

      const cycled = await postCommand(server, {
        command_kind: "arena.cycle"
      });
      const selectedCandidateId = cycled.operator.selected_candidate_id;

      expect(cycled.command).toMatchObject({
        command_kind: "arena.cycle",
        status: "succeeded"
      });
      expect(selectedCandidateId).toBeTruthy();
      expect(cycled.operator.candidate_arena.latest_ticks[0]?.created_candidate_ids)
        .toContain(selectedCandidateId);
      expect(cycled.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("running");
      expect(cycled.operator.selected_paper_trading_evaluation).toMatchObject({
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
        authority_status: "not_live"
      });
      expect(cycled.operator.paper_trading_board.entries.find((entry) =>
        entry.candidate_id === selectedCandidateId
      )).toMatchObject({
        candidate_id: selectedCandidateId,
        latest_fill_status: "filled",
        open_order_count: 0
      });
    } finally {
      await server.close();
    }
  });

  it("keeps admitted Arena candidates queued when paper capacity is full", async () => {
    const store = new LocalStore(tmpDir);
    let arenaPaperRuntime: ArenaPaperRuntimeService | undefined;
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [{ price: 65_000, expected_direction: "long" }],
        executionSnapshots: [{
          book_ticker: {
            bid_price: "64999",
            bid_quantity: "1.000",
            ask_price: "65001",
            ask_quantity: "1.000"
          }
        }]
      }),
      arenaPaperCapacity: 1,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000,
      onArenaPaperRuntimeCreated(service) {
        arenaPaperRuntime = service;
      }
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
      await postCommand(server, { command_kind: "arena.cycle" });
      if (!arenaPaperRuntime) throw new Error("expected Arena Paper runtime");

      const initialSnapshot = await arenaPaperRuntime.snapshot();
      expect(initialSnapshot).toMatchObject({
        capacity: 1,
        eligible_count: 3,
        occupied_count: 1,
        running_count: 1,
        queued_count: 2,
        available_capacity: 0,
        needs_reconcile: false
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toHaveLength(1);

      const queuedCandidateId = initialSnapshot.systems.find((system) =>
        system.lifecycle_status === "queued"
      )?.candidate_ref.id;
      if (!queuedCandidateId) throw new Error("expected queued Arena candidate");
      const queued = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: queuedCandidateId }
        }
      });
      expect(queued.statusCode, queued.body).toBe(200);
      expect(queued.json()).toMatchObject({
        result: {
          status: "queued",
          candidate_id: queuedCandidateId
        }
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toHaveLength(1);

      const queuedEvidence = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.paper_evidence.run",
          payload: { candidate_id: queuedCandidateId }
        }
      });
      expect(queuedEvidence.statusCode, queuedEvidence.body).toBe(200);
      expect(queuedEvidence.json()).toMatchObject({
        command: {
          command_kind: "candidate.paper_evidence.run",
          status: "succeeded",
          summary: `Paper evidence collection queued for ${queuedCandidateId}.`
        },
        result: {
          status: "queued",
          candidate_id: queuedCandidateId
        }
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toHaveLength(1);

      const nonstandardStart = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: {
            candidate_id: queuedCandidateId,
            paper_order_request: "rejected"
          }
        }
      });
      expect(nonstandardStart.statusCode, nonstandardStart.body).toBe(422);
      expect(nonstandardStart.json()).toMatchObject({
        error: "arena_paper_start_payload_unsupported",
        reason: "arena_paper_runtime_owns_candidate_start",
        candidate_id: queuedCandidateId
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toHaveLength(1);

      const getCandidate = store.getCandidate.bind(store);
      const listCandidates = store.listCandidates.bind(store);
      const queuedCandidate = await getCandidate(queuedCandidateId);
      if (!queuedCandidate) throw new Error("expected queued candidate detail");
      const duplicateCandidateId = `${queuedCandidateId}-ambiguous-copy`;
      store.listCandidates = async () => [
        ...await listCandidates(),
        {
          candidate_id: duplicateCandidateId,
          display_name: "Ambiguous candidate copy",
          status: "materialized",
          active_version_id: queuedCandidate.active_version_id,
          fixture_notice: queuedCandidate.fixture_notice
        }
      ];
      store.getCandidate = async (candidateId) => candidateId === duplicateCandidateId
        ? {
            ...structuredClone(queuedCandidate),
            candidate_id: duplicateCandidateId,
            display_name: "Ambiguous candidate copy"
          }
        : getCandidate(candidateId);

      const rejected = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: queuedCandidateId }
        }
      });
      expect(rejected.statusCode, rejected.body).toBe(422);
      expect(rejected.json()).toMatchObject({
        error: "arena_paper_candidate_ineligible",
        reason: "arena_paper_candidate_not_in_exact_admitted_set",
        candidate_id: queuedCandidateId
      });
      await expect(store.listPaperTradingEvaluations()).resolves.toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("starts the repeating arena loop with autonomous paper trading continuation", async () => {
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
      candidateArenaTickIntervalMs: 60_000,
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
      const started = await postCommand(server, {
        command_kind: "arena.start"
      });
      expect(started.operator.candidate_arena.runner_status).toBe("running");

      const runningOperator = await waitForOperator(server, (operator) =>
        operator.selected_paper_trading_evaluation.status === "running"
        && operator.selected_paper_trading_evaluation.runner_active
        && operator.selected_paper_trading_evaluation.observation_count >= 1
      );
      const selectedCandidateId = runningOperator.selected_candidate_id;

      expect(selectedCandidateId).toBeTruthy();
      expect(runningOperator.candidate_arena.runner_status).toBe("running");
      expect(runningOperator.candidate_arena.latest_ticks[0]?.created_candidate_ids)
        .toContain(selectedCandidateId);
      expect(runningOperator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 1,
        authority_status: "not_live"
      });

      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("records autonomous paper continuation evidence without waiting for a slow first paper observation", async () => {
    const store = new LocalStore(tmpDir);
    const paperProvider = delayedPaperTradingApiProviderFactory();
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: paperProvider.factory,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
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
      candidateArenaTickIntervalMs: 60_000,
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
      await postCommand(server, {
        command_kind: "arena.start"
      });
      await paperProvider.started;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const ackedResponse = await server.inject({
        method: "GET",
        url: "/api/operator"
      });
      expect(ackedResponse.statusCode, ackedResponse.body).toBe(200);
      const ackedOperator = (ackedResponse.json() as { operator: OperatorReadModel }).operator;
      expect(
        ackedOperator.candidate_arena.latest_ticks[0]?.paper_trading_continuation
      ).toBeUndefined();

      paperProvider.release();

      const runningOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.tick_count === 1
        && operator.candidate_arena.latest_ticks[0]?.paper_trading_continuation?.status === "started");

      expect(runningOperator.candidate_arena.latest_ticks[0]?.paper_trading_continuation)
        .toMatchObject({
          status: "started",
          command_kind: "trading_run.start",
          selected_candidate_id: runningOperator.selected_candidate_id,
          authority_status: "not_live"
        });
    } finally {
      paperProvider.release();
      await server.close();
    }
  });

  it("keeps observing a running Arena Paper Trading Evaluation on the autonomous schedule", async () => {
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
            price: 65_025,
            expected_direction: "long"
          },
          {
            price: 65_050,
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
      candidateArenaTickIntervalMs: 60_000,
      arenaPaperCapacity: 1,
      paperTradingEvaluationIntervalMs: 50,
      paperTradingSandboxIntervalMs: 10
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
      await postCommand(server, {
        command_kind: "arena.start"
      });

      const runningOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.tick_count === 1
        && operator.paper_trading_board.entries.some((entry) =>
          entry.status === "running"
          && entry.runner_status === "active"
          && entry.observation_count >= 2
        )
      );
      const evaluation = runningOperator.paper_trading_board.entries.find((entry) =>
        entry.status === "running"
        && entry.runner_status === "active"
        && entry.observation_count >= 2
      );
      if (!evaluation) throw new Error("expected active Arena Paper Trading Evaluation");
      const observations = await store.listPaperTradingObservations(evaluation.evaluation_id);

      expect(runningOperator.candidate_arena.latest_ticks).toHaveLength(1);
      expect(runningOperator.candidate_arena.latest_ticks[0]).toMatchObject({
        tick_id: "tick-1",
        paper_trading_continuation: {
          command_kind: "trading_run.start",
          selected_candidate_id: runningOperator.selected_candidate_id,
          authority_status: "not_live"
        }
      });
      expect(["started", "queued"]).toContain(
        runningOperator.candidate_arena.latest_ticks[0]
          ?.paper_trading_continuation?.status
      );
      expect(evaluation).toMatchObject({
        status: "running",
        runner_status: "active",
        observation_count: expect.any(Number),
        authority_status: "not_live"
      });
      expect(evaluation.observation_count).toBeGreaterThanOrEqual(2);
      expect(observations.length).toBeGreaterThanOrEqual(2);
      expect(observations[0]?.ledger_ref).toBeDefined();
      expect(observations.at(-1)?.ledger_ref).toBeUndefined();

      const stoppedPaper = await postCommand(server, {
        command_kind: "trading_run.stop",
        payload: { trading_run_id: evaluation.trading_run_id }
      });
      expect(stoppedPaper.operator.paper_trading_board.entries.find((entry) =>
        entry.evaluation_id === evaluation.evaluation_id
      )).toMatchObject({
        status: "stopped",
        runner_status: "inactive",
        authority_status: "not_live"
      });
      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("uses autonomous paper trading results as the next repeating arena generation source", async () => {
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
            price: 65_050,
            expected_direction: "long"
          }
        ],
        executionSnapshots: [
          {
            book_ticker: {
              bid_price: "64999",
              bid_quantity: "1.000",
              ask_price: "65001",
              ask_quantity: "1.000"
            }
          },
          {
            book_ticker: {
              bid_price: "65049",
              bid_quantity: "1.000",
              ask_price: "65051",
              ask_quantity: "1.000"
            }
          }
        ]
      }),
      candidateArenaTickIntervalMs: 100,
      arenaPaperCapacity: 1,
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
      await postCommand(server, {
        command_kind: "arena.start"
      });

      const runningOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.latest_ticks.some((tick) =>
          tick.tick_id === "tick-2"
          && tick.source_candidate?.source_kind === "paper_trading_evaluation_leader"
          && tick.paper_trading_continuation?.status === "queued"
        )
      );
      const firstTick = runningOperator.candidate_arena.latest_ticks.find((tick) => tick.tick_id === "tick-1");
      const secondTick = runningOperator.candidate_arena.latest_ticks.find((tick) => tick.tick_id === "tick-2");
      const paperSourceCandidateId = secondTick?.source_candidate?.candidate_id;
      const firstSelectedCandidateId = firstTick?.paper_trading_continuation?.selected_candidate_id;
      const selectedSecondCandidateId = secondTick?.paper_trading_continuation?.selected_candidate_id;
      const secondCandidate = selectedSecondCandidateId
        ? await store.getCandidate(selectedSecondCandidateId)
        : undefined;
      const paperSourceEntry = runningOperator.paper_trading_board.entries.find((entry) =>
        entry.candidate_id === paperSourceCandidateId
      );

      expect(firstTick?.paper_trading_continuation).toMatchObject({
        command_kind: "trading_run.start",
        authority_status: "not_live"
      });
      expect(["started", "queued"]).toContain(
        firstTick?.paper_trading_continuation?.status
      );
      expect(firstTick?.created_candidate_ids).toContain(firstSelectedCandidateId);
      expect(secondTick).toMatchObject({
        source_candidate: {
          source_kind: "paper_trading_evaluation_leader",
          candidate_id: paperSourceCandidateId,
          net_revenue_usdt: expect.any(Number),
          authority_status: "not_live"
        },
        paper_trading_continuation: {
          status: "queued",
          command_kind: "trading_run.start",
          selected_candidate_id: selectedSecondCandidateId,
          authority_status: "not_live"
        }
      });
      expect(paperSourceEntry).toMatchObject({
        candidate_id: paperSourceCandidateId,
        status: "running",
        runner_status: "active",
        observation_count: expect.any(Number),
        authority_status: "not_live"
      });
      expect(paperSourceEntry?.observation_count).toBeGreaterThan(0);
      expect(secondTick?.created_candidate_ids).toContain(selectedSecondCandidateId);
      expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).toBe(paperSourceCandidateId);
      expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).not.toBe(FIXTURE_CANDIDATE_ID);
      expect(runningOperator.paper_trading_board.entries.map((entry) => entry.candidate_id))
        .toContain(paperSourceCandidateId);

      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await server.close();
    }
  }, 40_000);

  it("resumes the persisted autonomous arena loop after runtime restart", async () => {
    const store = new LocalStore(tmpDir);
    let queuedCandidateId: string | undefined;
    let previouslyRunningCandidateIds: string[] = [];
    let recoveringCandidateId: string | undefined;
    let restartedArenaPaperRuntime: ArenaPaperRuntimeService | undefined;
    const firstServer = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
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
      candidateArenaTickIntervalMs: 60_000,
      arenaPaperCapacity: 2,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      await postCommand(firstServer, {
        command_kind: "agent_provider.setup",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "agent_provider.probe",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "researcher.provider.select",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "arena.start"
      });

      const runningOperator = await waitForOperator(firstServer, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.selected_paper_trading_evaluation.status === "running"
        && operator.selected_paper_trading_evaluation.runner_active
        && operator.paper_trading_board.entries.filter((entry) =>
          entry.status === "running" && entry.runner_status === "active"
        ).length === 2
      );
      expect(runningOperator.latest_commands[0]?.command_kind).toBe("arena.start");
      expect(runningOperator.candidate_arena.latest_ticks.map((tick) => tick.tick_id)).toContain("tick-1");
      previouslyRunningCandidateIds = runningOperator.paper_trading_board.entries
        .filter((entry) => entry.status === "running" && entry.runner_status === "active")
        .map((entry) => entry.candidate_id);
      expect(previouslyRunningCandidateIds).toHaveLength(2);
    } finally {
      await firstServer.close();
    }

    const restartedServer = await buildServer({
      store: new LocalStore(tmpDir),
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
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
      candidateArenaTickIntervalMs: 60_000,
      arenaPaperCapacity: 1,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000,
      onArenaPaperRuntimeCreated(service) {
        restartedArenaPaperRuntime = service;
      }
    });

    try {
      const resumedOperator = await waitForOperator(restartedServer, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.latest_ticks.some((tick) => tick.tick_id === "tick-2")
        && operator.candidate_arena.latest_ticks.some((tick) =>
          tick.tick_id === "tick-2"
          && tick.paper_trading_continuation?.status === "queued"
        )
        && operator.paper_trading_board.entries.filter((entry) =>
          entry.status === "running" && entry.runner_status === "active"
        ).length === 1
      );

      expect(resumedOperator.latest_commands[0]?.command_kind).toBe("arena.start");
      expect(resumedOperator.candidate_arena.runner_status).toBe("running");
      expect(resumedOperator.candidate_arena.latest_ticks.map((tick) => tick.tick_id)).toEqual(
        expect.arrayContaining(["tick-1", "tick-2"])
      );
      expect(resumedOperator.paper_trading_board.entries.some((entry) =>
        entry.status === "running" && entry.runner_status === "active"
      )).toBe(true);
      if (!restartedArenaPaperRuntime) {
        throw new Error("expected restarted Arena Paper runtime");
      }
      const restartedSnapshot = await restartedArenaPaperRuntime.snapshot();
      expect(restartedSnapshot).toMatchObject({
        capacity: 1,
        occupied_count: 1,
        running_count: 1
      });
      recoveringCandidateId = restartedSnapshot.systems.find((system) =>
        system.lifecycle_status === "running" && system.active
      )?.candidate_ref.id;
      expect(recoveringCandidateId).toEqual(expect.any(String));
      const previouslyRunningSystems = restartedSnapshot.systems.filter((system) =>
        previouslyRunningCandidateIds.includes(system.candidate_ref.id)
      );
      expect(previouslyRunningSystems).toHaveLength(2);
      expect(previouslyRunningSystems.filter((system) =>
        system.lifecycle_status === "running" && system.active
      )).toHaveLength(1);
      expect(previouslyRunningSystems.filter((system) =>
        system.lifecycle_status !== "running"
      ).every((system) =>
        system.lifecycle_status === "stopped" ||
        system.lifecycle_status === "queued" &&
          system.runtime_coordination_status === "arena_capacity_deferred"
      )).toBe(true);
      queuedCandidateId = resumedOperator.candidate_arena.latest_ticks.find((tick) =>
        tick.tick_id === "tick-2"
      )?.paper_trading_continuation?.selected_candidate_id;
      expect(queuedCandidateId).toEqual(expect.any(String));

      const stopped = await postCommand(restartedServer, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await restartedServer.close();
    }

    let readbackArenaPaperRuntime: ArenaPaperRuntimeService | undefined;
    const readbackServer = await buildServer({
      store: new LocalStore(tmpDir),
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort(),
      recoverPaperTradingSessionsOnStart: false,
      runResearchControlStudiesOnStart: false,
      onArenaPaperRuntimeCreated(service) {
        readbackArenaPaperRuntime = service;
      }
    });
    try {
      const response = await readbackServer.inject({
        method: "GET",
        url: "/api/operator"
      });
      expect(response.statusCode, response.body).toBe(200);
      expect((response.json() as { operator: OperatorReadModel }).operator.selected_candidate_id)
        .toBe(queuedCandidateId);
      if (!recoveringCandidateId || !readbackArenaPaperRuntime) {
        throw new Error("expected persisted recovering Arena paper system");
      }
      expect((await readbackArenaPaperRuntime.snapshot()).systems.find((system) =>
        system.candidate_ref.id === recoveringCandidateId
      )).toMatchObject({
        lifecycle_status: "recovering",
        active: false
      });

      const resumed = await readbackServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: recoveringCandidateId }
        }
      });
      expect(resumed.statusCode, resumed.body).toBe(200);
      expect(resumed.json()).toMatchObject({
        result: {
          status: "resumed",
          runner_status: "running"
        }
      });
      expect((await readbackArenaPaperRuntime.snapshot()).systems.find((system) =>
        system.candidate_ref.id === recoveringCandidateId
      )).toMatchObject({
        lifecycle_status: "running",
        active: true
      });
    } finally {
      await readbackServer.close();
    }
  });

  it("continues arena tick ids when the stopped loop is manually restarted after runtime restart", async () => {
    const store = new LocalStore(tmpDir);
    const firstServer = await buildServer({
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
            price: 65_050,
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
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      await postCommand(firstServer, {
        command_kind: "agent_provider.setup",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "agent_provider.probe",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "researcher.provider.select",
        payload: { provider: "fixture" }
      });
      await postCommand(firstServer, {
        command_kind: "arena.start"
      });

      await waitForOperator(firstServer, (operator) =>
        operator.candidate_arena.latest_ticks.some((tick) =>
          tick.tick_id === "tick-1"
          && tick.paper_trading_continuation?.status === "started"
        )
      );
      const stopped = await postCommand(firstServer, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await firstServer.close();
    }

    const restartedServer = await buildServer({
      store: new LocalStore(tmpDir),
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
            price: 65_050,
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
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      await postCommand(restartedServer, {
        command_kind: "arena.start"
      });
      const runningOperator = await waitForOperator(restartedServer, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.latest_ticks.some((tick) =>
          tick.tick_id === "tick-2"
          && tick.paper_trading_continuation?.status === "queued"
        )
      );
      const secondTick = runningOperator.candidate_arena.latest_ticks.find((tick) =>
        tick.tick_id === "tick-2"
      );
      expect(runningOperator.candidate_arena.latest_ticks.map((tick) => tick.tick_id)).toEqual(
        expect.arrayContaining(["tick-1", "tick-2"])
      );
      expect(runningOperator.selected_candidate_id)
        .toBe(secondTick?.paper_trading_continuation?.selected_candidate_id);

      const stopped = await postCommand(restartedServer, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await restartedServer.close();
    }
  });

  it("drains active arena ticks on runtime close before stopping paper sessions", async () => {
    const store = new LocalStore(tmpDir);
    const artifactRunner = delayedPaperDirectArenaArtifactRunner();
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: artifactRunner,
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [{
          price: 65_000,
          expected_direction: "long"
        }],
        executionSnapshots: [{
          book_ticker: {
            bid_price: "64999",
            bid_quantity: "1.000",
            ask_price: "65001",
            ask_quantity: "1.000"
          }
        }]
      }),
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

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
    await postCommand(server, {
      command_kind: "arena.start"
    });
    await artifactRunner.started;

    const closing = server.close();
    await expect(Promise.race([
      closing.then(() => "closed" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25))
    ])).resolves.toBe("pending");

    artifactRunner.release();
    await closing;

    expect(await store.listPaperTradingEvaluations()).toEqual([]);
    expect(
      (await store.listCandidateArenaTicks())
        .find((tick) => tick.tick_id === "tick-1")
        ?.paper_trading_continuation
    ).toBeUndefined();
  });

  it("records autonomous paper continuation failures without stopping the arena loop", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: async () => {
        throw new Error("paper_provider_unavailable_for_test");
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            expected_direction: "long"
          }
        ]
      }),
      candidateArenaTickIntervalMs: 500,
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
      const started = await postCommand(server, {
        command_kind: "arena.start"
      });
      expect(started.operator.candidate_arena.runner_status).toBe("running");

      const runningOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.runner_status === "running"
        && operator.candidate_arena.latest_ticks.filter((tick) =>
          tick.paper_trading_continuation?.status === "failed"
        ).length >= 2
      );
      const failedContinuationTick = runningOperator.candidate_arena.latest_ticks.find((tick) =>
        tick.paper_trading_continuation?.status === "failed"
      );

      expect(failedContinuationTick?.paper_trading_continuation).toMatchObject({
        status: "failed",
        command_kind: "trading_run.start",
        selected_candidate_id: expect.any(String),
        error: "paper_provider_unavailable_for_test",
        authority_status: "not_live"
      });
      expect(runningOperator.candidate_arena.runner_status).toBe("running");

      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("fails autonomous continuation on missing admitted conformance without paper effects", async () => {
    const store = new LocalStore(tmpDir);
    const getCandidate = store.getCandidate.bind(store);
    store.getCandidate = async (candidateId) => {
      const candidate = await getCandidate(candidateId);
      if (candidate?.materialization_attempt?.provider_kind === "fixture_only") {
        candidate.materialization_attempt.provider_kind = "codex_cli";
        candidate.materialization_attempt.model = "gpt-5-codex";
      }
      return candidate;
    };
    const getConformance = store.getPaperTradingHandoffConformance.bind(store);
    store.getPaperTradingHandoffConformance = async (conformanceId) => {
      await getConformance(conformanceId);
      return undefined;
    };
    let providerStartCount = 0;
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: async (...args) => {
        providerStartCount += 1;
        return networklessPaperTradingApiProvider(...args);
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      const baseline = {
        commitments: (await store.listPaperTradingEvaluationCommitments()).length,
        evaluations: (await store.listPaperTradingEvaluations()).length,
        observations: await paperTradingObservationCount(store),
        sandboxes: (await store.listSandboxes()).length
      };
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
      await postCommand(server, { command_kind: "arena.start" });

      const operator = await waitForOperator(server, (readModel) =>
        readModel.candidate_arena.runner_status === "running" &&
        readModel.candidate_arena.latest_ticks.some((tick) =>
          tick.paper_trading_continuation?.status === "failed" &&
          tick.paper_trading_continuation.error === "paper_handoff_conformance_missing"
        )
      );
      const failed = operator.candidate_arena.latest_ticks.find((tick) =>
        tick.paper_trading_continuation?.error === "paper_handoff_conformance_missing"
      );
      const failedCandidateId = failed?.paper_trading_continuation
        ?.selected_candidate_id;
      expect(failed?.paper_trading_continuation).toMatchObject({
        status: "failed",
        command_kind: "trading_run.start",
        selected_candidate_id: expect.any(String),
        error: "paper_handoff_conformance_missing",
        authority_status: "not_live"
      });
      expect(operator.candidate_arena.runner_status).toBe("running");
      expect(providerStartCount).toBe(0);
      expect(await store.listPaperTradingEvaluationCommitments()).toHaveLength(
        baseline.commitments
      );
      expect(await store.listPaperTradingEvaluations()).toHaveLength(baseline.evaluations);
      expect(await paperTradingObservationCount(store)).toBe(baseline.observations);
      expect(await store.listSandboxes()).toHaveLength(baseline.sandboxes);
      if (!failedCandidateId) throw new Error("expected failed Arena candidate");
      const failedCandidate = await store.getCandidate(failedCandidateId);
      if (!failedCandidate) throw new Error("expected failed candidate detail");
      await expect(store.getTradingRun(failedCandidate.runtime.ref.id)).resolves
        .toMatchObject({
          runtime_lifecycle_status: "failed",
          run_control_command_refs: [
            { record_kind: "run_control_command", id: expect.any(String) }
          ],
          runtime_audit_event_refs: [
            { record_kind: "runtime_audit_event", id: expect.any(String) }
          ]
        });

      await postCommand(server, { command_kind: "arena.stop" });

      let restartedStartCount = 0;
      const restartedRuntime = new ArenaPaperRuntimeService({
        store,
        paperTrading: {
          active: () => false,
          start: async () => {
            restartedStartCount += 1;
            return {
              statusCode: 500,
              body: { error: "unexpected_restart_attempt" }
            };
          },
          stop: async () => ({
            statusCode: 200,
            body: { status: "stopped" }
          })
        }
      });
      const recovered = await restartedRuntime.reconcile();
      expect(restartedStartCount).toBe(0);
      expect(recovered.systems.find((system) =>
        system.candidate_ref.id === failedCandidateId
      )).toMatchObject({
        lifecycle_status: "failed",
        failure_reason: "arena_paper_run_missing_evaluation"
      });
    } finally {
      await server.close();
    }
  });

  it("does not persist autonomous paper continuation ack before late paper start settles", async () => {
    const store = new LocalStore(tmpDir);
    let rejectLatePaperStart: ((error: Error) => void) | undefined;
    let latePaperStart: Promise<never> | undefined;
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: () => {
        latePaperStart ??= new Promise<never>((_resolve, reject) => {
          rejectLatePaperStart = reject;
        });
        return latePaperStart;
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            expected_direction: "long"
          }
        ]
      }),
      candidateArenaTickIntervalMs: 60_000,
      arenaPaperCapacity: 1,
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
      await postCommand(server, {
        command_kind: "arena.start"
      });

      const tickedOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.latest_ticks.some((tick) => tick.tick_id === "tick-1")
      );
      expect(tickedOperator.candidate_arena.latest_ticks
        .find((tick) => tick.tick_id === "tick-1")
        ?.created_candidate_ids.length).toBeGreaterThan(0);
      for (let attempt = 0; attempt < 120 && !rejectLatePaperStart; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!rejectLatePaperStart) {
        throw new Error("paper start was not attempted before ack");
      }
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const ackedResponse = await server.inject({
        method: "GET",
        url: "/api/operator"
      });
      expect(ackedResponse.statusCode, ackedResponse.body).toBe(200);
      const ackedOperator = (ackedResponse.json() as { operator: OperatorReadModel }).operator;
      expect(
        ackedOperator.candidate_arena.latest_ticks.find((tick) => tick.tick_id === "tick-1")
          ?.paper_trading_continuation
      ).toBeUndefined();

      rejectLatePaperStart(new Error("late_paper_provider_unavailable_for_test"));

      const failedOperator = await waitForOperator(server, (operator) =>
        operator.candidate_arena.latest_ticks.some((tick) =>
          tick.tick_id === "tick-1"
          && tick.paper_trading_continuation?.status === "failed"
          && tick.paper_trading_continuation.error === "late_paper_provider_unavailable_for_test"
        )
      );
      const failedTick = failedOperator.candidate_arena.latest_ticks.find((tick) =>
        tick.tick_id === "tick-1"
      );
      expect(failedTick?.paper_trading_continuation).toMatchObject({
        status: "failed",
        command_kind: "trading_run.start",
        selected_candidate_id: expect.any(String),
        error: "late_paper_provider_unavailable_for_test",
        authority_status: "not_live"
      });
      expect(failedOperator.candidate_arena.runner_status).toBe("running");

      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("bounds runtime close while autonomous paper start remains pending", async () => {
    const store = new LocalStore(tmpDir);
    let markPaperStartAttempted = () => {};
    const paperStartAttempted = new Promise<void>((resolve) => {
      markPaperStartAttempted = resolve;
    });
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: () =>
        new Promise<never>(() => {
          markPaperStartAttempted();
        }),
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            expected_direction: "long"
          }
        ]
      }),
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

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
    await postCommand(server, {
      command_kind: "arena.start"
    });
    await paperStartAttempted;
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const closing = server.close();
    await expect(Promise.race([
      closing.then(() => "closed" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 2_500))
    ])).resolves.toBe("closed");
  });

  it("stops autonomous paper starts that complete after runtime close", async () => {
    const store = new LocalStore(tmpDir);
    const paperProvider = delayedPaperTradingApiProviderFactory();
    let arenaPaperRuntime: ArenaPaperRuntimeService | undefined;
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: paperProvider.factory,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
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
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000,
      onArenaPaperRuntimeCreated(service) {
        arenaPaperRuntime = service;
      }
    });

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
    await postCommand(server, {
      command_kind: "arena.start"
    });
    await paperProvider.started;

    const closing = server.close();
    await expect(Promise.race([
      closing.then(() => "closed" as const),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 25))
    ])).resolves.toBe("pending");
    await closing;

    paperProvider.release();
    if (!arenaPaperRuntime) throw new Error("expected Arena Paper runtime");
    await arenaPaperRuntime.reconcile();
    let evaluations = await store.listPaperTradingEvaluations();
    for (let attempt = 0; attempt < 120 && !(
      evaluations.length === 2 && evaluations.every((evaluation) =>
        evaluation.status === "stopped" && Boolean(evaluation.stopped_at)
      )
    ); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      evaluations = await store.listPaperTradingEvaluations();
    }
    expect(evaluations).toHaveLength(2);
    expect(evaluations.every((evaluation) =>
      evaluation.status === "stopped" && Boolean(evaluation.stopped_at)
    )).toBe(true);
  });

  it("stops pending autonomous paper starts when the arena loop stops", async () => {
    const store = new LocalStore(tmpDir);
    const paperProvider = delayedPaperTradingApiProviderFactory();
    let arenaPaperRuntime: ArenaPaperRuntimeService | undefined;
    const server = await buildServer({
      store,
      candidateArenaArtifactRunner: paperDirectArenaArtifactRunner(),
      candidateArenaReplayProviderFactory: networklessReplayTradingApiProvider,
      paperTradingApiProviderFactory: paperProvider.factory,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
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
      candidateArenaTickIntervalMs: 60_000,
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000,
      onArenaPaperRuntimeCreated(service) {
        arenaPaperRuntime = service;
      }
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
      await postCommand(server, {
        command_kind: "arena.start"
      });
      await paperProvider.started;

      const stopped = await postCommand(server, {
        command_kind: "arena.stop"
      });
      expect(stopped.operator.candidate_arena.runner_status).toBe("stopped");

      paperProvider.release();
      if (!arenaPaperRuntime) throw new Error("expected Arena Paper runtime");
      await arenaPaperRuntime.reconcile();
      let evaluations = await store.listPaperTradingEvaluations();
      for (let attempt = 0; attempt < 120 && !(
        evaluations.length === 2 && evaluations.every((evaluation) =>
          evaluation.status === "stopped" && Boolean(evaluation.stopped_at)
        )
      ); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        evaluations = await store.listPaperTradingEvaluations();
      }
      expect(evaluations).toHaveLength(2);
      expect(evaluations.every((evaluation) =>
        evaluation.status === "stopped" && Boolean(evaluation.stopped_at)
      )).toBe(true);

      const ticks = await store.listCandidateArenaTicks();
      expect(ticks.find((tick) => tick.tick_id === "tick-1")?.paper_trading_continuation)
        .toBeUndefined();
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
      expect(initialStatus.stdout).toContain("Paper Trading Evaluation: not_started");
      expect(initialStatus.stdout).toContain("Promote a selected Paper Trading Evaluation candidate from Arena to Trading review.");
      expect(initialStatus.stdout).toContain("Start or continue Paper Trading Evaluation, then promote a qualified candidate to Trading review.");
      expect(initialStatus.stdout).not.toContain("PaperTradingEvaluation");
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
      expect(["order_request", "hold"]).toContain(
        evidenceBody.operator.selected_paper_trading_evaluation
          .latest_decision?.decision_kind
      );

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
      expect(humanStatus.stdout).toContain("Paper Trading Evaluation: running");
      expect(humanStatus.stdout).not.toContain("PaperTradingEvaluation:");
      expect(humanStatus.stdout).toContain("Paper market snapshot:");
      expect(humanStatus.stdout).not.toContain("Market snapshot:");
      expect(humanStatus.stdout).toContain("Gateway market data:");
      expect(humanStatus.stdout).not.toContain("Market data:");
      expect(humanStatus.stdout).toContain("Public execution evidence:");
      expect(humanStatus.stdout).not.toContain("Public execution:");
      expect(humanStatus.stdout).toContain("Paper decision: hold");
      expect(humanStatus.stdout).toContain("Paper account: equity");
      expect(humanStatus.stdout).toContain("Paper fill: filled 0.001 @ 60000 / trade product-loop-fill");

      await server.close();
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
            runner_active: true,
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
        expect(restartedHumanStatus.stdout).toContain("Paper runner: active");
        const restartedTui = renderToString(
          <OperatorTuiScreen
            operator={restartedOperatorBody.operator}
            cursor={0}
          />
        );
        expect(restartedTui).toContain("Paper runner: active");
        expect(restartedTui).not.toContain("Runner: needs resume / persisted running, timer inactive");
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
            status: "already_running",
            runner_status: "running"
          },
          operator: {
            selected_paper_trading_evaluation: {
              status: "running",
              runner_active: true,
              observation_count: 2,
              authority_status: "not_live"
            }
          }
        });
        const candidate = await restartedServer.inject({
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
      } finally {
        await restartedServer.close();
      }

      const tui = renderToString(
        <OperatorTuiScreen
          operator={finalOperator}
          cursor={0}
          message="product loop smoke"
        />
      );
      expect(tui).toContain("Ouroboros Action Console");
      expect(tui).toContain("Researcher provider: fixture");
      expect(tui).toContain("Operator authority: not_live / live disabled");
      expect(tui).not.toContain("Authority: not_live / live disabled");
      expect(tui).toContain(`Selected Candidate\n${leader.candidate_id}`);
      expect(tui).toContain("Paper Trading Evaluation: running");
      expect(tui).not.toContain("PaperTradingEvaluation:");
      expect(tui).toContain("Paper decision: hold");
      expect(tui).toContain("Paper account: equity");
      expect(tui).not.toContain("Decision: hold");
      expect(tui).not.toContain("Account: equity");
      expect(tui).toContain("Paper market snapshot:");
      expect(tui).not.toContain("Market:");
      expect(tui).toContain("Gateway market data:");
      expect(tui).not.toContain("Market data:");
      expect(tui).toContain("Public execution evidence:");
      expect(tui).not.toContain("Public execution:");
      expect(tui).toContain("paper runner active, market provenance binance_production_public_rest /");
      expect(tui).toContain("websocket_primary, paper fill filled, paper open orders 0");
      expect(tui).not.toContain("   runner active, market");
      expect(tui).toContain("Paper ledger chain: complete");
      expect(tui).not.toContain("Ledger chain: complete");
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

async function waitForOperator(
  server: Awaited<ReturnType<typeof buildServer>>,
  predicate: (operator: OperatorReadModel) => boolean,
  attempts = 60
): Promise<OperatorReadModel> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await server.inject({
      method: "GET",
      url: "/api/operator"
    });
    expect(response.statusCode, response.body).toBe(200);
    const operator = (response.json() as { operator: OperatorReadModel }).operator;
    if (predicate(operator)) {
      return operator;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("operator did not satisfy expected state before timeout");
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
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      await mkdir(input.output_dir, { recursive: true });
      const eventsPath = path.join(input.output_dir, "events.jsonl");
      const market = input.provider.candidate_input.market;
      const account = input.provider.candidate_input.account;
      const declaredBehavior = await declaredArenaArtifactBehavior(input.artifact_dir);
      const shouldHold = market.moving_average_fast === market.moving_average_slow ||
        declaredBehavior.forceHold;
      const orderRequest = shouldHold
        ? {
            symbol: market.symbol,
            side: "hold" as const,
            quantity: 0,
            order_type: "none" as const,
            reason: "flat replay regime holds through provider validation"
          }
        : {
            symbol: market.symbol,
            side: declaredBehavior.forceSell ||
              market.moving_average_fast < market.moving_average_slow
              ? "sell" as const
              : "buy" as const,
            quantity: Number((account.equity * Math.min(
              declaredBehavior.riskFraction,
              account.max_risk_fraction
            ) / market.price).toFixed(8)),
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
        provider_requests: providerBoundaryRequests(orderRequest)
      };
    }
  };
}

async function declaredArenaArtifactBehavior(artifactDir: string): Promise<{
  riskFraction: number;
  forceSell: boolean;
  forceHold: boolean;
}> {
  const source = await readFile(path.join(artifactDir, "run.py"), "utf8");
  const riskFraction = Number(source.match(/RISK_FRACTION = ([0-9.]+)/)?.[1]);
  return {
    riskFraction: Number.isFinite(riskFraction) && riskFraction > 0
      ? riskFraction
      : 0.02,
    forceSell: source.includes("mean reversion candidate shorts"),
    forceHold: source.includes("funding-aware candidate holds")
  };
}

async function paperTradingObservationCount(store: LocalStore): Promise<number> {
  const evaluations = await store.listPaperTradingEvaluations();
  const observations = await Promise.all(evaluations.map((evaluation) =>
    store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id)
  ));
  return observations.reduce((count, items) => count + items.length, 0);
}

function paperDirectArenaArtifactRunner(): TradingArtifactRunner {
  const replayRunner = networklessReplayArtifactRunner();
  return {
    kind: "host_process",
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    run: (input) => replayRunner.run(input)
  };
}

function delayedPaperDirectArenaArtifactRunner(): TradingArtifactRunner & {
  started: Promise<void>;
  release: () => void;
} {
  const replayRunner = networklessReplayArtifactRunner();
  let markStarted = () => {};
  let release = () => {};
  let blocked = false;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    kind: "host_process",
    started,
    release,
    async probePaperHandoff(input) {
      return passingPaperHandoffProbe(input);
    },
    async run(input) {
      markStarted();
      if (!blocked) {
        blocked = true;
        await released;
      }
      return replayRunner.run(input);
    }
  };
}

async function networklessReplayTradingApiProvider(
  candidateInput: ReplayTradingCandidateInput
): Promise<ReplayTradingApiProviderSession> {
  return {
    base_url: "http://replay-provider.test",
    close: async () => undefined,
    requests: () => [],
    candidate_input: candidateInput
  };
}

async function networklessPaperTradingApiProvider(
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions
): Promise<ReplayTradingApiProviderSession> {
  return startPaperTradingApiProvider(binding, options);
}

function delayedPaperTradingApiProviderFactory(): {
  factory: typeof networklessPaperTradingApiProvider;
  started: Promise<void>;
  release: () => void;
} {
  let markStarted = () => {};
  let release = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    started,
    release,
    async factory(binding, options) {
      markStarted();
      await released;
      return networklessPaperTradingApiProvider(binding, options);
    }
  };
}

function providerBoundaryRequests(orderRequest?: unknown): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate", orderRequest)
  ];
}

function providerRequest(method: string, requestPath: string, body?: unknown): TradingProviderRequestLog {
  return {
    at: "2026-05-16T00:00:00.000Z",
    method,
    path: requestPath,
    ...(body === undefined ? {} : { body }),
    response_status: 200
  };
}
