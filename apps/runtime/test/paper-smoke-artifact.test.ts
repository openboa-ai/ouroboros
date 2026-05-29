import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseTradingSystemPaperEventLine } from "@ouroboros/application/trading/paper/events";

const execFileAsync = promisify(execFile);
const artifactPath = path.resolve("fixtures/trading-systems/paper_smoke.py");

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-smoke-artifact-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("paper smoke TradingSystem sample", () => {
  it("runs without a researcher and emits order, cancel, and hold paper events", async () => {
    const logFile = path.join(tmpDir, "paper-smoke.jsonl");
    const { stdout } = await execFileAsync("python3", [
      artifactPath,
      "--instance-id",
      "paper-smoke-sample",
      "--ticks",
      "2",
      "--interval-ms",
      "1",
      "--log-file",
      logFile,
      "--cancel-after-order"
    ]);

    const stdoutLines = stdout.trim().split("\n");
    const logLines = (await readFile(logFile, "utf8")).trim().split("\n");
    expect(stdoutLines).toEqual(logLines);

    const parsed = stdoutLines.map((line, lineIndex) =>
      parseTradingSystemPaperEventLine(line, {
        sandboxId: "sandbox-paper-smoke-sample",
        lineIndex
      })
    );

    expect(parsed.map((result) => result.status)).toEqual([
      "accepted",
      "accepted",
      "accepted",
      "accepted"
    ]);
    expect(parsed.map((result) => result.status === "accepted" ? result.event.event_kind : result.reason)).toEqual([
      "order_request",
      "cancel_order",
      "hold",
      "hold"
    ]);
  });
});
