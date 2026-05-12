import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AgentEditFailureReason,
  AgentEditInput,
  AgentEditResult,
  ManagedResearchAgent,
  TradingResearchAgentAdapter
} from "./types";

type ExecFileRunner = (
  file: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; timeout?: number; stdin?: string }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export interface CodexTradingResearchAgentOptions {
  model?: string;
  command?: string;
  timeout_ms?: number;
  reasoning_effort?: "low" | "medium" | "high" | "xhigh";
  execFile?: ExecFileRunner;
}

export class CodexTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent;
  private readonly command: string;
  private readonly timeoutMs: number;
  private readonly reasoningEffort: "low" | "medium" | "high" | "xhigh";
  private readonly execFile: ExecFileRunner;

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
    this.execFile = options.execFile ?? defaultExecFileRunner;
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
        stdin: prompt
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

  buildCommand(input: AgentEditInput): string[] {
    const command = [
      "exec",
      "-c",
      `model_reasoning_effort="${this.reasoningEffort}"`,
      "--cd",
      input.artifact_dir,
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-"
    ];
    if (this.agent.model) {
      command.splice(5, 0, "--model", this.agent.model);
    }
    return command;
  }

  private async buildPrompt(input: AgentEditInput): Promise<string> {
    const program = await readFile(input.program_path, "utf8");
    const notebook = await readFile(input.notebook_path, "utf8");
    const recentNotebook = summarizeNotebook(notebook);
    return [
      "You are a Codex managed agent in the Ouroboros Trading AAR loop.",
      "Edit only files in the current trading system artifact directory.",
      "Do not add provider credentials, live trading authority, exchange-specific code, or hidden evaluator assumptions.",
      "The artifact must call the external TradingApiProvider through TRADING_API_BASE_URL.",
      "Make at most one small code edit, then stop. Do not run long tests or broad repository commands.",
      "For the current replay proof, prefer the smallest risk-sizing improvement: if run.py has RISK_FRACTION below 0.02, set it to 0.02.",
      "If run.py already has RISK_FRACTION = 0.02 or the notebook says best_score is 1, leave the artifact unchanged and stop.",
      `Iteration: ${input.iteration}`,
      `Previous best score: ${input.previous_best_score ?? "none"}`,
      "",
      "Research program:",
      program,
      "",
      "Recent notebook summary:",
      recentNotebook,
      "",
      "Task: make one small, testable improvement to this trading system artifact."
    ].join("\n");
  }
}

export class FixtureTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent = {
    id: "managed-agent-fixture-trading-research",
    provider: "fixture",
    model: "scripted-fixture",
    permission_policy: "fixture_only"
  };

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
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const commandText = `${file} ${args.join(" ")}`;
    const stdoutText = () => Buffer.concat(stdout).toString("utf8");
    const stderrText = () => Buffer.concat(stderr).toString("utf8");
    const fail = (error: Error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const timeout = options.timeout
      ? setTimeout(() => {
          child.kill("SIGTERM");
          fail(new CodexCommandError(
            "codex_timed_out",
            `Command timed out after ${options.timeout}ms: ${commandText}\n${stderrText()}${stdoutText()}`,
            stdoutText(),
            stderrText()
          ));
        }, options.timeout)
      : undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
      if (options.maxBuffer && Buffer.concat(stdout).length > options.maxBuffer) {
        child.kill("SIGTERM");
        fail(new CodexCommandError(
          "codex_cli_failed",
          `stdout exceeded maxBuffer for ${commandText}`,
          stdoutText(),
          stderrText()
        ));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      if (options.maxBuffer && Buffer.concat(stderr).length > options.maxBuffer) {
        child.kill("SIGTERM");
        fail(new CodexCommandError(
          "codex_cli_failed",
          `stderr exceeded maxBuffer for ${commandText}`,
          stdoutText(),
          stderrText()
        ));
      }
    });
    child.on("error", (error) => {
      fail(error);
    });
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (settled) {
        return;
      }
      settled = true;
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
    });
    child.stdin.end(options.stdin ?? "");
  });
};

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
    };
    const entries = (notebook.entries ?? []).slice(-3);
    return JSON.stringify({
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
