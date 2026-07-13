import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ResearchControlCampaignService,
  type ResearchControlCampaignPaperEvaluationProtocolInput
} from "@ouroboros/application/candidate/research-control-campaign";
import { researchControlStudyConditionFromCampaign } from
  "@ouroboros/application/candidate/research-control-study";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import { PaperTradingComparisonCoordinator } from
  "@ouroboros/application/trading/paper/comparison-coordinator";
import type {
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignRecord,
  ResearchControlCampaignReportRecord,
  TradingPromotionRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";
import {
  captureResearchControlCampaignSnapshot,
  prepareResearchControlCampaignCommitRequest,
  type CollectResearchControlCampaignOutcomeResult,
  type RunResearchControlCampaignOutcome
} from "../src/candidate/arena/research-control-campaign";
import {
  commitResearchControlStudyRuntime,
  createResearchControlStudyRuntime,
  runResearchControlCampaignToOutcome,
  ResearchControlStudyRuntimeError
} from "../src/candidate/arena/research-control-study-runtime";
import type { ResearchControlCampaignPaperRuntimeArmSessions } from
  "../src/candidate/arena/research-control-campaign-paper-runtime-arm";

describe("ResearchControlStudy runtime commitment", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "ouroboros-study-runtime-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("commits one exact study before creating any planned campaign", async () => {
    const store = new TradingReviewStudyStore(path.join(root, "store"));
    await store.initialize();
    const before = await captureResearchControlCampaignSnapshot({
      root: store.root(),
      maximumRegularFileCount: 10_000,
      maximumTotalBytes: 1_000_000_000
    });
    const replicationKeys = studyReplicationKeys();
    const input = studyCommitInput(store, replicationKeys);

    const study = await commitResearchControlStudyRuntime(input);

    expect(study).toMatchObject({
      baseline_snapshot_digest: before.snapshot_digest,
      baseline_policy: "same_frozen_snapshot",
      authority_status: "research_only",
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false
    });
    expect(study.replications.map((replication) =>
      replication.campaign_idempotency_key
    )).toEqual(replicationKeys);
    expect(await store.listResearchControlCampaigns()).toEqual([]);
    expect(await store.listResearchControlStudies()).toEqual([study]);
    await expect(commitResearchControlStudyRuntime(input)).resolves.toEqual(study);

    const prepared = await prepareResearchControlCampaignCommitRequest({
      store,
      idempotencyKey: replicationKeys[0]!,
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
      paperEvaluationProtocol: boundPaperEvaluationProtocol(),
      tickCountPerArm: 1
    });
    const campaign = await new ResearchControlCampaignService({
      store,
      now: () => "2026-07-12T10:00:00.000Z"
    }).commit(prepared.request);

    expect(campaign.baseline.snapshot_digest).toBe(
      study.baseline_snapshot_digest
    );
    expect(researchControlStudyConditionFromCampaign(campaign)).toEqual(
      study.condition
    );
  });

  it("rejects a study without a bound Trading review condition", async () => {
    const store = new LocalStore(path.join(root, "no-comparator"));
    await store.initialize();

    await expect(commitResearchControlStudyRuntime(studyCommitInput(
      store,
      studyReplicationKeys()
    ))).rejects.toMatchObject({
      name: "ResearchControlStudyRuntimeError",
      code: "research_control_study_runtime_condition_invalid"
    });
  });

  it.each([5, 31])("rejects a %i-replication runtime study", async (count) => {
    const store = new TradingReviewStudyStore(path.join(root, `count-${count}`));
    await store.initialize();
    const keys = Array.from({ length: count }, (_, index) =>
      `runtime-study-replication-${index + 1}`
    );

    await expect(commitResearchControlStudyRuntime(
      studyCommitInput(store, keys)
    )).rejects.toBeInstanceOf(ResearchControlStudyRuntimeError);
  });

  it("rejects commitment after one planned campaign already exists", async () => {
    const store = new TradingReviewStudyStore(path.join(root, "late-study"));
    await store.initialize();
    const replicationKeys = studyReplicationKeys();
    const prepared = await prepareResearchControlCampaignCommitRequest({
      store,
      idempotencyKey: replicationKeys[0]!,
      sourceCandidateId: FIXTURE_CANDIDATE_ID,
      researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
      paperEvaluationProtocol: boundPaperEvaluationProtocol(),
      tickCountPerArm: 1
    });
    await new ResearchControlCampaignService({
      store,
      now: () => "2026-07-12T09:30:00.000Z"
    }).commit(prepared.request);

    await expect(commitResearchControlStudyRuntime(studyCommitInput(
      store,
      replicationKeys
    ))).rejects.toMatchObject({
      code: "research_control_study_campaign_already_exists"
    });
  });
});

