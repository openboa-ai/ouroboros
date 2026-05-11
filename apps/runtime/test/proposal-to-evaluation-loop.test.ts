import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AarArtifactLineageRecord,
  AarFindingRecord,
  Ref,
  SandboxRuntimeInstanceRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { planAarProposalFromLocalStore } from "../src/aar-orchestration/local-store-proposal-loop";
import { evaluateRuntimeArtifactForAar } from "../src/aar-evaluation/runtime-artifact-submission";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-proposal-evaluation-loop-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("AAR proposal to sealed evaluation loop", () => {
  it("proves finding to proposal to opaque artifact to sealed evaluator result without venue authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const task = btcPerpEvaluationTask();
    const sourceFinding = aarFinding({
      id: "aar-finding-btc-trend-next-001",
      findingKind: "next_artifact_hint",
      createdAt: "2026-05-11T17:00:00.000Z"
    });
    const antiHackingFinding = aarFinding({
      id: "aar-finding-btc-lookahead-quarantine-001",
      findingKind: "anti_hacking_case",
      createdAt: "2026-05-11T17:00:01.000Z"
    });
    const priorLineage = artifactLineage(sourceFinding);
    await store.recordAarFinding(sourceFinding);
    await store.recordAarFinding(antiHackingFinding);
    await store.recordAarArtifactLineage(priorLineage);

    const proposalOutcome = await planAarProposalFromLocalStore({
      store,
      task,
      idempotency_key: "proposal-to-evaluation-loop",
      created_at: "2026-05-11T17:01:00.000Z"
    });
    const runtimeInstance = sandboxRuntimeInstance({
      runnableArtifactRef: proposalOutcome.runnable_artifact,
      instanceId: "sandbox-runtime-instance-proposed-artifact-001"
    });
    const evaluationOutcome = evaluateRuntimeArtifactForAar({
      runtime_instance: runtimeInstance,
      researcher_ref: proposalOutcome.proposal.researcher_ref,
      research_direction_ref: proposalOutcome.proposal.research_direction_ref,
      task,
      experiment_id: "aar-experiment-proposed-artifact-001",
      submitted_at: "2026-05-11T17:02:00.000Z"
    });

    expect(proposalOutcome.run).toMatchObject({
      status: "proposed",
      authority_status: "research_only",
      output_artifact_proposal_ref: {
        record_kind: "aar_artifact_proposal",
        id: proposalOutcome.proposal.aar_artifact_proposal_id
      },
      output_runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: proposalOutcome.runnable_artifact.runnable_artifact_id
      }
    });
    await expect(store.listAarArtifactProposals()).resolves.toEqual([proposalOutcome.proposal]);
    await expect(store.getRunnableArtifact(proposalOutcome.runnable_artifact.runnable_artifact_id))
      .resolves.toEqual(proposalOutcome.runnable_artifact);
    await expect(store.listAarOrchestrationRuns()).resolves.toEqual([proposalOutcome.run]);
    expect(proposalOutcome.proposal.anti_hacking_finding_refs).toEqual([
      { record_kind: "aar_finding", id: antiHackingFinding.aar_finding_id }
    ]);

    expect(evaluationOutcome.experiment).toMatchObject({
      runnable_artifact_ref: {
        record_kind: "runnable_artifact",
        id: proposalOutcome.runnable_artifact.runnable_artifact_id
      },
      sandbox_runtime_instance_ref: {
        record_kind: "sandbox_runtime_instance",
        id: runtimeInstance.sandbox_runtime_instance_id
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
        id: "sealed-btc-perp-fixture-evaluator-v1"
      }
    });
    expect(evaluationOutcome.evaluation_result.evaluator_trace_ref).not.toEqual(
      evaluationOutcome.experiment.trace_ref
    );

    const recordSurface = JSON.stringify({
      proposalOutcome,
      evaluationOutcome
    });
    expect(recordSurface).toContain("anti_hacking_finding_refs");
    expect(recordSurface).toContain("trace-sealed-btc-perp-aar-experiment-proposed-artifact-001");
    expect(recordSurface).not.toMatch(
      /strategy_internals|strategy_schema|binance_credentials|binance_api_key|kis_adapter|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
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
    created_at: "2026-05-11T17:00:30.000Z",
    authority_status: "lineage_only"
  };
}

function sandboxRuntimeInstance(input: {
  runnableArtifactRef: { runnable_artifact_id: string };
  instanceId: string;
}): SandboxRuntimeInstanceRecord {
  return {
    record_kind: "sandbox_runtime_instance",
    version: 1,
    sandbox_runtime_instance_id: input.instanceId,
    adapter_kind: "docker_sandboxes_sbx",
    runnable_artifact_ref: ref("runnable_artifact", input.runnableArtifactRef.runnable_artifact_id),
    runtime_ref: ref("trader_system_runtime", "runtime-proposed-artifact-001"),
    runtime_placement_ref: ref("runtime_placement", "runtime-placement-sdx-proposed-artifact-001"),
    lifecycle_status: "running",
    sandbox_name: "ouro-s7-proposed-artifact-001",
    sandbox_ref: ref("docker_sandbox", "ouro-s7-proposed-artifact-001"),
    created_at: "2026-05-11T17:01:30.000Z",
    started_at: "2026-05-11T17:01:31.000Z",
    last_heartbeat_at: "2026-05-11T17:01:32.000Z",
    log_refs: [ref("runtime_instance_log", "runtime-log-proposed-artifact-001")],
    heartbeat_refs: [ref("runtime_heartbeat", "runtime-heartbeat-proposed-artifact-001")],
    command_evidence_refs: [ref("sandbox_command_evidence", "sandbox-command-proposed-artifact-001")],
    trace_ref: ref("trace_placeholder", "trace-runtime-self-report-proposed-artifact-001"),
    authority_status: "not_live"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-proposal-evaluation-001",
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
    created_at: "2026-05-11T17:00:00.000Z",
    authority_status: "not_live"
  };
}
