import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ResearchControlCampaignPaperEvaluationProtocolInput } from
  "@ouroboros/application/candidate/research-control-campaign";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import {
  PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
  paperTradingMarketDataConfigurationDigest
} from "@ouroboros/application/trading/paper/commitment";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  researchControlCampaignWorkspacePaths
} from "../src/candidate/arena/research-control-campaign";
import {
  createResearchControlStudyArmSessionFactory
} from "../src/candidate/arena/research-control-study-arm-session-factory";
import {
  commitResearchControlStudyRuntime,
  createResearchControlStudyRuntime
} from "../src/candidate/arena/research-control-study-runtime";
import {
  createProspectivePaperHarness,
  networklessResearchPreflightArtifactRunner,
  networklessResearchPreflightProvider,
  prospectiveClock,
  prospectiveMarketData,
  type ProspectivePaperHarness
} from "./helpers/research-control-study-prospective";

const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  "apps/runtime/test/fixtures/research-control-study/trading-review-store"
);

describe("ResearchControlStudy prospective protocol evidence", () => {
  let root: string;
  let paperHarness: ProspectivePaperHarness | undefined;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-study-prospective-"));
  });

  afterEach(async () => {
    await paperHarness?.cleanup();
    await rm(root, { recursive: true, force: true });
  });

  it("executes six precommitted real-arm replications and replays without effects", async () => {
    const repoRoot = process.cwd();
    const sourceRoot = path.join(root, "source");
    await cp(FIXTURE_ROOT, sourceRoot, { recursive: true });
    const store = new LocalStore(sourceRoot);
    await store.initialize();
    const promotionBefore = await store.getLatestTradingPromotion();
    const allocationDecisionsBefore =
      await store.listResearchAllocationPolicyDecisions();
    const clock = prospectiveClock(new Date().toISOString());
    const marketData = prospectiveMarketData({ now: clock.now });
    const protocol = boundProtocol(
      paperTradingMarketDataConfigurationDigest(marketData)
    );
    const agent = new FixtureTradingResearchAgentAdapter();
    const replicationKeys = Array.from(
      { length: 6 },
      (_, index) => `prospective-study-replication-${index + 1}`
    );

    const study = await commitResearchControlStudyRuntime({
      store,
      studyIdempotencyKey: "prospective-study-six-replications",
      replicationIdempotencyKeys: replicationKeys,
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgentIdentity: agent.agent,
      tickCountPerArm: 1,
      maximumBaselineRegularFileCount: 10_000,
      maximumBaselineTotalBytes: 1_000_000_000,
      paperEvaluationProtocol: protocol,
      now: clock.now,
      repoRoot
    });

    expect(study.replications.map((replication) =>
      replication.campaign_idempotency_key
    )).toEqual(replicationKeys);
    await expect(preEffectEvidence(store)).resolves.toEqual({
      campaigns: 0,
      reports: 0,
      schedules: 0,
      campaignOutcomes: 0,
      studyOutcomes: 0
    });

    paperHarness = createProspectivePaperHarness({ repoRoot, marketData });
    const createArmSessions = createResearchControlStudyArmSessionFactory({
      marketData,
      createSandboxAdapters: paperHarness.createSandboxAdapters,
      createArtifactResolver: paperHarness.createArtifactResolver,
      apiProviderFactory: paperHarness.apiProviderFactory,
      apiProviderOptions: {
        listen_host: "127.0.0.1",
        sandbox_host: "127.0.0.1"
      },
      intervalMs: 25,
      sandboxIntervalMs: 1_000,
      observationDrainTimeoutMs: 10_000
    });
    const workspaceRoot = path.join(root, "workspace");
    const campaign = {
      workspaceRoot,
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgent: "fixture" as const,
      researchAgentIdentity: agent.agent,
      agentFactory: () => new FixtureTradingResearchAgentAdapter(),
      tickCountPerArm: 1,
      maximumBaselineRegularFileCount: 10_000,
      maximumBaselineTotalBytes: 1_000_000_000,
      paperEvaluationProtocol: protocol,
      now: clock.now,
      repoRoot,
      artifactRunner: networklessResearchPreflightArtifactRunner(),
      replayProviderFactory: networklessResearchPreflightProvider,
      marketData,
      createArmSessions,
      sleep: clock.sleep
    };
    const runtime = createResearchControlStudyRuntime({ store, campaign });

    runtime.runner.start({ studyId: study.research_control_study_id });
    await runtime.runner.drain();
    const runnerStatus = runtime.runner.status();
    expect(runnerStatus, JSON.stringify(runnerStatus)).toMatchObject({
      status: "completed"
    });

    const [campaigns, reports, schedules, outcomes, studyOutcomes] =
      await Promise.all([
        store.listResearchControlCampaigns(),
        store.listResearchControlCampaignReports(),
        store.listResearchControlCampaignPaperSchedules(),
        store.listResearchControlCampaignOutcomes(),
        store.listResearchControlStudyOutcomes()
      ]);
    expect(campaigns).toHaveLength(6);
    expect(reports).toHaveLength(6);
    expect(schedules).toHaveLength(6);
    expect(outcomes).toHaveLength(6);
    expect(studyOutcomes).toHaveLength(1);
    expect(studyOutcomes[0]!.replication_results.map((replication) =>
      replication.replication_index
    )).toEqual([1, 2, 3, 4, 5, 6]);
    expect(studyOutcomes[0]!.replication_results.map((replication) =>
      replication.campaign_ref.id
    )).toEqual(study.replications.map((replication) =>
      replication.campaign_ref.id
    ));
    expect(studyOutcomes[0]).toMatchObject({
      planned_replication_count: 6,
      completed_replication_count: 6,
      adaptive_positive_count: 0,
      static_positive_count: 0,
      tied_count: 6,
      non_tied_count: 0,
      mean_rate_difference: 0,
      exact_sign_test_p_value: 1,
      inference_status: "insufficient_non_tied_replications",
      policy_decision_eligibility: "not_eligible",
      next_action: "accumulate_or_redesign_precommitted_study"
    });
    for (const outcome of outcomes) {
      expect(outcome.arms).toHaveLength(2);
      for (const arm of outcome.arms) {
        expect(arm.slot_results.some((slot) =>
          "candidate_ref" in slot
        )).toBe(true);
      }
    }
    expect(outcomes.flatMap((outcome) => outcome.arms.flatMap((arm) =>
      arm.slot_results.map((slot) => slot.terminal_status)
    ))).toEqual(Array.from({ length: 12 }, () => "source_not_improved"));
    const qualificationEvidence = [];
    for (const outcome of outcomes) {
      const paths = researchControlCampaignWorkspacePaths({
        workspaceRoot,
        campaignId: outcome.campaign_ref.id,
        sourceRoot
      });
      for (const arm of outcome.arms) {
        const slot = arm.slot_results[0];
        if (!slot || !("paper_slot_outcome_ref" in slot)) {
          throw new Error("prospective candidate slot outcome missing");
        }
        const terminal = await store.getResearchControlCampaignPaperSlotOutcome(
          slot.paper_slot_outcome_ref.id
        );
        if (terminal?.terminal_evidence.evidence_kind !== "source_verdict") {
          throw new Error("prospective source verdict evidence missing");
        }
        const armStore = new LocalStore(paths.armRoots[arm.arm_kind]);
        await armStore.initialize();
        const verdict = await armStore.getPaperTradingComparisonVerdict(
          terminal.terminal_evidence.source_verdict_ref.id
        );
        if (!verdict) throw new Error("prospective source verdict missing");
        qualificationEvidence.push({
          pair: verdict.pair_qualification.qualification_reasons,
          champion: verdict.pair_qualification.champion.qualification_reasons,
          challenger:
            verdict.pair_qualification.challenger.qualification_reasons
        });
      }
    }
    expect(qualificationEvidence).toEqual(Array.from({ length: 12 }, () => ({
      pair: [],
      champion: [],
      challenger: []
    })));
    expect(paperHarness.tracker).toEqual({
      providerStarts: 24,
      providerCloses: 24,
      sandboxStarts: 24,
      sandboxStops: 24
    });
    expect(await store.getLatestTradingPromotion()).toEqual(promotionBefore);
    expect(await store.listResearchAllocationPolicyDecisions()).toEqual(
      allocationDecisionsBefore
    );

    const effectsBeforeRestart = { ...paperHarness.tracker };
    const completedOutcome = structuredClone(studyOutcomes[0]);
    const restartedStore = new LocalStore(sourceRoot);
    await restartedStore.initialize();
    const restarted = createResearchControlStudyRuntime({
      store: restartedStore,
      campaign
    });
    restarted.runner.start({ studyId: study.research_control_study_id });
    await restarted.runner.drain();

    const restartedRunnerStatus = restarted.runner.status();
    expect(
      restartedRunnerStatus,
      JSON.stringify(restartedRunnerStatus)
    ).toMatchObject({ status: "completed" });
    expect(await restartedStore.listResearchControlStudyOutcomes()).toEqual([
      completedOutcome
    ]);
    expect(paperHarness.tracker).toEqual(effectsBeforeRestart);
  }, 180_000);
});

async function preEffectEvidence(store: LocalStore) {
  const [campaigns, reports, schedules, campaignOutcomes, studyOutcomes] =
    await Promise.all([
      store.listResearchControlCampaigns(),
      store.listResearchControlCampaignReports(),
      store.listResearchControlCampaignPaperSchedules(),
      store.listResearchControlCampaignOutcomes(),
      store.listResearchControlStudyOutcomes()
    ]);
  return {
    campaigns: campaigns.length,
    reports: reports.length,
    schedules: schedules.length,
    campaignOutcomes: campaignOutcomes.length,
    studyOutcomes: studyOutcomes.length
  };
}

function boundProtocol(
  marketDataConfigurationDigest: string
): ResearchControlCampaignPaperEvaluationProtocolInput {
  return {
    protocol_status: "bound",
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge",
      symbol: "BTCUSDT",
      interval_ms: 25,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 25,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 0.01,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
    },
    market_data_configuration_digest: marketDataConfigurationDigest,
    paper_policy_identity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1",
      source_start_order: "paired_by_sequence",
      maximum_active_source_pairs: 2,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired",
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}
