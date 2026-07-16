import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from
  "@ouroboros/application/ports/store";
import type {
  ResearchControlStudyExecutionLeaseRecord,
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord
} from "@ouroboros/domain";
import {
  closeResearchControlStudyExecutionLease,
  decideResearchControlStudyExecutionLease
} from "@ouroboros/domain";
import {
  ResearchControlStudyProcessSupervisor
} from "../src/candidate/arena/research-control-study-process-supervisor";
import {
  ResearchControlStudyExecutionLeaseSessionError,
  type ResearchControlStudyExecutionLeaseSessionClaim,
  type ResearchControlStudyExecutionLeaseSessionFactory,
  type ResearchControlStudyExecutionLeaseSessionLifecycle,
  type ResearchControlStudyExecutionLeaseSessionStatus
} from "../src/candidate/arena/research-control-study-execution-lease-session";
import {
  researchControlStudyFixture,
  researchControlStudyOutcomeFixture
} from "./helpers/research-control-study";

describe("ResearchControlStudyProcessSupervisor", () => {
  it("catches up without opening a runtime when no study is pending", async () => {
    const terminal = researchControlStudyFixture({ suffix: "terminal" });
    const store = new MutableProcessStore(
      [terminal],
      [researchControlStudyOutcomeFixture({ study: terminal })]
    );
    let openCount = 0;
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async () => {
        openCount += 1;
        throw new Error("must_not_open");
      }
    });

    expect(supervisor.status()).toEqual({ status: "idle" });
    expect(supervisor.start()).toBe("started");
    await supervisor.drain();

    expect(openCount).toBe(0);
    expect(supervisor.status()).toEqual({
      status: "caught_up",
      completedStudyCount: 0
    });
  });

  it("returns contention for the oldest study without opening or skipping", async () => {
    const first = researchControlStudyFixture({
      suffix: "contended-first",
      committedAt: "2026-07-12T08:00:00.000Z"
    });
    const second = researchControlStudyFixture({
      suffix: "contended-second",
      committedAt: "2026-07-12T09:00:00.000Z"
    });
    const lease = executionLease(first);
    const leaseFactory = new ScriptedLeaseFactory({
      status: "held",
      lease,
      reason: "owner_alive"
    });
    let openCount = 0;
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: new MutableProcessStore([second, first]).port(),
      leaseSessionFactory: leaseFactory,
      openStudy: async () => {
        openCount += 1;
        throw new Error("must_not_open");
      }
    });

    supervisor.start();
    await supervisor.drain();

    expect(leaseFactory.studyIds).toEqual([first.research_control_study_id]);
    expect(openCount).toBe(0);
    expect(supervisor.status()).toEqual({
      status: "contended",
      completedStudyCount: 0,
      studyId: first.research_control_study_id,
      reason: "owner_alive",
      leaseExpiresAt: lease.expires_at
    });
  });

  it("starts ownership before runtime effects and releases after exact closure reload", async () => {
    const study = researchControlStudyFixture({ suffix: "leased-lifecycle" });
    const store = new MutableProcessStore([study]);
    const events: string[] = [];
    const leaseSession = new ScriptedLeaseSession(executionLease(study), events);
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }, events),
      openStudy: async (_study, ownership) => {
        events.push("open");
        expect(ownership).toBeDefined();
        await ownership!.guard();
        let status: any = { status: "idle" };
        return {
          runner: {
            start() {
              events.push("runner-start");
              status = { status: "running", studyId: study.research_control_study_id };
            },
            async drain() {
              const outcome = store.complete(study);
              events.push("persisted");
              status = {
                status: "completed",
                latestStep: { status: "complete", action: "complete", outcome }
              };
            },
            async stop() { status = { status: "stopped" }; },
            status: () => structuredClone(status)
          }
        };
      }
    });

    supervisor.start();
    await supervisor.drain();

    expect(events).toEqual([
      "claim",
      "session-start",
      "open",
      "guard",
      "runner-start",
      "persisted",
      "release"
    ]);
    expect(leaseSession.releaseCount).toBe(1);
    expect(supervisor.status()).toEqual({
      status: "caught_up",
      completedStudyCount: 1
    });
  });

  it("runs pending studies oldest first with one active runtime", async () => {
    const first = researchControlStudyFixture({
      suffix: "first",
      committedAt: "2026-07-12T08:00:00.000Z"
    });
    const second = researchControlStudyFixture({
      suffix: "second",
      committedAt: "2026-07-12T09:00:00.000Z"
    });
    const store = new MutableProcessStore([second, first]);
    const opened: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async (study) => ({
        runner: completingRunner(study, store, {
          onStart() {
            opened.push(study.research_control_study_id);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
          },
          onComplete() { active -= 1; }
        })
      })
    });

    supervisor.start();
    await supervisor.drain();

    expect(opened).toEqual([
      first.research_control_study_id,
      second.research_control_study_id
    ]);
    expect(maximumActive).toBe(1);
    expect(supervisor.status()).toEqual({
      status: "caught_up",
      completedStudyCount: 2
    });
  });

  it("rescans and includes a study committed during active work", async () => {
    const first = researchControlStudyFixture({ suffix: "rescan-first" });
    const added = researchControlStudyFixture({
      suffix: "rescan-added",
      committedAt: "2026-07-12T10:00:00.000Z"
    });
    const store = new MutableProcessStore([first]);
    const opened: string[] = [];
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async (study) => ({
        runner: completingRunner(study, store, {
          onStart() { opened.push(study.research_control_study_id); },
          onComplete() {
            if (study.research_control_study_id ===
                first.research_control_study_id) store.addStudy(added);
          }
        })
      })
    });

    supervisor.start();
    await supervisor.drain();

    expect(opened).toEqual([
      first.research_control_study_id,
      added.research_control_study_id
    ]);
  });

  it("returns already_running while one study is active", async () => {
    const study = researchControlStudyFixture({ suffix: "active" });
    const store = new MutableProcessStore([study]);
    const gate = deferred<void>();
    const started = deferred<void>();
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async () => ({
        runner: gatedCompletingRunner(study, store, gate, started)
      })
    });

    expect(supervisor.start()).toBe("started");
    await started.promise;
    expect(supervisor.start()).toBe("already_running");
    gate.resolve();
    await supervisor.drain();
  });

  it("stops after draining the active study and opens no later study", async () => {
    const first = researchControlStudyFixture({ suffix: "stop-first" });
    const second = researchControlStudyFixture({
      suffix: "stop-second",
      committedAt: "2026-07-12T10:00:00.000Z"
    });
    const store = new MutableProcessStore([first, second]);
    const opened: string[] = [];
    const started = deferred<void>();
    const stopped = deferred<void>();
    let runnerStatus: any = { status: "idle" };
    let stopCount = 0;
    const leaseSession = new ScriptedLeaseSession(executionLease(first));
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }),
      openStudy: async (study) => {
        opened.push(study.research_control_study_id);
        return {
          runner: {
            start() {
              runnerStatus = { status: "running", studyId: study.research_control_study_id };
              started.resolve();
            },
            async drain() { await stopped.promise; },
            async stop() {
              stopCount += 1;
              runnerStatus = { status: "stopped" };
              stopped.resolve();
            },
            status: () => structuredClone(runnerStatus)
          }
        };
      }
    });

    supervisor.start();
    await started.promise;
    await supervisor.stop();

    expect(stopCount).toBe(1);
    expect(opened).toEqual([first.research_control_study_id]);
    expect(leaseSession.releaseCount).toBe(1);
    expect(supervisor.status()).toEqual({
      status: "stopped",
      completedStudyCount: 0,
      studyId: first.research_control_study_id
    });
  });

  it("halts on a stable study-runner failure without skipping", async () => {
    const first = researchControlStudyFixture({ suffix: "fail-first" });
    const second = researchControlStudyFixture({ suffix: "fail-second" });
    const store = new MutableProcessStore([first, second]);
    const opened: string[] = [];
    const leaseSession = new ScriptedLeaseSession(executionLease(first));
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }),
      openStudy: async (study) => {
        opened.push(study.research_control_study_id);
        return { runner: failedRunner() };
      }
    });

    supervisor.start();
    await supervisor.drain();

    expect(opened).toEqual([first.research_control_study_id]);
    expect(leaseSession.releaseCount).toBe(1);
    expect(supervisor.status()).toMatchObject({
      status: "failed",
      studyId: first.research_control_study_id,
      errorCode: "research_control_study_executor_action_failed"
    });
  });

  it("fails closed when runtime opening fails", async () => {
    const study = researchControlStudyFixture({ suffix: "open-failure" });
    const leaseSession = new ScriptedLeaseSession(executionLease(study));
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: new MutableProcessStore([study]).port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }),
      openStudy: async () => { throw new Error("missing_runtime_dependency"); }
    });

    supervisor.start();
    await supervisor.drain();

    expect(supervisor.status()).toMatchObject({
      status: "failed",
      studyId: study.research_control_study_id,
      errorCode: "research_control_study_process_open_failed"
    });
    expect(leaseSession.releaseCount).toBe(1);
  });

  it("stops the active runner and fails stably when ownership is lost", async () => {
    const study = researchControlStudyFixture({ suffix: "lease-loss" });
    const store = new MutableProcessStore([study]);
    const leaseSession = new ScriptedLeaseSession(executionLease(study));
    const started = deferred<void>();
    const stopped = deferred<void>();
    let stopCount = 0;
    let runnerStatus: any = { status: "idle" };
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }),
      openStudy: async () => ({
        runner: {
          start() {
            runnerStatus = { status: "running", studyId: study.research_control_study_id };
            started.resolve();
          },
          async drain() { await stopped.promise; },
          async stop() {
            stopCount += 1;
            runnerStatus = { status: "stopped" };
            stopped.resolve();
          },
          status: () => structuredClone(runnerStatus)
        }
      })
    });
    supervisor.start();
    await started.promise;

    const loss = leaseSession.lose();
    await supervisor.drain();

    expect(stopCount).toBe(1);
    expect(leaseSession.releaseCount).toBe(1);
    expect(supervisor.status()).toMatchObject({
      status: "failed",
      studyId: study.research_control_study_id,
      errorCode: loss.code
    });
  });

  it("halts before later work when lease release fails", async () => {
    const first = researchControlStudyFixture({
      suffix: "release-fail-first",
      committedAt: "2026-07-12T08:00:00.000Z"
    });
    const second = researchControlStudyFixture({
      suffix: "release-fail-second",
      committedAt: "2026-07-12T09:00:00.000Z"
    });
    const store = new MutableProcessStore([first, second]);
    const leaseSession = new ScriptedLeaseSession(executionLease(first));
    leaseSession.releaseError = new ResearchControlStudyExecutionLeaseSessionError(
      "research_control_study_execution_lease_release_failed",
      "injected release failure"
    );
    const opened: string[] = [];
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      leaseSessionFactory: new ScriptedLeaseFactory({
        status: "acquired",
        session: leaseSession
      }),
      openStudy: async (study) => {
        opened.push(study.research_control_study_id);
        return { runner: completingRunner(study, store) };
      }
    });

    supervisor.start();
    await supervisor.drain();

    expect(opened).toEqual([first.research_control_study_id]);
    expect(leaseSession.releaseCount).toBe(1);
    expect(supervisor.status()).toMatchObject({
      status: "failed",
      studyId: first.research_control_study_id,
      errorCode: "research_control_study_execution_lease_release_failed"
    });
  });

  it("rejects runner completion without persisted study closure", async () => {
    const study = researchControlStudyFixture({ suffix: "missing-closure" });
    const store = new MutableProcessStore([study]);
    const supervisor = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async () => ({
        runner: completingRunner(study, store, { persistOutcome: false })
      })
    });

    supervisor.start();
    await supervisor.drain();

    expect(supervisor.status()).toMatchObject({
      status: "failed",
      studyId: study.research_control_study_id,
      errorCode: "research_control_study_process_persistence_conflict"
    });
  });

  it("reconstructs pending work in a new supervisor after failure", async () => {
    const study = researchControlStudyFixture({ suffix: "restart" });
    const store = new MutableProcessStore([study]);
    const failed = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async () => { throw new Error("first_process_failed"); }
    });
    failed.start();
    await failed.drain();

    const restarted = new ResearchControlStudyProcessSupervisor({
      store: store.port(),
      openStudy: async (pending) => ({
        runner: completingRunner(pending, store)
      })
    });
    restarted.start();
    await restarted.drain();

    expect(restarted.status()).toEqual({
      status: "caught_up",
      completedStudyCount: 1
    });
  });
});

