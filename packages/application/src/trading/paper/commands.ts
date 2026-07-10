import { createHash } from "node:crypto";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  SandboxAdapterKind,
  SandboxDetailReadModel,
  TradingGatewayEnvironmentReadModel,
  TradingRuntimeEnvironment
} from "@ouroboros/domain";
import { FIXTURE_SYSTEM_CODE_ID, isStoreErrorLike, type OuroborosStorePort } from "../../ports/store";
import type { SystemCodeArtifactResolverPort } from "../../ports/system-code-artifact";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type {
  PaperOrderRequestFixture,
  SandboxAdapterObservationResult,
  SandboxAdapterRegistryPort
} from "../../ports/sandbox";
import { safeId } from "../../safe-id";
import {
  createGatewayRuntimeBinding,
  LIVE_GATEWAY_DISABLED_REASON,
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "../gateway/runtime-binding";
import type { AccountState, ReplayTradingApiProviderSession } from "../research/types";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { initialPaperTradingEngineState } from "./engine";
import { zeroPaperTradingProfitLoss } from "./evaluation";
import { classifyPaperTradingFailure } from "./failures";
import {
  createPaperTradingEvaluationCommitment,
  invalidatePaperTradingEvaluation,
  verifyPaperTradingEvaluationCommitment,
  type PaperTradingEvaluationCommitmentVerification
} from "./commitment";
import {
  canRestartFailedPaperTradingEvaluation,
  recordPaperTradingEvaluationObservation,
  tradingSystemEventIdsFromCandidate,
  tradingRunLifecycleAuditInput
} from "./observation";

export interface PaperTradingCommandResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface StartPaperTradingRunPayload {
  runtime_environment?: TradingRuntimeEnvironment;
  paper_order_request?: PaperOrderRequestFixture;
}

export interface PaperTradingCommandServiceOptions {
  store: OuroborosStorePort;
  sandboxAdapters: SandboxAdapterRegistryPort;
  marketData: GatewayMarketDataPort;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
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

export class PaperTradingCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingCommandError";
  }
}

interface PreparedPaperTradingEvaluation {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  verification: PaperTradingEvaluationCommitmentVerification;
}

export class PaperTradingCommandService {
  private readonly apiProviderSessions = new Map<string, ReplayTradingApiProviderSession>();
  private readonly runner: PaperTradingEvaluationRunner;
  private readonly intervalMs: number;
  private readonly sandboxIntervalMs: number;
  private readonly apiProviderFactory: NonNullable<PaperTradingCommandServiceOptions["apiProviderFactory"]>;

  constructor(private readonly options: PaperTradingCommandServiceOptions) {
    this.runner = options.runner ?? new PaperTradingEvaluationRunner();
    this.intervalMs = options.intervalMs ?? 60_000;
    this.sandboxIntervalMs = options.sandboxIntervalMs ?? 1_000;
    this.apiProviderFactory = options.apiProviderFactory ?? startPaperTradingApiProvider;
  }

  active(tradingRunId: string): boolean {
    return this.runner.active(tradingRunId);
  }

