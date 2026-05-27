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
  OuroborosCommandRequest,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureWriteInput,
  Ref,
  RunControlAuditInput,
  SandboxAdapterKind,
  SandboxDetailReadModel,
  TradingRuntimeEnvironment,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import { FIXTURE_SYSTEM_CODE_ID, LocalStore, LocalStoreError } from "@ouroboros/local-store";
import { runCandidateEvaluation } from "@ouroboros/application/candidate-evaluation";
import { runCandidateGeneration } from "@ouroboros/application/candidate-materialization";
import { CodexCliProviderAdapter } from "@ouroboros/adapters/providers/codex-cli-provider";
import { FixtureEvaluationProviderAdapter } from "@ouroboros/adapters/providers/fixture-evaluation-provider";
import type {
  EvaluationProviderAdapter,
  RuntimeProviderAdapter
} from "@ouroboros/adapters/providers/runtime-provider-adapter";
import {
  DeterministicSandboxAdapter,
  DockerSandboxesSbxSandboxAdapter,
  type PaperOrderRequestFixture,
  type SandboxAdapter
} from "@ouroboros/adapters/sandboxes/sandbox-adapter";
import {
  DEFAULT_REPLAY_RUN_ROOT,
  getCandidateLatestValidationState,
  getReplayRunComparison,
  getReplayRunDetail,
  getReplayRunValidationState,
  listReplayRunEvidence
} from "@ouroboros/application/trading-candidate/replay-run-ledger";
import {
  DEFAULT_PROMOTED_CANDIDATE_ROOT,
  getPromotedCandidate,
  listPromotedCandidateSummaries
} from "@ouroboros/application/trading-candidate/promoted-candidate-bundles";
import {
  ReplayRunError,
  runPromotedCandidateReplay,
  type ReplayRunRecord
} from "@ouroboros/application/trading-candidate/run-replay";
import {
  getTradingSystemExecutionModeContract,
  listTradingSystemExecutionModeContracts
} from "@ouroboros/application/trading-execution-mode-contracts";
import {
  createGatewayRuntimeBinding,
  executeGatewayOrderRequest,
  LIVE_GATEWAY_DISABLED_REASON,
  type GatewayRuntimeBinding
} from "@ouroboros/application/trading-gateway-runtime-binding";
import { loadTradingGatewayEnvironment } from "@ouroboros/application/trading-gateway-environment";
import type { TradingArtifactRunnerKind, TradingResearchAgentAdapter } from "@ouroboros/application/trading-research/types";
import {
  createTradingResearchAgentAdapter,
  fixtureTradingResearchRuntimeConfig,
  probeTradingResearchRuntimeConfig,
  type TradingResearchProbeExecFile,
  type TradingResearchRuntimeAgent,
  type TradingResearchRuntimeConfig
} from "@ouroboros/application/trading-research/runtime-config";
import {
  managedAgentProfileEnv,
  type AgentProfileExecFile
} from "@ouroboros/application/agent-profiles";
import { runCodexImprovementProposalEvaluationDryRun } from "@ouroboros/application/research-orchestration/codex-improvement-proposal-evaluation-dry-run";
import { FixtureImprovementProposalProviderAdapter } from "@ouroboros/application/research-orchestration/fixture-improvement-proposal-provider";
import { runAgentTradingCycle } from "@ouroboros/application/agent-trading-cycle";
import {
  buildCandidateArenaReadModel,
  CandidateArenaRunner
} from "@ouroboros/application/candidate-arena";
import { createOperatorController } from "@ouroboros/application/controllers/operator-controller";
import {
  isTradingResearchRuntimeAgent,
  OperatorService
} from "@ouroboros/application/operator-service";
import {
  BinancePublicMarketSdkAdapter,
  type BinancePublicMarketDataClient
} from "@ouroboros/adapters/trading-substrate/binance-public-market-adapter";
import { safeId } from "@ouroboros/application/safe-id";

export interface BuildServerOptions {
  store?: LocalStore;
  providerAdapter?: RuntimeProviderAdapter;
  evaluationProviderAdapter?: EvaluationProviderAdapter;
  sandboxAdapters?: Partial<Record<SandboxAdapterKind, SandboxAdapter>>;
  replayRunRoot?: string;
  promotedCandidateRoot?: string;
  tradingGatewayEnv?: Record<string, string | undefined>;
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchAgentAdapter?: TradingResearchAgentAdapter;
  tradingResearchAgentFactory?: (agent: TradingResearchRuntimeAgent) => TradingResearchAgentAdapter;
  tradingResearchRuntimeConfig?: TradingResearchRuntimeConfig;
  tradingResearchProbeExecFile?: TradingResearchProbeExecFile;
  agentProfileExecFile?: AgentProfileExecFile;
  tradingResearchIterations?: number;
  candidateArenaTickIntervalMs?: number;
  binancePublicMarketClient?: BinancePublicMarketDataClient;
}

interface CreateEvaluationRunBody {
  candidate_version_id?: string;
  idempotency_key?: string;
  stage?: string;
  execution_mode?: EvaluationExecutionMode;
}

interface RecordLedgerBody {
  candidate_version_id?: string;
  runtime_id?: string;
  idempotency_key?: string;
  intent?: {
    intent_kind?: string;
    side?: string;
    order_type?: string;
    quantity?: string;
    limit_price?: string;
  };
  gateway_result?: {
    decision_outcome?: string;
    decision_reason?: string;
    policy_ref?: Ref;
  };
  execution_result?: {
    execution_mode?: string;
    status?: string;
    result_reason?: string;
    trace_ref?: Ref;
    completed_at?: string;
  };
  created_at?: string;
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

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const store = options.store ?? new LocalStore();
  const providerAdapter = options.providerAdapter ?? new CodexCliProviderAdapter();
  const evaluationProviderAdapter = options.evaluationProviderAdapter ?? new FixtureEvaluationProviderAdapter();
  const tradingGatewayEnvironment = options.tradingGatewayEnvironment
    ?? loadTradingGatewayEnvironment(options.tradingGatewayEnv ?? process.env);
  const tradingResearchRuntimeConfig = options.tradingResearchRuntimeConfig
    ?? fixtureTradingResearchRuntimeConfig();
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
    agentFactory: tradingResearchAgentFactory
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

