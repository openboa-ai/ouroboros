import type {
  AgentProfileProviderKind,
  ArenaOperationsReadModel,
  ArenaTradingSystemDetailReadModel,
  CandidateArenaFindingClusterReadModel,
  CandidateArenaReadModel,
  OperatorReadModel,
  PaperTradingBoardEntryReadModel,
  PaperTradingLearningSummaryReadModel,
  Ref,
  ResearchDirectionKind,
  ResearchGeneralizationReadModel,
  ResearchOperationsReadModel,
  ResearchOperationsLoopStatus,
  ResearchSessionStatus,
  ResearchSessionSummaryReadModel,
  ResearchSessionSummaryWireReadModel,
  ResearchTriggerKind
} from "@ouroboros/domain";
import {
  candidateArenaIdentifierHasRuntimeShape,
  RESEARCH_DIRECTION_KINDS,
  sanitizeResearchEvidenceText
} from "@ouroboros/domain";
import {
  isCanonicalResearchWorkItemIdentity,
  researchSessionStatusBasisBindingsMatch
} from "../research-session-response";

const MAX_RESEARCH_FAILURE_SOURCE_LENGTH = 4_096;
const MAX_RESEARCH_FAILURE_SUMMARY_LENGTH = 256;
const LEGACY_RESEARCH_TEXT_LIMIT = 500;
const LEGACY_RESEARCH_SESSION_LIMIT = 100;
const LEGACY_RESEARCH_EVIDENCE_INPUT_LIMIT = 24;
const LEGACY_RESEARCH_LOOP_STATUSES = [
  "stopped",
  "starting",
  "running",
  "degraded",
  "stopping"
] as const satisfies readonly ResearchOperationsLoopStatus[];
const LEGACY_RESEARCH_SESSION_STATUSES = [
  "queued",
  "allocating",
  "running",
  "awaiting_selection",
  "sealed_admission",
  "admitted",
  "duplicate",
  "quarantined",
  "finished_without_submission",
  "failed_closed",
  "recovering"
] as const satisfies readonly ResearchSessionStatus[];
const LEGACY_RESEARCH_TRIGGER_KINDS = [
  "goal",
  "time",
  "arena_event",
  "live_event",
  "recovery"
] as const satisfies readonly ResearchTriggerKind[];
const LEGACY_RESEARCH_PROVIDERS = [
  "codex",
  "fixture",
  "claude_code"
] as const satisfies readonly AgentProfileProviderKind[];
const RESEARCH_PROJECTION_SESSION_STATUSES = [
  "queued",
  "allocating",
  "running",
  "admitted",
  "duplicate",
  "quarantined",
  "finished_without_submission",
  "failed_closed",
  "recovering"
] as const;
const RESEARCH_PROJECTION_DEGRADED_REASONS = [
  "trigger_unavailable",
  "methodology_unavailable",
  "provider_unavailable",
  "worker_unavailable",
  "evidence_artifact_unavailable",
  "selected_artifact_unavailable",
  "evaluation_graph_conflict",
  "admission_graph_conflict",
  "terminal_admission_unavailable",
  "inactive_incomplete_graph"
] as const;
const RESEARCH_PROJECTION_PROVIDERS = [
  "codex_cli",
  "claude_code",
  "local_process",
  "fixture_only"
] as const;
const RESEARCH_PROJECTION_STATUS_BASES = [
  "candidate_admission_decision",
  "research_worker_checkpoint",
  "candidate_arena_tick",
  "runtime_research_work_item",
  "active_tick_queue",
  "incomplete_persisted_graph"
] as const;

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
  commitmentId?: string;
  status: string;
  projectionHealth:
    | ResearchSessionSummaryReadModel["projection_health"]
    | "legacy_unknown";
  degradedReasons: ResearchSessionSummaryReadModel["degraded_reasons"];
  triggerAvailability: "available" | "unavailable";
  triggerKind: string;
  goal: string;
  triggeredAt: string;
  methodologyAvailability: "available" | "unavailable";
  direction: string;
  hypothesis: string;
  method: string;
  evidenceArtifactCount: number;
  providerAvailability: "available" | "unavailable";
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
  availability: ProjectionAvailability;
  loopStatus: string;
  capacity?: ResearchOperationsReadModel["capacity"];
  sessionWindow?: {
    recordedCount: number;
    projectedCount: number;
    omittedCount: number;
    truncated: boolean;
  };
  sessions: ResearchSessionViewModel[];
  latestSessionId?: string;
  history: ResearchHistoryViewModel[];
  paperLearning?: PaperTradingLearningSummaryReadModel;
  generalization?: ResearchGeneralizationReadModel;
  findingClusters: CandidateArenaFindingClusterReadModel[];
  emptyState: "none" | "available_empty" | "projection_unavailable";
}

