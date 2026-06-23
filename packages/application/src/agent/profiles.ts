import { execFile, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AgentProfileId,
  AgentProfileProviderKind,
  AgentProfileReadModel,
  AgentProfileRecord
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";

const execFileAsync = promisify(execFile);

export const AGENT_PROFILE_IDS: AgentProfileId[] = ["codex", "fixture", "claude_code"];

export type AgentProfileExecFile = (
  file: string,
  args: string[],
  options?: {
    cwd?: string;
    maxBuffer?: number;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  }
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export type AgentProfileSpawnFile = (
  file: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  }
) => Promise<{ exitCode: number | null; signal?: NodeJS.Signals | null }>;

export class UnsupportedAgentProviderError extends Error {
  readonly provider: AgentProfileProviderKind;

  constructor(provider: AgentProfileProviderKind) {
    super(`unsupported agent provider: ${provider}`);
    this.name = "UnsupportedAgentProviderError";
    this.provider = provider;
  }
}

export function parseAgentProfileId(value: unknown): AgentProfileId | undefined {
  if (value === "codex" || value === "fixture" || value === "claude_code") {
    return value;
  }
  return undefined;
}

export function parseAgentProfileProvider(value: unknown): AgentProfileProviderKind | undefined {
  if (value === "codex" || value === "fixture" || value === "claude_code") {
    return value;
  }
  if (value === undefined) {
    return "codex";
  }
  return undefined;
}

export function managedAgentProfileEnv(store: OuroborosStorePort, profileId: AgentProfileId): NodeJS.ProcessEnv {
  const paths = managedAgentProfilePaths(store, profileId);
  return {
    CODEX_HOME: paths.managed_provider_home,
    HOME: paths.managed_home
  };
}

export async function listAgentProfileReadModels(store: OuroborosStorePort): Promise<AgentProfileReadModel[]> {
  const profiles = new Map((await store.listAgentProfiles()).map((profile) => [profile.agent_profile_id, profile]));
  return AGENT_PROFILE_IDS.map((profileId) => toAgentProfileReadModel(
    profiles.get(profileId) ?? defaultAgentProfileRecord(store, profileId, "not_configured")
  ));
}

export async function setupAgentProfile(input: {
  store: OuroborosStorePort;
  profileId: AgentProfileId;
}): Promise<AgentProfileReadModel> {
  if (input.profileId === "claude_code") {
    throw new UnsupportedAgentProviderError(input.profileId);
  }
  const paths = managedAgentProfilePaths(input.store, input.profileId);
  await mkdir(paths.managed_home, { recursive: true });
  await mkdir(paths.managed_provider_home, { recursive: true });
  const profile = await input.store.recordAgentProfile({
    ...defaultAgentProfileRecord(input.store, input.profileId, "configured"),
    updated_at: new Date().toISOString()
  });
  return toAgentProfileReadModel(profile);
}

export async function startAgentProfileLogin(input: {
  store: OuroborosStorePort;
  profileId: AgentProfileId;
  execFile?: AgentProfileExecFile;
}): Promise<AgentProfileReadModel> {
  const profile = await ensureConfiguredProfile(input.store, input.profileId);
  if (profile.provider === "claude_code") {
    throw new UnsupportedAgentProviderError(profile.provider);
  }
  if (profile.provider === "fixture") {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      updated_at: new Date().toISOString()
    }));
  }
  const execFileRunner = input.execFile ?? defaultExecFileRunner;
  try {
    await execFileRunner("codex", ["login", "--device-auth"], {
      env: managedAgentProfileEnv(input.store, input.profileId),
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    });
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      failure_reason: undefined,
      updated_at: new Date().toISOString()
    }));
  } catch (error) {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "login_required",
      failure_reason: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString()
    }));
  }
}

export async function runAgentProfileDeviceLogin(input: {
  store: OuroborosStorePort;
  profileId: AgentProfileId;
  spawnFile?: AgentProfileSpawnFile;
}): Promise<AgentProfileReadModel> {
  const profile = await ensureConfiguredProfile(input.store, input.profileId);
  if (profile.provider === "claude_code") {
    throw new UnsupportedAgentProviderError(profile.provider);
  }
  if (profile.provider === "fixture") {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      updated_at: new Date().toISOString()
    }));
  }
  const spawnFile = input.spawnFile ?? defaultSpawnFile;
  try {
    const result = await spawnFile("codex", ["login", "--device-auth"], {
      env: managedAgentProfileEnv(input.store, input.profileId)
    });
    if (result.exitCode !== 0) {
      throw new Error(`codex login exited with ${result.exitCode ?? result.signal ?? "unknown"}`);
    }
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      failure_reason: undefined,
      updated_at: new Date().toISOString()
    }));
  } catch (error) {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "login_required",
      failure_reason: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString()
    }));
  }
}

