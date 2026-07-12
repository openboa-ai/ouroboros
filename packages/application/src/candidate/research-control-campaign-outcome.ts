import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignHasRuntimeShape,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonRefsEqual,
  paperTradingComparisonResearchReleaseDigestInput,
  paperTradingComparisonResearchReleaseHasRuntimeShape,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignOutcomeDigestInput,
  researchControlCampaignOutcomeHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type PaperTradingComparisonResearchReleaseKind,
  type PaperTradingComparisonResearchReleaseRecord,
  type Ref,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignOutcomeArm,
  type ResearchControlCampaignOutcomeArmMetrics,
  type ResearchControlCampaignOutcomeRecord,
  type ResearchControlCampaignOutcomeSlotResult,
  type ResearchControlCampaignPaperCandidateSlot,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { decidePaperTradingComparisonResearchRelease } from
  "../trading/paper/comparison-research-release-decision";

export interface ResearchControlCampaignOutcomePaperClosure {
  sequence: number;
  tickRef: Ref;
  confirmationCampaign: PaperTradingComparisonConfirmationCampaignRecord;
  confirmationOutcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  researchRelease: PaperTradingComparisonResearchReleaseRecord;
}

export interface ResearchControlCampaignOutcomeArmEvidence {
  armKind: ResearchControlCampaignArmKind;
  paperClosures: ResearchControlCampaignOutcomePaperClosure[];
}

export interface AdjudicateResearchControlCampaignOutcomeInput {
  campaign: ResearchControlCampaignRecord;
  report: ResearchControlCampaignReportRecord;
  arms: readonly [
    ResearchControlCampaignOutcomeArmEvidence,
    ResearchControlCampaignOutcomeArmEvidence
  ];
  adjudicatedAt: string;
}

export class ResearchControlCampaignOutcomeDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_outcome_decision_input";

  constructor() {
    super("ResearchControlCampaignOutcome decision input is invalid.");
    this.name = "ResearchControlCampaignOutcomeDecisionError";
  }
}

export type ResearchControlCampaignOutcomeServiceErrorCode =
  | "research_control_campaign_outcome_graph_invalid"
  | "research_control_campaign_outcome_conflict"
  | "research_control_campaign_outcome_persistence_conflict";

export class ResearchControlCampaignOutcomeServiceError extends Error {
  constructor(
    readonly code: ResearchControlCampaignOutcomeServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlCampaignOutcomeServiceError";
  }
}

export class ResearchControlCampaignOutcomeService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async replay(input: {
    campaign: ResearchControlCampaignRecord;
    report: ResearchControlCampaignReportRecord;
  }): Promise<ResearchControlCampaignOutcomeRecord | undefined> {
    const existing = await this.options.store.getResearchControlCampaignOutcome(
      researchControlCampaignOutcomeId(input.report)
    );
    if (!existing) return undefined;
    if (!outcomeMatchesGraph(existing, input.campaign, input.report) ||
      !await this.storeGraphMatches(input.campaign, input.report)) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_conflict",
        "Persisted ResearchControlCampaignOutcome conflicts with its frozen graph."
      );
    }
    return existing;
  }

  async adjudicate(
    input: Omit<AdjudicateResearchControlCampaignOutcomeInput, "adjudicatedAt">
  ): Promise<ResearchControlCampaignOutcomeRecord> {
    const replay = await this.replay({
      campaign: input.campaign,
      report: input.report
    });
    if (replay) return replay;

    if (!await this.storeGraphMatches(input.campaign, input.report)) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_graph_invalid",
        "ResearchControlCampaignOutcome source graph is absent or mismatched."
      );
    }
    const outcome = adjudicateResearchControlCampaignOutcome({
      ...input,
      adjudicatedAt: this.now()
    });
    const recorded = await this.options.store.recordResearchControlCampaignOutcome(
      outcome
    );
    if (!isDeepStrictEqual(recorded, outcome) ||
      !outcomeMatchesGraph(recorded, input.campaign, input.report)) {
      throw new ResearchControlCampaignOutcomeServiceError(
        "research_control_campaign_outcome_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaignOutcome evidence."
      );
    }
    return recorded;
  }

  private async storeGraphMatches(
    campaign: ResearchControlCampaignRecord,
    report: ResearchControlCampaignReportRecord
  ): Promise<boolean> {
    const [storedCampaign, storedReport] = await Promise.all([
      this.options.store.getResearchControlCampaign(
        campaign.research_control_campaign_id
      ),
      this.options.store.getResearchControlCampaignReport(
        report.research_control_campaign_report_id
      )
    ]);
    return isDeepStrictEqual(storedCampaign, campaign) &&
      isDeepStrictEqual(storedReport, report);
  }
}

