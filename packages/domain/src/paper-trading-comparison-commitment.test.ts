import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY,
  decidePaperTradingQualification,
  paperTradingComparisonCandidateVersionPairKey,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonChampionSelectionHasRuntimeShape,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonPolicyHasRuntimeShape,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord
} from "./index";

describe("PaperTradingComparisonCommitment", () => {
  it("canonically digests persisted records and creates unordered candidate pairs", () => {
    expect(paperTradingComparisonPersistedRecordDigestInput({ b: 2, a: 1, omitted: undefined }))
      .toBe(paperTradingComparisonPersistedRecordDigestInput({ a: 1, b: 2 }));
    expect(paperTradingComparisonCandidateVersionPairKey("version-b", "version-a"))
      .toBe(paperTradingComparisonCandidateVersionPairKey("version-a", "version-b"));
    expect(() => paperTradingComparisonPersistedRecordDigestInput({ values: [undefined] }))
      .toThrow("paper_trading_comparison_non_persistable_record");
  });

  it("makes qualification decisions in the domain", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);

    expect(DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY).toEqual({
      minObservationCount: 30,
      minElapsedMs: 1_800_000,
      maxFailedObservationRatio: 0.1,
      assessRunnerHealth: true
    });
    expect(decidePaperTradingQualification({
      evaluation,
      commitment,
      observations,
      commitmentDigestVerified: true,
      runnerActive: false
    })).toMatchObject({ qualification_status: "qualified", qualification_reasons: [] });
  });

  it("qualifies canonical rounded revenue minus cost accounting", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    const latest = observations.at(-1)!;
    const account = {
      ...latest.paper_account_snapshot!,
      equity_usdt: "9999.841957622833",
      realized_pnl_usdt: "0",
      unrealized_pnl_usdt: "-0.00021554",
      fee_paid_usdt: "0.078913418584",
      slippage_paid_usdt: "0.059185063938",
      funding_paid_usdt: "0.019728354646"
    };
    const score = {
      revenue_usdt: -0.000216,
      cost_usdt: 0.157827,
      net_revenue_usdt: -0.158043,
      net_return_pct: -0.00158
    };
    latest.paper_account_snapshot = account;
    latest.score_delta = score;
    latest.cumulative_score = score;
    evaluation.paper_account_snapshot = account;
    evaluation.latest_score = score;

    expect(decidePaperTradingQualification({
      evaluation,
      commitment,
      observations,
      commitmentDigestVerified: true,
      runnerActive: false
    })).toMatchObject({
      qualification_status: "qualified",
      qualification_reasons: []
    });
  });

  it("rejects stopped closures whose frozen runtime identity differs from SystemCode", () => {
    const closure = stoppedClosure();
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).toBe(true);

    closure.commitment.runtime_identity.entrypoint = ["python3", "different.py"];

    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).toBe(false);
  });

  it("rejects stopped closures whose evaluation interval differs from the frozen commitment", () => {
    const closure = stoppedClosure();
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).toBe(true);
    closure.evaluation.interval_ms = closure.commitment.window_policy.interval_ms + 1;
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).toBe(false);
  });

  it.each([
    ["market snapshot", (closure: any) => { closure.observations[0].market_snapshot = { price: "60000" }; }],
    ["public aggregate trade", (closure: any) => { closure.observations[0].public_execution_snapshot = { symbol: "BTCUSDT", observed_at: "2026-07-09T22:01:00.000Z", source_kind: "binance_production_public_rest", stream_marker: "agg", agg_trades: [null], authority_status: "read_only" }; }],
    ["public book ticker", (closure: any) => { closure.observations[0].public_execution_snapshot = { symbol: "BTCUSDT", observed_at: "2026-07-09T22:01:00.000Z", source_kind: "binance_production_public_rest", stream_marker: "agg", agg_trades: [], book_ticker: { bid_price: {}, bid_quantity: "1", ask_price: "2", ask_quantity: "1" }, authority_status: "read_only" }; }],
    ["public order book", (closure: any) => { closure.observations[0].public_execution_snapshot = { symbol: "BTCUSDT", observed_at: "2026-07-09T22:01:00.000Z", source_kind: "binance_production_public_rest", stream_marker: "agg", agg_trades: [], order_book: { symbol: "BTCUSDT", observed_at: "2026-07-09T22:01:00.000Z", source_kind: "binance_production_public_rest", sync_status: "synced", gap_detected: "false", authority_status: "read_only" }, authority_status: "read_only" }; }],
    ["decision order request", (closure: any) => { closure.observations[0].decision = { decision_kind: "order_request", source_kind: "trading_system_decision", reason: "x", observed_at: "2026-07-09T22:01:00.000Z", order_request: { intent_kind: "place_order", symbol: "BTCUSDT", side: "buy", order_type: "market", quantity: {} }, authority_status: "trace_only" }; }],
    ["open order", (closure: any) => { closure.observations[0].open_orders = [{ order_id: "order", event_id: "event", side: "buy", order_type: "market", quantity: {}, status: "open", cumulative_filled_quantity: "0", remaining_quantity: "1", created_at: "2026-07-09T22:01:00.000Z", updated_at: "2026-07-09T22:01:00.000Z" }]; }],
    ["fill", (closure: any) => { closure.observations[0].latest_fill = { fill_id: "fill", order_id: "order", fill_status: "filled", fill_price: "60000", fill_quantity: "1", fee_usdt: "0", slippage_usdt: "0", funding_usdt: "0", trade_time: "2026-07-09T22:01:00.000Z", source_trade_id: {} }; }],
    ["processed event identifiers", (closure: any) => { closure.observations[0].processed_trading_system_event_ids = [1]; }]
  ])("returns false without throwing for malformed stopped %s", (_label, mutate) => {
    const closure = stoppedClosure();
    mutate(closure);

    expect(() => paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).not.toThrow();
    expect(paperTradingComparisonStoppedQualificationClosureHasRuntimeShape(closure)).toBe(false);
  });

  it("requires meaningful public evidence for a fill with no source trade id", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    evaluation.latest_fill = {
      fill_id: "fill", order_id: "order", fill_status: "filled", fill_price: "60000",
      fill_quantity: "0.001", fee_usdt: "0", slippage_usdt: "0", funding_usdt: "0",
      trade_time: evaluation.stopped_at!
    };
    evaluation.latest_public_execution_snapshot = {
      symbol: "BTCUSDT", observed_at: evaluation.stopped_at!,
      source_kind: "binance_production_public_rest", stream_marker: "agg:empty",
      agg_trades: [], authority_status: "read_only"
    };

    expect(decidePaperTradingQualification({
      evaluation, commitment, observations, commitmentDigestVerified: true, runnerActive: false
    })).toMatchObject({
      qualification_status: "blocked_by_quality",
      qualification_reasons: ["fill_public_execution_evidence_missing"]
    });
  });

  it.each([
    ["29 observations", (evaluation: any, observations: any[]) => { evaluation.observation_count = 29; observations.shift(); observations.forEach((item, index) => { item.sequence = index + 1; }); }, "collecting_evidence", "min_observation_count_not_met"],
    ["29 elapsed minutes", (evaluation: any, observations: any[]) => { observations[29].observed_at = "2026-07-09T22:29:00.000Z"; }, "collecting_evidence", "min_elapsed_ms_not_met"],
    ["three failed observations", (_evaluation: any, observations: any[]) => { observations.slice(0, 3).forEach((item) => { item.status = "failed"; }); }, "qualified", undefined],
    ["four failed observations", (_evaluation: any, observations: any[]) => { observations.slice(0, 4).forEach((item) => { item.status = "failed"; }); }, "blocked_by_quality", "failed_observation_ratio_exceeded"],
    ["missing market evidence", (_evaluation: any, observations: any[]) => { observations.forEach((item) => { delete item.market_snapshot; }); }, "blocked_by_quality", "latest_market_snapshot_missing"],
    ["account discontinuity", (_evaluation: any, observations: any[]) => { observations[0].cumulative_score.revenue_usdt = 1; observations[0].score_delta.revenue_usdt = 1; }, "blocked_by_quality", "paper_score_account_mismatch"]
  ])("decides qualification for %s", (_label, mutate, expectedStatus, expectedReason) => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    mutate(evaluation, observations);

    const result = decidePaperTradingQualification({
      evaluation, commitment, observations, commitmentDigestVerified: true, runnerActive: false
    });
    expect(result.qualification_status).toBe(expectedStatus);
    expect(expectedReason ? result.qualification_reasons : result.qualification_reasons)
      .toEqual(expectedReason ? [expectedReason] : []);
  });

  it("treats a stale commitment digest as non-qualification evidence", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    expect(decidePaperTradingQualification({
      evaluation, commitment, observations: qualificationObservations(commitment, evaluation),
      commitmentDigestVerified: false, runnerActive: false
    })).toMatchObject({
      qualification_status: "not_qualification_evidence",
      qualification_reasons: ["paper_evaluation_commitment_missing"]
    });
  });

  it("binds persisted record changes for every frozen comparison authority", () => {
    const closure = stoppedClosure();
    const version = { record_kind: "candidate_version", version: 1, candidate_version_id: "version", runtime_ref: { record_kind: "trading_run", id: "default" } } as any;
    expect(paperTradingComparisonPersistedRecordDigestInput({ ...version, runtime_ref: { record_kind: "trading_run", id: "changed" } }))
      .not.toBe(paperTradingComparisonPersistedRecordDigestInput(version));
    expect(paperTradingComparisonSystemCodeRecordDigestInput({ ...closure.systemCode, entrypoint: ["python3", "changed.py"] }))
      .not.toBe(paperTradingComparisonSystemCodeRecordDigestInput(closure.systemCode));
    expect(paperTradingComparisonAdmissionDecisionDigestInput({ ...closure.admission, submitted_artifact_digest: "sha256:changed" }))
      .not.toBe(paperTradingComparisonAdmissionDecisionDigestInput(closure.admission));
    expect(paperTradingComparisonTradingPromotionDigestInput({ ...closure.promotion, promoted_at: "2026-07-09T22:31:01.000Z" }))
      .not.toBe(paperTradingComparisonTradingPromotionDigestInput(closure.promotion));
    expect(paperTradingComparisonEvaluationRecordDigestInput({ ...closure.evaluation, started_at: "2026-07-09T22:00:01.000Z" }))
      .not.toBe(paperTradingComparisonEvaluationRecordDigestInput(closure.evaluation));
  });

  it("rejects an inert side when SystemCode is created after admission", () => {
    const side = inertSide();
    expect(paperTradingComparisonSideRecordsHaveInertShape(side)).toBe(true);
    side.systemCode.created_at = "2026-07-09T22:01:00.000Z";
    expect(paperTradingComparisonSideRecordsHaveInertShape(side)).toBe(false);
  });

  it("accepts semantically equal reordered paper account snapshots", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    evaluation.paper_account_snapshot = reorderedAccount(evaluation.paper_account_snapshot!);
    observations.forEach((item) => { item.paper_account_snapshot = reorderedAccount(item.paper_account_snapshot!); });

    expect(decidePaperTradingQualification({
      evaluation, commitment, observations, commitmentDigestVerified: true, runnerActive: false
    })).toMatchObject({ qualification_status: "qualified", qualification_reasons: [] });
  });

  it("blocks a fill whose source trade id has no matching public execution evidence", () => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    evaluation.latest_fill = { fill_id: "fill", order_id: "order", fill_status: "filled", fill_price: "60000", fill_quantity: "0.001", fee_usdt: "0", slippage_usdt: "0", funding_usdt: "0", trade_time: evaluation.stopped_at!, source_trade_id: "aggTrade:missing" };
    evaluation.latest_public_execution_snapshot = { symbol: "BTCUSDT", observed_at: evaluation.stopped_at!, source_kind: "binance_production_public_rest", stream_marker: "aggTrade:other", agg_trades: [], authority_status: "read_only" };

    expect(decidePaperTradingQualification({
      evaluation, commitment, observations, commitmentDigestVerified: true, runnerActive: false
    })).toMatchObject({ qualification_status: "blocked_by_quality", qualification_reasons: ["fill_public_execution_evidence_missing"] });
  });

  it.each([
    ["inactive running evaluation", (commitment: any, evaluation: any) => { evaluation.status = "running"; }, "needs_resume", "runner_inactive_for_running_evaluation"],
    ["failed evaluation", (_commitment: any, evaluation: any) => { evaluation.status = "failed"; }, "paper_failed", "paper_evaluation_failed"],
    ["research feedback purpose", (commitment: any, _evaluation: any) => { commitment.evidence_purpose = "research_feedback"; commitment.window_policy.release_policy = "closed_observation"; }, "not_qualification_evidence", "evidence_purpose_not_qualification"],
    ["ineligible provider", (commitment: any, _evaluation: any) => { commitment.provider_identity.qualification_eligible = false; }, "not_qualification_evidence", "provider_identity_not_qualification_eligible"],
    ["invalidated evaluation", (_commitment: any, evaluation: any) => { evaluation.status = "invalidated"; }, "blocked_by_quality", "paper_evaluation_invalidated"]
  ])("preserves qualification status and reason for %s", (_label, mutate, expectedStatus, expectedReason) => {
    const commitment = qualificationCommitment();
    const evaluation = qualificationEvaluation(commitment);
    const observations = qualificationObservations(commitment, evaluation);
    mutate(commitment, evaluation);
    expect(decidePaperTradingQualification({
      evaluation, commitment, observations, commitmentDigestVerified: true, runnerActive: false
    })).toMatchObject({ qualification_status: expectedStatus, qualification_reasons: [expectedReason] });
  });

  it("validates complete comparison preparation and commitment shapes while rejecting invalid variants", () => {
    const policy = comparisonPolicy();
    const selection = { selection_kind: "bootstrap" } as const;
    const preparation = comparisonPreparation(policy, selection);
    const commitment = comparisonCommitment(policy, selection);

    expect(paperTradingComparisonPolicyHasRuntimeShape(policy)).toBe(true);
    expect(paperTradingComparisonChampionSelectionHasRuntimeShape(selection, "bootstrap")).toBe(true);
    expect(paperTradingComparisonPreparationHasRuntimeShape(preparation)).toBe(true);
    expect(paperTradingComparisonCommitmentHasRuntimeShape(commitment)).toBe(true);
    expect(paperTradingComparisonPolicyHasRuntimeShape({ ...policy, minimum_observation_count: 0 })).toBe(false);
    expect(paperTradingComparisonChampionSelectionHasRuntimeShape({ selection_kind: "trading_review" }, "champion_challenge")).toBe(false);
    expect(paperTradingComparisonPreparationHasRuntimeShape({ ...preparation, champion_selection: null })).toBe(false);
    expect(paperTradingComparisonCommitmentHasRuntimeShape({ ...commitment, challenger: { ...commitment.challenger, trading_run_ref: commitment.champion.trading_run_ref } })).toBe(false);
  });
});

