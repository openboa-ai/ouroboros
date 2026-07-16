import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adoptRuntimeProcessOwnership,
  closeRuntimeProcessOwnership,
  createRuntimeProcessOwnership,
  type RuntimeProcessOwnershipRecord,
  type RuntimeProcessTerminalReason
} from "@ouroboros/domain";
import type {
  RuntimeProcessExpectedIdentity,
  RuntimeProcessOwnershipPort,
  RuntimeProcessOwnershipReconcileResult
} from "../../ports/runtime-process-ownership";
import {
  CodexTradingResearchAgentAdapter,
  FixtureTradingResearchAgentAdapter
} from "./agent-adapters";
import type {
  AgentEditInput,
  ResearchWorkerDevelopmentFeedback,
  ResearchWorkerToolPort
} from "./types";

describe("FixtureTradingResearchAgentAdapter autonomous session", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-fixture-session-"));
    await writeFile(
      path.join(tmpDir, "run.py"),
      "RISK_FRACTION = 0.01\n",
      "utf8"
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("uses aggregate feedback across one bounded session and explicitly selects the best accepted submission", async () => {
    const editInputs: AgentEditInput[] = [];
    class CapturingFixtureAdapter extends FixtureTradingResearchAgentAdapter {
      override async improveArtifact(input: AgentEditInput) {
        editInputs.push(input);
        return super.improveArtifact(input);
      }
    }
    const tools = scriptedTools([feedback(0.6), feedback(0.4)]);
    const adapter = new CapturingFixtureAdapter();

    const result = await adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 2,
      timeout_ms: 1_000,
      arena_context: "direction=trend_following",
      tools: tools.port
    });

    expect(result).toMatchObject({
      status: "selected",
      selected_submission_sequence: 1,
      provider_command_count: 2
    });
    expect(editInputs.map((input) => input.iteration)).toEqual([1, 2]);
    expect(editInputs.map((input) => input.previous_best_score)).toEqual([
      undefined,
      0.6
    ]);
    expect(tools.submissions).toHaveLength(2);
    expect(tools.selections).toEqual([1]);
    expect(tools.finishes).toEqual([]);
  });

  it("can explicitly select early without consuming the remaining submission budget", async () => {
    const tools = scriptedTools([feedback(0.95), feedback(0.5)]);
    const adapter = new FixtureTradingResearchAgentAdapter({
      early_selection_score: 0.9
    });

    const result = await adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 2,
      timeout_ms: 1_000,
      tools: tools.port
    });

    expect(result).toMatchObject({
      status: "selected",
      selected_submission_sequence: 1,
      provider_command_count: 1
    });
    expect(tools.submissions).toHaveLength(1);
    expect(tools.selections).toEqual([1]);
  });
});

