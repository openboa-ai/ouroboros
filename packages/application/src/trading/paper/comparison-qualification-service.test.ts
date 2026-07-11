import type {
  CandidateInspectReadModel,
  LedgerReadModel,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
  Ref
} from "@ouroboros/domain";
import { describe, expect, it } from "vitest";
import type { OuroborosStorePort } from "../../ports/store";
import { paperTradingEvaluationCommitmentDigest } from "./commitment";
import { PaperTradingComparisonQualificationService } from "./comparison-qualification-service";
import type {
  PaperTradingComparisonWindowSnapshot,
  PaperTradingComparisonWindowStateReader
} from "./comparison-window-reader";

describe("paired paper comparison qualification service", () => {
  it("rejects malformed IDs before the reader or Store is called", async () => {
    const harness = qualificationHarness();

    await expect(harness.service.assess({
      activationId: " activation-001",
      activationAttemptId: "activation-attempt-001"
    })).rejects.toMatchObject({
      code: "invalid_paper_trading_comparison_qualification_input"
    });
    expect(harness.calls).toEqual([]);
  });

  it("qualifies exact stopped Store evidence through canonical side policy", async () => {
    const harness = qualificationHarness();
    const before = structuredClone(harness.graph);

    const result = await harness.service.assess(validInput());
    const replay = await harness.service.assess(validInput());

    expect(result).toEqual(replay);
    expect(result).toMatchObject({
      comparison_id: "comparison-001",
      activation_id: "activation-001",
      activation_attempt_id: "activation-attempt-001",
      qualification_status: "qualified",
      qualification_reasons: [],
      checkpoint_count: 3,
      champion: { qualification_status: "qualified" },
      challenger: { qualification_status: "qualified" },
      authority_status: "not_verdict"
    });
    expect(harness.calls[0]).toBe("reader.load");
    expect(harness.calls).toContain("store.getCandidateForTradingRun:champion-run");
    expect(harness.calls).toContain("store.getCandidateForTradingRun:challenger-run");
    expect(harness.graph).toEqual(before);
  });

  it("retains the reader cause code when the shared graph gate rejects", async () => {
    const harness = qualificationHarness();
    harness.reader.load = async () => {
      throw Object.assign(new Error("reader rejected"), {
        code: "paper_trading_comparison_window_graph_invalid"
      });
    };

    await expect(harness.service.assess(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_qualification_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_window_graph_invalid"
      }
    });
    expect(harness.calls).toEqual([]);
  });

  it("returns canonical side blockers instead of throwing", async () => {
    const graph = qualificationGraph();
    graph.challenger.commitment.provider_identity.qualification_eligible = false;
    graph.challenger.commitment.commitment_digest =
      paperTradingEvaluationCommitmentDigest(graph.challenger.commitment);
    const harness = qualificationHarness(graph);

    await expect(harness.service.assess(validInput())).resolves.toMatchObject({
      qualification_status: "not_qualified",
      qualification_reasons: ["challenger_not_qualified"],
      challenger: {
        qualification_status: "not_qualification_evidence",
        qualification_reasons: ["provider_identity_not_qualification_eligible"]
      }
    });
  });

  it("requires the exact additional TradingRun projection", async () => {
    const graph = qualificationGraph();
    graph.champion.projection.trading_run!.ref.id = "champion-default-run";
    const harness = qualificationHarness(graph);

    await expect(harness.service.assess(validInput())).resolves.toMatchObject({
      qualification_status: "not_qualified",
      qualification_reasons: ["champion_ledger_lineage_mismatch"]
    });
  });

  it("classifies extra, partial, and hidden exact-run Ledger evidence", async () => {
    const extraGraph = qualificationGraph();
    const extraLedger = extraGraph.champion.projection.ledger!;
    const extraChain = structuredClone(extraLedger.chains[0]!);
    extraChain.chain_id = "champion-extra-order";
    extraChain.order_request.order_request_id = extraChain.chain_id;
    extraChain.gateway_result!.gateway_result_id = "champion-extra-gateway";
    extraChain.gateway_result!.order_request_ref.id = extraChain.chain_id;
    extraChain.execution_result!.execution_result_id = "champion-extra-execution";
    extraChain.execution_result!.order_request_ref.id = extraChain.chain_id;
    extraChain.execution_result!.gateway_result_ref.id =
      extraChain.gateway_result!.gateway_result_id;
    extraLedger.chains.push(extraChain);
    extraLedger.chain_count = 2;
    await expect(qualificationHarness(extraGraph).service.assess(validInput()))
      .resolves.toMatchObject({
        qualification_reasons: ["champion_ledger_lineage_mismatch"]
      });

    const partialGraph = qualificationGraph();
    const partialLedger = partialGraph.champion.projection.ledger!;
    partialLedger.chain_complete = false;
    partialLedger.chains[0]!.chain_complete = false;
    partialLedger.chains[0]!.execution_result = null;
    await expect(qualificationHarness(partialGraph).service.assess(validInput()))
      .resolves.toMatchObject({
        qualification_reasons: ["champion_ledger_incomplete"]
      });

    const hiddenRefGraph = qualificationGraph();
    hiddenRefGraph.checkpointOutcomes[0]!.champion.ledger_chain_refs =
      [];
    await expect(qualificationHarness(hiddenRefGraph).service.assess(validInput()))
      .resolves.toMatchObject({
        qualification_reasons: ["champion_ledger_lineage_mismatch"]
      });
  });

  it("returns paired checkpoint blockers for an incomplete terminal attempt", async () => {
    const graph = qualificationGraph();
    graph.checkpointOutcomes[2] = {
      ...graph.checkpointOutcomes[2],
      outcome_status: "incomplete",
      outcome_reason: "restart_cleanup",
      champion: undefined,
      challenger: undefined
    };
    graph.snapshot.facts.paired_checkpoint_count = 2;
    graph.snapshot.facts.latest_checkpoint_status = "incomplete";
    truncateSideEvidence(graph.champion, 2);
    truncateSideEvidence(graph.challenger, 2);
    const harness = qualificationHarness(graph);

    await expect(harness.service.assess(validInput())).resolves.toMatchObject({
      qualification_status: "not_qualified",
      qualification_reasons: [
        "comparison_checkpoint_incomplete",
        "comparison_minimum_observation_count_not_met",
        "champion_not_qualified",
        "challenger_not_qualified"
      ],
      checkpoint_count: 2
    });
  });

  it("rejects side observation-count drift after reader validation", async () => {
    const graph = qualificationGraph();
    graph.champion.evaluation.observation_count = 2;
    const harness = qualificationHarness(graph);

    await expect(harness.service.assess(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_qualification_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_qualification_graph_inconsistent"
      }
    });
  });

  it("fails closed when Store evidence drifts after reader validation", async () => {
    const graph = qualificationGraph();
    graph.activationAttempt.paper_trading_comparison_commitment_ref.id =
      "comparison-other";
    const harness = qualificationHarness(graph);

    await expect(harness.service.assess(validInput())).rejects.toMatchObject({
      code: "paper_trading_comparison_qualification_graph_invalid",
      details: {
        cause_code: "paper_trading_comparison_qualification_graph_inconsistent"
      }
    });
  });
});