interface LegacyResearchTriggerV1 {
  trigger_kind: ResearchTriggerKind;
  trigger_id: string;
  goal: string;
  triggered_at: string;
  source_ref?: Ref;
  evidence_artifact_ref?: Ref & {
    record_kind: "research_evidence_artifact";
  };
  evidence_artifact_digest?: string;
  authority_status: "research_only";
}

interface LegacyResearchMethodologyV1 {
  direction_kind: ResearchDirectionKind;
  hypothesis: string;
  method: string;
  source_candidate_id?: string;
  evidence_artifact_ids: string[];
  authority_status: "research_only";
}

interface LegacyResearchBudgetV1 {
  max_experiment_count: number;
  completed_experiment_count: number;
  max_development_submission_count: number;
  development_submission_count: number;
  remaining_development_submission_count: number;
  authority_status: "research_only";
}

interface LegacyResearchSessionSummaryV1 {
  research_work_item_id: string;
  research_allocation_id: string;
  research_worker_id?: string;
  research_worker_session_id?: string;
  commitment_id?: string;
  status: ResearchSessionStatus;
  trigger: LegacyResearchTriggerV1;
  methodology: LegacyResearchMethodologyV1;
  provider: AgentProfileProviderKind;
  model?: string;
  budget: LegacyResearchBudgetV1;
  started_at?: string;
  last_progress_at?: string;
  completed_at?: string;
  selected_submission_sequence?: number;
  admitted_candidate_id?: string;
  latest_progress_summary: string;
  authority_status: "research_only";
}

interface LegacyResearchOperationsReadModelV1 {
  projection_kind: "research_operations";
  loop_status: ResearchOperationsLoopStatus;
  capacity: ResearchOperationsReadModel["capacity"];
  sessions: LegacyResearchSessionSummaryV1[];
  latest_session_id?: string;
  authority_status: "research_only";
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
          error: researchFailureSummary(result.error),
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

  const researchOperations = operator.research_operations;
  if (availableResearchOperationsReadModel(researchOperations)) {
    const sessions = researchOperations.sessions.map(buildResearchSessionViewModel);

    return {
      availability: "authoritative",
      loopStatus: researchOperations.loop_status,
      capacity: researchOperations.capacity,
      sessionWindow: {
        recordedCount: researchOperations.recorded_session_count,
        projectedCount: researchOperations.projected_session_count,
        omittedCount: researchOperations.omitted_session_count,
        truncated: researchOperations.sessions_truncated
      },
      sessions,
      latestSessionId: researchOperations.latest_session_id,
      history,
      ...context,
      emptyState: sessions.length === 0 ? "available_empty" : "none"
    };
  }

  const legacyOperations = legacyResearchOperationsReadModel(
    researchOperations
  );
  if (legacyOperations) {
    const sessions = legacyOperations.sessions.map(
      buildLegacyResearchSessionViewModel
    );
    return {
      availability: "compatibility",
      loopStatus: legacyOperations.loop_status,
      capacity: legacyOperations.capacity,
      sessions,
      latestSessionId: legacyOperations.latest_session_id,
      history,
      ...context,
      emptyState: sessions.length === 0 ? "projection_unavailable" : "none"
    };
  }

