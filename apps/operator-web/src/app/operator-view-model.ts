import type {
  ArenaOperationsReadModel,
  CandidateArenaReadModel,
  OperatorReadModel,
  PaperTradingBoardEntryReadModel,
  ResearchOperationsReadModel
} from "@ouroboros/domain";

export type OperatorProjectionInput = Pick<
  OperatorReadModel,
  "arena_operations" | "research_operations" | "paper_trading_board" | "candidate_arena"
>;

export type ProjectionAvailability =
  | "authoritative"
  | "compatibility"
  | "history_only"
  | "unavailable";

export interface ArenaSystemViewModel {
  id: string;
  versionId?: string;
  evaluationId?: string;
  tradingRunId?: string;
  name: string;
  direction?: string;
  lifecycle: string;
  rankStatus: string;
  rank?: number;
  comparability: string;
  unrankedReasons: string[];
  netRevenueUsdt?: number;
  netReturnPct?: number;
  revenueUsdt?: number;
  costUsdt?: number;
  observationCount: number;
  failedObservationCount: number;
  lastObservedAt?: string;
  nextObservationAt?: string;
  latestFailure?: string;
  source: "arena_operations" | "paper_trading_board";
  detailAvailability: "summary_only";
}

export interface ArenaWorkspaceViewModel {
  availability: Exclude<ProjectionAvailability, "history_only">;
  loopStatus: string;
  capacity?: ArenaOperationsReadModel["capacity"];
  systems: ArenaSystemViewModel[];
  latestSystemId?: string;
  emptyState: "none" | "available_empty" | "projection_unavailable";
}

export interface ResearchSessionViewModel {
  id: string;
  allocationId: string;
  workerId?: string;
  workerSessionId?: string;
  commitmentId?: string;
  status: string;
  triggerKind: string;
  goal: string;
  triggeredAt: string;
  direction: string;
  hypothesis: string;
  method: string;
  evidenceArtifactCount: number;
  provider: string;
  model?: string;
  completedExperimentCount: number;
  maxExperimentCount: number;
  developmentSubmissionCount: number;
  maxDevelopmentSubmissionCount: number;
  startedAt?: string;
  lastProgressAt?: string;
  completedAt?: string;
  latestProgressSummary: string;
  admittedCandidateId?: string;
  detailAvailability: "summary_only";
}

export interface ResearchHistoryViewModel {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string;
  createdCandidateCount: number;
  createdCandidateIds: string[];
  directionCount: number;
}

export interface ResearchWorkspaceViewModel {
  availability: Exclude<ProjectionAvailability, "compatibility">;
  loopStatus: string;
  capacity?: ResearchOperationsReadModel["capacity"];
  sessions: ResearchSessionViewModel[];
  latestSessionId?: string;
  history: ResearchHistoryViewModel[];
  emptyState: "none" | "available_empty" | "projection_unavailable";
}

export function buildArenaWorkspaceViewModel(
  operator: OperatorProjectionInput
): ArenaWorkspaceViewModel {
  if (operator.arena_operations) {
    const systems = operator.arena_operations.systems.map((system): ArenaSystemViewModel => ({
      id: system.candidate_id,
      versionId: system.candidate_version_id,
      evaluationId: system.evaluation_id,
      tradingRunId: system.trading_run_id,
      name: system.display_name,
      direction: system.direction_kind,
      lifecycle: system.session_status,
      rankStatus: system.rank_status,
      rank: system.rank_status === "unranked" ? undefined : system.rank,
      comparability: system.comparability_status,
      unrankedReasons: [...system.unranked_reasons],
      netRevenueUsdt: system.profit_loss?.net_revenue_usdt,
      netReturnPct: system.profit_loss?.net_return_pct,
      revenueUsdt: system.profit_loss?.revenue_usdt,
      costUsdt: system.profit_loss?.cost_usdt,
      observationCount: system.observation_count,
      failedObservationCount: system.failed_observation_count,
      lastObservedAt: system.last_observed_at,
      nextObservationAt: system.next_observation_at,
      latestFailure: system.latest_failure?.reason,
      source: "arena_operations",
      detailAvailability: "summary_only"
    }));

    return {
      availability: "authoritative",
      loopStatus: operator.arena_operations.loop_status,
      capacity: operator.arena_operations.capacity,
      systems,
      latestSystemId: operator.arena_operations.latest_system_id,
      emptyState: systems.length === 0 ? "available_empty" : "none"
    };
  }

  if (operator.paper_trading_board.entries.length > 0) {
    return {
      availability: "compatibility",
      loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
      systems: operator.paper_trading_board.entries.map(paperBoardSystemViewModel),
      emptyState: "none"
    };
  }

  return {
    availability: "unavailable",
    loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
    systems: [],
    emptyState: "projection_unavailable"
  };
}

