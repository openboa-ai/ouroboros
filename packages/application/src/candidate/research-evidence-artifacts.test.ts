import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  type ArenaOperationsReadModel,
  type ArenaTradingSystemDetailReadModel,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type ResearchFindingRecord
} from "@ouroboros/domain";
import { ResearchEvidenceArtifactService } from "./research-evidence-artifacts";

describe("ResearchEvidenceArtifactService", () => {
  it("freezes bounded sanitized Arena and finding evidence with stable identity", async () => {
    const operations = arenaOperations();
    const detail = arenaDetail(operations.systems[0]!);
    const finding = researchFinding();
    const commitment = paperCommitment();
    const observations = paperObservations(commitment);
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [finding],
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getPaperTradingEvaluation: async () => ({
          ...paperEvaluation(commitment, observations),
          latest_failure_reason:
            "/Users/private-owner/run token=secret-value"
        }),
        getTradingRun: async (tradingRunId) => ({
          record_kind: "trading_run",
          version: 1,
          trading_run_id: tradingRunId,
          stage_binding_profile: "paper",
          candidate_ref: {
            record_kind: "trading_system_candidate",
            id: "candidate-a"
          },
          placement_ref: { record_kind: "sandbox_placement", id: "place-a" },
          hands_environment_ref: {
            record_kind: "hands_environment",
            id: "hands-a"
          },
          memory_surface_ref: {
            record_kind: "runtime_memory_surface",
            id: "memory-a"
          },
          created_at: "2026-07-22T00:01:00.000Z",
          authority_status: "not_live"
        })
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async (candidateId) =>
          candidateId === "candidate-a" ? detail : undefined
      }
    });

    const first = await service.collect();
    const second = await service.collect();

    expect(first.map((artifact) => artifact.source_kind).sort()).toEqual([
      "arena_failure",
      "arena_paper_result",
      "arena_trace",
      "research_finding"
    ]);
    expect(second).toEqual(first);
    expect(first.every((artifact) =>
      artifact.artifact_digest.startsWith("sha256:") &&
      artifact.source_digest.startsWith("sha256:") &&
      artifact.sanitization_status === "sanitized" &&
      artifact.qualification_evidence_hidden === true &&
      artifact.secrets_removed === true &&
      artifact.host_paths_removed === true &&
      artifact.authority_status === "research_only"
    )).toBe(true);
    expect(first.map((artifact) => artifact.summary).join("\n"))
      .not.toMatch(/private-owner|secret-value|\/Users\//);
    expect(first.find((artifact) =>
      artifact.source_kind === "research_finding"
    )?.source_digest).toBe(exactDigest(finding));
    expect(first.find((artifact) =>
      artifact.source_kind === "arena_trace"
    )).toMatchObject({
      subject_ref: {
        record_kind: "trading_system_candidate",
        id: "candidate-a"
      },
      artifact_ref: {
        record_kind: "paper_trading_observation",
        id: "observation-a-1"
      },
      supporting_record_refs: expect.arrayContaining([{
        record_kind: "trading_run",
        id: "trading-run-a"
      }])
    });
  });

  it("creates immutable trace captures for consecutive observations", async () => {
    const operations = arenaOperations();
    const detail = arenaDetail(operations.systems[0]!);
    const commitment = paperCommitment();
    const observations = [paperObservation("observation-a-1", 1, commitment)];
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () =>
          paperEvaluation(commitment, observations),
        getTradingRun: async (tradingRunId) => ({
          record_kind: "trading_run",
          version: 1,
          trading_run_id: tradingRunId,
          stage_binding_profile: "paper",
          candidate_ref: {
            record_kind: "trading_system_candidate",
            id: "candidate-a"
          },
          placement_ref: { record_kind: "sandbox_placement", id: "place-a" },
          hands_environment_ref: {
            record_kind: "hands_environment",
            id: "hands-a"
          },
          memory_surface_ref: {
            record_kind: "runtime_memory_surface",
            id: "memory-a"
          },
          created_at: "2026-07-22T00:01:00.000Z",
          authority_status: "not_live"
        }),
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => detail
      }
    });

    const first = (await service.collect()).filter((artifact) =>
      artifact.source_kind === "arena_trace"
    );
    observations.push(paperObservation("observation-a-2", 2, commitment));
    detail.trace_events.push({
      sequence: 2,
      occurred_at: "2026-07-22T00:09:00.000Z",
      event_kind: "trading_system_decision",
      summary: "no_order password=second-secret",
      sanitized: true,
      record_ref: {
        record_kind: "paper_trading_observation",
        id: "observation-a-2"
      },
      authority_status: "read_only"
    });
    const second = (await service.collect()).filter((artifact) =>
      artifact.source_kind === "arena_trace"
    );

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(new Set(second.map((artifact) =>
      artifact.research_evidence_artifact_id
    )).size).toBe(2);
    expect(second.map((artifact) => artifact.summary).join("\n"))
      .not.toContain("second-secret");
  });

  it("uses the latest evaluation result when ranking projects an older boundary", async () => {
    const operations = arenaOperations();
    Object.assign(operations.systems[0]!, {
      profit_loss: {
        revenue_usdt: 9,
        cost_usdt: 2,
        net_revenue_usdt: 7,
        net_return_pct: 0.07
      },
      observation_count: 6,
      last_observed_at: "2026-07-22T00:06:00.000Z",
      comparison_sequence: 6,
      comparison_cutoff_at: "2026-07-22T00:06:00.000Z"
    });
    const commitment = paperCommitment();
    const observations = paperObservations(commitment);
    const evaluation = paperEvaluation(commitment, observations);
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async () => undefined
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => undefined
      }
    });

    const result = (await service.collect()).find((artifact) =>
      artifact.source_kind === "arena_paper_result"
    );

    expect(result).toMatchObject({
      artifact_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      source_digest: exactDigest(evaluation),
      captured_at: evaluation.last_observed_at
    });
    expect(result?.summary).toContain("net 12 USDT");
    expect(result?.summary).toContain("observations 8");
  });

  it("uses the latest evaluation failure when the projection is behind", async () => {
    const operations = arenaOperations();
    delete operations.systems[0]!.latest_failure;
    const commitment = paperCommitment();
    const observations = paperObservations(commitment);
    const evaluation = {
      ...paperEvaluation(commitment, observations),
      latest_failure_reason: "candidate process exited during observation"
    };
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async () => undefined
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => undefined
      }
    });

    const failure = (await service.collect()).find((artifact) =>
      artifact.source_kind === "arena_failure"
    );

    expect(failure).toMatchObject({
      source_digest: exactDigest(evaluation),
      captured_at: evaluation.last_observed_at
    });
    expect(failure?.summary).toContain("status running");
    expect(failure?.summary).not.toContain("candidate process exited");
  });

  it("captures paper evidence at the latest evaluation state timestamp", async () => {
    const operations = arenaOperations();
    const commitment = paperCommitment();
    const observations = paperObservations(commitment);
    const evaluation = {
      ...paperEvaluation(commitment, observations),
      status: "stopped" as const,
      stopped_at: "2026-07-22T00:16:00.000Z",
      latest_failure_reason: "candidate process stopped after observation"
    };
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async () => undefined
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => undefined
      }
    });

    const paperEvidence = (await service.collect()).filter((artifact) =>
      artifact.source_kind === "arena_paper_result" ||
      artifact.source_kind === "arena_failure"
    );

    expect(paperEvidence).toHaveLength(2);
    expect(paperEvidence.every((artifact) =>
      artifact.captured_at === evaluation.stopped_at
    )).toBe(true);
  });

  it("does not emit a paper result before the first closed observation", async () => {
    const operations = arenaOperations();
    const commitment = paperCommitment();
    const observations: PaperTradingObservationRecord[] = [];
    const evaluation = {
      ...paperEvaluation(commitment, observations),
      status: "not_started" as const,
      last_observed_at: undefined
    };
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async () => undefined
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => undefined
      }
    });

    expect((await service.collect()).filter((artifact) =>
      artifact.source_kind === "arena_paper_result"
    )).toEqual([]);
  });

  it("omits invalidated paper results, failures, and traces", async () => {
    const operations = arenaOperations();
    operations.systems[0]!.session_status = "invalidated";
    operations.systems[0]!.comparability_status = "ineligible";
    operations.systems[0]!.unranked_reasons = [
      "paper_evaluation_invalidated"
    ];
    const detail = arenaDetail(operations.systems[0]!);
    const commitment = paperCommitment();
    const observations = [paperObservation("observation-a-1", 1, commitment)];
    const evaluation = {
      ...paperEvaluation(commitment, observations),
      status: "invalidated" as const,
      invalidation_reason: "commitment_digest_mismatch" as const,
      latest_failure_reason: "integrity verification failed"
    };
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async (tradingRunId) => ({
          record_kind: "trading_run",
          version: 1,
          trading_run_id: tradingRunId,
          stage_binding_profile: "paper",
          candidate_ref: {
            record_kind: "trading_system_candidate",
            id: "candidate-a"
          },
          placement_ref: { record_kind: "sandbox_placement", id: "place-a" },
          hands_environment_ref: {
            record_kind: "hands_environment",
            id: "hands-a"
          },
          memory_surface_ref: {
            record_kind: "runtime_memory_surface",
            id: "memory-a"
          },
          created_at: "2026-07-22T00:01:00.000Z",
          authority_status: "not_live"
        })
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => detail
      }
    });

    expect(await service.collect()).toEqual([]);
  });

  it("omits paper evidence whose observation and accounting graph fails integrity", async () => {
    const operations = arenaOperations();
    operations.systems[0]!.comparability_status = "ineligible";
    operations.systems[0]!.unranked_reasons = [
      "comparison_evidence_incomplete"
    ];
    const detail = arenaDetail(operations.systems[0]!);
    const commitment = paperCommitment();
    const observations = [paperObservation(
      "observation-a-1",
      1,
      commitment
    )];
    const evaluation = {
      ...paperEvaluation(commitment, observations),
      observation_count: 2
    };
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () => evaluation,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations,
        getTradingRun: async (tradingRunId) => ({
          record_kind: "trading_run",
          version: 1,
          trading_run_id: tradingRunId,
          stage_binding_profile: "paper",
          candidate_ref: {
            record_kind: "trading_system_candidate",
            id: "candidate-a"
          },
          placement_ref: { record_kind: "sandbox_placement", id: "place-a" },
          hands_environment_ref: {
            record_kind: "hands_environment",
            id: "hands-a"
          },
          memory_surface_ref: {
            record_kind: "runtime_memory_surface",
            id: "memory-a"
          },
          created_at: "2026-07-22T00:01:00.000Z",
          authority_status: "not_live"
        })
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => detail
      }
    });

    expect(await service.collect()).toEqual([]);
  });

  it("does not collect sealed qualification evidence", async () => {
    const operations = arenaOperations();
    const detail = arenaDetail(operations.systems[0]!);
    const commitment = paperCommitment("qualification");
    const observations = [paperObservation(
      "observation-a-1",
      1,
      commitment
    )];
    const service = new ResearchEvidenceArtifactService({
      store: {
        listResearchFindings: async () => [],
        getPaperTradingEvaluation: async () =>
          paperEvaluation(commitment, observations),
        getTradingRun: async () => undefined,
        getPaperTradingEvaluationCommitment: async () => commitment,
        listPaperTradingObservations: async () => observations
      },
      arenaOperations: {
        readOperations: async () => operations,
        readSystemDetail: async () => detail
      }
    });

    expect(await service.collect()).toEqual([]);
  });
});

