import {
  OperatorEmptyState,
  OperatorEvidenceBlock,
  OperatorEvidenceRow,
  OperatorEvidenceStack,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export interface ArenaCommandLogEntry {
  id: string;
  title: string;
  status: string;
  remediationGroup?: string;
  visibleSurface?: string;
  nextStep?: string;
  authority?: string;
}

export function ArenaCommandLogSection({
  entries
}: {
  entries: ArenaCommandLogEntry[];
}) {
  return (
    <OperatorPanel aria-label="Command log">
      <OperatorSectionHeader
        title="Command log"
        description="Recent operator command outcomes and visible remediation surfaces."
      />
      {entries.length ? (
        <OperatorEvidenceStack>
          {entries.map((entry) => (
            <OperatorEvidenceBlock key={entry.id} title={entry.title}>
              <OperatorEvidenceRow>
                <OperatorField label="Status" value={entry.status} />
                {entry.remediationGroup && (
                  <OperatorField label="Remediation group" value={entry.remediationGroup} />
                )}
                {entry.visibleSurface && (
                  <OperatorField label="Visible surface" value={entry.visibleSurface} />
                )}
                {entry.nextStep && (
                  <OperatorField label="Remediation next step" value={entry.nextStep} />
                )}
                {entry.authority && (
                  <OperatorField label="Command authority" value={entry.authority} />
                )}
              </OperatorEvidenceRow>
            </OperatorEvidenceBlock>
          ))}
        </OperatorEvidenceStack>
      ) : (
        <OperatorEmptyState
          title="No commands recorded."
          description="Operator command outcomes will appear after a command is submitted."
          detail="operator_history"
        />
      )}
    </OperatorPanel>
  );
}
