import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AarProposalProviderAttribution,
  AarProposalProviderOutput,
  AarProposalProviderProbeResult,
  AarProposalProviderRequest,
  AarProposalProviderResult,
  Ref
} from "@ouroboros/domain";
import type { AarProposalProviderAdapter } from "./runtime-provider-adapter";

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

export interface CodexCliAarProposalProviderOptions {
  model?: string;
  workingDirectory?: string;
  schemaPath?: string;
  outputPath?: string;
  command?: string;
  execFile?: ExecFileRunner;
}

export class CodexCliAarProposalProviderAdapter implements AarProposalProviderAdapter {
  private readonly provider: AarProposalProviderAttribution;
  private readonly workingDirectory: string;
  private readonly schemaPath: string;
  private readonly outputPath: string;
  private readonly command: string;
  private readonly execFile: ExecFileRunner;

  constructor(options: CodexCliAarProposalProviderOptions = {}) {
    this.provider = {
      provider_kind: "codex_cli",
      model: options.model ?? "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema"
    };
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.schemaPath = options.schemaPath ?? "apps/runtime/schemas/aar-proposal-provider-output.schema.json";
    this.outputPath = options.outputPath ?? ".ouroboros/provider-runs/latest-aar-proposal-output.json";
    this.command = options.command ?? "codex";
    this.execFile = options.execFile ?? defaultExecFileRunner;
  }

  async probeAarProposal(): Promise<AarProposalProviderProbeResult> {
    try {
      await this.execFile(this.command, ["--version"], {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes
      });
      return {
        ...this.provider,
        readiness_status: "active_verified",
        supported_purposes: ["aar_artifact_proposal_generation"]
      };
    } catch {
      return {
        ...this.provider,
        readiness_status: "blocked_or_not_installed",
        supported_purposes: ["aar_artifact_proposal_generation"],
        failure_reason: "aar_proposal_provider_unavailable"
      };
    }
  }

  buildCommand(request: AarProposalProviderRequest): string[] {
    return [
      "exec",
      "--cd",
      this.workingDirectory,
      "--model",
      this.provider.model,
      "--sandbox",
      "read-only",
      "--json",
      "--output-schema",
      this.schemaPath,
      "--output-last-message",
      this.outputPath,
      this.buildPrompt(request)
    ];
  }

  async runAarProposalGeneration(
    request: AarProposalProviderRequest
  ): Promise<AarProposalProviderResult> {
    const probe = await this.probeAarProposal();
    if (probe.readiness_status !== "active_verified") {
      return this.failureResult(request, "aar_proposal_provider_unavailable");
    }

    const outputFile = this.resolvedOutputPath();
    try {
      await mkdir(path.dirname(outputFile), { recursive: true });
      await rm(outputFile, { force: true });
      await this.execFile(this.command, this.buildCommand(request), {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes
      });

      const rawOutput = await readFile(outputFile, "utf8");
      const output = JSON.parse(rawOutput) as AarProposalProviderOutput;
      if (!isValidProviderOutput(output)) {
        return this.failureResult(request, "invalid_aar_proposal_request");
      }

      return {
        status: "succeeded",
        provider: this.provider,
        output,
        agent_run_ref: request.agent_run_ref,
        agent_event_refs: [agentEventRef(request)],
        trace_ref: request.trace_ref,
        provider_output_artifact_refs: [providerOutputArtifactRef(outputFile)],
        debug_artifact_refs: [codexCommandRef(this.command, this.buildCommand(request))],
        idempotency_key: request.idempotency_key,
        authority_status: "proposal_input_only"
      };
    } catch (error) {
      return this.failureResult(
        request,
        error instanceof SyntaxError ? "invalid_aar_proposal_request" : "aar_proposal_provider_failed"
      );
    }
  }

  private resolvedOutputPath(): string {
    return path.isAbsolute(this.outputPath)
      ? this.outputPath
      : path.join(this.workingDirectory, this.outputPath);
  }

  private buildPrompt(request: AarProposalProviderRequest): string {
    return [
      "Generate one AAR proposal provider output for the Ouroboros BTC perpetual futures research loop.",
      "Return only JSON matching the provided schema.",
      "Provider output is proposal_input_only and must not claim durable proposal truth, counted evidence, credentials, paper authority, or live authority.",
      `Task ref: trading_evaluation_task/${request.task.trading_evaluation_task_id}`,
      `Finding refs: ${request.findings.map((finding) => finding.aar_finding_id).join(", ")}`,
      `Existing lineage refs: ${(request.existing_lineage_refs ?? []).map((lineage) => lineage.id).join(", ") || "none"}`
    ].join("\n");
  }

  private failureResult(
    request: AarProposalProviderRequest,
    failureReason: Extract<AarProposalProviderResult, { status: "failed" }>["failure_reason"]
  ): AarProposalProviderResult {
    return {
      status: "failed",
      provider: this.provider,
      failure_reason: failureReason,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [agentEventRef(request)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [providerOutputArtifactRef(this.resolvedOutputPath())],
      debug_artifact_refs: [codexCommandRef(this.command, this.buildCommand(request))],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

function isValidProviderOutput(output: AarProposalProviderOutput): boolean {
  return (
    output?.output_kind === "aar_artifact_proposal_input" &&
    output.output_authority_status === "proposal_input_only" &&
    isRef(output.trading_evaluation_task_ref, "trading_evaluation_task") &&
    Array.isArray(output.source_finding_refs) &&
    output.source_finding_refs.length > 0 &&
    output.source_finding_refs.every((item) => isRef(item, "aar_finding")) &&
    typeof output.proposal_summary === "string" &&
    output.proposal_summary.trim().length > 0 &&
    typeof output.requested_change_summary === "string" &&
    output.requested_change_summary.trim().length > 0 &&
    Array.isArray(output.proposed_artifact_refs) &&
    output.proposed_artifact_refs.length > 0 &&
    output.proposed_artifact_refs.every((item) => isRef(item))
  );
}

function isRef(value: unknown, recordKind?: string): value is Ref {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Ref>;
  return (
    typeof candidate.record_kind === "string" &&
    candidate.record_kind.length > 0 &&
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    (recordKind === undefined || candidate.record_kind === recordKind)
  );
}

function agentEventRef(request: AarProposalProviderRequest): Ref {
  return ref("agent_event", `agent-event-codex-aar-proposal-${safeId(request.idempotency_key)}`);
}

function providerOutputArtifactRef(outputFile: string): Ref {
  return ref("aar_proposal_provider_output_artifact", outputFile);
}

function codexCommandRef(command: string, args: string[]): Ref {
  return ref("codex_cli_command", [command, ...args].join(" "));
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
