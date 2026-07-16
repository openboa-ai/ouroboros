import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  open,
  readFile,
  realpath,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { probeAgentProfile, setupAgentProfile } from
  "@ouroboros/application/agent/profiles";
import { LocalStore } from "@ouroboros/local-store";
import {
  createLiveRuntimeSoakHarnessConfig,
  createLiveRuntimeSoakScenario,
  parseLiveRuntimeSoakTargetConfig,
  type LiveRuntimeSoakTargetConfig
} from "./runtime-soak-live-target";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const GIT_OBJECT = /^[a-f0-9]{40}$/;
const RUN_ID = /^[a-z0-9][a-z0-9._-]{2,95}$/;
const execFileAsync = promisify(execFile);

export interface PreparedLiveRuntimeSoakRun {
  config: LiveRuntimeSoakTargetConfig;
  manifest: LiveRuntimeSoakEnvironmentManifest;
  harness_config_path: string;
  manifest_path: string;
  launch_agent_path: string;
  launch_agent_label: string;
}

export interface LiveRuntimeSoakEnvironmentManifest {
  record_kind: "runtime_soak_environment_manifest";
  version: 1;
  run_id: string;
  frozen_at: string;
  repository: {
    clean: true;
    commit: string;
    tree: string;
    source_digest: string;
  };
  host: {
    hostname: string;
    platform: string;
    architecture: string;
    node_version: string;
    host_digest: string;
  };
  provider: {
    kind: "codex";
    profile: "codex";
    command: string;
    version: string;
    status: "authenticated";
    auth_digest: string;
    profile_digest: string;
    config_digest: string;
  };
  sandbox: {
    adapter_kind: "docker_sandboxes_sbx";
    command: string;
    version: string;
    diagnose_digest: string;
    preflight_digest: string;
    config_digest: string;
  };
  public_market: {
    gateway_owner: "MarketDataPort";
    adapter_kind: "binance_public_market_sdk";
    source_origin: "https://fapi.binance.com";
    sandbox_gateway_host: "host.docker.internal";
    probe_digest: string;
    adapter_digest: string;
    policy_digest: string;
  };
  target: {
    config_digest: string;
    scenario_digest: string;
    harness_config_digest: string;
    launch_agent_digest: string;
  };
  authority: LiveRuntimeSoakTargetConfig["authority"];
  manifest_digest: string;
}

