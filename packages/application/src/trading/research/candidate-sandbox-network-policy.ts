export const CANDIDATE_SBX_MINIMUM_VERSION = "0.35.0";

export const CANDIDATE_NETWORK_DENY_PROBES = [
  "https://example.com",
  "https://registry.npmjs.org",
  "tcp://1.1.1.1:53",
  "udp://1.1.1.1:53",
  "http://169.254.169.254:80",
  "http://10.0.0.1:80",
  "http://host.docker.internal:1"
] as const;

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
  gateway_base_url?: string;
  run_command(command: string[]): Promise<Result>;
  on_evidence?(result: Result): void;
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
  const version = parseSbxVersion(stdout);
  if (!version || compareVersions(version, CANDIDATE_SBX_MINIMUM_VERSION) < 0) {
    throw new CandidateSandboxNetworkPolicyError(
      "unsupported_sbx_version",
      `generated-candidate execution requires stable sbx >= ${CANDIDATE_SBX_MINIMUM_VERSION}`
    );
  }
}

export async function acquireCandidateSandboxNetworkPolicy<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: CandidateSandboxNetworkPolicyInput<Result>
): Promise<CandidateSandboxNetworkPolicyLease<Result>> {
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
  let inheritedAllowedResources: string[] = [];

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
      ownedDenyRuleIds = await addSandboxScopedNetworkRules({
        input,
        execute,
        decision: "deny",
        resources: inheritedAllowedResources,
        before_rules: beforeDenyRules,
        failure_code: "policy_overlay_failed"
      });
    }

    if (allowedResource) {
      ownedAllowRuleIds = await addSandboxScopedNetworkRules({
        input,
        execute,
        decision: "allow",
        resources: [allowedResource],
        before_rules: beforeAllowRules,
        failure_code: "gateway_rule_failed"
      });
    }

    if (allowedResource) {
      await assertPolicyDecision(input, execute, allowedResource, "allow");
    }
    for (const target of CANDIDATE_NETWORK_DENY_PROBES) {
      await assertPolicyDecision(input, execute, target, "deny");
    }
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
  return {
    ...(allowedResource ? { allowed_resource: allowedResource } : {}),
    inherited_allowed_resources: [...inheritedAllowedResources],
    owned_allow_rule_ids: [...ownedAllowRuleIds],
    owned_deny_rule_ids: [...ownedDenyRuleIds],
    owned_rule: ownedAllowRuleIds.length > 0 || ownedDenyRuleIds.length > 0,
    setup_results: [...commandResults],
    release: async () => {
      if (released) {
        return [];
      }
      released = true;
      return releaseCandidateSandboxNetworkPolicy({
        sbx_path: input.sbx_path,
        sandbox_name: input.sandbox_name,
        owned_allow_rule_ids: ownedAllowRuleIds,
        owned_deny_rule_ids: ownedDenyRuleIds,
        run_command: input.run_command,
        on_evidence: (result) => {
          commandResults.push(result);
          input.on_evidence?.(result);
        }
      });
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

function parseSbxVersion(stdout: string): string | undefined {
  const current = stdout.match(/\bsbx version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
  if (current) {
    return current;
  }
  return stdout.match(/\bClient Version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
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

async function inspectNetworkRules<
  Result extends CandidateSandboxNetworkCommandResult
>(
  input: CandidateSandboxNetworkPolicyInput<Result>,
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
    if (!id || ids.has(id)) {
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
}): Promise<string[]> {
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
    !sameStrings(ruleResources(created), resources) ||
    created.some((rule) => !isSandboxScopedRule(rule, input.input.sandbox_name))
  ) {
    throw new CandidateSandboxNetworkPolicyError(
      "policy_inspection_failed",
      `owned ${input.decision} rules did not match the requested Sandbox scope and resources`
    );
  }
  return created.map((rule) => rule.id).sort();
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

function sameStrings(left: string[], right: string[]): boolean {
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
