import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  paperTradingComparisonTradingPromotionDigestInput,
  type ArtifactLineageRecord,
  type CandidateAdmissionDecisionRecord,
  type CandidateInspectReadModel,
  type CandidateMaterializationInput,
  type ExperimentRunRecord,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonTickRecord,
  type ResearchFindingRecord,
  type SandboxDetailReadModel,
  type SandboxRecord,
  type SystemCodeRecord,
  type TradingEvaluationResultRecord
} from "@ouroboros/domain";
import {
  FIXTURE_CANDIDATE_ID,
  LocalStore
} from "@ouroboros/local-store";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { SandboxStartInput } from "../../ports/sandbox";
import type { OuroborosStorePort } from "../../ports/store";
import type { GatewayRuntimeBinding } from "../gateway/runtime-binding";
import type { PaperTradingApiProviderComparisonTickHooks } from "../research/types";
import {
  PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
  paperTradingMarketDataConfigurationDigest
} from "./commitment";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { PaperTradingSessionService } from "./session-service";
import {
  PaperTradingComparisonCoordinator,
  type PreparePaperTradingComparisonInput,
  type VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";
import { PaperTradingComparisonTickCoordinator } from "./comparison-tick-coordinator";
import { PaperTradingComparisonActivationCoordinator } from
  "./comparison-activation-coordinator";
import { PaperTradingComparisonRuntimeActivationCoordinator } from
  "./comparison-runtime-activation-coordinator";
import { PaperTradingComparisonCheckpointCoordinator } from
  "./comparison-checkpoint-coordinator";
import { LocalStorePaperTradingComparisonWindowStateReader } from
  "./comparison-window-reader";
import { PaperTradingComparisonQualificationService } from
  "./comparison-qualification-service";
import { PaperTradingComparisonVerdictService } from
  "./comparison-verdict-service";
import { PaperTradingComparisonConfirmationCampaignService } from
  "./comparison-confirmation-campaign-service";
import { PaperTradingComparisonConfirmationWindowService } from
  "./comparison-confirmation-window-service";
import { PaperTradingComparisonResearchReleaseService } from
  "./comparison-research-release-service";
import { PaperTradingComparisonPromotionService } from
  "./comparison-promotion-service";

let tmpDir: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-07-10T00:00:00.000Z");
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-confirmation-integration-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe("paper comparison confirmation campaign integration", () => {
  it("runs precommitted LocalStore windows to mixed and confirmed restart-stable outcomes", async () => {
    const fixture = await integrationFixture(tmpDir);

    const mixedSourceGraph = await fixture.coordinator.prepare({
      ...fixture.input,
      idempotencyKey: "confirmation-integration-mixed-source"
    });
    const mixedSource = await fixture.runWindow(
      mixedSourceGraph,
      "mixed-source",
      true
    );
    expect(mixedSource.verdict_outcome).toBe("challenger_improved");
    fixture.setNowAfter(mixedSource.evaluated_at, 1_000);
    const mixedCampaign = await fixture.campaigns.precommit({
      sourceVerdictId: mixedSource.paper_trading_comparison_verdict_id
    });
    fixture.setNowAfter(mixedCampaign.committed_at, 1_000);
    expect(JSON.stringify(mixedCampaign.slots)).not.toContain(
      mixedSource.paper_trading_comparison_verdict_id
    );
    const effectsBeforeControl = structuredClone(fixture.effects);
    await expect(fixture.coordinator.prepare({
      ...fixture.input,
      idempotencyKey: "confirmation-integration-arbitrary-blocked"
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_active_campaign_pair_conflict"
    });
    expect(fixture.effects).toEqual(effectsBeforeControl);

    const mixedSlot1Graph = await fixture.windows.prepareNext({
      campaignId: mixedCampaign.paper_trading_comparison_confirmation_campaign_id
    });
    expect(fixture.effects).toEqual(effectsBeforeControl);
    const mixedSlot1 = await fixture.runWindow(mixedSlot1Graph, "mixed-slot-1", true);
    fixture.setNowAfter(mixedSlot1.evaluated_at, 1_000);
    const mixedSlot2Graph = await fixture.windows.prepareNext({
      campaignId: mixedCampaign.paper_trading_comparison_confirmation_campaign_id
    });
    const mixedSlot2 = await fixture.runWindow(mixedSlot2Graph, "mixed-slot-2", false);
    expect(mixedSlot2.verdict_outcome).toBe("challenger_not_improved");
    fixture.setNowAfter(mixedSlot2.evaluated_at, 1_000);
    const mixedOutcome = await fixture.campaigns.settle({
      campaignId: mixedCampaign.paper_trading_comparison_confirmation_campaign_id
    });
    expect(mixedOutcome).toMatchObject({
      campaign_outcome: "not_confirmed",
      improved_count: 1,
      not_improved_count: 1,
      promotion_eligibility: "not_eligible",
      release_status: "sealed",
      authority_status: "not_live"
    });
    expect(mixedOutcome.slot_results.map((result) => result.verdict_ref?.id))
      .not.toContain(mixedSource.paper_trading_comparison_verdict_id);
    const mixedPromotionSnapshot = await storeSnapshotWithoutPromotions(
      fixture.store.root()
    );
    const effectsBeforeMixedPromotion = structuredClone(fixture.effects);
    await expect(new PaperTradingComparisonPromotionService({
      store: fixture.store
    }).promote({
      candidateId: mixedCampaign.challenger.candidate_ref.id
    })).rejects.toMatchObject({
      code: "paper_trading_comparison_promotion_evidence_required"
    });
    expect(fixture.effects).toEqual(effectsBeforeMixedPromotion);
    expect(await storeSnapshotWithoutPromotions(fixture.store.root()))
      .toEqual(mixedPromotionSnapshot);
    await expect(fixture.store.getLatestTradingPromotion()).resolves.toBeUndefined();

    fixture.setNowAfter(mixedOutcome.evaluated_at, 1_000);
    const confirmedSourceGraph = await fixture.coordinator.prepare({
      ...fixture.input,
      idempotencyKey: "confirmation-integration-confirmed-source"
    });
    const confirmedSource = await fixture.runWindow(
      confirmedSourceGraph,
      "confirmed-source",
      true
    );
    fixture.setNowAfter(confirmedSource.evaluated_at, 1_000);
    const confirmedCampaign = await fixture.campaigns.precommit({
      sourceVerdictId: confirmedSource.paper_trading_comparison_verdict_id
    });
    fixture.setNowAfter(confirmedCampaign.committed_at, 1_000);
    const confirmedVerdicts = [];
    for (const [index, suffix] of ["confirmed-slot-1", "confirmed-slot-2"].entries()) {
      const graph = await fixture.windows.prepareNext({
        campaignId: confirmedCampaign.paper_trading_comparison_confirmation_campaign_id
      });
      const verdict = await fixture.runWindow(graph, suffix, true);
      confirmedVerdicts.push(verdict);
      fixture.setNowAfter(verdict.evaluated_at, 1_000);
      expect(verdict.paper_trading_comparison_commitment_ref.id).toBe(
        confirmedCampaign.slots[index]!.paper_trading_comparison_commitment_id
      );
    }
    const confirmedOutcome = await fixture.campaigns.settle({
      campaignId: confirmedCampaign.paper_trading_comparison_confirmation_campaign_id
    });
    expect(confirmedOutcome).toMatchObject({
      campaign_outcome: "confirmed_improvement",
      improved_count: 2,
      not_improved_count: 0,
      promotion_eligibility: "eligible",
      next_action: "review_for_trading_promotion",
      release_status: "sealed",
      authority_status: "not_live"
    });
    expect(confirmedOutcome.slot_results.map((result) => result.verdict_ref?.id))
      .toEqual(confirmedVerdicts.map((verdict) =>
        verdict.paper_trading_comparison_verdict_id));
    const findingsBeforeRelease = await fixture.store.listResearchFindings();
    const lineagesBeforeRelease = await fixture.store.listArtifactLineages();
    expect(findingsBeforeRelease).toContainEqual(fixture.challengerSourceFinding);
    expect(findingsBeforeRelease.some((finding) =>
      finding.research_finding_id.includes("research-release"))).toBe(false);
    expect(lineagesBeforeRelease).toEqual([fixture.challengerSourceLineage]);
    await expect(fixture.store.listPaperTradingComparisonResearchReleases())
      .resolves.toEqual([]);
    await expect(fixture.store.getLatestTradingPromotion()).resolves.toBeUndefined();

    fixture.setNowAfter(confirmedOutcome.evaluated_at, 1);
    const release = await fixture.releases.release({
      campaignOutcomeId:
        confirmedOutcome.paper_trading_comparison_confirmation_campaign_outcome_id
    });
    expect(release).toMatchObject({
      release_kind: "confirmed_improvement",
      direction_kind: "mean_reversion",
      candidate_ref: confirmedCampaign.challenger.candidate_ref,
      finding: {
        finding_kind: "positive_result",
        authority_status: "research_trace_only"
      },
      lineage: {
        child_system_code_ref:
          fixture.challengerSourceLineage.child_system_code_ref,
        parent_system_code_ref:
          fixture.challengerSourceLineage.parent_system_code_ref,
        authority_status: "lineage_only"
      },
      research_visibility: "released_to_research",
      promotion_authority: false,
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "lineage_only"
    });
    expect(release.finding.supporting_record_refs).toEqual([
      {
        record_kind: "research_finding",
        id: fixture.challengerSourceFinding.research_finding_id
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: confirmedCampaign.paper_trading_comparison_confirmation_campaign_id
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: confirmedOutcome.paper_trading_comparison_confirmation_campaign_outcome_id
      },
      ...confirmedVerdicts.map((verdict) => ({
        record_kind: "paper_trading_comparison_verdict",
        id: verdict.paper_trading_comparison_verdict_id
      }))
    ]);
    expect(release.finding.supporting_record_refs.map((ref) => ref.id))
      .not.toContain(confirmedSource.paper_trading_comparison_verdict_id);
    expect(release.lineage.source_finding_refs).toEqual([
      ...fixture.challengerSourceLineage.source_finding_refs,
      { record_kind: "research_finding", id: release.finding.research_finding_id }
    ]);
    expect((await fixture.store.listResearchFindings()).filter((finding) =>
      finding.research_finding_id === release.finding.research_finding_id
    )).toEqual([release.finding]);
    expect((await fixture.store.listArtifactLineages()).filter((lineage) =>
      lineage.artifact_lineage_id === release.lineage.artifact_lineage_id
    )).toEqual([release.lineage]);
    await expect(fixture.store.getLatestTradingPromotion()).resolves.toBeUndefined();

    const effectsBeforePromotion = structuredClone(fixture.effects);
    const storeBeforePromotion = await storeSnapshotWithoutPromotions(
      fixture.store.root()
    );
    const promotion = await new PaperTradingComparisonPromotionService({
      store: fixture.store,
      now: () => new Date(Date.parse(release.released_at) + 1).toISOString()
    }).promote({
      candidateId: confirmedCampaign.challenger.candidate_ref.id
    });
    const finalVerdict = confirmedVerdicts.at(-1)!;
    expect(promotion).toMatchObject({
      candidate_ref: confirmedCampaign.challenger.candidate_ref,
      candidate_version_ref: confirmedCampaign.challenger.candidate_version_ref,
      paper_trading_evaluation_ref:
        finalVerdict.challenger.paper_trading_evaluation_ref,
      comparison_confirmation: {
        campaign_ref: {
          id: confirmedCampaign
            .paper_trading_comparison_confirmation_campaign_id
        },
        campaign_outcome_ref: {
          id: confirmedOutcome
            .paper_trading_comparison_confirmation_campaign_outcome_id
        },
        final_verdict_ref: {
          id: finalVerdict.paper_trading_comparison_verdict_id
        }
      },
      authority_status: "not_live"
    });
    expect(fixture.effects).toEqual(effectsBeforePromotion);
    expect(await storeSnapshotWithoutPromotions(fixture.store.root()))
      .toEqual(storeBeforePromotion);
    await expect(promotionRecordFileNames(fixture.store.root())).resolves
      .toEqual([
        encodeURIComponent(promotion.trading_promotion_id) + ".json"
      ]);
    await expect(fixture.store.getLatestTradingPromotion()).resolves.toEqual(
      promotion
    );
    await expect(new PaperTradingComparisonPromotionService({
      store: fixture.store,
      now: () => new Date(Date.parse(promotion.promoted_at) + 86_400_000)
        .toISOString()
    }).promote({
      candidateId: confirmedCampaign.challenger.candidate_ref.id
    })).resolves.toEqual(promotion);
    await expect(promotionRecordFileNames(fixture.store.root())).resolves
      .toEqual([
        encodeURIComponent(promotion.trading_promotion_id) + ".json"
      ]);

    fixture.setNowAfter(release.released_at, 24 * 60 * 60_000);
    await expect(fixture.releases.release({
      campaignOutcomeId:
        confirmedOutcome.paper_trading_comparison_confirmation_campaign_outcome_id
    })).resolves.toEqual(release);
    await expect(fixture.store.listPaperTradingComparisonResearchReleases())
      .resolves.toEqual([release]);

    const restartedStore = new LocalStore(fixture.store.root());
    await restartedStore.initialize();
    const replay = await new PaperTradingComparisonConfirmationCampaignService({
      store: restartedStore,
      now: () => new Date(
        Date.parse(confirmedOutcome.evaluated_at) + 24 * 60 * 60_000
      ).toISOString()
    }).settle({
      campaignId: confirmedCampaign.paper_trading_comparison_confirmation_campaign_id
    });
    expect(replay).toEqual(confirmedOutcome);
    await expect(restartedStore.listPaperTradingComparisonConfirmationCampaignOutcomes())
      .resolves.toEqual([mixedOutcome, confirmedOutcome]);
    await expect(restartedStore.recoverPaperTradingComparisonResearchReleases())
      .resolves.toEqual([release]);
    await expect(new PaperTradingComparisonResearchReleaseService({
      store: restartedStore,
      now: () => new Date(
        Date.parse(release.released_at) + 48 * 60 * 60_000
      ).toISOString()
    }).release({
      campaignOutcomeId:
        confirmedOutcome.paper_trading_comparison_confirmation_campaign_outcome_id
    })).resolves.toEqual(release);
    await expect(new PaperTradingComparisonPromotionService({
      store: restartedStore,
      now: () => new Date(Date.parse(promotion.promoted_at) + 48 * 60 * 60_000)
        .toISOString()
    }).promote({
      candidateId: confirmedCampaign.challenger.candidate_ref.id
    })).resolves.toEqual(promotion);
    expect((await restartedStore.listResearchFindings()).filter((finding) =>
      finding.research_finding_id === release.finding.research_finding_id
    )).toEqual([release.finding]);
    expect((await restartedStore.listArtifactLineages()).filter((lineage) =>
      lineage.artifact_lineage_id === release.lineage.artifact_lineage_id
    )).toEqual([release.lineage]);
    await expect(restartedStore.getLatestTradingPromotion()).resolves.toEqual(
      promotion
    );
    const challengeCommittedAt = new Date(
      Date.parse(promotion.promoted_at) + 72 * 60 * 60_000
    ).toISOString();
    vi.setSystemTime(challengeCommittedAt);
    const challenge = await new PaperTradingComparisonCoordinator({
      store: restartedStore,
      sessions: fixture.sessions,
      now: () => challengeCommittedAt
    }).prepare({
      ...fixture.input,
      idempotencyKey: "confirmation-integration-restarted-champion-challenge",
      champion: fixture.input.challenger,
      challenger: fixture.input.champion,
      comparisonPolicy: {
        ...fixture.input.comparisonPolicy,
        comparison_mode: "champion_challenge"
      }
    });
    expect(challenge.preparation.champion_selection).toMatchObject({
      selection_kind: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: promotion.trading_promotion_id
      },
      trading_promotion_digest: digest(
        paperTradingComparisonTradingPromotionDigestInput(promotion)
      ),
      paper_trading_evaluation_ref:
        promotion.paper_trading_evaluation_ref
    });
  }, 60_000);
});

async function integrationFixture(root: string) {
  const store = new LocalStore(root);
  await store.initialize();
  const champion = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!champion) throw new Error("missing integration champion");
  const challengerCode = challengerSystemCode();
  await store.recordSystemCode(challengerCode);
  const challengerOutcome = await store.materializeCandidate(
    challengerMaterializationInput(challengerCode, champion)
  );
  if (challengerOutcome.status !== "materialized") {
    throw new Error("integration challenger did not materialize");
  }
  const challenger = challengerOutcome.candidate;
  const championAdmission = await recordAdmission(store, champion, "champion");
  const championSystemCodeId = champion.system_code?.ref?.id;
  if (!championSystemCodeId) throw new Error("missing champion source SystemCode");
  const challengerAdmission = await recordAdmission(
    store,
    challenger,
    "challenger",
    championSystemCodeId
  );
  const challengerSourceFinding = (await store.listResearchFindings()).find((finding) =>
    finding.research_finding_id === challengerAdmission.research_finding_ref.id
  );
  if (!challengerSourceFinding) {
    throw new Error("missing challenger source Finding");
  }
  const challengerSourceLineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "lineage-confirmation-challenger-origin",
    child_system_code_ref: { ...challengerAdmission.system_code_ref },
    parent_system_code_ref: { ...challengerAdmission.source_system_code_ref },
    source_finding_refs: [{ ...challengerAdmission.research_finding_ref }],
    created_by_research_worker_ref: {
      ...challengerSourceFinding.research_worker_ref
    },
    created_at: challengerSourceFinding.created_at,
    authority_status: "lineage_only"
  };
  await store.recordArtifactLineage(challengerSourceLineage);
  const effects = {
    providerStarts: 0,
    providerCloses: 0,
    sandboxStarts: 0,
    sandboxStops: 0,
    sandboxLogReads: 0,
    marketReads: 0
  };
  let now = "2026-07-10T00:00:00.000Z";
  const setNow = (value: string) => {
    now = value;
    vi.setSystemTime(value);
  };
  const setNowAfter = (value: string, elapsedMs: number) => {
    setNow(new Date(Date.parse(value) + elapsedMs).toISOString());
  };
  const baseMarketData: GatewayMarketDataPort = {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [
      "GET /fapi/v1/exchangeInfo",
      "GET /fapi/v1/premiumIndex"
    ],
    authority_status: "read_only",
    async readMarketSnapshot() {
      effects.marketReads += 1;
      throw new Error("unexpected unsealed market read");
    },
    async readPublicMarketLivenessSurface() {
      effects.marketReads += 1;
      throw new Error("unexpected liveness read");
    },
    async readPublicExecutionSnapshot() {
      effects.marketReads += 1;
      throw new Error("unexpected unsealed execution read");
    }
  };
  const providerByRun = new Map<string, string>();
  const providers = new Map<string, {
    binding: GatewayRuntimeBinding;
    hooks?: PaperTradingApiProviderComparisonTickHooks;
    requestCount: number;
  }>();
  const profitableRuns = new Set<string>();
  const emittedRuns = new Set<string>();
  const eventAtByRun = new Map<string, string>();
  const sessions = new PaperTradingSessionService({
    store,
    startEligibility: async () => undefined,
    intervalMs: 60_000,
    runner: new PaperTradingEvaluationRunner(),
    marketData: baseMarketData,
    artifactResolver: {
      async resolveArtifactDigest(systemCode) {
        return `sha256:resolved-${systemCode.system_code_id}`;
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance(input: SandboxStartInput) {
          effects.sandboxStarts += 1;
          const runId = input.runtime_ref?.id;
          const providerBaseUrl = input.env?.TRADING_API_BASE_URL;
          if (runId && providerBaseUrl) providerByRun.set(runId, providerBaseUrl);
          return sandboxStart(input);
        },
        async getArtifactInstanceLogs(
          instance: SandboxRecord | SandboxDetailReadModel
        ) {
          effects.sandboxLogReads += 1;
          const runId = instance.runtime_ref?.id;
          if (!runId || !profitableRuns.has(runId) || emittedRuns.has(runId)) {
            return { lifecycle_status: "running" as const, logs: [] };
          }
          emittedRuns.add(runId);
          const eventAt = eventAtByRun.get(runId) ?? now;
          return {
            lifecycle_status: "running" as const,
            logs: [{
              record_kind: "sandbox_log" as const,
              version: 1 as const,
              sandbox_log_id: `${instance.sandbox_id}-order-log`,
              sandbox_ref: { record_kind: "sandbox", id: instance.sandbox_id },
              lines: [orderEventLine(instance.sandbox_id, runId, eventAt)],
              captured_at: now,
              authority_status: "trace_only" as const
            }]
          };
        },
        async stopArtifactInstance() {
          effects.sandboxStops += 1;
          return { lifecycle_status: "stopped" as const, stopped_at: now };
        }
      }
    } as never,
    async apiProviderFactory(binding, providerOptions) {
      effects.providerStarts += 1;
      const baseUrl = `http://confirmation-provider-${effects.providerStarts}.test`;
      const state = {
        binding,
        hooks: providerOptions.comparison_tick_hooks,
        requestCount: 1
      };
      providers.set(baseUrl, state);
      return {
        base_url: baseUrl,
        async close() { effects.providerCloses += 1; },
        requests: () => [{
          at: now,
          method: "GET",
          path: "/market/snapshot",
          response_status: 200
        }],
        request_count: () => state.requestCount,
        candidate_input: {} as never
      };
    }
  });
  const policy: PaperTradingComparisonPolicy = {
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
    maximum_retry_count_per_side: 2,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 0.01,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  };
  const coordinator = new PaperTradingComparisonCoordinator({
    store,
    sessions,
    now: () => now
  });
  const input: PreparePaperTradingComparisonInput = {
    idempotencyKey: "replaced-by-test",
    champion: {
      candidateId: champion.candidate_id,
      candidateVersionId: champion.candidate_version.candidate_version_id,
      admissionDecisionId: championAdmission.candidate_admission_decision_id
    },
    challenger: {
      candidateId: challenger.candidate_id,
      candidateVersionId: challenger.candidate_version.candidate_version_id,
      admissionDecisionId: challengerAdmission.candidate_admission_decision_id
    },
    comparisonPolicy: policy,
    marketDataConfigurationDigest: paperTradingMarketDataConfigurationDigest(
      baseMarketData
    ),
    paperPolicyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1
  };
  const campaigns = new PaperTradingComparisonConfirmationCampaignService({
    store,
    now: () => now
  });
  const windows = new PaperTradingComparisonConfirmationWindowService({
    store,
    comparisons: coordinator,
    now: () => now
  });
  const releases = new PaperTradingComparisonResearchReleaseService({
    store,
    now: () => now
  });

  const runWindow = async (
    graph: VerifiedPaperTradingComparisonCommitmentGraph,
    suffix: string,
    profitable: boolean
  ) => {
    if (profitable) profitableRuns.add(graph.challenger.run.trading_run_id);
    const firstObservedAt = new Date(Date.parse(graph.commitment.committed_at) + 1_000)
      .toISOString();
    eventAtByRun.set(graph.challenger.run.trading_run_id, firstObservedAt);
    setNow(firstObservedAt);
    const firstTick = await new PaperTradingComparisonTickCoordinator({
      store,
      comparisons: coordinator,
      marketData: tickMarketData(effects, firstObservedAt, 60_000, false),
      now: () => now
    }).captureFirstTick({
      comparisonId: graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: `${suffix}-first-tick`
    });
    setNowAfter(firstObservedAt, 1_000);
    const activation = await new PaperTradingComparisonActivationCoordinator({
      store,
      comparisons: coordinator,
      now: () => now
    }).authorize({
      comparisonId: graph.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: `${suffix}-activation`
    });
    setNowAfter(now, 1_000);
    const runtime = new PaperTradingComparisonRuntimeActivationCoordinator({
      store,
      sessions,
      marketData: baseMarketData,
      now: () => now
    });
    const started = await runtime.start({
      activationId: activation.activation.paper_trading_comparison_activation_id,
      idempotencyKey: `${suffix}-runtime`
    });
    if (started.status !== "both_running") {
      throw new Error(`${suffix} runtime did not start symmetrically`);
    }
    setNowAfter(now, 1_000);
    const checkpoints = new PaperTradingComparisonCheckpointCoordinator({
      store,
      sessions,
      activations: runtime,
      now: () => now
    });
    const firstCheckpoint = await checkpoints.captureFirst({
      activationId: activation.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        started.attempt.paper_trading_comparison_activation_attempt_id,
      idempotencyKey: `${suffix}-checkpoint-1`
    });
    for (const role of ["champion", "challenger"] as const) {
      await sessions.enableComparisonTickAttributionSide({
        side: activation.activation[role],
        authority: attributionAuthority(started.attempt, role, firstTick.tick),
        tick: firstTick.tick
      });
    }
    const firstDeliveryAt = new Date(Date.parse(firstCheckpoint.completed_at) + 1)
      .toISOString();
    await Promise.all((["champion", "challenger"] as const).map((role) =>
      serveAndAcknowledge(
        providers,
        providerByRun,
        activation.activation[role].trading_run_ref.id,
        firstDeliveryAt
      )));
    const acknowledgements = await store
      .listPaperTradingComparisonTickAcknowledgements(
        started.attempt.paper_trading_comparison_activation_attempt_id
      );
    const secondObservedAt = new Date(Math.max(
      Date.parse(firstObservedAt) + policy.interval_ms,
      Date.parse(started.attempt.attempted_at) + policy.minimum_elapsed_ms,
      ...acknowledgements.map((record) => Date.parse(record.acknowledged_at) + 1)
    )).toISOString();
    setNow(secondObservedAt);
    const secondTick = await new PaperTradingComparisonTickCoordinator({
      store,
      comparisons: coordinator,
      marketData: tickMarketData(effects, secondObservedAt, 60_100, true),
      activations: runtime,
      now: () => now
    }).captureNextTick({
      activationId: activation.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        started.attempt.paper_trading_comparison_activation_attempt_id,
      idempotencyKey: `${suffix}-tick-2`
    });
    setNowAfter(secondObservedAt, 1_000);
    const secondAttempt = await checkpoints.beginNext({
      activationId: activation.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        started.attempt.paper_trading_comparison_activation_attempt_id,
      tickId: secondTick.tick.paper_trading_comparison_tick_id,
      idempotencyKey: `${suffix}-checkpoint-2`
    });
    const secondDeliveryAt = new Date(Date.parse(secondAttempt.attempted_at) + 1)
      .toISOString();
    await Promise.all((["champion", "challenger"] as const).map((role) =>
      serveAndAcknowledge(
        providers,
        providerByRun,
        activation.activation[role].trading_run_ref.id,
        secondDeliveryAt
      )));
    await checkpoints.completeNext({
      checkpointAttemptId:
        secondAttempt.paper_trading_comparison_checkpoint_attempt_id
    });
    setNowAfter(now, 2_000);
    const stopped = await runtime.stopOwnedAttempt({
      attemptId: started.attempt.paper_trading_comparison_activation_attempt_id,
      reason: "handoff_cleanup"
    });
    if (stopped.status !== "stopped_cleanly") {
      throw new Error(`${suffix} runtime did not stop cleanly`);
    }
    setNowAfter(now, 1_000);
    const windowReader = new LocalStorePaperTradingComparisonWindowStateReader({
      store,
      activations: runtime,
      now: () => now
    });
    const qualifications = new PaperTradingComparisonQualificationService({
      store,
      windowReader
    });
    const verdict = await new PaperTradingComparisonVerdictService({
      store,
      qualifications,
      now: () => now
    }).evaluate({
      activationId: activation.activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        started.attempt.paper_trading_comparison_activation_attempt_id
    });
    if (profitable && verdict.verdict_outcome !== "challenger_improved") {
      throw new Error(`${suffix} challenger did not improve`);
    }
    if (!profitable && verdict.verdict_outcome !== "challenger_not_improved") {
      throw new Error(`${suffix} silence did not remain non-improving`);
    }
    return verdict;
  };

  return {
    store,
    sessions,
    coordinator,
    campaigns,
    windows,
    releases,
    challengerSourceFinding,
    challengerSourceLineage,
    input,
    effects,
    runWindow,
    setNowAfter
  };
}

