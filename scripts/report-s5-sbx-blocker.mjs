#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage: npm run report:s5-sbx-blocker
       npm run report:s5-sbx-blocker -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log
       npm run report:s5-sbx-blocker -- --report .ouroboros/s5-sbx-evidence/blocker-report-<timestamp>.md
       npm run report:s5-sbx-blocker -- --write-default-report
       OUROBOROS_ALLOW_SBX_CREATE_PROBE=1 npm run report:s5-sbx-blocker -- --include-create-probe

Creates a local, redacted S5 Docker Sandboxes sbx blocker report for
runtime-control/runtime-create blocker evidence.

Default mode is non-mutating. It does not run sbx reset, sbx diagnose --upload, daemon recovery
apply, direct create probes, or any cleanup against existing sandboxes. It records:

- sbx version
- sbx diagnose --output github-issue
- host macOS, architecture, and hypervisor support probes
- Homebrew sbx stable/nightly metadata when brew is available
- sbx create --help and sbx template ls runtime-create context
- sbx ls --json runtime-control probe
- redacted daemon log lines that mention runtime-create VM start failures
- validate:s5-sbx or validate:s5-sdx with a fresh evidence transcript
- completion and promotion audits against that transcript
- recover:s5-sbx-daemon or recover:s5-sdx-daemon dry-run output

The optional --include-create-probe flag is not non-mutating. It runs the separately gated
recover:s5-sbx-daemon --probe-create-path path and requires OUROBOROS_ALLOW_SBX_CREATE_PROBE=1.
That probe may create one uniquely named temporary sandbox and attempts to remove only that
sandbox. The report command refuses --include-create-probe before collecting diagnostics unless
that gate is set.

Exit codes:
  0  report generated and promotion evidence is complete
  1  report generation or repo-side audit failed unexpectedly
  2  report generated and real host/completion evidence is blocked or incomplete

Environment:
  OUROBOROS_SBX_BIN                         sbx binary path (default: sbx)
  OUROBOROS_SDX_BIN                         compatibility alias used only when OUROBOROS_SBX_BIN is unset
  OUROBOROS_SBX_HOME                        optional HOME directory for isolated sbx state
  OUROBOROS_SBX_DAEMON_LOG_PATH             optional daemon log path override for local report evidence
  OUROBOROS_SBX_EVIDENCE_PATH               validation transcript path
  OUROBOROS_SBX_BLOCKER_REPORT_PATH         optional Markdown report output path
  OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS   per-command timeout in ms (default: 30000)
