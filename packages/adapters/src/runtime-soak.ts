import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  unlink
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  createRuntimeSoakEvent,
  createRuntimeSoakManifest,
  parseRuntimeSoakSample,
  runtimeSoakEventDigest,
  type RuntimeSoakAction,
  type RuntimeSoakEvent,
  type RuntimeSoakEventDraft,
  type RuntimeSoakJournalPort,
  type RuntimeSoakManifest,
  type RuntimeSoakSample,
  type RuntimeSoakTargetPort
} from "@ouroboros/application/runtime-soak";

const EVENT_FILE = /^(\d{12})\.json$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;

export class RuntimeSoakJournalError extends Error {
  constructor(
    readonly code:
      | "runtime_soak_manifest_conflict"
      | "runtime_soak_predecessor_conflict"
      | "runtime_soak_publication_conflict"
      | "runtime_soak_report_invalid",
    message: string
  ) {
    super(message);
    this.name = "RuntimeSoakJournalError";
  }
}

export class RuntimeSoakTargetError extends Error {
  constructor(
    readonly code:
      | "runtime_soak_control_missing"
      | "runtime_soak_control_failed"
      | "runtime_soak_probe_failed"
      | "runtime_soak_probe_invalid",
    message: string
  ) {
    super(message);
    this.name = "RuntimeSoakTargetError";
  }
}

export class FileRuntimeSoakJournal implements RuntimeSoakJournalPort {
  private manifest?: RuntimeSoakManifest;
  private readonly eventsDir: string;
  private readonly pendingDir: string;

  constructor(private readonly root: string) {
    this.eventsDir = path.join(root, "events");
    this.pendingDir = path.join(root, "pending");
  }

  async initialize(manifest: RuntimeSoakManifest): Promise<RuntimeSoakManifest> {
    const expected = createRuntimeSoakManifest({
      version: 1,
      run_id: manifest.run_id,
      duration_ms: manifest.duration_ms,
      sample_interval_ms: manifest.sample_interval_ms,
      actions: manifest.actions
    });
    if (!isDeepStrictEqual(expected, manifest)) throw invalid("Manifest is not canonical.");
    await ensureDirectory(this.root);
    await ensureDirectory(this.eventsDir);
    await ensureDirectory(this.pendingDir);
    const manifestPath = path.join(this.root, "manifest.json");
    try {
      await publishExclusive(this.pendingDir, manifestPath, encode(manifest));
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw invalid("Manifest could not be published.");
      const stored = await readRegularJson(manifestPath);
      if (!isDeepStrictEqual(stored, manifest)) {
        throw new RuntimeSoakJournalError(
          "runtime_soak_manifest_conflict",
          "Report root already belongs to a different runtime soak scenario."
        );
      }
    }
    this.manifest = structuredClone(manifest);
    return structuredClone(manifest);
  }

  async history(): Promise<RuntimeSoakEvent[]> {
    const manifest = this.requireManifest();
    const entries = await readdir(this.eventsDir, { withFileTypes: true });
    if (entries.some((entry) => !entry.isFile() || !EVENT_FILE.test(entry.name))) {
      throw invalid("Runtime soak event directory contains an unexpected entry.");
    }
    const names = entries.map((entry) => entry.name).sort();
    const events: RuntimeSoakEvent[] = [];
    for (const [index, name] of names.entries()) {
      const match = EVENT_FILE.exec(name);
      const sequence = Number(match?.[1]);
      if (sequence !== index + 1) throw invalid("Runtime soak event sequence is not contiguous.");
      const event = await readRegularJson(path.join(this.eventsDir, name));
      assertEvent(event, manifest, events.at(-1), sequence, events[0]?.recorded_at);
      events.push(structuredClone(event));
    }
    const terminalIndex = events.findIndex((event) => event.payload.event_type === "terminal");
    if (terminalIndex >= 0 && terminalIndex !== events.length - 1) {
      throw invalid("Runtime soak terminal event must be final.");
    }
    return events;
  }

