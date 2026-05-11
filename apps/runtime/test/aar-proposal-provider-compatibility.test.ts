import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  AarFindingRecord,
  AarProposalProviderAttribution,
  AarProposalProviderOutput,
  AarProposalProviderRequest,
  AarProposalProviderResult,
  ProviderKind,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { FixtureAarProposalProviderAdapter } from "../src/aar-orchestration/fixture-aar-proposal-provider";
import { planAarProposalFromLocalStore } from "../src/aar-orchestration/local-store-proposal-loop";
import type { AarProposalProviderAdapter } from "../src/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDirs: string[] = [];

beforeEach(() => {
  tmpDirs = [];
});

afterEach(async () => {
  await Promise.all(tmpDirs.map((tmpDir) => rm(tmpDir, { recursive: true, force: true })));
});

describe("AAR proposal provider adapter compatibility", () => {
  it.each([
    {
      label: "fixture",
      providerKind: "fixture_only" as const,
      adapter: () => new FixtureAarProposalProviderAdapter()
    },
    {
      label: "codex-shaped",
      providerKind: "codex_cli" as const,
      adapter: () => new StaticCompatibleAarProposalProviderAdapter("codex_cli")
    },
    {
      label: "claude-compatible-test-double",
      providerKind: "claude_code" as const,
      adapter: () => new StaticCompatibleAarProposalProviderAdapter("claude_code")
    }
  ])("routes %s adapter output through the same local-store boundary", async (caseInput) => {
    const store = await initializedStore();
    const sourceFinding = aarFinding(
      `aar-finding-provider-neutral-${caseInput.label}-next`,
      "next_artifact_hint"
    );
    const antiHackingFinding = aarFinding(
      `aar-finding-provider-neutral-${caseInput.label}-anti`,
      "anti_hacking_case"
    );
    await store.recordAarFinding(sourceFinding);
    await store.recordAarFinding(antiHackingFinding);

    const outcome = await planAarProposalFromLocalStore({
      store,
      task: btcPerpEvaluationTask(caseInput.label),
      provider_adapter: caseInput.adapter(),
      idempotency_key: `provider-neutral-${caseInput.label}`,
      created_at: "2026-05-11T21:00:00.000Z"
    });

    expect(outcome.proposal.authority_status).toBe("proposal_only");
    expect(outcome.runnable_artifact.authority_status).toBe("not_live");
    expect(outcome.lineage.authority_status).toBe("lineage_only");
    expect(outcome.run.authority_status).toBe("research_only");
    expect(outcome.source_finding.aar_finding_id).toBe(sourceFinding.aar_finding_id);
    const attempts = await store.listAarProposalMaterializationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      provider: {
        provider_kind: caseInput.providerKind
      },
      status: "materialized",
      authority_status: "proposal_input_only"
    });
  });

  it("keeps the production/default path away from Claude-primary behavior", async () => {
    const store = await initializedStore();
    const sourceFinding = aarFinding("aar-finding-default-provider-next", "next_artifact_hint");
    await store.recordAarFinding(sourceFinding);

    await planAarProposalFromLocalStore({
      store,
      task: btcPerpEvaluationTask("default-provider"),
      idempotency_key: "default-provider-path",
      created_at: "2026-05-11T21:01:00.000Z"
    });

    const attempts = await store.listAarProposalMaterializationAttempts();
    expect(attempts[0].provider.provider_kind).toBe("fixture_only");
    expect(attempts[0].provider.provider_kind).not.toBe("claude_code");
  });
});

class StaticCompatibleAarProposalProviderAdapter implements AarProposalProviderAdapter {
  private readonly provider: AarProposalProviderAttribution;

  constructor(providerKind: Extract<ProviderKind, "codex_cli" | "claude_code">) {
    this.provider = {
      provider_kind: providerKind,
      model: `${providerKind}-compatible-test-double`,
      invocation_surface: `${providerKind} compatible test double`
    };
  }

  async runAarProposalGeneration(
    request: AarProposalProviderRequest
  ): Promise<AarProposalProviderResult> {
    return {
      status: "succeeded",
      provider: this.provider,
      output: providerOutput(request),
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [ref("agent_event", `agent-event-${request.idempotency_key}`)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [
        ref("aar_proposal_provider_output_artifact", `provider-output-${request.idempotency_key}`)
      ],
      debug_artifact_refs: [ref("debug_artifact", `debug-${request.idempotency_key}`)],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

function providerOutput(request: AarProposalProviderRequest): AarProposalProviderOutput {
  const sourceFinding = request.findings.find((finding) =>
    finding.finding_kind === "next_artifact_hint" ||
    finding.finding_kind === "positive_result"
  );
  if (!sourceFinding) {
    throw new Error("no_eligible_aar_finding");
  }
  return {
    output_kind: "aar_artifact_proposal_input",
    trading_evaluation_task_ref: ref(
      "trading_evaluation_task",
      request.task.trading_evaluation_task_id
    ),
    source_finding_refs: [ref("aar_finding", sourceFinding.aar_finding_id)],
    anti_hacking_finding_refs: request.findings
      .filter((finding) => finding.finding_kind === "anti_hacking_case")
      .map((finding) => ref("aar_finding", finding.aar_finding_id)),
    proposal_summary: "Compatible provider output for an opaque AAR artifact proposal.",
    requested_change_summary: "Use the same materialization boundary regardless of provider label.",
    expected_improvement_summary: "Provider-neutral routing with no durable provider truth.",
    proposed_artifact_refs: [ref("provider_artifact_hint", `hint-${request.idempotency_key}`)],
    output_authority_status: "proposal_input_only"
  };
}

async function initializedStore(): Promise<LocalStore> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-provider-compat-"));
  tmpDirs.push(tmpDir);
  const store = new LocalStore(tmpDir);
  await store.initialize();
  return store;
}

function aarFinding(
  findingId: string,
  findingKind: AarFindingRecord["finding_kind"]
): AarFindingRecord {
  return {
    record_kind: "aar_finding",
    version: 1,
    aar_finding_id: findingId,
    researcher_ref: ref("aar_researcher", "aar-researcher-provider-neutral-001"),
    research_direction_ref: ref("aar_research_direction", "aar-direction-provider-neutral-v1"),
    aar_experiment_ref: ref("aar_experiment", "aar-experiment-provider-neutral-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-provider-neutral-001"),
    finding_kind: findingKind,
    summary: `Provider-neutral ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T21:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function btcPerpEvaluationTask(label: string): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: `trading-evaluation-task-provider-neutral-${label}`,
    market_scope: "binance_btc_perpetual_futures",
    stage: "backtest",
    data_window_ref: ref("data_window", "btc-perp-fixture-window"),
    fee_model_ref: ref("fee_model", "binance-btc-perp-fixture-fees"),
    funding_model_ref: ref("funding_model", "btc-perp-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "btc-perp-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "btc-perp-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "btc-perp-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "btc-perp-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "btc-perp-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-btc-perp-fixture-evaluator-v1"),
    created_at: "2026-05-11T21:00:00.000Z",
    authority_status: "not_live"
  };
}
