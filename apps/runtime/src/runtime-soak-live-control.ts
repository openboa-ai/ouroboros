import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { hostname } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DockerSandboxesSbxSandboxAdapter } from "@ouroboros/adapters/sandbox/adapter";
import { BinancePublicMarketSdkAdapter } from
  "@ouroboros/adapters/binance/public-market-adapter";
import type { GatewayMarketDataPort } from
  "@ouroboros/application/ports/market-data";
import { loadTradingGatewayEnvironment } from
  "@ouroboros/application/trading/gateway/environment";
import { loadTradingResearchRuntimeConfig } from
  "@ouroboros/application/trading/research/runtime-config";
import {
  runtimeProcessOwnershipHasRuntimeShape,
  type RuntimeProcessOwnershipRecord
} from "@ouroboros/domain";
import {
  FileSystemRuntimeProcessOwnershipStore,
  LocalStore
} from "@ouroboros/local-store";
import { installRuntimeShutdownHandlers } from "./runtime-shutdown";
import { buildServer } from "./server";
import {
  createLiveRuntimeSoakScenario,
  LIVE_PROVIDER_RECOVERY_ATTEMPT_LIMIT,
  liveProviderRecoveryTimeoutMs,
  liveRuntimeSoakControlPlan,
  recordLiveRuntimeSoakEffect,
  sandboxSamples,
  type LiveRuntimeSoakTargetConfig
} from "./runtime-soak-live-target";

const execFileAsync = promisify(execFile);
const LIVE_RUNTIME_API_TIMEOUT_MS = 10 * 60_000;
const LIVE_RUNTIME_API_RESPONSE_LIMIT_BYTES = 16 * 1024 * 1024;
const ACTIVE_SANDBOX_STATES = new Set([
  "requested", "created", "starting", "running", "stopping"
]);
const RUN_OWNED_SANDBOX_REMOVE_ATTEMPT_LIMIT = 3;

export async function executeLiveRuntimeSoakControl(
  config: LiveRuntimeSoakTargetConfig,
  actionId: string,
  entrypoint: string,
  tsxCli: string
): Promise<void> {
  const action = createAction(config, actionId);
  liveRuntimeSoakControlPlan(action);
  switch (actionId) {
    case "runtime-clean-restart":
      await startRuntime(config, entrypoint, tsxCli);
      await stopProcess(config, "SIGTERM");
      await startRuntime(config, entrypoint, tsxCli);
      await bindProvider(config);
      break;
    case "runtime-crash":
      await stopProcess(config, "SIGKILL");
      break;
    case "runtime-recovery":
      await startRuntime(config, entrypoint, tsxCli);
      await verifySupervisor(config);
      break;
    case "cleanup-delayed":
      await createDelayedCleanup(config);
      break;
    case "cleanup-recovery":
      await recoverDelayedCleanup(config);
      break;
    case "provider-loss":
      await injectProviderLoss(config);
      break;
    case "provider-recovery":
      await recoverProviderAndStartPaper(config);
      break;
    case "sandbox-loss":
      await injectSandboxLoss(config);
      break;
    case "sandbox-recovery":
      await recoverSandbox(config);
      break;
    case "gateway-unavailable":
      await injectGatewayLoss(config);
      break;
    case "gateway-recovery":
      await recoverGateway(config);
      break;
    case "terminal-cleanup":
      await terminalCleanup(config);
      break;
    default:
      throw new Error(`Unknown live runtime soak action: ${actionId}`);
  }
  await recordLiveRuntimeSoakEffect(config, actionId);
}