class MutableProcessStore {
  constructor(
    private readonly studies: ResearchControlStudyRecord[],
    private readonly outcomes: ResearchControlStudyOutcomeRecord[] = []
  ) {}

  port(): Pick<
    OuroborosStorePort,
    "listResearchControlStudies" | "listResearchControlStudyOutcomes"
  > {
    return {
      listResearchControlStudies: async () => structuredClone(this.studies),
      listResearchControlStudyOutcomes: async () => structuredClone(this.outcomes)
    };
  }

  addStudy(study: ResearchControlStudyRecord): void {
    this.studies.push(structuredClone(study));
  }

  complete(study: ResearchControlStudyRecord): ResearchControlStudyOutcomeRecord {
    const outcome = researchControlStudyOutcomeFixture({ study });
    this.outcomes.push(outcome);
    return structuredClone(outcome);
  }
}

function completingRunner(
  study: ResearchControlStudyRecord,
  store: MutableProcessStore,
  options: {
    onStart?: () => void;
    onComplete?: () => void;
    persistOutcome?: boolean;
  } = {}
) {
  let status: any = { status: "idle" };
  return {
    start() {
      status = { status: "running", studyId: study.research_control_study_id };
      options.onStart?.();
    },
    async drain() {
      const outcome = options.persistOutcome === false
        ? researchControlStudyOutcomeFixture({ study })
        : store.complete(study);
      options.onComplete?.();
      status = {
        status: "completed",
        latestStep: { status: "complete", action: "complete", outcome }
      };
    },
    async stop() { status = { status: "stopped" }; },
    status: () => structuredClone(status)
  };
}

