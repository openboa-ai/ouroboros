import {
  paperTradingComparisonRefsEqual,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonCheckpointAttemptRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonCommitmentRecord,
  type Ref
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import {
  decidePaperTradingComparisonQualification,
  type PaperTradingComparisonQualificationResult,
  type PaperTradingComparisonQualificationSideInput
} from "./comparison-qualification-decision";
import type {
  PaperTradingComparisonWindowSnapshot,
  PaperTradingComparisonWindowStateReader
} from "./comparison-window-reader";
import { classifyPaperTradingComparisonWindow } from "./comparison-window-state";
import { qualifyPaperTradingEvaluation } from "./qualification";

export class PaperTradingComparisonQualificationServiceError extends Error {
  constructor(
    readonly code:
      | "invalid_paper_trading_comparison_qualification_input"
      | "paper_trading_comparison_qualification_graph_invalid",
    message: string,
    readonly details?: { cause_code: string }
  ) {
    super(message);
    this.name = "PaperTradingComparisonQualificationServiceError";
  }
}

export class PaperTradingComparisonQualificationService {
  constructor(private readonly options: {
    store: OuroborosStorePort;
    windowReader: PaperTradingComparisonWindowStateReader;
  }) {}

  async assess(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonQualificationResult> {
    const normalized = normalizeInput(input);
    try {
      const snapshot = await this.options.windowReader.load(normalized);
      return await this.assessValidated(normalized, snapshot);
    } catch (error) {
      throw graphInvalid(error);
    }
  }

  private async assessValidated(
    input: { activationId: string; activationAttemptId: string },
    snapshot: PaperTradingComparisonWindowSnapshot
  ): Promise<PaperTradingComparisonQualificationResult> {
    const [activation, activationAttempt] = await Promise.all([
      this.options.store.getPaperTradingComparisonActivation(input.activationId),
      this.options.store.getPaperTradingComparisonActivationAttempt(
        input.activationAttemptId
      )
    ]);
    if (!activation || !activationAttempt ||
      activation.paper_trading_comparison_activation_id !== input.activationId ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !==
        input.activationAttemptId ||
      activationAttempt.paper_trading_comparison_activation_ref.id !== input.activationId ||
      activationAttempt.paper_trading_comparison_commitment_ref.id !==
        activation.paper_trading_comparison_commitment_ref.id) {
      throw graphInconsistent();
    }

    const [comparison, activationOutcomes, checkpointAttempts] = await Promise.all([
      this.options.store.getPaperTradingComparisonCommitment(
        activation.paper_trading_comparison_commitment_ref.id
      ),
      this.options.store.listPaperTradingComparisonActivationOutcomes(
        input.activationAttemptId
      ),
      this.options.store.listPaperTradingComparisonCheckpointAttempts(
        input.activationAttemptId
      )
    ]);
    if (!comparison || !Array.isArray(activationOutcomes) ||
      !Array.isArray(checkpointAttempts)) throw graphInconsistent();
    validateSharedGraph({
      activation,
      activationAttempt,
      comparison,
      activationOutcomes,
      checkpointAttempts,
      snapshot
    });

    const outcomesByAttempt = await Promise.all(checkpointAttempts.map((attempt) =>
      this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )));
    const checkpointEvidence = validateCheckpointOutcomes(
      checkpointAttempts,
      outcomesByAttempt,
      snapshot
    );
    const [champion, challenger] = await Promise.all([
      this.loadSide(
        "champion",
        activationAttempt,
        comparison,
        checkpointEvidence.expectedRefs.champion,
        checkpointEvidence.pairedCount
      ),
      this.loadSide(
        "challenger",
        activationAttempt,
        comparison,
        checkpointEvidence.expectedRefs.challenger,
        checkpointEvidence.pairedCount
      )
    ]);
    const finalOutcome = activationOutcomes.at(-1)!;
    return decidePaperTradingComparisonQualification({
      comparisonId: comparison.paper_trading_comparison_commitment_id,
      activationId: activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        activationAttempt.paper_trading_comparison_activation_attempt_id,
      windowPhase: classifyPaperTradingComparisonWindow(snapshot.facts).phase,
      finalOutcomeReason: finalOutcome.outcome_reason,
      checkpointCount: checkpointEvidence.pairedCount,
      checkpointOutcomesComplete: checkpointEvidence.complete,
      minimumObservationCount:
        comparison.comparison_policy.minimum_observation_count,
      minimumElapsedMs: comparison.comparison_policy.minimum_elapsed_ms,
      activationAttemptedAt: activationAttempt.attempted_at,
      latestTickObservedAt: snapshot.facts.latest_tick_observed_at,
      champion,
      challenger
    });
  }

  private async loadSide(
    role: "champion" | "challenger",
    activationAttempt: PaperTradingComparisonActivationAttemptRecord,
    comparison: PaperTradingComparisonCommitmentRecord,
    expectedLedgerRefs: readonly Ref[],
    expectedObservationCount: number
  ): Promise<PaperTradingComparisonQualificationSideInput> {
    const side = activationAttempt[role];
    const [commitment, evaluation, observations, candidate] = await Promise.all([
      this.options.store.getPaperTradingEvaluationCommitment(
        side.paper_trading_evaluation_commitment_ref.id
      ),
      this.options.store.getPaperTradingEvaluation(
        side.paper_trading_evaluation_ref.id
      ),
      this.options.store.listPaperTradingObservations(
        side.paper_trading_evaluation_ref.id
      ),
      this.options.store.getCandidateForTradingRun(side.trading_run_ref.id)
    ]);
    if (!commitment || !evaluation || !Array.isArray(observations) ||
      commitment.paper_trading_evaluation_commitment_id !==
        side.paper_trading_evaluation_commitment_ref.id ||
      evaluation.paper_trading_evaluation_id !== side.paper_trading_evaluation_ref.id ||
      evaluation.observation_count !== expectedObservationCount ||
      observations.length !== expectedObservationCount ||
      !paperTradingComparisonRefsEqual(commitment.trading_run_ref, side.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(evaluation.trading_run_ref, side.trading_run_ref) ||
      !paperTradingComparisonRefsEqual(
        evaluation.paper_trading_evaluation_commitment_ref,
        side.paper_trading_evaluation_commitment_ref
      ) ||
      !sameComparisonSide(comparison[role], side)) {
      throw graphInconsistent();
    }

    return {
      tradingRunId: side.trading_run_ref.id,
      projectedTradingRunId: candidate?.trading_run?.ref.id,
      qualification: qualifyPaperTradingEvaluation({
        commitment,
        evaluation,
        observations,
        runnerActive: false,
        policy: {
          minObservationCount:
            comparison.comparison_policy.minimum_observation_count,
          minElapsedMs: comparison.comparison_policy.minimum_elapsed_ms
        }
      }),
      expectedLedgerRefs: expectedLedgerRefs.map((value) => ({ ...value })),
      ledger: candidate?.ledger
    };
  }
}

function validateSharedGraph(input: {
  activation: PaperTradingComparisonActivationRecord;
  activationAttempt: PaperTradingComparisonActivationAttemptRecord;
  comparison: PaperTradingComparisonCommitmentRecord;
  activationOutcomes: PaperTradingComparisonActivationOutcomeRecord[];
  checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[];
  snapshot: PaperTradingComparisonWindowSnapshot;
}): void {
  const {
    activation,
    activationAttempt,
    comparison,
    activationOutcomes,
    checkpointAttempts,
    snapshot
  } = input;
  const outcomesValid = activationOutcomes.length >= 1 &&
    activationOutcomes.every((outcome, index) =>
      outcome.outcome_sequence === index + 1 &&
      outcome.paper_trading_comparison_activation_attempt_ref.id ===
        activationAttempt.paper_trading_comparison_activation_attempt_id) &&
    activationOutcomes.at(-1)?.outcome_status === snapshot.facts.activation_status;
  const attemptsValid = checkpointAttempts.length ===
      snapshot.facts.checkpoint_attempt_count &&
    checkpointAttempts.every((attempt, index) =>
      attempt.checkpoint_sequence === index + 1 &&
      attempt.paper_trading_comparison_activation_attempt_ref.id ===
        activationAttempt.paper_trading_comparison_activation_attempt_id &&
      attempt.paper_trading_comparison_commitment_ref.id ===
        comparison.paper_trading_comparison_commitment_id &&
      attempt.champion.trading_run_ref.id === activationAttempt.champion.trading_run_ref.id &&
      attempt.challenger.trading_run_ref.id ===
        activationAttempt.challenger.trading_run_ref.id);
  const policyValid = comparison.comparison_policy.interval_ms ===
      snapshot.facts.interval_ms &&
    comparison.comparison_policy.maximum_observation_count ===
      snapshot.facts.maximum_observation_count &&
    comparison.comparison_policy.maximum_elapsed_ms ===
      snapshot.facts.maximum_elapsed_ms &&
    activationAttempt.attempted_at === snapshot.facts.activation_attempted_at;
  if (comparison.paper_trading_comparison_commitment_id !==
      activation.paper_trading_comparison_commitment_ref.id ||
    !sameComparisonSide(comparison.champion, activation.champion) ||
    !sameComparisonSide(comparison.challenger, activation.challenger) ||
    !sameActivationSide(activation.champion, activationAttempt.champion) ||
    !sameActivationSide(activation.challenger, activationAttempt.challenger) ||
    !outcomesValid || !attemptsValid || !policyValid ||
    snapshot.latest_checkpoint_attempt_id !==
      checkpointAttempts.at(-1)?.paper_trading_comparison_checkpoint_attempt_id) {
    throw graphInconsistent();
  }
}

function validateCheckpointOutcomes(
  attempts: PaperTradingComparisonCheckpointAttemptRecord[],
  valuesByAttempt: PaperTradingComparisonCheckpointOutcomeRecord[][],
  snapshot: PaperTradingComparisonWindowSnapshot
): {
  complete: boolean;
  pairedCount: number;
  expectedRefs: Record<"champion" | "challenger", Ref[]>;
} {
  const expectedRefs = { champion: [] as Ref[], challenger: [] as Ref[] };
  let pairedCount = 0;
  let latestStatus: "open" | "paired" | "incomplete" | undefined;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index]!;
    const values = valuesByAttempt[index];
    if (!Array.isArray(values) || values.length > 1) throw graphInconsistent();
    const outcome = values[0];
    if (!outcome) {
      if (index !== attempts.length - 1) throw graphInconsistent();
      latestStatus = "open";
      continue;
    }
    if (outcome.checkpoint_attempt_ref.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      outcome.checkpoint_sequence !== attempt.checkpoint_sequence) {
      throw graphInconsistent();
    }
    latestStatus = outcome.outcome_status;
    if (outcome.outcome_status === "paired") {
      if (outcome.champion?.role !== "champion" ||
        outcome.challenger?.role !== "challenger" ||
        !Array.isArray(outcome.champion.ledger_chain_refs) ||
        !Array.isArray(outcome.challenger.ledger_chain_refs)) {
        throw graphInconsistent();
      }
      pairedCount += 1;
      expectedRefs.champion.push(...outcome.champion.ledger_chain_refs.map(
        (value) => ({ ...value })
      ));
      expectedRefs.challenger.push(...outcome.challenger.ledger_chain_refs.map(
        (value) => ({ ...value })
      ));
    } else if (outcome.champion !== undefined || outcome.challenger !== undefined) {
      throw graphInconsistent();
    }
  }
  if (pairedCount !== snapshot.facts.paired_checkpoint_count ||
    latestStatus !== snapshot.facts.latest_checkpoint_status) {
    throw graphInconsistent();
  }
  return {
    complete: attempts.length > 0 && pairedCount === attempts.length,
    pairedCount,
    expectedRefs
  };
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
    ) &&
    paperTradingComparisonRefsEqual(
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
    ) &&
    paperTradingComparisonRefsEqual(
      left.paper_trading_evaluation_ref,
      right.paper_trading_evaluation_ref
    );
}

