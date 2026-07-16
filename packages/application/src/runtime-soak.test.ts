import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RuntimeSoakHarness,
  createRuntimeSoakEvent,
  createRuntimeSoakManifest,
  evaluateRuntimeSoakInvariants,
  parseRuntimeSoakSample,
  validateRuntimeSoakScenario,
  type RuntimeSoakAction,
  type RuntimeSoakControlEvidence,
  type RuntimeSoakEvent,
  type RuntimeSoakEventDraft,
  type RuntimeSoakJournalPort,
  type RuntimeSoakManifest,
  type RuntimeSoakSample,
  type RuntimeSoakScenario,
  type RuntimeSoakTargetPort
} from "./runtime-soak";

const START = Date.parse("2026-07-16T00:00:00.000Z");

describe("RuntimeSoakHarness", () => {
  it("executes every required fault and recovery before passing terminal cleanup", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock);
    const result = await harness({ clock, journal, target }).run();

    expect(result.classification).toBe("passed");
    expect(target.actions.map((action) => action.kind)).toEqual(
      healthyScenario().actions.map((action) => action.kind)
    );
    expect((await journal.history()).at(-1)?.payload).toMatchObject({
      event_type: "terminal",
      classification: "passed"
    });
  });

  it("keeps the first invariant failure terminal after the target later recovers", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock, () => ({
      ...healthySample(clock.now()),
      effects: [{ effect_id: "duplicate-effect", occurrence_count: 2 }]
    }));
    const first = await harness({ clock, journal, target }).run();
    target.sampleFactory = () => healthySample(clock.now());
    const callsAfterFailure = target.sampleCount;
    const replay = await harness({ clock, journal, target }).run();

    expect(first).toMatchObject({
      classification: "invariant_failed",
      reason_code: "no_duplicate_effects",
      failure: { subject: "duplicate-effect" }
    });
    expect(replay).toEqual(first);
    expect(target.sampleCount).toBe(callsAfterFailure);
    expect(target.actions).toHaveLength(0);
  });

  it("classifies a target control error without running later actions", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock);
    target.failAction = "crash";
    const result = await harness({ clock, journal, target }).run();

    expect(result).toMatchObject({
      classification: "target_failed",
      reason_code: "target_action_failed:crash-runtime"
    });
    expect(target.actions.map((action) => action.action_id)).toEqual([
      "clean-restart",
      "crash-runtime"
    ]);
  });

  it("classifies duration exhaustion from the original wall-clock start", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock, () => {
      clock.advance(1_001);
      return healthySample(clock.now());
    });
    const result = await harness({ clock, journal, target }).run();

    expect(result).toMatchObject({
      classification: "duration_exhausted",
      reason_code: "scenario_duration_exhausted"
    });
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(1_001);
    expect(target.actions).toHaveLength(0);
  });

  it("classifies duration exhaustion when the terminal probe crosses the wall-clock bound", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    let target!: FakeTarget;
    target = new FakeTarget(clock, () => {
      if (target.terminal) clock.advance(1_000);
      return healthySample(clock.now(), target.terminal);
    });

    const result = await harness({ clock, journal, target }).run();

    expect(result).toMatchObject({
      classification: "duration_exhausted",
      reason_code: "scenario_duration_exhausted"
    });
    expect(target.actions.at(-1)?.kind).toBe("terminal_cleanup");
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(1_110);
  });

  it("derives each event timestamp and elapsed value from one clock reading", async () => {
    let epoch = START;
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock);
    const result = await new RuntimeSoakHarness({
      scenario: healthyScenario(),
      journal,
      target,
      now: () => new Date(epoch++).toISOString(),
      sleep: async (delayMs) => { epoch += delayMs; }
    }).run();
    const events = await journal.history();
    const startedAt = Date.parse(events[0]!.recorded_at);

    expect(result.classification).toBe("passed");
    for (const event of events) {
      expect(event.elapsed_ms).toBe(Date.parse(event.recorded_at) - startedAt);
    }
  });

  it("resumes one report without replaying completed actions or elapsed time", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const target = new FakeTarget(clock);
    let interrupted = false;
    const first = harness({
      clock,
      journal,
      target,
      sleep: async (delayMs) => {
        clock.advance(Math.min(delayMs, 5));
        if (!interrupted) {
          interrupted = true;
          throw new Error("simulated_harness_restart");
        }
      }
    });

    await expect(first.run()).rejects.toThrow("simulated_harness_restart");
    expect(target.actions.map((action) => action.action_id)).toEqual(["clean-restart"]);
    const result = await harness({ clock, journal, target }).run();

    expect(result.classification).toBe("passed");
    expect(result.elapsed_ms).toBeGreaterThanOrEqual(110);
    expect(target.actions.filter((action) => action.action_id === "clean-restart"))
      .toHaveLength(1);
    const samples = (await journal.history()).filter((event) =>
      event.payload.event_type === "sample_recorded"
    );
    expect(samples.length).toBeGreaterThan(healthyScenario().actions.length);
  });

  it("fails closed instead of replaying an ambiguous in-flight action", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const scenario = healthyScenario();
    const manifest = createRuntimeSoakManifest(scenario);
    await journal.initialize(manifest);
    const started = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: {
        event_type: "action_started",
        action_id: scenario.actions[0]!.action_id,
        action_kind: scenario.actions[0]!.kind
      }
    }, started.event_digest);
    const target = new FakeTarget(clock);
    const result = await harness({ clock, journal, target }).run();

    expect(result).toMatchObject({
      classification: "target_failed",
      reason_code: "ambiguous_incomplete_action:clean-restart"
    });
    expect(target.actions).toHaveLength(0);
  });

  it("records the missing post-action sample before executing another due action", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const scenario = healthyScenario();
    const manifest = createRuntimeSoakManifest(scenario);
    await journal.initialize(manifest);
    let previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "sample_recorded", terminal: false, sample: healthySample(clock.now()) }
    }, previous.event_digest);
    const action = scenario.actions[0]!;
    previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "action_started", action_id: action.action_id, action_kind: action.kind }
    }, previous.event_digest);
    await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: {
        event_type: "action_completed",
        action_id: action.action_id,
        action_kind: action.kind,
        evidence_digest: digest(`control:${action.action_id}`)
      }
    }, previous.event_digest);
    clock.advance(15);
    const target = new FakeTarget(clock);

    const result = await harness({ clock, journal, target }).run();
    const resumedEvents = (await journal.history()).slice(4);

    expect(result.classification).toBe("passed");
    expect(resumedEvents[0]?.payload.event_type).toBe("sample_recorded");
    expect(target.actions.some((executed) => executed.action_id === action.action_id)).toBe(false);
  });

  it("restores a recorded invariant failure when restart preceded terminal publication", async () => {
    const clock = new FakeClock();
    const journal = new MemoryJournal();
    const scenario = healthyScenario();
    const manifest = createRuntimeSoakManifest(scenario);
    await journal.initialize(manifest);
    let previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "sample_recorded", terminal: false, sample: healthySample(clock.now()) }
    }, previous.event_digest);
    const action = scenario.actions[0]!;
    previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "action_started", action_id: action.action_id, action_kind: action.kind }
    }, previous.event_digest);
    previous = await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: {
        event_type: "action_completed",
        action_id: action.action_id,
        action_kind: action.kind,
        evidence_digest: digest(`control:${action.action_id}`)
      }
    }, previous.event_digest);
    const failedSample = healthySample(clock.now());
    failedSample.effects[0]!.occurrence_count = 2;
    await journal.append({
      run_id: scenario.run_id,
      recorded_at: clock.now(),
      elapsed_ms: 0,
      payload: { event_type: "sample_recorded", terminal: false, sample: failedSample }
    }, previous.event_digest);
    const target = new FakeTarget(clock);

    const result = await harness({ clock, journal, target }).run();

    expect(result).toMatchObject({
      classification: "invariant_failed",
      reason_code: "no_duplicate_effects",
      failure: { subject: "effect-001" }
    });
    expect(target.actions).toHaveLength(0);
    expect(target.sampleCount).toBe(0);
  });
});

