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
    const scheduler = new ResearchControlStudyScheduler({ supervisor });

    scheduler.start();
    await supervisor.started;
    const stopping = scheduler.stop();
    await stopping;

    expect(supervisor.stopCount).toBe(1);
    expect(scheduler.status()).toEqual({
      status: "stopped",
      cycleCount: 0,
      completedStudyCount: 0
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
    const scheduler = new ResearchControlStudyScheduler({ supervisor });

    scheduler.start();
    await scheduler.drain();

    expect(supervisor.startCount).toBe(1);
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
    const scheduler = new ResearchControlStudyScheduler({ supervisor });

    scheduler.start();
    await scheduler.drain();

    expect(scheduler.status()).toMatchObject({
      status: "failed",
      cycleCount: 1,
      errorCode: "research_control_study_scheduler_supervisor_invalid"
    });
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
