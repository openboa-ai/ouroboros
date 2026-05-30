import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Ref,
  SystemCodeRecord,
  RuntimeHeartbeatRecord,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxCommandEvidenceRecord,
  SandboxAdapterKind,
  SandboxDetailReadModel,
  SandboxLifecycleStatus,
  SandboxRecord
} from "@ouroboros/domain";
import { safeId } from "../safe-id";

let commandEvidenceSequence = 0;

const DETERMINISTIC_FIXTURE_SYSTEM_CODE_ID = "fixture-system-code-clock-python-001";
const DETERMINISTIC_FIXTURE_ARTIFACT_PATH = "fixtures/trading-systems/clock.py";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export type PaperOrderRequestFixture = "valid" | "rejected";

export interface SandboxRuntimeEnv {
  TRADING_API_BASE_URL?: string;
}

export interface SandboxAdapterStartInput {
  artifact: SystemCodeRecord;
  instance_id: string;
  sandbox_name: string;
  runtime_ref?: Ref;
  sandbox_placement_id: string;
  created_at: string;
  trace_ref?: Ref;
  test_ticks?: number;
  interval_ms?: number;
  paper_order_request?: PaperOrderRequestFixture;
  env?: SandboxRuntimeEnv;
}

export interface SandboxAdapterStartResult {
  instance: SandboxRecord;
  placement: SandboxPlacementRecord;
  logs: SandboxLogRecord[];
  heartbeats: RuntimeHeartbeatRecord[];
  command_evidence: SandboxCommandEvidenceRecord[];
}

export interface SandboxAdapterObservationResult {
  lifecycle_status?: SandboxLifecycleStatus;
  logs?: SandboxLogRecord[];
  heartbeats?: RuntimeHeartbeatRecord[];
  command_evidence?: SandboxCommandEvidenceRecord[];
  stopped_at?: string;
  removed_at?: string;
}