export async function probeAgentProfile(input: {
  store: OuroborosStorePort;
  profileId: AgentProfileId;
  execFile?: AgentProfileExecFile;
}): Promise<AgentProfileReadModel> {
  const profile = await ensureConfiguredProfile(input.store, input.profileId);
  if (profile.provider === "claude_code") {
    throw new UnsupportedAgentProviderError(profile.provider);
  }
  if (profile.provider === "fixture") {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      provider_version: "scripted-fixture",
      failure_reason: undefined,
      updated_at: new Date().toISOString()
    }));
  }
  const execFileRunner = input.execFile ?? defaultExecFileRunner;
  try {
    const version = await execFileRunner("codex", ["--version"], {
      env: managedAgentProfileEnv(input.store, input.profileId),
      timeout: 5_000,
      maxBuffer: 1024 * 1024
    });
    await execFileRunner("codex", ["login", "status"], {
      env: managedAgentProfileEnv(input.store, input.profileId),
      timeout: 5_000,
      maxBuffer: 1024 * 1024
    });
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "authenticated",
      provider_version: String(version.stdout).trim(),
      failure_reason: undefined,
      updated_at: new Date().toISOString()
    }));
  } catch (error) {
    return toAgentProfileReadModel(await input.store.recordAgentProfile({
      ...profile,
      status: "login_required",
      failure_reason: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString()
    }));
  }
}

export function toAgentProfileReadModel(profile: AgentProfileRecord): AgentProfileReadModel {
  return {
    profile_id: profile.agent_profile_id,
    label: agentProfileLabel(profile.agent_profile_id),
    provider: profile.provider,
    status: profile.status,
    managed_home: profile.managed_home,
    managed_provider_home: profile.managed_provider_home,
    version: profile.provider_version,
    failure_reason: profile.failure_reason,
    authority_status: "no_trading_authority"
  };
}

function defaultAgentProfileRecord(
  store: OuroborosStorePort,
  profileId: AgentProfileId,
  status: AgentProfileRecord["status"]
): AgentProfileRecord {
  const paths = managedAgentProfilePaths(store, profileId);
  return {
    record_kind: "agent_profile",
    version: 1,
    agent_profile_id: profileId,
    provider: profileId,
    managed_home: paths.managed_home,
    managed_provider_home: paths.managed_provider_home,
    status: profileId === "fixture" && status === "not_configured"
      ? "authenticated"
      : profileId === "claude_code" && status === "not_configured"
        ? "unsupported"
        : status,
    updated_at: new Date(0).toISOString(),
    authority_status: "no_trading_authority"
  };
}

function managedAgentProfilePaths(store: OuroborosStorePort, profileId: AgentProfileId): {
  managed_home: string;
  managed_provider_home: string;
} {
  return {
    managed_home: path.join(store.root(), "agent-profiles", profileId, "home"),
    managed_provider_home: path.join(store.root(), "agent-profiles", profileId, "codex-home")
  };
}

function agentProfileLabel(profileId: AgentProfileId): string {
  if (profileId === "codex") {
    return "Codex";
  }
  if (profileId === "fixture") {
    return "Fixture";
  }
  return "Claude Code";
}

async function ensureConfiguredProfile(
  store: OuroborosStorePort,
  profileId: AgentProfileId
): Promise<AgentProfileRecord> {
  const profile = await store.getAgentProfile(profileId);
  if (profile) {
    return profile;
  }
  await setupAgentProfile({ store, profileId });
  return (await store.getAgentProfile(profileId)) ?? defaultAgentProfileRecord(store, profileId, "configured");
}

const defaultExecFileRunner: AgentProfileExecFile = async (file, args, options) => {
  const result = await execFileAsync(file, args, {
    cwd: options?.cwd,
    env: managedChildProcessEnv(options?.env),
    maxBuffer: options?.maxBuffer,
    timeout: options?.timeout
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
};

const defaultSpawnFile: AgentProfileSpawnFile = async (file, args, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: options?.cwd,
      env: managedChildProcessEnv(options?.env),
      stdio: "inherit"
    });
    child.once("error", reject);
    child.once("exit", (exitCode, signal) => {
      resolve({ exitCode, signal });
    });
  });
};

function managedChildProcessEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
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
