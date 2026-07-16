import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  closeResearchControlStudyExecutionLease,
  decideResearchControlStudyExecutionLease,
  renewResearchControlStudyExecutionLease,
  researchControlStudyExecutionLeaseDigestInput,
  researchControlStudyExecutionLeaseHasRuntimeShape,
  type ResearchControlStudyExecutionLeaseRecord,
  type ResearchControlStudyRecord
} from "./index";

describe("ResearchControlStudyExecutionLease", () => {
  it("decides one exact active runtime-coordination lease", () => {
    const lease = activeLease();

    expect(lease).toMatchObject({
      record_kind: "research_control_study_execution_lease",
      version: 1,
      study_ref: {
        record_kind: "research_control_study",
        id: studyFixture().research_control_study_id
      },
      study_digest: studyFixture().study_digest,
      owner: ownerFixture(),
      lease_token: "lease-token-a",
      fencing_token: 7,
      lease_status: "active",
      lease_duration_ms: 30_000,
      acquired_at: "2026-07-13T00:00:00.000Z",
      renewed_at: "2026-07-13T00:00:00.000Z",
      expires_at: "2026-07-13T00:00:30.000Z",
      runtime_coordination_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    });
    expect(lease).not.toHaveProperty("closed_at");
    expect(lease).not.toHaveProperty("close_reason");
    expect(lease.research_control_study_execution_lease_id)
      .toBe(`research-control-study-execution-lease-${createHash("sha256")
        .update(`${studyFixture().research_control_study_id}:lease-token-a`)
        .digest("hex").slice(0, 32)}`);
    expect(lease.lease_digest).toBe(`sha256:${createHash("sha256")
      .update(researchControlStudyExecutionLeaseDigestInput(lease))
      .digest("hex")}`);
    expect(researchControlStudyExecutionLeaseHasRuntimeShape(lease)).toBe(true);
    expect(activeLease()).toEqual(lease);
  });

  it("renews the same lease with a strictly later exact expiry", () => {
    const active = activeLease();
    const renewed = renewResearchControlStudyExecutionLease({
      lease: active,
      renewedAt: "2026-07-13T00:00:10.000Z"
    });

    expect(renewed).toMatchObject({
      research_control_study_execution_lease_id:
        active.research_control_study_execution_lease_id,
      lease_token: active.lease_token,
      fencing_token: active.fencing_token,
      lease_status: "active",
      acquired_at: active.acquired_at,
      renewed_at: "2026-07-13T00:00:10.000Z",
      expires_at: "2026-07-13T00:00:40.000Z"
    });
    expect(renewed.lease_digest).not.toBe(active.lease_digest);
    expect(researchControlStudyExecutionLeaseHasRuntimeShape(renewed)).toBe(true);
    expect(active.renewed_at).toBe("2026-07-13T00:00:00.000Z");
  });

  it("rejects renewal at or after the persisted lease expiry", () => {
    for (const renewedAt of [
      "2026-07-13T00:00:30.000Z",
      "2026-07-13T00:00:31.000Z"
    ]) {
      expect(() => renewResearchControlStudyExecutionLease({
        lease: activeLease(),
        renewedAt
      })).toThrowError(expect.objectContaining({
        code: "invalid_research_control_study_execution_lease_input"
      }));
    }
  });

  it.each([
    ["released", "owner_released"],
    ["expired", "expired_owner_absent"]
  ] as const)("closes exact %s owner history", (leaseStatus, closeReason) => {
    const active = activeLease();
    const closed = closeResearchControlStudyExecutionLease({
      lease: active,
      leaseStatus,
      closedAt: "2026-07-13T00:00:31.000Z"
    });

    expect(closed).toMatchObject({
      lease_status: leaseStatus,
      closed_at: "2026-07-13T00:00:31.000Z",
      close_reason: closeReason,
      lease_token: active.lease_token
    });
    expect(researchControlStudyExecutionLeaseHasRuntimeShape(closed)).toBe(true);
    expect(active.lease_status).toBe("active");
  });

  it("closes distributed expiry with explicit fenced-takeover evidence", () => {
    const active = activeLease();
    const closed = closeResearchControlStudyExecutionLease({
      lease: active,
      leaseStatus: "expired",
      closeReason: "expired_fenced_takeover",
      closedAt: "2026-07-13T00:00:31.000Z"
    });

    expect(closed).toMatchObject({
      lease_status: "expired",
      close_reason: "expired_fenced_takeover",
      fencing_token: 7
    });
    expect(researchControlStudyExecutionLeaseHasRuntimeShape(closed)).toBe(true);
  });

  it("keeps digest input independent of envelope identity and digest", () => {
    const lease = activeLease();
    const changed = structuredClone(lease);
    changed.research_control_study_execution_lease_id = "other-lease";
    changed.lease_digest = digest("f");

    expect(researchControlStudyExecutionLeaseDigestInput(changed)).toBe(
      researchControlStudyExecutionLeaseDigestInput(lease)
    );
  });

  it.each([
    ["empty server instance", (value: any) => {
      value.owner.server_instance_id = "";
    }],
    ["empty host", (value: any) => { value.owner.host_id = ""; }],
    ["zero PID", (value: any) => { value.owner.process_id = 0; }],
    ["fractional PID", (value: any) => { value.owner.process_id = 1.5; }],
    ["empty process start marker", (value: any) => {
      value.owner.process_start_marker = "";
    }],
    ["empty token", (value: any) => { value.lease_token = ""; }],
    ["zero fencing token", (value: any) => { value.fencing_token = 0; }],
    ["fractional fencing token", (value: any) => {
      value.fencing_token = 1.5;
    }],
    ["zero duration", (value: any) => { value.lease_duration_ms = 0; }],
    ["fractional duration", (value: any) => {
      value.lease_duration_ms = 1.5;
    }],
    ["out-of-range duration", (value: any) => {
      value.lease_duration_ms = Number.MAX_SAFE_INTEGER;
    }],
    ["bad acquired time", (value: any) => {
      value.acquired_at = "2026-07-13";
    }],
    ["renewal before acquisition", (value: any) => {
      value.renewed_at = "2026-07-12T23:59:59.999Z";
    }],
    ["expiry drift", (value: any) => {
      value.expires_at = "2026-07-13T00:00:30.001Z";
    }],
    ["active close time", (value: any) => {
      value.closed_at = "2026-07-13T00:00:01.000Z";
    }],
    ["active close reason", (value: any) => {
      value.close_reason = "owner_released";
    }],
    ["released reason drift", (value: any) => {
      value.lease_status = "released";
      value.closed_at = "2026-07-13T00:00:31.000Z";
      value.close_reason = "expired_owner_absent";
    }],
    ["expired reason drift", (value: any) => {
      value.lease_status = "expired";
      value.closed_at = "2026-07-13T00:00:31.000Z";
      value.close_reason = "owner_released";
    }],
    ["terminal close before renewal", (value: any) => {
      value.lease_status = "released";
      value.closed_at = "2026-07-12T23:59:59.999Z";
      value.close_reason = "owner_released";
    }],
    ["evaluation authority", (value: any) => {
      value.evaluation_authority = true;
    }],
    ["policy authority", (value: any) => {
      value.policy_replacement_authority = true;
    }],
    ["promotion authority", (value: any) => {
      value.promotion_authority = true;
    }],
    ["order authority", (value: any) => {
      value.order_submission_authority = true;
    }],
    ["live authority", (value: any) => {
      value.live_exchange_authority = true;
    }],
    ["extra field", (value: any) => { value.rank = 1; }]
  ])("rejects %s", (_label, mutate) => {
    const lease = activeLease() as any;
    mutate(lease);
    expect(researchControlStudyExecutionLeaseHasRuntimeShape(lease)).toBe(false);
  });

  it("rejects invalid decisions and non-monotonic transitions", () => {
    expect(() => decideResearchControlStudyExecutionLease({
      study: studyFixture(),
      owner: ownerFixture(),
      leaseToken: " lease-token-a ",
      fencingToken: 7,
      leaseDurationMs: 30_000,
      acquiredAt: "2026-07-13T00:00:00.000Z"
    })).toThrowError(expect.objectContaining({
      code: "invalid_research_control_study_execution_lease_input"
    }));
    expect(() => renewResearchControlStudyExecutionLease({
      lease: activeLease(),
      renewedAt: "2026-07-13T00:00:00.000Z"
    })).toThrowError(expect.objectContaining({
      code: "invalid_research_control_study_execution_lease_input"
    }));
    const released = closeResearchControlStudyExecutionLease({
      lease: activeLease(),
      leaseStatus: "released",
      closedAt: "2026-07-13T00:00:01.000Z"
    });
    expect(() => renewResearchControlStudyExecutionLease({
      lease: released,
      renewedAt: "2026-07-13T00:00:02.000Z"
    })).toThrowError(expect.objectContaining({
      code: "invalid_research_control_study_execution_lease_input"
    }));
    expect(() => closeResearchControlStudyExecutionLease({
      lease: released,
      leaseStatus: "expired",
      closedAt: "2026-07-13T00:00:02.000Z"
    })).toThrowError(expect.objectContaining({
      code: "invalid_research_control_study_execution_lease_input"
    }));
  });
});

