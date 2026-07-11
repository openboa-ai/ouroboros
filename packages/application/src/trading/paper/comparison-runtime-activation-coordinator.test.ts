import { createHash } from "node:crypto";
import {
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonActivationSideResultHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonActivationSideResultRecord,
  type PaperTradingComparisonRuntimeWriteContext,
  type PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type {
  PaperTradingComparisonSessionPort,
  PaperTradingComparisonSessionSideStatus
} from "../../ports/paper-comparison-session";
import type { OuroborosStorePort } from "../../ports/store";
import { paperTradingMarketDataConfigurationDigest } from "./commitment";
import {
  PaperTradingComparisonRuntimeActivationCoordinator
} from "./comparison-runtime-activation-coordinator";

describe("PaperTradingComparisonRuntimeActivationCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists intent before starting both sides in parallel against one fixed view", async () => {
    const fixture = runtimeActivationFixture();

    const result = await fixture.coordinator.start(fixture.input);

    expect(fixture.events.slice(0, 3)).toEqual([
      "attempt:recorded",
      "start:champion",
      "start:challenger"
    ]);
    expect(fixture.maximumStartsInFlight).toBe(2);
    expect(fixture.startInputs).toHaveLength(2);
    expect(fixture.startInputs[0]?.marketData).toBe(fixture.startInputs[1]?.marketData);
    const { authority_status: _authorityStatus, ...expectedMarket } =
      fixture.tick.market_snapshot;
    await expect(fixture.startInputs[0]!.marketData.readMarketSnapshot()).resolves
      .toMatchObject(expectedMarket);
    expect(fixture.source.readMarketSnapshot).not.toHaveBeenCalled();
    for (const start of fixture.startInputs) {
      expect(start.authority).toEqual(runtimeContext(
        fixture.attempts[0]!,
        start.side.role,
        "start"
      ));
      expect(start.deadlineAt).toBe(fixture.attempts[0]!.start_deadline_at);
      expect(start.maximumProviderRequestCount).toBe(5);
    }
    expect(fixture.attempts).toHaveLength(1);
    expect(paperTradingComparisonActivationAttemptHasRuntimeShape(
      fixture.attempts[0]
    )).toBe(true);
    expect(fixture.results.map((record) => [record.role, record.operation, record.outcome]))
      .toEqual([
        ["champion", "start", "succeeded"],
        ["challenger", "start", "succeeded"]
      ]);
    expect(fixture.results.every(
      paperTradingComparisonActivationSideResultHasRuntimeShape
    )).toBe(true);
    expect(result.status).toBe("both_running");
    expect(result.outcome).toMatchObject({
      outcome_status: "both_running",
      outcome_reason: "started_within_policy",
      next_action: "capture_first_paired_checkpoint"
    });
    expect(paperTradingComparisonActivationOutcomeHasRuntimeShape(result.outcome)).toBe(true);
    expect(result.marketDataView).toBe(fixture.startInputs[0]?.marketData);
    expect(fixture.stopInputs).toEqual([]);
  });

  it("stops both sides and records stopped-cleanly after a one-sided start failure", async () => {
    const fixture = runtimeActivationFixture({ startFailureRole: "challenger" });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_status: "stopped_cleanly",
        outcome_reason: "start_failed",
        next_action: "retry_activation"
      }
    });
    expect(fixture.stopInputs.map((input) => input.side.role).sort())
      .toEqual(["challenger", "champion"]);
    expect(fixture.results.map((record) => [record.role, record.operation, record.outcome]))
      .toEqual([
        ["champion", "start", "succeeded"],
        ["challenger", "start", "failed"],
        ["champion", "stop", "succeeded"],
        ["challenger", "stop", "not_running"]
      ]);
    expect(fixture.attempts).toHaveLength(1);
  });

  it("times out without losing a late settlement and cleans the late side again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-11T00:00:02.000Z");
    const late = deferred<PaperTradingComparisonSessionSideStatus>();
    const fixture = runtimeActivationFixture({
      now: () => new Date(Date.now()).toISOString(),
      lateStart: { role: "challenger", result: late.promise }
    });

    const pending = fixture.coordinator.start(fixture.input);
    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;

    expect(result).toMatchObject({
      status: "cleanup_required",
      outcome: {
        outcome_status: "cleanup_required",
        outcome_reason: "start_timed_out"
      }
    });
    expect(fixture.results.some((record) =>
      record.role === "challenger" &&
      record.operation === "start" &&
      record.outcome === "timed_out"
    )).toBe(true);

    late.resolve(fixture.runningStatus("challenger"));
    await vi.runAllTimersAsync();
    await vi.waitFor(() => {
      expect(fixture.stopInputs.filter((input) => input.side.role === "challenger").length)
        .toBeGreaterThanOrEqual(2);
    });
  });

  it.each([
    ["request budget", { providerRequestCount: 6 }, "provider_request_budget_exceeded"],
    ["inspect mismatch", { inspectMismatchRole: "challenger" as const }, "start_failed"]
  ])("cleans both sides when %s violates frozen policy", async (
    _label,
    options,
    reason
  ) => {
    const fixture = runtimeActivationFixture(options);

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_status: "stopped_cleanly",
        outcome_reason: reason
      }
    });
    expect(fixture.stopInputs.map((input) => input.side.role).sort())
      .toEqual(["challenger", "champion"]);
  });

  it("cleans both sides when persisted sandbox start skew exceeds policy", async () => {
    let current = "2026-07-11T00:00:02.000Z";
    const fixture = runtimeActivationFixture({
      now: () => current,
      sandboxStartSkewMs: 5_001,
      onBothStarting: () => {
        current = "2026-07-11T00:00:07.001Z";
      }
    });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_status: "stopped_cleanly",
        outcome_reason: "start_skew_exceeded"
      }
    });
  });

  it("classifies completion after the frozen deadline without waiting for a wall timer", async () => {
    let current = "2026-07-11T00:00:02.000Z";
    const fixture = runtimeActivationFixture({
      now: () => current,
      onBothStarting: () => {
        current = "2026-07-11T00:01:03.000Z";
      }
    });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_status: "stopped_cleanly",
        outcome_reason: "activation_elapsed_exceeded"
      }
    });
  });

  it("leaves cleanup-required when one start result cannot be persisted", async () => {
    const fixture = runtimeActivationFixture({
      sideResultWriteFailure: { role: "challenger", operation: "start" }
    });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "cleanup_required",
      outcome: {
        outcome_status: "cleanup_required",
        outcome_reason: "side_result_persistence_failed",
        next_action: "recover_cleanup"
      }
    });
    expect(fixture.stopInputs.map((input) => input.side.role).sort())
      .toEqual(["challenger", "champion"]);
    expect(fixture.results.some((record) =>
      record.role === "challenger" && record.operation === "stop"
    )).toBe(false);
  });

  it("leaves cleanup-required with stable evidence when cleanup fails", async () => {
    const fixture = runtimeActivationFixture({
      startFailureRole: "challenger",
      stopFailureRole: "champion"
    });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "cleanup_required",
      outcome: {
        outcome_status: "cleanup_required",
        outcome_reason: "cleanup_failed"
      },
      championResult: {
        operation: "stop",
        outcome: "failed",
        stable_error_code: "paper_trading_comparison_session_cleanup_failed"
      }
    });
  });

  it("cleans both running sides when the outcome append fails", async () => {
    const fixture = runtimeActivationFixture({ outcomeWriteFailure: true });

    await expect(fixture.coordinator.start(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
    });
    expect(fixture.stopInputs.map((input) => input.side.role).sort())
      .toEqual(["challenger", "champion"]);
    expect(fixture.state.champion.runtime_lifecycle_status).toBe("stopped");
    expect(fixture.state.challenger.runtime_lifecycle_status).toBe("stopped");
    expect(fixture.outcomes).toEqual([]);
  });

  it("cleans both sides after a double start failure without automatic retry", async () => {
    const fixture = runtimeActivationFixture({
      startFailureRoles: ["champion", "challenger"]
    });

    const result = await fixture.coordinator.start(fixture.input);

    expect(result).toMatchObject({
      status: "stopped_cleanly",
      outcome: { outcome_reason: "start_failed" }
    });
    expect(fixture.results.filter((record) =>
      record.operation === "start" && record.outcome === "failed"
    )).toHaveLength(2);
    expect(fixture.attempts).toHaveLength(1);
  });

  it("rejects an alternate attempt identity before another runtime effect", async () => {
    const fixture = runtimeActivationFixture();
    await fixture.coordinator.start(fixture.input);

    await expect(fixture.coordinator.start({
      ...fixture.input,
      idempotencyKey: "alternate-runtime-start"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_attempt_conflict"
    });
    expect(fixture.startInputs).toHaveLength(2);
    expect(fixture.attempts).toHaveLength(1);
  });

  it("admits one explicit retry only after stopped-cleanly and advances sequence and time", async () => {
    const fixture = runtimeActivationFixture({ startFailureRole: "challenger" });
    const first = await fixture.coordinator.start(fixture.input);

    const retry = await fixture.coordinator.start({
      ...fixture.input,
      idempotencyKey: "runtime-start-retry-002"
    });

    expect(retry.attempt).toMatchObject({ attempt_sequence: 2, retry_index: 1 });
    expect(Date.parse(retry.attempt.attempted_at)).toBeGreaterThan(
      Date.parse(first.outcome.completed_at)
    );
    expect(fixture.attempts).toHaveLength(2);
    expect(fixture.startInputs).toHaveLength(4);
  });

  it("recovers an unowned both-running outcome by stopping both sides", async () => {
    const fixture = runtimeActivationFixture();
    await fixture.coordinator.start(fixture.input);
    const startCount = fixture.startInputs.length;
    const restarted = fixture.createCoordinator();

    await expect(restarted.start(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_attempt_incomplete"
    });
    expect(fixture.startInputs).toHaveLength(startCount);

    const recovered = await restarted.recoverIncompleteActivations();

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_sequence: 2,
        outcome_status: "stopped_cleanly",
        outcome_reason: "restart_cleanup",
        previous_outcome_ref: {
          id: fixture.outcomes[0]!.paper_trading_comparison_activation_outcome_id
        }
      }
    });
    expect(fixture.startInputs).toHaveLength(startCount);
    expect(fixture.stopInputs.slice(-2).map((input) => input.reason))
      .toEqual(["restart_cleanup", "restart_cleanup"]);
  });

  it("reconciles an outcome-less attempt after its running outcome write failed", async () => {
    const fixture = runtimeActivationFixture({ outcomeWriteFailure: true });
    await expect(fixture.coordinator.start(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_outcome_persistence_failed"
    });
    fixture.setOutcomeWriteFailure(false);
    const startCount = fixture.startInputs.length;

    const recovered = await fixture.coordinator.recoverIncompleteActivations();

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      status: "stopped_cleanly",
      outcome: {
        outcome_sequence: 1,
        outcome_status: "stopped_cleanly",
        outcome_reason: "restart_cleanup"
      }
    });
    expect(fixture.startInputs).toHaveLength(startCount);
  });

  it("keeps ref-less timeout evidence cleanup-required without restarting either side", async () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-07-11T00:00:02.000Z");
    const late = deferred<PaperTradingComparisonSessionSideStatus>();
    const fixture = runtimeActivationFixture({
      now: () => new Date(Date.now()).toISOString(),
      lateStart: { role: "challenger", result: late.promise }
    });
    const pending = fixture.coordinator.start(fixture.input);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(pending).resolves.toMatchObject({ status: "cleanup_required" });
    const startCount = fixture.startInputs.length;

    const recovered = await fixture.coordinator.recoverIncompleteActivations();

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      status: "cleanup_required",
      outcome: {
        outcome_sequence: 2,
        outcome_status: "cleanup_required",
        outcome_reason: "restart_cleanup"
      }
    });
    expect(fixture.startInputs).toHaveLength(startCount);
  });

  it("skips terminal stopped-cleanly attempts during restart recovery", async () => {
    const fixture = runtimeActivationFixture({ startFailureRole: "challenger" });
    await fixture.coordinator.start(fixture.input);
    const stops = fixture.stopInputs.length;

    await expect(fixture.coordinator.recoverIncompleteActivations())
      .resolves.toEqual([]);
    expect(fixture.stopInputs).toHaveLength(stops);
  });

  it("returns an exact persisted outcome on concurrent idempotent replay without more effects", async () => {
    const fixture = runtimeActivationFixture();

    const [first, replay] = await Promise.all([
      fixture.coordinator.start(fixture.input),
      fixture.coordinator.start(fixture.input)
    ]);

    expect(replay.outcome).toEqual(first.outcome);
    expect(replay.attempt).toEqual(first.attempt);
    expect(fixture.startInputs).toHaveLength(2);
    expect(fixture.attempts).toHaveLength(1);
    expect(fixture.outcomes).toHaveLength(1);
  });

  it("rejects an owned replay when current session state no longer matches both-running", async () => {
    const fixture = runtimeActivationFixture();
    await fixture.coordinator.start(fixture.input);
    fixture.state.champion = {
      ...fixture.state.champion,
      provider_session_active: false
    };
    const startCount = fixture.startInputs.length;

    await expect(fixture.coordinator.start(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_attempt_incomplete"
    });
    expect(fixture.startInputs).toHaveLength(startCount);
  });

  it("fails with stable coordinator errors before effects for malformed Store values", async () => {
    const fixture = runtimeActivationFixture({ activationReadValue: {} });

    await expect(fixture.coordinator.start(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_runtime_activation_graph_invalid"
    });
    expect(fixture.startInputs).toEqual([]);
    expect(fixture.attempts).toEqual([]);
  });
});

