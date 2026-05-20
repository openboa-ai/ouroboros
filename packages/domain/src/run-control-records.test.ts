import { describe, expect, it } from "vitest";
import type {
  Ref,
  RuntimeAuditEventRecord,
  RunControlCommandRecord,
  RunControlDecisionRecord,
  SandboxPlacementRecord,
  TradingRunRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("TradingRun control and audit records", () => {
  it("models start as a Run Control action that moves a paper TradingRun to running", () => {
    const runtimeRef = ref("trading_run", "trading-run-paper-market-breakout-v1");
    const commandRef = ref("run_control_command", "run-control-command-start-v1");
    const decisionRef = ref("run_control_decision", "run-control-decision-start-v1");
    const operatorRef = ref("operator", "operator-sjson");
    const policyRef = ref("runtime_operating_policy", "runtime-operating-policy-paper-v1");

    const startCommand = {
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: commandRef.id,
      runtime_ref: runtimeRef,
      action: "start",
      requested_lifecycle_status: "running",
      actor_kind: "human_operator",
      actor_ref: operatorRef,
      runtime_operating_policy_ref: policyRef,
      idempotency_key: "trading-run-start:trading-run-paper-market-breakout-v1:candidate-version-v1",
      reason: "operator_request",
      reason_summary: "Start fixture paper Trading Run.",
      requested_at: "2026-05-20T00:00:00.000Z",
      status: "decided",
      authority_status: "control_only"
    } satisfies RunControlCommandRecord;

    const startDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: decisionRef.id,
      runtime_ref: runtimeRef,
      command_ref: commandRef,
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: ref("runtime_policy_engine", "runtime-policy-engine-fixture"),
      runtime_operating_policy_ref: policyRef,
      resulting_lifecycle_status: "running",
      decided_at: "2026-05-20T00:00:01.000Z",
      authority_status: "control_only"
    } satisfies RunControlDecisionRecord;

    expect(startCommand.action).toBe("start");
    expect(startCommand.requested_lifecycle_status).toBe("running");
    expect(startDecision.resulting_lifecycle_status).toBe("running");
    expect(startDecision.authority_status).toBe("control_only");
  });

  it("models a pause decision against logical runtime identity instead of placement identity", () => {
    const runtimeRef = ref("trading_run", "runtime-paper-market-breakout-v1");
    const placementRef = ref("sandbox_placement", "sandbox-placement-compose-local");
    const commandRef = ref("run_control_command", "run-control-command-pause-v1");
    const decisionRef = ref("run_control_decision", "run-control-decision-pause-v1");
    const auditEventRef = ref("runtime_audit_event", "runtime-audit-event-pause-v1");
    const policyRef = ref("runtime_operating_policy", "runtime-operating-policy-paper-v1");
    const operatorRef = ref("operator", "operator-sjson");

    const runtime = {
      record_kind: "trading_run",
      version: 1,
      trading_run_id: runtimeRef.id,
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "running",
      candidate_ref: ref("trading_system_candidate", "candidate-market-breakout"),
      candidate_version_ref: ref("candidate_version", "candidate-version-market-breakout-v1"),
      stage_binding_ref: ref("stage_binding", "stage-binding-paper-v1"),
      placement_ref: placementRef,
      hands_environment_ref: ref("hands_environment", "hands-environment-paper"),
      memory_surface_ref: ref("runtime_memory_surface", "runtime-memory-surface-paper-v1"),
      runtime_operating_policy_ref: policyRef,
      trace_ref: ref("trace_placeholder", "trace-runtime-paper-v1"),
      run_control_command_refs: [commandRef],
      run_control_decision_refs: [decisionRef],
      runtime_audit_event_refs: [auditEventRef],
      authority_status: "not_live"
    } satisfies TradingRunRecord;

    const pauseCommand = {
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: commandRef.id,
      runtime_ref: runtimeRef,
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: operatorRef,
      runtime_operating_policy_ref: policyRef,
      idempotency_key: "pause-runtime-paper-market-breakout-v1",
      reason: "operator_request",
      reason_summary: "Pause before reviewing paper-stage behavior.",
      requested_at: "2026-05-10T00:10:00.000Z",
      status: "decided",
      authority_status: "control_only"
    } satisfies RunControlCommandRecord;

    const pauseDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: decisionRef.id,
      runtime_ref: runtimeRef,
      command_ref: commandRef,
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: ref("runtime_policy_engine", "runtime-policy-engine-fixture"),
      runtime_operating_policy_ref: policyRef,
      resulting_lifecycle_status: "paused",
      decided_at: "2026-05-10T00:10:01.000Z",
      authority_status: "control_only"
    } satisfies RunControlDecisionRecord;

    const pauseAuditEvent = {
      record_kind: "runtime_audit_event",
      version: 1,
      runtime_audit_event_id: auditEventRef.id,
      runtime_ref: runtimeRef,
      event_kind: "runtime_lifecycle_transitioned",
      command_ref: commandRef,
      decision_ref: decisionRef,
      actor_kind: "human_operator",
      actor_ref: operatorRef,
      runtime_lifecycle_status: "paused",
      supporting_record_refs: [commandRef, decisionRef, policyRef],
      created_at: "2026-05-10T00:10:02.000Z",
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord;

    expect(runtime.trading_run_id).not.toBe(runtime.placement_ref.id);
    expect(pauseCommand.runtime_ref).toEqual(runtimeRef);
    expect(pauseCommand.runtime_ref).not.toEqual(placementRef);
    expect(pauseDecision.command_ref).toEqual(commandRef);
    expect(pauseAuditEvent.supporting_record_refs).toEqual([commandRef, decisionRef, policyRef]);
    expect(pauseAuditEvent.runtime_lifecycle_status).toBe("paused");
  });

  it("models kill rejection and no-live authority without converting placement or gateway state into control truth", () => {
    const runtimeRef = ref("trading_run", "runtime-paper-market-breakout-v1");
    const placement = {
      record_kind: "sandbox_placement",
      version: 1,
      sandbox_placement_id: "sandbox-placement-compose-local",
      placement_kind: "containerized_local",
      tooling_kind: "docker_compose",
      service_name: "runtime",
      compose_project: "ouroboros-local",
      authority_status: "not_launched"
    } satisfies SandboxPlacementRecord;

    const killCommand = {
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: "run-control-command-kill-v1",
      runtime_ref: runtimeRef,
      action: "kill",
      requested_lifecycle_status: "killed",
      actor_kind: "human_operator",
      actor_ref: ref("operator", "operator-sjson"),
      runtime_operating_policy_ref: ref(
        "runtime_operating_policy",
        "runtime-operating-policy-paper-v1"
      ),
      idempotency_key: "kill-runtime-paper-market-breakout-v1",
      reason: "safety_intervention",
      related_gateway_result_refs: [],
      related_execution_result_refs: [],
      requested_at: "2026-05-10T00:20:00.000Z",
      status: "decided",
      authority_status: "not_live"
    } satisfies RunControlCommandRecord;

    const noLiveDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: "run-control-decision-kill-v1",
      runtime_ref: runtimeRef,
      command_ref: ref("run_control_command", killCommand.run_control_command_id),
      decision_outcome: "no_live_authority",
      decision_reason: "no_live_authority",
      decided_by_actor_kind: "policy_engine",
      resulting_lifecycle_status: "human_review_required",
      related_order_request_refs: [],
      related_gateway_result_refs: [],
      related_execution_result_refs: [],
      decided_at: "2026-05-10T00:20:01.000Z",
      authority_status: "not_live"
    } satisfies RunControlDecisionRecord;

    const dryRunInspectionDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: "run-control-decision-inspect-dry-run-v1",
      runtime_ref: runtimeRef,
      command_ref: ref("run_control_command", "run-control-command-inspect-v1"),
      decision_outcome: "dry_run_only",
      decision_reason: "fixture_only",
      decided_by_actor_kind: "policy_engine",
      resulting_lifecycle_status: "running",
      related_order_request_refs: [],
      related_gateway_result_refs: [],
      related_execution_result_refs: [],
      decided_at: "2026-05-10T00:20:03.000Z",
      authority_status: "dry_run_only"
    } satisfies RunControlDecisionRecord;

    const rejectedStopDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: "run-control-decision-stop-rejected-v1",
      runtime_ref: runtimeRef,
      command_ref: ref("run_control_command", "run-control-command-stop-v1"),
      decision_outcome: "rejected",
      decision_reason: "runtime_lifecycle_incompatible",
      decided_by_actor_kind: "policy_engine",
      resulting_lifecycle_status: "human_review_required",
      related_order_request_refs: [],
      related_gateway_result_refs: [],
      related_execution_result_refs: [],
      decided_at: "2026-05-10T00:20:04.000Z",
      authority_status: "control_only"
    } satisfies RunControlDecisionRecord;

    const rejectionAuditEvent = {
      record_kind: "runtime_audit_event",
      version: 1,
      runtime_audit_event_id: "runtime-audit-event-kill-rejected-v1",
      runtime_ref: runtimeRef,
      event_kind: "control_kill_recorded",
      command_ref: ref("run_control_command", killCommand.run_control_command_id),
      decision_ref: ref("run_control_decision", noLiveDecision.run_control_decision_id),
      runtime_lifecycle_status: "human_review_required",
      message: "Kill request recorded, but no live gateway authority exists in this MLP boundary.",
      supporting_record_refs: [
        ref("run_control_command", killCommand.run_control_command_id),
        ref("run_control_decision", noLiveDecision.run_control_decision_id)
      ],
      created_at: "2026-05-10T00:20:02.000Z",
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord;

    expect(placement.authority_status).toBe("not_launched");
    expect(killCommand.runtime_ref.record_kind).toBe("trading_run");
    expect(noLiveDecision.decision_outcome).toBe("no_live_authority");
    expect(dryRunInspectionDecision.decision_outcome).toBe("dry_run_only");
    expect(rejectedStopDecision.decision_outcome).toBe("rejected");
    expect(noLiveDecision.related_gateway_result_refs).toHaveLength(0);
    expect(noLiveDecision.related_execution_result_refs).toHaveLength(0);
    expect(rejectionAuditEvent.authority_status).toBe("audit_only");
  });

  it("models override and handoff audit chains with operator and policy attribution", () => {
    const runtimeRef = ref("trading_run", "runtime-paper-market-breakout-v1");
    const operatorRef = ref("operator", "operator-sjson");
    const handoffTargetRef = ref("operator", "operator-next-reviewer");
    const policyRef = ref("runtime_operating_policy", "runtime-operating-policy-paper-v1");
    const overrideCommandRef = ref(
      "run_control_command",
      "run-control-command-override-v1"
    );
    const overrideDecisionRef = ref(
      "run_control_decision",
      "run-control-decision-override-v1"
    );
    const handoffCommandRef = ref(
      "run_control_command",
      "run-control-command-handoff-v1"
    );

    const overrideCommand = {
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: overrideCommandRef.id,
      runtime_ref: runtimeRef,
      action: "override",
      requested_lifecycle_status: "human_review_required",
      actor_kind: "human_operator",
      actor_ref: operatorRef,
      runtime_operating_policy_ref: policyRef,
      idempotency_key: "override-runtime-paper-market-breakout-v1",
      reason: "manual_override",
      reason_summary: "Force review-required posture after operator inspection.",
      trace_ref: ref("trace_placeholder", "trace-runtime-paper-v1"),
      related_order_request_refs: [ref("order_request", "order-request-paper-buy-v1")],
      related_gateway_result_refs: [ref("gateway_result", "gateway-result-paper-v1")],
      related_execution_result_refs: [
        ref("execution_result", "execution-result-paper-dry-run-v1")
      ],
      requested_at: "2026-05-10T00:30:00.000Z",
      status: "decided",
      authority_status: "control_only"
    } satisfies RunControlCommandRecord;

    const overrideDecision = {
      record_kind: "run_control_decision",
      version: 1,
      run_control_decision_id: overrideDecisionRef.id,
      runtime_ref: runtimeRef,
      command_ref: overrideCommandRef,
      decision_outcome: "allowed",
      decision_reason: "manual_override_allowed",
      decided_by_actor_kind: "human_operator",
      decided_by_actor_ref: operatorRef,
      runtime_operating_policy_ref: policyRef,
      resulting_lifecycle_status: "human_review_required",
      related_order_request_refs: overrideCommand.related_order_request_refs,
      related_gateway_result_refs: overrideCommand.related_gateway_result_refs,
      related_execution_result_refs: overrideCommand.related_execution_result_refs,
      decided_at: "2026-05-10T00:30:01.000Z",
      authority_status: "control_only"
    } satisfies RunControlDecisionRecord;

    const handoffCommand = {
      record_kind: "run_control_command",
      version: 1,
      run_control_command_id: handoffCommandRef.id,
      runtime_ref: runtimeRef,
      action: "handoff",
      actor_kind: "human_operator",
      actor_ref: operatorRef,
      idempotency_key: "handoff-runtime-paper-market-breakout-v1",
      reason: "handoff_requested",
      reason_summary: "Move follow-up runtime review to the next operator.",
      requested_at: "2026-05-10T00:31:00.000Z",
      status: "pending_decision",
      authority_status: "audit_only"
    } satisfies RunControlCommandRecord;

    const handoffAuditEvent = {
      record_kind: "runtime_audit_event",
      version: 1,
      runtime_audit_event_id: "runtime-audit-event-handoff-v1",
      runtime_ref: runtimeRef,
      event_kind: "operator_handoff_recorded",
      command_ref: handoffCommandRef,
      actor_kind: "external_handoff",
      actor_ref: handoffTargetRef,
      runtime_lifecycle_status: "human_review_required",
      supporting_record_refs: [
        overrideCommandRef,
        overrideDecisionRef,
        handoffCommandRef,
        policyRef
      ],
      created_at: "2026-05-10T00:31:01.000Z",
      authority_status: "audit_only"
    } satisfies RuntimeAuditEventRecord;

    expect(overrideDecision.related_order_request_refs).toEqual([
      ref("order_request", "order-request-paper-buy-v1")
    ]);
    expect(overrideDecision.related_gateway_result_refs).toEqual([
      ref("gateway_result", "gateway-result-paper-v1")
    ]);
    expect(handoffCommand.action).toBe("handoff");
    expect(handoffAuditEvent.actor_ref).toEqual(handoffTargetRef);
    expect(handoffAuditEvent.supporting_record_refs).toContainEqual(policyRef);
  });
});
