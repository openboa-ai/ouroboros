import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import type {
  ResearchControlStudyExecutionLeaseAcquireResult,
  ResearchControlStudyExecutionLeasePort
} from "@ouroboros/application/ports/research-control-study-execution-lease";
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
import {
  parsePersistedResearchControlStudyExecutionLease,
  ResearchControlStudyExecutionLeaseStoreError,
  researchControlStudyExecutionLeaseOwnerLiveness,
  type ResearchControlStudyExecutionLeaseOwnerLiveness
} from
  "./research-control-study-execution-lease-store";

export interface SharedSqliteResearchControlStudyExecutionLeaseStoreOptions {
  now?: () => string;
  leaseToken?: () => string;
  ownerLiveness?: (
    owner: ResearchControlStudyExecutionLeaseOwner
  ) => Promise<ResearchControlStudyExecutionLeaseOwnerLiveness>;
  transactionTimeoutMs?: number;
  transactionRetryMs?: number;
}

interface FenceStateRow {
  study_id: string;
  study_digest: string;
  last_fencing_token: number;
  active_lease_json: string | null;
}

const DEFAULT_TRANSACTION_TIMEOUT_MS = 5_000;
const DEFAULT_TRANSACTION_RETRY_MS = 5;

class FencedWriteCallbackFailure {
  constructor(readonly cause: unknown) {}
}

