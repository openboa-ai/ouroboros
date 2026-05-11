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
import {
  evaluateRuntimeArtifactForAar,
  type RuntimeArtifactAarEvaluationOutcome
} from "../src/aar-evaluation/runtime-artifact-submission";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-multi-aar-flow-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("multi-AAR BTC perp hill-climb flow", () => {
  it("shares findings into next artifact lineage while preserving anti-hacking quarantine", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const task = btcPerpEvaluationTask();
    const trendResearcherRef = ref("aar_researcher", "aar-researcher-trend-breakout-001");
    const trendDirectionRef = ref("aar_research_direction", "aar-direction-trend-breakout-001");
    const leakageResearcherRef = ref("aar_researcher", "aar-researcher-leakage-audit-001");
    const leakageDirectionRef = ref("aar_research_direction", "aar-direction-lookahead-audit-001");

    const accepted = evaluateRuntimeArtifactForAar({
      runtime_instance: sandboxRuntimeInstance({
        instanceId: "sandbox-runtime-instance-btc-trend-v1",
        runnableArtifactId: "aar-runnable-artifact-btc-trend-v1",
        suffix: "trend-v1"
      }),
      researcher_ref: trendResearcherRef,
      research_direction_ref: trendDirectionRef,
      task,
      experiment_id: "aar-experiment-btc-trend-v1",
      submitted_at: "2026-05-11T13:00:00.000Z",
      scenario: "accepted_oos_survives_costs"
    });
    const disqualified = evaluateRuntimeArtifactForAar({
      runtime_instance: sandboxRuntimeInstance({
        instanceId: "sandbox-runtime-instance-btc-lookahead-audit-v1",
        runnableArtifactId: "aar-runnable-artifact-btc-lookahead-leakage-v1",
        suffix: "lookahead-audit-v1"
      }),
      researcher_ref: leakageResearcherRef,
      research_direction_ref: leakageDirectionRef,
      task,
      experiment_id: "aar-experiment-btc-lookahead-audit-v1",
      submitted_at: "2026-05-11T13:05:00.000Z",
      scenario: "disqualified_lookahead_leakage"
    });

    expect(new Set([
      accepted.experiment.researcher_ref.id,
      disqualified.experiment.researcher_ref.id
    ])).toHaveProperty("size", 2);
    expect(new Set([
      accepted.experiment.research_direction_ref.id,
      disqualified.experiment.research_direction_ref.id
    ])).toHaveProperty("size", 2);
    expect(accepted.evaluation_result).toMatchObject({
      result_status: "accepted",
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
    expect(disqualified.evaluation_result).toMatchObject({
      result_status: "disqualified",
      disqualification_reason: "lookahead_leakage",
      evidence_disposition: "quarantined_for_review",
      authority_status: "not_counted"
    });

    const acceptedFinding = aarFinding({
      id: "aar-finding-btc-trend-v1-positive",
      outcome: accepted,
      findingKind: "positive_result",
      summary: "Trend breakout artifact survives held-out BTC perp cost model and can seed the next artifact."
    });
    const antiHackingFinding = aarFinding({
      id: "aar-finding-btc-lookahead-audit-v1",
      outcome: disqualified,
      findingKind: "anti_hacking_case",
      summary: "Lookahead leakage was caught by the sealed evaluator and remains quarantined."
    });
    await store.recordAarFinding(acceptedFinding);
    await store.recordAarFinding(antiHackingFinding);

    const lineage: AarArtifactLineageRecord = {
      record_kind: "aar_artifact_lineage",
      version: 1,
      aar_artifact_lineage_id: "aar-artifact-lineage-btc-trend-v2",
      child_runnable_artifact_ref: ref("runnable_artifact", "aar-runnable-artifact-btc-trend-v2"),
      parent_runnable_artifact_ref: accepted.experiment.runnable_artifact_ref,
      source_finding_refs: [ref("aar_finding", acceptedFinding.aar_finding_id)],
      created_by_researcher_ref: accepted.experiment.researcher_ref,
      created_at: "2026-05-11T13:10:00.000Z",
      authority_status: "lineage_only"
    };
    await store.recordAarArtifactLineage(lineage);

    const persistedFindings = await store.listAarFindings();
    const nextLineage = await store.listAarArtifactLineagesForArtifact("aar-runnable-artifact-btc-trend-v2");
    expect(persistedFindings).toEqual([
      acceptedFinding,
      antiHackingFinding
    ]);
    expect(nextLineage).toEqual([lineage]);
    expect(nextLineage[0]?.source_finding_refs).toEqual([
      { record_kind: "aar_finding", id: acceptedFinding.aar_finding_id }
    ]);
    expect(antiHackingFinding.supporting_record_refs).toEqual([
      ref("trading_evaluation_result", disqualified.evaluation_result.trading_evaluation_result_id),
      ...disqualified.evaluation_result.metric_refs
    ]);

    const recordSurface = JSON.stringify({
      accepted,
      disqualified,
      persistedFindings,
      nextLineage
    });
    expect(recordSurface).toContain("anti_hacking_case");
    expect(recordSurface).toContain("lookahead_leakage");
    expect(recordSurface).toContain("metric-aar-experiment-btc-lookahead-audit-v1-anti-hacking-leakage");
    expect(recordSurface).not.toMatch(
      /exchange_credentials|binance_api_key|live_order_authority|paper_order_authority|strategy_internals|strategy_schema/i
    );
  });
});

function aarFinding(input: {
  id: string;
  outcome: RuntimeArtifactAarEvaluationOutcome;
  findingKind: AarFindingRecord["finding_kind"];
  summary: string;
}): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: input.id,
    researcher_ref: input.outcome.experiment.researcher_ref,
    research_direction_ref: input.outcome.experiment.research_direction_ref,
    aar_experiment_ref: ref("aar_experiment", input.outcome.experiment.aar_experiment_id),
    trading_evaluation_result_ref: ref(
      "trading_evaluation_result",
      input.outcome.evaluation_result.trading_evaluation_result_id
    ),
    finding_kind: input.findingKind,
    summary: input.summary,
    supporting_record_refs: [
      ref("trading_evaluation_result", input.outcome.evaluation_result.trading_evaluation_result_id),
      ...input.outcome.evaluation_result.metric_refs
    ],
    created_at: input.outcome.evaluation_result.completed_at,
    authority_status: "research_trace_only"
  };
}

