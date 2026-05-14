import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S11 Codex SDX trading research proof script", () => {
  it("prints the underlying run and audit commands without invoking npm in print-only mode", async () => {
    const result = await runScript([
      "scripts/prove-trading-research-codex-sdx.mjs",
      "--print-only",
      "--session-id",
      "example"
    ]);

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("S11 Codex SDX Trading research proof");
    expect(result.stdout).toContain("session_id=example");
    expect(result.stdout).toContain("env OUROBOROS_SBX_HOME=/private/tmp/ouro-s5-sdx-home");
    expect(result.stdout).toContain("env OUROBOROS_SDX_BIN=./scripts/sdx-docker-sandboxes");
    expect(result.stdout).toContain("env OUROBOROS_SBX_COMMAND_TIMEOUT_MS=120000");
    expect(result.stdout).toContain(
      "run_command=npm run trading:research -- --agent codex --mode replay --iterations 2 --artifact-runner sdx --session-id example"
    );
    expect(result.stdout).toContain(
      "audit_command=npm run audit:s10-trading-research -- --session-id example"
    );
    expect(result.stdout).toContain("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");
    expect(result.stdout).toContain("PROOF_RESULT print_only");
  });

  it("runs trading research first and audits the same session second", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s11-proof-"));
    const fakeNpm = path.join(tempDir, "npm");
    const logPath = path.join(tempDir, "npm.log");
    try {
      await writeFakeNpm(fakeNpm);

      const result = await runScript([
        "scripts/prove-trading-research-codex-sdx.mjs",
        "--session-id",
        "order-test",
        "--iterations",
        "3",
        "--model",
        "gpt-test",
        "--agent-timeout-ms",
        "10",
        "--artifact",
        "/tmp/artifact",
        "--program",
        "/tmp/program.md",
        "--run-root",
        "/tmp/run-root",
        "--sbx-home",
        "/tmp/sbx-home",
        "--sdx-bin",
        "/tmp/sdx",
        "--command-timeout-ms",
        "7000"
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        FAKE_NPM_LOG: logPath
      });
      const calls = parseCallLog(await readFile(logPath, "utf8"));

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PROOF_RESULT passed");
      expect(calls).toHaveLength(2);
      expect(calls[0].argv).toEqual([
        "run",
        "trading:research",
        "--",
        "--agent",
        "codex",
        "--mode",
        "replay",
        "--iterations",
        "3",
        "--artifact-runner",
        "sdx",
        "--session-id",
        "order-test",
        "--model",
        "gpt-test",
        "--agent-timeout-ms",
        "10",
        "--artifact",
        "/tmp/artifact",
        "--program",
        "/tmp/program.md",
        "--run-root",
        "/tmp/run-root"
      ]);
      expect(calls[1].argv).toEqual([
        "run",
        "audit:s10-trading-research",
        "--",
        "--session-id",
        "order-test"
      ]);
      expect(calls[0].env).toEqual({
        OUROBOROS_SBX_HOME: "/tmp/sbx-home",
        OUROBOROS_SDX_BIN: "/tmp/sdx",
        OUROBOROS_SBX_COMMAND_TIMEOUT_MS: "7000"
      });
      expect(calls[1].env).toEqual(calls[0].env);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("stops before audit when the trading research run fails", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s11-proof-"));
    const fakeNpm = path.join(tempDir, "npm");
    const logPath = path.join(tempDir, "npm.log");
    try {
      await writeFakeNpm(fakeNpm);

      const result = await runScript([
        "scripts/prove-trading-research-codex-sdx.mjs",
        "--session-id",
        "run-fails"
      ], {
        PATH: `${tempDir}:${process.env.PATH ?? ""}`,
        FAKE_NPM_LOG: logPath,
        FAKE_NPM_FAIL_TRADING_RESEARCH_CODE: "7"
      });
      const calls = parseCallLog(await readFile(logPath, "utf8"));

      expect(result.code, scriptOutput(result)).toBe(7);
      expect(calls).toHaveLength(1);
      expect(calls[0].argv).toContain("trading:research");
      expect(result.stdout).toContain("PROOF_RESULT failed_stage=run exit_code=7");
      expect(result.stdout).not.toContain("PROOF_RESULT passed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm proof command", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["prove:trading-research:codex-sdx"])
      .toBe("node scripts/prove-trading-research-codex-sdx.mjs");
  });
});

async function writeFakeNpm(pathname: string): Promise<void> {
  await writeFile(pathname, `#!/usr/bin/env node
const fs = require("node:fs");
const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify({
  argv,
  env: {
    OUROBOROS_SBX_HOME: process.env.OUROBOROS_SBX_HOME,
    OUROBOROS_SDX_BIN: process.env.OUROBOROS_SDX_BIN,
    OUROBOROS_SBX_COMMAND_TIMEOUT_MS: process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS
  }
}) + "\\n");
if (argv.includes("trading:research") && process.env.FAKE_NPM_FAIL_TRADING_RESEARCH_CODE) {
  process.exit(Number(process.env.FAKE_NPM_FAIL_TRADING_RESEARCH_CODE));
}
if (argv.includes("audit:s10-trading-research") && process.env.FAKE_NPM_FAIL_AUDIT_CODE) {
  process.exit(Number(process.env.FAKE_NPM_FAIL_AUDIT_CODE));
}
process.exit(0);
`, "utf8");
  await chmod(pathname, 0o755);
}

function parseCallLog(contents: string) {
  return contents.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function runScript(args: string[], env: Record<string, string | undefined> = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
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
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
