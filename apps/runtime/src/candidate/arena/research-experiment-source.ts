import { createHash, randomBytes } from "node:crypto";
import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { resolveCandidateArenaSourceArtifactDir } from
  "@ouroboros/application/candidate/arena";
import type { OuroborosStorePort } from "@ouroboros/application/ports/store";
import { sealSingleFileTradingArtifactClosure } from
  "@ouroboros/application/trading/research/artifact-closure";
import { readTradingSystemManifest } from
  "@ouroboros/application/trading/research/artifact-runner";
import {
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonSystemCodeRecordDigestInput,
  type ResearchExperimentSource
} from "@ouroboros/domain";

export type ResearchExperimentSourceErrorCode =
  | "research_experiment_source_candidate_invalid"
  | "research_experiment_source_artifact_invalid"
  | "research_experiment_source_artifact_mismatch";

export class ResearchExperimentSourceError extends Error {
  constructor(
    readonly code: ResearchExperimentSourceErrorCode,
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ResearchExperimentSourceError";
  }
}

export interface ResolveResearchExperimentSourceInput {
  store: OuroborosStorePort;
  candidateId: string;
  repoRoot: string;
}

export interface VerifyResearchExperimentSourceArtifactInput {
  artifactDirectory: string;
  expectedClosureDigest: string;
}

export interface EnsureResearchExperimentSourceArtifactInput {
  sourceArtifactDirectory: string;
  destinationRoot: string;
  expectedClosureDigest: string;
}

export async function resolveResearchExperimentSource(
  input: ResolveResearchExperimentSourceInput
): Promise<{ source: ResearchExperimentSource; artifactDirectory: string }> {
  const candidate = await input.store.getCandidate(input.candidateId);
  const systemCodeRef = candidate?.system_code?.ref;
  const systemCode = systemCodeRef
    ? await input.store.getSystemCode(systemCodeRef.id)
    : undefined;
  if (!candidate || !systemCode || systemCode.artifact_kind !== "python_file") {
    throw sourceError(
      "research_experiment_source_candidate_invalid",
      "ResearchExperiment source candidate must bind Python SystemCode."
    );
  }
  let artifactDirectory: string;
  try {
    artifactDirectory = await resolveCandidateArenaSourceArtifactDir({
      store: input.store,
      source: candidate,
      repoRoot: input.repoRoot
    });
  } catch (error) {
    throw sourceError(
      "research_experiment_source_candidate_invalid",
      "ResearchExperiment source artifact could not be resolved.",
      { reason: conciseError(error) }
    );
  }
  const closureDigest = await sourceArtifactClosureDigest(artifactDirectory);
  return {
    source: {
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: candidate.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: candidate.candidate_version.candidate_version_id
      },
      system_code_ref: {
        record_kind: "system_code",
        id: systemCode.system_code_id
      },
      system_code_artifact_digest: systemCode.artifact_digest,
      system_code_record_digest: canonicalDigest(
        paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
      ),
      research_artifact_protocol: "single_file_python_v1",
      research_artifact_closure_digest: closureDigest
    },
    artifactDirectory
  };
}

export async function verifyResearchExperimentSourceArtifact(
  input: VerifyResearchExperimentSourceArtifactInput
): Promise<void> {
  const actual = await sourceArtifactClosureDigest(input.artifactDirectory);
  if (actual !== input.expectedClosureDigest) {
    throw sourceError(
      "research_experiment_source_artifact_mismatch",
      "ResearchExperiment source artifact closure changed.",
      {
        expected_digest: input.expectedClosureDigest,
        actual_digest: actual
      }
    );
  }
}

export async function ensureResearchExperimentSourceArtifact(
  input: EnsureResearchExperimentSourceArtifactInput
): Promise<void> {
  if (await pathExists(input.destinationRoot)) {
    await verifyResearchExperimentSourceArtifact({
      artifactDirectory: input.destinationRoot,
      expectedClosureDigest: input.expectedClosureDigest
    });
    return;
  }
  await verifyResearchExperimentSourceArtifact({
    artifactDirectory: input.sourceArtifactDirectory,
    expectedClosureDigest: input.expectedClosureDigest
  });
  const temporaryRoot = temporarySibling(input.destinationRoot);
  await mkdir(path.dirname(input.destinationRoot), { recursive: true });
  await rm(temporaryRoot, { recursive: true, force: true });
  try {
    await cp(input.sourceArtifactDirectory, temporaryRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
      preserveTimestamps: true
    });
    await verifyResearchExperimentSourceArtifact({
      artifactDirectory: temporaryRoot,
      expectedClosureDigest: input.expectedClosureDigest
    });
    await verifyResearchExperimentSourceArtifact({
      artifactDirectory: input.sourceArtifactDirectory,
      expectedClosureDigest: input.expectedClosureDigest
    });
    await rename(temporaryRoot, input.destinationRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

async function sourceArtifactClosureDigest(
  artifactDirectory: string
): Promise<string> {
  try {
    const manifest = await readTradingSystemManifest(artifactDirectory);
    const sealed = await sealSingleFileTradingArtifactClosure(
      artifactDirectory,
      manifest
    );
    return sealed.closure_digest;
  } catch (error) {
    if (error instanceof ResearchExperimentSourceError) throw error;
    throw sourceError(
      "research_experiment_source_artifact_invalid",
      "ResearchExperiment source artifact is not a sealed single-file system.",
      { reason: conciseError(error) }
    );
  }
}

function canonicalDigest(value: unknown): string {
  const text = typeof value === "string"
    ? value
    : paperTradingComparisonPersistedRecordDigestInput(value);
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function temporarySibling(destination: string): string {
  return `${destination}.tmp-${process.pid}-${randomBytes(6).toString("hex")}`;
}

async function pathExists(candidate: string): Promise<boolean> {
  return Boolean(await stat(candidate).catch(() => undefined));
}

function conciseError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceError(
  code: ResearchExperimentSourceErrorCode,
  message: string,
  details?: Record<string, unknown>
): ResearchExperimentSourceError {
  return new ResearchExperimentSourceError(code, message, details);
}
