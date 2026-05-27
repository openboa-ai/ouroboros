import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CandidateMaterializationFailureReason, CandidateMaterializationInput, Ref } from "@ouroboros/domain";
import type {
  CandidateGenerationProviderResult,
  CandidateGenerationRequest,
  ProviderProbeResult,
  RuntimeProviderAdapter
} from "./runtime-provider-adapter";

const execFileAsync = promisify(execFile);
const maxProviderOutputBytes = 10 * 1024 * 1024;

type ExecFileRunner = (
  file: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number }
) => Promise<{ stdout: string; stderr: string }>;

const defaultExecFileRunner: ExecFileRunner = async (file, args, options) => {
  const { stdout, stderr } = await execFileAsync(file, args, options);
  return {
    stdout: stdout.toString(),
    stderr: stderr.toString()
  };
};

export interface CodexCliProviderOptions {
  model?: string;
  workingDirectory?: string;
  schemaPath?: string;
  outputPath?: string;
  command?: string;
  execFile?: ExecFileRunner;
}

export class CodexCliProviderAdapter implements RuntimeProviderAdapter {
  private readonly model: string;
  private readonly workingDirectory: string;
  private readonly schemaPath: string;
  private readonly outputPath: string;
  private readonly command: string;
  private readonly execFile: ExecFileRunner;

  constructor(options: CodexCliProviderOptions = {}) {
    this.model = options.model ?? "gpt-5.4";
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.schemaPath = options.schemaPath ?? "apps/runtime/schemas/candidate-materialization-output.schema.json";
    this.outputPath = options.outputPath ?? ".ouroboros/provider-runs/latest-candidate-output.json";
    this.command = options.command ?? "codex";
    this.execFile = options.execFile ?? defaultExecFileRunner;
  }

  async probe(): Promise<ProviderProbeResult> {
    try {
      const { stdout } = await this.execFile(this.command, ["--version"], {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes
      });
      return {
        provider_kind: "codex_cli",
        model: this.model,
        readiness_status: "active_verified",
        version: stdout.trim()
      };
    } catch {
      return {
        provider_kind: "codex_cli",
        model: this.model,
        readiness_status: "blocked_or_not_installed",
        failure_reason: "provider_unavailable"
      };
    }
  }

  buildCommand(request: CandidateGenerationRequest): string[] {
    return [
      "exec",
      "--cd",
      this.workingDirectory,
      "--model",
      this.model,
      "--sandbox",
      "read-only",
      "--json",
      "--output-schema",
      this.schemaPath,
      "--output-last-message",
      this.outputPath,
      request.prompt
    ];
  }

  async runCandidateGeneration(request: CandidateGenerationRequest): Promise<CandidateGenerationProviderResult> {
    const probe = await this.probe();
    if (probe.readiness_status !== "active_verified") {
      return this.failureResult("provider_unavailable", "unavailable", request);
    }

    const runId = Date.now().toString();
    const outputFile = this.resolvedOutputPath();

    try {
      await mkdir(path.dirname(outputFile), { recursive: true });
      await rm(outputFile, { force: true });

      await this.execFile(this.command, this.buildCommand(request), {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes
      });

      const rawOutput = await readFile(outputFile, "utf8");
      const output = JSON.parse(rawOutput) as CandidateMaterializationInput;
      return {
        status: "succeeded",
        output
      };
    } catch (error) {
      return this.failureResult(this.failureReason(error), runId, request);
    }
  }

  private resolvedOutputPath(): string {
    return path.isAbsolute(this.outputPath)
      ? this.outputPath
      : path.join(this.workingDirectory, this.outputPath);
  }

  private failureReason(error: unknown): CandidateMaterializationFailureReason {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "schema_missing";
    }
    if (error instanceof SyntaxError) {
      return "schema_invalid";
    }
    return "provider_failed";
  }

  private failureResult(
    failureReason: CandidateMaterializationFailureReason,
    runId: string,
    request: CandidateGenerationRequest
  ): CandidateGenerationProviderResult {
    return {
      status: "failed",
      failure_reason: failureReason,
      idempotency_key: `codex-cli-${failureReason}-${runId}`,
      provider_kind: "codex_cli",
      model: this.model,
      agent_run_id: `agent-run-codex-cli-${runId}`,
      trace_id: `trace-codex-cli-${runId}`,
      artifact_refs: this.artifactRefs(request)
    };
  }

  private artifactRefs(request: CandidateGenerationRequest): Ref[] {
    return [
      {
        record_kind: "codex_cli_command",
        id: [this.command, ...this.buildCommand(request)].join(" ")
      },
      {
        record_kind: "codex_cli_output_path",
        id: this.resolvedOutputPath()
      }
    ];
  }
}