  server.get("/health", async () => ({
    status: "ok",
    service: "ouroboros-runtime",
    mode: "fixture_convenience_mode",
    store_root: store.root(),
    trading_gateway_environment: tradingGatewayEnvironment,
    projections: "rebuilt_from_authoritative_item_files"
  }));

  server.get("/api/trading-gateway/environment", async () => ({
    trading_gateway_environment: tradingGatewayEnvironment
  }));

  server.get("/api/trading-research/runtime", async () => ({
    trading_research_runtime: await probeTradingResearchRuntimeConfig(
      tradingResearchRuntimeConfig,
      options.tradingResearchProbeExecFile
    )
  }));

  const operatorService = new OperatorService({
    store,
    candidateArenaRunner,
    agentProfileExecFile: options.agentProfileExecFile,
    paperEvidenceAdapter: {
      run: async (candidateId) => {
        const response = await server.inject({
          method: "POST",
          url: `/api/trading-systems/${encodeURIComponent(candidateId)}/trading-runs`
        });
        return {
          statusCode: response.statusCode,
          body: response.json()
        };
      }
    }
  });
  const operatorController = createOperatorController(operatorService);

  server.get(
    "/api/operator",
    filesystemReadRateLimit,
    async () => ({
      operator: await operatorController.readOperator()
    })
  );

  server.post<{ Body: OuroborosCommandRequest }>("/api/commands", commandMutationRateLimit, async (request, reply) => {
    const response = await operatorController.dispatchCommand(request.body);
    return reply.code(response.statusCode).send(response.body);
  });

  server.get("/api/candidate-arena", async () => ({
    candidate_arena: await buildCandidateArenaReadModel(
      store,
      candidateArenaRunner.status(),
      candidateArenaRunner.ticks()
    )
  }));

  server.post("/api/candidate-arena/start", async (_request, reply) => {
    const status = candidateArenaRunner.start();
    return reply.code(202).send({
      status,
      candidate_arena: await buildCandidateArenaReadModel(
        store,
        candidateArenaRunner.status(),
        candidateArenaRunner.ticks()
      )
    });
  });

  server.post("/api/candidate-arena/stop", async (_request, reply) => {
    const status = candidateArenaRunner.stop();
    return reply.code(202).send({
      status,
      candidate_arena: await buildCandidateArenaReadModel(
        store,
        candidateArenaRunner.status(),
        candidateArenaRunner.ticks()
      )
    });
  });

  server.post("/api/candidate-arena/tick", async (_request, reply) => {
    const outcome = await candidateArenaRunner.tick();
    return reply.code(201).send(outcome);
  });

  server.get("/api/trading-execution-modes", async () => ({
    modes: listTradingSystemExecutionModeContracts()
  }));

  server.get<{ Params: { mode: string } }>(
    "/api/trading-execution-modes/:mode",
    async (request, reply) => {
      const mode = getTradingSystemExecutionModeContract(request.params.mode);
      if (!mode) {
        return reply.code(404).send({
          error: "trading_execution_mode_not_found",
          mode: request.params.mode
        });
      }
      return { mode };
    }
  );

