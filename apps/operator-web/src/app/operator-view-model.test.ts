import { describe, expect, it } from "vitest";
import type {
  ArenaOperationsReadModel,
  ArenaTradingSystemDetailReadModel,
  CandidateArenaReadModel,
  PaperTradingBoardReadModel,
  ResearchOperationsReadModel
} from "@ouroboros/domain";
import {
  buildArenaWorkspaceViewModel,
  buildArenaSystemDetailViewModel,
  buildResearchWorkspaceViewModel,
  isComparableArenaRevenueSystem,
  type ArenaSystemViewModel,
  type OperatorProjectionInput
} from "./operator-view-model";

const RESEARCH_SESSION_ID =
  "research-session-v1-001d4cb1c60eeac2914c6842da12ec930cbad2d47dc78764ff8e320ef7ccbbc3";

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
        runner_status: "active",
        sandbox_status: "running",
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

function arenaSystemDetail(): ArenaTradingSystemDetailReadModel {
  return {
    ...arenaOperations().systems[0]!,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: "admission-1"
    },
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: "handoff-1"
    },
    isolation: {
      isolation_id: "sandbox-1",
      sandbox_status: "running",
      workspace_identity: "workspace-1",
      network_policy_status: "verified",
      egress_attestation_status: "verified",
      authority_status: "not_live"
    },
    trading_system_manifest: {
      summary: "Adaptive trend artifact",
      declared_runtime: "python",
      declared_outputs: ["order_request"],
      allowed_stages: ["paper"],
      declared_permissions: ["public_market_data"],
      forbidden_contents: ["credentials"]
    },
    lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: "source-system",
        candidate_version_id: "source-system-v1"
      }
    },
    open_orders: [],
    trace_events: [{
      sequence: 1,
      occurred_at: "2026-07-18T00:20:00.000Z",
      event_kind: "recovery",
      summary: "Restart recovery completed",
      sanitized: true,
      authority_status: "read_only"
    }],
    log_entries: [{
      sequence: 1,
      occurred_at: "2026-07-18T00:20:01.000Z",
      level: "info",
      source: "sandbox",
      message: "paper log line",
      sanitized: true,
      authority_status: "read_only"
    }],
    artifact_refs: [{ record_kind: "system_code", id: "code-1" }],
    trace_truncated: false,
    logs_truncated: false
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
        evidence_window: {
          observation_count: 12,
          elapsed_ms: 720_000,
          failed_observation_count: 2,
          first_observed_at: "2026-07-18T00:01:00.000Z",
          last_observed_at: "2026-07-18T00:12:00.000Z"
        },
        risk_summary: {} as never,
        trend: {
          direction: "improving",
          net_revenue_delta_usdt: 2,
          net_return_delta_pct: 0.2,
          observation_count_delta: 3,
          authority_status: "not_promotion_authority"
        },
        blocker_density: {
          blocker_count: 2,
          blocker_density: 0.1667,
          failed_observation_ratio: 0.1667,
          top_blocker: "failed_observation_ratio_exceeded",
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
        latest_public_execution_source: "rest_fallback",
        latest_fill_status: "partially_filled",
        open_order_count: 2,
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
    availability: "available",
    loop_status: "running",
    capacity: {
      max_concurrent_sessions: 3,
      active_session_count: 1,
      queued_session_count: 0
    },
    sessions: [
      {
        identity_kind: "derived_projection",
        research_work_item_id: RESEARCH_SESSION_ID,
        research_allocation_id: "allocation-1",
        tick_id: "tick-1",
        direction_kind: "execution_cost_robustness",
        research_worker_id: "worker-1",
        commitment_id: "commitment-1",
        status: "running",
        status_basis: {
          basis_kind: "runtime_research_work_item",
          source_ref: {
            record_kind: "research_preflight_commitment",
            id: "commitment-1"
          },
          authority_status: "read_only"
        },
        projection_health: "complete",
        degraded_reasons: [],
        trigger_availability: "available",
        trigger: {
          trigger_kind: "arena_event",
          trigger_id: "trigger-1",
          goal: "Reduce execution-cost sensitivity",
          goal_truncated: false,
          triggered_at: "2026-07-18T00:00:00.000Z",
          source_ref: {
            record_kind: "paper_trading_observation",
            id: "observation-1"
          },
          evidence_artifact_ref: {
            record_kind: "research_evidence_artifact",
            id: "artifact-1"
          },
          evidence_artifact_digest:
            `sha256:${"a".repeat(64)}`,
          authority_status: "research_only"
        },
        methodology_availability: "available",
        methodology: {
          direction_kind: "execution_cost_robustness",
          hypothesis: "A slower cadence survives public execution costs.",
          hypothesis_truncated: false,
          method: "Compare bounded cadence variants against Arena traces.",
          method_truncated: false,
          evidence_artifact_ids: ["artifact-1"],
          authority_status: "research_only"
        },
        provider_availability: "available",
        provider: "codex_cli",
        model: "gpt-5",
        model_truncated: false,
        budget: {
          max_experiment_count: 4,
          completed_experiment_count: 2,
          max_development_submission_count: 3,
          development_submission_count: 1,
          remaining_development_submission_count: 2,
          authority_status: "research_only"
        },
        allocated_at: "2026-07-18T00:00:30.000Z",
        started_at: "2026-07-18T00:01:00.000Z",
        last_progress_at: "2026-07-18T00:10:00.000Z",
        latest_progress_summary: "Evaluating the second cadence variant.",
        latest_progress_summary_truncated: false,
        authority_status: "research_only"
      }
    ],
    recorded_session_count: 1,
    projected_session_count: 1,
    omitted_session_count: 0,
    sessions_truncated: false,
    latest_session_id: RESEARCH_SESSION_ID,
    authority_status: "research_only"
  };
}

