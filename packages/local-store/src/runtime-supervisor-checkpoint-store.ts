import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import type {
  RuntimeSupervisorCheckpointDraft,
  RuntimeSupervisorCheckpointRecord,
  RuntimeSupervisorLane,
  RuntimeSupervisorLaneReadModel,
  RuntimeSupervisorStatus
} from "@ouroboros/domain";
import type { RuntimeSupervisorCheckpointStorePort } from
  "@ouroboros/application/ports/runtime-supervisor";

const LANE_ORDER: RuntimeSupervisorLane[] = [
  "selected_paper",
  "candidate_arena",
  "research_control_study_scheduler"
];

export class RuntimeSupervisorCheckpointStoreError extends Error {
  constructor(
    readonly code:
      | "runtime_supervisor_checkpoint_metadata_invalid"
      | "runtime_supervisor_checkpoint_predecessor_conflict"
      | "runtime_supervisor_checkpoint_publication_conflict",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "RuntimeSupervisorCheckpointStoreError";
  }
}

export class FileSystemRuntimeSupervisorCheckpointStore
implements RuntimeSupervisorCheckpointStorePort {
  constructor(private readonly root: string) {}

  async latest(): Promise<RuntimeSupervisorCheckpointRecord | undefined> {
    return (await this.history()).at(-1);
  }

  async history(): Promise<RuntimeSupervisorCheckpointRecord[]> {
    const files = await readdir(this.checkpointDirectory).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    if (files.some((file) => !/^\d{12}\.json$/.test(file))) {
      throw invalid("Checkpoint directory contains an unexpected file.");
    }
    const records: RuntimeSupervisorCheckpointRecord[] = [];
    for (const file of files.sort()) {
      const record = await this.read(path.join(this.checkpointDirectory, file));
      const previous = records.at(-1);
      if (
        record.sequence !== records.length + 1 ||
        (previous
          ? record.previous_checkpoint_digest !== previous.checkpoint_digest
          : record.previous_checkpoint_digest !== undefined) ||
        (previous && Date.parse(record.recorded_at) < Date.parse(previous.recorded_at))
      ) {
        throw invalid("Runtime supervisor checkpoint chain is not linear.");
      }
      records.push(record);
    }
    return records;
  }

  async append(
    draft: RuntimeSupervisorCheckpointDraft,
    expectedPreviousDigest?: string
  ): Promise<RuntimeSupervisorCheckpointRecord> {
    await mkdir(this.checkpointDirectory, { recursive: true, mode: 0o700 });
    await mkdir(this.pendingDirectory, { recursive: true, mode: 0o700 });
    const history = await this.history();
    const previous = history.at(-1);
    if (previous?.checkpoint_digest !== expectedPreviousDigest) {
      throw new RuntimeSupervisorCheckpointStoreError(
        "runtime_supervisor_checkpoint_predecessor_conflict",
        "Runtime supervisor checkpoint predecessor changed before publication."
      );
    }
    const record = createCheckpoint(draft, history.length + 1, previous);
    const destination = path.join(
      this.checkpointDirectory,
      checkpointFile(record)
    );
    const temporary = path.join(
      this.pendingDirectory,
      `${process.pid}-${randomUUID()}.json`
    );
    try {
      await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx"
      });
      await link(temporary, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new RuntimeSupervisorCheckpointStoreError(
          "runtime_supervisor_checkpoint_publication_conflict",
          "Runtime supervisor checkpoint sequence already exists."
        );
      }
      throw error;
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    return structuredClone(record);
  }

  private async read(file: string): Promise<RuntimeSupervisorCheckpointRecord> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      throw invalid("Runtime supervisor checkpoint is unreadable.", error);
    }
    if (!checkpointHasRuntimeShape(value) ||
      value.checkpoint_digest !== checkpointDigest(value)) {
      throw invalid("Runtime supervisor checkpoint metadata is invalid.");
    }
    return structuredClone(value);
  }

  private get checkpointDirectory(): string {
    return path.join(this.root, "runtime-supervisor", "checkpoints");
  }

  private get pendingDirectory(): string {
    return path.join(this.root, "runtime-supervisor", "pending");
  }
}

