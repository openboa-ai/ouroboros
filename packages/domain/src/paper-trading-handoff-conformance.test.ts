import { describe, expect, it } from "vitest";
import {
  paperTradingHandoffConformanceDigestInput,
  paperTradingHandoffConformanceHasRuntimeShape,
  type PaperTradingHandoffConformanceRecord
} from "./index";

describe("PaperTradingHandoffConformance", () => {
  it("accepts canonical passed and rejected evidence", () => {
    expect(paperTradingHandoffConformanceHasRuntimeShape(passedFixture())).toBe(true);
    expect(paperTradingHandoffConformanceHasRuntimeShape(rejectedFixture())).toBe(true);
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

function passedFixture(): PaperTradingHandoffConformanceRecord {
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

function rejectedFixture(): PaperTradingHandoffConformanceRecord {
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

function baseFixture(): Omit<
  PaperTradingHandoffConformanceRecord,
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
