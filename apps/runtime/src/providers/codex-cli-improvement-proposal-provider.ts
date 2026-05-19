import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderOutput,
  ImprovementProposalProviderProbeResult,
  ImprovementProposalProviderRequest,
  ImprovementProposalProviderResult,
  Ref
} from "@ouroboros/domain";
import type { ImprovementProposalProviderAdapter } from "./runtime-provider-adapter";

const execFileAsync = promisify(execFile);
const maxProviderOutputBytes = 10 * 1024 * 1024;

type ExecFileRunner = (
  file: string,
  args: string[],
  options?: { cwd?: string; maxBuffer?: number; timeout?: number }
) => Promise<{ stdout: string; stderr: string }>;

const defaultExecFileRunner: ExecFileRunner = async (file, args, options) => {
  const { stdout, stderr } = await execFileAsync(file, args, options);
  return {
    stdout: stdout.toString(),
    stderr: stderr.toString()
  };
};

export interface CodexCliImprovementProposalProviderOptions {
  model?: string;
  workingDirectory?: string;
  schemaPath?: string;
  outputPath?: string;
  command?: string;
  timeoutMs?: number;
  execFile?: ExecFileRunner;
}

export class CodexCliImprovementProposalProviderAdapter implements ImprovementProposalProviderAdapter {
  private readonly provider: ImprovementProposalProviderAttribution;
  private readonly workingDirectory: string;
  private readonly schemaPath: string;
  private readonly outputPath?: string;
  private readonly command: string;
  private readonly timeoutMs: number;
  private readonly execFile: ExecFileRunner;

  constructor(options: CodexCliImprovementProposalProviderOptions = {}) {
    this.provider = {
      provider_kind: "codex_cli",
      model: options.model ?? "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema"
    };
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.schemaPath = options.schemaPath ?? "apps/runtime/schemas/improvement-proposal-provider-output.schema.json";
    this.outputPath = options.outputPath;
    this.command = options.command ?? "codex";
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.execFile = options.execFile ?? defaultExecFileRunner;
  }

  async probeImprovementProposal(): Promise<ImprovementProposalProviderProbeResult> {
    try {
      const { stdout } = await this.execFile(this.command, ["--version"], {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes,
        timeout: this.timeoutMs
      });
      return {
        ...this.provider,
        readiness_status: "active_verified",
        version: stdout.trim(),
        supported_purposes: ["improvement_proposal_generation"]
      };
    } catch {
      return {
        ...this.provider,
        readiness_status: "blocked_or_not_installed",
        supported_purposes: ["improvement_proposal_generation"],
        failure_reason: "improvement_proposal_provider_unavailable"
      };
    }
  }

  buildCommand(request: ImprovementProposalProviderRequest): string[] {
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

  async runImprovementProposalGeneration(
    request: ImprovementProposalProviderRequest
  ): Promise<ImprovementProposalProviderResult> {
    const artifacts = await this.prepareRunArtifacts(request);
    const probe = await this.probeImprovementProposal();
    if (probe.readiness_status !== "active_verified") {
      return this.failureResult(request, "improvement_proposal_provider_unavailable", artifacts);
    }

    try {
      await this.execFile(this.command, artifacts.commandArgs, {
        cwd: this.workingDirectory,
        maxBuffer: maxProviderOutputBytes,
        timeout: this.timeoutMs
      });

      const rawOutput = await readFile(artifacts.outputFile, "utf8");
      const output = JSON.parse(rawOutput) as ImprovementProposalProviderOutput;
      if (!isValidProviderOutput(output)) {
        return this.failureResult(request, "invalid_improvement_proposal_request", artifacts);
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
        this.failureReason(error),
        artifacts
      );
    }
  }

  private async prepareRunArtifacts(
    request: ImprovementProposalProviderRequest
  ): Promise<CodexImprovementProposalRunArtifacts> {
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
        output_path: outputFile,
        timeout_ms: this.timeoutMs
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

  private outputPathForRequest(request: ImprovementProposalProviderRequest): string {
    if (this.outputPath) {
      return path.isAbsolute(this.outputPath)
        ? this.outputPath
        : path.join(this.workingDirectory, this.outputPath);
    }
    return path.join(
      this.workingDirectory,
      ".ouroboros/provider-runs",
      safeId(request.idempotency_key),
      "improvement-proposal-output.json"
    );
  }

  private buildPrompt(request: ImprovementProposalProviderRequest): string {
    return [
      "Generate one improvement proposal provider output for the Ouroboros generic trading instruments research loop.",
      "Return only JSON matching the provided schema.",
      "Provider output is proposal_input_only and must not claim durable proposal truth, counted evidence, credentials, paper authority, or live authority.",
      `Task ref: trading_evaluation_task/${request.task.trading_evaluation_task_id}`,
      `Finding refs: ${request.findings.map((finding) => finding.research_finding_id).join(", ")}`,
      `Existing lineage refs: ${(request.existing_lineage_refs ?? []).map((lineage) => lineage.id).join(", ") || "none"}`
    ].join("\n");
  }

  private buildCommandForOutput(
    request: ImprovementProposalProviderRequest,
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
    request: ImprovementProposalProviderRequest,
    failureReason: Extract<ImprovementProposalProviderResult, { status: "failed" }>["failure_reason"],
    artifacts: CodexImprovementProposalRunArtifacts
  ): ImprovementProposalProviderResult {
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

  private failureReason(
    error: unknown
  ): Extract<ImprovementProposalProviderResult, { status: "failed" }>["failure_reason"] {
    if (error instanceof SyntaxError) {
      return "invalid_improvement_proposal_request";
    }
    const processError = error as NodeJS.ErrnoException & {
      killed?: boolean;
      signal?: NodeJS.Signals;
    };
    if (processError.code === "ETIMEDOUT" || processError.killed || processError.signal === "SIGTERM") {
      return "improvement_proposal_provider_timeout";
    }
    return "improvement_proposal_provider_failed";
  }
}

interface CodexImprovementProposalRunArtifacts {
  outputFile: string;
  requestFile: string;
  promptFile: string;
  commandFile: string;
  commandArgs: string[];
}

function isValidProviderOutput(output: ImprovementProposalProviderOutput): boolean {
  return (
    output?.output_kind === "improvement_proposal_input" &&
    output.output_authority_status === "proposal_input_only" &&
    isRef(output.trading_evaluation_task_ref, "trading_evaluation_task") &&
    Array.isArray(output.source_finding_refs) &&
    output.source_finding_refs.length > 0 &&
    output.source_finding_refs.every((item) => isRef(item, "research_finding")) &&
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

function agentEventRef(request: ImprovementProposalProviderRequest): Ref {
  return ref("agent_event", `agent-event-codex-improvement-proposal-${safeId(request.idempotency_key)}`);
}

function providerOutputArtifactRef(outputFile: string): Ref {
  return ref("improvement_proposal_provider_output_artifact", outputFile);
}

function debugArtifactRefs(artifacts: CodexImprovementProposalRunArtifacts): Ref[] {
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
