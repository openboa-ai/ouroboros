import { execFile } from "node:child_process";
import path from "node:path";
import type {
  Ref,
  RunnableArtifactRecord,
  RuntimeHeartbeatRecord,
  RuntimeInstanceLogRecord,
  RuntimePlacementRecord,
  SandboxCommandEvidenceRecord,
  SandboxRuntimeAdapterKind,
  SandboxRuntimeInstanceDetailReadModel,
  SandboxRuntimeInstanceLifecycleStatus,
  SandboxRuntimeInstanceRecord
} from "@ouroboros/domain";

let commandEvidenceSequence = 0;

export interface SandboxRuntimeAdapterStartInput {
  artifact: RunnableArtifactRecord;
  instance_id: string;
  sandbox_name: string;
  runtime_ref?: Ref;
  runtime_placement_id: string;
  created_at: string;
  trace_ref?: Ref;
  test_ticks?: number;
  interval_ms?: number;
}

export interface SandboxRuntimeAdapterStartResult {
  instance: SandboxRuntimeInstanceRecord;
  placement: RuntimePlacementRecord;
  logs: RuntimeInstanceLogRecord[];
  heartbeats: RuntimeHeartbeatRecord[];
  command_evidence: SandboxCommandEvidenceRecord[];
}

export interface SandboxRuntimeAdapterObservationResult {
  lifecycle_status?: SandboxRuntimeInstanceLifecycleStatus;
  logs?: RuntimeInstanceLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
  stopped_at?: string;
  removed_at?: string;
}

