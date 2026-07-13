import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  researchControlStudyOutcomeDigestInput,
  researchControlStudyOutcomeHasRuntimeShape,
  researchGeneralizationOutcomeDigestInput,
  researchGeneralizationOutcomeHasRuntimeShape,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationProtocolHasRuntimeShape,
  type ResearchControlStudyOutcomeRecord,
  type ResearchControlStudyRecord,
  type ResearchGeneralizationMarketConditionBlock,
  type ResearchGeneralizationOutcomeBlockResult,
  type ResearchGeneralizationOutcomeRecord,
  type ResearchGeneralizationOutcomeSlotReason,
  type ResearchGeneralizationOutcomeSlotResult,
  type ResearchGeneralizationProtocolRecord,
  type ResearchGeneralizationProtocolStudySlot
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { exactTwoSidedSignTestPValue, researchControlStudyOutcomeId } from
  "./research-control-study-outcome";

export interface DecideResearchGeneralizationOutcomeInput {
  protocol: ResearchGeneralizationProtocolRecord;
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  adjudicatedAt: string;
}

export type ResearchGeneralizationOutcomeAdjudicationRequest = Omit<
  DecideResearchGeneralizationOutcomeInput,
  "adjudicatedAt"
>;

export class ResearchGeneralizationOutcomeDecisionError extends Error {
  readonly code = "invalid_research_generalization_outcome_input";

  constructor() {
    super("ResearchGeneralizationOutcome decision input is invalid.");
    this.name = "ResearchGeneralizationOutcomeDecisionError";
  }
}

export type ResearchGeneralizationOutcomeServiceErrorCode =
  | "research_generalization_outcome_graph_invalid"
  | "research_generalization_outcome_conflict"
  | "research_generalization_outcome_persistence_conflict";

export class ResearchGeneralizationOutcomeServiceError extends Error {
  constructor(
    readonly code: ResearchGeneralizationOutcomeServiceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchGeneralizationOutcomeServiceError";
  }
}

export class ResearchGeneralizationOutcomeService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async adjudicate(
    input: ResearchGeneralizationOutcomeAdjudicationRequest
  ): Promise<ResearchGeneralizationOutcomeRecord> {
    if (!await this.storeGraphMatches(input)) {
      throw new ResearchGeneralizationOutcomeServiceError(
        "research_generalization_outcome_graph_invalid",
        "ResearchGeneralizationOutcome source graph is absent or mismatched."
      );
    }
    const outcomeId = researchGeneralizationOutcomeId(input.protocol);
    const existing = await this.options.store.getResearchGeneralizationOutcome(
      outcomeId
    );
    if (existing) {
      const requested = decideResearchGeneralizationOutcome({
        ...input,
        adjudicatedAt: existing.adjudicated_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchGeneralizationOutcomeServiceError(
          "research_generalization_outcome_conflict",
          "ResearchGeneralizationOutcome conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const outcome = decideResearchGeneralizationOutcome({
      ...input,
      adjudicatedAt: this.now()
    });
    let recorded: ResearchGeneralizationOutcomeRecord;
    try {
      recorded = await this.options.store.recordResearchGeneralizationOutcome(
        outcome
      );
    } catch (error) {
      const winner = await this.options.store.getResearchGeneralizationOutcome(
        outcomeId
      );
      if (winner && isDeepStrictEqual(winner, outcome)) return winner;
      throw new ResearchGeneralizationOutcomeServiceError(
        "research_generalization_outcome_persistence_conflict",
        "ResearchGeneralizationOutcome was not published exactly.",
        { cause: error }
      );
    }
    if (!researchGeneralizationOutcomeHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, outcome)) {
      throw new ResearchGeneralizationOutcomeServiceError(
        "research_generalization_outcome_persistence_conflict",
        "Store did not preserve exact ResearchGeneralizationOutcome evidence."
      );
    }
    return recorded;
  }

  private async storeGraphMatches(
    input: ResearchGeneralizationOutcomeAdjudicationRequest
  ): Promise<boolean> {
    try {
      assertSourceGraph(input);
    } catch {
      return false;
    }
    const protocol = await this.options.store.getResearchGeneralizationProtocol(
      input.protocol.research_generalization_protocol_id
    );
    if (!isDeepStrictEqual(protocol, input.protocol)) return false;
    const persistedStudies = (await Promise.all(
      input.protocol.study_slots.map((slot) =>
        this.options.store.getResearchControlStudy(slot.study_ref.id)
      )
    )).filter((study): study is ResearchControlStudyRecord => Boolean(study));
    if (!sameRecordSet(
      persistedStudies,
      input.studies,
      (study) => study.research_control_study_id
    )) {
      return false;
    }
    const persistedOutcomes = (await Promise.all(persistedStudies.map((study) =>
      this.options.store.getResearchControlStudyOutcome(
        researchControlStudyOutcomeId(study)
      )
    ))).filter((outcome): outcome is ResearchControlStudyOutcomeRecord =>
      Boolean(outcome)
    );
    return sameRecordSet(
      persistedOutcomes,
      input.studyOutcomes,
      (outcome) => outcome.research_control_study_outcome_id
    );
  }
}

