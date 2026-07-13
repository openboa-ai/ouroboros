import type {
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchGeneralizationActiveProtocolReadModel,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchGeneralizationProtocolRecord,
  ResearchGeneralizationProtocolStudySlot,
  ResearchGeneralizationReadModel
} from "@ouroboros/domain";

export interface BuildResearchGeneralizationReadModelInput {
  protocols: ResearchGeneralizationProtocolRecord[];
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  outcomes: ResearchGeneralizationOutcomeRecord[];
  decisions: ResearchGeneralizationPolicyDecisionRecord[];
}

export class ResearchGeneralizationReadModelError extends Error {
  readonly code = "research_generalization_read_model_graph_invalid";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchGeneralizationReadModelError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const CONDITION_BLOCKS = ["long", "short", "flat"] as const;

export function buildResearchGeneralizationReadModel(
  input: BuildResearchGeneralizationReadModelInput
): ResearchGeneralizationReadModel {
  try {
    return projectResearchGeneralization(input);
  } catch (error) {
    if (error instanceof ResearchGeneralizationReadModelError) throw error;
    throw graphInvalid(
      "ResearchGeneralization read-model source graph is invalid.",
      error
    );
  }
}

function projectResearchGeneralization(
  input: BuildResearchGeneralizationReadModelInput
): ResearchGeneralizationReadModel {
  if (!Array.isArray(input?.protocols) || !Array.isArray(input.studies) ||
    !Array.isArray(input.studyOutcomes) || !Array.isArray(input.outcomes) ||
    !Array.isArray(input.decisions)) {
    throw graphInvalid("ResearchGeneralization read-model arrays are required.");
  }
  const protocolsById = uniqueBy(
    input.protocols,
    (protocol) => protocol.research_generalization_protocol_id,
    "ResearchGeneralizationProtocol identities must be unique."
  );
  const studiesById = uniqueBy(
    input.studies,
    (study) => study.research_control_study_id,
    "ResearchControlStudy identities must be unique."
  );
  uniqueBy(
    input.studyOutcomes,
    (outcome) => outcome.research_control_study_outcome_id,
    "ResearchControlStudyOutcome identities must be unique."
  );
  const studyOutcomesByStudyId = uniqueBy(
    input.studyOutcomes,
    (outcome) => outcome.study_ref.id,
    "ResearchControlStudyOutcome study refs must be unique."
  );
  const outcomesById = uniqueBy(
    input.outcomes,
    (outcome) => outcome.research_generalization_outcome_id,
    "ResearchGeneralizationOutcome identities must be unique."
  );
  const outcomesByProtocolId = uniqueBy(
    input.outcomes,
    (outcome) => outcome.protocol_ref.id,
    "ResearchGeneralizationOutcome protocol refs must be unique."
  );
  uniqueBy(
    input.decisions,
    (decision) => decision.research_generalization_policy_decision_id,
    "ResearchGeneralizationPolicyDecision identities must be unique."
  );
  uniqueBy(
    input.decisions,
    (decision) => decision.generalization_outcome_ref.id,
    "ResearchGeneralizationPolicyDecision outcome refs must be unique."
  );

  for (const outcome of input.studyOutcomes) {
    if (!studiesById.has(outcome.study_ref.id)) {
      throw graphInvalid(
        "ResearchControlStudyOutcome references an absent study."
      );
    }
  }
  for (const outcome of input.outcomes) {
    if (!protocolsById.has(outcome.protocol_ref.id)) {
      throw graphInvalid(
        "ResearchGeneralizationOutcome references an absent protocol."
      );
    }
    if (outcome.policy_replacement_authority !== false ||
      outcome.promotion_authority !== false ||
      outcome.order_submission_authority !== false ||
      outcome.live_exchange_authority !== false ||
      outcome.authority_status !== "not_live") {
      throw graphInvalid(
        "ResearchGeneralizationOutcome authority is not closed."
      );
    }
  }
  for (const decision of input.decisions) {
    const protocol = protocolsById.get(decision.protocol_ref.id);
    const outcome = outcomesById.get(
      decision.generalization_outcome_ref.id
    );
    if (!protocol || !outcome) {
      throw graphInvalid(
        "ResearchGeneralizationPolicyDecision references absent evidence."
      );
    }
    const approved = outcome.inference_status ===
        "generalization_supported" &&
      outcome.policy_decision_eligibility ===
        "eligible_for_separate_generalization_policy_decision";
    if (outcome.protocol_ref.id !==
        protocol.research_generalization_protocol_id ||
      decision.protocol_digest !== protocol.protocol_digest ||
      outcome.protocol_digest !== protocol.protocol_digest ||
      decision.generalization_outcome_digest !== outcome.outcome_digest ||
      decision.target_allocation_policy_digest !==
        protocol.target_allocation_policy_digest ||
      outcome.target_allocation_policy_digest !==
        protocol.target_allocation_policy_digest ||
      Date.parse(decision.decided_at) <= Date.parse(outcome.adjudicated_at) ||
      decision.decision_status !== (approved ? "approved" : "not_approved") ||
      decision.decision_reason !== (approved
        ? "supported_cross_condition_adaptive_effect"
        : "generalization_outcome_not_eligible") ||
      decision.effective_default_mode !== (approved
        ? "adaptive_default"
        : null) || decision.research_policy_selection_authority !== true ||
      decision.evaluation_authority !== false ||
      decision.promotion_authority !== false ||
      decision.order_submission_authority !== false ||
      decision.live_exchange_authority !== false ||
      decision.authority_status !== "research_policy_only") {
      throw graphInvalid(
        "ResearchGeneralizationPolicyDecision differs from its evidence."
      );
    }
  }

  const slotsByKey = protocolSlots(input.protocols);
  const assignedStudyBySlotKey = new Map<string, ResearchControlStudyRecord>();
  for (const study of input.studies) {
    const assignment = study.generalization_assignment;
    if (!assignment) continue;
    const protocol = protocolsById.get(assignment.protocol_ref.id);
    const key = slotKey(assignment.protocol_ref.id, assignment.slot_index);
    const slot = slotsByKey.get(key);
    if (!protocol || !slot || slot.protocol !== protocol ||
      assignment.protocol_digest !== protocol.protocol_digest ||
      slot.slot.study_ref.id !== study.research_control_study_id ||
      assignment.condition_block !== slot.slot.condition_block ||
      assignment.condition_block_study_index !==
        slot.slot.condition_block_study_index ||
      assignedStudyBySlotKey.has(key)) {
      throw graphInvalid(
        "ResearchControlStudy generalization assignment does not match its slot."
      );
    }
    assignedStudyBySlotKey.set(key, study);
  }

  const orderedActive = input.protocols
    .filter((protocol) => !outcomesByProtocolId.has(
      protocol.research_generalization_protocol_id
    ))
    .sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_generalization_protocol_id.localeCompare(
        right.research_generalization_protocol_id
      )
    );
  const latestOutcome = [...input.outcomes].sort((left, right) =>
    right.adjudicated_at.localeCompare(left.adjudicated_at) ||
    right.research_generalization_outcome_id.localeCompare(
      left.research_generalization_outcome_id
    )
  )[0];
  const latestDecision = [...input.decisions].sort((left, right) =>
    right.decided_at.localeCompare(left.decided_at) ||
    right.research_generalization_policy_decision_id.localeCompare(
      left.research_generalization_policy_decision_id
    )
  )[0];
  const activeProtocol = orderedActive[0]
    ? projectActiveProtocol(
        orderedActive[0],
        assignedStudyBySlotKey,
        studyOutcomesByStudyId
      )
    : null;
  const status = activeProtocol?.status ??
    (input.protocols.length > 0 ? "closed" : "not_started");

