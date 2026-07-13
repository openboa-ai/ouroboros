import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchAllocationPolicyDecisionDigestInput,
  researchAllocationPolicyDecisionHasRuntimeShape,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  type ResearchAllocationPolicyDecisionRecord,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { researchControlStudyOutcomeId } from
  "./research-control-study-outcome";

export interface DecideResearchAllocationPolicyDecisionInput {
  study: ResearchControlStudyRecord;
  outcome: ResearchControlStudyOutcomeRecord;
  decidedAt: string;
}

export type ResearchAllocationPolicyDecisionRequest = Omit<
  DecideResearchAllocationPolicyDecisionInput,
  "decidedAt"
>;

export class ResearchAllocationPolicyDecisionError extends Error {
  readonly code = "invalid_research_allocation_policy_decision_input";

  constructor() {
    super("ResearchAllocationPolicyDecision input is invalid.");
    this.name = "ResearchAllocationPolicyDecisionError";
  }
}

export type ResearchAllocationPolicyDecisionServiceErrorCode =
  | "research_allocation_policy_decision_graph_invalid"
  | "research_allocation_policy_decision_conflict"
  | "research_allocation_policy_decision_persistence_conflict";

export class ResearchAllocationPolicyDecisionServiceError extends Error {
  constructor(
    readonly code: ResearchAllocationPolicyDecisionServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchAllocationPolicyDecisionServiceError";
  }
}

