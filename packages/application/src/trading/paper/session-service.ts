import { createHash } from "node:crypto";
import {
  paperTradingComparisonBaselineEvaluation,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonEvaluationHasZeroEvidenceActivationState,
  paperTradingComparisonCheckpointWriteContextHasRuntimeShape,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonRuntimeControlIdempotencyKey,
  paperTradingComparisonRuntimeWriteContextHasRuntimeShape,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickContextHasRuntimeShape,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  paperTradingComparisonTickIOWriteContextHasRuntimeShape,
  type CandidateInspectReadModel,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCheckpointWriteContext,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingComparisonTickContext,
  type PaperTradingComparisonTickDeliveryRecord,
  type PaperTradingComparisonTickIOWriteContext,
  type PaperTradingComparisonTickRecord,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationInvalidationReason,
  type PaperTradingEvaluationRecord,
  type PaperTradingEvidencePurpose,
  type PaperTradingObservationRecord,
  type SandboxDetailReadModel,
  type SystemCodeRecord,
  type TradingRunRecord
} from "@ouroboros/domain";
import {
  FIXTURE_SYSTEM_CODE_ID,
  type OuroborosStorePort,
  type PreparedPaperTradingComparisonCheckpointSide
} from "../../ports/store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type {
  PaperTradingComparisonSessionPort,
  PaperTradingComparisonSessionSideStatus
} from "../../ports/paper-comparison-session";
import type { SystemCodeArtifactResolverPort } from "../../ports/system-code-artifact";
import type {
  PaperOrderRequestFixture,
  SandboxAdapterObservationResult,
  SandboxAdapterRegistryPort,
  SandboxStartResult
} from "../../ports/sandbox";
import { safeId } from "../../safe-id";
import {
  createGatewayRuntimeBinding,
  PaperTradingApiProviderComparisonTickClientError,
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "../gateway/runtime-binding";
import type {
  AccountState,
  MarketSnapshot,
  PaperTradingApiProviderComparisonTickHooks,
  ReplayTradingApiProviderSession
} from "../research/types";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { initialPaperTradingEngineState } from "./engine";
import { zeroPaperTradingProfitLoss } from "./evaluation";
import { ComparisonMarketDataView } from "./comparison-market-data-view";
import {
  createPaperTradingEvaluationCommitment,
  invalidatePaperTradingEvaluation,
  verifyPaperTradingEvaluationCommitment,
  type PaperTradingEvaluationCommitmentVerification
} from "./commitment";
import {
  recordPaperTradingEvaluationObservation,
  preparePaperTradingComparisonCheckpointEvidence,
  type RecordPaperTradingEvaluationObservationResult,
  tradingRunLifecycleAuditInput
} from "./observation";

export type PaperTradingSessionClock = "scheduled" | "external";

const DEFAULT_OBSERVATION_DRAIN_TIMEOUT_MS = 10_000;

export interface PaperTradingSessionServiceOptions {
  store: OuroborosStorePort;
  sandboxAdapters: SandboxAdapterRegistryPort;
  marketData: GatewayMarketDataPort;
  runner?: PaperTradingEvaluationRunner;
  intervalMs?: number;
  sandboxIntervalMs?: number;
  observationDrainTimeoutMs?: number;
  apiProviderFactory?: (
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ) => Promise<ReplayTradingApiProviderSession>;
  apiProviderOptions?: Pick<PaperTradingApiProviderOptions, "listen_host" | "sandbox_host">;
  artifactResolver: SystemCodeArtifactResolverPort;
  logger?: Pick<Console, "error">;
}

export interface PreparedPaperTradingSession {
  candidate: CandidateInspectReadModel;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  verification: Extract<PaperTradingEvaluationCommitmentVerification, { status: "verified" }>;
  clock: PaperTradingSessionClock;
}

interface LoadedPaperTradingComparisonSessionSide {
  attempt: PaperTradingComparisonActivationAttemptRecord;
  candidate: CandidateInspectReadModel;
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  baseline: PaperTradingEvaluationRecord;
  evidenceState: "zero" | "paired_checkpoint";
  systemCode: SystemCodeRecord;
}

interface EnabledPaperTradingComparisonTickAttribution {
  side: PaperTradingComparisonActivationSide;
  authority: PaperTradingComparisonTickIOWriteContext;
  tick: PaperTradingComparisonTickRecord;
  maximumProviderRequestCount: number;
  checkpointProviderRequestCount: number;
}

interface AdvancedPaperTradingComparisonCheckpointView {
  authority: PaperTradingComparisonCheckpointWriteContext & {
    operation: "advance_tick_view";
  };
  tick: PaperTradingComparisonTickRecord;
}

export type PaperTradingRecoveryOutcome =
  | {
      tradingRunId: string;
      status: "recovered";
      clock: PaperTradingSessionClock;
    }
  | {
      tradingRunId: string;
      status: "invalidated";
      reason: PaperTradingEvaluationInvalidationReason;
    }
  | {
      tradingRunId: string;
      status: "failed";
      error: string;
    }
  | {
      tradingRunId: string;
      status: "skipped";
      reason: "evaluation_not_running" | "qualification";
    };

export class PaperTradingSessionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingSessionError";
  }
}

export class PaperTradingSessionService implements PaperTradingComparisonSessionPort {
  private readonly apiProviderSessions = new Map<string, ReplayTradingApiProviderSession>();
  private readonly comparisonApiProviderSessions =
    new Map<string, ReplayTradingApiProviderSession>();
  private readonly comparisonGatewayBindings = new Map<string, GatewayRuntimeBinding>();
  private readonly comparisonProviderRequestCounts = new Map<string, number>();
  private readonly comparisonProviderRequestLimits = new Map<string, number>();
  private readonly enabledComparisonTickAttributions =
    new Map<string, EnabledPaperTradingComparisonTickAttribution>();
  private readonly advancedComparisonCheckpointViews =
    new Map<string, AdvancedPaperTradingComparisonCheckpointView>();
  private readonly comparisonTransientCleanupFailures = new Map<string, string>();
  private readonly activeSessions = new Set<string>();
  private readonly runner: PaperTradingEvaluationRunner;
  private readonly intervalMs: number;
  private readonly sandboxIntervalMs: number;
  private readonly observationDrainTimeoutMs: number;
  private readonly apiProviderFactory: NonNullable<PaperTradingSessionServiceOptions["apiProviderFactory"]>;

  constructor(private readonly options: PaperTradingSessionServiceOptions) {
    this.runner = options.runner ?? new PaperTradingEvaluationRunner();
    this.intervalMs = options.intervalMs ?? 60_000;
    this.sandboxIntervalMs = options.sandboxIntervalMs ?? 1_000;
    this.observationDrainTimeoutMs = options.observationDrainTimeoutMs ??
      DEFAULT_OBSERVATION_DRAIN_TIMEOUT_MS;
    this.apiProviderFactory = options.apiProviderFactory ?? startPaperTradingApiProvider;
  }

  async prepare(input: {
    candidateId: string;
    candidateVersionId: string;
    tradingRunId: string;
    evidencePurpose: PaperTradingEvidencePurpose;
    clock: PaperTradingSessionClock;
  }): Promise<PreparedPaperTradingSession> {
    const commitmentId = `paper-trading-evaluation-commitment-${safeRouteId(input.tradingRunId)}`;
    const evaluationId = `paper-trading-evaluation-${safeRouteId(input.tradingRunId)}`;
    const candidate = await this.options.store.getCandidateForTradingRun(input.tradingRunId);
    if (!candidate) {
      throw new PaperTradingSessionError(
        "trading_run_not_found",
        `trading run ${input.tradingRunId} was not found`,
        { trading_run_id: input.tradingRunId }
      );
    }
    if (
      candidate.candidate_id !== input.candidateId ||
      candidate.candidate_version.candidate_version_id !== input.candidateVersionId
    ) {
      throw new PaperTradingSessionError(
        "trading_run_candidate_mismatch",
        "trading run does not belong to the requested candidate version",
        { candidate_id: input.candidateId, candidate_version_id: input.candidateVersionId }
      );
    }
    const run = await this.options.store.getTradingRun(input.tradingRunId);
    if (!run) {
      throw new PaperTradingSessionError("trading_run_not_found", "trading run was not found");
    }
    if (
      run.paper_evidence_purpose
        ? run.paper_evidence_purpose !== input.evidencePurpose
        : !(run.trading_run_id === candidate.runtime.ref.id && input.evidencePurpose === "research_feedback")
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_evidence_purpose_mismatch",
        "PaperTradingSession evidence purpose must match the persisted TradingRun purpose.",
        {
          expected_evidence_purpose: run.paper_evidence_purpose,
          received_evidence_purpose: input.evidencePurpose,
          trading_run_id: input.tradingRunId
        }
      );
    }

