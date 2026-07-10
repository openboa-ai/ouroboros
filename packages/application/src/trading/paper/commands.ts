import type {
  PaperTradingEvaluationRecord,
  TradingGatewayEnvironmentReadModel,
  TradingRuntimeEnvironment
} from "@ouroboros/domain";
import { isStoreErrorLike, type OuroborosStorePort } from "../../ports/store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { PaperOrderRequestFixture } from "../../ports/sandbox";
import {
  createGatewayRuntimeBinding,
  LIVE_GATEWAY_DISABLED_REASON,
  type PaperTradingApiProviderOptions
} from "../gateway/runtime-binding";
import { classifyPaperTradingFailure } from "./failures";
import {
  canRestartFailedPaperTradingEvaluation,
  tradingSystemEventIdsFromCandidate
} from "./observation";
import {
  PaperTradingSessionError,
  PaperTradingSessionService
} from "./session-service";

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
  marketData: GatewayMarketDataPort;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  sessions: PaperTradingSessionService;
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

export class PaperTradingCommandService {
  private readonly sessions: PaperTradingSessionService;

  constructor(private readonly options: PaperTradingCommandServiceOptions) {
    this.sessions = options.sessions;
  }

  active(tradingRunId: string): boolean {
    return this.sessions.active(tradingRunId);
  }

