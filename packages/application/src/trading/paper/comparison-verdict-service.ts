import { createHash } from "node:crypto";
import {
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonQualificationResultDigestInput,
  paperTradingComparisonQualificationResultHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonVerdictDigestInput,
  paperTradingComparisonVerdictHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonQualificationResult,
  type PaperTradingComparisonTickRecord,
  type PaperTradingComparisonVerdictRecord,
  type PaperTradingComparisonVerdictSide,
  type PaperTradingEvaluationCommitmentRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord,
  type Ref,
  type TradingRunRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type { PaperTradingComparisonQualificationService } from
  "./comparison-qualification-service";
import { decidePaperTradingComparisonVerdict } from
  "./comparison-verdict-decision";

type VerdictInput = {
  activationId: string;
  activationAttemptId: string;
};

type LoadedVerdictSide = {
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
  run: TradingRunRecord;
};

type LoadedVerdictEvidence = {
  comparison: PaperTradingComparisonCommitmentRecord;
  activation: PaperTradingComparisonActivationRecord;
  attempt: PaperTradingComparisonActivationAttemptRecord;
  finalOutcome: PaperTradingComparisonActivationOutcomeRecord;
  latestTick: PaperTradingComparisonTickRecord;
  ticks: PaperTradingComparisonTickRecord[];
  checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
  champion: LoadedVerdictSide;
  challenger: LoadedVerdictSide;
};

export class PaperTradingComparisonVerdictServiceError extends Error {
  constructor(
    readonly code:
      | "invalid_paper_trading_comparison_verdict_input"
      | "paper_trading_comparison_verdict_not_terminal"
      | "paper_trading_comparison_verdict_graph_invalid",
    message: string,
    readonly details?: { cause_code: string }
  ) {
    super(message);
    this.name = "PaperTradingComparisonVerdictServiceError";
  }
}

export class PaperTradingComparisonVerdictService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    qualifications: Pick<PaperTradingComparisonQualificationService, "assess">;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async evaluate(input: VerdictInput): Promise<PaperTradingComparisonVerdictRecord> {
    const normalized = normalizeInput(input);
    let verdict: PaperTradingComparisonVerdictRecord;
    try {
      const qualification = await this.options.qualifications.assess(normalized);
      const evidence = await this.loadEvidence(normalized, qualification);
      const existing = await this.options.store.getPaperTradingComparisonVerdict(
        verdictId(
          evidence.comparison.paper_trading_comparison_commitment_id,
          evidence.attempt.paper_trading_comparison_activation_attempt_id
        )
      );
      verdict = buildVerdict(
        qualification,
        evidence,
        existing?.evaluated_at ?? this.now()
      );
    } catch (error) {
      if (error instanceof PaperTradingComparisonVerdictServiceError) throw error;
      throw graphInvalid(error);
    }
    return this.options.store.recordPaperTradingComparisonVerdict(verdict);
  }

  private async loadEvidence(
    input: VerdictInput,
    qualification: PaperTradingComparisonQualificationResult
  ): Promise<LoadedVerdictEvidence> {
    if (!paperTradingComparisonQualificationResultHasRuntimeShape(qualification) ||
      qualification.activation_id !== input.activationId ||
      qualification.activation_attempt_id !== input.activationAttemptId) {
      throw graphInconsistent();
    }
    const [activation, attempt] = await Promise.all([
      this.options.store.getPaperTradingComparisonActivation(input.activationId),
      this.options.store.getPaperTradingComparisonActivationAttempt(
        input.activationAttemptId
      )
    ]);
    if (!activation || !attempt ||
      activation.paper_trading_comparison_activation_id !== input.activationId ||
      attempt.paper_trading_comparison_activation_attempt_id !==
        input.activationAttemptId ||
      attempt.paper_trading_comparison_activation_ref.id !== input.activationId ||
      attempt.paper_trading_comparison_activation_digest !==
        activation.activation_digest ||
      attempt.paper_trading_comparison_commitment_ref.id !==
        activation.paper_trading_comparison_commitment_ref.id ||
      attempt.paper_trading_comparison_commitment_digest !==
        activation.paper_trading_comparison_commitment_digest ||
      !sameActivationSide(activation.champion, attempt.champion) ||
      !sameActivationSide(activation.challenger, attempt.challenger)) {
      throw graphInconsistent();
    }

    const comparisonId = activation.paper_trading_comparison_commitment_ref.id;
    const [comparison, activationOutcomes, ticks, checkpointAttempts] =
      await Promise.all([
        this.options.store.getPaperTradingComparisonCommitment(comparisonId),
        this.options.store.listPaperTradingComparisonActivationOutcomes(
          input.activationAttemptId
        ),
        this.options.store.listPaperTradingComparisonTicks(comparisonId),
        this.options.store.listPaperTradingComparisonCheckpointAttempts(
          input.activationAttemptId
        )
      ]);
    if (!comparison || !Array.isArray(activationOutcomes) ||
      !Array.isArray(ticks) || !Array.isArray(checkpointAttempts) ||
      comparison.paper_trading_comparison_commitment_id !== comparisonId ||
      comparison.commitment_digest !==
        activation.paper_trading_comparison_commitment_digest ||
      qualification.comparison_id !== comparisonId ||
      !sameComparisonSide(comparison.champion, activation.champion) ||
      !sameComparisonSide(comparison.challenger, activation.challenger)) {
      throw graphInconsistent();
    }

    const finalOutcome = validateActivationOutcomes(
      activationOutcomes,
      activation,
      attempt
    );
    const latestTick = validateTicks(ticks, comparison, activation, attempt);
    const checkpointOutcomes = await this.loadCheckpointOutcomes(
      checkpointAttempts,
      ticks,
      comparison,
      activation,
      attempt
    );
    const pairedCount = checkpointOutcomes.filter((outcome) =>
      outcome.outcome_status === "paired").length;
    if (qualification.checkpoint_count !== pairedCount ||
      (qualification.qualification_status === "qualified" &&
        (pairedCount !== checkpointAttempts.length ||
          pairedCount !== ticks.length))) {
      throw graphInconsistent();
    }

    const [champion, challenger] = await Promise.all([
      this.loadSide("champion", comparison, activation, attempt, qualification),
      this.loadSide("challenger", comparison, activation, attempt, qualification)
    ]);
    return {
      comparison,
      activation,
      attempt,
      finalOutcome,
      latestTick,
      ticks,
      checkpointOutcomes,
      champion,
      challenger
    };
  }

  private async loadCheckpointOutcomes(
    attempts: PaperTradingComparisonCheckpointAttemptRecord[],
    ticks: PaperTradingComparisonTickRecord[],
    comparison: PaperTradingComparisonCommitmentRecord,
    activation: PaperTradingComparisonActivationRecord,
    activationAttempt: PaperTradingComparisonActivationAttemptRecord
  ): Promise<PaperTradingComparisonCheckpointOutcomeRecord[]> {
    const values = await Promise.all(attempts.map((attempt) =>
      this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )
    ));
    const outcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index]!;
      const tick = ticks[index];
      const matches = values[index];
      if (!Array.isArray(matches) || matches.length > 1) throw graphInconsistent();
      if (matches.length === 0) throw notTerminal();
      const outcome = matches[0]!;
      if (!tick || attempt.checkpoint_sequence !== index + 1 ||
        attempt.paper_trading_comparison_activation_ref.id !==
          activation.paper_trading_comparison_activation_id ||
        attempt.paper_trading_comparison_activation_digest !==
          activation.activation_digest ||
        attempt.paper_trading_comparison_activation_attempt_ref.id !==
          activationAttempt.paper_trading_comparison_activation_attempt_id ||
        attempt.paper_trading_comparison_activation_attempt_digest !==
          activationAttempt.attempt_digest ||
        attempt.paper_trading_comparison_commitment_ref.id !==
          comparison.paper_trading_comparison_commitment_id ||
        attempt.paper_trading_comparison_commitment_digest !==
          comparison.commitment_digest ||
        attempt.tick_ref.id !== tick.paper_trading_comparison_tick_id ||
        attempt.tick_digest !== tick.tick_digest ||
        !sameCheckpointSide(attempt.champion, activationAttempt.champion) ||
        !sameCheckpointSide(attempt.challenger, activationAttempt.challenger) ||
        outcome.checkpoint_attempt_ref.id !==
          attempt.paper_trading_comparison_checkpoint_attempt_id ||
        outcome.checkpoint_attempt_digest !== attempt.attempt_digest ||
        outcome.tick_ref.id !== attempt.tick_ref.id ||
        outcome.tick_digest !== attempt.tick_digest ||
        outcome.checkpoint_sequence !== index + 1) {
        throw graphInconsistent();
      }
      outcomes.push(outcome);
    }
    return outcomes;
  }

  private async loadSide(
    role: "champion" | "challenger",
    comparison: PaperTradingComparisonCommitmentRecord,
    activation: PaperTradingComparisonActivationRecord,
    attempt: PaperTradingComparisonActivationAttemptRecord,
    qualification: PaperTradingComparisonQualificationResult
  ): Promise<LoadedVerdictSide> {
    const side = comparison[role];
    const [commitment, evaluation, observations, run] = await Promise.all([
      this.options.store.getPaperTradingEvaluationCommitment(
        side.paper_trading_evaluation_commitment_ref.id
      ),
      this.options.store.getPaperTradingEvaluation(
        side.paper_trading_evaluation_ref.id
      ),
      this.options.store.listPaperTradingObservations(
        side.paper_trading_evaluation_ref.id
      ),
      this.options.store.getTradingRun(side.trading_run_ref.id)
    ]);
    if (!commitment || !evaluation || !Array.isArray(observations) || !run ||
      !sameComparisonSide(side, activation[role]) ||
      !sameActivationSide(activation[role], attempt[role]) ||
      commitment.paper_trading_evaluation_commitment_id !==
        side.paper_trading_evaluation_commitment_ref.id ||
      evaluation.paper_trading_evaluation_id !==
        side.paper_trading_evaluation_ref.id ||
      !paperTradingComparisonRefsEqual(commitment.trading_run_ref, side.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(evaluation.trading_run_ref, side.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(
        evaluation.paper_trading_evaluation_commitment_ref,
        side.paper_trading_evaluation_commitment_ref
      ) || run.trading_run_id !== side.trading_run_ref.id ||
      !paperTradingComparisonRefsEqual(run.candidate_ref, side.candidate_ref) ||
      !paperTradingComparisonRefsEqual(
        run.candidate_version_ref,
        side.candidate_version_ref
      ) || !paperTradingComparisonRefsEqual(run.system_code_ref, side.system_code_ref) ||
      side.paper_trading_evaluation_commitment_record_digest !== digest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
      ) || evaluation.observation_count !== observations.length ||
      !observationChainMatches(observations, evaluation, side.trading_run_ref) ||
      !qualificationWindowMatches(qualification[role], evaluation, observations)) {
      throw graphInconsistent();
    }
    if (evaluation.status !== "stopped" ||
      run.runtime_lifecycle_status !== "stopped") {
      throw notTerminal();
    }
    return { commitment, evaluation, observations, run };
  }
}