describe("CodexTradingResearchAgentAdapter process lifecycle", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-lifecycle-"));
    await writeFile(path.join(tmpDir, "run.py"), "RISK_FRACTION = 0.01\n", "utf8");
    await writeFile(path.join(tmpDir, "program.md"), "Bounded timeout probe.\n", "utf8");
    await writeFile(path.join(tmpDir, "notebook.json"), "{\"entries\":[]}\n", "utf8");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("waits for the timed-out Codex process group to terminate before returning", async () => {
    const executablePath = path.join(tmpDir, "fake-codex-timeout.cjs");
    const pidPath = path.join(tmpDir, "pids.json");
    const orphanMarkerPath = path.join(tmpDir, "orphan-marker.txt");
    await writeFile(executablePath, timeoutIgnoringCodexScript(), "utf8");
    await chmod(executablePath, 0o755);
    const adapter = new CodexTradingResearchAgentAdapter({
      command: executablePath,
      // Leave enough startup time for the fixture to spawn its descendant under full-suite load.
      timeout_ms: 1_000,
      env: {
        TEST_PID_PATH: pidPath,
        TEST_ORPHAN_MARKER_PATH: orphanMarkerPath
      }
    });
    let pids: number[] = [];

    try {
      const result = await adapter.improveArtifact({
        agent: adapter.agent,
        artifact_dir: tmpDir,
        program_path: path.join(tmpDir, "program.md"),
        notebook_path: path.join(tmpDir, "notebook.json"),
        iteration: 1
      });
      expect(result).toMatchObject({
        status: "failed",
        failure_reason: "codex_timed_out"
      });
      pids = JSON.parse(await readFile(pidPath, "utf8")) as number[];
      await delay(2_500);
      await expect(access(orphanMarkerPath)).rejects.toMatchObject({ code: "ENOENT" });
      for (const pid of pids) {
        expect(processExists(pid)).toBe(false);
      }
    } finally {
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // The production path should already have reaped the process group.
        }
      }
    }
  });

  it("accepts a successful Codex exit that closes stdin without reading the prompt", async () => {
    const executablePath = path.join(tmpDir, "fake-codex-closes-stdin.cjs");
    await writeFile(
      path.join(tmpDir, "program.md"),
      "x".repeat(16 * 1024 * 1024),
      "utf8"
    );
    await writeFile(executablePath, closesStdinCodexScript(), "utf8");
    await chmod(executablePath, 0o755);
    const adapter = new CodexTradingResearchAgentAdapter({
      command: executablePath,
      timeout_ms: 5_000
    });

    await expect(adapter.improveArtifact({
      agent: adapter.agent,
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      iteration: 1
    })).resolves.toMatchObject({
      status: "no_change"
    });
  });

  it("rejects a provider process scope when durable ownership is not configured", async () => {
    const execFile = vi.fn(async () => ({ stdout: "", stderr: "" }));
    const adapter = new CodexTradingResearchAgentAdapter({ execFile });

    await expect(adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 1,
      timeout_ms: 1_000,
      process_ownership: researchWorkerProcessScope(),
      tools: idleTools()
    })).rejects.toThrow("research_provider_process_ownership_required");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("claims the exact provider process before releasing its prompt and records completion", async () => {
    const executablePath = path.join(tmpDir, "fake-codex-owned.cjs");
    const evidencePath = path.join(tmpDir, "owned-process.json");
    await writeFile(executablePath, ownedCodexScript(), "utf8");
    await chmod(executablePath, 0o755);
    const ownership = new RecordingProcessOwnershipPort();
    const adapter = new CodexTradingResearchAgentAdapter({
      command: executablePath,
      timeout_ms: 5_000,
      process_ownership: ownership,
      host_id: "host-a",
      env: { TEST_OWNERSHIP_EVIDENCE_PATH: evidencePath }
    });

    const result = await adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 1,
      timeout_ms: 5_000,
      process_ownership: researchWorkerProcessScope(),
      tools: idleTools()
    });

    expect(result.status).toBe("finished_without_submission");
    expect(ownership.events).toEqual([
      "reconcile:terminate",
      "claim",
      "close:completed"
    ]);
    const childEvidence = JSON.parse(await readFile(evidencePath, "utf8")) as {
      pid: number;
      session_token?: string;
      prompt_bytes: number;
      prompt: string;
    };
    const terminal = ownership.records.at(-1);
    expect(childEvidence).toMatchObject({
      pid: terminal?.owner.process_id,
      session_token: terminal?.session_token
    });
    expect(childEvidence.prompt_bytes).toBeGreaterThan(0);
    expect(childEvidence.prompt).toContain(
      "may contain only manifest.json and its single declared entrypoint"
    );
    expect(terminal).toMatchObject({
      subject_ref: {
        record_kind: "research_worker_process_scope",
        id: expect.stringMatching(/^worker-1-[a-f0-9]{24}$/)
      },
      ownership_status: "terminal",
      terminal_reason: "completed"
    });
  });

  it("does not start the provider before durable ownership claim succeeds", async () => {
    const executablePath = path.join(tmpDir, "fake-codex-startup-effect.cjs");
    const startupMarkerPath = path.join(tmpDir, "provider-started.txt");
    await writeFile(executablePath, startupEffectCodexScript(), "utf8");
    await chmod(executablePath, 0o755);
    const ownership = new RejectingProcessOwnershipPort();
    const adapter = new CodexTradingResearchAgentAdapter({
      command: executablePath,
      timeout_ms: 5_000,
      process_ownership: ownership,
      host_id: "host-a",
      env: { TEST_PROVIDER_STARTUP_MARKER_PATH: startupMarkerPath }
    });

    await expect(adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 1,
      timeout_ms: 5_000,
      process_ownership: researchWorkerProcessScope(),
      tools: idleTools()
    })).rejects.toThrow(/ownership/i);

    await delay(100);
    await expect(access(startupMarkerPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(ownership.events).toEqual(["reconcile:terminate", "claim"]);
  });

  it.each([
    ["timeout", ownedTimeoutCodexScript(), "timed_out"],
    ["crash", ownedCrashCodexScript(), "crashed"]
  ] as const)("records %s as terminal provider ownership evidence", async (
    name,
    script,
    terminalReason
  ) => {
    const executablePath = path.join(tmpDir, `fake-codex-${name}.cjs`);
    await writeFile(executablePath, script, "utf8");
    await chmod(executablePath, 0o755);
    const ownership = new RecordingProcessOwnershipPort();
    const adapter = new CodexTradingResearchAgentAdapter({
      command: executablePath,
      timeout_ms: name === "timeout" ? 100 : 5_000,
      process_ownership: ownership,
      host_id: "host-a"
    });

    await expect(adapter.runSession({
      artifact_dir: tmpDir,
      program_path: path.join(tmpDir, "program.md"),
      notebook_path: path.join(tmpDir, "notebook.json"),
      submission_limit: 1,
      timeout_ms: name === "timeout" ? 100 : 5_000,
      process_ownership: researchWorkerProcessScope(),
      tools: idleTools()
    })).rejects.toThrow();

    expect(ownership.events).toEqual([
      "reconcile:terminate",
      "claim",
      `close:${terminalReason}`
    ]);
    expect(ownership.records.at(-1)).toMatchObject({
      ownership_status: "terminal",
      terminal_reason: terminalReason
    });
  });
});