  async append(
    draft: RuntimeSoakEventDraft,
    expectedPreviousDigest?: string
  ): Promise<RuntimeSoakEvent> {
    const manifest = this.requireManifest();
    const events = await this.history();
    const previous = events.at(-1);
    if (previous?.payload.event_type === "terminal") {
      throw invalid("Runtime soak terminal report cannot accept more events.");
    }
    if (previous?.event_digest !== expectedPreviousDigest ||
      (!previous && expectedPreviousDigest !== undefined)) {
      throw new RuntimeSoakJournalError(
        "runtime_soak_predecessor_conflict",
        "Runtime soak event predecessor changed before publication."
      );
    }
    const event = createRuntimeSoakEvent(draft, events.length + 1, previous);
    assertEvent(event, manifest, previous, event.sequence, events[0]?.recorded_at);
    const target = path.join(this.eventsDir, `${String(event.sequence).padStart(12, "0")}.json`);
    try {
      await publishExclusive(this.pendingDir, target, encode(event));
    } catch (error) {
      if (hasCode(error, "EEXIST")) {
        throw new RuntimeSoakJournalError(
          "runtime_soak_publication_conflict",
          "Another runtime soak writer published the same event sequence."
        );
      }
      throw invalid("Runtime soak event could not be published.");
    }
    return structuredClone(event);
  }

  private requireManifest(): RuntimeSoakManifest {
    if (!this.manifest) throw invalid("Runtime soak journal is not initialized.");
    return this.manifest;
  }
}

export interface RuntimeSoakCommand {
  argv: string[];
  cwd?: string;
  timeout_ms?: number;
}

export class SubprocessRuntimeSoakTarget implements RuntimeSoakTargetPort {
  constructor(private readonly options: {
    runId: string;
    controls: Record<string, RuntimeSoakCommand>;
    probe: RuntimeSoakCommand;
  }) {}

  async execute(action: RuntimeSoakAction): Promise<{ evidence_digest: string }> {
    const command = this.options.controls[action.action_id];
    if (!command) {
      throw new RuntimeSoakTargetError(
        "runtime_soak_control_missing",
        `No control command is configured for action ${action.action_id}.`
      );
    }
    let output: CommandOutput;
    try {
      output = await runCommand(command, {
        OUROBOROS_SOAK_RUN_ID: this.options.runId,
        OUROBOROS_SOAK_ACTION_ID: action.action_id,
        OUROBOROS_SOAK_ACTION_KIND: action.kind,
        ...(action.recovers ? { OUROBOROS_SOAK_RECOVERS: action.recovers } : {})
      });
    } catch {
      throw new RuntimeSoakTargetError(
        "runtime_soak_control_failed",
        `Control command failed for action ${action.action_id}.`
      );
    }
    return {
      evidence_digest: digest(JSON.stringify({
        run_id: this.options.runId,
        action_id: action.action_id,
        action_kind: action.kind,
        recovers: action.recovers ?? null,
        argv: command.argv,
        execution_context: output.executionContext,
        stdout: output.stdout,
        stderr: output.stderr
      }))
    };
  }

  async sample(): Promise<RuntimeSoakSample> {
    let stdout: string;
    try {
      stdout = (await runCommand(this.options.probe, {
        OUROBOROS_SOAK_RUN_ID: this.options.runId
      })).stdout;
    } catch {
      throw new RuntimeSoakTargetError("runtime_soak_probe_failed", "Runtime soak probe command failed.");
    }
    try {
      return parseRuntimeSoakSample(JSON.parse(stdout));
    } catch {
      throw new RuntimeSoakTargetError("runtime_soak_probe_invalid", "Runtime soak probe output is invalid.");
    }
  }
}

interface CommandOutput {
  stdout: string;
  stderr: string;
  executionContext: {
    executor: "exec_file";
    shell: false;
    cwd: string;
    timeout_ms: number;
    max_output_bytes: number;
    encoding: "utf8";
    environment_digest: string;
  };
}

function runCommand(command: RuntimeSoakCommand, metadata: Record<string, string>): Promise<CommandOutput> {
  if (!validCommand(command)) return Promise.reject(new Error("invalid command"));
  const [file, ...args] = command.argv;
  const environment = commandEnvironment(metadata);
  const executionContext: CommandOutput["executionContext"] = {
    executor: "exec_file",
    shell: false,
    cwd: command.cwd ?? process.cwd(),
    timeout_ms: command.timeout_ms ?? DEFAULT_COMMAND_TIMEOUT_MS,
    max_output_bytes: MAX_OUTPUT_BYTES,
    encoding: "utf8",
    environment_digest: environmentDigest(environment)
  };
  return new Promise((resolve, reject) => {
    execFile(file!, args, {
      cwd: executionContext.cwd,
      env: environment,
      encoding: executionContext.encoding,
      maxBuffer: executionContext.max_output_bytes,
      timeout: executionContext.timeout_ms,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr, executionContext });
    });
  });
}

