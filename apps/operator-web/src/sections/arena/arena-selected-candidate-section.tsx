import { Button } from "@/components/ui/button";
import {
  OperatorActionRow,
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export interface ArenaSelectedCandidateField {
  label: string;
  value: string;
}

export function ArenaSelectedCandidateSection({
  description,
  fields,
  paperRunnerActive,
  runningPaperTrading,
  paperStartActionLabel,
  startPaperDisabled,
  observePaperDisabled,
  stopPaperDisabled,
  onStartPaperTrading,
  onObservePaperTrading,
  onStopPaperTrading
}: {
  description: string;
  fields: ArenaSelectedCandidateField[];
  paperRunnerActive: boolean;
  runningPaperTrading: boolean;
  paperStartActionLabel: string;
  startPaperDisabled: boolean;
  observePaperDisabled: boolean;
  stopPaperDisabled: boolean;
  onStartPaperTrading?: () => void;
  onObservePaperTrading?: () => void;
  onStopPaperTrading?: () => void;
}) {
  return (
    <OperatorPanel aria-label="Selected Candidate Arena candidate">
      <OperatorSectionHeader
        title="Selected candidate"
        description={description}
        actions={(
          <OperatorActionRow className="justify-start lg:justify-end">
            {paperRunnerActive ? (
              <>
                <Button
                  type="button"
                  onClick={onObservePaperTrading}
                  disabled={observePaperDisabled || !onObservePaperTrading}
                  variant="secondary"
                >
                  {runningPaperTrading ? "Updating paper trading" : "Observe now"}
                </Button>
                <Button
                  type="button"
                  onClick={onStopPaperTrading}
                  disabled={stopPaperDisabled || !onStopPaperTrading}
                  variant="outline"
                >
                  Stop paper trading
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={onStartPaperTrading}
                disabled={startPaperDisabled || !onStartPaperTrading}
                variant="secondary"
              >
                {runningPaperTrading ? "Starting paper trading" : paperStartActionLabel}
              </Button>
            )}
          </OperatorActionRow>
        )}
      />
      <OperatorFieldGrid>
        {fields.map((field) => (
          <OperatorField key={field.label} label={field.label} value={field.value} />
        ))}
      </OperatorFieldGrid>
    </OperatorPanel>
  );
}
