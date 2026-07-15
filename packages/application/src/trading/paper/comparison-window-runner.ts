import type { PaperTradingComparisonWindowStep } from "./comparison-window-driver";

interface WindowDriverPort {
  advance(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowStep>;
}

export interface PaperTradingComparisonWindowRunnerStartInput {
  activationId: string;
  activationAttemptId: string;
  pollIntervalMs: number;
  onError?: (error: unknown) => void;
}

export type PaperTradingComparisonWindowRunnerStatus =
  | { status: "running"; latest_step?: PaperTradingComparisonWindowStep }
  | { status: "completed"; latest_step: PaperTradingComparisonWindowStep }
  | { status: "failed"; stable_error_code: string }
  | { status: "stopped" };

export class PaperTradingComparisonWindowRunner {
  private readonly running = new Map<
    string,
    PaperTradingComparisonWindowRunnerStartInput
  >();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly activeSteps = new Map<string, Promise<void>>();
  private readonly statuses = new Map<
    string,
    PaperTradingComparisonWindowRunnerStatus
  >();

  constructor(private readonly options: { driver: WindowDriverPort }) {}

  start(
    input: PaperTradingComparisonWindowRunnerStartInput
  ): "started" | "already_running" {
    const normalized = normalizeInput(input);
    if (this.running.has(normalized.activationAttemptId)) {
      return "already_running";
    }
    this.running.set(normalized.activationAttemptId, normalized);
    this.statuses.set(normalized.activationAttemptId, { status: "running" });
    this.schedule(normalized, 0);
    return "started";
  }

  active(activationAttemptId: string): boolean {
    return this.running.has(activationAttemptId);
  }

  status(
    activationAttemptId: string
  ): PaperTradingComparisonWindowRunnerStatus | undefined {
    const status = this.statuses.get(activationAttemptId);
    return status ? structuredClone(status) : undefined;
  }

  stopScheduling(activationAttemptId: string): "stopped" | "not_running" {
    const wasRunning = this.running.delete(activationAttemptId);
    const timer = this.timers.get(activationAttemptId);
    if (timer) clearTimeout(timer);
    this.timers.delete(activationAttemptId);
    if (!wasRunning && !timer && !this.activeSteps.has(activationAttemptId)) {
      return "not_running";
    }
    this.statuses.set(activationAttemptId, { status: "stopped" });
    return "stopped";
  }

  async drain(activationAttemptId: string, timeoutMs: number): Promise<boolean> {
    const active = this.activeSteps.get(activationAttemptId);
    if (!active) return true;
    return settleWithin(active, timeoutMs);
  }

  private schedule(
    input: PaperTradingComparisonWindowRunnerStartInput,
    delayMs: number
  ): void {
    const timer = setTimeout(() => {
      this.timers.delete(input.activationAttemptId);
      void this.runStep(input);
    }, delayMs);
    timer.unref?.();
    this.timers.set(input.activationAttemptId, timer);
  }

  private runStep(input: PaperTradingComparisonWindowRunnerStartInput): Promise<void> {
    const active = this.runStepUnlocked(input);
    this.activeSteps.set(input.activationAttemptId, active);
    void active.finally(() => {
      if (this.activeSteps.get(input.activationAttemptId) === active) {
        this.activeSteps.delete(input.activationAttemptId);
      }
    });
    return active;
  }

  private async runStepUnlocked(
    input: PaperTradingComparisonWindowRunnerStartInput
  ): Promise<void> {
    if (!this.running.has(input.activationAttemptId)) return;
    try {
      const latestStep = await this.options.driver.advance({
        activationId: input.activationId,
        activationAttemptId: input.activationAttemptId
      });
      if (!this.running.has(input.activationAttemptId)) return;
      if (latestStep.terminal) {
        this.running.delete(input.activationAttemptId);
        this.statuses.set(input.activationAttemptId, {
          status: "completed",
          latest_step: structuredClone(latestStep)
        });
        return;
      }
      this.statuses.set(input.activationAttemptId, {
        status: "running",
        latest_step: structuredClone(latestStep)
      });
      const wakeDelay = latestStep.next_wake_at
        ? Math.max(0, Date.parse(latestStep.next_wake_at) - Date.now())
        : input.pollIntervalMs;
      this.schedule(input, wakeDelay);
    } catch (error) {
      if (!this.running.has(input.activationAttemptId)) return;
      this.running.delete(input.activationAttemptId);
      this.statuses.set(input.activationAttemptId, {
        status: "failed",
        stable_error_code: stableErrorCode(error)
      });
      notifyError(input.onError, error);
    }
  }
}

function normalizeInput(
  input: PaperTradingComparisonWindowRunnerStartInput
): PaperTradingComparisonWindowRunnerStartInput {
  if (input === null || typeof input !== "object" ||
    typeof input.activationId !== "string" ||
    input.activationId.trim() !== input.activationId ||
    !input.activationId ||
    typeof input.activationAttemptId !== "string" ||
    input.activationAttemptId.trim() !== input.activationAttemptId ||
    !input.activationAttemptId ||
    !Number.isInteger(input.pollIntervalMs) ||
    input.pollIntervalMs <= 0 ||
    input.onError !== undefined && typeof input.onError !== "function") {
    throw new TypeError("Invalid paper comparison window runner input.");
  }
  return { ...input };
}

function stableErrorCode(error: unknown): string {
  if (error !== null && typeof error === "object" &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return "paper_trading_comparison_window_runner_failed";
}

function notifyError(
  onError: ((error: unknown) => void) | undefined,
  error: unknown
): void {
  try {
    onError?.(error);
  } catch {
    return;
  }
}

function settleWithin(active: Promise<void>, timeoutMs: number): Promise<boolean> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref?.();
    void active.then(
      () => finish(true),
      () => finish(true)
    );
  });
}
