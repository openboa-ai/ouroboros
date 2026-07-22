import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type {
  CandidateSummaryReadModel,
  ReplayRunEvidenceReadModel,
  EvaluationExecutionMode,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPostureWriteInput,
  Ref,
  ResearchDirectionKind,
  ResearchControlStudyExecutionLeaseOwner,
  RunControlAuditInput,
  SandboxAdapterKind,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "@ouroboros/application/ports/market-data";
import type { ResearchControlStudyExecutionLeasePort } from
  "@ouroboros/application/ports/research-control-study-execution-lease";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort
} from
  "@ouroboros/application/ports/runtime-process-ownership";
import type { RuntimeSupervisorCheckpointStorePort } from
  "@ouroboros/application/ports/runtime-supervisor";
import type { SystemCodeArtifactResolverPort } from "@ouroboros/application/ports/system-code-artifact";
import {
  SharedSqliteResearchControlStudyExecutionLeaseStore,
  FileSystemRuntimeProcessOwnershipStore,
  FileSystemRuntimeSupervisorCheckpointStore,
  FIXTURE_SYSTEM_CODE_ID,
  LocalStore,
  LocalStoreError,
  currentProcessStartMarker
} from "@ouroboros/local-store";
import { runCandidateEvaluation } from "@ouroboros/application/candidate/evaluation";
import { FixtureEvaluationProviderAdapter } from "@ouroboros/adapters/fixture/evaluation-provider";
import type { EvaluationProviderAdapter } from "@ouroboros/application/ports/provider";
import {
  DeterministicSandboxAdapter,
  DockerSandboxesSbxSandboxAdapter,
  type SandboxAdapter
} from "@ouroboros/adapters/sandbox/adapter";
import { FileSystemCodeArtifactResolver } from "@ouroboros/adapters/artifact/system-code-artifact-resolver";
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
  type GatewayRuntimeBinding,
  type PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import { loadTradingGatewayEnvironment } from "@ouroboros/application/trading/gateway/environment";
import type {
  ManagedResearchAgent,
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
import {
  CandidateArenaRunner,
  DEFAULT_ARENA_DIRECTIONS
} from "@ouroboros/application/candidate/arena";
import { ResearchEvidenceArtifactService } from
  "@ouroboros/application/candidate/research-evidence-artifacts";
import { ArenaOperationsProjectionService } from
  "@ouroboros/application/services/arena-operations";
import {
  ResearchAllocationPolicyDecisionCoordinator,
  type ResearchAllocationPolicyDecisionCoordinatorLifecycle
} from "@ouroboros/application/candidate/research-allocation-policy-decision";
import {
  ResearchGeneralizationOutcomeCoordinator,
  type ResearchGeneralizationOutcomeCoordinatorLifecycle
} from "@ouroboros/application/candidate/research-generalization-outcome-coordinator";
import {
  ResearchGeneralizationPolicyDecisionCoordinator,
  type ResearchGeneralizationPolicyDecisionCoordinatorLifecycle
} from "@ouroboros/application/candidate/research-generalization-policy-decision";
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
  PaperTradingCommandService,
  paperTradingApiProviderNetworkOptions,
  tradingRunResponse
} from "@ouroboros/application/trading/paper/commands";
import { safeId } from "@ouroboros/application/safe-id";
import { PaperTradingEvaluationRunner } from "@ouroboros/application/trading/paper/evaluation-runner";
import {
  PaperTradingSessionService,
  type PaperTradingRecoveryOutcome
} from "@ouroboros/application/trading/paper/session-service";
import { ArenaPaperRuntimeService } from
  "@ouroboros/application/trading/paper/arena-runtime";
import { paperTradingStartRequiresGeneratedEligibility } from
  "@ouroboros/application/trading/paper/start-eligibility";
import { createResearchControlStudyArmSessionFactory } from
  "./candidate/arena/research-control-study-arm-session-factory";
import { createResearchControlStudyServerScheduler } from
  "./candidate/arena/research-control-study-server-runtime";
import {
  createResearchControlStudyExecutionLeaseSessionFactory,
  type ResearchControlStudyExecutionLeaseSessionFactory
} from "./candidate/arena/research-control-study-execution-lease-session";
import {
  ResearchControlStudyCommitmentCoordinator,
  type ResearchControlStudyCommitmentCoordinatorLifecycle
} from "./candidate/arena/research-control-study-commitment-coordinator";
import type { ResearchControlStudySchedulerLifecycle } from
  "./candidate/arena/research-control-study-scheduler";
