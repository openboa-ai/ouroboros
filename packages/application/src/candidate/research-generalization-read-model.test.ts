import { describe, expect, it } from "vitest";
import type {
  ResearchControlStudyOutcomeRecord,
  ResearchControlStudyRecord,
  ResearchGeneralizationOutcomeRecord,
  ResearchGeneralizationPolicyDecisionRecord,
  ResearchGeneralizationProtocolRecord
} from "@ouroboros/domain";
import {
  buildResearchGeneralizationReadModel,
  ResearchGeneralizationReadModelError
} from "./research-generalization-read-model";

describe("ResearchGeneralizationReadModel", () => {
  it("returns the canonical empty projection", () => {
    expect(buildResearchGeneralizationReadModel({
      protocols: [],
      studies: [],
      studyOutcomes: [],
      outcomes: [],
      decisions: []
    })).toEqual({
      status: "not_started",
      protocol_count: 0,
      outcome_count: 0,
      active_protocol: null,
      latest_outcome: null,
      latest_policy_decision: null,
      authority_status: "not_promotion_authority"
    });
  });

  it("projects oldest active protocol progress in canonical block order", () => {
    const protocol = protocolFixture("active", "2026-07-01T00:00:00.000Z");
    const longStudy = assignedStudy(protocol, 0);
    const shortStudy = assignedStudy(protocol, 2);
    const readModel = buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies: [shortStudy, longStudy],
      studyOutcomes: [studyOutcome(longStudy)],
      outcomes: [],
      decisions: []
    });

    expect(readModel).toEqual({
      status: "collecting",
      protocol_count: 1,
      outcome_count: 0,
      active_protocol: {
        research_generalization_protocol_id:
          protocol.research_generalization_protocol_id,
        committed_at: "2026-07-01T00:00:00.000Z",
        collection_deadline_at: "2026-09-29T00:00:00.000Z",
        status: "collecting",
        planned_study_count: 6,
        assigned_study_count: 2,
        terminal_study_count: 1,
        condition_blocks: [
          {
            condition_block: "long",
            planned_study_count: 2,
            assigned_study_count: 1,
            terminal_study_count: 1
          },
          {
            condition_block: "short",
            planned_study_count: 2,
            assigned_study_count: 1,
            terminal_study_count: 0
          },
          {
            condition_block: "flat",
            planned_study_count: 2,
            assigned_study_count: 0,
            terminal_study_count: 0
          }
        ],
        next_action: "collect_precommitted_studies",
        authority_status: "research_only"
      },
      latest_outcome: null,
      latest_policy_decision: null,
      authority_status: "not_promotion_authority"
    });
  });

  it("waits for outcome reconciliation only after all studies are terminal", () => {
    const protocol = protocolFixture("terminal", "2026-07-01T00:00:00.000Z");
    const studies = protocol.study_slots.map((_, index) =>
      assignedStudy(protocol, index)
    );

    expect(buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies,
      studyOutcomes: studies.map(studyOutcome),
      outcomes: [],
      decisions: []
    })).toMatchObject({
      status: "awaiting_outcome",
      active_protocol: {
        status: "awaiting_outcome",
        assigned_study_count: 6,
        terminal_study_count: 6,
        next_action: "await_outcome_reconciliation"
      }
    });
  });

  it("distinguishes assigned studies that still need terminal outcomes", () => {
    const protocol = protocolFixture("assigned", "2026-07-01T00:00:00.000Z");
    const studies = protocol.study_slots.map((_, index) =>
      assignedStudy(protocol, index)
    );

    expect(buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies,
      studyOutcomes: studies.slice(0, 4).map(studyOutcome),
      outcomes: [],
      decisions: []
    })).toMatchObject({
      status: "collecting",
      active_protocol: {
        assigned_study_count: 6,
        terminal_study_count: 4,
        next_action: "complete_assigned_studies"
      }
    });
  });

  it("projects the newest closed outcome without adding authority", () => {
    const oldProtocol = protocolFixture("old", "2026-05-01T00:00:00.000Z");
    const latestProtocol = protocolFixture(
      "latest",
      "2026-06-01T00:00:00.000Z"
    );
    const oldOutcome = generalizationOutcome(
      oldProtocol,
      "2026-06-10T00:00:00.000Z",
      "generalization_supported"
    );
    const latestOutcome = generalizationOutcome(
      latestProtocol,
      "2026-07-10T00:00:00.000Z",
      "generalization_not_supported"
    );

    expect(buildResearchGeneralizationReadModel({
      protocols: [latestProtocol, oldProtocol],
      studies: [],
      studyOutcomes: [],
      outcomes: [oldOutcome, latestOutcome],
      decisions: []
    })).toEqual({
      status: "closed",
      protocol_count: 2,
      outcome_count: 2,
      active_protocol: null,
      latest_outcome: {
        research_generalization_outcome_id:
          latestOutcome.research_generalization_outcome_id,
        research_generalization_protocol_id:
          latestProtocol.research_generalization_protocol_id,
        inference_status: "generalization_not_supported",
        adjudicated_at: "2026-07-10T00:00:00.000Z",
        planned_study_count: 6,
        completed_study_count: 6,
        non_tied_study_count: 5,
        tied_study_count: 1,
        missing_study_count: 0,
        ineligible_study_count: 0,
        distinct_baseline_count: 4,
        equal_weight_mean_rate_difference: -0.1,
        exact_sign_test_p_value: 0.21875,
        harmful_condition_blocks: ["flat"],
        policy_decision_eligibility: "not_eligible",
        next_action: "retain_negative_generalization_evidence",
        policy_replacement_authority: false,
        promotion_authority: false,
        order_submission_authority: false,
        live_exchange_authority: false,
        authority_status: "not_live"
      },
      latest_policy_decision: null,
      authority_status: "not_promotion_authority"
    });
  });

  it("shows oldest active progress beside the latest prior outcome", () => {
    const closed = protocolFixture("closed", "2026-05-01T00:00:00.000Z");
    const firstActive = protocolFixture(
      "active-1",
      "2026-07-01T00:00:00.000Z"
    );
    const secondActive = protocolFixture(
      "active-2",
      "2026-07-02T00:00:00.000Z"
    );
    const outcome = generalizationOutcome(
      closed,
      "2026-06-01T00:00:00.000Z",
      "generalization_supported"
    );

    const readModel = buildResearchGeneralizationReadModel({
      protocols: [secondActive, closed, firstActive],
      studies: [],
      studyOutcomes: [],
      outcomes: [outcome],
      decisions: []
    });

    expect(readModel).toMatchObject({
      status: "collecting",
      protocol_count: 3,
      outcome_count: 1,
      active_protocol: {
        research_generalization_protocol_id:
          firstActive.research_generalization_protocol_id
      },
      latest_outcome: {
        research_generalization_outcome_id:
          outcome.research_generalization_outcome_id,
        inference_status: "generalization_supported"
      }
    });
  });

  it("projects the newest policy decision with closed downstream authority", () => {
    const oldProtocol = protocolFixture("decision-old", "2026-05-01T00:00:00.000Z");
    const latestProtocol = protocolFixture(
      "decision-latest",
      "2026-06-01T00:00:00.000Z"
    );
    const oldOutcome = generalizationOutcome(
      oldProtocol,
      "2026-06-10T00:00:00.000Z",
      "generalization_supported"
    );
    const latestOutcome = generalizationOutcome(
      latestProtocol,
      "2026-07-10T00:00:00.000Z",
      "generalization_not_supported"
    );
    const oldDecision = generalizationPolicyDecision(
      oldProtocol,
      oldOutcome,
      "2026-06-10T00:00:01.000Z"
    );
    const latestDecision = generalizationPolicyDecision(
      latestProtocol,
      latestOutcome,
      "2026-07-10T00:00:01.000Z"
    );

    expect(buildResearchGeneralizationReadModel({
      protocols: [latestProtocol, oldProtocol],
      studies: [],
      studyOutcomes: [],
      outcomes: [latestOutcome, oldOutcome],
      decisions: [oldDecision, latestDecision]
    }).latest_policy_decision).toEqual({
      research_generalization_policy_decision_id:
        latestDecision.research_generalization_policy_decision_id,
      research_generalization_protocol_id:
        latestProtocol.research_generalization_protocol_id,
      research_generalization_outcome_id:
        latestOutcome.research_generalization_outcome_id,
      decision_status: "not_approved",
      decision_reason: "generalization_outcome_not_eligible",
      effective_default_mode: null,
      decided_at: "2026-07-10T00:00:01.000Z",
      research_policy_selection_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_policy_only"
    });
  });

  it("shows active collection beside the latest outcome and policy decision", () => {
    const closed = protocolFixture(
      "decision-closed",
      "2026-05-01T00:00:00.000Z"
    );
    const active = protocolFixture(
      "decision-active",
      "2026-07-01T00:00:00.000Z"
    );
    const outcome = generalizationOutcome(
      closed,
      "2026-06-01T00:00:00.000Z",
      "generalization_supported"
    );
    const decision = generalizationPolicyDecision(
      closed,
      outcome,
      "2026-06-01T00:00:01.000Z"
    );

    expect(buildResearchGeneralizationReadModel({
      protocols: [active, closed],
      studies: [],
      studyOutcomes: [],
      outcomes: [outcome],
      decisions: [decision]
    })).toMatchObject({
      status: "collecting",
      active_protocol: {
        research_generalization_protocol_id:
          active.research_generalization_protocol_id
      },
      latest_outcome: {
        research_generalization_outcome_id:
          outcome.research_generalization_outcome_id
      },
      latest_policy_decision: {
        research_generalization_policy_decision_id:
          decision.research_generalization_policy_decision_id,
        decision_status: "approved"
      }
    });
  });

  it.each([
    ["orphan outcome", (decision: ResearchGeneralizationPolicyDecisionRecord) => {
      decision.generalization_outcome_ref.id = "absent-outcome";
    }],
    ["protocol mismatch", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      decision.protocol_ref.id = "absent-protocol";
    }],
    ["source digest mismatch", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      decision.generalization_outcome_digest = `sha256:${"f".repeat(64)}`;
    }],
    ["time inversion", (decision: ResearchGeneralizationPolicyDecisionRecord) => {
      decision.decided_at = "2026-07-10T00:00:00.000Z";
    }],
    ["false approval", (decision: ResearchGeneralizationPolicyDecisionRecord) => {
      decision.decision_status = "approved";
      decision.decision_reason = "supported_cross_condition_adaptive_effect";
      decision.effective_default_mode = "adaptive_default";
    }],
    ["promotion authority", (
      decision: ResearchGeneralizationPolicyDecisionRecord
    ) => {
      decision.promotion_authority = true as false;
    }]
  ])("fails closed for corrupt policy decision graph: %s", (
    _label,
    mutate
  ) => {
    const protocol = protocolFixture("decision-invalid", "2026-06-01T00:00:00.000Z");
    const outcome = generalizationOutcome(
      protocol,
      "2026-07-10T00:00:00.000Z",
      "generalization_not_supported"
    );
    const decision = generalizationPolicyDecision(
      protocol,
      outcome,
      "2026-07-10T00:00:01.000Z"
    );
    mutate(decision);

    expect(() => buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies: [],
      studyOutcomes: [],
      outcomes: [outcome],
      decisions: [decision]
    })).toThrowError(expect.objectContaining({
      code: "research_generalization_read_model_graph_invalid"
    }));
  });

  it("is independent of source enumeration order", () => {
    const protocol = protocolFixture("ordered", "2026-07-01T00:00:00.000Z");
    const studies = protocol.study_slots.map((_, index) =>
      assignedStudy(protocol, index)
    );
    const forward = buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies,
      studyOutcomes: studies.slice(0, 3).map(studyOutcome),
      outcomes: [],
      decisions: []
    });
    const reverse = buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies: [...studies].reverse(),
      studyOutcomes: studies.slice(0, 3).map(studyOutcome).reverse(),
      outcomes: [],
      decisions: []
    });

    expect(reverse).toEqual(forward);
  });

  it.each([
    {
      name: "duplicate protocol identity",
      mutate(graph: Graph) { graph.protocols.push(graph.protocols[0]!); }
    },
    {
      name: "duplicate study identity",
      mutate(graph: Graph) { graph.studies.push(graph.studies[0]!); }
    },
    {
      name: "duplicate study outcome ref",
      mutate(graph: Graph) {
        graph.studyOutcomes.push({
          ...graph.studyOutcomes[0]!,
          research_control_study_outcome_id: "duplicate-outcome-id"
        });
      }
    },
    {
      name: "orphan study outcome",
      mutate(graph: Graph) {
        graph.studyOutcomes[0] = {
          ...graph.studyOutcomes[0]!,
          study_ref: {
            record_kind: "research_control_study",
            id: "absent-study"
          }
        };
      }
    },
    {
      name: "mismatched slot assignment",
      mutate(graph: Graph) {
        graph.studies[0]!.generalization_assignment = {
          ...graph.studies[0]!.generalization_assignment!,
          slot_index: 99
        };
      }
    }
  ])("fails closed for $name", ({ mutate }) => {
    const graph = activeGraph();
    mutate(graph);

    expect(() => buildResearchGeneralizationReadModel(graph)).toThrowError(
      expect.objectContaining<Partial<ResearchGeneralizationReadModelError>>({
        code: "research_generalization_read_model_graph_invalid"
      })
    );
  });

  it("fails closed when an outcome references an absent protocol", () => {
    const protocol = protocolFixture("orphan", "2026-07-01T00:00:00.000Z");
    const outcome = generalizationOutcome(
      protocol,
      "2026-07-10T00:00:00.000Z",
      "generalization_not_supported"
    );
    outcome.protocol_ref.id = "absent-protocol";

    expect(() => buildResearchGeneralizationReadModel({
      protocols: [protocol],
      studies: [],
      studyOutcomes: [],
      outcomes: [outcome],
      decisions: []
    })).toThrowError(expect.objectContaining({
      code: "research_generalization_read_model_graph_invalid"
    }));
  });

  it("fails closed when protocols precommit the same study identity", () => {
    const first = protocolFixture("first", "2026-07-01T00:00:00.000Z");
    const second = protocolFixture("second", "2026-07-02T00:00:00.000Z");
    second.study_slots[0]!.study_ref.id = first.study_slots[0]!.study_ref.id;

    expect(() => buildResearchGeneralizationReadModel({
      protocols: [first, second],
      studies: [],
      studyOutcomes: [],
      outcomes: [],
      decisions: []
    })).toThrowError(expect.objectContaining({
      code: "research_generalization_read_model_graph_invalid"
    }));
  });

  it("clones projected arrays away from source evidence", () => {
    const protocol = protocolFixture("clone", "2026-06-01T00:00:00.000Z");
    const active = protocolFixture("active-clone", "2026-07-01T00:00:00.000Z");
    const outcome = generalizationOutcome(
      protocol,
      "2026-07-10T00:00:00.000Z",
      "generalization_not_supported"
    );
    const readModel = buildResearchGeneralizationReadModel({
      protocols: [active, protocol],
      studies: [],
      studyOutcomes: [],
      outcomes: [outcome],
      decisions: []
    });

    readModel.latest_outcome!.harmful_condition_blocks.push("long");
    readModel.active_protocol!.condition_blocks.reverse();

    expect(outcome.harmful_condition_blocks).toEqual(["flat"]);
    expect(active.condition_blocks.map((block) => block.condition_block))
      .toEqual(["long", "short", "flat"]);
  });
});

