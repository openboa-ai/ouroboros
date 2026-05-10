import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CandidateEvaluationReadModel,
  CandidateInspectReadModel,
  CandidateRuntimeAuthorityReadModel
} from "@ouroboros/domain";
import { CandidateDetail } from "./App";
import { runtimeAuthorityCommandPayload } from "./api";

describe("CandidateDetail", () => {
  it("renders fixture labels and inspect sections without action controls", () => {
    const html = renderToStaticMarkup(<CandidateDetail candidate={fixtureCandidate} />);

    expect(html).toContain("Fixture / convenience mode");
    expect(html).toContain("fixture_convenience_mode");
    expect(html).toContain("No provider has run.");
    expect(html).toContain("Capability Package");
    expect(html).toContain("Agent And Provider");
    expect(html).toContain("Runtime Authority");
    expect(html).toContain("Bounded paper state");
    expect(html).toContain("Trace And Evaluation");
    expect(html).toContain("Evaluation state");
    expect(html).toContain("pending");
    expect(html).toContain("Latest evaluation run");
    expect(html).toContain("Stage binding");
    expect(html).toContain("Trace material");
    expect(html).toContain("Evidence classifications");
    expect(html).toContain("trace_debug_material");
    expect(html).not.toMatch(/Start|Pause|Resume|Stop|Promote|Run provider|Run evaluator|Live order/);
  });

  it("renders bounded runtime authority state without implying live authority", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={candidateWithRuntimeAuthority(runtimeAuthority())}
        onRecordRuntimeAuthority={() => undefined}
        runtimeAuthorityMessage="dry_run_only recorded: execution-attempt-001"
      />
    );

    expect(html).toContain("Runtime Authority");
    expect(html).toContain("chain complete");
    expect(html).toContain("Latest order intent");
    expect(html).toContain("place_order");
    expect(html).toContain("buy / limit");
    expect(html).toContain("Latest gateway decision");
    expect(html).toContain("dry_run_only");
    expect(html).toContain("paper_stage_only");
    expect(html).toContain("order_intent:order-intent-001");
    expect(html).toContain("Latest execution attempt");
    expect(html).toContain("gateway_decision:gateway-decision-001");
    expect(html).toContain("Record dry-run intent");
    expect(html).toContain("not_live");
    expect(html).not.toMatch(/Start|Pause|Resume|Stop|Promote|Run provider|Run evaluator|Live order|broker/i);
  });

  it("builds fixture-safe runtime authority command payloads", () => {
    const payload = runtimeAuthorityCommandPayload(fixtureCandidate);
    expect(payload).toMatchObject({
      candidate_version_id: fixtureCandidate.candidate_version.candidate_version_id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit"
      },
      gateway_decision: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only"
      },
      execution_attempt: {
        execution_mode: "host_local"
      }
    });
    expect(payload.idempotency_key).toContain("operator-web-runtime-authority");
    expect(JSON.stringify(payload)).not.toMatch(/exchange_credentials|live_order|broker/i);
  });

  it("renders materialization attempts as provider output, not evidence", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail
        candidate={{
          ...fixtureCandidate,
          status: "materialized",
          display_name: "BTC Perp Breakout Candidate",
          materialization_attempt: {
            attempt_id: "candidate-materialization-attempt-001",
            idempotency_key: "codex-run-success-output-hash-001",
            provider_kind: "codex_cli",
            model: "gpt-5.4",
            agent_run_ref: { record_kind: "agent_run", id: "agent-run-codex-success-001" },
            trace_ref: { record_kind: "trace_placeholder", id: "trace-codex-success-001" },
            status: "materialized",
            validation_status: "accepted",
            resulting_candidate_ref: { record_kind: "trader_system_candidate", id: "candidate-001" },
            artifact_refs: [{ record_kind: "provider_output_artifact", id: "codex-output-success-001" }],
            created_at: "2026-04-27T00:00:00.000Z",
            authority_label: "provider_output_not_evidence"
          }
        }}
      />
    );

    expect(html).toContain("Materialization Attempt");
    expect(html).toContain("codex_cli / gpt-5.4");
    expect(html).toContain("provider_output_not_evidence");
    expect(html).not.toMatch(/Counted evidence|Promotion approved|Live authority/);
  });

  it("renders an empty evaluation state separately from failure", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(emptyEvaluation())} />
    );

    expect(html).toContain("Evaluation state");
    expect(html).toContain("empty");
    expect(html).toContain("No evaluation runs");
    expect(html).toContain("no_evaluation_runs");
    expect(html).not.toContain("evaluation_failed");
  });

  it("renders failed evaluation run state with the run error", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(failedEvaluation())} />
    );

    expect(html).toContain("Evaluation state");
    expect(html).toContain("failed");
    expect(html).toContain("evaluation engine rejected metrics");
    expect(html).not.toContain("No evaluation runs");
  });

  it("renders sealed counted and rejected evidence classifications distinctly", () => {
    const html = renderToStaticMarkup(
      <CandidateDetail candidate={candidateWithEvaluation(sealedEvaluation())} />
    );

    expect(html).toContain("sealed");
    expect(html).toContain("counted_evidence");
    expect(html).toContain("rejected_evidence");
    expect(html).toContain("sealed_counted_fixture_only_allowed_by_test");
    expect(html).toContain("partial_trace");
    expect(html).toContain("evidence_sealing_decision:fixture-sealing");
    expect(html).not.toMatch(/Start|Pause|Resume|Stop|Promote|Run provider|Run evaluator|Live order/);
  });
});

