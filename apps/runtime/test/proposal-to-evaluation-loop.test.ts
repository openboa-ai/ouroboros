import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  ImprovementProposalProviderOutput,
  ProviderKind,
  Ref,
  SandboxRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { FixtureImprovementProposalProviderAdapter } from "../src/research-orchestration/fixture-improvement-proposal-provider";
import { planImprovementProposalFromLocalStore } from "../src/research-orchestration/local-store-proposal-loop";
import { evaluateSystemCodeForResearch } from "../src/research-evaluation/system-code-research-submission";
import { CodexCliImprovementProposalProviderAdapter } from "../src/providers/codex-cli-improvement-proposal-provider";
import type { ImprovementProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

type ProviderBackedEvaluationProviderKind = Extract<
  ProviderKind,
  "codex_cli" | "fixture_only"
>;

interface ProviderBackedEvaluationCase {
  label: string;
  expectedProviderKind: ProviderBackedEvaluationProviderKind;
  adapter: (input: ProviderBackedEvaluationFixtureInput) => ImprovementProposalProviderAdapter;
}

const providerBackedEvaluationCases = [
  {
    label: "fixture-adapter",
    expectedProviderKind: "fixture_only",
    adapter: () => new FixtureImprovementProposalProviderAdapter()
  },
  {
    label: "codex-cli-shaped-adapter",
    expectedProviderKind: "codex_cli",
    adapter: codexCliShapedAdapter
  }
] satisfies ProviderBackedEvaluationCase[];

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-proposal-evaluation-loop-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("improvement proposal to sealed evaluation loop", () => {
  it.each(providerBackedEvaluationCases)(
    "proves finding to provider-backed proposal to opaque artifact to sealed evaluator result through $label",
    async (caseInput) => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const task = fixtureTradingEvaluationTask(caseInput.label);
      const sourceFinding = researchFinding({
        id: `research-finding-market-trend-next-${caseInput.label}`,
        findingKind: "next_artifact_hint",
        createdAt: "2026-05-11T17:00:00.000Z"
      });
      const antiHackingFinding = researchFinding({
        id: `research-finding-market-lookahead-quarantine-${caseInput.label}`,
        findingKind: "anti_hacking_case",
        createdAt: "2026-05-11T17:00:01.000Z"
      });
      const priorLineage = artifactLineage(sourceFinding);
      await store.recordResearchFinding(sourceFinding);
      await store.recordResearchFinding(antiHackingFinding);
      await store.recordArtifactLineage(priorLineage);

      const proposalOutcome = await planImprovementProposalFromLocalStore({
        store,
        task,
        provider_adapter: caseInput.adapter({
          task,
          sourceFinding,
          antiHackingFinding,
          priorLineage,
          outputPath: path.join(tmpDir, `${caseInput.label}-provider-output.json`)
        }),
        idempotency_key: "proposal-to-evaluation-loop",
        created_at: "2026-05-11T17:01:00.000Z"
      });
      const sandbox = sandboxSandbox({
        systemCodeRef: proposalOutcome.system_code,
        instanceId: "sandbox-proposed-artifact-001"
      });
      const evaluationOutcome = evaluateSystemCodeForResearch({
        sandbox: sandbox,
        research_worker_ref: proposalOutcome.proposal.research_worker_ref,
        research_direction_ref: proposalOutcome.proposal.research_direction_ref,
        task,
        experiment_id: "experiment-run-proposed-artifact-001",
        submitted_at: "2026-05-11T17:02:00.000Z"
      });

      expect(proposalOutcome.run).toMatchObject({
        status: "proposed",
        authority_status: "research_only",
        output_artifact_proposal_ref: {
          record_kind: "improvement_proposal",
          id: proposalOutcome.proposal.improvement_proposal_id
        },
        output_system_code_ref: {
          record_kind: "system_code",
          id: proposalOutcome.system_code.system_code_id
        }
      });
      const materializationAttempts = await store.listImprovementProposalMaterializationAttempts();
      expect(materializationAttempts).toHaveLength(1);
      const materializationAttempt = materializationAttempts[0];
      expect(materializationAttempt).toMatchObject({
        provider: {
          provider_kind: caseInput.expectedProviderKind
        },
        agent_run_ref: {
          record_kind: "agent_run"
        },
        agent_event_refs: [
          {
            record_kind: "agent_event"
          }
        ],
        trace_ref: {
          record_kind: "trace_placeholder"
        },
        provider_output_artifact_refs: [
          {
            record_kind: "improvement_proposal_provider_output_artifact"
          }
        ],
        status: "materialized",
        validation_status: "accepted",
        output_artifact_proposal_ref: {
          record_kind: "improvement_proposal",
          id: proposalOutcome.proposal.improvement_proposal_id
        },
        output_system_code_ref: {
          record_kind: "system_code",
          id: proposalOutcome.system_code.system_code_id
        },
        output_lineage_ref: {
          record_kind: "artifact_lineage",
          id: proposalOutcome.lineage.artifact_lineage_id
        },
        authority_status: "proposal_input_only"
      });
      expect(proposalOutcome.run.trace_ref).toEqual(materializationAttempt.trace_ref);
      expect(proposalOutcome.system_code.provenance_refs).toEqual(
        expect.arrayContaining([
          {
            record_kind: "improvement_proposal",
            id: proposalOutcome.proposal.improvement_proposal_id
          },
          materializationAttempt.agent_run_ref,
          materializationAttempt.trace_ref,
          { record_kind: "research_finding", id: sourceFinding.research_finding_id }
        ])
      );
      expect(proposalOutcome.lineage.parent_system_code_ref).toEqual(
        priorLineage.child_system_code_ref
      );
      await expect(store.listImprovementProposals()).resolves.toEqual([proposalOutcome.proposal]);
      await expect(store.getSystemCode(proposalOutcome.system_code.system_code_id))
        .resolves.toEqual(proposalOutcome.system_code);
      await expect(store.listResearchOrchestrationRuns()).resolves.toEqual([proposalOutcome.run]);
      expect(proposalOutcome.proposal.anti_hacking_finding_refs).toEqual([
        { record_kind: "research_finding", id: antiHackingFinding.research_finding_id }
      ]);

      expect(evaluationOutcome.experiment).toMatchObject({
        system_code_ref: {
          record_kind: "system_code",
          id: proposalOutcome.system_code.system_code_id
        },
        sandbox_ref: {
          record_kind: "sandbox",
          id: sandbox.sandbox_id
        },
        status: "evaluated",
        authority_status: "not_live"
      });
      expect(evaluationOutcome.evaluation_result).toMatchObject({
        result_status: "accepted",
        evidence_disposition: "not_counted",
        authority_status: "not_counted",
        evaluator_ref: {
          record_kind: "external_evaluator",
          id: "sealed-replay-fixture-evaluator-v1"
        }
      });
      expect(evaluationOutcome.evaluation_result.evaluator_trace_ref).not.toEqual(
        evaluationOutcome.experiment.trace_ref
      );
      expect(evaluationOutcome.experiment.trace_ref).not.toEqual(materializationAttempt.trace_ref);
      expect(evaluationOutcome.evaluation_result.evaluator_trace_ref).not.toEqual(
        materializationAttempt.trace_ref
      );

      const recordSurface = JSON.stringify({
        materializationAttempt,
        proposalOutcome,
        evaluationOutcome
      });
      expect(recordSurface).toContain("anti_hacking_finding_refs");
      expect(recordSurface).toContain("trace-sealed-replay-experiment-run-proposed-artifact-001");
      expect(recordSurface).not.toContain("claude_code");
      expect(recordSurface).not.toMatch(
        /strategy_internals|strategy_schema|venue_credentials|venue_api_key|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence|venue_adapter/i
      );
    }
  );
});