function qualificationCommitment(): PaperTradingEvaluationCommitmentRecord {
  return {
    record_kind: "paper_trading_evaluation_commitment", version: 1,
    paper_trading_evaluation_commitment_id: "commitment", evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: "candidate" },
    candidate_version_ref: { record_kind: "candidate_version", id: "version" },
    trading_run_ref: { record_kind: "trading_run", id: "run" },
    system_code_ref: { record_kind: "system_code", id: "code" },
    system_code_artifact_digest: "sha256:code", resolved_artifact_digest: "sha256:resolved",
    runtime_identity: { artifact_kind: "python_file", runtime_kind: "python", entrypoint: ["python3", "run.py"] },
    provider_identity: { runtime_provider_kind: "none", qualification_eligible: true },
    capability_policy_ref: { record_kind: "capability_policy", id: "policy" },
    secret_policy_ref: { record_kind: "secret_policy", id: "policy" },
    policy_identity: { market_data_policy_version: "market", gateway_policy_version: "gateway", cost_policy_version: "cost", funding_policy_version: "funding", slippage_policy_version: "slippage", fill_policy_version: "fill", risk_policy_version: "risk", paper_account_policy_version: "account", decision_event_protocol_version: "decision", persistent_state_boundary_version: "state" },
    data_identity: { symbol: "BTCUSDT", market_data_port: "gateway_owned", allowed_market_data_source: "binance_production_public_rest", market_data_configuration_digest: "sha256:market", private_exchange_access: "forbidden", live_order_access: "forbidden" },
    window_policy: { interval_ms: 60_000, release_policy: "sealed_until_adjudication", eligibility_policy_version: "v1" },
    initial_account_snapshot: account(), committed_at: "2026-07-09T22:00:00.000Z",
    commitment_digest: "sha256:verified", authority_status: "not_live"
  };
}