    const binding = this.gatewayBinding();
    const runRef = { record_kind: "trading_run", id: input.tradingRunId };
    const [exactCommitment, exactEvaluation, allCommitments, allEvaluations] = await Promise.all([
      this.options.store.getPaperTradingEvaluationCommitment(commitmentId),
      this.options.store.getPaperTradingEvaluation(evaluationId),
      this.options.store.listPaperTradingEvaluationCommitments(),
      this.options.store.listPaperTradingEvaluations()
    ]);
    const commitmentsForRun = allCommitments.filter((record) =>
      paperTradingComparisonRefsEqual(record.trading_run_ref, runRef)
    );
    const commitmentIdsForRun = new Set(
      commitmentsForRun.map((record) => record.paper_trading_evaluation_commitment_id)
    );
    const evaluationsForRun = allEvaluations.filter((record) =>
      paperTradingComparisonRefsEqual(record.trading_run_ref, runRef) ||
      (record.paper_trading_evaluation_commitment_ref?.record_kind ===
        "paper_trading_evaluation_commitment" &&
        commitmentIdsForRun.has(record.paper_trading_evaluation_commitment_ref.id))
    );
    const alternateCommitment = commitmentsForRun.find(
      (record) => record.paper_trading_evaluation_commitment_id !== commitmentId
    );
    const alternateEvaluation = evaluationsForRun.find(
      (record) => record.paper_trading_evaluation_id !== evaluationId
    );
    if (
      alternateCommitment ||
      alternateEvaluation ||
      (exactEvaluation && !exactCommitment) ||
      (exactCommitment && !paperTradingComparisonRefsEqual(exactCommitment.trading_run_ref, runRef)) ||
      (exactEvaluation && !paperTradingComparisonRefsEqual(exactEvaluation.trading_run_ref, runRef)) ||
      (exactEvaluation && exactEvaluation.paper_trading_evaluation_commitment_ref?.record_kind !==
        "paper_trading_evaluation_commitment") ||
      (exactEvaluation && exactEvaluation.paper_trading_evaluation_commitment_ref?.id !== commitmentId)
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_session_deterministic_identity_conflict",
        "Paper session preparation found a non-deterministic commitment/evaluation identity."
      );
    }

    if (exactEvaluation) {
      if (
        input.evidencePurpose === "qualification" &&
        paperTradingComparisonEvaluationRecordDigestInput(exactEvaluation) !==
        paperTradingComparisonEvaluationRecordDigestInput(this.notStartedEvaluation(exactCommitment!))
      ) {
        throw new PaperTradingSessionError(
          "paper_trading_session_non_inert_evaluation_replay",
          "Paper session preparation only reuses an exact inert evaluation."
        );
      }
      const resolved = await this.verifyExisting(candidate, exactEvaluation, binding);
      const verification = resolved.verification;
      if (verification.status !== "verified") {
        const invalidated = await this.persistInvalidation(candidate, exactEvaluation, verification);
        throw new PaperTradingSessionError(
          "paper_trading_evaluation_invalidated",
          verification.diagnostic,
          { paper_trading_evaluation: invalidated, reason: verification.reason }
        );
      }
      return {
        candidate,
        commitment: resolved.commitment,
        evaluation: resolved.evaluation,
        verification,
        clock: input.clock
      };
    }

    const systemCodeId = candidate.system_code?.ref?.id ?? FIXTURE_SYSTEM_CODE_ID;
    const systemCode = await this.options.store.getSystemCode(systemCodeId);
    if (!systemCode) {
      throw new PaperTradingSessionError("system_code_not_found", `system code ${systemCodeId} not found`);
    }
    let resolvedArtifactDigest: string;
    try {
      resolvedArtifactDigest = await this.options.artifactResolver.resolveArtifactDigest(systemCode);
    } catch (error) {
      throw new PaperTradingSessionError(
        "system_code_artifact_unreadable",
        error instanceof Error ? error.message : "SystemCode artifact could not be resolved.",
        { system_code_id: systemCodeId }
      );
    }

    const commitment = exactCommitment ?? createPaperTradingEvaluationCommitment({
      commitmentId,
      evidencePurpose: input.evidencePurpose,
      candidate,
      systemCode,
      resolvedArtifactDigest,
      marketData: binding.marketData,
      intervalMs: this.intervalMs,
      initialAccountSnapshot: initialPaperTradingEngineState().account,
      committedAt: new Date().toISOString()
    });
    if (!exactCommitment) {
      await this.options.store.recordPaperTradingEvaluationCommitment(commitment);
    }
    const evaluation = this.notStartedEvaluation(commitment);
    if (evaluation.paper_trading_evaluation_id !== evaluationId) {
      throw new PaperTradingSessionError(
        "paper_trading_evaluation_identity_mismatch",
        "Deterministic paper evaluation identity changed during preparation."
      );
    }
    const verification = verifyPaperTradingEvaluationCommitment({
      commitment,
      evaluation,
      candidate,
      systemCode,
      resolvedArtifactDigest,
      marketData: binding.marketData,
      intervalMs: this.intervalMs
    });
    if (verification.status !== "verified") {
      throw new PaperTradingSessionError(
        "paper_trading_evaluation_invalidated",
        verification.diagnostic,
        { reason: verification.reason }
      );
    }
    await this.options.store.recordPaperTradingEvaluation(evaluation);
    return { candidate, commitment, evaluation, verification, clock: input.clock };
  }

  private notStartedEvaluation(
    commitment: PaperTradingEvaluationCommitmentRecord
  ): PaperTradingEvaluationRecord {
    const initialEngineState = initialPaperTradingEngineState();
    return {
      record_kind: "paper_trading_evaluation",
      version: 1,
      paper_trading_evaluation_id:
        `paper-trading-evaluation-${safeRouteId(commitment.trading_run_ref.id)}`,
      candidate_ref: { ...commitment.candidate_ref },
      candidate_version_ref: { ...commitment.candidate_version_ref },
      trading_run_ref: { ...commitment.trading_run_ref },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      },
      status: "not_started",
      interval_ms: commitment.window_policy.interval_ms,
      observation_count: 0,
      started_at: commitment.committed_at,
      latest_score: zeroPaperTradingProfitLoss(),
      paper_account_snapshot: commitment.initial_account_snapshot,
      open_orders: initialEngineState.openOrders,
      processed_trading_system_event_ids: initialEngineState.processedTradingSystemEventIds,
      processed_public_trade_ids: initialEngineState.processedPublicTradeIds,
      authority_status: "not_live"
    };
  }

  async activate(
    prepared: PreparedPaperTradingSession,
    input: {
      paperOrderRequest?: PaperOrderRequestFixture;
      restartFailedEventIds?: string[];
    } = {}
  ): Promise<PaperTradingEvaluationRecord> {
    if (prepared.commitment.evidence_purpose === "qualification") {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_authority_required",
        "Qualification PaperTradingSession activation requires verified comparison authority."
      );
    }
    const tradingRunId = prepared.commitment.trading_run_ref.id;
    try {
      const candidate = await this.requireCandidateForRun(tradingRunId);
      const binding = this.gatewayBinding();
      const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(tradingRunId, binding);
      const paperOrderRequest = input.paperOrderRequest ?? paperOrderRequestFromCandidateRuntime(candidate);
      await this.ensureTradingRunSandbox({
        candidate,
        tradingRunId,
        candidateVersionId: candidate.candidate_version.candidate_version_id,
        paperOrderRequest,
        tradingApiBaseUrl
      });
      const existing = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
      const evaluation = existing ?? prepared.evaluation;
      if (evaluation.status !== "running") {
        await this.options.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
          idempotencyKey: `trading-run-start:${paperOrderRequest}:${tradingRunId}:${candidate.candidate_version.candidate_version_id}`,
          candidateId: candidate.candidate_id,
          candidateVersionId: candidate.candidate_version.candidate_version_id,
          tradingRunId,
          action: "start",
          lifecycleStatus: "running",
          actorId: "runtime-api",
          reasonSummary: "Operator requested trading run start.",
          message: "Trading run start recorded."
        }));
      }
      const running = evaluation.status === "running"
        ? evaluation
        : await this.markPaperTradingEvaluationRunning(evaluation, input.restartFailedEventIds);
      this.activeSessions.add(tradingRunId);
      return running;
    } catch (error) {
      await this.stopTerminalSession(tradingRunId).catch(() => undefined);
      throw error;
    }
  }

  async observe(tradingRunId: string): Promise<RecordPaperTradingEvaluationObservationResult> {
    const { candidate } = await this.requireEffectfulSession(tradingRunId);
    const binding = this.gatewayBinding();
    if (!this.apiProviderSessions.has(tradingRunId)) {
      const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(tradingRunId, binding);
      await this.ensureTradingRunSandbox({
        candidate,
        tradingRunId,
        candidateVersionId: candidate.candidate_version.candidate_version_id,
        paperOrderRequest: paperOrderRequestFromCandidateRuntime(candidate),
        tradingApiBaseUrl
      });
      this.activeSessions.add(tradingRunId);
    }
    const result = await recordPaperTradingEvaluationObservation({
      store: this.options.store,
      tradingRunId,
      gatewayRuntimeBinding: binding,
      appendLedger: true,
      intervalMs: this.intervalMs,
      refreshCandidate: async () => this.refreshPaperTradingSandbox(tradingRunId),
      verifyCommitment: async (currentEvaluation, currentCandidate) => (
        await this.verifyExisting(currentCandidate, currentEvaluation, binding)
      ).verification
    });
    if (result.evaluation.status !== "running") {
      await this.stopTerminalSession(tradingRunId);
    }
    return result;
  }

  async schedule(tradingRunId: string): Promise<void> {
    await this.requireEffectfulSession(tradingRunId, { requireActiveSession: true });
    this.runner.start({
      tradingRunId,
      intervalMs: this.intervalMs,
      observe: async () => {
        const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
        if (candidate?.runtime.runtime_lifecycle_status !== "running") {
          await this.stopTerminalSession(tradingRunId);
          return;
        }
        await this.observe(tradingRunId);
      },
      onError: (error) => this.options.logger?.error(error)
    });
  }

  active(tradingRunId: string): boolean {
    return this.activeSessions.has(tradingRunId);
  }

  async startComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    marketData: GatewayMarketDataPort;
    deadlineAt: string;
    maximumProviderRequestCount: number;
    signal: AbortSignal;
  }): Promise<PaperTradingComparisonSessionSideStatus> {
    this.assertComparisonSessionInput(input.authority, input.side, "start");
    if (!Number.isInteger(input.maximumProviderRequestCount) ||
      input.maximumProviderRequestCount <= 0) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_limit_invalid",
        "Paper comparison provider request limit must be a positive integer."
      );
    }
    this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
    const loaded = await this.loadComparisonSessionSide(input.side, input.authority);
    if (input.deadlineAt !== loaded.attempt.start_deadline_at) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_start_deadline_mismatch",
        "Paper comparison start deadline must equal the frozen attempt deadline."
      );
    }
    if (input.maximumProviderRequestCount >
      loaded.attempt.activation_policy.maximum_provider_request_count_per_side) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_limit_mismatch",
        "Paper comparison provider request limit exceeds the frozen attempt policy."
      );
    }
    this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
    const resolvedArtifactDigest = await this.options.artifactResolver.resolveArtifactDigest(
      loaded.systemCode
    );
    this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
    if (resolvedArtifactDigest !== loaded.commitment.resolved_artifact_digest) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_resolved_artifact_mismatch",
        "Paper comparison SystemCode resolved artifact changed after commitment."
      );
    }
    if ((loaded.run.runtime_lifecycle_status !== "registered" &&
      loaded.run.runtime_lifecycle_status !== "stopped") ||
      (loaded.evaluation.status !== "not_started" &&
        loaded.evaluation.status !== "stopped") ||
      loaded.evidenceState !== "zero") {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_side_state_mismatch",
        "Paper comparison side is not in a startable zero-evidence state."
      );
    }

    const binding = this.gatewayBinding(input.marketData);
    const verification = verifyPaperTradingEvaluationCommitment({
      commitment: loaded.commitment,
      evaluation: loaded.evaluation,
      candidate: loaded.candidate,
      systemCode: loaded.systemCode,
      resolvedArtifactDigest,
      marketData: binding.marketData,
      intervalMs: this.intervalMs
    });
    if (verification.status !== "verified") {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_commitment_mismatch",
        verification.diagnostic,
        { reason: verification.reason }
      );
    }

    const sessionKey = comparisonSessionKey(input.authority);
    if (this.comparisonTransientCleanupFailures.has(sessionKey)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_transient_sandbox_cleanup_unresolved",
        "Paper comparison session has unresolved transient sandbox cleanup."
      );
    }
    try {
      const tradingApiBaseUrl = await this.ensureComparisonApiProviderSession({
        sessionKey,
        tradingRunId: loaded.run.trading_run_id,
        binding,
        maximumProviderRequestCount: input.maximumProviderRequestCount
      });
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
      await this.ensureComparisonTradingRunSandbox({
        loaded,
        authority: input.authority,
        tradingApiBaseUrl,
        signal: input.signal,
        deadlineAt: input.deadlineAt
      });
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
      await this.options.store.recordRunControlAudit(
        comparisonRunControlAuditInput(loaded, input.authority, "start"),
        input.authority
      );
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
      const transitionedAt = new Date().toISOString();
      await this.options.store.recordPaperTradingEvaluation({
        ...loaded.evaluation,
        status: "running",
        stopped_at: undefined,
        next_observation_at: new Date(
          Date.parse(transitionedAt) + loaded.evaluation.interval_ms
        ).toISOString(),
        latest_failure_reason: undefined
      }, input.authority);
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
      const status = await this.inspectComparisonSide({
        side: input.side,
        authority: input.authority
      });
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
      return status;
    } catch (error) {
      if (error instanceof PaperTradingSessionError && [
        "paper_trading_comparison_transient_sandbox_cleanup_failed",
        "paper_trading_comparison_transient_sandbox_cleanup_unavailable"
      ].includes(error.code)) {
        this.comparisonTransientCleanupFailures.set(sessionKey, error.code);
      }
      const cleanupAuthority: PaperTradingComparisonRuntimeWriteContext = {
        ...input.authority,
        operation: "stop"
      };
      const cleanupDeadline = new Date(
        Date.now() + loaded.attempt.activation_policy.cleanup_timeout_ms
      ).toISOString();
      await this.stopComparisonSide({
        side: input.side,
        authority: cleanupAuthority,
        deadlineAt: cleanupDeadline,
        reason: "policy_cleanup"
      }).catch(() => this.closeComparisonApiProviderSession(
        sessionKey
      ).catch(() => undefined));
      throw error;
    }
  }

  async stopComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    deadlineAt: string;
    reason: "symmetric_start" | "partial_start_cleanup" | "policy_cleanup" |
      "restart_cleanup" | "handoff_cleanup";
  }): Promise<PaperTradingComparisonSessionSideStatus> {
    this.assertComparisonSessionInput(input.authority, input.side, "stop");
    this.assertComparisonDeadline(input.deadlineAt);
    let loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    this.assertComparisonCleanupDeadline(loaded.attempt, input.deadlineAt);
    const sessionKey = comparisonSessionKey(input.authority);
    if (this.comparisonTransientCleanupFailures.has(sessionKey)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_transient_sandbox_cleanup_unresolved",
        "Paper comparison transient sandbox cleanup remains unresolved."
      );
    }
    const sandbox = loaded.run.sandbox_ref
      ? await this.options.store.getSandbox(loaded.run.sandbox_ref.id)
      : undefined;
    const sideInactive = (loaded.run.runtime_lifecycle_status === "registered" ||
        loaded.run.runtime_lifecycle_status === "stopped") &&
      (loaded.evaluation.status === "not_started" || loaded.evaluation.status === "stopped" ||
        loaded.evidenceState === "paired_checkpoint" &&
          loaded.evaluation.status === "failed") &&
      (!sandbox || sandbox.lifecycle_status === "stopped" ||
        sandbox.lifecycle_status === "removed");
    if (sideInactive) {
      await this.closeComparisonApiProviderSession(sessionKey);
      this.assertComparisonDeadline(input.deadlineAt);
      const status = await this.inspectComparisonSide({
        side: input.side,
        authority: input.authority
      });
      this.assertComparisonDeadline(input.deadlineAt);
      return status;
    }

    this.assertComparisonDeadline(input.deadlineAt);
    if (loaded.run.runtime_lifecycle_status !== "registered" &&
      loaded.run.runtime_lifecycle_status !== "stopped") {
      await this.options.store.recordRunControlAudit(
        comparisonRunControlAuditInput(loaded, input.authority, "stop", input.reason),
        input.authority
      );
    }
    this.assertComparisonDeadline(input.deadlineAt);
    await this.closeComparisonApiProviderSession(sessionKey);
    this.assertComparisonDeadline(input.deadlineAt);
    const linkedSandbox = loaded.run.sandbox_ref
      ? await this.options.store.getSandbox(loaded.run.sandbox_ref.id)
      : undefined;
    this.assertComparisonDeadline(input.deadlineAt);
    if (linkedSandbox && linkedSandbox.lifecycle_status !== "stopped" &&
      linkedSandbox.lifecycle_status !== "removed") {
      const adapter = this.options.sandboxAdapters[linkedSandbox.adapter_kind];
      const stop = adapter.stopArtifactInstance;
      if (!stop) {
        throw new PaperTradingSessionError(
          "sandbox_adapter_method_not_supported",
          "sandbox adapter does not support stopArtifactInstance"
        );
      }
      const observations = await stop.call(adapter, linkedSandbox);
      this.assertComparisonDeadline(input.deadlineAt);
      await this.options.store.stopSandbox({
        sandbox_id: linkedSandbox.sandbox_id,
        stopped_at: observations.stopped_at,
        removed_at: observations.removed_at
      }, observations, input.authority);
    }
    this.assertComparisonDeadline(input.deadlineAt);
    loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    this.assertComparisonDeadline(input.deadlineAt);
    if (loaded.run.runtime_lifecycle_status === "stopped" &&
      (loaded.evaluation.status === "running" || loaded.evaluation.status === "not_started")) {
      await this.options.store.recordPaperTradingEvaluation({
        ...(loaded.evidenceState === "paired_checkpoint"
          ? loaded.evaluation
          : loaded.baseline),
        status: "stopped",
        next_observation_at: undefined,
        stopped_at: new Date().toISOString()
      }, input.authority);
    }
    this.assertComparisonDeadline(input.deadlineAt);
    const status = await this.inspectComparisonSide({
      side: input.side,
      authority: input.authority
    });
    this.assertComparisonDeadline(input.deadlineAt);
    return status;
  }

  async inspectComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
  }): Promise<PaperTradingComparisonSessionSideStatus> {
    this.assertComparisonSessionInput(
      input.authority,
      input.side,
      input.authority.operation
    );
    const loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    const sandbox = loaded.run.sandbox_ref
      ? await this.options.store.getSandbox(loaded.run.sandbox_ref.id)
      : undefined;
    const sessionKey = comparisonSessionKey(input.authority);
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    return {
      role: input.side.role,
      trading_run_ref: { ...input.side.trading_run_ref },
      paper_trading_evaluation_ref: { ...input.side.paper_trading_evaluation_ref },
      ...(sandbox ? {
        sandbox_ref: { record_kind: "sandbox", id: sandbox.sandbox_id },
        sandbox_lifecycle_status: sandbox.lifecycle_status,
        ...(sandbox.started_at ? { sandbox_started_at: sandbox.started_at } : {})
      } : {}),
      runtime_lifecycle_status: loaded.run.runtime_lifecycle_status ?? "unknown",
      evaluation_status: loaded.evaluation.status,
      provider_request_count: this.comparisonProviderRequestCount(sessionKey),
      provider_session_active: provider !== undefined,
      observed_at: new Date().toISOString(),
      authority_status: "not_live"
    };
  }

  async enableComparisonTickAttributionSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonTickIOWriteContext;
    tick: PaperTradingComparisonTickRecord;
  }): Promise<void> {
    if (!paperTradingComparisonTickIOWriteContextHasRuntimeShape(input.authority) ||
      input.authority.operation !== "deliver_market_snapshot" ||
      !paperTradingComparisonTickHasRuntimeShape(input.tick) ||
      input.side.role !== input.authority.role ||
      !paperTradingComparisonRefsEqual(
        input.side.trading_run_ref,
        input.authority.trading_run_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        input.authority.tick_ref,
        {
          record_kind: "paper_trading_comparison_tick",
          id: input.tick.paper_trading_comparison_tick_id
        }
      ) ||
      input.authority.tick_digest !== input.tick.tick_digest) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_tick_attribution_context_mismatch",
        "Comparison tick attribution does not match its role-bound side and tick."
      );
    }

    const loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    const [persistedTick, activationOutcomes, checkpointAttempts, sandbox] =
      await Promise.all([
        this.options.store.getPaperTradingComparisonTick(
          input.tick.paper_trading_comparison_tick_id
        ),
        this.options.store.listPaperTradingComparisonActivationOutcomes(
          loaded.attempt.paper_trading_comparison_activation_attempt_id
        ),
        this.options.store.listPaperTradingComparisonCheckpointAttempts(
          loaded.attempt.paper_trading_comparison_activation_attempt_id
        ),
        loaded.run.sandbox_ref
          ? this.options.store.getSandbox(loaded.run.sandbox_ref.id)
          : Promise.resolve(undefined)
      ]);
    const checkpointAttempt = checkpointAttempts[0];
    const checkpointOutcomes = checkpointAttempt
      ? await this.options.store.listPaperTradingComparisonCheckpointOutcomes(
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
        )
      : [];
    const activationOutcome = activationOutcomes.at(-1);
    const checkpointOutcome = checkpointOutcomes[0];
    const checkpointEvidence = checkpointOutcome?.[input.side.role];
    if (!persistedTick ||
      loaded.evidenceState !== "paired_checkpoint" ||
      loaded.run.runtime_lifecycle_status !== "running" ||
      loaded.evaluation.status !== "running" ||
      sandbox?.lifecycle_status !== "running" ||
      activationOutcome?.outcome_status !== "both_running" ||
      checkpointAttempts.length !== 1 ||
      !checkpointAttempt ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.activation_outcome_ref,
        activationOutcome && {
          record_kind: "paper_trading_comparison_activation_outcome",
          id: activationOutcome.paper_trading_comparison_activation_outcome_id
        }
      ) ||
      checkpointAttempt.activation_outcome_digest !== activationOutcome?.outcome_digest ||
      !paperTradingComparisonRefsEqual(checkpointAttempt.tick_ref, input.authority.tick_ref) ||
      checkpointAttempt.tick_digest !== input.authority.tick_digest ||
      checkpointOutcomes.length !== 1 ||
      checkpointOutcome?.outcome_status !== "paired" ||
      checkpointOutcome.next_action !== "serve_and_acknowledge_current_tick" ||
      !checkpointEvidence ||
      paperTradingComparisonPersistedRecordDigestInput(persistedTick) !==
        paperTradingComparisonPersistedRecordDigestInput(input.tick)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_tick_attribution_state_mismatch",
        "Comparison tick attribution requires the exact running paired-checkpoint side."
      );
    }

    const sessionKey = comparisonSessionKey(input.authority);
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    const binding = this.comparisonGatewayBindings.get(sessionKey);
    const maximumProviderRequestCount = this.comparisonProviderRequestLimits.get(sessionKey);
    if (!provider || !binding || maximumProviderRequestCount === undefined) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_tick_attribution_provider_missing",
        "Comparison tick attribution requires its owned provider session."
      );
    }
    const providerRequestCount = this.comparisonProviderRequestCount(sessionKey);
    if (providerRequestCount < checkpointEvidence.provider_request_count_after ||
      providerRequestCount > maximumProviderRequestCount ||
      maximumProviderRequestCount >
        loaded.attempt.activation_policy.maximum_provider_request_count_per_side) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_tick_attribution_state_mismatch",
        "Comparison tick attribution provider request evidence is inconsistent."
      );
    }

    const enabled: EnabledPaperTradingComparisonTickAttribution = {
      side: structuredClone(input.side),
      authority: structuredClone(input.authority),
      tick: structuredClone(input.tick),
      maximumProviderRequestCount,
      checkpointProviderRequestCount: checkpointEvidence.provider_request_count_after
    };
    const existing = this.enabledComparisonTickAttributions.get(sessionKey);
    if (existing && !sameComparisonTickAttributionEnablement(existing, enabled)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_tick_attribution_state_mismatch",
        "Comparison tick attribution is already enabled for different evidence."
      );
    }
    if (!existing) this.enabledComparisonTickAttributions.set(sessionKey, enabled);
  }

  async advanceComparisonCheckpointSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonCheckpointWriteContext & {
      operation: "advance_tick_view";
    };
    tick: PaperTradingComparisonTickRecord;
  }): Promise<void> {
    this.assertComparisonCheckpointSessionInput(
      input.authority,
      input.side,
      "advance_tick_view"
    );
    if (!paperTradingComparisonTickHasRuntimeShape(input.tick)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_write_context_mismatch",
        "Paper comparison view advance requires one valid checkpoint tick."
      );
    }
    const loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    const [
      checkpointAttempt,
      activationOutcome,
      persistedTick,
      checkpointAttempts,
      currentOutcomes,
      activationOutcomes,
      observations,
      deliveries,
      acknowledgements,
      sandbox
    ] = await Promise.all([
      this.options.store.getPaperTradingComparisonCheckpointAttempt(
        input.authority.checkpoint_attempt_ref.id
      ),
      this.options.store.getPaperTradingComparisonActivationOutcome(
        input.authority.activation_outcome_ref.id
      ),
      this.options.store.getPaperTradingComparisonTick(
        input.tick.paper_trading_comparison_tick_id
      ),
      this.options.store.listPaperTradingComparisonCheckpointAttempts(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        input.authority.checkpoint_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonActivationOutcomes(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingObservations(
        input.side.paper_trading_evaluation_ref.id
      ),
      this.options.store.listPaperTradingComparisonTickDeliveries(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonTickAcknowledgements(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      loaded.run.sandbox_ref
        ? this.options.store.getSandbox(loaded.run.sandbox_ref.id)
        : Promise.resolve(undefined)
    ]);
    const previousAttempt = checkpointAttempts.at(-2);
    const previousOutcomes = previousAttempt
      ? await this.options.store.listPaperTradingComparisonCheckpointOutcomes(
          previousAttempt.paper_trading_comparison_checkpoint_attempt_id
        )
      : [];
    const previousOutcome = previousOutcomes[0];
    const previousEvidence = previousOutcome?.[input.side.role];
    const previousAcknowledgements = previousAttempt
      ? acknowledgements.filter((record) =>
          record.role === input.side.role &&
          record.tick_ref.id === previousAttempt.tick_ref.id)
      : [];
    const previousAcknowledgement = previousAcknowledgements[0];
    const previousDelivery = previousAcknowledgement
      ? deliveries.find((record) =>
          record.paper_trading_comparison_tick_delivery_id ===
            previousAcknowledgement.delivery_ref.id)
      : undefined;
    const currentTickDeliveries = deliveries.filter((record) =>
      record.role === input.side.role &&
      record.tick_ref.id === input.tick.paper_trading_comparison_tick_id);
    const currentTickAcknowledgements = acknowledgements.filter((record) =>
      record.role === input.side.role &&
      record.tick_ref.id === input.tick.paper_trading_comparison_tick_id);
    const checkpointSide = checkpointAttempt?.[input.side.role];
    if (!checkpointAttempt || !activationOutcome || !persistedTick ||
      !previousAttempt || !previousOutcome || !previousEvidence ||
      !previousAcknowledgement || !previousDelivery || !checkpointSide) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_reference_not_found",
        "Paper comparison view advance references incomplete checkpoint evidence."
      );
    }
    if (Date.now() > Date.parse(checkpointAttempt.checkpoint_deadline_at)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_deadline_exceeded",
        "Paper comparison view advance exceeded its checkpoint deadline."
      );
    }
    if (checkpointAttempt.checkpoint_sequence <= 1 ||
      checkpointAttempts.at(-1)?.paper_trading_comparison_checkpoint_attempt_id !==
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
      checkpointAttempt.checkpoint_sequence !== previousAttempt.checkpoint_sequence + 1 ||
      currentOutcomes.length !== 0 || previousOutcomes.length !== 1 ||
      previousOutcome.outcome_status !== "paired" ||
      previousEvidence.observation_status === "failed" ||
      checkpointAttempt.previous_checkpoint_outcome_ref?.id !==
        previousOutcome.paper_trading_comparison_checkpoint_outcome_id ||
      checkpointAttempt.previous_checkpoint_outcome_digest !== previousOutcome.outcome_digest ||
      checkpointAttempt.tick_ref.id !== input.tick.paper_trading_comparison_tick_id ||
      checkpointAttempt.tick_digest !== input.tick.tick_digest ||
      input.tick.sequence !== checkpointAttempt.checkpoint_sequence ||
      paperTradingComparisonPersistedRecordDigestInput(input.tick) !==
        paperTradingComparisonPersistedRecordDigestInput(persistedTick) ||
      checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id !==
        input.authority.checkpoint_attempt_ref.id ||
      checkpointAttempt.attempt_digest !== input.authority.checkpoint_attempt_digest ||
      checkpointAttempt.paper_trading_comparison_activation_ref.id !==
        input.authority.paper_trading_comparison_activation_ref.id ||
      checkpointAttempt.paper_trading_comparison_activation_digest !==
        input.authority.paper_trading_comparison_activation_digest ||
      checkpointAttempt.paper_trading_comparison_activation_attempt_ref.id !==
        input.authority.paper_trading_comparison_activation_attempt_ref.id ||
      checkpointAttempt.paper_trading_comparison_activation_attempt_digest !==
        input.authority.paper_trading_comparison_activation_attempt_digest ||
      checkpointAttempt.activation_outcome_ref.id !==
        input.authority.activation_outcome_ref.id ||
      checkpointAttempt.activation_outcome_digest !==
        input.authority.activation_outcome_digest ||
      activationOutcome.paper_trading_comparison_activation_outcome_id !==
        input.authority.activation_outcome_ref.id ||
      activationOutcome.outcome_digest !== input.authority.activation_outcome_digest ||
      activationOutcome.outcome_status !== "both_running" ||
      activationOutcomes.at(-1)?.paper_trading_comparison_activation_outcome_id !==
        activationOutcome.paper_trading_comparison_activation_outcome_id ||
      checkpointSide.role !== input.side.role ||
      checkpointSide.trading_run_ref.id !== input.side.trading_run_ref.id ||
      checkpointSide.paper_trading_evaluation_ref.id !==
        input.side.paper_trading_evaluation_ref.id ||
      checkpointSide.evaluation_record_digest !== comparisonDigest(
        paperTradingComparisonEvaluationRecordDigestInput(loaded.evaluation)
      ) ||
      checkpointSide.observation_chain_digest !== comparisonDigest(
        paperTradingComparisonObservationChainDigestInput(observations)
      ) ||
      observations.length !== checkpointAttempt.checkpoint_sequence - 1 ||
      loaded.evidenceState !== "paired_checkpoint" ||
      loaded.run.runtime_lifecycle_status !== "running" ||
      loaded.evaluation.status !== "running" ||
      sandbox?.lifecycle_status !== "running" ||
      previousAcknowledgements.length !== 1 ||
      previousAcknowledgement.paper_trading_comparison_activation_attempt_ref.id !==
        loaded.attempt.paper_trading_comparison_activation_attempt_id ||
      previousAcknowledgement.paper_trading_comparison_activation_attempt_digest !==
        loaded.attempt.attempt_digest ||
      previousAcknowledgement.trading_run_ref.id !== loaded.run.trading_run_id ||
      previousAcknowledgement.tick_digest !== previousAttempt.tick_digest ||
      previousAcknowledgement.tick_sequence !== previousAttempt.checkpoint_sequence ||
      previousDelivery.delivery_digest !== previousAcknowledgement.delivery_digest ||
      previousDelivery.role !== input.side.role ||
      previousDelivery.trading_run_ref.id !== loaded.run.trading_run_id ||
      previousDelivery.tick_ref.id !== previousAttempt.tick_ref.id ||
      previousDelivery.tick_digest !== previousAttempt.tick_digest ||
      previousAcknowledgement.provider_request_count_at_acknowledgement <
        previousDelivery.provider_request_count_at_delivery ||
      (previousOutcome.checkpoint_sequence > 1 && (
        previousEvidence.tick_acknowledgement_ref?.id !==
          previousAcknowledgement.paper_trading_comparison_tick_acknowledgement_id ||
        previousEvidence.tick_acknowledgement_digest !==
          previousAcknowledgement.acknowledgement_digest
      )) || currentTickDeliveries.length > 0 || currentTickAcknowledgements.length > 0) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_state_mismatch",
        "Paper comparison view advance does not match the open repeated checkpoint."
      );
    }

    const advanced: AdvancedPaperTradingComparisonCheckpointView = {
      authority: structuredClone(input.authority),
      tick: structuredClone(input.tick)
    };
    const existing = this.advancedComparisonCheckpointViews.get(
      comparisonSessionKey(input.authority)
    );
    if (existing) {
      if (sameAdvancedComparisonCheckpointView(existing, advanced)) {
        return;
      }
      if (existing.authority.checkpoint_attempt_ref.id !==
          previousAttempt.paper_trading_comparison_checkpoint_attempt_id ||
        existing.authority.checkpoint_attempt_digest !== previousAttempt.attempt_digest ||
        existing.tick.paper_trading_comparison_tick_id !== previousAttempt.tick_ref.id ||
        existing.tick.tick_digest !== previousAttempt.tick_digest) {
        throw new PaperTradingSessionError(
          "paper_trading_comparison_checkpoint_state_mismatch",
          "Paper comparison provider view was already advanced with different evidence."
        );
      }
    }

    const sessionKey = comparisonSessionKey(input.authority);
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    const binding = this.comparisonGatewayBindings.get(sessionKey);
    const maximumProviderRequestCount = this.comparisonProviderRequestLimits.get(sessionKey);
    const providerRequestCount = this.comparisonProviderRequestCount(sessionKey);
    const currentAttribution = this.enabledComparisonTickAttributions.get(sessionKey);
    if (!provider || !binding || maximumProviderRequestCount === undefined ||
      !currentAttribution ||
      providerRequestCount < checkpointSide.provider_request_count_before ||
      providerRequestCount <
        previousAcknowledgement.provider_request_count_at_acknowledgement ||
      providerRequestCount > maximumProviderRequestCount ||
      maximumProviderRequestCount >
        loaded.attempt.activation_policy.maximum_provider_request_count_per_side ||
      currentAttribution.tick.paper_trading_comparison_tick_id !==
        previousAttempt.tick_ref.id ||
      currentAttribution.tick.tick_digest !== previousAttempt.tick_digest ||
      currentAttribution.side.role !== input.side.role ||
      currentAttribution.side.trading_run_ref.id !== loaded.run.trading_run_id) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_state_mismatch",
        "Paper comparison view advance provider state is missing or inconsistent.",
        {
          provider_session_active: provider !== undefined,
          gateway_binding_present: binding !== undefined,
          provider_request_count: providerRequestCount,
          checkpoint_provider_request_count:
            checkpointSide.provider_request_count_before,
          previous_acknowledgement_provider_request_count:
            previousAcknowledgement.provider_request_count_at_acknowledgement,
          maximum_provider_request_count: maximumProviderRequestCount,
          current_attribution_tick_id:
            currentAttribution?.tick.paper_trading_comparison_tick_id,
          expected_previous_tick_id: previousAttempt.tick_ref.id
        }
      );
    }

    const nextMarketData = new ComparisonMarketDataView({
      source: binding.marketData,
      tick: input.tick
    });
    if (Date.now() > Date.parse(checkpointAttempt.checkpoint_deadline_at)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_deadline_exceeded",
        "Paper comparison view advance completed after its checkpoint deadline."
      );
    }
    const tickAuthority: PaperTradingComparisonTickIOWriteContext = {
      paper_trading_comparison_activation_ref: {
        ...input.authority.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        input.authority.paper_trading_comparison_activation_digest,
      paper_trading_comparison_activation_attempt_ref: {
        ...input.authority.paper_trading_comparison_activation_attempt_ref
      },
      paper_trading_comparison_activation_attempt_digest:
        input.authority.paper_trading_comparison_activation_attempt_digest,
      role: input.side.role,
      trading_run_ref: { ...input.side.trading_run_ref },
      tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: input.tick.paper_trading_comparison_tick_id
      },
      tick_digest: input.tick.tick_digest,
      operation: "deliver_market_snapshot"
    };
    binding.marketData = nextMarketData;
    this.enabledComparisonTickAttributions.set(sessionKey, {
      side: structuredClone(input.side),
      authority: tickAuthority,
      tick: structuredClone(input.tick),
      maximumProviderRequestCount,
      checkpointProviderRequestCount: checkpointSide.provider_request_count_before
    });
    this.advancedComparisonCheckpointViews.set(sessionKey, advanced);
  }

  async prepareComparisonCheckpointSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonCheckpointWriteContext;
    tick: PaperTradingComparisonTickRecord;
    deadlineAt: string;
    maximumProviderRequestCount: number;
    signal: AbortSignal;
  }): Promise<PreparedPaperTradingComparisonCheckpointSide> {
    this.assertComparisonCheckpointSessionInput(input.authority, input.side);
    if (!Number.isInteger(input.maximumProviderRequestCount) ||
      input.maximumProviderRequestCount <= 0) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_limit_invalid",
        "Paper comparison provider request limit must be a positive integer."
      );
    }
    this.assertComparisonCheckpointEffectOpen(input.signal, input.deadlineAt);
    const loaded = await this.loadComparisonSessionSide(
      input.side,
      input.authority,
      { allowCommittedCheckpoint: true }
    );
    const [checkpointAttempt, activationOutcome, persistedTick, checkpointAttempts,
      checkpointOutcomes, activationOutcomes, existingObservations,
      tickDeliveries, tickAcknowledgements] = await Promise.all([
      this.options.store.getPaperTradingComparisonCheckpointAttempt(
        input.authority.checkpoint_attempt_ref.id
      ),
      this.options.store.getPaperTradingComparisonActivationOutcome(
        input.authority.activation_outcome_ref.id
      ),
      this.options.store.getPaperTradingComparisonTick(input.tick.paper_trading_comparison_tick_id),
      this.options.store.listPaperTradingComparisonCheckpointAttempts(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        input.authority.checkpoint_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonActivationOutcomes(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingObservations(
        input.side.paper_trading_evaluation_ref.id
      ),
      this.options.store.listPaperTradingComparisonTickDeliveries(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      ),
      this.options.store.listPaperTradingComparisonTickAcknowledgements(
        input.authority.paper_trading_comparison_activation_attempt_ref.id
      )
    ]);
    if (!checkpointAttempt || !activationOutcome || !persistedTick) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_reference_not_found",
        "Paper comparison checkpoint session references incomplete evidence."
      );
    }
    const checkpointSide = checkpointAttempt[input.authority.role];
    if (
      input.deadlineAt !== checkpointAttempt.checkpoint_deadline_at ||
      input.tick.paper_trading_comparison_tick_id !== checkpointAttempt.tick_ref.id ||
      input.tick.tick_digest !== checkpointAttempt.tick_digest ||
      paperTradingComparisonPersistedRecordDigestInput(input.tick) !==
        paperTradingComparisonPersistedRecordDigestInput(persistedTick) ||
      checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id !==
        input.authority.checkpoint_attempt_ref.id ||
      checkpointAttempt.attempt_digest !== input.authority.checkpoint_attempt_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.paper_trading_comparison_activation_ref,
        input.authority.paper_trading_comparison_activation_ref
      ) ||
      checkpointAttempt.paper_trading_comparison_activation_digest !==
        input.authority.paper_trading_comparison_activation_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.paper_trading_comparison_activation_attempt_ref,
        input.authority.paper_trading_comparison_activation_attempt_ref
      ) ||
      checkpointAttempt.paper_trading_comparison_activation_attempt_digest !==
        input.authority.paper_trading_comparison_activation_attempt_digest ||
      !paperTradingComparisonRefsEqual(
        checkpointAttempt.activation_outcome_ref,
        input.authority.activation_outcome_ref
      ) ||
      checkpointAttempt.activation_outcome_digest !== input.authority.activation_outcome_digest ||
      activationOutcome.paper_trading_comparison_activation_outcome_id !==
        input.authority.activation_outcome_ref.id ||
      activationOutcome.outcome_digest !== input.authority.activation_outcome_digest ||
      activationOutcome.outcome_status !== "both_running" ||
      checkpointSide.role !== input.side.role ||
      !paperTradingComparisonRefsEqual(
        checkpointSide.trading_run_ref,
        input.side.trading_run_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        checkpointSide.paper_trading_evaluation_ref,
        input.side.paper_trading_evaluation_ref
      ) ||
      checkpointSide.evaluation_record_digest !== comparisonDigest(
        paperTradingComparisonEvaluationRecordDigestInput(loaded.evaluation)
      ) ||
      checkpointSide.observation_chain_digest !== comparisonDigest(
        paperTradingComparisonObservationChainDigestInput(existingObservations)
      ) ||
      loaded.evaluation.observation_count !== checkpointAttempt.checkpoint_sequence - 1
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_write_context_mismatch",
        "Paper comparison checkpoint context does not match the frozen side and tick."
      );
    }
    if (
      checkpointAttempts.at(-1)?.paper_trading_comparison_checkpoint_attempt_id !==
        checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
      checkpointOutcomes.length !== 0 ||
      activationOutcomes.at(-1)?.paper_trading_comparison_activation_outcome_id !==
        activationOutcome.paper_trading_comparison_activation_outcome_id ||
      loaded.evidenceState !== (checkpointAttempt.checkpoint_sequence === 1
        ? "zero"
        : "paired_checkpoint") ||
      loaded.run.runtime_lifecycle_status !== "running" ||
      loaded.evaluation.status !== "running"
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_state_mismatch",
        "Paper comparison checkpoint side is no longer open and running."
      );
    }
    if (input.maximumProviderRequestCount >
      loaded.attempt.activation_policy.maximum_provider_request_count_per_side) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_limit_mismatch",
        "Paper comparison provider request limit exceeds the frozen attempt policy."
      );
    }

    const sessionKey = comparisonSessionKey(input.authority);
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    const binding = this.comparisonGatewayBindings.get(sessionKey);
    const providerRequestCountBefore = this.comparisonProviderRequestCount(sessionKey);
    if (providerRequestCountBefore > input.maximumProviderRequestCount) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_budget_exceeded",
        "Paper comparison provider request budget was exceeded before checkpoint preparation."
      );
    }
    if (!provider || !binding ||
      providerRequestCountBefore < checkpointSide.provider_request_count_before) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_state_mismatch",
        "Paper comparison checkpoint provider session is missing or inconsistent."
      );
    }
    let tickAcknowledgement: PaperTradingComparisonTickAcknowledgementRecord | undefined;
    if (checkpointAttempt.checkpoint_sequence > 1) {
      const roleAcknowledgements = tickAcknowledgements.filter((record) =>
        record.role === input.side.role &&
        record.tick_ref.id === input.tick.paper_trading_comparison_tick_id);
      if (roleAcknowledgements.length === 0) {
        throw new PaperTradingSessionError(
          "paper_trading_comparison_tick_acknowledgement_required",
          "Repeated paper comparison preparation requires its persisted tick acknowledgement."
        );
      }
      tickAcknowledgement = roleAcknowledgements[0];
      const delivery = tickAcknowledgement
        ? tickDeliveries.find((record) =>
            record.paper_trading_comparison_tick_delivery_id ===
              tickAcknowledgement!.delivery_ref.id)
        : undefined;
      const advanced = this.advancedComparisonCheckpointViews.get(sessionKey);
      const enabled = this.enabledComparisonTickAttributions.get(sessionKey);
      if (roleAcknowledgements.length !== 1 || !tickAcknowledgement || !delivery ||
        !advanced || !enabled ||
        advanced.authority.checkpoint_attempt_ref.id !==
          checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
        advanced.authority.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest ||
        advanced.tick.paper_trading_comparison_tick_id !==
          input.tick.paper_trading_comparison_tick_id ||
        advanced.tick.tick_digest !== input.tick.tick_digest ||
        enabled.tick.paper_trading_comparison_tick_id !==
          input.tick.paper_trading_comparison_tick_id ||
        enabled.tick.tick_digest !== input.tick.tick_digest ||
        tickAcknowledgement.paper_trading_comparison_activation_attempt_ref.id !==
          loaded.attempt.paper_trading_comparison_activation_attempt_id ||
        tickAcknowledgement.paper_trading_comparison_activation_attempt_digest !==
          loaded.attempt.attempt_digest ||
        tickAcknowledgement.trading_run_ref.id !== loaded.run.trading_run_id ||
        tickAcknowledgement.tick_digest !== input.tick.tick_digest ||
        tickAcknowledgement.tick_sequence !== checkpointAttempt.checkpoint_sequence ||
        delivery.delivery_digest !== tickAcknowledgement.delivery_digest ||
        delivery.role !== input.side.role ||
        delivery.trading_run_ref.id !== loaded.run.trading_run_id ||
        delivery.tick_ref.id !== input.tick.paper_trading_comparison_tick_id ||
        delivery.tick_digest !== input.tick.tick_digest ||
        delivery.tick_sequence !== checkpointAttempt.checkpoint_sequence ||
        tickAcknowledgement.provider_request_count_at_acknowledgement <
          delivery.provider_request_count_at_delivery ||
        tickAcknowledgement.provider_request_count_at_acknowledgement >
          providerRequestCountBefore ||
        Date.parse(tickAcknowledgement.acknowledged_at) >
          Date.parse(checkpointAttempt.checkpoint_deadline_at)) {
        throw new PaperTradingSessionError(
          "paper_trading_comparison_tick_acknowledgement_mismatch",
          "Repeated paper comparison acknowledgement does not match the active view."
        );
      }
    }
    const sandbox = loaded.run.sandbox_ref
      ? await this.options.store.getSandbox(loaded.run.sandbox_ref.id)
      : undefined;
    if (!sandbox || sandbox.lifecycle_status !== "running") {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_state_mismatch",
        "Paper comparison checkpoint requires its exact running sandbox."
      );
    }
    const adapter = this.options.sandboxAdapters[sandbox.adapter_kind];
    if (!adapter.getArtifactInstanceLogs) {
      throw new PaperTradingSessionError(
        "sandbox_adapter_method_not_supported",
        "sandbox adapter does not support getArtifactInstanceLogs"
      );
    }

    this.assertComparisonCheckpointEffectOpen(input.signal, input.deadlineAt);
    const observations = await adapter.getArtifactInstanceLogs(sandbox);
    this.assertComparisonCheckpointEffectOpen(input.signal, input.deadlineAt);
    await this.options.store.recordSandboxObservations(
      sandbox.sandbox_id,
      observations,
      input.authority
    );
    this.assertComparisonCheckpointEffectOpen(input.signal, input.deadlineAt);
    const providerRequestCountAfterRefresh = this.comparisonProviderRequestCount(sessionKey);
    if (providerRequestCountAfterRefresh > input.maximumProviderRequestCount) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_budget_exceeded",
        "Paper comparison provider request budget was exceeded during checkpoint preparation."
      );
    }
    const candidate = await this.options.store.getCandidateForTradingRun(
      input.side.trading_run_ref.id
    );
    if (!candidate) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_side_reference_not_found",
        "Paper comparison checkpoint candidate was not reloaded after sandbox refresh."
      );
    }
    const prepared = await preparePaperTradingComparisonCheckpointEvidence({
      store: this.options.store,
      role: input.side.role,
      candidate,
      evaluation: loaded.evaluation,
      tick: input.tick,
      checkpointAttempt,
      tickAcknowledgement,
      gatewayRuntimeBinding: binding,
      intervalMs: this.intervalMs
    });
    this.assertComparisonCheckpointEffectOpen(input.signal, input.deadlineAt);
    const providerRequestCountAfter = this.comparisonProviderRequestCount(sessionKey);
    if (providerRequestCountAfter < providerRequestCountAfterRefresh ||
      providerRequestCountAfter > input.maximumProviderRequestCount) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_provider_request_budget_exceeded",
        "Paper comparison provider request total is invalid after checkpoint preparation."
      );
    }
    const withoutDigest = {
      role: input.side.role,
      ledger_inputs: prepared.ledger_inputs,
      ledger_outcomes: prepared.ledger_outcomes,
      observation: prepared.observation,
      evaluation: prepared.evaluation,
      consumed_event_count: prepared.consumed_event_count,
      provider_request_count_after: providerRequestCountAfter
    };
    return {
      ...withoutDigest,
      preparation_digest: comparisonCheckpointPreparationDigest(withoutDigest)
    };
  }

  async stop(tradingRunId: string): Promise<PaperTradingEvaluationRecord | undefined> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    if (!candidate) {
      return undefined;
    }
    const run = await this.options.store.getTradingRun(tradingRunId);
    if (!run) {
      throw new PaperTradingSessionError("trading_run_not_found", "trading run was not found");
    }
    const existingBeforeDrain = await this.options.store
      .getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const commitment = existingBeforeDrain?.paper_trading_evaluation_commitment_ref
      ? await this.options.store.getPaperTradingEvaluationCommitment(
          existingBeforeDrain.paper_trading_evaluation_commitment_ref.id
        )
      : undefined;
    if (
      run.paper_evidence_purpose === "qualification" ||
      commitment?.evidence_purpose === "qualification"
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_authority_required",
        "Qualification PaperTradingSession stop requires verified comparison authority."
      );
    }
    if (
      run.paper_evidence_purpose &&
      commitment?.evidence_purpose &&
      run.paper_evidence_purpose !== commitment.evidence_purpose
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_evidence_purpose_mismatch",
        "PaperTradingSession stop requires matching persisted TradingRun and commitment purposes."
      );
    }
    this.runner.stop(tradingRunId);
    this.activeSessions.delete(tradingRunId);
    const observationDrained = await this.runner.drain(
      tradingRunId,
      this.observationDrainTimeoutMs
    );
    if (!observationDrained) {
      await Promise.allSettled([
        this.stopApiProviderSession(tradingRunId),
        this.stopLinkedSandbox(tradingRunId)
      ]);
      throw new PaperTradingSessionError(
        "paper_trading_observation_drain_timeout",
        "PaperTradingSession stop timed out while draining the active observation.",
        { trading_run_id: tradingRunId }
      );
    }
    const candidateVersionId = candidate.candidate_version.candidate_version_id;
    await this.options.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
      idempotencyKey: `trading-run-stop:${tradingRunId}:${candidateVersionId}`,
      candidateId: candidate.candidate_id,
      candidateVersionId,
      tradingRunId,
      action: "stop",
      lifecycleStatus: "stopped",
      actorId: "runtime-api",
      reasonSummary: "Operator requested trading run stop.",
      message: "Trading run stop recorded."
    }));
    await this.stopTerminalSession(tradingRunId);
    const existing = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(
      tradingRunId
    );
    if (!existing || existing.status === "invalidated") {
      return existing;
    }
    return this.options.store.recordPaperTradingEvaluation({
      ...existing,
      status: "stopped",
      next_observation_at: undefined,
      stopped_at: new Date().toISOString()
    });
  }

  async stopAllSessions(): Promise<void> {
    const tradingRunIds = new Set([...this.activeSessions, ...this.apiProviderSessions.keys()]);
    for (const tradingRunId of tradingRunIds) {
      this.runner.stop(tradingRunId);
      this.activeSessions.delete(tradingRunId);
      await Promise.allSettled([
        this.stopApiProviderSession(tradingRunId),
        this.stopLinkedSandbox(tradingRunId)
      ]);
    }
    await this.runner.drain();
  }

  async recoverRunningEvaluations(): Promise<PaperTradingRecoveryOutcome[]> {
    const latestByTradingRun = new Map<string, PaperTradingEvaluationRecord>();
    for (const evaluation of await this.options.store.listPaperTradingEvaluations()) {
      const tradingRunId = evaluation.trading_run_ref.id;
      const existing = latestByTradingRun.get(tradingRunId);
      if (!existing || paperTradingEvaluationComesAfter(evaluation, existing)) {
        latestByTradingRun.set(tradingRunId, evaluation);
      }
    }

    const evaluations = [...latestByTradingRun.values()].sort((left, right) =>
      left.started_at.localeCompare(right.started_at) ||
      left.paper_trading_evaluation_id.localeCompare(right.paper_trading_evaluation_id)
    );
    const outcomes: PaperTradingRecoveryOutcome[] = [];
    for (const evaluation of evaluations) {
      const tradingRunId = evaluation.trading_run_ref.id;
      if (evaluation.status !== "running") {
        outcomes.push({ tradingRunId, status: "skipped", reason: "evaluation_not_running" });
        continue;
      }

      try {
        const run = await this.options.store.getTradingRun(tradingRunId);
        const commitment = evaluation.paper_trading_evaluation_commitment_ref
          ? await this.options.store.getPaperTradingEvaluationCommitment(
              evaluation.paper_trading_evaluation_commitment_ref.id
            )
          : undefined;
        const runEvidencePurpose = run?.paper_evidence_purpose;
        const commitmentEvidencePurpose = commitment?.evidence_purpose;
        if (
          runEvidencePurpose &&
          commitmentEvidencePurpose &&
          runEvidencePurpose !== commitmentEvidencePurpose
        ) {
          const error =
            "PaperTradingSession recovery purpose does not match the persisted commitment.";
          await this.persistRecoveryFailure(evaluation, error);
          outcomes.push({
            tradingRunId,
            status: "failed",
            error
          });
          continue;
        }
        const evidencePurpose = runEvidencePurpose ??
          commitmentEvidencePurpose ??
          "research_feedback";
        if (evidencePurpose === "qualification") {
          outcomes.push({ tradingRunId, status: "skipped", reason: "qualification" });
          continue;
        }
        const prepared = await this.prepare({
          candidateId: evaluation.candidate_ref.id,
          candidateVersionId: evaluation.candidate_version_ref.id,
          tradingRunId,
          evidencePurpose,
          clock: "external"
        });

        const defaultCandidate = await this.options.store.getCandidate(evaluation.candidate_ref.id);
        const clock: PaperTradingSessionClock =
          defaultCandidate?.candidate_id === evaluation.candidate_ref.id &&
          defaultCandidate.candidate_version.candidate_version_id === evaluation.candidate_version_ref.id &&
          defaultCandidate.runtime.ref.id === tradingRunId
            ? "scheduled"
            : "external";
        await this.activate({ ...prepared, clock });
        if (clock === "scheduled") {
          await this.schedule(tradingRunId);
        }
        outcomes.push({ tradingRunId, status: "recovered", clock });
      } catch (error) {
        if (
          error instanceof PaperTradingSessionError &&
          error.code === "paper_trading_evaluation_invalidated"
        ) {
          const invalidated = await this.options.store
            .getLatestPaperTradingEvaluationForTradingRun(tradingRunId)
            .catch(() => undefined);
          if (invalidated?.status === "invalidated" && invalidated.invalidation_reason) {
            outcomes.push({
              tradingRunId,
              status: "invalidated",
              reason: invalidated.invalidation_reason
            });
            continue;
          }
        }
        const recoveryError = error instanceof Error ? error.message : String(error);
        await this.persistRecoveryFailure(evaluation, recoveryError);
        outcomes.push({
          tradingRunId,
          status: "failed",
          error: recoveryError
        });
      }
    }
    return outcomes;
  }

  private async persistRecoveryFailure(
    evaluation: PaperTradingEvaluationRecord,
    failureReason: string
  ): Promise<void> {
    const tradingRunId = evaluation.trading_run_ref.id;
    await this.stopTerminalSession(tradingRunId).catch(() => undefined);
    const latest = await this.options.store
      .getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    if (!latest || latest.status !== "running") {
      return;
    }
    await this.options.store.recordPaperTradingEvaluation({
      ...latest,
      status: "failed",
      next_observation_at: undefined,
      latest_failure_reason: failureReason
    });
  }

  private gatewayBinding(marketData: GatewayMarketDataPort = this.options.marketData): GatewayRuntimeBinding {
    const binding = createGatewayRuntimeBinding({ environment: "paper", marketData });
    if (binding.status === "disabled") {
      throw new PaperTradingSessionError("gateway_runtime_binding_disabled", "Paper Gateway binding is disabled.");
    }
    return binding;
  }

  private assertComparisonSessionInput(
    authority: PaperTradingComparisonRuntimeWriteContext,
    side: PaperTradingComparisonActivationSide,
    operation: "start" | "stop"
  ): void {
    if (!paperTradingComparisonRuntimeWriteContextHasRuntimeShape(authority)) {
      throw new PaperTradingSessionError(
        "invalid_paper_trading_comparison_runtime_write_context",
        "Paper comparison session requires one valid runtime write context."
      );
    }
    if (authority.operation !== operation || authority.role !== side.role) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_runtime_write_context_mismatch",
        "Paper comparison session context does not match its side operation."
      );
    }
  }

  private assertComparisonCheckpointSessionInput(
    authority: PaperTradingComparisonCheckpointWriteContext,
    side: PaperTradingComparisonActivationSide,
    operation: PaperTradingComparisonCheckpointWriteContext["operation"] =
      "refresh_sandbox_evidence"
  ): void {
    if (!paperTradingComparisonCheckpointWriteContextHasRuntimeShape(authority)) {
      throw new PaperTradingSessionError(
        "invalid_paper_trading_comparison_checkpoint_write_context",
        "Paper comparison checkpoint requires one valid write context."
      );
    }
    if (authority.operation !== operation || authority.role !== side.role) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_write_context_mismatch",
        "Paper comparison checkpoint context does not match its side operation."
      );
    }
  }

  private assertComparisonCheckpointEffectOpen(
    signal: AbortSignal,
    deadlineAt: string
  ): void {
    if (signal.aborted) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_aborted",
        "Paper comparison checkpoint preparation was aborted."
      );
    }
    if (!isExactIsoTimestamp(deadlineAt)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_deadline_invalid",
        "Paper comparison checkpoint deadline must be an exact ISO timestamp."
      );
    }
    if (Date.now() > Date.parse(deadlineAt)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_checkpoint_deadline_exceeded",
        "Paper comparison checkpoint deadline was exceeded."
      );
    }
  }

  private assertComparisonEffectOpen(signal: AbortSignal, deadlineAt: string): void {
    if (signal.aborted) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_activation_aborted",
        "Paper comparison activation was aborted."
      );
    }
    this.assertComparisonDeadline(deadlineAt);
  }

  private assertComparisonDeadline(deadlineAt: string): void {
    if (!isExactIsoTimestamp(deadlineAt)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_deadline_invalid",
        "Paper comparison session deadline must be an exact ISO timestamp."
      );
    }
    if (Date.now() > Date.parse(deadlineAt)) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_deadline_exceeded",
        "Paper comparison session deadline was exceeded."
      );
    }
  }

  private assertComparisonCleanupDeadline(
    attempt: PaperTradingComparisonActivationAttemptRecord,
    deadlineAt: string
  ): void {
    if (Date.parse(deadlineAt) - Date.now() >
      attempt.activation_policy.cleanup_timeout_ms) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_cleanup_deadline_mismatch",
        "Paper comparison cleanup deadline exceeds the frozen attempt policy."
      );
    }
  }

  private async loadComparisonSessionSide(
    side: PaperTradingComparisonActivationSide,
    authority: PaperTradingComparisonRuntimeWriteContext |
      PaperTradingComparisonCheckpointWriteContext |
      PaperTradingComparisonTickIOWriteContext,
    options: { allowCommittedCheckpoint?: boolean } = {}
  ): Promise<LoadedPaperTradingComparisonSessionSide> {
    const [activation, attempt] = await Promise.all([
      this.options.store.getPaperTradingComparisonActivation(
        authority.paper_trading_comparison_activation_ref.id
      ),
      this.options.store.getPaperTradingComparisonActivationAttempt(
        authority.paper_trading_comparison_activation_attempt_ref.id
      )
    ]);
    if (!activation || !attempt) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_runtime_write_context_not_found",
        "Paper comparison activation or attempt was not found."
      );
    }
    const activationSide = activation[authority.role];
    const attemptSide = attempt[authority.role];
    const attempts = await this.options.store.listPaperTradingComparisonActivationAttempts(
      activation.paper_trading_comparison_activation_id
    );
    if (
      authority.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      authority.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      authority.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      authority.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      attempt.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      attempt.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      attempts.at(-1)?.paper_trading_comparison_activation_attempt_id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      !comparisonActivationSidesEqual(side, activationSide) ||
      !comparisonActivationSidesEqual(side, attemptSide)
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_runtime_write_context_mismatch",
        "Paper comparison session context does not match the latest frozen side attempt."
      );
    }

    const [candidate, run, commitment, evaluation] = await Promise.all([
      this.options.store.getCandidateForTradingRun(side.trading_run_ref.id),
      this.options.store.getTradingRun(side.trading_run_ref.id),
      this.options.store.getPaperTradingEvaluationCommitment(
        side.paper_trading_evaluation_commitment_ref.id
      ),
      this.options.store.getPaperTradingEvaluation(side.paper_trading_evaluation_ref.id)
    ]);
    if (!candidate || !run || !commitment || !evaluation) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_side_reference_not_found",
        "Paper comparison side references an incomplete runtime graph."
      );
    }
    const systemCode = await this.options.store.getSystemCode(commitment.system_code_ref.id);
    if (!systemCode) {
      throw new PaperTradingSessionError(
        "system_code_not_found",
        `system code ${commitment.system_code_ref.id} not found`
      );
    }
    const baseline = paperTradingComparisonBaselineEvaluation(
      commitment,
      side.paper_trading_evaluation_ref
    );
    const expectedStatus = evaluation.status === "not_started" ||
      evaluation.status === "running" || evaluation.status === "stopped"
      ? evaluation.status
      : undefined;
    const hasZeroEvidenceState = expectedStatus !== undefined &&
      paperTradingComparisonEvaluationHasZeroEvidenceActivationState(
        evaluation,
        baseline,
        expectedStatus
      );
    const hasCommittedCheckpointState = options.allowCommittedCheckpoint === true &&
      await this.comparisonSessionSideHasCommittedCheckpointState({
        attempt,
        side,
        run,
        evaluation,
        baseline
      });
    if (
      commitment.evidence_purpose !== "qualification" ||
      run.paper_evidence_purpose !== "qualification" ||
      run.trading_run_id !== side.trading_run_ref.id ||
      candidate.candidate_id !== commitment.candidate_ref.id ||
      candidate.candidate_version.candidate_version_id !==
        commitment.candidate_version_ref.id ||
      !paperTradingComparisonRefsEqual(run.candidate_ref, commitment.candidate_ref) ||
      !paperTradingComparisonRefsEqual(
        run.candidate_version_ref,
        commitment.candidate_version_ref
      ) ||
      !paperTradingComparisonRefsEqual(run.system_code_ref, commitment.system_code_ref) ||
      !paperTradingComparisonRefsEqual(evaluation.candidate_ref, commitment.candidate_ref) ||
      !paperTradingComparisonRefsEqual(
        evaluation.candidate_version_ref,
        commitment.candidate_version_ref
      ) ||
      !paperTradingComparisonRefsEqual(evaluation.trading_run_ref, commitment.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(
        evaluation.paper_trading_evaluation_commitment_ref,
        side.paper_trading_evaluation_commitment_ref
      ) ||
      systemCode.system_code_id !== commitment.system_code_ref.id ||
      systemCode.artifact_digest !== commitment.system_code_artifact_digest ||
      (!hasZeroEvidenceState && !hasCommittedCheckpointState)
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_side_state_mismatch",
        "Paper comparison side runtime graph is not exact zero-evidence qualification state."
      );
    }
    return {
      attempt,
      candidate,
      run,
      commitment,
      evaluation,
      baseline,
      evidenceState: hasCommittedCheckpointState ? "paired_checkpoint" : "zero",
      systemCode
    };
  }

  private async comparisonSessionSideHasCommittedCheckpointState(input: {
    attempt: PaperTradingComparisonActivationAttemptRecord;
    side: PaperTradingComparisonActivationSide;
    run: TradingRunRecord;
    evaluation: PaperTradingEvaluationRecord;
    baseline: PaperTradingEvaluationRecord;
  }): Promise<boolean> {
    try {
      const checkpointAttempts = await this.options.store
        .listPaperTradingComparisonCheckpointAttempts(
          input.attempt.paper_trading_comparison_activation_attempt_id
        );
      const committed: Array<{
        attempt: PaperTradingComparisonCheckpointAttemptRecord;
        outcome: PaperTradingComparisonCheckpointOutcomeRecord;
      }> = [];
      let reachedOpenAttempt = false;
      for (const checkpointAttempt of checkpointAttempts) {
        const outcomes = await this.options.store
          .listPaperTradingComparisonCheckpointOutcomes(
            checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
          );
        const outcome = outcomes[0];
        if (!outcome || outcome.outcome_status === "incomplete") {
          if (outcomes.length > 1 || outcome && (
            outcome.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
            outcome.checkpoint_attempt_ref.id !==
              checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
            outcome.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest
          )) {
            return false;
          }
          reachedOpenAttempt = true;
          continue;
        }
        if (reachedOpenAttempt || outcomes.length !== 1 ||
          outcome.outcome_status !== "paired" ||
          outcome.checkpoint_sequence !== checkpointAttempt.checkpoint_sequence ||
          outcome.checkpoint_attempt_ref.id !==
            checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id ||
          outcome.checkpoint_attempt_digest !== checkpointAttempt.attempt_digest) {
          return false;
        }
        committed.push({ attempt: checkpointAttempt, outcome });
      }
      if (committed.length === 0 || checkpointAttempts.length - committed.length > 1) {
        return false;
      }
      const observations: PaperTradingObservationRecord[] = await this.options.store
        .listPaperTradingObservations(input.side.paper_trading_evaluation_ref.id);
      observations.sort((left, right) => left.sequence - right.sequence ||
        left.paper_trading_observation_id.localeCompare(
          right.paper_trading_observation_id
        ));
      if (observations.length !== committed.length) return false;
      const normalizedEvaluation = input.evaluation.status === "stopped" &&
        observations.at(-1)?.status !== "failed"
        ? {
            ...input.evaluation,
            status: "running" as const,
            next_observation_at: new Date(
              Date.parse(input.evaluation.last_observed_at!) +
                input.evaluation.interval_ms
            ).toISOString(),
            stopped_at: undefined
          }
        : input.evaluation;
      const consumedEventCount = committed.reduce((total, current) =>
        total + (current.outcome[input.side.role]?.consumed_event_count ?? 0), 0);
      const ledgerRefIds: string[] = [];
      for (let index = 0; index < committed.length; index += 1) {
        const current = committed[index]!;
        const previous = committed[index - 1];
        const evidence = current.outcome[input.side.role];
        const observation = observations[index];
        if (!evidence || !observation ||
          current.attempt.checkpoint_sequence !== index + 1 ||
          observation.sequence !== current.attempt.checkpoint_sequence ||
          current.outcome.tick_ref.id !== current.attempt.tick_ref.id ||
          current.outcome.tick_digest !== current.attempt.tick_digest ||
          observation.paper_trading_comparison_tick_ref?.id !==
            current.attempt.tick_ref.id ||
          observation.paper_trading_comparison_tick_digest !==
            current.attempt.tick_digest ||
          observation.paper_trading_comparison_checkpoint_attempt_ref?.id !==
            current.attempt.paper_trading_comparison_checkpoint_attempt_id ||
          observation.paper_trading_comparison_checkpoint_attempt_digest !==
            current.attempt.attempt_digest ||
          evidence.observation_ref.id !== observation.paper_trading_observation_id ||
          evidence.observation_record_digest !== comparisonDigest(
            paperTradingComparisonPersistedRecordDigestInput(observation)
          ) ||
          evidence.observation_status !== observation.status ||
          previous && (
            current.attempt.previous_checkpoint_outcome_ref?.id !==
              previous.outcome.paper_trading_comparison_checkpoint_outcome_id ||
            current.attempt.previous_checkpoint_outcome_digest !==
              previous.outcome.outcome_digest
          )) {
          return false;
        }
        ledgerRefIds.push(...evidence.ledger_chain_refs.map((ref) => ref.id));
      }
      const latest = committed.at(-1)!;
      const latestEvidence = latest.outcome[input.side.role];
      const processedEventCount = (
        normalizedEvaluation.processed_trading_system_event_ids?.length ?? 0
      ) - (input.baseline.processed_trading_system_event_ids?.length ?? 0);
      return Boolean(latestEvidence) &&
        normalizedEvaluation.observation_count === committed.length &&
        latest.attempt[input.side.role].trading_run_ref.id === input.run.trading_run_id &&
        latest.attempt[input.side.role].paper_trading_evaluation_ref.id ===
          input.evaluation.paper_trading_evaluation_id &&
        latestEvidence!.evaluation_record_digest === comparisonDigest(
          paperTradingComparisonEvaluationRecordDigestInput(normalizedEvaluation)
        ) &&
        processedEventCount === consumedEventCount &&
        sameStringIds(
          input.run.order_request_refs?.map((ref) => ref.id) ?? [],
          ledgerRefIds
        );
    } catch {
      return false;
    }
  }

  private async ensureComparisonApiProviderSession(input: {
    sessionKey: string;
    tradingRunId: string;
    binding: GatewayRuntimeBinding;
    maximumProviderRequestCount: number;
  }): Promise<string> {
    const existing = this.comparisonApiProviderSessions.get(input.sessionKey);
    if (existing) {
      if (this.comparisonProviderRequestLimits.get(input.sessionKey) !==
        input.maximumProviderRequestCount) {
        throw new PaperTradingSessionError(
          "paper_trading_comparison_provider_request_limit_mismatch",
          "Paper comparison provider session already has a different request limit."
        );
      }
      return existing.sandbox_base_url ?? existing.base_url;
    }
    const priorRequestCount = this.comparisonProviderRequestCounts.get(input.sessionKey) ?? 0;
    const provider = await this.apiProviderFactory(input.binding, {
      ...this.options.apiProviderOptions,
      maximum_request_count: Math.max(
        0,
        input.maximumProviderRequestCount - priorRequestCount
      ),
      readAccountState: () => this.latestPaperAccountState(
        input.tradingRunId,
        input.binding
      ),
      comparison_tick_hooks: this.comparisonTickHooks(input.sessionKey)
    });
    this.comparisonGatewayBindings.set(input.sessionKey, input.binding);
    this.comparisonProviderRequestLimits.set(
      input.sessionKey,
      input.maximumProviderRequestCount
    );
    this.comparisonApiProviderSessions.set(input.sessionKey, provider);
    return provider.sandbox_base_url ?? provider.base_url;
  }

  private comparisonTickHooks(
    sessionKey: string
  ): PaperTradingApiProviderComparisonTickHooks {
    return {
      deliver: (input) => this.deliverComparisonTickContext(sessionKey, input),
      acknowledge: (input) => this.acknowledgeComparisonTickContext(sessionKey, input)
    };
  }

  private async deliverComparisonTickContext(
    sessionKey: string,
    input: {
      market: MarketSnapshot;
      provider_request_count: number;
      delivered_at: string;
    }
  ): Promise<PaperTradingComparisonTickContext | undefined> {
    const enabled = this.enabledComparisonTickAttributions.get(sessionKey);
    if (!enabled) return undefined;
    const totalProviderRequestCount = this.comparisonTickTotalProviderRequestCount(
      sessionKey,
      input.provider_request_count
    );
    if (totalProviderRequestCount <= enabled.checkpointProviderRequestCount) {
      return undefined;
    }
    if (totalProviderRequestCount > enabled.maximumProviderRequestCount ||
      !isExactIsoTimestamp(input.delivered_at)) {
      throw new Error("paper_trading_comparison_tick_delivery_context_invalid");
    }

    const deliveryId = comparisonTickDeliveryId(enabled);
    const existing = await this.options.store.getPaperTradingComparisonTickDelivery(
      deliveryId
    );
    if (existing) {
      const acknowledgement = await this.options.store
        .getPaperTradingComparisonTickAcknowledgement(
          comparisonTickAcknowledgementId(existing)
        );
      if (acknowledgement) return undefined;
    }
    if (!comparisonTickMarketMatches(input.market, enabled.tick)) {
      throw new Error("paper_trading_comparison_tick_delivery_context_invalid");
    }

    const authority: PaperTradingComparisonTickIOWriteContext = {
      ...structuredClone(enabled.authority),
      operation: "deliver_market_snapshot"
    };
    let delivery: PaperTradingComparisonTickDeliveryRecord;
    if (existing) {
      delivery = await this.options.store.recordPaperTradingComparisonTickDelivery(
        existing,
        authority
      );
    } else {
      const draft: PaperTradingComparisonTickDeliveryRecord = {
        record_kind: "paper_trading_comparison_tick_delivery",
        version: 1,
        paper_trading_comparison_tick_delivery_id: deliveryId,
        paper_trading_comparison_activation_ref: {
          ...authority.paper_trading_comparison_activation_ref
        },
        paper_trading_comparison_activation_digest:
          authority.paper_trading_comparison_activation_digest,
        paper_trading_comparison_activation_attempt_ref: {
          ...authority.paper_trading_comparison_activation_attempt_ref
        },
        paper_trading_comparison_activation_attempt_digest:
          authority.paper_trading_comparison_activation_attempt_digest,
        role: authority.role,
        trading_run_ref: { ...authority.trading_run_ref },
        tick_ref: { ...authority.tick_ref },
        tick_digest: authority.tick_digest,
        tick_sequence: enabled.tick.sequence,
        provider_request_count_at_delivery: totalProviderRequestCount,
        endpoint: "GET /market/snapshot",
        delivered_at: input.delivered_at,
        delivery_digest: "",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      };
      delivery = await this.options.store.recordPaperTradingComparisonTickDelivery(
        {
          ...draft,
          delivery_digest: comparisonDigest(
            paperTradingComparisonTickDeliveryDigestInput(draft)
          )
        },
        authority
      );
    }
    return comparisonTickContextFromDelivery(delivery);
  }

  private async acknowledgeComparisonTickContext(
    sessionKey: string,
    input: {
      context: unknown;
      provider_request_count: number;
      acknowledged_at: string;
    }
  ): Promise<{
    acknowledgement_ref: { record_kind: string; id: string };
    acknowledgement_digest: string;
  }> {
    const enabled = this.enabledComparisonTickAttributions.get(sessionKey);
    if (!enabled) {
      throw new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_attribution_not_enabled",
        409
      );
    }
    if (!paperTradingComparisonTickContextHasRuntimeShape(input.context) ||
      !isExactIsoTimestamp(input.acknowledged_at)) {
      throw new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_context_invalid",
        422
      );
    }
    const totalProviderRequestCount = this.comparisonTickTotalProviderRequestCount(
      sessionKey,
      input.provider_request_count
    );
    if (totalProviderRequestCount > enabled.maximumProviderRequestCount) {
      throw new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_request_budget_exceeded",
        409
      );
    }

    const deliveryId = comparisonTickDeliveryId(enabled);
    let delivery: PaperTradingComparisonTickDeliveryRecord | undefined;
    try {
      delivery = await this.options.store.getPaperTradingComparisonTickDelivery(deliveryId);
    } catch {
      throw new Error("paper_trading_comparison_tick_delivery_reload_failed");
    }
    if (!delivery || !sameComparisonTickContext(
      input.context,
      comparisonTickContextFromDelivery(delivery)
    )) {
      throw new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_context_stale",
        409
      );
    }
    if (totalProviderRequestCount < delivery.provider_request_count_at_delivery ||
      Date.parse(input.acknowledged_at) < Date.parse(delivery.delivered_at)) {
      throw new PaperTradingApiProviderComparisonTickClientError(
        "comparison_tick_context_stale",
        409
      );
    }

    const acknowledgementId = comparisonTickAcknowledgementId(delivery);
    const authority: PaperTradingComparisonTickIOWriteContext = {
      ...structuredClone(enabled.authority),
      operation: "acknowledge_tick"
    };
    const existing = await this.options.store.getPaperTradingComparisonTickAcknowledgement(
      acknowledgementId
    );
    let acknowledgement: PaperTradingComparisonTickAcknowledgementRecord;
    try {
      if (existing) {
        acknowledgement = await this.options.store
          .recordPaperTradingComparisonTickAcknowledgement(existing, authority);
      } else {
        const draft: PaperTradingComparisonTickAcknowledgementRecord = {
          record_kind: "paper_trading_comparison_tick_acknowledgement",
          version: 1,
          paper_trading_comparison_tick_acknowledgement_id: acknowledgementId,
          delivery_ref: {
            record_kind: "paper_trading_comparison_tick_delivery",
            id: delivery.paper_trading_comparison_tick_delivery_id
          },
          delivery_digest: delivery.delivery_digest,
          paper_trading_comparison_activation_attempt_ref: {
            ...authority.paper_trading_comparison_activation_attempt_ref
          },
          paper_trading_comparison_activation_attempt_digest:
            authority.paper_trading_comparison_activation_attempt_digest,
          role: authority.role,
          trading_run_ref: { ...authority.trading_run_ref },
          tick_ref: { ...authority.tick_ref },
          tick_digest: authority.tick_digest,
          tick_sequence: enabled.tick.sequence,
          provider_request_count_at_acknowledgement: totalProviderRequestCount,
          endpoint: "POST /comparison/tick/ack",
          acknowledged_at: input.acknowledged_at,
          acknowledgement_digest: "",
          live_exchange_authority: false,
          order_submission_authority: false,
          authority_status: "not_live"
        };
        acknowledgement = await this.options.store
          .recordPaperTradingComparisonTickAcknowledgement({
            ...draft,
            acknowledgement_digest: comparisonDigest(
              paperTradingComparisonTickAcknowledgementDigestInput(draft)
            )
          }, authority);
      }
    } catch (error) {
      if (comparisonTickAcknowledgementIsClientConflict(error)) {
        throw new PaperTradingApiProviderComparisonTickClientError(
          "comparison_tick_context_stale",
          409
        );
      }
      throw error;
    }
    return {
      acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      },
      acknowledgement_digest: acknowledgement.acknowledgement_digest
    };
  }

  private comparisonTickTotalProviderRequestCount(
    sessionKey: string,
    currentProviderRequestCount: number
  ): number {
    if (!Number.isInteger(currentProviderRequestCount) ||
      currentProviderRequestCount <= 0) {
      throw new Error("paper_trading_comparison_provider_request_count_invalid");
    }
    return (this.comparisonProviderRequestCounts.get(sessionKey) ?? 0) +
      currentProviderRequestCount;
  }

  private async ensureComparisonTradingRunSandbox(input: {
    loaded: LoadedPaperTradingComparisonSessionSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    tradingApiBaseUrl: string;
    signal: AbortSignal;
    deadlineAt: string;
  }): Promise<SandboxDetailReadModel> {
    const adapter = this.options.sandboxAdapters.deterministic_test;
    const sandboxId = `sandbox-${safeRouteId([
      "paper-comparison",
      input.loaded.attempt.paper_trading_comparison_activation_attempt_id,
      input.authority.role,
      input.loaded.run.trading_run_id
    ].join(":"))}`;
    const result = await adapter.startArtifactInstance({
      artifact: input.loaded.systemCode,
      instance_id: sandboxId,
      sandbox_name: `ouro-paper-comparison-${safeRouteId(
        input.loaded.run.trading_run_id
      ).slice(0, 34)}-${input.authority.role}`,
      runtime_ref: { record_kind: "trading_run", id: input.loaded.run.trading_run_id },
      sandbox_placement_id: input.loaded.run.placement_ref.id,
      created_at: new Date().toISOString(),
      interval_ms: this.sandboxIntervalMs,
      paper_order_request: paperOrderRequestFromCandidateRuntime(input.loaded.candidate),
      env: { TRADING_API_BASE_URL: input.tradingApiBaseUrl }
    });
    try {
      this.assertComparisonEffectOpen(input.signal, input.deadlineAt);
    } catch (error) {
      await stopTransientComparisonSandbox(adapter, result);
      throw error;
    }
    const { placement: _placement, ...withoutPlacement } = result;
    try {
      return (await this.options.store.recordSandboxStart(
        withoutPlacement,
        input.authority
      )).sandbox;
    } catch (error) {
      await stopTransientComparisonSandbox(adapter, result);
      throw error;
    }
  }

  private comparisonProviderRequestCount(sessionKey: string): number {
    const priorRequestCount = this.comparisonProviderRequestCounts.get(sessionKey) ?? 0;
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    if (!provider) return priorRequestCount;
    const requestCount = (provider as ReplayTradingApiProviderSession & {
      request_count?: () => number;
    }).request_count;
    return priorRequestCount + (requestCount
      ? requestCount.call(provider)
      : provider.requests().length);
  }

  private async closeComparisonApiProviderSession(sessionKey: string): Promise<void> {
    const provider = this.comparisonApiProviderSessions.get(sessionKey);
    if (!provider) {
      this.comparisonGatewayBindings.delete(sessionKey);
      this.comparisonProviderRequestLimits.delete(sessionKey);
      this.enabledComparisonTickAttributions.delete(sessionKey);
      this.advancedComparisonCheckpointViews.delete(sessionKey);
      return;
    }
    this.comparisonProviderRequestCounts.set(
      sessionKey,
      this.comparisonProviderRequestCount(sessionKey)
    );
    this.comparisonApiProviderSessions.delete(sessionKey);
    this.comparisonGatewayBindings.delete(sessionKey);
    this.comparisonProviderRequestLimits.delete(sessionKey);
    this.enabledComparisonTickAttributions.delete(sessionKey);
    this.advancedComparisonCheckpointViews.delete(sessionKey);
    await provider.close();
  }

  private async verifyExisting(
    candidate: CandidateInspectReadModel,
    evaluation: PaperTradingEvaluationRecord,
    binding: GatewayRuntimeBinding,
    resolvedSystemCode?: {
      systemCode: SystemCodeRecord;
      resolvedArtifactDigest: string;
    }
  ): Promise<{
    commitment: PaperTradingEvaluationCommitmentRecord;
    evaluation: PaperTradingEvaluationRecord;
    verification: PaperTradingEvaluationCommitmentVerification;
  }> {
    const commitmentRef = evaluation.paper_trading_evaluation_commitment_ref;
    if (!commitmentRef) {
      return {
        commitment: {} as PaperTradingEvaluationCommitmentRecord,
        evaluation,
        verification: {
          status: "invalidated",
          reason: "commitment_missing",
          diagnostic: "PaperTradingEvaluation has no persisted commitment reference."
        }
      };
    }
    const commitment = await this.options.store.getPaperTradingEvaluationCommitment(commitmentRef.id);
    if (!commitment) {
      return {
        commitment: {} as PaperTradingEvaluationCommitmentRecord,
        evaluation,
        verification: {
          status: "invalidated",
          reason: "commitment_missing",
          diagnostic: "Referenced PaperTradingEvaluationCommitment was not found."
        }
      };
    }
    const systemCode = resolvedSystemCode?.systemCode ??
      await this.options.store.getSystemCode(commitment.system_code_ref.id);
    if (!systemCode) {
      return {
        commitment,
        evaluation,
        verification: {
          status: "invalidated",
          reason: "system_code_identity_mismatch",
          diagnostic: "Committed SystemCode was not found."
        }
      };
    }
    try {
      const resolvedArtifactDigest = resolvedSystemCode?.resolvedArtifactDigest ??
        await this.options.artifactResolver.resolveArtifactDigest(systemCode);
      return {
        commitment,
        evaluation,
        verification: verifyPaperTradingEvaluationCommitment({
          commitment,
          evaluation,
          candidate,
          systemCode,
          resolvedArtifactDigest,
          marketData: binding.marketData,
          intervalMs: this.intervalMs
        })
      };
    } catch (error) {
      return {
        commitment,
        evaluation,
        verification: {
          status: "invalidated",
          reason: "resolved_artifact_digest_mismatch",
          diagnostic: error instanceof Error
            ? `Unable to resolve committed SystemCode artifact: ${error.message}`
            : "Unable to resolve committed SystemCode artifact."
        }
      };
    }
  }

  private async markPaperTradingEvaluationRunning(
    evaluation: PaperTradingEvaluationRecord,
    restartFailedEventIds: string[] = []
  ): Promise<PaperTradingEvaluationRecord> {
    const startedAt = new Date().toISOString();
    return this.options.store.recordPaperTradingEvaluation({
      ...evaluation,
      status: "running",
      stopped_at: undefined,
      next_observation_at: new Date(Date.parse(startedAt) + this.intervalMs).toISOString(),
      latest_failure_reason: undefined,
      processed_trading_system_event_ids: [...new Set([
        ...(evaluation.processed_trading_system_event_ids ?? []),
        ...restartFailedEventIds
      ])]
    });
  }

  private async persistInvalidation(
    candidate: CandidateInspectReadModel,
    evaluation: PaperTradingEvaluationRecord,
    verification: Extract<PaperTradingEvaluationCommitmentVerification, { status: "invalidated" }>
  ): Promise<PaperTradingEvaluationRecord> {
    const invalidated = await this.options.store.recordPaperTradingEvaluation(
      invalidatePaperTradingEvaluation({
        evaluation,
        verification,
        invalidatedAt: new Date().toISOString()
      })
    );
    await this.options.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
      idempotencyKey: `paper-commitment-invalidated:${invalidated.paper_trading_evaluation_id}:${invalidated.invalidation_reason ?? "unknown"}`,
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: invalidated.trading_run_ref.id,
      action: "inspect",
      lifecycleStatus: "stopped",
      actorId: "runtime-api",
      reasonSummary: `Paper commitment invalidated: ${invalidated.invalidation_reason ?? "unknown"}.`,
      message: "Paper TradingEvaluation stopped before additional evidence was recorded."
    }));
    await this.stopTerminalSession(invalidated.trading_run_ref.id);
    return invalidated;
  }

  private async ensurePaperTradingApiProviderSession(
    tradingRunId: string,
    gatewayRuntimeBinding: GatewayRuntimeBinding
  ): Promise<string> {
    const existing = this.apiProviderSessions.get(tradingRunId);
    if (existing) {
      return existing.sandbox_base_url ?? existing.base_url;
    }
    const provider = await this.apiProviderFactory(gatewayRuntimeBinding, {
      ...this.options.apiProviderOptions,
      readAccountState: () => this.latestPaperAccountState(tradingRunId, gatewayRuntimeBinding)
    });
    this.apiProviderSessions.set(tradingRunId, provider);
    return provider.sandbox_base_url ?? provider.base_url;
  }

  private async latestPaperAccountState(
    tradingRunId: string,
    gatewayRuntimeBinding: GatewayRuntimeBinding
  ): Promise<AccountState> {
    const fallback = gatewayRuntimeBinding.account.provider_kind === "fake_paper_account"
      ? gatewayRuntimeBinding.account.state
      : { equity: 10_000, max_position_notional: 350, max_risk_fraction: 0.03, target_risk_fraction: 0.02 };
    const evaluation = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const equity = parseFiniteAccountNumber(evaluation?.paper_account_snapshot?.equity_usdt);
    return { ...fallback, equity: equity ?? fallback.equity };
  }

  private async ensureTradingRunSandbox(input: {
    candidate: CandidateInspectReadModel;
    tradingRunId: string;
    candidateVersionId: string;
    paperOrderRequest: PaperOrderRequestFixture;
    tradingApiBaseUrl?: string;
  }): Promise<SandboxDetailReadModel> {
    const systemCodeId = input.candidate.system_code?.ref?.id ?? FIXTURE_SYSTEM_CODE_ID;
    const artifact = await this.options.store.getSystemCode(systemCodeId);
    if (!artifact) {
      throw new PaperTradingSessionError("system_code_not_found", `system code ${systemCodeId} not found`);
    }
    const idempotencyKey = ["trading-run-sandbox", input.paperOrderRequest, input.tradingRunId, input.candidateVersionId].join(":");
    const sandboxId = `sandbox-${safeRouteId(idempotencyKey)}`;
    const existing = await this.options.store.getSandbox(sandboxId);
    const adapter = this.options.sandboxAdapters.deterministic_test;
    if (existing?.lifecycle_status === "running" && adapter.getArtifactInstanceStatus) {
      const observations = await adapter.getArtifactInstanceStatus(existing);
      if (
        observations.lifecycle_status ||
        observations.logs?.length ||
        observations.heartbeats?.length ||
        observations.command_evidence?.length
      ) {
        await this.options.store.recordSandboxObservations(existing.sandbox_id, observations);
      }
      const verified = await this.options.store.getSandbox(existing.sandbox_id) ?? existing;
      if (
        verified.lifecycle_status === "running" &&
        (observations.lifecycle_status === "running" || hasFreshSandboxHeartbeat(existing, observations))
      ) {
        return verified;
      }
      if (verified.lifecycle_status !== "stopped" && verified.lifecycle_status !== "removed") {
        const stop = adapter.stopArtifactInstance;
        if (!stop) {
          throw new PaperTradingSessionError("sandbox_adapter_method_not_supported", "sandbox adapter does not support stopArtifactInstance");
        }
        const stopObservations = await stop.call(adapter, verified);
        await this.options.store.stopSandbox({
          sandbox_id: verified.sandbox_id,
          stopped_at: stopObservations.stopped_at,
          removed_at: stopObservations.removed_at
        }, stopObservations);
      }
    }
    const result = await adapter.startArtifactInstance({
      artifact,
      instance_id: sandboxId,
      sandbox_name: `ouro-trading-run-${safeRouteId(input.tradingRunId).slice(0, 34)}-${input.paperOrderRequest}`,
      runtime_ref: { record_kind: "trading_run", id: input.tradingRunId },
      sandbox_placement_id: `sandbox-placement-${safeRouteId(sandboxId)}`,
      created_at: existing?.created_at ?? new Date().toISOString(),
      interval_ms: this.sandboxIntervalMs,
      paper_order_request: input.paperOrderRequest,
      env: input.tradingApiBaseUrl ? { TRADING_API_BASE_URL: input.tradingApiBaseUrl } : undefined
    });
    return (await this.options.store.recordSandboxStart(result)).sandbox;
  }

  private async refreshPaperTradingSandbox(tradingRunId: string): Promise<CandidateInspectReadModel> {
    const candidate = await this.requireCandidateForRun(tradingRunId);
    const sandbox = candidate.runtime.sandbox;
    if (!sandbox || !shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
      return candidate;
    }
    const adapter = this.options.sandboxAdapters[sandbox.adapter_kind];
    if (!adapter.getArtifactInstanceLogs) {
      return candidate;
    }
    const observations = await adapter.getArtifactInstanceLogs(sandbox);
    if (
      observations.lifecycle_status ||
      observations.logs?.length ||
      observations.heartbeats?.length ||
      observations.command_evidence?.length
    ) {
      await this.options.store.recordSandboxObservations(sandbox.sandbox_id, observations);
      return this.requireCandidateForRun(tradingRunId);
    }
    return candidate;
  }

  private async requireEffectfulSession(
    tradingRunId: string,
    options: { requireActiveSession?: boolean } = {}
  ): Promise<{
    candidate: CandidateInspectReadModel;
    evaluation: PaperTradingEvaluationRecord;
    commitment: PaperTradingEvaluationCommitmentRecord;
  }> {
    const candidate = await this.requireCandidateForRun(tradingRunId);
    const evaluation = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    if (!evaluation) {
      throw new PaperTradingSessionError(
        "paper_trading_evaluation_not_started",
        `paper TradingEvaluation for runtime ${tradingRunId} was not prepared`
      );
    }
    const commitmentRef = evaluation.paper_trading_evaluation_commitment_ref;
    const commitment = commitmentRef
      ? await this.options.store.getPaperTradingEvaluationCommitment(commitmentRef.id)
      : undefined;
    if (!commitment) {
      throw new PaperTradingSessionError(
        "paper_trading_evaluation_commitment_missing",
        `paper TradingEvaluation for runtime ${tradingRunId} has no persisted commitment`
      );
    }
    if (commitment.evidence_purpose === "qualification") {
      throw new PaperTradingSessionError(
        "paper_trading_comparison_authority_required",
        "Qualification PaperTradingSession activation requires verified comparison authority."
      );
    }
    if (
      evaluation.status !== "running" ||
      candidate.runtime.runtime_lifecycle_status !== "running" ||
      (options.requireActiveSession && !this.activeSessions.has(tradingRunId))
    ) {
      throw new PaperTradingSessionError(
        "paper_trading_session_not_active",
        `paper TradingEvaluation for runtime ${tradingRunId} must be activated before observation or scheduling`,
        {
          trading_run_id: tradingRunId,
          evaluation_status: evaluation.status,
          runtime_lifecycle_status: candidate.runtime.runtime_lifecycle_status,
          active_session: this.activeSessions.has(tradingRunId)
        }
      );
    }
    return { candidate, evaluation, commitment };
  }

  private async stopTerminalSession(tradingRunId: string): Promise<void> {
    this.runner.stop(tradingRunId);
    this.activeSessions.delete(tradingRunId);
    await this.stopApiProviderSession(tradingRunId);
    await this.stopLinkedSandbox(tradingRunId);
  }

  private async stopApiProviderSession(tradingRunId: string): Promise<void> {
    const provider = this.apiProviderSessions.get(tradingRunId);
    if (!provider) {
      return;
    }
    this.apiProviderSessions.delete(tradingRunId);
    await provider.close();
  }

  private async stopLinkedSandbox(tradingRunId: string): Promise<SandboxDetailReadModel | undefined> {
    const sandbox = await this.linkedSandbox(tradingRunId);
    if (!sandbox || sandbox.lifecycle_status === "stopped" || sandbox.lifecycle_status === "removed") {
      return sandbox;
    }
    const stop = this.options.sandboxAdapters[sandbox.adapter_kind].stopArtifactInstance;
    if (!stop) {
      throw new PaperTradingSessionError("sandbox_adapter_method_not_supported", "sandbox adapter does not support stopArtifactInstance");
    }
    const observations = await stop.call(this.options.sandboxAdapters[sandbox.adapter_kind], sandbox);
    return (await this.options.store.stopSandbox({
      sandbox_id: sandbox.sandbox_id,
      stopped_at: observations.stopped_at,
      removed_at: observations.removed_at
    }, observations)).sandbox;
  }

  private async linkedSandbox(tradingRunId: string): Promise<SandboxDetailReadModel | undefined> {
    const tradingRun = await this.options.store.getTradingRun(tradingRunId);
    return tradingRun?.sandbox_ref ? this.options.store.getSandbox(tradingRun.sandbox_ref.id) : undefined;
  }

  private async requireCandidateForRun(tradingRunId: string): Promise<CandidateInspectReadModel> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    if (!candidate) {
      throw new PaperTradingSessionError("trading_run_not_found", `trading run ${tradingRunId} was not found`);
    }
    return candidate;
  }
}

