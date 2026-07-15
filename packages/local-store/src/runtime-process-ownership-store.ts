import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adoptRuntimeProcessOwnership,
  closeRuntimeProcessOwnership,
  createRuntimeProcessOwnership,
  runtimeProcessOwnershipHasRuntimeShape,
  type RuntimeProcessOwnershipRecord,
  type RuntimeProcessTerminalReason
} from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort,
  RuntimeProcessOwnershipReconcileResult
} from "@ouroboros/application/ports/runtime-process-ownership";
import {
  currentProcessStartMarker,
  processStartMarker as readProcessStartMarker
} from "./process-start-marker";

export type RuntimeProcessOwnerLiveness = "alive" | "absent" | "reused" | "unknown";
export type RuntimeProcessOwnershipStoreErrorCode =
  | "runtime_process_ownership_held"
  | "runtime_process_ownership_conflict"
  | "runtime_process_ownership_metadata_invalid"
  | "runtime_process_ownership_transition_blocked"
  | "runtime_process_termination_failed";

export class RuntimeProcessOwnershipStoreError extends Error {
  constructor(readonly code: RuntimeProcessOwnershipStoreErrorCode, message: string) {
    super(message);
    this.name = "RuntimeProcessOwnershipStoreError";
  }
}

export interface FileSystemRuntimeProcessOwnershipStoreOptions {
  inspectOwner?: (record: RuntimeProcessOwnershipRecord) => Promise<RuntimeProcessOwnerLiveness>;
  terminateOwner?: (record: RuntimeProcessOwnershipRecord) => Promise<void>;
  resolveProcessStartMarker?: (pid: number) => Promise<string | undefined>;
  now?: () => string;
  lockRetryMs?: number;
  lockAttempts?: number;
  beforeStaleLockRetirement?: (owner: Readonly<LockOwner>) => Promise<void>;
}

type Scope = Pick<RuntimeProcessExpectedIdentity, "process_kind" | "subject_ref">;
type ActiveState =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "valid"; record: RuntimeProcessOwnershipRecord };
interface LockOwner { process_id: number; process_start_marker: string; token: string }

export class FileSystemRuntimeProcessOwnershipStore implements RuntimeProcessOwnershipPort {
  constructor(
    private readonly root: string,
    private readonly options: FileSystemRuntimeProcessOwnershipStoreOptions = {}
  ) {}

  async active(scope: Scope): Promise<RuntimeProcessOwnershipRecord | undefined> {
    const state = await this.readActive(scope);
    if (state.status === "missing") return undefined;
    if (state.status === "invalid") throw failure(
      "runtime_process_ownership_metadata_invalid",
      "Active runtime process ownership metadata is invalid."
    );
    return state.record;
  }

