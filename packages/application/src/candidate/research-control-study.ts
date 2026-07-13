import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchControlCampaignDigestInput,
  researchControlCampaignHasRuntimeShape,
  researchControlCampaignPaperEvaluationProtocolDigestInput,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyHasRuntimeShape,
  type ResearchControlCampaignRecord,
  type ResearchControlStudyCondition,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import { researchControlCampaignId } from "./research-control-campaign";

export type ResearchControlStudyConditionInput = Omit<
  ResearchControlStudyCondition,
  "condition_digest"
>;

export interface DecideResearchControlStudyInput {
  idempotencyKey: string;
  baselineSnapshotDigest: string;
  condition: ResearchControlStudyConditionInput;
  replicationIdempotencyKeys: string[];
  committedAt: string;
}

export type ResearchControlStudyCommitRequest = Omit<
  DecideResearchControlStudyInput,
  "committedAt"
>;

export class ResearchControlStudyDecisionError extends Error {
  readonly code = "invalid_research_control_study_input";

  constructor() {
    super("ResearchControlStudy decision input is invalid.");
    this.name = "ResearchControlStudyDecisionError";
  }
}

export type ResearchControlStudyServiceErrorCode =
  | "research_control_study_conflict"
  | "research_control_study_persistence_conflict";

export class ResearchControlStudyServiceError extends Error {
  constructor(
    readonly code: ResearchControlStudyServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ResearchControlStudyServiceError";
  }
}

export class ResearchControlStudyService {
  private readonly now: () => string;

