#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const hostProbes = process.argv.includes("--host-probes");
const timeoutMs = Number(process.env.OUROBOROS_S9_CODEX_SBX_AUDIT_TIMEOUT_MS ?? 30_000);
const codexTimeoutMs = Number(process.env.OUROBOROS_CODEX_TIMEOUT_MS ?? 10_000);

class BlockedCheck extends Error {}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run audit:s9-codex-sbx
       npm run audit:s9-codex-sbx -- --host-probes
       npm run audit:s9-codex-sdx -- --host-probes

Audits Slice 9 Codex research provider dry-run readiness for Docker Sandboxes sbx/sdx.

Default mode is fixture-only and non-mutating: it checks repo files, S9 scripts, and S5 sbx/sdx
guardrails. Host probe mode additionally distinguishes:
- host-local Codex CLI availability with codex --version
- fixture-only Codex research dry-run/evaluation proof in repo tests and scripts
- real sbx/sdx preflight through the existing S5 non-mutating preflight harness

Evidence boundary:
- sandbox ids, host paths, provider outputs, and command transcripts are command evidence only
- they are not product truth, counted evidence, promotion authority, venue authority, or order authority

Environment:
  OUROBOROS_CODEX_BIN                       Codex binary path (default: codex)
  OUROBOROS_CODEX_TIMEOUT_MS                Codex audit timeout in ms (default: 10000)
  OUROBOROS_SBX_BIN                         Docker Sandboxes sbx binary path
  OUROBOROS_SDX_BIN                         compatibility alias when OUROBOROS_SBX_BIN is unset
  OUROBOROS_SBX_HOME                        optional isolated sbx HOME
  OUROBOROS_S9_CODEX_SBX_AUDIT_TIMEOUT_MS   host command timeout in ms (default: 30000)

Exit codes:
  0  repo readiness passed and host probes, when requested, did not find an sbx/sdx blocker
  1  repo readiness or Codex audit contract failed
  2  repo readiness passed, but real sbx/sdx preflight is blocked