function candidateWithEvaluation(evaluation: CandidateEvaluationReadModel): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    evaluation
  };
}

function candidateWithRuntimeAuthority(
  boundedAuthority: CandidateRuntimeAuthorityReadModel
): CandidateInspectReadModel {
  return {
    ...fixtureCandidate,
    runtime: {
      ...fixtureCandidate.runtime,
      bounded_authority: boundedAuthority
    }
  };
}

function runtimeAuthority(): CandidateRuntimeAuthorityReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_order_intent: {
      order_intent_id: "order-intent-001",
      intent_kind: "place_order",
      market_scope: "binance_btc_perpetual_futures",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_submitted"
    },
    latest_gateway_decision: {
      gateway_decision_id: "gateway-decision-001",
      order_intent_ref: { record_kind: "order_intent", id: "order-intent-001" },
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    latest_execution_attempt: {
      execution_attempt_id: "execution-attempt-001",
      order_intent_ref: { record_kind: "order_intent", id: "order-intent-001" },
      gateway_decision_ref: { record_kind: "gateway_decision", id: "gateway-decision-001" },
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "binance_btc_perpetual_futures",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "dry_run_only"
    },
    order_intent: {
      ref: { record_kind: "order_intent", id: "order-intent-001" },
      label: "Order intent",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_decision: {
      ref: { record_kind: "gateway_decision", id: "gateway-decision-001" },
      label: "Gateway decision",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_attempt: {
      ref: { record_kind: "execution_attempt", id: "execution-attempt-001" },
      label: "Execution attempt",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}

function emptyEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    has_runs: false,
    latest_run: null,
    latest_comparison_set: null,
    latest_sealing_decision: null,
    trace: {
      state: "none",
      trace_ref: null,
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_evaluation_runs",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "missing-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "missing-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "missing-sealing", "Evidence sealing decision")
  };
}

function failedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "failed",
      error_state: {
        code: "evaluation_failed",
        message: "evaluation engine rejected metrics"
      }
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    },
    error_state: {
      code: "evaluation_failed",
      message: "evaluation engine rejected metrics"
    }
  };
}

function sealedEvaluation(): CandidateEvaluationReadModel {
  return {
    ...fixtureCandidate.evaluation,
    latest_run: {
      ...fixtureCandidate.evaluation.latest_run!,
      status: "succeeded",
      completed_at: "2026-05-05T00:02:00.000Z"
    },
    latest_comparison_set: {
      ...fixtureCandidate.evaluation.latest_comparison_set!,
      comparability_status: "comparable",
      comparability_reason: "fixture_only"
    },
    latest_sealing_decision: {
      ...fixtureCandidate.evaluation.latest_sealing_decision!,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-counted",
        classified_ref: { record_kind: "evaluation_run_record", id: "fixture-eval" },
        classification_kind: "counted_evidence",
        classification_status: "counted",
        classification_reason: "sealed_counted_fixture_only_allowed_by_test",
        authority_status: "counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      },
      {
        classification_id: "fixture-classification-rejected",
        classified_ref: { record_kind: "provider_output_artifact", id: "fixture-provider-output" },
        classification_kind: "rejected_evidence",
        classification_status: "rejected",
        classification_reason: "partial_trace",
        authority_status: "not_counted",
        sealed_by_decision_ref: { record_kind: "evidence_sealing_decision", id: "fixture-sealing" },
        created_at: "2026-05-05T00:03:00.000Z"
      }
    ],
    counted_evidence: {
      counted: true,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-05T00:03:00.000Z"
    }
  };
}

