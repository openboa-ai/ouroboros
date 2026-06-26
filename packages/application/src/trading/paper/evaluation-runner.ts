export type PaperTradingEvaluationRunStatus = "started" | "already_running";

export interface PaperTradingEvaluationRunnerStartInput {
  tradingRunId: string;
  intervalMs: number;
  observe: () => Promise<void>;
  onError?: (error: unknown) => void;
}

export class PaperTradingEvaluationRunner {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly running = new Set<string>();
  private readonly activeObservations = new Set<Promise<void>>();

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

  async drain(): Promise<void> {
    while (this.activeObservations.size > 0) {
      await Promise.allSettled([...this.activeObservations]);
    }
  }

  private schedule(input: PaperTradingEvaluationRunnerStartInput): void {
    const timer = setTimeout(async () => {
      this.timers.delete(input.tradingRunId);
      const observation = input.observe();
      this.activeObservations.add(observation);
      try {
        await observation;
      } catch (error) {
        input.onError?.(error);
      } finally {
        this.activeObservations.delete(observation);
      }
      if (this.running.has(input.tradingRunId)) {
        this.schedule(input);
      }
    }, input.intervalMs);
    timer.unref();
    this.timers.set(input.tradingRunId, timer);
  }
}