export async function serveLiveRuntimeSoakRuntime(
  config: LiveRuntimeSoakTargetConfig
): Promise<void> {
  process.env.OUROBOROS_ENABLE_SBX_SANDBOX = "1";
  process.env.OUROBOROS_SANDBOX_ADAPTER = "docker_sandboxes_sbx";
  process.env.OUROBOROS_SBX_BIN = config.sandbox.command;
  process.env.OUROBOROS_SBX_WORKSPACE = config.repo_root;
  if (config.sandbox.home) process.env.OUROBOROS_SBX_HOME = config.sandbox.home;
  const baseline = loadTradingGatewayEnvironment({});
  const marketData = faultGatedMarketData(
    new BinancePublicMarketSdkAdapter({
      restBaseUrl: config.gateway.source_origin,
      webSocket: { autoConnect: false }
    }),
    config.gateway.gate_file
  );
  const token = (await readFile(config.runtime.token_file, "utf8")).trim();
  const server = await buildServer({
    store: new LocalStore(config.store_root),
    repoRoot: config.repo_root,
    tradingGatewayEnvironment: baseline,
    marketDataPort: marketData,
    tradingResearchRuntimeConfig: loadTradingResearchRuntimeConfig({
      ...process.env,
      OUROBOROS_TRADING_RESEARCH_AGENT: "codex",
      OUROBOROS_TRADING_RESEARCH_CODEX_BIN: config.provider.command,
      OUROBOROS_TRADING_RESEARCH_REASONING_EFFORT: config.provider.reasoning_effort,
      OUROBOROS_TRADING_RESEARCH_TIMEOUT_MS: String(config.provider.timeout_ms)
    }),
    sandboxAdapters: {
      docker_sandboxes_sbx: new DockerSandboxesSbxSandboxAdapter({
        sbxPath: config.sandbox.command,
        sbxHome: config.sandbox.home,
        workspacePath: config.repo_root,
        commandTimeoutMs: 120_000,
        detachedCommandTimeoutMs: 5_000
      })
    },
    candidateArenaDirections: ["trend_following"],
    paperTradingEvaluationIntervalMs: 30_000,
    paperTradingSandboxIntervalMs: 1_000,
    tradingApiProviderSandboxHost: config.gateway.sandbox_host,
    runtimeSupervisorMonitorIntervalMs: 1_000,
    runtimeSupervisorRetryDelaysMs: [1_000, 5_000],
    runResearchControlStudiesOnStart: false,
    recoverPaperTradingSessionsOnStart: true,
    runtimeProcessHostId: hostname(),
    operatorApiToken: token
  });
  installRuntimeShutdownHandlers(server);
  await server.listen({ host: config.runtime.host, port: config.runtime.port });
}

function faultGatedMarketData(
  delegate: BinancePublicMarketSdkAdapter,
  gateFile: string
): GatewayMarketDataPort {
  const guard = async () => {
    if (await exists(gateFile)) throw new Error("runtime_soak_gateway_unavailable");
  };
  return {
    provider_kind: delegate.provider_kind,
    source_kind: delegate.source_kind,
    rest_base_url: delegate.rest_base_url,
    required_endpoints: delegate.required_endpoints,
    authority_status: delegate.authority_status,
    async readMarketSnapshot(input) {
      await guard();
      return delegate.readMarketSnapshot(input);
    },
    async readPublicKlineWindow(input) {
      await guard();
      return delegate.readPublicKlineWindow(input);
    },
    async readPublicMarketLivenessSurface(input) {
      await guard();
      return delegate.readPublicMarketLivenessSurface(input);
    },
    async readPublicExecutionSnapshot(input) {
      await guard();
      return delegate.readPublicExecutionSnapshot(input);
    }
  };
}

function createAction(config: LiveRuntimeSoakTargetConfig, actionId: string) {
  const action = createLiveRuntimeSoakScenario(config.run_id).actions.find(
    (item) => item.action_id === actionId
  );
  if (!action) throw new Error(`Action is not part of ${config.run_id}: ${actionId}`);
  return action;
}

async function startRuntime(config: LiveRuntimeSoakTargetConfig, entrypoint: string, tsxCli: string) {
  await startProcess(config, entrypoint, tsxCli);
  await waitFor(async () => (await fetch(`${runtimeOrigin(config)}/health`)).ok, 30_000);
}

