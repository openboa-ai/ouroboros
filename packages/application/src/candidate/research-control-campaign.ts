import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  candidateArenaResearchAllocationHasRuntimeShape,
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignArmIntentDigestInput,
  researchControlCampaignArmIntentHasRuntimeShape,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignReportDigestInput,
  researchControlCampaignReportHasRuntimeShape,
  researchPopulationDiversityHasRuntimeShape,
  type CandidateArenaResearchAllocationRecord,
  type CandidateArenaTickDirectionResultReadModel,
  type CandidateArenaTickRecord,
  type ResearchControlCampaignAgentIdentity,
  type ResearchControlCampaignArmIntentRecord,
  type ResearchControlCampaignArmKind,
  type ResearchControlCampaignArmReport,
  type ResearchControlCampaignBaselineSnapshot,
  type ResearchControlCampaignPaperCandidateSlot,
  type ResearchControlCampaignPaperComparator,
  type ResearchControlCampaignRecord,
  type ResearchControlCampaignReportRecord,
  type ResearchControlCampaignSource,
  type ResearchPopulationDiversityReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import type { ManagedResearchAgent } from "../trading/research/types";

const DEFAULT_MAXIMUM_BASELINE_REGULAR_FILE_COUNT = 10_000;
const DEFAULT_MAXIMUM_BASELINE_TOTAL_BYTES = 1_000_000_000;

export interface ResearchControlCampaignDecisionInput {
  idempotencyKey: string;
  baseline: ResearchControlCampaignBaselineSnapshot;
  source: ResearchControlCampaignSource;
  researchAgent: ManagedResearchAgent;
  paperComparator: ResearchControlCampaignPaperComparator;
  tickCountPerArm: number;
  maximumBaselineRegularFileCount?: number;
  maximumBaselineTotalBytes?: number;
  committedAt: string;
}

export type ResearchControlCampaignCommitRequest = Omit<
  ResearchControlCampaignDecisionInput,
  "committedAt"
>;

export interface ResearchControlCampaignCandidateClosure {
  candidate_id: string;
  candidate_version_id: string;
  system_code_id: string;
  system_code_artifact_digest: string;
  admission_decision_id: string;
}

export interface ResearchControlCampaignArmEvidenceInput {
  intent: ResearchControlCampaignArmIntentRecord;
  ticks: CandidateArenaTickRecord[];
  allocations: CandidateArenaResearchAllocationRecord[];
  populationDiversity: ResearchPopulationDiversityReadModel;
  candidateClosures: ResearchControlCampaignCandidateClosure[];
  finalStoreSnapshotDigest: string;
  completedAt: string;
}

export interface BuildResearchControlCampaignReportInput {
  campaign: ResearchControlCampaignRecord;
  arms: [
    ResearchControlCampaignArmEvidenceInput,
    ResearchControlCampaignArmEvidenceInput
  ];
  completedAt: string;
}

export class ResearchControlCampaignDecisionError extends Error {
  readonly code = "invalid_research_control_campaign_decision_input";

  constructor() {
    super("ResearchControlCampaign decision input is invalid.");
    this.name = "ResearchControlCampaignDecisionError";
  }
}

export type ResearchControlCampaignServiceErrorCode =
  | "research_control_campaign_request_conflict"
  | "research_control_campaign_persistence_conflict"
  | "research_control_campaign_arm_intent_conflict"
  | "research_control_campaign_arm_intent_persistence_conflict"
  | "research_control_campaign_report_graph_invalid"
  | "research_control_campaign_report_conflict"
  | "research_control_campaign_report_persistence_conflict";

export class ResearchControlCampaignServiceError extends Error {
  constructor(
    readonly code: ResearchControlCampaignServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlCampaignServiceError";
  }
}

