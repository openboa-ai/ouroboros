import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  decideResearchControlCampaignPaperStartBatch,
  researchControlCampaignPaperStartBatchId,
  type ResearchControlCampaignPaperStartBatchSource
} from "@ouroboros/application/candidate/research-control-campaign-paper-start-batch";
import {
  decideResearchControlCampaignPaperSlotOutcome,
  decideResearchControlCampaignPaperStartIneligibleSlotOutcome,
  researchControlCampaignPaperSlotOutcomeId
} from "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonCoordinator,
  PreparePaperTradingComparisonInput,
  VerifiedPaperTradingComparisonCommitmentGraph
} from "@ouroboros/application/trading/paper/comparison-coordinator";
import {
  PaperTradingComparisonTickCoordinator
} from "@ouroboros/application/trading/paper/comparison-tick-coordinator";
import type { MarketSnapshot } from
  "@ouroboros/application/trading/research/types";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonTickRecord,
  type PaperTradingPublicExecutionSnapshotSummary,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperScheduleSlot,
  type ResearchControlCampaignPaperSlotOutcomeRecord,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignRecord
} from "@ouroboros/domain";

export type ResearchControlCampaignPaperSourceBatchErrorCode =
  | "research_control_campaign_paper_source_batch_graph_invalid"
  | "research_control_campaign_paper_source_batch_preparation_failed"
  | "research_control_campaign_paper_source_batch_not_prepared"
  | "research_control_campaign_paper_source_batch_market_read_failed"
  | "research_control_campaign_paper_source_batch_persistence_failed";

export class ResearchControlCampaignPaperSourceBatchError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperSourceBatchErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperSourceBatchError";
  }
}

type ArmComparisonCoordinator = Pick<
  PaperTradingComparisonCoordinator,
  "prepare" | "reload"
>;

export interface ResearchControlCampaignPaperSourceArm {
  store: OuroborosStorePort;
  comparisons: ArmComparisonCoordinator;
}

export type ResearchControlCampaignPaperTickCoordinatorFactory = (input: {
  store: OuroborosStorePort;
  comparisons: Pick<PaperTradingComparisonCoordinator, "reload">;
  marketData: GatewayMarketDataPort;
  now: () => string;
}) => Pick<PaperTradingComparisonTickCoordinator, "captureFirstTick">;

export interface PreparedResearchControlCampaignPaperSource {
  armKind: ResearchControlCampaignArmKind;
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
}

export class ResearchControlCampaignPaperSourceBatchCoordinator {
  private readonly now: () => string;
  private readonly createTickCoordinator:
    ResearchControlCampaignPaperTickCoordinatorFactory;
  private readonly decideStartBatch:
    typeof decideResearchControlCampaignPaperStartBatch;
  private readonly decideSlotOutcome:
    typeof decideResearchControlCampaignPaperSlotOutcome;
  private readonly decideStartIneligibleSlotOutcome:
    typeof decideResearchControlCampaignPaperStartIneligibleSlotOutcome;

