import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonVerdictDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  researchControlCampaignArmIntentDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignPaperScheduleDigestInput,
  researchControlCampaignPaperStartBatchDigestInput,
  researchControlCampaignReportDigestInput,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignPaperScheduleRecord,
  type ResearchControlCampaignPaperStartBatchRecord,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchPopulationDiversityReadModel,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonVerdictRecord,
  type PaperTradingComparisonSide,
  type PaperTradingComparisonTickRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import {
  decideResearchControlCampaign,
  decideResearchControlCampaignArmIntent
} from "@ouroboros/application/candidate/research-control-campaign";
import { decideResearchControlCampaignPaperSchedule } from
  "@ouroboros/application/candidate/research-control-campaign-paper-schedule";
import { decideResearchControlCampaignPaperStartBatch } from
  "@ouroboros/application/candidate/research-control-campaign-paper-start-batch";
import { decideResearchControlCampaignPaperSlotOutcome } from
  "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import { decideResearchControlCampaignPaperStartIneligibleSlotOutcome } from
  "@ouroboros/application/candidate/research-control-campaign-paper-slot-outcome";
import { paperTradingComparisonIdsForIdempotencyKey } from
  "@ouroboros/application/trading/paper/comparison-identity";
import { adjudicateResearchControlCampaignOutcome } from
  "@ouroboros/application/candidate/research-control-campaign-outcome";
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

  it("rejects a bound paper protocol digest mismatch", async () => {
    const promotion = tradingPromotionFixture();
    const campaign = campaignFixture({
      paperComparator: tradingReviewComparatorFor(promotion)
    });
    if (campaign.paper_evaluation_protocol.protocol_status !== "bound") {
      throw new Error("fixture_expected_bound_protocol");
    }
    campaign.paper_evaluation_protocol.protocol_digest = digest("9");
    campaign.campaign_digest = canonicalDigest(
      researchControlCampaignDigestInput(campaign)
    );

    await expect(store.recordResearchControlCampaign(campaign))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_protocol_digest_mismatch"
      });
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

  it("requires an exact persisted TradingPromotion comparator", async () => {
    const promotion = tradingPromotionFixture();
    const comparator = {
      comparator_status: "trading_review" as const,
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: promotion.trading_promotion_id
      },
      trading_promotion_digest: canonicalDigest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      ),
      candidate_ref: { ...promotion.candidate_ref },
      candidate_version_ref: { ...promotion.candidate_version_ref },
      paper_trading_evaluation_ref: {
        ...promotion.paper_trading_evaluation_ref
      }
    };
    const campaign = campaignFixture({ paperComparator: comparator });

    await expect(store.recordResearchControlCampaign(campaign))
      .rejects.toMatchObject({
        code: "research_control_campaign_comparator_reference_not_found"
      });

    await mkdir(path.join(root, "trading-promotions/items"), { recursive: true });
    await writeFile(
      path.join(
        root,
        "trading-promotions/items",
        `${promotion.trading_promotion_id}.json`
      ),
      `${JSON.stringify(promotion, null, 2)}\n`,
      "utf8"
    );
    expect(await store.recordResearchControlCampaign(campaign)).toEqual(campaign);
  });

  it("rejects a post-hoc or mismatched Trading review comparator", async () => {
    const promotion = tradingPromotionFixture();
    await mkdir(path.join(root, "trading-promotions/items"), { recursive: true });
    await writeFile(
      path.join(
        root,
        "trading-promotions/items",
        `${promotion.trading_promotion_id}.json`
      ),
      `${JSON.stringify(promotion, null, 2)}\n`,
      "utf8"
    );
    const campaign = campaignFixture({
      paperComparator: {
        comparator_status: "trading_review",
        trading_promotion_ref: {
          record_kind: "trading_promotion",
          id: promotion.trading_promotion_id
        },
        trading_promotion_digest: canonicalDigest(
          paperTradingComparisonTradingPromotionDigestInput(promotion)
        ),
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "different-candidate"
        },
        candidate_version_ref: { ...promotion.candidate_version_ref },
        paper_trading_evaluation_ref: {
          ...promotion.paper_trading_evaluation_ref
        }
      }
    });

    await expect(store.recordResearchControlCampaign(campaign))
      .rejects.toMatchObject({
        code: "research_control_campaign_comparator_reference_mismatch"
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

  it("appends and reloads one exact campaign paper schedule", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });

    expect(await store.recordResearchControlCampaignPaperSchedule(
      fixture.schedule
    )).toEqual(fixture.schedule);
    expect(await store.getResearchControlCampaignPaperSchedule(
      fixture.schedule.research_control_campaign_paper_schedule_id
    )).toEqual(fixture.schedule);
    expect(await store.listResearchControlCampaignPaperSchedules()).toEqual([
      fixture.schedule
    ]);
    expect(await store.recordResearchControlCampaignPaperSchedule(
      fixture.schedule
    )).toEqual(fixture.schedule);
  });

  it("rejects paper schedule digest, source identity, and protocol drift", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    const digestMismatch = structuredClone(fixture.schedule);
    digestMismatch.schedule_digest = digest("9");
    await expect(store.recordResearchControlCampaignPaperSchedule(
      digestMismatch
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_digest_mismatch"
    });

    const sourceMismatch = structuredClone(fixture.schedule);
    const slot = sourceMismatch.arms[0].slots[0]!;
    if (slot.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_schedule_slot");
    }
    slot.source_preparation_id = "substituted-preparation";
    const finalizedSourceMismatch = finalizeSchedule(sourceMismatch);
    await expect(store.recordResearchControlCampaignPaperSchedule(
      finalizedSourceMismatch
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_reference_mismatch"
    });

    const protocolMismatch = finalizeSchedule({
      ...fixture.schedule,
      paper_evaluation_protocol_digest: digest("8")
    });
    await expect(store.recordResearchControlCampaignPaperSchedule(
      protocolMismatch
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_reference_mismatch"
    });
  });

  it("requires exact campaign and report records before a paper schedule", async () => {
    const fixture = await persistScheduleSourceGraph(root, store);
    await rm(path.join(
      root,
      "research-control-campaign-reports/items",
      `${fixture.report.research_control_campaign_report_id}.json`
    ));

    await expect(store.recordResearchControlCampaignPaperSchedule(
      fixture.schedule
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_reference_not_found"
    });
  });

  it("rejects a conflicting paper schedule and detects corrupt reload", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const conflict = finalizeSchedule({
      ...fixture.schedule,
      committed_at: "2026-07-12T10:31:02.000Z"
    });
    await expect(store.recordResearchControlCampaignPaperSchedule(conflict))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_schedule_conflict"
      });

    const file = path.join(
      root,
      "research-control-campaign-paper-schedules/items",
      `${fixture.schedule.research_control_campaign_paper_schedule_id}.json`
    );
    const persisted = JSON.parse(await readFile(file, "utf8"));
    persisted.schedule_digest = digest("7");
    await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

    await expect(store.getResearchControlCampaignPaperSchedule(
      fixture.schedule.research_control_campaign_paper_schedule_id
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_schedule_reload_failed"
    });
  });

  it("appends and reloads an exact cross-arm paper start batch", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true,
      staticCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const { batch } = paperStartBatchFixture(fixture.campaign, fixture.schedule);

    expect(await store.recordResearchControlCampaignPaperStartBatch(batch))
      .toEqual(batch);
    expect(await store.getResearchControlCampaignPaperStartBatch(
      batch.research_control_campaign_paper_start_batch_id
    )).toEqual(batch);
    expect(await store.listResearchControlCampaignPaperStartBatches(
      fixture.schedule.research_control_campaign_paper_schedule_id
    )).toEqual([batch]);
    expect(await store.recordResearchControlCampaignPaperStartBatch(batch))
      .toEqual(batch);
  });

  it("rejects paper start batch digest, graph, and append drift", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true,
      staticCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const { batch } = paperStartBatchFixture(fixture.campaign, fixture.schedule);
    const digestDrift = { ...structuredClone(batch), start_batch_digest: digest("9") };
    await expect(store.recordResearchControlCampaignPaperStartBatch(digestDrift))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_start_batch_digest_mismatch"
      });

    const graphDrift = finalizeStartBatch({
      ...structuredClone(batch),
      schedule_ref: {
        record_kind: "research_control_campaign_paper_schedule",
        id: "missing-schedule"
      }
    });
    await expect(store.recordResearchControlCampaignPaperStartBatch(graphDrift))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_start_batch_reference_not_found"
      });

    await store.recordResearchControlCampaignPaperStartBatch(batch);
    const conflict = finalizeStartBatch({
      ...structuredClone(batch),
      evaluated_at: "2026-07-12T10:31:05.000Z"
    });
    await expect(store.recordResearchControlCampaignPaperStartBatch(conflict))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_start_batch_conflict"
      });
  });

  it("replicates a start batch against local evidence without copying its peer", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true,
      staticCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const evidence = paperStartBatchFixture(fixture.campaign, fixture.schedule);
    await store.recordResearchControlCampaignPaperStartBatch(evidence.batch);

    const armRoot = path.join(root, "arm-replica");
    const armStore = new LocalStore(armRoot);
    await armStore.initialize();
    const armFixture = await persistScheduleSourceGraph(armRoot, armStore, {
      adaptiveCandidate: true,
      staticCandidate: true
    });
    await armStore.recordResearchControlCampaignPaperSchedule(armFixture.schedule);
    await injectPaperStartSource(
      armRoot,
      evidence.sources[0]!.comparison,
      evidence.sources[0]!.firstTick
    );

    expect(await armStore.replicateResearchControlCampaignPaperStartBatch(
      evidence.batch
    )).toEqual(evidence.batch);
    expect(await armStore.getPaperTradingComparisonCommitment(
      evidence.sources[1]!.comparison.paper_trading_comparison_commitment_id
    )).toBeUndefined();

    const emptyArmRoot = path.join(root, "empty-arm-replica");
    const emptyArmStore = new LocalStore(emptyArmRoot);
    await emptyArmStore.initialize();
    const emptyFixture = await persistScheduleSourceGraph(
      emptyArmRoot,
      emptyArmStore,
      { adaptiveCandidate: true, staticCandidate: true }
    );
    await emptyArmStore.recordResearchControlCampaignPaperSchedule(
      emptyFixture.schedule
    );
    await expect(emptyArmStore.replicateResearchControlCampaignPaperStartBatch(
      evidence.batch
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_start_batch_local_source_not_found"
    });
  });

  it("validates source-start ineligibility through a replicated batch witness", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true,
      staticCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const evidence = paperStartBatchFixture(
      fixture.campaign,
      fixture.schedule,
      { mismatch: true }
    );
    await injectPaperStartSource(
      root,
      evidence.sources[0]!.comparison,
      evidence.sources[0]!.firstTick
    );
    await store.replicateResearchControlCampaignPaperStartBatch(evidence.batch);
    const outcome = decideResearchControlCampaignPaperStartIneligibleSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      startBatch: evidence.batch
    });

    expect(await store.recordResearchControlCampaignPaperSlotOutcome(outcome))
      .toEqual(outcome);
  });

  it("rejects a schedule-owned confirmation campaign after its precommit deadline", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const slot = fixture.schedule.arms[0].slots[0]!;
    if (slot.slot_status !== "candidate_scheduled" ||
      fixture.campaign.paper_evaluation_protocol.protocol_status !== "bound") {
      throw new Error("fixture_expected_bound_candidate_slot");
    }
    const verdict = improvedSourceVerdictFixture(
      fixture.campaign,
      slot,
      "2026-07-12T11:00:00.000Z"
    );
    const deadlineStore = new ConfirmationDeadlineStore(root, verdict);
    const deadlineMs = fixture.campaign.paper_evaluation_protocol.schedule_policy
      .confirmation_precommit_deadline_ms;
    const lateCampaign = confirmationCampaignForVerdict(
      fixture.campaign,
      slot,
      verdict,
      new Date(Date.parse(verdict.evaluated_at) + deadlineMs + 1).toISOString()
    );
    expect(paperTradingComparisonVerdictHasRuntimeShape(verdict)).toBe(true);
    expect(paperTradingComparisonConfirmationCampaignHasRuntimeShape(
      lateCampaign
    )).toBe(true);

    await expect(deadlineStore.recordPaperTradingComparisonConfirmationCampaign(
      lateCampaign
    )).rejects.toMatchObject({
      code: "research_control_campaign_confirmation_precommit_deadline_missed"
    });

    deadlineStore.confirmationCampaign = lateCampaign;
    deadlineStore.confirmationOutcome = {};
    deadlineStore.researchRelease = {};
    const slotOutcome = decideResearchControlCampaignPaperSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: {
        evidence_kind: "confirmation_release",
        confirmation_campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: lateCampaign.paper_trading_comparison_confirmation_campaign_id
        },
        confirmation_campaign_digest: lateCampaign.campaign_digest,
        confirmation_outcome_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
          id: "late-confirmation-outcome"
        },
        confirmation_outcome_digest: digest("d"),
        research_release_ref: {
          record_kind: "paper_trading_comparison_research_release",
          id: "late-confirmation-release"
        },
        research_release_digest: digest("e"),
        release_kind: "confirmed_improvement",
        terminal_status: "qualified_improvement"
      },
      terminalAt: new Date(Date.parse(lateCampaign.committed_at) + 1).toISOString()
    });
    await expect(deadlineStore.recordResearchControlCampaignPaperSlotOutcome(
      slotOutcome
    )).rejects.toMatchObject({
      code: "research_control_campaign_confirmation_precommit_deadline_missed"
    });
  });

  it("appends and reloads an exact unopened source-slot expiry", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const outcome = sourceSlotExpiryOutcome(
      fixture.schedule,
      "2026-07-12T10:41:01.000Z"
    );

    expect(await store.recordResearchControlCampaignPaperSlotOutcome(outcome))
      .toEqual(outcome);
    expect(await store.getResearchControlCampaignPaperSlotOutcome(
      outcome.research_control_campaign_paper_slot_outcome_id
    )).toEqual(outcome);
    expect(await store.listResearchControlCampaignPaperSlotOutcomes(
      fixture.schedule.research_control_campaign_paper_schedule_id
    )).toEqual([outcome]);
    expect(await store.recordResearchControlCampaignPaperSlotOutcome(outcome))
      .toEqual(outcome);
  });

  it("rejects source expiry before its deadline or after preparation", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const early = sourceSlotExpiryOutcome(
      fixture.schedule,
      "2026-07-12T10:41:00.999Z"
    );
    await expect(store.recordResearchControlCampaignPaperSlotOutcome(early))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_slot_outcome_evidence_graph_invalid"
      });

    const slot = fixture.schedule.arms[0].slots[0]!;
    if (slot.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_schedule_slot");
    }
    await mkdir(path.join(
      root,
      "paper-trading-comparison-preparations/items"
    ), { recursive: true });
    await writeFile(
      path.join(
        root,
        "paper-trading-comparison-preparations/items",
        `${slot.source_preparation_id}.json`
      ),
      "{}\n",
      "utf8"
    );
    const expired = sourceSlotExpiryOutcome(
      fixture.schedule,
      "2026-07-12T10:41:01.000Z"
    );
    await expect(store.recordResearchControlCampaignPaperSlotOutcome(expired))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_slot_outcome_evidence_graph_invalid"
      });
  });

  it("rejects absent source verdict evidence and corrupt slot outcome reload", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const absentVerdict = decideResearchControlCampaignPaperSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: {
        evidence_kind: "source_verdict",
        source_comparison_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: "missing-source-comparison"
        },
        source_comparison_digest: digest("a"),
        source_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: "missing-source-verdict"
        },
        source_verdict_digest: digest("b"),
        terminal_status: "source_not_improved"
      },
      terminalAt: "2026-07-12T11:00:00.000Z"
    });
    await expect(store.recordResearchControlCampaignPaperSlotOutcome(
      absentVerdict
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_slot_outcome_evidence_reference_not_found"
    });

    const expiry = sourceSlotExpiryOutcome(
      fixture.schedule,
      "2026-07-12T10:41:01.000Z"
    );
    await store.recordResearchControlCampaignPaperSlotOutcome(expiry);
    const file = path.join(
      root,
      "research-control-campaign-paper-slot-outcomes/items",
      `${expiry.research_control_campaign_paper_slot_outcome_id}.json`
    );
    const persisted = JSON.parse(await readFile(file, "utf8"));
    persisted.slot_outcome_digest = digest("9");
    await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

    await expect(store.getResearchControlCampaignPaperSlotOutcome(
      expiry.research_control_campaign_paper_slot_outcome_id
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_slot_outcome_reload_failed"
    });
  });

  it("replicates a sealed arm-local slot outcome without local source records", async () => {
    const fixture = await persistScheduleSourceGraph(root, store, {
      adaptiveCandidate: true
    });
    await store.recordResearchControlCampaignPaperSchedule(fixture.schedule);
    const outcome = decideResearchControlCampaignPaperSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: {
        evidence_kind: "source_verdict",
        source_comparison_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: "arm-local-source-comparison"
        },
        source_comparison_digest: digest("a"),
        source_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: "arm-local-source-verdict"
        },
        source_verdict_digest: digest("b"),
        terminal_status: "source_not_improved"
      },
      terminalAt: "2026-07-12T11:00:00.000Z"
    });

    await expect(store.recordResearchControlCampaignPaperSlotOutcome(outcome))
      .rejects.toMatchObject({
        code: "research_control_campaign_paper_slot_outcome_evidence_reference_not_found"
      });
    expect(await store.replicateResearchControlCampaignPaperSlotOutcome(outcome))
      .toEqual(outcome);
    expect(await store.getResearchControlCampaignPaperSlotOutcome(
      outcome.research_control_campaign_paper_slot_outcome_id
    )).toEqual(outcome);

    const conflict = decideResearchControlCampaignPaperSlotOutcome({
      schedule: fixture.schedule,
      armKind: "adaptive_treatment",
      sequence: 1,
      terminalEvidence: structuredClone(outcome.terminal_evidence),
      terminalAt: "2026-07-12T11:01:00.000Z"
    });
    await expect(store.replicateResearchControlCampaignPaperSlotOutcome(
      conflict
    )).rejects.toMatchObject({
      code: "research_control_campaign_paper_slot_outcome_conflict"
    });
  });

  it("appends and reloads one exact terminal campaign outcome", async () => {
    const fixture = await persistOutcomeSourceGraph(root, store);

    expect(await store.recordResearchControlCampaignOutcome(fixture.outcome))
      .toEqual(fixture.outcome);
    expect(await store.getResearchControlCampaignOutcome(
      fixture.outcome.research_control_campaign_outcome_id
    )).toEqual(fixture.outcome);
    expect(await store.listResearchControlCampaignOutcomes()).toEqual([
      fixture.outcome
    ]);
    expect(await store.recordResearchControlCampaignOutcome(fixture.outcome))
      .toEqual(fixture.outcome);
  });

  it("rejects outcome digest drift, graph drift, and append conflict", async () => {
    const fixture = await persistOutcomeSourceGraph(root, store);
    const digestMismatch = structuredClone(fixture.outcome);
    digestMismatch.outcome_digest = digest("9");
    await expect(store.recordResearchControlCampaignOutcome(digestMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_outcome_digest_mismatch"
      });

    const graphMismatch = finalizeOutcome({
      ...fixture.outcome,
      report_digest: digest("8")
    });
    await expect(store.recordResearchControlCampaignOutcome(graphMismatch))
      .rejects.toMatchObject({
        code: "research_control_campaign_outcome_reference_mismatch"
      });

    await store.recordResearchControlCampaignOutcome(fixture.outcome);
    const conflict = finalizeOutcome({
      ...fixture.outcome,
      adjudicated_at: "2026-07-12T11:01:00.000Z"
    });
    await expect(store.recordResearchControlCampaignOutcome(conflict))
      .rejects.toMatchObject({
        code: "research_control_campaign_outcome_conflict"
      });
  });

  it("requires the exact persisted pre-effect comparator at outcome write", async () => {
    const fixture = await persistOutcomeSourceGraph(root, store);
    await rm(path.join(
      root,
      "trading-promotions/items",
      `${fixture.promotion.trading_promotion_id}.json`
    ));

    await expect(store.recordResearchControlCampaignOutcome(fixture.outcome))
      .rejects.toMatchObject({
        code: "research_control_campaign_outcome_reference_not_found"
      });
  });

  it("detects corrupt terminal outcome content on reload", async () => {
    const fixture = await persistOutcomeSourceGraph(root, store);
    await store.recordResearchControlCampaignOutcome(fixture.outcome);
    const file = path.join(
      root,
      "research-control-campaign-outcomes/items",
      `${fixture.outcome.research_control_campaign_outcome_id}.json`
    );
    const persisted = JSON.parse(await readFile(file, "utf8"));
    persisted.observed_result = "adaptive_rate_higher";
    await writeFile(file, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");

    await expect(store.getResearchControlCampaignOutcome(
      fixture.outcome.research_control_campaign_outcome_id
    )).rejects.toMatchObject({
      code: "research_control_campaign_outcome_reload_failed"
    });
  });
});

