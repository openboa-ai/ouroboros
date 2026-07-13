import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationOutcomeHasRuntimeShape,
  researchGeneralizationPolicyDecisionDigestInput,
  researchGeneralizationPolicyDecisionHasRuntimeShape,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationProtocolHasRuntimeShape,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationPolicyDecisionRecord,
  type ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { researchGeneralizationOutcomeId } from
  "./research-generalization-outcome";

export interface DecideResearchGeneralizationPolicyDecisionInput {
  protocol: ResearchGeneralizationProtocolRecord;
  outcome: ResearchGeneralizationOutcomeRecord;
  decidedAt: string;
}

export type ResearchGeneralizationPolicyDecisionRequest = Omit<
  DecideResearchGeneralizationPolicyDecisionInput,
  "decidedAt"
>;

export class ResearchGeneralizationPolicyDecisionError extends Error {
  readonly code = "invalid_research_generalization_policy_decision_input";

  constructor() {
    super("ResearchGeneralizationPolicyDecision input is invalid.");
    this.name = "ResearchGeneralizationPolicyDecisionError";
  }
}

export type ResearchGeneralizationPolicyDecisionServiceErrorCode =
  | "research_generalization_policy_decision_graph_invalid"
  | "research_generalization_policy_decision_conflict"
  | "research_generalization_policy_decision_persistence_conflict";

export class ResearchGeneralizationPolicyDecisionServiceError extends Error {
  constructor(
    readonly code: ResearchGeneralizationPolicyDecisionServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchGeneralizationPolicyDecisionServiceError";
  }
}

