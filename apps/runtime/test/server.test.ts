import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
import type {
  GatewayRuntimeBinding,
  PaperTradingApiProviderOptions
} from "@ouroboros/application/trading/gateway/runtime-binding";
import type { ReplayTradingApiProviderSession } from "@ouroboros/application/trading/research/types";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import { toReplayTradingCandidateInput } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import { decideCandidateArenaResearchAllocation } from
  "@ouroboros/application/candidate/research-allocation";
import type { ResearchControlStudyExecutionLeasePort } from
  "@ouroboros/application/ports/research-control-study-execution-lease";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  decideResearchControlStudyExecutionLease,
  OUROBOROS_COMMAND_KINDS,
  paperTradingComparisonPersistedRecordDigestInput,
  researchGeneralizationPolicyDecisionDigestInput,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickRecord,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import {
  buildServer,
  createResearchControlStudyServerCommitmentCoordinator,
  createResearchControlStudyServerLeaseSessionFactory,
  createResearchGeneralizationPolicyDecisionServerCoordinator,
  paperTradingApiProviderNetworkOptions
} from "../src/server";
import type {
  ResearchControlStudySchedulerLifecycle,
  ResearchControlStudySchedulerStatus
} from "../src/candidate/arena/research-control-study-scheduler";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";
import { researchControlStudyFixture } from "./helpers/research-control-study";

let tmpDir: string;

const RESEARCH_CONTROL_STUDY_TRADING_REVIEW_FIXTURE = path.resolve(
  process.cwd(),
  "apps/runtime/test/fixtures/research-control-study/trading-review-store"
);

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function buildRuntimeTestServer(options: Parameters<typeof buildServer>[0]) {
  return buildServer({
    paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
    runResearchControlStudiesOnStart: false,
    ...options
  });
}

class RecordingStudyScheduler
implements ResearchControlStudySchedulerLifecycle {
  startCount = 0;
  stopCount = 0;

  constructor(private readonly events: string[]) {}

  start(): "started" | "already_running" {
    this.startCount += 1;
    this.events.push("scheduler-start");
    return "started";
  }

  async stop(): Promise<void> {
    this.stopCount += 1;
    this.events.push("scheduler-stop");
  }

  async drain(): Promise<void> {}

  status(): ResearchControlStudySchedulerStatus {
    return {
      status: "idle",
      cycleCount: 0,
      completedStudyCount: 0
    };
  }
}