interface Graph {
  protocols: ResearchGeneralizationProtocolRecord[];
  studies: ResearchControlStudyRecord[];
  studyOutcomes: ResearchControlStudyOutcomeRecord[];
  outcomes: ResearchGeneralizationOutcomeRecord[];
  decisions: ResearchGeneralizationPolicyDecisionRecord[];
}

function activeGraph(): Graph {
  const protocol = protocolFixture("graph", "2026-07-01T00:00:00.000Z");
  const study = assignedStudy(protocol, 0);
  return {
    protocols: [protocol],
    studies: [study],
    studyOutcomes: [studyOutcome(study)],
    outcomes: [],
    decisions: []
  };
}

function protocolFixture(
  suffix: string,
  committedAt: string
): ResearchGeneralizationProtocolRecord {
  const blocks = ["long", "short", "flat"] as const;
  const protocolId = `research-generalization-protocol-${suffix}`;
  return {
    record_kind: "research_generalization_protocol",
    version: 1,
    research_generalization_protocol_id: protocolId,
    committed_at: committedAt,
    protocol_digest: `sha256:${"1".repeat(64)}`,
    target_allocation_policy_digest: `sha256:${"2".repeat(64)}`,
    condition_blocks: blocks.map((conditionBlock) => ({
      condition_block: conditionBlock,
      required_study_count: 2
    })),
    study_slots: blocks.flatMap((conditionBlock) => [0, 1].map((offset) => {
      const index = blocks.indexOf(conditionBlock) * 2 + offset;
      return {
        slot_index: index + 1,
        condition_block: conditionBlock,
        condition_block_study_index: offset + 1,
        study_ref: {
          record_kind: "research_control_study",
          id: `${protocolId}-study-${index + 1}`
        },
        study_idempotency_key: `${protocolId}-study-key-${index + 1}`
      };
    })),
    timing_policy: {
      collection_deadline_at: new Date(
        Date.parse(committedAt) + 90 * 24 * 60 * 60 * 1_000
      ).toISOString()
    }
  } as unknown as ResearchGeneralizationProtocolRecord;
}