async function persistOutcomeSourceGraph(root: string, store: LocalStore) {
  const promotion = tradingPromotionFixture();
  await mkdir(path.join(root, "trading-promotions/items"), { recursive: true });
  await writeFile(
    path.join(
      root,
      "trading-promotions/items",
      `${promotion.trading_promotion_id}.json`
    ),
    `${JSON.stringify(promotion, null, 2)}\n`,
    "utf8"
  );
  const campaign = campaignFixture({
    paperComparator: {
      comparator_status: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: promotion.trading_promotion_id
      },
      trading_promotion_digest: canonicalDigest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      ),
      candidate_ref: { ...promotion.candidate_ref },
      candidate_version_ref: { ...promotion.candidate_version_ref },
      paper_trading_evaluation_ref: {
        ...promotion.paper_trading_evaluation_ref
      }
    }
  });
  const adaptive = armIntentFixture(campaign, "adaptive_treatment");
  const control = armIntentFixture(campaign, "static_control");
  const report = reportFixture(campaign, adaptive, control);
  await store.recordResearchControlCampaign(campaign);
  await store.recordResearchControlCampaignArmIntent(adaptive);
  await store.recordResearchControlCampaignArmIntent(control);
  await store.recordResearchControlCampaignReport(report);
  const schedule = decideResearchControlCampaignPaperSchedule({
    campaign,
    report,
    committedAt: "2026-07-12T10:31:00.000Z"
  });
  await store.recordResearchControlCampaignPaperSchedule(schedule);
  const outcome = adjudicateResearchControlCampaignOutcome({
    campaign,
    report,
    schedule,
    arms: [
      { armKind: "adaptive_treatment", slotOutcomes: [] },
      { armKind: "static_control", slotOutcomes: [] }
    ],
    adjudicatedAt: "2026-07-12T11:00:00.000Z"
  });
  return { promotion, campaign, report, schedule, outcome };
}