function buildVerdict(
  qualification: PaperTradingComparisonQualificationResult,
  evidence: LoadedVerdictEvidence,
  evaluatedAt: string
): PaperTradingComparisonVerdictRecord {
  const latestScore = qualification.qualification_status === "qualified"
    ? {
        championScore: evidence.champion.evaluation.latest_score,
        challengerScore: evidence.challenger.evaluation.latest_score
      }
    : {};
  const decision = decidePaperTradingComparisonVerdict({
    pairQualification: qualification,
    minimumLiftUsdt:
      evidence.comparison.comparison_policy.minimum_net_revenue_lift_usdt,
    ...latestScore
  });
  if (!isCanonicalTime(evaluatedAt) ||
    Date.parse(evaluatedAt) < Date.parse(evidence.latestTick.observed_at) ||
    Date.parse(evaluatedAt) < Date.parse(evidence.finalOutcome.completed_at)) {
    throw Object.assign(new Error("Paper comparison verdict time is invalid."), {
      code: "paper_trading_comparison_verdict_evaluation_time_invalid"
    });
  }
  const side = (
    role: "champion" | "challenger"
  ): PaperTradingComparisonVerdictSide => {
    const comparisonSide = evidence.comparison[role];
    const loaded = evidence[role];
    return {
      role,
      candidate_ref: { ...comparisonSide.candidate_ref },
      candidate_version_ref: { ...comparisonSide.candidate_version_ref },
      system_code_ref: { ...comparisonSide.system_code_ref },
      system_code_artifact_digest: comparisonSide.system_code_artifact_digest,
      trading_run_ref: { ...comparisonSide.trading_run_ref },
      paper_trading_evaluation_commitment_ref: {
        ...comparisonSide.paper_trading_evaluation_commitment_ref
      },
      paper_trading_evaluation_commitment_record_digest: digest(
        paperTradingComparisonEvaluationCommitmentRecordDigestInput(loaded.commitment)
      ),
      paper_trading_evaluation_ref: {
        ...comparisonSide.paper_trading_evaluation_ref
      },
      paper_trading_evaluation_record_digest: digest(
        paperTradingComparisonEvaluationRecordDigestInput(loaded.evaluation)
      ),
      paper_trading_observation_chain_digest: digest(
        paperTradingComparisonObservationChainDigestInput(loaded.observations)
      ),
      ...(decision[role] ?? {})
    };
  };
  const draft: PaperTradingComparisonVerdictRecord = {
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id: verdictId(
      evidence.comparison.paper_trading_comparison_commitment_id,
      evidence.attempt.paper_trading_comparison_activation_attempt_id
    ),
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: evidence.comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: evidence.comparison.commitment_digest,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: evidence.activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: evidence.activation.activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: evidence.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: evidence.attempt.attempt_digest,
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: evidence.finalOutcome.paper_trading_comparison_activation_outcome_id
    },
    final_activation_outcome_digest: evidence.finalOutcome.outcome_digest,
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: evidence.latestTick.paper_trading_comparison_tick_id
    },
    latest_tick_digest: evidence.latestTick.tick_digest,
    checkpoint_outcome_refs: evidence.checkpointOutcomes.map((outcome) => ({
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: outcome.paper_trading_comparison_checkpoint_outcome_id
    })),
    checkpoint_outcome_digests: evidence.checkpointOutcomes.map(
      (outcome) => outcome.outcome_digest
    ),
    pair_qualification: structuredClone(qualification),
    pair_qualification_digest: digest(
      paperTradingComparisonQualificationResultDigestInput(qualification)
    ),
    champion: side("champion"),
    challenger: side("challenger"),
    ...(decision.metric ? { metric: { ...decision.metric } } : {}),
    verdict_outcome: decision.verdict_outcome,
    window_started_at: evidence.ticks[0]!.observed_at,
    window_ended_at: evidence.latestTick.observed_at,
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: decision.confirmation_disposition,
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: decision.next_action,
    evaluated_at: evaluatedAt,
    verdict_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  };
  const verdict = {
    ...draft,
    verdict_digest: digest(paperTradingComparisonVerdictDigestInput(draft))
  };
  if (!paperTradingComparisonVerdictHasRuntimeShape(verdict)) throw graphInconsistent();
  return verdict;
}

