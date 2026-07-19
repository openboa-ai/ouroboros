import type {
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  PaperTradingEvaluationRecord,
  Ref,
  RunControlAuditInput,
  TradingRunRecord
} from "@ouroboros/domain";
import { isCandidateAdmissionDecisionConsistent } from "@ouroboros/domain";
import type { OuroborosStorePort } from "../../ports/store";
import type {
  PaperTradingCommandResponse,
  PaperTradingCommandService
} from "./commands";

export const DEFAULT_ARENA_PAPER_CAPACITY = 2;

export type ArenaPaperRuntimeLifecycle =
  | "queued"
  | "starting"
  | "running"
  | "recovering"
  | "stopped"
  | "failed"
  | "invalidated";

export interface ArenaPaperRuntimeSystem {
  candidate_ref: Ref;
  candidate_version_ref: Ref;
  system_code_ref: Ref;
  candidate_admission_decision_ref: Ref;
  paper_trading_handoff_conformance_ref: Ref;
  trading_run_ref: Ref;
  paper_trading_evaluation_ref?: Ref;
  sandbox_ref?: Ref;
  workspace_key?: string;
  sandbox_generation?: number;
  admission_decided_at: string;
  lifecycle_status: ArenaPaperRuntimeLifecycle;
  active: boolean;
  failure_reason?: string;
  authority_status: "not_live";
}

export interface ArenaPaperRuntimeSnapshot {
  runtime_kind: "arena_paper_runtime";
  capacity: number;
  eligible_count: number;
  occupied_count: number;
  available_capacity: number;
  queued_count: number;
  starting_count: number;
  running_count: number;
  recovering_count: number;
  stopped_count: number;
  failed_count: number;
  invalidated_count: number;
  startable_count: number;
  needs_reconcile: boolean;
  systems: ArenaPaperRuntimeSystem[];
  evaluation_authority: false;
  promotion_authority: false;
  order_submission_authority: false;
  private_read_authority: false;
  live_exchange_authority: false;
  authority_status: "runtime_coordination_only";
}

type ArenaPaperRuntimeStore = Pick<
  OuroborosStorePort,
  | "listCandidates"
  | "getCandidate"
  | "getTradingRun"
  | "getLatestPaperTradingEvaluationForTradingRun"
  | "listCandidateAdmissionDecisions"
  | "listPaperTradingEvaluations"
  | "recordPaperTradingEvaluation"
  | "recordRunControlAudit"
>;

export interface ArenaPaperRuntimeServiceOptions {
  store: ArenaPaperRuntimeStore;
  paperTrading: Pick<
    PaperTradingCommandService,
    "active" | "start" | "stop"
  >;
  capacity?: number;
}

interface EligibleArenaCandidate {
  candidate: CandidateInspectReadModel;
  admission: CandidateAdmissionDecisionRecord;
  run: TradingRunRecord;
}

export class ArenaPaperRuntimeService {
  private readonly capacity: number;
  private readonly startFailures = new Map<string, string>();
  private reconciliation?: Promise<ArenaPaperRuntimeSnapshot>;
  private startFence = 0;

  constructor(private readonly options: ArenaPaperRuntimeServiceOptions) {
    this.capacity = options.capacity ?? DEFAULT_ARENA_PAPER_CAPACITY;
    if (!Number.isInteger(this.capacity) || this.capacity <= 0) {
      throw new Error("Arena paper capacity must be a positive integer.");
    }
  }

