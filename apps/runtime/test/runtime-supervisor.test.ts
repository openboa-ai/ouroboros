import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  closeRuntimeProcessOwnership,
  createRuntimeProcessOwnership,
  type RuntimeProcessOwnershipRecord,
  type RuntimeSupervisorCheckpointDraft,
  type RuntimeSupervisorCheckpointRecord,
  type RuntimeSupervisorLane
} from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort
} from "@ouroboros/application/ports/runtime-process-ownership";
import type { RuntimeSupervisorCheckpointStorePort } from
  "@ouroboros/application/ports/runtime-supervisor";
import {
  RuntimeSupervisor,
  type RuntimeSupervisorLaneAdapter
} from "../src/runtime-supervisor";

describe("RuntimeSupervisor", () => {
  it("recovers the three lanes in dependency order and starts idempotently", async () => {
    const events: string[] = [];
    const harness = createHarness(events);

    expect(await harness.supervisor.start()).toBe("started");
    expect(await harness.supervisor.start()).toBe("already_running");

    expect(events.filter((event) => event.startsWith("recover:"))).toEqual([
      "recover:selected_paper",
      "recover:candidate_arena",
      "recover:research_control_study_scheduler"
    ]);
    expect(harness.supervisor.status()).toMatchObject({
      status: "running",
      lanes: [
        { lane: "selected_paper", status: "running", desired: true },
        { lane: "candidate_arena", status: "running", desired: true },
        {
          lane: "research_control_study_scheduler",
          status: "running",
          desired: true
        }
      ],
      runtime_coordination_authority: true,
      evaluation_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
    expect(harness.ownership.claimCount).toBe(1);

    await harness.supervisor.stop();
  });

  it("does not repeat recovery effects while desired lanes remain satisfied", async () => {
    const events: string[] = [];
    const harness = createHarness(events);

    await harness.supervisor.start();
    await harness.supervisor.reconcile();

    expect(events.filter((event) => event.startsWith("recover:"))).toEqual([
      "recover:selected_paper",
      "recover:candidate_arena",
      "recover:research_control_study_scheduler"
    ]);
    await harness.supervisor.stop();
  });

  it("retries one transient failure and resets counters after success", async () => {
    const clock = new TestClock();
    const events: string[] = [];
    const paper = new ScriptedLane("selected_paper", events);
    paper.failures.push(new CodedError("paper_provider_unavailable"));
    const harness = createHarness(events, {
      clock,
      lanes: [
        paper,
        new ScriptedLane("candidate_arena", events, false),
        new ScriptedLane("research_control_study_scheduler", events, false)
      ],
      retryDelaysMs: [1_000]
    });

    await harness.supervisor.start();
    expect(harness.supervisor.status()).toMatchObject({
      status: "degraded",
      lanes: expect.arrayContaining([expect.objectContaining({
        lane: "selected_paper",
        status: "degraded",
        attempt_count: 1,
        no_progress_count: 1,
        next_retry_at: "2026-07-16T00:00:01.000Z",
        reason_code: "paper_provider_unavailable"
      })])
    });

    clock.advance(1_000);
    await harness.supervisor.reconcile();

    expect(paper.recoverCount).toBe(2);
    expect(harness.supervisor.status()).toMatchObject({
      status: "running",
      lanes: expect.arrayContaining([expect.objectContaining({
        lane: "selected_paper",
        status: "running",
        attempt_count: 0,
        no_progress_count: 0
      })])
    });
    await harness.supervisor.stop();
  });

  it("keeps exhausted no-progress work blocked until its basis changes", async () => {
    const clock = new TestClock();
    const events: string[] = [];
    const paper = new ScriptedLane("selected_paper", events);
    paper.progressDigestAfterBlock = digest("selected-paper-stopped-progress");
    paper.failures.push(
      new CodedError("paper_sandbox_unavailable"),
      new CodedError("paper_sandbox_unavailable")
    );
    const harness = createHarness(events, {
      clock,
      lanes: [
        paper,
        new ScriptedLane("candidate_arena", events, false),
        new ScriptedLane("research_control_study_scheduler", events, false)
      ],
      retryDelaysMs: [1_000]
    });

    await harness.supervisor.start();
    clock.advance(1_000);
    await harness.supervisor.reconcile();
    expect(harness.supervisor.status()).toMatchObject({
      status: "blocked",
      lanes: expect.arrayContaining([expect.objectContaining({
        lane: "selected_paper",
        status: "blocked",
        no_progress_count: 2,
        reason_code: "paper_sandbox_unavailable"
      })])
    });
    expect(paper.blockCount).toBe(1);

    clock.advance(60_000);
    await harness.supervisor.reconcile();
    expect(paper.recoverCount).toBe(2);

    paper.basisDigest = digest("selected-paper-repaired-basis");
    await harness.supervisor.reconcile();
    expect(paper.recoverCount).toBe(3);
    expect(harness.supervisor.status().status).toBe("running");
    await harness.supervisor.stop();
  });

  it("does not stop a healthy selected-paper lane when research is blocked", async () => {
    const events: string[] = [];
    const paper = new ScriptedLane("selected_paper", events);
    const research = new ScriptedLane(
      "research_control_study_scheduler",
      events
    );
    research.failures.push(new CodedError("research_graph_invalid"));
    const harness = createHarness(events, {
      lanes: [
        paper,
        new ScriptedLane("candidate_arena", events, false),
        research
      ],
      retryDelaysMs: []
    });

    await harness.supervisor.start();

    expect(harness.supervisor.status()).toMatchObject({
      status: "blocked",
      lanes: [
        expect.objectContaining({ lane: "selected_paper", status: "running" }),
        expect.anything(),
        expect.objectContaining({
          lane: "research_control_study_scheduler",
          status: "blocked"
        })
      ]
    });
    expect(paper.stopCount).toBe(0);
    expect(research.blockCount).toBe(1);
    await harness.supervisor.stop();
  });

  it("isolates lane inspection failure without aborting healthy dependencies", async () => {
    const events: string[] = [];
    const paper = new ScriptedLane("selected_paper", events);
    const research = new ScriptedLane(
      "research_control_study_scheduler",
      events
    );
    research.inspectFailures.push(new CodedError("research_store_unavailable"));
    const harness = createHarness(events, {
      lanes: [
        paper,
        new ScriptedLane("candidate_arena", events, false),
        research
      ],
      retryDelaysMs: []
    });

    await expect(harness.supervisor.start()).resolves.toBe("started");

    expect(paper.recoverCount).toBe(1);
    expect(harness.supervisor.status()).toMatchObject({
      status: "blocked",
      lanes: [
        expect.objectContaining({ lane: "selected_paper", status: "running" }),
        expect.anything(),
        expect.objectContaining({
          lane: "research_control_study_scheduler",
          status: "blocked",
          reason_code: "research_store_unavailable"
        })
      ]
    });
    await harness.supervisor.stop();
  });

  it("stops in reverse dependency order and closes current-process ownership", async () => {
    const events: string[] = [];
    const harness = createHarness(events);
    await harness.supervisor.start();
    events.length = 0;

    await harness.supervisor.stop();

    expect(events).toEqual([
      "stop:research_control_study_scheduler",
      "stop:candidate_arena",
      "stop:selected_paper",
      "ownership:close"
    ]);
    expect(harness.supervisor.status().status).toBe("stopped");
    expect(harness.ownership.closed?.terminal_reason).toBe("shutdown");
  });

  it("fails before lane effects when current-process ownership is held", async () => {
    const events: string[] = [];
    const ownership = new RecordingOwnership(events);
    ownership.claimError = new CodedError("runtime_process_ownership_held");
    const harness = createHarness(events, { ownership });

    await expect(harness.supervisor.start()).rejects.toMatchObject({
      code: "runtime_process_ownership_held"
    });
    expect(events.filter((event) => event.startsWith("recover:"))).toEqual([]);
    expect(harness.checkpoints.records).toEqual([]);
  });

  it("drains recovered lanes before releasing ownership when startup publication fails", async () => {
    const events: string[] = [];
    const checkpoints = new MemoryCheckpointStore();
    checkpoints.failAppendAt = 2;
    const harness = createHarness(events, { checkpoints });

    await expect(harness.supervisor.start()).rejects.toMatchObject({
      code: "runtime_supervisor_checkpoint_write_failed"
    });

    expect(events).toEqual([
      "recover:selected_paper",
      "recover:candidate_arena",
      "recover:research_control_study_scheduler",
      "stop:research_control_study_scheduler",
      "stop:candidate_arena",
      "stop:selected_paper",
      "ownership:close"
    ]);
    expect(harness.ownership.closed?.terminal_reason).toBe("shutdown");
  });

  it("retains ownership when failed-start cleanup cannot drain every lane", async () => {
    const events: string[] = [];
    const checkpoints = new MemoryCheckpointStore();
    checkpoints.failAppendAt = 2;
    const scheduler = new ScriptedLane(
      "research_control_study_scheduler",
      events
    );
    scheduler.stopFailures.push(new CodedError("scheduler_shutdown_failed"));
    const harness = createHarness(events, {
      checkpoints,
      lanes: [
        new ScriptedLane("selected_paper", events),
        new ScriptedLane("candidate_arena", events),
        scheduler
      ]
    });

    await expect(harness.supervisor.start()).rejects.toMatchObject({
      code: "runtime_supervisor_shutdown_failed"
    });

    expect(events).toEqual([
      "recover:selected_paper",
      "recover:candidate_arena",
      "recover:research_control_study_scheduler",
      "stop:research_control_study_scheduler",
      "stop:candidate_arena",
      "stop:selected_paper"
    ]);
    expect(harness.ownership.closed).toBeUndefined();

    await harness.supervisor.stop();
    expect(harness.ownership.closed?.terminal_reason).toBe("shutdown");
  });

  it("keeps retained ownership recoverable after checkpoint load cleanup fails", async () => {
    const events: string[] = [];
    const checkpoints = new MemoryCheckpointStore();
    checkpoints.latestError = new CodedError(
      "runtime_supervisor_checkpoint_metadata_invalid"
    );
    const scheduler = new ScriptedLane(
      "research_control_study_scheduler",
      events
    );
    scheduler.stopFailures.push(new CodedError("scheduler_shutdown_failed"));
    const harness = createHarness(events, {
      checkpoints,
      lanes: [
        new ScriptedLane("selected_paper", events),
        new ScriptedLane("candidate_arena", events),
        scheduler
      ]
    });

    await expect(harness.supervisor.start()).rejects.toMatchObject({
      code: "runtime_supervisor_shutdown_failed"
    });
    expect(harness.ownership.closed).toBeUndefined();

    checkpoints.latestError = undefined;
    await harness.supervisor.stop();
    expect(harness.ownership.closed?.terminal_reason).toBe("shutdown");
  });
});

function createHarness(
  events: string[],
  options: {
    clock?: TestClock;
    lanes?: RuntimeSupervisorLaneAdapter[];
    retryDelaysMs?: readonly number[];
    ownership?: RecordingOwnership;
    checkpoints?: MemoryCheckpointStore;
  } = {}
) {
  const clock = options.clock ?? new TestClock();
  const checkpoints = options.checkpoints ?? new MemoryCheckpointStore();
  const ownership = options.ownership ?? new RecordingOwnership(events);
  const lanes = options.lanes ?? [
    new ScriptedLane("selected_paper", events),
    new ScriptedLane("candidate_arena", events),
    new ScriptedLane("research_control_study_scheduler", events)
  ];
  const supervisor = new RuntimeSupervisor({
    lanes,
    checkpoints,
    processOwnership: ownership,
    processIdentity: processIdentity(),
    processId: 4242,
    sessionToken: () => "runtime-supervisor-session",
    now: clock.now,
    retryDelaysMs: options.retryDelaysMs ?? [1_000, 5_000],
    monitorIntervalMs: 1_000_000_000
  });
  return { supervisor, checkpoints, ownership, lanes, clock };
}

class ScriptedLane implements RuntimeSupervisorLaneAdapter {
  readonly failures: Error[] = [];
  readonly inspectFailures: Error[] = [];
  readonly stopFailures: Error[] = [];
  basisDigest: string;
  progressDigest: string;
  progressDigestAfterBlock?: string;
  recoverCount = 0;
  stopCount = 0;
  blockCount = 0;
  private satisfied: boolean;

  constructor(
    readonly lane: RuntimeSupervisorLane,
    private readonly events: string[],
    readonly desired = true
  ) {
    this.basisDigest = digest(`${lane}-basis`);
    this.progressDigest = digest(`${lane}-progress`);
    this.satisfied = !desired;
  }

  async inspect() {
    const failure = this.inspectFailures.shift();
    if (failure) throw failure;
    return {
      desired: this.desired,
      satisfied: this.satisfied,
      basisDigest: this.basisDigest,
      progressDigest: this.progressDigest,
      ...(!this.desired ? { reasonCode: "not_requested" } : {})
    };
  }

  async recover(): Promise<void> {
    this.recoverCount += 1;
    this.events.push(`recover:${this.lane}`);
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.satisfied = true;
  }

  async block(): Promise<void> {
    this.blockCount += 1;
    this.events.push(`block:${this.lane}`);
    if (this.progressDigestAfterBlock) {
      this.progressDigest = this.progressDigestAfterBlock;
    }
  }

  async stop(): Promise<void> {
    this.stopCount += 1;
    this.events.push(`stop:${this.lane}`);
    const failure = this.stopFailures.shift();
    if (failure) throw failure;
  }
}

class MemoryCheckpointStore implements RuntimeSupervisorCheckpointStorePort {
  readonly records: RuntimeSupervisorCheckpointRecord[] = [];
  failAppendAt?: number;
  latestError?: Error;
  private appendCount = 0;

  async latest() {
    if (this.latestError) throw this.latestError;
    return structuredClone(this.records.at(-1));
  }

  async history() {
    return structuredClone(this.records);
  }

  async append(
    draft: RuntimeSupervisorCheckpointDraft,
    expectedPreviousDigest?: string
  ) {
    this.appendCount += 1;
    if (this.appendCount === this.failAppendAt) {
      throw new CodedError("runtime_supervisor_checkpoint_write_failed");
    }
    const previous = this.records.at(-1);
    if (previous?.checkpoint_digest !== expectedPreviousDigest) {
      throw new CodedError("runtime_supervisor_checkpoint_predecessor_conflict");
    }
    const sequence = this.records.length + 1;
    const checkpoint: RuntimeSupervisorCheckpointRecord = {
      record_kind: "runtime_supervisor_checkpoint",
      version: 1,
      sequence,
      ...(previous
        ? { previous_checkpoint_digest: previous.checkpoint_digest }
        : {}),
      status: draft.status,
      lanes: structuredClone(draft.lanes),
      recorded_at: draft.recorded_at,
      checkpoint_digest: digest(JSON.stringify({ sequence, draft })),
      runtime_coordination_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    };
    this.records.push(checkpoint);
    return structuredClone(checkpoint);
  }
}

class RecordingOwnership implements Pick<RuntimeProcessOwnershipPort, "claim" | "close"> {
  claimCount = 0;
  claimError?: Error;
  closed?: RuntimeProcessOwnershipRecord;

  constructor(private readonly events: string[]) {}

  async claim(input: Parameters<RuntimeProcessOwnershipPort["claim"]>[0]) {
    this.claimCount += 1;
    if (this.claimError) throw this.claimError;
    return createRuntimeProcessOwnership({
      processKind: input.expected.process_kind,
      subjectRef: input.expected.subject_ref,
      runtimeRef: input.expected.runtime_ref,
      owner: {
        host_id: input.expected.host_id,
        process_id: input.processId,
        process_start_marker: "test-process-start"
      },
      executable: input.expected.executable,
      profileDigest: input.expected.profile_digest,
      sessionToken: input.sessionToken,
      startedAt: input.startedAt
    });
  }

  async close(input: Parameters<RuntimeProcessOwnershipPort["close"]>[0]) {
    this.events.push("ownership:close");
    this.closed = closeRuntimeProcessOwnership({
      ownership: input.ownership,
      terminalReason: input.terminalReason,
      closedAt: input.closedAt
    });
    return this.closed;
  }
}

class TestClock {
  private epoch = Date.parse("2026-07-16T00:00:00.000Z");
  readonly now = () => new Date(this.epoch).toISOString();

  advance(milliseconds: number): void {
    this.epoch += milliseconds;
  }
}

class CodedError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function processIdentity(): RuntimeProcessExpectedIdentity {
  return {
    process_kind: "runtime_supervisor",
    subject_ref: {
      record_kind: "runtime_supervisor",
      id: "runtime-supervisor-test-store"
    },
    runtime_ref: { record_kind: "local_store", id: "test-store" },
    host_id: "test-host",
    executable: "/usr/local/bin/node",
    profile_digest: digest("runtime-supervisor-profile")
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
