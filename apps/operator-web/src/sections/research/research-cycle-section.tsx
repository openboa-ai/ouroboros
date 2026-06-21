import {
  OperatorEvidenceBlock,
  OperatorEvidenceRow,
  OperatorEvidenceStack,
  OperatorEvidenceStatus,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStatusBadge
} from "@/design-system";

export interface ResearchCycleStage {
  label: string;
  status: string;
  tone: "neutral" | "counted" | "failed" | "sealed";
}

export interface ResearchCycleRow {
  id: string;
  status: string;
  name: string;
  evaluation: string;
  active: boolean;
}

export function ResearchCycleSection({
  rowCount,
  stages,
  rows
}: {
  rowCount: number;
  stages: ResearchCycleStage[];
  rows: ResearchCycleRow[];
}) {
  return (
    <OperatorPanel aria-label="Research cycle">
      <OperatorSectionHeader
        title="Research"
        description="How CandidateArena evidence, ResearchPreflight, and lineage prepare the next TradingSystem candidate cycle."
        actions={<OperatorStatusBadge value={String(rowCount)} variant="secondary" />}
      />
      <OperatorEvidenceRow aria-label="Research cycle stages">
        {stages.map((stage) => (
          <OperatorEvidenceStatus
            key={stage.label}
            label={stage.label}
            value={stage.status}
            detail="Research cycle state"
            tone={stage.tone}
          />
        ))}
      </OperatorEvidenceRow>
      <OperatorEvidenceStack>
        {rows.map((row) => (
          <OperatorEvidenceBlock key={row.id} title={row.name}>
            <OperatorEvidenceRow>
              <OperatorField label="Status" value={row.status} />
              <OperatorField label="ResearchPreflight" value={row.evaluation} />
              <OperatorField label="Queue state" value={row.active ? "running view" : "queued"} />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        ))}
      </OperatorEvidenceStack>
    </OperatorPanel>
  );
}
