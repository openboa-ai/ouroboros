import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import type {
  ReplayTradingApiProviderSession
} from "@ouroboros/application/trading/research/types";
import type {
  OuroborosCommandKind,
  OuroborosCommandRequest,
  OperatorReadModel,
  SandboxCommandEvidenceRecord,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore, LocalStoreError } from "@ouroboros/local-store";
import type {
  SandboxAdapter,
  SandboxAdapterObservationResult,
  SandboxAdapterStartInput,
  SandboxAdapterStartResult
} from "@ouroboros/adapters/sandbox/adapter";
import { buildServer } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-long-paper-session-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("long-running paper TradingSystem sessions", () => {
  it("observes a running TradingSystem without replaying old events or inventing snapshot decisions", async () => {
    const store = new LocalStore(tmpDir);
    const sandboxAdapter = queuedLongRunningSandboxAdapter([
      [paperOrderLine("long-session-order-0001", "2026-05-16T00:00:03.000Z")],
      [],
      [paperHoldLine("long-session-hold-0001", "2026-05-16T00:02:03.000Z")]
    ]);
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, observed_at: "2026-05-16T00:00:03.000Z" },
          { price: 65_100, observed_at: "2026-05-16T00:01:03.000Z" },
          { price: 65_200, observed_at: "2026-05-16T00:02:03.000Z" }
        ],
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "long-session-fill-0001",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 1,
        latest_decision: {
          decision_kind: "order_request",
          reason: "long_running_session_limit_order"
        },
        paper_account_snapshot: {
          position: {
            side: "long",
            quantity: "0.001"
          }
        }
      });
      expect(started.operator.selected_candidate?.runtime.sandbox).toMatchObject({
        lifecycle_status: "running",
        last_heartbeat_at: "2026-05-16T00:01:03.000Z"
      });
      expect(sandboxAdapter.startCalls()).toBe(1);

      const tradingRunId = started.operator.selected_paper_trading_evaluation.trading_run_id;
      expect(tradingRunId).toEqual(expect.any(String));

      const checkpoint = await postCommand(server, {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: tradingRunId }
      });
      expect(checkpoint.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 2,
        latest_decision: {
          decision_kind: "order_request",
          reason: "long_running_session_limit_order"
        }
      });
      expect(checkpoint.operator.selected_paper_trading_evaluation.paper_account_snapshot).toMatchObject({
        position: {
          side: "long",
          quantity: "0.001",
          mark_price: "65200"
        }
      });
      expect(sandboxAdapter.startCalls()).toBe(1);

      const evaluationId = checkpoint.operator.selected_paper_trading_evaluation.evaluation_id;
      expect(evaluationId).toEqual(expect.any(String));
      const observationsAfterCheckpoint = await store.listPaperTradingObservations(evaluationId!);
      expect(observationsAfterCheckpoint.at(-1)).toMatchObject({
        status: "no_order",
        processed_trading_system_event_ids: ["long-session-order-0001"]
      });
      expect(observationsAfterCheckpoint.at(-1)?.decision).toBeUndefined();

      const held = await postCommand(server, {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: tradingRunId }
      });
      expect(held.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 3,
        latest_decision: {
          decision_kind: "hold",
          reason: "long running session emitted no fresh trade setup"
        }
      });
      expect(sandboxAdapter.startCalls()).toBe(1);

      const stopped = await postCommand(server, {
        command_kind: "trading_run.stop",
        payload: { trading_run_id: tradingRunId }
      });
      expect(stopped.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "stopped",
        runner_active: false
      });
      expect(stopped.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("stopped");
      expect(sandboxAdapter.stopCalls()).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("stops the linked sandbox when paper evaluation fails", async () => {
    const store = new LocalStore(tmpDir);
    const sandboxAdapter = queuedLongRunningSandboxAdapter([
      [paperOrderLine("failed-session-order-0001", "2026-05-16T00:00:03.000Z")]
    ]);
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, observed_at: "2026-05-16T00:00:03.000Z" },
          { price: 65_000, observed_at: "2026-05-16T00:00:04.000Z" }
        ],
        failPublicExecutionSnapshot: true
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "failed",
        runner_active: false,
        latest_failure_reason: "fake public execution stream unavailable"
      });
      expect(started.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("stopped");
      expect(sandboxAdapter.stopCalls()).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("stops the linked sandbox when trading run start fails after sandbox launch", async () => {
    const store = new LocalStore(tmpDir);
    store.recordRunControlAudit = (async () => {
      throw new LocalStoreError("invalid_run_control_input", "forced run control failure");
    }) as typeof store.recordRunControlAudit;
    const sandboxAdapter = queuedLongRunningSandboxAdapter([
      [paperOrderLine("start-failure-order-0001", "2026-05-16T00:00:03.000Z")]
    ]);
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, observed_at: "2026-05-16T00:00:03.000Z" }
        ],
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "start-failure-fill-0001",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });

      expect(response.statusCode).toBe(422);
      expect(response.json()).toMatchObject({
        error: "trading_run_failed",
        reason: "invalid_run_control_input"
      });
      expect(sandboxAdapter.startCalls()).toBe(1);
      expect(sandboxAdapter.stopCalls()).toBe(1);
      const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
      expect(candidate?.runtime.sandbox?.lifecycle_status).toBe("stopped");
    } finally {
      await server.close();
    }
  });

  it("restarts a resumed sandbox when status returns only stale heartbeat evidence", async () => {
    const store = new LocalStore(tmpDir);
    const firstSandbox = queuedLongRunningSandboxAdapter([
      [paperOrderLine("stale-resume-order-0001", "2026-05-16T00:00:03.000Z")]
    ]);
    const firstServer = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, observed_at: "2026-05-16T00:00:03.000Z" }
        ],
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "stale-resume-fill-0001",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    let staleHeartbeatAt: string | undefined;
    try {
      const started = await postCommand(firstServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running"
      });
      staleHeartbeatAt = started.operator.selected_candidate?.runtime.sandbox?.last_heartbeat_at;
      expect(staleHeartbeatAt).toEqual(expect.any(String));
    } finally {
      await firstServer.close();
    }
    const stoppedSandbox = (await store.getCandidate(FIXTURE_CANDIDATE_ID))?.runtime.sandbox;
    expect(stoppedSandbox?.lifecycle_status).toBe("stopped");
    await store.recordSandboxStart({
      placement: sandboxPlacement(stoppedSandbox!.sandbox_placement_ref.id),
      instance: {
        record_kind: "sandbox",
        version: 1,
        sandbox_id: stoppedSandbox!.sandbox_id,
        adapter_kind: stoppedSandbox!.adapter_kind,
        system_code_ref: stoppedSandbox!.system_code_ref,
        runtime_ref: stoppedSandbox!.runtime_ref,
        sandbox_placement_ref: stoppedSandbox!.sandbox_placement_ref,
        lifecycle_status: "running",
        sandbox_name: stoppedSandbox!.sandbox_name,
        sandbox_ref: stoppedSandbox!.sandbox_ref,
        created_at: stoppedSandbox!.created_at,
        started_at: stoppedSandbox!.started_at,
        last_heartbeat_at: staleHeartbeatAt,
        log_refs: stoppedSandbox!.log_refs,
        heartbeat_refs: stoppedSandbox!.heartbeat_refs,
        command_evidence_refs: stoppedSandbox!.command_evidence_refs,
        trace_ref: stoppedSandbox!.trace_ref,
        authority_status: "not_live"
      } satisfies SandboxRecord,
      logs: [],
      heartbeats: [],
      command_evidence: []
    });

    const resumedSandbox = queuedLongRunningSandboxAdapter(
      [[paperHoldLine("stale-resume-hold-0001", "2026-05-16T00:01:03.000Z")]],
      [],
      staleHeartbeatAt
    );
    const resumedServer = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: resumedSandbox
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_100, observed_at: "2026-05-16T00:01:03.000Z" }
        ],
        executionSnapshots: [{
          agg_trades: []
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const resumed = await postCommand(resumedServer, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      expect(resumed.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running"
      });
      expect(resumedSandbox.stopCalls()).toBe(1);
      expect(resumedSandbox.startCalls()).toBe(1);
    } finally {
      await resumedServer.close();
    }
  });

  it("fails paper evaluation when the linked TradingSystem sandbox crashes", async () => {
    const store = new LocalStore(tmpDir);
    const sandboxAdapter = queuedLongRunningSandboxAdapter(
      [
        [paperOrderLine("crashed-session-order-0001", "2026-05-16T00:00:03.000Z")],
        []
      ],
      [undefined, "failed"]
    );
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter
      },
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, observed_at: "2026-05-16T00:00:03.000Z" },
          { price: 65_100, observed_at: "2026-05-16T00:01:03.000Z" }
        ],
        executionSnapshots: [{
          agg_trades: [{
            trade_id: "crashed-session-fill-0001",
            price: "60000",
            quantity: "0.001",
            trade_time: "2026-05-16T00:00:03.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });

      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: FIXTURE_CANDIDATE_ID }
      });
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 1
      });

      const tradingRunId = started.operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await postCommand(server, {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: tradingRunId }
      });

      expect(observed.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "failed",
        runner_active: false,
        observation_count: 2,
        latest_failure_reason: "paper_trading_sandbox_failed"
      });
      expect(observed.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("stopped");
      expect(sandboxAdapter.stopCalls()).toBe(1);
    } finally {
      await server.close();
    }
  });
});