function activeLease(): ResearchControlStudyExecutionLeaseRecord {
  return decideResearchControlStudyExecutionLease({
    study: studyFixture(),
    owner: ownerFixture(),
    leaseToken: "lease-token-a",
    fencingToken: 7,
    leaseDurationMs: 30_000,
    acquiredAt: "2026-07-13T00:00:00.000Z"
  });
}

function ownerFixture() {
  return {
    server_instance_id: "server-a",
    host_id: "host-a",
    process_id: 101,
    process_start_marker: "process-start-a"
  };
}

function studyFixture(): ResearchControlStudyRecord {
  const baseline = digest("a");
  return {
    record_kind: "research_control_study",
    version: 1,
    research_control_study_id: "research-control-study-001",
    idempotency_key: "study-001",
    hypothesis:
      "adaptive_allocation_improves_replicated_qualified_discovery_yield",
    baseline_policy: "same_frozen_snapshot",
    baseline_snapshot_digest: baseline,
    condition: {
      source: {
        candidate_ref: { record_kind: "trading_system_candidate", id: "source" },
        candidate_version_ref: { record_kind: "candidate_version", id: "source-version" },
        system_code_ref: { record_kind: "system_code", id: "source-code" },
        system_code_artifact_digest: digest("b"),
        system_code_record_digest: digest("c"),
        research_artifact_protocol: "single_file_python_v1",
        research_artifact_closure_digest: digest("d")
      },
      research_agent: {
        provider: "fixture",
        model: "fixture-model",
        permission_policy: "fixture_only",
        identity_digest: digest("e")
      },
      paper_comparator: {
        comparator_status: "trading_review",
        trading_promotion_ref: { record_kind: "trading_promotion", id: "promotion" },
        trading_promotion_digest: digest("1"),
        candidate_ref: { record_kind: "trading_system_candidate", id: "champion" },
        candidate_version_ref: { record_kind: "candidate_version", id: "champion-version" },
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "champion-evaluation"
        }
      },
      paper_evaluation_protocol: boundPaperProtocol(),
      allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
      allocation_policy_digest: digest("2"),
      campaign_policy: campaignPolicy(),
      condition_digest: digest("3")
    },
    replications: Array.from({ length: 6 }, (_, index) => ({
      replication_index: index + 1,
      campaign_idempotency_key: `study-replication-${index + 1}`,
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: `campaign-${index + 1}`
      },
      expected_baseline_snapshot_digest: baseline
    })),
    analysis_policy: {
      policy_version: "paired_exact_sign_test_v1",
      primary_estimand:
        "mean_adaptive_minus_static_qualified_discovery_rate",
      significance_method: "two_sided_exact_sign_test",
      alpha: 0.05,
      minimum_non_tied_replication_count: 6,
      tie_policy: "exclude_from_sign_test_include_in_mean",
      minimum_mean_rate_difference: 0
    },
    committed_at: "2026-07-12T09:00:00.000Z",
    study_digest: digest("4"),
    research_scheduling_authority: true,
    evaluation_authority: false,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
}

