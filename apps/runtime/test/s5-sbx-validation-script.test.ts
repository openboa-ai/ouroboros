import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const defaultS5ValidationCommandTimeoutMs = "10000";
const s5LifecycleScriptTimeoutMs = 60_000;
const s5LifecycleTestTimeoutMs = 75_000;
const hostS5LifecycleIt = process.env.GITHUB_ACTIONS === "true" ? it.skip : it;

beforeEach(() => {
  delete process.env.OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION;
  delete process.env.OUROBOROS_ALLOW_SBX_CREATE_PROBE;
  delete process.env.OUROBOROS_ALLOW_SBX_DAEMON_RESTART;
  delete process.env.OUROBOROS_PROBE_S5_SBX_CREATE_PATH;
  delete process.env.OUROBOROS_SBX_BIN;
  delete process.env.OUROBOROS_SBX_DAEMON_LOG_PATH;
  delete process.env.OUROBOROS_SBX_EVIDENCE_PATH;
  delete process.env.OUROBOROS_SBX_HOME;
  delete process.env.OUROBOROS_SBX_VALIDATE_NAME_SUFFIX;
  delete process.env.OUROBOROS_SBX_VALIDATE_PORT;
  delete process.env.OUROBOROS_SDX_BIN;
  delete process.env.OUROBOROS_VALIDATE_S5_SBX_AFTER_RECOVERY;
  delete process.env.SBX_CALL_LOG;
  delete process.env.SBX_EXPECT_HOME;
  delete process.env.SBX_FAKE_COMMAND_LOG;
  delete process.env.SBX_FAKE_INSTANCE_ID;
});