async function startProcess(
  config: LiveRuntimeSoakTargetConfig,
  entrypoint: string,
  tsxCli: string
): Promise<void> {
  const stateFile = processStateFile(config);
  if (await processStateAlive(stateFile)) return;
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const instanceToken = randomUUID();
  const logFile = config.runtime.log_file;
  await mkdir(path.dirname(logFile), { recursive: true, mode: 0o700 });
  const log = await open(logFile, "a", 0o600);
  const child = spawn(process.execPath, [
    tsxCli, entrypoint, "serve-runtime", "--config", targetConfigFile(config),
    "--instance-token", instanceToken
  ], {
    cwd: config.repo_root,
    env: process.env,
    detached: true,
    stdio: ["ignore", log.fd, log.fd]
  });
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  await log.close();
  child.unref();
  await writeAtomic(stateFile, {
    version: 1,
    process_kind: "runtime",
    pid: child.pid,
    instance_token: instanceToken,
    started_at: new Date().toISOString()
  });
}

async function stopProcess(
  config: LiveRuntimeSoakTargetConfig,
  signal: "SIGTERM" | "SIGKILL"
): Promise<void> {
  const stateFile = processStateFile(config);
  const state = await readProcessState(stateFile);
  if (!state || !await processStateAlive(stateFile)) {
    throw new Error("runtime process is not the exact live target.");
  }
  await stopRuntimeProcessGroup(state.pid, signal, {
    signalProcessGroup(nextSignal) {
      process.kill(process.platform === "win32" ? state.pid : -state.pid, nextSignal);
    },
    waitUntilStopped(timeoutMs) {
      return waitFor(async () => !await processStateAlive(stateFile), timeoutMs);
    }
  });
}

export async function stopRuntimeProcessGroup(
  pid: number,
  signal: "SIGTERM" | "SIGKILL",
  dependencies: {
    signalProcessGroup(signal: "SIGTERM" | "SIGKILL"): void;
    waitUntilStopped(timeoutMs: number): Promise<void>;
  }
): Promise<void> {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error("Runtime process group pid is invalid.");
  }
  dependencies.signalProcessGroup(signal);
  try {
    await dependencies.waitUntilStopped(signal === "SIGTERM" ? 30_000 : 10_000);
  } catch (error) {
    if (signal !== "SIGTERM") throw error;
    dependencies.signalProcessGroup("SIGKILL");
    await dependencies.waitUntilStopped(10_000);
  }
}

async function bindProvider(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  await command(config, "agent_provider.setup", { provider: "codex" });
  const probed = await command(config, "agent_provider.probe", { provider: "codex" });
  if (!probed.operator?.agent_profiles?.some((profile: any) =>
    profile.provider === "codex" && profile.status === "authenticated"
  )) {
    throw new Error("Managed Codex profile is not authenticated.");
  }
  await command(config, "researcher.provider.select", { provider: "codex" });
}

async function verifySupervisor(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  await waitFor(async () => {
    const response = await fetch(`${runtimeOrigin(config)}/health`);
    if (!response.ok) return false;
    const body = await response.json() as any;
    return body.runtime_supervisor?.status !== "blocked";
  }, 30_000);
}

async function createDelayedCleanup(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const sandboxId = fixtureSandboxId(config);
  await command(config, "sandbox.start", {
    adapter_kind: "docker_sandboxes_sbx",
    idempotency_key: sandboxId,
    sandbox_id: sandboxId,
    sandbox_name: sandboxId,
    test_ticks: 0,
    interval_ms: 1_000
  });
  const sandbox = await new LocalStore(config.store_root).getSandbox(sandboxId);
  if (sandbox?.lifecycle_status !== "running") {
    throw new Error("Delayed-cleanup Sandbox did not start.");
  }
  await runSbx(config, ["stop", sandboxId]);
}

async function recoverDelayedCleanup(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const sandboxId = fixtureSandboxId(config);
  await api(config, `/api/sandboxes/${encodeURIComponent(sandboxId)}`);
  await command(config, "sandbox.stop", { sandbox_id: sandboxId });
}

