#!/usr/bin/env node
import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

const completionChecklist = [
  {
    label: "preflight used Docker Sandboxes sbx",
    evidence: [
      "## sbx version",
      "## sbx diagnose --output json",
      "## sbx daemon status",
      "## sbx ls run-control probe"
    ]
  },
  {
    label: "runtime API ran with the real sbx validation harness",
    evidence: [
      "## start runtime API with real sbx adapter enabled",
      "runtime API ready:"
    ]
  },
  {
    label: "instance A created, produced heartbeat, and stopped",
    evidence: [
      "create --name",
      "runtime API start A command evidence",
      "sandbox-clock-a",
      "direct sbx log A",
      "cat /tmp/ouroboros-sandbox-clock-a.jsonl",
      "runtime API status A",
      "runtime API logs A",
      "runtime API stop A response",
      "runtime API stop A command evidence",
      "stop",
      "rm --force"
    ]
  },
  {
    label: "instance B created, produced heartbeat, and stopped",
    evidence: [
      "create --name",
      "runtime API start B command evidence",
      "sandbox-clock-b",
      "direct sbx log B",
      "cat /tmp/ouroboros-sandbox-clock-b.jsonl",
      "runtime API status B",
      "runtime API logs B",
      "runtime API stop B response",
      "runtime API stop B command evidence",
      "stop",
      "rm --force"
    ]
  },
  {
    label: "clock fixture emitted runtime heartbeats",
    evidence: [
      "runtime_heartbeat",
      "fixtures/trading-systems/clock.py"
    ]
  },
  {
    label: "artifact identity and raw-secret boundary recorded",
    evidence: [
      "fixture-system-code-clock-python-001",
      "runtime API raw secret rejection probe",
      "raw_secret_material_rejected"
    ]
  }
];

class IncompleteCheck extends Error {}

if (args.help) {
  console.log(`Usage: npm run audit:s5-sbx:completion
       npm run audit:s5-sbx:completion -- --evidence .ouroboros/s5-sbx-evidence/validate-<timestamp>.log

Audits whether Slice 5 has real Docker Sandboxes sbx completion evidence.
This command is non-mutating. It does not create, stop, remove, reset, or restart sandboxes.
Completion requires zero sbx diagnose failures, direct sandbox log heartbeats with matching runtime
instance ids, runtime API status/log heartbeats, ordered stop/remove evidence, and no RESULT: failed
marker.

Exit codes:
  0  completion evidence proves the real two-sandbox lifecycle transcript
  1  repo-side completion audit wiring failed
  2  completion evidence is missing or incomplete

Evidence source:
  --evidence <path>             explicit validation transcript path
  OUROBOROS_SBX_EVIDENCE_PATH   validation transcript path
  .ouroboros/s5-sbx-evidence/validate-*.log, newest file by mtime
`);
  process.exit(0);
}

const checks = [];
let selectedEvidencePath;

await check("objective mapped to concrete S5 completion gates", async () => {
  assertValue(completionChecklist.length, "completion checklist is empty");
  for (const item of completionChecklist) {
    assertValue(item.evidence.length, `missing evidence requirements for ${item.label}`);
  }
});

await check("repo S5 completion audit files and scripts exist", async () => {
  await assertFilesExist([
    "scripts/audit-s5-sbx-completion.mjs",
    "scripts/audit-s5-sbx-readiness.mjs",
    "scripts/validate-s5-sbx-runtime.mjs",
    "scripts/recover-s5-sbx-daemon.mjs"
  ]);
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assertValue(packageJson.scripts?.["audit:s5-sbx:completion"], "missing audit:s5-sbx:completion");
  assertValue(packageJson.scripts?.["validate:s5-sbx"], "missing validate:s5-sbx");
  assertValue(packageJson.scripts?.["recover:s5-sbx-daemon:validate"], "missing recover:s5-sbx-daemon:validate");
});

