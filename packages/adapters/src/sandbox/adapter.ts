import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
  SandboxRecord,
  RuntimeProcessOwnershipRecord
} from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort,
  RuntimeProcessOwnershipReconcileResult
} from "@ouroboros/application/ports/runtime-process-ownership";
import { rebaseCandidateArenaArtifactPath } from
  "../artifact/candidate-arena-artifact-path";
import { safeId } from "../safe-id";
import {
  acquireCandidateSandboxNetworkPolicy,
  assertCandidateSandboxSbxVersion,
  CandidateSandboxNetworkPolicyError,
  parseCandidateSandboxSbxVersion,
  recoverCandidateSandboxNetworkPolicyRuleId,
  releaseCandidateSandboxNetworkPolicy,
  type CandidateSandboxNetworkPolicyLease
} from "@ouroboros/application/trading/research/candidate-sandbox-network-policy";

let commandEvidenceSequence = 0;

const DETERMINISTIC_FIXTURE_SYSTEM_CODE_ID = "fixture-system-code-clock-python-001";
const DETERMINISTIC_FIXTURE_ARTIFACT_PATH = "fixtures/trading-systems/clock.py";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OWNED_SANDBOX_PROCESS_GATE_SOURCE = String.raw`
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [gateFile, file, ...args] = process.argv.slice(1);
const deadline = Date.now() + 10000;
const timer = setInterval(() => {
  if (!fs.existsSync(gateFile)) {
    if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(78);
    }
    return;
  }
  clearInterval(timer);
  try { fs.unlinkSync(gateFile); } catch {}
  const child = spawn(file, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "ignore"
  });
  child.once("error", () => process.exit(127));
  child.once("exit", (code) => process.exit(code ?? 1));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => child.kill(signal));
  }
}, 5);
`;

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

interface PersistedCandidateSandboxNetworkPolicyLeaseV1 {
  schema_version: 1;
  allowed_resource: string;
}

interface PersistedCandidateSandboxNetworkPolicyLeaseV2 {
  schema_version: 2;
  allowed_resource?: string;
  inherited_allowed_resources: string[];
  owned_allow_rule_ids: string[];
  owned_deny_rule_ids: string[];
}

type PersistedCandidateSandboxNetworkPolicyLease =
  | PersistedCandidateSandboxNetworkPolicyLeaseV1
  | PersistedCandidateSandboxNetworkPolicyLeaseV2;

export class DeterministicSandboxAdapter implements SandboxAdapter {
  readonly kind = "deterministic_test" as const;
  private readonly sessions = new Map<
    string,
    {
      child: ReturnType<typeof spawn>;
      logFile: string;
      heartbeatFile: string;
      pidFile: string;
      ownership?: RuntimeProcessOwnershipRecord;
    }
  >();

  constructor(
    private readonly options: {
      commandTimeoutMs?: number;
      allowedSystemCodeIds?: readonly string[];
      allowedArtifactRoots?: readonly string[];
      allowedCapabilityPolicyIds?: readonly string[];
      processOwnership?: RuntimeProcessOwnershipPort;
      hostId?: string;
    } = {}
  ) {}