`);
  process.exit(0);
}

if (args.includeCreateProbe && process.env.OUROBOROS_ALLOW_SBX_CREATE_PROBE !== "1") {
  console.error(
    "Refusing --include-create-probe without OUROBOROS_ALLOW_SBX_CREATE_PROBE=1. " +
      "Default report mode is non-mutating; create probes must be explicitly gated."
  );
  process.exit(1);
}

const sbxPath = process.env.OUROBOROS_SBX_BIN ?? process.env.OUROBOROS_SDX_BIN ?? "sbx";
const evidencePath = args.evidence
  ?? process.env.OUROBOROS_SBX_EVIDENCE_PATH
  ?? defaultEvidencePath();
const reportPath = args.report
  ?? process.env.OUROBOROS_SBX_BLOCKER_REPORT_PATH
  ?? (args.writeDefaultReport ? defaultReportPath() : undefined);
const commandTimeoutMs = Number(process.env.OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS ?? 30_000);
const lines = [];

line("# S5 sbx Blocker Report");
line("");
line("objective: produce local evidence for the Docker Sandboxes sbx runtime-control/runtime-create blocker");
line(`evidence_transcript=${evidencePath}`);
if (reportPath) {
  line(`report_path=${reportPath}`);
}
if (process.env.OUROBOROS_SBX_HOME) {
  line(`sbx_home=${process.env.OUROBOROS_SBX_HOME}`);
}
line(`non_mutating=${args.includeCreateProbe ? "false" : "true"}`);
line(`temporary_create_probe=${args.includeCreateProbe ? "requested" : "not_requested"}`);
line("uploads_diagnostics=false");
line("");

const version = await capture("sbx version", [sbxPath, "version"], {
  allowFailure: true,
  env: sbxCommandEnv()
});
if (!isDockerSandboxesSbxVersion(version.stdout)) {
  line("## Result");
  line("S5_SBX_BLOCKER_REPORT_RESULT failed");
  line("");

  const output = `${lines.join("\n")}\n`;
  process.stdout.write(output);

  if (reportPath) {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, output, "utf8");
    console.log(`report_written=${reportPath}`);
  }

  console.error(
    `${sbxPath} does not look like the Docker Sandboxes sbx CLI; ` +
      "S5 blocker reporting requires sbx, not the system sdx/Starkit utility."
  );
  process.exit(1);
}

const diagnose = await capture("sbx diagnose github issue", [sbxPath, "diagnose", "--output", "github-issue"], {
  allowFailure: true,
  env: sbxCommandEnv()
});
const macosVersion = await capture("host macOS version", ["sw_vers"], {
  allowFailure: true
});
const hostArchitecture = await capture("host architecture", ["uname", "-m"], {
  allowFailure: true
});
const hypervisorSupport = await capture("host hypervisor support", ["sysctl", "kern.hv_support"], {
  allowFailure: true
});
const brewInfo = await capture("brew sbx stable metadata", ["brew", "info", "docker/tap/sbx"], {
  allowFailure: true,
  env: brewCommandEnv()
});
const brewOutdated = await capture("brew sbx stable outdated check", ["brew", "outdated", "--greedy", "--cask", "sbx"], {
  allowFailure: true,
  env: brewCommandEnv()
});
const brewNightly = await capture("brew sbx nightly metadata", ["brew", "info", "docker/tap/sbx@nightly"], {
  allowFailure: true,
  env: brewCommandEnv()
});
const createHelp = await capture("sbx create help runtime-create context", [sbxPath, "create", "--help"], {
  allowFailure: true,
  env: sbxCommandEnv()
});
const templateList = await capture("sbx template list runtime-create context", [sbxPath, "template", "ls"], {
  allowFailure: true,
  env: sbxCommandEnv()
});
const listJson = await capture("sbx ls json runtime-control probe", [sbxPath, "ls", "--json"], {
  allowFailure: true,
  env: sbxCommandEnv()
});
const daemonLogHints = await captureDaemonLogRuntimeCreateHints();
const validationScript = s5ScriptName("validate");
const completionAuditScript = s5ScriptName("audit:completion");
const promotionAuditScript = s5ScriptName("audit:promotion");
const recoveryScript = s5ScriptName("recover");
const validation = await capture(`npm run ${validationScript}`, ["npm", "run", validationScript], {
  allowFailure: true,
  timeoutMs: Math.max(commandTimeoutMs, 45_000),
  env: {
    ...process.env,
    OUROBOROS_SBX_EVIDENCE_PATH: evidencePath
  }
});
const completion = await capture(
  `npm run ${completionAuditScript}`,
  ["npm", "run", completionAuditScript, "--", "--evidence", evidencePath],
  { allowFailure: true }
);
const promotion = await capture(
  `npm run ${promotionAuditScript}`,
  ["npm", "run", promotionAuditScript, "--", "--evidence", evidencePath],
  { allowFailure: true }
);
const recovery = await capture(`npm run ${recoveryScript}`, ["npm", "run", recoveryScript], {
  allowFailure: true
});
const directCreateProbe = args.includeCreateProbe
  ? await capture(
      `npm run ${recoveryScript} direct create-path probe`,
      ["npm", "run", recoveryScript, "--", "--probe-create-path"],
      {
        allowFailure: true,
        env: {
          ...process.env,
          OUROBOROS_ALLOW_SBX_CREATE_PROBE: process.env.OUROBOROS_ALLOW_SBX_CREATE_PROBE ?? ""
        }
      }
    )
  : undefined;

const result = classify({
  version,
  diagnose,
  macosVersion,
  hostArchitecture,
  hypervisorSupport,
  brewInfo,
  brewOutdated,
  brewNightly,
  createHelp,
  templateList,
  listJson,
  daemonLogHints,
  validation,
  completion,
  promotion,
  recovery,
  directCreateProbe
});
line("## Result");
line(`S5_SBX_BLOCKER_REPORT_RESULT ${result}`);
line("");

const output = `${lines.join("\n")}\n`;
process.stdout.write(output);

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, output, "utf8");
  console.log(`report_written=${reportPath}`);
}

process.exitCode = result === "failed" ? 1 : result === "blocked" ? 2 : 0;

async function capture(label, argv, options = {}) {
  line(`## ${label}`);
  line("");
  line(`$ ${argv.join(" ")}`);
  const result = await run(argv, options.timeoutMs ?? commandTimeoutMs, options.env ?? process.env);
  if (result.stdout) {
    line("");
    line("stdout:");
    fence(result.stdout);
  }
  if (result.stderr) {
    line("");
    line("stderr:");
    fence(result.stderr);
  }
  line(`exit_code=${result.code}`);
  if (result.timedOut) {
    line(`timed_out=true timeout_ms=${options.timeoutMs ?? commandTimeoutMs}`);
  }
  line("");
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`${label} exited ${result.code}`);
  }
  return result;
}

