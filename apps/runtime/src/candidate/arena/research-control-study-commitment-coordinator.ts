import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlStudyHasRuntimeShape,
  type PaperTradingComparisonConfirmationCampaignRecord,
  type ResearchControlCampaignAgentIdentity,
  type ResearchControlCampaignPaperEvaluationProtocol,
  type ResearchControlCampaignPolicy,
  type ResearchGeneralizationMarketCondition,
  type ResearchGeneralizationProtocolRecord,
  type ResearchGeneralizationProtocolStudySlot,
  type ResearchControlStudyRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import type { ResearchControlCampaignPaperEvaluationProtocolInput } from
  "@ouroboros/application/candidate/research-control-campaign";
import {
  ResearchGeneralizationProtocolService,
  researchGeneralizationProtocolId,
  type ResearchGeneralizationProtocolCommitRequest
} from "@ouroboros/application/candidate/research-generalization-protocol";
import { decideResearchGeneralizationMarketCondition } from
  "@ouroboros/application/candidate/research-generalization-market-condition";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import type { ManagedResearchAgent } from
  "@ouroboros/application/trading/research/types";
import { LocalStore } from "@ouroboros/local-store";
import {
  commitResearchControlStudyRuntime,
  type CommitResearchControlStudyRuntimeInput
} from "./research-control-study-runtime";
import { discoverResearchControlStudyProcessQueue } from
  "./research-control-study-process-discovery";

export const RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY = Object.freeze({
  policy_version: "research-control-study-commitment-v2" as const,
  trigger: "research_generalization_protocol_slot" as const,
  maximum_incomplete_study_count: 1 as const,
  replication_count: 6 as const,
  tick_count_per_arm: 1 as const,
  maximum_baseline_regular_file_count: 10_000,
  maximum_baseline_total_bytes: 1_000_000_000
});

export type ResearchControlStudyCommitmentResult =
  | {
      status: "protocol_committed";
      protocolId: string;
    }
  | {
      status: "committed" | "existing";
      studyId: string;
    }
  | {
      status: "deferred";
      reason:
        | "no_trading_promotion"
        | "pending_study_exists"
        | "market_condition_unavailable"
        | "study_spacing_not_elapsed"
        | "condition_block_full"
        | "source_baseline_reused"
        | "protocol_expired"
        | "active_protocol_conflict";
      pendingStudyId?: string;
      protocolId?: string;
      conditionBlock?: "long" | "short" | "flat";
      nextEligibleAt?: string;
    };

export interface ResearchControlStudyCommitmentCoordinatorLifecycle {
  ensureCommittedStudy(): Promise<ResearchControlStudyCommitmentResult>;
}

