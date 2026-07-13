import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  researchWorkerCheckpointDigestInput,
  researchWorkerCheckpointHasRuntimeShape,
  type CandidateAdmissionDecisionRecord,
  type ProviderKind,
  type ResearchDirectionKind,
  type ResearchDirectionRecord,
  type ResearchPreflightCommitmentRecord,
  type ResearchWorkerCheckpointNotebookEntry,
  type ResearchWorkerCheckpointRecord,
  type ResearchWorkerCheckpointTerminalReason,
  type ResearchWorkerRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import { safeId } from "../safe-id";
import type {
  ManagedResearchAgent,
  TradingResearchNotebook,
  TradingResearchPriorCheckpoint
} from "../trading/research/types";

export interface ResearchWorkerLifecycleResolution {
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  workspace_path: string;
  notebook_path: string;
  previous_checkpoint?: ResearchWorkerCheckpointRecord;
  prior_checkpoint?: TradingResearchPriorCheckpoint;
}

export async function resolveResearchWorkerLifecycle(input: {
  store: OuroborosStorePort;
  direction_kind: ResearchDirectionKind;
  agent: ManagedResearchAgent;
  provider_kind: ProviderKind;
  candidate_arena_tick_id: string;
  created_at: string;
}): Promise<ResearchWorkerLifecycleResolution> {
  assertIso(input.created_at, "research_worker_lifecycle_invalid_created_at");
  const directionId = `research-direction-${stableId(input.direction_kind)}`;
  const expectedDirection = await input.store.getResearchDirection(directionId);
  const direction = expectedDirection ?? {
    record_kind: "research_direction" as const,
    version: 1 as const,
    research_direction_id: directionId,
    direction_kind: input.direction_kind,
    market_scope: "external_trading_api_fixture" as const,
    prompt_seed:
      `Explore ${directionLabel(input.direction_kind)} without prescribing an implementation.`,
    diversity_axis: input.direction_kind,
    created_at: input.created_at,
    authority_status: "research_seed_only" as const
  };
  if (expectedDirection) {
    if (expectedDirection.direction_kind !== input.direction_kind ||
      expectedDirection.market_scope !== "external_trading_api_fixture" ||
      expectedDirection.diversity_axis !== input.direction_kind) {
      throw new Error("research_worker_direction_identity_conflict");
    }
  } else {
    await input.store.recordResearchDirection(direction);
  }

  const model = input.agent.model ?? input.agent.provider;
  const identityDigest = sha256(JSON.stringify({
    agent_profile_id: input.agent.id,
    direction_kind: input.direction_kind,
    model,
    provider_kind: input.provider_kind
  })).slice(-16);
  const workerId = [
    "research-worker",
    stableId(input.direction_kind),
    identityDigest
  ].join("-");
  const workspaceKey = `candidate-arena-workers/${workerId}`;
  const expectedWorker = await input.store.getResearchWorker(workerId);
  const worker = expectedWorker ?? {
    record_kind: "research_worker" as const,
    version: 1 as const,
    research_worker_id: workerId,
    display_name: `${directionLabel(input.direction_kind)} ResearchWorker`,
    model,
    provider_kind: input.provider_kind,
    agent_profile_id: input.agent.id,
    research_direction_ref: {
      record_kind: "research_direction",
      id: direction.research_direction_id
    },
    workspace_key: workspaceKey,
    lifecycle_protocol: "research_worker_checkpoint_v1" as const,
    created_at: input.created_at,
    status: "active" as const,
    authority_status: "research_only" as const
  };
  if (expectedWorker) {
    if (expectedWorker.model !== model ||
      expectedWorker.provider_kind !== input.provider_kind ||
      expectedWorker.agent_profile_id !== input.agent.id ||
      expectedWorker.research_direction_ref.id !== direction.research_direction_id ||
      expectedWorker.workspace_key !== workspaceKey ||
      expectedWorker.lifecycle_protocol !== "research_worker_checkpoint_v1") {
      throw new Error("research_worker_identity_conflict");
    }
  } else {
    await input.store.recordResearchWorker(worker);
  }

  const workspacePath = path.resolve(input.store.root(), workspaceKey);
  const notebookPath = path.join(
    workspacePath,
    "notebooks",
    `${safeId(input.candidate_arena_tick_id)}.json`
  );
  await mkdir(path.dirname(notebookPath), { recursive: true });
  const previousCheckpoint = await previousCheckpointForWorker(
    input.store,
    worker.research_worker_id
  );
  const priorCheckpoint = previousCheckpoint
    ? await toTradingResearchPriorCheckpoint(input.store, previousCheckpoint)
    : undefined;
  return {
    direction,
    worker,
    workspace_path: workspacePath,
    notebook_path: notebookPath,
    ...(previousCheckpoint ? { previous_checkpoint: previousCheckpoint } : {}),
    ...(priorCheckpoint ? { prior_checkpoint: priorCheckpoint } : {})
  };
}