export function adjudicateResearchControlCampaignOutcome(
  input: AdjudicateResearchControlCampaignOutcomeInput
): ResearchControlCampaignOutcomeRecord {
  try {
    assertSourceGraph(input);
    const adjudicatedAt = canonicalTime(input.adjudicatedAt);
    const policyDigests: string[] = [];
    const arms: [
      ResearchControlCampaignOutcomeArm,
      ResearchControlCampaignOutcomeArm
    ] = [
      buildOutcomeArm(
        input,
        input.report.arms[0],
        input.arms[0],
        adjudicatedAt,
        policyDigests
      ),
      buildOutcomeArm(
        input,
        input.report.arms[1],
        input.arms[1],
        adjudicatedAt,
        policyDigests
      )
    ];
    if (new Set(policyDigests).size > 1) throw invalidDecision();
    const sharedPolicyDigest = policyDigests[0] ?? canonicalDigest({
      policy_status: "not_applicable_no_reserved_candidates"
    });
    const observedRateDifference = round6(
      arms[0].metrics.qualified_discovery_rate -
        arms[1].metrics.qualified_discovery_rate
    );
    const record: ResearchControlCampaignOutcomeRecord = {
      record_kind: "research_control_campaign_outcome",
      version: 1,
      research_control_campaign_outcome_id:
        researchControlCampaignOutcomeId(input.report),
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: input.campaign.research_control_campaign_id
      },
      campaign_digest: input.campaign.campaign_digest,
      report_ref: {
        record_kind: "research_control_campaign_report",
        id: input.report.research_control_campaign_report_id
      },
      report_digest: input.report.report_digest,
      paper_comparator: structuredClone(input.campaign.paper_comparator),
      shared_evaluation_policy_status: policyDigests.length === 0
        ? "not_applicable_no_reserved_candidates"
        : "bound",
      shared_evaluation_policy_digest: sharedPolicyDigest,
      arms,
      observed_rate_difference: observedRateDifference,
      observed_result: observedRateDifference > 0
        ? "adaptive_rate_higher"
        : observedRateDifference < 0
        ? "static_rate_higher"
        : "rates_equal",
      causal_conclusion: "single_campaign_observation_only",
      policy_replacement_eligibility: "not_eligible",
      next_action: "accumulate_replicated_control_campaigns",
      adjudicated_at: adjudicatedAt,
      outcome_digest: pendingDigest(),
      evaluation_authority: "external_to_trading_systems",
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    };
    record.outcome_digest = canonicalDigest(
      researchControlCampaignOutcomeDigestInput(record)
    );
    if (!researchControlCampaignOutcomeHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignOutcomeDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchControlCampaignOutcomeId(
  report: ResearchControlCampaignReportRecord
): string {
  const id = canonicalString(report?.research_control_campaign_report_id);
  return `research-control-campaign-outcome-${digestHex(id).slice(0, 20)}`;
}

function assertSourceGraph(
  input: AdjudicateResearchControlCampaignOutcomeInput
): asserts input is AdjudicateResearchControlCampaignOutcomeInput & {
  campaign: ResearchControlCampaignRecord & {
    paper_comparator: Extract<
      ResearchControlCampaignRecord["paper_comparator"],
      { comparator_status: "trading_review" }
    >;
  };
} {
  if (!input || !researchControlCampaignHasRuntimeShape(input.campaign) ||
    !researchControlCampaignReportHasRuntimeShape(input.report) ||
    input.campaign.paper_comparator.comparator_status !== "trading_review" ||
    canonicalDigest(researchControlCampaignDigestInput(input.campaign)) !==
      input.campaign.campaign_digest ||
    canonicalDigest(researchControlCampaignReportDigestInput(input.report)) !==
      input.report.report_digest ||
    !paperTradingComparisonRefsEqual(input.report.campaign_ref, {
      record_kind: "research_control_campaign",
      id: input.campaign.research_control_campaign_id
    }) || input.report.campaign_digest !== input.campaign.campaign_digest ||
    input.report.arms.length !== input.campaign.arms.length ||
    input.report.arms.some((arm, index) =>
      arm.arm_kind !== input.campaign.arms[index]!.arm_kind ||
      arm.allocation_mode !== input.campaign.arms[index]!.allocation_mode ||
      arm.arm_intent_ref.id !== input.campaign.arms[index]!
        .research_control_campaign_arm_intent_id ||
      arm.paper_candidate_slots.length !==
        input.campaign.policy.paper_candidate_slot_count_per_arm
    ) || Date.parse(input.report.completed_at) <
      Date.parse(input.campaign.committed_at) || !Array.isArray(input.arms) ||
    input.arms.length !== 2 ||
    input.arms[0]?.armKind !== "adaptive_treatment" ||
    input.arms[1]?.armKind !== "static_control") {
    throw invalidDecision();
  }
}

function buildOutcomeArm(
  input: AdjudicateResearchControlCampaignOutcomeInput & {
    campaign: ResearchControlCampaignRecord & {
      paper_comparator: Extract<
        ResearchControlCampaignRecord["paper_comparator"],
        { comparator_status: "trading_review" }
      >;
    };
  },
  reportArm: ResearchControlCampaignReportRecord["arms"][number],
  evidence: ResearchControlCampaignOutcomeArmEvidence,
  adjudicatedAt: string,
  policyDigests: string[]
): ResearchControlCampaignOutcomeArm {
  if (!evidence || evidence.armKind !== reportArm.arm_kind ||
    !Array.isArray(evidence.paperClosures)) {
    throw invalidDecision();
  }
  const closures = uniqueClosureMap(evidence.paperClosures);
  const slotResults = reportArm.paper_candidate_slots.map((slot) => {
    const key = closureKey(slot.sequence, slot.tick_ref);
    const closure = closures.get(key);
    if (slot.status === "no_admitted_candidate") {
      if (closure) throw invalidDecision();
      return {
        sequence: slot.sequence,
        tick_ref: { ...slot.tick_ref },
        terminal_status: "no_admitted_candidate",
        discovery_credit: 0
      } satisfies ResearchControlCampaignOutcomeSlotResult;
    }
    if (!closure) throw invalidDecision();
    closures.delete(key);
    return buildPaperSlotResult(
      input,
      slot,
      closure,
      adjudicatedAt,
      policyDigests
    );
  });
  if (closures.size !== 0) throw invalidDecision();
  return {
    arm_kind: reportArm.arm_kind,
    allocation_mode: reportArm.allocation_mode,
    slot_results: slotResults,
    metrics: buildMetrics(slotResults)
  };
}

function buildPaperSlotResult(
  input: AdjudicateResearchControlCampaignOutcomeInput & {
    campaign: ResearchControlCampaignRecord & {
      paper_comparator: Extract<
        ResearchControlCampaignRecord["paper_comparator"],
        { comparator_status: "trading_review" }
      >;
    };
  },
  slot: Extract<
    ResearchControlCampaignPaperCandidateSlot,
    { status: "candidate_reserved" }
  >,
  closure: ResearchControlCampaignOutcomePaperClosure,
  adjudicatedAt: string,
  policyDigests: string[]
): ResearchControlCampaignOutcomeSlotResult {
  const confirmationCampaign = closure.confirmationCampaign;
  const confirmationOutcome = closure.confirmationOutcome;
  const release = closure.researchRelease;
  if (!paperTradingComparisonConfirmationCampaignHasRuntimeShape(
    confirmationCampaign
  ) || !paperTradingComparisonConfirmationCampaignOutcomeHasRuntimeShape(
    confirmationOutcome
  ) || !paperTradingComparisonResearchReleaseHasRuntimeShape(release) ||
    canonicalDigest(paperTradingComparisonConfirmationCampaignDigestInput(
      confirmationCampaign
    )) !== confirmationCampaign.campaign_digest ||
    canonicalDigest(
      paperTradingComparisonConfirmationCampaignOutcomeDigestInput(
        confirmationOutcome
      )
    ) !== confirmationOutcome.outcome_digest ||
    canonicalDigest(paperTradingComparisonResearchReleaseDigestInput(release)) !==
      release.release_digest ||
    confirmationCampaign.comparison_policy.comparison_mode !==
      "champion_challenge" ||
    confirmationCampaign.champion_selection.selection_kind !==
      "trading_review" ||
    !paperTradingComparisonRefsEqual(
      confirmationCampaign.champion_selection.trading_promotion_ref,
      input.campaign.paper_comparator.trading_promotion_ref
    ) || confirmationCampaign.champion_selection.trading_promotion_digest !==
      input.campaign.paper_comparator.trading_promotion_digest ||
    !paperTradingComparisonRefsEqual(
      confirmationCampaign.champion_selection.paper_trading_evaluation_ref,
      input.campaign.paper_comparator.paper_trading_evaluation_ref
    ) || !sideMatchesComparator(
      confirmationCampaign.champion,
      input.campaign.paper_comparator
    ) || !sideMatchesSlot(confirmationCampaign.challenger, slot) ||
    !paperTradingComparisonRefsEqual(confirmationOutcome.campaign_ref, {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: confirmationCampaign
        .paper_trading_comparison_confirmation_campaign_id
    }) || confirmationOutcome.campaign_digest !==
      confirmationCampaign.campaign_digest ||
    !paperTradingComparisonRefsEqual(release.campaign_ref,
      confirmationOutcome.campaign_ref) ||
    release.campaign_digest !== confirmationCampaign.campaign_digest ||
    !paperTradingComparisonRefsEqual(release.campaign_outcome_ref, {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: confirmationOutcome
        .paper_trading_comparison_confirmation_campaign_outcome_id
    }) || release.campaign_outcome_digest !== confirmationOutcome.outcome_digest ||
    !releaseMatchesSlot(release, slot) ||
    release.release_kind !== expectedReleaseKind(confirmationOutcome) ||
    Date.parse(confirmationCampaign.committed_at) <
      Date.parse(input.report.completed_at) ||
    Date.parse(confirmationOutcome.evaluated_at) <
      Date.parse(confirmationCampaign.committed_at) ||
    Date.parse(release.released_at) < Date.parse(confirmationOutcome.evaluated_at) ||
    Date.parse(adjudicatedAt) < Date.parse(release.released_at)) {
    throw invalidDecision();
  }

  const policyDigest = canonicalDigest({
    comparison_policy: confirmationCampaign.comparison_policy,
    market_data_configuration_digest:
      confirmationCampaign.market_data_configuration_digest,
    paper_policy_identity: confirmationCampaign.paper_policy_identity
  });
  policyDigests.push(policyDigest);
  const terminal = releaseTerminal(release.release_kind);
  return {
    sequence: slot.sequence,
    tick_ref: { ...slot.tick_ref },
    terminal_status: terminal.status,
    candidate_ref: { ...slot.candidate_ref },
    candidate_version_ref: { ...slot.candidate_version_ref },
    system_code_ref: { ...slot.system_code_ref },
    system_code_artifact_digest: slot.system_code_artifact_digest,
    confirmation_campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: confirmationCampaign.paper_trading_comparison_confirmation_campaign_id
    },
    confirmation_campaign_digest: confirmationCampaign.campaign_digest,
    confirmation_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: confirmationOutcome
        .paper_trading_comparison_confirmation_campaign_outcome_id
    },
    confirmation_outcome_digest: confirmationOutcome.outcome_digest,
    research_release_ref: {
      record_kind: "paper_trading_comparison_research_release",
      id: release.paper_trading_comparison_research_release_id
    },
    research_release_digest: release.release_digest,
    release_kind: release.release_kind,
    discovery_credit: terminal.discoveryCredit
  };
}

