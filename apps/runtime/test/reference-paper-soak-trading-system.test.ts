import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CandidateMaterializationInput,
  OuroborosCommandKind,
  OuroborosCommandRequest,
  OperatorReadModel,
  SandboxDetailReadModel,
  SystemCodeRecord
} from "@ouroboros/domain";
import { parseTradingSystemPaperEventLine } from "@ouroboros/application/trading/paper/events";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { DeterministicSandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
import { LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../src/server";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

const execFileAsync = promisify(execFile);
const referenceArtifactPath = path.resolve("fixtures/trading-systems/reference_paper_soak.py");
const referenceCapabilityPolicyId = "reference-paper-soak-system-code";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-reference-paper-soak-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("reference paper soak TradingSystem", () => {
  it("uses only the injected Gateway paper API while emitting its own order, hold, and cancel cadence", async () => {
    const provider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:01.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:02.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:03.000Z" },
          { price: 65_050, expected_direction: "flat", observed_at: "2026-05-16T00:00:04.000Z" },
          { price: 65_075, expected_direction: "flat", observed_at: "2026-05-16T00:00:05.000Z" }
        ]
      })
    }));

    try {
      const { stdout } = await execFileAsync("python3", [
        referenceArtifactPath,
        "--instance-id",
        "reference-paper-soak",
        "--ticks",
        "3",
        "--interval-ms",
        "1",
        "--start-at",
        "2026-05-16T00:00:03.000Z"
      ], {
        env: {
          ...process.env,
          TRADING_API_BASE_URL: provider.base_url
        }
      });

      const lines = stdout.trim().split("\n");
      const parsedEvents = lines
        .map((line, lineIndex) => parseTradingSystemPaperEventLine(line, {
          sandboxId: "sandbox-reference-paper-soak",
          lineIndex
        }))
        .filter((result) => result.status === "accepted")
        .map((result) => result.event);

      expect(parsedEvents.map((event) => event.event_kind)).toEqual([
        "order_request",
        "hold",
        "cancel_order"
      ]);
      expect(parsedEvents[0]).toMatchObject({
        event_kind: "order_request",
        order_request: {
          symbol: "BTCUSDT",
          side: "buy",
          order_type: "limit",
          quantity: "0.001",
          limit_price: "65000"
        },
        reason: "reference_paper_soak_runtime_api_validation_risk_limits_passed"
      });
      expect(parsedEvents[1]).toMatchObject({
        event_kind: "hold",
        reason: "reference_paper_soak_observed_flat_market_after_entry"
      });
      expect(parsedEvents[2]).toMatchObject({
        event_kind: "cancel_order",
        reason: "reference_paper_soak_cancels_remaining_fake_quantity"
      });
      expect(provider.requests().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
        "GET /market/snapshot",
        "GET /account/state",
        "POST /orders/validate",
        "GET /market/snapshot",
        "GET /account/state",
        "GET /market/snapshot",
        "GET /account/state"
      ]);
    } finally {
      await provider.close();
    }
  });

  it("honors rejected Gateway paper API validation without emitting an order request", async () => {
    const provider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:01.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:02.000Z" }
        ]
      })
    }), {
      readAccountState: async () => ({
        equity: 10_000,
        max_position_notional: 1,
        max_risk_fraction: 0.03,
        target_risk_fraction: 0.02
      })
    });

    try {
      const { stdout } = await execFileAsync("python3", [
        referenceArtifactPath,
        "--instance-id",
        "reference-paper-soak-risk-rejected",
        "--ticks",
        "1",
        "--interval-ms",
        "1",
        "--start-at",
        "2026-05-16T00:00:03.000Z"
      ], {
        env: {
          ...process.env,
          TRADING_API_BASE_URL: provider.base_url
        }
      });

      const parsedEvents = stdout.trim().split("\n")
        .map((line, lineIndex) => parseTradingSystemPaperEventLine(line, {
          sandboxId: "sandbox-reference-paper-soak-risk-rejected",
          lineIndex
        }))
        .filter((result) => result.status === "accepted")
        .map((result) => result.event);

      expect(parsedEvents).toHaveLength(1);
      expect(parsedEvents[0]).toMatchObject({
        event_kind: "hold",
        reason: "reference_paper_soak_runtime_api_validation_risk_limits_rejected"
      });
      expect(provider.requests().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
        "GET /market/snapshot",
        "GET /account/state",
        "POST /orders/validate"
      ]);
    } finally {
      await provider.close();
    }
  });

  it("soaks a selected reference TradingSystem through live paper observations, fake fills, PnL, and stop", async () => {
    const store = new LocalStore(tmpDir);
    const candidateId = await registerReferenceCandidate(store);
    const sandboxAdapter = new DeterministicSandboxAdapter({
      allowedArtifactRoots: [path.dirname(referenceArtifactPath)],
      allowedCapabilityPolicyIds: [referenceCapabilityPolicyId]
    });
    const server = await buildServer({
      store,
      sandboxAdapters: {
        deterministic_test: sandboxAdapter
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:01.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:02.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:03.000Z" },
          { price: 65_000, expected_direction: "long", observed_at: "2026-05-16T00:00:04.000Z" },
          { price: 65_100, expected_direction: "flat", observed_at: "2026-05-16T00:00:05.000Z" },
          { price: 65_125, expected_direction: "flat", observed_at: "2026-05-16T00:00:06.000Z" },
          { price: 65_150, expected_direction: "flat", observed_at: "2026-05-16T00:00:07.000Z" }
        ],
        executionSnapshots: [{
          observed_at: "2026-05-16T00:00:04.000Z",
          agg_trades: [{
            trade_id: "reference-soak-fill-0001",
            price: "65000",
            quantity: "0.001",
            trade_time: "2099-01-01T00:00:03.500Z"
          }]
        }]
      }),
      paperTradingEvaluationIntervalMs: 60_000,
      paperTradingSandboxIntervalMs: 1_000
    });

    try {
      await postCommand(server, {
        command_kind: "candidate.select",
        payload: { candidate_id: candidateId }
      });

      const started = await postCommand(server, {
        command_kind: "trading_run.start",
        payload: { candidate_id: candidateId }
      });
      expect(started.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "running",
        runner_active: true,
        observation_count: 1,
        latest_decision: {
          decision_kind: "order_request",
          reason: "reference_paper_soak_runtime_api_validation_risk_limits_passed"
        },
        latest_fill: {
          fill_id: expect.stringContaining("reference-soak-fill-0001")
        },
        paper_account_snapshot: {
          position: {
            side: "long",
            quantity: "0.001"
          }
        }
      });
      expect(started.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("running");
      expect(started.operator.selected_paper_trading_evaluation.latest_order_request_id).toEqual(expect.any(String));

      const tradingRunId = started.operator.selected_paper_trading_evaluation.trading_run_id;
      const sandbox = started.operator.selected_candidate?.runtime.sandbox;
      expect(sandbox).toBeDefined();
      await waitForSandboxEvent(
        sandboxAdapter,
        sandbox!,
        `${sandbox!.sandbox_id}:hold:0002`
      );
      const held = await postCommand(server, {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: tradingRunId }
      });
      expect(held.operator.selected_paper_trading_evaluation).toMatchObject({
        observation_count: 2,
        latest_decision: {
          decision_kind: "hold",
          reason: "reference_paper_soak_observed_flat_market_after_entry"
        },
        paper_account_snapshot: {
          position: {
            side: "long",
            quantity: "0.001",
            mark_price: "65125"
          }
        }
      });

      await waitForSandboxEvent(
        sandboxAdapter,
        sandbox!,
        `${sandbox!.sandbox_id}:cancel-order:0003`
      );
      const canceled = await postCommand(server, {
        command_kind: "trading_run.observe",
        payload: { trading_run_id: tradingRunId }
      });
      expect(canceled.operator.selected_paper_trading_evaluation).toMatchObject({
        observation_count: 3,
        latest_decision: {
          decision_kind: "cancel_order",
          reason: "reference_paper_soak_cancels_remaining_fake_quantity"
        },
        open_orders: []
      });
      expect(Number(canceled.operator.selected_paper_trading_evaluation.profit_loss.net_revenue_usdt)).toBeGreaterThan(0);

      const stopped = await postCommand(server, {
        command_kind: "trading_run.stop",
        payload: { trading_run_id: tradingRunId }
      });
      expect(stopped.operator.selected_paper_trading_evaluation).toMatchObject({
        status: "stopped",
        runner_active: false
      });
      expect(stopped.operator.selected_candidate?.runtime.sandbox?.lifecycle_status).toBe("stopped");
    } finally {
      await server.close();
    }
  }, 15_000);
});

