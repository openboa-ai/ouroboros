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
    expect(lease.owned_allow_rule_ids).toEqual(["owned-allow-1"]);
    expect(lease.owned_deny_rule_ids).toEqual([]);
    expect(lease.inherited_allowed_resources).toEqual([]);
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
      "--id",
      "owned-allow-1"
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

  it("neutralizes inherited balanced-policy allows with a Sandbox-scoped deny overlay", async () => {
    const inheritedAllows = ["**.github.com:443", "registry.npmjs.org:443"];
    const fake = fakePolicyRuntime(inheritedAllows);

    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-balanced",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    });

    expect(fake.commands).toContainEqual([
      "sbx",
      "policy",
      "deny",
      "network",
      "--sandbox",
      "ouro-candidate-balanced",
      inheritedAllows.join(",")
    ]);
    expect(fake.deniedResources()).toEqual(inheritedAllows);
    expect(fake.allowedResources()).toEqual([...inheritedAllows, "localhost:4173"].sort());
    expect(lease.inherited_allowed_resources).toEqual(inheritedAllows);
    expect(lease.owned_deny_rule_ids).toEqual(["owned-deny-1", "owned-deny-2"]);
    expect(lease.owned_allow_rule_ids).toEqual(["owned-allow-3"]);

    await lease.release();

    expect(fake.allowedResources()).toEqual(inheritedAllows);
    expect(fake.deniedResources()).toEqual([]);
    const cleanup = fake.commands.filter((command) => command[2] === "rm");
    expect(cleanup).toHaveLength(3);
    expect(cleanup[0]).toContain("owned-allow-3");
    expect(cleanup[1]).toContain("owned-deny-1");
    expect(cleanup[2]).toContain("owned-deny-2");
  });

  it("neutralizes inherited allows for an in-Sandbox sidecar without adding a Gateway allow", async () => {
    const fake = fakePolicyRuntime(["registry.npmjs.org:443"]);

    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-sidecar-balanced",
      run_command: fake.run
    });

    expect(lease.allowed_resource).toBeUndefined();
    expect(lease.owned_allow_rule_ids).toEqual([]);
    expect(lease.owned_deny_rule_ids).toEqual(["owned-deny-1"]);
    expect(fake.commands.some((command) => command[2] === "allow")).toBe(false);

    await lease.release();

    expect(fake.deniedResources()).toEqual([]);
    expect(fake.commands.at(-1)).toContain("owned-deny-1");
  });

  it("fails closed and rolls back both owned rules when inherited wildcard deny blocks Gateway", async () => {
    const fake = fakePolicyRuntime(["**"]);

    await expect(acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-wildcard",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    })).rejects.toMatchObject({ code: "policy_check_failed" });

    expect(fake.allowedResources()).toEqual(["**"]);
    expect(fake.deniedResources()).toEqual([]);
    const cleanup = fake.commands.filter((command) => command[2] === "rm");
    expect(cleanup[0]).toContain("owned-allow-2");
    expect(cleanup[1]).toContain("owned-deny-1");
  });

  it("retains the deny overlay when owned Gateway allow cleanup fails", async () => {
    const fake = fakePolicyRuntime(["registry.npmjs.org:443"], {
      failedRemoveRuleId: "owned-allow-2"
    });
    const lease = await acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-cleanup-failure",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    });

    await expect(lease.release()).rejects.toMatchObject({ code: "policy_cleanup_failed" });

    expect(fake.deniedResources()).toEqual(["registry.npmjs.org:443"]);
    expect(fake.commands.filter((command) => command[2] === "rm")).toHaveLength(1);
  });

  it("fails closed when the created deny overlay is inactive", async () => {
    const fake = fakePolicyRuntime(["registry.npmjs.org:443"], {
      inactiveOwnedDecision: "deny"
    });

    await expect(acquireCandidateSandboxNetworkPolicy({
      sbx_path: "sbx",
      sandbox_name: "ouro-candidate-inactive-overlay",
      gateway_base_url: "http://host.docker.internal:4173",
      run_command: fake.run
    })).rejects.toMatchObject({ code: "policy_inspection_failed" });

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
      "--id",
      "owned-allow-1"
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
      "--id",
      "owned-allow-1"
    ]);
  });
});

