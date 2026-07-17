import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  RuntimeSoakCommand,
} from "@ouroboros/adapters/runtime-soak";
import {
  parseRuntimeSoakSample,
  type RuntimeSoakAction,
  type RuntimeSoakSample,
  type RuntimeSoakScenario
} from "@ouroboros/application/runtime-soak";
import {
  runtimeProcessOwnershipHasRuntimeShape,
  type LedgerChainReadModel,
  type RuntimeProcessOwnershipRecord
} from "@ouroboros/domain";
import {
  FileSystemRuntimeProcessOwnershipStore,
  FileSystemRuntimeSupervisorCheckpointStore,
  FIXTURE_SYSTEM_CODE_ID,
  LocalStore
} from "@ouroboros/local-store";

const SOAK_DURATION_MS = 2 * 60 * 60 * 1_000;
const PUBLIC_BINANCE_ORIGIN = "https://fapi.binance.com";
const SANDBOX_GATEWAY_HOST = "host.docker.internal";
export const LIVE_PROVIDER_RECOVERY_ATTEMPT_LIMIT = 3;
const CONTROL_TIMEOUT_MS = 10 * 60_000;
const PROVIDER_RECOVERY_OVERHEAD_MS = 5 * 60_000;
const ACTIVE_SANDBOX_STATES = new Set([
  "requested",
  "created",
  "starting",
  "running",
  "stopping"
]);
const execFileAsync = promisify(execFile);

export interface LiveRuntimeSoakTargetConfig {
  version: 1;
  run_id: string;
  repo_root: string;
  run_root: string;
  store_root: string;
  report_root: string;
  state_root: string;
  runtime: {
    host: "127.0.0.1";
    port: number;
    token_file: string;
    log_file: string;
  };
  gateway: {
    source_origin: typeof PUBLIC_BINANCE_ORIGIN;
    sandbox_host: typeof SANDBOX_GATEWAY_HOST;
    gate_file: string;
  };
  provider: {
    kind: "codex";
    profile: "codex";
    command: string;
    reasoning_effort: "low";
    timeout_ms: number;
  };
  sandbox: {
    adapter_kind: "docker_sandboxes_sbx";
    command: string;
    home?: string;
  };
  authority: {
    evaluation_authority: false;
    promotion_authority: false;
    order_submission_authority: false;
    private_exchange_authority: false;
    live_exchange_authority: false;
    authority_status: "operational_test_only";
  };
}

export interface LiveRuntimeSoakDaemonSandbox {
  name: string;
  status: string;
  workspaces: string[];
}

export function liveRuntimeSoakSandboxEnvironment(
  command: string,
  home: string | undefined,
  environment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const configured: NodeJS.ProcessEnv = {
    ...environment,
    OUROBOROS_SBX_BIN: command
  };
  delete configured.OUROBOROS_SBX_HOME;
  if (home) {
    configured.HOME = home;
    configured.OUROBOROS_SBX_HOME = home;
  }
  return configured;
}

export function createLiveRuntimeSoakScenario(runId: string): RuntimeSoakScenario {
  return {
    version: 1,
    run_id: runId,
    duration_ms: SOAK_DURATION_MS + CONTROL_TIMEOUT_MS + 60_000,
    sample_interval_ms: 60_000,
    actions: [
      { action_id: "runtime-clean-restart", kind: "clean_restart", at_ms: 0 },
      { action_id: "runtime-crash", kind: "crash", at_ms: 60_000 },
      { action_id: "runtime-recovery", kind: "recovery", recovers: "runtime", at_ms: 90_000 },
      { action_id: "cleanup-delayed", kind: "delayed_cleanup", at_ms: 150_000 },
      { action_id: "cleanup-recovery", kind: "recovery", recovers: "cleanup", at_ms: 210_000 },
      { action_id: "provider-loss", kind: "provider_loss", at_ms: 270_000 },
      { action_id: "provider-recovery", kind: "recovery", recovers: "provider", at_ms: 360_000 },
      { action_id: "sandbox-loss", kind: "sandbox_loss", at_ms: 900_000 },
      { action_id: "sandbox-recovery", kind: "recovery", recovers: "sandbox", at_ms: 960_000 },
      { action_id: "gateway-unavailable", kind: "gateway_unavailable", at_ms: 1_200_000 },
      { action_id: "gateway-recovery", kind: "recovery", recovers: "gateway", at_ms: 1_260_000 },
      {
        action_id: "terminal-cleanup",
        kind: "terminal_cleanup",
        at_ms: SOAK_DURATION_MS
      }
    ]
  };
}