function paperOrderRequestFromCandidateRuntime(candidate: CandidateInspectReadModel): PaperOrderRequestFixture {
  return candidate.runtime.sandbox?.sandbox_name?.endsWith("-rejected") ? "rejected" : "valid";
}

function comparisonActivationSidesEqual(
  left: PaperTradingComparisonActivationSide,
  right: PaperTradingComparisonActivationSide
): boolean {
  return left.role === right.role &&
    paperTradingComparisonRefsEqual(left.trading_run_ref, right.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_commitment_ref,
      right.paper_trading_evaluation_commitment_ref
    ) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_ref,
      right.paper_trading_evaluation_ref
    );
}

function sameComparisonTickAttributionEnablement(
  left: EnabledPaperTradingComparisonTickAttribution,
  right: EnabledPaperTradingComparisonTickAttribution
): boolean {
  return paperTradingComparisonPersistedRecordDigestInput(left) ===
    paperTradingComparisonPersistedRecordDigestInput(right);
}

function sameAdvancedComparisonCheckpointView(
  left: AdvancedPaperTradingComparisonCheckpointView,
  right: AdvancedPaperTradingComparisonCheckpointView
): boolean {
  return paperTradingComparisonPersistedRecordDigestInput(left) ===
    paperTradingComparisonPersistedRecordDigestInput(right);
}

