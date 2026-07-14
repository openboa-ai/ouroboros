import { describe, expect, it } from "vitest";
import type { ResearchControlStudyProcessStatus } from
  "../src/candidate/arena/research-control-study-process-supervisor";
import {
  ResearchControlStudyScheduler,
  ResearchControlStudySchedulerError
} from "../src/candidate/arena/research-control-study-scheduler";

describe("ResearchControlStudyScheduler", () => {
  it("polls after catching up and accumulates completed studies", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const supervisor = new ScriptedSupervisor([
      { status: "caught_up", completedStudyCount: 1 },
      { status: "caught_up", completedStudyCount: 2 }
    ]);
    const scheduler = new ResearchControlStudyScheduler({
      supervisor,
      pollIntervalMs: 10_000,
      now: clock.now,
      sleep: clock.sleep
    });

    expect(scheduler.status()).toEqual({
      status: "idle",
      cycleCount: 0,
      completedStudyCount: 0
    });
    expect(scheduler.start()).toBe("started");
    await clock.waiting();

    expect(supervisor.startCount).toBe(1);
    expect(scheduler.status()).toEqual({
      status: "waiting",
      cycleCount: 1,
      completedStudyCount: 1,
      nextPollAt: "2026-07-13T00:00:10.000Z"
    });

    clock.advanceTo("2026-07-13T00:00:10.000Z");
    await clock.waiting();

    expect(supervisor.startCount).toBe(2);
    expect(scheduler.status()).toEqual({
      status: "waiting",
      cycleCount: 2,
      completedStudyCount: 3,
      nextPollAt: "2026-07-13T00:00:20.000Z"
    });

    await scheduler.stop();
    expect(supervisor.stopCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "stopped",
      cycleCount: 2,
      completedStudyCount: 3
    });
  });

  it("ensures one commitment before every supervisor discovery cycle", async () => {
    const events: string[] = [];
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const supervisor = new OrderedSupervisor(events);
    let commitmentCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      commitmentCoordinator: {
        async ensureCommittedStudy() {
          commitmentCount += 1;
          events.push(`commit-${commitmentCount}`);
          return commitmentCount === 1
            ? {
                status: "committed" as const,
                studyId: "automatic-study-001"
              }
            : {
                status: "existing" as const,
                studyId: "automatic-study-001"
              };
        }
      },
      supervisor,
      pollIntervalMs: 10_000,
      now: clock.now,
      sleep: clock.sleep
    });

    scheduler.start();
    await clock.waiting();
    expect(events).toEqual(["commit-1", "supervisor-start-1"]);
    expect(scheduler.status()).toMatchObject({
      status: "waiting",
      lastCommitment: {
        status: "committed",
        studyId: "automatic-study-001"
      }
    });

    clock.advanceTo("2026-07-13T00:00:10.000Z");
    await clock.waiting();
    expect(events).toEqual([
      "commit-1",
      "supervisor-start-1",
      "commit-2",
      "supervisor-start-2"
    ]);
    expect(scheduler.status()).toMatchObject({
      status: "waiting",
      lastCommitment: {
        status: "existing",
        studyId: "automatic-study-001"
      }
    });

    await scheduler.stop();
  });

  it("reconciles outcome, broad decision, then same-baseline decision after catch-up", async () => {
    const events: string[] = [];
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const scheduler = new ResearchControlStudyScheduler({
      commitmentCoordinator: {
        async ensureCommittedStudy() {
          events.push("commitment");
          return {
            status: "existing" as const,
            studyId: "research-control-study-complete"
          };
        }
      },
      supervisor: new OrderedCatchUpSupervisor(events),
      generalizationOutcomeCoordinator: {
        async ensureNextOutcome() {
          events.push("generalization-outcome");
          return {
            status: "ensured" as const,
            outcomeId: "research-generalization-outcome-001",
            protocolId: "research-generalization-protocol-001",
            inferenceStatus: "generalization_supported" as const
          };
        }
      },
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          events.push("generalization-policy-decision");
          return {
            status: "ensured" as const,
            decisionId: "research-generalization-policy-decision-001",
            generalizationOutcomeId:
              "research-generalization-outcome-001",
            decisionStatus: "approved" as const
          };
        }
      },
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          events.push("policy-decision");
          return {
            status: "ensured" as const,
            decisionId: "research-allocation-policy-decision-001",
            studyOutcomeId: "research-control-study-outcome-001",
            decisionStatus: "approved" as const
          };
        }
      },
      pollIntervalMs: 10_000,
      now: clock.now,
      sleep: clock.sleep
    });

    scheduler.start();
    await clock.waiting();

    expect(events).toEqual([
      "commitment",
      "supervisor-start",
      "supervisor-caught-up",
      "generalization-outcome",
      "generalization-policy-decision",
      "policy-decision"
    ]);
    expect(scheduler.status()).toMatchObject({
      status: "waiting",
      cycleCount: 1,
      lastGeneralizationOutcome: {
        status: "ensured",
        outcomeId: "research-generalization-outcome-001",
        protocolId: "research-generalization-protocol-001",
        inferenceStatus: "generalization_supported"
      },
      lastGeneralizationPolicyDecision: {
        status: "ensured",
        decisionId: "research-generalization-policy-decision-001",
        generalizationOutcomeId: "research-generalization-outcome-001",
        decisionStatus: "approved"
      },
      lastPolicyDecision: {
        status: "ensured",
        decisionId: "research-allocation-policy-decision-001",
        studyOutcomeId: "research-control-study-outcome-001",
        decisionStatus: "approved"
      }
    });

    await scheduler.stop();
  });

  it("does not decide policy while the oldest study is contended", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    let decisionCount = 0;
    let generalizationDecisionCount = 0;
    let outcomeCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([{
        status: "contended",
        completedStudyCount: 0,
        studyId: "study-contended",
        reason: "owner_alive",
        leaseExpiresAt: "2026-07-13T00:00:30.000Z"
      }]),
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
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          generalizationDecisionCount += 1;
          return {
            status: "up_to_date" as const,
            generalizationOutcomeCount: 0
          };
        }
      },
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      now: clock.now,
      sleep: clock.sleep
    });

    scheduler.start();
    await clock.waiting();

    expect(outcomeCount).toBe(0);
    expect(generalizationDecisionCount).toBe(0);
    expect(decisionCount).toBe(0);
    expect(scheduler.status()).not.toHaveProperty("lastGeneralizationOutcome");
    expect(scheduler.status()).not.toHaveProperty(
      "lastGeneralizationPolicyDecision"
    );
    expect(scheduler.status()).not.toHaveProperty("lastPolicyDecision");
    await scheduler.stop();
  });

  it("fails after catch-up when outcome reconciliation fails", async () => {
    const error = Object.assign(new Error("injected outcome failure"), {
      code: "research_generalization_outcome_coordination_failed"
    });
    let generalizationPolicyDecisionCount = 0;
    let policyDecisionCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([{
        status: "caught_up",
        completedStudyCount: 2
      }]),
      generalizationOutcomeCoordinator: {
        async ensureNextOutcome() {
          throw error;
        }
      },
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          generalizationPolicyDecisionCount += 1;
          return {
            status: "up_to_date" as const,
            generalizationOutcomeCount: 0
          };
        }
      },
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          policyDecisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      sleep: async () => {
        throw Object.assign(new Error("unexpected bounded wait"), {
          code: "unexpected_bounded_wait"
        });
      }
    });

    scheduler.start();
    await scheduler.drain();

    expect(generalizationPolicyDecisionCount).toBe(0);
    expect(policyDecisionCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "failed",
      cycleCount: 1,
      completedStudyCount: 2,
      errorCode: "research_generalization_outcome_coordination_failed",
      errorMessage: "injected outcome failure"
    });
  });

  it("fails closed before same-baseline policy when broad decision fails", async () => {
    const error = Object.assign(new Error("injected broad decision failure"), {
      code: "research_generalization_policy_decision_coordination_failed"
    });
    let policyDecisionCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([{
        status: "caught_up",
        completedStudyCount: 2
      }]),
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          throw error;
        }
      },
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          policyDecisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      },
      sleep: async () => {
        throw Object.assign(new Error("unexpected bounded wait"), {
          code: "unexpected_bounded_wait"
        });
      }
    });

    scheduler.start();
    await scheduler.drain();

    expect(policyDecisionCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "failed",
      cycleCount: 1,
      completedStudyCount: 2,
      errorCode:
        "research_generalization_policy_decision_coordination_failed",
      errorMessage: "injected broad decision failure"
    });
  });

  it("returns a cloned broad decision status", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([{
        status: "caught_up",
        completedStudyCount: 0
      }]),
      generalizationPolicyDecisionCoordinator: {
        async ensureNextDecision() {
          return {
            status: "ensured" as const,
            decisionId: "research-generalization-policy-decision-clone",
            generalizationOutcomeId: "research-generalization-outcome-clone",
            decisionStatus: "approved" as const
          };
        }
      },
      now: clock.now,
      sleep: clock.sleep
    });
    scheduler.start();
    await clock.waiting();

    const exposed = scheduler.status() as any;
    exposed.lastGeneralizationPolicyDecision.decisionId = "mutated";

    expect(scheduler.status()).toMatchObject({
      lastGeneralizationPolicyDecision: {
        decisionId: "research-generalization-policy-decision-clone"
      }
    });
    await scheduler.stop();
  });

  it("fails after catch-up when automatic policy decision fails", async () => {
    const error = Object.assign(new Error("injected policy decision failure"), {
      code: "research_allocation_policy_decision_coordination_failed"
    });
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([{
        status: "caught_up",
        completedStudyCount: 2
      }]),
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          throw error;
        }
      },
      sleep: async () => {
        throw Object.assign(new Error("unexpected bounded wait"), {
          code: "unexpected_bounded_wait"
        });
      }
    });

    scheduler.start();
    await scheduler.drain();

    expect(scheduler.status()).toEqual({
      status: "failed",
      cycleCount: 1,
      completedStudyCount: 2,
      errorCode: "research_allocation_policy_decision_coordination_failed",
      errorMessage: "injected policy decision failure"
    });
  });

  it("fails before discovery when automatic commitment fails", async () => {
    const supervisor = new ScriptedSupervisor([
      { status: "caught_up", completedStudyCount: 0 }
    ]);
    const error = Object.assign(new Error("injected commitment failure"), {
      code: "research_control_study_commitment_failed"
    });
    const scheduler = new ResearchControlStudyScheduler({
      commitmentCoordinator: {
        async ensureCommittedStudy() {
          throw error;
        }
      },
      supervisor
    });

    scheduler.start();
    await scheduler.drain();

    expect(supervisor.startCount).toBe(0);
    expect(scheduler.status()).toMatchObject({
      status: "failed",
      cycleCount: 0,
      completedStudyCount: 0,
      errorCode: "research_control_study_commitment_failed",
      errorMessage: "injected commitment failure"
    });
  });

  it("returns already_running for duplicate starts", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([
        { status: "caught_up", completedStudyCount: 0 }
      ]),
      now: clock.now,
      sleep: clock.sleep
    });

    expect(scheduler.start()).toBe("started");
    expect(scheduler.start()).toBe("already_running");
    await clock.waiting();
    await scheduler.stop();
  });

  it("interrupts polling without waiting for the sleep promise", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([
        { status: "caught_up", completedStudyCount: 0 }
      ]),
      now: clock.now,
      sleep: clock.sleep
    });

    scheduler.start();
    await clock.waiting();
    await scheduler.stop();

    expect(clock.pendingSleepCount).toBe(1);
    expect(scheduler.status()).toMatchObject({ status: "stopped" });
  });

  it("waits and retries after oldest-study contention", async () => {
    const clock = new DeferredClock("2026-07-13T00:00:00.000Z");
    const supervisor = new ScriptedSupervisor([
      {
        status: "contended",
        completedStudyCount: 0,
        studyId: "study-contended",
        reason: "owner_alive",
        leaseExpiresAt: "2026-07-13T00:00:30.000Z"
      },
      { status: "caught_up", completedStudyCount: 0 }
    ]);
    const scheduler = new ResearchControlStudyScheduler({
      supervisor,
      pollIntervalMs: 10_000,
      now: clock.now,
      sleep: clock.sleep
    });

    scheduler.start();
    await clock.waiting();
    expect(supervisor.startCount).toBe(1);
    expect(scheduler.status()).toMatchObject({
      status: "waiting",
      cycleCount: 1,
      completedStudyCount: 0
    });

    clock.advanceTo("2026-07-13T00:00:10.000Z");
    await clock.waiting();
    expect(supervisor.startCount).toBe(2);
    expect(scheduler.status()).toMatchObject({
      status: "waiting",
      cycleCount: 2,
      completedStudyCount: 0
    });

    await scheduler.stop();
  });

  it("delegates stop while a supervisor cycle is active", async () => {
    const supervisor = new GatedSupervisor();
    let decisionCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor,
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      }
    });

    scheduler.start();
    await supervisor.started;
    const stopping = scheduler.stop();
    await stopping;

    expect(supervisor.stopCount).toBe(1);
    expect(decisionCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "stopped",
      cycleCount: 0,
      completedStudyCount: 0
    });
  });

  it("does not start a supervisor after stop is requested during commitment", async () => {
    const commitment = deferred<{
      status: "existing";
      studyId: string;
    }>();
    const supervisor = new ScriptedSupervisor([
      { status: "caught_up", completedStudyCount: 0 }
    ]);
    const scheduler = new ResearchControlStudyScheduler({
      commitmentCoordinator: {
        async ensureCommittedStudy() {
          return commitment.promise;
        }
      },
      supervisor
    });

    scheduler.start();
    const stopping = scheduler.stop();
    commitment.resolve({
      status: "existing",
      studyId: "research-control-study-committed"
    });
    await stopping;

    expect(supervisor.startCount).toBe(0);
    expect(supervisor.stopCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "stopped",
      cycleCount: 0,
      completedStudyCount: 0,
      lastCommitment: {
        status: "existing",
        studyId: "research-control-study-committed"
      }
    });
  });

  it("halts on supervisor failure without polling again", async () => {
    const supervisor = new ScriptedSupervisor([{
      status: "failed",
      completedStudyCount: 1,
      studyId: "research-control-study-failed",
      errorCode: "research_control_study_executor_action_failed",
      errorMessage: "injected failure"
    }]);
    let decisionCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor,
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      }
    });

    scheduler.start();
    await scheduler.drain();

    expect(supervisor.startCount).toBe(1);
    expect(decisionCount).toBe(0);
    expect(scheduler.status()).toEqual({
      status: "failed",
      cycleCount: 1,
      completedStudyCount: 1,
      studyId: "research-control-study-failed",
      errorCode: "research_control_study_executor_action_failed",
      errorMessage: "injected failure"
    });
    expect(() => scheduler.start()).toThrowError(expect.objectContaining({
      code: "research_control_study_scheduler_terminal"
    }));
  });

  it("fails closed when a supervisor cycle has an invalid terminal state", async () => {
    const supervisor = new ScriptedSupervisor([{
      status: "discovering",
      completedStudyCount: 0
    }]);
    let decisionCount = 0;
    const scheduler = new ResearchControlStudyScheduler({
      supervisor,
      policyDecisionCoordinator: {
        async ensureNextDecision() {
          decisionCount += 1;
          return { status: "up_to_date", terminalOutcomeCount: 0 } as const;
        }
      }
    });

    scheduler.start();
    await scheduler.drain();

    expect(scheduler.status()).toMatchObject({
      status: "failed",
      cycleCount: 1,
      errorCode: "research_control_study_scheduler_supervisor_invalid"
    });
    expect(decisionCount).toBe(0);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid poll interval %s",
    (pollIntervalMs) => {
      expect(() => new ResearchControlStudyScheduler({
        supervisor: new ScriptedSupervisor([]),
        pollIntervalMs
      })).toThrowError(expect.objectContaining<Partial<ResearchControlStudySchedulerError>>({
        code: "research_control_study_scheduler_interval_invalid"
      }));
    }
  );

  it("fails closed when the scheduler clock is not an exact ISO instant", async () => {
    const scheduler = new ResearchControlStudyScheduler({
      supervisor: new ScriptedSupervisor([
        { status: "caught_up", completedStudyCount: 0 }
      ]),
      now: () => "2026-07-13"
    });

    scheduler.start();
    await scheduler.drain();

    expect(scheduler.status()).toMatchObject({
      status: "failed",
      cycleCount: 1,
      errorCode: "research_control_study_scheduler_clock_invalid"
    });
  });
});

