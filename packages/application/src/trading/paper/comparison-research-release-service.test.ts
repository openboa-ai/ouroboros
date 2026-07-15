import { describe, expect, it } from "vitest";
import {
  paperTradingComparisonResearchReleaseHasRuntimeShape,
  type ArtifactLineageRecord,
  type CandidateAdmissionDecisionRecord,
  type CandidateVersionRecord,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonConfirmationSlotResultStatus,
  type PaperTradingComparisonResearchReleaseRecord,
  type ResearchFindingRecord,
  type SystemCodeRecord
} from "@ouroboros/domain";
import {
  PaperTradingComparisonResearchReleaseService,
  PaperTradingComparisonResearchReleaseServiceError
} from "./comparison-research-release-service";

describe("PaperTradingComparisonResearchReleaseService", () => {
  it.each([
    [["challenger_improved", "challenger_improved"],
      "confirmed_improvement", "positive_result"],
    [["challenger_improved", "challenger_not_improved"],
      "challenger_not_reproduced", "negative_result"],
    [["comparison_ineligible", "comparison_ineligible"],
      "comparison_evidence_ineligible", "failure_analysis"],
    [["slot_expired", "slot_expired"],
      "campaign_slot_expired", "failure_analysis"]
  ] as const)("builds exact %s release evidence", async (
    statuses,
    releaseKind,
    findingKind
  ) => {
    const harness = releaseHarness({ statuses: [...statuses] });
    const service = new PaperTradingComparisonResearchReleaseService({
      store: harness.store,
      now: () => "2026-07-12T08:00:00.000Z"
    });

    const release = await service.release({
      campaignOutcomeId:
        harness.outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    });

    expect(paperTradingComparisonResearchReleaseHasRuntimeShape(release)).toBe(true);
    expect(release).toMatchObject({
      paper_trading_comparison_research_release_id:
        `${harness.outcome.paper_trading_comparison_confirmation_campaign_outcome_id}` +
        "-research-release",
      release_kind: releaseKind,
      direction_kind: "mean_reversion",
      released_at: "2026-07-12T08:00:00.000Z",
      research_visibility: "released_to_research",
      promotion_authority: false,
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "lineage_only",
      finding: {
        finding_kind: findingKind,
        research_worker_ref: harness.sourceFinding.research_worker_ref,
        research_direction_ref: harness.sourceFinding.research_direction_ref,
        experiment_run_ref: harness.sourceFinding.experiment_run_ref,
        trading_evaluation_result_ref:
          harness.sourceFinding.trading_evaluation_result_ref
      },
      lineage: {
        parent_system_code_ref: harness.sourceLineage.parent_system_code_ref
      }
    });
    expect(release.finding.supporting_record_refs).toEqual([
      { record_kind: "research_finding", id: harness.sourceFinding.research_finding_id },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: harness.campaign.paper_trading_comparison_confirmation_campaign_id
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: harness.outcome.paper_trading_comparison_confirmation_campaign_outcome_id
      },
      ...harness.outcome.slot_results.flatMap((result) =>
        result.verdict_ref ? [{ ...result.verdict_ref }] : [])
    ]);
    expect(release.lineage.source_finding_refs).toEqual([
      ...harness.sourceLineage.source_finding_refs,
      { record_kind: "research_finding", id: release.finding.research_finding_id }
    ]);
    expect(harness.recordedReleases).toEqual([release]);
  });

  it("rejects invalid input before any Store read", async () => {
    const harness = releaseHarness();
    const service = new PaperTradingComparisonResearchReleaseService({
      store: harness.store
    });

    await expect(service.release({ campaignOutcomeId: " " })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_research_release_input"
    });
    expect(harness.readCount).toBe(0);
  });

  it("replays the exact release without a second write after clock advance", async () => {
    const harness = releaseHarness();
    let now = "2026-07-12T08:00:00.000Z";
    const service = new PaperTradingComparisonResearchReleaseService({
      store: harness.store,
      now: () => now
    });

    const first = await service.release({ campaignOutcomeId: harness.outcomeId });
    now = "2026-07-13T08:00:00.000Z";
    const replay = await service.release({ campaignOutcomeId: harness.outcomeId });

    expect(replay).toEqual(first);
    expect(harness.recordedReleases).toEqual([first]);
  });

  it.each([
    ["missing outcome", { omitOutcome: true }, "reference_not_found"],
    ["campaign mismatch", { campaignDigestDrift: true }, "graph_invalid"],
    ["missing admission", { omitAdmission: true }, "reference_not_found"],
    ["missing source Finding", { omitSourceFinding: true }, "reference_not_found"],
    ["ambiguous source Lineage", { ambiguousLineage: true }, "graph_invalid"],
    ["late source Lineage", { lateLineage: true }, "graph_invalid"],
    ["missing full-cycle direction", { omitDirection: true }, "graph_invalid"],
    ["SystemCode drift", { systemCodeDrift: true }, "graph_invalid"],
    ["changed Store replay", { recordDrift: true }, "persistence_conflict"]
  ] as const)("rejects %s", async (_label, options, suffix) => {
    const harness = releaseHarness(options);
    const service = new PaperTradingComparisonResearchReleaseService({
      store: harness.store,
      now: () => "2026-07-12T08:00:00.000Z"
    });

    await expect(service.release({ campaignOutcomeId: harness.outcomeId }))
      .rejects.toMatchObject({
        name: "PaperTradingComparisonResearchReleaseServiceError",
        code: `paper_trading_comparison_research_release_${suffix}`
      });
    expect(harness.recordedReleases).toEqual([]);
  });

  it("requires the release clock to follow the campaign outcome", async () => {
    const harness = releaseHarness();
    const service = new PaperTradingComparisonResearchReleaseService({
      store: harness.store,
      now: () => harness.outcome.evaluated_at
    });

    await expect(service.release({ campaignOutcomeId: harness.outcomeId }))
      .rejects.toMatchObject({
        code: "invalid_paper_trading_comparison_research_release_input"
      });
  });

  it("exposes stable service error identity", () => {
    expect(new PaperTradingComparisonResearchReleaseServiceError(
      "paper_trading_comparison_research_release_graph_invalid",
      "invalid graph"
    )).toMatchObject({
      name: "PaperTradingComparisonResearchReleaseServiceError",
      code: "paper_trading_comparison_research_release_graph_invalid"
    });
  });
});

