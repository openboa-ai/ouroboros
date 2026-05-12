import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtifactRunResult,
  ReplayTradingApiProviderSession,
  TradingArtifactCommandEvidence,
  TradingArtifactRunnerKind,
  TradingSystemEvent,
  TradingSystemManifest
} from "./types";

const execFileAsync = promisify(execFile);

export interface TradingArtifactRunnerInput {
  artifact_dir: string;
  manifest: TradingSystemManifest;
  provider: ReplayTradingApiProviderSession;
  output_dir: string;
  timeout_ms?: number;
}

export interface TradingArtifactRunner {
  readonly kind: TradingArtifactRunnerKind;
  run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult>;
}

export class HostTradingArtifactRunner implements TradingArtifactRunner {
  readonly kind = "host_process" as const;

  async run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
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
        env: {
          ...process.env,
          TRADING_API_BASE_URL: input.provider.base_url
        }
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
}

export interface DockerSandboxesSbxTradingArtifactRunnerOptions {
  sbxPath?: string;
  sbxHome?: string;
  workspacePath?: string;
  commandTimeoutMs?: number;
  sandboxNamePrefix?: string;
}

export class DockerSandboxesSbxTradingArtifactRunner implements TradingArtifactRunner {
  readonly kind = "docker_sandboxes_sbx" as const;

  constructor(private readonly options: DockerSandboxesSbxTradingArtifactRunnerOptions = {}) {}

  async run(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
    const eventsPath = await prepareEventsPath(input.output_dir);
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
    if (version.exit_code !== 0 || !isDockerSandboxesSbxVersion(version.stdout)) {
      return {
        ...baseResult,
        status: "crashed",
        stdout: version.stdout,
        stderr: version.stderr,
        exit_code: version.exit_code ?? undefined,
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: "docker_sandboxes_sbx_unavailable"
      };
    }

    const create = await this.runSbxCommand([
      this.sbxPath,
      "create",
      "--name",
      sandboxName,
      "shell",
      this.workspacePath
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

    let runResult: ArtifactRunResult;
    try {
      const [command, ...args] = input.manifest.entrypoint;
      if (!command) {
        throw new Error("Trading artifact manifest entrypoint is empty");
      }
      const execResult = await this.runSbxCommand([
        this.sbxPath,
        "exec",
        "-w",
        input.artifact_dir,
        sandboxName,
        "env",
        `TRADING_API_BASE_URL=${input.provider.base_url}`,
        command,
        ...args,
        "--output-events",
        eventsPath
      ]);
      commandEvidence.push(execResult);
      if (execResult.exit_code !== 0) {
        runResult = {
          ...baseResult,
          status: "crashed",
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          exit_code: execResult.exit_code ?? undefined,
          events: await readEventsIfPresent(eventsPath),
          provider_requests: input.provider.requests(),
          error: "docker_sandboxes_sbx_exec_failed"
        };
      } else {
        runResult = {
          ...baseResult,
          status: "completed",
          stdout: execResult.stdout,
          stderr: execResult.stderr,
          events: await readEvents(eventsPath),
          provider_requests: input.provider.requests()
        };
      }
    } catch (error) {
      runResult = {
        ...baseResult,
        status: "crashed",
        stdout: "",
        stderr: "",
        events: await readEventsIfPresent(eventsPath),
        provider_requests: input.provider.requests(),
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      commandEvidence.push(await this.runSbxCommand([this.sbxPath, "stop", sandboxName]));
      commandEvidence.push(await this.runSbxCommand([this.sbxPath, "rm", "--force", sandboxName]));
    }

    return runResult;
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

  private runSbxCommand(command: string[]): Promise<TradingArtifactCommandEvidence> {
    return runCommand(command, this.commandTimeoutMs, this.sbxHome ? { HOME: this.sbxHome } : undefined);
  }
}

export async function runTradingArtifact(input: TradingArtifactRunnerInput): Promise<ArtifactRunResult> {
  return new HostTradingArtifactRunner().run(input);
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
  await mkdir(outputDir, { recursive: true });
  const eventsPath = path.join(outputDir, "events.jsonl");
  await rm(eventsPath, { force: true });
  return eventsPath;
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

function isDockerSandboxesSbxVersion(stdout: string): boolean {
  return stdout.includes("Client Version:") && stdout.includes("Server Version:");
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
    execFile(
      file,
      args,
      {
        encoding: "utf8",
        timeout: timeoutMs,
        maxBuffer: 5 * 1024 * 1024,
        env: envOverrides ? { ...process.env, ...envOverrides } : process.env
      },
      (error, stdout, stderr) => {
        resolve({
          command,
          exit_code: error ? exitCodeFor(error) : 0,
          stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
          stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
          started_at: startedAt,
          completed_at: new Date().toISOString()
        });
      }
    );
  });
}

function exitCodeFor(error: Error & { code?: unknown }): number | null {
  return typeof error.code === "number" ? error.code : null;
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "empty";
}
