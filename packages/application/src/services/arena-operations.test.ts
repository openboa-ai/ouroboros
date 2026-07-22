import { describe, expect, it } from "vitest";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingHandoffConformanceRecord,
  PaperTradingObservationRecord
} from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentDigest } from "../trading/paper/commitment";
import type {
  ArenaPaperRuntimeSnapshot,
  ArenaPaperRuntimeSystem
} from "../trading/paper/arena-runtime";
import { ArenaOperationsProjectionService } from "./arena-operations";

describe("ArenaOperationsProjectionService", () => {
  it("keeps an empty paper field stopped from its own runtime snapshot", async () => {
    const fixture = arenaFixture([]);

    await expect(fixture.service.readOperations()).resolves.toMatchObject({
      loop_status: "stopped",
      systems: []
    });
  });

  it("keeps fresh zero-observation systems in their committed comparison cohort", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "running", "2026-07-19T00:00:00.000Z"),
      system("candidate-b", "running", "2026-07-19T00:00:01.000Z")
    ]);
    fixture.addPaper("candidate-a", { observations: [] });
    fixture.addPaper("candidate-b", { observations: [] });

    const projection = await fixture.service.readOperations();

    expect(projection.systems.map((entry) => ({
      candidateId: entry.candidate_id,
      comparabilityStatus: entry.comparability_status,
      reasons: entry.unranked_reasons,
      cohortId: entry.comparison_cohort?.cohort_id
    }))).toEqual([{
      candidateId: "candidate-a",
      comparabilityStatus: "comparable",
      reasons: ["common_observation_boundary_missing"],
      cohortId: expect.any(String)
    }, {
      candidateId: "candidate-b",
      comparabilityStatus: "comparable",
      reasons: ["common_observation_boundary_missing"],
      cohortId: expect.any(String)
    }]);
  });

  it("ranks independently timed sessions at their common paper sequence", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "running", "2026-07-19T00:00:00.000Z"),
      system("candidate-b", "running", "2026-07-19T00:00:01.000Z"),
      system("candidate-c", "running", "2026-07-19T00:00:02.000Z"),
      system("candidate-d", "failed", "2026-07-19T00:00:03.000Z", "sandbox_crashed")
    ]);
    fixture.addPaper("candidate-a", {
      observations: [
        observation("candidate-a", 1, "2026-07-19T00:01:00.000Z", 2),
        observation("candidate-a", 2, "2026-07-19T00:02:00.000Z", 8),
        observation("candidate-a", 3, "2026-07-19T00:03:00.000Z", 100)
      ]
    });
    fixture.addPaper("candidate-b", {
      observations: [
        observation("candidate-b", 1, "2026-07-19T00:01:00.500Z", 4),
        observation("candidate-b", 2, "2026-07-19T00:02:00.750Z", 10)
      ]
    });
    fixture.addPaper("candidate-c", {
      policySuffix: "different-cost-policy",
      observations: [
        observation("candidate-c", 1, "2026-07-19T00:01:00.000Z", 999),
        observation("candidate-c", 2, "2026-07-19T00:02:00.000Z", 999)
      ]
    });
    fixture.addPaper("candidate-d", {
      evaluationStatus: "failed",
      observations: [],
      failureReason: "sandbox_crashed"
    });

    const projection = await fixture.service.readOperations();

    expect(projection).toMatchObject({
      projection_kind: "arena_operations",
      loop_status: "degraded",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 3,
        queued_session_count: 0
      },
      latest_system_id: "candidate-d"
    });
    expect(projection.systems.map((entry) => [
      entry.candidate_id,
      entry.rank_status,
      entry.rank,
      entry.profit_loss?.net_revenue_usdt,
      entry.unranked_reasons
    ])).toEqual([
      ["candidate-b", "provisional_ranked", 1, 10, []],
      ["candidate-a", "provisional_ranked", 2, 8, []],
      ["candidate-c", "unranked", undefined, 999, ["comparison_cohort_mismatch"]],
      ["candidate-d", "unranked", undefined, 0, ["comparison_evidence_incomplete"]]
    ]);
    expect(projection.systems[0]).toMatchObject({
      comparison_sequence: 2,
      comparison_cutoff_at: "2026-07-19T00:02:00.750Z",
      runner_status: "active",
      sandbox_status: "running",
      latest_decision: { decision_kind: "hold" }
    });
    expect(projection.systems[2]).toMatchObject({
      comparability_status: "incomparable",
      rank_status: "unranked"
    });
    expect(projection.systems[3]).toMatchObject({
      session_status: "failed",
      runner_status: "inactive",
      sandbox_status: "failed",
      latest_failure: { reason: "sandbox_crashed" }
    });
  });

  it("keeps stopped sessions in the final paper ranking", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "stopped", "2026-07-19T00:00:00.000Z"),
      system("candidate-b", "running", "2026-07-19T00:00:01.000Z")
    ]);
    fixture.addPaper("candidate-a", {
      evaluationStatus: "stopped",
      observations: [
        observation("candidate-a", 1, "2026-07-19T00:01:00.000Z", 12)
      ]
    });
    fixture.addPaper("candidate-b", {
      observations: [
        observation("candidate-b", 1, "2026-07-19T00:01:00.500Z", 4)
      ]
    });

    const projection = await fixture.service.readOperations();

    expect(projection.systems.map((entry) => ({
      candidateId: entry.candidate_id,
      sessionStatus: entry.session_status,
      rankStatus: entry.rank_status,
      rank: entry.rank
    }))).toEqual([{
      candidateId: "candidate-a",
      sessionStatus: "stopped",
      rankStatus: "ranked",
      rank: 1
    }, {
      candidateId: "candidate-b",
      sessionStatus: "running",
      rankStatus: "provisional_ranked",
      rank: 2
    }]);
  });

  it("returns only the selected system's bounded immutable detail and removes host paths", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "recovering", "2026-07-19T00:00:00.000Z"),
      system("candidate-b", "running", "2026-07-19T00:00:01.000Z")
    ]);
    const candidateAObservation = observation(
      "candidate-a",
      1,
      "2026-07-19T00:01:00.000Z",
      3
    );
    candidateAObservation.decision!.reason =
      "/Users/private-user/work/strategy.py token=private-decision-token";
    fixture.addPaper("candidate-a", { observations: [candidateAObservation] });
    const candidateA = fixture.candidates.get("candidate-a")!;
    candidateA.display_name =
      "/Users/private-user/system token=private-display-token";
    candidateA.system_code!.summary =
      "/workspace/ouroboros/candidate-arena-runs/strategy.py token=private-summary-token";
    candidateA.system_code!.declared_outputs.push(
      "/Users/private-user/output token=private-manifest-token"
    );
    candidateA.full_cycle_lineage!.blocked_reason =
      "/Users/private-user/lineage token=private-lineage-token";
    candidateA.runtime.transcript!.items[0]!.summary =
      "/opt/ouroboros/runtime.json token=private-trace-token";
    fixture.addPaper("candidate-b", {
      observations: [observation("candidate-b", 1, "2026-07-19T00:01:00.000Z", 4)]
    });

    const detail = await fixture.service.readSystemDetail("candidate-a");

    expect(detail).toMatchObject({
      candidate_id: "candidate-a",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-candidate-a"
      },
      paper_trading_handoff_conformance_ref: {
        record_kind: "paper_trading_handoff_conformance",
        id: "conformance-candidate-a"
      },
      isolation: {
        isolation_id: "sandbox-candidate-a",
        workspace_identity: workspaceDigest("candidate-a"),
        sandbox_status: "running",
        network_policy_status: "not_required",
        egress_attestation_status: "not_required"
      },
      trading_system_manifest: {
        summary: "[private-path] token=[redacted]",
        declared_runtime: "python",
        declared_outputs: [
          "order_request",
          "[private-path] token=[redacted]"
        ],
        allowed_stages: ["paper"],
        declared_permissions: ["public_market_data"]
      },
      lineage: {
        source: { trading_system_id: "source-candidate-a" }
      }
    });
    expect(detail?.trace_events.map((event) => event.event_kind)).toEqual([
      "market_observation",
      "trading_system_decision",
      "lifecycle",
      "gateway_outcome"
    ]);
    expect(detail?.trace_events.find((event) =>
      event.event_kind === "lifecycle"
    )?.summary).toBe(
      "Restart recovery: [private-path] token=[redacted]"
    );
    expect(detail?.log_entries).toHaveLength(1);
    expect(detail?.log_entries[0]).toMatchObject({
      level: "info",
      source: "trading_system",
      message: "event=paper_tick status=ok sequence=1"
    });
    expect(detail?.logs_truncated).toBe(true);
    expect(detail?.latest_decision?.reason).toBe(
      "[private-path] token=[redacted]"
    );
    expect(detail?.display_name).toBe("[private-path] token=[redacted]");
    expect(JSON.stringify(detail)).not.toContain("/Users/private-user");
    expect(JSON.stringify(detail)).not.toContain("/workspace/ouroboros");
    expect(JSON.stringify(detail)).not.toContain("/opt/ouroboros");
    expect(JSON.stringify(detail)).not.toContain("private-decision-token");
    expect(JSON.stringify(detail)).not.toContain("private-display-token");
    expect(JSON.stringify(detail)).not.toContain("private-summary-token");
    expect(JSON.stringify(detail)).not.toContain("private-manifest-token");
    expect(JSON.stringify(detail)).not.toContain("private-lineage-token");
    expect(JSON.stringify(detail)).not.toContain("private-trace-token");
    expect(JSON.stringify(detail)).not.toContain("candidate-b secret");
    expect(detail?.artifact_refs).toEqual(expect.arrayContaining([
      { record_kind: "system_code", id: "system-code-candidate-a" },
      { record_kind: "paper_trading_evaluation", id: "evaluation-candidate-a" }
    ]));
  });

  it("fails Docker isolation closed when workspace and legacy egress evidence disagree", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "running", "2026-07-19T00:00:00.000Z")
    ]);
    const candidateA = fixture.candidates.get("candidate-a")!;
    candidateA.runtime.sandbox!.adapter_kind = "docker_sandboxes_sbx";
    fixture.snapshot.systems[0]!.workspace_key = `sha256:${"f".repeat(64)}`;
    fixture.conformances.get("conformance-candidate-a")!.runner_kind =
      "docker_sandboxes_sbx";

    const detail = await fixture.service.readSystemDetail("candidate-a");

    expect(detail?.isolation).toEqual({
      isolation_id: "sandbox-candidate-a",
      sandbox_status: "running",
      network_policy_status: "failed",
      egress_attestation_status: "failed",
      authority_status: "not_live"
    });
  });

  it("fails network and egress closed when Sandbox identities disagree", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "running", "2026-07-19T00:00:00.000Z")
    ]);
    fixture.candidates.get("candidate-a")!.runtime.sandbox!.sandbox_id =
      "sandbox-from-another-runtime";

    const detail = await fixture.service.readSystemDetail("candidate-a");

    expect(detail?.isolation).toMatchObject({
      isolation_id: "sandbox-from-another-runtime",
      network_policy_status: "failed",
      egress_attestation_status: "failed"
    });
  });

  it("does not invent an isolation identity from a runtime reference", async () => {
    const fixture = arenaFixture([
      system("candidate-a", "starting", "2026-07-19T00:00:00.000Z")
    ]);
    fixture.candidates.get("candidate-a")!.runtime.sandbox = undefined;

    const detail = await fixture.service.readSystemDetail("candidate-a");

    expect(detail?.isolation).toEqual({
      sandbox_status: "starting",
      network_policy_status: "not_required",
      egress_attestation_status: "not_required",
      authority_status: "not_live"
    });
  });
});

