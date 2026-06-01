import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CandidateArenaRunner } from "@ouroboros/application/candidate/arena";
import { OperatorService } from "@ouroboros/application/services/operator";
import type { CandidateMaterializationInput, OperatorReadModel, PaperTradingEvaluationRecord, PaperTradingObservationRecord, SystemCodeRecord } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-paper-board-"));
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
      sourcePriority: "websocket_primary"
    });
    await seedPaperEvaluation(store, {
      candidate: losing,
      netRevenueUsdt: -3.7,
      netReturnPct: -0.037,
      observationCount: 6,
      status: "stopped",
      runnerActive: false,
      sourcePriority: "rest_fallback"
    });

    const service = new OperatorService({
      store,
      candidateArenaRunner: fakeArenaRunner() as unknown as CandidateArenaRunner,
      paperEvidenceAdapter: {
        run: async () => ({ statusCode: 500, body: { error: "unused" } })
      },
      paperTradingEvaluationRunner: {
        active: (tradingRunId) => tradingRunId === winning.runtime.ref.id
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
      runner_status: entry.runner_status,
      promotion_gate_status: entry.promotion_gate_status
    }))).toEqual([
      {
        rank: 1,
        candidate_id: winning.candidate_id,
        net_revenue_usdt: 19.4,
        runner_status: "active",
        promotion_gate_status: "collecting_paper_evidence"
      },
      {
        rank: 2,
        candidate_id: losing.candidate_id,
        net_revenue_usdt: -3.7,
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
});

async function registerCandidate(
  store: LocalStore,
  input: { id: string; title: string }
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
  input: { id: string; title: string },
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
    system_code_ref: { record_kind: "system_code", id: systemCodeId }
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
  }
): Promise<void> {
  const evaluationId = `paper-evaluation-${input.candidate.candidate_id}`;
  const observedAt = "2026-05-16T00:08:00.000Z";
  const score = {
    revenue_usdt: input.netRevenueUsdt + 0.6,
    cost_usdt: 0.6,
    net_revenue_usdt: input.netRevenueUsdt,
    net_return_pct: input.netReturnPct
  };
  const marketSnapshot = {
    symbol: "BTCUSDT" as const,
    price: 65_200,
    moving_average_fast: 65_240,
    moving_average_slow: 65_050,
    volatility: 0.0014,
    expected_direction: "long" as const,
    observed_at: observedAt,
    source_kind: "binance_production_public_hybrid" as const,
    source_priority: input.sourcePriority,
    freshness: "fresh" as const,
    ws_connected: input.sourcePriority === "websocket_primary",
    rest_fallback_used: input.sourcePriority === "rest_fallback",
    authority_status: "read_only" as const
  };
  const executionSnapshot = {
    symbol: "BTCUSDT" as const,
    observed_at: observedAt,
    source_kind: "binance_production_public_hybrid" as const,
    source_priority: input.sourcePriority,
    freshness: "fresh" as const,
    ws_connected: input.sourcePriority === "websocket_primary",
    rest_fallback_used: input.sourcePriority === "rest_fallback",
    stream_marker: `${input.sourcePriority}-${input.candidate.candidate_id}`,
    agg_trades: [],
    authority_status: "read_only" as const
  };
  const account = {
    wallet_balance_usdt: `${10_000 + input.netRevenueUsdt}`,
    available_balance_usdt: `${10_000 + input.netRevenueUsdt}`,
    equity_usdt: `${10_000 + input.netRevenueUsdt}`,
    realized_pnl_usdt: `${input.netRevenueUsdt}`,
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: "0.2",
    slippage_paid_usdt: "0.2",
    funding_paid_usdt: "0.2",
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
  const latestFill = {
    fill_id: `fill-${input.candidate.candidate_id}`,
    order_id: `order-${input.candidate.candidate_id}`,
    fill_status: "filled" as const,
    fill_price: "65200",
    fill_quantity: "0.001",
    fee_usdt: "0.2",
    slippage_usdt: "0.2",
    funding_usdt: "0.2",
    trade_time: observedAt,
    source_trade_id: `trade-${input.candidate.candidate_id}`
  };
  const evaluation: PaperTradingEvaluationRecord = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: { record_kind: "trading_system_candidate", id: input.candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: input.candidate.runtime.ref,
    status: input.status,
    interval_ms: 60_000,
    observation_count: input.observationCount,
    started_at: "2026-05-16T00:00:00.000Z",
    last_observed_at: observedAt,
    next_observation_at: input.status === "running" ? "2026-05-16T00:09:00.000Z" : undefined,
    latest_score: score,
    paper_account_snapshot: account,
    open_orders: [],
    latest_fill: latestFill,
    latest_public_execution_snapshot: executionSnapshot,
    authority_status: "not_live"
  };
  const observation: PaperTradingObservationRecord = {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `paper-observation-${input.candidate.candidate_id}`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluationId
    },
    candidate_ref: { record_kind: "trading_system_candidate", id: input.candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: input.candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: input.candidate.runtime.ref,
    sequence: input.observationCount,
    status: "recorded",
    observed_at: observedAt,
    market_snapshot: marketSnapshot,
    public_execution_snapshot: executionSnapshot,
    paper_account_snapshot: account,
    open_orders: [],
    latest_fill: latestFill,
    score_delta: score,
    cumulative_score: score,
    authority_status: "not_live"
  };
  await store.recordPaperTradingObservation(observation, evaluation);
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