type HarnessOptions = {
  statuses?: PaperTradingComparisonConfirmationSlotResultStatus[];
  omitOutcome?: boolean;
  campaignDigestDrift?: boolean;
  omitAdmission?: boolean;
  omitSourceFinding?: boolean;
  ambiguousLineage?: boolean;
  lateLineage?: boolean;
  omitDirection?: boolean;
  systemCodeDrift?: boolean;
  recordDrift?: boolean;
};

function releaseHarness(options: HarnessOptions = {}) {
  const campaign = campaignFixture();
  const outcome = outcomeFixture(
    campaign,
    options.statuses ?? ["challenger_improved", "challenger_improved"]
  );
  if (options.campaignDigestDrift) campaign.campaign_digest = "sha256:drift";
  const admission = admissionFixture(campaign);
  const sourceFinding = sourceFindingFixture(admission);
  const sourceLineage = sourceLineageFixture(admission, sourceFinding);
  if (options.lateLineage) {
    sourceLineage.created_at = "2026-07-12T07:00:00.000Z";
  }
  const candidate = {
    candidate_id: campaign.challenger.candidate_ref.id,
    candidate_version: {
      candidate_version_id: campaign.challenger.candidate_version_ref.id
    },
    system_code: { ref: { ...campaign.challenger.system_code_ref } },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "parent-candidate",
        candidate_version_id: "parent-version",
        system_code_ref: { ...admission.source_system_code_ref }
      },
      generated: {
        system_code_ref: { ...campaign.challenger.system_code_ref },
        artifact_digest: campaign.challenger.system_code_artifact_digest,
        generated_by_agent: true
      },
      materialized: {
        trading_system_id: campaign.challenger.candidate_ref.id,
        candidate_version_id: campaign.challenger.candidate_version_ref.id,
        system_code_ref: { ...campaign.challenger.system_code_ref }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        ...(!options.omitDirection ? { direction_kind: "mean_reversion" } : {}),
        trading_run_id: "research-run",
        gateway_result_outcome: "accepted",
        ledger_chain_complete: true
      }
    }
  };
  const candidateVersion = {
    candidate_version_id: campaign.challenger.candidate_version_ref.id,
    system_code_ref: { ...campaign.challenger.system_code_ref }
  } as CandidateVersionRecord;
  const systemCode = {
    system_code_id: campaign.challenger.system_code_ref.id,
    artifact_digest: options.systemCodeDrift
      ? "sha256:drift"
      : campaign.challenger.system_code_artifact_digest
  } as SystemCodeRecord;
  const lineages = [sourceLineage];
  if (options.ambiguousLineage) {
    lineages.push({
      ...structuredClone(sourceLineage),
      artifact_lineage_id: "source-lineage-duplicate"
    });
  }
  const recordedReleases: PaperTradingComparisonResearchReleaseRecord[] = [];
  let persistedRelease: PaperTradingComparisonResearchReleaseRecord | undefined;
  let readCount = 0;
  const store = {
    async getPaperTradingComparisonResearchRelease(id: string) {
      readCount += 1;
      return persistedRelease?.paper_trading_comparison_research_release_id === id
        ? structuredClone(persistedRelease)
        : undefined;
    },
    async getPaperTradingComparisonConfirmationCampaignOutcome(id: string) {
      readCount += 1;
      return !options.omitOutcome && id === outcome.paper_trading_comparison_confirmation_campaign_outcome_id
        ? structuredClone(outcome)
        : undefined;
    },
    async getPaperTradingComparisonConfirmationCampaign(id: string) {
      readCount += 1;
      return id === campaign.paper_trading_comparison_confirmation_campaign_id
        ? structuredClone(campaign)
        : undefined;
    },
    async getCandidateAdmissionDecision(id: string) {
      readCount += 1;
      return !options.omitAdmission && id === admission.candidate_admission_decision_id
        ? structuredClone(admission)
        : undefined;
    },
    async listResearchFindings() {
      readCount += 1;
      return options.omitSourceFinding ? [] : [structuredClone(sourceFinding)];
    },
    async listArtifactLineages() {
      readCount += 1;
      return structuredClone(lineages);
    },
    async getCandidate(id: string) {
      readCount += 1;
      return id === candidate.candidate_id ? structuredClone(candidate) : undefined;
    },
    async getCandidateVersion(id: string) {
      readCount += 1;
      return id === candidateVersion.candidate_version_id
        ? structuredClone(candidateVersion)
        : undefined;
    },
    async getSystemCode(id: string) {
      readCount += 1;
      return id === systemCode.system_code_id ? structuredClone(systemCode) : undefined;
    },
    async recordPaperTradingComparisonResearchRelease(
      release: PaperTradingComparisonResearchReleaseRecord
    ) {
      const returned = options.recordDrift
        ? { ...release, next_research_focus: `${release.next_research_focus} drift` }
        : release;
      if (!options.recordDrift) {
        persistedRelease = structuredClone(release);
        recordedReleases.push(structuredClone(release));
      }
      return structuredClone(returned);
    }
  };
  return {
    store: store as any,
    campaign,
    outcome,
    outcomeId: outcome.paper_trading_comparison_confirmation_campaign_outcome_id,
    admission,
    sourceFinding,
    sourceLineage,
    recordedReleases,
    get readCount() { return readCount; }
  };
}