export class ResearchControlCampaignService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async commit(
    input: ResearchControlCampaignCommitRequest
  ): Promise<ResearchControlCampaignRecord> {
    const campaignId = researchControlCampaignId(input.idempotencyKey);
    const existing = await this.options.store.getResearchControlCampaign(
      campaignId
    );
    if (existing) {
      const requested = decideResearchControlCampaign({
        ...input,
        committedAt: existing.committed_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlCampaignServiceError(
          "research_control_campaign_request_conflict",
          "ResearchControlCampaign request conflicts with frozen intent."
        );
      }
      return existing;
    }

    const campaign = decideResearchControlCampaign({
      ...input,
      committedAt: this.now()
    });
    const recorded = await this.options.store.recordResearchControlCampaign(
      campaign
    );
    if (!researchControlCampaignHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, campaign)) {
      throw new ResearchControlCampaignServiceError(
        "research_control_campaign_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaign intent."
      );
    }
    return recorded;
  }

  async commitArmIntent(input: {
    campaign: ResearchControlCampaignRecord;
    armKind: ResearchControlCampaignArmKind;
  }): Promise<ResearchControlCampaignArmIntentRecord> {
    const arm = campaignArm(input.campaign, input.armKind);
    const existing = await this.options.store
      .getResearchControlCampaignArmIntent(
        arm.research_control_campaign_arm_intent_id
      );
    if (existing) {
      const requested = decideResearchControlCampaignArmIntent({
        ...input,
        committedAt: existing.committed_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlCampaignServiceError(
          "research_control_campaign_arm_intent_conflict",
          "ResearchControlCampaign arm intent conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const intent = decideResearchControlCampaignArmIntent({
      ...input,
      committedAt: this.now()
    });
    const recorded = await this.options.store
      .recordResearchControlCampaignArmIntent(intent);
    if (!researchControlCampaignArmIntentHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, intent)) {
      throw new ResearchControlCampaignServiceError(
        "research_control_campaign_arm_intent_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaign arm intent."
      );
    }
    return recorded;
  }

  async recordReport(
    report: ResearchControlCampaignReportRecord
  ): Promise<ResearchControlCampaignReportRecord> {
    if (!researchControlCampaignReportHasRuntimeShape(report) ||
      !await this.reportGraphExists(report)) {
      throw new ResearchControlCampaignServiceError(
        "research_control_campaign_report_graph_invalid",
        "ResearchControlCampaign report graph is incomplete or mismatched."
      );
    }
    const existing = await this.options.store.getResearchControlCampaignReport(
      report.research_control_campaign_report_id
    );
    if (existing) {
      if (!isDeepStrictEqual(existing, report)) {
        throw new ResearchControlCampaignServiceError(
          "research_control_campaign_report_conflict",
          "ResearchControlCampaign report is append-only."
        );
      }
      return existing;
    }
    const recorded = await this.options.store.recordResearchControlCampaignReport(
      report
    );
    if (!researchControlCampaignReportHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, report)) {
      throw new ResearchControlCampaignServiceError(
        "research_control_campaign_report_persistence_conflict",
        "Store did not preserve exact ResearchControlCampaign report."
      );
    }
    return recorded;
  }

  private async reportGraphExists(
    report: ResearchControlCampaignReportRecord
  ): Promise<boolean> {
    const campaign = await this.options.store.getResearchControlCampaign(
      report.campaign_ref.id
    );
    if (!campaign || campaign.campaign_digest !== report.campaign_digest) {
      return false;
    }
    const intents = await Promise.all(report.arms.map((arm) =>
      this.options.store.getResearchControlCampaignArmIntent(
        arm.arm_intent_ref.id
      )
    ));
    return intents.every((intent, index) => intent !== undefined &&
      intent.intent_digest === report.arms[index]!.arm_intent_digest &&
      armIntentMatchesCampaign(intent, campaign, report.arms[index]!.arm_kind)
    );
  }
}

