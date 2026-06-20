import {
  OPERATOR_DESIGN_TOKENS,
  OperatorEmptyState,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export interface ArenaLatestTickSummary {
  tickId: string;
  status: string;
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
        <dl className={OPERATOR_DESIGN_TOKENS.layout.fieldGrid}>
          <OperatorField label="Tick" value={tick.tickId} />
          <OperatorField label="Status" value={tick.status} />
          <OperatorField label="Generated" value={tick.generated} />
          <OperatorField label="Directions" value={tick.directions} />
          <OperatorField label="Efficiency" value={tick.efficiency} />
        </dl>
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