function validInput() {
  return {
    activationId: "activation-001",
    activationAttemptId: "activation-attempt-001"
  };
}

function qualificationHarness(graph = qualificationGraph()) {
  const calls: string[] = [];
  const reader: PaperTradingComparisonWindowStateReader = {
    load: async () => {
      calls.push("reader.load");
      return structuredClone(graph.snapshot);
    }
  };
  const reads: Record<string, (...args: any[]) => Promise<any>> = {
    getPaperTradingComparisonActivation: read("getPaperTradingComparisonActivation", () =>
      graph.activation),
    getPaperTradingComparisonActivationAttempt: read(
      "getPaperTradingComparisonActivationAttempt",
      () => graph.activationAttempt
    ),
    getPaperTradingComparisonCommitment: read("getPaperTradingComparisonCommitment", () =>
      graph.comparison),
    listPaperTradingComparisonActivationOutcomes: read(
      "listPaperTradingComparisonActivationOutcomes",
      () => graph.activationOutcomes
    ),
    listPaperTradingComparisonCheckpointAttempts: read(
      "listPaperTradingComparisonCheckpointAttempts",
      () => graph.checkpointAttempts
    ),
    listPaperTradingComparisonCheckpointOutcomes: read(
      "listPaperTradingComparisonCheckpointOutcomes",
      (attemptId: string) => {
        const index = graph.checkpointAttempts.findIndex((attempt) =>
          attempt.paper_trading_comparison_checkpoint_attempt_id === attemptId);
        return index < 0 ? [] : [graph.checkpointOutcomes[index]];
      }
    ),
    getPaperTradingEvaluationCommitment: read(
      "getPaperTradingEvaluationCommitment",
      (id: string) => sideByCommitmentId(graph, id)?.commitment
    ),
    getPaperTradingEvaluation: read(
      "getPaperTradingEvaluation",
      (id: string) => sideByEvaluationId(graph, id)?.evaluation
    ),
    listPaperTradingObservations: read(
      "listPaperTradingObservations",
      (id: string) => sideByEvaluationId(graph, id)?.observations ?? []
    ),
    getCandidateForTradingRun: read(
      "getCandidateForTradingRun",
      (id: string) => sideByRunId(graph, id)?.projection
    )
  };
  function read(name: string, value: (...args: any[]) => unknown) {
    return async (...args: any[]) => {
      calls.push(`store.${name}${args[0] ? `:${args[0]}` : ""}`);
      return structuredClone(value(...args));
    };
  }
  const store = new Proxy(reads, {
    get(target, property) {
      if (typeof property === "string" && property in target) return target[property];
      return async () => {
        throw new Error(`unexpected Store method: ${String(property)}`);
      };
    }
  }) as unknown as OuroborosStorePort;
  return {
    graph,
    calls,
    reader,
    store,
    service: new PaperTradingComparisonQualificationService({ store, windowReader: reader })
  };
}