function timeoutIgnoringCodexScript(): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const descendant = spawn(process.execPath, ["-e", [
  "const fs = require('node:fs');",
  "process.on('SIGTERM', () => {});",
  "setTimeout(() => fs.writeFileSync(process.env.TEST_ORPHAN_MARKER_PATH, 'orphan'), 2000);",
  "setInterval(() => {}, 1000);"
].join("")], { env: process.env, stdio: "ignore" });
fs.writeFileSync(process.env.TEST_PID_PATH, JSON.stringify([process.pid, descendant.pid]));
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`;
}

function closesStdinCodexScript(): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
fs.closeSync(0);
setTimeout(() => process.exit(0), 50);
`;
}

function ownedCodexScript(): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const prompt = Buffer.concat(chunks).toString("utf8");
  fs.writeFileSync(process.env.TEST_OWNERSHIP_EVIDENCE_PATH, JSON.stringify({
    pid: process.pid,
    session_token: process.env.OUROBOROS_PROCESS_SESSION_TOKEN,
    prompt_bytes: Buffer.byteLength(prompt),
    prompt
  }));
  process.exit(0);
});
`;
}

function ownedTimeoutCodexScript(): string {
  return `#!/usr/bin/env node
process.stdin.resume();
setInterval(() => {}, 1000);
`;
}

function startupEffectCodexScript(): string {
  return `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(process.env.TEST_PROVIDER_STARTUP_MARKER_PATH, "started");
setInterval(() => {}, 1000);
`;
}

function ownedCrashCodexScript(): string {
  return `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => process.exit(7));
