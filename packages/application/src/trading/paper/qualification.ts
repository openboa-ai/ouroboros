import type {
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  PaperTradingQualificationReason,
  PaperTradingQualificationStatus
} from "@ouroboros/domain";

export interface PaperTradingQualificationPolicy {
  minObservationCount: number;
  minElapsedMs: number;
  maxFailedObservationRatio: number;
  assessRunnerHealth: boolean;
}

export interface PaperTradingQualificationResult {
  qualification_status: PaperTradingQualificationStatus;
  qualification_reasons: PaperTradingQualificationReason[];
  evidence_window: {
    observation_count: number;
    elapsed_ms: number;
    failed_observation_count: number;
  };
}

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY: PaperTradingQualificationPolicy = {
  minObservationCount: 30,
  minElapsedMs: 30 * 60_000,
  maxFailedObservationRatio: 0.1,
  assessRunnerHealth: true
};

export function qualifyPaperTradingEvaluation(input: {
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
  runnerActive: boolean;
  policy?: Partial<PaperTradingQualificationPolicy>;
}): PaperTradingQualificationResult {
  const policy = {
    ...DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
    ...input.policy
  };
  const failedObservationCount = input.observations.filter((observation) =>
    observation.status === "failed"
  ).length;
  const evidenceWindow = {
    observation_count: input.evaluation.observation_count,
    elapsed_ms: paperEvaluationElapsedMs(input.evaluation),
    failed_observation_count: failedObservationCount
  };
  const failedRatio = evidenceWindow.observation_count > 0
    ? failedObservationCount / evidenceWindow.observation_count
    : 0;
  const reasons: PaperTradingQualificationReason[] = [];

  if (input.evaluation.status === "failed") {
    return {
      qualification_status: "paper_failed",
      qualification_reasons: ["paper_evaluation_failed"],
      evidence_window: evidenceWindow
    };
  }

  if (input.evaluation.observation_count < policy.minObservationCount) {
    reasons.push("min_observation_count_not_met");
  }
  if (evidenceWindow.elapsed_ms < policy.minElapsedMs) {
    reasons.push("min_elapsed_ms_not_met");
  }

  const qualityReasons: PaperTradingQualificationReason[] = [];
  if (policy.assessRunnerHealth && input.evaluation.status === "running" && !input.runnerActive) {
    qualityReasons.push("runner_inactive_for_running_evaluation");
  }
  if (failedRatio > policy.maxFailedObservationRatio) {
    qualityReasons.push("failed_observation_ratio_exceeded");
  }
  if (!latestMarketSnapshot(input.evaluation, input.observations)) {
    qualityReasons.push("latest_market_snapshot_missing");
  }
  if (hasFillWithoutMatchingPublicExecutionEvidence(input.evaluation, input.observations)) {
    qualityReasons.push("fill_public_execution_evidence_missing");
  }

  if (qualityReasons.length > 0) {
    return {
      qualification_status: qualityReasons.length === 1 &&
          qualityReasons[0] === "runner_inactive_for_running_evaluation"
        ? "needs_resume"
        : "blocked_by_quality",
      qualification_reasons: qualityReasons,
      evidence_window: evidenceWindow
    };
  }

  if (reasons.length > 0) {
    return {
      qualification_status: "collecting_evidence",
      qualification_reasons: reasons,
      evidence_window: evidenceWindow
    };
  }

  return {
    qualification_status: "qualified",
    qualification_reasons: [],
    evidence_window: evidenceWindow
  };
}

function paperEvaluationElapsedMs(evaluation: PaperTradingEvaluationRecord): number {
  const started = Date.parse(evaluation.started_at);
  const ended = Date.parse(evaluation.stopped_at ?? evaluation.last_observed_at ?? evaluation.started_at);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return 0;
  }
  return ended - started;
}

function latestMarketSnapshot(
  _evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): PaperTradingObservationRecord["market_snapshot"] | undefined {
  return [...observations].reverse().find((observation) => observation.market_snapshot)?.market_snapshot;
}

function hasFillWithoutMatchingPublicExecutionEvidence(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  const fills = uniqueFills([
    evaluation.latest_fill,
    ...observations.map((observation) => observation.latest_fill)
  ]);
  const publicExecutionSnapshots = [
    evaluation.latest_public_execution_snapshot,
    ...observations.map((observation) => observation.public_execution_snapshot)
  ].filter((snapshot): snapshot is NonNullable<PaperTradingObservationRecord["public_execution_snapshot"]> =>
    Boolean(snapshot)
  );
  return fills.some((fill) =>
    !publicExecutionSnapshots.some((snapshot) => fillMatchesPublicExecutionSnapshot(fill, snapshot))
  );
}

function fillMatchesPublicExecutionSnapshot(
  fill: NonNullable<PaperTradingEvaluationRecord["latest_fill"]>,
  snapshot: PaperTradingObservationRecord["public_execution_snapshot"]
): boolean {
  if (!snapshot) {
    return false;
  }
  if (!fill.source_trade_id) {
    return Boolean(snapshot.book_ticker || snapshot.agg_trades.length > 0);
  }
  return snapshot.agg_trades.some((trade) => trade.trade_id === fill.source_trade_id) ||
    snapshot.stream_marker === fill.source_trade_id ||
    fill.source_trade_id.startsWith(`${snapshot.stream_marker}:`);
}

function uniqueFills(
  fills: Array<PaperTradingEvaluationRecord["latest_fill"] | undefined>
): Array<NonNullable<PaperTradingEvaluationRecord["latest_fill"]>> {
  const unique = new Map<string, NonNullable<PaperTradingEvaluationRecord["latest_fill"]>>();
  for (const fill of fills) {
    if (!fill) {
      continue;
    }
    unique.set(fill.source_trade_id ?? fill.fill_id, fill);
  }
  return [...unique.values()];
}