function gatedCompletingRunner(
  study: ResearchControlStudyRecord,
  store: MutableProcessStore,
  gate: ReturnType<typeof deferred<void>>,
  started: ReturnType<typeof deferred<void>>
) {
  let status: any = { status: "idle" };
  return {
    start() {
      status = { status: "running", studyId: study.research_control_study_id };
      started.resolve();
    },
    async drain() {
      await gate.promise;
      const outcome = store.complete(study);
      status = {
        status: "completed",
        latestStep: { status: "complete", action: "complete", outcome }
      };
    },
    async stop() { gate.resolve(); },
    status: () => structuredClone(status)
  };
}

function failedRunner() {
  let status: any = { status: "idle" };
  return {
    start() { status = { status: "running", studyId: "failed-study" }; },
    async drain() {
      status = {
        status: "failed",
        errorCode: "research_control_study_executor_action_failed",
        errorMessage: "injected study failure"
      };
    },
    async stop() {},
    status: () => structuredClone(status)
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

class ScriptedLeaseFactory
implements ResearchControlStudyExecutionLeaseSessionFactory {
  readonly studyIds: string[] = [];

  constructor(
    private readonly claim: ResearchControlStudyExecutionLeaseSessionClaim,
    private readonly events?: string[]
  ) {}

  async acquire(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyExecutionLeaseSessionClaim> {
    this.studyIds.push(study.research_control_study_id);
    this.events?.push("claim");
    return this.claim;
  }
}

class ScriptedLeaseSession
implements ResearchControlStudyExecutionLeaseSessionLifecycle {
  releaseCount = 0;
  releaseError?: ResearchControlStudyExecutionLeaseSessionError;
  private started = false;
  private callback?: (
    error: ResearchControlStudyExecutionLeaseSessionError
  ) => void;
  private loss?: ResearchControlStudyExecutionLeaseSessionError;
  private released?: ResearchControlStudyExecutionLeaseRecord;

  constructor(
    private readonly lease: ResearchControlStudyExecutionLeaseRecord,
    private readonly events?: string[]
  ) {}

  start(onLost: (
    error: ResearchControlStudyExecutionLeaseSessionError
  ) => void): "started" | "already_running" {
    if (this.started) return "already_running";
    this.started = true;
    this.callback = onLost;
    this.events?.push("session-start");
    return "started";
  }

  async guard(): Promise<void> {
    this.events?.push("guard");
    if (this.loss) throw this.loss;
  }

  async runFencedWrite<T>(write: () => Promise<T>): Promise<T> {
    if (this.loss) throw this.loss;
    return write();
  }

  async stopAndRelease(): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.releaseCount += 1;
    this.events?.push("release");
    if (this.loss) throw this.loss;
    if (this.releaseError) throw this.releaseError;
    this.released ??= closeResearchControlStudyExecutionLease({
      lease: this.lease,
      leaseStatus: "released",
      closedAt: this.lease.renewed_at
    });
    return this.released;
  }

  status(): ResearchControlStudyExecutionLeaseSessionStatus {
    if (this.loss) {
      return {
        status: "lost",
        lease: this.lease,
        errorCode: this.loss.code,
        errorMessage: this.loss.message
      };
    }
    if (this.released) return { status: "released", lease: this.released };
    return {
      status: this.started ? "renewing" : "acquired",
      lease: this.lease
    };
  }

  lose(): ResearchControlStudyExecutionLeaseSessionError {
    this.loss ??= new ResearchControlStudyExecutionLeaseSessionError(
      "research_control_study_execution_lease_lost",
      "injected lease loss"
    );
    this.callback?.(this.loss);
    return this.loss;
  }
}

function executionLease(
  study: ResearchControlStudyRecord
): ResearchControlStudyExecutionLeaseRecord {
  return decideResearchControlStudyExecutionLease({
    study,
    owner: {
      server_instance_id: "server-a",
      host_id: "host-a",
      process_id: 101,
      process_start_marker: "process-start-a"
    },
    leaseToken: `lease-${study.research_control_study_id}`,
    fencingToken: 1,
    leaseDurationMs: 30_000,
    acquiredAt: "2026-07-13T00:00:00.000Z"
  });
}
