#!/usr/bin/env node
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";

const hostProbes = process.argv.includes("--host-probes");

class BlockedCheck extends Error {}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: npm run audit:s5-sbx
       npm run audit:s5-sbx -- --host-probes

Audits repo-side Slice 5 sbx readiness without mutating sandbox state.

Default mode checks required files, npm scripts, and help guardrails. Host probe mode also runs
non-mutating sbx preflight/recovery dry-run commands and reports whether the real environment is
blocked before the two-sandbox validation transcript.

Exit codes:
  0  repo readiness checks passed and no host blocker was detected
  1  repo readiness failed
  2  repo readiness passed, but host sbx preflight/runtime-control is blocked
`);
  process.exit(0);
}

const checks = [];

await check("required S5 artifact/runtime files exist", async () => {
  await assertFilesExist([
    "packages/domain/src/index.ts",
    "packages/domain/src/opaque-runnable-artifact-records.test.ts",
    "fixtures/trader-systems/clock.py",
    "apps/runtime/src/runtime-instances/sandbox-runtime-adapter.ts",
    "apps/runtime/test/clock-artifact.test.ts",
    "apps/runtime/test/runtime-instances.test.ts",
    "apps/runtime/test/sbx-runtime-adapter.test.ts",
    "apps/runtime/test/s5-sbx-validation-script.test.ts",
    "scripts/audit-s5-sbx-completion.mjs",
    "scripts/audit-s5-sbx-promotion.mjs",
    "scripts/audit-s5-sbx-readiness.mjs",
    "scripts/report-s5-sbx-blocker.mjs",
    "scripts/validate-s5-sbx-runtime.mjs",
    "scripts/recover-s5-sbx-daemon.mjs",
    "scripts/sdx-docker-sandboxes"
  ]);
});

await check("npm S5 sbx scripts are registered", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assertValue(packageJson.scripts?.["validate:s5-sbx"], "missing validate:s5-sbx");
  assertValue(packageJson.scripts?.["validate:s5-sbx:preflight"], "missing validate:s5-sbx:preflight");
  assertValue(packageJson.scripts?.["validate:s5-sdx"], "missing validate:s5-sdx");
  assertValue(packageJson.scripts?.["validate:s5-sdx:preflight"], "missing validate:s5-sdx:preflight");
  assertValue(packageJson.scripts?.["audit:s5-sbx"], "missing audit:s5-sbx");
  assertValue(packageJson.scripts?.["audit:s5-sbx:completion"], "missing audit:s5-sbx:completion");
  assertValue(packageJson.scripts?.["audit:s5-sbx:promotion"], "missing audit:s5-sbx:promotion");
  assertValue(packageJson.scripts?.["audit:s5-sdx"], "missing audit:s5-sdx");
  assertValue(packageJson.scripts?.["audit:s5-sdx:completion"], "missing audit:s5-sdx:completion");
  assertValue(packageJson.scripts?.["audit:s5-sdx:promotion"], "missing audit:s5-sdx:promotion");
  assertValue(packageJson.scripts?.["report:s5-sbx-blocker"], "missing report:s5-sbx-blocker");
  assertValue(packageJson.scripts?.["report:s5-sdx-blocker"], "missing report:s5-sdx-blocker");
  assertValue(packageJson.scripts?.["login:s5-sbx-isolated"], "missing login:s5-sbx-isolated");
  assertValue(packageJson.scripts?.["login:s5-sdx-isolated"], "missing login:s5-sdx-isolated");
  assertValue(packageJson.scripts?.["resume:s5-sbx-isolated"], "missing resume:s5-sbx-isolated");
  assertValue(packageJson.scripts?.["resume:s5-sdx-isolated"], "missing resume:s5-sdx-isolated");
  assertValue(packageJson.scripts?.["login:s5-sdx-local"], "missing login:s5-sdx-local");
  assertValue(packageJson.scripts?.["resume:s5-sdx-local"], "missing resume:s5-sdx-local");
  assertValue(packageJson.scripts?.["validate:s5-sdx-local:preflight"], "missing validate:s5-sdx-local:preflight");
  assertValue(packageJson.scripts?.["validate:s5-sdx-local"], "missing validate:s5-sdx-local");
  assertValue(packageJson.scripts?.["report:s5-sdx-local-blocker"], "missing report:s5-sdx-local-blocker");
  assertValue(packageJson.scripts?.["audit:s5-sdx-local:promotion"], "missing audit:s5-sdx-local:promotion");
  assertValue(packageJson.scripts?.["recover:s5-sbx-daemon"], "missing recover:s5-sbx-daemon");
  assertValue(packageJson.scripts?.["recover:s5-sbx-daemon:validate"], "missing recover:s5-sbx-daemon:validate");
  assertValue(packageJson.scripts?.["recover:s5-sdx-daemon"], "missing recover:s5-sdx-daemon");
  assertValue(packageJson.scripts?.["recover:s5-sdx-daemon:validate"], "missing recover:s5-sdx-daemon:validate");
  for (const scriptName of [
    "validate:s5-sdx",
    "validate:s5-sdx:preflight",
    "audit:s5-sdx",
    "audit:s5-sdx:completion",
    "audit:s5-sdx:promotion",
    "report:s5-sdx-blocker",
    "recover:s5-sdx-daemon",
    "recover:s5-sdx-daemon:validate"
  ]) {
    assertIncludes(packageJson.scripts?.[scriptName], "OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-sdx}");
  }
  assertIncludes(
    packageJson.scripts?.["login:s5-sdx-isolated"],
    "${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes} login"
  );
  assertIncludes(
    packageJson.scripts?.["resume:s5-sdx-isolated"],
    "OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes}"
  );
  assertIncludes(packageJson.scripts?.["resume:s5-sdx-isolated"], "npm run recover:s5-sdx-daemon:validate");
  for (const scriptName of [
    "login:s5-sdx-local",
    "resume:s5-sdx-local",
    "validate:s5-sdx-local:preflight",
    "validate:s5-sdx-local",
    "report:s5-sdx-local-blocker",
    "audit:s5-sdx-local:promotion"
  ]) {
    assertIncludes(packageJson.scripts?.[scriptName], "OUROBOROS_SBX_HOME=${OUROBOROS_SBX_HOME:-/private/tmp/ouro-s5-sdx-home}");
    assertIncludes(packageJson.scripts?.[scriptName], "OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes}");
  }
});

await check("validation help advertises sbx/sdx/evidence guardrails", async () => {
  const result = await run([process.execPath, "scripts/validate-s5-sbx-runtime.mjs", "--help"], 10_000);
  assertExitZero(result, "validate help failed");
  assertIncludes(result.stdout, "Requires Docker Sandboxes sbx");
  assertIncludes(result.stdout, "/usr/bin/sdx Starkit utility is unrelated");
  assertIncludes(result.stdout, "OUROBOROS_SDX_BIN");
  assertIncludes(result.stdout, "OUROBOROS_SBX_EVIDENCE_PATH");
  assertIncludes(result.stdout, "OUROBOROS_SBX_HOME");
  assertIncludes(result.stdout, "OUROBOROS_SBX_VALIDATE_NAME_SUFFIX");
  assertIncludes(result.stdout, "Hypervisor/libkrun access outside the Codex command sandbox");
  assertIncludes(result.stdout, "Operation not permitted");
});

await check("recovery help advertises approval and reset boundaries", async () => {
  const result = await run([process.execPath, "scripts/recover-s5-sbx-daemon.mjs", "--help"], 10_000);
  assertExitZero(result, "recover help failed");
  assertIncludes(result.stdout, "OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1");
  assertIncludes(result.stdout, "sbx exec/app-server session counts");
  assertIncludes(result.stdout, "without printing raw process command lines");
  assertIncludes(result.stdout, "stuck container inspect calls");
  assertIncludes(result.stdout, "OUROBOROS_SBX_HOME");
  assertIncludes(result.stdout, "OUROBOROS_SDX_BIN");
  assertIncludes(result.stdout, "OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
  assertIncludes(result.stdout, "Human approval phrase for default-daemon active-session interruption");
  assertIncludes(result.stdout, "does not run sbx reset");
  assertIncludes(result.stdout, "stored secrets");
  assertIncludes(result.stdout, "does not copy Docker Sandboxes auth stores or secretpass files");
  assertIncludes(result.stdout, "dry-run restart and validation commands preserve that same");
});

await check("completion audit help advertises real transcript boundary", async () => {
  const result = await run([process.execPath, "scripts/audit-s5-sbx-completion.mjs", "--help"], 10_000);
  assertExitZero(result, "completion audit help failed");
  assertIncludes(result.stdout, "completion evidence proves the real two-sandbox lifecycle transcript");
  assertIncludes(result.stdout, "completion evidence is missing or incomplete");
  assertIncludes(result.stdout, "zero sbx diagnose failures");
  assertIncludes(result.stdout, "direct sandbox log heartbeats");
  assertIncludes(result.stdout, "ordered stop/remove evidence");
  assertIncludes(result.stdout, ".ouroboros/s5-sbx-evidence/validate-*.log");
});

await check("promotion audit help advertises final Done boundary", async () => {
  const result = await run([process.execPath, "scripts/audit-s5-sbx-promotion.mjs", "--help"], 10_000);
  assertExitZero(result, "promotion audit help failed");
  assertIncludes(result.stdout, "Do not mark OURO-32 Done unless this audit exits 0");
  assertIncludes(result.stdout, "real two-sandbox completion evidence");
});

await check("blocker report help advertises local-only diagnostics", async () => {
  const result = await run([process.execPath, "scripts/report-s5-sbx-blocker.mjs", "--help"], 10_000);
  assertExitZero(result, "blocker report help failed");
  assertIncludes(result.stdout, "local, redacted S5 Docker Sandboxes sbx blocker report");
  assertIncludes(result.stdout, "Default mode is non-mutating");
  assertIncludes(result.stdout, "--include-create-probe flag is not non-mutating");
  assertIncludes(result.stdout, "refuses --include-create-probe before collecting diagnostics");
  assertIncludes(result.stdout, "does not run sbx reset");
  assertIncludes(result.stdout, "sbx version");
  assertIncludes(result.stdout, "sbx diagnose --output github-issue");
  assertIncludes(result.stdout, "Homebrew sbx stable/nightly metadata");
  assertIncludes(result.stdout, "sbx ls --json runtime-control probe");
  assertIncludes(result.stdout, "--include-create-probe");
  assertIncludes(result.stdout, "OUROBOROS_SDX_BIN");
  assertIncludes(result.stdout, "OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
  assertIncludes(result.stdout, "sbx diagnose --upload");
});

await check("README documents blocked-host support handoff", async () => {
  const readme = await readFile("README.md", "utf8");
  assertIncludes(readme, "For a Docker support handoff");
  assertIncludes(readme, "npm run validate:s5-sdx:preflight");
  assertIncludes(readme, "npm run validate:s5-sdx");
  assertIncludes(readme, "npm run login:s5-sdx-isolated");
  assertIncludes(readme, "npm run resume:s5-sdx-isolated");
  assertIncludes(readme, "npm run login:s5-sdx-local");
  assertIncludes(readme, "npm run resume:s5-sdx-local");
  assertIncludes(readme, "npm run recover:s5-sdx-daemon");
  assertIncludes(readme, "npm run recover:s5-sdx-daemon:validate");
  assertIncludes(readme, "OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run validate:s5-sdx:preflight");
  assertIncludes(readme, "OUROBOROS_SDX_BIN=/opt/homebrew/bin/sbx npm run validate:s5-sdx:preflight");
  assertIncludes(readme, "OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes");
  assertIncludes(readme, "OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run login:s5-sdx-isolated");
  assertIncludes(readme, "OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes npm run resume:s5-sdx-isolated");
  assertIncludes(readme, "npm run validate:s5-sdx-local:preflight");
  assertIncludes(readme, "npm run audit:s5-sdx-local:promotion");
  assertIncludes(readme, "OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home OUROBOROS_SDX_BIN=/opt/homebrew/bin/sbx");
  assertIncludes(readme, "sbx diagnose --output github-issue");
  assertIncludes(readme, "brew info docker/tap/sbx");
  assertIncludes(readme, "brew info docker/tap/sbx@nightly");
  assertIncludes(readme, "sbx ls --json");
  assertIncludes(readme, "OUROBOROS_SDX_BIN");
  assertIncludes(readme, "OUROBOROS_SBX_VALIDATE_NAME_SUFFIX");
  assertIncludes(readme, "Hypervisor/libkrun access outside the Codex command sandbox");
  assertIncludes(readme, "Operation not permitted");
  assertIncludes(readme, "Starkit or non-Docker-Sandboxes `sdx`");
  assertIncludes(readme, "npm run report:s5-sbx-blocker");
  assertIncludes(readme, "--include-create-probe");
  assertIncludes(readme, "OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
  assertIncludes(readme, "not sandbox-state non-mutating");
  assertIncludes(readme, "one uniquely named temporary sandbox");
  assertIncludes(readme, "OUROBOROS_SBX_EVIDENCE_PATH=.ouroboros/s5-sbx-evidence/validate-<timestamp>-blocked.log npm run validate:s5-sbx");
  assertIncludes(readme, "`sbx diagnose --upload`");
  assertIncludes(readme, "should be a separate human decision");
});

await check("local S5 evidence transcripts are ignored by git", async () => {
  const result = await run(["git", "check-ignore", ".ouroboros/s5-sbx-evidence/example.log"], 10_000);
  assertExitZero(result, "S5 evidence transcript path is not ignored");
  assertIncludes(result.stdout, ".ouroboros/s5-sbx-evidence/example.log");
});

if (hostProbes) {
  await check("host sbx preflight remains non-mutating", async () => {
    const result = await run(["npm", "run", s5ScriptName("validate:preflight")], 30_000);
    assertIncludes(result.stdout, "OURO-32 real Docker Sandboxes sbx validation");
    assertIncludes(result.stdout, "sbx version");
    if (result.code === 0 && !result.timedOut) {
      assertIncludes(result.stdout, "sbx ls runtime-control probe");
      return;
    }
    if (result.stdout.includes("sbx ls runtime-control probe")) {
      throw new BlockedCheck("host sbx runtime-control preflight did not pass");
    }
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    if (
      combinedOutput.includes("Not authenticated to Docker") ||
      combinedOutput.includes("not signed in") ||
      combinedOutput.includes("Authentication")
    ) {
      throw new BlockedCheck("host sbx authentication preflight did not pass");
    }
    if (
      combinedOutput.includes("Daemon failed") ||
      combinedOutput.includes("not reachable") ||
      combinedOutput.includes("daemon not running")
    ) {
      throw new BlockedCheck("host sbx daemon preflight did not pass");
    }
    throw new BlockedCheck("host sbx preflight stopped before runtime-control");
  });

  await check("host recovery dry-run remains non-mutating", async () => {
    const result = await run(["npm", "run", s5ScriptName("recover")], 30_000);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    if (result.code === 4 && combinedOutput.includes("does not look like the Docker Sandboxes sbx CLI")) {
      throw new BlockedCheck("host sbx binary preflight did not pass");
    }
    assertExitZero(result, "recovery dry-run failed");
    assertIncludes(result.stdout, "No changes made.");
    assertIncludes(result.stdout, "active_sbx_exec_sessions=");
  });
}

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

async function assertFilesExist(files) {
  for (const file of files) {
    await access(file, fsConstants.F_OK);
  }
}

function assertValue(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new Error(`missing expected text: ${expected}`);
  }
}

function assertExitZero(result, message) {
  if (result.code !== 0 || result.timedOut) {
    throw new Error(`${message} code=${result.code} timed_out=${result.timedOut}`);
  }
}

function run(argv, timeoutMs) {
  return new Promise((resolve) => {
    const [file, ...args] = argv;
    const child = spawn(file, args, { cwd: process.cwd(), env: process.env });
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
  console.log("S5 sbx readiness audit");
  for (const entry of checks) {
    console.log(`${entry.status.toUpperCase()} ${entry.label}`);
    if (entry.detail) {
      console.log(`  ${entry.detail}`);
    }
  }
  console.log(`REAL_ENVIRONMENT_PROOF_REQUIRED npm run ${s5ScriptName("validate")}`);
  console.log("AUDIT_IS_NOT_COMPLETION true");
}

function s5ScriptName(kind) {
  const alias = process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN ? "sdx" : "sbx";
  if (kind === "validate") {
    return `validate:s5-${alias}`;
  }
  if (kind === "validate:preflight") {
    return `validate:s5-${alias}:preflight`;
  }
  if (kind === "recover") {
    return `recover:s5-${alias}-daemon`;
  }
  throw new Error(`unknown S5 script kind: ${kind}`);
}