  constructor(private readonly options: {
    coordinator: OuroborosStorePort;
    arms: Record<
      ResearchControlCampaignArmKind,
      ResearchControlCampaignPaperSourceArm
    >;
    marketData: GatewayMarketDataPort;
    now?: () => string;
    createTickCoordinator?: ResearchControlCampaignPaperTickCoordinatorFactory;
    decideStartBatch?: typeof decideResearchControlCampaignPaperStartBatch;
    decideSlotOutcome?: typeof decideResearchControlCampaignPaperSlotOutcome;
    decideStartIneligibleSlotOutcome?:
      typeof decideResearchControlCampaignPaperStartIneligibleSlotOutcome;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.createTickCoordinator = options.createTickCoordinator ?? ((input) =>
      new PaperTradingComparisonTickCoordinator(input)
    );
    this.decideStartBatch = options.decideStartBatch ??
      decideResearchControlCampaignPaperStartBatch;
    this.decideSlotOutcome = options.decideSlotOutcome ??
      decideResearchControlCampaignPaperSlotOutcome;
    this.decideStartIneligibleSlotOutcome =
      options.decideStartIneligibleSlotOutcome ??
        decideResearchControlCampaignPaperStartIneligibleSlotOutcome;
  }

  async prepare(input: {
    campaign: ResearchControlCampaignRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
    sequence: number;
  }): Promise<PreparedResearchControlCampaignPaperSource[]> {
    const context = await this.resolvePreparationContext(input);
    const settled = await Promise.allSettled(context.slots.map(async (source) => {
      const comparison = await this.options.arms[source.armKind]
        .comparisons.prepare({
          idempotencyKey: source.slot.source_comparison_idempotency_key,
          champion: context.champion,
          challenger: {
            candidateId: source.slot.candidate_ref.id,
            candidateVersionId: source.slot.candidate_version_ref.id,
            admissionDecisionId: source.slot.admission_decision_ref.id
          },
          comparisonPolicy: structuredClone(
            context.campaign.paper_evaluation_protocol.comparison_policy
          ),
          marketDataConfigurationDigest:
            context.campaign.paper_evaluation_protocol
              .market_data_configuration_digest,
          paperPolicyIdentity: structuredClone(
            context.campaign.paper_evaluation_protocol.paper_policy_identity
          )
        });
      if (comparison.preparation.paper_trading_comparison_preparation_id !==
          source.slot.source_preparation_id ||
        comparison.commitment.paper_trading_comparison_commitment_id !==
          source.slot.source_comparison_commitment_id ||
        comparison.commitment.preparation_ref.id !==
          source.slot.source_preparation_id ||
        comparison.verification.status !== "verified" ||
        comparison.verification.activation_authority !== "not_granted") {
        throw sourceError(
          "research_control_campaign_paper_source_batch_graph_invalid",
          "Prepared source comparison differs from its frozen schedule slot."
        );
      }
      return { armKind: source.armKind, comparison };
    }));
    const failures = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [{
            arm_kind: context.slots[index]!.armKind,
            reason: conciseError(result.reason)
          }]
        : []
    );
    if (failures.length > 0) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_preparation_failed",
        "At least one scheduled source comparison failed before market effects.",
        { failures }
      );
    }
    return settled.map((result) =>
      (result as PromiseFulfilledResult<
        PreparedResearchControlCampaignPaperSource
      >).value
    );
  }

  async captureStartBatch(input: {
    campaign: ResearchControlCampaignRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
    sequence: number;
  }): Promise<ResearchControlCampaignPaperStartBatchRecord> {
    const context = this.resolveScheduleContext(input);
    const batchId = researchControlCampaignPaperStartBatchId(
      input.schedule,
      input.sequence
    );
    const existing = await this.options.coordinator
      .getResearchControlCampaignPaperStartBatch(batchId);
    if (existing) {
      await this.replicateBatch(existing);
      return existing;
    }

    const sources = await Promise.all(context.slots.map(async (source) => {
      const arm = this.options.arms[source.armKind];
      const [preparation, comparison, ticks] = await Promise.all([
        arm.store.getPaperTradingComparisonPreparation(
          source.slot.source_preparation_id
        ),
        arm.store.getPaperTradingComparisonCommitment(
          source.slot.source_comparison_commitment_id
        ),
        arm.store.listPaperTradingComparisonTicks(
          source.slot.source_comparison_commitment_id
        )
      ]);
      const firstTicks = ticks.filter((tick) => tick.sequence === 1);
      if (!preparation || !comparison || firstTicks.length > 1 ||
        preparation.paper_trading_comparison_preparation_id !==
          source.slot.source_preparation_id ||
        preparation.paper_trading_comparison_commitment_id !==
          source.slot.source_comparison_commitment_id ||
        comparison.paper_trading_comparison_commitment_id !==
          source.slot.source_comparison_commitment_id ||
        comparison.preparation_ref.id !== source.slot.source_preparation_id) {
        throw sourceError(
          "research_control_campaign_paper_source_batch_not_prepared",
          "Every source slot must have one exact preparation and commitment before capture.",
          { arm_kind: source.armKind, sequence: input.sequence }
        );
      }
      return {
        armKind: source.armKind,
        comparison,
        firstTick: firstTicks[0]
      } satisfies ResearchControlCampaignPaperStartBatchSource;
    }));
    const sourceStartDeadlineAt = await this.sourceStartDeadlineAt(
      input.schedule,
      input.sequence,
      context.slots
    );
    const evaluatedAt = exactTime(this.now());
    const persistedTicks = sources.flatMap((source) =>
      source.firstTick ? [source.firstTick] : []
    );

    let frozen: ResearchControlCampaignPaperFrozenMarketEvidence | undefined;
    if (persistedTicks.length > 0) {
      frozen = researchControlCampaignPaperFrozenEvidenceFromTick(
        persistedTicks[0]!
      );
      for (const tick of persistedTicks.slice(1)) {
        if (tick.observed_at !== persistedTicks[0]!.observed_at ||
          !isDeepStrictEqual(tick.market_snapshot, persistedTicks[0]!.market_snapshot) ||
          !isDeepStrictEqual(
            tick.public_execution_snapshot,
            persistedTicks[0]!.public_execution_snapshot
          )) {
          throw sourceError(
            "research_control_campaign_paper_source_batch_graph_invalid",
            "Persisted paired first ticks do not share exact market evidence."
          );
        }
      }
    } else if (Date.parse(evaluatedAt) <= Date.parse(sourceStartDeadlineAt)) {
      frozen = await this.captureFrozenMarketEvidence(evaluatedAt);
    }

    if (frozen) {
      const missing = sources.filter((source) => !source.firstTick);
      const captured = await Promise.all(missing.map(async (source) => {
        const arm = this.options.arms[source.armKind];
        const ticks = this.createTickCoordinator({
          store: arm.store,
          comparisons: arm.comparisons,
          marketData: researchControlCampaignPaperFrozenMarketPort(
            this.options.marketData,
            frozen!
          ),
          now: () => frozen!.observedAt
        });
        return {
          armKind: source.armKind,
          captured: await ticks.captureFirstTick({
            comparisonId:
              source.comparison.paper_trading_comparison_commitment_id,
            idempotencyKey: [
              "research-control-paper-start",
              input.schedule.research_control_campaign_paper_schedule_id,
              input.sequence,
              source.armKind
            ].join(":")
          })
        };
      }));
      for (const item of captured) {
        const source = sources.find((candidate) =>
          candidate.armKind === item.armKind
        )!;
        source.firstTick = item.captured.tick;
      }
    }

    let batch: ResearchControlCampaignPaperStartBatchRecord;
    try {
      batch = this.decideStartBatch({
        campaign: input.campaign,
        schedule: input.schedule,
        sequence: input.sequence,
        sources,
        sourceStartDeadlineAt,
        evaluatedAt
      });
    } catch (error) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source first-tick evidence cannot form the frozen start batch.",
        undefined,
        error
      );
    }
    const recorded = await this.options.coordinator
      .recordResearchControlCampaignPaperStartBatch(batch);
    if (!isDeepStrictEqual(recorded, batch)) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_persistence_failed",
        "Coordinator did not preserve the exact source start batch."
      );
    }
    await this.replicateBatch(batch);
    return batch;
  }

  async recordStartIneligibleSlotOutcome(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    batch: ResearchControlCampaignPaperStartBatchRecord;
    armKind: ResearchControlCampaignArmKind;
  }): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    if (input.batch.batch_status !== "ineligible" ||
      input.batch.schedule_ref.id !==
        input.schedule.research_control_campaign_paper_schedule_id ||
      input.batch.schedule_digest !== input.schedule.schedule_digest ||
      !input.batch.sides.some((side) => side.arm_kind === input.armKind)) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Only an exact ineligible start batch can close its source slot."
      );
    }
    const outcome = this.decideStartIneligibleSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.batch.sequence,
      startBatch: input.batch
    });
    return this.recordAndReplicateSlotOutcome(input.armKind, outcome);
  }

  async expireUnopenedSourceSlot(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    armKind: ResearchControlCampaignArmKind;
    sequence: number;
  }): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    const candidate = candidateSlots(input.schedule, input.sequence).find((slot) =>
      slot.armKind === input.armKind
    );
    if (!candidate) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source slot expiry target is not a scheduled candidate."
      );
    }
    const arm = this.options.arms[input.armKind];
    const [preparation, commitment, applicableStartAt] = await Promise.all([
      arm.store.getPaperTradingComparisonPreparation(
        candidate.slot.source_preparation_id
      ),
      arm.store.getPaperTradingComparisonCommitment(
        candidate.slot.source_comparison_commitment_id
      ),
      this.sourceApplicableStartAt(input.schedule, input.sequence)
    ]);
    const expiredAt = exactTime(this.now());
    const deadline = Date.parse(applicableStartAt) +
      candidate.slot.maximum_source_start_delay_ms;
    if (preparation || commitment || Date.parse(expiredAt) <= deadline) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source slot is opened or its missed-start deadline has not elapsed."
      );
    }
    const outcome = this.decideSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.sequence,
      terminalEvidence: {
        evidence_kind: "source_slot_expired",
        terminal_status: "paper_slot_expired",
        expired_at: expiredAt
      },
      terminalAt: expiredAt
    });
    return this.recordAndReplicateSlotOutcome(input.armKind, outcome);
  }

  private async resolvePreparationContext(input: {
    campaign: ResearchControlCampaignRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
    sequence: number;
  }): Promise<ScheduleContext & {
    campaign: BoundCampaign;
    champion: PreparePaperTradingComparisonInput["champion"];
  }> {
    const context = this.resolveScheduleContext(input);
    const comparator = context.campaign.paper_comparator;
    const promotion = await this.options.coordinator.getTradingPromotion(
      comparator.trading_promotion_ref.id
    );
    if (!promotion || promotion.trading_promotion_id !==
        comparator.trading_promotion_ref.id ||
      canonicalDigest(paperTradingComparisonTradingPromotionDigestInput(
        promotion
      )) !== comparator.trading_promotion_digest ||
      !isDeepStrictEqual(promotion.candidate_ref, comparator.candidate_ref) ||
      !isDeepStrictEqual(
        promotion.candidate_version_ref,
        comparator.candidate_version_ref
      ) || !isDeepStrictEqual(
        promotion.paper_trading_evaluation_ref,
        comparator.paper_trading_evaluation_ref
      )) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Trading review comparator promotion differs from the campaign commitment."
      );
    }
    const confirmation = await this.options.coordinator
      .getPaperTradingComparisonConfirmationCampaign(
        promotion.comparison_confirmation.campaign_ref.id
      );
    if (!confirmation || !promotionCampaignMatches(
      promotion.comparison_confirmation.campaign_digest,
      confirmation,
      comparator
    )) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Trading review comparator lacks its exact confirmation campaign."
      );
    }
    return {
      ...context,
      champion: {
        candidateId: comparator.candidate_ref.id,
        candidateVersionId: comparator.candidate_version_ref.id,
        admissionDecisionId:
          confirmation.challenger.candidate_admission_decision_ref.id
      }
    };
  }

  private resolveScheduleContext(input: {
    campaign: ResearchControlCampaignRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
    sequence: number;
  }): ScheduleContext {
    const campaign = input.campaign as BoundCampaign;
    if (!input || !Number.isInteger(input.sequence) || input.sequence < 1 ||
      campaign.paper_comparator?.comparator_status !== "trading_review" ||
      campaign.paper_evaluation_protocol?.protocol_status !== "bound" ||
      input.schedule.campaign_ref.id !==
        campaign.research_control_campaign_id ||
      input.schedule.campaign_digest !== campaign.campaign_digest ||
      !isDeepStrictEqual(
        input.schedule.paper_comparator,
        campaign.paper_comparator
      ) || input.schedule.paper_evaluation_protocol_digest !==
        campaign.paper_evaluation_protocol.protocol_digest) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Campaign and paper schedule are not one exact bound graph."
      );
    }
    const slots = candidateSlots(input.schedule, input.sequence);
    if (slots.length < 1 || slots.length > 2) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source batch sequence must contain one or two scheduled candidates."
      );
    }
    return { campaign, slots };
  }

  private async sourceStartDeadlineAt(
    schedule: ResearchControlCampaignPaperScheduleRecord,
    sequence: number,
    slots: CandidateSlot[]
  ): Promise<string> {
    const applicableStart = await this.sourceApplicableStartAt(
      schedule,
      sequence
    );
    const maximumDelay = Math.max(...slots.map(({ slot }) =>
      slot.maximum_source_start_delay_ms
    ));
    return new Date(Date.parse(applicableStart) + maximumDelay).toISOString();
  }

  private async sourceApplicableStartAt(
    schedule: ResearchControlCampaignPaperScheduleRecord,
    sequence: number
  ): Promise<string> {
    if (sequence === 1) return schedule.committed_at;
    const priorTerminalTimes = await Promise.all(schedule.arms.map(async (arm) => {
      const prior = arm.slots.find((slot) => slot.sequence === sequence - 1);
      if (!prior) throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source batch predecessor slot is absent."
      );
      if (prior.slot_status === "no_admitted_candidate") {
        return schedule.committed_at;
      }
      const outcome = await this.options.coordinator
        .getResearchControlCampaignPaperSlotOutcome(
          researchControlCampaignPaperSlotOutcomeId(
            schedule,
            arm.arm_kind,
            sequence - 1
          )
        );
      if (!outcome) throw sourceError(
        "research_control_campaign_paper_source_batch_graph_invalid",
        "Source batch predecessor is not terminal."
      );
      return outcome.terminal_at;
    }));
    return priorTerminalTimes.reduce((latest, value) =>
      Date.parse(value) > Date.parse(latest) ? value : latest
    );
  }

  private async captureFrozenMarketEvidence(
    observedAt: string
  ): Promise<ResearchControlCampaignPaperFrozenMarketEvidence> {
    try {
      const [market, publicExecution] = await Promise.all([
        this.options.marketData.readMarketSnapshot({ observedAt }),
        this.options.marketData.readPublicExecutionSnapshot({ observedAt })
      ]);
      return {
        market: structuredClone(market),
        publicExecution: structuredClone(publicExecution),
        observedAt
      };
    } catch (error) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_market_read_failed",
        "Shared source first-tick market evidence could not be captured.",
        undefined,
        error
      );
    }
  }

  private async replicateBatch(
    batch: ResearchControlCampaignPaperStartBatchRecord
  ): Promise<void> {
    for (const side of batch.sides) {
      const arm = this.options.arms[side.arm_kind];
      const recorded = await arm.store
        .replicateResearchControlCampaignPaperStartBatch(batch);
      const reloaded = await arm.store.getResearchControlCampaignPaperStartBatch(
        batch.research_control_campaign_paper_start_batch_id
      );
      if (!isDeepStrictEqual(recorded, batch) ||
        !isDeepStrictEqual(reloaded, batch)) {
        throw sourceError(
          "research_control_campaign_paper_source_batch_persistence_failed",
          "Arm store did not preserve the exact source start batch.",
          { arm_kind: side.arm_kind }
        );
      }
    }
  }

  private async recordAndReplicateSlotOutcome(
    armKind: ResearchControlCampaignArmKind,
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    const armRecorded = await this.options.arms[armKind].store
      .recordResearchControlCampaignPaperSlotOutcome(outcome);
    const coordinatorRecorded = await this.options.coordinator
      .replicateResearchControlCampaignPaperSlotOutcome(outcome);
    const coordinatorReloaded = await this.options.coordinator
      .getResearchControlCampaignPaperSlotOutcome(
        outcome.research_control_campaign_paper_slot_outcome_id
      );
    if (!isDeepStrictEqual(armRecorded, outcome) ||
      !isDeepStrictEqual(coordinatorRecorded, outcome) ||
      !isDeepStrictEqual(coordinatorReloaded, outcome)) {
      throw sourceError(
        "research_control_campaign_paper_source_batch_persistence_failed",
        "Source slot outcome was not preserved across arm and coordinator stores.",
        { arm_kind: armKind }
      );
    }
    return outcome;
  }
}