export function buildResearchWorkspaceViewModel(
  operator: OperatorProjectionInput
): ResearchWorkspaceViewModel {
  const history = operator.candidate_arena.latest_ticks.map((tick): ResearchHistoryViewModel => ({
    id: tick.tick_id,
    status: tick.status,
    startedAt: tick.started_at,
    completedAt: tick.completed_at,
    createdCandidateCount: tick.created_candidate_ids.length,
    createdCandidateIds: [...tick.created_candidate_ids],
    directionCount: tick.direction_results.length
  }));

  if (operator.research_operations) {
    const sessions = operator.research_operations.sessions.map((session): ResearchSessionViewModel => ({
      id: session.research_work_item_id,
      allocationId: session.research_allocation_id,
      workerId: session.research_worker_id,
      workerSessionId: session.research_worker_session_id,
      commitmentId: session.commitment_id,
      status: session.status,
      triggerKind: session.trigger.trigger_kind,
      goal: session.trigger.goal,
      triggeredAt: session.trigger.triggered_at,
      direction: session.methodology.direction_kind,
      hypothesis: session.methodology.hypothesis,
      method: session.methodology.method,
      evidenceArtifactCount: session.methodology.evidence_artifact_ids.length,
      provider: session.provider,
      model: session.model,
      completedExperimentCount: session.budget.completed_experiment_count,
      maxExperimentCount: session.budget.max_experiment_count,
      developmentSubmissionCount: session.budget.development_submission_count,
      maxDevelopmentSubmissionCount: session.budget.max_development_submission_count,
      startedAt: session.started_at,
      lastProgressAt: session.last_progress_at,
      completedAt: session.completed_at,
      latestProgressSummary: session.latest_progress_summary,
      admittedCandidateId: session.admitted_candidate_id,
      detailAvailability: "summary_only"
    }));

    return {
      availability: "authoritative",
      loopStatus: operator.research_operations.loop_status,
      capacity: operator.research_operations.capacity,
      sessions,
      latestSessionId: operator.research_operations.latest_session_id,
      history,
      emptyState: sessions.length === 0 ? "available_empty" : "none"
    };
  }

  if (history.length > 0) {
    return {
      availability: "history_only",
      loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
      sessions: [],
      history,
      emptyState: "projection_unavailable"
    };
  }

  return {
    availability: "unavailable",
    loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
    sessions: [],
    history: [],
    emptyState: "projection_unavailable"
  };
}

function paperBoardSystemViewModel(entry: PaperTradingBoardEntryReadModel): ArenaSystemViewModel {
  return {
    id: entry.candidate_id,
    evaluationId: entry.evaluation_id,
    tradingRunId: entry.trading_run_id,
    name: entry.display_name,
    lifecycle: paperBoardLifecycle(entry.runner_status),
    rankStatus: "paper_board_ranked",
    rank: entry.rank,
    comparability: "legacy_paper_board",
    unrankedReasons: [],
    netRevenueUsdt: entry.profit_loss.net_revenue_usdt,
    netReturnPct: entry.profit_loss.net_return_pct,
    revenueUsdt: entry.profit_loss.revenue_usdt,
    costUsdt: entry.profit_loss.cost_usdt,
    observationCount: entry.observation_count,
    failedObservationCount: entry.blocker_density.failed_observation_ratio > 0
      ? Math.round(entry.observation_count * entry.blocker_density.failed_observation_ratio)
      : 0,
    lastObservedAt: entry.last_observed_at,
    nextObservationAt: entry.next_observation_at,
    latestFailure: entry.latest_failure_reason,
    source: "paper_trading_board",
    detailAvailability: "summary_only"
  };
}

function paperBoardLifecycle(status: PaperTradingBoardEntryReadModel["runner_status"]): string {
  if (status === "active") {
    return "running";
  }
  if (status === "needs_resume") {
    return "waiting_resume";
  }
  return "stopped";
}
