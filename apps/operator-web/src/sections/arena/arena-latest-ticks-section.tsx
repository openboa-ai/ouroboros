import {
  OperatorEmptyState,
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export interface ArenaLatestTickSummary {
  tickId: string;
  status: string;
  source: string;
  generated: string;
  directions: string;
  efficiency: string;
}

export function ArenaLatestTicksSection({
  tick
}: {
  tick?: ArenaLatestTickSummary;
}) {
  return (
    <OperatorPanel aria-label="Candidate Arena latest ticks">
      <OperatorSectionHeader
        title="Latest ticks"
        description="Recent CandidateArena generation evidence."
      />
      {tick ? (
        <OperatorFieldGrid>
          <OperatorField label="Tick" value={tick.tickId} />
          <OperatorField label="Status" value={tick.status} />
          <OperatorField label="Source" value={tick.source} />
          <OperatorField label="Generated" value={tick.generated} />
          <OperatorField label="Directions" value={tick.directions} />
          <OperatorField label="Efficiency" value={tick.efficiency} />
        </OperatorFieldGrid>
      ) : (
        <OperatorEmptyState
          title="No Candidate Arena ticks recorded."
          description="Run a CandidateArena tick to create generation evidence."
          detail="research_only"
        />
      )}
    </OperatorPanel>
  );
}