class ScriptedSupervisor {
  startCount = 0;
  stopCount = 0;
  private currentStatus: ResearchControlStudyProcessStatus = { status: "idle" };

  constructor(
    private readonly terminalStatuses: ResearchControlStudyProcessStatus[]
  ) {}

  start(): "started" | "already_running" {
    this.startCount += 1;
    this.currentStatus = { status: "discovering", completedStudyCount: 0 };
    return "started";
  }

  async drain(): Promise<void> {
    const terminal = this.terminalStatuses[this.startCount - 1];
    if (!terminal) throw new Error("missing_scripted_supervisor_status");
    this.currentStatus = structuredClone(terminal);
  }

  async stop(): Promise<void> {
    this.stopCount += 1;
    this.currentStatus = { status: "stopped", completedStudyCount: 0 };
  }

  status(): ResearchControlStudyProcessStatus {
    return structuredClone(this.currentStatus);
  }
}

class OrderedSupervisor {
  private cycleCount = 0;

  constructor(private readonly events: string[]) {}

  start(): "started" {
    this.cycleCount += 1;
    this.events.push(`supervisor-start-${this.cycleCount}`);
    return "started";
  }

  async drain(): Promise<void> {}

  async stop(): Promise<void> {}

  status(): ResearchControlStudyProcessStatus {
    return { status: "caught_up", completedStudyCount: 0 };
  }
}

