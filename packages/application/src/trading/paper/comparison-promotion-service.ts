import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { safeId } from "../../safe-id";

export type PaperTradingComparisonPromotionServiceErrorCode =
  | "invalid_paper_trading_comparison_promotion_input"
  | "paper_trading_comparison_promotion_evidence_required"
  | "paper_trading_comparison_promotion_stale"
  | "paper_trading_comparison_promotion_reference_not_found"
  | "paper_trading_comparison_promotion_graph_invalid"
  | "paper_trading_comparison_promotion_persistence_conflict";

export class PaperTradingComparisonPromotionServiceError extends Error {
  constructor(
    readonly code: PaperTradingComparisonPromotionServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PaperTradingComparisonPromotionServiceError";
  }
}

type EligibleCampaignEvidence = {
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
};

export class PaperTradingComparisonPromotionService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async promote(input: { candidateId: string }): Promise<TradingPromotionRecord> {
    const candidateId = normalizeCandidateId(input?.candidateId);

    try {
      const outcomes = await this.options.store
        .listPaperTradingComparisonConfirmationCampaignOutcomes();
      if (!Array.isArray(outcomes) || outcomes.some((outcome) =>
        !paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome))) {
        throw graphInvalid();
      }
      const orderedOutcomes = [...outcomes].sort((left, right) =>
        right.evaluated_at.localeCompare(left.evaluated_at) ||
        right.paper_trading_comparison_confirmation_campaign_outcome_id
          .localeCompare(
            left.paper_trading_comparison_confirmation_campaign_outcome_id
          )
      );
      const latestPromotion = await this.options.store.getLatestTradingPromotion();
      const exactReplay = latestPromotion &&
        paperTradingComparisonTradingPromotionHasRuntimeShape(latestPromotion) &&
        latestPromotion.candidate_ref.id === candidateId &&
        orderedOutcomes.find((outcome) =>
          outcome.paper_trading_comparison_confirmation_campaign_outcome_id ===
            latestPromotion.comparison_confirmation.campaign_outcome_ref.id &&
          outcome.outcome_digest ===
            latestPromotion.comparison_confirmation.campaign_outcome_digest &&
          eligibleOutcome(outcome)
        );
      if (exactReplay) {
        const replayed = await this.options.store.recordTradingPromotion(
          latestPromotion
        );
        if (!paperTradingComparisonTradingPromotionHasRuntimeShape(replayed) ||
          !isDeepStrictEqual(replayed, latestPromotion)) {
          throw new PaperTradingComparisonPromotionServiceError(
            "paper_trading_comparison_promotion_persistence_conflict",
            "Store did not preserve the exact TradingPromotion replay."
          );
        }
        return replayed;
      }

