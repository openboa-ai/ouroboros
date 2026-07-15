import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonPreparationDigestInput,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingComparisonVerdictRecord
} from "@ouroboros/domain";
import { paperTradingComparisonIdsForIdempotencyKey } from "./comparison-identity";
import { PaperTradingComparisonConfirmationWindowService } from
  "./comparison-confirmation-window-service";

describe("PaperTradingComparisonConfirmationWindowService", () => {
  it("materializes only slot 1 with the exact frozen coordinator input", async () => {
    const harness = windowHarness();
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => "2026-07-12T03:01:00.000Z"
    });

    const graph = await service.prepareNext({ campaignId: harness.campaignId });

    expect(graph).toEqual(harness.graphFor(1));
    expect(harness.inputs).toEqual([harness.expectedInput(1)]);
    expect(harness.inputs[0]?.idempotencyKey).toBe(
      harness.campaign.slots[0]!.comparison_idempotency_key
    );
  });

  it("accepts a commitment created after the preparation effect starts", async () => {
    const harness = windowHarness();
    const times = [
      "2026-07-12T03:00:59.999Z",
      "2026-07-12T03:01:00.000Z"
    ];
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => times.shift() ?? "2026-07-12T03:01:00.000Z"
    });

    await expect(service.prepareNext({ campaignId: harness.campaignId }))
      .resolves.toEqual(harness.graphFor(1));
  });

  it("exactly replays the current materialized slot without advancing", async () => {
    const harness = windowHarness();
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => "2026-07-12T03:01:00.000Z"
    });

    const first = await service.prepareNext({ campaignId: harness.campaignId });
    const replay = await service.prepareNext({ campaignId: harness.campaignId });

    expect(replay).toEqual(first);
    expect(harness.inputs).toEqual([
      harness.expectedInput(1),
      harness.expectedInput(1)
    ]);
  });

  it("advances to slot 2 only after the exact slot-1 verdict", async () => {
    const harness = windowHarness();
    let now = "2026-07-12T03:01:00.000Z";
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => now
    });
    await service.prepareNext({ campaignId: harness.campaignId });
    harness.setVerdict(1);
    now = "2026-07-12T04:32:00.000Z";

    const graph = await service.prepareNext({ campaignId: harness.campaignId });

    expect(graph).toEqual(harness.graphFor(2));
    expect(harness.inputs.at(-1)).toEqual(harness.expectedInput(2));
  });

  it("rejects a future slot that appears before its predecessor verdict", async () => {
    const harness = windowHarness();
    harness.materialize(2);
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => "2026-07-12T03:01:00.000Z"
    });

    await expect(service.prepareNext({ campaignId: harness.campaignId }))
      .rejects.toMatchObject({
        code: "paper_trading_comparison_confirmation_campaign_graph_invalid"
      });
    expect(harness.inputs).toEqual([]);
  });

  it("rejects invalid input, a terminal campaign, and an expired unprepared slot", async () => {
    const invalid = windowHarness();
    const invalidService = new PaperTradingComparisonConfirmationWindowService({
      store: invalid.store,
      comparisons: invalid.comparisons
    });
    await expect(invalidService.prepareNext({ campaignId: " " }))
      .rejects.toMatchObject({
        code: "invalid_paper_trading_comparison_confirmation_campaign_input"
      });
    expect(invalid.readCount).toBe(0);

    const terminal = windowHarness({ terminal: true });
    const terminalService = new PaperTradingComparisonConfirmationWindowService({
      store: terminal.store,
      comparisons: terminal.comparisons,
      now: () => "2026-07-12T03:01:00.000Z"
    });
    await expect(terminalService.prepareNext({ campaignId: terminal.campaignId }))
      .rejects.toMatchObject({
        code: "paper_trading_comparison_confirmation_campaign_not_terminal"
      });

    const expired = windowHarness();
    const expiredService = new PaperTradingComparisonConfirmationWindowService({
      store: expired.store,
      comparisons: expired.comparisons,
      now: () => "2026-07-12T03:10:00.001Z"
    });
    await expect(expiredService.prepareNext({ campaignId: expired.campaignId }))
      .rejects.toMatchObject({
        code: "paper_trading_comparison_confirmation_campaign_not_terminal"
      });
    expect(expired.inputs).toEqual([]);

    const partial = windowHarness();
    partial.prepareOnly(1);
    const partialService = new PaperTradingComparisonConfirmationWindowService({
      store: partial.store,
      comparisons: partial.comparisons,
      now: () => "2026-07-12T03:10:00.001Z"
    });
    await expect(partialService.prepareNext({ campaignId: partial.campaignId }))
      .rejects.toMatchObject({
        code: "paper_trading_comparison_confirmation_campaign_not_terminal"
      });
    expect(partial.inputs).toEqual([]);
  });

  it("rejects a coordinator graph whose frozen slot identity drifts", async () => {
    const harness = windowHarness({ driftGraph: true });
    const service = new PaperTradingComparisonConfirmationWindowService({
      store: harness.store,
      comparisons: harness.comparisons,
      now: () => "2026-07-12T03:01:00.000Z"
    });

    await expect(service.prepareNext({ campaignId: harness.campaignId }))
      .rejects.toMatchObject({
        code: "paper_trading_comparison_confirmation_campaign_graph_invalid"
      });
  });
});

