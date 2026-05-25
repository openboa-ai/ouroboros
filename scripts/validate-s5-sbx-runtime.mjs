#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = process.cwd();
const preflightOnly = process.argv.includes("--preflight-only");
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run validate:s5-sbx
       npm run validate:s5-sbx -- --preflight-only

Runs the Slice 5 real Docker Sandboxes validation transcript.
Requires Docker Sandboxes sbx. The macOS /usr/bin/sdx Starkit utility is unrelated and rejected.
Codex note: full validation needs Hypervisor/libkrun access outside the Codex command sandbox;
run the sbx daemon and validation with approved/escalated execution if capability probes fail with
Operation not permitted.

Environment:
  OUROBOROS_SBX_BIN                    sbx binary path (default: sbx)
  OUROBOROS_SDX_BIN                    compatibility alias used only when OUROBOROS_SBX_BIN is unset
  OUROBOROS_SBX_HOME                   optional HOME directory for isolated sbx daemon/auth state
  OUROBOROS_SBX_VALIDATE_NAME_SUFFIX   optional suffix for validation sandbox names
  OUROBOROS_SBX_VALIDATE_PORT          runtime API port (default: 4174)
  OUROBOROS_SBX_VALIDATE_TIMEOUT_MS    per-command timeout in ms (default: 60000)
  OUROBOROS_SBX_EVIDENCE_PATH          optional file path to tee validation transcript

Exit codes:
  0  validation or preflight passed
  1  validation contract, runtime API, or lifecycle assertion failed
  2  host sbx preflight/run-control is blocked
`);
  process.exit(0);
}

const evidencePath = process.env.OUROBOROS_SBX_EVIDENCE_PATH;
if (evidencePath && process.env.OUROBOROS_SBX_EVIDENCE_CHILD !== "1") {
  await runWithEvidenceTranscript(evidencePath);
  process.exit(process.exitCode ?? 0);
}
const sbxPath = process.env.OUROBOROS_SBX_BIN ?? process.env.OUROBOROS_SDX_BIN ?? "sbx";
const sbxHome = process.env.OUROBOROS_SBX_HOME;
const port = Number(process.env.OUROBOROS_SBX_VALIDATE_PORT ?? 4174);
const runtimeUrl = `http://127.0.0.1:${port}`;
const commandTimeoutMs = Number(process.env.OUROBOROS_SBX_VALIDATE_TIMEOUT_MS ?? 60_000);
const sandboxNameSuffix = sandboxNameSuffixFor(process.env.OUROBOROS_SBX_VALIDATE_NAME_SUFFIX);
const sandboxA = validationSandboxName("ouro-s5-clock-a", sandboxNameSuffix);
const sandboxB = validationSandboxName("ouro-s5-clock-b", sandboxNameSuffix);
const instanceA = "sandbox-clock-a";
const instanceB = "sandbox-clock-b";
const artifactId = "fixture-system-code-clock-python-001";
const activeSessionInterruptionApprovalPhrase =
  "승인: active sbx exec app-server 세션 중단 위험을 이해했고, sbx daemon 재시작 및 active session interruption을 허용함";

class HostSbxBlockedError extends Error {
  constructor(message, blocker = "host_preflight_blocked") {
    super(message);
    this.name = "HostSbxBlockedError";
    this.blocker = blocker;
  }
}

let server;
let runtimeStoreRoot;
const failures = [];
const cleanupSandboxNames = new Set();

