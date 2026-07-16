import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtifactRunResult,
  ReplayTradingApiProviderSession,
  TradingArtifactPaperHandoffProbeResult,
  TradingArtifactCommandEvidence,
  TradingArtifactRunnerKind,
  TradingProviderRequestLog,
  TradingSystemEvent,
  TradingSystemManifest
} from "./types";
import { PaperTradingHandoffConformanceInfrastructureError } from
  "./paper-handoff-conformance";
import {
  acquireCandidateSandboxNetworkPolicy,
  assertCandidateSandboxSbxVersion,
  parseCandidateSandboxSbxVersion,
  type CandidateSandboxNetworkPolicyAttestationEvidence,
  type CandidateSandboxNetworkPolicyLease
} from "./candidate-sandbox-network-policy";

const execFileAsync = promisify(execFile);
const SBX_SANDBOX_REMOVE_ATTEMPT_LIMIT = 3;

export interface TradingArtifactRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  provider: ReplayTradingApiProviderSession;
  output_dir: string;
  timeout_ms?: number;
}

export interface TradingArtifactPaperHandoffProbeInput extends TradingArtifactRunnerInput {
  instance_id: string;
  start_at: string;
}

export interface TradingArtifactRunner {
  readonly kind: TradingArtifactRunnerKind;
  run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult>;
  probePaperHandoff(
    input: TradingArtifactPaperHandoffProbeInput
  ): Promise<TradingArtifactPaperHandoffProbeResult>;
}

export interface HostTradingArtifactRunnerOptions {
  allowHostExecution?: boolean;
}

export class HostTradingArtifactRunnerDisabledError extends Error {
  constructor() {
    super(
      "host_trading_artifact_runner_disabled: set OUROBOROS_ALLOW_HOST_TRADING_ARTIFACT_RUNNER=1 for explicit local fixture runs"
    );
    this.name = "HostTradingArtifactRunnerDisabledError";
  }
}

export class HostTradingArtifactRunner implements TradingArtifactRunner {
  readonly kind = "host_process" as const;

  constructor(private readonly options: HostTradingArtifactRunnerOptions = {}) {}

  async run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
    assertHostTradingArtifactRunnerAllowed(this.options);
    const eventsPath = await prepareEventsPath(input.output_dir);
    const [command, ...args] = input.manifest.entrypoint;
    if (!command) {
      throw new Error("Trading artifact manifest entrypoint is empty");
    }

    try {
      const result = await execFileAsync(command, [...args, "--output-events", eventsPath], {
        cwd: input.artifact_dir,
        timeout: input.timeout_ms ?? 30_000,
        maxBuffer: 5 * 1024 * 1024,
        env: minimalProcessEnv({
          TRADING_API_BASE_URL: input.provider.base_url
        })
      });
      const events = await readEvents(eventsPath);
      return {
        status: "completed",
        runner_kind: this.kind,
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        events,
        provider_requests: input.provider.requests()
      };
    } catch (error) {
      const processError = error as NodeJS.ErrnoException & {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        code?: number | string;
      };
      return {
        status: "crashed",
        runner_kind: this.kind,
        artifact_dir: input.artifact_dir,
        entrypoint: input.manifest.entrypoint,
        events_path: eventsPath,
        stdout: String(processError.stdout ?? ""),
        stderr: String(processError.stderr ?? ""),
        exit_code: typeof processError.code === "number" ? processError.code : undefined,
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: processError.message
      };
    }
  }

  async probePaperHandoff(
    input: TradingArtifactPaperHandoffProbeInput
  ): Promise<TradingArtifactPaperHandoffProbeResult> {
    assertHostTradingArtifactRunnerAllowed(this.options);
    assertPaperHandoffProbeIdentity(input);
    const paths = await preparePaperHandoffProbePaths(input.output_dir);
    const [command, ...args] = input.manifest.entrypoint;
    if (!command) {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "runner_unavailable",
        "Trading artifact manifest entrypoint is empty"
      );
    }
    const startedAt = new Date().toISOString();
    const probeArgs = paperHandoffProbeArguments(input, paths);
    try {
      const result = await execFileAsync(command, [...args, ...probeArgs], {
        cwd: input.artifact_dir,
        timeout: paperHandoffProbeTimeout(input.timeout_ms),
        maxBuffer: 5 * 1024 * 1024,
        env: minimalProcessEnv({
          TRADING_API_BASE_URL: input.provider.base_url
        })
      });
      const completedAt = new Date().toISOString();
      return {
        status: "completed",
        runner_kind: this.kind,
        artifact_dir: input.artifact_dir,
        entrypoint: [...input.manifest.entrypoint],
        instance_id: input.instance_id,
        started_at: startedAt,
        completed_at: completedAt,
        timed_out: false,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        exit_code: 0,
        output_lines: await probeOutputLines(paths.outputPath, result.stdout.toString()),
        provider_requests: input.provider.requests()
      };
    } catch (error) {
      const processError = error as NodeJS.ErrnoException & {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        code?: number | string;
        killed?: boolean;
        signal?: string;
      };
      if (processError.code === "ENOENT") {
        throw new PaperTradingHandoffConformanceInfrastructureError(
          "runner_unavailable",
          processError.message
        );
      }
      const stdout = String(processError.stdout ?? "");
      return {
        status: "crashed",
        runner_kind: this.kind,
        artifact_dir: input.artifact_dir,
        entrypoint: [...input.manifest.entrypoint],
        instance_id: input.instance_id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        timed_out: Boolean(processError.killed) || processError.code === "ETIMEDOUT",
        stdout,
        stderr: String(processError.stderr ?? ""),
        exit_code: typeof processError.code === "number" ? processError.code : undefined,
        output_lines: await probeOutputLines(paths.outputPath, stdout),
        provider_requests: input.provider.requests(),
        error: processError.message
      };
    }
  }
}

