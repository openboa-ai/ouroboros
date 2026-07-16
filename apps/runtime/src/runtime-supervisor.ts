import { randomUUID } from "node:crypto";
import type {
  RuntimeProcessOwnershipRecord,
  RuntimeSupervisorCheckpointRecord,
  RuntimeSupervisorLane,
  RuntimeSupervisorLaneReadModel,
  RuntimeSupervisorReadModel,
  RuntimeSupervisorStatus
} from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort
} from "@ouroboros/application/ports/runtime-process-ownership";
import type { RuntimeSupervisorCheckpointStorePort } from
  "@ouroboros/application/ports/runtime-supervisor";

const RUNTIME_SUPERVISOR_LANES: RuntimeSupervisorLane[] = [
  "selected_paper",
  "candidate_arena",
  "research_control_study_scheduler"
];

const PENDING_DIGEST = `sha256:${"0".repeat(64)}`;

export interface RuntimeSupervisorLaneInspection {
  desired: boolean;
  satisfied: boolean;
  basisDigest: string;
  progressDigest: string;
  reasonCode?: string;
}

export interface RuntimeSupervisorLaneAdapter {
  readonly lane: RuntimeSupervisorLane;
  inspect(): Promise<RuntimeSupervisorLaneInspection>;
  recover(): Promise<void>;
  block(reasonCode: string): Promise<void>;
  stop(): Promise<void>;
}

export class RuntimeSupervisorError extends Error {
  constructor(
    readonly code:
      | "runtime_supervisor_lane_contract_invalid"
      | "runtime_supervisor_retry_policy_invalid"
      | "runtime_supervisor_monitor_interval_invalid"
      | "runtime_supervisor_clock_invalid"
      | "runtime_supervisor_lane_unsatisfied"
      | "runtime_supervisor_shutdown_failed",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RuntimeSupervisorError";
  }
}

export class RuntimeSupervisor {
  private readonly retryDelaysMs: readonly number[];
  private readonly monitorIntervalMs: number;
  private readonly now: () => string;
  private readonly processId: number;
  private readonly sessionToken: () => string;
  private currentCheckpoint?: RuntimeSupervisorCheckpointRecord;
  private ownership?: RuntimeProcessOwnershipRecord;
  private active = false;
  private stopping = false;
  private cycle?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(private readonly options: {
    lanes: readonly RuntimeSupervisorLaneAdapter[];
    checkpoints: RuntimeSupervisorCheckpointStorePort;
    processOwnership: Pick<RuntimeProcessOwnershipPort, "claim" | "close">;
    processIdentity: RuntimeProcessExpectedIdentity;
    processId?: number;
    sessionToken?: () => string;
    retryDelaysMs?: readonly number[];
    monitorIntervalMs?: number;
    now?: () => string;
  }) {
    if (
      options.lanes.length !== RUNTIME_SUPERVISOR_LANES.length ||
      options.lanes.some((lane, index) => lane.lane !== RUNTIME_SUPERVISOR_LANES[index])
    ) {
      throw new RuntimeSupervisorError(
        "runtime_supervisor_lane_contract_invalid",
        "Runtime supervisor lanes must use the canonical dependency order."
      );
    }
    this.retryDelaysMs = options.retryDelaysMs ?? [1_000, 5_000];
    if (this.retryDelaysMs.some((delay) => !Number.isInteger(delay) || delay < 0)) {
      throw new RuntimeSupervisorError(
        "runtime_supervisor_retry_policy_invalid",
        "Runtime supervisor retry delays must be non-negative integers."
      );
    }
    this.monitorIntervalMs = options.monitorIntervalMs ?? 10_000;
    if (!Number.isInteger(this.monitorIntervalMs) || this.monitorIntervalMs <= 0) {
      throw new RuntimeSupervisorError(
        "runtime_supervisor_monitor_interval_invalid",
        "Runtime supervisor monitor interval must be a positive integer."
      );
    }
    this.now = options.now ?? (() => new Date().toISOString());
    this.processId = options.processId ?? process.pid;
    this.sessionToken = options.sessionToken ?? (() => randomUUID());
  }