async function registerReferenceCandidate(store: LocalStore): Promise<string> {
  await store.initialize();
  const systemCode = referenceSystemCode();
  await store.recordSystemCode(systemCode);
  const outcome = await store.materializeCandidate(referenceCandidateMaterializationInput(systemCode.system_code_id));
  if (outcome.status !== "materialized") {
    throw new Error("expected reference candidate materialization");
  }
  return outcome.candidate.candidate_id;
}

function referenceSystemCode(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "reference-system-code-paper-soak-001",
    artifact_kind: "python_file",
    artifact_path: referenceArtifactPath,
    artifact_digest: `sha256:${createHash("sha256").update(referenceArtifactPath).digest("hex")}`,
    runtime_kind: "python",
    entrypoint: ["python3", referenceArtifactPath],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: referenceCapabilityPolicyId },
    provenance_refs: [{ record_kind: "reference_trading_system", id: "reference-paper-soak-v1" }],
    status: "registered",
    created_at: "2026-05-16T00:00:00.000Z",
    authority_status: "not_live"
  };
}

function referenceCandidateMaterializationInput(systemCodeId: string): CandidateMaterializationInput {
  return {
    idempotency_key: "reference-paper-soak-candidate-v1",
    provider: {
      provider_kind: "fixture_only",
      model: "reference-paper-soak-v1",
      invocation_surface: "repo fixture",
      agent_run_id: "agent-run-reference-paper-soak-v1",
      agent_event_id: "agent-event-reference-paper-soak-v1",
      trace_id: "trace-reference-paper-soak-v1",
      output_artifact_hash: "sha256:reference-paper-soak-v1"
    },
    candidate: {
      title: "Reference Paper Soak TradingSystem",
      system_summary: "Reference TradingSystem that reads only the Gateway paper API and emits its own paper cadence.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "BTCUSDT reference paper soak over Gateway-owned paper market/account context.",
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper", "live"]
    },
    program: {
      summary: "Reference Python runtime emits order, hold, cancel, heartbeat, and stop events.",
      declared_runtime: "python-sandbox",
      declared_outputs: ["OrderRequest", "Hold", "CancelOrder", "RuntimeHeartbeat"]
    },
    capability_package: {
      summary: "Gateway paper API access only; no Binance, credentials, private reads, or live orders.",
      allowed_stages: ["paper"],
      declared_permissions: ["read_gateway_paper_market_snapshot", "read_gateway_paper_account_state", "validate_gateway_order_request"],
      forbidden_contents: ["exchange_credentials", "private_account_state", "signed_requests", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "reference_trading_system", id: "reference-paper-soak-v1" }],
    system_code_ref: { record_kind: "system_code", id: systemCodeId }
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSandboxEvent(
  adapter: DeterministicSandboxAdapter,
  sandbox: SandboxDetailReadModel,
  eventId: string,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const observations = await adapter.getArtifactInstanceLogs(sandbox);
    if ((observations.logs ?? []).some((log) => log.lines.some((line) => {
      try {
        return (JSON.parse(line) as { event_id?: string }).event_id === eventId;
      } catch {
        return false;
      }
    }))) {
      return;
    }
    await sleep(25);
  }
  throw new Error(`sandbox event ${eventId} was not observed before timeout`);
}