  async snapshot(): Promise<ArenaPaperRuntimeSnapshot> {
    const [summaries, admissions, evaluations] = await Promise.all([
      this.options.store.listCandidates(),
      this.options.store.listCandidateAdmissionDecisions(),
      this.options.store.listPaperTradingEvaluations()
    ]);
    const candidates = (await Promise.all(summaries.map((summary) =>
      this.options.store.getCandidate(summary.candidate_id)
    ))).filter((candidate): candidate is CandidateInspectReadModel =>
      candidate !== undefined
    );
    const admissionsBySystemCode = groupAdmissionsBySystemCode(admissions);
    const candidatesBySystemCode = groupCandidatesBySystemCode(candidates);
    const eligible = (await Promise.all(candidates.map(async (candidate) => {
      if (candidate.status !== "materialized" ||
        candidate.active_version_id !==
          candidate.candidate_version.candidate_version_id) {
        return undefined;
      }
      const systemCodeRef = candidate.system_code?.ref;
      if (systemCodeRef?.record_kind !== "system_code" || !systemCodeRef.id) {
        return undefined;
      }
      if ((candidatesBySystemCode.get(systemCodeRef.id) ?? []).length !== 1) {
        return undefined;
      }
      const exactAdmissions = admissionsBySystemCode.get(systemCodeRef.id) ?? [];
      if (exactAdmissions.length !== 1 ||
        !isRunnableAdmission(exactAdmissions[0]!)) {
        return undefined;
      }
      const run = await this.options.store.getTradingRun(candidate.runtime.ref.id);
      if (!run || !runOwnsCandidate(run, candidate)) {
        return undefined;
      }
      return { candidate, admission: exactAdmissions[0]!, run };
    }))).filter((entry): entry is EligibleArenaCandidate => entry !== undefined);
    const latestEvaluations = latestEvaluationByRun(evaluations);
    const systems = eligible.map((entry) => this.toSystem(
      entry,
      latestEvaluations.get(entry.run.trading_run_id)
    )).sort(compareArenaSystems);
    this.pruneStartFailures(systems);

    const counts = countLifecycles(systems);
    const occupiedCount = counts.running + counts.recovering;
    const availableCapacity = Math.max(0, this.capacity - occupiedCount);
    const startableCount = counts.queued + counts.starting;
    return {
      runtime_kind: "arena_paper_runtime",
      capacity: this.capacity,
      eligible_count: systems.length,
      occupied_count: occupiedCount,
      available_capacity: availableCapacity,
      queued_count: counts.queued,
      starting_count: counts.starting,
      running_count: counts.running,
      recovering_count: counts.recovering,
      stopped_count: counts.stopped,
      failed_count: counts.failed,
      invalidated_count: counts.invalidated,
      startable_count: startableCount,
      needs_reconcile: availableCapacity > 0 && startableCount > 0,
      systems,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      private_read_authority: false,
      live_exchange_authority: false,
      authority_status: "runtime_coordination_only"
    };
  }

  async reconcile(): Promise<ArenaPaperRuntimeSnapshot> {
    if (this.reconciliation) return this.reconciliation;
    let tracked: Promise<ArenaPaperRuntimeSnapshot>;
    tracked = this.reconcileOnce().finally(() => {
      if (this.reconciliation === tracked) this.reconciliation = undefined;
    });
    this.reconciliation = tracked;
    return tracked;
  }

  fencePendingStarts(): void {
    this.startFence += 1;
  }

  private async reconcileOnce(): Promise<ArenaPaperRuntimeSnapshot> {
    const startFence = this.startFence;
    const before = await this.snapshot();
    let available = before.available_capacity;
    const startable = before.systems.filter((system) =>
      system.lifecycle_status === "queued" ||
      system.lifecycle_status === "starting"
    );
    let offset = 0;
    while (available > 0 && offset < startable.length &&
      startFence === this.startFence) {
      const batch = startable.slice(offset, offset + available);
      offset += batch.length;
      const results = await Promise.all(batch.map((system) =>
        this.startSystem(system, startFence)
      ));
      available -= results.filter((started) => started).length;
    }
    return this.snapshot();
  }

  private async startSystem(
    system: ArenaPaperRuntimeSystem,
    startFence: number
  ): Promise<boolean> {
    const failureKey = runtimeFailureKey(system);
    try {
      const response = await this.options.paperTrading.start(
        system.candidate_ref.id,
        {}
      );
      const running = paperStartIsRunning(
        response,
        this.options.paperTrading.active(system.trading_run_ref.id)
      );
      if (startFence !== this.startFence) {
        if (running) {
          const stopped = await this.options.paperTrading.stop(
            system.trading_run_ref.id
          );
          if (stopped.statusCode >= 400) {
            await this.persistStartFailure(
              system,
              "arena_paper_late_start_stop_failed"
            );
          }
        }
        return false;
      }
      if (running) {
        this.startFailures.delete(failureKey);
        return true;
      }
      await this.persistStartFailure(system, paperStartFailure(response));
    } catch (error) {
      await this.persistStartFailure(
        system,
        error instanceof Error ? error.message : String(error)
      );
    }
    return false;
  }

