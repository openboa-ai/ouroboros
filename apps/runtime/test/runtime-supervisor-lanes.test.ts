import { describe, expect, it, vi } from "vitest";
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
