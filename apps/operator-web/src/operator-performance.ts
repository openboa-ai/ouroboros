export const OPERATOR_SIDEBAR_CANDIDATE_LIMIT = 40;
export const OPERATOR_LEADERBOARD_RENDER_LIMIT = 60;
export const OPERATOR_MARKET_CHART_POINT_LIMIT = 120;

interface CandidateIdentity {
  candidateId: string;
}

interface ChartPoint {
  label: string;
  price: number;
}

export function boundedOperatorSidebarCandidates<T extends CandidateIdentity>(
  candidates: T[],
  selectedCandidateId?: string
): T[] {
  return boundedBySelected(candidates, selectedCandidateId, OPERATOR_SIDEBAR_CANDIDATE_LIMIT);
}

export function boundedArenaLeaderboardEntries<T extends CandidateIdentity>(
  entries: T[],
  selectedCandidateId?: string
): T[] {
  return boundedBySelected(entries, selectedCandidateId, OPERATOR_LEADERBOARD_RENDER_LIMIT);
}

export function downsampleTradingMarketChartPoints<T extends ChartPoint>(
  points: T[],
  limit = OPERATOR_MARKET_CHART_POINT_LIMIT
): T[] {
  if (points.length <= limit) {
    return points;
  }
  if (limit < 2) {
    return points.slice(0, Math.max(limit, 0));
  }

  const lastIndex = points.length - 1;
  const step = lastIndex / (limit - 1);
  return Array.from({ length: limit }, (_, index) => {
    const pointIndex = index === limit - 1 ? lastIndex : Math.floor(index * step);
    return points[pointIndex];
  });
}

export function shouldRunOperatorRefresh(visibilityState?: DocumentVisibilityState): boolean {
  return visibilityState !== "hidden";
}

function boundedBySelected<T extends CandidateIdentity>(
  items: T[],
  selectedCandidateId: string | undefined,
  limit: number
): T[] {
  if (items.length <= limit) {
    return items;
  }

  const visible = items.slice(0, limit);
  if (!selectedCandidateId || visible.some((item) => item.candidateId === selectedCandidateId)) {
    return visible;
  }

  const selected = items.find((item) => item.candidateId === selectedCandidateId);
  if (!selected) {
    return visible;
  }

  return [...visible.slice(0, limit - 1), selected];
}