export function liveProviderRecoveryTimeoutMs(providerTimeoutMs: number): number {
  const timeoutMs = providerTimeoutMs * LIVE_PROVIDER_RECOVERY_ATTEMPT_LIMIT +
    PROVIDER_RECOVERY_OVERHEAD_MS;
  if (!Number.isSafeInteger(providerTimeoutMs) || providerTimeoutMs <= 0 ||
    !Number.isSafeInteger(timeoutMs)) {
    throw new Error("Live runtime soak provider recovery timeout is invalid.");
  }
  return timeoutMs;
}

export function liveRuntimeSoakControlPlan(action: RuntimeSoakAction): string[] {
  const plans: Record<string, string[]> = {
    "runtime-clean-restart": [
      "runtime.start", "runtime.stop", "runtime.start", "provider.bind"
    ],
    "runtime-crash": ["runtime.kill"],
    "runtime-recovery": ["runtime.start", "supervisor.verify"],
    "cleanup-delayed": ["sandbox.fixture.start", "sandbox.external.stop"],
    "cleanup-recovery": ["sandbox.refresh", "sandbox.stop"],
    "provider-loss": ["arena.tick", "provider.kill", "ownership.verify"],
    "provider-recovery": ["arena.tick", "paper.start", "egress.verify"],
    "sandbox-loss": ["sandbox.generated.remove", "sandbox.refresh"],
    "sandbox-recovery": ["paper.stop", "sandbox.reset", "paper.start", "sandbox.verify"],
    "gateway-unavailable": [
      "gateway.block", "gateway.verify", "paper.failure.verify", "sandbox.stop.verify"
    ],
    "gateway-recovery": [
      "gateway.unblock", "market.verify", "paper.stop", "sandbox.reset",
      "paper.start", "sandbox.verify"
    ],
    "terminal-cleanup": [
      "paper.stop", "sandbox.stop", "runtime.stop", "sandbox.run-owned.cleanup"
    ]
  };
  const plan = plans[action.action_id];
  if (!plan) throw new Error(`Unknown live runtime soak action: ${action.action_id}`);
  return [...plan];
}

export interface LiveRuntimeSoakHarnessConfig {
  version: 1;
  scenario: RuntimeSoakScenario;
  controls: Record<string, RuntimeSoakCommand>;
  probe: RuntimeSoakCommand;
}

export function createLiveRuntimeSoakHarnessConfig(
  config: LiveRuntimeSoakTargetConfig,
  entrypoint: string,
  tsxCli: string
): LiveRuntimeSoakHarnessConfig {
  const targetConfig = path.join(config.run_root, "config", "target.json");
  const control = (timeoutMs: number): RuntimeSoakCommand => ({
    argv: [process.execPath, tsxCli, entrypoint, "control", "--config", targetConfig],
    cwd: config.repo_root,
    timeout_ms: timeoutMs
  });
  const scenario = createLiveRuntimeSoakScenario(config.run_id);
  const providerRecoveryTimeoutMs = liveProviderRecoveryTimeoutMs(config.provider.timeout_ms);
  const providerRecoveryControlTimeoutMs = providerRecoveryTimeoutMs + CONTROL_TIMEOUT_MS;
  if (!Number.isSafeInteger(providerRecoveryControlTimeoutMs)) {
    throw new Error("Live runtime soak provider recovery timeout is invalid.");
  }
  return {
    version: 1,
    scenario,
    controls: Object.fromEntries(scenario.actions.map((action) => [
      action.action_id,
      control(action.action_id === "provider-recovery"
        ? providerRecoveryControlTimeoutMs
        : CONTROL_TIMEOUT_MS)
    ])),
    probe: {
      argv: [process.execPath, tsxCli, entrypoint, "probe", "--config", targetConfig],
      cwd: config.repo_root,
      timeout_ms: 30_000
    }
  };
}