export class ResearchAllocationPolicyDecisionService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async decide(
    input: ResearchAllocationPolicyDecisionRequest
  ): Promise<ResearchAllocationPolicyDecisionRecord> {
    const [study, outcome] = await Promise.all([
      this.options.store.getResearchControlStudy(
        input.study.research_control_study_id
      ),
      this.options.store.getResearchControlStudyOutcome(
        input.outcome.research_control_study_outcome_id
      )
    ]);
    if (!isDeepStrictEqual(study, input.study) ||
      !isDeepStrictEqual(outcome, input.outcome)) {
      throw new ResearchAllocationPolicyDecisionServiceError(
        "research_allocation_policy_decision_graph_invalid",
        "ResearchAllocationPolicyDecision source graph is absent or mismatched."
      );
    }
    const decisionId = researchAllocationPolicyDecisionId(input.outcome);
    const existing = await this.options.store
      .getResearchAllocationPolicyDecision(decisionId);
    if (existing) {
      const requested = decideResearchAllocationPolicyDecision({
        ...input,
        decidedAt: existing.decided_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchAllocationPolicyDecisionServiceError(
          "research_allocation_policy_decision_conflict",
          "ResearchAllocationPolicyDecision conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const decision = decideResearchAllocationPolicyDecision({
      ...input,
      decidedAt: this.now()
    });
    let recorded: ResearchAllocationPolicyDecisionRecord;
    try {
      recorded = await this.options.store
        .recordResearchAllocationPolicyDecision(decision);
    } catch {
      return this.reloadExactWinner(input, decisionId);
    }
    if (researchAllocationPolicyDecisionHasRuntimeShape(recorded) &&
      isDeepStrictEqual(recorded, decision)) {
      return recorded;
    }
    return this.reloadExactWinner(input, decisionId);
  }

  private async reloadExactWinner(
    input: ResearchAllocationPolicyDecisionRequest,
    decisionId: string
  ): Promise<ResearchAllocationPolicyDecisionRecord> {
    const winner = await this.options.store
      .getResearchAllocationPolicyDecision(decisionId);
    if (winner && researchAllocationPolicyDecisionHasRuntimeShape(winner)) {
      let expected: ResearchAllocationPolicyDecisionRecord | undefined;
      try {
        expected = decideResearchAllocationPolicyDecision({
          ...input,
          decidedAt: winner.decided_at
        });
      } catch {
        expected = undefined;
      }
      if (expected && isDeepStrictEqual(winner, expected)) return winner;
    }
    throw new ResearchAllocationPolicyDecisionServiceError(
      "research_allocation_policy_decision_persistence_conflict",
      "Store did not preserve exact ResearchAllocationPolicyDecision."
    );
  }
}

export function decideResearchAllocationPolicyDecision(
  input: DecideResearchAllocationPolicyDecisionInput
): ResearchAllocationPolicyDecisionRecord {
  try {
    assertSourceGraph(input.study, input.outcome);
    const decidedAt = canonicalTime(input.decidedAt);
    if (Date.parse(decidedAt) <= Date.parse(input.outcome.adjudicated_at)) {
      throw invalidDecision();
    }
    const approved = input.outcome.inference_status ===
        "adaptive_effect_supported" &&
      input.outcome.policy_decision_eligibility ===
        "eligible_for_separate_policy_decision" &&
      input.outcome.causal_scope ===
        "same_baseline_stochastic_replication_only" &&
      input.outcome.non_tied_count >=
        input.study.analysis_policy.minimum_non_tied_replication_count &&
      input.outcome.adaptive_positive_count >
        input.outcome.static_positive_count &&
      input.outcome.exact_sign_test_p_value <=
        input.study.analysis_policy.alpha &&
      input.outcome.mean_rate_difference >
        input.study.analysis_policy.minimum_mean_rate_difference;
    const decision: ResearchAllocationPolicyDecisionRecord = {
      record_kind: "research_allocation_policy_decision",
      version: 1,
      research_allocation_policy_decision_id:
        researchAllocationPolicyDecisionId(input.outcome),
      study_ref: {
        record_kind: "research_control_study",
        id: input.study.research_control_study_id
      },
      study_digest: input.study.study_digest,
      study_outcome_ref: {
        record_kind: "research_control_study_outcome",
        id: input.outcome.research_control_study_outcome_id
      },
      study_outcome_digest: input.outcome.study_outcome_digest,
      target_allocation_policy_digest:
        input.study.condition.allocation_policy_digest,
      decision_policy: {
        policy_version: "adaptive_supported_effect_v1",
        target_allocation_mode: "adaptive_default",
        required_inference_status: "adaptive_effect_supported",
        required_causal_scope: "same_baseline_stochastic_replication_only",
        required_policy_decision_eligibility:
          "eligible_for_separate_policy_decision",
        application_scope: "future_uncontrolled_candidate_arena_ticks"
      },
      decision_status: approved ? "approved" : "not_approved",
      decision_reason: approved
        ? "supported_same_baseline_adaptive_effect"
        : "study_outcome_not_eligible",
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
      researchAllocationPolicyDecisionDigestInput(decision)
    );
    if (!researchAllocationPolicyDecisionHasRuntimeShape(decision)) {
      throw invalidDecision();
    }
    return decision;
  } catch (error) {
    if (error instanceof ResearchAllocationPolicyDecisionError) throw error;
    throw invalidDecision();
  }
}

export function researchAllocationPolicyDecisionId(
  outcome: ResearchControlStudyOutcomeRecord
): string {
  const outcomeId = canonicalString(
    outcome?.research_control_study_outcome_id
  );
  return `research-allocation-policy-decision-${
    createHash("sha256").update(outcomeId).digest("hex").slice(0, 20)
  }`;
}

function assertSourceGraph(
  study: ResearchControlStudyRecord,
  outcome: ResearchControlStudyOutcomeRecord
): void {
  if (!researchControlStudyHasRuntimeShape(study) ||
    canonicalDigest(researchControlStudyConditionDigestInput(
      study.condition
    )) !== study.condition.condition_digest ||
    canonicalDigest(researchControlStudyDigestInput(study)) !==
      study.study_digest || canonicalDigest(study.condition.allocation_policy) !==
      study.condition.allocation_policy_digest ||
    !researchControlStudyOutcomeHasRuntimeShape(outcome) ||
    canonicalDigest(researchControlStudyOutcomeDigestInput(outcome)) !==
      outcome.study_outcome_digest || outcome.research_control_study_outcome_id !==
      researchControlStudyOutcomeId(study) || outcome.study_ref.id !==
      study.research_control_study_id || outcome.study_digest !==
      study.study_digest || outcome.replication_results.length !==
      study.replications.length || outcome.replication_results.some(
        (result, index) => result.replication_index !== index + 1 ||
          result.campaign_ref.id !== study.replications[index]!.campaign_ref.id
      ) || Date.parse(outcome.adjudicated_at) < Date.parse(study.committed_at)) {
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

function invalidDecision(): ResearchAllocationPolicyDecisionError {
  return new ResearchAllocationPolicyDecisionError();
}