function assignedStudy(
  protocol: ResearchGeneralizationProtocolRecord,
  slotIndex: number
): ResearchControlStudyRecord {
  const slot = protocol.study_slots[slotIndex]!;
  return {
    record_kind: "research_control_study",
    version: 1,
    research_control_study_id: slot.study_ref.id,
    committed_at: new Date(
      Date.parse(protocol.committed_at) + slotIndex * 24 * 60 * 60 * 1_000
    ).toISOString(),
    generalization_assignment: {
      protocol_ref: {
        record_kind: "research_generalization_protocol",
        id: protocol.research_generalization_protocol_id
      },
      protocol_digest: protocol.protocol_digest,
      slot_index: slot.slot_index,
      condition_block: slot.condition_block,
      condition_block_study_index: slot.condition_block_study_index
    }
  } as unknown as ResearchControlStudyRecord;
}

function studyOutcome(
  study: ResearchControlStudyRecord
): ResearchControlStudyOutcomeRecord {
  return {
    record_kind: "research_control_study_outcome",
    version: 1,
    research_control_study_outcome_id:
      `research-control-study-outcome-${study.research_control_study_id}`,
    study_ref: {
      record_kind: "research_control_study",
      id: study.research_control_study_id
    },
    adjudicated_at: new Date(
      Date.parse(study.committed_at) + 60 * 60 * 1_000
    ).toISOString()
  } as ResearchControlStudyOutcomeRecord;
}

