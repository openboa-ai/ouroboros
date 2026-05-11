#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));

class BlockedCheck extends Error {}

if (args.help) {
  console.log(`Usage: npm run audit:s5-sbx:promotion
       npm run audit:s5-sbx:promotion -- --host-probes
       npm run audit:s5-sbx:promotion -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>.log

Non-mutating final promotion audit for Slice 5 Docker Sandboxes sbx runtime evidence.
Do not mark OURO-32 Done unless this audit exits 0.

Exit codes:
  0  repo readiness and real two-sandbox completion evidence passed
  1  repo-side audit wiring failed
  2  repo is ready but real host/completion evidence is blocked or incomplete
`);
  process.exit(0);
}

const checks = [];

await check("repo readiness audit", async () => {
  const argv = ["npm", "run", s5ScriptName("audit"), ...(args.hostProbes ? ["--", "--host-probes"] : [])];
  const result = await run(argv, args.hostProbes ? 45_000 : 15_000);
  if (result.code === 0 && !result.timedOut) {
    return;
  }
  const reason = result.timedOut ? "timed out" : `exited ${result.code}`;
  if (result.code === 2) {
    throw new BlockedCheck(`repo readiness host gate blocked: ${reason}`);
  }
  throw new Error(`repo readiness failed: ${reason}`);
});

await check("real two-sandbox completion audit", async () => {
  const argv = ["npm", "run", s5ScriptName("audit:completion")];
  if (args.evidence) {
    argv.push("--", "--evidence", args.evidence);
  }
  const result = await run(argv, 45_000);
  if (result.code === 0 && !result.timedOut) {
    return;
  }
  const reason = result.timedOut ? "timed out" : `exited ${result.code}`;
  if (result.code === 2) {
    throw new BlockedCheck(`real completion evidence incomplete: ${reason}`);
  }
  throw new Error(`completion audit failed: ${reason}`);
});

printSummary();

const failures = checks.filter((entry) => entry.status === "fail");
const blocked = checks.filter((entry) => entry.status === "blocked");
if (failures.length > 0) {
  process.exitCode = 1;
} else if (blocked.length > 0) {
  process.exitCode = 2;
}

async function check(label, fn) {
  try {
    await fn();
    checks.push({ label, status: "pass" });
  } catch (error) {
    checks.push({
      label,
      status: error instanceof BlockedCheck ? "blocked" : "fail",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseArgs(argv) {
  const parsed = { help: false, hostProbes: false, evidence: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--host-probes") {
      parsed.hostProbes = true;
    } else if (arg === "--evidence") {
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
        throw new Error("--evidence requires a path");
      }
      parsed.evidence = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function run(argv, timeoutMs) {
  return new Promise((resolve) => {
    const [file, ...childArgs] = argv;
    const child = spawn(file, childArgs, { cwd: process.cwd(), env: process.env });
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

function printSummary() {
  console.log("S5 sbx promotion audit");
  console.log("objective: mark Slice 5 Docker Sandboxes sbx runtime Done only after real two-sandbox evidence");
  console.log("prompt-to-artifact checklist:");
  console.log("- repo S5 readiness passes");
  console.log("- real Docker Sandboxes sbx two-sandbox completion transcript passes");
  console.log("- Starkit or non-Docker-Sandboxes sdx transcript evidence is not accepted");
  for (const entry of checks) {
    console.log(`${entry.status.toUpperCase()} ${entry.label}`);
    if (entry.detail) {
      console.log(`  ${entry.detail}`);
    }
  }
  console.log(`PROMOTION_AUDIT_RESULT ${
    checks.some((entry) => entry.status === "fail")
      ? "failed"
      : checks.some((entry) => entry.status === "blocked")
        ? "blocked"
        : "ready_to_done"
  }`);
}

function s5ScriptName(kind) {
  const alias = process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN ? "sdx" : "sbx";
  if (kind === "audit") {
    return `audit:s5-${alias}`;
  }
  if (kind === "audit:completion") {
    return `audit:s5-${alias}:completion`;
  }
  throw new Error(`unknown S5 script kind: ${kind}`);
}
