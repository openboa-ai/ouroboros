#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const apply = process.argv.includes("--apply");
const probeCreatePath = process.argv.includes("--probe-create-path")
  || process.env.OUROBOROS_PROBE_S5_SBX_CREATE_PATH === "1";
const validateAfterApply = process.argv.includes("--validate-after-apply")
  || process.env.OUROBOROS_VALIDATE_S5_SBX_AFTER_RECOVERY === "1";
const allowRestart = process.env.OUROBOROS_ALLOW_SBX_DAEMON_RESTART === "1";
const allowActiveSessionInterruption = process.env.OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION === "1";
const allowCreateProbe = process.env.OUROBOROS_ALLOW_SBX_CREATE_PROBE === "1";
const activeSessionInterruptionApprovalPhrase =
  "승인: active sbx exec app-server 세션 중단 위험을 이해했고, sbx daemon 재시작 및 active session interruption을 허용함";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run recover:s5-sbx-daemon
       OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 npm run recover:s5-sbx-daemon -- --apply
       OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 npm run recover:s5-sbx-daemon -- --apply --validate-after-apply
       OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 npm run recover:s5-sbx-daemon:validate
       OUROBOROS_ALLOW_SBX_CREATE_PROBE=1 npm run recover:s5-sbx-daemon -- --probe-create-path

Dry-run by default. The apply mode restarts the Docker Sandboxes daemon and can interrupt active
sbx sessions. It is gated by OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1, and active sbx exec sessions
require OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1.
Requires Docker Sandboxes sbx. The macOS /usr/bin/sdx Starkit utility is unrelated and rejected.
Human approval phrase for default-daemon active-session interruption:
${activeSessionInterruptionApprovalPhrase}

The optional --probe-create-path mode attempts one uniquely named temporary sandbox create/exec/rm
cycle without restarting the daemon. It is disabled by default because it may create temporary
sandbox state, and requires OUROBOROS_ALLOW_SBX_CREATE_PROBE=1.

Environment:
  OUROBOROS_SBX_BIN                    sbx binary path (default: sbx)
  OUROBOROS_SDX_BIN                    compatibility alias used only when OUROBOROS_SBX_BIN is unset
  OUROBOROS_SBX_HOME                   optional HOME directory for isolated sbx daemon/auth state
  OUROBOROS_SBX_RECOVERY_TIMEOUT_MS    per-command timeout in ms (default: 10000)
  OUROBOROS_SBX_RUNTIME_STATE_DIR      runtime metadata directory for path/log/socket probes
  OUROBOROS_SBX_EVIDENCE_PATH          validation transcript path for --validate-after-apply
  OUROBOROS_ALLOW_SBX_CREATE_PROBE     allow --probe-create-path temporary sandbox creation (1 to enable)
  OUROBOROS_PROBE_S5_SBX_CREATE_PATH   run --probe-create-path via environment (1 to enable)
  OUROBOROS_SBX_POST_RECOVERY_VALIDATE_TIMEOUT_MS
                                        post-recovery validation timeout in ms (default: 300000)
  OUROBOROS_SBX_POST_RECOVERY_COMPLETION_AUDIT_TIMEOUT_MS
                                        post-recovery completion audit timeout in ms (default: 30000)
  OUROBOROS_SBX_POST_RECOVERY_PROMOTION_AUDIT_TIMEOUT_MS
                                        post-recovery promotion audit timeout in ms (default: 30000)
  OUROBOROS_VALIDATE_S5_SBX_AFTER_RECOVERY
                                        run validation, completion audit, and promotion audit after successful apply (1 to enable)

