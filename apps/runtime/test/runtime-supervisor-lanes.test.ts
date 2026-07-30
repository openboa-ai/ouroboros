import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CandidateArenaRunner,
  candidateArenaRunnerTickCountFromTicks,
  runCandidateArenaTick,
  type CandidateArenaResearchWorkObserver
} from "@ouroboros/application/candidate/arena";
import { CandidateArenaResearchAllocationService } from
  "@ouroboros/application/candidate/research-allocation";
import { researchWorkItemId } from
  "@ouroboros/application/candidate/research-work-item";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  CandidateArenaTickRecord,
  ResearchDirectionKind,
  ResearchPreflightCommitmentRecord,
  ResearchWorkerCheckpointRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { createRuntimeSupervisorLanes } from
  "../src/runtime-supervisor-lanes";
import type { ResearchControlStudySchedulerStatus } from
  "../src/candidate/arena/research-control-study-scheduler";

describe("runtime supervisor lanes", () => {
  it("recovers paper, Arena, and study scheduling from durable intent", async () => {
    let paperActive = false;
    let arenaRunning = false;
    let schedulerStatus: "failed" | "running" = "failed";
    const paperRecoveryObserver = vi.fn();
    const store = {
      async listPaperTradingEvaluations() {
        return [runningEvaluation()];
      },
      async getTradingRun() {
        return { paper_evidence_purpose: "research_feedback" };
      },
      async listOuroborosCommands() {
        return [arenaStartCommand()];
      },
      async getResearcherProviderSelection() {
        return { selected_provider: "fixture" };
      },
      async listResearchControlStudies() {
        return [];
      },
      async listResearchControlStudyOutcomes() {
        return [];
      }
    };
    const lanes = createRuntimeSupervisorLanes({
      store: store as never,
      paperTradingSessions: {
        active: () => paperActive,
        async stop() {
          return undefined;
        },
        async recoverRunningEvaluations() {
          paperActive = true;
          return [{
            tradingRunId: "trading-run-1",
            status: "recovered" as const,
            clock: "scheduled" as const
          }];
        },
        async finalizeRecoveryFailures() {},
        async stopAllSessions() {}
      },
      candidateArenaRunner: {
        health: () => ({
          status: arenaRunning ? "running" as const : "stopped" as const,
          tick_count: 0,
          completed_tick_count: 0,
          active_tick: false,
          active_research_work_items: [],
          consecutive_failure_count: 0,
          runtime_coordination_authority: true as const,
          evaluation_authority: false as const,
          promotion_authority: false as const,
          order_submission_authority: false as const,
          live_exchange_authority: false as const,
          authority_status: "runtime_coordination_only" as const
        }),
        async stopAndDrain() {
          arenaRunning = false;
          return "stopped" as const;
        }
      },
      operatorService: {
        async readResearcherProvider() {
          return {
            selected_provider: "fixture" as const,
            available_providers: ["codex" as const, "fixture" as const],
            authority_status: "research_only" as const
          };
        },
        async resumeAutonomousArenaLoop() {
          arenaRunning = true;
          return "resumed" as const;
        },
        async drainAutonomousPaperStarts() {}
      },
      researchControlStudyScheduler: {
        start() {
          schedulerStatus = "running";
          return "started" as const;
        },
        async stop() {
          schedulerStatus = "failed";
        },
        async drain() {},
        status: () => schedulerStatus === "failed"
          ? {
              status: "failed" as const,
              cycleCount: 1,
              completedStudyCount: 0,
              errorCode: "injected_failure",
              errorMessage: "injected failure"
            }
          : {
              status: "running" as const,
              cycleCount: 1,
              completedStudyCount: 0
            }
      },
      runResearchControlStudies: true,
      onPaperTradingRecovery: paperRecoveryObserver
    });

    expect(lanes.map((lane) => lane.lane)).toEqual([
      "selected_paper",
      "candidate_arena",
      "research_control_study_scheduler"
    ]);
    for (const lane of lanes) {
      expect(await lane.inspect()).toMatchObject({
        desired: true,
        satisfied: false
      });
      await lane.recover();
      expect(await lane.inspect()).toMatchObject({
        desired: true,
        satisfied: true
      });
    }
    expect(paperRecoveryObserver).toHaveBeenCalledWith([
      expect.objectContaining({
        tradingRunId: "trading-run-1",
        status: "recovered"
      })
    ]);
  });

  it("keeps paper recovery failures retryable until the supervisor blocks them", async () => {
    const failedOutcome = {
      tradingRunId: "trading-run-1",
      status: "failed" as const,
      error: "provider unavailable"
    };
    const finalizeRecoveryFailures = vi.fn(async () => undefined);
    const [paper] = createRuntimeSupervisorLanes({
      store: {
        async listPaperTradingEvaluations() {
          return [runningEvaluation()];
        },
        async getTradingRun() {
          return { paper_evidence_purpose: "research_feedback" };
        },
        async listOuroborosCommands() {
          return [];
        },
        async getResearcherProviderSelection() {
          return undefined;
        },
        async listResearchControlStudies() {
          return [];
        },
        async listResearchControlStudyOutcomes() {
          return [];
        }
      } as never,
      paperTradingSessions: {
        active: () => false,
        async stop() {
          return undefined;
        },
        async recoverRunningEvaluations() {
          return [failedOutcome];
        },
        finalizeRecoveryFailures,
        async stopAllSessions() {}
      },
      candidateArenaRunner: inactiveArenaRunner(),
      operatorService: inactiveOperatorService(),
      researchControlStudyScheduler: inactiveScheduler(),
      runResearchControlStudies: false
    });

    await expect(paper!.recover()).rejects.toMatchObject({
      code: "paper_trading_recovery_failed"
    });
    expect(finalizeRecoveryFailures).not.toHaveBeenCalled();

    await paper!.block("paper_trading_recovery_failed");
    expect(finalizeRecoveryFailures).toHaveBeenCalledWith([failedOutcome]);
  });

  it("recovers persisted paper before filling newly available Arena slots", async () => {
    let paperActive = false;
    let queued = true;
    const reconcile = vi.fn(async () => {
      queued = false;
      return arenaPaperSnapshot({ queued: false });
    });
    const [paper] = createRuntimeSupervisorLanes({
      store: {
        ...emptyStore(),
        async listPaperTradingEvaluations() {
          return [runningEvaluation()];
        },
        async getTradingRun() {
          return { paper_evidence_purpose: "research_feedback" };
        }
      } as never,
      paperTradingSessions: {
        active: () => paperActive,
        async stop() {
          return undefined;
        },
        async recoverRunningEvaluations() {
          paperActive = true;
          return [{
            tradingRunId: "trading-run-1",
            status: "recovered" as const,
            clock: "scheduled" as const
          }];
        },
        async finalizeRecoveryFailures() {},
        async stopAllSessions() {}
      },
      arenaPaperRuntime: {
        snapshot: async () => arenaPaperSnapshot({ queued }),
        reconcile,
        fencePendingStarts: vi.fn()
      },
      candidateArenaRunner: inactiveArenaRunner(),
      operatorService: inactiveOperatorService(),
      researchControlStudyScheduler: inactiveScheduler(),
      runResearchControlStudies: false
    });

    await expect(paper!.inspect()).resolves.toMatchObject({
      desired: true,
      satisfied: false,
      reasonCode: "paper_trading_session_inactive"
    });

    await paper!.recover();

    expect(reconcile).toHaveBeenCalledOnce();
    await expect(paper!.inspect()).resolves.toMatchObject({
      desired: true,
      satisfied: true
    });
  });

  it("defers persisted Arena recovery overflow before restoring capacity", async () => {
    const calls: string[] = [];
    const active = new Set<string>();
    let overflowDeferred = false;
    const paperTradingSessions = {
      active: (tradingRunId: string) => active.has(tradingRunId),
      async stop(
        tradingRunId: string,
        options: { reason?: string } = {}
      ) {
        calls.push(`defer:${tradingRunId}:${options.reason ?? "unknown"}`);
        overflowDeferred = true;
        return undefined;
      },
      async recoverRunningEvaluations() {
        calls.push("recover");
        active.add("trading-run-1");
        return [{
          tradingRunId: "trading-run-1",
          status: "recovered" as const,
          clock: "scheduled" as const
        }];
      },
      async finalizeRecoveryFailures() {},
      async stopAllSessions() {}
    };
    const reconcile = vi.fn(async () => {
      calls.push("reconcile");
      return arenaRecoveryCapacitySnapshot({ overflowDeferred, active: true });
    });
    const [paper] = createRuntimeSupervisorLanes({
      store: {
        ...emptyStore(),
        async listPaperTradingEvaluations() {
          return [runningEvaluation("1"), runningEvaluation("2")];
        },
        async getTradingRun() {
          return { paper_evidence_purpose: "research_feedback" };
        }
      } as never,
      paperTradingSessions,
      arenaPaperRuntime: {
        snapshot: async () => arenaRecoveryCapacitySnapshot({
          overflowDeferred,
          active: active.has("trading-run-1")
        }),
        reconcile,
        fencePendingStarts: vi.fn()
      },
      candidateArenaRunner: inactiveArenaRunner(),
      operatorService: inactiveOperatorService(),
      researchControlStudyScheduler: inactiveScheduler(),
      runResearchControlStudies: false
    });

    await paper!.recover();

    expect(calls).toEqual([
      "defer:trading-run-2:arena_capacity_deferred",
      "recover",
      "reconcile"
    ]);
  });

  it("accepts an Arena restart while the first replacement tick is still active", async () => {
    let arenaRunning = true;
    let activeTick = false;
    let consecutiveFailureCount = 1;
    const stopAndDrain = vi.fn(async () => {
      arenaRunning = false;
      return "stopped" as const;
    });
    const resumeAutonomousArenaLoop = vi.fn(async () => {
      arenaRunning = true;
      activeTick = true;
      return "resumed" as const;
    });
    const [, arena] = createRuntimeSupervisorLanes({
      store: durableArenaIntentStore(),
      paperTradingSessions: inactivePaperSessions(),
      candidateArenaRunner: {
        health: () => ({
          status: arenaRunning ? "running" as const : "stopped" as const,
          tick_count: 2,
          completed_tick_count: 1,
          active_tick: activeTick,
          ...(activeTick ? { active_tick_id: "tick-2" } : {}),
          active_research_work_items: [],
          consecutive_failure_count: consecutiveFailureCount,
          last_error_code: "provider_unavailable",
          runtime_coordination_authority: true as const,
          evaluation_authority: false as const,
          promotion_authority: false as const,
          order_submission_authority: false as const,
          live_exchange_authority: false as const,
          authority_status: "runtime_coordination_only" as const
        }),
        stopAndDrain
      },
      operatorService: {
        async readResearcherProvider() {
          return {
            selected_provider: "fixture" as const,
            available_providers: ["codex" as const, "fixture" as const],
            authority_status: "research_only" as const
          };
        },
        resumeAutonomousArenaLoop,
        async drainAutonomousPaperStarts() {}
      },
      researchControlStudyScheduler: inactiveScheduler(),
      runResearchControlStudies: false
    });

    expect(await arena!.inspect()).toMatchObject({
      desired: true,
      satisfied: false
    });
    await arena!.recover();
    expect(await arena!.inspect()).toMatchObject({
      desired: true,
      satisfied: true
    });
    expect(stopAndDrain).toHaveBeenCalledOnce();
    expect(resumeAutonomousArenaLoop).toHaveBeenCalledOnce();

    consecutiveFailureCount = 0;
    activeTick = false;
    expect(await arena!.inspect()).toMatchObject({
      desired: true,
      satisfied: true
    });
  });

  it("changes the Arena basis when selected provider readiness changes", async () => {
    let profile: {
      agent_profile_id: "codex";
      status: "login_required" | "authenticated";
      updated_at: string;
    } = {
      agent_profile_id: "codex",
      status: "login_required",
      updated_at: "2026-07-16T00:00:00.000Z"
    };
    const [, arena] = createRuntimeSupervisorLanes({
      store: {
        ...emptyStore(),
        async listOuroborosCommands() {
          return [arenaStartCommand()];
        },
        async getAgentProfile() {
          return profile;
        }
      } as never,
      paperTradingSessions: inactivePaperSessions(),
      candidateArenaRunner: inactiveArenaRunner(),
      operatorService: {
        async readResearcherProvider() {
          return {
            selected_provider: "codex" as const,
            available_providers: ["codex" as const, "fixture" as const],
            authority_status: "research_only" as const
          };
        },
        async resumeAutonomousArenaLoop() {
          return profile.status === "authenticated"
            ? "resumed" as const
            : "blocked" as const;
        },
        async drainAutonomousPaperStarts() {}
      },
      researchControlStudyScheduler: inactiveScheduler(),
      runResearchControlStudies: false
    });

    const blocked = await arena!.inspect();
    profile = {
      ...profile,
      status: "authenticated",
      updated_at: "2026-07-16T00:01:00.000Z"
    };
    const authenticated = await arena!.inspect();

    expect(authenticated.basisDigest).not.toBe(blocked.basisDigest);
  });

  it("accepts a scheduler restart while commitment coordination is still pending", async () => {
    let schedulerStatus: ResearchControlStudySchedulerStatus = {
      status: "failed" as const,
      cycleCount: 1,
      completedStudyCount: 0,
      errorCode: "provider_unavailable",
      errorMessage: "provider unavailable"
    };
    const start = vi.fn(() => "started" as const);
    const [, , scheduler] = createRuntimeSupervisorLanes({
      store: emptyStore() as never,
      paperTradingSessions: inactivePaperSessions(),
      candidateArenaRunner: inactiveArenaRunner(),
      operatorService: inactiveOperatorService(),
      researchControlStudyScheduler: {
        start,
        async stop() {},
        async drain() {},
        status: () => schedulerStatus
      },
      runResearchControlStudies: true
    });

    expect(await scheduler!.inspect()).toMatchObject({
      desired: true,
      satisfied: false
    });
    await scheduler!.recover();
    expect(await scheduler!.inspect()).toMatchObject({
      desired: true,
      satisfied: true
    });
    expect(start).toHaveBeenCalledOnce();

    schedulerStatus = {
      status: "waiting" as const,
      cycleCount: 1,
      completedStudyCount: 0,
      nextPollAt: "2026-07-16T00:01:00.000Z"
    };
    expect(await scheduler!.inspect()).toMatchObject({
      desired: true,
      satisfied: true
    });
  });
});

