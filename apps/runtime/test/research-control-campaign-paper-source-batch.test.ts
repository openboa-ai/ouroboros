import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type { MarketSnapshot } from
  "@ouroboros/application/trading/research/types";
import type {
  PreparePaperTradingComparisonInput,
  VerifiedPaperTradingComparisonCommitmentGraph
} from "@ouroboros/application/trading/paper/comparison-coordinator";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingPublicExecutionSnapshotSummary,
  type PaperTradingComparisonTickRecord,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignPaperSlotTerminalEvidence,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import {
  ResearchControlCampaignPaperSourceBatchCoordinator,
  ResearchControlCampaignPaperSourceBatchError,
  type ResearchControlCampaignPaperTickCoordinatorFactory
} from "../src/candidate/arena/research-control-campaign-paper-source-batch";

describe("ResearchControlCampaign paper source batch coordinator", () => {
  it("prepares every candidate arm before one shared market capture", async () => {
    const fixture = sourceBatchFixture();
    const result = await fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });
    await fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    expect(result).toHaveLength(2);
    expect(fixture.operations.slice(0, 2)).toEqual([
      "prepare:adaptive_treatment",
      "prepare:static_control"
    ]);
    expect(fixture.operations.filter((operation) =>
      operation === "source:market"
    )).toHaveLength(1);
    expect(fixture.operations.filter((operation) =>
      operation === "source:execution"
    )).toHaveLength(1);
    const firstMarketRead = fixture.operations.findIndex((operation) =>
      operation.startsWith("source:")
    );
    expect(firstMarketRead).toBeGreaterThan(1);
    expect(fixture.prepareInputs.map((input) => input.champion)).toEqual([
      championInput(),
      championInput()
    ]);
    expect(fixture.prepareInputs.map((input) => input.challenger)).toEqual([
      challengerInput("adaptive_treatment"),
      challengerInput("static_control")
    ]);
  });

  it("keeps market and runtime effects at zero when one preparation fails", async () => {
    const fixture = sourceBatchFixture({ failPreparation: "static_control" });

    await expect(fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    })).rejects.toMatchObject({
      code: "research_control_campaign_paper_source_batch_preparation_failed"
    });
    await expect(fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperSourceBatchError);

    expect(fixture.operations).not.toContain("source:market");
    expect(fixture.operations).not.toContain("source:execution");
    expect(fixture.operations.some((operation) =>
      operation.startsWith("tick:") || operation.startsWith("runtime:")
    )).toBe(false);
  });

  it("captures byte-equivalent first-tick evidence with one source read", async () => {
    const fixture = sourceBatchFixture();
    await fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    const batch = await fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });
    const ticks = fixture.armStores.flatMap((store) => store.ticks);

    expect(batch.batch_status).toBe("paired_ready");
    expect(ticks).toHaveLength(2);
    expect(ticks[0]!.market_snapshot).toEqual(ticks[1]!.market_snapshot);
    expect(ticks[0]!.public_execution_snapshot).toEqual(
      ticks[1]!.public_execution_snapshot
    );
    expect(ticks[0]!.observed_at).toBe(ticks[1]!.observed_at);
    expect(fixture.coordinatorStore.batches).toEqual([batch]);
    expect(fixture.armStores.every((store) =>
      store.batches.length === 1
    )).toBe(true);
  });

  it("recovers a missing peer tick from the persisted tick without a new source read", async () => {
    const fixture = sourceBatchFixture({ sourceReadsFail: true });
    await fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });
    const persisted = tickRecord(
      fixture.armStores[0]!.commitment!,
      "2026-07-12T10:00:00.500Z"
    );
    fixture.armStores[0]!.ticks.push(persisted);

    const batch = await fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    expect(batch.batch_status).toBe("paired_ready");
    expect(fixture.operations).not.toContain("source:market");
    expect(fixture.operations).not.toContain("source:execution");
    expect(fixture.armStores[1]!.ticks[0]!.market_snapshot).toEqual(
      persisted.market_snapshot
    );
    expect(fixture.armStores[1]!.ticks[0]!.public_execution_snapshot).toEqual(
      persisted.public_execution_snapshot
    );
    expect(fixture.armStores[1]!.ticks[0]!.observed_at).toBe(
      persisted.observed_at
    );
  });

  it("does not backfill a missing peer tick after the source deadline", async () => {
    const fixture = sourceBatchFixture({
      now: "2026-07-12T10:00:01.001Z",
      sourceReadsFail: true
    });
    await fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });
    const persisted = tickRecord(
      fixture.armStores[0]!.commitment!,
      "2026-07-12T10:00:00.500Z"
    );
    fixture.armStores[0]!.ticks.push(persisted);

    const batch = await fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    expect(batch).toMatchObject({
      batch_status: "ineligible",
      ineligible_reason: "first_tick_incomplete"
    });
    expect(fixture.operations).not.toContain("source:market");
    expect(fixture.operations).not.toContain("source:execution");
    expect(fixture.armStores[0]!.ticks).toEqual([persisted]);
    expect(fixture.armStores[1]!.ticks).toEqual([]);
  });

  it("closes a no-tick batch after deadline without reading market data", async () => {
    const fixture = sourceBatchFixture({
      now: "2026-07-12T10:00:01.001Z",
      sourceReadsFail: true
    });
    await fixture.coordinator.prepare({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    const batch = await fixture.coordinator.captureStartBatch({
      campaign: fixture.campaign,
      schedule: fixture.schedule,
      sequence: 1
    });

    expect(batch).toMatchObject({
      batch_status: "ineligible",
      ineligible_reason: "first_tick_incomplete"
    });
    expect(fixture.operations).not.toContain("source:market");
    expect(fixture.operations).not.toContain("source:execution");
    expect(fixture.armStores.every((store) => store.ticks.length === 0)).toBe(true);

    for (const armKind of [
      "adaptive_treatment",
      "static_control"
    ] as const) {
      await fixture.coordinator.recordStartIneligibleSlotOutcome({
        schedule: fixture.schedule,
        batch,
        armKind
      });
    }
    expect(fixture.coordinatorStore.outcomes).toHaveLength(2);
    expect(fixture.coordinatorStore.outcomes.every((outcome) =>
      outcome.terminal_evidence.evidence_kind === "source_start_ineligible" &&
      outcome.terminal_evidence.terminal_status === "evidence_ineligible"
    )).toBe(true);
  });

  it("expires a completely unopened source slot only after its deadline", async () => {
    const exactDeadline = sourceBatchFixture({
      now: "2026-07-12T10:00:01.000Z"
    });
    await expect(exactDeadline.coordinator.expireUnstartedSourceSlot({
      schedule: exactDeadline.schedule,
      armKind: "adaptive_treatment",
      sequence: 1
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperSourceBatchError);

    const expired = sourceBatchFixture({
      now: "2026-07-12T10:00:01.001Z"
    });
    const outcome = await expired.coordinator.expireUnstartedSourceSlot({
      schedule: expired.schedule,
      armKind: "adaptive_treatment",
      sequence: 1
    });

    expect(outcome.terminal_evidence).toEqual({
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired",
      expired_at: "2026-07-12T10:00:01.001Z"
    });
    expect(expired.coordinatorStore.outcomes).toEqual([outcome]);
    expect(expired.operations.some((operation) =>
      operation.startsWith("source:") || operation.startsWith("tick:") ||
      operation.startsWith("runtime:")
    )).toBe(false);
  });

  it("expires a prepared source that never captured its first tick", async () => {
    const fixture = sourceBatchFixture({
      now: "2026-07-12T10:00:01.001Z"
    });
    fixture.armStores[0].preparation = preparationRecord("adaptive_treatment");
    fixture.armStores[0].commitment = commitmentRecord("adaptive_treatment");

    const outcome = await fixture.coordinator.expireUnstartedSourceSlot({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1
    });

    expect(outcome.terminal_evidence).toMatchObject({
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired"
    });
    expect(fixture.armStores[0].ticks).toEqual([]);
  });

  it("does not expire a source after its first tick exists", async () => {
    const fixture = sourceBatchFixture({
      now: "2026-07-12T10:00:01.001Z"
    });
    const preparation = preparationRecord("adaptive_treatment");
    const commitment = commitmentRecord("adaptive_treatment");
    fixture.armStores[0].preparation = preparation;
    fixture.armStores[0].commitment = commitment;
    fixture.armStores[0].ticks.push(tickRecord(
      commitment,
      "2026-07-12T10:00:00.500Z"
    ));

    await expect(fixture.coordinator.expireUnstartedSourceSlot({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1
    })).rejects.toBeInstanceOf(ResearchControlCampaignPaperSourceBatchError);
  });
});

class SourceStore {
  preparation?: PaperTradingComparisonPreparationRecord;
  commitment?: PaperTradingComparisonCommitmentRecord;
  ticks: PaperTradingComparisonTickRecord[] = [];
  batches: ResearchControlCampaignPaperStartBatchRecord[] = [];
  outcomes: ResearchControlCampaignPaperSlotOutcomeRecord[] = [];

  constructor(readonly armKind?: ResearchControlCampaignArmKind) {}

  root() {
    return this.armKind ?? "coordinator";
  }

  async getPaperTradingComparisonPreparation(id: string) {
    return this.preparation?.paper_trading_comparison_preparation_id === id
      ? structuredClone(this.preparation)
      : undefined;
  }

  async getPaperTradingComparisonCommitment(id: string) {
    return this.commitment?.paper_trading_comparison_commitment_id === id
      ? structuredClone(this.commitment)
      : undefined;
  }

  async listPaperTradingComparisonTicks(comparisonId: string) {
    return structuredClone(this.ticks.filter((tick) =>
      tick.paper_trading_comparison_commitment_ref.id === comparisonId
    ));
  }

  async getResearchControlCampaignPaperStartBatch(id: string) {
    return structuredClone(this.batches.find((batch) =>
      batch.research_control_campaign_paper_start_batch_id === id
    ));
  }

  async recordResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ) {
    return this.appendBatch(batch);
  }

  async replicateResearchControlCampaignPaperStartBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ) {
    return this.appendBatch(batch);
  }

  async getResearchControlCampaignPaperSlotOutcome(id: string) {
    return structuredClone(this.outcomes.find((outcome) =>
      outcome.research_control_campaign_paper_slot_outcome_id === id
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

  private appendBatch(batch: ResearchControlCampaignPaperStartBatchRecord) {
    const existing = this.batches.find((candidate) =>
      candidate.research_control_campaign_paper_start_batch_id ===
        batch.research_control_campaign_paper_start_batch_id
    );
    if (existing && JSON.stringify(existing) !== JSON.stringify(batch)) {
      throw new Error("batch_conflict");
    }
    if (!existing) this.batches.push(structuredClone(batch));
    return structuredClone(existing ?? batch);
  }

  private appendOutcome(outcome: ResearchControlCampaignPaperSlotOutcomeRecord) {
    const existing = this.outcomes.find((candidate) =>
      candidate.research_control_campaign_paper_slot_outcome_id ===
        outcome.research_control_campaign_paper_slot_outcome_id
    );
    if (existing && JSON.stringify(existing) !== JSON.stringify(outcome)) {
      throw new Error("outcome_conflict");
    }
    if (!existing) this.outcomes.push(structuredClone(outcome));
    return structuredClone(existing ?? outcome);
  }
}

function sourceBatchFixture(options: {
  failPreparation?: ResearchControlCampaignArmKind;
  sourceReadsFail?: boolean;
  now?: string;
} = {}) {
  const campaign = campaignFixture();
  const schedule = scheduleFixture(campaign);
  const promotion = promotionFixture();
  const confirmation = promotionConfirmationFixture();
  const operations: string[] = [];
  const prepareInputs: PreparePaperTradingComparisonInput[] = [];
  const coordinatorStore = new SourceStore();
  const armStores = [
    new SourceStore("adaptive_treatment"),
    new SourceStore("static_control")
  ] as const;
  Object.assign(coordinatorStore, {
    async getTradingPromotion(id: string) {
      return id === promotion.trading_promotion_id
        ? structuredClone(promotion)
        : undefined;
    },
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      return id === confirmation.paper_trading_comparison_confirmation_campaign_id
        ? structuredClone(confirmation)
        : undefined;
    }
  });
  const arms = Object.fromEntries(armStores.map((store) => [
    store.armKind!,
    {
      store: port(store),
      comparisons: {
        async prepare(input: PreparePaperTradingComparisonInput) {
          operations.push(`prepare:${store.armKind}`);
          prepareInputs.push(structuredClone(input));
          if (options.failPreparation === store.armKind) {
            throw new Error("injected_preparation_failure");
          }
          const preparation = preparationRecord(store.armKind!);
          const commitment = commitmentRecord(store.armKind!);
          store.preparation = preparation;
          store.commitment = commitment;
          return comparisonGraph(preparation, commitment);
        },
        async reload(id: string) {
          if (store.commitment?.paper_trading_comparison_commitment_id !== id ||
            !store.preparation) return undefined;
          return comparisonGraph(store.preparation, store.commitment);
        }
      }
    }
  ])) as ConstructorParameters<
    typeof ResearchControlCampaignPaperSourceBatchCoordinator
  >[0]["arms"];
  const marketData = marketPort(operations, options.sourceReadsFail ?? false);
  const now = options.now ?? "2026-07-12T10:00:00.500Z";
  const coordinator = new ResearchControlCampaignPaperSourceBatchCoordinator({
    coordinator: port(coordinatorStore),
    arms,
    marketData,
    now: () => now,
    createTickCoordinator: tickCoordinatorFactory(operations),
    decideStartBatch: (input) => batchRecord(
      input.schedule,
      input.sources.map((source) => ({
        armKind: source.armKind,
        comparison: source.comparison,
        firstTick: source.firstTick
      })),
      input.sourceStartDeadlineAt,
      input.evaluatedAt
    ),
    decideStartIneligibleSlotOutcome: (input) => slotOutcomeRecord(
      input.schedule,
      input.armKind,
      input.sequence,
      {
        evidence_kind: "source_start_ineligible",
        start_batch_ref: {
          record_kind: "research_control_campaign_paper_start_batch",
          id: input.startBatch.research_control_campaign_paper_start_batch_id
        },
        start_batch_digest: input.startBatch.start_batch_digest,
        terminal_status: "evidence_ineligible",
        reason: input.startBatch.ineligible_reason!,
        persisted_first_tick_refs: [],
        persisted_first_tick_digests: [],
        evaluated_at: input.startBatch.evaluated_at
      },
      input.startBatch.evaluated_at
    ),
    decideSlotOutcome: (input) => slotOutcomeRecord(
      input.schedule,
      input.armKind,
      input.sequence,
      input.terminalEvidence,
      input.terminalAt
    )
  });
  return {
    coordinator,
    coordinatorStore,
    armStores,
    campaign,
    schedule,
    operations,
    prepareInputs
  };
}

function tickCoordinatorFactory(
  operations: string[]
): ResearchControlCampaignPaperTickCoordinatorFactory {
  return ({ store, marketData, now }) => ({
    async captureFirstTick(input) {
      operations.push(`tick:${input.comparisonId}`);
      const [market, execution] = await Promise.all([
        marketData.readMarketSnapshot(),
        marketData.readPublicExecutionSnapshot()
      ]);
      const sourceStore = store as unknown as SourceStore;
      const comparison = sourceStore.commitment!;
      const tick = tickRecord(comparison, now(), market, execution);
      sourceStore.ticks.push(structuredClone(tick));
      return {
        comparison: comparisonGraph(sourceStore.preparation!, comparison),
        tick,
        marketDataView: {} as never
      };
    }
  });
}

function marketPort(
  operations: string[],
  fail: boolean
): GatewayMarketDataPort {
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_rest",
    rest_base_url: "https://example.invalid",
    required_endpoints: [],
    authority_status: "read_only",
    async readMarketSnapshot() {
      operations.push("source:market");
      if (fail) throw new Error("unexpected_market_read");
      return marketSnapshot();
    },
    async readPublicExecutionSnapshot() {
      operations.push("source:execution");
      if (fail) throw new Error("unexpected_execution_read");
      return executionSnapshot();
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("not_used");
    }
  };
}

function campaignFixture(): ResearchControlCampaignRecord {
  const promotion = promotionFixture();
  return {
    record_kind: "research_control_campaign",
    research_control_campaign_id: "campaign-001",
    campaign_digest: "sha256:campaign",
    paper_comparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: promotion.trading_promotion_id
      },
      trading_promotion_digest: digest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      ),
      candidate_ref: { ...promotion.candidate_ref },
      candidate_version_ref: { ...promotion.candidate_version_ref },
      paper_trading_evaluation_ref: {
        ...promotion.paper_trading_evaluation_ref
      }
    },
    paper_evaluation_protocol: {
      protocol_status: "bound",
      comparison_policy: {
        comparison_mode: "champion_challenge"
      },
      market_data_configuration_digest: "sha256:market-config",
      paper_policy_identity: { policy_version: "fixture" },
      schedule_policy: {
        confirmation_precommit_deadline_ms: 1_000
      },
      protocol_digest: "sha256:protocol"
    }
  } as unknown as ResearchControlCampaignRecord;
}