type BoundCampaign = ResearchControlCampaignRecord & {
  paper_comparator: Extract<
    ResearchControlCampaignRecord["paper_comparator"],
    { comparator_status: "trading_review" }
  >;
  paper_evaluation_protocol: Extract<
    ResearchControlCampaignRecord["paper_evaluation_protocol"],
    { protocol_status: "bound" }
  >;
};

interface CandidateSlot {
  armKind: ResearchControlCampaignArmKind;
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >;
}

interface ScheduleContext {
  campaign: BoundCampaign;
  slots: CandidateSlot[];
}

export interface ResearchControlCampaignPaperFrozenMarketEvidence {
  market: MarketSnapshot;
  publicExecution: PaperTradingPublicExecutionSnapshotSummary;
  observedAt: string;
}

function candidateSlots(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  sequence: number
): CandidateSlot[] {
  return schedule.arms.flatMap((arm) => {
    const slot = arm.slots.find((candidate) =>
      candidate.sequence === sequence
    );
    return slot?.slot_status === "candidate_scheduled"
      ? [{ armKind: arm.arm_kind, slot }]
      : [];
  });
}

function promotionCampaignMatches(
  expectedDigest: string,
  confirmation: PaperTradingComparisonConfirmationCampaignRecord,
  comparator: BoundCampaign["paper_comparator"]
): boolean {
  return confirmation.campaign_digest === expectedDigest &&
    isDeepStrictEqual(
      confirmation.challenger.candidate_ref,
      comparator.candidate_ref
    ) && isDeepStrictEqual(
      confirmation.challenger.candidate_version_ref,
      comparator.candidate_version_ref
    );
}

