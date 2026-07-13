import { isDeepStrictEqual } from "node:util";
import {
  decideResearchControlCampaignPaperSlotOutcome
} from "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type {
  PaperTradingComparisonConfirmationCampaignService
} from "@ouroboros/application/trading/paper/comparison-confirmation-campaign-service";
import type {
  PaperTradingComparisonConfirmationWindowService
} from "@ouroboros/application/trading/paper/comparison-confirmation-window-service";
import type {
  PaperTradingComparisonResearchReleaseService
} from "@ouroboros/application/trading/paper/comparison-research-release-service";
import type {
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonVerdictRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperScheduleSlot,
  ResearchControlCampaignPaperSlotOutcomeRecord
} from "@ouroboros/domain";
import type {
  ResearchControlCampaignPaperComparisonAdvanceResult
} from "./research-control-campaign-paper-comparison-advancer";

export type ResearchControlCampaignPaperConfirmationErrorCode =
  | "research_control_campaign_paper_confirmation_graph_invalid"
  | "research_control_campaign_paper_confirmation_persistence_failed";

export class ResearchControlCampaignPaperConfirmationError extends Error {
  constructor(
    readonly code: ResearchControlCampaignPaperConfirmationErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlCampaignPaperConfirmationError";
  }
}

export interface ResearchControlCampaignPaperConfirmationArm {
  store: OuroborosStorePort;
  campaigns: Pick<
    PaperTradingComparisonConfirmationCampaignService,
    "precommit" | "settle"
  >;
  windows: Pick<PaperTradingComparisonConfirmationWindowService, "prepareNext">;
  advanceComparison(input: {
    comparisonId: string;
    campaignId: string;
    slotIndex: number;
  }): Promise<ResearchControlCampaignPaperComparisonAdvanceResult>;
  releases: Pick<PaperTradingComparisonResearchReleaseService, "release">;
}

export type ResearchControlCampaignPaperPrecommitResult =
  | {
      status: "precommitted";
      campaign: PaperTradingComparisonConfirmationCampaignRecord;
    }
  | {
      status: "expired";
      outcome: ResearchControlCampaignPaperSlotOutcomeRecord;
    };

export type ResearchControlCampaignPaperConfirmationAdvanceResult =
  | { status: "advanced"; slotIndex: number; comparisonId: string }
  | {
      status: "waiting";
      slotIndex: number;
      comparisonId: string;
      wakeAt: string;
    }
  | {
      status: "released";
      outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
      release: PaperTradingComparisonResearchReleaseRecord;
    };

export class ResearchControlCampaignPaperConfirmationCoordinator {
  private readonly now: () => string;
  private readonly decideSlotOutcome:
    typeof decideResearchControlCampaignPaperSlotOutcome;