function qualificationEvaluation(commitment: PaperTradingEvaluationCommitmentRecord): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation", version: 1, paper_trading_evaluation_id: "evaluation",
    candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: commitment.trading_run_ref,
    paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id },
    status: "stopped", interval_ms: 60_000, observation_count: 30,
    started_at: "2026-07-09T22:00:00.000Z", last_observed_at: "2026-07-09T22:30:00.000Z", stopped_at: "2026-07-09T22:30:00.000Z",
    latest_score: score(), paper_account_snapshot: account(), open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], authority_status: "not_live"
  };
}

function qualificationObservations(commitment: PaperTradingEvaluationCommitmentRecord, evaluation: PaperTradingEvaluationRecord): PaperTradingObservationRecord[] {
  return Array.from({ length: 30 }, (_, index) => ({
    record_kind: "paper_trading_observation", version: 1, paper_trading_observation_id: `observation-${index + 1}`,
    paper_trading_evaluation_ref: { record_kind: evaluation.record_kind, id: evaluation.paper_trading_evaluation_id },
    paper_trading_evaluation_commitment_ref: { record_kind: commitment.record_kind, id: commitment.paper_trading_evaluation_commitment_id },
    candidate_ref: commitment.candidate_ref, candidate_version_ref: commitment.candidate_version_ref, trading_run_ref: commitment.trading_run_ref,
    sequence: index + 1, status: "no_order", observed_at: `2026-07-09T22:${String(index + 1).padStart(2, "0")}:00.000Z`,
    market_snapshot: { symbol: "BTCUSDT", price: 60_000, observed_at: `2026-07-09T22:${String(index + 1).padStart(2, "0")}:00.000Z`, source_kind: "binance_production_public_rest", authority_status: "read_only" },
    paper_account_snapshot: account(), open_orders: [], processed_trading_system_event_ids: [], processed_public_trade_ids: [], score_delta: score(), cumulative_score: score(), authority_status: "not_live"
  }));
}

