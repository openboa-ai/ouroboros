import {
  OperatorEvidenceBlock,
  OperatorEvidenceFieldRow,
  OperatorEvidenceStack,
  OperatorEvidenceStatus,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStatusBadge
} from "@/design-system";

export interface ResearchFindingClusterField {
  label: string;
  value: string;
}

export interface ResearchFindingClusterEntry {
  id: string;
  title: string;
  value: string;
  detail: string;
  fields: ResearchFindingClusterField[];
  boundaryFields: ResearchFindingClusterField[];
}

export function ResearchFindingClustersSection({
  entries
}: {
  entries: ResearchFindingClusterEntry[];
}) {
  return (
    <OperatorPanel aria-label="Finding clusters">
      <OperatorSectionHeader
        eyebrow="Finding clusters"
        title="Research learning clusters"
        description="CandidateArena findings grouped for next-generation research. These clusters are read-only and do not replace paper qualification or promotion authority."
        actions={<OperatorStatusBadge value="not_promotion_authority" variant="secondary" />}
      />
      <OperatorEvidenceStack>
        {entries.map((entry) => (
          <OperatorEvidenceBlock key={entry.id} title={entry.title}>
            <OperatorEvidenceStatus
              label="Finding cluster"
              value={entry.value}
              detail={entry.detail}
              tone="neutral"
            />
            <OperatorEvidenceFieldRow fields={entry.fields} layout="mobileContained" />
            <OperatorEvidenceFieldRow fields={entry.boundaryFields} layout="mobileContained" />
          </OperatorEvidenceBlock>
        ))}
      </OperatorEvidenceStack>
    </OperatorPanel>
  );
}