  private async persistStartFailure(
    system: ArenaPaperRuntimeSystem,
    failureReason: string
  ): Promise<void> {
    const failureKey = runtimeFailureKey(system);
    try {
      const evaluation = await this.options.store
        .getLatestPaperTradingEvaluationForTradingRun(system.trading_run_ref.id);
      if (evaluation?.status === "not_started") {
        await this.options.store.recordPaperTradingEvaluation({
          ...evaluation,
          status: "failed",
          next_observation_at: undefined,
          latest_failure_reason: failureReason
        });
        this.startFailures.delete(failureKey);
        return;
      }
      if (evaluation?.status === "failed") {
        this.startFailures.delete(failureKey);
        return;
      }
      if (!evaluation) {
        await this.options.store.recordRunControlAudit(
          arenaPaperStartFailureAudit(system, failureReason)
        );
        this.startFailures.set(failureKey, failureReason);
        return;
      }
    } catch {
      // Preserve the failure in the runtime projection if durable writeback fails.
    }
    this.startFailures.set(failureKey, failureReason);
  }

  private toSystem(
    entry: EligibleArenaCandidate,
    evaluation: PaperTradingEvaluationRecord | undefined
  ): ArenaPaperRuntimeSystem {
    const active = this.options.paperTrading.active(entry.run.trading_run_id);
    const identityFailure = evaluationIdentityFailure(entry, evaluation);
    const base = {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: entry.candidate.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: entry.candidate.candidate_version.candidate_version_id
      },
      system_code_ref: { ...entry.candidate.system_code!.ref! },
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: entry.admission.candidate_admission_decision_id
      },
      paper_trading_handoff_conformance_ref: {
        ...entry.admission.paper_trading_handoff_conformance_ref!
      },
      trading_run_ref: {
        record_kind: "trading_run",
        id: entry.run.trading_run_id
      },
      ...(entry.candidate.runtime.sandbox ? {
        sandbox_ref: {
          record_kind: "sandbox",
          id: entry.candidate.runtime.sandbox.sandbox_id
        },
        ...(entry.candidate.runtime.sandbox.workspace_key
          ? { workspace_key: entry.candidate.runtime.sandbox.workspace_key }
          : {}),
        ...(entry.candidate.runtime.sandbox.generation === undefined
          ? {}
          : {
              sandbox_generation:
                entry.candidate.runtime.sandbox.generation
            })
      } : {}),
      admission_decided_at: entry.admission.decided_at,
      active,
      authority_status: "not_live" as const
    };
    if (identityFailure) {
      return {
        ...base,
        ...(evaluation ? {
          paper_trading_evaluation_ref: evaluationRef(evaluation)
        } : {}),
        lifecycle_status: "failed",
        failure_reason: identityFailure
      };
    }
    const startFailure = this.startFailures.get(runtimeFailureKey(base));
    if (startFailure && (!evaluation || evaluation.status === "not_started")) {
      return {
        ...base,
        ...(evaluation ? {
          paper_trading_evaluation_ref: evaluationRef(evaluation)
        } : {}),
        lifecycle_status: "failed",
        failure_reason: startFailure
      };
    }
    if (evaluation) {
      const lifecycleStatus = evaluationLifecycle(evaluation, active);
      return {
        ...base,
        paper_trading_evaluation_ref: evaluationRef(evaluation),
        lifecycle_status: lifecycleStatus,
        ...(evaluation.latest_failure_reason
          ? { failure_reason: evaluation.latest_failure_reason }
          : {})
      };
    }
    const runFailure = runWithoutEvaluationFailure(entry.run);
    if (runFailure) {
      return {
        ...base,
        lifecycle_status: "failed",
        failure_reason: runFailure
      };
    }
    return {
      ...base,
      lifecycle_status: entry.run.runtime_lifecycle_status === "starting"
        ? "starting"
        : entry.run.runtime_lifecycle_status === "stopped" ||
            entry.run.runtime_lifecycle_status === "paused"
          ? "stopped"
          : "queued"
    };
  }

  private pruneStartFailures(systems: ArenaPaperRuntimeSystem[]): void {
    const current = new Set(systems.map(runtimeFailureKey));
    for (const key of this.startFailures.keys()) {
      if (!current.has(key)) this.startFailures.delete(key);
    }
  }
}