function account() {
  return { wallet_balance_usdt: "10000", available_balance_usdt: "10000", equity_usdt: "10000", realized_pnl_usdt: "0", unrealized_pnl_usdt: "0", fee_paid_usdt: "0", slippage_paid_usdt: "0", funding_paid_usdt: "0", margin_reserved_usdt: "0", position: { symbol: "BTCUSDT" as const, quantity: "0", side: "flat" as const, mark_price: "0", notional_usdt: "0" }, open_order_count: 0, authority_status: "not_live" as const };
}

function score() {
  return { revenue_usdt: 0, cost_usdt: 0, net_revenue_usdt: 0, net_return_pct: 0 };
}

function stoppedClosure(): any {
  const commitment = qualificationCommitment();
  commitment.committed_at = "2026-07-09T22:00:00.000Z";
  const evaluation = qualificationEvaluation(commitment);
  const observations = qualificationObservations(commitment, evaluation);
  const systemCode = {
    record_kind: "system_code", version: 1, system_code_id: "code", artifact_kind: "python_file",
    artifact_path: "run.py", runtime_kind: "python", entrypoint: ["python3", "run.py"],
    declared_output_contract: { contract_kind: "opaque_runtime_boundary", declared_output_kinds: ["order_request"] },
    secret_policy_ref: { record_kind: "secret_policy", id: "policy" },
    capability_policy_ref: { record_kind: "capability_policy", id: "policy" },
    artifact_digest: "sha256:code", provenance_refs: [], status: "registered",
    created_at: "2026-07-09T21:58:00.000Z", authority_status: "not_live"
  };
  const admission = {
    record_kind: "candidate_admission_decision", version: 1,
    candidate_admission_decision_id: "admission",
    source_system_code_ref: { record_kind: "system_code", id: "source" },
    system_code_ref: { record_kind: "system_code", id: "code" },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment" },
    trading_evaluation_result_ref: { record_kind: "trading_evaluation_result", id: "result" },
    research_finding_ref: { record_kind: "research_finding", id: "finding" },
    source_artifact_digest: "sha256:source", submitted_artifact_digest: "sha256:code",
    research_worker_outcome: "changed", experiment_status: "evaluated", evaluation_status: "accepted",
    evidence_disposition: "not_counted", status: "admitted", reason: "evaluation_accepted",
    runnable_paper_handoff: true, decided_at: "2026-07-09T21:59:00.000Z", authority_status: "not_live"
  };
  return {
    systemCode, admission, commitment, evaluation, observations,
    promotion: {
      record_kind: "trading_promotion", version: 1, trading_promotion_id: "promotion",
      status: "promoted_for_trading_review", candidate_ref: commitment.candidate_ref,
      candidate_version_ref: commitment.candidate_version_ref,
      paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: evaluation.paper_trading_evaluation_id },
      comparison_confirmation: {
        basis_kind: "paper_trading_comparison_confirmation",
        campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: "promotion-campaign"
        },
        campaign_digest: "sha256:promotion-campaign",
        campaign_outcome_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
          id: "promotion-campaign-outcome"
        },
        campaign_outcome_digest: "sha256:promotion-campaign-outcome",
        final_verdict_ref: {
          record_kind: "paper_trading_comparison_verdict",
          id: "promotion-final-verdict"
        },
        final_verdict_digest: "sha256:promotion-final-verdict"
      },
      promoted_at: "2026-07-09T22:31:00.000Z", authority_status: "not_live"
    },
    preparationCommittedAt: "2026-07-09T22:32:00.000Z"
  };
}