export class ResearchControlStudyCommitmentCoordinatorError extends Error {
  readonly code = "research_control_study_commitment_failed";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResearchControlStudyCommitmentCoordinatorError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface ResearchControlStudyCommitmentIntent {
  studyIdempotencyKey: string;
  studyId: string;
  replicationIdempotencyKeys: string[];
  promotion: TradingPromotionRecord;
  promotionDigest: string;
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  agent: ManagedResearchAgent;
  agentIdentity: ResearchControlCampaignAgentIdentity;
  paperEvaluationProtocolInput:
    ResearchControlCampaignPaperEvaluationProtocolInput;
  paperEvaluationProtocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  >;
  campaignPolicy: ResearchControlCampaignPolicy;
  protocol: ResearchGeneralizationProtocolRecord;
  slot: ResearchGeneralizationProtocolStudySlot;
  marketCondition: ResearchGeneralizationMarketCondition;
  committedAt: string;
}

interface ResearchGeneralizationProtocolIntent {
  protocolId: string;
  request: ResearchGeneralizationProtocolCommitRequest;
}

export class ResearchControlStudyCommitmentCoordinator
implements ResearchControlStudyCommitmentCoordinatorLifecycle {
  private readonly commitStudy: (
    input: CommitResearchControlStudyRuntimeInput
  ) => Promise<ResearchControlStudyRecord>;

  constructor(private readonly options: {
    store: LocalStore;
    researchAgentIdentity:
      () => ManagedResearchAgent | Promise<ManagedResearchAgent>;
    marketData?: GatewayMarketDataPort;
    now?: () => string;
    repoRoot?: string;
    commitStudy?: (
      input: CommitResearchControlStudyRuntimeInput
    ) => Promise<ResearchControlStudyRecord>;
  }) {
    this.commitStudy = options.commitStudy ?? commitResearchControlStudyRuntime;
  }

  async ensureCommittedStudy(): Promise<ResearchControlStudyCommitmentResult> {
    try {
      const committedAt = exactTime(
        (this.options.now ?? (() => new Date().toISOString()))()
      );
      const [studies, outcomes, promotion, protocols] = await Promise.all([
        this.options.store.listResearchControlStudies(),
        this.options.store.listResearchControlStudyOutcomes(),
        this.options.store.getLatestTradingPromotion(),
        this.options.store.listResearchGeneralizationProtocols()
      ]);
      if (!promotion) {
        return { status: "deferred", reason: "no_trading_promotion" };
      }
      const pending = discoverResearchControlStudyProcessQueue({
        studies,
        outcomes
      })[0];
      if (pending) {
        return {
          status: "deferred",
          reason: "pending_study_exists",
          pendingStudyId: pending.research_control_study_id
        };
      }
      const [campaign, agent] = await Promise.all([
        this.loadPromotionCampaign(promotion),
        this.options.researchAgentIdentity()
      ]);
      const protocolIntent = generalizationProtocolIntent(campaign, agent);
      let protocol = protocols.find((candidate) =>
        candidate.research_generalization_protocol_id ===
          protocolIntent.protocolId
      );
      if (!protocol) {
        const active = protocols.find((candidate) =>
          Date.parse(candidate.timing_policy.collection_deadline_at) >=
            Date.parse(committedAt)
        );
        if (active) {
          return {
            status: "deferred",
            reason: "active_protocol_conflict",
            protocolId: active.research_generalization_protocol_id
          };
        }
        protocol = await new ResearchGeneralizationProtocolService({
          store: this.options.store,
          now: () => committedAt
        }).commit(protocolIntent.request);
        return {
          status: "protocol_committed",
          protocolId: protocol.research_generalization_protocol_id
        };
      }
      protocol = await new ResearchGeneralizationProtocolService({
        store: this.options.store,
        now: () => committedAt
      }).commit(protocolIntent.request);
      if (Date.parse(committedAt) >
        Date.parse(protocol.timing_policy.collection_deadline_at)) {
        return {
          status: "deferred",
          reason: "protocol_expired",
          protocolId: protocol.research_generalization_protocol_id
        };
      }
      const protocolStudies = studies.filter((study) =>
        study.generalization_assignment?.protocol_ref.id ===
          protocol.research_generalization_protocol_id
      ).sort((left, right) =>
        left.committed_at.localeCompare(right.committed_at) ||
        left.research_control_study_id.localeCompare(
          right.research_control_study_id
        )
      );
      const latestStudy = protocolStudies.at(-1);
      if (latestStudy) {
        const nextEligibleEpoch = Date.parse(latestStudy.committed_at) +
          protocol.timing_policy.minimum_study_commitment_interval_ms;
        if (Date.parse(committedAt) < nextEligibleEpoch) {
          return {
            status: "deferred",
            reason: "study_spacing_not_elapsed",
            protocolId: protocol.research_generalization_protocol_id,
            nextEligibleAt: new Date(nextEligibleEpoch).toISOString()
          };
        }
      }
      if (!this.options.marketData?.readPublicKlineWindow) {
        return { status: "deferred", reason: "market_condition_unavailable" };
      }
      let marketCondition: ResearchGeneralizationMarketCondition;
      try {
        const publicKlineWindow = await this.options.marketData
          .readPublicKlineWindow({
            symbol: "BTCUSDT",
            interval: "1m",
            limit: 30,
            observedAt: committedAt
          });
        marketCondition = decideResearchGeneralizationMarketCondition({
          publicKlineWindow,
          classifiedAt: committedAt
        });
      } catch {
        return { status: "deferred", reason: "market_condition_unavailable" };
      }
      const occupiedStudyIds = new Set(studies.map((study) =>
        study.research_control_study_id
      ));
      const slot = protocol.study_slots.find((candidate) =>
        candidate.condition_block === marketCondition.condition_block &&
        !occupiedStudyIds.has(candidate.study_ref.id)
      );
      if (!slot) {
        return {
          status: "deferred",
          reason: "condition_block_full",
          protocolId: protocol.research_generalization_protocol_id,
          conditionBlock: marketCondition.condition_block
        };
      }
      if (protocolStudies.some((study) =>
        study.generalization_assignment?.condition_block ===
          marketCondition.condition_block &&
        study.generalization_assignment
          .source_system_code_artifact_digest ===
            campaign.challenger.system_code_artifact_digest
      )) {
        return {
          status: "deferred",
          reason: "source_baseline_reused",
          protocolId: protocol.research_generalization_protocol_id,
          conditionBlock: marketCondition.condition_block
        };
      }
      const intent = commitmentIntent({
        promotion,
        campaign,
        agent,
        protocol,
        slot,
        marketCondition,
        committedAt
      });
      const existing = studies.find((study) =>
        study.research_control_study_id === intent.studyId
      );
      if (existing) {
        this.assertExactIntent(existing, intent);
        return {
          status: "existing",
          studyId: existing.research_control_study_id
        };
      }
      return await this.commitOrReload(intent);
    } catch (error) {
      if (error instanceof ResearchControlStudyCommitmentCoordinatorError) {
        throw error;
      }
      throw commitmentFailed(
        "ResearchControlStudy automatic commitment failed closed.",
        error
      );
    }
  }

  private async loadPromotionCampaign(
    promotion: TradingPromotionRecord
  ): Promise<PaperTradingComparisonConfirmationCampaignRecord> {
    const basis = promotion.comparison_confirmation;
    const campaign = await this.options.store
      .getPaperTradingComparisonConfirmationCampaign(basis.campaign_ref.id);
    if (!campaign || campaign
      .paper_trading_comparison_confirmation_campaign_id !==
        basis.campaign_ref.id || campaign.campaign_digest !==
        basis.campaign_digest || !sameRef(
          campaign.challenger.candidate_ref,
          promotion.candidate_ref
        ) || !sameRef(
          campaign.challenger.candidate_version_ref,
          promotion.candidate_version_ref
        )) {
      throw commitmentFailed(
        "TradingPromotion confirmation campaign is absent or mismatched."
      );
    }
    return campaign;
  }

  private async commitOrReload(
    intent: ResearchControlStudyCommitmentIntent
  ): Promise<ResearchControlStudyCommitmentResult> {
    const input: CommitResearchControlStudyRuntimeInput = {
      store: this.options.store,
      studyIdempotencyKey: intent.studyIdempotencyKey,
      replicationIdempotencyKeys: [...intent.replicationIdempotencyKeys],
      sourceCandidateId: intent.promotion.candidate_ref.id,
      expectedTradingPromotionId: intent.promotion.trading_promotion_id,
      researchAgentIdentity: { ...intent.agent },
      tickCountPerArm:
        RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY.tick_count_per_arm,
      maximumBaselineRegularFileCount:
        RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY
          .maximum_baseline_regular_file_count,
      maximumBaselineTotalBytes:
        RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY
          .maximum_baseline_total_bytes,
      paperEvaluationProtocol: structuredClone(
        intent.paperEvaluationProtocolInput
      ),
      generalizationAssignment: {
        protocol_ref: {
          record_kind: "research_generalization_protocol",
          id: intent.protocol.research_generalization_protocol_id
        },
        protocol_digest: intent.protocol.protocol_digest,
        slot_index: intent.slot.slot_index,
        condition_block: intent.slot.condition_block,
        condition_block_study_index:
          intent.slot.condition_block_study_index,
        market_condition: structuredClone(intent.marketCondition),
        source_system_code_artifact_digest:
          intent.campaign.challenger.system_code_artifact_digest
      },
      now: () => intent.committedAt,
      ...(this.options.repoRoot ? { repoRoot: this.options.repoRoot } : {})
    };
    try {
      const study = await this.commitStudy(input);
      this.assertExactIntent(study, intent);
      return {
        status: "committed",
        studyId: study.research_control_study_id
      };
    } catch (error) {
      const winner = await this.options.store.getResearchControlStudy(
        intent.studyId
      );
      if (winner) {
        this.assertExactIntent(winner, intent);
        return {
          status: "existing",
          studyId: winner.research_control_study_id
        };
      }
      throw commitmentFailed(
        "ResearchControlStudy automatic commitment was not published.",
        error
      );
    }
  }

  private assertExactIntent(
    study: ResearchControlStudyRecord,
    intent: ResearchControlStudyCommitmentIntent
  ): void {
    const condition = study?.condition;
    const comparator = condition?.paper_comparator;
    const source = condition?.source;
    const assignment = study?.generalization_assignment;
    if (!researchControlStudyHasRuntimeShape(study) ||
      study.idempotency_key !== intent.studyIdempotencyKey ||
      study.research_control_study_id !== intent.studyId ||
      !source || !sameRef(
        source.candidate_ref,
        intent.promotion.candidate_ref
      ) || !sameRef(
        source.candidate_version_ref,
        intent.promotion.candidate_version_ref
      ) || !sameRef(
        source.system_code_ref,
        intent.campaign.challenger.system_code_ref
      ) || source.system_code_record_digest !==
        intent.campaign.challenger.system_code_record_digest ||
      source.system_code_artifact_digest !==
        intent.campaign.challenger.system_code_artifact_digest ||
      comparator?.comparator_status !== "trading_review" ||
      comparator.trading_promotion_ref.id !==
        intent.promotion.trading_promotion_id ||
      comparator.trading_promotion_digest !== intent.promotionDigest ||
      !sameRef(comparator.candidate_ref, intent.promotion.candidate_ref) ||
      !sameRef(
        comparator.candidate_version_ref,
        intent.promotion.candidate_version_ref
      ) || !sameRef(
        comparator.paper_trading_evaluation_ref,
        intent.promotion.paper_trading_evaluation_ref
      ) || !isDeepStrictEqual(
        condition.research_agent,
        intent.agentIdentity
      ) || !isDeepStrictEqual(
        condition.paper_evaluation_protocol,
        intent.paperEvaluationProtocol
      ) || !isDeepStrictEqual(
        condition.campaign_policy,
        intent.campaignPolicy
      ) || !isDeepStrictEqual(
        condition.allocation_policy,
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      ) || condition.allocation_policy_digest !== exactDigest(
        CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
      ) || !isDeepStrictEqual(
        study.replications.map((replication) =>
          replication.campaign_idempotency_key
        ),
        intent.replicationIdempotencyKeys
      ) || !assignment ||
      assignment.protocol_ref.id !==
        intent.protocol.research_generalization_protocol_id ||
      assignment.protocol_digest !== intent.protocol.protocol_digest ||
      assignment.slot_index !== intent.slot.slot_index ||
      assignment.condition_block !== intent.slot.condition_block ||
      assignment.condition_block_study_index !==
        intent.slot.condition_block_study_index ||
      assignment.source_system_code_artifact_digest !==
        intent.campaign.challenger.system_code_artifact_digest ||
      assignment.assigned_at !== intent.committedAt ||
      !isDeepStrictEqual(
        assignment.market_condition,
        intent.marketCondition
      )) {
      throw commitmentFailed(
        "ResearchControlStudy automatic intent conflicts with persisted evidence."
      );
    }
  }
}

function generalizationProtocolIntent(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  agent: ManagedResearchAgent
): ResearchGeneralizationProtocolIntent {
  const agentIdentity = exactAgentIdentity(agent);
  const paperEvaluationProtocol = boundProtocolInput(campaign);
  const campaignPolicy = exactCampaignPolicy();
  const intentDigest = exactDigest({
    commitment_policy: RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY,
    target_allocation_policy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    research_agent: agentIdentity,
    paper_evaluation_protocol: paperEvaluationProtocol,
    campaign_policy: campaignPolicy
  }).slice("sha256:".length);
  const idempotencyKey = `automatic-generalization-${intentDigest}`;
  const {
    identity_digest: _identityDigest,
    ...researchAgent
  } = agentIdentity;
  const request: ResearchGeneralizationProtocolCommitRequest = {
    idempotencyKey,
    targetAllocationPolicy: CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
    researchAgent,
    paperEvaluationProtocol,
    campaignPolicy
  };
  return {
    protocolId: researchGeneralizationProtocolId(idempotencyKey),
    request
  };
}

function commitmentIntent(input: {
  promotion: TradingPromotionRecord;
  campaign: PaperTradingComparisonConfirmationCampaignRecord;
  agent: ManagedResearchAgent;
  protocol: ResearchGeneralizationProtocolRecord;
  slot: ResearchGeneralizationProtocolStudySlot;
  marketCondition: ResearchGeneralizationMarketCondition;
  committedAt: string;
}): ResearchControlStudyCommitmentIntent {
  const agentIdentity = exactAgentIdentity(input.agent);
  const paperEvaluationProtocolInput = boundProtocolInput(input.campaign);
  const paperEvaluationProtocol = sealProtocol(paperEvaluationProtocolInput);
  return {
    studyIdempotencyKey: input.slot.study_idempotency_key,
    studyId: input.slot.study_ref.id,
    replicationIdempotencyKeys: [
      ...input.slot.replication_idempotency_keys
    ],
    promotion: input.promotion,
    promotionDigest: exactDigest(
      paperTradingComparisonTradingPromotionDigestInput(input.promotion)
    ),
    campaign: input.campaign,
    agent: input.agent,
    agentIdentity,
    paperEvaluationProtocolInput,
    paperEvaluationProtocol,
    campaignPolicy: exactCampaignPolicy(),
    protocol: input.protocol,
    slot: input.slot,
    marketCondition: input.marketCondition,
    committedAt: input.committedAt
  };
}

function boundProtocolInput(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): ResearchControlCampaignPaperEvaluationProtocolInput {
  return {
    protocol_status: "bound",
    comparison_policy: {
      ...structuredClone(campaign.comparison_policy),
      comparison_mode: "champion_challenge"
    },
    market_data_configuration_digest:
      campaign.market_data_configuration_digest,
    paper_policy_identity: structuredClone(campaign.paper_policy_identity),
    schedule_policy: {
      policy_version: "research-control-paper-schedule-v1",
      source_start_order: "paired_by_sequence",
      maximum_active_source_pairs: 2,
      maximum_cross_arm_first_tick_skew_ms:
        campaign.comparison_policy.maximum_start_skew_ms,
      source_missed_start_policy: "slot_expired",
      confirmation_precommit_deadline_ms:
        campaign.comparison_policy.maximum_elapsed_ms
    }
  };
}

function sealProtocol(
  input: ResearchControlCampaignPaperEvaluationProtocolInput
): Extract<
  ResearchControlCampaignPaperEvaluationProtocol,
  { protocol_status: "bound" }
> {
  if (input.protocol_status !== "bound") {
    throw commitmentFailed("ResearchControlStudy paper protocol is unbound.");
  }
  const protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  > = {
    ...structuredClone(input),
    protocol_digest: `sha256:${"0".repeat(64)}`
  };
  protocol.protocol_digest = exactDigest(
    researchControlCampaignPaperEvaluationProtocolDigestInput(protocol)
  );
  return protocol;
}

function exactAgentIdentity(
  agent: ManagedResearchAgent
): ResearchControlCampaignAgentIdentity {
  if (!agent || !canonicalString(agent.id) || ![
    "codex",
    "claude_code",
    "fixture"
  ].includes(agent.provider) ||
    (agent.provider === "fixture"
      ? agent.permission_policy !== "fixture_only"
      : agent.permission_policy !== "artifact_workspace_only") ||
    (agent.model !== undefined && !canonicalString(agent.model))) {
    throw commitmentFailed(
      "ResearchControlStudy managed research-agent identity is invalid."
    );
  }
  const identity = {
    provider: agent.provider,
    ...(agent.model ? { model: agent.model } : {}),
    permission_policy: agent.permission_policy
  };
  return {
    ...identity,
    identity_digest: exactDigest(identity)
  };
}

function exactCampaignPolicy(): ResearchControlCampaignPolicy {
  return {
    policy_version: "research_control_campaign_v1",
    tick_count_per_arm:
      RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY.tick_count_per_arm,
    worker_slot_count_per_tick: 3,
    concurrency_limit_per_arm: 2,
    maximum_total_development_submissions_per_tick: 5,
    arm_execution_policy: "concurrent_per_sequence",
    maximum_baseline_regular_file_count:
      RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY
        .maximum_baseline_regular_file_count,
    maximum_baseline_total_bytes:
      RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY.maximum_baseline_total_bytes,
    paper_candidate_slot_count_per_arm:
      RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY.tick_count_per_arm,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order",
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate",
    required_future_evidence:
      "confirmed_comparison_research_release"
  };
}

function sameRef(
  left: { record_kind: string; id: string },
  right: { record_kind: string; id: string }
): boolean {
  return left.record_kind === right.record_kind && left.id === right.id;
}

function canonicalString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value) && value.trim() === value;
}

function exactTime(value: unknown): string {
  if (!canonicalString(value)) {
    throw commitmentFailed("ResearchControlStudy commitment clock is invalid.");
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    throw commitmentFailed("ResearchControlStudy commitment clock is invalid.");
  }
  return value;
}

function exactDigest(value: unknown): string {
  const canonical = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function commitmentFailed(
  message: string,
  cause?: unknown
): ResearchControlStudyCommitmentCoordinatorError {
  return new ResearchControlStudyCommitmentCoordinatorError(
    message,
    cause === undefined ? undefined : { cause }
  );
}
