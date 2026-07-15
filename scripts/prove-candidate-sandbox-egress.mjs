import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const MINIMUM_SBX_VERSION = "0.35.0";
const PROTOCOL_VERSION = "candidate-network-egress-probe/v1";
const DENIED_POLICY_TARGETS = [
  "https://example.com",
  "https://registry.npmjs.org",
  "tcp://1.1.1.1:53",
  "udp://1.1.1.1:53",
  "http://169.254.169.254:80",
  "http://10.0.0.1:80"
];
const REQUIRED_DENIED_PROBES = [
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
];

class ProofFailure extends Error {
  constructor(stage, message) {
    super(message);
    this.stage = stage;
  }
}

let sbxPath;
let sbxHome;
let commandTimeoutMs;
let sandboxName;

try {
  const args = parseArgs(process.argv.slice(2));
  sbxPath = args["sbx-bin"] ?? process.env.OUROBOROS_SBX_BIN ??
    process.env.OUROBOROS_SDX_BIN ?? "sbx";
  sbxHome = args["sbx-home"] ?? process.env.OUROBOROS_SBX_HOME;
  commandTimeoutMs = positiveInteger(
    args["command-timeout-ms"] ?? process.env.OUROBOROS_SBX_COMMAND_TIMEOUT_MS ?? "30000",
    "command-timeout-ms"
  );
  sandboxName = args["sandbox-name"] ??
    `ouro-egress-${process.pid}-${Date.now().toString(36)}`;
  assertSandboxName(sandboxName);
  await proveCandidateSandboxEgress();
} catch (error) {
  const failure = error instanceof ProofFailure
    ? error
    : new ProofFailure("internal", error instanceof Error ? error.message : String(error));
  console.error(
    `PROOF_RESULT failed stage=${failure.stage} reason=${sanitizeMessage(failure.message)}`
  );
  process.exitCode = 1;
}

