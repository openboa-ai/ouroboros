import { createHash } from "node:crypto";
import {
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonActivationSideResultHasRuntimeShape,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonWindowClosureEvidenceHasRuntimeShape,
  type PaperTradingComparisonActivationAttemptRecord,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSideResultRecord,
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
    const finalOutcome = activationOutcomes.at(-1)!;
    const [champion, challenger, windowClosure] = await Promise.all([
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
      ),
      loadWindowClosureAssessment({
        store: this.options.store,
        activation,
        activationAttempt,
        finalOutcome,
        checkpointAttempts,
        latestCheckpointOutcome: checkpointEvidence.latestOutcome,
        snapshot
      })
    ]);
    return decidePaperTradingComparisonQualification({
      comparisonId: comparison.paper_trading_comparison_commitment_id,
      activationId: activation.paper_trading_comparison_activation_id,
      activationAttemptId:
        activationAttempt.paper_trading_comparison_activation_attempt_id,
      windowPhase: classifyPaperTradingComparisonWindow(snapshot.facts).phase,
      finalOutcomeReason: finalOutcome.outcome_reason,
      checkpointCount: checkpointEvidence.pairedCount,
      checkpointOutcomesComplete: checkpointEvidence.complete &&
        windowClosure.stateMatches &&
        checkpointEvidence.pairedCount === snapshot.facts.tick_count,
      minimumObservationCount:
        comparison.comparison_policy.minimum_observation_count,
      minimumElapsedMs: comparison.comparison_policy.minimum_elapsed_ms,
      intervalMs: comparison.comparison_policy.interval_ms,
      maximumObservationCount:
        comparison.comparison_policy.maximum_observation_count,
      maximumElapsedMs: comparison.comparison_policy.maximum_elapsed_ms,
      activationAttemptedAt: activationAttempt.attempted_at,
      latestTickObservedAt: snapshot.facts.latest_tick_observed_at,
      windowClosureRequestedAt: windowClosure.requestedAt,
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

async function loadWindowClosureAssessment(input: {
  store: OuroborosStorePort;
  activation: PaperTradingComparisonActivationRecord;
  activationAttempt: PaperTradingComparisonActivationAttemptRecord;
  finalOutcome: PaperTradingComparisonActivationOutcomeRecord;
  checkpointAttempts: PaperTradingComparisonCheckpointAttemptRecord[];
  latestCheckpointOutcome?: PaperTradingComparisonCheckpointOutcomeRecord;
  snapshot: PaperTradingComparisonWindowSnapshot;
}): Promise<{ requestedAt: string; stateMatches: boolean }> {
  if (input.finalOutcome.outcome_reason !== "handoff_cleanup") {
    return {
      requestedAt: input.activationAttempt.attempted_at,
      stateMatches: false
    };
  }
  const championRef = input.finalOutcome.champion_latest_result_ref;
  const challengerRef = input.finalOutcome.challenger_latest_result_ref;
  if (!championRef || !challengerRef) throw graphInconsistent();
  const results = await Promise.all([
    input.store.getPaperTradingComparisonActivationSideResult(championRef.id),
    input.store.getPaperTradingComparisonActivationSideResult(challengerRef.id)
  ]);
  const roles = ["champion", "challenger"] as const;
  const validatedResults: PaperTradingComparisonActivationSideResultRecord[] = [];
  for (const [index, role] of roles.entries()) {
    const result = results[index];
    if (!paperTradingComparisonActivationSideResultHasRuntimeShape(result) ||
      result.paper_trading_comparison_activation_side_result_id !==
        (role === "champion" ? championRef.id : challengerRef.id) ||
      result.side_result_digest !== canonicalDigest(
        paperTradingComparisonActivationSideResultDigestInput(result)
      ) ||
      result.paper_trading_comparison_activation_attempt_ref.id !==
        input.activationAttempt.paper_trading_comparison_activation_attempt_id ||
      result.paper_trading_comparison_activation_attempt_digest !==
        input.activationAttempt.attempt_digest ||
      result.paper_trading_comparison_activation_ref.id !==
        input.activation.paper_trading_comparison_activation_id ||
      result.paper_trading_comparison_activation_digest !==
        input.activation.activation_digest ||
      result.role !== role || result.operation !== "stop" ||
      result.reason !== "handoff_cleanup" ||
      (result.outcome !== "succeeded" && result.outcome !== "not_running") ||
      !paperTradingComparisonRefsEqual(
        result.trading_run_ref,
        input.activationAttempt[role].trading_run_ref
      ) || !paperTradingComparisonRefsEqual(
        result.paper_trading_evaluation_ref,
        input.activationAttempt[role].paper_trading_evaluation_ref
      ) || Date.parse(result.effect_completed_at) >
        Date.parse(input.finalOutcome.completed_at)) {
      throw graphInconsistent();
    }
    validatedResults.push(result);
  }
  const windowClosure = input.finalOutcome.window_closure;
  if (windowClosure === undefined) {
    return {
      requestedAt: input.activationAttempt.attempted_at,
      stateMatches: false
    };
  }
  if (!paperTradingComparisonWindowClosureEvidenceHasRuntimeShape(windowClosure)) {
    throw graphInconsistent();
  }
  const requestedTime = Date.parse(windowClosure.requested_at);
  const earliestEffectStart = Math.min(...validatedResults.map((result) =>
    Date.parse(result.effect_started_at)
  ));
  if (requestedTime < Date.parse(input.activationAttempt.attempted_at) ||
    requestedTime > earliestEffectStart) throw graphInconsistent();

  const latestCheckpointAttempt = input.checkpointAttempts.at(-1);
  const latestAttemptObservedByRequest = latestCheckpointAttempt === undefined ||
    exactIsoTimestamp(latestCheckpointAttempt.attempted_at) &&
      Date.parse(latestCheckpointAttempt.attempted_at) <= requestedTime;
  const latestOutcomeObservedByRequest = input.latestCheckpointOutcome === undefined ||
    exactIsoTimestamp(input.latestCheckpointOutcome.completed_at) &&
      Date.parse(input.latestCheckpointOutcome.completed_at) <= requestedTime;
  const stateMatches = windowClosure.tick_count === input.snapshot.facts.tick_count &&
    windowClosure.checkpoint_attempt_count ===
      input.snapshot.facts.checkpoint_attempt_count &&
    windowClosure.checkpoint_attempt_count === input.checkpointAttempts.length &&
    windowClosure.paired_checkpoint_count ===
      input.snapshot.facts.paired_checkpoint_count &&
    windowClosure.latest_tick_ref.id === input.snapshot.latest_tick_id &&
    windowClosure.latest_tick_observed_at ===
      input.snapshot.facts.latest_tick_observed_at &&
    optionalRefMatches(
      windowClosure.latest_checkpoint_attempt_ref,
      latestCheckpointAttempt?.paper_trading_comparison_checkpoint_attempt_id
    ) && optionalRefMatches(
      windowClosure.latest_checkpoint_outcome_ref,
      input.latestCheckpointOutcome
        ?.paper_trading_comparison_checkpoint_outcome_id
    ) && latestAttemptObservedByRequest && latestOutcomeObservedByRequest;
  return { requestedAt: windowClosure.requested_at, stateMatches };
}

function optionalRefMatches(value: Ref | undefined, id: string | undefined): boolean {
  return value === undefined ? id === undefined : value.id === id;
}

function exactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
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
  latestOutcome?: PaperTradingComparisonCheckpointOutcomeRecord;
} {
  const expectedRefs = { champion: [] as Ref[], challenger: [] as Ref[] };
  let pairedCount = 0;
  let latestStatus: "open" | "paired" | "incomplete" | undefined;
  let latestOutcome: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index]!;
    const values = valuesByAttempt[index];
    if (!Array.isArray(values) || values.length > 1) throw graphInconsistent();
    const outcome = values[0];
    if (!outcome) {
      if (index !== attempts.length - 1) throw graphInconsistent();
      latestStatus = "open";
      latestOutcome = undefined;
      continue;
    }
    if (outcome.checkpoint_attempt_ref.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      outcome.checkpoint_sequence !== attempt.checkpoint_sequence) {
      throw graphInconsistent();
    }
    latestStatus = outcome.outcome_status;
    latestOutcome = outcome;
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
    expectedRefs,
    ...(latestOutcome ? { latestOutcome } : {})
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
