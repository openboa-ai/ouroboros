import { describe, expect, it } from "vitest";
import {
  acquireCandidateSandboxNetworkPolicy,
  assertCandidateSandboxSbxVersion,
  CANDIDATE_NETWORK_DENY_PROBES,
  CandidateSandboxNetworkPolicyError,
  type CandidateSandboxNetworkCommandResult
} from "./candidate-sandbox-network-policy";

describe("candidate Sandbox network policy", () => {
  it("requires the stable sbx policy-check contract", () => {
    expect(() => assertCandidateSandboxSbxVersion(
      "Client Version:  v0.28.3 test\nServer Version:  v0.28.3 test\n"
    )).toThrowError(expect.objectContaining({ code: "unsupported_sbx_version" }));

    expect(() => assertCandidateSandboxSbxVersion(
      "sbx version: v0.35.0 01e01520456e4126a9653471e7072e4d9b280321\n"
    )).not.toThrow();
  });

  it("permits only the exact injected host Gateway and removes its scoped rule", async () => {
    const fake = fakePolicyRuntime();
    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "/usr/local/bin/sbx",
      sandbox_name: "ouro-candidate-1",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    });

    expect(lease.allowed_resource).toBe("localhost:4173");
    expect(lease.owned_rule).toBe(true);
    expect(fake.allowedResources()).toEqual(["localhost:4173"]);
    expect(fake.commands).toContainEqual([
      "/usr/local/bin/sbx",
      "policy",
      "check",
      "network",
      "--sandbox",
      "ouro-candidate-1",
      "--json",
      "localhost:4173"
    ]);
    for (const target of CANDIDATE_NETWORK_DENY_PROBES) {
      expect(fake.commands).toContainEqual([
        "/usr/local/bin/sbx",
        "policy",
        "check",
        "network",
        "--sandbox",
        "ouro-candidate-1",
        "--json",
        target
      ]);
    }

    await lease.release();

    expect(fake.allowedResources()).toEqual([]);
    expect(fake.commands.at(-2)).toEqual([
      "/usr/local/bin/sbx",
      "policy",
      "log",
      "ouro-candidate-1",
      "--json",
      "--limit",
      "100"
    ]);
    expect(fake.commands.at(-1)).toEqual([
      "/usr/local/bin/sbx",
      "policy",
      "rm",
      "network",
      "--sandbox",
      "ouro-candidate-1",
      "--resource",
      "localhost:4173"
    ]);
  });

  it("gives an in-Sandbox replay sidecar no host or public allow rule", async () => {
    const fake = fakePolicyRuntime();
    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-sidecar-1",
      run_command: fake.run
    });

    expect(lease.allowed_resource).toBeUndefined();
    expect(lease.owned_rule).toBe(false);
    expect(fake.commands.some((command) => command[2] === "allow")).toBe(false);

    await lease.release();
    expect(fake.commands.some((command) => command[2] === "rm")).toBe(false);
  });

  it("rechecks the full deny matrix for every Sandbox", async () => {
    const fake = fakePolicyRuntime();
    const first = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-sidecar-cache-1",
      run_command: fake.run
    });
    await first.release();
    const second = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-sidecar-cache-2",
      run_command: fake.run
    });
    await second.release();

    expect(fake.commands.filter((command) =>
      command[1] === "policy" && command[2] === "check"
    )).toHaveLength(CANDIDATE_NETWORK_DENY_PROBES.length * 2);
    expect(fake.commands.filter((command) =>
      command[1] === "policy" && command[2] === "ls"
    )).toHaveLength(2);
  });

  it("fails closed when any unrelated effective allow rule exists", async () => {
    const fake = fakePolicyRuntime(["registry.npmjs.org"]);

    await expect(acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-broad",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    })).rejects.toMatchObject({
      code: "unexpected_network_allow"
    });
    expect(fake.commands.some((command) => command[2] === "allow")).toBe(false);
  });

  it("fails closed when an exact but unowned Gateway rule already exists", async () => {
    const fake = fakePolicyRuntime(["localhost:4173"]);

    await expect(acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-unowned",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    })).rejects.toMatchObject({
      code: "unexpected_network_allow"
    });
    expect(fake.allowedResources()).toEqual(["localhost:4173"]);
    expect(fake.commands.some((command) => command[2] === "allow")).toBe(false);
  });

  it("rejects non-local, credentialed, and path-bearing Gateway URLs", async () => {
    const invalidUrls = [
      "https://host.docker.internal:4173",
      "http://127.0.0.1:4173",
      "http://user:password@host.docker.internal:4173",
      "http://host.docker.internal:4173/other"
    ];

    for (const gatewayBaseUrl of invalidUrls) {
      const fake = fakePolicyRuntime();
      await expect(acquireCandidateSandboxNetworkPolicy({
        sbx_path: "sbx",
        sandbox_name: "ouro-candidate-invalid",
        gateway_base_url: gatewayBaseUrl,
        run_command: fake.run
      })).rejects.toMatchObject({ code: "invalid_gateway_url" });
      expect(fake.commands).toEqual([]);
    }
  });

  it("rolls back an added Gateway rule when policy decision JSON drifts", async () => {
    const fake = fakePolicyRuntime([], { unknownDecisionTarget: "https://example.com" });

    await expect(acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-json-drift",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    })).rejects.toBeInstanceOf(CandidateSandboxNetworkPolicyError);

    expect(fake.allowedResources()).toEqual([]);
    expect(fake.commands.at(-1)).toEqual([
      "sbx",
      "policy",
      "rm",
      "network",
      "--sandbox",
      "ouro-candidate-json-drift",
      "--resource",
      "localhost:4173"
    ]);
  });

  it("removes its owned rule when policy log collection throws", async () => {
    const fake = fakePolicyRuntime();
    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-log-throws",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: async (command) => {
        if (command[1] === "policy" && command[2] === "log") {
          throw new Error("policy log transport failed");
        }
        return fake.run(command);
      }
    });

    await expect(lease.release()).rejects.toMatchObject({
      code: "policy_log_failed"
    });
    expect(fake.allowedResources()).toEqual([]);
    expect(fake.commands.at(-1)).toEqual([
      "sbx",
      "policy",
      "rm",
      "network",
      "--sandbox",
      "ouro-candidate-log-throws",
      "--resource",
      "localhost:4173"
    ]);
  });
});