describe("RuntimeSoak invariants", () => {
  it.each([
    ["no_duplicate_effects", (sample: RuntimeSoakSample) => {
      sample.effects[0]!.occurrence_count = 2;
    }],
    ["contiguous_chains", (sample: RuntimeSoakSample) => {
      sample.chains[0]!.entries[1]!.sequence = 3;
    }],
    ["exact_ownership", (sample: RuntimeSoakSample) => {
      sample.ownership[0]!.active_owner_count = 2;
    }],
    ["bounded_retries", (sample: RuntimeSoakSample) => {
      sample.retries[0]!.no_progress_count = 4;
    }],
    ["no_order_continuity", (sample: RuntimeSoakSample) => {
      sample.paper_observations[0]!.entries[0]!.no_order_recorded = false;
    }],
    ["egress_attestation", (sample: RuntimeSoakSample) => {
      sample.sandboxes[0]!.lifecycle_status = "running";
      sample.sandboxes[0]!.egress_attestation_status = "missing";
    }],
    ["terminal_cleanup", (sample: RuntimeSoakSample) => {
      sample.resources[0]!.status = "active";
    }]
  ] as const)("returns the first %s failure", (kind, mutate) => {
    const sample = healthySample("2026-07-16T00:00:00.000Z", true);
    mutate(sample);
    expect(evaluateRuntimeSoakInvariants(sample, { terminal: true })).toMatchObject({ kind });
  });

  it("rejects malformed probe output instead of inferring healthy state", () => {
    expect(() => parseRuntimeSoakSample({
      version: 1,
      sampled_at: "2026-07-16T00:00:00.000Z"
    })).toThrowError(expect.objectContaining({ code: "runtime_soak_sample_invalid" }));
  });

  it("constructs a canonical sample without unknown probe fields", () => {
    const expected = healthySample("2026-07-16T00:00:00.000Z");
    const parsed = parseRuntimeSoakSample({
      ...expected,
      debug_environment: { API_TOKEN: "must-not-persist" },
      effects: expected.effects.map((effect) => ({
        ...effect,
        debug_output: "must-not-persist"
      })),
      chains: expected.chains.map((chain) => ({
        ...chain,
        entries: chain.entries.map((entry) => ({ ...entry, raw_line: "must-not-persist" }))
      }))
    });

    expect(parsed).toEqual(expected);
    expect(JSON.stringify(parsed)).not.toContain("must-not-persist");
  });

  it("requires an absent identity when an ownership scope has no active owner", () => {
    const sample = healthySample("2026-07-16T00:00:00.000Z", true);
    sample.ownership[0]!.identity_status = "unknown";
    expect(evaluateRuntimeSoakInvariants(sample, { terminal: true })).toMatchObject({
      kind: "exact_ownership"
    });
  });
});

