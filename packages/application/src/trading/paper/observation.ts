import { createHash } from "node:crypto";
import type {
  CandidateInspectReadModel,
  LedgerInput,
  LedgerWriteOutcome,
  PaperTradingAccountSnapshot,
  PaperTradingDecisionOrderRequestSummary,
  PaperTradingDecisionSummary,
  PaperTradingComparisonCheckpointAttemptRecord,
  PaperTradingComparisonTickAcknowledgementRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingEvaluationRecord,
  PaperTradingFillSummary,
  PaperTradingObservationRecord,
  PaperTradingOrderSummary,
  PaperTradingPublicExecutionSnapshotSummary,
  Ref,
  RunControlAuditInput
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { safeId } from "../../safe-id";
import { executeGatewayOrderRequest, type GatewayRuntimeBinding } from "../gateway/runtime-binding";
import type { MarketSnapshot } from "../research/types";
import {
  applyPaperTradingCheckpoint,
  restorePaperTradingEngineState,
  type PaperTradingEngineCheckpointResult,
  type PaperTradingEngineState
} from "./engine";
import { marketSnapshotSummary, zeroPaperTradingProfitLoss } from "./evaluation";
import {
  parseTradingSystemPaperEventLine,
  type PaperTradingSystemEvent,
  type ParsedTradingSystemPaperEvent
} from "./events";
import { classifyPaperTradingFailure } from "./failures";
import {
  invalidatePaperTradingEvaluation,
  type PaperTradingEvaluationCommitmentVerification
} from "./commitment";

export class PaperTradingObservationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingObservationError";
  }
}

export interface RecordPaperTradingEvaluationObservationInput {
  store: OuroborosStorePort;
  tradingRunId: string;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  appendLedger: boolean;
  intervalMs: number;
  refreshCandidate?: (candidate: CandidateInspectReadModel) => Promise<CandidateInspectReadModel>;
  restartFailedEvaluation?: boolean;
  restartFailedEvaluationProcessedEventIds?: string[];
  verifyCommitment: (
    evaluation: PaperTradingEvaluationRecord,
    candidate: CandidateInspectReadModel
  ) => Promise<PaperTradingEvaluationCommitmentVerification>;
}

export interface RecordPaperTradingEvaluationObservationResult {
  evaluation: PaperTradingEvaluationRecord;
  observation?: PaperTradingObservationRecord;
}

export interface PreparePaperTradingComparisonCheckpointEvidenceInput {
  store: Pick<OuroborosStorePort, "previewLedger">;
  role: "champion" | "challenger";
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  tick: PaperTradingComparisonTickRecord;
  checkpointAttempt: PaperTradingComparisonCheckpointAttemptRecord;
  tickAcknowledgement?: PaperTradingComparisonTickAcknowledgementRecord;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  intervalMs: number;
}

export interface PreparedPaperTradingComparisonCheckpointEvidence {
  ledger_inputs: LedgerInput[];
  ledger_outcomes: LedgerWriteOutcome[];
  observation: PaperTradingObservationRecord;
  evaluation: PaperTradingEvaluationRecord;
  consumed_event_count: number;
}

