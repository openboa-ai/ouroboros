import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaperTradingEvaluationRunner } from "@ouroboros/application/trading/paper/evaluation-runner";

describe("PaperTradingEvaluationRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts once per trading run and reuses the active runner on duplicate start", async () => {
    const runner = new PaperTradingEvaluationRunner();
    const observe = vi.fn(async () => undefined);

    expect(runner.start({ tradingRunId: "run-1", intervalMs: 1000, observe })).toBe("started");
    expect(runner.start({ tradingRunId: "run-1", intervalMs: 1000, observe })).toBe("already_running");
    expect(runner.active("run-1")).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(observe).toHaveBeenCalledTimes(1);

    runner.stop("run-1");
    expect(runner.active("run-1")).toBe(false);
  });

  it("does not observe after stop clears the next scheduled tick", async () => {
    const runner = new PaperTradingEvaluationRunner();
    const observe = vi.fn(async () => undefined);

    expect(runner.start({ tradingRunId: "run-2", intervalMs: 1000, observe })).toBe("started");
    runner.stop("run-2");

    await vi.advanceTimersByTimeAsync(2000);
    expect(observe).not.toHaveBeenCalled();
  });
});