function arenaOperations(): ArenaOperationsReadModel {
  return {
    projection_kind: "arena_operations",
    loop_status: "running",
    capacity: {
      max_concurrent_sessions: 4,
      active_session_count: 1,
      queued_session_count: 0
    },
    systems: [{
      candidate_id: "candidate-a",
      candidate_version_id: "candidate-version-a",
      system_code_ref: {
        record_kind: "system_code",
        id: "system-code-a"
      },
      display_name: "Candidate A",
      direction_kind: "trend_following",
      runner_status: "active",
      sandbox_status: "running",
      evaluation_id: "paper-evaluation-a",
      trading_run_id: "trading-run-a",
      profit_loss: {
        revenue_usdt: 14,
        cost_usdt: 2,
        net_revenue_usdt: 12,
        net_return_pct: 0.12
      },
      observation_count: 8,
      failed_observation_count: 1,
      queued_at: "2026-07-22T00:00:00.000Z",
      started_at: "2026-07-22T00:01:00.000Z",
      last_observed_at: "2026-07-22T00:08:00.000Z",
      next_observation_at: "2026-07-22T00:09:00.000Z",
      latest_failure: {
        failure_kind: "sandbox_or_runner_failure",
        reason: "[private-path] token=[redacted]",
        summary: "Provider failed at [private-path]",
        next_action: "Inspect API_KEY=[redacted]",
        authority_status: "not_live"
      },
      session_status: "running",
      rank_status: "provisional_ranked",
      rank: 1,
      comparability_status: "comparable",
      unranked_reasons: [],
      comparison_cohort: {
        cohort_id: "cohort-a",
        symbol: "BTCUSDT",
        evidence_purpose: "qualification",
        market_opportunity_policy_digest: digest("market"),
        account_policy_digest: digest("account"),
        cost_policy_digest: digest("cost"),
        risk_policy_digest: digest("risk"),
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
      comparison_sequence: 8,
      comparison_cutoff_at: "2026-07-22T00:08:00.000Z",
      authority_status: "not_live"
    }],
    latest_system_id: "candidate-a",
    live_disabled: true,
    authority_status: "not_live"
  };
}

function arenaDetail(
  summary: ArenaOperationsReadModel["systems"][number]
): ArenaTradingSystemDetailReadModel {
  return {
    ...summary,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: "admission-a"
    },
    paper_trading_handoff_conformance_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: "conformance-a"
    },
    isolation: {
      sandbox_status: "running",
      network_policy_status: "verified",
      egress_attestation_status: "verified",
      authority_status: "not_live"
    },
    trading_system_manifest: {
      summary: "Candidate A",
      declared_outputs: ["order_request"],
      allowed_stages: ["paper"],
      declared_permissions: ["public_market_data"],
      forbidden_contents: ["private_credentials", "live_authority"]
    },
    open_orders: [],
    trace_events: [{
      sequence: 1,
      occurred_at: "2026-07-22T00:08:00.000Z",
      event_kind: "trading_system_decision",
      summary: "Read /Users/private-owner/data token=secret-value then held.",
      sanitized: true,
      record_ref: {
        record_kind: "paper_trading_observation",
        id: "observation-a-1"
      },
      authority_status: "read_only"
    }],
    log_entries: [],
    artifact_refs: [],
    trace_truncated: false,
    logs_truncated: false
  };
}