export async function preparePaperTradingComparisonCheckpointEvidence(
  input: PreparePaperTradingComparisonCheckpointEvidenceInput
): Promise<PreparedPaperTradingComparisonCheckpointEvidence> {
  const side = input.checkpointAttempt[input.role];
  if (
    input.tick.sequence !== input.checkpointAttempt.checkpoint_sequence ||
    input.tick.paper_trading_comparison_tick_id !==
      input.checkpointAttempt.tick_ref.id ||
    input.tick.tick_digest !== input.checkpointAttempt.tick_digest ||
    input.evaluation.paper_trading_evaluation_id !==
      side.paper_trading_evaluation_ref.id ||
    input.evaluation.trading_run_ref.id !== side.trading_run_ref.id ||
    input.evaluation.status !== "running" ||
    input.evaluation.observation_count !==
      input.checkpointAttempt.checkpoint_sequence - 1
  ) {
    throw new PaperTradingObservationError(
      "paper_trading_comparison_checkpoint_state_mismatch",
      "Paper comparison checkpoint preparation requires the exact running sequence side."
    );
  }
  const acknowledgement = input.checkpointAttempt.checkpoint_sequence > 1
    ? input.tickAcknowledgement
    : undefined;
  if (input.checkpointAttempt.checkpoint_sequence > 1 && !acknowledgement) {
    throw new PaperTradingObservationError(
      "paper_trading_comparison_tick_acknowledgement_required",
      "Repeated paper comparison preparation requires its persisted tick acknowledgement."
    );
  }
  if (acknowledgement && (
    acknowledgement.paper_trading_comparison_activation_attempt_ref.id !==
      input.checkpointAttempt.paper_trading_comparison_activation_attempt_ref.id ||
    acknowledgement.paper_trading_comparison_activation_attempt_digest !==
      input.checkpointAttempt.paper_trading_comparison_activation_attempt_digest ||
    acknowledgement.role !== input.role ||
    acknowledgement.trading_run_ref.id !== side.trading_run_ref.id ||
    acknowledgement.tick_ref.id !== input.tick.paper_trading_comparison_tick_id ||
    acknowledgement.tick_digest !== input.tick.tick_digest ||
    acknowledgement.tick_sequence !== input.tick.sequence
  )) {
    throw new PaperTradingObservationError(
      "paper_trading_comparison_tick_acknowledgement_mismatch",
      "Paper comparison tick acknowledgement does not match the checkpoint side."
    );
  }
  const previousEngineState = engineStateFromEvaluation(input.evaluation);
  const tradingSystemEvents = tradingSystemEventsFromCandidate(input.candidate)
    .filter((event) =>
      !previousEngineState.processedTradingSystemEventIds.includes(event.event_id)
    );
  if (input.checkpointAttempt.checkpoint_sequence > 1 &&
    tradingSystemEvents.some((event) =>
      !event.comparison_tick_acknowledgement_ref ||
      event.comparison_tick_acknowledgement_ref.id !==
        acknowledgement!.paper_trading_comparison_tick_acknowledgement_id ||
      event.comparison_tick_acknowledgement_digest !==
        acknowledgement!.acknowledgement_digest)) {
    throw new PaperTradingObservationError(
      "comparison_tick_acknowledgement_attribution_invalid",
      "Repeated paper comparison events require the exact current tick acknowledgement."
    );
  }
  const decision = await preparePaperTradingObservationDecision({
    candidate: input.candidate,
    tradingRunId: side.trading_run_ref.id,
    gatewayRuntimeBinding: input.gatewayRuntimeBinding,
    observedAt: input.tick.observed_at,
    tradingSystemEvents,
    previewLedger: (ledgerInput) => input.store.previewLedger(ledgerInput)
  });
  const rejected = decision.engineEvents.some(isPaperTradingErrorEvent);
  let engineResult: PaperTradingEngineCheckpointResult;
  if (rejected) {
    engineResult = paperTradingTerminalCheckpoint({
      previous: previousEngineState,
      score: input.evaluation.latest_score,
      events: decision.engineEvents
    });
  } else {
    engineResult = applyPaperTradingCheckpoint({
      previous: previousEngineState,
      marketPrice: input.tick.market_snapshot.price,
      observedAt: input.tick.observed_at,
      publicExecutionSnapshot: input.tick.public_execution_snapshot,
      events: decision.engineEvents
    });
  }
  const filled = engineResult.processedPublicTradeIds.length >
      previousEngineState.processedPublicTradeIds.length ||
    engineResult.latestFill?.fill_id !== previousEngineState.latestFill?.fill_id ||
    Boolean(engineResult.latestFill &&
      paperPositionChanged(previousEngineState, engineResult));
  const canceled = decision.engineEvents.some((event) =>
    event.event_kind === "cancel_order"
  );
  const latestLedger = decision.ledgerOutcomes.at(-1);
  const observationStatus: PaperTradingObservationRecord["status"] = rejected
    ? "failed"
    : decision.ledgerOutcomes.length > 0 || filled || canceled
      ? "recorded"
      : "no_order";
  const observation = paperTradingObservationRecord({
    candidate: input.candidate,
    evaluation: input.evaluation,
    sequence: input.checkpointAttempt.checkpoint_sequence,
    status: observationStatus,
    observedAt: input.tick.observed_at,
    marketSnapshot: structuredClone(input.tick.market_snapshot),
    publicExecutionSnapshot: structuredClone(input.tick.public_execution_snapshot),
    decision: decision.decision,
    ledgerRef: latestLedger
      ? {
          record_kind: "ledger_chain",
          id: latestLedger.order_request.order_request_id
        }
      : undefined,
    paperAccountSnapshot: engineResult.account,
    openOrders: engineResult.openOrders,
    processedTradingSystemEventIds: engineResult.processedTradingSystemEventIds,
    processedPublicTradeIds: engineResult.processedPublicTradeIds,
    latestFill: engineResult.latestFill,
    scoreDelta: engineResult.scoreDelta,
    cumulativeScore: engineResult.score,
    failureReason: rejected
      ? decision.decision?.reason ?? "trading_system_event_rejected"
      : undefined,
    comparisonTickRef: {
      record_kind: "paper_trading_comparison_tick",
      id: input.tick.paper_trading_comparison_tick_id
    },
    comparisonTickDigest: input.tick.tick_digest,
    comparisonTickAcknowledgementRef: acknowledgement
      ? {
          record_kind: "paper_trading_comparison_tick_acknowledgement",
          id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
        }
      : undefined,
    comparisonTickAcknowledgementDigest: acknowledgement?.acknowledgement_digest,
    checkpointAttemptRef: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: input.checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpointAttemptDigest: input.checkpointAttempt.attempt_digest
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: input.evaluation,
    status: rejected ? "failed" : "running",
    observedAt: input.tick.observed_at,
    nextObservationAt: rejected
      ? undefined
      : new Date(Date.parse(input.tick.observed_at) + input.intervalMs).toISOString(),
    latestScore: engineResult.score,
    latestFailureReason: rejected ? observation.failure_reason : undefined,
    latestPublicExecutionSnapshot: input.tick.public_execution_snapshot,
    paperAccountSnapshot: engineResult.account,
    openOrders: engineResult.openOrders,
    processedTradingSystemEventIds: engineResult.processedTradingSystemEventIds,
    processedPublicTradeIds: engineResult.processedPublicTradeIds,
    latestFill: engineResult.latestFill
  });
  return {
    ledger_inputs: decision.ledgerInputs,
    ledger_outcomes: decision.ledgerOutcomes,
    observation,
    evaluation,
    consumed_event_count: engineResult.processedEventIdsThisCheckpoint.length
  };
}

