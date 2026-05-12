import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-s9-codex-sbx-audit-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("S9 Codex sbx audit script", () => {
  it("prints host-local, fixture-only, and real sbx/sdx boundaries in help", async () => {
    const result = await runScript(["scripts/audit-s9-codex-sbx.mjs", "--help"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("host-local Codex CLI availability");
    expect(result.stdout).toContain("fixture-only Codex AAR dry-run/evaluation proof");
    expect(result.stdout).toContain("real sbx/sdx preflight");
    expect(result.stdout).toContain("command evidence only");
    expect(result.stdout).toContain("Exit codes:");
  });

  it("audits repo-side S9 readiness without host probes by default", async () => {
    const result = await runScript(["scripts/audit-s9-codex-sbx.mjs"], {});

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("S9 Codex sbx readiness audit");
    expect(result.stdout).toContain("PASS required S9 Codex AAR files exist");
    expect(result.stdout).toContain("PASS npm S9 Codex sbx scripts are registered");
    expect(result.stdout).toContain("PASS S5 sbx/sdx preflight guardrails remain registered");
    expect(result.stdout).toContain("PASS fixture-only Codex AAR evaluation proof is registered");
    expect(result.stdout).toContain("REAL_ENVIRONMENT_PROOF_REQUIRED npm run audit:s9-codex-sdx -- --host-probes");
    expect(result.stdout).not.toContain("host-local Codex probe is observable");
  });

  it("runs explicit host probes through Codex audit and S5 sdx preflight without full sbx mutation", async () => {
    const callLog = path.join(tempDir, "npm-calls.log");
    const fakeCodex = path.join(tempDir, "codex");
    const fakeNpm = path.join(tempDir, "npm");
    await writeExecutable(fakeCodex, fakeCodexScript());
    await writeExecutable(fakeNpm, fakeNpmScript());

    const result = await runScript(["scripts/audit-s9-codex-sbx.mjs", "--host-probes"], {
      PATH: `${tempDir}:${process.env.PATH ?? ""}`,
      OUROBOROS_CODEX_BIN: fakeCodex,
      OUROBOROS_SDX_BIN: path.join(tempDir, "sdx"),
      S9_CALL_LOG: callLog
    });
    const calls = (await readFile(callLog, "utf8")).trim().split("\n");

    expect(result.code, scriptOutput(result)).toBe(0);
    expect(result.stdout).toContain("PASS host-local Codex probe is observable");
    expect(result.stdout).toContain("PASS S9 Codex AAR audit command produces structured provider outcome");
    expect(result.stdout).toContain("PASS real sbx/sdx preflight passes or reports precise host blocker");
    expect(calls[0]).toContain("run aar:proposal:codex:audit --");
    expect(calls[1]).toBe("run validate:s5-sdx:preflight");
    expect(calls).not.toContain("run validate:s5-sdx");
  });

  it("exits 2 when explicit real sbx/sdx preflight is blocked", async () => {
    const callLog = path.join(tempDir, "npm-blocked-calls.log");
    const fakeCodex = path.join(tempDir, "codex");
    const fakeNpm = path.join(tempDir, "npm");
    await writeExecutable(fakeCodex, fakeCodexScript());
    await writeExecutable(fakeNpm, fakeNpmScript());

    const result = await runScript(["scripts/audit-s9-codex-sbx.mjs", "--host-probes"], {
      PATH: `${tempDir}:${process.env.PATH ?? ""}`,
      OUROBOROS_CODEX_BIN: fakeCodex,
      OUROBOROS_SDX_BIN: path.join(tempDir, "sdx"),
      S9_CALL_LOG: callLog,
      S9_FAKE_SBX_PREFLIGHT_CODE: "2"
    });

    expect(result.code, scriptOutput(result)).toBe(2);
    expect(result.stdout).toContain("BLOCKED real sbx/sdx preflight");
    expect(result.stdout).toContain("real sbx/sdx preflight blocked via npm run validate:s5-sdx:preflight");
  });
});

function fakeCodexScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "--version" ]]; then
  echo "codex-cli fake-host 0.1.0"
  exit 0
fi
echo "unexpected codex command: $*" >&2
exit 1
`;
}

function fakeNpmScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$S9_CALL_LOG"
case "$*" in
  run\\ aar:proposal:codex:audit\\ --\\ --store-root*)
    cat <<'JSON'
{
  "probe": {
    "readiness_status": "active_verified"
  },
  "dry_run": {
    "status": "failed",
    "failure_reason": "aar_proposal_provider_timeout"
  },
  "delta": {
    "aar_proposal_materialization_attempts": 1,
    "aar_artifact_proposals": 0,
    "runnable_artifacts": 0,
    "aar_artifact_lineages": 0,
    "aar_orchestration_runs": 0
  }
}
JSON
    ;;
  run\\ validate:s5-sdx:preflight)
    echo "## OURO-32 real Docker Sandboxes sbx validation"
    echo "## sbx version"
    if [[ "\${S9_FAKE_SBX_PREFLIGHT_CODE:-0}" == "0" ]]; then
      echo "RESULT: preflight passed"
      exit 0
    fi
    echo "host sbx preflight/runtime-control is blocked" >&2
    exit "\${S9_FAKE_SBX_PREFLIGHT_CODE}"
    ;;
  *)
    echo "unexpected npm command: $*" >&2
    exit 1
    ;;
esac
`;
}

async function writeExecutable(filePath: string, contents: string): Promise<void> {
  await writeFile(filePath, contents, { mode: 0o755 });
}

function runScript(args: string[], env: Record<string, string>, timeoutMs = 15_000): Promise<{
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
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `STDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`;
}