function arenaFixture(systems: ArenaPaperRuntimeSystem[]) {
  const candidates = new Map(systems.map((entry) => [
    entry.candidate_ref.id,
    candidate(entry.candidate_ref.id)
  ]));
  const evaluations = new Map<string, PaperTradingEvaluationRecord>();
  const commitments = new Map<string, PaperTradingEvaluationCommitmentRecord>();
  const observations = new Map<string, PaperTradingObservationRecord[]>();
  const conformances = new Map(systems.map((entry) => [
    entry.paper_trading_handoff_conformance_ref.id,
    conformance(entry.candidate_ref.id)
  ]));
  const snapshot: ArenaPaperRuntimeSnapshot = {
    runtime_kind: "arena_paper_runtime",
    capacity: 2,
    eligible_count: systems.length,
    occupied_count: systems.filter((entry) => entry.active).length,
    available_capacity: 0,
    queued_count: 0,
    starting_count: 0,
    running_count: systems.filter((entry) => entry.lifecycle_status === "running").length,
    recovering_count: systems.filter((entry) => entry.lifecycle_status === "recovering").length,
    stopped_count: 0,
    failed_count: systems.filter((entry) => entry.lifecycle_status === "failed").length,
    invalidated_count: 0,
    startable_count: 0,
    needs_reconcile: false,
    systems,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    private_read_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
  };
  const store = {
    getCandidate: async (candidateId: string) => candidates.get(candidateId),
    getPaperTradingEvaluation: async (evaluationId: string) => evaluations.get(evaluationId),
    getPaperTradingEvaluationCommitment: async (commitmentId: string) => commitments.get(commitmentId),
    listPaperTradingObservations: async (evaluationId: string) => observations.get(evaluationId) ?? [],
    getPaperTradingHandoffConformance: async (conformanceId: string) => conformances.get(conformanceId)
  };
  const service = new ArenaOperationsProjectionService({
    store: store as never,
    arenaPaperRuntime: { snapshot: async () => snapshot }
  });

  return {
    service,
    candidates,
    conformances,
    snapshot,
    addPaper(candidateId: string, input: {
      observations: PaperTradingObservationRecord[];
      policySuffix?: string;
      evaluationStatus?: PaperTradingEvaluationRecord["status"];
      failureReason?: string;
    }) {
      const commitment = commitmentFor(candidateId, input.policySuffix);
      commitments.set(commitment.paper_trading_evaluation_commitment_id, commitment);
      const evaluation = evaluationFor(candidateId, commitment, input.observations, {
        status: input.evaluationStatus,
        failureReason: input.failureReason
      });
      evaluations.set(evaluation.paper_trading_evaluation_id, evaluation);
      observations.set(evaluation.paper_trading_evaluation_id, input.observations);
    }
  };
}

