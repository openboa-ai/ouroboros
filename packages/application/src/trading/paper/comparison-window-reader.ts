import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationAttemptHasRuntimeShape,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationOutcomeHasRuntimeShape,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointAttemptHasRuntimeShape,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonCheckpointOutcomeHasRuntimeShape,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickAcknowledgementHasRuntimeShape,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickDeliveryHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonActivationOutcomeRecord,
  type PaperTradingComparisonCheckpointOutcomeRecord,
  type PaperTradingComparisonTickAcknowledgementRecord,
  type PaperTradingComparisonTickDeliveryRecord,
  type PaperTradingComparisonTickRecord,
  type PaperTradingEvaluationRecord,
  type PaperTradingObservationRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type { PaperTradingComparisonWindowFacts } from "./comparison-window-state";

export interface PaperTradingComparisonWindowSnapshot {
  facts: PaperTradingComparisonWindowFacts;
  latest_tick_id: string;
  latest_checkpoint_attempt_id?: string;
}

export interface PaperTradingComparisonWindowStateReader {
  load(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowSnapshot>;
}

export class PaperTradingComparisonWindowReaderError extends Error {
  constructor(
    readonly code:
      | "invalid_paper_trading_comparison_window_input"
      | "paper_trading_comparison_window_graph_invalid",
    message: string
  ) {
    super(message);
    this.name = "PaperTradingComparisonWindowReaderError";
  }
}

export class LocalStorePaperTradingComparisonWindowStateReader
  implements PaperTradingComparisonWindowStateReader {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    activations: { ownsRunningAttempt(attemptId: string): boolean };
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async load(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowSnapshot> {
    const normalized = normalizeInput(input);
    try {
      return await this.loadValidated(normalized);
    } catch (error) {
      if (error instanceof PaperTradingComparisonWindowReaderError) throw error;
      throw graphInvalid();
    }
  }

  private async loadValidated(input: {
    activationId: string;
    activationAttemptId: string;
  }): Promise<PaperTradingComparisonWindowSnapshot> {
    const [activation, activationAttempt] = await Promise.all([
      this.options.store.getPaperTradingComparisonActivation(input.activationId),
      this.options.store.getPaperTradingComparisonActivationAttempt(
        input.activationAttemptId
      )
    ]);
    if (!paperTradingComparisonActivationHasRuntimeShape(activation) ||
      activation.paper_trading_comparison_activation_id !== input.activationId ||
      activation.activation_digest !== canonicalDigest(
        paperTradingComparisonActivationDigestInput(activation)
      ) ||
      !paperTradingComparisonActivationAttemptHasRuntimeShape(activationAttempt) ||
      activationAttempt.paper_trading_comparison_activation_attempt_id !==
        input.activationAttemptId ||
      activationAttempt.attempt_digest !== canonicalDigest(
        paperTradingComparisonActivationAttemptDigestInput(activationAttempt)
      ) ||
      activationAttempt.paper_trading_comparison_activation_ref.id !==
        input.activationId ||
      activationAttempt.paper_trading_comparison_activation_digest !==
        activation.activation_digest) {
      throw graphInvalid();
    }

    const [
      commitment,
      activations,
      activationAttempts,
      activationOutcomes,
      ticks,
      checkpointAttempts,
      deliveries,
      acknowledgements
    ] = await Promise.all([
      this.options.store.getPaperTradingComparisonCommitment(
        activation.paper_trading_comparison_commitment_ref.id
      ),
      this.options.store.listPaperTradingComparisonActivations(
        activation.paper_trading_comparison_commitment_ref.id
      ),
      this.options.store.listPaperTradingComparisonActivationAttempts(
        activation.paper_trading_comparison_activation_id
      ),
      this.options.store.listPaperTradingComparisonActivationOutcomes(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      ),
      this.options.store.listPaperTradingComparisonTicks(
        activation.paper_trading_comparison_commitment_ref.id
      ),
      this.options.store.listPaperTradingComparisonCheckpointAttempts(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      ),
      this.options.store.listPaperTradingComparisonTickDeliveries(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      ),
      this.options.store.listPaperTradingComparisonTickAcknowledgements(
        activationAttempt.paper_trading_comparison_activation_attempt_id
      )
    ]);
    if (!paperTradingComparisonCommitmentHasRuntimeShape(commitment) ||
      commitment.commitment_digest !== canonicalDigest(
        paperTradingComparisonCommitmentDigestInput(commitment)
      ) ||
      !paperTradingComparisonRefsEqual(
        activation.paper_trading_comparison_commitment_ref,
        {
          record_kind: "paper_trading_comparison_commitment",
          id: commitment.paper_trading_comparison_commitment_id
        }
      ) ||
      activation.paper_trading_comparison_commitment_digest !==
        commitment.commitment_digest ||
      !Array.isArray(activations) || activations.length !== 1 ||
      !isDeepStrictEqual(activations[0], activation) ||
      !Array.isArray(activationAttempts) ||
      !isDeepStrictEqual(activationAttempts.at(-1), activationAttempt) ||
      activationAttempts.some((attempt, index) =>
        !paperTradingComparisonActivationAttemptHasRuntimeShape(attempt) ||
        attempt.attempt_sequence !== index + 1 ||
        attempt.attempt_digest !== canonicalDigest(
          paperTradingComparisonActivationAttemptDigestInput(attempt)
        )) ||
      !Array.isArray(activationOutcomes) || activationOutcomes.length === 0 ||
      !Array.isArray(ticks) || ticks.length === 0 ||
      !Array.isArray(checkpointAttempts) ||
      !Array.isArray(deliveries) ||
      !Array.isArray(acknowledgements)) {
      throw graphInvalid();
    }

    const latestActivationOutcome = validateActivationOutcomes(
      activationOutcomes,
      activationAttempt
    );
    const runningActivationOutcome = activationOutcomes.find(
      (value): value is PaperTradingComparisonActivationOutcomeRecord =>
        paperTradingComparisonActivationOutcomeHasRuntimeShape(value) &&
        value.outcome_status === "both_running"
    );
    if (!runningActivationOutcome) throw graphInvalid();
    const typedTicks = validateTicks(ticks, commitment, activationAttempt);
    const typedCheckpointAttempts = validateCheckpointAttempts(
      checkpointAttempts,
      typedTicks,
      activationAttempt,
      runningActivationOutcome
    );
    const outcomesByAttempt = await Promise.all(typedCheckpointAttempts.map(
      (attempt) => this.options.store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )
    ));
    const checkpointState = validateCheckpointOutcomes(
      typedCheckpointAttempts,
      outcomesByAttempt
    );
    const typedDeliveries = validateDeliveries(
      deliveries,
      typedTicks,
      activationAttempt
    );
    const typedAcknowledgements = validateAcknowledgements(
      acknowledgements,
      typedDeliveries,
      typedTicks,
      activationAttempt
    );
    await this.validateEconomicState(
      commitment,
      activationAttempt,
      typedCheckpointAttempts,
      checkpointState.outcomes,
      checkpointState.pairedCount,
      typedAcknowledgements,
      latestActivationOutcome
    );

    const latestTick = typedTicks.at(-1)!;
    const latestCheckpointAttempt = typedCheckpointAttempts.at(-1);
    const latestCheckpointOutcome = checkpointState.latestOutcome;
    const latestTickAcknowledgements = typedAcknowledgements.filter((record) =>
      record.tick_ref.id === latestTick.paper_trading_comparison_tick_id
    );
    const now = this.now();
    if (!isExactIso(now) ||
      Date.parse(now) < Date.parse(activationAttempt.attempted_at) ||
      Date.parse(now) < Date.parse(latestTick.observed_at)) throw graphInvalid();
    const latestCheckpointStatus = latestCheckpointAttempt
      ? latestCheckpointOutcome
        ? latestCheckpointOutcome.outcome_status
        : "open"
      : undefined;
    const facts: PaperTradingComparisonWindowFacts = {
      owned: latestActivationOutcome.outcome_status === "both_running" &&
        this.options.activations.ownsRunningAttempt(
          activationAttempt.paper_trading_comparison_activation_attempt_id
        ),
      now,
      activation_attempted_at: activationAttempt.attempted_at,
      interval_ms: commitment.comparison_policy.interval_ms,
      maximum_observation_count:
        commitment.comparison_policy.maximum_observation_count,
      maximum_elapsed_ms: commitment.comparison_policy.maximum_elapsed_ms,
      tick_count: typedTicks.length,
      latest_tick_observed_at: latestTick.observed_at,
      checkpoint_attempt_count: typedCheckpointAttempts.length,
      paired_checkpoint_count: checkpointState.pairedCount,
      ...(latestCheckpointStatus
        ? { latest_checkpoint_status: latestCheckpointStatus }
        : {}),
      latest_checkpoint_has_failed_side:
        latestCheckpointOutcome?.outcome_status === "paired" &&
        (latestCheckpointOutcome.champion?.observation_status === "failed" ||
          latestCheckpointOutcome.challenger?.observation_status === "failed"),
      ...(latestCheckpointStatus === "open"
        ? { latest_checkpoint_deadline_at: latestCheckpointAttempt!.checkpoint_deadline_at }
        : {}),
      latest_tick_acknowledged_roles: latestTickAcknowledgements.map(
        (record) => record.role
      ),
      activation_status: latestActivationOutcome.outcome_status
    };
    return {
      facts,
      latest_tick_id: latestTick.paper_trading_comparison_tick_id,
      ...(latestCheckpointAttempt ? {
        latest_checkpoint_attempt_id:
          latestCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      } : {})
    };
  }

  private async validateEconomicState(
    commitment: NonNullable<Awaited<ReturnType<
      OuroborosStorePort["getPaperTradingComparisonCommitment"]
    >>>,
    activationAttempt: Parameters<typeof validateActivationOutcomes>[1],
    checkpointAttempts: ReturnType<typeof validateCheckpointAttempts>,
    checkpointOutcomes: PaperTradingComparisonCheckpointOutcomeRecord[],
    pairedCount: number,
    acknowledgements: PaperTradingComparisonTickAcknowledgementRecord[],
    activationOutcome: PaperTradingComparisonActivationOutcomeRecord
  ): Promise<void> {
    for (const role of ["champion", "challenger"] as const) {
      const [evaluation, observations] = await Promise.all([
        this.options.store.getPaperTradingEvaluation(
          activationAttempt[role].paper_trading_evaluation_ref.id
        ),
        this.options.store.listPaperTradingObservations(
          activationAttempt[role].paper_trading_evaluation_ref.id
        )
      ]);
      if (!evaluation || !Array.isArray(observations) ||
        evaluation.paper_trading_evaluation_id !==
          activationAttempt[role].paper_trading_evaluation_ref.id ||
        !paperTradingComparisonRefsEqual(
          evaluation.trading_run_ref,
          activationAttempt[role].trading_run_ref
        ) ||
        evaluation.observation_count !== pairedCount ||
        observations.length !== pairedCount) {
        throw graphInvalid();
      }
      validateObservations(
        observations,
        checkpointAttempts,
        checkpointOutcomes,
        acknowledgements,
        role
      );
      const latestPairedOutcome = [...checkpointOutcomes].reverse().find(
        (outcome) => outcome.outcome_status === "paired"
      );
      const latestEvidence = latestPairedOutcome?.[role];
      if (!latestEvidence && activationOutcome.outcome_status === "both_running" &&
        evaluation.status !== "running") {
        throw graphInvalid();
      }
      const expectedEvaluationDigest = latestEvidence?.evaluation_record_digest ??
        commitment[role].paper_trading_evaluation_record_digest;
      const currentEvaluationDigest = canonicalDigest(
        paperTradingComparisonEvaluationRecordDigestInput(
          latestEvidence
            ? normalizedRunningEvaluation(evaluation)
            : normalizedInitialEvaluation(evaluation)
        )
      );
      if (currentEvaluationDigest !== expectedEvaluationDigest) {
        throw graphInvalid();
      }
      const openAttempt = checkpointAttempts.at(-1);
      const openOutcomes = openAttempt
        ? checkpointOutcomes.filter((outcome) =>
            outcome.checkpoint_attempt_ref.id ===
              openAttempt.paper_trading_comparison_checkpoint_attempt_id)
        : [];
      if (openAttempt && openOutcomes.length === 0 && (
        openAttempt[role].evaluation_record_digest !== canonicalDigest(
          paperTradingComparisonEvaluationRecordDigestInput(evaluation)
        ) ||
        openAttempt[role].observation_chain_digest !== canonicalDigest(
          paperTradingComparisonObservationChainDigestInput(observations)
        )
      )) {
        throw graphInvalid();
      }
    }
  }
}

function validateActivationOutcomes(
  values: unknown[],
  attempt: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonActivationAttempt"]
  >>>
): PaperTradingComparisonActivationOutcomeRecord {
  let previous: PaperTradingComparisonActivationOutcomeRecord | undefined;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!paperTradingComparisonActivationOutcomeHasRuntimeShape(value) ||
      value.outcome_sequence !== index + 1 ||
      value.outcome_digest !== canonicalDigest(
        paperTradingComparisonActivationOutcomeDigestInput(value)
      ) ||
      value.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      value.paper_trading_comparison_activation_attempt_digest !==
        attempt.attempt_digest ||
      value.paper_trading_comparison_activation_ref.id !==
        attempt.paper_trading_comparison_activation_ref.id ||
      value.paper_trading_comparison_activation_digest !==
        attempt.paper_trading_comparison_activation_digest ||
      (index === 0
        ? value.previous_outcome_ref !== undefined
        : value.previous_outcome_ref?.id !==
          previous?.paper_trading_comparison_activation_outcome_id)) {
      throw graphInvalid();
    }
    previous = value;
  }
  return previous!;
}