function scheduleFixture(
  campaign: ResearchControlCampaignRecord
): ResearchControlCampaignPaperScheduleRecord {
  return {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    paper_comparator: structuredClone(campaign.paper_comparator),
    paper_evaluation_protocol_digest: "sha256:protocol",
    committed_at: "2026-07-12T10:00:00.000Z",
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

function promotionFixture(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    trading_promotion_id: "promotion-001",
    candidate_ref: { record_kind: "trading_system_candidate", id:
      "champion-candidate" },
    candidate_version_ref: { record_kind: "candidate_version", id:
      "champion-version" },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "champion-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "promotion-confirmation"
      },
      campaign_digest: "sha256:promotion-confirmation"
    }
  } as TradingPromotionRecord;
}

function promotionConfirmationFixture():
PaperTradingComparisonConfirmationCampaignRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    paper_trading_comparison_confirmation_campaign_id: "promotion-confirmation",
    challenger: {
      candidate_ref: { record_kind: "trading_system_candidate", id:
        "champion-candidate" },
      candidate_version_ref: { record_kind: "candidate_version", id:
        "champion-version" },
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "champion-admission"
      }
    },
    campaign_digest: "sha256:promotion-confirmation"
  } as PaperTradingComparisonConfirmationCampaignRecord;
}

