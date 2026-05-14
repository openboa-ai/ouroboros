import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  ArtifactChangeProposalProviderResult,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { planArtifactChangeProposalFromLocalStore } from "../src/research-orchestration/local-store-proposal-loop";
import type { ArtifactChangeProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-artifact-change-proposal-loop-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("local-store artifact change proposal loop", () => {
  it("loads stored findings and writes planner proposal output back to local-store", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const sourceFinding = researchFinding({
      id: "research-finding-market-trend-next-001",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T16:00:00.000Z"
    });
    const antiHackingFinding = researchFinding({
      id: "research-finding-market-lookahead-anti-hacking-001",
      findingKind: "anti_hacking_case",
      createdAt: "2026-05-11T16:00:01.000Z"
    });
    const priorLineage = artifactLineage(sourceFinding);
    await store.recordResearchFinding(sourceFinding);
    await store.recordResearchFinding(antiHackingFinding);
    await store.recordArtifactLineage(priorLineage);

    const outcome = await planArtifactChangeProposalFromLocalStore({
      store,
      task: fixtureTradingEvaluationTask(),
      idempotency_key: "local-store-loop",
      created_at: "2026-05-11T16:01:00.000Z"
    });

    expect(outcome.source_finding.research_finding_id).toBe(sourceFinding.research_finding_id);
    expect(outcome.anti_hacking_findings.map((finding) => finding.research_finding_id)).toEqual([
      antiHackingFinding.research_finding_id
    ]);
    await expect(store.listArtifactChangeProposals()).resolves.toEqual([outcome.proposal]);
    await expect(store.getRunnableArtifact(outcome.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual(outcome.runnable_artifact);
    await expect(store.listArtifactLineagesForArtifact(outcome.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual([outcome.lineage]);
    await expect(store.listResearchOrchestrationRuns()).resolves.toEqual([outcome.run]);
    expect(outcome.run.input_lineage_refs).toEqual([
      { record_kind: "artifact_lineage", id: priorLineage.artifact_lineage_id }
    ]);
    expect(JSON.stringify(outcome)).not.toMatch(
      /strategy_internals|strategy_schema|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("returns deterministic errors when proposal planning has no source finding", async () => {
    const emptyStore = new LocalStore(tmpDir);
    await emptyStore.initialize();
    await expect(
      planArtifactChangeProposalFromLocalStore({
        store: emptyStore,
        task: fixtureTradingEvaluationTask(),
        idempotency_key: "empty"
      })
    ).rejects.toThrow("no_research_findings");

    const antiOnlyDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-artifact-change-proposal-loop-"));
    const antiOnlyStore = new LocalStore(antiOnlyDir);
    try {
      await antiOnlyStore.initialize();
      await antiOnlyStore.recordResearchFinding(researchFinding({
        id: "research-finding-anti-only",
        findingKind: "anti_hacking_case",
        createdAt: "2026-05-11T16:02:00.000Z"
      }));
      await expect(
        planArtifactChangeProposalFromLocalStore({
          store: antiOnlyStore,
          task: fixtureTradingEvaluationTask(),
          idempotency_key: "anti-only"
        })
      ).rejects.toThrow("no_eligible_research_finding");
    } finally {
      await rm(antiOnlyDir, { recursive: true, force: true });
    }
  });

  it("records failed adapter output without proposal, artifact, or lineage writes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await store.recordResearchFinding(researchFinding({
      id: "research-finding-market-provider-failure-source",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T16:03:00.000Z"
    }));

    await expect(
      planArtifactChangeProposalFromLocalStore({
        store,
        task: fixtureTradingEvaluationTask(),
        provider_adapter: new FailingArtifactChangeProposalProviderAdapter(),
        idempotency_key: "local-store-loop-provider-failure",
        created_at: "2026-05-11T16:03:30.000Z"
      })
    ).rejects.toThrow("artifact_change_proposal_provider_failed");

    const attempts = await store.listArtifactChangeProposalMaterializationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      status: "failed",
      validation_status: "rejected",
      failure_reason: "artifact_change_proposal_provider_failed",
      authority_status: "proposal_input_only"
    });
    await expect(store.listArtifactChangeProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toEqual([]);
    await expect(store.listResearchOrchestrationRuns()).resolves.toEqual([]);
  });
});

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
    child_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-trend-v1"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-seed-v1"),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    created_by_research_worker_ref: sourceFinding.research_worker_ref,
    created_at: "2026-05-11T16:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-local-store-loop-001",
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
    created_at: "2026-05-11T16:00:00.000Z",
    authority_status: "not_live"
  };
}

class FailingArtifactChangeProposalProviderAdapter implements ArtifactChangeProposalProviderAdapter {
  async runArtifactChangeProposalGeneration(): Promise<ArtifactChangeProposalProviderResult> {
    return {
      status: "failed",
      provider: {
        provider_kind: "fixture_only",
        model: "failing-fixture-artifact-change-proposal-provider",
        invocation_surface: "failing fixture adapter"
      },
      failure_reason: "artifact_change_proposal_provider_failed",
      agent_run_ref: ref("agent_run", "agent-run-failing-fixture-research-provider"),
      agent_event_refs: [ref("agent_event", "agent-event-failing-fixture-research-provider")],
      trace_ref: ref("trace_placeholder", "trace-failing-fixture-research-provider"),
      provider_output_artifact_refs: [
        ref("artifact_change_proposal_provider_output_artifact", "failing-fixture-research-provider-output")
      ],
      debug_artifact_refs: [ref("debug_artifact", "failing-fixture-research-provider-debug")],
      idempotency_key: "failing-fixture-research-provider",
      authority_status: "proposal_input_only"
    };
  }
}
