import type {
  ArenaOperationsReadModel,
  ArenaTradingSystemDetailReadModel,
  CandidateArenaFindingClusterReadModel,
  CandidateArenaReadModel,
  OperatorReadModel,
  PaperTradingBoardEntryReadModel,
  PaperTradingLearningSummaryReadModel,
  ResearchGeneralizationReadModel,
  ResearchOperationsReadModel
} from "@ouroboros/domain";

export type OperatorProjectionInput = Pick<
  OperatorReadModel,
  "arena_operations" | "research_operations" | "paper_trading_board" | "candidate_arena"
> & Partial<Pick<OperatorReadModel, "trading_review">>;

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
  runnerStatus?: string;
  sandboxStatus?: string;
  latestDecision?: string;
  latestFill?: string;
  rankStatus: string;
  rank?: number;
  comparability: string;
  unrankedReasons: string[];
  qualificationStatus?: PaperTradingBoardEntryReadModel["qualification_status"] | "unavailable";
  qualificationReasons: PaperTradingBoardEntryReadModel["qualification_reasons"];
  evidenceWindow?: PaperTradingBoardEntryReadModel["evidence_window"];
  trend?: PaperTradingBoardEntryReadModel["trend"];
  blockerDensity?: PaperTradingBoardEntryReadModel["blocker_density"];
  marketDataSource?: PaperTradingBoardEntryReadModel["market_data_source"];
  latestPublicExecutionSource?: PaperTradingBoardEntryReadModel["latest_public_execution_source"];
  latestFillStatus?: PaperTradingBoardEntryReadModel["latest_fill_status"];
  openOrderCount?: PaperTradingBoardEntryReadModel["open_order_count"];
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
  detailAvailability: "available" | "summary_only";
}

export interface ArenaSystemDetailViewModel {
  id: string;
  admissionDecisionId: string;
  handoffConformanceId: string;
  isolation: {
    isolationId?: string;
    sandboxStatus: string;
    workspaceIdentity?: string;
    networkPolicyStatus: string;
    egressAttestationStatus: string;
  };
  manifest: {
    summary: string;
    declaredRuntime?: string;
    declaredOutputs: string[];
    allowedStages: string[];
    declaredPermissions: string[];
    forbiddenContents: string[];
  };
  lineage?: ArenaTradingSystemDetailReadModel["lineage"];
  latestMarketSnapshot?: ArenaTradingSystemDetailReadModel["latest_market_snapshot"];
  latestDecision?: ArenaTradingSystemDetailReadModel["latest_decision"];
  paperAccountSnapshot?: ArenaTradingSystemDetailReadModel["paper_account_snapshot"];
  openOrders: ArenaTradingSystemDetailReadModel["open_orders"];
  latestFill?: ArenaTradingSystemDetailReadModel["latest_fill"];
  traceEvents: Array<{
    sequence: number;
    occurredAt: string;
    eventKind: string;
    summary: string;
    recordRef?: ArenaTradingSystemDetailReadModel["trace_events"][number]["record_ref"];
  }>;
  logEntries: Array<{
    sequence: number;
    occurredAt: string;
    level: string;
    source: string;
    message: string;
  }>;
  artifactRefs: ArenaTradingSystemDetailReadModel["artifact_refs"];
  traceTruncated: boolean;
  logsTruncated: boolean;
}

export interface ArenaWorkspaceViewModel {
  availability: Exclude<ProjectionAvailability, "history_only">;
  loopStatus: string;
  capacity?: ArenaOperationsReadModel["capacity"];
  systems: ArenaSystemViewModel[];
  latestSystemId?: string;
  emptyState: "none" | "available_empty" | "projection_unavailable";
}

export function isComparableArenaRevenueSystem(
  system: ArenaSystemViewModel
): system is ArenaSystemViewModel & { netRevenueUsdt: number } {
  if (system.netRevenueUsdt === undefined || system.rank === undefined) {
    return false;
  }

  if (system.source === "paper_trading_board") {
    return system.rankStatus === "paper_board_ranked" &&
      system.comparability === "legacy_paper_board";
  }

  return (system.rankStatus === "provisional_ranked" || system.rankStatus === "ranked") &&
    system.comparability === "comparable";
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
  failedDirectionCount: number;
  sourceCandidate?: {
    sourceKind: string;
    candidateId: string;
    displayName: string;
    netRevenueUsdt?: number;
  };
  directions: Array<{
    direction: string;
    status: string;
    candidateId?: string;
    finding?: string;
    error?: string;
    researchEfficiency?: {
      providerRequestTotal: number;
      runnerCommandTotal: number;
      scenarioCount: number;
      elapsedMs: number;
      authorityStatus: string;
    };
  }>;
}

