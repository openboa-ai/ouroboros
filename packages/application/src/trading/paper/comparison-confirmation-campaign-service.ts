import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonConfirmationSlotResult,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { decidePaperTradingComparisonConfirmationCampaign } from
  "./comparison-confirmation-decision";
import { paperTradingComparisonIdsForIdempotencyKey } from
  "./comparison-identity";

export type PaperTradingComparisonConfirmationCampaignServiceErrorCode =
  | "invalid_paper_trading_comparison_confirmation_campaign_input"
  | "paper_trading_comparison_confirmation_campaign_source_ineligible"
  | "paper_trading_comparison_confirmation_campaign_not_terminal"
  | "paper_trading_comparison_confirmation_campaign_graph_invalid";

export class PaperTradingComparisonConfirmationCampaignServiceError extends Error {
  constructor(
    readonly code: PaperTradingComparisonConfirmationCampaignServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PaperTradingComparisonConfirmationCampaignServiceError";
  }
}

export class PaperTradingComparisonConfirmationCampaignService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async precommit(input: {
    sourceVerdictId: string;
  }): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    const sourceVerdictId = nonEmptyId(input?.sourceVerdictId);
    let campaign: PaperTradingComparisonConfirmationCampaignRecord;
    try {
      const existing = (
        await this.options.store.listPaperTradingComparisonConfirmationCampaigns()
      ).find((record) => record.source_verdict_ref.id === sourceVerdictId);
      if (existing) {
        if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(existing)) {
          throw graphInvalid();
        }
        campaign = existing;
      } else {
        campaign = await this.buildCampaign(sourceVerdictId);
      }
    } catch (error) {
      if (error instanceof PaperTradingComparisonConfirmationCampaignServiceError) {
        throw error;
      }
      throw graphInvalid();
    }
    return this.options.store.recordPaperTradingComparisonConfirmationCampaign(campaign);
  }

  async settle(input: {
    campaignId: string;
  }): Promise<PaperTradingComparisonConfirmationCampaignOutcomeRecord> {
    const campaignId = nonEmptyId(input?.campaignId);
    let outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
    try {
      const campaign = await this.options.store
        .getPaperTradingComparisonConfirmationCampaign(campaignId);
      if (!campaign ||
        !paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign)) {
        throw graphInvalid();
      }
      const outcomeId = `${campaignId}-outcome`;
      const existing = await this.options.store
        .getPaperTradingComparisonConfirmationCampaignOutcome(outcomeId);
      if (existing &&
        !paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(existing)) {
        throw graphInvalid();
      }
      const evaluatedAt = existing?.evaluated_at ?? exactNow(this.now);
      const slotResults = await this.loadCompleteSlotResults(campaign, evaluatedAt);
      const decision = decidePaperTradingComparisonConfirmationCampaign({
        campaign,
        slotResults
      });
      const withoutDigest: PaperTradingComparisonConfirmationCampaignOutcomeRecord = {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        version: 1,
        paper_trading_comparison_confirmation_campaign_outcome_id: outcomeId,
        campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: campaign.paper_trading_comparison_confirmation_campaign_id
        },
        campaign_digest: campaign.campaign_digest,
        slot_results: slotResults,
        ...decision,
        decision_rule: "all_reserved_windows_must_improve",
        release_status: "sealed",
        evaluated_at: evaluatedAt,
        outcome_digest: "",
        evaluation_authority: "external_to_trading_systems",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      };
      outcome = {
        ...withoutDigest,
        outcome_digest: digest(
          paperTradingComparisonConfirmationCampaignOutcomeDigestInput(withoutDigest)
        )
      };
      if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome) ||
        existing && !isDeepStrictEqual(existing, outcome)) {
        throw graphInvalid();
      }
    } catch (error) {
      if (error instanceof PaperTradingComparisonConfirmationCampaignServiceError) {
        throw error;
      }
      throw graphInvalid();
    }
    return this.options.store
      .recordPaperTradingComparisonConfirmationCampaignOutcome(outcome);
  }

  private async buildCampaign(
    sourceVerdictId: string
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    const sourceVerdict = await this.options.store
      .getPaperTradingComparisonVerdict(sourceVerdictId);
    if (!sourceVerdict || !paperTradingComparisonVerdictHasRuntimeShape(sourceVerdict)) {
      throw graphInvalid();
    }
    if (sourceVerdict.verdict_outcome !== "challenger_improved" ||
      sourceVerdict.pair_qualification.qualification_status !== "qualified" ||
      sourceVerdict.confirmation_disposition !== "requires_precommitted_campaign" ||
      sourceVerdict.release_status !== "sealed" ||
      sourceVerdict.promotion_eligibility !== "not_eligible") {
      throw new PaperTradingComparisonConfirmationCampaignServiceError(
        "paper_trading_comparison_confirmation_campaign_source_ineligible",
        "Paper comparison source verdict is not eligible to start confirmation."
      );
    }
    const sourceComparison = await this.options.store.getPaperTradingComparisonCommitment(
      sourceVerdict.paper_trading_comparison_commitment_ref.id
    );
    const sourcePreparation = sourceComparison
      ? await this.options.store.getPaperTradingComparisonPreparation(
          sourceComparison.preparation_ref.id
        )
      : undefined;
    if (!sourceComparison || !sourcePreparation ||
      !paperTradingComparisonCommitmentHasRuntimeShape(sourceComparison) ||
      !paperTradingComparisonPreparationHasRuntimeShape(sourcePreparation) ||
      sourceVerdict.paper_trading_comparison_commitment_digest !==
        sourceComparison.commitment_digest ||
      sourcePreparation.paper_trading_comparison_commitment_id !==
        sourceComparison.paper_trading_comparison_commitment_id ||
      !sameSourceSide(sourceVerdict, sourceComparison, "champion") ||
      !sameSourceSide(sourceVerdict, sourceComparison, "challenger")) {
      throw graphInvalid();
    }
    const committedAt = exactNow(this.now);
    if (Date.parse(committedAt) <= Date.parse(sourceVerdict.evaluated_at)) {
      throw new PaperTradingComparisonConfirmationCampaignServiceError(
        "invalid_paper_trading_comparison_confirmation_campaign_input",
        "Confirmation campaign clock must follow the source verdict."
      );
    }
    const campaignId = campaignIdForSource(sourceVerdictId);
    const slots = Array.from(
      { length: sourceComparison.comparison_policy.required_confirmation_count },
      (_, index) => {
        const slotIndex = index + 1;
        const comparisonIdempotencyKey =
          `paper-comparison-confirmation:${campaignId}:slot:${slotIndex}`;
        const ids = paperTradingComparisonIdsForIdempotencyKey(
          comparisonIdempotencyKey
        );
        return {
          slot_index: slotIndex,
          comparison_idempotency_key: comparisonIdempotencyKey,
          paper_trading_comparison_preparation_id: ids.preparation_id,
          paper_trading_comparison_commitment_id: ids.comparison_commitment_id
        };
      }
    );
    const withoutDigest: PaperTradingComparisonConfirmationCampaignRecord = {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      version: 1,
      paper_trading_comparison_confirmation_campaign_id: campaignId,
      source_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: sourceVerdict.paper_trading_comparison_verdict_id
      },
      source_verdict_digest: sourceVerdict.verdict_digest,
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: sourceComparison.paper_trading_comparison_commitment_id
      },
      source_comparison_digest: sourceComparison.commitment_digest,
      champion: structuredClone(sourcePreparation.champion),
      challenger: structuredClone(sourcePreparation.challenger),
      champion_selection: structuredClone(sourceComparison.champion_selection),
      comparison_policy: structuredClone(sourceComparison.comparison_policy),
      market_data_configuration_digest:
        sourceComparison.market_data_configuration_digest,
      paper_policy_identity: structuredClone(sourceComparison.paper_policy_identity),
      campaign_policy: {
        policy_version: "paper-comparison-confirmation-v1",
        required_window_count:
          sourceComparison.comparison_policy.required_confirmation_count,
        decision_rule: "all_reserved_windows_must_improve",
        slot_order_policy: "strict_sequence",
        non_overlap_policy: "strict",
        maximum_slot_start_delay_ms:
          sourceComparison.comparison_policy.maximum_elapsed_ms,
        missed_slot_policy: "campaign_not_confirmed"
      },
      slots,
      committed_at: committedAt,
      campaign_digest: "",
      evaluation_authority: "external_to_trading_systems",
      promotion_eligibility: "not_eligible",
      release_status: "sealed",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    };
    const campaign = {
      ...withoutDigest,
      campaign_digest: digest(
        paperTradingComparisonConfirmationCampaignDigestInput(withoutDigest)
      )
    };
    if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign)) {
      throw graphInvalid();
    }
    return campaign;
  }

  private async loadCompleteSlotResults(
    campaign: PaperTradingComparisonConfirmationCampaignRecord,
    evaluatedAt: string
  ): Promise<PaperTradingComparisonConfirmationSlotResult[]> {
    const results: PaperTradingComparisonConfirmationSlotResult[] = [];
    let applicableStart = campaign.committed_at;
    for (let index = 0; index < campaign.slots.length; index += 1) {
      const slot = campaign.slots[index]!;
      const verdicts = await this.options.store.listPaperTradingComparisonVerdicts(
        slot.paper_trading_comparison_commitment_id
      );
      if (!Array.isArray(verdicts) || verdicts.length > 1) throw graphInvalid();
      const verdict = verdicts[0];
      if (verdict) {
        if (!paperTradingComparisonVerdictHasRuntimeShape(verdict) ||
          verdict.paper_trading_comparison_commitment_ref.id !==
            slot.paper_trading_comparison_commitment_id ||
          verdict.paper_trading_comparison_verdict_id ===
            campaign.source_verdict_ref.id ||
          Date.parse(verdict.window_started_at) <= Date.parse(applicableStart) ||
          Date.parse(evaluatedAt) < Date.parse(verdict.evaluated_at)) {
          throw graphInvalid();
        }
        results.push(resultForVerdict(index + 1, slot, verdict));
        applicableStart = verdict.evaluated_at;
        continue;
      }
      const preparation = await this.options.store
        .getPaperTradingComparisonPreparation(
          slot.paper_trading_comparison_preparation_id
        );
      if (preparation) throw notTerminal();
      if (Date.parse(evaluatedAt) <= Date.parse(applicableStart) +
        campaign.campaign_policy.maximum_slot_start_delay_ms) {
        throw notTerminal();
      }
      for (let remaining = index; remaining < campaign.slots.length; remaining += 1) {
        const remainingSlot = campaign.slots[remaining]!;
        const [futurePreparation, futureVerdicts] = await Promise.all([
          this.options.store.getPaperTradingComparisonPreparation(
            remainingSlot.paper_trading_comparison_preparation_id
          ),
          this.options.store.listPaperTradingComparisonVerdicts(
            remainingSlot.paper_trading_comparison_commitment_id
          )
        ]);
        if (futurePreparation || !Array.isArray(futureVerdicts) ||
          futureVerdicts.length !== 0) {
          throw graphInvalid();
        }
        results.push({
          slot_index: remaining + 1,
          paper_trading_comparison_commitment_ref: {
            record_kind: "paper_trading_comparison_commitment",
            id: remainingSlot.paper_trading_comparison_commitment_id
          },
          status: "slot_expired"
        });
      }
      break;
    }
    if (results.length !== campaign.slots.length) throw notTerminal();
    return results;
  }
}

