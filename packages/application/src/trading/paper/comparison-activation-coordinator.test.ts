import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonTickDigestInput,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonSide,
  type PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type { VerifiedPaperTradingComparisonCommitmentGraph } from "./comparison-coordinator";
import {
  PaperTradingComparisonActivationCoordinator,
  PaperTradingComparisonActivationError
} from "./comparison-activation-coordinator";

describe("paper comparison activation authorization coordinator", () => {
  it("derives and persists one effect-free activation authorization", async () => {
    const fixture = activationFixture();

    const result = await fixture.coordinator.authorize({
      comparisonId: fixture.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "authorize"
    });

    expect(result.runtimeEffects).toBe("not_started");
    expect(result.comparison.verification.activation_authority).toBe("not_granted");
    expect(result.firstTick).toEqual(fixture.tick);
    expect(result.activation).toMatchObject({
      record_kind: "paper_trading_comparison_activation",
      paper_trading_comparison_commitment_ref: {
        id: fixture.comparison.paper_trading_comparison_commitment_id
      },
      paper_trading_comparison_commitment_digest: fixture.comparison.commitment_digest,
      first_tick_ref: { id: fixture.tick.paper_trading_comparison_tick_id },
      first_tick_digest: fixture.tick.tick_digest,
      champion: activationSide(fixture.comparison.champion),
      challenger: activationSide(fixture.comparison.challenger),
      market_data_configuration_digest:
        fixture.comparison.market_data_configuration_digest,
      activation_policy: paperTradingComparisonActivationPolicyFor(
        fixture.comparison.comparison_policy
      ),
      activation_scope: "qualification_pair",
      activation_status: "authorized",
      authorized_at: "2026-07-11T00:00:02.000Z",
      live_exchange_authority: false,
      order_submission_authority: false,
      private_exchange_access: "forbidden",
      credentials_access: "forbidden",
      authority_status: "not_live"
    });
    expect(result.activation.paper_trading_comparison_activation_id)
      .toMatch(/^paper-trading-comparison-activation-[a-f0-9]{16}$/);
    expect(fixture.records).toEqual([result.activation]);
    expect(fixture.store.recordPaperTradingComparisonActivation).toHaveBeenCalledTimes(1);
    expect(fixture.comparisons.reload).toHaveBeenCalledTimes(2);
    expect(fixture.now).toHaveBeenCalledTimes(1);
  });

  it("revalidates an exact retry without another time read or write", async () => {
    const fixture = activationFixture();
    const input = {
      comparisonId: fixture.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "exact-retry"
    };
    const first = await fixture.coordinator.authorize(input);

    const replay = await fixture.coordinator.authorize(input);

    expect(replay).toEqual(first);
    expect(fixture.records).toHaveLength(1);
    expect(fixture.store.recordPaperTradingComparisonActivation).toHaveBeenCalledTimes(1);
    expect(fixture.now).toHaveBeenCalledTimes(1);
    expect(fixture.comparisons.reload).toHaveBeenCalledTimes(3);
  });

  it("rejects a drifted deterministic authorization without a raw TypeError", async () => {
    const fixture = activationFixture();
    const input = {
      comparisonId: fixture.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "drifted-retry"
    };
    await fixture.coordinator.authorize(input);
    const current = fixture.records[0]!;
    fixture.records[0] = withActivationDigest({
      ...current,
      activation_policy: {
        ...current.activation_policy,
        maximum_start_skew_ms: current.activation_policy.maximum_start_skew_ms + 1
      }
    });

    await expect(fixture.coordinator.authorize(input)).rejects.toMatchObject({
      name: "PaperTradingComparisonActivationError",
      code: "paper_trading_comparison_activation_idempotency_conflict"
    });
    expect(fixture.store.recordPaperTradingComparisonActivation).toHaveBeenCalledTimes(1);
    expect(fixture.now).toHaveBeenCalledTimes(1);
  });

  it("rejects an alternate identity before server time or another write", async () => {
    const fixture = activationFixture();
    const comparisonId = fixture.comparison.paper_trading_comparison_commitment_id;
    await fixture.coordinator.authorize({ comparisonId, idempotencyKey: "winner" });

    await expect(fixture.coordinator.authorize({
      comparisonId,
      idempotencyKey: "alternate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_conflict"
    });
    expect(fixture.records).toHaveLength(1);
    expect(fixture.store.recordPaperTradingComparisonActivation).toHaveBeenCalledTimes(1);
    expect(fixture.now).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent alternate activation authorizations", async () => {
    const fixture = activationFixture();
    const comparisonId = fixture.comparison.paper_trading_comparison_commitment_id;
    const results = await Promise.allSettled([
      fixture.coordinator.authorize({ comparisonId, idempotencyKey: "concurrent-a" }),
      fixture.coordinator.authorize({ comparisonId, idempotencyKey: "concurrent-b" })
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({
      code: "paper_trading_comparison_activation_conflict"
    });
    expect(fixture.records).toHaveLength(1);
    expect(fixture.store.recordPaperTradingComparisonActivation).toHaveBeenCalledTimes(1);
    expect(fixture.now).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing graph", { missingGraph: true }, "paper_trading_comparison_not_found"],
    ["malformed graph", { graph: null }, "paper_trading_comparison_activation_graph_invalid"],
    ["malformed activation reload", { activationReadValue: null },
      "paper_trading_comparison_activation_graph_invalid"],
    ["wrong graph authority", {
      mutateGraph: (graph: any) => {
        graph.verification.activation_authority = "granted";
      }
    }, "paper_trading_comparison_activation_graph_invalid"],
    ["missing tick", { ticks: [] }, "paper_trading_comparison_activation_first_tick_missing"],
    ["non-sole tick", {
      mutateTicks: (ticks: any[]) => {
        ticks.push({ ...ticks[0], paper_trading_comparison_tick_id: "alternate-tick" });
      }
    }, "paper_trading_comparison_activation_first_tick_conflict"],
    ["malformed tick", { ticks: [null] }, "paper_trading_comparison_activation_graph_invalid"],
    ["tick digest drift", {
      mutateTicks: (ticks: any[]) => {
        ticks[0].tick_digest = "sha256:drift";
      }
    }, "paper_trading_comparison_activation_graph_invalid"],
    ["tick pair drift", {
      mutateTicks: (ticks: any[]) => {
        ticks[0] = withTickDigest({
          ...ticks[0],
          paper_trading_comparison_commitment_digest: "sha256:drift"
        });
      }
    }, "paper_trading_comparison_activation_graph_invalid"]
  ] as const)("fails closed on %s", async (_label, options, code) => {
    const fixture = activationFixture(options as ActivationFixtureOptions);

    await expect(fixture.coordinator.authorize({
      comparisonId: fixture.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "invalid-closure"
    })).rejects.toMatchObject({
      name: "PaperTradingComparisonActivationError",
      code
    });
    expect(fixture.store.recordPaperTradingComparisonActivation).not.toHaveBeenCalled();
    expect(fixture.now).not.toHaveBeenCalled();
  });

  it.each([
    ["non-ISO", "not-a-time"],
    ["before first tick", "2026-07-11T00:00:00.999Z"]
  ])("rejects %s server authorization time", async (_label, now) => {
    const fixture = activationFixture({ now });

    await expect(fixture.coordinator.authorize({
      comparisonId: fixture.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "invalid-time"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_time_invalid"
    });
    expect(fixture.store.recordPaperTradingComparisonActivation).not.toHaveBeenCalled();
  });

  it.each([
    ["comparison ID", { comparisonId: "", idempotencyKey: "key" }],
    ["idempotency key", { comparisonId: "comparison", idempotencyKey: " " }],
    ["non-string fields", { comparisonId: 1, idempotencyKey: null }]
  ])("rejects an empty %s", async (_label, input) => {
    const fixture = activationFixture();

    await expect(fixture.coordinator.authorize(input as any)).rejects.toBeInstanceOf(
      PaperTradingComparisonActivationError
    );
    await expect(fixture.coordinator.authorize(input as any)).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_activation_input"
    });
    expect(fixture.comparisons.reload).not.toHaveBeenCalled();
    expect(fixture.now).not.toHaveBeenCalled();
  });

  it("maps dependency failures and persisted drift to stable errors", async () => {
    const unreadable = activationFixture({ activationReadFailure: true });
    await expect(unreadable.coordinator.authorize({
      comparisonId: unreadable.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "read-failure"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_graph_invalid"
    });

    const writeFailure = activationFixture({ writeFailure: true });
    await expect(writeFailure.coordinator.authorize({
      comparisonId: writeFailure.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "write-failure"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_persistence_failed"
    });

    const sameIdentityRace = activationFixture({
      writeErrorCode: "paper_trading_comparison_activation_conflict"
    });
    await expect(sameIdentityRace.coordinator.authorize({
      comparisonId: sameIdentityRace.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "same-identity-race"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_idempotency_conflict"
    });

    const alternateRace = activationFixture({
      writeErrorCode: "paper_trading_comparison_activation_pair_conflict"
    });
    await expect(alternateRace.coordinator.authorize({
      comparisonId: alternateRace.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "alternate-race"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_conflict"
    });

    const persistedDrift = activationFixture({ persistedDrift: true });
    await expect(persistedDrift.coordinator.authorize({
      comparisonId: persistedDrift.comparison.paper_trading_comparison_commitment_id,
      idempotencyKey: "persisted-drift"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_activation_persistence_failed"
    });
  });
});

interface ActivationFixtureOptions {
  missingGraph?: boolean;
  graph?: unknown;
  mutateGraph?: (graph: any) => void;
  ticks?: unknown[];
  mutateTicks?: (ticks: any[]) => void;
  now?: string;
  activationReadFailure?: boolean;
  activationReadValue?: unknown;
  writeFailure?: boolean;
  writeErrorCode?: string;
  persistedDrift?: boolean;
}

function activationFixture(options: ActivationFixtureOptions = {}) {
  const comparison = validComparison();
  const graph = options.graph === undefined
    ? validGraph(comparison)
    : options.graph;
  if (options.mutateGraph) {
    options.mutateGraph(graph);
  }
  const tick = validTick(comparison);
  const ticks = options.ticks === undefined
    ? [structuredClone(tick)]
    : structuredClone(options.ticks);
  if (options.mutateTicks) {
    options.mutateTicks(ticks as any[]);
  }
  const records: PaperTradingComparisonActivationRecord[] = [];
  const store = {
    getPaperTradingComparisonActivation: vi.fn(async (activationId: string) => {
      if (options.activationReadFailure) throw new Error("read failed");
      if (Object.hasOwn(options, "activationReadValue")) {
        return structuredClone(options.activationReadValue);
      }
      return structuredClone(records.find((record) =>
        record.paper_trading_comparison_activation_id === activationId
      ));
    }),
    listPaperTradingComparisonActivations: vi.fn(async (comparisonId: string) =>
      structuredClone(records.filter((record) =>
        record.paper_trading_comparison_commitment_ref.id === comparisonId
      ))),
    recordPaperTradingComparisonActivation: vi.fn(async (
      activation: PaperTradingComparisonActivationRecord
    ) => {
      if (options.writeFailure) throw new Error("write failed");
      if (options.writeErrorCode) {
        throw Object.assign(new Error("store write failed"), {
          code: options.writeErrorCode
        });
      }
      const persisted = options.persistedDrift
        ? { ...activation, authorized_at: "2026-07-11T00:00:03.000Z" }
        : activation;
      records.push(structuredClone(persisted));
      return structuredClone(persisted);
    }),
    listPaperTradingComparisonTicks: vi.fn(async () => structuredClone(ticks)),
    getPaperTradingComparisonTick: vi.fn(async (tickId: string) =>
      structuredClone((ticks as PaperTradingComparisonTickRecord[]).find((record) =>
        record?.paper_trading_comparison_tick_id === tickId
      )))
  } as unknown as OuroborosStorePort;
  const comparisons = {
    reload: vi.fn(async () => options.missingGraph
      ? undefined
      : structuredClone(graph) as VerifiedPaperTradingComparisonCommitmentGraph)
  };
  const now = vi.fn(() => options.now ?? "2026-07-11T00:00:02.000Z");
  return {
    comparison,
    graph,
    tick,
    ticks,
    records,
    store,
    comparisons,
    now,
    coordinator: new PaperTradingComparisonActivationCoordinator({
      store,
      comparisons,
      now
    })
  };
}

function validGraph(
  commitment: PaperTradingComparisonCommitmentRecord
): VerifiedPaperTradingComparisonCommitmentGraph {
  return {
    preparation: {} as never,
    commitment: structuredClone(commitment),
    champion: { side: structuredClone(commitment.champion) } as never,
    challenger: { side: structuredClone(commitment.challenger) } as never,
    verification: { status: "verified", activation_authority: "not_granted" }
  };
}

function validComparison(): PaperTradingComparisonCommitmentRecord {
  const comparison: PaperTradingComparisonCommitmentRecord = {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "paper-comparison-activation-001",
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: "paper-comparison-preparation-001"
    },
    champion: comparisonSide("champion"),
    challenger: comparisonSide("challenger"),
    champion_selection: { selection_kind: "bootstrap" },
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "bootstrap",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 30,
      minimum_elapsed_ms: 1_800_000,
      maximum_observation_count: 120,
      maximum_elapsed_ms: 7_200_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 500,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 10,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
    },
    market_data_configuration_digest: "sha256:market",
    paper_policy_identity: {
      market_data_policy_version: "market",
      gateway_policy_version: "gateway",
      cost_policy_version: "cost",
      funding_policy_version: "funding",
      slippage_policy_version: "slippage",
      fill_policy_version: "fill",
      risk_policy_version: "risk",
      paper_account_policy_version: "account",
      decision_event_protocol_version: "decision",
      persistent_state_boundary_version: "state"
    },
    committed_at: "2026-07-11T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
  return {
    ...comparison,
    commitment_digest: digest(paperTradingComparisonCommitmentDigestInput(comparison))
  };
}

function comparisonSide(role: "champion" | "challenger"): PaperTradingComparisonSide {
  return {
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    candidate_version_digest: `sha256:${role}-version`,
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_record_digest: `sha256:${role}-code-record`,
    system_code_artifact_digest: `sha256:${role}-code-artifact`,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `${role}-admission`
    },
    admission_decision_digest: `sha256:${role}-admission`,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_commitment_digest: `sha256:${role}-commitment`,
    paper_trading_evaluation_commitment_record_digest:
      `sha256:${role}-commitment-record`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:${role}-evaluation-record`
  };
}

function validTick(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonTickRecord {
  return withTickDigest({
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "paper-comparison-tick-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    sequence: 1,
    market_data_configuration_digest: comparison.market_data_configuration_digest,
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
      stream_marker: "activation-tick",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-11T00:00:01.000Z",
    tick_digest: "",
    authority_status: "not_live"
  });
}

function withTickDigest(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  return {
    ...tick,
    tick_digest: digest(paperTradingComparisonTickDigestInput(tick))
  };
}

function activationSide(side: PaperTradingComparisonSide) {
  return {
    role: side.role,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...side.paper_trading_evaluation_commitment_ref
    },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref }
  };
}

function withActivationDigest(
  activation: PaperTradingComparisonActivationRecord
): PaperTradingComparisonActivationRecord {
  return {
    ...activation,
    activation_digest: digest(paperTradingComparisonActivationDigestInput(activation))
  };
}

function digest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}