function qualificationGraph() {
  const champion = qualificationSide("champion", true);
  const challenger = qualificationSide("challenger", false);
  const comparisonPolicy = {
    policy_version: "paper-comparison-v1",
    comparison_mode: "champion_challenge",
    symbol: "BTCUSDT",
    interval_ms: 60_000,
    minimum_observation_count: 3,
    minimum_elapsed_ms: 120_000,
    maximum_observation_count: 3,
    maximum_elapsed_ms: 300_000,
    maximum_start_skew_ms: 1_000,
    maximum_provider_request_count_per_side: 100,
    maximum_retry_count_per_side: 0,
    primary_metric: "net_revenue_usdt",
    minimum_net_revenue_lift_usdt: 1,
    required_confirmation_count: 2,
    require_non_overlapping_windows: true,
    require_both_qualified: true,
    release_policy: "sealed_until_adjudication"
  } as const;
  const comparison = {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "comparison-001",
    champion: comparisonSide(champion),
    challenger: comparisonSide(challenger),
    comparison_policy: comparisonPolicy,
    commitment_digest: "sha256:comparison",
    authority_status: "not_live"
  } as any;
  const activationSide = (side: ReturnType<typeof qualificationSide>) => ({
    role: side.role,
    trading_run_ref: { record_kind: "trading_run", id: side.runId },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: side.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: side.evaluation.paper_trading_evaluation_id
    }
  });
  const activation = {
    paper_trading_comparison_activation_id: "activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    champion: activationSide(champion),
    challenger: activationSide(challenger),
    activation_digest: "sha256:activation"
  } as any;
  const activationAttempt = {
    paper_trading_comparison_activation_attempt_id: "activation-attempt-001",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_commitment_ref: {
      ...activation.paper_trading_comparison_commitment_ref
    },
    champion: activationSide(champion),
    challenger: activationSide(challenger),
    attempted_at: "2026-07-12T00:00:00.000Z",
    attempt_digest: "sha256:attempt"
  } as any;
  const activationOutcomes = [
    {
      paper_trading_comparison_activation_outcome_id: "activation-outcome-running",
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: activationAttempt.paper_trading_comparison_activation_attempt_id
      },
      outcome_sequence: 1,
      outcome_status: "both_running",
      outcome_reason: "started_within_policy"
    },
    {
      paper_trading_comparison_activation_outcome_id: "activation-outcome-stopped",
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: activationAttempt.paper_trading_comparison_activation_attempt_id
      },
      outcome_sequence: 2,
      outcome_status: "stopped_cleanly",
      outcome_reason: "handoff_cleanup"
    }
  ] as any[];
  const checkpointAttempts = [1, 2, 3].map((sequence) => ({
    paper_trading_comparison_checkpoint_attempt_id: `checkpoint-attempt-${sequence}`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: activationAttempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    checkpoint_sequence: sequence,
    champion: { role: "champion", trading_run_ref: { record_kind: "trading_run", id: champion.runId } },
    challenger: { role: "challenger", trading_run_ref: { record_kind: "trading_run", id: challenger.runId } }
  })) as any[];
  const checkpointOutcomes = checkpointAttempts.map((attempt, index) => ({
    paper_trading_comparison_checkpoint_outcome_id: `checkpoint-outcome-${index + 1}`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_sequence: index + 1,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: {
      role: "champion",
      ledger_chain_refs: index === 0 ? ledgerRefs("champion") : []
    },
    challenger: { role: "challenger", ledger_chain_refs: [] }
  })) as any[];
  const snapshot: PaperTradingComparisonWindowSnapshot = {
    facts: {
      owned: false,
      now: "2026-07-12T00:03:00.000Z",
      activation_attempted_at: "2026-07-12T00:00:00.000Z",
      interval_ms: 60_000,
      maximum_observation_count: 3,
      maximum_elapsed_ms: 300_000,
      tick_count: 3,
      latest_tick_observed_at: "2026-07-12T00:02:00.000Z",
      checkpoint_attempt_count: 3,
      paired_checkpoint_count: 3,
      latest_checkpoint_status: "paired",
      latest_checkpoint_has_failed_side: false,
      latest_tick_acknowledged_roles: ["champion", "challenger"],
      activation_status: "stopped_cleanly"
    },
    latest_tick_id: "tick-3",
    latest_checkpoint_attempt_id: "checkpoint-attempt-3"
  };
  return {
    champion,
    challenger,
    comparison,
    activation,
    activationAttempt,
    activationOutcomes,
    checkpointAttempts,
    checkpointOutcomes,
    snapshot
  };
}