function championInput() {
  return {
    candidateId: "champion-candidate",
    candidateVersionId: "champion-version",
    admissionDecisionId: "champion-admission"
  };
}

function challengerInput(armKind: ResearchControlCampaignArmKind) {
  return {
    candidateId: `${armKind}-candidate`,
    candidateVersionId: `${armKind}-version`,
    admissionDecisionId: `${armKind}-admission`
  };
}

function preparationRecord(
  armKind: ResearchControlCampaignArmKind
): PaperTradingComparisonPreparationRecord {
  return {
    record_kind: "paper_trading_comparison_preparation",
    paper_trading_comparison_preparation_id: `${armKind}-preparation`,
    paper_trading_comparison_commitment_id: `${armKind}-comparison`
  } as PaperTradingComparisonPreparationRecord;
}

function commitmentRecord(
  armKind: ResearchControlCampaignArmKind
): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    paper_trading_comparison_commitment_id: `${armKind}-comparison`,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: `${armKind}-preparation`
    },
    commitment_digest: `sha256:${armKind}-commitment`
  } as PaperTradingComparisonCommitmentRecord;
}

function comparisonGraph(
  preparation: PaperTradingComparisonPreparationRecord,
  commitment: PaperTradingComparisonCommitmentRecord
): VerifiedPaperTradingComparisonCommitmentGraph {
  return {
    preparation,
    commitment,
    verification: { status: "verified", activation_authority: "not_granted" }
  } as VerifiedPaperTradingComparisonCommitmentGraph;
}