  async start(candidateId: string, payload: unknown): Promise<PaperTradingCommandResponse> {
    const body = payload as StartPaperTradingRunPayload | undefined;
    const runtimeEnvironment = startRuntimeEnvironment(body);
    if (!runtimeEnvironment) {
      return {
        statusCode: 400,
        body: { error: "invalid_runtime_environment", allowed_values: ["paper", "live"] }
      };
    }
    const binding = createGatewayRuntimeBinding({ environment: runtimeEnvironment, marketData: this.options.marketData });
    if (binding.status === "disabled") {
      return {
        statusCode: 422,
        body: {
          error: "gateway_runtime_binding_disabled",
          reason: binding.disabled_reason ?? LIVE_GATEWAY_DISABLED_REASON,
          runtime_environment: binding.environment
        }
      };
    }
    if (!startPaperOrderRequest(body)) {
      return {
        statusCode: 400,
        body: { error: "invalid_paper_order_request", allowed_values: ["valid", "rejected"] }
      };
    }
    const candidate = await this.options.store.getCandidate(candidateId);
    if (!candidate) {
      return { statusCode: 404, body: { error: "trading_system_not_found", system_id: candidateId } };
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
    if (existingEvaluation?.status === "failed" && !canRestartFailedPaperTradingEvaluation(existingEvaluation)) {
      return {
        statusCode: 409,
        body: {
          error: "paper_trading_evaluation_failed_requires_repair",
          status: "failed_requires_repair",
          ...await tradingRunResponse(this.options.store, tradingRunId),
          paper_trading_evaluation: existingEvaluation,
          runner_status: this.sessions.active(tradingRunId) ? "running" : "stopped"
        }
      };
    }
    try {
      const wasActive = this.sessions.active(tradingRunId);
      const prepared = await this.sessions.prepare({
        candidateId,
        candidateVersionId,
        tradingRunId,
        evidencePurpose: "research_feedback",
        clock: "scheduled"
      });
      if (wasActive) {
        return {
          statusCode: 200,
          body: {
            status: "already_running",
            ...await tradingRunResponse(this.options.store, tradingRunId),
            paper_trading_evaluation: prepared.evaluation,
            runner_status: this.sessions.active(tradingRunId) ? "running" : "stopped"
          }
        };
      }
      await this.sessions.activate(prepared, {
        paperOrderRequest: body?.paper_order_request,
        restartFailedEventIds: restartFailedPaperTradingEvaluationProcessedEventIds({
          candidate,
          evaluation: existingEvaluation
        })
      });
      const observed = await this.sessions.observe(tradingRunId);
      if (observed.evaluation.status === "invalidated") {
        return {
          statusCode: 409,
          body: {
            error: "paper_trading_evaluation_invalidated",
            status: "invalidated",
            reason: observed.evaluation.invalidation_reason,
            paper_trading_evaluation: observed.evaluation,
            candidate_version_id: candidateVersionId,
            runner_status: "stopped"
          }
        };
      }
      if (observed.evaluation.status === "running") {
        await this.sessions.schedule(tradingRunId);
      }
      const response = await tradingRunResponse(this.options.store, tradingRunId);
      return {
        statusCode: existingEvaluation?.status === "running" ? 200 : 201,
        body: {
          status: existingEvaluation?.status === "running" ? "resumed" : "started",
          ...response,
          order_request: response?.ledger?.latest_order_request,
          gateway_result: response?.ledger?.latest_gateway_result,
          execution_result: response?.ledger?.latest_execution_result,
          trading_gateway_environment: this.options.tradingGatewayEnvironment,
          paper_trading_evaluation: observed.evaluation,
          paper_trading_observation: observed.observation,
          runner_status: this.sessions.active(tradingRunId) ? "running" : "stopped"
        }
      };
    } catch (error) {
      if (error instanceof PaperTradingSessionError && error.code === "paper_trading_evaluation_invalidated") {
        return {
          statusCode: 409,
          body: {
            error: "paper_trading_evaluation_invalidated",
            reason: error.details.reason,
            paper_trading_evaluation: error.details.paper_trading_evaluation,
            candidate_version_id: candidateVersionId,
            runner_status: "stopped"
          }
        };
      }
      if (error instanceof PaperTradingSessionError || error instanceof PaperTradingCommandError || isStoreErrorLike(error)) {
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
    if (!candidate) {
      return { statusCode: 404, body: { error: "trading_run_not_found", trading_run_id: tradingRunId } };
    }
    const existing = await this.options.store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    let observed: Awaited<ReturnType<PaperTradingSessionService["observe"]>> | undefined;
    if (candidate.runtime.runtime_lifecycle_status === "running" && existing?.status !== "invalidated") {
      try {
        const run = await this.options.store.getTradingRun(tradingRunId);
        await this.sessions.prepare({
          candidateId: candidate.candidate_id,
          candidateVersionId: candidate.candidate_version.candidate_version_id,
          tradingRunId,
          evidencePurpose: run?.paper_evidence_purpose ?? "research_feedback",
          clock: "scheduled"
        });
        observed = await this.sessions.observe(tradingRunId);
      } catch (error) {
        if (error instanceof PaperTradingSessionError && error.code === "paper_trading_evaluation_invalidated") {
          observed = { evaluation: error.details.paper_trading_evaluation as PaperTradingEvaluationRecord };
        } else {
          throw error;
        }
      }
    }
    return {
      statusCode: 200,
      body: {
        status: "observed",
        ...await tradingRunResponse(this.options.store, tradingRunId),
        paper_trading_evaluation: observed?.evaluation,
        paper_trading_observation: observed?.observation,
        runner_status: this.sessions.active(tradingRunId) ? "running" : "stopped"
      }
    };
  }

  async stop(tradingRunId: string): Promise<PaperTradingCommandResponse> {
    const candidate = await this.options.store.getCandidateForTradingRun(tradingRunId);
    if (!candidate) {
      return { statusCode: 404, body: { error: "trading_run_not_found", trading_run_id: tradingRunId } };
    }
    const stopped = await this.sessions.stop(tradingRunId);
    return {
      statusCode: 201,
      body: {
        status: "stopped",
        ...await tradingRunResponse(this.options.store, tradingRunId),
        paper_trading_evaluation: stopped,
        runner_status: "stopped"
      }
    };
  }

  async stopAllSessions(): Promise<void> {
    await this.sessions.stopAllSessions();
  }
}

export function paperTradingApiProviderNetworkOptions(input: {
  sandboxHost?: string;
}): Pick<PaperTradingApiProviderOptions, "listen_host" | "sandbox_host"> {
  const sandboxHost = input.sandboxHost?.trim() || undefined;
  return sandboxHost ? { listen_host: "0.0.0.0", sandbox_host: sandboxHost } : {};
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
  return body.paper_order_request === "valid" || body.paper_order_request === "rejected"
    ? body.paper_order_request
    : undefined;
}

function restartFailedPaperTradingEvaluationProcessedEventIds(input: {
  candidate: Parameters<typeof tradingSystemEventIdsFromCandidate>[0];
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
  return body.runtime_environment === "paper" || body.runtime_environment === "live"
    ? body.runtime_environment
    : undefined;
}

function tradingRunStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" || reason === "system_code_not_found" ? 404 : 422;
}