function validateTicks(
  values: unknown[],
  commitment: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonCommitment"]
  >>>,
  activationAttempt: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonActivationAttempt"]
  >>>
): PaperTradingComparisonTickRecord[] {
  const ticks: PaperTradingComparisonTickRecord[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const previous = ticks[index - 1];
    if (!paperTradingComparisonTickHasRuntimeShape(value) ||
      value.sequence !== index + 1 ||
      value.tick_digest !== canonicalDigest(paperTradingComparisonTickDigestInput(value)) ||
      value.paper_trading_comparison_commitment_ref.id !==
        commitment.paper_trading_comparison_commitment_id ||
      value.paper_trading_comparison_commitment_digest !== commitment.commitment_digest ||
      (index === 0
        ? value.paper_trading_comparison_tick_id !== activationAttempt.first_tick_ref.id ||
          value.tick_digest !== activationAttempt.first_tick_digest
        : value.previous_tick_ref?.id !== previous?.paper_trading_comparison_tick_id ||
          value.previous_tick_digest !== previous?.tick_digest)) {
      throw graphInvalid();
    }
    ticks.push(value);
  }
  return ticks;
}

function validateCheckpointAttempts(
  values: unknown[],
  ticks: PaperTradingComparisonTickRecord[],
  activationAttempt: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonActivationAttempt"]
  >>>,
  activationOutcome: PaperTradingComparisonActivationOutcomeRecord
) {
  return values.map((value, index) => {
    const tick = ticks[index];
    if (!paperTradingComparisonCheckpointAttemptHasRuntimeShape(value) || !tick ||
      value.checkpoint_sequence !== index + 1 ||
      value.attempt_digest !== canonicalDigest(
        paperTradingComparisonCheckpointAttemptDigestInput(value)
      ) ||
      value.paper_trading_comparison_activation_attempt_ref.id !==
        activationAttempt.paper_trading_comparison_activation_attempt_id ||
      value.paper_trading_comparison_activation_attempt_digest !==
        activationAttempt.attempt_digest ||
      value.activation_outcome_ref.id !==
        activationOutcome.paper_trading_comparison_activation_outcome_id ||
      value.activation_outcome_digest !== activationOutcome.outcome_digest ||
      value.tick_ref.id !== tick.paper_trading_comparison_tick_id ||
      value.tick_digest !== tick.tick_digest) {
      throw graphInvalid();
    }
    return value;
  });
}

