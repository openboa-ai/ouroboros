import { createHash } from "node:crypto";
import {
  candidateEgressNetworkPolicyDigestInput,
  CANDIDATE_EGRESS_NETWORK_POLICY_PROTOCOL_VERSION,
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS,
  type CandidateEgressNetworkPolicyIdentity
} from "@ouroboros/domain";

export const CANDIDATE_SBX_MINIMUM_VERSION = "0.35.0";

export const CANDIDATE_NETWORK_DENY_PROBES =
  CANDIDATE_EGRESS_REQUIRED_DENY_TARGETS;

export interface CandidateSandboxNetworkCommandResult {
  command: string[];
  exit_code: number | null;
  stdout: string;
  stderr: string;
  error_message?: string;
}

export type CandidateSandboxNetworkPolicyErrorCode =
  | "unsupported_sbx_version"
  | "invalid_gateway_url"
  | "policy_inspection_failed"
  | "unexpected_network_allow"
  | "policy_overlay_failed"
  | "gateway_rule_failed"
  | "policy_check_failed"
  | "policy_log_failed"
  | "policy_cleanup_failed";

export class CandidateSandboxNetworkPolicyError extends Error {
  constructor(
    readonly code: CandidateSandboxNetworkPolicyErrorCode,
    message: string,
    readonly command_results: CandidateSandboxNetworkCommandResult[] = []
  ) {
    super(`${code}: ${message}`);
    this.name = "CandidateSandboxNetworkPolicyError";
  }
}

export interface CandidateSandboxNetworkPolicyInput<
  Result extends CandidateSandboxNetworkCommandResult
> {
  sbx_path: string;
  sandbox_name: string;
  sandbox_implementation_version: string;
  gateway_base_url?: string;
  now?(): string;
  run_command(command: string[]): Promise<Result>;
  on_evidence?(result: Result): void;
}

export interface CandidateSandboxNetworkPolicyAttestationEvidence {
  readonly sandbox: {
    readonly adapter_kind: "docker_sandboxes_sbx";
    readonly sandbox_name: string;
    readonly implementation_version: string;
  };
  readonly network_policy: CandidateEgressNetworkPolicyIdentity;
  readonly network_policy_digest: string;
  readonly start: {
    readonly observed_at: string;
    readonly policy_digest: string;
  };
  readonly end: {
    readonly observed_at: string;
    readonly policy_digest: string;
  };
  readonly denial_summary: {
    readonly required_probe_count: number;
    readonly start_denied_probe_count: number;
    readonly end_denied_probe_count: number;
    readonly unexpected_allow_count: number;
  };
  readonly cleanup_status: "released";
  readonly enforcement_result: "enforced";
}

export interface CandidateSandboxNetworkPolicyLease<
  Result extends CandidateSandboxNetworkCommandResult = CandidateSandboxNetworkCommandResult
> {
  readonly allowed_resource?: string;
  readonly inherited_allowed_resources: readonly string[];
  readonly owned_allow_rule_ids: readonly string[];
  readonly owned_deny_rule_ids: readonly string[];
  readonly owned_rule: boolean;
  readonly setup_results: Result[];
  attestation_evidence(): CandidateSandboxNetworkPolicyAttestationEvidence | undefined;
  release(): Promise<Result[]>;
}

export interface CandidateSandboxNetworkPolicyReleaseInput<
  Result extends CandidateSandboxNetworkCommandResult
> {
  sbx_path: string;
  sandbox_name: string;
  owned_allow_rule_ids?: readonly string[];
  owned_deny_rule_ids?: readonly string[];
  run_command(command: string[]): Promise<Result>;
  on_evidence?(result: Result): void;
}

export interface CandidateSandboxNetworkPolicyRuleRecoveryInput<
  Result extends CandidateSandboxNetworkCommandResult
> {
  sbx_path: string;
  sandbox_name: string;
  decision: "allow" | "deny";
  resources: readonly string[];
  run_command(command: string[]): Promise<Result>;
  on_evidence?(result: Result): void;
}

