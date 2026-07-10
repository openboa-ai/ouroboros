import type {
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  PaperTradingQualificationReason,
  PaperTradingQualificationStatus
} from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentMatchesEvaluation } from "./commitment";
import { paperTradingScoreFromAccount } from "./engine";

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
    first_observed_at?: string;
    last_observed_at?: string;
  };
}

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY: PaperTradingQualificationPolicy = {
  minObservationCount: 30,
  minElapsedMs: 30 * 60_000,
  maxFailedObservationRatio: 0.1,
  assessRunnerHealth: true
};

export function paperTradingEvidenceIntegrityReasons(input: {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
}): PaperTradingQualificationReason[] {
  if (
    !input.commitment ||
    !paperTradingEvaluationCommitmentMatchesEvaluation(input.commitment, input.evaluation)
  ) {
    return ["paper_evaluation_commitment_missing"];
  }
  if (!paperObservationChainComplete(input.evaluation, input.commitment, input.observations)) {
    return ["paper_observation_chain_incomplete"];
  }
  if (!paperObservationAccountingComplete(input.evaluation, input.commitment, input.observations)) {
    return ["paper_score_account_mismatch"];
  }
  if (!paperScoreMatchesAccount(input.evaluation, input.commitment)) {
    return ["paper_score_account_mismatch"];
  }
  return [];
}

