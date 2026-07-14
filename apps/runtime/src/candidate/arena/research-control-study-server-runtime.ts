import { createHash } from "node:crypto";
import path from "node:path";
import type { ResearchAllocationPolicyDecisionCoordinatorLifecycle } from
  "@ouroboros/application/candidate/research-allocation-policy-decision";
import type { ResearchGeneralizationOutcomeCoordinatorLifecycle } from
  "@ouroboros/application/candidate/research-generalization-outcome-coordinator";
import type { ResearchGeneralizationPolicyDecisionCoordinatorLifecycle } from
  "@ouroboros/application/candidate/research-generalization-policy-decision";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import type { ReplayTradingApiProviderFactory } from
  "@ouroboros/application/trading/research/replay-set-runner";
import type { TradingResearchRuntimeAgent } from
  "@ouroboros/application/trading/research/runtime-config";
import type {
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { ResearchControlStudyProcessSupervisor } from
  "./research-control-study-process-supervisor";
import type { ResearchControlStudyExecutionLeaseSessionFactory } from
  "./research-control-study-execution-lease-session";
import type { ResearchControlStudyCommitmentCoordinatorLifecycle } from
  "./research-control-study-commitment-coordinator";
import {
  ResearchControlStudyScheduler,
  type ResearchControlStudySchedulerLifecycle
} from "./research-control-study-scheduler";
import {
  createResearchControlStudyRuntime,
  type ResearchControlStudyRuntime,
  type RunResearchControlCampaignToOutcomeInput
} from "./research-control-study-runtime";

export class ResearchControlStudyServerRuntimeError extends Error {
  readonly code = "research_control_study_server_runtime_agent_mismatch";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchControlStudyServerRuntimeError";
  }
}

export interface OpenResearchControlStudyServerRuntimeInput {
  study: ResearchControlStudyRecord;
  store: LocalStore;
  workspaceRoot?: string;
  repoRoot?: string;
  marketData: GatewayMarketDataPort;
  agentFactory(
    agent: TradingResearchRuntimeAgent
  ): TradingResearchAgentAdapter;
  createArmSessions: NonNullable<
    RunResearchControlCampaignToOutcomeInput["createArmSessions"]
  >;
  artifactRunner?: TradingArtifactRunner;
  replayProviderFactory?: ReplayTradingApiProviderFactory;
  createStudyRuntime?: typeof createResearchControlStudyRuntime;
  ownership?: { guard(): Promise<void> };
}

export interface CreateResearchControlStudyServerSchedulerInput
  extends Omit<OpenResearchControlStudyServerRuntimeInput, "study"> {
  pollIntervalMs?: number;
  schedulerNow?: () => string;
  schedulerSleep?: (milliseconds: number) => Promise<void>;
  leaseSessionFactory?: ResearchControlStudyExecutionLeaseSessionFactory;
  commitmentCoordinator?: ResearchControlStudyCommitmentCoordinatorLifecycle;
  generalizationOutcomeCoordinator?:
    ResearchGeneralizationOutcomeCoordinatorLifecycle;
  generalizationPolicyDecisionCoordinator?:
    ResearchGeneralizationPolicyDecisionCoordinatorLifecycle;
  policyDecisionCoordinator?:
    ResearchAllocationPolicyDecisionCoordinatorLifecycle;
}

export async function openResearchControlStudyServerRuntime(
  input: OpenResearchControlStudyServerRuntimeInput
): Promise<ResearchControlStudyRuntime> {
  const condition = structuredClone(input.study.condition);
  const provider = condition.research_agent.provider;
  if (!isTradingResearchRuntimeAgent(provider)) throw agentMismatch();
  const expectedIdentity = Object.freeze(
    structuredClone(condition.research_agent)
  );
  const agentFactory = (
    requested: TradingResearchRuntimeAgent
  ): TradingResearchAgentAdapter => {
    if (requested !== provider) throw agentMismatch();
    let adapter: TradingResearchAgentAdapter;
    try {
      adapter = input.agentFactory(requested);
    } catch (error) {
      throw agentMismatch(error);
    }
    assertAdapterIdentity(adapter, expectedIdentity);
    return adapter;
  };
  const configuredAgent = agentFactory(provider);
  const { protocol_digest: _protocolDigest, ...paperEvaluationProtocol } =
    condition.paper_evaluation_protocol;
  const createStudyRuntime = input.createStudyRuntime ??
    createResearchControlStudyRuntime;

  return createStudyRuntime({
    store: input.store,
    ...(input.ownership
      ? { beforeAdvance: () => input.ownership!.guard() }
      : {}),
    campaign: {
      workspaceRoot: input.workspaceRoot ?? path.join(
        input.store.root(),
        "research-control-study-workspaces"
      ),
      sourceCandidateId: condition.source.candidate_ref.id,
      expectedTradingPromotionId:
        condition.paper_comparator.trading_promotion_ref.id,
      researchAgent: provider,
      researchAgentIdentity: structuredClone(configuredAgent.agent),
      agentFactory,
      tickCountPerArm: condition.campaign_policy.tick_count_per_arm,
      maximumBaselineRegularFileCount:
        condition.campaign_policy.maximum_baseline_regular_file_count,
      maximumBaselineTotalBytes:
        condition.campaign_policy.maximum_baseline_total_bytes,
      paperEvaluationProtocol,
      marketData: input.marketData,
      createArmSessions: input.createArmSessions,
      ...(input.repoRoot ? { repoRoot: input.repoRoot } : {}),
      ...(input.artifactRunner ? { artifactRunner: input.artifactRunner } : {}),
      ...(input.replayProviderFactory
        ? { replayProviderFactory: input.replayProviderFactory }
        : {})
    }
  });
}

