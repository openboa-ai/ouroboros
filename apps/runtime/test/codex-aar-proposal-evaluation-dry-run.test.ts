import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AarProposalProviderOutput, Ref } from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  codexAarProposalDryRunFixtureIds
} from "../src/aar-orchestration/codex-aar-proposal-dry-run";
import { runCodexAarProposalEvaluationDryRun } from "../src/aar-orchestration/codex-aar-proposal-evaluation-dry-run";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-codex-aar-evaluation-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Codex AAR proposal evaluation dry-run", () => {
  it("continues a Codex-shaped proposal through runtime instance and sealed BTC perp evaluation", async () => {
    const fakeCodex = path.join(tmpDir, "fake-codex.mjs");
    await writeFakeCodex(fakeCodex);

    const outcome = await runCodexAarProposalEvaluationDryRun({
      store_root: tmpDir,
      working_directory: tmpDir,
      codex_command: fakeCodex,
      idempotency_key: "codex-aar-evaluation-success",
      created_at: "2026-05-12T03:00:00.000Z",
      submitted_at: "2026-05-12T03:01:00.000Z",
      runtime_test_ticks: 2,
      runtime_interval_ms: 500
    });

    expect(outcome.status).toBe("evaluated");
    if (outcome.status !== "evaluated") {
      throw new Error("expected evaluated Codex AAR proposal dry-run");
    }

    expect(outcome.proposal.proposal.authority_status).toBe("proposal_only");
    expect(outcome.proposal.runnable_artifact.authority_status).toBe("not_live");
    expect(outcome.proposal.lineage.authority_status).toBe("lineage_only");
    expect(outcome.runtime_instance).toMatchObject({
      adapter_kind: "deterministic_test",
      lifecycle_status: "running",
      authority_status: "not_live",
      runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: outcome.proposal.runnable_artifact.runnable_artifact_id
      }
    });
    expect(outcome.experiment).toMatchObject({
      status: "evaluated",
      authority_status: "not_live",
      runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: outcome.proposal.runnable_artifact.runnable_artifact_id
      },
      sandbox_runtime_instance_ref: {
        record_kind: "sandbox_runtime_instance",
        id: outcome.runtime_instance.sandbox_runtime_instance_id
      }
    });
    expect(outcome.evaluation_result).toMatchObject({
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      evaluator_ref: {
        record_kind: "external_evaluator",
        id: "sealed-btc-perp-fixture-evaluator-v1"
      }
    });
    expect(outcome.trace_refs.provider_trace_ref).not.toEqual(outcome.trace_refs.runtime_trace_ref);
    expect(outcome.trace_refs.provider_trace_ref).not.toEqual(outcome.trace_refs.evaluator_trace_ref);
    expect(outcome.trace_refs.runtime_trace_ref).not.toEqual(outcome.trace_refs.evaluator_trace_ref);

    const store = new LocalStore(tmpDir);
    const materializationAttempts = await store.listAarProposalMaterializationAttempts();
    expect(materializationAttempts).toHaveLength(1);
    expect(materializationAttempts[0].provider_output_artifact_refs).toEqual([
      expect.objectContaining({
        record_kind: "aar_proposal_provider_output_artifact"
      })
    ]);
    await expect(store.listAarArtifactProposals()).resolves.toEqual([outcome.proposal.proposal]);
    await expect(store.getRunnableArtifact(outcome.proposal.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual(outcome.proposal.runnable_artifact);
    const lineages = await store.listAarArtifactLineages();
    expect(lineages).toHaveLength(2);
    expect(lineages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        aar_artifact_lineage_id: codexAarProposalDryRunFixtureIds.priorLineage
      }),
      outcome.proposal.lineage
    ]));
    await expect(store.listAarOrchestrationRuns()).resolves.toEqual([outcome.proposal.run]);
    await expect(store.listRuntimeInstances()).resolves.toHaveLength(1);
    await expect(store.listAarExperiments()).resolves.toEqual([outcome.experiment]);
    await expect(store.listTradingEvaluationResults()).resolves.toEqual([outcome.evaluation_result]);

    const recordSurface = JSON.stringify({ outcome, materializationAttempts });
    expect(recordSurface).toContain("aar_proposal_provider_output_artifact");
    expect(recordSurface).toContain("runtime_heartbeat");
    expect(recordSurface).toContain("trace-sealed-btc-perp-aar-experiment-codex-aar-codex-aar-evaluation-success");
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

function providerOutput(): AarProposalProviderOutput {
  return {
    output_kind: "aar_artifact_proposal_input",
    trading_evaluation_task_ref: ref("trading_evaluation_task", codexAarProposalDryRunFixtureIds.task),
    source_finding_refs: [ref("aar_finding", codexAarProposalDryRunFixtureIds.sourceFinding)],
    anti_hacking_finding_refs: [ref("aar_finding", codexAarProposalDryRunFixtureIds.antiHackingFinding)],
    parent_runnable_artifact_ref: ref(
      "runnable_artifact",
      codexAarProposalDryRunFixtureIds.priorRunnableArtifact
    ),
    proposal_summary: "Codex evaluation dry-run proposes the next opaque BTC perp artifact input.",
    requested_change_summary: "Run the proposal through deterministic runtime and sealed evaluator boundaries.",
    expected_improvement_summary: "Keep runtime and evaluator traces separate while preserving not-counted status.",
    proposed_artifact_refs: [ref("codex_cli_aar_proposal_output", "codex-aar-evaluation-output")],
    output_authority_status: "proposal_input_only"
  };
}