class OrderedCatchUpSupervisor {
  private currentStatus: ResearchControlStudyProcessStatus = { status: "idle" };

  constructor(private readonly events: string[]) {}

  start(): "started" {
    this.events.push("supervisor-start");
    this.currentStatus = { status: "discovering", completedStudyCount: 0 };
    return "started";
  }

  async drain(): Promise<void> {
    this.events.push("supervisor-caught-up");
    this.currentStatus = { status: "caught_up", completedStudyCount: 1 };
  }

  async stop(): Promise<void> {
    this.currentStatus = { status: "stopped", completedStudyCount: 1 };
  }

  status(): ResearchControlStudyProcessStatus {
    return structuredClone(this.currentStatus);
  }
}

class GatedSupervisor {
  stopCount = 0;
  private readonly startGate = deferred<void>();
  private readonly stopGate = deferred<void>();
  private currentStatus: ResearchControlStudyProcessStatus = { status: "idle" };

  get started(): Promise<void> {
    return this.startGate.promise;
  }

  start(): "started" {
    this.currentStatus = { status: "discovering", completedStudyCount: 0 };
    this.startGate.resolve();
    return "started";
  }

  async drain(): Promise<void> {
    await this.stopGate.promise;
  }

  async stop(): Promise<void> {
    this.stopCount += 1;
    this.currentStatus = { status: "stopped", completedStudyCount: 0 };
    this.stopGate.resolve();
  }

  status(): ResearchControlStudyProcessStatus {
    return structuredClone(this.currentStatus);
  }
}

class DeferredClock {
  private current: string;
  private waitGate = deferred<void>();
  private sleeps: Array<ReturnType<typeof deferred<void>>> = [];

  constructor(initial: string) {
    this.current = initial;
  }

  readonly now = (): string => this.current;

  readonly sleep = (_milliseconds: number): Promise<void> => {
    const gate = deferred<void>();
    this.sleeps.push(gate);
    this.waitGate.resolve();
    return gate.promise;
  };

  get pendingSleepCount(): number {
    return this.sleeps.length;
  }

  async waiting(): Promise<void> {
    await this.waitGate.promise;
    this.waitGate = deferred<void>();
  }

  advanceTo(now: string): void {
    this.current = now;
    const sleep = this.sleeps.shift();
    if (!sleep) throw new Error("no_pending_sleep");
    sleep.resolve();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
