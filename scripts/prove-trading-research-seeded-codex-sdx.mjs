#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
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
  "seed-artifact",
  "selection-root",
  "session-id"
]);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run prove:trading-research:seeded-codex-sdx -- --session-id <id>
       npm run prove:trading-research:seeded-codex-sdx -- --print-only --session-id <id>
       npm run prove:trading-research:seeded-codex-sdx -- --seed-artifact <path> --session-id <id>

Selects the current best Trading AAR artifact, reruns it through Codex replay SDX,
then audits seeded stability evidence.

Proof path:
  local best-artifact selector
  -> Codex managed agent
  -> seeded TradingSystem artifact workspace
  -> Docker Sandboxes sbx/sdx artifact runner
  -> sandbox-local replay TradingApiProvider sidecar
  -> notebook
  -> seeded stability audit

Defaults:
  --agent ${DEFAULT_AGENT}
  --mode ${DEFAULT_MODE}
  --iterations ${DEFAULT_ITERATIONS}
  --artifact-runner ${DEFAULT_ARTIFACT_RUNNER}
  OUROBOROS_SBX_HOME=${DEFAULT_SBX_HOME}
  OUROBOROS_SDX_BIN=${DEFAULT_SDX_BIN}
  OUROBOROS_SBX_COMMAND_TIMEOUT_MS=${DEFAULT_COMMAND_TIMEOUT_MS}

Options:
  --session-id <id>              Session id. Default: generated s15-seeded-codex-sdx timestamp.
  --seed-artifact <path>         Seed artifact. Default: selected by trading-research-best-artifact.
  --selection-root <path>        Root for seed selection. Default: selector default.
  --iterations <number>          Iteration count, minimum 2. Default: ${DEFAULT_ITERATIONS}
  --model <name>                 Passed to trading:research --model.
  --agent-timeout-ms <number>    Passed to trading:research --agent-timeout-ms.
  --program <path>               Passed to trading:research --program.
  --run-root <path>              Passed to trading:research --run-root; audit reads <path>/notebook.json.
  --sbx-home <path>              Sets OUROBOROS_SBX_HOME.
  --sdx-bin <path>               Sets OUROBOROS_SDX_BIN.
  --command-timeout-ms <number>  Sets OUROBOROS_SBX_COMMAND_TIMEOUT_MS.
  --npm-bin <path>               npm executable override for tests/operators.
  --print-only                   Select seed, print commands, and exit without running Codex or SDX.

Exit codes:
  0  run and audit passed, or print-only succeeded
  1  usage or process spawn error
  N  seed selection, underlying run, or audit command exit code
`);
  process.exit(0);
}

const args = parseArgs(process.argv.slice(2));
const sessionId = args["session-id"] ?? defaultSessionId(new Date());
validateSessionId(sessionId);
const iterations = parseIntegerString(args.iterations ?? DEFAULT_ITERATIONS, "--iterations");
if (Number(iterations) < 2) {
  failUsage("--iterations must be at least 2 for the seeded Codex SDX proof command");
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

const seedSelection = await resolveSeedArtifact(args);

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
  sessionId,
  "--artifact",
  seedSelection.seedArtifact
];
appendOptional(runArgs, args, "model", "--model");
appendOptional(runArgs, args, "agent-timeout-ms", "--agent-timeout-ms");
appendOptional(runArgs, args, "program", "--program");
appendOptional(runArgs, args, "run-root", "--run-root");

const auditArgs = [
  "run",
  "audit:trading-research:seeded-stability",
  "--"
];
if (args["run-root"] !== undefined) {
  auditArgs.push("--notebook", path.join(path.resolve(args["run-root"]), "notebook.json"));
} else {
  auditArgs.push("--session-id", sessionId);
}
auditArgs.push("--seed-artifact", seedSelection.seedArtifact);

console.log("S15 Seeded Codex SDX Trading AAR proof");
console.log(`session_id=${sessionId}`);
console.log(`iterations=${iterations}`);
console.log(`seed_artifact=${seedSelection.seedArtifact}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SBX_HOME", env.OUROBOROS_SBX_HOME)}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SDX_BIN", env.OUROBOROS_SDX_BIN)}`);
console.log(`env ${formatEnvAssignment("OUROBOROS_SBX_COMMAND_TIMEOUT_MS", env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS)}`);
console.log(`seed_selector_command=${seedSelection.selectorCommand}`);
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

async function resolveSeedArtifact(parsedArgs) {
  if (parsedArgs["seed-artifact"] !== undefined) {
    const seedArtifact = path.resolve(parsedArgs["seed-artifact"]);
    return {
      seedArtifact,
      selectorCommand: "<explicit seed-artifact>"
    };
  }

  const selectorArgs = ["scripts/trading-research-best-artifact.mjs", "--artifact-only"];
  if (parsedArgs["selection-root"] !== undefined) {
    selectorArgs.push("--root", path.resolve(parsedArgs["selection-root"]));
  }
  const result = await runCommandCapture(process.execPath, selectorArgs, process.env);
  if (result.code !== 0) {
    printCaptured(result);
    console.log(`PROOF_RESULT failed_stage=seed_selection exit_code=${result.code}`);
    process.exit(result.code);
  }
  const seedArtifact = result.stdout.trim();
  if (!seedArtifact) {
    console.log("PROOF_RESULT failed_stage=seed_selection exit_code=1");
    console.error("ERROR seed selection did not print an artifact path");
    process.exit(1);
  }
  return {
    seedArtifact,
    selectorCommand: commandString(process.execPath, selectorArgs)
  };
}

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
  return `s15-seeded-codex-sdx-${date.toISOString().replace(/[^0-9]+/g, "").slice(0, 14)}`;
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

function runCommandCapture(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

function printCaptured(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
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