  async start(candidateId: string, payload: unknown): Promise<PaperTradingCommandResponse> {
    const body = payload as StartPaperTradingRunPayload | undefined;
    const runtimeEnvironment = startRuntimeEnvironment(body);
    if (!runtimeEnvironment) {
      return {
        statusCode: 400,
        body: {
          error: "invalid_runtime_environment",
          allowed_values: ["paper", "live"]
        }
      };
    }

    const gatewayRuntimeBinding = createGatewayRuntimeBinding({
      environment: runtimeEnvironment,
      marketData: this.options.marketData
    });
    if (gatewayRuntimeBinding.status === "disabled") {
      return {
        statusCode: 422,
        body: {
          error: "gateway_runtime_binding_disabled",
          reason: gatewayRuntimeBinding.disabled_reason ?? LIVE_GATEWAY_DISABLED_REASON,
          runtime_environment: gatewayRuntimeBinding.environment
        }
      };
    }

    const paperOrderRequest = startPaperOrderRequest(body);
    if (!paperOrderRequest) {
      return {
        statusCode: 400,
        body: {
          error: "invalid_paper_order_request",
          allowed_values: ["valid", "rejected"]
        }
      };
    }

    const candidate = await this.options.store.getCandidate(candidateId);
    if (!candidate) {
      return {
        statusCode: 404,
        body: {
          error: "trading_system_not_found",
          system_id: candidateId
        }
      };
    }

    const candidateVersionId = candidate.candidate_version.candidate_version_id;
    const tradingRunId = candidate.runtime.ref.id;
    const existingEvaluation = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    if (existingEvaluation?.status === "invalidated") {
      return {
        statusCode: 409,
        body: {
          error: "paper_trading_evaluation_invalidated_requires_new_candidate_version",
          reason: existingEvaluation.invalidation_reason,
          paper_trading_evaluation: existingEvaluation,
          candidate_version_id: candidateVersionId
        }
      };
    }
    const failedSessionEventIds = restartFailedPaperTradingEvaluationProcessedEventIds({
      candidate,
      evaluation: existingEvaluation
    });
    if (
      existingEvaluation?.status === "failed" &&
      !canRestartFailedPaperTradingEvaluation(existingEvaluation)
    ) {
      const response = await tradingRunResponse(this.options.store, tradingRunId);
      return {
        statusCode: 409,
        body: {
          error: "paper_trading_evaluation_failed_requires_repair",
          status: "failed_requires_repair",
          ...response,
          paper_trading_evaluation: existingEvaluation,
          runner_status: this.runner.active(tradingRunId) ? "running" : "stopped"
        }
      };
    }

    try {
      const prepared = await this.preparePaperTradingEvaluation({
        candidate,
        existingEvaluation,
        gatewayRuntimeBinding
      });
      if (prepared.verification.status === "invalidated") {
        const invalidatedEvaluation = await this.persistCommitmentInvalidation({
          candidate,
          evaluation: prepared.evaluation,
          verification: prepared.verification
        });
        return {
          statusCode: 409,
          body: {
            error: "paper_trading_evaluation_invalidated",
            reason: prepared.verification.reason,
            paper_trading_evaluation: invalidatedEvaluation,
            candidate_version_id: candidateVersionId,
            runner_status: "stopped"
          }
        };
      }

      if (prepared.evaluation.status === "running") {
        if (!this.runner.active(tradingRunId)) {
          const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(
            tradingRunId,
            gatewayRuntimeBinding
          );
          await this.restartTradingRunSandboxWithProvider({
            candidate,
            tradingRunId,
            candidateVersionId,
            paperOrderRequest: paperOrderRequestFromCandidateRuntime(candidate),
            tradingApiBaseUrl
          });
          const resumedEvaluation = await this.recordObservation({
            tradingRunId,
            gatewayRuntimeBinding
          });
          if (resumedEvaluation.evaluation.status === "running") {
            this.schedule(tradingRunId);
          } else {
            await this.stopTerminalSession(tradingRunId);
          }
          const response = await tradingRunResponse(this.options.store, tradingRunId);
          return {
            statusCode: resumedEvaluation.evaluation.status === "invalidated" ? 409 : 200,
            body: {
              status: resumedEvaluation.evaluation.status === "invalidated" ? "invalidated" : "resumed",
              ...response,
              paper_trading_evaluation: resumedEvaluation.evaluation,
              paper_trading_observation: resumedEvaluation.observation,
              runner_status: this.runner.active(tradingRunId) ? "running" : "stopped"
            }
          };
        }

        await this.ensurePaperTradingApiProviderSession(tradingRunId, gatewayRuntimeBinding);
        this.schedule(tradingRunId);
        const response = await tradingRunResponse(this.options.store, tradingRunId);
        return {
          statusCode: 200,
          body: {
            status: "already_running",
            ...response,
            paper_trading_evaluation: prepared.evaluation,
            runner_status: this.runner.active(tradingRunId) ? "running" : "stopped"
          }
        };
      }

      const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(
        tradingRunId,
        gatewayRuntimeBinding
      );
      const outcome = await this.startTradingRun({
        candidate,
        systemId: candidateId,
        tradingRunId,
        candidateVersionId,
        paperOrderRequest,
        tradingApiBaseUrl
      });
      await this.markPaperTradingEvaluationRunning({
        evaluation: prepared.evaluation,
        failedSessionEventIds
      });
      const paperTradingEvaluation = await this.recordObservation({
        tradingRunId,
        gatewayRuntimeBinding
      });
      if (paperTradingEvaluation.evaluation.status === "running") {
        this.schedule(tradingRunId);
      } else {
        await this.stopTerminalSession(tradingRunId);
      }
      const response = await tradingRunResponse(this.options.store, tradingRunId);

      return {
        statusCode: paperTradingEvaluation.evaluation.status === "invalidated" ? 409 : 201,
        body: {
          ...outcome,
          ...response,
          order_request: response?.ledger?.latest_order_request,
          gateway_result: response?.ledger?.latest_gateway_result,
          execution_result: response?.ledger?.latest_execution_result,
          paper_trading_evaluation: paperTradingEvaluation.evaluation,
          paper_trading_observation: paperTradingEvaluation.observation,
          runner_status: this.runner.active(tradingRunId) ? "running" : "stopped"
        }
      };
    } catch (error) {
      await this.cleanupFailedStart(tradingRunId);
      if (error instanceof PaperTradingCommandError) {
        return {
          statusCode: tradingRunStatusCode(error.code),
          body: {
            error: "trading_run_failed",
            reason: error.code,
            system_id: candidateId,
            candidate_version_id: candidateVersionId
          }
        };
      }
      if (isStoreErrorLike(error)) {
        return {
          statusCode: tradingRunStatusCode(error.code),
          body: {
            error: "trading_run_failed",
            reason: error.code,
            system_id: candidateId,
            candidate_version_id: candidateVersionId
          }
        };
      }
      throw error;
    }
  }

