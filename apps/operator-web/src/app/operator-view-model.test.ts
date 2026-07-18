import { describe, expect, it } from "vitest";
import type {
  ArenaOperationsReadModel,
  CandidateArenaReadModel,
  PaperTradingBoardReadModel,
  ResearchOperationsReadModel
} from "@ouroboros/domain";
import {
  buildArenaWorkspaceViewModel,
  buildResearchWorkspaceViewModel,
  type OperatorProjectionInput
} from "./operator-view-model";

function projectionInput(
  overrides: Partial<OperatorProjectionInput> = {}
): OperatorProjectionInput {
  return {
    paper_trading_board: {
      board_kind: "paper_trading_board",
      primary_rank_metric: "net_revenue_usdt",
      secondary_rank_metric: "net_return_pct",
      evaluation_authority: "continuous_paper_trading",
      entries: [],
      live_disabled: true,
      authority_status: "not_live"
    },
    candidate_arena: {
      runner_status: "stopped",
      active_researchers: [],
      latest_ticks: []
    } as unknown as CandidateArenaReadModel,
    ...overrides
  };
}

function arenaOperations(): ArenaOperationsReadModel {
  return {
    projection_kind: "arena_operations",
    loop_status: "running",
    capacity: {
      max_concurrent_sessions: 4,
      active_session_count: 1,
      queued_session_count: 0
    },
    systems: [
      {
        candidate_id: "arena-candidate",
        candidate_version_id: "arena-candidate-v1",
        system_code_ref: { record_kind: "system_code", id: "code-1" },
        display_name: "Adaptive trend",
        direction_kind: "trend_following",
        evaluation_id: "evaluation-1",
        trading_run_id: "run-1",
        profit_loss: {
          revenue_usdt: 18,
          cost_usdt: 3,
          net_revenue_usdt: 15,
          net_return_pct: 1.5
        },
        observation_count: 20,
        failed_observation_count: 1,
        queued_at: "2026-07-18T00:00:00.000Z",
        started_at: "2026-07-18T00:01:00.000Z",
        last_observed_at: "2026-07-18T00:20:00.000Z",
        next_observation_at: "2026-07-18T00:21:00.000Z",
        session_status: "running",
        rank_status: "provisional_ranked",
        rank: 1,
        comparability_status: "comparable",
        unranked_reasons: [],
        comparison_cohort: {
          cohort_id: "cohort-1",
          symbol: "BTCUSDT",
          evidence_purpose: "qualification",
          market_opportunity_policy_digest: "market-policy",
          account_policy_digest: "account-policy",
          cost_policy_digest: "cost-policy",
          risk_policy_digest: "risk-policy",
          evaluation_policy_identity: {} as never,
          evaluation_window_policy: {} as never,
          authority_status: "not_live"
        },
        comparison_sequence: 20,
        comparison_cutoff_at: "2026-07-18T00:20:00.000Z",
        authority_status: "not_live"
      }
    ],
    latest_system_id: "arena-candidate",
    live_disabled: true,
    authority_status: "not_live"
  };
}

function paperBoard(): PaperTradingBoardReadModel {
  return {
    board_kind: "paper_trading_board",
    primary_rank_metric: "net_revenue_usdt",
    secondary_rank_metric: "net_return_pct",
    evaluation_authority: "continuous_paper_trading",
    entries: [
      {
        rank: 9,
        candidate_id: "board-candidate",
        display_name: "Board fallback",
        evaluation_id: "board-evaluation",
        status: "running",
        runner_status: "active",
        promotion_gate_status: "collecting_paper_evidence",
        qualification_status: "collecting_evidence",
        qualification_reasons: [],
        evidence_window: {} as never,
        risk_summary: {} as never,
        trend: {
          direction: "improving",
          net_revenue_delta_usdt: 2,
          net_return_delta_pct: 0.2,
          observation_count_delta: 3,
          authority_status: "not_promotion_authority"
        },
        blocker_density: {
          blocker_count: 0,
          blocker_density: 0,
          failed_observation_ratio: 0,
          authority_status: "not_promotion_authority"
        },
        observation_count: 12,
        trading_run_id: "board-run",
        last_observed_at: "2026-07-18T00:12:00.000Z",
        next_observation_at: "2026-07-18T00:13:00.000Z",
        profit_loss: {
          revenue_usdt: 10,
          cost_usdt: 2,
          net_revenue_usdt: 8,
          net_return_pct: 0.8
        },
        market_data_source: "binance_production_public_rest",
        open_order_count: 0,
        authority_status: "not_live"
      }
    ],
    live_disabled: true,
    authority_status: "not_live"
  };
}