  server.get<{
    Querystring: {
      venue?: string;
      instrument?: string;
    };
  }>("/api/trading-substrate/order-fill/latest", async (request, reply) => {
    const venue = request.query.venue ?? "binance_usd_m_futures";
    const instrument = request.query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return reply.code(404).send({
        error: "order_fill_surface_not_found",
        venue,
        instrument
      });
    }

    const surface = await store.getLatestOrderFillSurface({
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT"
    });
    if (!surface) {
      return reply.code(404).send({
        error: "order_fill_surface_not_found",
        venue,
        instrument
      });
    }
    return { surface };
  });

  server.get<{
    Querystring: {
      venue?: string;
      instrument?: string;
    };
  }>("/api/trading-substrate/public-market/latest", async (request, reply) => {
    const venue = request.query.venue ?? "binance_usd_m_futures";
    const instrument = request.query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return reply.code(404).send({
        error: "public_market_liveness_surface_not_found",
        venue,
        instrument
      });
    }

    const refresh = await refreshBinancePublicMarketSurface({
      store,
      tradingGatewayEnvironment,
      client: options.binancePublicMarketClient
    });
    const surface = await store.getLatestPublicMarketLivenessSurface({
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT"
    });
    if (!surface) {
      return reply.code(404).send({
        error: "public_market_liveness_surface_not_found",
        venue,
        instrument
      });
    }
    return {
      refresh_status: refresh.status,
      refresh_reason: refresh.reason,
      surface
    };
  });

  server.get<{
    Querystring: {
      venue?: string;
      instrument?: string;
    };
  }>("/api/trading-substrate/private-readiness/latest", async (request, reply) => {
    const venue = request.query.venue ?? "binance_usd_m_futures";
    const instrument = request.query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return reply.code(404).send({
        error: "private_readiness_preflight_surface_not_found",
        venue,
        instrument
      });
    }

    const surface = await store.getLatestPrivateReadinessPreflightSurface({
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT"
    });
    if (!surface) {
      return reply.code(404).send({
        error: "private_readiness_preflight_surface_not_found",
        venue,
        instrument
      });
    }
    return { surface };
  });

  server.get<{
    Querystring: {
      venue?: string;
      instrument?: string;
    };
  }>("/api/trading-substrate/private-readiness-posture/latest", async (request, reply) => {
    const venue = request.query.venue ?? "binance_usd_m_futures";
    const instrument = request.query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return reply.code(404).send({
        error: "private_readiness_posture_not_found",
        venue,
        instrument
      });
    }

    const posture = await store.getLatestPrivateReadinessPosture({
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT"
    });
    if (!posture) {
      return reply.code(404).send({
        error: "private_readiness_posture_not_found",
        venue,
        instrument
      });
    }
    return { posture };
  });

  server.post<{
    Body: RecordPrivateReadinessPostureBody;
  }>("/api/trading-substrate/private-readiness-posture", async (request, reply) => {
    const body = request.body ?? {};
    if (hasForbiddenPrivateReadinessPostureMaterial(body)) {
      return reply.code(422).send(privateReadinessPostureError({
        reason: "raw_secret_material_forbidden",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (!isSupportedPrivateReadinessPostureScope(body)) {
      return reply.code(422).send(privateReadinessPostureError({
        reason: "unsupported_private_readiness_posture_scope",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (!isPrivateReadinessPostureRequestComplete(body)) {
      return reply.code(422).send(privateReadinessPostureError({
        reason: "invalid_private_readiness_posture_request",
        idempotencyKey: body.idempotency_key
      }));
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

      return reply.code(201).send({
        status: "recorded",
        posture
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(422).send(privateReadinessPostureError({
          reason: error.code,
          idempotencyKey: body.idempotency_key
        }));
      }
      throw error;
    }
  });

  server.get<{
    Querystring: {
      venue?: string;
      instrument?: string;
    };
  }>("/api/trading-substrate/account-position-risk/latest", async (request, reply) => {
    const venue = request.query.venue ?? "binance_usd_m_futures";
    const instrument = request.query.instrument ?? "BTCUSDT";
    if (venue !== "binance_usd_m_futures" || instrument !== "BTCUSDT") {
      return reply.code(404).send({
        error: "account_position_risk_mirror_surface_not_found",
        venue,
        instrument
      });
    }

    const surface = await store.getLatestAccountPositionRiskMirrorSurface({
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT"
    });
    if (!surface) {
      return reply.code(404).send({
        error: "account_position_risk_mirror_surface_not_found",
        venue,
        instrument
      });
    }
    return { surface };
  });

  server.get("/api/candidates", async () => ({
    candidates: await listCandidateSummaries(
      store,
      options.promotedCandidateRoot,
      options.replayRunRoot
    )
  }));

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }
      return await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      ) ?? candidate;
    }
  );

  server.get<{ Params: { candidate_id: string } }>(
    "/api/candidates/:candidate_id/evaluation-runs",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        evaluation_runs: await store.listCandidateEvaluationRuns(request.params.candidate_id)
      };
    }
  );

  server.get<{ Params: { candidate_id: string }; Querystring: { limit?: string } }>(
    "/api/candidates/:candidate_id/replay-runs",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        runs: await listReplayRunEvidence({
          root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
          candidate_id: request.params.candidate_id,
          limit: parseLimit(request.query.limit)
        })
      };
    }
  );

  server.get<{
    Params: { candidate_id: string; run_id: string };
    Querystring: { baseline_run_id?: string };
  }>(
    "/api/candidates/:candidate_id/replay-runs/:run_id/validation-state",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      const validationState = await getReplayRunValidationState({
        root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
        candidate_id: request.params.candidate_id,
        run_id: request.params.run_id,
        baseline_run_id: request.query.baseline_run_id
      });
      if (!validationState) {
        return reply.code(404).send({
          error: "replay_run_validation_state_not_found",
          candidate_id: request.params.candidate_id,
          run_id: request.params.run_id,
          baseline_run_id: request.query.baseline_run_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        validation_state: validationState
      };
    }
  );

  server.get<{
    Params: { candidate_id: string; run_id: string };
    Querystring: { baseline_run_id?: string };
  }>(
    "/api/candidates/:candidate_id/replay-runs/:run_id/comparison",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      if (!request.query.baseline_run_id) {
        return reply.code(422).send({
          error: "replay_run_comparison_rejected",
          reason: "missing_baseline_run_id",
          candidate_id: request.params.candidate_id,
          run_id: request.params.run_id
        });
      }

      const comparison = await getReplayRunComparison({
        root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
        candidate_id: request.params.candidate_id,
        run_id: request.params.run_id,
        baseline_run_id: request.query.baseline_run_id
      });
      if (!comparison) {
        return reply.code(404).send({
          error: "replay_run_comparison_not_found",
          candidate_id: request.params.candidate_id,
          run_id: request.params.run_id,
          baseline_run_id: request.query.baseline_run_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        comparison
      };
    }
  );

  server.get<{ Params: { candidate_id: string; run_id: string } }>(
    "/api/candidates/:candidate_id/replay-runs/:run_id",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }

      const run = await getReplayRunDetail({
        root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
        candidate_id: request.params.candidate_id,
        run_id: request.params.run_id
      });
      if (!run) {
        return reply.code(404).send({
          error: "replay_run_not_found",
          candidate_id: request.params.candidate_id,
          run_id: request.params.run_id
        });
      }

      return {
        candidate_id: request.params.candidate_id,
        run
      };
    }
  );

  server.post<{ Params: { candidate_id: string }; Body: CreateReplayRunBody }>(
    "/api/candidates/:candidate_id/replay-runs",
    async (request, reply) => {
      const candidate = await getCandidateReadModel(
        store,
        request.params.candidate_id,
        options.promotedCandidateRoot,
        options.replayRunRoot
      );
      if (!candidate) {
        return reply.code(404).send({
          error: "candidate_not_found",
          candidate_id: request.params.candidate_id
        });
      }
      if (candidate.fixture_notice.mode !== "local_promoted_candidate_bundle") {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "promoted_candidate_bundle_required",
          candidate_id: request.params.candidate_id
        });
      }
      const candidateId = candidate.candidate_id;

      const body = request.body ?? {};
      if (hasRequestField(body, "run_id")) {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "client_run_id_not_supported",
          candidate_id: candidateId
        });
      }
      const runnerKind = parseReplayRunRunnerKind(body.runner_kind);
      if (!runnerKind) {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "invalid_runner_kind",
          candidate_id: candidateId
        });
      }
      if (runnerKind === "docker_sandboxes_sbx" && !isSbxRuntimeEnabled()) {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "docker_sandboxes_sbx_runtime_disabled",
          candidate_id: candidateId
        });
      }

      const scenarioIds = parseReplayRunScenarioIds(body.scenario_ids);
      if (!scenarioIds) {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "invalid_scenario_ids",
          candidate_id: candidateId
        });
      }
      const timeoutMs = parseOptionalPositiveInteger(body.timeout_ms);
      if (body.timeout_ms !== undefined && timeoutMs === undefined) {
        return reply.code(422).send({
          error: "replay_run_rejected",
          reason: "invalid_timeout_ms",
          candidate_id: candidateId
        });
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
        return reply.code(201).send({
          candidate_id: candidateId,
          run: replayRunEvidenceFromRecord(record)
        });
      } catch (error) {
        if (error instanceof ReplayRunError) {
          return reply.code(replayRunErrorStatus(error)).send({
            error: "replay_run_failed",
            reason: error.reason,
            candidate_id: candidateId,
            message: error.message
          });
        }
        throw error;
      }
    }
  );

  server.get<{ Querystring: { candidate_id?: string; limit?: string } }>(
    "/api/replay-runs",
    async (request) => ({
      candidate_id: request.query.candidate_id,
      runs: await listReplayRunEvidence({
        root: options.replayRunRoot ?? DEFAULT_REPLAY_RUN_ROOT,
        candidate_id: request.query.candidate_id,
        limit: parseLimit(request.query.limit)
      })
    })
  );

  server.get<{ Params: { system_id: string } }>(
    "/api/trading-systems/:system_id/ledger",
    async (request, reply) => {
      const candidate = await store.getCandidate(request.params.system_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_system_not_found",
          system_id: request.params.system_id
        });
      }

      return {
        system_id: request.params.system_id,
        trading_run_id: candidate.runtime.ref.id,
        ledger: candidate.ledger
      };
    }
  );

  server.post<{
    Params: { system_id: string };
    Body: RecordLedgerBody;
  }>("/api/trading-systems/:system_id/ledger", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.system_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "trading_system_not_found",
        system_id: request.params.system_id
      });
    }

    const body = request.body ?? {};
    if (!isLedgerRequestComplete(body)) {
      return reply.code(422).send(ledgerError({
        reason: "invalid_ledger_request",
        candidateId: request.params.system_id,
        candidateVersionId: body.candidate_version_id,
        idempotencyKey: body.idempotency_key
      }));
    }

    try {
      await store.recordLedger({
        idempotency_key: body.idempotency_key,
        candidate_id: request.params.system_id,
        candidate_version_id: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
        runtime_id: body.runtime_id,
        intent: body.intent,
        gateway_result: body.gateway_result,
        execution_result: body.execution_result,
        created_at: body.created_at
      } as LedgerInput);
      const updatedCandidate = await store.getCandidate(request.params.system_id);
      if (!updatedCandidate?.ledger) {
        throw new Error("ledger was not projected after ledger write");
      }

      return reply.code(201).send({
        status: "recorded",
        system_id: request.params.system_id,
        trading_run_id: updatedCandidate.runtime.ref.id,
        order_request: updatedCandidate.ledger.latest_order_request,
        gateway_result: updatedCandidate.ledger.latest_gateway_result,
        execution_result: updatedCandidate.ledger.latest_execution_result,
        ledger: updatedCandidate.ledger
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(ledgerStatusCode(error.code)).send(ledgerError({
          reason: error.code,
          candidateId: request.params.system_id,
          candidateVersionId: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
          idempotencyKey: body.idempotency_key
        }));
      }
      throw error;
    }
  });

  server.post<{ Params: { system_id: string }; Body: StartTradingRunBody }>(
    "/api/trading-systems/:system_id/trading-runs",
    async (request, reply) => {
      const runtimeEnvironment = startRuntimeEnvironment(request.body);
      if (!runtimeEnvironment) {
        return reply.code(400).send({
          error: "invalid_runtime_environment",
          allowed_values: ["paper", "live"]
        });
      }
      const gatewayRuntimeBinding = createGatewayRuntimeBinding({
        environment: runtimeEnvironment,
        marketDataClient: options.binancePublicMarketClient
      });
      if (gatewayRuntimeBinding.status === "disabled") {
        return reply.code(422).send({
          error: "gateway_runtime_binding_disabled",
          reason: gatewayRuntimeBinding.disabled_reason ?? LIVE_GATEWAY_DISABLED_REASON,
          runtime_environment: gatewayRuntimeBinding.environment
        });
      }

      const paperOrderRequest = startPaperOrderRequest(request.body);
      if (!paperOrderRequest) {
        return reply.code(400).send({
          error: "invalid_paper_order_request",
          allowed_values: ["valid", "rejected"]
        });
      }

      const candidate = await store.getCandidate(request.params.system_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_system_not_found",
          system_id: request.params.system_id
        });
      }

      const candidateVersionId = candidate.candidate_version.candidate_version_id;
      const tradingRunId = candidate.runtime.ref.id;
      try {
        const outcome = await startFixtureTradingRun({
          store,
          sandboxAdapter: sandboxAdapters.deterministic_test,
          candidate,
          systemId: request.params.system_id,
          tradingRunId,
          candidateVersionId,
          paperOrderRequest,
          tradingGatewayEnvironment,
          gatewayRuntimeBinding
        });

        return reply.code(201).send(outcome);
      } catch (error) {
        if (error instanceof LocalStoreError) {
          return reply.code(ledgerStatusCode(error.code)).send({
            error: "trading_run_failed",
            reason: error.code,
            system_id: request.params.system_id,
            candidate_version_id: candidateVersionId
          });
        }
        throw error;
      }
    }
  );

  server.get<{ Params: { run_id: string } }>(
    "/api/trading-runs/:run_id",
    async (request, reply) => {
      const response = await tradingRunResponse(store, request.params.run_id);
      if (!response) {
        return reply.code(404).send({
          error: "trading_run_not_found",
          trading_run_id: request.params.run_id
        });
      }
      return response;
    }
  );

  server.post<{ Params: { run_id: string } }>(
    "/api/trading-runs/:run_id/observe",
    async (request, reply) => {
      const response = await tradingRunResponse(store, request.params.run_id);
      if (!response) {
        return reply.code(404).send({
          error: "trading_run_not_found",
          trading_run_id: request.params.run_id
        });
      }
      return {
        status: "observed",
        ...response
      };
    }
  );

  server.post<{ Params: { run_id: string } }>(
    "/api/trading-runs/:run_id/stop",
    async (request, reply) => {
      const candidate = await store.getCandidateForTradingRun(request.params.run_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_run_not_found",
          trading_run_id: request.params.run_id
        });
      }
      const candidateVersionId = candidate.candidate_version.candidate_version_id;
      await store.recordRunControlAudit(tradingRunLifecycleAuditInput({
        idempotencyKey: `trading-run-stop:${request.params.run_id}:${candidateVersionId}`,
        candidateId: candidate.candidate_id,
        candidateVersionId,
        tradingRunId: request.params.run_id,
        action: "stop",
        lifecycleStatus: "stopped",
        actorId: "runtime-api",
        reasonSummary: "Operator requested trading run stop.",
        message: "Trading run stop recorded."
      }));
      await stopLinkedTradingRunSandbox({
        store,
        sandboxAdapters,
        tradingRunId: request.params.run_id
      });

      const response = await tradingRunResponse(store, request.params.run_id);
      return reply.code(201).send({
        status: "stopped",
        ...response
      });
    }
  );

  server.post<{ Params: { system_id: string } }>(
    "/api/trading-systems/:system_id/improvements",
    async (request, reply) => {
      const systemId = parseRoutePathId(request.params.system_id);
      if (!systemId) {
        return reply.code(400).send({
          error: "invalid_system_id",
          system_id: request.params.system_id
        });
      }
      const candidate = await store.getCandidate(systemId);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_system_not_found",
          system_id: systemId
        });
      }

      const candidateVersionId = candidate.candidate_version.candidate_version_id;
      const idempotencyKey = [
        "runtime-api-improvement",
        systemId,
        candidateVersionId
      ].join("-");
      const outcome = await recordFixtureImprovement({
        store,
        systemId,
        candidateVersionId,
        idempotencyKey
      });
      if (outcome.status === "failed") {
        return reply.code(422).send({
          error: "improvement_failed",
          reason: outcome.failure_reason,
          system_id: systemId,
          candidate_version_id: candidateVersionId,
          idempotency_key: idempotencyKey
        });
      }

      return reply.code(201).send(outcome);
    }
  );

  server.post<{ Params: { system_id: string }; Body: StartTradingRunBody }>(
    "/api/trading-systems/:system_id/full-cycle-runs",
    async (request, reply) => {
      const systemId = parseRoutePathId(request.params.system_id);
      if (!systemId) {
        return reply.code(400).send({
          error: "invalid_system_id",
          system_id: request.params.system_id
        });
      }
      const runtimeEnvironment = startRuntimeEnvironment(request.body);
      if (!runtimeEnvironment) {
        return reply.code(400).send({
          error: "invalid_runtime_environment",
          allowed_values: ["paper", "live"]
        });
      }
      const gatewayRuntimeBinding = createGatewayRuntimeBinding({
        environment: runtimeEnvironment,
        marketDataClient: options.binancePublicMarketClient
      });
      if (gatewayRuntimeBinding.status === "disabled") {
        return reply.code(422).send({
          error: "gateway_runtime_binding_disabled",
          reason: gatewayRuntimeBinding.disabled_reason ?? LIVE_GATEWAY_DISABLED_REASON,
          runtime_environment: gatewayRuntimeBinding.environment
        });
      }

      const paperOrderRequest = startPaperOrderRequest(request.body);
      if (!paperOrderRequest || paperOrderRequest !== "valid") {
        return reply.code(400).send({
          error: "invalid_paper_order_request",
          allowed_values: ["valid"]
        });
      }

      const researchAgent = startTradingResearchAgent(request.body);
      if (researchAgent === "invalid") {
        return reply.code(400).send({
          error: "invalid_research_agent",
          allowed_values: ["codex", "fixture"]
        });
      }
      const researchIterations = startTradingResearchIterations(request.body);
      if (researchIterations === "invalid") {
        return reply.code(400).send({
          error: "invalid_research_iterations",
          allowed_range: "1..10"
        });
      }

      const candidate = await store.getCandidate(systemId);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_system_not_found",
          system_id: systemId
        });
      }

      const candidateVersionId = candidate.candidate_version.candidate_version_id;
      try {
        const outcome = await runAgentTradingCycle({
          store,
          sourceSystemId: systemId,
          sourceCandidateVersionId: candidateVersionId,
          tradingGatewayEnvironment,
          gatewayRuntimeBinding,
          agentAdapter: tradingResearchAgentFactory(researchAgent ?? tradingResearchRuntimeConfig.default_agent),
          iterations: researchIterations ?? options.tradingResearchIterations ?? tradingResearchRuntimeConfig.iterations
        });
        return reply.code(201).send(outcome);
      } catch (error) {
        if (error instanceof LocalStoreError) {
          return reply.code(ledgerStatusCode(error.code)).send({
            error: "full_cycle_failed",
            reason: error.code,
            system_id: systemId,
            candidate_version_id: candidateVersionId,
            full_cycle_lineage: blockedFullCycleLineage({
              candidate,
              candidateVersionId,
              reason: error.code
            })
          });
        }
        if (error instanceof Error && error.message.startsWith("agent_trading_cycle_")) {
          return reply.code(422).send({
            error: "full_cycle_failed",
            reason: error.message,
            system_id: systemId,
            candidate_version_id: candidateVersionId,
            full_cycle_lineage: blockedFullCycleLineage({
              candidate,
              candidateVersionId,
              reason: error.message
            })
          });
        }
        if (error instanceof Error && error.message.startsWith("binance_public_market_")) {
          return reply.code(422).send({
            error: "full_cycle_failed",
            reason: error.message,
            system_id: systemId,
            candidate_version_id: candidateVersionId,
            full_cycle_lineage: blockedFullCycleLineage({
              candidate,
              candidateVersionId,
              reason: error.message
            })
          });
        }
        throw error;
      }
    }
  );

  server.get<{ Params: { system_id: string } }>(
    "/api/trading-systems/:system_id/run-control",
    async (request, reply) => {
      const candidate = await store.getCandidate(request.params.system_id);
      if (!candidate) {
        return reply.code(404).send({
          error: "trading_system_not_found",
          system_id: request.params.system_id
        });
      }

      return {
        system_id: request.params.system_id,
        runtime_id: candidate.runtime.ref.id,
        run_control: candidate.runtime.run_control
      };
    }
  );

  server.post<{
    Params: { system_id: string };
    Body: RecordRunControlBody;
  }>("/api/trading-systems/:system_id/run-control", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.system_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "trading_system_not_found",
        system_id: request.params.system_id
      });
    }

    const body = request.body ?? {};
    if (!isRunControlRequestComplete(body)) {
      return reply.code(422).send(runtimeControlError({
        reason: "invalid_run_control_request",
        candidateId: request.params.system_id,
        candidateVersionId: body.candidate_version_id,
        idempotencyKey: body.idempotency_key
      }));
    }

    try {
      const outcome = await store.recordRunControlAudit({
        idempotency_key: body.idempotency_key,
        candidate_id: request.params.system_id,
        candidate_version_id: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
        runtime_id: body.runtime_id,
        command: body.command,
        decision: body.decision,
        audit_event: body.audit_event,
        created_at: body.created_at
      } as RunControlAuditInput);

      return reply.code(201).send({
        status: "recorded",
        ...outcome
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(runtimeControlStatusCode(error.code)).send(runtimeControlError({
          reason: error.code,
          candidateId: request.params.system_id,
          candidateVersionId: body.candidate_version_id ?? candidate.candidate_version.candidate_version_id,
          idempotencyKey: body.idempotency_key
        }));
      }
      throw error;
    }
  });

  server.post<{
    Params: { candidate_id: string };
    Body: CreateEvaluationRunBody;
  }>("/api/candidates/:candidate_id/evaluation-runs", async (request, reply) => {
    const candidate = await store.getCandidate(request.params.candidate_id);
    if (!candidate) {
      return reply.code(404).send({
        error: "candidate_not_found",
        candidate_id: request.params.candidate_id
      });
    }

    const body = request.body ?? {};
    if (body.stage !== undefined && body.stage !== "backtest") {
      return reply.code(422).send({
        error: "evaluation_run_failed",
        reason: "unsupported_evaluation_stage",
        candidate_id: request.params.candidate_id
      });
    }

    const candidateVersionId = body.candidate_version_id ?? candidate.candidate_version.candidate_version_id;
    const requestedExecutionMode = body.execution_mode ?? "host_local";
    const idempotencyKey = body.idempotency_key
      ?? `runtime-api-evaluation-${request.params.candidate_id}-${candidateVersionId}-backtest-${requestedExecutionMode}`;
    const stableRequestId = safeRouteId(`${request.params.candidate_id}-${candidateVersionId}-${idempotencyKey}`);
    const outcome = await runCandidateEvaluation(store, evaluationProviderAdapter, {
      candidate_id: request.params.candidate_id,
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
      const error = statusCode === 404 ? "candidate_not_found" : "evaluation_run_failed";
      return reply.code(statusCode).send({
        error,
        reason: outcome.failure_reason,
        candidate_id: request.params.candidate_id,
        candidate_version_id: candidateVersionId,
        idempotency_key: idempotencyKey
      });
    }

    return reply.code(201).send(outcome);
  });

  server.get<{ Params: { evaluation_run_id: string } }>(
    "/api/evaluation-runs/:evaluation_run_id",
    async (request, reply) => {
      const evaluationRun = await store.getCandidateEvaluationRun(request.params.evaluation_run_id);
      if (!evaluationRun) {
        return reply.code(404).send({
          error: "evaluation_run_not_found",
          evaluation_run_id: request.params.evaluation_run_id
        });
      }
      return evaluationRun;
    }
  );

  server.get(
    "/api/candidate-materialization-attempts",
    filesystemReadRateLimit,
    async () => ({
      attempts: await store.listCandidateMaterializationAttempts()
    })
  );

  server.get<{ Params: { attempt_id: string } }>(
    "/api/candidate-materialization-attempts/:attempt_id",
    async (request, reply) => {
      const attempt = await store.getCandidateMaterializationAttempt(request.params.attempt_id);
      if (!attempt) {
        return reply.code(404).send({
          error: "candidate_materialization_attempt_not_found",
          attempt_id: request.params.attempt_id
        });
      }
      return attempt;
    }
  );

  server.post<{ Body: { prompt?: string } }>("/api/candidate-generation-runs", async (request, reply) => {
    const outcome = await runCandidateGeneration(store, providerAdapter, {
      prompt: request.body?.prompt ?? "Create one MLP-01 generic trading-system candidate."
    });
    if (outcome.status === "failed") {
      return reply.code(422).send(outcome);
    }
    return reply.code(201).send(outcome);
  });

  server.post<{ Body: StartSandboxBody }>("/api/sandboxes", async (request, reply) => {
    const body = request.body ?? {};
    const rawSecretPath = rawSecretMaterialPath(body);
    if (rawSecretPath) {
      return reply.code(422).send(sandboxError({
        reason: "raw_secret_material_rejected",
        idempotencyKey: body.idempotency_key,
        detail: rawSecretPath
      }));
    }

    const adapterKind = parseSandboxAdapterKind(body.adapter_kind);
    if (!adapterKind) {
      return reply.code(422).send(sandboxError({
        reason: "invalid_sandbox_adapter",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (adapterKind === "docker_sandboxes_sbx" && !isSbxRuntimeEnabled()) {
      return reply.code(422).send(sandboxError({
        reason: "docker_sandboxes_sbx_runtime_disabled",
        idempotencyKey: body.idempotency_key
      }));
    }
    if (
      (body.test_ticks !== undefined && !isNonNegativeInteger(body.test_ticks)) ||
      (body.interval_ms !== undefined && !isPositiveInteger(body.interval_ms))
    ) {
      return reply.code(422).send(sandboxError({
        reason: "invalid_sandbox_input",
        idempotencyKey: body.idempotency_key
      }));
    }

    const systemCodeId = body.system_code_id ?? FIXTURE_SYSTEM_CODE_ID;
    const artifact = await store.getSystemCode(systemCodeId);
    if (!artifact) {
      return reply.code(404).send(sandboxError({
        reason: "system_code_not_found",
        idempotencyKey: body.idempotency_key,
        systemCodeId
      }));
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
        test_ticks: body.test_ticks,
        interval_ms: body.interval_ms
      });
      const outcome = await store.recordSandboxStart(adapterResult);
      const lifecycleStatus = outcome.sandbox.lifecycle_status;
      return reply.code(201).send({
        status: lifecycleStatus === "running" ? "started" : lifecycleStatus,
        ...outcome
      });
    } catch (error) {
      if (error instanceof LocalStoreError) {
        return reply.code(sandboxStatusCode(error.code)).send(sandboxError({
          reason: error.code,
          idempotencyKey,
          systemCodeId
        }));
      }
      throw error;
    }
  });

  server.get(
    "/api/sandboxes",
    filesystemReadRateLimit,
    async () => ({
      sandboxes: await store.listSandboxes()
    })
  );

  server.get<{ Params: { sandbox_id: string } }>(
    "/api/sandboxes/:sandbox_id",
    async (request, reply) => {
      const sandbox = await store.getSandbox(request.params.sandbox_id);
      if (!sandbox) {
        return reply.code(404).send(sandboxError({
          reason: "sandbox_not_found",
          sandboxId: request.params.sandbox_id
        }));
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
          return await store.getSandbox(sandbox.sandbox_id);
        }
      }
      return sandbox;
    }
  );

  server.get<{ Params: { sandbox_id: string } }>(
    "/api/sandboxes/:sandbox_id/logs",
    async (request, reply) => {
      const sandbox = await store.getSandbox(request.params.sandbox_id);
      if (!sandbox) {
        return reply.code(404).send(sandboxError({
          reason: "sandbox_not_found",
          sandboxId: request.params.sandbox_id
        }));
      }
      if (!shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
        return {
          sandbox,
          logs: sandbox.logs,
          heartbeats: sandbox.heartbeats,
          command_evidence: sandbox.command_evidence
        };
      }

      const observations = await sandboxAdapters[sandbox.adapter_kind]
        .getArtifactInstanceLogs(sandbox);
      const outcome = await store.recordSandboxObservations(
        sandbox.sandbox_id,
        observations
      );
      return outcome;
    }
  );

  server.post<{ Params: { sandbox_id: string } }>(
    "/api/sandboxes/:sandbox_id/stop",
    async (request, reply) => {
      const sandbox = await store.getSandbox(request.params.sandbox_id);
      if (!sandbox) {
        return reply.code(404).send(sandboxError({
          reason: "sandbox_not_found",
          sandboxId: request.params.sandbox_id
        }));
      }
      if (!shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
        return {
          status: sandbox.lifecycle_status,
          sandbox
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
        status: outcome.sandbox.lifecycle_status,
        ...outcome
      };
    }
  );

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

async function startFixtureTradingRun(input: {
  store: LocalStore;
  sandboxAdapter: SandboxAdapter;
  candidate: CandidateInspectReadModel;
  systemId: string;
  tradingRunId: string;
  candidateVersionId: string;
  paperOrderRequest: PaperOrderRequestFixture;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
}) {
  const sandbox = await ensureTradingRunSandbox({
    store: input.store,
    sandboxAdapter: input.sandboxAdapter,
    candidate: input.candidate,
    tradingRunId: input.tradingRunId,
    candidateVersionId: input.candidateVersionId,
    paperOrderRequest: input.paperOrderRequest
  });
  await input.store.recordLedger(await ledgerInputFromSandboxOutput({
    sandbox,
    candidateId: input.systemId,
    candidateVersionId: input.candidateVersionId,
    tradingRunId: input.tradingRunId,
    paperOrderRequest: input.paperOrderRequest,
    gatewayRuntimeBinding: input.gatewayRuntimeBinding
  }));
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
  if (!response?.ledger) {
    throw new Error("trading run response was not projected after start");
  }

  return {
    status: "started",
    ...response,
    order_request: response.ledger.latest_order_request,
    gateway_result: response.ledger.latest_gateway_result,
    execution_result: response.ledger.latest_execution_result,
    trading_gateway_environment: input.tradingGatewayEnvironment
  } as const;
}

async function recordFixtureImprovement(input: {
  store: LocalStore;
  systemId: string;
  candidateVersionId: string;
  idempotencyKey: string;
}) {
  const outcome = await runCodexImprovementProposalEvaluationDryRun({
    store: input.store,
    initialize_store: false,
    provider_adapter: new FixtureImprovementProposalProviderAdapter(),
    parent_system_code_ref: {
      record_kind: "system_code",
      id: FIXTURE_SYSTEM_CODE_ID
    },
    idempotency_key: input.idempotencyKey,
    created_at: "2026-05-18T00:00:00.000Z",
    submitted_at: "2026-05-18T00:00:00.000Z"
  });
  if (outcome.status === "failed") {
    return {
      status: "failed",
      idempotency_key: input.idempotencyKey,
      failure_reason: outcome.failure_reason
    } as const;
  }

  await input.store.rebuildProjections();
  const updatedCandidate = await input.store.getCandidate(input.systemId);
  if (!updatedCandidate?.improvement) {
    throw new Error("improvement was not projected after improvement write");
  }

  return {
    status: "evaluated",
    idempotency_key: input.idempotencyKey,
    proposal: outcome.proposal.proposal,
    system_code: outcome.proposal.system_code,
    lineage: outcome.proposal.lineage,
    orchestration_run: outcome.proposal.run,
    experiment: outcome.experiment,
    trading_evaluation_result: outcome.evaluation_result,
    improvement: updatedCandidate.improvement
  } as const;
}

async function ensureTradingRunSandbox(input: {
  store: LocalStore;
  sandboxAdapter: SandboxAdapter;
  candidate: CandidateInspectReadModel;
  tradingRunId: string;
  candidateVersionId: string;
  paperOrderRequest: PaperOrderRequestFixture;
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

  const idempotencyKey = [
    "trading-run-sandbox",
    input.paperOrderRequest,
    input.tradingRunId,
    input.candidateVersionId
  ].join(":");
  const sandboxId = `sandbox-${safeRouteId(idempotencyKey)}`;
  const existing = await input.store.getSandbox(sandboxId);
  const linked = await linkedTradingRunSandbox(input.store, input.tradingRunId);
  if (
    existing &&
    existing.lifecycle_status !== "failed" &&
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
    test_ticks: 2,
    interval_ms: 1_000,
    paper_order_request: input.paperOrderRequest
  });
  return (await input.store.recordSandboxStart(adapterResult)).sandbox;
}

interface SandboxOrderRequestEvent {
  intent_kind: "place_order";
  symbol: "BTCUSDT";
  side: "buy" | "sell";
  order_type: "market" | "limit";
  quantity: string;
  limit_price?: string;
  at?: string;
}

async function ledgerInputFromSandboxOutput(input: {
  sandbox: SandboxDetailReadModel;
  candidateId: string;
  candidateVersionId: string;
  tradingRunId: string;
  paperOrderRequest: PaperOrderRequestFixture;
  gatewayRuntimeBinding: GatewayRuntimeBinding;
}): Promise<LedgerInput> {
  const orderRequest = latestSandboxOrderRequest(input.sandbox);
  if (!orderRequest) {
    throw new LocalStoreError(
      "invalid_ledger_input",
      `sandbox ${input.sandbox.sandbox_id} did not emit an order_request event`,
      { sandbox_id: input.sandbox.sandbox_id, runtime_id: input.tradingRunId }
    );
  }
  const gatewayExecution = await executeGatewayOrderRequest(input.gatewayRuntimeBinding, orderRequest);

  return {
    idempotency_key: [
      "trading-run",
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
    created_at: orderRequest.at
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

function startRuntimeEnvironment(body: StartTradingRunBody | undefined): TradingRuntimeEnvironment | undefined {
  if (!body?.runtime_environment) {
    return "paper";
  }
  if (body.runtime_environment === "paper" || body.runtime_environment === "live") {
    return body.runtime_environment;
  }
  return undefined;
}

function startTradingResearchAgent(
  body: StartTradingRunBody | undefined
): TradingResearchRuntimeAgent | "invalid" | undefined {
  if (!body?.research_agent) {
    return undefined;
  }
  if (body.research_agent === "codex" || body.research_agent === "fixture") {
    return body.research_agent;
  }
  return "invalid";
}

function startTradingResearchIterations(body: StartTradingRunBody | undefined): number | "invalid" | undefined {
  if (body?.research_iterations === undefined) {
    return undefined;
  }
  const iterations = Number(body.research_iterations);
  if (Number.isInteger(iterations) && iterations >= 1 && iterations <= 10) {
    return iterations;
  }
  return "invalid";
}

function blockedFullCycleLineage(input: {
  candidate: CandidateInspectReadModel;
  candidateVersionId: string;
  reason: string;
}) {
  return {
    handoff_status: "blocked" as const,
    blocked_stage: fullCycleBlockedStage(input.reason),
    blocked_reason: input.reason,
    source: {
      trading_system_id: input.candidate.candidate_id,
      candidate_version_id: input.candidateVersionId,
      system_code_ref: input.candidate.system_code?.ref
    }
  };
}

function fullCycleBlockedStage(reason: string): string {
  if (reason.includes("rejected_paper_order_request")) {
    return "paper_gateway";
  }
  if (reason.includes("missing_order_request")) {
    return "paper_trading";
  }
  if (reason.includes("binance_public_market_snapshot")) {
    return "paper_trading";
  }
  if (reason.includes("source_system_code") || reason.includes("source_artifact")) {
    return "source_system_code";
  }
  if (reason.includes("agent_failed") || reason.includes("no_research_entry")) {
    return "agent_research";
  }
  if (reason.includes("materialization") || reason.includes("projection")) {
    return "materialization";
  }
  return "full_cycle";
}

async function refreshBinancePublicMarketSurface(input: {
  store: LocalStore;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  client?: BinancePublicMarketDataClient;
}): Promise<{ status: "recorded" | "skipped" | "failed"; reason?: string }> {
  const restBaseUrl = input.tradingGatewayEnvironment.runtime_bindings.paper.rest_base_url;
  if (!restBaseUrl) {
    return {
      status: "skipped",
      reason: "rest_base_url_not_configured"
    };
  }

  const adapter = new BinancePublicMarketSdkAdapter({
    restBaseUrl,
    client: input.client
  });
  try {
    const surface = await adapter.readBtcUsdtPublicMarketLivenessSurface();
    await input.store.recordPublicMarketLivenessSurface(surface);
    return { status: "recorded" };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "binance_public_market_refresh_failed"
    };
  }
}

function latestSandboxOrderRequest(
  sandbox: SandboxDetailReadModel
): SandboxOrderRequestEvent | undefined {
  return sandbox.logs
    .flatMap((log) => log.lines.map(parseSandboxOrderRequestEvent))
    .filter((event): event is SandboxOrderRequestEvent => Boolean(event))
    .at(-1);
}

function parseSandboxOrderRequestEvent(line: string): SandboxOrderRequestEvent | undefined {
  try {
    const value = JSON.parse(line) as Record<string, unknown>;
    if (value.event !== "order_request") {
      return undefined;
    }
    if (
      value.intent_kind !== "place_order" ||
      value.symbol !== "BTCUSDT" ||
      !isOrderSide(value.side) ||
      !isOrderType(value.order_type) ||
      typeof value.quantity !== "string" ||
      (value.limit_price !== undefined && typeof value.limit_price !== "string")
    ) {
      return undefined;
    }
    return {
      intent_kind: value.intent_kind,
      symbol: value.symbol,
      side: value.side,
      order_type: value.order_type,
      quantity: value.quantity,
      limit_price: value.limit_price,
      at: typeof value.at === "string" ? value.at : undefined
    };
  } catch {
    return undefined;
  }
}

function isOrderSide(value: unknown): value is "buy" | "sell" {
  return value === "buy" || value === "sell";
}

function isOrderType(value: unknown): value is "market" | "limit" {
  return value === "market" || value === "limit";
}

async function stopLinkedTradingRunSandbox(input: {
  store: LocalStore;
  sandboxAdapters: Record<SandboxAdapterKind, SandboxAdapter>;
  tradingRunId: string;
}): Promise<SandboxDetailReadModel | undefined> {
  const sandbox = await linkedTradingRunSandbox(input.store, input.tradingRunId);
  if (!sandbox || !shouldRefreshSandboxStatus(sandbox.lifecycle_status)) {
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
  action: "start" | "stop";
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

function isLedgerRequestComplete(
  body: RecordLedgerBody
): body is RecordLedgerBody & {
  idempotency_key: string;
  intent: LedgerInput["intent"];
  gateway_result: LedgerInput["gateway_result"];
} {
  return Boolean(body.idempotency_key && body.intent && body.gateway_result);
}

function ledgerStatusCode(reason: string): 404 | 422 {
  return reason === "candidate_not_found" ? 404 : 422;
}

function ledgerError(input: {
  reason: string;
  candidateId: string;
  candidateVersionId?: string;
  idempotencyKey?: string;
}) {
  return {
    error: "ledger_record_failed",
    reason: input.reason,
    system_id: input.candidateId,
    candidate_version_id: input.candidateVersionId,
    idempotency_key: input.idempotencyKey
  };
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

function parseRoutePathId(value: string): string | undefined {
  return isPathSafeRouteId(value) ? value : undefined;
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

function isPathSafeRouteId(value: string): boolean {
  return /^[a-zA-Z0-9._:-]+$/.test(value) && !value.includes("..");
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