  return {
    status,
    protocol_count: input.protocols.length,
    outcome_count: input.outcomes.length,
    active_protocol: activeProtocol,
    latest_outcome: latestOutcome ? projectLatestOutcome(latestOutcome) : null,
    latest_policy_decision: latestDecision
      ? projectLatestPolicyDecision(latestDecision)
      : null,
    authority_status: "not_promotion_authority"
  };
}

function protocolSlots(protocols: ResearchGeneralizationProtocolRecord[]): Map<
  string,
  {
    protocol: ResearchGeneralizationProtocolRecord;
    slot: ResearchGeneralizationProtocolStudySlot;
  }
> {
  const result = new Map<string, {
    protocol: ResearchGeneralizationProtocolRecord;
    slot: ResearchGeneralizationProtocolStudySlot;
  }>();
  const plannedStudyIds = new Set<string>();
  for (const protocol of protocols) {
    for (const slot of protocol.study_slots) {
      const key = slotKey(
        protocol.research_generalization_protocol_id,
        slot.slot_index
      );
      if (result.has(key) || plannedStudyIds.has(slot.study_ref.id)) {
        throw graphInvalid(
          "ResearchGeneralizationProtocol slots must be globally unique."
        );
      }
      plannedStudyIds.add(slot.study_ref.id);
      result.set(key, { protocol, slot });
    }
  }
  return result;
}

