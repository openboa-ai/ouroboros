import type {
  ResearchControlCampaignPaperExecutor,
  ResearchControlCampaignPaperExecutorStep
} from "./research-control-campaign-paper-executor";

export type ResearchControlCampaignPaperRunnerStatus =
  | { status: "idle" }
  | {
      status: "running";
      campaignId: string;
      latestStep?: ResearchControlCampaignPaperExecutorStep;
    }
  | {
      status: "completed";
      latestStep: ResearchControlCampaignPaperExecutorStep;
    }
  | {
      status: "stopped";
      latestStep?: ResearchControlCampaignPaperExecutorStep;
    }
  | {
      status: "failed";
      errorCode: string;
      errorMessage: string;
      latestStep?: ResearchControlCampaignPaperExecutorStep;
    };

export class ResearchControlCampaignPaperRunner {
  private readonly now: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private currentStatus: ResearchControlCampaignPaperRunnerStatus = {
    status: "idle"
  };
  private runPromise?: Promise<void>;
  private stopSignal?: DeferredSignal;
  private stopRequested = false;

  constructor(private readonly options: {
    executor: Pick<ResearchControlCampaignPaperExecutor, "advance">;
    now?: () => string;
    sleep?: (milliseconds: number) => Promise<void>;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => {
      const timer = setTimeout(resolve, milliseconds);
      timer.unref?.();
    }));
  }

  start(input: { campaignId: string }): void {
    if (this.runPromise) {
      throw new Error("research_control_campaign_paper_runner_already_running");
    }
    const campaignId = normalizeId(input?.campaignId);
    this.stopRequested = false;
    this.stopSignal = deferredSignal();
    this.currentStatus = { status: "running", campaignId };
    const running = this.run(campaignId);
    let tracked: Promise<void>;
    tracked = running.finally(() => {
      if (this.runPromise === tracked) {
        this.runPromise = undefined;
        this.stopSignal = undefined;
      }
    });
    this.runPromise = tracked;
  }

  status(): ResearchControlCampaignPaperRunnerStatus {
    return structuredClone(this.currentStatus);
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.stopSignal?.resolve();
    await this.drain();
  }

  async drain(): Promise<void> {
    await this.runPromise;
  }

  private async run(campaignId: string): Promise<void> {
    let latestStep: ResearchControlCampaignPaperExecutorStep | undefined;
    try {
      while (!this.stopRequested) {
        latestStep = await this.options.executor.advance({ campaignId });
        if (this.stopRequested) {
          this.currentStatus = { status: "stopped", latestStep };
          return;
        }
        this.currentStatus = {
          status: "running",
          campaignId,
          latestStep
        };
        if (latestStep.status === "complete") {
          this.currentStatus = { status: "completed", latestStep };
          return;
        }
        if (latestStep.status === "waiting") {
          const now = exactTime(this.now());
          const delay = Math.max(
            0,
            Date.parse(latestStep.wakeAt) - Date.parse(now)
          );
          if (delay > 0) {
            await Promise.race([
              this.sleep(delay),
              this.stopSignal?.promise ?? Promise.resolve()
            ]);
          }
        }
      }
      this.currentStatus = { status: "stopped", ...(latestStep
        ? { latestStep }
        : {}) };
    } catch (error) {
      this.currentStatus = {
        status: "failed",
        errorCode: stableErrorCode(error),
        errorMessage: error instanceof Error ? error.message : "unknown_error",
        ...(latestStep ? { latestStep } : {})
      };
    }
  }
}

interface DeferredSignal {
  promise: Promise<void>;
  resolve(): void;
}

function deferredSignal(): DeferredSignal {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function normalizeId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw new TypeError("research_control_campaign_paper_runner_invalid_input");
  }
  return value;
}

function exactTime(value: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError("research_control_campaign_paper_runner_invalid_clock");
  }
  return value;
}

function stableErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "research_control_campaign_paper_runner_failed";
}