export function createLiveRuntimeSoakEnvironmentManifest(input: {
  config: LiveRuntimeSoakTargetConfig;
  frozenAt: string;
  repositoryCommit: string;
  repositoryTree: string;
  host: {
    hostname: string;
    platform: string;
    architecture: string;
    node_version: string;
  };
  provider: {
    command: string;
    version: string;
    auth_digest: string;
    profile_digest: string;
  };
  sandbox: {
    command: string;
    version: string;
    diagnose_digest: string;
    preflight_digest: string;
  };
  publicMarketProbeDigest: string;
  harnessConfigDigest: string;
  launchAgentDigest: string;
}): LiveRuntimeSoakEnvironmentManifest {
  const config = parseLiveRuntimeSoakTargetConfig(input.config);
  if (!exactIso(input.frozenAt) || !GIT_OBJECT.test(input.repositoryCommit) ||
    !GIT_OBJECT.test(input.repositoryTree) || !hostShape(input.host) ||
    !path.isAbsolute(input.provider.command) || !canonical(input.provider.version) ||
    !path.isAbsolute(input.sandbox.command) || !canonical(input.sandbox.version) ||
    ![
      input.provider.auth_digest,
      input.provider.profile_digest,
      input.sandbox.diagnose_digest,
      input.sandbox.preflight_digest,
      input.publicMarketProbeDigest,
      input.harnessConfigDigest,
      input.launchAgentDigest
    ].every((value) => SHA256.test(value))) {
    throw new Error("Live runtime soak environment evidence is invalid.");
  }
  const scenario = createLiveRuntimeSoakScenario(config.run_id);
  const host = {
    ...input.host,
    host_digest: digest(JSON.stringify(input.host))
  };
  const providerConfig = {
    kind: config.provider.kind,
    profile: config.provider.profile,
    command: input.provider.command,
    reasoning_effort: config.provider.reasoning_effort,
    timeout_ms: config.provider.timeout_ms
  };
  const sandboxConfig = {
    adapter_kind: config.sandbox.adapter_kind,
    command: input.sandbox.command,
    ...(config.sandbox.home ? { home: config.sandbox.home } : {})
  };
  const adapter = {
    gateway_owner: "MarketDataPort",
    adapter_kind: "binance_public_market_sdk",
    source_origin: config.gateway.source_origin
  } as const;
  const payload: Omit<LiveRuntimeSoakEnvironmentManifest, "manifest_digest"> = {
    record_kind: "runtime_soak_environment_manifest",
    version: 1,
    run_id: config.run_id,
    frozen_at: input.frozenAt,
    repository: {
      clean: true,
      commit: input.repositoryCommit,
      tree: input.repositoryTree,
      source_digest: digest(JSON.stringify({
        commit: input.repositoryCommit,
        tree: input.repositoryTree
      }))
    },
    host,
    provider: {
      kind: "codex",
      profile: "codex",
      command: input.provider.command,
      version: input.provider.version,
      status: "authenticated",
      auth_digest: input.provider.auth_digest,
      profile_digest: input.provider.profile_digest,
      config_digest: digest(JSON.stringify(providerConfig))
    },
    sandbox: {
      adapter_kind: "docker_sandboxes_sbx",
      command: input.sandbox.command,
      version: input.sandbox.version,
      diagnose_digest: input.sandbox.diagnose_digest,
      preflight_digest: input.sandbox.preflight_digest,
      config_digest: digest(JSON.stringify(sandboxConfig))
    },
    public_market: {
      ...adapter,
      sandbox_gateway_host: config.gateway.sandbox_host,
      probe_digest: input.publicMarketProbeDigest,
      adapter_digest: digest(JSON.stringify(adapter)),
      policy_digest: digest(JSON.stringify({
        source_origin: config.gateway.source_origin,
        sandbox_gateway_host: config.gateway.sandbox_host,
        authority: config.authority
      }))
    },
    target: {
      config_digest: digest(JSON.stringify(config)),
      scenario_digest: digest(JSON.stringify(scenario)),
      harness_config_digest: input.harnessConfigDigest,
      launch_agent_digest: input.launchAgentDigest
    },
    authority: structuredClone(config.authority)
  };
  return { ...payload, manifest_digest: digest(JSON.stringify(payload)) };
}

