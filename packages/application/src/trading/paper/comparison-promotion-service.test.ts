import {
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonVerdictRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../../ports/store";
import {
  PaperTradingComparisonPromotionService,
  PaperTradingComparisonPromotionServiceError
} from "./comparison-promotion-service";

describe("PaperTradingComparisonPromotionService", () => {
  it("promotes the exact final challenger evaluation from current eligible evidence", async () => {
    const harness = promotionHarness();
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => "2026-07-12T09:00:00.000Z"
    });

    const promotion = await service.promote({ candidateId: "challenger-candidate" });

    expect(promotion).toMatchObject({
      trading_promotion_id: "trading-promotion-confirmation-campaign-001-outcome",
      status: "promoted_for_trading_review",
      candidate_ref: harness.campaign.challenger.candidate_ref,
      candidate_version_ref: harness.campaign.challenger.candidate_version_ref,
      paper_trading_evaluation_ref:
        harness.finalVerdict.challenger.paper_trading_evaluation_ref,
      comparison_confirmation: {
        basis_kind: "paper_trading_comparison_confirmation",
        campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: harness.campaignId
        },
        campaign_digest: harness.campaign.campaign_digest,
        campaign_outcome_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
          id: harness.outcomeId
        },
        campaign_outcome_digest: harness.outcome.outcome_digest,
        final_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: harness.finalVerdictId
        },
        final_verdict_digest: harness.finalVerdict.verdict_digest
      },
      promoted_at: "2026-07-12T09:00:00.000Z",
      authority_status: "not_live"
    });
    expect(harness.recordedPromotions).toEqual([promotion]);
    expect(harness.calls).toEqual([
      "listPaperTradingComparisonConfirmationCampaignOutcomes",
      "getLatestTradingPromotion",
      "getPaperTradingComparisonConfirmationCampaign",
      "getPaperTradingComparisonVerdict",
      "recordTradingPromotion"
    ]);
  });

  it("rejects malformed input before any Store read", async () => {
    const harness = promotionHarness();
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store
    });

    await expect(service.promote({ candidateId: " " })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_promotion_input"
    });
    expect(harness.calls).toEqual([]);
  });

  it("requires a terminal all-improved eligible campaign", async () => {
    const harness = promotionHarness();
    harness.outcome.slot_results[1]!.status = "challenger_not_improved";
    harness.outcome.improved_count = 1;
    harness.outcome.not_improved_count = 1;
    harness.outcome.campaign_outcome = "not_confirmed";
    harness.outcome.promotion_eligibility = "not_eligible";
    harness.outcome.next_action = "return_to_candidate_arena";
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store
    });

    await expect(service.promote({
      candidateId: "challenger-candidate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_promotion_evidence_required"
    });
    expect(harness.recordedPromotions).toEqual([]);
  });

  it("rejects eligible evidence bound to a stale Trading review champion", async () => {
    const previous = promotionRecord("previous-promotion", "previous-outcome");
    const latest = promotionRecord("latest-promotion", "latest-outcome");
    const harness = promotionHarness({
      comparisonMode: "champion_challenge",
      championPromotion: previous,
      latestPromotion: latest
    });
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store
    });

    await expect(service.promote({
      candidateId: "challenger-candidate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_promotion_stale"
    });
    expect(harness.recordedPromotions).toEqual([]);
  });

  it("rejects a final verdict that does not prove qualified challenger improvement", async () => {
    const harness = promotionHarness();
    harness.finalVerdict.verdict_outcome = "challenger_not_improved";
    harness.finalVerdict.confirmation_disposition = "not_applicable";
    harness.finalVerdict.next_action = "return_to_candidate_arena";
    harness.finalVerdict.metric!.challenger_value_usdt = 0;
    harness.finalVerdict.metric!.observed_lift_usdt = 0;
    harness.finalVerdict.challenger.net_revenue_usdt = 0;
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store
    });

    await expect(service.promote({
      candidateId: "challenger-candidate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_promotion_graph_invalid"
    });
    expect(harness.recordedPromotions).toEqual([]);
  });

  it("returns an existing exact promotion before rechecking bootstrap currentness", async () => {
    const harness = promotionHarness();
    const firstService = new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => "2026-07-12T09:00:00.000Z"
    });
    const first = await firstService.promote({
      candidateId: "challenger-candidate"
    });
    harness.latestPromotion = first;
    harness.recordedPromotions.length = 0;
    harness.calls.length = 0;

    const replay = await new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => "2026-07-13T09:00:00.000Z"
    }).promote({ candidateId: "challenger-candidate" });

    expect(replay).toEqual(first);
    expect(harness.recordedPromotions).toEqual([]);
    expect(harness.calls).toEqual([
      "listPaperTradingComparisonConfirmationCampaignOutcomes",
      "getLatestTradingPromotion",
      "recordTradingPromotion"
    ]);
  });

  it("fails closed when Store does not preserve the exact promotion", async () => {
    const harness = promotionHarness({ recordDrift: true });
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => "2026-07-12T09:00:00.000Z"
    });

    await expect(service.promote({
      candidateId: "challenger-candidate"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_promotion_persistence_conflict"
    });
  });

  it("uses no authority-bearing dependency", async () => {
    const harness = promotionHarness();
    await new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => "2026-07-12T09:00:00.000Z"
    }).promote({ candidateId: "challenger-candidate" });

    expect(harness.calls).not.toContain("recordPaperTradingComparisonResearchRelease");
    expect(harness.calls).not.toContain("recordCandidateArenaTick");
    expect(harness.calls).not.toContain("startSandbox");
    expect(harness.calls).not.toContain("stopSandbox");
    expect(harness.calls).not.toContain("recordLedger");
    expect(harness.calls).not.toContain("submitOrder");
  });

  it("requires promotion time to follow outcome and final verdict", async () => {
    const harness = promotionHarness();
    const service = new PaperTradingComparisonPromotionService({
      store: harness.store,
      now: () => harness.outcome.evaluated_at
    });

    await expect(service.promote({
      candidateId: "challenger-candidate"
    })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_promotion_input"
    });
    expect(harness.recordedPromotions).toEqual([]);
  });

  it("exposes stable service error identity", () => {
    expect(new PaperTradingComparisonPromotionServiceError(
      "paper_trading_comparison_promotion_graph_invalid",
      "invalid graph"
    )).toMatchObject({
      name: "PaperTradingComparisonPromotionServiceError",
      code: "paper_trading_comparison_promotion_graph_invalid"
    });
  });
});

