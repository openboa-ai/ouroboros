import { createHash } from "node:crypto";
import type { PaperTradingEvaluationRecord } from "@ouroboros/domain";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import {
  autonomousArenaLoopDesiredStatus,
  type OperatorService
} from "@ouroboros/application/services/operator";
import type { CandidateArenaRunner } from
  "@ouroboros/application/candidate/arena";
import type {
  PaperTradingRecoveryOutcome,
  PaperTradingSessionService
} from "@ouroboros/application/trading/paper/session-service";
import type { ResearchControlStudySchedulerLifecycle } from
  "./candidate/arena/research-control-study-scheduler";
import type { RuntimeSupervisorLaneAdapter } from "./runtime-supervisor";

export class RuntimeSupervisorLaneError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "RuntimeSupervisorLaneError";
  }
}

export function createRuntimeSupervisorLanes(options: {
  store: OuroborosStorePort;
  paperTradingSessions: Pick<
    PaperTradingSessionService,
    | "active"
    | "recoverRunningEvaluations"
    | "finalizeRecoveryFailures"
    | "stopAllSessions"
  >;
  candidateArenaRunner: Pick<CandidateArenaRunner, "health" | "stopAndDrain">;
  operatorService: Pick<
    OperatorService,
    "resumeAutonomousArenaLoop" | "drainAutonomousPaperStarts"
  >;
  researchControlStudyScheduler: ResearchControlStudySchedulerLifecycle;
  runSelectedPaper?: boolean;
  runResearchControlStudies: boolean;
  onPaperTradingRecovery?: (
    outcomes: readonly PaperTradingRecoveryOutcome[]
  ) => void | Promise<void>;
  logger?: Pick<Console, "error">;
}): readonly RuntimeSupervisorLaneAdapter[] {
  let latestPaperFailures: PaperTradingRecoveryOutcome[] = [];
  let schedulerStartAccepted = false;

  const selectedPaper: RuntimeSupervisorLaneAdapter = {
    lane: "selected_paper",
    async inspect() {
      const evaluations = await latestPaperEvaluations(options.store);
      const desired = options.runSelectedPaper === false ? [] : (
        await Promise.all(evaluations.map(async (evaluation) => ({
          evaluation,
          run: await options.store.getTradingRun(evaluation.trading_run_ref.id)
        })))
      ).filter(({ evaluation, run }) =>
        evaluation.status === "running" &&
        run?.paper_evidence_purpose !== "qualification"
      );
      const progress = desired.map(({ evaluation }) => ({
        paper_trading_evaluation_id:
          evaluation.paper_trading_evaluation_id,
        trading_run_id: evaluation.trading_run_ref.id,
        status: evaluation.status,
        observation_count: evaluation.observation_count,
        last_observed_at: evaluation.last_observed_at ?? null,
        next_observation_at: evaluation.next_observation_at ?? null,
        active: options.paperTradingSessions.active(
          evaluation.trading_run_ref.id
        )
      }));
      return {
        desired: desired.length > 0,
        satisfied: desired.every(({ evaluation }) =>
          options.paperTradingSessions.active(evaluation.trading_run_ref.id)
        ),
        basisDigest: digest(desired.map(({ evaluation }) => ({
          paper_trading_evaluation_id:
            evaluation.paper_trading_evaluation_id,
          candidate_id: evaluation.candidate_ref.id,
          candidate_version_id: evaluation.candidate_version_ref.id,
          trading_run_id: evaluation.trading_run_ref.id,
          interval_ms: evaluation.interval_ms,
          started_at: evaluation.started_at
        }))),
        progressDigest: digest(progress),
        ...(desired.length === 0
          ? { reasonCode: "not_requested" }
          : progress.some((entry) => !entry.active)
            ? { reasonCode: "paper_trading_session_inactive" }
            : {})
      };
    },
    async recover() {
      const outcomes = await options.paperTradingSessions
        .recoverRunningEvaluations({ persistFailures: false });
      latestPaperFailures = outcomes.filter((outcome) =>
        outcome.status === "failed"
      );
      notifyPaperTradingRecoveryObserver(options, outcomes);
      if (latestPaperFailures.length > 0) {
        throw new RuntimeSupervisorLaneError(
          "paper_trading_recovery_failed",
          `${latestPaperFailures.length} PaperTrading session recovery attempt(s) failed.`
        );
      }
    },
    async block() {
      if (latestPaperFailures.length > 0) {
        await options.paperTradingSessions.finalizeRecoveryFailures(
          latestPaperFailures
        );
      } else {
        await options.paperTradingSessions.stopAllSessions();
      }
    },
    async stop() {
      await options.paperTradingSessions.stopAllSessions();
    }
  };

  const candidateArena: RuntimeSupervisorLaneAdapter = {
    lane: "candidate_arena",
    async inspect() {
      const commands = await options.store.listOuroborosCommands();
      const desired = autonomousArenaLoopDesiredStatus(commands) === "running";
      const health = options.candidateArenaRunner.health();
      const provider = await options.store.getResearcherProviderSelection();
      return {
        desired,
        satisfied: !desired || (
          health.status === "running" &&
          (health.consecutive_failure_count === 0 || health.active_tick)
        ),
        basisDigest: digest({
          control_commands: commands
            .filter((command) =>
              command.command_kind === "arena.start" ||
              command.command_kind === "arena.stop"
            )
            .map((command) => ({
              ouroboros_command_id: command.ouroboros_command_id,
              command_kind: command.command_kind,
              status: command.status,
              requested_at: command.requested_at,
              completed_at: command.completed_at
            })),
          selected_provider: provider?.selected_provider ?? null
        }),
        progressDigest: digest(health),
        ...(!desired
          ? { reasonCode: "not_requested" }
          : health.last_error_code
            ? { reasonCode: health.last_error_code }
            : health.status !== "running"
              ? { reasonCode: "candidate_arena_stopped" }
              : {})
      };
    },
    async recover() {
      if (options.candidateArenaRunner.health().consecutive_failure_count > 0) {
        await options.candidateArenaRunner.stopAndDrain();
        await options.operatorService.drainAutonomousPaperStarts();
      }
      const result = await options.operatorService.resumeAutonomousArenaLoop();
      if (result !== "resumed") {
        throw new RuntimeSupervisorLaneError(
          result === "blocked"
            ? "candidate_arena_provider_blocked"
            : "candidate_arena_intent_changed",
          `CandidateArena recovery ended as ${result}.`
        );
      }
    },
    async block() {
      await stopCandidateArena(options);
    },
    async stop() {
      await stopCandidateArena(options);
    }
  };

  const researchScheduler: RuntimeSupervisorLaneAdapter = {
    lane: "research_control_study_scheduler",
    async inspect() {
      const status = options.researchControlStudyScheduler.status();
      const schedulerActive =
        options.researchControlStudyScheduler.active?.() ?? schedulerStartAccepted;
      if (status.status === "running" || status.status === "waiting") {
        schedulerStartAccepted = true;
      } else if (!schedulerActive && (
        status.status === "failed" || status.status === "stopped"
      )) {
        schedulerStartAccepted = false;
      }
      const desired = options.runResearchControlStudies;
      const [studies, outcomes] = await Promise.all([
        options.store.listResearchControlStudies(),
        options.store.listResearchControlStudyOutcomes()
      ]);
      return {
        desired,
        satisfied: !desired || (
          schedulerStartAccepted &&
          (options.researchControlStudyScheduler.active?.() ?? true) &&
          status.status !== "stopping"
        ),
        basisDigest: digest({ enabled: desired, studies, outcomes }),
        progressDigest: digest(status),
        ...(!desired
          ? { reasonCode: "not_requested" }
          : status.status === "failed"
            ? { reasonCode: status.errorCode }
            : {})
      };
    },
    async recover() {
      const result = options.researchControlStudyScheduler.start();
      schedulerStartAccepted = result === "started" || result === "already_running";
    },
    async block() {
      schedulerStartAccepted = false;
      await options.researchControlStudyScheduler.stop();
    },
    async stop() {
      schedulerStartAccepted = false;
      await options.researchControlStudyScheduler.stop();
    }
  };

  return [selectedPaper, candidateArena, researchScheduler];
}

