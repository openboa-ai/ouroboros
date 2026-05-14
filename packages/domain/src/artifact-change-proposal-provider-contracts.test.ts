import { describe, expect, it } from "vitest";
import type {
  ResearchFindingRecord,
  ArtifactChangeProposalMaterializationAttemptRecord,
  ArtifactChangeProposalMaterializationInput,
  ArtifactChangeProposalProviderAttribution,
  ArtifactChangeProposalProviderOutput,
  ArtifactChangeProposalProviderProbeResult,
  ArtifactChangeProposalProviderRequest,
  ArtifactChangeProposalProviderResult,
  AgentEventRecord,
  AgentRunRecord,
  AgentSpecRecord,
  Ref,
  TracePlaceholderRecord,
  TradingEvaluationTaskRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("artifact change proposal provider contracts", () => {
  it("models Codex-first provider proposal output as proposal input trace material", () => {
    const provider = codexProvider();
    const sourceFinding = researchFinding("research-finding-market-trend-next-provider-001", "next_artifact_hint");
    const antiHackingFinding = researchFinding("research-finding-market-lookahead-provider-001", "anti_hacking_case");
    const agentRun = agentRunRecord(provider);
    const event = agentEventRecord(agentRun);
    const trace = tracePlaceholder();
    const probe = probeResult(provider);
    const request = providerRequest({
      provider,
      sourceFinding,
      antiHackingFinding,
      agentRun,
      trace
    });
    const result = successResult({
      provider,
      sourceFinding,
      antiHackingFinding,
      event,
      agentRun,
      trace
    });

    expect(agentRun.purpose).toBe("artifact_change_proposal_generation");
    expect(probe).toMatchObject({
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      readiness_status: "active_verified",
      supported_purposes: ["artifact_change_proposal_generation"]
    });
    expect(request).toMatchObject({
      idempotency_key: "artifact-change-proposal-provider-contract-001",
      agent_run_ref: ref("agent_run", agentRun.agent_run_id),
      trace_ref: ref("trace_placeholder", trace.trace_id)
    });
    expect(result).toMatchObject({
      status: "succeeded",
      provider,
      output: {
        output_kind: "artifact_change_proposal_input",
        trading_evaluation_task_ref: ref(
          "trading_evaluation_task",
          "trading-evaluation-task-sealed-replay-provider-contract-001"
        ),
        source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
        anti_hacking_finding_refs: [ref("research_finding", antiHackingFinding.research_finding_id)],
        output_authority_status: "proposal_input_only"
      },
      agent_run_ref: ref("agent_run", agentRun.agent_run_id),
      agent_event_refs: [ref("agent_event", event.agent_event_id)],
      trace_ref: ref("trace_placeholder", trace.trace_id),
      authority_status: "proposal_input_only"
    });
    expect(JSON.stringify(result)).not.toMatch(
      /artifact_change_proposal_id|strategy_internals|strategy_schema|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/i
    );
  });

  it("keeps Claude compatible at the attribution boundary without making it primary", () => {
    const codex = codexProvider();
    const claude = {
      provider_kind: "claude_code",
      model: "claude-compatible-boundary",
      invocation_surface: "claude code adapter boundary"
    } satisfies ArtifactChangeProposalProviderAttribution;

    expect([codex.provider_kind, claude.provider_kind]).toEqual(["codex_cli", "claude_code"]);
  });

  it("models provider failures without producing proposal truth", () => {
    const provider = codexProvider();
    const agentRun = agentRunRecord(provider, "failed");
    const event = agentEventRecord(agentRun);
    const trace = tracePlaceholder();

    const result = {
      status: "failed",
      provider,
      failure_reason: "artifact_change_proposal_provider_failed",
      agent_run_ref: ref("agent_run", agentRun.agent_run_id),
      agent_event_refs: [ref("agent_event", event.agent_event_id)],
      trace_ref: ref("trace_placeholder", trace.trace_id),
      provider_output_artifact_refs: [
        ref("artifact_change_proposal_provider_output_artifact", "failed-provider-output")
      ],
      debug_artifact_refs: [ref("debug_artifact", "failed-provider-debug")],
      idempotency_key: "artifact-change-proposal-provider-contract-failed",
      authority_status: "proposal_input_only"
    } satisfies ArtifactChangeProposalProviderResult;

    expect(result).toMatchObject({
      status: "failed",
      failure_reason: "artifact_change_proposal_provider_failed",
      authority_status: "proposal_input_only"
    });
    expect(result).not.toHaveProperty("output");
  });

  it("models the materialization boundary as the owner of durable proposal records", () => {
    const provider = codexProvider();
    const sourceFinding = researchFinding("research-finding-boundary-next-001", "next_artifact_hint");
    const antiHackingFinding = researchFinding("research-finding-boundary-anti-001", "anti_hacking_case");
    const agentRun = agentRunRecord(provider);
    const event = agentEventRecord(agentRun);
    const trace = tracePlaceholder();
    const providerResult = successResult({
      provider,
      sourceFinding,
      antiHackingFinding,
      event,
      agentRun,
      trace
    });
    if (providerResult.status !== "succeeded") {
      throw new Error("expected provider success");
    }

    const idempotencyKey = ["research", "proposal", "materialization", "boundary", "001"].join("-");
    const input = {
      idempotency_key: idempotencyKey,
      provider_result: providerResult,
      artifact_path: "fixtures/trading-systems/clock.py",
      artifact_runtime_contract_ref: ref(
        "artifact_runtime_contract",
        "artifact-runtime-contract-python-clock-v1"
      ),
      secret_policy_ref: ref("secret_policy", "no-raw-secrets"),
      capability_policy_ref: ref("capability_policy", "provider-artifact-change-proposal"),
      created_at: "2026-05-11T17:01:00.000Z"
    } satisfies ArtifactChangeProposalMaterializationInput;
    const attempt = {
      record_kind: "artifact_change_proposal_materialization_attempt",
      version: 1,
      artifact_change_proposal_materialization_attempt_id: "artifact-change-proposal-materialization-attempt-001",
      idempotency_key: input.idempotency_key,
      provider,
      agent_run_ref: providerResult.agent_run_ref,
      agent_event_refs: providerResult.agent_event_refs,
      trace_ref: providerResult.trace_ref,
      provider_output_artifact_refs: providerResult.provider_output_artifact_refs,
      debug_artifact_refs: providerResult.debug_artifact_refs,
      status: "materialized",
      validation_status: "accepted",
      output_artifact_proposal_ref: ref("artifact_change_proposal", "owned-proposal"),
      output_runnable_artifact_ref: ref("runnable_artifact", "owned-artifact"),
      output_lineage_ref: ref("artifact_lineage", "owned-lineage"),
      created_at: input.created_at,
      authority_status: "proposal_input_only"
    } satisfies ArtifactChangeProposalMaterializationAttemptRecord;

    expect(input.provider_result.output).not.toHaveProperty("artifact_change_proposal_id");
    expect(attempt).toMatchObject({
      provider,
      agent_run_ref: providerResult.agent_run_ref,
      trace_ref: providerResult.trace_ref,
      status: "materialized",
      validation_status: "accepted",
      authority_status: "proposal_input_only"
    });
  });
});

function codexProvider(): ArtifactChangeProposalProviderAttribution {
  return {
    provider_kind: "codex_cli",
    model: "gpt-5.4",
    invocation_surface: "codex exec --json --output-schema"
  };
}

function probeResult(provider: ArtifactChangeProposalProviderAttribution): ArtifactChangeProposalProviderProbeResult {
  return {
    ...provider,
    readiness_status: "active_verified",
    supported_purposes: ["artifact_change_proposal_generation"],
    provider_readiness_ref: ref("provider_readiness_record", "provider-readiness-artifact-change-proposal-001"),
    provider_probe_attempt_ref: ref("provider_probe_attempt", "provider-probe-artifact-change-proposal-001")
  };
}

function providerRequest(input: {
  provider: ArtifactChangeProposalProviderAttribution;
  sourceFinding: ResearchFindingRecord;
  antiHackingFinding: ResearchFindingRecord;
  agentRun: AgentRunRecord;
  trace: TracePlaceholderRecord;
}): ArtifactChangeProposalProviderRequest {
  return {
    idempotency_key: "artifact-change-proposal-provider-contract-001",
    task: fixtureTradingEvaluationTask(),
    findings: [input.sourceFinding, input.antiHackingFinding],
    existing_lineage_refs: [ref("artifact_lineage", "artifact-lineage-market-provider-contract-v1")],
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-provider-v1"),
    input_artifact_refs: [ref("research_finding", input.sourceFinding.research_finding_id)],
    requested_output_contract_ref: ref("artifact_runtime_contract", "artifact-runtime-contract-python-clock-v1"),
    agent_run_ref: ref("agent_run", input.agentRun.agent_run_id),
    trace_ref: ref("trace_placeholder", input.trace.trace_id)
  };
}

function successResult(input: {
  provider: ArtifactChangeProposalProviderAttribution;
  sourceFinding: ResearchFindingRecord;
  antiHackingFinding: ResearchFindingRecord;
  event: AgentEventRecord;
  agentRun: AgentRunRecord;
  trace: TracePlaceholderRecord;
}): ArtifactChangeProposalProviderResult {
  return {
    status: "succeeded",
    provider: input.provider,
    output: providerOutput(input.sourceFinding, input.antiHackingFinding),
    agent_run_ref: ref("agent_run", input.agentRun.agent_run_id),
    agent_event_refs: [ref("agent_event", input.event.agent_event_id)],
    trace_ref: ref("trace_placeholder", input.trace.trace_id),
    provider_output_artifact_refs: [
      ref("artifact_change_proposal_provider_output_artifact", "provider-output-artifact-change-proposal-001")
    ],
    debug_artifact_refs: [ref("debug_artifact", "provider-debug-artifact-change-proposal-001")],
    idempotency_key: "artifact-change-proposal-provider-contract-001",
    authority_status: "proposal_input_only"
  };
}

function providerOutput(
  sourceFinding: ResearchFindingRecord,
  antiHackingFinding: ResearchFindingRecord
): ArtifactChangeProposalProviderOutput {
  return {
    output_kind: "artifact_change_proposal_input",
    trading_evaluation_task_ref: ref(
      "trading_evaluation_task",
      "trading-evaluation-task-sealed-replay-provider-contract-001"
    ),
    source_finding_refs: [ref("research_finding", sourceFinding.research_finding_id)],
    anti_hacking_finding_refs: [ref("research_finding", antiHackingFinding.research_finding_id)],
    parent_runnable_artifact_ref: ref("runnable_artifact", "research-runnable-artifact-market-provider-v1"),
    proposal_summary: "Provider-authored proposal input for the next opaque generic trading artifact.",
    requested_change_summary: "Improve held-out drawdown robustness without exposing strategy internals.",
    expected_improvement_summary: "Better sealed evaluator stability after materialization and evaluation.",
    proposed_artifact_refs: [
      ref("provider_artifact_hint", "opaque-python-artifact-provider-output-001")
    ],
    output_authority_status: "proposal_input_only"
  };
}

function agentRunRecord(
  provider: ArtifactChangeProposalProviderAttribution,
  status: AgentRunRecord["status"] = "succeeded"
): AgentRunRecord {
  return {
    record_kind: "agent_run",
    version: 1,
    agent_run_id: "agent-run-artifact-change-proposal-provider-contract-001",
    agent_session_ref: ref("agent_session", "agent-session-artifact-change-proposal-provider-contract-001"),
    purpose: "artifact_change_proposal_generation",
    status,
    provider_kind: provider.provider_kind,
    model: provider.model,
    trace_ref: ref("trace_placeholder", "trace-artifact-change-proposal-provider-contract-001"),
    authority_status: "trace_only"
  };
}

function agentEventRecord(agentRun: AgentRunRecord): AgentEventRecord {
  return {
    record_kind: "agent_event",
    version: 1,
    agent_event_id: "agent-event-artifact-change-proposal-provider-contract-001",
    agent_run_ref: ref("agent_run", agentRun.agent_run_id),
    status: "provider_output_captured"
  };
}

function tracePlaceholder(): TracePlaceholderRecord {
  return {
    record_kind: "trace_placeholder",
    version: 1,
    trace_id: "trace-artifact-change-proposal-provider-contract-001",
    input_artifact_refs: [ref("research_finding", "research-finding-market-trend-next-provider-001")],
    provider_output_artifact_refs: [
      ref("artifact_change_proposal_provider_output_artifact", "provider-output-artifact-change-proposal-001")
    ],
    debug_artifact_refs: [ref("debug_artifact", "provider-debug-artifact-change-proposal-001")],
    authority_label: "provider_output_not_evidence",
    authority_status: "not_counted"
  };
}

function researchFinding(
  findingId: string,
  findingKind: ResearchFindingRecord["finding_kind"]
): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: findingId,
    research_worker_ref: ref("research_worker", "research-worker-market-provider-contract-001"),
    research_direction_ref: ref("research_direction", "research-direction-market-provider-contract-v1"),
    experiment_run_ref: ref("experiment_run", "experiment-run-market-provider-contract-001"),
    trading_evaluation_result_ref: ref("trading_evaluation_result", "trading-evaluation-result-provider-contract-001"),
    finding_kind: findingKind,
    summary: `Provider contract ${findingKind} finding.`,
    supporting_record_refs: [ref("metric_snapshot", `${findingId}-metric`)],
    created_at: "2026-05-11T17:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function fixtureTradingEvaluationTask(): TradingEvaluationTaskRecord {
  return {
    record_kind: "trading_evaluation_task",
    version: 1,
    trading_evaluation_task_id: "trading-evaluation-task-sealed-replay-provider-contract-001",
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

if (false) {
  const _agentSpec: AgentSpecRecord = {
    record_kind: "agent_spec",
    version: 1,
    agent_spec_id: "agent-spec-artifact-change-proposal-provider-contract-001",
    purpose: "artifact_change_proposal_generation",
    provider_kind: "codex_cli",
    model: "gpt-5.4",
    output_contract_ref: ref("output_contract", "artifact-change-proposal-provider-output-v1")
  };

  const _providerOutputWithDurableProposalTruth = {
    ...providerOutput(
      researchFinding("finding", "next_artifact_hint"),
      researchFinding("anti-hacking", "anti_hacking_case")
    ),
    // @ts-expect-error Provider output is proposal input, not a durable proposal record.
    artifact_change_proposal_id: "artifact-change-proposal-direct-provider-output"
  } satisfies ArtifactChangeProposalProviderOutput;

  void _agentSpec;
  void _providerOutputWithDurableProposalTruth;
}
