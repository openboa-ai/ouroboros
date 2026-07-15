import {
  DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY as DOMAIN_DEFAULT_QUALIFICATION_POLICY,
  decidePaperTradingQualification,
  paperTradingEvidenceIntegrityReasons as domainPaperTradingEvidenceIntegrityReasons,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type PaperTradingQualificationPolicy as DomainPaperTradingQualificationPolicy,
  type PaperTradingQualificationReason,
  type PaperTradingQualificationResult as DomainPaperTradingQualificationResult
} from "@ouroboros/domain";
import { paperTradingEvaluationCommitmentDigest } from "./commitment";

export type PaperTradingQualificationPolicy = DomainPaperTradingQualificationPolicy;
export type PaperTradingQualificationResult = DomainPaperTradingQualificationResult;

export const DEFAULT_PAPER_TRADING_QUALIFICATION_POLICY =
  DOMAIN_DEFAULT_QUALIFICATION_POLICY;

interface PaperTradingEvidenceIntegrityInput {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
}

export function paperTradingEvidenceIntegrityReasons(
  input: PaperTradingEvidenceIntegrityInput
): PaperTradingQualificationReason[] {
  return domainPaperTradingEvidenceIntegrityReasons({
    ...input,
    commitmentDigestVerified: paperTradingCommitmentDigestVerified(input.commitment)
  });
}

export function qualifyPaperTradingEvaluation(input: {
  evaluation: PaperTradingEvaluationRecord;
  commitment?: PaperTradingEvaluationCommitmentRecord;
  observations: PaperTradingObservationRecord[];
  runnerActive: boolean;
  policy?: Partial<PaperTradingQualificationPolicy>;
}): PaperTradingQualificationResult {
  return decidePaperTradingQualification({
    ...input,
    commitmentDigestVerified: paperTradingCommitmentDigestVerified(input.commitment)
  });
}

function paperTradingCommitmentDigestVerified(
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): boolean {
  if (!commitment) return false;
  try {
    return commitment.commitment_digest === paperTradingEvaluationCommitmentDigest(commitment);
  } catch {
    return false;
  }
}