function validateCheckpointOutcomes(
  attempts: ReturnType<typeof validateCheckpointAttempts>,
  valuesByAttempt: unknown[][]
): {
  outcomes: PaperTradingComparisonCheckpointOutcomeRecord[];
  pairedCount: number;
  latestOutcome?: PaperTradingComparisonCheckpointOutcomeRecord;
} {
  const outcomes: PaperTradingComparisonCheckpointOutcomeRecord[] = [];
  let pairedCount = 0;
  let previous: PaperTradingComparisonCheckpointOutcomeRecord | undefined;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index]!;
    const values = valuesByAttempt[index];
    if (!Array.isArray(values) || values.length > 1) throw graphInvalid();
    const value = values[0];
    if (!value) {
      if (index !== attempts.length - 1) throw graphInvalid();
      continue;
    }
    if (!paperTradingComparisonCheckpointOutcomeHasRuntimeShape(value) ||
      value.outcome_digest !== canonicalDigest(
        paperTradingComparisonCheckpointOutcomeDigestInput(value)
      ) ||
      value.checkpoint_attempt_ref.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      value.checkpoint_attempt_digest !== attempt.attempt_digest ||
      value.checkpoint_sequence !== attempt.checkpoint_sequence ||
      value.tick_ref.id !== attempt.tick_ref.id ||
      value.tick_digest !== attempt.tick_digest ||
      (index === 0
        ? attempt.previous_checkpoint_outcome_ref !== undefined
        : attempt.previous_checkpoint_outcome_ref?.id !==
            previous?.paper_trading_comparison_checkpoint_outcome_id ||
          attempt.previous_checkpoint_outcome_digest !== previous?.outcome_digest) ||
      previous?.outcome_status === "incomplete") {
      throw graphInvalid();
    }
    outcomes.push(value);
    if (value.outcome_status === "paired") pairedCount += 1;
    if (value.outcome_status === "incomplete" && index !== attempts.length - 1) {
      throw graphInvalid();
    }
    previous = value;
  }
  const latestValue = valuesByAttempt.at(-1)?.[0];
  const latestOutcome = paperTradingComparisonCheckpointOutcomeHasRuntimeShape(
    latestValue
  ) ? latestValue : undefined;
  return {
    outcomes,
    pairedCount,
    ...(latestOutcome ? { latestOutcome } : {})
  };
}

