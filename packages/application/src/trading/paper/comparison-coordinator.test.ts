import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayMarketDataPort } from "../../ports/market-data";
import type { OuroborosStorePort } from "../../ports/store";
import {
  decidePaperTradingQualification,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingEvaluationCommitmentDigestInput
} from "@ouroboros/domain";
import type {
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  CandidateMaterializationInput,
  ExperimentRunRecord,
  PaperTradingAccountSnapshot,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPolicy,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonSide,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  ResearchFindingRecord,
  SystemCodeRecord,
  TradingEvaluationResultRecord,
  TradingPromotionRecord,
  TradingRunRecord,
  TradingSystemCandidateRecord
} from "@ouroboros/domain";
import {
  FIXTURE_CANDIDATE_ID,
  FIXTURE_SYSTEM_CODE_ID,
  LocalStore
} from "@ouroboros/local-store";
import {
  PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1,
  paperTradingMarketDataConfigurationDigest
} from "./commitment";
import { PaperTradingEvaluationRunner } from "./evaluation-runner";
import { qualifyPaperTradingEvaluation } from "./qualification";
import { PaperTradingSessionService } from "./session-service";
import {
  PaperTradingComparisonCoordinator,
  type PreparePaperTradingComparisonInput,
  type VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";
import { PaperTradingComparisonActivationCoordinator } from "./comparison-activation-coordinator";
import { PaperTradingComparisonTickCoordinator } from "./comparison-tick-coordinator";

const comparisonPolicy: PaperTradingComparisonPolicy = {
  policy_version: "paper-comparison-v1",
  comparison_mode: "champion_challenge",
  symbol: "BTCUSDT",
  interval_ms: 60_000,
  minimum_observation_count: 30,
  minimum_elapsed_ms: 1_800_000,
  maximum_observation_count: 120,
  maximum_elapsed_ms: 7_200_000,
  maximum_start_skew_ms: 5_000,
  maximum_provider_request_count_per_side: 500,
  maximum_retry_count_per_side: 3,
  primary_metric: "net_revenue_usdt",
  minimum_net_revenue_lift_usdt: 10,
  required_confirmation_count: 2,
  require_non_overlapping_windows: true,
  require_both_qualified: true,
  release_policy: "sealed_until_adjudication"
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-comparison-"));
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(tmpDir, { recursive: true, force: true });
});