export async function recoverCandidateSandboxNetworkPolicyRuleId<
  Result extends CandidateSandboxNetworkCommandResult
>(input: CandidateSandboxNetworkPolicyRuleRecoveryInput<Result>): Promise<string> {
  const commandResults: Result[] = [];
  const execute = async (command: string[]): Promise<Result> => {
    const result = await input.run_command(command);
    commandResults.push(result);
    input.on_evidence?.(result);
    return result;
  };
  const resources = normalizedPolicyResources([...input.resources]);
  const rules = await inspectNetworkRules(input, execute, input.decision);
  const matching = rules.filter((rule) =>
    sameStrings(rule.resources, resources) && isSandboxScopedRule(rule, input.sandbox_name)
  );
  if (matching.length !== 1) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `expected one recoverable ${input.decision} rule, received ${String(matching.length)}`,
      commandResults
    );
  }
  return matching[0]!.id;
}

export function assertCandidateSandboxSbxVersion(stdout: string): void {
  const version = parseCandidateSandboxSbxVersion(stdout);
  assertCandidateSandboxImplementationVersion(version);
}

export function parseCandidateSandboxSbxVersion(stdout: string): string | undefined {
  const current = stdout.match(/\bsbx version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
  if (current) {
    return current;
  }
  return stdout.match(/\bClient Version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
}

export async function acquireCandidateSandboxNetworkPolicy<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: CandidateSandboxNetworkPolicyInput<Result>
): Promise<CandidateSandboxNetworkPolicyLease<Result>> {
  const sandboxImplementationVersion = assertCandidateSandboxImplementationVersion(
    input.sandbox_implementation_version
  );
  assertBoundedPolicyMetadata(input.sandbox_name, 128, "Sandbox name");
  const allowedResource = input.gateway_base_url
    ? candidateGatewayPolicyResource(input.gateway_base_url)
    : undefined;
  const commandResults: Result[] = [];
  const execute = async (command: string[]): Promise<Result> => {
    const result = await input.run_command(command);
    commandResults.push(result);
    input.on_evidence?.(result);
    return result;
  };
  let ownedAllowRuleIds: string[] = [];
  let ownedDenyRuleIds: string[] = [];
  let ownedAllowRules: ActiveNetworkRule[] = [];
  let ownedDenyRules: ActiveNetworkRule[] = [];
  let inheritedAllowedResources: string[] = [];
  let networkPolicy: CandidateSandboxNetworkPolicyAttestationEvidence["network_policy"];
  let networkPolicyDigest: string;
  let startObservation: CandidateSandboxNetworkPolicyAttestationEvidence["start"];

  try {
    const beforeAllowRules = await inspectNetworkRules(input, execute, "allow");
    inheritedAllowedResources = ruleResources(beforeAllowRules);
    if (allowedResource && inheritedAllowedResources.includes(allowedResource)) {
      throw new CandidateSandboxNetworkPolicyError(
        "unexpected_network_allow",
        `exact Gateway allow ${allowedResource} already exists without runner ownership`,
        commandResults
      );
    }

    if (inheritedAllowedResources.length > 0) {
      const beforeDenyRules = await inspectNetworkRules(input, execute, "deny");
      ownedDenyRules = await addSandboxScopedNetworkRules({
        input,
        execute,
        decision: "deny",
        resources: inheritedAllowedResources,
        before_rules: beforeDenyRules,
        failure_code: "policy_overlay_failed"
      });
      ownedDenyRuleIds = ownedDenyRules.map((rule) => rule.id);
    }

    if (allowedResource) {
      ownedAllowRules = await addSandboxScopedNetworkRules({
        input,
        execute,
        decision: "allow",
        resources: [allowedResource],
        before_rules: beforeAllowRules,
        failure_code: "gateway_rule_failed"
      });
      ownedAllowRuleIds = ownedAllowRules.map((rule) => rule.id);
    }

    if (allowedResource) {
      await assertPolicyDecision(input, execute, allowedResource, "allow");
    }
    for (const target of CANDIDATE_NETWORK_DENY_PROBES) {
      await assertPolicyDecision(input, execute, target, "deny");
    }
    networkPolicy = candidateSandboxNetworkPolicyIdentity({
      inherited_allowed_resources: inheritedAllowedResources,
      owned_allow_rule_ids: ownedAllowRuleIds,
      owned_deny_rule_ids: ownedDenyRuleIds,
      ...(allowedResource ? { gateway_resource: allowedResource } : {})
    });
    networkPolicyDigest = candidateSandboxNetworkPolicyDigest(networkPolicy);
    startObservation = policyObservation(input.now, networkPolicyDigest);
  } catch (error) {
    try {
      await execute(policyLogCommand(input));
    } catch {
      // Preserve the primary setup failure and continue owned-rule rollback.
    }
    const cleanupFailure = await removeOwnedRuleIds(ownedAllowRuleIds, input, execute) ??
      await removeOwnedRuleIds(ownedDenyRuleIds, input, execute);
    if (cleanupFailure) {
      throw new CandidateSandboxNetworkPolicyError(
        "policy_cleanup_failed",
        commandFailure(cleanupFailure),
        commandResults
      );
    }
    throw policyError(error, commandResults);
  }

  let released = false;
  let attestationEvidence: CandidateSandboxNetworkPolicyAttestationEvidence | undefined;
  return {
    ...(allowedResource ? { allowed_resource: allowedResource } : {}),
    inherited_allowed_resources: [...inheritedAllowedResources],
    owned_allow_rule_ids: [...ownedAllowRuleIds],
    owned_deny_rule_ids: [...ownedDenyRuleIds],
    owned_rule: ownedAllowRuleIds.length > 0 || ownedDenyRuleIds.length > 0,
    setup_results: [...commandResults],
    attestation_evidence: () => attestationEvidence
      ? copyCandidateSandboxNetworkPolicyAttestationEvidence(attestationEvidence)
      : undefined,
    release: async () => {
      if (released) {
        return [];
      }
      released = true;
      const releaseResults: Result[] = [];
      const recordReleaseResult = (result: Result): void => {
        releaseResults.push(result);
        commandResults.push(result);
        input.on_evidence?.(result);
      };
      const verify = async (command: string[]): Promise<Result> => {
        const result = await input.run_command(command);
        recordReleaseResult(result);
        return result;
      };
      let terminalFailure: unknown;
      let endObservation: CandidateSandboxNetworkPolicyAttestationEvidence["end"] | undefined;
      try {
        await assertTerminalPolicyIdentity({
          input,
          execute: verify,
          inherited_allowed_resources: inheritedAllowedResources,
          owned_allow_rules: ownedAllowRules,
          owned_deny_rules: ownedDenyRules
        });
        if (allowedResource) {
          await assertPolicyDecision(input, verify, allowedResource, "allow");
        }
        for (const target of CANDIDATE_NETWORK_DENY_PROBES) {
          await assertPolicyDecision(input, verify, target, "deny");
        }
        endObservation = policyObservation(
          input.now,
          networkPolicyDigest,
          startObservation.observed_at
        );
      } catch (error) {
        terminalFailure = error;
      }

      let releaseFailure: unknown;
      try {
        await releaseCandidateSandboxNetworkPolicy({
          sbx_path: input.sbx_path,
          sandbox_name: input.sandbox_name,
          owned_allow_rule_ids: ownedAllowRuleIds,
          owned_deny_rule_ids: ownedDenyRuleIds,
          run_command: input.run_command,
          on_evidence: recordReleaseResult
        });
      } catch (error) {
        releaseFailure = error;
      }
      if (releaseFailure) {
        throw policyError(releaseFailure, releaseResults);
      }
      if (terminalFailure) {
        throw policyError(terminalFailure, releaseResults);
      }
      if (!endObservation) {
        throw new CandidateSandboxNetworkPolicyError(
          "policy_check_failed",
          "terminal policy observation was not recorded",
          releaseResults
        );
      }
      attestationEvidence = {
        sandbox: {
          adapter_kind: "docker_sandboxes_sbx",
          sandbox_name: input.sandbox_name,
          implementation_version: sandboxImplementationVersion
        },
        network_policy: copyCandidateSandboxNetworkPolicyIdentity(networkPolicy),
        network_policy_digest: networkPolicyDigest,
        start: { ...startObservation },
        end: { ...endObservation },
        denial_summary: {
          required_probe_count: CANDIDATE_NETWORK_DENY_PROBES.length,
          start_denied_probe_count: CANDIDATE_NETWORK_DENY_PROBES.length,
          end_denied_probe_count: CANDIDATE_NETWORK_DENY_PROBES.length,
          unexpected_allow_count: 0
        },
        cleanup_status: "released",
        enforcement_result: "enforced"
      };
      return releaseResults;
    }
  };
}

export async function releaseCandidateSandboxNetworkPolicy<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: CandidateSandboxNetworkPolicyReleaseInput<Result>
): Promise<Result[]> {
  const releaseResults: Result[] = [];
  const release = async (command: string[]): Promise<Result> => {
    const result = await input.run_command(command);
    releaseResults.push(result);
    input.on_evidence?.(result);
    return result;
  };
  let policyLog: Result | undefined;
  let policyLogError: unknown;
  try {
    policyLog = await release(policyLogCommand(input));
  } catch (error) {
    policyLogError = error;
  }
  const cleanupFailure = await removeOwnedRuleIds(
    input.owned_allow_rule_ids ?? [],
    input,
    release
  ) ?? await removeOwnedRuleIds(input.owned_deny_rule_ids ?? [], input, release);
  if (cleanupFailure) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_cleanup_failed",
      commandFailure(cleanupFailure),
      releaseResults
    );
  }
  if (policyLogError) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_log_failed",
      policyLogError instanceof Error ? policyLogError.message : String(policyLogError),
      releaseResults
    );
  }
  if (!policyLog || policyLog.exit_code !== 0) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_log_failed",
      policyLog ? commandFailure(policyLog) : "policy log produced no result",
      releaseResults
    );
  }
  return releaseResults;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function assertCandidateSandboxImplementationVersion(
  version: string | undefined
): string {
  const parts = version?.split(".").map(Number) ?? [];
  if (
    !version ||
    version.length > 64 ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    parts.length !== 3 ||
    parts.some((part) => !Number.isSafeInteger(part) || part < 0) ||
    compareVersions(version, CANDIDATE_SBX_MINIMUM_VERSION) < 0
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "unsupported_sbx_version",
      `generated-candidate execution requires stable sbx >= ${CANDIDATE_SBX_MINIMUM_VERSION}`
    );
  }
  return version;
}