describe("ResearchControlCampaign to outcome runtime", () => {
  it("assembles the canonical internal study executor and runner", () => {
    const configured = campaignToOutcomeInput([]);
    const { store, idempotencyKey: _idempotencyKey, ...campaign } = configured;

    const runtime = createResearchControlStudyRuntime({ store, campaign });

    expect(runtime.executor.advance).toBeTypeOf("function");
    expect(runtime.runner.start).toBeTypeOf("function");
    expect(runtime.runner.status()).toEqual({ status: "idle" });
  });

  it("drives one research campaign through paper completion and exact collection", async () => {
    const calls: string[] = [];
    const fixture = campaignToOutcomeFixture();
    let runnerStatus: object = { status: "idle" };

    const result = await runResearchControlCampaignToOutcome(
      campaignToOutcomeInput(calls),
      {
        runCampaign: async () => {
          calls.push("run_campaign");
          return fixture.run;
        },
        createPaperRuntime: (input) => {
          calls.push(`compose:${Object.keys(input.arms).join(",")}`);
          return {
            runner: {
              start({ campaignId }) {
                calls.push(`start:${campaignId}`);
                runnerStatus = { status: "running", campaignId };
              },
              async drain() {
                calls.push("drain");
                runnerStatus = {
                  status: "completed",
                  latestStep: { status: "complete", action: "complete" }
                };
              },
              status() { return runnerStatus as never; }
            }
          };
        },
        collectOutcome: async () => {
          calls.push("collect");
          return fixture.collected;
        }
      }
    );

    expect(result).toEqual(fixture.collected);
    expect(calls).toEqual([
      "run_campaign",
      `open:adaptive_treatment:${fixture.run.armRoots.adaptive_treatment}`,
      `open:static_control:${fixture.run.armRoots.static_control}`,
      "compose:adaptive_treatment,static_control",
      `start:${fixture.run.campaign.research_control_campaign_id}`,
      "drain",
      "collect"
    ]);
  });

  it("opens root-specific stores and composes real runtime arms by default", async () => {
    const root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-study-arm-composition-"
    ));
    try {
      const calls: string[] = [];
      const fixture = campaignToOutcomeFixture();
      fixture.run.armRoots.adaptive_treatment = path.join(root, "adaptive");
      fixture.run.armRoots.static_control = path.join(root, "control");
      const configured = campaignToOutcomeInput(calls);
      const { openArm: _openArm, ...withoutArm } = configured;
      let runnerStatus: object = { status: "idle" };

      const result = await runResearchControlCampaignToOutcome({
        ...withoutArm,
        openArmStore({ root: armRoot, armKind }) {
          calls.push(`store:${armKind}:${armRoot}`);
          return new LocalStore(armRoot);
        },
        createArmSessions({ store, armKind }) {
          calls.push(`sessions:${armKind}:${store.root()}`);
          return {} as ResearchControlCampaignPaperRuntimeArmSessions;
        }
      }, {
        runCampaign: async () => fixture.run,
        createPaperRuntime: (input) => {
          expect(input.arms.adaptive_treatment.comparisons).toBeInstanceOf(
            PaperTradingComparisonCoordinator
          );
          expect(input.arms.static_control.comparisons).toBeInstanceOf(
            PaperTradingComparisonCoordinator
          );
          expect(input.arms.adaptive_treatment.store.root()).toBe(
            fixture.run.armRoots.adaptive_treatment
          );
          expect(input.arms.static_control.store.root()).toBe(
            fixture.run.armRoots.static_control
          );
          return {
            runner: {
              start() { runnerStatus = { status: "running" }; },
              async drain() {
                runnerStatus = {
                  status: "completed",
                  latestStep: { status: "complete", action: "complete" }
                };
              },
              status() { return runnerStatus as never; }
            }
          };
        },
        collectOutcome: async () => fixture.collected
      });

      expect(result).toEqual(fixture.collected);
      expect(calls).toEqual([
        `store:adaptive_treatment:${fixture.run.armRoots.adaptive_treatment}`,
        `sessions:adaptive_treatment:${fixture.run.armRoots.adaptive_treatment}`,
        `store:static_control:${fixture.run.armRoots.static_control}`,
        `sessions:static_control:${fixture.run.armRoots.static_control}`
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["failed", "research_control_campaign_to_outcome_paper_failed"],
    ["stopped", "research_control_campaign_to_outcome_paper_incomplete"],
    ["idle", "research_control_campaign_to_outcome_paper_incomplete"],
    ["running", "research_control_campaign_to_outcome_paper_incomplete"]
  ])("rejects paper runner status %s without collection", async (
    status,
    code
  ) => {
    const calls: string[] = [];
    const fixture = campaignToOutcomeFixture();

    await expect(runResearchControlCampaignToOutcome(
      campaignToOutcomeInput(calls),
      {
        runCampaign: async () => fixture.run,
        createPaperRuntime: () => ({
          runner: {
            start() {},
            async drain() {},
            status: () => status === "failed"
              ? {
                  status: "failed" as const,
                  errorCode: "injected_paper_failure",
                  errorMessage: "injected"
                }
              : status === "running"
              ? { status: "running" as const, campaignId: "campaign-001" }
              : { status: status as "idle" | "stopped" }
          }
        }),
        collectOutcome: async () => {
          calls.push("collect");
          return fixture.collected;
        }
      }
    )).rejects.toMatchObject({
      name: "ResearchControlStudyRuntimeError",
      code
    });
    expect(calls).not.toContain("collect");
  });

  it("rejects a collected closure that differs from the executed campaign", async () => {
    const calls: string[] = [];
    const fixture = campaignToOutcomeFixture();
    const mismatched = structuredClone(fixture.collected);
    mismatched.campaign.research_control_campaign_id = "other-campaign";

    await expect(runResearchControlCampaignToOutcome(
      campaignToOutcomeInput(calls),
      {
        runCampaign: async () => fixture.run,
        createPaperRuntime: () => completedPaperRuntime(),
        collectOutcome: async () => mismatched
      }
    )).rejects.toMatchObject({
      code: "research_control_campaign_to_outcome_closure_mismatch"
    });
  });
});

function studyCommitInput(store: LocalStore, replicationIdempotencyKeys: string[]) {
  return {
    store,
    studyIdempotencyKey: "runtime-study-001",
    replicationIdempotencyKeys,
    sourceCandidateId: FIXTURE_CANDIDATE_ID,
    researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
    paperEvaluationProtocol: boundPaperEvaluationProtocol(),
    tickCountPerArm: 1,
    now: () => "2026-07-12T09:00:00.000Z"
  };
}

function campaignToOutcomeInput(calls: string[]) {
  return {
    store: {} as LocalStore,
    workspaceRoot: "/runtime-study-workspace",
    idempotencyKey: "runtime-study-replication-1",
    researchAgent: "fixture" as const,
    researchAgentIdentity: new FixtureTradingResearchAgentAdapter().agent,
    agentFactory: () => new FixtureTradingResearchAgentAdapter(),
    tickCountPerArm: 1,
    marketData: {} as never,
    openArm({ root: armRoot, armKind }: {
      root: string;
      armKind: "adaptive_treatment" | "static_control";
    }) {
      calls.push(`open:${armKind}:${armRoot}`);
      return { store: { armKind } } as never;
    }
  };
}

function campaignToOutcomeFixture() {
  const campaign = {
    research_control_campaign_id: "campaign-001",
    campaign_digest: digest("d"),
    paper_evaluation_protocol: { protocol_status: "bound" }
  } as unknown as ResearchControlCampaignRecord;
  const run = {
    campaignRoot: "/campaign",
    baselineRoot: "/campaign/baseline",
    sourceArtifactRoot: "/campaign/source",
    armRoots: {
      adaptive_treatment: "/campaign/arms/adaptive",
      static_control: "/campaign/arms/static"
    },
    campaign,
    report: {
      record_kind: "research_control_campaign_report"
    } as ResearchControlCampaignReportRecord
  } as RunResearchControlCampaignOutcome;
  const outcome = {
    campaign_ref: {
      record_kind: "research_control_campaign",
      id: "campaign-001"
    },
    campaign_digest: digest("d")
  } as ResearchControlCampaignOutcomeRecord;
  const collected: CollectResearchControlCampaignOutcomeResult = {
    ...run,
    outcome
  };
  return { run, collected };
}

function completedPaperRuntime() {
  return {
    runner: {
      start() {},
      async drain() {},
      status: () => ({
        status: "completed" as const,
        latestStep: { status: "complete" as const, action: "complete" as const }
      })
    }
  };
}

function studyReplicationKeys(): string[] {
  return Array.from({ length: 6 }, (_, index) =>
    `runtime-study-replication-${index + 1}`
  );
}

class TradingReviewStudyStore extends LocalStore {
  override async getLatestTradingPromotion(): Promise<TradingPromotionRecord> {
    return tradingPromotion();
  }

  override async getTradingPromotion(
    promotionId: string
  ): Promise<TradingPromotionRecord | undefined> {
    const promotion = tradingPromotion();
    return promotion.trading_promotion_id === promotionId
      ? promotion
      : undefined;
  }
}

function tradingPromotion(): TradingPromotionRecord {
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "runtime-study-comparator",
    status: "promoted_for_trading_review",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "runtime-study-champion"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "runtime-study-champion-version"
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "runtime-study-champion-evaluation"
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "runtime-study-confirmation"
      },
      campaign_digest: digest("a"),
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "runtime-study-confirmation-outcome"
      },
      campaign_outcome_digest: digest("b"),
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "runtime-study-verdict"
      },
      final_verdict_digest: digest("c")
    },
    promoted_at: "2026-07-12T08:00:00.000Z",
    authority_status: "not_live"
  };
}

function boundPaperEvaluationProtocol():
  ResearchControlCampaignPaperEvaluationProtocolInput {
  return {
    protocol_status: "bound",
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 1,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 1,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 1,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
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
      policy_version: "research-control-paper-schedule-v1",
      source_start_order: "paired_by_sequence",
      maximum_active_source_pairs: 2,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired",
      confirmation_precommit_deadline_ms: 600_000
    }
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
