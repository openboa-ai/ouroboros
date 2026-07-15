import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";
import {
  PaperTradingComparisonConfirmationCampaignService,
  PaperTradingComparisonConfirmationCampaignServiceError
} from "./comparison-confirmation-campaign-service";
import { paperTradingComparisonIdsForIdempotencyKey } from "./comparison-identity";

describe("PaperTradingComparisonConfirmationCampaignService", () => {
  it("precommits every deterministic future slot and exactly replays after clock advance", async () => {
    const harness = campaignHarness();
    let now = "2026-07-12T03:00:00.000Z";
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => now
    });

    const first = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });
    now = "2026-07-13T03:00:00.000Z";
    const replay = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });

    expect(replay).toEqual(first);
    expect(paperTradingComparisonConfirmationCampaignHasRuntimeShape(first)).toBe(true);
    expect(first.paper_trading_comparison_confirmation_campaign_id)
      .toBe(campaignIdForSource(harness.sourceVerdictId));
    expect(first.committed_at).toBe("2026-07-12T03:00:00.000Z");
    expect(first.slots).toHaveLength(2);
    expect(first.slots).toEqual(first.slots.map((slot, index) => {
      const key = `paper-comparison-confirmation:` +
        `${first.paper_trading_comparison_confirmation_campaign_id}:slot:${index + 1}`;
      const ids = paperTradingComparisonIdsForIdempotencyKey(key);
      return {
        slot_index: index + 1,
        comparison_idempotency_key: key,
        paper_trading_comparison_preparation_id: ids.preparation_id,
        paper_trading_comparison_commitment_id: ids.comparison_commitment_id
      };
    }));
    expect(harness.recordedCampaigns).toEqual([first, first]);
  });

  it("rejects invalid input before reading Store dependencies", async () => {
    const harness = campaignHarness();
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store
    });

    await expect(service.precommit({ sourceVerdictId: " " })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_confirmation_campaign_input"
    });
    expect(harness.readCount).toBe(0);
  });

  it("rejects a qualified source verdict that did not improve", async () => {
    const harness = campaignHarness({ sourceOutcome: "challenger_not_improved" });
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => "2026-07-12T03:00:00.000Z"
    });

    await expect(service.precommit({ sourceVerdictId: harness.sourceVerdictId }))
      .rejects.toMatchObject({
        name: "PaperTradingComparisonConfirmationCampaignServiceError",
        code: "paper_trading_comparison_confirmation_campaign_source_ineligible"
      });
  });

  it("settles only after every reserved verdict and does not stop after a negative", async () => {
    const harness = campaignHarness();
    let now = "2026-07-12T03:00:00.000Z";
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => now
    });
    const campaign = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });
    harness.setSlotVerdict(campaign, 1, "challenger_not_improved");
    now = "2026-07-12T04:40:00.000Z";

    await expect(service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_confirmation_campaign_not_terminal"
    });
    expect(harness.recordedOutcomes).toEqual([]);

    harness.setSlotVerdict(campaign, 2, "challenger_improved");
    now = "2026-07-12T06:00:00.000Z";
    const outcome = await service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    });
    expect(outcome).toMatchObject({
      campaign_outcome: "not_confirmed",
      improved_count: 1,
      not_improved_count: 1,
      promotion_eligibility: "not_eligible"
    });
    expect(paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome))
      .toBe(true);
  });

  it("expires the current and remaining unmaterialized slots only after the deadline", async () => {
    const harness = campaignHarness();
    let now = "2026-07-12T03:00:00.000Z";
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => now
    });
    const campaign = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });

    now = "2026-07-12T03:10:00.000Z";
    await expect(service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_confirmation_campaign_not_terminal"
    });
    now = "2026-07-12T03:10:00.001Z";
    const outcome = await service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    });

    expect(outcome.slot_results.map((result) => result.status)).toEqual([
      "slot_expired",
      "slot_expired"
    ]);
    expect(outcome).toMatchObject({
      expired_count: 2,
      campaign_outcome: "not_confirmed",
      promotion_eligibility: "not_eligible"
    });
  });

  it("does not expire a materialized slot that still lacks its verdict", async () => {
    const harness = campaignHarness();
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => "2026-07-12T04:00:00.000Z"
    });
    const campaign = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });
    harness.materializeSlot(campaign, 1);

    await expect(service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_confirmation_campaign_not_terminal"
    });
  });

  it("reuses the persisted outcome timestamp on restart replay", async () => {
    const harness = campaignHarness();
    let now = "2026-07-12T03:00:00.000Z";
    const service = new PaperTradingComparisonConfirmationCampaignService({
      store: harness.store,
      now: () => now
    });
    const campaign = await service.precommit({ sourceVerdictId: harness.sourceVerdictId });
    harness.setSlotVerdict(campaign, 1, "challenger_improved");
    harness.setSlotVerdict(campaign, 2, "challenger_improved");
    now = "2026-07-12T06:00:00.000Z";
    const first = await service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    });
    now = "2026-07-13T04:00:00.000Z";
    const replay = await service.settle({
      campaignId: campaign.paper_trading_comparison_confirmation_campaign_id
    });

    expect(replay).toEqual(first);
    expect(harness.recordedOutcomes).toEqual([first, first]);
  });

  it("exposes stable service error identity", () => {
    const error = new PaperTradingComparisonConfirmationCampaignServiceError(
      "paper_trading_comparison_confirmation_campaign_graph_invalid",
      "invalid graph"
    );
    expect(error).toMatchObject({
      name: "PaperTradingComparisonConfirmationCampaignServiceError",
      code: "paper_trading_comparison_confirmation_campaign_graph_invalid"
    });
  });
});