function candidateSandboxNetworkPolicyIdentity(input: {
  inherited_allowed_resources: readonly string[];
  owned_allow_rule_ids: readonly string[];
  owned_deny_rule_ids: readonly string[];
  gateway_resource?: string;
}): CandidateSandboxNetworkPolicyAttestationEvidence["network_policy"] {
  const inheritedAllowedResources = normalizedPolicyResources([
    ...input.inherited_allowed_resources
  ]);
  const ownedAllowRuleIds = normalizedOwnedRuleIds(input.owned_allow_rule_ids);
  const ownedDenyRuleIds = normalizedOwnedRuleIds(input.owned_deny_rule_ids);
  if (
    (input.gateway_resource !== undefined && ownedAllowRuleIds.length !== 1) ||
    (input.gateway_resource === undefined && ownedAllowRuleIds.length !== 0)
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      "Gateway policy identity must bind one exact owned allow rule"
    );
  }
  return {
    protocol_version: CANDIDATE_EGRESS_NETWORK_POLICY_PROTOCOL_VERSION,
    inherited_allow_digest: sha256CandidatePolicy(
      JSON.stringify(inheritedAllowedResources)
    ),
    inherited_allow_count: inheritedAllowedResources.length,
    owned_allow_rule_ids: ownedAllowRuleIds,
    owned_deny_rule_ids: ownedDenyRuleIds,
    ...(input.gateway_resource !== undefined
      ? { gateway_resource: input.gateway_resource }
      : {}),
    deny_targets: [...CANDIDATE_NETWORK_DENY_PROBES]
  };
}

