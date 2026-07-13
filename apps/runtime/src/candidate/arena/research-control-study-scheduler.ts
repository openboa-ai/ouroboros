import type {
  ResearchControlStudyProcessStatus,
  ResearchControlStudyProcessSupervisor
} from "./research-control-study-process-supervisor";

export type ResearchControlStudySchedulerStatus =
  | {
      status: "idle" | "running" | "stopping" | "stopped";
      cycleCount: number;
      completedStudyCount: number;
    }
  | {
      status: "waiting";
      cycleCount: number;
      completedStudyCount: number;
      nextPollAt: string;
    }
  | {
      status: "failed";
      cycleCount: number;
      completedStudyCount: number;
      studyId?: string;
      errorCode: string;
      errorMessage: string;
    };

export interface ResearchControlStudySchedulerLifecycle {
  start(): "started" | "already_running";
  stop(): Promise<void>;
  drain(): Promise<void>;
  status(): ResearchControlStudySchedulerStatus;
}

export class ResearchControlStudySchedulerError extends Error {
  constructor(
    readonly code:
      | "research_control_study_scheduler_clock_invalid"
      | "research_control_study_scheduler_interval_invalid"
      | "research_control_study_scheduler_supervisor_invalid"
      | "research_control_study_scheduler_terminal",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudySchedulerError";
  }
}

type SupervisorLifecycle = Pick<
  ResearchControlStudyProcessSupervisor,
  "start" | "drain" | "stop" | "status"
>;

