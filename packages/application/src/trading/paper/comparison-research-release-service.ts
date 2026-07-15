import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonResearchReleaseDigestInput,
  paperTradingComparisonResearchReleaseHasRuntimeShape,
  type ArtifactLineageRecord,
  type PaperTradingComparisonResearchReleaseRecord,
  type Ref,
  type ResearchFindingRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { decidePaperTradingComparisonResearchRelease } from
  "./comparison-research-release-decision";

export type PaperTradingComparisonResearchReleaseServiceErrorCode =
  | "invalid_paper_trading_comparison_research_release_input"
  | "paper_trading_comparison_research_release_reference_not_found"
  | "paper_trading_comparison_research_release_graph_invalid"
  | "paper_trading_comparison_research_release_persistence_conflict";

export class PaperTradingComparisonResearchReleaseServiceError extends Error {
  constructor(
    readonly code: PaperTradingComparisonResearchReleaseServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PaperTradingComparisonResearchReleaseServiceError";
  }
}

export class PaperTradingComparisonResearchReleaseService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async release(input: {
    campaignOutcomeId: string;
  }): Promise<PaperTradingComparisonResearchReleaseRecord> {
    const campaignOutcomeId = normalizeId(input?.campaignOutcomeId);
    const releaseId = `${campaignOutcomeId}-research-release`;
    try {
      const existing = await this.options.store
        .getPaperTradingComparisonResearchRelease(releaseId);
      if (existing) {
        if (!paperTradingComparisonResearchReleaseHasRuntimeShape(existing) ||
          existing.campaign_outcome_ref.id !== campaignOutcomeId) {
          throw graphInvalid();
        }
        return existing;
      }

      const outcome = await this.options.store
        .getPaperTradingComparisonConfirmationCampaignOutcome(campaignOutcomeId);
      if (!outcome) throw referenceNotFound();
      if (!paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(outcome) ||
        outcome.paper_trading_comparison_confirmation_campaign_outcome_id !==
          campaignOutcomeId) {
        throw graphInvalid();
      }
      const campaign = await this.options.store
        .getPaperTradingComparisonConfirmationCampaign(outcome.campaign_ref.id);
      if (!campaign) throw referenceNotFound();
      if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(campaign) ||
        campaign.paper_trading_comparison_confirmation_campaign_id !==
          outcome.campaign_ref.id || campaign.campaign_digest !==
          outcome.campaign_digest) {
        throw graphInvalid();
      }

      const [admission, findings, lineages, candidate, candidateVersion, systemCode] =
        await Promise.all([
          this.options.store.getCandidateAdmissionDecision(
            campaign.challenger.candidate_admission_decision_ref.id
          ),
          this.options.store.listResearchFindings(),
          this.options.store.listArtifactLineages(),
          this.options.store.getCandidate(campaign.challenger.candidate_ref.id),
          this.options.store.getCandidateVersion(
            campaign.challenger.candidate_version_ref.id
          ),
          this.options.store.getSystemCode(campaign.challenger.system_code_ref.id)
        ]);
      if (!admission || !candidate || !candidateVersion || !systemCode ||
        !Array.isArray(findings) || !Array.isArray(lineages)) {
        throw referenceNotFound();
      }
      const sourceFinding = findings.find((finding) =>
        finding?.research_finding_id === admission.research_finding_ref?.id);
      if (!sourceFinding) throw referenceNotFound();
      if (!researchFindingHasReleaseSourceShape(sourceFinding)) throw graphInvalid();

      const sourceLineages = lineages.filter((lineage) =>
        artifactLineageHasReleaseSourceShape(lineage) &&
        lineage.child_system_code_ref.id === campaign.challenger.system_code_ref.id &&
        lineage.source_finding_refs.some((ref) =>
          paperTradingComparisonRefsEqual(ref, {
            record_kind: "research_finding",
            id: sourceFinding.research_finding_id
          })) && Date.parse(lineage.created_at) <= Date.parse(admission.decided_at)
      );
      if (sourceLineages.length !== 1) throw graphInvalid();
      const sourceLineage = sourceLineages[0]!;
      const fullCycle = candidate.full_cycle_lineage;
      const directionKind = fullCycle?.evidence?.direction_kind;
      if (admission.status !== "admitted" ||
        admission.runnable_paper_handoff !== true ||
        admission.system_code_ref.id !== campaign.challenger.system_code_ref.id ||
        admission.submitted_artifact_digest !==
          campaign.challenger.system_code_artifact_digest ||
        admission.experiment_run_ref.id !== sourceFinding.experiment_run_ref.id ||
        admission.trading_evaluation_result_ref.id !==
          sourceFinding.trading_evaluation_result_ref.id ||
        Date.parse(sourceFinding.created_at) > Date.parse(admission.decided_at) ||
        sourceLineage.parent_system_code_ref?.id !==
          admission.source_system_code_ref.id ||
        sourceLineage.created_by_research_worker_ref !== undefined &&
          !paperTradingComparisonRefsEqual(
            sourceLineage.created_by_research_worker_ref,
            sourceFinding.research_worker_ref
          ) || candidate.candidate_id !== campaign.challenger.candidate_ref.id ||
        candidate.candidate_version.candidate_version_id !==
          campaign.challenger.candidate_version_ref.id ||
        candidate.system_code?.ref?.id !== campaign.challenger.system_code_ref.id ||
        candidateVersion.candidate_version_id !==
          campaign.challenger.candidate_version_ref.id ||
        candidateVersion.system_code_ref?.id !== campaign.challenger.system_code_ref.id ||
        systemCode.system_code_id !== campaign.challenger.system_code_ref.id ||
        systemCode.artifact_digest !== campaign.challenger.system_code_artifact_digest ||
        fullCycle?.handoff_status !== "runnable" || !fullCycle.generated ||
        fullCycle.generated.system_code_ref.id !==
          campaign.challenger.system_code_ref.id ||
        fullCycle.generated.artifact_digest !==
          campaign.challenger.system_code_artifact_digest ||
        fullCycle.source.system_code_ref?.id !== admission.source_system_code_ref.id ||
        !directionKind) {
        throw graphInvalid();
      }

      const releasedAt = exactNow(this.now);
      if (Date.parse(releasedAt) <= Date.parse(outcome.evaluated_at)) {
        throw invalidInput("Research release clock must follow the campaign outcome.");
      }
      const decision = decidePaperTradingComparisonResearchRelease(outcome);
      const findingId = `${releaseId}-finding`;
      const lineageId = `${releaseId}-lineage`;
      const finding: ResearchFindingRecord = {
        record_kind: "research_finding",
        version: 1,
        research_finding_id: findingId,
        research_worker_ref: { ...sourceFinding.research_worker_ref },
        research_direction_ref: { ...sourceFinding.research_direction_ref },
        experiment_run_ref: { ...sourceFinding.experiment_run_ref },
        trading_evaluation_result_ref: {
          ...sourceFinding.trading_evaluation_result_ref
        },
        finding_kind: decision.finding_kind,
        summary: decision.summary,
        supporting_record_refs: [
          { record_kind: "research_finding", id: sourceFinding.research_finding_id },
          {
            record_kind: "paper_trading_comparison_confirmation_campaign",
            id: campaign.paper_trading_comparison_confirmation_campaign_id
          },
          {
            record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
            id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
          },
          ...outcome.slot_results.flatMap((result) => result.verdict_ref
            ? [{ ...result.verdict_ref }]
            : [])
        ],
        created_at: releasedAt,
        authority_status: "research_trace_only"
      };
      const lineage: ArtifactLineageRecord = {
        record_kind: "artifact_lineage",
        version: 1,
        artifact_lineage_id: lineageId,
        child_system_code_ref: { ...sourceLineage.child_system_code_ref },
        ...(sourceLineage.parent_system_code_ref
          ? { parent_system_code_ref: { ...sourceLineage.parent_system_code_ref } }
          : {}),
        source_finding_refs: [
          ...sourceLineage.source_finding_refs.map((ref) => ({ ...ref })),
          { record_kind: "research_finding", id: findingId }
        ],
        created_by_research_worker_ref: { ...sourceFinding.research_worker_ref },
        created_at: releasedAt,
        authority_status: "lineage_only"
      };
      const release = withReleaseDigest({
        record_kind: "paper_trading_comparison_research_release",
        version: 1,
        paper_trading_comparison_research_release_id: releaseId,
        campaign_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign",
          id: campaign.paper_trading_comparison_confirmation_campaign_id
        },
        campaign_digest: campaign.campaign_digest,
        campaign_outcome_ref: {
          record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
          id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
        },
        campaign_outcome_digest: outcome.outcome_digest,
        candidate_ref: { ...campaign.challenger.candidate_ref },
        candidate_version_ref: { ...campaign.challenger.candidate_version_ref },
        system_code_ref: { ...campaign.challenger.system_code_ref },
        system_code_artifact_digest:
          campaign.challenger.system_code_artifact_digest,
        source_finding_ref: {
          record_kind: "research_finding",
          id: sourceFinding.research_finding_id
        },
        source_finding_record_digest: recordDigest(sourceFinding),
        source_lineage_ref: {
          record_kind: "artifact_lineage",
          id: sourceLineage.artifact_lineage_id
        },
        source_lineage_record_digest: recordDigest(sourceLineage),
        direction_kind: directionKind,
        release_kind: decision.release_kind,
        finding,
        finding_record_digest: recordDigest(finding),
        lineage,
        lineage_record_digest: recordDigest(lineage),
        next_research_focus: decision.next_research_focus,
        released_at: releasedAt,
        release_digest: "sha256:pending",
        research_visibility: "released_to_research",
        evaluation_authority: "external_to_trading_systems",
        promotion_authority: false,
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "lineage_only"
      });
      if (!paperTradingComparisonResearchReleaseHasRuntimeShape(release)) {
        throw graphInvalid();
      }
      const recorded = await this.options.store
        .recordPaperTradingComparisonResearchRelease(release);
      if (!paperTradingComparisonResearchReleaseHasRuntimeShape(recorded) ||
        !isDeepStrictEqual(recorded, release)) {
        throw new PaperTradingComparisonResearchReleaseServiceError(
          "paper_trading_comparison_research_release_persistence_conflict",
          "Store did not preserve the exact research release bundle."
        );
      }
      return recorded;
    } catch (error) {
      if (error instanceof PaperTradingComparisonResearchReleaseServiceError) {
        throw error;
      }
      throw graphInvalid();
    }
  }
}