interface ProviderBackedEvaluationFixtureInput {
  task: TradingEvaluationTaskRecord;
  sourceFinding: ResearchFindingRecord;
  antiHackingFinding: ResearchFindingRecord;
  priorLineage: ArtifactLineageRecord;
  outputPath: string;
}

function codexCliShapedAdapter(
  input: ProviderBackedEvaluationFixtureInput
): ImprovementProposalProviderAdapter {
  return new CodexCliImprovementProposalProviderAdapter({
    workingDirectory: tmpDir,
    outputPath: input.outputPath,
    model: "gpt-5.4-codex-shaped-test",
    execFile: async (file, args) => {
      if (args.length === 1 && args[0] === "--version") {
        return {
          stdout: "codex 5.4.0-test\n",
          stderr: ""
        };
      }

      expect(file).toBe("codex");
      expect(args).toContain("exec");
      expect(args).toContain("--json");
      expect(args).toContain("--output-schema");
      const outputPathIndex = args.indexOf("--output-last-message");
      expect(outputPathIndex).toBeGreaterThan(-1);
      const outputPath = args[outputPathIndex + 1];
      expect(outputPath).toBe(input.outputPath);
      await writeFile(outputPath, JSON.stringify(codexImprovementProposalProviderOutput(input)), "utf8");
      return {
        stdout: "{\"type\":\"final\"}\n",
        stderr: ""
      };
    }
  });
}