function validateDeliveries(
  values: unknown[],
  ticks: PaperTradingComparisonTickRecord[],
  attempt: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonActivationAttempt"]
  >>>
): PaperTradingComparisonTickDeliveryRecord[] {
  const seen = new Set<string>();
  return values.map((value) => {
    const tick = paperTradingComparisonTickDeliveryHasRuntimeShape(value)
      ? ticks.find((record) => record.paper_trading_comparison_tick_id === value.tick_ref.id)
      : undefined;
    const key = paperTradingComparisonTickDeliveryHasRuntimeShape(value)
      ? `${value.role}:${value.tick_sequence}`
      : "invalid";
    if (!paperTradingComparisonTickDeliveryHasRuntimeShape(value) || !tick || seen.has(key) ||
      value.delivery_digest !== canonicalDigest(
        paperTradingComparisonTickDeliveryDigestInput(value)
      ) ||
      value.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      value.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      value.trading_run_ref.id !== attempt[value.role].trading_run_ref.id ||
      value.tick_digest !== tick.tick_digest || value.tick_sequence !== tick.sequence) {
      throw graphInvalid();
    }
    seen.add(key);
    return value;
  });
}

function validateAcknowledgements(
  values: unknown[],
  deliveries: PaperTradingComparisonTickDeliveryRecord[],
  ticks: PaperTradingComparisonTickRecord[],
  attempt: NonNullable<Awaited<ReturnType<
    OuroborosStorePort["getPaperTradingComparisonActivationAttempt"]
  >>>
): PaperTradingComparisonTickAcknowledgementRecord[] {
  const seen = new Set<string>();
  return values.map((value) => {
    const delivery = paperTradingComparisonTickAcknowledgementHasRuntimeShape(value)
      ? deliveries.find((record) => record.paper_trading_comparison_tick_delivery_id ===
          value.delivery_ref.id)
      : undefined;
    const tick = paperTradingComparisonTickAcknowledgementHasRuntimeShape(value)
      ? ticks.find((record) => record.paper_trading_comparison_tick_id === value.tick_ref.id)
      : undefined;
    const key = paperTradingComparisonTickAcknowledgementHasRuntimeShape(value)
      ? `${value.role}:${value.tick_sequence}`
      : "invalid";
    if (!paperTradingComparisonTickAcknowledgementHasRuntimeShape(value) ||
      !delivery || !tick || seen.has(key) ||
      value.acknowledgement_digest !== canonicalDigest(
        paperTradingComparisonTickAcknowledgementDigestInput(value)
      ) ||
      value.delivery_digest !== delivery.delivery_digest ||
      delivery.role !== value.role ||
      !paperTradingComparisonRefsEqual(
        delivery.trading_run_ref,
        value.trading_run_ref
      ) ||
      delivery.tick_ref.id !== value.tick_ref.id ||
      delivery.tick_digest !== value.tick_digest ||
      delivery.tick_sequence !== value.tick_sequence ||
      value.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id ||
      value.paper_trading_comparison_activation_attempt_digest !== attempt.attempt_digest ||
      value.trading_run_ref.id !== attempt[value.role].trading_run_ref.id ||
      value.tick_digest !== tick.tick_digest || value.tick_sequence !== tick.sequence) {
      throw graphInvalid();
    }
    seen.add(key);
    return value;
  });
}