interface InspectableSandboxAdapter extends SandboxAdapter {
  startCalls(): number;
  stopCalls(): number;
}

function queuedLongRunningSandboxAdapter(
  logBatches: string[][],
  lifecycleStatuses: Array<SandboxRecord["lifecycle_status"] | undefined> = [],
  statusHeartbeatAt?: string
): InspectableSandboxAdapter {
  let startCallCount = 0;
  let stopCallCount = 0;
  let logReadCount = 0;
  let instanceId = "sandbox-long-running-paper-session";

  return {
    kind: "deterministic_test",
    startCalls: () => startCallCount,
    stopCalls: () => stopCallCount,
    async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
      startCallCount += 1;
      instanceId = input.instance_id;
      const placementRef = { record_kind: "sandbox_placement" as const, id: input.sandbox_placement_id };
      const sandboxRef = { record_kind: "sandbox" as const, id: input.instance_id };
      return {
        placement: sandboxPlacement(input.sandbox_placement_id),
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
          last_heartbeat_at: input.created_at,
          log_refs: [],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        } satisfies SandboxRecord,
        logs: [],
        heartbeats: [{
          record_kind: "runtime_heartbeat",
          version: 1,
          runtime_heartbeat_id: `runtime-heartbeat-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          heartbeat_line: JSON.stringify({
            event: "runtime_heartbeat",
            instance_id: input.instance_id,
            tick: 0,
            at: input.created_at
          }),
          observed_at: input.created_at,
          authority_status: "trace_only"
        }],
        command_evidence: [commandEvidence(input.instance_id, "start", input.created_at)]
      };
    },
    async getArtifactInstanceStatus(): Promise<SandboxAdapterObservationResult> {
      if (!statusHeartbeatAt) {
        return {};
      }
      return {
        heartbeats: [{
          record_kind: "runtime_heartbeat",
          version: 1,
          runtime_heartbeat_id: `runtime-heartbeat-${instanceId}-status-stale`,
          sandbox_ref: { record_kind: "sandbox", id: instanceId },
          heartbeat_line: JSON.stringify({
            event: "runtime_heartbeat",
            instance_id: instanceId,
            tick: 0,
            at: statusHeartbeatAt
          }),
          observed_at: statusHeartbeatAt,
          authority_status: "trace_only"
        }]
      };
    },
    async getArtifactInstanceLogs(): Promise<SandboxAdapterObservationResult> {
      logReadCount += 1;
      const lines = logBatches[Math.min(logReadCount - 1, logBatches.length - 1)] ?? [];
      const capturedAt = `2026-05-16T00:0${Math.min(logReadCount, 9)}:03.000Z`;
      return {
        lifecycle_status: lifecycleStatuses[Math.min(logReadCount - 1, lifecycleStatuses.length - 1)],
        logs: lines.length
          ? [{
              record_kind: "sandbox_log",
              version: 1,
              sandbox_log_id: `sandbox-log-${instanceId}-read-${logReadCount}`,
              sandbox_ref: { record_kind: "sandbox", id: instanceId },
              lines,
              captured_at: capturedAt,
              authority_status: "trace_only"
            } satisfies SandboxLogRecord]
          : [],
        heartbeats: [{
          record_kind: "runtime_heartbeat",
          version: 1,
          runtime_heartbeat_id: `runtime-heartbeat-${instanceId}-read-${logReadCount}`,
          sandbox_ref: { record_kind: "sandbox", id: instanceId },
          heartbeat_line: JSON.stringify({
            event: "runtime_heartbeat",
            instance_id: instanceId,
            tick: logReadCount,
            at: capturedAt
          }),
          observed_at: capturedAt,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance): Promise<SandboxAdapterObservationResult> {
      stopCallCount += 1;
      return {
        lifecycle_status: "stopped",
        stopped_at: "2026-05-16T00:03:03.000Z",
        command_evidence: [commandEvidence(instance.sandbox_id, "stop", "2026-05-16T00:03:03.000Z")]
      };
    }
  };
}

function paperOrderLine(eventId: string, at: string): string {
  return JSON.stringify({
    event: "order_request",
    event_id: eventId,
    instance_id: "long-running-paper-session",
    at,
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    reason: "long_running_session_limit_order"
  });
}

function paperHoldLine(eventId: string, at: string): string {
  return JSON.stringify({
    event: "hold",
    event_id: eventId,
    instance_id: "long-running-paper-session",
    at,
    authority_status: "trace_only",
    reason: "long running session emitted no fresh trade setup"
  });
}

function sandboxPlacement(sandboxPlacementId: string): SandboxPlacementRecord {
  return {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: sandboxPlacementId,
    placement_kind: "fixture_local_placeholder",
    authority_status: "not_launched"
  };
}

function commandEvidence(
  instanceId: string,
  suffix: string,
  at: string
): SandboxCommandEvidenceRecord {
  return {
    record_kind: "sandbox_command_evidence",
    version: 1,
    sandbox_command_evidence_id: `sandbox-command-evidence-${instanceId}-${suffix}`,
    sandbox_ref: { record_kind: "sandbox", id: instanceId },
    command: ["long-running-paper-session", suffix],
    exit_code: 0,
    stdout: "",
    stderr: "",
    started_at: at,
    completed_at: at,
    authority_status: "trace_only"
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
      id: "long-running-paper-runtime",
      description: "Networkless provider for long-running paper session tests.",
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
