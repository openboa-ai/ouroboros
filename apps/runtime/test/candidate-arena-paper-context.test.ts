import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCandidateArenaTick } from "@ouroboros/application/candidate/arena";
import type { TradingArtifactRunner } from "@ouroboros/application/trading/research/artifact-runner";
import { validateOrderRequest } from "@ouroboros/application/trading/research/replay-trading-api-provider";
import type {
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  ReplayTradingApiProviderSession,
  ReplayTradingScenario,
  TradingProviderRequestLog,
  TradingResearchAgentAdapter,
  TradingSystemEvent
} from "@ouroboros/application/trading/research/types";
import type {
  CandidateInspectReadModel,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord
} from "@ouroboros/domain";
import { FIXTURE_CANDIDATE_ID, LocalStore } from "@ouroboros/local-store";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-arena-paper-context-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("CandidateArena paper evidence context", () => {
  it("records generated SystemCode paths as absolute when the store root is relative", async () => {
    const repoRoot = process.cwd();
    const previousCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const store = new LocalStore(path.join(".ouroboros", "dev-store"));
      await store.initialize();
      const outcome = await runCandidateArenaTick({
        store,
        directions: ["trend_following"],
        researchAgent: "codex",
        agentFactory: () => new CapturingResearchAgent([]),
        artifactRunner: networklessReplayArtifactRunner(),
        replayProviderFactory: networklessReplayTradingApiProvider,
        repoRoot
      });
      const candidate = await store.getCandidate(outcome.created_candidate_ids[0]!);
      const systemCodeId = candidate?.system_code?.ref?.id;
      if (!systemCodeId) {
        throw new Error("arena-generated candidate missing SystemCode ref");
      }
      const systemCode = await store.getSystemCode(systemCodeId);
      if (!systemCode || systemCode.artifact_kind !== "python_file") {
        throw new Error("arena-generated SystemCode missing");
      }

      expect(path.isAbsolute(systemCode.artifact_path)).toBe(true);
      expect(path.isAbsolute(systemCode.entrypoint[1]!)).toBe(true);
      expect(systemCode.entrypoint).toEqual(["python3", systemCode.artifact_path]);
      expect(systemCode.artifact_path).toContain(path.join(
        tmpDir,
        ".ouroboros",
        "dev-store",
        "candidate-arena-runs"
      ));
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("feeds latest paper trading evidence into the next researcher context even before replay leaderboard ranking", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const source = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!source) {
      throw new Error("fixture candidate missing");
    }
    await seedPaperTradingEvidence(store, source);

    const capturedContexts: string[] = [];
    await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(1);
    const context = JSON.parse(capturedContexts[0]!) as {
      selected_paper_evidence: Array<{
        candidate_id: string;
        paper_trading_status?: string;
        paper_observation_count: number;
        paper_score?: { net_revenue_usdt: number };
        latest_market_snapshot?: { price: number; source_kind: string };
        latest_fill?: { source_trade_id?: string };
        ledger_chain_complete: boolean;
        authority_status: string;
      }>;
      paper_trading_board: Array<{
        rank: number;
        candidate_id: string;
        paper_runner_status: string;
        net_revenue_usdt: number;
        observation_count: number;
        qualification_status: string;
        qualification_reasons: string[];
        promotion_gate_status?: string;
        authority_status: string;
      }>;
    };
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: FIXTURE_CANDIDATE_ID,
        paper_trading_status: "running",
        paper_observation_count: 7,
        paper_score: expect.objectContaining({
          net_revenue_usdt: 12.34
        }),
        latest_market_snapshot: expect.objectContaining({
          price: 65_123,
          source_kind: "binance_production_public_hybrid"
        }),
        latest_fill: expect.objectContaining({
          source_trade_id: "paper-context-trade-0007"
        }),
        ledger_chain_complete: false,
        authority_status: "not_live"
      })
    ]));
    expect(context.paper_trading_board).toEqual([
      expect.objectContaining({
        rank: 1,
        candidate_id: FIXTURE_CANDIDATE_ID,
        paper_runner_status: "unknown_at_tick_context",
        net_revenue_usdt: 12.34,
        observation_count: 7,
        qualification_status: "collecting_evidence",
        qualification_reasons: [
          "min_observation_count_not_met",
          "min_elapsed_ms_not_met"
        ],
        authority_status: "not_live"
      })
    ]);
    expect(context.paper_trading_board[0]).not.toHaveProperty("promotion_gate_status");
  });
});

class CapturingResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-capturing-context",
    provider: "codex",
    model: "capturing-context",
    permission_policy: "artifact_workspace_only"
  };

  constructor(private readonly contexts: string[]) {}

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    this.contexts.push(input.arena_context ?? "");
    return {
      status: "no_change",
      summary: "Captured arena context without editing the artifact.",
      changed_paths: []
    };
  }
}

