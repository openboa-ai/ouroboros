import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ResearchFindingRecord,
  ImprovementProposalProviderAttribution,
  ImprovementProposalProviderOutput,
  ImprovementProposalProviderRequest,
  ImprovementProposalProviderResult,
  ProviderKind,
  Ref,
  TradingEvaluationTaskRecord
} from "@ouroboros/domain";
import { LocalStore } from "@ouroboros/local-store";
import { FixtureImprovementProposalProviderAdapter } from "@ouroboros/application/research-orchestration/fixture-improvement-proposal-provider";
import { planImprovementProposalFromLocalStore } from "@ouroboros/application/research-orchestration/local-store-proposal-loop";
import type { ImprovementProposalProviderAdapter } from "@ouroboros/adapters/providers/runtime-provider-adapter";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

let tmpDirs: string[] = [];

beforeEach(() => {
  tmpDirs = [];
});

afterEach(async () => {
  await Promise.all(tmpDirs.map((tmpDir) => rm(tmpDir, { recursive: true, force: true })));
});

describe("improvement proposal provider adapter compatibility", () => {
  it.each([
    {
      label: "fixture",
      providerKind: "fixture_only" as const,
      adapter: () => new FixtureImprovementProposalProviderAdapter()
    },
    {
      label: "codex-shaped",
      providerKind: "codex_cli" as const,
      adapter: () => new StaticCompatibleImprovementProposalProviderAdapter("codex_cli")
    },
    {
      label: "claude-compatible-test-double",
      providerKind: "claude_code" as const,
      adapter: () => new StaticCompatibleImprovementProposalProviderAdapter("claude_code")
    }
  ])("routes %s adapter output through the same local-store boundary", async (caseInput) => {
    const store = await initializedStore();
    const sourceFinding = researchFinding(
      `research-finding-provider-neutral-${caseInput.label}-next`,
      "next_artifact_hint"
    );
    const antiHackingFinding = researchFinding(
      `research-finding-provider-neutral-${caseInput.label}-anti`,
      "anti_hacking_case"
    );
    await store.recordResearchFinding(sourceFinding);
    await store.recordResearchFinding(antiHackingFinding);

    const outcome = await planImprovementProposalFromLocalStore({
      store,
      task: fixtureTradingEvaluationTask(caseInput.label),
      provider_adapter: caseInput.adapter(),
      idempotency_key: `provider-neutral-${caseInput.label}`,
      created_at: "2026-05-11T21:00:00.000Z"
    });

    expect(outcome.proposal.authority_status).toBe("proposal_only");
    expect(outcome.system_code.authority_status).toBe("not_live");
    expect(outcome.lineage.authority_status).toBe("lineage_only");
    expect(outcome.run.authority_status).toBe("research_only");
    expect(outcome.source_finding.research_finding_id).toBe(sourceFinding.research_finding_id);
    const attempts = await store.listImprovementProposalMaterializationAttempts();
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
    const sourceFinding = researchFinding("research-finding-default-provider-next", "next_artifact_hint");
    await store.recordResearchFinding(sourceFinding);

    await planImprovementProposalFromLocalStore({
      store,
      task: fixtureTradingEvaluationTask("default-provider"),
      idempotency_key: "default-provider-path",
      created_at: "2026-05-11T21:01:00.000Z"
    });

    const attempts = await store.listImprovementProposalMaterializationAttempts();
    expect(attempts[0].provider.provider_kind).toBe("fixture_only");
    expect(attempts[0].provider.provider_kind).not.toBe("claude_code");
  });
});

class StaticCompatibleImprovementProposalProviderAdapter implements ImprovementProposalProviderAdapter {
  private readonly provider: ImprovementProposalProviderAttribution;

  constructor(providerKind: Extract<ProviderKind, "codex_cli" | "claude_code">) {
    this.provider = {
      provider_kind: providerKind,
      model: `${providerKind}-compatible-test-double`,
      invocation_surface: `${providerKind} compatible test double`
    };
  }

  async runImprovementProposalGeneration(
    request: ImprovementProposalProviderRequest
  ): Promise<ImprovementProposalProviderResult> {
    return {
      status: "succeeded",
      provider: this.provider,
      output: providerOutput(request),
      agent_run_ref: request.agent_run_ref,
      agent_event_refs: [ref("agent_event", `agent-event-${request.idempotency_key}`)],
      trace_ref: request.trace_ref,
      provider_output_artifact_refs: [
        ref("improvement_proposal_provider_output_artifact", `provider-output-${request.idempotency_key}`)
      ],
      debug_artifact_refs: [ref("debug_artifact", `debug-${request.idempotency_key}`)],
      idempotency_key: request.idempotency_key,
      authority_status: "proposal_input_only"
    };
  }
}

function providerOutput(request: ImprovementProposalProviderRequest): ImprovementProposalProviderOutput {
  const sourceFinding = request.findings.find((finding) =>
    finding.finding_kind === "next_artifact_hint" ||
    finding.finding_kind === "positive_result"
  );
  if (!sourceFinding) {
    throw new Error("no_eligible_research_finding");
  }
  return {
    output_kind: "improvement_proposal_input",
    trading_evaluation_task_ref: ref(
      "trading_evaluation_task",
      request.task.trading_evaluation_task_id
    ),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    anti_hacking_finding_refs: request.findings
      .filter((finding) => finding.finding_kind === "anti_hacking_case")
      .map((finding) => ref("research_finding", finding.research_finding_id)),
    proposal_summary: "Compatible provider output for an opaque improvement proposal.",
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

function researchFinding(
  findingId: string,
  findingKind: ResearchFindingRecord["finding_kind"]
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-provider-neutral-001"),
    research_direction_ref: ref("research_direction", "research-direction-provider-neutral-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-provider-neutral-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-provider-neutral-001"),
    finding_kind: findingKind,
    summary: `Provider-neutral ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T21:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function fixtureTradingEvaluationTask(label: string): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: `trading-evaluation-task-provider-neutral-${label}`,
    market_scope: "external_trading_api_fixture",
    stage: "backtest",
    data_window_ref: ref("data_window", "sealed-replay-fixture-window"),
    fee_model_ref: ref("fee_model", "external-api-replay-fixture-fees"),
    funding_model_ref: ref("funding_model", "sealed-replay-fixture-funding"),
    slippage_model_ref: ref("slippage_model", "sealed-replay-fixture-slippage"),
    leverage_limit_ref: ref("leverage_limit", "sealed-replay-fixture-leverage"),
    liquidation_model_ref: ref("liquidation_model", "sealed-replay-fixture-liquidation"),
    heldout_policy_ref: ref("heldout_policy", "sealed-replay-fixture-heldout"),
    evaluation_policy_ref: ref("evaluation_policy", "sealed-replay-fixture-anti-hacking-policy"),
    evaluator_ref: ref("external_evaluator", "sealed-replay-fixture-evaluator-v1"),
    created_at: "2026-05-11T21:00:00.000Z",
    authority_status: "not_live"
  };
}