function researchFinding(): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: "finding-a",
    research_worker_ref: {
      record_kind: "research_worker",
      id: "worker-a"
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "direction-a"
    },
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: "experiment-a"
    },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "result-a"
    },
    finding_kind: "negative_result",
    summary: "Loss at /Users/private-owner/run password=secret-value",
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: "result-a"
    }],
    created_at: "2026-07-22T00:07:00.000Z",
    authority_status: "research_trace_only"
  };
}

function paperCommitment(
  evidencePurpose: PaperTradingEvaluationCommitmentRecord["evidence_purpose"] =
    "research_feedback"
): PaperTradingEvaluationCommitmentRecord {
  const commitment: PaperTradingEvaluationCommitmentRecord = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "paper-commitment-a",
    evidence_purpose: evidencePurpose,
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-a"
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "candidate-version-a"
    },
    trading_run_ref: {
      record_kind: "trading_run",
      id: "trading-run-a"
    },
    system_code_ref: { record_kind: "system_code", id: "system-code-a" },
    system_code_artifact_digest: digest("system-code"),
    resolved_artifact_digest: digest("resolved-code"),
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "run.py"]
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: evidencePurpose === "qualification"
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "paper-only"
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-secrets" },
    policy_identity: {
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
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: digest("market-data"),
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: evidencePurpose === "research_feedback"
        ? "closed_observation"
        : "sealed_until_adjudication",
      eligibility_policy_version: "paper-evidence-v1"
    },
    initial_account_snapshot: structuredClone(
      PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT
    ),
    committed_at: "2026-07-22T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
  commitment.commitment_digest = `sha256:${createHash("sha256")
    .update(paperTradingEvaluationCommitmentDigestInput(commitment))
    .digest("hex")}`;
  return commitment;
}