export async function recordPaperTradingEvaluationObservation(
  input: RecordPaperTradingEvaluationObservationInput
): Promise<RecordPaperTradingEvaluationObservationResult> {
  const candidateBefore = await input.store.getCandidateForTradingRun(input.tradingRunId);
  if (!candidateBefore) {
    throw new PaperTradingObservationError(
      "runtime_not_found",
      `runtime ${input.tradingRunId} not found`,
      { runtime_id: input.tradingRunId }
    );
  }
  const now = new Date().toISOString();
  const existingEvaluation = await input.store.getLatestPaperTradingEvaluationForTradingRun(input.tradingRunId);
  if (!existingEvaluation) {
    throw new PaperTradingObservationError(
      "paper_trading_evaluation_not_started",
      `paper TradingEvaluation for runtime ${input.tradingRunId} was not prepared`,
      { runtime_id: input.tradingRunId }
    );
  }
  const failedSessionEventIds = existingEvaluation?.status === "failed" && input.restartFailedEvaluation
    ? input.restartFailedEvaluationProcessedEventIds ?? []
    : [];
  const baseEvaluation = existingEvaluation?.status === "failed" &&
    input.restartFailedEvaluation &&
    canRestartFailedPaperTradingEvaluation(existingEvaluation)
    ? restartFailedPaperTradingEvaluation(existingEvaluation, now, input.intervalMs, failedSessionEventIds)
    : existingEvaluation;
  const commitmentVerification = await input.verifyCommitment(baseEvaluation, candidateBefore);
  if (commitmentVerification.status === "invalidated") {
    const invalidatedEvaluation = await input.store.recordPaperTradingEvaluation(
      invalidatePaperTradingEvaluation({
        evaluation: baseEvaluation,
        verification: commitmentVerification,
        invalidatedAt: now
      })
    );
    return { evaluation: invalidatedEvaluation };
  }
  if (baseEvaluation.status === "failed") {
    return recordTerminalFailedObservation({
      store: input.store,
      candidate: candidateBefore,
      evaluation: baseEvaluation,
      observedAt: now,
      failureReason: baseEvaluation.latest_failure_reason ?? "paper_trading_evaluation_failed"
    });
  }

  let market;
  try {
    market = await input.gatewayRuntimeBinding.marketData.readMarketSnapshot({ observedAt: now });
  } catch (error) {
    return recordMarketDataFailure({
      store: input.store,
      candidate: candidateBefore,
      evaluation: baseEvaluation,
      observedAt: now,
      failureReason: error instanceof Error ? error.message : "market_data_unavailable"
    });
  }

  await input.gatewayRuntimeBinding.marketData
    .readPublicMarketLivenessSurface({ observedAt: market.observed_at })
    .then((surface) => input.store.recordPublicMarketLivenessSurface(surface))
    .catch(() => undefined);

  const sequence = baseEvaluation.observation_count + 1;
  let ledgerOutcome: LedgerWriteOutcome | undefined;
  let decision: PaperTradingDecisionSummary | undefined;
  let publicExecutionSnapshot: PaperTradingPublicExecutionSnapshotSummary | undefined;
  let engineResult: PaperTradingEngineCheckpointResult | undefined;
  let previousEngineState: PaperTradingEngineState | undefined;
  let engineEventsThisObservation: PaperTradingSystemEvent[] = [];

  if (input.appendLedger) {
    const refreshedCandidate = input.refreshCandidate
      ? await input.refreshCandidate(candidateBefore)
      : candidateBefore;
    const currentEngineState = engineStateFromEvaluation(baseEvaluation);
    previousEngineState = currentEngineState;
    if (refreshedCandidate.runtime.sandbox?.lifecycle_status === "failed") {
      return recordSandboxFailure({
        store: input.store,
        candidate: refreshedCandidate,
        evaluation: baseEvaluation,
        sequence,
        market,
        previousEngineState: currentEngineState
      });
    }
    const tradingSystemEvents = tradingSystemEventsFromCandidate(refreshedCandidate)
      .filter((event) => !currentEngineState.processedTradingSystemEventIds.includes(event.event_id));
    const decisionOutcome = await recordPaperTradingObservationDecision({
      store: input.store,
      candidate: refreshedCandidate,
      tradingRunId: input.tradingRunId,
      gatewayRuntimeBinding: input.gatewayRuntimeBinding,
      sequence,
      market,
      tradingSystemEvents
    });
    ledgerOutcome = decisionOutcome.ledgerOutcome;
    decision = decisionOutcome.decision;
    engineEventsThisObservation = decisionOutcome.engineEvents;
    if (decisionOutcome.engineEvents.some(isPaperTradingErrorEvent)) {
      engineResult = paperTradingTerminalCheckpoint({
        previous: previousEngineState,
        score: baseEvaluation.latest_score,
        events: decisionOutcome.engineEvents
      });
    } else {
      try {
        engineResult = applyPaperTradingCheckpoint({
          previous: previousEngineState,
          marketPrice: market.price,
          observedAt: market.observed_at,
          events: decisionOutcome.engineEvents
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "public_execution_stream_unavailable") {
          throw error;
        }
        try {
          publicExecutionSnapshot = await input.gatewayRuntimeBinding.marketData
            .readPublicExecutionSnapshot({ observedAt: market.observed_at });
        } catch (error) {
          return recordPublicExecutionFailure({
            store: input.store,
            candidate: refreshedCandidate,
            evaluation: baseEvaluation,
            sequence,
            market,
            decision,
            previousEngineState,
            failureReason: error instanceof Error ? error.message : "public_execution_stream_unavailable"
          });
        }
        engineResult = applyPaperTradingCheckpoint({
          previous: previousEngineState,
          marketPrice: market.price,
          observedAt: market.observed_at,
          publicExecutionSnapshot,
          events: decisionOutcome.engineEvents
        });
      }
    }
  }

  const candidateAfterLedger = await input.store.getCandidateForTradingRun(input.tradingRunId);
  const latestChain = ledgerOutcome
    ? candidateAfterLedger?.ledger?.chains.find((chain) =>
        chain.order_request?.order_request_id === ledgerOutcome?.order_request.order_request_id
      ) ?? candidateAfterLedger?.ledger?.chains[0]
    : candidateAfterLedger?.ledger?.chains[0];
  const scoreDelta = engineResult?.scoreDelta ?? zeroPaperTradingProfitLoss();
  const cumulativeScore = engineResult?.score ?? baseEvaluation.latest_score;
  const hasLedger = Boolean(ledgerOutcome);
  const filledThisObservation = previousEngineState && engineResult
    ? engineResult.processedPublicTradeIds.length > previousEngineState.processedPublicTradeIds.length ||
      engineResult.latestFill?.fill_id !== previousEngineState.latestFill?.fill_id ||
      Boolean(engineResult.latestFill && paperPositionChanged(previousEngineState, engineResult))
    : false;
  const canceledThisObservation = engineEventsThisObservation.some((event) => event.event_kind === "cancel_order");
  const rejectedThisObservation = engineEventsThisObservation.some((event) => event.event_kind === "error");
  const observedAt = market.observed_at;
  const observation = paperTradingObservationRecord({
    candidate: candidateAfterLedger ?? candidateBefore,
    evaluation: baseEvaluation,
    sequence,
    status: rejectedThisObservation
      ? "failed"
      : hasLedger || filledThisObservation || canceledThisObservation ? "recorded" : "no_order",
    observedAt,
    marketSnapshot: marketSnapshotSummary(market),
    publicExecutionSnapshot,
    decision,
    ledgerRef: ledgerOutcome && latestChain ? { record_kind: "ledger_chain", id: latestChain.chain_id } : undefined,
    paperAccountSnapshot: engineResult?.account,
    openOrders: engineResult?.openOrders,
    processedTradingSystemEventIds: engineResult?.processedTradingSystemEventIds,
    processedPublicTradeIds: engineResult?.processedPublicTradeIds,
    latestFill: engineResult?.latestFill,
    scoreDelta,
    cumulativeScore,
    failureReason: rejectedThisObservation ? decision?.reason ?? "trading_system_event_rejected" : undefined
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: baseEvaluation,
    status: rejectedThisObservation ? "failed" : "running",
    observedAt,
    nextObservationAt: rejectedThisObservation
      ? undefined
      : new Date(Date.parse(observedAt) + input.intervalMs).toISOString(),
    latestScore: cumulativeScore,
    latestFailureReason: rejectedThisObservation ? observation.failure_reason : undefined,
    paperAccountSnapshot: engineResult?.account,
    openOrders: engineResult?.openOrders,
    processedTradingSystemEventIds: engineResult?.processedTradingSystemEventIds,
    processedPublicTradeIds: engineResult?.processedPublicTradeIds,
    latestFill: engineResult?.latestFill,
    latestPublicExecutionSnapshot: publicExecutionSnapshot
  });
  await input.store.recordPaperTradingObservation(observation, evaluation);
  return { evaluation, observation };
}

function recordTerminalFailedObservation(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  observedAt: string;
  failureReason: string;
}): Promise<RecordPaperTradingEvaluationObservationResult> {
  const previousEngineState = engineStateFromEvaluation(input.evaluation);
  const observation = paperTradingObservationRecord({
    candidate: input.candidate,
    evaluation: input.evaluation,
    sequence: input.evaluation.observation_count + 1,
    status: "failed",
    observedAt: input.observedAt,
    decision: paperProtocolErrorDecision(input.observedAt, input.failureReason),
    paperAccountSnapshot: previousEngineState.account,
    openOrders: previousEngineState.openOrders,
    processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
    latestFill: previousEngineState.latestFill,
    scoreDelta: zeroPaperTradingProfitLoss(),
    cumulativeScore: input.evaluation.latest_score,
    failureReason: input.failureReason
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: input.evaluation,
    status: "failed",
    observedAt: input.observedAt,
    nextObservationAt: undefined,
    latestScore: input.evaluation.latest_score,
    latestFailureReason: input.failureReason,
    paperAccountSnapshot: previousEngineState.account,
    openOrders: previousEngineState.openOrders,
    processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
    latestFill: previousEngineState.latestFill
  });
  return input.store.recordPaperTradingObservation(observation, evaluation)
    .then(() => ({ evaluation, observation }));
}

