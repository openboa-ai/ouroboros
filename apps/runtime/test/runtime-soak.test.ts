import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRuntimeSoakEvent,
  createRuntimeSoakManifest,
  type RuntimeSoakAction,
  type RuntimeSoakSample,
  type RuntimeSoakScenario
} from "@ouroboros/application/runtime-soak";
import {
  FileRuntimeSoakJournal,
  RuntimeSoakJournalError,
  RuntimeSoakTargetError,
  SubprocessRuntimeSoakTarget
} from "@ouroboros/adapters/runtime-soak";
import { runRuntimeSoakCommand } from "../src/run-runtime-soak.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-soak-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("FileRuntimeSoakJournal", () => {
  it("creates and reloads one immutable manifest and event chain", async () => {
    const root = path.join(tmpDir, "report");
    const manifest = createRuntimeSoakManifest(scenario());
    const journal = new FileRuntimeSoakJournal(root);
    await expect(journal.initialize(manifest)).resolves.toEqual(manifest);
    const first = await journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    const second = await journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:01.000Z",
      elapsed_ms: 1_000,
      payload: { event_type: "sample_recorded", terminal: false, sample: sample() }
    }, first.event_digest);

    const restarted = new FileRuntimeSoakJournal(root);
    await expect(restarted.initialize(manifest)).resolves.toEqual(manifest);
    await expect(restarted.history()).resolves.toEqual([first, second]);
    expect(JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")))
      .toEqual(manifest);
  });

  it("rejects manifest drift and predecessor conflicts", async () => {
    const root = path.join(tmpDir, "report");
    const journal = new FileRuntimeSoakJournal(root);
    const manifest = createRuntimeSoakManifest(scenario());
    await journal.initialize(manifest);
    await journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    const changed = scenario();
    changed.duration_ms += 1;

    await expect(new FileRuntimeSoakJournal(root).initialize(createRuntimeSoakManifest(changed)))
      .rejects.toMatchObject({ code: "runtime_soak_manifest_conflict" });
    await expect(journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:01.000Z",
      elapsed_ms: 1_000,
      payload: { event_type: "sample_recorded", terminal: false, sample: sample() }
    }, digest("wrong"))).rejects.toMatchObject({ code: "runtime_soak_predecessor_conflict" });
  });

  it("allows only one same-sequence publisher", async () => {
    const root = path.join(tmpDir, "report");
    const manifest = createRuntimeSoakManifest(scenario());
    const first = new FileRuntimeSoakJournal(root);
    const second = new FileRuntimeSoakJournal(root);
    await first.initialize(manifest);
    await second.initialize(manifest);
    const draft = {
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started" as const, scenario_digest: manifest.scenario_digest }
    };
    const results = await Promise.allSettled([first.append(draft), second.append(draft)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(RuntimeSoakJournalError);
    expect(rejected.reason).toMatchObject({ code: "runtime_soak_publication_conflict" });
  });

  it("fails closed on event digest drift and unexpected report files", async () => {
    const root = path.join(tmpDir, "report");
    const manifest = createRuntimeSoakManifest(scenario());
    const journal = new FileRuntimeSoakJournal(root);
    await journal.initialize(manifest);
    const first = await journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    const eventPath = path.join(root, "events", "000000000001.json");
    await writeFile(eventPath, JSON.stringify({ ...first, elapsed_ms: 1 }) + "\n", "utf8");

    await expect(journal.history()).rejects.toMatchObject({ code: "runtime_soak_report_invalid" });
    await writeFile(path.join(root, "events", "unexpected.txt"), "drift\n", "utf8");
    await expect(journal.history()).rejects.toMatchObject({ code: "runtime_soak_report_invalid" });
  });

  it("rejects timestamp drift and any publication after terminal", async () => {
    const root = path.join(tmpDir, "report");
    const manifest = createRuntimeSoakManifest(scenario());
    const journal = new FileRuntimeSoakJournal(root);
    await journal.initialize(manifest);
    const started = await journal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:01.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    const drifted = createRuntimeSoakEvent({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 1,
      payload: { event_type: "sample_recorded", terminal: false, sample: sample() }
    }, 2, started);
    await writeFile(
      path.join(root, "events", "000000000002.json"),
      `${JSON.stringify(drifted)}\n`,
      "utf8"
    );
    await expect(journal.history()).rejects.toMatchObject({ code: "runtime_soak_report_invalid" });

    const terminalRoot = path.join(tmpDir, "terminal-report");
    const terminalJournal = new FileRuntimeSoakJournal(terminalRoot);
    await terminalJournal.initialize(manifest);
    const first = await terminalJournal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.000Z",
      elapsed_ms: 0,
      payload: { event_type: "run_started", scenario_digest: manifest.scenario_digest }
    });
    const terminal = await terminalJournal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.001Z",
      elapsed_ms: 1,
      payload: { event_type: "terminal", classification: "target_failed" }
    }, first.event_digest);
    await expect(terminalJournal.append({
      run_id: manifest.run_id,
      recorded_at: "2026-07-16T00:00:00.002Z",
      elapsed_ms: 2,
      payload: { event_type: "sample_recorded", terminal: false, sample: sample() }
    }, terminal.event_digest)).rejects.toMatchObject({ code: "runtime_soak_report_invalid" });
  });
});