function qualificationSide(role: "champion" | "challenger", withLedger: boolean) {
  const runId = `${role}-run`;
  const commitment = evaluationCommitment(role, runId);
  const observations = [1, 2, 3].map((sequence) => evaluationObservation(
    role,
    runId,
    commitment,
    sequence
  ));
  const evaluation = evaluationRecord(role, runId, commitment, observations);
  const projection = {
    trading_run: {
      ref: { record_kind: "trading_run", id: runId },
      stage: "paper",
      lifecycle_status: "stopped",
      authority_status: "not_live"
    },
    ledger: withLedger ? completeLedger(role) : emptyLedger()
  } as unknown as CandidateInspectReadModel;
  return { role, runId, commitment, evaluation, observations, projection };
}

function evaluationCommitment(
  role: "champion" | "challenger",
  runId: string
): PaperTradingEvaluationCommitmentRecord {
  const draft = {
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: `${role}-evaluation-commitment`,
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: `${role}-candidate` },
    candidate_version_ref: { record_kind: "candidate_version", id: `${role}-version` },
    trading_run_ref: { record_kind: "trading_run", id: runId },
    system_code_ref: { record_kind: "system_code", id: `${role}-code` },
    system_code_artifact_digest: `sha256:${role}-code`,
    resolved_artifact_digest: `sha256:${role}-resolved`,
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "run.py"]
    },
    provider_identity: { runtime_provider_kind: "none", qualification_eligible: true },
    capability_policy_ref: { record_kind: "capability_policy", id: "policy" },
    secret_policy_ref: { record_kind: "secret_policy", id: "policy" },
    policy_identity: {
      market_data_policy_version: "market",
      gateway_policy_version: "gateway",
      cost_policy_version: "cost",
      funding_policy_version: "funding",
      slippage_policy_version: "slippage",
      fill_policy_version: "fill",
      risk_policy_version: "risk",
      paper_account_policy_version: "account",
      decision_event_protocol_version: "decision",
      persistent_state_boundary_version: "state"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_rest",
      market_data_configuration_digest: "sha256:market",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "sealed_until_adjudication",
      eligibility_policy_version: "v1"
    },
    initial_account_snapshot: accountSnapshot(),
    committed_at: "2026-07-12T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  } as PaperTradingEvaluationCommitmentRecord;
  return {
    ...draft,
    commitment_digest: paperTradingEvaluationCommitmentDigest(draft)
  };
}

