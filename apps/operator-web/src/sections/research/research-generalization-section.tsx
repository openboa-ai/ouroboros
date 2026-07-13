import {
  OperatorDetailText,
  OperatorEmptyState,
  OperatorEvidenceFieldRow,
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSectionStack,
  OperatorStatusBadge
} from "@/design-system";

export interface ResearchGeneralizationSectionModel {
  status: string;
  protocolCount: string;
  outcomeCount: string;
  authorityStatus: string;
  active: {
    protocolId: string;
    committedAt: string;
    collectionDeadlineAt: string;
    assignedProgress: string;
    terminalProgress: string;
    nextAction: string;
    authorityStatus: string;
    conditionBlocks: Array<{ label: string; value: string }>;
  } | null;
  latest: {
    inference: string;
    adjudicatedAt: string;
    studyOutcomes: string;
    signEvidence: string;
    equalWeightMean: string;
    distinctBaselines: string;
    harmfulBlocks: string;
    policyDecisionEligibility: string;
    nextAction: string;
    authority: string;
  } | null;
}

export function ResearchGeneralizationSection({
  model
}: {
  model: ResearchGeneralizationSectionModel;
}) {
  const { active, latest } = model;

  return (
    <OperatorPanel aria-label="Research generalization">
      <OperatorSectionHeader
        eyebrow="Prospective protocol"
        title="Research generalization"
        description="Precommitted study progress and adjudicated out-of-sample evidence."
        actions={(
          <OperatorStatusBadge
            value={model.authorityStatus}
            variant="secondary"
          />
        )}
      />
      {!active && !latest ? (
        <OperatorEmptyState
          title="No research generalization protocol"
          description="No prospective protocol has been committed."
          detail={model.status}
        />
      ) : (
        <OperatorSectionStack>
          <OperatorFieldGrid density="dense">
            <OperatorField label="Lifecycle" value={model.status} />
            <OperatorField label="Protocols" value={model.protocolCount} />
            <OperatorField label="Outcomes" value={model.outcomeCount} />
          </OperatorFieldGrid>

          {active && (
            <>
              <OperatorDetailText>Active protocol</OperatorDetailText>
              <OperatorFieldGrid density="dense">
                <OperatorField
                  label="Protocol"
                  value={active.protocolId}
                />
                <OperatorField label="Committed" value={active.committedAt} />
                <OperatorField label="Collection deadline" value={active.collectionDeadlineAt} />
                <OperatorField
                  label="Assigned progress"
                  value={active.assignedProgress}
                />
                <OperatorField
                  label="Terminal progress"
                  value={active.terminalProgress}
                />
                <OperatorField label="Next action" value={active.nextAction} />
                <OperatorField label="Protocol authority" value={active.authorityStatus} />
              </OperatorFieldGrid>
              <OperatorEvidenceFieldRow
                aria-label="Research generalization condition blocks"
                layout="mobileContained"
                fields={active.conditionBlocks}
              />
            </>
          )}

          {latest && (
            <>
              <OperatorDetailText>Latest outcome</OperatorDetailText>
              <OperatorFieldGrid density="dense">
                <OperatorField label="Inference" value={latest.inference} />
                <OperatorField label="Adjudicated" value={latest.adjudicatedAt} />
                <OperatorField
                  label="Study outcomes"
                  value={latest.studyOutcomes}
                />
                <OperatorField
                  label="Sign evidence"
                  value={latest.signEvidence}
                />
                <OperatorField
                  label="Equal-weight mean"
                  value={latest.equalWeightMean}
                />
                <OperatorField
                  label="Distinct baselines"
                  value={latest.distinctBaselines}
                />
                <OperatorField
                  label="Harmful blocks"
                  value={latest.harmfulBlocks}
                />
                <OperatorField
                  label="Policy decision eligibility"
                  value={latest.policyDecisionEligibility}
                />
                <OperatorField label="Outcome next action" value={latest.nextAction} />
                <OperatorField
                  label="Outcome authority"
                  value={latest.authority}
                />
              </OperatorFieldGrid>
            </>
          )}
        </OperatorSectionStack>
      )}
    </OperatorPanel>
  );
}