function recordMarketDataFailure(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  observedAt: string;
  failureReason: string;
}): Promise<RecordPaperTradingEvaluationObservationResult> {
  const observation = paperTradingObservationRecord({
    candidate: input.candidate,
    evaluation: input.evaluation,
    sequence: input.evaluation.observation_count + 1,
    status: "failed",
    observedAt: input.observedAt,
    scoreDelta: zeroPaperTradingProfitLoss(),
    cumulativeScore: input.evaluation.latest_score,
    failureReason: input.failureReason
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: input.evaluation,
    status: "failed",
    observedAt: input.observedAt,
    nextObservationAt: undefined,
    latestScore: input.evaluation.latest_score,
    latestFailureReason: observation.failure_reason
  });
  return input.store.recordPaperTradingObservation(observation, evaluation)
    .then(() => ({ evaluation, observation }));
}

function recordSandboxFailure(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  sequence: number;
  market: MarketSnapshot;
  previousEngineState: PaperTradingEngineState;
}): Promise<RecordPaperTradingEvaluationObservationResult> {
  const failureReason = "paper_trading_sandbox_failed";
  const observation = paperTradingObservationRecord({
    candidate: input.candidate,
    evaluation: input.evaluation,
    sequence: input.sequence,
    status: "failed",
    observedAt: input.market.observed_at,
    marketSnapshot: marketSnapshotSummary(input.market),
    decision: paperProtocolErrorDecision(input.market.observed_at, failureReason),
    scoreDelta: zeroPaperTradingProfitLoss(),
    cumulativeScore: input.evaluation.latest_score,
    failureReason,
    paperAccountSnapshot: input.previousEngineState.account,
    openOrders: input.previousEngineState.openOrders,
    processedTradingSystemEventIds: input.previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: input.previousEngineState.processedPublicTradeIds,
    latestFill: input.previousEngineState.latestFill
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: input.evaluation,
    status: "failed",
    observedAt: input.market.observed_at,
    nextObservationAt: undefined,
    latestScore: input.evaluation.latest_score,
    latestFailureReason: failureReason,
    paperAccountSnapshot: input.previousEngineState.account,
    openOrders: input.previousEngineState.openOrders,
    processedTradingSystemEventIds: input.previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: input.previousEngineState.processedPublicTradeIds,
    latestFill: input.previousEngineState.latestFill
  });
  return input.store.recordPaperTradingObservation(observation, evaluation)
    .then(() => ({ evaluation, observation }));
}