async function injectProviderLoss(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const tick = apiRaw(config, "/api/commands", {
    method: "POST",
    body: { command_kind: "arena.tick" }
  });
  const ownership = await waitForProviderOwnership(config);
  const adapter = ownershipAdapter(config);
  const inspection = await adapter.inspect(ownershipIdentity(ownership));
  if (inspection.status !== "owned") throw new Error("Research provider owner is not exact.");
  process.kill(process.platform === "win32"
    ? ownership.owner.process_id
    : -ownership.owner.process_id, "SIGKILL");
  await tick;
  await waitFor(async () => !(await activeOwnership(config)).some((record) =>
    record.process_kind === "research_provider"
  ), 30_000);
  const latest = (await new LocalStore(config.store_root).listCandidateArenaTicks()).at(-1);
  if (!latest?.direction_results.some((result) => result.status === "failed")) {
    throw new Error("Provider loss did not produce an externally recorded failed direction.");
  }
}

async function recoverProviderAndStartPaper(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const recoveryDeadline = Date.now() + liveProviderRecoveryTimeoutMs(config.provider.timeout_ms);
  const candidateId = await recoverProviderGeneratedCandidate(async () => {
    const timeoutMs = recoveryDeadline - Date.now();
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("Codex recovery exhausted its bounded control deadline.");
    }
    const tick = await command(config, "arena.tick", undefined, timeoutMs);
    return tick.operator?.candidate_arena?.latest_ticks?.[0]
      ?.created_candidate_ids?.[0];
  }, LIVE_PROVIDER_RECOVERY_ATTEMPT_LIMIT);
  await command(config, "candidate.select", { candidate_id: candidateId });
  await command(config, "trading_run.start", { candidate_id: candidateId });
  const store = new LocalStore(config.store_root);
  const candidate = await store.getCandidate(candidateId);
  const systemCodeId = candidate?.system_code?.ref?.id;
  if (!systemCodeId) throw new Error("Generated candidate has no SystemCode.");
  await writeAtomic(selectionFile(config), {
    version: 1,
    candidate_id: candidateId,
    system_code_id: systemCodeId
  });
  await waitFor(() => generatedSandboxVerified(config, systemCodeId), 180_000);
}

export async function recoverProviderGeneratedCandidate(
  runTick: () => Promise<string | undefined>,
  attemptLimit: number
): Promise<string> {
  if (!Number.isSafeInteger(attemptLimit) || attemptLimit <= 0) {
    throw new Error("Provider recovery attempt limit is invalid.");
  }
  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const candidateId = await runTick();
    if (typeof candidateId === "string" && candidateId.trim() === candidateId &&
      candidateId.length > 0) {
      return candidateId;
    }
  }
  throw new Error(`Codex recovery created no candidate after ${attemptLimit} bounded attempts.`);
}

async function injectSandboxLoss(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const selection = await readSelection(config);
  const store = new LocalStore(config.store_root);
  const sandbox = (await store.listSandboxes()).find((item) =>
    item.system_code_ref.id === selection.system_code_id && item.lifecycle_status === "running"
  );
  if (!sandbox) throw new Error("No active provider-generated Sandbox exists.");
  await runSbx(config, ["stop", sandbox.sandbox_name]);
  await runSbx(config, ["rm", "--force", sandbox.sandbox_name]);
  await api(config, `/api/sandboxes/${encodeURIComponent(sandbox.sandbox_id)}`);
}

async function recoverSandbox(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const selection = await readSelection(config);
  await command(config, "trading_run.start", { candidate_id: selection.candidate_id });
  await waitFor(() => generatedSandboxVerified(config, selection.system_code_id), 180_000);
}

async function injectGatewayLoss(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  await writeFile(config.gateway.gate_file, "blocked\n", { flag: "wx", mode: 0o600 });
  await waitFor(async () => {
    const response = await apiRaw(
      config,
      "/api/trading-substrate/public-market/latest"
    );
    return !response.ok || response.body?.refresh_status === "failed";
  }, 45_000, 2_000);
}

