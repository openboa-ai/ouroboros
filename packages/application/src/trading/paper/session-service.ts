import { createHash } from "node:crypto";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationInvalidationReason,
  PaperTradingEvaluationRecord,
  PaperTradingEvidencePurpose,
  SandboxDetailReadModel
} from "@ouroboros/domain";
import { FIXTURE_SYSTEM_CODE_ID, type OuroborosStorePort } from "../../ports/store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { SystemCodeArtifactResolverPort } from "../../ports/system-code-artifact";
import type {
  PaperOrderRequestFixture,
  SandboxAdapterObservationResult,
  SandboxAdapterRegistryPort
} from "../../ports/sandbox";
import { safeId } from "../../safe-id";
import {
  createGatewayRuntimeBinding,
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "../gateway/runtime-binding";
import type { AccountState, ReplayTradingApiProviderSession } from "../research/types";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { initialPaperTradingEngineState } from "./engine";
import { zeroPaperTradingProfitLoss } from "./evaluation";
import {
  createPaperTradingEvaluationCommitment,
  invalidatePaperTradingEvaluation,
  verifyPaperTradingEvaluationCommitment,
  type PaperTradingEvaluationCommitmentVerification
} from "./commitment";
import {
  recordPaperTradingEvaluationObservation,
  type RecordPaperTradingEvaluationObservationResult,
  tradingRunLifecycleAuditInput
} from "./observation";

export type PaperTradingSessionClock = "scheduled" | "external";

export interface PaperTradingSessionServiceOptions {
  store: OuroborosStorePort;
  sandboxAdapters: SandboxAdapterRegistryPort;
  marketData: GatewayMarketDataPort;
  runner?: PaperTradingEvaluationRunner;
  intervalMs?: number;
  sandboxIntervalMs?: number;
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

export class PaperTradingSessionService {
  private readonly apiProviderSessions = new Map<string, ReplayTradingApiProviderSession>();
  private readonly activeSessions = new Set<string>();
  private readonly runner: PaperTradingEvaluationRunner;
  private readonly intervalMs: number;
  private readonly sandboxIntervalMs: number;
  private readonly apiProviderFactory: NonNullable<PaperTradingSessionServiceOptions["apiProviderFactory"]>;

  constructor(private readonly options: PaperTradingSessionServiceOptions) {
    this.runner = options.runner ?? new PaperTradingEvaluationRunner();
    this.intervalMs = options.intervalMs ?? 60_000;
    this.sandboxIntervalMs = options.sandboxIntervalMs ?? 1_000;
    this.apiProviderFactory = options.apiProviderFactory ?? startPaperTradingApiProvider;
  }

  async prepare(input: {
    candidateId: string;
    candidateVersionId: string;
    tradingRunId: string;
    evidencePurpose: PaperTradingEvidencePurpose;
    clock: PaperTradingSessionClock;
  }): Promise<PreparedPaperTradingSession> {
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
    const existingEvaluation = await this.options.store
      .getLatestPaperTradingEvaluationForTradingRun(input.tradingRunId);
    if (existingEvaluation) {
      const resolved = await this.verifyExisting(candidate, existingEvaluation, binding);
      const verification = resolved.verification;
      if (verification.status !== "verified") {
        const evaluation = await this.persistInvalidation(candidate, existingEvaluation, verification);
        throw new PaperTradingSessionError(
          "paper_trading_evaluation_invalidated",
          verification.diagnostic,
          { paper_trading_evaluation: evaluation, reason: verification.reason }
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
    const committedAt = new Date().toISOString();
    const initialEngineState = initialPaperTradingEngineState();
    const commitment = createPaperTradingEvaluationCommitment({
      commitmentId: `paper-trading-evaluation-commitment-${safeRouteId(input.tradingRunId)}`,
      evidencePurpose: input.evidencePurpose,
      candidate,
      systemCode,
      resolvedArtifactDigest,
      marketData: binding.marketData,
      intervalMs: this.intervalMs,
      initialAccountSnapshot: initialEngineState.account,
      committedAt
    });
    await this.options.store.recordPaperTradingEvaluationCommitment(commitment);
    const evaluation: PaperTradingEvaluationRecord = {
      record_kind: "paper_trading_evaluation",
      version: 1,
      paper_trading_evaluation_id: `paper-trading-evaluation-${safeRouteId(input.tradingRunId)}`,
      candidate_ref: { ...commitment.candidate_ref },
      candidate_version_ref: { ...commitment.candidate_version_ref },
      trading_run_ref: { ...commitment.trading_run_ref },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      },
      status: "not_started",
      interval_ms: this.intervalMs,
      observation_count: 0,
      started_at: committedAt,
      latest_score: zeroPaperTradingProfitLoss(),
      paper_account_snapshot: commitment.initial_account_snapshot,
      open_orders: initialEngineState.openOrders,
      processed_trading_system_event_ids: initialEngineState.processedTradingSystemEventIds,
      processed_public_trade_ids: initialEngineState.processedPublicTradeIds,
      authority_status: "not_live"
    };
    await this.options.store.recordPaperTradingEvaluation(evaluation);
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
      const invalidated = await this.persistInvalidation(candidate, evaluation, verification);
      throw new PaperTradingSessionError(
        "paper_trading_evaluation_invalidated",
        verification.diagnostic,
        { paper_trading_evaluation: invalidated, reason: verification.reason }
      );
    }
    return { candidate, commitment, evaluation, verification, clock: input.clock };
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

  async stop(tradingRunId: string): Promise<PaperTradingEvaluationRecord | undefined> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    if (!candidate) {
      return undefined;
    }
    const run = await this.options.store.getTradingRun(tradingRunId);
    if (!run) {
      throw new PaperTradingSessionError("trading_run_not_found", "trading run was not found");
    }
    const existing = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const commitment = existing?.paper_trading_evaluation_commitment_ref
      ? await this.options.store.getPaperTradingEvaluationCommitment(
          existing.paper_trading_evaluation_commitment_ref.id
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
          outcomes.push({
            tradingRunId,
            status: "failed",
            error: "PaperTradingSession recovery purpose does not match the persisted commitment."
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
        await this.stopTerminalSession(tradingRunId).catch(() => undefined);
        outcomes.push({
          tradingRunId,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return outcomes;
  }

  private gatewayBinding(): GatewayRuntimeBinding {
    const binding = createGatewayRuntimeBinding({ environment: "paper", marketData: this.options.marketData });
    if (binding.status === "disabled") {
      throw new PaperTradingSessionError("gateway_runtime_binding_disabled", "Paper Gateway binding is disabled.");
    }
    return binding;
  }

  private async verifyExisting(
    candidate: CandidateInspectReadModel,
    evaluation: PaperTradingEvaluationRecord,
    binding: GatewayRuntimeBinding
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
    const systemCode = await this.options.store.getSystemCode(commitment.system_code_ref.id);
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
      const resolvedArtifactDigest = await this.options.artifactResolver.resolveArtifactDigest(systemCode);
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