Dry-run session/metadata/log/socket probes are redacted and non-mutating. They summarize active
sbx exec/app-server session counts, runtime paths, daemon log hints, stuck container inspect calls,
and Docker-compatible socket status without printing raw process command lines, metadata, or
credentials.
This helper intentionally does not run sbx reset; reset deletes broad sandbox state, policies,
and stored secrets, and requires a separate explicit approval path.
It also does not copy Docker Sandboxes auth stores or secretpass files between HOME directories;
isolated HOME auth must be established with sbx login.
When OUROBOROS_SBX_HOME is set, dry-run restart and validation commands preserve that same
OUROBOROS_SBX_HOME prefix so they do not accidentally target the default daemon.
`);
  process.exit(0);
}

if (probeCreatePath && apply) {
  console.error("--probe-create-path cannot be combined with --apply.");
  process.exit(8);
}

if (probeCreatePath && !allowCreateProbe) {
  console.error(
    "Refusing to run sbx direct create-path probe without OUROBOROS_ALLOW_SBX_CREATE_PROBE=1."
  );
  process.exit(8);
}

const sbxPath = process.env.OUROBOROS_SBX_BIN ?? process.env.OUROBOROS_SDX_BIN ?? "sbx";
const sbxHome = process.env.OUROBOROS_SBX_HOME;
const commandTimeoutMs = Number(process.env.OUROBOROS_SBX_RECOVERY_TIMEOUT_MS ?? 10_000);
const runtimeStateDir = process.env.OUROBOROS_SBX_RUNTIME_STATE_DIR
  ?? defaultRuntimeStateDir();

section("S5 sbx daemon recovery preflight");
if (sbxHome) {
  console.log(`sbx_home=${sbxHome}`);
}
const versionResult = await command("sbx version", [sbxPath, "version"], { allowFailure: true });
if (!isDockerSandboxesSbxVersion(versionResult.stdout)) {
  console.error(
    `${sbxPath} does not look like the Docker Sandboxes sbx CLI; ` +
      "S5 recovery requires sbx, not the system sdx/Starkit utility."
  );
  process.exit(4);
}
await command("sbx daemon status", [sbxPath, "daemon", "status"], { allowFailure: true });
await command("sbx diagnose --output json", [sbxPath, "diagnose", "--output", "json"], { allowFailure: true });
const activeProcessResult = await command("active sbx processes", ["pgrep", "-fl", "sbx"], {
  allowFailure: true,
  redactOutput: true
});
const activeSessionSummary = summarizeActiveSbxProcesses(activeProcessResult.stdout, { isolatedHome: Boolean(sbxHome) });
const activeSessionInterruptionGateRequired = activeSessionSummary.activeSessionInterruptionGateRequired;
const runtimes = await inspectRuntimeMetadata();
await inspectDaemonLog(runtimes.map((runtime) => runtime.name));
await inspectDockerSocketRuntimeState(runtimes);
const runtimeControlProbeResult = await command("sbx ls runtime-control probe", [sbxPath, "ls"], {
  allowFailure: true
});
printRuntimeControlBlockerHint(runtimeControlProbeResult);
if (probeCreatePath) {
  const createProbePassed = await directCreatePathProbe();
  if (!createProbePassed) {
    process.exit(9);
  }
}

if (!apply) {
  section("dry run");
  console.log("No changes made.");
  console.log("To restart the daemon explicitly:");
  if (activeSessionInterruptionGateRequired) {
    console.log(`active_session_interruption_approval_phrase=${activeSessionInterruptionApprovalPhrase}`);
    console.log(
      `  ${recoveryEnvPrefix({ includeActiveSessionInterruptionGate: true })} ` +
        `npm run ${s5ScriptName("recover")} -- --apply`
    );
    console.log(
      `  ${recoveryEnvPrefix({ includeActiveSessionInterruptionGate: true })} ` +
        `npm run ${s5ScriptName("recover:validate")}`
    );
  } else {
    console.log(
      `  ${recoveryEnvPrefix()} npm run ${s5ScriptName("recover")} -- --apply`
    );
    console.log(
      `  ${recoveryEnvPrefix()} npm run ${s5ScriptName("recover:validate")}`
    );
  }
  process.exit(0);
}

if (!allowRestart) {
  console.error("Refusing to restart sbx daemon without OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1.");
  process.exit(2);
}

if (activeSessionInterruptionGateRequired && !allowActiveSessionInterruption) {
  console.error(
    "Refusing to restart sbx daemon while active sbx exec sessions are present without " +
      "OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1."
  );
  console.error(`active_session_interruption_approval_phrase=${activeSessionInterruptionApprovalPhrase}`);
  console.error(`active_sbx_exec_sessions=${activeSessionSummary.activeSbxExecSessionCount}`);
  console.error(`active_sbx_app_server_sessions=${activeSessionSummary.activeSbxAppServerSessionCount}`);
  process.exit(3);
}

section("restart sbx daemon");
await command("sbx daemon stop", [sbxPath, "daemon", "stop"]);
await command("sbx daemon start --detach", [sbxPath, "daemon", "start", "--detach"]);
await command("sbx daemon status", [sbxPath, "daemon", "status"]);
const postRestartListResult = await command("sbx ls", [sbxPath, "ls"], { allowFailure: true });
if (postRestartListResult.code !== 0 || postRestartListResult.timedOut) {
  printRuntimeControlBlockerHint(postRestartListResult);
  console.error("sbx daemon restart completed, but runtime listing is still failing.");
  process.exit(5);
}

section("next validation");
if (validateAfterApply) {
  const evidencePath = process.env.OUROBOROS_SBX_EVIDENCE_PATH ?? defaultEvidencePath();
  const validationScript = s5ScriptName("validate");
  const completionAuditScript = s5ScriptName("audit:completion");
  const promotionAuditScript = s5ScriptName("audit:promotion");
  console.log(`validation evidence transcript: ${evidencePath}`);
  const validationResult = await command(`npm run ${validationScript}`, ["npm", "run", validationScript], {
    timeoutMs: Number(process.env.OUROBOROS_SBX_POST_RECOVERY_VALIDATE_TIMEOUT_MS ?? 300_000),
    allowFailure: true,
    env: {
      ...process.env,
      OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
      ...(sbxHome ? { OUROBOROS_SBX_HOME: sbxHome } : {})
    }
  });
  const validationFailed = validationResult.code !== 0 || validationResult.timedOut;
  if (validationFailed) {
    console.error("post-recovery S5 validation failed; running completion and promotion audits against the transcript.");
  } else {
    console.log("post-recovery S5 validation passed.");
  }
  const completionAuditResult = await command(
    `npm run ${completionAuditScript}`,
    ["npm", "run", completionAuditScript, "--", "--evidence", evidencePath],
    {
      timeoutMs: Number(process.env.OUROBOROS_SBX_POST_RECOVERY_COMPLETION_AUDIT_TIMEOUT_MS ?? 30_000),
      allowFailure: true,
      env: {
        ...process.env,
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        ...(sbxHome ? { OUROBOROS_SBX_HOME: sbxHome } : {})
      }
    }
  );
  const completionAuditFailed = completionAuditResult.code !== 0 || completionAuditResult.timedOut;
  if (completionAuditFailed) {
    console.error("post-recovery S5 completion audit failed.");
  } else {
    console.log("post-recovery S5 completion audit passed.");
  }
  const promotionAuditResult = await command(
    `npm run ${promotionAuditScript}`,
    ["npm", "run", promotionAuditScript, "--", "--evidence", evidencePath],
    {
      timeoutMs: Number(process.env.OUROBOROS_SBX_POST_RECOVERY_PROMOTION_AUDIT_TIMEOUT_MS ?? 30_000),
      allowFailure: true,
      env: {
        ...process.env,
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        ...(sbxHome ? { OUROBOROS_SBX_HOME: sbxHome } : {})
      }
    }
  );
  const promotionAuditFailed = promotionAuditResult.code !== 0 || promotionAuditResult.timedOut;
  if (promotionAuditFailed) {
    console.error("post-recovery S5 promotion audit failed.");
  } else {
    console.log("post-recovery S5 promotion audit passed.");
  }
  if (validationFailed) {
    process.exit(6);
  }
  if (completionAuditFailed) {
    process.exit(7);
  }
  if (promotionAuditFailed) {
    process.exit(8);
  }
} else {
  console.log(`Run \`npm run ${s5ScriptName("validate")}\` to prove the OURO-32 two-sandbox lifecycle.`);
  console.log("Or rerun recovery with `--validate-after-apply` to run it automatically after restart.");
}