async function persistScheduleSourceGraph(
  root: string,
  store: LocalStore,
  options: { adaptiveCandidate?: boolean; staticCandidate?: boolean } = {}
) {
  const promotion = tradingPromotionFixture();
  await mkdir(path.join(root, "trading-promotions/items"), { recursive: true });
  await writeFile(
    path.join(
      root,
      "trading-promotions/items",
      `${promotion.trading_promotion_id}.json`
    ),
    `${JSON.stringify(promotion, null, 2)}\n`,
    "utf8"
  );
  const campaign = campaignFixture({
    paperComparator: tradingReviewComparatorFor(promotion)
  });
  const adaptive = armIntentFixture(campaign, "adaptive_treatment");
  const control = armIntentFixture(campaign, "static_control");
  const report = reportFixture(campaign, adaptive, control, options);
  await store.recordResearchControlCampaign(campaign);
  await store.recordResearchControlCampaignArmIntent(adaptive);
  await store.recordResearchControlCampaignArmIntent(control);
  await store.recordResearchControlCampaignReport(report);
  const schedule = decideResearchControlCampaignPaperSchedule({
    campaign,
    report,
    committedAt: "2026-07-12T10:31:01.000Z"
  });
  return { promotion, campaign, report, schedule };
}

function campaignFixture(input: {
  baselineDigest?: string;
  paperComparator?: Parameters<typeof decideResearchControlCampaign>[0]["paperComparator"];
  paperEvaluationProtocol?: Parameters<
    typeof decideResearchControlCampaign
  >[0]["paperEvaluationProtocol"];
} = {}) {
  const paperComparator = input.paperComparator ?? {
    comparator_status: "unavailable" as const,
    reason: "no_trading_promotion_at_commitment" as const
  };
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
    paperComparator,
    paperEvaluationProtocol: input.paperEvaluationProtocol ??
      (paperComparator.comparator_status === "trading_review"
        ? boundPaperProtocolInput()
        : {
            protocol_status: "unavailable",
            reason: "no_trading_promotion_at_commitment"
          }),
    tickCountPerArm: 1,
    committedAt: "2026-07-12T10:00:00.000Z"
  });
}