function campaignHarness(options: {
  sourceOutcome?: "challenger_improved" | "challenger_not_improved";
} = {}) {
  const sourceVerdict = sourceVerdictFixture(
    options.sourceOutcome ?? "challenger_improved"
  );
  const sourcePreparation = sourcePreparationFixture();
  const sourceComparison = sourceComparisonFixture(sourcePreparation);
  const campaigns: PaperTradingComparisonConfirmationCampaignRecord[] = [];
  const outcomes: PaperTradingComparisonConfirmationCampaignOutcomeRecord[] = [];
  const verdicts = new Map<string, PaperTradingComparisonVerdictRecord>([
    [sourceVerdict.paper_trading_comparison_verdict_id, sourceVerdict]
  ]);
  const preparations = new Map<string, PaperTradingComparisonPreparationRecord>();
  let readCount = 0;
  const store = {
    async getPaperTradingComparisonVerdict(id: string) {
      readCount += 1;
      return verdicts.get(id);
    },
    async listPaperTradingComparisonVerdicts(comparisonId?: string) {
      readCount += 1;
      return [...verdicts.values()].filter((verdict) => comparisonId === undefined ||
        verdict.paper_trading_comparison_commitment_ref.id === comparisonId);
    },
    async getPaperTradingComparisonCommitment(id: string) {
      readCount += 1;
      return id === sourceComparison.paper_trading_comparison_commitment_id
        ? sourceComparison
        : undefined;
    },
    async getPaperTradingComparisonPreparation(id: string) {
      readCount += 1;
      if (id === sourcePreparation.paper_trading_comparison_preparation_id) {
        return sourcePreparation;
      }
      return preparations.get(id);
    },
    async listPaperTradingComparisonConfirmationCampaigns() {
      readCount += 1;
      return campaigns;
    },
    async recordPaperTradingComparisonConfirmationCampaign(
      campaign: PaperTradingComparisonConfirmationCampaignRecord
    ) {
      campaigns.splice(0, campaigns.length, campaign);
      recordedCampaigns.push(structuredClone(campaign));
      return campaign;
    },
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      readCount += 1;
      return campaigns.find((campaign) =>
        campaign.paper_trading_comparison_confirmation_campaign_id === id);
    },
    async getPaperTradingComparisonConfirmationCampaignOutcome(id: string) {
      readCount += 1;
      return outcomes.find((outcome) =>
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id === id);
    },
    async recordPaperTradingComparisonConfirmationCampaignOutcome(
      outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
    ) {
      outcomes.splice(0, outcomes.length, outcome);
      recordedOutcomes.push(structuredClone(outcome));
      return outcome;
    }
  };
  const recordedCampaigns: PaperTradingComparisonConfirmationCampaignRecord[] = [];
  const recordedOutcomes: PaperTradingComparisonConfirmationCampaignOutcomeRecord[] = [];
  return {
    store: store as any,
    sourceVerdictId: sourceVerdict.paper_trading_comparison_verdict_id,
    recordedCampaigns,
    recordedOutcomes,
    get readCount() { return readCount; },
    setSlotVerdict(
      campaign: PaperTradingComparisonConfirmationCampaignRecord,
      slotIndex: number,
      outcome: "challenger_improved" | "challenger_not_improved"
    ) {
      const slot = campaign.slots[slotIndex - 1]!;
      const verdict = sourceVerdictFixture(outcome, {
        id: `slot-verdict-${slotIndex}`,
        comparisonId: slot.paper_trading_comparison_commitment_id,
        startedAt: `2026-07-12T0${3 + slotIndex}:00:00.000Z`,
        endedAt: `2026-07-12T0${3 + slotIndex}:30:00.000Z`,
        evaluatedAt: `2026-07-12T0${3 + slotIndex}:31:00.000Z`
      });
      verdicts.set(verdict.paper_trading_comparison_verdict_id, verdict);
      return verdict;
    },
    materializeSlot(
      campaign: PaperTradingComparisonConfirmationCampaignRecord,
      slotIndex: number
    ) {
      const slot = campaign.slots[slotIndex - 1]!;
      preparations.set(slot.paper_trading_comparison_preparation_id, {
        ...sourcePreparation,
        paper_trading_comparison_preparation_id:
          slot.paper_trading_comparison_preparation_id,
        paper_trading_comparison_commitment_id:
          slot.paper_trading_comparison_commitment_id
      });
    }
  };
}