import { registerCoreControllerRoutes } from "./controllers/core";
import { registerResourceControllerRoutes } from "./controllers/resources";
import { registerRuntimeRouteModules } from "./registry/routes";
import { RuntimeSupervisor } from "./runtime-supervisor";
import {
  createRuntimeSupervisorLanes,
  deferArenaPaperRecoveryOverflow,
  notifyPaperTradingRecoveryObserver
} from "./runtime-supervisor-lanes";

const RUNTIME_REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

export { paperTradingApiProviderNetworkOptions };

export interface BuildServerOptions {
  store?: LocalStore;
  repoRoot?: string;
  evaluationProviderAdapter?: EvaluationProviderAdapter;
  sandboxAdapters?: Partial<Record<SandboxAdapterKind, SandboxAdapter>>;
  replayRunRoot?: string;
  promotedCandidateRoot?: string;
  tradingGatewayEnv?: Record<string, string | undefined>;
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchAgentAdapter?: TradingResearchAgentAdapter;
  tradingResearchAgentFactory?: (agent: TradingResearchRuntimeAgent) => TradingResearchAgentAdapter;
  tradingResearchAgentDescriptor?: (
    agent: TradingResearchRuntimeAgent,
    direction: ResearchDirectionKind
  ) => ManagedResearchAgent;
  tradingResearchRuntimeConfig?: TradingResearchRuntimeConfig;
  agentProfileExecFile?: AgentProfileExecFile;
  candidateArenaTickIntervalMs?: number;
  binancePublicMarketClient?: BinancePublicMarketDataClient;
  marketDataPort?: GatewayMarketDataPort;
  paperTradingEvaluationIntervalMs?: number;
  paperTradingSandboxIntervalMs?: number;
  tradingApiProviderSandboxHost?: string;
  paperTradingApiProviderFactory?: (
    binding: GatewayRuntimeBinding,
    options: PaperTradingApiProviderOptions
  ) => Promise<ReplayTradingApiProviderSession>;
  paperTradingArtifactResolver?: SystemCodeArtifactResolverPort;
  recoverPaperTradingSessionsOnStart?: boolean;
  arenaPaperCapacity?: number;
  onPaperTradingSessionServiceCreated?: (service: PaperTradingSessionService) => void;
  onArenaPaperRuntimeCreated?: (service: ArenaPaperRuntimeService) => void;
  onPaperTradingRecovery?: (
    outcomes: readonly PaperTradingRecoveryOutcome[]
  ) => void | Promise<void>;
  candidateArenaArtifactRunner?: TradingArtifactRunner;
  candidateArenaReplayProviderFactory?: ReplayTradingApiProviderFactory;
  researchControlStudyScheduler?: ResearchControlStudySchedulerLifecycle;
  researchControlStudyPollIntervalMs?: number;
  researchControlStudyWorkspaceRoot?: string;
  researchControlStudyArmSessionFactory?: ReturnType<
    typeof createResearchControlStudyArmSessionFactory
  >;
  researchControlStudyExecutionLeasePort?:
    ResearchControlStudyExecutionLeasePort;
  researchControlStudyExecutionLeaseOwner?:
    ResearchControlStudyExecutionLeaseOwner;
  researchControlStudyExecutionLeaseDurationMs?: number;
  researchControlStudyExecutionLeaseRenewalIntervalMs?: number;
  runtimeProcessOwnershipPort?: RuntimeProcessOwnershipPort;
  runtimeProcessHostId?: string;
  runtimeSupervisorCheckpointStore?: RuntimeSupervisorCheckpointStorePort;
  runtimeSupervisorRetryDelaysMs?: readonly number[];
  runtimeSupervisorMonitorIntervalMs?: number;
  onRuntimeSupervisorCreated?: (supervisor: RuntimeSupervisor) => void;
  researchControlStudyCommitmentCoordinator?:
    ResearchControlStudyCommitmentCoordinatorLifecycle;
  researchGeneralizationOutcomeCoordinator?:
    ResearchGeneralizationOutcomeCoordinatorLifecycle;
  researchGeneralizationPolicyDecisionCoordinator?:
    ResearchGeneralizationPolicyDecisionCoordinatorLifecycle;
  researchAllocationPolicyDecisionCoordinator?:
    ResearchAllocationPolicyDecisionCoordinatorLifecycle;
  runResearchControlStudiesOnStart?: boolean;
  onResearchControlStudySchedulerCreated?: (
    scheduler: ResearchControlStudySchedulerLifecycle
  ) => void;
  operatorApiToken?: string | false;
  operatorCorsOrigins?: readonly string[];
}