describe("runtime canonical operator API", () => {
  it("publishes authoritative Arena operations and an exact detail route", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      recoverPaperTradingSessionsOnStart: false
    });

    try {
      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      expect(operator.json()).toMatchObject({
        operator: {
          arena_operations: {
            projection_kind: "arena_operations",
            capacity: {
              max_concurrent_sessions: 2,
              active_session_count: 0,
              queued_session_count: 0
            },
            systems: [],
            live_disabled: true,
            authority_status: "not_live"
          }
        }
      });

      const detail = await server.inject({
        method: "GET",
        url: "/api/arena/trading-systems/missing-candidate"
      });
      expect(detail.statusCode).toBe(404);
      expect(detail.json()).toEqual({
        error: "arena_trading_system_not_found",
        candidate_id: "missing-candidate"
      });
    } finally {
      await server.close();
    }
  });

  it("fences concurrent supervisors for one store and releases ownership on close", async () => {
    const first = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      recoverPaperTradingSessionsOnStart: false
    });

    await expect(buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      recoverPaperTradingSessionsOnStart: false
    })).rejects.toMatchObject({ code: "runtime_process_ownership_held" });

    await first.close();
    const replacement = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      recoverPaperTradingSessionsOnStart: false
    });
    await replacement.close();
  });

  it("binds the paper runtime provider to a sandbox-reachable interface when sandbox host is configured", () => {
    expect(paperTradingApiProviderNetworkOptions({
      sandboxHost: "host.docker.internal"
    })).toEqual({
      listen_host: "0.0.0.0",
      sandbox_host: "host.docker.internal"
    });
    expect(paperTradingApiProviderNetworkOptions({ sandboxHost: "  " })).toEqual({});
    expect(paperTradingApiProviderNetworkOptions({})).toEqual({});
  });

  it("resolves repo-relative paper artifacts from the runtime workspace cwd", async () => {
    const repoRoot = process.cwd();
    let server: Awaited<ReturnType<typeof buildServer>> | undefined;
    process.chdir(path.join(repoRoot, "apps/runtime"));
    try {
      server = await buildRuntimeTestServer({
        store: new LocalStore(tmpDir),
        marketDataPort: fakeGatewayMarketDataPort()
      });

      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });

      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        command: {
          command_kind: "trading_run.start",
          status: "succeeded"
        }
      });
    } finally {
      await server?.close();
      process.chdir(repoRoot);
    }
  });

  it("starts and observes the study scheduler by default, then stops it first", async () => {
    const lifecycleEvents: string[] = [];
    const scheduler = new RecordingStudyScheduler(lifecycleEvents);
    let policyDecisionCount = 0;
    let observed: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyScheduler: scheduler,
      researchAllocationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          policyDecisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      onResearchControlStudySchedulerCreated(value) {
        observed = value;
      },
      onPaperTradingSessionServiceCreated(service) {
        const stopAllSessions = service.stopAllSessions.bind(service);
        service.stopAllSessions = async () => {
          lifecycleEvents.push("paper-stop");
          await stopAllSessions();
        };
      }
    });

    expect(scheduler.startCount).toBe(1);
    expect(policyDecisionCount).toBe(0);
    expect(observed).toBe(scheduler);
    await server.close();

    expect(scheduler.stopCount).toBe(1);
    expect(lifecycleEvents).toEqual([
      "scheduler-start",
      "scheduler-stop",
      "paper-stop"
    ]);
  });

  it("supports an explicitly disabled study scheduler start", async () => {
    const scheduler = new RecordingStudyScheduler([]);
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      researchControlStudyScheduler: scheduler,
      runResearchControlStudiesOnStart: false
    });

    expect(scheduler.startCount).toBe(0);
    await server.close();
    expect(scheduler.stopCount).toBe(1);
  });

  it("runs injected automatic commitment through the default scheduler", async () => {
    let commitmentCount = 0;
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyCommitmentCoordinator: {
        async ensureCommittedStudy() {
          commitmentCount += 1;
          return {
            status: "deferred",
            reason: "no_trading_promotion"
          } as const;
        }
      },
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      commitmentCount === 1 && scheduler?.status().status === "waiting"
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastCommitment: {
        status: "deferred",
        reason: "no_trading_promotion"
      }
    });
    await server.close();
  });

  it("runs injected automatic policy decisions through the default scheduler", async () => {
    let decisionCount = 0;
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchAllocationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      decisionCount === 1 && scheduler?.status().status === "waiting"
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastPolicyDecision: {
        status: "up_to_date",
        terminalOutcomeCount: 0
      }
    });
    await server.close();
  });

  it("runs injected broad policy decisions through the default scheduler", async () => {
    let decisionCount = 0;
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchGeneralizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return {
            status: "up_to_date" as const,
            generalizationOutcomeCount: 0
          };
        }
      },
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      decisionCount === 1 && scheduler?.status().status === "waiting"
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastGeneralizationPolicyDecision: {
        status: "up_to_date",
        generalizationOutcomeCount: 0
      }
    });
    await server.close();
  });

  it("runs injected generalization outcomes through the default scheduler", async () => {
    let outcomeCount = 0;
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchGeneralizationOutcomeCoordinator: {
        async ensureNextOutcome() {
          outcomeCount += 1;
          return {
            status: "up_to_date" as const,
            protocolCount: 0,
            outcomeCount: 0
          };
        }
      },
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      outcomeCount === 1 && scheduler?.status().status === "waiting"
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastGeneralizationOutcome: {
        status: "up_to_date",
        protocolCount: 0,
        outcomeCount: 0
      }
    });
    await server.close();
  });

  it("creates the default automatic generalization outcome coordinator", async () => {
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      scheduler?.status().status === "waiting" &&
      scheduler.status().lastGeneralizationOutcome !== undefined
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastGeneralizationOutcome: {
        status: "up_to_date",
        protocolCount: 0,
        outcomeCount: 0
      }
    });
    await server.close();
  });

  it("creates the default automatic policy decision coordinator", async () => {
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      scheduler?.status().status === "waiting" &&
      scheduler.status().lastPolicyDecision !== undefined
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastPolicyDecision: {
        status: "up_to_date",
        terminalOutcomeCount: 0
      }
    });
    await server.close();
  });

  it("creates the default automatic broad policy decision coordinator", async () => {
    const store = new LocalStore(tmpDir);
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const coordinator = createResearchGeneralizationPolicyDecisionServerCoordinator({
      store
    });
    await expect(coordinator.ensureNextDecision()).resolves.toEqual({
      status: "up_to_date",
      generalizationOutcomeCount: 0
    });
    const server = await buildServer({
      store,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() =>
      scheduler?.status().status === "waiting" &&
      scheduler.status().lastGeneralizationPolicyDecision !== undefined
    );
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      lastGeneralizationPolicyDecision: {
        status: "up_to_date",
        generalizationOutcomeCount: 0
      }
    });
    await server.close();
  });

  it("does not commit or decide when scheduler startup is disabled", async () => {
    let commitmentCount = 0;
    let decisionCount = 0;
    let generalizationDecisionCount = 0;
    let outcomeCount = 0;
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      researchControlStudyCommitmentCoordinator: {
        async ensureCommittedStudy() {
          commitmentCount += 1;
          return {
            status: "deferred",
            reason: "no_trading_promotion"
          } as const;
        }
      },
      researchGeneralizationOutcomeCoordinator: {
        async ensureNextOutcome() {
          outcomeCount += 1;
          return {
            status: "up_to_date" as const,
            protocolCount: 0,
            outcomeCount: 0
          };
        }
      },
      researchGeneralizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          generalizationDecisionCount += 1;
          return {
            status: "up_to_date" as const,
            generalizationOutcomeCount: 0
          };
        }
      },
      researchAllocationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      }
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(commitmentCount).toBe(0);
    expect(outcomeCount).toBe(0);
    expect(generalizationDecisionCount).toBe(0);
    expect(decisionCount).toBe(0);
    await server.close();
  });

  it("creates the default promotion-bound coordinator from the runtime workspace cwd", async () => {
    const fixtureRoot = path.join(tmpDir, "commitment-fixture");
    await cp(RESEARCH_CONTROL_STUDY_TRADING_REVIEW_FIXTURE, fixtureRoot, {
      recursive: true
    });
    const store = new LocalStore(fixtureRoot);
    await store.initialize();
    const agent = new FixtureTradingResearchAgentAdapter();
    const marketData = fakeGatewayMarketDataPort();
    let now = Date.parse("2026-07-13T00:00:00.000Z");
    const repoRoot = process.cwd();
    process.chdir(path.join(repoRoot, "apps/runtime"));
    try {
      const coordinator = createResearchControlStudyServerCommitmentCoordinator({
        store,
        researchAgentIdentity: () => agent.agent,
        marketData,
        now: () => {
          const value = new Date(now).toISOString();
          now += 1_000;
          return value;
        }
      });

      await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
        status: "protocol_committed"
      });
      const committed = await coordinator.ensureCommittedStudy();
      const studies = await store.listResearchControlStudies();
      expect(studies).toHaveLength(1);
      expect(committed).toEqual({
        status: "committed",
        studyId: studies[0]!.research_control_study_id
      });
      await expect(coordinator.ensureCommittedStudy()).resolves.toEqual({
        status: "deferred",
        reason: "pending_study_exists",
        pendingStudyId: studies[0]!.research_control_study_id
      });
    } finally {
      process.chdir(repoRoot);
    }
  });

  it("creates one default lease owner across server factories sharing a root", async () => {
    const study = researchControlStudyFixture({ suffix: "server-default-lease" });
    const firstFactory = createResearchControlStudyServerLeaseSessionFactory({
      store: new LocalStore(tmpDir)
    });
    const secondFactory = createResearchControlStudyServerLeaseSessionFactory({
      store: new LocalStore(tmpDir)
    });

    const claims = await Promise.all([
      firstFactory.acquire(study),
      secondFactory.acquire(study)
    ]);
    const acquired = claims.find((claim) => claim.status === "acquired");
    const held = claims.find((claim) => claim.status === "held");

    expect(acquired?.status).toBe("acquired");
    expect(held).toMatchObject({ status: "held", reason: "lease_unexpired" });
    if (acquired?.status !== "acquired" || held?.status !== "held") {
      throw new Error("expected one acquired and one held server lease claim");
    }
    const acquiredLease = acquired.session.status().lease;
    expect(acquiredLease.owner).toMatchObject({
      host_id: os.hostname(),
      process_id: process.pid
    });
    expect(acquiredLease.owner.server_instance_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(held.lease.owner.server_instance_id).toBe(
      acquiredLease.owner.server_instance_id
    );
    expect(acquiredLease.lease_duration_ms).toBe(30_000);
    expect(acquiredLease.fencing_token).toBe(1);
    expect(Date.parse(acquiredLease.expires_at) -
      Date.parse(acquiredLease.acquired_at)).toBe(30_000);

    await acquired.session.stopAndRelease();
  });

  it("wires injected study lease ownership and policy into the default scheduler", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const study = researchControlStudyFixture({ suffix: "server-injected-lease" });
    await store.recordResearchControlStudy(study);
    const owner = {
      server_instance_id: "server-injected-owner",
      host_id: "server-injected-host",
      process_id: 4242,
      process_start_marker: "server-injected-process-start"
    } as const;
    let acquireInput:
      Parameters<ResearchControlStudyExecutionLeasePort["acquire"]>[0] |
      undefined;
    const leasePort: ResearchControlStudyExecutionLeasePort = {
      async acquire(input) {
        acquireInput = structuredClone(input);
        return {
          status: "held",
          reason: "owner_alive",
          lease: decideResearchControlStudyExecutionLease({
            study: input.study,
            owner: input.owner,
            leaseToken: "server-injected-held-token",
            fencingToken: 1,
            leaseDurationMs: input.leaseDurationMs,
            acquiredAt: "2026-07-13T00:00:00.000Z"
          })
        };
      },
      async renew() {
        throw new Error("unexpected renew");
      },
      async assertOwned() {
        throw new Error("unexpected ownership assertion");
      },
      async withFencedWrite() {
        throw new Error("unexpected fenced write");
      },
      async release() {
        throw new Error("unexpected release");
      }
    };
    let scheduler: ResearchControlStudySchedulerLifecycle | undefined;
    const server = await buildServer({
      store,
      paperTradingApiProviderFactory: networklessPaperTradingApiProvider,
      researchControlStudyExecutionLeasePort: leasePort,
      researchControlStudyExecutionLeaseOwner: owner,
      researchControlStudyExecutionLeaseDurationMs: 120,
      researchControlStudyExecutionLeaseRenewalIntervalMs: 40,
      researchControlStudyPollIntervalMs: 60_000,
      onResearchControlStudySchedulerCreated(value) {
        scheduler = value;
      }
    });

    await waitFor(() => acquireInput !== undefined);
    expect(acquireInput).toEqual({
      study,
      owner,
      leaseDurationMs: 120
    });
    expect(scheduler?.status()).toMatchObject({
      status: "waiting",
      completedStudyCount: 0
    });

    await server.close();
  });

  it("serves health, operator state, resource reads, and no removed public routes", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    try {
      const health = await server.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);
      const healthBody = health.json();
      expect(healthBody).toMatchObject({
        status: "ok",
        service: "ouroboros-runtime",
        operator_loop_contract_version: "paper-loop-continuation-v2",
        runtime_supervisor: {
          status: "running",
          lanes: [
            { lane: "selected_paper", desired: false, status: "running" },
            { lane: "candidate_arena", desired: false, status: "running" },
            {
              lane: "research_control_study_scheduler",
              desired: false,
              status: "running"
            }
          ],
          runtime_coordination_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "runtime_coordination_only"
        },
        trading_gateway_environment: {
          authority_status: "not_live"
        }
      });

      const gateway = await server.inject({ method: "GET", url: "/api/gateway/environment" });
      expect(gateway.statusCode).toBe(200);
      expect(gateway.json()).toMatchObject({
        trading_gateway_environment: {
          runtime_environment: "paper",
          live_exchange_authority: false,
          order_submission_authority: false,
          authority_status: "not_live"
        }
      });

      const executionModeContracts = await server.inject({
        method: "GET",
        url: "/api/trading-system/execution-mode-contracts"
      });
      expect(executionModeContracts.statusCode).toBe(200);
      expect(executionModeContracts.json()).toMatchObject({
        trading_system_execution_mode_contracts: [
          expect.objectContaining({
            mode: "backtest",
            authority: expect.objectContaining({
              status: "not_live"
            })
          }),
          expect.objectContaining({
            mode: "paper",
            authority: expect.objectContaining({
              status: "paper_only"
            })
          }),
          expect.objectContaining({
            mode: "live",
            authority: expect.objectContaining({
              status: "live_disabled"
            })
          })
        ]
      });

      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      const operatorBody = operator.json();
      expect(operatorBody).toMatchObject({
        operator: {
          command_descriptors: expect.arrayContaining(
            OUROBOROS_COMMAND_KINDS.map((commandKind) => expect.objectContaining({
              command_kind: commandKind
            }))
          ),
          candidate_arena: {
            runner_status: "stopped",
            research_generalization: {
              status: "not_started",
              protocol_count: 0,
              outcome_count: 0,
              active_protocol: null,
              latest_outcome: null,
              authority_status: "not_promotion_authority"
            },
            authority_status: "not_live"
          },
          selected_candidate_id: null,
          live_disabled: true,
          authority_status: "not_live"
        }
      });
      expect(operatorBody.operator.runtime_supervisor).toEqual(
        healthBody.runtime_supervisor
      );

      const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().candidates.map((candidate: { candidate_id: string }) => candidate.candidate_id))
        .toContain(FIXTURE_CANDIDATE_ID);

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        ledger: {
          has_activity: false
        }
      });

      const evaluations = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluations`
      });
      expect(evaluations.statusCode).toBe(200);
      expect(evaluations.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluations: expect.any(Array)
      });

      for (const url of [
        "/api/candidate-arena",
        `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
        "/api/candidate-generation-runs",
        "/api/candidate-materialization-attempts",
        "/api/trading-gateway/environment",
        "/api/trading-research/runtime"
      ]) {
        const response = await server.inject({ method: "GET", url });
        expect(response.statusCode).toBe(404);
      }
    } finally {
      await server.close();
    }
  });

  it("requires the operator API token for protected runtime API routes when configured", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      operatorApiToken: "test-operator-token"
    });

    try {
      const health = await server.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);

      const missingToken = await server.inject({ method: "GET", url: "/api/operator" });
      expect(missingToken.statusCode).toBe(401);
      expect(missingToken.json()).toMatchObject({
        error: "operator_api_unauthorized"
      });

      const validToken = await server.inject({
        method: "GET",
        url: "/api/operator",
        headers: {
          "x-ouroboros-operator-token": "test-operator-token"
        }
      });
      expect(validToken.statusCode).toBe(200);
      expect(validToken.json()).toMatchObject({
        operator: {
          authority_status: "not_live"
        }
      });
    } finally {
      await server.close();
    }
  });

  it("allows the packaged Tauri operator app origin to read the operator API", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir)
    });

    try {
      for (const origin of ["http://tauri.localhost", "tauri://localhost"]) {
        const response = await server.inject({
          method: "GET",
          url: "/api/operator",
          headers: { origin }
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers["access-control-allow-origin"]).toBe(origin);
      }
    } finally {
      await server.close();
    }
  });

  it("lets the default replay runner execute instead of rejecting sbx when the sandbox adapter gate is unset", async () => {
    const previousEnable = process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    const previousAdapter = process.env.OUROBOROS_SANDBOX_ADAPTER;
    const previousSbxBin = process.env.OUROBOROS_SBX_BIN;
    delete process.env.OUROBOROS_ENABLE_SBX_SANDBOX;
    delete process.env.OUROBOROS_SANDBOX_ADAPTER;
    process.env.OUROBOROS_SBX_BIN = "/bin/false";

    const promotedCandidateRoot = path.join(tmpDir, "promoted-candidates");
    const replayRunRoot = path.join(tmpDir, "replay-runs");
    await writePromotedCandidateBundle(promotedCandidateRoot, "candidate-default-replay");
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot
    });

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.replay.run",
          payload: {
            candidate_id: "candidate-default-replay"
          }
        }
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({
        result: {
          run: {
            candidate_id: "candidate-default-replay",
            runner_kind: "docker_sandboxes_sbx",
            run_status: "failed"
          }
        }
      });
    } finally {
      await server.close();
      restoreEnv("OUROBOROS_ENABLE_SBX_SANDBOX", previousEnable);
      restoreEnv("OUROBOROS_SANDBOX_ADAPTER", previousAdapter);
      restoreEnv("OUROBOROS_SBX_BIN", previousSbxBin);
    }
  });

  it("keeps default local runtime API launches reachable when no operator API token is configured", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousToken = process.env.OUROBOROS_OPERATOR_API_TOKEN;
    process.env.NODE_ENV = "production";
    delete process.env.OUROBOROS_OPERATOR_API_TOKEN;

    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir)
    });

    try {
      const response = await server.inject({ method: "GET", url: "/api/operator" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        operator: {
          authority_status: "not_live"
        }
      });
    } finally {
      await server.close();
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousToken === undefined) {
        delete process.env.OUROBOROS_OPERATOR_API_TOKEN;
      } else {
        process.env.OUROBOROS_OPERATOR_API_TOKEN = previousToken;
      }
    }
  });

  it("projects active ResearchGeneralizationProtocol progress without raw evidence", async () => {
    const fixtureRoot = path.join(tmpDir, "generalization-readback-fixture");
    await cp(RESEARCH_CONTROL_STUDY_TRADING_REVIEW_FIXTURE, fixtureRoot, {
      recursive: true
    });
    const store = new LocalStore(fixtureRoot);
    await store.initialize();
    const agent = new FixtureTradingResearchAgentAdapter();
    const coordinator = createResearchControlStudyServerCommitmentCoordinator({
      store,
      researchAgentIdentity: () => agent.agent,
      marketData: fakeGatewayMarketDataPort(),
      repoRoot: process.cwd(),
      now: () => "2026-07-13T00:00:00.000Z"
    });
    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    const server = await buildRuntimeTestServer({ store });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/operator"
      });
      expect(response.statusCode).toBe(200);
      const projection = response.json().operator.candidate_arena
        .research_generalization;
      expect(projection).toMatchObject({
        status: "collecting",
        protocol_count: 1,
        outcome_count: 0,
        active_protocol: {
          status: "collecting",
          planned_study_count: 6,
          assigned_study_count: 0,
          terminal_study_count: 0,
          condition_blocks: [
            {
              condition_block: "long",
              planned_study_count: 2,
              assigned_study_count: 0,
              terminal_study_count: 0
            },
            {
              condition_block: "short",
              planned_study_count: 2,
              assigned_study_count: 0,
              terminal_study_count: 0
            },
            {
              condition_block: "flat",
              planned_study_count: 2,
              assigned_study_count: 0,
              terminal_study_count: 0
            }
          ],
          next_action: "collect_precommitted_studies",
          authority_status: "research_only"
        },
        latest_outcome: null,
        latest_policy_decision: null,
        authority_status: "not_promotion_authority"
      });
      expect(JSON.stringify(projection)).not.toContain("public_kline_window");
      expect(JSON.stringify(projection)).not.toContain("protocol_digest");
      expect(JSON.stringify(projection)).not.toContain("study_ref");
    } finally {
      await server.close();
    }
  });

  it("projects exact effective policy application without duplicate arena reads", async () => {
    const fixture = researchGeneralizationApplicationFixture();
    const store = new LocalStore(tmpDir);
    vi.spyOn(store, "listResearchGeneralizationProtocols")
      .mockResolvedValue([fixture.protocol]);
    vi.spyOn(store, "listResearchControlStudies").mockResolvedValue([]);
    vi.spyOn(store, "listResearchControlStudyOutcomes").mockResolvedValue([]);
    vi.spyOn(store, "listResearchGeneralizationOutcomes")
      .mockResolvedValue([fixture.outcome]);
    vi.spyOn(store, "listResearchGeneralizationPolicyDecisions")
      .mockResolvedValue([fixture.decision]);
    const allocationReads = vi.spyOn(
      store,
      "listCandidateArenaResearchAllocations"
    ).mockResolvedValue([fixture.allocation]);
    const tickReads = vi.spyOn(store, "listCandidateArenaTicks")
      .mockResolvedValue([fixture.tick]);
    const server = await buildRuntimeTestServer({ store });
    allocationReads.mockClear();
    tickReads.mockClear();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/operator"
      });
      expect(response.statusCode).toBe(200);
      const projection = response.json().operator.candidate_arena
        .research_generalization;
      expect(projection).toMatchObject({
        latest_policy_decision: {
          research_generalization_policy_decision_id:
            fixture.decision.research_generalization_policy_decision_id,
          decision_status: "approved"
        },
        effective_policy_decision: {
          research_generalization_policy_decision_id:
            fixture.decision.research_generalization_policy_decision_id,
          effective_default_mode: "adaptive_default",
          application: {
            application_status: "completed_tick",
            allocation_count: 1,
            completed_tick_count: 1,
            latest_allocation: {
              candidate_arena_research_allocation_id:
                fixture.allocation.candidate_arena_research_allocation_id,
              tick_id: fixture.tick.tick_id,
              allocated_at: fixture.allocation.allocated_at,
              completed_at: fixture.tick.completed_at
            }
          },
          research_policy_selection_authority: true,
          evaluation_authority: false,
          promotion_authority: false,
          order_submission_authority: false,
          live_exchange_authority: false,
          authority_status: "research_policy_only"
        },
        authority_status: "not_promotion_authority"
      });
      expect(JSON.stringify(projection)).not.toContain("allocation_digest");
      expect(allocationReads).toHaveBeenCalledTimes(1);
      expect(tickReads).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });

  it("runs user mutations through /api/commands and reflects them in /api/operator", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      marketDataPort: fakeGatewayMarketDataPort()
    });

    try {
      const status = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: { command_kind: "arena.status" }
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        command: {
          command_kind: "arena.status",
          status: "succeeded"
        },
        operator: {
          candidate_arena: {
            research_generalization: {
              status: "not_started",
              protocol_count: 0,
              outcome_count: 0,
              authority_status: "not_promotion_authority"
            },
            authority_status: "not_live"
          }
        }
      });

      const selected = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(selected.statusCode).toBe(200);
      expect(selected.json()).toMatchObject({
        command: {
          command_kind: "candidate.select",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_candidate: {
            candidate_id: FIXTURE_CANDIDATE_ID
          },
          selected_paper_evidence: {
            status: "not_run",
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: {
            status: "not_started",
            observation_count: 0,
            authority_status: "not_live"
          }
        }
      });

      const evidence = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(evidence.statusCode, evidence.body).toBe(200);
      expect(evidence.json()).toMatchObject({
        command: {
          command_kind: "trading_run.start",
          status: "succeeded"
        },
        operator: {
          selected_candidate_id: FIXTURE_CANDIDATE_ID,
          selected_paper_trading_evaluation: {
            status: "running",
            observation_count: 1,
            authority_status: "not_live"
          }
        }
      });

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode).toBe(200);
      expect(candidate.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID
      });
    } finally {
      await server.close();
    }
  });

  it("serves candidates and operator state when the candidate projection index is missing", async () => {
    const server = await buildRuntimeTestServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    try {
      await rm(path.join(tmpDir, "read-models/candidates/index.json"), { force: true });

      const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
      expect(candidates.statusCode).toBe(200);
      expect(candidates.json().candidates.map((candidate: { candidate_id: string }) => candidate.candidate_id))
        .toContain(FIXTURE_CANDIDATE_ID);

      const operator = await server.inject({ method: "GET", url: "/api/operator" });
      expect(operator.statusCode).toBe(200);
      expect(operator.json()).toMatchObject({
        operator: {
          candidate_arena: {
            runner_status: "stopped"
          },
          live_disabled: true,
          authority_status: "not_live"
        }
      });
    } finally {
      await server.close();
    }
  });

  it("restarts the sandbox with a fresh provider URL when resuming an inactive paper run", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            paper_order_request: "rejected"
          }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(firstSandbox.starts).toHaveLength(1);
      expect(firstSandbox.starts[0]?.paper_order_request).toBe("rejected");
      expect(firstSandbox.starts[0]?.env?.TRADING_API_BASE_URL).toBeUndefined();
    } finally {
      await firstServer.close();
    }

    const resumedSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const resumedServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: resumedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const resumed = await resumedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(resumed.statusCode, resumed.body).toBe(200);
      expect(resumed.json()).toMatchObject({
        command: {
          command_kind: "trading_run.start",
          status: "succeeded"
        }
      });
      expect(resumedSandbox.starts).toHaveLength(1);
      expect(resumedSandbox.starts[0]?.paper_order_request).toBe("rejected");
      expect(resumedSandbox.starts[0]?.env?.TRADING_API_BASE_URL).toBeUndefined();
      expect(resumedSandbox.starts[0]?.instance_id).toBe(firstSandbox.starts[0]?.instance_id);
    } finally {
      await resumedServer.close();
    }
  });

  it("does not restart a stopped paper session from observe after runtime close", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });
    let tradingRunId = "";

    try {
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      expect(firstSandbox.starts).toHaveLength(1);
    } finally {
      await firstServer.close();
    }

    const observedSandbox = recordingDuplicateLogSandboxAdapter(orderLine);
    const observedServer = await buildRuntimeTestServer({
      store,
      recoverPaperTradingSessionsOnStart: false,
      sandboxAdapters: {
        deterministic_test: observedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const observed = await observedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        command: {
          command_kind: "trading_run.observe",
          status: "succeeded"
        },
        operator: {
          selected_paper_trading_evaluation: {
            runner_active: false
          }
        }
      });
      expect(observedSandbox.starts).toHaveLength(0);
    } finally {
      await observedServer.close();
    }
  });

  it("keeps resumed sandbox event ids stable when TradingSystem events derive from instance id", async () => {
    const store = new LocalStore(tmpDir);
    const orderLineForInstance = (input: TestSandboxStartInput) => paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001",
      eventId: `${input.instance_id}:order-request:0001`,
      instanceId: input.instance_id,
      orderType: "market"
    });
    const firstSandbox = recordingDuplicateLogSandboxAdapter(orderLineForInstance);
    const firstServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: firstSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const started = await firstServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(firstSandbox.starts).toHaveLength(1);
    } finally {
      await firstServer.close();
    }

    const resumedSandbox = recordingDuplicateLogSandboxAdapter(orderLineForInstance);
    const resumedServer = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: resumedSandbox.adapter
      },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const resumed = await resumedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(resumed.statusCode, resumed.body).toBe(200);
      expect(resumedSandbox.starts).toHaveLength(1);
      expect(resumedSandbox.starts[0]?.instance_id).toBe(firstSandbox.starts[0]?.instance_id);
      expect(resumed.json()).toMatchObject({
        result: { status: "already_running" },
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 1
          }
        }
      });

      const observed = await resumedServer.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: {
            trading_run_id: resumed.json().operator.selected_paper_trading_evaluation.trading_run_id
          }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long"
              }
            }
          }
        }
      });

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );
    } finally {
      await resumedServer.close();
    }
  });

  it("consumes TradingSystem order events once and records fake account state", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            agg_trades: [{
              trade_id: "agg-60000-001",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:00:03.500Z"
            }]
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            agg_trades: []
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });

      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 1,
            latest_market_snapshot: {
              price: 65_000
            },
            latest_decision: {
              decision_kind: "order_request",
              order_request: {
                side: "buy",
                limit_price: "60000"
              },
              authority_status: "trace_only"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long",
                average_entry_price: "60000"
              },
              open_order_count: 0
            },
            latest_fill: {
              fill_status: "filled",
              fill_price: "60000",
              fill_quantity: "0.001"
            }
          }
        }
      });

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_market_snapshot: {
              price: 66_000
            },
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request",
              authority_status: "trace_only"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long",
                average_entry_price: "60000",
                mark_price: "66000"
              },
              open_order_count: 0
            }
          }
        }
      });

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: {
          decision_kind: string;
          order_request?: {
            limit_price?: string;
          };
        };
        ledger_ref?: { id: string };
        processed_trading_system_event_ids?: string[];
        paper_account_snapshot?: {
          position: {
            quantity: string;
            side: string;
          };
        };
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[0]?.decision?.order_request?.limit_price).toBe("60000");
      expect(observations[0]?.paper_account_snapshot?.position).toMatchObject({
        quantity: "0.001",
        side: "long"
      });
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.decision).toBeUndefined();
      expect(observations[1]?.ledger_ref).toBeUndefined();
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );
    } finally {
      await server.close();
    }
  });

  it("does not replay the same TradingSystem log line when sandbox log refs change", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            agg_trades: [{
              trade_id: "agg-first-fill",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:00:03.500Z"
            }]
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            agg_trades: [{
              trade_id: "agg-would-fill-replayed-order",
              price: "60000",
              quantity: "0.001",
              trade_time: "2026-05-16T00:01:03.500Z"
            }]
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 2,
            latest_decision: {
              decision_kind: "order_request",
              reason: "trading_system_order_request"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0.001",
                side: "long"
              }
            }
          }
        }
      });
      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]?.status).toBe("no_order");
      expect(observations[1]?.processed_trading_system_event_ids).toEqual(
        observations[0]?.processed_trading_system_event_ids
      );

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.chains).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("records residual bookTicker-only market fills as paper observations", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      orderType: "market",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        snapshots: [
          {
            price: 65_000,
            moving_average_fast: 65_025,
            moving_average_slow: 64_975,
            observed_at: "2026-05-16T00:00:03.000Z"
          },
          {
            price: 66_000,
            moving_average_fast: 66_025,
            moving_average_slow: 65_975,
            observed_at: "2026-05-16T00:01:03.000Z"
          }
        ],
        executionSnapshots: [
          {
            observed_at: "2026-05-16T00:00:03.000Z",
            book_ticker: {
              bid_price: "64999",
              bid_quantity: "1.000",
              ask_price: "65001",
              ask_quantity: "0.0004",
              event_time: "2026-05-16T00:00:03.500Z"
            }
          },
          {
            observed_at: "2026-05-16T00:01:03.000Z",
            book_ticker: {
              bid_price: "65999",
              bid_quantity: "1.000",
              ask_price: "66001",
              ask_quantity: "0.0006",
              event_time: "2026-05-16T00:01:03.500Z"
            }
          }
        ]
      }),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        latest_fill?: unknown;
        paper_account_snapshot?: {
          position: { quantity: string };
        };
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]?.status, JSON.stringify(observations, null, 2)).toBe("recorded");
      expect(observations[1]?.paper_account_snapshot?.position.quantity).toBe("0.001");
    } finally {
      await server.close();
    }
  });

  it("applies cancel-only TradingSystem events without requiring public fill evidence", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const cancelLine = paperCancelOrderLine("2026-05-16T00:01:03.000Z");
    const marketDataPort = fakeGatewayMarketDataPort({
      snapshots: [
        {
          price: 65_000,
          moving_average_fast: 65_025,
          moving_average_slow: 64_975,
          observed_at: "2026-05-16T00:00:03.000Z"
        },
        {
          price: 66_000,
          moving_average_fast: 66_025,
          moving_average_slow: 65_975,
          observed_at: "2026-05-16T00:01:03.000Z"
        }
      ],
      executionSnapshots: [{
        observed_at: "2026-05-16T00:00:03.000Z",
        agg_trades: []
      }]
    });
    const originalExecutionSnapshot = marketDataPort.readPublicExecutionSnapshot.bind(marketDataPort);
    let executionSnapshotReadCount = 0;
    marketDataPort.readPublicExecutionSnapshot = async (request) => {
      executionSnapshotReadCount += 1;
      if (executionSnapshotReadCount > 1) {
        throw new Error("cancel-only checkpoint should not read public execution stream");
      }
      return originalExecutionSnapshot(request);
    };
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningOrderThenCancelLogSandboxAdapter(orderLine, cancelLine)
      },
      marketDataPort,
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json().operator.selected_paper_trading_evaluation.open_orders).toHaveLength(1);

      const tradingRunId = started.json().operator.selected_paper_trading_evaluation.trading_run_id;
      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: { trading_run_id: tradingRunId }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(executionSnapshotReadCount).toBe(1);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            status: "running",
            observation_count: 2,
            latest_decision: {
              decision_kind: "cancel_order"
            },
            paper_account_snapshot: {
              position: {
                quantity: "0",
                side: "flat"
              },
              open_order_count: 0
            },
            open_orders: []
          }
        }
      });

      const evaluationId = observed.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: { decision_kind: string };
        open_orders?: unknown[];
        public_execution_snapshot?: unknown;
      }>;
      expect(observations).toHaveLength(2);
      expect(observations[1]).toMatchObject({
        status: "recorded",
        decision: { decision_kind: "cancel_order" },
        open_orders: []
      });
      expect(observations[1]?.public_execution_snapshot).toBeUndefined();
    } finally {
      await server.close();
    }
  });

  it("fails observation when public execution stream evidence is unavailable and leaves events retryable", async () => {
    const store = new LocalStore(tmpDir);
    const orderLine = paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    });
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(orderLine)
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "ledger_chain_complete",
            ledger_chain_complete: true
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            ledger_chain_complete: true,
            latest_decision: {
              decision_kind: "order_request",
              authority_status: "trace_only"
            },
            latest_failure_reason: "fake public execution stream unavailable"
          }
        }
      });
      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        status: string;
        decision?: { decision_kind: string };
        failure_reason?: string;
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations).toHaveLength(1);
      expect(observations[0]).toMatchObject({
        status: "failed",
        decision: { decision_kind: "order_request" },
        failure_reason: "fake public execution stream unavailable",
        processed_trading_system_event_ids: []
      });
    } finally {
      await server.close();
    }
  });

  it("records risk-rejected TradingSystem orders without fake account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(paperOrderRequestLine({
          at: "2026-05-16T00:00:03.000Z",
          quantity: "0"
        }))
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            paper_order_request: "rejected"
          }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            observation_count: 1,
            latest_gateway_outcome: "rejected",
            latest_execution_status: "blocked",
            paper_account_snapshot: {
              equity_usdt: "10000",
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });
      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        processed_trading_system_event_ids?: string[];
        paper_account_snapshot?: {
          equity_usdt: string;
          position: {
            side: string;
            quantity: string;
          };
        };
      }>;
      expect(observations[0]?.processed_trading_system_event_ids).toHaveLength(1);
      expect(observations[0]?.paper_account_snapshot).toMatchObject({
        equity_usdt: "10000",
        position: {
          side: "flat",
          quantity: "0"
        }
      });
    } finally {
      await server.close();
    }
  });

  it("rejects private or live TradingSystem paper events without Ledger or fake account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter(paperLiveAuthorityAttemptLine())
      },
      marketDataPort: fakeGatewayMarketDataPort({
        failPublicExecutionSnapshot: true
      })
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false,
            authority_status: "not_live"
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            ledger_chain_complete: false,
            latest_decision: {
              decision_kind: "error",
              reason: "forbidden_private_or_live_authority",
              authority_status: "trace_only"
            },
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              equity_usdt: "10000",
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });
      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.has_activity).toBe(false);

      const observed = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: {
            trading_run_id: started.json().operator.selected_paper_trading_evaluation.trading_run_id
          }
        }
      });
      expect(observed.statusCode, observed.body).toBe(200);
      expect(observed.json()).toMatchObject({
        operator: {
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority"
          }
        }
      });

      const restarted = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(restarted.statusCode, restarted.body).toBe(409);
      expect(restarted.json()).toMatchObject({
        error: "paper_trading_evaluation_failed_requires_repair",
        status: "failed_requires_repair",
        paper_trading_evaluation: {
          status: "failed",
          observation_count: 1,
          latest_failure_reason: "forbidden_private_or_live_authority"
        },
        operator: {
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority"
          }
        }
      });
    } finally {
      await server.close();
    }
  });

  it("aborts a mixed paper event batch after a protocol error before Ledger or account mutation", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildRuntimeTestServer({
      store,
      marketDataPort: fakeGatewayMarketDataPort(),
      sandboxAdapters: {
        deterministic_test: runningDuplicateLogSandboxAdapter([
          paperLiveAuthorityAttemptLine(),
          paperOrderRequestLine({
            at: "2026-05-16T00:00:04.000Z",
            quantity: "0.001"
          })
        ])
      }
    });

    try {
      await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.select",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });

      const candidate = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidate.statusCode, candidate.body).toBe(200);
      expect(candidate.json().ledger.has_activity).toBe(false);

      const evaluationId = started.json().operator.selected_paper_trading_evaluation.evaluation_id;
      const observations = await store.listPaperTradingObservations(evaluationId) as Array<{
        processed_trading_system_event_ids?: string[];
      }>;
      expect(observations[0]?.processed_trading_system_event_ids).toEqual([
        "paper-runtime-live-authority-attempt"
      ]);

      const observedAgain = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.observe",
          payload: {
            trading_run_id: started.json().operator.selected_paper_trading_evaluation.trading_run_id
          }
        }
      });
      expect(observedAgain.statusCode, observedAgain.body).toBe(200);
      expect(observedAgain.json()).toMatchObject({
        operator: {
          selected_paper_evidence: {
            status: "not_run",
            ledger_chain_complete: false
          },
          selected_paper_trading_evaluation: {
            status: "failed",
            observation_count: 1,
            latest_failure_reason: "forbidden_private_or_live_authority",
            paper_account_snapshot: {
              position: {
                side: "flat",
                quantity: "0"
              },
              open_order_count: 0
            }
          }
        }
      });

      const candidateAfterRetry = await server.inject({
        method: "GET",
        url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
      });
      expect(candidateAfterRetry.statusCode, candidateAfterRetry.body).toBe(200);
      expect(candidateAfterRetry.json().ledger.has_activity).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("runs candidate evaluation through the command endpoint and exposes evaluation resources", async () => {
    const server = await buildRuntimeTestServer({ store: new LocalStore(tmpDir) });

    try {
      const created = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "candidate.evaluation.run",
          payload: {
            candidate_id: FIXTURE_CANDIDATE_ID,
            idempotency_key: "runtime-test-canonical-evaluation"
          }
        }
      });
      expect(created.statusCode, created.body).toBe(200);
      expect(created.json()).toMatchObject({
        command: {
          command_kind: "candidate.evaluation.run",
          status: "succeeded"
        }
      });

      const evaluationId = created.json().result.evaluation.evaluation_run.evaluation_run_record_id;
      const evaluation = await server.inject({
        method: "GET",
        url: `/api/evaluations/${evaluationId}`
      });
      expect(evaluation.statusCode).toBe(200);
      expect(evaluation.json()).toMatchObject({
        candidate_id: FIXTURE_CANDIDATE_ID,
        evaluation_run: {
          evaluation_run_record_id: evaluationId
        }
      });
    } finally {
      await server.close();
    }
  });

  it("does not mutate an already active paper session when a repeated start changes the fixture", async () => {
    const store = new LocalStore(tmpDir);
    const sandbox = recordingDuplicateLogSandboxAdapter(paperOrderRequestLine({
      at: "2026-05-16T00:00:03.000Z",
      quantity: "0.001"
    }));
    const server = await buildRuntimeTestServer({
      store,
      sandboxAdapters: { deterministic_test: sandbox.adapter },
      marketDataPort: fakeGatewayMarketDataPort(),
      paperTradingEvaluationIntervalMs: 60_000
    });

    try {
      const started = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID, paper_order_request: "valid" }
        }
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(sandbox.starts).toHaveLength(1);
      const originalSandboxId = sandbox.starts[0]?.instance_id;

      const repeated = await server.inject({
        method: "POST",
        url: "/api/commands",
        payload: {
          command_kind: "trading_run.start",
          payload: { candidate_id: FIXTURE_CANDIDATE_ID, paper_order_request: "rejected" }
        }
      });

      expect(repeated.statusCode, repeated.body).toBe(200);
      expect(repeated.json()).toMatchObject({ result: { status: "already_running" } });
      expect(sandbox.starts).toHaveLength(1);
      expect(sandbox.starts[0]?.instance_id).toBe(originalSandboxId);
      expect(sandbox.starts[0]?.paper_order_request).toBe("valid");
    } finally {
      await server.close();
    }
  });
});

