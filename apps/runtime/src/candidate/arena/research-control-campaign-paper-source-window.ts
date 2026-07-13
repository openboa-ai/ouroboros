import { isDeepStrictEqual } from "node:util";
import {
  decideResearchControlCampaignPaperSlotOutcome
} from "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonActivationCoordinator,
  AuthorizedPaperTradingComparisonActivation
} from "@ouroboros/application/trading/paper/comparison-activation-coordinator";
import type {
  PaperTradingComparisonRuntimeActivationCoordinator,
  PaperTradingComparisonRuntimeActivationResult
} from "@ouroboros/application/trading/paper/comparison-runtime-activation-coordinator";
import type {
  PaperTradingComparisonVerdictService
} from "@ouroboros/application/trading/paper/comparison-verdict-service";
import type {
  PaperTradingComparisonWindowDriver,
  PaperTradingComparisonWindowStep
} from "@ouroboros/application/trading/paper/comparison-window-driver";
import type {
  PaperTradingComparisonWindowSnapshot,
  PaperTradingComparisonWindowStateReader
} from "@ouroboros/application/trading/paper/comparison-window-reader";
import {
  classifyPaperTradingComparisonWindow,
  type PaperTradingComparisonWindowDecision,
  type PaperTradingComparisonWindowTransition
} from "@ouroboros/application/trading/paper/comparison-window-state";
import type {
  PaperTradingComparisonVerdictRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperScheduleSlot,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignPaperStartBatchRecord
} from "@ouroboros/domain";
import {
  researchControlCampaignPaperFrozenEvidenceFromTick,
  researchControlCampaignPaperFrozenMarketPort,
  type ResearchControlCampaignPaperFrozenMarketEvidence
} from "./research-control-campaign-paper-source-batch";

export type ResearchControlCampaignPaperSourceWindowErrorCode =
  | "research_control_campaign_paper_source_window_graph_invalid"
  | "research_control_campaign_paper_source_window_authorization_failed"
  | "research_control_campaign_paper_source_window_start_failed"
  | "research_control_campaign_paper_source_window_transition_failed"
  | "research_control_campaign_paper_source_window_persistence_failed";

export class ResearchControlCampaignPaperSourceWindowError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperSourceWindowErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperSourceWindowError";
  }
}

export interface ResearchControlCampaignPaperWindowSource {
  armKind: ResearchControlCampaignArmKind;
  activationId: string;
  activationAttemptId: string;
}

export type ResearchControlCampaignPaperWindowDriverFactory = (input: {
  marketData: GatewayMarketDataPort;
  now: () => string;
}) => Pick<PaperTradingComparisonWindowDriver, "advance">;

export interface ResearchControlCampaignPaperSourceWindowArm {
  store: OuroborosStorePort;
  activations: Pick<PaperTradingComparisonActivationCoordinator, "authorize">;
  runtime: Pick<
    PaperTradingComparisonRuntimeActivationCoordinator,
    "recoverIncompleteActivations" | "start" | "stopOwnedAttempt"
  >;
  windowReader: PaperTradingComparisonWindowStateReader;
  createWindowDriver: ResearchControlCampaignPaperWindowDriverFactory;
  verdicts: Pick<PaperTradingComparisonVerdictService, "evaluate">;
}

export interface ResearchControlCampaignPaperSourceWindowAdvanceResult {
  transition: PaperTradingComparisonWindowTransition;
  steps: PaperTradingComparisonWindowStep[];
  terminal: boolean;
}

export class ResearchControlCampaignPaperSourceWindowCoordinator {
  private readonly now: () => string;
  private readonly decideSlotOutcome:
    typeof decideResearchControlCampaignPaperSlotOutcome;