function windowHarness(options: {
  terminal?: boolean;
  driftGraph?: boolean;
} = {}) {
  const campaign = campaignFixture();
  const preparations = new Map<string, PaperTradingComparisonPreparationRecord>();
  const commitments = new Map<string, ReturnType<typeof graphFor>["commitment"]>();
  const verdicts = new Map<string, PaperTradingComparisonVerdictRecord>();
  const inputs: any[] = [];
  let readCount = 0;
  const graphForSlot = (slotIndex: number) => graphFor(campaign, slotIndex);
  const materialize = (slotIndex: number) => {
    const graph = graphForSlot(slotIndex);
    preparations.set(
      graph.preparation.paper_trading_comparison_preparation_id,
      graph.preparation
    );
    commitments.set(
      graph.commitment.paper_trading_comparison_commitment_id,
      graph.commitment
    );
    return graph;
  };
  const store = {
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      readCount += 1;
      return id === campaign.paper_trading_comparison_confirmation_campaign_id
        ? campaign
        : undefined;
    },
    async getPaperTradingComparisonConfirmationCampaignOutcome() {
      readCount += 1;
      return options.terminal ? { record_kind: "terminal" } : undefined;
    },
    async getPaperTradingComparisonPreparation(id: string) {
      readCount += 1;
      return preparations.get(id);
    },
    async getPaperTradingComparisonCommitment(id: string) {
      readCount += 1;
      return commitments.get(id);
    },
    async listPaperTradingComparisonVerdicts(comparisonId: string) {
      readCount += 1;
      const verdict = verdicts.get(comparisonId);
      return verdict ? [verdict] : [];
    }
  };
  const comparisons = {
    async prepare(input: any) {
      inputs.push(structuredClone(input));
      const slotIndex = campaign.slots.findIndex((slot) =>
        slot.comparison_idempotency_key === input.idempotencyKey) + 1;
      const graph = materialize(slotIndex);
      return options.driftGraph
        ? {
            ...graph,
            preparation: {
              ...graph.preparation,
              market_data_configuration_digest: "sha256:drifted-market"
            }
          }
        : graph;
    }
  };
  return {
    store: store as any,
    comparisons: comparisons as any,
    campaign,
    campaignId: campaign.paper_trading_comparison_confirmation_campaign_id,
    inputs,
    get readCount() { return readCount; },
    graphFor: graphForSlot,
    materialize,
    prepareOnly(slotIndex: number) {
      const graph = graphForSlot(slotIndex);
      preparations.set(
        graph.preparation.paper_trading_comparison_preparation_id,
        graph.preparation
      );
    },
    expectedInput(slotIndex: number) {
      return expectedInput(campaign, slotIndex);
    },
    setVerdict(slotIndex: number) {
      const slot = campaign.slots[slotIndex - 1]!;
      verdicts.set(
        slot.paper_trading_comparison_commitment_id,
        slotVerdict(slot.paper_trading_comparison_commitment_id, slotIndex)
      );
    }
  };
}