function recordPublicExecutionFailure(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  sequence: number;
  market: MarketSnapshot;
  decision?: PaperTradingDecisionSummary;
  previousEngineState: PaperTradingEngineState;
  failureReason: string;
}): Promise<RecordPaperTradingEvaluationObservationResult> {
  const observation = paperTradingObservationRecord({
    candidate: input.candidate,
    evaluation: input.evaluation,
    sequence: input.sequence,
    status: "failed",
    observedAt: input.market.observed_at,
    marketSnapshot: marketSnapshotSummary(input.market),
    decision: input.decision,
    scoreDelta: zeroPaperTradingProfitLoss(),
    cumulativeScore: input.evaluation.latest_score,
    failureReason: input.failureReason,
    paperAccountSnapshot: input.previousEngineState.account,
    openOrders: input.previousEngineState.openOrders,
    processedTradingSystemEventIds: input.previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: input.previousEngineState.processedPublicTradeIds,
    latestFill: input.previousEngineState.latestFill
  });
  const evaluation = paperTradingEvaluationUpdate({
    evaluation: input.evaluation,
    status: "failed",
    observedAt: input.market.observed_at,
    nextObservationAt: undefined,
    latestScore: input.evaluation.latest_score,
    latestFailureReason: observation.failure_reason,
    paperAccountSnapshot: input.previousEngineState.account,
    openOrders: input.previousEngineState.openOrders,
    processedTradingSystemEventIds: input.previousEngineState.processedTradingSystemEventIds,
    processedPublicTradeIds: input.previousEngineState.processedPublicTradeIds,
    latestFill: input.previousEngineState.latestFill
  });
  return input.store.recordPaperTradingObservation(observation, evaluation)
    .then(() => ({ evaluation, observation }));
}

async function preparePaperTradingObservationDecision(input: {
  candidate: CandidateInspectReadModel;
  tradingRunId: string;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  observedAt: string;
  tradingSystemEvents: ParsedTradingSystemPaperEvent[];
  previewLedger: (input: LedgerInput) => Promise<LedgerWriteOutcome>;
}): Promise<{
  decision?: PaperTradingDecisionSummary;
  ledgerInputs: LedgerInput[];
  ledgerOutcomes: LedgerWriteOutcome[];
  engineEvents: PaperTradingSystemEvent[];
}> {
  if (!input.tradingSystemEvents.length) {
    return { ledgerInputs: [], ledgerOutcomes: [], engineEvents: [] };
  }
  const protocolErrorEvents = input.tradingSystemEvents.filter(isPaperTradingErrorEvent);
  if (protocolErrorEvents.length) {
    const latestError = protocolErrorEvents.at(-1)!;
    return {
      decision: paperProtocolErrorDecision(latestError.observed_at, latestError.reason),
      ledgerInputs: [],
      ledgerOutcomes: [],
      engineEvents: protocolErrorEvents.map((event) => ({
        event_id: event.event_id,
        event_kind: "error",
        observed_at: event.observed_at,
        reason: event.reason,
        ...comparisonTickAcknowledgementAttribution(event)
      }))
    };
  }
  const candidateVersionId = input.candidate.candidate_version.candidate_version_id;
  const ledgerInputs: LedgerInput[] = [];
  const ledgerOutcomes: LedgerWriteOutcome[] = [];
  const engineEvents: PaperTradingSystemEvent[] = [];
  let latestDecision: PaperTradingDecisionSummary | undefined;
  for (const event of input.tradingSystemEvents) {
    if (event.event_kind === "order_request") {
      const ledgerInput = await ledgerInputFromTradingSystemDecision({
        candidateId: input.candidate.candidate_id,
        candidateVersionId,
        tradingRunId: input.tradingRunId,
        gatewayRuntimeBinding: input.gatewayRuntimeBinding,
        orderRequest: event.order_request,
        sampleId: event.event_id,
        observedAt: input.observedAt
      });
      const ledger = await input.previewLedger(ledgerInput);
      ledgerInputs.push(ledgerInput);
      ledgerOutcomes.push(ledger);
      latestDecision = {
        decision_kind: "order_request",
        source_kind: "trading_system_decision",
        reason: event.reason ?? "trading_system_order_request",
        observed_at: event.observed_at,
        order_request: event.order_request,
        authority_status: "trace_only"
      };
      engineEvents.push({
        event_id: event.event_id,
        event_kind: "order_request",
        observed_at: event.observed_at,
        order_request: event.order_request,
        ledger_ref: {
          record_kind: "order_request",
          id: ledger.order_request.order_request_id
        },
        gateway_outcome: ledger.gateway_result.decision_outcome,
        ...comparisonTickAcknowledgementAttribution(event)
      });
      continue;
    }
    if (event.event_kind === "cancel_order") {
      latestDecision = {
        decision_kind: "cancel_order",
        source_kind: "trading_system_decision",
        reason: event.reason,
        observed_at: event.observed_at,
        authority_status: "trace_only"
      };
      engineEvents.push({
        event_id: event.event_id,
        event_kind: "cancel_order",
        observed_at: event.observed_at,
        order_id: event.order_id,
        reason: event.reason,
        ...comparisonTickAcknowledgementAttribution(event)
      });
      continue;
    }
    latestDecision = paperNoActionDecision(event.observed_at, event.reason);
    engineEvents.push({
      event_id: event.event_id,
      event_kind: event.event_kind,
      observed_at: event.observed_at,
      reason: event.reason,
      ...comparisonTickAcknowledgementAttribution(event)
    });
  }
  return {
    decision: latestDecision,
    ledgerInputs,
    ledgerOutcomes,
    engineEvents
  };
}