try {
  section("OURO-32 real Docker Sandboxes sbx validation");
  if (evidencePath) {
    console.log(`evidence transcript: ${evidencePath}`);
  }
  if (sbxHome) {
    console.log(`sbx home: ${sbxHome}`);
  }
  if (sandboxNameSuffix) {
    console.log(`sandbox name suffix: ${sandboxNameSuffix}`);
    console.log(`sandbox A name: ${sandboxA}`);
    console.log(`sandbox B name: ${sandboxB}`);
  }
  await runPreflight();
  if (preflightOnly) {
    console.log("\nRESULT: preflight passed");
  } else {
    runtimeStoreRoot = await mkdtemp(path.join(tmpdir(), "ouroboros-s5-sbx-store-"));
    server = startRuntimeServer();
    await waitForRuntime();

    await verifyRawSecretRejection();

    cleanupSandboxNames.add(sandboxA);
    const startA = await api("POST", "/api/sandboxes", {
      idempotency_key: sandboxA,
      adapter_kind: "docker_sandboxes_sbx",
      system_code_id: artifactId,
      sandbox_id: instanceA,
      sandbox_name: sandboxA,
      trading_run_id: "fixture-trading-run-001",
      interval_ms: 250
    });
    printJson("runtime API start A response", startA);
    printCommandEvidence("runtime API start A command evidence", startA.sandbox.command_evidence);
    assertStartResponseArtifact("runtime API start A", startA, artifactId);
    assertLifecycleRunning("runtime API start A", startA.sandbox);

    cleanupSandboxNames.add(sandboxB);
    const startB = await api("POST", "/api/sandboxes", {
      idempotency_key: sandboxB,
      adapter_kind: "docker_sandboxes_sbx",
      system_code_id: artifactId,
      sandbox_id: instanceB,
      sandbox_name: sandboxB,
      trading_run_id: "fixture-trading-run-001",
      interval_ms: 250
    });
    printJson("runtime API start B response", startB);
    printCommandEvidence("runtime API start B command evidence", startB.sandbox.command_evidence);
    assertStartResponseArtifact("runtime API start B", startB, artifactId);
    assertLifecycleRunning("runtime API start B", startB.sandbox);

    await command("sbx ls", [sbxPath, "ls"]);
    await waitForDirectLogHeartbeat("direct sbx log A", sandboxA, instanceA);
    await waitForDirectLogHeartbeat("direct sbx log B", sandboxB, instanceB);

    const statusA = await waitForRuntimeStatusHeartbeat("runtime API status A", instanceA);
    printJson("runtime API status A", statusA);
    const logsA = await waitForRuntimeLogsHeartbeat("runtime API logs A", instanceA);
    printJson("runtime API logs A", logsA);
    const statusB = await waitForRuntimeStatusHeartbeat("runtime API status B", instanceB);
    printJson("runtime API status B", statusB);
    const logsB = await waitForRuntimeLogsHeartbeat("runtime API logs B", instanceB);
    printJson("runtime API logs B", logsB);

    const stopA = await api("POST", `/api/sandboxes/${instanceA}/stop`);
    printJson("runtime API stop A response", stopA);
    printCommandEvidence("runtime API stop A command evidence", stopA.sandbox.command_evidence);
    assertLifecycleStopped("runtime API stop A", stopA.sandbox);
    const stopB = await api("POST", `/api/sandboxes/${instanceB}/stop`);
    printJson("runtime API stop B response", stopB);
    printCommandEvidence("runtime API stop B command evidence", stopB.sandbox.command_evidence);
    assertLifecycleStopped("runtime API stop B", stopB.sandbox);

    await removeSandbox(sandboxA);
    cleanupSandboxNames.delete(sandboxA);
    await removeSandbox(sandboxB);
    cleanupSandboxNames.delete(sandboxB);
  }

  if (failures.length > 0) {
    throw new Error(`${failures.length} validation step(s) failed`);
  }
  if (!preflightOnly) {
    console.log("\nRESULT: passed");
  }
} catch (error) {
  console.error(`\nRESULT: failed - ${(error instanceof Error ? error.message : String(error))}`);
  if (error instanceof HostSbxBlockedError) {
    printHostSbxBlockedHint(error);
  }
  process.exitCode = error instanceof HostSbxBlockedError ? 2 : 1;
} finally {
  if (!preflightOnly) {
    for (const name of cleanupSandboxNames) {
      await cleanupSandbox(name, true);
    }
  }
  if (server) {
    await stopRuntimeServer(server);
  }
  if (runtimeStoreRoot) {
    await rm(runtimeStoreRoot, { recursive: true, force: true });
  }
}