export function createResearchControlStudyServerLeaseSessionFactory(
  input: {
    store: LocalStore;
    port?: ResearchControlStudyExecutionLeasePort;
    owner?: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs?: number;
    renewalIntervalMs?: number;
  }
): ResearchControlStudyExecutionLeaseSessionFactory {
  return createResearchControlStudyExecutionLeaseSessionFactory({
    port: input.port ??
      new SharedSqliteResearchControlStudyExecutionLeaseStore(
        input.store.root()
      ),
    owner: input.owner ?? {
      server_instance_id: randomUUID(),
      host_id: hostname(),
      process_id: process.pid,
      process_start_marker: currentProcessStartMarker()
    },
    ...(input.leaseDurationMs === undefined
      ? {}
      : { leaseDurationMs: input.leaseDurationMs }),
    ...(input.renewalIntervalMs === undefined
      ? {}
      : { renewalIntervalMs: input.renewalIntervalMs })
  });
}

export function createResearchControlStudyServerCommitmentCoordinator(
  input: {
    store: LocalStore;
    researchAgentIdentity:
      () => ManagedResearchAgent | Promise<ManagedResearchAgent>;
    marketData: GatewayMarketDataPort;
    repoRoot?: string;
    now?: () => string;
  }
): ResearchControlStudyCommitmentCoordinator {
  return new ResearchControlStudyCommitmentCoordinator({
    store: input.store,
    researchAgentIdentity: input.researchAgentIdentity,
    marketData: input.marketData,
    repoRoot: path.resolve(input.repoRoot ?? RUNTIME_REPO_ROOT),
    ...(input.now ? { now: input.now } : {})
  });
}

export function createResearchAllocationPolicyDecisionServerCoordinator(
  input: {
    store: LocalStore;
    now?: () => string;
  }
): ResearchAllocationPolicyDecisionCoordinator {
  return new ResearchAllocationPolicyDecisionCoordinator({
    store: input.store,
    ...(input.now ? { now: input.now } : {})
  });
}

export function createResearchGeneralizationOutcomeServerCoordinator(
  input: {
    store: LocalStore;
    now?: () => string;
  }
): ResearchGeneralizationOutcomeCoordinator {
  return new ResearchGeneralizationOutcomeCoordinator({
    store: input.store,
    ...(input.now ? { now: input.now } : {})
  });
}

export function createResearchGeneralizationPolicyDecisionServerCoordinator(
  input: {
    store: LocalStore;
    now?: () => string;
  }
): ResearchGeneralizationPolicyDecisionCoordinator {
  return new ResearchGeneralizationPolicyDecisionCoordinator({
    store: input.store,
    ...(input.now ? { now: input.now } : {})
  });
}