export class SharedSqliteResearchControlStudyExecutionLeaseStore
implements ResearchControlStudyExecutionLeasePort {
  private readonly databaseFile: string;
  private readonly now: () => string;
  private readonly leaseToken: () => string;
  private readonly ownerLiveness: (
    owner: ResearchControlStudyExecutionLeaseOwner
  ) => Promise<ResearchControlStudyExecutionLeaseOwnerLiveness>;
  private readonly transactionTimeoutMs: number;
  private readonly transactionRetryMs: number;

  constructor(
    private readonly root: string,
    options: SharedSqliteResearchControlStudyExecutionLeaseStoreOptions = {}
  ) {
    if (!canonicalString(root)) {
      throw invalidInput("shared fence root must be a canonical non-empty path");
    }
    this.databaseFile = path.join(
      path.resolve(root),
      "research-control-study-execution-leases",
      "shared-fence.sqlite"
    );
    this.now = options.now ?? (() => new Date().toISOString());
    this.leaseToken = options.leaseToken ?? (() => randomUUID());
    this.ownerLiveness = options.ownerLiveness ??
      researchControlStudyExecutionLeaseOwnerLiveness;
    this.transactionTimeoutMs = options.transactionTimeoutMs ??
      DEFAULT_TRANSACTION_TIMEOUT_MS;
    this.transactionRetryMs = options.transactionRetryMs ??
      DEFAULT_TRANSACTION_RETRY_MS;
    if (!positiveInteger(this.transactionTimeoutMs) ||
      !positiveInteger(this.transactionRetryMs) ||
      this.transactionRetryMs > this.transactionTimeoutMs) {
      throw invalidInput("shared fence transaction bounds are invalid");
    }
  }

  async acquire(input: {
    study: ResearchControlStudyRecord;
    owner: ResearchControlStudyExecutionLeaseOwner;
    leaseDurationMs: number;
  }): Promise<ResearchControlStudyExecutionLeaseAcquireResult> {
    if (!exactStudy(input?.study) || !exactOwner(input?.owner) ||
      !positiveInteger(input?.leaseDurationMs)) {
      throw invalidInput("shared fence acquisition input is invalid");
    }
    const legacyActive = await this.readLegacyActiveLease(input.study);
    if (legacyActive) {
      if (Date.parse(this.readNow()) < Date.parse(legacyActive.expires_at)) {
        return { status: "held", lease: legacyActive, reason: "transition" };
      }
      await rm(path.dirname(this.legacyActiveLeaseFile(input.study)), {
        recursive: true,
        force: true
      });
    }
    const legacyTransition = await this.readLegacyTransitionLease(input.study);
    if (legacyTransition) {
      if (Date.parse(this.readNow()) < Date.parse(legacyTransition.expires_at) ||
        await this.readOwnerLiveness(legacyTransition.owner) !== "absent") {
        return { status: "held", lease: legacyTransition, reason: "transition" };
      }
      await rm(path.dirname(this.legacyLeaseFile(input.study, "transitions")), {
        recursive: true,
        force: true
      });
    }
    return this.transaction(async (database) => {
      const now = this.readNow();
      const state = this.loadOrCreateState(database, input.study);
      const active = activeLease(state);
      if (active && Date.parse(now) < Date.parse(active.expires_at)) {
        return { status: "held", lease: active, reason: "lease_unexpired" };
      }
      if (active) {
        this.archive(database, closeResearchControlStudyExecutionLease({
          lease: active,
          leaseStatus: "expired",
          closeReason: "expired_fenced_takeover",
          closedAt: now
        }));
      }
      const fencingToken = state.last_fencing_token + 1;
      if (!Number.isSafeInteger(fencingToken)) {
        throw corruptState("shared fence token is exhausted");
      }
      let lease: ResearchControlStudyExecutionLeaseRecord;
      try {
        lease = decideResearchControlStudyExecutionLease({
          study: input.study,
          owner: input.owner,
          leaseToken: this.leaseToken(),
          fencingToken,
          leaseDurationMs: input.leaseDurationMs,
          acquiredAt: now
        });
      } catch (error) {
        throw invalidInput("shared fence acquisition decision is invalid", error);
      }
      const changed = database.prepare(`
        UPDATE research_control_study_execution_fences
        SET last_fencing_token = ?, active_lease_json = ?
        WHERE study_id = ? AND study_digest = ?
      `).run(
        fencingToken,
        serialize(lease),
        input.study.research_control_study_id,
        input.study.study_digest
      ).changes;
      if (changed !== 1) throw corruptState("shared fence state changed unexpectedly");
      return { status: "acquired", lease };
    });
  }

  async renew(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveInput(input?.lease);
    return this.transaction(async (database) => {
      const active = this.requireOwned(database, input.lease, this.readNow());
      let renewed: ResearchControlStudyExecutionLeaseRecord;
      try {
        renewed = renewResearchControlStudyExecutionLease({
          lease: active,
          renewedAt: this.readNow()
        });
      } catch (error) {
        throw ownershipLost("shared fence cannot renew an expired lease", error);
      }
      this.updateActive(database, renewed);
      return renewed;
    });
  }

  async assertOwned(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveInput(input?.lease);
    return this.transaction(async (database) =>
      this.requireOwned(database, input.lease, this.readNow()));
  }

  async withFencedWrite<T>(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
    write: () => Promise<T>;
  }): Promise<T> {
    this.assertActiveInput(input?.lease);
    if (typeof input?.write !== "function") {
      throw invalidInput("shared fence write callback is required");
    }
    return this.transaction(async (database) => {
      this.requireOwned(database, input.lease, this.readNow());
      try {
        return await input.write();
      } catch (error) {
        throw new FencedWriteCallbackFailure(error);
      }
    });
  }

  async release(input: {
    lease: ResearchControlStudyExecutionLeaseRecord;
  }): Promise<ResearchControlStudyExecutionLeaseRecord> {
    this.assertActiveInput(input?.lease);
    return this.transaction(async (database) => {
      const state = this.loadState(database, input.lease.study_ref.id);
      if (!state) throw ownershipLost("shared fence state does not exist");
      const active = activeLease(state);
      if (!active) {
        const existing = this.loadHistoryByLeaseId(
          database,
          input.lease.research_control_study_execution_lease_id
        );
        if (existing?.lease_status === "released" &&
          sameLeaseSource(existing, input.lease)) {
          return existing;
        }
        throw ownershipLost("shared fence no longer has this active owner");
      }
      if (!sameLeaseIdentity(active, input.lease)) {
        throw ownershipLost("shared fence active owner changed before release");
      }
      let released: ResearchControlStudyExecutionLeaseRecord;
      try {
        released = closeResearchControlStudyExecutionLease({
          lease: active,
          leaseStatus: "released",
          closedAt: this.readNow()
        });
      } catch (error) {
        throw invalidInput("shared fence release time is invalid", error);
      }
      this.archive(database, released);
      const changed = database.prepare(`
        UPDATE research_control_study_execution_fences
        SET active_lease_json = NULL
        WHERE study_id = ? AND study_digest = ?
      `).run(active.study_ref.id, active.study_digest).changes;
      if (changed !== 1) throw corruptState("shared fence release was not persisted");
      return released;
    });
  }

  async listHistory(
    studyId: string
  ): Promise<ResearchControlStudyExecutionLeaseRecord[]> {
    if (!canonicalString(studyId)) {
      throw invalidInput("shared fence history requires one exact study ID");
    }
    return this.transaction(async (database) => {
      const rows = database.prepare(`
        SELECT study_id, fencing_token, lease_json
        FROM research_control_study_execution_lease_history
        WHERE study_id = ?
        ORDER BY fencing_token ASC
      `).all(studyId) as unknown as HistoryRow[];
      return rows.map((row) => parseHistoryRow(row, studyId));
    });
  }

  private loadOrCreateState(
    database: DatabaseSync,
    study: ResearchControlStudyRecord
  ): FenceStateRow {
    const existing = this.loadState(database, study.research_control_study_id);
    if (existing) {
      if (existing.study_digest !== study.study_digest) {
        throw corruptState("shared fence is bound to a different study digest");
      }
      return existing;
    }
    database.prepare(`
      INSERT INTO research_control_study_execution_fences (
        study_id, study_digest, last_fencing_token, active_lease_json
      ) VALUES (?, ?, 0, NULL)
    `).run(study.research_control_study_id, study.study_digest);
    return {
      study_id: study.research_control_study_id,
      study_digest: study.study_digest,
      last_fencing_token: 0,
      active_lease_json: null
    };
  }

  private loadState(
    database: DatabaseSync,
    studyId: string
  ): FenceStateRow | undefined {
    const row = database.prepare(`
      SELECT study_id, study_digest, last_fencing_token, active_lease_json
      FROM research_control_study_execution_fences
      WHERE study_id = ?
    `).get(studyId) as FenceStateRow | undefined;
    if (!row) return undefined;
    if (row.study_id !== studyId || !canonicalString(row.study_id) ||
      !canonicalString(row.study_digest) ||
      !Number.isSafeInteger(row.last_fencing_token) ||
      row.last_fencing_token < 0 ||
      row.active_lease_json !== null &&
        typeof row.active_lease_json !== "string") {
      throw corruptState("shared fence state is malformed");
    }
    const active = activeLease(row);
    if (active && (active.study_ref.id !== row.study_id ||
      active.study_digest !== row.study_digest ||
      active.fencing_token !== row.last_fencing_token)) {
      throw corruptState("shared fence active state differs from its bound study or token");
    }
    return row;
  }

  private requireOwned(
    database: DatabaseSync,
    expected: ResearchControlStudyExecutionLeaseRecord,
    now: string
  ): ResearchControlStudyExecutionLeaseRecord {
    const state = this.loadState(database, expected.study_ref.id);
    const active = state && activeLease(state);
    if (!active || !sameLeaseIdentity(active, expected)) {
      throw ownershipLost("shared fence token or owner no longer matches");
    }
    if (Date.parse(now) >= Date.parse(active.expires_at)) {
      throw ownershipLost("shared fence lease has expired");
    }
    return active;
  }

  private updateActive(
    database: DatabaseSync,
    lease: ResearchControlStudyExecutionLeaseRecord
  ): void {
    const changed = database.prepare(`
      UPDATE research_control_study_execution_fences
      SET active_lease_json = ?
      WHERE study_id = ? AND study_digest = ? AND last_fencing_token = ?
    `).run(
      serialize(lease),
      lease.study_ref.id,
      lease.study_digest,
      lease.fencing_token
    ).changes;
    if (changed !== 1) throw ownershipLost("shared fence changed during renewal");
  }

  private archive(
    database: DatabaseSync,
    lease: ResearchControlStudyExecutionLeaseRecord
  ): void {
    if (lease.lease_status === "active") {
      throw corruptState("shared fence cannot archive an active lease");
    }
    const result = database.prepare(`
      INSERT OR IGNORE INTO research_control_study_execution_lease_history (
        lease_id, study_id, fencing_token, lease_json
      ) VALUES (?, ?, ?, ?)
    `).run(
      lease.research_control_study_execution_lease_id,
      lease.study_ref.id,
      lease.fencing_token,
      serialize(lease)
    );
    if (result.changes === 1) return;
    const existing = this.loadHistoryByLeaseId(
      database,
      lease.research_control_study_execution_lease_id
    );
    if (!existing || !isDeepStrictEqual(existing, lease)) {
      throw corruptState("shared fence terminal history is immutable");
    }
  }

  private loadHistoryByLeaseId(
    database: DatabaseSync,
    leaseId: string
  ): ResearchControlStudyExecutionLeaseRecord | undefined {
    const row = database.prepare(`
      SELECT study_id, fencing_token, lease_json
      FROM research_control_study_execution_lease_history
      WHERE lease_id = ?
    `).get(leaseId) as HistoryRow | undefined;
    return row ? parseHistoryRow(row) : undefined;
  }

  private assertActiveInput(
    lease: ResearchControlStudyExecutionLeaseRecord
  ): void {
    if (!researchControlStudyExecutionLeaseHasRuntimeShape(lease) ||
      lease.lease_status !== "active") {
      throw invalidInput("shared fence requires one exact active lease");
    }
  }

  private async readLegacyActiveLease(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyExecutionLeaseRecord | undefined> {
    return this.readLegacyLease(study, "active");
  }

  private async readLegacyTransitionLease(
    study: ResearchControlStudyRecord
  ): Promise<ResearchControlStudyExecutionLeaseRecord | undefined> {
    return this.readLegacyLease(study, "transitions");
  }

  private async readLegacyLease(
    study: ResearchControlStudyRecord,
    state: "active" | "transitions"
  ): Promise<ResearchControlStudyExecutionLeaseRecord | undefined> {
    const file = this.legacyLeaseFile(study, state);
    let serialized: string;
    try {
      serialized = await readFile(file, "utf8");
    } catch (error) {
      if (isErrno(error, "ENOENT")) return undefined;
      throw unavailable("legacy filesystem fence is unavailable", error);
    }
    const label = `legacy filesystem ${state} fence`;
    const lease = parseLegacyLease(serialized, label);
    if (lease.lease_status !== "active" ||
      lease.study_ref.id !== study.research_control_study_id ||
      lease.study_digest !== study.study_digest) {
      throw corruptState(
        `legacy filesystem ${state} fence differs from its bound study`
      );
    }
    return lease;
  }

  private legacyActiveLeaseFile(study: ResearchControlStudyRecord): string {
    return this.legacyLeaseFile(study, "active");
  }

  private legacyLeaseFile(
    study: ResearchControlStudyRecord,
    state: "active" | "transitions"
  ): string {
    const key = createHash("sha256")
      .update(study.research_control_study_id)
      .digest("hex");
    return path.join(
      path.resolve(this.root),
      "research-control-study-execution-leases",
      state,
      `${key}.lock`,
      "lease.json"
    );
  }

  private readNow(): string {
    const value = this.now();
    if (!canonicalString(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(Date.parse(value)).toISOString() !== value) {
      throw invalidInput("shared fence clock must return an exact ISO instant");
    }
    return value;
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

  private async transaction<T>(
    operation: (database: DatabaseSync) => Promise<T>
  ): Promise<T> {
    await mkdir(path.dirname(this.databaseFile), { recursive: true });
    const deadline = Date.now() + this.transactionTimeoutMs;
    while (true) {
      let database: DatabaseSync | undefined;
      try {
        const sqlite = await import("node:sqlite");
        database = new sqlite.DatabaseSync(this.databaseFile);
        configureDatabase(database);
        database.exec("BEGIN IMMEDIATE;");
      } catch (error) {
        try { database?.close(); } catch { /* best-effort failed open cleanup */ }
        if (sqliteBusy(error) && Date.now() < deadline) {
          await sleep(this.transactionRetryMs);
          continue;
        }
        throw unavailable("shared fence transaction is unavailable", error);
      }
      try {
        ensureSchema(database);
        const result = await operation(database);
        database.exec("COMMIT;");
        return result;
      } catch (error) {
        try { database.exec("ROLLBACK;"); } catch { /* preserve original error */ }
        if (error instanceof FencedWriteCallbackFailure) throw error.cause;
        if (error instanceof ResearchControlStudyExecutionLeaseStoreError) {
          throw error;
        }
        throw unavailable("shared fence transaction failed", error);
      } finally {
        database.close();
      }
    }
  }
}

function ensureSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS research_control_study_execution_fences (
      study_id TEXT PRIMARY KEY,
      study_digest TEXT NOT NULL,
      last_fencing_token INTEGER NOT NULL,
      active_lease_json TEXT
    );
    CREATE TABLE IF NOT EXISTS research_control_study_execution_lease_history (
      lease_id TEXT PRIMARY KEY,
      study_id TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      lease_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS research_control_study_execution_lease_history_study
      ON research_control_study_execution_lease_history(study_id, fencing_token);
    CREATE UNIQUE INDEX IF NOT EXISTS research_control_study_execution_lease_history_token
      ON research_control_study_execution_lease_history(study_id, fencing_token);
  `);
}

interface HistoryRow {
  study_id: string;
  fencing_token: number;
  lease_json: string;
}

function configureDatabase(database: DatabaseSync): void {
  const journalMode = firstPragmaValue(
    database.prepare("PRAGMA journal_mode = DELETE").get()
  );
  database.exec("PRAGMA busy_timeout = 0; PRAGMA synchronous = FULL;");
  const synchronous = firstPragmaValue(
    database.prepare("PRAGMA synchronous").get()
  );
  if (String(journalMode).toLowerCase() !== "delete" || synchronous !== 2) {
    throw new Error("shared fence SQLite durability mode is unavailable");
  }
}

function firstPragmaValue(row: unknown): unknown {
  return row && typeof row === "object"
    ? Object.values(row as Record<string, unknown>)[0]
    : undefined;
}

function activeLease(
  row: FenceStateRow
): ResearchControlStudyExecutionLeaseRecord | undefined {
  if (row.active_lease_json === null) return undefined;
  const lease = parseLease(row.active_lease_json, "shared fence active state");
  if (lease.lease_status !== "active") {
    throw corruptState("shared fence active state is terminal");
  }
  return lease;
}

function parseLease(
  value: string,
  label: string
): ResearchControlStudyExecutionLeaseRecord {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch (error) {
    throw corruptState(`${label} is unreadable`, error);
  }
  if (!researchControlStudyExecutionLeaseHasRuntimeShape(parsed)) {
    throw corruptState(`${label} is malformed or digest-drifted`);
  }
  return parsed;
}

function parseLegacyLease(
  value: string,
  label: string
): ResearchControlStudyExecutionLeaseRecord {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch (error) {
    throw corruptState(`${label} is unreadable`, error);
  }
  const { lease } = parsePersistedResearchControlStudyExecutionLease(
    parsed,
    label
  );
  if (lease.lease_status !== "active") {
    throw corruptState(`${label} is terminal`);
  }
  return lease;
}

function parseHistoryRow(
  row: HistoryRow,
  expectedStudyId?: string
): ResearchControlStudyExecutionLeaseRecord {
  const lease = parseLease(row.lease_json, "shared fence history");
  if (!canonicalString(row.study_id) || !positiveInteger(row.fencing_token) ||
    lease.lease_status === "active" || lease.study_ref.id !== row.study_id ||
    lease.fencing_token !== row.fencing_token ||
    expectedStudyId !== undefined && row.study_id !== expectedStudyId) {
    throw corruptState("shared fence history differs from its indexed identity");
  }
  return lease;
}

function exactStudy(value: unknown): value is ResearchControlStudyRecord {
  return researchControlStudyHasRuntimeShape(value) &&
    value.condition.condition_digest === digest(
      researchControlStudyConditionDigestInput(value.condition)
    ) && value.study_digest === digest(researchControlStudyDigestInput(value));
}

function exactOwner(
  value: unknown
): value is ResearchControlStudyExecutionLeaseOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  return Object.keys(owner).length === 4 &&
    canonicalString(owner.server_instance_id) &&
    canonicalString(owner.host_id) && positiveInteger(owner.process_id) &&
    canonicalString(owner.process_start_marker);
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
    left.fencing_token === right.fencing_token &&
    left.lease_duration_ms === right.lease_duration_ms &&
    left.acquired_at === right.acquired_at &&
    isDeepStrictEqual(left.owner, right.owner);
}

function sameLeaseSource(
  terminal: ResearchControlStudyExecutionLeaseRecord,
  active: ResearchControlStudyExecutionLeaseRecord
): boolean {
  return sameLeaseIdentity(terminal, active) &&
    terminal.renewed_at === active.renewed_at &&
    terminal.expires_at === active.expires_at;
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function canonicalString(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.trim() === value;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function sqliteBusy(error: unknown): boolean {
  return error instanceof Error && /(?:busy|locked)/i.test(error.message);
}

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error &&
    (error as NodeJS.ErrnoException).code === code;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function invalidInput(
  message: string,
  cause?: unknown
): ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "invalid_research_control_study_execution_lease_store_input",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function corruptState(
  message: string,
  cause?: unknown
): ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "research_control_study_execution_lease_state_corrupt",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function ownershipLost(
  message: string,
  cause?: unknown
): ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "research_control_study_execution_lease_ownership_lost",
    message,
    cause === undefined ? undefined : { cause }
  );
}

function unavailable(
  message: string,
  cause: unknown
): ResearchControlStudyExecutionLeaseStoreError {
  return new ResearchControlStudyExecutionLeaseStoreError(
    "research_control_study_execution_fence_unavailable",
    message,
    { cause }
  );
}
