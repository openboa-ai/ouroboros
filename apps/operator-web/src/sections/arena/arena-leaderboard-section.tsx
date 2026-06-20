import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OperatorDataTable,
  OperatorDetailText,
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
            <OperatorDetailText>{entry.latestFinding}</OperatorDetailText>
          </Button>
        ))}
      </div>
      <div className="hidden lg:block">
        <OperatorDataTable
          aria-label="Candidate Arena research preflight leaderboard"
          columns={[
            { key: "rank", label: "Rank", className: "w-11" },
            { key: "candidate", label: "Candidate" },
            { key: "score", label: "ResearchPreflight net", className: "w-[11rem]" }
          ]}
          rows={entries.map((entry) => ({
            id: entry.candidateId,
            selected: selectedCandidateId === entry.candidateId,
            label: `Select ${entry.displayName}`,
            onSelect: () => onSelectCandidate?.(entry.candidateId),
            cells: {
              rank: entry.rankLabel,
              candidate: (
                <span className="grid gap-1">
                  <strong className="break-words font-medium leading-snug">{entry.displayName}</strong>
                  <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant="outline">{entry.direction}</Badge>
                    <span className="min-w-0 break-words">{`parent ${entry.parent}`}</span>
                  </span>
                  <OperatorDetailText as="span">{entry.latestFinding}</OperatorDetailText>
                </span>
              ),
              score: (
                <span className="grid gap-1">
                  <strong>{entry.researchPreflightNet}</strong>
                  <span className="text-xs text-muted-foreground">{entry.researchPreflightReturn}</span>
                  <Badge variant={entry.statusVariant}>{entry.status}</Badge>
                </span>
              )
            }
          }))}
        />
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