function validateActivationOutcomes(
  outcomes: PaperTradingComparisonActivationOutcomeRecord[],
  activation: PaperTradingComparisonActivationRecord,
  attempt: PaperTradingComparisonActivationAttemptRecord
): PaperTradingComparisonActivationOutcomeRecord {
  if (outcomes.length === 0) throw notTerminal();
  for (let index = 0; index < outcomes.length; index += 1) {
    const outcome = outcomes[index]!;
    const previous = outcomes[index - 1];
    if (outcome.outcome_sequence !== index + 1 ||
      outcome.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      outcome.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      outcome.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id ||
      outcome.paper_trading_comparison_activation_digest !== activation.activation_digest ||
      (previous === undefined) !== (outcome.previous_outcome_ref === undefined) ||
      previous && outcome.previous_outcome_ref?.id !==
        previous.paper_trading_comparison_activation_outcome_id) {
      throw graphInconsistent();
    }
  }
  const finalOutcome = outcomes.at(-1)!;
  if (finalOutcome.outcome_status !== "stopped_cleanly") throw notTerminal();
  return finalOutcome;
}

function validateTicks(
  ticks: PaperTradingComparisonTickRecord[],
  comparison: PaperTradingComparisonCommitmentRecord,
  activation: PaperTradingComparisonActivationRecord,
  attempt: PaperTradingComparisonActivationAttemptRecord
): PaperTradingComparisonTickRecord {
  if (ticks.length === 0) throw graphInconsistent();
  for (let index = 0; index < ticks.length; index += 1) {
    const tick = ticks[index]!;
    if (tick.sequence !== index + 1 ||
      tick.paper_trading_comparison_commitment_ref.id !==
        comparison.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !== comparison.commitment_digest ||
      !isCanonicalTime(tick.observed_at) ||
      index > 0 && Date.parse(tick.observed_at) < Date.parse(ticks[index - 1]!.observed_at)) {
      throw graphInconsistent();
    }
  }
  const first = ticks[0]!;
  if (activation.first_tick_ref.id !== first.paper_trading_comparison_tick_id ||
    activation.first_tick_digest !== first.tick_digest ||
    attempt.first_tick_ref.id !== first.paper_trading_comparison_tick_id ||
    attempt.first_tick_digest !== first.tick_digest) {
    throw graphInconsistent();
  }
  return ticks.at(-1)!;
}