async function captureDaemonLogRuntimeCreateHints() {
  const label = "daemon log runtime-create failure hints";
  line(`## ${label}`);
  line("");
  const logPath = daemonLogPath();
  line(`daemon_log_path=${redactLocalPath(logPath)}`);
  try {
    const content = await readFile(logPath, "utf8");
    const hints = content
      .split(/\r?\n/)
      .filter((entry) => (
        entry.includes("krun_start_enter failed") ||
        entry.includes("failed to create shim task") ||
        entry.includes("/start returned error") ||
        entry.includes("\"status\":500")
      ))
      .slice(-20)
      .map(redactLocalPath)
      .join("\n");
    if (hints) {
      line("");
      line("stdout:");
      fence(hints);
    } else {
      line("daemon_log_runtime_create_hints=none");
    }
    line("exit_code=0");
    line("");
    return { code: 0, stdout: hints, stderr: "", timedOut: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    line("stderr:");
    fence(message);
    line("exit_code=1");
    line("");
    return { code: 1, stdout: "", stderr: message, timedOut: false };
  }
}

function daemonLogPath() {
  if (process.env.OUROBOROS_SBX_DAEMON_LOG_PATH) {
    return process.env.OUROBOROS_SBX_DAEMON_LOG_PATH;
  }
  return path.join(
    process.env.OUROBOROS_SBX_HOME ?? process.env.HOME ?? "",
    "Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/daemon.log"
  );
}

function redactLocalPath(value) {
  let redacted = String(value);
  const daemonLogDir = process.env.OUROBOROS_SBX_DAEMON_LOG_PATH
    ? path.dirname(process.env.OUROBOROS_SBX_DAEMON_LOG_PATH)
    : undefined;
  for (const rawPath of [daemonLogDir, process.env.OUROBOROS_SBX_HOME, process.env.HOME, process.cwd()]) {
    if (rawPath) {
      redacted = redacted.replaceAll(rawPath, "<local-path>");
    }
  }
  return redacted;
}

function classify({
  version,
  diagnose,
  macosVersion,
  hostArchitecture,
  hypervisorSupport,
  brewInfo,
  brewOutdated,
  brewNightly,
  createHelp,
  templateList,
  listJson,
  daemonLogHints,
  validation,
  completion,
  promotion,
  recovery,
  directCreateProbe
}) {
  if (promotion.code === 0 && !promotion.timedOut) {
    return "complete";
  }

  const combinedOutput = [
    version,
    diagnose,
    macosVersion,
    hostArchitecture,
    hypervisorSupport,
    brewInfo,
    brewOutdated,
    brewNightly,
    createHelp,
    templateList,
    listJson,
    daemonLogHints,
    validation,
    completion,
    promotion,
    recovery,
    directCreateProbe
  ]
    .filter(Boolean)
    .map((result) => `${result.stdout}\n${result.stderr}`)
    .join("\n");
  if (
    validation.code === 2 ||
    completion.code === 2 ||
    promotion.code === 2 ||
    combinedOutput.includes("context canceled") ||
    combinedOutput.includes("runtime_create_failed") ||
    combinedOutput.includes("failed to create shim task") ||
    combinedOutput.includes("krun_start_enter failed") ||
    combinedOutput.includes("Not authenticated to Docker") ||
    combinedOutput.includes("not authenticated to Docker") ||
    combinedOutput.includes("not signed in")
  ) {
    return "blocked";
  }

  return "failed";
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
  throw new Error(`unknown S5 script kind: ${kind}`);
}

function run(argv, timeoutMs, env) {
  return new Promise((resolve) => {
    const [file, ...childArgs] = argv;
    const child = spawn(file, childArgs, { cwd: process.cwd(), env });
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

function sbxCommandEnv() {
  return process.env.OUROBOROS_SBX_HOME
    ? { ...process.env, HOME: process.env.OUROBOROS_SBX_HOME }
    : process.env;
}

function brewCommandEnv() {
  return { ...process.env, HOMEBREW_NO_AUTO_UPDATE: "1" };
}

function isDockerSandboxesSbxVersion(stdout) {
  return stdout.includes("Client Version:") && stdout.includes("Server Version:");
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    evidence: undefined,
    report: undefined,
    includeCreateProbe: false,
    writeDefaultReport: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--include-create-probe") {
      parsed.includeCreateProbe = true;
    } else if (arg === "--write-default-report") {
      parsed.writeDefaultReport = true;
    } else if (arg === "--evidence") {
      parsed.evidence = requireValue(argv, index, "--evidence");
      index += 1;
    } else if (arg === "--report") {
      parsed.report = requireValue(argv, index, "--report");
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function defaultEvidencePath() {
  return path.join(
    process.cwd(),
    ".ouroboros/s5-sbx-evidence",
    `validate-${safeFileTimestamp(new Date().toISOString())}-blocked.log`
  );
}

function defaultReportPath() {
  return path.join(
    process.cwd(),
    ".ouroboros/s5-sbx-evidence",
    `blocker-report-${safeFileTimestamp(new Date().toISOString())}.md`
  );
}

function safeFileTimestamp(value) {
  return value.replace(/[^0-9A-Za-z_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function line(value) {
  lines.push(value);
}

function fence(value) {
  line("~~~");
  line(value.trimEnd());
  line("~~~");
}