describe("S5 sbx validation harness", () => {
  it("stops at the runtime-control preflight probe before mutating sandbox state", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "sbx-calls.log");
    const fakeSbx = path.join(tempDir, "sbx");
    try {
      await writeExecutable(fakeSbx, fakeSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSbx,
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx ls runtime-control probe");
      expect(result.stdout).toContain("next_action=approved_default_sbx_daemon_recovery_required");
      expect(result.stdout).toContain("active_session_interruption_approval_phrase=승인:");
      expect(result.stdout).toContain("default_sbx_recovery_command=");
      expect(result.stderr).toContain("failed to list runtimes");
      expect(calls).toEqual([
        "version",
        "diagnose --output json",
        "daemon status",
        "ls"
      ]);
      expect(calls).not.toContain("create --name ouro-s5-clock-a shell");
      expect(calls.some((call) => call.startsWith("stop ") || call.startsWith("rm "))).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports unavailable sbx as a host preflight block", async () => {
    const tempDir = await makeTempDir();
    try {
      const missingSbx = path.join(tempDir, "missing-sbx");
      const result = await runValidation({
        OUROBOROS_SBX_BIN: missingSbx
      });

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx version");
      expect(result.stdout).toContain("next_action=approved_default_sbx_daemon_recovery_required");
      expect(result.stdout).toContain("active_session_interruption_approval_phrase=승인:");
      expect(result.stderr).toContain("RESULT: failed - sbx version exited 127");
      expect(result.stderr).toContain("ENOENT");
      expect(result.stdout).not.toContain("sbx ls runtime-control probe");
      expect(result.stdout).not.toContain("create --name ouro-s5-clock-a");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("prints isolated sbx HOME login and recovery next actions when preflight is blocked", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "isolated-sbx-calls.log");
    const fakeSbx = path.join(tempDir, "sbx");
    const isolatedHome = path.join(tempDir, "isolated-home");
    try {
      await writeExecutable(fakeSbx, fakeSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSbx,
        OUROBOROS_SBX_HOME: isolatedHome,
        SBX_CALL_LOG: callLog
      });

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(`sbx home: ${isolatedHome}`);
      expect(result.stdout).toContain("isolated_sbx_home_auth_required=true");
      expect(result.stdout).toContain(`isolated_sbx_home_login_command=HOME='${isolatedHome}' '${fakeSbx}' login`);
      expect(result.stdout).toContain("isolated_sbx_home_recovery_command=");
      expect(result.stdout).toContain("isolated_sbx_home_resume_command=");
      expect(result.stdout).toContain("isolated_sbx_home_validate_command=");
      expect(result.stdout).not.toContain("active_session_interruption_approval_phrase=");
      expect(result.stdout).not.toContain("default_sbx_recovery_command=");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects the unrelated system sdx utility before mutating sandbox state", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "sdx-calls.log");
    const fakeSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeSdx, fakeSdxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSdx,
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stdout).toContain("sbx version");
      expect(result.stderr).toContain("does not look like the Docker Sandboxes sbx CLI");
      expect(result.stderr).toContain("not the system sdx/Starkit utility");
      expect(calls).toEqual(["version"]);
      expect(calls.some((call) => call.startsWith("create ") || call.startsWith("stop ") || call.startsWith("rm ")))
        .toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("does not reject a Docker Sandboxes-compatible CLI solely because it is named sdx", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "aliased-sdx-calls.log");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeAliasedSdx, fakeSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx ls runtime-control probe");
      expect(result.stdout).toContain(`default_sbx_recovery_command=OUROBOROS_SBX_BIN='${fakeAliasedSdx}'`);
      expect(result.stderr).not.toContain("not the system sdx/Starkit utility");
      expect(calls).toEqual([
        "version",
        "diagnose --output json",
        "daemon status",
        "ls"
      ]);
      expect(calls.some((call) => call.startsWith("create ") || call.startsWith("stop ") || call.startsWith("rm ")))
        .toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("supports OUROBOROS_SDX_BIN as a compatibility alias when OUROBOROS_SBX_BIN is unset", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "sdx-env-alias-calls.log");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeAliasedSdx, fakeSbxScript());

      const result = await runValidation({
        OUROBOROS_SDX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx ls runtime-control probe");
      expect(result.stdout).toContain(`default_sbx_recovery_command=OUROBOROS_SDX_BIN='${fakeAliasedSdx}'`);
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon:validate");
      expect(result.stderr).not.toContain("not the system sdx/Starkit utility");
      expect(calls).toEqual([
        "version",
        "diagnose --output json",
        "daemon status",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("supports the repo-local sdx Docker Sandboxes shim", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "repo-local-sdx-shim-calls.log");
    const shimPath = path.join(repoRoot, "scripts/sdx-docker-sandboxes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeSbxScript());

      const result = await runValidation({
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: shimPath,
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(`$ ${shimPath} version`);
      expect(result.stdout).toContain(`default_sbx_recovery_command=OUROBOROS_SDX_BIN='${shimPath}'`);
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon:validate");
      expect(result.stderr).not.toContain("not the system sdx/Starkit utility");
      expect(calls).toEqual([
        "version",
        "diagnose --output json",
        "daemon status",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("documents the sbx versus sdx boundary in validation help output", async () => {
    const result = await runScript(["scripts/validate-s5-sbx-runtime.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("Requires Docker Sandboxes sbx");
    expect(result.stdout).toContain("/usr/bin/sdx Starkit utility is unrelated");
    expect(result.stdout).toContain("OUROBOROS_SBX_BIN");
    expect(result.stdout).toContain("OUROBOROS_SDX_BIN");
    expect(result.stdout).toContain("OUROBOROS_SBX_HOME");
    expect(result.stdout).toContain("OUROBOROS_SBX_VALIDATE_NAME_SUFFIX");
    expect(result.stdout).toContain("Hypervisor/libkrun access outside the Codex command sandbox");
    expect(result.stdout).toContain("Operation not permitted");
    expect(result.stdout).toContain("Exit codes:");
    expect(result.stdout).toContain("host sbx preflight/runtime-control is blocked");
  });

  it("audits repo-side S5 sbx readiness without host mutation", async () => {
    const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs"], {}, 15_000);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("S5 sbx readiness audit");
    expect(result.stdout).toContain("PASS required S5 artifact/runtime files exist");
    expect(result.stdout).toContain("PASS npm S5 sbx scripts are registered");
    expect(result.stdout).toContain("PASS validation help advertises sbx/sdx/evidence guardrails");
    expect(result.stdout).toContain("PASS recovery help advertises approval and reset boundaries");
    expect(result.stdout).toContain("PASS completion audit help advertises real transcript boundary");
    expect(result.stdout).toContain("PASS blocker report help advertises local-only diagnostics");
    expect(result.stdout).toContain("PASS README documents blocked-host support handoff");
    expect(result.stdout).toContain("PASS local S5 evidence transcripts are ignored by git");
    expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run validate:s5-sbx");
    expect(result.stdout).toContain("AUDIT_IS_NOT_COMPLETION true");
    expect(result.stdout).not.toContain("sbx ls runtime-control probe");
  });

  it("registers isolated login npm commands without baking in a default home", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["login:s5-sbx-isolated"]).toContain("OUROBOROS_SBX_HOME:?");
    expect(packageJson.scripts["login:s5-sbx-isolated"]).toContain("${OUROBOROS_SBX_BIN:-sbx} login");
    expect(packageJson.scripts["login:s5-sdx-isolated"]).toContain("OUROBOROS_SBX_HOME:?");
    expect(packageJson.scripts["login:s5-sdx-isolated"]).toContain("${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes} login");
  });

  it("registers isolated resume npm commands that run recovery validation", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["resume:s5-sbx-isolated"]).toContain("OUROBOROS_SBX_HOME:?");
    expect(packageJson.scripts["resume:s5-sbx-isolated"]).toContain("OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1");
    expect(packageJson.scripts["resume:s5-sbx-isolated"]).toContain("npm run recover:s5-sbx-daemon:validate");
    expect(packageJson.scripts["resume:s5-sdx-isolated"]).toContain("OUROBOROS_SBX_HOME:?");
    expect(packageJson.scripts["resume:s5-sdx-isolated"]).toContain("OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes}");
    expect(packageJson.scripts["resume:s5-sdx-isolated"]).toContain("OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1");
    expect(packageJson.scripts["resume:s5-sdx-isolated"]).toContain("npm run recover:s5-sdx-daemon:validate");
  });

  it("registers repo-local isolated sdx convenience commands", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    for (const scriptName of [
      "login:s5-sdx-local",
      "resume:s5-sdx-local",
      "validate:s5-sdx-local:preflight",
      "validate:s5-sdx-local",
      "report:s5-sdx-local-blocker",
      "audit:s5-sdx-local:promotion"
    ]) {
      expect(packageJson.scripts[scriptName]).toContain("OUROBOROS_SBX_HOME=${OUROBOROS_SBX_HOME:-/private/tmp/ouro-s5-sdx-home}");
      expect(packageJson.scripts[scriptName]).toContain("OUROBOROS_SDX_BIN=${OUROBOROS_SDX_BIN:-./scripts/sdx-docker-sandboxes}");
    }
    expect(packageJson.scripts["login:s5-sdx-local"]).toContain("npm run login:s5-sdx-isolated");
    expect(packageJson.scripts["resume:s5-sdx-local"]).toContain("npm run resume:s5-sdx-isolated");
    expect(packageJson.scripts["validate:s5-sdx-local:preflight"]).toContain("npm run validate:s5-sdx:preflight");
    expect(packageJson.scripts["validate:s5-sdx-local"]).toContain("npm run validate:s5-sdx");
    expect(packageJson.scripts["report:s5-sdx-local-blocker"]).toContain("npm run report:s5-sdx-blocker");
    expect(packageJson.scripts["report:s5-sdx-local-blocker"]).toContain("--write-default-report");
    expect(packageJson.scripts["audit:s5-sdx-local:promotion"]).toContain("npm run audit:s5-sdx:promotion");
  });

  it("documents S5 sbx readiness audit exit codes", async () => {
    const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("Exit codes:");
    expect(result.stdout).toContain("repo readiness failed");
    expect(result.stdout).toContain("host sbx preflight/runtime-control is blocked");
  });

  it("documents S5 sbx completion audit evidence requirements", async () => {
    const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("completion evidence proves the real two-sandbox lifecycle transcript");
    expect(result.stdout).toContain("completion evidence is missing or incomplete");
    expect(result.stdout).toContain("zero sbx diagnose failures");
    expect(result.stdout).toContain("direct sandbox log heartbeats");
    expect(result.stdout).toContain("ordered stop/remove evidence");
    expect(result.stdout).toContain("--evidence <path>");
    expect(result.stdout).toContain(".ouroboros/s5-sbx-evidence/validate-*.log");
  });

  it("documents S5 sbx promotion audit Done boundary", async () => {
    const result = await runScript(["scripts/audit-s5-sbx-promotion.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("Do not mark OURO-32 Done unless this audit exits 0");
    expect(result.stdout).toContain("real two-sandbox completion evidence");
    expect(result.stdout).toContain("--evidence");
  });

  it("reports the promotion audit sdx boundary as non-Docker/Starkit-only", async () => {
    const tempDir = await makeTempDir();
    const evidencePath = path.join(tempDir, "validate-blocked.log");
    try {
      await writeFile(evidencePath, "## OURO-32 real Docker Sandboxes sbx validation\nRESULT: failed\n", "utf8");

      const result = await runScript([
        "scripts/audit-s5-sbx-promotion.mjs",
        "--evidence",
        evidencePath
      ], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("Starkit or non-Docker-Sandboxes sdx transcript evidence is not accepted");
      expect(result.stdout).not.toContain("sdx/Starkit transcript evidence is not accepted");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("documents the local-only blocked-host report command", async () => {
    const result = await runScript(["scripts/report-s5-sbx-blocker.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("local, redacted S5 Docker Sandboxes sbx blocker report");
    expect(result.stdout).toContain("runtime-control/runtime-create blocker");
    expect(result.stdout).toContain("Default mode is non-mutating");
    expect(result.stdout).toContain("--include-create-probe flag is not non-mutating");
    expect(result.stdout).toContain("refuses --include-create-probe before collecting diagnostics");
    expect(result.stdout).toContain("sbx version");
    expect(result.stdout).toContain("sbx diagnose --output github-issue");
    expect(result.stdout).toContain("host macOS, architecture, and hypervisor support probes");
    expect(result.stdout).toContain("Homebrew sbx stable/nightly metadata");
    expect(result.stdout).toContain("sbx code-signing, Gatekeeper assessment, and quarantine metadata");
    expect(result.stdout).toContain("macOS syspolicyd, kernel sandbox denial, and DetachedSignatures hints");
    expect(result.stdout).toContain("sbx create --help and sbx template ls runtime-create context");
    expect(result.stdout).toContain("sbx ls --json runtime-control probe");
    expect(result.stdout).toContain("redacted daemon log lines that mention runtime-create VM start failures");
    expect(result.stdout).toContain("--include-create-probe");
    expect(result.stdout).toContain("--write-default-report");
    expect(result.stdout).toContain("OUROBOROS_SBX_DAEMON_LOG_PATH");
    expect(result.stdout).toContain("OUROBOROS_SDX_BIN");
    expect(result.stdout).toContain("OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
    expect(result.stdout).toContain("validate:s5-sbx or validate:s5-sdx with a fresh evidence transcript");
    expect(result.stdout).toContain("does not run sbx reset");
    expect(result.stdout).toContain("sbx diagnose --upload");
    expect(result.stdout).toContain("Exit codes:");
  });

  it("refuses blocker report create probe before diagnostics when the explicit gate is missing", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeReportSbxScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeReportNpmScript());
      await writeExecutable(path.join(tempDir, "brew"), fakeReportBrewScript());
      await writeExecutable(path.join(tempDir, "sw_vers"), fakeSwVersScript());
      await writeExecutable(path.join(tempDir, "uname"), fakeUnameScript());
      await writeExecutable(path.join(tempDir, "sysctl"), fakeSysctlScript());
      await writeFakeReportHostDiagnosticScripts(tempDir);

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs",
        "--include-create-probe"
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog
      });

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("Refusing --include-create-probe without OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
      expect(result.stdout).toBe("");
      await expect(readFile(sbxCallLog, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(npmCallLog, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("refuses blocker reports with non-Docker-Sandboxes sdx before diagnostics", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sdx-report-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const fakeSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeSdx, fakeSdxScript());

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs"
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: fakeSdx,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stdout).toContain("## sbx version");
      expect(result.stdout).toContain("S5_SBX_BLOCKER_REPORT_RESULT failed");
      expect(result.stderr).toContain("does not look like the Docker Sandboxes sbx CLI");
      expect(result.stderr).toContain("not the system sdx/Starkit utility");
      expect(sbxCalls).toEqual(["version"]);
      await expect(readFile(npmCallLog, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("generates a blocked-host report without upload, reset, or recovery apply", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const reportPath = path.join(tempDir, "blocker-report.md");
    const evidencePath = path.join(tempDir, "validate-blocked.log");
    const daemonLogPath = path.join(tempDir, "daemon.log");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeReportSbxScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeReportNpmScript());
      await writeExecutable(path.join(tempDir, "brew"), fakeReportBrewScript());
      await writeExecutable(path.join(tempDir, "sw_vers"), fakeSwVersScript());
      await writeExecutable(path.join(tempDir, "uname"), fakeUnameScript());
      await writeExecutable(path.join(tempDir, "sysctl"), fakeSysctlScript());
      await writeFakeReportHostDiagnosticScripts(tempDir);
      await writeFile(daemonLogPath, fakeReportDaemonLog(tempDir), "utf8");

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs",
        "--evidence",
        evidencePath,
        "--report",
        reportPath
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_DAEMON_LOG_PATH: daemonLogPath,
        OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS: "2000"
      }, 10_000);
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");
      const report = await readFile(reportPath, "utf8");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("S5_SBX_BLOCKER_REPORT_RESULT blocked");
      expect(result.stdout).toContain(`report_written=${reportPath}`);
      expect(report).toContain(`evidence_transcript=${evidencePath}`);
      expect(report).toContain("runtime-control/runtime-create blocker");
      expect(report).toContain("non_mutating=true");
      expect(report).toContain("uploads_diagnostics=false");
      expect(report).toContain("host macOS version");
      expect(report).toContain("ProductVersion:\t\t26.4.1");
      expect(report).toContain("host architecture");
      expect(report).toContain("arm64");
      expect(report).toContain("host hypervisor support");
      expect(report).toContain("kern.hv_support: 1");
      expect(report).toContain("brew sbx stable metadata");
      expect(report).toContain("sbx (Docker Sandboxes): 0.28.3");
      expect(report).toContain("sbx@nightly (Docker Sandboxes): nightly-");
      expect(report).toContain("sbx CLI code signature verification");
      expect(report).toContain("valid on disk");
      expect(report).toContain("sbx nerdbox shim entitlements");
      expect(report).toContain("com.apple.security.hypervisor");
      expect(report).toContain("sbx CLI Gatekeeper assessment");
      expect(report).toContain("internal error in Code Signing subsystem");
      expect(report).toContain("sbx package quarantine metadata");
      expect(report).toContain("com.apple.quarantine");
      expect(report).toContain("com.apple.quarantine: present");
      expect(report).not.toContain("0381;test");
      expect(report).not.toContain("SHOULD_NOT_APPEAR");
      expect(report).toContain("host DetachedSignatures path check");
      expect(report).toContain("/private/var/db/DetachedSignatures: No such file or directory");
      expect(report).toContain("host syspolicyd signing assessment hints");
      expect(report).toContain("Unable to initialize qtn_proc: 3");
      expect(report).toContain("dispatch_mig_server returned 268435459");
      expect(report).toContain("Unable to get certificates array: (null)");
      expect(report).toContain("host kernel sandbox denial hints");
      expect(report).toContain("deny(1) sysctl-read kern.hv_support");
      expect(report).toContain("deny(1) file-write-data /dev/dtracehelper");
      expect(report).toContain("sbx create help runtime-create context");
      expect(report).toContain("--cpus int");
      expect(report).toContain("sbx template list runtime-create context");
      expect(report).toContain("docker/sandbox-templates");
      expect(report).toContain("context canceled");
      expect(report).toContain("sbx ls json runtime-control probe");
      expect(report).toContain("daemon log runtime-create failure hints");
      expect(report).toContain("daemon_log_path=<local-path>/daemon.log");
      expect(report).toContain("krun_start_enter failed: -1");
      expect(report).toContain("<local-path>");
      expect(sbxCalls).toEqual([
        "version",
        "diagnose --output github-issue",
        "create --help",
        "template ls",
        "ls --json"
      ]);
      expect(sbxCalls.some((call) => call.includes("--upload") || call === "reset")).toBe(false);
      expect(npmCalls).toEqual([
        `run validate:s5-sbx|${evidencePath}`,
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}|`,
        `run audit:s5-sbx:promotion -- --evidence ${evidencePath}|`,
        "run recover:s5-sbx-daemon|"
      ]);
      expect(npmCalls.some((call) => call.includes("--apply"))).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15_000);

  it("can write a timestamped default blocker report when requested", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const daemonLogPath = path.join(tempDir, "daemon.log");
    const evidencePath = path.join(tempDir, "validate-blocked.log");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeReportSbxScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeReportNpmScript());
      await writeExecutable(path.join(tempDir, "brew"), fakeReportBrewScript());
      await writeExecutable(path.join(tempDir, "sw_vers"), fakeSwVersScript());
      await writeExecutable(path.join(tempDir, "uname"), fakeUnameScript());
      await writeExecutable(path.join(tempDir, "sysctl"), fakeSysctlScript());
      await writeFakeReportHostDiagnosticScripts(tempDir);
      await writeFile(daemonLogPath, fakeReportDaemonLog(tempDir), "utf8");

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs",
        "--write-default-report",
        "--evidence",
        evidencePath
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_DAEMON_LOG_PATH: daemonLogPath,
        OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS: "2000"
      }, 10_000);
      const reportPathMatch = result.stdout.match(/report_written=(.+blocker-report-[^\n]+\.md)/);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(reportPathMatch?.[1]).toBeTruthy();
      expect(reportPathMatch?.[1]).toContain(path.join(repoRoot, ".ouroboros/s5-sbx-evidence"));
      const report = await readFile(reportPathMatch?.[1] ?? "", "utf8");
      expect(report).toContain("S5_SBX_BLOCKER_REPORT_RESULT blocked");
      expect(report).toContain(`evidence_transcript=${evidencePath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses OUROBOROS_SDX_BIN as the blocker report sbx command alias", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sdx-report-alias-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const reportPath = path.join(tempDir, "blocker-report.md");
    const evidencePath = path.join(tempDir, "validate-blocked.log");
    const daemonLogPath = path.join(tempDir, "daemon.log");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeAliasedSdx, fakeReportSbxScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeReportNpmScript());
      await writeExecutable(path.join(tempDir, "brew"), fakeReportBrewScript());
      await writeExecutable(path.join(tempDir, "sw_vers"), fakeSwVersScript());
      await writeExecutable(path.join(tempDir, "uname"), fakeUnameScript());
      await writeExecutable(path.join(tempDir, "sysctl"), fakeSysctlScript());
      await writeFakeReportHostDiagnosticScripts(tempDir);
      await writeFile(daemonLogPath, fakeReportDaemonLog(tempDir), "utf8");

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs",
        "--evidence",
        evidencePath,
        "--report",
        reportPath
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_DAEMON_LOG_PATH: daemonLogPath,
        OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS: "2000"
      }, 10_000);
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("S5_SBX_BLOCKER_REPORT_RESULT blocked");
      expect(sbxCalls).toEqual([
        "version",
        "diagnose --output github-issue",
        "create --help",
        "template ls",
        "ls --json"
      ]);
      expect(npmCalls).toEqual([
        `run validate:s5-sdx|${evidencePath}`,
        `run audit:s5-sdx:completion -- --evidence ${evidencePath}|`,
        `run audit:s5-sdx:promotion -- --evidence ${evidencePath}|`,
        "run recover:s5-sdx-daemon|"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("can include the explicitly gated direct create-path probe in the blocked-host report", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const reportPath = path.join(tempDir, "blocker-report-with-create-probe.md");
    const evidencePath = path.join(tempDir, "validate-blocked.log");
    const daemonLogPath = path.join(tempDir, "daemon.log");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeReportSbxScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeReportNpmScript());
      await writeExecutable(path.join(tempDir, "brew"), fakeReportBrewScript());
      await writeExecutable(path.join(tempDir, "sw_vers"), fakeSwVersScript());
      await writeExecutable(path.join(tempDir, "uname"), fakeUnameScript());
      await writeExecutable(path.join(tempDir, "sysctl"), fakeSysctlScript());
      await writeFakeReportHostDiagnosticScripts(tempDir);
      await writeFile(daemonLogPath, fakeReportDaemonLog(tempDir), "utf8");

      const result = await runScript([
        "scripts/report-s5-sbx-blocker.mjs",
        "--include-create-probe",
        "--evidence",
        evidencePath,
        "--report",
        reportPath
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_ALLOW_SBX_CREATE_PROBE: "1",
        OUROBOROS_SBX_DAEMON_LOG_PATH: daemonLogPath,
        OUROBOROS_SBX_BLOCKER_REPORT_TIMEOUT_MS: "2000"
      }, 10_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");
      const report = await readFile(reportPath, "utf8");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(report).toContain("non_mutating=false");
      expect(report).toContain("temporary_create_probe=requested");
      expect(report).toContain("npm run recover:s5-sbx-daemon direct create-path probe");
      expect(report).toContain("direct_create_probe_result=blocked");
      expect(report).toContain("failed to check if sandbox exists");
      expect(npmCalls).toEqual([
        `run validate:s5-sbx|${evidencePath}`,
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}|`,
        `run audit:s5-sbx:promotion -- --evidence ${evidencePath}|`,
        "run recover:s5-sbx-daemon|",
        "run recover:s5-sbx-daemon -- --probe-create-path|"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when real transcript evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const missingEvidence = path.join(tempDir, "missing-validation.log");
      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs"], {
        OUROBOROS_SBX_EVIDENCE_PATH: missingEvidence
      });

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("S5 sbx completion audit");
      expect(result.stdout).toContain(`evidence_transcript=${missingEvidence}`);
      expect(result.stdout).toContain("PASS objective mapped to concrete S5 completion gates");
      expect(result.stdout).toContain("INCOMPLETE real two-sandbox validation transcript is present and complete");
      expect(result.stdout).toContain("cannot read validation transcript evidence");
      expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run validate:s5-sbx");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("prints s5-sdx validation guidance for completion audit when OUROBOROS_SDX_BIN is set", async () => {
    const tempDir = await makeTempDir();
    try {
      const missingEvidence = path.join(tempDir, "missing-validation.log");
      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs"], {
        OUROBOROS_SDX_BIN: path.join(tempDir, "sdx"),
        OUROBOROS_SBX_EVIDENCE_PATH: missingEvidence
      });

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run validate:s5-sdx");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx promotion audit blocked when completion evidence is incomplete", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "blocked.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakePromotionNpmScript({ completionExitCode: 2 }));

      const result = await runScript(["scripts/audit-s5-sbx-promotion.mjs", "--evidence", evidencePath], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("PASS repo readiness audit");
      expect(result.stdout).toContain("BLOCKED real two-sandbox completion audit");
      expect(result.stdout).toContain("PROMOTION_AUDIT_RESULT blocked");
      expect(npmCalls).toEqual([
        "run audit:s5-sbx",
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}`
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses s5-sdx audit aliases for promotion when OUROBOROS_SDX_BIN is set", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "blocked.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakePromotionNpmScript({ completionExitCode: 2 }));

      const result = await runScript(["scripts/audit-s5-sbx-promotion.mjs", "--evidence", evidencePath], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SDX_BIN: path.join(tempDir, "sdx")
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(npmCalls).toEqual([
        "run audit:s5-sdx",
        `run audit:s5-sdx:completion -- --evidence ${evidencePath}`
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes S5 sbx promotion audit only when readiness and completion pass", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "passed.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakePromotionNpmScript());

      const result = await runScript(["scripts/audit-s5-sbx-promotion.mjs", "--evidence", evidencePath], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PASS repo readiness audit");
      expect(result.stdout).toContain("PASS real two-sandbox completion audit");
      expect(result.stdout).toContain("PROMOTION_AUDIT_RESULT ready_to_done");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes S5 sbx completion audit only when transcript proves both sandbox lifecycles", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-real-sbx.log");
      await writeFile(evidencePath, fakeCompletionEvidence(), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain(`evidence_transcript=${evidencePath}`);
      expect(result.stdout).toContain("PASS objective mapped to concrete S5 completion gates");
      expect(result.stdout).toContain("PASS repo S5 completion audit files and scripts exist");
      expect(result.stdout).toContain("PASS real two-sandbox validation transcript is present and complete");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT complete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes S5 sbx completion audit when a Docker Sandboxes-compatible transcript uses an sdx command alias", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-sdx-alias-sbx.log");
      await writeFile(
        evidencePath,
        fakeCompletionEvidence().replace("## sbx version\n", "## sbx version\n$ sdx version\n"),
        "utf8"
      );

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT complete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes S5 sbx completion audit when validation uses unique sandbox names", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-unique-sandbox-names.log");
      await writeFile(
        evidencePath,
        fakeCompletionEvidence()
          .replaceAll("ouro-s5-clock-a", "ouro-s5-clock-a-unique-001")
          .replaceAll("ouro-s5-clock-b", "ouro-s5-clock-b-unique-001"),
        "utf8"
      );

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT complete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when transcript contains failure evidence", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-failed-sbx.log");
      await writeFile(evidencePath, `${fakeCompletionEvidence()}\nRESULT: failed - late cleanup failure\n`, "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("INCOMPLETE real two-sandbox validation transcript is present and complete");
      expect(result.stdout).toContain("transcript contains failure evidence: RESULT: failed");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when runtime harness evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-runtime-harness.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitRuntimeHarnessEvidence: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("missing transcript evidence: ## start runtime API with real sbx adapter enabled");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when transcript uses sdx Starkit", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-sdx-starkit.log");
      await writeFile(
        evidencePath,
        fakeCompletionEvidence().replace("Client Version:  v0.28.3 test", "sdx 2.0 Starkit Developer eXtension"),
        "utf8"
      );

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("transcript uses sdx/Starkit, not Docker Sandboxes sbx");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when sandbox stop evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-stop.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitStopB: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing ordered transcript evidence for instance B lifecycle order: stop ouro-s5-clock-b"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when runtime API stop response is not stopped", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-runtime-api-stop-not-stopped.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ failStopBResponse: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing stopped lifecycle evidence for sandbox-runtime-instance-clock-b in transcript section: runtime API stop B response"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when sandbox lifecycle evidence is out of order", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-out-of-order.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ removeBeforeStopB: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing ordered transcript evidence for instance B lifecycle order: rm --force ouro-s5-clock-b"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when direct sandbox log evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-direct-log.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitDirectLogB: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("missing transcript evidence: direct sbx log B");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when direct sandbox log heartbeat has the wrong instance", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-wrong-direct-log-instance.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ wrongDirectLogBInstance: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing runtime_heartbeat JSON for sandbox-runtime-instance-clock-b in transcript section: direct sbx log B"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when runtime API log heartbeat is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-runtime-api-log-heartbeat.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitRuntimeApiLogBHeartbeat: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing runtime_heartbeat evidence for sandbox-runtime-instance-clock-b in transcript section: runtime API logs B"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when raw-secret rejection evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-raw-secret-rejection.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitRawSecretRejection: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("missing transcript evidence: runtime API raw secret rejection probe");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when artifact id evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-artifact-id.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitStartBArtifactId: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing fixture-runnable-artifact-clock-python-001 in transcript section: runtime API start B response"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when cleanup success evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-cleanup-result.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitCleanupExitCodeB: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("missing exit_code=0 in transcript section: sbx rm ouro-s5-clock-b");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when concurrent sbx listing misses one instance", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-concurrent-listing.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitSandboxBFromFullList: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("missing ouro-s5-clock-b in transcript section: sbx ls");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when start command success evidence is missing", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-missing-start-success.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ omitStartBExitCode: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain(
        "missing exit_code=0 after exec -d -w in transcript section: runtime API start B command evidence"
      );
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when sbx diagnose reports failures", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-diagnose-fail.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ diagnoseFailCount: 1 }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx diagnose summary.fail is not 0: 1");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps S5 sbx completion audit incomplete when sbx diagnose JSON is invalid", async () => {
    const tempDir = await makeTempDir();
    try {
      const evidencePath = path.join(tempDir, "validate-diagnose-invalid-json.log");
      await writeFile(evidencePath, fakeCompletionEvidence({ invalidDiagnoseJson: true }), "utf8");

      const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence", evidencePath], {});

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("invalid JSON object in transcript section: sbx diagnose --output json");
      expect(result.stdout).toContain("COMPLETION_AUDIT_RESULT incomplete");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails S5 sbx completion audit when explicit evidence path is missing", async () => {
    const result = await runScript(["scripts/audit-s5-sbx-completion.mjs", "--evidence"], {});

    expect(result.code, scriptOutput(result)).toBe(1);
    expect(result.stderr).toContain("--evidence requires a path");
  });

  it("reports host-probe runtime-control blockers without widening recovery", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript());

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("PASS required S5 artifact/runtime files exist");
      expect(result.stdout).toContain("BLOCKED host sbx preflight remains non-mutating");
      expect(result.stdout).toContain("host sbx runtime-control preflight did not pass");
      expect(result.stdout).toContain("PASS host recovery dry-run remains non-mutating");
      expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run validate:s5-sbx");
      expect(result.stdout).toContain("AUDIT_IS_NOT_COMPLETION true");
      expect(result.stdout).not.toContain("FAIL");
      expect(npmCalls).toEqual([
        "run validate:s5-sbx:preflight",
        "run recover:s5-sbx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses s5-sdx npm aliases for host probes when OUROBOROS_SDX_BIN is set", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript());

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SDX_BIN: path.join(tempDir, "sdx")
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("BLOCKED host sbx preflight remains non-mutating");
      expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run validate:s5-sdx");
      expect(npmCalls).toEqual([
        "run validate:s5-sdx:preflight",
        "run recover:s5-sdx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports host-probe preflight blockers before runtime-control without widening recovery", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript({ preflightStage: "diagnose" }));

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("PASS required S5 artifact/runtime files exist");
      expect(result.stdout).toContain("BLOCKED host sbx preflight remains non-mutating");
      expect(result.stdout).toContain("host sbx preflight stopped before runtime-control");
      expect(result.stdout).toContain("PASS host recovery dry-run remains non-mutating");
      expect(result.stdout).not.toContain("FAIL");
      expect(npmCalls).toEqual([
        "run validate:s5-sbx:preflight",
        "run recover:s5-sbx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports host-probe authentication blockers before runtime-control", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript({ preflightStage: "auth" }));

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("BLOCKED host sbx preflight remains non-mutating");
      expect(result.stdout).toContain("host sbx authentication preflight did not pass");
      expect(result.stdout).toContain("PASS host recovery dry-run remains non-mutating");
      expect(result.stdout).not.toContain("FAIL");
      expect(npmCalls).toEqual([
        "run validate:s5-sbx:preflight",
        "run recover:s5-sbx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports host-probe daemon blockers before runtime-control", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript({ preflightStage: "daemon" }));

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("BLOCKED host sbx preflight remains non-mutating");
      expect(result.stdout).toContain("host sbx daemon preflight did not pass");
      expect(result.stdout).toContain("PASS host recovery dry-run remains non-mutating");
      expect(result.stdout).not.toContain("FAIL");
      expect(npmCalls).toEqual([
        "run validate:s5-sbx:preflight",
        "run recover:s5-sbx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports host-probe recovery binary blockers as blocked instead of repo failures", async () => {
    const tempDir = await makeTempDir();
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    try {
      await writeExecutable(path.join(tempDir, "npm"), fakeAuditNpmScript({ recoveryStage: "binary" }));

      const result = await runScript(["scripts/audit-s5-sbx-readiness.mjs", "--host-probes"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        NPM_CALL_LOG: npmCallLog
      }, 15_000);
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("BLOCKED host recovery dry-run remains non-mutating");
      expect(result.stdout).toContain("host sbx binary preflight did not pass");
      expect(result.stdout).not.toContain("FAIL");
      expect(npmCalls).toEqual([
        "run validate:s5-sbx:preflight",
        "run recover:s5-sbx-daemon"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("refuses recovery apply when active sbx exec sessions are present without the interruption gate", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(3);
      expect(result.stdout).toContain("command_output=redacted");
      expect(result.stderr).toContain("OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1");
      expect(result.stderr).toContain("active_session_interruption_approval_phrase=승인:");
      expect(result.stderr).toContain("active_sbx_exec_sessions=1");
      expect(result.stderr).toContain("active_sbx_app_server_sessions=1");
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls"
      ]);
      expect(sbxCalls).not.toContain("daemon stop");
      expect(sbxCalls).not.toContain("daemon start --detach");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects the unrelated system sdx utility before recovery daemon inspection or restart", async () => {
    const tempDir = await makeTempDir();
    const callLog = path.join(tempDir, "sdx-recovery-calls.log");
    const fakeSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeSdx, fakeSdxScript());

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply"], {
        OUROBOROS_SBX_BIN: fakeSdx,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1",
        SBX_CALL_LOG: callLog
      });
      const calls = (await readFile(callLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(4);
      expect(result.stdout).toContain("sbx version");
      expect(result.stderr).toContain("does not look like the Docker Sandboxes sbx CLI");
      expect(calls).toEqual(["version"]);
      expect(calls.some((call) => (
        call.startsWith("daemon ") || call.startsWith("diagnose ") || call.startsWith("ls")
      ))).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("supports OUROBOROS_SDX_BIN for recovery when the alias is Docker Sandboxes-compatible", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sdx-recovery-alias-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeAliasedSdx, fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir
      });
      const calls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("No changes made.");
      expect(result.stdout).toContain(`OUROBOROS_SDX_BIN='${fakeAliasedSdx}'`);
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon -- --apply");
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon:validate");
      expect(result.stderr).not.toContain("not the system sdx/Starkit utility");
      expect(calls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("prints both recovery apply gates in dry-run output when active sbx exec sessions are present", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("No changes made.");
      expect(result.stdout).toContain("active sbx session summary");
      expect(result.stdout).toContain("active_sbx_exec_sessions=1");
      expect(result.stdout).toContain("active_sbx_app_server_sessions=1");
      expect(result.stdout).toContain("active_sbx_exec_session_names=active-sandbox");
      expect(result.stdout).toContain("active_sbx_app_server_session_names=active-sandbox");
      expect(result.stdout).toContain("active_session_interruption_gate_required=true");
      expect(result.stdout).toContain("active_session_interruption_approval_phrase=승인:");
      expect(result.stdout).toContain("OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1");
      expect(result.stdout).toContain("OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1");
      expect(result.stdout).toContain("npm run recover:s5-sbx-daemon:validate");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("documents recovery validation transcript configuration in help output", async () => {
    const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("OUROBOROS_SBX_EVIDENCE_PATH");
    expect(result.stdout).toContain("OUROBOROS_SBX_HOME");
    expect(result.stdout).toContain("OUROBOROS_SDX_BIN");
    expect(result.stdout).toContain("OUROBOROS_SBX_RUNTIME_STATE_DIR");
    expect(result.stdout).toContain("OUROBOROS_SBX_POST_RECOVERY_VALIDATE_TIMEOUT_MS");
    expect(result.stdout).toContain("OUROBOROS_SBX_POST_RECOVERY_PROMOTION_AUDIT_TIMEOUT_MS");
    expect(result.stdout).toContain("Requires Docker Sandboxes sbx");
    expect(result.stdout).toContain("/usr/bin/sdx Starkit utility is unrelated");
    expect(result.stdout).toContain("validation transcript path for --validate-after-apply");
    expect(result.stdout).toContain("validation, completion audit, and promotion audit");
    expect(result.stdout).toContain("sbx exec/app-server session counts");
    expect(result.stdout).toContain("Docker-compatible socket");
    expect(result.stdout).toContain("does not run sbx reset");
    expect(result.stdout).toContain("stored secrets");
    expect(result.stdout).toContain("npm run recover:s5-sbx-daemon:validate");
    expect(result.stdout).toContain("Human approval phrase for default-daemon active-session interruption");
    expect(result.stdout).toContain("승인: active sbx exec app-server");
    expect(result.stdout).toContain("--probe-create-path");
    expect(result.stdout).toContain("OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
    expect(result.stdout).toContain("does not copy Docker Sandboxes auth stores or secretpass files");
  });

  it("refuses the direct create-path probe without an explicit create-probe gate", async () => {
    const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--probe-create-path"], {});

    expect(result.code, scriptOutput(result)).toBe(8);
    expect(result.stderr).toContain("OUROBOROS_ALLOW_SBX_CREATE_PROBE=1");
  });

  it("runs the direct create-path probe only when explicitly gated", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--probe-create-path"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_CREATE_PROBE: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("sbx direct create-path probe");
      expect(result.stdout).toContain("direct_create_probe_scope=temporary_unique_sandbox_only");
      expect(result.stdout).toContain("direct_create_probe_result=passed");
      expect(result.stdout).toContain("No changes made.");
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls",
        expect.stringMatching(/^create --name ouro-s5-direct-probe-\d+ shell /),
        expect.stringMatching(/^exec ouro-s5-direct-probe-\d+ sh -lc echo s5-direct-create-probe-ok$/),
        expect.stringMatching(/^rm --force ouro-s5-direct-probe-\d+$/)
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("reports the direct create-path probe as blocked when create depends on broken runtime listing", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript({ directCreateFails: true }));
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--probe-create-path"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_CREATE_PROBE: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(9);
      expect(result.stdout).toContain("sbx direct create-path probe");
      expect(result.stdout).toContain("direct_create_probe_result=blocked");
      expect(result.stderr).toContain("failed to check if sandbox exists");
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls",
        expect.stringMatching(/^create --name ouro-s5-direct-probe-\d+ shell /)
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes OUROBOROS_SBX_HOME to recovery sbx commands", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const sbxHome = path.join(tempDir, "isolated-sbx-home");
    const runtimeStateDir = path.join(
      sbxHome,
      "Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/runtimes"
    );
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir, { recursive: true });

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        SBX_EXPECT_HOME: sbxHome,
        OUROBOROS_SBX_HOME: sbxHome
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain(`sbx_home=${sbxHome}`);
      expect(result.stdout).toContain("active_session_interruption_gate_required=false");
      expect(result.stdout).toContain("active_session_interruption_gate_scope=skipped_for_isolated_sbx_home");
      expect(result.stdout).toContain(`runtime_state_dir=${runtimeStateDir}`);
      expect(result.stdout).toContain("metadata_status=no_runtime_metadata");
      expect(result.stdout).not.toContain("active_session_interruption_approval_phrase=");
      expect(result.stdout).toContain("No changes made.");
      expect(result.stdout).toContain(
        `OUROBOROS_SBX_HOME='${sbxHome}' OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 ` +
          "npm run recover:s5-sbx-daemon -- --apply"
      );
      expect(result.stdout).toContain(
        `OUROBOROS_SBX_HOME='${sbxHome}' OUROBOROS_ALLOW_SBX_DAEMON_RESTART=1 ` +
          "npm run recover:s5-sbx-daemon:validate"
      );
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("prints the isolated sbx home login command when isolated runtime control is unauthenticated", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const sbxHome = path.join(tempDir, "isolated sbx home");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    const runtimeStateDir = path.join(
      sbxHome,
      "Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/runtimes"
    );
    try {
      await writeExecutable(fakeAliasedSdx, fakeRecoverySbxScript({ authFailure: true }));
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir, { recursive: true });

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        SBX_EXPECT_HOME: sbxHome,
        OUROBOROS_SBX_HOME: sbxHome
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("sbx_runtime_control_blocker=authentication");
      expect(result.stdout).toContain("isolated_sbx_home_auth_required=true");
      expect(result.stdout).toContain(
        `isolated_sbx_home_login_command=HOME='${sbxHome}' '${fakeAliasedSdx}' login`
      );
      expect(result.stdout).toContain(
        `isolated_sbx_home_recovery_command=OUROBOROS_SBX_HOME='${sbxHome}' OUROBOROS_SDX_BIN='${fakeAliasedSdx}'`
      );
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon -- --apply");
      expect(result.stdout).toContain(
        `isolated_sbx_home_resume_command=OUROBOROS_SBX_HOME='${sbxHome}' OUROBOROS_SDX_BIN='${fakeAliasedSdx}'`
      );
      expect(result.stdout).toContain("npm run recover:s5-sdx-daemon:validate");
      expect(result.stdout).toContain(
        `isolated_sbx_home_validate_command=OUROBOROS_SBX_HOME='${sbxHome}' OUROBOROS_SDX_BIN='${fakeAliasedSdx}'`
      );
      expect(result.stdout).toContain("npm run validate:s5-sdx");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("allows isolated sbx home recovery apply without the default active-session interruption gate", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const sbxHome = path.join(tempDir, "isolated-sbx-home");
    const runtimeStateDir = path.join(
      sbxHome,
      "Library/Application Support/com.docker.sandboxes/sandboxes/sandboxd/runtimes"
    );
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir, { recursive: true });

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        SBX_EXPECT_HOME: sbxHome,
        OUROBOROS_SBX_HOME: sbxHome,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("active_sbx_exec_sessions=1");
      expect(result.stdout).toContain("active_session_interruption_gate_required=false");
      expect(result.stdout).toContain("active_session_interruption_gate_scope=skipped_for_isolated_sbx_home");
      expect(result.stderr).not.toContain("OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION=1");
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls",
        "daemon stop",
        "daemon start --detach",
        "daemon status",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("summarizes stale recovery runtime metadata without printing embedded credentials", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    const presentWorkspace = path.join(tempDir, "present-workspace");
    const missingWorkspace = path.join(tempDir, "missing-workspace");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);
      await mkdir(presentWorkspace);
      await writeFile(
        path.join(runtimeStateDir, "stale-runtime.json"),
        JSON.stringify({
          Spec: {
            RuntimeName: "stale-runtime",
            WorkspaceDir: missingWorkspace,
            AdditionalWorkspaces: [{ dir: presentWorkspace }],
            Credentials: {
              Values: [{ service: "github", value: "gho_should_not_be_printed" }]
            }
          },
          State: {
            NetworkName: "stale-runtime-network"
          }
        }),
        "utf8"
      );

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("runtime metadata path check");
      expect(result.stdout).toContain("runtime=stale-runtime");
      expect(result.stdout).toContain(`workspace=missing path=${missingWorkspace}`);
      expect(result.stdout).toContain(`additional_workspace_1=present path=${presentWorkspace}`);
      expect(result.stdout).toContain("network=stale-runtime-network");
      expect(result.stdout).not.toContain("gho_should_not_be_printed");
      expect(result.stdout).not.toContain("Credentials");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("summarizes daemon log runtime-control hints without printing raw metadata", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    const workspace = path.join(tempDir, "workspace");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);
      await mkdir(workspace);
      await writeFile(
        path.join(runtimeStateDir, "stale-runtime.json"),
        JSON.stringify({
          Spec: {
            RuntimeName: "stale-runtime",
            WorkspaceDir: workspace,
            Credentials: {
              Values: [{ service: "github", value: "gho_should_not_be_printed" }]
            }
          },
          State: {
            NetworkName: "stale-runtime"
          }
        }),
        "utf8"
      );
      await writeFile(
        path.join(tempDir, "daemon.log"),
        [
          JSON.stringify({
            time: "2026-05-09T11:14:32.120403+09:00",
            level: "WARN",
            msg: "failed to create SDK client for runtime",
            runtime: "stale-runtime",
            error: "create SDK client: health check: context canceled"
          }),
          JSON.stringify({
            time: "2026-05-09T20:51:25.391079+09:00",
            level: "WARN",
            msg: "runtime denied by mount policy",
            runtime: "stale-runtime",
            message: "mount policy denied"
          }),
          JSON.stringify({
            time: "2026-05-09T20:51:25.391806+09:00",
            level: "INFO",
            msg: "API request start",
            source: "containerd",
            request_id: 10494,
            path: "/v1.53/containers/stale-runtime/stop",
            method: "POST"
          }),
          JSON.stringify({
            time: "2026-05-11T02:41:09.041341+09:00",
            level: "INFO",
            msg: "API request start",
            source: "containerd",
            request_id: 12223,
            path: "/v1.53/containers/stale-runtime/json",
            method: "GET"
          }),
          JSON.stringify({
            time: "2026-05-11T02:41:12.041341+09:00",
            level: "INFO",
            msg: "API request start",
            source: "containerd",
            request_id: 12224,
            path: "/v1.53/containers/stale-runtime/json",
            method: "GET"
          }),
          JSON.stringify({
            time: "2026-05-11T02:41:12.041899+09:00",
            level: "INFO",
            msg: "API request end",
            source: "containerd",
            request_id: 12224,
            path: "/v1.53/containers/stale-runtime/json",
            method: "GET",
            status: 200
          })
        ].join("\n"),
        "utf8"
      );

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("daemon log runtime-control hints");
      expect(result.stdout).toContain("runtime=stale-runtime");
      expect(result.stdout).toContain("sdk_client_health_check_failures=1");
      expect(result.stdout).toContain("last_sdk_client_health_check_failure_at=2026-05-09T11:14:32.120403+09:00");
      expect(result.stdout).toContain("mount_policy_denials=1");
      expect(result.stdout).toContain("container_inspect_requests_without_end=1");
      expect(result.stdout).toContain("container_inspect_request_ids_without_end=12223");
      expect(result.stdout).toContain("first_container_inspect_requests_without_end_started_at=2026-05-11T02:41:09.041341+09:00");
      expect(result.stdout).toContain("last_container_inspect_requests_without_end_started_at=2026-05-11T02:41:09.041341+09:00");
      expect(result.stdout).toContain("container_stop_requests_without_end=1");
      expect(result.stdout).toContain("container_stop_request_ids_without_end=10494");
      expect(result.stdout).toContain("first_container_stop_requests_without_end_started_at=2026-05-09T20:51:25.391806+09:00");
      expect(result.stdout).toContain("last_container_stop_requests_without_end_started_at=2026-05-09T20:51:25.391806+09:00");
      expect(result.stdout).not.toContain("gho_should_not_be_printed");
      expect(result.stdout).not.toContain("Credentials");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("summarizes Docker-compatible socket runtime probes without printing raw inspect output", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const dockerCallLog = path.join(tempDir, "docker-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    const workspace = path.join(tempDir, "workspace");
    const socketPath = path.join(tempDir, "docker.sock");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "docker"), fakeDockerScript());
      await mkdir(runtimeStateDir);
      await mkdir(workspace);
      await writeFile(
        path.join(runtimeStateDir, "stale-runtime.json"),
        JSON.stringify({
          Spec: {
            RuntimeName: "stale-runtime",
            WorkspaceDir: workspace
          },
          State: {
            NetworkName: "stale-runtime",
            SocketPath: socketPath
          }
        }),
        "utf8"
      );
      await writeFile(path.join(tempDir, "daemon.log"), "", "utf8");

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        DOCKER_CALL_LOG: dockerCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir
      });
      const dockerCalls = (await readFile(dockerCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("docker socket runtime-control probe");
      expect(result.stdout).toContain(`docker_socket=${socketPath}`);
      expect(result.stdout).toContain("docker_server_version=ok");
      expect(result.stdout).toContain("docker_container_list=ok");
      expect(result.stdout).toContain("docker_runtime_inspect=ok");
      expect(result.stdout).toContain("docker_runtime_status=exited");
      expect(result.stdout).toContain("docker_runtime_running=false");
      expect(result.stdout).not.toContain("RawSecretEnv");
      expect(result.stdout).not.toContain("gho_should_not_be_printed");
      expect(dockerCalls).toEqual([
        "version --format {{json .Server}}",
        "container ls --all --format {{json .}}",
        "inspect stale-runtime --format {{json .State}}"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  hostS5LifecycleIt("runs the full validation transcript through two fake sbx-backed instances", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const evidencePath = path.join(tempDir, "s5-sbx-evidence.txt");
    const fakeSbx = path.join(tempDir, "sbx");
    try {
      await writeExecutable(fakeSbx, fakeFullLifecycleSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSbx,
        OUROBOROS_SBX_HOME: path.join(tempDir, "isolated-sbx-home"),
        OUROBOROS_SBX_VALIDATE_PORT: String(await findFreePort()),
        OUROBOROS_SBX_VALIDATE_TIMEOUT_MS: "2000",
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        SBX_EXPECT_HOME: path.join(tempDir, "isolated-sbx-home"),
        SBX_CALL_LOG: sbxCallLog
      }, s5LifecycleScriptTimeoutMs);
      const calls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");
      const evidence = await readFile(evidencePath, "utf8");
      const completionAudit = await runScript([
        "scripts/audit-s5-sbx-completion.mjs",
        "--evidence",
        evidencePath
      ], {}, 10_000);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("RESULT: passed");
      expect(completionAudit.code, scriptOutput(completionAudit)).toBe(0);
      expect(completionAudit.stdout).toContain("COMPLETION_AUDIT_RESULT complete");
      expect(evidence).toContain(`evidence transcript: ${evidencePath}`);
      expect(evidence).toContain(`sbx home: ${path.join(tempDir, "isolated-sbx-home")}`);
      expect(evidence).toContain("runtime API start A command evidence");
      expect(evidence).toContain("runtime API stop A response");
      expect(evidence).toContain("runtime API logs B");
      expect(evidence).toContain("$ " + fakeSbx + " rm --force ouro-s5-clock-b");
      expect(evidence).toContain("RESULT: passed");
      expect(result.stdout).toContain("runtime API start A command evidence");
      expect(result.stdout).toContain("runtime API stop B command evidence");
      expect(calls.filter((call) => call === "version").length).toBeGreaterThanOrEqual(3);
      expect(calls).toContain("create --name ouro-s5-clock-a shell " + repoRoot);
      expect(calls).toContain("create --name ouro-s5-clock-b shell " + repoRoot);
      expect(calls.slice(0, calls.indexOf("create --name ouro-s5-clock-a shell " + repoRoot))).toContain("version");
      expect(calls.slice(
        calls.indexOf("create --name ouro-s5-clock-a shell " + repoRoot) + 1,
        calls.indexOf("create --name ouro-s5-clock-b shell " + repoRoot)
      )).toContain("version");
      expect(calls).toContain("ls");
      expect(calls.some((call) => call.startsWith(
        `exec -d -w ${repoRoot} ouro-s5-clock-a python3 fixtures/trading-systems/clock.py`
      ))).toBe(true);
      expect(calls.some((call) => call.startsWith(
        `exec -d -w ${repoRoot} ouro-s5-clock-b python3 fixtures/trading-systems/clock.py`
      ))).toBe(true);
      expect(calls).toContain(
        "exec ouro-s5-clock-a cat /tmp/ouroboros-sandbox-runtime-instance-clock-a.jsonl"
      );
      expect(calls).toContain(
        "exec ouro-s5-clock-b cat /tmp/ouroboros-sandbox-runtime-instance-clock-b.jsonl"
      );
      expect(calls).toContain(
        "exec ouro-s5-clock-a cat /tmp/ouroboros-sandbox-runtime-instance-clock-a.heartbeat.json"
      );
      expect(calls).toContain(
        "exec ouro-s5-clock-b cat /tmp/ouroboros-sandbox-runtime-instance-clock-b.heartbeat.json"
      );
      expect(calls).toContain("exec ouro-s5-clock-a pkill -TERM -f fixtures/trading-systems/clock.py");
      expect(calls).toContain("exec ouro-s5-clock-b pkill -TERM -f fixtures/trading-systems/clock.py");
      expect(calls.filter((call) => call === "stop ouro-s5-clock-a")).toHaveLength(1);
      expect(calls.filter((call) => call === "stop ouro-s5-clock-b")).toHaveLength(1);
      expect(calls).toContain("rm --force ouro-s5-clock-a");
      expect(calls).toContain("rm --force ouro-s5-clock-b");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, s5LifecycleTestTimeoutMs);

  hostS5LifecycleIt("can suffix validation sandbox names to avoid stale runtime-name collisions", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-suffixed-calls.log");
    const evidencePath = path.join(tempDir, "s5-sbx-suffixed-evidence.txt");
    const fakeSbx = path.join(tempDir, "sbx");
    try {
      await writeExecutable(fakeSbx, fakeFullLifecycleSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSbx,
        OUROBOROS_SBX_HOME: path.join(tempDir, "isolated-sbx-home"),
        OUROBOROS_SBX_VALIDATE_NAME_SUFFIX: "nightly.001",
        OUROBOROS_SBX_VALIDATE_PORT: String(await findFreePort()),
        OUROBOROS_SBX_VALIDATE_TIMEOUT_MS: "2000",
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        SBX_EXPECT_HOME: path.join(tempDir, "isolated-sbx-home"),
        SBX_CALL_LOG: sbxCallLog
      }, s5LifecycleScriptTimeoutMs);
      const calls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");
      const evidence = await readFile(evidencePath, "utf8");
      const completionAudit = await runScript([
        "scripts/audit-s5-sbx-completion.mjs",
        "--evidence",
        evidencePath
      ], {}, 10_000);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(completionAudit.code, scriptOutput(completionAudit)).toBe(0);
      expect(evidence).toContain("sandbox name suffix: nightly.001");
      expect(evidence).toContain("sandbox A name: ouro-s5-clock-a-nightly.001");
      expect(evidence).toContain("sandbox B name: ouro-s5-clock-b-nightly.001");
      expect(calls).toContain("create --name ouro-s5-clock-a-nightly.001 shell " + repoRoot);
      expect(calls).toContain("create --name ouro-s5-clock-b-nightly.001 shell " + repoRoot);
      expect(calls).toContain("rm --force ouro-s5-clock-a-nightly.001");
      expect(calls).toContain("rm --force ouro-s5-clock-b-nightly.001");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, s5LifecycleTestTimeoutMs);

  hostS5LifecycleIt("classifies real sbx create VM failures as host blockers", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-create-failure-calls.log");
    const fakeSbx = path.join(tempDir, "sbx");
    try {
      await writeExecutable(fakeSbx, fakeCreateKrunFailureSbxScript());

      const result = await runValidation({
        OUROBOROS_SBX_BIN: fakeSbx,
        OUROBOROS_SBX_HOME: path.join(tempDir, "isolated-sbx-home"),
        OUROBOROS_SBX_VALIDATE_PORT: String(await findFreePort()),
        OUROBOROS_SBX_VALIDATE_TIMEOUT_MS: "2000",
        SBX_EXPECT_HOME: path.join(tempDir, "isolated-sbx-home"),
        SBX_CALL_LOG: sbxCallLog
      }, s5LifecycleScriptTimeoutMs);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("sbx_runtime_control_blocker=runtime_create_failed");
      expect(result.stdout).toContain("isolated_sbx_home_authenticated=true");
      expect(result.stdout).toContain("isolated_sbx_runtime_create_blocked=true");
      expect(result.stderr).toContain("host sandbox create blocked");
      expect(result.stderr).toContain("krun_start_enter failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, s5LifecycleTestTimeoutMs);

  it("allows recovery apply with both explicit daemon restart gates", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls",
        "daemon stop",
        "daemon start --detach",
        "daemon status",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails recovery apply when runtime listing is still broken after daemon restart", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript({ listRecoversAfterRestart: false }));
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const sbxCalls = (await readFile(sbxCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(5);
      expect(result.stderr).toContain("runtime listing is still failing");
      expect(sbxCalls).toEqual([
        "version",
        "daemon status",
        "diagnose --output json",
        "ls",
        "daemon stop",
        "daemon start --detach",
        "daemon status",
        "ls"
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("can run S5 validation automatically after successful recovery apply", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeNpmScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply", "--validate-after-apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");
      const [npmCall, validationEvidencePath] = npmCalls[0].split("|");
      const [completionAuditCall, completionAuditEvidencePath] = npmCalls[1].split("|");
      const [promotionAuditCall, promotionAuditEvidencePath] = npmCalls[2].split("|");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("npm run validate:s5-sbx");
      expect(result.stdout).toContain("npm run audit:s5-sbx:completion");
      expect(result.stdout).toContain("npm run audit:s5-sbx:promotion");
      expect(result.stdout).toContain("post-recovery S5 completion audit passed");
      expect(result.stdout).toContain("post-recovery S5 promotion audit passed");
      expect(npmCall).toBe("run validate:s5-sbx");
      expect(validationEvidencePath.startsWith(
        path.join(repoRoot, ".ouroboros/s5-sbx-evidence", "validate-")
      )).toBe(true);
      expect(validationEvidencePath.endsWith(".log")).toBe(true);
      expect(completionAuditCall).toBe(`run audit:s5-sbx:completion -- --evidence ${validationEvidencePath}`);
      expect(completionAuditEvidencePath).toBe(validationEvidencePath);
      expect(promotionAuditCall).toBe(`run audit:s5-sbx:promotion -- --evidence ${validationEvidencePath}`);
      expect(promotionAuditEvidencePath).toBe(validationEvidencePath);
      expect(result.stdout).toContain(`validation evidence transcript: ${validationEvidencePath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses s5-sdx npm aliases for automatic validation after sdx recovery apply", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sdx-sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    const fakeAliasedSdx = path.join(tempDir, "sdx");
    try {
      await writeExecutable(fakeAliasedSdx, fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeNpmScript());
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply", "--validate-after-apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        OUROBOROS_SDX_BIN: fakeAliasedSdx,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");
      const [validationCall, validationEvidencePath] = npmCalls[0].split("|");

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("npm run validate:s5-sdx");
      expect(result.stdout).toContain("npm run audit:s5-sdx:completion");
      expect(result.stdout).toContain("npm run audit:s5-sdx:promotion");
      expect(validationCall).toBe("run validate:s5-sdx");
      expect(npmCalls[1]).toBe(`run audit:s5-sdx:completion -- --evidence ${validationEvidencePath}|${validationEvidencePath}`);
      expect(npmCalls[2]).toBe(`run audit:s5-sdx:promotion -- --evidence ${validationEvidencePath}|${validationEvidencePath}`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails recovery apply when automatic S5 validation fails after restart", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "post-recovery-validation.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeNpmScript({ shouldFail: true }));
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply", "--validate-after-apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(6);
      expect(result.stderr).toContain("post-recovery S5 validation failed");
      expect(result.stdout).toContain(`validation evidence transcript: ${evidencePath}`);
      expect(result.stdout).toContain("npm run audit:s5-sbx:completion");
      expect(result.stdout).toContain("npm run audit:s5-sbx:promotion");
      expect(npmCalls).toEqual([
        `run validate:s5-sbx|${evidencePath}`,
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}|${evidencePath}`,
        `run audit:s5-sbx:promotion -- --evidence ${evidencePath}|${evidencePath}`
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails recovery apply when post-validation completion audit fails", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "post-recovery-validation.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeNpmScript({ completionShouldFail: true }));
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply", "--validate-after-apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(7);
      expect(result.stderr).toContain("post-recovery S5 completion audit failed");
      expect(result.stdout).toContain(`validation evidence transcript: ${evidencePath}`);
      expect(npmCalls).toEqual([
        `run validate:s5-sbx|${evidencePath}`,
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}|${evidencePath}`,
        `run audit:s5-sbx:promotion -- --evidence ${evidencePath}|${evidencePath}`
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails recovery apply when post-validation promotion audit fails", async () => {
    const tempDir = await makeTempDir();
    const sbxCallLog = path.join(tempDir, "sbx-calls.log");
    const pgrepCallLog = path.join(tempDir, "pgrep-calls.log");
    const npmCallLog = path.join(tempDir, "npm-calls.log");
    const evidencePath = path.join(tempDir, "post-recovery-validation.log");
    const runtimeStateDir = path.join(tempDir, "runtimes");
    try {
      await writeExecutable(path.join(tempDir, "sbx"), fakeRecoverySbxScript());
      await writeExecutable(path.join(tempDir, "pgrep"), fakePgrepScript());
      await writeExecutable(path.join(tempDir, "npm"), fakeNpmScript({ promotionShouldFail: true }));
      await mkdir(runtimeStateDir);

      const result = await runScript(["scripts/recover-s5-sbx-daemon.mjs", "--apply", "--validate-after-apply"], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        SBX_CALL_LOG: sbxCallLog,
        PGREP_CALL_LOG: pgrepCallLog,
        NPM_CALL_LOG: npmCallLog,
        OUROBOROS_SBX_RUNTIME_STATE_DIR: runtimeStateDir,
        OUROBOROS_SBX_EVIDENCE_PATH: evidencePath,
        OUROBOROS_ALLOW_SBX_DAEMON_RESTART: "1",
        OUROBOROS_ALLOW_ACTIVE_SBX_SESSION_INTERRUPTION: "1"
      });
      const npmCalls = (await readFile(npmCallLog, "utf8")).trim().split("\n");

      expect(result.code, scriptOutput(result)).toBe(8);
      expect(result.stderr).toContain("post-recovery S5 promotion audit failed");
      expect(result.stdout).toContain(`validation evidence transcript: ${evidencePath}`);
      expect(npmCalls).toEqual([
        `run validate:s5-sbx|${evidencePath}`,
        `run audit:s5-sbx:completion -- --evidence ${evidencePath}|${evidencePath}`,
        `run audit:s5-sbx:promotion -- --evidence ${evidencePath}|${evidencePath}`
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function runValidation(env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;
function runValidation(env: Record<string, string>, timeoutMs: number): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;
function runValidation(env: Record<string, string>, timeoutMs = 10_000): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return runScript(["scripts/validate-s5-sbx-runtime.mjs"], {
    OUROBOROS_SBX_VALIDATE_TIMEOUT_MS: defaultS5ValidationCommandTimeoutMs,
    ...env
  }, timeoutMs);
}

function runScript(args: string[], env: Record<string, string>): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;
function runScript(args: string[], env: Record<string, string>, timeoutMs: number): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;
function runScript(args: string[], env: Record<string, string>, timeoutMs = 5_000): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`script test timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeExecutable(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, "utf8");
  await chmod(filePath, 0o755);
}

async function writeFakeReportHostDiagnosticScripts(tempDir: string): Promise<void> {
  await writeExecutable(path.join(tempDir, "codesign"), fakeReportCodesignScript());
  await writeExecutable(path.join(tempDir, "spctl"), fakeReportSpctlScript());
  await writeExecutable(path.join(tempDir, "xattr"), fakeReportXattrScript());
  await writeExecutable(path.join(tempDir, "ls"), fakeReportLsScript());
  await writeExecutable(path.join(tempDir, "log"), fakeReportLogScript());
}

function makeTempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "ouroboros-s5-validation-test-"));
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("failed to allocate a free TCP port"));
        }
      });
    });
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

function fakeSbxScript(): string {
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
case "$1" in
  version)
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    exit 0
    ;;
  diagnose)
    echo '{"summary":{"pass":7,"warn":0,"fail":0,"skip":0}}'
    exit 0
    ;;
  daemon)
    if [ "$2" = "status" ]; then
      echo "Status: running"
      exit 0
    fi
    ;;
  ls)
    echo 'ERROR: failed to list runtimes: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
    exit 1
    ;;
esac
echo "unexpected sbx command: $*" >&2
exit 7
`;
}

function fakeSdxScript(): string {
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
case "$1" in
  version)
    echo "sdx 2.0 Starkit Developer eXtension"
    exit 0
    ;;
esac
echo "unexpected sdx command: $*" >&2
exit 7
`;
}

function fakeRecoverySbxScript(options: {
  listRecoversAfterRestart?: boolean;
  directCreateFails?: boolean;
  authFailure?: boolean;
} = {}): string {
  const listRecoversAfterRestart = options.listRecoversAfterRestart ?? true;
  const directCreateFails = options.directCreateFails ?? false;
  const authFailure = options.authFailure ?? false;
  return `#!/bin/sh
if [ -n "\${SBX_EXPECT_HOME:-}" ] && [ "\${HOME:-}" != "$SBX_EXPECT_HOME" ]; then
  echo "unexpected HOME: \${HOME:-}" >&2
  exit 66
fi
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
case "$1" in
  version)
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    exit 0
    ;;
esac
case "$1 $2" in
  "daemon status")
    echo "Status: running"
    exit 0
    ;;
  "daemon stop")
    echo "Status: stopped"
    exit 0
    ;;
  "daemon start")
    echo "Status: started"
    touch "$SBX_CALL_LOG.daemon-started"
    exit 0
    ;;
esac
case "$1" in
  diagnose)
    echo '{"summary":{"pass":7,"warn":0,"fail":0,"skip":0}}'
    exit 0
    ;;
  ls)
    if [ "${authFailure ? "yes" : "no"}" = "yes" ]; then
      echo 'ERROR: failed to list runtimes: list runtimes: sandboxd error: status 401: user is not authenticated to Docker: no default account profile set: secret not found' >&2
      echo 'no valid user session found, please sign in to Docker to proceed' >&2
      exit 1
    fi
    if [ "${listRecoversAfterRestart ? "yes" : "no"}" = "yes" ] && [ -f "$SBX_CALL_LOG.daemon-started" ]; then
      echo "NAME AGENT STATUS WORKSPACE"
      exit 0
    fi
    echo 'ERROR: failed to list runtimes: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
    exit 1
    ;;
  create)
    if [ "${directCreateFails ? "yes" : "no"}" = "yes" ]; then
      echo 'ERROR: failed to check if sandbox exists: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
      exit 1
    fi
    echo "created $3"
    exit 0
    ;;
  exec)
    echo "s5-direct-create-probe-ok"
    exit 0
    ;;
  rm)
    echo "removed $3"
    exit 0
    ;;
esac
echo "unexpected sbx command: $*" >&2
exit 7
`;
}

function fakeFullLifecycleSbxScript(): string {
  return `#!/bin/sh
set -eu
if [ -n "\${SBX_EXPECT_HOME:-}" ] && [ "\${HOME:-}" != "$SBX_EXPECT_HOME" ]; then
  echo "unexpected HOME: \${HOME:-}" >&2
  exit 66
fi
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
instance_id_for_args() {
  case "$*" in
    *sandbox-runtime-instance-clock-a*) printf '%s' "sandbox-runtime-instance-clock-a" ;;
    *sandbox-runtime-instance-clock-b*) printf '%s' "sandbox-runtime-instance-clock-b" ;;
    *) printf '%s' "sandbox-runtime-instance-unknown" ;;
  esac
}
case "$1" in
  version)
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    exit 0
    ;;
  diagnose)
    echo '{"summary":{"pass":7,"warn":0,"fail":0,"skip":0}}'
    exit 0
    ;;
  daemon)
    if [ "$2" = "status" ]; then
      echo "Status: running"
      exit 0
    fi
    ;;
  ls)
    echo "NAME AGENT STATUS WORKSPACE"
    if [ -f "$SBX_CALL_LOG.sandboxes" ]; then
      while IFS= read -r sandbox_name; do
        echo "$sandbox_name shell running $PWD"
      done < "$SBX_CALL_LOG.sandboxes"
    fi
    exit 0
    ;;
  create)
    printf '%s\\n' "$3" >> "$SBX_CALL_LOG.sandboxes"
    echo "created $3"
    exit 0
    ;;
  exec)
    if [ "$2" = "-d" ]; then
      echo "detached $3"
      exit 0
    fi
    if [ "$3" = "cat" ]; then
      instance_id="$(instance_id_for_args "$*")"
      case "$4" in
        *.jsonl)
          state_file="$SBX_CALL_LOG.$instance_id.log-read"
          ;;
        *.heartbeat.json)
          state_file="$SBX_CALL_LOG.$instance_id.heartbeat-read"
          ;;
        *)
          state_file="$SBX_CALL_LOG.$instance_id.read"
          ;;
      esac
      if [ ! -f "$state_file" ]; then
        touch "$state_file"
        exit 0
      fi
      printf '{"event":"runtime_heartbeat","instance_id":"%s","tick":1,"at":"2026-05-10T00:00:00.000Z"}\\n' "$instance_id"
      exit 0
    fi
    if [ "$3" = "pkill" ]; then
      echo "terminated $2"
      exit 0
    fi
    ;;
  stop)
    echo "stopped $2"
    exit 0
    ;;
  rm)
    echo "removed $3"
    exit 0
    ;;
esac
echo "unexpected sbx command: $*" >&2
exit 7
`;
}

function fakeCreateKrunFailureSbxScript(): string {
  return `#!/bin/sh
set -eu
if [ -n "\${SBX_EXPECT_HOME:-}" ] && [ "\${HOME:-}" != "$SBX_EXPECT_HOME" ]; then
  echo "unexpected HOME: \${HOME:-}" >&2
  exit 66
fi
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
case "$1" in
  version)
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    exit 0
    ;;
  diagnose)
    echo '{"summary":{"pass":7,"warn":0,"fail":0,"skip":0}}'
    exit 0
    ;;
  daemon)
    if [ "$2" = "status" ]; then
      echo "Status: running"
      exit 0
    fi
    ;;
  ls)
    echo "No sandboxes found"
    exit 0
    ;;
  create)
    echo "INFO: Configuring Docker" >&2
    echo "ERROR: create sandbox: create sandbox: run sandbox: start container: container start: Error response from daemon: creating containerd task for container fake: failed to create shim task: failure running vm: krun_start_enter failed: -1" >&2
    exit 1
    ;;
  stop)
    echo "Error: sandbox '$2' not found" >&2
    exit 1
    ;;
  rm)
    echo "Error: sandbox '$3' not found" >&2
    exit 1
    ;;
esac
echo "unexpected sbx command: $*" >&2
exit 7
`;
}

function fakePgrepScript(): string {
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$PGREP_CALL_LOG"
echo "123 sbx exec -i active-sandbox codex app-server"
exit 0
`;
}

function fakeReportSbxScript(): string {
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$SBX_CALL_LOG"
case "$*" in
  "version")
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    exit 0
    ;;
  "diagnose --output github-issue")
    echo "### sbx diagnose report"
    echo "| Daemon | ✓ | healthy |"
    echo "| Authentication | ✓ | authenticated |"
    exit 0
    ;;
  "create --help")
    echo "Usage: sbx create [flags] AGENT PATH [PATH...]"
    echo "      --cpus int          Number of CPUs to allocate to the sandbox"
    echo "  -m, --memory string     Memory limit in binary units"
    echo "  -t, --template string   Container image to use for the sandbox"
    exit 0
    ;;
  "template ls")
    echo "REPOSITORY                 TAG            IMAGE ID"
    echo "docker/sandbox-templates   shell-docker   455eeee3b6aa"
    exit 0
    ;;
  "ls --json")
    echo 'ERROR: failed to list runtimes: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
    exit 1
    ;;
esac
echo "unexpected sbx command: $*" >&2
exit 7
`;
}

function fakeReportNpmScript(): string {
  return `#!/bin/sh
printf '%s|%s\\n' "$*" "\${OUROBOROS_SBX_EVIDENCE_PATH:-}" >> "$NPM_CALL_LOG"
case "$*" in
  "run validate:s5-sbx"|"run validate:s5-sdx")
    echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx ls runtime-control probe"
    echo 'ERROR: failed to list runtimes: list runtimes: send request: Get "http://socket/runtime": context canceled'
    echo "RESULT: failed - sbx ls runtime-control probe timed out after 10000ms"
    exit 2
    ;;
  "run audit:s5-sbx:completion -- --evidence "*|"run audit:s5-sdx:completion -- --evidence "*)
    echo "COMPLETION_AUDIT_RESULT incomplete"
    exit 2
    ;;
  "run audit:s5-sbx:promotion -- --evidence "*|"run audit:s5-sdx:promotion -- --evidence "*)
    echo "PROMOTION_AUDIT_RESULT blocked"
    exit 2
    ;;
  "run recover:s5-sbx-daemon"|"run recover:s5-sdx-daemon")
    echo "No changes made."
    echo "active_sbx_exec_sessions=1"
    exit 0
    ;;
  "run recover:s5-sbx-daemon -- --probe-create-path"|"run recover:s5-sdx-daemon -- --probe-create-path")
    echo "sbx direct create-path probe"
    echo "direct_create_probe_result=blocked"
    echo 'ERROR: failed to check if sandbox exists: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
    exit 9
    ;;
esac
echo "unexpected npm command: $*" >&2
exit 7
`;
}

function fakeReportBrewScript(): string {
  return `#!/bin/sh
case "$*" in
  "info docker/tap/sbx")
    echo "==> sbx (Docker Sandboxes): 0.28.3"
    echo "Installed"
    echo "/opt/homebrew/Caskroom/sbx/0.28.3 (106.0MB)"
    exit 0
    ;;
  "outdated --greedy --cask sbx")
    exit 0
    ;;
  "info docker/tap/sbx@nightly")
    echo "==> sbx@nightly (Docker Sandboxes): nightly-202605100422-7fca84a"
    echo "Not installed"
    exit 0
    ;;
esac
echo "unexpected brew command: $*" >&2
exit 7
`;
}

function fakeReportCodesignScript(): string {
  return `#!/bin/sh
for target do :; done
case "$*" in
  *"--verify --strict --verbose=4"*)
    echo "$target: valid on disk"
    echo "$target: satisfies its Designated Requirement"
    exit 0
    ;;
  *"-d --entitlements :-"*)
    echo "Executable=$target"
    echo '<plist><dict><key>com.apple.security.hypervisor</key><true/></dict></plist>'
    exit 0
    ;;
esac
echo "unexpected codesign command: $*" >&2
exit 7
`;
}

function fakeReportSpctlScript(): string {
  return `#!/bin/sh
for target do :; done
echo "$target: internal error in Code Signing subsystem" >&2
exit 1
`;
}

function fakeReportXattrScript(): string {
  return `#!/bin/sh
case "$*" in
  "-lr "*)
    echo "$2/bin/sbx: com.apple.quarantine: 0381;test;;TEST"
    echo "$2/libexec/containerd-shim-nerdbox-v1: com.apple.quarantine: 0381;test;;TEST"
    echo "$2/libexec/lib/libkrun.dylib: com.apple.quarantine: 0381;test;;TEST"
    echo "$2/libexec/nerdbox-kernel-arm64: com.apple.cs.CodeSignature: SHOULD_NOT_APPEAR"
    exit 0
    ;;
esac
echo "unexpected xattr command: $*" >&2
exit 7
`;
}

function fakeReportLsScript(): string {
  return `#!/bin/sh
case "$*" in
  "-ld /private/var/db/DetachedSignatures /var/db/DetachedSignatures")
    echo "ls: /private/var/db/DetachedSignatures: No such file or directory" >&2
    echo "ls: /var/db/DetachedSignatures: No such file or directory" >&2
    exit 1
    ;;
esac
echo "unexpected ls command: $*" >&2
exit 7
`;
}

function fakeReportLogScript(): string {
  return `#!/bin/sh
case "$*" in
  *'process == "syspolicyd" AND ('*)
    echo '2026-05-11 08:30:41.335 E  syspolicyd[672:ac0ef2] [com.apple.syspolicy.exec:default] Unable to initialize qtn_proc: 3'
    echo '2026-05-11 08:30:41.335 E  syspolicyd[672:ac0ef2] [com.apple.syspolicy.exec:default] dispatch_mig_server returned 268435459'
    echo '2026-05-11 08:31:26.245 E  syspolicyd[672:ac13db] [com.apple.libsqlite3:logging-persist] os_unix.c:51044: (2) open(/private/var/db/DetachedSignatures) - No such file or directory'
    echo '2026-05-11 08:31:26.245 E  syspolicyd[672:ac13db] [com.apple.syspolicy:default] Unable to get certificates array: (null)'
    exit 0
    ;;
  *'process == "kernel" AND'*)
    echo '2026-05-11 09:26:54.362 E  kernel[0:ad6ac3] (Sandbox) Sandbox: containerd-shim-nerdbox-v1(28948) deny(1) file-write-data /dev/dtracehelper'
    echo '2026-05-11 09:26:54.383 E  kernel[0:ad6acf] (Sandbox) Sandbox: containerd-shim-nerdbox-v1(28949) deny(1) sysctl-read kern.hv_support'
    exit 0
    ;;
esac
echo "unexpected log command: $*" >&2
exit 7
`;
}

function fakeReportDaemonLog(localPath: string): string {
  return [
    `{"level":"INFO","msg":"created runtime","runtime":"ouro-s5-clock-a","ca_path":"${localPath}/runtimes/proxies/ouro-s5-clock-a/proxy-ca.crt"}`,
    `{"level":"ERROR","msg":"Handler for POST /v1.53/containers/fake/start returned error: creating containerd task for container fake: failed to create shim task: failure running vm: krun_start_enter failed: -1","source":"containerd"}`
  ].join("\n");
}

function fakeSwVersScript(): string {
  return `#!/bin/sh
echo "ProductName:\t\tmacOS"
echo "ProductVersion:\t\t26.4.1"
echo "BuildVersion:\t\t25E253"
`;
}

function fakeUnameScript(): string {
  return `#!/bin/sh
case "$*" in
  "-m")
    echo "arm64"
    exit 0
    ;;
esac
echo "unexpected uname command: $*" >&2
exit 7
`;
}

function fakeSysctlScript(): string {
  return `#!/bin/sh
case "$*" in
  "kern.hv_support")
    echo "kern.hv_support: 1"
    exit 0
    ;;
esac
echo "unexpected sysctl command: $*" >&2
exit 7
`;
}

function fakeNpmScript(options: {
  shouldFail?: boolean;
  completionShouldFail?: boolean;
  promotionShouldFail?: boolean;
} = {}): string {
  const exitCode = options.shouldFail ? 42 : 0;
  const output = options.shouldFail ? "validation failed" : "validation passed";
  const completionAuditExitCode = options.completionShouldFail ? 43 : 0;
  const completionAuditOutput = options.completionShouldFail ? "completion audit failed" : "completion audit passed";
  const promotionAuditExitCode = options.promotionShouldFail ? 44 : 0;
  const promotionAuditOutput = options.promotionShouldFail ? "promotion audit failed" : "promotion audit passed";
  return `#!/bin/sh
printf '%s|%s\\n' "$*" "$OUROBOROS_SBX_EVIDENCE_PATH" >> "$NPM_CALL_LOG"
case "$*" in
  "run validate:s5-sbx"|"run validate:s5-sdx")
    echo "${output}"
    exit ${exitCode}
    ;;
  "run audit:s5-sbx:completion -- --evidence "*|"run audit:s5-sdx:completion -- --evidence "*)
    echo "${completionAuditOutput}"
    exit ${completionAuditExitCode}
    ;;
  "run audit:s5-sbx:promotion -- --evidence "*|"run audit:s5-sdx:promotion -- --evidence "*)
    echo "${promotionAuditOutput}"
    exit ${promotionAuditExitCode}
    ;;
esac
echo "unexpected npm command: $*" >&2
exit 7
`;
}

function fakePromotionNpmScript(options: { readinessExitCode?: number; completionExitCode?: number } = {}): string {
  const readinessExitCode = options.readinessExitCode ?? 0;
  const completionExitCode = options.completionExitCode ?? 0;
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$NPM_CALL_LOG"
case "$*" in
  "run audit:s5-sbx"|"run audit:s5-sdx")
    echo "readiness audit"
    exit ${readinessExitCode}
    ;;
  "run audit:s5-sbx -- --host-probes"|"run audit:s5-sdx -- --host-probes")
    echo "readiness host audit"
    exit ${readinessExitCode}
    ;;
  "run audit:s5-sbx:completion -- --evidence "*|"run audit:s5-sdx:completion -- --evidence "*)
    echo "completion audit"
    exit ${completionExitCode}
    ;;
  "run audit:s5-sbx:completion"|"run audit:s5-sdx:completion")
    echo "completion audit"
    exit ${completionExitCode}
    ;;
esac
echo "unexpected npm command: $*" >&2
exit 7
`;
}

function fakeAuditNpmScript(options: {
  preflightStage?: "runtime-control" | "diagnose" | "auth" | "daemon";
  recoveryStage?: "ok" | "binary";
} = {}): string {
  const preflightStage = options.preflightStage ?? "runtime-control";
  const recoveryOutput = options.recoveryStage === "binary"
    ? `echo "## S5 sbx daemon recovery preflight"
    echo "## sbx version"
    echo "sdx 2.0 Starkit Developer eXtension"
    echo "sdx does not look like the Docker Sandboxes sbx CLI" >&2
    exit 4`
    : `echo "No changes made."
    echo "active_sbx_exec_sessions=1"
    exit 0`;
  const preflightOutput = preflightStage === "diagnose"
    ? `echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx version"
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    echo "## sbx diagnose --output json"
    echo 'RESULT: failed - sbx diagnose --output json exited 1'
    echo 'operation not permitted' >&2
    exit 1`
    : preflightStage === "auth"
      ? `echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx version"
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  Unavailable"
    echo "## sbx diagnose --output json"
    echo '{"checks":[{"name":"Authentication","status":"fail","message":"not signed in"}],"summary":{"pass":6,"warn":0,"fail":1,"skip":0}}'
    echo 'RESULT: failed - sbx diagnose --output json exited 1'
    exit 1`
      : preflightStage === "daemon"
        ? `echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx version"
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  Unavailable"
    echo "## sbx diagnose --output json"
    echo '{"checks":[{"name":"Daemon","status":"fail","message":"not reachable"}],"summary":{"pass":4,"warn":0,"fail":1,"skip":2}}'
    echo 'RESULT: failed - sbx diagnose --output json exited 1'
    exit 1`
    : `echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx version"
    echo "Client Version:  v0.28.3 test"
    echo "Server Version:  v0.28.3 test"
    echo "## sbx diagnose --output json"
    echo '{"summary":{"pass":7,"warn":0,"fail":0,"skip":0}}'
    echo "## sbx daemon status"
    echo "Status: running"
    echo "## sbx ls runtime-control probe"
    echo 'ERROR: failed to list runtimes: list runtimes: send request: Get "http://socket/runtime": context canceled' >&2
    exit 1`;
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$NPM_CALL_LOG"
case "$*" in
  "run validate:s5-sbx:preflight"|"run validate:s5-sdx:preflight")
    ${preflightOutput}
    ;;
  "run recover:s5-sbx-daemon"|"run recover:s5-sdx-daemon")
    ${recoveryOutput}
    ;;
esac
echo "unexpected npm command: $*" >&2
exit 7
`;
}

function fakeCompletionEvidence(
  options: {
    omitStopB?: boolean;
    removeBeforeStopB?: boolean;
    omitDirectLogB?: boolean;
    wrongDirectLogBInstance?: boolean;
    omitRuntimeApiLogBHeartbeat?: boolean;
    omitRawSecretRejection?: boolean;
    omitStartBArtifactId?: boolean;
    omitCleanupExitCodeB?: boolean;
    omitSandboxBFromFullList?: boolean;
    omitStartBExitCode?: boolean;
    failStopBResponse?: boolean;
    omitRuntimeHarnessEvidence?: boolean;
    diagnoseFailCount?: number;
    invalidDiagnoseJson?: boolean;
  } = {}
): string {
  const stopBResponse = [
    "## runtime API stop B response",
    `{"runtime_instance":{"sandbox_runtime_instance_id":"sandbox-runtime-instance-clock-b","lifecycle_status":"${
      options.failStopBResponse ? "failed" : "stopped"
    }"}}`
  ];
  const stopAndRemoveB = options.omitStopB
    ? [
        ...stopBResponse,
        "## runtime API stop B command evidence",
        "$ sbx exec ouro-s5-clock-b pkill -TERM -f fixtures/trading-systems/clock.py",
        "exit_code=0",
        "## sbx rm ouro-s5-clock-b",
        "$ sbx rm --force ouro-s5-clock-b",
        "exit_code=0"
      ]
    : options.removeBeforeStopB
      ? [
          "## sbx rm ouro-s5-clock-b",
          "$ sbx rm --force ouro-s5-clock-b",
          ...(options.omitCleanupExitCodeB ? [] : ["exit_code=0"]),
          ...stopBResponse,
          "## runtime API stop B command evidence",
          "$ sbx exec ouro-s5-clock-b pkill -TERM -f fixtures/trading-systems/clock.py",
          "exit_code=0",
          "$ sbx stop ouro-s5-clock-b",
          "exit_code=0"
        ]
      : [
          ...stopBResponse,
          "## runtime API stop B command evidence",
          "$ sbx exec ouro-s5-clock-b pkill -TERM -f fixtures/trading-systems/clock.py",
          "exit_code=0",
          "$ sbx stop ouro-s5-clock-b",
          "exit_code=0",
          "## sbx rm ouro-s5-clock-b",
          "$ sbx rm --force ouro-s5-clock-b",
          ...(options.omitCleanupExitCodeB ? [] : ["exit_code=0"])
        ];
  return [
    "## OURO-32 real Docker Sandboxes sbx validation",
    "## sbx version",
    "Client Version:  v0.28.3 test",
    "Server Version:  v0.28.3 test",
    "## sbx diagnose --output json",
    options.invalidDiagnoseJson
      ? '{"summary":}'
      : `{"summary":{"pass":7,"warn":0,"fail":${options.diagnoseFailCount ?? 0},"skip":0}}`,
    "## sbx daemon status",
    "Status: running",
    "## sbx ls runtime-control probe",
    "$ sbx ls",
    ...(options.omitRuntimeHarnessEvidence
      ? []
      : [
          "## start runtime API with real sbx adapter enabled",
          "runtime API ready: http://127.0.0.1:4174"
        ]),
    ...(options.omitRawSecretRejection
      ? []
      : [
          "## runtime API raw secret rejection probe",
          "response 422:",
          '{"reason":"raw_secret_material_rejected"}'
        ]),
    "## runtime API start A response",
    '{"runtime_instance":{"runnable_artifact_ref":{"id":"fixture-runnable-artifact-clock-python-001"}}}',
    "## runtime API start A command evidence",
    "$ sbx create --name ouro-s5-clock-a shell /repo",
    "exit_code=0",
    "$ sbx exec -d -w /repo ouro-s5-clock-a python3 fixtures/trading-systems/clock.py --instance-id sandbox-runtime-instance-clock-a",
    "exit_code=0",
    "## direct sbx log A",
    "$ sbx exec ouro-s5-clock-a cat /tmp/ouroboros-sandbox-runtime-instance-clock-a.jsonl",
    '{"event":"runtime_heartbeat","instance_id":"sandbox-runtime-instance-clock-a"}',
    "## runtime API status A",
    '{"instance_id":"sandbox-runtime-instance-clock-a","heartbeats":[{"heartbeat_line":"runtime_heartbeat sandbox-runtime-instance-clock-a"}]}',
    "## runtime API logs A",
    '{"logs":[{"lines":["runtime_heartbeat sandbox-runtime-instance-clock-a"]}]}',
    "## runtime API stop A response",
    '{"runtime_instance":{"sandbox_runtime_instance_id":"sandbox-runtime-instance-clock-a","lifecycle_status":"stopped"}}',
    "## runtime API stop A command evidence",
    "$ sbx exec ouro-s5-clock-a pkill -TERM -f fixtures/trading-systems/clock.py",
    "exit_code=0",
    "$ sbx stop ouro-s5-clock-a",
    "exit_code=0",
    "## sbx rm ouro-s5-clock-a",
    "$ sbx rm --force ouro-s5-clock-a",
    "exit_code=0",
    "## runtime API start B response",
    options.omitStartBArtifactId
      ? '{"runtime_instance":{"runnable_artifact_ref":{"id":"different-artifact"}}}'
      : '{"runtime_instance":{"runnable_artifact_ref":{"id":"fixture-runnable-artifact-clock-python-001"}}}',
    "## runtime API start B command evidence",
    "$ sbx create --name ouro-s5-clock-b shell /repo",
    "exit_code=0",
    "$ sbx exec -d -w /repo ouro-s5-clock-b python3 fixtures/trading-systems/clock.py --instance-id sandbox-runtime-instance-clock-b",
    ...(options.omitStartBExitCode ? [] : ["exit_code=0"]),
    "## sbx ls",
    "NAME AGENT STATUS WORKSPACE",
    "ouro-s5-clock-a shell running /repo",
    ...(options.omitSandboxBFromFullList ? [] : ["ouro-s5-clock-b shell running /repo"]),
    ...(options.omitDirectLogB
      ? []
      : [
          "## direct sbx log B",
          "$ sbx exec ouro-s5-clock-b cat /tmp/ouroboros-sandbox-runtime-instance-clock-b.jsonl",
          `{"event":"runtime_heartbeat","instance_id":"${
            options.wrongDirectLogBInstance
              ? "sandbox-runtime-instance-clock-a"
              : "sandbox-runtime-instance-clock-b"
          }"}`
        ]),
    "## runtime API status B",
    '{"instance_id":"sandbox-runtime-instance-clock-b","heartbeats":[{"heartbeat_line":"runtime_heartbeat sandbox-runtime-instance-clock-b"}]}',
    "## runtime API logs B",
    options.omitRuntimeApiLogBHeartbeat
      ? '{"logs":[{"lines":["clock line without heartbeat"]}]}'
      : '{"logs":[{"lines":["runtime_heartbeat sandbox-runtime-instance-clock-b"]}]}',
    ...stopAndRemoveB,
    "RESULT: passed",
    ""
  ].join("\n");
}

function fakeDockerScript(): string {
  return `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_CALL_LOG"
case "$1" in
  version)
    echo '{"Platform":{"Name":"docker-next"},"RawSecretEnv":"gho_should_not_be_printed"}'
    exit 0
    ;;
  container)
    echo '{"Names":"stale-runtime","RawSecretEnv":"gho_should_not_be_printed"}'
    exit 0
    ;;
  inspect)
    echo '{"Status":"exited","Running":false,"Paused":false,"Restarting":false,"Dead":false,"RawSecretEnv":"gho_should_not_be_printed"}'
    exit 0
    ;;
esac
echo "unexpected docker command: $*" >&2
exit 7
`;
}