function sideMatchesComparator(
  side: PaperTradingComparisonConfirmationCampaignRecord["champion"],
  comparator: Extract<
    ResearchControlCampaignRecord["paper_comparator"],
    { comparator_status: "trading_review" }
  >
): boolean {
  return paperTradingComparisonRefsEqual(side.candidate_ref, comparator.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side.candidate_version_ref,
      comparator.candidate_version_ref
    );
}

function sideMatchesSlot(
  side: PaperTradingComparisonConfirmationCampaignRecord["challenger"],
  slot: Extract<
    ResearchControlCampaignPaperCandidateSlot,
    { status: "candidate_reserved" }
  >
): boolean {
  return paperTradingComparisonRefsEqual(side.candidate_ref, slot.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      side.candidate_version_ref,
      slot.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(side.system_code_ref, slot.system_code_ref) &&
    side.system_code_artifact_digest === slot.system_code_artifact_digest;
}

function releaseMatchesSlot(
  release: PaperTradingComparisonResearchReleaseRecord,
  slot: Extract<
    ResearchControlCampaignPaperCandidateSlot,
    { status: "candidate_reserved" }
  >
): boolean {
  return paperTradingComparisonRefsEqual(release.candidate_ref, slot.candidate_ref) &&
    paperTradingComparisonRefsEqual(
      release.candidate_version_ref,
      slot.candidate_version_ref
    ) && paperTradingComparisonRefsEqual(release.system_code_ref, slot.system_code_ref) &&
    release.system_code_artifact_digest === slot.system_code_artifact_digest;
}

function expectedReleaseKind(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): PaperTradingComparisonResearchReleaseKind {
  return decidePaperTradingComparisonResearchRelease(outcome).release_kind;
}

function releaseTerminal(kind: PaperTradingComparisonResearchReleaseKind): {
  status: Exclude<
    ResearchControlCampaignOutcomeSlotResult["terminal_status"],
    "no_admitted_candidate"
  >;
  discoveryCredit: 0 | 1;
} {
  switch (kind) {
    case "confirmed_improvement":
      return { status: "qualified_improvement", discoveryCredit: 1 };
    case "challenger_not_reproduced":
      return { status: "not_reproduced", discoveryCredit: 0 };
    case "comparison_evidence_ineligible":
      return { status: "evidence_ineligible", discoveryCredit: 0 };
    case "campaign_slot_expired":
      return { status: "paper_slot_expired", discoveryCredit: 0 };
  }
}

function buildMetrics(
  slots: readonly ResearchControlCampaignOutcomeSlotResult[]
): ResearchControlCampaignOutcomeArmMetrics {
  const count = (status: ResearchControlCampaignOutcomeSlotResult["terminal_status"]) =>
    slots.filter((slot) => slot.terminal_status === status).length;
  const noCandidate = count("no_admitted_candidate");
  const qualified = count("qualified_improvement");
  return {
    slot_count: slots.length,
    admitted_candidate_slot_count: slots.length - noCandidate,
    no_admitted_candidate_count: noCandidate,
    qualified_discovery_count: qualified,
    not_reproduced_count: count("not_reproduced"),
    evidence_ineligible_count: count("evidence_ineligible"),
    paper_slot_expired_count: count("paper_slot_expired"),
    qualified_discovery_rate: round6(qualified / slots.length)
  };
}

function uniqueClosureMap(
  closures: ResearchControlCampaignOutcomePaperClosure[]
): Map<string, ResearchControlCampaignOutcomePaperClosure> {
  const result = new Map<string, ResearchControlCampaignOutcomePaperClosure>();
  for (const closure of closures) {
    if (!closure || !Number.isInteger(closure.sequence) || closure.sequence < 1) {
      throw invalidDecision();
    }
    const key = closureKey(closure.sequence, closure.tickRef);
    if (result.has(key)) throw invalidDecision();
    result.set(key, closure);
  }
  return result;
}

function closureKey(sequence: number, tickRef: Ref): string {
  if (!tickRef || tickRef.record_kind !== "candidate_arena_tick" ||
    !canonicalStringOrUndefined(tickRef.id)) {
    throw invalidDecision();
  }
  return `${sequence}:${tickRef.record_kind}:${tickRef.id}`;
}

function outcomeMatchesGraph(
  outcome: ResearchControlCampaignOutcomeRecord,
  campaign: ResearchControlCampaignRecord,
  report: ResearchControlCampaignReportRecord
): boolean {
  return researchControlCampaignOutcomeHasRuntimeShape(outcome) &&
    canonicalDigest(researchControlCampaignOutcomeDigestInput(outcome)) ===
      outcome.outcome_digest && paperTradingComparisonRefsEqual(
        outcome.campaign_ref,
        {
          record_kind: "research_control_campaign",
          id: campaign.research_control_campaign_id
        }
      ) && outcome.campaign_digest === campaign.campaign_digest &&
    paperTradingComparisonRefsEqual(outcome.report_ref, {
      record_kind: "research_control_campaign_report",
      id: report.research_control_campaign_report_id
    }) && outcome.report_digest === report.report_digest &&
    isDeepStrictEqual(outcome.paper_comparator, campaign.paper_comparator);
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
  if (!canonicalStringOrUndefined(value) || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalStringOrUndefined(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) &&
    value.trim() === value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function invalidDecision(): ResearchControlCampaignOutcomeDecisionError {
  return new ResearchControlCampaignOutcomeDecisionError();
}
