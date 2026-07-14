import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  closeResearchControlStudyExecutionLease,
  decideResearchControlStudyExecutionLease,
  renewResearchControlStudyExecutionLease,
  researchControlStudyConditionDigestInput,
  researchControlStudyDigestInput,
  researchControlStudyExecutionLeaseHasRuntimeShape,
  researchControlStudyHasRuntimeShape,
  type ResearchControlStudyExecutionLeaseOwner,
  type ResearchControlStudyExecutionLeaseRecord,
  type ResearchControlStudyRecord
} from "@ouroboros/domain";

export type ResearchControlStudyExecutionLeaseOwnerLiveness =
  | "alive"
  | "absent"
  | "unknown";

export type ResearchControlStudyExecutionLeaseStoreErrorCode =
  | "invalid_research_control_study_execution_lease_store_input"
  | "research_control_study_execution_lease_state_corrupt"
  | "research_control_study_execution_lease_ownership_lost";

export class ResearchControlStudyExecutionLeaseStoreError extends Error {
  constructor(
    readonly code: ResearchControlStudyExecutionLeaseStoreErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ResearchControlStudyExecutionLeaseStoreError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type ResearchControlStudyExecutionLeaseStoreAcquireResult =
  | {
      status: "acquired";
      lease: ResearchControlStudyExecutionLeaseRecord;
    }
  | {
      status: "held";
      lease: ResearchControlStudyExecutionLeaseRecord;
      reason: "owner_alive" | "owner_liveness_unknown" | "transition";
    };

export interface FileSystemResearchControlStudyExecutionLeaseStoreOptions {
  now?: () => string;
  leaseToken?: () => string;
  ownerLiveness?: (
    owner: ResearchControlStudyExecutionLeaseOwner
  ) => Promise<ResearchControlStudyExecutionLeaseOwnerLiveness>;
}

interface ResearchControlStudyExecutionLeasePaths {
  activeDir: string;
  activeFile: string;
  transitionDir: string;
  transitionFile: string;
}

const MAX_ACQUIRE_TRANSITIONS = 32;
const MAX_INCOMPLETE_CLAIM_READS = 20;

export class FileSystemResearchControlStudyExecutionLeaseStore {
  private readonly now: () => string;
  private readonly leaseToken: () => string;
  private readonly ownerLiveness: (
    owner: ResearchControlStudyExecutionLeaseOwner
  ) => Promise<ResearchControlStudyExecutionLeaseOwnerLiveness>;

  constructor(
    private readonly root: string,
    options: FileSystemResearchControlStudyExecutionLeaseStoreOptions = {}
  ) {
    if (typeof root !== "string" || !root.trim() || root.trim() !== root) {
      throw invalidInput("lease store root must be a canonical non-empty path");
    }
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseToken = options.leaseToken ?? (() => randomUUID());
    this.ownerLiveness = options.ownerLiveness ??
      researchControlStudyExecutionLeaseOwnerLiveness;
  }

  async acquire(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }): Promise<ResearchControlStudyExecutionLeaseStoreAcquireResult> {
    this.assertAcquireInput(input);
    const paths = this.pathsFor(input.study);
    await this.ensureLayout();
    for (let attempt = 0; attempt < MAX_ACQUIRE_TRANSITIONS; attempt += 1) {
      await this.recoverTransition(input.study, paths);
      const active = await this.readOptionalLeaseDirectory(
        paths.activeDir,
        paths.activeFile,
        "active",
        "recover_empty_claim"
      );
      if (!active) {
        const claimed = await this.tryClaim(input, paths);
        if (claimed) return { status: "acquired", lease: claimed };
        continue;
      }
      this.assertStudyBinding(active, input.study);
      const now = this.readNow();
      if (Date.parse(now) < Date.parse(active.expires_at)) {
        return { status: "held", lease: active, reason: "owner_alive" };
      }
      const liveness = await this.readOwnerLiveness(active.owner);
      if (liveness !== "absent") {
        return {
          status: "held",
          lease: active,
          reason: liveness === "alive"
            ? "owner_alive"
            : "owner_liveness_unknown"
        };
      }
      if (!await this.tryMoveActiveToTransition(paths)) continue;
      await this.expireAbsentTransition(input.study, paths, active, now);
    }
    throw corruptState("lease acquisition did not reach a stable filesystem state");
  }

  async renew(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveLeaseInput(input?.lease);
    const paths = this.pathsForLease(input.lease);
    const active = await this.requireActive(paths);
    if (!isDeepStrictEqual(active, input.lease)) {
      throw ownershipLost("active lease changed before renewal");
    }
    const renewedAt = this.readNow();
    if (Date.parse(renewedAt) >= Date.parse(active.expires_at)) {
      throw ownershipLost("active lease has expired");
    }
    let renewed: ResearchControlStudyExecutionLeaseRecord;
    try {
      renewed = renewResearchControlStudyExecutionLease({
        lease: active,
        renewedAt
      });
    } catch (error) {
      throw invalidInput("lease renewal time is invalid", error);
    }
    await this.writeAtomicLease(paths.activeFile, renewed);
    const persisted = await this.requireActive(paths);
    if (!isDeepStrictEqual(persisted, renewed)) {
      throw ownershipLost("active lease changed while renewal was persisted");
    }
    return persisted;
  }

  async assertOwned(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveLeaseInput(input?.lease);
    const active = await this.requireActive(this.pathsForLease(input.lease));
    if (!sameLeaseIdentity(active, input.lease)) {
      throw ownershipLost("active lease token or owner does not match");
    }
    if (Date.parse(this.readNow()) >= Date.parse(active.expires_at)) {
      throw ownershipLost("active lease has expired");
    }
    return active;
  }

  async release(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveLeaseInput(input?.lease);
    await this.ensureLayout();
    const prior = await this.readOptionalHistory(input.lease);
    if (prior) {
      if (prior.lease_status !== "released" ||
        !sameLeaseSource(prior, input.lease)) {
        throw corruptState("terminal lease history conflicts with release input");
      }
      return prior;
    }
    const paths = this.pathsForLease(input.lease);
    const transitioned = await this.readOptionalLeaseDirectory(
      paths.transitionDir,
      paths.transitionFile,
      "active"
    );
    if (transitioned) {
      if (!isDeepStrictEqual(transitioned, input.lease)) {
        throw ownershipLost("another lease transition is already in progress");
      }
    } else {
      const active = await this.requireActive(paths);
      if (!isDeepStrictEqual(active, input.lease)) {
        throw ownershipLost("active lease changed before release");
      }
      try {
        await rename(paths.activeDir, paths.transitionDir);
      } catch (error) {
        if (isErrno(error, "ENOENT") || isExistingPathError(error)) {
          throw ownershipLost("active lease changed before release");
        }
        throw error;
      }
    }
    const exactTransition = await this.requireTransition(paths);
    if (!isDeepStrictEqual(exactTransition, input.lease)) {
      throw ownershipLost("lease transition changed before release");
    }
    let released: ResearchControlStudyExecutionLeaseRecord;
    try {
      released = closeResearchControlStudyExecutionLease({
        lease: exactTransition,
        leaseStatus: "released",
        closedAt: this.readNow()
      });
    } catch (error) {
      throw invalidInput("lease release time is invalid", error);
    }
    await this.archiveTerminal(released);
    await rm(paths.transitionDir, { recursive: true, force: true });
    return released;
  }

  private assertAcquireInput(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }): void {
    if (!exactStudy(input?.study) || !exactOwner(input?.owner) ||
      !Number.isSafeInteger(input?.leaseDurationMs) ||
      input.leaseDurationMs <= 0) {
      throw invalidInput("lease acquisition input is invalid");
    }
    this.readNow();
  }

