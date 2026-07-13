import { describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import { classifyPaperTradingComparisonWindow } from
  "@ouroboros/application/trading/paper/comparison-window-state";
import type {
  PaperTradingComparisonWindowFacts
} from "@ouroboros/application/trading/paper/comparison-window-state";
import type {
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord,
  PaperTradingMarketSnapshotSummary,
  PaperTradingPublicExecutionSnapshotSummary,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignPaperStartBatchRecord
} from "@ouroboros/domain";
import {
  ResearchControlCampaignPaperSourceWindowCoordinator,
  ResearchControlCampaignPaperSourceWindowError,
  type ResearchControlCampaignPaperSourceWindowArm
} from "../src/candidate/arena/research-control-campaign-paper-source-window";

describe("ResearchControlCampaign matched source window", () => {
  it("authorizes both comparisons before starting either runtime", async () => {
    const fixture = sourceWindowFixture();

    const result = await fixture.coordinator.startSourceBatch({
      schedule: fixture.schedule,
      batch: fixture.batch
    });

    expect(result).toHaveLength(2);
    const firstStart = fixture.operations.findIndex((operation) =>
      operation.startsWith("start:")
    );
    expect(fixture.operations.slice(0, firstStart)).toEqual(expect.arrayContaining([
      "authorize:adaptive_treatment",
      "authorize:static_control",
      "recover:adaptive_treatment",
      "recover:static_control"
    ]));
    expect(fixture.operations.filter((operation) =>
      operation.startsWith("authorize:")
    )).toHaveLength(2);
  });

  it("stops a running peer when the matched start fails", async () => {
    const fixture = sourceWindowFixture({ failStartArm: "static_control" });

    await expect(fixture.coordinator.startSourceBatch({
      schedule: fixture.schedule,
      batch: fixture.batch
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperSourceWindowError);

    expect(fixture.operations).toContain("stop:adaptive_treatment");
    expect(fixture.running.size).toBe(0);
  });

  it("captures one shared repeated snapshot for both active source windows", async () => {
    const fixture = sourceWindowFixture();
    const sources = activeSources();

    const result = await fixture.coordinator.advanceSourceWindow({
      schedule: fixture.schedule,
      batch: fixture.batch,
      sources
    });
    const ticks = fixture.armStores.flatMap((store) => store.ticks);

    expect(result.transition).toBe("capture_next_tick");
    expect(fixture.sourceReads).toEqual({ market: 1, execution: 1 });
    expect(ticks).toHaveLength(2);
    expect(ticks[0]!.market_snapshot).toEqual(ticks[1]!.market_snapshot);
    expect(ticks[0]!.public_execution_snapshot).toEqual(
      ticks[1]!.public_execution_snapshot
    );
    expect(ticks[0]!.observed_at).toBe(ticks[1]!.observed_at);
  });

  it("recovers a partial repeated-tick write without another source read", async () => {
    const fixture = sourceWindowFixture({
      sourceReadsFail: true,
      initialPhases: {
        adaptive_treatment: "next_tick_captured",
        static_control: "checkpoint_committed"
      }
    });
    const persisted = repeatedTick("adaptive_treatment");
    fixture.armStores[0]!.ticks.push(persisted);

    const result = await fixture.coordinator.advanceSourceWindow({
      schedule: fixture.schedule,
      batch: fixture.batch,
      sources: activeSources()
    });

    expect(result.transition).toBe("capture_next_tick");
    expect(fixture.sourceReads).toEqual({ market: 0, execution: 0 });
    expect(fixture.armStores[1]!.ticks[0]!.market_snapshot).toEqual(
      persisted.market_snapshot
    );
    expect(fixture.armStores[1]!.ticks[0]!.public_execution_snapshot).toEqual(
      persisted.public_execution_snapshot
    );
  });

  it("stops both active runtimes when one window transition fails", async () => {
    const fixture = sourceWindowFixture({ failWindowArm: "static_control" });
    await fixture.coordinator.startSourceBatch({
      schedule: fixture.schedule,
      batch: fixture.batch
    });

    await expect(fixture.coordinator.advanceSourceWindow({
      schedule: fixture.schedule,
      batch: fixture.batch,
      sources: activeSources()
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_source_window_transition_failed"
    });

    expect(fixture.operations).toEqual(expect.arrayContaining([
      "stop:adaptive_treatment",
      "stop:static_control"
    ]));
    expect(fixture.running.size).toBe(0);
  });

  it("maps only terminal non-improvement and ineligibility to source outcomes", async () => {
    const fixture = sourceWindowFixture();
    for (const verdictOutcome of [
      "challenger_not_improved",
      "comparison_ineligible"
    ] as const) {
      const outcome = await fixture.coordinator.recordSourceVerdictSlotOutcome({
        schedule: fixture.schedule,
        armKind: "adaptive_treatment",
        sequence: 1,
        verdict: sourceVerdict(verdictOutcome)
      });
      expect(outcome?.terminal_evidence).toMatchObject({
        evidence_kind: "source_verdict",
        terminal_status: verdictOutcome === "challenger_not_improved"
          ? "source_not_improved"
          : "evidence_ineligible"
      });
      fixture.armStores[0]!.outcomes.length = 0;
      fixture.coordinatorStore.outcomes.length = 0;
    }

    await expect(fixture.coordinator.recordSourceVerdictSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      verdict: sourceVerdict("challenger_improved")
    })).resolves.toBeUndefined();
    expect(fixture.coordinatorStore.outcomes).toEqual([]);
  });
});

type WindowPhase = "checkpoint_committed" | "next_tick_captured";

class WindowStore {
  ticks: PaperTradingComparisonTickRecord[] = [];
  outcomes: ResearchControlCampaignPaperSlotOutcomeRecord[] = [];

  constructor(readonly name: string) {}

  root() {
    return this.name;
  }

  async getPaperTradingComparisonTick(id: string) {
    return structuredClone(this.ticks.find((tick) =>
      tick.paper_trading_comparison_tick_id === id
    ));
  }

  async recordResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    return this.appendOutcome(outcome);
  }

  async replicateResearchControlCampaignPaperSlotOutcome(
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ) {
    return this.appendOutcome(outcome);
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return structuredClone(this.outcomes.find((outcome) =>
      outcome.research_control_campaign_paper_slot_outcome_id === id
    ));
  }

  private appendOutcome(outcome: ResearchControlCampaignPaperSlotOutcomeRecord) {
    const existing = this.outcomes.find((candidate) =>
      candidate.research_control_campaign_paper_slot_outcome_id ===
        outcome.research_control_campaign_paper_slot_outcome_id
    );
    if (!existing) this.outcomes.push(structuredClone(outcome));
    return structuredClone(existing ?? outcome);
  }
}

function sourceWindowFixture(options: {
  failStartArm?: ResearchControlCampaignArmKind;
  failWindowArm?: ResearchControlCampaignArmKind;
  sourceReadsFail?: boolean;
  initialPhases?: Record<ResearchControlCampaignArmKind, WindowPhase>;
} = {}) {
  const operations: string[] = [];
  const running = new Set<ResearchControlCampaignArmKind>();
  const sourceReads = { market: 0, execution: 0 };
  const phases: Record<ResearchControlCampaignArmKind, WindowPhase> =
    options.initialPhases ?? {
      adaptive_treatment: "checkpoint_committed",
      static_control: "checkpoint_committed"
    };
  const coordinatorStore = new WindowStore("coordinator");
  const armStores = [
    new WindowStore("adaptive_treatment"),
    new WindowStore("static_control")
  ] as const;
  const arms = Object.fromEntries(([
    "adaptive_treatment",
    "static_control"
  ] as const).map((armKind, index) => {
    const store = armStores[index]!;
    const arm: ResearchControlCampaignPaperSourceWindowArm = {
      store: port(store),
      activations: {
        async authorize() {
          operations.push(`authorize:${armKind}`);
          return {
            activation: {
              paper_trading_comparison_activation_id: `activation-${armKind}`
            },
            runtimeEffects: "not_started"
          } as never;
        }
      },
      runtime: {
        async recoverIncompleteActivations() {
          operations.push(`recover:${armKind}`);
          return [];
        },
        async start() {
          operations.push(`start:${armKind}`);
          if (options.failStartArm === armKind) {
            return runtimeResult(armKind, "stopped_cleanly");
          }
          running.add(armKind);
          return runtimeResult(armKind, "both_running");
        },
        async stopOwnedAttempt() {
          operations.push(`stop:${armKind}`);
          running.delete(armKind);
          return runtimeResult(armKind, "stopped_cleanly");
        }
      },
      windowReader: {
        async load() {
          return windowSnapshot(armKind, phases[armKind]);
        }
      },
      createWindowDriver({ marketData, now }) {
        return {
          async advance(input) {
            const before = classifyPaperTradingComparisonWindow(
              windowFacts(phases[armKind])
            );
            if (before.transition === "capture_next_tick") {
              if (options.failWindowArm === armKind) {
                throw new Error("injected_window_failure");
              }
              const [market, execution] = await Promise.all([
                marketData.readMarketSnapshot(),
                marketData.readPublicExecutionSnapshot()
              ]);
              store.ticks.push(repeatedTick(
                armKind,
                now(),
                {
                  ...market,
                  symbol: "BTCUSDT",
                  source_kind: market.source_kind ??
                    "binance_production_public_rest",
                  authority_status: "read_only"
                },
                execution
              ));
              phases[armKind] = "next_tick_captured";
            }
            return {
              activation_id: input.activationId,
              activation_attempt_id: input.activationAttemptId,
              phase: phases[armKind],
              checkpoint_sequence: 2,
              transition: before.transition,
              terminal: false,
              authority_status: "not_live"
            } as never;
          }
        };
      },
      verdicts: {
        async evaluate() {
          return sourceVerdict("challenger_not_improved");
        }
      }
    };
    return [armKind, arm];
  })) as Record<ResearchControlCampaignArmKind,
    ResearchControlCampaignPaperSourceWindowArm>;
  const schedule = scheduleFixture();
  const batch = startBatchFixture();
  const coordinator = new ResearchControlCampaignPaperSourceWindowCoordinator({
    coordinator: port(coordinatorStore),
    arms,
    marketData: marketPort(sourceReads, options.sourceReadsFail ?? false),
    now: () => "2026-07-12T10:00:02.000Z",
    decideSlotOutcome: (input) => slotOutcome(input)
  });
  return {
    coordinator,
    coordinatorStore,
    armStores,
    schedule,
    batch,
    operations,
    running,
    sourceReads
  };
}

function activeSources() {
  return (["adaptive_treatment", "static_control"] as const).map((armKind) => ({
    armKind,
    activationId: `activation-${armKind}`,
    activationAttemptId: `attempt-${armKind}`
  }));
}

function runtimeResult(
  armKind: ResearchControlCampaignArmKind,
  status: "both_running" | "stopped_cleanly"
) {
  return {
    status,
    activation: {
      paper_trading_comparison_activation_id: `activation-${armKind}`
    },
    attempt: {
      paper_trading_comparison_activation_attempt_id: `attempt-${armKind}`
    },
    outcome: { outcome_status: status }
  } as never;
}

function windowSnapshot(
  armKind: ResearchControlCampaignArmKind,
  phase: WindowPhase
) {
  return {
    facts: windowFacts(phase),
    latest_tick_id: phase === "next_tick_captured"
      ? `${armKind}-tick-2`
      : `${armKind}-tick-1`
  };
}

function windowFacts(phase: WindowPhase): PaperTradingComparisonWindowFacts {
  const nextTick = phase === "next_tick_captured";
  return {
    owned: true,
    now: "2026-07-12T10:00:02.000Z",
    activation_attempted_at: "2026-07-12T10:00:00.000Z",
    interval_ms: 1_000,
    maximum_observation_count: 3,
    maximum_elapsed_ms: 10_000,
    tick_count: nextTick ? 2 : 1,
    latest_tick_observed_at: nextTick
      ? "2026-07-12T10:00:02.000Z"
      : "2026-07-12T10:00:00.500Z",
    checkpoint_attempt_count: 1,
    paired_checkpoint_count: 1,
    latest_checkpoint_status: "paired",
    latest_checkpoint_has_failed_side: false,
    latest_tick_acknowledged_roles: ["champion", "challenger"],
    activation_status: "both_running"
  };
}

function repeatedTick(
  armKind: ResearchControlCampaignArmKind,
  observedAt = "2026-07-12T10:00:02.000Z",
  marketSnapshot: PaperTradingMarketSnapshotSummary = {
    symbol: "BTCUSDT" as const,
    price: 100_100,
    moving_average_fast: 100_050,
    moving_average_slow: 99_950,
    volatility: 0.01,
    expected_direction: "long" as const,
    observed_at: "2026-07-12T10:00:01.900Z",
    source_kind: "binance_production_public_rest" as const,
    authority_status: "read_only" as const
  },
  executionSnapshot: PaperTradingPublicExecutionSnapshotSummary =
    executionFixture()
): PaperTradingComparisonTickRecord {
  return {
    record_kind: "paper_trading_comparison_tick",
    paper_trading_comparison_tick_id: `${armKind}-tick-2`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `${armKind}-comparison`
    },
    sequence: 2,
    market_snapshot: structuredClone(marketSnapshot),
    public_execution_snapshot: structuredClone(executionSnapshot),
    observed_at: observedAt,
    tick_digest: `sha256:${armKind}-tick-2`
  } as unknown as PaperTradingComparisonTickRecord;
}