function paperOrderRequestLine(input: {
  at: string;
  quantity: string;
  eventId?: string;
  instanceId?: string;
  orderType?: "limit" | "market";
}): string {
  const orderType = input.orderType ?? "limit";
  return JSON.stringify({
    at: input.at,
    authority_status: "trace_only",
    event: "order_request",
    event_id: input.eventId ?? `paper-runtime-${orderType}-order-${input.at.replace(/[^0-9]/g, "")}`,
    instance_id: input.instanceId ?? "paper-runtime-fixture",
    intent_kind: "place_order",
    ...(orderType === "limit" ? { limit_price: "60000" } : {}),
    order_type: orderType,
    quantity: input.quantity,
    side: "buy",
    symbol: "BTCUSDT"
  });
}

function paperCancelOrderLine(at: string): string {
  return JSON.stringify({
    at,
    authority_status: "trace_only",
    event: "cancel_order",
    event_id: "paper-runtime-cancel-open-order",
    instance_id: "paper-runtime-fixture",
    reason: "operator_stop_loss"
  });
}

function paperLiveAuthorityAttemptLine(): string {
  return JSON.stringify({
    at: "2026-05-16T00:00:03.000Z",
    authority_status: "trace_only",
    event: "order_request",
    event_id: "paper-runtime-live-authority-attempt",
    instance_id: "paper-runtime-fixture",
    intent_kind: "place_order",
    limit_price: "60000",
    order_type: "limit",
    quantity: "0.001",
    runtime_environment: "live",
    side: "buy",
    signed_request: true,
    symbol: "BTCUSDT"
  });
}

