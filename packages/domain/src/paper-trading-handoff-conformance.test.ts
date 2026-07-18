import { describe, expect, it } from "vitest";
import {
  paperTradingHandoffConformanceDigestInput,
  paperTradingHandoffConformanceHasRuntimeShape,
  type PaperTradingHandoffConformanceRecord,
  type PaperTradingHandoffConformanceRecordV1
} from "./index";

describe("PaperTradingHandoffConformance", () => {
  it("accepts canonical passed and rejected evidence", () => {
    expect(paperTradingHandoffConformanceHasRuntimeShape(passedFixture())).toBe(true);
    expect(paperTradingHandoffConformanceHasRuntimeShape(rejectedFixture())).toBe(true);
  });

  it.each(["hold", "no_action"] as const)(
    "accepts passed %s evidence without a synthesized order-validation request",
    (decisionKind) => {
      const record = passedFixture();
      record.provider_request_count = 2;
      record.decision_event_kind = decisionKind;

      expect(paperTradingHandoffConformanceHasRuntimeShape(record)).toBe(true);
    }
  );

  it("rejects passed order evidence without external order validation", () => {
    const record = passedFixture();
    record.provider_request_count = 2;

    expect(paperTradingHandoffConformanceHasRuntimeShape(record)).toBe(false);
  });

  it("accepts version 2 Docker evidence only with canonical egress attestation", () => {
    expect(paperTradingHandoffConformanceHasRuntimeShape(attestedFixture())).toBe(true);

    const missing = attestedFixture() as any;
    delete missing.candidate_egress_attestation;
    expect(paperTradingHandoffConformanceHasRuntimeShape(missing)).toBe(false);

    const host = attestedFixture() as any;
    host.runner_kind = "host_process";
    expect(paperTradingHandoffConformanceHasRuntimeShape(host)).toBe(false);
  });

  it("keeps version 1 exact and historical", () => {
    const unexpected = passedFixture() as any;
    unexpected.candidate_egress_attestation = attestedFixture().candidate_egress_attestation;

    expect(paperTradingHandoffConformanceHasRuntimeShape(unexpected)).toBe(false);
  });

  it("freezes identity, protocol, evidence, time, and authority in the digest input", () => {
    const baseline = passedFixture();
    const digestInput = paperTradingHandoffConformanceDigestInput(baseline);
    const mutations: Array<(record: PaperTradingHandoffConformanceRecord) => void> = [
      (record) => { record.system_code_ref.id = "system-code-other"; },
      (record) => { record.system_code_artifact_digest = "sha256:other"; },
      (record) => { record.experiment_run_ref.id = "experiment-other"; },
      (record) => { record.trading_evaluation_task_ref.id = "task-other"; },
      (record) => { record.protocol_version = "other" as typeof record.protocol_version; },
      (record) => { record.runner_kind = "docker_sandboxes_sbx"; },
      (record) => { record.status = "rejected"; },
      (record) => { record.reason = "paper_event_invalid"; },
      (record) => { record.provider_request_count = 4; },
      (record) => { record.decision_event_kind = "hold"; },
      (record) => { record.heartbeat_count = 2; },
      (record) => { record.runtime_stopped = false; },
      (record) => { record.started_at = "2026-07-12T10:00:01.000Z"; },
      (record) => { record.completed_at = "2026-07-12T10:00:02.000Z"; },
      (record) => { record.promotion_authority = true as false; }
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(baseline);
      mutate(changed);
      expect(paperTradingHandoffConformanceDigestInput(changed)).not.toBe(digestInput);
    }
  });

  it.each([
    ["wrong record kind", (record: any) => { record.record_kind = "other"; }],
    ["wrong SystemCode ref", (record: any) => { record.system_code_ref.record_kind = "candidate_version"; }],
    ["wrong ExperimentRun ref", (record: any) => { record.experiment_run_ref.record_kind = "system_code"; }],
    ["wrong task ref", (record: any) => { record.trading_evaluation_task_ref.record_kind = "experiment_run"; }],
    ["empty artifact digest", (record: any) => { record.system_code_artifact_digest = ""; }],
    ["unknown protocol", (record: any) => { record.protocol_version = "paper_v2"; }],
    ["unknown runner", (record: any) => { record.runner_kind = "direct_host"; }],
    ["unknown status", (record: any) => { record.status = "infrastructure_failed"; }],
    ["unknown reason", (record: any) => { record.reason = "unknown"; }],
    ["negative requests", (record: any) => { record.provider_request_count = -1; }],
    ["excess requests", (record: any) => { record.provider_request_count = 9; }],
    ["negative heartbeat", (record: any) => { record.heartbeat_count = -1; }],
    ["invalid start time", (record: any) => { record.started_at = "2026-07-12 10:00:00"; }],
    ["completion before start", (record: any) => { record.completed_at = "2026-07-12T09:59:59.000Z"; }],
    ["empty digest", (record: any) => { record.evidence_digest = ""; }],
    ["promotion authority", (record: any) => { record.promotion_authority = true; }],
    ["order authority", (record: any) => { record.order_submission_authority = true; }],
    ["live authority", (record: any) => { record.live_exchange_authority = true; }],
    ["wrong authority", (record: any) => { record.authority_status = "research_only"; }]
  ])("rejects invalid %s", (_label, mutate) => {
    const record = passedFixture() as any;
    mutate(record);
    expect(paperTradingHandoffConformanceHasRuntimeShape(record)).toBe(false);
  });

  it.each([
    ["pass reason", (record: any) => { record.reason = "paper_event_invalid"; }],
    ["decision", (record: any) => { delete record.decision_event_kind; }],
    ["heartbeat", (record: any) => { record.heartbeat_count = 0; }],
    ["stop", (record: any) => { record.runtime_stopped = false; }],
    ["handoff", (record: any) => { record.runnable_paper_handoff = false; }]
  ])("rejects passed evidence without canonical %s", (_label, mutate) => {
    const record = passedFixture() as any;
    mutate(record);
    expect(paperTradingHandoffConformanceHasRuntimeShape(record)).toBe(false);
  });

  it.each([
    ["passed reason", (record: any) => { record.reason = "passed"; }],
    ["handoff", (record: any) => { record.runnable_paper_handoff = true; }]
  ])("rejects rejected evidence with impossible %s", (_label, mutate) => {
    const record = rejectedFixture() as any;
    mutate(record);
    expect(paperTradingHandoffConformanceHasRuntimeShape(record)).toBe(false);
  });
});

