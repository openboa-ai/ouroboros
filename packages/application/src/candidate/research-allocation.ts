import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationDigestInput,
  candidateArenaResearchAllocationHasRuntimeShape,
  type CandidateArenaFindingClusterReadModel,
  type CandidateArenaResearchAllocationMode,
  type CandidateArenaResearchAllocationReadModel,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaResearchAllocationSelection,
  type CandidateArenaResearchAllocationSignal,
  type CandidateArenaResearchEfficiencyReadModel,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickReadModel,
  type PaperTradingFailureKind,
  type ResearchDirectionKind
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";

export const DEFAULT_ARENA_DIRECTIONS: ResearchDirectionKind[] = [
  "trend_following",
  "mean_reversion",
  "volatility_regime",
  "funding_aware_risk",
  "execution_cost_robustness"
];

const RESEARCH_DIRECTIONS = new Set<ResearchDirectionKind>([
  ...DEFAULT_ARENA_DIRECTIONS,
  "liquidation_aware_risk",
  "other"
]);

export interface CandidateArenaAdaptiveDirectionFocus {
  direction_kind: ResearchDirectionKind;
  source_direction_kind?: ResearchDirectionKind;
  focus_score: number;
  focus_reason: string;
  next_research_focus: string;
  authority_status: "not_promotion_authority";
}

export interface DecideCandidateArenaResearchAllocationInput {
  tickId: string;
  allocatedAt: string;
  allocationMode: CandidateArenaResearchAllocationMode;
  explicitDirections?: ResearchDirectionKind[];
  findingClusters: CandidateArenaFindingClusterReadModel[];
  latestTicks: CandidateArenaTickReadModel[];
  priorAllocations: CandidateArenaResearchAllocationRecord[];
  completedTickIds: string[];
}

export class CandidateArenaResearchAllocationDecisionError extends Error {
  readonly code = "invalid_candidate_arena_research_allocation_decision_input";

  constructor() {
    super("CandidateArena research allocation decision input is invalid.");
    this.name = "CandidateArenaResearchAllocationDecisionError";
  }
}

export type CandidateArenaResearchAllocationServiceErrorCode =
  | "candidate_arena_research_allocation_request_conflict"
  | "candidate_arena_research_allocation_persistence_conflict";

export class CandidateArenaResearchAllocationServiceError extends Error {
  constructor(
    readonly code: CandidateArenaResearchAllocationServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CandidateArenaResearchAllocationServiceError";
  }
}

export class CandidateArenaResearchAllocationService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async allocate(input: {
    tickId: string;
    allocationMode: CandidateArenaResearchAllocationMode;
    explicitDirections?: ResearchDirectionKind[];
    findingClusters: CandidateArenaFindingClusterReadModel[];
    latestTicks: CandidateArenaTickReadModel[];
  }): Promise<CandidateArenaResearchAllocationRecord> {
    const tickId = canonicalId(input?.tickId);
    const allocationId = `candidate-arena-research-allocation-${safeId(tickId)}`;
    const existing = await this.options.store
      .getCandidateArenaResearchAllocation(allocationId);
    if (existing) {
      if (!allocationRequestMatches(existing, input)) {
        throw new CandidateArenaResearchAllocationServiceError(
          "candidate_arena_research_allocation_request_conflict",
          "CandidateArena research allocation request conflicts with frozen intent."
        );
      }
      return existing;
    }

    const [priorAllocations, completedTicks] = await Promise.all([
      this.options.store.listCandidateArenaResearchAllocations(),
      this.options.store.listCandidateArenaTicks()
    ]);
    const allocation = decideCandidateArenaResearchAllocation({
      tickId,
      allocatedAt: this.now(),
      allocationMode: input.allocationMode,
      explicitDirections: input.explicitDirections,
      findingClusters: input.findingClusters,
      latestTicks: input.latestTicks,
      priorAllocations,
      completedTickIds: completedTicks.map((tick) => tick.tick_id)
    });
    const recorded = await this.options.store
      .recordCandidateArenaResearchAllocation(allocation);
    if (!candidateArenaResearchAllocationHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, allocation)) {
      throw new CandidateArenaResearchAllocationServiceError(
        "candidate_arena_research_allocation_persistence_conflict",
        "Store did not preserve exact CandidateArena research allocation intent."
      );
    }
    return recorded;
  }
}