await check("real two-sandbox validation transcript is present and complete", async () => {
  const evidencePath = await resolveEvidencePath();
  if (!evidencePath) {
    throw new IncompleteCheck("missing validation transcript evidence");
  }
  selectedEvidencePath = evidencePath;

  const transcript = await readEvidence(evidencePath);
  assertIncludes(transcript, "## OURO-32 real Docker Sandboxes sbx validation");
  assertIncludes(transcript, "RESULT: passed");
  assertNotIncludes(transcript, "RESULT: failed");
  assertSupportedSbxTranscript(transcript);

  for (const item of completionChecklist) {
    for (const expected of item.evidence) {
      assertIncludes(transcript, expected);
    }
  }

  const sandboxNames = extractSandboxNames(transcript);

  for (const item of orderedLifecycleEvidenceFor(sandboxNames)) {
    assertAppearsInOrder(transcript, item.label, item.evidence);
  }

  assertSectionHasHeartbeatJson(transcript, "direct sbx log A", "sandbox-clock-a");
  assertSectionHasHeartbeatJson(transcript, "direct sbx log B", "sandbox-clock-b");
  assertSectionContains(transcript, "runtime API start A response", ["fixture-system-code-clock-python-001"]);
  assertSectionContains(transcript, "runtime API start B response", ["fixture-system-code-clock-python-001"]);
  assertSectionContainsStoppedLifecycle(
    transcript,
    "runtime API stop A response",
    "sandbox-clock-a"
  );
  assertSectionContainsStoppedLifecycle(
    transcript,
    "runtime API stop B response",
    "sandbox-clock-b"
  );
  assertSectionContains(transcript, "runtime API raw secret rejection probe", ["raw_secret_material_rejected"]);
  assertCommandSucceededInSection(transcript, "runtime API start A command evidence", `create --name ${sandboxNames.a}`);
  assertCommandSucceededInSection(transcript, "runtime API start A command evidence", "exec -d -w");
  assertSectionContains(transcript, "runtime API start A command evidence", [sandboxNames.a]);
  assertCommandSucceededInSection(transcript, "runtime API start B command evidence", `create --name ${sandboxNames.b}`);
  assertCommandSucceededInSection(transcript, "runtime API start B command evidence", "exec -d -w");
  assertSectionContains(transcript, "runtime API start B command evidence", [sandboxNames.b]);
  assertSectionContains(transcript, "direct sbx log A", [`exec ${sandboxNames.a} cat`]);
  assertSectionContains(transcript, "direct sbx log B", [`exec ${sandboxNames.b} cat`]);
  assertSectionContains(transcript, "sbx ls", [sandboxNames.a, sandboxNames.b]);
  assertCommandSucceededInSection(transcript, "runtime API stop A command evidence", `stop ${sandboxNames.a}`);
  assertCommandSucceededInSection(transcript, "runtime API stop B command evidence", `stop ${sandboxNames.b}`);
  assertSectionContains(transcript, `sbx rm ${sandboxNames.a}`, ["exit_code=0"]);
  assertSectionContains(transcript, `sbx rm ${sandboxNames.b}`, ["exit_code=0"]);
  assertSectionContainsRuntimeHeartbeat(transcript, "runtime API status A", "sandbox-clock-a");
  assertSectionContainsRuntimeHeartbeat(transcript, "runtime API logs A", "sandbox-clock-a");
  assertSectionContainsRuntimeHeartbeat(transcript, "runtime API status B", "sandbox-clock-b");
  assertSectionContainsRuntimeHeartbeat(transcript, "runtime API logs B", "sandbox-clock-b");
  assertDiagnoseHasZeroFailures(transcript);
});

printSummary();

const failures = checks.filter((entry) => entry.status === "fail");
const incomplete = checks.filter((entry) => entry.status === "incomplete");
if (failures.length > 0) {
  process.exitCode = 1;
} else if (incomplete.length > 0) {
  process.exitCode = 2;
}

