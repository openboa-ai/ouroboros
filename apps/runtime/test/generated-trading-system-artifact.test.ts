import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { parseTradingSystemPaperEventLine } from "@ouroboros/application/trading/paper/events";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

const execFileAsync = promisify(execFile);
const artifactPath = path.resolve("artifacts/trading-system/run.py");

describe("generated TradingSystem artifact", () => {
  it("honors rejected paper requests without emitting future no-action decisions", async () => {
    const { stdout } = await execFileAsync("python3", [
      artifactPath,
      "--instance-id",
      "generated-test-rejected",
      "--ticks",
      "2",
      "--interval-ms",
      "1",
      "--start-at",
      "2026-05-16T00:00:03.000Z",
      "--paper-order-request",
      "rejected"
    ]);

    const lines = stdout.trim().split("\n");
    const events = lines.map((line) => JSON.parse(line));
    expect(events.map((event) => event.event)).toEqual([
      "order_request",
      "runtime_heartbeat",
      "runtime_heartbeat",
      "runtime_stopped"
    ]);
    expect(events[1].at).not.toBe("2026-05-16T00:00:03.000Z");
    expect(events[2].at).not.toBe("2026-05-16T00:00:03.000Z");
    expect(events[3].at).not.toBe("2026-05-16T00:00:03.000Z");
    expect(events[0]).toMatchObject({
      event: "order_request",
      event_id: "generated-test-rejected:order-request:0001",
      instance_id: "generated-test-rejected",
      symbol: "BTCUSDT",
      intent_kind: "place_order",
      side: "buy",
      order_type: "market",
      quantity: "0",
      authority_status: "trace_only",
      at: "2026-05-16T00:00:03.000Z"
    });

    const parsed = parseTradingSystemPaperEventLine(lines[0], {
      sandboxId: "sandbox-generated-test-rejected",
      lineIndex: 0
    });
    expect(parsed).toMatchObject({
      status: "accepted",
      event: {
        event_kind: "order_request",
        order_request: {
          symbol: "BTCUSDT",
          side: "buy",
          quantity: "0",
          order_type: "market"
        }
      }
    });
  });

  it("acknowledges each new comparison tick once on generated candidate cadence", async () => {
    const contexts = [comparisonContext(1), comparisonContext(2)];
    const deliveries = [undefined, contexts[0], contexts[0], contexts[1]];
    const acknowledged: unknown[] = [];
    const acknowledgementLogSnapshots: unknown[][] = [];
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-generated-cadence-"));
    const logFile = path.join(tmpDir, "generated-comparison-cadence.log");
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
                id: `generated-artifact-ack-${sequence}`
              },
              acknowledgement_digest: `sha256:generated-artifact-ack-${sequence}`
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
          "generated-comparison-cadence",
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
          event_id: "generated-comparison-cadence:order-request:0001"
        },
        {
          event_id: "generated-comparison-cadence:order-request:0002",
          comparison_tick_delivery_ref: contexts[1]!.delivery_ref,
          comparison_tick_delivery_digest: contexts[1]!.delivery_digest
        }
      ]);
      expect(acknowledgementLogSnapshots[0]).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          event_id: "generated-comparison-cadence:order-request:0002"
        })
      ]));
      expect(acknowledgementLogSnapshots[1]).toEqual(expect.arrayContaining([
        expect.objectContaining({
          event_id: "generated-comparison-cadence:order-request:0002",
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
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

function comparisonContext(sequence: number) {
  return {
    tick_ref: {
      record_kind: "paper_trading_comparison_tick" as const,
      id: `generated-artifact-tick-${sequence}`
    },
    tick_digest: `sha256:generated-artifact-tick-${sequence}`,
    tick_sequence: sequence,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery" as const,
      id: `generated-artifact-delivery-${sequence}`
    },
    delivery_digest: `sha256:generated-artifact-delivery-${sequence}`
  };
}
