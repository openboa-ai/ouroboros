import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseTradingSystemPaperEventLine } from "@ouroboros/application/trading/paper/events";

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
});
