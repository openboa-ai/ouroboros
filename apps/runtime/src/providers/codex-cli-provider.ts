import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  CandidateGenerationProviderResult,
  CandidateGenerationRequest,
  ProviderProbeResult,
  RuntimeProviderAdapter
} from "./runtime-provider-adapter";

const execFileAsync = promisify(execFile);

export interface CodexCliProviderOptions {
  model?: string;
  workingDirectory?: string;
  schemaPath?: string;
  outputPath?: string;
}

export class CodexCliProviderAdapter implements RuntimeProviderAdapter {
  private readonly model: string;
  private readonly workingDirectory: string;
  private readonly schemaPath: string;
  private readonly outputPath: string;

  constructor(options: CodexCliProviderOptions = {}) {
    this.model = options.model ?? "gpt-5.4";
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.schemaPath = options.schemaPath ?? "apps/runtime/schemas/candidate-materialization-output.schema.json";
    this.outputPath = options.outputPath ?? ".ouroboros/provider-runs/latest-candidate-output.json";
  }

  async probe(): Promise<ProviderProbeResult> {
    try {
      const { stdout } = await execFileAsync("codex", ["--version"]);
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
      return {
        status: "failed",
        failure_reason: probe.failure_reason ?? "provider_unavailable",
        idempotency_key: `codex-cli-unavailable-${Date.now()}`,
        provider_kind: "codex_cli",
        model: this.model,
        agent_run_id: `agent-run-codex-cli-unavailable-${Date.now()}`,
        trace_id: `trace-codex-cli-unavailable-${Date.now()}`,
        artifact_refs: []
      };
    }

    return {
      status: "failed",
      failure_reason: "schema_missing",
      idempotency_key: `codex-cli-schema-not-collected-${Date.now()}`,
      provider_kind: "codex_cli",
      model: this.model,
      agent_run_id: `agent-run-codex-cli-schema-not-collected-${Date.now()}`,
      trace_id: `trace-codex-cli-schema-not-collected-${Date.now()}`,
      artifact_refs: [
        {
          record_kind: "codex_cli_command",
          id: this.buildCommand(request).join(" ")
        }
      ]
    };
  }
}
