import {
  OperatorButton,
  OperatorCallout,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export function ArenaCommandBarSection({
  researchProviderSummary,
  startDisabled,
  stopDisabled,
  tickDisabled,
  cycleDisabled,
  onStart,
  onStop,
  onTick,
  onCycle
}: {
  researchProviderSummary: string;
  startDisabled: boolean;
  stopDisabled: boolean;
  tickDisabled: boolean;
  cycleDisabled: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onTick?: () => void;
  onCycle?: () => void;
}) {
  return (
    <OperatorPanel aria-label="Arena command bar" className="gap-2">
      <OperatorSectionHeader
        title="Arena command bar"
        description="Researcher orchestration stays below live authority and only writes through shared commands."
        actions={(
          <>
            <OperatorButton type="button" onClick={onStart} disabled={startDisabled || !onStart}>
              Start arena
            </OperatorButton>
            <OperatorButton type="button" onClick={onStop} disabled={stopDisabled || !onStop} variant="secondary">
              Stop arena
            </OperatorButton>
            <OperatorButton type="button" onClick={onTick} disabled={tickDisabled || !onTick} variant="outline">
              Run tick
            </OperatorButton>
            <OperatorButton type="button" onClick={onCycle} disabled={cycleDisabled || !onCycle} variant="outline">
              Run cycle
            </OperatorButton>
          </>
        )}
      />
      <OperatorCallout label="Research provider" value={researchProviderSummary} />
    </OperatorPanel>
  );
}