  async start(): Promise<"started" | "already_running"> {
    if (this.active) return "already_running";
    const startedAt = this.exactNow();
    this.ownership = await this.options.processOwnership.claim({
      expected: this.options.processIdentity,
      processId: this.processId,
      sessionToken: this.sessionToken(),
      startedAt
    });
    try {
      this.currentCheckpoint = await this.options.checkpoints.latest();
      this.active = true;
      this.stopping = false;
      await this.reconcile();
      this.scheduleMonitor();
      return "started";
    } catch (error) {
      await this.releaseAfterFailedStart();
      throw error;
    }
  }

  status(): RuntimeSupervisorReadModel {
    const checkpoint = this.currentCheckpoint;
    if (!checkpoint) {
      return {
        status: "stopped",
        lanes: [],
        recorded_at: this.exactNow(),
        checkpoint_sequence: 0,
        checkpoint_digest: PENDING_DIGEST,
        ...closedAuthority()
      };
    }
    return {
      status: checkpoint.status,
      lanes: structuredClone(checkpoint.lanes),
      recorded_at: checkpoint.recorded_at,
      checkpoint_sequence: checkpoint.sequence,
      checkpoint_digest: checkpoint.checkpoint_digest,
      ...closedAuthority()
    };
  }

  async reconcile(): Promise<void> {
    if (!this.active || this.stopping) return;
    if (this.cycle) return this.cycle;
    let tracked: Promise<void>;
    tracked = this.runCycle().finally(() => {
      if (this.cycle === tracked) this.cycle = undefined;
    });
    this.cycle = tracked;
    return tracked;
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.cycle;

    const prior = laneMap(this.currentCheckpoint?.lanes ?? []);
    const stopped: RuntimeSupervisorLaneReadModel[] = [];
    let shutdownError: unknown;
    for (const lane of [...this.options.lanes].reverse()) {
      try {
        await lane.stop();
      } catch (error) {
        shutdownError ??= error;
      }
    }
    for (const lane of this.options.lanes) {
      const existing = prior.get(lane.lane);
      stopped.push({
        lane: lane.lane,
        desired: existing?.desired ?? false,
        status: shutdownError ? "blocked" : "stopped",
        basis_digest: existing?.basis_digest ?? PENDING_DIGEST,
        progress_digest: existing?.progress_digest ?? PENDING_DIGEST,
        attempt_count: existing?.attempt_count ?? 0,
        no_progress_count: existing?.no_progress_count ?? 0,
        reason_code: shutdownError
          ? stableErrorCode(shutdownError, "runtime_supervisor_shutdown_failed")
          : "shutdown"
      });
    }
    await this.publish(shutdownError ? "blocked" : "stopped", stopped);
    if (shutdownError) {
      throw new RuntimeSupervisorError(
        "runtime_supervisor_shutdown_failed",
        "Runtime supervisor dependencies did not stop cleanly.",
        { cause: shutdownError }
      );
    }
    if (this.ownership) {
      await this.options.processOwnership.close({
        ownership: this.ownership,
        terminalReason: "shutdown",
        closedAt: this.exactNow()
      });
    }
    this.ownership = undefined;
    this.active = false;
    this.stopping = false;
  }