interface CreateEvaluationRunBody {
  candidate_version_id?: string;
  idempotency_key?: string;
  stage?: string;
  execution_mode?: EvaluationExecutionMode;
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
  const repoRoot = path.resolve(options.repoRoot ?? RUNTIME_REPO_ROOT);
  const runtimeProcessHostId = options.runtimeProcessHostId ?? hostname();
  const runtimeProcessOwnership = options.runtimeProcessOwnershipPort ??
    new FileSystemRuntimeProcessOwnershipStore(
      path.join(store.root(), "runtime-process-ownership")
    );
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
  const tradingResearchRuntimeConfig = options.tradingResearchRuntimeConfig
    ?? loadTradingResearchRuntimeConfig();
  if (options.tradingResearchAgentFactory && !options.tradingResearchAgentDescriptor) {
    throw new Error("candidate_arena_research_agent_descriptor_required");
  }
  const tradingResearchAgentFactory = options.tradingResearchAgentFactory
    ?? ((agent: TradingResearchRuntimeAgent) => {
      if (options.tradingResearchAgentAdapter && options.tradingResearchAgentAdapter.agent.provider === agent) {
        return options.tradingResearchAgentAdapter;
      }
      return createTradingResearchAgentAdapter(tradingResearchRuntimeConfig, agent, {
        env: agent === "codex" ? managedAgentProfileEnv(store, "codex") : undefined,
        processOwnership: runtimeProcessOwnership,
        hostId: runtimeProcessHostId
      });
    });
  const tradingResearchAgentDescriptor = options.tradingResearchAgentDescriptor ??
    ((agent: TradingResearchRuntimeAgent, direction: ResearchDirectionKind) => {
      if (agent === "fixture") {
        return {
          id: `managed-agent-fixture-arena-${safeId(direction)}`,
          provider: "fixture",
          model: `scripted-arena-${direction}`,
          permission_policy: "fixture_only"
        };
      }
      if (options.tradingResearchAgentAdapter &&
        options.tradingResearchAgentAdapter.agent.provider === agent) {
        return structuredClone(options.tradingResearchAgentAdapter.agent);
      }
      return {
        id: "managed-agent-codex-trading-research",
        provider: "codex",
        model: tradingResearchRuntimeConfig.codex.model,
        permission_policy: "artifact_workspace_only"
      };
    });
  const providedSandboxAdapters = options.sandboxAdapters;
  const sandboxAdapters: Record<SandboxAdapterKind, SandboxAdapter> = {
    deterministic_test: providedSandboxAdapters?.deterministic_test
      ?? new DeterministicSandboxAdapter({
        allowedArtifactRoots: [path.join(store.root(), "candidate-arena-runs")],
        allowedCapabilityPolicyIds: ["candidate-arena-paper-system-code"],
        processOwnership: runtimeProcessOwnership,
        hostId: runtimeProcessHostId
      }),
    docker_sandboxes_sbx: providedSandboxAdapters?.docker_sandboxes_sbx
      ?? new DockerSandboxesSbxSandboxAdapter()
  };
  const sandboxHost = options.tradingApiProviderSandboxHost ?? process.env.OUROBOROS_TRADING_API_SANDBOX_HOST;
  const paperTradingArtifactResolver = options.paperTradingArtifactResolver
    ?? new FileSystemCodeArtifactResolver({ repoRoot });
  const paperTradingSessionService = new PaperTradingSessionService({
    store,
    sandboxAdapters,
    marketData: gatewayMarketDataPort,
    runner: paperTradingEvaluationRunner,
    intervalMs: paperTradingEvaluationIntervalMs,
    sandboxIntervalMs: options.paperTradingSandboxIntervalMs,
    apiProviderFactory: options.paperTradingApiProviderFactory,
    artifactResolver: paperTradingArtifactResolver,
    apiProviderOptions: paperTradingApiProviderNetworkOptions({ sandboxHost }),
    logger: console
  });
  options.onPaperTradingSessionServiceCreated?.(paperTradingSessionService);
  const paperTradingCommandService = new PaperTradingCommandService({
    store,
    marketData: gatewayMarketDataPort,
    tradingGatewayEnvironment,
    sessions: paperTradingSessionService,
    artifactResolver: paperTradingArtifactResolver
  });
  const arenaPaperRuntime = new ArenaPaperRuntimeService({
    store,
    paperTrading: paperTradingCommandService,
    ...(options.arenaPaperCapacity === undefined
      ? {}
      : { capacity: options.arenaPaperCapacity })
  });
  options.onArenaPaperRuntimeCreated?.(arenaPaperRuntime);
  const arenaOperationsProjection = new ArenaOperationsProjectionService({
    store,
    arenaPaperRuntime
  });
  const researchEvidenceArtifacts = new ResearchEvidenceArtifactService({
    store,
    arenaOperations: arenaOperationsProjection
  });
  const candidateArenaRunner = new CandidateArenaRunner({
    store,
    researchAgent: tradingResearchRuntimeConfig.default_agent,
    researchAgentDescriptor: tradingResearchAgentDescriptor,
    agentFactory: tradingResearchAgentFactory,
    artifactRunner: options.candidateArenaArtifactRunner,
    replayProviderFactory: options.candidateArenaReplayProviderFactory,
    researchEvidenceSource: () => researchEvidenceArtifacts.collect()
  }, options.candidateArenaTickIntervalMs);
  const researchControlStudyAgentIdentity = (): ManagedResearchAgent => {
    const agent = candidateArenaRunner.researchAgent();
    return structuredClone(options.tradingResearchAgentDescriptor
      ? tradingResearchAgentDescriptor(agent, DEFAULT_ARENA_DIRECTIONS[0]!)
      : tradingResearchAgentFactory(agent).agent);
  };
  const startArenaPaperCandidate = async (
    candidateId: string,
    payload: Record<string, unknown> | undefined
  ) => {
    const ownership = await arenaPaperCandidateOwnership(store, candidateId);
    if (!ownership.managed || !ownership.candidate) {
      return paperTradingCommandService.start(candidateId, payload);
    }
    const ownedCandidate = ownership.candidate;
    if (!isDefaultArenaPaperStartPayload(payload)) {
      if (isRejectedArenaPaperStartPayload(payload)) {
        return {
          statusCode: 422,
          body: {
            error: "arena_paper_start_payload_unsupported",
            reason: "arena_paper_runtime_owns_candidate_start",
            candidate_id: candidateId,
            candidate_version_id:
              ownedCandidate.candidate_version.candidate_version_id
          }
        };
      }
      return paperTradingCommandService.start(candidateId, payload);
    }
    const before = await arenaPaperRuntime.snapshot();
    if (!before.systems.some((entry) =>
      entry.candidate_ref.id === candidateId
    )) {
      return {
        statusCode: 422,
        body: {
          error: "arena_paper_candidate_ineligible",
          reason: "arena_paper_candidate_not_in_exact_admitted_set",
          candidate_id: candidateId,
          candidate_version_id:
            ownedCandidate.candidate_version.candidate_version_id,
          arena_paper_runtime: before
        }
      };
    }
    await deferArenaPaperRecoveryOverflow({
      paperTradingSessions: paperTradingSessionService,
      arenaPaperRuntime
    });
    const snapshot = await arenaPaperRuntime.reconcile();
    const system = snapshot.systems.find((entry) =>
      entry.candidate_ref.id === candidateId
    );
    if (!system) {
      return {
        statusCode: 422,
        body: {
          error: "arena_paper_candidate_ineligible",
          reason: "arena_paper_candidate_not_in_exact_admitted_set",
          candidate_id: candidateId,
          candidate_version_id:
            ownedCandidate.candidate_version.candidate_version_id,
          arena_paper_runtime: snapshot
        }
      };
    }
    if (system.lifecycle_status === "running") {
      return {
        statusCode: 200,
        body: {
          status: "already_running",
          ...await tradingRunResponse(store, system.trading_run_ref.id),
          paper_trading_evaluation: await store
            .getLatestPaperTradingEvaluationForTradingRun(
              system.trading_run_ref.id
            ),
          runner_status: "running",
          arena_paper_runtime: snapshot
        }
      };
    }
    if (system.lifecycle_status === "recovering") {
      return paperTradingCommandService.start(candidateId, payload);
    }
    if (system.lifecycle_status === "queued" ||
      system.lifecycle_status === "starting") {
      return {
        statusCode: 202,
        body: {
          status: "queued",
          candidate_id: candidateId,
          trading_run_id: system.trading_run_ref.id,
          lifecycle_status: system.lifecycle_status,
          arena_paper_runtime: snapshot
        }
      };
    }
    return {
      statusCode: 422,
      body: {
        error: "arena_paper_runtime_failed",
        reason: system.failure_reason ??
          `arena_paper_${system.lifecycle_status}`,
        candidate_id: candidateId,
        trading_run_id: system.trading_run_ref.id,
        lifecycle_status: system.lifecycle_status,
        arena_paper_runtime: snapshot
      }
    };
  };
  await store.initialize();
  const persistedResearcherProvider = await store.getResearcherProviderSelection();
  if (
    persistedResearcherProvider
    && isTradingResearchRuntimeAgent(persistedResearcherProvider.selected_provider)
  ) {
    candidateArenaRunner.setResearchAgent(persistedResearcherProvider.selected_provider);
  }
  const researchControlStudyArmSessionFactory =
    options.researchControlStudyArmSessionFactory ??
    createResearchControlStudyArmSessionFactory({
      marketData: gatewayMarketDataPort,
      createSandboxAdapters(context) {
        return {
          deterministic_test: new DeterministicSandboxAdapter({
            allowedArtifactRoots: [
              path.join(context.root, "candidate-arena-runs")
            ],
            allowedCapabilityPolicyIds: [
              "candidate-arena-paper-system-code"
            ],
            processOwnership: new FileSystemRuntimeProcessOwnershipStore(
              path.join(context.root, "runtime-process-ownership")
            ),
            hostId: runtimeProcessHostId
          }),
          docker_sandboxes_sbx: new DockerSandboxesSbxSandboxAdapter({
            workspacePath: context.root
          })
        };
      },
      createArtifactResolver(context) {
        return new FileSystemCodeArtifactResolver({
          repoRoot,
          generatedArtifactRoot: path.join(context.root, "candidate-arena-runs")
        });
      },
      intervalMs: paperTradingEvaluationIntervalMs,
      ...(options.paperTradingSandboxIntervalMs === undefined
        ? {}
        : { sandboxIntervalMs: options.paperTradingSandboxIntervalMs }),
      ...(options.paperTradingApiProviderFactory
        ? { apiProviderFactory: options.paperTradingApiProviderFactory }
        : {}),
      apiProviderOptions: paperTradingApiProviderNetworkOptions({ sandboxHost }),
      logger: console
    });
  const researchControlStudyScheduler =
    options.researchControlStudyScheduler ??
    createResearchControlStudyServerScheduler({
      store,
      commitmentCoordinator:
        options.researchControlStudyCommitmentCoordinator ??
        createResearchControlStudyServerCommitmentCoordinator({
          store,
          researchAgentIdentity: researchControlStudyAgentIdentity,
          marketData: gatewayMarketDataPort,
          repoRoot
        }),
      generalizationOutcomeCoordinator:
        options.researchGeneralizationOutcomeCoordinator ??
        createResearchGeneralizationOutcomeServerCoordinator({ store }),
      generalizationPolicyDecisionCoordinator:
        options.researchGeneralizationPolicyDecisionCoordinator ??
        createResearchGeneralizationPolicyDecisionServerCoordinator({ store }),
      policyDecisionCoordinator:
        options.researchAllocationPolicyDecisionCoordinator ??
        createResearchAllocationPolicyDecisionServerCoordinator({ store }),
      leaseSessionFactory:
        createResearchControlStudyServerLeaseSessionFactory({
          store,
          ...(options.researchControlStudyExecutionLeasePort
            ? { port: options.researchControlStudyExecutionLeasePort }
            : {}),
          ...(options.researchControlStudyExecutionLeaseOwner
            ? { owner: options.researchControlStudyExecutionLeaseOwner }
            : {}),
          ...(options.researchControlStudyExecutionLeaseDurationMs ===
              undefined
            ? {}
            : {
                leaseDurationMs:
                  options.researchControlStudyExecutionLeaseDurationMs
              }),
          ...(options
            .researchControlStudyExecutionLeaseRenewalIntervalMs ===
              undefined
            ? {}
            : {
                renewalIntervalMs: options
                  .researchControlStudyExecutionLeaseRenewalIntervalMs
              })
        }),
      marketData: gatewayMarketDataPort,
      agentFactory: tradingResearchAgentFactory,
      createArmSessions: researchControlStudyArmSessionFactory,
      repoRoot,
      ...(options.researchControlStudyWorkspaceRoot
        ? { workspaceRoot: options.researchControlStudyWorkspaceRoot }
        : {}),
      ...(options.candidateArenaArtifactRunner
        ? { artifactRunner: options.candidateArenaArtifactRunner }
        : {}),
      ...(options.candidateArenaReplayProviderFactory
        ? { replayProviderFactory: options.candidateArenaReplayProviderFactory }
        : {}),
      ...(options.researchControlStudyPollIntervalMs === undefined
        ? {}
        : { pollIntervalMs: options.researchControlStudyPollIntervalMs })
    });
  options.onResearchControlStudySchedulerCreated?.(
    researchControlStudyScheduler
  );