      const candidateEvidence: EligibleCampaignEvidence[] = [];
      for (const outcome of orderedOutcomes) {
        if (!eligibleOutcome(outcome)) continue;
        const campaign = await this.options.store
          .getPaperTradingComparisonConfirmationCampaign(outcome.campaign_ref.id);
        if (!campaign) throw referenceNotFound();
        if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign) ||
          campaign.paper_trading_comparison_confirmation_campaign_id !==
            outcome.campaign_ref.id ||
          campaign.campaign_digest !== outcome.campaign_digest) {
          throw graphInvalid();
        }
        if (campaign.challenger.candidate_ref.id === candidateId) {
          candidateEvidence.push({ campaign, outcome });
        }
      }

      const selected = candidateEvidence.find(({ campaign }) =>
        campaignMatchesCurrentPromotion(campaign, latestPromotion)
      );
      if (!selected) {
        if (candidateEvidence.length > 0) throw staleEvidence();
        throw evidenceRequired();
      }

      const finalResult = selected.outcome.slot_results.at(-1);
      if (!finalResult?.verdict_ref || !finalResult.verdict_digest ||
        finalResult.status !== "challenger_improved") {
        throw graphInvalid();
      }
      const finalVerdict = await this.options.store
        .getPaperTradingComparisonVerdict(finalResult.verdict_ref.id);
      if (!finalVerdict) throw referenceNotFound();
      if (!paperTradingComparisonVerdictHasRuntimeShape(finalVerdict) ||
        finalVerdict.paper_trading_comparison_verdict_id !==
          finalResult.verdict_ref.id ||
        finalVerdict.verdict_digest !== finalResult.verdict_digest ||
        finalVerdict.paper_trading_comparison_commitment_ref.id !==
          finalResult.paper_trading_comparison_commitment_ref.id ||
        finalVerdict.verdict_outcome !== "challenger_improved" ||
        finalVerdict.pair_qualification.qualification_status !== "qualified" ||
        !paperTradingComparisonRefsEqual(
          finalVerdict.challenger.candidate_ref,
          selected.campaign.challenger.candidate_ref
        ) ||
        !paperTradingComparisonRefsEqual(
          finalVerdict.challenger.candidate_version_ref,
          selected.campaign.challenger.candidate_version_ref
        ) ||
        !paperTradingComparisonRefsEqual(
          finalVerdict.challenger.system_code_ref,
          selected.campaign.challenger.system_code_ref
        ) ||
        finalVerdict.challenger.system_code_artifact_digest !==
          selected.campaign.challenger.system_code_artifact_digest) {
        throw graphInvalid();
      }

      const promotedAt = exactNow(this.now);
      if (Date.parse(promotedAt) <= Date.parse(selected.outcome.evaluated_at) ||
        Date.parse(promotedAt) <= Date.parse(finalVerdict.evaluated_at)) {
        throw invalidInput(
          "Promotion clock must follow campaign outcome and final verdict."
        );
      }
      const promotion: TradingPromotionRecord = {
        record_kind: "trading_promotion",
        version: 1,
        trading_promotion_id: "trading-promotion-" + safeId(
          selected.outcome
            .paper_trading_comparison_confirmation_campaign_outcome_id
        ),
        status: "promoted_for_trading_review",
        candidate_ref: { ...selected.campaign.challenger.candidate_ref },
        candidate_version_ref: {
          ...selected.campaign.challenger.candidate_version_ref
        },
        paper_trading_evaluation_ref: {
          ...finalVerdict.challenger.paper_trading_evaluation_ref
        },
        comparison_confirmation: {
          basis_kind: "paper_trading_comparison_confirmation",
          campaign_ref: {
            record_kind: "paper_trading_comparison_confirmation_campaign",
            id: selected.campaign
              .paper_trading_comparison_confirmation_campaign_id
          },
          campaign_digest: selected.campaign.campaign_digest,
          campaign_outcome_ref: {
            record_kind:
              "paper_trading_comparison_confirmation_campaign_outcome",
            id: selected.outcome
              .paper_trading_comparison_confirmation_campaign_outcome_id
          },
          campaign_outcome_digest: selected.outcome.outcome_digest,
          final_verdict_ref: { ...finalResult.verdict_ref },
          final_verdict_digest: finalResult.verdict_digest
        },
        promoted_at: promotedAt,
        authority_status: "not_live"
      };
      if (!paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)) {
        throw graphInvalid();
      }
      const recorded = await this.options.store.recordTradingPromotion(promotion);
      if (!paperTradingComparisonTradingPromotionHasRuntimeShape(recorded) ||
        !isDeepStrictEqual(recorded, promotion)) {
        throw new PaperTradingComparisonPromotionServiceError(
          "paper_trading_comparison_promotion_persistence_conflict",
          "Store did not preserve the exact TradingPromotion."
        );
      }
      return recorded;
    } catch (error) {
      if (error instanceof PaperTradingComparisonPromotionServiceError) {
        throw error;
      }
      throw graphInvalid();
    }
  }
}

function eligibleOutcome(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): boolean {
  return outcome.campaign_outcome === "confirmed_improvement" &&
    outcome.promotion_eligibility === "eligible" &&
    outcome.next_action === "review_for_trading_promotion" &&
    outcome.slot_results.length > 0 &&
    outcome.slot_results.every((result) =>
      result.status === "challenger_improved" &&
      result.verdict_ref !== undefined &&
      result.verdict_digest !== undefined
    );
}

function campaignMatchesCurrentPromotion(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  latest: TradingPromotionRecord | undefined
): boolean {
  const selection = campaign.champion_selection;
  if (selection.selection_kind === "bootstrap") return latest === undefined;
  return latest !== undefined &&
    paperTradingComparisonTradingPromotionHasRuntimeShape(latest) &&
    selection.trading_promotion_ref.id === latest.trading_promotion_id &&
    selection.trading_promotion_digest === digest(
      paperTradingComparisonTradingPromotionDigestInput(latest)
    );
}

function normalizeCandidateId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 ||
    value !== value.trim()) {
    throw invalidInput("Candidate ID is required.");
  }
  return value;
}

function exactNow(now: () => string): string {
  const value = now();
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value) {
    throw invalidInput("Promotion clock must be a canonical ISO timestamp.");
  }
  return value;
}

function digest(value: string): string {
  return "sha256:" + createHash("sha256").update(value).digest("hex");
}

function invalidInput(message: string): PaperTradingComparisonPromotionServiceError {
  return new PaperTradingComparisonPromotionServiceError(
    "invalid_paper_trading_comparison_promotion_input",
    message
  );
}

function evidenceRequired(): PaperTradingComparisonPromotionServiceError {
  return new PaperTradingComparisonPromotionServiceError(
    "paper_trading_comparison_promotion_evidence_required",
    "No eligible paper comparison confirmation campaign exists for the candidate."
  );
}

function staleEvidence(): PaperTradingComparisonPromotionServiceError {
  return new PaperTradingComparisonPromotionServiceError(
    "paper_trading_comparison_promotion_stale",
    "Eligible paper comparison evidence does not challenge the current Trading review champion."
  );
}

function referenceNotFound(): PaperTradingComparisonPromotionServiceError {
  return new PaperTradingComparisonPromotionServiceError(
    "paper_trading_comparison_promotion_reference_not_found",
    "Paper comparison promotion evidence was not found."
  );
}

function graphInvalid(): PaperTradingComparisonPromotionServiceError {
  return new PaperTradingComparisonPromotionServiceError(
    "paper_trading_comparison_promotion_graph_invalid",
    "Paper comparison promotion evidence graph is invalid."
  );
}