export function decideResearchControlCampaign(
  input: ResearchControlCampaignDecisionInput
): ResearchControlCampaignRecord {
  try {
    const idempotencyKey = canonicalString(input?.idempotencyKey);
    const campaignId = researchControlCampaignId(idempotencyKey);
    const token = digestHex(idempotencyKey).slice(0, 16);
    const tickCount = positiveBoundedInteger(input?.tickCountPerArm, 5);
    const maximumFileCount = positiveBoundedInteger(
      input?.maximumBaselineRegularFileCount ??
        DEFAULT_MAXIMUM_BASELINE_REGULAR_FILE_COUNT,
      100_000
    );
    const maximumBytes = positiveBoundedInteger(
      input?.maximumBaselineTotalBytes ?? DEFAULT_MAXIMUM_BASELINE_TOTAL_BYTES,
      1_000_000_000
    );
    const committedAt = canonicalTime(input?.committedAt);
    const researchAgent = campaignAgentIdentity(input?.researchAgent);
    const adaptiveTicks = campaignTickIds(token, "adaptive", tickCount);
    const staticTicks = campaignTickIds(token, "static", tickCount);
    const record: ResearchControlCampaignRecord = {
      record_kind: "research_control_campaign",
      version: 1,
      research_control_campaign_id: campaignId,
      idempotency_key: idempotencyKey,
      hypothesis:
        "adaptive_allocation_improves_prospective_qualified_discovery_yield",
      baseline: structuredClone(input.baseline),
      source: structuredClone(input.source),
      research_agent: researchAgent,
      paper_comparator: structuredClone(input.paperComparator),
      allocation_policy: { ...CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY },
      allocation_policy_digest: canonicalDigest(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      ),
      arms: [
        {
          arm_kind: "adaptive_treatment",
          allocation_mode: "adaptive_default",
          research_control_campaign_arm_intent_id:
            `research-control-campaign-arm-intent-${token}-adaptive`,
          tick_ids: adaptiveTicks
        },
        {
          arm_kind: "static_control",
          allocation_mode: "static_control",
          research_control_campaign_arm_intent_id:
            `research-control-campaign-arm-intent-${token}-static`,
          tick_ids: staticTicks
        }
      ],
      policy: {
        policy_version: "research_control_campaign_v1",
        tick_count_per_arm: tickCount,
        worker_slot_count_per_tick: 3,
        concurrency_limit_per_arm: 2,
        maximum_total_development_submissions_per_tick: 5,
        arm_execution_policy: "concurrent_per_sequence",
        maximum_baseline_regular_file_count: maximumFileCount,
        maximum_baseline_total_bytes: maximumBytes,
        paper_candidate_slot_count_per_arm: tickCount,
        paper_candidate_reservation_rule:
          "first_admitted_per_tick_in_allocation_order",
        primary_metric_kind:
          "prospective_qualified_candidate_discovery_rate",
        required_future_evidence:
          "confirmed_comparison_research_release"
      },
      committed_at: committedAt,
      campaign_digest: pendingDigest(),
      research_scheduling_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    record.campaign_digest = canonicalDigest(
      researchControlCampaignDigestInput(record)
    );
    if (!researchControlCampaignHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignDecisionError) throw error;
    throw invalidDecision();
  }
}

export function decideResearchControlCampaignArmIntent(input: {
  campaign: ResearchControlCampaignRecord;
  armKind: ResearchControlCampaignArmKind;
  committedAt: string;
}): ResearchControlCampaignArmIntentRecord {
  try {
    if (!researchControlCampaignHasRuntimeShape(input?.campaign)) {
      throw invalidDecision();
    }
    const arm = campaignArm(input.campaign, input.armKind);
    const committedAt = canonicalTime(input.committedAt);
    if (Date.parse(committedAt) < Date.parse(input.campaign.committed_at)) {
      throw invalidDecision();
    }
    const record: ResearchControlCampaignArmIntentRecord = {
      record_kind: "research_control_campaign_arm_intent",
      version: 1,
      research_control_campaign_arm_intent_id:
        arm.research_control_campaign_arm_intent_id,
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: input.campaign.research_control_campaign_id
      },
      campaign_digest: input.campaign.campaign_digest,
      arm_kind: arm.arm_kind,
      allocation_mode: arm.allocation_mode,
      baseline_snapshot_digest: input.campaign.baseline.snapshot_digest,
      tick_ids: [...arm.tick_ids],
      committed_at: committedAt,
      intent_digest: pendingDigest(),
      research_scheduling_authority: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    record.intent_digest = canonicalDigest(
      researchControlCampaignArmIntentDigestInput(record)
    );
    if (!researchControlCampaignArmIntentHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchControlCampaignDecisionError) throw error;
    throw invalidDecision();
  }
}

export function buildResearchControlCampaignReport(
  input: BuildResearchControlCampaignReportInput
): ResearchControlCampaignReportRecord {
  try {
    if (!researchControlCampaignHasRuntimeShape(input?.campaign) ||
      !Array.isArray(input.arms) || input.arms.length !== 2) {
      throw invalidDecision();
    }
    const completedAt = canonicalTime(input.completedAt);
    const arms: [ResearchControlCampaignArmReport, ResearchControlCampaignArmReport] = [
      buildArmReport(input.campaign, "adaptive_treatment", input.arms[0]),
      buildArmReport(input.campaign, "static_control", input.arms[1])
    ];
    if (arms.some((arm) =>
      Date.parse(arm.completed_at) > Date.parse(completedAt)
    )) {
      throw invalidDecision();
    }
    const report: ResearchControlCampaignReportRecord = {
      record_kind: "research_control_campaign_report",
      version: 1,
      research_control_campaign_report_id:
        researchControlCampaignReportId(input.campaign),
      campaign_ref: {
        record_kind: "research_control_campaign",
        id: input.campaign.research_control_campaign_id
      },
      campaign_digest: input.campaign.campaign_digest,
      arms,
      primary_outcome_status: "unadjudicated",
      causal_conclusion: "not_available_from_research_phase",
      next_action: "schedule_prospective_paper_slots",
      completed_at: completedAt,
      report_digest: pendingDigest(),
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    report.report_digest = canonicalDigest(
      researchControlCampaignReportDigestInput(report)
    );
    if (!researchControlCampaignReportHasRuntimeShape(report)) {
      throw invalidDecision();
    }
    return report;
  } catch (error) {
    if (error instanceof ResearchControlCampaignDecisionError) throw error;
    throw invalidDecision();
  }
}

function buildArmReport(
  campaign: ResearchControlCampaignRecord,
  armKind: ResearchControlCampaignArmKind,
  evidence: ResearchControlCampaignArmEvidenceInput
): ResearchControlCampaignArmReport {
  if (!evidence || !armIntentMatchesCampaign(evidence.intent, campaign, armKind) ||
    !researchPopulationDiversityHasRuntimeShape(evidence.populationDiversity)) {
    throw invalidDecision();
  }
  const arm = campaignArm(campaign, armKind);
  const ticksById = uniqueMap(evidence.ticks, (tick) => tick.tick_id);
  const allocationsByTick = uniqueMap(
    evidence.allocations,
    (allocation) => allocation.tick_id
  );
  if (ticksById.size !== arm.tick_ids.length ||
    allocationsByTick.size !== arm.tick_ids.length) {
    throw invalidDecision();
  }
  const ticks = arm.tick_ids.map((tickId) => required(ticksById.get(tickId)));
  const allocations = arm.tick_ids.map((tickId) =>
    required(allocationsByTick.get(tickId))
  );
  for (let index = 0; index < ticks.length; index += 1) {
    const tick = ticks[index]!;
    const allocation = allocations[index]!;
    if (!candidateArenaResearchAllocationHasRuntimeShape(allocation) ||
      allocation.allocation_mode !== arm.allocation_mode ||
      tick.research_allocation_ref?.record_kind !==
        "candidate_arena_research_allocation" ||
      tick.research_allocation_ref.id !==
        allocation.candidate_arena_research_allocation_id ||
      tick.research_allocation_digest !== allocation.allocation_digest ||
      tick.direction_results.length !== allocation.selected_directions.length ||
      tick.direction_results.some((result, directionIndex) =>
        result.direction_kind !==
          allocation.selected_directions[directionIndex]!.direction_kind
      ) || Date.parse(tick.started_at) < Date.parse(allocation.allocated_at) ||
      Date.parse(tick.completed_at) < Date.parse(tick.started_at)) {
      throw invalidDecision();
    }
  }

  const diversityTickIds = new Set(
    evidence.populationDiversity.tick_series.map((tick) => tick.tick_id)
  );
  if (diversityTickIds.size !== arm.tick_ids.length ||
    arm.tick_ids.some((tickId) => !diversityTickIds.has(tickId))) {
    throw invalidDecision();
  }

  const createdResults = ticks.flatMap((tick) => tick.direction_results
    .filter((result) => result.status === "created")
  );
  const closureByCandidate = uniqueMap(
    evidence.candidateClosures,
    (closure) => closure.candidate_id
  );
  const createdCandidateIds = createdResults.map((result) =>
    requiredString(result.candidate_id)
  );
  if (closureByCandidate.size !== createdCandidateIds.length ||
    new Set(createdCandidateIds).size !== createdCandidateIds.length) {
    throw invalidDecision();
  }
  for (const result of createdResults) {
    const closure = required(closureByCandidate.get(result.candidate_id!));
    if (closure.admission_decision_id !== result.admission_decision_id ||
      !sha256Digest(closure.system_code_artifact_digest) ||
      !canonicalStringOrUndefined(closure.candidate_version_id) ||
      !canonicalStringOrUndefined(closure.system_code_id)) {
      throw invalidDecision();
    }
  }

  const slots = ticks.map((tick, index) => paperCandidateSlot(
    tick,
    index + 1,
    closureByCandidate
  ));
  const diagnostics = armDiagnostics(ticks);
  const completedAt = canonicalTime(evidence.completedAt);
  if (ticks.some((tick) =>
    Date.parse(tick.completed_at) > Date.parse(completedAt)
  ) || Date.parse(completedAt) < Date.parse(evidence.intent.committed_at)) {
    throw invalidDecision();
  }
  return {
    arm_kind: arm.arm_kind,
    allocation_mode: arm.allocation_mode,
    arm_intent_ref: {
      record_kind: "research_control_campaign_arm_intent",
      id: evidence.intent.research_control_campaign_arm_intent_id
    },
    arm_intent_digest: evidence.intent.intent_digest,
    tick_refs: ticks.map((tick) => ({
      record_kind: "candidate_arena_tick",
      id: tick.candidate_arena_tick_id
    })),
    allocation_refs: allocations.map((allocation) => ({
      record_kind: "candidate_arena_research_allocation",
      id: allocation.candidate_arena_research_allocation_id
    })),
    diagnostics,
    population_diversity: structuredClone(evidence.populationDiversity),
    paper_candidate_slots: slots,
    final_store_snapshot_digest: evidence.finalStoreSnapshotDigest,
    completed_at: completedAt,
    research_diagnostics_authority: false,
    promotion_authority: false,
    authority_status: "not_promotion_authority"
  };
}

function armDiagnostics(ticks: CandidateArenaTickRecord[]) {
  const results = ticks.flatMap((tick) => tick.direction_results);
  const efficiency = results.flatMap((result) =>
    result.research_efficiency ? [result.research_efficiency] : []
  );
  return {
    attempt_count: results.length,
    admitted_candidate_count: countStatus(results, "created"),
    duplicate_count: countStatus(results, "duplicate"),
    quarantined_count: countStatus(results, "quarantined"),
    failed_count: countStatus(results, "failed"),
    provider_request_total: sum(efficiency, "provider_request_total"),
    runner_command_total: sum(efficiency, "runner_command_total"),
    scenario_count: sum(efficiency, "scenario_count"),
    elapsed_ms: sum(efficiency, "elapsed_ms")
  };
}

function paperCandidateSlot(
  tick: CandidateArenaTickRecord,
  sequence: number,
  closureByCandidate: Map<string, ResearchControlCampaignCandidateClosure>
): ResearchControlCampaignPaperCandidateSlot {
  const tickRef = {
    record_kind: "candidate_arena_tick",
    id: tick.candidate_arena_tick_id
  };
  const first = tick.direction_results.find((result) =>
    result.status === "created"
  );
  if (!first) {
    return { sequence, tick_ref: tickRef, status: "no_admitted_candidate" };
  }
  const closure = required(closureByCandidate.get(requiredString(first.candidate_id)));
  return {
    sequence,
    tick_ref: tickRef,
    status: "candidate_reserved",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: closure.candidate_id
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: closure.candidate_version_id
    },
    system_code_ref: {
      record_kind: "system_code",
      id: closure.system_code_id
    },
    system_code_artifact_digest: closure.system_code_artifact_digest,
    admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: closure.admission_decision_id
    }
  };
}