async function storeSnapshotWithoutPromotions(
  root: string
): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};
  const visit = async (relativePath: string): Promise<void> => {
    const entries = await readdir(path.join(root, relativePath), {
      withFileTypes: true
    });
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name))) {
      const child = path.join(relativePath, entry.name);
      if (child === "trading-promotions" ||
        child.startsWith(`trading-promotions${path.sep}`)) {
        continue;
      }
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.isFile()) {
        snapshot[child] = await readFile(path.join(root, child), "utf8");
      }
    }
  };
  await visit("");
  return snapshot;
}

async function promotionRecordFileNames(root: string): Promise<string[]> {
  return (await readdir(path.join(root, "trading-promotions/items")))
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function digest(value: string): string {
  return "sha256:" + createHash("sha256").update(value).digest("hex");
}

function tickMarketData(
  effects: { marketReads: number },
  observedAt: string,
  price: number,
  includeFill: boolean
): GatewayMarketDataPort {
  const marketObservedAt = new Date(Date.parse(observedAt) - 2).toISOString();
  const executionObservedAt = new Date(Date.parse(observedAt) - 1).toISOString();
  return {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: [
      "GET /fapi/v1/exchangeInfo",
      "GET /fapi/v1/premiumIndex"
    ],
    authority_status: "read_only",
    async readMarketSnapshot() {
      effects.marketReads += 1;
      return {
        symbol: "BTCUSDT",
        price,
        moving_average_fast: price + 100,
        moving_average_slow: price - 100,
        volatility: 0.01,
        expected_direction: "long" as const,
        observed_at: marketObservedAt,
        source_kind: "binance_production_public_rest" as const,
        source_priority: "rest_fallback" as const,
        freshness: "fresh" as const,
        ws_connected: false,
        rest_fallback_used: true,
        gap_detected: false
      };
    },
    async readPublicMarketLivenessSurface() {
      throw new Error("liveness is not required for a sealed comparison tick");
    },
    async readPublicExecutionSnapshot() {
      effects.marketReads += 1;
      return {
        symbol: "BTCUSDT",
        observed_at: executionObservedAt,
        source_kind: "binance_production_public_rest" as const,
        source_priority: "rest_fallback" as const,
        freshness: "fresh" as const,
        ws_connected: false,
        rest_fallback_used: true,
        gap_detected: false,
        stream_marker: `confirmation-${observedAt}`,
        agg_trades: includeFill ? [{
          trade_id: `aggTrade:${observedAt}`,
          price: "60000",
          quantity: "0.001",
          trade_time: executionObservedAt,
          is_buyer_maker: false
        }] : [],
        authority_status: "read_only" as const
      };
    }
  };
}

async function serveAndAcknowledge(
  providers: Map<string, {
    binding: GatewayRuntimeBinding;
    hooks?: PaperTradingApiProviderComparisonTickHooks;
    requestCount: number;
  }>,
  providerByRun: Map<string, string>,
  runId: string,
  deliveredAt: string
) {
  const baseUrl = providerByRun.get(runId);
  const provider = baseUrl ? providers.get(baseUrl) : undefined;
  if (!provider?.hooks) throw new Error(`missing provider hooks for ${runId}`);
  provider.requestCount += 1;
  const market = await provider.binding.marketData.readMarketSnapshot();
  const context = await provider.hooks.deliver({
    market,
    provider_request_count: provider.requestCount,
    delivered_at: deliveredAt
  });
  if (!context) throw new Error(`provider omitted context for ${runId}`);
  provider.requestCount += 1;
  return provider.hooks.acknowledge({
    context,
    provider_request_count: provider.requestCount,
    acknowledged_at: new Date(Date.parse(deliveredAt) + 1).toISOString()
  });
}

function attributionAuthority(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  tick: PaperTradingComparisonTickRecord
) {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    role,
    trading_run_ref: { ...attempt[role].trading_run_ref },
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    tick_digest: tick.tick_digest,
    operation: "deliver_market_snapshot" as const
  };
}