  constructor(private readonly options: {
    coordinator: OuroborosStorePort;
    arms: Record<
      ResearchControlCampaignArmKind,
      ResearchControlCampaignPaperSourceWindowArm
    >;
    marketData: GatewayMarketDataPort;
    now?: () => string;
    decideSlotOutcome?: typeof decideResearchControlCampaignPaperSlotOutcome;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.decideSlotOutcome = options.decideSlotOutcome ??
      decideResearchControlCampaignPaperSlotOutcome;
  }

  async authorizeSourceBatch(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    batch: ResearchControlCampaignPaperStartBatchRecord;
  }): Promise<Array<{
    armKind: ResearchControlCampaignArmKind;
    authorization: AuthorizedPaperTradingComparisonActivation;
  }>> {
    const sides = readyBatchSides(input.schedule, input.batch);
    const settled = await Promise.allSettled(sides.map(async (side) => ({
      armKind: side.arm_kind,
      authorization: await this.options.arms[side.arm_kind].activations.authorize({
        comparisonId: side.source_comparison_ref.id,
        idempotencyKey: [
          "research-control-paper-activation",
          input.schedule.research_control_campaign_paper_schedule_id,
          input.batch.sequence,
          side.arm_kind
        ].join(":")
      })
    })));
    const failures = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [{
            arm_kind: sides[index]!.arm_kind,
            reason: conciseError(result.reason)
          }]
        : []
    );
    if (failures.length > 0) {
      throw windowError(
        "research_control_campaign_paper_source_window_authorization_failed",
        "Matched source batch authorization failed before runtime start.",
        { failures }
      );
    }
    return settled.map((result) =>
      (result as PromiseFulfilledResult<{
        armKind: ResearchControlCampaignArmKind;
        authorization: AuthorizedPaperTradingComparisonActivation;
      }>).value
    );
  }

  async startSourceBatch(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    batch: ResearchControlCampaignPaperStartBatchRecord;
  }): Promise<Array<{
    armKind: ResearchControlCampaignArmKind;
    result: PaperTradingComparisonRuntimeActivationResult;
  }>> {
    const authorized = await this.authorizeSourceBatch(input);
    const recoveries = await Promise.allSettled(authorized.map(async (source) => ({
      armKind: source.armKind,
      results: await this.options.arms[source.armKind].runtime
        .recoverIncompleteActivations()
    })));
    if (recoveries.some((result) => result.status === "rejected" ||
      result.value.results.some((recovery) =>
        recovery.status === "cleanup_required"
      ))) {
      throw windowError(
        "research_control_campaign_paper_source_window_start_failed",
        "Matched source activation recovery did not close cleanly."
      );
    }

    const settled = await Promise.allSettled(authorized.map(async (source) => ({
      armKind: source.armKind,
      result: await this.options.arms[source.armKind].runtime.start({
        activationId:
          source.authorization.activation.paper_trading_comparison_activation_id,
        idempotencyKey: [
          "research-control-paper-start",
          input.schedule.research_control_campaign_paper_schedule_id,
          input.batch.sequence,
          source.armKind
        ].join(":")
      })
    })));
    const started = settled.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
    const failed = settled.some((result) => result.status === "rejected" ||
      result.value.result.status !== "both_running"
    );
    if (failed) {
      await Promise.allSettled(started.filter(({ result }) =>
        result.status === "both_running"
      ).map(({ armKind, result }) =>
        this.options.arms[armKind].runtime.stopOwnedAttempt({
          attemptId:
            result.attempt.paper_trading_comparison_activation_attempt_id,
          reason: "handoff_cleanup"
        })
      ));
      throw windowError(
        "research_control_campaign_paper_source_window_start_failed",
        "Matched source comparisons did not both reach running state."
      );
    }
    return started;
  }

  async advanceSourceWindow(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    batch: ResearchControlCampaignPaperStartBatchRecord;
    sources: ResearchControlCampaignPaperWindowSource[];
  }): Promise<ResearchControlCampaignPaperSourceWindowAdvanceResult> {
    const sides = readyBatchSides(input.schedule, input.batch);
    const sources = matchWindowSources(sides, input.sources);
    const snapshots = await Promise.all(sources.map(async (source) => ({
      source,
      snapshot: await this.options.arms[source.armKind].windowReader.load({
        activationId: source.activationId,
        activationAttemptId: source.activationAttemptId
      })
    })));
    const decisions = snapshots.map(({ snapshot }) =>
      classifyPaperTradingComparisonWindow(snapshot.facts)
    );
    const partial = partialRepeatedTick(snapshots, decisions);
    if (partial) {
      const tick = await this.options.arms[partial.persisted.source.armKind].store
        .getPaperTradingComparisonTick(
          partial.persisted.snapshot.latest_tick_id
        );
      if (!tick) throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Partial repeated-tick recovery lacks the persisted peer tick."
      );
      const frozen = researchControlCampaignPaperFrozenEvidenceFromTick(tick);
      const step = await this.advanceOne(
        partial.missing.source,
        frozen,
        "capture_next_tick"
      );
      return { transition: "capture_next_tick", steps: [step], terminal: false };
    }
    const transition = uniqueTransition(decisions);
    const terminal = decisions.every((decision) => decision.terminal);
    if (decisions.some((decision) => decision.terminal !== terminal)) {
      throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Matched source window terminal states diverged."
      );
    }
    const frozen = transition === "capture_next_tick"
      ? await this.captureFrozenMarketEvidence()
      : undefined;
    const settled = await Promise.allSettled(sources.map((source) =>
      this.advanceOne(source, frozen, transition)
    ));
    if (settled.some((result) => result.status === "rejected")) {
      await Promise.allSettled(sources.map((source) =>
        this.options.arms[source.armKind].runtime.stopOwnedAttempt({
          attemptId: source.activationAttemptId,
          reason: "handoff_cleanup"
        })
      ));
      throw windowError(
        "research_control_campaign_paper_source_window_transition_failed",
        "Matched source window transition failed and peers were stopped."
      );
    }
    const steps = settled.map((result) =>
      (result as PromiseFulfilledResult<PaperTradingComparisonWindowStep>).value
    );
    if (steps.some((step) => step.transition !== transition)) {
      throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Matched source drivers executed different transitions."
      );
    }
    return { transition, steps, terminal };
  }

  async adjudicateSourceVerdict(input: {
    armKind: ResearchControlCampaignArmKind;
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonVerdictRecord> {
    return this.options.arms[input.armKind].verdicts.evaluate({
      activationId: input.activationId,
      activationAttemptId: input.activationAttemptId
    });
  }

  async recordSourceVerdictSlotOutcome(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    armKind: ResearchControlCampaignArmKind;
    sequence: number;
    verdict: PaperTradingComparisonVerdictRecord;
  }): Promise<ResearchControlCampaignPaperSlotOutcomeRecord | undefined> {
    if (input.verdict.verdict_outcome === "challenger_improved") return undefined;
    const slot = candidateSlot(input.schedule, input.armKind, input.sequence);
    if (!slot || input.verdict.paper_trading_comparison_commitment_ref.id !==
        slot.source_comparison_commitment_id) {
      throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Source verdict does not close the exact scheduled comparison."
      );
    }
    const outcome = this.decideSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.sequence,
      terminalEvidence: {
        evidence_kind: "source_verdict",
        source_comparison_ref: {
          ...input.verdict.paper_trading_comparison_commitment_ref
        },
        source_comparison_digest:
          input.verdict.paper_trading_comparison_commitment_digest,
        source_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: input.verdict.paper_trading_comparison_verdict_id
        },
        source_verdict_digest: input.verdict.verdict_digest,
        terminal_status: input.verdict.verdict_outcome ===
            "challenger_not_improved"
          ? "source_not_improved"
          : "evidence_ineligible"
      },
      terminalAt: input.verdict.evaluated_at
    });
    const armRecorded = await this.options.arms[input.armKind].store
      .recordResearchControlCampaignPaperSlotOutcome(outcome);
    const coordinatorRecorded = await this.options.coordinator
      .replicateResearchControlCampaignPaperSlotOutcome(outcome);
    const reloaded = await this.options.coordinator
      .getResearchControlCampaignPaperSlotOutcome(
        outcome.research_control_campaign_paper_slot_outcome_id
      );
    if (!isDeepStrictEqual(armRecorded, outcome) ||
      !isDeepStrictEqual(coordinatorRecorded, outcome) ||
      !isDeepStrictEqual(reloaded, outcome)) {
      throw windowError(
        "research_control_campaign_paper_source_window_persistence_failed",
        "Source verdict slot outcome was not preserved exactly."
      );
    }
    return outcome;
  }

  private async advanceOne(
    source: ResearchControlCampaignPaperWindowSource,
    frozen: ResearchControlCampaignPaperFrozenMarketEvidence | undefined,
    transition: PaperTradingComparisonWindowTransition
  ): Promise<PaperTradingComparisonWindowStep> {
    const now = frozen?.observedAt ?? exactTime(this.now());
    const marketData = frozen
      ? researchControlCampaignPaperFrozenMarketPort(
          this.options.marketData,
          frozen
        )
      : noReadMarketPort(this.options.marketData, transition);
    const driver = this.options.arms[source.armKind].createWindowDriver({
      marketData,
      now: () => now
    });
    return driver.advance({
      activationId: source.activationId,
      activationAttemptId: source.activationAttemptId
    });
  }

  private async captureFrozenMarketEvidence(): Promise<
    ResearchControlCampaignPaperFrozenMarketEvidence
  > {
    const observedAt = exactTime(this.now());
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
      throw windowError(
        "research_control_campaign_paper_source_window_transition_failed",
        "Shared repeated-tick market evidence could not be captured.",
        undefined,
        error
      );
    }
  }
}

