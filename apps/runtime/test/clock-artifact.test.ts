import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { parseTradingSystemPaperEventLine } from
  "@ouroboros/application/trading/paper/events";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

const execFileAsync = promisify(execFile);
const artifactPath = path.resolve("fixtures/trading-systems/clock.py");

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-clock-artifact-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Python clock system code fixture", () => {
  it("runs in bounded test mode and emits instance-scoped heartbeat and log output", async () => {
    const logFile = path.join(tmpDir, "clock.log");
    const heartbeatFile = path.join(tmpDir, "clock-heartbeat.json");
    const { stdout } = await execFileAsync("python3", [
      artifactPath,
      "--instance-id",
      "clock-test-alpha",
      "--ticks",
      "2",
      "--interval-ms",
      "1",
      "--log-file",
      logFile,
      "--heartbeat-file",
      heartbeatFile
    ]);

    const stdoutLines = stdout.trim().split("\n").map((line) => JSON.parse(line));
    const logLines = (await readFile(logFile, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const latestHeartbeat = JSON.parse(await readFile(heartbeatFile, "utf8"));

    expect(stdoutLines).toEqual(logLines);
    expect(stdoutLines).toMatchObject([
      {
        at: "1970-01-01T00:00:00.000Z",
        authority_status: "trace_only",
        event: "order_request",
        event_id: "clock-test-alpha:order-request:0001",
        instance_id: "clock-test-alpha",
        intent_kind: "place_order",
        limit_price: "60000",
        order_type: "limit",
        quantity: "0.001",
        side: "buy",
        symbol: "BTCUSDT"
      },
      {
        at: expect.any(String),
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 1
      },
      {
        at: expect.any(String),
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 2
      },
      {
        at: expect.any(String),
        event: "runtime_stopped",
        instance_id: "clock-test-alpha",
        tick: 2
      }
    ]);
    expect(stdoutLines[1].at).not.toBe("1970-01-01T00:00:00.000Z");
    expect(stdoutLines[2].at).not.toBe("1970-01-01T00:00:00.000Z");
    expect(stdoutLines[3].at).not.toBe("1970-01-01T00:00:00.000Z");
    expect(latestHeartbeat).toMatchObject({
      event: "runtime_stopped",
      instance_id: "clock-test-alpha",
      tick: 2
    });
  });

  it("does not require secret-looking configuration fields", async () => {
    const { stdout } = await execFileAsync("python3", [artifactPath, "--help"]);

    expect(stdout).toContain("--instance-id");
    expect(stdout).toContain("--ticks");
    expect(stdout).toContain("--paper-order-request");
    expect(stdout).toContain("--log-file");
    expect(stdout).not.toMatch(/secret|password|token|api[-_]?key|credential/i);
  });

  it("emits a rejected fixture order request when explicitly requested", async () => {
    const { stdout } = await execFileAsync("python3", [
      artifactPath,
      "--instance-id",
      "clock-test-rejected",
      "--ticks",
      "1",
      "--interval-ms",
      "1",
      "--paper-order-request",
      "rejected"
    ]);

    const [orderRequest] = stdout.trim().split("\n").map((line) => JSON.parse(line));

    expect(orderRequest).toMatchObject({
      event: "order_request",
      event_id: "clock-test-rejected:order-request:0001",
      instance_id: "clock-test-rejected",
      symbol: "BTCUSDT",
      intent_kind: "place_order",
      side: "buy",
      order_type: "limit",
      quantity: "0",
      limit_price: "60000",
      authority_status: "trace_only"
    });
  });

  it("uses the injected paper runtime API instead of direct exchange access", async () => {
    const provider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort({
        snapshots: [{
          price: 65_000,
          moving_average_fast: 64_975,
          moving_average_slow: 65_025,
          expected_direction: "short",
          observed_at: "2026-05-16T00:00:03.000Z"
        }]
      })
    }));

    try {
      expect(provider.candidate_input.market).toMatchObject({
        price: 65_000,
        moving_average_fast: 64_975,
        moving_average_slow: 65_025,
        observed_at: "2026-05-16T00:00:03.000Z"
      });
      expect(provider.candidate_input.market).not.toHaveProperty("expected_direction");

      const { stdout } = await execFileAsync(
        "python3",
        [
          artifactPath,
          "--instance-id",
          "clock-test-runtime-api",
          "--ticks",
          "1",
          "--interval-ms",
          "1",
          "--start-at",
          "2026-05-16T00:00:03.000Z"
        ],
        {
          env: {
            ...process.env,
            TRADING_API_BASE_URL: provider.base_url
          }
        }
      );

      const [orderRequest] = stdout.trim().split("\n").map((line) => JSON.parse(line));
      expect(orderRequest).toMatchObject({
        event: "order_request",
        event_id: "clock-test-runtime-api:order-request:0001",
        instance_id: "clock-test-runtime-api",
        symbol: "BTCUSDT",
        intent_kind: "place_order",
        side: "sell",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "65000",
        reason: "runtime_api_market_signal_short_validation_risk_limits_passed",
        authority_status: "trace_only",
        at: "2026-05-16T00:00:03.000Z"
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

  it("acknowledges each new comparison tick once on its own cadence", async () => {
    const contexts = [comparisonContext(1), comparisonContext(2)];
    const deliveries = [undefined, contexts[0], contexts[0], contexts[1]];
    const acknowledged: unknown[] = [];
    const acknowledgementLogSnapshots: unknown[][] = [];
    const logFile = path.join(tmpDir, "clock-comparison-cadence.log");
    let deliveryIndex = 0;
    const provider = await startPaperTradingApiProvider(
      createGatewayRuntimeBinding({ marketData: fakeGatewayMarketDataPort() }),
      {
        comparison_tick_hooks: {
          deliver: async () => deliveries[deliveryIndex++],
          acknowledge: async ({ context }) => {
            acknowledged.push(context);
            const log = await readFile(logFile, "utf8").catch(() => "");
            acknowledgementLogSnapshots.push(log.trim()
              ? log.trim().split("\n").map((line) => JSON.parse(line))
              : []);
            const sequence = (context as { tick_sequence: number }).tick_sequence;
            return {
              acknowledgement_ref: {
                record_kind: "paper_trading_comparison_tick_acknowledgement",
                id: `clock-artifact-ack-${sequence}`
              },
              acknowledgement_digest: `sha256:clock-artifact-ack-${sequence}`
            };
          }
        }
      }
    );

    try {
      await execFileAsync(
        "python3",
        [
          artifactPath,
          "--instance-id",
          "clock-comparison-cadence",
          "--ticks",
          "4",
          "--interval-ms",
          "1",
          "--log-file",
          logFile
        ],
        {
          env: {
            ...process.env,
            TRADING_API_BASE_URL: provider.base_url
          }
        }
      );

      expect(acknowledged).toEqual(contexts);
      const lines = (await readFile(logFile, "utf8")).trim().split("\n")
        .map((line) => JSON.parse(line));
      const decisions = lines.filter((line) =>
        line.event === "order_request" || line.event === "hold");
      expect(decisions).toMatchObject([
        {
          event_id: "clock-comparison-cadence:order-request:0001"
        },
        {
          event_id: "clock-comparison-cadence:order-request:0002",
          comparison_tick_delivery_ref: contexts[1]!.delivery_ref,
          comparison_tick_delivery_digest: contexts[1]!.delivery_digest
        }
      ]);
      expect(parseTradingSystemPaperEventLine(
        JSON.stringify(decisions[1]),
        { sandboxId: "clock-comparison-cadence", lineIndex: 1 }
      )).toMatchObject({ status: "accepted" });
      expect(acknowledgementLogSnapshots[0]).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ event_id: "clock-comparison-cadence:order-request:0002" })
      ]));
      expect(acknowledgementLogSnapshots[1]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event_id: "clock-comparison-cadence:order-request:0002",
          comparison_tick_delivery_ref: contexts[1]!.delivery_ref,
          comparison_tick_delivery_digest: contexts[1]!.delivery_digest
        })
      ]));
      expect(provider.requests().map(({ method, path }) => `${method} ${path}`))
        .toEqual([
          "GET /market/snapshot",
          "GET /account/state",
          "POST /orders/validate",
          "GET /market/snapshot",
          "POST /comparison/tick/ack",
          "GET /market/snapshot",
          "GET /market/snapshot",
          "GET /account/state",
          "POST /orders/validate",
          "POST /comparison/tick/ack"
        ]);
    } finally {
      await provider.close();
    }
  });

  it("keeps the paper runtime API available when the first market snapshot is unavailable", async () => {
    const provider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort({
        failMarketSnapshot: true
      })
    }));

    try {
      expect(provider.candidate_input.market).toMatchObject({
        symbol: "BTCUSDT",
        price: 0
      });
      expect(provider.candidate_input.market).not.toHaveProperty("expected_direction");

      const response = await fetch(`${provider.base_url}/market/snapshot`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        error: "paper_runtime_api_unavailable",
        authority_status: "not_live"
      });
      expect(provider.requests()).toMatchObject([{
        method: "GET",
        path: "/market/snapshot",
        response_status: 503
      }]);
    } finally {
      await provider.close();
    }
  });

  it("bounds the injected paper runtime API request log", async () => {
    const provider = await startPaperTradingApiProvider(createGatewayRuntimeBinding({
      marketData: fakeGatewayMarketDataPort()
    }), {
      request_log_limit: 2
    });

    try {
      await fetch(`${provider.base_url}/market/snapshot`);
      await fetch(`${provider.base_url}/account/state`);
      await fetch(`${provider.base_url}/market/snapshot`);

      expect(provider.requests().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
        "GET /account/state",
        "GET /market/snapshot"
      ]);
    } finally {
      await provider.close();
    }
  });
});

function comparisonContext(sequence: number) {
  return {
    tick_ref: {
      record_kind: "paper_trading_comparison_tick" as const,
      id: `clock-artifact-tick-${sequence}`
    },
    tick_digest: `sha256:clock-artifact-tick-${sequence}`,
    tick_sequence: sequence,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery" as const,
      id: `clock-artifact-delivery-${sequence}`
    },
    delivery_digest: `sha256:clock-artifact-delivery-${sequence}`
  };
}
