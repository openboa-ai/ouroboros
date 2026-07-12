import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignArmIntentDigestInput,
  researchControlCampaignReportDigestInput,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import {
  decideResearchControlCampaign,
  decideResearchControlCampaignArmIntent
} from "@ouroboros/application/candidate/research-control-campaign";
import { LocalStore, LocalStoreError } from "../src/index";

describe("LocalStore ResearchControlCampaign", () => {
  let root: string;
  let store: LocalStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-control-campaign-"));
    store = new LocalStore(root);
    await store.initialize();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("appends and reloads an exact campaign", async () => {
    const campaign = campaignFixture();

    expect(await store.recordResearchControlCampaign(campaign)).toEqual(campaign);
    expect(await store.getResearchControlCampaign(
      campaign.research_control_campaign_id
    )).toEqual(campaign);
    expect(await store.listResearchControlCampaigns()).toEqual([campaign]);
    expect(await store.recordResearchControlCampaign(campaign)).toEqual(campaign);
  });

  it("rejects a campaign digest mismatch and append conflict", async () => {
    const campaign = campaignFixture();
    const digestMismatch = structuredClone(campaign);
    digestMismatch.campaign_digest = digest("9");

    await expect(store.recordResearchControlCampaign(digestMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_digest_mismatch"
      });

    await store.recordResearchControlCampaign(campaign);
    const conflict = campaignFixture({ baselineDigest: digest("8") });
    await expect(store.recordResearchControlCampaign(conflict))
      .rejects.toMatchObject({ code: "research_control_campaign_conflict" });
  });

  it("detects corrupt campaign content on reload", async () => {
    const campaign = campaignFixture();
    await store.recordResearchControlCampaign(campaign);
    const file = path.join(
      root,
      "research-control-campaigns/items",
      `${campaign.research_control_campaign_id}.json`
    );
    const persisted = JSON.parse(await readFile(file, "utf8"));
    persisted.policy.tick_count_per_arm = 2;
    await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

    await expect(store.getResearchControlCampaign(
      campaign.research_control_campaign_id
    )).rejects.toMatchObject({
      code: "research_control_campaign_reload_failed"
    });
  });

  it("requires an exact campaign before appending an arm intent", async () => {
    const campaign = campaignFixture();
    const intent = armIntentFixture(campaign, "adaptive_treatment");

    await expect(store.recordResearchControlCampaignArmIntent(intent))
      .rejects.toMatchObject({
        code: "research_control_campaign_arm_intent_reference_not_found"
      });

    await store.recordResearchControlCampaign(campaign);
    expect(await store.recordResearchControlCampaignArmIntent(intent)).toEqual(
      intent
    );
    expect(await store.getResearchControlCampaignArmIntent(
      intent.research_control_campaign_arm_intent_id
    )).toEqual(intent);
    expect(await store.listResearchControlCampaignArmIntents()).toEqual([intent]);
  });

  it("rejects arm intent graph mismatch, digest mismatch, and conflict", async () => {
    const campaign = campaignFixture();
    await store.recordResearchControlCampaign(campaign);
    const intent = armIntentFixture(campaign, "adaptive_treatment");

    const digestMismatch = structuredClone(intent);
    digestMismatch.intent_digest = digest("9");
    await expect(store.recordResearchControlCampaignArmIntent(digestMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_arm_intent_digest_mismatch"
      });

    const graphMismatch = finalizeIntent({
      ...intent,
      baseline_snapshot_digest: digest("8")
    });
    await expect(store.recordResearchControlCampaignArmIntent(graphMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_arm_intent_reference_mismatch"
      });

    await store.recordResearchControlCampaignArmIntent(intent);
    const conflict = finalizeIntent({
      ...intent,
      committed_at: "2026-07-12T10:00:02.000Z"
    });
    await expect(store.recordResearchControlCampaignArmIntent(conflict))
      .rejects.toMatchObject({
        code: "research_control_campaign_arm_intent_conflict"
      });
  });

  it("requires both exact coordinator arm intents before appending a report", async () => {
    const campaign = campaignFixture();
    const adaptive = armIntentFixture(campaign, "adaptive_treatment");
    const control = armIntentFixture(campaign, "static_control");
    const report = reportFixture(campaign, adaptive, control);
    await store.recordResearchControlCampaign(campaign);

    await expect(store.recordResearchControlCampaignReport(report))
      .rejects.toMatchObject({
        code: "research_control_campaign_report_reference_not_found"
      });

    await store.recordResearchControlCampaignArmIntent(adaptive);
    await store.recordResearchControlCampaignArmIntent(control);
    expect(await store.recordResearchControlCampaignReport(report)).toEqual(report);
    expect(await store.getResearchControlCampaignReport(
      report.research_control_campaign_report_id
    )).toEqual(report);
    expect(await store.listResearchControlCampaignReports()).toEqual([report]);
  });

  it("rejects report graph mismatch, digest mismatch, and append conflict", async () => {
    const campaign = campaignFixture();
    const adaptive = armIntentFixture(campaign, "adaptive_treatment");
    const control = armIntentFixture(campaign, "static_control");
    await store.recordResearchControlCampaign(campaign);
    await store.recordResearchControlCampaignArmIntent(adaptive);
    await store.recordResearchControlCampaignArmIntent(control);
    const report = reportFixture(campaign, adaptive, control);

    const digestMismatch = structuredClone(report);
    digestMismatch.report_digest = digest("9");
    await expect(store.recordResearchControlCampaignReport(digestMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_report_digest_mismatch"
      });

    const graphMismatch = finalizeReport({
      ...report,
      arms: [
        { ...report.arms[0], arm_intent_digest: digest("8") },
        report.arms[1]
      ]
    });
    await expect(store.recordResearchControlCampaignReport(graphMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_report_reference_mismatch"
      });

    await store.recordResearchControlCampaignReport(report);
    const conflict = finalizeReport({
      ...report,
      completed_at: "2026-07-12T10:31:00.000Z"
    });
    await expect(store.recordResearchControlCampaignReport(conflict))
      .rejects.toMatchObject({
        code: "research_control_campaign_report_conflict"
      });
  });

  it("detects corrupt report content on reload", async () => {
    const campaign = campaignFixture();
    const adaptive = armIntentFixture(campaign, "adaptive_treatment");
    const control = armIntentFixture(campaign, "static_control");
    const report = reportFixture(campaign, adaptive, control);
    await store.recordResearchControlCampaign(campaign);
    await store.recordResearchControlCampaignArmIntent(adaptive);
    await store.recordResearchControlCampaignArmIntent(control);
    await store.recordResearchControlCampaignReport(report);
    const file = path.join(
      root,
      "research-control-campaign-reports/items",
      `${report.research_control_campaign_report_id}.json`
    );
    const persisted = JSON.parse(await readFile(file, "utf8"));
    persisted.primary_outcome_status = "adaptive_improved";
    await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

    await expect(store.getResearchControlCampaignReport(
      report.research_control_campaign_report_id
    )).rejects.toBeInstanceOf(LocalStoreError);
    await expect(store.getResearchControlCampaignReport(
      report.research_control_campaign_report_id
    )).rejects.toMatchObject({
      code: "research_control_campaign_report_reload_failed"
    });
  });
});