function campaignFixture(): PaperTradingComparisonConfirmationCampaignRecord {
  const campaignId = "confirmation-campaign-window-001";
  const policy = comparisonPolicy();
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: campaignId,
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
    champion_selection: { selection_kind: "bootstrap" },
    comparison_policy: policy,
    market_data_configuration_digest: "sha256:market",
    paper_policy_identity: policyIdentity(),
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 2,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms: policy.maximum_elapsed_ms,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [1, 2].map((slotIndex) => {
      const key = `paper-comparison-confirmation:${campaignId}:slot:${slotIndex}`;
      const ids = paperTradingComparisonIdsForIdempotencyKey(key);
      return {
        slot_index: slotIndex,
        comparison_idempotency_key: key,
        paper_trading_comparison_preparation_id: ids.preparation_id,
        paper_trading_comparison_commitment_id: ids.comparison_commitment_id
      };
    }),
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

function expectedInput(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number
) {
  const slot = campaign.slots[slotIndex - 1]!;
  return {
    idempotencyKey: slot.comparison_idempotency_key,
    champion: {
      candidateId: campaign.champion.candidate_ref.id,
      candidateVersionId: campaign.champion.candidate_version_ref.id,
      admissionDecisionId: campaign.champion.candidate_admission_decision_ref.id
    },
    challenger: {
      candidateId: campaign.challenger.candidate_ref.id,
      candidateVersionId: campaign.challenger.candidate_version_ref.id,
      admissionDecisionId: campaign.challenger.candidate_admission_decision_ref.id
    },
    comparisonPolicy: campaign.comparison_policy,
    marketDataConfigurationDigest: campaign.market_data_configuration_digest,
    paperPolicyIdentity: campaign.paper_policy_identity
  };
}

function graphFor(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number
) {
  const slot = campaign.slots[slotIndex - 1]!;
  const withoutPreparationDigest = {
    record_kind: "paper_trading_comparison_preparation" as const,
    version: 1 as const,
    paper_trading_comparison_preparation_id:
      slot.paper_trading_comparison_preparation_id,
    paper_trading_comparison_commitment_id:
      slot.paper_trading_comparison_commitment_id,
    champion: structuredClone(campaign.champion),
    challenger: structuredClone(campaign.challenger),
    champion_selection: structuredClone(campaign.champion_selection),
    comparison_policy: structuredClone(campaign.comparison_policy),
    market_data_configuration_digest: campaign.market_data_configuration_digest,
    paper_policy_identity: structuredClone(campaign.paper_policy_identity),
    committed_at: slotIndex === 1
      ? "2026-07-12T03:01:00.000Z"
      : "2026-07-12T04:32:00.000Z",
    preparation_digest: "",
    authority_status: "not_live" as const
  };
  const preparation = {
    ...withoutPreparationDigest,
    preparation_digest: digest(
      paperTradingComparisonPreparationDigestInput(withoutPreparationDigest)
    )
  };
  const comparisonSide = (side: PaperTradingComparisonCandidateSide) => ({
    ...side,
    trading_run_ref: { record_kind: "trading_run", id: `${slotIndex}-${side.role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${slotIndex}-${side.role}-commitment`
    },
    paper_trading_evaluation_commitment_digest: `sha256:${side.role}-commitment`,
    paper_trading_evaluation_commitment_record_digest:
      `sha256:${side.role}-commitment-record`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${slotIndex}-${side.role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:${side.role}-evaluation`
  });
  const withoutCommitmentDigest = {
    record_kind: "paper_trading_comparison_commitment" as const,
    version: 1 as const,
    paper_trading_comparison_commitment_id:
      slot.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: slot.paper_trading_comparison_preparation_id
    },
    champion: comparisonSide(campaign.champion),
    challenger: comparisonSide(campaign.challenger),
    champion_selection: structuredClone(campaign.champion_selection),
    comparison_policy: structuredClone(campaign.comparison_policy),
    market_data_configuration_digest: campaign.market_data_configuration_digest,
    paper_policy_identity: structuredClone(campaign.paper_policy_identity),
    committed_at: preparation.committed_at,
    commitment_digest: "",
    authority_status: "not_live" as const
  };
  const commitment = {
    ...withoutCommitmentDigest,
    commitment_digest: digest(
      paperTradingComparisonCommitmentDigestInput(withoutCommitmentDigest)
    )
  };
  return {
    preparation,
    commitment,
    champion: { side: commitment.champion },
    challenger: { side: commitment.challenger },
    verification: {
      status: "verified" as const,
      activation_authority: "not_granted" as const
    }
  } as any;
}

function slotVerdict(
  comparisonId: string,
  slotIndex: number
): PaperTradingComparisonVerdictRecord {
  return {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: `slot-verdict-${slotIndex}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparisonId
    },
    paper_trading_comparison_commitment_digest: `sha256:comparison-${slotIndex}`,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: `activation-${slotIndex}`
    },
    paper_trading_comparison_activation_digest: `sha256:activation-${slotIndex}`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: `attempt-${slotIndex}`
    },
    paper_trading_comparison_activation_attempt_digest: `sha256:attempt-${slotIndex}`,
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: `outcome-${slotIndex}`
    },
    final_activation_outcome_digest: `sha256:outcome-${slotIndex}`,
    latest_tick_ref: { record_kind: "paper_trading_comparison_tick", id: `tick-${slotIndex}` },
    latest_tick_digest: `sha256:tick-${slotIndex}`,
    checkpoint_outcome_refs: [{
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: `checkpoint-${slotIndex}`
    }],
    checkpoint_outcome_digests: [`sha256:checkpoint-${slotIndex}`],
    pair_qualification: {
      comparison_id: comparisonId,
      activation_id: `activation-${slotIndex}`,
      activation_attempt_id: `attempt-${slotIndex}`,
      qualification_status: "qualified",
      qualification_reasons: [],
      checkpoint_count: 1,
      champion: sideQualification(),
      challenger: sideQualification(),
      authority_status: "not_verdict"
    },
    pair_qualification_digest: `sha256:qualification-${slotIndex}`,
    champion: verdictSide("champion"),
    challenger: { ...verdictSide("challenger"), net_revenue_usdt: 1 },
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: 1,
      observed_lift_usdt: 1,
      minimum_lift_usdt: 0.5
    },
    verdict_outcome: "challenger_improved",
    window_started_at: `2026-07-12T0${3 + slotIndex}:00:00.000Z`,
    window_ended_at: `2026-07-12T0${3 + slotIndex}:30:00.000Z`,
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: "requires_precommitted_campaign",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: "precommit_confirmation_campaign",
    evaluated_at: `2026-07-12T0${3 + slotIndex}:31:00.000Z`,
    verdict_digest: `sha256:slot-verdict-${slotIndex}`,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function verdictSide(role: "champion" | "challenger") {
  return {
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
    net_revenue_usdt: 0,
    cost_usdt: 0
  };
}

function sideQualification() {
  return {
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    evidence_window: {
      observation_count: 1,
      elapsed_ms: 60_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T04:00:00.000Z",
      last_observed_at: "2026-07-12T04:30:00.000Z"
    }
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
    minimum_observation_count: 1,
    minimum_elapsed_ms: 60_000,
    maximum_observation_count: 1,
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

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