`;
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function researchWorkerProcessScope() {
  return {
    subject_ref: { record_kind: "research_worker", id: "worker-1" },
    runtime_ref: {
      record_kind: "research_preflight_commitment",
      id: "preflight-1"
    }
  };
}

function idleTools(): ResearchWorkerToolPort {
  return {
    status: async () => ({
      session_status: "open",
      submission_limit: 1,
      completed_submission_count: 0,
      remaining_submission_count: 1,
      selected_submission_sequence: null
    }),
    submitDevelopment: async () => {
      throw new Error("unexpected submit");
    },
    selectDevelopment: async () => {
      throw new Error("unexpected select");
    },
    finishWithoutSubmission: async () => {
      throw new Error("unexpected finish");
    }
  };
}

class RecordingProcessOwnershipPort implements RuntimeProcessOwnershipPort {
  readonly events: string[] = [];
  readonly records: RuntimeProcessOwnershipRecord[] = [];
  private activeRecord?: RuntimeProcessOwnershipRecord;

  async active(): Promise<RuntimeProcessOwnershipRecord | undefined> {
    return this.activeRecord;
  }

  async inspect(): Promise<
    Awaited<ReturnType<RuntimeProcessOwnershipPort["inspect"]>>
  > {
    return this.activeRecord
      ? { status: "owned", ownership: this.activeRecord }
      : { status: "vacant" };
  }

  async claim(input: {
    expected: RuntimeProcessExpectedIdentity;
    processId: number;
    sessionToken: string;
    startedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    this.events.push("claim");
    this.activeRecord = createRuntimeProcessOwnership({
      processKind: input.expected.process_kind,
      subjectRef: input.expected.subject_ref,
      runtimeRef: input.expected.runtime_ref,
      owner: {
        host_id: input.expected.host_id,
        process_id: input.processId,
        process_start_marker: `test-start-${input.processId}`
      },
      executable: input.expected.executable,
      profileDigest: input.expected.profile_digest,
      sessionToken: input.sessionToken,
      startedAt: input.startedAt
    });
    this.records.push(this.activeRecord);
    return this.activeRecord;
  }

  async reconcile(input: {
    expected: RuntimeProcessExpectedIdentity;
    mode: "adopt" | "terminate";
    reconciledAt: string;
  }): Promise<RuntimeProcessOwnershipReconcileResult> {
    this.events.push(`reconcile:${input.mode}`);
    if (!this.activeRecord) return { status: "vacant" };
    if (input.mode === "adopt") {
      this.activeRecord = adoptRuntimeProcessOwnership({
        ownership: this.activeRecord,
        adoptedAt: input.reconciledAt
      });
      this.records.push(this.activeRecord);
      return { status: "adopted", ownership: this.activeRecord };
    }
    this.activeRecord = closeRuntimeProcessOwnership({
      ownership: this.activeRecord,
      terminalReason: "restart_terminated",
      closedAt: input.reconciledAt
    });
    this.records.push(this.activeRecord);
    return { status: "terminated", ownership: this.activeRecord };
  }

  async close(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: RuntimeProcessTerminalReason;
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    this.events.push(`close:${input.terminalReason}`);
    this.activeRecord = closeRuntimeProcessOwnership({
      ownership: input.ownership,
      terminalReason: input.terminalReason,
      closedAt: input.closedAt
    });
    this.records.push(this.activeRecord);
    return this.activeRecord;
  }

  async terminate(input: {
    ownership: RuntimeProcessOwnershipRecord;
    terminalReason: "shutdown" | "restart_terminated" | "timed_out";
    closedAt: string;
  }): Promise<RuntimeProcessOwnershipRecord> {
    return this.close(input);
  }

  async history(): Promise<RuntimeProcessOwnershipRecord[]> {
    return [...this.records];
  }
}

class RejectingProcessOwnershipPort extends RecordingProcessOwnershipPort {
  override async claim(): Promise<RuntimeProcessOwnershipRecord> {
    this.events.push("claim");
    await delay(200);
    throw new Error("durable ownership unavailable");
  }
}

function feedback(score: number): ResearchWorkerDevelopmentFeedback {
  return {
    status: "accepted",
    score,
    metrics: [{ name: "fixture_score", score, detail: "fixture aggregate" }],
    summary: `Fixture aggregate score ${score}.`,
    risk_decision: "valid_order_request",
    profit_loss: {
      revenue_usdt: score,
      cost_usdt: 0,
      net_revenue_usdt: score,
      net_return_pct: score
    }
  };
}

function scriptedTools(feedbacks: ResearchWorkerDevelopmentFeedback[]): {
  port: ResearchWorkerToolPort;
  submissions: string[];
  selections: number[];
  finishes: string[];
} {
  const submissions: string[] = [];
  const selections: number[] = [];
  const finishes: string[] = [];
  const port: ResearchWorkerToolPort = {
    status: vi.fn(async () => ({
      session_status: "open" as const,
      submission_limit: feedbacks.length,
      completed_submission_count: submissions.length,
      remaining_submission_count: feedbacks.length - submissions.length,
      selected_submission_sequence: null
    })),
    submitDevelopment: vi.fn(async (input) => {
      const submissionSequence = submissions.length + 1;
      submissions.push(input.research_note);
      const aggregate = feedbacks[submissionSequence - 1];
      if (!aggregate) throw new Error("unexpected_fixture_submission");
      return {
        session_status: "open" as const,
        submission_sequence: submissionSequence,
        remaining_submission_count: feedbacks.length - submissionSequence,
        feedback: aggregate
      };
    }),
    selectDevelopment: vi.fn(async (input) => {
      selections.push(input.submission_sequence);
      return {
        session_status: "selected" as const,
        submission_sequence: input.submission_sequence,
        reason: input.reason
      };
    }),
    finishWithoutSubmission: vi.fn(async (input) => {
      finishes.push(input.reason);
      return {
        session_status: "finished_without_submission" as const,
        reason: input.reason
      };
    })
  };
  return { port, submissions, selections, finishes };
}
