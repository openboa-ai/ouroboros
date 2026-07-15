import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CandidateArenaRunner } from "@ouroboros/application/candidate/arena";
import {
  OperatorService,
  selectedPaperTradingEvaluation
} from "@ouroboros/application/services/operator";
import { createPaperTradingEvaluationCommitment } from "@ouroboros/application/trading/paper/commitment";
import { initialPaperTradingEngineState } from "@ouroboros/application/trading/paper/engine";
import { PaperTradingComparisonPromotionServiceError } from
  "@ouroboros/application/trading/paper/comparison-promotion-service";
import type {
  CandidateMaterializationInput,
  OperatorReadModel,
  PaperTradingEvaluationRecord,
  PaperTradingEvidencePurpose,
  PaperTradingObservationRecord,
  RuntimeHeartbeatRecord,
  ResearchDirectionKind,
  SandboxCommandEvidenceRecord,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxRecord,
  SystemCodeRecord,
  TradingProfitLossReadModel,
  TradingPromotionRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { fakeGatewayMarketDataPort } from "./helpers/market-data";

let tmpDir: string;
let activePaperTradingRunIds: Set<string>;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-board-"));
  activePaperTradingRunIds = new Set();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("operator paper trading board", () => {
  it("ranks persisted paper evaluations by net revenue while keeping losing candidates visible", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const winning = await registerCandidate(store, {
      id: "winning-paper-board",
      title: "Winning Paper Candidate"
    });
    const losing = await registerCandidate(store, {
      id: "losing-paper-board",
      title: "Losing Paper Candidate"
    });

    await seedPaperEvaluation(store, {
      candidate: winning,
      netRevenueUsdt: 19.4,
      netReturnPct: 0.194,
      observationCount: 8,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      priorObservation: {
        netRevenueUsdt: 11.4,
        netReturnPct: 0.114,
        observedAt: "2026-05-16T00:01:00.000Z"
      }
    });
    await seedPaperEvaluation(store, {
      candidate: losing,
      netRevenueUsdt: -3.7,
      netReturnPct: -0.037,
      observationCount: 6,
      status: "stopped",
      runnerActive: false,
      sourcePriority: "rest_fallback",
      priorObservation: {
        netRevenueUsdt: -13.7,
        netReturnPct: -0.137,
        observedAt: "2026-05-16T00:01:00.000Z"
      }
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    const operator = await service.readOperator();

    expect(operator.paper_trading_board).toMatchObject({
      board_kind: "paper_trading_board",
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      evaluation_authority: "continuous_paper_trading",
      live_disabled: true,
      authority_status: "not_live"
    });
    expect(operator.paper_trading_board.entries.map((entry) => ({
        rank: entry.rank,
        candidate_id: entry.candidate_id,
        net_revenue_usdt: entry.profit_loss.net_revenue_usdt,
        net_revenue_delta_usdt: entry.trend.net_revenue_delta_usdt,
        trend_direction: entry.trend.direction,
        blocker_count: entry.blocker_density.blocker_count,
        blocker_density: entry.blocker_density.blocker_density,
        runner_status: entry.runner_status,
        promotion_gate_status: entry.promotion_gate_status
      }))).toEqual([
      {
        rank: 1,
        candidate_id: winning.candidate_id,
        net_revenue_usdt: 19.4,
        net_revenue_delta_usdt: 8,
        trend_direction: "improving",
        blocker_count: 2,
        blocker_density: 0.25,
        runner_status: "active",
        promotion_gate_status: "collecting_paper_evidence"
      },
      {
        rank: 2,
        candidate_id: losing.candidate_id,
        net_revenue_usdt: -3.7,
        net_revenue_delta_usdt: 10,
        trend_direction: "improving",
        blocker_count: 2,
        blocker_density: 0.333333,
        runner_status: "inactive",
        promotion_gate_status: "paper_evidence_recorded"
      }
    ]);
    expect(operator.paper_trading_board.entries[0]).toMatchObject({
      display_name: "Winning Paper Candidate",
      observation_count: 8,
      market_data_source: "binance_production_public_hybrid",
      latest_public_execution_source: "websocket_primary",
      open_order_count: 0,
      latest_fill_status: "filled"
    });
  });

  it("classifies latest paper failures into operator remediation groups without weakening qualification", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "paper-failure-classified",
      title: "Paper Failure Classified Candidate"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: -3,
      netReturnPct: -0.03,
      observationCount: 30,
      status: "failed",
      runnerActive: false,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z",
      failureReason: "fake public execution stream unavailable"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: () => false
      }
    });

    const operator = await service.readOperator();
    expect(operator.paper_trading_board.entries[0]).toMatchObject({
      candidate_id: candidate.candidate_id,
      qualification_status: "paper_failed",
      qualification_reasons: ["paper_evaluation_failed"],
      risk_summary: {
        latest_failure_reason: "fake public execution stream unavailable",
        latest_failure: {
          failure_kind: "public_execution_evidence_gap",
          reason: "fake public execution stream unavailable",
          summary: "Paper fill or execution evidence could not be tied to public execution data.",
          next_action: "Restore public execution evidence before trusting fills or paper score.",
          authority_status: "not_live"
        }
      },
      latest_failure: {
        failure_kind: "public_execution_evidence_gap",
        next_action: "Restore public execution evidence before trusting fills or paper score."
      }
    });
    expect(operator.selected_paper_trading_evaluation.latest_failure).toBeUndefined();
  });

  it("keeps selected candidate runtime evidence bounded in the operator overview", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "operator-selected-candidate-preview",
      title: "Operator Selected Candidate Preview"
    });
    await seedLargeSandboxHistory(store, candidate, 30);

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      }
    });
    await service.executeCommand("candidate.select", {
      candidate_id: candidate.candidate_id
    });

    const operator = await service.readOperator();
    const selected = operator.selected_candidate;

    expect(selected?.candidate_id).toBe(candidate.candidate_id);
    expect(selected?.runtime.transcript?.item_count).toBeGreaterThan(20);
    expect(selected?.runtime.transcript?.items).toHaveLength(20);
    expect(selected?.runtime.sandbox?.logs).toHaveLength(5);
    expect(selected?.runtime.sandbox?.heartbeats).toHaveLength(5);
    expect(selected?.runtime.sandbox?.command_evidence).toHaveLength(5);
    expect(selected?.runtime.sandbox?.log_refs).toHaveLength(30);
    expect(selected?.runtime.sandbox?.heartbeat_refs).toHaveLength(30);
    expect(selected?.runtime.sandbox?.command_evidence_refs).toHaveLength(30);
    expect(selected?.runtime.sandbox?.lifecycle_status).toBe("running");
    expect(selected?.runtime.sandbox?.last_heartbeat_at).toBe("2026-05-16T00:00:29.000Z");
    expect(Math.max(...selected!.runtime.sandbox!.logs.map((log) => log.lines.length))).toBe(5);
    expect(Math.max(...selected!.runtime.sandbox!.logs.flatMap((log) => log.lines.map((line) => line.length))))
      .toBeLessThanOrEqual(520);
    expect(Math.max(...selected!.runtime.sandbox!.command_evidence.map((evidence) => evidence.stdout.length)))
      .toBeLessThanOrEqual(520);
  });

  it("exposes qualification state separately from paper net revenue rank", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const mature = await registerCandidate(store, {
      id: "mature-paper-board",
      title: "Mature Paper Candidate"
    });
    const collecting = await registerCandidate(store, {
      id: "collecting-paper-board",
      title: "Collecting Paper Candidate"
    });
    const resume = await registerCandidate(store, {
      id: "resume-paper-board",
      title: "Resume Paper Candidate"
    });
    const blocked = await registerCandidate(store, {
      id: "blocked-paper-board",
      title: "Blocked Paper Candidate"
    });

    await seedPaperEvaluation(store, {
      candidate: mature,
      netRevenueUsdt: 10,
      netReturnPct: 0.1,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await seedPaperEvaluation(store, {
      candidate: collecting,
      netRevenueUsdt: 100,
      netReturnPct: 1,
      observationCount: 5,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:05:00.000Z"
    });
    await seedPaperEvaluation(store, {
      candidate: resume,
      netRevenueUsdt: 9,
      netReturnPct: 0.09,
      observationCount: 30,
      status: "running",
      runnerActive: false,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await seedPaperEvaluation(store, {
      candidate: blocked,
      netRevenueUsdt: 8,
      netReturnPct: 0.08,
      observationCount: 30,
      status: "stopped",
      runnerActive: false,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z",
      includePublicExecution: false
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    const operator = await service.readOperator();
    const byCandidate = new Map(operator.paper_trading_board.entries.map((entry) => [entry.candidate_id, entry]));

    expect(operator.paper_trading_board.entries[0]?.candidate_id).toBe(collecting.candidate_id);
    expect(byCandidate.get(collecting.candidate_id)).toMatchObject({
      qualification_status: "collecting_evidence",
      qualification_reasons: [
        "min_observation_count_not_met",
        "min_elapsed_ms_not_met"
      ],
      evidence_window: {
        observation_count: 5,
        failed_observation_count: 0,
        elapsed_ms: 5 * 60_000
      }
    });
    expect(byCandidate.get(mature.candidate_id)).toMatchObject({
      promotion_gate_status: "prospective_comparison_required",
      qualification_status: "qualified",
      qualification_reasons: []
    });
    expect(byCandidate.get(resume.candidate_id)).toMatchObject({
      qualification_status: "needs_resume",
      qualification_reasons: ["runner_inactive_for_running_evaluation"]
    });
    expect(byCandidate.get(blocked.candidate_id)).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["fill_public_execution_evidence_missing"]
    });
  });

  it("keeps mature profitable research feedback outside qualification and promotion", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "research-feedback-not-qualification",
      title: "Research Feedback Not Qualification"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 120,
      netReturnPct: 1.2,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z",
      evidencePurpose: "research_feedback"
    });
    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: { active: () => true }
    });

    await service.executeCommand("candidate.select", { candidate_id: candidate.candidate_id });
    const operator = await service.readOperator();

    expect(operator.selected_paper_trading_evaluation).toMatchObject({
      evidence_purpose: "research_feedback",
      freeze_status: "verified"
    });
    expect(operator.paper_trading_board.entries[0]).toMatchObject({
      candidate_id: candidate.candidate_id,
      evidence_purpose: "research_feedback",
      freeze_status: "verified",
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["evidence_purpose_not_qualification"],
      promotion_gate_status: "not_qualification_evidence"
    });
    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: candidate.candidate_id
    })).rejects.toMatchObject({
      statusCode: 409,
      error: "paper_trading_qualification_required",
      details: {
        paper_qualification_status: "not_qualification_evidence",
        paper_qualification_reasons: ["evidence_purpose_not_qualification"],
        next_action:
          "Run a prospective qualification comparison; research feedback cannot authorize promotion."
      }
    });
  });

  it("does not claim a frozen evaluation when its commitment is missing or mutated", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "paper-freeze-integrity",
      title: "Paper Freeze Integrity"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 12,
      netReturnPct: 0.12,
      observationCount: 3,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:03:00.000Z"
    });
    const evaluation = await store.getLatestPaperTradingEvaluationForCandidate(
      candidate.candidate_id
    );
    if (!evaluation?.paper_trading_evaluation_commitment_ref) {
      throw new Error("paper evaluation commitment ref missing");
    }
    const commitment = await store.getPaperTradingEvaluationCommitment(
      evaluation.paper_trading_evaluation_commitment_ref.id
    );
    if (!commitment) {
      throw new Error("paper evaluation commitment missing");
    }
    const mutatedCommitment = {
      ...commitment,
      policy_identity: {
        ...commitment.policy_identity,
        cost_policy_version: "mutated-after-commit"
      }
    };

    expect(selectedPaperTradingEvaluation(
      candidate,
      evaluation,
      mutatedCommitment
    ).freeze_status).toBeUndefined();
    expect(selectedPaperTradingEvaluation(
      candidate,
      { ...evaluation, status: "not_started" },
      undefined
    ).freeze_status).toBeUndefined();
  });

  it("blocks standalone qualification promotion until a prospective comparison verdict exists", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "standalone-qualification-no-verdict",
      title: "Standalone Qualification No Verdict"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: candidate.candidate_id
    })).rejects.toMatchObject({
      statusCode: 409,
      error: "paper_trading_comparison_required",
      details: {
        candidate_id: candidate.candidate_id,
        paper_trading_evaluation_id: `paper-evaluation-${candidate.candidate_id}`,
        paper_qualification_status: "qualified",
        required_evidence: "promotion_eligible_paper_trading_comparison_verdict"
      }
    });
    await expect(store.getLatestTradingPromotion()).resolves.toBeUndefined();
  });

  it("promotes a confirmed challenger through the explicit operator command", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "confirmed-command-promotion",
      title: "Confirmed Command Promotion"
    });
    const promotion = comparisonBackedPromotionForCandidate(candidate);
    const promoteCalls: Array<{ candidateId: string }> = [];
    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingComparisonPromotionService: {
        async promote(input) {
          promoteCalls.push(input);
          return promotion;
        }
      }
    });

    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: candidate.candidate_id
    })).resolves.toEqual({
      result: { promotion },
      summary: `Promoted ${candidate.candidate_id} to Trading review from confirmed paper comparison evidence.`
    });
    expect(promoteCalls).toEqual([{ candidateId: candidate.candidate_id }]);
  });

  it.each([
    [
      "paper_trading_comparison_promotion_stale",
      "paper_trading_comparison_stale"
    ],
    [
      "paper_trading_comparison_promotion_graph_invalid",
      "paper_trading_comparison_invalid"
    ],
    [
      "paper_trading_comparison_promotion_reference_not_found",
      "paper_trading_comparison_invalid"
    ],
    [
      "paper_trading_comparison_promotion_persistence_conflict",
      "paper_trading_comparison_invalid"
    ]
  ] as const)("maps %s to %s", async (serviceCode, operatorError) => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "comparison-promotion-error",
      title: "Comparison Promotion Error"
    });
    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingComparisonPromotionService: {
        async promote() {
          throw new PaperTradingComparisonPromotionServiceError(
            serviceCode,
            "comparison promotion failed"
          );
        }
      }
    });

    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: candidate.candidate_id
    })).rejects.toMatchObject({
      statusCode: 409,
      error: operatorError,
      details: {
        candidate_id: candidate.candidate_id
      }
    });
  });

  it("binds Trading review readback to the exact promotion evaluation and confirmation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await registerCandidate(store, {
      id: "exact-promotion-readback",
      title: "Exact Promotion Readback"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    const boundEvaluation = await store.getLatestPaperTradingEvaluationForCandidate(
      candidate.candidate_id
    );
    if (!boundEvaluation) {
      throw new Error("promotion-bound paper evaluation missing");
    }
    const newerEvaluationId = boundEvaluation.paper_trading_evaluation_id + "-newer";
    await writeNewerUnrelatedPaperEvaluation(
      store,
      boundEvaluation,
      newerEvaluationId
    );
    const promotion = await recordTradingPromotionForCandidate(
      store,
      candidate,
      "2026-05-16T00:32:00.000Z",
      boundEvaluation.paper_trading_evaluation_id
    );
    const projectionStore = comparisonConfirmationProjectionStore(store, promotion);
    const service = new OperatorService({
      store: projectionStore,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await service.executeCommand("candidate.select", {
      candidate_id: candidate.candidate_id
    });
    const operator = await service.readOperator();
    const confirmation = {
      campaign_id: promotion.comparison_confirmation.campaign_ref.id,
      campaign_outcome_id:
        promotion.comparison_confirmation.campaign_outcome_ref.id,
      final_verdict_id:
        promotion.comparison_confirmation.final_verdict_ref.id,
      required_window_count: 2,
      improved_window_count: 2,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 0.75,
      evaluated_at: "2026-05-16T00:31:30.000Z",
      evaluation_authority: "external_to_trading_systems",
      authority_status: "not_live"
    } as const;

    expect(operator.paper_trading_board.entries[0]?.evaluation_id).toBe(
      newerEvaluationId
    );
    expect(operator.trading_promotion).toMatchObject({
      paper_trading_evaluation_id:
        boundEvaluation.paper_trading_evaluation_id,
      paper_profit_loss: {
        net_revenue_usdt: 14.2,
        net_return_pct: 0.142
      },
      comparison_confirmation: confirmation
    });
    expect(operator.trading_review).toMatchObject({
      paper_trading_evaluation_id:
        boundEvaluation.paper_trading_evaluation_id,
      comparison_confirmation: confirmation,
      paper_trading_evaluation: {
        evaluation_id: boundEvaluation.paper_trading_evaluation_id,
        profit_loss: {
          net_revenue_usdt: 14.2,
          net_return_pct: 0.142
        }
      },
      review_packet: {
        subject: {
          paper_trading_evaluation_id:
            boundEvaluation.paper_trading_evaluation_id
        },
        evidence_quality: {
          comparison_confirmation: confirmation
        }
      }
    });
  });

  it("projects a persisted Trading review target without live authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const candidate = await registerCandidate(store, {
      id: "promotion-paper-board",
      title: "Promotion Paper Candidate",
      fullCycleLineage: {
        parentCandidateId: "candidate-parent-alpha",
        parentCandidateVersionId: "candidate-version-parent-alpha",
        directionKind: "trend_following",
        evaluationStatus: "accepted",
        evaluationScore: 14.2,
        profitLoss: {
          revenue_usdt: 14.8,
          cost_usdt: 0.6,
          net_revenue_usdt: 14.2,
          net_return_pct: 0.142
        }
      }
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await store.recordLedger({
      idempotency_key: "promotion-review-ledger-complete",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: candidate.runtime.ref.id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "65200"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "dry_run_allowed"
      },
      execution_result: {
        status: "dry_run_recorded",
        result_reason: "dry_run_allowed",
        completed_at: "2026-05-16T00:31:01.000Z"
      },
      created_at: "2026-05-16T00:31:00.000Z"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await recordTradingPromotionForCandidate(store, candidate);
    await service.executeCommand("candidate.select", {
      candidate_id: candidate.candidate_id
    });
    const operator = await service.readOperator();
    const promotionRecord = await store.getLatestTradingPromotion();

    expect(promotionRecord?.candidate_ref).toEqual({
      record_kind: "trading_system_candidate",
      id: candidate.candidate_id
    });
    expect(operator.selected_candidate_id).toBe(candidate.candidate_id);
    expect(operator.trading_promotion).toMatchObject({
      status: "promoted_for_trading_review",
      readiness_status: "promoted_for_trading_review",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      display_name: "Promotion Paper Candidate",
      paper_qualification_status: "qualified",
      paper_qualification_reasons: [],
      paper_profit_loss: {
        net_revenue_usdt: 14.2,
        net_return_pct: 0.142
      },
      runner_status: "active",
      live_disabled_reason: "mlp_paper_only",
      authority_status: "not_live"
    });
    expect(operator.trading_review).toMatchObject({
      status: "promoted_for_trading_review",
      readiness_status: "promoted_for_trading_review",
      active_candidate_id: candidate.candidate_id,
      active_candidate_version_id: candidate.candidate_version.candidate_version_id,
      display_name: "Promotion Paper Candidate",
      paper_trading_evaluation_id: `paper-evaluation-${candidate.candidate_id}`,
      selected_candidate_id: candidate.candidate_id,
      selected_matches_trading_review: true,
      review_packet: {
        packet_kind: "trading_review_packet",
        verdict: {
          readiness_status: "promoted_for_trading_review",
          qualification_status: "qualified",
          severity: "ready"
        },
        subject: {
          candidate_id: candidate.candidate_id,
          candidate_version_id: candidate.candidate_version.candidate_version_id,
          display_name: "Promotion Paper Candidate",
          paper_trading_evaluation_id: `paper-evaluation-${candidate.candidate_id}`,
          promoted_at: promotionRecord?.promoted_at,
          selected_candidate_id: candidate.candidate_id,
          selected_matches_trading_review: true
        },
        performance: {
          rank: 1,
          primary_rank_metric: "net_revenue_usdt",
          secondary_rank_metric: "net_return_pct",
          profit_loss: {
            net_revenue_usdt: 14.2,
            net_return_pct: 0.142
          }
        },
        evidence_quality: {
          evidence_window: {
            observation_count: 30,
            failed_observation_count: 0,
            elapsed_ms: 31 * 60_000,
            first_observed_at: "2026-05-16T00:01:02.000Z",
            last_observed_at: "2026-05-16T00:31:00.000Z"
          },
          qualification_reasons: [],
          blocker_groups: []
        },
        provenance: {
          market_data_source: "binance_production_public_hybrid",
          latest_public_execution_source: "websocket_primary",
          latest_public_execution_freshness: "fresh",
          latest_public_execution_ws_connected: true,
          latest_public_execution_rest_fallback_used: false,
          latest_public_execution_stream_marker: `websocket_primary-${candidate.candidate_id}`,
          latest_fill_status: "filled",
          order_book: {
            sync_status: "synced",
            last_update_id: "65200",
            previous_final_update_id: "65199",
            gap_detected: false,
            depth_level_count: 100,
            authority_status: "read_only"
          }
        },
        risk: {
          open_order_count: 0,
          account: {
            equity_usdt: "10014.2",
            available_balance_usdt: "10014.2",
            wallet_balance_usdt: "10014.2",
            margin_reserved_usdt: "0",
            authority_status: "not_live"
          },
          position: {
            symbol: "BTCUSDT",
            side: "long",
            quantity: "0.001",
            notional_usdt: "65.2",
            average_entry_price: "65000",
            mark_price: "65200",
            authority_status: "not_live"
          },
          latest_fill_status: "filled"
        },
        runner: {
          runner_status: "active",
          runner_active: true,
          trading_run_status: "registered",
          last_observed_at: "2026-05-16T00:31:00.000Z",
          next_observation_at: "2026-05-16T00:40:00.000Z",
          authority_status: "not_live"
        },
        ledger: {
          evidence_status: "complete_chain",
          ledger_chain_complete: true,
          latest_order_request_id: expect.any(String),
          latest_gateway_outcome: "dry_run_only",
          latest_execution_status: "dry_run_recorded",
          authority_status: "not_live"
        },
        lineage: {
          lineage_status: "available",
          direction_kind: "trend_following",
          parent_candidate_id: "candidate-parent-alpha",
          parent_candidate_version_id: "candidate-version-parent-alpha",
          generated_by_agent: true,
          latest_finding: "Candidate produced non-negative net revenue after costs.",
          evaluation_status: "accepted",
          evaluation_score: 14.2,
          profit_loss: {
            net_revenue_usdt: 14.2,
            net_return_pct: 0.142
          },
          paper_board_learning: {
            rank: 1,
            net_revenue_usdt: 14.2,
            net_return_pct: 0.142,
            observation_count: 30,
            qualification_status: "qualified",
            qualification_reasons: [],
            summary: "Paper board rank #1: 14.2 net_revenue_usdt, 0.142 net_return_pct, 30 observations, qualified.",
            next_research_focus: "Preserve the profitable lineage and generate controlled variants under paper evidence.",
            authority_status: "lineage_only"
          },
          authority_status: "lineage_only"
        },
        authority: {
          authority_status: "not_live",
          live_disabled_reason: "mlp_paper_only",
          no_authority: {
            live_exchange_authority: false,
            private_read_authority: false,
            order_submission_authority: false,
            credentials: false
          }
        }
      },
      authority_status: "not_live"
    });
  });

  it("keeps the Trading review target separate from the Arena selected candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const promoted = await registerCandidate(store, {
      id: "promoted-review-target",
      title: "Promoted Review Target"
    });
    const arenaSelected = await registerCandidate(store, {
      id: "arena-selected-after-promotion",
      title: "Arena Selected After Promotion"
    });
    await seedPaperEvaluation(store, {
      candidate: promoted,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    const promotedEvaluation = await store.getLatestPaperTradingEvaluationForCandidate(
      promoted.candidate_id
    );
    if (!promotedEvaluation) {
      throw new Error("promoted target paper evaluation missing");
    }

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await recordTradingPromotionForCandidate(store, promoted);
    await service.executeCommand("candidate.select", {
      candidate_id: arenaSelected.candidate_id
    });

    const operator = await service.readOperator();

    expect(operator.selected_candidate_id).toBe(arenaSelected.candidate_id);
    expect(operator.trading_review).toMatchObject({
      status: "promoted_for_trading_review",
      active_candidate_id: promoted.candidate_id,
      display_name: "Promoted Review Target",
      selected_candidate_id: arenaSelected.candidate_id,
      selected_matches_trading_review: false,
      review_packet: {
        verdict: {
          severity: "mismatch",
          top_blocker: "arena_selection_mismatch"
        },
        subject: {
          candidate_id: promoted.candidate_id,
          selected_candidate_id: arenaSelected.candidate_id,
          selected_matches_trading_review: false
        },
        evidence_quality: {
          blocker_groups: [
            {
              group_kind: "selection",
              severity: "mismatch",
              blockers: ["arena_selection_mismatch"]
            }
          ]
        },
        runner: {
          runner_status: "active",
          runner_active: true,
          trading_run_status: "registered",
          last_observed_at: "2026-05-16T00:31:00.000Z",
          next_observation_at: "2026-05-16T00:40:00.000Z",
          authority_status: "not_live"
        },
        ledger: {
          evidence_status: "incomplete_chain",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }
      },
      paper_trading_evaluation: {
        candidate_id: promoted.candidate_id,
        trading_run_id: promotedEvaluation.trading_run_ref.id
      }
    });
  });

  it("projects the latest persisted Trading review target replacement explicitly", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const activeTarget = await registerCandidate(store, {
      id: "active-review-target-before-replacement",
      title: "Active Review Target Before Replacement"
    });
    const replacement = await registerCandidate(store, {
      id: "qualified-review-replacement",
      title: "Qualified Review Replacement"
    });
    await seedPaperEvaluation(store, {
      candidate: activeTarget,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await seedPaperEvaluation(store, {
      candidate: replacement,
      netRevenueUsdt: 18.4,
      netReturnPct: 0.184,
      observationCount: 32,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:40:00.000Z"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await recordTradingPromotionForCandidate(
      store,
      activeTarget,
      "2026-05-16T00:32:00.000Z"
    );
    await service.executeCommand("candidate.select", {
      candidate_id: replacement.candidate_id
    });
    await recordTradingPromotionForCandidate(
      store,
      replacement,
      "2026-05-16T00:42:00.000Z"
    );
    const operator = await service.readOperator();
    const promotionRecord = await store.getLatestTradingPromotion();

    expect(promotionRecord?.candidate_ref).toEqual({
      record_kind: "trading_system_candidate",
      id: replacement.candidate_id
    });
    expect(promotionRecord?.authority_status).toBe("not_live");
    expect(operator.selected_candidate_id).toBe(replacement.candidate_id);
    expect(operator.trading_review).toMatchObject({
      status: "promoted_for_trading_review",
      readiness_status: "promoted_for_trading_review",
      active_candidate_id: replacement.candidate_id,
      display_name: "Qualified Review Replacement",
      selected_candidate_id: replacement.candidate_id,
      selected_matches_trading_review: true,
      authority_status: "not_live",
      review_packet: {
        verdict: {
          qualification_status: "qualified",
          severity: "ready"
        },
        subject: {
          candidate_id: replacement.candidate_id,
          selected_candidate_id: replacement.candidate_id,
          selected_matches_trading_review: true
        },
        authority: {
          authority_status: "not_live",
          live_disabled_reason: "mlp_paper_only"
        }
      }
    });
  });

  it("blocks Trading review promotion until paper evidence is qualified", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const candidate = await registerCandidate(store, {
      id: "collecting-promotion-paper-board",
      title: "Collecting Promotion Candidate"
    });
    await seedPaperEvaluation(store, {
      candidate,
      netRevenueUsdt: 100,
      netReturnPct: 1,
      observationCount: 5,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:05:00.000Z"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: candidate.candidate_id
    })).rejects.toMatchObject({
      statusCode: 409,
      error: "paper_trading_qualification_required",
      details: {
        candidate_id: candidate.candidate_id,
        paper_qualification_status: "collecting_evidence",
        paper_qualification_reasons: [
          "min_observation_count_not_met",
          "min_elapsed_ms_not_met"
        ],
        required_command: `ouroboros candidate paper start ${candidate.candidate_id}`
      }
    });
    await expect(store.getLatestTradingPromotion()).resolves.toBeUndefined();
  });

  it("keeps the active Trading review target when replacement paper evidence is not qualified", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const activeTarget = await registerCandidate(store, {
      id: "active-review-target-kept",
      title: "Active Review Target Kept"
    });
    const collectingReplacement = await registerCandidate(store, {
      id: "collecting-review-replacement",
      title: "Collecting Review Replacement"
    });
    await seedPaperEvaluation(store, {
      candidate: activeTarget,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await seedPaperEvaluation(store, {
      candidate: collectingReplacement,
      netRevenueUsdt: 100,
      netReturnPct: 1,
      observationCount: 5,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:05:00.000Z"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => activePaperTradingRunIds.has(tradingRunId)
      }
    });

    await recordTradingPromotionForCandidate(store, activeTarget);
    await service.executeCommand("candidate.select", {
      candidate_id: collectingReplacement.candidate_id
    });

    await expect(service.executeCommand("trading_candidate.promote", {
      candidate_id: collectingReplacement.candidate_id
    })).rejects.toMatchObject({
      statusCode: 409,
      error: "paper_trading_qualification_required",
      details: {
        active_trading_review_candidate_id: activeTarget.candidate_id,
        attempted_replacement_candidate_id: collectingReplacement.candidate_id,
        candidate_id: collectingReplacement.candidate_id,
        paper_qualification_status: "collecting_evidence",
        paper_qualification_reasons: [
          "min_observation_count_not_met",
          "min_elapsed_ms_not_met"
        ],
        next_action: "Continue paper trading until the evidence window qualifies."
      }
    });

    const operator = await service.readOperator();
    expect(operator.selected_candidate_id).toBe(collectingReplacement.candidate_id);
    expect(operator.trading_review).toMatchObject({
      active_candidate_id: activeTarget.candidate_id,
      selected_candidate_id: collectingReplacement.candidate_id,
      selected_matches_trading_review: false,
      authority_status: "not_live"
    });
  });

  it("projects Trading review packet blockers for not-promoted, needs-resume, blocked, and failed states", async () => {
    const emptyStore = new LocalStore(path.join(tmpDir, "empty"));
    await emptyStore.initialize();
    const emptyOperator = await new OperatorService({
      store: emptyStore,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      }
    }).readOperator();
    expect(emptyOperator.trading_review.review_packet).toMatchObject({
      verdict: {
        severity: "collecting",
        top_blocker: "paper_required"
      },
      evidence_quality: {
        blocker_groups: [
          {
            group_kind: "evidence_window",
            severity: "collecting",
            blockers: ["paper_required"]
          }
        ]
      }
    });

    const resumeStore = new LocalStore(path.join(tmpDir, "resume"));
    await resumeStore.initialize();
    const resume = await registerCandidate(resumeStore, {
      id: "resume-packet-state",
      title: "Resume Packet Candidate"
    });
    await seedPaperEvaluation(resumeStore, {
      candidate: resume,
      netRevenueUsdt: 14.2,
      netReturnPct: 0.142,
      observationCount: 30,
      status: "running",
      runnerActive: true,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    let resumeRunnerActive = true;
    const resumeService = new OperatorService({
      store: resumeStore,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: () => resumeRunnerActive
      }
    });
    await recordTradingPromotionForCandidate(resumeStore, resume);
    await resumeService.executeCommand("candidate.select", {
      candidate_id: resume.candidate_id
    });
    resumeRunnerActive = false;
    const resumeOperator = await resumeService.readOperator();
    expect(resumeOperator.trading_review.review_packet).toMatchObject({
      verdict: {
        severity: "needs_resume",
        top_blocker: "runner_inactive_for_running_evaluation"
      },
      evidence_quality: {
        blocker_groups: [
          {
            group_kind: "runner_health",
            severity: "needs_resume",
            blockers: ["runner_inactive_for_running_evaluation"]
          }
        ]
      }
    });

    const blockedStore = new LocalStore(path.join(tmpDir, "blocked"));
    await blockedStore.initialize();
    const blocked = await registerCandidate(blockedStore, {
      id: "blocked-packet-state",
      title: "Blocked Packet Candidate"
    });
    await seedPaperEvaluation(blockedStore, {
      candidate: blocked,
      netRevenueUsdt: 8,
      netReturnPct: 0.08,
      observationCount: 30,
      status: "stopped",
      runnerActive: false,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z",
      includePublicExecution: false
    });
    await recordTradingPromotionForCandidate(blockedStore, blocked);
    const blockedService = new OperatorService({
      store: blockedStore,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      }
    });
    await blockedService.executeCommand("candidate.select", {
      candidate_id: blocked.candidate_id
    });
    const blockedOperator = await blockedService.readOperator();
    expect(blockedOperator.trading_review.review_packet).toMatchObject({
      verdict: {
        severity: "blocked",
        top_blocker: "fill_public_execution_evidence_missing"
      },
      evidence_quality: {
        blocker_groups: [
          {
            group_kind: "fill_provenance",
            severity: "blocked",
            blockers: ["fill_public_execution_evidence_missing"]
          }
        ]
      }
    });

    const failedStore = new LocalStore(path.join(tmpDir, "failed"));
    await failedStore.initialize();
    const failed = await registerCandidate(failedStore, {
      id: "failed-packet-state",
      title: "Failed Packet Candidate"
    });
    await seedPaperEvaluation(failedStore, {
      candidate: failed,
      netRevenueUsdt: -4,
      netReturnPct: -0.04,
      observationCount: 30,
      status: "failed",
      runnerActive: false,
      sourcePriority: "websocket_primary",
      observedAt: "2026-05-16T00:31:00.000Z"
    });
    await recordTradingPromotionForCandidate(failedStore, failed);
    const failedService = new OperatorService({
      store: failedStore,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      }
    });
    await failedService.executeCommand("candidate.select", {
      candidate_id: failed.candidate_id
    });
    const failedOperator = await failedService.readOperator();
    expect(failedOperator.trading_review.review_packet).toMatchObject({
      verdict: {
        severity: "failed",
        top_blocker: "paper_evaluation_failed"
      },
      evidence_quality: {
        blocker_groups: [
          {
            group_kind: "observation_quality",
            severity: "failed",
            blockers: ["paper_evaluation_failed"]
          }
        ]
      }
    });
  });
});