function generalizationOutcome(
  protocol: ResearchGeneralizationProtocolRecord,
  adjudicatedAt: string,
  inferenceStatus: ResearchGeneralizationOutcomeRecord["inference_status"]
): ResearchGeneralizationOutcomeRecord {
  const supported = inferenceStatus === "generalization_supported";
  return {
    record_kind: "research_generalization_outcome",
    version: 1,
    research_generalization_outcome_id:
      `research-generalization-outcome-${protocol.research_generalization_protocol_id}`,
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: protocol.research_generalization_protocol_id
    },
    protocol_digest: protocol.protocol_digest,
    target_allocation_policy_digest:
      protocol.target_allocation_policy_digest,
    planned_study_count: 6,
    completed_study_count: 6,
    non_tied_study_count: supported ? 6 : 5,
    tied_study_count: supported ? 0 : 1,
    missing_study_count: 0,
    ineligible_study_count: 0,
    distinct_baseline_count: 4,
    equal_weight_mean_rate_difference: supported ? 0.5 : -0.1,
    exact_sign_test_p_value: supported ? 0.03125 : 0.21875,
    harmful_condition_blocks: supported ? [] : ["flat"],
    inference_status: inferenceStatus,
    policy_decision_eligibility: supported
      ? "eligible_for_separate_generalization_policy_decision"
      : "not_eligible",
    next_action: supported
      ? "review_broad_research_allocation_policy"
      : "retain_negative_generalization_evidence",
    adjudicated_at: adjudicatedAt,
    outcome_digest: `sha256:${"3".repeat(64)}`,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  } as ResearchGeneralizationOutcomeRecord;
}