function tickRecord(
  commitment: PaperTradingComparisonCommitmentRecord,
  observedAt: string,
  market: MarketSnapshot = marketSnapshot(),
  execution: PaperTradingPublicExecutionSnapshotSummary = executionSnapshot()
): PaperTradingComparisonTickRecord {
  return {
    record_kind: "paper_trading_comparison_tick",
    paper_trading_comparison_tick_id:
      `${commitment.paper_trading_comparison_commitment_id}-first-tick`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: commitment.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: commitment.commitment_digest,
    sequence: 1,
    market_snapshot: { ...market, authority_status: "read_only" },
    public_execution_snapshot: structuredClone(execution),
    observed_at: observedAt,
    tick_digest: `sha256:${commitment.paper_trading_comparison_commitment_id}-tick`
  } as PaperTradingComparisonTickRecord;
}

function marketSnapshot(): MarketSnapshot {
  return {
    symbol: "BTCUSDT",
    price: 100_000,
    moving_average_fast: 100_100,
    moving_average_slow: 99_900,
    volatility: 0.01,
    expected_direction: "long" as const,
    observed_at: "2026-07-12T10:00:00.400Z",
    source_kind: "binance_production_public_rest" as const
  };
}

function executionSnapshot(): PaperTradingPublicExecutionSnapshotSummary {
  return {
    symbol: "BTCUSDT" as const,
    observed_at: "2026-07-12T10:00:00.400Z",
    source_kind: "binance_production_public_rest" as const,
    stream_marker: "fixture",
    agg_trades: [],
    authority_status: "read_only" as const
  };
}