  private assertActiveLeaseInput(
    lease: ResearchControlStudyExecutionLeaseRecord
  ): void {
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(lease) ||
      lease.lease_status !== "active") {
      throw invalidInput("an exact active lease is required");
    }
  }

  private async tryClaim(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }, paths: ResearchControlStudyExecutionLeasePaths): Promise<
    ResearchControlStudyExecutionLeaseRecord | undefined
  > {
    let lease: ResearchControlStudyExecutionLeaseRecord;
    try {
      lease = decideResearchControlStudyExecutionLease({
        study: input.study,
        owner: input.owner,
        leaseToken: this.leaseToken(),
        leaseDurationMs: input.leaseDurationMs,
        acquiredAt: this.readNow()
      });
    } catch (error) {
      throw invalidInput("lease token or acquisition decision is invalid", error);
    }
    const preparedDir = `${paths.activeDir}.claim-${process.pid}-${randomUUID()}`;
    const preparedFile = path.join(preparedDir, "lease.json");
    await mkdir(preparedDir);
    try {
      await this.writeAtomicLease(preparedFile, lease);
      try {
        await rename(preparedDir, paths.activeDir);
      } catch (error) {
        if (isExistingPathError(error)) return undefined;
        throw error;
      }
      return lease;
    } finally {
      await rm(preparedDir, { recursive: true, force: true });
    }
  }

  private async recoverTransition(
    study: ResearchControlStudyRecord,
    paths: ResearchControlStudyExecutionLeasePaths
  ): Promise<void> {
    const transition = await this.readOptionalLeaseDirectory(
      paths.transitionDir,
      paths.transitionFile,
      "active"
    );
    if (!transition) return;
    this.assertStudyBinding(transition, study);
    const active = await this.readOptionalLeaseDirectory(
      paths.activeDir,
      paths.activeFile,
      "active",
      "recover_empty_claim"
    );
    const history = await this.readOptionalHistory(transition);
    if (history) {
      if (!sameLeaseSource(history, transition)) {
        throw corruptState("terminal history does not match its transition");
      }
      if (active && sameLeaseIdentity(active, transition)) {
        throw corruptState("terminal and active state contain the same lease");
      }
      await rm(paths.transitionDir, { recursive: true, force: true });
      return;
    }
    const now = this.readNow();
    if (active) {
      this.assertStudyBinding(active, study);
      if (sameLeaseIdentity(active, transition)) {
        throw corruptState("the same lease exists in active and transition state");
      }
      if (Date.parse(now) < Date.parse(transition.expires_at) ||
        await this.readOwnerLiveness(transition.owner) !== "absent") {
        throw corruptState("an unclosed transition conflicts with a new active lease");
      }
      await this.archiveExpiredTransition(transition, now);
      await rm(paths.transitionDir, { recursive: true, force: true });
      return;
    }
    if (Date.parse(now) >= Date.parse(transition.expires_at)) {
      const liveness = await this.readOwnerLiveness(transition.owner);
      if (liveness === "absent") {
        await this.archiveExpiredTransition(transition, now);
        await rm(paths.transitionDir, { recursive: true, force: true });
        return;
      }
    }
    await this.restoreTransition(paths);
  }

  private async expireAbsentTransition(
    study: ResearchControlStudyRecord,
    paths: ResearchControlStudyExecutionLeasePaths,
    expected: ResearchControlStudyExecutionLeaseRecord,
    now: string
  ): Promise<void> {
    const transition = await this.readOptionalLeaseDirectory(
      paths.transitionDir,
      paths.transitionFile,
      "active"
    );
    if (!transition) return;
    this.assertStudyBinding(transition, study);
    if (!isDeepStrictEqual(transition, expected)) return;
    if (Date.parse(now) < Date.parse(transition.expires_at) ||
      await this.readOwnerLiveness(transition.owner) !== "absent") {
      await this.restoreTransition(paths);
      return;
    }
    await this.archiveExpiredTransition(transition, now);
    await rm(paths.transitionDir, { recursive: true, force: true });
  }

  private async archiveExpiredTransition(
    transition: ResearchControlStudyExecutionLeaseRecord,
    closedAt: string
  ): Promise<ResearchControlStudyExecutionLeaseRecord> {
    let expired: ResearchControlStudyExecutionLeaseRecord;
    try {
      expired = closeResearchControlStudyExecutionLease({
        lease: transition,
        leaseStatus: "expired",
        closedAt
      });
    } catch (error) {
      throw corruptState("expired transition cannot be closed exactly", error);
    }
    await this.archiveTerminal(expired);
    return expired;
  }

  private async restoreTransition(
    paths: ResearchControlStudyExecutionLeasePaths
  ): Promise<void> {
    try {
      await rename(paths.transitionDir, paths.activeDir);
    } catch (error) {
      if (isErrno(error, "ENOENT") || isExistingPathError(error)) return;
      throw error;
    }
  }

  private async tryMoveActiveToTransition(
    paths: ResearchControlStudyExecutionLeasePaths
  ): Promise<boolean> {
    try {
      await rename(paths.activeDir, paths.transitionDir);
      return true;
    } catch (error) {
      if (isErrno(error, "ENOENT") || isExistingPathError(error)) return false;
      throw error;
    }
  }

  private async archiveTerminal(
    terminal: ResearchControlStudyExecutionLeaseRecord
  ): Promise<void> {
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(terminal) ||
      terminal.lease_status === "active") {
      throw corruptState("terminal lease history is invalid");
    }
    const file = this.historyFile(terminal.research_control_study_execution_lease_id);
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(file, serialize(terminal), { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if (!isErrno(error, "EEXIST")) throw error;
      const existing = await this.readHistoryFile(file);
      if (!isDeepStrictEqual(existing, terminal)) {
        throw corruptState("terminal lease history is immutable");
      }
    }
  }

  private async requireActive(
    paths: ResearchControlStudyExecutionLeasePaths
  ): Promise<ResearchControlStudyExecutionLeaseRecord> {
    const active = await this.readOptionalLeaseDirectory(
      paths.activeDir,
      paths.activeFile,
      "active"
    );
    if (!active) throw ownershipLost("active lease does not exist");
    return active;
  }

  private async requireTransition(
    paths: ResearchControlStudyExecutionLeasePaths
  ): Promise<ResearchControlStudyExecutionLeaseRecord> {
    const transition = await this.readOptionalLeaseDirectory(
      paths.transitionDir,
      paths.transitionFile,
      "active"
    );
    if (!transition) throw ownershipLost("lease transition does not exist");
    return transition;
  }

  private async readOptionalLeaseDirectory(
    directory: string,
    file: string,
    expectedStatus: "active",
    incompleteClaimPolicy: "fail_closed" | "recover_empty_claim" =
      "fail_closed"
  ): Promise<ResearchControlStudyExecutionLeaseRecord | undefined> {
    for (let attempt = 0; attempt < MAX_INCOMPLETE_CLAIM_READS; attempt += 1) {
      try {
        const lease = JSON.parse(await readFile(file, "utf8")) as unknown;
        if (!researchControlStudyExecutionLeaseHasRuntimeShape(lease) ||
          lease.lease_status !== expectedStatus) {
          throw corruptState("persisted lease state is malformed or digest-drifted");
        }
        return lease;
      } catch (error) {
        if (error instanceof ResearchControlStudyExecutionLeaseStoreError) throw error;
        if (!isErrno(error, "ENOENT")) {
          throw corruptState("persisted lease state is unreadable", error);
        }
        if (!await pathExists(directory)) return undefined;
        await waitForClaimWrite();
      }
    }
    if (incompleteClaimPolicy === "recover_empty_claim" &&
      await this.recoverEmptyClaimDirectory(directory)) {
      return undefined;
    }
    throw corruptState("lease lock directory has no readable record");
  }

  private async recoverEmptyClaimDirectory(directory: string): Promise<boolean> {
    const abandoned = `${directory}.incomplete-${process.pid}-${randomUUID()}`;
    try {
      await rename(directory, abandoned);
    } catch (error) {
      if (isErrno(error, "ENOENT")) return true;
      throw error;
    }
    const entries = await readdir(abandoned);
    if (entries.length === 0) {
      await rm(abandoned, { recursive: true, force: true });
      return true;
    }
    try {
      await rename(abandoned, directory);
    } catch (error) {
      throw corruptState(
        "incomplete lease claim changed while recovery was attempted",
        error
      );
    }
    return false;
  }

  private async readOptionalHistory(
    source: ResearchControlStudyExecutionLeaseRecord
  ): Promise<ResearchControlStudyExecutionLeaseRecord | undefined> {
    const file = this.historyFile(
      source.research_control_study_execution_lease_id
    );
    try {
      return await this.readHistoryFile(file);
    } catch (error) {
      if (isErrno(error, "ENOENT")) return undefined;
      throw error;
    }
  }

  private async readHistoryFile(
    file: string
  ): Promise<ResearchControlStudyExecutionLeaseRecord> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (isErrno(error, "ENOENT")) throw error;
      throw corruptState("terminal lease history is unreadable", error);
    }
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(value) ||
      value.lease_status === "active") {
      throw corruptState("terminal lease history is malformed or digest-drifted");
    }
    return value;
  }

  private async writeAtomicLease(
    file: string,
    lease: ResearchControlStudyExecutionLeaseRecord
  ): Promise<void> {
    const temporary = path.join(
      path.dirname(file),
      `.lease-${process.pid}-${randomUUID()}.tmp`
    );
    try {
      await writeFile(temporary, serialize(lease), {
        encoding: "utf8",
        flag: "wx"
      });
      await rename(temporary, file);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async readOwnerLiveness(
    owner: ResearchControlStudyExecutionLeaseOwner
  ): Promise<ResearchControlStudyExecutionLeaseOwnerLiveness> {
    let liveness: ResearchControlStudyExecutionLeaseOwnerLiveness;
    try {
      liveness = await this.ownerLiveness({ ...owner });
    } catch {
      return "unknown";
    }
    return liveness === "alive" || liveness === "absent" || liveness === "unknown"
      ? liveness
      : "unknown";
  }

  private assertStudyBinding(
    lease: ResearchControlStudyExecutionLeaseRecord,
    study: ResearchControlStudyRecord
  ): void {
    if (lease.study_ref.id !== study.research_control_study_id ||
      lease.study_digest !== study.study_digest) {
      throw corruptState("lease state is bound to another ResearchControlStudy");
    }
  }

  private readNow(): string {
    const now = this.now();
    if (typeof now !== "string" || !now.trim() || now.trim() !== now ||
      !Number.isFinite(Date.parse(now)) ||
      new Date(Date.parse(now)).toISOString() !== now) {
      throw invalidInput("lease clock must return an exact ISO instant");
    }
    return now;
  }

  private pathsFor(
    study: ResearchControlStudyRecord
  ): ResearchControlStudyExecutionLeasePaths {
    return this.pathsForStudyId(study.research_control_study_id);
  }

  private pathsForLease(
    lease: ResearchControlStudyExecutionLeaseRecord
  ): ResearchControlStudyExecutionLeasePaths {
    return this.pathsForStudyId(lease.study_ref.id);
  }

  private pathsForStudyId(studyId: string): ResearchControlStudyExecutionLeasePaths {
    const key = createHash("sha256").update(studyId).digest("hex");
    const base = path.join(this.root, "research-control-study-execution-leases");
    const activeDir = path.join(base, "active", `${key}.lock`);
    const transitionDir = path.join(base, "transitions", `${key}.lock`);
    return {
      activeDir,
      activeFile: path.join(activeDir, "lease.json"),
      transitionDir,
      transitionFile: path.join(transitionDir, "lease.json")
    };
  }

  private historyFile(leaseId: string): string {
    return path.join(
      this.root,
      "research-control-study-execution-leases",
      "history",
      "items",
      `${encodeURIComponent(leaseId)}.json`
    );
  }

  private async ensureLayout(): Promise<void> {
    const base = path.join(this.root, "research-control-study-execution-leases");
    await Promise.all([
      mkdir(path.join(base, "active"), { recursive: true }),
      mkdir(path.join(base, "transitions"), { recursive: true }),
      mkdir(path.join(base, "history", "items"), { recursive: true })
    ]);
  }
}

export async function researchControlStudyExecutionLeaseOwnerLiveness(
  owner: ResearchControlStudyExecutionLeaseOwner
): Promise<ResearchControlStudyExecutionLeaseOwnerLiveness> {
  if (!exactOwner(owner) || owner.host_id !== os.hostname()) return "unknown";
  try {
    process.kill(owner.process_id, 0);
    return "alive";
  } catch (error) {
    if (isErrno(error, "ESRCH")) return "absent";
    if (isErrno(error, "EPERM")) return "alive";
    return "unknown";
  }
}

function exactStudy(value: unknown): value is ResearchControlStudyRecord {
  if (!researchControlStudyHasRuntimeShape(value)) return false;
  return value.condition.condition_digest === exactDigest(
    researchControlStudyConditionDigestInput(value.condition)
  ) && value.study_digest === exactDigest(researchControlStudyDigestInput(value));
}

function exactOwner(value: unknown): value is ResearchControlStudyExecutionLeaseOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  return Object.keys(owner).length === 3 &&
    Object.hasOwn(owner, "server_instance_id") &&
    Object.hasOwn(owner, "host_id") && Object.hasOwn(owner, "process_id") &&
    canonicalString(owner.server_instance_id) && canonicalString(owner.host_id) &&
    typeof owner.process_id === "number" &&
    Number.isSafeInteger(owner.process_id) && owner.process_id > 0;
}

