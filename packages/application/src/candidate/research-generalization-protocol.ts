import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY,
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchGeneralizationProtocolDigestInput,
  researchGeneralizationProtocolHasRuntimeShape,
  type CandidateArenaResearchAllocationPolicy,
  type ResearchExperimentAgentIdentity,
  type ResearchControlCampaignPaperEvaluationProtocol,
  type ResearchControlCampaignPolicy,
  type ResearchGeneralizationMarketConditionBlock,
  type ResearchGeneralizationProtocolRecord,
  type ResearchGeneralizationProtocolStudySlot
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import type {
  ResearchControlCampaignPaperEvaluationProtocolInput
} from "./research-control-campaign";
import { researchControlStudyId } from "./research-control-study";
import { RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY } from
  "./research-generalization-market-condition";

export type ResearchGeneralizationProtocolResearchAgentInput = Omit<
  ResearchExperimentAgentIdentity,
  "identity_digest"
>;

export interface DecideResearchGeneralizationProtocolInput {
  idempotencyKey: string;
  targetAllocationPolicy: CandidateArenaResearchAllocationPolicy;
  researchAgent: ResearchGeneralizationProtocolResearchAgentInput;
  paperEvaluationProtocol:
    ResearchControlCampaignPaperEvaluationProtocolInput;
  campaignPolicy: ResearchControlCampaignPolicy;
  committedAt: string;
}

export type ResearchGeneralizationProtocolCommitRequest = Omit<
  DecideResearchGeneralizationProtocolInput,
  "committedAt"
>;

export class ResearchGeneralizationProtocolDecisionError extends Error {
  readonly code = "invalid_research_generalization_protocol_input";

  constructor() {
    super("ResearchGeneralizationProtocol decision input is invalid.");
    this.name = "ResearchGeneralizationProtocolDecisionError";
  }
}

export type ResearchGeneralizationProtocolServiceErrorCode =
  | "research_generalization_protocol_conflict"
  | "research_generalization_protocol_persistence_conflict";

export class ResearchGeneralizationProtocolServiceError extends Error {
  constructor(
    readonly code: ResearchGeneralizationProtocolServiceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchGeneralizationProtocolServiceError";
  }
}

export class ResearchGeneralizationProtocolService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async commit(
    input: ResearchGeneralizationProtocolCommitRequest
  ): Promise<ResearchGeneralizationProtocolRecord> {
    const protocolId = researchGeneralizationProtocolId(input.idempotencyKey);
    const existing = await this.options.store
      .getResearchGeneralizationProtocol(protocolId);
    if (existing) {
      const requested = decideResearchGeneralizationProtocol({
        ...input,
        committedAt: existing.committed_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchGeneralizationProtocolServiceError(
          "research_generalization_protocol_conflict",
          "ResearchGeneralizationProtocol conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const protocol = decideResearchGeneralizationProtocol({
      ...input,
      committedAt: this.now()
    });
    let recorded: ResearchGeneralizationProtocolRecord;
    try {
      recorded = await this.options.store
        .recordResearchGeneralizationProtocol(protocol);
    } catch (error) {
      const winner = await this.options.store
        .getResearchGeneralizationProtocol(protocolId);
      if (winner && isDeepStrictEqual(winner, protocol)) return winner;
      throw new ResearchGeneralizationProtocolServiceError(
        "research_generalization_protocol_persistence_conflict",
        "ResearchGeneralizationProtocol was not published exactly.",
        { cause: error }
      );
    }
    if (!researchGeneralizationProtocolHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, protocol)) {
      throw new ResearchGeneralizationProtocolServiceError(
        "research_generalization_protocol_persistence_conflict",
        "Store did not preserve exact ResearchGeneralizationProtocol evidence."
      );
    }
    return recorded;
  }
}

