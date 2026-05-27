import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ArtifactLineageRecord,
  ResearchFindingRecord,
  Ref,
  SandboxRecord,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import {
  evaluateSystemCodeForResearch,
  type SystemCodeResearchEvaluationOutcome
} from "@ouroboros/application/research-evaluation/system-code-research-submission";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-multi-research-flow-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("multi-automated research generic trading hill-climb flow", () => {
  it("shares findings into next artifact lineage while preserving anti-hacking quarantine", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const task = fixtureTradingEvaluationTask();
    const trendResearcherRef = ref("research_worker", "research-worker-trend-breakout-001");
    const trendDirectionRef = ref("research_direction", "research-direction-trend-breakout-001");
    const leakageResearcherRef = ref("research_worker", "research-worker-leakage-audit-001");
    const leakageDirectionRef = ref("research_direction", "research-direction-lookahead-audit-001");

    const accepted = evaluateSystemCodeForResearch({
      sandbox: sandboxSandbox({
        instanceId: "sandbox-market-trend-v1",
        systemCodeId: "research-system-code-market-trend-v1",
        suffix: "trend-v1"
      }),
      research_worker_ref: trendResearcherRef,
      research_direction_ref: trendDirectionRef,
      task,
      experiment_id: "experiment-run-market-trend-v1",
      submitted_at: "2026-05-11T13:00:00.000Z",
      scenario: "accepted_oos_survives_costs"
    });
    const disqualified = evaluateSystemCodeForResearch({
      sandbox: sandboxSandbox({
        instanceId: "sandbox-market-lookahead-audit-v1",
        systemCodeId: "research-system-code-market-lookahead-leakage-v1",
        suffix: "lookahead-audit-v1"
      }),
      research_worker_ref: leakageResearcherRef,
      research_direction_ref: leakageDirectionRef,
      task,
      experiment_id: "experiment-run-market-lookahead-audit-v1",
      submitted_at: "2026-05-11T13:05:00.000Z",
      scenario: "disqualified_lookahead_leakage"
    });

    expect(new Set([
      accepted.experiment.research_worker_ref.id,
      disqualified.experiment.research_worker_ref.id
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

    const acceptedFinding = researchFinding({
      id: "research-finding-market-trend-v1-positive",
      outcome: accepted,
      findingKind: "positive_result",
      summary: "Trend breakout artifact survives held-out generic trading cost model and can seed the next artifact."
    });
    const antiHackingFinding = researchFinding({
      id: "research-finding-market-lookahead-audit-v1",
      outcome: disqualified,
      findingKind: "anti_hacking_case",
      summary: "Lookahead leakage was caught by the sealed evaluator and remains quarantined."
    });
    await store.recordResearchFinding(acceptedFinding);
    await store.recordResearchFinding(antiHackingFinding);

    const lineage: ArtifactLineageRecord = {
      record_kind: "artifact_lineage",
      version: 1,
      artifact_lineage_id: "artifact-lineage-market-trend-v2",
      child_system_code_ref: ref("system_code", "research-system-code-market-trend-v2"),
      parent_system_code_ref: accepted.experiment.system_code_ref,
      source_finding_refs: [ref("research_finding", acceptedFinding.research_finding_id)],
      created_by_research_worker_ref: accepted.experiment.research_worker_ref,
      created_at: "2026-05-11T13:10:00.000Z",
      authority_status: "lineage_only"
    };
    await store.recordArtifactLineage(lineage);

    const persistedFindings = await store.listResearchFindings();
    const nextLineage = await store.listArtifactLineagesForArtifact("research-system-code-market-trend-v2");
    expect(persistedFindings).toEqual([
      acceptedFinding,
      antiHackingFinding
    ]);
    expect(nextLineage).toEqual([lineage]);
    expect(nextLineage[0]?.source_finding_refs).toEqual([
      { record_kind: "research_finding", id: acceptedFinding.research_finding_id }
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
    expect(recordSurface).toContain("metric-experiment-run-market-lookahead-audit-v1-anti-hacking-leakage");
    expect(recordSurface).not.toMatch(
      /exchange_credentials|venue_api_key|live_order_authority|paper_order_authority|strategy_internals|strategy_schema/i
    );
  });
});

function researchFinding(input: {
  id: string;
  outcome: SystemCodeResearchEvaluationOutcome;
  findingKind: ResearchFindingRecord["finding_kind"];
  summary: string;
}): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: input.id,
    research_worker_ref: input.outcome.experiment.research_worker_ref,
    research_direction_ref: input.outcome.experiment.research_direction_ref,
    experiment_run_ref: ref("experiment_run", input.outcome.experiment.experiment_run_id),
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

function sandboxSandbox(input: {
  instanceId: string;
  systemCodeId: string;
  suffix: string;
}): SandboxRecord {
  return {
    record_kind: "sandbox",
    version: 1,
    sandbox_id: input.instanceId,
    adapter_kind: "docker_sandboxes_sbx",
    system_code_ref: ref("system_code", input.systemCodeId),
    runtime_ref: ref("trading_run", `runtime-${input.suffix}`),
    sandbox_placement_ref: ref("sandbox_placement", `sandbox-placement-sdx-${input.suffix}`),
    lifecycle_status: "running",
    sandbox_name: `ouro-s6-${input.suffix}`,
    sandbox_ref: ref("docker_sandbox", `ouro-s6-${input.suffix}`),
    created_at: "2026-05-11T12:59:00.000Z",
    started_at: "2026-05-11T12:59:01.000Z",
    last_heartbeat_at: "2026-05-11T12:59:02.000Z",
    log_refs: [ref("sandbox_log", `runtime-log-${input.suffix}`)],
    heartbeat_refs: [ref("runtime_heartbeat", `runtime-heartbeat-${input.suffix}`)],
    command_evidence_refs: [ref("sandbox_command_evidence", `sandbox-command-evidence-${input.suffix}`)],
    trace_ref: ref("trace_placeholder", `trace-runtime-self-report-${input.suffix}`),
    authority_status: "not_live"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-multi-research-001",
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
    created_at: "2026-05-11T12:58:00.000Z",
    authority_status: "not_live"
  };
}