type TestSandboxStartInput = Parameters<SandboxAdapter["startArtifactInstance"]>[0];
type TestSandboxLinesInput = string | string[] | ((input: TestSandboxStartInput) => string | string[]);

function recordingDuplicateLogSandboxAdapter(orderLines: TestSandboxLinesInput): {
  adapter: SandboxAdapter;
  starts: TestSandboxStartInput[];
} {
  const starts: TestSandboxStartInput[] = [];
  const adapter = runningDuplicateLogSandboxAdapter(orderLines);
  return {
    starts,
    adapter: {
      ...adapter,
      async startArtifactInstance(input) {
        starts.push(input);
        return adapter.startArtifactInstance(input);
      }
    }
  };
}

function runningDuplicateLogSandboxAdapter(orderLines: TestSandboxLinesInput): SandboxAdapter {
  let refreshCount = 0;
  const linesBySandboxId = new Map<string, string[]>();
  return {
    kind: "deterministic_test",
    async startArtifactInstance(input) {
      const lines = resolveTestSandboxLines(orderLines, input);
      linesBySandboxId.set(input.instance_id, lines);
      const sandboxRef = { record_kind: "sandbox", id: input.instance_id };
      const placementRef = { record_kind: "sandbox_placement", id: input.sandbox_placement_id };
      const capturedAt = input.created_at;
      return {
        placement: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder",
          authority_status: "not_launched"
        },
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [{ record_kind: "sandbox_log", id: `sandbox-log-${input.instance_id}-start` }],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          lines,
          captured_at: capturedAt,
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus() {
      return {};
    },
    async getArtifactInstanceLogs(instance) {
      refreshCount += 1;
      const sandboxId = instance.sandbox_id;
      const lines = linesBySandboxId.get(sandboxId) ?? [];
      return {
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${sandboxId}-refresh-${refreshCount}`,
          sandbox_ref: { record_kind: "sandbox", id: sandboxId },
          lines,
          captured_at: `2026-05-16T00:0${refreshCount}:03.000Z`,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance) {
      return {
        lifecycle_status: "stopped",
        stopped_at: instance.stopped_at ?? "2026-05-16T00:02:03.000Z"
      };
    }
  };
}

function resolveTestSandboxLines(
  orderLines: TestSandboxLinesInput,
  input: TestSandboxStartInput
): string[] {
  const value = typeof orderLines === "function" ? orderLines(input) : orderLines;
  return Array.isArray(value) ? value : [value];
}

function runningOrderThenCancelLogSandboxAdapter(orderLine: string, cancelLine: string): SandboxAdapter {
  let refreshCount = 0;
  return {
    kind: "deterministic_test",
    async startArtifactInstance(input) {
      const sandboxRef = { record_kind: "sandbox", id: input.instance_id };
      const placementRef = { record_kind: "sandbox_placement", id: input.sandbox_placement_id };
      const capturedAt = input.created_at;
      return {
        placement: {
          record_kind: "sandbox_placement",
          version: 1,
          sandbox_placement_id: input.sandbox_placement_id,
          placement_kind: "fixture_local_placeholder",
          authority_status: "not_launched"
        },
        instance: {
          record_kind: "sandbox",
          version: 1,
          sandbox_id: input.instance_id,
          adapter_kind: "deterministic_test",
          system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
          runtime_ref: input.runtime_ref,
          sandbox_placement_ref: placementRef,
          lifecycle_status: "running",
          sandbox_name: input.sandbox_name,
          created_at: input.created_at,
          started_at: input.created_at,
          log_refs: [{ record_kind: "sandbox_log", id: `sandbox-log-${input.instance_id}-start` }],
          heartbeat_refs: [],
          command_evidence_refs: [],
          authority_status: "not_live"
        },
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${input.instance_id}-start`,
          sandbox_ref: sandboxRef,
          lines: [orderLine],
          captured_at: capturedAt,
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: []
      };
    },
    async getArtifactInstanceStatus() {
      return {};
    },
    async getArtifactInstanceLogs(instance) {
      refreshCount += 1;
      const sandboxId = instance.sandbox_id;
      return {
        logs: [{
          record_kind: "sandbox_log",
          version: 1,
          sandbox_log_id: `sandbox-log-${sandboxId}-refresh-${refreshCount}`,
          sandbox_ref: { record_kind: "sandbox", id: sandboxId },
          lines: refreshCount === 1 ? [orderLine] : [orderLine, cancelLine],
          captured_at: `2026-05-16T00:0${refreshCount}:03.000Z`,
          authority_status: "trace_only"
        }]
      };
    },
    async stopArtifactInstance(instance) {
      return {
        lifecycle_status: "stopped",
        stopped_at: instance.stopped_at ?? "2026-05-16T00:02:03.000Z"
      };
    }
  };
}

async function writePromotedCandidateBundle(root: string, candidateId: string): Promise<void> {
  const candidateDir = path.join(root, candidateId);
  const artifactDir = path.join(candidateDir, "artifact");
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
    id: "default-replay-runner-test",
    name: "Default replay runner test",
    entrypoint: ["python3", "run.py"],
    editable_paths: ["run.py"],
    api_contract: "trading_api_provider_v1"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(artifactDir, "run.py"), "print('not reached by /bin/false sbx')\n", "utf8");
  const artifactDigest = await artifactDigestFor(artifactDir);

  await writeFile(path.join(candidateDir, "candidate.json"), `${JSON.stringify({
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: candidateId,
    display_name: "Default Replay Runner Candidate",
    title: "Default replay runner candidate",
    status: "materialized",
    active_version_id: `${candidateId}-v1`,
    authority_status: "not_live",
    provenance_refs: []
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "candidate-version.json"), `${JSON.stringify({
    record_kind: "candidate_version",
    version: 1,
    candidate_id: candidateId,
    candidate_version_id: `${candidateId}-v1`,
    version_label: "v1",
    spec_ref: { record_kind: "candidate_spec", id: `${candidateId}-spec` },
    program_ref: { record_kind: "program", id: `${candidateId}-program` },
    runtime_ref: { record_kind: "trading_run", id: `${candidateId}-runtime` },
    trace_placeholder_ref: { record_kind: "trace_placeholder", id: `${candidateId}-trace` },
    capability_package_refs: [{ record_kind: "capability_package", id: `${candidateId}-capabilities` }]
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "system-code.json"), `${JSON.stringify({
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-${candidateId}`,
    artifact_kind: "python_file",
    artifact_path: path.join(artifactDir, "run.py"),
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", "run.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "promotion.json"), `${JSON.stringify({
    record_kind: "trading_research_candidate_promotion",
    version: 1,
    promotion_id: `promotion-${candidateId}`,
    artifact_digest: artifactDigest,
    artifact_manifest: {
      id: "default-replay-runner-test",
      name: "Default replay runner test",
      entrypoint: ["python3", "run.py"],
      api_contract: "trading_api_provider_v1"
    },
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    },
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
}

async function artifactDigestFor(artifactDir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of await listFiles(artifactDir)) {
    const relativePath = path.relative(artifactDir, file).split(path.sep).join("/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const pathname = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(pathname));
    } else if (entry.isFile()) {
      files.push(pathname);
    }
  }
  return files.sort();
}

function researchGeneralizationApplicationFixture(): {
  protocol: ResearchGeneralizationProtocolRecord;
  outcome: ResearchGeneralizationOutcomeRecord;
  decision: ResearchGeneralizationPolicyDecisionRecord;
  allocation: CandidateArenaResearchAllocationRecord;
  tick: CandidateArenaTickRecord;
} {
  const protocolId = "research-generalization-protocol-http-application";
  const protocolDigest = serverTestDigest("1");
  const policyDigest = serverTestExactDigest(
    paperTradingComparisonPersistedRecordDigestInput(
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
    )
  );
  const blocks = ["long", "short", "flat"] as const;
  const protocol = {
    record_kind: "research_generalization_protocol",
    version: 1,
    research_generalization_protocol_id: protocolId,
    committed_at: "2026-07-01T00:00:00.000Z",
    protocol_digest: protocolDigest,
    target_allocation_policy_digest: policyDigest,
    condition_blocks: blocks.map((conditionBlock) => ({
      condition_block: conditionBlock,
      required_study_count: 2
    })),
    study_slots: blocks.flatMap((conditionBlock, blockIndex) =>
      [1, 2].map((conditionIndex) => {
        const slotIndex = blockIndex * 2 + conditionIndex;
        return {
          slot_index: slotIndex,
          condition_block: conditionBlock,
          condition_block_study_index: conditionIndex,
          study_ref: {
            record_kind: "research_control_study",
            id: `${protocolId}-study-${slotIndex}`
          },
          study_idempotency_key: `${protocolId}-study-key-${slotIndex}`
        };
      })
    ),
    timing_policy: {
      collection_deadline_at: "2026-09-29T00:00:00.000Z"
    }
  } as unknown as ResearchGeneralizationProtocolRecord;
  const outcome: ResearchGeneralizationOutcomeRecord = {
    record_kind: "research_generalization_outcome",
    version: 1,
    research_generalization_outcome_id:
      "research-generalization-outcome-http-application",
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: protocolId
    },
    protocol_digest: protocolDigest,
    target_allocation_policy_digest: policyDigest,
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: 6,
    tied_study_count: 0,
    missing_study_count: 0,
    ineligible_study_count: 0,
    distinct_baseline_count: 4,
    equal_weight_mean_rate_difference: 0.5,
    exact_sign_test_p_value: 0.03125,
    harmful_condition_blocks: [],
    inference_status: "generalization_supported",
    policy_decision_eligibility:
      "eligible_for_separate_generalization_policy_decision",
    next_action: "review_broad_research_allocation_policy",
    adjudicated_at: "2026-07-10T00:00:00.000Z",
    outcome_digest: serverTestDigest("2"),
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  } as unknown as ResearchGeneralizationOutcomeRecord;
  const decision: ResearchGeneralizationPolicyDecisionRecord = {
    record_kind: "research_generalization_policy_decision",
    version: 1,
    research_generalization_policy_decision_id:
      "research-generalization-policy-decision-http-application",
    protocol_ref: { ...outcome.protocol_ref },
    protocol_digest: protocolDigest,
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: outcome.research_generalization_outcome_id
    },
    generalization_outcome_digest: outcome.outcome_digest,
    target_allocation_policy_digest: policyDigest,
    decision_policy: {
      policy_version: "generalization_supported_adaptive_v1",
      target_allocation_mode: "adaptive_default",
      required_inference_status: "generalization_supported",
      required_causal_scope:
        "pre_effect_market_condition_blocked_cross_baseline_study_effects",
      required_policy_decision_eligibility:
        "eligible_for_separate_generalization_policy_decision",
      application_scope: "future_uncontrolled_candidate_arena_ticks"
    },
    decision_status: "approved",
    decision_reason: "supported_cross_condition_adaptive_effect",
    effective_default_mode: "adaptive_default",
    decided_at: "2026-07-10T00:00:01.000Z",
    policy_decision_digest: serverTestDigest("0"),
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
  decision.policy_decision_digest = serverTestExactDigest(
    researchGeneralizationPolicyDecisionDigestInput(decision)
  );
  const allocation = decideCandidateArenaResearchAllocation({
    tickId: "http-generalized-policy-tick",
    allocatedAt: "2026-07-10T00:00:02.000Z",
    allocationMode: "adaptive_default",
    allocationPolicyBasis: {
      basis_kind: "research_generalization_policy_decision",
      policy_decision_ref: {
        record_kind: "research_generalization_policy_decision",
        id: decision.research_generalization_policy_decision_id
      },
      policy_decision_digest: decision.policy_decision_digest,
      generalization_outcome_ref: { ...decision.generalization_outcome_ref },
      generalization_outcome_digest: decision.generalization_outcome_digest
    },
    findingClusters: [],
    latestTicks: [],
    priorAllocations: [],
    completedTickIds: []
  });
  const tick: CandidateArenaTickRecord = {
    record_kind: "candidate_arena_tick",
    version: 1,
    candidate_arena_tick_id: "candidate-arena-tick-http-generalized-policy",
    tick_id: allocation.tick_id,
    started_at: "2026-07-10T00:00:03.000Z",
    completed_at: "2026-07-10T00:00:04.000Z",
    status: "completed",
    created_candidate_refs: [],
    direction_results: [],
    research_allocation_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    },
    research_allocation_digest: allocation.allocation_digest,
    authority_status: "not_live"
  };
  return { protocol, outcome, decision, allocation, tick };
}

function serverTestExactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function serverTestDigest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("wait_for_timeout");
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

async function networklessPaperTradingApiProvider(
  binding: GatewayRuntimeBinding,
  options: PaperTradingApiProviderOptions
): Promise<ReplayTradingApiProviderSession> {
  const market = await binding.marketData.readMarketSnapshot();
  const account = options.readAccountState
    ? await options.readAccountState()
    : binding.account.provider_kind === "fake_paper_account"
      ? binding.account.state
      : {
          equity: 10_000,
          max_position_notional: 350,
          max_risk_fraction: 0.03,
          target_risk_fraction: 0.02
        };
  return {
    base_url: "",
    sandbox_base_url: "",
    close: async () => undefined,
    requests: () => [],
    candidate_input: toReplayTradingCandidateInput({
      market,
      account
    })
  };
}