function system(
  candidateId: string,
  lifecycle: ArenaPaperRuntimeSystem["lifecycle_status"],
  admittedAt: string,
  failureReason?: string
): ArenaPaperRuntimeSystem {
  return {
    candidate_ref: { record_kind: "trading_system_candidate", id: candidateId },
    candidate_version_ref: { record_kind: "candidate_version", id: `version-${candidateId}` },
    system_code_ref: { record_kind: "system_code", id: `system-code-${candidateId}` },
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `admission-${candidateId}`
    },
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: `conformance-${candidateId}`
    },
    trading_run_ref: { record_kind: "trading_run", id: `run-${candidateId}` },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `evaluation-${candidateId}`
    },
    sandbox_ref: { record_kind: "sandbox", id: `sandbox-${candidateId}` },
    workspace_key: workspaceDigest(candidateId),
    sandbox_generation: 1,
    admission_decided_at: admittedAt,
    lifecycle_status: lifecycle,
    active: lifecycle === "running" || lifecycle === "recovering",
    failure_reason: failureReason,
    authority_status: "not_live"
  };
}

function candidate(candidateId: string): CandidateInspectReadModel {
  return {
    candidate_id: candidateId,
    display_name: `System ${candidateId.slice(-1).toUpperCase()}`,
    status: "materialized",
    active_version_id: `version-${candidateId}`,
    fixture_notice: { is_fixture: false, message: "generated" },
    system_code: {
      ref: { record_kind: "system_code", id: `system-code-${candidateId}` },
      summary: `${candidateId} strategy`,
      declared_runtime: "python",
      declared_outputs: ["order_request"]
    },
    candidate_version: {
      candidate_version_id: `version-${candidateId}`,
      version_label: "v1",
      provenance_refs: [{ record_kind: "research_finding", id: `finding-${candidateId}` }]
    },
    program: {
      manifest: {
        ref: { record_kind: "manifest", id: `manifest-${candidateId}` },
        declared_runtime: "python",
        declared_outputs: ["order_request"]
      }
    },
    capability_package: {
      manifest: {
        ref: { record_kind: "capability_manifest", id: `capability-${candidateId}` },
        allowed_stages: ["paper"],
        declared_permissions: ["public_market_data"],
        forbidden_contents: ["credentials"]
      }
    },
    runtime: {
      ref: { record_kind: "trading_run", id: `run-${candidateId}` },
      sandbox: {
        sandbox_id: `sandbox-${candidateId}`,
        adapter_kind: "deterministic_test",
        system_code_ref: { record_kind: "system_code", id: `system-code-${candidateId}` },
        sandbox_placement_ref: { record_kind: "sandbox_placement", id: `placement-${candidateId}` },
        lifecycle_status: candidateId === "candidate-d" ? "failed" : "running",
        sandbox_name: `ouro-${candidateId}`,
        workspace_key: workspaceDigest(candidateId),
        created_at: "2026-07-19T00:00:00.000Z",
        started_at: "2026-07-19T00:00:01.000Z",
        log_refs: [{ record_kind: "sandbox_log", id: `log-${candidateId}` }],
        heartbeat_refs: [],
        command_evidence_refs: [],
        logs: [{
          log_ref: { record_kind: "sandbox_log", id: `log-${candidateId}` },
          lines: [
            JSON.stringify({
              level: "info",
              event: "paper_tick",
              status: "ok",
              sequence: 1
            }),
            `/Users/private-user/work/${candidateId}.py ${candidateId} secret`
          ],
          captured_at: "2026-07-19T00:01:05.000Z",
          authority_status: "trace_only"
        }],
        heartbeats: [],
        command_evidence: [],
        authority_status: "not_live"
      },
      transcript: {
        transcript_kind: "trading_run_transcript",
        has_activity: true,
        item_count: 2,
        latest_item: null,
        items: [{
          item_id: `recovery-${candidateId}`,
          item_kind: "run_control_audit",
          occurred_at: "2026-07-19T00:01:02.000Z",
          label: "Restart recovery",
          summary: `Recovered ${candidateId}`,
          authority_status: "not_live"
        }, {
          item_id: `gateway-${candidateId}`,
          item_kind: "gateway_result",
          occurred_at: "2026-07-19T00:01:03.000Z",
          label: "Gateway result",
          summary: `${candidateId} gateway accepted`,
          ref: { record_kind: "gateway_result", id: `gateway-${candidateId}` },
          authority_status: "not_live"
        }],
        authority_status: "not_live",
        no_authority: {
          live_exchange_authority: false,
          private_read_authority: false,
          order_submission_authority: false,
          credentials: false
        }
      }
    },
    full_cycle_lineage: {
      handoff_status: "runnable",
      source: {
        trading_system_id: `source-${candidateId}`,
        candidate_version_id: `source-version-${candidateId}`
      },
      materialized: {
        trading_system_id: candidateId,
        candidate_version_id: `version-${candidateId}`,
        system_code_ref: { record_kind: "system_code", id: `system-code-${candidateId}` }
      },
      evidence: {
        evaluation_status: "accepted",
        evaluation_score: 1,
        direction_kind: "trend_following",
        trading_run_id: `run-${candidateId}`,
        gateway_result_outcome: "accepted",
        ledger_chain_complete: true
      }
    }
  } as unknown as CandidateInspectReadModel;
}