function campaignFixture(): PaperTradingComparisonConfirmationCampaignRecord {
  const side = (role: "champion" | "challenger") => ({
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: `${role}-candidate`
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: `${role}-version`
    },
    candidate_version_digest: `sha256:${role}-version`,
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_record_digest: `sha256:${role}-code-record`,
    system_code_artifact_digest: `sha256:${role}-artifact`,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `${role}-admission`
    },
    admission_decision_digest: `sha256:${role}-admission`
  } as const);
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: "campaign-001",
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict"
    },
    source_verdict_digest: "sha256:source-verdict",
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "source-comparison"
    },
    source_comparison_digest: "sha256:source-comparison",
    champion: side("champion"),
    challenger: side("challenger"),
    champion_selection: { selection_kind: "bootstrap" },
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "bootstrap",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 1,
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
    },
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
      maximum_slot_start_delay_ms: 600_000,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [1, 2].map((slotIndex) => ({
      slot_index: slotIndex,
      comparison_idempotency_key:
        `paper-comparison-confirmation:campaign-001:slot:${slotIndex}`,
      paper_trading_comparison_preparation_id:
        `paper-trading-comparison-preparation-${slotIndex === 1
          ? "1111111111111111" : "2222222222222222"}`,
      paper_trading_comparison_commitment_id:
        `paper-trading-comparison-${slotIndex === 1
          ? "1111111111111111" : "2222222222222222"}`
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
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  statuses: PaperTradingComparisonConfirmationSlotResultStatus[]
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const counts = {
    improved_count: statuses.filter((status) => status === "challenger_improved").length,
    not_improved_count: statuses.filter((status) =>
      status === "challenger_not_improved").length,
    ineligible_count: statuses.filter((status) =>
      status === "comparison_ineligible").length,
    expired_count: statuses.filter((status) => status === "slot_expired").length
  };
  const confirmed = counts.improved_count === statuses.length;
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    version: 1,
    paper_trading_comparison_confirmation_campaign_outcome_id: "campaign-001-outcome",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    slot_results: statuses.map((status, index) => ({
      slot_index: index + 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: campaign.slots[index]!.paper_trading_comparison_commitment_id
      },
      status,
      ...(status !== "slot_expired" ? {
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: `slot-verdict-${index + 1}`
        },
        verdict_digest: `sha256:slot-verdict-${index + 1}`,
        window_started_at: `2026-07-12T0${4 + index}:00:00.000Z`,
        window_ended_at: `2026-07-12T0${4 + index}:30:00.000Z`
      } : {})
    })),
    ...counts,
    campaign_outcome: confirmed ? "confirmed_improvement" : "not_confirmed",
    decision_rule: "all_reserved_windows_must_improve",
    promotion_eligibility: confirmed ? "eligible" : "not_eligible",
    release_status: "sealed",
    next_action: confirmed
      ? "review_for_trading_promotion"
      : "return_to_candidate_arena",
    evaluated_at: "2026-07-12T07:00:00.000Z",
    outcome_digest: "sha256:outcome",
    evaluation_authority: "external_to_trading_systems",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
}

