import { describe, expect, it } from "vitest";
import type {
  ArenaIsolationReadModel,
  ArenaOperationsReadModel,
  ArenaTradingSystemSummaryReadModel,
  ArenaTradingSystemDetailReadModel,
  ResearchOperationsReadModel,
  ResearchSessionDetailReadModel
} from "./index";

describe("Research and Arena operations read-model contracts", () => {
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
      session_status: "running",
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

    expect(ranked.rank).toBe(1);
    expect(unranked.unranked_reasons).toEqual(["paper_evaluation_not_started"]);
    expect(invalidRanked.rank_status).toBe("ranked");
    expect(invalidUnranked.rank_status).toBe("unranked");
  });

  it("separates Research methodology and sanitized evidence from Arena execution detail", () => {
    const research: ResearchOperationsReadModel = {
      projection_kind: "research_operations",
      loop_status: "running",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 1,
        queued_session_count: 0
      },
      sessions: [{
        research_work_item_id: "work-item-1",
        research_allocation_id: "allocation-1",
        research_worker_id: "worker-1",
        research_worker_session_id: "session-1",
        commitment_id: "commitment-1",
        status: "running",
        trigger: {
          trigger_kind: "arena_event",
          trigger_id: "trigger-1",
          goal: "Reduce execution-cost sensitivity",
          triggered_at: "2026-07-18T00:01:00.000Z",
          source_ref: { record_kind: "finding", id: "finding-1" },
          authority_status: "research_only"
        },
        methodology: {
          direction_kind: "execution_cost_robustness",
          hypothesis: "A stricter spread gate reduces adverse fills.",
          method: "Generate and compare bounded spread-gate variants.",
          evidence_artifact_ids: ["evidence-1"],
          authority_status: "research_only"
        },
        provider: "codex",
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
        authority_status: "research_only"
      }],
      latest_session_id: "session-1",
      authority_status: "research_only"
    };

    const researchDetail: ResearchSessionDetailReadModel = {
      ...research.sessions[0],
      evidence_inputs: [{
        evidence_artifact_id: "evidence-1",
        source_kind: "arena_failure",
        subject_ref: { record_kind: "paper_trading_evaluation", id: "paper-1" },
        artifact_ref: { record_kind: "artifact", id: "artifact-1" },
        artifact_digest: "sha256:evidence",
        captured_at: "2026-07-18T00:00:30.000Z",
        sanitization_status: "sanitized",
        qualification_evidence_hidden: true,
        authority_status: "research_only"
      }],
      development_submissions: [],
      notebook_summary: [],
      log_entries: [],
      logs_truncated: false
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

    expect(researchDetail.evidence_inputs[0]).toMatchObject({
      sanitization_status: "sanitized",
      qualification_evidence_hidden: true
    });
    expect(arenaDetail.isolation.network_policy_status).toBe("verified");
    expect(arenaDetail.candidate_admission_decision_ref.record_kind)
      .toBe("candidate_admission_decision");
    expect(arenaDetail.paper_trading_handoff_conformance_ref.record_kind)
      .toBe("paper_trading_handoff_conformance");
    expect(deterministicIsolation.network_policy_status).toBe("not_required");
  });
});