function withReleaseDigest(
  release: PaperTradingComparisonResearchReleaseRecord
): PaperTradingComparisonResearchReleaseRecord {
  return {
    ...release,
    release_digest: digest(
      paperTradingComparisonResearchReleaseDigestInput(release)
    )
  };
}

function recordDigest(record: unknown): string {
  return digest(paperTradingComparisonPersistedRecordDigestInput(record));
}

function digest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function researchFindingHasReleaseSourceShape(
  value: unknown
): value is ResearchFindingRecord {
  if (!value || typeof value !== "object") return false;
  const finding = value as Partial<ResearchFindingRecord>;
  return finding.record_kind === "research_finding" && finding.version === 1 &&
    nonEmpty(finding.research_finding_id) &&
    refHasKind(finding.research_worker_ref, "research_worker") &&
    refHasKind(finding.research_direction_ref, "research_direction") &&
    refHasKind(finding.experiment_run_ref, "experiment_run") &&
    refHasKind(
      finding.trading_evaluation_result_ref,
      "trading_evaluation_result"
    ) && nonEmpty(finding.created_at) &&
    finding.authority_status === "research_trace_only";
}

function artifactLineageHasReleaseSourceShape(
  value: unknown
): value is ArtifactLineageRecord {
  if (!value || typeof value !== "object") return false;
  const lineage = value as Partial<ArtifactLineageRecord>;
  return lineage.record_kind === "artifact_lineage" && lineage.version === 1 &&
    nonEmpty(lineage.artifact_lineage_id) &&
    refHasKind(lineage.child_system_code_ref, "system_code") &&
    (lineage.parent_system_code_ref === undefined ||
      refHasKind(lineage.parent_system_code_ref, "system_code")) &&
    Array.isArray(lineage.source_finding_refs) &&
    lineage.source_finding_refs.length > 0 &&
    lineage.source_finding_refs.every((ref) =>
      refHasKind(ref, "research_finding")) && nonEmpty(lineage.created_at) &&
    lineage.authority_status === "lineage_only";
}

function refHasKind(value: unknown, kind: string): value is Ref {
  return Boolean(value) && typeof value === "object" &&
    (value as Ref).record_kind === kind && nonEmpty((value as Ref).id);
}

function normalizeId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput("Campaign outcome ID is required.");
  }
  return value.trim();
}

function exactNow(now: () => string): string {
  const value = now();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw invalidInput("Research release clock must be an exact ISO timestamp.");
  }
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidInput(
  message: string
): PaperTradingComparisonResearchReleaseServiceError {
  return new PaperTradingComparisonResearchReleaseServiceError(
    "invalid_paper_trading_comparison_research_release_input",
    message
  );
}

function referenceNotFound(): PaperTradingComparisonResearchReleaseServiceError {
  return new PaperTradingComparisonResearchReleaseServiceError(
    "paper_trading_comparison_research_release_reference_not_found",
    "Paper comparison research release provenance was not found."
  );
}

function graphInvalid(): PaperTradingComparisonResearchReleaseServiceError {
  return new PaperTradingComparisonResearchReleaseServiceError(
    "paper_trading_comparison_research_release_graph_invalid",
    "Paper comparison research release provenance is inconsistent."
  );
}