async function check(label, fn) {
  try {
    await fn();
    checks.push({ label, status: "pass" });
  } catch (error) {
    checks.push({
      label,
      status: error instanceof IncompleteCheck ? "incomplete" : "fail",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function assertFilesExist(files) {
  for (const file of files) {
    await access(file, fsConstants.F_OK);
  }
}

function assertValue(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertIncludes(value, expected) {
  if (!value.includes(expected)) {
    throw new IncompleteCheck(`missing transcript evidence: ${expected}`);
  }
}

function assertNotIncludes(value, unexpected) {
  if (value.includes(unexpected)) {
    throw new IncompleteCheck(`transcript contains failure evidence: ${unexpected}`);
  }
}

function assertSupportedSbxTranscript(value) {
  const versionSection = sectionText(value, "sbx version");
  const version = versionSection.match(/\bsbx version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1]
    ?? versionSection.match(/\bClient Version:\s*v?(\d+\.\d+\.\d+)(?:\s|$)/i)?.[1];
  if (/starkit/i.test(versionSection) || !version) {
    throw new IncompleteCheck("transcript uses sdx/Starkit, not Docker Sandboxes sbx");
  }
  if (compareVersions(version, "0.35.0") < 0) {
    throw new IncompleteCheck(`transcript uses unsupported sbx v${version}; stable v0.35.0 or newer is required`);
  }
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

function extractSandboxNames(value) {
  const a = extractCreatedSandboxName(value, "runtime API start A command evidence");
  const b = extractCreatedSandboxName(value, "runtime API start B command evidence");
  if (a === b) {
    throw new IncompleteCheck(`validation reused one sandbox name for both instances: ${a}`);
  }
  return { a, b };
}

function extractCreatedSandboxName(value, sectionLabel) {
  const section = sectionText(value, sectionLabel);
  const match = section.match(/\bcreate\s+--name\s+([^\s]+)/);
  if (!match?.[1]) {
    throw new IncompleteCheck(`missing created sandbox name in transcript section: ${sectionLabel}`);
  }
  return match[1];
}

function orderedLifecycleEvidenceFor(sandboxNames) {
  return [
    {
      label: "instance A lifecycle order",
      evidence: [
        "runtime API start A command evidence",
        `create --name ${sandboxNames.a}`,
        "sandbox-clock-a",
        "direct sbx log A",
        "runtime API status A",
        "runtime API logs A",
        "runtime API stop A response",
        "runtime API stop A command evidence",
        `stop ${sandboxNames.a}`,
        `rm --force ${sandboxNames.a}`
      ]
    },
    {
      label: "instance B lifecycle order",
      evidence: [
        "runtime API start B command evidence",
        `create --name ${sandboxNames.b}`,
        "sandbox-clock-b",
        "direct sbx log B",
        "runtime API status B",
        "runtime API logs B",
        "runtime API stop B response",
        "runtime API stop B command evidence",
        `stop ${sandboxNames.b}`,
        `rm --force ${sandboxNames.b}`
      ]
    }
  ];
}

function assertAppearsInOrder(value, label, expectedSequence) {
  let fromIndex = 0;
  for (const expected of expectedSequence) {
    const foundAt = value.indexOf(expected, fromIndex);
    if (foundAt === -1) {
      throw new IncompleteCheck(`missing ordered transcript evidence for ${label}: ${expected}`);
    }
    fromIndex = foundAt + expected.length;
  }
}

function assertSectionContains(value, sectionLabel, expectedValues) {
  const section = sectionText(value, sectionLabel);
  for (const expected of expectedValues) {
    if (!section.includes(expected)) {
      throw new IncompleteCheck(`missing ${expected} in transcript section: ${sectionLabel}`);
    }
  }
}

function assertSectionHasHeartbeatJson(value, sectionLabel, expectedInstanceId) {
  const section = sectionText(value, sectionLabel);
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.event === "runtime_heartbeat" && parsed?.instance_id === expectedInstanceId) {
        return;
      }
    } catch {
      continue;
    }
  }
  throw new IncompleteCheck(
    `missing runtime_heartbeat JSON for ${expectedInstanceId} in transcript section: ${sectionLabel}`
  );
}

function assertSectionContainsRuntimeHeartbeat(value, sectionLabel, expectedInstanceId) {
  const section = sectionText(value, sectionLabel);
  if (!section.includes("runtime_heartbeat") || !section.includes(expectedInstanceId)) {
    throw new IncompleteCheck(
      `missing runtime_heartbeat evidence for ${expectedInstanceId} in transcript section: ${sectionLabel}`
    );
  }
}

function assertSectionContainsStoppedLifecycle(value, sectionLabel, expectedInstanceId) {
  const section = sectionText(value, sectionLabel);
  if (
    !section.includes(expectedInstanceId) ||
    !section.includes('"lifecycle_status"') ||
    !section.includes('"stopped"')
  ) {
    throw new IncompleteCheck(
      `missing stopped lifecycle evidence for ${expectedInstanceId} in transcript section: ${sectionLabel}`
    );
  }
}

function assertCommandSucceededInSection(value, sectionLabel, commandSnippet) {
  const section = sectionText(value, sectionLabel);
  const commandIndex = section.indexOf(commandSnippet);
  if (commandIndex === -1) {
    throw new IncompleteCheck(`missing command evidence ${commandSnippet} in transcript section: ${sectionLabel}`);
  }
  const exitIndex = section.indexOf("exit_code=0", commandIndex);
  if (exitIndex === -1) {
    throw new IncompleteCheck(`missing exit_code=0 after ${commandSnippet} in transcript section: ${sectionLabel}`);
  }
}

function assertDiagnoseHasZeroFailures(value) {
  const section = sectionText(value, "sbx diagnose --output json");
  const parsed = parseJsonObjectFromSection(section, "sbx diagnose --output json");
  if (parsed?.summary?.fail !== 0) {
    throw new IncompleteCheck(`sbx diagnose summary.fail is not 0: ${String(parsed?.summary?.fail)}`);
  }
}

function parseJsonObjectFromSection(section, sectionLabel) {
  const start = section.indexOf("{");
  const end = section.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new IncompleteCheck(`missing JSON object in transcript section: ${sectionLabel}`);
  }
  try {
    return JSON.parse(section.slice(start, end + 1));
  } catch (error) {
    throw new IncompleteCheck(`invalid JSON object in transcript section: ${sectionLabel}: ${
      error instanceof Error ? error.message : String(error)
    }`);
  }
}

function sectionText(value, sectionLabel) {
  const startMarker = `## ${sectionLabel}`;
  const sections = [];
  let searchFrom = 0;
  while (true) {
    const start = value.indexOf(startMarker, searchFrom);
    if (start === -1) {
      break;
    }
    const nextSection = value.indexOf("\n## ", start + startMarker.length);
    sections.push(nextSection === -1 ? value.slice(start) : value.slice(start, nextSection));
    searchFrom = start + startMarker.length;
  }
  if (sections.length === 0) {
    throw new IncompleteCheck(`missing transcript section: ${sectionLabel}`);
  }
  return sections.join("\n");
}

async function readEvidence(evidencePath) {
  try {
    return await readFile(evidencePath, "utf8");
  } catch (error) {
    throw new IncompleteCheck(`cannot read validation transcript evidence at ${evidencePath}: ${
      error instanceof Error ? error.message : String(error)
    }`);
  }
}

async function resolveEvidencePath() {
  if (args.evidence) {
    return args.evidence;
  }
  if (process.env.OUROBOROS_SBX_EVIDENCE_PATH) {
    return process.env.OUROBOROS_SBX_EVIDENCE_PATH;
  }

  const evidenceDir = path.resolve(".ouroboros/s5-sbx-evidence");
  const entries = await readdir(evidenceDir, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^validate-.*\.log$/.test(entry.name)) {
      continue;
    }
    const filePath = path.join(evidenceDir, entry.name);
    candidates.push({ filePath, mtimeMs: (await stat(filePath)).mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath;
}

function parseArgs(argv) {
  const parsed = { help: false, evidence: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--evidence") {
      if (!argv[index + 1] || argv[index + 1].startsWith("--")) {
        throw new Error("--evidence requires a path");
      }
      parsed.evidence = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function printSummary() {
  console.log("S5 sbx completion audit");
  console.log("objective: prove the opaque TradingSystem artifact runtime in a real Docker Sandboxes sbx environment");
  console.log(`evidence_transcript=${selectedEvidencePath ?? "missing"}`);
  console.log("prompt-to-artifact checklist:");
  for (const item of completionChecklist) {
    console.log(`- ${item.label}`);
  }
  for (const entry of checks) {
    console.log(`${entry.status.toUpperCase()} ${entry.label}`);
    if (entry.detail) {
      console.log(`  ${entry.detail}`);
    }
  }
  console.log(`REAL_ENVIRONMENT_PROOF_REQUIRED npm run ${s5ScriptName("validate")}`);
  console.log(`COMPLETION_AUDIT_RESULT ${
    checks.some((entry) => entry.status === "fail")
      ? "failed"
      : checks.some((entry) => entry.status === "incomplete")
        ? "incomplete"
        : "complete"
  }`);
}

function s5ScriptName(kind) {
  const alias = process.env.OUROBOROS_SDX_BIN && !process.env.OUROBOROS_SBX_BIN ? "sdx" : "sbx";
  if (kind === "validate") {
    return `validate:s5-${alias}`;
  }
  throw new Error(`unknown S5 script kind: ${kind}`);
}