async function proveCandidateSandboxEgress() {
  const versionResult = await runSbx(["version"]);
  assertCommand(versionResult, "version");
  const version = parseSbxVersion(versionResult.stdout);
  if (!version || compareVersions(version, MINIMUM_SBX_VERSION) < 0) {
    throw new ProofFailure(
      "version",
      `generated-candidate execution requires stable sbx >= ${MINIMUM_SBX_VERSION}`
    );
  }

  const workspace = await mkdtemp(path.join(tmpdir(), "ouroboros-candidate-egress-"));
  const fixtureSource = path.resolve("fixtures/security/candidate-network-egress-probe.py");
  const fixtureName = "candidate-network-egress-probe.py";
  const gatewayBody = "ouroboros-candidate-gateway-ok";
  let gateway;
  let alternateHost;
  try {
    await copyFile(fixtureSource, path.join(workspace, fixtureName));
    gateway = await startGateway(gatewayBody);
    alternateHost = await startGateway("ouroboros-alternate-host-must-not-be-reachable");
  } catch (error) {
    if (gateway) {
      await gateway.close();
    }
    await rm(workspace, { recursive: true, force: true });
    throw new ProofFailure(
      "gateway",
      error instanceof Error ? error.message : String(error)
    );
  }
  const gatewayResource = `localhost:${gateway.port}`;
  const gatewayUrl = `http://host.docker.internal:${gateway.port}`;
  const alternateHostResource = `localhost:${alternateHost.port}`;
  const alternateHostUrl = `http://host.docker.internal:${alternateHost.port}`;
  let sandboxCreated = false;
  let ownedAllowRuleIds = [];
  let ownedDenyRuleIds = [];
  let inheritedAllowedResources = [];
  let proofReport;
  let primaryFailure;
  const cleanupFailures = [];

  try {
    const create = await runSbx(["create", "--name", sandboxName, "shell", workspace]);
    assertCommand(create, "create");
    sandboxCreated = true;

    const beforeAllowRules = await inspectNetworkRules("allow");
    inheritedAllowedResources = networkRuleResources(beforeAllowRules);
    if (inheritedAllowedResources.includes(gatewayResource)) {
      throw new ProofFailure(
        "policy_inspection",
        `exact Gateway allow ${gatewayResource} already exists without proof ownership`
      );
    }

    if (inheritedAllowedResources.length > 0) {
      const beforeDenyRules = await inspectNetworkRules("deny");
      ownedDenyRuleIds = await addScopedNetworkRules(
        "deny",
        inheritedAllowedResources,
        beforeDenyRules,
        "policy_overlay"
      );
    }
    ownedAllowRuleIds = await addScopedNetworkRules(
      "allow",
      [gatewayResource],
      beforeAllowRules,
      "gateway_rule"
    );
    await assertPolicyDecision(gatewayResource, "allow");
    for (const target of [...DENIED_POLICY_TARGETS, alternateHostResource]) {
      await assertPolicyDecision(target, "deny");
    }

    const probe = await runSbx([
      "exec",
      sandboxName,
      "python3",
      fixtureName,
      "--gateway-url",
      gatewayUrl,
      "--expected-gateway-body",
      gatewayBody,
      "--alternate-host-url",
      alternateHostUrl
    ]);
    if (probe.exit_code !== 0) {
      throw new ProofFailure("candidate_probe", candidateProbeFailure(probe));
    }
    proofReport = parseProbeReport(probe.stdout);
  } catch (error) {
    primaryFailure = error;
  } finally {
    if (sandboxCreated) {
      await cleanupCommand(
        ["policy", "log", sandboxName, "--json", "--limit", "100"],
        "policy_log",
        cleanupFailures
      );
    }
    let allowRemoved = true;
    for (const ruleId of ownedAllowRuleIds) {
      const removed = await cleanupCommand([
        "policy",
        "rm",
        "network",
        "--sandbox",
        sandboxName,
        "--id",
        ruleId
      ], "policy_cleanup", cleanupFailures);
      allowRemoved = removed && allowRemoved;
    }
    if (allowRemoved) {
      for (const ruleId of ownedDenyRuleIds) {
        await cleanupCommand([
          "policy",
          "rm",
          "network",
          "--sandbox",
          sandboxName,
          "--id",
          ruleId
        ], "policy_cleanup", cleanupFailures);
      }
    }
    if (sandboxCreated) {
      await cleanupCommand(["rm", "--force", sandboxName], "sandbox_cleanup", cleanupFailures);
    }
    try {
      await gateway.close();
    } finally {
      try {
        await alternateHost.close();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    }
  }

  if (primaryFailure) {
    if (cleanupFailures.length > 0) {
      throw new ProofFailure(
        "cleanup",
        `primary=${primaryFailure instanceof Error ? primaryFailure.message : String(primaryFailure)}; ` +
          `cleanup=${cleanupFailures[0].message}`
      );
    }
    throw primaryFailure;
  }
  if (cleanupFailures.length > 0) {
    throw cleanupFailures[0];
  }
  console.log("Candidate sandbox egress proof");
  console.log(`sbx_version=${version}`);
  console.log(`sandbox_name=${sandboxName}`);
  console.log(`gateway_resource=${gatewayResource}`);
  console.log(`PROOF_JSON ${JSON.stringify({
    protocol_version: PROTOCOL_VERSION,
    sbx_version: version,
    sandbox_name: sandboxName,
    gateway_resource: gatewayResource,
    alternate_host_resource: alternateHostResource,
    inherited_allow_count: inheritedAllowedResources.length,
    owned_allow_rule_count: ownedAllowRuleIds.length,
    owned_deny_rule_count: ownedDenyRuleIds.length,
    candidate: proofReport,
    cleanup: "complete"
  })}`);
  console.log("PROOF_RESULT passed");
}

async function inspectNetworkRules(decision) {
  const result = await runSbx([
    "policy",
    "ls",
    sandboxName,
    "--json",
    "--type",
    "network",
    "--decision",
    decision
  ]);
  assertCommand(result, "policy_inspection");
  try {
    return parseNetworkRules(result.stdout, decision);
  } catch (error) {
    throw new ProofFailure(
      "policy_inspection",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function addScopedNetworkRules(decision, resources, beforeRules, stage) {
  const normalizedResources = normalizePolicyResources(resources);
  const result = await runSbx([
    "policy",
    decision,
    "network",
    "--sandbox",
    sandboxName,
    normalizedResources.join(",")
  ]);
  assertCommand(result, stage);
  const priorIds = new Set(beforeRules.map((rule) => rule.id));
  const afterRules = await inspectNetworkRules(decision);
  const created = afterRules.filter((rule) => !priorIds.has(rule.id));
  if (created.length === 0) {
    throw new ProofFailure(
      "policy_inspection",
      `expected at least one owned ${decision} rule`
    );
  }
  if (
    !sameStrings(networkRuleResources(created), normalizedResources) ||
    created.some((rule) => !isSandboxScopedRule(rule))
  ) {
    throw new ProofFailure(
      "policy_inspection",
      `owned ${decision} rules did not match the requested Sandbox scope and resources`
    );
  }
  return created.map((rule) => rule.id).sort();
}

async function assertPolicyDecision(target, expected) {
  const result = await runSbx([
    "policy",
    "check",
    "network",
    "--sandbox",
    sandboxName,
    "--json",
    target
  ]);
  let decision;
  try {
    decision = parsePolicyDecision(result.stdout);
  } catch (error) {
    throw new ProofFailure(
      "policy_check",
      error instanceof Error ? error.message : String(error)
    );
  }
  const acceptedExit = expected === "allow"
    ? result.exit_code === 0
    : result.exit_code === 0 || result.exit_code === 1;
  if (!acceptedExit || decision !== expected) {
    throw new ProofFailure(
      "policy_check",
      `${target} expected ${expected}, received ${decision} with exit ${String(result.exit_code)}`
    );
  }
}

async function cleanupCommand(command, stage, failures) {
  try {
    const result = await runSbx(command);
    if (result.exit_code !== 0) {
      failures.push(new ProofFailure(stage, commandFailure(result)));
      return false;
    }
    return true;
  } catch (error) {
    failures.push(error instanceof ProofFailure
      ? error
      : new ProofFailure(stage, error instanceof Error ? error.message : String(error)));
    return false;
  }
}

async function runSbx(command) {
  return runCommand(sbxPath, command, {
    timeoutMs: commandTimeoutMs,
    env: sbxHome
      ? { ...process.env, HOME: sbxHome, OUROBOROS_SBX_HOME: sbxHome }
      : process.env
  });
}

function runCommand(executable, args, options) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const outputLimit = 128 * 1024;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => {
      if (stdout.length < outputLimit) {
        stdout += String(chunk).slice(0, outputLimit - stdout.length);
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < outputLimit) {
        stderr += String(chunk).slice(0, outputLimit - stderr.length);
      }
    });
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    child.on("error", (error) => finish({
      exit_code: null,
      stdout,
      stderr,
      error_message: error.message,
      timed_out: false
    }));
    child.on("close", (code) => finish({
      exit_code: code,
      stdout,
      stderr,
      ...(timedOut ? { error_message: "command timed out", timed_out: true } : {})
    }));
  });
}

