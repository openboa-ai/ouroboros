import { describe, expect, it } from "vitest";
import type {
  ArenaComparisonCohortReadModel,
  ArenaIsolationReadModel,
  ArenaOperationsReadModel,
  ArenaTradingSystemSummaryReadModel,
  ArenaTradingSystemDetailReadModel,
  ResearchAdmittedArenaHandoffReadModel,
  ResearchDevelopmentSubmissionReadModel,
  ResearchOperationsReadModel,
  ResearchSessionDetailReadModel,
  ResearchSessionSummaryReadModel
} from "./index";

describe("Research and Arena operations read-model contracts", () => {
  it("exposes an exact admitted terminal graph only with candidate-bearing Arena evidence", () => {
    const terminalGraph = {
      selected_sealed_evaluation: {
        trading_evaluation_result_ref: {
          record_kind: "trading_evaluation_result",
          id: "evaluation-result-1"
        },
        experiment_run_ref: {
          record_kind: "experiment_run",
          id: "experiment-run-1"
        },
        evaluation_phase: "sealed_admission",
        result_status: "accepted",
        evidence_disposition: "not_counted",
        completed_at: "2026-07-23T00:03:00.000Z",
        authority_status: "read_only"
      },
      admission: {
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-1"
        },
        status: "admitted",
        reason: "evaluation_accepted",
        decided_at: "2026-07-23T00:04:00.000Z",
        authority_status: "read_only"
      },
      paper_handoff_conformance: {
        paper_trading_handoff_conformance_ref: {
          record_kind: "paper_trading_handoff_conformance",
          id: "conformance-1"
        },
        status: "passed",
        reason: "passed",
        completed_at: "2026-07-23T00:03:30.000Z",
        evidence_digest: "sha256:conformance",
        authority_status: "read_only"
      },
      finding: {
        research_finding_ref: {
          record_kind: "research_finding",
          id: "finding-1"
        },
        finding_kind: "positive_result",
        summary: "The selected candidate passed sealed admission.",
        summary_truncated: false,
        supporting_record_refs: [{
          record_kind: "trading_evaluation_result",
          id: "evaluation-result-1"
        }],
        created_at: "2026-07-23T00:03:01.000Z",
        sanitized: true,
        authority_status: "read_only"
      },
      artifact_lineage: {
        artifact_lineage_ref: {
          record_kind: "artifact_lineage",
          id: "lineage-1"
        },
        child_system_code_ref: {
          record_kind: "system_code",
          id: "system-code-selected"
        },
        parent_system_code_ref: {
          record_kind: "system_code",
          id: "system-code-source"
        },
        source_finding_refs: [{
          record_kind: "research_finding",
          id: "finding-1"
        }],
        created_by_research_worker_ref: {
          record_kind: "research_worker",
          id: "worker-1"
        },
        created_at: "2026-07-23T00:04:01.000Z",
        authority_status: "read_only"
      },
      admitted_arena_handoff: {
        candidate_arena_tick_ref: {
          record_kind: "candidate_arena_tick",
          id: "arena-tick-1"
        },
        candidate_ref: {
          record_kind: "trading_system_candidate",
          id: "candidate-1"
        },
        direction_kind: "trend_following",
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-1"
        },
        completed_at: "2026-07-23T00:05:00.000Z",
        authority_status: "read_only"
      },
      authority_status: "read_only"
    } satisfies ResearchSessionDetailReadModel["terminal_graph"];

    const duplicateWithoutHandoff = {
      admission: {
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-duplicate"
        },
        status: "duplicate",
        reason: "no_candidate_change",
        decided_at: "2026-07-23T00:04:00.000Z",
        authority_status: "read_only"
      },
      authority_status: "read_only"
    } satisfies ResearchSessionDetailReadModel["terminal_graph"];

    // @ts-expect-error Admitted handoff cannot claim already-counted sealed evidence.
    const countedEvidenceWithHandoff: ResearchSessionDetailReadModel["terminal_graph"] = {
      ...terminalGraph,
      selected_sealed_evaluation: {
        ...terminalGraph.selected_sealed_evaluation,
        evidence_disposition: "counted"
      }
    };
    // @ts-expect-error Admitted handoff requires an admitted evaluation decision.
    const duplicateDecisionWithHandoff: ResearchSessionDetailReadModel["terminal_graph"] = {
      ...terminalGraph,
      admission: {
        ...terminalGraph.admission,
        status: "duplicate",
        reason: "no_candidate_change"
      }
    };
    // @ts-expect-error Admitted handoff requires passed paper handoff conformance.
    const rejectedConformanceWithHandoff: ResearchSessionDetailReadModel["terminal_graph"] = {
      ...terminalGraph,
      paper_handoff_conformance: {
        ...terminalGraph.paper_handoff_conformance,
        status: "rejected",
        reason: "runner_crash"
      }
    };

    // @ts-expect-error Arena handoff requires exact terminal candidate identity.
    const missingCandidate: ResearchAdmittedArenaHandoffReadModel = {
      candidate_arena_tick_ref: {
        record_kind: "candidate_arena_tick",
        id: "arena-tick-1"
      },
      direction_kind: "trend_following",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-1"
      },
      completed_at: "2026-07-23T00:05:00.000Z",
      authority_status: "read_only"
    };
    const wrongRefKinds: ResearchAdmittedArenaHandoffReadModel = {
      // @ts-expect-error Arena handoff requires a CandidateArenaTick record.
      candidate_arena_tick_ref: { record_kind: "research_finding", id: "tick-1" },
      // @ts-expect-error Arena handoff requires a materialized candidate record.
      candidate_ref: { record_kind: "system_code", id: "candidate-1" },
      direction_kind: "trend_following",
      candidate_admission_decision_ref: {
        // @ts-expect-error Arena handoff requires an exact admission decision record.
        record_kind: "trading_evaluation_result",
        id: "admission-1"
      },
      completed_at: "2026-07-23T00:05:00.000Z",
      authority_status: "read_only"
    };

    expect(terminalGraph.admitted_arena_handoff?.candidate_ref.id)
      .toBe("candidate-1");
    expect(duplicateWithoutHandoff.admission.status).toBe("duplicate");
    expect(countedEvidenceWithHandoff.selected_sealed_evaluation?.evidence_disposition)
      .toBe("counted");
    expect(duplicateDecisionWithHandoff.admission?.status).toBe("duplicate");
    expect(rejectedConformanceWithHandoff.paper_handoff_conformance?.status)
      .toBe("rejected");
    expect(missingCandidate.direction_kind).toBe("trend_following");
    expect(wrongRefKinds.candidate_ref.record_kind).toBe("system_code");
  });

  it("represents unavailable historical Research source fields explicitly", () => {
    const historical: ResearchSessionSummaryReadModel = {
      identity_kind: "derived_projection",
      research_work_item_id: "research-session-v1-digest",
      research_allocation_id: "allocation-legacy",
      tick_id: "tick-legacy",
      direction_kind: "trend_following",
      status: "recovering",
      status_basis: {
        basis_kind: "incomplete_persisted_graph",
        authority_status: "read_only"
      },
      projection_health: "degraded",
      degraded_reasons: [
        "trigger_unavailable",
        "methodology_unavailable",
        "provider_unavailable",
        "evaluation_graph_conflict"
      ],
      trigger_availability: "unavailable",
      methodology_availability: "unavailable",
      provider_availability: "unavailable",
      budget: {
        max_experiment_count: 1,
        completed_experiment_count: 0,
        max_development_submission_count: 1,
        development_submission_count: 0,
        remaining_development_submission_count: 1,
        authority_status: "research_only"
      },
      latest_progress_summary: "Persisted Research source fields are unavailable.",
      latest_progress_summary_truncated: false,
      authority_status: "research_only"
    };

    expect(historical).toMatchObject({
      trigger_availability: "unavailable",
      methodology_availability: "unavailable",
      provider_availability: "unavailable",
      projection_health: "degraded",
      degraded_reasons: expect.arrayContaining([
        "evaluation_graph_conflict"
      ])
    });

    const invalidAwaitingSelection: ResearchSessionSummaryReadModel = {
      ...historical,
      // @ts-expect-error The projection cannot emit an unpersisted mid-session selection state.
      status: "awaiting_selection"
    };
    const invalidSealedAdmission: ResearchSessionSummaryReadModel = {
      ...historical,
      // @ts-expect-error The projection cannot emit an unpersisted sealed-admission state.
      status: "sealed_admission"
    };
    expect(invalidAwaitingSelection.status).toBe("awaiting_selection");
    expect(invalidSealedAdmission.status).toBe("sealed_admission");
  });

  it("prevents non-selected checkpoint submissions from claiming SystemCode identity", () => {
    const submission: ResearchDevelopmentSubmissionReadModel = {
      submission_sequence: 1,
      decision: "discard",
      agent_status: "edited",
      evaluation_status: "accepted",
      risk_decision: "no_order_request",
      net_revenue_usdt: -1,
      summary: "Discarded after bounded evaluation.",
      summary_truncated: false,
      selected: false,
      artifact_availability: "not_persisted",
      authority_status: "research_only"
    };
    const invalid: ResearchDevelopmentSubmissionReadModel = {
      ...submission,
      // @ts-expect-error A non-selected checkpoint summary cannot claim selected artifact identity.
      selected_system_code_ref: { record_kind: "system_code", id: "borrowed" }
    };

    expect(submission.artifact_availability).toBe("not_persisted");
    expect(invalid.selected).toBe(false);
  });

  it("keeps paper rank tied to a comparable Arena cohort", () => {
    const arena: ArenaOperationsReadModel = {
      projection_kind: "arena_operations",
      loop_status: "running",
      capacity: {
        max_concurrent_sessions: 4,
        active_session_count: 1,
        queued_session_count: 0
      },
      systems: [{
        candidate_id: "candidate-1",
        candidate_version_id: "candidate-1-v1",
        system_code_ref: { record_kind: "system_code", id: "system-code-1" },
        display_name: "Trend candidate",
        direction_kind: "trend_following",
        session_status: "running",
        runner_status: "active",
        sandbox_status: "running",
        evaluation_id: "paper-1",
        trading_run_id: "run-1",
        rank_status: "provisional_ranked",
        rank: 1,
        comparability_status: "comparable",
        unranked_reasons: [],
        comparison_cohort: {
          cohort_id: "cohort-1",
          symbol: "BTCUSDT",
          evidence_purpose: "research_feedback",
          market_opportunity_policy_digest: "sha256:market",
          account_policy_digest: "sha256:account",
          cost_policy_digest: "sha256:cost",
          risk_policy_digest: "sha256:risk",
          evaluation_policy_identity: {
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
          evaluation_window_policy: {
            interval_ms: 60_000,
            release_policy: "closed_observation",
            eligibility_policy_version: "eligibility-v1"
          },
          authority_status: "not_live"
        },
        comparison_sequence: 12,
        comparison_cutoff_at: "2026-07-18T00:12:00.000Z",
        profit_loss: {
          revenue_usdt: 10,
          cost_usdt: 2,
          net_revenue_usdt: 8,
          net_return_pct: 0.8
        },
        observation_count: 12,
        failed_observation_count: 0,
        queued_at: "2026-07-18T00:00:00.000Z",
        started_at: "2026-07-18T00:00:01.000Z",
        latest_decision: {
          decision_kind: "hold",
          source_kind: "trading_system_decision",
          reason: "Waiting for the next closed observation.",
          observed_at: "2026-07-18T00:12:00.000Z",
          authority_status: "trace_only"
        },
        authority_status: "not_live"
      }],
      latest_system_id: "candidate-1",
      live_disabled: true,
      authority_status: "not_live"
    };

    expect(arena.systems[0]).toMatchObject({
      rank_status: "provisional_ranked",
      comparability_status: "comparable",
      session_status: "running",
      comparison_cohort: {
        evaluation_policy_identity: {
          decision_event_protocol_version: "decision-v1"
        },
        evaluation_window_policy: {
          interval_ms: 60_000
        }
      }
    });
  });

  it("makes ranked and unranked Arena rows incompatible states", () => {
    const ranked = {
      candidate_id: "candidate-ranked",
      candidate_version_id: "candidate-ranked-v1",
      system_code_ref: { record_kind: "system_code", id: "system-code-ranked" },
      display_name: "Ranked candidate",
      direction_kind: "trend_following",
      session_status: "completed",
      runner_status: "inactive",
      sandbox_status: "stopped",
      evaluation_id: "paper-ranked",
      trading_run_id: "run-ranked",
      rank_status: "ranked",
      rank: 1,
      comparability_status: "comparable",
      unranked_reasons: [],
      comparison_cohort: {
        cohort_id: "cohort-ranked",
        symbol: "BTCUSDT",
        evidence_purpose: "research_feedback",
        market_opportunity_policy_digest: "sha256:market",
        account_policy_digest: "sha256:account",
        cost_policy_digest: "sha256:cost",
        risk_policy_digest: "sha256:risk",
        evaluation_policy_identity: {
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
        evaluation_window_policy: {
          interval_ms: 60_000,
          release_policy: "closed_observation",
          eligibility_policy_version: "eligibility-v1"
        },
        authority_status: "not_live"
      },
      comparison_sequence: 12,
      comparison_cutoff_at: "2026-07-18T00:12:00.000Z",
      profit_loss: {
        revenue_usdt: 10,
        cost_usdt: 2,
        net_revenue_usdt: 8,
        net_return_pct: 0.8
      },
      observation_count: 12,
      failed_observation_count: 0,
      queued_at: "2026-07-18T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies ArenaTradingSystemSummaryReadModel;

    const unranked = {
      candidate_id: "candidate-unranked",
      candidate_version_id: "candidate-unranked-v1",
      system_code_ref: { record_kind: "system_code", id: "system-code-unranked" },
      display_name: "Queued candidate",
      direction_kind: "mean_reversion",
      session_status: "queued",
      runner_status: "inactive",
      sandbox_status: "not_started",
      rank_status: "unranked",
      comparability_status: "ineligible",
      unranked_reasons: ["paper_evaluation_not_started"],
      observation_count: 0,
      failed_observation_count: 0,
      queued_at: "2026-07-18T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies ArenaTradingSystemSummaryReadModel;

    const {
      comparison_cohort: _cohort,
      comparison_sequence: _sequence,
      comparison_cutoff_at: _cutoff,
      ...rankedWithoutComparisonBoundary
    } = ranked;
    // @ts-expect-error Ranked rows require an exact cohort, sequence, and cutoff.
    const invalidRanked: ArenaTradingSystemSummaryReadModel = rankedWithoutComparisonBoundary;
    // @ts-expect-error Unranked rows cannot carry an implied leaderboard rank.
    const invalidUnranked: ArenaTradingSystemSummaryReadModel = { ...unranked, rank: 1 };
    // @ts-expect-error Queued sessions cannot enter a ranked Arena branch.
    const invalidQueuedRanked: ArenaTradingSystemSummaryReadModel = {
      ...ranked,
      session_status: "queued"
    };
    const { profit_loss: _profitLoss, ...rankedWithoutProfitLoss } = ranked;
    // @ts-expect-error A rank cannot exist without externally calculated paper profit and loss.
    const invalidRankedEvidence: ArenaTradingSystemSummaryReadModel = rankedWithoutProfitLoss;
    // @ts-expect-error Failed paper sessions remain visible but cannot hold final rank.
    const invalidFailedRanked: ArenaTradingSystemSummaryReadModel = {
      ...ranked,
      session_status: "failed"
    };
    const invalidSystemCodeRef: ArenaTradingSystemSummaryReadModel = {
      ...ranked,
      // @ts-expect-error Arena identity must bind an exact SystemCode record.
      system_code_ref: { record_kind: "finding", id: "finding-not-system-code" }
    };
    const invalidCohortSymbol: ArenaComparisonCohortReadModel = {
      ...ranked.comparison_cohort,
      // @ts-expect-error The paper market identity is fixed to BTCUSDT.
      symbol: "ETHUSDT"
    };

    expect(ranked.rank).toBe(1);
    expect(unranked.unranked_reasons).toEqual(["paper_evaluation_not_started"]);
    expect(invalidRanked.rank_status).toBe("ranked");
    expect(invalidUnranked.rank_status).toBe("unranked");
    expect(invalidQueuedRanked.session_status).toBe("queued");
    expect(invalidRankedEvidence.rank_status).toBe("ranked");
    expect(invalidFailedRanked.session_status).toBe("failed");
    expect(invalidSystemCodeRef.system_code_ref.record_kind).toBe("finding");
    expect(invalidCohortSymbol.symbol).toBe("ETHUSDT");
  });

  it("separates Research methodology and sanitized evidence from Arena execution detail", () => {
    const research: ResearchOperationsReadModel = {
      projection_kind: "research_operations",
      availability: "available",
      loop_status: "running",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 1,
        queued_session_count: 0
      },
      recorded_session_count: 1,
      projected_session_count: 1,
      omitted_session_count: 0,
      sessions_truncated: false,
      sessions: [{
        identity_kind: "derived_projection",
        research_work_item_id: "work-item-1",
        research_allocation_id: "allocation-1",
        tick_id: "tick-1",
        direction_kind: "execution_cost_robustness",
        research_worker_id: "worker-1",
        commitment_id: "commitment-1",
        status: "running",
        status_basis: {
          basis_kind: "runtime_research_work_item",
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
          triggered_at: "2026-07-18T00:01:00.000Z",
          source_ref: { record_kind: "finding", id: "finding-1" },
          authority_status: "research_only"
        },
        methodology_availability: "available",
        methodology: {
          direction_kind: "execution_cost_robustness",
          hypothesis: "A stricter spread gate reduces adverse fills.",
          hypothesis_truncated: false,
          method: "Generate and compare bounded spread-gate variants.",
          method_truncated: false,
          evidence_artifact_ids: ["evidence-1"],
          authority_status: "research_only"
        },
        provider_availability: "available",
        provider: "codex_cli",
        budget: {
          max_experiment_count: 2,
          completed_experiment_count: 1,
          max_development_submission_count: 2,
          development_submission_count: 1,
          remaining_development_submission_count: 1,
          authority_status: "research_only"
        },
        started_at: "2026-07-18T00:01:01.000Z",
        last_progress_at: "2026-07-18T00:02:00.000Z",
        latest_progress_summary: "Evaluating the first immutable submission.",
        latest_progress_summary_truncated: false,
        authority_status: "research_only"
      }],
      latest_session_id: "session-1",
      authority_status: "research_only"
    };

    const researchSummary = research.sessions[0]!;
    if (researchSummary.trigger_availability !== "available" ||
      researchSummary.methodology_availability !== "available" ||
      researchSummary.provider_availability !== "available") {
      throw new Error("expected_available_research_summary");
    }
    const researchDetail: ResearchSessionDetailReadModel = {
      ...researchSummary,
      evidence_inputs: [{
        evidence_artifact_id: "evidence-1",
        source_kind: "arena_failure",
        subject_ref: { record_kind: "paper_trading_evaluation", id: "paper-1" },
        artifact_ref: { record_kind: "artifact", id: "artifact-1" },
        artifact_digest: "sha256:evidence",
        summary: "A bounded canonical evidence summary.",
        truncated: false,
        captured_at: "2026-07-18T00:00:30.000Z",
        sanitization_status: "sanitized",
        qualification_evidence_hidden: true,
        authority_status: "research_only"
      }],
      development_submissions: [],
      submission_history_availability: "unavailable_until_checkpoint",
      selected_artifact_availability: "unavailable",
      notebook_summary: [],
      notebook_summary_truncated: false,
      lifecycle_events: [],
      provider_logs_availability: "not_persisted",
      terminal_graph: { authority_status: "read_only" }
    };

    const invalidSelectedSystemCode: ResearchSessionDetailReadModel = {
      ...researchDetail,
      // @ts-expect-error Research selection must bind an exact SystemCode record.
      selected_system_code_ref: { record_kind: "finding", id: "finding-1" }
    };
    const invalidAdmissionDecision: ResearchSessionDetailReadModel = {
      ...researchDetail,
      // @ts-expect-error Research admission must bind an exact admission decision record.
      admission_decision_ref: { record_kind: "finding", id: "finding-1" }
    };
    const invalidHandoffConformance: ResearchSessionDetailReadModel = {
      ...researchDetail,
      // @ts-expect-error Research handoff must bind exact paper conformance evidence.
      paper_handoff_conformance_ref: { record_kind: "finding", id: "finding-1" }
    };
    const invalidDevelopmentSubmission: ResearchDevelopmentSubmissionReadModel = {
      submission_sequence: 1,
      decision: "discard",
      agent_status: "edited",
      evaluation_status: "accepted",
      risk_decision: "no_order_request",
      net_revenue_usdt: 0,
      summary: "Discarded checkpoint summary.",
      summary_truncated: false,
      selected: false,
      artifact_availability: "not_persisted",
      // @ts-expect-error A non-selected submission cannot point to selected SystemCode.
      selected_system_code_ref: { record_kind: "system_code", id: "system-code-1" },
      authority_status: "research_only"
    };

    const arenaDetail = {
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-1"
      },
      paper_trading_handoff_conformance_ref: {
        record_kind: "paper_trading_handoff_conformance",
        id: "handoff-1"
      },
      isolation: {
        isolation_id: "isolation-1",
        sandbox_status: "running",
        workspace_identity: "workspace-1",
        network_policy_status: "verified",
        egress_attestation_status: "verified",
        authority_status: "not_live"
      },
      trading_system_manifest: {
        summary: "Trend candidate",
        declared_runtime: "python",
        declared_outputs: ["order_request"],
        allowed_stages: ["paper"],
        declared_permissions: ["public_market_data"],
        forbidden_contents: ["credentials"]
      },
      lineage: {
        handoff_status: "runnable",
        source: {
          trading_system_id: "source-system-1",
          candidate_version_id: "source-system-1-v1"
        }
      },
      open_orders: [],
      trace_events: [],
      log_entries: [],
      artifact_refs: [],
      trace_truncated: false,
      logs_truncated: false
    } satisfies Omit<ArenaTradingSystemDetailReadModel, keyof ArenaOperationsReadModel["systems"][number]>;

    const deterministicIsolation = {
      sandbox_status: "stopped",
      network_policy_status: "not_required",
      egress_attestation_status: "not_required",
      authority_status: "not_live"
    } satisfies ArenaIsolationReadModel;

    expect(research.availability).toBe("available");
    expect(researchDetail.evidence_inputs[0]).toMatchObject({
      sanitization_status: "sanitized",
      qualification_evidence_hidden: true
    });
    expect(invalidSelectedSystemCode.selected_system_code_ref?.record_kind).toBe("finding");
    expect(invalidAdmissionDecision.admission_decision_ref?.record_kind).toBe("finding");
    expect(invalidHandoffConformance.paper_handoff_conformance_ref?.record_kind).toBe("finding");
    expect(invalidDevelopmentSubmission.selected_system_code_ref?.record_kind)
      .toBe("system_code");
    expect(arenaDetail.isolation.network_policy_status).toBe("verified");
    expect(arenaDetail.candidate_admission_decision_ref.record_kind)
      .toBe("candidate_admission_decision");
    expect(arenaDetail.paper_trading_handoff_conformance_ref.record_kind)
      .toBe("paper_trading_handoff_conformance");
    expect(deterministicIsolation.network_policy_status).toBe("not_required");
  });
});
