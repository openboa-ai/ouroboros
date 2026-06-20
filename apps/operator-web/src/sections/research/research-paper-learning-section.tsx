import { Badge } from "@/components/ui/badge";
import {
  OperatorDetailText,
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSectionStack
} from "@/design-system";

export interface ResearchPaperLearningField {
  label: string;
  value: string;
}

export function ResearchPaperLearningSection({
  authorityStatus,
  summary,
  fields
}: {
  authorityStatus: string;
  summary: string;
  fields: ResearchPaperLearningField[];
}) {
  return (
    <OperatorPanel aria-label="Paper evidence learning">
      <OperatorSectionHeader
        eyebrow="Paper evidence learning"
        title="Next research focus"
        description="Paper-board evidence guides the next ResearchWorker without replacing qualification or promotion authority."
        actions={<Badge variant="secondary">{authorityStatus}</Badge>}
      />
      <OperatorSectionStack>
        <OperatorDetailText>{summary}</OperatorDetailText>
        <OperatorFieldGrid density="dense">
          {fields.map((field) => (
            <OperatorField key={field.label} label={field.label} value={field.value} />
          ))}
        </OperatorFieldGrid>
      </OperatorSectionStack>
    </OperatorPanel>
  );
}