interface RuntimeActivationFixtureOptions {
  now?: () => string;
  startFailureRole?: "champion" | "challenger";
  startFailureRoles?: Array<"champion" | "challenger">;
  lateStart?: {
    role: "champion" | "challenger";
    result: Promise<PaperTradingComparisonSessionSideStatus>;
  };
  activationReadValue?: unknown;
  sandboxStartSkewMs?: number;
  providerRequestCount?: number;
  inspectMismatchRole?: "champion" | "challenger";
  stopFailureRole?: "champion" | "challenger";
  sideResultWriteFailure?: {
    role: "champion" | "challenger";
    operation: "start" | "stop";
  };
  onBothStarting?: () => void;
  outcomeWriteFailure?: boolean;
}

function runtimeActivationFixture(options: RuntimeActivationFixtureOptions = {}) {
  const source = fixedMarketData();
  const tick = validTick(source);
  const activation = validActivation(tick);
  const now = options.now ?? (() => "2026-07-11T00:00:02.000Z");
  const sandboxBaseTime = now();
  const attempts: PaperTradingComparisonActivationAttemptRecord[] = [];
  const results: PaperTradingComparisonActivationSideResultRecord[] = [];
  const outcomes: PaperTradingComparisonActivationOutcomeRecord[] = [];
  const events: string[] = [];
  const startInputs: Array<Parameters<PaperTradingComparisonSessionPort["startComparisonSide"]>[0]> = [];
  const stopInputs: Array<Parameters<PaperTradingComparisonSessionPort["stopComparisonSide"]>[0]> = [];
  const state = {
    champion: inactiveStatus(activation.champion),
    challenger: inactiveStatus(activation.challenger)
  };
  let startsInFlight = 0;
  let maximumStartsInFlight = 0;
  let bothStartingNotified = false;
  let outcomeWriteFailure = options.outcomeWriteFailure ?? false;
  const pendingStarts = new Map<
    "champion" | "challenger",
    { resolve: (value: PaperTradingComparisonSessionSideStatus) => void; reject: (error: Error) => void }
  >();

  const store = {
    listPaperTradingComparisonCommitments: vi.fn(async () => [{
      paper_trading_comparison_commitment_id:
        activation.paper_trading_comparison_commitment_ref.id
    }]),
    getPaperTradingComparisonActivation: vi.fn(async (id: string) => {
      if (Object.hasOwn(options, "activationReadValue")) {
        return structuredClone(options.activationReadValue);
      }
      return id === activation.paper_trading_comparison_activation_id
        ? structuredClone(activation)
        : undefined;
    }),
    listPaperTradingComparisonActivations: vi.fn(async () => [structuredClone(activation)]),
    getPaperTradingComparisonTick: vi.fn(async (id: string) =>
      id === tick.paper_trading_comparison_tick_id ? structuredClone(tick) : undefined),
    listPaperTradingComparisonTicks: vi.fn(async () => [structuredClone(tick)]),
    getPaperTradingComparisonActivationAttempt: vi.fn(async (id: string) =>
      structuredClone(attempts.find((record) =>
        record.paper_trading_comparison_activation_attempt_id === id
      ))),
    listPaperTradingComparisonActivationAttempts: vi.fn(async () => structuredClone(attempts)),
    recordPaperTradingComparisonActivationAttempt: vi.fn(async (
      attempt: PaperTradingComparisonActivationAttemptRecord
    ) => {
      const existing = attempts.find((record) =>
        record.paper_trading_comparison_activation_attempt_id ===
          attempt.paper_trading_comparison_activation_attempt_id
      );
      if (existing) return structuredClone(existing);
      const latest = attempts.at(-1);
      if (latest) {
        const latestOutcome = outcomes.filter((record) =>
          record.paper_trading_comparison_activation_attempt_ref.id ===
            latest.paper_trading_comparison_activation_attempt_id
        ).at(-1);
        if (latestOutcome?.outcome_status !== "stopped_cleanly") {
          throw Object.assign(new Error("attempt state conflict"), {
            code: "paper_trading_comparison_activation_attempt_state_conflict"
          });
        }
      }
      attempts.push(structuredClone(attempt));
      events.push("attempt:recorded");
      return structuredClone(attempt);
    }),
    getPaperTradingComparisonActivationSideResult: vi.fn(async (id: string) =>
      structuredClone(results.find((record) =>
        record.paper_trading_comparison_activation_side_result_id === id
      ))),
    listPaperTradingComparisonActivationSideResults: vi.fn(async (attemptId: string) =>
      structuredClone(results.filter((record) =>
        record.paper_trading_comparison_activation_attempt_ref.id === attemptId
      ))),
    recordPaperTradingComparisonActivationSideResult: vi.fn(async (
      result: PaperTradingComparisonActivationSideResultRecord
    ) => {
      if (options.sideResultWriteFailure?.role === result.role &&
        options.sideResultWriteFailure.operation === result.operation) {
        throw Object.assign(new Error("side result write failed"), {
          code: "paper_trading_comparison_activation_side_result_write_failed"
        });
      }
      results.push(structuredClone(result));
      events.push(`result:${result.role}:${result.operation}:${result.outcome}`);
      return structuredClone(result);
    }),
    getPaperTradingComparisonActivationOutcome: vi.fn(async (id: string) =>
      structuredClone(outcomes.find((record) =>
        record.paper_trading_comparison_activation_outcome_id === id
      ))),
    listPaperTradingComparisonActivationOutcomes: vi.fn(async (attemptId: string) =>
      structuredClone(outcomes.filter((record) =>
        record.paper_trading_comparison_activation_attempt_ref.id === attemptId
      ))),
    recordPaperTradingComparisonActivationOutcome: vi.fn(async (
      outcome: PaperTradingComparisonActivationOutcomeRecord
    ) => {
      if (outcomeWriteFailure) {
        throw Object.assign(new Error("outcome write failed"), {
          code: "paper_trading_comparison_activation_outcome_write_failed"
        });
      }
      outcomes.push(structuredClone(outcome));
      events.push(`outcome:${outcome.outcome_status}`);
      return structuredClone(outcome);
    })
  } as unknown as OuroborosStorePort;

  const runningStatus = (
    role: "champion" | "challenger"
  ): PaperTradingComparisonSessionSideStatus => ({
    role,
    trading_run_ref: { ...activation[role].trading_run_ref },
    paper_trading_evaluation_ref: { ...activation[role].paper_trading_evaluation_ref },
    sandbox_ref: { record_kind: "sandbox", id: `${role}-sandbox` },
    runtime_lifecycle_status: "running",
    evaluation_status: "running",
    sandbox_lifecycle_status: "running",
    sandbox_started_at: new Date(
      Date.parse(sandboxBaseTime) +
        (role === "challenger" ? options.sandboxStartSkewMs ?? 0 : 0)
    ).toISOString(),
    provider_request_count: options.providerRequestCount ?? 2,
    provider_session_active: true,
    observed_at: now(),
    authority_status: "not_live"
  });

  const sessions: PaperTradingComparisonSessionPort = {
    async startComparisonSide(input) {
      events.push(`start:${input.side.role}`);
      startInputs.push(input);
      startsInFlight += 1;
      maximumStartsInFlight = Math.max(maximumStartsInFlight, startsInFlight);
      if (options.lateStart?.role === input.side.role) {
        return options.lateStart.result.finally(() => {
          startsInFlight -= 1;
        });
      }
      return new Promise<PaperTradingComparisonSessionSideStatus>((resolve, reject) => {
        pendingStarts.set(input.side.role, { resolve, reject });
        if (pendingStarts.size === 2 || options.lateStart) {
          queueMicrotask(() => {
            if (!bothStartingNotified) {
              bothStartingNotified = true;
              options.onBothStarting?.();
            }
            for (const [role, pending] of pendingStarts) {
              pendingStarts.delete(role);
              startsInFlight -= 1;
              if (options.startFailureRole === role ||
                options.startFailureRoles?.includes(role)) {
                pending.reject(Object.assign(new Error("provider failed"), {
                  code: "paper_trading_comparison_session_start_failed"
                }));
              } else {
                state[role] = runningStatus(role);
                pending.resolve(structuredClone(state[role]));
              }
            }
          });
        }
      });
    },
    async stopComparisonSide(input) {
      events.push(`stop:${input.side.role}`);
      stopInputs.push(input);
      if (options.stopFailureRole === input.side.role) {
        throw new Error("raw cleanup adapter failure");
      }
      const previous = state[input.side.role];
      state[input.side.role] = inactiveStatus(input.side, {
        stopped: previous.runtime_lifecycle_status === "running",
        sandboxRef: previous.sandbox_ref
      });
      return structuredClone(state[input.side.role]);
    },
    async inspectComparisonSide(input) {
      const inspected = structuredClone(state[input.side.role]);
      if (input.authority.operation === "start" &&
        options.inspectMismatchRole === input.side.role) {
        return { ...inspected, provider_session_active: false };
      }
      return inspected;
    }
  };
  const createCoordinator = () =>
    new PaperTradingComparisonRuntimeActivationCoordinator({
      store,
      sessions,
      marketData: source,
      now
    });
  const coordinator = createCoordinator();
  const input = {
    activationId: activation.paper_trading_comparison_activation_id,
    idempotencyKey: "runtime-start-001"
  };
  return {
    source,
    tick,
    activation,
    attempts,
    results,
    outcomes,
    events,
    startInputs,
    stopInputs,
    state,
    runningStatus,
    store,
    sessions,
    coordinator,
    createCoordinator,
    input,
    setOutcomeWriteFailure(value: boolean) { outcomeWriteFailure = value; },
    get maximumStartsInFlight() { return maximumStartsInFlight; }
  };
}