function candidateSandboxNetworkPolicyDigest(
  identity: CandidateSandboxNetworkPolicyAttestationEvidence["network_policy"]
): string {
  return sha256CandidatePolicy(candidateEgressNetworkPolicyDigestInput(identity));
}

function normalizedOwnedRuleIds(ruleIds: readonly string[]): string[] {
  const normalized = [...new Set(ruleIds)].sort();
  if (normalized.length !== ruleIds.length || normalized.length > 512) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      "owned network policy rule IDs cannot be represented safely"
    );
  }
  for (const ruleId of normalized) {
    assertBoundedPolicyMetadata(ruleId, 256, "Owned network policy rule ID");
  }
  return normalized;
}

function policyObservation(
  now: (() => string) | undefined,
  policyDigest: string,
  notBefore?: string
): CandidateSandboxNetworkPolicyAttestationEvidence["start"] {
  const observedAt = (now ?? (() => new Date().toISOString()))();
  if (
    typeof observedAt !== "string" ||
    !Number.isFinite(Date.parse(observedAt)) ||
    new Date(observedAt).toISOString() !== observedAt ||
    (notBefore !== undefined && Date.parse(observedAt) < Date.parse(notBefore))
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_check_failed",
      "network policy observation clock must return a non-regressing ISO timestamp"
    );
  }
  return {
    observed_at: observedAt,
    policy_digest: policyDigest
  };
}