function comparisonTickAcknowledgementAttribution(
  event: ParsedTradingSystemPaperEvent
): Pick<
  ParsedTradingSystemPaperEvent,
  | "comparison_tick_acknowledgement_ref"
  | "comparison_tick_acknowledgement_digest"
> {
  if (!event.comparison_tick_acknowledgement_ref ||
    !event.comparison_tick_acknowledgement_digest) {
    return {};
  }
  return {
    comparison_tick_acknowledgement_ref: {
      ...event.comparison_tick_acknowledgement_ref
    },
    comparison_tick_acknowledgement_digest:
      event.comparison_tick_acknowledgement_digest
  };
}

async function recordPaperTradingObservationDecision(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  tradingRunId: string;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  sequence: number;
  market: MarketSnapshot;
  tradingSystemEvents: ParsedTradingSystemPaperEvent[];
}): Promise<{
  decision?: PaperTradingDecisionSummary;
  ledgerOutcome?: LedgerWriteOutcome;
  engineEvents: PaperTradingSystemEvent[];
}> {
  const candidateVersionId = input.candidate.candidate_version.candidate_version_id;
  if (!input.tradingSystemEvents.length) {
    await recordPaperTradingObservationAudit({
      store: input.store,
      candidate: input.candidate,
      candidateVersionId,
      tradingRunId: input.tradingRunId,
      sequence: input.sequence
    });
    return {
      decision: undefined,
      engineEvents: []
    };
  }
  const engineEvents: PaperTradingSystemEvent[] = [];
  let latestDecision: PaperTradingDecisionSummary | undefined;
  let latestLedger: LedgerWriteOutcome | undefined;
  const protocolErrorEvents = input.tradingSystemEvents.filter(isPaperTradingErrorEvent);
  if (protocolErrorEvents.length) {
    const latestError = protocolErrorEvents[protocolErrorEvents.length - 1] as Extract<
      ParsedTradingSystemPaperEvent,
      { event_kind: "error" }
    >;
    await recordPaperTradingObservationAudit({
      store: input.store,
      candidate: input.candidate,
      candidateVersionId,
      tradingRunId: input.tradingRunId,
      sequence: input.sequence
    });
    return {
      decision: paperProtocolErrorDecision(latestError.observed_at, latestError.reason),
      engineEvents: protocolErrorEvents.map((event) => ({
        event_id: event.event_id,
        event_kind: "error",
        observed_at: event.observed_at,
        reason: event.reason,
        ...comparisonTickAcknowledgementAttribution(event)
      }))
    };
  }
  for (const event of input.tradingSystemEvents) {
    if (event.event_kind === "order_request") {
      const ledger = await input.store.recordLedger(await ledgerInputFromTradingSystemDecision({
        candidateId: input.candidate.candidate_id,
        candidateVersionId,
        tradingRunId: input.tradingRunId,
        gatewayRuntimeBinding: input.gatewayRuntimeBinding,
        orderRequest: event.order_request,
        sampleId: event.event_id,
        observedAt: input.market.observed_at
      }));
      latestLedger = ledger;
      latestDecision = {
        decision_kind: "order_request",
        source_kind: "trading_system_decision",
        reason: event.reason ?? "trading_system_order_request",
        observed_at: event.observed_at,
        order_request: event.order_request,
        authority_status: "trace_only"
      };
      engineEvents.push({
        event_id: event.event_id,
        event_kind: "order_request",
        observed_at: event.observed_at,
        order_request: event.order_request,
        ledger_ref: { record_kind: "order_request", id: ledger.order_request.order_request_id },
        gateway_outcome: ledger.gateway_result.decision_outcome,
        ...comparisonTickAcknowledgementAttribution(event)
      });
      continue;
    }
    if (event.event_kind === "cancel_order") {
      latestDecision = {
        decision_kind: "cancel_order",
        source_kind: "trading_system_decision",
        reason: event.reason,
        observed_at: event.observed_at,
        authority_status: "trace_only"
      };
      engineEvents.push({
        event_id: event.event_id,
        event_kind: "cancel_order",
        observed_at: event.observed_at,
        order_id: event.order_id,
        reason: event.reason,
        ...comparisonTickAcknowledgementAttribution(event)
      });
      continue;
    }
    if (event.event_kind === "error") {
      latestDecision = {
        decision_kind: "error",
        source_kind: "trading_system_decision",
        reason: event.reason,
        observed_at: event.observed_at,
        authority_status: "trace_only"
      };
      engineEvents.push({
        event_id: event.event_id,
        event_kind: "error",
        observed_at: event.observed_at,
        reason: event.reason,
        ...comparisonTickAcknowledgementAttribution(event)
      });
      continue;
    }
    latestDecision = paperNoActionDecision(event.observed_at, event.reason);
    engineEvents.push({
      event_id: event.event_id,
      event_kind: event.event_kind,
      observed_at: event.observed_at,
      reason: event.reason,
      ...comparisonTickAcknowledgementAttribution(event)
    });
  }
  await recordPaperTradingObservationAudit({
    store: input.store,
    candidate: input.candidate,
    candidateVersionId,
    tradingRunId: input.tradingRunId,
    sequence: input.sequence
  });
  return { decision: latestDecision, ledgerOutcome: latestLedger, engineEvents };
}

async function recordPaperTradingObservationAudit(input: {
  store: OuroborosStorePort;
  candidate: CandidateInspectReadModel;
  candidateVersionId: string;
  tradingRunId: string;
  sequence: number;
}): Promise<void> {
  await input.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
    idempotencyKey: `trading-run-observe:${input.tradingRunId}:${input.candidateVersionId}:${input.sequence}`,
    candidateId: input.candidate.candidate_id,
    candidateVersionId: input.candidateVersionId,
    tradingRunId: input.tradingRunId,
    action: "inspect",
    lifecycleStatus: "running",
    actorId: "runtime-api",
    reasonSummary: "Operator observed continuous paper Trading Run.",
    message: "Paper TradingEvaluation observation recorded."
  }));
}

