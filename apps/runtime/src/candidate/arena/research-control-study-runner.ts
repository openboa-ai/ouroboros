import type {
  ResearchControlStudyExecutor,
  ResearchControlStudyExecutorStep
} from "./research-control-study-executor";

export type ResearchControlStudyRunnerStatus =
  | { status: "idle" }
  | {
      status: "running";
      studyId: string;
      latestStep?: ResearchControlStudyExecutorStep;
    }
  | {
      status: "completed";
      latestStep: Extract<
        ResearchControlStudyExecutorStep,
        { status: "complete" }
      >;
    }
  | {
      status: "stopped";
      latestStep?: ResearchControlStudyExecutorStep;
    }
  | {
      status: "failed";
      errorCode: string;
      errorMessage: string;
      latestStep?: ResearchControlStudyExecutorStep;
    };

export class ResearchControlStudyRunner {
  private currentStatus: ResearchControlStudyRunnerStatus = { status: "idle" };
  private runPromise?: Promise<void>;
  private stopRequested = false;

  constructor(private readonly options: {
    executor: Pick<ResearchControlStudyExecutor, "advance">;
  }) {}

  start(input: { studyId: string }): void {
    if (this.runPromise) {
      throw new Error("research_control_study_runner_already_running");
    }
    const studyId = exactId(input?.studyId);
    this.stopRequested = false;
    this.currentStatus = { status: "running", studyId };
    const running = this.run(studyId);
    let tracked: Promise<void>;
    tracked = running.finally(() => {
      if (this.runPromise === tracked) this.runPromise = undefined;
    });
    this.runPromise = tracked;
  }

  status(): ResearchControlStudyRunnerStatus {
    return structuredClone(this.currentStatus);
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    await this.drain();
  }

  async drain(): Promise<void> {
    await this.runPromise;
  }

  private async run(studyId: string): Promise<void> {
    let latestStep: ResearchControlStudyExecutorStep | undefined;
    try {
      while (!this.stopRequested) {
        latestStep = await this.options.executor.advance({ studyId });
        if (this.stopRequested) {
          this.currentStatus = { status: "stopped", latestStep };
          return;
        }
        if (latestStep.status === "complete") {
          this.currentStatus = {
            status: "completed",
            latestStep
          };
          return;
        }
        this.currentStatus = {
          status: "running",
          studyId,
          latestStep
        };
      }
      this.currentStatus = {
        status: "stopped",
        ...(latestStep ? { latestStep } : {})
      };
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

function exactId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw new TypeError("research_control_study_runner_invalid_input");
  }
  return value;
}

function stableErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "research_control_study_runner_failed";
}