function copyCandidateSandboxNetworkPolicyIdentity(
  identity: CandidateSandboxNetworkPolicyAttestationEvidence["network_policy"]
): CandidateSandboxNetworkPolicyAttestationEvidence["network_policy"] {
  return {
    protocol_version: identity.protocol_version,
    inherited_allow_digest: identity.inherited_allow_digest,
    inherited_allow_count: identity.inherited_allow_count,
    owned_allow_rule_ids: [...identity.owned_allow_rule_ids],
    owned_deny_rule_ids: [...identity.owned_deny_rule_ids],
    ...(identity.gateway_resource
      ? { gateway_resource: identity.gateway_resource }
      : {}),
    deny_targets: [...identity.deny_targets]
  };
}

function copyCandidateSandboxNetworkPolicyAttestationEvidence(
  evidence: CandidateSandboxNetworkPolicyAttestationEvidence
): CandidateSandboxNetworkPolicyAttestationEvidence {
  return {
    sandbox: { ...evidence.sandbox },
    network_policy: copyCandidateSandboxNetworkPolicyIdentity(evidence.network_policy),
    network_policy_digest: evidence.network_policy_digest,
    start: { ...evidence.start },
    end: { ...evidence.end },
    denial_summary: { ...evidence.denial_summary },
    cleanup_status: evidence.cleanup_status,
    enforcement_result: evidence.enforcement_result
  };
}

function sha256CandidatePolicy(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function assertBoundedPolicyMetadata(
  value: unknown,
  maxLength: number,
  label: string
): asserts value is string {
  if (!boundedPolicyMetadata(value, maxLength)) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `${label} cannot be represented safely`
    );
  }
}

function boundedPolicyMetadata(value: unknown, maxLength: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function candidateGatewayPolicyResource(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new CandidateSandboxNetworkPolicyError(
      "invalid_gateway_url",
      "Gateway base URL must be an absolute URL"
    );
  }
  const port = Number(parsed.port);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname.toLowerCase() !== "host.docker.internal" ||
    !parsed.port ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65_535 ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "invalid_gateway_url",
      "Gateway must be http://host.docker.internal:<unprivileged-port> with no credentials or path"
    );
  }
  return `localhost:${port}`;
}

interface ActiveNetworkRule {
  id: string;
  decision: "allow" | "deny";
  resources: string[];
  scope?: string;
  applies_to?: string;
  sandbox_id?: string;
}