async function recoverGateway(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  await rm(config.gateway.gate_file);
  await waitFor(async () => {
    const response = await apiRaw(
      config,
      "/api/trading-substrate/public-market/latest"
    );
    return response.ok && response.body?.refresh_status === "recorded";
  }, 45_000, 2_000);
}

async function terminalCleanup(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  const store = new LocalStore(config.store_root);
  for (const evaluation of await store.listPaperTradingEvaluations()) {
    if (evaluation.status === "running") {
      await command(config, "trading_run.stop", {
        trading_run_id: evaluation.trading_run_ref.id
      });
    }
  }
  for (const sandbox of await store.listSandboxes()) {
    if (ACTIVE_SANDBOX_STATES.has(sandbox.lifecycle_status)) {
      await command(config, "sandbox.stop", { sandbox_id: sandbox.sandbox_id });
    }
  }
  await stopProcess(config, "SIGTERM");
  const ownership = ownershipAdapter(config);
  const reconciledAt = new Date().toISOString();
  await reconcileRuntimeOwnershipRecords(
    await activeOwnership(config),
    (record) => ownership.reconcile({
      expected: ownershipIdentity(record),
      mode: "terminate",
      reconciledAt
    })
  );
  await waitFor(async () => (await readdir(path.join(
    config.store_root, "runtime-process-ownership", "active"
  )).catch(() => [])).length === 0, 30_000);
  await cleanupRunOwnedSandboxes(config);
}

export async function reconcileRuntimeOwnershipRecords<T>(
  records: readonly T[],
  reconcile: (record: T) => Promise<{ status: string }>
): Promise<void> {
  for (const record of records) {
    const result = await reconcile(record);
    if (result.status !== "vacant" && result.status !== "terminated") {
      throw new Error(`Runtime ownership reconciliation failed: ${result.status}`);
    }
  }
}

async function generatedSandboxVerified(
  config: LiveRuntimeSoakTargetConfig,
  systemCodeId: string
): Promise<boolean> {
  const store = new LocalStore(config.store_root);
  const samples = sandboxSamples(
    (await store.listSandboxes()).filter((item) => item.system_code_ref.id === systemCodeId),
    await store.listPaperTradingHandoffConformances()
  );
  return samples.some((sample) => sample.lifecycle_status === "running" &&
    sample.egress_attestation_version === 2 &&
    sample.egress_attestation_status === "verified");
}

async function command(
  config: LiveRuntimeSoakTargetConfig,
  commandKind: string,
  payload?: Record<string, unknown>,
  timeoutMs = LIVE_RUNTIME_API_TIMEOUT_MS
): Promise<any> {
  const response = await apiRaw(config, "/api/commands", {
    method: "POST",
    body: { command_kind: commandKind, ...(payload ? { payload } : {}) },
    timeout_ms: timeoutMs
  });
  if (!response.ok) throw new Error(`Runtime command ${commandKind} failed (${response.status}).`);
  if (response.body?.command?.status !== "succeeded") {
    throw new Error(`Runtime command ${commandKind} did not succeed.`);
  }
  return response.body;
}

async function api(config: LiveRuntimeSoakTargetConfig, route: string): Promise<any> {
  const response = await apiRaw(config, route);
  if (!response.ok) throw new Error(`Runtime API ${route} failed (${response.status}).`);
  return response.body;
}

async function apiRaw(
  config: LiveRuntimeSoakTargetConfig,
  route: string,
  options: { method?: string; body?: unknown; timeout_ms?: number } = {}
): Promise<{ ok: boolean; status: number; body: any }> {
  const token = (await readFile(config.runtime.token_file, "utf8")).trim();
  return requestLiveRuntimeApi(runtimeOrigin(config), route, token, {
    ...options,
    timeout_ms: options.timeout_ms ?? LIVE_RUNTIME_API_TIMEOUT_MS
  });
}