function batchRecord(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  sources: Array<{
    armKind: ResearchControlCampaignArmKind;
    comparison: PaperTradingComparisonCommitmentRecord;
    firstTick?: PaperTradingComparisonTickRecord;
  }>,
  deadline: string,
  evaluatedAt: string
): ResearchControlCampaignPaperStartBatchRecord {
  const complete = sources.every((source) => source.firstTick);
  return {
    record_kind: "research_control_campaign_paper_start_batch",
    research_control_campaign_paper_start_batch_id: "batch-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: schedule.schedule_digest,
    sequence: 1,
    batch_status: complete ? "paired_ready" : "ineligible",
    sides: sources.map((source) => ({
      arm_kind: source.armKind,
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: source.comparison.paper_trading_comparison_commitment_id
      },
      source_comparison_digest: source.comparison.commitment_digest,
      ...(source.firstTick ? {
        first_tick_ref: {
          record_kind: "paper_trading_comparison_tick",
          id: source.firstTick.paper_trading_comparison_tick_id
        },
        first_tick_digest: source.firstTick.tick_digest,
        first_tick_observed_at: source.firstTick.observed_at
      } : {})
    })),
    source_start_deadline_at: deadline,
    ...(complete ? {} : { ineligible_reason: "first_tick_incomplete" as const }),
    evaluated_at: evaluatedAt,
    start_batch_digest: "sha256:batch"
  } as ResearchControlCampaignPaperStartBatchRecord;
}

function slotOutcomeRecord(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: ResearchControlCampaignArmKind,
  sequence: number,
  terminalEvidence: ResearchControlCampaignPaperSlotTerminalEvidence,
  terminalAt: string
): ResearchControlCampaignPaperSlotOutcomeRecord {
  return {
    record_kind: "research_control_campaign_paper_slot_outcome",
    research_control_campaign_paper_slot_outcome_id:
      `slot-outcome-${armKind}-${sequence}`,
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: schedule.research_control_campaign_paper_schedule_id
    },
    schedule_digest: schedule.schedule_digest,
    arm_kind: armKind,
    sequence,
    terminal_evidence: structuredClone(terminalEvidence),
    terminal_at: terminalAt,
    slot_outcome_digest: `sha256:slot-${armKind}-${sequence}`
  } as ResearchControlCampaignPaperSlotOutcomeRecord;
}

function digest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function port(store: SourceStore): OuroborosStorePort {
  return store as unknown as OuroborosStorePort;
}