const researchRuntimeRoots: string[] = [];

afterEach(async () => {
  await Promise.all(researchRuntimeRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("CandidateArenaRunner Research work observation", () => {
  it("recovers a crashed numeric tick and starts new effects under new identities", async () => {
    const root = await researchRuntimeRoot();
    const crashedStore = new LocalStore(root);
    await crashedStore.initialize();
    const crashControls = researchPersistenceControls();
    const crashedRunner = new CandidateArenaRunner({
      store: gatedResearchStore(crashedStore, crashControls),
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: {
        id: "managed-agent-restart-regression",
        provider: "codex",
        model: "restart-regression",
        permission_policy: "artifact_workspace_only"
      },
      now: monotonicClock("2026-07-23T00:00:00.000Z"),
      agentFactory: () => {
        throw new Error("simulated_provider_process_loss");
      }
    });

    const crashedTick = crashedRunner.tick();
    await waitFor(
      crashControls.commitmentReached.trend_following.promise,
      "crashed_commitment"
    );
    crashControls.commitmentAction.trend_following.resolve("persist");
    await waitFor(
      crashControls.checkpointReached.trend_following.promise,
      "crashed_checkpoint"
    );
    crashControls.checkpointAction.trend_following.resolve("fail");
    await waitFor(crashControls.tickReached.promise, "crashed_tick");
    crashControls.tickAction.resolve("fail");
    await expect(crashedTick).rejects.toThrow("injected_tick_persistence_failure");

    const orphanedAllocations = await crashedStore
      .listCandidateArenaResearchAllocations();
    const orphanedCommitments = await crashedStore
      .listResearchPreflightCommitments();
    expect(orphanedAllocations).toEqual([
      expect.objectContaining({ tick_id: "tick-1" })
    ]);
    expect(orphanedCommitments).toHaveLength(1);
    await expect(crashedStore.listResearchWorkerCheckpoints()).resolves
      .toEqual([]);
    await expect(crashedStore.listCandidateArenaTicks()).resolves.toEqual([]);

    const reopenedStore = new LocalStore(root);
    await reopenedStore.initialize();
    const recoveryEvents: string[] = [];
    const observedStore = observeResearchCheckpointPersistence(
      reopenedStore,
      recoveryEvents
    );
    let newProviderEffectCount = 0;
    const restartedRunner = new CandidateArenaRunner({
      store: observedStore,
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      directions: ["trend_following"],
      researchAgent: "codex",
      researchAgentDescriptor: {
        id: "managed-agent-restart-regression",
        provider: "codex",
        model: "restart-regression",
        permission_policy: "artifact_workspace_only"
      },
      now: monotonicClock("2026-07-23T00:02:00.000Z"),
      agentFactory: () => {
        newProviderEffectCount += 1;
        recoveryEvents.push("provider_effect");
        throw new Error("new_provider_effect_failed");
      }
    });
    const persistedTicks = await reopenedStore.listCandidateArenaTicks();
    const persistedAllocations = await reopenedStore
      .listCandidateArenaResearchAllocations();
    const persistedCommitments = await reopenedStore
      .listResearchPreflightCommitments();
    const effectedTickIds = new Set(persistedCommitments.map((commitment) =>
      commitment.candidate_arena_tick_id
    ));
    restartedRunner.restoreTickCount(
      candidateArenaRunnerTickCountFromTicks(
        persistedTicks,
        persistedAllocations,
        effectedTickIds
      ),
      [
        ...persistedTicks.map((tick) => tick.tick_id),
        ...persistedAllocations
          .filter((allocation) => !effectedTickIds.has(allocation.tick_id))
          .map((allocation) => allocation.tick_id)
      ]
    );

    await expect(restartedRunner.tick({
      trigger_kind: "recovery",
      goal: "Recover the interrupted Research session."
    })).resolves.toMatchObject({
      tick_id: "tick-1",
      created_candidate_count: 0
    });
    expect(newProviderEffectCount).toBe(0);
    expect(recoveryEvents).toEqual(["checkpoint:restart_recovery"]);
    const recoveredOldTick = (await reopenedStore.listCandidateArenaTicks())
      .find((tick) => tick.tick_id === "tick-1");
    expect(recoveredOldTick).toMatchObject({
      status: "failed",
      created_candidate_refs: [],
      research_allocation_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: persistedAllocations[0]!.candidate_arena_research_allocation_id
      },
      research_allocation_digest: persistedAllocations[0]!.allocation_digest,
      direction_results: [expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "candidate_arena_restart_recovery"
      })]
    });

    await expect(restartedRunner.tick({
      trigger_kind: "recovery",
      goal: "Continue with one new bounded Research session."
    })).resolves.toMatchObject({ tick_id: "tick-2" });

    const allocations = await reopenedStore
      .listCandidateArenaResearchAllocations();
    const commitments = await reopenedStore.listResearchPreflightCommitments();
    const checkpoints = await reopenedStore.listResearchWorkerCheckpoints();
    const oldAllocation = allocations.find((allocation) =>
      allocation.tick_id === "tick-1"
    )!;
    const newAllocation = allocations.find((allocation) =>
      allocation.tick_id === "tick-2"
    )!;
    const oldCommitment = commitments.find((commitment) =>
      commitment.research_allocation_ref.id ===
        oldAllocation.candidate_arena_research_allocation_id
    )!;
    const newCommitment = commitments.find((commitment) =>
      commitment.research_allocation_ref.id ===
        newAllocation.candidate_arena_research_allocation_id
    )!;

    expect(newProviderEffectCount).toBe(1);
    expect(recoveryEvents).toEqual([
      "checkpoint:restart_recovery",
      "provider_effect",
      "checkpoint:execution_failed"
    ]);
    expect(newAllocation.candidate_arena_research_allocation_id)
      .not.toBe(oldAllocation.candidate_arena_research_allocation_id);
    expect(researchWorkItemId({
      research_allocation_id:
        newAllocation.candidate_arena_research_allocation_id,
      direction_kind: "trend_following"
    })).not.toBe(researchWorkItemId({
      research_allocation_id:
        oldAllocation.candidate_arena_research_allocation_id,
      direction_kind: "trend_following"
    }));
    expect(newCommitment.research_preflight_commitment_id)
      .not.toBe(oldCommitment.research_preflight_commitment_id);
    expect(checkpoints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        research_preflight_commitment_ref: {
          record_kind: "research_preflight_commitment",
          id: oldCommitment.research_preflight_commitment_id
        },
        terminal_status: "failed_closed",
        terminal_reason: "restart_recovery"
      }),
      expect.objectContaining({
        research_preflight_commitment_ref: {
          record_kind: "research_preflight_commitment",
          id: newCommitment.research_preflight_commitment_id
        },
        terminal_status: "failed_closed",
        terminal_reason: "execution_failed"
      })
    ]));
  }, 60_000);

  it("projects the real three-direction concurrency lifecycle from gated persistence", async () => {
    const root = await researchRuntimeRoot();
    const base = new LocalStore(root);
    await base.initialize();
    await new CandidateArenaResearchAllocationService({
      store: base,
      now: () => "2026-07-23T00:00:00.000Z"
    }).allocate({
      tickId: "tick-old-orphan",
      allocationMode: "explicit",
      allocationPolicyBasis: { basis_kind: "explicit_request" },
      explicitDirections: ["execution_cost_robustness"],
      findingClusters: [],
      latestTicks: []
    });
    const controls = researchPersistenceControls();
    const store = gatedResearchStore(base, controls);
    const runner = new CandidateArenaRunner({
      store,
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      directions: ["trend_following", "mean_reversion", "volatility_regime"],
      researchAgent: "codex",
      researchAgentDescriptor: (_agent, direction) => ({
        id: `managed-agent-observer-${direction}`,
        provider: "codex",
        model: "observer-test",
        permission_policy: "artifact_workspace_only"
      }),
      now: monotonicClock("2026-07-23T00:01:00.000Z"),
      agentFactory: () => {
        throw new Error("injected_postcommit_provider_construction_failure");
      }
    });

    const tick = runner.tick();
    const firstDirection = await waitFor(Promise.race([
      controls.commitmentReached.trend_following.promise.then(() =>
        "trend_following" as const
      ),
      controls.commitmentReached.mean_reversion.promise.then(() =>
        "mean_reversion" as const
      ),
      tick.then(
        () => Promise.reject(new Error("tick_completed_before_first_commitment")),
        (error: unknown) => Promise.reject(error)
      )
    ]), "first_commitment");
    const secondDirection = firstDirection === "trend_following"
      ? "mean_reversion"
      : "trend_following";

    expect(runner.health()).toMatchObject({
      active_tick: true,
      active_tick_id: "tick-1",
      active_research_work_items: [
        expect.objectContaining({
          direction_kind: "trend_following",
          phase: "allocating"
        }),
        expect.objectContaining({
          direction_kind: "mean_reversion",
          phase: "allocating"
        })
      ]
    });
    expect(runner.health().active_research_work_items).toHaveLength(2);
    expect(runner.health().active_research_work_items.map((item) =>
      item.direction_kind
    )).not.toContain("volatility_regime");
    expect(runner.health().active_research_work_items.every((item) =>
      item.research_allocation_id ===
        "candidate-arena-research-allocation-tick-1"
    )).toBe(true);
    expect((await base.listCandidateArenaResearchAllocations()).some((allocation) =>
      allocation.tick_id === "tick-old-orphan"
    )).toBe(true);

    controls.commitmentAction[firstDirection].resolve("persist");
    await waitFor(
      controls.commitmentReached[secondDirection].promise,
      "second_commitment"
    );
    expect(runner.health().active_research_work_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: firstDirection,
        phase: "running",
        commitment_id: expect.any(String)
      }),
      expect.objectContaining({
        direction_kind: secondDirection,
        phase: "allocating"
      })
    ]));

    controls.commitmentAction[secondDirection].resolve("fail");
    await waitFor(
      controls.checkpointReached[firstDirection].promise,
      "first_checkpoint"
    );
    await waitUntil(
      () => runner.health().active_research_work_items.some((item) =>
        item.direction_kind === secondDirection &&
        item.phase === "failed_closed_pending_tick"
      ),
      "second_failed_projection"
    );
    expect(runner.health().active_research_work_items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction_kind: firstDirection,
        phase: "running"
      }),
      expect.objectContaining({
        direction_kind: secondDirection,
        phase: "failed_closed_pending_tick"
      })
    ]));
    controls.checkpointAction[firstDirection].resolve("persist");
    await waitFor(
      controls.commitmentReached.volatility_regime.promise,
      "volatility_commitment"
    );
    expect(runner.health().active_research_work_items).toEqual([
      expect.objectContaining({
        direction_kind: secondDirection,
        phase: "failed_closed_pending_tick",
        failure_code: "candidate_arena_research_precommit_failed"
      }),
      expect.objectContaining({
        direction_kind: "volatility_regime",
        phase: "allocating"
      })
    ]);

    controls.commitmentAction.volatility_regime.resolve("persist");
    await waitFor(
      controls.checkpointReached.volatility_regime.promise,
      "volatility_checkpoint"
    );
    expect(runner.health().active_research_work_items).toContainEqual(
      expect.objectContaining({
        direction_kind: "volatility_regime",
        phase: "running"
      })
    );
    controls.checkpointAction.volatility_regime.resolve("persist");
    await waitFor(controls.tickReached.promise, "terminal_tick");

    expect(runner.health().active_research_work_items).toEqual([
      expect.objectContaining({
        direction_kind: secondDirection,
        phase: "failed_closed_pending_tick"
      })
    ]);
    expect((await base.listCandidateArenaTicks()).some((record) =>
      record.tick_id === "tick-1"
    )).toBe(false);

    controls.tickAction.resolve("persist");
    await expect(tick).resolves.toMatchObject({
      status: "completed",
      tick_id: "tick-1"
    });
    expect(runner.health()).toMatchObject({
      active_tick: false,
      active_tick_id: undefined,
      active_research_work_items: []
    });
    expect((await base.listCandidateArenaTicks()).some((record) =>
      record.tick_id === "tick-1"
    )).toBe(true);
  }, 60_000);

  it("clears populated real runner state when terminal tick persistence fails", async () => {
    const root = await researchRuntimeRoot();
    const base = new LocalStore(root);
    await base.initialize();
    const controls = researchPersistenceControls();
    controls.commitmentAction.trend_following.resolve("fail");
    controls.commitmentAction.mean_reversion.resolve("fail");
    controls.commitmentAction.volatility_regime.resolve("fail");
    const store = gatedResearchStore(base, controls);
    const runner = new CandidateArenaRunner({
      store,
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      directions: ["trend_following", "mean_reversion", "volatility_regime"],
      researchAgent: "fixture",
      now: monotonicClock("2026-07-23T00:02:00.000Z"),
      agentFactory: () => ({}) as never
    });

    const tick = runner.tick();
    await waitFor(controls.tickReached.promise, "failed_terminal_tick");
    expect(runner.health().active_research_work_items).toHaveLength(3);
    expect(runner.health().active_research_work_items.every((item) =>
      item.phase === "failed_closed_pending_tick"
    )).toBe(true);

    controls.tickAction.resolve("fail");
    await expect(tick).rejects.toThrow("injected_tick_persistence_failure");
    expect(runner.health()).toMatchObject({
      active_tick: false,
      active_tick_id: undefined,
      active_research_work_items: []
    });
  }, 60_000);

  it("never forwards a raw pre-commit exception through the real observer boundary", async () => {
    const root = await researchRuntimeRoot();
    const base = new LocalStore(root);
    await base.initialize();
    const controls = researchPersistenceControls();
    controls.commitmentAction.trend_following.resolve("fail");
    controls.tickAction.resolve("persist");
    const seenFailures: unknown[] = [];
    const observer: CandidateArenaResearchWorkObserver = {
      directionStarted() {},
      commitmentPersisted() {},
      directionFailed(input) {
        seenFailures.push(input);
        throw new Error("observer_failure_must_not_change_tick");
      },
      terminalEvidencePersisted() {},
      tickPersisted() {
        throw new Error("observer_failure_must_not_change_evidence");
      },
      clearMatchingTick() {}
    };

    await expect(runCandidateArenaTick({
      store: gatedResearchStore(base, controls),
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      tickId: "observer-isolation",
      directions: ["trend_following"],
      researchAgent: "fixture",
      now: monotonicClock("2026-07-23T00:03:00.000Z"),
      agentFactory: () => ({}) as never
    }, "stopped", 1, observer)).resolves.toMatchObject({
      status: "completed",
      tick_id: "observer-isolation"
    });
    expect(seenFailures).toEqual([{
      research_allocation_id:
        "candidate-arena-research-allocation-observer-isolation",
      direction_kind: "trend_following"
    }]);
    expect((await base.listCandidateArenaTicks()).map((record) =>
      record.tick_id
    )).toContain("observer-isolation");
  }, 60_000);

  it("persists only a sanitized bounded direction failure summary", async () => {
    const root = await researchRuntimeRoot();
    const store = new LocalStore(root);
    await store.initialize();
    const privateOwner = "private-owner-sentinel";
    const urlPassword = "url-password-sentinel";
    const tokenValue = "token-value-sentinel";
    const rawFailure = [
      `provider failed at /Users/${privateOwner}/research/session.json`,
      `https://operator:${urlPassword}@example.test/private`,
      `access_token=${tokenValue}`,
      "x".repeat(2_000)
    ].join(" ");

    await expect(runCandidateArenaTick({
      store,
      sourceArtifactDir: path.join(process.cwd(), "artifacts/trading-system"),
      tickId: "private-failure-summary",
      directions: ["trend_following"],
      researchAgent: "codex",
      now: monotonicClock("2026-07-23T00:04:00.000Z"),
      agentFactory: () => {
        throw new Error(rawFailure);
      }
    })).resolves.toMatchObject({
      status: "completed",
      tick_id: "private-failure-summary"
    });

    const storedTick = (await store.listCandidateArenaTicks()).find((tick) =>
      tick.tick_id === "private-failure-summary"
    )!;
    const failure = storedTick.direction_results[0]?.error;
    const serialized = JSON.stringify(storedTick);
    expect(failure).toContain("[private-path]");
    expect(failure).toContain("[external-url]");
    expect(failure).toContain("[redacted]");
    expect(failure?.length).toBeLessThanOrEqual(256);
    for (const sentinel of [privateOwner, urlPassword, tokenValue]) {
      expect(serialized).not.toContain(sentinel);
    }
  }, 60_000);
});