function validateObservations(
  values: PaperTradingObservationRecord[],
  attempts: ReturnType<typeof validateCheckpointAttempts>,
  outcomes: PaperTradingComparisonCheckpointOutcomeRecord[],
  acknowledgements: PaperTradingComparisonTickAcknowledgementRecord[],
  role: "champion" | "challenger"
): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const attempt = attempts[index];
    const outcome = outcomes.find((candidate) =>
      candidate.checkpoint_attempt_ref.id ===
        attempt?.paper_trading_comparison_checkpoint_attempt_id
    );
    const evidence = outcome?.outcome_status === "paired" ? outcome[role] : undefined;
    const acknowledgement = evidence?.tick_acknowledgement_ref
      ? acknowledgements.find((candidate) =>
          candidate.paper_trading_comparison_tick_acknowledgement_id ===
            evidence.tick_acknowledgement_ref?.id)
      : undefined;
    const acknowledgementLineageValid = attempt?.checkpoint_sequence === 1
      ? evidence?.tick_acknowledgement_ref === undefined &&
        evidence?.tick_acknowledgement_digest === undefined &&
        value?.paper_trading_comparison_tick_acknowledgement_ref === undefined &&
        value?.paper_trading_comparison_tick_acknowledgement_digest === undefined
      : Boolean(acknowledgement) &&
        acknowledgement?.role === role &&
        acknowledgement.tick_ref.id === attempt?.tick_ref.id &&
        acknowledgement.tick_digest === attempt?.tick_digest &&
        acknowledgement.tick_sequence === attempt?.checkpoint_sequence &&
        evidence?.tick_acknowledgement_ref?.id ===
          acknowledgement.paper_trading_comparison_tick_acknowledgement_id &&
        evidence.tick_acknowledgement_digest === acknowledgement.acknowledgement_digest &&
        value?.paper_trading_comparison_tick_acknowledgement_ref?.id ===
          acknowledgement.paper_trading_comparison_tick_acknowledgement_id &&
        value.paper_trading_comparison_tick_acknowledgement_digest ===
          acknowledgement.acknowledgement_digest;
    if (!value || !attempt || !evidence || value.sequence !== index + 1 ||
      value.paper_trading_comparison_checkpoint_attempt_ref?.id !==
        attempt.paper_trading_comparison_checkpoint_attempt_id ||
      value.paper_trading_comparison_checkpoint_attempt_digest !== attempt.attempt_digest ||
      value.paper_trading_comparison_tick_ref?.id !== attempt.tick_ref.id ||
      value.paper_trading_comparison_tick_digest !== attempt.tick_digest ||
      evidence.observation_ref.id !== value.paper_trading_observation_id ||
      evidence.observation_record_digest !== canonicalDigest(
        paperTradingComparisonPersistedRecordDigestInput(value)
      ) || !acknowledgementLineageValid) {
      throw graphInvalid();
    }
  }
}

