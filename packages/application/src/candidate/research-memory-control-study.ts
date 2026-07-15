import { createHash } from "node:crypto";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  researchMemoryControlStudyDigestInput,
  researchMemoryControlStudyHasRuntimeShape,
  type ResearchDirectionKind,
  type ResearchExperimentAgentIdentity,
  type ResearchExperimentBaselineSnapshot,
  type ResearchExperimentSource,
  type ResearchMemoryControlOpportunityProtocol,
  type ResearchMemoryControlStudyRecord
} from "@ouroboros/domain";
import type { ManagedResearchAgent } from "../trading/research/types";

const DEFAULT_MAXIMUM_BASELINE_REGULAR_FILE_COUNT = 10_000;
const DEFAULT_MAXIMUM_BASELINE_TOTAL_BYTES = 1_000_000_000;

export interface ResearchMemoryControlDirectionInput {
  research_direction_id: string;
  direction_kind: ResearchDirectionKind;
}

export interface DecideResearchMemoryControlStudyInput {
  idempotencyKey: string;
  baseline: ResearchExperimentBaselineSnapshot;
  source: ResearchExperimentSource;
  researchAgent: ManagedResearchAgent & { model: string };
  opportunityProtocol: ResearchMemoryControlOpportunityProtocol;
  directions: ResearchMemoryControlDirectionInput[];
  maximumBaselineRegularFileCount?: number;
  maximumBaselineTotalBytes?: number;
  committedAt: string;
}

export class ResearchMemoryControlStudyDecisionError extends Error {
  readonly code = "invalid_research_memory_control_study_input";

  constructor() {
    super("ResearchMemoryControlStudy decision input is invalid.");
    this.name = "ResearchMemoryControlStudyDecisionError";
  }
}

export function decideResearchMemoryControlStudy(
  input: DecideResearchMemoryControlStudyInput
): ResearchMemoryControlStudyRecord {
  try {
    const idempotencyKey = canonicalString(input?.idempotencyKey);
    const directions = canonicalDirections(input?.directions);
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
    const studyId = researchMemoryControlStudyId(idempotencyKey);
    const token = digestHex(idempotencyKey).slice(0, 16);
    const pairPlans = directions.map((direction, index) => {
      const pairIndex = index + 1;
      const sides = researchMemoryControlPairBlindSides(studyId, pairIndex);
      return {
        pair_index: pairIndex,
        research_direction_ref: {
          record_kind: "research_direction" as const,
          id: direction.research_direction_id
        },
        direction_kind: direction.direction_kind,
        released_memory_treatment: {
          arm_kind: "released_memory_treatment" as const,
          memory_mode: "released_memory" as const,
          tick_id:
            `research-memory-control-tick-${token}-${pairIndex}-${sides.releasedMemory}`
        },
        memory_masked_control: {
          arm_kind: "memory_masked_control" as const,
          memory_mode: "memory_masked" as const,
          tick_id:
            `research-memory-control-tick-${token}-${pairIndex}-${sides.memoryMasked}`
        }
      };
    });
    const record: ResearchMemoryControlStudyRecord = {
      record_kind: "research_memory_control_study",
      version: 1,
      research_memory_control_study_id: studyId,
      idempotency_key: idempotencyKey,
      hypothesis: "released_memory_reduces_exact_behavior_repeats",
      baseline: structuredClone(input.baseline),
      source: structuredClone(input.source),
      research_agent: exactResearchAgentIdentity(input.researchAgent),
      research_agent_profile_id: input.researchAgent.id,
      opportunity_protocol: exactOpportunityProtocol(
        input.opportunityProtocol
      ),
      pair_plans: pairPlans,
      policy: {
        policy_version: "research_memory_control_study_v1",
        pair_count: directions.length,
        allocation_mode: "explicit",
        development_submission_limit_per_worker: 1,
        sealed_submission_limit_per_worker: 1,
        baseline_copy_policy: "fresh_verified_copy_per_arm",
        within_pair_start_policy: "concurrent_initial_sides",
        maximum_within_pair_start_skew_ms: 5_000,
        across_pair_execution_policy: "sequential",
        maximum_baseline_regular_file_count: maximumFileCount,
        maximum_baseline_total_bytes: maximumBytes
      },
      analysis_policy: {
        policy_version: "paired_exact_repeat_sign_test_v1",
        primary_estimand:
          "mean_masked_minus_released_memory_exact_repeat_indicator",
        significance_method: "two_sided_exact_sign_test",
        alpha: 0.05,
        minimum_non_tied_pair_count: 6,
        tie_policy: "exclude_from_sign_test_include_in_mean",
        ineligible_pair_policy: "retain_in_counts_exclude_from_inference",
        minimum_mean_paired_difference: 0
      },
      committed_at: committedAt,
      study_digest: pendingDigest(),
      research_scheduling_authority: true,
      evaluation_authority: false,
      memory_policy_replacement_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "research_only"
    };
    record.study_digest = canonicalDigest(
      researchMemoryControlStudyDigestInput(record)
    );
    if (!researchMemoryControlStudyHasRuntimeShape(record)) {
      throw invalidDecision();
    }
    return record;
  } catch (error) {
    if (error instanceof ResearchMemoryControlStudyDecisionError) throw error;
    throw invalidDecision();
  }
}