function admissionFixture(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): CandidateAdmissionDecisionRecord {
  return {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id:
      campaign.challenger.candidate_admission_decision_ref.id,
    source_system_code_ref: { record_kind: "system_code", id: "parent-code" },
    system_code_ref: { ...campaign.challenger.system_code_ref },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-001" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation-001"
    },
    research_finding_ref: { record_kind: "research_finding", id: "source-finding" },
    source_artifact_digest: "sha256:parent",
    submitted_artifact_digest: campaign.challenger.system_code_artifact_digest,
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    decided_at: "2026-07-12T02:00:00.000Z",
    authority_status: "not_live"
  };
}

function sourceFindingFixture(
  admission: CandidateAdmissionDecisionRecord
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: admission.research_finding_ref.id,
    research_worker_ref: { record_kind: "research_worker", id: "worker-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "direction-001"
    },
    experiment_run_ref: { ...admission.experiment_run_ref },
    trading_evaluation_result_ref: { ...admission.trading_evaluation_result_ref },
    finding_kind: "positive_result",
    summary: "Origin candidate finding.",
    supporting_record_refs: [{ ...admission.trading_evaluation_result_ref }],
    created_at: "2026-07-12T01:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function sourceLineageFixture(
  admission: CandidateAdmissionDecisionRecord,
  finding: ResearchFindingRecord
): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "source-lineage",
    child_system_code_ref: { ...admission.system_code_ref },
    parent_system_code_ref: { ...admission.source_system_code_ref },
    source_finding_refs: [
      { record_kind: "research_finding", id: finding.research_finding_id }
    ],
    created_by_research_worker_ref: { ...finding.research_worker_ref },
    created_at: "2026-07-12T01:30:00.000Z",
    authority_status: "lineage_only"
  };
}