export async function closeResearchWorkerCheckpoint(input: {
  store: OuroborosStorePort;
  commitment: ResearchPreflightCommitmentRecord;
  direction: ResearchDirectionRecord;
  worker: ResearchWorkerRecord;
  notebook_path: string;
  terminal_reason: Exclude<
    ResearchWorkerCheckpointTerminalReason,
    "admission_recorded"
  >;
  closed_at: string;
}): Promise<ResearchWorkerCheckpointRecord> {
  assertIso(input.closed_at, "research_worker_checkpoint_invalid_close_time");
  const checkpoints = await input.store.listResearchWorkerCheckpoints();
  const existing = checkpoints.find((checkpoint) =>
    checkpoint.research_preflight_commitment_ref.id ===
      input.commitment.research_preflight_commitment_id
  );
  if (existing) return existing;
  if (input.worker.lifecycle_protocol !== "research_worker_checkpoint_v1" ||
    !input.worker.workspace_key) {
    throw new Error("research_worker_checkpoint_lifecycle_required");
  }
  const admissions = (await input.store.listCandidateAdmissionDecisions())
    .filter((admission) =>
      admission.research_preflight_commitment_ref?.id ===
        input.commitment.research_preflight_commitment_id &&
      admission.research_preflight_commitment_digest ===
        input.commitment.commitment_digest
    );
  if (admissions.length > 1) {
    throw new Error("research_worker_checkpoint_admission_ambiguous");
  }
  const admission = admissions[0];
  const previousCheckpoint = await previousCheckpointForWorker(
    input.store,
    input.worker.research_worker_id,
    input.commitment.research_preflight_commitment_id,
    checkpoints
  );
  const currentEntries = await readCurrentNotebookEntries(
    input.notebook_path,
    input.commitment
  );
  const previousCommitted = previousCheckpoint
    ?.development_budget.cumulative_committed_submission_limit ?? 0;
  const previousRecorded = previousCheckpoint
    ?.development_budget.cumulative_recorded_submission_count ?? 0;
  const checkpointEntries = currentEntries.map((entry, index) => ({
    ...entry,
    sequence: previousRecorded + index + 1,
    candidate_arena_tick_id: input.commitment.candidate_arena_tick_id
  }));
  const notebook = {
    protocol_version: "research_worker_notebook_v1" as const,
    total_entry_count: previousRecorded + checkpointEntries.length,
    recent_entries: [
      ...(previousCheckpoint?.notebook.recent_entries ?? []),
      ...checkpointEntries
    ].slice(-6)
  };
  const closedAt = latestIso([
    input.closed_at,
    input.commitment.committed_at,
    previousCheckpoint?.closed_at,
    admission?.decided_at
  ]);
  const checkpoint: ResearchWorkerCheckpointRecord = {
    record_kind: "research_worker_checkpoint",
    version: 1,
    research_worker_checkpoint_id:
      `research-worker-checkpoint-${safeId(input.commitment.research_preflight_commitment_id)}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: input.worker.research_worker_id
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: input.direction.research_direction_id
    },
    candidate_arena_tick_id: input.commitment.candidate_arena_tick_id,
    research_preflight_commitment_ref: {
      record_kind: "research_preflight_commitment",
      id: input.commitment.research_preflight_commitment_id
    },
    research_preflight_commitment_digest: input.commitment.commitment_digest,
    workspace_key: input.worker.workspace_key,
    ...(previousCheckpoint
      ? {
          previous_checkpoint_ref: {
            record_kind: "research_worker_checkpoint",
            id: previousCheckpoint.research_worker_checkpoint_id
          },
          previous_checkpoint_digest: previousCheckpoint.checkpoint_digest
        }
      : {}),
    development_budget: {
      submission_limit: input.commitment.development_policy.submission_limit,
      recorded_submission_count: checkpointEntries.length,
      cumulative_committed_submission_limit:
        previousCommitted + input.commitment.development_policy.submission_limit,
      cumulative_recorded_submission_count:
        previousRecorded + checkpointEntries.length,
      remaining_submission_authority: 0
    },
    notebook,
    terminal_status: admission || input.terminal_reason === "finished_without_submission"
      ? "completed"
      : "failed_closed",
    terminal_reason: admission ? "admission_recorded" : input.terminal_reason,
    ...(admission
      ? {
          candidate_admission_decision_ref: {
            record_kind: "candidate_admission_decision",
            id: admission.candidate_admission_decision_id
          }
        }
      : {}),
    closed_at: closedAt,
    checkpoint_digest: "sha256:" + "0".repeat(64),
    notebook_continuation_authority: true,
    evaluation_authority: false,
    admission_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "research_only"
  };
  checkpoint.checkpoint_digest = sha256(
    researchWorkerCheckpointDigestInput(checkpoint)
  );
  if (!researchWorkerCheckpointHasRuntimeShape(checkpoint)) {
    throw new Error("research_worker_checkpoint_generated_shape_invalid");
  }
  return input.store.recordResearchWorkerCheckpoint(checkpoint);
}

export async function recoverIncompleteResearchWorkerCheckpoints(input: {
  store: OuroborosStorePort;
  recovered_at: string;
}): Promise<ResearchWorkerCheckpointRecord[]> {
  assertIso(input.recovered_at, "research_worker_recovery_invalid_time");
  const checkpoints = await input.store.listResearchWorkerCheckpoints();
  const closedCommitmentIds = new Set(checkpoints.map((checkpoint) =>
    checkpoint.research_preflight_commitment_ref.id
  ));
  const workers = new Map((await input.store.listResearchWorkers()).map((worker) => [
    worker.research_worker_id,
    worker
  ]));
  const commitments = (await input.store.listResearchPreflightCommitments())
    .filter((commitment) => !closedCommitmentIds.has(
      commitment.research_preflight_commitment_id
    ))
    .sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_preflight_commitment_id.localeCompare(
        right.research_preflight_commitment_id
      )
    );
  const recovered: ResearchWorkerCheckpointRecord[] = [];
  for (const commitment of commitments) {
    const worker = workers.get(commitment.research_worker_ref.id);
    if (!worker || worker.lifecycle_protocol !== "research_worker_checkpoint_v1" ||
      !worker.workspace_key) {
      continue;
    }
    const direction = await input.store.getResearchDirection(
      commitment.research_direction_ref.id
    );
    if (!direction) {
      throw new Error("research_worker_recovery_direction_not_found");
    }
    recovered.push(await closeResearchWorkerCheckpoint({
      store: input.store,
      commitment,
      direction,
      worker,
      notebook_path: researchWorkerNotebookPath(
        input.store,
        worker,
        commitment.candidate_arena_tick_id
      ),
      terminal_reason: "restart_recovery",
      closed_at: input.recovered_at
    }));
  }
  return recovered;
}

export function researchWorkerNotebookPath(
  store: Pick<OuroborosStorePort, "root">,
  worker: ResearchWorkerRecord,
  candidateArenaTickId: string
): string {
  if (!worker.workspace_key) {
    throw new Error("research_worker_workspace_missing");
  }
  return path.join(
    path.resolve(store.root(), worker.workspace_key),
    "notebooks",
    `${safeId(candidateArenaTickId)}.json`
  );
}

async function toTradingResearchPriorCheckpoint(
  store: OuroborosStorePort,
  checkpoint: ResearchWorkerCheckpointRecord
): Promise<TradingResearchPriorCheckpoint> {
  let admission: CandidateAdmissionDecisionRecord | undefined;
  if (checkpoint.candidate_admission_decision_ref) {
    admission = await store.getCandidateAdmissionDecision(
      checkpoint.candidate_admission_decision_ref.id
    );
    if (!admission) {
      throw new Error("research_worker_prior_admission_not_found");
    }
  }
  return {
    research_worker_checkpoint_id: checkpoint.research_worker_checkpoint_id,
    terminal_status: checkpoint.terminal_status,
    terminal_reason: checkpoint.terminal_reason,
    ...(admission
      ? {
          admission_status: admission.status,
          admission_reason: admission.reason
        }
      : {}),
    notebook: structuredClone(checkpoint.notebook)
  };
}

async function readCurrentNotebookEntries(
  notebookPath: string,
  commitment: ResearchPreflightCommitmentRecord
): Promise<Array<Omit<
  ResearchWorkerCheckpointNotebookEntry,
  "sequence" | "candidate_arena_tick_id"
>>> {
  let notebook: TradingResearchNotebook;
  try {
    notebook = JSON.parse(await readFile(notebookPath, "utf8")) as TradingResearchNotebook;
  } catch {
    return [];
  }
  if (!Array.isArray(notebook.entries) ||
    notebook.entries.length > commitment.development_policy.submission_limit) {
    return [];
  }
  const entries: Array<Omit<
    ResearchWorkerCheckpointNotebookEntry,
    "sequence" | "candidate_arena_tick_id"
  >> = [];
  for (const [index, entry] of notebook.entries.entries()) {
    if (!entry || entry.iteration !== index + 1 ||
      (entry.decision !== "keep" && entry.decision !== "discard" &&
        entry.decision !== "crash") ||
      (entry.agent_status !== "edited" && entry.agent_status !== "no_change" &&
        entry.agent_status !== "failed") ||
      !Number.isFinite(entry.score) || typeof entry.summary !== "string" ||
      entry.summary.length === 0 || !entry.evaluation ||
      (entry.evaluation.status !== "accepted" &&
        entry.evaluation.status !== "disqualified") ||
      (entry.evaluation.risk_decision !== "valid_order_request" &&
        entry.evaluation.risk_decision !== "invalid_order_request" &&
        entry.evaluation.risk_decision !== "no_order_request") ||
      !Number.isFinite(entry.evaluation.profit_loss?.net_revenue_usdt)) {
      return [];
    }
    entries.push({
      iteration: entry.iteration,
      decision: entry.decision,
      agent_status: entry.agent_status,
      score: entry.score,
      summary: entry.summary.slice(0, 500),
      evaluation_status: entry.evaluation.status,
      risk_decision: entry.evaluation.risk_decision,
      net_revenue_usdt: entry.evaluation.profit_loss.net_revenue_usdt
    });
  }
  return entries;
}

function latestIso(values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value))
    .reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

async function previousCheckpointForWorker(
  store: OuroborosStorePort,
  workerId: string,
  currentCommitmentId?: string,
  preloadedCheckpoints?: ResearchWorkerCheckpointRecord[]
): Promise<ResearchWorkerCheckpointRecord | undefined> {
  const commitments = (await store.listResearchPreflightCommitments())
    .filter((commitment) => commitment.research_worker_ref.id === workerId)
    .sort((left, right) =>
      left.committed_at.localeCompare(right.committed_at) ||
      left.research_preflight_commitment_id.localeCompare(
        right.research_preflight_commitment_id
      )
    );
  const currentIndex = currentCommitmentId
    ? commitments.findIndex((commitment) =>
        commitment.research_preflight_commitment_id === currentCommitmentId
      )
    : commitments.length;
  if (currentIndex <= 0) return undefined;
  const previousCommitment = commitments[currentIndex - 1];
  if (!previousCommitment) return undefined;
  const checkpoints = preloadedCheckpoints ?? await store.listResearchWorkerCheckpoints();
  return checkpoints.find((checkpoint) =>
    checkpoint.research_preflight_commitment_ref.id ===
      previousCommitment.research_preflight_commitment_id
  );
}

function assertIso(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value)) ||
    new Date(Date.parse(value)).toISOString() !== value) {
    throw new Error(code);
  }
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function directionLabel(direction: ResearchDirectionKind): string {
  return direction.split("_").map((part) =>
    `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`
  ).join(" ");
}

function stableId(value: string): string {
  return safeId(value).replaceAll("_", "-");
}