export function loadArenaPaperCapacity(
  env: Record<string, string | undefined>,
  fallback = DEFAULT_ARENA_PAPER_CAPACITY
): number {
  const raw = env.OUROBOROS_ARENA_PAPER_CAPACITY?.trim();
  const value = raw ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      "OUROBOROS_ARENA_PAPER_CAPACITY must be a positive integer."
    );
  }
  return value;
}

function groupAdmissionsBySystemCode(
  admissions: CandidateAdmissionDecisionRecord[]
): Map<string, CandidateAdmissionDecisionRecord[]> {
  const grouped = new Map<string, CandidateAdmissionDecisionRecord[]>();
  for (const admission of admissions) {
    const records = grouped.get(admission.system_code_ref.id) ?? [];
    records.push(admission);
    grouped.set(admission.system_code_ref.id, records);
  }
  return grouped;
}

function groupCandidatesBySystemCode(
  candidates: CandidateInspectReadModel[]
): Map<string, CandidateInspectReadModel[]> {
  const grouped = new Map<string, CandidateInspectReadModel[]>();
  for (const candidate of candidates) {
    if (candidate.status !== "materialized" ||
      candidate.active_version_id !==
        candidate.candidate_version.candidate_version_id) {
      continue;
    }
    const systemCodeId = candidate.system_code?.ref?.id;
    if (!systemCodeId) continue;
    const records = grouped.get(systemCodeId) ?? [];
    records.push(candidate);
    grouped.set(systemCodeId, records);
  }
  return grouped;
}

function isRunnableAdmission(
  admission: CandidateAdmissionDecisionRecord
): boolean {
  return isCandidateAdmissionDecisionConsistent(admission) &&
    admission.status === "admitted" &&
    admission.reason === "evaluation_accepted" &&
    admission.runnable_paper_handoff &&
    admission.authority_status === "not_live" &&
    admission.paper_handoff_conformance_status === "passed" &&
    admission.paper_trading_handoff_conformance_ref?.record_kind ===
      "paper_trading_handoff_conformance" &&
    Boolean(admission.paper_trading_handoff_conformance_ref.id) &&
    Boolean(admission.paper_trading_handoff_conformance_digest);
}

function runOwnsCandidate(
  run: TradingRunRecord,
  candidate: CandidateInspectReadModel
): boolean {
  return run.stage_binding_profile === "paper" &&
    run.authority_status === "not_live" &&
    run.paper_evidence_purpose !== "qualification" &&
    run.candidate_ref?.record_kind === "trading_system_candidate" &&
    run.candidate_ref.id === candidate.candidate_id &&
    run.candidate_version_ref?.record_kind === "candidate_version" &&
    run.candidate_version_ref.id ===
      candidate.candidate_version.candidate_version_id &&
    run.trading_run_id === candidate.runtime.ref.id;
}

function latestEvaluationByRun(
  evaluations: PaperTradingEvaluationRecord[]
): Map<string, PaperTradingEvaluationRecord> {
  const latest = new Map<string, PaperTradingEvaluationRecord>();
  for (const evaluation of evaluations) {
    const runId = evaluation.trading_run_ref.id;
    const current = latest.get(runId);
    if (!current || evaluation.started_at > current.started_at ||
      evaluation.started_at === current.started_at &&
        evaluation.paper_trading_evaluation_id >
          current.paper_trading_evaluation_id) {
      latest.set(runId, evaluation);
    }
  }
  return latest;
}

function evaluationIdentityFailure(
  entry: EligibleArenaCandidate,
  evaluation: PaperTradingEvaluationRecord | undefined
): string | undefined {
  if (!evaluation) return undefined;
  if (evaluation.candidate_ref.id !== entry.candidate.candidate_id ||
    evaluation.candidate_version_ref.id !==
      entry.candidate.candidate_version.candidate_version_id ||
    evaluation.trading_run_ref.id !== entry.run.trading_run_id) {
    return "arena_paper_evaluation_identity_mismatch";
  }
  return undefined;
}