export function decideResearchGeneralizationProtocol(
  input: DecideResearchGeneralizationProtocolInput
): ResearchGeneralizationProtocolRecord {
  try {
    const idempotencyKey = canonicalString(input?.idempotencyKey);
    const committedAt = canonicalTime(input?.committedAt);
    if (!isDeepStrictEqual(
      input?.targetAllocationPolicy,
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
    )) {
      throw invalidDecision();
    }
    const targetAllocationPolicy = structuredClone(
      CANDIDATE_ARENA_RESEARCH_ALLOCATION_POLICY
    );
    const researchAgent = canonicalResearchAgent(input?.researchAgent);
    const paperEvaluationProtocol = sealPaperEvaluationProtocol(
      input?.paperEvaluationProtocol
    );
    const campaignPolicy = canonicalCampaignPolicy(input?.campaignPolicy);
    const deadlineEpoch = Date.parse(committedAt) + 7_776_000_000;
    const collectionDeadlineAt = new Date(deadlineEpoch).toISOString();
    const conditionBlocks = [
      { condition_block: "long" as const, required_study_count: 2 as const },
      { condition_block: "short" as const, required_study_count: 2 as const },
      { condition_block: "flat" as const, required_study_count: 2 as const }
    ] as const;
    const studySlots = conditionBlocks.flatMap((block) =>
      [1, 2].map((blockStudyIndex) => protocolStudySlot({
        protocolIdempotencyKey: idempotencyKey,
        conditionBlock: block.condition_block,
        conditionBlockStudyIndex: blockStudyIndex
      }))
    ).map((slot, index) => ({ ...slot, slot_index: index + 1 }));
    const record: ResearchGeneralizationProtocolRecord = {
      record_kind: "research_generalization_protocol",
      version: 1,
      research_generalization_protocol_id:
        researchGeneralizationProtocolId(idempotencyKey),
      idempotency_key: idempotencyKey,
      hypothesis:
        "adaptive_allocation_effect_generalizes_across_baselines_and_market_conditions",
      target_allocation_policy: targetAllocationPolicy,
      target_allocation_policy_digest: canonicalDigest(targetAllocationPolicy),
      research_agent: researchAgent,
      paper_evaluation_protocol: paperEvaluationProtocol,
      campaign_policy: campaignPolicy,
      market_classifier_policy: {
        ...RESEARCH_GENERALIZATION_MARKET_CLASSIFIER_POLICY
      },
      condition_blocks: conditionBlocks.map((block) => ({ ...block })) as
        ResearchGeneralizationProtocolRecord["condition_blocks"],
      study_slots: studySlots,
      timing_policy: {
        policy_version: "research_generalization_timing_v1",
        minimum_study_commitment_interval_ms: 86_400_000,
        maximum_collection_duration_ms: 7_776_000_000,
        collection_deadline_at: collectionDeadlineAt,
        expiry_policy: "close_with_missing_slots"
      },
      study_policy: {
        policy_version: "research_generalization_study_v1",
        replication_count_per_study: 6,
        tick_count_per_arm: 1,
        maximum_baseline_regular_file_count: 10_000,
        maximum_baseline_total_bytes: 1_000_000_000,
        source_baseline_reuse_policy: "unique_within_condition_block"
      },
      analysis_policy: {
        policy_version: "equal_block_exact_sign_test_v1",
        primary_estimand:
          "equal_block_mean_adaptive_minus_static_qualified_discovery_rate",
        block_weighting: "equal_precommitted_condition_blocks",
        significance_method: "two_sided_exact_sign_test",
        alpha: 0.05,
        minimum_terminal_study_count: 6,
        minimum_non_tied_study_count: 6,
        minimum_distinct_baseline_count: 3,
        tie_policy: "exclude_from_sign_test_include_in_mean",
        missing_block_policy: "insufficient_generalization_evidence",
        harmful_block_policy: "non_positive_block_blocks_support"
      },
      committed_at: committedAt,
      protocol_digest: pendingDigest(),
      research_scheduling_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    record.protocol_digest = canonicalDigest(
      researchGeneralizationProtocolDigestInput(record)
    );
    if (!researchGeneralizationProtocolHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchGeneralizationProtocolDecisionError) {
      throw error;
    }
    throw invalidDecision();
  }
}

export function researchGeneralizationProtocolId(
  idempotencyKey: string
): string {
  const canonical = canonicalString(idempotencyKey);
  return `research-generalization-protocol-${
    safeId(canonical, { maxLength: 48 })
  }-${digestHex(canonical).slice(0, 12)}`;
}

function protocolStudySlot(input: {
  protocolIdempotencyKey: string;
  conditionBlock: ResearchGeneralizationMarketConditionBlock;
  conditionBlockStudyIndex: number;
}): Omit<ResearchGeneralizationProtocolStudySlot, "slot_index"> {
  const studyKey = `${input.protocolIdempotencyKey}:${input.conditionBlock}:${
    input.conditionBlockStudyIndex
  }`;
  return {
    condition_block: input.conditionBlock,
    condition_block_study_index: input.conditionBlockStudyIndex,
    study_idempotency_key: studyKey,
    study_ref: {
      record_kind: "research_control_study",
      id: researchControlStudyId(studyKey)
    },
    replication_idempotency_keys: Array.from(
      { length: 6 },
      (_, index) => `${studyKey}:replication:${index + 1}`
    )
  };
}

function canonicalResearchAgent(
  value: ResearchGeneralizationProtocolResearchAgentInput
): ResearchExperimentAgentIdentity {
  if (!value || !["codex", "claude_code", "fixture"].includes(
    String(value.provider)
  ) || (value.provider === "fixture"
    ? value.permission_policy !== "fixture_only"
    : value.permission_policy !== "artifact_workspace_only") ||
    (value.model !== undefined && !canonicalString(value.model))) {
    throw invalidDecision();
  }
  const identity = {
    provider: value.provider,
    ...(value.model ? { model: value.model } : {}),
    permission_policy: value.permission_policy
  };
  return {
    ...identity,
    identity_digest: canonicalDigest(identity)
  };
}

function sealPaperEvaluationProtocol(
  value: ResearchControlCampaignPaperEvaluationProtocolInput
): Extract<
  ResearchControlCampaignPaperEvaluationProtocol,
  { protocol_status: "bound" }
> {
  if (!value || value.protocol_status !== "bound") throw invalidDecision();
  const protocol: Extract<
    ResearchControlCampaignPaperEvaluationProtocol,
    { protocol_status: "bound" }
  > = {
    ...structuredClone(value),
    protocol_digest: pendingDigest()
  };
  protocol.protocol_digest = canonicalDigest(
    researchControlCampaignPaperEvaluationProtocolDigestInput(protocol)
  );
  return protocol;
}

function canonicalCampaignPolicy(
  value: ResearchControlCampaignPolicy
): ResearchControlCampaignPolicy {
  const expected: ResearchControlCampaignPolicy = {
    policy_version: "research_control_campaign_v1",
    tick_count_per_arm: 1,
    worker_slot_count_per_tick: 3,
    concurrency_limit_per_arm: 2,
    maximum_total_development_submissions_per_tick: 5,
    arm_execution_policy: "concurrent_per_sequence",
    maximum_baseline_regular_file_count: 10_000,
    maximum_baseline_total_bytes: 1_000_000_000,
    paper_candidate_slot_count_per_arm: 1,
    paper_candidate_reservation_rule:
      "first_admitted_per_tick_in_allocation_order",
    primary_metric_kind:
      "prospective_qualified_candidate_discovery_rate",
    required_future_evidence: "confirmed_comparison_research_release"
  };
  if (!isDeepStrictEqual(value, expected)) throw invalidDecision();
  return expected;
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

function invalidDecision(): ResearchGeneralizationProtocolDecisionError {
  return new ResearchGeneralizationProtocolDecisionError();
}