function sandboxStart(input: SandboxStartInput) {
  return {
    placement: {
      record_kind: "sandbox_placement" as const,
      version: 1 as const,
      sandbox_placement_id: input.sandbox_placement_id,
      placement_kind: "fixture_local_placeholder" as const,
      authority_status: "not_launched" as const
    },
    instance: {
      record_kind: "sandbox" as const,
      version: 1 as const,
      sandbox_id: input.instance_id,
      adapter_kind: "deterministic_test" as const,
      system_code_ref: { record_kind: "system_code", id: input.artifact.system_code_id },
      runtime_ref: input.runtime_ref,
      sandbox_placement_ref: {
        record_kind: "sandbox_placement",
        id: input.sandbox_placement_id
      },
      lifecycle_status: "running" as const,
      sandbox_name: input.sandbox_name,
      created_at: input.created_at,
      started_at: input.created_at,
      log_refs: [],
      heartbeat_refs: [],
      command_evidence_refs: [],
      authority_status: "not_live" as const
    },
    logs: [],
    heartbeats: [],
    command_evidence: []
  };
}

function orderEventLine(instanceId: string, runId: string, at: string): string {
  return JSON.stringify({
    event: "order_request",
    event_id: `confirmation-order-${runId}`,
    instance_id: instanceId,
    at,
    authority_status: "trace_only",
    intent_kind: "place_order",
    symbol: "BTCUSDT",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    reason: "confirmation challenger first checkpoint order"
  });
}

