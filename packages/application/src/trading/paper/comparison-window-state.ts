export type PaperTradingComparisonWindowPhase =
  | "waiting_first_checkpoint_due"
  | "first_checkpoint_committed"
  | "waiting_tick_acknowledgements"
  | "next_tick_captured"
  | "views_advanced"
  | "checkpoint_committed"
  | "window_stopped"
  | "comparison_failed"
  | "recovery_required";

export type PaperTradingComparisonWindowTransition =
  | "none"
  | "capture_first_checkpoint"
  | "capture_next_tick"
  | "begin_next_checkpoint"
  | "complete_next_checkpoint"
  | "stop_window";

export interface PaperTradingComparisonWindowFacts {
  owned: boolean;
  now: string;
  activation_attempted_at: string;
  interval_ms: number;
  maximum_observation_count: number;
  maximum_elapsed_ms: number;
  tick_count: number;
  latest_tick_observed_at: string;
  checkpoint_attempt_count: number;
  paired_checkpoint_count: number;
  latest_checkpoint_status?: "open" | "paired" | "incomplete";
  latest_checkpoint_has_failed_side: boolean;
  latest_checkpoint_deadline_at?: string;
  latest_tick_acknowledged_roles: readonly ("champion" | "challenger")[];
  activation_status: "both_running" | "stopped_cleanly" | "cleanup_required";
}

export interface PaperTradingComparisonWindowDecision {
  phase: PaperTradingComparisonWindowPhase;
  transition: PaperTradingComparisonWindowTransition;
  checkpoint_sequence: number;
  terminal: boolean;
  next_wake_at?: string;
  stable_error_code?: string;
}

export interface PaperTradingComparisonFrozenWindowBoundaryFacts {
  activation_attempted_at: string;
  boundary_observed_at: string;
  interval_ms: number;
  maximum_observation_count: number;
  maximum_elapsed_ms: number;
  paired_checkpoint_count: number;
  latest_tick_observed_at: string;
}

export class PaperTradingComparisonWindowStateError extends Error {
  readonly code = "paper_trading_comparison_window_graph_invalid";

  constructor(message: string) {
    super(message);
    this.name = "PaperTradingComparisonWindowStateError";
  }
}

export function classifyPaperTradingComparisonWindow(
  facts: PaperTradingComparisonWindowFacts
): PaperTradingComparisonWindowDecision {
  assertValidFacts(facts);
  const checkpointSequence = facts.tick_count > facts.checkpoint_attempt_count
    ? facts.tick_count
    : Math.max(1, facts.checkpoint_attempt_count);
  const decision = (
    phase: PaperTradingComparisonWindowPhase,
    transition: PaperTradingComparisonWindowTransition,
    terminal: boolean,
    extra: Pick<
      PaperTradingComparisonWindowDecision,
      "next_wake_at" | "stable_error_code"
    > = {}
  ): PaperTradingComparisonWindowDecision => ({
    phase,
    transition,
    checkpoint_sequence: checkpointSequence,
    terminal,
    ...extra
  });

  if (facts.activation_status === "stopped_cleanly") {
    return decision("window_stopped", "none", true);
  }
  if (facts.activation_status === "cleanup_required") {
    return decision("comparison_failed", "none", true, {
      stable_error_code: "paper_trading_comparison_window_cleanup_required"
    });
  }
  if (facts.latest_checkpoint_status === "incomplete") {
    return decision("comparison_failed", "none", true, {
      stable_error_code: "paper_trading_comparison_checkpoint_incomplete"
    });
  }
  if (facts.latest_checkpoint_has_failed_side) {
    return decision("comparison_failed", "none", true, {
      stable_error_code: "paper_trading_comparison_candidate_failed"
    });
  }
  if (!facts.owned) {
    return decision("recovery_required", "none", true, {
      stable_error_code: "paper_trading_comparison_runtime_ownership_lost"
    });
  }

  const windowDeadlineAt = addMilliseconds(
    facts.activation_attempted_at,
    facts.maximum_elapsed_ms
  );

  if (facts.checkpoint_attempt_count === 0) {
    if (Date.parse(facts.now) > Date.parse(windowDeadlineAt)) {
      return decision("waiting_first_checkpoint_due", "stop_window", false);
    }
    const firstDueAt = addMilliseconds(
      facts.latest_tick_observed_at,
      facts.interval_ms
    );
    if (Date.parse(facts.now) < Date.parse(firstDueAt)) {
      return decision("waiting_first_checkpoint_due", "none", false, {
        next_wake_at: firstDueAt
      });
    }
    return decision(
      "waiting_first_checkpoint_due",
      "capture_first_checkpoint",
      false
    );
  }

  if (facts.latest_checkpoint_status === "open") {
    const deadlineExceeded = Date.parse(facts.now) >
      Date.parse(facts.latest_checkpoint_deadline_at!);
    if (deadlineExceeded) {
      return decision("views_advanced", "complete_next_checkpoint", false, {
        stable_error_code: "paper_trading_comparison_checkpoint_deadline_exceeded"
      });
    }
    if (hasBothAcknowledgements(facts)) {
      return decision("views_advanced", "complete_next_checkpoint", false);
    }
    return decision("views_advanced", "none", false);
  }

  if (facts.tick_count === facts.checkpoint_attempt_count + 1) {
    return decision("next_tick_captured", "begin_next_checkpoint", false);
  }

  const nextCadenceAt = addMilliseconds(
    facts.latest_tick_observed_at,
    facts.interval_ms
  );
  if (paperTradingComparisonFrozenWindowBoundaryReached({
    activation_attempted_at: facts.activation_attempted_at,
    boundary_observed_at: facts.now,
    interval_ms: facts.interval_ms,
    maximum_observation_count: facts.maximum_observation_count,
    maximum_elapsed_ms: facts.maximum_elapsed_ms,
    paired_checkpoint_count: facts.paired_checkpoint_count,
    latest_tick_observed_at: facts.latest_tick_observed_at
  })) {
    return decision("checkpoint_committed", "stop_window", false);
  }
  if (!hasBothAcknowledgements(facts)) {
    return decision("waiting_tick_acknowledgements", "none", false);
  }
  if (Date.parse(facts.now) < Date.parse(nextCadenceAt)) {
    return decision("checkpoint_committed", "none", false, {
      next_wake_at: nextCadenceAt
    });
  }
  return decision("checkpoint_committed", "capture_next_tick", false);
}