function inertSide(): any {
  const closure = stoppedClosure();
  const run = {
    record_kind: "trading_run", version: 1, trading_run_id: "run", stage_binding_profile: "paper",
    runtime_lifecycle_status: "registered", paper_evidence_purpose: "qualification",
    candidate_ref: closure.commitment.candidate_ref, candidate_version_ref: closure.commitment.candidate_version_ref,
    placement_ref: { record_kind: "sandbox_placement", id: "placement" },
    hands_environment_ref: { record_kind: "hands_environment", id: "hands" },
    memory_surface_ref: { record_kind: "runtime_memory_surface", id: "memory" },
    system_code_ref: closure.commitment.system_code_ref, created_at: "2026-07-09T22:00:00.000Z",
    authority_status: "not_live"
  };
  const version = {
    record_kind: "candidate_version", version: 1, candidate_version_id: "version", candidate_id: "candidate",
    version_label: "v1", spec_ref: { record_kind: "trading_system_spec", id: "spec" },
    program_ref: { record_kind: "trading_system_program", id: "program" },
    runtime_ref: { record_kind: "trading_run", id: "default-run" },
    trace_placeholder_ref: { record_kind: "trace_placeholder", id: "trace" },
    capability_package_refs: [], system_code_ref: closure.commitment.system_code_ref
  };
  return {
    candidate: { candidate_id: "candidate", runtime: { ref: { record_kind: "trading_run", id: "run" } }, system_code: { ref: closure.commitment.system_code_ref } },
    candidateVersion: version, admission: closure.admission, run, systemCode: closure.systemCode,
    commitment: closure.commitment,
    evaluation: { ...closure.evaluation, status: "not_started", observation_count: 0, last_observed_at: undefined, next_observation_at: undefined, stopped_at: undefined, latest_score: score(), paper_account_snapshot: account(), open_orders: [], latest_fill: undefined, processed_trading_system_event_ids: [], processed_public_trade_ids: [], latest_public_execution_snapshot: undefined, invalidation_reason: undefined, latest_failure_reason: undefined },
    observations: []
  };
}