export interface SandboxAdapter {
  readonly kind: SandboxAdapterKind;
  startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult>;
  getArtifactInstanceStatus(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
  getArtifactInstanceLogs(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
  stopArtifactInstance(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult>;
}

export class DeterministicSandboxAdapter implements SandboxAdapter {
  readonly kind = "deterministic_test" as const;

  constructor(
    private readonly options: {
      commandTimeoutMs?: number;
      allowedSystemCodeIds?: readonly string[];
      allowedArtifactRoots?: readonly string[];
      allowedCapabilityPolicyIds?: readonly string[];
    } = {}
  ) {}

  async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
    const tickCount = Math.max(1, input.test_ticks ?? 2);
    const intervalMs = input.interval_ms ?? 1_000;
    const placement = sandboxPlacement(input.sandbox_placement_id);
    const command = systemCodeCommand(input.artifact);
    if (!isDeterministicRunnableSystemCode(input.artifact, command, {
      allowedSystemCodeIds: this.allowedSystemCodeIds,
      allowedArtifactRoots: this.allowedArtifactRoots,
      allowedCapabilityPolicyIds: this.allowedCapabilityPolicyIds
    })) {
      const rejectedResult = rejectedSystemCodeCommandResult(input.artifact, input.created_at);
      const commandEvidence = commandEvidenceRecord(input.instance_id, "reject-system-code", rejectedResult);
      return {
        instance: sandboxSandboxRecord({
          adapterKind: this.kind,
          artifact: input.artifact,
          instanceId: input.instance_id,
          sandboxName: input.sandbox_name,
          runtimeRef: input.runtime_ref,
          placementId: placement.sandbox_placement_id,
          lifecycleStatus: "failed",
          createdAt: input.created_at,
          commandEvidenceRefs: [ref(commandEvidence.record_kind, commandEvidence.sandbox_command_evidence_id)],
          traceRef: input.trace_ref
        }),
        placement,
        logs: [],
        heartbeats: [],
        command_evidence: [commandEvidence]
      };
    }
    const executionCommand = [
      ...command,
      "--instance-id",
      input.instance_id,
      "--ticks",
      String(tickCount),
      "--interval-ms",
      String(intervalMs),
      "--start-at",
      input.created_at,
      "--paper-order-request",
      input.paper_order_request ?? "valid"
    ];
    const executionResult = await runDeterministicFixtureCommand({
      command: executionCommand,
      env: input.env,
      timeoutMs: this.commandTimeoutMs
    });
    const commandEvidence = commandEvidenceRecord(input.instance_id, "execute", executionResult);
    const lines = stdoutLines(executionResult.stdout);
    const log = lines.length > 0
      ? runtimeLogRecord(input.instance_id, "start", lines, executionResult.completed_at)
      : undefined;
    const heartbeats = heartbeatRecordsFromLines(
      input.instance_id,
      "start",
      lines,
      executionResult.completed_at
    );
    const lifecycleStatus = executionResult.exit_code === 0 ? "stopped" : "failed";
    const instance = sandboxSandboxRecord({
      adapterKind: this.kind,
      artifact: input.artifact,
      instanceId: input.instance_id,
      sandboxName: input.sandbox_name,
      runtimeRef: input.runtime_ref,
      placementId: placement.sandbox_placement_id,
      lifecycleStatus,
      createdAt: input.created_at,
      startedAt: lifecycleStatus === "stopped" ? input.created_at : undefined,
      stoppedAt: lifecycleStatus === "stopped" ? executionResult.completed_at : undefined,
      lastHeartbeatAt: heartbeats.at(-1)?.observed_at,
      logRefs: log ? [ref(log.record_kind, log.sandbox_log_id)] : [],
      heartbeatRefs: heartbeats.map((heartbeat) => ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id)),
      commandEvidenceRefs: [ref(commandEvidence.record_kind, commandEvidence.sandbox_command_evidence_id)],
      traceRef: input.trace_ref
    });

    return {
      instance,
      placement,
      logs: log ? [log] : [],
      heartbeats,
      command_evidence: [commandEvidence]
    };
  }

  async getArtifactInstanceStatus(): Promise<SandboxAdapterObservationResult> {
    return {};
  }

  async getArtifactInstanceLogs(): Promise<SandboxAdapterObservationResult> {
    return {};
  }

  async stopArtifactInstance(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
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

  private get commandTimeoutMs(): number {
    return this.options.commandTimeoutMs ?? 30_000;
  }

  private get allowedSystemCodeIds(): readonly string[] {
    return this.options.allowedSystemCodeIds ?? [DETERMINISTIC_FIXTURE_SYSTEM_CODE_ID];
  }

  private get allowedArtifactRoots(): readonly string[] {
    return this.options.allowedArtifactRoots ?? [];
  }

  private get allowedCapabilityPolicyIds(): readonly string[] {
    return this.options.allowedCapabilityPolicyIds ?? [];
  }
}

export class DockerSandboxesSbxSandboxAdapter implements SandboxAdapter {
  readonly kind = "docker_sandboxes_sbx" as const;

  constructor(
    private readonly options: {
      sbxPath?: string;
      sbxHome?: string;
      workspacePath?: string;
      commandTimeoutMs?: number;
    } = {}
  ) {}

  async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
    const createdAt = input.created_at;
    const placement = sandboxPlacement(input.sandbox_placement_id);
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
        instance: sandboxSandboxRecord({
          adapterKind: this.kind,
          artifact: input.artifact,
          instanceId: input.instance_id,
          sandboxName: input.sandbox_name,
          runtimeRef: input.runtime_ref,
          placementId: placement.sandbox_placement_id,
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
        instance: sandboxSandboxRecord({
          adapterKind: this.kind,
          artifact: input.artifact,
          instanceId: input.instance_id,
          sandboxName: input.sandbox_name,
          runtimeRef: input.runtime_ref,
          placementId: placement.sandbox_placement_id,
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
      "-w",
      this.workspacePath,
      input.sandbox_name,
      ...sandboxRuntimeEnvCommand(input.env),
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
    const instance = sandboxSandboxRecord({
      adapterKind: this.kind,
      artifact: input.artifact,
      instanceId: input.instance_id,
      sandboxName: input.sandbox_name,
      runtimeRef: input.runtime_ref,
      placementId: placement.sandbox_placement_id,
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
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
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
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
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
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
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
      "fixtures/trading-systems/clock.py"
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
    failure?: SandboxAdapterObservationResult;
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

function sandboxSandboxRecord(input: {
  adapterKind: SandboxAdapterKind;
  artifact: SystemCodeRecord;
  instanceId: string;
  sandboxName: string;
  runtimeRef?: Ref;
  placementId: string;
  lifecycleStatus: SandboxLifecycleStatus;
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
  lastHeartbeatAt?: string;
  logRefs?: Ref[];
  heartbeatRefs?: Ref[];
  commandEvidenceRefs?: Ref[];
  traceRef?: Ref;
}): SandboxRecord {
  return stripUndefined({
    record_kind: "sandbox",
    version: 1,
    sandbox_id: input.instanceId,
    adapter_kind: input.adapterKind,
    system_code_ref: ref("system_code", input.artifact.system_code_id),
    runtime_ref: input.runtimeRef,
    sandbox_placement_ref: ref("sandbox_placement", input.placementId),
    lifecycle_status: input.lifecycleStatus,
    sandbox_name: input.sandboxName,
    sandbox_ref: ref("docker_sandbox", input.sandboxName),
    created_at: input.createdAt,
    started_at: input.startedAt,
    stopped_at: input.stoppedAt,
    last_heartbeat_at: input.lastHeartbeatAt,
    log_refs: input.logRefs ?? [],
    heartbeat_refs: input.heartbeatRefs ?? [],
    command_evidence_refs: input.commandEvidenceRefs,
    trace_ref: input.traceRef,
    authority_status: "not_live"
  } satisfies SandboxRecord);
}

function sandboxPlacement(placementId: string): SandboxPlacementRecord {
  return {
    record_kind: "sandbox_placement",
    version: 1,
    sandbox_placement_id: placementId,
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
): SandboxLogRecord {
  return {
    record_kind: "sandbox_log",
    version: 1,
    sandbox_log_id: `sandbox-log-${safeRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
    sandbox_ref: ref("sandbox", instanceId),
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
    sandbox_ref: ref("sandbox", instanceId),
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
    sandbox_ref: ref("sandbox", instanceId),
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

function artifactEntrypointPath(artifact: SystemCodeRecord): string {
  if (artifact.artifact_kind === "python_file") {
    return artifact.artifact_path;
  }
  return artifact.entrypoint[0] ?? "/app/run";
}

function isDeterministicRunnableSystemCode(
  artifact: SystemCodeRecord,
  command: string[],
  input: {
    allowedSystemCodeIds: readonly string[];
    allowedArtifactRoots: readonly string[];
    allowedCapabilityPolicyIds: readonly string[];
  }
): boolean {
  return isDeterministicFixtureSystemCode(artifact, command, input.allowedSystemCodeIds)
    || isAllowedGeneratedPaperSystemCode(artifact, command, input);
}

function isDeterministicFixtureSystemCode(
  artifact: SystemCodeRecord,
  command: string[],
  allowedSystemCodeIds: readonly string[]
): boolean {
  return (
    allowedSystemCodeIds.includes(artifact.system_code_id) &&
    artifact.artifact_kind === "python_file" &&
    artifact.artifact_path === DETERMINISTIC_FIXTURE_ARTIFACT_PATH &&
    artifact.runtime_kind === "python" &&
    isPythonFixtureCommand(command)
  );
}

function isAllowedGeneratedPaperSystemCode(
  artifact: SystemCodeRecord,
  command: string[],
  input: {
    allowedArtifactRoots: readonly string[];
    allowedCapabilityPolicyIds: readonly string[];
  }
): boolean {
  if (
    artifact.artifact_kind !== "python_file" ||
    artifact.runtime_kind !== "python" ||
    !artifact.capability_policy_ref ||
    !input.allowedCapabilityPolicyIds.includes(artifact.capability_policy_ref.id) ||
    !isPythonGeneratedCommand(command)
  ) {
    return false;
  }

  const artifactPath = path.resolve(artifact.artifact_path);
  return input.allowedArtifactRoots.some((root) => isPathWithin(artifactPath, root));
}

function isPythonFixtureCommand(command: string[]): boolean {
  return (
    command.length >= 2 &&
    (command[0] === "python" || command[0] === "python3") &&
    command[1] === DETERMINISTIC_FIXTURE_ARTIFACT_PATH
  );
}

function isPythonGeneratedCommand(command: string[]): boolean {
  if (command.length < 2 || (command[0] !== "python" && command[0] !== "python3")) {
    return false;
  }
  return path.resolve(command[1]!) === command[1];
}

function isPathWithin(filePath: string, root: string): boolean {
  const resolvedRoot = path.resolve(root);
  const relativePath = path.relative(resolvedRoot, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function systemCodeCommand(artifact: SystemCodeRecord): string[] {
  if (artifact.entrypoint.length > 0) {
    return artifact.entrypoint;
  }
  if (artifact.runtime_kind === "python") {
    return ["python3", artifactEntrypointPath(artifact)];
  }
  return [artifactEntrypointPath(artifact)];
}

function rejectedSystemCodeCommandResult(
  artifact: SystemCodeRecord,
  at: string
): CommandResult {
  const artifactLocation = artifact.artifact_kind === "python_file"
    ? artifact.artifact_path
    : artifact.image_ref;
  return {
    command: [
      "deterministic_test",
      "reject-non-fixture-system-code",
      artifact.system_code_id
    ],
    exit_code: 2,
    stdout: "",
    stderr: [
      "deterministic_test only executes fixture SystemCode or explicitly allowed generated paper SystemCode",
      `${DETERMINISTIC_FIXTURE_SYSTEM_CODE_ID}:${DETERMINISTIC_FIXTURE_ARTIFACT_PATH}`,
      `received ${artifact.system_code_id}:${artifactLocation}`
    ].join("\n"),
    started_at: at,
    completed_at: at
  };
}

function sandboxLogFile(instanceId: string): string {
  return `/tmp/ouroboros-${safeRuntimeId(instanceId)}.jsonl`;
}

function sandboxHeartbeatFile(instanceId: string): string {
  return `/tmp/ouroboros-${safeRuntimeId(instanceId)}.heartbeat.json`;
}

function instanceIdFor(instance: SandboxRecord | SandboxDetailReadModel): string {
  return instance.sandbox_id;
}

function sandboxNameFor(instance: SandboxRecord | SandboxDetailReadModel): string {
  return instance.sandbox_name;
}

function stdoutLines(stdout: string): string[] {
  return stdout.split(/\r?\n/).filter((line) => line.length > 0);
}

function runDeterministicFixtureCommand(input: {
  command: string[];
  env?: SandboxRuntimeEnv;
  timeoutMs: number;
}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const [file, ...args] = input.command;
    if (!file) {
      resolve({
        command: input.command,
        exit_code: 2,
        stdout: "",
        stderr: "empty deterministic fixture command",
        started_at: startedAt,
        completed_at: startedAt
      });
      return;
    }

    execFile(
      file,
      args,
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: input.timeoutMs,
        maxBuffer: 1024 * 1024,
        env: input.env ? { ...process.env, ...input.env } : process.env
      },
      (error, stdout, stderr) => {
        const completedAt = new Date().toISOString();
        resolve({
          command: input.command,
          exit_code: error ? exitCodeFor(error) : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          started_at: startedAt,
          completed_at: completedAt
        });
      }
    );
  });
}

function sandboxRuntimeEnvCommand(env: SandboxRuntimeEnv | undefined): string[] {
  if (!env?.TRADING_API_BASE_URL) {
    return [];
  }
  return ["env", `TRADING_API_BASE_URL=${env.TRADING_API_BASE_URL}`];
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
  return safeId(value, { maxLength: 80 });
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