export interface DockerSandboxesSbxTradingArtifactRunnerOptions {
  sbxPath?: string;
  sbxHome?: string;
  workspacePath?: string;
  commandTimeoutMs?: number;
  sandboxNamePrefix?: string;
  replayProviderTransport?: "sandbox_sidecar" | "host_url";
}

export class DockerSandboxesSbxTradingArtifactRunner implements TradingArtifactRunner {
  readonly kind = "docker_sandboxes_sbx" as const;

  constructor(private readonly options: DockerSandboxesSbxTradingArtifactRunnerOptions = {}) {}

  async run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
    const sandboxWorkspace = await prepareSandboxWorkspace(input);
    const eventsPath = await prepareEventsPath(sandboxWorkspace.root);
    const commandEvidence: TradingArtifactCommandEvidence[] = [];
    const sandboxName = this.sandboxName(input);
    const baseResult = {
      runner_kind: this.kind,
      artifact_dir: input.artifact_dir,
      entrypoint: input.manifest.entrypoint,
      events_path: eventsPath,
      sandbox_name: sandboxName,
      command_evidence: commandEvidence
    };

    const version = await this.runSbxCommand([this.sbxPath, "version"]);
    commandEvidence.push(version);
    const sandboxImplementationVersion = parseCandidateSandboxSbxVersion(version.stdout);
    if (
      version.exit_code !== 0 ||
      !sandboxImplementationVersion ||
      !candidateSbxVersionSupported(version.stdout)
    ) {
      return {
        ...baseResult,
        status: "crashed",
        stdout: version.stdout,
        stderr: version.stderr,
        exit_code: version.exit_code ?? undefined,
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: version.exit_code === 0
          ? "docker_sandboxes_sbx_unsupported_version"
          : "docker_sandboxes_sbx_unavailable"
      };
    }

    const create = await this.runSbxCommand([
      this.sbxPath,
      "create",
      "--name",
      sandboxName,
      "shell",
      sandboxWorkspace.root
    ]);
    commandEvidence.push(create);
    if (create.exit_code !== 0) {
      return {
        ...baseResult,
        status: "crashed",
        stdout: create.stdout,
        stderr: create.stderr,
        exit_code: create.exit_code ?? undefined,
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: "docker_sandboxes_sbx_create_failed"
      };
    }

    let networkPolicy: CandidateSandboxNetworkPolicyLease<TradingArtifactCommandEvidence>;
    try {
      networkPolicy = await this.acquireNetworkPolicy(
        input.provider,
        sandboxName,
        commandEvidence,
        sandboxImplementationVersion
      );
    } catch (error) {
      const cleanup = await this.cleanupSandbox(sandboxName);
      commandEvidence.push(...cleanup.command_evidence);
      return {
        ...baseResult,
        status: "crashed",
        stdout: "",
        stderr: [
          error instanceof Error ? error.message : String(error),
          cleanup.failure ? sandboxCleanupFailureMessage(cleanup.failure) : ""
        ].filter(Boolean).join("\n"),
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: cleanup.failure
          ? "candidate_sandbox_cleanup_failed"
          : "candidate_sandbox_network_policy_failed"
      };
    }