  async claim(input: {
    expected: RuntimeProcessExpectedIdentity;
    processId: number;
    sessionToken: string;
    startedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    return this.locked(input.expected, async () => {
      const state = await this.readActive(input.expected);
      if (state.status === "invalid") throw failure(
        "runtime_process_ownership_metadata_invalid",
        "Active runtime process ownership metadata is invalid."
      );
      if (state.status === "valid") {
        const live = await this.inspect(state.record);
        if (live === "alive" || live === "unknown") throw failure(
          "runtime_process_ownership_held",
          "A runtime process ownership record is already active."
        );
        await this.retire(input.expected, state.record, live, input.startedAt);
      }
      const marker = await (this.options.resolveProcessStartMarker ?? readProcessStartMarker)(
        input.processId
      );
      if (!marker) throw failure(
        "runtime_process_ownership_metadata_invalid",
        "Runtime process start identity is unavailable."
      );
      const record = createRuntimeProcessOwnership({
        processKind: input.expected.process_kind,
        subjectRef: input.expected.subject_ref,
        runtimeRef: input.expected.runtime_ref,
        owner: {
          host_id: input.expected.host_id,
          process_id: input.processId,
          process_start_marker: marker
        },
        executable: input.expected.executable,
        profileDigest: input.expected.profile_digest,
        sessionToken: input.sessionToken,
        startedAt: input.startedAt
      });
      await this.append(input.expected, record);
      await this.writeActive(input.expected, record);
      return record;
    });
  }

  async reconcile(input: {
    expected: RuntimeProcessExpectedIdentity;
    mode: "adopt" | "terminate";
    reconciledAt: string;
  }): Promise<RuntimeProcessOwnershipReconcileResult> {
    try {
      return await this.locked(input.expected, async () => {
        const state = await this.readActive(input.expected);
        if (state.status === "missing") return { status: "vacant" };
        if (state.status === "invalid") return blocked("ownership_metadata_invalid");
        const record = state.record;
        if (record.owner.host_id !== input.expected.host_id) {
          return blocked("host_mismatch", record);
        }
        const reconciledAt = this.reconciledAt(record, input.reconciledAt);
        const live = await this.inspect(record);
        if (live === "unknown") return blocked("owner_liveness_unknown", record);
        if (live !== "alive") {
          const previous = await this.retire(input.expected, record, live, reconciledAt);
          return { status: "vacant", previous };
        }
        if (input.mode === "adopt") {
          if (!sameIdentity(record, input.expected)) return blocked("identity_mismatch", record);
          const adopted = adoptRuntimeProcessOwnership({
            ownership: record,
            adoptedAt: reconciledAt
          });
          await this.writeActive(input.expected, adopted);
          await this.append(input.expected, adopted);
          return { status: "adopted", ownership: adopted };
        }
        await this.terminateOwner(record);
        return {
          status: "terminated",
          ownership: await this.terminal(
            input.expected,
            record,
            "restart_terminated",
            reconciledAt
          )
        };
      });
    } catch (error) {
      if (isFailure(error, "runtime_process_ownership_transition_blocked")) {
        return blocked("transition");
      }
      if (isFailure(error, "runtime_process_termination_failed")) {
        return blocked("termination_failed");
      }
      throw error;
    }
  }

  async close(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: RuntimeProcessTerminalReason;
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    const scope = identity(input.ownership);
    return this.locked(scope, async () => this.terminal(
      scope,
      await this.exact(input.ownership),
      input.terminalReason,
      input.closedAt
    ));
  }

  async terminate(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: "shutdown" | "restart_terminated" | "timed_out";
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    const scope = identity(input.ownership);
    return this.locked(scope, async () => {
      const record = await this.exact(input.ownership);
      const live = await this.inspect(record);
      if (live === "unknown") throw failure(
        "runtime_process_ownership_transition_blocked",
        "Runtime process owner liveness is unknown."
      );
      if (live === "alive") await this.terminateOwner(record);
      const reason = live === "reused"
        ? "pid_reused"
        : live === "absent" ? "owner_absent" : input.terminalReason;
      return this.terminal(scope, record, reason, input.closedAt);
    });
  }

  async history(scope: Scope): Promise<RuntimeProcessOwnershipRecord[]> {
    const dir = this.paths(scope).history;
    const files = await readdir(dir).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const records = await Promise.all(files.sort().map((file) => readRecord(path.join(dir, file))));
    if (records.some((record) => !record)) throw failure(
      "runtime_process_ownership_metadata_invalid",
      "Runtime process ownership history is invalid."
    );
    return records as RuntimeProcessOwnershipRecord[];
  }

  private inspect(record: RuntimeProcessOwnershipRecord): Promise<RuntimeProcessOwnerLiveness> {
    return (this.options.inspectOwner ?? inspectHostOwner)(record);
  }

  private async terminateOwner(record: RuntimeProcessOwnershipRecord): Promise<void> {
    try {
      await (this.options.terminateOwner ?? terminateHostOwner)(record);
    } catch (error) {
      throw failure(
        "runtime_process_termination_failed",
        error instanceof Error ? error.message : "Runtime process termination failed."
      );
    }
  }

  private reconciledAt(record: RuntimeProcessOwnershipRecord, requestedAt: string): string {
    const acquiredAt = this.options.now?.() ?? new Date().toISOString();
    if (!canonicalIso(requestedAt) || !canonicalIso(acquiredAt)) {
      throw failure(
        "runtime_process_ownership_transition_blocked",
        "Runtime process reconciliation time is invalid."
      );
    }
    return [
      record.last_adopted_at ?? record.started_at,
      requestedAt,
      acquiredAt
    ].reduce((latest, candidate) =>
      Date.parse(candidate) > Date.parse(latest) ? candidate : latest
    );
  }

  private async retire(
    scope: Scope,
    record: RuntimeProcessOwnershipRecord,
    live: "absent" | "reused",
    at: string
  ): Promise<RuntimeProcessOwnershipRecord> {
    return this.terminal(scope, record, live === "reused" ? "pid_reused" : "owner_absent", at);
  }

  private async terminal(
    scope: Scope,
    record: RuntimeProcessOwnershipRecord,
    reason: RuntimeProcessTerminalReason,
    at: string
  ): Promise<RuntimeProcessOwnershipRecord> {
    const existing = (await this.history(scope)).filter((candidate) =>
      candidate.ownership_status === "terminal" &&
      candidate.runtime_process_ownership_id === record.runtime_process_ownership_id
    );
    if (existing.length > 0) {
      if (existing.length !== 1 || !sameTransitionSource(existing[0]!, record)) {
        throw failure(
          "runtime_process_ownership_metadata_invalid",
          "Terminal runtime process ownership history conflicts with active state."
        );
      }
      await rm(this.paths(scope).active, { force: true });
      return existing[0]!;
    }
    const terminal = closeRuntimeProcessOwnership({
      ownership: record,
      terminalReason: reason,
      closedAt: at
    });
    await this.append(scope, terminal);
    await rm(this.paths(scope).active, { force: true });
    return terminal;
  }

  private async exact(expected: RuntimeProcessOwnershipRecord): Promise<RuntimeProcessOwnershipRecord> {
    const state = await this.readActive(expected);
    if (state.status !== "valid" ||
      state.record.session_token !== expected.session_token ||
      state.record.ownership_digest !== expected.ownership_digest) {
      throw failure(
        "runtime_process_ownership_conflict",
        "Runtime process ownership changed before transition."
      );
    }
    return state.record;
  }

  private async readActive(scope: Scope): Promise<ActiveState> {
    const loaded = await readState(this.paths(scope).active);
    if (loaded === "missing") return this.readOpenHistory(scope);
    if (loaded === "invalid") return { status: "invalid" };
    return loaded.process_kind === scope.process_kind &&
      sameRef(loaded.subject_ref, scope.subject_ref) &&
      loaded.ownership_status === "active"
      ? { status: "valid", record: loaded }
      : { status: "invalid" };
  }

  private async readOpenHistory(scope: Scope): Promise<ActiveState> {
    const records = await this.history(scope);
    const terminalIds = new Set(records.filter((record) =>
      record.ownership_status === "terminal"
    ).map((record) => record.runtime_process_ownership_id));
    const open = records.filter((record) =>
      record.ownership_status === "active" &&
      !terminalIds.has(record.runtime_process_ownership_id)
    );
    if (open.length === 0) return { status: "missing" };
    const ids = new Set(open.map((record) => record.runtime_process_ownership_id));
    if (ids.size !== 1) return { status: "invalid" };
    const ordered = open.sort((left, right) => left.adoption_count - right.adoption_count);
    const first = ordered[0]!;
    if (ordered.some((record, index) =>
      record.adoption_count !== index || !sameOwnershipLineage(record, first)
    )) {
      return { status: "invalid" };
    }
    return { status: "valid", record: ordered.at(-1)! };
  }

  private async writeActive(scope: Scope, record: RuntimeProcessOwnershipRecord): Promise<void> {
    const active = this.paths(scope).active;
    await mkdir(path.dirname(active), { recursive: true });
    const temporary = `${active}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    await rename(temporary, active);
  }

  private async append(scope: Scope, record: RuntimeProcessOwnershipRecord): Promise<void> {
    const dir = this.paths(scope).history;
    await mkdir(dir, { recursive: true });
    const sequence = String(record.adoption_count).padStart(6, "0");
    const state = record.ownership_status === "terminal"
      ? `terminal-${record.terminal_reason}`
      : record.adoption_count === 0 ? "claimed" : "adopted";
    const file = `${record.started_at.replace(/[:.]/g, "-")}-${sequence}-${state}-${record.runtime_process_ownership_id}.json`;
    await writeFile(path.join(dir, file), `${JSON.stringify(record)}\n`, {
      mode: 0o600,
      flag: "wx"
    });
  }

  private async locked<T>(scope: Scope, operation: () => Promise<T>): Promise<T> {
    const owner = await this.acquire(scope);
    try {
      return await operation();
    } finally {
      const lock = this.paths(scope).lock;
      const current = await readLock(lock);
      if (!current || current.token !== owner.token) throw failure(
        "runtime_process_ownership_conflict",
        "Runtime process ownership transition lock changed before release."
      );
      await rm(lock, { force: true });
    }
  }

  private async acquire(scope: Scope): Promise<LockOwner> {
    const lock = this.paths(scope).lock;
    await mkdir(path.dirname(lock), { recursive: true });
    const owner = {
      process_id: process.pid,
      process_start_marker: currentProcessStartMarker(),
      token: randomUUID()
    };
    for (let attempt = 0; attempt < (this.options.lockAttempts ?? 100); attempt += 1) {
      try {
        await writeFile(lock, `${JSON.stringify(owner)}\n`, { mode: 0o600, flag: "wx" });
        return owner;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const existing = await readLock(lock);
      if (!existing) break;
      const live = await inspectIdentity(existing);
      if (live === "absent" || live === "reused") {
        await this.options.beforeStaleLockRetirement?.(existing);
        if (!await this.retireStaleLock(lock, existing)) {
          await delay(this.options.lockRetryMs ?? 10);
        }
      } else if (live === "unknown") {
        break;
      } else {
        await delay(this.options.lockRetryMs ?? 10);
      }
    }
    throw failure(
      "runtime_process_ownership_transition_blocked",
      "Runtime process ownership transition is already active."
    );
  }

  private async retireStaleLock(lock: string, observed: LockOwner): Promise<boolean> {
    const retiredDir = `${lock}.retired`;
    await mkdir(retiredDir, { recursive: true });
    const tokenKey = createHash("sha256").update(observed.token).digest("hex");
    const tombstone = path.join(retiredDir, `${tokenKey}.lock`);
    // A token tombstone lets only one stale observer unlink the still-matching lock.
    try {
      await link(lock, tombstone);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return true;
      if (code === "EEXIST") return false;
      throw error;
    }
    const claimed = await readLock(tombstone);
    if (!claimed || claimed.token !== observed.token) return false;
    const current = await readLock(lock);
    if (!current) return true;
    if (current.token !== observed.token) return false;
    await rm(lock);
    return true;
  }

  private paths(scope: Scope): { active: string; history: string; lock: string } {
    const key = createHash("sha256").update([
      scope.process_kind,
      scope.subject_ref.record_kind,
      scope.subject_ref.id
    ].join(":")).digest("hex");
    return {
      active: path.join(this.root, "active", `${key}.json`),
      history: path.join(this.root, "history", key),
      lock: path.join(this.root, "locks", `${key}.lock`)
    };
  }
}

async function readState(file: string): Promise<"missing" | "invalid" | RuntimeProcessOwnershipRecord> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
  try {
    const parsed = JSON.parse(content) as unknown;
    return runtimeProcessOwnershipHasRuntimeShape(parsed) ? parsed : "invalid";
  } catch {
    return "invalid";
  }
}

async function readRecord(file: string): Promise<RuntimeProcessOwnershipRecord | undefined> {
  const state = await readState(file);
  return typeof state === "string" ? undefined : state;
}

async function readLock(file: string): Promise<LockOwner | undefined> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as Partial<LockOwner>;
    return Number.isSafeInteger(value.process_id) && Number(value.process_id) > 0 &&
      typeof value.process_start_marker === "string" && value.process_start_marker.length > 0 &&
      typeof value.token === "string" && value.token.length > 0
      ? value as LockOwner
      : undefined;
  } catch {
    return undefined;
  }
}

function identity(record: RuntimeProcessOwnershipRecord): RuntimeProcessExpectedIdentity {
  return {
    process_kind: record.process_kind,
    subject_ref: { ...record.subject_ref },
    runtime_ref: { ...record.runtime_ref },
    host_id: record.owner.host_id,
    executable: record.executable,
    profile_digest: record.profile_digest
  };
}

function sameIdentity(record: RuntimeProcessOwnershipRecord, expected: RuntimeProcessExpectedIdentity): boolean {
  return record.process_kind === expected.process_kind &&
    sameRef(record.subject_ref, expected.subject_ref) &&
    sameRef(record.runtime_ref, expected.runtime_ref) &&
    record.owner.host_id === expected.host_id &&
    record.executable === expected.executable &&
    record.profile_digest === expected.profile_digest;
}

function sameTransitionSource(
  terminal: RuntimeProcessOwnershipRecord,
  active: RuntimeProcessOwnershipRecord
): boolean {
  return sameOwnershipLineage(terminal, active) &&
    terminal.adoption_count === active.adoption_count &&
    terminal.last_adopted_at === active.last_adopted_at;
}

function sameOwnershipLineage(
  left: RuntimeProcessOwnershipRecord,
  right: RuntimeProcessOwnershipRecord
): boolean {
  return left.runtime_process_ownership_id === right.runtime_process_ownership_id &&
    left.process_kind === right.process_kind &&
    sameRef(left.subject_ref, right.subject_ref) &&
    sameRef(left.runtime_ref, right.runtime_ref) &&
    left.owner.host_id === right.owner.host_id &&
    left.owner.process_id === right.owner.process_id &&
    left.owner.process_start_marker === right.owner.process_start_marker &&
    left.executable === right.executable &&
    left.profile_digest === right.profile_digest &&
    left.session_token === right.session_token &&
    left.started_at === right.started_at;
}

function sameRef(left: { record_kind: string; id: string }, right: {
  record_kind: string;
  id: string;
}): boolean {
  return left.record_kind === right.record_kind && left.id === right.id;
}

function canonicalIso(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function blocked(
  reason: Extract<RuntimeProcessOwnershipReconcileResult, { status: "blocked" }>["reason"],
  ownership?: RuntimeProcessOwnershipRecord
): RuntimeProcessOwnershipReconcileResult {
  return { status: "blocked", reason, ...(ownership ? { ownership } : {}) };
}

async function inspectHostOwner(record: RuntimeProcessOwnershipRecord): Promise<RuntimeProcessOwnerLiveness> {
  return inspectIdentity({
    process_id: record.owner.process_id,
    process_start_marker: record.owner.process_start_marker,
    token: record.session_token
  });
}

async function inspectIdentity(owner: LockOwner): Promise<RuntimeProcessOwnerLiveness> {
  try {
    process.kill(owner.process_id, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH" ? "absent" : "unknown";
  }
  const marker = await readProcessStartMarker(owner.process_id);
  return !marker ? "unknown" : marker === owner.process_start_marker ? "alive" : "reused";
}

async function terminateHostOwner(record: RuntimeProcessOwnershipRecord): Promise<void> {
  const before = await inspectHostOwner(record);
  if (before === "absent") return;
  if (before !== "alive") throw new Error(`runtime_process_termination_identity_${before}`);
  signalTree(record.owner.process_id, "SIGTERM");
  if (!await waitForProcessTreeExit(record.owner.process_id, 500)) {
    signalTree(record.owner.process_id, "SIGKILL");
  }
  if (!await waitForProcessTreeExit(record.owner.process_id, 500)) {
    throw new Error("runtime_process_termination_failed");
  }
}

function signalTree(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // The owned process may not be a detached group leader.
  }
  try {
    process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error;
  }
}

function isProcessTreeAlive(pid: number): boolean {
  return isProcessAlive(-pid) || isProcessAlive(pid);
}

async function waitForProcessTreeExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessTreeAlive(pid)) return true;
    await delay(10);
  }
  return !isProcessTreeAlive(pid);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function isFailure(error: unknown, code: RuntimeProcessOwnershipStoreErrorCode): boolean {
  return error instanceof RuntimeProcessOwnershipStoreError && error.code === code;
}

function failure(
  code: RuntimeProcessOwnershipStoreErrorCode,
  message: string
): RuntimeProcessOwnershipStoreError {
  return new RuntimeProcessOwnershipStoreError(code, message);
}