  constructor(private readonly options: {
    coordinator: OuroborosStorePort;
    arms: Record<
      ResearchControlCampaignArmKind,
      ResearchControlCampaignPaperConfirmationArm
    >;
    now?: () => string;
    decideSlotOutcome?: typeof decideResearchControlCampaignPaperSlotOutcome;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.decideSlotOutcome = options.decideSlotOutcome ??
      decideResearchControlCampaignPaperSlotOutcome;
  }

  async precommitOrExpire(input: {
    campaign: ResearchControlCampaignRecord;
    schedule: ResearchControlCampaignPaperScheduleRecord;
    armKind: ResearchControlCampaignArmKind;
    sequence: number;
    sourceVerdict: PaperTradingComparisonVerdictRecord;
  }): Promise<ResearchControlCampaignPaperPrecommitResult> {
    const confirmationPrecommitDeadlineMs = frozenConfirmationDeadline(input);
    const slot = candidateSlot(input.schedule, input.armKind, input.sequence);
    const verdict = input.sourceVerdict;
    if (!slot || verdict.verdict_outcome !== "challenger_improved" ||
      verdict.confirmation_disposition !== "requires_precommitted_campaign" ||
      verdict.paper_trading_comparison_commitment_ref.id !==
        slot.source_comparison_commitment_id) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Only the exact improved source verdict can enter confirmation."
      );
    }
    const existingCampaigns = (
      await this.options.arms[input.armKind].store
        .listPaperTradingComparisonConfirmationCampaigns()
    ).filter((campaign) => campaign.source_verdict_ref.id ===
      verdict.paper_trading_comparison_verdict_id
    );
    if (existingCampaigns.length > 1) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Source verdict has ambiguous confirmation campaigns."
      );
    }
    const existingCampaign = existingCampaigns[0];
    if (existingCampaign) {
      if (existingCampaign.source_verdict_digest !== verdict.verdict_digest ||
        existingCampaign.source_comparison_ref.id !==
          slot.source_comparison_commitment_id ||
        existingCampaign.source_comparison_digest !==
          verdict.paper_trading_comparison_commitment_digest ||
        Date.parse(existingCampaign.committed_at) >
          Date.parse(verdict.evaluated_at) +
            confirmationPrecommitDeadlineMs) {
        throw confirmationError(
          "research_control_campaign_paper_confirmation_graph_invalid",
          "Persisted confirmation campaign conflicts with its source verdict."
        );
      }
      return { status: "precommitted", campaign: existingCampaign };
    }
    const now = exactTime(this.now());
    const deadline = Date.parse(verdict.evaluated_at) +
      confirmationPrecommitDeadlineMs;
    if (Date.parse(now) <= deadline) {
      const campaign = await this.options.arms[input.armKind].campaigns.precommit({
        sourceVerdictId: verdict.paper_trading_comparison_verdict_id
      });
      if (campaign.source_verdict_ref.id !==
          verdict.paper_trading_comparison_verdict_id ||
        campaign.source_verdict_digest !== verdict.verdict_digest ||
        campaign.source_comparison_ref.id !==
          slot.source_comparison_commitment_id ||
        Date.parse(campaign.committed_at) > deadline) {
        throw confirmationError(
          "research_control_campaign_paper_confirmation_graph_invalid",
          "Precommitted confirmation campaign differs from the source verdict."
        );
      }
      return { status: "precommitted", campaign };
    }

    const outcome = this.decideSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.sequence,
      terminalEvidence: {
        evidence_kind: "confirmation_precommit_expired",
        source_comparison_ref: {
          ...verdict.paper_trading_comparison_commitment_ref
        },
        source_comparison_digest:
          verdict.paper_trading_comparison_commitment_digest,
        source_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: verdict.paper_trading_comparison_verdict_id
        },
        source_verdict_digest: verdict.verdict_digest,
        terminal_status: "paper_slot_expired",
        expired_at: now
      },
      terminalAt: now
    });
    await this.recordAndReplicate(input.armKind, outcome);
    return { status: "expired", outcome };
  }

  async advanceConfirmation(input: {
    armKind: ResearchControlCampaignArmKind;
    campaignId: string;
  }): Promise<ResearchControlCampaignPaperConfirmationAdvanceResult> {
    const arm = this.options.arms[input.armKind];
    const campaign = await arm.store.getPaperTradingComparisonConfirmationCampaign(
      input.campaignId
    );
    if (!campaign || campaign.paper_trading_comparison_confirmation_campaign_id !==
        input.campaignId || campaign.slots.length === 0) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Confirmation campaign is absent or malformed."
      );
    }
    const existingOutcome = await arm.store
      .getPaperTradingComparisonConfirmationCampaignOutcome(
        `${input.campaignId}-outcome`
      );
    if (existingOutcome) {
      return this.releaseOutcome(arm, campaign, existingOutcome);
    }

    const states = await Promise.all(campaign.slots.map(async (slot) => {
      const [preparation, commitment, verdicts] = await Promise.all([
        arm.store.getPaperTradingComparisonPreparation(
          slot.paper_trading_comparison_preparation_id
        ),
        arm.store.getPaperTradingComparisonCommitment(
          slot.paper_trading_comparison_commitment_id
        ),
        arm.store.listPaperTradingComparisonVerdicts(
          slot.paper_trading_comparison_commitment_id
        )
      ]);
      if (!Array.isArray(verdicts) || verdicts.length > 1 ||
        Boolean(preparation) !== Boolean(commitment)) {
        throw confirmationError(
          "research_control_campaign_paper_confirmation_graph_invalid",
          "Confirmation slot evidence is partial or ambiguous."
        );
      }
      return { slot, preparation, commitment, verdict: verdicts[0] };
    }));
    const currentIndex = states.findIndex((state) => !state.verdict);
    if (currentIndex < 0) {
      const outcome = await arm.campaigns.settle({ campaignId: input.campaignId });
      return this.releaseOutcome(arm, campaign, outcome);
    }
    if (states.slice(currentIndex + 1).some((state) =>
      state.preparation || state.commitment || state.verdict
    )) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Confirmation evidence exists after the current strict-sequence slot."
      );
    }
    const current = states[currentIndex]!;
    const applicableStart = currentIndex === 0
      ? campaign.committed_at
      : states[currentIndex - 1]!.verdict?.evaluated_at;
    if (!applicableStart) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Confirmation predecessor lacks a terminal verdict."
      );
    }
    const now = exactTime(this.now());
    if (!current.preparation && Date.parse(now) > Date.parse(applicableStart) +
      campaign.campaign_policy.maximum_slot_start_delay_ms) {
      const outcome = await arm.campaigns.settle({ campaignId: input.campaignId });
      return this.releaseOutcome(arm, campaign, outcome);
    }

    let comparisonId = current.slot.paper_trading_comparison_commitment_id;
    if (!current.commitment) {
      const graph = await arm.windows.prepareNext({ campaignId: input.campaignId });
      comparisonId = graph.commitment.paper_trading_comparison_commitment_id;
      if (comparisonId !== current.slot.paper_trading_comparison_commitment_id ||
        graph.preparation.paper_trading_comparison_preparation_id !==
          current.slot.paper_trading_comparison_preparation_id) {
        throw confirmationError(
          "research_control_campaign_paper_confirmation_graph_invalid",
          "Prepared confirmation window differs from the current reserved slot."
        );
      }
    }
    const advanced = await arm.advanceComparison({
      comparisonId,
      campaignId: input.campaignId,
      slotIndex: currentIndex + 1
    });
    if (advanced.campaignId !== input.campaignId ||
      advanced.slotIndex !== currentIndex + 1 ||
      advanced.comparisonId !== comparisonId) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Advanced confirmation evidence differs from the current reserved slot."
      );
    }
    if (advanced.status === "waiting") {
      const wakeAt = exactTime(advanced.wakeAt);
      if (Date.parse(wakeAt) <= Date.parse(now)) {
        throw confirmationError(
          "research_control_campaign_paper_confirmation_graph_invalid",
          "Confirmation wake time must be later than the current action."
        );
      }
      return {
        status: "waiting",
        slotIndex: currentIndex + 1,
        comparisonId,
        wakeAt
      };
    }
    return { status: "advanced", slotIndex: currentIndex + 1, comparisonId };
  }

  async recordReleaseSlotOutcome(input: {
    schedule: ResearchControlCampaignPaperScheduleRecord;
    armKind: ResearchControlCampaignArmKind;
    sequence: number;
    campaign: PaperTradingComparisonConfirmationCampaignRecord;
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
    release: PaperTradingComparisonResearchReleaseRecord;
  }): Promise<ResearchControlCampaignPaperSlotOutcomeRecord> {
    const slot = candidateSlot(input.schedule, input.armKind, input.sequence);
    const terminalByRelease = {
      confirmed_improvement: "qualified_improvement",
      challenger_not_reproduced: "not_reproduced",
      comparison_evidence_ineligible: "evidence_ineligible",
      campaign_slot_expired: "paper_slot_expired"
    } as const;
    if (!slot || input.campaign.source_comparison_ref.id !==
        slot.source_comparison_commitment_id ||
      input.outcome.campaign_ref.id !==
        input.campaign.paper_trading_comparison_confirmation_campaign_id ||
      input.outcome.campaign_digest !== input.campaign.campaign_digest ||
      input.release.campaign_ref.id !==
        input.campaign.paper_trading_comparison_confirmation_campaign_id ||
      input.release.campaign_digest !== input.campaign.campaign_digest ||
      input.release.campaign_outcome_ref.id !==
        input.outcome.paper_trading_comparison_confirmation_campaign_outcome_id ||
      input.release.campaign_outcome_digest !== input.outcome.outcome_digest) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Confirmation release does not close the exact source slot."
      );
    }
    const slotOutcome = this.decideSlotOutcome({
      schedule: input.schedule,
      armKind: input.armKind,
      sequence: input.sequence,
      terminalEvidence: {
        evidence_kind: "confirmation_release",
        confirmation_campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: input.campaign
            .paper_trading_comparison_confirmation_campaign_id
        },
        confirmation_campaign_digest: input.campaign.campaign_digest,
        confirmation_outcome_ref: {
          record_kind:
            "paper_trading_comparison_confirmation_campaign_outcome",
          id: input.outcome
            .paper_trading_comparison_confirmation_campaign_outcome_id
        },
        confirmation_outcome_digest: input.outcome.outcome_digest,
        research_release_ref: {
          record_kind: "paper_trading_comparison_research_release",
          id: input.release.paper_trading_comparison_research_release_id
        },
        research_release_digest: input.release.release_digest,
        release_kind: input.release.release_kind,
        terminal_status: terminalByRelease[input.release.release_kind]
      },
      terminalAt: input.release.released_at
    });
    await this.recordAndReplicate(input.armKind, slotOutcome);
    return slotOutcome;
  }

  private async releaseOutcome(
    arm: ResearchControlCampaignPaperConfirmationArm,
    campaign: PaperTradingComparisonConfirmationCampaignRecord,
    outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
  ): Promise<Extract<
    ResearchControlCampaignPaperConfirmationAdvanceResult,
    { status: "released" }
  >> {
    if (outcome.campaign_ref.id !==
        campaign.paper_trading_comparison_confirmation_campaign_id ||
      outcome.campaign_digest !== campaign.campaign_digest) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "Confirmation outcome differs from its campaign."
      );
    }
    const release = await arm.releases.release({
      campaignOutcomeId:
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    });
    if (release.campaign_ref.id !==
        campaign.paper_trading_comparison_confirmation_campaign_id ||
      release.campaign_digest !== campaign.campaign_digest ||
      release.campaign_outcome_ref.id !==
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id ||
      release.campaign_outcome_digest !== outcome.outcome_digest) {
      throw confirmationError(
        "research_control_campaign_paper_confirmation_graph_invalid",
        "ResearchRelease differs from the settled confirmation outcome."
      );
    }
    return { status: "released", outcome, release };
  }

  private async recordAndReplicate(
    armKind: ResearchControlCampaignArmKind,
    outcome: ResearchControlCampaignPaperSlotOutcomeRecord
  ): Promise<void> {
    const armRecorded = await this.options.arms[armKind].store
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
      throw confirmationError(
        "research_control_campaign_paper_confirmation_persistence_failed",
        "Confirmation slot outcome was not preserved exactly."
      );
    }
  }
}

