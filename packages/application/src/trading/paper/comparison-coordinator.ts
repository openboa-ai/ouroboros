import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  isCandidateAdmissionDecisionConsistent,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonPreparationHasRuntimeShape,
  paperTradingComparisonPolicyHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonSideRecordsHaveInertShape,
  paperTradingComparisonSideHasRuntimeShape,
  paperTradingComparisonStoppedQualificationClosureHasRuntimeShape,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTradingPromotionHasRuntimeShape,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingEvaluationCommitmentDigestInput,
  type CandidateAdmissionDecisionRecord,
  type CandidateInspectReadModel,
  type CandidateVersionRecord,
  type PaperTradingComparisonCandidateSide,
  type PaperTradingComparisonChampionSelection,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonPolicy,
  type PaperTradingComparisonPreparationRecord,
  type PaperTradingComparisonSide,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationPolicyIdentity,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type SystemCodeRecord,
  type TradingPromotionRecord,
  type TradingRunRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import { paperTradingComparisonIdsForIdempotencyKey } from "./comparison-identity";
import { qualifyPaperTradingEvaluation } from "./qualification";
import type { PaperTradingSessionService } from "./session-service";

export interface PaperTradingComparisonCandidateInput {
  candidateId: string;
  candidateVersionId: string;
  admissionDecisionId: string;
}

export interface PreparePaperTradingComparisonInput {
  idempotencyKey: string;
  champion: PaperTradingComparisonCandidateInput;
  challenger: PaperTradingComparisonCandidateInput;
  comparisonPolicy: PaperTradingComparisonPolicy;
  marketDataConfigurationDigest: string;
  paperPolicyIdentity: PaperTradingEvaluationPolicyIdentity;
}

export interface PreparedPaperTradingComparisonSide {
  side: PaperTradingComparisonSide;
  candidate: CandidateInspectReadModel;
  run: TradingRunRecord;
  systemCode: SystemCodeRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}

export interface PreparedPaperTradingComparison {
  preparation: PaperTradingComparisonPreparationRecord;
  commitment: PaperTradingComparisonCommitmentRecord;
  champion: PreparedPaperTradingComparisonSide;
  challenger: PreparedPaperTradingComparisonSide;
}

export interface VerifiedPaperTradingComparisonCommitmentGraph
  extends PreparedPaperTradingComparison {
  verification: {
    status: "verified";
    activation_authority: "not_granted";
  };
}

export interface PaperTradingComparisonCoordinatorOptions {
  store: OuroborosStorePort;
  sessions: Pick<PaperTradingSessionService, "prepare">;
  now?: () => string;
}

interface ValidatedComparisonCandidate {
  side: PaperTradingComparisonCandidateSide;
  candidateVersion: CandidateVersionRecord;
  admission: CandidateAdmissionDecisionRecord;
  systemCode: SystemCodeRecord;
}

export class PaperTradingComparisonError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonError";
  }
}

export class PaperTradingComparisonCoordinator {
  private readonly now: () => string;

