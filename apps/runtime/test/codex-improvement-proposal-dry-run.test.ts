import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ImprovementProposalProviderOutput, Ref } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  codexImprovementProposalDryRunFixtureIds,
  runCodexImprovementProposalDryRun
} from "@ouroboros/application/research/orchestration/codex-improvement-proposal-dry-run";
import { CodexCliImprovementProposalProviderAdapter } from "@ouroboros/adapters/codex/improvement-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-research-dry-run-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Codex research proposal dry-run command runner", () => {
  it("runs Codex CLI through the adapter and materializes proposal records", async () => {
    const outputPath = path.join(tmpDir, "provider-output.json");
    const calls: string[][] = [];
    const providerAdapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async (_file, args) => {
        calls.push(args);
        if (args[0] === "--version") {
          return { stdout: "codex 5.4.0-test\n", stderr: "" };
        }
        await writeFile(outputPath, JSON.stringify(providerOutput()), "utf8");
        return { stdout: "", stderr: "" };
      }
    });

    const outcome = await runCodexImprovementProposalDryRun({
      store: new LocalStore(tmpDir),
      store_root: tmpDir,
      provider_adapter: providerAdapter,
      idempotency_key: "codex-research-dry-run-command-success",
      created_at: "2026-05-12T01:00:00.000Z"
    });

    expect(outcome.status).toBe("materialized");
    expect(calls.map((args) => args[0])).toEqual(["--version", "exec"]);
    if (outcome.status !== "materialized") {
      throw new Error("expected materialized dry-run outcome");
    }
    expect(outcome.outcome.proposal.authority_status).toBe("proposal_only");
    expect(outcome.outcome.system_code.authority_status).toBe("not_live");
    expect(outcome.outcome.lineage.authority_status).toBe("lineage_only");

    const store = new LocalStore(tmpDir);
    const attempts = await store.listImprovementProposalMaterializationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      provider: {
        provider_kind: "codex_cli"
      },
      provider_output_artifact_refs: [
        {
          record_kind: "improvement_proposal_provider_output_artifact",
          id: outputPath
        }
      ],
      status: "materialized",
      authority_status: "proposal_input_only"
    });
    expect(attempts[0].debug_artifact_refs.map((artifactRef) => artifactRef.record_kind)).toEqual([
      "codex_cli_request_artifact",
      "codex_cli_prompt_artifact",
      "codex_cli_command_artifact"
    ]);
    await expect(store.listImprovementProposals()).resolves.toEqual([outcome.outcome.proposal]);
    expect(JSON.stringify({ outcome, attempts })).not.toMatch(
      /strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence|venue_adapter/i
    );
  });

  it("records failed provider output without proposal records when Codex is unavailable", async () => {
    const outputPath = path.join(tmpDir, "missing-provider-output.json");
    const providerAdapter = new CodexCliImprovementProposalProviderAdapter({
      workingDirectory: tmpDir,
      outputPath,
      execFile: async () => {
        throw Object.assign(new Error("missing codex"), { code: "ENOENT" });
      }
    });

    const outcome = await runCodexImprovementProposalDryRun({
      store: new LocalStore(tmpDir),
      store_root: tmpDir,
      provider_adapter: providerAdapter,
      idempotency_key: "codex-research-dry-run-command-missing",
      created_at: "2026-05-12T01:01:00.000Z"
    });

    expect(outcome).toMatchObject({
      status: "failed",
      failure_reason: "improvement_proposal_provider_unavailable"
    });
    const store = new LocalStore(tmpDir);
    const attempts = await store.listImprovementProposalMaterializationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      provider: {
        provider_kind: "codex_cli"
      },
      status: "failed",
      validation_status: "rejected",
      failure_reason: "improvement_proposal_provider_unavailable",
      authority_status: "proposal_input_only"
    });
    await expect(store.listImprovementProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toMatchObject([
      {
        artifact_lineage_id: codexImprovementProposalDryRunFixtureIds.priorLineage
      }
    ]);
  });
});

function providerOutput(): ImprovementProposalProviderOutput {
  return {
    output_kind: "improvement_proposal_input",
    trading_evaluation_task_ref: ref("trading_evaluation_task", codexImprovementProposalDryRunFixtureIds.task),
    source_finding_refs: [ref("research_finding", codexImprovementProposalDryRunFixtureIds.sourceFinding)],
    anti_hacking_finding_refs: [ref("research_finding", codexImprovementProposalDryRunFixtureIds.antiHackingFinding)],
    parent_system_code_ref: ref(
      "system_code",
      codexImprovementProposalDryRunFixtureIds.priorSystemCode
    ),
    proposal_summary: "Codex dry-run proposes the next opaque generic trading artifact input.",
    requested_change_summary: "Preserve sealed evaluator constraints while improving robustness.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    proposed_artifact_refs: [ref("codex_cli_research_proposal_output", "codex-research-dry-run-output")],
    output_authority_status: "proposal_input_only"
  };
}
