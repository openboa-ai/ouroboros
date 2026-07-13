import type { PaperTradingComparisonWindowDecision } from
  "@ouroboros/application/trading/paper/comparison-window-state";
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
  ResearchControlCampaignArmKind,
  ResearchControlCampaignOutcomeRecord,
  ResearchControlCampaignPaperScheduleRecord,
  ResearchControlCampaignPaperScheduleSlot,
  ResearchControlCampaignPaperSlotOutcomeRecord,
  ResearchControlCampaignPaperStartBatchRecord
} from "@ouroboros/domain";

export type ResearchControlCampaignPaperNextAction =
  | { action: "wait_until"; sequence: number; wakeAt: string }
  | {
      action: "expire_unopened_source_slot";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | { action: "prepare_source_batch"; sequence: number }
  | { action: "capture_source_start_batch"; sequence: number }
  | { action: "authorize_source_batch"; sequence: number }
  | { action: "start_source_batch"; sequence: number }
  | { action: "advance_source_window"; sequence: number }
  | {
      action: "adjudicate_source_verdict";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | {
      action: "precommit_confirmation";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | {
      action: "expire_confirmation_precommit";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | {
      action: "advance_confirmation";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | {
      action: "record_slot_outcome";
      armKind: ResearchControlCampaignArmKind;
      sequence: number;
    }
  | { action: "collect_campaign_outcome" }
  | { action: "complete" };

export interface ResearchControlCampaignPaperSlotEvidence {
  armKind: ResearchControlCampaignArmKind;
  sequence: number;
  preparation?: PaperTradingComparisonPreparationRecord;
  commitment?: PaperTradingComparisonCommitmentRecord;
  firstTick?: PaperTradingComparisonTickRecord;
  activation?: PaperTradingComparisonActivationRecord;
  activationAttempt?: PaperTradingComparisonActivationAttemptRecord;
  activationOutcome?: PaperTradingComparisonActivationOutcomeRecord;
  sourceWindowDecision?: PaperTradingComparisonWindowDecision;
  sourceVerdict?: PaperTradingComparisonVerdictRecord;
  confirmationCampaign?: PaperTradingComparisonConfirmationCampaignRecord;
  confirmationOutcome?: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  researchRelease?: PaperTradingComparisonResearchReleaseRecord;
  slotOutcome?: ResearchControlCampaignPaperSlotOutcomeRecord;
}

export interface ProjectResearchControlCampaignPaperNextActionInput {
  schedule: ResearchControlCampaignPaperScheduleRecord;
  now: string;
  confirmationPrecommitDeadlineMs: number;
  slots: ResearchControlCampaignPaperSlotEvidence[];
  startBatches: ResearchControlCampaignPaperStartBatchRecord[];
  campaignOutcome?: ResearchControlCampaignOutcomeRecord;
}

export class ResearchControlCampaignPaperNextActionError extends Error {
  readonly code = "research_control_campaign_paper_next_action_graph_invalid";

  constructor(message: string) {
    super(message);
    this.name = "ResearchControlCampaignPaperNextActionError";
  }
}

interface CandidateSlot {
  armKind: ResearchControlCampaignArmKind;
  slot: Extract<
    ResearchControlCampaignPaperScheduleSlot,
    { slot_status: "candidate_scheduled" }
  >;
}

interface ScheduleGraph {
  sequences: number[];
  candidates: CandidateSlot[];
  evidenceByKey: Map<string, ResearchControlCampaignPaperSlotEvidence>;
  batchBySequence: Map<number, ResearchControlCampaignPaperStartBatchRecord>;
}

export function projectResearchControlCampaignPaperNextAction(
  input: ProjectResearchControlCampaignPaperNextActionInput
): ResearchControlCampaignPaperNextAction {
  const graph = validateInput(input);
  const currentSequence = graph.sequences.find((sequence) =>
    !sequenceIsTerminal(input.schedule, graph, sequence)
  );
  if (currentSequence === undefined) {
    return input.campaignOutcome
      ? { action: "complete" }
      : { action: "collect_campaign_outcome" };
  }
  if (input.campaignOutcome || hasLaterSequenceEvidence(graph, currentSequence)) {
    throw invalidGraph("Paper evidence crossed a nonterminal schedule sequence.");
  }

  const candidates = graph.candidates.filter(({ slot }) =>
    slot.sequence === currentSequence
  );
  const states = candidates.map((candidate) => ({
    ...candidate,
    evidence: graph.evidenceByKey.get(slotKey(
      candidate.armKind,
      currentSequence
    )) ?? emptyEvidence(candidate.armKind, currentSequence)
  }));
  const openStates = states.filter(({ evidence }) => !evidence.slotOutcome);
  const batch = graph.batchBySequence.get(currentSequence);
  const applicableStartAt = applicableStart(input.schedule, graph, currentSequence);

  if (!batch) {
    const preparedStates = states.filter(({ evidence }) => evidence.preparation);
    const missingPreparation = openStates.filter(({ evidence }) =>
      !evidence.preparation
    );
    if (missingPreparation.length > 0) {
      const expired = missingPreparation.find(({ slot }) =>
        Date.parse(input.now) > Date.parse(applicableStartAt) +
          slot.maximum_source_start_delay_ms
      );
      if (expired && preparedStates.length === 0) {
        return {
          action: "expire_unopened_source_slot",
          armKind: expired.armKind,
          sequence: currentSequence
        };
      }
      return { action: "prepare_source_batch", sequence: currentSequence };
    }
    if (openStates.some(({ evidence }) => !evidence.commitment)) {
      return { action: "prepare_source_batch", sequence: currentSequence };
    }
    if (states.some(({ evidence }) => evidence.slotOutcome)) {
      throw invalidGraph(
        "A prepared source cannot form a batch after its paired slot expired."
      );
    }
    return { action: "capture_source_start_batch", sequence: currentSequence };
  }

  if (batch.batch_status === "ineligible") {
    const next = openStates[0];
    if (!next) throw invalidGraph("An ineligible batch has no open source slot.");
    return {
      action: "record_slot_outcome",
      armKind: next.armKind,
      sequence: currentSequence
    };
  }

  if (openStates.some(({ evidence }) => !evidence.activation)) {
    return { action: "authorize_source_batch", sequence: currentSequence };
  }
  if (openStates.some(({ evidence }) =>
    !evidence.activationAttempt || !evidence.activationOutcome
  )) {
    return { action: "start_source_batch", sequence: currentSequence };
  }

  const withoutVerdict = openStates.filter(({ evidence }) =>
    !evidence.sourceVerdict
  );
  if (withoutVerdict.length > 0) {
    const decisions = withoutVerdict.map(({ evidence }) =>
      evidence.sourceWindowDecision
    );
    if (decisions.some((decision) => !decision)) {
      throw invalidGraph(
        "A started source comparison lacks its classified window state."
      );
    }
    const exactDecisions = decisions as PaperTradingComparisonWindowDecision[];
    const terminal = withoutVerdict.find(({ evidence }) =>
      evidence.sourceWindowDecision?.terminal
    );
    if (terminal) {
      if (exactDecisions.some((decision) => !decision.terminal)) {
        throw invalidGraph("Matched source windows diverged in terminal state.");
      }
      return {
        action: "adjudicate_source_verdict",
        armKind: terminal.armKind,
        sequence: currentSequence
      };
    }
    const waiting = exactDecisions.every((decision) =>
      decision.transition === "none" && decision.next_wake_at
    );
    if (waiting) {
      const wakeAt = latestWakeAt(exactDecisions.map((decision) =>
        decision.next_wake_at!
      ));
      return { action: "wait_until", sequence: currentSequence, wakeAt };
    }
    return { action: "advance_source_window", sequence: currentSequence };
  }

  for (const state of openStates) {
    const verdict = state.evidence.sourceVerdict!;
    if (verdict.verdict_outcome !== "challenger_improved") {
      return {
        action: "record_slot_outcome",
        armKind: state.armKind,
        sequence: currentSequence
      };
    }
    if (state.evidence.researchRelease) {
      return {
        action: "record_slot_outcome",
        armKind: state.armKind,
        sequence: currentSequence
      };
    }
    if (state.evidence.confirmationCampaign) {
      return {
        action: "advance_confirmation",
        armKind: state.armKind,
        sequence: currentSequence
      };
    }
    const deadline = Date.parse(verdict.evaluated_at) +
      input.confirmationPrecommitDeadlineMs;
    return Date.parse(input.now) > deadline
      ? {
          action: "expire_confirmation_precommit",
          armKind: state.armKind,
          sequence: currentSequence
        }
      : {
          action: "precommit_confirmation",
          armKind: state.armKind,
          sequence: currentSequence
        };
  }

  throw invalidGraph("Nonterminal schedule sequence has no actionable slot.");
}

function validateInput(
  input: ProjectResearchControlCampaignPaperNextActionInput
): ScheduleGraph {
  if (!input || !input.schedule || !exactIso(input.now) ||
    !Number.isInteger(input.confirmationPrecommitDeadlineMs) ||
    input.confirmationPrecommitDeadlineMs <= 0 || !Array.isArray(input.slots) ||
    !Array.isArray(input.startBatches)) {
    throw invalidGraph("Paper next-action input is malformed.");
  }
  const sequenceSets = input.schedule.arms.map((arm) =>
    arm.slots.map((slot) => slot.sequence)
  );
  if (sequenceSets.length !== 2 || sequenceSets[0]!.length === 0 ||
    sequenceSets[0]!.length !== sequenceSets[1]!.length ||
    sequenceSets[0]!.some((sequence, index) =>
      sequence !== index + 1 || sequenceSets[1]![index] !== sequence
    )) {
    throw invalidGraph("Paper schedule sequences are not contiguous across arms.");
  }
  const sequences = sequenceSets[0]!;
  const candidates: CandidateSlot[] = input.schedule.arms.flatMap((arm) =>
    arm.slots.flatMap((slot) => slot.slot_status === "candidate_scheduled"
      ? [{ armKind: arm.arm_kind, slot }]
      : []
    )
  );
  const candidateByKey = new Map(candidates.map((candidate) => [
    slotKey(candidate.armKind, candidate.slot.sequence),
    candidate
  ]));
  const evidenceByKey = new Map<string, ResearchControlCampaignPaperSlotEvidence>();
  for (const evidence of input.slots) {
    const key = slotKey(evidence.armKind, evidence.sequence);
    const candidate = candidateByKey.get(key);
    if (!candidate || evidenceByKey.has(key)) {
      throw invalidGraph("Paper slot evidence is duplicate or not schedule-owned.");
    }
    validateSlotEvidence(input.schedule, candidate, evidence);
    evidenceByKey.set(key, evidence);
  }
  const batchBySequence = new Map<number, ResearchControlCampaignPaperStartBatchRecord>();
  for (const batch of input.startBatches) {
    if (!sequences.includes(batch.sequence) || batchBySequence.has(batch.sequence) ||
      batch.schedule_ref.id !==
        input.schedule.research_control_campaign_paper_schedule_id ||
      batch.schedule_digest !== input.schedule.schedule_digest) {
      throw invalidGraph("Paper start batch is duplicate or not schedule-owned.");
    }
    const batchCandidates = candidates.filter(({ slot }) =>
      slot.sequence === batch.sequence
    );
    validateBatch(batch, batchCandidates, evidenceByKey);
    batchBySequence.set(batch.sequence, batch);
  }
  const graph = { sequences, candidates, evidenceByKey, batchBySequence };
  if (input.campaignOutcome && sequences.some((sequence) =>
    !sequenceIsTerminal(input.schedule, graph, sequence)
  )) {
    throw invalidGraph("Campaign outcome exists before all paper slots are terminal.");
  }
  return graph;
}

function validateSlotEvidence(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  candidate: CandidateSlot,
  evidence: ResearchControlCampaignPaperSlotEvidence
): void {
  const slot = candidate.slot;
  if (evidence.slotOutcome) {
    if (evidence.slotOutcome.schedule_ref.id !==
        schedule.research_control_campaign_paper_schedule_id ||
      evidence.slotOutcome.schedule_digest !== schedule.schedule_digest ||
      evidence.slotOutcome.arm_kind !== candidate.armKind ||
      evidence.slotOutcome.sequence !== slot.sequence ||
      !exactIso(evidence.slotOutcome.terminal_at)) {
      throw invalidGraph("Terminal slot outcome does not match its schedule slot.");
    }
    return;
  }
  const preparation = evidence.preparation;
  const commitment = evidence.commitment;
  const tick = evidence.firstTick;
  const activation = evidence.activation;
  const attempt = evidence.activationAttempt;
  const activationOutcome = evidence.activationOutcome;
  const verdict = evidence.sourceVerdict;
  const confirmation = evidence.confirmationCampaign;
  const confirmationOutcome = evidence.confirmationOutcome;
  const release = evidence.researchRelease;
  if (preparation && (preparation.paper_trading_comparison_preparation_id !==
      slot.source_preparation_id ||
    preparation.paper_trading_comparison_commitment_id !==
      slot.source_comparison_commitment_id) ||
    commitment && (!preparation ||
      commitment.paper_trading_comparison_commitment_id !==
        slot.source_comparison_commitment_id ||
      commitment.preparation_ref.id !== slot.source_preparation_id) ||
    tick && (!commitment || tick.sequence !== 1 ||
      tick.paper_trading_comparison_commitment_ref.id !==
        commitment.paper_trading_comparison_commitment_id ||
      tick.paper_trading_comparison_commitment_digest !==
        commitment.commitment_digest) ||
    activation && (!tick || !commitment ||
      activation.paper_trading_comparison_commitment_ref.id !==
        commitment.paper_trading_comparison_commitment_id ||
      activation.first_tick_ref.id !== tick.paper_trading_comparison_tick_id) ||
    attempt && (!activation ||
      attempt.paper_trading_comparison_activation_ref.id !==
        activation.paper_trading_comparison_activation_id) ||
    activationOutcome && (!attempt ||
      activationOutcome.paper_trading_comparison_activation_attempt_ref.id !==
        attempt.paper_trading_comparison_activation_attempt_id) ||
    evidence.sourceWindowDecision && !activationOutcome ||
    verdict && (!commitment ||
      verdict.paper_trading_comparison_commitment_ref.id !==
        commitment.paper_trading_comparison_commitment_id) ||
    confirmation && (!verdict || verdict.verdict_outcome !==
      "challenger_improved" || confirmation.source_verdict_ref.id !==
        verdict.paper_trading_comparison_verdict_id ||
      confirmation.source_comparison_ref.id !==
        commitment?.paper_trading_comparison_commitment_id) ||
    confirmationOutcome && (!confirmation ||
      confirmationOutcome.campaign_ref.id !==
        confirmation.paper_trading_comparison_confirmation_campaign_id) ||
    release && (!confirmation || !confirmationOutcome ||
      release.campaign_ref.id !==
        confirmation.paper_trading_comparison_confirmation_campaign_id ||
      release.campaign_outcome_ref.id !==
        confirmationOutcome.paper_trading_comparison_confirmation_campaign_outcome_id)) {
    throw invalidGraph("Paper slot evidence is not a contiguous source graph.");
  }
}

function validateBatch(
  batch: ResearchControlCampaignPaperStartBatchRecord,
  candidates: CandidateSlot[],
  evidenceByKey: Map<string, ResearchControlCampaignPaperSlotEvidence>
): void {
  if (candidates.length === 0 || batch.sides.length !== candidates.length ||
    !["single_ready", "paired_ready", "ineligible"].includes(
      batch.batch_status
    )) {
    throw invalidGraph("Paper start batch has an invalid candidate cardinality.");
  }
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const side = batch.sides[index];
    const evidence = evidenceByKey.get(slotKey(
      candidate.armKind,
      candidate.slot.sequence
    ));
    if (!side || !evidence?.preparation || !evidence.commitment ||
      side.arm_kind !== candidate.armKind ||
      side.source_comparison_ref.id !==
        evidence.commitment.paper_trading_comparison_commitment_id ||
      side.source_comparison_digest !== evidence.commitment.commitment_digest ||
      side.first_tick_ref && side.first_tick_ref.id !==
        evidence.firstTick?.paper_trading_comparison_tick_id ||
      side.first_tick_digest && side.first_tick_digest !==
        evidence.firstTick?.tick_digest ||
      batch.batch_status !== "ineligible" &&
        (!evidence.firstTick || !side.first_tick_ref || !side.first_tick_digest)) {
      throw invalidGraph("Paper start batch does not match exact source evidence.");
    }
  }
}

function sequenceIsTerminal(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  graph: ScheduleGraph,
  sequence: number
): boolean {
  return schedule.arms.every((arm) => {
    const slot = arm.slots[sequence - 1];
    if (!slot || slot.sequence !== sequence) return false;
    return slot.slot_status === "no_admitted_candidate" || Boolean(
      graph.evidenceByKey.get(slotKey(arm.arm_kind, sequence))?.slotOutcome
    );
  });
}

function applicableStart(
  schedule: ResearchControlCampaignPaperScheduleRecord,
  graph: ScheduleGraph,
  sequence: number
): string {
  if (sequence === 1) return schedule.committed_at;
  const terminalTimes = schedule.arms.map((arm) => {
    const prior = arm.slots[sequence - 2];
    if (!prior || prior.sequence !== sequence - 1) throw invalidGraph(
      "Paper schedule predecessor is missing."
    );
    if (prior.slot_status === "no_admitted_candidate") return schedule.committed_at;
    const outcome = graph.evidenceByKey.get(slotKey(
      arm.arm_kind,
      sequence - 1
    ))?.slotOutcome;
    if (!outcome) throw invalidGraph("Paper schedule predecessor is nonterminal.");
    return outcome.terminal_at;
  });
  return terminalTimes.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest
  );
}

function hasLaterSequenceEvidence(
  graph: ScheduleGraph,
  currentSequence: number
): boolean {
  return [...graph.evidenceByKey.values()].some((evidence) =>
    evidence.sequence > currentSequence && hasPersistedEvidence(evidence)
  ) || [...graph.batchBySequence.keys()].some((sequence) =>
    sequence > currentSequence
  );
}

function hasPersistedEvidence(
  evidence: ResearchControlCampaignPaperSlotEvidence
): boolean {
  return Object.entries(evidence).some(([key, value]) =>
    key !== "armKind" && key !== "sequence" && value !== undefined
  );
}

function emptyEvidence(
  armKind: ResearchControlCampaignArmKind,
  sequence: number
): ResearchControlCampaignPaperSlotEvidence {
  return { armKind, sequence };
}

function latestWakeAt(values: string[]): string {
  if (values.length === 0 || values.some((value) => !exactIso(value))) {
    throw invalidGraph("Matched source windows have an invalid next wake time.");
  }
  return values.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest
  );
}

function slotKey(
  armKind: ResearchControlCampaignArmKind,
  sequence: number
): string {
  return `${sequence}:${armKind}`;
}

function exactIso(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function invalidGraph(message: string): ResearchControlCampaignPaperNextActionError {
  return new ResearchControlCampaignPaperNextActionError(message);
}