function comparisonTickMarketMatches(
  market: MarketSnapshot,
  tick: PaperTradingComparisonTickRecord
): boolean {
  const { authority_status: _authority, ...expected } = tick.market_snapshot;
  try {
    return paperTradingComparisonPersistedRecordDigestInput(market) ===
      paperTradingComparisonPersistedRecordDigestInput(expected);
  } catch {
    return false;
  }
}

function comparisonTickDeliveryId(
  enabled: EnabledPaperTradingComparisonTickAttribution
): string {
  return `paper-comparison-tick-delivery-${safeRouteId([
    enabled.authority.paper_trading_comparison_activation_attempt_ref.id,
    enabled.authority.role,
    enabled.tick.paper_trading_comparison_tick_id
  ].join(":"))}`;
}

function comparisonTickAcknowledgementId(
  delivery: PaperTradingComparisonTickDeliveryRecord
): string {
  return `paper-comparison-tick-acknowledgement-${safeRouteId(
    delivery.paper_trading_comparison_tick_delivery_id
  )}`;
}

function comparisonTickContextFromDelivery(
  delivery: PaperTradingComparisonTickDeliveryRecord
): PaperTradingComparisonTickContext {
  return {
    tick_ref: { ...delivery.tick_ref },
    tick_digest: delivery.tick_digest,
    tick_sequence: delivery.tick_sequence,
    delivery_ref: {
      record_kind: "paper_trading_comparison_tick_delivery",
      id: delivery.paper_trading_comparison_tick_delivery_id
    },
    delivery_digest: delivery.delivery_digest
  };
}

