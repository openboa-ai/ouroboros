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
  type ResearchControlStudyRecord,
  type TradingPromotionRecord
} from "@ouroboros/domain";
import type { ResearchControlCampaignPaperEvaluationProtocolInput } from
  "@ouroboros/application/candidate/research-control-campaign";
import { researchControlStudyId } from
  "@ouroboros/application/candidate/research-control-study";
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
  policy_version: "research-control-study-commitment-v1" as const,
  trigger: "latest_trading_promotion" as const,
  maximum_incomplete_study_count: 1 as const,
  replication_count: 6 as const,
  tick_count_per_arm: 1 as const,
  maximum_baseline_regular_file_count: 10_000,
  maximum_baseline_total_bytes: 1_000_000_000
});

export type ResearchControlStudyCommitmentResult =
  | {
      status: "committed" | "existing";
      studyId: string;
    }
  | {
      status: "deferred";
      reason: "no_trading_promotion" | "pending_study_exists";
      pendingStudyId?: string;
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
      const [studies, outcomes, promotion] = await Promise.all([
        this.options.store.listResearchControlStudies(),
        this.options.store.listResearchControlStudyOutcomes(),
        this.options.store.getLatestTradingPromotion()
      ]);
      if (!promotion) {
        return { status: "deferred", reason: "no_trading_promotion" };
      }
      const [campaign, agent] = await Promise.all([
        this.loadPromotionCampaign(promotion),
        this.options.researchAgentIdentity()
      ]);
      const intent = commitmentIntent(promotion, campaign, agent);
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
      ...(this.options.now ? { now: this.options.now } : {}),
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
      )) {
      throw commitmentFailed(
        "ResearchControlStudy automatic intent conflicts with persisted evidence."
      );
    }
  }
}

function commitmentIntent(
  promotion: TradingPromotionRecord,
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  agent: ManagedResearchAgent
): ResearchControlStudyCommitmentIntent {
  const agentIdentity = exactAgentIdentity(agent);
  const paperEvaluationProtocolInput = boundProtocolInput(campaign);
  const paperEvaluationProtocol = sealProtocol(paperEvaluationProtocolInput);
  const promotionDigest = exactDigest(
    paperTradingComparisonTradingPromotionDigestInput(promotion)
  );
  const campaignPolicy = exactCampaignPolicy();
  const intentDigest = exactDigest({
    commitment_policy: RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY,
    promotion: {
      id: promotion.trading_promotion_id,
      digest: promotionDigest
    },
    confirmation_campaign: {
      id: campaign.paper_trading_comparison_confirmation_campaign_id,
      digest: campaign.campaign_digest
    },
    source: {
      candidate_ref: promotion.candidate_ref,
      candidate_version_ref: promotion.candidate_version_ref
    },
    research_agent: agentIdentity,
    paper_evaluation_protocol: paperEvaluationProtocolInput,
    campaign_policy: campaignPolicy
  }).slice("sha256:".length);
  const studyIdempotencyKey = `automatic-study-${intentDigest}`;
  const replicationIdempotencyKeys = Array.from(
    { length: RESEARCH_CONTROL_STUDY_COMMITMENT_POLICY.replication_count },
    (_, index) => `${studyIdempotencyKey}-replication-${index + 1}`
  );
  return {
    studyIdempotencyKey,
    studyId: researchControlStudyId(studyIdempotencyKey),
    replicationIdempotencyKeys,
    promotion,
    promotionDigest,
    campaign,
    agent,
    agentIdentity,
    paperEvaluationProtocolInput,
    paperEvaluationProtocol,
    campaignPolicy
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