export function createResearchControlStudyServerScheduler(
  input: CreateResearchControlStudyServerSchedulerInput
): ResearchControlStudySchedulerLifecycle {
  const supervisor = new ResearchControlStudyProcessSupervisor({
    store: input.store,
    ...(input.leaseSessionFactory
      ? { leaseSessionFactory: input.leaseSessionFactory }
      : {}),
    openStudy: (study, ownership) => openResearchControlStudyServerRuntime({
      study,
      store: input.store,
      marketData: input.marketData,
      agentFactory: input.agentFactory,
      createArmSessions: input.createArmSessions,
      ...(ownership ? { ownership } : {}),
      ...(input.workspaceRoot ? { workspaceRoot: input.workspaceRoot } : {}),
      ...(input.repoRoot ? { repoRoot: input.repoRoot } : {}),
      ...(input.artifactRunner ? { artifactRunner: input.artifactRunner } : {}),
      ...(input.replayProviderFactory
        ? { replayProviderFactory: input.replayProviderFactory }
        : {}),
      ...(input.createStudyRuntime
        ? { createStudyRuntime: input.createStudyRuntime }
        : {})
    })
  });
  return new ResearchControlStudyScheduler({
    supervisor,
    ...(input.commitmentCoordinator
      ? { commitmentCoordinator: input.commitmentCoordinator }
      : {}),
    ...(input.generalizationOutcomeCoordinator
      ? {
          generalizationOutcomeCoordinator:
            input.generalizationOutcomeCoordinator
        }
      : {}),
    ...(input.generalizationPolicyDecisionCoordinator
      ? {
          generalizationPolicyDecisionCoordinator:
            input.generalizationPolicyDecisionCoordinator
        }
      : {}),
    ...(input.policyDecisionCoordinator
      ? { policyDecisionCoordinator: input.policyDecisionCoordinator }
      : {}),
    ...(input.pollIntervalMs === undefined
      ? {}
      : { pollIntervalMs: input.pollIntervalMs }),
    ...(input.schedulerNow ? { now: input.schedulerNow } : {}),
    ...(input.schedulerSleep ? { sleep: input.schedulerSleep } : {})
  });
}

function assertAdapterIdentity(
  adapter: TradingResearchAgentAdapter,
  expected: ResearchControlStudyRecord["condition"]["research_agent"]
): void {
  const agent = adapter?.agent;
  if (!agent || typeof adapter.improveArtifact !== "function" ||
    typeof agent.id !== "string" || !agent.id.trim() ||
    agent.id.trim() !== agent.id ||
    !isTradingResearchRuntimeAgent(agent.provider) ||
    (agent.model !== undefined &&
      (typeof agent.model !== "string" || !agent.model.trim() ||
        agent.model.trim() !== agent.model)) ||
    !validPermissionPolicy(agent) ||
    agent.provider !== expected.provider ||
    agent.model !== expected.model ||
    agent.permission_policy !== expected.permission_policy) {
    throw agentMismatch();
  }
  const compact = {
    provider: agent.provider,
    ...(agent.model ? { model: agent.model } : {}),
    permission_policy: agent.permission_policy
  };
  if (canonicalDigest(compact) !== expected.identity_digest) {
    throw agentMismatch();
  }
}

function validPermissionPolicy(agent: ManagedResearchAgent): boolean {
  return agent.provider === "fixture"
    ? agent.permission_policy === "fixture_only"
    : agent.permission_policy === "artifact_workspace_only";
}

function isTradingResearchRuntimeAgent(
  value: unknown
): value is TradingResearchRuntimeAgent {
  return value === "codex" || value === "claude_code" || value === "fixture";
}

function canonicalDigest(value: unknown): string {
  const input = paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function agentMismatch(cause?: unknown): ResearchControlStudyServerRuntimeError {
  return new ResearchControlStudyServerRuntimeError(
    "ResearchControlStudy server agent does not match its persisted identity.",
    cause === undefined ? undefined : { cause }
  );
}