function sameComparisonTickContext(
  left: PaperTradingComparisonTickContext,
  right: PaperTradingComparisonTickContext
): boolean {
  return paperTradingComparisonPersistedRecordDigestInput(left) ===
    paperTradingComparisonPersistedRecordDigestInput(right);
}

function comparisonTickAcknowledgementIsClientConflict(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" &&
    code.startsWith("paper_trading_comparison_tick_acknowledgement_") &&
    (code.includes("_reference_") ||
      code.includes("_state_") ||
      code.endsWith("_conflict"));
}

function comparisonSessionKey(
  authority: PaperTradingComparisonRuntimeWriteContext |
    PaperTradingComparisonCheckpointWriteContext |
    PaperTradingComparisonTickIOWriteContext
): string {
  return [
    authority.paper_trading_comparison_activation_attempt_ref.id,
    authority.role
  ].join(":");
}

function comparisonCheckpointPreparationDigest(value: unknown): string {
  return comparisonDigest(paperTradingComparisonPersistedRecordDigestInput(value));
}

function comparisonDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function sameStringIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function comparisonRunControlAuditInput(
  loaded: LoadedPaperTradingComparisonSessionSide,
  authority: PaperTradingComparisonRuntimeWriteContext,
  operation: "start" | "stop",
  reason?: "symmetric_start" | "partial_start_cleanup" | "policy_cleanup" |
    "restart_cleanup" | "handoff_cleanup"
) {
  const lifecycleStatus = operation === "start" ? "running" : "stopped";
  const reasonLabel = reason ? ` (${reason})` : "";
  return tradingRunLifecycleAuditInput({
    idempotencyKey: paperTradingComparisonRuntimeControlIdempotencyKey(authority),
    candidateId: loaded.candidate.candidate_id,
    candidateVersionId: loaded.candidate.candidate_version.candidate_version_id,
    tradingRunId: loaded.run.trading_run_id,
    action: operation,
    lifecycleStatus,
    actorId: "runtime-activation-coordinator",
    reasonSummary: `Authorized paper comparison runtime ${operation}${reasonLabel}.`,
    message: `Paper comparison runtime ${operation} recorded.`
  });
}