function runningEvaluation(suffix = "1") {
  return {
    paper_trading_evaluation_id: `evaluation-${suffix}`,
    candidate_ref: { record_kind: "candidate", id: `candidate-${suffix}` },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `candidate-version-${suffix}`
    },
    trading_run_ref: {
      record_kind: "trading_run",
      id: `trading-run-${suffix}`
    },
    status: "running" as const,
    interval_ms: 60_000,
    observation_count: 2,
    started_at: "2026-07-16T00:00:00.000Z",
    latest_score: {
      revenue_usdt: 0,
      cost_usdt: 0,
      net_revenue_usdt: 0,
      net_return_pct: 0
    },
    authority_status: "not_live" as const
  };
}

function arenaRecoveryCapacitySnapshot(input: {
  overflowDeferred: boolean;
  active: boolean;
}) {
  const systems = ["1", "2"].map((suffix, index) => ({
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `candidate-${suffix}`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `candidate-version-${suffix}`
    },
    system_code_ref: {
      record_kind: "system_code",
      id: `system-code-${suffix}`
    },
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `admission-${suffix}`
    },
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: `conformance-${suffix}`
    },
    trading_run_ref: {
      record_kind: "trading_run",
      id: `trading-run-${suffix}`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `evaluation-${suffix}`
    },
    admission_decided_at: `2026-07-16T00:0${index}:00.000Z`,
    lifecycle_status: index === 0
      ? input.active ? "running" as const : "recovering" as const
      : input.overflowDeferred ? "queued" as const : "recovering" as const,
    active: index === 0 && input.active,
    ...(index === 1 && input.overflowDeferred
      ? { runtime_coordination_status: "arena_capacity_deferred" as const }
      : {}),
    authority_status: "not_live" as const
  }));
  const recoveringCount = systems.filter((system) =>
    system.lifecycle_status === "recovering"
  ).length;
  const runningCount = systems.filter((system) =>
    system.lifecycle_status === "running"
  ).length;
  const queuedCount = systems.filter((system) =>
    system.lifecycle_status === "queued"
  ).length;
  return {
    runtime_kind: "arena_paper_runtime" as const,
    capacity: 1,
    eligible_count: 2,
    occupied_count: recoveringCount + runningCount,
    available_capacity: Math.max(0, 1 - recoveringCount - runningCount),
    queued_count: queuedCount,
    starting_count: 0,
    running_count: runningCount,
    recovering_count: recoveringCount,
    stopped_count: 0,
    failed_count: 0,
    invalidated_count: 0,
    startable_count: queuedCount,
    needs_reconcile: queuedCount > 0 && runningCount + recoveringCount < 1,
    systems,
    evaluation_authority: false as const,
    promotion_authority: false as const,
    order_submission_authority: false as const,
    private_read_authority: false as const,
    live_exchange_authority: false as const,
    authority_status: "runtime_coordination_only" as const
  };
}

