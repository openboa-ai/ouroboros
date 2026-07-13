import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { TradingArtifactRunner } from
  "@ouroboros/application/trading/research/artifact-runner";
import type { ReplayTradingApiProviderFactory } from
  "@ouroboros/application/trading/research/replay-set-runner";
import type {
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "@ouroboros/application/trading/research/types";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  createResearchControlStudyRuntime,
  type ResearchControlStudyRuntime
} from "../src/candidate/arena/research-control-study-runtime";
import {
  createResearchControlStudyServerScheduler,
  openResearchControlStudyServerRuntime
} from "../src/candidate/arena/research-control-study-server-runtime";
import { ResearchControlStudyScheduler } from
  "../src/candidate/arena/research-control-study-scheduler";
import { researchControlStudyFixture } from
  "./helpers/research-control-study";

describe("ResearchControlStudy server runtime", () => {
  it("reconstructs one runtime from the exact persisted study condition", async () => {
    const store = new LocalStore("/tmp/ouroboros-study-server-store");
    const study = persistedStudy();
    const marketData = {} as GatewayMarketDataPort;
    const createArmSessions = async () => ({}) as never;
    const artifactRunner = {} as TradingArtifactRunner;
    const replayProviderFactory = (() => undefined) as unknown as
      ReplayTradingApiProviderFactory;
    const adapter = agentAdapter(persistedAgent());
    const runtime = {} as ResearchControlStudyRuntime;
    let guardCount = 0;
    const ownership = {
      async guard() { guardCount += 1; }
    };
    let captured:
      Parameters<typeof createResearchControlStudyRuntime>[0] | undefined;
    let factoryCount = 0;

    const opened = await openResearchControlStudyServerRuntime({
      study,
      store,
      repoRoot: "/repo/ouroboros",
      marketData,
      agentFactory(agent) {
        factoryCount += 1;
        expect(agent).toBe("fixture");
        return adapter;
      },
      createArmSessions,
      artifactRunner,
      replayProviderFactory,
      ownership,
      createStudyRuntime(input) {
        captured = input;
        return runtime;
      }
    });

    expect(opened).toBe(runtime);
    expect(factoryCount).toBe(1);
    expect(captured).toMatchObject({
      store,
      campaign: {
        workspaceRoot: path.join(
          store.root(),
          "research-control-study-workspaces"
        ),
        sourceCandidateId: study.condition.source.candidate_ref.id,
        researchAgent: study.condition.research_agent.provider,
        researchAgentIdentity: persistedAgent(),
        tickCountPerArm: study.condition.campaign_policy.tick_count_per_arm,
        maximumBaselineRegularFileCount:
          study.condition.campaign_policy.maximum_baseline_regular_file_count,
        maximumBaselineTotalBytes:
          study.condition.campaign_policy.maximum_baseline_total_bytes,
        marketData,
        createArmSessions,
        repoRoot: "/repo/ouroboros",
        artifactRunner,
        replayProviderFactory
      }
    });
    expect(captured!.beforeAdvance).toBeTypeOf("function");
    await captured!.beforeAdvance!();
    expect(guardCount).toBe(1);
    const { protocol_digest: _digest, ...expectedProtocol } =
      study.condition.paper_evaluation_protocol;
    expect(captured!.campaign.paperEvaluationProtocol).toEqual(expectedProtocol);
    expect("protocol_digest" in
      captured!.campaign.paperEvaluationProtocol!).toBe(false);

    expect(captured!.campaign.agentFactory("fixture")).toBe(adapter);
    expect(factoryCount).toBe(2);
    expect(() => captured!.campaign.agentFactory("codex"))
      .toThrowError(expect.objectContaining({
        code: "research_control_study_server_runtime_agent_mismatch"
      }));
  });

  it("honors an explicit workspace root without mutating the study", async () => {
    const study = persistedStudy();
    const original = structuredClone(study);
    let workspaceRoot: string | undefined;

    await openResearchControlStudyServerRuntime({
      study,
      store: new LocalStore("/tmp/ouroboros-study-explicit-store"),
      workspaceRoot: "/var/tmp/ouroboros-study-workspaces",
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      createStudyRuntime(input) {
        workspaceRoot = input.campaign.workspaceRoot;
        return {} as ResearchControlStudyRuntime;
      }
    });

    expect(workspaceRoot).toBe("/var/tmp/ouroboros-study-workspaces");
    expect(study).toEqual(original);
  });

  it.each([
    ["provider", { ...persistedAgent(), provider: "codex" }],
    ["model", { ...persistedAgent(), model: "drifted-model" }],
    ["permission", {
      ...persistedAgent(),
      permission_policy: "artifact_workspace_only"
    }]
  ] as const)("rejects configured agent %s drift before runtime creation", async (
    _kind,
    configuredAgent
  ) => {
    let createCount = 0;

    await expect(openResearchControlStudyServerRuntime({
      study: persistedStudy(),
      store: new LocalStore("/tmp/ouroboros-study-drift-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(configuredAgent as ManagedResearchAgent),
      createArmSessions: async () => ({}) as never,
      createStudyRuntime() {
        createCount += 1;
        return {} as ResearchControlStudyRuntime;
      }
    })).rejects.toMatchObject({
      code: "research_control_study_server_runtime_agent_mismatch"
    });
    expect(createCount).toBe(0);
  });

  it("rejects persisted identity digest drift before runtime creation", async () => {
    const study = persistedStudy();
    study.condition.research_agent.identity_digest = `sha256:${"f".repeat(64)}`;
    resealStudy(study);
    let createCount = 0;

    await expect(openResearchControlStudyServerRuntime({
      study,
      store: new LocalStore("/tmp/ouroboros-study-digest-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      createStudyRuntime() {
        createCount += 1;
        return {} as ResearchControlStudyRuntime;
      }
    })).rejects.toMatchObject({
      code: "research_control_study_server_runtime_agent_mismatch"
    });
    expect(createCount).toBe(0);
  });

  it("revalidates every adapter returned by the frozen agent factory", async () => {
    let factoryCount = 0;
    let captured:
      Parameters<typeof createResearchControlStudyRuntime>[0] | undefined;
    await openResearchControlStudyServerRuntime({
      study: persistedStudy(),
      store: new LocalStore("/tmp/ouroboros-study-revalidate-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => {
        factoryCount += 1;
        return agentAdapter(factoryCount === 1
          ? persistedAgent()
          : { ...persistedAgent(), model: "drifted-model" });
      },
      createArmSessions: async () => ({}) as never,
      createStudyRuntime(input) {
        captured = input;
        return {} as ResearchControlStudyRuntime;
      }
    });

    expect(() => captured!.campaign.agentFactory("fixture"))
      .toThrowError(expect.objectContaining({
        code: "research_control_study_server_runtime_agent_mismatch"
      }));
  });

  it("composes the one-shot process supervisor behind the scheduler", () => {
    const scheduler = createResearchControlStudyServerScheduler({
      store: new LocalStore("/tmp/ouroboros-study-scheduler-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never
    });

    expect(scheduler).toBeInstanceOf(ResearchControlStudyScheduler);
    expect(scheduler.status()).toEqual({
      status: "idle",
      cycleCount: 0,
      completedStudyCount: 0
    });
  });

  it("passes automatic commitment into the server scheduler cycle", async () => {
    let commitmentCount = 0;
    const scheduler = createResearchControlStudyServerScheduler({
      store: new LocalStore("/tmp/ouroboros-study-commitment-scheduler-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      commitmentCoordinator: {
        async ensureCommittedStudy() {
          commitmentCount += 1;
          return {
            status: "deferred",
            reason: "no_trading_promotion"
          } as const;
        }
      },
      schedulerSleep: () => new Promise(() => undefined)
    });

    scheduler.start();
    while (commitmentCount === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await scheduler.stop();

    expect(commitmentCount).toBe(1);
    expect(scheduler.status()).toMatchObject({
      status: "stopped",
      lastCommitment: {
        status: "deferred",
        reason: "no_trading_promotion"
      }
    });
  });

  it("passes automatic policy decisions into the server scheduler cycle", async () => {
    let decisionCount = 0;
    const scheduler = createResearchControlStudyServerScheduler({
      store: new LocalStore("/tmp/ouroboros-policy-decision-scheduler-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      schedulerSleep: () => new Promise(() => undefined)
    });

    scheduler.start();
    while (decisionCount === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await scheduler.stop();

    expect(decisionCount).toBe(1);
    expect(scheduler.status()).toMatchObject({
      status: "stopped",
      lastPolicyDecision: {
        status: "up_to_date",
        terminalOutcomeCount: 0
      }
    });
  });

  it("passes automatic generalization policy decisions into the scheduler cycle", async () => {
    let decisionCount = 0;
    let signalDecision!: () => void;
    const decisionObserved = new Promise<void>((resolve) => {
      signalDecision = resolve;
    });
    const scheduler = createResearchControlStudyServerScheduler({
      store: new LocalStore(
        "/tmp/ouroboros-generalization-policy-decision-scheduler-store"
      ),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          signalDecision();
          return {
            status: "up_to_date" as const,
            generalizationOutcomeCount: 0
          };
        }
      },
      schedulerSleep: () => new Promise(() => undefined)
    });

    scheduler.start();
    await decisionObserved;
    await scheduler.stop();

    expect(decisionCount).toBe(1);
    expect(scheduler.status()).toMatchObject({
      status: "stopped",
      lastGeneralizationPolicyDecision: {
        status: "up_to_date",
        generalizationOutcomeCount: 0
      }
    });
  });

  it("passes automatic generalization outcomes into the scheduler cycle", async () => {
    let outcomeCount = 0;
    const scheduler = createResearchControlStudyServerScheduler({
      store: new LocalStore("/tmp/ouroboros-generalization-scheduler-store"),
      marketData: {} as GatewayMarketDataPort,
      agentFactory: () => agentAdapter(persistedAgent()),
      createArmSessions: async () => ({}) as never,
      generalizationOutcomeCoordinator: {
        async ensureNextOutcome() {
          outcomeCount += 1;
          return {
            status: "up_to_date" as const,
            protocolCount: 0,
            outcomeCount: 0
          };
        }
      },
      schedulerSleep: () => new Promise(() => undefined)
    });

    scheduler.start();
    while (outcomeCount === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await scheduler.stop();

    expect(outcomeCount).toBe(1);
    expect(scheduler.status()).toMatchObject({
      status: "stopped",
      lastGeneralizationOutcome: {
        status: "up_to_date",
        protocolCount: 0,
        outcomeCount: 0
      }
    });
  });
});

function persistedStudy(): ResearchControlStudyRecord {
  const study = researchControlStudyFixture({ suffix: "server-runtime" });
  const agent = persistedAgent();
  const compact = {
    provider: agent.provider,
    model: agent.model!,
    permission_policy: agent.permission_policy
  };
  study.condition.research_agent = {
    ...compact,
    identity_digest: exactDigest(
      paperTradingComparisonPersistedRecordDigestInput(compact)
    )
  };
  resealStudy(study);
  return study;
}

function persistedAgent(): ManagedResearchAgent {
  return {
    id: "fixture-research-agent",
    provider: "fixture",
    model: "process-fixture",
    permission_policy: "fixture_only"
  };
}

function agentAdapter(agent: ManagedResearchAgent): TradingResearchAgentAdapter {
  return {
    agent: structuredClone(agent),
    async improveArtifact() {
      return { status: "no_change", summary: "not used by reconstruction" };
    }
  };
}

function resealStudy(study: ResearchControlStudyRecord): void {
  study.condition.condition_digest = exactDigest(
    researchControlStudyConditionDigestInput(study.condition)
  );
  study.study_digest = exactDigest(researchControlStudyDigestInput(study));
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
