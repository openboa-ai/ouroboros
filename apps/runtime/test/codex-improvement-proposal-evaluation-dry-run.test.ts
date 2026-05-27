import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ImprovementProposalProviderOutput, Ref } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  codexImprovementProposalDryRunFixtureIds
} from "@ouroboros/application/research-orchestration/codex-improvement-proposal-dry-run";
import { runCodexImprovementProposalEvaluationDryRun } from "@ouroboros/application/research-orchestration/codex-improvement-proposal-evaluation-dry-run";
import { DeterministicSandboxAdapter } from "@ouroboros/adapters/sandboxes/sandbox-adapter";
import { CodexCliImprovementProposalProviderAdapter } from "@ouroboros/adapters/providers/codex-cli-improvement-proposal-provider";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-research-evaluation-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Codex research proposal evaluation dry-run", () => {
  it("continues a Codex-shaped proposal through sandbox and sealed generic trading evaluation", async () => {
    const fakeCodex = path.join(tmpDir, "fake-codex.mjs");
    await writeFakeCodex(fakeCodex);

    const outcome = await runCodexImprovementProposalEvaluationDryRun({
      store: new LocalStore(tmpDir),
      store_root: tmpDir,
      provider_adapter: new CodexCliImprovementProposalProviderAdapter({
        workingDirectory: tmpDir,
        command: fakeCodex
      }),
      runtime_adapter: new DeterministicSandboxAdapter({
        allowedSystemCodeIds: ["research-system-code-proposal-0eafd77ae629bb67"],
        allowedArtifactRoots: [process.cwd()],
        allowedCapabilityPolicyIds: ["provider-improvement-proposal"]
      }),
      working_directory: tmpDir,
      codex_command: fakeCodex,
      idempotency_key: "codex-research-evaluation-success",
      created_at: "2026-05-12T03:00:00.000Z",
      submitted_at: "2026-05-12T03:01:00.000Z",
      runtime_test_ticks: 2,
      runtime_interval_ms: 500
    });

    if (outcome.status !== "evaluated") {
      throw new Error(`expected evaluated Codex research proposal dry-run: ${JSON.stringify(outcome)}`);
    }

    expect(outcome.proposal.proposal.authority_status).toBe("proposal_only");
    expect(outcome.proposal.system_code.authority_status).toBe("not_live");
    expect(outcome.proposal.lineage.authority_status).toBe("lineage_only");
    expect(outcome.sandbox).toMatchObject({
      adapter_kind: "deterministic_test",
      lifecycle_status: "stopped",
      authority_status: "not_live",
      system_code_ref: {
        record_kind: "system_code",
        id: outcome.proposal.system_code.system_code_id
      }
    });
    expect(outcome.experiment).toMatchObject({
      status: "evaluated",
      authority_status: "not_live",
      system_code_ref: {
        record_kind: "system_code",
        id: outcome.proposal.system_code.system_code_id
      },
      sandbox_ref: {
        record_kind: "sandbox",
        id: outcome.sandbox.sandbox_id
      }
    });
    expect(outcome.evaluation_result).toMatchObject({
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      evaluator_ref: {
        record_kind: "external_evaluator",
        id: "sealed-replay-fixture-evaluator-v1"
      }
    });
    expect(outcome.trace_refs.provider_trace_ref).not.toEqual(outcome.trace_refs.runtime_trace_ref);
    expect(outcome.trace_refs.provider_trace_ref).not.toEqual(outcome.trace_refs.evaluator_trace_ref);
    expect(outcome.trace_refs.runtime_trace_ref).not.toEqual(outcome.trace_refs.evaluator_trace_ref);

    const store = new LocalStore(tmpDir);
    const materializationAttempts = await store.listImprovementProposalMaterializationAttempts();
    expect(materializationAttempts).toHaveLength(1);
    expect(materializationAttempts[0].provider_output_artifact_refs).toEqual([
      expect.objectContaining({
        record_kind: "improvement_proposal_provider_output_artifact"
      })
    ]);
    await expect(store.listImprovementProposals()).resolves.toEqual([outcome.proposal.proposal]);
    await expect(store.getSystemCode(outcome.proposal.system_code.system_code_id))
      .resolves.toEqual(outcome.proposal.system_code);
    const lineages = await store.listArtifactLineages();
    expect(lineages).toHaveLength(2);
    expect(lineages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        artifact_lineage_id: codexImprovementProposalDryRunFixtureIds.priorLineage
      }),
      outcome.proposal.lineage
    ]));
    await expect(store.listResearchOrchestrationRuns()).resolves.toEqual([outcome.proposal.run]);
    await expect(store.listSandboxes()).resolves.toHaveLength(1);
    await expect(store.listExperimentRuns()).resolves.toEqual([outcome.experiment]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([outcome.evaluation_result]);

    const recordSurface = JSON.stringify({ outcome, materializationAttempts });
    expect(recordSurface).toContain("improvement_proposal_provider_output_artifact");
    expect(recordSurface).toContain("runtime_heartbeat");
    expect(recordSurface).toContain("trace-sealed-replay-experiment-run-codex-research-codex-research-evaluation-success");
    expect(recordSurface).not.toMatch(
      /strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence|venue_adapter|claude_code/i
    );
  });
});

async function writeFakeCodex(filePath: string): Promise<void> {
  await writeFile(
    filePath,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("codex-cli fake-evaluation 0.1.0\\n");
  process.exit(0);
}

const outputPath = args[args.indexOf("--output-last-message") + 1];
writeFileSync(outputPath, ${JSON.stringify(JSON.stringify(providerOutput()))});
`,
    { mode: 0o755 }
  );
}

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
    proposal_summary: "Codex evaluation dry-run proposes the next opaque generic trading artifact input.",
    requested_change_summary: "Run the proposal through deterministic runtime and sealed evaluator boundaries.",
    expected_improvement_summary: "Keep runtime and evaluator traces separate while preserving not-counted status.",
    proposed_artifact_refs: [ref("codex_cli_research_proposal_output", "codex-research-evaluation-output")],
    output_authority_status: "proposal_input_only"
  };
}