describe("RuntimeSoakScenario", () => {
  it("requires exact recovery coverage and terminal cleanup ordering", () => {
    const scenario = healthyScenario();
    scenario.actions = scenario.actions.filter((action) => action.recovers !== "gateway");
    expect(() => validateRuntimeSoakScenario(scenario)).toThrowError(expect.objectContaining({
      code: "runtime_soak_scenario_invalid"
    }));
  });
});

function harness(input: {
  clock: FakeClock;
  journal: RuntimeSoakJournalPort;
  target: RuntimeSoakTargetPort;
  sleep?: (delayMs: number) => Promise<void>;
}) {
  return new RuntimeSoakHarness({
    scenario: healthyScenario(),
    journal: input.journal,
    target: input.target,
    now: () => input.clock.now(),
    sleep: input.sleep ?? (async (delayMs) => input.clock.advance(delayMs))
  });
}

function healthyScenario(): RuntimeSoakScenario {
  const actions: RuntimeSoakAction[] = [
    { action_id: "clean-restart", kind: "clean_restart", at_ms: 0 },
    { action_id: "crash-runtime", kind: "crash", at_ms: 10 },
    { action_id: "recover-runtime", kind: "recovery", recovers: "runtime", at_ms: 20 },
    { action_id: "delay-cleanup", kind: "delayed_cleanup", at_ms: 30 },
    { action_id: "recover-cleanup", kind: "recovery", recovers: "cleanup", at_ms: 40 },
    { action_id: "lose-provider", kind: "provider_loss", at_ms: 50 },
    { action_id: "recover-provider", kind: "recovery", recovers: "provider", at_ms: 60 },
    { action_id: "lose-sandbox", kind: "sandbox_loss", at_ms: 70 },
    { action_id: "recover-sandbox", kind: "recovery", recovers: "sandbox", at_ms: 80 },
    { action_id: "lose-gateway", kind: "gateway_unavailable", at_ms: 90 },
    { action_id: "recover-gateway", kind: "recovery", recovers: "gateway", at_ms: 100 },
    { action_id: "terminal-cleanup", kind: "terminal_cleanup", at_ms: 110 }
  ];
  return {
    version: 1,
    run_id: "runtime-soak-001",
    duration_ms: 1_000,
    sample_interval_ms: 100,
    actions
  };
}