type HarnessOptions = {
  comparisonMode?: "bootstrap" | "champion_challenge";
  championPromotion?: TradingPromotionRecord;
  latestPromotion?: TradingPromotionRecord;
  recordDrift?: boolean;
};

function promotionHarness(options: HarnessOptions = {}) {
  const campaign = campaignFixture(options);
  const outcome = outcomeFixture(campaign);
  const finalVerdict = verdictFixture(
    campaign.slots[1]!.paper_trading_comparison_commitment_id,
    "slot-verdict-2",
    "2026-07-12T05:00:00.000Z",
    "2026-07-12T05:30:00.000Z",
    "2026-07-12T05:31:00.000Z"
  );
  const calls: string[] = [];
  const recordedPromotions: TradingPromotionRecord[] = [];
  const state = {
    latestPromotion: options.latestPromotion
  };

  expect(paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign))
    .toBe(true);
  expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome))
    .toBe(true);
  expect(paperTradingComparisonVerdictHasRuntimeShape(finalVerdict)).toBe(true);

  const store = {
    async listPaperTradingComparisonConfirmationCampaignOutcomes() {
      calls.push("listPaperTradingComparisonConfirmationCampaignOutcomes");
      return [outcome];
    },
    async getLatestTradingPromotion() {
      calls.push("getLatestTradingPromotion");
      return state.latestPromotion;
    },
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      calls.push("getPaperTradingComparisonConfirmationCampaign");
      return id === campaign.paper_trading_comparison_confirmation_campaign_id
        ? campaign
        : undefined;
    },
    async getPaperTradingComparisonVerdict(id: string) {
      calls.push("getPaperTradingComparisonVerdict");
      return id === finalVerdict.paper_trading_comparison_verdict_id
        ? finalVerdict
        : undefined;
    },
    async recordTradingPromotion(promotion: TradingPromotionRecord) {
      calls.push("recordTradingPromotion");
      if (state.latestPromotion &&
        isDeepStrictEqual(state.latestPromotion, promotion)) {
        return state.latestPromotion;
      }
      recordedPromotions.push(structuredClone(promotion));
      state.latestPromotion = promotion;
      return options.recordDrift
        ? { ...promotion, promoted_at: "2026-07-12T09:00:01.000Z" }
        : promotion;
    }
  } as unknown as OuroborosStorePort;

  return {
    store,
    campaign,
    outcome,
    finalVerdict,
    campaignId: campaign.paper_trading_comparison_confirmation_campaign_id,
    outcomeId:
      outcome.paper_trading_comparison_confirmation_campaign_outcome_id,
    finalVerdictId: finalVerdict.paper_trading_comparison_verdict_id,
    calls,
    recordedPromotions,
    get latestPromotion() {
      return state.latestPromotion;
    },
    set latestPromotion(value: TradingPromotionRecord | undefined) {
      state.latestPromotion = value;
    }
  };
}