type UnknownRecord = Record<string, unknown>;

function legacyResearchOperations(): UnknownRecord {
  return {
    projection_kind: "research_operations",
    loop_status: "running",
    capacity: {
      max_concurrent_sessions: 2,
      active_session_count: 1,
      queued_session_count: 0
    },
    sessions: [{
      research_work_item_id: "legacy-research-1",
      research_allocation_id: "legacy-allocation-1",
      research_worker_id: "legacy-worker-1",
      research_worker_session_id: "legacy-worker-session-1",
      commitment_id: "legacy-commitment-1",
      status: "running",
      trigger: {
        trigger_kind: "arena_event",
        trigger_id: "legacy-trigger-1",
        goal: "Improve legacy execution robustness.",
        triggered_at: "2026-07-17T00:00:00.000Z",
        authority_status: "research_only"
      },
      methodology: {
        direction_kind: "execution_cost_robustness",
        hypothesis: "A slower cadence reduces legacy execution cost.",
        method: "Compare bounded cadence variants.",
        evidence_artifact_ids: ["legacy-evidence-1"],
        authority_status: "research_only"
      },
      provider: "codex",
      model: "gpt-5",
      budget: {
        max_experiment_count: 2,
        completed_experiment_count: 1,
        max_development_submission_count: 2,
        development_submission_count: 1,
        remaining_development_submission_count: 1,
        authority_status: "research_only"
      },
      started_at: "2026-07-17T00:00:01.000Z",
      last_progress_at: "2026-07-17T00:01:00.000Z",
      latest_progress_summary: "Legacy Research is running.",
      authority_status: "research_only"
    }],
    latest_session_id: "legacy-research-1",
    authority_status: "research_only"
  };
}

function legacySession(operations: UnknownRecord): UnknownRecord {
  return (operations.sessions as UnknownRecord[])[0]!;
}

function nestedRecord(value: UnknownRecord, key: string): UnknownRecord {
  return value[key] as UnknownRecord;
}

function legacyResearchView(operations: UnknownRecord) {
  return buildResearchWorkspaceViewModel(projectionInput({
    research_operations: operations as unknown as ResearchOperationsReadModel
  }));
}