function paperObservation(
  id: string,
  sequence: number,
  commitment = paperCommitment()
): PaperTradingObservationRecord {
  const observedAt = new Date(Date.UTC(2026, 6, 22, 0, 7 + sequence))
    .toISOString();
  const profitableScore = {
    revenue_usdt: 14,
    cost_usdt: 2,
    net_revenue_usdt: 12,
    net_return_pct: 0.12
  };
  return {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: id,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: "paper-evaluation-a"
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    sequence,
    status: sequence === 1 ? "recorded" : "no_order",
    observed_at: observedAt,
    decision: {
      decision_kind: sequence === 1 ? "order_request" : "no_action",
      source_kind: "trading_system_decision",
      reason: `password=observation-${sequence}-secret`,
      observed_at: observedAt,
      ...(sequence === 1
        ? {
            order_request: {
              intent_kind: "place_order" as const,
              symbol: "BTCUSDT" as const,
              side: "buy" as const,
              order_type: "market" as const,
              quantity: "0.001"
            }
          }
        : {}),
      authority_status: "trace_only"
    },
    score_delta: sequence === 1
      ? { ...profitableScore }
      : {
          revenue_usdt: 0,
          cost_usdt: 0,
          net_revenue_usdt: 0,
          net_return_pct: 0
        },
    cumulative_score: { ...profitableScore },
    ...(sequence === 1
      ? { paper_account_snapshot: profitablePaperAccount() }
      : {}),
    authority_status: "not_live"
  };
}

