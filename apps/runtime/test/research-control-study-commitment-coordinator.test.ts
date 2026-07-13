import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import { LocalStore } from "@ouroboros/local-store";
import {
  RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY,
  ResearchControlStudyCommitmentCoordinator
} from "../src/candidate/arena/research-control-study-commitment-coordinator";
import { commitResearchControlStudyRuntime } from
  "../src/candidate/arena/research-control-study-runtime";
import { researchControlStudyFixture } from
  "./helpers/research-control-study";

const FIXTURE_ROOT = path.resolve(
  process.cwd(),
  "apps/runtime/test/fixtures/research-control-study/trading-review-store"
);

describe("ResearchControlStudyCommitmentCoordinator", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(
      os.tmpdir(),
      "ouroboros-study-commitment-"
    ));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("freezes the minimum bounded repository commitment policy", () => {
    expect(RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY).toEqual({
      policy_version: "research-control-study-commitment-v1",
      trigger: "latest_trading_promotion",
      maximum_incomplete_study_count: 1,
      replication_count: 6,
      tick_count_per_arm: 1,
      maximum_baseline_regular_file_count: 10_000,
      maximum_baseline_total_bytes: 1_000_000_000
    });
  });

  it("defers without a TradingPromotion or study side effect", async () => {
    const store = new LocalStore(path.join(root, "empty"));
    await store.initialize();
    const coordinator = coordinatorFor(store);

    await expect(coordinator.ensureCommittedStudy()).resolves.toEqual({
      status: "deferred",
      reason: "no_trading_promotion"
    });
    await expect(store.listResearchControlStudies()).resolves.toEqual([]);
    await expect(store.listResearchControlCampaigns()).resolves.toEqual([]);
  });

  it("commits one exact promotion-bound study and replays as existing", async () => {
    const store = await tradingReviewStore("exact");
    const promotion = await store.getLatestTradingPromotion();
    const campaign = await store.getPaperTradingComparisonConfirmationCampaign(
      promotion!.comparison_confirmation.campaign_ref.id
    );
    const coordinator = coordinatorFor(store);

    const committed = await coordinator.ensureCommittedStudy();

    expect(committed.status).toBe("committed");
    const studies = await store.listResearchControlStudies();
    expect(studies).toHaveLength(1);
    const study = studies[0]!;
    expect(committed).toEqual({
      status: "committed",
      studyId: study.research_control_study_id
    });
    expect(study.replications).toHaveLength(6);
    expect(study.replications.map((replication) =>
      replication.replication_index
    )).toEqual([1, 2, 3, 4, 5, 6]);
    expect(study.condition).toMatchObject({
      source: {
        candidate_ref: promotion!.candidate_ref,
        candidate_version_ref: promotion!.candidate_version_ref
      },
      paper_comparator: {
        comparator_status: "trading_review",
        trading_promotion_ref: {
          id: promotion!.trading_promotion_id
        }
      },
      campaign_policy: {
        tick_count_per_arm: 1,
        maximum_baseline_regular_file_count: 10_000,
        maximum_baseline_total_bytes: 1_000_000_000
      },
      paper_evaluation_protocol: {
        protocol_status: "bound",
        comparison_policy: {
          ...campaign!.comparison_policy,
          comparison_mode: "champion_challenge"
        },
        market_data_configuration_digest:
          campaign!.market_data_configuration_digest,
        paper_policy_identity: campaign!.paper_policy_identity,
        schedule_policy: {
          policy_version: "research-control-paper-schedule-v1",
          source_start_order: "paired_by_sequence",
          maximum_active_source_pairs: 2,
          maximum_cross_arm_first_tick_skew_ms:
            campaign!.comparison_policy.maximum_start_skew_ms,
          source_missed_start_policy: "slot_expired",
          confirmation_precommit_deadline_ms:
            campaign!.comparison_policy.maximum_elapsed_ms
        }
      }
    });
    await expect(store.listResearchControlCampaigns()).resolves.toEqual([]);
    await expect(store.listResearchControlStudyOutcomes()).resolves.toEqual([]);
    await expect(store.listResearchAllocationPolicyDecisions())
      .resolves.toEqual([]);
    await expect(coordinator.ensureCommittedStudy()).resolves.toEqual({
      status: "existing",
      studyId: study.research_control_study_id
    });
    await expect(store.listResearchControlStudies()).resolves.toEqual([study]);
  });

  it("defers a new automatic intent while any study is incomplete", async () => {
    const store = await tradingReviewStore("pending");
    const pending = researchControlStudyFixture({ suffix: "pending-manual" });
    await store.recordResearchControlStudy(pending);

    await expect(coordinatorFor(store).ensureCommittedStudy())
      .resolves.toEqual({
        status: "deferred",
        reason: "pending_study_exists",
        pendingStudyId: pending.research_control_study_id
      });
    await expect(store.listResearchControlStudies()).resolves.toEqual([pending]);
  });

  it("accepts an exact same-intent winner after a lost commit response", async () => {
    const store = await tradingReviewStore("winner");
    const coordinator = coordinatorFor(store, {
      async commitStudy(input) {
        await commitResearchControlStudyRuntime(input);
        throw new Error("lost commit response");
      }
    });

    const result = await coordinator.ensureCommittedStudy();
    const studies = await store.listResearchControlStudies();

    expect(studies).toHaveLength(1);
    expect(result).toEqual({
      status: "existing",
      studyId: studies[0]!.research_control_study_id
    });
  });

  it("rejects a same-key winner with different semantic intent", async () => {
    const store = await tradingReviewStore("mismatch");
    const coordinator = coordinatorFor(store, {
      async commitStudy(input) {
        await commitResearchControlStudyRuntime({
          ...input,
          researchAgentIdentity: {
            ...input.researchAgentIdentity,
            model: "different-fixture-model"
          }
        });
        throw new Error("lost mismatched response");
      }
    });

    await expect(coordinator.ensureCommittedStudy()).rejects.toMatchObject({
      code: "research_control_study_commitment_failed"
    });
    await expect(store.listResearchControlStudies()).resolves.toHaveLength(1);
  });

  function coordinatorFor(
    store: LocalStore,
    options: {
      commitStudy?: typeof commitResearchControlStudyRuntime;
    } = {}
  ): ResearchControlStudyCommitmentCoordinator {
    return new ResearchControlStudyCommitmentCoordinator({
      store,
      researchAgentIdentity: () =>
        new FixtureTradingResearchAgentAdapter().agent,
      now: () => "2026-07-13T00:00:00.000Z",
      ...(options.commitStudy ? { commitStudy: options.commitStudy } : {})
    });
  }

  async function tradingReviewStore(suffix: string): Promise<LocalStore> {
    const target = path.join(root, suffix);
    await cp(FIXTURE_ROOT, target, { recursive: true });
    const store = new LocalStore(target);
    await store.initialize();
    return store;
  }
});