describe("Operator projection view models", () => {
  it("normalizes exact Arena system detail without mixing another selection", () => {
    const detail = buildArenaSystemDetailViewModel(arenaSystemDetail());

    expect(detail).toMatchObject({
      id: "arena-candidate",
      admissionDecisionId: "admission-1",
      handoffConformanceId: "handoff-1",
      isolation: {
        sandboxStatus: "running",
        workspaceIdentity: "workspace-1",
        networkPolicyStatus: "verified",
        egressAttestationStatus: "verified"
      },
      manifest: {
        declaredRuntime: "python",
        declaredOutputs: ["order_request"]
      },
      lineage: {
        source: { trading_system_id: "source-system" }
      },
      traceEvents: [{ summary: "Restart recovery completed" }],
      logEntries: [{ message: "paper log line" }],
      artifactRefs: [{ record_kind: "system_code", id: "code-1" }]
    });
  });

  it("classifies Arena revenue as comparable only for explicitly ranked evidence", () => {
    const ranked: ArenaSystemViewModel = {
      id: "candidate-1",
      name: "Ranked candidate",
      lifecycle: "running",
      rankStatus: "provisional_ranked",
      rank: 1,
      comparability: "comparable",
      unrankedReasons: [],
      qualificationReasons: [],
      netRevenueUsdt: 4,
      observationCount: 10,
      failedObservationCount: 0,
      source: "arena_operations",
      detailAvailability: "summary_only"
    };

    expect(isComparableArenaRevenueSystem(ranked)).toBe(true);
    expect(isComparableArenaRevenueSystem({
      ...ranked,
      rankStatus: "unranked",
      rank: undefined,
      comparability: "ineligible",
      unrankedReasons: ["evidence_purpose_not_rankable"]
    })).toBe(false);
    expect(isComparableArenaRevenueSystem({
      ...ranked,
      source: "paper_trading_board",
      rankStatus: "paper_board_ranked",
      comparability: "legacy_paper_board"
    })).toBe(true);
  });

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
      qualificationStatus: "unavailable",
      source: "arena_operations"
    });
  });

  it("joins exact paper-board qualification gates into authoritative Arena rows", () => {
    const board = paperBoard();
    board.entries[0].candidate_id = "arena-candidate";
    board.entries[0].evaluation_id = "evaluation-1";
    board.entries[0].qualification_status = "blocked_by_quality";
    board.entries[0].qualification_reasons = ["failed_observation_ratio_exceeded"];

    const view = buildArenaWorkspaceViewModel(projectionInput({
      arena_operations: arenaOperations(),
      paper_trading_board: board
    }));

    expect(view.systems[0]).toMatchObject({
      id: "arena-candidate",
      qualificationStatus: "blocked_by_quality",
      qualificationReasons: ["failed_observation_ratio_exceeded"],
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
      evidenceWindow: {
        observation_count: 12,
        elapsed_ms: 720_000,
        failed_observation_count: 2
      },
      trend: {
        direction: "improving",
        net_revenue_delta_usdt: 2,
        net_return_delta_pct: 0.2,
        observation_count_delta: 3
      },
      blockerDensity: {
        blocker_count: 2,
        blocker_density: 0.1667,
        failed_observation_ratio: 0.1667,
        top_blocker: "failed_observation_ratio_exceeded"
      },
      marketDataSource: "binance_production_public_rest",
      latestPublicExecutionSource: "rest_fallback",
      latestFillStatus: "partially_filled",
      openOrderCount: 2,
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
          source_candidate: {
            source_kind: "paper_board_leader",
            candidate_id: "source-candidate",
            display_name: "Source candidate",
            net_revenue_usdt: 12,
            authority_status: "not_live"
          },
          created_candidate_ids: ["candidate-7"],
          direction_results: [{
            direction_kind: "trend_following",
            status: "created",
            candidate_id: "candidate-7",
            research_efficiency: {
              provider_request_total: 2,
              runner_command_total: 3,
              scenario_count: 4,
              elapsed_ms: 500,
              authority_status: "not_promotion_authority"
            }
          }, {
            direction_kind: "mean_reversion",
            status: "failed",
            error: "provider_unavailable"
          }],
          authority_status: "not_live"
        }]
      } as unknown as CandidateArenaReadModel
    });

    const view = buildResearchWorkspaceViewModel(input);
    expect(view.availability).toBe("history_only");
    expect(view.sessions).toEqual([]);
    expect(view.history[0]).toMatchObject({
      id: "tick-7",
      createdCandidateCount: 1,
      failedDirectionCount: 1,
      sourceCandidate: {
        candidateId: "source-candidate",
        displayName: "Source candidate"
      },
      directions: [{
        direction: "trend_following",
        status: "created",
        candidateId: "candidate-7",
        researchEfficiency: {
          providerRequestTotal: 2,
          runnerCommandTotal: 3,
          scenarioCount: 4,
          elapsedMs: 500
        }
      }, {
        direction: "mean_reversion",
        status: "failed",
        error: "provider_unavailable"
      }]
    });
  });

  it("re-sanitizes and bounds historical failure summaries in Operator JSON", () => {
    const privateOwner = "operator-private-owner-sentinel";
    const urlPassword = "operator-url-password-sentinel";
    const tokenValue = "operator-token-value-sentinel";
    const rawFailure = [
      `provider failed at /Users/${privateOwner}/research/session.json`,
      `https://operator:${urlPassword}@example.test/private`,
      `refresh_token=${tokenValue}`,
      "x".repeat(2_000)
    ].join(" ");
    const view = buildResearchWorkspaceViewModel(projectionInput({
      candidate_arena: {
        active_researchers: [],
        latest_ticks: [{
          tick_id: "tick-private-failure",
          status: "failed",
          started_at: "2026-07-18T00:00:00.000Z",
          completed_at: "2026-07-18T00:05:00.000Z",
          created_candidate_ids: [],
          direction_results: [{
            direction_kind: "trend_following",
            status: "failed",
            error: rawFailure
          }],
          authority_status: "not_live"
        }]
      } as unknown as CandidateArenaReadModel
    }));

    const failure = view.history[0]?.directions[0]?.error;
    const serialized = JSON.stringify(view);
    expect(failure).toContain("[private-path]");
    expect(failure).toContain("[external-url]");
    expect(failure).toContain("[redacted]");
    expect(failure?.length).toBeLessThanOrEqual(256);
    for (const sentinel of [privateOwner, urlPassword, tokenValue]) {
      expect(serialized).not.toContain(sentinel);
    }
  });

  it("maps only research_operations records into active methodology sessions", () => {
    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: researchOperations()
    }));

    expect(view.availability).toBe("authoritative");
    expect(view.sessions[0]).toMatchObject({
      id: RESEARCH_SESSION_ID,
      status: "running",
      triggerKind: "arena_event",
      direction: "execution_cost_robustness",
      completedExperimentCount: 2,
      maxExperimentCount: 4
    });
  });

  it("maps an origin-main v1 Research producer through the compatibility view", () => {
    const legacyOperations = legacyResearchOperations();
    const view = legacyResearchView(legacyOperations);

    expect(view).toMatchObject({
      availability: "compatibility",
      loopStatus: "running",
      latestSessionId: "legacy-research-1",
      sessions: [{
        id: "legacy-research-1",
        triggerAvailability: "available",
        triggerKind: "arena_event",
        methodologyAvailability: "available",
        direction: "execution_cost_robustness",
        providerAvailability: "available",
        provider: "codex",
        projectionHealth: "legacy_unknown",
        degradedReasons: []
      }]
    });
    expect(view.sessionWindow).toBeUndefined();

    legacyOperations.sessions = [];
    delete legacyOperations.latest_session_id;
    expect(legacyResearchView(legacyOperations)).toMatchObject({
      availability: "compatibility",
      sessions: [],
      emptyState: "projection_unavailable"
    });
  });

  it("rejects v1 Research summaries when any authority boundary is widened", () => {
    const mutations: Array<(operations: UnknownRecord) => void> = [
      (operations) => { operations.authority_status = "not_live"; },
      (operations) => {
        legacySession(operations).authority_status = "read_only";
      },
      (operations) => {
        nestedRecord(legacySession(operations), "trigger").authority_status =
          "not_live";
      },
      (operations) => {
        nestedRecord(legacySession(operations), "methodology").authority_status =
          "not_promotion_authority";
      },
      (operations) => {
        nestedRecord(legacySession(operations), "budget").authority_status =
          "runtime_coordination_only";
      }
    ];

    for (const mutate of mutations) {
      const operations = legacyResearchOperations();
      mutate(operations);
      expect(legacyResearchView(operations).availability).toBe("unavailable");
    }
  });

  it("rejects v1 Research summaries with non-canonical enum values", () => {
    const mutations: Array<(operations: UnknownRecord) => void> = [
      (operations) => { operations.loop_status = "healthy"; },
      (operations) => { legacySession(operations).status = "completed"; },
      (operations) => {
        nestedRecord(legacySession(operations), "trigger").trigger_kind =
          "webhook";
      },
      (operations) => {
        nestedRecord(legacySession(operations), "methodology").direction_kind =
          "momentum";
      },
      (operations) => { legacySession(operations).provider = "openai"; }
    ];

    for (const mutate of mutations) {
      const operations = legacyResearchOperations();
      mutate(operations);
      expect(legacyResearchView(operations).availability).toBe("unavailable");
    }
  });

  it("rejects v1 Research summaries outside identifier, text, list, and count bounds", () => {
    const mutations: Array<(operations: UnknownRecord) => void> = [
      (operations) => {
        legacySession(operations).research_work_item_id = `legacy-${"x".repeat(200)}`;
      },
      (operations) => {
        legacySession(operations).latest_progress_summary = "x".repeat(501);
      },
      (operations) => {
        nestedRecord(legacySession(operations), "methodology")
          .evidence_artifact_ids = Array.from(
            { length: 25 },
            (_, index) => `evidence-${index}`
          );
      },
      (operations) => {
        nestedRecord(legacySession(operations), "methodology")
          .evidence_artifact_ids = ["legacy-evidence-1", "legacy-evidence-1"];
      },
      (operations) => {
        nestedRecord(legacySession(operations), "budget")
          .completed_experiment_count = 3;
      },
      (operations) => {
        nestedRecord(legacySession(operations), "budget")
          .max_experiment_count = 1.5;
      },
      (operations) => {
        nestedRecord(legacySession(operations), "budget")
          .remaining_development_submission_count = 2;
      },
      (operations) => {
        nestedRecord(operations, "capacity")
          .active_session_count = 3;
      },
      (operations) => {
        const seed = legacySession(operations);
        operations.sessions = Array.from({ length: 101 }, (_, index) => ({
          ...seed,
          research_work_item_id: `legacy-research-${index}`
        }));
        operations.latest_session_id = "legacy-research-0";
      },
      (operations) => {
        operations.latest_session_id = "legacy-research-missing";
      }
    ];

    for (const mutate of mutations) {
      const operations = legacyResearchOperations();
      mutate(operations);
      expect(legacyResearchView(operations).availability).toBe("unavailable");
    }
  });

  it("rejects hybrid v2 fields at both v1 operations and session boundaries", () => {
    const mutations: Array<(operations: UnknownRecord) => void> = [
      (operations) => { operations.availability = "available"; },
      (operations) => { operations.projection_health = "complete"; },
      (operations) => { operations.degraded_reasons = []; },
      (operations) => { legacySession(operations).projection_health = "complete"; },
      (operations) => { legacySession(operations).degraded_reasons = []; },
      (operations) => { legacySession(operations).trigger_availability = "available"; },
      (operations) => { legacySession(operations).methodology_availability = "available"; },
      (operations) => { legacySession(operations).provider_availability = "available"; },
      (operations) => {
        legacySession(operations).status_basis = {
          basis_kind: "runtime_research_work_item",
          authority_status: "read_only"
        };
      }
    ];

    for (const mutate of mutations) {
      const operations = legacyResearchOperations();
      mutate(operations);
      expect(legacyResearchView(operations).availability).toBe("unavailable");
    }
  });

  it("rejects a v1 session dressed with v2 root counters and partial discriminators", () => {
    const operations = legacyResearchOperations();
    operations.availability = "available";
    operations.recorded_session_count = 1;
    operations.projected_session_count = 1;
    operations.omitted_session_count = 0;
    operations.sessions_truncated = false;
    const session = legacySession(operations);
    session.identity_kind = "derived_projection";
    session.degraded_reasons = [];

    expect(legacyResearchView(operations).availability).toBe("unavailable");
  });

  it.each([
    ["an extra authority field", (session: UnknownRecord) => {
      session.live_exchange_authority = true;
    }],
    ["a nested extra authority field", (session: UnknownRecord) => {
      nestedRecord(session, "trigger").live_exchange_authority = true;
    }],
    ["an invalid status basis", (session: UnknownRecord) => {
      nestedRecord(session, "status_basis").basis_kind = "legacy_runtime";
    }],
    ["a malformed trigger provenance ref", (session: UnknownRecord) => {
      nestedRecord(session, "trigger").source_ref = {
        record_kind: "candidate_arena_tick",
        id: "../foreign-tick"
      };
    }]
  ])("rejects a fully dressed v2 hybrid carrying %s", (_label, mutate) => {
    const operations = researchOperations() as unknown as UnknownRecord;
    mutate(legacySession(operations));

    expect(legacyResearchView(operations).availability).toBe("unavailable");
  });

  it("rejects a v2 Research summary whose shaped ID is not its allocation-direction hash", () => {
    const operations = researchOperations() as unknown as UnknownRecord;
    const session = legacySession(operations);
    session.research_work_item_id = `research-session-v1-${"0".repeat(64)}`;
    operations.latest_session_id = session.research_work_item_id;

    expect(legacyResearchView(operations).availability).toBe("unavailable");
  });

  it("rejects duplicate v2 Research session identities", () => {
    const operations = researchOperations() as unknown as UnknownRecord;
    const session = legacySession(operations);
    operations.sessions = [session, structuredClone(session)];
    operations.recorded_session_count = 2;
    operations.projected_session_count = 2;

    expect(legacyResearchView(operations).availability).toBe("unavailable");
  });

  it.each([
    ["a running session without a commitment", (session: UnknownRecord) => {
      delete session.commitment_id;
    }],
    ["a running session bound to another commitment", (session: UnknownRecord) => {
      session.commitment_id = "commitment-foreign";
    }],
    ["a queued session bound to another allocation", (session: UnknownRecord) => {
      session.status = "queued";
      delete session.commitment_id;
      session.status_basis = {
        basis_kind: "active_tick_queue",
        source_ref: {
          record_kind: "candidate_arena_research_allocation",
          id: "allocation-foreign"
        },
        authority_status: "read_only"
      };
    }],
    ["a non-running runtime session carrying a commitment ref", (session: UnknownRecord) => {
      session.status = "allocating";
    }]
  ])("rejects v2 Research summary basis mismatch: %s", (_label, mutate) => {
    const operations = researchOperations() as unknown as UnknownRecord;
    mutate(legacySession(operations));

    expect(legacyResearchView(operations).availability).toBe("unavailable");
  });

  it("does not treat an unavailable Research projection as authoritative empty state", () => {
    const operations = researchOperations();
    operations.availability = "unavailable";
    operations.loop_status = "degraded";
    operations.sessions = [];
    operations.recorded_session_count = 0;
    operations.projected_session_count = 0;
    delete operations.latest_session_id;

    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: operations
    }));

    expect(view).toMatchObject({
      availability: "unavailable",
      loopStatus: "degraded",
      sessions: [],
      emptyState: "projection_unavailable"
    });
    expect(view.emptyState).not.toBe("available_empty");
  });

  it("preserves each Research summary projection health and degraded reasons", () => {
    const operations = researchOperations();
    const session = operations.sessions[0]!;
    session.status = "recovering";
    session.status_basis = {
      basis_kind: "incomplete_persisted_graph",
      authority_status: "read_only"
    };
    session.projection_health = "degraded";
    session.degraded_reasons = [
      "evaluation_graph_conflict",
      "inactive_incomplete_graph"
    ];

    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: operations
    }));

    expect(view.sessions[0]).toMatchObject({
      id: RESEARCH_SESSION_ID,
      projectionHealth: "degraded",
      degradedReasons: [
        "evaluation_graph_conflict",
        "inactive_incomplete_graph"
      ]
    });
  });

  it("keeps recorded and projected Research session counts distinct", () => {
    const operations = researchOperations();
    operations.recorded_session_count = 4;
    operations.projected_session_count = 1;
    operations.omitted_session_count = 3;
    operations.sessions_truncated = true;

    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: operations
    }));

    expect(view.sessionWindow).toEqual({
      recordedCount: 4,
      projectedCount: 1,
      omittedCount: 3,
      truncated: true
    });
  });

  it("maps unavailable historical Research source fields without inventing values", () => {
    const operations = researchOperations() as unknown as {
      sessions: Array<Record<string, unknown>>;
    } & ResearchOperationsReadModel;
    const session = operations.sessions[0]! as unknown as Record<string, unknown>;
    session.projection_health = "degraded";
    session.degraded_reasons = [
      "trigger_unavailable",
      "methodology_unavailable",
      "provider_unavailable"
    ];
    session.trigger_availability = "unavailable";
    session.trigger = {
      compatibility_kind: "research_summary_v1_unavailable",
      trigger_kind: "unavailable",
      trigger_id: "unavailable",
      goal: "Research trigger unavailable.",
      goal_truncated: false,
      triggered_at: "",
      authority_status: "research_only"
    };
    session.methodology_availability = "unavailable";
    session.methodology = {
      compatibility_kind: "research_summary_v1_unavailable",
      direction_kind: "execution_cost_robustness",
      hypothesis: "Research methodology unavailable.",
      hypothesis_truncated: false,
      method: "Research methodology unavailable.",
      method_truncated: false,
      evidence_artifact_ids: [],
      authority_status: "research_only"
    };
    session.provider_availability = "unavailable";
    session.provider = "unavailable";
    delete session.model;
    delete session.model_truncated;
    session.direction_kind = "execution_cost_robustness";

    const view = buildResearchWorkspaceViewModel(projectionInput({
      research_operations: operations
    }));

    expect(view.sessions[0]).toMatchObject({
      triggerAvailability: "unavailable",
      methodologyAvailability: "unavailable",
      providerAvailability: "unavailable",
      direction: "execution_cost_robustness"
    });
    expect(view.sessions[0]).toMatchObject({
      goal: "",
      method: "",
      provider: ""
    });
  });

  it("carries paper learning, generalization, and finding clusters as read-only Research context", () => {
    const baseArena = projectionInput().candidate_arena;
    const view = buildResearchWorkspaceViewModel(projectionInput({
      candidate_arena: {
        ...baseArena,
        research_generalization: {
          status: "collecting",
          protocol_count: 1,
          outcome_count: 0,
          active_protocol: null,
          latest_outcome: null,
          latest_policy_decision: null,
          effective_policy_decision: null,
          authority_status: "not_promotion_authority"
        },
        finding_clusters: [{
          direction_kind: "trend_following",
          top_blocker: "min_observation_count_not_met",
          blocker_group_kind: "evidence_window",
          market_regime: "long",
          candidate_count: 2,
          candidate_ids: ["candidate-1", "candidate-2"],
          latest_finding: "Needs a longer evidence window.",
          next_research_focus: "Test slower cadence variants.",
          authority_status: "not_promotion_authority"
        }]
      } as unknown as CandidateArenaReadModel,
      trading_review: {
        review_packet: {
          lineage: {
            paper_board_learning: {
              rank: 2,
              net_revenue_usdt: 7,
              net_return_pct: 0.7,
              observation_count: 18,
              qualification_status: "collecting_evidence",
              qualification_reasons: ["min_observation_count_not_met"],
              top_blocker: "min_observation_count_not_met",
              summary: "Paper evidence is positive but incomplete.",
              next_research_focus: "Test slower cadence variants.",
              authority_status: "lineage_only"
            }
          }
        }
      } as unknown as OperatorProjectionInput["trading_review"]
    }));

    expect(view.paperLearning).toMatchObject({
      rank: 2,
      qualification_status: "collecting_evidence"
    });
    expect(view.generalization?.status).toBe("collecting");
    expect(view.findingClusters[0]).toMatchObject({
      direction_kind: "trend_following",
      market_regime: "long"
    });
    expect(view.sessions).toEqual([]);
  });
});