    let runResult: ArtifactRunResult;
    let networkPolicyCleanupFailure: unknown;
    let sandboxCleanupFailure: TradingArtifactCommandEvidence | undefined;
    try {
      const [command, ...args] = input.manifest.entrypoint;
      if (!command) {
        throw new Error("Trading artifact manifest entrypoint is empty");
      }
      const sidecar = await this.prepareReplayProvider(input, sandboxWorkspace.root);
      const providerBaseUrl = input.provider.sandbox_base_url ??
        input.provider.base_url;
      const execResult = await this.runSbxCommand(
        sidecar
          ? [
              this.sbxPath,
              "exec",
              "-w",
              sandboxWorkspace.artifact_dir,
              sandboxName,
              "python3",
              sidecar.runnerScriptPath,
              "--sidecar-script",
              sidecar.scriptPath,
              "--scenario",
              sidecar.scenarioPath,
              "--requests",
              sidecar.requestsPath,
              "--host",
              "127.0.0.1",
              "--ready-file",
              sidecar.readyPath,
              "--output-events",
              eventsPath,
              "--",
              command,
              ...args
            ]
          : [
              this.sbxPath,
              "exec",
              "-w",
              sandboxWorkspace.artifact_dir,
              sandboxName,
              "env",
              `TRADING_API_BASE_URL=${providerBaseUrl}`,
              command,
              ...args,
              "--output-events",
              eventsPath
            ]
      );
      commandEvidence.push(execResult);
      if (execResult.exit_code !== 0) {
        runResult = {
          ...baseResult,
          status: "crashed",
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          exit_code: execResult.exit_code ?? undefined,
          events: await readEventsIfPresent(eventsPath),
          provider_requests: await this.providerRequests(input.provider, sidecar?.requestsPath),
          error: "docker_sandboxes_sbx_exec_failed"
        };
      } else {
        runResult = {
          ...baseResult,
          status: "completed",
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          events: await readEvents(eventsPath),
          provider_requests: await this.providerRequests(input.provider, sidecar?.requestsPath)
        };
      }
    } catch (error) {
      runResult = {
        ...baseResult,
        status: "crashed",
        stdout: "",
        stderr: "",
        events: await readEventsIfPresent(eventsPath),
        provider_requests: await this.providerRequests(input.provider),
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      try {
        await networkPolicy.release();
      } catch (error) {
        networkPolicyCleanupFailure = error;
      }
      const cleanup = await this.cleanupSandbox(sandboxName);
      commandEvidence.push(...cleanup.command_evidence);
      sandboxCleanupFailure = cleanup.failure;
    }

    if (networkPolicyCleanupFailure || sandboxCleanupFailure) {
      return {
        ...runResult,
        status: "crashed",
        stderr: [
          runResult.stderr,
          networkPolicyCleanupFailure instanceof Error
            ? networkPolicyCleanupFailure.message
            : networkPolicyCleanupFailure
              ? String(networkPolicyCleanupFailure)
              : "",
          sandboxCleanupFailure
            ? sandboxCleanupFailureMessage(sandboxCleanupFailure)
            : ""
        ].filter(Boolean).join("\n"),
        error: sandboxCleanupFailure
          ? "candidate_sandbox_cleanup_failed"
          : "candidate_sandbox_network_policy_cleanup_failed"
      };
    }
    return runResult;
  }