  async observe(tradingRunId: string): Promise<PaperTradingCommandResponse> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    let paperTradingEvaluation: Awaited<ReturnType<typeof recordPaperTradingEvaluationObservation>> | undefined;
    if (candidate?.runtime.runtime_lifecycle_status === "running") {
      const gatewayRuntimeBinding = createGatewayRuntimeBinding({
        environment: "paper",
        marketData: this.options.marketData
      });
      const existingEvaluation = await this.options.store
        .getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
      if (existingEvaluation && existingEvaluation.status !== "invalidated") {
        const prepared = await this.preparePaperTradingEvaluation({
          candidate,
          existingEvaluation,
          gatewayRuntimeBinding
        });
        if (prepared.verification.status === "invalidated") {
          paperTradingEvaluation = {
            evaluation: await this.persistCommitmentInvalidation({
              candidate,
              evaluation: prepared.evaluation,
              verification: prepared.verification
            })
          };
        } else {
          const providerWasActive = this.apiProviderSessions.has(tradingRunId);
          const tradingApiBaseUrl = await this.ensurePaperTradingApiProviderSession(
            tradingRunId,
            gatewayRuntimeBinding
          );
          if (!providerWasActive) {
            await this.restartTradingRunSandboxWithProvider({
              candidate,
              tradingRunId,
              candidateVersionId: candidate.candidate_version.candidate_version_id,
              paperOrderRequest: paperOrderRequestFromCandidateRuntime(candidate),
              tradingApiBaseUrl
            });
          }
          paperTradingEvaluation = await this.recordObservation({
            tradingRunId,
            gatewayRuntimeBinding
          });
        }
        if (paperTradingEvaluation.evaluation.status !== "running") {
          await this.stopTerminalSession(tradingRunId);
        }
      }
    }