export class ResearchGeneralizationPolicyDecisionService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async decide(
    input: ResearchGeneralizationPolicyDecisionRequest
  ): Promise<ResearchGeneralizationPolicyDecisionRecord> {
    const [protocol, outcome] = await Promise.all([
      this.options.store.getResearchGeneralizationProtocol(
        input.protocol.research_generalization_protocol_id
      ),
      this.options.store.getResearchGeneralizationOutcome(
        input.outcome.research_generalization_outcome_id
      )
    ]);
    if (!isDeepStrictEqual(protocol, input.protocol) ||
      !isDeepStrictEqual(outcome, input.outcome)) {
      throw new ResearchGeneralizationPolicyDecisionServiceError(
        "research_generalization_policy_decision_graph_invalid",
        "ResearchGeneralizationPolicyDecision source graph is absent or mismatched."
      );
    }
    const decisionId = researchGeneralizationPolicyDecisionId(input.outcome);
    const existing = await this.options.store
      .getResearchGeneralizationPolicyDecision(decisionId);
    if (existing) {
      const requested = decideResearchGeneralizationPolicyDecision({
        ...input,
        decidedAt: existing.decided_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchGeneralizationPolicyDecisionServiceError(
          "research_generalization_policy_decision_conflict",
          "ResearchGeneralizationPolicyDecision conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const decision = decideResearchGeneralizationPolicyDecision({
      ...input,
      decidedAt: this.now()
    });
    let recorded: ResearchGeneralizationPolicyDecisionRecord;
    try {
      recorded = await this.options.store
        .recordResearchGeneralizationPolicyDecision(decision);
    } catch {
      return this.reloadExactWinner(input, decisionId);
    }
    if (researchGeneralizationPolicyDecisionHasRuntimeShape(recorded) &&
      isDeepStrictEqual(recorded, decision)) {
      return recorded;
    }
    return this.reloadExactWinner(input, decisionId);
  }

  private async reloadExactWinner(
    input: ResearchGeneralizationPolicyDecisionRequest,
    decisionId: string
  ): Promise<ResearchGeneralizationPolicyDecisionRecord> {
    const winner = await this.options.store
      .getResearchGeneralizationPolicyDecision(decisionId);
    if (winner && researchGeneralizationPolicyDecisionHasRuntimeShape(winner)) {
      let expected: ResearchGeneralizationPolicyDecisionRecord | undefined;
      try {
        expected = decideResearchGeneralizationPolicyDecision({
          ...input,
          decidedAt: winner.decided_at
        });
      } catch {
        expected = undefined;
      }
      if (expected && isDeepStrictEqual(winner, expected)) return winner;
    }
    throw new ResearchGeneralizationPolicyDecisionServiceError(
      "research_generalization_policy_decision_persistence_conflict",
      "Store did not preserve exact ResearchGeneralizationPolicyDecision."
    );
  }
}

export type ResearchGeneralizationPolicyDecisionCoordinationResult =
  | {
      status: "ensured";
      decisionId: string;
      generalizationOutcomeId: string;
      decisionStatus: "approved" | "not_approved";
    }
  | {
      status: "up_to_date";
      generalizationOutcomeCount: number;
    };

export interface ResearchGeneralizationPolicyDecisionCoordinatorLifecycle {
  ensureNextDecision(): Promise<
    ResearchGeneralizationPolicyDecisionCoordinationResult
  >;
}

export class ResearchGeneralizationPolicyDecisionCoordinatorError
extends Error {
  readonly code = "research_generalization_policy_decision_coordination_failed";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchGeneralizationPolicyDecisionCoordinatorError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ResearchGeneralizationPolicyDecisionCoordinator
implements ResearchGeneralizationPolicyDecisionCoordinatorLifecycle {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async ensureNextDecision(): Promise<
    ResearchGeneralizationPolicyDecisionCoordinationResult
  > {
    try {
      return await this.reconcile();
    } catch (error) {
      if (error instanceof ResearchGeneralizationPolicyDecisionCoordinatorError) {
        throw error;
      }
      throw coordinationFailed(
        "ResearchGeneralizationPolicyDecision automatic reconciliation failed closed.",
        error
      );
    }
  }

  private async reconcile(): Promise<
    ResearchGeneralizationPolicyDecisionCoordinationResult
  > {
    const [protocols, outcomes, decisions] = await Promise.all([
      this.options.store.listResearchGeneralizationProtocols(),
      this.options.store.listResearchGeneralizationOutcomes(),
      this.options.store.listResearchGeneralizationPolicyDecisions()
    ]);
    const protocolsById = uniqueBy(
      protocols,
      (protocol) => protocol.research_generalization_protocol_id,
      "ResearchGeneralizationProtocol list contains duplicate identities."
    );
    const outcomesById = uniqueBy(
      outcomes,
      (outcome) => outcome.research_generalization_outcome_id,
      "ResearchGeneralizationOutcome list contains duplicate identities."
    );
    const outcomesByProtocolId = uniqueBy(
      outcomes,
      (outcome) => outcome.protocol_ref.id,
      "ResearchGeneralizationOutcome list contains duplicate protocol refs."
    );
    const decisionsById = uniqueBy(
      decisions,
      (decision) => decision.research_generalization_policy_decision_id,
      "ResearchGeneralizationPolicyDecision list contains duplicate identities."
    );
    const decisionsByOutcomeId = uniqueBy(
      decisions,
      (decision) => decision.generalization_outcome_ref.id,
      "ResearchGeneralizationPolicyDecision list contains duplicate outcome refs."
    );
    void outcomesByProtocolId;
    void decisionsById;
    for (const decision of decisions) {
      if (!outcomesById.has(decision.generalization_outcome_ref.id)) {
        throw coordinationFailed(
          "ResearchGeneralizationPolicyDecision references an absent outcome."
        );
      }
    }

    const orderedOutcomes = [...outcomes].sort((left, right) =>
      left.adjudicated_at.localeCompare(right.adjudicated_at) ||
      left.research_generalization_outcome_id.localeCompare(
        right.research_generalization_outcome_id
      )
    );
    for (const outcome of orderedOutcomes) {
      const protocol = protocolsById.get(outcome.protocol_ref.id);
      if (!protocol) {
        throw coordinationFailed(
          "ResearchGeneralizationOutcome references an absent protocol."
        );
      }
      const existing = decisionsByOutcomeId.get(
        outcome.research_generalization_outcome_id
      );
      if (existing) {
        const reloaded = await new ResearchGeneralizationPolicyDecisionService({
          store: this.options.store
        }).decide({ protocol, outcome });
        if (!isDeepStrictEqual(reloaded, existing)) {
          throw coordinationFailed(
            "ResearchGeneralizationPolicyDecision differs from exact reconciliation."
          );
        }
        continue;
      }

      const decidedAt = this.nextDecisionTime(outcome.adjudicated_at);
      const decision = await new ResearchGeneralizationPolicyDecisionService({
        store: this.options.store,
        now: () => decidedAt
      }).decide({ protocol, outcome });
      return {
        status: "ensured",
        decisionId: decision.research_generalization_policy_decision_id,
        generalizationOutcomeId:
          outcome.research_generalization_outcome_id,
        decisionStatus: decision.decision_status
      };
    }
    return {
      status: "up_to_date",
      generalizationOutcomeCount: outcomes.length
    };
  }

  private nextDecisionTime(adjudicatedAt: string): string {
    const now = canonicalTime(this.now());
    const adjudicated = canonicalTime(adjudicatedAt);
    const nowEpoch = Date.parse(now);
    const adjudicatedEpoch = Date.parse(adjudicated);
    if (nowEpoch < adjudicatedEpoch) {
      throw coordinationFailed(
        "ResearchGeneralizationPolicyDecision clock precedes outcome adjudication."
      );
    }
    if (nowEpoch > adjudicatedEpoch) return now;
    try {
      const next = new Date(nowEpoch + 1).toISOString();
      if (Date.parse(next) <= adjudicatedEpoch) throw new RangeError();
      return next;
    } catch (error) {
      throw coordinationFailed(
        "ResearchGeneralizationPolicyDecision clock cannot advance after adjudication.",
        error
      );
    }
  }
}

export function decideResearchGeneralizationPolicyDecision(
  input: DecideResearchGeneralizationPolicyDecisionInput
): ResearchGeneralizationPolicyDecisionRecord {
  try {
    assertSourceGraph(input.protocol, input.outcome);
    const decidedAt = canonicalTime(input.decidedAt);
    if (Date.parse(decidedAt) <= Date.parse(input.outcome.adjudicated_at)) {
      throw invalidDecision();
    }
    const approved = input.outcome.inference_status ===
        "generalization_supported" &&
      input.outcome.policy_decision_eligibility ===
        "eligible_for_separate_generalization_policy_decision" &&
      input.outcome.causal_scope ===
        "pre_effect_market_condition_blocked_cross_baseline_study_effects" &&
      input.outcome.completed_study_count ===
        input.protocol.analysis_policy.minimum_terminal_study_count &&
      input.outcome.non_tied_study_count ===
        input.protocol.analysis_policy.minimum_non_tied_study_count &&
      input.outcome.missing_study_count === 0 &&
      input.outcome.ineligible_study_count === 0 &&
      input.outcome.distinct_baseline_count >=
        input.protocol.analysis_policy.minimum_distinct_baseline_count &&
      input.outcome.exact_sign_test_p_value <=
        input.protocol.analysis_policy.alpha &&
      input.outcome.equal_weight_mean_rate_difference !== null &&
      input.outcome.equal_weight_mean_rate_difference > 0 &&
      input.outcome.harmful_condition_blocks.length === 0 &&
      input.outcome.block_results.every((block) =>
        block.block_status === "complete_positive"
      );
    const decision: ResearchGeneralizationPolicyDecisionRecord = {
      record_kind: "research_generalization_policy_decision",
      version: 1,
      research_generalization_policy_decision_id:
        researchGeneralizationPolicyDecisionId(input.outcome),
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: input.protocol.research_generalization_protocol_id
      },
      protocol_digest: input.protocol.protocol_digest,
      generalization_outcome_ref: {
        record_kind: "research_generalization_outcome",
        id: input.outcome.research_generalization_outcome_id
      },
      generalization_outcome_digest: input.outcome.outcome_digest,
      target_allocation_policy_digest:
        input.protocol.target_allocation_policy_digest,
      decision_policy: {
        policy_version: "generalization_supported_adaptive_v1",
        target_allocation_mode: "adaptive_default",
        required_inference_status: "generalization_supported",
        required_causal_scope:
          "pre_effect_market_condition_blocked_cross_baseline_study_effects",
        required_policy_decision_eligibility:
          "eligible_for_separate_generalization_policy_decision",
        application_scope: "future_uncontrolled_candidate_arena_ticks"
      },
      decision_status: approved ? "approved" : "not_approved",
      decision_reason: approved
        ? "supported_cross_condition_adaptive_effect"
        : "generalization_outcome_not_eligible",
      effective_default_mode: approved ? "adaptive_default" : null,
      decided_at: decidedAt,
      policy_decision_digest: pendingDigest(),
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_policy_only"
    };
    decision.policy_decision_digest = canonicalDigest(
      researchGeneralizationPolicyDecisionDigestInput(decision)
    );
    if (!researchGeneralizationPolicyDecisionHasRuntimeShape(decision)) {
      throw invalidDecision();
    }
    return decision;
  } catch (error) {
    if (error instanceof ResearchGeneralizationPolicyDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchGeneralizationPolicyDecisionId(
  outcome: ResearchGeneralizationOutcomeRecord
): string {
  const outcomeId = canonicalString(
    outcome?.research_generalization_outcome_id
  );
  return `research-generalization-policy-decision-${
    createHash("sha256").update(outcomeId).digest("hex").slice(0, 20)
  }`;
}

function assertSourceGraph(
  protocol: ResearchGeneralizationProtocolRecord,
  outcome: ResearchGeneralizationOutcomeRecord
): void {
  if (!researchGeneralizationProtocolHasRuntimeShape(protocol) ||
    canonicalDigest(researchGeneralizationProtocolDigestInput(protocol)) !==
      protocol.protocol_digest ||
    canonicalDigest(protocol.target_allocation_policy) !==
      protocol.target_allocation_policy_digest ||
    !researchGeneralizationOutcomeHasRuntimeShape(outcome) ||
    canonicalDigest(researchGeneralizationOutcomeDigestInput(outcome)) !==
      outcome.outcome_digest ||
    outcome.research_generalization_outcome_id !==
      researchGeneralizationOutcomeId(protocol) ||
    outcome.protocol_ref.id !==
      protocol.research_generalization_protocol_id ||
    outcome.protocol_digest !== protocol.protocol_digest ||
    outcome.target_allocation_policy_digest !==
      protocol.target_allocation_policy_digest ||
    Date.parse(outcome.adjudicated_at) < Date.parse(protocol.committed_at)) {
    throw invalidDecision();
  }
}

function canonicalDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function canonicalString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function invalidDecision(): ResearchGeneralizationPolicyDecisionError {
  return new ResearchGeneralizationPolicyDecisionError();
}

function uniqueBy<T>(
  values: T[],
  key: (value: T) => string,
  duplicateMessage: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw coordinationFailed(duplicateMessage);
    result.set(id, value);
  }
  return result;
}

function coordinationFailed(
  message: string,
  cause?: unknown
): ResearchGeneralizationPolicyDecisionCoordinatorError {
  return new ResearchGeneralizationPolicyDecisionCoordinatorError(
    message,
    cause === undefined ? undefined : { cause }
  );
}
