import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type { ResearchControlStudyRecord } from "@ouroboros/domain";
import type { ResearchControlStudyRunner } from
  "./research-control-study-runner";
import { discoverResearchControlStudyProcessQueue } from
  "./research-control-study-process-discovery";

export type ResearchControlStudyProcessStatus =
  | { status: "idle" }
  | { status: "discovering"; completedStudyCount: number }
  | {
      status: "running";
      studyId: string;
      completedStudyCount: number;
    }
  | {
      status: "caught_up";
      completedStudyCount: number;
    }
  | {
      status: "stopped";
      completedStudyCount: number;
      studyId?: string;
    }
  | {
      status: "failed";
      completedStudyCount: number;
      studyId?: string;
      errorCode: string;
      errorMessage: string;
    };

export interface ResearchControlStudyProcessRuntime {
  runner: Pick<
    ResearchControlStudyRunner,
    "start" | "drain" | "stop" | "status"
  >;
}

export type ResearchControlStudyProcessStore = Pick<
  OuroborosStorePort,
  "listResearchControlStudies" | "listResearchControlStudyOutcomes"
>;

export class ResearchControlStudyProcessError extends Error {
  constructor(
    readonly code:
      | "research_control_study_process_open_failed"
      | "research_control_study_process_persistence_conflict"
      | "research_control_study_process_runner_invalid",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudyProcessError";
  }
}

export class ResearchControlStudyProcessSupervisor {
  private currentStatus: ResearchControlStudyProcessStatus = { status: "idle" };
  private runPromise?: Promise<void>;
  private stopRequested = false;
  private active?: {
    study: ResearchControlStudyRecord;
    runtime: ResearchControlStudyProcessRuntime;
  };

  constructor(private readonly options: {
    store: ResearchControlStudyProcessStore;
    openStudy(
      study: ResearchControlStudyRecord
    ): ResearchControlStudyProcessRuntime |
      Promise<ResearchControlStudyProcessRuntime>;
  }) {}

  start(): "started" | "already_running" {
    if (this.runPromise) return "already_running";
    this.stopRequested = false;
    this.currentStatus = { status: "discovering", completedStudyCount: 0 };
    const running = this.run();
    let tracked: Promise<void>;
    tracked = running.finally(() => {
      if (this.runPromise === tracked) this.runPromise = undefined;
    });
    this.runPromise = tracked;
    return "started";
  }

  status(): ResearchControlStudyProcessStatus {
    return structuredClone(this.currentStatus);
  }

  async drain(): Promise<void> {
    await this.runPromise;
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    const active = this.active;
    if (active) await active.runtime.runner.stop();
    await this.drain();
  }

  private async run(): Promise<void> {
    let completedStudyCount = 0;
    let currentStudyId: string | undefined;
    try {
      while (true) {
        this.currentStatus = {
          status: "discovering",
          completedStudyCount
        };
        const queue = await this.discover();
        if (this.stopRequested) {
          this.currentStatus = {
            status: "stopped",
            completedStudyCount,
            ...(currentStudyId ? { studyId: currentStudyId } : {})
          };
          return;
        }
        const study = queue[0];
        if (!study) {
          this.currentStatus = { status: "caught_up", completedStudyCount };
          return;
        }
        currentStudyId = study.research_control_study_id;
        const runtime = await this.openStudy(study);
        if (this.stopRequested) {
          this.currentStatus = {
            status: "stopped",
            completedStudyCount,
            studyId: currentStudyId
          };
          return;
        }
        this.active = { study, runtime };
        this.currentStatus = {
          status: "running",
          studyId: currentStudyId,
          completedStudyCount
        };
        runtime.runner.start({ studyId: currentStudyId });
        await runtime.runner.drain();
        const runnerStatus = runtime.runner.status();
        this.active = undefined;
        if (runnerStatus.status === "failed") {
          this.currentStatus = {
            status: "failed",
            completedStudyCount,
            studyId: currentStudyId,
            errorCode: runnerStatus.errorCode,
            errorMessage: runnerStatus.errorMessage
          };
          return;
        }
        if (this.stopRequested) {
          this.currentStatus = {
            status: "stopped",
            completedStudyCount,
            studyId: currentStudyId
          };
          return;
        }
        if (runnerStatus.status !== "completed") {
          throw new ResearchControlStudyProcessError(
            "research_control_study_process_runner_invalid",
            `ResearchControlStudy runner ended as ${runnerStatus.status}.`
          );
        }
        const reloadedQueue = await this.discover();
        if (reloadedQueue.some((candidate) =>
          candidate.research_control_study_id === currentStudyId
        )) {
          throw new ResearchControlStudyProcessError(
            "research_control_study_process_persistence_conflict",
            "Completed ResearchControlStudy remains pending after exact reload."
          );
        }
        completedStudyCount += 1;
        currentStudyId = undefined;
      }
    } catch (error) {
      this.active = undefined;
      this.currentStatus = {
        status: "failed",
        completedStudyCount,
        ...(currentStudyId ? { studyId: currentStudyId } : {}),
        errorCode: stableErrorCode(error),
        errorMessage: error instanceof Error ? error.message : "unknown_error"
      };
    }
  }

  private async discover(): Promise<ResearchControlStudyRecord[]> {
    const [studies, outcomes] = await Promise.all([
      this.options.store.listResearchControlStudies(),
      this.options.store.listResearchControlStudyOutcomes()
    ]);
    return discoverResearchControlStudyProcessQueue({ studies, outcomes });
  }

  private async openStudy(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyProcessRuntime> {
    try {
      const runtime = await this.options.openStudy(structuredClone(study));
      if (!runtime || !runtime.runner ||
        typeof runtime.runner.start !== "function" ||
        typeof runtime.runner.drain !== "function" ||
        typeof runtime.runner.stop !== "function" ||
        typeof runtime.runner.status !== "function") {
        throw new Error("invalid_study_runtime");
      }
      return runtime;
    } catch (error) {
      throw new ResearchControlStudyProcessError(
        "research_control_study_process_open_failed",
        "ResearchControlStudy process could not open its runtime.",
        { cause: error }
      );
    }
  }
}

function stableErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "research_control_study_process_failed";
}