function paperObservations(
  commitment: PaperTradingEvaluationCommitmentRecord,
  count = 8
): PaperTradingObservationRecord[] {
  return Array.from({ length: count }, (_, index) => paperObservation(
    `observation-a-${index + 1}`,
    index + 1,
    commitment
  ));
}

function paperEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations = paperObservations(commitment)
): PaperTradingEvaluationRecord {
  const ordered = [...observations].sort((left, right) =>
    left.sequence - right.sequence
  );
  const latest = ordered.at(-1);
  const account = [...ordered].reverse().find((observation) =>
    observation.paper_account_snapshot !== undefined
  )?.paper_account_snapshot ?? commitment.initial_account_snapshot;
  const score = latest?.cumulative_score ?? {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-evaluation-a",
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "running",
    interval_ms: 60_000,
    observation_count: ordered.length,
    started_at: "2026-07-22T00:01:00.000Z",
    last_observed_at: latest?.observed_at,
    latest_score: { ...score },
    paper_account_snapshot: structuredClone(account),
    authority_status: "not_live"
  };
}

function profitablePaperAccount() {
  return {
    ...structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
    wallet_balance_usdt: "10012",
    available_balance_usdt: "10012",
    equity_usdt: "10012",
    realized_pnl_usdt: "14",
    fee_paid_usdt: "2"
  };
}

function digest(seed: string): string {
  return `sha256:${seed.padEnd(64, "0").slice(0, 64)}`;
}

function exactDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}