export async function recordLiveRuntimeSoakEffect(
  config: LiveRuntimeSoakTargetConfig,
  effectId: string
): Promise<void> {
  if (!canonical(effectId)) throw new Error("Live runtime soak effect ID is invalid.");
  const directory = path.join(config.state_root, "effects");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(path.join(directory, `${effectId}.json`), JSON.stringify({
      version: 1,
      effect_id: effectId
    }) + "\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    if (hasCode(error, "EEXIST")) {
      throw new Error(`Live runtime soak effect already exists: ${effectId}`);
    }
    throw error;
  }
}

export async function buildLiveRuntimeSoakSample(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeSoakSample> {
  const effects = await readEffects(config);
  const store = new LocalStore(config.store_root);
  const candidates = await store.listCandidates();
  const candidateDetails = await Promise.all(candidates.map((candidate) =>
    store.getCandidate(candidate.candidate_id)
  ));
  const evaluations = await store.listPaperTradingEvaluations();
  const observations = (await Promise.all(evaluations.map((evaluation) =>
    store.listPaperTradingObservations(evaluation.paper_trading_evaluation_id)
  ))).flat();
  const [sandboxes, conformances, ownership, checkpoint, resources] = await Promise.all([
    store.listSandboxes(),
    store.listPaperTradingHandoffConformances(),
    readOwnership(config),
    new FileSystemRuntimeSupervisorCheckpointStore(config.store_root).latest(),
    readResources(config)
  ]);
  const expectedSandboxStatus = expectedSelectedSandboxStatus(effects);
  const selectedSandboxResource = expectedSandboxStatus === undefined
    ? []
    : [liveRuntimeSoakSelectedSandboxResource({
        systemCodeId: await readSelectedSystemCodeId(config),
        expectedStatus: expectedSandboxStatus,
        sandboxes,
        daemonSandboxes: await readLiveRuntimeSoakSbxSandboxes(config)
      })];
  return parseRuntimeSoakSample({
    version: 1,
    sampled_at: new Date().toISOString(),
    effects,
    chains: [
      ...(effects.length > 0 ? [effectChain(config, effects)] : []),
      ...candidateDetails.flatMap((candidate) => candidate?.ledger?.chains.map(
        runtimeSoakLedgerChain
      ) ?? [])
    ],
    ownership,
    retries: checkpoint?.lanes.map((lane) => ({
      lane: lane.lane,
      attempt_count: lane.attempt_count,
      no_progress_count: lane.no_progress_count,
      retry_budget: 3,
      status: lane.status
    })) ?? [],
    paper_observations: paperObservationStreams(observations),
    sandboxes: sandboxSamples(sandboxes, conformances),
    resources: [...resources, ...selectedSandboxResource]
  });
}

export async function readLiveRuntimeSoakSbxSandboxes(
  config: LiveRuntimeSoakTargetConfig
): Promise<LiveRuntimeSoakDaemonSandbox[]> {
  const { stdout } = await execFileAsync(config.sandbox.command, ["ls", "--json"], {
    cwd: config.repo_root,
    env: liveRuntimeSoakSandboxEnvironment(config.sandbox.command, config.sandbox.home),
    timeout: 20_000,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8"
  });
  return parseLiveRuntimeSoakDaemonSandboxes(JSON.parse(String(stdout)));
}

export function liveRuntimeSoakSelectedSandboxResource(input: {
  systemCodeId: string;
  expectedStatus: "active" | "terminal";
  sandboxes: Array<{
    sandbox_id: string;
    sandbox_name: string;
    system_code_ref: { id: string };
    lifecycle_status: string;
  }>;
  daemonSandboxes: LiveRuntimeSoakDaemonSandbox[];
}): RuntimeSoakSample["resources"][number] {
  if (!canonical(input.systemCodeId)) {
    throw new Error("Live runtime soak selected SystemCode ID is invalid.");
  }
  const candidates = input.sandboxes.filter((item) =>
    item.system_code_ref.id === input.systemCodeId
  );
  const daemonFor = (sandbox: typeof candidates[number]) =>
    input.daemonSandboxes.find((item) => item.name === sandbox.sandbox_name);
  const sandbox = candidates.find((item) =>
    item.lifecycle_status === "running" && daemonFor(item)?.status === "running"
  ) ?? candidates.find((item) => daemonFor(item) !== undefined) ?? candidates.at(-1);
  const daemonSandbox = sandbox
    ? daemonFor(sandbox)
    : undefined;
  const status = !daemonSandbox
    ? "terminal" as const
    : sandbox?.lifecycle_status === "running" && daemonSandbox.status === "running"
      ? "active" as const
      : "stopping" as const;
  return {
    resource_id: sandbox?.sandbox_id ?? `selected-paper-sandbox:${input.systemCodeId}`,
    resource_kind: "selected_paper_sandbox",
    status,
    expected_status: input.expectedStatus
  };
}

export function parseLiveRuntimeSoakTargetConfig(
  value: unknown
): LiveRuntimeSoakTargetConfig {
  if (!record(value) || !exactKeys(value, [
    "version", "run_id", "repo_root", "run_root", "store_root", "report_root",
    "state_root", "runtime", "gateway", "provider", "sandbox", "authority"
  ]) || value.version !== 1 || !canonical(value.run_id) ||
    !absoluteStrings(value, ["repo_root", "run_root", "store_root", "report_root", "state_root"]) ||
    !runtimeConfig(value.runtime) || !gatewayConfig(value.gateway) ||
    !providerConfig(value.provider) || !sandboxConfig(value.sandbox) ||
    !authorityConfig(value.authority) || !boundRunPaths(value)) {
    throw new Error("Live runtime soak target config is invalid.");
  }
  return structuredClone(value as unknown as LiveRuntimeSoakTargetConfig);
}

export function paperObservationStreams(observations: Array<{
  paper_trading_evaluation_ref: { id: string };
  sequence: number;
  status: string;
  decision?: { decision_kind?: string };
}>): RuntimeSoakSample["paper_observations"] {
  const streams = new Map<string, RuntimeSoakSample["paper_observations"][number]["entries"]>();
  for (const observation of [...observations].sort((left, right) =>
    left.paper_trading_evaluation_ref.id.localeCompare(
      right.paper_trading_evaluation_ref.id
    ) || left.sequence - right.sequence
  )) {
    const entries = streams.get(observation.paper_trading_evaluation_ref.id) ?? [];
    const emitted = observation.decision?.decision_kind === "order_request" ? 1 : 0;
    entries.push({
      sequence: observation.sequence,
      emitted_order_request_count: emitted,
      no_order_recorded: emitted === 0 && (
        observation.status === "no_order" || observation.status === "failed" ||
        ["hold", "no_action", "cancel_order", "error"].includes(
          observation.decision?.decision_kind ?? ""
        )
      )
    });
    streams.set(observation.paper_trading_evaluation_ref.id, entries);
  }
  return [...streams].map(([stream_id, entries]) => ({ stream_id, entries }));
}

export function sandboxSamples(
  sandboxes: Array<{
    sandbox_id: string;
    system_code_ref: { id: string };
    lifecycle_status: string;
  }>,
  conformances: Array<{
    version: number;
    system_code_ref: { id: string };
    status: "passed" | "rejected";
    runnable_paper_handoff: boolean;
    candidate_egress_attestation?: unknown;
  }>
): RuntimeSoakSample["sandboxes"] {
  return sandboxes.map((sandbox) => {
    const providerGenerated = sandbox.system_code_ref.id !== FIXTURE_SYSTEM_CODE_ID;
    const conformance = conformances.find((entry) =>
      entry.system_code_ref.id === sandbox.system_code_ref.id
    );
    const active = ACTIVE_SANDBOX_STATES.has(sandbox.lifecycle_status);
    const verified = conformance?.version === 2 && conformance.status === "passed" &&
      conformance.runnable_paper_handoff &&
      conformance.candidate_egress_attestation !== undefined;
    return {
      sandbox_id: sandbox.sandbox_id,
      provider_generated: providerGenerated,
      lifecycle_status: sandbox.lifecycle_status as
        RuntimeSoakSample["sandboxes"][number]["lifecycle_status"],
      ...(providerGenerated && conformance?.version === 2
        ? { egress_attestation_version: 2 }
        : {}),
      ...(providerGenerated && active
        ? { egress_attestation_status: verified ? "verified" as const :
            conformance ? "invalid" as const : "missing" as const }
        : {})
    };
  });
}

export function expectedSelectedSandboxStatus(
  effects: RuntimeSoakSample["effects"]
): "active" | "terminal" | undefined {
  const completed = new Set(effects.map((effect) => effect.effect_id));
  if (completed.has("terminal-cleanup")) return "terminal";
  if (completed.has("gateway-recovery")) return "active";
  if (completed.has("gateway-unavailable")) return "terminal";
  if (completed.has("sandbox-recovery")) return "active";
  if (completed.has("sandbox-loss")) return "terminal";
  if (completed.has("provider-recovery")) return "active";
  return undefined;
}

function parseLiveRuntimeSoakDaemonSandboxes(
  value: unknown
): LiveRuntimeSoakDaemonSandbox[] {
  if (!record(value) || !Array.isArray(value.sandboxes) ||
    value.sandboxes.length > 4_096) {
    throw new Error("Live runtime soak Sandbox list response is invalid.");
  }
  return value.sandboxes.map((sandbox) => {
    if (!record(sandbox) || !canonical(sandbox.name) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(sandbox.name) ||
      !canonical(sandbox.status) || !Array.isArray(sandbox.workspaces) ||
      sandbox.workspaces.length > 64 || sandbox.workspaces.some((workspace) =>
        typeof workspace !== "string" || workspace.length > 4_096 ||
        !path.isAbsolute(workspace)
      )) {
      throw new Error("Live runtime soak Sandbox list response is invalid.");
    }
    return {
      name: sandbox.name,
      status: sandbox.status,
      workspaces: [...sandbox.workspaces] as string[]
    };
  });
}

async function readSelectedSystemCodeId(
  config: LiveRuntimeSoakTargetConfig
): Promise<string> {
  const value = await readJson(path.join(config.state_root, "selection.json"));
  if (!record(value) || !exactKeys(value, ["version", "candidate_id", "system_code_id"]) ||
    value.version !== 1 || !canonical(value.candidate_id) ||
    !canonical(value.system_code_id)) {
    throw new Error("Live runtime soak selection state is invalid.");
  }
  return value.system_code_id;
}

async function readEffects(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeSoakSample["effects"]> {
  const directory = path.join(config.state_root, "effects");
  const files = await readdir(directory).catch((error) => {
    if (hasCode(error, "ENOENT")) return [];
    throw error;
  });
  if (files.some((file) => !/^[a-z0-9-]+\.json$/.test(file))) {
    throw new Error("Live runtime soak effect directory contains an unexpected file.");
  }
  const expectedOrder = new Map(createLiveRuntimeSoakScenario(config.run_id).actions.map(
    (action, index) => [action.action_id, index]
  ));
  const effects = await Promise.all(files.map(async (file) => {
    const value = await readJson(path.join(directory, file));
    if (!record(value) || !exactKeys(value, ["version", "effect_id"]) ||
      value.version !== 1 || !canonical(value.effect_id) ||
      file !== `${value.effect_id}.json` || !expectedOrder.has(value.effect_id)) {
      throw new Error("Live runtime soak effect record is invalid.");
    }
    return { effect_id: value.effect_id, occurrence_count: 1 };
  }));
  return effects.sort((left, right) =>
    expectedOrder.get(left.effect_id)! - expectedOrder.get(right.effect_id)!
  );
}

function effectChain(
  config: LiveRuntimeSoakTargetConfig,
  effects: RuntimeSoakSample["effects"]
): RuntimeSoakSample["chains"][number] {
  let previous: string | undefined;
  return {
    chain_id: `${config.run_id}:effects`,
    chain_kind: "evidence",
    entries: effects.map((effect, index) => {
      const digest = sha256(JSON.stringify(effect));
      const entry = {
        sequence: index + 1,
        digest,
        ...(previous ? { previous_digest: previous } : {})
      };
      previous = digest;
      return entry;
    })
  };
}

export function runtimeSoakLedgerChain(
  chain: LedgerChainReadModel
): RuntimeSoakSample["chains"][number] {
  const records = [
    chain.order_request,
    ...(chain.gateway_result ? [chain.gateway_result] : []),
    ...(chain.execution_result ? [chain.execution_result] : [])
  ];
  let previous: string | undefined;
  const entries = records.map((record, index) => {
    const digest = sha256(JSON.stringify(record));
    const entry = {
      sequence: index + 1,
      digest,
      ...(previous ? { previous_digest: previous } : {})
    };
    previous = digest;
    return entry;
  });
  if (!chain.chain_complete) {
    entries.push({
      sequence: entries.length + 1,
      digest: sha256(`incomplete:${chain.chain_id}`),
      ...(previous ? { previous_digest: previous } : {})
    });
  }
  return { chain_id: chain.chain_id, chain_kind: "ledger", entries };
}

async function readOwnership(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeSoakSample["ownership"]> {
  const root = path.join(config.store_root, "runtime-process-ownership");
  const directory = path.join(root, "active");
  const files = await readdir(directory).catch((error) => {
    if (hasCode(error, "ENOENT")) return [];
    throw error;
  });
  const adapter = new FileSystemRuntimeProcessOwnershipStore(root);
  return Promise.all(files.sort().map(async (file) => {
    const value = await readJson(path.join(directory, file));
    if (!runtimeProcessOwnershipHasRuntimeShape(value) ||
      value.ownership_status !== "active") {
      return {
        scope: `invalid:${file}`,
        active_owner_count: 1,
        identity_status: "mismatched" as const
      };
    }
    const inspection = await adapter.inspect(ownershipIdentity(value));
    const scope = `${value.process_kind}:${value.subject_ref.record_kind}:${value.subject_ref.id}`;
    if (inspection.status === "vacant" || inspection.status === "stale") {
      return { scope, active_owner_count: 0, identity_status: "absent" as const };
    }
    if (inspection.status === "owned") {
      return { scope, active_owner_count: 1, identity_status: "exact" as const };
    }
    return { scope, active_owner_count: 1, identity_status: "unknown" as const };
  }));
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

async function readResources(
  config: LiveRuntimeSoakTargetConfig
): Promise<RuntimeSoakSample["resources"]> {
  return Promise.all([
    ["ouroboros-runtime", "runtime", "runtime.json"]
  ].map(async ([resource_id, resource_kind, file]) => ({
    resource_id: resource_id!,
    resource_kind: resource_kind!,
    status: await exactProcessAlive(path.join(config.state_root, "processes", file!))
      ? "active" as const
      : "terminal" as const
  })));
}

async function exactProcessAlive(file: string): Promise<boolean> {
  const value = await readJson(file).catch((error) => {
    if (hasCode(error, "ENOENT")) return undefined;
    throw error;
  });
  if (!record(value) || !positiveInteger(value.pid) || !canonical(value.instance_token)) {
    return false;
  }
  try {
    process.kill(value.pid, 0);
    const { stdout } = await execFileAsync("ps", [
      "-p", String(value.pid), "-o", "command="
    ], { timeout: 2_000, maxBuffer: 64 * 1024 });
    return String(stdout).includes(value.instance_token);
  } catch {
    return false;
  }
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error &&
    (error as NodeJS.ErrnoException).code === code;
}

function runtimeConfig(value: unknown): value is LiveRuntimeSoakTargetConfig["runtime"] {
  return record(value) && exactKeys(value, ["host", "port", "token_file", "log_file"]) &&
    value.host === "127.0.0.1" && portNumber(value.port) &&
    absoluteStrings(value, ["token_file", "log_file"]);
}

function gatewayConfig(value: unknown): value is LiveRuntimeSoakTargetConfig["gateway"] {
  return record(value) && exactKeys(value, ["source_origin", "sandbox_host", "gate_file"]) &&
    value.source_origin === PUBLIC_BINANCE_ORIGIN &&
    value.sandbox_host === SANDBOX_GATEWAY_HOST &&
    absoluteStrings(value, ["gate_file"]);
}

function providerConfig(value: unknown): value is LiveRuntimeSoakTargetConfig["provider"] {
  return record(value) && exactKeys(value, [
    "kind", "profile", "command", "reasoning_effort", "timeout_ms"
  ]) && value.kind === "codex" && value.profile === "codex" &&
    typeof value.command === "string" && path.isAbsolute(value.command) &&
    value.reasoning_effort === "low" &&
    positiveInteger(value.timeout_ms);
}

function sandboxConfig(value: unknown): value is LiveRuntimeSoakTargetConfig["sandbox"] {
  return record(value) && exactKeys(value, [
    "adapter_kind", "command", ...(value.home === undefined ? [] : ["home"])
  ]) && value.adapter_kind === "docker_sandboxes_sbx" && canonical(value.command) &&
    path.isAbsolute(value.command) &&
    (value.home === undefined || typeof value.home === "string" &&
      path.isAbsolute(value.home));
}

function authorityConfig(value: unknown): value is LiveRuntimeSoakTargetConfig["authority"] {
  return record(value) && exactKeys(value, [
    "evaluation_authority", "promotion_authority", "order_submission_authority",
    "private_exchange_authority", "live_exchange_authority", "authority_status"
  ]) && value.evaluation_authority === false && value.promotion_authority === false &&
    value.order_submission_authority === false && value.private_exchange_authority === false &&
    value.live_exchange_authority === false && value.authority_status === "operational_test_only";
}

function absoluteStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string" && path.isAbsolute(value[key]));
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function portNumber(value: unknown): value is number {
  return positiveInteger(value) && Number(value) >= 1_024 && Number(value) <= 65_535;
}

function boundRunPaths(value: Record<string, unknown>): boolean {
  const runRoot = String(value.run_root);
  const runtime = value.runtime as LiveRuntimeSoakTargetConfig["runtime"];
  const gateway = value.gateway as LiveRuntimeSoakTargetConfig["gateway"];
  return value.store_root === path.join(runRoot, "store") &&
    value.report_root === path.join(runRoot, "report") &&
    value.state_root === path.join(runRoot, "state") &&
    runtime.token_file === path.join(runRoot, "secrets", "operator-token") &&
    runtime.log_file === path.join(runRoot, "logs", "runtime.log") &&
    gateway.gate_file === path.join(runRoot, "state", "gateway-unavailable");
}