function arenaStartCommand() {
  return {
    ouroboros_command_id: "command-1",
    command_kind: "arena.start" as const,
    status: "succeeded" as const,
    requested_at: "2026-07-16T00:00:00.000Z",
    completed_at: "2026-07-16T00:00:01.000Z"
  };
}

function inactiveArenaRunner() {
  return {
    health: () => ({
      status: "stopped" as const,
      tick_count: 0,
      completed_tick_count: 0,
      active_tick: false,
      active_research_work_items: [],
      consecutive_failure_count: 0,
      runtime_coordination_authority: true as const,
      evaluation_authority: false as const,
      promotion_authority: false as const,
      order_submission_authority: false as const,
      live_exchange_authority: false as const,
      authority_status: "runtime_coordination_only" as const
    }),
    async stopAndDrain() {
      return "stopped" as const;
    }
  };
}

function inactiveOperatorService() {
  return {
    async readResearcherProvider() {
      return {
        selected_provider: "fixture" as const,
        available_providers: ["codex" as const, "fixture" as const],
        authority_status: "research_only" as const
      };
    },
    async resumeAutonomousArenaLoop() {
      return "not_requested" as const;
    },
    async drainAutonomousPaperStarts() {}
  };
}

function inactivePaperSessions() {
  return {
    active: () => false,
    async stop() {
      return undefined;
    },
    async recoverRunningEvaluations() {
      return [];
    },
    async finalizeRecoveryFailures() {},
    async stopAllSessions() {}
  };
}