  constructor(private readonly options: {
    store: OuroborosStorePort;
    now?: () => string;
  }) {
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async commit(
    input: ResearchControlStudyCommitRequest
  ): Promise<ResearchControlStudyRecord> {
    const studyId = researchControlStudyId(input.idempotencyKey);
    const existing = await this.options.store.getResearchControlStudy(studyId);
    if (existing) {
      const requested = decideResearchControlStudy({
        ...input,
        committedAt: existing.committed_at
      });
      if (!isDeepStrictEqual(existing, requested)) {
        throw new ResearchControlStudyServiceError(
          "research_control_study_conflict",
          "ResearchControlStudy conflicts with frozen evidence."
        );
      }
      return existing;
    }
    const study = decideResearchControlStudy({
      ...input,
      committedAt: this.now()
    });
    const recorded = await this.options.store.recordResearchControlStudy(study);
    if (!researchControlStudyHasRuntimeShape(recorded) ||
      !isDeepStrictEqual(recorded, study)) {
      throw new ResearchControlStudyServiceError(
        "research_control_study_persistence_conflict",
        "Store did not preserve exact ResearchControlStudy evidence."
      );
    }
    return recorded;
  }
}

export function decideResearchControlStudy(
  input: DecideResearchControlStudyInput
): ResearchControlStudyRecord {
  try {
    const idempotencyKey = canonicalString(input?.idempotencyKey);
    const baselineSnapshotDigest = canonicalDigestString(
      input?.baselineSnapshotDigest
    );
    const committedAt = canonicalTime(input?.committedAt);
    const replicationKeys = canonicalReplicationKeys(
      input?.replicationIdempotencyKeys
    );
    const condition: ResearchControlStudyCondition = {
      ...structuredClone(input.condition),
      condition_digest: pendingDigest()
    };
    condition.condition_digest = canonicalDigest(
      researchControlStudyConditionDigestInput(condition)
    );
    const record: ResearchControlStudyRecord = {
      record_kind: "research_control_study",
      version: 1,
      research_control_study_id: researchControlStudyId(idempotencyKey),
      idempotency_key: idempotencyKey,
      hypothesis:
        "adaptive_allocation_improves_replicated_qualified_discovery_yield",
      baseline_policy: "same_frozen_snapshot",
      baseline_snapshot_digest: baselineSnapshotDigest,
      condition,
      replications: replicationKeys.map((key, index) => ({
        replication_index: index + 1,
        campaign_idempotency_key: key,
        campaign_ref: {
          record_kind: "research_control_campaign",
          id: researchControlCampaignId(key)
        },
        expected_baseline_snapshot_digest: baselineSnapshotDigest
      })),
      analysis_policy: {
        policy_version: "paired_exact_sign_test_v1",
        primary_estimand:
          "mean_adaptive_minus_static_qualified_discovery_rate",
        significance_method: "two_sided_exact_sign_test",
        alpha: 0.05,
        minimum_non_tied_replication_count: 6,
        tie_policy: "exclude_from_sign_test_include_in_mean",
        minimum_mean_rate_difference: 0
      },
      committed_at: committedAt,
      study_digest: pendingDigest(),
      research_scheduling_authority: true,
      evaluation_authority: false,
      policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    record.study_digest = canonicalDigest(
      researchControlStudyDigestInput(record)
    );
    if (!researchControlStudyHasRuntimeShape(record)) throw invalidDecision();
    return record;
  } catch (error) {
    if (error instanceof ResearchControlStudyDecisionError) throw error;
    throw invalidDecision();
  }
}

export function researchControlStudyConditionFromCampaign(
  campaign: ResearchControlCampaignRecord
): ResearchControlStudyCondition {
  try {
    if (!researchControlCampaignHasRuntimeShape(campaign) ||
      campaign.paper_comparator.comparator_status !== "trading_review" ||
      campaign.paper_evaluation_protocol.protocol_status !== "bound" ||
      canonicalDigest(researchControlCampaignDigestInput(campaign)) !==
        campaign.campaign_digest || canonicalDigest(
          researchControlCampaignPaperEvaluationProtocolDigestInput(
            campaign.paper_evaluation_protocol
          )
        ) !== campaign.paper_evaluation_protocol.protocol_digest ||
      canonicalDigest(campaign.allocation_policy) !==
        campaign.allocation_policy_digest) {
      throw invalidDecision();
    }
    const condition: ResearchControlStudyCondition = {
      source: structuredClone(campaign.source),
      research_agent: structuredClone(campaign.research_agent),
      paper_comparator: structuredClone(campaign.paper_comparator),
      paper_evaluation_protocol: structuredClone(
        campaign.paper_evaluation_protocol
      ),
      allocation_policy: structuredClone(campaign.allocation_policy),
      allocation_policy_digest: campaign.allocation_policy_digest,
      campaign_policy: structuredClone(campaign.policy),
      condition_digest: pendingDigest()
    };
    condition.condition_digest = canonicalDigest(
      researchControlStudyConditionDigestInput(condition)
    );
    return condition;
  } catch (error) {
    if (error instanceof ResearchControlStudyDecisionError) throw error;
    throw invalidDecision();
  }
}

export function researchControlStudyId(idempotencyKey: string): string {
  const canonical = canonicalString(idempotencyKey);
  return `research-control-study-${safeId(canonical, { maxLength: 48 })}-${
    digestHex(canonical).slice(0, 12)
  }`;
}

function canonicalReplicationKeys(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 6 || value.length > 30) {
    throw invalidDecision();
  }
  const keys = value.map(canonicalString);
  if (new Set(keys).size !== keys.length) throw invalidDecision();
  return keys;
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

function canonicalDigestString(value: unknown): string {
  const text = canonicalString(value);
  if (!/^sha256:[a-f0-9]{64}$/.test(text)) throw invalidDecision();
  return text;
}

function canonicalTime(value: unknown): string {
  const text = canonicalString(value);
  if (!Number.isFinite(Date.parse(text)) ||
    new Date(Date.parse(text)).toISOString() !== text) {
    throw invalidDecision();
  }
  return text;
}

function invalidDecision(): ResearchControlStudyDecisionError {
  return new ResearchControlStudyDecisionError();
}
