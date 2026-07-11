export type PaperTradingEvaluationRunStatus = "started" | "already_running";

export interface PaperTradingEvaluationRunnerStartInput {
  tradingRunId: string;
  intervalMs: number;
  observe: () => Promise<void>;
  onError?: (error: unknown) => void;
}

export interface PaperTradingEvaluationRunnerOptions {
  drainTimeoutMs?: number;
}

const DEFAULT_DRAIN_TIMEOUT_MS = 1_000;

export class PaperTradingEvaluationRunner {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<string>();
  private readonly activeObservations = new Map<string, Set<Promise<void>>>();
  private readonly drainTimeoutMs: number;

  constructor(options: PaperTradingEvaluationRunnerOptions = {}) {
    this.drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
  }

  active(tradingRunId: string): boolean {
    return this.running.has(tradingRunId);
  }

  start(input: PaperTradingEvaluationRunnerStartInput): PaperTradingEvaluationRunStatus {
    if (this.running.has(input.tradingRunId)) {
      return "already_running";
    }
    this.running.add(input.tradingRunId);
    this.schedule(input);
    return "started";
  }

  stop(tradingRunId: string): "stopped" {
    this.running.delete(tradingRunId);
    const timer = this.timers.get(tradingRunId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(tradingRunId);
    }
    return "stopped";
  }

  async drain(tradingRunId?: string, timeoutMs = this.drainTimeoutMs): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (this.hasActiveObservations(tradingRunId)) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return false;
      }
      const activeObservations = this.activeObservationPromises(tradingRunId);
      if (!await observationsSettleWithin(activeObservations, remainingMs)) {
        return !this.hasActiveObservations(tradingRunId);
      }
    }
    return true;
  }

  private schedule(input: PaperTradingEvaluationRunnerStartInput): void {
    const timer = setTimeout(async () => {
      this.timers.delete(input.tradingRunId);
      let observation: Promise<void> | undefined;
      try {
        observation = Promise.resolve().then(input.observe);
        const activeForRun = this.activeObservations.get(input.tradingRunId) ?? new Set();
        activeForRun.add(observation);
        this.activeObservations.set(input.tradingRunId, activeForRun);
        await observation;
      } catch (error) {
        input.onError?.(error);
      } finally {
        if (observation) {
          const activeForRun = this.activeObservations.get(input.tradingRunId);
          activeForRun?.delete(observation);
          if (activeForRun?.size === 0) {
            this.activeObservations.delete(input.tradingRunId);
          }
        }
      }
      if (this.running.has(input.tradingRunId)) {
        this.schedule(input);
      }
    }, input.intervalMs);
    timer.unref();
    this.timers.set(input.tradingRunId, timer);
  }

  private hasActiveObservations(tradingRunId?: string): boolean {
    return tradingRunId === undefined
      ? this.activeObservations.size > 0
      : (this.activeObservations.get(tradingRunId)?.size ?? 0) > 0;
  }

  private activeObservationPromises(tradingRunId?: string): Promise<void>[] {
    if (tradingRunId !== undefined) {
      return [...(this.activeObservations.get(tradingRunId) ?? [])];
    }
    return [...this.activeObservations.values()].flatMap((observations) => [...observations]);
  }
}

function observationsSettleWithin(
  observations: Promise<void>[],
  timeoutMs: number
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout;
    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    void Promise.allSettled(observations).then(() => finish(true));
  });
}