function assertCommand(result, stage) {
  if (result.exit_code !== 0) {
    throw new ProofFailure(stage, commandFailure(result));
  }
}

function commandFailure(result) {
  if (result.timed_out) {
    return "command_timed_out";
  }
  const combined = `${result.error_message ?? ""}\n${result.stderr}`;
  if (/authenticat|not signed in|login required/i.test(combined)) {
    return "sbx_authentication_required";
  }
  const firstLine = combined.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine
    ? `command_failed exit=${String(result.exit_code)} detail=${firstLine}`
    : `command_failed exit=${String(result.exit_code)}`;
}

function parseProbeReport(stdout) {
  const report = parseLastJsonRecord(stdout);
  if (!isRecord(report) || report.protocol_version !== PROTOCOL_VERSION || report.passed !== true) {
    throw new ProofFailure("candidate_probe", "candidate proof report is missing or failed");
  }
  if (!isRecord(report.gateway) || report.gateway.observed !== "allowed") {
    throw new ProofFailure("candidate_probe", "Gateway route was not allowed");
  }
  if (!Array.isArray(report.probes)) {
    throw new ProofFailure("candidate_probe", "candidate proof matrix is missing");
  }
  const observed = new Map(report.probes.map((probe) => [probe?.name, probe?.observed]));
  for (const name of REQUIRED_DENIED_PROBES) {
    if (observed.get(name) !== "denied") {
      throw new ProofFailure("candidate_probe", `${name} was not denied`);
    }
  }
  return report;
}

function candidateProbeFailure(result) {
  const report = parseLastJsonRecord(result.stdout);
  if (!isRecord(report) || report.protocol_version !== PROTOCOL_VERSION) {
    return commandFailure(result);
  }
  const gatewayObserved = isRecord(report.gateway)
    ? safeProbeObservation(report.gateway.observed)
    : "missing";
  const probes = Array.isArray(report.probes) ? report.probes : [];
  const observations = new Map(probes.flatMap((probe) =>
    isRecord(probe) && typeof probe.name === "string"
      ? [[probe.name, safeProbeObservation(probe.observed)]]
      : []
  ));
  const failed = REQUIRED_DENIED_PROBES
    .map((name) => [name, observations.get(name) ?? "missing"])
    .filter(([, observed]) => observed !== "denied")
    .map(([name, observed]) => `${name}:${observed}`);
  return `gateway=${gatewayObserved} failed_probes=${failed.join(",") || "none"} ` +
    `exit=${String(result.exit_code)}`;
}

function parseLastJsonRecord(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      continue;
    }
  }
  return undefined;
}

function safeProbeObservation(value) {
  return ["allowed", "denied", "invalid_response", "unavailable"].includes(value)
    ? value
    : "unknown";
}