function armIntentMatchesCampaign(
  intent: ResearchControlCampaignArmIntentRecord,
  campaign: ResearchControlCampaignRecord,
  armKind: ResearchControlCampaignArmKind
): boolean {
  if (!researchControlCampaignArmIntentHasRuntimeShape(intent)) return false;
  const arm = campaign.arms.find((candidate) => candidate.arm_kind === armKind);
  return Boolean(arm) && intent.campaign_ref.id ===
      campaign.research_control_campaign_id &&
    intent.campaign_digest === campaign.campaign_digest &&
    intent.research_control_campaign_arm_intent_id ===
      arm!.research_control_campaign_arm_intent_id &&
    intent.arm_kind === arm!.arm_kind &&
    intent.allocation_mode === arm!.allocation_mode &&
    intent.baseline_snapshot_digest === campaign.baseline.snapshot_digest &&
    isDeepStrictEqual(intent.tick_ids, arm!.tick_ids) &&
    Date.parse(intent.committed_at) >= Date.parse(campaign.committed_at);
}

function campaignArm(
  campaign: ResearchControlCampaignRecord,
  armKind: ResearchControlCampaignArmKind
) {
  const arm = campaign.arms.find((candidate) => candidate.arm_kind === armKind);
  if (!arm) throw invalidDecision();
  return arm;
}

