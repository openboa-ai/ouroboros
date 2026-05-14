import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const artifactPath = path.resolve("fixtures/trading-systems/clock.py");

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-clock-artifact-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Python clock runnable artifact fixture", () => {
  it("runs in bounded test mode and emits instance-scoped heartbeat and log output", async () => {
    const logFile = path.join(tmpDir, "clock.log");
    const heartbeatFile = path.join(tmpDir, "clock-heartbeat.json");
    const { stdout } = await execFileAsync("python3", [
      artifactPath,
      "--instance-id",
      "clock-test-alpha",
      "--ticks",
      "2",
      "--interval-ms",
      "1",
      "--log-file",
      logFile,
      "--heartbeat-file",
      heartbeatFile
    ]);

    const stdoutLines = stdout.trim().split("\n").map((line) => JSON.parse(line));
    const logLines = (await readFile(logFile, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const latestHeartbeat = JSON.parse(await readFile(heartbeatFile, "utf8"));

    expect(stdoutLines).toEqual(logLines);
    expect(stdoutLines).toEqual([
      {
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 1
      },
      {
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_heartbeat",
        instance_id: "clock-test-alpha",
        tick: 2
      },
      {
        at: "1970-01-01T00:00:00.000Z",
        event: "runtime_stopped",
        instance_id: "clock-test-alpha",
        tick: 2
      }
    ]);
    expect(latestHeartbeat).toMatchObject({
      event: "runtime_stopped",
      instance_id: "clock-test-alpha",
      tick: 2
    });
  });

  it("does not require secret-looking configuration fields", async () => {
    const { stdout } = await execFileAsync("python3", [artifactPath, "--help"]);

    expect(stdout).toContain("--instance-id");
    expect(stdout).toContain("--ticks");
    expect(stdout).toContain("--log-file");
    expect(stdout).not.toMatch(/secret|password|token|api[-_]?key|credential/i);
  });
});