    const response = await tradingRunResponse(this.options.store, tradingRunId);
    if (!response) {
      return {
        statusCode: 404,
        body: {
          error: "trading_run_not_found",
          trading_run_id: tradingRunId
        }
      };
    }
    return {
      statusCode: 200,
      body: {
        status: "observed",
        ...response,
        paper_trading_evaluation: paperTradingEvaluation?.evaluation,
        paper_trading_observation: paperTradingEvaluation?.observation,
        runner_status: this.runner.active(tradingRunId) ? "running" : "stopped"
      }
    };
  }

  async stop(tradingRunId: string): Promise<PaperTradingCommandResponse> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    if (!candidate) {
      return {
        statusCode: 404,
        body: {
          error: "trading_run_not_found",
          trading_run_id: tradingRunId
        }
      };
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
    await this.stopLinkedSandbox(tradingRunId);
    this.runner.stop(tradingRunId);
    await this.stopApiProviderSession(tradingRunId);
    const existingEvaluation = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const stoppedAt = new Date().toISOString();
    const stoppedEvaluation = existingEvaluation
      ? existingEvaluation.status === "invalidated"
        ? existingEvaluation
        : await this.options.store.recordPaperTradingEvaluation({
            ...existingEvaluation,
            status: "stopped",
            next_observation_at: undefined,
            stopped_at: stoppedAt
          })
      : undefined;

    const response = await tradingRunResponse(this.options.store, tradingRunId);
    return {
      statusCode: 201,
      body: {
        status: "stopped",
        ...response,
        paper_trading_evaluation: stoppedEvaluation,
        runner_status: "stopped"
      }
    };
  }

  async stopAllSessions(): Promise<void> {
    for (const tradingRunId of [...this.apiProviderSessions.keys()]) {
      this.runner.stop(tradingRunId);
      await this.stopLinkedSandbox(tradingRunId).catch(() => undefined);
      await this.stopApiProviderSession(tradingRunId);
    }
    await this.runner.drain();
  }

  private async preparePaperTradingEvaluation(input: {
    candidate: CandidateInspectReadModel;
    existingEvaluation?: PaperTradingEvaluationRecord;
    gatewayRuntimeBinding: GatewayRuntimeBinding;
  }): Promise<PreparedPaperTradingEvaluation> {
    if (input.existingEvaluation) {
      const commitmentRef = input.existingEvaluation.paper_trading_evaluation_commitment_ref;
      if (!commitmentRef) {
        return {
          evaluation: input.existingEvaluation,
          verification: {
            status: "invalidated",
            reason: "commitment_missing",
            diagnostic: "PaperTradingEvaluation has no persisted commitment reference."
          }
        };
      }
      const commitment = await this.options.store.getPaperTradingEvaluationCommitment(
        commitmentRef.id
      );
      if (!commitment) {
        return {
          evaluation: input.existingEvaluation,
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
          evaluation: input.existingEvaluation,
          commitment,
          verification: {
            status: "invalidated",
            reason: "system_code_identity_mismatch",
            diagnostic: "Committed SystemCode was not found."
          }
        };
      }
      let resolvedArtifactDigest: string;
      try {
        resolvedArtifactDigest = await this.options.artifactResolver.resolveArtifactDigest(systemCode);
      } catch (error) {
        return {
          evaluation: input.existingEvaluation,
          commitment,
          verification: {
            status: "invalidated",
            reason: "resolved_artifact_digest_mismatch",
            diagnostic: error instanceof Error
              ? `Unable to resolve committed SystemCode artifact: ${error.message}`
              : "Unable to resolve committed SystemCode artifact."
          }
        };
      }
      return {
        evaluation: input.existingEvaluation,
        commitment,
        verification: verifyPaperTradingEvaluationCommitment({
          commitment,
          evaluation: input.existingEvaluation,
          candidate: input.candidate,
          systemCode,
          resolvedArtifactDigest,
          marketData: input.gatewayRuntimeBinding.marketData,
          intervalMs: this.intervalMs
        })
      };
    }

    const systemCodeId = input.candidate.system_code?.ref?.id ?? FIXTURE_SYSTEM_CODE_ID;
    const systemCode = await this.options.store.getSystemCode(systemCodeId);
    if (!systemCode) {
      throw new PaperTradingCommandError(
        "system_code_not_found",
        `system code ${systemCodeId} not found`,
        { system_code_id: systemCodeId }
      );
    }
    let resolvedArtifactDigest: string;
    try {
      resolvedArtifactDigest = await this.options.artifactResolver.resolveArtifactDigest(systemCode);
    } catch (error) {
      throw new PaperTradingCommandError(
        "system_code_artifact_unreadable",
        error instanceof Error ? error.message : "SystemCode artifact could not be resolved.",
        { system_code_id: systemCodeId }
      );
    }
    const committedAt = new Date().toISOString();
    const initialEngineState = initialPaperTradingEngineState();
    const commitment = createPaperTradingEvaluationCommitment({
      commitmentId: `paper-trading-evaluation-commitment-${safeRouteId([
        input.candidate.runtime.ref.id,
        input.candidate.candidate_version.candidate_version_id
      ].join(":"))}`,
      evidencePurpose: "research_feedback",
      candidate: input.candidate,
      systemCode,
      resolvedArtifactDigest,
      marketData: input.gatewayRuntimeBinding.marketData,
      intervalMs: this.intervalMs,
      initialAccountSnapshot: initialEngineState.account,
      committedAt
    });
    await this.options.store.recordPaperTradingEvaluationCommitment(commitment);
    const evaluation: PaperTradingEvaluationRecord = {
      record_kind: "paper_trading_evaluation",
      version: 1,
      paper_trading_evaluation_id: `paper-trading-evaluation-${safeRouteId(
        input.candidate.runtime.ref.id
      )}`,
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
    return {
      evaluation,
      commitment,
      verification: verifyPaperTradingEvaluationCommitment({
        commitment,
        evaluation,
        candidate: input.candidate,
        systemCode,
        resolvedArtifactDigest,
        marketData: input.gatewayRuntimeBinding.marketData,
        intervalMs: this.intervalMs
      })
    };
  }

  private async markPaperTradingEvaluationRunning(input: {
    evaluation: PaperTradingEvaluationRecord;
    failedSessionEventIds: string[];
  }): Promise<PaperTradingEvaluationRecord> {
    const startedAt = new Date().toISOString();
    return this.options.store.recordPaperTradingEvaluation({
      ...input.evaluation,
      status: "running",
      stopped_at: undefined,
      next_observation_at: new Date(Date.parse(startedAt) + this.intervalMs).toISOString(),
      latest_failure_reason: undefined,
      processed_trading_system_event_ids: [...new Set([
        ...(input.evaluation.processed_trading_system_event_ids ?? []),
        ...input.failedSessionEventIds
      ])]
    });
  }

  private async recordObservation(input: {
    tradingRunId: string;
    gatewayRuntimeBinding: GatewayRuntimeBinding;
  }): Promise<Awaited<ReturnType<typeof recordPaperTradingEvaluationObservation>>> {
    const result = await recordPaperTradingEvaluationObservation({
      store: this.options.store,
      tradingRunId: input.tradingRunId,
      gatewayRuntimeBinding: input.gatewayRuntimeBinding,
      appendLedger: true,
      intervalMs: this.intervalMs,
      refreshCandidate: (candidate) => this.refreshPaperTradingSandbox(candidate),
      verifyCommitment: async (evaluation, candidate) => (
        await this.preparePaperTradingEvaluation({
          candidate,
          existingEvaluation: evaluation,
          gatewayRuntimeBinding: input.gatewayRuntimeBinding
        })
      ).verification
    });
    if (result.evaluation.status === "invalidated") {
      const candidate = await this.options.store.getCandidateForTradingRun(input.tradingRunId);
      if (candidate) {
        await this.recordCommitmentInvalidationAudit(candidate, result.evaluation);
      }
    }
    return result;
  }

  private async persistCommitmentInvalidation(input: {
    candidate: CandidateInspectReadModel;
    evaluation: PaperTradingEvaluationRecord;
    verification: Extract<PaperTradingEvaluationCommitmentVerification, { status: "invalidated" }>;
  }): Promise<PaperTradingEvaluationRecord> {
    const invalidatedEvaluation = await this.options.store.recordPaperTradingEvaluation(
      invalidatePaperTradingEvaluation({
        evaluation: input.evaluation,
        verification: input.verification,
        invalidatedAt: new Date().toISOString()
      })
    );
    await this.recordCommitmentInvalidationAudit(input.candidate, invalidatedEvaluation);
    await this.stopTerminalSession(input.evaluation.trading_run_ref.id);
    return invalidatedEvaluation;
  }

  private async recordCommitmentInvalidationAudit(
    candidate: CandidateInspectReadModel,
    evaluation: PaperTradingEvaluationRecord
  ): Promise<void> {
    await this.options.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
      idempotencyKey: [
        "paper-commitment-invalidated",
        evaluation.paper_trading_evaluation_id,
        evaluation.invalidation_reason ?? "unknown"
      ].join(":"),
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: evaluation.trading_run_ref.id,
      action: "inspect",
      lifecycleStatus: "stopped",
      actorId: "runtime-api",
      reasonSummary: `Paper commitment invalidated: ${evaluation.invalidation_reason ?? "unknown"}.`,
      message: "Paper TradingEvaluation stopped before additional evidence was recorded."
    }));
  }

  private async startTradingRun(input: {
    candidate: CandidateInspectReadModel;
    systemId: string;
    tradingRunId: string;
    candidateVersionId: string;
    paperOrderRequest: PaperOrderRequestFixture;
    tradingApiBaseUrl: string;
  }) {
    await this.ensureTradingRunSandbox({
      candidate: input.candidate,
      tradingRunId: input.tradingRunId,
      candidateVersionId: input.candidateVersionId,
      paperOrderRequest: input.paperOrderRequest,
      tradingApiBaseUrl: input.tradingApiBaseUrl
    });
    await this.options.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
      idempotencyKey: `trading-run-start:${input.paperOrderRequest}:${input.tradingRunId}:${input.candidateVersionId}`,
      candidateId: input.systemId,
      candidateVersionId: input.candidateVersionId,
      tradingRunId: input.tradingRunId,
      action: "start",
      lifecycleStatus: "running",
      actorId: "runtime-api",
      reasonSummary: "Operator requested trading run start.",
      message: "Trading run start recorded."
    }));

    const response = await tradingRunResponse(this.options.store, input.tradingRunId);

    return {
      status: "started",
      ...response,
      trading_gateway_environment: this.options.tradingGatewayEnvironment
    } as const;
  }

  private schedule(tradingRunId: string): void {
    this.runner.start({
      tradingRunId,
      intervalMs: this.intervalMs,
      observe: async () => {
        const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
        if (candidate?.runtime.runtime_lifecycle_status !== "running") {
          this.runner.stop(tradingRunId);
          await this.stopApiProviderSession(tradingRunId);
          return;
        }
        const result = await this.recordObservation({
          tradingRunId,
          gatewayRuntimeBinding: createGatewayRuntimeBinding({
            environment: "paper",
            marketData: this.options.marketData
          })
        });
        if (result.evaluation.status !== "running") {
          await this.stopTerminalSession(tradingRunId);
        }
      },
      onError: (error) => this.options.logger?.error(error)
    });
  }

  private async stopTerminalSession(tradingRunId: string): Promise<void> {
    this.runner.stop(tradingRunId);
    await this.stopApiProviderSession(tradingRunId);
    await this.stopLinkedSandbox(tradingRunId);
  }

  private async cleanupFailedStart(tradingRunId: string): Promise<void> {
    this.runner.stop(tradingRunId);
    await Promise.allSettled([
      this.stopApiProviderSession(tradingRunId),
      this.stopLinkedSandbox(tradingRunId)
    ]);
  }

  private async restartTradingRunSandboxWithProvider(input: {
    candidate: CandidateInspectReadModel;
    tradingRunId: string;
    candidateVersionId: string;
    paperOrderRequest: PaperOrderRequestFixture;
    tradingApiBaseUrl: string;
  }): Promise<void> {
    await this.stopLinkedSandbox(input.tradingRunId);
    await this.ensureTradingRunSandbox(input);
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

  private async stopApiProviderSession(tradingRunId: string): Promise<void> {
    const provider = this.apiProviderSessions.get(tradingRunId);
    if (!provider) {
      return;
    }
    this.apiProviderSessions.delete(tradingRunId);
    await provider.close();
  }

  private async latestPaperAccountState(
    tradingRunId: string,
    gatewayRuntimeBinding: GatewayRuntimeBinding
  ): Promise<AccountState> {
    const fallback = gatewayRuntimeBinding.account.provider_kind === "fake_paper_account"
      ? gatewayRuntimeBinding.account.state
      : {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        };
    const evaluation = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const equity = parseFiniteAccountNumber(evaluation?.paper_account_snapshot?.equity_usdt);
    return {
      ...fallback,
      equity: equity ?? fallback.equity
    };
  }

  private async refreshPaperTradingSandbox(
    candidate: CandidateInspectReadModel
  ): Promise<CandidateInspectReadModel> {
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
      return await this.options.store.getCandidateForTradingRun(candidate.runtime.ref.id) ?? candidate;
    }
    return candidate;
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
      throw new PaperTradingCommandError(
        "system_code_not_found",
        `system code ${systemCodeId} not found`,
        { system_code_id: systemCodeId }
      );
    }

    const idempotencyKey = [
      "trading-run-sandbox",
      input.paperOrderRequest,
      input.tradingRunId,
      input.candidateVersionId
    ].join(":");
    const sandboxId = `sandbox-${safeRouteId(idempotencyKey)}`;
    const existing = await this.options.store.getSandbox(sandboxId);
    const linked = await this.linkedSandbox(input.tradingRunId);
    const deterministicSandboxAdapter = this.options.sandboxAdapters.deterministic_test;
    if (
      existing &&
      existing.lifecycle_status === "running" &&
      linked?.sandbox_id === existing.sandbox_id
    ) {
      const observations = await requireSandboxAdapterMethod(
        deterministicSandboxAdapter,
        "getArtifactInstanceStatus"
      )(existing);
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
        (
          observations.lifecycle_status === "running" ||
          hasFreshSandboxHeartbeat(existing, observations)
        )
      ) {
        return verified;
      }
      if (verified.lifecycle_status !== "stopped" && verified.lifecycle_status !== "removed") {
        const stopObservations = await requireSandboxAdapterMethod(
          deterministicSandboxAdapter,
          "stopArtifactInstance"
        )(verified);
        await this.options.store.stopSandbox(
          {
            sandbox_id: verified.sandbox_id,
            stopped_at: stopObservations.stopped_at,
            removed_at: stopObservations.removed_at
          },
          stopObservations
        );
      }
    }

    const adapterResult = await deterministicSandboxAdapter.startArtifactInstance({
      artifact,
      instance_id: sandboxId,
      sandbox_name: `ouro-trading-run-${safeRouteId(input.tradingRunId).slice(0, 34)}-${input.paperOrderRequest}`,
      runtime_ref: { record_kind: "trading_run", id: input.tradingRunId },
      sandbox_placement_id: `sandbox-placement-${safeRouteId(sandboxId)}`,
      created_at: existing?.created_at ?? new Date().toISOString(),
      interval_ms: this.sandboxIntervalMs,
      paper_order_request: input.paperOrderRequest,
      env: input.tradingApiBaseUrl
        ? { TRADING_API_BASE_URL: input.tradingApiBaseUrl }
        : undefined
    });
    return (await this.options.store.recordSandboxStart(adapterResult)).sandbox;
  }

  private async stopLinkedSandbox(tradingRunId: string): Promise<SandboxDetailReadModel | undefined> {
    const sandbox = await this.linkedSandbox(tradingRunId);
    if (!sandbox || sandbox.lifecycle_status === "stopped" || sandbox.lifecycle_status === "removed") {
      return sandbox;
    }

    const observations = await requireSandboxAdapterMethod(
      this.options.sandboxAdapters[sandbox.adapter_kind],
      "stopArtifactInstance"
    )(sandbox);
    return (await this.options.store.stopSandbox(
      {
        sandbox_id: sandbox.sandbox_id,
        stopped_at: observations.stopped_at,
        removed_at: observations.removed_at
      },
      observations
    )).sandbox;
  }

  private async linkedSandbox(tradingRunId: string): Promise<SandboxDetailReadModel | undefined> {
    const tradingRun = await this.options.store.getTradingRun(tradingRunId);
    if (!tradingRun?.sandbox_ref) {
      return undefined;
    }
    return this.options.store.getSandbox(tradingRun.sandbox_ref.id);
  }
}