  private async runCycle(): Promise<void> {
    const previous = laneMap(this.currentCheckpoint?.lanes ?? []);
    const inspected: Array<{
      adapter: RuntimeSupervisorLaneAdapter;
      inspection: RuntimeSupervisorLaneInspection;
      prior?: RuntimeSupervisorLaneReadModel;
      due: boolean;
    }> = [];
    const working: RuntimeSupervisorLaneReadModel[] = [];
    const now = this.exactNow();
    const nowEpoch = Date.parse(now);

    for (const adapter of this.options.lanes) {
      const prior = previous.get(adapter.lane);
      let inspection: RuntimeSupervisorLaneInspection;
      try {
        inspection = validateInspection(await adapter.inspect());
      } catch (error) {
        if (prior?.status === "blocked" || (
          prior?.status === "degraded" && prior.next_retry_at !== undefined &&
          Date.parse(prior.next_retry_at) > nowEpoch
        )) {
          working.push(structuredClone(prior));
          continue;
        }
        const attemptCount = (prior?.attempt_count ?? 0) + 1;
        const noProgressCount = (prior?.no_progress_count ?? 0) + 1;
        let reasonCode = stableErrorCode(
          error,
          "runtime_supervisor_lane_inspection_failed"
        );
        if (noProgressCount > this.retryDelaysMs.length) {
          try {
            await adapter.block(reasonCode);
          } catch (blockError) {
            reasonCode = stableErrorCode(
              blockError,
              "runtime_supervisor_block_finalization_failed"
            );
          }
          working.push({
            lane: adapter.lane,
            desired: prior?.desired ?? true,
            status: "blocked",
            basis_digest: prior?.basis_digest ?? PENDING_DIGEST,
            progress_digest: prior?.progress_digest ?? PENDING_DIGEST,
            attempt_count: attemptCount,
            no_progress_count: noProgressCount,
            reason_code: reasonCode
          });
        } else {
          const retryDelay = this.retryDelaysMs[noProgressCount - 1] ?? 0;
          working.push({
            lane: adapter.lane,
            desired: prior?.desired ?? true,
            status: "degraded",
            basis_digest: prior?.basis_digest ?? PENDING_DIGEST,
            progress_digest: prior?.progress_digest ?? PENDING_DIGEST,
            attempt_count: attemptCount,
            no_progress_count: noProgressCount,
            next_retry_at: new Date(nowEpoch + retryDelay).toISOString(),
            reason_code: reasonCode
          });
        }
        continue;
      }
      const sameBasis = prior?.basis_digest === inspection.basisDigest;
      const sameProgress = prior?.progress_digest === inspection.progressDigest;
      let due = inspection.desired;
      let state: RuntimeSupervisorLaneReadModel;
      if (!inspection.desired) {
        due = false;
        state = healthyLane(adapter.lane, inspection, false);
      } else if (inspection.satisfied) {
        due = false;
        state = healthyLane(adapter.lane, inspection, true);
      } else if (prior?.status === "blocked" && sameBasis && sameProgress) {
        due = false;
        state = structuredClone(prior);
      } else if (
        prior?.status === "degraded" && sameBasis && sameProgress &&
        prior.next_retry_at !== undefined && Date.parse(prior.next_retry_at) > nowEpoch
      ) {
        due = false;
        state = structuredClone(prior);
      } else {
        state = {
          lane: adapter.lane,
          desired: true,
          status: "recovering",
          basis_digest: inspection.basisDigest,
          progress_digest: inspection.progressDigest,
          attempt_count: prior?.attempt_count ?? 0,
          no_progress_count: prior?.no_progress_count ?? 0,
          ...(inspection.reasonCode ? { reason_code: inspection.reasonCode } : {})
        };
      }
      inspected.push({ adapter, inspection, prior, due });
      working.push(state);
    }

    const dueEntries = inspected.filter((entry) => entry.due);
    if (dueEntries.some((entry) => recoveryCheckpointNeeded(entry))) {
      await this.publish("recovering", working);
    }

    for (const entry of dueEntries) {
      const index = RUNTIME_SUPERVISOR_LANES.indexOf(entry.adapter.lane);
      try {
        await entry.adapter.recover();
        const after = validateInspection(await entry.adapter.inspect());
        if (after.desired && !after.satisfied) {
          throw new RuntimeSupervisorError(
            "runtime_supervisor_lane_unsatisfied",
            `${entry.adapter.lane} recovery did not satisfy its desired state.`
          );
        }
        working[index] = healthyLane(entry.adapter.lane, after, after.desired);
      } catch (error) {
        const after = await entry.adapter.inspect()
          .then(validateInspection)
          .catch(() => entry.inspection);
        const sameBasis = entry.prior?.basis_digest === after.basisDigest;
        const sameProgress = entry.prior?.progress_digest === after.progressDigest;
        const attemptCount = sameBasis && sameProgress
          ? (entry.prior?.attempt_count ?? 0) + 1
          : 1;
        const noProgressCount = sameBasis && sameProgress
          ? (entry.prior?.no_progress_count ?? 0) + 1
          : 1;
        const reasonCode = stableErrorCode(error, "runtime_supervisor_lane_failed");
        if (noProgressCount > this.retryDelaysMs.length) {
          let finalReasonCode = reasonCode;
          try {
            await entry.adapter.block(reasonCode);
          } catch (blockError) {
            finalReasonCode = stableErrorCode(
              blockError,
              "runtime_supervisor_block_finalization_failed"
            );
          }
          working[index] = {
            lane: entry.adapter.lane,
            desired: after.desired,
            status: "blocked",
            basis_digest: after.basisDigest,
            progress_digest: after.progressDigest,
            attempt_count: attemptCount,
            no_progress_count: noProgressCount,
            reason_code: finalReasonCode
          };
        } else {
          const retryDelay = this.retryDelaysMs[noProgressCount - 1] ?? 0;
          working[index] = {
            lane: entry.adapter.lane,
            desired: after.desired,
            status: "degraded",
            basis_digest: after.basisDigest,
            progress_digest: after.progressDigest,
            attempt_count: attemptCount,
            no_progress_count: noProgressCount,
            next_retry_at: new Date(nowEpoch + retryDelay).toISOString(),
            reason_code: reasonCode
          };
        }
      }
    }

    await this.publish(aggregateStatus(working), working);
  }