export class ResearchControlStudyScheduler
implements ResearchControlStudySchedulerLifecycle {
  private readonly pollIntervalMs: number;
  private readonly now: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private currentStatus: ResearchControlStudySchedulerStatus = {
    status: "idle",
    cycleCount: 0,
    completedStudyCount: 0
  };
  private cycleCount = 0;
  private completedStudyCount = 0;
  private runPromise?: Promise<void>;
  private stopRequested = false;
  private stopSignal = deferredSignal();

  constructor(private readonly options: {
    supervisor: SupervisorLifecycle;
    pollIntervalMs?: number;
    now?: () => string;
    sleep?: (milliseconds: number) => Promise<void>;
  }) {
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    if (!Number.isInteger(this.pollIntervalMs) || this.pollIntervalMs <= 0 ||
      !Number.isFinite(this.pollIntervalMs)) {
      throw new ResearchControlStudySchedulerError(
        "research_control_study_scheduler_interval_invalid",
        "ResearchControlStudy scheduler poll interval must be a finite positive integer."
      );
    }
    this.now = options.now ?? (() => new Date().toISOString());
    this.sleep = options.sleep ?? unreferencedSleep;
  }

  start(): "started" | "already_running" {
    if (this.runPromise) return "already_running";
    if (this.currentStatus.status === "failed") {
      throw new ResearchControlStudySchedulerError(
        "research_control_study_scheduler_terminal",
        "A failed ResearchControlStudy scheduler cannot restart in the same process."
      );
    }
    this.stopRequested = false;
    this.stopSignal = deferredSignal();
    const running = this.run();
    let tracked: Promise<void>;
    tracked = running.finally(() => {
      if (this.runPromise === tracked) this.runPromise = undefined;
    });
    this.runPromise = tracked;
    return "started";
  }

  status(): ResearchControlStudySchedulerStatus {
    return structuredClone(this.currentStatus);
  }

  async drain(): Promise<void> {
    await this.runPromise;
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    this.stopSignal.resolve();
    const running = this.runPromise;
    if (!running) {
      if (this.currentStatus.status !== "failed") this.markStopped();
      return;
    }
    if (this.currentStatus.status === "running") {
      this.currentStatus = {
        status: "stopping",
        cycleCount: this.cycleCount,
        completedStudyCount: this.completedStudyCount
      };
      await this.options.supervisor.stop();
    }
    await running;
  }

  private async run(): Promise<void> {
    try {
      while (!this.stopRequested) {
        this.currentStatus = {
          status: "running",
          cycleCount: this.cycleCount,
          completedStudyCount: this.completedStudyCount
        };
        const started = this.options.supervisor.start();
        if (started !== "started") {
          throw new ResearchControlStudySchedulerError(
            "research_control_study_scheduler_supervisor_invalid",
            "ResearchControlStudy supervisor was already running at cycle start."
          );
        }
        await this.options.supervisor.drain();
        const supervisorStatus = this.options.supervisor.status();
        if (this.stopRequested && supervisorStatus.status === "stopped") {
          this.markStopped();
          return;
        }

        this.cycleCount += 1;
        this.completedStudyCount += completedCount(supervisorStatus);
        if (supervisorStatus.status === "failed") {
          this.currentStatus = {
            status: "failed",
            cycleCount: this.cycleCount,
            completedStudyCount: this.completedStudyCount,
            ...(supervisorStatus.studyId
              ? { studyId: supervisorStatus.studyId }
              : {}),
            errorCode: supervisorStatus.errorCode,
            errorMessage: supervisorStatus.errorMessage
          };
          return;
        }
        if (supervisorStatus.status !== "caught_up" &&
          supervisorStatus.status !== "contended") {
          throw new ResearchControlStudySchedulerError(
            "research_control_study_scheduler_supervisor_invalid",
            `ResearchControlStudy supervisor ended as ${supervisorStatus.status}.`
          );
        }
        if (this.stopRequested) {
          this.markStopped();
          return;
        }

        const nextPollAt = this.nextPollAt();
        this.currentStatus = {
          status: "waiting",
          cycleCount: this.cycleCount,
          completedStudyCount: this.completedStudyCount,
          nextPollAt
        };
        const wakeReason = await Promise.race([
          this.sleep(this.pollIntervalMs).then(() => "poll" as const),
          this.stopSignal.promise.then(() => "stop" as const)
        ]);
        if (wakeReason === "stop" || this.stopRequested) {
          this.markStopped();
          return;
        }
      }
      this.markStopped();
    } catch (error) {
      this.currentStatus = {
        status: "failed",
        cycleCount: this.cycleCount,
        completedStudyCount: this.completedStudyCount,
        errorCode: stableErrorCode(error),
        errorMessage: error instanceof Error ? error.message : "unknown_error"
      };
    }
  }

  private nextPollAt(): string {
    const now = this.now();
    const epoch = Date.parse(now);
    let exactNow: string;
    try {
      exactNow = new Date(epoch).toISOString();
    } catch {
      exactNow = "";
    }
    if (!Number.isFinite(epoch) || exactNow !== now) {
      throw new ResearchControlStudySchedulerError(
        "research_control_study_scheduler_clock_invalid",
        "ResearchControlStudy scheduler clock must return an exact ISO instant."
      );
    }
    try {
      return new Date(epoch + this.pollIntervalMs).toISOString();
    } catch (error) {
      throw new ResearchControlStudySchedulerError(
        "research_control_study_scheduler_clock_invalid",
        "ResearchControlStudy scheduler clock exceeds the supported time range.",
        { cause: error }
      );
    }
  }

  private markStopped(): void {
    this.currentStatus = {
      status: "stopped",
      cycleCount: this.cycleCount,
      completedStudyCount: this.completedStudyCount
    };
  }
}

function completedCount(status: ResearchControlStudyProcessStatus): number {
  return "completedStudyCount" in status ? status.completedStudyCount : 0;
}

function stableErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "research_control_study_scheduler_failed";
}

function unreferencedSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    (timer as unknown as { unref?: () => void }).unref?.();
  });
}

function deferredSignal(): { promise: Promise<void>; resolve(): void } {
  let resolved = false;
  let complete!: () => void;
  const promise = new Promise<void>((resolve) => { complete = resolve; });
  return {
    promise,
    resolve() {
      if (resolved) return;
      resolved = true;
      complete();
    }
  };
}