function boundPaperProtocolInput() {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 1,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 1,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("6"),
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
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function tradingPromotionFixture(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-comparator-001",
    status: "promoted_for_trading_review",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "champion-candidate"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "champion-version"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "champion-paper-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "champion-confirmation-campaign"
      },
      campaign_digest: digest("a"),
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "champion-confirmation-outcome"
      },
      campaign_outcome_digest: digest("b"),
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "champion-final-verdict"
      },
      final_verdict_digest: digest("c")
    },
    promoted_at: "2026-07-12T09:00:00.000Z",
    authority_status: "not_live"
  };
}

function tradingReviewComparatorFor(promotion: TradingPromotionRecord) {
  return {
    comparator_status: "trading_review" as const,
    trading_promotion_ref: {
      record_kind: "trading_promotion",
      id: promotion.trading_promotion_id
    },
    trading_promotion_digest: canonicalDigest(
      paperTradingComparisonTradingPromotionDigestInput(promotion)
    ),
    candidate_ref: { ...promotion.candidate_ref },
    candidate_version_ref: { ...promotion.candidate_version_ref },
    paper_trading_evaluation_ref: {
      ...promotion.paper_trading_evaluation_ref
    }
  };
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
  control: ResearchControlCampaignArmIntentRecord,
  options: { adaptiveCandidate?: boolean; staticCandidate?: boolean } = {}
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
      reportArm(
        adaptive,
        "adaptive_treatment",
        "adaptive_default",
        "3",
        options.adaptiveCandidate ?? false
      ),
      reportArm(
        control,
        "static_control",
        "static_control",
        "4",
        options.staticCandidate ?? false
      )
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
  digestCharacter: string,
  hasCandidate: boolean
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
      admitted_candidate_count: hasCandidate ? 1 : 0,
      duplicate_count: 0,
      quarantined_count: 0,
      failed_count: hasCandidate ? 2 : 3,
      provider_request_total: 0,
      runner_command_total: 0,
      scenario_count: 0,
      elapsed_ms: 0
    },
    population_diversity: emptyBehaviorDiversity(tickId, hasCandidate),
    paper_candidate_slots: [{
      sequence: 1,
      tick_ref: tickRef,
      ...(hasCandidate ? {
        status: "candidate_reserved" as const,
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: `${armKind}-candidate`
        },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: `${armKind}-candidate-version`
        },
        system_code_ref: {
          record_kind: "system_code",
          id: `${armKind}-system-code`
        },
        system_code_artifact_digest: digest(digestCharacter),
        admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: `${armKind}-admission`
        }
      } : { status: "no_admitted_candidate" as const })
    }],
    final_store_snapshot_digest: digest(digestCharacter),
    completed_at: "2026-07-12T10:30:00.000Z",
    research_diagnostics_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function emptyBehaviorDiversity(
  tickId: string,
  hasCandidate: boolean
): ResearchPopulationDiversityReadModel {
  const assigned = {
    measurement_status: "measured" as const,
    sample_count: 3,
    unique_count: 3,
    entropy_bits: 1.584963,
    normalized_entropy: 1
  };
  const observed = {
    measurement_status: "insufficient_evidence" as const,
    sample_count: hasCandidate ? 1 : 0,
    unique_count: hasCandidate ? 1 : 0,
    entropy_bits: 0,
    normalized_entropy: 0,
    cohort_count: hasCandidate ? 1 : 0,
    admitted_submission_count: hasCandidate ? 1 : 0,
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
      diversityRow("trend_following", hasCandidate),
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
  direction_kind: "trend_following" | "mean_reversion" | "volatility_regime",
  hasCandidate = false
) {
  return {
    direction_kind,
    attempt_count: 1,
    observed_behavior_count: hasCandidate ? 1 : 0,
    unique_behavior_count: hasCandidate ? 1 : 0,
    admitted_submission_count: hasCandidate ? 1 : 0,
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

function finalizeOutcome(
  outcome: ResearchControlCampaignOutcomeRecord
): ResearchControlCampaignOutcomeRecord {
  const result = structuredClone(outcome);
  result.outcome_digest = canonicalDigest(
    researchControlCampaignOutcomeDigestInput(result)
  );
  return result;
}

function paperStartBatchFixture(
  campaign: ResearchControlCampaignRecord,
  schedule: ResearchControlCampaignPaperScheduleRecord,
  options: { mismatch?: boolean } = {}
): {
  batch: ResearchControlCampaignPaperStartBatchRecord;
  sources: Array<{
    armKind: "adaptive_treatment" | "static_control";
    comparison: PaperTradingComparisonCommitmentRecord;
    firstTick: PaperTradingComparisonTickRecord;
  }>;
} {
  if (campaign.paper_comparator.comparator_status !== "trading_review" ||
    campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("fixture_expected_bound_campaign");
  }
  const comparator = campaign.paper_comparator;
  const paperProtocol = campaign.paper_evaluation_protocol;
  const sources = schedule.arms.map((arm, index) => {
    const slot = arm.slots[0]!;
    if (slot.slot_status !== "candidate_scheduled") {
      throw new Error("fixture_expected_candidate_schedule_slot");
    }
    const token = arm.arm_kind === "adaptive_treatment" ? "adaptive" : "static";
    const comparison = finalizePaperStartComparison({
      record_kind: "paper_trading_comparison_commitment",
      version: 1,
      paper_trading_comparison_commitment_id:
        slot.source_comparison_commitment_id,
      preparation_ref: {
        record_kind: "paper_trading_comparison_preparation",
        id: slot.source_preparation_id
      },
      champion: paperStartComparisonSide("champion", token, {
        candidateId: comparator.candidate_ref.id,
        candidateVersionId: comparator.candidate_version_ref.id,
        systemCodeId: "paper-start-champion-code",
        admissionId: "paper-start-champion-admission",
        artifactDigest: digest("a")
      }),
      challenger: paperStartComparisonSide("challenger", token, {
        candidateId: slot.candidate_ref.id,
        candidateVersionId: slot.candidate_version_ref.id,
        systemCodeId: slot.system_code_ref.id,
        admissionId: slot.admission_decision_ref.id,
        artifactDigest: slot.system_code_artifact_digest
      }),
      champion_selection: {
        selection_kind: "trading_review",
        trading_promotion_ref: {
          ...comparator.trading_promotion_ref
        },
        trading_promotion_digest: comparator.trading_promotion_digest,
        paper_trading_evaluation_ref: {
          ...comparator.paper_trading_evaluation_ref
        },
        paper_trading_evaluation_record_digest: digest("b"),
        paper_trading_evaluation_commitment_ref: {
          record_kind: "paper_trading_evaluation_commitment",
          id: "paper-start-champion-authority-commitment"
        },
        paper_trading_evaluation_commitment_record_digest: digest("c"),
        paper_trading_observation_chain_digest: digest("d")
      },
      comparison_policy: structuredClone(
        paperProtocol.comparison_policy
      ),
      market_data_configuration_digest:
        paperProtocol.market_data_configuration_digest,
      paper_policy_identity: structuredClone(
        paperProtocol.paper_policy_identity
      ),
      committed_at: new Date(
        Date.parse(schedule.committed_at) + 1_000
      ).toISOString(),
      commitment_digest: digest("0"),
      authority_status: "not_live"
    });
    return {
      armKind: arm.arm_kind,
      comparison,
      firstTick: paperStartFirstTick(
        comparison,
        token,
        index + 2,
        schedule.committed_at
      )
    };
  }) as Array<{
    armKind: "adaptive_treatment" | "static_control";
    comparison: PaperTradingComparisonCommitmentRecord;
    firstTick: PaperTradingComparisonTickRecord;
  }>;
  const delay = Math.max(...schedule.arms.flatMap((arm) => arm.slots.map(
    (slot) => slot.slot_status === "candidate_scheduled"
      ? slot.maximum_source_start_delay_ms
      : 0
  )));
  const sourceStartDeadlineAt = new Date(
    Date.parse(schedule.committed_at) + delay
  ).toISOString();
  if (options.mismatch) {
    const changed = structuredClone(sources[1]!.firstTick);
    changed.market_snapshot.price += 1;
    sources[1]!.firstTick = finalizePaperStartTick(changed);
  }
  const evaluatedAt = sources.at(-1)!.firstTick.observed_at;
  return {
    sources,
    batch: decideResearchControlCampaignPaperStartBatch({
      campaign,
      schedule,
      sequence: 1,
      sources,
      sourceStartDeadlineAt,
      evaluatedAt
    })
  };
}

function improvedSourceVerdictFixture(
  campaign: ResearchControlCampaignRecord,
  slot: Extract<
    ResearchControlCampaignPaperScheduleRecord["arms"][number]["slots"][number],
    { slot_status: "candidate_scheduled" }
  >,
  evaluatedAt: string
): PaperTradingComparisonVerdictRecord {
  if (campaign.paper_comparator.comparator_status !== "trading_review" ||
    campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("fixture_expected_bound_campaign");
  }
  const qualification = {
    comparison_id: slot.source_comparison_commitment_id,
    activation_id: "deadline-source-activation",
    activation_attempt_id: "deadline-source-attempt",
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    checkpoint_count: 1,
    champion: deadlineSideQualification(),
    challenger: deadlineSideQualification(),
    authority_status: "not_verdict" as const
  };
  const verdict: PaperTradingComparisonVerdictRecord = {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: "deadline-source-verdict",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: slot.source_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: digest("8"),
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: qualification.activation_id
    },
    paper_trading_comparison_activation_digest: digest("9"),
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: qualification.activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: digest("a"),
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: "deadline-source-activation-outcome"
    },
    final_activation_outcome_digest: digest("b"),
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "deadline-source-tick"
    },
    latest_tick_digest: digest("c"),
    checkpoint_outcome_refs: [{
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: "deadline-source-checkpoint"
    }],
    checkpoint_outcome_digests: [digest("d")],
    pair_qualification: qualification,
    pair_qualification_digest: digest("e"),
    champion: deadlineVerdictSide("champion", {
      candidateId: campaign.paper_comparator.candidate_ref.id,
      candidateVersionId: campaign.paper_comparator.candidate_version_ref.id,
      systemCodeId: "deadline-champion-code",
      artifactDigest: digest("f"),
      netRevenue: 0
    }),
    challenger: deadlineVerdictSide("challenger", {
      candidateId: slot.candidate_ref.id,
      candidateVersionId: slot.candidate_version_ref.id,
      systemCodeId: slot.system_code_ref.id,
      artifactDigest: slot.system_code_artifact_digest,
      netRevenue: 2
    }),
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: 2,
      observed_lift_usdt: 2,
      minimum_lift_usdt:
        campaign.paper_evaluation_protocol.comparison_policy
          .minimum_net_revenue_lift_usdt
    },
    verdict_outcome: "challenger_improved",
    window_started_at: "2026-07-12T10:40:00.000Z",
    window_ended_at: "2026-07-12T10:59:00.000Z",
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: "requires_precommitted_campaign",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: "precommit_confirmation_campaign",
    evaluated_at: evaluatedAt,
    verdict_digest: digest("0"),
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  verdict.verdict_digest = canonicalDigest(
    paperTradingComparisonVerdictDigestInput(verdict)
  );
  return verdict;
}

