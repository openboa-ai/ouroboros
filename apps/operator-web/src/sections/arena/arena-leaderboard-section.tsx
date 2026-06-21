import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
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
  OperatorTextStack,
  OperatorValueText
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
    <OperatorContentSection data-operator-ui="arena-leaderboard-section" aria-label="Candidate Arena leaderboard">
      <OperatorSectionHeader
        title="ResearchPreflight leaderboard"
        description="research rank: net_revenue_usdt"
      />
      <OperatorResponsiveSlot visible="mobile">
        {entries.map((entry) => (
          <OperatorSelectionItem
            type="button"
            key={entry.candidateId}
            onClick={() => onSelectCandidate?.(entry.candidateId)}
            active={selectedCandidateId === entry.candidateId}
            title={entry.displayName}
            detail={entry.rankLabel}
            badge={<Badge variant={entry.statusVariant}>{entry.status}</Badge>}
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
          rows={entries.map((entry) => ({
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
                    <Badge variant="outline">{entry.direction}</Badge>
                    <OperatorDetailText as="span">{`parent ${entry.parent}`}</OperatorDetailText>
                  </OperatorInlineMeta>
                  <OperatorDetailText as="span">{entry.latestFinding}</OperatorDetailText>
                </OperatorTextStack>
              ),
              score: (
                <OperatorTextStack>
                  <OperatorValueText>{entry.researchPreflightNet}</OperatorValueText>
                  <OperatorDetailText as="span">{entry.researchPreflightReturn}</OperatorDetailText>
                  <Badge variant={entry.statusVariant}>{entry.status}</Badge>
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
