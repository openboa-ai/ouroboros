import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import type { Ref, RuntimeProcessTerminalReason } from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort
} from "../../ports/runtime-process-ownership";
import { sanitizeResearchWorkerArenaContext } from
  "../../candidate/research-worker-memory";
import {
  createResearchWorkerToolClient,
  startResearchWorkerToolServer,
  type ResearchWorkerToolServerHandle
} from "./research-worker-tool-server";
import type {
  AgentEditFailureReason,
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  ResearchWorkerSessionAdapter,
  ResearchWorkerSessionInput,
  ResearchWorkerSessionResult,
  TradingResearchAgentAdapter
} from "./types";

type ExecFileRunner = (
  file: string,
  args: string[],
  options?: {
    cwd?: string;
    maxBuffer?: number;
    timeout?: number;
    stdin?: string;
    env?: NodeJS.ProcessEnv;
    ownership?: {
      port: RuntimeProcessOwnershipPort;
      expected: RuntimeProcessExpectedIdentity;
    };
  }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

const CODEX_RESEARCH_PERMISSION_PROFILE = "ouroboros-research-worker";
const CODEX_RESEARCH_SHELL_ENVIRONMENT_CONFIG =
  "shell_environment_policy.include_only=[" +
  "\"PATH\",\"HOME\",\"TMPDIR\",\"TEMP\",\"TMP\"," +
  "\"SystemRoot\",\"COMSPEC\",\"PATHEXT\"," +
  "\"OUROBOROS_RESEARCH_TOOL_BASE_URL\"," +
  "\"OUROBOROS_RESEARCH_TOOL_SOCKET_PATH\"," +
  "\"OUROBOROS_RESEARCH_TOOL_TOKEN\"," +
    "\"OUROBOROS_RESEARCH_TOOL_CLIENT\"]";
const OWNED_PROVIDER_PROCESS_GATE_SOURCE = String.raw`
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const [gateFile, file, ...args] = process.argv.slice(1);
const deadline = Date.now() + 120000;
let child;
const timer = setInterval(() => {
  let gateState;
  try {
    gateState = fs.readFileSync(gateFile, "utf8");
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      clearInterval(timer);
      process.exit(79);
    }
    if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(78);
    }
    return;
  }
  if (gateState !== "go\n") {
    if (Date.now() >= deadline) {
      clearInterval(timer);
      process.exit(78);
    }
    return;
  }
  clearInterval(timer);
  try { fs.unlinkSync(gateFile); } catch {}
  child = spawn(file, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });
  child.stdin.on("error", (error) => {
    if (!error || error.code !== "EPIPE") process.exitCode = 1;
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.once("error", () => process.exit(127));
  child.once("close", (code) => process.exit(code ?? 1));
}, 5);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child?.kill(signal));
}
`;
const OWNED_PROVIDER_PROCESS_GATE_SHELL = String.raw`
gate_file=$1
shift
attempt=0
while [ "$attempt" -lt 12000 ]; do
  gate_state=
  if [ -r "$gate_file" ]; then
    IFS= read -r gate_state < "$gate_file" || true
  fi
  if [ "$gate_state" = "go" ]; then
    rm -f -- "$gate_file"
    exec "$@"
  fi
  attempt=$((attempt + 1))
  sleep 0.01
done
exit 78
`;

export interface CodexTradingResearchAgentOptions {
  model?: string;
  command?: string;
  timeout_ms?: number;
  reasoning_effort?: "low" | "medium" | "high" | "xhigh";
  env?: NodeJS.ProcessEnv;
  execFile?: ExecFileRunner;
  process_ownership?: RuntimeProcessOwnershipPort;
  host_id?: string;
}

export class CodexTradingResearchAgentAdapter
implements TradingResearchAgentAdapter, ResearchWorkerSessionAdapter {
  readonly agent: ManagedResearchAgent;
  private readonly command: string;
  private readonly timeoutMs: number;
  private readonly reasoningEffort: "low" | "medium" | "high" | "xhigh";
  private readonly env?: NodeJS.ProcessEnv;
  private readonly execFile: ExecFileRunner;
  private readonly processOwnership?: RuntimeProcessOwnershipPort;
  private readonly hostId: string;

  constructor(options: CodexTradingResearchAgentOptions = {}) {
    this.agent = {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      model: options.model,
      permission_policy: "artifact_workspace_only"
    };
    this.command = options.command ?? "codex";
    this.timeoutMs = options.timeout_ms ?? 120_000;
    this.reasoningEffort = options.reasoning_effort ?? "low";
    this.env = options.env;
    this.execFile = options.execFile ?? defaultExecFileRunner;
    this.processOwnership = options.process_ownership;
    this.hostId = options.host_id ?? hostname();
  }

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const command = this.buildCommand(input);
    try {
      const prompt = await this.buildPrompt(input);
      const before = await editableArtifactSnapshot(input.artifact_dir);
      const result = await this.execFile(this.command, command, {
        cwd: input.artifact_dir,
        timeout: this.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        stdin: prompt,
        env: this.env
      });
      const after = await editableArtifactSnapshot(input.artifact_dir);
      const changedPaths = changedEditablePaths(before, after);
      if (changedPaths.length === 0) {
        return {
          status: "no_change",
          summary: "Codex left the trading system artifact unchanged.",
          changed_paths: [],
          command,
          stdout: String(result.stdout),
          stderr: String(result.stderr)
        };
      }
      return {
        status: "edited",
        summary: "Codex edited the trading system artifact workspace.",
        changed_paths: changedPaths,
        command,
        stdout: String(result.stdout),
        stderr: String(result.stderr)
      };
    } catch (error) {
      const commandError = asCodexCommandError(error);
      return {
        status: "failed",
        summary: "Codex failed before producing an artifact edit.",
        failure_reason: classifyCodexFailure(error),
        command,
        stdout: commandError?.stdout,
        stderr: commandError?.stderr,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runSession(input: ResearchWorkerSessionInput): Promise<ResearchWorkerSessionResult> {
    if (input.process_ownership && !this.processOwnership) {
      throw new Error("research_provider_process_ownership_required");
    }
    const client = await createResearchWorkerToolClient();
    let server: ResearchWorkerToolServerHandle | undefined;
    try {
      server = await startResearchWorkerToolServer(input.tools);
      const command = this.buildCommandForArtifact(input.artifact_dir, server);
      const prompt = await this.buildSessionPrompt(input);
      const ownership = this.processOwnership
        ? this.providerProcessOwnership(input, command)
        : undefined;
      await this.execFile(this.command, command, {
        cwd: input.artifact_dir,
        timeout: Math.min(this.timeoutMs, input.timeout_ms),
        maxBuffer: 10 * 1024 * 1024,
        stdin: prompt,
        env: {
          ...this.env,
          OUROBOROS_RESEARCH_TOOL_BASE_URL:
            server.transport === "loopback_tcp" ? server.base_url : undefined,
          OUROBOROS_RESEARCH_TOOL_SOCKET_PATH:
            server.transport === "unix_socket" ? server.socket_path : undefined,
          OUROBOROS_RESEARCH_TOOL_TOKEN: server.authorization_token,
          OUROBOROS_RESEARCH_TOOL_CLIENT: client.client_path
        },
        ...(ownership ? { ownership } : {})
      });
      const status = await input.tools.status();
      if (status.session_status === "selected" &&
        status.selected_submission_sequence !== null) {
        return {
          status: "selected",
          summary: "Codex explicitly selected a completed development submission.",
          selected_submission_sequence: status.selected_submission_sequence,
          provider_command_count: 1
        };
      }
      if (status.session_status === "failed") {
        throw new Error("research_worker_codex_session_failed");
      }
      return {
        status: "finished_without_submission",
        summary: status.session_status === "finished_without_submission"
          ? "Codex explicitly finished without a development selection."
          : "Codex exited without a terminal tool action.",
        provider_command_count: 1
      };
    } finally {
      try {
        await server?.close();
      } finally {
        await client.close();
      }
    }
  }

  buildCommand(input: AgentEditInput): string[] {
    return this.buildCommandForArtifact(input.artifact_dir);
  }

  private buildCommandForArtifact(
    artifactDir: string,
    researchToolServer?: ResearchWorkerToolServerHandle
  ): string[] {
    const command = [
      "exec",
      "--ignore-user-config",
      "--strict-config",
      "--ephemeral",
      "-c",
      "approval_policy=\"never\"",
      "-c",
      "web_search=\"disabled\"",
      "-c",
      "features.apps=false",
      "-c",
      "features.plugins=false",
      "-c",
      "features.remote_plugin=false",
      "-c",
      "features.multi_agent=false",
      "-c",
      "features.browser_use=false",
      "-c",
      "features.browser_use_external=false",
      "-c",
      "features.computer_use=false",
      "-c",
      "features.in_app_browser=false",
      "-c",
      "features.image_generation=false",
      "-c",
      "features.chronicle=false",
      "-c",
      "features.workspace_dependencies=false",
      "-c",
      "features.hooks=false",
      "-c",
      "features.goals=false",
      "-c",
      `model_reasoning_effort="${this.reasoningEffort}"`,
      "-c",
      "shell_environment_policy.inherit=\"all\"",
      "-c",
      "shell_environment_policy.ignore_default_excludes=true",
      "-c",
      CODEX_RESEARCH_SHELL_ENVIRONMENT_CONFIG,
      "--cd",
      artifactDir
    ];
    if (this.agent.model) {
      command.push("--model", this.agent.model);
    }
    if (researchToolServer) {
      const networkConfig = codexResearchNetworkConfig(researchToolServer);
      command.push(
        "-c",
        `default_permissions="${CODEX_RESEARCH_PERMISSION_PROFILE}"`,
        "-c",
        networkConfig.permission,
        "-c",
        networkConfig.proxy
      );
    } else {
      command.push("--sandbox", "workspace-write");
    }
    command.push("--skip-git-repo-check", "-");
    return command;
  }

  private providerProcessOwnership(
    input: ResearchWorkerSessionInput,
    command: string[]
  ): {
    port: RuntimeProcessOwnershipPort;
    expected: RuntimeProcessExpectedIdentity;
  } {
    if (!this.processOwnership || !input.process_ownership) {
      throw new Error("research_worker_process_ownership_scope_missing");
    }
    return {
      port: this.processOwnership,
      expected: {
        process_kind: "research_provider",
        subject_ref: providerProcessSubjectRef(
          input.process_ownership.subject_ref,
          input.artifact_dir
        ),
        runtime_ref: { ...input.process_ownership.runtime_ref },
        host_id: this.hostId,
        executable: this.command,
        profile_digest: providerProcessProfileDigest({
          agent: this.agent,
          command: this.command,
          args: command,
          cwd: input.artifact_dir
        })
      }
    };
  }

  private async buildSessionPrompt(input: ResearchWorkerSessionInput): Promise<string> {
    const program = await readFile(input.program_path, "utf8");
    const notebook = summarizeNotebook(await readFile(input.notebook_path, "utf8"));
    const arenaContext = sanitizeResearchWorkerArenaContext(input.arena_context);
    return [
      "You are one autonomous Ouroboros ResearchWorker session inside a bounded TradingSystem artifact workspace.",
      "Read the broad research direction and released prior findings, then choose your own research sequence.",
      "You may inspect and edit only the current artifact workspace and run bounded local checks when useful.",
      "External development Evaluation is available only through the generated tool client.",
      "Do not infer hidden evaluator cases, seek credentials, or add live trading authority.",
      "The artifact must keep using the external TradingApiProvider through TRADING_API_BASE_URL.",
      `You may submit at most ${input.submission_limit} development snapshots during this session.`,
      "A submission is an immutable snapshot; later edits do not change it.",
      "Development feedback is aggregate evidence, not final trading or promotion authority.",
      "Explicitly select one completed submission or explicitly finish without a selection before exiting.",
      "Do not assume the highest development score must be selected.",
      "Use these commands with a fresh bounded idempotency key for each new action:",
      "node \"$OUROBOROS_RESEARCH_TOOL_CLIENT\" status",
      "node \"$OUROBOROS_RESEARCH_TOOL_CLIENT\" submit '{\"idempotency_key\":\"...\",\"research_note\":\"...\"}'",
      "node \"$OUROBOROS_RESEARCH_TOOL_CLIENT\" select '{\"idempotency_key\":\"...\",\"submission_sequence\":1,\"reason\":\"...\"}'",
      "node \"$OUROBOROS_RESEARCH_TOOL_CLIENT\" finish '{\"idempotency_key\":\"...\",\"reason\":\"...\"}'",
      "",
      "Research program:",
      program,
      "",
      "Released notebook context:",
      notebook,
      "",
      "CandidateArena context:",
      arenaContext ?? "No released CandidateArena context was provided."
    ].join("\n");
  }

  private async buildPrompt(input: AgentEditInput): Promise<string> {
    const program = await readFile(input.program_path, "utf8");
    const notebook = await readFile(input.notebook_path, "utf8");
    const recentNotebook = summarizeNotebook(notebook);
    const arenaContext = sanitizeResearchWorkerArenaContext(input.arena_context);
    return [
      "You are a Codex managed researcher submitting a new Ouroboros TradingSystem candidate into the Candidate Arena.",
      "Read the compact arena context, the target research direction, and recent failures, then produce one new candidate artifact.",
      "Edit only files in the current trading system artifact directory.",
      "Do not add provider credentials, live trading authority, exchange-specific code, or hidden evaluator assumptions.",
      "The artifact must call the external TradingApiProvider through TRADING_API_BASE_URL.",
      "Make at most one small code edit, then stop. Do not run long tests or broad repository commands.",
      "The primary ranking metric is net_revenue_usdt (revenue - cost); net_return_pct is secondary.",
      "Prefer a small direction-specific change that could improve net revenue after fee, slippage, and funding costs.",
      "If the artifact already matches the requested direction and cannot be improved safely, leave it unchanged and stop.",
      `Iteration: ${input.iteration}`,
      `Previous best development score: ${input.previous_best_score ?? "none"}`,
      "",
      "Research program:",
      program,
      "",
      "Recent notebook summary:",
      recentNotebook,
      "",
      "Candidate Arena context:",
      arenaContext ?? "No arena context provided.",
      "",
      "Task: submit one small, testable TradingSystem candidate for the Candidate Arena."
    ].join("\n");
  }
}

function codexResearchNetworkConfig(
  server: ResearchWorkerToolServerHandle
): { permission: string; proxy: string } {
  const common = server.transport === "unix_socket"
    ? "domains={}," +
      `unix_sockets={${JSON.stringify(server.socket_path)}=\"allow\"},` +
      "allow_local_binding=false,allow_upstream_proxy=false," +
      "enable_socks5=false,enable_socks5_udp=false"
    : "domains={\"127.0.0.1\"=\"allow\"}," +
      "allow_local_binding=true,allow_upstream_proxy=false," +
      "enable_socks5=false,enable_socks5_udp=false";
  return {
    permission:
      `permissions.${CODEX_RESEARCH_PERMISSION_PROFILE}={` +
      `extends=\":workspace\",network={enabled=true,mode=\"limited\",${common}}}`,
    proxy: `features.network_proxy={enabled=true,${common}}`
  };
}

export interface FixtureTradingResearchAgentOptions {
  early_selection_score?: number;
}

export class FixtureTradingResearchAgentAdapter
implements TradingResearchAgentAdapter, ResearchWorkerSessionAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-fixture-trading-research",
    provider: "fixture",
    model: "scripted-fixture",
    permission_policy: "fixture_only"
  };
  private readonly earlySelectionScore?: number;

  constructor(options: FixtureTradingResearchAgentOptions = {}) {
    if (options.early_selection_score !== undefined &&
      !Number.isFinite(options.early_selection_score)) {
      throw new Error("fixture_research_early_selection_score_invalid");
    }
    this.earlySelectionScore = options.early_selection_score;
  }

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const nextRisk = input.iteration === 1 ? "0.02" : "0.10";
    const edited = source.replace(/RISK_FRACTION = [0-9.]+/, `RISK_FRACTION = ${nextRisk}`);
    await writeFile(runPath, edited, "utf8");
    return {
      status: "edited",
      summary: `Fixture agent set RISK_FRACTION to ${nextRisk}.`,
      changed_paths: ["run.py"]
    };
  }

  async runSession(input: ResearchWorkerSessionInput): Promise<ResearchWorkerSessionResult> {
    let providerCommandCount = 0;
    let bestAccepted: { submission_sequence: number; score: number } | undefined;
    for (let iteration = 1; iteration <= input.submission_limit; iteration += 1) {
      const edit = await this.improveArtifact({
        agent: this.agent,
        artifact_dir: input.artifact_dir,
        program_path: input.program_path,
        notebook_path: input.notebook_path,
        iteration,
        previous_best_score: bestAccepted?.score,
        arena_context: input.arena_context
      });
      providerCommandCount += 1;
      if (edit.status === "failed") {
        throw new Error(edit.error ?? edit.summary);
      }
      const submitted = await input.tools.submitDevelopment({
        idempotency_key: `fixture-development-${iteration}`,
        research_note: edit.summary
      });
      if (submitted.feedback.status === "accepted" &&
        (!bestAccepted || submitted.feedback.score > bestAccepted.score)) {
        bestAccepted = {
          submission_sequence: submitted.submission_sequence,
          score: submitted.feedback.score
        };
      }
      if (bestAccepted && this.earlySelectionScore !== undefined &&
        bestAccepted.score >= this.earlySelectionScore) {
        return this.selectFixtureSubmission(
          input,
          bestAccepted,
          providerCommandCount,
          "Fixture selected early after aggregate development feedback met its threshold."
        );
      }
    }
    if (bestAccepted) {
      return this.selectFixtureSubmission(
        input,
        bestAccepted,
        providerCommandCount,
        "Fixture selected its highest accepted aggregate development result."
      );
    }
    const finished = await input.tools.finishWithoutSubmission({
      idempotency_key: "fixture-finish-without-accepted-submission",
      reason: "Fixture found no accepted development submission."
    });
    return {
      status: finished.session_status,
      summary: finished.reason,
      provider_command_count: providerCommandCount
    };
  }

  private async selectFixtureSubmission(
    input: ResearchWorkerSessionInput,
    selected: { submission_sequence: number; score: number },
    providerCommandCount: number,
    reason: string
  ): Promise<ResearchWorkerSessionResult> {
    const selection = await input.tools.selectDevelopment({
      idempotency_key: `fixture-select-${selected.submission_sequence}`,
      submission_sequence: selected.submission_sequence,
      reason
    });
    return {
      status: selection.session_status,
      summary: selection.reason,
      selected_submission_sequence: selection.submission_sequence,
      provider_command_count: providerCommandCount
    };
  }
}