async function seedPaperTradingEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel
): Promise<void> {
  const evaluationId = `paper-trading-evaluation-${FIXTURE_CANDIDATE_ID}-context`;
  const tradingRunId = candidate.runtime.ref.id;
  const evaluation: PaperTradingEvaluationRecord = {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: evaluationId,
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: { record_kind: "trading_run", id: tradingRunId },
    status: "running",
    interval_ms: 60_000,
    observation_count: 7,
    started_at: "2026-05-16T00:00:00.000Z",
    last_observed_at: "2026-05-16T00:07:00.000Z",
    next_observation_at: "2026-05-16T00:08:00.000Z",
    latest_score: {
      revenue_usdt: 13,
      cost_usdt: 0.66,
      net_revenue_usdt: 12.34,
      net_return_pct: 0.1234
    },
    paper_account_snapshot: {
      wallet_balance_usdt: "10012.34",
      available_balance_usdt: "10012.34",
      equity_usdt: "10012.34",
      realized_pnl_usdt: "12.34",
      unrealized_pnl_usdt: "0",
      fee_paid_usdt: "0.26",
      slippage_paid_usdt: "0.20",
      funding_paid_usdt: "0.20",
      margin_reserved_usdt: "0",
      position: {
        symbol: "BTCUSDT",
        quantity: "0.001",
        side: "long",
        average_entry_price: "65000",
        mark_price: "65123",
        notional_usdt: "65.123"
      },
      open_order_count: 0,
      authority_status: "not_live"
    },
    open_orders: [],
    latest_fill: {
      fill_id: "paper-context-fill-0007",
      order_id: "paper-context-order-0001",
      fill_status: "filled",
      fill_price: "65123",
      fill_quantity: "0.001",
      fee_usdt: "0.26",
      slippage_usdt: "0.20",
      funding_usdt: "0.20",
      trade_time: "2026-05-16T00:07:00.000Z",
      source_trade_id: "paper-context-trade-0007"
    },
    processed_trading_system_event_ids: ["paper-context-order-0001", "paper-context-hold-0002"],
    processed_public_trade_ids: ["paper-context-trade-0007"],
    latest_public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-05-16T00:07:00.000Z",
      source_kind: "binance_production_public_hybrid",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: true,
      rest_fallback_used: false,
      gap_detected: false,
      stream_marker: "aggTrade:paper-context-trade-0007",
      agg_trades: [{
        trade_id: "paper-context-trade-0007",
        price: "65123",
        quantity: "0.001",
        trade_time: "2026-05-16T00:07:00.000Z"
      }],
      authority_status: "read_only"
    },
    authority_status: "not_live"
  };
  const observation: PaperTradingObservationRecord = {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: `${evaluationId}-observation-0007`,
    paper_trading_evaluation_ref: { record_kind: "paper_trading_evaluation", id: evaluationId },
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: { record_kind: "trading_run", id: tradingRunId },
    sequence: 7,
    status: "recorded",
    observed_at: "2026-05-16T00:07:00.000Z",
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 65_123,
      observed_at: "2026-05-16T00:07:00.000Z",
      source_kind: "binance_production_public_hybrid",
      source_priority: "websocket_primary",
      freshness: "fresh",
      ws_connected: true,
      rest_fallback_used: false,
      gap_detected: false,
      stream_marker: "bookTicker:paper-context-0007",
      authority_status: "read_only"
    },
    public_execution_snapshot: evaluation.latest_public_execution_snapshot,
    decision: {
      decision_kind: "hold",
      source_kind: "trading_system_decision",
      reason: "paper context seed preserved selected candidate evidence",
      observed_at: "2026-05-16T00:07:00.000Z",
      authority_status: "trace_only"
    },
    paper_account_snapshot: evaluation.paper_account_snapshot,
    open_orders: [],
    latest_fill: evaluation.latest_fill,
    processed_trading_system_event_ids: evaluation.processed_trading_system_event_ids,
    processed_public_trade_ids: evaluation.processed_public_trade_ids,
    score_delta: {
      revenue_usdt: 1,
      cost_usdt: 0.04,
      net_revenue_usdt: 0.96,
      net_return_pct: 0.0096
    },
    cumulative_score: evaluation.latest_score,
    authority_status: "not_live"
  };
  await store.recordPaperTradingObservation(observation, evaluation);
}

function networklessReplayArtifactRunner(): TradingArtifactRunner {
  return {
    kind: "host_process",
    async run(input) {
      const market = input.provider.scenario.market;
      const account = input.provider.scenario.account;
      const orderRequest = {
        symbol: market.symbol,
        side: market.expected_direction === "short" ? "sell" as const : "buy" as const,
        quantity: Number((account.equity * account.target_risk_fraction / market.price).toFixed(8)),
        order_type: "market" as const,
        reason: "networkless arena context runner preserves TradingApiProvider boundary"
      };
      const validation = validateOrderRequest(orderRequest, market, account);
      const events: TradingSystemEvent[] = [
        { event: "market_snapshot", ...market },
        { event: "account_state", ...account },
        { event: "order_request", ...orderRequest },
        { event: "order_validation", ...validation },
        { event: "run_complete", accepted: validation.accepted }
      ];
      await mkdir(input.output_dir, { recursive: true });
      const eventsPath = path.join(input.output_dir, "events.jsonl");
      await writeFile(eventsPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
      return {
        status: "completed",
        runner_kind: "host_process",
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: events.map((event) => JSON.stringify(event)).join("\n"),
        stderr: "",
        events,
        provider_requests: providerBoundaryRequests()
      };
    }
  };
}

async function networklessReplayTradingApiProvider(
  scenario: ReplayTradingScenario
): Promise<ReplayTradingApiProviderSession> {
  return {
    base_url: "",
    close: async () => undefined,
    requests: () => providerBoundaryRequests(),
    scenario
  };
}

function providerBoundaryRequests(): TradingProviderRequestLog[] {
  return [
    providerRequest("GET", "/market/snapshot"),
    providerRequest("GET", "/account/state"),
    providerRequest("POST", "/orders/validate")
  ];
}

function providerRequest(method: string, requestPath: string): TradingProviderRequestLog {
  return {
    at: "2026-05-16T00:00:00.000Z",
    method,
    path: requestPath,
    response_status: 200
  };
}