function campaignAgentIdentity(
  agent: ManagedResearchAgent
): ResearchControlCampaignAgentIdentity {
  if (!agent || !canonicalStringOrUndefined(agent.id) || ![
    "codex",
    "claude_code",
    "fixture"
  ].includes(agent.provider) ||
    (agent.provider === "fixture"
      ? agent.permission_policy !== "fixture_only"
      : agent.permission_policy !== "artifact_workspace_only") ||
    (agent.model !== undefined && !canonicalStringOrUndefined(agent.model))) {
    throw invalidDecision();
  }
  const identity = {
    provider: agent.provider,
    ...(agent.model ? { model: agent.model } : {}),
    permission_policy: agent.permission_policy
  };
  return {
    ...identity,
    identity_digest: canonicalDigest(identity)
  };
}

function campaignTickIds(
  token: string,
  arm: "adaptive" | "static",
  count: number
): string[] {
  return Array.from({ length: count }, (_, index) =>
    `research-control-${token}-${arm}-${index + 1}`
  );
}

function researchControlCampaignId(idempotencyKey: string): string {
  const canonical = canonicalString(idempotencyKey);
  return `research-control-campaign-${safeId(canonical, { maxLength: 48 })}-${
    digestHex(canonical).slice(0, 12)
  }`;
}