function resultForVerdict(
  slotIndex: number,
  slot: PaperTradingComparisonConfirmationCampaignRecord["slots"][number],
  verdict: PaperTradingComparisonVerdictRecord
): PaperTradingComparisonConfirmationSlotResult {
  return {
    slot_index: slotIndex,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: slot.paper_trading_comparison_commitment_id
    },
    status: verdict.verdict_outcome === "challenger_improved"
      ? "challenger_improved"
      : verdict.verdict_outcome === "challenger_not_improved"
        ? "challenger_not_improved"
        : "comparison_ineligible",
    verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: verdict.paper_trading_comparison_verdict_id
    },
    verdict_digest: verdict.verdict_digest,
    window_started_at: verdict.window_started_at,
    window_ended_at: verdict.window_ended_at
  };
}

function sameSourceSide(
  verdict: PaperTradingComparisonVerdictRecord,
  comparison: PaperTradingComparisonCommitmentRecord,
  role: "champion" | "challenger"
): boolean {
  return verdict[role].candidate_ref.id === comparison[role].candidate_ref.id &&
    verdict[role].candidate_version_ref.id ===
      comparison[role].candidate_version_ref.id &&
    verdict[role].system_code_ref.id === comparison[role].system_code_ref.id &&
    verdict[role].system_code_artifact_digest ===
      comparison[role].system_code_artifact_digest &&
    verdict[role].trading_run_ref.id === comparison[role].trading_run_ref.id &&
    verdict[role].paper_trading_evaluation_commitment_ref.id ===
      comparison[role].paper_trading_evaluation_commitment_ref.id &&
    verdict[role].paper_trading_evaluation_ref.id ===
      comparison[role].paper_trading_evaluation_ref.id;
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

function campaignIdForSource(sourceVerdictId: string): string {
  return `paper-comparison-confirmation-campaign-${createHash("sha256")
    .update(sourceVerdictId)
    .digest("hex")
    .slice(0, 32)}`;
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function notTerminal(): PaperTradingComparisonConfirmationCampaignServiceError {
  return new PaperTradingComparisonConfirmationCampaignServiceError(
    "paper_trading_comparison_confirmation_campaign_not_terminal",
    "Paper comparison confirmation campaign is not terminal."
  );
}

function graphInvalid(): PaperTradingComparisonConfirmationCampaignServiceError {
  return new PaperTradingComparisonConfirmationCampaignServiceError(
    "paper_trading_comparison_confirmation_campaign_graph_invalid",
    "Paper comparison confirmation campaign graph is invalid."
  );
}