function deadlineSideQualification() {
  return {
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    evidence_window: {
      observation_count: 1,
      elapsed_ms: 60_000,
      failed_observation_count: 0,
      first_observed_at: "2026-07-12T10:40:00.000Z",
      last_observed_at: "2026-07-12T10:59:00.000Z"
    }
  };
}

function deadlineVerdictSide(
  role: "champion" | "challenger",
  input: {
    candidateId: string;
    candidateVersionId: string;
    systemCodeId: string;
    artifactDigest: string;
    netRevenue: number;
  }
) {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate" as const,
      id: input.candidateId
    },
    candidate_version_ref: {
      record_kind: "candidate_version" as const,
      id: input.candidateVersionId
    },
    system_code_ref: {
      record_kind: "system_code" as const,
      id: input.systemCodeId
    },
    system_code_artifact_digest: input.artifactDigest,
    trading_run_ref: {
      record_kind: "trading_run" as const,
      id: `deadline-${role}-run`
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment" as const,
      id: `deadline-${role}-commitment`
    },
    paper_trading_evaluation_commitment_record_digest: digest("1"),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation" as const,
      id: `deadline-${role}-evaluation`
    },
    paper_trading_evaluation_record_digest: digest("2"),
    paper_trading_observation_chain_digest: digest("3"),
    net_revenue_usdt: input.netRevenue,
    cost_usdt: 0
  };
}