function restartFailedPaperTradingEvaluation(
  evaluation: PaperTradingEvaluationRecord,
  restartedAt: string,
  intervalMs: number,
  failedSessionEventIds: string[]
): PaperTradingEvaluationRecord {
  return {
    ...evaluation,
    status: "running",
    interval_ms: intervalMs,
    stopped_at: undefined,
    next_observation_at: new Date(Date.parse(restartedAt) + intervalMs).toISOString(),
    latest_failure_reason: undefined,
    processed_trading_system_event_ids: uniqueIds([
      ...(evaluation.processed_trading_system_event_ids ?? []),
      ...failedSessionEventIds
    ])
  };
}

export function canRestartFailedPaperTradingEvaluation(
  evaluation: Pick<PaperTradingEvaluationRecord, "status" | "latest_failure_reason">
): boolean {
  if (evaluation.status !== "failed") {
    return true;
  }
  const failure = classifyPaperTradingFailure(evaluation.latest_failure_reason);
  return failure?.failure_kind === "market_data_gap" ||
    failure?.failure_kind === "public_execution_evidence_gap" ||
    failure?.failure_kind === "sandbox_or_runner_failure" ||
    failure?.failure_kind === "runner_health_loss";
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function paperTradingEvaluationUpdate(input: {
  evaluation: PaperTradingEvaluationRecord;
  status: PaperTradingEvaluationRecord["status"];
  observedAt: string;
  nextObservationAt?: string;
  latestScore: PaperTradingEvaluationRecord["latest_score"];
  latestFailureReason?: string;
  latestPublicExecutionSnapshot?: PaperTradingPublicExecutionSnapshotSummary;
  paperAccountSnapshot?: PaperTradingAccountSnapshot;
  openOrders?: PaperTradingOrderSummary[];
  processedTradingSystemEventIds?: string[];
  processedPublicTradeIds?: string[];
  latestFill?: PaperTradingFillSummary;
}): PaperTradingEvaluationRecord {
  return {
    ...input.evaluation,
    status: input.status,
    observation_count: input.evaluation.observation_count + 1,
    last_observed_at: input.observedAt,
    next_observation_at: input.nextObservationAt,
    latest_score: input.latestScore,
    latest_failure_reason: input.latestFailureReason,
    latest_public_execution_snapshot: input.latestPublicExecutionSnapshot ??
      input.evaluation.latest_public_execution_snapshot,
    paper_account_snapshot: input.paperAccountSnapshot ?? input.evaluation.paper_account_snapshot,
    open_orders: input.openOrders ?? input.evaluation.open_orders,
    processed_trading_system_event_ids: input.processedTradingSystemEventIds ??
      input.evaluation.processed_trading_system_event_ids,
    processed_public_trade_ids: input.processedPublicTradeIds ?? input.evaluation.processed_public_trade_ids,
    latest_fill: input.latestFill ?? input.evaluation.latest_fill
  };
}

function paperTradingObservationRecord(input: {
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord;
  sequence: number;
  status: PaperTradingObservationRecord["status"];
  observedAt: string;
  marketSnapshot?: PaperTradingObservationRecord["market_snapshot"];
  publicExecutionSnapshot?: PaperTradingPublicExecutionSnapshotSummary;
  decision?: PaperTradingObservationRecord["decision"];
  ledgerRef?: Ref;
  paperAccountSnapshot?: PaperTradingAccountSnapshot;
  openOrders?: PaperTradingOrderSummary[];
  latestFill?: PaperTradingFillSummary;
  processedTradingSystemEventIds?: string[];
  processedPublicTradeIds?: string[];
  scoreDelta: PaperTradingObservationRecord["score_delta"];
  cumulativeScore: PaperTradingObservationRecord["cumulative_score"];
  failureReason?: string;
  comparisonTickRef?: Ref;
  comparisonTickDigest?: string;
  comparisonTickAcknowledgementRef?: Ref;
  comparisonTickAcknowledgementDigest?: string;
  checkpointAttemptRef?: Ref;
  checkpointAttemptDigest?: string;
}): PaperTradingObservationRecord {
  return {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: [
      "paper-trading-observation",
      safeRouteId(input.evaluation.paper_trading_evaluation_id),
      String(input.sequence).padStart(4, "0")
    ].join("-"),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: input.evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_commitment_ref:
      input.evaluation.paper_trading_evaluation_commitment_ref,
    paper_trading_comparison_tick_ref: input.comparisonTickRef,
    paper_trading_comparison_tick_digest: input.comparisonTickDigest,
    paper_trading_comparison_tick_acknowledgement_ref:
      input.comparisonTickAcknowledgementRef,
    paper_trading_comparison_tick_acknowledgement_digest:
      input.comparisonTickAcknowledgementDigest,
    paper_trading_comparison_checkpoint_attempt_ref: input.checkpointAttemptRef,
    paper_trading_comparison_checkpoint_attempt_digest: input.checkpointAttemptDigest,
    candidate_ref: { record_kind: "trading_system_candidate", id: input.candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: input.evaluation.trading_run_ref,
    sequence: input.sequence,
    status: input.status,
    observed_at: input.observedAt,
    market_snapshot: input.marketSnapshot,
    public_execution_snapshot: input.publicExecutionSnapshot,
    decision: input.decision,
    ledger_ref: input.ledgerRef,
    paper_account_snapshot: input.paperAccountSnapshot,
    open_orders: input.openOrders,
    latest_fill: input.latestFill,
    processed_trading_system_event_ids: input.processedTradingSystemEventIds,
    processed_public_trade_ids: input.processedPublicTradeIds,
    score_delta: input.scoreDelta,
    cumulative_score: input.cumulativeScore,
    failure_reason: input.failureReason,
    authority_status: "not_live"
  };
}

function engineStateFromEvaluation(evaluation: PaperTradingEvaluationRecord): PaperTradingEngineState {
  return restorePaperTradingEngineState({
    account: evaluation.paper_account_snapshot,
    openOrders: evaluation.open_orders,
    processedTradingSystemEventIds: evaluation.processed_trading_system_event_ids,
    processedPublicTradeIds: evaluation.processed_public_trade_ids,
    latestFill: evaluation.latest_fill
  });
}

function paperTradingTerminalCheckpoint(input: {
  previous: PaperTradingEngineState;
  score: PaperTradingEvaluationRecord["latest_score"];
  events?: Array<Pick<PaperTradingSystemEvent, "event_id">>;
}): PaperTradingEngineCheckpointResult {
  const processedTradingSystemEventIds = [...input.previous.processedTradingSystemEventIds];
  const processedEventIdsThisCheckpoint: string[] = [];
  for (const event of input.events ?? []) {
    if (processedTradingSystemEventIds.includes(event.event_id)) {
      continue;
    }
    processedTradingSystemEventIds.push(event.event_id);
    processedEventIdsThisCheckpoint.push(event.event_id);
  }
  return {
    account: { ...input.previous.account },
    openOrders: [...input.previous.openOrders],
    processedTradingSystemEventIds,
    processedPublicTradeIds: [...input.previous.processedPublicTradeIds],
    latestFill: input.previous.latestFill,
    score: input.score,
    scoreDelta: zeroPaperTradingProfitLoss(),
    processedEventIdsThisCheckpoint
  };
}

async function ledgerInputFromTradingSystemDecision(input: {
  candidateId: string;
  candidateVersionId: string;
  tradingRunId: string;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  orderRequest: PaperTradingDecisionOrderRequestSummary;
  sampleId?: string;
  observedAt?: string;
}): Promise<LedgerInput> {
  const gatewayExecution = await executeGatewayOrderRequest(input.gatewayRuntimeBinding, input.orderRequest);
  const paperOrderRequest = input.orderRequest.quantity === "0" ? "rejected" : "valid";

  return {
    idempotency_key: [
      "trading-run",
      input.sampleId ?? "sample",
      paperOrderRequest,
      input.candidateId,
      input.candidateVersionId
    ].join("-"),
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    runtime_id: input.tradingRunId,
    intent: gatewayExecution.intent,
    gateway_result: gatewayExecution.gateway_result,
    execution_result: gatewayExecution.execution_result,
    created_at: input.observedAt
  };
}

function tradingSystemEventsFromCandidate(
  candidate: CandidateInspectReadModel
): ParsedTradingSystemPaperEvent[] {
  const sandbox = candidate.runtime.sandbox;
  if (!sandbox) {
    return [];
  }
  const events = sandbox.logs.flatMap((log) =>
    log.lines
      .map((line, index) => parseTradingSystemPaperEventLine(line, {
        sandboxId: sandbox.sandbox_id,
        lineIndex: index,
        fallbackObservedAt: log.captured_at
      }))
      .flatMap((result) => result.status === "accepted" || result.status === "rejected"
        ? [result.event]
        : [])
  );
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.event_id)) {
      return false;
    }
    seen.add(event.event_id);
    return true;
  });
}

