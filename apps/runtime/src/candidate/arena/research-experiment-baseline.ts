import { createHash, randomBytes } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  type ResearchExperimentBaselineSnapshot
} from "@ouroboros/domain";

const RESEARCH_CONTROL_EVIDENCE_COLLECTIONS = new Set([
  "research-control-campaigns",
  "research-control-campaign-arm-intents",
  "research-control-campaign-reports",
  "research-control-campaign-paper-schedules",
  "research-control-campaign-paper-start-batches",
  "research-control-campaign-paper-slot-outcomes",
  "research-control-campaign-outcomes",
  "research-control-studies",
  "research-control-study-execution-leases",
  "research-control-study-outcomes"
]);

const RESEARCH_MEMORY_CONTROL_EVIDENCE_COLLECTIONS = new Set([
  "research-memory-control-studies",
  "research-memory-control-pair-outcomes",
  "research-memory-control-study-outcomes"
]);

const RECONSTRUCTIBLE_LOCAL_STORE_COLLECTIONS = new Set([
  ".locks",
  "read-models"
]);

export type ResearchExperimentBaselineErrorCode =
  | "research_experiment_baseline_root_invalid"
  | "research_experiment_baseline_empty"
  | "research_experiment_baseline_temporary_file"
  | "research_experiment_baseline_unsupported_entry"
  | "research_experiment_baseline_file_bound_exceeded"
  | "research_experiment_baseline_byte_bound_exceeded"
  | "research_experiment_baseline_unstable"
  | "research_experiment_baseline_digest_mismatch";

export class ResearchExperimentBaselineError extends Error {
  constructor(
    readonly code: ResearchExperimentBaselineErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ResearchExperimentBaselineError";
  }
}

export interface CaptureResearchExperimentBaselineInput {
  root: string;
  maximumRegularFileCount: number;
  maximumTotalBytes: number;
  exclusionPolicy?: ResearchExperimentBaselineSnapshot["exclusion_policy"];
  protocolVersion?: ResearchExperimentBaselineSnapshot["protocol_version"];
}

export interface VerifyResearchExperimentBaselineInput
  extends CaptureResearchExperimentBaselineInput {
  expected: ResearchExperimentBaselineSnapshot;
}

export interface EnsureResearchExperimentStoreCopyInput {
  sourceRoot: string;
  destinationRoot: string;
  expected: ResearchExperimentBaselineSnapshot;
  maximumRegularFileCount: number;
  maximumTotalBytes: number;
}

interface SnapshotEntry {
  relative_path: string;
  byte_count: number;
  content_digest: string;
}

export async function captureResearchExperimentBaseline(
  input: CaptureResearchExperimentBaselineInput
): Promise<ResearchExperimentBaselineSnapshot> {
  const root = path.resolve(canonicalPath(input.root));
  const maximumFileCount = positiveBound(
    input.maximumRegularFileCount,
    100_000,
    "research_experiment_baseline_file_bound_exceeded"
  );
  const maximumBytes = positiveBound(
    input.maximumTotalBytes,
    1_000_000_000,
    "research_experiment_baseline_byte_bound_exceeded"
  );
  const exclusionPolicy = input.exclusionPolicy ??
    "research_experiment_evidence_only";
  const protocolVersion = input.protocolVersion ??
    "local_store_regular_files_v2";
  const rootStat = await stat(root).catch(() => undefined);
  if (!rootStat?.isDirectory()) {
    throw baselineError(
      "research_experiment_baseline_root_invalid",
      "ResearchExperiment baseline root must be a directory."
    );
  }

  const entries: SnapshotEntry[] = [];
  let totalBytes = 0;
  const walk = async (directory: string, relativeDirectory: string) => {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const relativePath = relativeDirectory
        ? path.posix.join(relativeDirectory, child.name)
        : child.name;
      if (excludedRelativePath(
        relativePath,
        exclusionPolicy,
        protocolVersion
      )) continue;
      const absolutePath = path.join(directory, child.name);
      const entryStat = await lstat(absolutePath, { bigint: true });
      if (entryStat.isSymbolicLink()) {
        throw baselineError(
          "research_experiment_baseline_unsupported_entry",
          "ResearchExperiment baseline rejects symbolic links.",
          { relative_path: relativePath }
        );
      }
      if (entryStat.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entryStat.isFile()) {
        throw baselineError(
          "research_experiment_baseline_unsupported_entry",
          "ResearchExperiment baseline accepts regular files only.",
          { relative_path: relativePath }
        );
      }
      if (child.name.endsWith(".tmp") || child.name.includes(".tmp-")) {
        throw baselineError(
          "research_experiment_baseline_temporary_file",
          "ResearchExperiment baseline rejects temporary files.",
          { relative_path: relativePath }
        );
      }
      if (entries.length + 1 > maximumFileCount) {
        throw baselineError(
          "research_experiment_baseline_file_bound_exceeded",
          "ResearchExperiment baseline file bound was exceeded."
        );
      }
      const captured = await captureRegularFile(absolutePath, relativePath);
      totalBytes += captured.byte_count;
      if (totalBytes > maximumBytes) {
        throw baselineError(
          "research_experiment_baseline_byte_bound_exceeded",
          "ResearchExperiment baseline byte bound was exceeded."
        );
      }
      entries.push(captured);
    }
  };
  await walk(root, "");
  if (entries.length === 0) {
    throw baselineError(
      "research_experiment_baseline_empty",
      "ResearchExperiment baseline cannot be empty."
    );
  }
  entries.sort((left, right) =>
    left.relative_path.localeCompare(right.relative_path)
  );
  return {
    protocol_version: protocolVersion,
    snapshot_digest: canonicalDigest({
      protocol_version: protocolVersion,
      entries
    }),
    regular_file_count: entries.length,
    total_bytes: totalBytes,
    exclusion_policy: exclusionPolicy
  };
}

