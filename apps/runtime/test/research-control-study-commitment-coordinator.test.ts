import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FixtureTradingResearchAgentAdapter } from
  "@ouroboros/application/trading/research/agent-adapters";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import { LocalStore } from "@ouroboros/local-store";
import {
  RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY,
  ResearchControlStudyCommitmentCoordinator
} from "../src/candidate/arena/research-control-study-commitment-coordinator";
import { commitResearchControlStudyRuntime } from
  "../src/candidate/arena/research-control-study-runtime";
import {
  researchControlStudyFixture,
  researchControlStudyOutcomeFixture
} from
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
      policy_version: "research-control-study-commitment-v2",
      trigger: "research_generalization_protocol_slot",
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

  it("commits a protocol first, then one exact market-blocked study", async () => {
    const store = await tradingReviewStore("exact");
    const promotion = await store.getLatestTradingPromotion();
    const campaign = await store.getPaperTradingComparisonConfirmationCampaign(
      promotion!.comparison_confirmation.campaign_ref.id
    );
    const coordinator = coordinatorFor(store);

    const protocolCommitted = await coordinator.ensureCommittedStudy();

    expect(protocolCommitted).toMatchObject({
      status: "protocol_committed"
    });
    const protocols = await store.listResearchGeneralizationProtocols();
    expect(protocols).toHaveLength(1);
    expect(await store.listResearchControlStudies()).toEqual([]);

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
    expect(study.generalization_assignment).toMatchObject({
      protocol_ref: {
        id: protocols[0]!.research_generalization_protocol_id
      },
      protocol_digest: protocols[0]!.protocol_digest,
      slot_index: 1,
      condition_block: "long",
      condition_block_study_index: 1,
      market_condition: {
        condition_block: "long",
        authority_status: "public_evidence_only"
      },
      source_system_code_artifact_digest:
        campaign!.challenger.system_code_artifact_digest
    });
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
      status: "deferred",
      reason: "pending_study_exists",
      pendingStudyId: study.research_control_study_id
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

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
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

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    await expect(coordinator.ensureCommittedStudy()).rejects.toMatchObject({
      code: "research_control_study_commitment_failed"
    });
    await expect(store.listResearchControlStudies()).resolves.toHaveLength(0);
  });

  it("defers without a public closed-kline capability after protocol commitment", async () => {
    const store = await tradingReviewStore("no-kline-port");
    const coordinator = coordinatorFor(store, { marketData: undefined });

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    await expect(coordinator.ensureCommittedStudy()).resolves.toEqual({
      status: "deferred",
      reason: "market_condition_unavailable"
    });
    await expect(store.listResearchControlStudies()).resolves.toEqual([]);
  });

  it.each([
    ["short", 3],
    ["flat", 5]
  ] as const)(
    "commits the earliest %s condition slot",
    async (conditionBlock, slotIndex) => {
      const store = await tradingReviewStore(`condition-${conditionBlock}`);
      const coordinator = coordinatorFor(store, {
        marketData: marketDataFor(conditionBlock)
      });

      await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
        status: "protocol_committed"
      });
      await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
        status: "committed"
      });

      const [study] = await store.listResearchControlStudies();
      expect(study?.generalization_assignment).toMatchObject({
        slot_index: slotIndex,
        condition_block: conditionBlock,
        condition_block_study_index: 1
      });
    }
  );

  it("defers without study side effects when public market data fails", async () => {
    const store = await tradingReviewStore("market-failure");
    const coordinator = coordinatorFor(store, {
      marketData: {
        async readPublicKlineWindow() {
          throw new Error("transient public market failure");
        }
      }
    });

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    await expect(coordinator.ensureCommittedStudy()).resolves.toEqual({
      status: "deferred",
      reason: "market_condition_unavailable"
    });
    await expect(store.listResearchControlStudies()).resolves.toEqual([]);
  });

  it("enforces study spacing before rejecting a reused source baseline", async () => {
    const store = await terminalTradingReviewStore("spacing-and-source");
    const clock = advancingClock();
    const coordinator = coordinatorFor(store, { now: clock.now });

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "committed"
    });
    store.exposeTerminalOutcomes = true;

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "deferred",
      reason: "study_spacing_not_elapsed",
      nextEligibleAt: "2026-07-14T00:00:01.000Z"
    });

    clock.advance(86_400_000);
    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "deferred",
      reason: "source_baseline_reused",
      conditionBlock: "long"
    });
    await expect(store.listResearchControlStudies()).resolves.toHaveLength(1);
  });

  it("does not start a study after the precommitted collection window", async () => {
    const store = await tradingReviewStore("expired");
    const clock = advancingClock();
    const coordinator = coordinatorFor(store, { now: clock.now });

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "protocol_committed"
    });
    clock.advance(91 * 24 * 60 * 60 * 1_000);

    await expect(coordinator.ensureCommittedStudy()).resolves.toMatchObject({
      status: "deferred",
      reason: "protocol_expired"
    });
    await expect(store.listResearchControlStudies()).resolves.toEqual([]);
  });

  it("converges concurrent protocol and study commitments to one graph", async () => {
    const store = await tradingReviewStore("concurrent");
    const first = coordinatorFor(store);
    const second = coordinatorFor(store);

    const protocolResults = await Promise.all([
      first.ensureCommittedStudy(),
      second.ensureCommittedStudy()
    ]);
    expect(protocolResults.every((result) =>
      result.status === "protocol_committed"
    )).toBe(true);
    await expect(store.listResearchGeneralizationProtocols())
      .resolves.toHaveLength(1);

    const studyResults = await Promise.all([
      first.ensureCommittedStudy(),
      second.ensureCommittedStudy()
    ]);
    expect(studyResults.every((result) =>
      result.status === "committed" || result.status === "existing"
    )).toBe(true);
    await expect(store.listResearchControlStudies()).resolves.toHaveLength(1);
  });

  function coordinatorFor(
    store: LocalStore,
    options: {
      commitStudy?: typeof commitResearchControlStudyRuntime;
      now?: () => string;
      marketData?: Pick<GatewayMarketDataPort, "readPublicKlineWindow">;
    } = {}
  ): ResearchControlStudyCommitmentCoordinator {
    const clock = advancingClock();
    return new ResearchControlStudyCommitmentCoordinator({
      store,
      researchAgentIdentity: () =>
        new FixtureTradingResearchAgentAdapter().agent,
      marketData: options.marketData === undefined &&
          Object.prototype.hasOwnProperty.call(options, "marketData")
        ? undefined
        : (options.marketData ?? marketDataFor("long")) as never,
      now: options.now ?? clock.now,
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

  async function terminalTradingReviewStore(
    suffix: string
  ): Promise<TerminalOutcomeStore> {
    const target = path.join(root, suffix);
    await cp(FIXTURE_ROOT, target, { recursive: true });
    const store = new TerminalOutcomeStore(target);
    await store.initialize();
    return store;
  }
});

class TerminalOutcomeStore extends LocalStore {
  exposeTerminalOutcomes = false;

  override async listResearchControlStudyOutcomes() {
    if (!this.exposeTerminalOutcomes) {
      return super.listResearchControlStudyOutcomes();
    }
    return (await this.listResearchControlStudies()).map((study) =>
      researchControlStudyOutcomeFixture({
        study,
        adjudicatedAt: new Date(Date.parse(study.committed_at) + 1_000)
          .toISOString()
      })
    );
  }
}

function advancingClock(
  start = "2026-07-13T00:00:00.000Z",
  stepMs = 1_000
) {
  let epoch = Date.parse(start);
  return {
    now: () => {
      const value = new Date(epoch).toISOString();
      epoch += stepMs;
      return value;
    },
    advance: (durationMs: number) => {
      epoch += durationMs;
    }
  };
}

function marketDataFor(block: "long" | "short" | "flat") {
  return {
    async readPublicKlineWindow(input: { observedAt: string }) {
      const observedAt = Date.parse(input.observedAt);
      const end = Math.floor(observedAt / 60_000) * 60_000 - 1;
      const start = end + 1 - 30 * 60_000;
      const closes = block === "long"
        ? Array.from({ length: 30 }, (_, index) => 60_000 + index)
        : block === "short"
          ? Array.from({ length: 30 }, (_, index) => 60_030 - index)
          : Array.from({ length: 30 }, () => 60_000);
      return {
        symbol: "BTCUSDT" as const,
        interval: "1m" as const,
        sample_count: 30 as const,
        observed_at: input.observedAt,
        closed_window_end_at: new Date(end).toISOString(),
        source: {
          provider_kind: "binance_production_public_market_data" as const,
          source_kind: "binance_production_public_rest" as const,
          rest_base_url: "https://fapi.binance.com",
          endpoint: "/fapi/v1/klines" as const,
          authority_status: "read_only" as const
        },
        klines: closes.map((close, index) => ({
          open_time: new Date(start + index * 60_000).toISOString(),
          close_time: new Date(start + (index + 1) * 60_000 - 1)
            .toISOString(),
          close_price: String(close)
        })),
        authority_status: "read_only" as const
      };
    }
  };
}