function marketPort(
  reads: { market: number; execution: number },
  fail: boolean
): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_rest",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only",
    async readMarketSnapshot() {
      reads.market += 1;
      if (fail) throw new Error("unexpected_source_market_read");
      return {
        symbol: "BTCUSDT",
        price: 100_100,
        moving_average_fast: 100_050,
        moving_average_slow: 99_950,
        volatility: 0.01,
        expected_direction: "long",
        observed_at: "2026-07-12T10:00:01.900Z",
        source_kind: "binance_production_public_rest"
      };
    },
    async readPublicExecutionSnapshot() {
      reads.execution += 1;
      if (fail) throw new Error("unexpected_source_execution_read");
      return executionFixture();
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("not_used");
    }
  };
}

function executionFixture() {
  return {
    symbol: "BTCUSDT" as const,
    observed_at: "2026-07-12T10:00:01.900Z",
    source_kind: "binance_production_public_rest" as const,
    stream_marker: "shared-window",
    agg_trades: [],
    authority_status: "read_only" as const
  };
}

function scheduleFixture(): ResearchControlCampaignPaperScheduleRecord {
  return {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    schedule_digest: "sha256:schedule",
    arms: (["adaptive_treatment", "static_control"] as const).map((armKind) => ({
      arm_kind: armKind,
      slots: [{
        slot_status: "candidate_scheduled",
        sequence: 1,
        tick_ref: { record_kind: "candidate_arena_tick", id: `${armKind}-tick` },
        candidate_ref: { record_kind: "trading_system_candidate", id:
          `${armKind}-candidate` },
        candidate_version_ref: { record_kind: "candidate_version", id:
          `${armKind}-version` },
        system_code_ref: { record_kind: "system_code", id: `${armKind}-code` },
        system_code_artifact_digest: `sha256:${armKind}-artifact`,
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `${armKind}-admission`
        },
        source_comparison_idempotency_key: `${armKind}-source-key`,
        source_preparation_id: `${armKind}-preparation`,
        source_comparison_commitment_id: `${armKind}-comparison`,
        maximum_source_start_delay_ms: 1_000
      }]
    })) as ResearchControlCampaignPaperScheduleRecord["arms"]
  } as ResearchControlCampaignPaperScheduleRecord;
}

