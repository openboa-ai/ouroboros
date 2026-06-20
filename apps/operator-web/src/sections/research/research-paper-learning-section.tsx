import { Badge } from "@/components/ui/badge";
import {
  OPERATOR_DESIGN_TOKENS,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
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
      <div className="grid min-w-0 gap-3">
        <p className={OPERATOR_DESIGN_TOKENS.typography.detail}>{summary}</p>
        <dl className={OPERATOR_DESIGN_TOKENS.layout.denseFieldGrid}>
          {fields.map((field) => (
            <OperatorField key={field.label} label={field.label} value={field.value} />
          ))}
        </dl>
      </div>
    </OperatorPanel>
  );
}
