import { researchControlCampaignPaperSlotOutcomeId } from
  "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import type { PaperTradingComparisonWindowDecision } from
  "@ouroboros/application/trading/paper/comparison-window-state";
import type {
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonResearchReleaseRecord,
  ResearchControlCampaignArmKind,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperScheduleSlot
} from "@ouroboros/domain";
import type { ResearchControlCampaignPaperExecutorGraph } from
  "./research-control-campaign-paper-executor";
import type {
  ProjectResearchControlCampaignPaperNextActionInput,
  ResearchControlCampaignPaperSlotEvidence
} from "./research-control-campaign-paper-next-action";

export class ResearchControlCampaignPaperEvidenceError extends Error {
  readonly code = "research_control_campaign_paper_evidence_graph_invalid";

  constructor(message: string) {
    super(message);
    this.name = "ResearchControlCampaignPaperEvidenceError";
  }
}

export async function loadResearchControlCampaignPaperEvidence(input: {
  graph: ResearchControlCampaignPaperExecutorGraph;
  coordinator: OuroborosStorePort;
  arms: Record<ResearchControlCampaignArmKind, OuroborosStorePort>;
  now: string;
  readSourceWindowDecision?: (input: {
    armKind: ResearchControlCampaignArmKind;
    activationId: string;
    activationAttemptId: string;
  }) => Promise<PaperTradingComparisonWindowDecision>;
}): Promise<ProjectResearchControlCampaignPaperNextActionInput> {
  const confirmationPrecommitDeadlineMs = frozenConfirmationDeadline(input.graph);
  const slots: ResearchControlCampaignPaperSlotEvidence[] = [];
  for (const arm of input.graph.schedule.arms) {
    for (const slot of arm.slots) {
      if (slot.slot_status !== "candidate_scheduled") continue;
      slots.push(await loadSlotEvidence({
        schedule: input.graph.schedule,
        armKind: arm.arm_kind,
        slot,
        store: input.arms[arm.arm_kind],
        readSourceWindowDecision: input.readSourceWindowDecision
      }));
    }
  }
  const [startBatches, outcomes] = await Promise.all([
    input.coordinator.listResearchControlCampaignPaperStartBatches(
      input.graph.schedule.research_control_campaign_paper_schedule_id
    ),
    input.coordinator.listResearchControlCampaignOutcomes()
  ]);
  const campaignOutcomes = outcomes.filter((outcome) =>
    outcome.campaign_ref.id === input.graph.campaign.research_control_campaign_id
  );
  if (campaignOutcomes.length > 1) {
    throw evidenceError("Campaign has ambiguous terminal outcomes.");
  }
  return {
    schedule: input.graph.schedule,
    now: input.now,
    confirmationPrecommitDeadlineMs,
    slots,
    startBatches,
    ...(campaignOutcomes[0] ? { campaignOutcome: campaignOutcomes[0] } : {})
  };
}

function frozenConfirmationDeadline(
  graph: ResearchControlCampaignPaperExecutorGraph
): number {
  const protocol = graph.campaign.paper_evaluation_protocol;
  const deadline = protocol?.protocol_status === "bound"
    ? protocol.schedule_policy.confirmation_precommit_deadline_ms
    : undefined;
  if (protocol?.protocol_status !== "bound" ||
    graph.schedule.campaign_ref.id !==
      graph.campaign.research_control_campaign_id ||
    graph.schedule.campaign_digest !== graph.campaign.campaign_digest ||
    graph.schedule.paper_evaluation_protocol_digest !==
      protocol.protocol_digest ||
    !Number.isInteger(deadline) || (deadline ?? 0) <= 0) {
    throw evidenceError(
      "Paper evidence lacks its exact frozen confirmation deadline."
    );
  }
  return deadline!;
}