function healthySample(sampledAt: string, terminal = false): RuntimeSoakSample {
  const firstDigest = digest("ledger-1");
  return {
    version: 1,
    sampled_at: sampledAt,
    effects: [{ effect_id: "effect-001", occurrence_count: 1 }],
    chains: [{
      chain_id: "ledger-run-001",
      chain_kind: "ledger",
      entries: [
        { sequence: 1, digest: firstDigest },
        { sequence: 2, digest: digest("ledger-2"), previous_digest: firstDigest }
      ]
    }],
    ownership: [{
      scope: "runtime-supervisor:store-001",
      active_owner_count: terminal ? 0 : 1,
      identity_status: terminal ? "absent" : "exact"
    }],
    retries: [{
      lane: "candidate_arena",
      attempt_count: 0,
      no_progress_count: 0,
      retry_budget: 3,
      status: terminal ? "stopped" : "running"
    }],
    paper_observations: [{
      stream_id: "paper-evaluation-001",
      entries: [{
        sequence: 1,
        emitted_order_request_count: 0,
        no_order_recorded: true
      }]
    }],
    sandboxes: [{
      sandbox_id: "sandbox-001",
      provider_generated: true,
      lifecycle_status: terminal ? "removed" : "running",
      egress_attestation_version: 2,
      egress_attestation_status: "verified"
    }],
    resources: [{
      resource_id: "runtime-001",
      resource_kind: "process",
      status: terminal ? "terminal" : "active"
    }]
  };
}

class FakeClock {
  private epoch = START;
  now() { return new Date(this.epoch).toISOString(); }
  advance(milliseconds: number) { this.epoch += milliseconds; }
}

class FakeTarget implements RuntimeSoakTargetPort {
  readonly actions: RuntimeSoakAction[] = [];
  sampleCount = 0;
  terminal = false;
  failAction?: RuntimeSoakAction["kind"];

  constructor(
    private readonly clock: FakeClock,
    public sampleFactory: () => unknown = () => healthySample(clock.now(), this.terminal)
  ) {}

  async execute(action: RuntimeSoakAction): Promise<RuntimeSoakControlEvidence> {
    this.actions.push(structuredClone(action));
    if (action.kind === this.failAction) throw new Error(`injected_${action.kind}`);
    if (action.kind === "terminal_cleanup") this.terminal = true;
    return { evidence_digest: digest(`control:${action.action_id}`) };
  }

  async sample(): Promise<unknown> {
    this.sampleCount += 1;
    return this.sampleFactory();
  }
}

class MemoryJournal implements RuntimeSoakJournalPort {
  private manifest?: RuntimeSoakManifest;
  private readonly events: RuntimeSoakEvent[] = [];

  async initialize(manifest: RuntimeSoakManifest): Promise<RuntimeSoakManifest> {
    if (this.manifest && this.manifest.scenario_digest !== manifest.scenario_digest) {
      throw new Error("manifest_mismatch");
    }
    this.manifest ??= structuredClone(manifest);
    return structuredClone(this.manifest);
  }

  async history(): Promise<RuntimeSoakEvent[]> {
    return structuredClone(this.events);
  }

  async append(
    draft: RuntimeSoakEventDraft,
    expectedPreviousDigest?: string
  ): Promise<RuntimeSoakEvent> {
    const previous = this.events.at(-1);
    if (previous?.event_digest !== expectedPreviousDigest) {
      throw new Error("predecessor_conflict");
    }
    const event = createRuntimeSoakEvent(draft, this.events.length + 1, previous);
    this.events.push(event);
    return structuredClone(event);
  }
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