  if (researchOperations) {
    return {
      availability: "unavailable",
      loopStatus: researchOperations.loop_status,
      sessions: [],
      history,
      ...context,
      emptyState: "projection_unavailable"
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

function availableResearchOperationsReadModel(
  value: unknown
): value is ResearchOperationsReadModel & { availability: "available" } {
  if (!record(value) || !hasExactKeys(value, [
    "projection_kind",
    "availability",
    "loop_status",
    "capacity",
    "sessions",
    "recorded_session_count",
    "projected_session_count",
    "omitted_session_count",
    "sessions_truncated",
    ...(Object.hasOwn(value, "latest_session_id")
      ? ["latest_session_id"]
      : []),
    "authority_status"
  ]) || value.projection_kind !== "research_operations" ||
    value.availability !== "available" ||
    !enumValue(value.loop_status, LEGACY_RESEARCH_LOOP_STATUSES) ||
    !researchOperationsCapacity(value.capacity) ||
    !Array.isArray(value.sessions) ||
    value.sessions.length > LEGACY_RESEARCH_SESSION_LIMIT ||
    !value.sessions.every(researchProjectionSessionDiscriminator) ||
    new Set(value.sessions.map((session) =>
      (session as ResearchSessionSummaryWireReadModel).research_work_item_id
    )).size !== value.sessions.length ||
    !nonNegativeSafeInteger(value.recorded_session_count) ||
    !nonNegativeSafeInteger(value.projected_session_count) ||
    !nonNegativeSafeInteger(value.omitted_session_count) ||
    value.projected_session_count !== value.sessions.length ||
    value.recorded_session_count !==
      value.projected_session_count + value.omitted_session_count ||
    typeof value.sessions_truncated !== "boolean" ||
    value.sessions_truncated !== (value.omitted_session_count > 0) ||
    !optionalPresentIdentifier(value, "latest_session_id") ||
    value.authority_status !== "research_only") {
    return false;
  }
  return value.latest_session_id === undefined || value.sessions.some(
    (session) => record(session) &&
      session.research_work_item_id === value.latest_session_id
  );
}

function researchProjectionSessionDiscriminator(value: unknown): boolean {
  if (!record(value) || !researchProjectionSessionHasExactKeys(value) ||
    value.identity_kind !== "derived_projection" ||
    !legacyIdentifier(value.research_allocation_id) ||
    !legacyIdentifier(value.tick_id) ||
    !optionalPresentIdentifier(value, "research_worker_id") ||
    !optionalPresentIdentifier(value, "commitment_id") ||
    !enumValue(value.direction_kind, RESEARCH_DIRECTION_KINDS) ||
    !isCanonicalResearchWorkItemIdentity(
      value.research_work_item_id,
      value.research_allocation_id,
      value.direction_kind
    ) ||
    !enumValue(value.status, RESEARCH_PROJECTION_SESSION_STATUSES) ||
    !researchProjectionStatusBasis(value.status_basis, value.status) ||
    !researchSessionStatusBasisBindingsMatch(value) ||
    !enumValue(value.projection_health, ["complete", "degraded"] as const) ||
    !boundedEnumArray(
      value.degraded_reasons,
      RESEARCH_PROJECTION_DEGRADED_REASONS
    ) || (value.projection_health === "complete") !==
      ((value.degraded_reasons as unknown[]).length === 0) ||
    !legacyResearchBudgetV1(value.budget) ||
    !legacyIso(value.allocated_at) ||
    !optionalPresentIso(value, "started_at") ||
    !legacyIso(value.last_progress_at) ||
    !optionalPresentIso(value, "completed_at") ||
    !optionalPresentPositiveInteger(value, "selected_submission_sequence") ||
    !optionalPresentIdentifier(value, "admitted_candidate_id") ||
    !legacyText(value.latest_progress_summary) ||
    typeof value.latest_progress_summary_truncated !== "boolean" ||
    value.authority_status !== "research_only") return false;
  if (value.selected_submission_sequence !== undefined &&
    Number(value.selected_submission_sequence) >
      (value.budget as LegacyResearchBudgetV1)
        .development_submission_count) return false;
  const allocatedAt = value.allocated_at as string;
  const startedAt = typeof value.started_at === "string"
    ? value.started_at
    : undefined;
  const lastProgressAt = value.last_progress_at as string;
  const completedAt = typeof value.completed_at === "string"
    ? value.completed_at
    : undefined;
  if (startedAt !== undefined && startedAt < allocatedAt ||
    lastProgressAt < (startedAt ?? allocatedAt) ||
    completedAt !== undefined && completedAt < lastProgressAt) return false;
  const reasons = value.degraded_reasons as string[];
  const hasReason = (reason: string): boolean => reasons.includes(reason);
  return (value.trigger_availability === "unavailable") ===
      hasReason("trigger_unavailable") &&
    (value.methodology_availability === "unavailable") ===
      hasReason("methodology_unavailable") &&
    (value.provider_availability === "unavailable") ===
      hasReason("provider_unavailable") &&
    (value.research_worker_id === undefined) ===
      hasReason("worker_unavailable") &&
    ((value.status_basis as Record<string, unknown>).basis_kind !==
      "incomplete_persisted_graph" || hasReason("inactive_incomplete_graph")) &&
    researchProjectionTriggerDiscriminator(value) &&
    researchProjectionMethodologyDiscriminator(value) &&
    researchProjectionProviderDiscriminator(value);
}

function researchProjectionSessionHasExactKeys(
  value: Record<string, unknown>
): boolean {
  const optionalKeys = [
    "research_worker_id",
    "commitment_id",
    "started_at",
    "completed_at",
    "selected_submission_sequence",
    "admitted_candidate_id",
    "model",
    "model_truncated"
  ].filter((key) => Object.hasOwn(value, key));
  return hasExactKeys(value, [
    "identity_kind",
    "research_work_item_id",
    "research_allocation_id",
    "tick_id",
    "direction_kind",
    ...optionalKeys,
    "status",
    "status_basis",
    "projection_health",
    "degraded_reasons",
    "budget",
    "allocated_at",
    "last_progress_at",
    "latest_progress_summary",
    "latest_progress_summary_truncated",
    "trigger_availability",
    "trigger",
    "methodology_availability",
    "methodology",
    "provider_availability",
    "provider",
    "authority_status"
  ]);
}

function researchProjectionStatusBasis(value: unknown, status: unknown): boolean {
  if (!record(value) ||
    !enumValue(value.basis_kind, RESEARCH_PROJECTION_STATUS_BASES) ||
    !enumValue(status, RESEARCH_PROJECTION_SESSION_STATUSES)) return false;
  const hasSource = Object.hasOwn(value, "source_ref");
  if (!hasExactKeys(value, [
    "basis_kind",
    ...(hasSource ? ["source_ref"] : []),
    "authority_status"
  ]) || value.authority_status !== "read_only") return false;
  const sourceMatches = (recordKind: string, required: boolean): boolean =>
    required === hasSource && (!required || legacyRef(
      value.source_ref,
      recordKind
    ));
  if (value.basis_kind === "candidate_admission_decision") {
    return ["admitted", "duplicate", "quarantined"].includes(String(status)) &&
      sourceMatches("candidate_admission_decision", true);
  }
  if (value.basis_kind === "research_worker_checkpoint") {
    return ["finished_without_submission", "failed_closed"].includes(
      String(status)
    ) && sourceMatches("research_worker_checkpoint", true);
  }
  if (value.basis_kind === "candidate_arena_tick") {
    return ["finished_without_submission", "failed_closed"].includes(
      String(status)
    ) && sourceMatches("candidate_arena_tick", true);
  }
  if (value.basis_kind === "runtime_research_work_item") {
    return ["allocating", "running", "failed_closed"].includes(String(status)) &&
      (status === "running"
        ? sourceMatches("research_preflight_commitment", true)
        : sourceMatches("research_preflight_commitment", false));
  }
  if (value.basis_kind === "active_tick_queue") {
    return status === "queued" && sourceMatches(
      "candidate_arena_research_allocation",
      true
    );
  }
  return value.basis_kind === "incomplete_persisted_graph" &&
    ["recovering", "failed_closed"].includes(String(status)) && !hasSource;
}

function researchProjectionTriggerDiscriminator(
  value: Record<string, unknown>
): boolean {
  if (!record(value.trigger)) return false;
  if (value.trigger_availability === "available") {
    const hasSource = Object.hasOwn(value.trigger, "source_ref");
    const hasEvidenceRef = Object.hasOwn(value.trigger, "evidence_artifact_ref");
    const hasEvidenceDigest = Object.hasOwn(
      value.trigger,
      "evidence_artifact_digest"
    );
    const eventRequiresEvidence = value.trigger.trigger_kind === "arena_event" ||
      value.trigger.trigger_kind === "live_event";
    return hasExactKeys(value.trigger, [
      "trigger_kind",
      "trigger_id",
      "goal",
      "goal_truncated",
      "triggered_at",
      ...(hasSource ? ["source_ref"] : []),
      ...(hasEvidenceRef
        ? ["evidence_artifact_ref", "evidence_artifact_digest"]
        : []),
      "authority_status"
    ]) && hasEvidenceRef === hasEvidenceDigest &&
      (!hasEvidenceRef || hasSource) &&
      (!eventRequiresEvidence || hasSource && hasEvidenceRef) &&
      enumValue(value.trigger.trigger_kind, LEGACY_RESEARCH_TRIGGER_KINDS) &&
      legacyIdentifier(value.trigger.trigger_id) && legacyText(value.trigger.goal) &&
      typeof value.trigger.goal_truncated === "boolean" &&
      legacyIso(value.trigger.triggered_at) &&
      legacyIso(value.allocated_at) &&
      value.trigger.triggered_at <= value.allocated_at &&
      (!hasSource || legacyRef(value.trigger.source_ref)) &&
      (!hasEvidenceRef || legacyRef(
        value.trigger.evidence_artifact_ref,
        "research_evidence_artifact"
      ) && legacyDigest(value.trigger.evidence_artifact_digest)) &&
      value.trigger.authority_status === "research_only";
  }
  return value.trigger_availability === "unavailable" && hasExactKeys(
    value.trigger,
    [
      "compatibility_kind",
      "trigger_kind",
      "trigger_id",
      "goal",
      "goal_truncated",
      "triggered_at",
      "authority_status"
    ]
  ) &&
    value.trigger.compatibility_kind === "research_summary_v1_unavailable" &&
    value.trigger.trigger_kind === "unavailable" &&
    value.trigger.trigger_id === "unavailable" &&
    value.trigger.goal === "Research trigger unavailable." &&
    value.trigger.goal_truncated === false && value.trigger.triggered_at === "" &&
    value.trigger.authority_status === "research_only";
}

function researchProjectionMethodologyDiscriminator(
  value: Record<string, unknown>
): boolean {
  if (!record(value.methodology)) return false;
  if (value.methodology_availability === "available") {
    const hasSourceCandidate = Object.hasOwn(
      value.methodology,
      "source_candidate_id"
    );
    return hasExactKeys(value.methodology, [
      "direction_kind",
      "hypothesis",
      "hypothesis_truncated",
      "method",
      "method_truncated",
      ...(hasSourceCandidate ? ["source_candidate_id"] : []),
      "evidence_artifact_ids",
      "authority_status"
    ]) && value.methodology.direction_kind === value.direction_kind &&
      legacyText(value.methodology.hypothesis) &&
      typeof value.methodology.hypothesis_truncated === "boolean" &&
      legacyText(value.methodology.method) &&
      typeof value.methodology.method_truncated === "boolean" &&
      (!hasSourceCandidate || legacyIdentifier(
        value.methodology.source_candidate_id
      )) &&
      boundedUniqueLegacyIdentifiers(
        value.methodology.evidence_artifact_ids,
        LEGACY_RESEARCH_EVIDENCE_INPUT_LIMIT
      ) && value.methodology.authority_status === "research_only";
  }
  return value.methodology_availability === "unavailable" && hasExactKeys(
    value.methodology,
    [
      "compatibility_kind",
      "direction_kind",
      "hypothesis",
      "hypothesis_truncated",
      "method",
      "method_truncated",
      "evidence_artifact_ids",
      "authority_status"
    ]
  ) &&
    value.methodology.compatibility_kind ===
      "research_summary_v1_unavailable" &&
    value.methodology.direction_kind === value.direction_kind &&
    value.methodology.hypothesis === "Research methodology unavailable." &&
    value.methodology.hypothesis_truncated === false &&
    value.methodology.method === "Research methodology unavailable." &&
    value.methodology.method_truncated === false &&
    Array.isArray(value.methodology.evidence_artifact_ids) &&
    value.methodology.evidence_artifact_ids.length === 0 &&
    value.methodology.authority_status === "research_only";
}

function researchProjectionProviderDiscriminator(
  value: Record<string, unknown>
): boolean {
  if (value.provider_availability === "unavailable") {
    return value.provider === "unavailable" &&
      !Object.hasOwn(value, "model") &&
      !Object.hasOwn(value, "model_truncated");
  }
  if (value.provider_availability !== "available" ||
    !enumValue(value.provider, RESEARCH_PROJECTION_PROVIDERS)) return false;
  const hasModel = Object.hasOwn(value, "model");
  const hasModelTruncated = Object.hasOwn(value, "model_truncated");
  return hasModel === hasModelTruncated && (!hasModel ||
    legacyText(value.model) && typeof value.model_truncated === "boolean");
}

function legacyResearchOperationsReadModel(
  value: unknown
): LegacyResearchOperationsReadModelV1 | undefined {
  if (!record(value) || !hasExactKeys(value, [
    "projection_kind",
    "loop_status",
    "capacity",
    "sessions",
    ...(Object.hasOwn(value, "latest_session_id")
      ? ["latest_session_id"]
      : []),
    "authority_status"
  ]) || value.projection_kind !== "research_operations" ||
    !enumValue(value.loop_status, LEGACY_RESEARCH_LOOP_STATUSES) ||
    !researchOperationsCapacity(value.capacity) ||
    !Array.isArray(value.sessions) ||
    value.sessions.length > LEGACY_RESEARCH_SESSION_LIMIT ||
    !value.sessions.every(legacyResearchSessionSummaryV1) ||
    new Set(value.sessions.map((session) =>
      (session as LegacyResearchSessionSummaryV1).research_work_item_id
    )).size !== value.sessions.length ||
    !optionalPresentIdentifier(value, "latest_session_id") ||
    value.authority_status !== "research_only") {
    return undefined;
  }
  if (value.latest_session_id !== undefined && !value.sessions.some((session) =>
    (session as LegacyResearchSessionSummaryV1).research_work_item_id ===
      value.latest_session_id
  )) return undefined;
  return value as unknown as LegacyResearchOperationsReadModelV1;
}

function legacyResearchSessionSummaryV1(
  value: unknown
): value is LegacyResearchSessionSummaryV1 {
  if (!record(value) || !hasExactKeys(value, [
    "research_work_item_id",
    "research_allocation_id",
    ...[
      "research_worker_id",
      "research_worker_session_id",
      "commitment_id"
    ].filter((key) => Object.hasOwn(value, key)),
    "status",
    "trigger",
    "methodology",
    "provider",
    ...(Object.hasOwn(value, "model") ? ["model"] : []),
    "budget",
    ...[
      "started_at",
      "last_progress_at",
      "completed_at",
      "selected_submission_sequence",
      "admitted_candidate_id"
    ].filter((key) => Object.hasOwn(value, key)),
    "latest_progress_summary",
    "authority_status"
  ]) || !legacyIdentifier(value.research_work_item_id) ||
    !legacyIdentifier(value.research_allocation_id) ||
    !optionalPresentIdentifier(value, "research_worker_id") ||
    !optionalPresentIdentifier(value, "research_worker_session_id") ||
    !optionalPresentIdentifier(value, "commitment_id") ||
    !enumValue(value.status, LEGACY_RESEARCH_SESSION_STATUSES) ||
    !legacyResearchTriggerV1(value.trigger) ||
    !legacyResearchMethodologyV1(value.methodology) ||
    !enumValue(value.provider, LEGACY_RESEARCH_PROVIDERS) ||
    !optionalPresentText(value, "model") ||
    !legacyResearchBudgetV1(value.budget) ||
    !optionalPresentIso(value, "started_at") ||
    !optionalPresentIso(value, "last_progress_at") ||
    !optionalPresentIso(value, "completed_at") ||
    !optionalPresentPositiveInteger(value, "selected_submission_sequence") ||
    !optionalPresentIdentifier(value, "admitted_candidate_id") ||
    !legacyText(value.latest_progress_summary) ||
    value.authority_status !== "research_only") return false;
  if (value.selected_submission_sequence !== undefined &&
    Number(value.selected_submission_sequence) >
      (value.budget as LegacyResearchBudgetV1)
        .development_submission_count) return false;
  const timestamps = [
    (value.trigger as LegacyResearchTriggerV1).triggered_at,
    value.started_at,
    value.last_progress_at,
    value.completed_at
  ].filter((timestamp): timestamp is string => typeof timestamp === "string");
  return timestamps.every((timestamp, index) =>
    index === 0 || timestamp >= timestamps[index - 1]!
  );
}

function legacyResearchTriggerV1(value: unknown): value is LegacyResearchTriggerV1 {
  if (!record(value)) return false;
  const hasSource = Object.hasOwn(value, "source_ref");
  const hasEvidenceRef = Object.hasOwn(value, "evidence_artifact_ref");
  const hasEvidenceDigest = Object.hasOwn(value, "evidence_artifact_digest");
  return hasExactKeys(value, [
    "trigger_kind",
    "trigger_id",
    "goal",
    "triggered_at",
    ...(hasSource ? ["source_ref"] : []),
    ...(hasEvidenceRef ? ["evidence_artifact_ref"] : []),
    ...(hasEvidenceDigest ? ["evidence_artifact_digest"] : []),
    "authority_status"
  ]) && enumValue(value.trigger_kind, LEGACY_RESEARCH_TRIGGER_KINDS) &&
    legacyIdentifier(value.trigger_id) && legacyText(value.goal) &&
    legacyIso(value.triggered_at) &&
    (!hasSource || legacyRef(value.source_ref)) &&
    hasEvidenceRef === hasEvidenceDigest &&
    (!hasEvidenceRef || hasSource && legacyRef(
      value.evidence_artifact_ref,
      "research_evidence_artifact"
    ) && legacyDigest(value.evidence_artifact_digest)) &&
    value.authority_status === "research_only";
}

function legacyResearchMethodologyV1(
  value: unknown
): value is LegacyResearchMethodologyV1 {
  if (!record(value)) return false;
  const hasSourceCandidate = Object.hasOwn(value, "source_candidate_id");
  return hasExactKeys(value, [
    "direction_kind",
    "hypothesis",
    "method",
    ...(hasSourceCandidate ? ["source_candidate_id"] : []),
    "evidence_artifact_ids",
    "authority_status"
  ]) && enumValue(value.direction_kind, RESEARCH_DIRECTION_KINDS) &&
    legacyText(value.hypothesis) && legacyText(value.method) &&
    (!hasSourceCandidate || legacyIdentifier(value.source_candidate_id)) &&
    boundedUniqueLegacyIdentifiers(
      value.evidence_artifact_ids,
      LEGACY_RESEARCH_EVIDENCE_INPUT_LIMIT
    ) && value.authority_status === "research_only";
}

function legacyResearchBudgetV1(value: unknown): value is LegacyResearchBudgetV1 {
  return record(value) && hasExactKeys(value, [
    "max_experiment_count",
    "completed_experiment_count",
    "max_development_submission_count",
    "development_submission_count",
    "remaining_development_submission_count",
    "authority_status"
  ]) && positiveSafeInteger(value.max_experiment_count) &&
    nonNegativeSafeInteger(value.completed_experiment_count) &&
    value.completed_experiment_count <= value.max_experiment_count &&
    positiveSafeInteger(value.max_development_submission_count) &&
    nonNegativeSafeInteger(value.development_submission_count) &&
    value.development_submission_count <= value.max_development_submission_count &&
    nonNegativeSafeInteger(value.remaining_development_submission_count) &&
    value.remaining_development_submission_count ===
      value.max_development_submission_count - value.development_submission_count &&
    value.authority_status === "research_only";
}

function researchOperationsCapacity(value: unknown): value is ResearchOperationsReadModel["capacity"] {
  return record(value) && hasExactKeys(value, [
    "max_concurrent_sessions",
    "active_session_count",
    "queued_session_count"
  ]) && positiveSafeInteger(value.max_concurrent_sessions) &&
    nonNegativeSafeInteger(value.active_session_count) &&
    value.active_session_count <= value.max_concurrent_sessions &&
    nonNegativeSafeInteger(value.queued_session_count);
}

function buildLegacyResearchSessionViewModel(
  session: LegacyResearchSessionSummaryV1
): ResearchSessionViewModel {
  return {
    id: session.research_work_item_id,
    allocationId: session.research_allocation_id,
    workerId: session.research_worker_id,
    commitmentId: session.commitment_id,
    status: session.status,
    projectionHealth: "legacy_unknown",
    degradedReasons: [],
    triggerAvailability: "available",
    triggerKind: session.trigger.trigger_kind,
    goal: session.trigger.goal,
    triggeredAt: session.trigger.triggered_at,
    methodologyAvailability: "available",
    direction: session.methodology.direction_kind,
    hypothesis: session.methodology.hypothesis,
    method: session.methodology.method,
    evidenceArtifactCount: session.methodology.evidence_artifact_ids.length,
    providerAvailability: "available",
    provider: session.provider,
    model: session.model,
    completedExperimentCount: session.budget.completed_experiment_count,
    maxExperimentCount: session.budget.max_experiment_count,
    developmentSubmissionCount: session.budget.development_submission_count,
    maxDevelopmentSubmissionCount:
      session.budget.max_development_submission_count,
    startedAt: session.started_at,
    lastProgressAt: session.last_progress_at,
    completedAt: session.completed_at,
    latestProgressSummary: session.latest_progress_summary,
    admittedCandidateId: session.admitted_candidate_id,
    detailAvailability: "summary_only"
  };
}

export function buildResearchSessionViewModel(
  session: ResearchSessionSummaryReadModel | ResearchSessionSummaryWireReadModel
): ResearchSessionViewModel {
  return {
    id: session.research_work_item_id,
    allocationId: session.research_allocation_id,
    workerId: session.research_worker_id,
    commitmentId: session.commitment_id,
    status: session.status,
    projectionHealth: session.projection_health,
    degradedReasons: [...session.degraded_reasons],
    triggerAvailability: session.trigger_availability,
    ...(session.trigger_availability === "available"
      ? {
          triggerKind: session.trigger.trigger_kind,
          goal: session.trigger.goal,
          triggeredAt: session.trigger.triggered_at
        }
      : { triggerKind: "", goal: "", triggeredAt: "" }),
    methodologyAvailability: session.methodology_availability,
    direction: session.direction_kind,
    ...(session.methodology_availability === "available"
      ? {
          hypothesis: session.methodology.hypothesis,
          method: session.methodology.method,
          evidenceArtifactCount: session.methodology.evidence_artifact_ids.length
        }
      : { hypothesis: "", method: "", evidenceArtifactCount: 0 }),
    providerAvailability: session.provider_availability,
    ...(session.provider_availability === "available"
      ? { provider: session.provider, model: session.model }
      : { provider: "" }),
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
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, expected: string[]): boolean {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  return actual.length === canonicalExpected.length && actual.every(
    (key, index) => key === canonicalExpected[index]
  );
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function boundedEnumArray<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T[] {
  return Array.isArray(value) && value.length <= allowed.length &&
    value.every((entry) => enumValue(entry, allowed)) &&
    new Set(value).size === value.length;
}

function legacyIdentifier(value: unknown): value is string {
  return candidateArenaIdentifierHasRuntimeShape(value);
}

function optionalPresentIdentifier(value: Record<string, unknown>, key: string): boolean {
  return !Object.hasOwn(value, key) || legacyIdentifier(value[key]);
}

function legacyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 &&
    value.length <= LEGACY_RESEARCH_TEXT_LIMIT &&
    sanitizeResearchEvidenceText(value) === value;
}

function optionalPresentText(value: Record<string, unknown>, key: string): boolean {
  return !Object.hasOwn(value, key) || legacyText(value[key]);
}

function legacyIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function optionalPresentIso(value: Record<string, unknown>, key: string): boolean {
  return !Object.hasOwn(value, key) || legacyIso(value[key]);
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function optionalPresentPositiveInteger(
  value: Record<string, unknown>,
  key: string
): boolean {
  return !Object.hasOwn(value, key) || positiveSafeInteger(value[key]);
}

function boundedUniqueLegacyIdentifiers(value: unknown, limit: number): value is string[] {
  return Array.isArray(value) && value.length <= limit &&
    value.every(legacyIdentifier) && new Set(value).size === value.length;
}

function legacyRef(value: unknown, recordKind?: string): value is Ref {
  return record(value) && hasExactKeys(value, ["record_kind", "id"]) &&
    legacyIdentifier(value.record_kind) && legacyIdentifier(value.id) &&
    (recordKind === undefined || value.record_kind === recordKind);
}

function legacyDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function researchFailureSummary(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  const sanitized = sanitizeResearchEvidenceText(
    firstLine.slice(0, MAX_RESEARCH_FAILURE_SOURCE_LENGTH)
  ).trim();
  return sanitized
    ? sanitized.slice(0, MAX_RESEARCH_FAILURE_SUMMARY_LENGTH)
    : "candidate_arena_research_failed";
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
