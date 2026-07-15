import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  isCandidateAdmissionDecisionConsistent,
  paperTradingComparisonPersistedRecordDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  researchWorkerMemoryPolicyHasRuntimeShape,
  type CandidateAdmissionDecisionRecord,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerMemoryControlAssignment,
  type ResearchWorkerMemoryMode,
  type ResearchWorkerMemoryPolicy
} from "@ouroboros/domain";
import type { TradingResearchPriorCheckpoint } from
  "../trading/research/types";

const RESEARCH_WORKER_ARENA_CONTEXT_KEYS = new Set([
  "requested_direction",
  "current_research_allocation",
  "current_research_selection",
  "research_population_diversity",
  "task",
  "leaderboard",
  "negative_findings",
  "latest_findings",
  "latest_research_efficiency",
  "released_campaign_findings",
  "adaptive_direction_focus",
  "finding_clusters",
  "latest_candidate_admission_rejections"
]);

export interface BuildResearchWorkerMemoryProjectionInput {
  mode: ResearchWorkerMemoryMode;
  currentContext: Record<string, unknown>;
  memoryContext: Record<string, unknown>;
  priorCheckpointRecord?: ResearchWorkerCheckpointRecord;
  priorCheckpoint?: TradingResearchPriorCheckpoint;
  priorAdmissionDecision?: CandidateAdmissionDecisionRecord;
  controlAssignment?: ResearchWorkerMemoryControlAssignment;
}

export interface ResearchWorkerMemoryProjection {
  arenaContext: string;
  priorCheckpoint?: TradingResearchPriorCheckpoint;
  policy: ResearchWorkerMemoryPolicy;
}

export function buildResearchWorkerMemoryProjection(
  input: BuildResearchWorkerMemoryProjectionInput
): ResearchWorkerMemoryProjection {
  assertInput(input);
  const priorCheckpointRecord = input.priorCheckpointRecord;
  const priorCheckpoint = input.priorCheckpoint;
  const safeMemoryContext = sanitizedContextObject(input.memoryContext);
  const safeCurrentContext = sanitizedContextObject(input.currentContext);
  const memorySource = {
    memory_context: safeMemoryContext,
    ...(priorCheckpoint ? {
      prior_checkpoint: structuredClone(priorCheckpoint)
    } : {})
  };
  const arenaPayload = {
    ...safeCurrentContext,
    ...(input.mode === "released_memory"
      ? safeMemoryContext
      : {})
  };
  const arenaContext = sanitizeResearchWorkerArenaContext(
    JSON.stringify(arenaPayload)
  );
  if (!arenaContext) {
    throw new Error("research_worker_memory_projection_invalid");
  }
  const policy: ResearchWorkerMemoryPolicy = {
    protocol_version: "research_worker_memory_v1",
    memory_mode: input.mode,
    memory_source_digest: canonicalDigest(memorySource),
    available_memory_item_count:
      memoryItemCount(safeMemoryContext) + (priorCheckpoint ? 1 : 0),
    arena_context_digest: sha256(arenaContext),
    prior_checkpoint: priorCheckpointRecord
      ? {
          disposition: input.mode === "released_memory"
            ? "included"
            : "masked",
          checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: priorCheckpointRecord.research_worker_checkpoint_id
          },
          checkpoint_digest: priorCheckpointRecord.checkpoint_digest
        }
      : { disposition: "none_available" },
    ...(input.controlAssignment
      ? { control_assignment: structuredClone(input.controlAssignment) }
      : {})
  };
  if (!researchWorkerMemoryPolicyHasRuntimeShape(policy)) {
    throw new Error("research_worker_memory_policy_invalid");
  }
  return {
    arenaContext,
    ...(input.mode === "released_memory" && priorCheckpoint
      ? { priorCheckpoint: structuredClone(priorCheckpoint) }
      : {}),
    policy
  };
}

export function sanitizeResearchWorkerArenaContext(
  raw: string | undefined
): string | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!plainObject(parsed)) return undefined;
  const projection: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!RESEARCH_WORKER_ARENA_CONTEXT_KEYS.has(key)) continue;
    projection[key] = sanitizeResearchWorkerContextValue(value);
  }
  return JSON.stringify(projection);
}

function sanitizedContextObject(
  context: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = sanitizeResearchWorkerArenaContext(JSON.stringify(context));
  if (!sanitized) {
    throw new Error("research_worker_memory_projection_invalid");
  }
  return JSON.parse(sanitized) as Record<string, unknown>;
}

function sanitizeResearchWorkerContextValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeResearchWorkerContextValue);
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !blockedResearchWorkerContextKey(key))
      .map(([key, nested]) => [key, sanitizeResearchWorkerContextValue(nested)])
  );
}

function blockedResearchWorkerContextKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("paper") ||
    normalized.includes("sealed") ||
    normalized.includes("scenario") ||
    normalized.includes("provider_request") ||
    normalized.includes("market_snapshot") ||
    normalized.includes("execution_snapshot") ||
    normalized.includes("open_order") ||
    normalized.includes("account") ||
    normalized === "fill" ||
    normalized.endsWith("_fill") ||
    normalized === "command" ||
    normalized.endsWith("_command") ||
    normalized === "stdout" ||
    normalized === "stderr" ||
    normalized === "authority_status" ||
    normalized.endsWith("_path") ||
    normalized.includes("private");
}

function assertInput(input: BuildResearchWorkerMemoryProjectionInput): void {
  if (!input || (input.mode !== "released_memory" &&
    input.mode !== "memory_masked") || !plainObject(input.currentContext) ||
    !plainObject(input.memoryContext)) {
    throw new Error("research_worker_memory_projection_input_invalid");
  }
  const hasCheckpointRecord = input.priorCheckpointRecord !== undefined;
  const hasPriorCheckpoint = input.priorCheckpoint !== undefined;
  if (hasCheckpointRecord !== hasPriorCheckpoint ||
    (input.priorCheckpointRecord &&
      !researchWorkerCheckpointHasRuntimeShape(input.priorCheckpointRecord)) ||
    (input.priorCheckpointRecord && input.priorCheckpoint && (
      input.priorCheckpointRecord.research_worker_checkpoint_id !==
        input.priorCheckpoint.research_worker_checkpoint_id ||
      input.priorCheckpointRecord.terminal_status !==
        input.priorCheckpoint.terminal_status ||
      input.priorCheckpointRecord.terminal_reason !==
        input.priorCheckpoint.terminal_reason ||
      !isDeepStrictEqual(
        input.priorCheckpointRecord.notebook,
        input.priorCheckpoint.notebook
      )
  ))) {
    throw new Error("research_worker_memory_prior_checkpoint_mismatch");
  }
  assertPriorAdmission(input);
  if (input.controlAssignment && (
    input.controlAssignment.study_ref.record_kind !==
      "research_memory_control_study" ||
    !nonEmpty(input.controlAssignment.study_ref.id) ||
    !sha256Digest(input.controlAssignment.study_digest) ||
    !Number.isInteger(input.controlAssignment.pair_index) ||
    input.controlAssignment.pair_index < 1 ||
    input.controlAssignment.pair_index > 30 ||
    (input.mode === "released_memory"
      ? input.controlAssignment.arm_kind !== "released_memory_treatment"
      : input.controlAssignment.arm_kind !== "memory_masked_control")
  )) {
    throw new Error("research_worker_memory_control_assignment_invalid");
  }
}

function assertPriorAdmission(
  input: BuildResearchWorkerMemoryProjectionInput
): void {
  const checkpoint = input.priorCheckpointRecord;
  const prior = input.priorCheckpoint;
  const admission = input.priorAdmissionDecision;
  const admissionRef = checkpoint?.candidate_admission_decision_ref;
  const projectedStatus = prior?.admission_status;
  const projectedReason = prior?.admission_reason;
  const hasProjectedAdmission = projectedStatus !== undefined ||
    projectedReason !== undefined;
  if (Boolean(admissionRef) !== Boolean(admission) ||
    Boolean(admissionRef) !== hasProjectedAdmission ||
    (projectedStatus === undefined) !== (projectedReason === undefined) ||
    (admission && (!candidateAdmissionHasRuntimeEvidence(admission) ||
      admission.candidate_admission_decision_id !== admissionRef?.id ||
      admission.research_preflight_commitment_ref?.id !==
        checkpoint?.research_preflight_commitment_ref.id ||
      admission.research_preflight_commitment_digest !==
        checkpoint?.research_preflight_commitment_digest ||
      admission.status !== projectedStatus ||
      admission.reason !== projectedReason ||
      Date.parse(admission.decided_at) >
        Date.parse(checkpoint?.closed_at ?? "")))) {
    throw new Error("research_worker_memory_prior_admission_mismatch");
  }
}

function candidateAdmissionHasRuntimeEvidence(
  admission: CandidateAdmissionDecisionRecord
): boolean {
  try {
    return admission.record_kind === "candidate_admission_decision" &&
      admission.version === 1 &&
      nonEmpty(admission.candidate_admission_decision_id) &&
      Number.isFinite(Date.parse(admission.decided_at)) &&
      isCandidateAdmissionDecisionConsistent(admission);
  } catch {
    return false;
  }
}

function memoryItemCount(memoryContext: Record<string, unknown>): number {
  return Object.values(memoryContext).reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + value.length;
    if (value === null || value === undefined) return count;
    if (plainObject(value) && Object.keys(value).length === 0) return count;
    return count + 1;
  }, 0);
}

function canonicalDigest(value: unknown): string {
  return sha256(paperTradingComparisonPersistedRecordDigestInput(value));
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" &&
    !Array.isArray(value);
}