function evaluationLifecycle(
  evaluation: PaperTradingEvaluationRecord,
  active: boolean
): ArenaPaperRuntimeLifecycle {
  switch (evaluation.status) {
    case "not_started":
      return "starting";
    case "running":
      return active ? "running" : "recovering";
    case "stopped":
      return "stopped";
    case "failed":
      return "failed";
    case "invalidated":
      return "invalidated";
  }
}

function runWithoutEvaluationFailure(run: TradingRunRecord): string | undefined {
  if (run.runtime_lifecycle_status === "running" ||
    run.runtime_lifecycle_status === "failed" ||
    run.runtime_lifecycle_status === "killed" ||
    run.runtime_lifecycle_status === "human_review_required") {
    return "arena_paper_run_missing_evaluation";
  }
  return undefined;
}

function evaluationRef(evaluation: PaperTradingEvaluationRecord): Ref {
  return {
    record_kind: "paper_trading_evaluation",
    id: evaluation.paper_trading_evaluation_id
  };
}

function compareArenaSystems(
  left: ArenaPaperRuntimeSystem,
  right: ArenaPaperRuntimeSystem
): number {
  return left.admission_decided_at.localeCompare(right.admission_decided_at) ||
    left.candidate_admission_decision_ref.id.localeCompare(
      right.candidate_admission_decision_ref.id
    ) ||
    left.candidate_ref.id.localeCompare(right.candidate_ref.id);
}

function countLifecycles(systems: ArenaPaperRuntimeSystem[]): Record<
  ArenaPaperRuntimeLifecycle,
  number
> {
  const counts: Record<ArenaPaperRuntimeLifecycle, number> = {
    queued: 0,
    starting: 0,
    running: 0,
    recovering: 0,
    stopped: 0,
    failed: 0,
    invalidated: 0
  };
  for (const system of systems) counts[system.lifecycle_status] += 1;
  return counts;
}

function runtimeFailureKey(system: Pick<
  ArenaPaperRuntimeSystem,
  "candidate_ref" | "candidate_admission_decision_ref"
>): string {
  return [
    system.candidate_ref.id,
    system.candidate_admission_decision_ref.id
  ].join(":");
}

function paperStartIsRunning(
  response: PaperTradingCommandResponse,
  active: boolean
): boolean {
  if (response.statusCode < 200 || response.statusCode >= 300) return false;
  const evaluation = response.body.paper_trading_evaluation as
    | { status?: unknown }
    | undefined;
  return active || response.body.runner_status === "running" ||
    evaluation?.status === "running";
}

function paperStartFailure(response: PaperTradingCommandResponse): string {
  if (response.statusCode >= 200 && response.statusCode < 300) {
    return "paper_start_not_running";
  }
  const reason = response.body.reason ?? response.body.error ??
    `paper_start_http_${response.statusCode}`;
  return typeof reason === "string" ? reason : "paper_start_failed";
}

function arenaPaperStartFailureAudit(
  system: ArenaPaperRuntimeSystem,
  failureReason: string
): RunControlAuditInput {
  const summary = `Arena paper start failed: ${failureReason}.`;
  return {
    idempotency_key: [
      "arena-paper-start-failed",
      system.candidate_ref.id,
      system.candidate_version_ref.id,
      system.candidate_admission_decision_ref.id
    ].join(":"),
    candidate_id: system.candidate_ref.id,
    candidate_version_id: system.candidate_version_ref.id,
    runtime_id: system.trading_run_ref.id,
    command: {
      action: "start",
      requested_lifecycle_status: "running",
      actor_kind: "policy_engine",
      reason: "safety_intervention",
      reason_summary: summary
    },
    decision: {
      decision_outcome: "rejected",
      decision_reason: "policy_rejected_control",
      decided_by_actor_kind: "policy_engine",
      resulting_lifecycle_status: "failed"
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      runtime_lifecycle_status: "failed",
      message: summary,
      supporting_record_refs: [
        system.candidate_admission_decision_ref,
        system.paper_trading_handoff_conformance_ref,
        system.system_code_ref
      ]
    }
  };
}