function parseNetworkRules(stdout, expectedDecision) {
  const parsed = JSON.parse(stdout);
  const ruleObjects = [];
  collectRuleObjects(parsed, ruleObjects);
  if (ruleObjects.length === 0) {
    if (isEmptyRuleCollection(parsed)) {
      return [];
    }
    throw new Error("policy list did not contain a recognized rule collection");
  }
  const rules = [];
  const ids = new Set();
  for (const rule of ruleObjects) {
    if (String(rule.status ?? "active").toLowerCase() === "inactive") {
      continue;
    }
    const decision = normalizeDecision(rule.decision ?? rule.effect);
    if (decision !== expectedDecision) {
      continue;
    }
    if (typeof rule.id !== "string" || ids.has(rule.id)) {
      throw new Error("active network rule did not expose one unique id");
    }
    const values = stringLeaves(rule.resources);
    if (values.length === 0) {
      throw new Error("active network rule did not expose resources");
    }
    ids.add(rule.id);
    rules.push({
      id: rule.id,
      decision,
      resources: normalizePolicyResources(values),
      ...(typeof rule.scope === "string" ? { scope: rule.scope } : {}),
      ...(typeof rule.applies_to === "string" ? { applies_to: rule.applies_to } : {}),
      ...(typeof rule.sandbox_id === "string" ? { sandbox_id: rule.sandbox_id } : {})
    });
  }
  return rules.sort((left, right) => left.id.localeCompare(right.id));
}

function networkRuleResources(rules) {
  return normalizePolicyResources(rules.flatMap((rule) => rule.resources));
}

function normalizePolicyResources(resources) {
  const normalized = [...new Set(resources)].sort();
  if (
    normalized.length > 512 ||
    normalized.some((resource) =>
      typeof resource !== "string" ||
      resource.length === 0 ||
      resource.length > 1_024 ||
      resource !== resource.trim() ||
      resource.includes(",") ||
      /[\u0000-\u001f\u007f]/.test(resource)
    ) ||
    normalized.join(",").length > 32_768
  ) {
    throw new Error("active network policy resources cannot be represented safely");
  }
  return normalized;
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isSandboxScopedRule(rule) {
  const expected = `sandbox:${sandboxName}`;
  return rule.sandbox_id === sandboxName || rule.scope === expected || rule.applies_to === expected;
}

function collectRuleObjects(value, output) {
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

function isEmptyRuleCollection(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (!isRecord(value)) {
    return false;
  }
  return ["rules", "items", "policies", "data"].some((key) =>
    Array.isArray(value[key]) && value[key].length === 0
  );
}

function stringLeaves(value) {
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

function parsePolicyDecision(stdout) {
  const parsed = JSON.parse(stdout);
  const decisions = new Set();
  collectDecisions(parsed, decisions);
  if (decisions.size !== 1) {
    throw new Error("policy check JSON did not contain one unambiguous decision");
  }
  return [...decisions][0];
}

function collectDecisions(value, output) {
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
    const decision = normalizeDecision(value[key]);
    if (decision) {
      output.add(decision);
    }
  }
  for (const child of Object.values(value)) {
    collectDecisions(child, output);
  }
}

function normalizeDecision(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "allow" || normalized === "allowed") {
    return "allow";
  }
  if (["deny", "denied", "block", "blocked"].includes(normalized)) {
    return "deny";
  }
  return undefined;
}

function parseSbxVersion(stdout) {
  return stdout.match(/\bsbx version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1] ??
    stdout.match(/\bClient Version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
}

function compareVersions(left, right) {
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

function startGateway(body) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: "https://example.com/" });
        response.end();
        return;
      }
      response.writeHead(200, { "content-type": "text/plain", "content-length": body.length });
      response.end(body);
    });
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new ProofFailure("gateway", "failed to allocate Gateway port"));
        return;
      }
      resolve({
        port: address.port,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => error ? closeReject(error) : closeResolve());
        })
      });
    });
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--sbx-bin", "--sbx-home", "--sandbox-name", "--command-timeout-ms"].includes(key)) {
      throw new ProofFailure("arguments", `unknown argument ${String(key)}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ProofFailure("arguments", `${key} requires a value`);
    }
    parsed[key.slice(2)] = value;
    index += 1;
  }
  return parsed;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ProofFailure("arguments", `${name} must be a positive integer`);
  }
  return parsed;
}

function assertSandboxName(value) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(value)) {
    throw new ProofFailure("arguments", "sandbox-name must be a lowercase sbx-safe name");
  }
}

function sanitizeMessage(value) {
  return String(value)
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(bearer\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