async function recordAdmission(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: "champion" | "challenger",
  sourceSystemCodeId?: string
): Promise<CandidateAdmissionDecisionRecord> {
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) throw new Error(`missing ${suffix} SystemCode`);
  const existingSourceSystemCode = sourceSystemCodeId
    ? await store.getSystemCode(sourceSystemCodeId)
    : undefined;
  const sourceSystemCode: SystemCodeRecord = existingSourceSystemCode ?? {
    ...systemCode,
    system_code_id: `system-code-confirmation-source-${suffix}`,
    artifact_digest: `sha256:confirmation-source-${suffix}`,
    provenance_refs: [],
    created_at: "2026-07-09T20:51:00.000Z"
  };
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-confirmation-${suffix}`,
    research_worker_ref: { record_kind: "research_worker", id: `worker-${suffix}` },
    research_direction_ref: { record_kind: "research_direction", id: `direction-${suffix}` },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: `evaluation-task-${suffix}`
    },
    trace_ref: { record_kind: "trace_placeholder", id: `trace-${suffix}` },
    submitted_at: "2026-07-09T20:52:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `evaluation-confirmation-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: { record_kind: "external_evaluator", id: "confirmation-evaluator" },
    result_status: "accepted",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: 0.7,
      oos_score: 0.7,
      drawdown_score: 0.7,
      turnover_score: 0.7,
      cost_survival_score: 0.7,
      reproducibility_score: 0.7,
      complexity_penalty: 0
    },
    metric_refs: [{ record_kind: "metric_snapshot", id: `metric-${suffix}` }],
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: `evaluator-trace-${suffix}`
    },
    completed_at: "2026-07-09T20:53:00.000Z",
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `finding-confirmation-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "External admission evidence for confirmation integration.",
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    }],
    created_at: "2026-07-09T20:54:00.000Z",
    authority_status: "research_trace_only"
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `admission-confirmation-${suffix}`,
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: { ...finding.trading_evaluation_result_ref },
    research_finding_ref: { record_kind: "research_finding", id: finding.research_finding_id },
    source_artifact_digest: sourceSystemCode.artifact_digest,
    submitted_artifact_digest: systemCode.artifact_digest,
    research_worker_outcome: "changed",
    experiment_status: "evaluated",
    evaluation_status: "accepted",
    evidence_disposition: "not_counted",
    status: "admitted",
    reason: "evaluation_accepted",
    runnable_paper_handoff: true,
    decided_at: suffix === "champion"
      ? "2026-07-09T20:55:00.000Z"
      : "2026-07-09T20:56:00.000Z",
    authority_status: "not_live"
  };
  if (!existingSourceSystemCode) await store.recordSystemCode(sourceSystemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  await store.recordCandidateAdmissionDecision(admission);
  return admission;
}

function challengerSystemCode(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-confirmation-challenger",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:confirmation-challenger",
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: [
        "program_event",
        "runtime_log",
        "runtime_heartbeat",
        "metric_snapshot"
      ]
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "capability-policy-clock-fixture-v1"
    },
    provenance_refs: [{ record_kind: "research_finding", id: "confirmation-seed" }],
    status: "registered",
    created_at: "2026-07-09T20:50:00.000Z",
    authority_status: "not_live"
  };
}

function challengerMaterializationInput(
  systemCode: SystemCodeRecord,
  source: CandidateInspectReadModel
): CandidateMaterializationInput {
  const sourceSystemCodeRef = source.system_code?.ref;
  if (!sourceSystemCodeRef?.record_kind || !sourceSystemCodeRef.id) {
    throw new Error("missing challenger full-cycle source SystemCode");
  }
  return {
    idempotency_key: "confirmation-integration-challenger",
    provider: {
      provider_kind: "fixture_only",
      model: "confirmation-fixture",
      invocation_surface: "vitest",
      agent_run_id: "agent-run-confirmation",
      agent_event_id: "agent-event-confirmation",
      trace_id: "trace-confirmation",
      output_artifact_hash: "sha256:confirmation-output"
    },
    candidate: {
      title: "Confirmation campaign challenger",
      system_summary: "Candidate for prospective confirmation windows.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Trade BTCUSDT through paper-only Gateway authority.",
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: "Emit bounded TradingSystem paper events.",
      declared_runtime: "python-sandbox-fixture",
      declared_outputs: ["OrderRequest", "ProgramEvent", "Trace"]
    },
    capability_package: {
      summary: "Read-only public market context for paper evaluation.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: [
        "exchange_credentials",
        "evaluator_hidden_labels",
        "live_order_authority"
      ]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "confirmation-output" }],
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    full_cycle_lineage: {
      source: {
        trading_system_id: source.candidate_id,
        candidate_version_id: source.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: sourceSystemCodeRef.record_kind,
          id: sourceSystemCodeRef.id
        }
      },
      generated: {
        system_code_ref: {
          record_kind: "system_code",
          id: systemCode.system_code_id
        },
        artifact_digest: systemCode.artifact_digest,
        generated_by_agent: true
      },
      evaluation: {
        status: "accepted",
        score: 0.7,
        direction_kind: "mean_reversion"
      }
    }
  };
}