async function runPreflight() {
  const version = await command("sbx version", [sbxPath, "version"], { hostSbxPreflight: true });
  assertDockerSandboxesSbxVersion(version.stdout);
  await command("sbx diagnose --output json", [sbxPath, "diagnose", "--output", "json"], {
    hostSbxPreflight: true
  });
  await command("sbx daemon status", [sbxPath, "daemon", "status"], { hostSbxPreflight: true });
  await command("sbx ls run-control probe", [sbxPath, "ls"], { hostSbxPreflight: true });
}

function assertDockerSandboxesSbxVersion(stdout) {
  if (!stdout.includes("Client Version:") || !stdout.includes("Server Version:")) {
    throw new Error(
      `${sbxPath} does not look like the Docker Sandboxes sbx CLI; ` +
        "S5 validation requires sbx, not the system sdx/Starkit utility"
    );
  }
}

function startRuntimeServer() {
  section("start runtime API with real sbx adapter enabled");
  const child = spawn("npm", ["run", "start", "--workspace", "@ouroboros/runtime"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      OUROBOROS_STORE_ROOT: runtimeStoreRoot,
      OUROBOROS_ENABLE_SBX_SANDBOX: "1",
      OUROBOROS_SANDBOX_ADAPTER: "docker_sandboxes_sbx",
      OUROBOROS_SBX_WORKSPACE: repoRoot,
      ...(sbxHome ? { OUROBOROS_SBX_HOME: sbxHome } : {}),
      OUROBOROS_SBX_COMMAND_TIMEOUT_MS: String(commandTimeoutMs)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[runtime] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[runtime] ${chunk}`));
  return child;
}

async function stopRuntimeServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  let closed = false;
  const closePromise = new Promise((resolve) => {
    child.once("close", () => {
      closed = true;
      resolve();
    });
  });
  child.kill("SIGTERM");
  await Promise.race([closePromise, delay(5_000)]);
  if (!closed) {
    child.kill("SIGKILL");
    await Promise.race([closePromise, delay(2_000)]);
  }
}

async function waitForRuntime() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${runtimeUrl}/health`, {
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok) {
        console.log(`runtime API ready: ${runtimeUrl}`);
        return;
      }
    } catch {
      await delay(250);
    }
  }
  throw new Error(`runtime API did not become ready at ${runtimeUrl}`);
}