export class NoopTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-noop-trading-research",
    provider: "fixture",
    model: "noop-fixture",
    permission_policy: "fixture_only"
  };

  async improveArtifact(): Promise<AgentEditResult> {
    return {
      status: "no_change",
      summary: "Noop fixture left the artifact unchanged.",
      changed_paths: []
    };
  }
}

const defaultExecFileRunner: ExecFileRunner = async (file, args, options = {}) => {
  if (options.ownership) {
    const reconciliation = await options.ownership.port.reconcile({
      expected: options.ownership.expected,
      mode: "terminate",
      reconciledAt: new Date().toISOString()
    });
    if (reconciliation.status === "blocked") {
      throw new CodexCommandError(
        "codex_cli_failed",
        `Provider process ownership reconciliation blocked: ${reconciliation.reason}`,
        "",
        ""
      );
    }
  }
  const sessionToken = options.ownership ? randomUUID() : undefined;
  const startedAt = new Date().toISOString();
  const gateFile = sessionToken ? providerOwnershipGateFile(sessionToken) : undefined;
  if (gateFile) {
    await writeFile(gateFile, "wait\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
  }
  return new Promise((resolve, reject) => {
    const processGroup = process.platform !== "win32";
    const gatedCommand = providerGatedCommand(file, args, gateFile);
    const child = spawn(gatedCommand.file, gatedCommand.args, {
      cwd: options.cwd,
      env: managedResearchAgentEnv({
        ...options.env,
        ...(sessionToken
          ? { OUROBOROS_PROCESS_SESSION_TOKEN: sessionToken }
          : {})
      }),
      detached: processGroup,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    let terminationError: Error | undefined;
    let ownershipRecord: Awaited<ReturnType<RuntimeProcessOwnershipPort["claim"]>> | undefined;
    let ownershipClaim: Promise<void> = Promise.resolve();
    const commandText = `${file} ${args.join(" ")}`;
    const stdoutText = () => Buffer.concat(stdout).toString("utf8");
    const stderrText = () => Buffer.concat(stderr).toString("utf8");
    const clearCommandTimeout = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
    const failBeforeSpawn = (error: Error) => {
      clearCommandTimeout();
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const terminate = (error: Error) => {
      if (settled || terminationError) return;
      terminationError = error;
      clearCommandTimeout();
      killProcessGroup(child.pid, child.kill.bind(child), processGroup);
    };
    const timeout = options.timeout
      ? setTimeout(() => {
          terminate(new CodexCommandError(
            "codex_timed_out",
            `Command timed out after ${options.timeout}ms: ${commandText}\n${stderrText()}${stdoutText()}`,
            stdoutText(),
            stderrText()
          ));
        }, options.timeout)
      : undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      if (terminationError) return;
      stdout.push(chunk);
      if (options.maxBuffer && Buffer.concat(stdout).length > options.maxBuffer) {
        terminate(new CodexCommandError(
          "codex_cli_failed",
          `stdout exceeded maxBuffer for ${commandText}`,
          stdoutText(),
          stderrText()
        ));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (terminationError) return;
      stderr.push(chunk);
      if (options.maxBuffer && Buffer.concat(stderr).length > options.maxBuffer) {
        terminate(new CodexCommandError(
          "codex_cli_failed",
          `stderr exceeded maxBuffer for ${commandText}`,
          stdoutText(),
          stderrText()
        ));
      }
    });
    child.on("error", (error) => {
      if (gateFile) {
        void rm(gateFile, { force: true }).finally(() => failBeforeSpawn(error));
        return;
      }
      failBeforeSpawn(error);
    });
    child.stdin.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
        terminate(error);
      }
    });
    child.once("spawn", () => {
      if (!options.ownership || !sessionToken || child.pid === undefined) {
        child.stdin.end(options.stdin ?? "");
        return;
      }
      ownershipClaim = options.ownership.port.claim({
        expected: options.ownership.expected,
        processId: child.pid,
        sessionToken,
        startedAt
      }).then(async (record) => {
        ownershipRecord = record;
        if (gateFile) await releaseProviderOwnershipGate(gateFile);
        child.stdin.end(options.stdin ?? "");
      }).catch((error) => {
        terminate(new CodexCommandError(
          "codex_cli_failed",
          error instanceof Error
            ? `Provider process ownership claim failed: ${error.message}`
            : "Provider process ownership claim failed.",
          stdoutText(),
          stderrText()
        ));
        throw error;
      });
      void ownershipClaim.catch(() => undefined);
    });
    child.on("close", (code) => {
      void finalize(code);
    });

    const finalize = async (code: number | null) => {
      clearCommandTimeout();
      if (settled) {
        return;
      }
      settled = true;
      let ownershipSetupError: unknown;
      try {
        await ownershipClaim;
      } catch (error) {
        ownershipSetupError = error;
      }
      try {
        if (ownershipRecord && options.ownership) {
          await options.ownership.port.close({
            ownership: ownershipRecord,
            terminalReason: providerTerminalReason(code, terminationError),
            closedAt: new Date().toISOString()
          });
        }
        if (gateFile) await rm(gateFile, { force: true });
      } catch (error) {
        reject(new CodexCommandError(
          "codex_cli_failed",
          error instanceof Error
            ? `Provider process ownership finalization failed: ${error.message}`
            : "Provider process ownership finalization failed.",
          stdoutText(),
          stderrText()
        ));
        return;
      }
      if (ownershipSetupError) {
        reject(new CodexCommandError(
          "codex_cli_failed",
          ownershipSetupError instanceof Error
            ? `Provider process ownership finalization failed: ${ownershipSetupError.message}`
            : "Provider process ownership finalization failed.",
          stdoutText(),
          stderrText()
        ));
        return;
      }
      if (terminationError) {
        reject(terminationError);
        return;
      }
      const finalStdout = stdoutText();
      const finalStderr = stderrText();
      if (code === 0) {
        resolve({ stdout: finalStdout, stderr: finalStderr });
        return;
      }
      reject(new CodexCommandError(
        "codex_cli_failed",
        `Command exited ${code}: ${commandText}\n${finalStderr}${finalStdout}`,
        finalStdout,
        finalStderr
      ));
    };
  });
};