function confirmationCampaignForVerdict(
  campaign: ResearchControlCampaignRecord,
  slot: Extract<
    ResearchControlCampaignPaperScheduleRecord["arms"][number]["slots"][number],
    { slot_status: "candidate_scheduled" }
  >,
  verdict: PaperTradingComparisonVerdictRecord,
  committedAt: string
): PaperTradingComparisonConfirmationCampaignRecord {
  if (campaign.paper_comparator.comparator_status !== "trading_review" ||
    campaign.paper_evaluation_protocol.protocol_status !== "bound") {
    throw new Error("fixture_expected_bound_campaign");
  }
  const campaignId = `paper-comparison-confirmation-campaign-${createHash("sha256")
    .update(verdict.paper_trading_comparison_verdict_id)
    .digest("hex")
    .slice(0, 32)}`;
  const idempotencyKey =
    `paper-comparison-confirmation:${campaignId}:slot:1`;
  const ids = paperTradingComparisonIdsForIdempotencyKey(idempotencyKey);
  const record: PaperTradingComparisonConfirmationCampaignRecord = {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: campaignId,
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: verdict.paper_trading_comparison_verdict_id
    },
    source_verdict_digest: verdict.verdict_digest,
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: slot.source_comparison_commitment_id
    },
    source_comparison_digest:
      verdict.paper_trading_comparison_commitment_digest,
    champion: deadlineCampaignCandidateSide("champion", {
      candidateId: campaign.paper_comparator.candidate_ref.id,
      candidateVersionId: campaign.paper_comparator.candidate_version_ref.id,
      systemCodeId: "deadline-champion-code",
      admissionId: "deadline-champion-admission",
      artifactDigest: digest("f")
    }),
    challenger: deadlineCampaignCandidateSide("challenger", {
      candidateId: slot.candidate_ref.id,
      candidateVersionId: slot.candidate_version_ref.id,
      systemCodeId: slot.system_code_ref.id,
      admissionId: slot.admission_decision_ref.id,
      artifactDigest: slot.system_code_artifact_digest
    }),
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        ...campaign.paper_comparator.trading_promotion_ref
      },
      trading_promotion_digest:
        campaign.paper_comparator.trading_promotion_digest,
      paper_trading_evaluation_ref: {
        ...campaign.paper_comparator.paper_trading_evaluation_ref
      },
      paper_trading_evaluation_record_digest: digest("4"),
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "deadline-champion-authority-commitment"
      },
      paper_trading_evaluation_commitment_record_digest: digest("5"),
      paper_trading_observation_chain_digest: digest("6")
    },
    comparison_policy: structuredClone(
      campaign.paper_evaluation_protocol.comparison_policy
    ),
    market_data_configuration_digest:
      campaign.paper_evaluation_protocol.market_data_configuration_digest,
    paper_policy_identity: structuredClone(
      campaign.paper_evaluation_protocol.paper_policy_identity
    ),
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 1,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms:
        campaign.paper_evaluation_protocol.comparison_policy.maximum_elapsed_ms,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots: [{
      slot_index: 1,
      comparison_idempotency_key: idempotencyKey,
      paper_trading_comparison_preparation_id: ids.preparation_id,
      paper_trading_comparison_commitment_id: ids.comparison_commitment_id
    }],
    committed_at: committedAt,
    campaign_digest: digest("0"),
    evaluation_authority: "external_to_trading_systems",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  record.campaign_digest = canonicalDigest(
    paperTradingComparisonConfirmationCampaignDigestInput(record)
  );
  return record;
}

