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
        FAKE_SBX_POLICY_STATE: policyState,
        FAKE_SBX_INHERITED_ALLOW_JSON: '["**.github.com:443","registry.npmjs.org:443"]'
      });

      expect(result.code, scriptOutput(result)).toBe(0);
      expect(result.stdout).toContain("PROOF_RESULT passed");
      expect(result.stdout).toContain('"inherited_allow_count":2');
      expect(result.stdout).toContain('"owned_deny_rule_count":2');
      expect(result.stdout).not.toContain("test-secret-value");
      const commands = await readCommands(commandLog);
      const denyIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "deny"
      );
      const allowIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "allow"
      );
      const execIndex = commands.findIndex((args) => args[0] === "exec");
      const logIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "log"
      );
      const allowRemoveIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "rm" && args.at(-1) === "owned-allow"
      );
      const denyRemoveIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "rm" && args.at(-1) === "owned-deny-1"
      );
      const finalDenyRemoveIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "rm" && args.at(-1) === "owned-deny-2"
      );
      const policyRemoveIndex = commands.findIndex((args) =>
        args[0] === "policy" && args[1] === "rm"
      );
      const sandboxRemoveIndex = commands.findIndex((args) => args[0] === "rm");
      expect(denyIndex).toBeGreaterThan(0);
      expect(allowIndex).toBeGreaterThan(denyIndex);
      expect(execIndex).toBeGreaterThan(allowIndex);
      expect(logIndex).toBeGreaterThan(execIndex);
      expect(policyRemoveIndex).toBeGreaterThan(logIndex);
      expect(allowRemoveIndex).toBe(policyRemoveIndex);
      expect(denyRemoveIndex).toBeGreaterThan(allowRemoveIndex);
      expect(finalDenyRemoveIndex).toBeGreaterThan(denyRemoveIndex);
      expect(sandboxRemoveIndex).toBeGreaterThan(finalDenyRemoveIndex);
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
        FAKE_SBX_INHERITED_ALLOW_JSON: '["**.github.com:443","registry.npmjs.org:443"]',
        FAKE_SBX_PROBE_FAILURE: "1"
      });

      expect(result.code, scriptOutput(result)).toBe(1);
      expect(result.stderr).toContain("PROOF_RESULT failed stage=candidate_probe");
      expect(result.stderr).toContain("failed_probes=direct_https:allowed");
      const commands = await readCommands(commandLog);
      expect(commands.some((args) => args[0] === "policy" && args[1] === "log")).toBe(true);
      expect(commands.filter((args) => args[0] === "policy" && args[1] === "rm"))
        .toHaveLength(3);
      expect(commands.find((args) => args[0] === "policy" && args[1] === "rm")?.at(-1))
        .toBe("owned-allow");
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
    expect(fixture).toContain("client.sendall");
    expect(fixture).toContain("client.recv");
  });
});

async function writeFakeSbx(pathname: string): Promise<void> {
  const probeResults = requiredDeniedProbes.map((name) => ({
    name,
    expected: "denied",
    observed: "denied"
  }));
  const failedProbeResults = probeResults.map((probe) =>
    probe.name === "direct_https" ? { ...probe, observed: "allowed" } : probe
  );
  await writeFile(pathname, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_SBX_COMMAND_LOG, JSON.stringify(args) + "\\n");
const state = process.env.FAKE_SBX_POLICY_STATE;
const allowState = state + ".allow";
const denyState = state + ".deny";
const inheritedAllows = JSON.parse(process.env.FAKE_SBX_INHERITED_ALLOW_JSON || "[]");
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
      const decision = args.at(-1);
      const rules = [];
      if (decision === "allow" && inheritedAllows.length > 0) {
        rules.push({
          id: "inherited-allow",
          decision: "allow",
          status: "active",
          scope: "global",
          resources: inheritedAllows
        });
      }
      if (decision === "allow" && fs.existsSync(allowState)) {
        rules.push({
          id: "owned-allow",
          decision: "allow",
          status: "active",
          scope: "sandbox:" + args[2],
          sandbox_id: args[2],
          resources: [fs.readFileSync(allowState, "utf8").trim()]
        });
      }
      if (decision === "deny" && fs.existsSync(denyState)) {
        for (const [id, resource] of Object.entries(JSON.parse(fs.readFileSync(denyState, "utf8")))) {
          rules.push({
            id,
            decision: "deny",
            status: "active",
            scope: "sandbox:" + args[2],
            sandbox_id: args[2],
            resources: [resource]
          });
        }
      }
      console.log(JSON.stringify({ rules }));
      process.exit(0);
    }
    if (args[1] === "allow") {
      fs.writeFileSync(allowState, args.at(-1) + "\\n");
      process.exit(0);
    }
    if (args[1] === "deny") {
      fs.writeFileSync(denyState, JSON.stringify(Object.fromEntries(
        args.at(-1).split(",").map((resource, index) => ["owned-deny-" + (index + 1), resource])
      )));
      process.exit(0);
    }
    if (args[1] === "check") {
      const target = args.at(-1);
      const denied = fs.existsSync(denyState) &&
        Object.values(JSON.parse(fs.readFileSync(denyState, "utf8"))).includes("**");
      const allowed = !denied && fs.existsSync(allowState) &&
        fs.readFileSync(allowState, "utf8").trim() === target;
      console.log(JSON.stringify({ decision: allowed ? "allow" : "deny" }));
      process.exit(allowed ? 0 : 1);
    }
    if (args[1] === "log") {
      console.log(JSON.stringify({ entries: [] }));
      process.exit(0);
    }
    if (args[1] === "rm") {
      const ruleId = args.at(-1);
      if (ruleId === "owned-allow") {
        if (fs.existsSync(allowState)) fs.unlinkSync(allowState);
        process.exit(0);
      }
      if (!ruleId.startsWith("owned-deny-") || !fs.existsSync(denyState)) process.exit(2);
      const denyRules = JSON.parse(fs.readFileSync(denyState, "utf8"));
      delete denyRules[ruleId];
      if (Object.keys(denyRules).length === 0) fs.unlinkSync(denyState);
      else fs.writeFileSync(denyState, JSON.stringify(denyRules));
      process.exit(0);
    }
    process.exit(2);
  }
  case "exec":
    if (process.env.FAKE_SBX_PROBE_FAILURE) {
      console.log(JSON.stringify({
        protocol_version: "candidate-network-egress-probe/v1",
        gateway: { expected: "allowed", observed: "allowed" },
        probes: ${JSON.stringify(failedProbeResults)},
        passed: false
      }));
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