const fixtureCandidate: CandidateInspectReadModel = {
  candidate_id: "fixture-candidate-btc-perp-001",
  display_name: "Fixture BTC perpetual trader-system candidate",
  status: "fixture_only",
  active_version_id: "fixture-candidate-version-001",
  fixture_notice: {
    mode: "fixture_convenience_mode",
    label: "Fixture / convenience mode",
    statements: [
      "No provider has run.",
      "No trader-system program has executed.",
      "No evaluator has run and no evidence has counted."
    ]
  },
  candidate_version: {
    candidate_version_id: "fixture-candidate-version-001",
    version_label: "fixture-v1",
    provenance_refs: [{ record_kind: "agent_run", id: "fixture-agent-run-001" }]
  },
  spec: {
    ref: { record_kind: "trader_system_spec", id: "fixture-spec" },
    summary: "Fixture spec",
    market: "Binance",
    instrument: "BTC perpetual futures",
    supported_stage_binding_profiles: ["backtest", "paper", "live"]
  },
  program: {
    ref: { record_kind: "trader_system_program", id: "fixture-program" },
    summary: "Fixture program",
    manifest: {
      ref: { record_kind: "program_manifest", id: "fixture-manifest" },
      declared_runtime: "fixture-sandbox-placeholder",
      declared_outputs: ["OrderIntent placeholder"]
    },
    validation: {
      ref: { record_kind: "program_validation_record", id: "fixture-validation" },
      label: "Program validation",
      status: "fixture_placeholder",
      authority_status: "not_runnable"
    }
  },
  capability_package: {
    ref: { record_kind: "capability_package", id: "fixture-package" },
    summary: "Fixture package",
    manifest: {
      ref: { record_kind: "capability_manifest", id: "fixture-capability-manifest" },
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_fixture_market_context"],
      forbidden_contents: ["exchange_credentials"]
    },
    admission: {
      ref: { record_kind: "capability_package_admission_record", id: "fixture-admission" },
      label: "Capability admission",
      status: "fixture_placeholder",
      authority_status: "not_scanned"
    },
    grant: {
      ref: { record_kind: "capability_grant", id: "fixture-grant" },
      label: "Capability grant",
      status: "fixture_placeholder",
      authority_status: "not_granted"
    },
    mount: {
      ref: { record_kind: "capability_mount_record", id: "fixture-mount" },
      label: "Capability mount",
      status: "fixture_placeholder",
      authority_status: "not_mounted"
    }
  },
  agent_provider: {
    agent_spec: placeholder("agent_spec", "fixture-agent-spec", "Agent spec"),
    agent_session: placeholder("agent_session", "fixture-agent-session", "Agent session"),
    agent_run: placeholder("agent_run", "fixture-agent-run", "Agent run"),
    agent_event: placeholder("agent_event", "fixture-agent-event", "Agent event"),
    provider_readiness: placeholder("provider_readiness_record", "fixture-readiness", "Provider readiness"),
    provider_probe_attempt: placeholder("provider_probe_attempt", "fixture-probe", "Provider probe")
  },
  runtime: {
    ref: { record_kind: "trader_system_runtime", id: "fixture-runtime" },
    stage_binding_profile: "paper",
    authority_status: "not_live",
    placement: placeholder("runtime_placement", "fixture-placement", "Runtime placement"),
    hands_environment: placeholder("hands_environment", "fixture-hands", "Hands environment"),
    memory_surface: {
      ref: { record_kind: "runtime_memory_surface", id: "fixture-memory" },
      trust_class: "fixture_context",
      access_mode: "read_only",
      surface_version: "fixture-v1",
      visibility: "operator_visible",
      quarantine_status: "not_quarantined",
      authority_status: "not_evidence"
    }
  },
  trace: placeholder("trace_placeholder", "fixture-trace", "Trace placeholder"),
  evaluation: {
    has_runs: true,
    latest_run: {
      run_id: "fixture-eval",
      status: "created",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z",
      error_state: null
    },
    latest_comparison_set: {
      comparison_set_id: "fixture-comparison",
      stage_binding_ref: { record_kind: "stage_binding", id: "fixture-stage-binding" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      comparability_status: "not_evaluated",
      comparability_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    latest_sealing_decision: {
      sealing_decision_id: "fixture-sealing",
      evaluation_comparison_set_ref: { record_kind: "evaluation_comparison_set", id: "fixture-comparison" },
      evaluation_run_refs: [{ record_kind: "evaluation_run_record", id: "fixture-eval" }],
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted",
      created_at: "2026-05-05T00:00:00.000Z"
    },
    trace: {
      state: "linked",
      trace_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
      authority_status: "not_counted",
      provider_output_artifact_refs: [],
      debug_artifact_refs: []
    },
    evidence_classifications: [
      {
        classification_id: "fixture-classification-trace",
        classified_ref: { record_kind: "trace_placeholder", id: "fixture-trace" },
        classification_kind: "trace_debug_material",
        classification_status: "trace_only",
        classification_reason: "no_external_evaluator",
        authority_status: "not_counted",
        created_at: "2026-05-05T00:00:00.000Z"
      }
    ],
    counted_evidence: {
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "no_external_evaluator",
      authority_status: "not_counted"
    },
    error_state: null,
    run: placeholder("evaluation_run_record", "fixture-eval", "Evaluation run"),
    comparison_set: placeholder("evaluation_comparison_set", "fixture-comparison", "Evaluation comparison set"),
    sealing_decision: placeholder("evidence_sealing_decision", "fixture-sealing", "Evidence sealing decision")
  }
};

function placeholder(record_kind: string, id: string, label: string) {
  return {
    ref: { record_kind, id },
    label,
    status: "fixture_placeholder",
    authority_status: "not_executed"
  };
}