function providerOwnershipGateFile(sessionToken: string): string {
  const tokenDigest = createHash("sha256").update(sessionToken).digest("hex");
  return path.join(tmpdir(), `ouroboros-provider-ownership-${tokenDigest}.gate`);
}

function providerGatedCommand(
  file: string,
  args: string[],
  gateFile: string | undefined
): { file: string; args: string[] } {
  if (!gateFile) return { file, args };
  return process.platform === "win32"
    ? {
        file: process.execPath,
        args: ["-e", OWNED_PROVIDER_PROCESS_GATE_SOURCE, gateFile, file, ...args]
      }
    : {
        file: "/bin/sh",
        args: [
          "-c",
          OWNED_PROVIDER_PROCESS_GATE_SHELL,
          "ouroboros-provider-gate",
          gateFile,
          file,
          ...args
        ]
      };
}

async function releaseProviderOwnershipGate(gateFile: string): Promise<void> {
  await writeFile(gateFile, "go\n", { encoding: "utf8", mode: 0o600 });
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const consumed = await readFile(gateFile, "utf8").then(
      () => false,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return true;
        throw error;
      }
    );
    if (consumed) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("provider_ownership_gate_consumption_timeout");
}

function providerTerminalReason(
  exitCode: number | null,
  terminationError: Error | undefined
): RuntimeProcessTerminalReason {
  if (terminationError instanceof CodexCommandError &&
    terminationError.failure_reason === "codex_timed_out") {
    return "timed_out";
  }
  return exitCode === 0 ? "completed" : "crashed";
}

