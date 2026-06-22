import type { ComponentProps } from "react";
import {
  OperatorContentSection,
  OperatorDataTable,
  OperatorDetailText,
  OperatorEmptyState,
  OperatorField,
  OperatorFieldGrid,
  OperatorInlineMeta,
  OperatorResponsiveSlot,
  OperatorSectionHeader,
  OperatorSelectionItem,
  OperatorStatusBadge,
  OperatorTextStack,
  OperatorValueText
} from "@/design-system";
import { boundedArenaLeaderboardEntries } from "@/operator-performance";

export interface ArenaLeaderboardEntry {
  candidateId: string;
  rankLabel: string;
  displayName: string;
  status: string;
  statusVariant: ComponentProps<typeof OperatorStatusBadge>["variant"];
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
  const visibleEntries = boundedArenaLeaderboardEntries(entries, selectedCandidateId);

  return (
    <OperatorContentSection data-operator-ui="arena-leaderboard-section" aria-label="Candidate Arena leaderboard">
      <OperatorSectionHeader
        title="ResearchPreflight leaderboard"
        description="research rank: net_revenue_usdt"
      />
      <OperatorResponsiveSlot visible="mobile">
        {visibleEntries.map((entry) => (
          <OperatorSelectionItem
            type="button"
            key={entry.candidateId}
            onClick={() => onSelectCandidate?.(entry.candidateId)}
            active={selectedCandidateId === entry.candidateId}
            title={entry.displayName}
            detail={entry.rankLabel}
            badge={<OperatorStatusBadge value={entry.status} variant={entry.statusVariant} />}
          >
            <OperatorFieldGrid density="compact" aria-label={`${entry.displayName} research preflight fields`}>
              <OperatorField label="ResearchPreflight net" value={entry.researchPreflightNet} />
              <OperatorField label="ResearchPreflight return" value={entry.researchPreflightReturn} />
              <OperatorField label="Direction" value={entry.direction} />
              <OperatorField label="Parent" value={entry.parent} />
            </OperatorFieldGrid>
            <OperatorDetailText>{entry.latestFinding}</OperatorDetailText>
          </OperatorSelectionItem>
        ))}
      </OperatorResponsiveSlot>
      <OperatorResponsiveSlot visible="desktop">
        <OperatorDataTable
          aria-label="Candidate Arena research preflight leaderboard"
          columns={[
            { key: "rank", label: "Rank", className: "w-11" },
            { key: "candidate", label: "Candidate" },
            { key: "score", label: "ResearchPreflight net", className: "w-[11rem]" }
          ]}
          rows={visibleEntries.map((entry) => ({
            id: entry.candidateId,
            selected: selectedCandidateId === entry.candidateId,
            label: `Select ${entry.displayName}`,
            onSelect: () => onSelectCandidate?.(entry.candidateId),
            cells: {
              rank: entry.rankLabel,
              candidate: (
                <OperatorTextStack>
                  <OperatorValueText>{entry.displayName}</OperatorValueText>
                  <OperatorInlineMeta>
                    <OperatorStatusBadge value={entry.direction} variant="outline" />
                    <OperatorDetailText as="span">{`parent ${entry.parent}`}</OperatorDetailText>
                  </OperatorInlineMeta>
                  <OperatorDetailText as="span">{entry.latestFinding}</OperatorDetailText>
                </OperatorTextStack>
              ),
              score: (
                <OperatorTextStack>
                  <OperatorValueText>{entry.researchPreflightNet}</OperatorValueText>
                  <OperatorDetailText as="span">{entry.researchPreflightReturn}</OperatorDetailText>
                  <OperatorStatusBadge value={entry.status} variant={entry.statusVariant} />
                </OperatorTextStack>
              )
            }
          }))}
        />
      </OperatorResponsiveSlot>
      {!entries.length && (
        <OperatorEmptyState
          title="No candidates yet"
          description="Run tick to generate the first TradingSystem candidates."
          detail="research_only"
        />
      )}
    </OperatorContentSection>
  );
}
