import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
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
  execFile?: ExecFileRunner;
}

export class CodexTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent;
  private readonly command: string;
  private readonly timeoutMs: number;
  private readonly execFile: ExecFileRunner;

  constructor(options: CodexTradingResearchAgentOptions = {}) {
    this.agent = {
      id: "managed-agent-codex-trading-research",
      provider: "codex",
      model: options.model ?? "gpt-5.4",
      permission_policy: "artifact_workspace_only"
    };
    this.command = options.command ?? "codex";
    this.timeoutMs = options.timeout_ms ?? 120_000;
    this.execFile = options.execFile ?? defaultExecFileRunner;
  }

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    try {
      const prompt = await this.buildPrompt(input);
      await this.execFile(this.command, this.buildCommand(input), {
        cwd: input.artifact_dir,
        timeout: this.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        stdin: prompt
      });
      return {
        status: "edited",
        summary: "Codex edited the trading system artifact workspace."
      };
    } catch (error) {
      return {
        status: "failed",
        summary: "Codex failed before producing an artifact edit.",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  buildCommand(input: AgentEditInput): string[] {
    return [
      "exec",
      "--cd",
      input.artifact_dir,
      "--model",
      this.agent.model ?? "gpt-5.4",
      "--sandbox",
      "workspace-write",
      "--skip-git-repo-check",
      "-"
    ];
  }

  private async buildPrompt(input: AgentEditInput): Promise<string> {
    const program = await readFile(input.program_path, "utf8");
    const notebook = await readFile(input.notebook_path, "utf8");
    return [
      "You are a Codex managed agent in the Ouroboros Trading AAR loop.",
      "Edit only files in the current trading system artifact directory.",
      "Do not add provider credentials, live trading authority, exchange-specific code, or hidden evaluator assumptions.",
      "The artifact must call the external TradingApiProvider through TRADING_API_BASE_URL.",
      `Iteration: ${input.iteration}`,
      `Previous best score: ${input.previous_best_score ?? "none"}`,
      "",
      "Research program:",
      program,
      "",
      "Notebook JSON:",
      notebook,
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
      summary: `Fixture agent set RISK_FRACTION to ${nextRisk}.`
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
      summary: "Noop fixture left the artifact unchanged."
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
    const timeout = options.timeout
      ? setTimeout(() => {
          settled = true;
          child.kill("SIGTERM");
          reject(new Error(`Command timed out after ${options.timeout}ms: ${file} ${args.join(" ")}`));
        }, options.timeout)
      : undefined;

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
      if (options.maxBuffer && Buffer.concat(stdout).length > options.maxBuffer) {
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`stdout exceeded maxBuffer for ${file}`));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      if (options.maxBuffer && Buffer.concat(stderr).length > options.maxBuffer) {
        settled = true;
        child.kill("SIGTERM");
        reject(new Error(`stderr exceeded maxBuffer for ${file}`));
      }
    });
    child.on("error", (error) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (settled) {
        return;
      }
      settled = true;
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");
      if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
        return;
      }
      reject(new Error(`Command exited ${code}: ${file} ${args.join(" ")}\n${stderrText}${stdoutText}`));
    });
    child.stdin.end(options.stdin ?? "");
  });
};