async function api(method, route, payload) {
  section(`${method} ${route}`);
  const hasPayload = payload !== undefined;
  const response = await fetch(`${runtimeUrl}${route}`, {
    method,
    headers: hasPayload ? { "content-type": "application/json" } : undefined,
    body: hasPayload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(commandTimeoutMs * 3 + 5_000)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  printJson(`response ${response.status}`, json);
  if (!response.ok) {
    failures.push(`${method} ${route} -> ${response.status}`);
    throw new Error(`${method} ${route} failed with ${response.status}`);
  }
  return json;
}

async function apiExpectStatus(label, method, route, payload, expectedStatus) {
  section(label);
  console.log(`${method} ${route}`);
  const hasPayload = payload !== undefined;
  const response = await fetch(`${runtimeUrl}${route}`, {
    method,
    headers: hasPayload ? { "content-type": "application/json" } : undefined,
    body: hasPayload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(commandTimeoutMs + 5_000)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  console.log(`response ${response.status}:`);
  console.log(JSON.stringify(json, null, 2));
  if (response.status !== expectedStatus) {
    failures.push(`${label} -> ${response.status}`);
    throw new Error(`${label} expected ${expectedStatus}, got ${response.status}`);
  }
  return json;
}

async function verifyRawSecretRejection() {
  const response = await apiExpectStatus(
    "runtime API raw secret rejection probe",
    "POST",
    "/api/sandboxes",
    {
      ["idempotency_" + "key"]: "ouro-s5-raw-secret-rejection",
      adapter_kind: "docker_sandboxes_sbx",
      system_code_id: artifactId,
      sandbox_id: "sandbox-raw-secret-rejection",
      sandbox_name: "ouro-s5-raw-secret-rejection",
      raw_secret_values: {
        placeholder: "not-a-secret-test-value"
      }
    },
    422
  );
  if (response?.reason !== "raw_secret_material_rejected") {
    failures.push("raw secret rejection probe did not reject raw secret material");
    throw new Error("raw secret rejection probe did not reject raw secret material");
  }
}

function assertStartResponseArtifact(label, outcome, expectedArtifactId) {
  const artifactRef = outcome?.sandbox?.system_code_ref;
  if (artifactRef?.id !== expectedArtifactId) {
    failures.push(`${label} artifact ${artifactRef?.id ?? "missing"}`);
    throw new Error(`${label} did not record system code ${expectedArtifactId}`);
  }
}

function assertLifecycleRunning(label, sandbox) {
  if (sandbox.lifecycle_status !== "running") {
    const createBlocker = sandboxCreateBlocker(sandbox);
    if (createBlocker) {
      throw new HostSbxBlockedError(`${label} host sandbox create blocked: ${createBlocker}`, "runtime_create_failed");
    }
    failures.push(`${label} lifecycle ${sandbox.lifecycle_status}`);
    throw new Error(`${label} did not reach running lifecycle`);
  }
}

function assertLifecycleStopped(label, sandbox) {
  if (sandbox.lifecycle_status !== "stopped") {
    failures.push(`${label} lifecycle ${sandbox.lifecycle_status}`);
    throw new Error(`${label} did not reach stopped lifecycle`);
  }
}

function assertTextContainsHeartbeat(label, text, sandboxId) {
  if (!text.includes("runtime_heartbeat") || !text.includes(sandboxId)) {
    failures.push(`${label} missing runtime heartbeat for ${sandboxId}`);
    throw new Error(`${label} missing runtime heartbeat for ${sandboxId}`);
  }
}

async function waitForDirectLogHeartbeat(label, sandboxName, sandboxId) {
  await retryUntilHeartbeat(label, sandboxId, async () => {
    const result = await command(label, [
      sbxPath,
      "exec",
      sandboxName,
      "cat",
      sandboxLogFile(sandboxId)
    ], { allowFailure: true });
    return `${result.stdout}\n${result.stderr}`;
  });
}

async function waitForRuntimeStatusHeartbeat(label, sandboxId) {
  return await retryUntilHeartbeat(label, sandboxId, async () => {
    const status = await api("GET", `/api/sandboxes/${sandboxId}`);
    const heartbeatLines = (status?.heartbeats ?? []).map((heartbeat) => heartbeat.heartbeat_line);
    return {
      value: status,
      text: heartbeatLines.join("\n")
    };
  });
}

async function waitForRuntimeLogsHeartbeat(label, sandboxId) {
  return await retryUntilHeartbeat(label, sandboxId, async () => {
    const outcome = await api("GET", `/api/sandboxes/${sandboxId}/logs`);
    const lines = [
      ...(outcome?.logs ?? []).flatMap((log) => log.lines ?? []),
      ...(outcome?.heartbeats ?? []).map((heartbeat) => heartbeat.heartbeat_line)
    ];
    return {
      value: outcome,
      text: lines.join("\n")
    };
  });
}

async function retryUntilHeartbeat(label, sandboxId, read) {
  const deadline = Date.now() + commandTimeoutMs;
  let latestText = "";
  while (Date.now() <= deadline) {
    const result = await read();
    const text = typeof result === "string" ? result : result.text;
    latestText = text;
    if (text.includes("runtime_heartbeat") && text.includes(sandboxId)) {
      return typeof result === "string" ? result : result.value;
    }
    await delay(250);
  }
  assertTextContainsHeartbeat(label, latestText, sandboxId);
}

async function command(label, argv, options = {}) {
  section(label);
  console.log(`$ ${argv.join(" ")}`);
  const result = await run(argv, options.timeoutMs ?? commandTimeoutMs, argv[0] === sbxPath ? sbxCommandEnv() : process.env);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.timedOut) {
    const message = `${label} timed out after ${options.timeoutMs ?? commandTimeoutMs}ms`;
    failures.push(`${label} timed out`);
    throw commandError(message, options);
  }
  console.log(`exit_code=${result.code}`);
  if (result.code !== 0 && !options.allowFailure) {
    const message = `${label} exited ${result.code}`;
    failures.push(message);
    throw commandError(message, options);
  }
  return result;
}

function commandError(message, options = {}) {
  return options.hostSbxPreflight ? new HostSbxBlockedError(message) : new Error(message);
}

function printHostSbxBlockedHint(error) {
  section("host sbx preflight block next action");
  const blocker = error?.blocker ?? "host_preflight_blocked";
  if (sbxHome) {
    console.log(`sbx_run_control_blocker=${blocker}`);
    if (blocker === "runtime_create_failed") {
      console.log("isolated_sbx_home_authenticated=true");
      console.log("isolated_sbx_runtime_create_blocked=true");
    } else {
      console.log("isolated_sbx_home_auth_required=true");
      console.log(`isolated_sbx_home_login_command=HOME=${shellQuote(sbxHome)} ${shellQuote(sbxPath)} login`);
    }
    console.log(
      `isolated_sbx_home_recovery_command=${commandWithPrefix(
        envPrefix({ sbxHome, includeRestartGate: true }),
        `npm run ${s5ScriptName("recover")} -- --apply`
      )}`
    );
    console.log(
      `isolated_sbx_home_resume_command=${commandWithPrefix(
        envPrefix({ sbxHome, includeRestartGate: true }),
        `npm run ${s5ScriptName("recover:validate")}`
      )}`
    );
    console.log(
      `isolated_sbx_home_validate_command=${commandWithPrefix(
        envPrefix({ sbxHome }),
        `npm run ${s5ScriptName("validate")}`
      )}`
    );
    return;
  }
  console.log(`sbx_run_control_blocker=${blocker}`);
  console.log("next_action=approved_default_sbx_daemon_recovery_required");
  console.log(`active_session_interruption_approval_phrase=${activeSessionInterruptionApprovalPhrase}`);
  console.log(
    `default_sbx_recovery_command=${commandWithPrefix(
      envPrefix({ includeRestartGate: true, includeActiveSessionInterruptionGate: true }),
      `npm run ${s5ScriptName("recover:validate")}`
    )}`
  );
}

function sandboxCreateBlocker(sandbox) {
  for (const evidence of sandbox?.command_evidence ?? []) {
    const command = (evidence.command ?? []).join(" ");
    if (!command.includes(" create ")) {
      continue;
    }
    if (evidence.exit_code === 0) {
      continue;
    }
    const combinedOutput = `${evidence.stdout ?? ""}\n${evidence.stderr ?? ""}`;
    if (isRuntimeCreateHostFailure(combinedOutput)) {
      return firstRuntimeCreateFailureLine(combinedOutput);
    }
  }
  return undefined;
}

function isRuntimeCreateHostFailure(value) {
  return (
    value.includes("create sandbox") ||
    value.includes("failed to create shim task") ||
    value.includes("krun_start_enter failed") ||
    value.includes("container start")
  );
}

function firstRuntimeCreateFailureLine(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => (
      line.includes("ERROR:") ||
      line.includes("failed to create shim task") ||
      line.includes("krun_start_enter failed")
    )) ?? "sbx create failed";
}

function s5ScriptName(kind) {
  const alias = process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN ? "sdx" : "sbx";
  if (kind === "validate") {
    return `validate:s5-${alias}`;
  }
  if (kind === "recover") {
    return `recover:s5-${alias}-daemon`;
  }
  if (kind === "recover:validate") {
    return `recover:s5-${alias}-daemon:validate`;
  }
  throw new Error(`unknown S5 script kind: ${kind}`);
}

function envPrefix(options = {}) {
  return [
    ...(options.sbxHome ? [`OUROBOROS_SBX_HOME=${shellQuote(options.sbxHome)}`] : []),
    ...sbxBinaryEnvPrefix(),
    ...(options.includeRestartGate ? ["OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1"] : []),
    ...(options.includeActiveSessionInterruptionGate ? ["OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1"] : [])
  ].join(" ");
}

function sbxBinaryEnvPrefix() {
  if (process.env.OUROBOROS_SBX_BIN) {
    return [`OUROBOROS_SBX_BIN=${shellQuote(process.env.OUROBOROS_SBX_BIN)}`];
  }
  if (process.env.OUROBOROS_SDX_BIN) {
    return [`OUROBOROS_SDX_BIN=${shellQuote(process.env.OUROBOROS_SDX_BIN)}`];
  }
  return [];
}

function commandWithPrefix(prefix, command) {
  return prefix ? `${prefix} ${command}` : command;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function cleanupSandbox(name, bestEffort = false) {
  const steps = [
    [`sbx stop ${name}`, [sbxPath, "stop", name]],
    [`sbx rm ${name}`, [sbxPath, "rm", "--force", name]]
  ];
  for (const [label, argv] of steps) {
    try {
      await command(label, argv, { timeoutMs: commandTimeoutMs });
    } catch (error) {
      if (!bestEffort) {
        throw error;
      }
      console.error(`cleanup skipped failure: ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function removeSandbox(name) {
  await command(`sbx rm ${name}`, [sbxPath, "rm", "--force", name], { timeoutMs: commandTimeoutMs });
}

function run(argv, timeoutMs, env = process.env) {
  return new Promise((resolve) => {
    const [file, ...args] = argv;
    const child = spawn(file, args, { cwd: repoRoot, env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGINT");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      finish({ code: 127, stdout, stderr, timedOut });
    });
    child.on("close", (code) => {
      finish({ code, stdout, stderr, timedOut });
    });
  });
}

function sbxCommandEnv() {
  return sbxHome ? { ...process.env, HOME: sbxHome, OUROBOROS_SBX_HOME: sbxHome } : process.env;
}

function printCommandEvidence(label, evidence) {
  section(label);
  for (const item of evidence ?? []) {
    console.log(`$ ${item.command.join(" ")}`);
    if (item.stdout) {
      process.stdout.write(item.stdout);
    }
    if (item.stderr) {
      process.stderr.write(item.stderr);
    }
    console.log(`exit_code=${item.exit_code}`);
  }
}

function printJson(label, value) {
  section(label);
  console.log(JSON.stringify(value, null, 2));
}

function section(label) {
  console.log(`\n## ${label}`);
}

function sandboxLogFile(sandboxId) {
  return `/tmp/ouroboros-${safeRuntimeId(sandboxId)}.jsonl`;
}

function validationSandboxName(baseName, suffix) {
  return suffix ? `${baseName}-${suffix}` : baseName;
}

function sandboxNameSuffixFor(value) {
  if (!value) {
    return "";
  }
  const suffix = value
    .trim()
    .replace(/[^a-zA-Z0-9.+-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!suffix) {
    throw new Error("OUROBOROS_SBX_VALIDATE_NAME_SUFFIX did not contain any valid sandbox name characters");
  }
  return suffix.slice(0, 48);
}

function safeRuntimeId(value) {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 80) || "empty";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithEvidenceTranscript(outputPath) {
  const absoluteOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  const stream = createWriteStream(absoluteOutputPath, { flags: "w" });
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      OUROBOROS_SBX_EVIDENCE_CHILD: "1"
    },
    stdio: ["inherit", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => writeEvidenceChunk(stream, process.stdout, chunk));
  child.stderr.on("data", (chunk) => writeEvidenceChunk(stream, process.stderr, chunk));
  const result = await new Promise((resolve) => {
    child.on("error", (error) => {
      resolve({ code: 1, signal: undefined, error });
    });
    child.on("close", (code, signal) => {
      resolve({ code: code ?? 1, signal, error: undefined });
    });
  });
  await new Promise((resolve) => stream.end(resolve));
  if (result.error) {
    console.error(`validation transcript child failed: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }
  if (result.signal) {
    console.error(`validation transcript child exited with signal ${result.signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = result.code;
}

function writeEvidenceChunk(stream, output, chunk) {
  stream.write(chunk);
  output.write(chunk);
}