`);
  process.exit(0);
}

const checks = [];

await check("required S9 Codex research files exist", async () => {
  await assertFilesExist([
    "packages/application/src/research/orchestration/codex-improvement-proposal-dry-run.ts",
    "packages/application/src/research/orchestration/codex-improvement-proposal-dry-run-audit.ts",
    "packages/application/src/research/orchestration/codex-improvement-proposal-evaluation-dry-run.ts",
    "packages/application/src/research/orchestration/run-codex-improvement-proposal.ts",
    "packages/application/src/research/orchestration/run-codex-improvement-proposal-audit.ts",
    "packages/adapters/src/codex/improvement-proposal-provider.ts",
    "apps/runtime/test/codex-improvement-proposal-dry-run-audit.test.ts",
    "apps/runtime/test/codex-improvement-proposal-evaluation-dry-run.test.ts",
    "scripts/validate-s5-sbx-runtime.mjs",
    "scripts/sdx-docker-sandboxes"
  ]);
});

await check("npm S9 Codex sbx scripts are registered", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assertValue(packageJson.scripts?.["research:proposal:codex"], "missing research:proposal:codex");
  assertValue(packageJson.scripts?.["research:proposal:codex:audit"], "missing research:proposal:codex:audit");
  assertValue(packageJson.scripts?.["audit:s9-codex-sbx"], "missing audit:s9-codex-sbx");
  assertValue(packageJson.scripts?.["audit:s9-codex-sdx"], "missing audit:s9-codex-sdx");
  assertValue(packageJson.scripts?.["audit:s9-codex-sdx-local"], "missing audit:s9-codex-sdx-local");
  assertIncludes(packageJson.scripts?.["audit:s9-codex-sdx"], "OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-sdx}");
  assertIncludes(packageJson.scripts?.["audit:s9-codex-sdx-local"], "OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes}");
});

await check("S5 sbx/sdx preflight guardrails remain registered", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assertValue(packageJson.scripts?.["validate:s5-sbx:preflight"], "missing validate:s5-sbx:preflight");
  assertValue(packageJson.scripts?.["validate:s5-sdx:preflight"], "missing validate:s5-sdx:preflight");
  const help = await run([process.execPath, "scripts/validate-s5-sbx-runtime.mjs", "--help"], 10_000);
  assertExitZero(help, "S5 validation help failed");
  assertIncludes(help.stdout, "Requires Docker Sandboxes sbx");
  assertIncludes(help.stdout, "/usr/bin/sdx Starkit utility is unrelated");
  assertIncludes(help.stdout, "host sbx preflight/run-control is blocked");
});

await check("fixture-only Codex research evaluation proof is registered", async () => {
  const testFile = await readFile("apps/runtime/test/codex-improvement-proposal-evaluation-dry-run.test.ts", "utf8");
  assertIncludes(testFile, "continues a Codex-shaped proposal through sandbox and sealed generic trading evaluation");
  assertIncludes(testFile, "evidence_disposition: \"not_counted\"");
  assertIncludes(testFile, "authority_status: \"not_counted\"");
});

if (hostProbes) {
  await check("host-local Codex probe is observable", async () => {
    const result = await run([process.env.OUROBOROS_CODEX_BIN ?? "codex", "--version"], timeoutMs);
    assertExitZero(result, "codex --version failed");
    assertIncludes(result.stdout, "codex");
  });

  await check("S9 Codex research audit command produces structured provider outcome", async () => {
    const storeRoot = await mkdtemp(path.join(tmpdir(), "ouroboros-s9-codex-sbx-audit-"));
    try {
      const result = await run([
        "npm",
        "run",
        "research:proposal:codex:audit",
        "--",
        "--store-root",
        storeRoot,
        "--idempotency-key",
        "s9-codex-sbx-host-probe",
        "--created-at",
        "2026-05-12T04:00:00.000Z",
        "--codex-timeout-ms",
        String(codexTimeoutMs),
        "--expect-status",
        "any"
      ], timeoutMs + codexTimeoutMs + 5_000);
      assertExitZero(result, "S9 Codex research audit command failed");
      const parsed = parseJsonObject(result.stdout, "S9 Codex research audit output");
      assertValue(parsed.probe?.readiness_status, "missing provider probe readiness_status");
      assertValue(parsed.dry_run?.status, "missing dry_run status");
      assertIncludes(["materialized", "failed"], parsed.dry_run.status);
      assertValue(parsed.delta, "missing store delta");
    } finally {
      await rm(storeRoot, { recursive: true, force: true });
    }
  });

  await check("real sbx/sdx preflight passes or reports precise host blocker", async () => {
    const scriptName = s5PreflightScriptName();
    const result = await run(["npm", "run", scriptName], timeoutMs);
    if (result.code === 0 && !result.timedOut) {
      assertIncludes(result.stdout, "OURO-32 real Docker Sandboxes sbx validation");
      assertIncludes(result.stdout, "sbx version");
      return;
    }
    const combined = `${result.stdout}\n${result.stderr}`;
    if (
      result.code === 2 ||
      combined.includes("host sbx preflight/run-control is blocked") ||
      combined.includes("Operation not permitted") ||
      combined.includes("Not authenticated") ||
      combined.includes("run-control")
    ) {
      throw new BlockedCheck(`real sbx/sdx preflight blocked via npm run ${scriptName}`);
    }
    throw new Error(`real sbx/sdx preflight failed with code ${String(result.code)}`);
  });
}

let hasFailure = false;
for (const item of checks) {
  if (item.status === "failed") {
    hasFailure = true;
  }
}

console.log("S9 Codex sbx readiness audit");
for (const item of checks) {
  console.log(`${item.status.toUpperCase()} ${item.label}${item.detail ? ` - ${item.detail}` : ""}`);
}
console.log("EVIDENCE_BOUNDARY command_transcript_only");
console.log("NO_AUTHORITY live_exchange=false order_authority=false counted_evidence=false promotion=false");
if (!hostProbes) {
  console.log("REAL_ENVIRONMENT_PROOF_REQUIRED npm run audit:s9-codex-sdx -- --host-probes");
}

if (checks.some((item) => item.blocked)) {
  console.log("BLOCKED real sbx/sdx preflight");
  process.exitCode = 2;
} else if (hasFailure) {
  process.exitCode = 1;
}

async function check(label, fn) {
  try {
    await fn();
    checks.push({ label, status: "pass" });
  } catch (error) {
    checks.push({
      label,
      status: error instanceof BlockedCheck ? "blocked" : "failed",
      blocked: error instanceof BlockedCheck,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function assertFilesExist(files) {
  await Promise.all(files.map((file) => access(file)));
}

function assertValue(value, message) {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }
}

function assertIncludes(value, expected) {
  if (Array.isArray(value)) {
    if (!value.includes(expected)) {
      throw new Error(`expected ${JSON.stringify(value)} to include ${expected}`);
    }
    return;
  }
  if (!String(value ?? "").includes(expected)) {
    throw new Error(`expected output to include: ${expected}`);
  }
}

function assertExitZero(result, message) {
  if (result.code !== 0 || result.timedOut) {
    throw new Error(`${message}: code=${String(result.code)} timedOut=${String(result.timedOut)}`);
  }
}

function parseJsonObject(stdout, label) {
  const jsonStart = stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`${label} did not include JSON`);
  }
  return JSON.parse(stdout.slice(jsonStart));
}

function s5PreflightScriptName() {
  return process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN
    ? "validate:s5-sdx:preflight"
    : "validate:s5-sbx:preflight";
}

function run(args, timeout) {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, timeout);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}`, timedOut: false });
    });
  });
}