function canonicalString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.trim() === value;
}

function exactDigest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sameLeaseIdentity(
  left: ResearchControlStudyExecutionLeaseRecord,
  right: ResearchControlStudyExecutionLeaseRecord
): boolean {
  return left.research_control_study_execution_lease_id ===
      right.research_control_study_execution_lease_id &&
    left.study_ref.id === right.study_ref.id &&
    left.study_digest === right.study_digest &&
    left.lease_token === right.lease_token &&
    isDeepStrictEqual(left.owner, right.owner);
}

function sameLeaseSource(
  terminal: ResearchControlStudyExecutionLeaseRecord,
  active: ResearchControlStudyExecutionLeaseRecord
): boolean {
  return sameLeaseIdentity(terminal, active) &&
    terminal.lease_duration_ms === active.lease_duration_ms &&
    terminal.acquired_at === active.acquired_at &&
    terminal.renewed_at === active.renewed_at &&
    terminal.expires_at === active.expires_at;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (isErrno(error, "ENOENT")) return false;
    throw error;
  }
}

async function waitForClaimWrite(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 1);
    timer.unref?.();
  });
}

function isErrno(error: unknown, code: string): boolean {
  return error !== null && typeof error === "object" &&
    (error as NodeJS.ErrnoException).code === code;
}

function isExistingPathError(error: unknown): boolean {
  return isErrno(error, "EEXIST") || isErrno(error, "ENOTEMPTY");
}

function invalidInput(message: string, cause?: unknown):
  ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "invalid_research_control_study_execution_lease_store_input",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function corruptState(message: string, cause?: unknown):
  ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "research_control_study_execution_lease_state_corrupt",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function ownershipLost(message: string):
  ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "research_control_study_execution_lease_ownership_lost",
    message
  );
}