  constructor(private readonly options: PaperTradingComparisonCoordinatorOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async prepare(
    input: PreparePaperTradingComparisonInput
  ): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
    if (!paperTradingComparisonPolicyHasRuntimeShape(input.comparisonPolicy)) {
      throw new PaperTradingComparisonError(
        "invalid_paper_trading_comparison_input",
        "Paper comparison policy has invalid runtime shape."
      );
    }
    if (input.champion.candidateVersionId === input.challenger.candidateVersionId) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_duplicate_candidate_version",
        "Champion and challenger CandidateVersions must be distinct."
      );
    }
    const ids = comparisonIds(input.idempotencyKey);
    let preparation = await this.options.store.getPaperTradingComparisonPreparation(
      ids.preparationId
    );
    if (preparation) {
      if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_graph_invalid",
          "Persisted paper comparison preparation has invalid runtime shape."
        );
      }
      this.assertRequestedPreparationIdentity(preparation, ids.commitmentId, input);
      await this.assertFrozenPreparationRecords(preparation);
      preparation = await this.options.store.reservePaperTradingComparisonPreparation(
        preparation
      );
      if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_graph_invalid",
          "Reserved paper comparison preparation has invalid runtime shape."
        );
      }
      const existingPair = await this.options.store.getPaperTradingComparisonCommitment(
        ids.commitmentId
      );
      if (existingPair) {
        const graph = await this.reload(ids.commitmentId);
        if (!graph) {
          throw new PaperTradingComparisonError(
            "paper_trading_comparison_reload_failed",
            "Persisted paper comparison commitment could not be reloaded."
          );
        }
        return graph;
      }
    } else {
      const committedAt = this.now();
      if (!isExactIsoTimestamp(committedAt)) {
        throw new PaperTradingComparisonError(
          "invalid_paper_trading_comparison_input",
          "Paper comparison server clock must return an exact ISO timestamp."
        );
      }
      const [championCandidate, challengerCandidate] = await Promise.all([
        this.validateCandidateSide("champion", input.champion, committedAt),
        this.validateCandidateSide("challenger", input.challenger, committedAt)
      ]);
      if (
        championCandidate.systemCode.artifact_digest ===
        challengerCandidate.systemCode.artifact_digest
      ) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_duplicate_executable",
          "Champion and challenger freeze the same stored SystemCode bytes."
        );
      }
      const championSelection = await this.resolveChampionSelection(
        input.comparisonPolicy.comparison_mode,
        championCandidate,
        committedAt
      );
      const withoutDigest: PaperTradingComparisonPreparationRecord = {
        record_kind: "paper_trading_comparison_preparation",
        version: 1,
        paper_trading_comparison_preparation_id: ids.preparationId,
        paper_trading_comparison_commitment_id: ids.commitmentId,
        champion: championCandidate.side,
        challenger: challengerCandidate.side,
        champion_selection: championSelection,
        comparison_policy: structuredClone(input.comparisonPolicy),
        market_data_configuration_digest: input.marketDataConfigurationDigest,
        paper_policy_identity: structuredClone(input.paperPolicyIdentity),
        committed_at: committedAt,
        preparation_digest: "",
        authority_status: "not_live"
      };
      preparation = await this.options.store.reservePaperTradingComparisonPreparation({
        ...withoutDigest,
        preparation_digest: comparisonPreparationDigest(withoutDigest)
      });
    }

    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison preparation has invalid runtime shape."
      );
    }

    const champion = await this.prepareSide(
      ids.commitmentId,
      preparation.champion,
      preparation.committed_at
    );
    const challenger = await this.prepareSide(
      ids.commitmentId,
      preparation.challenger,
      preparation.committed_at
    );
    if (
      champion.commitment.resolved_artifact_digest ===
      challenger.commitment.resolved_artifact_digest
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_duplicate_executable",
        "Champion and challenger resolve to the same executable bytes."
      );
    }

    const withoutDigest: PaperTradingComparisonCommitmentRecord = {
      record_kind: "paper_trading_comparison_commitment",
      version: 1,
      paper_trading_comparison_commitment_id:
        preparation.paper_trading_comparison_commitment_id,
      preparation_ref: {
        record_kind: "paper_trading_comparison_preparation",
        id: preparation.paper_trading_comparison_preparation_id
      },
      champion: champion.side,
      challenger: challenger.side,
      champion_selection: structuredClone(preparation.champion_selection),
      comparison_policy: structuredClone(preparation.comparison_policy),
      market_data_configuration_digest: preparation.market_data_configuration_digest,
      paper_policy_identity: structuredClone(preparation.paper_policy_identity),
      committed_at: preparation.committed_at,
      commitment_digest: "",
      authority_status: "not_live"
    };
    const commitment = {
      ...withoutDigest,
      commitment_digest: comparisonCommitmentDigest(withoutDigest)
    };
    await this.options.store.recordPaperTradingComparisonCommitment(commitment);
    const reloaded = await this.reload(ids.commitmentId);
    if (!reloaded) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_reload_failed",
        "Persisted paper comparison commitment could not be reloaded."
      );
    }
    this.assertRequestedPreparationIdentity(reloaded.preparation, ids.commitmentId, input);
    return reloaded;
  }

  private async validateCandidateSide(
    role: "champion" | "challenger",
    input: PaperTradingComparisonCandidateInput,
    committedAt: string
  ): Promise<ValidatedComparisonCandidate> {
    const [candidateVersion, admission] = await Promise.all([
      this.options.store.getCandidateVersion(input.candidateVersionId),
      this.options.store.getCandidateAdmissionDecision(input.admissionDecisionId)
    ]);
    const systemCodeRef = candidateVersion?.system_code_ref;
    const systemCode = systemCodeRef
      ? await this.options.store.getSystemCode(systemCodeRef.id)
      : undefined;
    const admitted =
      candidateVersion &&
      admission &&
      systemCode &&
      candidateVersion.candidate_id === input.candidateId &&
      candidateVersion.candidate_version_id === input.candidateVersionId &&
      paperTradingComparisonRefsEqual(candidateVersion.system_code_ref, {
        record_kind: systemCode.record_kind,
        id: systemCode.system_code_id
      }) &&
      admission.status === "admitted" &&
      admission.runnable_paper_handoff === true &&
      admission.authority_status === "not_live" &&
      isCandidateAdmissionDecisionConsistent(admission) &&
      isExactIsoTimestamp(systemCode.created_at) &&
      isExactIsoTimestamp(admission.decided_at) &&
      Date.parse(systemCode.created_at) <= Date.parse(admission.decided_at) &&
      Date.parse(admission.decided_at) <= Date.parse(committedAt) &&
      paperTradingComparisonRefsEqual(admission.system_code_ref, {
        record_kind: systemCode.record_kind,
        id: systemCode.system_code_id
      }) &&
      admission.submitted_artifact_digest === systemCode.artifact_digest;
    if (!admitted) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_candidate_not_admitted",
        "Paper comparison candidates require exact admitted frozen SystemCode evidence."
      );
    }
    return {
      candidateVersion,
      admission,
      systemCode,
      side: {
        role,
        candidate_ref: { record_kind: "trading_system_candidate", id: input.candidateId },
        candidate_version_ref: {
          record_kind: "candidate_version",
          id: input.candidateVersionId
        },
        candidate_version_digest: comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
        ),
        system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
        system_code_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
        ),
        system_code_artifact_digest: systemCode.artifact_digest,
        candidate_admission_decision_ref: {
          record_kind: "candidate_admission_decision",
          id: input.admissionDecisionId
        },
        admission_decision_digest: comparisonExactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(admission)
        )
      }
    };
  }

  private async resolveChampionSelection(
    mode: PaperTradingComparisonPolicy["comparison_mode"],
    champion: ValidatedComparisonCandidate,
    committedAt: string
  ): Promise<PaperTradingComparisonChampionSelection> {
    const latest = await this.options.store.getLatestTradingPromotion();
    if (mode === "bootstrap") {
      if (latest) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_champion_selection_mismatch",
          "Bootstrap comparison requires no current TradingPromotion."
        );
      }
      return { selection_kind: "bootstrap" };
    }
    if (!latest) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_champion_selection_mismatch",
        "Champion challenge requires the exact current TradingPromotion."
      );
    }
    const evidence = await this.loadQualifiedPromotionAuthority(
      latest,
      champion,
      committedAt
    );
    return {
      selection_kind: "trading_review",
      trading_promotion_ref: {
        record_kind: "trading_promotion",
        id: latest.trading_promotion_id
      },
      trading_promotion_digest: comparisonExactRecordDigest(
        paperTradingComparisonTradingPromotionDigestInput(latest)
      ),
      paper_trading_evaluation_ref: { ...latest.paper_trading_evaluation_ref },
      paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evidence.evaluation)
      ),
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: evidence.commitment.paper_trading_evaluation_commitment_id
      },
      paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(evidence.commitment)
      ),
      paper_trading_observation_chain_digest: comparisonExactRecordDigest(
        paperTradingComparisonObservationChainDigestInput(evidence.observations)
      )
    };
  }

  private async loadQualifiedPromotionAuthority(
    promotion: TradingPromotionRecord,
    champion: ValidatedComparisonCandidate,
    committedAt: string
  ): Promise<{
    evaluation: PaperTradingEvaluationRecord;
    commitment: PaperTradingEvaluationCommitmentRecord;
    observations: PaperTradingObservationRecord[];
  }> {
    if (!paperTradingComparisonTradingPromotionHasRuntimeShape(promotion)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_champion_selection_mismatch",
        "TradingPromotion has invalid persisted shape."
      );
    }
    const { evaluation, commitment, observations, campaign } =
      await this.readPersistedGraph(async () => {
        const persistedEvaluation = await this.options.store
          .getPaperTradingEvaluation(
            promotion.paper_trading_evaluation_ref.id
          );
        const persistedCommitment = persistedEvaluation
          ?.paper_trading_evaluation_commitment_ref
          ? await this.options.store.getPaperTradingEvaluationCommitment(
              persistedEvaluation.paper_trading_evaluation_commitment_ref.id
            )
          : undefined;
        const persistedObservations = persistedEvaluation
          ? await this.options.store.listPaperTradingObservations(
              persistedEvaluation.paper_trading_evaluation_id
            )
          : [];
        return {
          evaluation: persistedEvaluation,
          commitment: persistedCommitment,
          observations: persistedObservations,
          campaign: await this.options.store
            .getPaperTradingComparisonConfirmationCampaign(
              promotion.comparison_confirmation.campaign_ref.id
            )
        };
      }, "TradingPromotion qualification records could not be read.");
    if (
      !evaluation ||
      !commitment ||
      !campaign ||
      campaign.paper_trading_comparison_confirmation_campaign_id !==
        promotion.comparison_confirmation.campaign_ref.id ||
      campaign.campaign_digest !==
        promotion.comparison_confirmation.campaign_digest ||
      !paperTradingComparisonRefsEqual(
        campaign.challenger.candidate_ref,
        champion.side.candidate_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        campaign.challenger.candidate_version_ref,
        champion.side.candidate_version_ref
      ) ||
      !paperTradingComparisonRefsEqual(
        campaign.challenger.system_code_ref,
        champion.side.system_code_ref
      ) ||
      campaign.challenger.system_code_artifact_digest !==
        champion.side.system_code_artifact_digest ||
      campaign.evaluation_authority !== "external_to_trading_systems" ||
      campaign.authority_status !== "not_live" ||
      !paperTradingComparisonStoppedQualificationClosureHasRuntimeShape({
        systemCode: champion.systemCode,
        admission: champion.admission,
        commitment,
        evaluation,
        observations,
        promotion,
        preparationCommittedAt: committedAt
      })
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_champion_selection_mismatch",
        "TradingPromotion qualification evidence is missing or malformed."
      );
    }
    const ordered = [...observations].sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.paper_trading_observation_id.localeCompare(
          right.paper_trading_observation_id
        )
    );
    const refsMatch =
      paperTradingComparisonRefsEqual(promotion.candidate_ref, champion.side.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        promotion.candidate_version_ref,
        champion.side.candidate_version_ref
      );
    const commitmentSelfDigestMatches =
      commitment.commitment_digest ===
      `sha256:${createHash("sha256")
        .update(paperTradingEvaluationCommitmentDigestInput(commitment))
        .digest("hex")}`;
    const qualification = qualifyPaperTradingEvaluation({
      evaluation,
      commitment,
      observations: ordered,
      runnerActive: false,
      policy: {
        minObservationCount:
          campaign.comparison_policy.minimum_observation_count,
        minElapsedMs: campaign.comparison_policy.minimum_elapsed_ms
      }
    });
    if (
      !refsMatch ||
      !commitmentSelfDigestMatches ||
      qualification.qualification_status !== "qualified"
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_champion_selection_mismatch",
        "TradingPromotion must reference a causally prior stopped qualified paper evaluation."
      );
    }
    return { evaluation, commitment, observations: ordered };
  }

  private async prepareSide(
    comparisonId: string,
    candidate: PaperTradingComparisonCandidateSide,
    persistedCommittedAt: string
  ): Promise<PreparedPaperTradingComparisonSide> {
    const run = await this.options.store.createPaperTradingRun({
      idempotency_key: `${comparisonId}:${candidate.role}`,
      candidate_id: candidate.candidate_ref.id,
      candidate_version_id: candidate.candidate_version_ref.id,
      evidence_purpose: "qualification",
      created_at: persistedCommittedAt
    });
    if (!isExactIsoTimestamp(run.created_at ?? "") || run.created_at !== persistedCommittedAt) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_run_time_mismatch",
        "Qualification TradingRun must start at the frozen preparation timestamp."
      );
    }
    const session = await this.options.sessions.prepare({
      candidateId: candidate.candidate_ref.id,
      candidateVersionId: candidate.candidate_version_ref.id,
      tradingRunId: run.trading_run_id,
      evidencePurpose: "qualification",
      clock: "external"
    });
    const side: PaperTradingComparisonSide = {
      ...structuredClone(candidate),
      trading_run_ref: { ...session.commitment.trading_run_ref },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: session.commitment.paper_trading_evaluation_commitment_id
      },
      paper_trading_evaluation_commitment_digest: session.commitment.commitment_digest,
      paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(session.commitment)
      ),
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: session.evaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(session.evaluation)
      )
    };
    return this.reloadSide(side, candidate.role);
  }

  async reload(
    comparisonId: string
  ): Promise<VerifiedPaperTradingComparisonCommitmentGraph | undefined> {
    const commitment = await this.readPersistedGraph(
      () => this.options.store.getPaperTradingComparisonCommitment(comparisonId),
      "Paper comparison commitment could not be read."
    );
    if (!commitment) {
      return undefined;
    }
    if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison commitment has invalid persisted shape."
      );
    }
    if (commitment.commitment_digest !== comparisonCommitmentDigest(commitment)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_digest_mismatch",
        "Paper comparison canonical content changed."
      );
    }
    const preparation = await this.readPersistedGraph(
      () => this.options.store.getPaperTradingComparisonPreparation(
        commitment.preparation_ref.id
      ),
      "Paper comparison preparation could not be read."
    );
    if (!preparation) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_incomplete",
        "Paper comparison preparation is missing."
      );
    }
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison preparation has invalid persisted shape."
      );
    }
    if (preparation.preparation_digest !== comparisonPreparationDigest(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_digest_mismatch",
        "Paper comparison preparation canonical content changed."
      );
    }
    const champion = await this.reloadSide(commitment.champion, "champion");
    const challenger = await this.reloadSide(commitment.challenger, "challenger");
    return this.verify({ preparation, commitment, champion, challenger });
  }

  private async reloadSide(
    side: unknown,
    expectedRole: "champion" | "challenger"
  ): Promise<PreparedPaperTradingComparisonSide> {
    if (!paperTradingComparisonSideHasRuntimeShape(side, expectedRole)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison side has invalid persisted shape."
      );
    }
    const [
      candidate,
      run,
      systemCode,
      commitment,
      evaluation,
      allCommitments,
      allEvaluations,
      observations
    ] = await this.readPersistedGraph(
      () => Promise.all([
        this.options.store.getCandidateForTradingRun(side.trading_run_ref.id),
        this.options.store.getTradingRun(side.trading_run_ref.id),
        this.options.store.getSystemCode(side.system_code_ref.id),
        this.options.store.getPaperTradingEvaluationCommitment(
          side.paper_trading_evaluation_commitment_ref.id
        ),
        this.options.store.getPaperTradingEvaluation(side.paper_trading_evaluation_ref.id),
        this.options.store.listPaperTradingEvaluationCommitments(),
        this.options.store.listPaperTradingEvaluations(),
        this.options.store.listPaperTradingObservations(side.paper_trading_evaluation_ref.id)
      ]),
      "Paper comparison side records could not be read."
    );
    if (!candidate || !run || !systemCode || !commitment || !evaluation) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_incomplete",
        "Paper comparison side candidate, run, SystemCode, commitment, or evaluation was not found."
      );
    }
    const persistedField = (value: unknown, key: string): unknown =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)[key]
        : undefined;
    const commitmentsForRun = allCommitments.filter((record) =>
      paperTradingComparisonRefsEqual(
        persistedField(record, "trading_run_ref"),
        side.trading_run_ref
      )
    );
    const evaluationsForRun = allEvaluations.filter((record) =>
      paperTradingComparisonRefsEqual(
        persistedField(record, "trading_run_ref"),
        side.trading_run_ref
      )
    );
    if (
      commitmentsForRun.length !== 1 ||
      persistedField(
        commitmentsForRun[0],
        "paper_trading_evaluation_commitment_id"
      ) !== side.paper_trading_evaluation_commitment_ref.id ||
      evaluationsForRun.length !== 1 ||
      persistedField(evaluationsForRun[0], "paper_trading_evaluation_id") !==
        side.paper_trading_evaluation_ref.id ||
      !paperTradingComparisonRefsEqual(
        persistedField(evaluationsForRun[0], "paper_trading_evaluation_commitment_ref"),
        side.paper_trading_evaluation_commitment_ref
      )
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison side must bind the sole commitment/evaluation chain for its run."
      );
    }
    return {
      side: structuredClone(side),
      candidate,
      run,
      systemCode,
      commitment,
      evaluation,
      observations
    };
  }

  async verify(
    graph: PreparedPaperTradingComparison
  ): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
    const preparedSideRefEnvelopeHasRuntimeShape = (
      value: unknown,
      role: "champion" | "challenger"
    ): value is PreparedPaperTradingComparisonSide =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      paperTradingComparisonSideHasRuntimeShape(
        (value as Record<string, unknown>).side,
        role
      );
    const rawGraph = graph as unknown;
    if (rawGraph === null || typeof rawGraph !== "object" || Array.isArray(rawGraph)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison graph has invalid runtime shape."
      );
    }
    const raw = rawGraph as Record<string, unknown>;
    if (
      !paperTradingComparisonPreparationHasRuntimeShape(raw.preparation) ||
      !paperTradingComparisonCommitmentHasRuntimeShape(raw.commitment) ||
      !preparedSideRefEnvelopeHasRuntimeShape(raw.champion, "champion") ||
      !preparedSideRefEnvelopeHasRuntimeShape(raw.challenger, "challenger")
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison graph has invalid runtime shape."
      );
    }
    const { preparation, commitment, champion, challenger } = graph;
    const [
      persistedPreparation,
      persistedCommitment,
      persistedChampionCommitment,
      persistedChallengerCommitment,
      persistedChampionEvaluation,
      persistedChallengerEvaluation,
      persistedChampionCandidate,
      persistedChallengerCandidate,
      persistedChampionRun,
      persistedChallengerRun,
      persistedChampionSystemCode,
      persistedChallengerSystemCode,
      allPersistedCommitments,
      allPersistedEvaluations,
      persistedChampionObservations,
      persistedChallengerObservations,
      championVersion,
      challengerVersion,
      championAdmission,
      challengerAdmission
    ] = await this.readPersistedGraph(
      () => Promise.all([
        this.options.store.getPaperTradingComparisonPreparation(
          preparation.paper_trading_comparison_preparation_id
        ),
        this.options.store.getPaperTradingComparisonCommitment(
          commitment.paper_trading_comparison_commitment_id
        ),
        this.options.store.getPaperTradingEvaluationCommitment(
          champion.side.paper_trading_evaluation_commitment_ref.id
        ),
        this.options.store.getPaperTradingEvaluationCommitment(
          challenger.side.paper_trading_evaluation_commitment_ref.id
        ),
        this.options.store.getPaperTradingEvaluation(
          champion.side.paper_trading_evaluation_ref.id
        ),
        this.options.store.getPaperTradingEvaluation(
          challenger.side.paper_trading_evaluation_ref.id
        ),
        this.options.store.getCandidateForTradingRun(champion.side.trading_run_ref.id),
        this.options.store.getCandidateForTradingRun(challenger.side.trading_run_ref.id),
        this.options.store.getTradingRun(champion.side.trading_run_ref.id),
        this.options.store.getTradingRun(challenger.side.trading_run_ref.id),
        this.options.store.getSystemCode(champion.side.system_code_ref.id),
        this.options.store.getSystemCode(challenger.side.system_code_ref.id),
        this.options.store.listPaperTradingEvaluationCommitments(),
        this.options.store.listPaperTradingEvaluations(),
        this.options.store.listPaperTradingObservations(
          champion.side.paper_trading_evaluation_ref.id
        ),
        this.options.store.listPaperTradingObservations(
          challenger.side.paper_trading_evaluation_ref.id
        ),
        this.options.store.getCandidateVersion(champion.side.candidate_version_ref.id),
        this.options.store.getCandidateVersion(challenger.side.candidate_version_ref.id),
        this.options.store.getCandidateAdmissionDecision(
          champion.side.candidate_admission_decision_ref.id
        ),
        this.options.store.getCandidateAdmissionDecision(
          challenger.side.candidate_admission_decision_ref.id
        )
      ]),
      "Paper comparison verification records could not be read."
    );
    const preparedSideHasFullRuntimeShape = (
      value: unknown,
      role: "champion" | "challenger",
      candidateVersion: unknown,
      admission: unknown
    ): value is PreparedPaperTradingComparisonSide => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }
      const side = value as Record<string, unknown>;
      return (
        paperTradingComparisonSideHasRuntimeShape(side.side, role) &&
        paperTradingComparisonSideRecordsHaveInertShape({
          candidate: side.candidate,
          candidateVersion,
          admission,
          run: side.run,
          systemCode: side.systemCode,
          commitment: side.commitment,
          evaluation: side.evaluation,
          observations: side.observations
        })
      );
    };
    if (
      !preparedSideHasFullRuntimeShape(
        champion,
        "champion",
        championVersion,
        championAdmission
      ) ||
      !preparedSideHasFullRuntimeShape(
        challenger,
        "challenger",
        challengerVersion,
        challengerAdmission
      )
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison prepared side has invalid persisted runtime shape."
      );
    }
    const championSelection = preparation.champion_selection;
    const boundPromotion =
      championSelection.selection_kind === "trading_review"
        ? await this.readPersistedGraph(
            () => this.options.store.getTradingPromotion(
              championSelection.trading_promotion_ref.id
            ),
            "Bound TradingPromotion could not be read."
          )
        : undefined;
    const selectionEvidence =
      preparation.champion_selection.selection_kind === "trading_review" &&
      boundPromotion &&
      championVersion &&
      championAdmission
        ? await this.loadQualifiedPromotionAuthority(
            boundPromotion,
            {
              side: preparation.champion,
              candidateVersion: championVersion,
              admission: championAdmission,
              systemCode: champion.systemCode
            },
            preparation.committed_at
          )
        : undefined;
    const selectionMatches =
      preparation.comparison_policy.comparison_mode === "bootstrap"
        ? preparation.champion_selection.selection_kind === "bootstrap"
        : preparation.champion_selection.selection_kind === "trading_review" &&
          Boolean(boundPromotion && selectionEvidence) &&
          preparation.champion_selection.trading_promotion_digest ===
            comparisonExactRecordDigest(
              paperTradingComparisonTradingPromotionDigestInput(boundPromotion!)
            ) &&
          paperTradingComparisonRefsEqual(
            preparation.champion_selection.paper_trading_evaluation_ref,
            boundPromotion!.paper_trading_evaluation_ref
          ) &&
          preparation.champion_selection.paper_trading_evaluation_record_digest ===
            comparisonExactRecordDigest(
              paperTradingComparisonEvaluationRecordDigestInput(
                selectionEvidence!.evaluation
              )
            ) &&
          paperTradingComparisonRefsEqual(
            preparation.champion_selection.paper_trading_evaluation_commitment_ref,
            {
              record_kind: selectionEvidence!.commitment.record_kind,
              id: selectionEvidence!.commitment.paper_trading_evaluation_commitment_id
            }
          ) &&
          preparation.champion_selection
            .paper_trading_evaluation_commitment_record_digest ===
            comparisonExactRecordDigest(
              paperTradingComparisonEvaluationCommitmentRecordDigestInput(
                selectionEvidence!.commitment
              )
            ) &&
          preparation.champion_selection.paper_trading_observation_chain_digest ===
            comparisonExactRecordDigest(
              paperTradingComparisonObservationChainDigestInput(
                selectionEvidence!.observations
              )
            );
    const candidateSideMatches = (
      runtimeSide: PaperTradingComparisonSide,
      candidateSide: PaperTradingComparisonCandidateSide
    ) =>
      runtimeSide.role === candidateSide.role &&
      paperTradingComparisonRefsEqual(runtimeSide.candidate_ref, candidateSide.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        runtimeSide.candidate_version_ref,
        candidateSide.candidate_version_ref
      ) &&
      runtimeSide.candidate_version_digest === candidateSide.candidate_version_digest &&
      paperTradingComparisonRefsEqual(
        runtimeSide.system_code_ref,
        candidateSide.system_code_ref
      ) &&
      runtimeSide.system_code_record_digest === candidateSide.system_code_record_digest &&
      runtimeSide.system_code_artifact_digest === candidateSide.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        runtimeSide.candidate_admission_decision_ref,
        candidateSide.candidate_admission_decision_ref
      ) &&
      runtimeSide.admission_decision_digest === candidateSide.admission_decision_digest;
    const preparationMatches =
      paperTradingComparisonPreparationHasRuntimeShape(persistedPreparation) &&
      paperTradingComparisonCommitmentHasRuntimeShape(persistedCommitment) &&
      isDeepStrictEqual(persistedPreparation, preparation) &&
      isDeepStrictEqual(persistedCommitment, commitment) &&
      preparation.preparation_digest === comparisonPreparationDigest(preparation) &&
      commitment.commitment_digest === comparisonCommitmentDigest(commitment) &&
      preparation.authority_status === "not_live" &&
      paperTradingComparisonRefsEqual(commitment.preparation_ref, {
        record_kind: preparation.record_kind,
        id: preparation.paper_trading_comparison_preparation_id
      }) &&
      commitment.paper_trading_comparison_commitment_id ===
        preparation.paper_trading_comparison_commitment_id &&
      candidateSideMatches(commitment.champion, preparation.champion) &&
      candidateSideMatches(commitment.challenger, preparation.challenger) &&
      isDeepStrictEqual(commitment.champion_selection, preparation.champion_selection) &&
      isDeepStrictEqual(commitment.comparison_policy, preparation.comparison_policy) &&
      commitment.market_data_configuration_digest ===
        preparation.market_data_configuration_digest &&
      isDeepStrictEqual(commitment.paper_policy_identity, preparation.paper_policy_identity) &&
      commitment.committed_at === preparation.committed_at &&
      isExactIsoTimestamp(preparation.committed_at) &&
      selectionMatches;
    const persistedField = (value: unknown, key: string): unknown =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)[key]
        : undefined;
    const commitmentsForRun = (runRef: unknown) =>
      allPersistedCommitments.filter((record) =>
        paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef)
      );
    const evaluationsForRun = (runRef: unknown) =>
      allPersistedEvaluations.filter((record) =>
        paperTradingComparisonRefsEqual(persistedField(record, "trading_run_ref"), runRef)
      );
    const championRunCommitments = commitmentsForRun(champion.side.trading_run_ref);
    const challengerRunCommitments = commitmentsForRun(challenger.side.trading_run_ref);
    const championRunEvaluations = evaluationsForRun(champion.side.trading_run_ref);
    const challengerRunEvaluations = evaluationsForRun(challenger.side.trading_run_ref);
    const persistedSideGraphsMatch =
      isDeepStrictEqual(persistedChampionCommitment, champion.commitment) &&
      isDeepStrictEqual(persistedChallengerCommitment, challenger.commitment) &&
      isDeepStrictEqual(persistedChampionEvaluation, champion.evaluation) &&
      isDeepStrictEqual(persistedChallengerEvaluation, challenger.evaluation) &&
      isDeepStrictEqual(persistedChampionCandidate, champion.candidate) &&
      isDeepStrictEqual(persistedChallengerCandidate, challenger.candidate) &&
      isDeepStrictEqual(persistedChampionRun, champion.run) &&
      isDeepStrictEqual(persistedChallengerRun, challenger.run) &&
      isDeepStrictEqual(persistedChampionSystemCode, champion.systemCode) &&
      isDeepStrictEqual(persistedChallengerSystemCode, challenger.systemCode) &&
      isDeepStrictEqual(persistedChampionObservations, champion.observations) &&
      isDeepStrictEqual(persistedChallengerObservations, challenger.observations) &&
      championRunCommitments.length === 1 &&
      persistedField(
        championRunCommitments[0],
        "paper_trading_evaluation_commitment_id"
      ) === champion.side.paper_trading_evaluation_commitment_ref.id &&
      challengerRunCommitments.length === 1 &&
      persistedField(
        challengerRunCommitments[0],
        "paper_trading_evaluation_commitment_id"
      ) === challenger.side.paper_trading_evaluation_commitment_ref.id &&
      championRunEvaluations.length === 1 &&
      persistedField(championRunEvaluations[0], "paper_trading_evaluation_id") ===
        champion.side.paper_trading_evaluation_ref.id &&
      paperTradingComparisonRefsEqual(
        persistedField(
          championRunEvaluations[0],
          "paper_trading_evaluation_commitment_ref"
        ),
        champion.side.paper_trading_evaluation_commitment_ref
      ) &&
      challengerRunEvaluations.length === 1 &&
      persistedField(challengerRunEvaluations[0], "paper_trading_evaluation_id") ===
        challenger.side.paper_trading_evaluation_ref.id &&
      paperTradingComparisonRefsEqual(
        persistedField(
          challengerRunEvaluations[0],
          "paper_trading_evaluation_commitment_ref"
        ),
        challenger.side.paper_trading_evaluation_commitment_ref
      );
    const sideRefsMatch = (side: PreparedPaperTradingComparisonSide) =>
      side.candidate.candidate_id === side.side.candidate_ref.id &&
      side.candidate.candidate_version.candidate_version_id ===
        side.side.candidate_version_ref.id &&
      paperTradingComparisonRefsEqual(side.side.trading_run_ref, {
        record_kind: side.run.record_kind,
        id: side.run.trading_run_id
      }) &&
      paperTradingComparisonRefsEqual(
        side.side.trading_run_ref,
        side.commitment.trading_run_ref
      ) &&
      paperTradingComparisonRefsEqual(side.side.system_code_ref, {
        record_kind: side.systemCode.record_kind,
        id: side.systemCode.system_code_id
      }) &&
      paperTradingComparisonRefsEqual(
        side.side.system_code_ref,
        side.commitment.system_code_ref
      ) &&
      side.side.system_code_artifact_digest === side.systemCode.artifact_digest &&
      side.side.system_code_artifact_digest ===
        side.commitment.system_code_artifact_digest &&
      paperTradingComparisonRefsEqual(
        side.side.paper_trading_evaluation_commitment_ref,
        {
          record_kind: side.commitment.record_kind,
          id: side.commitment.paper_trading_evaluation_commitment_id
        }
      ) &&
      side.side.paper_trading_evaluation_commitment_digest ===
        side.commitment.commitment_digest &&
      side.side.paper_trading_evaluation_commitment_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(side.commitment)
        ) &&
      paperTradingComparisonRefsEqual(side.side.paper_trading_evaluation_ref, {
        record_kind: side.evaluation.record_kind,
        id: side.evaluation.paper_trading_evaluation_id
      }) &&
      side.side.paper_trading_evaluation_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
        ) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.paper_trading_evaluation_commitment_ref,
        side.side.paper_trading_evaluation_commitment_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.candidate_ref,
        side.side.candidate_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.candidate_version_ref,
        side.side.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.evaluation.trading_run_ref,
        side.side.trading_run_ref
      ) &&
      paperTradingComparisonRefsEqual(side.run.candidate_ref, side.side.candidate_ref) &&
      paperTradingComparisonRefsEqual(
        side.run.candidate_version_ref,
        side.side.candidate_version_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.run.system_code_ref,
        side.side.system_code_ref
      );
    const sideHasInertShape = (
      side: PreparedPaperTradingComparisonSide,
      version: CandidateVersionRecord | undefined,
      admission: CandidateAdmissionDecisionRecord | undefined
    ) =>
      Boolean(version && admission) &&
      paperTradingComparisonSideRecordsHaveInertShape({
        candidate: side.candidate,
        candidateVersion: version!,
        admission: admission!,
        run: side.run,
        systemCode: side.systemCode,
        commitment: side.commitment,
        evaluation: side.evaluation,
        observations: side.observations
      }) &&
      side.run.runtime_lifecycle_status === "registered" &&
      side.run.stage_binding_profile === "paper" &&
      side.run.paper_evidence_purpose === "qualification" &&
      side.run.authority_status === "not_live" &&
      side.run.stage_binding_ref === undefined &&
      side.run.runtime_operating_policy_ref === undefined &&
      side.run.trace_ref === undefined &&
      side.run.order_request_refs === undefined &&
      side.run.gateway_result_refs === undefined &&
      side.run.execution_result_refs === undefined &&
      side.run.run_control_command_refs === undefined &&
      side.run.run_control_decision_refs === undefined &&
      side.run.runtime_audit_event_refs === undefined &&
      side.run.sandbox_ref === undefined &&
      side.evaluation.started_at === side.commitment.committed_at;
    const sideIsQualificationEligible = (side: PreparedPaperTradingComparisonSide) =>
      side.commitment.evidence_purpose === "qualification" &&
      side.commitment.window_policy.release_policy === "sealed_until_adjudication" &&
      side.commitment.provider_identity.qualification_eligible === true &&
      side.commitment.provider_identity.ineligibility_reason === undefined &&
      isExactIsoTimestamp(side.commitment.committed_at) &&
      Date.parse(side.commitment.committed_at) >= Date.parse(preparation.committed_at) &&
      isExactIsoTimestamp(side.run.created_at ?? "") &&
      side.run.created_at === preparation.committed_at &&
      side.commitment.commitment_digest ===
        `sha256:${createHash("sha256")
          .update(paperTradingEvaluationCommitmentDigestInput(side.commitment))
          .digest("hex")}` &&
      isDeepStrictEqual(side.commitment.runtime_identity, {
        artifact_kind: side.systemCode.artifact_kind,
        runtime_kind: side.systemCode.runtime_kind,
        entrypoint: side.systemCode.entrypoint,
        ...(side.systemCode.artifact_runtime_contract_ref
          ? { artifact_runtime_contract_ref: side.systemCode.artifact_runtime_contract_ref }
          : {})
      }) &&
      paperTradingComparisonRefsEqual(
        side.commitment.capability_policy_ref,
        side.systemCode.capability_policy_ref
      ) &&
      paperTradingComparisonRefsEqual(
        side.commitment.secret_policy_ref,
        side.systemCode.secret_policy_ref
      );
    const admissionMatches = (
      side: PreparedPaperTradingComparisonSide,
      admission: CandidateAdmissionDecisionRecord | undefined
    ) =>
      Boolean(admission) &&
      paperTradingComparisonRefsEqual(side.side.candidate_admission_decision_ref, {
        record_kind: admission!.record_kind,
        id: admission!.candidate_admission_decision_id
      }) &&
      admission!.status === "admitted" &&
      admission!.runnable_paper_handoff === true &&
      admission!.authority_status === "not_live" &&
      isCandidateAdmissionDecisionConsistent(admission!) &&
      side.side.admission_decision_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(admission!)
        ) &&
      isExactIsoTimestamp(admission!.decided_at) &&
      Date.parse(admission!.decided_at) <= Date.parse(preparation.committed_at) &&
      paperTradingComparisonRefsEqual(
        admission!.system_code_ref,
        side.commitment.system_code_ref
      ) &&
      admission!.submitted_artifact_digest ===
        side.commitment.system_code_artifact_digest;
    const frozenVersionMatches = (
      side: PreparedPaperTradingComparisonSide,
      version: CandidateVersionRecord | undefined
    ) =>
      Boolean(version) &&
      paperTradingComparisonRefsEqual(side.side.candidate_version_ref, {
        record_kind: version!.record_kind,
        id: version!.candidate_version_id
      }) &&
      version!.candidate_id === side.side.candidate_ref.id &&
      paperTradingComparisonRefsEqual(
        version!.system_code_ref,
        side.side.system_code_ref
      ) &&
      side.side.candidate_version_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(version!)
        ) &&
      side.side.system_code_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(side.systemCode)
        ) &&
      version!.runtime_ref.id !== side.run.trading_run_id;
    const identitiesMatch =
      preparationMatches &&
      persistedSideGraphsMatch &&
      champion.side.role === "champion" &&
      challenger.side.role === "challenger" &&
      sideHasInertShape(champion, championVersion, championAdmission) &&
      sideHasInertShape(challenger, challengerVersion, challengerAdmission) &&
      sideRefsMatch(champion) &&
      sideRefsMatch(challenger) &&
      frozenVersionMatches(champion, championVersion) &&
      frozenVersionMatches(challenger, challengerVersion) &&
      admissionMatches(champion, championAdmission) &&
      admissionMatches(challenger, challengerAdmission) &&
      sideIsQualificationEligible(champion) &&
      sideIsQualificationEligible(challenger) &&
      commitment.authority_status === "not_live" &&
      commitment.comparison_policy.release_policy === "sealed_until_adjudication" &&
      champion.side.candidate_version_ref.id !==
        challenger.side.candidate_version_ref.id &&
      champion.run.trading_run_id !== challenger.run.trading_run_id &&
      champion.side.paper_trading_evaluation_commitment_ref.id !==
        challenger.side.paper_trading_evaluation_commitment_ref.id &&
      champion.side.paper_trading_evaluation_ref.id !==
        challenger.side.paper_trading_evaluation_ref.id &&
      champion.evaluation.paper_trading_evaluation_id !==
        challenger.evaluation.paper_trading_evaluation_id &&
      champion.commitment.resolved_artifact_digest !==
        challenger.commitment.resolved_artifact_digest &&
      commitment.comparison_policy.interval_ms ===
        champion.commitment.window_policy.interval_ms &&
      commitment.comparison_policy.interval_ms ===
        challenger.commitment.window_policy.interval_ms &&
      isDeepStrictEqual(
        champion.commitment.window_policy,
        challenger.commitment.window_policy
      ) &&
      commitment.market_data_configuration_digest ===
        champion.commitment.data_identity.market_data_configuration_digest &&
      commitment.comparison_policy.symbol === champion.commitment.data_identity.symbol &&
      isDeepStrictEqual(
        champion.commitment.data_identity,
        challenger.commitment.data_identity
      ) &&
      isDeepStrictEqual(
        commitment.paper_policy_identity,
        champion.commitment.policy_identity
      ) &&
      isDeepStrictEqual(
        champion.commitment.policy_identity,
        challenger.commitment.policy_identity
      ) &&
      isDeepStrictEqual(
        champion.commitment.initial_account_snapshot,
        challenger.commitment.initial_account_snapshot
      );
    if (!identitiesMatch) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison graph is incomplete, mismatched, duplicate, or no longer inert."
      );
    }
    return {
      ...graph,
      verification: { status: "verified", activation_authority: "not_granted" }
    };
  }

  private async readPersistedGraph<T>(
    read: () => Promise<T>,
    message: string
  ): Promise<T> {
    try {
      return await read();
    } catch (error) {
      if (error instanceof PaperTradingComparisonError) {
        throw error;
      }
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        message
      );
    }
  }

  private assertRequestedPreparationIdentity(
    preparation: PaperTradingComparisonPreparationRecord,
    expectedCommitmentId: string,
    input: PreparePaperTradingComparisonInput
  ): void {
    const matches =
      preparation.paper_trading_comparison_commitment_id === expectedCommitmentId &&
      preparation.champion.candidate_ref.id === input.champion.candidateId &&
      preparation.champion.candidate_version_ref.id ===
        input.champion.candidateVersionId &&
      preparation.champion.candidate_admission_decision_ref.id ===
        input.champion.admissionDecisionId &&
      preparation.challenger.candidate_ref.id === input.challenger.candidateId &&
      preparation.challenger.candidate_version_ref.id ===
        input.challenger.candidateVersionId &&
      preparation.challenger.candidate_admission_decision_ref.id ===
        input.challenger.admissionDecisionId &&
      isDeepStrictEqual(preparation.comparison_policy, input.comparisonPolicy) &&
      preparation.market_data_configuration_digest ===
        input.marketDataConfigurationDigest &&
      isDeepStrictEqual(preparation.paper_policy_identity, input.paperPolicyIdentity);
    if (!matches) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_idempotency_conflict",
        "Paper comparison idempotency key was reused with different input."
      );
    }
  }

  private async assertFrozenPreparationRecords(
    preparation: PaperTradingComparisonPreparationRecord
  ): Promise<void> {
    if (!paperTradingComparisonPreparationHasRuntimeShape(preparation)) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_graph_invalid",
        "Paper comparison preparation has invalid runtime shape."
      );
    }
    const [
      championVersion,
      challengerVersion,
      championCode,
      challengerCode,
      championAdmission,
      challengerAdmission
    ] = await Promise.all([
      this.options.store.getCandidateVersion(
        preparation.champion.candidate_version_ref.id
      ),
      this.options.store.getCandidateVersion(
        preparation.challenger.candidate_version_ref.id
      ),
      this.options.store.getSystemCode(preparation.champion.system_code_ref.id),
      this.options.store.getSystemCode(preparation.challenger.system_code_ref.id),
      this.options.store.getCandidateAdmissionDecision(
        preparation.champion.candidate_admission_decision_ref.id
      ),
      this.options.store.getCandidateAdmissionDecision(
        preparation.challenger.candidate_admission_decision_ref.id
      )
    ]);
    const sideMatches = (
      side: PaperTradingComparisonCandidateSide,
      version: CandidateVersionRecord | undefined,
      systemCode: SystemCodeRecord | undefined,
      admission: CandidateAdmissionDecisionRecord | undefined
    ) =>
      Boolean(version && systemCode && admission) &&
      paperTradingComparisonRefsEqual(side.candidate_version_ref, {
        record_kind: version!.record_kind,
        id: version!.candidate_version_id
      }) &&
      version!.candidate_id === side.candidate_ref.id &&
      paperTradingComparisonRefsEqual(version!.system_code_ref, side.system_code_ref) &&
      paperTradingComparisonRefsEqual(side.system_code_ref, {
        record_kind: systemCode!.record_kind,
        id: systemCode!.system_code_id
      }) &&
      side.candidate_version_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonCandidateVersionDigestInput(version!)
        ) &&
      side.system_code_record_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonSystemCodeRecordDigestInput(systemCode!)
        ) &&
      side.system_code_artifact_digest === systemCode!.artifact_digest &&
      paperTradingComparisonRefsEqual(admission!.system_code_ref, side.system_code_ref) &&
      paperTradingComparisonRefsEqual(side.candidate_admission_decision_ref, {
        record_kind: admission!.record_kind,
        id: admission!.candidate_admission_decision_id
      }) &&
      admission!.submitted_artifact_digest === side.system_code_artifact_digest &&
      admission!.status === "admitted" &&
      admission!.runnable_paper_handoff === true &&
      admission!.authority_status === "not_live" &&
      isCandidateAdmissionDecisionConsistent(admission!) &&
      isExactIsoTimestamp(systemCode!.created_at) &&
      isExactIsoTimestamp(admission!.decided_at) &&
      Date.parse(systemCode!.created_at) <= Date.parse(admission!.decided_at) &&
      Date.parse(admission!.decided_at) <= Date.parse(preparation.committed_at) &&
      side.admission_decision_digest ===
        comparisonExactRecordDigest(
          paperTradingComparisonAdmissionDecisionDigestInput(admission!)
        );
    if (
      !sideMatches(
        preparation.champion,
        championVersion,
        championCode,
        championAdmission
      ) ||
      !sideMatches(
        preparation.challenger,
        challengerVersion,
        challengerCode,
        challengerAdmission
      )
    ) {
      throw new PaperTradingComparisonError(
        "paper_trading_comparison_frozen_record_digest_mismatch",
        "Frozen CandidateVersion, SystemCode, or admission content changed."
      );
    }
    if (preparation.champion_selection.selection_kind === "trading_review") {
      const selection = preparation.champion_selection;
      const promotion = await this.options.store.getTradingPromotion(
        selection.trading_promotion_ref.id
      );
      if (!promotion || !championVersion || !championCode || !championAdmission) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_frozen_record_digest_mismatch",
          "Frozen TradingPromotion qualification closure is incomplete."
        );
      }
      const evidence = await this.loadQualifiedPromotionAuthority(
        promotion,
        {
          side: preparation.champion,
          candidateVersion: championVersion,
          admission: championAdmission,
          systemCode: championCode
        },
        preparation.committed_at
      );
      if (
        selection.trading_promotion_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonTradingPromotionDigestInput(promotion)
          ) ||
        !paperTradingComparisonRefsEqual(
          selection.paper_trading_evaluation_ref,
          promotion.paper_trading_evaluation_ref
        ) ||
        selection.paper_trading_evaluation_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(evidence.evaluation)
          ) ||
        !paperTradingComparisonRefsEqual(
          selection.paper_trading_evaluation_commitment_ref,
          {
            record_kind: evidence.commitment.record_kind,
            id: evidence.commitment.paper_trading_evaluation_commitment_id
          }
        ) ||
        selection.paper_trading_evaluation_commitment_record_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(
              evidence.commitment
            )
          ) ||
        selection.paper_trading_observation_chain_digest !==
          comparisonExactRecordDigest(
            paperTradingComparisonObservationChainDigestInput(evidence.observations)
          )
      ) {
        throw new PaperTradingComparisonError(
          "paper_trading_comparison_frozen_record_digest_mismatch",
          "Frozen TradingPromotion qualification closure changed."
        );
      }
    }
  }
}

function comparisonPreparationDigest(
  record: PaperTradingComparisonPreparationRecord
): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPreparationDigestInput(record))
    .digest("hex")}`;
}

function comparisonCommitmentDigest(
  record: PaperTradingComparisonCommitmentRecord
): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonCommitmentDigestInput(record))
    .digest("hex")}`;
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function comparisonIds(idempotencyKey: string): {
  preparationId: string;
  commitmentId: string;
} {
  try {
    const ids = paperTradingComparisonIdsForIdempotencyKey(idempotencyKey);
    return {
      preparationId: ids.preparation_id,
      commitmentId: ids.comparison_commitment_id
    };
  } catch {
    throw new PaperTradingComparisonError(
      "invalid_paper_trading_comparison_input",
      "Paper comparison idempotency key is required."
    );
  }
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
