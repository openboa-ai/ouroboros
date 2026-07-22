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
  fallingProspectivePricePath,
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
    try {
      await paperHarness?.cleanup();
    } finally {
      paperHarness = undefined;
      await rm(root, { recursive: true, force: true });
    }
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
    const startedAt = new Date().toISOString();
    const clock = prospectiveClock(startedAt);
    const marketData = prospectiveMarketData({
      now: clock.now,
      priceAt: fallingProspectivePricePath(startedAt)
    });
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
    const runtimeStatus = runtime.runner.status();
    expect(runtimeStatus.status, JSON.stringify(runtimeStatus, null, 2))
      .toBe("completed");

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
    for (const outcome of outcomes) {
      expect(outcome.arms).toHaveLength(2);
      for (const arm of outcome.arms) {
        expect(arm.slot_results.some((slot) =>
          "candidate_ref" in slot
        )).toBe(true);
      }
    }
    const qualificationEvidence = [];
    const allocationEvidence = [];
    const checkpointEvidence = [];
    const verdictEvidence = [];
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
        if (!terminal) throw new Error("prospective terminal evidence missing");
        const armStore = new LocalStore(paths.armRoots[arm.arm_kind]);
        await armStore.initialize();
        const allocation = (await armStore
          .listCandidateArenaResearchAllocations())[0];
        allocationEvidence.push({
          arm: arm.arm_kind,
          allocationMode: allocation?.allocation_mode,
          firstDirection: allocation?.selected_directions[0]?.direction_kind
        });
        const sourceVerdictId = terminal.terminal_evidence.evidence_kind ===
            "source_verdict"
          ? terminal.terminal_evidence.source_verdict_ref.id
          : terminal.terminal_evidence.evidence_kind === "confirmation_release"
            ? (await armStore.getPaperTradingComparisonConfirmationCampaign(
                terminal.terminal_evidence.confirmation_campaign_ref.id
              ))?.source_verdict_ref.id
            : undefined;
        const verdict = sourceVerdictId
          ? await armStore.getPaperTradingComparisonVerdict(sourceVerdictId)
          : undefined;
        if (!verdict) throw new Error("prospective source verdict missing");
        verdictEvidence.push({
          arm: arm.arm_kind,
          outcome: verdict.verdict_outcome,
          metric: verdict.metric,
          championCandidateId: verdict.champion.candidate_ref.id,
          challengerCandidateId: verdict.challenger.candidate_ref.id
        });
        const checkpoints = await Promise.all(
          verdict.checkpoint_outcome_refs.map((reference) =>
            armStore.getPaperTradingComparisonCheckpointOutcome(reference.id)
          )
        );
        checkpointEvidence.push({
          arm: arm.arm_kind,
          checkpoints: checkpoints.map((checkpoint) => ({
            sequence: checkpoint?.checkpoint_sequence,
            status: checkpoint?.outcome_status,
            reason: checkpoint?.outcome_reason,
            ...(checkpoint?.stable_error_code
              ? { stableErrorCode: checkpoint.stable_error_code }
              : {})
          }))
        });
        qualificationEvidence.push({
          pair: verdict.pair_qualification.qualification_reasons,
          champion: verdict.pair_qualification.champion.qualification_reasons,
          challenger:
            verdict.pair_qualification.challenger.qualification_reasons
        });
      }
    }
    expect(checkpointEvidence).toEqual(Array.from({ length: 6 }, () => ([
      {
        arm: "adaptive_treatment",
        checkpoints: [
          { sequence: 1, status: "paired", reason: "paired_checkpoint_recorded" },
          { sequence: 2, status: "paired", reason: "paired_checkpoint_recorded" },
          { sequence: 3, status: "paired", reason: "paired_checkpoint_recorded" }
        ]
      },
      {
        arm: "static_control",
        checkpoints: [
          { sequence: 1, status: "paired", reason: "paired_checkpoint_recorded" },
          { sequence: 2, status: "paired", reason: "paired_checkpoint_recorded" },
          { sequence: 3, status: "paired", reason: "paired_checkpoint_recorded" }
        ]
      }
    ])).flat());
    expect(qualificationEvidence).toEqual(Array.from({ length: 12 }, () => ({
      pair: [],
      champion: [],
      challenger: []
    })));
    for (let index = 0; index < verdictEvidence.length; index += 2) {
      const adaptive = verdictEvidence[index]!;
      const control = verdictEvidence[index + 1]!;
      expect(adaptive).toMatchObject({
        arm: "adaptive_treatment",
        outcome: "challenger_improved"
      });
      expect(adaptive.metric?.observed_lift_usdt).toBeGreaterThanOrEqual(0.01);
      expect(control).toMatchObject({
        arm: "static_control",
        outcome: "challenger_not_improved"
      });
      expect(control.metric?.observed_lift_usdt).toBeLessThan(0.01);
    }
    expect(outcomes.map((outcome) => outcome.arms.map((arm) => ({
      arm: arm.arm_kind,
      terminal: arm.slot_results[0]?.terminal_status
    })))).toEqual(Array.from({ length: 6 }, () => ([
      { arm: "adaptive_treatment", terminal: "qualified_improvement" },
      { arm: "static_control", terminal: "source_not_improved" }
    ])));
    expect(studyOutcomes[0]).toMatchObject({
      planned_replication_count: 6,
      completed_replication_count: 6,
      adaptive_positive_count: 6,
      static_positive_count: 0,
      tied_count: 0,
      non_tied_count: 6,
      mean_rate_difference: 1,
      exact_sign_test_p_value: 0.03125,
      inference_status: "adaptive_effect_supported",
      policy_decision_eligibility: "eligible_for_separate_policy_decision",
      next_action: "review_research_allocation_policy"
    });
    expect(allocationEvidence).toEqual(Array.from({ length: 6 }, () => ([
      {
        arm: "adaptive_treatment",
        allocationMode: "adaptive_default",
        firstDirection: "mean_reversion"
      },
      {
        arm: "static_control",
        allocationMode: "static_control",
        firstDirection: "trend_following"
      }
    ])).flat());
    expect(paperHarness.tracker).toEqual({
      providerStarts: 36,
      providerCloses: 36,
      sandboxStarts: 36,
      sandboxStops: 36
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
  }, 480_000);
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
      minimum_observation_count: 3,
      minimum_elapsed_ms: 50,
      maximum_observation_count: 3,
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
