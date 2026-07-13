import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type {
  PaperTradingComparisonCoordinator,
  PreparePaperTradingComparisonInput,
  VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";
import { PaperTradingComparisonConfirmationCampaignServiceError } from
  "./comparison-confirmation-campaign-service";

type SlotState = {
  preparation: Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonPreparation"]
  >>;
  commitment: Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonCommitment"]
  >>;
  verdict?: PaperTradingComparisonVerdictRecord;
};

export class PaperTradingComparisonConfirmationWindowService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    comparisons: Pick<PaperTradingComparisonCoordinator, "prepare">;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async prepareNext(input: {
    campaignId: string;
  }): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
    const campaignId = nonEmptyId(input?.campaignId);
    try {
      const campaign = await this.options.store
        .getPaperTradingComparisonConfirmationCampaign(campaignId);
      if (!campaign ||
        !paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign)) {
        throw graphInvalid();
      }
      const outcome = await this.options.store
        .getPaperTradingComparisonConfirmationCampaignOutcome(`${campaignId}-outcome`);
      if (outcome) throw notTerminal();
      const states = await this.loadSlotStates(campaign);
      const currentIndex = this.currentSlotIndex(campaign, states);
      if (currentIndex < 0) throw notTerminal();
      const applicableStart = currentIndex === 0
        ? campaign.committed_at
        : states[currentIndex - 1]!.verdict!.evaluated_at;
      const startedAt = exactNow(this.now);
      if (!states[currentIndex]!.commitment && Date.parse(startedAt) >
        Date.parse(applicableStart) +
          campaign.campaign_policy.maximum_slot_start_delay_ms) {
        throw notTerminal();
      }
      const coordinatorInput = inputForSlot(campaign, currentIndex);
      const graph = await this.options.comparisons.prepare(coordinatorInput);
      const completedAt = exactNow(this.now);
      if (Date.parse(completedAt) < Date.parse(startedAt) ||
        !graphMatchesSlot(
          graph,
          campaign,
          currentIndex,
          applicableStart,
          completedAt
        )) {
        throw graphInvalid();
      }
      return graph;
    } catch (error) {
      if (error instanceof PaperTradingComparisonConfirmationCampaignServiceError) {
        throw error;
      }
      throw graphInvalid();
    }
  }

  private async loadSlotStates(
    campaign: PaperTradingComparisonConfirmationCampaignRecord
  ): Promise<SlotState[]> {
    const states: SlotState[] = [];
    for (const slot of campaign.slots) {
      const [preparation, commitment, verdicts] = await Promise.all([
        this.options.store.getPaperTradingComparisonPreparation(
          slot.paper_trading_comparison_preparation_id
        ),
        this.options.store.getPaperTradingComparisonCommitment(
          slot.paper_trading_comparison_commitment_id
        ),
        this.options.store.listPaperTradingComparisonVerdicts(
          slot.paper_trading_comparison_commitment_id
        )
      ]);
      if (!Array.isArray(verdicts) || verdicts.length > 1 ||
        commitment && !preparation ||
        preparation && (preparation.paper_trading_comparison_preparation_id !==
          slot.paper_trading_comparison_preparation_id ||
          preparation.paper_trading_comparison_commitment_id !==
            slot.paper_trading_comparison_commitment_id) ||
        commitment && commitment.paper_trading_comparison_commitment_id !==
          slot.paper_trading_comparison_commitment_id) {
        throw graphInvalid();
      }
      const verdict = verdicts[0];
      if (verdict && (!preparation || !commitment ||
        !paperTradingComparisonVerdictHasRuntimeShape(verdict) ||
        verdict.paper_trading_comparison_commitment_ref.id !==
          slot.paper_trading_comparison_commitment_id ||
        verdict.paper_trading_comparison_verdict_id === campaign.source_verdict_ref.id)) {
        throw graphInvalid();
      }
      states.push({ preparation, commitment, verdict });
    }
    return states;
  }

  private currentSlotIndex(
    campaign: PaperTradingComparisonConfirmationCampaignRecord,
    states: SlotState[]
  ): number {
    let current = -1;
    for (let index = 0; index < states.length; index += 1) {
      const state = states[index]!;
      if (state.verdict) {
        if (current >= 0) throw graphInvalid();
        const priorStart = index === 0
          ? campaign.committed_at
          : states[index - 1]?.verdict?.evaluated_at;
        if (!priorStart || Date.parse(state.verdict.window_started_at) <=
          Date.parse(priorStart)) {
          throw graphInvalid();
        }
        continue;
      }
      if (current < 0) {
        current = index;
        continue;
      }
      if (state.preparation || state.commitment) throw graphInvalid();
    }
    return current;
  }
}

function inputForSlot(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number
): PreparePaperTradingComparisonInput {
  const slot = campaign.slots[slotIndex]!;
  return {
    idempotencyKey: slot.comparison_idempotency_key,
    champion: candidateInput(campaign.champion),
    challenger: candidateInput(campaign.challenger),
    comparisonPolicy: structuredClone(campaign.comparison_policy),
    marketDataConfigurationDigest: campaign.market_data_configuration_digest,
    paperPolicyIdentity: structuredClone(campaign.paper_policy_identity)
  };
}