export function createLiveRuntimeSoakLaunchAgent(input: {
  label: string;
  repoRoot: string;
  nodePath: string;
  tsxCli: string;
  entrypoint: string;
  targetConfigPath: string;
  stdoutPath: string;
  stderrPath: string;
  home: string;
  pathEnvironment: string;
}): string {
  if (!/^[a-zA-Z0-9.-]+$/.test(input.label) || ![
    input.repoRoot,
    input.nodePath,
    input.tsxCli,
    input.entrypoint,
    input.targetConfigPath,
    input.stdoutPath,
    input.stderrPath,
    input.home
  ].every(path.isAbsolute) || !canonical(input.pathEnvironment)) {
    throw new Error("Live runtime soak launch agent input is invalid.");
  }
  const argumentsXml = [
    input.nodePath,
    input.tsxCli,
    input.entrypoint,
    "launch",
    "--config",
    input.targetConfigPath
  ].map((value) => `    <string>${xml(value)}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xml(input.label)}</string>
  <key>ProgramArguments</key>
  <array>
${argumentsXml}
  </array>
  <key>WorkingDirectory</key><string>${xml(input.repoRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>${xml(input.home)}</string>
    <key>PATH</key><string>${xml(input.pathEnvironment)}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(input.stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${xml(input.stderrPath)}</string>
</dict>
</plist>
`;
}

export function verifyLiveRuntimeSoakEnvironmentManifest(
  configInput: LiveRuntimeSoakTargetConfig,
  value: unknown
): LiveRuntimeSoakEnvironmentManifest {
  const config = parseLiveRuntimeSoakTargetConfig(configInput);
  if (!record(value) || !exactKeys(value, [
    "record_kind", "version", "run_id", "frozen_at", "repository", "host",
    "provider", "sandbox", "public_market", "target", "authority",
    "manifest_digest"
  ]) || value.record_kind !== "runtime_soak_environment_manifest" ||
    value.version !== 1 || value.run_id !== config.run_id ||
    !exactIso(String(value.frozen_at)) || !SHA256.test(String(value.manifest_digest)) ||
    !record(value.repository) || value.repository.clean !== true ||
    !record(value.target) || !record(value.authority)) {
    throw new Error("Live runtime soak environment manifest is invalid.");
  }
  const { manifest_digest: manifestDigest, ...payload } = value;
  const scenario = createLiveRuntimeSoakScenario(config.run_id);
  if (manifestDigest !== digest(JSON.stringify(payload)) ||
    value.target.config_digest !== digest(JSON.stringify(config)) ||
    value.target.scenario_digest !== digest(JSON.stringify(scenario)) ||
    JSON.stringify(value.authority) !== JSON.stringify(config.authority)) {
    throw new Error("Live runtime soak environment manifest does not match its target.");
  }
  return structuredClone(value as unknown as LiveRuntimeSoakEnvironmentManifest);
}

export async function prepareLiveRuntimeSoakRun(input: {
  repoRoot: string;
  runId: string;
  runtimePort: number;
  authSource: string;
  providerCommand?: string;
  sandboxCommand?: string;
  sandboxHome?: string;
}): Promise<PreparedLiveRuntimeSoakRun> {
  const repoRoot = path.resolve(input.repoRoot);
  const authSource = path.resolve(input.authSource);
  if (!RUN_ID.test(input.runId) || !portNumber(input.runtimePort) ||
    (input.sandboxHome !== undefined && !path.isAbsolute(input.sandboxHome))) {
    throw new Error("Live runtime soak preparation input is invalid.");
  }
  const repository = await inspectRepository(repoRoot);
  const auth = await readRestrictedAuth(authSource);
  const providerCommand = await executable(input.providerCommand ?? "codex");
  const sandboxCommand = await executable(input.sandboxCommand ?? "sbx");
  const runRoot = path.join(repoRoot, ".ouroboros", "runtime-soaks", input.runId);
  await mkdir(path.dirname(runRoot), { recursive: true, mode: 0o700 });
  await mkdir(runRoot, { mode: 0o700 });
  for (const directory of ["config", "logs", "report", "secrets", "state", "store"]) {
    await mkdir(path.join(runRoot, directory), { mode: 0o700 });
  }

  const config: LiveRuntimeSoakTargetConfig = parseLiveRuntimeSoakTargetConfig({
    version: 1,
    run_id: input.runId,
    repo_root: repoRoot,
    run_root: runRoot,
    store_root: path.join(runRoot, "store"),
    report_root: path.join(runRoot, "report"),
    state_root: path.join(runRoot, "state"),
    runtime: {
      host: "127.0.0.1",
      port: input.runtimePort,
      token_file: path.join(runRoot, "secrets", "operator-token"),
      log_file: path.join(runRoot, "logs", "runtime.log")
    },
    gateway: {
      source_origin: "https://fapi.binance.com",
      sandbox_host: "host.docker.internal",
      gate_file: path.join(runRoot, "state", "gateway-unavailable")
    },
    provider: {
      kind: "codex",
      profile: "codex",
      command: providerCommand,
      reasoning_effort: "low",
      timeout_ms: 10 * 60_000
    },
    sandbox: {
      adapter_kind: "docker_sandboxes_sbx",
      command: sandboxCommand,
      ...(input.sandboxHome ? { home: input.sandboxHome } : {})
    },
    authority: operationalAuthority()
  });

  const store = new LocalStore(config.store_root);
  await store.initialize();
  const configuredProfile = await setupAgentProfile({ store, profileId: "codex" });
  const managedAuth = path.join(configuredProfile.managed_provider_home, "auth.json");
  await copyFile(authSource, managedAuth, constants.COPYFILE_EXCL);
  await chmod(managedAuth, 0o600);
  const providerProfile = await probeAgentProfile({ store, profileId: "codex" });
  if (providerProfile.status !== "authenticated" || !providerProfile.version) {
    throw new Error("Managed Codex profile preflight did not authenticate.");
  }

  const sbxVersion = (await runText(sandboxCommand, ["version"], {
    cwd: repoRoot,
    timeout: 10_000
  })).stdout.trim();
  const sbxDiagnose = await runText(sandboxCommand, ["diagnose", "--output", "json"], {
    cwd: repoRoot,
    timeout: 60_000
  });
  assertSbxDiagnose(sbxDiagnose.stdout);
  const sbxPreflight = await runText("npm", ["run", "validate:s5-sbx:preflight"], {
    cwd: repoRoot,
    timeout: 10 * 60_000
  });
  const publicMarketProbe = await probePublicMarket(config.gateway.source_origin);

  await writeFile(config.runtime.token_file, randomBytes(32).toString("hex") + "\n", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  const entrypoint = path.join(
    repoRoot,
    "apps",
    "runtime",
    "src",
    "run-runtime-soak-live-target.ts"
  );
  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  await Promise.all([access(entrypoint), access(tsxCli)]);
  const targetConfigPath = path.join(runRoot, "config", "target.json");
  const harnessConfigPath = path.join(runRoot, "config", "harness.json");
  const manifestPath = path.join(runRoot, "environment-manifest.json");
  const launchAgentPath = path.join(runRoot, "launch-agent.plist");
  const launchAgentLabel = `ai.openboa.ouroboros.soak.${digest(input.runId).slice(7, 19)}`;
  const launchAgent = createLiveRuntimeSoakLaunchAgent({
    label: launchAgentLabel,
    repoRoot,
    nodePath: process.execPath,
    tsxCli,
    entrypoint,
    targetConfigPath,
    stdoutPath: path.join(runRoot, "logs", "harness.stdout.log"),
    stderrPath: path.join(runRoot, "logs", "harness.stderr.log"),
    home: requiredAbsoluteEnvironment("HOME"),
    pathEnvironment: requiredEnvironment("PATH")
  });
  const harnessConfig = createLiveRuntimeSoakHarnessConfig(
    config,
    entrypoint,
    tsxCli
  );
  const manifest = createLiveRuntimeSoakEnvironmentManifest({
    config,
    frozenAt: new Date().toISOString(),
    repositoryCommit: repository.commit,
    repositoryTree: repository.tree,
    host: {
      hostname: os.hostname(),
      platform: process.platform,
      architecture: process.arch,
      node_version: process.version
    },
    provider: {
      command: providerCommand,
      version: providerProfile.version,
      auth_digest: digest(auth),
      profile_digest: digest(JSON.stringify(providerProfile))
    },
    sandbox: {
      command: sandboxCommand,
      version: sbxVersion,
      diagnose_digest: digest(sbxDiagnose.stdout),
      preflight_digest: digest(sbxPreflight.stdout + sbxPreflight.stderr)
    },
    publicMarketProbeDigest: digest(JSON.stringify(publicMarketProbe)),
    harnessConfigDigest: digest(JSON.stringify(harnessConfig)),
    launchAgentDigest: digest(launchAgent)
  });
  await writeExclusiveJson(targetConfigPath, config);
  await writeExclusiveJson(harnessConfigPath, harnessConfig);
  await writeFile(launchAgentPath, launchAgent, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  await writeExclusiveJson(manifestPath, manifest);
  return {
    config,
    manifest,
    harness_config_path: harnessConfigPath,
    manifest_path: manifestPath,
    launch_agent_path: launchAgentPath,
    launch_agent_label: launchAgentLabel
  };
}

async function inspectRepository(repoRoot: string): Promise<{
  commit: string;
  tree: string;
}> {
  const status = await runText("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repoRoot,
    timeout: 10_000
  });
  if (status.stdout.length > 0) {
    throw new Error("Live runtime soak requires one clean frozen repository commit.");
  }
  const commit = (await runText("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    timeout: 10_000
  })).stdout.trim();
  const tree = (await runText("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: repoRoot,
    timeout: 10_000
  })).stdout.trim();
  if (!GIT_OBJECT.test(commit) || !GIT_OBJECT.test(tree)) {
    throw new Error("Live runtime soak repository identity is invalid.");
  }
  return { commit, tree };
}