export function researchControlCampaignPaperFrozenEvidenceFromTick(
  tick: PaperTradingComparisonTickRecord
): ResearchControlCampaignPaperFrozenMarketEvidence {
  const summary = tick.market_snapshot;
  return {
    market: {
      symbol: summary.symbol,
      price: summary.price,
      moving_average_fast: summary.moving_average_fast as number,
      moving_average_slow: summary.moving_average_slow as number,
      volatility: summary.volatility as number,
      expected_direction: summary.expected_direction as
        MarketSnapshot["expected_direction"],
      observed_at: summary.observed_at,
      source_kind: summary.source_kind,
      source_priority: summary.source_priority,
      freshness: summary.freshness,
      ws_connected: summary.ws_connected,
      rest_fallback_used: summary.rest_fallback_used,
      gap_detected: summary.gap_detected,
      last_update_id: summary.last_update_id,
      stream_marker: summary.stream_marker
    },
    publicExecution: structuredClone(tick.public_execution_snapshot),
    observedAt: tick.observed_at
  };
}

export function researchControlCampaignPaperFrozenMarketPort(
  source: GatewayMarketDataPort,
  frozen: ResearchControlCampaignPaperFrozenMarketEvidence
): GatewayMarketDataPort {
  return {
    provider_kind: source.provider_kind,
    source_kind: source.source_kind,
    rest_base_url: source.rest_base_url,
    required_endpoints: source.required_endpoints,
    authority_status: "read_only",
    async readMarketSnapshot() {
      return structuredClone(frozen.market);
    },
    async readPublicExecutionSnapshot() {
      return structuredClone(frozen.publicExecution);
    },
    async readPublicMarketLivenessSurface(input) {
      return source.readPublicMarketLivenessSurface(input);
    }
  };
}

function canonicalDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function exactTime(value: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw sourceError(
      "research_control_campaign_paper_source_batch_graph_invalid",
      "Source batch clock must return an exact ISO timestamp."
    );
  }
  return value;
}

function conciseError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}:${error.message}`.slice(0, 240)
    : "unknown_error";
}

function sourceError(
  code: ResearchControlCampaignPaperSourceBatchErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): ResearchControlCampaignPaperSourceBatchError {
  return new ResearchControlCampaignPaperSourceBatchError(
    code,
    message,
    details,
    cause === undefined ? undefined : { cause }
  );
}