function readyBatchSides(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  batch: ResearchControlCampaignPaperStartBatchRecord
): ResearchControlCampaignPaperStartBatchRecord["sides"] {
  if ((batch.batch_status !== "single_ready" &&
      batch.batch_status !== "paired_ready") ||
    batch.schedule_ref.id !==
      schedule.research_control_campaign_paper_schedule_id ||
    batch.schedule_digest !== schedule.schedule_digest ||
    batch.sides.length < 1 || batch.sides.length > 2) {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      "Source window requires one exact ready start batch."
    );
  }
  for (const side of batch.sides) {
    const slot = candidateSlot(schedule, side.arm_kind, batch.sequence);
    if (!slot || side.source_comparison_ref.id !==
        slot.source_comparison_commitment_id || !side.first_tick_ref) {
      throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Ready start batch side differs from the scheduled source slot."
      );
    }
  }
  return batch.sides;
}

function matchWindowSources(
  sides: ResearchControlCampaignPaperStartBatchRecord["sides"],
  sources: ResearchControlCampaignPaperWindowSource[]
): ResearchControlCampaignPaperWindowSource[] {
  if (!Array.isArray(sources) || sources.length !== sides.length) {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      "Active source identities do not match the ready batch."
    );
  }
  return sides.map((side) => {
    const source = sources.find((candidate) =>
      candidate.armKind === side.arm_kind
    );
    if (!source || !source.activationId || !source.activationAttemptId) {
      throw windowError(
        "research_control_campaign_paper_source_window_graph_invalid",
        "Active source identity is missing for a ready batch side."
      );
    }
    return source;
  });
}