function comparisonTransientSandboxDetail(
  result: SandboxStartResult
): SandboxDetailReadModel {
  return {
    ...result.instance,
    command_evidence_refs: result.instance.command_evidence_refs ?? [],
    logs: result.logs.map((log) => ({
      log_ref: { record_kind: log.record_kind, id: log.sandbox_log_id },
      lines: [...log.lines],
      captured_at: log.captured_at,
      authority_status: log.authority_status
    })),
    heartbeats: result.heartbeats.map((heartbeat) => ({
      heartbeat_ref: {
        record_kind: heartbeat.record_kind,
        id: heartbeat.runtime_heartbeat_id
      },
      heartbeat_line: heartbeat.heartbeat_line,
      observed_at: heartbeat.observed_at,
      authority_status: heartbeat.authority_status
    })),
    command_evidence: result.command_evidence.map((evidence) => ({
      command_evidence_ref: {
        record_kind: evidence.record_kind,
        id: evidence.sandbox_command_evidence_id
      },
      command: [...evidence.command],
      exit_code: evidence.exit_code,
      stdout: evidence.stdout,
      stderr: evidence.stderr,
      started_at: evidence.started_at,
      completed_at: evidence.completed_at,
      authority_status: evidence.authority_status
    }))
  };
}

async function stopTransientComparisonSandbox(
  adapter: SandboxAdapterRegistryPort["deterministic_test"],
  result: SandboxStartResult
): Promise<void> {
  const stop = adapter.stopArtifactInstance;
  if (!stop) {
    throw new PaperTradingSessionError(
      "paper_trading_comparison_transient_sandbox_cleanup_unavailable",
      "Paper comparison sandbox started without a supported cleanup operation."
    );
  }
  try {
    await stop.call(adapter, comparisonTransientSandboxDetail(result));
  } catch {
    throw new PaperTradingSessionError(
      "paper_trading_comparison_transient_sandbox_cleanup_failed",
      "Paper comparison transient sandbox cleanup failed."
    );
  }
}

function isExactIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function parseFiniteAccountNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeRouteId(value: string): string {
  const prefix = safeId(value, { maxLength: 72 });
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${digest}`;
}

function shouldRefreshSandboxStatus(lifecycleStatus: string): boolean {
  return lifecycleStatus !== "stopped" && lifecycleStatus !== "removed" && lifecycleStatus !== "failed";
}

function hasFreshSandboxHeartbeat(
  existing: SandboxDetailReadModel,
  observations: SandboxAdapterObservationResult
): boolean {
  const previousHeartbeatAt = existing.last_heartbeat_at ? Date.parse(existing.last_heartbeat_at) : undefined;
  return observations.heartbeats?.some((heartbeat) => {
    const observedAt = Date.parse(heartbeat.observed_at);
    return Number.isFinite(observedAt) && (
      previousHeartbeatAt === undefined ||
      !Number.isFinite(previousHeartbeatAt) ||
      observedAt > previousHeartbeatAt
    );
  }) ?? false;
}

function paperTradingEvaluationComesAfter(
  candidate: PaperTradingEvaluationRecord,
  existing: PaperTradingEvaluationRecord
): boolean {
  return candidate.started_at > existing.started_at || (
    candidate.started_at === existing.started_at &&
    candidate.paper_trading_evaluation_id > existing.paper_trading_evaluation_id
  );
}