async function loadSlotEvidence(input: {
  schedule: ResearchControlCampaignPaperScheduleRecord;
  armKind: ResearchControlCampaignArmKind;
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >;
  store: OuroborosStorePort;
  readSourceWindowDecision?: (input: {
    armKind: ResearchControlCampaignArmKind;
    activationId: string;
    activationAttemptId: string;
  }) => Promise<PaperTradingComparisonWindowDecision>;
}): Promise<ResearchControlCampaignPaperSlotEvidence> {
  const [preparation, commitment, ticks, activations, verdicts, slotOutcome] =
    await Promise.all([
      input.store.getPaperTradingComparisonPreparation(
        input.slot.source_preparation_id
      ),
      input.store.getPaperTradingComparisonCommitment(
        input.slot.source_comparison_commitment_id
      ),
      input.store.listPaperTradingComparisonTicks(
        input.slot.source_comparison_commitment_id
      ),
      input.store.listPaperTradingComparisonActivations(
        input.slot.source_comparison_commitment_id
      ),
      input.store.listPaperTradingComparisonVerdicts(
        input.slot.source_comparison_commitment_id
      ),
      input.store.getResearchControlCampaignPaperSlotOutcome(
        researchControlCampaignPaperSlotOutcomeId(
          input.schedule,
          input.armKind,
          input.slot.sequence
        )
      )
    ]);
  const firstTicks = ticks.filter((tick) => tick.sequence === 1);
  if (firstTicks.length > 1 || activations.length > 1 || verdicts.length > 1) {
    throw evidenceError("Source slot has ambiguous comparison evidence.");
  }
  const activation = activations[0];
  let activationAttempt;
  let activationOutcome;
  let sourceWindowDecision;
  if (activation) {
    const attempts = await input.store.listPaperTradingComparisonActivationAttempts(
      activation.paper_trading_comparison_activation_id
    );
    activationAttempt = attempts.slice().sort((left, right) =>
      left.attempt_sequence - right.attempt_sequence
    ).at(-1);
    if (activationAttempt) {
      const activationOutcomes = await input.store
        .listPaperTradingComparisonActivationOutcomes(
          activationAttempt.paper_trading_comparison_activation_attempt_id
        );
      activationOutcome = activationOutcomes.slice().sort((left, right) =>
        left.outcome_sequence - right.outcome_sequence
      ).at(-1);
      if (!verdicts[0] && activationOutcome) {
        if (!input.readSourceWindowDecision) {
          throw evidenceError(
            "Active source comparison lacks a window decision reader."
          );
        }
        sourceWindowDecision = await input.readSourceWindowDecision({
          armKind: input.armKind,
          activationId: activation.paper_trading_comparison_activation_id,
          activationAttemptId:
            activationAttempt.paper_trading_comparison_activation_attempt_id
        });
      }
    }
  }

  const sourceVerdict = verdicts[0];
  let confirmationCampaign:
    PaperTradingComparisonConfirmationCampaignRecord | undefined;
  let confirmationOutcome:
    PaperTradingComparisonConfirmationCampaignOutcomeRecord | undefined;
  let researchRelease: PaperTradingComparisonResearchReleaseRecord | undefined;
  if (sourceVerdict?.verdict_outcome === "challenger_improved") {
    const campaigns = (
      await input.store.listPaperTradingComparisonConfirmationCampaigns()
    ).filter((campaign) => campaign.source_verdict_ref.id ===
      sourceVerdict.paper_trading_comparison_verdict_id
    );
    if (campaigns.length > 1) {
      throw evidenceError("Source verdict has ambiguous confirmation campaigns.");
    }
    confirmationCampaign = campaigns[0];
    if (confirmationCampaign) {
      const outcomes = await input.store
        .listPaperTradingComparisonConfirmationCampaignOutcomes(
          confirmationCampaign
            .paper_trading_comparison_confirmation_campaign_id
        );
      if (outcomes.length > 1) {
        throw evidenceError("Confirmation campaign has ambiguous outcomes.");
      }
      confirmationOutcome = outcomes[0];
      if (confirmationOutcome) {
        const confirmationOutcomeId = confirmationOutcome
          .paper_trading_comparison_confirmation_campaign_outcome_id;
        const releases = (
          await input.store.listPaperTradingComparisonResearchReleases()
        ).filter((release) => release.campaign_outcome_ref.id ===
          confirmationOutcomeId
        );
        if (releases.length > 1) {
          throw evidenceError("Confirmation outcome has ambiguous releases.");
        }
        researchRelease = releases[0];
      }
    }
  }

  return {
    armKind: input.armKind,
    sequence: input.slot.sequence,
    ...(preparation ? { preparation } : {}),
    ...(commitment ? { commitment } : {}),
    ...(firstTicks[0] ? { firstTick: firstTicks[0] } : {}),
    ...(activation ? { activation } : {}),
    ...(activationAttempt ? { activationAttempt } : {}),
    ...(activationOutcome ? { activationOutcome } : {}),
    ...(sourceWindowDecision ? { sourceWindowDecision } : {}),
    ...(sourceVerdict ? { sourceVerdict } : {}),
    ...(confirmationCampaign ? { confirmationCampaign } : {}),
    ...(confirmationOutcome ? { confirmationOutcome } : {}),
    ...(researchRelease ? { researchRelease } : {}),
    ...(slotOutcome ? { slotOutcome } : {})
  };
}

function evidenceError(message: string): ResearchControlCampaignPaperEvidenceError {
  return new ResearchControlCampaignPaperEvidenceError(message);
}
