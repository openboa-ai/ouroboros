import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type { ResearchControlStudyRecord } from "@ouroboros/domain";
import type { ResearchControlStudyRunner } from
  "./research-control-study-runner";
import { discoverResearchControlStudyProcessQueue } from
  "./research-control-study-process-discovery";
import type {
  ResearchControlStudyExecutionLeaseSessionFactory,
  ResearchControlStudyExecutionLeaseSessionError
} from "./research-control-study-execution-lease-session";

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
      status: "contended";
      completedStudyCount: number;
      studyId: string;
      reason: "owner_alive" | "owner_liveness_unknown" | "transition";
      leaseExpiresAt: string;
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
    leaseSessionFactory?: ResearchControlStudyExecutionLeaseSessionFactory;
    openStudy(
      study: ResearchControlStudyRecord,
      ownership?: { guard(): Promise<void> }
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
        const result = await this.runStudy(study, completedStudyCount);
        if (result.status === "contended") {
          this.currentStatus = {
            status: "contended",
            completedStudyCount,
            studyId: currentStudyId,
            reason: result.reason,
            leaseExpiresAt: result.leaseExpiresAt
          };
          return;
        }
        if (result.status === "stopped") {
          this.currentStatus = {
            status: "stopped",
            completedStudyCount,
            studyId: currentStudyId
          };
          return;
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

  private async runStudy(
    study: ResearchControlStudyRecord,
    completedStudyCount: number
  ): Promise<
    | { status: "completed" }
    | { status: "stopped" }
    | {
        status: "contended";
        reason: "owner_alive" | "owner_liveness_unknown" | "transition";
        leaseExpiresAt: string;
      }
  > {
    const claim = this.options.leaseSessionFactory
      ? await this.options.leaseSessionFactory.acquire(structuredClone(study))
      : undefined;
    if (claim?.status === "held") {
      return {
        status: "contended",
        reason: claim.reason,
        leaseExpiresAt: claim.lease.expires_at
      };
    }
    const session = claim?.status === "acquired" ? claim.session : undefined;
    let runtime: ResearchControlStudyProcessRuntime | undefined;
    let leaseLoss: ResearchControlStudyExecutionLeaseSessionError | undefined;
    let leaseStopPromise: Promise<void> | undefined;
    let result: { status: "completed" } | { status: "stopped" } | undefined;
    let failure: unknown;
    try {
      if (session) {
        const started = session.start((error) => {
          if (leaseLoss) return;
          leaseLoss = error;
          if (runtime) {
            try {
              leaseStopPromise = Promise.resolve(runtime.runner.stop())
                .catch(() => undefined);
            } catch {
              leaseStopPromise = Promise.resolve();
            }
          }
        });
        if (started !== "started") {
          throw new ResearchControlStudyProcessError(
            "research_control_study_process_runner_invalid",
            "ResearchControlStudy lease session was already running."
          );
        }
      }
      runtime = await this.openStudy(
        study,
        session ? { guard: () => session.guard() } : undefined
      );
      if (leaseLoss) throw leaseLoss;
      if (this.stopRequested) {
        result = { status: "stopped" };
      } else {
        this.active = { study, runtime };
        this.currentStatus = {
          status: "running",
          studyId: study.research_control_study_id,
          completedStudyCount
        };
        runtime.runner.start({ studyId: study.research_control_study_id });
        await runtime.runner.drain();
        await leaseStopPromise;
        const runnerStatus = runtime.runner.status();
        this.active = undefined;
        if (leaseLoss) throw leaseLoss;
        if (this.stopRequested) {
          result = { status: "stopped" };
        } else if (runnerStatus.status === "failed") {
          throw runnerFailure(
            runnerStatus.errorCode,
            runnerStatus.errorMessage
          );
        } else if (runnerStatus.status !== "completed") {
          throw new ResearchControlStudyProcessError(
            "research_control_study_process_runner_invalid",
            `ResearchControlStudy runner ended as ${runnerStatus.status}.`
          );
        } else {
          const reloadedQueue = await this.discover();
          if (reloadedQueue.some((candidate) =>
            candidate.research_control_study_id ===
              study.research_control_study_id
          )) {
            throw new ResearchControlStudyProcessError(
              "research_control_study_process_persistence_conflict",
              "Completed ResearchControlStudy remains pending after exact reload."
            );
          }
          result = { status: "completed" };
        }
      }
    } catch (error) {
      failure = error;
    }
    this.active = undefined;
    if (session) {
      try {
        await session.stopAndRelease();
      } catch (error) {
        if (!failure || stableErrorCode(failure) !==
            "research_control_study_execution_lease_lost" ||
          stableErrorCode(error) !==
            "research_control_study_execution_lease_lost") {
          failure = error;
        }
      }
    }
    if (failure) throw failure;
    if (!result) {
      throw new ResearchControlStudyProcessError(
        "research_control_study_process_runner_invalid",
        "ResearchControlStudy process produced no terminal result."
      );
    }
    return result;
  }

  private async discover(): Promise<ResearchControlStudyRecord[]> {
    const [studies, outcomes] = await Promise.all([
      this.options.store.listResearchControlStudies(),
      this.options.store.listResearchControlStudyOutcomes()
    ]);
    return discoverResearchControlStudyProcessQueue({ studies, outcomes });
  }

  private async openStudy(
    study: ResearchControlStudyRecord,
    ownership?: { guard(): Promise<void> }
  ): Promise<ResearchControlStudyProcessRuntime> {
    try {
      const runtime = await this.options.openStudy(
        structuredClone(study),
        ownership ? { guard: ownership.guard } : undefined
      );
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

function runnerFailure(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function stableErrorCode(error: unknown): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "research_control_study_process_failed";
}