function emptyStore() {
  return {
    async listPaperTradingEvaluations() {
      return [];
    },
    async getTradingRun() {
      return undefined;
    },
    async listOuroborosCommands() {
      return [];
    },
    async getResearcherProviderSelection() {
      return undefined;
    },
    async listResearchControlStudies() {
      return [];
    },
    async listResearchControlStudyOutcomes() {
      return [];
    }
  };
}

function durableArenaIntentStore() {
  return {
    ...emptyStore(),
    async listOuroborosCommands() {
      return [arenaStartCommand()];
    },
    async getResearcherProviderSelection() {
      return { selected_provider: "fixture" };
    }
  } as never;
}

function inactiveScheduler() {
  return {
    start() {
      return "started" as const;
    },
    async stop() {},
    async drain() {},
    status: () => ({
      status: "idle" as const,
      cycleCount: 0,
      completedStudyCount: 0
    })
  };
}

function arenaPaperSnapshot(input: { queued: boolean }) {
  return {
    runtime_kind: "arena_paper_runtime" as const,
    capacity: 2,
    eligible_count: input.queued ? 2 : 1,
    occupied_count: 1,
    available_capacity: 1,
    queued_count: input.queued ? 1 : 0,
    starting_count: 0,
    running_count: 1,
    recovering_count: 0,
    stopped_count: 0,
    failed_count: 0,
    invalidated_count: 0,
    startable_count: input.queued ? 1 : 0,
    needs_reconcile: input.queued,
    systems: [],
    evaluation_authority: false as const,
    promotion_authority: false as const,
    order_submission_authority: false as const,
    private_read_authority: false as const,
    live_exchange_authority: false as const,
    authority_status: "runtime_coordination_only" as const
  };
}

