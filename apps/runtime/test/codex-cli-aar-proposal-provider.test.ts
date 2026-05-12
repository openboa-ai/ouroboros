import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AarFindingRecord,
  AarProposalProviderOutput,
  AarProposalProviderRequest,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { CodexCliAarProposalProviderAdapter } from "../src/providers/codex-cli-aar-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-aar-provider-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("CodexCliAarProposalProviderAdapter", () => {
  it("builds a schema-constrained Codex CLI command and parses proposal output", async () => {
    const outputPath = path.join(tmpDir, "aar-proposal-output.json");
    const calls: string[][] = [];
    const timeouts: Array<number | undefined> = [];
    const adapter = new CodexCliAarProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      schemaPath: "schema/aar-proposal-output.schema.json",
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

    const result = await adapter.runAarProposalGeneration(request);

    expect(calls.map((args) => args[0])).toEqual(["--version", "exec"]);
    expect(timeouts).toEqual([12_345, 12_345]);
    expect(calls[1]).toEqual(
      expect.arrayContaining([
        "--model",
        "gpt-5.4",
        "--sandbox",
        "read-only",
        "--output-schema",
        "schema/aar-proposal-output.schema.json",
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
        output_kind: "aar_artifact_proposal_input",
        output_authority_status: "proposal_input_only"
      },
      agent_run_ref: request.agent_run_ref,
      trace_ref: request.trace_ref,
      authority_status: "proposal_input_only"
    });
    expect(result.provider_output_artifact_refs).toEqual([
      { record_kind: "aar_proposal_provider_output_artifact", id: outputPath }
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
      /aar_artifact_proposal_id|strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
  });

  it("exposes the real Codex version probe output when available", async () => {
    const adapter = new CodexCliAarProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async (_file, args) => {
        expect(args).toEqual(["--version"]);
        return { stdout: "codex-cli 0.130.0\n", stderr: "" };
      }
    });

    await expect(adapter.probeAarProposal()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      readiness_status: "active_verified",
      version: "codex-cli 0.130.0"
    });
  });

  it("probes real Codex availability without requiring it in unit tests", async () => {
    const adapter = new CodexCliAarProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async () => {
        throw Object.assign(new Error("missing codex"), { code: "ENOENT" });
      }
    });

    await expect(adapter.probeAarProposal()).resolves.toMatchObject({
      provider_kind: "codex_cli",
      readiness_status: "blocked_or_not_installed",
      failure_reason: "aar_proposal_provider_unavailable"
    });
    const result = await adapter.runAarProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "aar_proposal_provider_unavailable",
      authority_status: "proposal_input_only"
    });
    expect(result.provider_output_artifact_refs[0]).toEqual({
      record_kind: "aar_proposal_provider_output_artifact",
      id: path.join(
        tmpDir,
        ".ouroboros/provider-runs/codex-aar-proposal-provider/aar-proposal-output.json"
      )
    });
    await expect(readFile(result.debug_artifact_refs[0].id, "utf8"))
      .resolves.toContain("codex-aar-proposal-provider");
  });

  it("maps invalid schema output to adapter failure trace material", async () => {
    const outputPath = path.join(tmpDir, "invalid-aar-proposal-output.json");
    const adapter = new CodexCliAarProposalProviderAdapter({
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

    const result = await adapter.runAarProposalGeneration(validRequest());

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "invalid_aar_proposal_request",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
    await expect(readFile(outputPath, "utf8")).resolves.toContain("wrong");
  });

  it("maps timed-out Codex execution to a timeout failure trace", async () => {
    const adapter = new CodexCliAarProposalProviderAdapter({
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

    await expect(adapter.runAarProposalGeneration(validRequest())).resolves.toMatchObject({
      status: "failed",
      failure_reason: "aar_proposal_provider_timeout",
      authority_status: "proposal_input_only"
    });
  });
});

function validRequest(): AarProposalProviderRequest {
  const sourceFinding = aarFinding("aar-finding-codex-provider-next-001", "next_artifact_hint");
  const antiHackingFinding = aarFinding("aar-finding-codex-provider-anti-001", "anti_hacking_case");
  return {
    idempotency_key: "codex-aar-proposal-provider",
    task: btcPerpEvaluationTask(),
    findings: [sourceFinding, antiHackingFinding],
    existing_lineage_refs: [ref("aar_artifact_lineage", "aar-artifact-lineage-codex-provider-v1")],
    input_artifact_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    agent_run_ref: ref("agent_run", "agent-run-codex-aar-proposal-provider"),
    trace_ref: ref("trace_placeholder", "trace-codex-aar-proposal-provider"),
    created_at: "2026-05-11T20:00:00.000Z"
  };
}

function validProviderOutput(): AarProposalProviderOutput {
  return {
    output_kind: "aar_artifact_proposal_input",
    trading_evaluation_task_ref: ref("trading_evaluation_task", "trading-evaluation-task-codex-provider-001"),
    source_finding_refs: [ref("aar_finding", "aar-finding-codex-provider-next-001")],
    anti_hacking_finding_refs: [ref("aar_finding", "aar-finding-codex-provider-anti-001")],
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-codex-provider-v1"),
    proposal_summary: "Codex provider output proposes the next opaque BTC perp artifact input.",
    requested_change_summary: "Reduce drawdown while preserving sealed evaluator constraints.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    proposed_artifact_refs: [ref("provider_artifact_hint", "codex-provider-output-artifact-hint")],
    output_authority_status: "proposal_input_only"
  };
}

function aarFinding(
  findingId: string,
  findingKind: AarFindingRecord["finding_kind"]
): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: findingId,
    researcher_ref: ref("aar_researcher", "aar-researcher-codex-provider-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-codex-provider-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-codex-provider-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-codex-provider-001"),
    finding_kind: findingKind,
    summary: `Codex provider ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T20:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-codex-provider-001",
    market_scope: "binance_btc_perpetual_futures",
    stage: "backtest",
    data_window_ref: ref("data_window", "btc-perp-fixture-window"),
    fee_model_ref: ref("fee_model", "binance-btc-perp-fixture-fees"),
    funding_model_ref: ref("funding_model", "binance-btc-perp-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "btc-perp-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "btc-perp-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "btc-perp-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "btc-perp-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "btc-perp-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
    created_at: "2026-05-11T20:00:00.000Z",
    authority_status: "not_live"
  };
}