function reorderedAccount(account: any): any {
  return Object.fromEntries(Object.entries(account).reverse().map(([key, value]) => [
    key,
    key === "position" ? Object.fromEntries(Object.entries(value as object).reverse()) : value
  ]));
}

function comparisonPolicy(): any {
  return { policy_version: "v1", comparison_mode: "bootstrap", symbol: "BTCUSDT", interval_ms: 60_000, minimum_observation_count: 30, minimum_elapsed_ms: 1_800_000, maximum_observation_count: 120, maximum_elapsed_ms: 7_200_000, maximum_start_skew_ms: 60_000, maximum_provider_request_count_per_side: 100, maximum_retry_count_per_side: 3, primary_metric: "net_revenue_usdt", minimum_net_revenue_lift_usdt: 0, required_confirmation_count: 1, require_non_overlapping_windows: true, require_both_qualified: true, release_policy: "sealed_until_adjudication" };
}

function comparisonCandidateSide(role: "champion" | "challenger", suffix: string): any {
  return { role, candidate_ref: { record_kind: "trading_system_candidate", id: `candidate-${suffix}` }, candidate_version_ref: { record_kind: "candidate_version", id: `version-${suffix}` }, candidate_version_digest: `sha256:version-${suffix}`, system_code_ref: { record_kind: "system_code", id: `code-${suffix}` }, system_code_record_digest: `sha256:code-${suffix}`, system_code_artifact_digest: `sha256:artifact-${suffix}`, candidate_admission_decision_ref: { record_kind: "candidate_admission_decision", id: `admission-${suffix}` }, admission_decision_digest: `sha256:admission-${suffix}` };
}