function campaignFixture(
  options: Pick<HarnessOptions, "comparisonMode" | "championPromotion">
): PaperTradingComparisonConfirmationCampaignRecord {
  const mode = options.comparisonMode ?? "bootstrap";
  const championSelection = mode === "bootstrap"
    ? { selection_kind: "bootstrap" as const }
    : {
        selection_kind: "trading_review" as const,
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: options.championPromotion!.trading_promotion_id
        },
        trading_promotion_digest: digest(
          paperTradingComparisonTradingPromotionDigestInput(
            options.championPromotion!
          )
        ),
        paper_trading_evaluation_ref: {
          ...options.championPromotion!.paper_trading_evaluation_ref
        },
        paper_trading_evaluation_record_digest: "sha256:champion-evaluation",
        paper_trading_evaluation_commitment_ref: {
          record_kind: "paper_trading_evaluation_commitment",
          id: "champion-promotion-commitment"
        },
        paper_trading_evaluation_commitment_record_digest:
          "sha256:champion-promotion-commitment",
        paper_trading_observation_chain_digest:
          "sha256:champion-promotion-observations"
      };
  const comparisonPolicy = comparisonPolicyFixture(mode);

  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id:
      "confirmation-campaign-001",
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict-001"
    },
    source_verdict_digest: "sha256:source-verdict",
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "source-comparison-001"
    },
    source_comparison_digest: "sha256:source-comparison",
    champion: candidateSide("champion"),
    challenger: candidateSide("challenger"),
    champion_selection: championSelection,
    comparison_policy: comparisonPolicy,
    market_data_configuration_digest: "sha256:market",
    paper_policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: "cost-v1",
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 2,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms: comparisonPolicy.maximum_elapsed_ms,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [1, 2].map((index) => ({
      slot_index: index,
      comparison_idempotency_key:
        "paper-comparison-confirmation:confirmation-campaign-001:slot:" +
        String(index),
      paper_trading_comparison_preparation_id:
        "paper-trading-comparison-preparation-" +
        (index === 1 ? "1111111111111111" : "2222222222222222"),
      paper_trading_comparison_commitment_id:
        "paper-trading-comparison-" +
        (index === 1 ? "1111111111111111" : "2222222222222222")
    })),
    committed_at: "2026-07-12T03:00:00.000Z",
    campaign_digest: "sha256:campaign",
    evaluation_authority: "external_to_trading_systems",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function outcomeFixture(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      campaign.paper_trading_comparison_confirmation_campaign_id + "-outcome",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    slot_results: campaign.slots.map((slot, index) => ({
      slot_index: slot.slot_index,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: slot.paper_trading_comparison_commitment_id
      },
      status: "challenger_improved",
      verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "slot-verdict-" + String(index + 1)
      },
      verdict_digest: "sha256:slot-verdict-" + String(index + 1),
      window_started_at:
        index === 0
          ? "2026-07-12T04:00:00.000Z"
          : "2026-07-12T05:00:00.000Z",
      window_ended_at:
        index === 0
          ? "2026-07-12T04:30:00.000Z"
          : "2026-07-12T05:30:00.000Z"
    })),
    improved_count: 2,
    not_improved_count: 0,
    ineligible_count: 0,
    expired_count: 0,
    campaign_outcome: "confirmed_improvement",
    decision_rule: "all_reserved_windows_must_improve",
    promotion_eligibility: "eligible",
    release_status: "sealed",
    next_action: "review_for_trading_promotion",
    evaluated_at: "2026-07-12T07:00:00.000Z",
    outcome_digest: "sha256:campaign-outcome",
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function verdictFixture(
  comparisonId: string,
  verdictId: string,
  startedAt: string,
  endedAt: string,
  evaluatedAt: string
): PaperTradingComparisonVerdictRecord {
  const qualification = {
    comparison_id: comparisonId,
    activation_id: "activation-002",
    activation_attempt_id: "activation-attempt-002",
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    checkpoint_count: 2,
    champion: sideQualification(),
    challenger: sideQualification(),
    authority_status: "not_verdict" as const
  };
  return {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: verdictId,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparisonId
    },
    paper_trading_comparison_commitment_digest: "sha256:comparison",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: qualification.activation_id
    },
    paper_trading_comparison_activation_digest: "sha256:activation",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: qualification.activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: "sha256:attempt",
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "activation-outcome"
    },
    final_activation_outcome_digest: "sha256:activation-outcome",
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "tick-2"
    },
    latest_tick_digest: "sha256:tick-2",
    checkpoint_outcome_refs: [1, 2].map((sequence) => ({
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: "checkpoint-" + String(sequence)
    })),
    checkpoint_outcome_digests: [
      "sha256:checkpoint-1",
      "sha256:checkpoint-2"
    ],
    pair_qualification: qualification,
    pair_qualification_digest: "sha256:qualification",
    champion: verdictSide("champion", 0),
    challenger: verdictSide("challenger", 1),
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: 1,
      observed_lift_usdt: 1,
      minimum_lift_usdt: 0.5
    },
    verdict_outcome: "challenger_improved",
    window_started_at: startedAt,
    window_ended_at: endedAt,
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: "requires_precommitted_campaign",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: "precommit_confirmation_campaign",
    evaluated_at: evaluatedAt,
    verdict_digest: "sha256:" + verdictId,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function verdictSide(role: "champion" | "challenger", netRevenue: number) {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: role + "-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: role + "-version"
    },
    system_code_ref: { record_kind: "system_code", id: role + "-code" },
    system_code_artifact_digest: "sha256:" + role + "-artifact",
    trading_run_ref: { record_kind: "trading_run", id: role + "-run-final" },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: role + "-commitment-final"
    },
    paper_trading_evaluation_commitment_record_digest:
      "sha256:" + role + "-commitment-final",
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: role + "-evaluation-final"
    },
    paper_trading_evaluation_record_digest:
      "sha256:" + role + "-evaluation-final",
    paper_trading_observation_chain_digest:
      "sha256:" + role + "-observations-final",
    net_revenue_usdt: netRevenue,
    cost_usdt: 0
  };
}