export function paperTradingApiProviderNetworkOptions(input: {
  sandboxHost?: string;
}): Pick<PaperTradingApiProviderOptions, "listen_host" | "sandbox_host"> {
  const sandboxHost = input.sandboxHost?.trim() || undefined;
  return sandboxHost
    ? {
        listen_host: "0.0.0.0",
        sandbox_host: sandboxHost
      }
    : {};
}

export async function tradingRunResponse(store: OuroborosStorePort, tradingRunId: string) {
  const tradingRun = await store.getTradingRun(tradingRunId);
  if (!tradingRun) {
    return undefined;
  }
  const candidate = await store.getCandidateForTradingRun(tradingRunId);

  return {
    trading_run_id: tradingRunId,
    trading_run: {
      ref: { record_kind: "trading_run", id: tradingRunId },
      stage: tradingRun.stage_binding_profile,
      lifecycle_status: tradingRun.runtime_lifecycle_status,
      authority_status: tradingRun.authority_status
    },
    trading_system: candidate?.trading_system,
    ledger: candidate?.ledger,
    run_control: candidate?.runtime.run_control,
    sandbox: candidate?.runtime.sandbox,
    transcript: candidate?.runtime.transcript
  };
}

function startPaperOrderRequest(body: StartPaperTradingRunPayload | undefined): PaperOrderRequestFixture | undefined {
  if (!body?.paper_order_request) {
    return "valid";
  }
  if (body.paper_order_request === "valid" || body.paper_order_request === "rejected") {
    return body.paper_order_request;
  }
  return undefined;
}