export function decideResearchGeneralizationOutcome(
  input: DecideResearchGeneralizationOutcomeInput
): ResearchGeneralizationOutcomeRecord {
  try {
    assertSourceGraph(input);
    const adjudicatedAt = canonicalTime(input.adjudicatedAt);
    if (Date.parse(adjudicatedAt) < Date.parse(input.protocol.committed_at) ||
      input.studyOutcomes.some((outcome) =>
        Date.parse(outcome.adjudicated_at) > Date.parse(adjudicatedAt)
      )) {
      throw invalidDecision();
    }
    const studyById = new Map(input.studies.map((study) => [
      study.research_control_study_id,
      study
    ]));
    const outcomeByStudyId = new Map(input.studyOutcomes.map((outcome) => [
      outcome.study_ref.id,
      outcome
    ]));
    const usedSources = new Map<
      ResearchGeneralizationMarketConditionBlock,
      Set<string>
    >([
      ["long", new Set()],
      ["short", new Set()],
      ["flat", new Set()]
    ]);
    const spacingViolations = studySpacingViolations(
      input.protocol,
      input.studies
    );
    const slotResults = input.protocol.study_slots.map((slot) => {
      const study = studyById.get(slot.study_ref.id);
      if (!study) return missingStudySlot(slot);
      const outcome = outcomeByStudyId.get(study.research_control_study_id);
      if (!outcome) return missingOutcomeSlot(slot, study);
      const reason = studyIneligibilityReason(
        input.protocol,
        slot,
        study,
        spacingViolations.has(study.research_control_study_id)
      );
      if (reason) return terminalSlot(slot, study, outcome, reason);
      const sourceDigest = study.generalization_assignment!
        .source_system_code_artifact_digest;
      const blockSources = usedSources.get(slot.condition_block)!;
      if (blockSources.has(sourceDigest)) {
        return terminalSlot(
          slot,
          study,
          outcome,
          "source_baseline_reused_within_condition_block"
        );
      }
      blockSources.add(sourceDigest);
      return terminalSlot(
        slot,
        study,
        outcome,
        "eligible_terminal_study"
      );
    });
    const allSlotsTerminal = slotResults.every((slot) =>
      slot.study_outcome_ref !== null
    );
    if (!allSlotsTerminal && Date.parse(adjudicatedAt) <
      Date.parse(input.protocol.timing_policy.collection_deadline_at)) {
      throw invalidDecision();
    }
    const blocks = ["long", "short", "flat"] as const;
    const blockResults = blocks.map((block) => blockResult(
      block,
      slotResults.filter((slot) => slot.condition_block === block)
    )) as ResearchGeneralizationOutcomeRecord["block_results"];
    const completed = slotResults.filter((slot) =>
      slot.slot_status === "completed"
    );
    const effects = completed.map((slot) => slot.observed_rate_difference!);
    const adaptivePositive = effects.filter((effect) => effect > 0).length;
    const staticPositive = effects.filter((effect) => effect < 0).length;
    const tied = effects.length - adaptivePositive - staticPositive;
    const nonTied = adaptivePositive + staticPositive;
    const missing = slotResults.filter((slot) =>
      slot.slot_status === "missing_study" ||
      slot.slot_status === "missing_outcome"
    ).length;
    const ineligible = slotResults.filter((slot) =>
      slot.slot_status === "ineligible"
    ).length;
    const distinctBaselines = new Set(completed.map((slot) =>
      slot.baseline_snapshot_digest!
    )).size;
    const blockMeans = blockResults.map((block) =>
      block.mean_rate_difference
    );
    const equalWeightMean = blockMeans.every((mean) => mean !== null)
      ? round6(blockMeans.reduce((sum, mean) => sum + Number(mean), 0) / 3)
      : null;
    const pValue = exactTwoSidedSignTestPValue(
      adaptivePositive,
      staticPositive
    );
    const harmfulBlocks = blockResults.filter((block) =>
      block.mean_rate_difference !== null && block.mean_rate_difference <= 0
    ).map((block) => block.condition_block);
    const sufficient = completed.length === 6 && missing === 0 &&
      ineligible === 0 && nonTied === 6 && distinctBaselines >= 3 &&
      equalWeightMean !== null;
    const supported = sufficient && pValue <=
      input.protocol.analysis_policy.alpha && equalWeightMean > 0 &&
      harmfulBlocks.length === 0;
    const inference = !sufficient
      ? "insufficient_generalization_evidence" as const
      : supported
        ? "generalization_supported" as const
        : "generalization_not_supported" as const;
    const record: ResearchGeneralizationOutcomeRecord = {
      record_kind: "research_generalization_outcome",
      version: 1,
      research_generalization_outcome_id:
        researchGeneralizationOutcomeId(input.protocol),
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: input.protocol.research_generalization_protocol_id
      },
      protocol_digest: input.protocol.protocol_digest,
      target_allocation_policy_digest:
        input.protocol.target_allocation_policy_digest,
      slot_results: slotResults,
      block_results: blockResults,
      planned_study_count: 6,
      completed_study_count: completed.length,
      non_tied_study_count: nonTied,
      tied_study_count: tied,
      missing_study_count: missing,
      ineligible_study_count: ineligible,
      adaptive_positive_count: adaptivePositive,
      static_positive_count: staticPositive,
      distinct_baseline_count: distinctBaselines,
      equal_weight_mean_rate_difference: equalWeightMean,
      exact_sign_test_p_value: pValue,
      harmful_condition_blocks: harmfulBlocks,
      inference_status: inference,
      causal_scope:
        "pre_effect_market_condition_blocked_cross_baseline_study_effects",
      policy_decision_eligibility: supported
        ? "eligible_for_separate_generalization_policy_decision"
        : "not_eligible",
      next_action: inference === "generalization_supported"
        ? "review_broad_research_allocation_policy"
        : inference === "generalization_not_supported"
          ? "retain_negative_generalization_evidence"
          : "complete_or_redesign_generalization_protocol",
      adjudicated_at: adjudicatedAt,
      outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.outcome_digest = canonicalDigest(
      researchGeneralizationOutcomeDigestInput(record)
    );
    if (!researchGeneralizationOutcomeHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchGeneralizationOutcomeDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchGeneralizationOutcomeId(
  protocol: ResearchGeneralizationProtocolRecord
): string {
  const protocolId = canonicalString(
    protocol?.research_generalization_protocol_id
  );
  return `research-generalization-outcome-${
    digestHex(protocolId).slice(0, 20)
  }`;
}

function assertSourceGraph(
  input: ResearchGeneralizationOutcomeAdjudicationRequest
): void {
  if (!input || !researchGeneralizationProtocolHasRuntimeShape(input.protocol) ||
    canonicalDigest(researchGeneralizationProtocolDigestInput(
      input.protocol
    )) !== input.protocol.protocol_digest || !Array.isArray(input.studies) ||
    !Array.isArray(input.studyOutcomes)) {
    throw invalidDecision();
  }
  const expectedStudyIds = new Set(input.protocol.study_slots.map((slot) =>
    slot.study_ref.id
  ));
  const studyIds = input.studies.map((study) =>
    study.research_control_study_id
  );
  if (new Set(studyIds).size !== studyIds.length ||
    studyIds.some((id) => !expectedStudyIds.has(id))) {
    throw invalidDecision();
  }
  for (const study of input.studies) {
    if (!researchControlStudyHasRuntimeShape(study) ||
      canonicalDigest(researchControlStudyDigestInput(study)) !==
        study.study_digest) {
      throw invalidDecision();
    }
  }
  const outcomeIds = input.studyOutcomes.map((outcome) =>
    outcome.research_control_study_outcome_id
  );
  if (new Set(outcomeIds).size !== outcomeIds.length) throw invalidDecision();
  for (const outcome of input.studyOutcomes) {
    const study = input.studies.find((candidate) =>
      candidate.research_control_study_id === outcome.study_ref.id
    );
    if (!study || !researchControlStudyOutcomeHasRuntimeShape(outcome) ||
      canonicalDigest(researchControlStudyOutcomeDigestInput(outcome)) !==
        outcome.study_outcome_digest || outcome.study_digest !==
        study.study_digest || outcome.research_control_study_outcome_id !==
        researchControlStudyOutcomeId(study) ||
      Date.parse(outcome.adjudicated_at) < Date.parse(study.committed_at)) {
      throw invalidDecision();
    }
  }
}

function studyIneligibilityReason(
  protocol: ResearchGeneralizationProtocolRecord,
  slot: ResearchGeneralizationProtocolStudySlot,
  study: ResearchControlStudyRecord,
  spacingViolated: boolean
): Exclude<ResearchGeneralizationOutcomeSlotReason,
  "eligible_terminal_study" | "planned_study_not_committed" |
  "study_outcome_not_terminal" | "source_baseline_reused_within_condition_block"
> | undefined {
  const assignment = study.generalization_assignment;
  if (!assignment || assignment.protocol_ref.id !==
      protocol.research_generalization_protocol_id ||
    assignment.protocol_digest !== protocol.protocol_digest ||
    assignment.slot_index !== slot.slot_index ||
    assignment.condition_block !== slot.condition_block ||
    assignment.condition_block_study_index !==
      slot.condition_block_study_index) {
    return "protocol_assignment_mismatch";
  }
  if (Date.parse(study.committed_at) <= Date.parse(protocol.committed_at) ||
    Date.parse(study.committed_at) >
      Date.parse(protocol.timing_policy.collection_deadline_at)) {
    return "study_commitment_outside_protocol_window";
  }
  if (spacingViolated) return "study_spacing_not_elapsed";
  if (study.idempotency_key !== slot.study_idempotency_key ||
    !isDeepStrictEqual(study.replications.map((replication) =>
      replication.campaign_idempotency_key
    ), slot.replication_idempotency_keys) || !study.replications.every(
      (replication) => replication.expected_baseline_snapshot_digest ===
        study.baseline_snapshot_digest
    ) || !isDeepStrictEqual(
      study.condition.research_agent,
      protocol.research_agent
    ) || !isDeepStrictEqual(
      study.condition.paper_evaluation_protocol,
      protocol.paper_evaluation_protocol
    ) || !isDeepStrictEqual(
      study.condition.campaign_policy,
      protocol.campaign_policy
    ) || !isDeepStrictEqual(
      study.condition.allocation_policy,
      protocol.target_allocation_policy
    ) || study.condition.allocation_policy_digest !==
      protocol.target_allocation_policy_digest || !isDeepStrictEqual(
        assignment.market_condition.classifier_policy,
        protocol.market_classifier_policy
      ) || assignment.market_condition.condition_block !==
        slot.condition_block || assignment.source_system_code_artifact_digest !==
        study.condition.source.system_code_artifact_digest) {
    return "protocol_condition_mismatch";
  }
  return undefined;
}

function studySpacingViolations(
  protocol: ResearchGeneralizationProtocolRecord,
  studies: ResearchControlStudyRecord[]
): Set<string> {
  const violations = new Set<string>();
  const ordered = [...studies].sort((left, right) =>
    left.committed_at.localeCompare(right.committed_at) ||
    left.research_control_study_id.localeCompare(
      right.research_control_study_id
    )
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (Date.parse(ordered[index]!.committed_at) -
      Date.parse(ordered[index - 1]!.committed_at) <
        protocol.timing_policy.minimum_study_commitment_interval_ms) {
      violations.add(ordered[index]!.research_control_study_id);
    }
  }
  return violations;
}

function missingStudySlot(
  slot: ResearchGeneralizationProtocolStudySlot
): ResearchGeneralizationOutcomeSlotResult {
  return {
    ...slotIdentity(slot),
    slot_status: "missing_study",
    status_reason: "planned_study_not_committed",
    study_ref: null,
    study_digest: null,
    study_outcome_ref: null,
    study_outcome_digest: null,
    baseline_snapshot_digest: null,
    source_system_code_artifact_digest: null,
    observed_rate_difference: null,
    study_effect_status: null
  };
}

function missingOutcomeSlot(
  slot: ResearchGeneralizationProtocolStudySlot,
  study: ResearchControlStudyRecord
): ResearchGeneralizationOutcomeSlotResult {
  return {
    ...slotIdentity(slot),
    slot_status: "missing_outcome",
    status_reason: "study_outcome_not_terminal",
    ...studyEvidence(study),
    study_outcome_ref: null,
    study_outcome_digest: null,
    observed_rate_difference: null,
    study_effect_status: null
  };
}

function terminalSlot(
  slot: ResearchGeneralizationProtocolStudySlot,
  study: ResearchControlStudyRecord,
  outcome: ResearchControlStudyOutcomeRecord,
  reason: ResearchGeneralizationOutcomeSlotReason
): ResearchGeneralizationOutcomeSlotResult {
  const effect = outcome.mean_rate_difference;
  return {
    ...slotIdentity(slot),
    slot_status: reason === "eligible_terminal_study"
      ? "completed"
      : "ineligible",
    status_reason: reason,
    ...studyEvidence(study),
    study_outcome_ref: {
      record_kind: "research_control_study_outcome",
      id: outcome.research_control_study_outcome_id
    },
    study_outcome_digest: outcome.study_outcome_digest,
    observed_rate_difference: effect,
    study_effect_status: effect > 0
      ? "adaptive_positive"
      : effect < 0
        ? "static_positive"
        : "tied"
  };
}

function slotIdentity(slot: ResearchGeneralizationProtocolStudySlot) {
  return {
    slot_index: slot.slot_index,
    condition_block: slot.condition_block,
    condition_block_study_index: slot.condition_block_study_index,
    planned_study_ref: { ...slot.study_ref }
  };
}

function studyEvidence(study: ResearchControlStudyRecord) {
  return {
    study_ref: {
      record_kind: "research_control_study",
      id: study.research_control_study_id
    },
    study_digest: study.study_digest,
    baseline_snapshot_digest: study.baseline_snapshot_digest,
    source_system_code_artifact_digest:
      study.condition.source.system_code_artifact_digest
  };
}

function blockResult(
  block: ResearchGeneralizationMarketConditionBlock,
  slots: ResearchGeneralizationOutcomeSlotResult[]
): ResearchGeneralizationOutcomeBlockResult {
  const completed = slots.filter((slot) => slot.slot_status === "completed");
  const effects = completed.map((slot) => slot.observed_rate_difference!);
  const adaptivePositive = effects.filter((effect) => effect > 0).length;
  const staticPositive = effects.filter((effect) => effect < 0).length;
  const tied = effects.length - adaptivePositive - staticPositive;
  const mean = completed.length === 2
    ? round6(effects.reduce((sum, effect) => sum + effect, 0) / 2)
    : null;
  return {
    condition_block: block,
    planned_study_count: 2,
    completed_study_count: completed.length,
    non_tied_study_count: adaptivePositive + staticPositive,
    tied_study_count: tied,
    missing_study_count: slots.filter((slot) =>
      slot.slot_status === "missing_study" ||
      slot.slot_status === "missing_outcome"
    ).length,
    ineligible_study_count: slots.filter((slot) =>
      slot.slot_status === "ineligible"
    ).length,
    adaptive_positive_count: adaptivePositive,
    static_positive_count: staticPositive,
    distinct_baseline_count: new Set(completed.map((slot) =>
      slot.baseline_snapshot_digest!
    )).size,
    mean_rate_difference: mean,
    block_status: mean === null
      ? "incomplete"
      : mean > 0
        ? "complete_positive"
        : "complete_non_positive"
  };
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function sameRecordSet<T>(
  persisted: T[],
  supplied: T[],
  identity: (record: T) => string
): boolean {
  if (persisted.length !== supplied.length) return false;
  const suppliedById = new Map(supplied.map((record) => [
    identity(record),
    record
  ]));
  return suppliedById.size === supplied.length && persisted.every((record) =>
    isDeepStrictEqual(record, suppliedById.get(identity(record)))
  );
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${digestHex(text)}`;
}

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function canonicalString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  const epoch = Date.parse(text);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function invalidDecision(): ResearchGeneralizationOutcomeDecisionError {
  return new ResearchGeneralizationOutcomeDecisionError();
}