function projectActiveProtocol(
  protocol: ResearchGeneralizationProtocolRecord,
  assignedStudyBySlotKey: Map<string, ResearchControlStudyRecord>,
  studyOutcomesByStudyId: Map<string, ResearchControlStudyOutcomeRecord>
): ResearchGeneralizationActiveProtocolReadModel {
  const counts = CONDITION_BLOCKS.map((conditionBlock) => {
    const slots = protocol.study_slots.filter((slot) =>
      slot.condition_block === conditionBlock
    );
    const studies = slots.flatMap((slot) => {
      const study = assignedStudyBySlotKey.get(
        slotKey(protocol.research_generalization_protocol_id, slot.slot_index)
      );
      return study ? [study] : [];
    });
    return {
      condition_block: conditionBlock,
      planned_study_count: slots.length,
      assigned_study_count: studies.length,
      terminal_study_count: studies.filter((study) =>
        studyOutcomesByStudyId.has(study.research_control_study_id)
      ).length
    };
  });
  const assigned = counts.reduce((sum, block) =>
    sum + block.assigned_study_count, 0
  );
  const terminal = counts.reduce((sum, block) =>
    sum + block.terminal_study_count, 0
  );
  const planned = counts.reduce((sum, block) =>
    sum + block.planned_study_count, 0
  );
  const nextAction = assigned < planned
    ? "collect_precommitted_studies" as const
    : terminal < planned
      ? "complete_assigned_studies" as const
      : "await_outcome_reconciliation" as const;
  const status = nextAction === "await_outcome_reconciliation"
    ? "awaiting_outcome" as const
    : "collecting" as const;
  return {
    research_generalization_protocol_id:
      protocol.research_generalization_protocol_id,
    committed_at: protocol.committed_at,
    collection_deadline_at: protocol.timing_policy.collection_deadline_at,
    status,
    planned_study_count: planned,
    assigned_study_count: assigned,
    terminal_study_count: terminal,
    condition_blocks: counts,
    next_action: nextAction,
    authority_status: "research_only"
  };
}

function slotKey(protocolId: string, slotIndex: number): string {
  if (!Number.isInteger(slotIndex) || slotIndex <= 0) {
    throw graphInvalid("ResearchGeneralizationProtocol slot index is invalid.");
  }
  return `${protocolId}|${slotIndex}`;
}

function projectLatestOutcome(
  outcome: ResearchGeneralizationOutcomeRecord
): NonNullable<ResearchGeneralizationReadModel["latest_outcome"]> {
  return {
    research_generalization_outcome_id:
      outcome.research_generalization_outcome_id,
    research_generalization_protocol_id: outcome.protocol_ref.id,
    inference_status: outcome.inference_status,
    adjudicated_at: outcome.adjudicated_at,
    planned_study_count: outcome.planned_study_count,
    completed_study_count: outcome.completed_study_count,
    non_tied_study_count: outcome.non_tied_study_count,
    tied_study_count: outcome.tied_study_count,
    missing_study_count: outcome.missing_study_count,
    ineligible_study_count: outcome.ineligible_study_count,
    distinct_baseline_count: outcome.distinct_baseline_count,
    equal_weight_mean_rate_difference:
      outcome.equal_weight_mean_rate_difference,
    exact_sign_test_p_value: outcome.exact_sign_test_p_value,
    harmful_condition_blocks: [...outcome.harmful_condition_blocks],
    policy_decision_eligibility: outcome.policy_decision_eligibility,
    next_action: outcome.next_action,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}

function projectLatestPolicyDecision(
  decision: ResearchGeneralizationPolicyDecisionRecord
): NonNullable<ResearchGeneralizationReadModel["latest_policy_decision"]> {
  return {
    research_generalization_policy_decision_id:
      decision.research_generalization_policy_decision_id,
    research_generalization_protocol_id: decision.protocol_ref.id,
    research_generalization_outcome_id:
      decision.generalization_outcome_ref.id,
    decision_status: decision.decision_status,
    decision_reason: decision.decision_reason,
    effective_default_mode: decision.effective_default_mode,
    decided_at: decision.decided_at,
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  };
}

function uniqueBy<T>(
  values: T[],
  identity: (value: T) => string,
  message: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = identity(value);
    if (typeof id !== "string" || !id.trim() || result.has(id)) {
      throw graphInvalid(message);
    }
    result.set(id, value);
  }
  return result;
}

function graphInvalid(
  message: string,
  cause?: unknown
): ResearchGeneralizationReadModelError {
  return new ResearchGeneralizationReadModelError(
    message,
    cause === undefined ? undefined : { cause }
  );
}