function fakePolicyRuntime(
  initialResources: string[] = [],
  options: {
    failedRemoveRuleId?: string;
    inactiveOwnedDecision?: "allow" | "deny";
    unknownDecisionTarget?: string;
  } = {}
): {
  commands: string[][];
  run(command: string[]): Promise<CandidateSandboxNetworkCommandResult>;
  allowedResources(): string[];
  deniedResources(): string[];
} {
  const commands: string[][] = [];
  const allowRules = new Map<string, string[]>(
    initialResources.map((resource, index) => [`inherited-allow-${index + 1}`, [resource]])
  );
  const denyRules = new Map<string, string[]>();
  let nextRule = 1;
  const resourcesFor = (rules: Map<string, string[]>): string[] =>
    [...new Set([...rules.values()].flat())].sort();
  return {
    commands,
    allowedResources: () => resourcesFor(allowRules),
    deniedResources: () => resourcesFor(denyRules),
    run: async (command) => {
      commands.push([...command]);
      const args = command.slice(1);
      if (args[0] !== "policy") {
        return commandResult(command, 2, "", "unexpected command");
      }
      if (args[1] === "ls") {
        const decisionIndex = args.indexOf("--decision");
        const decision = decisionIndex >= 0 ? args[decisionIndex + 1] : undefined;
        const rules = decision === "deny" ? denyRules : allowRules;
        return commandResult(command, 0, JSON.stringify({
          rules: [...rules].map(([id, resources]) => ({
            id,
            decision: decision ?? "allow",
            resources,
            status: id.startsWith("owned-") && decision === options.inactiveOwnedDecision
              ? "inactive"
              : "active",
            scope: id.startsWith("inherited-") ? "global" : `sandbox:${command[3]}`,
            ...(id.startsWith("inherited-") ? {} : { sandbox_id: command[3] })
          }))
        }));
      }
      if (args[1] === "allow" && args[2] === "network") {
        allowRules.set(`owned-allow-${nextRule++}`, [args.at(-1)!]);
        return commandResult(command, 0, "rule added\n");
      }
      if (args[1] === "deny" && args[2] === "network") {
        for (const resource of args.at(-1)!.split(",")) {
          denyRules.set(`owned-deny-${nextRule++}`, [resource]);
        }
        return commandResult(command, 0, "rule added\n");
      }
      if (args[1] === "check" && args[2] === "network") {
        const target = args.at(-1)!;
        if (target === options.unknownDecisionTarget) {
          return commandResult(command, 0, JSON.stringify({ result: "unknown" }));
        }
        const denied = resourcesFor(denyRules).some((resource) => policyResourceMatches(resource, target));
        const allowed = resourcesFor(allowRules).some((resource) => policyResourceMatches(resource, target));
        const decision = denied || !allowed ? "deny" : "allow";
        return commandResult(command, decision === "allow" ? 0 : 1, JSON.stringify({ decision }));
      }
      if (args[1] === "log") {
        return commandResult(command, 0, JSON.stringify({ entries: [] }));
      }
      if (args[1] === "rm" && args[2] === "network") {
        const idIndex = args.indexOf("--id");
        const resourceIndex = args.indexOf("--resource");
        if (idIndex >= 0) {
          const ruleId = args[idIndex + 1]!;
          if (ruleId === options.failedRemoveRuleId) {
            return commandResult(command, 9, "", "rule removal failed");
          }
          allowRules.delete(ruleId);
          denyRules.delete(ruleId);
        } else if (resourceIndex >= 0) {
          const resourcesToRemove = new Set(args[resourceIndex + 1]!.split(","));
          for (const [id, resources] of [...allowRules, ...denyRules]) {
            if (resources.some((resource) => resourcesToRemove.has(resource))) {
              allowRules.delete(id);
              denyRules.delete(id);
            }
          }
        }
        return commandResult(command, 0, "rule removed\n");
      }
      return commandResult(command, 2, "", "unexpected policy command");
    }
  };
}

function policyResourceMatches(resource: string, target: string): boolean {
  if (resource === "**") {
    return true;
  }
  let normalizedTarget = target;
  if (target.includes("://")) {
    try {
      const parsed = new URL(target);
      normalizedTarget = `${parsed.hostname}:${parsed.port || (parsed.protocol === "http:" ? "80" : "443")}`;
    } catch {
      // Invalid targets remain unmatched and therefore denied by the fake runtime.
    }
  }
  const normalizedResource = resource.includes(":") ? resource : `${resource}:443`;
  if (normalizedResource.startsWith("**.")) {
    return normalizedTarget.endsWith(normalizedResource.slice(2));
  }
  return normalizedResource === normalizedTarget;
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