async function latestPaperEvaluations(
  store: OuroborosStorePort
): Promise<PaperTradingEvaluationRecord[]> {
  const latest = new Map<string, PaperTradingEvaluationRecord>();
  for (const evaluation of await store.listPaperTradingEvaluations()) {
    const runId = evaluation.trading_run_ref.id;
    const current = latest.get(runId);
    if (!current || evaluation.started_at > current.started_at || (
      evaluation.started_at === current.started_at &&
      evaluation.paper_trading_evaluation_id >
        current.paper_trading_evaluation_id
    )) {
      latest.set(runId, evaluation);
    }
  }
  return [...latest.values()].sort((left, right) =>
    left.started_at.localeCompare(right.started_at) ||
    left.paper_trading_evaluation_id.localeCompare(
      right.paper_trading_evaluation_id
    )
  );
}

async function stopCandidateArena(options: {
  candidateArenaRunner: Pick<CandidateArenaRunner, "stopAndDrain">;
  operatorService: Pick<OperatorService, "drainAutonomousPaperStarts">;
}): Promise<void> {
  await options.candidateArenaRunner.stopAndDrain();
  await options.operatorService.drainAutonomousPaperStarts();
}

export function notifyPaperTradingRecoveryObserver(
  options: {
    onPaperTradingRecovery?: (
      outcomes: readonly PaperTradingRecoveryOutcome[]
    ) => void | Promise<void>;
    logger?: Pick<Console, "error">;
  },
  outcomes: readonly PaperTradingRecoveryOutcome[]
): void {
  if (!options.onPaperTradingRecovery) return;
  try {
    void Promise.resolve(options.onPaperTradingRecovery(outcomes)).catch(
      (error) => (options.logger ?? console).error(
        "PaperTrading recovery observer failed.",
        error
      )
    );
  } catch (error) {
    (options.logger ?? console).error(
      "PaperTrading recovery observer failed.",
      error
    );
  }
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`;
}