  async probePaperHandoff(
    input: TradingArtifactPaperHandoffProbeInput
  ): Promise<TradingArtifactPaperHandoffProbeResult> {
    assertPaperHandoffProbeIdentity(input);
    const sandboxWorkspace = await prepareSandboxWorkspace(input);
    const paths = await preparePaperHandoffProbePaths(sandboxWorkspace.root);
    const commandEvidence: TradingArtifactCommandEvidence[] = [];
    const sandboxName = this.sandboxName(input);

    const version = await this.runSbxCommand([this.sbxPath, "version"]);
    commandEvidence.push(version);
    const sandboxImplementationVersion = parseCandidateSandboxSbxVersion(version.stdout);
    if (
      version.exit_code !== 0 ||
      !sandboxImplementationVersion ||
      !candidateSbxVersionSupported(version.stdout)
    ) {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "runner_unavailable",
        version.error_message ?? (version.stderr ||
          (version.exit_code === 0
            ? "docker_sandboxes_sbx_unsupported_version"
            : "docker_sandboxes_sbx_unavailable"))
      );
    }
    const create = await this.runSbxCommand([
      this.sbxPath,
      "create",
      "--name",
      sandboxName,
      "shell",
      sandboxWorkspace.root
    ]);
    commandEvidence.push(create);
    if (create.exit_code !== 0) {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "sandbox_create_failed",
        create.error_message ?? (create.stderr || "docker_sandboxes_sbx_create_failed")
      );
    }

    let execResult: TradingArtifactCommandEvidence | undefined;
    let providerRequests: TradingProviderRequestLog[] = [];
    let infrastructureFailure:
      | PaperTradingHandoffConformanceInfrastructureError
      | undefined;
    let networkPolicy:
      | CandidateSandboxNetworkPolicyLease<TradingArtifactCommandEvidence>
      | undefined;
    let candidateEgressPolicyEvidence:
      | CandidateSandboxNetworkPolicyAttestationEvidence
      | undefined;
    let attestationIssuedAt: string | undefined;
    try {
      networkPolicy = await this.acquireNetworkPolicy(
        input.provider,
        sandboxName,
        commandEvidence,
        sandboxImplementationVersion
      );
    } catch (error) {
      infrastructureFailure = new PaperTradingHandoffConformanceInfrastructureError(
        "network_policy_failed",
        error instanceof Error ? error.message : String(error)
      );
    }
    try {
      if (!infrastructureFailure) {
        const [command, ...args] = input.manifest.entrypoint;
        if (!command) {
          infrastructureFailure = new PaperTradingHandoffConformanceInfrastructureError(
            "runner_unavailable",
            "Trading artifact manifest entrypoint is empty"
          );
        } else {
          const sidecar = await this.prepareReplayProvider(input, sandboxWorkspace.root);
          const providerBaseUrl = input.provider.sandbox_base_url ??
            input.provider.base_url;
          const artifactCommand = [command, ...args, ...paperHandoffProbeArguments(input, paths)];
          execResult = await this.runSbxCommand(
            sidecar
              ? [
                  this.sbxPath,
                  "exec",
                  "-w",
                  sandboxWorkspace.artifact_dir,
                  sandboxName,
                  "python3",
                  sidecar.runnerScriptPath,
                  "--sidecar-script",
                  sidecar.scriptPath,
                  "--scenario",
                  sidecar.scenarioPath,
                  "--requests",
                  sidecar.requestsPath,
                  "--host",
                  "127.0.0.1",
                  "--ready-file",
                  sidecar.readyPath,
                  "--paper-handoff",
                  "--",
                  ...artifactCommand
                ]
              : [
                  this.sbxPath,
                  "exec",
                  "-w",
                  sandboxWorkspace.artifact_dir,
                  sandboxName,
                  "env",
                  `TRADING_API_BASE_URL=${providerBaseUrl}`,
                  ...artifactCommand
                ],
            paperHandoffProbeTimeout(input.timeout_ms)
          );
          commandEvidence.push(execResult);
          providerRequests = await this.providerRequests(
            input.provider,
            sidecar?.requestsPath
          );
          if (sidecar && execResult.exit_code === 70) {
            infrastructureFailure = new PaperTradingHandoffConformanceInfrastructureError(
              "provider_start_failed",
              execResult.stderr || "sandbox replay provider failed to start"
            );
          }
        }
      }
    } catch (error) {
      infrastructureFailure = error instanceof PaperTradingHandoffConformanceInfrastructureError
        ? error
        : new PaperTradingHandoffConformanceInfrastructureError(
            "provider_start_failed",
            error instanceof Error ? error.message : String(error)
          );
    } finally {
      if (networkPolicy) {
        try {
          await networkPolicy.release();
          candidateEgressPolicyEvidence = networkPolicy.attestation_evidence();
          if (!candidateEgressPolicyEvidence) {
            throw new Error("candidate egress policy release produced no attestation evidence");
          }
          attestationIssuedAt = new Date(Math.max(
            Date.now(),
            Date.parse(candidateEgressPolicyEvidence.end.observed_at)
          )).toISOString();
        } catch (error) {
          infrastructureFailure = new PaperTradingHandoffConformanceInfrastructureError(
            "network_policy_failed",
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      const cleanup = await this.cleanupSandbox(sandboxName);
      commandEvidence.push(...cleanup.command_evidence);
      if (cleanup.failure) {
        infrastructureFailure = new PaperTradingHandoffConformanceInfrastructureError(
          "probe_cleanup_failed",
          [
            infrastructureFailure?.message ?? "",
            sandboxCleanupFailureMessage(cleanup.failure)
          ].filter(Boolean).join("\n")
        );
      }
    }

    if (infrastructureFailure) {
      throw infrastructureFailure;
    }
    if (!execResult) {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "runner_unavailable",
        "paper handoff probe command was not executed"
      );
    }
    if (!candidateEgressPolicyEvidence || !attestationIssuedAt) {
      throw new PaperTradingHandoffConformanceInfrastructureError(
        "network_policy_failed",
        "Docker paper handoff probe produced no terminal egress evidence"
      );
    }
    const outputLines = await probeOutputLines(paths.outputPath, execResult.stdout);
    return {
      status: execResult.exit_code === 0 ? "completed" : "crashed",
      runner_kind: this.kind,
      artifact_dir: input.artifact_dir,
      entrypoint: [...input.manifest.entrypoint],
      instance_id: input.instance_id,
      started_at: candidateEgressPolicyEvidence.start.observed_at,
      completed_at: attestationIssuedAt,
      timed_out: execResult.timed_out === true,
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      exit_code: execResult.exit_code ?? undefined,
      output_lines: outputLines,
      provider_requests: providerRequests,
      candidate_effect: {
        started_at: execResult.started_at,
        completed_at: execResult.completed_at
      },
      candidate_egress_policy_evidence: candidateEgressPolicyEvidence,
      command_evidence: commandEvidence,
      ...(execResult.exit_code === 0
        ? {}
        : { error: execResult.error_message ?? "docker_sandboxes_sbx_exec_failed" })
    };
  }

  private sandboxName(input: TradingArtifactRunnerInput): string {
    const prefix = this.options.sandboxNamePrefix ?? "ouro-s10-trading";
    const digest = createHash("sha256")
      .update(input.output_dir)
      .digest("hex")
      .slice(0, 12);
    return safePathSegment(`${prefix}-${digest}`).slice(0, 63);
  }

  private get sbxPath(): string {
    const configuredPath = this.options.sbxPath
      ?? process.env.OUROBOROS_SBX_BIN
      ?? process.env.OUROBOROS_SDX_BIN
      ?? "sbx";
    return resolveCommandPath(configuredPath, this.workspacePath);
  }

  private get workspacePath(): string {
    return this.options.workspacePath ?? process.env.OUROBOROS_SBX_WORKSPACE ?? process.cwd();
  }

  private get commandTimeoutMs(): number {
    return this.options.commandTimeoutMs ?? Number(process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS ?? 30_000);
  }

  private get sbxHome(): string | undefined {
    return this.options.sbxHome ?? process.env.OUROBOROS_SBX_HOME;
  }

  private get replayProviderTransport(): "sandbox_sidecar" | "host_url" {
    const configured = this.options.replayProviderTransport
      ?? process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_TRANSPORT;
    return configured === "host_url" ? "host_url" : "sandbox_sidecar";
  }

  private runSbxCommand(
    command: string[],
    timeoutMs = this.commandTimeoutMs
  ): Promise<TradingArtifactCommandEvidence> {
    return runCommand(command, timeoutMs, this.sbxHome ? { HOME: this.sbxHome } : undefined);
  }

  private async cleanupSandbox(sandboxName: string): Promise<{
    command_evidence: TradingArtifactCommandEvidence[];
    failure?: TradingArtifactCommandEvidence;
  }> {
    const commandEvidence = [
      await this.runSbxCommand([this.sbxPath, "stop", sandboxName])
    ];
    let failure: TradingArtifactCommandEvidence | undefined;
    for (let attempt = 0; attempt < SBX_SANDBOX_REMOVE_ATTEMPT_LIMIT; attempt += 1) {
      const remove = await this.runSbxCommand([
        this.sbxPath,
        "rm",
        "--force",
        sandboxName
      ]);
      commandEvidence.push(remove);
      if (remove.exit_code === 0) {
        return { command_evidence: commandEvidence };
      }
      failure = remove;
    }
    return { command_evidence: commandEvidence, failure };
  }

  private acquireNetworkPolicy(
    provider: ReplayTradingApiProviderSession,
    sandboxName: string,
    commandEvidence: TradingArtifactCommandEvidence[],
    sandboxImplementationVersion: string
  ): Promise<CandidateSandboxNetworkPolicyLease<TradingArtifactCommandEvidence>> {
    return acquireCandidateSandboxNetworkPolicy({
      sbx_path: this.sbxPath,
      sandbox_name: sandboxName,
      sandbox_implementation_version: sandboxImplementationVersion,
      ...(this.replayProviderTransport === "host_url"
        ? { gateway_base_url: provider.sandbox_base_url ?? provider.base_url }
        : {}),
      run_command: (command) => this.runSbxCommand(command),
      on_evidence: (evidence) => commandEvidence.push(evidence)
    });
  }

  private async prepareReplayProvider(
    input: TradingArtifactRunnerInput,
    sandboxWorkspaceRoot: string
  ): Promise<SandboxReplayProviderSidecar | undefined> {
    if (this.replayProviderTransport !== "sandbox_sidecar") {
      return undefined;
    }
    const outputRoot = safeAbsoluteRoot(sandboxWorkspaceRoot);
    const scriptPath = resolvePathInsideRoot(outputRoot, ["replay-provider-sidecar.py"], "sidecar_script");
    const runnerScriptPath = resolvePathInsideRoot(outputRoot, ["replay-provider-runner.py"], "sidecar_runner");
    const scenarioPath = resolvePathInsideRoot(outputRoot, ["replay-provider-scenario.json"], "sidecar_scenario");
    const requestsPath = resolvePathInsideRoot(outputRoot, ["provider-requests.jsonl"], "sidecar_requests");
    const readyPath = resolvePathInsideRoot(outputRoot, ["replay-provider-ready.txt"], "sidecar_ready");
    await writeFile(scriptPath, sandboxReplayProviderScript(), "utf8");
    await writeFile(runnerScriptPath, sandboxReplayProviderRunnerScript(), "utf8");
    await writeFile(scenarioPath, `${JSON.stringify(input.provider.candidate_input, null, 2)}\n`, "utf8");
    await Promise.all([
      rm(requestsPath, { force: true }),
      rm(readyPath, { force: true })
    ]);
    return {
      scriptPath,
      runnerScriptPath,
      scenarioPath,
      requestsPath,
      readyPath
    };
  }

  private async providerRequests(
    provider: ReplayTradingApiProviderSession,
    sidecarRequestsPath?: string
  ): Promise<TradingProviderRequestLog[]> {
    return [
      ...provider.requests(),
      ...(sidecarRequestsPath ? await readProviderRequestsIfPresent(sidecarRequestsPath) : [])
    ];
  }
}