function campaignFixture(input: { baselineDigest?: string } = {}) {
  return decideResearchControlCampaign({
    idempotencyKey: "allocation-ablation-store-001",
    baseline: {
      protocol_version: "local_store_regular_files_v1",
      snapshot_digest: input.baselineDigest ?? digest("1"),
      regular_file_count: 40,
      total_bytes: 40_000,
      exclusion_policy: "research_control_campaign_evidence_only"
    },
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: "candidate-fixture"
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: "candidate-version-fixture"
      },
      system_code_ref: { record_kind: "system_code", id: "system-code-fixture" },
      system_code_artifact_digest: "sha256:fixture-system-code-v1",
      system_code_record_digest: digest("2"),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: digest("3")
    },
    researchAgent: {
      id: "fixture",
      provider: "fixture",
      model: "scripted-fixture",
      permission_policy: "fixture_only"
    },
    tickCountPerArm: 1,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function armIntentFixture(
  campaign: ResearchControlCampaignRecord,
  armKind: "adaptive_treatment" | "static_control"
) {
  return decideResearchControlCampaignArmIntent({
    campaign,
    armKind,
    committedAt: "2026-07-12T10:00:01.000Z"
  });
}

function reportFixture(
  campaign: ResearchControlCampaignRecord,
  adaptive: ResearchControlCampaignArmIntentRecord,
  control: ResearchControlCampaignArmIntentRecord
): ResearchControlCampaignReportRecord {
  return finalizeReport({
    record_kind: "research_control_campaign_report",
    version: 1,
    research_control_campaign_report_id: "research-control-campaign-report-store-001",
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: campaign.research_control_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    arms: [
      reportArm(adaptive, "adaptive_treatment", "adaptive_default", "3"),
      reportArm(control, "static_control", "static_control", "4")
    ],
    primary_outcome_status: "unadjudicated",
    causal_conclusion: "not_available_from_research_phase",
    next_action: "schedule_prospective_paper_slots",
    completed_at: "2026-07-12T10:30:01.000Z",
    report_digest: digest("0"),
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  });
}

function reportArm(
  intent: ResearchControlCampaignArmIntentRecord,
  armKind: "adaptive_treatment" | "static_control",
  allocationMode: "adaptive_default" | "static_control",
  digestCharacter: string
): ResearchControlCampaignReportRecord["arms"][number] {
  const tickId = intent.tick_ids[0]!;
  const tickRef = {
    record_kind: "candidate_arena_tick",
    id: `candidate-arena-tick-${tickId}`
  };
  return {
    arm_kind: armKind,
    allocation_mode: allocationMode,
    arm_intent_ref: {
      record_kind: "research_control_campaign_arm_intent",
      id: intent.research_control_campaign_arm_intent_id
    },
    arm_intent_digest: intent.intent_digest,
    tick_refs: [tickRef],
    allocation_refs: [{
      record_kind: "candidate_arena_research_allocation",
      id: `candidate-arena-research-allocation-${tickId}`
    }],
    diagnostics: {
      attempt_count: 3,
      admitted_candidate_count: 0,
      duplicate_count: 0,
      quarantined_count: 0,
      failed_count: 3,
      provider_request_total: 0,
      runner_command_total: 0,
      scenario_count: 0,
      elapsed_ms: 0
    },
    population_diversity: emptyBehaviorDiversity(tickId),
    paper_candidate_slots: [{
      sequence: 1,
      tick_ref: tickRef,
      status: "no_admitted_candidate"
    }],
    final_store_snapshot_digest: digest(digestCharacter),
    completed_at: "2026-07-12T10:30:00.000Z",
    research_diagnostics_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function emptyBehaviorDiversity(tickId: string): ResearchPopulationDiversityReadModel {
  const assigned = {
    measurement_status: "measured" as const,
    sample_count: 3,
    unique_count: 3,
    entropy_bits: 1.584963,
    normalized_entropy: 1
  };
  const observed = {
    measurement_status: "insufficient_evidence" as const,
    sample_count: 0,
    unique_count: 0,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: 0,
    admitted_submission_count: 0,
    exact_behavior_duplicate_count: 0,
    artifact_duplicate_count: 0,
    unavailable_fingerprint_count: 0
  };
  return {
    protocol_version: "research_population_diversity_v1",
    window_tick_count: 1,
    assigned_directions: assigned,
    observed_behaviors: observed,
    by_direction: [
      diversityRow("trend_following"),
      diversityRow("mean_reversion"),
      diversityRow("volatility_regime")
    ],
    tick_series: [{
      tick_id: tickId,
      completed_at: "2026-07-12T10:20:00.000Z",
      assigned_directions: assigned,
      observed_behaviors: observed,
      evaluation_authority: false,
      promotion_authority: false,
      authority_status: "not_promotion_authority"
    }],
    evaluation_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function diversityRow(
  direction_kind: "trend_following" | "mean_reversion" | "volatility_regime"
) {
  return {
    direction_kind,
    attempt_count: 1,
    observed_behavior_count: 0,
    unique_behavior_count: 0,
    admitted_submission_count: 0,
    exact_behavior_duplicate_count: 0
  };
}

function finalizeIntent(
  intent: ResearchControlCampaignArmIntentRecord
): ResearchControlCampaignArmIntentRecord {
  const result = structuredClone(intent);
  result.intent_digest = canonicalDigest(
    researchControlCampaignArmIntentDigestInput(result)
  );
  return result;
}

function finalizeReport(
  report: ResearchControlCampaignReportRecord
): ResearchControlCampaignReportRecord {
  const result = structuredClone(report);
  result.report_digest = canonicalDigest(
    researchControlCampaignReportDigestInput(result)
  );
  return result;
}

function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256").update(
    typeof value === "string"
      ? value
      : paperTradingComparisonPersistedRecordDigestInput(value)
  ).digest("hex")}`;
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
