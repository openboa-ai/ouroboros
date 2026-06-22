import { describe, expect, it } from "vitest";
import {
  OPERATOR_LEADERBOARD_RENDER_LIMIT,
  OPERATOR_MARKET_CHART_POINT_LIMIT,
  OPERATOR_SIDEBAR_CANDIDATE_LIMIT,
  boundedOperatorSidebarCandidates,
  boundedArenaLeaderboardEntries,
  downsampleTradingMarketChartPoints,
  shouldRunOperatorRefresh
} from "./operator-performance";

describe("operator web performance bounds", () => {
  it("keeps sidebar candidates bounded while preserving the selected candidate", () => {
    const candidates = Array.from({ length: OPERATOR_SIDEBAR_CANDIDATE_LIMIT + 25 }, (_, index) => ({
      candidateId: `candidate-${index}`,
      displayName: `Candidate ${index}`
    }));
    const selected = candidates.at(-1);

    const visible = boundedOperatorSidebarCandidates(candidates, selected?.candidateId);

    expect(visible.length).toBe(OPERATOR_SIDEBAR_CANDIDATE_LIMIT);
    expect(visible.some((candidate) => candidate.candidateId === selected?.candidateId)).toBe(true);
    expect(visible[0]?.candidateId).toBe("candidate-0");
  });

  it("keeps leaderboard entries bounded while preserving the selected row", () => {
    const entries = Array.from({ length: OPERATOR_LEADERBOARD_RENDER_LIMIT + 30 }, (_, index) => ({
      candidateId: `candidate-${index}`,
      rankLabel: `#${index + 1}`,
      displayName: `Candidate ${index}`,
      status: "accepted",
      statusVariant: "success" as const,
      direction: "trend_following",
      parent: "none",
      researchPreflightNet: "1.00 USDT",
      researchPreflightReturn: "0.01%",
      latestFinding: "bounded render"
    }));
    const selected = entries.at(-1);

    const visible = boundedArenaLeaderboardEntries(entries, selected?.candidateId);

    expect(visible.length).toBe(OPERATOR_LEADERBOARD_RENDER_LIMIT);
    expect(visible.some((entry) => entry.candidateId === selected?.candidateId)).toBe(true);
    expect(visible[0]?.candidateId).toBe("candidate-0");
  });

  it("downsamples market chart points to a stable rendering budget", () => {
    const points = Array.from({ length: OPERATOR_MARKET_CHART_POINT_LIMIT * 4 }, (_, index) => ({
      label: `t-${index}`,
      price: 65000 + index
    }));

    const visible = downsampleTradingMarketChartPoints(points);

    expect(visible.length).toBeLessThanOrEqual(OPERATOR_MARKET_CHART_POINT_LIMIT);
    expect(visible[0]).toEqual(points[0]);
    expect(visible.at(-1)).toEqual(points.at(-1));
  });

  it("skips automatic operator refresh while the document is hidden", () => {
    expect(shouldRunOperatorRefresh("visible")).toBe(true);
    expect(shouldRunOperatorRefresh("hidden")).toBe(false);
    expect(shouldRunOperatorRefresh(undefined)).toBe(true);
  });
});