export async function requestLiveRuntimeApi(
  origin: string,
  route: string,
  token: string,
  options: { method?: string; body?: unknown; timeout_ms?: number } = {}
): Promise<{ ok: boolean; status: number; body: any }> {
  const timeoutMs = options.timeout_ms ?? LIVE_RUNTIME_API_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Live runtime API timeout is invalid.");
  }
  const url = new URL(route, origin);
  const port = Number(url.port);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
    url.username !== "" || url.password !== "" || !url.port ||
    !Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("Live runtime API transport must use exact unprivileged loopback HTTP.");
  }
  const method = options.method ?? "GET";
  const requestBody = options.body === undefined
    ? undefined
    : JSON.stringify(options.body);

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      const detail = error instanceof Error ? error.message : String(error);
      reject(new Error(`Runtime API ${method} ${route} transport failed: ${detail}`, {
        cause: error
      }));
    };
    const request = httpRequest(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(requestBody === undefined
          ? {}
          : {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(requestBody)
            })
      },
      signal: AbortSignal.timeout(timeoutMs)
    }, (response) => {
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > LIVE_RUNTIME_API_RESPONSE_LIMIT_BYTES) {
          request.destroy(new Error("response exceeded the bounded size limit"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", fail);
      response.once("end", () => {
        if (settled) return;
        const status = response.statusCode;
        if (!Number.isSafeInteger(status)) {
          fail(new Error("response status is missing"));
          return;
        }
        const text = Buffer.concat(chunks).toString("utf8");
        let body: any;
        try { body = JSON.parse(text); } catch { body = {}; }
        settled = true;
        resolve({ ok: status! >= 200 && status! < 300, status: status!, body });
      });
    });
    request.once("error", fail);
    request.end(requestBody);
  });
}