function normalizeInput(input: {
  activationId: string;
  activationAttemptId: string;
}): { activationId: string; activationAttemptId: string } {
  if (!input || typeof input !== "object" ||
    typeof input.activationId !== "string" || !input.activationId ||
    input.activationId.trim() !== input.activationId ||
    typeof input.activationAttemptId !== "string" || !input.activationAttemptId ||
    input.activationAttemptId.trim() !== input.activationAttemptId) {
    throw new PaperTradingComparisonQualificationServiceError(
      "invalid_paper_trading_comparison_qualification_input",
      "Paper comparison activation and attempt IDs are required."
    );
  }
  return { ...input };
}

function graphInconsistent(): Error & { code: string } {
  return Object.assign(new Error("Paper comparison qualification graph changed."), {
    code: "paper_trading_comparison_qualification_graph_inconsistent"
  });
}

function graphInvalid(error: unknown): PaperTradingComparisonQualificationServiceError {
  return new PaperTradingComparisonQualificationServiceError(
    "paper_trading_comparison_qualification_graph_invalid",
    "Paper comparison qualification graph is unreadable or inconsistent.",
    { cause_code: stableErrorCode(error) }
  );
}

function stableErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error &&
    typeof error.code === "string" && error.code) return error.code;
  return "paper_trading_comparison_qualification_graph_inconsistent";
}
