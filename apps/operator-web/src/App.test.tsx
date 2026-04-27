import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CandidateInspectReadModel } from "@autokairos/domain";
import { CandidateDetail } from "./App";

describe("CandidateDetail", () => {
  it("renders fixture labels and inspect sections without action controls", () => {
    const html = renderToStaticMarkup(<CandidateDetail candidate={fixtureCandidate} />);

    expect(html).toContain("Fixture / convenience mode");
    expect(html).toContain("fixture_convenience_mode");
    expect(html).toContain("No provider has run.");
    expect(html).toContain("Capability Package");
    expect(html).toContain("Agent And Provider");
    expect(html).toContain("Trace And Evaluation");
    expect(html).not.toMatch(/Start|Pause|Resume|Stop|Promote|Run provider|Run evaluator|Live order/);
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
});

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