async function waitForProviderOwnership(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeProcessOwnershipRecord> {
  let found: RuntimeProcessOwnershipRecord | undefined;
  await waitFor(async () => {
    found = (await activeOwnership(config)).find((record) =>
      record.process_kind === "research_provider"
    );
    return found !== undefined;
  }, 30_000, 200);
  return found!;
}

async function activeOwnership(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeProcessOwnershipRecord[]> {
  const directory = path.join(config.store_root, "runtime-process-ownership", "active");
  const files = await readdir(directory).catch(() => []);
  const values = await Promise.all(files.map(async (file) =>
    JSON.parse(await readFile(path.join(directory, file), "utf8")) as unknown
  ));
  return values.filter(runtimeProcessOwnershipHasRuntimeShape)
    .filter((record) => record.ownership_status === "active");
}

function ownershipAdapter(config: LiveRuntimeSoakTargetConfig) {
  return new FileSystemRuntimeProcessOwnershipStore(path.join(
    config.store_root, "runtime-process-ownership"
  ));
}

function ownershipIdentity(record: RuntimeProcessOwnershipRecord) {
  return {
    process_kind: record.process_kind,
    subject_ref: { ...record.subject_ref },
    runtime_ref: { ...record.runtime_ref },
    host_id: record.owner.host_id,
    executable: record.executable,
    profile_digest: record.profile_digest
  };
}

async function runSbx(config: LiveRuntimeSoakTargetConfig, args: string[]): Promise<void> {
  await execFileAsync(config.sandbox.command, args, {
    cwd: config.repo_root,
    env: { ...process.env, ...(config.sandbox.home ? { HOME: config.sandbox.home } : {}) },
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024
  });
}

async function cleanupRunOwnedSandboxes(config: LiveRuntimeSoakTargetConfig): Promise<void> {
  for (const sandboxName of await listRunOwnedSandboxes(config)) {
    await runSbx(config, ["stop", sandboxName]).catch(() => undefined);
    let lastError: unknown;
    for (let attempt = 0; attempt < RUN_OWNED_SANDBOX_REMOVE_ATTEMPT_LIMIT; attempt += 1) {
      try {
        await runSbx(config, ["rm", "--force", sandboxName]);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) {
      throw new Error(`Run-owned Sandbox cleanup failed: ${sandboxName}`, {
        cause: lastError
      });
    }
  }
  const remaining = await listRunOwnedSandboxes(config);
  if (remaining.length > 0) {
    throw new Error(`Run-owned Sandbox cleanup left residual resources: ${remaining.join(", ")}`);
  }
}

async function listRunOwnedSandboxes(config: LiveRuntimeSoakTargetConfig): Promise<string[]> {
  const { stdout } = await execFileAsync(config.sandbox.command, ["ls", "--json"], {
    cwd: config.repo_root,
    env: { ...process.env, ...(config.sandbox.home ? { HOME: config.sandbox.home } : {}) },
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8"
  });
  return runOwnedSandboxNames(JSON.parse(stdout), config.run_root);
}

export function runOwnedSandboxNames(value: unknown, runRoot: string): string[] {
  if (!isRecord(value) || !Array.isArray(value.sandboxes) ||
    value.sandboxes.length > 4_096 || !path.isAbsolute(runRoot)) {
    throw new Error("Sandbox list response is invalid.");
  }
  const root = path.resolve(runRoot);
  const names = new Set<string>();
  for (const sandbox of value.sandboxes) {
    if (!isRecord(sandbox) || typeof sandbox.name !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(sandbox.name) ||
      !Array.isArray(sandbox.workspaces) || sandbox.workspaces.length > 64 ||
      sandbox.workspaces.some((workspace) =>
        typeof workspace !== "string" || workspace.length > 4_096 ||
        !path.isAbsolute(workspace)
      )) {
      throw new Error("Sandbox list response is invalid.");
    }
    if (sandbox.workspaces.some((workspace) => pathInside(root, workspace as string))) {
      names.add(sandbox.name);
    }
  }
  return [...names].sort();
}

function pathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, path.resolve(candidate));
  return relative === "" || (
    relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSelection(config: LiveRuntimeSoakTargetConfig): Promise<{
  candidate_id: string;
  system_code_id: string;
}> {
  const value = JSON.parse(await readFile(selectionFile(config), "utf8")) as any;
  if (value.version !== 1 || typeof value.candidate_id !== "string" ||
    typeof value.system_code_id !== "string") {
    throw new Error("Live runtime soak selection state is invalid.");
  }
  return value;
}

async function processStateAlive(file: string): Promise<boolean> {
  const state = await readProcessState(file);
  if (!state) return false;
  try {
    process.kill(state.pid, 0);
    const { stdout } = await execFileAsync("ps", ["-p", String(state.pid), "-o", "command="], {
      timeout: 2_000,
      maxBuffer: 64 * 1024
    });
    return String(stdout).includes(state.instance_token);
  } catch {
    return false;
  }
}

async function readProcessState(file: string): Promise<{ pid: number; instance_token: string } | undefined> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as any;
    return Number.isSafeInteger(value.pid) && value.pid > 0 &&
      typeof value.instance_token === "string" && value.instance_token
      ? value
      : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value) + "\n", { mode: 0o600, flag: "wx" });
  await rename(temporary, file);
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 250
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Live runtime soak wait timed out.", lastError ? { cause: lastError } : undefined);
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(() => true, () => false);
}

function targetConfigFile(config: LiveRuntimeSoakTargetConfig): string {
  return path.join(config.run_root, "config", "target.json");
}

function processStateFile(config: LiveRuntimeSoakTargetConfig): string {
  return path.join(config.state_root, "processes", "runtime.json");
}

function selectionFile(config: LiveRuntimeSoakTargetConfig): string {
  return path.join(config.state_root, "selection.json");
}

function fixtureSandboxId(config: LiveRuntimeSoakTargetConfig): string {
  return `ouro-soak-${config.run_id.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(-44)}`;
}

function runtimeOrigin(config: LiveRuntimeSoakTargetConfig): string {
  return `http://${config.runtime.host}:${config.runtime.port}`;
}