function deadlineCampaignCandidateSide(
  role: "champion" | "challenger",
  input: {
    candidateId: string;
    candidateVersionId: string;
    systemCodeId: string;
    admissionId: string;
    artifactDigest: string;
  }
) {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate" as const,
      id: input.candidateId
    },
    candidate_version_ref: {
      record_kind: "candidate_version" as const,
      id: input.candidateVersionId
    },
    candidate_version_digest: digest(role === "champion" ? "7" : "8"),
    system_code_ref: {
      record_kind: "system_code" as const,
      id: input.systemCodeId
    },
    system_code_record_digest: digest(role === "champion" ? "9" : "a"),
    system_code_artifact_digest: input.artifactDigest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision" as const,
      id: input.admissionId
    },
    admission_decision_digest: digest(role === "champion" ? "b" : "c")
  };
}

class ConfirmationDeadlineStore extends LocalStore {
  confirmationCampaign?: PaperTradingComparisonConfirmationCampaignRecord;
  confirmationOutcome?: unknown;
  researchRelease?: unknown;

  constructor(
    root: string,
    private readonly sourceVerdict: PaperTradingComparisonVerdictRecord
  ) {
    super(root);
  }

  override async getPaperTradingComparisonVerdict(
    verdictId: string
  ): Promise<PaperTradingComparisonVerdictRecord | undefined> {
    if (verdictId === this.sourceVerdict.paper_trading_comparison_verdict_id) {
      return structuredClone(this.sourceVerdict);
    }
    return super.getPaperTradingComparisonVerdict(verdictId);
  }