describe("PaperTradingComparisonCoordinator", () => {
  it("prepares and verifies two inert qualification sides before sealing the pair", async () => {
    const fixture = await comparisonFixture();
    const championDefaultRunId = fixture.champion.runtime.ref.id;

    const prepared = await fixture.coordinator.prepare(fixture.input);

    expect("committedAt" in fixture.input).toBe(false);
    expect("committed_at" in fixture.input).toBe(false);
    expect(Object.keys(fixture.input)).not.toEqual(
      expect.arrayContaining(["committedAt", "committed_at"])
    );
    expect(prepared.preparation.committed_at).toBe("2026-07-10T00:00:10.000Z");
    expect(prepared.commitment.committed_at).toBe(prepared.preparation.committed_at);
    expect(prepared.champion.run.created_at).toBe(prepared.preparation.committed_at);
    expect(prepared.challenger.run.created_at).toBe(prepared.preparation.committed_at);
    expect(prepared.commitment).toMatchObject({
      preparation_ref: {
        record_kind: "paper_trading_comparison_preparation",
        id: prepared.preparation.paper_trading_comparison_preparation_id
      },
      champion: { role: "champion" },
      challenger: { role: "challenger" },
      comparison_policy: fixture.input.comparisonPolicy,
      market_data_configuration_digest: fixture.input.marketDataConfigurationDigest,
      paper_policy_identity: fixture.input.paperPolicyIdentity,
      authority_status: "not_live"
    });
    expect(prepared.champion.run.trading_run_id).not.toBe(
      prepared.challenger.run.trading_run_id
    );
    expect(prepared.champion.run.trading_run_id).not.toBe(championDefaultRunId);
    expect(prepared.champion.commitment).toMatchObject({
      evidence_purpose: "qualification",
      window_policy: { release_policy: "sealed_until_adjudication" }
    });
    expect(prepared.challenger.commitment).toMatchObject({
      evidence_purpose: "qualification",
      window_policy: { release_policy: "sealed_until_adjudication" }
    });
    expect(prepared.champion.evaluation.status).toBe("not_started");
    expect(prepared.challenger.evaluation.status).toBe("not_started");
    expect(fixture.runner.active(prepared.champion.run.trading_run_id)).toBe(false);
    expect(fixture.runner.active(prepared.challenger.run.trading_run_id)).toBe(false);
    expect(fixture.effects).toEqual({
      providerStarts: 0,
      sandboxStarts: 0,
      marketReads: 0
    });
    expect(prepared.champion.observations).toEqual([]);
    expect(prepared.challenger.observations).toEqual([]);
    expect((await fixture.store.getCandidate(fixture.champion.candidate_id))?.runtime.ref.id).toBe(
      championDefaultRunId
    );
    expect(
      (
        await fixture.store.getCandidateForTradingRun(
          prepared.champion.run.trading_run_id
        )
      )?.ledger?.has_activity
    ).toBe(false);
    expect(
      (
        await fixture.store.getCandidateForTradingRun(
          prepared.challenger.run.trading_run_id
        )
      )?.ledger?.has_activity
    ).toBe(false);
  });

  it("captures the first shared tick and records activation authorization without runtime effects", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const captureMarketData: GatewayMarketDataPort = {
      ...fixture.marketData,
      async readMarketSnapshot() {
        return {
          symbol: "BTCUSDT",
          price: 60_000,
          moving_average_fast: 60_100,
          moving_average_slow: 59_900,
          volatility: 0.01,
          expected_direction: "long",
          observed_at: "2026-07-10T00:00:10.500Z",
          source_kind: "binance_production_public_rest",
          source_priority: "rest_fallback",
          freshness: "fresh",
          ws_connected: false,
          rest_fallback_used: true,
          gap_detected: false
        };
      },
      async readPublicExecutionSnapshot() {
        return {
          symbol: "BTCUSDT",
          observed_at: "2026-07-10T00:00:10.600Z",
          source_kind: "binance_production_public_rest",
          source_priority: "rest_fallback",
          freshness: "fresh",
          ws_connected: false,
          rest_fallback_used: true,
          gap_detected: false,
          stream_marker: "comparison-first-tick-integration",
          agg_trades: [],
          authority_status: "read_only"
        };
      }
    };
    const ticks = new PaperTradingComparisonTickCoordinator({
      store: fixture.store,
      comparisons: fixture.coordinator,
      marketData: captureMarketData,
      now: () => "2026-07-10T00:00:11.000Z"
    });

    const captured = await ticks.captureFirstTick({
      comparisonId: prepared.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "real-inert-pair-first-tick"
    });
    const effectsBeforeAuthorization = { ...fixture.effects };
    const activations = new PaperTradingComparisonActivationCoordinator({
      store: fixture.store,
      comparisons: fixture.coordinator,
      now: () => "2026-07-10T00:00:12.000Z"
    });
    const authorized = await activations.authorize({
      comparisonId: prepared.commitment.paper_trading_comparison_commitment_id,
      idempotencyKey: "real-inert-pair-activation"
    });

    await expect(fixture.store.listPaperTradingComparisonTicks(
      prepared.commitment.paper_trading_comparison_commitment_id
    )).resolves.toEqual([captured.tick]);
    await expect(fixture.store.listPaperTradingComparisonActivations(
      prepared.commitment.paper_trading_comparison_commitment_id
    )).resolves.toEqual([authorized.activation]);
    await expect(fixture.store.getPaperTradingEvaluation(
      prepared.champion.evaluation.paper_trading_evaluation_id
    )).resolves.toMatchObject({ status: "not_started", observation_count: 0 });
    await expect(fixture.store.getPaperTradingEvaluation(
      prepared.challenger.evaluation.paper_trading_evaluation_id
    )).resolves.toMatchObject({ status: "not_started", observation_count: 0 });
    expect(fixture.runner.active(prepared.champion.run.trading_run_id)).toBe(false);
    expect(fixture.runner.active(prepared.challenger.run.trading_run_id)).toBe(false);
    expect(fixture.effects).toEqual({
      providerStarts: 0,
      sandboxStarts: 0,
      marketReads: 0
    });
    expect(fixture.effects).toEqual(effectsBeforeAuthorization);
    expect(authorized.runtimeEffects).toBe("not_started");
    expect(captured.comparison.verification.activation_authority).toBe("not_granted");
    expect(authorized.comparison.verification.activation_authority).toBe("not_granted");
  });

  it("prepares bootstrap selection only when no TradingPromotion exists", async () => {
    const fixture = await comparisonFixture({
      comparisonMode: "bootstrap",
      omitPromotion: true
    });

    const prepared = await fixture.coordinator.prepare(fixture.input);

    expect(prepared.preparation.champion_selection).toEqual({
      selection_kind: "bootstrap"
    });
    expect(prepared.commitment.champion_selection).toEqual({
      selection_kind: "bootstrap"
    });
    expect(prepared.verification).toEqual({
      status: "verified",
      activation_authority: "not_granted"
    });
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("builds common admission and promotion fixtures accepted by current LocalStore predicates", async () => {
    const fixture = await comparisonFixture();

    await expect(
      fixture.store.getCandidateAdmissionDecision(
        fixture.championAdmission.candidate_admission_decision_id
      )
    ).resolves.toEqual(fixture.championAdmission);
    await expect(
      fixture.store.getTradingPromotion(fixture.promotion.trading_promotion_id)
    ).resolves.toEqual(fixture.promotion);
    await expect(
      fixture.store.getPaperTradingEvaluation(
        fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
      )
    ).resolves.toEqual(fixture.promotionEvidence.evaluation);
    await expect(
      fixture.store.listPaperTradingObservations(
        fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
      )
    ).resolves.toHaveLength(30);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("creates no side record until the atomic preparation reservation succeeds", async () => {
    const fixture = await comparisonFixture();
    let releaseReservation!: () => void;
    let markReservationEntered!: () => void;
    const reservationEntered = new Promise<void>((resolve) => {
      markReservationEntered = resolve;
    });
    const reservationRelease = new Promise<void>((resolve) => {
      releaseReservation = resolve;
    });
    const delayedStore = new Proxy(fixture.store, {
      get(target, property, receiver) {
        if (property === "reservePaperTradingComparisonPreparation") {
          return async (
            preparation: Parameters<
              OuroborosStorePort["reservePaperTradingComparisonPreparation"]
            >[0]
          ) => {
            markReservationEntered();
            await reservationRelease;
            return target.reservePaperTradingComparisonPreparation(preparation);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as OuroborosStorePort;
    const coordinator = new PaperTradingComparisonCoordinator({
      store: delayedStore,
      sessions: fixture.sessions,
      now: () => "2026-07-10T00:00:10.000Z"
    });

    const pending = coordinator.prepare(fixture.input);
    await reservationEntered;
    await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
    await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual([
      fixture.promotionEvidence.commitment
    ]);
    await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual([
      fixture.promotionEvidence.evaluation
    ]);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    releaseReservation();
    await expect(pending).resolves.toMatchObject({
      verification: { status: "verified", activation_authority: "not_granted" }
    });
  });

  it("creates no side record when the atomic preparation reservation rejects", async () => {
    const fixture = await comparisonFixture();
    const rejectedStore = new Proxy(fixture.store, {
      get(target, property, receiver) {
        if (property === "reservePaperTradingComparisonPreparation") {
          return async () => {
            throw new Error("injected_reservation_rejection");
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as OuroborosStorePort;
    const coordinator = new PaperTradingComparisonCoordinator({
      store: rejectedStore,
      sessions: fixture.sessions,
      now: () => "2026-07-10T00:00:10.000Z"
    });

    await expect(coordinator.prepare(fixture.input)).rejects.toThrow(
      "injected_reservation_rejection"
    );
    await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
    await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual([
      fixture.promotionEvidence.commitment
    ]);
    await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual([
      fixture.promotionEvidence.evaluation
    ]);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("anchors intent before one-side failure and rejects policy drift before challenger writes", async () => {
    const fixture = await comparisonFixture();
    let failChallengerRun = true;
    const interruptedStore = new Proxy(fixture.store, {
      get(target, property, receiver) {
        if (property === "createPaperTradingRun") {
          return async (input: Parameters<OuroborosStorePort["createPaperTradingRun"]>[0]) => {
            if (
              failChallengerRun &&
              input.candidate_version_id === fixture.input.challenger.candidateVersionId
            ) {
              failChallengerRun = false;
              throw new Error("injected_challenger_run_failure");
            }
            return target.createPaperTradingRun(input);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as OuroborosStorePort;
    const interrupted = new PaperTradingComparisonCoordinator({
      store: interruptedStore,
      sessions: fixture.sessions,
      now: () => "2026-07-10T00:00:10.000Z"
    });

    await expect(interrupted.prepare(fixture.input)).rejects.toThrow(
      "injected_challenger_run_failure"
    );
    const [frozenPreparation] = await fixture.store.listPaperTradingComparisonPreparations();
    expect(frozenPreparation?.comparison_policy).toEqual(fixture.input.comparisonPolicy);
    expect(frozenPreparation?.committed_at).toBe("2026-07-10T00:00:10.000Z");
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(2);
    expect(await fixture.store.listPaperTradingEvaluations()).toHaveLength(2);
    expect(
      await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.challenger.candidateVersionId
      )
    ).toHaveLength(1);

    const driftedRequests: PreparePaperTradingComparisonInput[] = [
      {
        ...fixture.input,
        champion: fixture.input.challenger,
        challenger: fixture.input.champion
      },
      {
        ...fixture.input,
        comparisonPolicy: {
          ...fixture.input.comparisonPolicy,
          minimum_net_revenue_lift_usdt: 11
        }
      },
      {
        ...fixture.input,
        marketDataConfigurationDigest: "sha256:changed-market-configuration"
      },
      {
        ...fixture.input,
        paperPolicyIdentity: {
          ...fixture.input.paperPolicyIdentity,
          cost_policy_version: "paper-cost-changed"
        }
      }
    ];
    for (const drifted of driftedRequests) {
      await expect(interrupted.prepare(drifted)).rejects.toMatchObject({
        code: "paper_trading_comparison_idempotency_conflict"
      });
    }
    expect(
      await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.challenger.candidateVersionId
      )
    ).toHaveLength(1);
    expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(2);

    let retryClockCalls = 0;
    const retry = new PaperTradingComparisonCoordinator({
      store: fixture.store,
      sessions: fixture.sessions,
      now: () => {
        retryClockCalls += 1;
        return "2026-07-10T00:05:00.000Z";
      }
    });
    const repaired = await retry.prepare(fixture.input);
    expect(repaired.preparation.committed_at).toBe(frozenPreparation!.committed_at);
    expect(repaired.commitment.committed_at).toBe(frozenPreparation!.committed_at);
    expect(retryClockCalls).toBe(0);
    expect(repaired.verification).toEqual({
      status: "verified",
      activation_authority: "not_granted"
    });
    expect(await fixture.store.listPaperTradingEvaluationCommitments()).toHaveLength(3);
    expect(await fixture.store.listPaperTradingEvaluations()).toHaveLength(3);
    expect(await fixture.store.listPaperTradingComparisonCommitments()).toHaveLength(1);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("rejects a preseeded deterministic side run created before preparation", async () => {
    const fixture = await comparisonFixture();
    const suffix = createHash("sha256")
      .update(fixture.input.idempotencyKey)
      .digest("hex")
      .slice(0, 16);
    const comparisonId = `paper-trading-comparison-${suffix}`;
    const preseeded = await fixture.store.createPaperTradingRun({
      idempotency_key: `${comparisonId}:champion`,
      candidate_id: fixture.input.champion.candidateId,
      candidate_version_id: fixture.input.champion.candidateVersionId,
      evidence_purpose: "qualification",
      created_at: "2026-07-10T00:00:09.999Z"
    });

    await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_run_time_mismatch"
    });
    expect((await fixture.store.getTradingRun(preseeded.trading_run_id))?.created_at).toBe(
      "2026-07-10T00:00:09.999Z"
    );
    await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toHaveLength(1);
    await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual([
      fixture.promotionEvidence.commitment
    ]);
    await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual([
      fixture.promotionEvidence.evaluation
    ]);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("rejects same-ID frozen content drift after one-side failure before another side write", async () => {
    const fixture = await comparisonFixture();
    let failChallengerRun = true;
    const interruptedStore = new Proxy(fixture.store, {
      get(target, property, receiver) {
        if (property === "createPaperTradingRun") {
          return async (input: Parameters<OuroborosStorePort["createPaperTradingRun"]>[0]) => {
            if (
              failChallengerRun &&
              input.candidate_version_id === fixture.input.challenger.candidateVersionId
            ) {
              failChallengerRun = false;
              throw new Error("injected_challenger_run_failure");
            }
            return target.createPaperTradingRun(input);
          };
        }
        const value = Reflect.get(target, property, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
    }) as OuroborosStorePort;
    const interrupted = new PaperTradingComparisonCoordinator({
      store: interruptedStore,
      sessions: fixture.sessions,
      now: () => "2026-07-10T00:00:10.000Z"
    });
    await expect(interrupted.prepare(fixture.input)).rejects.toThrow(
      "injected_challenger_run_failure"
    );
    const [preparation] = await fixture.store.listPaperTradingComparisonPreparations();
    const systemCode = (await fixture.store.getSystemCode(
      preparation!.champion.system_code_ref.id
    ))!;
    await writeFile(
      path.join(
        fixture.store.root(),
        "system-codes/items",
        `${encodeURIComponent(systemCode.system_code_id)}.json`
      ),
      `${JSON.stringify(
        {
          ...systemCode,
          entrypoint: ["python3", "same-id-drifted.py"]
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

    await expect(interrupted.prepare(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_frozen_record_digest_mismatch"
    });
    await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(
      evaluationsBefore
    );
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(
      await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.challenger.candidateVersionId
      )
    ).toHaveLength(1);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("allows exact replay and rejects deterministic-id or active-tuple conflicts", async () => {
    const fixture = await comparisonFixture();
    const first = await fixture.coordinator.prepare(fixture.input);
    await expect(fixture.coordinator.prepare(fixture.input)).resolves.toEqual(first);

    await expect(
      fixture.coordinator.prepare({
        ...fixture.input,
        comparisonPolicy: {
          ...fixture.input.comparisonPolicy,
          minimum_net_revenue_lift_usdt: 11
        }
      })
    ).rejects.toMatchObject({ code: "paper_trading_comparison_idempotency_conflict" });

    await expect(
      fixture.coordinator.prepare({
        ...fixture.input,
        idempotencyKey: "paper-comparison-coordinator-active-conflict"
      })
    ).rejects.toMatchObject({ code: "paper_trading_comparison_active_pair_conflict" });

    const swappedEvidence = await recordCoordinatorQualifiedPromotionEvidence(
      fixture.store,
      fixture.sessions,
      fixture.challenger,
      "role-swap",
      "2026-07-09T21:32:00.000Z"
    );
    await fixture.store.recordTradingPromotion({
      ...fixture.promotion,
      trading_promotion_id: "trading-promotion-coordinator-role-swap",
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: fixture.challenger.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: fixture.challenger.candidate_version.candidate_version_id
      },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: swappedEvidence.evaluation.paper_trading_evaluation_id
      },
      promoted_at: "2026-07-09T22:03:00.000Z"
    });
    await expect(
      fixture.coordinator.prepare({
        ...fixture.input,
        idempotencyKey: "paper-comparison-coordinator-reversed-active-conflict",
        champion: fixture.input.challenger,
        challenger: fixture.input.champion
      })
    ).rejects.toMatchObject({ code: "paper_trading_comparison_active_pair_conflict" });
  });

  it("rejects distinct candidate versions that resolve to duplicate SystemCode bytes", async () => {
    const fixture = await comparisonFixture({ duplicateChallengerSystemCode: true });

    await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_duplicate_executable"
    });
    await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("rejects the same CandidateVersion before creating side records", async () => {
    const fixture = await comparisonFixture();
    const runsBefore = await fixture.store.listTradingRunsForCandidateVersion(
      fixture.input.champion.candidateVersionId
    );

    await expect(
      fixture.coordinator.prepare({
        ...fixture.input,
        challenger: fixture.input.champion
      })
    ).rejects.toMatchObject({
      code: "paper_trading_comparison_duplicate_candidate_version"
    });

    await expect(
      fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.champion.candidateVersionId
      )
    ).resolves.toEqual(runsBefore);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it.each([
    [
      "duplicate admission",
      { championAdmissionStatus: "duplicate" },
      "paper_trading_comparison_candidate_not_admitted"
    ],
    [
      "quarantined admission",
      { championAdmissionStatus: "quarantined" },
      "paper_trading_comparison_candidate_not_admitted"
    ],
    [
      "future admission",
      { futureChampionAdmission: true },
      "paper_trading_comparison_candidate_not_admitted"
    ],
    [
      "missing promotion",
      { omitPromotion: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "mismatched promotion",
      { mismatchPromotion: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "missing promotion evaluation",
      { missingPromotionEvaluation: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "wrong promotion evaluation refs",
      { wrongPromotionEvaluationRef: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "future promotion",
      { futurePromotion: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "qualification before admission",
      { preAdmissionQualification: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "reversed promotion observation time",
      { reversePromotionObservationTime: true },
      "paper_trading_comparison_champion_selection_mismatch"
    ],
    [
      "challenger SystemCode after admission",
      { challengerSystemCodeAfterAdmission: true },
      "paper_trading_comparison_candidate_not_admitted"
    ],
    [
      "bootstrap with promotion",
      { comparisonMode: "bootstrap" },
      "paper_trading_comparison_champion_selection_mismatch"
    ]
  ] as const)(
    "rejects %s before preparation, sides, or effects",
    async (_label, options, expectedCode) => {
      const fixture = await comparisonFixture(options);
      const championRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.champion.candidateVersionId
      );
      const challengerRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.challenger.candidateVersionId
      );
      const commitmentsBefore = await fixture.store.listPaperTradingEvaluationCommitments();
      const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

      await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
        code: expectedCode
      });
      await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
      await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
      await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
        commitmentsBefore
      );
      await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(
        evaluationsBefore
      );
      await expect(
        fixture.store.listTradingRunsForCandidateVersion(
          fixture.input.champion.candidateVersionId
        )
      ).resolves.toEqual(championRunsBefore);
      await expect(
        fixture.store.listTradingRunsForCandidateVersion(
          fixture.input.challenger.candidateVersionId
        )
      ).resolves.toEqual(challengerRunsBefore);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it("rejects an exact promotion/evaluation ref mismatch between same-champion chains", async () => {
    const fixture = await comparisonFixture({ wrongPromotionEvaluationRef: true });
    const alternate = fixture.alternateChampionPromotionEvidence;
    if (!alternate) {
      throw new Error("same-champion alternate promotion evidence was not built");
    }
    expect(alternate.commitment.candidate_ref).toEqual(
      fixture.promotionEvidence.commitment.candidate_ref
    );
    expect(alternate.commitment.candidate_version_ref).toEqual(
      fixture.promotionEvidence.commitment.candidate_version_ref
    );
    expect(alternate.commitment.system_code_ref).toEqual(
      fixture.promotionEvidence.commitment.system_code_ref
    );
    expect(fixture.promotion.paper_trading_evaluation_ref.id).toBe(
      fixture.promotionEvidence.evaluation.paper_trading_evaluation_id
    );
    const runsBefore = await fixture.store.listTradingRunsForCandidateVersion(
      fixture.input.champion.candidateVersionId
    );
    const commitmentsBefore = await fixture.store.listPaperTradingEvaluationCommitments();
    const evaluationsBefore = await fixture.store.listPaperTradingEvaluations();

    await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
      code: "paper_trading_comparison_champion_selection_mismatch"
    });
    await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
    await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    await expect(
      fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.champion.candidateVersionId
      )
    ).resolves.toEqual(runsBefore);
    await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
      commitmentsBefore
    );
    await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(
      evaluationsBefore
    );
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it.each([
    ["reordered-account", "qualified", []],
    ["29-observations", "collecting_evidence", ["min_observation_count_not_met"]],
    ["29-elapsed-minutes", "collecting_evidence", ["min_elapsed_ms_not_met"]],
    ["30-observations-30-minutes", "qualified", []],
    ["3-of-30-failed", "qualified", []],
    ["4-of-30-failed", "blocked_by_quality", ["failed_observation_ratio_exceeded"]],
    ["missing-market", "blocked_by_quality", ["latest_market_snapshot_missing"]],
    ["accounting-discontinuity", "blocked_by_quality", ["paper_score_account_mismatch"]],
    ["unmatched-fill", "blocked_by_quality", ["fill_public_execution_evidence_missing"]],
    [
      "bad-self-digest",
      "not_qualification_evidence",
      ["paper_evaluation_commitment_missing"]
    ]
  ] as const)(
    "delegates one domain qualification decision: %s",
    async (kind, expectedStatus, expectedReasons) => {
      const fixture = await comparisonFixture();
      let commitment = structuredClone(fixture.promotionEvidence.commitment);
      const evaluation = structuredClone(fixture.promotionEvidence.evaluation);
      const observations = structuredClone(fixture.promotionEvidence.observations);
      if (kind === "reordered-account") {
        const account = evaluation.paper_account_snapshot;
        if (!account) {
          throw new Error("qualification parity fixture has no evaluation account");
        }
        const position = Object.fromEntries(
          Object.entries(account.position).reverse()
        ) as unknown as PaperTradingAccountSnapshot["position"];
        evaluation.paper_account_snapshot = Object.fromEntries(
          Object.entries(account)
            .reverse()
            .map(([key, value]) => (key === "position" ? [key, position] : [key, value]))
        ) as unknown as PaperTradingAccountSnapshot;
      } else if (kind === "29-observations") {
        observations.splice(29);
        const last = observations.at(-1)!;
        last.observed_at = new Date(
          Date.parse(evaluation.started_at) + 30 * 60_000
        ).toISOString();
        evaluation.observation_count = 29;
        evaluation.last_observed_at = last.observed_at;
        evaluation.stopped_at = last.observed_at;
      } else if (kind === "29-elapsed-minutes") {
        const last = observations.at(-1)!;
        last.observed_at = new Date(
          Date.parse(evaluation.started_at) + 29 * 60_000
        ).toISOString();
        evaluation.last_observed_at = last.observed_at;
        evaluation.stopped_at = last.observed_at;
      } else if (kind === "3-of-30-failed" || kind === "4-of-30-failed") {
        const failedCount = kind === "3-of-30-failed" ? 3 : 4;
        for (const observation of observations.slice(0, failedCount)) {
          observation.status = "failed";
          observation.failure_reason = "qualification parity failure";
        }
      } else if (kind === "missing-market") {
        for (const observation of observations) {
          delete observation.market_snapshot;
        }
      } else if (kind === "accounting-discontinuity") {
        observations[0]!.score_delta.revenue_usdt = 1;
        observations[0]!.cumulative_score.revenue_usdt = 1;
      } else if (kind === "unmatched-fill") {
        evaluation.latest_fill = {
          fill_id: "parity-fill-unmatched",
          order_id: "parity-order-unmatched",
          fill_status: "filled",
          fill_price: "60000",
          fill_quantity: "0.001",
          fee_usdt: "0",
          slippage_usdt: "0",
          funding_usdt: "0",
          trade_time: evaluation.stopped_at!,
          source_trade_id: "aggTrade:parity-unmatched"
        };
      } else if (kind === "bad-self-digest") {
        commitment = {
          ...commitment,
          data_identity: {
            ...commitment.data_identity,
            market_data_configuration_digest: "sha256:parity-self-digest-drift"
          }
        };
      }
      const selfDigestMatches =
        commitment.commitment_digest ===
        withCoordinatorCommitmentDigest({ ...commitment, commitment_digest: "" })
          .commitment_digest;
      const domainResult = decidePaperTradingQualification({
        commitment,
        evaluation,
        observations,
        runnerActive: false,
        commitmentDigestVerified: selfDigestMatches
      });
      const applicationResult = qualifyPaperTradingEvaluation({
        commitment,
        evaluation,
        observations,
        runnerActive: false
      });

      expect(applicationResult).toEqual(domainResult);
      expect(applicationResult.qualification_status).toBe(expectedStatus);
      expect(applicationResult.qualification_reasons).toEqual(expectedReasons);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it.each(["ineligible-provider", "malformed-provider-model", "pre-start-outcome"] as const)(
    "rejects persisted same-ID semantic drift with recomputed digests: %s",
    async (drift) => {
      const fixture = await comparisonFixture();
      const prepared = await fixture.coordinator.prepare(fixture.input);
      if (drift === "ineligible-provider" || drift === "malformed-provider-model") {
        const changedCommitment = withCoordinatorCommitmentDigest({
          ...prepared.champion.commitment,
          provider_identity:
            drift === "ineligible-provider"
              ? {
                  runtime_provider_kind: "none",
                  qualification_eligible: false,
                  ineligibility_reason: "provider_identity_unavailable"
                }
              : {
                  runtime_provider_kind: "managed_agent",
                  agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
                  model: {} as never,
                  provider_configuration_digest: "sha256:provider-shape-test",
                  qualification_eligible: true
                },
          commitment_digest: ""
        });
        const changedPair = withCoordinatorPairDigest({
          ...prepared.commitment,
          champion: {
            ...prepared.commitment.champion,
            paper_trading_evaluation_commitment_digest:
              changedCommitment.commitment_digest,
            paper_trading_evaluation_commitment_record_digest:
              comparisonExactRecordDigest(
                paperTradingComparisonEvaluationCommitmentRecordDigestInput(
                  changedCommitment
                )
              )
          },
          commitment_digest: ""
        });
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-evaluation-commitments",
          changedCommitment.paper_trading_evaluation_commitment_id,
          changedCommitment
        );
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-comparison-commitments",
          changedPair.paper_trading_comparison_commitment_id,
          changedPair
        );
      } else {
        const changedEvaluation: PaperTradingEvaluationRecord = {
          ...prepared.challenger.evaluation,
          latest_score: {
            revenue_usdt: 1,
            cost_usdt: 0,
            net_revenue_usdt: 1,
            net_return_pct: 0.0001
          },
          open_orders: [
            {
              order_id: "pre-start-order",
              event_id: "pre-start-event",
              side: "buy",
              order_type: "market",
              quantity: "0.001",
              status: "open",
              cumulative_filled_quantity: "0",
              remaining_quantity: "0.001",
              created_at: "2026-07-10T00:00:10.000Z",
              updated_at: "2026-07-10T00:00:10.000Z"
            }
          ],
          next_observation_at: "2026-07-10T00:01:10.000Z"
        };
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-evaluations",
          prepared.challenger.evaluation.paper_trading_evaluation_id,
          changedEvaluation
        );
        const changedPair = withCoordinatorPairDigest({
          ...prepared.commitment,
          challenger: {
            ...prepared.commitment.challenger,
            paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
              paperTradingComparisonEvaluationRecordDigestInput(changedEvaluation)
            )
          },
          commitment_digest: ""
        });
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-comparison-commitments",
          changedPair.paper_trading_comparison_commitment_id,
          changedPair
        );
      }
      const mutationCalls: string[] = [];
      const readOnly = readOnlyStoreProxy(fixture.store, mutationCalls);
      const coordinator = new PaperTradingComparisonCoordinator({
        store: readOnly,
        sessions: sessionsPrepareMustNotRun()
      });

      await expect(
        coordinator.reload(prepared.commitment.paper_trading_comparison_commitment_id)
      ).rejects.toMatchObject({
        code: "paper_trading_comparison_graph_invalid"
      });
      expect(mutationCalls).toEqual([]);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it.each([
    "malformed-managed-provider",
    "wrong-system-code",
    "malformed-fill-source-trade-id",
    "malformed-public-execution-trade"
  ] as const)(
    "rejects malformed champion qualification closure before preparation: %s",
    async (corruption) => {
      const fixture = await comparisonFixture();
      const championRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.champion.candidateVersionId
      );
      const challengerRunsBefore = await fixture.store.listTradingRunsForCandidateVersion(
        fixture.input.challenger.candidateVersionId
      );
      if (corruption === "malformed-managed-provider" || corruption === "wrong-system-code") {
        let changedCommitment: PaperTradingEvaluationCommitmentRecord;
        if (corruption === "malformed-managed-provider") {
          changedCommitment = withCoordinatorCommitmentDigest({
            ...fixture.promotionEvidence.commitment,
            provider_identity: {
              runtime_provider_kind: "managed_agent",
              agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
              model: {} as never,
              provider_configuration_digest: "sha256:provider-shape-test",
              qualification_eligible: true
            },
            commitment_digest: ""
          });
        } else {
          const challengerSystemCodeRef = fixture.challenger.system_code?.ref;
          if (!challengerSystemCodeRef) {
            throw new Error("fixture challenger SystemCode ref was not materialized");
          }
          changedCommitment = withCoordinatorCommitmentDigest({
            ...fixture.promotionEvidence.commitment,
            system_code_ref: {
              record_kind: "system_code",
              id: challengerSystemCodeRef.id
            },
            commitment_digest: ""
          });
        }
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-evaluation-commitments",
          changedCommitment.paper_trading_evaluation_commitment_id,
          changedCommitment
        );
      } else {
        const changedEvaluation: PaperTradingEvaluationRecord = {
          ...fixture.promotionEvidence.evaluation,
          ...(corruption === "malformed-fill-source-trade-id"
            ? {
                latest_fill: {
                  fill_id: "promotion-fill-shape-test",
                  order_id: "promotion-order-shape-test",
                  fill_status: "filled" as const,
                  fill_price: "60000",
                  fill_quantity: "0.001",
                  fee_usdt: "0",
                  slippage_usdt: "0",
                  funding_usdt: "0",
                  trade_time: fixture.promotionEvidence.evaluation.stopped_at!,
                  source_trade_id: {} as never
                }
              }
            : {
                latest_public_execution_snapshot: {
                  symbol: "BTCUSDT" as const,
                  observed_at: fixture.promotionEvidence.evaluation.stopped_at!,
                  source_kind: "binance_production_public_rest" as const,
                  stream_marker: "malformed-promotion-public-execution",
                  agg_trades: [null as never],
                  authority_status: "read_only" as const
                }
              })
        };
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-evaluations",
          changedEvaluation.paper_trading_evaluation_id,
          changedEvaluation
        );
      }
      const commitmentsAfterCorruption =
        await fixture.store.listPaperTradingEvaluationCommitments();
      const evaluationsAfterCorruption = await fixture.store.listPaperTradingEvaluations();

      await expect(fixture.coordinator.prepare(fixture.input)).rejects.toMatchObject({
        code: "paper_trading_comparison_champion_selection_mismatch"
      });
      await expect(fixture.store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
      await expect(fixture.store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
      await expect(fixture.store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
        commitmentsAfterCorruption
      );
      await expect(fixture.store.listPaperTradingEvaluations()).resolves.toEqual(
        evaluationsAfterCorruption
      );
      await expect(
        fixture.store.listTradingRunsForCandidateVersion(
          fixture.input.champion.candidateVersionId
        )
      ).resolves.toEqual(championRunsBefore);
      await expect(
        fixture.store.listTradingRunsForCandidateVersion(
          fixture.input.challenger.candidateVersionId
        )
      ).resolves.toEqual(challengerRunsBefore);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it.each(["invalid-policy", "null-selection"] as const)(
    "rejects recomputed malformed preparation and pair before dereference: %s",
    async (corruption) => {
      const fixture = await comparisonFixture();
      const prepared = await fixture.coordinator.prepare(fixture.input);
      const changedPreparation = withCoordinatorPreparationDigest({
        ...prepared.preparation,
        ...(corruption === "invalid-policy"
          ? {
              comparison_policy: {
                ...prepared.preparation.comparison_policy,
                minimum_observation_count: 0
              }
            }
          : { champion_selection: null as never }),
        preparation_digest: ""
      });
      const changedPair = withCoordinatorPairDigest({
        ...prepared.commitment,
        ...(corruption === "invalid-policy"
          ? {
              comparison_policy: {
                ...prepared.commitment.comparison_policy,
                minimum_observation_count: 0
              }
            }
          : { champion_selection: null as never }),
        commitment_digest: ""
      });
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-comparison-preparations",
        changedPreparation.paper_trading_comparison_preparation_id,
        changedPreparation
      );
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-comparison-commitments",
        changedPair.paper_trading_comparison_commitment_id,
        changedPair
      );
      const mutationCalls: string[] = [];
      const coordinator = new PaperTradingComparisonCoordinator({
        store: readOnlyStoreProxy(fixture.store, mutationCalls),
        sessions: sessionsPrepareMustNotRun()
      });

      await expect(
        coordinator.reload(changedPair.paper_trading_comparison_commitment_id)
      ).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
      await expect(
        coordinator.verify({
          ...prepared,
          preparation: changedPreparation,
          commitment: changedPair
        } as VerifiedPaperTradingComparisonCommitmentGraph)
      ).rejects.toMatchObject({
        code: "paper_trading_comparison_graph_invalid"
      });
      expect(mutationCalls).toEqual([]);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it.each(["candidate", "run", "system-code", "commitment", "evaluation", "observations"] as const)(
    "rejects malformed prepared-side %s before selection dereference",
    async (field) => {
      const fixture = await comparisonFixture();
      const prepared = await fixture.coordinator.prepare(fixture.input);
      const malformed = structuredClone(
        prepared
      ) as VerifiedPaperTradingComparisonCommitmentGraph;
      if (field === "candidate") {
        malformed.champion.candidate = null as never;
      } else if (field === "run") {
        malformed.champion.run = null as never;
      } else if (field === "system-code") {
        malformed.champion.systemCode = {
          ...malformed.champion.systemCode,
          entrypoint: null as never
        };
      } else if (field === "commitment") {
        malformed.champion.commitment = {
          ...malformed.champion.commitment,
          provider_identity: null as never
        };
      } else if (field === "evaluation") {
        malformed.champion.evaluation = {
          ...malformed.champion.evaluation,
          latest_score: null as never
        };
      } else {
        malformed.champion.observations = [null as never];
      }
      const mutationCalls: string[] = [];
      const readCalls: string[] = [];
      const coordinator = new PaperTradingComparisonCoordinator({
        store: readOnlyStoreProxy(fixture.store, mutationCalls, readCalls),
        sessions: sessionsPrepareMustNotRun()
      });

      await expect(coordinator.verify(malformed)).rejects.toMatchObject({
        code: "paper_trading_comparison_graph_invalid"
      });
      expect(readCalls).not.toContain("getTradingPromotion");
      expect(mutationCalls).toEqual([]);
      expect(fixture.effects).toEqual({
        providerStarts: 0,
        sandboxStarts: 0,
        marketReads: 0
      });
    }
  );

  it("fails read-only reload after same-ID side timestamps change under unchanged pair bytes", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const pairBefore = await fixture.store.getPaperTradingComparisonCommitment(
      prepared.commitment.paper_trading_comparison_commitment_id
    );
    const rewrittenAt = "2026-07-10T00:00:10.001Z";
    const changedCommitment = withCoordinatorCommitmentDigest({
      ...prepared.champion.commitment,
      committed_at: rewrittenAt,
      commitment_digest: ""
    });
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluation-commitments",
      changedCommitment.paper_trading_evaluation_commitment_id,
      changedCommitment
    );
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-evaluations",
      prepared.champion.evaluation.paper_trading_evaluation_id,
      { ...prepared.champion.evaluation, started_at: rewrittenAt }
    );
    await expect(
      fixture.store.getPaperTradingComparisonCommitment(
        prepared.commitment.paper_trading_comparison_commitment_id
      )
    ).resolves.toEqual(pairBefore);
    expect(changedCommitment.commitment_digest).toBe(
      prepared.champion.commitment.commitment_digest
    );

    const mutationCalls: string[] = [];
    const coordinator = new PaperTradingComparisonCoordinator({
      store: readOnlyStoreProxy(fixture.store, mutationCalls),
      sessions: sessionsPrepareMustNotRun()
    });
    await expect(
      coordinator.reload(prepared.commitment.paper_trading_comparison_commitment_id)
    ).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
    expect(mutationCalls).toEqual([]);
  });

  it("rejects recomputed challenger SystemCode time after its frozen admission", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const changedSystemCode: SystemCodeRecord = {
      ...prepared.challenger.systemCode,
      created_at: "2026-07-09T20:56:00.001Z"
    };
    const changedSystemCodeDigest = comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(changedSystemCode)
    );
    const changedPreparation = withCoordinatorPreparationDigest({
      ...prepared.preparation,
      challenger: {
        ...prepared.preparation.challenger,
        system_code_record_digest: changedSystemCodeDigest
      },
      preparation_digest: ""
    });
    const changedPair = withCoordinatorPairDigest({
      ...prepared.commitment,
      challenger: {
        ...prepared.commitment.challenger,
        system_code_record_digest: changedSystemCodeDigest
      },
      commitment_digest: ""
    });
    await writeCoordinatorRecord(
      fixture.store,
      "system-codes",
      changedSystemCode.system_code_id,
      changedSystemCode
    );
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-comparison-preparations",
      changedPreparation.paper_trading_comparison_preparation_id,
      changedPreparation
    );
    await writeCoordinatorRecord(
      fixture.store,
      "paper-trading-comparison-commitments",
      changedPair.paper_trading_comparison_commitment_id,
      changedPair
    );
    const mutationCalls: string[] = [];
    const coordinator = new PaperTradingComparisonCoordinator({
      store: readOnlyStoreProxy(fixture.store, mutationCalls),
      sessions: sessionsPrepareMustNotRun()
    });

    await expect(
      coordinator.reload(changedPair.paper_trading_comparison_commitment_id)
    ).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
    await expect(
      coordinator.verify({
        ...prepared,
        preparation: changedPreparation,
        commitment: changedPair,
        challenger: { ...prepared.challenger, systemCode: changedSystemCode }
      })
    ).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
    expect(mutationCalls).toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it.each([
    "deleted-evaluation",
    "replacement-evaluation-id",
    "alternate-side-commitment",
    "alternate-side-commitment-evaluation-chain",
    "corrupt-side-commitment",
    "drifted-ref-kind",
    "drifted-bound-promotion",
    "drifted-promotion-evaluation",
    "drifted-promotion-commitment",
    "drifted-promotion-observation",
    "drifted-candidate",
    "drifted-candidate-version",
    "drifted-run",
    "drifted-system-code"
  ] as const)("fails closed without repair for %s", async (corruption) => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const before = await persistedInertCounts(fixture.store, prepared);
    const evaluationPath = path.join(
      fixture.store.root(),
      "paper-trading-evaluations/items",
      `${encodeURIComponent(
        prepared.champion.evaluation.paper_trading_evaluation_id
      )}.json`
    );

    if (corruption === "replacement-evaluation-id") {
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluations",
        "paper-evaluation-readonly-replacement",
        {
          ...prepared.champion.evaluation,
          paper_trading_evaluation_id: "paper-evaluation-readonly-replacement"
        }
      );
      await rm(evaluationPath, { force: true });
    } else if (corruption === "deleted-evaluation") {
      await rm(evaluationPath, { force: true });
    } else if (
      corruption === "alternate-side-commitment" ||
      corruption === "alternate-side-commitment-evaluation-chain"
    ) {
      const alternateCommitment = withCoordinatorCommitmentDigest({
        ...prepared.champion.commitment,
        paper_trading_evaluation_commitment_id: `alternate-${prepared.champion.commitment.paper_trading_evaluation_commitment_id}`,
        commitment_digest: ""
      });
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluation-commitments",
        alternateCommitment.paper_trading_evaluation_commitment_id,
        alternateCommitment
      );
      if (corruption === "alternate-side-commitment-evaluation-chain") {
        const alternateEvaluation: PaperTradingEvaluationRecord = {
          ...prepared.champion.evaluation,
          paper_trading_evaluation_id: `alternate-${prepared.champion.evaluation.paper_trading_evaluation_id}`,
          paper_trading_evaluation_commitment_ref: {
            record_kind: "paper_trading_evaluation_commitment",
            id: alternateCommitment.paper_trading_evaluation_commitment_id
          }
        };
        await writeCoordinatorRecord(
          fixture.store,
          "paper-trading-evaluations",
          alternateEvaluation.paper_trading_evaluation_id,
          alternateEvaluation
        );
      }
    } else if (corruption === "corrupt-side-commitment" || corruption === "drifted-ref-kind") {
      const commitmentPath = path.join(
        fixture.store.root(),
        "paper-trading-evaluation-commitments/items",
        `${encodeURIComponent(
          prepared.champion.commitment.paper_trading_evaluation_commitment_id
        )}.json`
      );
      const commitment = JSON.parse(
        await readFile(commitmentPath, "utf8")
      ) as PaperTradingEvaluationCommitmentRecord;
      const changedCommitment = withCoordinatorCommitmentDigest({
        ...commitment,
        ...(corruption === "corrupt-side-commitment"
          ? {
              provider_identity: {
                runtime_provider_kind: "none" as const,
                qualification_eligible: false,
                ineligibility_reason: "provider_identity_unavailable" as const
              }
            }
          : {
              candidate_ref: {
                record_kind: "same-id-wrong-kind",
                id: commitment.candidate_ref.id
              }
            }),
        commitment_digest: ""
      });
      const changedPair = withCoordinatorPairDigest({
        ...prepared.commitment,
        champion: {
          ...prepared.commitment.champion,
          paper_trading_evaluation_commitment_digest: changedCommitment.commitment_digest,
          paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(changedCommitment)
          )
        },
        commitment_digest: ""
      });
      await writeFile(
        commitmentPath,
        `${JSON.stringify(changedCommitment, null, 2)}\n`,
        "utf8"
      );
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-comparison-commitments",
        changedPair.paper_trading_comparison_commitment_id,
        changedPair
      );
    } else if (corruption === "drifted-bound-promotion") {
      const selection = prepared.preparation.champion_selection;
      if (selection.selection_kind !== "trading_review") {
        throw new Error("fixture selection was not trading_review");
      }
      const promotion = (await fixture.store.getTradingPromotion(
        selection.trading_promotion_ref.id
      ))!;
      await writeFile(
        path.join(
          fixture.store.root(),
          "trading-promotions/items",
          `${encodeURIComponent(promotion.trading_promotion_id)}.json`
        ),
        `${JSON.stringify(
          {
            ...promotion,
            paper_trading_evaluation_ref: {
              record_kind: "paper_trading_evaluation",
              id: "same-id-drifted-selection-evaluation"
            }
          },
          null,
          2
        )}\n`,
        "utf8"
      );
    } else if (corruption === "drifted-promotion-evaluation") {
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluations",
        fixture.promotionEvidence.evaluation.paper_trading_evaluation_id,
        {
          ...fixture.promotionEvidence.evaluation,
          latest_failure_reason: "same-id-promotion-evaluation-drift"
        }
      );
    } else if (corruption === "drifted-promotion-commitment") {
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluation-commitments",
        fixture.promotionEvidence.commitment.paper_trading_evaluation_commitment_id,
        {
          ...fixture.promotionEvidence.commitment,
          committed_at: "2026-07-09T21:00:00.001Z"
        }
      );
    } else if (corruption === "drifted-promotion-observation") {
      const last = fixture.promotionEvidence.observations.at(-1)!;
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-observations",
        last.paper_trading_observation_id,
        {
          ...last,
          market_snapshot: { ...last.market_snapshot!, price: 60_001 }
        }
      );
    } else if (corruption === "drifted-candidate") {
      const candidate = await readCoordinatorRecord<TradingSystemCandidateRecord>(
        fixture.store,
        "candidates",
        prepared.champion.side.candidate_ref.id
      );
      await writeCoordinatorRecord(
        fixture.store,
        "candidates",
        prepared.champion.side.candidate_ref.id,
        { ...candidate, candidate_id: "same-path-drifted-candidate-id" }
      );
    } else if (corruption === "drifted-run") {
      await writeCoordinatorRecord(
        fixture.store,
        "trading-runs",
        prepared.champion.run.trading_run_id,
        {
          ...prepared.champion.run,
          trace_ref: { record_kind: "trace_placeholder", id: "unexpected-prestart-trace" }
        }
      );
    } else if (corruption === "drifted-candidate-version") {
      const version = (await fixture.store.getCandidateVersion(
        prepared.champion.side.candidate_version_ref.id
      ))!;
      const changedVersion = {
        ...version,
        runtime_ref: { ...prepared.champion.side.trading_run_ref }
      };
      await writeCoordinatorRecord(
        fixture.store,
        "candidate-versions",
        version.candidate_version_id,
        changedVersion
      );
      await rewriteCoordinatorFrozenSideDigestForSemanticTest(fixture.store, prepared, {
        candidate_version_digest: comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(changedVersion)
        )
      });
    } else {
      const changedSystemCode = {
        ...prepared.champion.systemCode,
        entrypoint: ["python3", "same-id-drifted-entrypoint.py"]
      };
      await writeCoordinatorRecord(
        fixture.store,
        "system-codes",
        prepared.champion.systemCode.system_code_id,
        changedSystemCode
      );
      await rewriteCoordinatorFrozenSideDigestForSemanticTest(fixture.store, prepared, {
        system_code_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(changedSystemCode)
        )
      });
    }
    const afterCorruption = await persistedInertCounts(fixture.store, prepared);

    const mutationCalls: string[] = [];
    const readOnlyReload = new PaperTradingComparisonCoordinator({
      store: readOnlyStoreProxy(fixture.store, mutationCalls),
      sessions: sessionsPrepareMustNotRun(),
      now: () => "2026-07-10T00:10:00.000Z"
    });
    await expect(
      readOnlyReload.reload(prepared.commitment.paper_trading_comparison_commitment_id)
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^paper_trading_comparison_/)
    });
    const after = await persistedInertCounts(fixture.store, prepared);
    expect(mutationCalls).toEqual([]);
    expect(after).toEqual(afterCorruption);
    expect(after.commitments).toBe(
      corruption === "alternate-side-commitment" ||
        corruption === "alternate-side-commitment-evaluation-chain"
        ? before.commitments + 1
        : before.commitments
    );
    expect(after.observations).toBe(before.observations);
    expect(after.runControlRefs).toBe(before.runControlRefs);
    if (corruption === "alternate-side-commitment-evaluation-chain") {
      expect(after.evaluations).toBe(before.evaluations + 1);
    } else {
      expect(after.evaluations).toBeLessThanOrEqual(before.evaluations);
    }
    if (corruption === "replacement-evaluation-id") {
      expect(
        await fixture.store.getPaperTradingEvaluation(
          "paper-evaluation-readonly-replacement"
        )
      ).toBeDefined();
      expect(
        await fixture.store.getPaperTradingEvaluation(
          prepared.champion.side.paper_trading_evaluation_ref.id
        )
      ).toBeUndefined();
    }
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("maps malformed persisted side collections to a stable read-only graph error", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const commitments = await fixture.store.listPaperTradingEvaluationCommitments();
    for (const commitment of commitments) {
      await writeCoordinatorRecord(
        fixture.store,
        "paper-trading-evaluation-commitments",
        commitment.paper_trading_evaluation_commitment_id,
        { ...commitment, committed_at: null }
      );
    }
    const mutationCalls: string[] = [];
    const coordinator = new PaperTradingComparisonCoordinator({
      store: readOnlyStoreProxy(fixture.store, mutationCalls),
      sessions: sessionsPrepareMustNotRun()
    });

    await expect(
      coordinator.reload(prepared.commitment.paper_trading_comparison_commitment_id)
    ).rejects.toMatchObject({ code: "paper_trading_comparison_graph_invalid" });
    expect(mutationCalls).toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("fails closed when reload finds canonical pair drift", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const pairPath = path.join(
      tmpDir,
      "paper-trading-comparison-commitments/items",
      `${prepared.commitment.paper_trading_comparison_commitment_id}.json`
    );
    const persisted = JSON.parse(
      await readFile(pairPath, "utf8")
    ) as PaperTradingComparisonCommitmentRecord;
    await writeFile(
      pairPath,
      `${JSON.stringify(
        {
          ...persisted,
          comparison_policy: {
            ...persisted.comparison_policy,
            maximum_elapsed_ms: persisted.comparison_policy.maximum_elapsed_ms + 1
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const reloaded = new PaperTradingComparisonCoordinator({
      store: fixture.store,
      sessions: fixture.sessions
    });
    await expect(
      reloaded.reload(prepared.commitment.paper_trading_comparison_commitment_id)
    ).rejects.toMatchObject({ code: "paper_trading_comparison_digest_mismatch" });
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });

  it("uses only StorePort reads for post-pair reload and verify", async () => {
    const fixture = await comparisonFixture();
    const prepared = await fixture.coordinator.prepare(fixture.input);
    const mutationCalls: string[] = [];
    const coordinator = new PaperTradingComparisonCoordinator({
      store: readOnlyStoreProxy(fixture.store, mutationCalls),
      sessions: sessionsPrepareMustNotRun()
    });

    const reloaded = await coordinator.reload(
      prepared.commitment.paper_trading_comparison_commitment_id
    );
    expect(reloaded).toBeDefined();
    await expect(coordinator.verify(reloaded!)).resolves.toEqual(reloaded);
    expect(mutationCalls).toEqual([]);
    expect(fixture.effects).toEqual({ providerStarts: 0, sandboxStarts: 0, marketReads: 0 });
  });
});

interface ComparisonFixtureOptions {
  duplicateChallengerSystemCode?: boolean;
  championAdmissionStatus?: "admitted" | "duplicate" | "quarantined";
  comparisonMode?: "bootstrap" | "champion_challenge";
  omitPromotion?: boolean;
  mismatchPromotion?: boolean;
  futureChampionAdmission?: boolean;
  missingPromotionEvaluation?: boolean;
  wrongPromotionEvaluationRef?: boolean;
  futurePromotion?: boolean;
  preAdmissionQualification?: boolean;
  reversePromotionObservationTime?: boolean;
  challengerSystemCodeAfterAdmission?: boolean;
}

async function comparisonFixture(options: ComparisonFixtureOptions = {}) {
  const store = new LocalStore(tmpDir);
  await store.initialize();
  const champion = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!champion) {
    throw new Error("fixture champion was not materialized");
  }
  const challengerCode = options.duplicateChallengerSystemCode
    ? await store.getSystemCode(FIXTURE_SYSTEM_CODE_ID)
    : comparisonChallengerSystemCode(
        options.challengerSystemCodeAfterAdmission
          ? "2026-07-09T20:57:00.000Z"
          : "2026-07-09T20:50:00.000Z"
      );
  if (!challengerCode) {
    throw new Error("comparison challenger SystemCode was not found");
  }
  if (!options.duplicateChallengerSystemCode) {
    await store.recordSystemCode(challengerCode);
  }
  const challengerOutcome = await store.materializeCandidate(
    comparisonChallengerMaterializationInput(challengerCode.system_code_id)
  );
  if (challengerOutcome.status !== "materialized") {
    throw new Error("comparison challenger was not materialized");
  }
  const challenger = challengerOutcome.candidate;
  const championAdmission = await recordCoordinatorAdmissionEvidence(
    store,
    champion,
    "champion",
    options.championAdmissionStatus ?? "admitted",
    options.futureChampionAdmission
      ? "2026-07-10T00:00:11.000Z"
      : options.preAdmissionQualification
        ? "2026-07-09T21:15:00.000Z"
        : "2026-07-09T20:55:00.000Z"
  );
  const challengerAdmission = await recordCoordinatorAdmissionEvidence(
    store,
    challenger,
    "challenger",
    "admitted",
    "2026-07-09T20:56:00.000Z"
  );
  const effects = { providerStarts: 0, sandboxStarts: 0, marketReads: 0 };
  const marketData: GatewayMarketDataPort = {
    provider_kind: "binance_production_public_market_data",
    source_kind: "binance_production_public_hybrid",
    rest_base_url: "https://example.invalid",
    required_endpoints: ["GET /fapi/v1/exchangeInfo", "GET /fapi/v1/premiumIndex"],
    authority_status: "read_only",
    async readMarketSnapshot() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read market data");
    },
    async readPublicMarketLivenessSurface() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read market liveness");
    },
    async readPublicExecutionSnapshot() {
      effects.marketReads += 1;
      throw new Error("comparison preparation read public execution");
    }
  };
  const runner = new PaperTradingEvaluationRunner();
  const sessions = new PaperTradingSessionService({
    store,
    intervalMs: 60_000,
    runner,
    marketData,
    artifactResolver: {
      async resolveArtifactDigest(systemCode) {
        return `sha256:resolved-${systemCode.system_code_id}`;
      }
    },
    sandboxAdapters: {
      deterministic_test: {
        async startArtifactInstance() {
          effects.sandboxStarts += 1;
          throw new Error("comparison preparation started a sandbox");
        }
      }
    } as never,
    async apiProviderFactory() {
      effects.providerStarts += 1;
      throw new Error("comparison preparation started a provider");
    }
  });
  let promotionEvidence = await recordCoordinatorQualifiedPromotionEvidence(
    store,
    sessions,
    champion,
    "champion",
    "2026-07-09T21:00:00.000Z"
  );
  if (options.reversePromotionObservationTime) {
    promotionEvidence = await reverseCoordinatorQualificationObservationTime(
      store,
      promotionEvidence
    );
  }
  const alternateChampionPromotionEvidence = options.wrongPromotionEvaluationRef
    ? await recordCoordinatorQualifiedPromotionEvidence(
        store,
        sessions,
        champion,
        "alternate-champion-authority",
        "2026-07-09T21:00:00.000Z"
      )
    : undefined;
  const promotion: TradingPromotionRecord = {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-coordinator-champion",
    status: "promoted_for_trading_review",
    candidate_ref: options.mismatchPromotion
      ? { record_kind: "trading_system_candidate", id: challenger.candidate_id }
      : { record_kind: "trading_system_candidate", id: champion.candidate_id },
    candidate_version_ref: options.mismatchPromotion
      ? {
          record_kind: "candidate_version",
          id: challenger.candidate_version.candidate_version_id
        }
      : {
          record_kind: "candidate_version",
          id: champion.candidate_version.candidate_version_id
        },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: promotionEvidence.evaluation.paper_trading_evaluation_id
    },
    promoted_at: options.futurePromotion
      ? "2026-07-10T00:00:11.000Z"
      : "2026-07-09T21:31:00.000Z",
    authority_status: "not_live"
  };
  if (options.missingPromotionEvaluation) {
    await rm(
      path.join(
        store.root(),
        "paper-trading-evaluations/items",
        `${encodeURIComponent(
          promotionEvidence.evaluation.paper_trading_evaluation_id
        )}.json`
      ),
      { force: true }
    );
  }
  if (!options.omitPromotion) {
    await store.recordTradingPromotion(promotion);
  }
  const coordinatorStore = options.wrongPromotionEvaluationRef
    ? (new Proxy(store, {
        get(target, property, receiver) {
          if (property === "getPaperTradingEvaluation") {
            return async (evaluationId: string) =>
              evaluationId === promotionEvidence.evaluation.paper_trading_evaluation_id
                ? structuredClone(alternateChampionPromotionEvidence!.evaluation)
                : target.getPaperTradingEvaluation(evaluationId);
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        }
      }) as OuroborosStorePort)
    : store;
  const coordinator = new PaperTradingComparisonCoordinator({
    store: coordinatorStore,
    sessions,
    now: () => "2026-07-10T00:00:10.000Z"
  });
  const input: PreparePaperTradingComparisonInput = {
    idempotencyKey: "paper-comparison-coordinator-001",
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
    comparisonPolicy: {
      ...comparisonPolicy,
      comparison_mode: options.comparisonMode ?? "champion_challenge"
    },
    marketDataConfigurationDigest: paperTradingMarketDataConfigurationDigest(marketData),
    paperPolicyIdentity: PAPER_TRADING_EVALUATION_POLICY_IDENTITY_V1
  };
  return {
    store,
    champion,
    challenger,
    championAdmission,
    challengerAdmission,
    promotion,
    promotionEvidence,
    alternateChampionPromotionEvidence,
    sessions,
    runner,
    coordinator,
    marketData,
    input,
    effects
  };
}

async function recordCoordinatorAdmissionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: "champion" | "challenger",
  status: "admitted" | "duplicate" | "quarantined",
  decidedAt: string
): Promise<CandidateAdmissionDecisionRecord> {
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) {
    throw new Error(`coordinator ${suffix} SystemCode was not found`);
  }
  const sourceDigest =
    status === "duplicate"
      ? systemCode.artifact_digest
      : `sha256:coordinator-admission-source-${suffix}`;
  const sourceSystemCode: SystemCodeRecord = {
    ...systemCode,
    system_code_id: `system-code-coordinator-admission-source-${suffix}`,
    artifact_digest: sourceDigest,
    provenance_refs: [],
    created_at: "2026-07-09T20:51:00.000Z"
  };
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: `experiment-run-coordinator-admission-${suffix}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: `research-worker-coordinator-admission-${suffix}`
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: `research-direction-coordinator-admission-${suffix}`
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: `trading-evaluation-task-coordinator-admission-${suffix}`
    },
    trace_ref: {
      record_kind: "trace_placeholder",
      id: `trace-coordinator-admission-${suffix}`
    },
    submitted_at: "2026-07-09T20:52:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: `trading-evaluation-result-coordinator-admission-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    evaluator_ref: {
      record_kind: "external_evaluator",
      id: "coordinator-admission-evaluator-v1"
    },
    result_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
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
    metric_refs: [{ record_kind: "metric_snapshot", id: `metric-admission-${suffix}` }],
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: `evaluator-trace-coordinator-admission-${suffix}`
    },
    completed_at: "2026-07-09T20:53:00.000Z",
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `research-finding-coordinator-admission-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "Complete external admission evidence for coordinator qualification tests.",
    supporting_record_refs: [
      {
        record_kind: "trading_evaluation_result",
        id: evaluation.trading_evaluation_result_id
      }
    ],
    created_at: "2026-07-09T20:54:00.000Z",
    authority_status: "research_trace_only"
  };
  const admission: CandidateAdmissionDecisionRecord = {
    record_kind: "candidate_admission_decision",
    version: 1,
    candidate_admission_decision_id: `candidate-admission-coordinator-${suffix}`,
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: { ...finding.trading_evaluation_result_ref },
    research_finding_ref: {
      record_kind: "research_finding",
      id: finding.research_finding_id
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: systemCode.artifact_digest,
    research_worker_outcome: status === "duplicate" ? "unchanged" : "changed",
    experiment_status: "evaluated",
    evaluation_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    evidence_disposition: "not_counted",
    status,
    reason:
      status === "admitted"
        ? "evaluation_accepted"
        : status === "duplicate"
          ? "no_candidate_change"
          : "evaluation_quarantined",
    runnable_paper_handoff: status === "admitted",
    decided_at: decidedAt,
    authority_status: "not_live"
  };
  await store.recordSystemCode(sourceSystemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  await store.recordCandidateAdmissionDecision(admission);
  return admission;
}

async function recordCoordinatorQualifiedPromotionEvidence(
  store: LocalStore,
  sessions: Pick<PaperTradingSessionService, "prepare">,
  candidate: CandidateInspectReadModel,
  suffix: string,
  startedAt: string
): Promise<{
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}> {
  const run = await store.createPaperTradingRun({
    idempotency_key: `coordinator-promotion-evidence-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: startedAt
  });
  vi.useFakeTimers();
  vi.setSystemTime(startedAt);
  const prepared = await sessions
    .prepare({
      candidateId: candidate.candidate_id,
      candidateVersionId: candidate.candidate_version.candidate_version_id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    })
    .finally(() => vi.useRealTimers());
  let evaluation: PaperTradingEvaluationRecord = prepared.evaluation;
  const observations: PaperTradingObservationRecord[] = [];
  for (let sequence = 1; sequence <= 30; sequence += 1) {
    const observedAt = new Date(Date.parse(startedAt) + sequence * 60_000).toISOString();
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id: `paper-observation-coordinator-promotion-${suffix}-${sequence}`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: prepared.commitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...prepared.commitment.candidate_ref },
      candidate_version_ref: { ...prepared.commitment.candidate_version_ref },
      trading_run_ref: { ...prepared.commitment.trading_run_ref },
      sequence,
      status: "no_order",
      observed_at: observedAt,
      ...(sequence === 30
        ? {
            market_snapshot: {
              symbol: "BTCUSDT" as const,
              price: 60_000,
              observed_at: observedAt,
              source_kind: "binance_production_public_rest" as const,
              authority_status: "read_only" as const
            }
          }
        : {}),
      paper_account_snapshot: structuredClone(prepared.commitment.initial_account_snapshot),
      open_orders: [],
      processed_trading_system_event_ids: [],
      processed_public_trade_ids: [],
      score_delta: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      },
      cumulative_score: {
        revenue_usdt: 0,
        cost_usdt: 0,
        net_revenue_usdt: 0,
        net_return_pct: 0
      },
      authority_status: "not_live"
    };
    const { next_observation_at: _next, stopped_at: _stopped, ...previous } = evaluation;
    evaluation = {
      ...previous,
      status: sequence === 30 ? "stopped" : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      ...(sequence === 30
        ? { stopped_at: observedAt }
        : {
            next_observation_at: new Date(
              Date.parse(startedAt) + (sequence + 1) * 60_000
            ).toISOString()
          })
    };
    await store.recordPaperTradingObservation(observation, evaluation);
    observations.push(observation);
  }
  expect(
    qualifyPaperTradingEvaluation({
      evaluation,
      commitment: prepared.commitment,
      observations,
      runnerActive: false
    })
  ).toMatchObject({
    qualification_status: "qualified",
    qualification_reasons: []
  });
  return { run, commitment: prepared.commitment, evaluation, observations };
}

async function reverseCoordinatorQualificationObservationTime(
  store: LocalStore,
  evidence: Awaited<ReturnType<typeof recordCoordinatorQualifiedPromotionEvidence>>
): Promise<Awaited<ReturnType<typeof recordCoordinatorQualifiedPromotionEvidence>>> {
  const observations = structuredClone(evidence.observations);
  const previous = observations[9];
  const current = observations[10];
  if (!previous || !current) {
    throw new Error("coordinator qualification fixture requires observations 10 and 11");
  }
  observations[10] = {
    ...current,
    observed_at: new Date(Date.parse(previous.observed_at) - 1_000).toISOString()
  };
  await writeCoordinatorRecord(
    store,
    "paper-trading-observations",
    current.paper_trading_observation_id,
    observations[10]
  );
  return { ...evidence, observations };
}

function comparisonChallengerSystemCode(
  createdAt = "2026-07-09T20:50:00.000Z"
): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-paper-comparison-challenger",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:paper-comparison-challenger",
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
      id: "candidate-arena-paper-system-code"
    },
    provenance_refs: [
      { record_kind: "research_finding", id: "comparison-challenger-finding" }
    ],
    status: "registered",
    created_at: createdAt,
    authority_status: "not_live"
  };
}

function comparisonChallengerMaterializationInput(
  systemCodeId: string
): CandidateMaterializationInput {
  return {
    idempotency_key: "paper-comparison-coordinator-challenger",
    provider: {
      provider_kind: "fixture_only",
      model: "comparison-fixture",
      invocation_surface: "vitest",
      agent_run_id: "agent-run-comparison-challenger",
      agent_event_id: "agent-event-comparison-challenger",
      trace_id: "trace-comparison-challenger",
      output_artifact_hash: "sha256:comparison-challenger-output"
    },
    candidate: {
      title: "Paper comparison challenger",
      system_summary: "Distinct candidate for inert prospective paper comparison preparation.",
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
    artifact_refs: [
      { record_kind: "provider_output_artifact", id: "comparison-challenger-output" }
    ],
    system_code_ref: { record_kind: "system_code", id: systemCodeId }
  };
}

function readOnlyStoreProxy(
  store: OuroborosStorePort,
  mutationCalls: string[],
  readCalls: string[] = []
): OuroborosStorePort {
  const allowedReads = new Set<keyof OuroborosStorePort>([
    "getCandidateForTradingRun",
    "getCandidateVersion",
    "getCandidateAdmissionDecision",
    "getTradingRun",
    "getSystemCode",
    "getTradingPromotion",
    "getPaperTradingEvaluationCommitment",
    "getPaperTradingEvaluation",
    "getPaperTradingComparisonPreparation",
    "getPaperTradingComparisonCommitment",
    "listPaperTradingEvaluationCommitments",
    "listPaperTradingEvaluations",
    "listPaperTradingObservations"
  ]);
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof value !== "function") {
        return value;
      }
      if (allowedReads.has(property as keyof OuroborosStorePort)) {
        readCalls.push(property);
        return value.bind(target);
      }
      return async () => {
        mutationCalls.push(property);
        throw new Error(`post_pair_mutation_attempt:${property}`);
      };
    }
  }) as OuroborosStorePort;
}

function sessionsPrepareMustNotRun(): Pick<PaperTradingSessionService, "prepare"> {
  return {
    async prepare() {
      throw new Error("post_pair_reload_called_sessions_prepare");
    }
  } as Pick<PaperTradingSessionService, "prepare">;
}

function withCoordinatorCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function withCoordinatorPreparationDigest(
  preparation: PaperTradingComparisonPreparationRecord
): PaperTradingComparisonPreparationRecord {
  return {
    ...preparation,
    preparation_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`
  };
}

function withCoordinatorPairDigest(
  commitment: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

async function rewriteCoordinatorFrozenSideDigestForSemanticTest(
  store: LocalStore,
  graph: VerifiedPaperTradingComparisonCommitmentGraph,
  updates: Partial<PaperTradingComparisonSide>
): Promise<void> {
  const preparation = withCoordinatorPreparationDigest({
    ...graph.preparation,
    champion: { ...graph.preparation.champion, ...updates },
    preparation_digest: ""
  });
  const pair = withCoordinatorPairDigest({
    ...graph.commitment,
    champion: { ...graph.commitment.champion, ...updates },
    commitment_digest: ""
  });
  await writeCoordinatorRecord(
    store,
    "paper-trading-comparison-preparations",
    preparation.paper_trading_comparison_preparation_id,
    preparation
  );
  await writeCoordinatorRecord(
    store,
    "paper-trading-comparison-commitments",
    pair.paper_trading_comparison_commitment_id,
    pair
  );
}

async function writeCoordinatorRecord(
  store: LocalStore,
  collection: string,
  id: string,
  value: unknown
): Promise<void> {
  await writeFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

async function readCoordinatorRecord<T>(
  store: LocalStore,
  collection: string,
  id: string
): Promise<T> {
  return JSON.parse(
    await readFile(
      path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
      "utf8"
    )
  ) as T;
}

async function persistedInertCounts(
  store: LocalStore,
  graph: VerifiedPaperTradingComparisonCommitmentGraph
): Promise<{
  commitments: number;
  evaluations: number;
  observations: number;
  runControlRefs: number;
}> {
  const runs = await Promise.all([
    store.getTradingRun(graph.champion.run.trading_run_id),
    store.getTradingRun(graph.challenger.run.trading_run_id)
  ]);
  const observations = await Promise.all([
    store.listPaperTradingObservations(
      graph.champion.evaluation.paper_trading_evaluation_id
    ),
    store.listPaperTradingObservations(
      graph.challenger.evaluation.paper_trading_evaluation_id
    )
  ]);
  return {
    commitments: (await store.listPaperTradingEvaluationCommitments()).length,
    evaluations: (await store.listPaperTradingEvaluations()).length,
    observations: observations[0].length + observations[1].length,
    runControlRefs: runs.reduce(
      (count, run) =>
        count +
        (run?.run_control_command_refs?.length ?? 0) +
        (run?.run_control_decision_refs?.length ?? 0) +
        (run?.runtime_audit_event_refs?.length ?? 0),
      0
    )
  };
}
