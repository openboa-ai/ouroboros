import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArenaSystemViewModel, ArenaWorkspaceViewModel } from "@/app/operator-view-model";
import { ArenaScreen } from "./arena-screen";

function arenaView(system: ArenaSystemViewModel): ArenaWorkspaceViewModel {
  return {
    availability: "compatibility",
    loopStatus: "running",
    systems: [system],
    emptyState: "none"
  };
}

function paperSystem(overrides: Partial<ArenaSystemViewModel> = {}): ArenaSystemViewModel {
  return {
    id: "candidate-1",
    evaluationId: "evaluation-1",
    tradingRunId: "run-1",
    name: "Restarted paper system",
    lifecycle: "waiting_resume",
    rankStatus: "paper_board_ranked",
    rank: 1,
    comparability: "legacy_paper_board",
    unrankedReasons: [],
    qualificationStatus: "needs_resume",
    qualificationReasons: ["runner_inactive_for_running_evaluation"],
    netRevenueUsdt: 4,
    netReturnPct: 0.4,
    revenueUsdt: 6,
    costUsdt: 2,
    observationCount: 10,
    failedObservationCount: 0,
    source: "paper_trading_board",
    detailAvailability: "summary_only",
    ...overrides
  };
}

describe("Arena system operations", () => {
  it("offers Stop for an exact paper run that needs resume", () => {
    const system = paperSystem();
    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={arenaView(system)}
        selectedId={system.id}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );
    const stopButton = Array.from(markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g))
      .map((match) => match[0])
      .find((button) => button.includes("Stop run"));

    expect(stopButton).toBeDefined();
    expect(stopButton).not.toContain('disabled=""');
  });

  it("renders paper-board quality and provenance in the Arena detail", () => {
    const system = paperSystem({
      evidenceWindow: {
        observation_count: 10,
        elapsed_ms: 600_000,
        failed_observation_count: 1,
        first_observed_at: "2026-07-18T00:00:00.000Z",
        last_observed_at: "2026-07-18T00:10:00.000Z"
      },
      trend: {
        direction: "declining",
        net_revenue_delta_usdt: -2.5,
        net_return_delta_pct: -0.25,
        observation_count_delta: 2,
        authority_status: "not_promotion_authority"
      },
      blockerDensity: {
        blocker_count: 2,
        blocker_density: 0.2,
        failed_observation_ratio: 0.1,
        top_blocker: "failed_observation_ratio_exceeded",
        authority_status: "not_promotion_authority"
      },
      marketDataSource: "binance_production_public_websocket",
      latestPublicExecutionSource: "rest_fallback",
      latestFillStatus: "partially_filled",
      openOrderCount: 3
    });

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={arenaView(system)}
        selectedId={system.id}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Paper evidence quality");
    expect(markup).toContain("10 observations / 1 failed");
    expect(markup).toContain("600000 ms");
    expect(markup).toContain("Declining");
    expect(markup).toContain("-2.50 USDT");
    expect(markup).toContain("-0.25%");
    expect(markup).toContain("+2");
    expect(markup).toContain("2 blockers");
    expect(markup).toContain("20.00%");
    expect(markup).toContain("10.00%");
    expect(markup).toContain("Failed Observation Ratio Exceeded");
    expect(markup).toContain("Binance Production Public Websocket");
    expect(markup).toContain("Rest Fallback");
    expect(markup).toContain("Partially Filled");
    expect(markup).toContain("3 open orders");
    expect(markup).toContain("Not Promotion Authority");
  });
});