interface SandboxReplayProviderSidecar {
  scriptPath: string;
  runnerScriptPath: string;
  scenarioPath: string;
  requestsPath: string;
  readyPath: string;
}

interface SandboxExecutionWorkspace {
  root: string;
  artifact_dir: string;
}

export async function runTradingArtifact(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
  return new DockerSandboxesSbxTradingArtifactRunner().run(input);
}

export async function readTradingSystemManifest(artifactDir: string): Promise<TradingSystemManifest> {
  const raw = await readFile(path.join(artifactDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as TradingSystemManifest;
  if (!Array.isArray(manifest.entrypoint) || manifest.entrypoint.length === 0) {
    throw new Error("Trading system manifest must include a non-empty entrypoint");
  }
  if (manifest.api_contract !== "trading_api_provider_v1") {
    throw new Error("Trading system manifest must use trading_api_provider_v1");
  }
  return manifest;
}

async function prepareEventsPath(outputDir: string): Promise<string> {
  const outputRoot = safeAbsoluteRoot(outputDir);
  await mkdir(outputRoot, { recursive: true });
  const eventsPath = resolvePathInsideRoot(outputRoot, ["events.jsonl"], "events_path");
  await rm(eventsPath, { force: true });
  return eventsPath;
}

const PAPER_HANDOFF_PROBE_TIMEOUT_MS = 5_000;

interface PaperHandoffProbePaths {
  outputPath: string;
  heartbeatPath: string;
}

async function preparePaperHandoffProbePaths(
  outputDir: string
): Promise<PaperHandoffProbePaths> {
  const outputRoot = safeAbsoluteRoot(outputDir);
  await mkdir(outputRoot, { recursive: true });
  const outputPath = resolvePathInsideRoot(
    outputRoot,
    ["paper-handoff-output.jsonl"],
    "paper_handoff_output"
  );
  const heartbeatPath = resolvePathInsideRoot(
    outputRoot,
    ["paper-handoff-heartbeat.jsonl"],
    "paper_handoff_heartbeat"
  );
  await Promise.all([
    rm(outputPath, { force: true }),
    rm(heartbeatPath, { force: true })
  ]);
  return { outputPath, heartbeatPath };
}

function paperHandoffProbeArguments(
  input: TradingArtifactPaperHandoffProbeInput,
  paths: PaperHandoffProbePaths
): string[] {
  return [
    "--instance-id",
    input.instance_id,
    "--ticks",
    "1",
    "--interval-ms",
    "1",
    "--start-at",
    input.start_at,
    "--paper-order-request",
    "valid",
    "--log-file",
    paths.outputPath,
    "--heartbeat-file",
    paths.heartbeatPath
  ];
}

function paperHandoffProbeTimeout(requested: number | undefined): number {
  if (!Number.isFinite(requested) || (requested ?? 0) <= 0) {
    return PAPER_HANDOFF_PROBE_TIMEOUT_MS;
  }
  return Math.min(Math.floor(requested!), PAPER_HANDOFF_PROBE_TIMEOUT_MS);
}

function assertPaperHandoffProbeIdentity(
  input: TradingArtifactPaperHandoffProbeInput
): void {
  if (!input.instance_id.trim() ||
    !Number.isFinite(Date.parse(input.start_at)) ||
    new Date(Date.parse(input.start_at)).toISOString() !== input.start_at) {
    throw new PaperTradingHandoffConformanceInfrastructureError(
      "runner_unavailable",
      "paper handoff probe identity is invalid"
    );
  }
}

async function probeOutputLines(outputPath: string, stdout: string): Promise<string[]> {
  try {
    return textLines(await readFile(outputPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    return textLines(stdout);
  }
}

function textLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function sandboxCleanupFailureMessage(result: TradingArtifactCommandEvidence): string {
  return result.error_message ?? (result.stderr.trim() ||
    `sbx sandbox removal failed with exit code ${String(result.exit_code)}`
  );
}

async function prepareSandboxWorkspace(
  input: TradingArtifactRunnerInput
): Promise<SandboxExecutionWorkspace> {
  const outputRoot = safeAbsoluteRoot(input.output_dir);
  await mkdir(outputRoot, { recursive: true });
  const root = resolvePathInsideRoot(outputRoot, ["sandbox-workspace"], "sandbox_workspace");
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const artifactDir = resolvePathInsideRoot(root, ["artifact"], "sandbox_artifact_dir");
  await cp(input.artifact_dir, artifactDir, { recursive: true });
  return {
    root,
    artifact_dir: artifactDir
  };
}

async function readEventsIfPresent(eventsPath: string): Promise<TradingSystemEvent[]> {
  try {
    return await readEvents(eventsPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readEvents(eventsPath: string): Promise<TradingSystemEvent[]> {
  const raw = await readFile(eventsPath, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TradingSystemEvent);
}

async function readProviderRequestsIfPresent(requestsPath: string): Promise<TradingProviderRequestLog[]> {
  try {
    const raw = await readFile(requestsPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TradingProviderRequestLog);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
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

function runCommand(
  command: string[],
  timeoutMs = 30_000,
  envOverrides: NodeJS.ProcessEnv | undefined = undefined
): Promise<TradingArtifactCommandEvidence> {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const [file, ...args] = command;
    const commandFile = safeCommandFile(file);
    if (!commandFile) {
      resolve({
        command,
        exit_code: null,
        error_message: "unsafe_command_file",
        stdout: "",
        stderr: "",
        started_at: startedAt,
        completed_at: new Date().toISOString()
      });
      return;
    }
    execFile(
      commandFile,
      args,
      {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
        env: sandboxToolProcessEnv(envOverrides)
      },
      (error, stdout, stderr) => {
        const processError = error as (Error & { code?: unknown; signal?: unknown; killed?: unknown }) | null;
        resolve({
          command,
          exit_code: error ? exitCodeFor(error) : 0,
          signal: typeof processError?.signal === "string" ? processError.signal : undefined,
          timed_out: Boolean(processError?.killed) && processError?.code === null,
          error_message: processError?.message,
          stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
          stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
          started_at: startedAt,
          completed_at: new Date().toISOString()
        });
      }
    );
  });
}

function assertHostTradingArtifactRunnerAllowed(options: HostTradingArtifactRunnerOptions): void {
  if (options.allowHostExecution || process.env.OUROBOROS_ALLOW_HOST_TRADING_ARTIFACT_RUNNER === "1") {
    return;
  }
  throw new HostTradingArtifactRunnerDisabledError();
}

function minimalProcessEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "COMSPEC", "PATHEXT"]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  return stripUndefinedEnv({
    ...env,
    ...overrides
  });
}

function sandboxToolProcessEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env = minimalProcessEnv();
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

function stripUndefinedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function exitCodeFor(error: Error & { code?: unknown }): number | null {
  return typeof error.code === "number" ? error.code : null;
}

function safePathSegment(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  let start = 0;
  while (start < normalized.length && normalized[start] === "-") {
    start += 1;
  }
  let end = normalized.length;
  while (end > start && normalized[end - 1] === "-") {
    end -= 1;
  }
  return normalized.slice(start, end) || "empty";
}

function safeAbsoluteRoot(rootPath: string): string {
  return path.resolve(rootPath);
}

function resolvePathInsideRoot(rootPath: string, segments: string[], label: string): string {
  const safeRoot = safeAbsoluteRoot(rootPath);
  const resolved = path.resolve(safeRoot, ...segments);
  const rootPrefix = safeRoot.endsWith(path.sep) ? safeRoot : `${safeRoot}${path.sep}`;
  if (resolved !== safeRoot && !resolved.startsWith(rootPrefix)) {
    throw new Error(`${label} must stay under its configured root`);
  }
  return resolved;
}

function safeCommandFile(file: string | undefined): string | undefined {
  if (!file || /[\0\r\n]/.test(file)) {
    return undefined;
  }
  return file;
}

function sandboxReplayProviderRunnerScript(): string {
  return `#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
import time
import urllib.request


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--sidecar-script", required=True)
    parser.add_argument("--scenario", required=True)
    parser.add_argument("--requests", required=True)
    parser.add_argument("--host", required=True)
    parser.add_argument("--ready-file", required=True)
    parser.add_argument("--output-events")
    parser.add_argument("--paper-handoff", action="store_true")
    parser.add_argument("artifact_command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.artifact_command and args.artifact_command[0] == "--":
        args.artifact_command = args.artifact_command[1:]
    if not args.artifact_command:
        parser.error("missing artifact command")
    return args


def wait_for_sidecar(base_url):
    health_url = base_url.rstrip("/") + "/health"
    for _ in range(20):
        try:
            with urllib.request.urlopen(health_url, timeout=1) as response:
                response.read()
            return True
        except Exception:
            time.sleep(0.1)
    return False


def wait_for_ready_file(ready_file):
    for _ in range(20):
        try:
            with open(ready_file, "r", encoding="utf-8") as handle:
                base_url = handle.read().strip()
            if base_url:
                return base_url
        except FileNotFoundError:
            pass
        time.sleep(0.1)
    return None


def main():
    args = parse_args()
    provider = subprocess.Popen([
        "python3",
        args.sidecar_script,
        "--scenario",
        args.scenario,
        "--requests",
        args.requests,
        "--host",
        args.host,
        "--port",
        "0",
        "--ready-file",
        args.ready_file,
    ])
    try:
        provider_base_url = wait_for_ready_file(args.ready_file)
        if not provider_base_url or not wait_for_sidecar(provider_base_url):
            return 70
        env = os.environ.copy()
        env["TRADING_API_BASE_URL"] = provider_base_url
        artifact_command = [*args.artifact_command]
        if not args.paper_handoff:
            if not args.output_events:
                return 64
            artifact_command.extend(["--output-events", args.output_events])
        artifact = subprocess.run(
            artifact_command,
            env=env,
            check=False,
        )
        return artifact.returncode
    finally:
        provider.terminate()
        try:
            provider.wait(timeout=2)
        except subprocess.TimeoutExpired:
            provider.kill()
            provider.wait()
        try:
            os.remove(args.ready_file)
        except FileNotFoundError:
            pass


if __name__ == "__main__":
    sys.exit(main())
`;
}

function sandboxReplayProviderScript(): string {
  return `#!/usr/bin/env python3
import argparse
import json
import os
from socketserver import TCPServer
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY_BYTES = 64 * 1024


class RequestBodyTooLarge(Exception):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def round_value(value):
    return round(value, 6)


def validate_order_request(body, market, account):
    if not isinstance(body, dict):
        return {
            "accepted": False,
            "reason": "malformed_order_request",
            "notional": 0,
            "risk_fraction": 0,
        }
    if body.get("side") == "hold" or body.get("order_type") == "none":
        return {
            "accepted": True,
            "reason": "hold_intent",
            "notional": 0,
            "risk_fraction": 0,
        }

    try:
        notional = abs(float(body.get("quantity", 0))) * float(market["price"])
    except Exception:
        notional = 0
    equity = float(account["equity"])
    risk_fraction = notional / equity if equity > 0 else 0
    accepted = (
        notional > 0
        and notional <= float(account["max_position_notional"])
        and risk_fraction <= float(account["max_risk_fraction"])
    )
    return {
        "accepted": accepted,
        "reason": "risk_limits_passed" if accepted else "risk_limits_rejected",
        "notional": round_value(notional),
        "risk_fraction": round_value(risk_fraction),
    }


def read_body(handler):
    try:
        length = int(handler.headers.get("content-length", "0"))
    except Exception:
        length = 0
    if length <= 0:
        return None
    if length > MAX_BODY_BYTES:
        raise RequestBodyTooLarge()
    raw = handler.rfile.read(length).decode("utf-8").strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return {"malformed_json": raw}


def send_json(handler, status, body):
    payload = (json.dumps(body) + "\\n").encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json")
    handler.send_header("content-length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def make_handler(scenario, requests_path):
    class ReplayProviderHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/health":
                send_json(self, 200, {"ok": True})
                return
            if self.path == "/market/snapshot":
                self.respond_and_log(200, scenario["market"])
                return
            if self.path == "/account/state":
                self.respond_and_log(200, scenario["account"])
                return
            self.respond_and_log(404, {"error": "not_found"})

        def do_POST(self):
            try:
                body = read_body(self)
            except RequestBodyTooLarge:
                self.close_connection = True
                self.respond_and_log(413, {
                    "error": "request_body_too_large",
                    "authority_status": "not_live"
                })
                return
            if self.path == "/orders/validate":
                validation = validate_order_request(body, scenario["market"], scenario["account"])
                self.respond_and_log(200, validation, body)
                return
            self.respond_and_log(404, {"error": "not_found"}, body)

        def respond_and_log(self, status, body, request_body=None):
            send_json(self, status, body)
            with open(requests_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps({
                    "at": utc_now(),
                    "method": self.command,
                    "path": self.path,
                    "body": request_body,
                    "response_status": status,
                }, sort_keys=True) + "\\n")

        def log_message(self, _format, *args):
            return

    return ReplayProviderHandler


def publish_ready_file(ready_file, base_url):
    temporary = f"{ready_file}.{os.getpid()}.tmp"
    with open(temporary, "x", encoding="utf-8") as handle:
        handle.write(base_url + "\\n")
    os.replace(temporary, ready_file)


class ReplayThreadingHTTPServer(ThreadingHTTPServer):
    def server_bind(self):
        TCPServer.server_bind(self)
        self.server_name = self.server_address[0]
        self.server_port = self.server_address[1]


def main():
    parser = argparse.ArgumentParser(description="Sandbox-local replay TradingApiProvider")
    parser.add_argument("--scenario", required=True)
    parser.add_argument("--requests", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--ready-file", required=True)
    args = parser.parse_args()

    with open(args.scenario, "r", encoding="utf-8") as handle:
        scenario = json.load(handle)

    server = ReplayThreadingHTTPServer((args.host, args.port), make_handler(scenario, args.requests))
    publish_ready_file(
        args.ready_file,
        f"http://{args.host}:{server.server_port}",
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
`;
}
