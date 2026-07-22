import { createHash } from "node:crypto";
import {
  canonicalResearchEvidenceArtifactSummary,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  researchEvidenceArtifactDigestInput,
  sanitizeResearchEvidenceText,
  type ArenaOperationsReadModel,
  type ArenaTradingSystemDetailReadModel,
  type ArenaTradingSystemSummaryReadModel,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingObservationRecord,
  type Ref,
  type ResearchEvidenceArtifactRecord,
  type ResearchFindingRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";

const MAX_ARENA_SYSTEMS = 12;
const MAX_TRACE_EVENTS_PER_SYSTEM = 20;
const MAX_RESEARCH_FINDINGS = 12;
const MAX_EVIDENCE_ARTIFACTS = 24;
const SANITIZER_TEXT_LIMIT = 500;

type ResearchEvidenceStore = Pick<
  OuroborosStorePort,
  "getPaperTradingEvaluation" | "getPaperTradingEvaluationCommitment" |
  "getTradingRun" | "listPaperTradingObservations" | "listResearchFindings"
>;

type ArenaOperationsEvidenceSource = {
  readOperations(): Promise<ArenaOperationsReadModel>;
  readSystemDetail(
    candidateId: string
  ): Promise<ArenaTradingSystemDetailReadModel | undefined>;
};

export interface ResearchEvidenceArtifactServiceOptions {
  store: ResearchEvidenceStore;
  arenaOperations: ArenaOperationsEvidenceSource;
}

export class ResearchEvidenceArtifactService {
  constructor(
    private readonly options: ResearchEvidenceArtifactServiceOptions
  ) {}

  async collect(): Promise<ResearchEvidenceArtifactRecord[]> {
    const [operations, findings] = await Promise.all([
      this.options.arenaOperations.readOperations(),
      this.options.store.listResearchFindings()
    ]);
    const systems = [...operations.systems]
      .sort(compareArenaSystemsByRecency)
      .slice(0, MAX_ARENA_SYSTEMS);
    const sources = await Promise.all(systems.map(async (system) => {
      const evaluation = system.evaluation_id
        ? await this.options.store.getPaperTradingEvaluation(
            system.evaluation_id
          )
        : undefined;
      const commitmentId = evaluation
        ?.paper_trading_evaluation_commitment_ref?.id;
      return {
        detail: await this.options.arenaOperations.readSystemDetail(
          system.candidate_id
        ),
        evaluation,
        commitment: commitmentId
          ? await this.options.store.getPaperTradingEvaluationCommitment(
              commitmentId
            )
          : undefined,
        observations: system.evaluation_id
          ? await this.options.store.listPaperTradingObservations(
              system.evaluation_id
            )
          : [],
        tradingRun: system.trading_run_id
          ? await this.options.store.getTradingRun(system.trading_run_id)
          : undefined
      };
    }));
    const artifacts: ResearchEvidenceArtifactRecord[] = [];
    for (let index = 0; index < systems.length; index += 1) {
      const system = systems[index]!;
      const source = sources[index]!;
      artifacts.push(...paperResultArtifacts(
        system,
        source.evaluation,
        source.commitment
      ));
      artifacts.push(...failureArtifacts(
        system,
        source.evaluation,
        source.commitment
      ));
      if (source.detail && source.tradingRun) {
        artifacts.push(...traceArtifacts(
          system,
          source.detail,
          source.tradingRun,
          source.observations,
          source.commitment
        ));
      }
    }
    artifacts.push(...[...findings]
      .sort((left, right) =>
        right.created_at.localeCompare(left.created_at) ||
        left.research_finding_id.localeCompare(right.research_finding_id)
      )
      .slice(0, MAX_RESEARCH_FINDINGS)
      .map(findingArtifact));
    return artifacts
      .sort((left, right) =>
        right.captured_at.localeCompare(left.captured_at) ||
        left.source_kind.localeCompare(right.source_kind) ||
        left.research_evidence_artifact_id.localeCompare(
          right.research_evidence_artifact_id
        )
      )
      .slice(0, MAX_EVIDENCE_ARTIFACTS);
  }
}

function paperResultArtifacts(
  system: ArenaTradingSystemSummaryReadModel,
  evaluation: Awaited<ReturnType<ResearchEvidenceStore[
    "getPaperTradingEvaluation"
  ]>>,
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): ResearchEvidenceArtifactRecord[] {
  if (!system.evaluation_id || !evaluation ||
    !releasedResearchFeedbackCommitment(system, evaluation, commitment) ||
    evaluation.paper_trading_evaluation_id !== system.evaluation_id ||
    evaluation.candidate_ref.id !== system.candidate_id ||
    evaluation.candidate_version_ref.id !== system.candidate_version_id ||
    evaluation.trading_run_ref.id !== system.trading_run_id) {
    return [];
  }
  const capturedAt = evaluation.last_observed_at ?? evaluation.stopped_at ??
    evaluation.started_at;
  const summary = sanitizeSummary(canonicalResearchEvidenceArtifactSummary(
    "arena_paper_result",
    evaluation
  ));
  return [buildArtifact({
    sourceKind: "arena_paper_result",
    subjectRef: ref("trading_system_candidate", system.candidate_id),
    artifactRef: ref("paper_trading_evaluation", system.evaluation_id),
    source: evaluation,
    summary: summary.value,
    supportingRecordRefs: system.trading_run_id
      ? [ref("trading_run", system.trading_run_id)]
      : [],
    capturedAt,
    truncated: summary.truncated
  })];
}

function failureArtifacts(
  system: ArenaTradingSystemSummaryReadModel,
  evaluation: Awaited<ReturnType<ResearchEvidenceStore[
    "getPaperTradingEvaluation"
  ]>>,
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): ResearchEvidenceArtifactRecord[] {
  if (!system.evaluation_id || !evaluation ||
    !releasedResearchFeedbackCommitment(system, evaluation, commitment) ||
    evaluation.paper_trading_evaluation_id !== system.evaluation_id ||
    evaluation.candidate_ref.id !== system.candidate_id ||
    evaluation.candidate_version_ref.id !== system.candidate_version_id ||
    evaluation.trading_run_ref.id !== system.trading_run_id ||
    !evaluation.latest_failure_reason?.trim()) {
    return [];
  }
  const capturedAt = evaluation.last_observed_at ?? evaluation.stopped_at ??
    evaluation.started_at;
  const summary = sanitizeSummary(canonicalResearchEvidenceArtifactSummary(
    "arena_failure",
    evaluation
  ));
  return [buildArtifact({
    sourceKind: "arena_failure",
    subjectRef: ref("trading_system_candidate", system.candidate_id),
    artifactRef: ref("paper_trading_evaluation", system.evaluation_id),
    source: evaluation,
    summary: summary.value,
    supportingRecordRefs: system.trading_run_id
      ? [ref("trading_run", system.trading_run_id)]
      : [],
    capturedAt,
    truncated: summary.truncated
  })];
}

function traceArtifacts(
  system: ArenaTradingSystemSummaryReadModel,
  detail: ArenaTradingSystemDetailReadModel,
  tradingRun: Awaited<ReturnType<ResearchEvidenceStore["getTradingRun"]>>,
  observations: PaperTradingObservationRecord[],
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): ResearchEvidenceArtifactRecord[] {
  if (!system.trading_run_id || !tradingRun ||
    tradingRun.trading_run_id !== system.trading_run_id ||
    tradingRun.candidate_ref?.id !== system.candidate_id ||
    !system.evaluation_id ||
    !releasedResearchFeedbackCommitment(system, undefined, commitment) ||
    detail.trace_events.length === 0) {
    return [];
  }
  const selected = detail.trace_events.slice(-MAX_TRACE_EVENTS_PER_SYSTEM);
  const traceTruncated = detail.trace_truncated ||
    detail.trace_events.length > selected.length;
  const selectedObservationIds = new Set(selected.flatMap((event) =>
    event.record_ref?.record_kind === "paper_trading_observation"
      ? [event.record_ref.id]
      : []
  ));
  return observations.flatMap((observation) => {
    if (!selectedObservationIds.has(observation.paper_trading_observation_id) ||
      observation.paper_trading_evaluation_ref.id !== system.evaluation_id ||
      observation.paper_trading_evaluation_commitment_ref?.id !==
        commitment?.paper_trading_evaluation_commitment_id ||
      observation.candidate_ref.id !== system.candidate_id ||
      observation.candidate_version_ref.id !== system.candidate_version_id ||
      observation.trading_run_ref.id !== system.trading_run_id) {
      return [];
    }
    const summary = sanitizeSummary(canonicalResearchEvidenceArtifactSummary(
      "arena_trace",
      observation
    ));
    return [buildArtifact({
      sourceKind: "arena_trace",
      subjectRef: ref("trading_system_candidate", system.candidate_id),
      artifactRef: ref(
        "paper_trading_observation",
        observation.paper_trading_observation_id
      ),
      source: observation,
      summary: summary.value,
      supportingRecordRefs: [
        ref("trading_run", system.trading_run_id),
        ref("paper_trading_evaluation", system.evaluation_id),
        ref(
          "paper_trading_evaluation_commitment",
          commitment!.paper_trading_evaluation_commitment_id
        )
      ],
      capturedAt: observation.observed_at,
      truncated: traceTruncated || summary.truncated
    })];
  });
}

function releasedResearchFeedbackCommitment(
  system: ArenaTradingSystemSummaryReadModel,
  evaluation: Awaited<ReturnType<ResearchEvidenceStore[
    "getPaperTradingEvaluation"
  ]>> | undefined,
  commitment: PaperTradingEvaluationCommitmentRecord | undefined
): commitment is PaperTradingEvaluationCommitmentRecord {
  if (!commitment || commitment.evidence_purpose !== "research_feedback" ||
    commitment.window_policy.release_policy !== "closed_observation" ||
    commitment.commitment_digest !== sha256(
      paperTradingEvaluationCommitmentDigestInput(commitment)
    ) || commitment.candidate_ref.id !== system.candidate_id ||
    commitment.candidate_version_ref.id !== system.candidate_version_id ||
    commitment.trading_run_ref.id !== system.trading_run_id) {
    return false;
  }
  return !evaluation || (
    evaluation.paper_trading_evaluation_commitment_ref?.id ===
      commitment.paper_trading_evaluation_commitment_id &&
    evaluation.candidate_ref.id === commitment.candidate_ref.id &&
    evaluation.candidate_version_ref.id === commitment.candidate_version_ref.id &&
    evaluation.trading_run_ref.id === commitment.trading_run_ref.id
  );
}

function findingArtifact(
  finding: ResearchFindingRecord
): ResearchEvidenceArtifactRecord {
  const summary = sanitizeSummary(canonicalResearchEvidenceArtifactSummary(
    "research_finding",
    finding
  ));
  return buildArtifact({
    sourceKind: "research_finding",
    subjectRef: finding.research_worker_ref,
    artifactRef: ref("research_finding", finding.research_finding_id),
    source: finding,
    summary: summary.value,
    supportingRecordRefs: uniqueRefs([
      finding.research_direction_ref,
      finding.experiment_run_ref,
      finding.trading_evaluation_result_ref,
      ...finding.supporting_record_refs
    ]),
    capturedAt: finding.created_at,
    truncated: summary.truncated
  });
}

function buildArtifact(input: {
  sourceKind: ResearchEvidenceArtifactRecord["source_kind"];
  subjectRef: Ref;
  artifactRef: Ref;
  source: unknown;
  summary: string;
  supportingRecordRefs: Ref[];
  capturedAt: string;
  truncated: boolean;
}): ResearchEvidenceArtifactRecord {
  const sourceDigest = sha256(
    paperTradingComparisonPersistedRecordDigestInput(input.source)
  );
  const artifact: ResearchEvidenceArtifactRecord = {
    record_kind: "research_evidence_artifact",
    version: 1,
    research_evidence_artifact_id: [
      "research-evidence",
      safeId(input.sourceKind),
      safeId(input.artifactRef.id),
      sourceDigest.slice(-16)
    ].join("-"),
    source_kind: input.sourceKind,
    subject_ref: input.subjectRef,
    artifact_ref: input.artifactRef,
    source_digest: sourceDigest,
    summary: input.summary,
    supporting_record_refs: uniqueRefs(input.supportingRecordRefs),
    captured_at: input.capturedAt,
    sanitization_policy: "research_evidence_sanitization_v1",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    secrets_removed: true,
    host_paths_removed: true,
    truncated: input.truncated,
    artifact_digest: "",
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  artifact.artifact_digest = sha256(
    researchEvidenceArtifactDigestInput(artifact)
  );
  return artifact;
}

function compareArenaSystemsByRecency(
  left: ArenaTradingSystemSummaryReadModel,
  right: ArenaTradingSystemSummaryReadModel
): number {
  const leftAt = left.last_observed_at ?? left.stopped_at ?? left.started_at ??
    left.queued_at;
  const rightAt = right.last_observed_at ?? right.stopped_at ??
    right.started_at ?? right.queued_at;
  return rightAt.localeCompare(leftAt) ||
    left.candidate_id.localeCompare(right.candidate_id);
}

function sanitizeSummary(value: string): { value: string; truncated: boolean } {
  const sanitized = sanitizeResearchEvidenceText(value);
  const limited = sanitized.length <= SANITIZER_TEXT_LIMIT
    ? sanitized
    : `${sanitized.slice(0, SANITIZER_TEXT_LIMIT)}...`;
  return {
    value: limited,
    truncated: sanitized.length > SANITIZER_TEXT_LIMIT
  };
}

function uniqueRefs(refs: Ref[]): Ref[] {
  const byIdentity = new Map<string, Ref>();
  for (const reference of refs) {
    byIdentity.set(`${reference.record_kind}:${reference.id}`, reference);
  }
  return [...byIdentity.values()];
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