function researchOperations(): ResearchOperationsReadModel {
  return {
    projection_kind: "research_operations",
    loop_status: "running",
    capacity: {
      max_concurrent_sessions: 3,
      active_session_count: 1,
      queued_session_count: 0
    },
    sessions: [
      {
        research_work_item_id: "research-1",
        research_allocation_id: "allocation-1",
        research_worker_id: "worker-1",
        research_worker_session_id: "session-1",
        commitment_id: "commitment-1",
        status: "running",
        trigger: {
          trigger_kind: "arena_event",
          trigger_id: "trigger-1",
          goal: "Reduce execution-cost sensitivity",
          triggered_at: "2026-07-18T00:00:00.000Z",
          authority_status: "research_only"
        },
        methodology: {
          direction_kind: "execution_cost_robustness",
          hypothesis: "A slower cadence survives public execution costs.",
          method: "Compare bounded cadence variants against Arena traces.",
          evidence_artifact_ids: ["artifact-1"],
          authority_status: "research_only"
        },
        provider: "codex",
        model: "gpt-5",
        budget: {
          max_experiment_count: 4,
          completed_experiment_count: 2,
          max_development_submission_count: 3,
          development_submission_count: 1,
          remaining_development_submission_count: 2,
          authority_status: "research_only"
        },
        started_at: "2026-07-18T00:01:00.000Z",
        last_progress_at: "2026-07-18T00:10:00.000Z",
        latest_progress_summary: "Evaluating the second cadence variant.",
        authority_status: "research_only"
      }
    ],
    latest_session_id: "research-1",
    authority_status: "research_only"
  };
}

describe("Operator projection view models", () => {
  it("treats arena_operations as authoritative over paper board membership", () => {
    const view = buildArenaWorkspaceViewModel(projectionInput({
      arena_operations: arenaOperations(),
      paper_trading_board: paperBoard()
    }));

    expect(view.availability).toBe("authoritative");
    expect(view.systems.map((system) => system.id)).toEqual(["arena-candidate"]);
    expect(view.systems[0]).toMatchObject({
      rank: 1,
      rankStatus: "provisional_ranked",
      netRevenueUsdt: 15,
      source: "arena_operations"
    });
  });

  it("uses actual paper board rows only as an explicit compatibility surface", () => {
    const board = paperBoard();
    board.entries[0].qualification_status = "blocked_by_quality";
    board.entries[0].qualification_reasons = ["failed_observation_ratio_exceeded"];
    const view = buildArenaWorkspaceViewModel(projectionInput({
      paper_trading_board: board
    }));

    expect(view.availability).toBe("compatibility");
    expect(view.systems[0]).toMatchObject({
      id: "board-candidate",
      rank: 9,
      lifecycle: "running",
      netRevenueUsdt: 8,
      qualificationStatus: "blocked_by_quality",
      qualificationReasons: ["failed_observation_ratio_exceeded"],
      source: "paper_trading_board"
    });
  });

  it("distinguishes a missing Arena projection from an authoritative empty Arena", () => {
    expect(buildArenaWorkspaceViewModel(projectionInput())).toMatchObject({
      availability: "unavailable",
      emptyState: "projection_unavailable"
    });

    const emptyOperations = arenaOperations();
    emptyOperations.systems = [];
    expect(buildArenaWorkspaceViewModel(projectionInput({
      arena_operations: emptyOperations
    }))).toMatchObject({
      availability: "authoritative",
      emptyState: "available_empty"
    });
  });

  it("keeps the actual CandidateArena runner status when operation projections are unavailable", () => {
    const input = projectionInput();

    expect(buildArenaWorkspaceViewModel(input).loopStatus).toBe("stopped");
    expect(buildResearchWorkspaceViewModel(input).loopStatus).toBe("stopped");
  });

  it("never presents configured researchers as running sessions", () => {
    const input = projectionInput({
      candidate_arena: {
        active_researchers: [{ researcher_id: "configured-only" }],
        latest_ticks: []
      } as unknown as CandidateArenaReadModel
    });

    expect(buildResearchWorkspaceViewModel(input)).toMatchObject({
      availability: "unavailable",
      sessions: [],
      emptyState: "projection_unavailable"
    });
  });

  it("keeps completed ticks as history rather than synthesizing sessions", () => {
    const input = projectionInput({
      candidate_arena: {
        active_researchers: [],
        latest_ticks: [{
          tick_id: "tick-7",
          status: "completed",
          started_at: "2026-07-18T00:00:00.000Z",
          completed_at: "2026-07-18T00:05:00.000Z",
          created_candidate_ids: ["candidate-7"],
          direction_results: [],
          authority_status: "not_live"
        }]
      } as unknown as CandidateArenaReadModel
    });

    const view = buildResearchWorkspaceViewModel(input);
    expect(view.availability).toBe("history_only");
    expect(view.sessions).toEqual([]);
    expect(view.history[0]).toMatchObject({ id: "tick-7", createdCandidateCount: 1 });
  });

  it("maps only research_operations records into active methodology sessions", () => {
    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: researchOperations()
    }));

    expect(view.availability).toBe("authoritative");
    expect(view.sessions[0]).toMatchObject({
      id: "research-1",
      status: "running",
      triggerKind: "arena_event",
      direction: "execution_cost_robustness",
      completedExperimentCount: 2,
      maxExperimentCount: 4
    });
  });
});