  override async getPaperTradingComparisonConfirmationCampaign(
    campaignId: string
  ): Promise<any> {
    if (this.confirmationCampaign?.paper_trading_comparison_confirmation_campaign_id ===
      campaignId) {
      return structuredClone(this.confirmationCampaign);
    }
    return super.getPaperTradingComparisonConfirmationCampaign(campaignId);
  }

  override async getPaperTradingComparisonConfirmationCampaignOutcome(
    outcomeId: string
  ): Promise<any> {
    if (outcomeId === "late-confirmation-outcome") {
      return structuredClone(this.confirmationOutcome);
    }
    return super.getPaperTradingComparisonConfirmationCampaignOutcome(outcomeId);
  }

  override async getPaperTradingComparisonResearchRelease(
    releaseId: string
  ): Promise<any> {
    if (releaseId === "late-confirmation-release") {
      return structuredClone(this.researchRelease);
    }
    return super.getPaperTradingComparisonResearchRelease(releaseId);
  }
}

function paperStartComparisonSide(
  role: "champion" | "challenger",
  token: string,
  input: {
    candidateId: string;
    candidateVersionId: string;
    systemCodeId: string;
    admissionId: string;
    artifactDigest: string;
  }
): PaperTradingComparisonSide {
  return {
    role,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: input.candidateId
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidateVersionId
    },
    candidate_version_digest: digest(role === "champion" ? "e" : "f"),
    system_code_ref: { record_kind: "system_code", id: input.systemCodeId },
    system_code_record_digest: digest(role === "champion" ? "1" : "2"),
    system_code_artifact_digest: input.artifactDigest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: input.admissionId
    },
    admission_decision_digest: digest(role === "champion" ? "3" : "4"),
    trading_run_ref: {
      record_kind: "trading_run",
      id: `${token}-${role}-paper-start-run`
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `${token}-${role}-paper-start-commitment`
    },
    paper_trading_evaluation_commitment_digest: digest("5"),
    paper_trading_evaluation_commitment_record_digest: digest("6"),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${token}-${role}-paper-start-evaluation`
    },
    paper_trading_evaluation_record_digest: digest("7")
  };
}

function paperStartFirstTick(
  comparison: PaperTradingComparisonCommitmentRecord,
  token: string,
  elapsedSeconds: number,
  scheduleCommittedAt: string
): PaperTradingComparisonTickRecord {
  const marketObservedAt = new Date(
    Date.parse(scheduleCommittedAt) + 1_200
  ).toISOString();
  const executionObservedAt = new Date(
    Date.parse(scheduleCommittedAt) + 1_300
  ).toISOString();
  return finalizePaperStartTick({
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: `${token}-paper-start-first-tick`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    sequence: 1,
    market_data_configuration_digest:
      comparison.market_data_configuration_digest,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: marketObservedAt,
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: executionObservedAt,
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "paper-start-shared",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: new Date(
      Date.parse(scheduleCommittedAt) + elapsedSeconds * 1_000
    ).toISOString(),
    tick_digest: digest("0"),
    authority_status: "not_live"
  });
}

function finalizePaperStartComparison(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  const result = structuredClone(comparison);
  result.commitment_digest = canonicalDigest(
    paperTradingComparisonCommitmentDigestInput(result)
  );
  return result;
}

function finalizePaperStartTick(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  const result = structuredClone(tick);
  result.tick_digest = canonicalDigest(
    paperTradingComparisonTickDigestInput(result)
  );
  return result;
}

function finalizeStartBatch(
  batch: ResearchControlCampaignPaperStartBatchRecord
): ResearchControlCampaignPaperStartBatchRecord {
  const result = structuredClone(batch);
  result.start_batch_digest = canonicalDigest(
    researchControlCampaignPaperStartBatchDigestInput(result)
  );
  return result;
}

async function injectPaperStartSource(
  storeRoot: string,
  comparison: PaperTradingComparisonCommitmentRecord,
  tick: PaperTradingComparisonTickRecord
): Promise<void> {
  await mkdir(path.join(
    storeRoot,
    "paper-trading-comparison-commitments/items"
  ), { recursive: true });
  await mkdir(path.join(
    storeRoot,
    "paper-trading-comparison-ticks/items"
  ), { recursive: true });
  await writeFile(
    path.join(
      storeRoot,
      "paper-trading-comparison-commitments/items",
      `${comparison.paper_trading_comparison_commitment_id}.json`
    ),
    `${JSON.stringify(comparison, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(
      storeRoot,
      "paper-trading-comparison-ticks/items",
      `${tick.paper_trading_comparison_tick_id}.json`
    ),
    `${JSON.stringify(tick, null, 2)}\n`,
    "utf8"
  );
}

function finalizeSchedule(
  schedule: ResearchControlCampaignPaperScheduleRecord
): ResearchControlCampaignPaperScheduleRecord {
  const result = structuredClone(schedule);
  result.schedule_digest = canonicalDigest(
    researchControlCampaignPaperScheduleDigestInput(result)
  );
  return result;
}

function sourceSlotExpiryOutcome(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  expiredAt: string
) {
  return decideResearchControlCampaignPaperSlotOutcome({
    schedule,
    armKind: "adaptive_treatment",
    sequence: 1,
    terminalEvidence: {
      evidence_kind: "source_slot_expired",
      terminal_status: "paper_slot_expired",
      expired_at: expiredAt
    },
    terminalAt: expiredAt
  });
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