export async function readRestrictedAuth(file: string): Promise<Buffer> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size <= 0 ||
      metadata.size > 10 * 1024 * 1024 || (metadata.mode & 0o077) !== 0) {
      throw new Error("Codex auth source must be a restricted regular file.");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function executable(command: string): Promise<string> {
  const candidate = path.isAbsolute(command)
    ? command
    : (await runText("/usr/bin/which", [command], { timeout: 5_000 })).stdout.trim();
  const resolved = await realpath(candidate);
  await access(resolved, constants.X_OK);
  return resolved;
}

async function probePublicMarket(origin: string): Promise<{ serverTime: number }> {
  const response = await fetch(`${origin}/fapi/v1/time`, {
    signal: AbortSignal.timeout(15_000)
  });
  const value = await response.json() as unknown;
  if (!response.ok || !record(value) || !Number.isSafeInteger(value.serverTime) ||
    Number(value.serverTime) <= 0) {
    throw new Error("Binance public market preflight failed.");
  }
  return { serverTime: Number(value.serverTime) };
}

function assertSbxDiagnose(serialized: string): void {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("sbx diagnose did not return JSON.");
  }
  if (!record(value) || !record(value.summary) || value.summary.fail !== 0 ||
    !Array.isArray(value.checks)) {
    throw new Error("sbx diagnose did not prove daemon and authentication health.");
  }
  const checks: unknown[] = value.checks;
  if (!["Daemon", "Authentication"].every((name) =>
      checks.some((check: unknown) => record(check) && check.name === name &&
        check.status === "pass")
  )) {
    throw new Error("sbx diagnose did not prove daemon and authentication health.");
  }
}