function commitmentFor(
  candidateId: string,
  policySuffix = "shared"
): PaperTradingEvaluationCommitmentRecord {
  const commitment: PaperTradingEvaluationCommitmentRecord = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: `commitment-${candidateId}`,
    evidence_purpose: "research_feedback",
    candidate_ref: { record_kind: "trading_system_candidate", id: candidateId },
    candidate_version_ref: { record_kind: "candidate_version", id: `version-${candidateId}` },
    trading_run_ref: { record_kind: "trading_run", id: `run-${candidateId}` },
    system_code_ref: { record_kind: "system_code", id: `system-code-${candidateId}` },
    system_code_artifact_digest: `sha256:${"1".repeat(64)}`,
    resolved_artifact_digest: `sha256:${"1".repeat(64)}`,
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["main.py"]
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: { record_kind: "capability_policy", id: "paper-v1" },
    secret_policy_ref: { record_kind: "secret_policy", id: "none-v1" },
    policy_identity: {
      market_data_policy_version: "market-v1",
      gateway_policy_version: "gateway-v1",
      cost_policy_version: `cost-${policySuffix}`,
      funding_policy_version: "funding-v1",
      slippage_policy_version: "slippage-v1",
      fill_policy_version: "fill-v1",
      risk_policy_version: "risk-v1",
      paper_account_policy_version: "account-v1",
      decision_event_protocol_version: "decision-v1",
      persistent_state_boundary_version: "state-v1"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: `sha256:${"2".repeat(64)}`,
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "closed_observation",
      eligibility_policy_version: "paper-evidence-eligibility-v1"
    },
    initial_account_snapshot: {
      wallet_balance_usdt: "10000",
      available_balance_usdt: "10000",
      equity_usdt: "10000",
      realized_pnl_usdt: "0",
      unrealized_pnl_usdt: "0",
      fee_paid_usdt: "0",
      slippage_paid_usdt: "0",
      funding_paid_usdt: "0",
      margin_reserved_usdt: "0",
      position: {
        symbol: "BTCUSDT",
        side: "flat",
        quantity: "0",
        mark_price: "0",
        notional_usdt: "0"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
    committed_at: "2026-07-19T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
  commitment.commitment_digest = paperTradingEvaluationCommitmentDigest(commitment);
  return commitment;
}

function evaluationFor(
  candidateId: string,
  commitment: PaperTradingEvaluationCommitmentRecord,
  entries: PaperTradingObservationRecord[],
  options: {
    status?: PaperTradingEvaluationRecord["status"];
    failureReason?: string;
  }
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: `evaluation-${candidateId}`,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: options.status ?? "running",
    interval_ms: 60_000,
    observation_count: entries.length,
    started_at: "2026-07-19T00:00:30.000Z",
    last_observed_at: entries.at(-1)?.observed_at,
    next_observation_at: options.status === "failed" ? undefined : "2026-07-19T00:05:00.000Z",
    latest_score: entries.at(-1)?.cumulative_score ?? zeroScore(),
    latest_failure_reason: options.failureReason,
    authority_status: "not_live"
  };
}

function observation(
  candidateId: string,
  sequence: number,
  observedAt: string,
  netRevenue: number
): PaperTradingObservationRecord {
  return {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `observation-${candidateId}-${sequence}`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `evaluation-${candidateId}`
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `commitment-${candidateId}`
    },
    candidate_ref: { record_kind: "trading_system_candidate", id: candidateId },
    candidate_version_ref: { record_kind: "candidate_version", id: `version-${candidateId}` },
    trading_run_ref: { record_kind: "trading_run", id: `run-${candidateId}` },
    sequence,
    status: "recorded",
    observed_at: observedAt,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000 + sequence,
      observed_at: observedAt,
      source_kind: "binance_production_public_rest",
      authority_status: "read_only"
    },
    decision: {
      decision_kind: "hold",
      source_kind: "trading_system_decision",
      reason: `${candidateId} waits`,
      observed_at: observedAt,
      authority_status: "trace_only"
    },
    score_delta: score(netRevenue),
    cumulative_score: score(netRevenue),
    authority_status: "not_live"
  };
}