function generalizationPolicyDecision(
  protocol: ResearchGeneralizationProtocolRecord,
  outcome: ResearchGeneralizationOutcomeRecord,
  decidedAt: string
): ResearchGeneralizationPolicyDecisionRecord {
  const approved = outcome.inference_status === "generalization_supported";
  return {
    record_kind: "research_generalization_policy_decision",
    version: 1,
    research_generalization_policy_decision_id:
      `research-generalization-policy-decision-${
        outcome.research_generalization_outcome_id
      }`,
    protocol_ref: {
      record_kind: "research_generalization_protocol",
      id: protocol.research_generalization_protocol_id
    },
    protocol_digest: protocol.protocol_digest,
    generalization_outcome_ref: {
      record_kind: "research_generalization_outcome",
      id: outcome.research_generalization_outcome_id
    },
    generalization_outcome_digest: outcome.outcome_digest,
    target_allocation_policy_digest:
      protocol.target_allocation_policy_digest,
    decision_status: approved ? "approved" : "not_approved",
    decision_reason: approved
      ? "supported_cross_condition_adaptive_effect"
      : "generalization_outcome_not_eligible",
    effective_default_mode: approved ? "adaptive_default" : null,
    decided_at: decidedAt,
    research_policy_selection_authority: true,
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_policy_only"
  } as ResearchGeneralizationPolicyDecisionRecord;
}