async function assertTerminalPolicyIdentity<
  Result extends CandidateSandboxNetworkCommandResult
>(input: {
  input: CandidateSandboxNetworkPolicyInput<Result>;
  execute(command: string[]): Promise<Result>;
  inherited_allowed_resources: readonly string[];
  owned_allow_rules: readonly ActiveNetworkRule[];
  owned_deny_rules: readonly ActiveNetworkRule[];
}): Promise<void> {
  const allowRules = await inspectNetworkRules(input.input, input.execute, "allow");
  const denyRules = await inspectNetworkRules(input.input, input.execute, "deny");
  assertExactOwnedRules(
    allowRules,
    input.owned_allow_rules,
    input.input.sandbox_name,
    "allow"
  );
  assertExactOwnedRules(
    denyRules,
    input.owned_deny_rules,
    input.input.sandbox_name,
    "deny"
  );
  const ownedAllowIds = new Set(input.owned_allow_rules.map((rule) => rule.id));
  const inheritedAllowedResources = ruleResources(
    allowRules.filter((rule) => !ownedAllowIds.has(rule.id))
  );
  if (!sameStrings(inheritedAllowedResources, input.inherited_allowed_resources)) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      "inherited network allow identity changed before terminal release"
    );
  }
}

function assertExactOwnedRules(
  currentRules: readonly ActiveNetworkRule[],
  expectedRules: readonly ActiveNetworkRule[],
  sandboxName: string,
  decision: "allow" | "deny"
): void {
  const expectedIds = expectedRules.map((rule) => rule.id).sort();
  const expectedIdSet = new Set(expectedIds);
  const currentOwnedRules = currentRules
    .filter((rule) => expectedIdSet.has(rule.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (!sameStrings(currentOwnedRules.map((rule) => rule.id), expectedIds)) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `owned ${decision} rule IDs changed before terminal release`
    );
  }
  const currentById = new Map(currentOwnedRules.map((rule) => [rule.id, rule]));
  for (const expected of expectedRules) {
    const current = currentById.get(expected.id);
    if (
      !current ||
      current.decision !== decision ||
      !sameStrings(current.resources, expected.resources) ||
      !isSandboxScopedRule(current, sandboxName)
    ) {
      throw new CandidateSandboxNetworkPolicyError(
        "policy_inspection_failed",
        `owned ${decision} rule ${expected.id} changed before terminal release`
      );
    }
  }
}

async function inspectNetworkRules<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: {
    sbx_path: string;
    sandbox_name: string;
  },
  execute: (command: string[]) => Promise<Result>,
  decision: "allow" | "deny"
): Promise<ActiveNetworkRule[]> {
  const result = await execute([
    input.sbx_path,
    "policy",
    "ls",
    input.sandbox_name,
    "--json",
    "--type",
    "network",
    "--decision",
    decision
  ]);
  if (result.exit_code !== 0) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      commandFailure(result),
      [result]
    );
  }
  try {
    return parseNetworkRules(result.stdout, decision);
  } catch (error) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      error instanceof Error ? error.message : String(error),
      [result]
    );
  }
}

function parseNetworkRules(
  stdout: string,
  expectedDecision: "allow" | "deny"
): ActiveNetworkRule[] {
  const parsed = JSON.parse(stdout) as unknown;
  const ruleObjects: Record<string, unknown>[] = [];
  collectRuleObjects(parsed, ruleObjects);
  if (ruleObjects.length === 0) {
    if (isEmptyRuleCollection(parsed)) {
      return [];
    }
    throw new Error("policy list did not contain a recognized rule collection");
  }
  const rules: ActiveNetworkRule[] = [];
  const ids = new Set<string>();
  for (const rule of ruleObjects) {
    if (String(rule.status ?? "active").toLowerCase() === "inactive") {
      continue;
    }
    const decision = normalizedDecision(rule.decision ?? rule.effect);
    if (decision !== expectedDecision) {
      continue;
    }
    const id = typeof rule.id === "string" ? rule.id : undefined;
    if (!id || !boundedPolicyMetadata(id, 256) || ids.has(id)) {
      throw new Error("active network rule did not expose one unique id");
    }
    const values = stringLeaves(rule.resources);
    if (values.length === 0) {
      throw new Error("active network rule did not expose resources");
    }
    const resources = normalizedPolicyResources(values);
    ids.add(id);
    rules.push({
      id,
      decision,
      resources,
      ...(typeof rule.scope === "string" ? { scope: rule.scope } : {}),
      ...(typeof rule.applies_to === "string" ? { applies_to: rule.applies_to } : {}),
      ...(typeof rule.sandbox_id === "string" ? { sandbox_id: rule.sandbox_id } : {})
    });
  }
  return rules.sort((left, right) => left.id.localeCompare(right.id));
}