  private async publish(
    status: RuntimeSupervisorStatus,
    lanes: readonly RuntimeSupervisorLaneReadModel[]
  ): Promise<void> {
    if (sameProjection(this.currentCheckpoint, status, lanes)) return;
    this.currentCheckpoint = await this.options.checkpoints.append({
      status,
      lanes: structuredClone(lanes),
      recorded_at: this.exactNow()
    }, this.currentCheckpoint?.checkpoint_digest);
  }

  private scheduleMonitor(): void {
    if (!this.active || this.stopping || this.timer) return;
    const nowEpoch = Date.parse(this.exactNow());
    const nextRetryEpoch = this.currentCheckpoint?.lanes
      .filter((lane) => lane.status === "degraded" && lane.next_retry_at)
      .map((lane) => Date.parse(lane.next_retry_at!))
      .filter((epoch) => Number.isFinite(epoch))
      .sort((left, right) => left - right)[0];
    const delay = nextRetryEpoch === undefined
      ? this.monitorIntervalMs
      : Math.max(1, Math.min(this.monitorIntervalMs, nextRetryEpoch - nowEpoch));
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.reconcile()
        .catch(() => undefined)
        .finally(() => this.scheduleMonitor());
    }, delay);
    this.timer.unref?.();
  }

  private exactNow(): string {
    const now = this.now();
    const epoch = Date.parse(now);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== now) {
      throw new RuntimeSupervisorError(
        "runtime_supervisor_clock_invalid",
        "Runtime supervisor clock must return an exact ISO instant."
      );
    }
    return now;
  }

  private async releaseAfterFailedStart(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    let shutdownError: unknown;
    for (const lane of [...this.options.lanes].reverse()) {
      try {
        await lane.stop();
      } catch (error) {
        shutdownError ??= error;
      }
    }
    if (shutdownError) {
      this.active = this.ownership !== undefined;
      this.stopping = false;
      throw new RuntimeSupervisorError(
        "runtime_supervisor_shutdown_failed",
        "Runtime supervisor startup effects did not stop cleanly.",
        { cause: shutdownError }
      );
    }

    if (this.ownership) {
      try {
        await this.options.processOwnership.close({
          ownership: this.ownership,
          terminalReason: "shutdown",
          closedAt: this.exactNow()
        });
      } catch (error) {
        this.active = true;
        this.stopping = false;
        throw new RuntimeSupervisorError(
          "runtime_supervisor_shutdown_failed",
          "Runtime supervisor startup ownership did not close cleanly.",
          { cause: error }
        );
      }
    }
    this.ownership = undefined;
    this.active = false;
    this.stopping = false;
  }
}