type ControlledResearchDirection =
  | "trend_following"
  | "mean_reversion"
  | "volatility_regime";

type PersistenceAction = "persist" | "fail";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

interface ResearchPersistenceControls {
  commitmentReached: Record<ControlledResearchDirection, Deferred<void>>;
  commitmentAction: Record<ControlledResearchDirection, Deferred<PersistenceAction>>;
  checkpointReached: Record<ControlledResearchDirection, Deferred<void>>;
  checkpointAction: Record<ControlledResearchDirection, Deferred<PersistenceAction>>;
  tickReached: Deferred<void>;
  tickAction: Deferred<PersistenceAction>;
}

function researchPersistenceControls(): ResearchPersistenceControls {
  return {
    commitmentReached: directionDeferreds<void>(),
    commitmentAction: directionDeferreds<PersistenceAction>(),
    checkpointReached: directionDeferreds<void>(),
    checkpointAction: directionDeferreds<PersistenceAction>(),
    tickReached: deferred<void>(),
    tickAction: deferred<PersistenceAction>()
  };
}

function directionDeferreds<T>(): Record<ControlledResearchDirection, Deferred<T>> {
  return {
    trend_following: deferred<T>(),
    mean_reversion: deferred<T>(),
    volatility_regime: deferred<T>()
  };
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`gate_timeout:${label}`)),
          10_000
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitUntil(
  predicate: () => boolean,
  label: string
): Promise<void> {
  const deadline = Date.now() + 10_000;
  await new Promise<void>((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error(`gate_timeout:${label}`));
        return;
      }
      setTimeout(poll, 1);
    };
    poll();
  });
}

