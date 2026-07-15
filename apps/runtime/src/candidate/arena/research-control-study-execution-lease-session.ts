import {
  researchControlStudyExecutionLeaseHasRuntimeShape,
  type ResearchControlStudyExecutionLeaseOwner,
  type ResearchControlStudyExecutionLeaseRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";
import type {
  ResearchControlStudyExecutionLeaseHeldReason,
  ResearchControlStudyExecutionLeasePort
} from "@ouroboros/application/ports/research-control-study-execution-lease";

export type ResearchControlStudyExecutionLeaseSessionErrorCode =
  | "research_control_study_execution_lease_session_invalid"
  | "research_control_study_execution_lease_lost"
  | "research_control_study_execution_lease_release_failed"
  | "research_control_study_execution_lease_session_terminal";

export class ResearchControlStudyExecutionLeaseSessionError extends Error {
  constructor(
    readonly code: ResearchControlStudyExecutionLeaseSessionErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudyExecutionLeaseSessionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ResearchControlStudyExecutionLeaseSessionStatus =
  | {
      status: "acquired" | "renewing";
      lease: ResearchControlStudyExecutionLeaseRecord;
    }
  | {
      status: "lost" | "release_failed";
      lease: ResearchControlStudyExecutionLeaseRecord;
      errorCode: ResearchControlStudyExecutionLeaseSessionErrorCode;
      errorMessage: string;
    }
  | {
      status: "released";
      lease: ResearchControlStudyExecutionLeaseRecord;
    };

export interface ResearchControlStudyExecutionLeaseSessionLifecycle {
  start(onLost: (
    error: ResearchControlStudyExecutionLeaseSessionError
  ) => void): "started" | "already_running";
  guard(): Promise<void>;
  stopAndRelease(): Promise<ResearchControlStudyExecutionLeaseRecord>;
  status(): ResearchControlStudyExecutionLeaseSessionStatus;
}

export type ResearchControlStudyExecutionLeaseSessionClaim =
  | {
      status: "acquired";
      session: ResearchControlStudyExecutionLeaseSessionLifecycle;
    }
  | {
      status: "held";
      lease: ResearchControlStudyExecutionLeaseRecord;
      reason: ResearchControlStudyExecutionLeaseHeldReason;
    };

export interface ResearchControlStudyExecutionLeaseSessionFactory {
  acquire(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyExecutionLeaseSessionClaim>;
}

export function createResearchControlStudyExecutionLeaseSessionFactory(
  options: {
    port: ResearchControlStudyExecutionLeasePort;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs?: number;
    renewalIntervalMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  }
): ResearchControlStudyExecutionLeaseSessionFactory {
  const leaseDurationMs = options?.leaseDurationMs ?? 30_000;
  const renewalIntervalMs = options?.renewalIntervalMs ?? 10_000;
  const sleep = options?.sleep ?? unreferencedSleep;
  if (!exactPort(options?.port) || !exactOwner(options?.owner) ||
    !positiveInteger(leaseDurationMs) || !positiveInteger(renewalIntervalMs) ||
    renewalIntervalMs >= leaseDurationMs / 2 || typeof sleep !== "function") {
    throw sessionInvalid(
      "ResearchControlStudy execution lease session configuration is invalid."
    );
  }
  const owner = { ...options.owner };
  return {
    async acquire(study) {
      const result = await options.port.acquire({
        study,
        owner: { ...owner },
        leaseDurationMs
      });
      if (result?.status === "held") {
        if (!activeLeaseForStudy(result.lease, study) || ![
          "owner_alive",
          "owner_liveness_unknown",
          "transition"
        ].includes(result.reason)) {
          throw sessionInvalid("Lease port returned an invalid held claim.");
        }
        return {
          status: "held",
          lease: structuredClone(result.lease),
          reason: result.reason
        };
      }
      if (result?.status !== "acquired" ||
        !activeLeaseForStudy(result.lease, study) ||
        !sameOwner(result.lease.owner, owner) ||
        result.lease.lease_duration_ms !== leaseDurationMs) {
        throw sessionInvalid("Lease port returned an invalid acquired claim.");
      }
      return {
        status: "acquired",
        session: new ResearchControlStudyExecutionLeaseSession({
          port: options.port,
          lease: result.lease,
          renewalIntervalMs,
          sleep
        })
      };
    }
  };
}

class ResearchControlStudyExecutionLeaseSession
implements ResearchControlStudyExecutionLeaseSessionLifecycle {
  private lease: ResearchControlStudyExecutionLeaseRecord;
  private currentStatus: ResearchControlStudyExecutionLeaseSessionStatus;
  private started = false;
  private stopRequested = false;
  private stopSignal = deferredSignal();
  private runPromise?: Promise<void>;
  private releasePromise?: Promise<ResearchControlStudyExecutionLeaseRecord>;
  private releasedLease?: ResearchControlStudyExecutionLeaseRecord;
  private lossError?: ResearchControlStudyExecutionLeaseSessionError;
  private releaseError?: ResearchControlStudyExecutionLeaseSessionError;
  private onLost?: (
    error: ResearchControlStudyExecutionLeaseSessionError
  ) => void;

  constructor(private readonly options: {
    port: ResearchControlStudyExecutionLeasePort;
    lease: ResearchControlStudyExecutionLeaseRecord;
    renewalIntervalMs: number;
    sleep: (milliseconds: number) => Promise<void>;
  }) {
    this.lease = structuredClone(options.lease);
    this.currentStatus = { status: "acquired", lease: structuredClone(this.lease) };
  }

  start(onLost: (
    error: ResearchControlStudyExecutionLeaseSessionError
  ) => void): "started" | "already_running" {
    if (this.started) return "already_running";
    if (this.lossError || this.releaseError || this.releasedLease ||
      typeof onLost !== "function") {
      throw new ResearchControlStudyExecutionLeaseSessionError(
        "research_control_study_execution_lease_session_terminal",
        "A terminal ResearchControlStudy execution lease session cannot start."
      );
    }
    this.started = true;
    this.onLost = onLost;
    this.updateActiveStatus();
    this.runPromise = this.runRenewalLoop();
    return "started";
  }

  status(): ResearchControlStudyExecutionLeaseSessionStatus {
    return structuredClone(this.currentStatus);
  }

  async guard(): Promise<void> {
    this.assertUsable();
    let asserted: ResearchControlStudyExecutionLeaseRecord;
    try {
      asserted = await this.options.port.assertOwned({
        lease: structuredClone(this.lease)
      });
    } catch (error) {
      throw this.markLost("Lease ownership guard failed.", error);
    }
    if (!sameActiveOwnership(asserted, this.lease)) {
      throw this.markLost("Lease ownership guard returned different ownership.");
    }
    this.lease = structuredClone(asserted);
    this.updateActiveStatus();
  }

  stopAndRelease(): Promise<ResearchControlStudyExecutionLeaseRecord> {
    if (this.releasedLease) return Promise.resolve(structuredClone(this.releasedLease));
    if (this.lossError) return Promise.reject(this.lossError);
    if (this.releaseError) return Promise.reject(this.releaseError);
    if (!this.releasePromise) this.releasePromise = this.stopAndReleaseOnce();
    return this.releasePromise.then((lease) => structuredClone(lease));
  }

  private async runRenewalLoop(): Promise<void> {
    try {
      while (!this.stopRequested) {
        const wake = await Promise.race([
          this.options.sleep(this.options.renewalIntervalMs)
            .then(() => "renew" as const),
          this.stopSignal.promise.then(() => "stop" as const)
        ]);
        if (wake === "stop" || this.stopRequested) return;
        let renewed: ResearchControlStudyExecutionLeaseRecord;
        try {
          renewed = await this.options.port.renew({
            lease: structuredClone(this.lease)
          });
        } catch (error) {
          this.markLost("Lease renewal failed.", error);
          return;
        }
        if (!renewedOwnership(renewed, this.lease)) {
          this.markLost("Lease renewal returned different ownership.");
          return;
        }
        this.lease = structuredClone(renewed);
        this.updateActiveStatus();
      }
    } catch (error) {
      this.markLost("Lease renewal timer failed.", error);
    }
  }

  private async stopAndReleaseOnce(): Promise<
    ResearchControlStudyExecutionLeaseRecord
  > {
    this.stopRequested = true;
    this.stopSignal.resolve();
    await this.runPromise;
    if (this.lossError) throw this.lossError;
    let released: ResearchControlStudyExecutionLeaseRecord;
    try {
      released = await this.options.port.release({
        lease: structuredClone(this.lease)
      });
    } catch (error) {
      throw this.markReleaseFailed(error);
    }
    if (!releasedLeaseMatches(released, this.lease)) {
      throw this.markReleaseFailed(new Error(
        "Lease port returned malformed or different release ownership."
      ));
    }
    this.releasedLease = structuredClone(released);
    this.currentStatus = {
      status: "released",
      lease: structuredClone(released)
    };
    return released;
  }

  private assertUsable(): void {
    if (this.lossError) throw this.lossError;
    if (this.releaseError) throw this.releaseError;
    if (this.releasedLease || this.stopRequested) {
      throw new ResearchControlStudyExecutionLeaseSessionError(
        "research_control_study_execution_lease_session_terminal",
        "ResearchControlStudy execution lease session is stopping or released."
      );
    }
  }

  private markLost(
    message: string,
    cause?: unknown
  ): ResearchControlStudyExecutionLeaseSessionError {
    if (this.lossError) return this.lossError;
    const error = new ResearchControlStudyExecutionLeaseSessionError(
      "research_control_study_execution_lease_lost",
      message,
      cause === undefined ? undefined : { cause }
    );
    this.lossError = error;
    this.stopRequested = true;
    this.stopSignal.resolve();
    this.currentStatus = {
      status: "lost",
      lease: structuredClone(this.lease),
      errorCode: error.code,
      errorMessage: error.message
    };
    try {
      this.onLost?.(error);
    } catch {
      // Ownership loss remains terminal even if its observer fails.
    }
    return error;
  }

  private markReleaseFailed(
    cause: unknown
  ): ResearchControlStudyExecutionLeaseSessionError {
    if (this.releaseError) return this.releaseError;
    const error = new ResearchControlStudyExecutionLeaseSessionError(
      "research_control_study_execution_lease_release_failed",
      "ResearchControlStudy execution lease release failed.",
      { cause }
    );
    this.releaseError = error;
    this.currentStatus = {
      status: "release_failed",
      lease: structuredClone(this.lease),
      errorCode: error.code,
      errorMessage: error.message
    };
    return error;
  }

  private updateActiveStatus(): void {
    this.currentStatus = {
      status: this.started ? "renewing" : "acquired",
      lease: structuredClone(this.lease)
    };
  }
}

function activeLeaseForStudy(
  lease: unknown,
  study: ResearchControlStudyRecord
): lease is ResearchControlStudyExecutionLeaseRecord {
  return researchControlStudyExecutionLeaseHasRuntimeShape(lease) &&
    lease.lease_status === "active" &&
    lease.study_ref.id === study.research_control_study_id &&
    lease.study_digest === study.study_digest;
}

function sameActiveOwnership(
  candidate: unknown,
  current: ResearchControlStudyExecutionLeaseRecord
): candidate is ResearchControlStudyExecutionLeaseRecord {
  return researchControlStudyExecutionLeaseHasRuntimeShape(candidate) &&
    candidate.lease_status === "active" &&
    sameLeaseIdentity(candidate, current) &&
    Date.parse(candidate.renewed_at) >= Date.parse(current.renewed_at);
}

function renewedOwnership(
  candidate: unknown,
  current: ResearchControlStudyExecutionLeaseRecord
): candidate is ResearchControlStudyExecutionLeaseRecord {
  return sameActiveOwnership(candidate, current) &&
    Date.parse(candidate.renewed_at) > Date.parse(current.renewed_at);
}

function releasedLeaseMatches(
  candidate: unknown,
  current: ResearchControlStudyExecutionLeaseRecord
): candidate is ResearchControlStudyExecutionLeaseRecord {
  return researchControlStudyExecutionLeaseHasRuntimeShape(candidate) &&
    candidate.lease_status === "released" && sameLeaseSource(candidate, current);
}

function sameLeaseSource(
  left: ResearchControlStudyExecutionLeaseRecord,
  right: ResearchControlStudyExecutionLeaseRecord
): boolean {
  return sameLeaseIdentity(left, right) &&
    left.renewed_at === right.renewed_at &&
    left.expires_at === right.expires_at;
}

function sameLeaseIdentity(
  left: ResearchControlStudyExecutionLeaseRecord,
  right: ResearchControlStudyExecutionLeaseRecord
): boolean {
  return left.research_control_study_execution_lease_id ===
      right.research_control_study_execution_lease_id &&
    left.study_ref.record_kind === right.study_ref.record_kind &&
    left.study_ref.id === right.study_ref.id &&
    left.study_digest === right.study_digest &&
    sameOwner(left.owner, right.owner) && left.lease_token === right.lease_token &&
    left.lease_duration_ms === right.lease_duration_ms &&
    left.acquired_at === right.acquired_at;
}

function sameOwner(
  left: ResearchControlStudyExecutionLeaseOwner,
  right: ResearchControlStudyExecutionLeaseOwner
): boolean {
  return left.server_instance_id === right.server_instance_id &&
    left.host_id === right.host_id && left.process_id === right.process_id &&
    left.process_start_marker === right.process_start_marker;
}

function exactOwner(value: unknown): value is ResearchControlStudyExecutionLeaseOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  return Object.keys(owner).length === 4 && canonicalString(owner.server_instance_id) &&
    canonicalString(owner.host_id) && positiveInteger(owner.process_id) &&
    canonicalString(owner.process_start_marker);
}

function exactPort(value: unknown): value is ResearchControlStudyExecutionLeasePort {
  if (!value || typeof value !== "object") return false;
  const port = value as Record<string, unknown>;
  return typeof port.acquire === "function" && typeof port.renew === "function" &&
    typeof port.assertOwned === "function" && typeof port.release === "function";
}

function canonicalString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.trim() === value;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function sessionInvalid(
  message: string
): ResearchControlStudyExecutionLeaseSessionError {
  return new ResearchControlStudyExecutionLeaseSessionError(
    "research_control_study_execution_lease_session_invalid",
    message
  );
}

function unreferencedSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

function deferredSignal(): { promise: Promise<void>; resolve(): void } {
  let resolved = false;
  let complete!: () => void;
  const promise = new Promise<void>((resolve) => { complete = resolve; });
  return {
    promise,
    resolve() {
      if (resolved) return;
      resolved = true;
      complete();
    }
  };
}