function collectRuleObjects(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRuleObjects(item, output);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if ("decision" in value || "effect" in value) {
    output.push(value);
    return;
  }
  for (const child of Object.values(value)) {
    collectRuleObjects(child, output);
  }
}

function isEmptyRuleCollection(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (!isRecord(value)) {
    return false;
  }
  for (const key of ["rules", "items", "policies", "data"]) {
    if (key in value && Array.isArray(value[key]) && value[key].length === 0) {
      return true;
    }
  }
  return false;
}

function stringLeaves(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringLeaves);
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(stringLeaves);
  }
  return [];
}

function ruleResources(rules: ActiveNetworkRule[]): string[] {
  return normalizedPolicyResources(rules.flatMap((rule) => rule.resources));
}

function normalizedPolicyResources(resources: string[]): string[] {
  const normalized = [...new Set(resources)].sort();
  if (
    normalized.length > 512 ||
    normalized.some((resource) =>
      resource.length === 0 ||
      resource.length > 1_024 ||
      resource !== resource.trim() ||
      resource.includes(",") ||
      /[\u0000-\u001f\u007f]/.test(resource)
    ) ||
    normalized.join(",").length > 32_768
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      "active network policy resources cannot be represented safely"
    );
  }
  return normalized;
}

async function addSandboxScopedNetworkRules<
  Result extends CandidateSandboxNetworkCommandResult
>(input: {
  input: CandidateSandboxNetworkPolicyInput<Result>;
  execute(command: string[]): Promise<Result>;
  decision: "allow" | "deny";
  resources: string[];
  before_rules: ActiveNetworkRule[];
  failure_code: "gateway_rule_failed" | "policy_overlay_failed";
}): Promise<ActiveNetworkRule[]> {
  const resources = normalizedPolicyResources(input.resources);
  const mutation = await input.execute([
    input.input.sbx_path,
    "policy",
    input.decision,
    "network",
    "--sandbox",
    input.input.sandbox_name,
    resources.join(",")
  ]);
  if (mutation.exit_code !== 0) {
    throw new CandidateSandboxNetworkPolicyError(
      input.failure_code,
      commandFailure(mutation),
      [mutation]
    );
  }
  const priorIds = new Set(input.before_rules.map((rule) => rule.id));
  const after = await inspectNetworkRules(input.input, input.execute, input.decision);
  const created = after.filter((rule) => !priorIds.has(rule.id));
  if (created.length === 0) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `expected at least one owned ${input.decision} rule`
    );
  }
  if (
    created.length > 512 ||
    !sameStrings(ruleResources(created), resources) ||
    created.some((rule) => !isSandboxScopedRule(rule, input.input.sandbox_name))
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `owned ${input.decision} rules did not match the requested Sandbox scope and resources`
    );
  }
  return created;
}

