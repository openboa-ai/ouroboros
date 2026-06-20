import {
  OperatorEmptyState,
  OperatorEvidenceBlock,
  OperatorEvidenceRow,
  OperatorEvidenceStack,
  OperatorEvidenceStatus,
  OperatorField,
  OperatorPanel,
  OperatorSectionHeader
} from "@/design-system";

export type ArenaPaperBoardTone = "neutral" | "counted" | "failed" | "sealed";

export interface ArenaPaperBoardEntry {
  evaluationId: string;
  displayName: string;
  rankLabel: string;
  status: string;
  qualificationStatus: string;
  tone: ArenaPaperBoardTone;
  paperNet: string;
  paperReturn: string;
  trend: string;
  blockerDensity: string;
  evidenceWindow: string;
  qualificationReasons: string;
  promotionGate: string;
  runnerStatus: string;
  observationCount: string;
  marketProvenance: string;
  fillQuality: string;
}

export function ArenaPaperBoardSection({
  entries
}: {
  entries: ArenaPaperBoardEntry[];
}) {
  return (
    <OperatorPanel aria-label="Paper trading board" data-operator-section="arena-paper-board">
      <OperatorSectionHeader
        title="Paper Board"
        description="product authority: continuous paper trading"
      />
      {entries.length ? (
        <OperatorEvidenceStack className={entries.length > 1 ? "md:grid-cols-2" : undefined}>
          {entries.map((entry) => (
            <OperatorEvidenceBlock title={entry.displayName} key={entry.evaluationId}>
              <OperatorEvidenceStatus
                label={entry.rankLabel}
                value={entry.status}
                detail={entry.qualificationStatus}
                tone={entry.tone}
              />
              <OperatorEvidenceRow>
                <OperatorField label="Paper net" value={entry.paperNet} />
                <OperatorField label="Paper return" value={entry.paperReturn} />
                <OperatorField label="Trend" value={entry.trend} />
                <OperatorField label="Blocker density" value={entry.blockerDensity} />
              </OperatorEvidenceRow>
              <OperatorEvidenceRow>
                <OperatorField label="Qualification" value={entry.qualificationStatus} />
                <OperatorField label="Evidence window" value={entry.evidenceWindow} />
                <OperatorField label="Qualification reasons" value={entry.qualificationReasons} />
                <OperatorField label="Promotion gate" value={entry.promotionGate} />
              </OperatorEvidenceRow>
              <OperatorEvidenceRow>
                <OperatorField label="Paper runner" value={entry.runnerStatus} />
                <OperatorField label="Paper observations" value={entry.observationCount} />
                <OperatorField label="Market provenance" value={entry.marketProvenance} />
                <OperatorField label="Fill quality" value={entry.fillQuality} />
              </OperatorEvidenceRow>
            </OperatorEvidenceBlock>
          ))}
        </OperatorEvidenceStack>
      ) : (
        <OperatorEmptyState
          title="No paper evaluations yet"
          description="Select a candidate and start paper trading to create product evidence."
          detail="not_live"
        />
      )}
    </OperatorPanel>
  );
}