export function toCandidateArenaResearchAllocationReadModel(
  allocation: CandidateArenaResearchAllocationRecord
): CandidateArenaResearchAllocationReadModel {
  return {
    allocation_id: allocation.candidate_arena_research_allocation_id,
    tick_id: allocation.tick_id,
    allocation_mode: allocation.allocation_mode,
    policy: { ...allocation.policy },
    selected_directions: allocation.selected_directions.map((selection) => ({
      ...selection,
      reasons: [...selection.reasons]
    })),
    deferred_directions: [...allocation.deferred_directions],
    allocated_at: allocation.allocated_at,
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

export function decideCandidateArenaResearchAllocation(
  input: DecideCandidateArenaResearchAllocationInput
): CandidateArenaResearchAllocationRecord {
  const tickId = canonicalId(input?.tickId);
  const allocatedAt = canonicalTime(input?.allocatedAt);
  const allocationMode = allocationModeValue(input?.allocationMode);
  if (!Array.isArray(input.findingClusters) ||
    !Array.isArray(input.latestTicks) ||
    !Array.isArray(input.priorAllocations) ||
    input.priorAllocations.some((allocation) =>
      !candidateArenaResearchAllocationHasRuntimeShape(allocation)
    ) || !stringArray(input.completedTickIds)) {
    throw invalidDecision();
  }

  const explicitDirections = allocationMode === "explicit"
    ? canonicalExplicitDirections(input.explicitDirections)
    : undefined;
  if (allocationMode !== "explicit" && input.explicitDirections !== undefined) {
    throw invalidDecision();
  }

  const signalSnapshot = allocationMode === "explicit"
    ? []
    : allocationSignals({
        findingClusters: input.findingClusters,
        latestTicks: input.latestTicks,
        priorAllocations: input.priorAllocations,
        completedTickIds: input.completedTickIds
      });
  const selectedDirections = allocationMode === "explicit"
    ? explicitSelections(explicitDirections!)
    : allocationMode === "static_control"
      ? staticSelections()
      : adaptiveSelections(signalSnapshot, input.priorAllocations);
  const selectedDirectionKinds = selectedDirections.map(
    (selection) => selection.direction_kind
  );
  const deferredDirections = DEFAULT_ARENA_DIRECTIONS.filter(
    (direction) => !selectedDirectionKinds.includes(direction)
  );
  const sourceTickRefs = allocationMode === "explicit"
    ? []
    : uniqueStrings(input.latestTicks.map((tick) => tick.tick_id)).map(
        (sourceTickId) => ({
          record_kind: "candidate_arena_tick",
          id: `candidate-arena-tick-${safeId(sourceTickId)}`
        })
      );

  const allocation: CandidateArenaResearchAllocationRecord = {
    record_kind: "candidate_arena_research_allocation",
    version: 1,
    candidate_arena_research_allocation_id:
      `candidate-arena-research-allocation-${safeId(tickId)}`,
    tick_id: tickId,
    allocation_mode: allocationMode,
    policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
    source_tick_refs: sourceTickRefs,
    signal_snapshot: signalSnapshot,
    selected_directions: selectedDirections,
    deferred_directions: deferredDirections,
    allocated_at: allocatedAt,
    allocation_digest: "pending",
    research_scheduling_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  allocation.allocation_digest = canonicalDigest(
    candidateArenaResearchAllocationDigestInput(allocation)
  );
  if (!candidateArenaResearchAllocationHasRuntimeShape(allocation)) {
    throw invalidDecision();
  }
  return allocation;
}

export function candidateArenaAdaptiveDirectionFocus(
  findingClusters: CandidateArenaFindingClusterReadModel[]
): CandidateArenaAdaptiveDirectionFocus[] {
  const focusByDirection = new Map<
    ResearchDirectionKind,
    CandidateArenaAdaptiveDirectionFocus
  >();

  for (const cluster of findingClusters) {
    const direction = adaptiveDirectionForCluster(cluster);
    const focus = adaptiveDirectionFocusFromCluster(direction, cluster);
    const existing = focusByDirection.get(direction);
    if (!existing) {
      focusByDirection.set(direction, focus);
      continue;
    }
    focusByDirection.set(direction, {
      ...existing,
      focus_score: existing.focus_score + focus.focus_score,
      focus_reason: [existing.focus_reason, focus.focus_reason].join(";"),
      next_research_focus: existing.focus_score >= focus.focus_score
        ? existing.next_research_focus
        : focus.next_research_focus
    });
  }

  return [...focusByDirection.values()]
    .sort((left, right) =>
      right.focus_score - left.focus_score ||
      defaultDirectionIndex(left.direction_kind) -
        defaultDirectionIndex(right.direction_kind)
    )
    .slice(0, DEFAULT_ARENA_DIRECTIONS.length);
}

export function candidateArenaResearchEfficiencyBudgetFocus(
  latestTicks: CandidateArenaTickReadModel[]
): CandidateArenaAdaptiveDirectionFocus[] {
  return [...latestResearchOutcomeByDirection(latestTicks).entries()]
    .flatMap(([direction, result]) =>
      result.status === "created" && result.research_efficiency
        ? [{
            direction,
            focusScore: researchEfficiencyBudgetFocusScore(
              result.research_efficiency
            )
          }]
        : []
    )
    .filter((entry) => entry.focusScore > 0)
    .sort((left, right) =>
      right.focusScore - left.focusScore ||
      defaultDirectionIndex(left.direction) -
        defaultDirectionIndex(right.direction)
    )
    .map((entry) => ({
      direction_kind: entry.direction,
      focus_score: entry.focusScore,
      focus_reason: "research_efficiency_budget:low_cost_latency",
      next_research_focus:
        "Favor lower-cost ResearchDirection lanes while expensive lanes cool down.",
      authority_status: "not_promotion_authority"
    }));
}

export function candidateArenaResearchEfficiencyExpensiveDirections(
  latestTicks: CandidateArenaTickReadModel[]
): ResearchDirectionKind[] {
  return [...latestResearchOutcomeByDirection(latestTicks).entries()]
    .flatMap(([direction, result]) =>
      result.research_efficiency &&
        researchEfficiencyBudgetFocusScore(result.research_efficiency) <= 0
        ? [direction]
        : []
    );
}

function allocationSignals(input: {
  findingClusters: CandidateArenaFindingClusterReadModel[];
  latestTicks: CandidateArenaTickReadModel[];
  priorAllocations: CandidateArenaResearchAllocationRecord[];
  completedTickIds: string[];
}): CandidateArenaResearchAllocationSignal[] {
  const findingFocus = new Map(candidateArenaAdaptiveDirectionFocus(
    input.findingClusters
  ).map((focus) => [focus.direction_kind, focus]));
  const efficiencyFocus = new Map(candidateArenaResearchEfficiencyBudgetFocus(
    input.latestTicks
  ).map((focus) => [focus.direction_kind, focus]));
  const latestOutcomes = latestResearchOutcomeByDirection(input.latestTicks);
  const history = completedSelectionHistory(
    input.priorAllocations,
    input.completedTickIds
  );

  return DEFAULT_ARENA_DIRECTIONS.map((direction) => {
    const finding = findingFocus.get(direction);
    const efficiency = efficiencyFocus.get(direction);
    const latestOutcome = latestOutcomes.get(direction);
    const recentOutcomeScore = recentOutcomeAdjustment(latestOutcome?.status);
    const completed = history.get(direction);
    return {
      direction_kind: direction,
      finding_pressure_score: finding?.focus_score ?? 0,
      research_efficiency_score: efficiency?.focus_score ?? 0,
      recent_outcome_score: recentOutcomeScore,
      focus_score: (finding?.focus_score ?? 0) +
        (efficiency?.focus_score ?? 0) + recentOutcomeScore,
      completed_selection_count: completed?.count ?? 0,
      ...(completed?.lastAllocation
        ? {
            last_completed_allocation_ref: {
              record_kind: "candidate_arena_research_allocation",
              id: completed.lastAllocation
                .candidate_arena_research_allocation_id
            }
          }
        : {}),
      source_candidate_ids: uniqueStrings(input.findingClusters
        .filter((cluster) => adaptiveDirectionForCluster(cluster) === direction)
        .flatMap((cluster) => cluster.candidate_ids)),
      source_tick_ids: input.latestTicks
        .filter((tick) => tick.direction_results.some((result) =>
          result.direction_kind === direction
        ))
        .map((tick) => tick.tick_id),
      reasons: uniqueStrings([
        finding?.focus_reason,
        efficiency?.focus_reason,
        recentOutcomeReason(latestOutcome?.status)
      ].filter((reason): reason is string => Boolean(reason)))
    };
  });
}

function adaptiveSelections(
  signals: CandidateArenaResearchAllocationSignal[],
  priorAllocations: CandidateArenaResearchAllocationRecord[]
): CandidateArenaResearchAllocationSelection[] {
  const focusSelections = [...signals]
    .filter((signal) => signal.focus_score > 0)
    .sort((left, right) =>
      right.focus_score - left.focus_score ||
      defaultDirectionIndex(left.direction_kind) -
        defaultDirectionIndex(right.direction_kind)
    )
    .slice(0, CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      .maximum_focus_direction_count)
    .map((signal) => ({
      direction_kind: signal.direction_kind,
      selection_kind: "focus" as const,
      priority: 0,
      experiment_budget:
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.focus_experiment_budget,
      signal_score: signal.focus_score,
      reasons: signal.reasons
    }));
  const focusedDirections = focusSelections.map(
    (selection) => selection.direction_kind
  );
  const lastAllocatedAt = new Map(priorAllocations.map((allocation) => [
    allocation.candidate_arena_research_allocation_id,
    allocation.allocated_at
  ]));
  const explorationSelections = signals
    .filter((signal) => !focusedDirections.includes(signal.direction_kind))
    .sort((left, right) =>
      left.completed_selection_count - right.completed_selection_count ||
      compareOldestAllocation(left, right, lastAllocatedAt) ||
      defaultDirectionIndex(left.direction_kind) -
        defaultDirectionIndex(right.direction_kind)
    )
    .slice(
      0,
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.default_direction_slot_count -
        focusSelections.length
    )
    .map((signal) => ({
      direction_kind: signal.direction_kind,
      selection_kind: "exploration" as const,
      priority: 0,
      experiment_budget: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
        .exploration_experiment_budget,
      signal_score: signal.focus_score,
      reasons: ["exploration_floor"]
    }));
  return [...focusSelections, ...explorationSelections].map(
    (selection, index) => ({ ...selection, priority: index + 1 })
  );
}

function staticSelections(): CandidateArenaResearchAllocationSelection[] {
  return DEFAULT_ARENA_DIRECTIONS.slice(0, 3).map((direction, index) => ({
    direction_kind: direction,
    selection_kind: "static_control",
    priority: index + 1,
    experiment_budget: index < 2 ? 2 : 1,
    signal_score: 0,
    reasons: ["static_control"]
  }));
}

function explicitSelections(
  directions: ResearchDirectionKind[]
): CandidateArenaResearchAllocationSelection[] {
  return directions.map((direction, index) => ({
    direction_kind: direction,
    selection_kind: "explicit",
    priority: index + 1,
    experiment_budget:
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY.explicit_experiment_budget,
    signal_score: 0,
    reasons: ["explicit_direction"]
  }));
}

function completedSelectionHistory(
  allocations: CandidateArenaResearchAllocationRecord[],
  completedTickIds: string[]
): Map<ResearchDirectionKind, {
  count: number;
  lastAllocation: CandidateArenaResearchAllocationRecord;
}> {
  const completed = new Set(completedTickIds);
  const history = new Map<ResearchDirectionKind, {
    count: number;
    lastAllocation: CandidateArenaResearchAllocationRecord;
  }>();
  for (const allocation of allocations
    .filter((candidate) => completed.has(candidate.tick_id))
    .sort((left, right) => left.allocated_at.localeCompare(right.allocated_at))) {
    for (const selection of allocation.selected_directions) {
      if (!DEFAULT_ARENA_DIRECTIONS.includes(selection.direction_kind)) continue;
      const existing = history.get(selection.direction_kind);
      history.set(selection.direction_kind, {
        count: (existing?.count ?? 0) + 1,
        lastAllocation: allocation
      });
    }
  }
  return history;
}

function latestResearchOutcomeByDirection(
  latestTicks: CandidateArenaTickReadModel[]
): Map<ResearchDirectionKind, CandidateArenaTickDirectionResultReadModel> {
  const latest = new Map<
    ResearchDirectionKind,
    CandidateArenaTickDirectionResultReadModel
  >();
  for (const tick of latestTicks) {
    for (const result of tick.direction_results) {
      if (!DEFAULT_ARENA_DIRECTIONS.includes(result.direction_kind) ||
        latest.has(result.direction_kind)) {
        continue;
      }
      latest.set(result.direction_kind, result);
    }
  }
  return latest;
}

function recentOutcomeAdjustment(
  status: CandidateArenaTickDirectionResultReadModel["status"] | undefined
): number {
  switch (status) {
    case "duplicate": return -15;
    case "quarantined": return -30;
    case "failed": return -10;
    case "created":
    case undefined:
      return 0;
  }
}

function recentOutcomeReason(
  status: CandidateArenaTickDirectionResultReadModel["status"] | undefined
): string | undefined {
  return status && status !== "created" ? `recent_outcome:${status}` : undefined;
}

function compareOldestAllocation(
  left: CandidateArenaResearchAllocationSignal,
  right: CandidateArenaResearchAllocationSignal,
  allocatedAt: Map<string, string>
): number {
  const leftId = left.last_completed_allocation_ref?.id;
  const rightId = right.last_completed_allocation_ref?.id;
  if (!leftId && rightId) return -1;
  if (leftId && !rightId) return 1;
  return (leftId ? allocatedAt.get(leftId) ?? "" : "").localeCompare(
    rightId ? allocatedAt.get(rightId) ?? "" : ""
  );
}

function researchEfficiencyBudgetFocusScore(
  efficiency: CandidateArenaResearchEfficiencyReadModel
): number {
  const effortUnits = efficiency.provider_request_total +
    (efficiency.runner_command_total * 2) +
    efficiency.scenario_count +
    Math.ceil(efficiency.elapsed_ms / 1000);
  return 26 - effortUnits;
}

function adaptiveDirectionFocusFromCluster(
  direction: ResearchDirectionKind,
  cluster: CandidateArenaFindingClusterReadModel
): CandidateArenaAdaptiveDirectionFocus {
  return {
    direction_kind: direction,
    source_direction_kind: cluster.direction_kind === direction
      ? undefined
      : cluster.direction_kind,
    focus_score: adaptiveDirectionFocusScore(cluster),
    focus_reason: [
      cluster.protocol_failure_kind,
      cluster.blocker_group_kind,
      cluster.top_blocker
    ].filter(Boolean).join(":") || "paper_finding_cluster",
    next_research_focus: cluster.protocol_failure_kind
      ? nextResearchFocusForFailureKind(cluster.protocol_failure_kind)
      : cluster.next_research_focus,
    authority_status: "not_promotion_authority"
  };
}

function adaptiveDirectionForCluster(
  cluster: CandidateArenaFindingClusterReadModel
): ResearchDirectionKind {
  if (cluster.protocol_failure_kind === "public_execution_evidence_gap" ||
    cluster.blocker_group_kind === "fill_provenance" ||
    cluster.protocol_failure_kind === "trading_system_protocol_error" ||
    cluster.protocol_failure_kind === "ledger_gap" ||
    cluster.protocol_failure_kind === "sandbox_or_runner_failure" ||
    cluster.protocol_failure_kind === "runner_health_loss") {
    return "execution_cost_robustness";
  }
  if (cluster.protocol_failure_kind === "risk_rejection") {
    return "funding_aware_risk";
  }
  if (cluster.protocol_failure_kind === "market_data_gap" ||
    cluster.blocker_group_kind === "market_provenance" ||
    cluster.market_regime === "volatile") {
    return "volatility_regime";
  }
  if (cluster.market_regime === "flat") return "mean_reversion";
  return cluster.direction_kind;
}

function adaptiveDirectionFocusScore(
  cluster: CandidateArenaFindingClusterReadModel
): number {
  return (cluster.candidate_count * 10) +
    (cluster.protocol_failure_kind ? 20 : 0) +
    (cluster.blocker_group_kind ? 5 : 0) +
    (cluster.top_blocker ? 2 : 0) +
    (cluster.market_regime === "volatile" ? 3 : 0);
}

function nextResearchFocusForFailureKind(kind: PaperTradingFailureKind): string {
  switch (kind) {
    case "market_data_gap":
      return "Restore Gateway market data before continuing paper evidence.";
    case "public_execution_evidence_gap":
      return "Restore public execution evidence before trusting fills or paper score.";
    case "trading_system_protocol_error":
      return "Fix the TradingSystem paper event protocol before retrying observation.";
    case "risk_rejection":
      return "Review order sizing, side, and risk limits before continuing paper evidence.";
    case "sandbox_or_runner_failure":
      return "Repair or resume the runner before treating paper evidence as current.";
    case "runner_health_loss":
      return "Resume paper trading before review.";
    case "ledger_gap":
      return "Inspect order, Gateway, and execution records before trusting the observation.";
    case "authority_boundary_violation":
      return "Reject or repair the candidate before any further review.";
    case "unknown_failure":
      return "Inspect the raw failure reason and add a classifier if this recurs.";
  }
}

function allocationRequestMatches(
  existing: CandidateArenaResearchAllocationRecord,
  input: {
    allocationMode: CandidateArenaResearchAllocationMode;
    explicitDirections?: ResearchDirectionKind[];
  }
): boolean {
  if (existing.allocation_mode !== input.allocationMode) return false;
  if (input.allocationMode !== "explicit") {
    return input.explicitDirections === undefined;
  }
  return Array.isArray(input.explicitDirections) && arraysEqual(
    existing.selected_directions.map((selection) => selection.direction_kind),
    input.explicitDirections
  );
}

function canonicalExplicitDirections(
  value: unknown
): ResearchDirectionKind[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5 ||
    value.some((direction) =>
      typeof direction !== "string" ||
      !RESEARCH_DIRECTIONS.has(direction as ResearchDirectionKind)
    ) || new Set(value).size !== value.length) {
    throw invalidDecision();
  }
  return [...value] as ResearchDirectionKind[];
}

function canonicalId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 ||
    value !== value.trim()) {
    throw invalidDecision();
  }
  return value;
}

function canonicalTime(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw invalidDecision();
  }
  return value;
}

function allocationModeValue(
  value: unknown
): CandidateArenaResearchAllocationMode {
  if (value !== "adaptive_default" && value !== "static_control" &&
    value !== "explicit") {
    throw invalidDecision();
  }
  return value;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "string" && item.trim().length > 0 && item === item.trim()
  ) && new Set(value).size === value.length;
}

function uniqueStrings(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function defaultDirectionIndex(direction: ResearchDirectionKind): number {
  const index = DEFAULT_ARENA_DIRECTIONS.indexOf(direction);
  return index < 0 ? DEFAULT_ARENA_DIRECTIONS.length : index;
}

function canonicalDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function invalidDecision(): CandidateArenaResearchAllocationDecisionError {
  return new CandidateArenaResearchAllocationDecisionError();
}