function evaluationRecord(
  role: "champion" | "challenger",
  runId: string,
  commitment: PaperTradingEvaluationCommitmentRecord,
  observations: PaperTradingObservationRecord[]
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: `${role}-evaluation`,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { record_kind: "trading_run", id: runId },
    paper_trading_evaluation_commitment_ref: {
      record_kind: commitment.record_kind,
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "stopped",
    interval_ms: 60_000,
    observation_count: observations.length,
    started_at: "2026-07-12T00:00:00.000Z",
    last_observed_at: observations.at(-1)!.observed_at,
    stopped_at: "2026-07-12T00:03:00.000Z",
    latest_score: zeroScore(),
    paper_account_snapshot: accountSnapshot(),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  } as PaperTradingEvaluationRecord;
}

function evaluationObservation(
  role: "champion" | "challenger",
  runId: string,
  commitment: PaperTradingEvaluationCommitmentRecord,
  sequence: number
): PaperTradingObservationRecord {
  const observedAt = new Date(Date.parse("2026-07-12T00:00:00.000Z") +
    (sequence - 1) * 60_000).toISOString();
  return {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `${role}-observation-${sequence}`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `${role}-evaluation`
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: commitment.record_kind,
      id: commitment.paper_trading_evaluation_commitment_id
    },
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { record_kind: "trading_run", id: runId },
    sequence,
    status: "no_order",
    observed_at: observedAt,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      observed_at: observedAt,
      source_kind: "binance_production_public_rest",
      authority_status: "read_only"
    },
    paper_account_snapshot: accountSnapshot(),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    score_delta: zeroScore(),
    cumulative_score: zeroScore(),
    authority_status: "not_live"
  };
}

