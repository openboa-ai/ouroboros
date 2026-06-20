import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorEvidenceBlock,
  OperatorEvidenceStack,
  OperatorEvidenceStatus,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

const MOBILE_STACKED_FIELD_GRID = [
  "grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] gap-2",
  "[overflow-wrap:anywhere]",
  "[&>*]:min-w-0 [&>*]:max-w-full [&>*]:break-words",
  "sm:grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]"
].join(" ");
const MOBILE_FIELD_CLAMP = "w-full max-w-[calc(100vw-4.5rem)] sm:max-w-full";

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
        actions={<Badge variant="secondary">not_promotion_authority</Badge>}
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
            <div
              data-operator-ui="evidence-row"
              className={cn(OPERATOR_DESIGN_TOKENS.layout.evidenceStack, MOBILE_STACKED_FIELD_GRID)}
            >
              {entry.fields.map((field) => (
                <OperatorField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  className={MOBILE_FIELD_CLAMP}
                />
              ))}
            </div>
            <div
              data-operator-ui="evidence-row"
              className={cn(OPERATOR_DESIGN_TOKENS.layout.evidenceStack, MOBILE_STACKED_FIELD_GRID)}
            >
              {entry.boundaryFields.map((field) => (
                <OperatorField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  className={MOBILE_FIELD_CLAMP}
                />
              ))}
            </div>
          </OperatorEvidenceBlock>
        ))}
      </OperatorEvidenceStack>
    </OperatorPanel>
  );
}
