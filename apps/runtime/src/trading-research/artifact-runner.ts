import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ArtifactRunResult,
  ReplayTradingApiProviderSession,
  TradingArtifactCommandEvidence,
  TradingArtifactRunnerKind,
  TradingProviderRequestLog,
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
  replayProviderTransport?: "sandbox_sidecar" | "host_url";
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
      const sidecar = await this.prepareReplayProvider(input);
      const providerBaseUrl = sidecar?.baseUrl ?? input.provider.sandbox_base_url ?? input.provider.base_url;
      const execResult = await this.runSbxCommand(
        sidecar
          ? [
              this.sbxPath,
              "exec",
              "-w",
              input.artifact_dir,
              sandboxName,
              "sh",
              "-lc",
              sandboxSidecarArtifactCommand(sidecar, providerBaseUrl, [command, ...args], eventsPath)
            ]
          : [
              this.sbxPath,
              "exec",
              "-w",
              input.artifact_dir,
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

  private get replayProviderTransport(): "sandbox_sidecar" | "host_url" {
    const configured = this.options.replayProviderTransport
      ?? process.env.OUROBOROS_TRADING_REPLAY_PROVIDER_TRANSPORT;
    return configured === "host_url" ? "host_url" : "sandbox_sidecar";
  }

  private runSbxCommand(command: string[]): Promise<TradingArtifactCommandEvidence> {
    return runCommand(command, this.commandTimeoutMs, this.sbxHome ? { HOME: this.sbxHome } : undefined);
  }

  private async prepareReplayProvider(
    input: TradingArtifactRunnerInput
  ): Promise<SandboxReplayProviderSidecar | undefined> {
    if (this.replayProviderTransport !== "sandbox_sidecar") {
      return undefined;
    }
    const port = sandboxProviderPort(input.output_dir);
    const scriptPath = path.join(input.output_dir, "replay-provider-sidecar.py");
    const scenarioPath = path.join(input.output_dir, "replay-provider-scenario.json");
    const requestsPath = path.join(input.output_dir, "provider-requests.jsonl");
    await writeFile(scriptPath, sandboxReplayProviderScript(), "utf8");
    await writeFile(scenarioPath, `${JSON.stringify(input.provider.scenario, null, 2)}\n`, "utf8");
    await rm(requestsPath, { force: true });
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      port,
      scriptPath,
      scenarioPath,
      requestsPath
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
  baseUrl: string;
  port: number;
  scriptPath: string;
  scenarioPath: string;
  requestsPath: string;
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

function exitCodeFor(error: Error & { code?: unknown }): number | null {
  return typeof error.code === "number" ? error.code : null;
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "empty";
}

function sandboxProviderPort(outputDir: string): number {
  const digest = createHash("sha256").update(outputDir).digest("hex").slice(0, 8);
  return 30_000 + (Number.parseInt(digest, 16) % 20_000);
}

function sidecarReadinessProbe(baseUrl: string): string {
  const healthUrl = `${baseUrl}/health`;
  return `ready=0; for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do python3 -c "import urllib.request; urllib.request.urlopen('${healthUrl}', timeout=1).read()" && ready=1 && break; sleep 0.1; done; [ "$ready" = "1" ]`;
}

function sandboxSidecarArtifactCommand(
  sidecar: SandboxReplayProviderSidecar,
  providerBaseUrl: string,
  artifactCommand: string[],
  eventsPath: string
): string {
  const providerCommand = shellJoin([
    "python3",
    sidecar.scriptPath,
    "--scenario",
    sidecar.scenarioPath,
    "--requests",
    sidecar.requestsPath,
    "--host",
    "127.0.0.1",
    "--port",
    String(sidecar.port)
  ]);
  const artifact = `TRADING_API_BASE_URL=${shellQuote(providerBaseUrl)} ${shellJoin([
    ...artifactCommand,
    "--output-events",
    eventsPath
  ])}`;
  return [
    `${providerCommand} & provider_pid=$!`,
    "cleanup() { kill \"$provider_pid\" 2>/dev/null || true; wait \"$provider_pid\" 2>/dev/null || true; }",
    "trap cleanup EXIT",
    sidecarReadinessProbe(providerBaseUrl),
    artifact
  ].join("; ");
}

function shellJoin(values: string[]): string {
  return values.map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function sandboxReplayProviderScript(): string {
  return `#!/usr/bin/env python3
import argparse
import json
from socketserver import TCPServer
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


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
    length = int(handler.headers.get("content-length", "0"))
    if length <= 0:
        return None
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
            body = read_body(self)
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
    args = parser.parse_args()

    with open(args.scenario, "r", encoding="utf-8") as handle:
        scenario = json.load(handle)

    server = ReplayThreadingHTTPServer((args.host, args.port), make_handler(scenario, args.requests))
    server.serve_forever()


if __name__ == "__main__":
    main()
`;
}
