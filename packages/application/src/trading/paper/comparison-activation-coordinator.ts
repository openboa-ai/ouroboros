import { createHash } from "node:crypto";
import {
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationHasRuntimeShape,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonCommitmentHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSideHasRuntimeShape,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTickHasRuntimeShape,
  type PaperTradingComparisonActivationRecord,
  type PaperTradingComparisonActivationSide,
  type PaperTradingComparisonCommitmentRecord,
  type PaperTradingComparisonSide,
  type PaperTradingComparisonTickRecord
} from "@ouroboros/domain";
import { isStoreErrorLike, type OuroborosStorePort } from "../../ports/store";
import type {
  PaperTradingComparisonCoordinator,
  VerifiedPaperTradingComparisonCommitmentGraph
} from "./comparison-coordinator";

export type PaperTradingComparisonActivationErrorCode =
  | "invalid_paper_trading_comparison_activation_input"
  | "paper_trading_comparison_not_found"
  | "paper_trading_comparison_activation_graph_invalid"
  | "paper_trading_comparison_activation_first_tick_missing"
  | "paper_trading_comparison_activation_first_tick_conflict"
  | "paper_trading_comparison_activation_idempotency_conflict"
  | "paper_trading_comparison_activation_conflict"
  | "paper_trading_comparison_activation_time_invalid"
  | "paper_trading_comparison_activation_persistence_failed";

export class PaperTradingComparisonActivationError extends Error {
  constructor(
    readonly code: PaperTradingComparisonActivationErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PaperTradingComparisonActivationError";
  }
}

export interface PaperTradingComparisonActivationCoordinatorOptions {
  store: OuroborosStorePort;
  comparisons: Pick<PaperTradingComparisonCoordinator, "reload">;
  now?: () => string;
}

export interface AuthorizedPaperTradingComparisonActivation {
  comparison: VerifiedPaperTradingComparisonCommitmentGraph;
  firstTick: PaperTradingComparisonTickRecord;
  activation: PaperTradingComparisonActivationRecord;
  runtimeEffects: "not_started";
}

export class PaperTradingComparisonActivationCoordinator {
  private readonly now: () => string;
  private authorizationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: PaperTradingComparisonActivationCoordinatorOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  authorize(input: {
    comparisonId: string;
    idempotencyKey: string;
  }): Promise<AuthorizedPaperTradingComparisonActivation> {
    return this.withAuthorizationQueue(() => this.authorizeUnlocked(input));
  }

  private withAuthorizationQueue<T>(task: () => Promise<T>): Promise<T> {
    const queued = this.authorizationQueue.then(task);
    this.authorizationQueue = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  private async authorizeUnlocked(input: {
    comparisonId: string;
    idempotencyKey: string;
  }): Promise<AuthorizedPaperTradingComparisonActivation> {
    if (
      !isRecord(input) ||
      typeof input.comparisonId !== "string" ||
      typeof input.idempotencyKey !== "string"
    ) {
      throw new PaperTradingComparisonActivationError(
        "invalid_paper_trading_comparison_activation_input",
        "Paper comparison ID and activation idempotency key are required."
      );
    }
    const comparisonId = input.comparisonId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    if (!comparisonId || !idempotencyKey) {
      throw new PaperTradingComparisonActivationError(
        "invalid_paper_trading_comparison_activation_input",
        "Paper comparison ID and activation idempotency key are required."
      );
    }

    const activationId = comparisonActivationId(comparisonId, idempotencyKey);
    const existing = await this.readActivation(activationId);
    const comparison = await this.loadVerifiedComparison(comparisonId);
    const firstTick = await this.loadSoleFirstTick(comparison);

    if (existing) {
      this.assertActivationMatches(
        existing,
        comparison.commitment,
        firstTick,
        activationId,
        undefined,
        "paper_trading_comparison_activation_idempotency_conflict"
      );
      const activations = await this.readActivations(comparisonId);
      if (
        activations.some((record) =>
          record.paper_trading_comparison_activation_id !== activationId
        )
      ) {
        throw new PaperTradingComparisonActivationError(
          "paper_trading_comparison_activation_conflict",
          "Paper comparison already has a different activation authorization."
        );
      }
      if (
        activations.length !== 1 ||
        !samePersistedRecord(activations[0], existing)
      ) {
        throw new PaperTradingComparisonActivationError(
          "paper_trading_comparison_activation_idempotency_conflict",
          "Persisted activation authorization is not singular and exact."
        );
      }
      return activationResult(comparison, firstTick, existing);
    }

    const current = await this.readActivations(comparisonId);
    if (current.length > 0) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_conflict",
        "Paper comparison already has a different activation authorization."
      );
    }