function boundPaperProtocol() {
  return {
    protocol_status: "bound" as const,
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge" as const,
      symbol: "BTCUSDT" as const,
      interval_ms: 60_000,
      minimum_observation_count: 2,
      minimum_elapsed_ms: 60_000,
      maximum_observation_count: 2,
      maximum_elapsed_ms: 600_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 100,
      maximum_retry_count_per_side: 2,
      primary_metric: "net_revenue_usdt" as const,
      minimum_net_revenue_lift_usdt: 1,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true as const,
      require_both_qualified: true as const,
      release_policy: "sealed_until_adjudication" as const
    },
    market_data_configuration_digest: digest("5"),
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
      policy_version: "research-control-paper-schedule-v1" as const,
      source_start_order: "paired_by_sequence" as const,
      maximum_active_source_pairs: 2 as const,
      maximum_cross_arm_first_tick_skew_ms: 5_000,
      source_missed_start_policy: "slot_expired" as const,
      confirmation_precommit_deadline_ms: 600_000
    },
    protocol_digest: digest("6")
  };
}

function campaignPolicy() {
  return {
    policy_version: "research_control_campaign_v1" as const,
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3 as const,
    concurrency_limit_per_arm: 2 as const,
    maximum_total_development_submissions_per_tick: 5 as const,
    arm_execution_policy: "concurrent_per_sequence" as const,
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order" as const,
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate" as const,
    required_future_evidence:
      "confirmed_comparison_research_release" as const
  };
}

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}