function inactiveStatus(
  side: PaperTradingComparisonActivationSide,
  options: { stopped?: boolean; sandboxRef?: PaperTradingComparisonSessionSideStatus["sandbox_ref"] } = {}
): PaperTradingComparisonSessionSideStatus {
  return {
    role: side.role,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref },
    ...(options.sandboxRef ? {
      sandbox_ref: { ...options.sandboxRef },
      sandbox_lifecycle_status: "stopped" as const,
      sandbox_started_at: "2026-07-11T00:00:02.000Z"
    } : {}),
    runtime_lifecycle_status: options.stopped ? "stopped" : "registered",
    evaluation_status: options.stopped ? "stopped" : "not_started",
    provider_request_count: 2,
    provider_session_active: false,
    observed_at: new Date(Date.now()).toISOString(),
    authority_status: "not_live"
  };
}

function validActivation(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonActivationRecord {
  const activation: PaperTradingComparisonActivationRecord = {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: "paper-comparison-runtime-activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: tick.paper_trading_comparison_commitment_ref.id
    },
    paper_trading_comparison_commitment_digest:
      tick.paper_trading_comparison_commitment_digest,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    first_tick_digest: tick.tick_digest,
    champion: activationSide("champion"),
    challenger: activationSide("challenger"),
    market_data_configuration_digest: tick.market_data_configuration_digest,
    activation_policy: {
      policy_version: "paper-comparison-activation-v1",
      maximum_start_skew_ms: 5_000,
      maximum_retry_count_per_side: 3,
      maximum_provider_request_count_per_side: 5,
      maximum_activation_elapsed_ms: 60_000,
      cleanup_timeout_ms: 10_000,
      require_both_running_before_observation: true,
      partial_start_policy: "stop_started_side_before_retry",
      restart_policy: "recover_both_or_stop_both",
      market_view_policy: "first_tick_then_contiguous_persisted_ticks"
    },
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: "2026-07-11T00:00:01.500Z",
    activation_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  };
  return {
    ...activation,
    activation_digest: digest(paperTradingComparisonActivationDigestInput(activation))
  };
}