async function removeOwnedRuleIds<Result extends CandidateSandboxNetworkCommandResult>(
  ruleIds: readonly string[],
  input: Pick<CandidateSandboxNetworkPolicyInput<Result>, "sbx_path" | "sandbox_name">,
  execute: (command: string[]) => Promise<Result>
): Promise<Result | undefined> {
  let firstFailure: Result | undefined;
  for (const ruleId of ruleIds) {
    const cleanup = await execute(removeRuleByIdCommand(input, ruleId));
    if (cleanup.exit_code !== 0 && !firstFailure) {
      firstFailure = cleanup;
    }
  }
  return firstFailure;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isSandboxScopedRule(rule: ActiveNetworkRule, sandboxName: string): boolean {
  const expected = `sandbox:${sandboxName}`;
  return rule.sandbox_id === sandboxName || rule.scope === expected || rule.applies_to === expected;
}

async function assertPolicyDecision<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: CandidateSandboxNetworkPolicyInput<Result>,
  execute: (command: string[]) => Promise<Result>,
  target: string,
  expected: "allow" | "deny"
): Promise<void> {
  const result = await execute([
    input.sbx_path,
    "policy",
    "check",
    "network",
    "--sandbox",
    input.sandbox_name,
    "--json",
    target
  ]);
  let decision: "allow" | "deny";
  try {
    decision = parsePolicyDecision(result.stdout);
  } catch (error) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_check_failed",
      error instanceof Error ? error.message : String(error),
      [result]
    );
  }
  const acceptedExitCode = expected === "allow"
    ? result.exit_code === 0
    : result.exit_code === 0 || result.exit_code === 1;
  if (!acceptedExitCode || decision !== expected) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_check_failed",
      `${target} expected ${expected}, received ${decision} with exit ${String(result.exit_code)}`,
      [result]
    );
  }
}

function parsePolicyDecision(stdout: string): "allow" | "deny" {
  const parsed = JSON.parse(stdout) as unknown;
  const decisions = new Set<"allow" | "deny">();
  collectDecisions(parsed, decisions);
  if (decisions.size !== 1) {
    throw new Error("policy check JSON did not contain one unambiguous decision");
  }
  return [...decisions][0]!;
}

function collectDecisions(value: unknown, output: Set<"allow" | "deny">): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectDecisions(item, output);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (typeof value.allowed === "boolean") {
    output.add(value.allowed ? "allow" : "deny");
  }
  for (const key of ["decision", "result", "outcome", "effect", "verdict"]) {
    const decision = normalizedDecision(value[key]);
    if (decision) {
      output.add(decision);
    }
  }
  for (const child of Object.values(value)) {
    collectDecisions(child, output);
  }
}

function normalizedDecision(value: unknown): "allow" | "deny" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "allow" || normalized === "allowed") {
    return "allow";
  }
  if (
    normalized === "deny" ||
    normalized === "denied" ||
    normalized === "block" ||
    normalized === "blocked"
  ) {
    return "deny";
  }
  return undefined;
}

function removeRuleByIdCommand(
  input: Pick<CandidateSandboxNetworkPolicyInput<CandidateSandboxNetworkCommandResult>,
    "sbx_path" | "sandbox_name">,
  ruleId: string
): string[] {
  return [
    input.sbx_path,
    "policy",
    "rm",
    "network",
    "--sandbox",
    input.sandbox_name,
    "--id",
    ruleId
  ];
}

function policyLogCommand(
  input: Pick<CandidateSandboxNetworkPolicyInput<CandidateSandboxNetworkCommandResult>,
    "sbx_path" | "sandbox_name">
): string[] {
  return [
    input.sbx_path,
    "policy",
    "log",
    input.sandbox_name,
    "--json",
    "--limit",
    "100"
  ];
}

function policyError(
  error: unknown,
  commandResults: CandidateSandboxNetworkCommandResult[]
): CandidateSandboxNetworkPolicyError {
  if (error instanceof CandidateSandboxNetworkPolicyError) {
    const prefix = error.code + ": ";
    return new CandidateSandboxNetworkPolicyError(
      error.code,
      error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message,
      commandResults
    );
  }
  return new CandidateSandboxNetworkPolicyError(
    "policy_check_failed",
    error instanceof Error ? error.message : String(error),
    commandResults
  );
}

function commandFailure(result: CandidateSandboxNetworkCommandResult): string {
  return result.error_message ??
    (result.stderr.trim() || `command exited with ${String(result.exit_code)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