function passedFixture(): PaperTradingHandoffConformanceRecordV1 {
  return {
    ...baseFixture(),
    status: "passed",
    reason: "passed",
    provider_request_count: 3,
    decision_event_kind: "order_request",
    heartbeat_count: 1,
    runtime_stopped: true,
    runnable_paper_handoff: true
  };
}

function rejectedFixture(): PaperTradingHandoffConformanceRecordV1 {
  return {
    ...baseFixture(),
    status: "rejected",
    reason: "paper_event_invalid",
    provider_request_count: 3,
    heartbeat_count: 0,
    runtime_stopped: true,
    runnable_paper_handoff: false
  };
}

function attestedFixture(): any {
  const record = {
    ...passedFixture(),
    version: 2,
    runner_kind: "docker_sandboxes_sbx",
    candidate_egress_attestation: {
      protocol_version: "candidate_egress_attestation_v1",
      attestation_id: "candidate-egress-attestation-paper-handoff-conformance-system-code-001",
      attested_by: {
        record_kind: "external_evaluator",
        id: "candidate-egress-evaluator-v1"
      },
      candidate_authored: false,
      system_code_ref: { record_kind: "system_code", id: "system-code-001" },
      system_code_artifact_digest: sha256("a"),
      execution_ref: { record_kind: "experiment_run", id: "experiment-run-001" },
      sandbox: {
        adapter_kind: "docker_sandboxes_sbx",
        sandbox_name: "ouro-candidate-001",
        implementation_version: "0.35.0"
      },
      network_policy: {
        protocol_version: "candidate_sandbox_network_policy_v1",
        inherited_allow_digest: sha256("b"),
        inherited_allow_count: 0,
        owned_allow_rule_ids: [],
        owned_deny_rule_ids: [],
        deny_targets: [
          "https://example.com",
          "https://registry.npmjs.org",
          "tcp://1.1.1.1:53",
          "udp://1.1.1.1:53",
          "http://169.254.169.254:80",
          "http://10.0.0.1:80",
          "http://host.docker.internal:1"
        ]
      },
      network_policy_digest: sha256("c"),
      start: { observed_at: "2026-07-12T10:00:00.000Z", policy_digest: sha256("c") },
      end: { observed_at: "2026-07-12T10:00:01.000Z", policy_digest: sha256("c") },
      candidate_effect: {
        started_at: "2026-07-12T10:00:00.200Z",
        completed_at: "2026-07-12T10:00:00.800Z"
      },
      cleanup_status: "released",
      enforcement_result: "enforced",
      denial_summary: {
        required_probe_count: 7,
        start_denied_probe_count: 7,
        end_denied_probe_count: 7,
        unexpected_allow_count: 0
      },
      issued_at: "2026-07-12T10:00:01.000Z",
      attestation_digest: sha256("d"),
      research_preflight_authority: true,
      promotion_authority: false,
      order_submission_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    }
  };
  return record;
}

function sha256(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function baseFixture(): Omit<
  PaperTradingHandoffConformanceRecordV1,
  | "status"
  | "reason"
  | "provider_request_count"
  | "decision_event_kind"
  | "heartbeat_count"
  | "runtime_stopped"
  | "runnable_paper_handoff"
> {
  return {
    record_kind: "paper_trading_handoff_conformance",
    version: 1,
    paper_trading_handoff_conformance_id: "paper-handoff-conformance-system-code-001",
    system_code_ref: { record_kind: "system_code", id: "system-code-001" },
    system_code_artifact_digest: "sha256:artifact",
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-001" },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "candidate-arena-revenue-cost-v1"
    },
    protocol_version: "paper_trading_event_protocol_v1",
    runner_kind: "host_process",
    started_at: "2026-07-12T10:00:00.000Z",
    completed_at: "2026-07-12T10:00:01.000Z",
    evidence_digest: "sha256:evidence",
    research_preflight_authority: true,
    promotion_authority: false,
    order_submission_authority: false,
    live_exchange_authority: false,
    authority_status: "not_live"
  };
}
