import type {
  LedgerReadModel,
  PaperTradingComparisonActivationOutcomeReason,
  PaperTradingComparisonQualificationReason,
  PaperTradingComparisonQualificationResult,
  PaperTradingQualificationResult,
  Ref
} from "@ouroboros/domain";
import type { PaperTradingComparisonWindowPhase } from "./comparison-window-state";
import { paperTradingComparisonFrozenWindowBoundaryReached } from "./comparison-window-state";

export type {
  PaperTradingComparisonQualificationReason,
  PaperTradingComparisonQualificationResult,
  PaperTradingComparisonQualificationStatus
} from "@ouroboros/domain";

export interface PaperTradingComparisonQualificationSideInput {
  tradingRunId: string;
  projectedTradingRunId?: string;
  qualification: PaperTradingQualificationResult;
  expectedLedgerRefs: readonly Ref[];
  ledger?: LedgerReadModel;
}

export interface PaperTradingComparisonQualificationDecisionInput {
  comparisonId: string;
  activationId: string;
  activationAttemptId: string;
  windowPhase: PaperTradingComparisonWindowPhase;
  finalOutcomeReason?: PaperTradingComparisonActivationOutcomeReason;
  checkpointCount: number;
  checkpointOutcomesComplete: boolean;
  minimumObservationCount: number;
  minimumElapsedMs: number;
  intervalMs: number;
  maximumObservationCount: number;
  maximumElapsedMs: number;
  activationAttemptedAt: string;
  latestTickObservedAt: string;
  windowClosureRequestedAt: string;
  champion: PaperTradingComparisonQualificationSideInput;
  challenger: PaperTradingComparisonQualificationSideInput;
}

type LedgerAssessment = "complete" | "incomplete" | "lineage_mismatch";

export function decidePaperTradingComparisonQualification(
  input: PaperTradingComparisonQualificationDecisionInput
): PaperTradingComparisonQualificationResult {
  const reasons: PaperTradingComparisonQualificationReason[] = [];
  if (input.windowPhase !== "window_stopped") {
    reasons.push("comparison_window_not_stopped_cleanly");
  }
  if (input.finalOutcomeReason !== "handoff_cleanup") {
    reasons.push("comparison_window_not_completed_normally");
  }
  if (!paperTradingComparisonFrozenWindowBoundaryReached({
    activation_attempted_at: input.activationAttemptedAt,
    boundary_observed_at: input.windowClosureRequestedAt,
    interval_ms: input.intervalMs,
    maximum_observation_count: input.maximumObservationCount,
    maximum_elapsed_ms: input.maximumElapsedMs,
    paired_checkpoint_count: input.checkpointCount,
    latest_tick_observed_at: input.latestTickObservedAt
  })) {
    reasons.push("comparison_frozen_window_boundary_not_reached");
  }
  if (!input.checkpointOutcomesComplete) {
    reasons.push("comparison_checkpoint_incomplete");
  }
  if (!Number.isInteger(input.checkpointCount) ||
    input.checkpointCount < input.minimumObservationCount) {
    reasons.push("comparison_minimum_observation_count_not_met");
  }
  if (sharedElapsedMs(input) < input.minimumElapsedMs) {
    reasons.push("comparison_minimum_elapsed_not_met");
  }
  if (input.champion.qualification.qualification_status !== "qualified") {
    reasons.push("champion_not_qualified");
  }
  if (input.challenger.qualification.qualification_status !== "qualified") {
    reasons.push("challenger_not_qualified");
  }

  appendLedgerReason(reasons, "champion", assessLedger(input.champion));
  appendLedgerReason(reasons, "challenger", assessLedger(input.challenger));

  return {
    comparison_id: input.comparisonId,
    activation_id: input.activationId,
    activation_attempt_id: input.activationAttemptId,
    qualification_status: reasons.length === 0 ? "qualified" : "not_qualified",
    qualification_reasons: reasons,
    checkpoint_count: input.checkpointCount,
    champion: input.champion.qualification,
    challenger: input.challenger.qualification,
    authority_status: "not_verdict"
  };
}

function sharedElapsedMs(
  input: Pick<
    PaperTradingComparisonQualificationDecisionInput,
    "activationAttemptedAt" | "latestTickObservedAt"
  >
): number {
  const started = Date.parse(input.activationAttemptedAt);
  const observed = Date.parse(input.latestTickObservedAt);
  return Number.isFinite(started) && Number.isFinite(observed) && observed >= started
    ? observed - started
    : -1;
}

function appendLedgerReason(
  reasons: PaperTradingComparisonQualificationReason[],
  role: "champion" | "challenger",
  assessment: LedgerAssessment
): void {
  if (assessment === "incomplete") {
    reasons.push(`${role}_ledger_incomplete`);
  } else if (assessment === "lineage_mismatch") {
    reasons.push(`${role}_ledger_lineage_mismatch`);
  }
}

function assessLedger(
  side: PaperTradingComparisonQualificationSideInput
): LedgerAssessment {
  if (side.projectedTradingRunId === undefined || side.ledger === undefined) {
    return "incomplete";
  }
  if (side.projectedTradingRunId !== side.tradingRunId) {
    return "lineage_mismatch";
  }

  const expected = ledgerChainIds(side.expectedLedgerRefs);
  if (!expected) return "lineage_mismatch";

  const ledger = side.ledger;
  if (ledger.chains.length === 0) {
    const emptyProjection = !ledger.has_activity && ledger.chain_count === 0 &&
      ledger.latest_order_request === null &&
      ledger.latest_gateway_result === null &&
      ledger.latest_execution_result === null;
    if (!emptyProjection) return "incomplete";
    return expected.length === 0 ? "complete" : "lineage_mismatch";
  }
  if (!ledger.chain_complete || ledger.chain_count !== ledger.chains.length ||
    ledger.has_activity !== (ledger.chains.length > 0) ||
    ledger.chains.some((chain) =>
      !chain.chain_complete || !chain.gateway_result || !chain.execution_result)) {
    return "incomplete";
  }

  const actualChainIds: string[] = [];
  for (const chain of ledger.chains) {
    const gateway = chain.gateway_result!;
    const execution = chain.execution_result!;
    if (chain.chain_id !== chain.order_request.order_request_id ||
      gateway.order_request_ref.record_kind !== "order_request" ||
      gateway.order_request_ref.id !== chain.order_request.order_request_id ||
      execution.order_request_ref.record_kind !== "order_request" ||
      execution.order_request_ref.id !== chain.order_request.order_request_id ||
      execution.gateway_result_ref.record_kind !== "gateway_result" ||
      execution.gateway_result_ref.id !== gateway.gateway_result_id) {
      return "lineage_mismatch";
    }
    actualChainIds.push(chain.chain_id);
  }

  const actual = uniqueSortedIds(actualChainIds);
  if (!actual || actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])) {
    return "lineage_mismatch";
  }
  return "complete";
}

function ledgerChainIds(refs: readonly Ref[]): string[] | undefined {
  const ids = refs.map((value) => {
    if (!value || value.record_kind !== "ledger_chain" ||
      typeof value.id !== "string" || !value.id) return undefined;
    return value.id;
  });
  if (ids.some((value) => value === undefined)) return undefined;
  return uniqueSortedIds(ids as string[]);
}

function uniqueSortedIds(ids: readonly string[]): string[] | undefined {
  const sorted = [...ids].sort();
  return new Set(sorted).size === sorted.length ? sorted : undefined;
}
