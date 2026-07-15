import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaperTradingComparisonWindowStep } from "./comparison-window-driver";
import { PaperTradingComparisonWindowRunner } from "./comparison-window-runner";

describe("PaperTradingComparisonWindowRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts once and schedules non-overlapping waiting steps", async () => {
    const advance = vi.fn(async () => step({
      phase: "waiting_tick_acknowledgements"
    }));
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });

    expect(runner.start(input())).toBe("started");
    expect(runner.start(input())).toBe("already_running");
    expect(runner.active("attempt-1")).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(0);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(runner.status("attempt-1")).toMatchObject({
      status: "running",
      latest_step: { phase: "waiting_tick_acknowledgements" }
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(advance).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(advance).toHaveBeenCalledTimes(2);
  });

  it("uses an exact future wake time instead of polling early", async () => {
    const advance = vi.fn(async () => step({
      phase: "waiting_first_checkpoint_due",
      next_wake_at: "2026-07-11T00:01:00.000Z"
    }));
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start(input());

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(advance).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(advance).toHaveBeenCalledTimes(2);
  });

  it("does not overlap a slow step", async () => {
    const pending = deferred<PaperTradingComparisonWindowStep>();
    const advance = vi.fn(() => pending.promise);
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start(input());

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(advance).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve(step({ phase: "waiting_tick_acknowledgements" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops scheduling and preserves a terminal step", async () => {
    const advance = vi.fn(async () => step({
      phase: "window_stopped",
      terminal: true
    }));
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start(input());

    await vi.advanceTimersByTimeAsync(0);

    expect(runner.active("attempt-1")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(runner.status("attempt-1")).toMatchObject({
      status: "completed",
      latest_step: { phase: "window_stopped", terminal: true }
    });
  });

  it("records one stable error and does not retry it", async () => {
    const onError = vi.fn();
    const advance = vi.fn(async () => {
      throw Object.assign(new Error("graph failed"), {
        code: "paper_trading_comparison_window_graph_invalid"
      });
    });
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start({ ...input(), onError });

    await vi.advanceTimersByTimeAsync(0);

    expect(runner.active("attempt-1")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(onError).toHaveBeenCalledOnce();
    expect(runner.status("attempt-1")).toEqual({
      status: "failed",
      stable_error_code: "paper_trading_comparison_window_graph_invalid"
    });
  });

  it("keeps the driver failure terminal when the error observer throws", async () => {
    const runner = new PaperTradingComparisonWindowRunner({
      driver: {
        advance: vi.fn(async () => {
          throw Object.assign(new Error("graph failed"), {
            code: "paper_trading_comparison_window_graph_invalid"
          });
        })
      }
    });
    runner.start({
      ...input(),
      onError() {
        throw new Error("observer failed");
      }
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(runner.active("attempt-1")).toBe(false);
    expect(runner.status("attempt-1")).toEqual({
      status: "failed",
      stable_error_code: "paper_trading_comparison_window_graph_invalid"
    });
    await expect(runner.drain("attempt-1", 1)).resolves.toBe(true);
  });

  it("stops only scheduler ownership without claiming runtime cleanup", async () => {
    const advance = vi.fn(async () => step({
      phase: "waiting_tick_acknowledgements"
    }));
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start(input());

    expect(runner.stopScheduling("attempt-1")).toBe("stopped");
    expect(runner.active("attempt-1")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(runner.status("attempt-1")).toEqual({ status: "stopped" });
    expect(advance).not.toHaveBeenCalled();
  });

  it("drains an active step and times out without cancelling it", async () => {
    const pending = deferred<PaperTradingComparisonWindowStep>();
    const runner = new PaperTradingComparisonWindowRunner({
      driver: { advance: vi.fn(() => pending.promise) }
    });
    runner.start(input());
    await vi.advanceTimersByTimeAsync(0);

    const timedOut = runner.drain("attempt-1", 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(timedOut).resolves.toBe(false);

    const drained = runner.drain("attempt-1", 100);
    pending.resolve(step({ phase: "window_stopped", terminal: true }));
    await vi.advanceTimersByTimeAsync(0);
    await expect(drained).resolves.toBe(true);
  });

  it("isolates multiple activation attempts", async () => {
    const advance = vi.fn(async ({ activationAttemptId }) => step({
      activation_attempt_id: activationAttemptId,
      phase: "waiting_tick_acknowledgements"
    }));
    const runner = new PaperTradingComparisonWindowRunner({ driver: { advance } });
    runner.start(input());
    runner.start({
      ...input(),
      activationId: "activation-2",
      activationAttemptId: "attempt-2"
    });

    await vi.advanceTimersByTimeAsync(0);

    expect(advance).toHaveBeenCalledTimes(2);
    expect(runner.active("attempt-1")).toBe(true);
    expect(runner.active("attempt-2")).toBe(true);
    expect(runner.status("attempt-2")).toMatchObject({
      latest_step: { activation_attempt_id: "attempt-2" }
    });
  });
});

function input() {
  return {
    activationId: "activation-1",
    activationAttemptId: "attempt-1",
    pollIntervalMs: 250
  };
}

function step(
  changes: Partial<PaperTradingComparisonWindowStep> = {}
): PaperTradingComparisonWindowStep {
  return {
    activation_id: "activation-1",
    activation_attempt_id: "attempt-1",
    phase: "checkpoint_committed",
    checkpoint_sequence: 1,
    transition: "none",
    terminal: false,
    authority_status: "not_live",
    ...changes
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