async function runText(
  file: string,
  args: string[],
  options: { cwd?: string; timeout: number }
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(file, args, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: process.env,
    encoding: "utf8",
    timeout: options.timeout,
    maxBuffer: 8 * 1024 * 1024
  });
  return { stdout: String(result.stdout), stderr: String(result.stderr) };
}

async function writeExclusiveJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
}

function operationalAuthority(): LiveRuntimeSoakTargetConfig["authority"] {
  return {
    evaluation_authority: false,
    promotion_authority: false,
    order_submission_authority: false,
    private_exchange_authority: false,
    live_exchange_authority: false,
    authority_status: "operational_test_only"
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!canonical(value)) throw new Error(`Required environment variable is missing: ${name}`);
  return value;
}

function requiredAbsoluteEnvironment(name: string): string {
  const value = requiredEnvironment(name);
  if (!path.isAbsolute(value)) {
    throw new Error(`Required environment path is not absolute: ${name}`);
  }
  return value;
}

function digest(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hostShape(value: {
  hostname: string;
  platform: string;
  architecture: string;
  node_version: string;
}): boolean {
  return Object.values(value).every(canonical);
}

function canonical(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function exactIso(value: string): boolean {
  return canonical(value) && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function portNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 65_535;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every(
    (key, index) => key === wanted[index]
  );
}

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