function commandEnvironment(metadata: Record<string, string>): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.toUpperCase().startsWith("OUROBOROS_SOAK_")) environment[name] = value;
  }
  return { ...environment, ...metadata };
}

function environmentDigest(environment: NodeJS.ProcessEnv): string {
  const entries = Object.entries(environment)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return digest(JSON.stringify(entries));
}

function validCommand(command: RuntimeSoakCommand): boolean {
  return Array.isArray(command.argv) && command.argv.length > 0 &&
    command.argv.every((part) => typeof part === "string" && part.length > 0) &&
    (command.cwd === undefined || (typeof command.cwd === "string" && path.isAbsolute(command.cwd))) &&
    (command.timeout_ms === undefined || (Number.isSafeInteger(command.timeout_ms) && command.timeout_ms > 0));
}

async function ensureDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalid("Runtime soak report path is not a directory.");
}

async function publishExclusive(pendingDir: string, target: string, body: string): Promise<void> {
  const pending = path.join(pendingDir, `${randomUUID()}.tmp`);
  try {
    const handle = await open(pending, "wx", 0o600);
    try {
      await handle.writeFile(body, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(pending, target);
  } finally {
    await unlink(pending).catch(() => undefined);
  }
}

async function readRegularJson(file: string): Promise<unknown> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!(await handle.stat()).isFile()) throw new Error("not a regular file");
    return JSON.parse(await handle.readFile("utf8"));
  } catch (error) {
    if (error instanceof RuntimeSoakJournalError) throw error;
    throw invalid("Runtime soak report contains an unreadable JSON record.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function assertEvent(
  value: unknown,
  manifest: RuntimeSoakManifest,
  previous: RuntimeSoakEvent | undefined,
  sequence: number,
  startedAt?: string
): asserts value is RuntimeSoakEvent {
  if (!record(value) || value.record_kind !== "runtime_soak_event" || value.version !== 1 ||
    value.run_id !== manifest.run_id || value.sequence !== sequence ||
    value.previous_event_digest !== previous?.event_digest || !exactIso(value.recorded_at) ||
    !nonNegativeInteger(value.elapsed_ms) ||
    !SHA256.test(String(value.event_digest)) || !authority(value) || !payload(value.payload) ||
    runtimeSoakEventDigest(value as unknown as RuntimeSoakEvent) !== value.event_digest) {
    throw invalid("Runtime soak event record is invalid or has digest drift.");
  }
  const event = value as unknown as RuntimeSoakEvent;
  const recordedAt = Date.parse(event.recorded_at);
  const elapsed = startedAt ? recordedAt - Date.parse(startedAt) : 0;
  if (event.elapsed_ms !== elapsed || elapsed < 0 ||
    (previous !== undefined && recordedAt < Date.parse(previous.recorded_at)) ||
    (sequence === 1 && (event.payload.event_type !== "run_started" ||
      event.payload.scenario_digest !== manifest.scenario_digest)) ||
    (sequence > 1 && event.payload.event_type === "run_started")) {
    throw invalid("Runtime soak event time or run-start binding is invalid.");
  }
}

function payload(value: unknown): boolean {
  if (!record(value) || typeof value.event_type !== "string") return false;
  if (value.event_type === "run_started") return SHA256.test(String(value.scenario_digest));
  if (value.event_type === "action_started" || value.event_type === "action_completed") {
    return canonical(value.action_id) && canonical(value.action_kind) &&
      (value.event_type === "action_started" || SHA256.test(String(value.evidence_digest)));
  }
  if (value.event_type === "sample_recorded") {
    try {
      return typeof value.terminal === "boolean" && Boolean(parseRuntimeSoakSample(value.sample));
    } catch { return false; }
  }
  return value.event_type === "terminal" &&
    ["passed", "invariant_failed", "target_failed", "duration_exhausted"].includes(String(value.classification));
}

function authority(value: Record<string, unknown>): boolean {
  return value.operational_test_evidence === true && value.evaluation_authority === false &&
    value.promotion_authority === false && value.order_submission_authority === false &&
    value.private_exchange_authority === false && value.live_exchange_authority === false &&
    value.authority_status === "operational_test_only";
}

function encode(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function digest(value: string): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonical(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.trim() === value; }
function nonNegativeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function exactIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}
function hasCode(error: unknown, code: string): boolean { return record(error) && error.code === code; }
function invalid(message: string): RuntimeSoakJournalError {
  return new RuntimeSoakJournalError("runtime_soak_report_invalid", message);
}
