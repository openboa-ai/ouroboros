import type {
  LedgerReadModel,
  PaperTradingComparisonActivationOutcomeReason,
  PaperTradingQualificationResult,
  Ref
} from "@ouroboros/domain";
import type { PaperTradingComparisonWindowPhase } from "./comparison-window-state";

export type PaperTradingComparisonQualificationStatus =
  | "qualified"
  | "not_qualified";

export type PaperTradingComparisonQualificationReason =
  | "comparison_window_not_stopped_cleanly"
  | "comparison_window_not_completed_normally"
  | "comparison_checkpoint_incomplete"
  | "comparison_minimum_observation_count_not_met"
  | "comparison_minimum_elapsed_not_met"
  | "champion_not_qualified"
  | "challenger_not_qualified"
  | "champion_ledger_incomplete"
  | "challenger_ledger_incomplete"
  | "champion_ledger_lineage_mismatch"
  | "challenger_ledger_lineage_mismatch";

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
  activationAttemptedAt: string;
  latestTickObservedAt: string;
  champion: PaperTradingComparisonQualificationSideInput;
  challenger: PaperTradingComparisonQualificationSideInput;
}

export interface PaperTradingComparisonQualificationResult {
  comparison_id: string;
  activation_id: string;
  activation_attempt_id: string;
  qualification_status: PaperTradingComparisonQualificationStatus;
  qualification_reasons: PaperTradingComparisonQualificationReason[];
  checkpoint_count: number;
  champion: PaperTradingQualificationResult;
  challenger: PaperTradingQualificationResult;
  authority_status: "not_verdict";
}

type LedgerAssessment = "complete" | "incomplete" | "lineage_mismatch";

const SUPPORTED_LEDGER_REF_KINDS = new Set([
  "order_request",
  "gateway_result",
  "execution_result"
]);

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

  const expected = refKeys(side.expectedLedgerRefs);
  if (!expected) return "lineage_mismatch";

  const ledger = side.ledger;
  if (!ledger.chain_complete || ledger.chain_count !== ledger.chains.length ||
    ledger.has_activity !== (ledger.chains.length > 0) ||
    ledger.chains.some((chain) =>
      !chain.chain_complete || !chain.gateway_result || !chain.execution_result)) {
    return "incomplete";
  }

  const actualRefs: Ref[] = [];
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
    actualRefs.push(
      { record_kind: "order_request", id: chain.order_request.order_request_id },
      { record_kind: "gateway_result", id: gateway.gateway_result_id },
      { record_kind: "execution_result", id: execution.execution_result_id }
    );
  }

  const actual = refKeys(actualRefs);
  if (!actual || actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])) {
    return "lineage_mismatch";
  }
  return "complete";
}

function refKeys(refs: readonly Ref[]): string[] | undefined {
  const keys = refs.map((value) => {
    if (!value || !SUPPORTED_LEDGER_REF_KINDS.has(value.record_kind) ||
      typeof value.id !== "string" || !value.id) return undefined;
    return `${value.record_kind}:${value.id}`;
  });
  if (keys.some((value) => value === undefined)) return undefined;
  const sorted = (keys as string[]).sort();
  return new Set(sorted).size === sorted.length ? sorted : undefined;
}