function sourceVerdictFixture(
  outcome: "challenger_improved" | "challenger_not_improved",
  identity: {
    id?: string;
    comparisonId?: string;
    startedAt?: string;
    endedAt?: string;
    evaluatedAt?: string;
  } = {}
): PaperTradingComparisonVerdictRecord {
  const improved = outcome === "challenger_improved";
  const comparisonId = identity.comparisonId ?? "source-comparison-001";
  const qualification = {
    comparison_id: comparisonId,
    activation_id: "activation-001",
    activation_attempt_id: "activation-attempt-001",
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    checkpoint_count: 2,
    champion: sideQualification(),
    challenger: sideQualification(),
    authority_status: "not_verdict" as const
  };
  const side = (role: "champion" | "challenger") => ({
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_artifact_digest: `sha256:${role}-artifact`,
    trading_run_ref: { record_kind: "trading_run", id: `${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${role}-commitment`
    },
    paper_trading_evaluation_commitment_record_digest: `sha256:${role}-commitment`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:${role}-evaluation`,
    paper_trading_observation_chain_digest: `sha256:${role}-observations`,
    net_revenue_usdt: role === "challenger" && improved ? 1 : 0,
    cost_usdt: 0
  });
  return {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: identity.id ?? "source-verdict-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparisonId
    },
    paper_trading_comparison_commitment_digest: "sha256:source-comparison",
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
    latest_tick_ref: { record_kind: "paper_trading_comparison_tick", id: "tick-2" },
    latest_tick_digest: "sha256:tick-2",
    checkpoint_outcome_refs: [1, 2].map((sequence) => ({
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: `checkpoint-${sequence}`
    })),
    checkpoint_outcome_digests: ["sha256:checkpoint-1", "sha256:checkpoint-2"],
    pair_qualification: qualification,
    pair_qualification_digest: "sha256:qualification",
    champion: side("champion"),
    challenger: side("challenger"),
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: improved ? 1 : 0,
      observed_lift_usdt: improved ? 1 : 0,
      minimum_lift_usdt: 0.5
    },
    verdict_outcome: outcome,
    window_started_at: identity.startedAt ?? "2026-07-12T00:00:00.000Z",
    window_ended_at: identity.endedAt ?? "2026-07-12T01:00:00.000Z",
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: improved
      ? "requires_precommitted_campaign"
      : "not_applicable",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: improved
      ? "precommit_confirmation_campaign"
      : "return_to_candidate_arena",
    evaluated_at: identity.evaluatedAt ?? "2026-07-12T02:00:00.000Z",
    verdict_digest: `sha256:${identity.id ?? "source-verdict-001"}`,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function sourcePreparationFixture(): PaperTradingComparisonPreparationRecord {
  return {
    record_kind: "paper_trading_comparison_preparation",
    version: 1,
    paper_trading_comparison_preparation_id: "source-preparation-001",
    paper_trading_comparison_commitment_id: "source-comparison-001",
    champion: candidateSide("champion"),
    challenger: candidateSide("challenger"),
    champion_selection: { selection_kind: "bootstrap" },
    comparison_policy: comparisonPolicy(),
    market_data_configuration_digest: "sha256:market",
    paper_policy_identity: policyIdentity(),
    committed_at: "2026-07-11T23:00:00.000Z",
    preparation_digest: "sha256:source-preparation",
    authority_status: "not_live"
  };
}

function sourceComparisonFixture(preparation: PaperTradingComparisonPreparationRecord) {
  const side = (candidate: PaperTradingComparisonCandidateSide) => ({
    ...candidate,
    trading_run_ref: { record_kind: "trading_run", id: `${candidate.role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${candidate.role}-commitment`
    },
    paper_trading_evaluation_commitment_digest: `sha256:${candidate.role}-commitment`,
    paper_trading_evaluation_commitment_record_digest:
      `sha256:${candidate.role}-commitment-record`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${candidate.role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:${candidate.role}-evaluation`
  });
  return {
    record_kind: "paper_trading_comparison_commitment" as const,
    version: 1 as const,
    paper_trading_comparison_commitment_id:
      preparation.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: preparation.paper_trading_comparison_preparation_id
    },
    champion: side(preparation.champion),
    challenger: side(preparation.challenger),
    champion_selection: preparation.champion_selection,
    comparison_policy: preparation.comparison_policy,
    market_data_configuration_digest: preparation.market_data_configuration_digest,
    paper_policy_identity: preparation.paper_policy_identity,
    committed_at: preparation.committed_at,
    commitment_digest: "sha256:source-comparison",
    authority_status: "not_live" as const
  };
}

function candidateSide(role: "champion" | "challenger"): PaperTradingComparisonCandidateSide {
  return {
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    candidate_version_digest: `sha256:${role}-version`,
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_record_digest: `sha256:${role}-code-record`,
    system_code_artifact_digest: `sha256:${role}-artifact`,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `${role}-admission`
    },
    admission_decision_digest: `sha256:${role}-admission`
  };
}

function comparisonPolicy(): PaperTradingComparisonPolicy {
  return {
    policy_version: "paper-comparison-v1",
    comparison_mode: "bootstrap",
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

function policyIdentity() {
  return {
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
      first_observed_at: "2026-07-12T00:00:00.000Z",
      last_observed_at: "2026-07-12T01:00:00.000Z"
    }
  };
}

function campaignIdForSource(sourceVerdictId: string): string {
  return `paper-comparison-confirmation-campaign-${createHash("sha256")
    .update(sourceVerdictId)
    .digest("hex")
    .slice(0, 32)}`;
}
