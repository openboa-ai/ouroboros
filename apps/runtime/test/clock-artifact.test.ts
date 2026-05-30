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
    expect(stdoutLines).toEqual([
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
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 1
      },
      {
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 2
      },
      {
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_stopped",
        instance_id: "clock-test-alpha",
        tick: 2
      }
    ]);
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
          expected_direction: "short",
          observed_at: "2026-05-16T00:00:03.000Z"
        }]
      })
    }));

    try {
      expect(provider.scenario.market).toMatchObject({
        price: 65_000,
        expected_direction: "short",
        observed_at: "2026-05-16T00:00:03.000Z"
      });
      expect(provider.scenario.outcome.exit_price).toBe(65_000);

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
        reason: "runtime_api_market_expected_direction_short_validation_risk_limits_passed",
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
});
