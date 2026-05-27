import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter
} from "./agent-adapters";
import type { TradingResearchAgentAdapter } from "./types";

const execFileAsync = promisify(execFile);

export type TradingResearchRuntimeAgent = "codex" | "fixture";
export type TradingResearchReadinessStatus = "active_verified" | "blocked_or_not_installed";
export type TradingResearchReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface TradingResearchRuntimeConfig {
  default_agent: TradingResearchRuntimeAgent;
  available_agents: TradingResearchRuntimeAgent[];
  iterations: number;
  codex: {
    command: string;
    model?: string;
    timeout_ms: number;
    reasoning_effort: TradingResearchReasoningEffort;
  };
}

export interface TradingResearchAgentReadiness {
  agent: TradingResearchRuntimeAgent;
  provider: TradingResearchRuntimeAgent;
  readiness_status: TradingResearchReadinessStatus;
  permission_policy: "artifact_workspace_only" | "fixture_only";
  model?: string;
  command?: string;
  timeout_ms?: number;
  reasoning_effort?: TradingResearchReasoningEffort;
  version?: string;
  failure_reason?: string;
}

export interface TradingResearchRuntimeReadModel {
  default_agent: TradingResearchRuntimeAgent;
  available_agents: TradingResearchRuntimeAgent[];
  iterations: number;
  agents: TradingResearchAgentReadiness[];
}

export type TradingResearchProbeExecFile = (
  file: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; timeout?: number; env?: NodeJS.ProcessEnv }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export interface LoadTradingResearchRuntimeConfigDefaults {
  iterations?: number;
}

export function loadTradingResearchRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
  defaults: LoadTradingResearchRuntimeConfigDefaults = {}
): TradingResearchRuntimeConfig {
  return {
    default_agent: parseAgent(env.OUROBOROS_TRADING_RESEARCH_AGENT ?? "codex"),
    available_agents: ["codex", "fixture"],
    iterations: parsePositiveInteger(
      env.OUROBOROS_TRADING_RESEARCH_ITERATIONS,
      defaults.iterations ?? 1,
      "OUROBOROS_TRADING_RESEARCH_ITERATIONS"
    ),
    codex: {
      command: env.OUROBOROS_TRADING_RESEARCH_CODEX_BIN || "codex",
      model: emptyToUndefined(env.OUROBOROS_TRADING_RESEARCH_MODEL),
      timeout_ms: parsePositiveInteger(
        env.OUROBOROS_TRADING_RESEARCH_TIMEOUT_MS,
        120_000,
        "OUROBOROS_TRADING_RESEARCH_TIMEOUT_MS"
      ),
      reasoning_effort: parseReasoningEffort(env.OUROBOROS_TRADING_RESEARCH_REASONING_EFFORT ?? "low")
    }
  };
}

export function fixtureTradingResearchRuntimeConfig(): TradingResearchRuntimeConfig {
  return {
    ...loadTradingResearchRuntimeConfig({}, { iterations: 1 }),
    default_agent: "fixture"
  };
}

export function createTradingResearchAgentAdapter(
  config: TradingResearchRuntimeConfig,
  agent: TradingResearchRuntimeAgent = config.default_agent,
  options: { env?: NodeJS.ProcessEnv } = {}
): TradingResearchAgentAdapter {
  if (agent === "fixture") {
    return new FixtureTradingResearchAgentAdapter();
  }
  return new CodexTradingResearchAgentAdapter({
    command: config.codex.command,
    model: config.codex.model,
    timeout_ms: config.codex.timeout_ms,
    reasoning_effort: config.codex.reasoning_effort,
    env: options.env
  });
}

export async function probeTradingResearchRuntimeConfig(
  config: TradingResearchRuntimeConfig,
  execFileRunner: TradingResearchProbeExecFile = defaultExecFileRunner
): Promise<TradingResearchRuntimeReadModel> {
  const codex = await probeCodex(config, execFileRunner);
  return {
    default_agent: config.default_agent,
    available_agents: config.available_agents,
    iterations: config.iterations,
    agents: [
      codex,
      {
        agent: "fixture",
        provider: "fixture",
        readiness_status: "active_verified",
        permission_policy: "fixture_only",
        model: "scripted-fixture"
      }
    ]
  };
}

function parseAgent(value: string): TradingResearchRuntimeAgent {
  if (value === "codex" || value === "fixture") {
    return value;
  }
  throw new Error("OUROBOROS_TRADING_RESEARCH_AGENT must be codex or fixture.");
}

function parseReasoningEffort(value: string): TradingResearchReasoningEffort {
  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  throw new Error("OUROBOROS_TRADING_RESEARCH_REASONING_EFFORT must be low, medium, high, or xhigh.");
}

function parsePositiveInteger(value: string | undefined, fallback: number, variableName: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  throw new Error(`${variableName} must be a positive integer.`);
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.trim() ? value : undefined;
}

async function probeCodex(
  config: TradingResearchRuntimeConfig,
  execFileRunner: TradingResearchProbeExecFile
): Promise<TradingResearchAgentReadiness> {
  const base = {
    agent: "codex" as const,
    provider: "codex" as const,
    permission_policy: "artifact_workspace_only" as const,
    model: config.codex.model,
    command: config.codex.command,
    timeout_ms: config.codex.timeout_ms,
    reasoning_effort: config.codex.reasoning_effort
  };
  try {
    const { stdout } = await execFileRunner(config.codex.command, ["--version"], {
      maxBuffer: 1024 * 1024,
      timeout: Math.min(config.codex.timeout_ms, 5_000)
    });
    return {
      ...base,
      readiness_status: "active_verified",
      version: String(stdout).trim()
    };
  } catch {
    return {
      ...base,
      readiness_status: "blocked_or_not_installed",
      failure_reason: "codex_cli_unavailable"
    };
  }
}

const defaultExecFileRunner: TradingResearchProbeExecFile = async (file, args, options) => {
  const { stdout, stderr } = await execFileAsync(file, args, options);
  return { stdout, stderr };
};