function paperOrderRequestFromCandidateRuntime(candidate: CandidateInspectReadModel): PaperOrderRequestFixture {
  return candidate.runtime.sandbox?.sandbox_name?.endsWith("-rejected") ? "rejected" : "valid";
}

function restartFailedPaperTradingEvaluationProcessedEventIds(input: {
  candidate: CandidateInspectReadModel;
  evaluation: PaperTradingEvaluationRecord | undefined;
}): string[] {
  if (
    input.evaluation?.status !== "failed" ||
    !canRestartFailedPaperTradingEvaluation(input.evaluation)
  ) {
    return [];
  }
  const failure = classifyPaperTradingFailure(input.evaluation.latest_failure_reason);
  if (
    failure?.failure_kind !== "sandbox_or_runner_failure" &&
    failure?.failure_kind !== "runner_health_loss"
  ) {
    return [];
  }
  return tradingSystemEventIdsFromCandidate(input.candidate);
}

function startRuntimeEnvironment(
  body: StartPaperTradingRunPayload | undefined
): TradingRuntimeEnvironment | undefined {
  if (!body?.runtime_environment) {
    return "paper";
  }
  if (body.runtime_environment === "paper" || body.runtime_environment === "live") {
    return body.runtime_environment;
  }
  return undefined;
}

