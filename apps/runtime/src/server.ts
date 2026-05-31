import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type {
  CandidateInspectReadModel,
  CandidateSummaryReadModel,
  ReplayRunEvidenceReadModel,
  EvaluationExecutionMode,
  LedgerInput,
  LedgerWriteOutcome,
  PaperTradingAccountSnapshot,
  PaperTradingDecisionOrderRequestSummary,
  PaperTradingDecisionSummary,
  PaperTradingEvaluationRecord,
  PaperTradingFillSummary,
  PaperTradingObservationRecord,
  PaperTradingOrderSummary,
  PaperTradingPublicExecutionSnapshotSummary,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureWriteInput,
  Ref,
  RunControlAuditInput,
  SandboxAdapterKind,
  SandboxDetailReadModel,
  TradingRuntimeEnvironment,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "@ouroboros/application/ports/market-data";
import { FIXTURE_SYSTEM_CODE_ID, LocalStore, LocalStoreError } from "@ouroboros/local-store";
import { runCandidateEvaluation } from "@ouroboros/application/candidate/evaluation";
import { FixtureEvaluationProviderAdapter } from "@ouroboros/adapters/fixture/evaluation-provider";
import type { EvaluationProviderAdapter } from "@ouroboros/application/ports/provider";
import {
  DeterministicSandboxAdapter,
  DockerSandboxesSbxSandboxAdapter,
  type PaperOrderRequestFixture,
  type SandboxAdapter
} from "@ouroboros/adapters/sandbox/adapter";
import {
  DEFAULT_REPLAY_RUN_ROOT,
  getCandidateLatestValidationState,
  getReplayRunComparison,
  getReplayRunDetail,
  getReplayRunValidationState,
  listReplayRunEvidence
} from "@ouroboros/application/trading/candidate/replay-run-ledger";
import {
  DEFAULT_PROMOTED_CANDIDATE_ROOT,
  getPromotedCandidate,
  listPromotedCandidateSummaries
} from "@ouroboros/application/trading/candidate/promoted-candidate-bundles";
import {
  ReplayRunError,
  runPromotedCandidateReplay,
  type ReplayRunRecord
} from "@ouroboros/application/trading/candidate/run-replay";
import {
  createGatewayRuntimeBinding,
  executeGatewayOrderRequest,
  LIVE_GATEWAY_DISABLED_REASON,
  startPaperTradingApiProvider,
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { loadTradingGatewayEnvironment } from "@ouroboros/application/trading/gateway/environment";
import type {
  AccountState,
  MarketSnapshot,
  ReplayTradingApiProviderSession,
  TradingArtifactRunnerKind,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import type { ReplayTradingApiProviderFactory } from "@ouroboros/application/trading/research/replay-set-runner";
import {
  createTradingResearchAgentAdapter,
  loadTradingResearchRuntimeConfig,
  type TradingResearchRuntimeAgent,
  type TradingResearchRuntimeConfig
} from "@ouroboros/application/trading/research/runtime-config";
import {
  managedAgentProfileEnv,
  type AgentProfileExecFile
} from "@ouroboros/application/agent/profiles";
import { CandidateArenaRunner } from "@ouroboros/application/candidate/arena";
import { createOperatorController } from "@ouroboros/application/controllers/operator";
import {
  isTradingResearchRuntimeAgent,
  OperatorService
} from "@ouroboros/application/services/operator";
import {
  BinancePublicMarketSdkAdapter,
  type BinancePublicMarketDataClient
} from "@ouroboros/adapters/binance/public-market-adapter";
import {
  marketSnapshotSummary,
  zeroPaperTradingProfitLoss
} from "@ouroboros/application/trading/paper/evaluation";
import {
  applyPaperTradingCheckpoint,
  initialPaperTradingEngineState,
  restorePaperTradingEngineState,
  type PaperTradingEngineCheckpointResult,
  type PaperTradingEngineState
} from "@ouroboros/application/trading/paper/engine";
import {
  parseTradingSystemPaperEventLine,
  type ParsedTradingSystemPaperEvent,
  type PaperTradingSystemEvent
} from "@ouroboros/application/trading/paper/events";
import { safeId } from "@ouroboros/application/safe-id";
import { PaperTradingEvaluationRunner } from "./paper/evaluation-runner";
import { registerCoreControllerRoutes } from "./controllers/core";
import { registerResourceControllerRoutes } from "./controllers/resources";
import { registerRuntimeRouteModules } from "./registry/routes";

export interface BuildServerOptions {
  store?: LocalStore;
  evaluationProviderAdapter?: EvaluationProviderAdapter;
  sandboxAdapters?: Partial<Record<SandboxAdapterKind, SandboxAdapter>>;
  replayRunRoot?: string;
  promotedCandidateRoot?: string;
  tradingGatewayEnv?: Record<string, string | undefined>;
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchAgentAdapter?: TradingResearchAgentAdapter;
  tradingResearchAgentFactory?: (agent: TradingResearchRuntimeAgent) => TradingResearchAgentAdapter;
  tradingResearchRuntimeConfig?: TradingResearchRuntimeConfig;
  agentProfileExecFile?: AgentProfileExecFile;
  candidateArenaTickIntervalMs?: number;
  binancePublicMarketClient?: BinancePublicMarketDataClient;
  marketDataPort?: GatewayMarketDataPort;
  paperTradingEvaluationIntervalMs?: number;
  tradingApiProviderSandboxHost?: string;
  paperTradingApiProviderFactory?: (
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ) => Promise<ReplayTradingApiProviderSession>;
  candidateArenaArtifactRunner?: TradingArtifactRunner;
  candidateArenaReplayProviderFactory?: ReplayTradingApiProviderFactory;
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

interface CreateEvaluationRunBody {
  candidate_version_id?: string;
  idempotency_key?: string;
  stage?: string;
  execution_mode?: EvaluationExecutionMode;
}

interface StartTradingRunBody {
  paper_order_request?: string;
  runtime_environment?: string;
  research_agent?: string;
  research_iterations?: number;
}

interface RecordRunControlBody {
  candidate_version_id?: string;
  runtime_id?: string;
  idempotency_key?: string;
  command?: {
    action?: string;
    requested_lifecycle_status?: string;
    actor_kind?: string;
    actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    reason?: string;
    reason_summary?: string;
    trace_ref?: Ref;
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  decision?: {
    decision_outcome?: string;
    decision_reason?: string;
    decided_by_actor_kind?: string;
    decided_by_actor_ref?: Ref;
    runtime_operating_policy_ref?: Ref;
    resulting_lifecycle_status?: string;
    trace_ref?: Ref;
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  audit_event?: {
    event_kind?: string;
    actor_kind?: string;
    actor_ref?: Ref;
    runtime_lifecycle_status?: string;
    message?: string;
    trace_ref?: Ref;
    supporting_record_refs?: Ref[];
    related_order_request_refs?: Ref[];
    related_gateway_result_refs?: Ref[];
    related_execution_result_refs?: Ref[];
  };
  created_at?: string;
}

interface RecordPrivateReadinessPostureBody {
  idempotency_key?: string;
  venue?: string;
  instrument?: string;
  product_category?: string;
  operator_approval_gate?: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate?: PrivateReadinessPolicyGateInput;
  live_binding_gate?: PrivateReadinessPolicyGateInput;
  secret_handling_gate?: PrivateReadinessPolicyGateInput;
  stop_behavior_gate?: PrivateReadinessPolicyGateInput;
  secret_reference_configured?: boolean;
  secret_reference_ref?: Ref;
  source_ref?: Ref;
  observed_at?: string;
}

interface CreateReplayRunBody {
  runner_kind?: string;
  scenario_ids?: unknown;
  timeout_ms?: unknown;
}

interface StartSandboxBody {
  idempotency_key?: string;
  adapter_kind?: string;
  system_code_id?: string;
  trading_run_id?: string;
  sandbox_id?: string;
  sandbox_name?: string;
  test_ticks?: number;
  interval_ms?: number;
  created_at?: string;
}

interface RuntimeControllerResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
  const evaluationProviderAdapter = options.evaluationProviderAdapter ?? new FixtureEvaluationProviderAdapter();
  const tradingGatewayEnvironment = options.tradingGatewayEnvironment
    ?? loadTradingGatewayEnvironment(options.tradingGatewayEnv ?? process.env);
  const gatewayMarketDataPort = options.marketDataPort ?? new BinancePublicMarketSdkAdapter({
    restBaseUrl: tradingGatewayEnvironment.runtime_bindings.paper.rest_base_url,
    client: options.binancePublicMarketClient,
    webSocket: { autoConnect: false }
  });
  const paperTradingEvaluationRunner = new PaperTradingEvaluationRunner();
  const paperTradingEvaluationIntervalMs = options.paperTradingEvaluationIntervalMs ?? 60_000;
  const paperTradingApiProviderSessions = new Map<string, ReplayTradingApiProviderSession>();
  const paperTradingApiProviderFactory = options.paperTradingApiProviderFactory ?? startPaperTradingApiProvider;
  const tradingResearchRuntimeConfig = options.tradingResearchRuntimeConfig
    ?? loadTradingResearchRuntimeConfig();
  const tradingResearchAgentFactory = options.tradingResearchAgentFactory
    ?? ((agent: TradingResearchRuntimeAgent) => {
      if (options.tradingResearchAgentAdapter && options.tradingResearchAgentAdapter.agent.provider === agent) {
        return options.tradingResearchAgentAdapter;
      }
      return createTradingResearchAgentAdapter(tradingResearchRuntimeConfig, agent, {
        env: agent === "codex" ? managedAgentProfileEnv(store, "codex") : undefined
      });
    });
  const candidateArenaRunner = new CandidateArenaRunner({
    store,
    researchAgent: tradingResearchRuntimeConfig.default_agent,
    agentFactory: tradingResearchAgentFactory,
    artifactRunner: options.candidateArenaArtifactRunner,
    replayProviderFactory: options.candidateArenaReplayProviderFactory
  }, options.candidateArenaTickIntervalMs);
  const providedSandboxAdapters = options.sandboxAdapters;
  const sandboxAdapters: Record<SandboxAdapterKind, SandboxAdapter> = {
    deterministic_test: providedSandboxAdapters?.deterministic_test
      ?? new DeterministicSandboxAdapter({
        allowedArtifactRoots: [path.join(store.root(), "candidate-arena-runs")],
        allowedCapabilityPolicyIds: ["candidate-arena-paper-system-code"]
      }),
    docker_sandboxes_sbx: providedSandboxAdapters?.docker_sandboxes_sbx
      ?? new DockerSandboxesSbxSandboxAdapter()
  };
  await store.initialize();
  const persistedResearcherProvider = await store.getResearcherProviderSelection();
  if (
    persistedResearcherProvider
    && isTradingResearchRuntimeAgent(persistedResearcherProvider.selected_provider)
  ) {
    candidateArenaRunner.setResearchAgent(persistedResearcherProvider.selected_provider);
  }

  const server = Fastify({
    logger: false
  });
  server.addHook("onClose", async () => {
    for (const tradingRunId of [...paperTradingApiProviderSessions.keys()]) {
      paperTradingEvaluationRunner.stop(tradingRunId);
      await stopLinkedTradingRunSandbox({
        store,
        sandboxAdapters,
        tradingRunId
      }).catch(() => undefined);
      await stopPaperTradingApiProviderSession(tradingRunId);
    }
  });

  await server.register(cors, {
    origin: true,
    methods: ["GET", "POST"]
  });
  await server.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute"
  });
  const filesystemReadRateLimit = {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute"
      }
    }
  } as const;
  const commandMutationRateLimit = {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute"
      }
    }
  } as const;

  async function runCandidateEvaluationCommand(
    candidateId: string,
    payload: unknown
  ): Promise<RuntimeControllerResponse> {
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) {
      return {
        statusCode: 404,
        body: {
          error: "candidate_not_found",
          candidate_id: candidateId
        }
      };
    }

    const body = (payload ?? {}) as CreateEvaluationRunBody;
    if (body.stage !== undefined && body.stage !== "backtest") {
      return {
        statusCode: 422,
        body: {
          error: "evaluation_run_failed",
          reason: "unsupported_evaluation_stage",
          candidate_id: candidateId
        }
      };
    }

    const candidateVersionId = body.candidate_version_id ?? candidate.candidate_version.candidate_version_id;
    const requestedExecutionMode = body.execution_mode ?? "host_local";
    const idempotencyKey = body.idempotency_key
      ?? `runtime-api-evaluation-${candidateId}-${candidateVersionId}-backtest-${requestedExecutionMode}`;
    const stableRequestId = safeRouteId(`${candidateId}-${candidateVersionId}-${idempotencyKey}`);
    const outcome = await runCandidateEvaluation(store, evaluationProviderAdapter, {
      candidate_id: candidateId,
      candidate_version_id: candidateVersionId,
      idempotency_key: idempotencyKey,
      stage_binding_ref: {
        record_kind: "stage_binding",
        id: `stage-binding-api-evaluation-${stableRequestId}`
      },
      trace_id: `trace-api-evaluation-${stableRequestId}`,
      execution_mode: requestedExecutionMode
    });

    if (outcome.status === "failed") {
      const statusCode = outcome.failure_reason === "candidate_not_found" ? 404 : 422;
      return {
        statusCode,
        body: {
          error: statusCode === 404 ? "candidate_not_found" : "evaluation_run_failed",
          reason: outcome.failure_reason,
          candidate_id: candidateId,
          candidate_version_id: candidateVersionId,
          idempotency_key: idempotencyKey
        }
      };
    }

    return { statusCode: 201, body: outcome };
  }

  async function runCandidateReplayCommand(
    candidateId: string,
    payload: unknown
  ): Promise<RuntimeControllerResponse> {
    const candidate = await getCandidateReadModel(
      store,
      candidateId,
      options.promotedCandidateRoot,
      options.replayRunRoot
    );
    if (!candidate) {
      return {
        statusCode: 404,
        body: {
          error: "candidate_not_found",
          candidate_id: candidateId
        }
      };
    }
    if (candidate.fixture_notice.mode !== "local_promoted_candidate_bundle") {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "promoted_candidate_bundle_required",
          candidate_id: candidateId
        }
      };
    }

    const body = (payload ?? {}) as CreateReplayRunBody;
    if (hasRequestField(body, "run_id")) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "client_run_id_not_supported",
          candidate_id: candidateId
        }
      };
    }
    const runnerKind = parseReplayRunRunnerKind(body.runner_kind);
    if (!runnerKind) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "invalid_runner_kind",
          candidate_id: candidateId
        }
      };
    }
    if (runnerKind === "docker_sandboxes_sbx" && !isSbxRuntimeEnabled()) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "docker_sandboxes_sbx_runtime_disabled",
          candidate_id: candidateId
        }
      };
    }

    const scenarioIds = parseReplayRunScenarioIds(body.scenario_ids);
    if (!scenarioIds) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "invalid_scenario_ids",
          candidate_id: candidateId
        }
      };
    }
    const timeoutMs = parseOptionalPositiveInteger(body.timeout_ms);
    if (body.timeout_ms !== undefined && timeoutMs === undefined) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_rejected",
          reason: "invalid_timeout_ms",
          candidate_id: candidateId
        }
      };
    }

    try {
      const record = await runPromotedCandidateReplay({
        candidate_id: candidateId,
        candidate_root: options.promotedCandidateRoot ?? DEFAULT_PROMOTED_CANDIDATE_ROOT,
        run_root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
        run_id: createHttpReplayRunId(),
        runner_kind: runnerKind,
        scenario_ids: scenarioIds,
        timeout_ms: timeoutMs
      });
      return {
        statusCode: 201,
        body: {
          candidate_id: candidateId,
          run: replayRunEvidenceFromRecord(record)
        }
      };
    } catch (error) {
      if (error instanceof ReplayRunError) {
        return {
          statusCode: replayRunErrorStatus(error),
          body: {
            error: "replay_run_failed",
            reason: error.reason,
            candidate_id: candidateId,
            message: error.message
          }
        };
      }
      throw error;
    }
  }

  async function startTradingRunCommand(
    candidateId: string,
    payload: unknown
  ): Promise<RuntimeControllerResponse> {
    const body = payload as StartTradingRunBody | undefined;
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
      marketData: gatewayMarketDataPort
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

    const candidate = await store.getCandidate(candidateId);
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
    const existingEvaluation = await store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    if (existingEvaluation?.status === "running") {
      if (!paperTradingEvaluationRunner.active(tradingRunId)) {
        const tradingApiBaseUrl = await ensurePaperTradingApiProviderSession(tradingRunId, gatewayRuntimeBinding);
        await restartTradingRunSandboxWithProvider({
          candidate,
          tradingRunId,
          candidateVersionId,
          paperOrderRequest: paperOrderRequestFromCandidateRuntime(candidate),
          tradingApiBaseUrl
        });
        const resumedEvaluation = await recordPaperTradingEvaluationObservation({
          tradingRunId,
          gatewayRuntimeBinding,
          appendLedger: true,
          intervalMs: paperTradingEvaluationIntervalMs
        });
        if (resumedEvaluation.evaluation.status === "running") {
          schedulePaperTradingEvaluation(tradingRunId);
        } else {
          await stopFailedPaperTradingSession(tradingRunId);
        }
        const response = await tradingRunResponse(store, tradingRunId);
        return {
          statusCode: 200,
          body: {
            status: "resumed",
            ...response,
            paper_trading_evaluation: resumedEvaluation.evaluation,
            paper_trading_observation: resumedEvaluation.observation,
            runner_status: paperTradingEvaluationRunner.active(tradingRunId) ? "running" : "stopped"
          }
        };
      }
      await ensurePaperTradingApiProviderSession(tradingRunId, gatewayRuntimeBinding);
      schedulePaperTradingEvaluation(tradingRunId);
      const response = await tradingRunResponse(store, tradingRunId);
      return {
        statusCode: 200,
        body: {
          status: "already_running",
          ...response,
          paper_trading_evaluation: existingEvaluation,
          runner_status: paperTradingEvaluationRunner.active(tradingRunId) ? "running" : "stopped"
        }
      };
    }
    try {
      const tradingApiBaseUrl = await ensurePaperTradingApiProviderSession(
        tradingRunId,
        gatewayRuntimeBinding
      );
      const outcome = await startFixtureTradingRun({
        store,
        sandboxAdapter: sandboxAdapters.deterministic_test,
        candidate,
        systemId: candidateId,
        tradingRunId,
        candidateVersionId,
        paperOrderRequest,
        tradingApiBaseUrl,
        tradingGatewayEnvironment,
        gatewayRuntimeBinding
      });
      const paperTradingEvaluation = await recordPaperTradingEvaluationObservation({
        tradingRunId,
        gatewayRuntimeBinding,
        appendLedger: true,
        intervalMs: paperTradingEvaluationIntervalMs
      });
      if (paperTradingEvaluation.evaluation.status === "running") {
        schedulePaperTradingEvaluation(tradingRunId);
      } else {
        await stopFailedPaperTradingSession(tradingRunId);
      }
      const response = await tradingRunResponse(store, tradingRunId);

      return {
        statusCode: 201,
        body: {
          ...outcome,
          ...response,
          order_request: response?.ledger?.latest_order_request,
          gateway_result: response?.ledger?.latest_gateway_result,
          execution_result: response?.ledger?.latest_execution_result,
          paper_trading_evaluation: paperTradingEvaluation.evaluation,
          paper_trading_observation: paperTradingEvaluation.observation,
          runner_status: paperTradingEvaluationRunner.active(tradingRunId) ? "running" : "stopped"
        }
      };
    } catch (error) {
      await stopPaperTradingApiProviderSession(tradingRunId);
      if (error instanceof LocalStoreError) {
        return {
          statusCode: ledgerStatusCode(error.code),
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

  async function observeTradingRunCommand(tradingRunId: string): Promise<RuntimeControllerResponse> {
    const candidate = await store.getCandidateForTradingRun(tradingRunId);
    let paperTradingEvaluation: Awaited<ReturnType<typeof recordPaperTradingEvaluationObservation>> | undefined;
    if (candidate?.runtime.runtime_lifecycle_status === "running") {
      const gatewayRuntimeBinding = createGatewayRuntimeBinding({
        environment: "paper",
        marketData: gatewayMarketDataPort
      });
      const providerWasActive = paperTradingApiProviderSessions.has(tradingRunId);
      const tradingApiBaseUrl = await ensurePaperTradingApiProviderSession(tradingRunId, gatewayRuntimeBinding);
      if (!providerWasActive) {
        await restartTradingRunSandboxWithProvider({
          candidate,
          tradingRunId,
          candidateVersionId: candidate.candidate_version.candidate_version_id,
          paperOrderRequest: paperOrderRequestFromCandidateRuntime(candidate),
          tradingApiBaseUrl
        });
      }
      paperTradingEvaluation = await recordPaperTradingEvaluationObservation({
        tradingRunId,
        gatewayRuntimeBinding,
        appendLedger: true,
        intervalMs: paperTradingEvaluationIntervalMs
      });
      if (paperTradingEvaluation.evaluation.status === "failed") {
        await stopFailedPaperTradingSession(tradingRunId);
      }
    }

    const response = await tradingRunResponse(store, tradingRunId);
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
        runner_status: paperTradingEvaluationRunner.active(tradingRunId) ? "running" : "stopped"
      }
    };
  }

  function schedulePaperTradingEvaluation(tradingRunId: string): void {
    paperTradingEvaluationRunner.start({
      tradingRunId,
      intervalMs: paperTradingEvaluationIntervalMs,
      observe: async () => {
        const candidate = await store.getCandidateForTradingRun(tradingRunId);
        if (candidate?.runtime.runtime_lifecycle_status !== "running") {
          paperTradingEvaluationRunner.stop(tradingRunId);
          await stopPaperTradingApiProviderSession(tradingRunId);
          return;
        }
        const result = await recordPaperTradingEvaluationObservation({
          tradingRunId,
          gatewayRuntimeBinding: createGatewayRuntimeBinding({
            environment: "paper",
            marketData: gatewayMarketDataPort
          }),
          appendLedger: true,
          intervalMs: paperTradingEvaluationIntervalMs
        });
        if (result.evaluation.status === "failed") {
          await stopFailedPaperTradingSession(tradingRunId);
        }
      }
    });
  }

  async function stopFailedPaperTradingSession(tradingRunId: string): Promise<void> {
    paperTradingEvaluationRunner.stop(tradingRunId);
    await stopPaperTradingApiProviderSession(tradingRunId);
    await stopLinkedTradingRunSandbox({
      store,
      sandboxAdapters,
      tradingRunId
    });
  }

  async function restartTradingRunSandboxWithProvider(input: {
    candidate: CandidateInspectReadModel;
    tradingRunId: string;
    candidateVersionId: string;
    paperOrderRequest: PaperOrderRequestFixture;
    tradingApiBaseUrl: string;
  }): Promise<void> {
    await stopLinkedTradingRunSandbox({
      store,
      sandboxAdapters,
      tradingRunId: input.tradingRunId
    });
    await ensureTradingRunSandbox({
      store,
      sandboxAdapter: sandboxAdapters.deterministic_test,
      candidate: input.candidate,
      tradingRunId: input.tradingRunId,
      candidateVersionId: input.candidateVersionId,
      paperOrderRequest: input.paperOrderRequest,
      tradingApiBaseUrl: input.tradingApiBaseUrl
    });
  }

  async function ensurePaperTradingApiProviderSession(
    tradingRunId: string,
    gatewayRuntimeBinding: GatewayRuntimeBinding
  ): Promise<string> {
    const existing = paperTradingApiProviderSessions.get(tradingRunId);
    if (existing) {
      return existing.sandbox_base_url ?? existing.base_url;
    }
    const sandboxHost = options.tradingApiProviderSandboxHost ?? process.env.OUROBOROS_TRADING_API_SANDBOX_HOST;
    const provider = await paperTradingApiProviderFactory(gatewayRuntimeBinding, {
      ...paperTradingApiProviderNetworkOptions({ sandboxHost }),
      readAccountState: () => latestPaperAccountState(tradingRunId, gatewayRuntimeBinding)
    });
    paperTradingApiProviderSessions.set(tradingRunId, provider);
    return provider.sandbox_base_url ?? provider.base_url;
  }

  async function stopPaperTradingApiProviderSession(tradingRunId: string): Promise<void> {
    const provider = paperTradingApiProviderSessions.get(tradingRunId);
    if (!provider) {
      return;
    }
    paperTradingApiProviderSessions.delete(tradingRunId);
    await provider.close();
  }

  async function latestPaperAccountState(
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
    const evaluation = await store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const equity = parseFiniteAccountNumber(evaluation?.paper_account_snapshot?.equity_usdt);
    return {
      ...fallback,
      equity: equity ?? fallback.equity
    };
  }

  async function recordPaperTradingEvaluationObservation(input: {
    tradingRunId: string;
    gatewayRuntimeBinding: GatewayRuntimeBinding;
    appendLedger: boolean;
    intervalMs: number;
  }): Promise<{
    evaluation: PaperTradingEvaluationRecord;
    observation: PaperTradingObservationRecord;
  }> {
    const candidateBefore = await store.getCandidateForTradingRun(input.tradingRunId);
    if (!candidateBefore) {
      throw new LocalStoreError(
        "runtime_not_found",
        `runtime ${input.tradingRunId} not found`,
        { runtime_id: input.tradingRunId }
      );
    }
    const now = new Date().toISOString();
    const existingEvaluation = await store.getLatestPaperTradingEvaluationForTradingRun(input.tradingRunId);
    const baseEvaluation = existingEvaluation ?? paperTradingEvaluationRecord({
      candidate: candidateBefore,
      tradingRunId: input.tradingRunId,
      intervalMs: input.intervalMs,
      startedAt: now
    });
    if (baseEvaluation.status === "failed") {
      const previousEngineState = engineStateFromEvaluation(baseEvaluation);
      const failureReason = baseEvaluation.latest_failure_reason ?? "paper_trading_evaluation_failed";
      const sequence = baseEvaluation.observation_count + 1;
      const observation = paperTradingObservationRecord({
        candidate: candidateBefore,
        evaluation: baseEvaluation,
        sequence,
        status: "failed",
        observedAt: now,
        decision: paperProtocolErrorDecision(now, failureReason),
        paperAccountSnapshot: previousEngineState.account,
        openOrders: previousEngineState.openOrders,
        processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
        processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
        latestFill: previousEngineState.latestFill,
        scoreDelta: zeroPaperTradingProfitLoss(),
        cumulativeScore: baseEvaluation.latest_score,
        failureReason
      });
      const evaluation = paperTradingEvaluationUpdate({
        evaluation: baseEvaluation,
        status: "failed",
        observedAt: now,
        nextObservationAt: undefined,
        latestScore: baseEvaluation.latest_score,
        latestFailureReason: failureReason,
        paperAccountSnapshot: previousEngineState.account,
        openOrders: previousEngineState.openOrders,
        processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
        processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
        latestFill: previousEngineState.latestFill
      });
      paperTradingEvaluationRunner.stop(input.tradingRunId);
      await store.recordPaperTradingObservation(observation, evaluation);
      return { evaluation, observation };
    }

    let market;
    try {
      market = await input.gatewayRuntimeBinding.marketData.readMarketSnapshot({ observedAt: now });
    } catch (error) {
      const failedObservation = paperTradingObservationRecord({
        candidate: candidateBefore,
        evaluation: baseEvaluation,
        sequence: baseEvaluation.observation_count + 1,
        status: "failed",
        observedAt: now,
        scoreDelta: zeroPaperTradingProfitLoss(),
        cumulativeScore: baseEvaluation.latest_score,
        failureReason: error instanceof Error ? error.message : "market_data_unavailable"
      });
      const failedEvaluation = paperTradingEvaluationUpdate({
        evaluation: baseEvaluation,
        status: "failed",
        observedAt: now,
        nextObservationAt: undefined,
        latestScore: baseEvaluation.latest_score,
        latestFailureReason: failedObservation.failure_reason
      });
      await store.recordPaperTradingObservation(failedObservation, failedEvaluation);
      return { evaluation: failedEvaluation, observation: failedObservation };
    }

    await input.gatewayRuntimeBinding.marketData
      .readPublicMarketLivenessSurface({ observedAt: market.observed_at })
      .then((surface) => store.recordPublicMarketLivenessSurface(surface))
      .catch(() => undefined);

    const sequence = baseEvaluation.observation_count + 1;
    let ledgerOutcome: LedgerWriteOutcome | undefined;
    let decision: PaperTradingDecisionSummary | undefined;
    let publicExecutionSnapshot;
    let engineResult;
    let previousEngineState: PaperTradingEngineState | undefined;
    let engineEventsThisObservation: PaperTradingSystemEvent[] = [];
    if (input.appendLedger) {
      const refreshedCandidate = await refreshPaperTradingSandbox(candidateBefore);
      const currentEngineState = engineStateFromEvaluation(baseEvaluation);
      previousEngineState = currentEngineState;
      if (refreshedCandidate.runtime.sandbox?.lifecycle_status === "failed") {
        const failureReason = "paper_trading_sandbox_failed";
        const failedObservation = paperTradingObservationRecord({
          candidate: refreshedCandidate,
          evaluation: baseEvaluation,
          sequence,
          status: "failed",
          observedAt: market.observed_at,
          marketSnapshot: marketSnapshotSummary(market),
          decision: paperProtocolErrorDecision(market.observed_at, failureReason),
          scoreDelta: zeroPaperTradingProfitLoss(),
          cumulativeScore: baseEvaluation.latest_score,
          failureReason,
          paperAccountSnapshot: currentEngineState.account,
          openOrders: currentEngineState.openOrders,
          processedTradingSystemEventIds: currentEngineState.processedTradingSystemEventIds,
          processedPublicTradeIds: currentEngineState.processedPublicTradeIds,
          latestFill: currentEngineState.latestFill
        });
        const failedEvaluation = paperTradingEvaluationUpdate({
          evaluation: baseEvaluation,
          status: "failed",
          observedAt: market.observed_at,
          nextObservationAt: undefined,
          latestScore: baseEvaluation.latest_score,
          latestFailureReason: failureReason,
          paperAccountSnapshot: currentEngineState.account,
          openOrders: currentEngineState.openOrders,
          processedTradingSystemEventIds: currentEngineState.processedTradingSystemEventIds,
          processedPublicTradeIds: currentEngineState.processedPublicTradeIds,
          latestFill: currentEngineState.latestFill
        });
        await store.recordPaperTradingObservation(failedObservation, failedEvaluation);
        return { evaluation: failedEvaluation, observation: failedObservation };
      }
      const tradingSystemEvents = tradingSystemEventsFromCandidate(refreshedCandidate)
        .filter((event) => !currentEngineState.processedTradingSystemEventIds.includes(event.event_id));
      const decisionOutcome = await recordPaperTradingObservationDecision({
        store,
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
            const failedObservation = paperTradingObservationRecord({
              candidate: refreshedCandidate,
              evaluation: baseEvaluation,
              sequence,
              status: "failed",
              observedAt: market.observed_at,
              marketSnapshot: marketSnapshotSummary(market),
              decision,
              scoreDelta: zeroPaperTradingProfitLoss(),
              cumulativeScore: baseEvaluation.latest_score,
              failureReason: error instanceof Error ? error.message : "public_execution_stream_unavailable",
              paperAccountSnapshot: previousEngineState.account,
              openOrders: previousEngineState.openOrders,
              processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
              processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
              latestFill: previousEngineState.latestFill
            });
            const failedEvaluation = paperTradingEvaluationUpdate({
              evaluation: baseEvaluation,
              status: "failed",
              observedAt: market.observed_at,
              nextObservationAt: undefined,
              latestScore: baseEvaluation.latest_score,
              latestFailureReason: failedObservation.failure_reason,
              paperAccountSnapshot: previousEngineState.account,
              openOrders: previousEngineState.openOrders,
              processedTradingSystemEventIds: previousEngineState.processedTradingSystemEventIds,
              processedPublicTradeIds: previousEngineState.processedPublicTradeIds,
              latestFill: previousEngineState.latestFill
            });
            await store.recordPaperTradingObservation(failedObservation, failedEvaluation);
            return { evaluation: failedEvaluation, observation: failedObservation };
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
    const candidateAfterLedger = await store.getCandidateForTradingRun(input.tradingRunId);
    const latestChain = ledgerOutcome
      ? candidateAfterLedger?.ledger?.chains.find((chain) =>
          chain.order_request?.order_request_id === ledgerOutcome.order_request.order_request_id
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
    const failedEvaluation = rejectedThisObservation;
    const latestFailureReason = rejectedThisObservation ? observation.failure_reason : undefined;
    const evaluation = paperTradingEvaluationUpdate({
      evaluation: baseEvaluation,
      status: failedEvaluation ? "failed" : "running",
      observedAt,
      nextObservationAt: failedEvaluation
        ? undefined
        : new Date(Date.parse(observedAt) + input.intervalMs).toISOString(),
      latestScore: cumulativeScore,
      latestFailureReason,
      paperAccountSnapshot: engineResult?.account,
      openOrders: engineResult?.openOrders,
      processedTradingSystemEventIds: engineResult?.processedTradingSystemEventIds,
      processedPublicTradeIds: engineResult?.processedPublicTradeIds,
      latestFill: engineResult?.latestFill,
      latestPublicExecutionSnapshot: publicExecutionSnapshot
    });
    await store.recordPaperTradingObservation(observation, evaluation);
    return { evaluation, observation };
  }

  async function refreshPaperTradingSandbox(
    candidate: CandidateInspectReadModel
  ): Promise<CandidateInspectReadModel> {
    const sandbox = candidate.runtime.sandbox;
    if (!sandbox || !shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
      return candidate;
    }
    const observations = await sandboxAdapters[sandbox.adapter_kind]
      .getArtifactInstanceLogs(sandbox);
    if (
      observations.lifecycle_status ||
      observations.logs?.length ||
      observations.heartbeats?.length ||
      observations.command_evidence?.length
    ) {
      await store.recordSandboxObservations(sandbox.sandbox_id, observations);
      return await store.getCandidateForTradingRun(candidate.runtime.ref.id) ?? candidate;
    }
    return candidate;
  }

  async function stopTradingRunCommand(tradingRunId: string): Promise<RuntimeControllerResponse> {
    const candidate = await store.getCandidateForTradingRun(tradingRunId);
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
    await store.recordRunControlAudit(tradingRunLifecycleAuditInput({
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
    await stopLinkedTradingRunSandbox({
      store,
      sandboxAdapters,
      tradingRunId
    });
    paperTradingEvaluationRunner.stop(tradingRunId);
    await stopPaperTradingApiProviderSession(tradingRunId);
    const existingEvaluation = await store.getLatestPaperTradingEvaluationForTradingRun(tradingRunId);
    const stoppedAt = new Date().toISOString();
    const stoppedEvaluation = existingEvaluation
      ? await store.recordPaperTradingEvaluation({
          ...existingEvaluation,
          status: "stopped",
          next_observation_at: undefined,
          stopped_at: stoppedAt
        })
      : undefined;

    const response = await tradingRunResponse(store, tradingRunId);
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

  async function recordRunControlCommand(
    candidateId: string,
    payload: unknown
  ): Promise<RuntimeControllerResponse> {
    const candidate = await store.getCandidate(candidateId);
    if (!candidate) {
      return {
        statusCode: 404,
        body: {
          error: "trading_system_not_found",
          system_id: candidateId
        }
      };
    }

    const body = (payload ?? {}) as RecordRunControlBody;
    if (!isRunControlRequestComplete(body)) {
      return {
        statusCode: 422,
        body: runtimeControlError({
          reason: "invalid_run_control_request",
          candidateId,
          candidateVersionId: body.candidate_version_id,
          idempotencyKey: body.idempotency_key
        })
      };
    }

    try {
      const outcome = await store.recordRunControlAudit({
        idempotency_key: body.idempotency_key,
        candidate_id: candidateId,
        candidate_version_id: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
        runtime_id: body.runtime_id,
        command: body.command,
        decision: body.decision,
        audit_event: body.audit_event,
        created_at: body.created_at
      } as RunControlAuditInput);

      return {
        statusCode: 201,
        body: {
          status: "recorded",
          ...outcome
        }
      };
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return {
          statusCode: runtimeControlStatusCode(error.code),
          body: runtimeControlError({
            reason: error.code,
            candidateId,
            candidateVersionId: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
            idempotencyKey: body.idempotency_key
          })
        };
      }
      throw error;
    }
  }

  async function recordPrivateReadinessPostureCommand(payload: unknown): Promise<RuntimeControllerResponse> {
    const body = (payload ?? {}) as RecordPrivateReadinessPostureBody;
    if (hasForbiddenPrivateReadinessPostureMaterial(body)) {
      return {
        statusCode: 422,
        body: privateReadinessPostureError({
          reason: "raw_secret_material_forbidden",
          idempotencyKey: body.idempotency_key
        })
      };
    }
    if (!isSupportedPrivateReadinessPostureScope(body)) {
      return {
        statusCode: 422,
        body: privateReadinessPostureError({
          reason: "unsupported_private_readiness_posture_scope",
          idempotencyKey: body.idempotency_key
        })
      };
    }
    if (!isPrivateReadinessPostureRequestComplete(body)) {
      return {
        statusCode: 422,
        body: privateReadinessPostureError({
          reason: "invalid_private_readiness_posture_request",
          idempotencyKey: body.idempotency_key
        })
      };
    }

    try {
      const posture = await store.recordLocalPrivateReadinessPosture({
        idempotency_key: body.idempotency_key,
        venue: "binance_usd_m_futures",
        instrument: "BTCUSDT",
        product_category: "perpetual_futures",
        operator_approval_gate: body.operator_approval_gate,
        jurisdiction_risk_gate: body.jurisdiction_risk_gate,
        live_binding_gate: body.live_binding_gate,
        secret_handling_gate: body.secret_handling_gate,
        stop_behavior_gate: body.stop_behavior_gate,
        secret_reference_configured: body.secret_reference_configured,
        secret_reference_ref: body.secret_reference_ref,
        source_ref: body.source_ref,
        observed_at: body.observed_at
      } satisfies PrivateReadinessPostureWriteInput);

      return {
        statusCode: 201,
        body: {
          status: "recorded",
          posture
        }
      };
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return {
          statusCode: 422,
          body: privateReadinessPostureError({
            reason: error.code,
            idempotencyKey: body.idempotency_key
          })
        };
      }
      throw error;
    }
  }

  async function startSandboxCommand(payload: unknown): Promise<RuntimeControllerResponse> {
    const body = (payload ?? {}) as StartSandboxBody;
    const rawSecretPath = rawSecretMaterialPath(body);
    if (rawSecretPath) {
      return {
        statusCode: 422,
        body: sandboxError({
          reason: "raw_secret_material_rejected",
          idempotencyKey: body.idempotency_key,
          detail: rawSecretPath
        })
      };
    }

    const adapterKind = parseSandboxAdapterKind(body.adapter_kind);
    if (!adapterKind) {
      return {
        statusCode: 422,
        body: sandboxError({
          reason: "invalid_sandbox_adapter",
          idempotencyKey: body.idempotency_key
        })
      };
    }
    if (adapterKind === "docker_sandboxes_sbx" && !isSbxRuntimeEnabled()) {
      return {
        statusCode: 422,
        body: sandboxError({
          reason: "docker_sandboxes_sbx_runtime_disabled",
          idempotencyKey: body.idempotency_key
        })
      };
    }
    if (
      (body.test_ticks !== undefined && !isNonNegativeInteger(body.test_ticks)) ||
      (body.interval_ms !== undefined && !isPositiveInteger(body.interval_ms))
    ) {
      return {
        statusCode: 422,
        body: sandboxError({
          reason: "invalid_sandbox_input",
          idempotencyKey: body.idempotency_key
        })
      };
    }

    const systemCodeId = body.system_code_id ?? FIXTURE_SYSTEM_CODE_ID;
    const artifact = await store.getSystemCode(systemCodeId);
    if (!artifact) {
      return {
        statusCode: 404,
        body: sandboxError({
          reason: "system_code_not_found",
          idempotencyKey: body.idempotency_key,
          systemCodeId
        })
      };
    }

    const createdAt = body.created_at ?? new Date().toISOString();
    const idempotencyKey = body.idempotency_key
      ?? `${adapterKind}:${systemCodeId}:${body.trading_run_id ?? "standalone"}`;
    const sandboxId = body.sandbox_id ?? `sandbox-${safeRouteId(idempotencyKey)}`;
    const sandboxName = body.sandbox_name ?? `ouro-sandbox-${safeRouteId(sandboxId).slice(0, 44)}`;

    try {
      const adapterResult = await sandboxAdapters[adapterKind].startArtifactInstance({
        artifact,
        instance_id: sandboxId,
        sandbox_name: sandboxName,
        runtime_ref: body.trading_run_id
          ? { record_kind: "trading_run", id: body.trading_run_id }
          : undefined,
        sandbox_placement_id: `sandbox-placement-${safeRouteId(sandboxId)}`,
        created_at: createdAt,
        test_ticks: body.test_ticks ?? 2,
        interval_ms: body.interval_ms
      });
      const outcome = await store.recordSandboxStart(adapterResult);
      const lifecycleStatus = outcome.sandbox.lifecycle_status;
      return {
        statusCode: 201,
        body: {
          status: lifecycleStatus === "running" ? "started" : lifecycleStatus,
          ...outcome
        }
      };
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return {
          statusCode: sandboxStatusCode(error.code),
          body: sandboxError({
            reason: error.code,
            idempotencyKey,
            systemCodeId
          })
        };
      }
      throw error;
    }
  }

  async function stopSandboxCommand(sandboxId: string): Promise<RuntimeControllerResponse> {
    const sandbox = await store.getSandbox(sandboxId);
    if (!sandbox) {
      return {
        statusCode: 404,
        body: sandboxError({
          reason: "sandbox_not_found",
          sandboxId
        })
      };
    }
    if (!shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
      return {
        statusCode: 200,
        body: {
          status: sandbox.lifecycle_status,
          sandbox
        }
      };
    }

    const observations = await sandboxAdapters[sandbox.adapter_kind]
      .stopArtifactInstance(sandbox);
    const outcome = await store.stopSandbox(
      {
        sandbox_id: sandbox.sandbox_id,
        stopped_at: observations.stopped_at,
        removed_at: observations.removed_at
      },
      observations
    );
    return {
      statusCode: 200,
      body: {
        status: outcome.sandbox.lifecycle_status,
        ...outcome
      }
    };
  }

  async function readOrderFillLatest(query: {
    venue?: string;
    instrument?: string;
  }): Promise<RuntimeControllerResponse> {
    const venue = query.venue ?? "binance_usd_m_futures";
    const instrument = query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return { statusCode: 404, body: { error: "order_fill_surface_not_found", venue, instrument } };
    }

    const surface = await store.getLatestOrderFillSurface({ venue, instrument });
    if (!surface) {
      return { statusCode: 404, body: { error: "order_fill_surface_not_found", venue, instrument } };
    }
    return { statusCode: 200, body: { surface } };
  }

  async function readPublicMarketLatest(query: {
    venue?: string;
    instrument?: string;
  }): Promise<RuntimeControllerResponse> {
    const venue = query.venue ?? "binance_usd_m_futures";
    const instrument = query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return { statusCode: 404, body: { error: "public_market_liveness_surface_not_found", venue, instrument } };
    }

    const refresh = await refreshGatewayPublicMarketSurface({
      store,
      marketData: gatewayMarketDataPort
    });
    const surface = await store.getLatestPublicMarketLivenessSurface({ venue, instrument });
    if (!surface) {
      return { statusCode: 404, body: { error: "public_market_liveness_surface_not_found", venue, instrument } };
    }
    return {
      statusCode: 200,
      body: {
        refresh_status: refresh.status,
        refresh_reason: refresh.reason,
        surface
      }
    };
  }

  async function readPrivateReadinessLatest(query: {
    venue?: string;
    instrument?: string;
  }): Promise<RuntimeControllerResponse> {
    const venue = query.venue ?? "binance_usd_m_futures";
    const instrument = query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return { statusCode: 404, body: { error: "private_readiness_preflight_surface_not_found", venue, instrument } };
    }

    const surface = await store.getLatestPrivateReadinessPreflightSurface({ venue, instrument });
    if (!surface) {
      return { statusCode: 404, body: { error: "private_readiness_preflight_surface_not_found", venue, instrument } };
    }
    return { statusCode: 200, body: { surface } };
  }

  async function readPrivateReadinessPostureLatest(query: {
    venue?: string;
    instrument?: string;
  }): Promise<RuntimeControllerResponse> {
    const venue = query.venue ?? "binance_usd_m_futures";
    const instrument = query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return { statusCode: 404, body: { error: "private_readiness_posture_not_found", venue, instrument } };
    }

    const posture = await store.getLatestPrivateReadinessPosture({ venue, instrument });
    if (!posture) {
      return { statusCode: 404, body: { error: "private_readiness_posture_not_found", venue, instrument } };
    }
    return { statusCode: 200, body: { posture } };
  }

  async function readAccountPositionRiskLatest(query: {
    venue?: string;
    instrument?: string;
  }): Promise<RuntimeControllerResponse> {
    const venue = query.venue ?? "binance_usd_m_futures";
    const instrument = query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return { statusCode: 404, body: { error: "account_position_risk_mirror_surface_not_found", venue, instrument } };
    }

    const surface = await store.getLatestAccountPositionRiskMirrorSurface({ venue, instrument });
    if (!surface) {
      return { statusCode: 404, body: { error: "account_position_risk_mirror_surface_not_found", venue, instrument } };
    }
    return { statusCode: 200, body: { surface } };
  }

  async function listCandidatesResource(): Promise<RuntimeControllerResponse> {
    return {
      statusCode: 200,
      body: {
        candidates: await listCandidateSummaries(
          store,
          options.promotedCandidateRoot,
          options.replayRunRoot
        )
      }
    };
  }

  async function getCandidateResource(candidateId: string): Promise<RuntimeControllerResponse> {
    const candidate = await getCandidateReadModel(
      store,
      candidateId,
      options.promotedCandidateRoot,
      options.replayRunRoot
    );
    if (!candidate) {
      return { statusCode: 404, body: { error: "candidate_not_found", candidate_id: candidateId } };
    }
    return { statusCode: 200, body: candidate as unknown as Record<string, unknown> };
  }

  async function listCandidateEvaluationsResource(candidateId: string): Promise<RuntimeControllerResponse> {
    const candidate = await getCandidateReadModel(
      store,
      candidateId,
      options.promotedCandidateRoot,
      options.replayRunRoot
    );
    if (!candidate) {
      return { statusCode: 404, body: { error: "candidate_not_found", candidate_id: candidateId } };
    }

    return {
      statusCode: 200,
      body: {
        candidate_id: candidateId,
        evaluations: await store.listCandidateEvaluationRuns(candidateId)
      }
    };
  }

  async function listCandidateReplayRunsResource(
    candidateId: string,
    query: { limit?: string }
  ): Promise<RuntimeControllerResponse> {
    const candidate = await getCandidateReadModel(
      store,
      candidateId,
      options.promotedCandidateRoot,
      options.replayRunRoot
    );
    if (!candidate) {
      return { statusCode: 404, body: { error: "candidate_not_found", candidate_id: candidateId } };
    }

    return {
      statusCode: 200,
      body: {
        candidate_id: candidateId,
        runs: await listReplayRunEvidence({
          root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
          candidate_id: candidateId,
          limit: parseLimit(query.limit)
        })
      }
    };
  }

  async function getReplayRunResource(
    runId: string,
    query: { candidate_id?: string }
  ): Promise<RuntimeControllerResponse> {
    const candidateId = query.candidate_id;
    if (!candidateId) {
      return {
        statusCode: 422,
        body: { error: "replay_run_rejected", reason: "missing_candidate_id", run_id: runId }
      };
    }
    const run = await getReplayRunDetail({
      root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
      candidate_id: candidateId,
      run_id: runId
    });
    if (!run) {
      return { statusCode: 404, body: { error: "replay_run_not_found", candidate_id: candidateId, run_id: runId } };
    }
    return { statusCode: 200, body: { candidate_id: candidateId, run } };
  }

  async function getReplayRunValidationStateResource(
    runId: string,
    query: { candidate_id?: string; baseline_run_id?: string }
  ): Promise<RuntimeControllerResponse> {
    const candidateId = query.candidate_id;
    if (!candidateId) {
      return {
        statusCode: 422,
        body: { error: "replay_run_validation_state_rejected", reason: "missing_candidate_id", run_id: runId }
      };
    }
    const validationState = await getReplayRunValidationState({
      root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
      candidate_id: candidateId,
      run_id: runId,
      baseline_run_id: query.baseline_run_id
    });
    if (!validationState) {
      return {
        statusCode: 404,
        body: {
          error: "replay_run_validation_state_not_found",
          candidate_id: candidateId,
          run_id: runId,
          baseline_run_id: query.baseline_run_id
        }
      };
    }
    return { statusCode: 200, body: { candidate_id: candidateId, validation_state: validationState } };
  }

  async function getReplayRunComparisonResource(
    runId: string,
    query: { candidate_id?: string; baseline_run_id?: string }
  ): Promise<RuntimeControllerResponse> {
    const candidateId = query.candidate_id;
    if (!candidateId || !query.baseline_run_id) {
      return {
        statusCode: 422,
        body: {
          error: "replay_run_comparison_rejected",
          reason: !candidateId ? "missing_candidate_id" : "missing_baseline_run_id",
          run_id: runId
        }
      };
    }
    const comparison = await getReplayRunComparison({
      root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
      candidate_id: candidateId,
      run_id: runId,
      baseline_run_id: query.baseline_run_id
    });
    if (!comparison) {
      return {
        statusCode: 404,
        body: {
          error: "replay_run_comparison_not_found",
          candidate_id: candidateId,
          run_id: runId,
          baseline_run_id: query.baseline_run_id
        }
      };
    }
    return { statusCode: 200, body: { candidate_id: candidateId, comparison } };
  }

  async function getTradingRunResource(runId: string): Promise<RuntimeControllerResponse> {
    const response = await tradingRunResponse(store, runId);
    if (!response) {
      return { statusCode: 404, body: { error: "trading_run_not_found", trading_run_id: runId } };
    }
    return { statusCode: 200, body: response };
  }

  async function getEvaluationResource(evaluationId: string): Promise<RuntimeControllerResponse> {
    const evaluationRun = await store.getCandidateEvaluationRun(evaluationId);
    if (!evaluationRun) {
      return { statusCode: 404, body: { error: "evaluation_not_found", evaluation_id: evaluationId } };
    }
    return { statusCode: 200, body: evaluationRun as unknown as Record<string, unknown> };
  }

  async function listSandboxesResource(): Promise<RuntimeControllerResponse> {
    return { statusCode: 200, body: { sandboxes: await store.listSandboxes() } };
  }

  async function getSandboxResource(sandboxId: string): Promise<RuntimeControllerResponse> {
    const sandbox = await store.getSandbox(sandboxId);
    if (!sandbox) {
      return { statusCode: 404, body: sandboxError({ reason: "sandbox_not_found", sandboxId }) };
    }
    if (shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
      const observations = await sandboxAdapters[sandbox.adapter_kind]
        .getArtifactInstanceStatus(sandbox);
      if (
        observations.lifecycle_status ||
        observations.logs?.length ||
        observations.heartbeats?.length ||
        observations.command_evidence?.length
      ) {
        await store.recordSandboxObservations(sandbox.sandbox_id, observations);
        const refreshed = await store.getSandbox(sandbox.sandbox_id);
        return { statusCode: 200, body: refreshed as unknown as Record<string, unknown> };
      }
    }
    return { statusCode: 200, body: sandbox as unknown as Record<string, unknown> };
  }

  async function getSandboxLogsResource(sandboxId: string): Promise<RuntimeControllerResponse> {
    const sandbox = await store.getSandbox(sandboxId);
    if (!sandbox) {
      return { statusCode: 404, body: sandboxError({ reason: "sandbox_not_found", sandboxId }) };
    }
    if (!shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
      return {
        statusCode: 200,
        body: {
          sandbox,
          logs: sandbox.logs,
          heartbeats: sandbox.heartbeats,
          command_evidence: sandbox.command_evidence
        }
      };
    }

    const observations = await sandboxAdapters[sandbox.adapter_kind]
      .getArtifactInstanceLogs(sandbox);
    const outcome = await store.recordSandboxObservations(
      sandbox.sandbox_id,
      observations
    );
    return { statusCode: 200, body: outcome as unknown as Record<string, unknown> };
  }

  const operatorService = new OperatorService({
    store,
    candidateArenaRunner,
    paperTradingEvaluationRunner,
    agentProfileExecFile: options.agentProfileExecFile,
    paperEvidenceAdapter: {
      run: async (candidateId) => startTradingRunCommand(candidateId, {})
    },
    mutationPort: {
      run: async (commandKind, payload) => {
        if (commandKind === "candidate.evaluation.run") {
          return runCandidateEvaluationCommand(commandPayloadId(payload, "candidate_id"), payload);
        }
        if (commandKind === "candidate.replay.run") {
          return runCandidateReplayCommand(commandPayloadId(payload, "candidate_id"), payload);
        }
        if (commandKind === "trading_run.start") {
          return startTradingRunCommand(commandPayloadId(payload, "candidate_id"), payload);
        }
        if (commandKind === "trading_run.observe") {
          return observeTradingRunCommand(commandPayloadId(payload, "trading_run_id"));
        }
        if (commandKind === "trading_run.stop") {
          return stopTradingRunCommand(commandPayloadId(payload, "trading_run_id"));
        }
        if (commandKind === "run_control.record") {
          return recordRunControlCommand(commandPayloadId(payload, "candidate_id"), payload);
        }
        if (commandKind === "private_readiness_posture.record") {
          return recordPrivateReadinessPostureCommand(payload);
        }
        if (commandKind === "sandbox.start") {
          return startSandboxCommand(payload);
        }
        if (commandKind === "sandbox.stop") {
          return stopSandboxCommand(commandPayloadId(payload, "sandbox_id"));
        }
        return {
          statusCode: 501,
          body: {
            error: "operator_mutation_not_supported",
            command_kind: commandKind
          }
        };
      }
    }
  });
  const operatorController = createOperatorController(operatorService);

  await registerRuntimeRouteModules(server, [
    registerCoreControllerRoutes({
      operatorController,
      tradingGatewayEnvironment,
      storeRoot: store.root(),
      filesystemReadRateLimit,
      commandMutationRateLimit
    }),
    registerResourceControllerRoutes({
      filesystemReadRateLimit,
      readOrderFillLatest,
      readPublicMarketLatest,
      readPrivateReadinessLatest,
      readPrivateReadinessPostureLatest,
      readAccountPositionRiskLatest,
      listCandidates: listCandidatesResource,
      getCandidate: getCandidateResource,
      listCandidateEvaluations: listCandidateEvaluationsResource,
      listCandidateReplayRuns: listCandidateReplayRunsResource,
      getReplayRun: getReplayRunResource,
      getReplayRunValidationState: getReplayRunValidationStateResource,
      getReplayRunComparison: getReplayRunComparisonResource,
      getTradingRun: getTradingRunResource,
      getEvaluation: getEvaluationResource,
      listSandboxes: listSandboxesResource,
      getSandbox: getSandboxResource,
      getSandboxLogs: getSandboxLogsResource
    })
  ]);

  return server;
}

async function tradingRunResponse(store: LocalStore, tradingRunId: string) {
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

function commandPayloadId(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  throw new Error(`missing_command_payload_${key}`);
}

async function startFixtureTradingRun(input: {
  store: LocalStore;
  sandboxAdapter: SandboxAdapter;
  candidate: CandidateInspectReadModel;
  systemId: string;
  tradingRunId: string;
  candidateVersionId: string;
  paperOrderRequest: PaperOrderRequestFixture;
  tradingApiBaseUrl: string;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
}) {
  await ensureTradingRunSandbox({
    store: input.store,
    sandboxAdapter: input.sandboxAdapter,
    candidate: input.candidate,
    tradingRunId: input.tradingRunId,
    candidateVersionId: input.candidateVersionId,
    paperOrderRequest: input.paperOrderRequest,
    tradingApiBaseUrl: input.tradingApiBaseUrl
  });
  await input.store.recordRunControlAudit(tradingRunLifecycleAuditInput({
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

  const response = await tradingRunResponse(input.store, input.tradingRunId);

  return {
    status: "started",
    ...response,
    trading_gateway_environment: input.tradingGatewayEnvironment
  } as const;
}

async function recordPaperTradingObservationDecision(input: {
  store: LocalStore;
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
        reason: event.reason
      }))
    };
  }
  for (const event of input.tradingSystemEvents) {
    if (event.event_kind === "order_request") {
      const ledger = await input.store.recordLedger(await ledgerInputFromTradingSystemDecision({
        candidateId: input.candidate.candidate_id,
        candidateVersionId,
        tradingRunId: input.tradingRunId,
        paperOrderRequest: event.order_request.quantity === "0" ? "rejected" : "valid",
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
        gateway_outcome: ledger.gateway_result.decision_outcome
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
        reason: event.reason
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
        reason: event.reason
      });
      continue;
    }
    latestDecision = paperNoActionDecision(event.observed_at, event.reason);
    engineEvents.push({
      event_id: event.event_id,
      event_kind: event.event_kind,
      observed_at: event.observed_at,
      reason: event.reason
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
  store: LocalStore;
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

function paperTradingEvaluationRecord(input: {
  candidate: CandidateInspectReadModel;
  tradingRunId: string;
  intervalMs: number;
  startedAt: string;
}): PaperTradingEvaluationRecord {
  const initialEngineState = initialPaperTradingEngineState();
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: `paper-trading-evaluation-${safeRouteId(input.tradingRunId)}`,
    candidate_ref: { record_kind: "trading_system_candidate", id: input.candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: { record_kind: "trading_run", id: input.tradingRunId },
    status: "running",
    interval_ms: input.intervalMs,
    observation_count: 0,
    started_at: input.startedAt,
    next_observation_at: new Date(Date.parse(input.startedAt) + input.intervalMs).toISOString(),
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: initialEngineState.account,
    open_orders: initialEngineState.openOrders,
    processed_trading_system_event_ids: initialEngineState.processedTradingSystemEventIds,
    processed_public_trade_ids: initialEngineState.processedPublicTradeIds,
    authority_status: "not_live"
  };
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

async function ensureTradingRunSandbox(input: {
  store: LocalStore;
  sandboxAdapter: SandboxAdapter;
  candidate: CandidateInspectReadModel;
  tradingRunId: string;
  candidateVersionId: string;
  paperOrderRequest: PaperOrderRequestFixture;
  tradingApiBaseUrl?: string;
}): Promise<SandboxDetailReadModel> {
  const systemCodeId = input.candidate.system_code?.ref?.id ?? FIXTURE_SYSTEM_CODE_ID;
  const artifact = await input.store.getSystemCode(systemCodeId);
  if (!artifact) {
    throw new LocalStoreError(
      "system_code_not_found",
      `system code ${systemCodeId} not found`,
      { system_code_id: systemCodeId }
    );
  }

  const idempotencyKeyParts = [
    "trading-run-sandbox",
    input.paperOrderRequest,
    input.tradingRunId,
    input.candidateVersionId
  ];
  const idempotencyKey = idempotencyKeyParts.join(":");
  const sandboxId = `sandbox-${safeRouteId(idempotencyKey)}`;
  const existing = await input.store.getSandbox(sandboxId);
  const linked = await linkedTradingRunSandbox(input.store, input.tradingRunId);
  if (
    existing &&
    existing.lifecycle_status === "running" &&
    linked?.sandbox_id === existing.sandbox_id
  ) {
    return existing;
  }

  const adapterResult = await input.sandboxAdapter.startArtifactInstance({
    artifact,
    instance_id: sandboxId,
    sandbox_name: `ouro-trading-run-${safeRouteId(input.tradingRunId).slice(0, 34)}-${input.paperOrderRequest}`,
    runtime_ref: { record_kind: "trading_run", id: input.tradingRunId },
    sandbox_placement_id: `sandbox-placement-${safeRouteId(sandboxId)}`,
    created_at: existing?.created_at ?? new Date().toISOString(),
    interval_ms: 1_000,
    paper_order_request: input.paperOrderRequest,
    env: input.tradingApiBaseUrl
      ? { TRADING_API_BASE_URL: input.tradingApiBaseUrl }
      : undefined
  });
  return (await input.store.recordSandboxStart(adapterResult)).sandbox;
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
  paperOrderRequest: PaperOrderRequestFixture;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
  orderRequest: PaperTradingDecisionOrderRequestSummary;
  sampleId?: string;
  observedAt?: string;
}): Promise<LedgerInput> {
  const gatewayExecution = await executeGatewayOrderRequest(input.gatewayRuntimeBinding, input.orderRequest);

  return {
    idempotency_key: [
      "trading-run",
      input.sampleId ?? "sample",
      input.paperOrderRequest,
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

function startPaperOrderRequest(body: StartTradingRunBody | undefined): PaperOrderRequestFixture | undefined {
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

function startRuntimeEnvironment(body: StartTradingRunBody | undefined): TradingRuntimeEnvironment | undefined {
  if (!body?.runtime_environment) {
    return "paper";
  }
  if (body.runtime_environment === "paper" || body.runtime_environment === "live") {
    return body.runtime_environment;
  }
  return undefined;
}

async function refreshGatewayPublicMarketSurface(input: {
  store: LocalStore;
  marketData: GatewayMarketDataPort;
}): Promise<{ status: "recorded" | "skipped" | "failed"; reason?: string }> {
  try {
    const surface = await input.marketData.readPublicMarketLivenessSurface();
    await input.store.recordPublicMarketLivenessSurface(surface);
    return { status: "recorded" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "binance_public_market_refresh_failed"
    };
  }
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

function parseFiniteAccountNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function stopLinkedTradingRunSandbox(input: {
  store: LocalStore;
  sandboxAdapters: Record<SandboxAdapterKind, SandboxAdapter>;
  tradingRunId: string;
}): Promise<SandboxDetailReadModel | undefined> {
  const sandbox = await linkedTradingRunSandbox(input.store, input.tradingRunId);
  if (!sandbox || sandbox.lifecycle_status === "stopped" || sandbox.lifecycle_status === "removed") {
    return sandbox;
  }

  const observations = await input.sandboxAdapters[sandbox.adapter_kind]
    .stopArtifactInstance(sandbox);
  return (await input.store.stopSandbox(
    {
      sandbox_id: sandbox.sandbox_id,
      stopped_at: observations.stopped_at,
      removed_at: observations.removed_at
    },
    observations
  )).sandbox;
}

async function linkedTradingRunSandbox(
  store: LocalStore,
  tradingRunId: string
): Promise<SandboxDetailReadModel | undefined> {
  const tradingRun = await store.getTradingRun(tradingRunId);
  if (!tradingRun?.sandbox_ref) {
    return undefined;
  }
  return store.getSandbox(tradingRun.sandbox_ref.id);
}

function tradingRunLifecycleAuditInput(input: {
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

function ledgerStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" ? 404 : 422;
}

function isRunControlRequestComplete(
  body: RecordRunControlBody
): body is RecordRunControlBody & {
  idempotency_key: string;
  command: RunControlAuditInput["command"];
  decision: RunControlAuditInput["decision"];
  audit_event: RunControlAuditInput["audit_event"];
} {
  return Boolean(body.idempotency_key && body.command && body.decision && body.audit_event);
}

function runtimeControlStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" ? 404 : 422;
}

function runtimeControlError(input: {
  reason: string;
  candidateId: string;
  candidateVersionId?: string;
  idempotencyKey?: string;
}) {
  return {
    error: "run_control_record_failed",
    reason: input.reason,
    candidate_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    idempotency_key: input.idempotencyKey
  };
}

function isPrivateReadinessPostureRequestComplete(
  body: RecordPrivateReadinessPostureBody
): body is RecordPrivateReadinessPostureBody & {
  idempotency_key: string;
  operator_approval_gate: PrivateReadinessPolicyGateInput;
  jurisdiction_risk_gate: PrivateReadinessPolicyGateInput;
  live_binding_gate: PrivateReadinessPolicyGateInput;
  secret_handling_gate: PrivateReadinessPolicyGateInput;
  stop_behavior_gate: PrivateReadinessPolicyGateInput;
  secret_reference_configured: boolean;
} {
  return Boolean(
    body.idempotency_key &&
    body.operator_approval_gate &&
    body.jurisdiction_risk_gate &&
    body.live_binding_gate &&
    body.secret_handling_gate &&
    body.stop_behavior_gate &&
    typeof body.secret_reference_configured === "boolean"
  );
}

function isSupportedPrivateReadinessPostureScope(body: RecordPrivateReadinessPostureBody): boolean {
  return (
    (body.venue === undefined || body.venue === "binance_usd_m_futures") &&
    (body.instrument === undefined || body.instrument === "BTCUSDT") &&
    (body.product_category === undefined || body.product_category === "perpetual_futures")
  );
}

function privateReadinessPostureError(input: {
  reason: string;
  idempotencyKey?: string;
}) {
  return {
    error: "private_readiness_posture_record_failed",
    reason: input.reason,
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    idempotency_key: input.idempotencyKey
  };
}

function hasForbiddenPrivateReadinessPostureMaterial(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasForbiddenPrivateReadinessPostureMaterial);
  }

  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    if (isForbiddenPrivateReadinessPostureMaterialKey(key, entry)) {
      return true;
    }
    return hasForbiddenPrivateReadinessPostureMaterial(entry);
  });
}

function isForbiddenPrivateReadinessPostureMaterialKey(key: string, value: unknown): boolean {
  return (
    key === "apiKey" ||
    key === "secretKey" ||
    key === "listenKey" ||
    key === "signature" ||
    key === "provider_api_key" ||
    key === "exchange_credentials" ||
    key === "raw_secret_material" ||
    (key === "raw_secret_material_present" && value !== false)
  );
}

function parseSandboxAdapterKind(value: string | undefined): SandboxAdapterKind | undefined {
  if (value === undefined) {
    return process.env.OUROBOROS_SANDBOX_ADAPTER === "docker_sandboxes_sbx"
      ? "docker_sandboxes_sbx"
      : "deterministic_test";
  }
  return value === "deterministic_test" || value === "docker_sandboxes_sbx" ? value : undefined;
}

function isSbxRuntimeEnabled(): boolean {
  return process.env.OUROBOROS_ENABLE_SBX_SANDBOX === "1" ||
    process.env.OUROBOROS_SANDBOX_ADAPTER === "docker_sandboxes_sbx";
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function listCandidateSummaries(
  store: LocalStore,
  promotedCandidateRoot?: string,
  replayRunRoot?: string
) {
  const promotedCandidates = await listPromotedCandidateSummaries({
    root: promotedCandidateRoot ?? DEFAULT_PROMOTED_CANDIDATE_ROOT
  });
  const promotedCandidateIds = new Set(promotedCandidates.map((candidate) => candidate.candidate_id));
  const storeCandidates = await store.listCandidates();
  const candidates = [
    ...promotedCandidates,
    ...storeCandidates.filter((candidate) => !promotedCandidateIds.has(candidate.candidate_id))
  ];
  return Promise.all(candidates.map((candidate) => withLatestValidationState(candidate, replayRunRoot)));
}

async function getCandidateReadModel(
  store: LocalStore,
  candidateId: string,
  promotedCandidateRoot?: string,
  replayRunRoot?: string
) {
  const candidate = await getPromotedCandidate({
    root: promotedCandidateRoot ?? DEFAULT_PROMOTED_CANDIDATE_ROOT,
    candidate_id: candidateId
  }) ?? await store.getCandidate(candidateId);
  return candidate ? withLatestValidationState(candidate, replayRunRoot) : undefined;
}

async function withLatestValidationState<T extends CandidateSummaryReadModel>(
  candidate: T,
  replayRunRoot?: string
): Promise<T> {
  return {
    ...candidate,
    latest_validation_state: await getCandidateLatestValidationState({
      root: replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
      candidate_id: candidate.candidate_id
    })
  };
}

function replayRunEvidenceFromRecord(record: ReplayRunRecord): ReplayRunEvidenceReadModel {
  return {
    run_id: record.run_id,
    run_dir: pathFromEvents(record.events_path),
    candidate_id: record.candidate_id,
    runner_kind: record.runner_kind,
    status: record.status,
    run_status: record.run_status,
    scenario_accepted: record.scenario_accepted,
    scenario_total: record.scenario_total,
    provider_request_total: record.provider_request_total,
    runner_command_total: record.runner_command_total,
    artifact_digest: record.artifact_digest,
    completed_at: record.completed_at,
    authority_status: record.authority_status
  };
}

function pathFromEvents(eventsPath: string): string {
  return eventsPath.endsWith("output/replay-set.json")
    ? eventsPath.slice(0, -"output/replay-set.json".length - 1)
    : eventsPath;
}

function parseReplayRunRunnerKind(value: string | undefined): TradingArtifactRunnerKind | undefined {
  if (!value || value === "host" || value === "host_process") {
    return "host_process";
  }
  if (value === "sbx" || value === "sdx" || value === "docker_sandboxes_sbx") {
    return "docker_sandboxes_sbx";
  }
  return undefined;
}

function parseReplayRunScenarioIds(value: unknown): string[] | undefined {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }
  return value;
}

function createHttpReplayRunId(): string {
  return `replay-run-${randomUUID()}`;
}

function hasRequestField(body: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function parseOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Number.isInteger(value) && Number(value) > 0 ? value as number : undefined;
}

function replayRunErrorStatus(error: ReplayRunError): 404 | 422 {
  return error.reason === "candidate_not_found" ? 404 : 422;
}

function sandboxStatusCode(reason: string): 404 | 422 {
  return (
    reason === "system_code_not_found" ||
    reason === "sandbox_not_found" ||
    reason === "runtime_not_found"
  ) ? 404 : 422;
}

function sandboxError(input: {
  reason: string;
  idempotencyKey?: string;
  systemCodeId?: string;
  sandboxId?: string;
  detail?: string;
}) {
  return {
    error: "sandbox_request_failed",
    reason: input.reason,
    idempotency_key: input.idempotencyKey,
    system_code_id: input.systemCodeId,
    sandbox_id: input.sandboxId,
    detail: input.detail
  };
}

function shouldRefreshSandboxStatus(lifecycleStatus: string): boolean {
  return lifecycleStatus !== "stopped" && lifecycleStatus !== "removed" && lifecycleStatus !== "failed";
}

function isPaperTradingErrorEvent(
  event: ParsedTradingSystemPaperEvent | PaperTradingSystemEvent
): event is Extract<ParsedTradingSystemPaperEvent | PaperTradingSystemEvent, { event_kind: "error" }> {
  return event.event_kind === "error";
}

function rawSecretMaterialPath(value: unknown, currentPath = "$"): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${currentPath}.${key}`;
    if (isRawSecretMaterialKey(key)) {
      return nestedPath;
    }
    const descendantPath = rawSecretMaterialPath(nestedValue, nestedPath);
    if (descendantPath) {
      return descendantPath;
    }
  }
  return undefined;
}

function isRawSecretMaterialKey(key: string): boolean {
  return /^(raw_)?secret(_values?)?$/i.test(key) ||
    /^(api[_-]?key|token|password|credentials?|private[_-]?key)$/i.test(key);
}