export interface ResearchWorkspaceViewModel {
  availability: Exclude<ProjectionAvailability, "compatibility">;
  loopStatus: string;
  capacity?: ResearchOperationsReadModel["capacity"];
  sessions: ResearchSessionViewModel[];
  latestSessionId?: string;
  history: ResearchHistoryViewModel[];
  paperLearning?: PaperTradingLearningSummaryReadModel;
  generalization?: ResearchGeneralizationReadModel;
  findingClusters: CandidateArenaFindingClusterReadModel[];
  emptyState: "none" | "available_empty" | "projection_unavailable";
}

export function buildArenaWorkspaceViewModel(
  operator: OperatorProjectionInput
): ArenaWorkspaceViewModel {
  if (operator.arena_operations) {
    const paperBoardGates = new Map(operator.paper_trading_board.entries.map((entry) => [
      paperBoardGateKey(entry.candidate_id, entry.evaluation_id),
      entry
    ]));
    const systems = operator.arena_operations.systems.map((system): ArenaSystemViewModel => {
      const paperBoardGate = system.evaluation_id
        ? paperBoardGates.get(paperBoardGateKey(system.candidate_id, system.evaluation_id))
        : undefined;
      return {
        id: system.candidate_id,
        versionId: system.candidate_version_id,
        evaluationId: system.evaluation_id,
        tradingRunId: system.trading_run_id,
        name: system.display_name,
        direction: system.direction_kind,
        lifecycle: system.session_status,
        runnerStatus: system.runner_status,
        sandboxStatus: system.sandbox_status,
        latestDecision: system.latest_decision?.decision_kind,
        latestFill: system.latest_fill?.fill_status,
        rankStatus: system.rank_status,
        rank: system.rank_status === "unranked" ? undefined : system.rank,
        comparability: system.comparability_status,
        unrankedReasons: [...system.unranked_reasons],
        qualificationStatus: paperBoardGate?.qualification_status ?? "unavailable",
        qualificationReasons: paperBoardGate ? [...paperBoardGate.qualification_reasons] : [],
        ...(paperBoardGate ? paperBoardQualityViewModel(paperBoardGate) : {}),
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
        detailAvailability: "available"
      };
    });

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

export function buildArenaSystemDetailViewModel(
  detail: ArenaTradingSystemDetailReadModel
): ArenaSystemDetailViewModel {
  return {
    id: detail.candidate_id,
    admissionDecisionId: detail.candidate_admission_decision_ref.id,
    handoffConformanceId: detail.paper_trading_handoff_conformance_ref.id,
    isolation: {
      isolationId: detail.isolation.isolation_id,
      sandboxStatus: detail.isolation.sandbox_status,
      workspaceIdentity: detail.isolation.workspace_identity,
      networkPolicyStatus: detail.isolation.network_policy_status,
      egressAttestationStatus: detail.isolation.egress_attestation_status
    },
    manifest: {
      summary: detail.trading_system_manifest.summary,
      declaredRuntime: detail.trading_system_manifest.declared_runtime,
      declaredOutputs: [...detail.trading_system_manifest.declared_outputs],
      allowedStages: [...detail.trading_system_manifest.allowed_stages],
      declaredPermissions: [...detail.trading_system_manifest.declared_permissions],
      forbiddenContents: [...detail.trading_system_manifest.forbidden_contents]
    },
    lineage: detail.lineage ? structuredClone(detail.lineage) : undefined,
    latestMarketSnapshot: detail.latest_market_snapshot
      ? structuredClone(detail.latest_market_snapshot)
      : undefined,
    latestDecision: detail.latest_decision
      ? structuredClone(detail.latest_decision)
      : undefined,
    paperAccountSnapshot: detail.paper_account_snapshot
      ? structuredClone(detail.paper_account_snapshot)
      : undefined,
    openOrders: structuredClone(detail.open_orders),
    latestFill: detail.latest_fill ? structuredClone(detail.latest_fill) : undefined,
    traceEvents: detail.trace_events.map((event) => ({
      sequence: event.sequence,
      occurredAt: event.occurred_at,
      eventKind: event.event_kind,
      summary: event.summary,
      recordRef: event.record_ref ? { ...event.record_ref } : undefined
    })),
    logEntries: detail.log_entries.map((entry) => ({
      sequence: entry.sequence,
      occurredAt: entry.occurred_at,
      level: entry.level,
      source: entry.source,
      message: entry.message
    })),
    artifactRefs: detail.artifact_refs.map((ref) => ({ ...ref })),
    traceTruncated: detail.trace_truncated,
    logsTruncated: detail.logs_truncated
  };
}

export function buildResearchWorkspaceViewModel(
  operator: OperatorProjectionInput
): ResearchWorkspaceViewModel {
  const paperLearning = operator.trading_review?.review_packet.lineage.paper_board_learning;
  const context = {
    paperLearning: paperLearning
      ? { ...paperLearning, qualification_reasons: [...paperLearning.qualification_reasons] }
      : undefined,
    generalization: operator.candidate_arena.research_generalization,
    findingClusters: (operator.candidate_arena.finding_clusters ?? []).map((cluster) => ({
      ...cluster,
      candidate_ids: [...cluster.candidate_ids]
    }))
  };
  const history = operator.candidate_arena.latest_ticks.map((tick): ResearchHistoryViewModel => {
    const source = tick.source_candidate;
    return {
      id: tick.tick_id,
      status: tick.status,
      startedAt: tick.started_at,
      completedAt: tick.completed_at,
      createdCandidateCount: tick.created_candidate_ids.length,
      createdCandidateIds: [...tick.created_candidate_ids],
      directionCount: tick.direction_results.length,
      failedDirectionCount: tick.direction_results.filter((result) => result.status === "failed").length,
      sourceCandidate: source ? {
        sourceKind: source.source_kind,
        candidateId: source.candidate_id,
        displayName: source.display_name,
        netRevenueUsdt: source.net_revenue_usdt
      } : undefined,
      directions: tick.direction_results.map((result) => {
        const efficiency = result.research_efficiency;
        return {
          direction: result.direction_kind,
          status: result.status,
          candidateId: result.candidate_id,
          finding: result.finding,
          error: result.error,
          researchEfficiency: efficiency ? {
            providerRequestTotal: efficiency.provider_request_total,
            runnerCommandTotal: efficiency.runner_command_total,
            scenarioCount: efficiency.scenario_count,
            elapsedMs: efficiency.elapsed_ms,
            authorityStatus: efficiency.authority_status
          } : undefined
        };
      })
    };
  });

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
      ...context,
      emptyState: sessions.length === 0 ? "available_empty" : "none"
    };
  }

  if (history.length > 0) {
    return {
      availability: "history_only",
      loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
      sessions: [],
      history,
      ...context,
      emptyState: "projection_unavailable"
    };
  }

  return {
    availability: "unavailable",
    loopStatus: operator.candidate_arena.runner_status ?? "unavailable",
    sessions: [],
    history: [],
    ...context,
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
    runnerStatus: entry.runner_status,
    latestFill: entry.latest_fill_status,
    rankStatus: "paper_board_ranked",
    rank: entry.rank,
    comparability: "legacy_paper_board",
    unrankedReasons: [],
    qualificationStatus: entry.qualification_status ?? "unavailable",
    qualificationReasons: [...entry.qualification_reasons],
    ...paperBoardQualityViewModel(entry),
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

function paperBoardQualityViewModel(entry: PaperTradingBoardEntryReadModel) {
  return {
    evidenceWindow: { ...entry.evidence_window },
    trend: { ...entry.trend },
    blockerDensity: { ...entry.blocker_density },
    marketDataSource: entry.market_data_source,
    latestPublicExecutionSource: entry.latest_public_execution_source,
    latestFillStatus: entry.latest_fill_status,
    openOrderCount: entry.open_order_count
  };
}

function paperBoardGateKey(candidateId: string, evaluationId: string): string {
  return `${candidateId}\u0000${evaluationId}`;
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