export function tradingSystemEventIdsFromCandidate(candidate: CandidateInspectReadModel): string[] {
  return tradingSystemEventsFromCandidate(candidate).map((event) => event.event_id);
}

function paperNoActionDecision(
  observedAt: string,
  reason: string
): PaperTradingDecisionSummary {
  return {
    decision_kind: "hold",
    source_kind: "trading_system_decision",
    reason,
    observed_at: observedAt,
    authority_status: "trace_only"
  };
}

function paperProtocolErrorDecision(
  observedAt: string,
  reason: string
): PaperTradingDecisionSummary {
  return {
    decision_kind: "error",
    source_kind: "trading_system_decision",
    reason,
    observed_at: observedAt,
    authority_status: "trace_only"
  };
}

function paperPositionChanged(
  previous: PaperTradingEngineState,
  next: PaperTradingEngineState
): boolean {
  return previous.account.position.side !== next.account.position.side ||
    previous.account.position.quantity !== next.account.position.quantity ||
    previous.openOrders.length !== next.openOrders.length;
}

function isPaperTradingErrorEvent(
  event: ParsedTradingSystemPaperEvent | PaperTradingSystemEvent
): event is Extract<ParsedTradingSystemPaperEvent | PaperTradingSystemEvent, { event_kind: "error" }> {
  return event.event_kind === "error";
}

export function tradingRunLifecycleAuditInput(input: {
  idempotencyKey: string;
  candidateId: string;
  candidateVersionId: string;
  tradingRunId: string;
  action: RunControlAuditInput["command"]["action"];
  lifecycleStatus: "running" | "stopped";
  actorId: string;
  reasonSummary: string;
  message: string;
}): RunControlAuditInput {
  return {
    idempotency_key: input.idempotencyKey,
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    runtime_id: input.tradingRunId,
    command: {
      action: input.action,
      requested_lifecycle_status: input.lifecycleStatus,
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: input.actorId },
      reason: "operator_request",
      reason_summary: input.reasonSummary,
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: { record_kind: "runtime_policy_engine", id: "runtime-policy-engine-fixture" },
      resulting_lifecycle_status: input.lifecycleStatus,
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      }
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      runtime_lifecycle_status: input.lifecycleStatus,
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: input.actorId },
      message: input.message
    },
    created_at: new Date().toISOString()
  };
}

function safeRouteId(value: string): string {
  const prefix = safeId(value, { maxLength: 72 });
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${digest}`;
}