export function paperTradingComparisonFrozenWindowBoundaryReached(
  facts: PaperTradingComparisonFrozenWindowBoundaryFacts
): boolean {
  const attemptedAt = Date.parse(facts.activation_attempted_at);
  const boundaryObservedAt = Date.parse(facts.boundary_observed_at);
  const latestTickObservedAt = Date.parse(facts.latest_tick_observed_at);
  if (!Number.isFinite(attemptedAt) || !Number.isFinite(boundaryObservedAt) ||
    !Number.isFinite(latestTickObservedAt) ||
    !Number.isInteger(facts.interval_ms) || facts.interval_ms <= 0 ||
    !Number.isInteger(facts.maximum_observation_count) ||
    facts.maximum_observation_count <= 0 ||
    !Number.isInteger(facts.maximum_elapsed_ms) || facts.maximum_elapsed_ms <= 0 ||
    !Number.isInteger(facts.paired_checkpoint_count) ||
    facts.paired_checkpoint_count < 0) {
    return false;
  }
  const windowDeadlineAt = attemptedAt + facts.maximum_elapsed_ms;
  return facts.paired_checkpoint_count >= facts.maximum_observation_count ||
    boundaryObservedAt > windowDeadlineAt ||
    latestTickObservedAt + facts.interval_ms > windowDeadlineAt;
}

function assertValidFacts(facts: PaperTradingComparisonWindowFacts): void {
  const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
  const nonNegativeInteger = (value: number) => Number.isInteger(value) && value >= 0;
  const exactIso = (value: string | undefined): value is string =>
    typeof value === "string" && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
  const roles = facts.latest_tick_acknowledged_roles;
  const roleSet = new Set(roles);
  const countsValid = positiveInteger(facts.tick_count) &&
    nonNegativeInteger(facts.checkpoint_attempt_count) &&
    nonNegativeInteger(facts.paired_checkpoint_count) &&
    facts.paired_checkpoint_count <= facts.checkpoint_attempt_count &&
    facts.checkpoint_attempt_count <= facts.tick_count &&
    facts.tick_count <= facts.checkpoint_attempt_count + 1 &&
    facts.tick_count <= facts.maximum_observation_count;
  const acknowledgementRolesValid = roles.length <= 2 &&
    roleSet.size === roles.length &&
    roles.every((role) => role === "champion" || role === "challenger") &&
    (facts.checkpoint_attempt_count > 0 || roles.length === 0);
  const failedSideShapeValid = !facts.latest_checkpoint_has_failed_side ||
    facts.latest_checkpoint_status === "paired";
  const chronologyValid = exactIso(facts.now) &&
    exactIso(facts.activation_attempted_at) &&
    exactIso(facts.latest_tick_observed_at) &&
    Date.parse(facts.now) >= Date.parse(facts.activation_attempted_at) &&
    Date.parse(facts.now) >= Date.parse(facts.latest_tick_observed_at);
  const checkpointShapeValid = facts.checkpoint_attempt_count === 0
    ? facts.tick_count === 1 &&
      facts.paired_checkpoint_count === 0 &&
      facts.latest_checkpoint_status === undefined &&
      facts.latest_checkpoint_deadline_at === undefined
    : facts.latest_checkpoint_status === "paired"
      ? facts.paired_checkpoint_count === facts.checkpoint_attempt_count &&
        facts.latest_checkpoint_deadline_at === undefined
      : facts.latest_checkpoint_status === "open"
        ? facts.paired_checkpoint_count === facts.checkpoint_attempt_count - 1 &&
          facts.tick_count === facts.checkpoint_attempt_count &&
          exactIso(facts.latest_checkpoint_deadline_at)
        : facts.latest_checkpoint_status === "incomplete" &&
          facts.paired_checkpoint_count === facts.checkpoint_attempt_count - 1 &&
          facts.tick_count === facts.checkpoint_attempt_count;

  if (typeof facts.owned !== "boolean" ||
    !chronologyValid ||
    !positiveInteger(facts.interval_ms) ||
    !positiveInteger(facts.maximum_observation_count) ||
    !positiveInteger(facts.maximum_elapsed_ms) ||
    !countsValid ||
    !acknowledgementRolesValid ||
    !failedSideShapeValid ||
    !checkpointShapeValid ||
    typeof facts.latest_checkpoint_has_failed_side !== "boolean" ||
    !["both_running", "stopped_cleanly", "cleanup_required"].includes(
      facts.activation_status
    )) {
    throw new PaperTradingComparisonWindowStateError(
      "Paper comparison window facts are not a contiguous valid state."
    );
  }
}

function hasBothAcknowledgements(facts: PaperTradingComparisonWindowFacts): boolean {
  const roles = new Set(facts.latest_tick_acknowledged_roles);
  return roles.has("champion") && roles.has("challenger");
}

function addMilliseconds(value: string, milliseconds: number): string {
  return new Date(Date.parse(value) + milliseconds).toISOString();
}