function observationChainMatches(
  observations: PaperTradingObservationRecord[],
  evaluation: PaperTradingEvaluationRecord,
  tradingRunRef: Ref
): boolean {
  return observations.every((observation, index) =>
    observation.sequence === index + 1 &&
    observation.paper_trading_evaluation_ref.id ===
      evaluation.paper_trading_evaluation_id &&
    (observation.trading_run_ref === undefined ||
      paperTradingComparisonRefsEqual(observation.trading_run_ref, tradingRunRef)));
}

function qualificationWindowMatches(
  qualification: PaperTradingComparisonQualificationResult["champion"],
  evaluation: PaperTradingEvaluationRecord,
  observations: PaperTradingObservationRecord[]
): boolean {
  const first = observations[0];
  const last = observations.at(-1);
  const elapsed = last && isCanonicalTime(evaluation.started_at) &&
      Date.parse(last.observed_at) >= Date.parse(evaluation.started_at)
    ? Date.parse(last.observed_at) - Date.parse(evaluation.started_at)
    : 0;
  return qualification.evidence_window.observation_count ===
      evaluation.observation_count &&
    qualification.evidence_window.failed_observation_count ===
      observations.filter((observation) => observation.status === "failed").length &&
    qualification.evidence_window.elapsed_ms === elapsed &&
    qualification.evidence_window.first_observed_at === first?.observed_at &&
    qualification.evidence_window.last_observed_at ===
      (last?.observed_at ?? evaluation.last_observed_at);
}