function codexImprovementProposalProviderOutput(
  input: ProviderBackedEvaluationFixtureInput
): ImprovementProposalProviderOutput {
  return {
    output_kind: "improvement_proposal_input",
    trading_evaluation_task_ref: ref(
      "trading_evaluation_task",
      input.task.trading_evaluation_task_id
    ),
    source_finding_refs: [ref("research_finding", input.sourceFinding.research_finding_id)],
    anti_hacking_finding_refs: [ref("research_finding", input.antiHackingFinding.research_finding_id)],
    parent_system_code_ref: input.priorLineage.child_system_code_ref,
    proposal_summary: "Codex-shaped improvement proposal input for the opaque system code loop.",
    requested_change_summary: "Materialize the proposal through the provider-neutral adapter boundary.",
    expected_improvement_summary: "Keep provider output trace-only while proving sealed generic trading evaluation.",
    proposed_artifact_refs: [
      ref("codex_cli_research_proposal_output", `output-${input.sourceFinding.research_finding_id}`)
    ],
    output_authority_status: "proposal_input_only"
  };
}

function researchFinding(input: {
  id: string;
  findingKind: ResearchFindingRecord["finding_kind"];
  createdAt: string;
}): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: input.id,
    research_worker_ref: ref("research_worker", "research-worker-market-trend-001"),
    research_direction_ref: ref("research_direction", "research-direction-market-trend-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-market-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-market-trend-001"),
    finding_kind: input.findingKind,
    summary: `Fixture ${input.findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${input.id}-metric`)],
    created_at: input.createdAt,
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: ResearchFindingRecord): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-market-trend-v1",
    child_system_code_ref: ref("system_code", "research-system-code-market-trend-v1"),
    parent_system_code_ref: ref("system_code", "research-system-code-market-seed-v1"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: "2026-05-11T17:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function sandboxSandbox(input: {
  systemCodeRef: { system_code_id: string };
  instanceId: string;
}): SandboxRecord {
  return {
    record_kind: "sandbox",
    version: 1,
    sandbox_id: input.instanceId,
    adapter_kind: "docker_sandboxes_sbx",
    system_code_ref: ref("system_code", input.systemCodeRef.system_code_id),
    runtime_ref: ref("trading_run", "runtime-proposed-artifact-001"),
    sandbox_placement_ref: ref("sandbox_placement", "sandbox-placement-sdx-proposed-artifact-001"),
    lifecycle_status: "running",
    sandbox_name: "ouro-s7-proposed-artifact-001",
    sandbox_ref: ref("docker_sandbox", "ouro-s7-proposed-artifact-001"),
    created_at: "2026-05-11T17:01:30.000Z",
    started_at: "2026-05-11T17:01:31.000Z",
    last_heartbeat_at: "2026-05-11T17:01:32.000Z",
    log_refs: [ref("sandbox_log", "runtime-log-proposed-artifact-001")],
    heartbeat_refs: [ref("runtime_heartbeat", "runtime-heartbeat-proposed-artifact-001")],
    command_evidence_refs: [ref("sandbox_command_evidence", "sandbox-command-proposed-artifact-001")],
    trace_ref: ref("trace_placeholder", "trace-runtime-self-report-proposed-artifact-001"),
    authority_status: "not_live"
  };
}

function fixtureTradingEvaluationTask(label = "001"): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: `trading-evaluation-task-sealed-replay-proposal-evaluation-${label}`,
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
    created_at: "2026-05-11T17:00:00.000Z",
    authority_status: "not_live"
  };
}