function researchControlCampaignReportId(
  campaign: ResearchControlCampaignRecord
): string {
  return `research-control-campaign-report-${digestHex(
    campaign.research_control_campaign_id
  ).slice(0, 20)}`;
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

function canonicalStringOrUndefined(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.trim() === value;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function positiveBoundedInteger(value: unknown, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw invalidDecision();
  }
  return Number(value);
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function uniqueMap<T>(items: T[], key: (item: T) => string): Map<string, T> {
  if (!Array.isArray(items)) throw invalidDecision();
  const result = new Map<string, T>();
  for (const item of items) {
    const id = canonicalString(key(item));
    if (result.has(id)) throw invalidDecision();
    result.set(id, item);
  }
  return result;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw invalidDecision();
  return value;
}

function requiredString(value: string | undefined): string {
  if (!canonicalStringOrUndefined(value)) throw invalidDecision();
  return value;
}

function countStatus(
  results: CandidateArenaTickDirectionResultReadModel[],
  status: CandidateArenaTickDirectionResultReadModel["status"]
): number {
  return results.filter((result) => result.status === status).length;
}

function sum<T extends Record<K, number>, K extends keyof T>(
  values: T[],
  key: K
): number {
  return values.reduce((total, value) => total + value[key], 0);
}

function invalidDecision(): ResearchControlCampaignDecisionError {
  return new ResearchControlCampaignDecisionError();
}