export function researchMemoryControlStudyId(idempotencyKey: string): string {
  return `research-memory-control-study-${digestHex(
    canonicalString(idempotencyKey)
  ).slice(0, 20)}`;
}

export function researchMemoryControlPairBlindSides(
  studyId: string,
  pairIndex: number
): {
  releasedMemory: "side-a" | "side-b";
  memoryMasked: "side-a" | "side-b";
} {
  const canonicalStudyId = canonicalString(studyId);
  if (!Number.isInteger(pairIndex) || pairIndex < 1 || pairIndex > 30) {
    throw invalidDecision();
  }
  const offset = Number.parseInt(digestHex(canonicalStudyId).slice(0, 2), 16) % 2;
  const releasedMemory = (offset + pairIndex) % 2 === 0
    ? "side-a" as const
    : "side-b" as const;
  return {
    releasedMemory,
    memoryMasked: releasedMemory === "side-a" ? "side-b" : "side-a"
  };
}

function canonicalDirections(
  value: unknown
): ResearchMemoryControlDirectionInput[] {
  if (!Array.isArray(value) || value.length < 6 || value.length > 30) {
    throw invalidDecision();
  }
  const directions = value.map((direction) => {
    if (!direction || typeof direction !== "object" ||
      !("research_direction_id" in direction) ||
      !("direction_kind" in direction)) {
      throw invalidDecision();
    }
    return {
      research_direction_id: canonicalString(direction.research_direction_id),
      direction_kind: canonicalDirection(direction.direction_kind)
    };
  });
  if (new Set(directions.map(
    (direction) => direction.direction_kind
  )).size < 2) {
    throw invalidDecision();
  }
  return directions;
}

function exactResearchAgentIdentity(
  agent: ManagedResearchAgent
): ResearchExperimentAgentIdentity {
  if (!agent || !canonicalStringOrUndefined(agent.id) || ![
    "codex",
    "claude_code",
    "fixture"
  ].includes(agent.provider) || (agent.provider === "fixture"
    ? agent.permission_policy !== "fixture_only"
    : agent.permission_policy !== "artifact_workspace_only") ||
    !canonicalStringOrUndefined(agent.model) || agent.model === undefined) {
    throw invalidDecision();
  }
  const identity = {
    provider: agent.provider,
    model: agent.model,
    permission_policy: agent.permission_policy
  };
  return {
    ...identity,
    identity_digest: canonicalDigest(identity)
  };
}

function exactOpportunityProtocol(
  value: ResearchMemoryControlOpportunityProtocol
): ResearchMemoryControlOpportunityProtocol {
  if (!value || typeof value !== "object" || Object.keys(value).length !== 6 ||
    value.development_suite_version !== "research_development_replay_v1" ||
    !sha256Digest(value.development_suite_digest) ||
    value.sealed_suite_version !== "research_sealed_admission_v1" ||
    value.sealed_generator_version !== "research_scenario_generator_v1" ||
    !sha256Digest(value.sealed_rotation_commitment_digest) ||
    !sha256Digest(value.sealed_suite_digest)) {
    throw invalidDecision();
  }
  return structuredClone(value);
}

function canonicalDirection(value: unknown): ResearchDirectionKind {
  if (![
    "trend_following",
    "mean_reversion",
    "volatility_regime",
    "funding_aware_risk",
    "liquidation_aware_risk",
    "execution_cost_robustness",
    "other"
  ].includes(String(value))) {
    throw invalidDecision();
  }
  return value as ResearchDirectionKind;
}

function positiveBoundedInteger(value: unknown, maximum: number): number {
  if (!Number.isInteger(value) || Number(value) < 1 ||
    Number(value) > maximum) {
    throw invalidDecision();
  }
  return Number(value);
}

function canonicalTime(value: unknown): string {
  const time = canonicalString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) ||
    new Date(time).toISOString() !== time) {
    throw invalidDecision();
  }
  return time;
}

function canonicalString(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value) {
    throw invalidDecision();
  }
  return value;
}

function canonicalStringOrUndefined(value: unknown): boolean {
  return value === undefined || (typeof value === "string" &&
    value.trim().length > 0 && value.trim() === value);
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function digestHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function invalidDecision(): ResearchMemoryControlStudyDecisionError {
  return new ResearchMemoryControlStudyDecisionError();
}