function fakePolicyRuntime(
  initialResources: string[] = [],
  options: { unknownDecisionTarget?: string } = {}
): {
  commands: string[][];
  run(command: string[]): Promise<CandidateSandboxNetworkCommandResult>;
  allowedResources(): string[];
} {
  const commands: string[][] = [];
  const resources = new Set(initialResources);
  return {
    commands,
    allowedResources: () => [...resources].sort(),
    run: async (command) => {
      commands.push([...command]);
      const args = command.slice(1);
      if (args[0] !== "policy") {
        return commandResult(command, 2, "", "unexpected command");
      }
      if (args[1] === "ls") {
        return commandResult(command, 0, JSON.stringify({
          rules: [...resources].map((resource, index) => ({
            id: `rule-${index}`,
            decision: "allow",
            resources: [resource],
            status: "active"
          }))
        }));
      }
      if (args[1] === "allow" && args[2] === "network") {
        resources.add(args.at(-1)!);
        return commandResult(command, 0, "rule added\n");
      }
      if (args[1] === "check" && args[2] === "network") {
        const target = args.at(-1)!;
        if (target === options.unknownDecisionTarget) {
          return commandResult(command, 0, JSON.stringify({ result: "unknown" }));
        }
        const decision = resources.has(target) ? "allow" : "deny";
        return commandResult(command, decision === "allow" ? 0 : 1, JSON.stringify({ decision }));
      }
      if (args[1] === "log") {
        return commandResult(command, 0, JSON.stringify({ entries: [] }));
      }
      if (args[1] === "rm" && args[2] === "network") {
        resources.delete(args.at(-1)!);
        return commandResult(command, 0, "rule removed\n");
      }
      return commandResult(command, 2, "", "unexpected policy command");
    }
  };
}

function commandResult(
  command: string[],
  exitCode: number,
  stdout = "",
  stderr = ""
): CandidateSandboxNetworkCommandResult {
  return {
    command: [...command],
    exit_code: exitCode,
    stdout,
    stderr
  };
}