async function researchRuntimeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runner-observer-"));
  researchRuntimeRoots.push(root);
  return root;
}

function monotonicClock(start: string): () => string {
  let timestamp = Date.parse(start);
  return () => new Date(timestamp++).toISOString();
}

function gatedResearchStore(
  base: LocalStore,
  controls: ResearchPersistenceControls
): OuroborosStorePort {
  const directionByCommitment = new Map<string, ControlledResearchDirection>();
  return new Proxy(base, {
    get(target, property) {
      if (property === "recordResearchPreflightCommitment") {
        return async (record: ResearchPreflightCommitmentRecord) => {
          const direction = controlledResearchDirection(
            record.methodology?.direction_kind
          );
          if (direction) {
            directionByCommitment.set(
              record.research_preflight_commitment_id,
              direction
            );
            controls.commitmentReached[direction].resolve();
            if (await controls.commitmentAction[direction].promise === "fail") {
              throw new Error(
                "raw_precommit_failure /private/tmp/secret token=must-not-cross"
              );
            }
          }
          return base.recordResearchPreflightCommitment(record);
        };
      }
      if (property === "recordResearchWorkerCheckpoint") {
        return async (record: ResearchWorkerCheckpointRecord) => {
          const direction = directionByCommitment.get(
            record.research_preflight_commitment_ref.id
          );
          if (direction) {
            controls.checkpointReached[direction].resolve();
            if (await controls.checkpointAction[direction].promise === "fail") {
              throw new Error("injected_checkpoint_persistence_failure");
            }
          }
          return base.recordResearchWorkerCheckpoint(record);
        };
      }
      if (property === "recordCandidateArenaTick") {
        return async (record: CandidateArenaTickRecord) => {
          controls.tickReached.resolve();
          if (await controls.tickAction.promise === "fail") {
            throw new Error("injected_tick_persistence_failure");
          }
          return base.recordCandidateArenaTick(record);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as unknown as OuroborosStorePort;
}

function observeResearchCheckpointPersistence(
  base: LocalStore,
  events: string[]
): OuroborosStorePort {
  return new Proxy(base, {
    get(target, property) {
      if (property === "recordResearchWorkerCheckpoint") {
        return async (record: ResearchWorkerCheckpointRecord) => {
          events.push(`checkpoint:${record.terminal_reason}`);
          return base.recordResearchWorkerCheckpoint(record);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as unknown as OuroborosStorePort;
}

function controlledResearchDirection(
  direction: ResearchDirectionKind | undefined
): ControlledResearchDirection | undefined {
  if (direction === "trend_following" || direction === "mean_reversion" ||
    direction === "volatility_regime") {
    return direction;
  }
  return undefined;
}