function killProcessGroup(
  pid: number | undefined,
  killChild: (signal?: NodeJS.Signals | number) => boolean,
  processGroup: boolean
): void {
  if (processGroup && pid !== undefined) {
    try {
      process.kill(-pid, "SIGKILL");
      return;
    } catch {
      // Fall back to the direct child when the process group already exited or is unavailable.
    }
  }
  killChild("SIGKILL");
}

function managedResearchAgentEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "SystemRoot", "COMSPEC", "PATHEXT"]) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }
  return Object.fromEntries(
    Object.entries({
      ...env,
      ...overrides
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function providerProcessProfileDigest(input: {
  agent: ManagedResearchAgent;
  command: string;
  args: string[];
  cwd: string;
}): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({
    provider: input.agent.provider,
    model: input.agent.model ?? null,
    permission_policy: input.agent.permission_policy,
    command: input.command,
    args: input.args,
    cwd: path.resolve(input.cwd)
  })).digest("hex")}`;
}

function providerProcessSubjectRef(workerRef: Ref, artifactDir: string): Ref {
  const resolved = path.resolve(artifactDir);
  const marker = `${path.sep}candidate-arena-runs${path.sep}`;
  const markerIndex = resolved.lastIndexOf(marker);
  const storeRoot = markerIndex > 0 ? resolved.slice(0, markerIndex) : resolved;
  const scopeDigest = createHash("sha256").update(storeRoot).digest("hex").slice(0, 24);
  return {
    record_kind: "research_worker_process_scope",
    id: `${workerRef.id}-${scopeDigest}`
  };
}

class CodexCommandError extends Error {
  constructor(
    readonly failure_reason: AgentEditFailureReason,
    message: string,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(message);
    this.name = "CodexCommandError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function asCodexCommandError(error: unknown): CodexCommandError | undefined {
  return error instanceof CodexCommandError ? error : undefined;
}

function classifyCodexFailure(error: unknown): AgentEditFailureReason {
  if (error instanceof CodexCommandError) {
    if (error.message.includes("failed to initialize in-process app-server client")) {
      return "codex_environment_blocked";
    }
    return error.failure_reason;
  }
  const message = error instanceof Error ? error.message : String(error);
  if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    return "codex_cli_unavailable";
  }
  if (message.includes("failed to initialize in-process app-server client") ||
    message.includes("Operation not permitted")) {
    return "codex_environment_blocked";
  }
  if (message.includes("timed out")) {
    return "codex_timed_out";
  }
  return "codex_cli_failed";
}

function summarizeNotebook(rawNotebook: string): string {
  try {
    const notebook = JSON.parse(rawNotebook) as {
      best_score?: number;
      entries?: Array<{ iteration: number; decision: string; score: number; summary: string }>;
      prior_checkpoint?: {
        research_worker_checkpoint_id?: string;
        terminal_status?: string;
        terminal_reason?: string;
        admission_status?: string;
        admission_reason?: string;
        notebook?: {
          total_entry_count?: number;
          recent_entries?: Array<{
            sequence: number;
            candidate_arena_tick_id: string;
            iteration: number;
            decision: string;
            agent_status: string;
            score: number;
            summary: string;
            evaluation_status: string;
            risk_decision: string;
            net_revenue_usdt: number;
          }>;
        };
      };
    };
    const entries = (notebook.entries ?? []).slice(-3);
    return JSON.stringify({
      ...(notebook.prior_checkpoint
        ? {
            prior_checkpoint: {
              research_worker_checkpoint_id:
                notebook.prior_checkpoint.research_worker_checkpoint_id,
              terminal_status: notebook.prior_checkpoint.terminal_status,
              terminal_reason: notebook.prior_checkpoint.terminal_reason,
              ...(notebook.prior_checkpoint.admission_status &&
                notebook.prior_checkpoint.admission_reason
                ? {
                    admission_status: notebook.prior_checkpoint.admission_status,
                    admission_reason: notebook.prior_checkpoint.admission_reason
                  }
                : {}),
              notebook: {
                total_entry_count:
                  notebook.prior_checkpoint.notebook?.total_entry_count,
                recent_entries:
                  (notebook.prior_checkpoint.notebook?.recent_entries ?? [])
                    .slice(-3)
                    .map((entry) => ({
                      sequence: entry.sequence,
                      candidate_arena_tick_id: entry.candidate_arena_tick_id,
                      iteration: entry.iteration,
                      decision: entry.decision,
                      agent_status: entry.agent_status,
                      score: entry.score,
                      summary: entry.summary,
                      evaluation_status: entry.evaluation_status,
                      risk_decision: entry.risk_decision,
                      net_revenue_usdt: entry.net_revenue_usdt
                    }))
              }
            }
          }
        : {}),
      best_score: notebook.best_score,
      recent_entries: entries.map((entry) => ({
        iteration: entry.iteration,
        decision: entry.decision,
        score: entry.score,
        summary: entry.summary
      }))
    });
  } catch {
    return rawNotebook.slice(0, 2_000);
  }
}

async function editableArtifactSnapshot(artifactDir: string): Promise<Map<string, string>> {
  const editablePaths = await editablePathsFromManifest(artifactDir);
  const snapshot = new Map<string, string>();
  for (const relativePath of editablePaths) {
    const filePath = path.join(artifactDir, relativePath);
    snapshot.set(relativePath, digest(await readFile(filePath)));
  }
  return snapshot;
}

async function editablePathsFromManifest(artifactDir: string): Promise<string[]> {
  try {
    const manifest = JSON.parse(await readFile(path.join(artifactDir, "manifest.json"), "utf8")) as {
      editable_paths?: unknown;
    };
    const editablePaths = Array.isArray(manifest.editable_paths)
      ? manifest.editable_paths.filter((value): value is string => typeof value === "string")
      : [];
    return editablePaths.length > 0 ? editablePaths.sort() : ["run.py"];
  } catch {
    return ["run.py"];
  }
}

function changedEditablePaths(
  before: Map<string, string>,
  after: Map<string, string>
): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths]
    .filter((relativePath) => before.get(relativePath) !== after.get(relativePath))
    .sort();
}

function digest(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
