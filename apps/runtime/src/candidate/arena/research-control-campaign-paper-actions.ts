import type { ResearchControlCampaignOutcomeRecord } from "@ouroboros/domain";
import type {
  ResearchControlCampaignPaperExecutorActions,
  ResearchControlCampaignPaperExecutorContext
} from "./research-control-campaign-paper-executor";
import type { ResearchControlCampaignPaperSourceBatchCoordinator } from
  "./research-control-campaign-paper-source-batch";
import type { ResearchControlCampaignPaperSourceWindowCoordinator } from
  "./research-control-campaign-paper-source-window";
import type { ResearchControlCampaignPaperConfirmationCoordinator } from
  "./research-control-campaign-paper-confirmation";

export function createResearchControlCampaignPaperExecutorActions(input: {
  sourceBatch: Pick<
    ResearchControlCampaignPaperSourceBatchCoordinator,
    | "prepare"
    | "captureStartBatch"
    | "expireUnstartedSourceSlot"
    | "recordStartIneligibleSlotOutcome"
  >;
  sourceWindow: Pick<
    ResearchControlCampaignPaperSourceWindowCoordinator,
    | "authorizeSourceBatch"
    | "startSourceBatch"
    | "advanceSourceWindow"
    | "adjudicateSourceVerdict"
    | "recordSourceVerdictSlotOutcome"
  >;
  confirmation: Pick<
    ResearchControlCampaignPaperConfirmationCoordinator,
    | "precommitOrExpire"
    | "advanceConfirmation"
    | "recordReleaseSlotOutcome"
  >;
  collectCampaignOutcome(
    campaignId: string
  ): Promise<ResearchControlCampaignOutcomeRecord>;
}): ResearchControlCampaignPaperExecutorActions {
  return {
    expireUnstartedSourceSlot(action, context) {
      return input.sourceBatch.expireUnstartedSourceSlot({
        schedule: context.schedule,
        armKind: action.armKind,
        sequence: action.sequence
      });
    },
    prepareSourceBatch(action, context) {
      return input.sourceBatch.prepare({
        campaign: context.campaign,
        schedule: context.schedule,
        sequence: action.sequence
      });
    },
    captureSourceStartBatch(action, context) {
      return input.sourceBatch.captureStartBatch({
        campaign: context.campaign,
        schedule: context.schedule,
        sequence: action.sequence
      });
    },
    authorizeSourceBatch(action, context) {
      return input.sourceWindow.authorizeSourceBatch({
        schedule: context.schedule,
        batch: batchFor(context, action.sequence)
      });
    },
    startSourceBatch(action, context) {
      return input.sourceWindow.startSourceBatch({
        schedule: context.schedule,
        batch: batchFor(context, action.sequence)
      });
    },
    advanceSourceWindow(action, context) {
      return input.sourceWindow.advanceSourceWindow({
        schedule: context.schedule,
        batch: batchFor(context, action.sequence),
        sources: sourceIdentities(context, action.sequence)
      });
    },
    adjudicateSourceVerdict(action, context) {
      const evidence = slotEvidence(context, action.armKind, action.sequence);
      if (!evidence.activation || !evidence.activationAttempt) {
        throw new Error("research_control_campaign_paper_action_graph_invalid");
      }
      return input.sourceWindow.adjudicateSourceVerdict({
        armKind: action.armKind,
        activationId:
          evidence.activation.paper_trading_comparison_activation_id,
        activationAttemptId: evidence.activationAttempt
          .paper_trading_comparison_activation_attempt_id
      });
    },
    precommitOrExpireConfirmation(action, context) {
      const evidence = slotEvidence(context, action.armKind, action.sequence);
      if (!evidence.sourceVerdict) {
        throw new Error("research_control_campaign_paper_action_graph_invalid");
      }
      return input.confirmation.precommitOrExpire({
        campaign: context.campaign,
        schedule: context.schedule,
        armKind: action.armKind,
        sequence: action.sequence,
        sourceVerdict: evidence.sourceVerdict
      });
    },
    advanceConfirmation(action, context) {
      const campaign = slotEvidence(
        context,
        action.armKind,
        action.sequence
      ).confirmationCampaign;
      if (!campaign) {
        throw new Error("research_control_campaign_paper_action_graph_invalid");
      }
      return input.confirmation.advanceConfirmation({
        armKind: action.armKind,
        campaignId:
          campaign.paper_trading_comparison_confirmation_campaign_id
      });
    },
    recordSlotOutcome(action, context) {
      const evidence = slotEvidence(context, action.armKind, action.sequence);
      const batch = context.evidence.startBatches.find((candidate) =>
        candidate.sequence === action.sequence
      );
      if (batch?.batch_status === "ineligible") {
        return input.sourceBatch.recordStartIneligibleSlotOutcome({
          schedule: context.schedule,
          batch,
          armKind: action.armKind
        });
      }
      if (evidence.sourceVerdict?.verdict_outcome !== "challenger_improved") {
        if (!evidence.sourceVerdict) {
          throw new Error("research_control_campaign_paper_action_graph_invalid");
        }
        return input.sourceWindow.recordSourceVerdictSlotOutcome({
          schedule: context.schedule,
          armKind: action.armKind,
          sequence: action.sequence,
          verdict: evidence.sourceVerdict
        });
      }
      if (!evidence.confirmationCampaign || !evidence.confirmationOutcome ||
        !evidence.researchRelease) {
        throw new Error("research_control_campaign_paper_action_graph_invalid");
      }
      return input.confirmation.recordReleaseSlotOutcome({
        schedule: context.schedule,
        armKind: action.armKind,
        sequence: action.sequence,
        campaign: evidence.confirmationCampaign,
        outcome: evidence.confirmationOutcome,
        release: evidence.researchRelease
      });
    },
    collectCampaignOutcome(_action, context) {
      return input.collectCampaignOutcome(
        context.campaign.research_control_campaign_id
      );
    }
  };
}

function batchFor(
  context: ResearchControlCampaignPaperExecutorContext,
  sequence: number
) {
  const matches = context.evidence.startBatches.filter((batch) =>
    batch.sequence === sequence
  );
  if (matches.length !== 1) {
    throw new Error("research_control_campaign_paper_action_graph_invalid");
  }
  return matches[0]!;
}

function slotEvidence(
  context: ResearchControlCampaignPaperExecutorContext,
  armKind: "adaptive_treatment" | "static_control",
  sequence: number
) {
  const matches = context.evidence.slots.filter((slot) =>
    slot.armKind === armKind && slot.sequence === sequence
  );
  if (matches.length !== 1) {
    throw new Error("research_control_campaign_paper_action_graph_invalid");
  }
  return matches[0]!;
}

function sourceIdentities(
  context: ResearchControlCampaignPaperExecutorContext,
  sequence: number
) {
  return context.evidence.slots.filter((slot) =>
    slot.sequence === sequence && !slot.slotOutcome
  ).map((slot) => {
    if (!slot.activation || !slot.activationAttempt) {
      throw new Error("research_control_campaign_paper_action_graph_invalid");
    }
    return {
      armKind: slot.armKind,
      activationId: slot.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        slot.activationAttempt.paper_trading_comparison_activation_attempt_id
    };
  });
}