function candidateInput(side: PaperTradingComparisonCandidateSide) {
  return {
    candidateId: side.candidate_ref.id,
    candidateVersionId: side.candidate_version_ref.id,
    admissionDecisionId: side.candidate_admission_decision_ref.id
  };
}

function graphMatchesSlot(
  graph: VerifiedPaperTradingComparisonCommitmentGraph,
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number,
  applicableStart: string,
  now: string
): boolean {
  const slot = campaign.slots[slotIndex]!;
  const preparation = graph?.preparation;
  const commitment = graph?.commitment;
  return paperTradingComparisonPreparationHasRuntimeShape(preparation) &&
    paperTradingComparisonCommitmentHasRuntimeShape(commitment) &&
    graph.verification?.status === "verified" &&
    graph.verification.activation_authority === "not_granted" &&
    preparation.paper_trading_comparison_preparation_id ===
      slot.paper_trading_comparison_preparation_id &&
    preparation.paper_trading_comparison_commitment_id ===
      slot.paper_trading_comparison_commitment_id &&
    commitment.paper_trading_comparison_commitment_id ===
      slot.paper_trading_comparison_commitment_id &&
    commitment.preparation_ref.id === slot.paper_trading_comparison_preparation_id &&
    isDeepStrictEqual(preparation.champion, campaign.champion) &&
    isDeepStrictEqual(preparation.challenger, campaign.challenger) &&
    comparisonFrozenFieldsMatch(preparation, campaign) &&
    comparisonFrozenFieldsMatch(commitment, campaign) &&
    comparisonSideMatchesCandidate(commitment.champion, campaign.champion) &&
    comparisonSideMatchesCandidate(commitment.challenger, campaign.challenger) &&
    isDeepStrictEqual(graph.champion?.side, commitment.champion) &&
    isDeepStrictEqual(graph.challenger?.side, commitment.challenger) &&
    preparation.committed_at === commitment.committed_at &&
    Date.parse(preparation.committed_at) > Date.parse(applicableStart) &&
    Date.parse(preparation.committed_at) <= Date.parse(now);
}

function comparisonFrozenFieldsMatch(
  value: {
    champion_selection: unknown;
    comparison_policy: unknown;
    market_data_configuration_digest: string;
    paper_policy_identity: unknown;
  },
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): boolean {
  return isDeepStrictEqual(value.champion_selection, campaign.champion_selection) &&
    isDeepStrictEqual(value.comparison_policy, campaign.comparison_policy) &&
    value.market_data_configuration_digest ===
      campaign.market_data_configuration_digest &&
    isDeepStrictEqual(value.paper_policy_identity, campaign.paper_policy_identity);
}

function comparisonSideMatchesCandidate(
  side: PaperTradingComparisonCandidateSide,
  candidate: PaperTradingComparisonCandidateSide
): boolean {
  return isDeepStrictEqual(candidateSideFrom(side), candidate);
}

function candidateSideFrom(
  side: PaperTradingComparisonCandidateSide
): PaperTradingComparisonCandidateSide {
  return {
    role: side.role,
    candidate_ref: structuredClone(side.candidate_ref),
    candidate_version_ref: structuredClone(side.candidate_version_ref),
    candidate_version_digest: side.candidate_version_digest,
    system_code_ref: structuredClone(side.system_code_ref),
    system_code_record_digest: side.system_code_record_digest,
    system_code_artifact_digest: side.system_code_artifact_digest,
    candidate_admission_decision_ref: structuredClone(
      side.candidate_admission_decision_ref
    ),
    admission_decision_digest: side.admission_decision_digest
  };
}

function nonEmptyId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PaperTradingComparisonConfirmationCampaignServiceError(
      "invalid_paper_trading_comparison_confirmation_campaign_input",
      "Paper comparison confirmation campaign input is invalid."
    );
  }
  return value;
}

function exactNow(now: () => string): string {
  const value = now();
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw new PaperTradingComparisonConfirmationCampaignServiceError(
      "invalid_paper_trading_comparison_confirmation_campaign_input",
      "Paper comparison confirmation campaign clock is invalid."
    );
  }
  return value;
}

function notTerminal(): PaperTradingComparisonConfirmationCampaignServiceError {
  return new PaperTradingComparisonConfirmationCampaignServiceError(
    "paper_trading_comparison_confirmation_campaign_not_terminal",
    "Paper comparison confirmation campaign has no preparable slot."
  );
}

function graphInvalid(): PaperTradingComparisonConfirmationCampaignServiceError {
  return new PaperTradingComparisonConfirmationCampaignServiceError(
    "paper_trading_comparison_confirmation_campaign_graph_invalid",
    "Paper comparison confirmation window graph is invalid."
  );
}
