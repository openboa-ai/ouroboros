import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ArtifactChangeProposalProviderOutput, Ref } from "@ouroboros/domain";
import { runCodexArtifactChangeProposalDryRunAudit } from "../src/research-orchestration/codex-artifact-change-proposal-dry-run-audit";
import { codexArtifactChangeProposalDryRunFixtureIds } from "../src/research-orchestration/codex-artifact-change-proposal-dry-run";
import { CodexCliArtifactChangeProposalProviderAdapter } from "../src/providers/codex-cli-artifact-change-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-research-audit-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Codex research proposal dry-run audit", () => {
  it("can materialize through an executable Codex-compatible subprocess", async () => {
    const fakeCodex = path.join(tmpDir, "fake-codex.mjs");
    await writeFile(
      fakeCodex,
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("codex-cli fake-process 0.1.0\\n");
  process.exit(0);
}

const outputPath = args[args.indexOf("--output-last-message") + 1];
writeFileSync(outputPath, ${JSON.stringify(JSON.stringify(providerOutput()))});
`,
      { mode: 0o755 }
    );

    const audit = await runCodexArtifactChangeProposalDryRunAudit({
      store_root: tmpDir,
      working_directory: tmpDir,
      codex_command: fakeCodex,
      idempotency_key: "codex-research-audit-subprocess-success",
      created_at: "2026-05-12T02:00:30.000Z"
    });

    expect(audit.probe).toMatchObject({
      readiness_status: "active_verified",
      version: "codex-cli fake-process 0.1.0"
    });
    expect(audit.dry_run.status).toBe("materialized");
    expect(audit.delta).toEqual({
      artifact_change_proposal_materialization_attempts: 1,
      artifact_change_proposals: 1,
      runnable_artifacts: 1,
      artifact_lineages: 1,
      research_orchestration_runs: 1
    });
    expect(audit.latest_attempt).toMatchObject({
      status: "materialized",
      validation_status: "accepted",
      authority_status: "proposal_input_only"
    });
  });

  it("proves the local success path without requiring real Codex in unit tests", async () => {
    const outputPath = path.join(tmpDir, "provider-output.json");
    const calls: string[][] = [];
    const providerAdapter = new CodexCliArtifactChangeProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async (_file, args) => {
        calls.push(args);
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.130.0\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify(providerOutput()), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const audit = await runCodexArtifactChangeProposalDryRunAudit({
      store_root: tmpDir,
      provider_adapter: providerAdapter,
      idempotency_key: "codex-research-audit-success",
      created_at: "2026-05-12T02:00:00.000Z"
    });

    expect(calls.map((args) => args[0])).toEqual(["--version", "--version", "exec"]);
    expect(audit.probe).toMatchObject({
      readiness_status: "active_verified",
      version: "codex-cli 0.130.0"
    });
    expect(audit.dry_run.status).toBe("materialized");
    expect(audit.delta).toEqual({
      artifact_change_proposal_materialization_attempts: 1,
      artifact_change_proposals: 1,
      runnable_artifacts: 1,
      artifact_lineages: 1,
      research_orchestration_runs: 1
    });
    expect(audit.latest_attempt).toMatchObject({
      status: "materialized",
      validation_status: "accepted",
      authority_status: "proposal_input_only"
    });
    expect(audit.latest_attempt?.provider_output_artifact_refs).toEqual([
      { record_kind: "artifact_change_proposal_provider_output_artifact", id: outputPath }
    ]);
    expect(JSON.stringify(audit)).not.toMatch(
      /strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence|venue_adapter/i
    );
  });

  it("records unavailable Codex without partial proposal, artifact, lineage, or run writes", async () => {
    const providerAdapter = new CodexCliArtifactChangeProposalProviderAdapter({
      workingDirectory: tmpDir,
      execFile: async () => {
        throw Object.assign(new Error("missing codex"), { code: "ENOENT" });
      }
    });

    const audit = await runCodexArtifactChangeProposalDryRunAudit({
      store_root: tmpDir,
      provider_adapter: providerAdapter,
      idempotency_key: "codex-research-audit-missing",
      created_at: "2026-05-12T02:01:00.000Z"
    });

    expect(audit.probe).toMatchObject({
      readiness_status: "blocked_or_not_installed",
      failure_reason: "artifact_change_proposal_provider_unavailable"
    });
    expect(audit.dry_run).toMatchObject({
      status: "failed",
      failure_reason: "artifact_change_proposal_provider_unavailable"
    });
    expect(audit.delta).toEqual({
      artifact_change_proposal_materialization_attempts: 1,
      artifact_change_proposals: 0,
      runnable_artifacts: 0,
      artifact_lineages: 0,
      research_orchestration_runs: 0
    });
    expect(audit.latest_attempt).toMatchObject({
      status: "failed",
      validation_status: "rejected",
      failure_reason: "artifact_change_proposal_provider_unavailable",
      authority_status: "proposal_input_only"
    });
  });

  it("records invalid provider output without partial proposal, artifact, lineage, or run writes", async () => {
    const outputPath = path.join(tmpDir, "invalid-provider-output.json");
    const providerAdapter = new CodexCliArtifactChangeProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async (_file, args) => {
        if (args[0] === "--version") {
          return { stdout: "codex-cli 0.130.0\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify({ output_kind: "wrong" }), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const audit = await runCodexArtifactChangeProposalDryRunAudit({
      store_root: tmpDir,
      provider_adapter: providerAdapter,
      idempotency_key: "codex-research-audit-invalid",
      created_at: "2026-05-12T02:02:00.000Z"
    });

    expect(audit.probe).toMatchObject({
      readiness_status: "active_verified",
      version: "codex-cli 0.130.0"
    });
    expect(audit.dry_run).toMatchObject({
      status: "failed",
      failure_reason: "invalid_artifact_change_proposal_request"
    });
    expect(audit.delta).toEqual({
      artifact_change_proposal_materialization_attempts: 1,
      artifact_change_proposals: 0,
      runnable_artifacts: 0,
      artifact_lineages: 0,
      research_orchestration_runs: 0
    });
    await expect(readFile(outputPath, "utf8")).resolves.toContain("wrong");
    expect(audit.latest_attempt).toMatchObject({
      status: "failed",
      validation_status: "rejected",
      failure_reason: "invalid_artifact_change_proposal_request",
      authority_status: "proposal_input_only"
    });
  });
});

function providerOutput(): ArtifactChangeProposalProviderOutput {
  return {
    output_kind: "artifact_change_proposal_input",
    trading_evaluation_task_ref: ref("trading_evaluation_task", codexArtifactChangeProposalDryRunFixtureIds.task),
    source_finding_refs: [ref("research_finding", codexArtifactChangeProposalDryRunFixtureIds.sourceFinding)],
    anti_hacking_finding_refs: [ref("research_finding", codexArtifactChangeProposalDryRunFixtureIds.antiHackingFinding)],
    parent_runnable_artifact_ref: ref(
      "runnable_artifact",
      codexArtifactChangeProposalDryRunFixtureIds.priorRunnableArtifact
    ),
    proposal_summary: "Codex dry-run audit proposes the next opaque generic trading artifact input.",
    requested_change_summary: "Preserve sealed evaluator constraints while improving robustness.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    proposed_artifact_refs: [ref("codex_cli_research_proposal_output", "codex-research-audit-output")],
    output_authority_status: "proposal_input_only"
  };
}