function requireSandboxAdapterMethod<T extends keyof Required<SandboxAdapterRegistryPort[SandboxAdapterKind]>>(
  adapter: SandboxAdapterRegistryPort[SandboxAdapterKind],
  method: T
): NonNullable<SandboxAdapterRegistryPort[SandboxAdapterKind][T]> {
  const implementation = adapter[method];
  if (typeof implementation !== "function") {
    throw new PaperTradingCommandError(
      "sandbox_adapter_method_not_supported",
      `sandbox adapter does not support ${String(method)}`,
      { method }
    );
  }
  return implementation.bind(adapter) as NonNullable<SandboxAdapterRegistryPort[SandboxAdapterKind][T]>;
}

function parseFiniteAccountNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasFreshSandboxHeartbeat(
  existing: SandboxDetailReadModel,
  observations: SandboxAdapterObservationResult
): boolean {
  const previousHeartbeatAt = existing.last_heartbeat_at ? Date.parse(existing.last_heartbeat_at) : undefined;
  return observations.heartbeats?.some((heartbeat) => {
    const observedAt = Date.parse(heartbeat.observed_at);
    return Number.isFinite(observedAt) &&
      (
        previousHeartbeatAt === undefined ||
        !Number.isFinite(previousHeartbeatAt) ||
        observedAt > previousHeartbeatAt
      );
  }) ?? false;
}

function safeRouteId(value: string): string {
  const prefix = safeId(value, { maxLength: 72 });
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${digest}`;
}

function tradingRunStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" || reason === "system_code_not_found" ? 404 : 422;
}

function shouldRefreshSandboxStatus(lifecycleStatus: string): boolean {
  return lifecycleStatus !== "stopped" && lifecycleStatus !== "removed" && lifecycleStatus !== "failed";
}