function normalizedRunningEvaluation(
  evaluation: PaperTradingEvaluationRecord
): PaperTradingEvaluationRecord {
  if (evaluation.status !== "stopped") return evaluation;
  const normalized = {
    ...evaluation,
    status: "running" as const,
    stopped_at: undefined
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) =>
    value !== undefined
  )) as unknown as PaperTradingEvaluationRecord;
}

function normalizedInitialEvaluation(
  evaluation: PaperTradingEvaluationRecord
): PaperTradingEvaluationRecord {
  const normalized = {
    ...evaluation,
    status: "not_started" as const,
    next_observation_at: undefined,
    stopped_at: undefined,
    latest_failure_reason: undefined
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) =>
    value !== undefined
  )) as unknown as PaperTradingEvaluationRecord;
}

function normalizeInput(input: {
  activationId: string;
  activationAttemptId: string;
}) {
  if (input === null || typeof input !== "object" ||
    typeof input.activationId !== "string" ||
    input.activationId.trim() !== input.activationId || !input.activationId ||
    typeof input.activationAttemptId !== "string" ||
    input.activationAttemptId.trim() !== input.activationAttemptId ||
    !input.activationAttemptId) {
    throw new PaperTradingComparisonWindowReaderError(
      "invalid_paper_trading_comparison_window_input",
      "Paper comparison activation and attempt IDs are required."
    );
  }
  return { ...input };
}

function canonicalDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function isExactIso(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function graphInvalid(): PaperTradingComparisonWindowReaderError {
  return new PaperTradingComparisonWindowReaderError(
    "paper_trading_comparison_window_graph_invalid",
    "Paper comparison window graph is unreadable or inconsistent."
  );
}