async function registerCandidate(
  store: LocalStore,
  input: {
    id: string;
    title: string;
    fullCycleLineage?: {
      parentCandidateId: string;
      parentCandidateVersionId: string;
      directionKind: ResearchDirectionKind;
      evaluationStatus: string;
      evaluationScore: number;
      profitLoss: TradingProfitLossReadModel;
    };
  }
): Promise<NonNullable<Awaited<ReturnType<LocalStore["getCandidate"]>>>> {
  const systemCode: SystemCodeRecord = {
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-${input.id}`,
    artifact_kind: "python_file",
    artifact_path: `/tmp/${input.id}.py`,
    artifact_digest: `sha256:${input.id}`,
    runtime_kind: "python",
    entrypoint: ["python3", `/tmp/${input.id}.py`],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["order_request", "runtime_log"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "paper-only" },
    provenance_refs: [{ record_kind: "test_fixture", id: input.id }],
    status: "registered",
    created_at: "2026-05-16T00:00:00.000Z",
    authority_status: "not_live"
  };
  await store.recordSystemCode(systemCode);
  const outcome = await store.materializeCandidate(candidateMaterializationInput(input, systemCode.system_code_id));
  if (outcome.status !== "materialized") {
    throw new Error(`candidate materialization failed for ${input.id}`);
  }
  const candidate = await store.getCandidate(outcome.candidate.candidate_id);
  if (!candidate) {
    throw new Error(`candidate readback failed for ${input.id}`);
  }
  return candidate;
}

function candidateMaterializationInput(
  input: {
    id: string;
    title: string;
    fullCycleLineage?: {
      parentCandidateId: string;
      parentCandidateVersionId: string;
      directionKind: ResearchDirectionKind;
      evaluationStatus: string;
      evaluationScore: number;
      profitLoss: TradingProfitLossReadModel;
    };
  },
  systemCodeId: string
): CandidateMaterializationInput {
  return {
    idempotency_key: `paper-board-${input.id}`,
    provider: {
      provider_kind: "fixture_only",
      model: "paper-board-test",
      invocation_surface: "test",
      agent_run_id: `agent-run-${input.id}`,
      agent_event_id: `agent-event-${input.id}`,
      trace_id: `trace-${input.id}`,
      output_artifact_hash: `sha256:${input.id}`
    },
    candidate: {
      title: input.title,
      system_summary: `${input.title} paper board test candidate.`,
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: `${input.title} BTCUSDT paper candidate.`,
      market: "Binance USD-M Futures",
      instrument: "BTCUSDT",
      supported_stage_binding_profiles: ["backtest", "paper"]
    },
    program: {
      summary: `${input.title} emits paper order events.`,
      declared_runtime: "python-sandbox",
      declared_outputs: ["OrderRequest"]
    },
    capability_package: {
      summary: "Gateway paper API only.",
      allowed_stages: ["paper"],
      declared_permissions: ["read_gateway_paper_market_snapshot"],
      forbidden_contents: ["exchange_credentials", "signed_requests", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "test_fixture", id: input.id }],
    system_code_ref: { record_kind: "system_code", id: systemCodeId },
    full_cycle_lineage: input.fullCycleLineage
      ? {
          source: {
            trading_system_id: input.fullCycleLineage.parentCandidateId,
            candidate_version_id: input.fullCycleLineage.parentCandidateVersionId,
            system_code_ref: { record_kind: "system_code", id: `system-code-${input.fullCycleLineage.parentCandidateId}` }
          },
          generated: {
            system_code_ref: { record_kind: "system_code", id: systemCodeId },
            artifact_digest: `sha256:${input.id}`,
            generated_by_agent: true
          },
          evaluation: {
            status: input.fullCycleLineage.evaluationStatus,
            score: input.fullCycleLineage.evaluationScore,
            profit_loss: input.fullCycleLineage.profitLoss,
            direction_kind: input.fullCycleLineage.directionKind
          }
        }
      : undefined
  };
}

async function seedPaperEvaluation(
  store: LocalStore,
  input: {
    candidate: NonNullable<Awaited<ReturnType<LocalStore["getCandidate"]>>>;
    netRevenueUsdt: number;
    netReturnPct: number;
    observationCount: number;
    status: PaperTradingEvaluationRecord["status"];
    runnerActive: boolean;
    sourcePriority: "websocket_primary" | "rest_fallback";
    observedAt?: string;
    includePublicExecution?: boolean;
    failureReason?: string;
    evidencePurpose?: PaperTradingEvidencePurpose;
    priorObservation?: {
      netRevenueUsdt: number;
      netReturnPct: number;
      observedAt: string;
    };
  }
): Promise<void> {
  const evaluationId = `paper-evaluation-${input.candidate.candidate_id}`;
  const finalObservedAt = input.observedAt ?? "2026-05-16T00:08:00.000Z";
  const evidencePurpose = input.evidencePurpose ?? "qualification";
  let paperCandidate = input.candidate;
  if (evidencePurpose === "qualification") {
    const paperRun = await store.createPaperTradingRun({
      idempotency_key: `operator-paper-board:${input.candidate.candidate_id}:qualification`,
      candidate_id: input.candidate.candidate_id,
      candidate_version_id: input.candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: "2026-05-16T00:00:00.000Z"
    });
    const projected = await store.getCandidateForTradingRun(paperRun.trading_run_id);
    if (!projected) {
      throw new Error(`missing qualification TradingRun projection for ${input.candidate.candidate_id}`);
    }
    paperCandidate = projected;
  }
  const systemCodeId = input.candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) {
    throw new Error(`missing SystemCode for ${input.candidate.candidate_id}`);
  }
  const initialState = initialPaperTradingEngineState();
  const commitment = createPaperTradingEvaluationCommitment({
    commitmentId: `paper-commitment-${input.candidate.candidate_id}`,
    evidencePurpose,
    candidate: paperCandidate,
    systemCode,
    resolvedArtifactDigest: systemCode.artifact_digest,
    marketData: fakeGatewayMarketDataPort(),
    intervalMs: 60_000,
    initialAccountSnapshot: initialState.account,
    committedAt: "2026-05-16T00:00:00.000Z"
  });
  await store.recordPaperTradingEvaluationCommitment(commitment);
  if (input.runnerActive) {
    activePaperTradingRunIds.add(commitment.trading_run_ref.id);
  }

  let evaluation: PaperTradingEvaluationRecord = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: 60_000,
    observation_count: 0,
    started_at: "2026-05-16T00:00:00.000Z",
    latest_score: zeroPaperScore(),
    paper_account_snapshot: commitment.initial_account_snapshot,
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
  await store.recordPaperTradingEvaluation(evaluation);

  for (let sequence = 1; sequence <= input.observationCount; sequence += 1) {
    const isFinal = sequence === input.observationCount;
    const observedAt = isFinal
      ? finalObservedAt
      : input.priorObservation && sequence === 1
        ? input.priorObservation.observedAt
        : interpolatedPaperObservedAt(finalObservedAt, sequence, input.observationCount);
    const score = paperScoreAtSequence(input, sequence);
    const scoreDelta = subtractPaperScore(score, evaluation.latest_score);
    const account = paperBoardAccount(score);
    const marketSnapshot = paperBoardMarketSnapshot(observedAt, input.sourcePriority);
    const executionSnapshot = isFinal && input.includePublicExecution !== false
      ? paperBoardExecutionSnapshot(input.candidate.candidate_id, observedAt, input.sourcePriority)
      : undefined;
    const latestFill = isFinal
      ? paperBoardFill(input.candidate.candidate_id, observedAt)
      : undefined;
    const nextEvaluation: PaperTradingEvaluationRecord = {
      ...evaluation,
      status: isFinal ? input.status : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      next_observation_at: isFinal && input.status === "running"
        ? "2026-05-16T00:40:00.000Z"
        : undefined,
      latest_score: score,
      paper_account_snapshot: account,
      open_orders: [],
      latest_fill: latestFill ?? evaluation.latest_fill,
      latest_public_execution_snapshot: executionSnapshot ??
        evaluation.latest_public_execution_snapshot,
      latest_failure_reason: isFinal ? input.failureReason : undefined
    };
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id:
        `paper-observation-${input.candidate.candidate_id}-${String(sequence).padStart(4, "0")}`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluationId
      },
      paper_trading_evaluation_commitment_ref:
        evaluation.paper_trading_evaluation_commitment_ref,
      candidate_ref: commitment.candidate_ref,
      candidate_version_ref: commitment.candidate_version_ref,
      trading_run_ref: commitment.trading_run_ref,
      sequence,
      status: isFinal && input.failureReason ? "failed" : "recorded",
      observed_at: observedAt,
      market_snapshot: marketSnapshot,
      public_execution_snapshot: executionSnapshot,
      paper_account_snapshot: account,
      open_orders: [],
      latest_fill: latestFill,
      score_delta: scoreDelta,
      cumulative_score: score,
      failure_reason: isFinal ? input.failureReason : undefined,
      authority_status: "not_live"
    };
    await store.recordPaperTradingObservation(observation, nextEvaluation);
    evaluation = nextEvaluation;
  }
}

function zeroPaperScore(): TradingProfitLossReadModel {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
}

function paperScoreAtSequence(
  input: {
    netRevenueUsdt: number;
    netReturnPct: number;
    observationCount: number;
    priorObservation?: {
      netRevenueUsdt: number;
      netReturnPct: number;
    };
  },
  sequence: number
): TradingProfitLossReadModel {
  const progress = input.priorObservation && input.observationCount > 1
    ? (sequence - 1) / (input.observationCount - 1)
    : sequence / input.observationCount;
  const startRevenue = input.priorObservation?.netRevenueUsdt ?? 0;
  const startReturn = input.priorObservation?.netReturnPct ?? 0;
  const netRevenue = sequence === input.observationCount
    ? input.netRevenueUsdt
    : roundPaperValue(startRevenue + (input.netRevenueUsdt - startRevenue) * progress);
  const netReturn = sequence === input.observationCount
    ? input.netReturnPct
    : roundPaperValue(startReturn + (input.netReturnPct - startReturn) * progress);
  const cost = sequence === input.observationCount ? 0.6 : roundPaperValue(0.6 * progress);
  return {
    revenue_usdt: roundPaperValue(netRevenue + cost),
    cost_usdt: cost,
    net_revenue_usdt: netRevenue,
    net_return_pct: netReturn
  };
}

function subtractPaperScore(
  next: TradingProfitLossReadModel,
  previous: TradingProfitLossReadModel
): TradingProfitLossReadModel {
  return {
    revenue_usdt: roundPaperValue(next.revenue_usdt - previous.revenue_usdt),
    cost_usdt: roundPaperValue(next.cost_usdt - previous.cost_usdt),
    net_revenue_usdt: roundPaperValue(next.net_revenue_usdt - previous.net_revenue_usdt),
    net_return_pct: roundPaperValue(next.net_return_pct - previous.net_return_pct)
  };
}

function paperBoardAccount(score: TradingProfitLossReadModel) {
  const fee = roundPaperValue(score.cost_usdt / 3);
  const slippage = roundPaperValue(score.cost_usdt / 3);
  const funding = roundPaperValue(score.cost_usdt - fee - slippage);
  const equity = roundPaperValue(10_000 + score.net_revenue_usdt);
  return {
    wallet_balance_usdt: `${equity}`,
    available_balance_usdt: `${equity}`,
    equity_usdt: `${equity}`,
    realized_pnl_usdt: `${score.revenue_usdt}`,
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: `${fee}`,
    slippage_paid_usdt: `${slippage}`,
    funding_paid_usdt: `${funding}`,
    margin_reserved_usdt: "0",
    position: {
      symbol: "BTCUSDT" as const,
      quantity: "0.001",
      side: "long" as const,
      average_entry_price: "65000",
      mark_price: "65200",
      notional_usdt: "65.2"
    },
    open_order_count: 0,
    authority_status: "not_live" as const
  };
}

function paperBoardMarketSnapshot(
  observedAt: string,
  sourcePriority: "websocket_primary" | "rest_fallback"
) {
  return {
    symbol: "BTCUSDT" as const,
    price: 65_200,
    moving_average_fast: 65_240,
    moving_average_slow: 65_050,
    volatility: 0.0014,
    expected_direction: "long" as const,
    observed_at: observedAt,
    source_kind: "binance_production_public_hybrid" as const,
    source_priority: sourcePriority,
    freshness: "fresh" as const,
    ws_connected: sourcePriority === "websocket_primary",
    rest_fallback_used: sourcePriority === "rest_fallback",
    authority_status: "read_only" as const
  };
}

function paperBoardExecutionSnapshot(
  candidateId: string,
  observedAt: string,
  sourcePriority: "websocket_primary" | "rest_fallback"
) {
  return {
    symbol: "BTCUSDT" as const,
    observed_at: observedAt,
    source_kind: "binance_production_public_hybrid" as const,
    source_priority: sourcePriority,
    freshness: "fresh" as const,
    ws_connected: sourcePriority === "websocket_primary",
    rest_fallback_used: sourcePriority === "rest_fallback",
    stream_marker: `${sourcePriority}-${candidateId}`,
    agg_trades: [{
      trade_id: `trade-${candidateId}`,
      price: "65200",
      quantity: "0.001",
      trade_time: observedAt
    }],
    order_book: {
      symbol: "BTCUSDT" as const,
      observed_at: observedAt,
      source_kind: "binance_production_public_hybrid" as const,
      sync_status: "synced" as const,
      last_update_id: "65200",
      previous_final_update_id: "65199",
      top_bid_price: "65199.5",
      top_bid_quantity: "0.8",
      top_ask_price: "65200.5",
      top_ask_quantity: "0.9",
      depth_level_count: 100,
      gap_detected: false,
      authority_status: "read_only" as const
    },
    authority_status: "read_only" as const
  };
}

function paperBoardFill(candidateId: string, observedAt: string) {
  return {
    fill_id: `fill-${candidateId}`,
    order_id: `order-${candidateId}`,
    fill_status: "filled" as const,
    fill_price: "65200",
    fill_quantity: "0.001",
    fee_usdt: "0.2",
    slippage_usdt: "0.2",
    funding_usdt: "0.2",
    trade_time: observedAt,
    source_trade_id: `trade-${candidateId}`
  };
}

function interpolatedPaperObservedAt(
  finalObservedAt: string,
  sequence: number,
  observationCount: number
): string {
  const startedAt = Date.parse("2026-05-16T00:00:00.000Z");
  const endedAt = Date.parse(finalObservedAt);
  return new Date(startedAt + (endedAt - startedAt) * sequence / observationCount).toISOString();
}

function roundPaperValue(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

async function seedLargeSandboxHistory(
  store: LocalStore,
  candidate: NonNullable<Awaited<ReturnType<LocalStore["getCandidate"]>>>,
  count: number
): Promise<void> {
  const sandboxId = `sandbox-${candidate.candidate_id}`;
  const sandboxRef = { record_kind: "sandbox", id: sandboxId };
  const placement: SandboxPlacementRecord = {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: `sandbox-placement-${candidate.candidate_id}`,
    placement_kind: "host_local",
    tooling_kind: "host_process",
    authority_status: "not_launched"
  };
  const logs: SandboxLogRecord[] = Array.from({ length: count }, (_, index) => ({
    record_kind: "sandbox_log",
    version: 1,
    sandbox_log_id: `sandbox-log-${candidate.candidate_id}-${index}`,
    sandbox_ref: sandboxRef,
    lines: Array.from({ length: 30 }, (_, lineIndex) =>
      `runtime log line ${index}:${lineIndex} ${"x".repeat(3_000)}`
    ),
    captured_at: timestampAt(index),
    authority_status: "trace_only"
  }));
  const heartbeats: RuntimeHeartbeatRecord[] = Array.from({ length: count }, (_, index) => ({
    record_kind: "runtime_heartbeat",
    version: 1,
    runtime_heartbeat_id: `runtime-heartbeat-${candidate.candidate_id}-${index}`,
    sandbox_ref: sandboxRef,
    heartbeat_line: `runtime heartbeat ${index}`,
    observed_at: timestampAt(index),
    authority_status: "trace_only"
  }));
  const commandEvidence: SandboxCommandEvidenceRecord[] = Array.from({ length: count }, (_, index) => ({
    record_kind: "sandbox_command_evidence",
    version: 1,
    sandbox_command_evidence_id: `sandbox-command-evidence-${candidate.candidate_id}-${index}`,
    sandbox_ref: sandboxRef,
    command: ["python3", `candidate-${index}.py`],
    exit_code: 0,
    stdout: `sandbox stdout ${index} ${"y".repeat(3_000)}`,
    stderr: `sandbox stderr ${index} ${"z".repeat(3_000)}`,
    started_at: timestampAt(index),
    completed_at: timestampAt(index),
    authority_status: "trace_only"
  }));
  const sandbox: SandboxRecord = {
    record_kind: "sandbox",
    version: 1,
    sandbox_id: sandboxId,
    adapter_kind: "deterministic_test",
    system_code_ref: candidate.system_code?.ref ?? candidate.program.ref,
    runtime_ref: candidate.runtime.ref,
    sandbox_placement_ref: { record_kind: "sandbox_placement", id: placement.sandbox_placement_id },
    lifecycle_status: "running",
    sandbox_name: `ouro-${candidate.candidate_id}`,
    sandbox_ref: sandboxRef,
    created_at: timestampAt(0),
    started_at: timestampAt(0),
    last_heartbeat_at: timestampAt(count - 1),
    log_refs: logs.map((log) => ({ record_kind: "sandbox_log", id: log.sandbox_log_id })),
    heartbeat_refs: heartbeats.map((heartbeat) => ({
      record_kind: "runtime_heartbeat",
      id: heartbeat.runtime_heartbeat_id
    })),
    command_evidence_refs: commandEvidence.map((evidence) => ({
      record_kind: "sandbox_command_evidence",
      id: evidence.sandbox_command_evidence_id
    })),
    authority_status: "not_live"
  };

  await store.recordSandboxStart({
    instance: sandbox,
    placement,
    logs,
    heartbeats,
    command_evidence: commandEvidence
  });
}

function timestampAt(index: number): string {
  return `2026-05-16T00:00:${String(index).padStart(2, "0")}.000Z`;
}

async function recordTradingPromotionForCandidate(
  store: LocalStore,
  candidate: NonNullable<Awaited<ReturnType<LocalStore["getCandidate"]>>>,
  promotedAt = "2026-05-16T00:32:00.000Z",
  paperTradingEvaluationId = `paper-evaluation-${candidate.candidate_id}`
): Promise<TradingPromotionRecord> {
  const promotion = comparisonBackedPromotionForCandidate(
    candidate,
    promotedAt,
    paperTradingEvaluationId
  );
  const itemDir = path.join(store.root(), "trading-promotions/items");
  await mkdir(itemDir, { recursive: true });
  await writeFile(
    path.join(
      itemDir,
      encodeURIComponent(promotion.trading_promotion_id) + ".json"
    ),
    JSON.stringify(promotion, null, 2) + "\n",
    "utf8"
  );
  return promotion;
}

function comparisonBackedPromotionForCandidate(
  candidate: NonNullable<Awaited<ReturnType<LocalStore["getCandidate"]>>>,
  promotedAt = "2026-05-16T00:32:00.000Z",
  paperTradingEvaluationId = `paper-evaluation-${candidate.candidate_id}`
): TradingPromotionRecord {
  const campaignId = "operator-test-campaign-" + candidate.candidate_id;
  const outcomeId = campaignId + "-outcome";
  return {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: `promotion-${candidate.candidate_id}`,
    status: "promoted_for_trading_review",
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: paperTradingEvaluationId
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: campaignId
      },
      campaign_digest: "sha256:" + campaignId,
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: outcomeId
      },
      campaign_outcome_digest: "sha256:" + outcomeId,
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: outcomeId + "-final-verdict"
      },
      final_verdict_digest: "sha256:" + outcomeId + "-final-verdict"
    },
    promoted_at: promotedAt,
    authority_status: "not_live"
  };
}

async function writeNewerUnrelatedPaperEvaluation(
  store: LocalStore,
  boundEvaluation: PaperTradingEvaluationRecord,
  evaluationId: string
): Promise<void> {
  const itemDir = path.join(store.root(), "paper-trading-evaluations/items");
  await mkdir(itemDir, { recursive: true });
  await writeFile(
    path.join(itemDir, encodeURIComponent(evaluationId) + ".json"),
    JSON.stringify({
      ...boundEvaluation,
      paper_trading_evaluation_id: evaluationId,
      started_at: "2026-05-16T01:00:00.000Z",
      observation_count: 0,
      last_observed_at: "2026-05-16T01:01:00.000Z",
      next_observation_at: "2026-05-16T01:02:00.000Z",
      latest_score: {
        revenue_usdt: 1_000.6,
        cost_usdt: 0.6,
        net_revenue_usdt: 1_000,
        net_return_pct: 10
      }
    }, null, 2) + "\n",
    "utf8"
  );
}

function comparisonConfirmationProjectionStore(
  store: LocalStore,
  promotion: TradingPromotionRecord
): LocalStore {
  const campaign = {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    paper_trading_comparison_confirmation_campaign_id:
      promotion.comparison_confirmation.campaign_ref.id,
    campaign_digest: promotion.comparison_confirmation.campaign_digest,
    campaign_policy: {
      required_window_count: 2
    },
    comparison_policy: {
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 0.75
    },
    slots: [{ slot_index: 1 }, { slot_index: 2 }],
    evaluation_authority: "external_to_trading_systems",
    authority_status: "not_live"
  } as NonNullable<Awaited<ReturnType<
    LocalStore["getPaperTradingComparisonConfirmationCampaign"]
  >>>;
  const outcome = {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    paper_trading_comparison_confirmation_campaign_outcome_id:
      promotion.comparison_confirmation.campaign_outcome_ref.id,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    slot_results: [
      {
        slot_index: 1,
        status: "challenger_improved",
        verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: "operator-test-slot-1-verdict"
        },
        verdict_digest: "sha256:operator-test-slot-1-verdict"
      },
      {
        slot_index: 2,
        status: "challenger_improved",
        verdict_ref: {
          ...promotion.comparison_confirmation.final_verdict_ref
        },
        verdict_digest:
          promotion.comparison_confirmation.final_verdict_digest
      }
    ],
    improved_count: 2,
    not_improved_count: 0,
    ineligible_count: 0,
    expired_count: 0,
    campaign_outcome: "confirmed_improvement",
    promotion_eligibility: "eligible",
    next_action: "review_for_trading_promotion",
    evaluated_at: "2026-05-16T00:31:30.000Z",
    outcome_digest:
      promotion.comparison_confirmation.campaign_outcome_digest,
    evaluation_authority: "external_to_trading_systems",
    authority_status: "not_live"
  } as NonNullable<Awaited<ReturnType<
    LocalStore["getPaperTradingComparisonConfirmationCampaignOutcome"]
  >>>;

  return new Proxy(store, {
    get(target, property) {
      if (property === "getPaperTradingComparisonConfirmationCampaign") {
        return async (id: string) => id ===
          campaign.paper_trading_comparison_confirmation_campaign_id
          ? campaign
          : undefined;
      }
      if (property ===
        "getPaperTradingComparisonConfirmationCampaignOutcome") {
        return async (id: string) => id ===
          outcome.paper_trading_comparison_confirmation_campaign_outcome_id
          ? outcome
          : undefined;
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

function fakeArenaRunner() {
  return {
    status: () => "stopped" as const,
    ticks: () => 0,
    researchAgent: () => "fixture" as const,
    setResearchAgent: () => undefined,
    start: () => "started" as const,
    stop: () => "stopped" as const,
    tick: async () => {
      throw new Error("not used");
    }
  };
}