function validateInspection(
  inspection: RuntimeSupervisorLaneInspection
): RuntimeSupervisorLaneInspection {
  if (
    typeof inspection.desired !== "boolean" ||
    typeof inspection.satisfied !== "boolean" ||
    !sha256Digest(inspection.basisDigest) ||
    !sha256Digest(inspection.progressDigest) ||
    (inspection.reasonCode !== undefined &&
      (inspection.reasonCode.length === 0 || inspection.reasonCode.trim() !== inspection.reasonCode))
  ) {
    throw new RuntimeSupervisorError(
      "runtime_supervisor_lane_contract_invalid",
      "Runtime supervisor lane inspection is invalid."
    );
  }
  return inspection;
}

function healthyLane(
  lane: RuntimeSupervisorLane,
  inspection: RuntimeSupervisorLaneInspection,
  desired: boolean
): RuntimeSupervisorLaneReadModel {
  return {
    lane,
    desired,
    status: "running",
    basis_digest: inspection.basisDigest,
    progress_digest: inspection.progressDigest,
    attempt_count: 0,
    no_progress_count: 0,
    ...(inspection.reasonCode ? { reason_code: inspection.reasonCode } : {})
  };
}

function recoveryCheckpointNeeded(entry: {
  inspection: RuntimeSupervisorLaneInspection;
  prior?: RuntimeSupervisorLaneReadModel;
}): boolean {
  return !entry.prior || entry.prior.status !== "running" ||
    entry.prior.desired !== entry.inspection.desired ||
    entry.prior.basis_digest !== entry.inspection.basisDigest ||
    entry.prior.progress_digest !== entry.inspection.progressDigest;
}

function aggregateStatus(
  lanes: readonly RuntimeSupervisorLaneReadModel[]
): RuntimeSupervisorStatus {
  if (lanes.some((lane) => lane.status === "blocked")) return "blocked";
  if (lanes.some((lane) => lane.status === "degraded")) return "degraded";
  if (lanes.some((lane) => lane.status === "recovering")) return "recovering";
  if (lanes.length > 0 && lanes.every((lane) => lane.status === "stopped")) {
    return "stopped";
  }
  return "running";
}

function laneMap(
  lanes: readonly RuntimeSupervisorLaneReadModel[]
): Map<RuntimeSupervisorLane, RuntimeSupervisorLaneReadModel> {
  return new Map(lanes.map((lane) => [lane.lane, structuredClone(lane)]));
}

function sameProjection(
  checkpoint: RuntimeSupervisorCheckpointRecord | undefined,
  status: RuntimeSupervisorStatus,
  lanes: readonly RuntimeSupervisorLaneReadModel[]
): boolean {
  return checkpoint !== undefined && checkpoint.status === status &&
    JSON.stringify(checkpoint.lanes) === JSON.stringify(lanes);
}

function stableErrorCode(error: unknown, fallback: string): string {
  return error !== null && typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : fallback;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function closedAuthority() {
  return {
    runtime_coordination_authority: true,
    evaluation_authority: false,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
  } as const;
}