function sandboxRuntimeInstance(input: {
  instanceId: string;
  runnableArtifactId: string;
  suffix: string;
}): SandboxRuntimeInstanceRecord {
  return {
    record_kind: "sandbox_runtime_instance",
    version: 1,
    sandbox_runtime_instance_id: input.instanceId,
    adapter_kind: "docker_sandboxes_sbx",
    runnable_artifact_ref: ref("runnable_artifact", input.runnableArtifactId),
    runtime_ref: ref("trader_system_runtime", `runtime-${input.suffix}`),
    runtime_placement_ref: ref("runtime_placement", `runtime-placement-sdx-${input.suffix}`),
    lifecycle_status: "running",
    sandbox_name: `ouro-s6-${input.suffix}`,
    sandbox_ref: ref("docker_sandbox", `ouro-s6-${input.suffix}`),
    created_at: "2026-05-11T12:59:00.000Z",
    started_at: "2026-05-11T12:59:01.000Z",
    last_heartbeat_at: "2026-05-11T12:59:02.000Z",
    log_refs: [ref("runtime_instance_log", `runtime-log-${input.suffix}`)],
    heartbeat_refs: [ref("runtime_heartbeat", `runtime-heartbeat-${input.suffix}`)],
    command_evidence_refs: [ref("sandbox_command_evidence", `sandbox-command-evidence-${input.suffix}`)],
    trace_ref: ref("trace_placeholder", `trace-runtime-self-report-${input.suffix}`),
    authority_status: "not_live"
  };
}

function btcPerpEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-btc-perp-multi-aar-001",
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
    created_at: "2026-05-11T12:58:00.000Z",
    authority_status: "not_live"
  };
}
