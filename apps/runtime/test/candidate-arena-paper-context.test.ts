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

  it("rejects arena SystemCode entrypoints that escape the artifact directory", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new EscapingEntrypointResearchAgent(),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(outcome.created_candidate_count).toBe(0);
    expect(outcome.created_candidate_ids).toEqual([]);
    const tick = outcome.arena.latest_ticks.find((entry) => entry.tick_id === outcome.tick_id);
    expect(tick).toEqual(expect.objectContaining({
      status: "failed",
      created_candidate_ids: []
    }));
    expect(tick?.direction_results).toEqual([
      expect.objectContaining({
        direction_kind: "trend_following",
        status: "failed",
        error: "candidate_arena_entrypoint_escapes_artifact_dir"
      })
    ]);
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
        blocker_groups: Array<{
          group_kind: string;
          severity: string;
          blockers: string[];
          next_action: string;
        }>;
        trend: {
          direction: string;
          net_revenue_delta_usdt: number;
          net_return_delta_pct: number;
          observation_count_delta: number;
          authority_status: string;
        };
        blocker_density: {
          blocker_count: number;
          blocker_density: number;
          failed_observation_ratio: number;
          top_blocker?: string;
          authority_status: string;
        };
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
        blocker_groups: [
          expect.objectContaining({
            group_kind: "evidence_window",
            severity: "collecting",
            blockers: [
              "min_observation_count_not_met",
              "min_elapsed_ms_not_met"
            ],
            next_action: "Continue paper observations until count and elapsed-time gates qualify."
          })
        ],
        trend: {
          direction: "insufficient_history",
          net_revenue_delta_usdt: 0,
          net_return_delta_pct: 0,
          observation_count_delta: 0,
          authority_status: "not_promotion_authority"
        },
        blocker_density: {
          blocker_count: 2,
          blocker_density: 0.285714,
          failed_observation_ratio: 0,
          top_blocker: "min_observation_count_not_met",
          authority_status: "not_promotion_authority"
        },
        authority_status: "not_live"
      })
    ]);
    expect(context.paper_trading_board[0]).not.toHaveProperty("promotion_gate_status");
  });

  it("feeds paper candidate lineage and findings into the next researcher context", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "lineage-feedback-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const createdCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!createdCandidate) {
      throw new Error("lineage feedback candidate missing");
    }
    await seedPaperTradingEvidence(store, createdCandidate);

    await runCandidateArenaTick({
      store,
      tickId: "lineage-feedback-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      selected_paper_evidence: Array<{
        candidate_id: string;
        lineage?: {
          lineage_status: string;
          direction_kind?: string;
          parent_candidate_id?: string;
          latest_finding?: string;
          evaluation_status?: string;
          authority_status: string;
        };
        paper_board_learning?: {
          rank: number;
          net_revenue_usdt: number;
          observation_count: number;
          qualification_status: string;
          summary: string;
          next_research_focus: string;
          authority_status: string;
        };
      }>;
    };
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: createdCandidate.candidate_id,
        lineage: expect.objectContaining({
          lineage_status: "available",
          direction_kind: "trend_following",
          parent_candidate_id: FIXTURE_CANDIDATE_ID,
          latest_finding: "Candidate was disqualified by evaluation guardrails.",
          evaluation_status: "disqualified",
          authority_status: "lineage_only"
        }),
        paper_board_learning: expect.objectContaining({
          rank: 1,
          net_revenue_usdt: 12.34,
          observation_count: 7,
          qualification_status: "collecting_evidence",
          summary: "Paper board rank #1: 12.34 net_revenue_usdt, 0.1234 net_return_pct, 7 observations, collecting_evidence.",
          next_research_focus: "Continue paper observations until count and elapsed-time gates qualify.",
          authority_status: "lineage_only"
        })
      })
    ]));
  });

  it("uses the latest evaluated arena leader as the next generation source by default", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "iterative-source-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const firstLeaderId = first.arena.leaderboard[0]?.candidate_id;
    expect(firstLeaderId).toBe(first.created_candidate_ids[0]);

    const second = await runCandidateArenaTick({
      store,
      tickId: "iterative-source-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondCandidate = await store.getCandidate(second.created_candidate_ids[0]!);
    const firstTick = first.arena.latest_ticks.find((entry) => entry.tick_id === first.tick_id);
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(firstTick).toMatchObject({
      source_candidate: {
        source_kind: "fixture_seed",
        candidate_id: FIXTURE_CANDIDATE_ID,
        display_name: "Fixture generic trading-system candidate",
        authority_status: "not_live"
      }
    });
    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "evaluated_arena_leader",
        candidate_id: firstLeaderId,
        display_name: "Arena trend following BTCUSDT Trading System",
        net_revenue_usdt: expect.any(Number),
        authority_status: "not_live"
      }
    });
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).toBe(firstLeaderId);
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).not.toBe(FIXTURE_CANDIDATE_ID);
  });

  it("uses the latest paper trading evaluation leader as the next generation source by default", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const paperLeader = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!paperLeader) {
      throw new Error("paper source leader missing");
    }
    await seedPaperTradingEvidence(store, paperLeader);

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-tick-2",
      directions: ["mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondCandidate = await store.getCandidate(second.created_candidate_ids[0]!);
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "paper_trading_evaluation_leader",
        candidate_id: paperLeader.candidate_id,
        display_name: "Arena trend following BTCUSDT Trading System",
        net_revenue_usdt: 12.34,
        authority_status: "not_live"
      }
    });
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).toBe(paperLeader.candidate_id);
    expect(secondCandidate?.full_cycle_lineage?.source.trading_system_id).not.toBe(FIXTURE_CANDIDATE_ID);
  });

  it("ranks only each candidate's latest paper trading evaluation when choosing the next source", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-only-tick-1",
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const staleHighCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    const currentLeader = await store.getCandidate(first.created_candidate_ids[1]!);
    if (!staleHighCandidate || !currentLeader) {
      throw new Error("paper source candidates missing");
    }

    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-stale-high",
      startedAt: "2026-05-15T00:00:00.000Z",
      latestScore: {
        revenue_usdt: 50,
        cost_usdt: 1,
        net_revenue_usdt: 49,
        net_return_pct: 0.49
      }
    });
    await seedPaperTradingEvidence(store, staleHighCandidate, {
      evaluationId: "paper-source-current-low",
      startedAt: "2026-05-16T00:00:00.000Z",
      latestScore: {
        revenue_usdt: 1,
        cost_usdt: 2,
        net_revenue_usdt: -1,
        net_return_pct: -0.01
      }
    });
    await seedPaperTradingEvidence(store, currentLeader, {
      evaluationId: "paper-source-current-leader",
      startedAt: "2026-05-16T00:01:00.000Z",
      latestScore: {
        revenue_usdt: 14,
        cost_usdt: 1,
        net_revenue_usdt: 13,
        net_return_pct: 0.13
      }
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "paper-source-latest-only-tick-2",
      directions: ["volatility_regime"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent([]),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const secondTick = second.arena.latest_ticks.find((entry) => entry.tick_id === second.tick_id);

    expect(secondTick).toMatchObject({
      source_candidate: {
        source_kind: "paper_trading_evaluation_leader",
        candidate_id: currentLeader.candidate_id,
        net_revenue_usdt: 13,
        authority_status: "not_live"
      }
    });
    expect(secondTick?.source_candidate?.candidate_id).not.toBe(staleHighCandidate.candidate_id);
  });

  it("clusters findings for the next ResearchWorker by direction, blocker, market regime, and protocol failure", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "finding-cluster-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });
    const createdCandidate = await store.getCandidate(first.created_candidate_ids[0]!);
    if (!createdCandidate) {
      throw new Error("finding cluster candidate missing");
    }
    await seedPaperTradingEvidence(store, createdCandidate, {
      status: "failed",
      observationStatus: "failed",
      failureReason: "malformed TradingSystem paper event protocol: invalid order_request",
      expectedDirection: "long",
      volatility: 0.024
    });

    const second = await runCandidateArenaTick({
      store,
      tickId: "finding-cluster-tick-2",
      directions: ["execution_cost_robustness"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      finding_clusters: Array<{
        direction_kind: string;
        top_blocker?: string;
        blocker_group_kind?: string;
        market_regime: string;
        protocol_failure_kind?: string;
        candidate_count: number;
        candidate_ids: string[];
        latest_finding?: string;
        next_research_focus: string;
        authority_status: string;
      }>;
    };

    expect(context.finding_clusters).toEqual([
      {
        direction_kind: "trend_following",
        top_blocker: "paper_evaluation_failed",
        blocker_group_kind: "observation_quality",
        market_regime: "long",
        protocol_failure_kind: "trading_system_protocol_error",
        candidate_count: 1,
        candidate_ids: [createdCandidate.candidate_id],
        latest_finding: "Candidate was disqualified by evaluation guardrails.",
        next_research_focus: "Inspect the latest paper failure and fix the runtime or protocol issue before review.",
        authority_status: "not_promotion_authority"
      }
    ]);
    expect((second.arena as {
      finding_clusters?: typeof context.finding_clusters;
    }).finding_clusters).toEqual(context.finding_clusters);
  });

  it("feeds previous tick research efficiency into the next researcher context without promotion authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const capturedContexts: string[] = [];
    const first = await runCandidateArenaTick({
      store,
      tickId: "efficiency-tick-1",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    const firstTick = first.arena.latest_ticks.find((entry) => entry.tick_id === first.tick_id);
    expect(firstTick?.direction_results[0]).toMatchObject({
      direction_kind: "trend_following",
      status: "created",
      research_efficiency: {
        provider_request_total: 6,
        runner_command_total: 0,
        scenario_count: 2,
        authority_status: "not_promotion_authority"
      }
    });

    await runCandidateArenaTick({
      store,
      tickId: "efficiency-tick-2",
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new CapturingResearchAgent(capturedContexts),
      artifactRunner: networklessReplayArtifactRunner(),
      replayProviderFactory: networklessReplayTradingApiProvider
    });

    expect(capturedContexts).toHaveLength(2);
    const context = JSON.parse(capturedContexts[1]!) as {
      latest_research_efficiency: Array<{
        tick_id: string;
        direction_kind: string;
        provider_request_total: number;
        runner_command_total: number;
        scenario_count: number;
        authority_status: string;
      }>;
    };
    expect(context.latest_research_efficiency).toEqual([
      expect.objectContaining({
        tick_id: "efficiency-tick-1",
        direction_kind: "trend_following",
        provider_request_total: 6,
        runner_command_total: 0,
        scenario_count: 2,
        authority_status: "not_promotion_authority"
      })
    ]);
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

class EscapingEntrypointResearchAgent implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-escaping-entrypoint",
    provider: "codex",
    model: "escaping-entrypoint",
    permission_policy: "artifact_workspace_only"
  };

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const outsidePath = path.join(input.artifact_dir, "..", "outside.py");
    await writeFile(outsidePath, "print('outside artifact root')\n", "utf8");
    await writeFile(path.join(input.artifact_dir, "manifest.json"), `${JSON.stringify({
      id: "escaping-entrypoint",
      api_contract: "trading_api_provider_v1",
      entrypoint: ["python3", "../outside.py"]
    }, null, 2)}\n`, "utf8");
    return {
      status: "edited",
      summary: "Repointed manifest outside the artifact root.",
      changed_paths: ["manifest.json"]
    };
  }
}

async function seedPaperTradingEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  options: {
    status?: PaperTradingEvaluationRecord["status"];
    observationStatus?: PaperTradingObservationRecord["status"];
    evaluationId?: string;
    startedAt?: string;
    lastObservedAt?: string;
    latestScore?: PaperTradingEvaluationRecord["latest_score"];
    failureReason?: string;
    expectedDirection?: "long" | "short" | "flat";
    volatility?: number;
  } = {}
): Promise<void> {
  const evaluationId = options.evaluationId ?? `paper-trading-evaluation-${candidate.candidate_id}-context`;
  const tradingRunId = candidate.runtime.ref.id;
  const startedAt = options.startedAt ?? "2026-05-16T00:00:00.000Z";
  const lastObservedAt = options.lastObservedAt ?? "2026-05-16T00:07:00.000Z";
  const latestScore = options.latestScore ?? {
    revenue_usdt: 13,
    cost_usdt: 0.66,
    net_revenue_usdt: 12.34,
    net_return_pct: 0.1234
  };
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
    status: options.status ?? "running",
    interval_ms: 60_000,
    observation_count: 7,
    started_at: startedAt,
    last_observed_at: lastObservedAt,
    next_observation_at: "2026-05-16T00:08:00.000Z",
    latest_score: latestScore,
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
    latest_failure_reason: options.failureReason,
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
    status: options.observationStatus ?? "recorded",
    observed_at: lastObservedAt,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 65_123,
      moving_average_fast: 65_180,
      moving_average_slow: 65_000,
      volatility: options.volatility,
      expected_direction: options.expectedDirection,
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
    cumulative_score: latestScore,
    failure_reason: options.failureReason,
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
