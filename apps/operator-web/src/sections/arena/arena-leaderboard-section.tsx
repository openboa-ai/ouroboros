import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorEmptyState,
  OperatorField
} from "@/design-system";

export interface ArenaLeaderboardEntry {
  candidateId: string;
  rankLabel: string;
  displayName: string;
  status: string;
  statusVariant: ComponentProps<typeof Badge>["variant"];
  direction: string;
  parent: string;
  researchPreflightNet: string;
  researchPreflightReturn: string;
  latestFinding: string;
}

export function ArenaLeaderboardSection({
  entries,
  selectedCandidateId,
  onSelectCandidate
}: {
  entries: ArenaLeaderboardEntry[];
  selectedCandidateId?: string;
  onSelectCandidate?: (candidateId: string) => void;
}) {
  return (
    <section
      data-operator-ui="arena-leaderboard-section"
      className="grid content-start gap-2"
      aria-label="Candidate Arena leaderboard"
    >
      <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-2">
        <h3 className="text-sm font-medium">ResearchPreflight leaderboard</h3>
        <span className="text-xs text-muted-foreground">research rank: net_revenue_usdt</span>
      </div>
      <div className="grid gap-2 lg:hidden">
        {entries.map((entry) => (
          <Button
            type="button"
            key={entry.candidateId}
            onClick={() => onSelectCandidate?.(entry.candidateId)}
            aria-pressed={selectedCandidateId === entry.candidateId}
            variant={selectedCandidateId === entry.candidateId ? "secondary" : "ghost"}
            className="grid h-auto w-full justify-start gap-3 whitespace-normal p-3 text-left"
          >
            <div className="grid gap-2 sm:flex sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <span className="text-xs font-medium text-muted-foreground">{entry.rankLabel}</span>
                <strong className="block break-words leading-snug">{entry.displayName}</strong>
              </div>
              <Badge className="w-fit" variant={entry.statusVariant}>
                {entry.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <OperatorField label="ResearchPreflight net" value={entry.researchPreflightNet} />
              <OperatorField label="ResearchPreflight return" value={entry.researchPreflightReturn} />
              <OperatorField label="Direction" value={entry.direction} />
              <OperatorField label="Parent" value={entry.parent} />
            </div>
            <p className={OPERATOR_DESIGN_TOKENS.typography.detail}>{entry.latestFinding}</p>
          </Button>
        ))}
      </div>
      <div className="hidden lg:grid lg:gap-2">
        <div className="grid grid-cols-[44px_minmax(180px,1fr)_minmax(118px,0.62fr)_minmax(130px,0.6fr)] gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
          <span>Rank</span>
          <span>Candidate</span>
          <span>Direction</span>
          <span>ResearchPreflight net</span>
        </div>
        {entries.map((entry) => (
          <Button
            type="button"
            key={entry.candidateId}
            onClick={() => onSelectCandidate?.(entry.candidateId)}
            aria-pressed={selectedCandidateId === entry.candidateId}
            variant={selectedCandidateId === entry.candidateId ? "secondary" : "ghost"}
            className="grid h-auto w-full grid-cols-[44px_minmax(180px,1fr)_minmax(118px,0.62fr)_minmax(130px,0.6fr)] items-start justify-start gap-2 whitespace-normal p-2 text-left"
          >
            <span>{entry.rankLabel}</span>
            <span className="grid gap-1">
              <strong className="break-words font-medium leading-snug">{entry.displayName}</strong>
              <span className="break-words text-xs text-muted-foreground">
                {`parent ${entry.parent}`}
              </span>
              <span className="break-words text-xs text-muted-foreground">{entry.latestFinding}</span>
            </span>
            <span className="break-words leading-snug">{entry.direction}</span>
            <span className="grid gap-1">
              <strong>{entry.researchPreflightNet}</strong>
              <span className="text-xs text-muted-foreground">{entry.researchPreflightReturn}</span>
              <Badge variant={entry.statusVariant}>{entry.status}</Badge>
            </span>
          </Button>
        ))}
      </div>
      {!entries.length && (
        <OperatorEmptyState
          title="No candidates yet"
          description="Run tick to generate the first TradingSystem candidates."
          detail="research_only"
          className="lg:min-w-[640px]"
        />
      )}
    </section>
  );
}