describe("SubprocessRuntimeSoakTarget", () => {
  it("executes argv controls without a shell and returns only evidence digests", async () => {
    const metadataPath = path.join(tmpDir, "metadata.json");
    const action = scenario().actions[0]!;
    const target = new SubprocessRuntimeSoakTarget({
      runId: "runtime-soak-001",
      controls: {
        [action.action_id]: {
          argv: [
            process.execPath,
            "-e",
            `require("node:fs").writeFileSync(process.argv[1], JSON.stringify({ run: process.env.OUROBOROS_SOAK_RUN_ID, action: process.env.OUROBOROS_SOAK_ACTION_ID, kind: process.env.OUROBOROS_SOAK_ACTION_KIND }))`,
            metadataPath
          ]
        }
      },
      probe: nodeJsonCommand(sample())
    });

    const evidence = await target.execute(action);
    expect(evidence.evidence_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.keys(evidence)).toEqual(["evidence_digest"]);
    expect(JSON.parse(await readFile(metadataPath, "utf8"))).toEqual({
      run: "runtime-soak-001",
      action: action.action_id,
      kind: action.kind
    });
    await expect(target.sample()).resolves.toEqual(sample());
  });

  it("rejects malformed probe output and non-zero controls with stable errors", async () => {
    const action = scenario().actions[0]!;
    const malformed = new SubprocessRuntimeSoakTarget({
      runId: "runtime-soak-001",
      controls: { [action.action_id]: { argv: [process.execPath, "-e", "process.exit(7)"] } },
      probe: { argv: [process.execPath, "-e", "process.stdout.write('{}')"] }
    });

    await expect(malformed.execute(action)).rejects.toBeInstanceOf(RuntimeSoakTargetError);
    await expect(malformed.execute(action)).rejects.toMatchObject({ code: "runtime_soak_control_failed" });
    await expect(malformed.sample()).rejects.toMatchObject({ code: "runtime_soak_probe_invalid" });
  });
});

describe("runtime soak command", () => {
  it("runs the canonical fault matrix and resumes a terminal report without replay", async () => {
    const configPath = path.join(tmpDir, "config.json");
    const reportRoot = path.join(tmpDir, "report");
    const actionLog = path.join(tmpDir, "actions.jsonl");
    const soakScenario = scenario();
    const controls = Object.fromEntries(soakScenario.actions.map((action) => [
      action.action_id,
      {
        argv: [
          process.execPath,
          "-e",
          `require("node:fs").appendFileSync(process.argv[1], process.env.OUROBOROS_SOAK_ACTION_ID + "\\n")`,
          actionLog
        ]
      }
    ]));
    await writeFile(configPath, `${JSON.stringify({
      version: 1,
      scenario: soakScenario,
      controls,
      probe: nodeJsonCommand({ ...sample(), effects: [] })
    }, null, 2)}\n`, "utf8");
    const output: string[] = [];

    const first = await runRuntimeSoakCommand([
      "--config", configPath,
      "--report-root", reportRoot
    ], { stdout: (line) => output.push(line) });
    const actionsAfterFirstRun = await readFile(actionLog, "utf8");
    const second = await runRuntimeSoakCommand([
      "--config", configPath,
      "--report-root", reportRoot
    ], { stdout: (line) => output.push(line) });

    expect(first).toMatchObject({ exitCode: 0, result: { classification: "passed" } });
    expect(second).toEqual(first);
    expect((await readFile(actionLog, "utf8")).trim().split("\n"))
      .toEqual(soakScenario.actions.map((action) => action.action_id));
    expect(await readFile(actionLog, "utf8")).toBe(actionsAfterFirstRun);
    expect(JSON.parse(output[0]!)).toEqual(first.result);
    const manifest = JSON.parse(await readFile(path.join(reportRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({
      record_kind: "runtime_soak_manifest",
      operational_test_evidence: true,
      evaluation_authority: false,
      promotion_authority: false,
      order_submission_authority: false,
      private_exchange_authority: false,
      live_exchange_authority: false
    });
    const eventNames = await readdir(path.join(reportRoot, "events"));
    expect(eventNames).toHaveLength(3 + soakScenario.actions.length * 3);
  }, 15_000);
});

function scenario(): RuntimeSoakScenario {
  return {
    version: 1,
    run_id: "runtime-soak-001",
    duration_ms: 10_000,
    sample_interval_ms: 1_000,
    actions: [
      { action_id: "clean-restart", kind: "clean_restart", at_ms: 0 },
      { action_id: "crash", kind: "crash", at_ms: 1 },
      { action_id: "recover-runtime", kind: "recovery", recovers: "runtime", at_ms: 2 },
      { action_id: "delay-cleanup", kind: "delayed_cleanup", at_ms: 3 },
      { action_id: "recover-cleanup", kind: "recovery", recovers: "cleanup", at_ms: 4 },
      { action_id: "provider-loss", kind: "provider_loss", at_ms: 5 },
      { action_id: "recover-provider", kind: "recovery", recovers: "provider", at_ms: 6 },
      { action_id: "sandbox-loss", kind: "sandbox_loss", at_ms: 7 },
      { action_id: "recover-sandbox", kind: "recovery", recovers: "sandbox", at_ms: 8 },
      { action_id: "gateway-loss", kind: "gateway_unavailable", at_ms: 9 },
      { action_id: "recover-gateway", kind: "recovery", recovers: "gateway", at_ms: 10 },
      { action_id: "terminal-cleanup", kind: "terminal_cleanup", at_ms: 11 }
    ]
  };
}

function sample(): RuntimeSoakSample {
  return {
    version: 1,
    sampled_at: "2026-07-16T00:00:01.000Z",
    effects: [{ effect_id: "effect-001", occurrence_count: 1 }],
    chains: [],
    ownership: [],
    retries: [],
    paper_observations: [],
    sandboxes: [],
    resources: []
  };
}

function nodeJsonCommand(value: unknown) {
  const json = JSON.stringify(value);
  return {
    argv: [process.execPath, "-e", `process.stdout.write(${JSON.stringify(json)})`]
  };
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