export interface SandboxRuntimeAdapter {
  readonly kind: SandboxRuntimeAdapterKind;
  startArtifactInstance(input: SandboxRuntimeAdapterStartInput): Promise<SandboxRuntimeAdapterStartResult>;
  getArtifactInstanceStatus(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult>;
  getArtifactInstanceLogs(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult>;
  stopArtifactInstance(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult>;
}

export class DeterministicSandboxRuntimeAdapter implements SandboxRuntimeAdapter {
  readonly kind = "deterministic_test" as const;

  async startArtifactInstance(input: SandboxRuntimeAdapterStartInput): Promise<SandboxRuntimeAdapterStartResult> {
    const tickCount = Math.max(1, input.test_ticks ?? 2);
    const intervalMs = input.interval_ms ?? 1_000;
    const placement = sandboxPlacement(input.runtime_placement_id);
    const heartbeats = Array.from({ length: tickCount }, (_, index) => {
      const tick = index + 1;
      const observedAt = timestampOffset(input.created_at, tick * intervalMs);
      const line = JSON.stringify({
        event: "runtime_heartbeat",
        instance_id: input.instance_id,
        tick,
        at: observedAt
      });
      return runtimeHeartbeatRecord(input.instance_id, `start-${tick}`, line, observedAt);
    });
    const lines = heartbeats.map((heartbeat) => heartbeat.heartbeat_line);
    const log = runtimeLogRecord(input.instance_id, "start", lines, input.created_at);
    const instance = sandboxRuntimeInstanceRecord({
      adapterKind: this.kind,
      artifact: input.artifact,
      instanceId: input.instance_id,
      sandboxName: input.sandbox_name,
      runtimeRef: input.runtime_ref,
      placementId: placement.runtime_placement_id,
      lifecycleStatus: "running",
      createdAt: input.created_at,
      startedAt: input.created_at,
      lastHeartbeatAt: heartbeats.at(-1)?.observed_at,
      logRefs: [ref(log.record_kind, log.runtime_instance_log_id)],
      heartbeatRefs: heartbeats.map((heartbeat) => ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id)),
      traceRef: input.trace_ref
    });

    return {
      instance,
      placement,
      logs: [log],
      heartbeats,
      command_evidence: []
    };
  }

  async getArtifactInstanceStatus(): Promise<SandboxRuntimeAdapterObservationResult> {
    return {};
  }

  async getArtifactInstanceLogs(): Promise<SandboxRuntimeAdapterObservationResult> {
    return {};
  }

  async stopArtifactInstance(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult> {
    const stoppedAt = new Date().toISOString();
    const instanceId = instanceIdFor(instance);
    const stoppedLine = JSON.stringify({
      event: "runtime_stopped",
      instance_id: instanceId,
      at: stoppedAt
    });
    return {
      lifecycle_status: "stopped",
      stopped_at: stoppedAt,
      logs: [runtimeLogRecord(instanceId, `stop-${safeRuntimeId(stoppedAt)}`, [stoppedLine], stoppedAt)]
    };
  }
}

export class DockerSandboxesSbxRuntimeAdapter implements SandboxRuntimeAdapter {
  readonly kind = "docker_sandboxes_sbx" as const;

  constructor(
    private readonly options: {
      sbxPath?: string;
      sbxHome?: string;
      workspacePath?: string;
      commandTimeoutMs?: number;
    } = {}
  ) {}

  async startArtifactInstance(input: SandboxRuntimeAdapterStartInput): Promise<SandboxRuntimeAdapterStartResult> {
    const createdAt = input.created_at;
    const placement = sandboxPlacement(input.runtime_placement_id);
    const artifactPath = artifactEntrypointPath(input.artifact);
    const logFile = sandboxLogFile(input.instance_id);
    const heartbeatFile = sandboxHeartbeatFile(input.instance_id);
    const versionCommand = [this.sbxPath, "version"];
    const versionResult = await this.runSbxCommand(versionCommand);
    const versionEvidence = commandEvidenceRecord(input.instance_id, "version", versionResult);
    if (
      versionResult.exit_code !== 0 ||
      !isDockerSandboxesSbxVersion(versionResult.stdout)
    ) {
      return {
        instance: sandboxRuntimeInstanceRecord({
          adapterKind: this.kind,
          artifact: input.artifact,
          instanceId: input.instance_id,
          sandboxName: input.sandbox_name,
          runtimeRef: input.runtime_ref,
          placementId: placement.runtime_placement_id,
          lifecycleStatus: "failed",
          createdAt,
          commandEvidenceRefs: [ref(versionEvidence.record_kind, versionEvidence.sandbox_command_evidence_id)],
          traceRef: input.trace_ref
        }),
        placement,
        logs: [],
        heartbeats: [],
        command_evidence: [versionEvidence]
      };
    }
    const createCommand = [
      this.sbxPath,
      "create",
      "--name",
      input.sandbox_name,
      "shell",
      this.workspacePath
    ];
    const createResult = await this.runSbxCommand(createCommand);
    const createEvidence = commandEvidenceRecord(input.instance_id, "create", createResult);
    if (createResult.exit_code !== 0) {
      return {
        instance: sandboxRuntimeInstanceRecord({
          adapterKind: this.kind,
          artifact: input.artifact,
          instanceId: input.instance_id,
          sandboxName: input.sandbox_name,
          runtimeRef: input.runtime_ref,
          placementId: placement.runtime_placement_id,
          lifecycleStatus: "failed",
          createdAt,
          commandEvidenceRefs: [
            ref(versionEvidence.record_kind, versionEvidence.sandbox_command_evidence_id),
            ref(createEvidence.record_kind, createEvidence.sandbox_command_evidence_id)
          ],
          traceRef: input.trace_ref
        }),
        placement,
        logs: [],
        heartbeats: [],
        command_evidence: [versionEvidence, createEvidence]
      };
    }
    const execCommand = [
      this.sbxPath,
      "exec",
      "-d",
      input.sandbox_name,
      "python3",
      artifactPath,
      "--instance-id",
      input.instance_id,
      "--interval-ms",
      String(input.interval_ms ?? 1_000),
      "--log-file",
      logFile,
      "--heartbeat-file",
      heartbeatFile,
      ...(input.test_ticks !== undefined ? ["--ticks", String(input.test_ticks)] : [])
    ];
    const execResult = await this.runSbxCommand(execCommand);
    const commandEvidence = [
      versionEvidence,
      createEvidence,
      commandEvidenceRecord(input.instance_id, "exec-detached", execResult)
    ];
    const lifecycleStatus = createResult.exit_code === 0 && execResult.exit_code === 0
      ? "running"
      : "failed";
    const instance = sandboxRuntimeInstanceRecord({
      adapterKind: this.kind,
      artifact: input.artifact,
      instanceId: input.instance_id,
      sandboxName: input.sandbox_name,
      runtimeRef: input.runtime_ref,
      placementId: placement.runtime_placement_id,
      lifecycleStatus,
      createdAt,
      startedAt: lifecycleStatus === "running" ? createdAt : undefined,
      commandEvidenceRefs: commandEvidence.map((evidence) => (
        ref(evidence.record_kind, evidence.sandbox_command_evidence_id)
      )),
      traceRef: input.trace_ref
    });

    return {
      instance,
      placement,
      logs: [],
      heartbeats: [],
      command_evidence: commandEvidence
    };
  }

  async getArtifactInstanceStatus(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult> {
    const instanceId = instanceIdFor(instance);
    const versionObservation = await this.versionObservation(instanceId, "status-version");
    if (versionObservation.failure) {
      return versionObservation.failure;
    }
    const result = await this.runSbxCommand([
      this.sbxPath,
      "exec",
      sandboxNameFor(instance),
      "cat",
      sandboxHeartbeatFile(instanceId)
    ]);
    const capturedAt = result.completed_at;
    const heartbeats = heartbeatRecordsFromLines(
      instanceId,
      "status",
      stdoutLines(result.stdout),
      capturedAt
    );
    return {
      heartbeats,
      command_evidence: [
        versionObservation.evidence,
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("status", result), result)
      ]
    };
  }

  async getArtifactInstanceLogs(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult> {
    const instanceId = instanceIdFor(instance);
    const versionObservation = await this.versionObservation(instanceId, "logs-version");
    if (versionObservation.failure) {
      return versionObservation.failure;
    }
    const result = await this.runSbxCommand([
      this.sbxPath,
      "exec",
      sandboxNameFor(instance),
      "cat",
      sandboxLogFile(instanceId)
    ]);
    const lines = stdoutLines(result.stdout);
    return {
      logs: lines.length > 0
        ? [runtimeLogRecord(instanceId, `logs-${safeRuntimeId(result.completed_at)}`, lines, result.completed_at)]
        : [],
      heartbeats: heartbeatRecordsFromLines(instanceId, "logs", lines, result.completed_at),
      command_evidence: [
        versionObservation.evidence,
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("logs", result), result)
      ]
    };
  }

  async stopArtifactInstance(
    instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel
  ): Promise<SandboxRuntimeAdapterObservationResult> {
    const instanceId = instanceIdFor(instance);
    const sandboxName = sandboxNameFor(instance);
    const versionObservation = await this.versionObservation(instanceId, "stop-version");
    if (versionObservation.failure) {
      return versionObservation.failure;
    }
    const stopStartedAt = new Date().toISOString();
    const terminateResult = await this.runSbxCommand([
      this.sbxPath,
      "exec",
      sandboxName,
      "pkill",
      "-TERM",
      "-f",
      "fixtures/trader-systems/clock.py"
    ]);
    const stopResult = await this.runSbxCommand([this.sbxPath, "stop", sandboxName]);
    const stopped = stopResult.exit_code === 0;
    return {
      lifecycle_status: stopped ? "stopped" : "failed",
      stopped_at: stopped ? stopResult.completed_at || stopStartedAt : undefined,
      command_evidence: [
        versionObservation.evidence,
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("terminate", terminateResult), terminateResult),
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("stop", stopResult), stopResult)
      ]
    };
  }

  private get sbxPath(): string {
    const configuredPath = this.options.sbxPath
      ?? process.env.OUROBOROS_SBX_BIN
      ?? process.env.OUROBOROS_SDX_BIN
      ?? "sbx";
    return resolveCommandPath(configuredPath, this.workspacePath);
  }

  private get workspacePath(): string {
    return this.options.workspacePath ?? process.env.OUROBOROS_SBX_WORKSPACE ?? ".";
  }

  private get commandTimeoutMs(): number {
    return this.options.commandTimeoutMs ?? Number(process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS ?? 30_000);
  }

  private get sbxHome(): string | undefined {
    return this.options.sbxHome ?? process.env.OUROBOROS_SBX_HOME;
  }

  private runSbxCommand(command: string[]): Promise<CommandResult> {
    return runCommand(command, this.commandTimeoutMs, this.sbxHome ? { HOME: this.sbxHome } : undefined);
  }

  private async versionObservation(
    instanceId: string,
    suffix: string
  ): Promise<{
    evidence: SandboxCommandEvidenceRecord;
    failure?: SandboxRuntimeAdapterObservationResult;
  }> {
    const result = await this.runSbxCommand([this.sbxPath, "version"]);
    const evidence = commandEvidenceRecord(instanceId, commandEvidenceSuffix(suffix, result), result);
    if (result.exit_code === 0 && isDockerSandboxesSbxVersion(result.stdout)) {
      return { evidence };
    }
    return {
      evidence,
      failure: {
        lifecycle_status: "failed",
        command_evidence: [evidence]
      }
    };
  }
}

function commandEvidenceSuffix(label: string, result: CommandResult): string {
  commandEvidenceSequence += 1;
  return `${label}-${safeRuntimeId(result.started_at)}-${commandEvidenceSequence}`;
}

interface CommandResult {
  command: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  started_at: string;
  completed_at: string;
}

function sandboxRuntimeInstanceRecord(input: {
  adapterKind: SandboxRuntimeAdapterKind;
  artifact: RunnableArtifactRecord;
  instanceId: string;
  sandboxName: string;
  runtimeRef?: Ref;
  placementId: string;
  lifecycleStatus: SandboxRuntimeInstanceLifecycleStatus;
  createdAt: string;
  startedAt?: string;
  lastHeartbeatAt?: string;
  logRefs?: Ref[];
  heartbeatRefs?: Ref[];
  commandEvidenceRefs?: Ref[];
  traceRef?: Ref;
}): SandboxRuntimeInstanceRecord {
  return stripUndefined({
    record_kind: "sandbox_runtime_instance",
    version: 1,
    sandbox_runtime_instance_id: input.instanceId,
    adapter_kind: input.adapterKind,
    runnable_artifact_ref: ref("runnable_artifact", input.artifact.runnable_artifact_id),
    runtime_ref: input.runtimeRef,
    runtime_placement_ref: ref("runtime_placement", input.placementId),
    lifecycle_status: input.lifecycleStatus,
    sandbox_name: input.sandboxName,
    sandbox_ref: ref("docker_sandbox", input.sandboxName),
    created_at: input.createdAt,
    started_at: input.startedAt,
    last_heartbeat_at: input.lastHeartbeatAt,
    log_refs: input.logRefs ?? [],
    heartbeat_refs: input.heartbeatRefs ?? [],
    command_evidence_refs: input.commandEvidenceRefs,
    trace_ref: input.traceRef,
    authority_status: "not_live"
  } satisfies SandboxRuntimeInstanceRecord);
}

function sandboxPlacement(placementId: string): RuntimePlacementRecord {
  return {
    record_kind: "runtime_placement",
    version: 1,
    runtime_placement_id: placementId,
    placement_kind: "containerized_remote",
    tooling_kind: "docker_sandbox",
    sandbox_template_ref: ref("sandbox_template", "docker-sandboxes-clock-template-v1"),
    authority_status: "not_launched"
  };
}

function runtimeLogRecord(
  instanceId: string,
  suffix: string,
  lines: string[],
  capturedAt: string
): RuntimeInstanceLogRecord {
  return {
    record_kind: "runtime_instance_log",
    version: 1,
    runtime_instance_log_id: `runtime-instance-log-${safeRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
    sandbox_runtime_instance_ref: ref("sandbox_runtime_instance", instanceId),
    lines,
    captured_at: capturedAt,
    authority_status: "trace_only"
  };
}

function runtimeHeartbeatRecord(
  instanceId: string,
  suffix: string,
  heartbeatLine: string,
  observedAt: string
): RuntimeHeartbeatRecord {
  return {
    record_kind: "runtime_heartbeat",
    version: 1,
    runtime_heartbeat_id: `runtime-heartbeat-${safeRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
    sandbox_runtime_instance_ref: ref("sandbox_runtime_instance", instanceId),
    heartbeat_line: heartbeatLine,
    observed_at: observedAt,
    authority_status: "trace_only"
  };
}

function commandEvidenceRecord(
  instanceId: string,
  suffix: string,
  result: CommandResult
): SandboxCommandEvidenceRecord {
  return {
    record_kind: "sandbox_command_evidence",
    version: 1,
    sandbox_command_evidence_id: `sandbox-command-evidence-${safeRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
    sandbox_runtime_instance_ref: ref("sandbox_runtime_instance", instanceId),
    command: result.command,
    exit_code: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    started_at: result.started_at,
    completed_at: result.completed_at,
    authority_status: "trace_only"
  };
}

function heartbeatRecordsFromLines(
  instanceId: string,
  suffix: string,
  lines: string[],
  capturedAt: string
): RuntimeHeartbeatRecord[] {
  return lines.flatMap((line, index) => {
    const heartbeat = parseHeartbeatLine(line);
    if (!heartbeat || heartbeat.instance_id !== instanceId) {
      return [];
    }
    return [
      runtimeHeartbeatRecord(
        instanceId,
        `${suffix}-${index + 1}-${safeRuntimeId(heartbeat.at ?? capturedAt)}`,
        line,
        heartbeat.at ?? capturedAt
      )
    ];
  });
}

function parseHeartbeatLine(line: string): { event?: string; instance_id?: string; at?: string } | undefined {
  try {
    const value = JSON.parse(line) as { event?: unknown; instance_id?: unknown; at?: unknown };
    if (value.event !== "runtime_heartbeat") {
      return undefined;
    }
    return {
      event: "runtime_heartbeat",
      instance_id: typeof value.instance_id === "string" ? value.instance_id : undefined,
      at: typeof value.at === "string" ? value.at : undefined
    };
  } catch {
    return undefined;
  }
}

function isDockerSandboxesSbxVersion(stdout: string): boolean {
  return stdout.includes("Client Version:") && stdout.includes("Server Version:");
}

function resolveCommandPath(commandPath: string, workspacePath: string): string {
  if (path.isAbsolute(commandPath) || (!commandPath.includes("/") && !commandPath.includes("\\"))) {
    return commandPath;
  }
  return path.resolve(workspacePath, commandPath);
}

function artifactEntrypointPath(artifact: RunnableArtifactRecord): string {
  if (artifact.artifact_kind === "python_file") {
    return artifact.artifact_path;
  }
  return artifact.entrypoint[0] ?? "/app/run";
}

function sandboxLogFile(instanceId: string): string {
  return `/tmp/ouroboros-${safeRuntimeId(instanceId)}.jsonl`;
}

function sandboxHeartbeatFile(instanceId: string): string {
  return `/tmp/ouroboros-${safeRuntimeId(instanceId)}.heartbeat.json`;
}

function instanceIdFor(instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel): string {
  return "sandbox_runtime_instance_id" in instance
    ? instance.sandbox_runtime_instance_id
    : instance.instance_id;
}

function sandboxNameFor(instance: SandboxRuntimeInstanceRecord | SandboxRuntimeInstanceDetailReadModel): string {
  return instance.sandbox_name;
}

function timestampOffset(base: string, offsetMs: number): string {
  return new Date(Date.parse(base) + offsetMs).toISOString();
}

function stdoutLines(stdout: string): string[] {
  return stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

function runCommand(
  command: string[],
  timeoutMs = 30_000,
  envOverrides: NodeJS.ProcessEnv | undefined = undefined
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const [file, ...args] = command;
    execFile(
      file,
      args,
      {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: envOverrides ? { ...process.env, ...envOverrides } : process.env
      },
      (error, stdout, stderr) => {
        const completedAt = new Date().toISOString();
        resolve({
          command,
          exit_code: error ? exitCodeFor(error) : 0,
          stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
          stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
          started_at: startedAt,
          completed_at: completedAt
        });
      }
    );
  });
}

function exitCodeFor(error: Error & { code?: unknown; signal?: unknown }): number | null {
  return typeof error.code === "number" ? error.code : null;
}

function safeRuntimeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 80) || "empty";
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