function section(label) {
  console.log(`\n## ${label}`);
}

async function command(label, argv, options = {}) {
  section(label);
  console.log(`$ ${argv.join(" ")}`);
  const result = await run(
    argv,
    options.timeoutMs ?? commandTimeoutMs,
    options.env ?? (argv[0] === sbxPath ? sbxCommandEnv() : process.env)
  );
  if (options.redactOutput) {
    console.log("command_output=redacted");
  } else {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }
  if (result.timedOut) {
    console.log(`timeout_ms=${options.timeoutMs ?? commandTimeoutMs}`);
  }
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`${label} exited ${result.code}`);
  }
  if (result.code !== 0) {
    console.log(`exit_code=${result.code}`);
  }
  return result;
}

function defaultRuntimeStateDir() {
  return path.join(
    sbxHome ?? homedir(),
    "Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/runtimes"
  );
}

function sbxCommandEnv() {
  return sbxHome ? { ...process.env, HOME: sbxHome, OUROBOROS_SBX_HOME: sbxHome } : process.env;
}

function printRuntimeControlBlockerHint(result) {
  if (result.code === 0 && !result.timedOut) {
    return;
  }
  const combinedOutput = `${result.stdout}\n${result.stderr}`;
  if (isAuthFailure(combinedOutput)) {
    console.log("sbx_runtime_control_blocker=authentication");
    if (sbxHome) {
      console.log("isolated_sbx_home_auth_required=true");
      console.log(`isolated_sbx_home_login_command=HOME=${shellQuote(sbxHome)} ${shellQuote(sbxPath)} login`);
      console.log(
        `isolated_sbx_home_recovery_command=${commandWithPrefix(
          recoveryEnvPrefix(),
          `npm run ${s5ScriptName("recover")} -- --apply`
        )}`
      );
      console.log(
        `isolated_sbx_home_resume_command=${commandWithPrefix(
          recoveryEnvPrefix(),
          `npm run ${s5ScriptName("recover:validate")}`
        )}`
      );
      console.log(
        `isolated_sbx_home_validate_command=${commandWithPrefix(
          validationEnvPrefix(),
          `npm run ${s5ScriptName("validate")}`
        )}`
      );
    }
    return;
  }
  if (combinedOutput.includes("context canceled")) {
    console.log("sbx_runtime_control_blocker=context_canceled");
    if (!sbxHome) {
      console.log("next_action=approved_default_sbx_daemon_recovery_required");
    }
  }
}

