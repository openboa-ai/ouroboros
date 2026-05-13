#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const DEFAULT_ITERATIONS = "2";
const DEFAULT_SBX_HOME = "/private/tmp/ouro-s5-sdx-home";
const DEFAULT_SDX_BIN = "./scripts/sdx-docker-sandboxes";
const DEFAULT_COMMAND_TIMEOUT_MS = "120000";
const DEFAULT_AGENT = "codex";
const DEFAULT_MODE = "replay";
const DEFAULT_ARTIFACT_RUNNER = "sdx";

const knownArgs = new Set([
  "agent-timeout-ms",
  "artifact",
  "command-timeout-ms",
  "help",
  "iterations",
  "model",
  "npm-bin",
  "print-only",
  "program",
  "run-root",
  "sbx-home",
  "sdx-bin",
  "session-id"
]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run prove:trading-research:codex-sdx -- --session-id <id>
       npm run prove:trading-research:codex-sdx -- --print-only --session-id <id>

Runs the Codex-first Trading AAR proof path, then audits the produced notebook.

Proof path:
  Codex managed agent
  -> TradingSystem artifact workspace
  -> Docker Sandboxes sbx/sdx artifact runner
  -> sandbox-local replay TradingApiProvider sidecar
  -> notebook
  -> S10 completion audit

Defaults:
  --agent codex
  --mode replay
  --iterations ${DEFAULT_ITERATIONS}
  --artifact-runner ${DEFAULT_ARTIFACT_RUNNER}
  OUROBOROS_SBX_HOME=${DEFAULT_SBX_HOME}
  OUROBOROS_SDX_BIN=${DEFAULT_SDX_BIN}
  OUROBOROS_SBX_COMMAND_TIMEOUT_MS=${DEFAULT_COMMAND_TIMEOUT_MS}

Options:
  --session-id <id>              Session id. Default: generated s11-codex-sdx timestamp.
  --iterations <number>          Iteration count, minimum 2. Default: ${DEFAULT_ITERATIONS}
  --model <name>                 Passed to trading:research --model.
  --agent-timeout-ms <number>    Passed to trading:research --agent-timeout-ms.
  --artifact <path>              Passed to trading:research --artifact.
  --program <path>               Passed to trading:research --program.
  --run-root <path>              Passed to trading:research --run-root.
  --sbx-home <path>              Sets OUROBOROS_SBX_HOME.
  --sdx-bin <path>               Sets OUROBOROS_SDX_BIN.
  --command-timeout-ms <number>  Sets OUROBOROS_SBX_COMMAND_TIMEOUT_MS.
  --npm-bin <path>               npm executable override for tests/operators.
  --print-only                   Print commands and exit without running Codex or SDX.

Exit codes:
  0  run and audit passed, or print-only succeeded
  1  usage error or process spawn error
  N  underlying run or audit command exit code
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const sessionId = args["session-id"] ?? defaultSessionId(new Date());
validateSessionId(sessionId);
const iterations = parseIntegerString(args.iterations ?? DEFAULT_ITERATIONS, "--iterations");
if (Number(iterations) < 2) {
  failUsage("--iterations must be at least 2 for the Codex SDX proof command");
}
const commandTimeoutMs = parseIntegerString(
  args["command-timeout-ms"] ?? process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS ?? DEFAULT_COMMAND_TIMEOUT_MS,
  "--command-timeout-ms"
);
if (args["agent-timeout-ms"] !== undefined) {
  parseIntegerString(args["agent-timeout-ms"], "--agent-timeout-ms");
}

const npmBin = args["npm-bin"] ?? process.env.OUROBOROS_NPM_BIN ?? "npm";
const env = {
  ...process.env,
  OUROBOROS_SBX_HOME: args["sbx-home"] ?? process.env.OUROBOROS_SBX_HOME ?? DEFAULT_SBX_HOME,
  OUROBOROS_SDX_BIN: args["sdx-bin"] ?? process.env.OUROBOROS_SDX_BIN ?? DEFAULT_SDX_BIN,
  OUROBOROS_SBX_COMMAND_TIMEOUT_MS: commandTimeoutMs
};

const runArgs = [
  "run",
  "trading:research",
  "--",
  "--agent",
  DEFAULT_AGENT,
  "--mode",
  DEFAULT_MODE,
  "--iterations",
  iterations,
  "--artifact-runner",
  DEFAULT_ARTIFACT_RUNNER,
  "--session-id",
  sessionId
];
appendOptional(runArgs, args, "model", "--model");
appendOptional(runArgs, args, "agent-timeout-ms", "--agent-timeout-ms");
appendOptional(runArgs, args, "artifact", "--artifact");
appendOptional(runArgs, args, "program", "--program");
appendOptional(runArgs, args, "run-root", "--run-root");

const auditArgs = [
  "run",
  "audit:s10-trading-research",
  "--",
  "--session-id",
  sessionId
];

console.log("S11 Codex SDX Trading AAR proof");
console.log(`session_id=${sessionId}`);
console.log(`iterations=${iterations}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SBX_HOME", env.OUROBOROS_SBX_HOME)}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SDX_BIN", env.OUROBOROS_SDX_BIN)}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SBX_COMMAND_TIMEOUT_MS", env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS)}`);
console.log(`run_command=${commandString(npmBin, runArgs)}`);
console.log(`audit_command=${commandString(npmBin, auditArgs)}`);
console.log("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");

if (args["print-only"] === "true") {
  console.log("PRINT_ONLY true");
  console.log("PROOF_RESULT print_only");
  process.exit(0);
}

const runResult = await runCommand(npmBin, runArgs, env);
if (runResult !== 0) {
  console.log(`PROOF_RESULT failed_stage=run exit_code=${runResult}`);
  process.exit(runResult);
}

const auditResult = await runCommand(npmBin, auditArgs, env);
if (auditResult !== 0) {
  console.log(`PROOF_RESULT failed_stage=audit exit_code=${auditResult}`);
  process.exit(auditResult);
}

console.log("PROOF_RESULT passed");

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      failUsage(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!knownArgs.has(key)) {
      failUsage(`unknown option: --${key}`);
    }
    if (key === "print-only") {
      parsed[key] = "true";
      continue;
    }
    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      failUsage(`missing value for --${key}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function appendOptional(targetArgs, parsedArgs, key, flag) {
  const value = parsedArgs[key];
  if (value !== undefined) {
    targetArgs.push(flag, value);
  }
}

function parseIntegerString(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    failUsage(`${label} must be a positive integer`);
  }
  return String(parsed);
}

function validateSessionId(sessionId) {
  if (!sessionId || sessionId.includes("/") || sessionId.includes("\\") || sessionId.includes("..")) {
    failUsage("--session-id must be a simple path-safe id");
  }
}

function defaultSessionId(date) {
  return `s11-codex-sdx-${date.toISOString().replace(/[^0-9]+/g, "").slice(0, 14)}`;
}

function runCommand(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
    child.on("error", (error) => {
      console.error(`ERROR failed to start ${command}: ${error.message}`);
      resolve(1);
    });
  });
}

function commandString(command, args) {
  return [command, ...args].map(shellQuote).join(" ");
}

function formatEnvAssignment(key, value) {
  return `${key}=${shellQuote(value)}`;
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@-]+$/.test(text)) {
    return text;
  }
  return `'${text.replaceAll("'", "'\\''")}'`;
}

function failUsage(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}
