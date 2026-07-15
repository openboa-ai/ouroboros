import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requiredDeniedProbes = [
  "direct_https",
  "redirect_to_public_https",
  "dns_resolution",
  "raw_tcp",
  "raw_udp_dns",
  "subprocess_curl",
  "child_process_http",
  "cloud_metadata",
  "private_network",
  "alternate_host_port"
] as const;

describe("candidate sandbox egress proof script", () => {
  it("proves the exact Gateway route and cleans up the scoped rule and Sandbox", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-egress-proof-"));
    const fakeSbx = path.join(root, "sbx");
    const commandLog = path.join(root, "commands.jsonl");
    const policyState = path.join(root, "policy-state");
    try {
      await writeFakeSbx(fakeSbx);
      const result = await runProof(fakeSbx, {
        FAKE_SBX_COMMAND_LOG: commandLog,
        FAKE_SBX_POLICY_STATE: policyState
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PROOF_RESULT passed");
      expect(result.stdout).not.toContain("test-secret-value");
      const commands = await readCommands(commandLog);
      const allowIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "allow"
      );
      const execIndex = commands.findIndex((args) => args[0] === "exec");
      const logIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "log"
      );
      const policyRemoveIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "rm"
      );
      const sandboxRemoveIndex = commands.findIndex((args) => args[0] === "rm");
      expect(allowIndex).toBeGreaterThan(0);
      expect(execIndex).toBeGreaterThan(allowIndex);
      expect(logIndex).toBeGreaterThan(execIndex);
      expect(policyRemoveIndex).toBeGreaterThan(logIndex);
      expect(sandboxRemoveIndex).toBeGreaterThan(policyRemoveIndex);
      expect(commands[allowIndex]?.at(-1)).toMatch(/^localhost:\d+$/);
      expect(commands[execIndex]).toContain("candidate-network-egress-probe.py");
      expect(commands[execIndex]).toContain("--alternate-host-url");
      await expect(readFile(policyState, "utf8")).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("still removes network policy and Sandbox when the candidate probe fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-egress-proof-"));
    const fakeSbx = path.join(root, "sbx");
    const commandLog = path.join(root, "commands.jsonl");
    const policyState = path.join(root, "policy-state");
    try {
      await writeFakeSbx(fakeSbx);
      const result = await runProof(fakeSbx, {
        FAKE_SBX_COMMAND_LOG: commandLog,
        FAKE_SBX_POLICY_STATE: policyState,
        FAKE_SBX_PROBE_FAILURE: "1"
      });

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("PROOF_RESULT failed stage=candidate_probe");
      const commands = await readCommands(commandLog);
      expect(commands.some((args) => args[0] === "policy" && args[1] === "log")).toBe(true);
      expect(commands.some((args) => args[0] === "policy" && args[1] === "rm")).toBe(true);
      expect(commands.at(-1)?.slice(0, 2)).toEqual(["rm", "--force"]);
      await expect(readFile(policyState, "utf8")).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an old sbx before creating a Sandbox", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-egress-proof-"));
    const fakeSbx = path.join(root, "sbx");
    const commandLog = path.join(root, "commands.jsonl");
    try {
      await writeFakeSbx(fakeSbx);
      const result = await runProof(fakeSbx, {
        FAKE_SBX_COMMAND_LOG: commandLog,
        FAKE_SBX_POLICY_STATE: path.join(root, "policy-state"),
        FAKE_SBX_VERSION: "0.34.0"
      });

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("PROOF_RESULT failed stage=version");
      expect(await readCommands(commandLog)).toEqual([["version"]]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not remove an unowned Sandbox name when create returns failure", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ouroboros-egress-proof-"));
    const fakeSbx = path.join(root, "sbx");
    const commandLog = path.join(root, "commands.jsonl");
    try {
      await writeFakeSbx(fakeSbx);
      const result = await runProof(fakeSbx, {
        FAKE_SBX_COMMAND_LOG: commandLog,
        FAKE_SBX_POLICY_STATE: path.join(root, "policy-state"),
        FAKE_SBX_CREATE_FAILURE: "1"
      });

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("PROOF_RESULT failed stage=create");
      const commands = await readCommands(commandLog);
      expect(commands.at(-1)?.[0]).toBe("create");
      expect(commands.some((args) => args[0] === "rm")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("registers the proof command and keeps the complete candidate probe matrix", async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    const fixture = await readFile(
      path.join(repoRoot, "fixtures/security/candidate-network-egress-probe.py"),
      "utf8"
    );

    expect(packageJson.scripts["prove:candidate-sandbox-egress"])
      .toBe("node scripts/prove-candidate-sandbox-egress.mjs");
    for (const probe of requiredDeniedProbes) {
      expect(fixture).toContain(probe);
    }
  });
});

async function writeFakeSbx(pathname: string): Promise<void> {
  const probeResults = requiredDeniedProbes.map((name) => ({
    name,
    expected: "denied",
    observed: "denied"
  }));
  await writeFile(pathname, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_SBX_COMMAND_LOG, JSON.stringify(args) + "\\n");
const state = process.env.FAKE_SBX_POLICY_STATE;
switch (args[0]) {
  case "version":
    console.log("sbx version: v" + (process.env.FAKE_SBX_VERSION || "0.35.0"));
    process.exit(0);
  case "create":
    if (process.env.FAKE_SBX_CREATE_FAILURE) process.exit(8);
    console.log("created");
    process.exit(0);
  case "policy": {
    if (args[1] === "ls") {
      if (fs.existsSync(state)) {
        const resource = fs.readFileSync(state, "utf8").trim();
        console.log(JSON.stringify({ rules: [{ decision: "allow", status: "active", resources: [resource] }] }));
      } else {
        console.log(JSON.stringify({ rules: [] }));
      }
      process.exit(0);
    }
    if (args[1] === "allow") {
      fs.writeFileSync(state, args.at(-1) + "\\n");
      process.exit(0);
    }
    if (args[1] === "check") {
      const target = args.at(-1);
      const allowed = fs.existsSync(state) && fs.readFileSync(state, "utf8").trim() === target;
      console.log(JSON.stringify({ decision: allowed ? "allow" : "deny" }));
      process.exit(allowed ? 0 : 1);
    }
    if (args[1] === "log") {
      console.log(JSON.stringify({ entries: [] }));
      process.exit(0);
    }
    if (args[1] === "rm") {
      if (fs.existsSync(state)) fs.unlinkSync(state);
      process.exit(0);
    }
    process.exit(2);
  }
  case "exec":
    if (process.env.FAKE_SBX_PROBE_FAILURE) {
      console.error("candidate probe failed");
      process.exit(9);
    }
    console.log(JSON.stringify({
      protocol_version: "candidate-network-egress-probe/v1",
      gateway: { expected: "allowed", observed: "allowed" },
      probes: ${JSON.stringify(probeResults)},
      passed: true
    }));
    process.exit(0);
  case "rm":
    process.exit(0);
  default:
    process.exit(2);
}
`, "utf8");
  await chmod(pathname, 0o755);
}

function runProof(sbxPath: string, env: Record<string, string>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [
      "scripts/prove-candidate-sandbox-egress.mjs",
      "--sbx-bin",
      sbxPath,
      "--sandbox-name",
      "ouro-egress-proof-test",
      "--command-timeout-ms",
      "3000"
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        OUROBOROS_TEST_SECRET: "test-secret-value"
      },
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.on("error", (error) => {
      resolve({ code: null, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

async function readCommands(pathname: string): Promise<string[][]> {
  return (await readFile(pathname, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function scriptOutput(result: { stdout: string; stderr: string }): string {
  return `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}