function isAuthFailure(value) {
  return (
    value.includes("Not authenticated to Docker") ||
    value.includes("not authenticated to Docker") ||
    value.includes("not signed in") ||
    value.includes("no default account profile set") ||
    value.includes("no valid user session found")
  );
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function recoveryEnvPrefix(options = {}) {
  return [
    ...(sbxHome ? [`OUROBOROS_SBX_HOME=${shellQuote(sbxHome)}`] : []),
    ...sbxBinaryEnvPrefix(),
    "OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1",
    ...(options.includeActiveSessionInterruptionGate
      ? ["OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1"]
      : [])
  ].join(" ");
}

function validationEnvPrefix() {
  return [
    ...(sbxHome ? [`OUROBOROS_SBX_HOME=${shellQuote(sbxHome)}`] : []),
    ...sbxBinaryEnvPrefix()
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

function s5ScriptName(kind) {
  const alias = process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN ? "sdx" : "sbx";
  if (kind === "validate") {
    return `validate:s5-${alias}`;
  }
  if (kind === "audit:completion") {
    return `audit:s5-${alias}:completion`;
  }
  if (kind === "audit:promotion") {
    return `audit:s5-${alias}:promotion`;
  }
  if (kind === "recover") {
    return `recover:s5-${alias}-daemon`;
  }
  if (kind === "recover:validate") {
    return `recover:s5-${alias}-daemon:validate`;
  }
  throw new Error(`unknown S5 script kind: ${kind}`);
}

async function directCreatePathProbe() {
  section("sbx direct create-path probe");
  const sandboxName = `ouro-s5-direct-probe-${Date.now()}`;
  console.log(`sandbox=${sandboxName}`);
  console.log("direct_create_probe_scope=temporary_unique_sandbox_only");

  const createResult = await command(
    "sbx create direct probe",
    [sbxPath, "create", "--name", sandboxName, "shell", process.cwd()],
    { allowFailure: true }
  );
  if (createResult.code !== 0 || createResult.timedOut) {
    console.log("direct_create_probe_result=blocked");
    return false;
  }

  const execResult = await command(
    "sbx exec direct probe",
    [sbxPath, "exec", sandboxName, "sh", "-lc", "echo s5-direct-create-probe-ok"],
    { allowFailure: true }
  );
  const rmResult = await command(
    "sbx rm direct probe",
    [sbxPath, "rm", "--force", sandboxName],
    { allowFailure: true }
  );
  const passed = execResult.code === 0 && !execResult.timedOut && rmResult.code === 0 && !rmResult.timedOut;
  console.log(`direct_create_probe_result=${passed ? "passed" : "blocked"}`);
  return passed;
}

function run(argv, timeoutMs, env) {
  return new Promise((resolve) => {
    const [file, ...args] = argv;
    const child = spawn(file, args, { cwd: process.cwd(), env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
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
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: stderr + `${error.message}\n`, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function isDockerSandboxesSbxVersion(stdout) {
  return stdout.includes("Client Version:") && stdout.includes("Server Version:");
}

function summarizeActiveSbxProcesses(processList, options = {}) {
  section("active sbx session summary");
  const activeSbxExecSessions = activeSbxExecSessionLines(processList);
  const activeSbxAppServerSessions = activeSbxExecSessions.filter((line) => /\bapp-server\b/.test(line));
  const activeSbxExecSessionNames = uniqueNames(activeSbxExecSessions.map(sbxExecSandboxName).filter(Boolean));
  const activeSbxAppServerSessionNames = uniqueNames(activeSbxAppServerSessions.map(sbxExecSandboxName).filter(Boolean));
  const activeSessionInterruptionGateRequired = !options.isolatedHome && activeSbxExecSessions.length > 0;
  console.log(`active_sbx_exec_sessions=${activeSbxExecSessions.length}`);
  console.log(`active_sbx_app_server_sessions=${activeSbxAppServerSessions.length}`);
  console.log(`active_sbx_exec_session_names=${formatNameList(activeSbxExecSessionNames)}`);
  console.log(`active_sbx_app_server_session_names=${formatNameList(activeSbxAppServerSessionNames)}`);
  console.log(`active_session_interruption_gate_required=${activeSessionInterruptionGateRequired ? "true" : "false"}`);
  if (options.isolatedHome) {
    console.log("active_session_interruption_gate_scope=skipped_for_isolated_sbx_home");
  }
  return {
    activeSbxExecSessionCount: activeSbxExecSessions.length,
    activeSbxAppServerSessionCount: activeSbxAppServerSessions.length,
    activeSessionInterruptionGateRequired
  };
}

function activeSbxExecSessionLines(processList) {
  return processList.split("\n").filter((line) => /\bsbx exec\b/.test(line));
}

function sbxExecSandboxName(processLine) {
  const marker = "sbx exec";
  const markerIndex = processLine.indexOf(marker);
  if (markerIndex === -1) {
    return undefined;
  }
  const tokens = processLine.slice(markerIndex + marker.length).trim().split(/\s+/).filter(Boolean);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("-")) {
      return safeProcessToken(token);
    }
    if (token === "-w" || token === "--workdir" || token === "--workspace") {
      index += 1;
    }
  }
  return undefined;
}

function uniqueNames(values) {
  return [...new Set(values)];
}

function formatNameList(values) {
  return values.length > 0 ? values.join(",") : "none";
}

function safeProcessToken(value) {
  return value.replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 120);
}

async function inspectRuntimeMetadata() {
  section("runtime metadata path check");
  let entries;
  try {
    entries = await readdir(runtimeStateDir, { withFileTypes: true });
  } catch (error) {
    console.log(`runtime_state_dir=${runtimeStateDir}`);
    console.log(`metadata_status=unreadable code=${error?.code ?? "unknown"}`);
    return [];
  }

  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) {
    console.log(`runtime_state_dir=${runtimeStateDir}`);
    console.log("metadata_status=no_runtime_metadata");
    return [];
  }

  const runtimes = [];
  for (const file of files) {
    const runtime = await inspectRuntimeMetadataFile(path.join(runtimeStateDir, file));
    if (runtime) {
      runtimes.push(runtime);
    }
  }
  return runtimes;
}

async function inspectRuntimeMetadataFile(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.log(`metadata_file=${path.basename(filePath)}`);
    console.log(`metadata_status=unreadable_json code=${error?.code ?? "parse_error"}`);
    return undefined;
  }

  const runtimeName = stringValue(parsed?.Spec?.RuntimeName)
    ?? stringValue(parsed?.State?.NetworkName)
    ?? path.basename(filePath, ".json");
  const socketPath = stringValue(parsed?.State?.SocketPath);
  console.log(`runtime=${runtimeName}`);
  await printPathStatus("workspace", parsed?.Spec?.WorkspaceDir);
  for (const [index, workspace] of arrayValue(parsed?.Spec?.AdditionalWorkspaces).entries()) {
    await printPathStatus(`additional_workspace_${index + 1}`, workspace?.dir);
  }
  if (stringValue(parsed?.State?.NetworkName)) {
    console.log(`network=${parsed.State.NetworkName}`);
  }
  if (socketPath) {
    console.log(`socket_path=${socketPath}`);
  }
  return { name: runtimeName, socketPath };
}

async function printPathStatus(label, value) {
  const targetPath = stringValue(value);
  if (!targetPath) {
    console.log(`${label}=missing_metadata`);
    return;
  }
  try {
    await access(targetPath, fsConstants.F_OK);
    console.log(`${label}=present path=${targetPath}`);
  } catch {
    console.log(`${label}=missing path=${targetPath}`);
  }
}

function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

async function inspectDaemonLog(runtimeNames) {
  section("daemon log runtime-control hints");
  const daemonLogPath = path.join(path.dirname(runtimeStateDir), "daemon.log");
  if (runtimeNames.length === 0) {
    console.log("daemon_log_status=skipped_no_runtime_metadata");
    return;
  }

  let content;
  try {
    content = await readFile(daemonLogPath, "utf8");
  } catch (error) {
    console.log(`daemon_log=${daemonLogPath}`);
    console.log(`daemon_log_status=unreadable code=${error?.code ?? "unknown"}`);
    return;
  }

  console.log(`daemon_log=${daemonLogPath}`);
  const runtimeSet = new Set(runtimeNames);
  const summaries = new Map(runtimeNames.map((runtimeName) => [runtimeName, {
    sdkClientFailureCount: 0,
    lastSdkClientFailureAt: undefined,
    mountPolicyDeniedCount: 0,
    lastMountPolicyDeniedAt: undefined,
    inspectStarts: new Set(),
    inspectStartTimes: new Map(),
    inspectEnds: new Set(),
    stopStarts: new Set(),
    stopStartTimes: new Map(),
    stopEnds: new Set()
  }]));

  for (const line of content.split("\n")) {
    if (!runtimeNames.some((runtimeName) => line.includes(runtimeName))) {
      continue;
    }

    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const runtimeName = runtimeNameForLogEntry(entry, runtimeSet);
    if (!runtimeName) {
      continue;
    }

    const summary = summaries.get(runtimeName);
    if (!summary) {
      continue;
    }

    if (entry.msg === "failed to create SDK client for runtime") {
      summary.sdkClientFailureCount += 1;
      summary.lastSdkClientFailureAt = entry.time;
    }
    if (entry.msg === "runtime denied by mount policy") {
      summary.mountPolicyDeniedCount += 1;
      summary.lastMountPolicyDeniedAt = entry.time;
    }
    if (entry.source === "containerd" && typeof entry.path === "string") {
      const requestId = stringValue(String(entry.request_id ?? ""));
      if (!requestId) {
        continue;
      }

      if (entry.path.endsWith(`/containers/${runtimeName}/json`)) {
        if (entry.msg === "API request start") {
          summary.inspectStarts.add(requestId);
          if (stringValue(entry.time)) {
            summary.inspectStartTimes.set(requestId, entry.time);
          }
        }
        if (entry.msg === "API request end") {
          summary.inspectEnds.add(requestId);
        }
      }

      if (entry.path.endsWith(`/${runtimeName}/stop`)) {
        if (entry.msg === "API request start") {
          summary.stopStarts.add(requestId);
          if (stringValue(entry.time)) {
            summary.stopStartTimes.set(requestId, entry.time);
          }
        }
        if (entry.msg === "API request end") {
          summary.stopEnds.add(requestId);
        }
      }
    }
  }

  for (const runtimeName of runtimeNames) {
    const summary = summaries.get(runtimeName);
    if (!summary) {
      continue;
    }
    const hangingInspectRequests = hangingRequestIds(summary.inspectStarts, summary.inspectEnds, summary.inspectStartTimes);
    const hangingStopRequests = hangingRequestIds(summary.stopStarts, summary.stopEnds, summary.stopStartTimes);
    console.log(`runtime=${runtimeName}`);
    console.log(`sdk_client_health_check_failures=${summary.sdkClientFailureCount}`);
    if (summary.lastSdkClientFailureAt) {
      console.log(`last_sdk_client_health_check_failure_at=${summary.lastSdkClientFailureAt}`);
    }
    console.log(`mount_policy_denials=${summary.mountPolicyDeniedCount}`);
    if (summary.lastMountPolicyDeniedAt) {
      console.log(`last_mount_policy_denial_at=${summary.lastMountPolicyDeniedAt}`);
    }
    console.log(`container_inspect_requests_without_end=${hangingInspectRequests.length}`);
    if (hangingInspectRequests.length > 0) {
      console.log(`container_inspect_request_ids_without_end=${formatRequestIdList(hangingInspectRequests)}`);
      printRequestTimeBounds("container_inspect_requests_without_end", hangingInspectRequests, summary.inspectStartTimes);
    }
    console.log(`container_stop_requests_without_end=${hangingStopRequests.length}`);
    if (hangingStopRequests.length > 0) {
      console.log(`container_stop_request_ids_without_end=${formatRequestIdList(hangingStopRequests)}`);
      printRequestTimeBounds("container_stop_requests_without_end", hangingStopRequests, summary.stopStartTimes);
    }
  }
}

function hangingRequestIds(startSet, endSet, startTimes) {
  return [...startSet]
    .filter((requestId) => !endSet.has(requestId))
    .sort((left, right) => {
      const leftTime = startTimes.get(left) ?? "";
      const rightTime = startTimes.get(right) ?? "";
      return leftTime.localeCompare(rightTime) || left.localeCompare(right);
    });
}

function printRequestTimeBounds(label, requestIds, startTimes) {
  const firstStartedAt = startTimes.get(requestIds[0]);
  const lastStartedAt = startTimes.get(requestIds[requestIds.length - 1]);
  if (firstStartedAt) {
    console.log(`first_${label}_started_at=${firstStartedAt}`);
  }
  if (lastStartedAt) {
    console.log(`last_${label}_started_at=${lastStartedAt}`);
  }
}

function formatRequestIdList(requestIds) {
  const maxIdsToPrint = 20;
  const visibleIds = requestIds.slice(0, maxIdsToPrint).join(",");
  if (requestIds.length <= maxIdsToPrint) {
    return visibleIds;
  }
  return `${visibleIds},... total=${requestIds.length}`;
}

function runtimeNameForLogEntry(entry, runtimeSet) {
  const runtimeName = stringValue(entry?.runtime);
  if (runtimeName && runtimeSet.has(runtimeName)) {
    return runtimeName;
  }

  const pathValue = stringValue(entry?.path);
  if (!pathValue) {
    return undefined;
  }

  for (const runtime of runtimeSet) {
    if (pathValue.includes(`/containers/${runtime}/`)) {
      return runtime;
    }
  }
  return undefined;
}

async function inspectDockerSocketRuntimeState(runtimes) {
  section("docker socket runtime-control probe");
  const runtimesWithSocket = runtimes.filter((runtime) => runtime.socketPath);
  if (runtimesWithSocket.length === 0) {
    console.log("docker_socket_status=skipped_no_socket_metadata");
    return;
  }

  for (const runtime of runtimesWithSocket) {
    console.log(`runtime=${runtime.name}`);
    console.log(`docker_socket=${runtime.socketPath}`);
    const env = {
      ...process.env,
      DOCKER_HOST: `unix://${runtime.socketPath}`,
      DOCKER_API_VERSION: "1.53"
    };
    const serverResult = await run(
      ["docker", "version", "--format", "{{json .Server}}"],
      Math.min(commandTimeoutMs, 3_000),
      env
    );
    printProbeResult("docker_server_version", serverResult);
    if (serverResult.code !== 0 || serverResult.timedOut) {
      continue;
    }

    const listResult = await run(
      ["docker", "container", "ls", "--all", "--format", "{{json .}}"],
      Math.min(commandTimeoutMs, 3_000),
      env
    );
    printProbeResult("docker_container_list", listResult);

    const inspectResult = await run(
      ["docker", "inspect", runtime.name, "--format", "{{json .State}}"],
      Math.min(commandTimeoutMs, 3_000),
      env
    );
    printProbeResult("docker_runtime_inspect", inspectResult);
    if (inspectResult.code === 0 && !inspectResult.timedOut) {
      printDockerStateSummary(inspectResult.stdout);
    }
  }
}

function printProbeResult(label, result) {
  if (result.timedOut) {
    console.log(`${label}=timed_out`);
    return;
  }
  if (result.code === 0) {
    console.log(`${label}=ok`);
    return;
  }
  console.log(`${label}=failed code=${result.code}`);
  const firstErrorLine = firstNonEmptyLine(result.stderr);
  if (firstErrorLine) {
    console.log(`${label}_error=${redactDiagnosticLine(firstErrorLine)}`);
  }
}

function printDockerStateSummary(stdout) {
  let state;
  try {
    state = JSON.parse(stdout);
  } catch {
    console.log("docker_runtime_state=parse_error");
    return;
  }

  console.log(`docker_runtime_status=${state?.Status ?? "unknown"}`);
  console.log(`docker_runtime_running=${String(Boolean(state?.Running))}`);
  console.log(`docker_runtime_paused=${String(Boolean(state?.Paused))}`);
  console.log(`docker_runtime_restarting=${String(Boolean(state?.Restarting))}`);
  console.log(`docker_runtime_dead=${String(Boolean(state?.Dead))}`);
}

function firstNonEmptyLine(value) {
  return value.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
}

function redactDiagnosticLine(value) {
  return value.replace(/[A-Za-z0-9+/=]{80,}/g, "[redacted-long-token]");
}

function defaultEvidencePath() {
  return path.join(
    process.cwd(),
    ".ouroboros/s5-sbx-evidence",
    `validate-${safeFileTimestamp(new Date().toISOString())}.log`
  );
}

function safeFileTimestamp(value) {
  return value.replace(/[^0-9A-Za-z_-]+/g, "-").replace(/^-+|-+$/g, "");
}