function sameComparisonSide(
  left: PaperTradingComparisonCommitmentRecord["champion"],
  right: PaperTradingComparisonActivationRecord["champion"]
): boolean {
  return left.role === right.role &&
    paperTradingComparisonRefsEqual(left.trading_run_ref, right.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_commitment_ref,
      right.paper_trading_evaluation_commitment_ref
    ) && paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_ref,
      right.paper_trading_evaluation_ref
    );
}

function sameActivationSide(
  left: PaperTradingComparisonActivationRecord["champion"],
  right: PaperTradingComparisonActivationAttemptRecord["champion"]
): boolean {
  return left.role === right.role &&
    paperTradingComparisonRefsEqual(left.trading_run_ref, right.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_commitment_ref,
      right.paper_trading_evaluation_commitment_ref
    ) && paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_ref,
      right.paper_trading_evaluation_ref
    );
}

function sameCheckpointSide(
  left: PaperTradingComparisonCheckpointAttemptRecord["champion"],
  right: PaperTradingComparisonActivationAttemptRecord["champion"]
): boolean {
  return left.role === right.role &&
    paperTradingComparisonRefsEqual(left.trading_run_ref, right.trading_run_ref) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_ref,
      right.paper_trading_evaluation_ref
    );
}

function normalizeInput(input: VerdictInput): VerdictInput {
  if (!input || typeof input !== "object" ||
    typeof input.activationId !== "string" || !input.activationId ||
    input.activationId.trim() !== input.activationId ||
    typeof input.activationAttemptId !== "string" || !input.activationAttemptId ||
    input.activationAttemptId.trim() !== input.activationAttemptId) {
    throw new PaperTradingComparisonVerdictServiceError(
      "invalid_paper_trading_comparison_verdict_input",
      "Paper comparison activation and attempt IDs are required."
    );
  }
  return { ...input };
}

function notTerminal(): PaperTradingComparisonVerdictServiceError {
  return new PaperTradingComparisonVerdictServiceError(
    "paper_trading_comparison_verdict_not_terminal",
    "Paper comparison evidence is not terminal."
  );
}

function graphInconsistent(): Error & { code: string } {
  return Object.assign(new Error("Paper comparison verdict graph changed."), {
    code: "paper_trading_comparison_verdict_graph_inconsistent"
  });
}

function graphInvalid(error: unknown): PaperTradingComparisonVerdictServiceError {
  return new PaperTradingComparisonVerdictServiceError(
    "paper_trading_comparison_verdict_graph_invalid",
    "Paper comparison verdict graph is unreadable or inconsistent.",
    { cause_code: stableErrorCode(error) }
  );
}

function stableErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" && error.code) return error.code;
  return "paper_trading_comparison_verdict_graph_inconsistent";
}

function isCanonicalTime(value: string | undefined): value is string {
  if (typeof value !== "string" || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function verdictId(comparisonId: string, activationAttemptId: string): string {
  return `paper-comparison-verdict-${createHash("sha256")
    .update(`${comparisonId}:${activationAttemptId}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
