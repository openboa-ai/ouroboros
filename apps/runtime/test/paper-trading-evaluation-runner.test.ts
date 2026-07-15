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

  it("bounds drain when an active observation never settles", async () => {
    const runner = new PaperTradingEvaluationRunner({ drainTimeoutMs: 50 });
    const observe = vi.fn(() => new Promise<void>(() => undefined));

    expect(runner.start({ tradingRunId: "run-3", intervalMs: 1000, observe })).toBe("started");
    await vi.advanceTimersByTimeAsync(1000);
    expect(observe).toHaveBeenCalledTimes(1);

    let drained = false;
    const drain = runner.drain().then(() => {
      drained = true;
    });

    await vi.advanceTimersByTimeAsync(49);
    await Promise.resolve();
    expect(drained).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await drain;
    expect(drained).toBe(true);
  });

  it("drains only the requested trading run", async () => {
    const runner = new PaperTradingEvaluationRunner({ drainTimeoutMs: 50 });
    const first = deferred<void>();
    const second = deferred<void>();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();

    runner.start({
      tradingRunId: "run-target",
      intervalMs: 1000,
      observe: async () => {
        firstStarted.resolve();
        await first.promise;
      }
    });
    runner.start({
      tradingRunId: "run-unrelated",
      intervalMs: 1000,
      observe: async () => {
        secondStarted.resolve();
        await second.promise;
      }
    });
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([firstStarted.promise, secondStarted.promise]);
    runner.stop("run-target");
    runner.stop("run-unrelated");

    let targetResult: boolean | undefined;
    const targetDrain = runner.drain("run-target").then((result) => {
      targetResult = result;
    });
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    const resultBeforeUnrelatedRelease = targetResult;

    second.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await targetDrain;

    expect(resultBeforeUnrelatedRelease).toBe(true);
  });

  it("reports a bounded target-run drain timeout", async () => {
    const runner = new PaperTradingEvaluationRunner({ drainTimeoutMs: 50 });
    const blocked = deferred<void>();
    const started = deferred<void>();
    runner.start({
      tradingRunId: "run-timeout",
      intervalMs: 1000,
      observe: async () => {
        started.resolve();
        await blocked.promise;
      }
    });
    await vi.advanceTimersByTimeAsync(1000);
    await started.promise;
    runner.stop("run-timeout");

    const drain = runner.drain("run-timeout");
    await vi.advanceTimersByTimeAsync(50);

    await expect(drain).resolves.toBe(false);
    blocked.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("reports synchronous observe failures and keeps active runs scheduled", async () => {
    const runner = new PaperTradingEvaluationRunner();
    const error = new Error("sync_observe_failed");
    const observe = vi.fn((): Promise<void> => {
      throw error;
    });
    const onError = vi.fn();

    expect(runner.start({ tradingRunId: "run-4", intervalMs: 1000, observe, onError })).toBe("started");

    await vi.advanceTimersByTimeAsync(1000);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(runner.active("run-4")).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);
    expect(observe).toHaveBeenCalledTimes(2);
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