  async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
    const tickCount = Math.max(1, input.test_ticks ?? 2);
    const intervalMs = input.interval_ms ?? 1_000;
    const placement = sandboxPlacement(input.sandbox_placement_id);
    const command = normalizedSystemCodeCommand(input.artifact, systemCodeCommand(input.artifact), {
      allowedArtifactRoots: this.allowedArtifactRoots,
      allowedCapabilityPolicyIds: this.allowedCapabilityPolicyIds
    });
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
    if (input.test_ticks === undefined) {
      return this.startLongRunningArtifactInstance(input, command, placement);
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

  async getArtifactInstanceStatus(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
    const instanceId = instanceIdFor(instance);
    const session = this.sessions.get(instanceId);
    if (!session) {
      if (this.options.processOwnership) {
        const reconciliation = await this.reconcileOwnedSandbox(instance);
        const capturedAt = new Date().toISOString();
        const heartbeatLines = await readSandboxLogLines(
          deterministicSandboxHeartbeatFile(instanceId)
        );
        return {
          lifecycle_status: reconciliation.status === "adopted"
            ? "running"
            : sandboxLifecycleFromLines(heartbeatLines),
          heartbeats: heartbeatRecordsFromLines(
            instanceId,
            "status",
            heartbeatLines,
            capturedAt
          )
        };
      }
      return {};
    }
    const capturedAt = new Date().toISOString();
    const heartbeatLines = await readSandboxLogLines(session.heartbeatFile);
    const lifecycleStatus = childLifecycleStatus(session.child);
    if (session.ownership && lifecycleStatus !== "running") {
      await this.options.processOwnership?.close({
        ownership: session.ownership,
        terminalReason: lifecycleStatus === "stopped" ? "completed" : "crashed",
        closedAt: capturedAt
      });
      this.sessions.delete(instanceId);
    }
    return {
      lifecycle_status: lifecycleStatus,
      heartbeats: heartbeatRecordsFromLines(instanceId, "status", heartbeatLines, capturedAt)
    };
  }

  async getArtifactInstanceLogs(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
    const instanceId = instanceIdFor(instance);
    const session = this.sessions.get(instanceId);
    if (!session) {
      if (this.options.processOwnership) {
        const reconciliation = await this.reconcileOwnedSandbox(instance);
        const capturedAt = new Date().toISOString();
        const lines = await readSandboxLogLines(deterministicSandboxLogFile(instanceId));
        return {
          lifecycle_status: reconciliation.status === "adopted"
            ? "running"
            : sandboxLifecycleFromLines(lines),
          logs: lines.length > 0
            ? [runtimeLogRecord(instanceId, `logs-${safeRuntimeId(capturedAt)}`, lines, capturedAt)]
            : [],
          heartbeats: heartbeatRecordsFromLines(instanceId, "logs", lines, capturedAt)
        };
      }
      return {};
    }
    const capturedAt = new Date().toISOString();
    const lines = await readSandboxLogLines(session.logFile);
    return {
      lifecycle_status: childLifecycleStatus(session.child),
      logs: lines.length > 0
        ? [runtimeLogRecord(instanceId, `logs-${safeRuntimeId(capturedAt)}`, lines, capturedAt)]
        : [],
      heartbeats: heartbeatRecordsFromLines(instanceId, "logs", lines, capturedAt)
    };
  }

  async stopArtifactInstance(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<SandboxAdapterObservationResult> {
    const stoppedAt = new Date().toISOString();
    const instanceId = instanceIdFor(instance);
    const session = this.sessions.get(instanceId);
    if (session) {
      if (session.ownership && this.options.processOwnership) {
        await this.options.processOwnership.terminate({
          ownership: session.ownership,
          terminalReason: "shutdown",
          closedAt: stoppedAt
        });
      } else {
        await terminateChildProcess(session.child);
      }
      this.sessions.delete(instanceId);
      await removePersistedSandboxProcessFiles(session.pidFile);
      const lines = await readSandboxLogLines(session.logFile);
      return {
        lifecycle_status: "stopped",
        stopped_at: stoppedAt,
        logs: lines.length > 0
          ? [runtimeLogRecord(instanceId, `stop-${safeRuntimeId(stoppedAt)}`, lines, stoppedAt)]
          : [],
        heartbeats: heartbeatRecordsFromLines(instanceId, "stop", lines, stoppedAt)
      };
    }
    if (this.options.processOwnership) {
      const reconciliation = await this.reconcileOwnedSandbox(instance);
      if (reconciliation.status === "adopted") {
        await this.options.processOwnership.terminate({
          ownership: reconciliation.ownership,
          terminalReason: "shutdown",
          closedAt: stoppedAt
        });
      }
      await removePersistedSandboxProcessFiles(sandboxPidFile(instanceId));
      const lines = await readSandboxLogLines(deterministicSandboxLogFile(instanceId));
      return {
        lifecycle_status: "stopped",
        stopped_at: stoppedAt,
        logs: lines.length > 0
          ? [runtimeLogRecord(instanceId, `stop-${safeRuntimeId(stoppedAt)}`, lines, stoppedAt)]
          : [],
        heartbeats: heartbeatRecordsFromLines(instanceId, "stop", lines, stoppedAt)
      };
    }
    const pidFile = sandboxPidFile(instanceId);
    const persistedProcess = await readPersistedSandboxProcess(pidFile);
    if (persistedProcess && await isPersistedSandboxProcessCurrent(persistedProcess)) {
      if (signalProcessTree(persistedProcess.pid, "SIGTERM")) {
        await waitForProcessTreeExit(persistedProcess.pid, 500);
      }
      if (isProcessTreeAlive(persistedProcess.pid) && signalProcessTree(persistedProcess.pid, "SIGKILL")) {
        await waitForProcessTreeExit(persistedProcess.pid, 500);
      }
      await removePersistedSandboxProcessFiles(pidFile);
      const lines = await readSandboxLogLines(
        deterministicSandboxLogFile(instanceId)
      );
      return {
        lifecycle_status: "stopped",
        stopped_at: stoppedAt,
        logs: lines.length > 0
          ? [runtimeLogRecord(instanceId, `stop-${safeRuntimeId(stoppedAt)}`, lines, stoppedAt)]
          : [],
        heartbeats: heartbeatRecordsFromLines(instanceId, "stop", lines, stoppedAt)
      };
    }
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

  private async startLongRunningArtifactInstance(
    input: SandboxAdapterStartInput,
    command: string[],
    placement: SandboxPlacementRecord
  ): Promise<SandboxAdapterStartResult> {
    const logFile = deterministicSandboxLogFile(input.instance_id);
    const heartbeatFile = deterministicSandboxHeartbeatFile(input.instance_id);
    const pidFile = sandboxPidFile(input.instance_id);
    const executionCommand = [
      ...command,
      "--instance-id",
      input.instance_id,
      "--interval-ms",
      String(input.interval_ms ?? 1_000),
      "--log-file",
      logFile,
      "--heartbeat-file",
      heartbeatFile,
      "--start-at",
      input.created_at,
      "--paper-order-request",
      input.paper_order_request ?? "valid"
    ];
    const startedAt = new Date().toISOString();
    const [file, ...args] = executionCommand;
    if (!file) {
      const commandEvidence = commandEvidenceRecord(input.instance_id, "execute-detached", {
        command: executionCommand,
        exit_code: 2,
        stdout: "",
        stderr: "empty deterministic fixture command",
        started_at: startedAt,
        completed_at: startedAt
      });
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
    const expectedOwnership = this.options.processOwnership
      ? sandboxProcessExpectedIdentity(
        input,
        executionCommand,
        this.options.hostId ?? os.hostname()
      )
      : undefined;
    if (expectedOwnership && this.options.processOwnership) {
      const reconciliation = await this.options.processOwnership.reconcile({
        expected: expectedOwnership,
        mode: "adopt",
        reconciledAt: startedAt
      });
      if (reconciliation.status === "blocked") {
        throw new Error(`sandbox_process_ownership_${reconciliation.reason}`);
      }
      if (reconciliation.status === "adopted") {
        const heartbeatLines = await readSandboxLogLines(heartbeatFile);
        if (heartbeatLines.length === 0) {
          await releaseSandboxOwnershipGate(reconciliation.ownership.session_token);
        }
        const lines = await readSandboxLogLines(logFile);
        const heartbeats = heartbeatRecordsFromLines(
          input.instance_id,
          "adopt",
          heartbeatLines,
          startedAt
        );
        const commandEvidence = commandEvidenceRecord(input.instance_id, "adopt-owned-process", {
          command: [
            this.kind,
            "adopt-owned-process",
            reconciliation.ownership.runtime_process_ownership_id
          ],
          exit_code: null,
          stdout: "",
          stderr: "",
          started_at: startedAt,
          completed_at: startedAt
        });
        return {
          instance: sandboxSandboxRecord({
            adapterKind: this.kind,
            artifact: input.artifact,
            instanceId: input.instance_id,
            sandboxName: input.sandbox_name,
            runtimeRef: input.runtime_ref,
            placementId: placement.sandbox_placement_id,
            lifecycleStatus: "running",
            createdAt: input.created_at,
            startedAt: reconciliation.ownership.started_at,
            lastHeartbeatAt: heartbeats.at(-1)?.observed_at,
            logRefs: lines.length > 0
              ? [ref("sandbox_log", `sandbox-log-${sandboxEvidenceRuntimeId(input.instance_id)}-adopt`)]
              : [],
            heartbeatRefs: heartbeats.map((heartbeat) =>
              ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id)
            ),
            commandEvidenceRefs: [
              ref(commandEvidence.record_kind, commandEvidence.sandbox_command_evidence_id)
            ],
            traceRef: input.trace_ref
          }),
          placement,
          logs: lines.length > 0
            ? [runtimeLogRecord(input.instance_id, "adopt", lines, startedAt)]
            : [],
          heartbeats,
          command_evidence: [commandEvidence]
        };
      }
    } else {
      await this.stopExistingLongRunningSession(input.instance_id, pidFile);
    }
    await Promise.all([
      rm(logFile, { force: true }),
      rm(heartbeatFile, { force: true }),
      rm(pidFile, { force: true })
    ]);
    const sessionToken = expectedOwnership ? randomUUID() : undefined;
    const gateFile = sessionToken
      ? sandboxOwnershipGateFile(sessionToken)
      : undefined;
    if (gateFile) await rm(gateFile, { force: true });
    const child = spawn(
      gateFile ? process.execPath : file,
      gateFile
        ? ["-e", OWNED_SANDBOX_PROCESS_GATE_SOURCE, gateFile, file, ...args]
        : args,
      {
      cwd: REPO_ROOT,
      detached: true,
      stdio: "ignore",
      env: {
        ...sandboxRuntimeProcessEnv(input.env),
        ...(sessionToken
          ? { OUROBOROS_PROCESS_SESSION_TOKEN: sessionToken }
          : {})
      }
    });
    let spawnError: Error | undefined;
    await new Promise<void>((resolve) => {
      child.once("spawn", resolve);
      child.once("error", (error) => {
        spawnError = error;
        resolve();
      });
    });
    let ownership: RuntimeProcessOwnershipRecord | undefined;
    if (!spawnError && expectedOwnership && this.options.processOwnership &&
      sessionToken && child.pid !== undefined) {
      try {
        ownership = await this.options.processOwnership.claim({
          expected: expectedOwnership,
          processId: child.pid,
          sessionToken,
          startedAt
        });
        await releaseSandboxOwnershipGate(sessionToken);
      } catch (error) {
        await terminateChildProcess(child);
        throw error;
      }
    }
    const lines = spawnError ? [] : await waitForSandboxLogLines(logFile, 500);
    const heartbeats = heartbeatRecordsFromLines(input.instance_id, "start", lines, startedAt);
    const lifecycleStatus = spawnError ? "failed" : childLifecycleStatus(child);
    if (lifecycleStatus === "running") {
      child.unref();
      if (!ownership && child.pid !== undefined) {
        await writePersistedSandboxProcess(pidFile, {
          pid: child.pid,
          instance_id: input.instance_id,
          command: executionCommand,
          started_at: startedAt
        });
      }
      const session = { child, logFile, heartbeatFile, pidFile, ownership };
      this.sessions.set(input.instance_id, session);
    } else if (ownership && this.options.processOwnership) {
      await this.options.processOwnership.close({
        ownership,
        terminalReason: lifecycleStatus === "stopped" ? "completed" : "crashed",
        closedAt: new Date().toISOString()
      });
    }
    const commandEvidence = commandEvidenceRecord(input.instance_id, "execute-detached", {
      command: executionCommand,
      exit_code: lifecycleStatus === "running" ? null : child.exitCode ?? 1,
      stdout: "",
      stderr: spawnError?.message ?? (child.signalCode ? `terminated by ${child.signalCode}` : ""),
      started_at: startedAt,
      completed_at: startedAt
    });
    return {
      instance: sandboxSandboxRecord({
        adapterKind: this.kind,
        artifact: input.artifact,
        instanceId: input.instance_id,
        sandboxName: input.sandbox_name,
        runtimeRef: input.runtime_ref,
        placementId: placement.sandbox_placement_id,
        lifecycleStatus: lifecycleStatus === "running" ? "running" : "failed",
        createdAt: input.created_at,
        startedAt: lifecycleStatus === "running" ? input.created_at : undefined,
        lastHeartbeatAt: heartbeats.at(-1)?.observed_at,
        logRefs: lines.length > 0
          ? [ref(
              "sandbox_log",
              `sandbox-log-${sandboxEvidenceRuntimeId(input.instance_id)}-start`
            )]
          : [],
        heartbeatRefs: heartbeats.map((heartbeat) => ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id)),
        commandEvidenceRefs: [ref(commandEvidence.record_kind, commandEvidence.sandbox_command_evidence_id)],
        traceRef: input.trace_ref
      }),
      placement,
      logs: lines.length > 0
        ? [runtimeLogRecord(input.instance_id, "start", lines, startedAt)]
        : [],
      heartbeats,
      command_evidence: [commandEvidence]
    };
  }

  private async reconcileOwnedSandbox(
    instance: SandboxRecord | SandboxDetailReadModel
  ): Promise<RuntimeProcessOwnershipReconcileResult> {
    const processOwnership = this.options.processOwnership;
    if (!processOwnership) return { status: "vacant" };
    const scope = sandboxProcessOwnershipScope(instanceIdFor(instance));
    const active = await processOwnership.active(scope);
    if (!active) return { status: "vacant" };
    const runtimeRef = sandboxRuntimeRef(instance);
    if (!sameRef(active.runtime_ref, runtimeRef) ||
      active.owner.host_id !== (this.options.hostId ?? os.hostname())) {
      throw new Error("sandbox_process_ownership_identity_mismatch");
    }
    const reconciliation = await processOwnership.reconcile({
      expected: expectedIdentityFromOwnership(active),
      mode: "adopt",
      reconciledAt: new Date().toISOString()
    });
    if (reconciliation.status === "blocked") {
      throw new Error(`sandbox_process_ownership_${reconciliation.reason}`);
    }
    if (reconciliation.status === "adopted") {
      const heartbeatLines = await readSandboxLogLines(
        deterministicSandboxHeartbeatFile(instanceIdFor(instance))
      );
      if (heartbeatLines.length === 0) {
        await releaseSandboxOwnershipGate(reconciliation.ownership.session_token);
      }
    }
    return reconciliation;
  }

  private async stopExistingLongRunningSession(instanceId: string, pidFile: string): Promise<void> {
    const session = this.sessions.get(instanceId);
    if (session) {
      await terminateChildProcess(session.child);
      this.sessions.delete(instanceId);
      await removePersistedSandboxProcessFiles(session.pidFile);
      return;
    }
    const persistedProcess = await readPersistedSandboxProcess(pidFile);
    if (!persistedProcess || !await isPersistedSandboxProcessCurrent(persistedProcess)) {
      await removePersistedSandboxProcessFiles(pidFile);
      return;
    }
    if (signalProcessTree(persistedProcess.pid, "SIGTERM")) {
      await waitForProcessTreeExit(persistedProcess.pid, 500);
    }
    if (isProcessTreeAlive(persistedProcess.pid) && signalProcessTree(persistedProcess.pid, "SIGKILL")) {
      await waitForProcessTreeExit(persistedProcess.pid, 500);
    }
    await removePersistedSandboxProcessFiles(pidFile);
  }
}

export class DockerSandboxesSbxSandboxAdapter implements SandboxAdapter {
  readonly kind = "docker_sandboxes_sbx" as const;
  private readonly networkPolicyLeases = new Map<
    string,
    CandidateSandboxNetworkPolicyLease<CommandResult>
  >();

  constructor(
    private readonly options: {
      sbxPath?: string;
      sbxHome?: string;
      workspacePath?: string;
      commandTimeoutMs?: number;
      startupHeartbeatTimeoutMs?: number;
      startupHeartbeatPollIntervalMs?: number;
      networkPolicyStatePath?: string;
    } = {}
  ) {}

  async startArtifactInstance(input: SandboxAdapterStartInput): Promise<SandboxAdapterStartResult> {
    assertSafeSbxSandboxName(input.sandbox_name);
    const createdAt = input.created_at;
    const placement = sandboxPlacement(input.sandbox_placement_id);
    const artifactPath = artifactEntrypointPath(input.artifact);
    const logFile = sandboxLogFile(input.instance_id);
    const heartbeatFile = sandboxHeartbeatFile(input.instance_id);
    const versionCommand = [this.sbxPath, "version"];
    const versionResult = await this.runSbxCommand(versionCommand);
    const versionEvidence = commandEvidenceRecord(input.instance_id, "version", versionResult);
    const sandboxImplementationVersion = parseCandidateSandboxSbxVersion(
      versionResult.stdout
    );
    if (
      versionResult.exit_code !== 0 ||
      !sandboxImplementationVersion ||
      !candidateSbxVersionSupported(versionResult.stdout)
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
    const networkPolicyResults: CommandResult[] = [];
    let networkPolicy: CandidateSandboxNetworkPolicyLease<CommandResult> | undefined;
    try {
      const persistedNetworkPolicy = await this.readPersistedNetworkPolicyLease(input.sandbox_name);
      if (persistedNetworkPolicy) {
        try {
          await this.releasePersistedNetworkPolicy(
            input.sandbox_name,
            persistedNetworkPolicy,
            (result) => networkPolicyResults.push(result)
          );
          await this.removePersistedNetworkPolicyLease(input.sandbox_name);
        } catch (error) {
          if (
            error instanceof CandidateSandboxNetworkPolicyError &&
            error.code !== "policy_cleanup_failed"
          ) {
            await this.removePersistedNetworkPolicyLease(input.sandbox_name);
          }
          throw error;
        }
      }
      networkPolicy = await acquireCandidateSandboxNetworkPolicy({
        sbx_path: this.sbxPath,
        sandbox_name: input.sandbox_name,
        sandbox_implementation_version: sandboxImplementationVersion,
        ...(input.env?.TRADING_API_BASE_URL
          ? { gateway_base_url: input.env.TRADING_API_BASE_URL }
          : {}),
        run_command: (command) => this.runSbxCommand(command),
        on_evidence: (result) => networkPolicyResults.push(result)
      });
      await this.persistNetworkPolicyLease(input.sandbox_name, networkPolicy);
      this.networkPolicyLeases.set(input.sandbox_name, networkPolicy);
    } catch {
      if (networkPolicy) {
        try {
          await networkPolicy.release();
        } catch {
          // Release evidence is retained below and the instance remains failed.
        }
      }
      const stopResult = await this.runSbxCommand([this.sbxPath, "stop", input.sandbox_name]);
      const removeResult = await this.runSbxCommand([
        this.sbxPath,
        "rm",
        "--force",
        input.sandbox_name
      ]);
      const policyEvidence = networkPolicyResults.map((result, index) =>
        commandEvidenceRecord(
          input.instance_id,
          commandEvidenceSuffix("network-policy-" + String(index + 1), result),
          result
        )
      );
      const cleanupEvidence = [
        commandEvidenceRecord(
          input.instance_id,
          commandEvidenceSuffix("network-policy-startup-stop", stopResult),
          stopResult
        ),
        commandEvidenceRecord(
          input.instance_id,
          commandEvidenceSuffix("network-policy-startup-remove", removeResult),
          removeResult
        )
      ];
      const commandEvidence = [
        versionEvidence,
        createEvidence,
        ...policyEvidence,
        ...cleanupEvidence
      ];
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
          commandEvidenceRefs: commandEvidence.map((evidence) =>
            ref(evidence.record_kind, evidence.sandbox_command_evidence_id)
          ),
          traceRef: input.trace_ref
        }),
        placement,
        logs: [],
        heartbeats: [],
        command_evidence: commandEvidence
      };
    }
    const networkPolicyEvidence = networkPolicyResults.map((result, index) =>
      commandEvidenceRecord(
        input.instance_id,
        commandEvidenceSuffix("network-policy-" + String(index + 1), result),
        result
      )
    );
    if (!networkPolicy) {
      throw new Error("candidate_network_policy_lease_missing");
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
      "--start-at",
      input.created_at,
      "--paper-order-request",
      input.paper_order_request ?? "valid",
      ...(input.test_ticks !== undefined ? ["--ticks", String(input.test_ticks)] : [])
    ];
    const execResult = await this.runSbxCommand(execCommand);
    const startupEvidence = createResult.exit_code === 0 && execResult.exit_code === 0
      ? await this.readStartupEvidence(input.instance_id, input.sandbox_name, {
        allowStoppedLog: input.test_ticks !== undefined
      })
      : { heartbeats: [], logs: [], commandEvidence: [] };
    const lifecycleStatus = createResult.exit_code === 0 &&
      execResult.exit_code === 0
      ? startupEvidence.heartbeats.length > 0
        ? "running"
        : startupEvidence.stopped_at
          ? "stopped"
          : "failed"
      : "failed";
    const stopResult = lifecycleStatus === "failed"
      ? await this.runSbxCommand([this.sbxPath, "stop", input.sandbox_name])
      : undefined;
    const terminalPolicyResultStart = networkPolicyResults.length;
    let terminalPolicyFailure: unknown;
    let removeResult: CommandResult | undefined;
    if (lifecycleStatus !== "running") {
      try {
        await networkPolicy.release();
      } catch (error) {
        terminalPolicyFailure = error;
      }
      removeResult = await this.runSbxCommand([
        this.sbxPath,
        "rm",
        "--force",
        input.sandbox_name
      ]);
      this.networkPolicyLeases.delete(input.sandbox_name);
      if (!terminalPolicyFailure && removeResult.exit_code === 0) {
        await this.removePersistedNetworkPolicyLease(input.sandbox_name);
      }
    }
    const terminalPolicyEvidence = networkPolicyResults
      .slice(terminalPolicyResultStart)
      .map((result, index) =>
        commandEvidenceRecord(
          input.instance_id,
          commandEvidenceSuffix("network-policy-terminal-" + String(index + 1), result),
          result
        )
      );
    const finalLifecycleStatus = terminalPolicyFailure ||
      (removeResult !== undefined && removeResult.exit_code !== 0)
      ? "failed"
      : lifecycleStatus;
    const commandEvidence = [
      versionEvidence,
      createEvidence,
      ...networkPolicyEvidence,
      commandEvidenceRecord(input.instance_id, "exec-detached", execResult),
      ...startupEvidence.commandEvidence,
      ...(stopResult
        ? [commandEvidenceRecord(input.instance_id, commandEvidenceSuffix("startup-stop", stopResult), stopResult)]
        : []),
      ...terminalPolicyEvidence,
      ...(removeResult
        ? [commandEvidenceRecord(
            input.instance_id,
            commandEvidenceSuffix("startup-remove", removeResult),
            removeResult
          )]
        : [])
    ];
    const instance = sandboxSandboxRecord({
      adapterKind: this.kind,
      artifact: input.artifact,
      instanceId: input.instance_id,
      sandboxName: input.sandbox_name,
      runtimeRef: input.runtime_ref,
      placementId: placement.sandbox_placement_id,
      lifecycleStatus: finalLifecycleStatus,
      createdAt,
      startedAt: finalLifecycleStatus !== "failed" ? createdAt : undefined,
      stoppedAt: finalLifecycleStatus === "stopped" ? startupEvidence.stopped_at : undefined,
      lastHeartbeatAt: startupEvidence.heartbeats.at(-1)?.observed_at,
      logRefs: startupEvidence.logs.map((log) => ref(log.record_kind, log.sandbox_log_id)),
      heartbeatRefs: startupEvidence.heartbeats.map((heartbeat) =>
        ref(heartbeat.record_kind, heartbeat.runtime_heartbeat_id)
      ),
      commandEvidenceRefs: commandEvidence.map((evidence) => (
        ref(evidence.record_kind, evidence.sandbox_command_evidence_id)
      )),
      traceRef: input.trace_ref
    });

    return {
      instance,
      placement,
      logs: startupEvidence.logs,
      heartbeats: startupEvidence.heartbeats,
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
    const policyRelease = await this.releaseNetworkPolicy(sandboxName);
    const stopped = stopResult.exit_code === 0 &&
      !policyRelease.failure;
    return {
      lifecycle_status: stopped ? "stopped" : "failed",
      stopped_at: stopped ? stopResult.completed_at || stopStartedAt : undefined,
      command_evidence: [
        versionObservation.evidence,
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("terminate", terminateResult), terminateResult),
        commandEvidenceRecord(instanceId, commandEvidenceSuffix("stop", stopResult), stopResult),
        ...policyRelease.results.map((result, index) =>
          commandEvidenceRecord(
            instanceId,
            commandEvidenceSuffix("network-policy-stop-" + String(index + 1), result),
            result
          )
        )
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

  private get startupHeartbeatTimeoutMs(): number {
    return this.options.startupHeartbeatTimeoutMs ?? this.commandTimeoutMs;
  }

  private get startupHeartbeatPollIntervalMs(): number {
    return this.options.startupHeartbeatPollIntervalMs ?? 500;
  }

  private get sbxHome(): string | undefined {
    return this.options.sbxHome ?? process.env.OUROBOROS_SBX_HOME;
  }

  private get networkPolicyStatePath(): string {
    return this.options.networkPolicyStatePath ??
      path.join(this.sbxHome ?? os.homedir(), ".ouroboros", "candidate-network-policy-leases");
  }

  private runSbxCommand(command: string[]): Promise<CommandResult> {
    return runCommand(command, this.commandTimeoutMs, this.sbxHome ? { HOME: this.sbxHome } : undefined);
  }

  private async persistNetworkPolicyLease(
    sandboxName: string,
    lease: CandidateSandboxNetworkPolicyLease<CommandResult>
  ): Promise<void> {
    if (!lease.owned_rule) {
      await this.removePersistedNetworkPolicyLease(sandboxName);
      return;
    }
    await mkdir(this.networkPolicyStatePath, { recursive: true, mode: 0o700 });
    const target = this.networkPolicyLeaseFile(sandboxName);
    const temporary = target + "." + String(process.pid) + ".tmp";
    try {
      await writeFile(temporary, JSON.stringify({
        version: 2,
        sandbox_name: sandboxName,
        ...(lease.allowed_resource ? { allowed_resource: lease.allowed_resource } : {}),
        inherited_allowed_resources: [...lease.inherited_allowed_resources],
        owned_allow_rule_ids: [...lease.owned_allow_rule_ids],
        owned_deny_rule_ids: [...lease.owned_deny_rule_ids]
      }) + "\n", { encoding: "utf8", mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async releasePersistedNetworkPolicy(
    sandboxName: string,
    persisted: PersistedCandidateSandboxNetworkPolicyLease,
    onEvidence?: (result: CommandResult) => void
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];
    const record = (result: CommandResult): void => {
      results.push(result);
      onEvidence?.(result);
    };
    const ownedAllowRuleIds = persisted.schema_version === 1
      ? [await recoverCandidateSandboxNetworkPolicyRuleId({
        sbx_path: this.sbxPath,
        sandbox_name: sandboxName,
        decision: "allow",
        resources: [persisted.allowed_resource],
        run_command: (command) => this.runSbxCommand(command),
        on_evidence: record
      })]
      : persisted.owned_allow_rule_ids;
    await releaseCandidateSandboxNetworkPolicy({
      sbx_path: this.sbxPath,
      sandbox_name: sandboxName,
      owned_allow_rule_ids: ownedAllowRuleIds,
      owned_deny_rule_ids: persisted.schema_version === 2
        ? persisted.owned_deny_rule_ids
        : [],
      run_command: (command) => this.runSbxCommand(command),
      on_evidence: record
    });
    return results;
  }

  private async releaseNetworkPolicy(sandboxName: string): Promise<{
    results: CommandResult[];
    failure?: unknown;
  }> {
    const lease = this.networkPolicyLeases.get(sandboxName);
    let results: CommandResult[] = [];
    let failure: unknown;
    try {
      if (lease) {
        results = await lease.release();
      } else {
        const persisted = await this.readPersistedNetworkPolicyLease(sandboxName);
        results = persisted
          ? await this.releasePersistedNetworkPolicy(sandboxName, persisted)
          : await releaseCandidateSandboxNetworkPolicy({
            sbx_path: this.sbxPath,
            sandbox_name: sandboxName,
            run_command: (command) => this.runSbxCommand(command)
          });
      }
    } catch (error) {
      failure = error;
      if (error instanceof CandidateSandboxNetworkPolicyError) {
        results = error.command_results as CommandResult[];
      }
    } finally {
      this.networkPolicyLeases.delete(sandboxName);
    }
    if (
      !failure ||
      (failure instanceof CandidateSandboxNetworkPolicyError &&
        failure.code !== "policy_cleanup_failed")
    ) {
      await this.removePersistedNetworkPolicyLease(sandboxName);
    }
    return { results, ...(failure ? { failure } : {}) };
  }

  private async readPersistedNetworkPolicyLease(
    sandboxName: string
  ): Promise<PersistedCandidateSandboxNetworkPolicyLease | undefined> {
    try {
      const parsed = JSON.parse(
        await readFile(this.networkPolicyLeaseFile(sandboxName), "utf8")
      ) as Record<string, unknown>;
      if (parsed.sandbox_name !== sandboxName) {
        throw new Error("candidate_network_policy_lease_invalid");
      }
      if (
        parsed.version === 1 &&
        typeof parsed.allowed_resource === "string" &&
        validPersistedCandidateGatewayResource(parsed.allowed_resource)
      ) {
        return {
          schema_version: 1,
          allowed_resource: parsed.allowed_resource
        };
      }
      if (parsed.version !== 2 || !validPersistedCandidateNetworkPolicyLeaseV2(parsed)) {
        throw new Error("candidate_network_policy_lease_invalid");
      }
      return {
        schema_version: 2,
        ...(typeof parsed.allowed_resource === "string"
          ? { allowed_resource: parsed.allowed_resource }
          : {}),
        inherited_allowed_resources: [...parsed.inherited_allowed_resources],
        owned_allow_rule_ids: [...parsed.owned_allow_rule_ids],
        owned_deny_rule_ids: [...parsed.owned_deny_rule_ids]
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  private removePersistedNetworkPolicyLease(sandboxName: string): Promise<void> {
    return rm(this.networkPolicyLeaseFile(sandboxName), { force: true });
  }

  private networkPolicyLeaseFile(sandboxName: string): string {
    return path.join(this.networkPolicyStatePath, sandboxName + ".json");
  }

  private async readStartupEvidence(
    instanceId: string,
    sandboxName: string,
    options: { allowStoppedLog?: boolean } = {}
  ): Promise<{
    heartbeats: RuntimeHeartbeatRecord[];
    logs: SandboxLogRecord[];
    stopped_at?: string;
    commandEvidence: SandboxCommandEvidenceRecord[];
  }> {
    const commandEvidence: SandboxCommandEvidenceRecord[] = [];
    const deadlineAt = Date.now() + Math.max(0, this.startupHeartbeatTimeoutMs);
    let attempt = 0;
    do {
      if (attempt > 0) {
        const remainingMs = Math.max(0, deadlineAt - Date.now());
        await sleep(Math.min(this.startupHeartbeatPollIntervalMs, remainingMs));
      }
      const result = await this.runSbxCommand([
        this.sbxPath,
        "exec",
        sandboxName,
        "cat",
        sandboxHeartbeatFile(instanceId)
      ]);
      commandEvidence.push(commandEvidenceRecord(
        instanceId,
        commandEvidenceSuffix(`startup-heartbeat-${attempt + 1}`, result),
        result
      ));
      const heartbeats = heartbeatRecordsFromLines(
        instanceId,
        `startup-heartbeat-${attempt + 1}`,
        stdoutLines(result.stdout),
        result.completed_at
      );
      if (heartbeats.length > 0) {
        return { heartbeats, logs: [], commandEvidence };
      }
      if (options.allowStoppedLog) {
        const logResult = await this.runSbxCommand([
          this.sbxPath,
          "exec",
          sandboxName,
          "cat",
          sandboxLogFile(instanceId)
        ]);
        commandEvidence.push(commandEvidenceRecord(
          instanceId,
          commandEvidenceSuffix(`startup-log-${attempt + 1}`, logResult),
          logResult
        ));
        const lines = stdoutLines(logResult.stdout);
        const stoppedAt = runtimeStoppedAtFromLines(instanceId, lines, logResult.completed_at);
        if (stoppedAt) {
          return {
            heartbeats: [],
            logs: lines.length > 0
              ? [runtimeLogRecord(instanceId, `startup-log-${safeRuntimeId(logResult.completed_at)}`, lines, logResult.completed_at)]
              : [],
            stopped_at: stoppedAt,
            commandEvidence
          };
        }
      }
      attempt += 1;
    } while (Date.now() < deadlineAt);
    return { heartbeats: [], logs: [], commandEvidence };
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
    if (result.exit_code === 0 && candidateSbxVersionSupported(result.stdout)) {
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

function validPersistedCandidateNetworkPolicyLeaseV2(
  value: Record<string, unknown>
): value is Record<string, unknown> & Omit<
  PersistedCandidateSandboxNetworkPolicyLeaseV2,
  "schema_version"
> {
  const allowedResource = value.allowed_resource;
  const inheritedResources = value.inherited_allowed_resources;
  const allowRuleIds = value.owned_allow_rule_ids;
  const denyRuleIds = value.owned_deny_rule_ids;
  if (
    (allowedResource !== undefined && (
      typeof allowedResource !== "string" ||
      !validPersistedCandidateGatewayResource(allowedResource)
    )) ||
    !Array.isArray(inheritedResources) ||
    !validPersistedCandidateNetworkResources(inheritedResources) ||
    !Array.isArray(allowRuleIds) ||
    !validPersistedCandidateNetworkRuleIds(allowRuleIds) ||
    !Array.isArray(denyRuleIds) ||
    !validPersistedCandidateNetworkRuleIds(denyRuleIds)
  ) {
    return false;
  }
  return (
    Boolean(allowedResource) === (allowRuleIds.length > 0) &&
    (inheritedResources.length > 0) === (denyRuleIds.length > 0) &&
    allowRuleIds.length + denyRuleIds.length > 0
  );
}

function validPersistedCandidateGatewayResource(value: string): boolean {
  const match = /^localhost:(\d{4,5})$/.exec(value);
  if (!match) {
    return false;
  }
  const port = Number(match[1]);
  return Number.isInteger(port) && port >= 1024 && port <= 65_535;
}

function validPersistedCandidateNetworkResources(value: unknown[]): value is string[] {
  if (
    value.length > 512 ||
    value.some((resource) =>
      typeof resource !== "string" ||
      resource.length === 0 ||
      resource.length > 1_024 ||
      resource !== resource.trim() ||
      resource.includes(",") ||
      /[\u0000-\u001f\u007f]/.test(resource)
    )
  ) {
    return false;
  }
  const resources = value as string[];
  return (
    resources.join(",").length <= 32_768 &&
    resources.every((resource, index) => index === 0 || resources[index - 1]! < resource)
  );
}

function validPersistedCandidateNetworkRuleId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(value);
}

function validPersistedCandidateNetworkRuleIds(value: unknown[]): value is string[] {
  if (
    value.length > 512 ||
    value.some((ruleId) =>
      typeof ruleId !== "string" || !validPersistedCandidateNetworkRuleId(ruleId)
    )
  ) {
    return false;
  }
  const ruleIds = value as string[];
  return ruleIds.every((ruleId, index) => index === 0 || ruleIds[index - 1]! < ruleId);
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
    sandbox_log_id: `sandbox-log-${sandboxEvidenceRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
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
    runtime_heartbeat_id: `runtime-heartbeat-${sandboxEvidenceRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
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
    sandbox_command_evidence_id: `sandbox-command-evidence-${sandboxEvidenceRuntimeId(instanceId)}-${safeRuntimeId(suffix)}`,
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

function runtimeStoppedAtFromLines(
  instanceId: string,
  lines: string[],
  capturedAt: string
): string | undefined {
  for (const line of lines) {
    try {
      const value = JSON.parse(line) as { event?: unknown; instance_id?: unknown; at?: unknown };
      if (value.event === "runtime_stopped" && value.instance_id === instanceId) {
        return typeof value.at === "string" ? value.at : capturedAt;
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function candidateSbxVersionSupported(stdout: string): boolean {
  try {
    assertCandidateSandboxSbxVersion(stdout);
    return true;
  } catch {
    return false;
  }
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
    !input.allowedCapabilityPolicyIds.includes(artifact.capability_policy_ref.id)
  ) {
    return false;
  }

  const artifactPath = resolveGeneratedPaperScriptPath(artifact.artifact_path, input.allowedArtifactRoots);
  return isPythonGeneratedCommand(command, artifactPath, input.allowedArtifactRoots) &&
    input.allowedArtifactRoots.some((root) => isPathWithin(artifactPath, root));
}

function isPythonFixtureCommand(command: string[]): boolean {
  return (
    command.length >= 2 &&
    (command[0] === "python" || command[0] === "python3") &&
    command[1] === DETERMINISTIC_FIXTURE_ARTIFACT_PATH
  );
}

function isPythonGeneratedCommand(
  command: string[],
  artifactPath: string,
  allowedArtifactRoots: readonly string[] = []
): boolean {
  if (command.length < 2 || (command[0] !== "python" && command[0] !== "python3")) {
    return false;
  }
  return resolvePythonScriptPathCandidates(command[1]!, allowedArtifactRoots).includes(path.normalize(artifactPath));
}

function resolvePythonScriptPath(scriptPath: string): string {
  return path.isAbsolute(scriptPath) ? path.normalize(scriptPath) : path.resolve(REPO_ROOT, scriptPath);
}

function normalizedSystemCodeCommand(
  artifact: SystemCodeRecord,
  command: string[],
  input: {
    allowedArtifactRoots: readonly string[];
    allowedCapabilityPolicyIds: readonly string[];
  }
): string[] {
  if (
    artifact.artifact_kind !== "python_file" ||
    artifact.runtime_kind !== "python" ||
    !artifact.capability_policy_ref ||
    !input.allowedCapabilityPolicyIds.includes(artifact.capability_policy_ref.id) ||
    command.length < 2 ||
    (command[0] !== "python" && command[0] !== "python3")
  ) {
    return command;
  }
  const artifactPath = resolveGeneratedPaperScriptPath(artifact.artifact_path, input.allowedArtifactRoots);
  return isPythonGeneratedCommand(command, artifactPath, input.allowedArtifactRoots)
    ? [command[0]!, artifactPath, ...command.slice(2)]
    : command;
}

function resolveGeneratedPaperScriptPath(scriptPath: string, allowedArtifactRoots: readonly string[]): string {
  return resolvePythonScriptPathCandidates(scriptPath, allowedArtifactRoots)
    .find((candidate) => allowedArtifactRoots.some((root) => isPathWithin(candidate, root)))
    ?? resolvePythonScriptPath(scriptPath);
}

function resolvePythonScriptPathCandidates(
  scriptPath: string,
  allowedArtifactRoots: readonly string[] = []
): string[] {
  if (path.isAbsolute(scriptPath)) {
    const normalized = path.normalize(scriptPath);
    return [...new Set([
      ...allowedArtifactRoots.flatMap((root) => {
        const rebased = rebaseCandidateArenaArtifactPath(normalized, root);
        return rebased ? [rebased] : [];
      }),
      normalized
    ])];
  }
  const candidates = allowedArtifactRoots.some((root) =>
    !path.isAbsolute(root) && isRelativePathWithin(scriptPath, root)
  )
    ? [path.resolve(scriptPath), path.resolve(REPO_ROOT, scriptPath)]
    : [path.resolve(REPO_ROOT, scriptPath)];
  return [...new Set(candidates.map((candidate) => path.normalize(candidate)))];
}

function isPathWithin(filePath: string, root: string): boolean {
  const resolvedRoot = path.resolve(root);
  const relativePath = path.relative(resolvedRoot, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isRelativePathWithin(filePath: string, root: string): boolean {
  const relativePath = path.relative(path.normalize(root), path.normalize(filePath));
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

function deterministicSandboxLogFile(instanceId: string): string {
  return `/tmp/ouroboros-${sandboxRuntimeFileKey(instanceId)}.jsonl`;
}

function deterministicSandboxHeartbeatFile(instanceId: string): string {
  return `/tmp/ouroboros-${sandboxRuntimeFileKey(instanceId)}.heartbeat.json`;
}

function sandboxProcessExpectedIdentity(
  input: SandboxAdapterStartInput,
  command: string[],
  hostId: string
): RuntimeProcessExpectedIdentity {
  const runtimeRef = input.runtime_ref ?? {
    record_kind: "sandbox",
    id: input.instance_id
  };
  return {
    ...sandboxProcessOwnershipScope(input.instance_id),
    runtime_ref: { ...runtimeRef },
    host_id: hostId,
    executable: process.execPath,
    profile_digest: `sha256:${createHash("sha256").update(JSON.stringify({
      adapter_kind: "deterministic_test",
      system_code_id: input.artifact.system_code_id,
      system_code_artifact_digest: input.artifact.artifact_digest,
      sandbox_name: input.sandbox_name,
      sandbox_placement_id: input.sandbox_placement_id,
      runtime_ref: runtimeRef,
      command,
      trading_api_base_url: input.env?.TRADING_API_BASE_URL ?? null
    })).digest("hex")}`
  };
}

function sandboxProcessOwnershipScope(instanceId: string): {
  process_kind: "candidate_sandbox";
  subject_ref: Ref;
} {
  return {
    process_kind: "candidate_sandbox",
    subject_ref: { record_kind: "sandbox", id: instanceId }
  };
}

function sandboxRuntimeRef(
  instance: SandboxRecord | SandboxDetailReadModel
): Ref {
  return instance.runtime_ref
    ? { ...instance.runtime_ref }
    : { record_kind: "sandbox", id: instanceIdFor(instance) };
}

function expectedIdentityFromOwnership(
  ownership: RuntimeProcessOwnershipRecord
): RuntimeProcessExpectedIdentity {
  return {
    process_kind: ownership.process_kind,
    subject_ref: { ...ownership.subject_ref },
    runtime_ref: { ...ownership.runtime_ref },
    host_id: ownership.owner.host_id,
    executable: ownership.executable,
    profile_digest: ownership.profile_digest
  };
}

function sameRef(left: Ref, right: Ref): boolean {
  return left.record_kind === right.record_kind && left.id === right.id;
}

function sandboxOwnershipGateFile(sessionToken: string): string {
  const tokenDigest = createHash("sha256").update(sessionToken).digest("hex");
  return path.join(os.tmpdir(), `ouroboros-sandbox-ownership-${tokenDigest}.gate`);
}

async function releaseSandboxOwnershipGate(sessionToken: string): Promise<void> {
  const gateFile = sandboxOwnershipGateFile(sessionToken);
  await writeFile(gateFile, "go\n", { encoding: "utf8", mode: 0o600 });
  const startedAt = Date.now();
  while (Date.now() - startedAt < 500) {
    const consumed = await readFile(gateFile, "utf8").then(
      () => false,
      (error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
        throw error;
      }
    );
    if (consumed) return;
    await sleep(5);
  }
  await rm(gateFile, { force: true });
}

function sandboxLifecycleFromLines(lines: string[]): SandboxLifecycleStatus {
  return lines.some((line) => line.includes('"event":"runtime_stopped"') ||
    line.includes('"event": "runtime_stopped"'))
    ? "stopped"
    : "failed";
}

function sandboxPidFile(instanceId: string): string {
  return path.join(
    REPO_ROOT,
    ".ouroboros",
    "sandbox-pids",
    `${sandboxRuntimeFileKey(instanceId)}.pid`
  );
}

function sandboxRuntimeFileKey(instanceId: string): string {
  const digest = createHash("sha256").update(instanceId).digest("hex").slice(0, 12);
  return `${safeRuntimeId(instanceId)}-${digest}`;
}

function sandboxEvidenceRuntimeId(instanceId: string): string {
  const bounded = safeRuntimeId(instanceId);
  const complete = safeId(instanceId, {
    maxLength: Math.max(80, instanceId.length * 2)
  });
  return complete === bounded
    ? bounded
    : sandboxRuntimeFileKey(instanceId);
}

function instanceIdFor(instance: SandboxRecord | SandboxDetailReadModel): string {
  return instance.sandbox_id;
}

function sandboxNameFor(instance: SandboxRecord | SandboxDetailReadModel): string {
  assertSafeSbxSandboxName(instance.sandbox_name);
  return instance.sandbox_name;
}

function assertSafeSbxSandboxName(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(value)) {
    throw new Error("invalid_sbx_sandbox_name");
  }
}

function sandboxRuntimeProcessEnv(overrides: SandboxRuntimeEnv | undefined): NodeJS.ProcessEnv {
  return stripUndefinedEnv({
    ...baseProcessEnv(),
    ...overrides
  });
}

function sandboxToolProcessEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env = baseProcessEnv();
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (key.startsWith("SBX_") || key.startsWith("OUROBOROS_SBX_") || key.startsWith("OUROBOROS_SDX_"))) {
      env[key] = value;
    }
  }
  return stripUndefinedEnv({
    ...env,
    ...overrides
  });
}

function baseProcessEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "COMSPEC", "PATHEXT"]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  return env;
}

function stripUndefinedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
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
        env: sandboxRuntimeProcessEnv(input.env)
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

async function readSandboxLogLines(logFile: string): Promise<string[]> {
  const content = await readFile(logFile, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  });
  return stdoutLines(content);
}

async function waitForSandboxLogLines(logFile: string, timeoutMs: number): Promise<string[]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const lines = await readSandboxLogLines(logFile);
    if (lines.length > 0) {
      return lines;
    }
    await sleep(10);
  }
  return readSandboxLogLines(logFile);
}

interface PersistedSandboxProcess {
  pid: number;
  instance_id: string;
  command: string[];
  started_at: string;
}

async function writePersistedSandboxProcess(
  pidFile: string,
  processRecord: PersistedSandboxProcess
): Promise<void> {
  await mkdir(path.dirname(pidFile), { recursive: true });
  await writeFile(pidFile, String(processRecord.pid), "utf8");
  await writeFile(`${pidFile}.json`, `${JSON.stringify(processRecord)}\n`, "utf8");
}

async function removePersistedSandboxProcessFiles(pidFile: string): Promise<void> {
  await rm(pidFile, { force: true });
  await rm(`${pidFile}.json`, { force: true });
}

async function readPersistedSandboxPid(pidFile: string): Promise<number | undefined> {
  const content = await readFile(pidFile, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  });
  const pid = Number(content.trim());
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

async function readPersistedSandboxProcess(pidFile: string): Promise<PersistedSandboxProcess | undefined> {
  const pid = await readPersistedSandboxPid(pidFile);
  if (pid === undefined) {
    return undefined;
  }
  const content = await readFile(`${pidFile}.json`, "utf8").catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  });
  if (!content.trim()) {
    return undefined;
  }
  try {
    const value = JSON.parse(content) as Partial<PersistedSandboxProcess>;
    if (
      value.pid === pid &&
      typeof value.instance_id === "string" &&
      Array.isArray(value.command) &&
      value.command.every((item) => typeof item === "string") &&
      typeof value.started_at === "string"
    ) {
      return {
        pid,
        instance_id: value.instance_id,
        command: value.command,
        started_at: value.started_at
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function isPersistedSandboxProcessCurrent(processRecord: PersistedSandboxProcess): Promise<boolean> {
  if (!isProcessTreeAlive(processRecord.pid)) {
    return false;
  }
  const processInfo = await runCommand(["ps", "-p", String(processRecord.pid), "-o", "command="], 500);
  if (processInfo.exit_code !== 0) {
    return false;
  }
  const commandText = processInfo.stdout;
  const entrypoint = processRecord.command[1] ?? processRecord.command[0] ?? "";
  return commandText.includes(processRecord.instance_id) &&
    (entrypoint.length === 0 || commandText.includes(entrypoint));
}

function signalProcess(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH" || code === "EPERM") {
      return false;
    }
    throw error;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ESRCH" || code === "EPERM") {
      return false;
    }
    throw error;
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
  return signalProcess(-pid, signal);
}

function isProcessGroupAlive(pid: number): boolean {
  return isProcessAlive(-pid);
}

function signalProcessTree(pid: number, signal: NodeJS.Signals): boolean {
  return signalProcessGroup(pid, signal) || signalProcess(pid, signal);
}

function isProcessTreeAlive(pid: number): boolean {
  return isProcessGroupAlive(pid) || isProcessAlive(pid);
}

async function waitForProcessTreeExit(pid: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessTreeAlive(pid)) {
      return;
    }
    await sleep(10);
  }
}

async function terminateChildProcess(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.pid !== undefined) {
    if (!signalProcessTree(child.pid, "SIGTERM")) {
      child.kill("SIGTERM");
    }
  } else {
    child.kill("SIGTERM");
  }
  await waitForChildExit(child, 500);
  if (child.pid !== undefined && isProcessTreeAlive(child.pid)) {
    signalProcessTree(child.pid, "SIGKILL");
    await waitForProcessTreeExit(child.pid, 500);
  }
  if (!hasChildExited(child)) {
    child.kill("SIGKILL");
    await waitForChildExit(child, 500);
  }
}

function waitForChildExit(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<void> {
  if (hasChildExited(child)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function childLifecycleStatus(child: ReturnType<typeof spawn>): SandboxLifecycleStatus {
  if (child.exitCode !== null) {
    return child.exitCode === 0 ? "stopped" : "failed";
  }
  if (child.signalCode !== null) {
    return child.signalCode === "SIGTERM" ? "stopped" : "failed";
  }
  return "running";
}

function hasChildExited(child: ReturnType<typeof spawn>): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    try {
      execFile(
        file,
        args,
        {
          encoding: "utf8",
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024,
          env: sandboxToolProcessEnv(envOverrides)
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
    } catch (error) {
      if (error instanceof Error) {
        const completedAt = new Date().toISOString();
        resolve({
          command,
          exit_code: exitCodeFor(error),
          stdout: "",
          stderr: error.message,
          started_at: startedAt,
          completed_at: completedAt
        });
      } else {
        throw error;
      }
    }
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