function partialRepeatedTick(
  snapshots: Array<{
    source: ResearchControlCampaignPaperWindowSource;
    snapshot: PaperTradingComparisonWindowSnapshot;
  }>,
  decisions: PaperTradingComparisonWindowDecision[]
): {
  persisted: typeof snapshots[number];
  missing: typeof snapshots[number];
} | undefined {
  if (snapshots.length !== 2) return undefined;
  const captureIndex = decisions.findIndex((decision) =>
    decision.transition === "capture_next_tick"
  );
  const persistedIndex = decisions.findIndex((decision) =>
    decision.transition === "begin_next_checkpoint"
  );
  if (captureIndex < 0 || persistedIndex < 0 ||
    decisions.filter((decision) =>
      decision.transition === "capture_next_tick"
    ).length !== 1 || decisions.filter((decision) =>
      decision.transition === "begin_next_checkpoint"
    ).length !== 1) {
    return undefined;
  }
  const missing = snapshots[captureIndex]!;
  const persisted = snapshots[persistedIndex]!;
  if (persisted.snapshot.facts.tick_count !==
      missing.snapshot.facts.tick_count + 1) {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      "Partial repeated-tick evidence is not one contiguous tick ahead."
    );
  }
  return { persisted, missing };
}

function uniqueTransition(
  decisions: PaperTradingComparisonWindowDecision[]
): PaperTradingComparisonWindowTransition {
  const transitions = new Set(decisions.map((decision) => decision.transition));
  if (transitions.size !== 1) {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      "Matched source windows require the same next transition."
    );
  }
  return decisions[0]!.transition;
}

function candidateSlot(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  armKind: ResearchControlCampaignArmKind,
  sequence: number
): Extract<
  ResearchControlCampaignPaperScheduleSlot,
  { slot_status: "candidate_scheduled" }
> | undefined {
  const slot = schedule.arms.find((arm) => arm.arm_kind === armKind)
    ?.slots.find((candidate) => candidate.sequence === sequence);
  return slot?.slot_status === "candidate_scheduled" ? slot : undefined;
}

function noReadMarketPort(
  source: GatewayMarketDataPort,
  transition: PaperTradingComparisonWindowTransition
): GatewayMarketDataPort {
  const unexpected = async (): Promise<never> => {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      `Window transition ${transition} attempted an independent market read.`
    );
  };
  return {
    provider_kind: source.provider_kind,
    source_kind: source.source_kind,
    rest_base_url: source.rest_base_url,
    required_endpoints: source.required_endpoints,
    authority_status: "read_only",
    readMarketSnapshot: unexpected,
    readPublicExecutionSnapshot: unexpected,
    readPublicMarketLivenessSurface: unexpected
  };
}

function exactTime(value: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw windowError(
      "research_control_campaign_paper_source_window_graph_invalid",
      "Source window clock must return an exact ISO timestamp."
    );
  }
  return value;
}

function conciseError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}:${error.message}`.slice(0, 240)
    : "unknown_error";
}

function windowError(
  code: ResearchControlCampaignPaperSourceWindowErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): ResearchControlCampaignPaperSourceWindowError {
  return new ResearchControlCampaignPaperSourceWindowError(
    code,
    message,
    details,
    cause === undefined ? undefined : { cause }
  );
}