function createCheckpoint(
  draft: RuntimeSupervisorCheckpointDraft,
  sequence: number,
  previous?: RuntimeSupervisorCheckpointRecord
): RuntimeSupervisorCheckpointRecord {
  const record: RuntimeSupervisorCheckpointRecord = {
    record_kind: "runtime_supervisor_checkpoint",
    version: 1,
    sequence,
    ...(previous
      ? { previous_checkpoint_digest: previous.checkpoint_digest }
      : {}),
    status: draft.status,
    lanes: structuredClone(draft.lanes),
    recorded_at: draft.recorded_at,
    checkpoint_digest: pendingDigest(),
    runtime_coordination_authority: true,
    evaluation_authority: false,
    policy_replacement_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "runtime_coordination_only"
  };
  record.checkpoint_digest = checkpointDigest(record);
  if (!checkpointHasRuntimeShape(record)) {
    throw invalid("Runtime supervisor checkpoint draft is invalid.");
  }
  return record;
}

function checkpointHasRuntimeShape(
  value: unknown
): value is RuntimeSupervisorCheckpointRecord {
  if (!object(value)) return false;
  const expectedKeys = [
    "record_kind",
    "version",
    "sequence",
    ...(value.previous_checkpoint_digest === undefined
      ? []
      : ["previous_checkpoint_digest"]),
    "status",
    "lanes",
    "recorded_at",
    "checkpoint_digest",
    "runtime_coordination_authority",
    "evaluation_authority",
    "policy_replacement_authority",
    "promotion_authority",
    "order_submission_authority",
    "live_exchange_authority",
    "authority_status"
  ];
  return exactKeys(value, expectedKeys) &&
    value.record_kind === "runtime_supervisor_checkpoint" &&
    value.version === 1 && positiveInteger(value.sequence) &&
    (value.previous_checkpoint_digest === undefined ||
      sha256Digest(value.previous_checkpoint_digest)) &&
    supervisorStatus(value.status) &&
    Array.isArray(value.lanes) && value.lanes.length === LANE_ORDER.length &&
    value.lanes.every((lane, index) => laneShape(lane, LANE_ORDER[index]!)) &&
    exactIso(value.recorded_at) && sha256Digest(value.checkpoint_digest) &&
    value.runtime_coordination_authority === true &&
    value.evaluation_authority === false &&
    value.policy_replacement_authority === false &&
    value.promotion_authority === false &&
    value.order_submission_authority === false &&
    value.live_exchange_authority === false &&
    value.authority_status === "runtime_coordination_only";
}

function laneShape(
  value: unknown,
  expectedLane: RuntimeSupervisorLane
): value is RuntimeSupervisorLaneReadModel {
  if (!object(value)) return false;
  const expectedKeys = [
    "lane",
    "desired",
    "status",
    "basis_digest",
    "progress_digest",
    "attempt_count",
    "no_progress_count",
    ...(value.next_retry_at === undefined ? [] : ["next_retry_at"]),
    ...(value.reason_code === undefined ? [] : ["reason_code"])
  ];
  return exactKeys(value, expectedKeys) && value.lane === expectedLane &&
    typeof value.desired === "boolean" && supervisorStatus(value.status) &&
    sha256Digest(value.basis_digest) && sha256Digest(value.progress_digest) &&
    nonNegativeInteger(value.attempt_count) &&
    nonNegativeInteger(value.no_progress_count) &&
    (value.next_retry_at === undefined || exactIso(value.next_retry_at)) &&
    (value.reason_code === undefined || canonicalString(value.reason_code));
}

function checkpointDigest(record: RuntimeSupervisorCheckpointRecord): string {
  const { checkpoint_digest: _digest, ...payload } = record;
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function checkpointFile(record: RuntimeSupervisorCheckpointRecord): string {
  return `${String(record.sequence).padStart(12, "0")}.json`;
}

function pendingDigest(): string {
  return `sha256:${"0".repeat(64)}`;
}

function supervisorStatus(value: unknown): value is RuntimeSupervisorStatus {
  return value === "recovering" || value === "running" ||
    value === "degraded" || value === "blocked" || value === "stopped";
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index]);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function sha256Digest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function exactIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function canonicalString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240 &&
    value.trim() === value;
}

function invalid(message: string, cause?: unknown): RuntimeSupervisorCheckpointStoreError {
  return new RuntimeSupervisorCheckpointStoreError(
    "runtime_supervisor_checkpoint_metadata_invalid",
    message,
    cause === undefined ? undefined : { cause }
  );
}
