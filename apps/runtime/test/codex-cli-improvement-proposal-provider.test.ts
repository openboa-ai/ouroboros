import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ResearchFindingRecord,
  ImprovementProposalProviderOutput,
  ImprovementProposalProviderRequest,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { CodexCliImprovementProposalProviderAdapter } from "../src/providers/codex-cli-improvement-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-research-provider-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("CodexCliImprovementProposalProviderAdapter", () => {
  it("builds a schema-constrained Codex CLI command and parses proposal output", async () => {
    const outputPath = path.join(tmpDir, "improvement-proposal-output.json");
    const calls: string[][] = [];
    const timeouts: Array<number | undefined> = [];
    const adapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      schemaPath: "schema/improvement-proposal-output.schema.json",
      timeoutMs: 12_345,
      execFile: async (_file, args, options) => {
        calls.push(args);
        timeouts.push(options?.timeout);
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.125.0\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify(validProviderOutput()), "utf8");
        return { stdout: "", stderr: "" };
      }
    });
    const request = validRequest();

    const result = await adapter.runImprovementProposalGeneration(request);

    expect(calls.map((args) => args[0])).toEqual(["--version", "exec"]);
    expect(timeouts).toEqual([12_345, 12_345]);
    expect(calls[1]).toEqual(
      expect.arrayContaining([
        "--model",
        "gpt-5.4",
        "--sandbox",
        "read-only",
        "--output-schema",
        "schema/improvement-proposal-output.schema.json",
        "--output-last-message",
        outputPath
      ])
    );
    expect(result).toMatchObject({
      status: "succeeded",
      provider: {
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        invocation_surface: "codex exec --json --output-schema"
      },
      output: {
        output_kind: "improvement_proposal_input",
        output_authority_status: "proposal_input_only"
      },
      agent_run_ref: request.agent_run_ref,
      trace_ref: request.trace_ref,
      authority_status: "proposal_input_only"
    });
    expect(result.provider_output_artifact_refs).toEqual([
      { record_kind: "improvement_proposal_provider_output_artifact", id: outputPath }
    ]);
    expect(result.debug_artifact_refs).toEqual([
      { record_kind: "codex_cli_request_artifact", id: path.join(tmpDir, "provider-request.json") },
      { record_kind: "codex_cli_prompt_artifact", id: path.join(tmpDir, "provider-prompt.txt") },
      { record_kind: "codex_cli_command_artifact", id: path.join(tmpDir, "provider-command.json") }
    ]);
    await expect(readFile(path.join(tmpDir, "provider-request.json"), "utf8"))
      .resolves.toContain(request.idempotency_key);
    await expect(readFile(path.join(tmpDir, "provider-prompt.txt"), "utf8"))
      .resolves.toContain("Return only JSON matching the provided schema.");
    await expect(readFile(path.join(tmpDir, "provider-command.json"), "utf8"))
      .resolves.toContain(outputPath);
    expect(JSON.stringify(result)).not.toMatch(
      /improvement_proposal_id|strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
  });

  it("exposes the real Codex version probe output when available", async () => {
    const adapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async (_file, args) => {
        expect(args).toEqual(["--version"]);
        return { stdout: "codex-cli 0.130.0\n", stderr: "" };
      }
    });

    await expect(adapter.probeImprovementProposal()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      readiness_status: "active_verified",
      version: "codex-cli 0.130.0"
    });
  });

  it("probes real Codex availability without requiring it in unit tests", async () => {
    const adapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async () => {
        throw Object.assign(new Error("missing codex"), { code: "ENOENT" });
      }
    });

    await expect(adapter.probeImprovementProposal()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      readiness_status: "blocked_or_not_installed",
      failure_reason: "improvement_proposal_provider_unavailable"
    });
    const result = await adapter.runImprovementProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "improvement_proposal_provider_unavailable",
      authority_status: "proposal_input_only"
    });
    expect(result.provider_output_artifact_refs[0]).toEqual({
      record_kind: "improvement_proposal_provider_output_artifact",
      id: path.join(
        tmpDir,
        ".ouroboros/provider-runs/codex-improvement-proposal-provider/improvement-proposal-output.json"
      )
    });
    await expect(readFile(result.debug_artifact_refs[0].id, "utf8"))
      .resolves.toContain("codex-improvement-proposal-provider");
  });

  it("maps invalid schema output to adapter failure trace material", async () => {
    const outputPath = path.join(tmpDir, "invalid-improvement-proposal-output.json");
    const adapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async (_file, args) => {
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.125.0\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify({ output_kind: "wrong" }), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const result = await adapter.runImprovementProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "invalid_improvement_proposal_request",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
    await expect(readFile(outputPath, "utf8")).resolves.toContain("wrong");
  });

  it("maps timed-out Codex execution to a timeout failure trace", async () => {
    const adapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async (_file, args) => {
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.130.0\n", stderr: "" };
        }
        throw Object.assign(new Error("codex exec timed out"), {
          code: "ETIMEDOUT",
          killed: true,
          signal: "SIGTERM"
        });
      }
    });

    await expect(adapter.runImprovementProposalGeneration(validRequest())).resolves.toMatchObject({
      status: "failed",
      failure_reason: "improvement_proposal_provider_timeout",
      authority_status: "proposal_input_only"
    });
  });
});

