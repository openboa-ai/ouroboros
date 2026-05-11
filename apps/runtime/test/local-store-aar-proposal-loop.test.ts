import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarFindingRecord,
  AarProposalProviderResult,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { planAarProposalFromLocalStore } from "../src/aar-orchestration/local-store-proposal-loop";
import type { AarProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-aar-proposal-loop-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("local-store AAR proposal loop", () => {
  it("loads stored findings and writes planner proposal output back to local-store", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const sourceFinding = aarFinding({
      id: "aar-finding-btc-trend-next-001",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T16:00:00.000Z"
    });
    const antiHackingFinding = aarFinding({
      id: "aar-finding-btc-lookahead-anti-hacking-001",
      findingKind: "anti_hacking_case",
      createdAt: "2026-05-11T16:00:01.000Z"
    });
    const priorLineage = artifactLineage(sourceFinding);
    await store.recordAarFinding(sourceFinding);
    await store.recordAarFinding(antiHackingFinding);
    await store.recordAarArtifactLineage(priorLineage);

    const outcome = await planAarProposalFromLocalStore({
      store,
      task: btcPerpEvaluationTask(),
      idempotency_key: "local-store-loop",
      created_at: "2026-05-11T16:01:00.000Z"
    });

    expect(outcome.source_finding.aar_finding_id).toBe(sourceFinding.aar_finding_id);
    expect(outcome.anti_hacking_findings.map((finding) => finding.aar_finding_id)).toEqual([
      antiHackingFinding.aar_finding_id
    ]);
    await expect(store.listAarArtifactProposals()).resolves.toEqual([outcome.proposal]);
    await expect(store.getRunnableArtifact(outcome.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual(outcome.runnable_artifact);
    await expect(store.listAarArtifactLineagesForArtifact(outcome.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual([outcome.lineage]);
    await expect(store.listAarOrchestrationRuns()).resolves.toEqual([outcome.run]);
    expect(outcome.run.input_lineage_refs).toEqual([
      { record_kind: "aar_artifact_lineage", id: priorLineage.aar_artifact_lineage_id }
    ]);
    expect(JSON.stringify(outcome)).not.toMatch(
      /strategy_internals|strategy_schema|binance_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("returns deterministic errors when proposal planning has no source finding", async () => {
    const emptyStore = new LocalStore(tmpDir);
    await emptyStore.initialize();
    await expect(
      planAarProposalFromLocalStore({
        store: emptyStore,
        task: btcPerpEvaluationTask(),
        idempotency_key: "empty"
      })
    ).rejects.toThrow("no_aar_findings");

    const antiOnlyDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-aar-proposal-loop-"));
    const antiOnlyStore = new LocalStore(antiOnlyDir);
    try {
      await antiOnlyStore.initialize();
      await antiOnlyStore.recordAarFinding(aarFinding({
        id: "aar-finding-anti-only",
        findingKind: "anti_hacking_case",
        createdAt: "2026-05-11T16:02:00.000Z"
      }));
      await expect(
        planAarProposalFromLocalStore({
          store: antiOnlyStore,
          task: btcPerpEvaluationTask(),
          idempotency_key: "anti-only"
        })
      ).rejects.toThrow("no_eligible_aar_finding");
    } finally {
      await rm(antiOnlyDir, { recursive: true, force: true });
    }
  });

  it("records failed adapter output without proposal, artifact, or lineage writes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await store.recordAarFinding(aarFinding({
      id: "aar-finding-btc-provider-failure-source",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T16:03:00.000Z"
    }));

    await expect(
      planAarProposalFromLocalStore({
        store,
        task: btcPerpEvaluationTask(),
        provider_adapter: new FailingAarProposalProviderAdapter(),
        idempotency_key: "local-store-loop-provider-failure",
        created_at: "2026-05-11T16:03:30.000Z"
      })
    ).rejects.toThrow("aar_proposal_provider_failed");

    const attempts = await store.listAarProposalMaterializationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      status: "failed",
      validation_status: "rejected",
      failure_reason: "aar_proposal_provider_failed",
      authority_status: "proposal_input_only"
    });
    await expect(store.listAarArtifactProposals()).resolves.toEqual([]);
    await expect(store.listAarArtifactLineages()).resolves.toEqual([]);
    await expect(store.listAarOrchestrationRuns()).resolves.toEqual([]);
  });
});

function aarFinding(input: {
  id: string;
  findingKind: AarFindingRecord["finding_kind"];
  createdAt: string;
}): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: input.id,
    researcher_ref: ref("aar_researcher", "aar-researcher-btc-trend-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-btc-trend-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-btc-trend-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-btc-trend-001"),
    finding_kind: input.findingKind,
    summary: `Fixture ${input.findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${input.id}-metric`)],
    created_at: input.createdAt,
    authority_status: "research_trace_only"
  };
}

function artifactLineage(sourceFinding: AarFindingRecord): AarArtifactLineageRecord {
  return {
    record_kind: "aar_artifact_lineage",
    version: 1,
    aar_artifact_lineage_id: "aar-artifact-lineage-btc-trend-v1",
    child_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-v1"),
    parent_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-seed-v1"),
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    created_by_researcher_ref: sourceFinding.researcher_ref,
    created_at: "2026-05-11T16:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-local-store-loop-001",
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
    created_at: "2026-05-11T16:00:00.000Z",
    authority_status: "not_live"
  };
}

class FailingAarProposalProviderAdapter implements AarProposalProviderAdapter {
  async runAarProposalGeneration(): Promise<AarProposalProviderResult> {
    return {
      status: "failed",
      provider: {
        provider_kind: "fixture_only",
        model: "failing-fixture-aar-proposal-provider",
        invocation_surface: "failing fixture adapter"
      },
      failure_reason: "aar_proposal_provider_failed",
      agent_run_ref: ref("agent_run", "agent-run-failing-fixture-aar-provider"),
      agent_event_refs: [ref("agent_event", "agent-event-failing-fixture-aar-provider")],
      trace_ref: ref("trace_placeholder", "trace-failing-fixture-aar-provider"),
      provider_output_artifact_refs: [
        ref("aar_proposal_provider_output_artifact", "failing-fixture-aar-provider-output")
      ],
      debug_artifact_refs: [ref("debug_artifact", "failing-fixture-aar-provider-debug")],
      idempotency_key: "failing-fixture-aar-provider",
      authority_status: "proposal_input_only"
    };
  }
}