function activationSide(role: "champion" | "challenger"): PaperTradingComparisonActivationSide {
  return {
    role,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    }
  };
}

function validTick(source: GatewayMarketDataPort): PaperTradingComparisonTickRecord {
  const tick: PaperTradingComparisonTickRecord = {
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "paper-comparison-runtime-tick-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "paper-comparison-runtime-001"
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison-runtime",
    sequence: 1,
    market_data_configuration_digest: paperTradingMarketDataConfigurationDigest(source),
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: "2026-07-11T00:00:00.500Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-11T00:00:00.600Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "runtime-activation-tick",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:01.000Z",
    tick_digest: "",
    authority_status: "not_live"
  };
  return { ...tick, tick_digest: digest(paperTradingComparisonTickDigestInput(tick)) };
}

function fixedMarketData(): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://fapi.binance.com",
    required_endpoints: ["/fapi/v1/aggTrades"],
    authority_status: "read_only",
    readMarketSnapshot: vi.fn(async () => {
      throw new Error("underlying market read forbidden");
    }),
    readPublicExecutionSnapshot: vi.fn(async () => {
      throw new Error("underlying execution read forbidden");
    }),
    readPublicMarketLivenessSurface: vi.fn(async () => {
      throw new Error("underlying liveness read forbidden");
    })
  };
}

function digest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function runtimeContext(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  operation: "start" | "stop"
): PaperTradingComparisonRuntimeWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    role,
    operation
  };
}