function frozenConfirmationDeadline(input: {
  campaign: ResearchControlCampaignRecord;
  schedule: ResearchControlCampaignPaperScheduleRecord;
}): number {
  const protocol = input.campaign.paper_evaluation_protocol;
  const deadline = protocol?.protocol_status === "bound"
    ? protocol.schedule_policy.confirmation_precommit_deadline_ms
    : undefined;
  if (input.campaign.paper_comparator?.comparator_status !== "trading_review" ||
    protocol?.protocol_status !== "bound" ||
    input.schedule.campaign_ref.id !==
      input.campaign.research_control_campaign_id ||
    input.schedule.campaign_digest !== input.campaign.campaign_digest ||
    input.schedule.paper_evaluation_protocol_digest !==
      protocol.protocol_digest ||
    !Number.isInteger(deadline) || (deadline ?? 0) <= 0) {
    throw confirmationError(
      "research_control_campaign_paper_confirmation_graph_invalid",
      "Confirmation requires the exact campaign-bound deadline."
    );
  }
  return deadline!;
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

function exactTime(value: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw confirmationError(
      "research_control_campaign_paper_confirmation_graph_invalid",
      "Confirmation clock must return an exact ISO timestamp."
    );
  }
  return value;
}

function confirmationError(
  code: ResearchControlCampaignPaperConfirmationErrorCode,
  message: string,
  cause?: unknown
): ResearchControlCampaignPaperConfirmationError {
  return new ResearchControlCampaignPaperConfirmationError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  );
}