function validRequest(): ImprovementProposalProviderRequest {
  const sourceFinding = researchFinding("research-finding-codex-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = researchFinding("research-finding-codex-provider-anti-001", "anti_hacking_case");
  return {
    idempotency_key: "codex-improvement-proposal-provider",
    task: fixtureTradingEvaluationTask(),
    findings: [sourceFinding, antiHackingFinding],
    existing_lineage_refs: [ref("artifact_lineage", "artifact-lineage-codex-provider-v1")],
    input_artifact_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    agent_run_ref: ref("agent_run", "agent-run-codex-improvement-proposal-provider"),
    trace_ref: ref("trace_placeholder", "trace-codex-improvement-proposal-provider"),
    created_at: "2026-05-11T20:00:00.000Z"
  };
}

function validProviderOutput(): ImprovementProposalProviderOutput {
  return {
    output_kind: "improvement_proposal_input",
    trading_evaluation_task_ref: ref("trading_evaluation_task", "trading-evaluation-task-codex-provider-001"),
    source_finding_refs: [ref("research_finding", "research-finding-codex-provider-next-001")],
    anti_hacking_finding_refs: [ref("research_finding", "research-finding-codex-provider-anti-001")],
    parent_system_code_ref: ref("system_code", "research-system-code-codex-provider-v1"),
    proposal_summary: "Codex provider output proposes the next opaque generic trading artifact input.",
    requested_change_summary: "Reduce drawdown while preserving sealed evaluator constraints.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    proposed_artifact_refs: [ref("provider_artifact_hint", "codex-provider-output-artifact-hint")],
    output_authority_status: "proposal_input_only"
  };
}

function researchFinding(
  findingId: string,
  findingKind: ResearchFindingRecord["finding_kind"]
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-codex-provider-001"),
    research_direction_ref: ref("research_direction", "research-direction-codex-provider-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-codex-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-codex-provider-001"),
    finding_kind: findingKind,
    summary: `Codex provider ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T20:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-codex-provider-001",
    market_scope: "external_trading_api_fixture",
    stage: "backtest",
    data_window_ref: ref("data_window", "sealed-replay-fixture-window"),
    fee_model_ref: ref("fee_model", "external-api-replay-fixture-fees"),
    funding_model_ref: ref("funding_model", "external-api-replay-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "sealed-replay-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "sealed-replay-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "sealed-replay-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "sealed-replay-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "sealed-replay-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
    created_at: "2026-05-11T20:00:00.000Z",
    authority_status: "not_live"
  };
}