function comparisonSide(side: ReturnType<typeof qualificationSide>) {
  return {
    role: side.role,
    candidate_ref: { ...side.commitment.candidate_ref },
    candidate_version_ref: { ...side.commitment.candidate_version_ref },
    system_code_ref: { ...side.commitment.system_code_ref },
    trading_run_ref: { record_kind: "trading_run", id: side.runId },
    paper_trading_evaluation_commitment_ref: {
      record_kind: side.commitment.record_kind,
      id: side.commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_ref: {
      record_kind: side.evaluation.record_kind,
      id: side.evaluation.paper_trading_evaluation_id
    }
  };
}

function sideByCommitmentId(graph: ReturnType<typeof qualificationGraph>, id: string) {
  return [graph.champion, graph.challenger].find((side) =>
    side.commitment.paper_trading_evaluation_commitment_id === id);
}

function sideByEvaluationId(graph: ReturnType<typeof qualificationGraph>, id: string) {
  return [graph.champion, graph.challenger].find((side) =>
    side.evaluation.paper_trading_evaluation_id === id);
}

function sideByRunId(graph: ReturnType<typeof qualificationGraph>, id: string) {
  return [graph.champion, graph.challenger].find((side) => side.runId === id);
}

function truncateSideEvidence(
  side: ReturnType<typeof qualificationSide>,
  count: number
): void {
  side.observations = side.observations.slice(0, count);
  side.evaluation.observation_count = count;
  side.evaluation.last_observed_at = side.observations.at(-1)?.observed_at;
}

function ledgerRefs(prefix: string): Ref[] {
  return [{ record_kind: "ledger_chain", id: `${prefix}-order` }];
}

function emptyLedger(): LedgerReadModel {
  return {
    ledger_kind: "ledger",
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: placeholder("order_request", "Order request"),
    gateway_result: placeholder("gateway_result", "Gateway result"),
    execution_result: placeholder("execution_result", "Execution result"),
    authority_status: "not_live",
    no_authority: {
      live_exchange_authority: false,
      private_read_authority: false,
      order_submission_authority: false,
      credentials: false
    },
    source_record_kinds: ["order_request", "gateway_result", "execution_result"]
  };
}

function completeLedger(prefix: string): LedgerReadModel {
  const ledger = emptyLedger();
  const order = {
    order_request_id: `${prefix}-order`,
    intent_kind: "place_order" as const,
    market_scope: "external_trading_api_fixture" as const,
    side: "buy" as const,
    order_type: "market" as const,
    quantity: "0.001",
    status: "proposed" as const,
    created_at: "2026-07-12T00:01:00.000Z",
    authority_status: "not_submitted" as const
  };
  const gateway = {
    gateway_result_id: `${prefix}-gateway`,
    order_request_ref: { record_kind: "order_request", id: order.order_request_id },
    decision_outcome: "dry_run_only" as const,
    decision_reason: "paper_stage_only" as const,
    decided_at: "2026-07-12T00:01:00.001Z",
    authority_status: "dry_run_only" as const
  };
  const execution = {
    execution_result_id: `${prefix}-execution`,
    order_request_ref: { record_kind: "order_request", id: order.order_request_id },
    gateway_result_ref: { record_kind: "gateway_result", id: gateway.gateway_result_id },
    stage: "paper" as const,
    execution_mode: "host_local" as const,
    venue_scope: "external_trading_api_fixture" as const,
    status: "dry_run_recorded" as const,
    result_reason: "paper_stage_only" as const,
    created_at: "2026-07-12T00:01:00.002Z",
    completed_at: "2026-07-12T00:01:00.003Z",
    authority_status: "dry_run_only" as const
  };
  return {
    ...ledger,
    has_activity: true,
    chain_complete: true,
    chain_count: 1,
    chains: [{
      chain_id: order.order_request_id,
      chain_complete: true,
      occurred_at: order.created_at,
      order_request: order,
      gateway_result: gateway,
      execution_result: execution,
      authority_status: "not_live"
    }],
    latest_order_request: order,
    latest_gateway_result: gateway,
    latest_execution_result: execution
  };
}

function placeholder(recordKind: string, label: string) {
  return {
    status: "missing",
    ref: { record_kind: recordKind, id: "missing" },
    label,
    authority_status: "not_live"
  } as const;
}

function accountSnapshot() {
  return {
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
      symbol: "BTCUSDT" as const,
      quantity: "0",
      side: "flat" as const,
      mark_price: "0",
      notional_usdt: "0"
    },
    open_order_count: 0,
    authority_status: "not_live" as const
  };
}

function zeroScore() {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
}