function comparisonPreparation(policy: any, selection: any): any {
  return { record_kind: "paper_trading_comparison_preparation", version: 1, paper_trading_comparison_preparation_id: "preparation", paper_trading_comparison_commitment_id: "commitment", champion: comparisonCandidateSide("champion", "champion"), challenger: comparisonCandidateSide("challenger", "challenger"), champion_selection: selection, comparison_policy: policy, market_data_configuration_digest: "sha256:market", paper_policy_identity: qualificationCommitment().policy_identity, committed_at: "2026-07-09T22:00:00.000Z", preparation_digest: "sha256:preparation", authority_status: "not_live" };
}

function comparisonCommitment(policy: any, selection: any): any {
  const champion = { ...comparisonCandidateSide("champion", "champion"), trading_run_ref: { record_kind: "trading_run", id: "run-champion" }, paper_trading_evaluation_commitment_ref: { record_kind: "paper_trading_evaluation_commitment", id: "commitment-champion" }, paper_trading_evaluation_commitment_digest: "sha256:commitment-champion", paper_trading_evaluation_commitment_record_digest: "sha256:commitment-record-champion", paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: "evaluation-champion" }, paper_trading_evaluation_record_digest: "sha256:evaluation-champion" };
  const challenger = { ...comparisonCandidateSide("challenger", "challenger"), trading_run_ref: { record_kind: "trading_run", id: "run-challenger" }, paper_trading_evaluation_commitment_ref: { record_kind: "paper_trading_evaluation_commitment", id: "commitment-challenger" }, paper_trading_evaluation_commitment_digest: "sha256:commitment-challenger", paper_trading_evaluation_commitment_record_digest: "sha256:commitment-record-challenger", paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: "evaluation-challenger" }, paper_trading_evaluation_record_digest: "sha256:evaluation-challenger" };
  return { record_kind: "paper_trading_comparison_commitment", version: 1, paper_trading_comparison_commitment_id: "commitment", preparation_ref: { record_kind: "paper_trading_comparison_preparation", id: "preparation" }, champion, challenger, champion_selection: selection, comparison_policy: policy, market_data_configuration_digest: "sha256:market", paper_policy_identity: qualificationCommitment().policy_identity, committed_at: "2026-07-09T22:00:00.000Z", commitment_digest: "sha256:commitment", authority_status: "not_live" };
}
