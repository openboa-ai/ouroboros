import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  private readonly outputPath?: string;
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
    this.outputPath = options.outputPath;
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
    const outputFile = this.outputPathForRequest(request);
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
      outputFile,
      this.buildPrompt(request)
    ];
  }

  async runAarProposalGeneration(
    request: AarProposalProviderRequest
  ): Promise<AarProposalProviderResult> {
    const artifacts = await this.prepareRunArtifacts(request);
    const probe = await this.probeAarProposal();
    if (probe.readiness_status !== "active_verified") {
      return this.failureResult(request, "aar_proposal_provider_unavailable", artifacts);
    }

    try {
      await this.execFile(this.command, artifacts.commandArgs, {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes
      });

      const rawOutput = await readFile(artifacts.outputFile, "utf8");
      const output = JSON.parse(rawOutput) as AarProposalProviderOutput;
      if (!isValidProviderOutput(output)) {
        return this.failureResult(request, "invalid_aar_proposal_request", artifacts);
      }

      return {
        status: "succeeded",
        provider: this.provider,
        output,
        agent_run_ref: request.agent_run_ref,
        agent_event_refs: [agentEventRef(request)],
        trace_ref: request.trace_ref,
        provider_output_artifact_refs: [providerOutputArtifactRef(artifacts.outputFile)],
        debug_artifact_refs: debugArtifactRefs(artifacts),
        idempotency_key: request.idempotency_key,
        authority_status: "proposal_input_only"
      };
    } catch (error) {
      return this.failureResult(
        request,
        error instanceof SyntaxError ? "invalid_aar_proposal_request" : "aar_proposal_provider_failed",
        artifacts
      );
    }
  }

  private async prepareRunArtifacts(
    request: AarProposalProviderRequest
  ): Promise<CodexAarProposalRunArtifacts> {
    const outputFile = this.outputPathForRequest(request);
    const prompt = this.buildPrompt(request);
    const commandArgs = this.buildCommandForOutput(request, outputFile, prompt);
    const runDir = path.dirname(outputFile);
    const requestFile = path.join(runDir, "provider-request.json");
    const promptFile = path.join(runDir, "provider-prompt.txt");
    const commandFile = path.join(runDir, "provider-command.json");

    await mkdir(runDir, { recursive: true });
    await rm(outputFile, { force: true });
    await writeFile(requestFile, `${JSON.stringify(request, null, 2)}\n`, "utf8");
    await writeFile(promptFile, `${prompt}\n`, "utf8");
    await writeFile(
      commandFile,
      `${JSON.stringify({
        command: this.command,
        args: commandArgs,
        cwd: this.workingDirectory,
        schema_path: this.schemaPath,
        output_path: outputFile
      }, null, 2)}\n`,
      "utf8"
    );

    return {
      outputFile,
      requestFile,
      promptFile,
      commandFile,
      commandArgs
    };
  }

  private outputPathForRequest(request: AarProposalProviderRequest): string {
    if (this.outputPath) {
      return path.isAbsolute(this.outputPath)
        ? this.outputPath
        : path.join(this.workingDirectory, this.outputPath);
    }
    return path.join(
      this.workingDirectory,
      ".ouroboros/provider-runs",
      safeId(request.idempotency_key),
      "aar-proposal-output.json"
    );
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

  private buildCommandForOutput(
    request: AarProposalProviderRequest,
    outputFile: string,
    prompt: string
  ): string[] {
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
      outputFile,
      prompt
    ];
  }

  private failureResult(
    request: AarProposalProviderRequest,
    failureReason: Extract<AarProposalProviderResult, { status: "failed" }>["failure_reason"],
    artifacts: CodexAarProposalRunArtifacts
  ): AarProposalProviderResult {
    return {
      status: "failed",
      provider: this.provider,
      failure_reason: failureReason,
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [agentEventRef(request)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [providerOutputArtifactRef(artifacts.outputFile)],
      debug_artifact_refs: debugArtifactRefs(artifacts),
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

interface CodexAarProposalRunArtifacts {
  outputFile: string;
  requestFile: string;
  promptFile: string;
  commandFile: string;
  commandArgs: string[];
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

function debugArtifactRefs(artifacts: CodexAarProposalRunArtifacts): Ref[] {
  return [
    ref("codex_cli_request_artifact", artifacts.requestFile),
    ref("codex_cli_prompt_artifact", artifacts.promptFile),
    ref("codex_cli_command_artifact", artifacts.commandFile)
  ];
}

function ref(record_kind: string, id: string): Ref {
  return { record_kind, id };
}

function safeId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96) || "empty";
}