    const authorizedAt = this.now();
    if (
      !exactIsoTimestamp(authorizedAt) ||
      Date.parse(authorizedAt) < Date.parse(firstTick.observed_at)
    ) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_time_invalid",
        "Activation authorization time must be an exact ISO time at or after the first tick."
      );
    }
    const activation = buildActivation(
      comparison.commitment,
      firstTick,
      activationId,
      authorizedAt
    );

    try {
      await this.options.store.recordPaperTradingComparisonActivation(activation);
    } catch (error) {
      if (
        isStoreErrorLike(error) &&
        error.code === "paper_trading_comparison_activation_pair_conflict"
      ) {
        throw new PaperTradingComparisonActivationError(
          "paper_trading_comparison_activation_conflict",
          "Paper comparison already has a different activation authorization."
        );
      }
      if (
        isStoreErrorLike(error) &&
        error.code === "paper_trading_comparison_activation_conflict"
      ) {
        throw new PaperTradingComparisonActivationError(
          "paper_trading_comparison_activation_idempotency_conflict",
          "The deterministic activation identity already has different content."
        );
      }
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_persistence_failed",
        "Paper comparison activation authorization could not be persisted.",
        isStoreErrorLike(error) ? { reason: error.code } : {}
      );
    }

    let persisted: PaperTradingComparisonActivationRecord | undefined;
    let reloadedComparison: VerifiedPaperTradingComparisonCommitmentGraph;
    let reloadedTick: PaperTradingComparisonTickRecord;
    let persistedActivations: PaperTradingComparisonActivationRecord[];
    try {
      persisted = await this.options.store.getPaperTradingComparisonActivation(activationId);
      reloadedComparison = await this.loadVerifiedComparison(comparisonId);
      reloadedTick = await this.loadSoleFirstTick(reloadedComparison);
      persistedActivations = await this.readActivations(comparisonId);
    } catch {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_persistence_failed",
        "Persisted activation authorization closure could not be reloaded."
      );
    }
    if (!persisted) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_persistence_failed",
        "Persisted activation authorization was not found."
      );
    }
    this.assertActivationMatches(
      persisted,
      reloadedComparison.commitment,
      reloadedTick,
      activationId,
      authorizedAt,
      "paper_trading_comparison_activation_persistence_failed"
    );
    if (
      persistedActivations.length !== 1 ||
      !samePersistedRecord(persistedActivations[0], persisted) ||
      !samePersistedRecord(persisted, activation)
    ) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_persistence_failed",
        "Persisted activation authorization is not singular and exact."
      );
    }
    return activationResult(reloadedComparison, reloadedTick, persisted);
  }

  private async loadVerifiedComparison(
    comparisonId: string
  ): Promise<VerifiedPaperTradingComparisonCommitmentGraph> {
    let value: unknown;
    try {
      value = await this.options.comparisons.reload(comparisonId);
    } catch {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_graph_invalid",
        "Paper comparison commitment graph could not be verified."
      );
    }
    if (value === undefined) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_not_found",
        "Paper comparison commitment was not found."
      );
    }
    if (!isRecord(value) || !isRecord(value.verification)) {
      throw invalidGraph();
    }
    const commitment = value.commitment;
    const champion = value.champion;
    const challenger = value.challenger;
    if (
      !paperTradingComparisonCommitmentHasRuntimeShape(commitment) ||
      commitment.paper_trading_comparison_commitment_id !== comparisonId ||
      commitment.commitment_digest !== tryDigest(() =>
        paperTradingComparisonCommitmentDigestInput(commitment)
      ) ||
      value.verification.status !== "verified" ||
      value.verification.activation_authority !== "not_granted" ||
      !isRecord(champion) ||
      !isRecord(challenger) ||
      !paperTradingComparisonSideHasRuntimeShape(champion.side, "champion") ||
      !paperTradingComparisonSideHasRuntimeShape(challenger.side, "challenger") ||
      !samePersistedRecord(champion.side, commitment.champion) ||
      !samePersistedRecord(challenger.side, commitment.challenger)
    ) {
      throw invalidGraph();
    }
    return value as unknown as VerifiedPaperTradingComparisonCommitmentGraph;
  }

  private async loadSoleFirstTick(
    comparison: VerifiedPaperTradingComparisonCommitmentGraph
  ): Promise<PaperTradingComparisonTickRecord> {
    let value: unknown;
    try {
      value = await this.options.store.listPaperTradingComparisonTicks(
        comparison.commitment.paper_trading_comparison_commitment_id
      );
    } catch {
      throw invalidGraph();
    }
    if (!Array.isArray(value)) {
      throw invalidGraph();
    }
    if (value.length === 0) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_first_tick_missing",
        "Paper comparison first tick was not found."
      );
    }
    if (value.length !== 1) {
      throw new PaperTradingComparisonActivationError(
        "paper_trading_comparison_activation_first_tick_conflict",
        "Paper comparison first-tick collection is not singular."
      );
    }
    const tick = value[0];
    if (
      !paperTradingComparisonTickHasRuntimeShape(tick) ||
      tick.tick_digest !== tryDigest(() => paperTradingComparisonTickDigestInput(tick)) ||
      tick.paper_trading_comparison_commitment_ref.id !==
        comparison.commitment.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !==
        comparison.commitment.commitment_digest ||
      tick.market_data_configuration_digest !==
        comparison.commitment.market_data_configuration_digest ||
      Date.parse(tick.observed_at) < Date.parse(comparison.commitment.committed_at) ||
      Date.parse(tick.observed_at) < Date.parse(tick.market_snapshot.observed_at) ||
      Date.parse(tick.observed_at) <
        Date.parse(tick.public_execution_snapshot.observed_at)
    ) {
      throw invalidGraph();
    }
    return tick;
  }

  private async readActivation(
    activationId: string
  ): Promise<PaperTradingComparisonActivationRecord | undefined> {
    let value: unknown;
    try {
      value = await this.options.store.getPaperTradingComparisonActivation(activationId);
    } catch {
      throw invalidGraph();
    }
    if (value === undefined) {
      return undefined;
    }
    if (
      !paperTradingComparisonActivationHasRuntimeShape(value) ||
      value.activation_digest !== tryDigest(() =>
        paperTradingComparisonActivationDigestInput(value)
      )
    ) {
      throw invalidGraph();
    }
    return value;
  }

  private async readActivations(
    comparisonId: string
  ): Promise<PaperTradingComparisonActivationRecord[]> {
    let value: unknown;
    try {
      value = await this.options.store.listPaperTradingComparisonActivations(comparisonId);
    } catch {
      throw invalidGraph();
    }
    if (!Array.isArray(value)) {
      throw invalidGraph();
    }
    const records: PaperTradingComparisonActivationRecord[] = [];
    for (const record of value) {
      if (
        !paperTradingComparisonActivationHasRuntimeShape(record) ||
        record.activation_digest !== tryDigest(() =>
          paperTradingComparisonActivationDigestInput(record)
        ) ||
        record.paper_trading_comparison_commitment_ref.id !== comparisonId
      ) {
        throw invalidGraph();
      }
      records.push(record);
    }
    return records;
  }

  private assertActivationMatches(
    value: unknown,
    comparison: PaperTradingComparisonCommitmentRecord,
    firstTick: PaperTradingComparisonTickRecord,
    activationId: string,
    expectedAuthorizedAt: string | undefined,
    errorCode:
      | "paper_trading_comparison_activation_idempotency_conflict"
      | "paper_trading_comparison_activation_persistence_failed"
  ): asserts value is PaperTradingComparisonActivationRecord {
    if (!paperTradingComparisonActivationHasRuntimeShape(value)) {
      throw new PaperTradingComparisonActivationError(
        errorCode,
        "Activation authorization has invalid persisted shape."
      );
    }
    const authorizedAt = expectedAuthorizedAt ?? value.authorized_at;
    const expected = buildActivation(
      comparison,
      firstTick,
      activationId,
      authorizedAt
    );
    if (
      value.activation_digest !== tryDigest(() =>
        paperTradingComparisonActivationDigestInput(value)
      ) ||
      Date.parse(value.authorized_at) < Date.parse(firstTick.observed_at) ||
      !samePersistedRecord(value, expected)
    ) {
      throw new PaperTradingComparisonActivationError(
        errorCode,
        "Activation authorization does not match its verified pair and first tick."
      );
    }
  }
}

