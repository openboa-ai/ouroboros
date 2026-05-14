import { pathToFileURL } from "node:url";
import { runCodexArtifactChangeProposalDryRun } from "./codex-artifact-change-proposal-dry-run";

interface CliOptions {
  store_root?: string;
  idempotency_key?: string;
  created_at?: string;
  output_path?: string;
  schema_path?: string;
  codex_command?: string;
  codex_model?: string;
  codex_timeout_ms?: number;
  working_directory?: string;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const outcome = await runCodexArtifactChangeProposalDryRun({
    store_root: options.store_root ?? process.env.OUROBOROS_STORE_ROOT,
    idempotency_key: options.idempotency_key ?? process.env.OUROBOROS_ARTIFACT_CHANGE_PROPOSAL_IDEMPOTENCY_KEY,
    created_at: options.created_at ?? process.env.OUROBOROS_ARTIFACT_CHANGE_PROPOSAL_CREATED_AT,
    output_path: options.output_path ?? process.env.OUROBOROS_CODEX_ARTIFACT_CHANGE_PROPOSAL_OUTPUT_PATH,
    schema_path: options.schema_path ?? process.env.OUROBOROS_CODEX_ARTIFACT_CHANGE_PROPOSAL_SCHEMA_PATH,
    codex_command: options.codex_command ?? process.env.OUROBOROS_CODEX_BIN,
    codex_model: options.codex_model ?? process.env.OUROBOROS_CODEX_MODEL,
    codex_timeout_ms: options.codex_timeout_ms ?? numberFromEnv("OUROBOROS_CODEX_TIMEOUT_MS"),
    working_directory: options.working_directory ?? process.cwd()
  });

  process.stdout.write(`${JSON.stringify(toCliOutput(outcome), null, 2)}\n`);
  if (outcome.status === "failed") {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag.startsWith("--")) {
      throw new Error(`unexpected argument: ${flag}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`missing value for ${flag}`);
    }
    index += 1;
    switch (flag) {
      case "--store-root":
        options.store_root = value;
        break;
      case "--idempotency-key":
        options.idempotency_key = value;
        break;
      case "--created-at":
        options.created_at = value;
        break;
      case "--output-path":
        options.output_path = value;
        break;
      case "--schema-path":
        options.schema_path = value;
        break;
      case "--codex-command":
        options.codex_command = value;
        break;
      case "--codex-model":
        options.codex_model = value;
        break;
      case "--codex-timeout-ms":
        options.codex_timeout_ms = parsePositiveInteger(value, flag);
        break;
      case "--working-directory":
        options.working_directory = value;
        break;
      default:
        throw new Error(`unknown option: ${flag}`);
    }
  }
  return options;
}

function numberFromEnv(name: string): number | undefined {
  const value = process.env[name];
  return value ? parsePositiveInteger(value, name) : undefined;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function toCliOutput(outcome: Awaited<ReturnType<typeof runCodexArtifactChangeProposalDryRun>>): object {
  if (outcome.status === "failed") {
    return outcome;
  }
  return {
    status: outcome.status,
    store_root: outcome.store_root,
    idempotency_key: outcome.idempotency_key,
    research_orchestration_run_id: outcome.outcome.run.research_orchestration_run_id,
    artifact_change_proposal_id: outcome.outcome.proposal.artifact_change_proposal_id,
    runnable_artifact_id: outcome.outcome.runnable_artifact.runnable_artifact_id,
    artifact_lineage_id: outcome.outcome.lineage.artifact_lineage_id,
    authority_status: {
      run: outcome.outcome.run.authority_status,
      proposal: outcome.outcome.proposal.authority_status,
      runnable_artifact: outcome.outcome.runnable_artifact.authority_status,
      lineage: outcome.outcome.lineage.authority_status
    }
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