export async function verifyResearchExperimentBaseline(
  input: VerifyResearchExperimentBaselineInput
): Promise<void> {
  const actual = await captureResearchExperimentBaseline({
    root: input.root,
    maximumRegularFileCount: input.maximumRegularFileCount,
    maximumTotalBytes: input.maximumTotalBytes,
    exclusionPolicy: input.expected.exclusion_policy,
    protocolVersion: input.expected.protocol_version
  });
  if (!isDeepStrictEqual(actual, input.expected)) {
    throw baselineError(
      "research_experiment_baseline_digest_mismatch",
      "ResearchExperiment baseline does not match its frozen snapshot.",
      {
        expected_digest: input.expected.snapshot_digest,
        actual_digest: actual.snapshot_digest
      }
    );
  }
}

export async function ensureResearchExperimentStoreCopy(
  input: EnsureResearchExperimentStoreCopyInput
): Promise<void> {
  if (await pathExists(input.destinationRoot)) {
    await verifyResearchExperimentBaseline({
      root: input.destinationRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    return;
  }
  await verifyResearchExperimentBaseline({
    root: input.sourceRoot,
    expected: input.expected,
    maximumRegularFileCount: input.maximumRegularFileCount,
    maximumTotalBytes: input.maximumTotalBytes
  });
  const temporaryRoot = temporarySibling(input.destinationRoot);
  const sourceRoot = path.resolve(input.sourceRoot);
  await mkdir(path.dirname(input.destinationRoot), { recursive: true });
  await rm(temporaryRoot, { recursive: true, force: true });
  try {
    await cp(sourceRoot, temporaryRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true,
      filter(source) {
        const relative = path.relative(sourceRoot, path.resolve(source));
        if (!relative) return true;
        const relativePath = relative.split(path.sep).join(path.posix.sep);
        return !excludedRelativePath(
          relativePath,
          input.expected.exclusion_policy,
          input.expected.protocol_version
        );
      }
    });
    await verifyResearchExperimentBaseline({
      root: temporaryRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    await verifyResearchExperimentBaseline({
      root: input.sourceRoot,
      expected: input.expected,
      maximumRegularFileCount: input.maximumRegularFileCount,
      maximumTotalBytes: input.maximumTotalBytes
    });
    await rename(temporaryRoot, input.destinationRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function excludedRelativePath(
  relativePath: string,
  policy: ResearchExperimentBaselineSnapshot["exclusion_policy"],
  protocolVersion: ResearchExperimentBaselineSnapshot["protocol_version"]
): boolean {
  const [collection] = relativePath.split("/");
  return reconstructiblePathExcludedByProtocol(relativePath, protocolVersion) ||
    RESEARCH_CONTROL_EVIDENCE_COLLECTIONS.has(collection!) ||
    (policy === "research_experiment_evidence_only" &&
      RESEARCH_MEMORY_CONTROL_EVIDENCE_COLLECTIONS.has(collection!));
}

function reconstructiblePathExcludedByProtocol(
  relativePath: string,
  protocolVersion: ResearchExperimentBaselineSnapshot["protocol_version"]
): boolean {
  const [collection] = relativePath.split("/");
  if (protocolVersion === "local_store_regular_files_v2") {
    return RECONSTRUCTIBLE_LOCAL_STORE_COLLECTIONS.has(collection!);
  }
  return relativePath === "read-models/research-operations" ||
    relativePath.startsWith("read-models/research-operations/") ||
    relativePath ===
      ".locks/research-operations-projection-generation.json" ||
    relativePath === ".locks/research-operations-projection-publication" ||
    relativePath.startsWith(
      ".locks/research-operations-projection-publication/"
    );
}

async function captureRegularFile(
  filePath: string,
  relativePath: string
): Promise<SnapshotEntry> {
  const handle = await open(filePath, "r");
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      throw baselineError(
        "research_experiment_baseline_unsupported_entry",
        "ResearchExperiment baseline entry changed type during capture.",
        { relative_path: relativePath }
      );
    }
    const content = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      BigInt(content.byteLength) !== after.size) {
      throw baselineError(
        "research_experiment_baseline_unstable",
        "ResearchExperiment baseline file changed during capture.",
        { relative_path: relativePath }
      );
    }
    return {
      relative_path: relativePath.split(path.sep).join(path.posix.sep),
      byte_count: content.byteLength,
      content_digest: `sha256:${createHash("sha256").update(content).digest("hex")}`
    };
  } finally {
    await handle.close();
  }
}

function positiveBound(
  value: unknown,
  hardMaximum: number,
  code:
    | "research_experiment_baseline_file_bound_exceeded"
    | "research_experiment_baseline_byte_bound_exceeded"
): number {
  if (!Number.isInteger(value) || Number(value) < 1 ||
    Number(value) > hardMaximum) {
    throw baselineError(code, "ResearchExperiment baseline bound is invalid.");
  }
  return Number(value);
}

function canonicalPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw baselineError(
      "research_experiment_baseline_root_invalid",
      "ResearchExperiment baseline path is invalid."
    );
  }
  return value;
}

function canonicalDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(paperTradingComparisonPersistedRecordDigestInput(value))
    .digest("hex")}`;
}

function temporarySibling(destination: string): string {
  return `${destination}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
}

async function pathExists(candidate: string): Promise<boolean> {
  return Boolean(await stat(candidate).catch(() => undefined));
}

function baselineError(
  code: ResearchExperimentBaselineErrorCode,
  message: string,
  details?: Record<string, unknown>
): ResearchExperimentBaselineError {
  return new ResearchExperimentBaselineError(code, message, details);
}
