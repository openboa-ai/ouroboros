import { describe, expect, it } from "vitest";
import type {
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignPaperStartBatchRecord
} from "@ouroboros/domain";
import type { PaperTradingComparisonWindowDecision } from
  "@ouroboros/application/trading/paper/comparison-window-state";
import {
  ResearchControlCampaignPaperNextActionError,
  projectResearchControlCampaignPaperNextAction,
  type ResearchControlCampaignPaperSlotEvidence
} from "../src/candidate/arena/research-control-campaign-paper-next-action";

const BEFORE_DEADLINE = "2026-07-12T10:00:00.500Z";
const AFTER_DEADLINE = "2026-07-12T10:00:01.001Z";

describe("ResearchControlCampaign paper next-action projector", () => {
  it("collects an all-no-candidate schedule and then completes", () => {
    const schedule = scheduleFixture({ candidateArms: [] });
    expect(project({ schedule })).toEqual({ action: "collect_campaign_outcome" });
    expect(project({ schedule, campaignOutcome: outcomeRecord() })).toEqual({
      action: "complete"
    });
  });

  it("prepares an unopened source batch before its deadline", () => {
    expect(project()).toEqual({ action: "prepare_source_batch", sequence: 1 });
  });

  it("expires an unopened source slot only after its deadline", () => {
    expect(project({ now: AFTER_DEADLINE })).toEqual({
      action: "expire_unopened_source_slot",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it.each([
    ["prepared", sourceEvidence({
      preparation: preparationRecord(),
      commitment: commitmentRecord()
    })],
    ["persisted first tick", sourceEvidence({
      preparation: preparationRecord(),
      commitment: commitmentRecord(),
      firstTick: firstTickRecord()
    })]
  ])("captures a %s source start batch", (_label, slot) => {
    expect(project({ slots: [slot] })).toEqual({
      action: "capture_source_start_batch",
      sequence: 1
    });
  });

  it("recovers a paired batch after only one arm persisted its first tick", () => {
    expect(project({
      schedule: scheduleFixture({
        candidateArms: ["adaptive_treatment", "static_control"]
      }),
      slots: [
        committedSlot(),
        sourceEvidence({
          armKind: "static_control",
          preparation: staticPreparationRecord(),
          commitment: staticCommitmentRecord()
        })
      ]
    })).toEqual({
      action: "capture_source_start_batch",
      sequence: 1
    });
  });

  it("authorizes every comparison in a ready source batch", () => {
    expect(project({
      slots: [committedSlot()],
      startBatches: [readyBatch()]
    })).toEqual({ action: "authorize_source_batch", sequence: 1 });
  });

  it("starts a fully authorized source batch", () => {
    expect(project({
      slots: [committedSlot({ activation: activationRecord() })],
      startBatches: [readyBatch()]
    })).toEqual({ action: "start_source_batch", sequence: 1 });
  });

  it("waits for an active source window cadence without writing", () => {
    expect(project({
      slots: [activeSlot(windowDecision({
        transition: "none",
        next_wake_at: "2026-07-12T10:00:00.750Z"
      }))],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "wait_until",
      sequence: 1,
      wakeAt: "2026-07-12T10:00:00.750Z"
    });
  });

  it("waits until the later wake when matched source windows poll at different times", () => {
    expect(project({
      schedule: scheduleFixture({
        candidateArms: ["adaptive_treatment", "static_control"]
      }),
      slots: [
        activeSlot(windowDecision({
          transition: "none",
          next_wake_at: "2026-07-12T10:00:00.750Z"
        })),
        staticActiveSlot(windowDecision({
          transition: "none",
          next_wake_at: "2026-07-12T10:00:00.900Z"
        }))
      ],
      startBatches: [pairedReadyBatch()]
    })).toEqual({
      action: "wait_until",
      sequence: 1,
      wakeAt: "2026-07-12T10:00:00.900Z"
    });
  });

  it("advances an actionable active source window", () => {
    expect(project({
      slots: [activeSlot(windowDecision({ transition: "capture_next_tick" }))],
      startBatches: [readyBatch()]
    })).toEqual({ action: "advance_source_window", sequence: 1 });
  });

  it("adjudicates a terminal source window before downstream actions", () => {
    expect(project({
      slots: [activeSlot(windowDecision({
        phase: "window_stopped",
        transition: "none",
        terminal: true
      }))],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "adjudicate_source_verdict",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it.each([
    ["challenger_not_improved", "source_not_improved"],
    ["comparison_ineligible", "evidence_ineligible"]
  ] as const)("maps a %s source verdict to slot outcome recording", (
    verdictOutcome,
    _terminalStatus
  ) => {
    expect(project({
      slots: [verdictSlot(verdictOutcome)],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "record_slot_outcome",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("precommits an improved source verdict at the exact deadline", () => {
    const verdict = sourceVerdict("challenger_improved");
    expect(project({
      now: "2026-07-12T10:00:02.000Z",
      slots: [verdictSlot("challenger_improved", { sourceVerdict: verdict })],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "precommit_confirmation",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("expires an improved verdict one millisecond after precommit deadline", () => {
    expect(project({
      now: "2026-07-12T10:00:02.001Z",
      slots: [verdictSlot("challenger_improved")],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "expire_confirmation_precommit",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("advances a precommitted confirmation campaign", () => {
    expect(project({
      slots: [confirmationSlot()],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "advance_confirmation",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("records a released confirmation as the terminal slot outcome", () => {
    expect(project({
      slots: [confirmationSlot({
        confirmationOutcome: confirmationOutcomeRecord(),
        researchRelease: releaseRecord()
      })],
      startBatches: [readyBatch()]
    })).toEqual({
      action: "record_slot_outcome",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("records every source-start-ineligible slot before collection", () => {
    expect(project({
      slots: [committedSlot()],
      startBatches: [ineligibleBatch()]
    })).toEqual({
      action: "record_slot_outcome",
      armKind: "adaptive_treatment",
      sequence: 1
    });
  });

  it("collects only after every candidate slot has a terminal outcome", () => {
    expect(project({ slots: [sourceEvidence({ slotOutcome: slotOutcomeRecord() })] }))
      .toEqual({ action: "collect_campaign_outcome" });
  });

  it("rejects evidence for a later sequence while the first is nonterminal", () => {
    const schedule = scheduleFixture({ sequenceCount: 2 });
    expect(() => project({
      schedule,
      slots: [sourceEvidence({
        sequence: 2,
        preparation: preparationRecord(2),
        commitment: commitmentRecord(2)
      })]
    })).toThrow(ResearchControlCampaignPaperNextActionError);
  });

  it("rejects a noncontiguous slot evidence chain", () => {
    expect(() => project({
      slots: [sourceEvidence({ commitment: commitmentRecord() })]
    })).toThrow(ResearchControlCampaignPaperNextActionError);
  });
});

function project(changes: {
  schedule?: ResearchControlCampaignPaperScheduleRecord;
  now?: string;
  slots?: ResearchControlCampaignPaperSlotEvidence[];
  startBatches?: ResearchControlCampaignPaperStartBatchRecord[];
  campaignOutcome?: ResearchControlCampaignOutcomeRecord;
} = {}) {
  return projectResearchControlCampaignPaperNextAction({
    schedule: changes.schedule ?? scheduleFixture(),
    now: changes.now ?? BEFORE_DEADLINE,
    confirmationPrecommitDeadlineMs: 1_000,
    slots: changes.slots ?? [],
    startBatches: changes.startBatches ?? [],
    campaignOutcome: changes.campaignOutcome
  });
}

function scheduleFixture(options: {
  candidateArms?: Array<"adaptive_treatment" | "static_control">;
  sequenceCount?: number;
} = {}): ResearchControlCampaignPaperScheduleRecord {
  const candidateArms = options.candidateArms ?? ["adaptive_treatment"];
  const sequenceCount = options.sequenceCount ?? 1;
  return {
    record_kind: "research_control_campaign_paper_schedule",
    research_control_campaign_paper_schedule_id: "schedule-001",
    committed_at: "2026-07-12T10:00:00.000Z",
    schedule_digest: "sha256:schedule",
    arms: (["adaptive_treatment", "static_control"] as const).map((armKind) => ({
      arm_kind: armKind,
      slots: Array.from({ length: sequenceCount }, (_, index) => {
        const sequence = index + 1;
        return candidateArms.includes(armKind)
          ? {
              slot_status: "candidate_scheduled" as const,
              sequence,
              tick_ref: { record_kind: "candidate_arena_tick", id:
                `${armKind}-tick-${sequence}` },
              candidate_ref: { record_kind: "trading_system_candidate", id:
                `${armKind}-candidate-${sequence}` },
              candidate_version_ref: { record_kind: "candidate_version", id:
                `${armKind}-version-${sequence}` },
              system_code_ref: { record_kind: "system_code", id:
                `${armKind}-code-${sequence}` },
              system_code_artifact_digest: "sha256:artifact",
              admission_decision_ref: {
                record_kind: "candidate_admission_decision",
                id: `${armKind}-admission-${sequence}`
              },
              source_comparison_idempotency_key: `${armKind}-source-${sequence}`,
              source_preparation_id: `${armKind}-preparation-${sequence}`,
              source_comparison_commitment_id: `${armKind}-comparison-${sequence}`,
              maximum_source_start_delay_ms: 1_000
            }
          : {
              slot_status: "no_admitted_candidate" as const,
              sequence,
              tick_ref: { record_kind: "candidate_arena_tick", id:
                `${armKind}-tick-${sequence}` }
            };
      })
    })) as ResearchControlCampaignPaperScheduleRecord["arms"]
  } as ResearchControlCampaignPaperScheduleRecord;
}

function sourceEvidence(
  changes: Partial<ResearchControlCampaignPaperSlotEvidence> = {}
): ResearchControlCampaignPaperSlotEvidence {
  return {
    armKind: "adaptive_treatment",
    sequence: 1,
    ...changes
  };
}

function committedSlot(
  changes: Partial<ResearchControlCampaignPaperSlotEvidence> = {}
): ResearchControlCampaignPaperSlotEvidence {
  return sourceEvidence({
    preparation: preparationRecord(),
    commitment: commitmentRecord(),
    firstTick: firstTickRecord(),
    ...changes
  });
}

function activeSlot(
  decision: PaperTradingComparisonWindowDecision
): ResearchControlCampaignPaperSlotEvidence {
  return committedSlot({
    activation: activationRecord(),
    activationAttempt: activationAttemptRecord(),
    activationOutcome: activationOutcomeRecord(),
    sourceWindowDecision: decision
  });
}

function staticActiveSlot(
  decision: PaperTradingComparisonWindowDecision
): ResearchControlCampaignPaperSlotEvidence {
  const tick = {
    ...firstTickRecord(),
    paper_trading_comparison_tick_id: "static-source-first-tick-1",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment" as const,
      id: "static_control-comparison-1"
    },
    paper_trading_comparison_commitment_digest: "sha256:static-commitment-1",
    tick_digest: "sha256:static-first-tick-1"
  };
  const activation = {
    ...activationRecord(),
    paper_trading_comparison_activation_id: "static-activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment" as const,
      id: "static_control-comparison-1"
    },
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick" as const,
      id: tick.paper_trading_comparison_tick_id
    }
  };
  const attempt = {
    ...activationAttemptRecord(),
    paper_trading_comparison_activation_attempt_id: "static-attempt-001",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation" as const,
      id: activation.paper_trading_comparison_activation_id
    }
  };
  return {
    armKind: "static_control",
    sequence: 1,
    preparation: staticPreparationRecord(),
    commitment: staticCommitmentRecord(),
    firstTick: tick,
    activation,
    activationAttempt: attempt,
    activationOutcome: {
      ...activationOutcomeRecord(),
      paper_trading_comparison_activation_outcome_id:
        "static-activation-outcome-001",
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: attempt.paper_trading_comparison_activation_attempt_id
      }
    },
    sourceWindowDecision: decision
  };
}

function verdictSlot(
  verdictOutcome: PaperTradingComparisonVerdictRecord["verdict_outcome"],
  changes: Partial<ResearchControlCampaignPaperSlotEvidence> = {}
): ResearchControlCampaignPaperSlotEvidence {
  return {
    ...activeSlot(windowDecision({ terminal: true, phase: "window_stopped" })),
    sourceVerdict: sourceVerdict(verdictOutcome),
    ...changes
  };
}

function confirmationSlot(
  changes: Partial<ResearchControlCampaignPaperSlotEvidence> = {}
): ResearchControlCampaignPaperSlotEvidence {
  return verdictSlot("challenger_improved", {
    confirmationCampaign: confirmationCampaignRecord(),
    ...changes
  });
}

function preparationRecord(
  sequence = 1
): PaperTradingComparisonPreparationRecord {
  return {
    record_kind: "paper_trading_comparison_preparation",
    paper_trading_comparison_preparation_id:
      `adaptive_treatment-preparation-${sequence}`,
    paper_trading_comparison_commitment_id:
      `adaptive_treatment-comparison-${sequence}`
  } as PaperTradingComparisonPreparationRecord;
}

function commitmentRecord(sequence = 1): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    paper_trading_comparison_commitment_id:
      `adaptive_treatment-comparison-${sequence}`,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: `adaptive_treatment-preparation-${sequence}`
    },
    commitment_digest: `sha256:commitment-${sequence}`
  } as PaperTradingComparisonCommitmentRecord;
}

function staticPreparationRecord(): PaperTradingComparisonPreparationRecord {
  return {
    record_kind: "paper_trading_comparison_preparation",
    paper_trading_comparison_preparation_id: "static_control-preparation-1",
    paper_trading_comparison_commitment_id: "static_control-comparison-1"
  } as PaperTradingComparisonPreparationRecord;
}

function staticCommitmentRecord(): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    paper_trading_comparison_commitment_id: "static_control-comparison-1",
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: "static_control-preparation-1"
    },
    commitment_digest: "sha256:static-commitment-1"
  } as PaperTradingComparisonCommitmentRecord;
}

function firstTickRecord(sequence = 1): PaperTradingComparisonTickRecord {
  return {
    record_kind: "paper_trading_comparison_tick",
    paper_trading_comparison_tick_id: `source-first-tick-${sequence}`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: `adaptive_treatment-comparison-${sequence}`
    },
    paper_trading_comparison_commitment_digest:
      `sha256:commitment-${sequence}`,
    sequence: 1,
    tick_digest: `sha256:first-tick-${sequence}`
  } as PaperTradingComparisonTickRecord;
}

function readyBatch(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    record_kind: "research_control_campaign_paper_start_batch",
    research_control_campaign_paper_start_batch_id: "batch-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: "schedule-001"
    },
    schedule_digest: "sha256:schedule",
    sequence: 1,
    batch_status: "single_ready",
    sides: [{
      arm_kind: "adaptive_treatment",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "adaptive_treatment-comparison-1"
      },
      source_comparison_digest: "sha256:commitment-1",
      first_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: "source-first-tick-1"
      },
      first_tick_digest: "sha256:first-tick-1",
      first_tick_observed_at: "2026-07-12T10:00:00.500Z"
    }],
    source_start_deadline_at: "2026-07-12T10:00:01.000Z"
  } as ResearchControlCampaignPaperStartBatchRecord;
}

function pairedReadyBatch(): ResearchControlCampaignPaperStartBatchRecord {
  const adaptive = readyBatch();
  return {
    ...adaptive,
    batch_status: "paired_ready",
    sides: [
      adaptive.sides[0]!,
      {
        arm_kind: "static_control",
        source_comparison_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: "static_control-comparison-1"
        },
        source_comparison_digest: "sha256:static-commitment-1",
        first_tick_ref: {
          record_kind: "paper_trading_comparison_tick",
          id: "static-source-first-tick-1"
        },
        first_tick_digest: "sha256:static-first-tick-1",
        first_tick_observed_at: "2026-07-12T10:00:00.500Z"
      }
    ]
  } as ResearchControlCampaignPaperStartBatchRecord;
}

function ineligibleBatch(): ResearchControlCampaignPaperStartBatchRecord {
  return {
    ...readyBatch(),
    batch_status: "ineligible",
    ineligible_reason: "first_tick_incomplete",
    sides: [{
      arm_kind: "adaptive_treatment",
      source_comparison_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "adaptive_treatment-comparison-1"
      },
      source_comparison_digest: "sha256:commitment-1"
    }]
  } as ResearchControlCampaignPaperStartBatchRecord;
}

function activationRecord(): PaperTradingComparisonActivationRecord {
  return {
    record_kind: "paper_trading_comparison_activation",
    paper_trading_comparison_activation_id: "activation-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison-1"
    },
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: "source-first-tick-1"
    },
    activation_digest: "sha256:activation"
  } as PaperTradingComparisonActivationRecord;
}

function activationAttemptRecord(): PaperTradingComparisonActivationAttemptRecord {
  return {
    record_kind: "paper_trading_comparison_activation_attempt",
    paper_trading_comparison_activation_attempt_id: "attempt-001",
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: "activation-001"
    },
    attempt_digest: "sha256:attempt"
  } as PaperTradingComparisonActivationAttemptRecord;
}

function activationOutcomeRecord(): PaperTradingComparisonActivationOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_activation_outcome",
    paper_trading_comparison_activation_outcome_id: "activation-outcome-001",
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: "attempt-001"
    },
    outcome_status: "both_running",
    outcome_digest: "sha256:activation-outcome"
  } as PaperTradingComparisonActivationOutcomeRecord;
}

function windowDecision(
  changes: Partial<PaperTradingComparisonWindowDecision> = {}
): PaperTradingComparisonWindowDecision {
  return {
    phase: "checkpoint_committed",
    transition: "capture_next_tick",
    checkpoint_sequence: 1,
    terminal: false,
    ...changes
  };
}

function sourceVerdict(
  outcome: PaperTradingComparisonVerdictRecord["verdict_outcome"]
): PaperTradingComparisonVerdictRecord {
  return {
    record_kind: "paper_trading_comparison_verdict",
    paper_trading_comparison_verdict_id: "source-verdict-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison-1"
    },
    verdict_outcome: outcome,
    confirmation_disposition: outcome === "challenger_improved"
      ? "requires_precommitted_campaign"
      : "not_applicable",
    evaluated_at: "2026-07-12T10:00:01.000Z",
    verdict_digest: "sha256:source-verdict"
  } as PaperTradingComparisonVerdictRecord;
}

function confirmationCampaignRecord():
PaperTradingComparisonConfirmationCampaignRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    paper_trading_comparison_confirmation_campaign_id: "confirmation-001",
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: "source-verdict-001"
    },
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: "adaptive_treatment-comparison-1"
    },
    campaign_digest: "sha256:confirmation"
  } as PaperTradingComparisonConfirmationCampaignRecord;
}

function confirmationOutcomeRecord():
PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  return {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
    paper_trading_comparison_confirmation_campaign_outcome_id:
      "confirmation-001-outcome",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "confirmation-001"
    },
    outcome_digest: "sha256:confirmation-outcome"
  } as PaperTradingComparisonConfirmationCampaignOutcomeRecord;
}

function releaseRecord(): PaperTradingComparisonResearchReleaseRecord {
  return {
    record_kind: "paper_trading_comparison_research_release",
    paper_trading_comparison_research_release_id: "release-001",
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: "confirmation-001"
    },
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: "confirmation-001-outcome"
    },
    release_kind: "confirmed_improvement",
    release_digest: "sha256:release"
  } as PaperTradingComparisonResearchReleaseRecord;
}

function slotOutcomeRecord(): ResearchControlCampaignPaperSlotOutcomeRecord {
  return {
    record_kind: "research_control_campaign_paper_slot_outcome",
    research_control_campaign_paper_slot_outcome_id: "slot-outcome-001",
    schedule_ref: {
      record_kind: "research_control_campaign_paper_schedule",
      id: "schedule-001"
    },
    schedule_digest: "sha256:schedule",
    arm_kind: "adaptive_treatment",
    sequence: 1,
    terminal_at: "2026-07-12T10:00:03.000Z"
  } as ResearchControlCampaignPaperSlotOutcomeRecord;
}

function outcomeRecord(): ResearchControlCampaignOutcomeRecord {
  return {
    record_kind: "research_control_campaign_outcome",
    research_control_campaign_outcome_id: "campaign-outcome-001"
  } as ResearchControlCampaignOutcomeRecord;
}