export function qualifyPaperTradingEvaluation(input: {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
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
  const observationBounds = paperEvaluationObservationBounds(input.evaluation, input.observations);
  const evidenceWindow = {
    observation_count: input.evaluation.observation_count,
    elapsed_ms: paperEvaluationElapsedMs(input.evaluation, input.observations),
    failed_observation_count: failedObservationCount,
    ...observationBounds
  };
  const failedRatio = evidenceWindow.observation_count > 0
    ? failedObservationCount / evidenceWindow.observation_count
    : 0;
  const reasons: PaperTradingQualificationReason[] = [];

  if (input.evaluation.status === "invalidated") {
    return {
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["paper_evaluation_invalidated"],
      evidence_window: evidenceWindow
    };
  }

  if (
    !input.commitment ||
    !paperTradingEvaluationCommitmentMatchesEvaluation(input.commitment, input.evaluation)
  ) {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"],
      evidence_window: evidenceWindow
    };
  }

  if (input.commitment.evidence_purpose !== "qualification") {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["evidence_purpose_not_qualification"],
      evidence_window: evidenceWindow
    };
  }

  if (!input.commitment.provider_identity.qualification_eligible) {
    return {
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["provider_identity_not_qualification_eligible"],
      evidence_window: evidenceWindow
    };
  }

  if (input.evaluation.status === "failed") {
    return {
      qualification_status: "paper_failed",
      qualification_reasons: ["paper_evaluation_failed"],
      evidence_window: evidenceWindow
    };
  }

  const evidenceIntegrityReasons = paperTradingEvidenceIntegrityReasons(input);
  if (evidenceIntegrityReasons.length > 0) {
    return {
      qualification_status: "blocked_by_quality",
      qualification_reasons: evidenceIntegrityReasons,
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
  if (
    evidenceWindow.observation_count >= policy.minObservationCount &&
    !latestMarketSnapshot(input.evaluation, input.observations)
  ) {
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

function paperObservationChainComplete(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  if (observations.length !== evaluation.observation_count) {
    return false;
  }
  const ordered = [...observations].sort((left, right) => left.sequence - right.sequence);
  return ordered.every((observation, index) =>
    observation.sequence === index + 1 &&
    sameRef(observation.paper_trading_evaluation_ref, {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    }) &&
    sameRef(
      observation.paper_trading_evaluation_commitment_ref,
      evaluation.paper_trading_evaluation_commitment_ref
    ) &&
    sameRef(observation.candidate_ref, commitment.candidate_ref) &&
    sameRef(observation.candidate_version_ref, commitment.candidate_version_ref) &&
    sameRef(observation.trading_run_ref, commitment.trading_run_ref)
  );
}

function sameRef(
  left: { record_kind: string; id: string } | undefined,
  right: { record_kind: string; id: string } | undefined
): boolean {
  return Boolean(
    left &&
    right &&
    left.record_kind === right.record_kind &&
    left.id === right.id
  );
}

function paperObservationAccountingComplete(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  const initialEquityUsdt = Number(commitment.initial_account_snapshot.equity_usdt);
  if (!Number.isFinite(initialEquityUsdt) || initialEquityUsdt <= 0) {
    return false;
  }
  const zeroScore: PaperTradingEvaluationRecord["latest_score"] = {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
  if (!sameProfitLoss(
    paperTradingScoreFromAccount(commitment.initial_account_snapshot, initialEquityUsdt),
    zeroScore
  )) {
    return false;
  }

  let previousScore = zeroScore;
  let latestAccount = commitment.initial_account_snapshot;
  const ordered = [...observations].sort((left, right) => left.sequence - right.sequence);
  for (const observation of ordered) {
    if (
      !validProfitLoss(observation.score_delta) ||
      !validProfitLoss(observation.cumulative_score) ||
      !sameProfitLoss(observation.score_delta, profitLossDelta(
        observation.cumulative_score,
        previousScore
      ))
    ) {
      return false;
    }
    if (observation.paper_account_snapshot) {
      if (!sameProfitLoss(
        paperTradingScoreFromAccount(observation.paper_account_snapshot, initialEquityUsdt),
        observation.cumulative_score
      )) {
        return false;
      }
      latestAccount = observation.paper_account_snapshot;
    } else if (!sameProfitLoss(observation.cumulative_score, previousScore)) {
      return false;
    }
    previousScore = observation.cumulative_score;
  }

  return Boolean(
    evaluation.paper_account_snapshot &&
    sameProfitLoss(previousScore, evaluation.latest_score) &&
    sameJson(latestAccount, evaluation.paper_account_snapshot)
  );
}

function profitLossDelta(
  current: PaperTradingEvaluationRecord["latest_score"],
  previous: PaperTradingEvaluationRecord["latest_score"]
): PaperTradingEvaluationRecord["latest_score"] {
  return {
    revenue_usdt: roundProfit(current.revenue_usdt - previous.revenue_usdt),
    cost_usdt: roundProfit(current.cost_usdt - previous.cost_usdt),
    net_revenue_usdt: roundProfit(current.net_revenue_usdt - previous.net_revenue_usdt),
    net_return_pct: roundProfit(current.net_return_pct - previous.net_return_pct)
  };
}

function validProfitLoss(value: PaperTradingEvaluationRecord["latest_score"]): boolean {
  return Object.values(value).every((item) => Number.isFinite(item));
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function paperScoreMatchesAccount(
  evaluation: PaperTradingEvaluationRecord,
  commitment: PaperTradingEvaluationCommitmentRecord
): boolean {
  const initialEquityUsdt = Number(commitment.initial_account_snapshot.equity_usdt);
  if (
    !evaluation.paper_account_snapshot ||
    !Number.isFinite(initialEquityUsdt) ||
    initialEquityUsdt <= 0
  ) {
    return false;
  }
  return sameProfitLoss(
    paperTradingScoreFromAccount(evaluation.paper_account_snapshot, initialEquityUsdt),
    evaluation.latest_score
  );
}

function sameProfitLoss(
  left: PaperTradingEvaluationRecord["latest_score"],
  right: PaperTradingEvaluationRecord["latest_score"]
): boolean {
  return left.revenue_usdt === right.revenue_usdt &&
    left.cost_usdt === right.cost_usdt &&
    left.net_revenue_usdt === right.net_revenue_usdt &&
    left.net_return_pct === right.net_return_pct;
}

function paperEvaluationElapsedMs(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): number {
  if (observations.length === 0) {
    return 0;
  }
  const started = Date.parse(evaluation.started_at);
  const ended = Date.parse([...observations]
    .sort((left, right) => left.sequence - right.sequence)
    .at(-1)!.observed_at);
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return 0;
  }
  return ended - started;
}

function paperEvaluationObservationBounds(
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): { first_observed_at?: string; last_observed_at?: string } {
  const ordered = [...observations].sort((a, b) =>
    a.sequence - b.sequence || a.observed_at.localeCompare(b.observed_at)
  );
  return {
    first_observed_at: ordered[0]?.observed_at,
    last_observed_at: ordered.at(-1)?.observed_at ?? evaluation.last_observed_at
  };
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