function buildActivation(
  comparison: PaperTradingComparisonCommitmentRecord,
  firstTick: PaperTradingComparisonTickRecord,
  activationId: string,
  authorizedAt: string
): PaperTradingComparisonActivationRecord {
  const draft: PaperTradingComparisonActivationRecord = {
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: activationId,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: firstTick.paper_trading_comparison_tick_id
    },
    first_tick_digest: firstTick.tick_digest,
    champion: activationSide(comparison.champion),
    challenger: activationSide(comparison.challenger),
    market_data_configuration_digest: comparison.market_data_configuration_digest,
    activation_policy: paperTradingComparisonActivationPolicyFor(
      comparison.comparison_policy
    ),
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: authorizedAt,
    activation_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  };
  return {
    ...draft,
    activation_digest: digest(paperTradingComparisonActivationDigestInput(draft))
  };
}

function activationSide(
  side: PaperTradingComparisonSide
): PaperTradingComparisonActivationSide {
  return {
    role: side.role,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...side.paper_trading_evaluation_commitment_ref
    },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref }
  };
}

function comparisonActivationId(comparisonId: string, idempotencyKey: string): string {
  const suffix = createHash("sha256")
    .update(`${comparisonId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 16);
  return `paper-trading-comparison-activation-${suffix}`;
}

function activationResult(
  comparison: VerifiedPaperTradingComparisonCommitmentGraph,
  firstTick: PaperTradingComparisonTickRecord,
  activation: PaperTradingComparisonActivationRecord
): AuthorizedPaperTradingComparisonActivation {
  return {
    comparison,
    firstTick: structuredClone(firstTick),
    activation: structuredClone(activation),
    runtimeEffects: "not_started"
  };
}

function invalidGraph(): PaperTradingComparisonActivationError {
  return new PaperTradingComparisonActivationError(
    "paper_trading_comparison_activation_graph_invalid",
    "Paper comparison activation closure is missing, malformed, or inconsistent."
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function samePersistedRecord(left: unknown, right: unknown): boolean {
  try {
    return paperTradingComparisonPersistedRecordDigestInput(left) ===
      paperTradingComparisonPersistedRecordDigestInput(right);
  } catch {
    return false;
  }
}

function digest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function tryDigest(input: () => string): string | undefined {
  try {
    return digest(input());
  } catch {
    return undefined;
  }
}