function sideQualification() {
  return {
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    evidence_window: {
      observation_count: 2,
      elapsed_ms: 60_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T05:00:00.000Z",
      last_observed_at: "2026-07-12T05:30:00.000Z"
    }
  };
}

function candidateSide(
  role: "champion" | "challenger"
): PaperTradingComparisonCandidateSide {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: role + "-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: role + "-version"
    },
    candidate_version_digest: "sha256:" + role + "-version",
    system_code_ref: { record_kind: "system_code", id: role + "-code" },
    system_code_record_digest: "sha256:" + role + "-code-record",
    system_code_artifact_digest: "sha256:" + role + "-artifact",
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: role + "-admission"
    },
    admission_decision_digest: "sha256:" + role + "-admission"
  };
}

function comparisonPolicyFixture(
  comparisonMode: "bootstrap" | "champion_challenge"
): PaperTradingComparisonPolicy {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: comparisonMode,
    symbol: "BTCUSDT",
    interval_ms: 60_000,
    minimum_observation_count: 2,
    minimum_elapsed_ms: 60_000,
    maximum_observation_count: 2,
    maximum_elapsed_ms: 600_000,
    maximum_start_skew_ms: 5_000,
    maximum_provider_request_count_per_side: 100,
    maximum_retry_count_per_side: 3,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 0.5,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  };
}

function promotionRecord(id: string, outcomeId: string): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: id,
    status: "promoted_for_trading_review",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: id + "-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: id + "-version"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: id + "-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: outcomeId.replace("-outcome", "")
      },
      campaign_digest: "sha256:" + id + "-campaign",
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: outcomeId
      },
      campaign_outcome_digest: "sha256:" + outcomeId,
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: id + "-verdict"
      },
      final_verdict_digest: "sha256:" + id + "-verdict"
    },
    promoted_at: "2026-07-11T00:00:00.000Z",
    authority_status: "not_live"
  };
}

function digest(value: string): string {
  return "sha256:" + createHash("sha256").update(value).digest("hex");
}