function startBatchFixture(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    record_kind: "research_control_campaign_paper_start_batch",
    research_control_campaign_paper_start_batch_id: "batch-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: "schedule-001"
    },
    schedule_digest: "sha256:schedule",
    sequence: 1,
    batch_status: "paired_ready",
    sides: (["adaptive_treatment", "static_control"] as const).map((armKind) => ({
      arm_kind: armKind,
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: `${armKind}-comparison`
      },
      source_comparison_digest: `sha256:${armKind}-commitment`,
      first_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: `${armKind}-tick-1`
      },
      first_tick_digest: `sha256:${armKind}-tick-1`,
      first_tick_observed_at: "2026-07-12T10:00:00.500Z"
    }))
  } as ResearchControlCampaignPaperStartBatchRecord;
}

function sourceVerdict(
  verdictOutcome: PaperTradingComparisonVerdictRecord["verdict_outcome"]
): PaperTradingComparisonVerdictRecord {
  return {
    record_kind: "paper_trading_comparison_verdict",
    paper_trading_comparison_verdict_id: "adaptive-source-verdict",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison"
    },
    paper_trading_comparison_commitment_digest:
      "sha256:adaptive_treatment-commitment",
    verdict_outcome: verdictOutcome,
    verdict_digest: "sha256:source-verdict",
    evaluated_at: "2026-07-12T10:00:03.000Z"
  } as PaperTradingComparisonVerdictRecord;
}

function slotOutcome(input: {
  schedule: ResearchControlCampaignPaperScheduleRecord;
  armKind: ResearchControlCampaignArmKind;
  sequence: number;
  terminalEvidence: ResearchControlCampaignPaperSlotOutcomeRecord["terminal_evidence"];
  terminalAt: string;
}): ResearchControlCampaignPaperSlotOutcomeRecord {
  return {
    record_kind: "research_control_campaign_paper_slot_outcome",
    research_control_campaign_paper_slot_outcome_id:
      `slot-${input.armKind}-${input.sequence}`,
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: input.schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: input.schedule.schedule_digest,
    arm_kind: input.armKind,
    sequence: input.sequence,
    terminal_evidence: structuredClone(input.terminalEvidence),
    terminal_at: input.terminalAt,
    slot_outcome_digest: `sha256:slot-${input.armKind}`
  } as ResearchControlCampaignPaperSlotOutcomeRecord;
}

function port(store: WindowStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