function score(netRevenue: number) {
  return {
    revenue_usdt: netRevenue + 1,
    cost_usdt: 1,
    net_revenue_usdt: netRevenue,
    net_return_pct: netRevenue / 100
  };
}

function zeroScore() {
  return score(0);
}

function conformance(candidateId: string): PaperTradingHandoffConformanceRecord {
  return {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: `conformance-${candidateId}`,
    system_code_ref: { record_kind: "system_code", id: `system-code-${candidateId}` },
    system_code_artifact_digest: `sha256:${"1".repeat(64)}`,
    experiment_run_ref: { record_kind: "experiment_run", id: `experiment-${candidateId}` },
    trading_evaluation_task_ref: { record_kind: "trading_evaluation_task", id: `task-${candidateId}` },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    status: "passed",
    reason: "passed",
    provider_request_count: 0,
    heartbeat_count: 1,
    runtime_stopped: true,
    started_at: "2026-07-19T00:00:00.000Z",
    completed_at: "2026-07-19T00:00:01.000Z",
    evidence_digest: `sha256:${"3".repeat(64)}`,
    research_preflight_authority: true,
    runnable_paper_handoff: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function workspaceDigest(candidateId: string): string {
  const suffix = candidateId.at(-1);
  const digit = suffix && /^[a-f0-9]$/.test(suffix) ? suffix : "0";
  return `sha256:${digit.repeat(64)}`;
}
