import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CandidateRunEvidenceReadModel } from "@ouroboros/domain";

export const DEFAULT_CANDIDATE_RUN_ROOT = path.join(".ouroboros", "trader-system-candidate-runs");

export interface ListCandidateRunEvidenceInput {
  root?: string;
  candidate_id?: string;
  limit?: number;
}

interface RawCandidateRunRecord {
  run_id?: unknown;
  candidate_id?: unknown;
  runner_kind?: unknown;
  status?: unknown;
  run_status?: unknown;
  scenario_accepted?: unknown;
  scenario_total?: unknown;
  provider_request_total?: unknown;
  runner_command_total?: unknown;
  artifact_digest?: unknown;
  completed_at?: unknown;
  authority_status?: unknown;
}

export async function listCandidateRunEvidence(
  input: ListCandidateRunEvidenceInput = {}
): Promise<CandidateRunEvidenceReadModel[]> {
  const root = path.resolve(input.root ?? DEFAULT_CANDIDATE_RUN_ROOT);
  const limit = input.limit ?? 10;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const runs: CandidateRunEvidenceReadModel[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const runDir = path.join(root, entry.name);
    const run = await readRunIfPresent(path.join(runDir, "run.json"), runDir);
    if (!run || (input.candidate_id && run.candidate_id !== input.candidate_id)) {
      continue;
    }
    runs.push(run);
  }

  return runs
    .sort((left, right) => Date.parse(right.completed_at) - Date.parse(left.completed_at))
    .slice(0, limit);
}

async function readRunIfPresent(
  pathname: string,
  runDir: string
): Promise<CandidateRunEvidenceReadModel | undefined> {
  try {
    const raw = JSON.parse(await readFile(pathname, "utf8")) as RawCandidateRunRecord;
    const runId = stringValue(raw.run_id);
    const candidateId = stringValue(raw.candidate_id);
    const runnerKind = stringValue(raw.runner_kind);
    const status = stringValue(raw.status);
    const runStatus = stringValue(raw.run_status);
    const artifactDigest = stringValue(raw.artifact_digest);
    const completedAt = stringValue(raw.completed_at);
    if (!runId || !candidateId || !runnerKind || !status || !runStatus || !artifactDigest || !completedAt) {
      return undefined;
    }
    return {
      run_id: runId,
      run_dir: runDir,
      candidate_id: candidateId,
      runner_kind: runnerKind,
      status,
      run_status: runStatus,
      scenario_accepted: numberValue(raw.scenario_accepted),
      scenario_total: numberValue(raw.scenario_total),
      provider_request_total: numberValue(raw.provider_request_total),
      runner_command_total: numberValue(raw.runner_command_total),
      artifact_digest: artifactDigest,
      completed_at: completedAt,
      authority_status: stringValue(raw.authority_status) ?? "not_live"
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number {
  return Number.isFinite(value) ? value as number : 0;
}