  const server = Fastify({
    logger: false
  });

  const operatorApiToken = resolveOperatorApiToken(options.operatorApiToken, process.env);
  const operatorCorsOrigins = resolveOperatorCorsOrigins(options.operatorCorsOrigins, process.env);
  await server.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedOperatorCorsOrigin(origin, operatorCorsOrigins));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type", "x-ouroboros-operator-token"]
  });
  await server.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute"
  });
  const operatorApiAuthPreHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const authorization = authorizeOperatorApiRequest(request.headers, operatorApiToken);
    if (authorization.authorized) {
      return;
    }
    return reply.code(authorization.statusCode).send({
      error: authorization.error,
      message: authorization.message,
      authority_status: "not_live"
    });
  };
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
    if (body.sandbox_name !== undefined && !isSafeSandboxName(body.sandbox_name)) {
      return {
        statusCode: 422,
        body: sandboxError({
          reason: "invalid_sandbox_name",
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

  let runtimeSupervisor!: RuntimeSupervisor;
  const runtimeSupervisorProjection = {
    status: () => runtimeSupervisor.status()
  };
  const operatorService = new OperatorService({
    store,
    candidateArenaRunner,
    paperTradingEvaluationRunner: paperTradingSessionService,
    arenaPaperRuntime,
    runtimeSupervisor: runtimeSupervisorProjection,
    agentProfileExecFile: options.agentProfileExecFile,
    paperEvidenceAdapter: {
      run: async (candidateId) => startArenaPaperCandidate(candidateId, {})
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
          return startArenaPaperCandidate(
            commandPayloadId(payload, "candidate_id"),
            payload
          );
        }
        if (commandKind === "trading_run.observe") {
          return paperTradingCommandService.observe(commandPayloadId(payload, "trading_run_id"));
        }
        if (commandKind === "trading_run.stop") {
          return paperTradingCommandService.stop(commandPayloadId(payload, "trading_run_id"));
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
  runtimeSupervisor = new RuntimeSupervisor({
    lanes: createRuntimeSupervisorLanes({
      store,
      paperTradingSessions: paperTradingSessionService,
      arenaPaperRuntime,
      candidateArenaRunner,
      operatorService,
      researchControlStudyScheduler,
      runSelectedPaper:
        options.recoverPaperTradingSessionsOnStart !== false,
      runResearchControlStudies:
        options.runResearchControlStudiesOnStart !== false,
      ...(options.onPaperTradingRecovery
        ? { onPaperTradingRecovery: options.onPaperTradingRecovery }
        : {}),
      logger: console
    }),
    checkpoints: options.runtimeSupervisorCheckpointStore ??
      new FileSystemRuntimeSupervisorCheckpointStore(store.root()),
    processOwnership: runtimeProcessOwnership,
    processIdentity: runtimeSupervisorProcessIdentity(
      store.root(),
      runtimeProcessHostId
    ),
    ...(options.runtimeSupervisorRetryDelaysMs === undefined
      ? {}
      : { retryDelaysMs: options.runtimeSupervisorRetryDelaysMs }),
    ...(options.runtimeSupervisorMonitorIntervalMs === undefined
      ? {}
      : { monitorIntervalMs: options.runtimeSupervisorMonitorIntervalMs })
  });
  options.onRuntimeSupervisorCreated?.(runtimeSupervisor);
  server.addHook("onClose", async () => {
    await runtimeSupervisor.stop();
  });
  const operatorController = createOperatorController(operatorService);

  await registerRuntimeRouteModules(server, [
    registerCoreControllerRoutes({
      operatorController,
      tradingGatewayEnvironment,
      runtimeSupervisor: runtimeSupervisorProjection,
      storeRoot: store.root(),
      filesystemReadRateLimit,
      commandMutationRateLimit,
      operatorApiAuthPreHandler
    }),
    registerResourceControllerRoutes({
      filesystemReadRateLimit,
      operatorApiAuthPreHandler,
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

  await runtimeSupervisor.start();
  if (!runtimeSupervisor.status().lanes.find((lane) =>
    lane.lane === "selected_paper"
  )?.desired) {
    notifyPaperTradingRecoveryObserver({
      ...(options.onPaperTradingRecovery
        ? { onPaperTradingRecovery: options.onPaperTradingRecovery }
        : {}),
      logger: console
    }, []);
  }
  return server;
}

function runtimeSupervisorProcessIdentity(
  storeRoot: string,
  hostId: string
): RuntimeProcessExpectedIdentity {
  const storeScope = createHash("sha256")
    .update(path.resolve(storeRoot))
    .digest("hex");
  return {
    process_kind: "runtime_supervisor",
    subject_ref: {
      record_kind: "runtime_supervisor",
      id: `runtime-supervisor-${storeScope.slice(0, 24)}`
    },
    runtime_ref: {
      record_kind: "local_store",
      id: `local-store-${storeScope.slice(0, 24)}`
    },
    host_id: hostId,
    executable: process.execPath,
    profile_digest: `sha256:${createHash("sha256").update(JSON.stringify({
      version: 1,
      store_scope: storeScope,
      lanes: [
        "selected_paper",
        "candidate_arena",
        "research_control_study_scheduler"
      ]
    })).digest("hex")}`
  };
}

function resolveOperatorApiToken(
  configuredToken: string | false | undefined,
  env: NodeJS.ProcessEnv
): string | false | undefined {
  if (configuredToken === false) {
    return false;
  }
  const token = stringValue(configuredToken) ?? stringValue(env.OUROBOROS_OPERATOR_API_TOKEN);
  if (token) {
    return token;
  }
  return false;
}

function resolveOperatorCorsOrigins(
  configuredOrigins: readonly string[] | undefined,
  env: NodeJS.ProcessEnv
): Set<string> {
  const origins = new Set<string>();
  for (const origin of configuredOrigins ?? []) {
    const value = stringValue(origin);
    if (value) {
      origins.add(value);
    }
  }
  for (const origin of (env.OUROBOROS_OPERATOR_CORS_ORIGINS ?? "").split(",")) {
    const value = stringValue(origin);
    if (value) {
      origins.add(value);
    }
  }
  return origins;
}

function isAllowedOperatorCorsOrigin(origin: string | undefined, explicitOrigins: Set<string>): boolean {
  if (!origin) {
    return true;
  }
  if (explicitOrigins.has(origin)) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol === "tauri:" &&
      ["localhost", "tauri.localhost"].includes(parsed.hostname)
    ) {
      return true;
    }
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      ["127.0.0.1", "::1", "[::1]", "localhost", "tauri.localhost"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function authorizeOperatorApiRequest(
  headers: Record<string, string | string[] | undefined>,
  expectedToken: string | false | undefined
): {
  authorized: boolean;
  statusCode: 200 | 401 | 503;
  error?: string;
  message?: string;
} {
  if (expectedToken === false) {
    return { authorized: true, statusCode: 200 };
  }
  if (!expectedToken) {
    return {
      authorized: false,
      statusCode: 503,
      error: "operator_api_token_not_configured",
      message: "Set OUROBOROS_OPERATOR_API_TOKEN before exposing the runtime operator API."
    };
  }
  const suppliedToken = operatorApiTokenFromHeaders(headers);
  if (suppliedToken && constantTimeStringEqual(suppliedToken, expectedToken)) {
    return { authorized: true, statusCode: 200 };
  }
  return {
    authorized: false,
    statusCode: 401,
    error: "operator_api_unauthorized",
    message: "A valid operator API token is required."
  };
}

function operatorApiTokenFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const headerToken = stringHeader(headers["x-ouroboros-operator-token"]);
  if (headerToken) {
    return headerToken;
  }
  const authorization = stringHeader(headers.authorization);
  const bearerPrefix = "Bearer ";
  return authorization?.startsWith(bearerPrefix)
    ? stringValue(authorization.slice(bearerPrefix.length))
    : undefined;
}

function stringHeader(value: string | string[] | undefined): string | undefined {
  return stringValue(Array.isArray(value) ? value[0] : value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function commandPayloadId(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  throw new Error(`missing_command_payload_${key}`);
}

function isDefaultArenaPaperStartPayload(
  payload: Record<string, unknown> | undefined
): boolean {
  return (payload?.runtime_environment === undefined ||
      payload.runtime_environment === "paper") &&
    (payload?.paper_order_request === undefined ||
      payload.paper_order_request === "valid");
}

function isRejectedArenaPaperStartPayload(
  payload: Record<string, unknown> | undefined
): boolean {
  return (payload?.runtime_environment === undefined ||
      payload.runtime_environment === "paper") &&
    payload?.paper_order_request === "rejected";
}

async function arenaPaperCandidateOwnership(
  store: LocalStore,
  candidateId: string
) {
  const candidate = await store.getCandidate(candidateId);
  const systemCodeId = candidate?.system_code?.ref?.id;
  const hasArenaAdmission = systemCodeId
    ? (await store.listCandidateAdmissionDecisions()).some((decision) =>
        decision.system_code_ref.id === systemCodeId
      )
    : false;
  return {
    candidate,
    managed: Boolean(candidate && (
      hasArenaAdmission ||
      paperTradingStartRequiresGeneratedEligibility(candidate)
    ))
  };
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

function safeRouteId(value: string): string {
  const prefix = safeId(value, { maxLength: 72 });
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}-${digest}`;
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

function isSafeSandboxName(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(value);
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
  if (!value || value === "sbx" || value === "sdx" || value === "docker_sandboxes_sbx") {
    return "docker_sandboxes_sbx";
  }
  if (value === "host" || value === "host_process") {
    return "host_process";
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
