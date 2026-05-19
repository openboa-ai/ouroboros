import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("S18 Trading replay run scripts", () => {
  it("runs a promoted candidate by candidate id and records replay-run evidence", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s18-replay-run-"));
    try {
      const candidateRoot = path.join(tempDir, "candidates");
      const runRoot = path.join(tempDir, "runs");
      const candidate = await writeCandidateBundle(candidateRoot, "candidate-ok");

      const result = await runNpm([
        "run",
        "trading:replay:run",
        "--",
        "--candidate-id",
        "candidate-ok",
        "--candidate-root",
        candidateRoot,
        "--run-root",
        runRoot,
        "--run-id",
        "run-ok"
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading replay run");
      expect(result.stdout).toContain("run_id=run-ok");
      expect(result.stdout).toContain("candidate_id=candidate-ok");
      expect(result.stdout).toContain("runner_kind=host_process");
      expect(result.stdout).toContain("status=accepted");
      expect(result.stdout).toContain("scenarios=2/2 accepted");
      expect(result.stdout).toContain("provider_requests=6");
      expect(result.stdout).toContain("runner_commands=0");
      expect(result.stdout).toContain("NO_AUTHORITY live_exchange=false order_authority=false credentials=false paper_trading=false");
      expect(result.stdout).toContain("CANDIDATE_RUN_RESULT accepted");

      const run = JSON.parse(await readFile(path.join(runRoot, "run-ok", "run.json"), "utf8"));
      expect(run).toMatchObject({
        record_kind: "trading_system_replay_run",
        run_id: "run-ok",
        candidate_id: "candidate-ok",
        source_candidate_dir: candidate.candidateDir,
        promoted_artifact_dir: path.join(candidate.candidateDir, "artifact"),
        artifact_digest: candidate.digest,
        runner_kind: "host_process",
        status: "accepted",
        run_status: "completed",
        scenario_ids: ["trend_long", "range_flat"],
        scenario_accepted: 2,
        scenario_total: 2,
        provider_request_total: 6,
        runner_command_total: 0,
        authority_status: "not_live",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        },
        provenance: {
          promotion_id: "promotion-candidate-ok",
          source_session_id: "source-session-candidate-ok"
        }
      });
      expect(run.score).toBeGreaterThan(0);
      expect(run.risk_decision).toBe("valid_order_request");
      expect(run.scenario_results).toHaveLength(2);

      const index = JSON.parse(await readFile(path.join(runRoot, "index.json"), "utf8"));
      expect(index).toMatchObject({
        record_kind: "trading_system_replay_run_index",
        runs: [
          {
            run_id: "run-ok",
            candidate_id: "candidate-ok",
            status: "accepted",
            authority_status: "not_live"
          }
        ]
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects a missing candidate before running replay", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s18-replay-run-"));
    try {
      const result = await runNpm([
        "run",
        "trading:replay:run",
        "--",
        "--candidate-id",
        "missing-candidate",
        "--candidate-root",
        path.join(tempDir, "candidates"),
        "--run-root",
        path.join(tempDir, "runs")
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("candidate_id=missing-candidate");
      expect(result.stdout).toContain("MISSING candidate bundle exists");
      expect(result.stdout).toContain("CANDIDATE_RUN_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects candidate bundles that imply trading authority", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s18-replay-run-"));
    try {
      const candidateRoot = path.join(tempDir, "candidates");
      await writeCandidateBundle(candidateRoot, "candidate-authority", { authorityStatus: "live" });

      const result = await runNpm([
        "run",
        "trading:replay:run",
        "--",
        "--candidate-id",
        "candidate-authority",
        "--candidate-root",
        candidateRoot,
        "--run-root",
        path.join(tempDir, "runs"),
        "--run-id",
        "run-authority"
      ]);

      expect(result.code, scriptOutput(result)).toBe(2);
      expect(result.stdout).toContain("MISSING candidate and system code authority_status == not_live");
      expect(result.stdout).toContain("CANDIDATE_RUN_RESULT failed");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("lists replay runs in newest-first order", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "ouroboros-s18-replay-run-ledger-"));
    try {
      await writeRunRecord(tempDir, "run-newer", "candidate-b", "2026-05-13T15:00:00.000Z");
      await writeRunRecord(tempDir, "run-older", "candidate-a", "2026-05-13T14:00:00.000Z");

      const result = await runNode([
        "scripts/trading-replay-run-ledger.mjs",
        "--root",
        tempDir,
        "--limit",
        "2"
      ]);

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("Trading replay run ledger");
      expect(result.stdout).toContain("runs=2");
      expect(result.stdout).toContain("run run-newer candidate=candidate-b runner=host_process status=accepted authority=not_live");
      expect(result.stdout).toContain("scenarios=2/2 accepted provider_requests=6 runner_commands=0");
      expect(result.stdout.indexOf("run run-newer")).toBeLessThan(result.stdout.indexOf("run run-older"));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("registers the npm replay run commands", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["trading:replay:run"])
      .toBe("tsx apps/runtime/src/trading-candidate/run-replay.ts");
    expect(packageJson.scripts["trading:replay:ledger"])
      .toBe("node scripts/trading-replay-run-ledger.mjs");
  });
});

async function writeCandidateBundle(
  root: string,
  candidateId: string,
  options: { authorityStatus?: string } = {}
): Promise<{ candidateDir: string; digest: string }> {
  const authorityStatus = options.authorityStatus ?? "not_live";
  const candidateDir = path.join(root, candidateId);
  const artifactDir = path.join(candidateDir, "artifact");
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, "manifest.json"), `${JSON.stringify({
    id: "replay-run-test-artifact",
    name: "Replay run test artifact",
    entrypoint: [process.execPath, "run-artifact.mjs"],
    editable_paths: ["run-artifact.mjs"],
    api_contract: "trading_api_provider_v1"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(artifactDir, "run-artifact.mjs"), artifactSource(), "utf8");
  const digest = await artifactDigest(artifactDir);
  await writeFile(path.join(candidateDir, "candidate.json"), `${JSON.stringify({
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: candidateId,
    active_version_id: `${candidateId}-v1`,
    authority_status: authorityStatus
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "system-code.json"), `${JSON.stringify({
    record_kind: "system_code",
    version: 1,
    system_code_id: `system-code-${candidateId}`,
    artifact_digest: digest,
    authority_status: authorityStatus
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(candidateDir, "promotion.json"), `${JSON.stringify({
    record_kind: "trading_research_candidate_promotion",
    version: 1,
    promotion_id: `promotion-${candidateId}`,
    source: {
      session_id: `source-session-${candidateId}`
    },
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  return { candidateDir, digest };
}

function artifactSource(): string {
  return `import { appendFile } from "node:fs/promises";

const outputIndex = process.argv.indexOf("--output-events");
if (outputIndex === -1 || !process.argv[outputIndex + 1]) {
  throw new Error("missing --output-events");
}
const outputEvents = process.argv[outputIndex + 1];
const baseUrl = process.env.TRADING_API_BASE_URL;
if (!baseUrl) {
  throw new Error("missing TRADING_API_BASE_URL");
}

async function getJson(pathname) {
  const response = await fetch(baseUrl + pathname);
  return response.json();
}

async function postJson(pathname, payload) {
  const response = await fetch(baseUrl + pathname, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function event(payload) {
  await appendFile(outputEvents, JSON.stringify({ at: new Date().toISOString(), ...payload }) + "\\n", "utf8");
}

const market = await getJson("/market/snapshot");
await event({ event: "market_snapshot", ...market });
const account = await getJson("/account/state");
await event({ event: "account_state", ...account });
const intent = market.expected_direction === "flat"
  ? {
      symbol: market.symbol,
      side: "hold",
      quantity: 0,
      order_type: "none",
      reason: "flat replay regime should not open a directional position"
    }
  : {
      symbol: market.symbol,
      side: "buy",
      quantity: Number(((account.equity * account.target_risk_fraction) / market.price).toFixed(8)),
      order_type: "market",
      reason: "long replay regime with bounded account risk"
    };
await event({ event: "order_request", ...intent });
const validation = await postJson("/orders/validate", intent);
await event({ event: "order_validation", ...validation });
await event({ event: "run_complete", accepted: validation.accepted });
`;
}

async function writeRunRecord(root: string, runId: string, candidateId: string, completedAt: string): Promise<void> {
  const runDir = path.join(root, runId);
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, "run.json"), `${JSON.stringify({
    record_kind: "trading_system_replay_run",
    version: 1,
    run_id: runId,
    candidate_id: candidateId,
    runner_kind: "host_process",
    status: "accepted",
    run_status: "completed",
    scenario_accepted: 2,
    scenario_total: 2,
    provider_request_total: 6,
    runner_command_total: 0,
    artifact_digest: `sha256:${runId}`,
    completed_at: completedAt,
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
}

async function artifactDigest(artifactDir: string): Promise<string> {
  const hash = createHash("sha256");
  for (const file of await listFiles(artifactDir)) {
    const relativePath = path.relative(artifactDir, file).split(path.sep).join("/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const pathname = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(pathname));
    } else if (entry.isFile()) {
      files.push(pathname);
    }
  }
  return files.sort();
}

function runNpm(args: string[]) {
  return runCommand("npm", args);
}

function runNode(args: string[]) {
  return runCommand(process.execPath, args);
}

function runCommand(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
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
