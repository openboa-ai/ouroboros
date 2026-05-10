import { describe, expect, it } from "vitest";
import type {
  ExecutionAttemptRecord,
  GatewayDecisionRecord,
  OrderIntentRecord,
  Ref,
  TraderSystemRuntimeRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("bounded TraderSystemRuntime authority records", () => {
  it("models logical runtime lifecycle without using placement as identity", () => {
    const runtime = {
      record_kind: "trader_system_runtime",
      version: 1,
      trader_system_runtime_id: "runtime-paper-btc-breakout-v1",
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "registered",
      candidate_ref: ref("trader_system_candidate", "candidate-btc-breakout"),
      candidate_version_ref: ref("candidate_version", "candidate-version-btc-breakout-v1"),
      stage_binding_ref: ref("stage_binding", "stage-binding-paper-v1"),
      placement_ref: ref("runtime_placement", "runtime-placement-compose-local"),
      hands_environment_ref: ref("hands_environment", "hands-environment-paper"),
      memory_surface_ref: ref("runtime_memory_surface", "runtime-memory-surface-paper-v1"),
      runtime_operating_policy_ref: ref("runtime_operating_policy", "runtime-operating-policy-paper-v1"),
      trace_ref: ref("trace_placeholder", "trace-runtime-paper-v1"),
      order_intent_refs: [],
      gateway_decision_refs: [],
      execution_attempt_refs: [],
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies TraderSystemRuntimeRecord;

    expect(runtime.trader_system_runtime_id).not.toBe(runtime.placement_ref.id);
    expect(runtime.runtime_lifecycle_status).toBe("registered");
    expect(runtime.authority_status).toBe("not_live");
  });

  it("models order intent, gateway decision, and dry-run execution without bypassing the gateway", () => {
    const runtimeRef = ref("trader_system_runtime", "runtime-paper-btc-breakout-v1");
    const candidateRef = ref("trader_system_candidate", "candidate-btc-breakout");
    const candidateVersionRef = ref("candidate_version", "candidate-version-btc-breakout-v1");
    const stageBindingRef = ref("stage_binding", "stage-binding-paper-v1");
    const traceRef = ref("trace_placeholder", "trace-runtime-paper-v1");

    const orderIntent = {
      record_kind: "order_intent",
      version: 1,
      order_intent_id: "order-intent-paper-buy-v1",
      runtime_ref: runtimeRef,
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: traceRef,
      intent_kind: "place_order",
      market_scope: "binance_btc_perpetual_futures",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:01:00.000Z",
      authority_status: "not_submitted"
    } satisfies OrderIntentRecord;

    const dryRunDecision = {
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: "gateway-decision-paper-dry-run-v1",
      runtime_ref: runtimeRef,
      order_intent_ref: ref("order_intent", orderIntent.order_intent_id),
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:01:01.000Z",
      policy_ref: ref("runtime_operating_policy", "runtime-operating-policy-paper-v1"),
      authority_status: "dry_run_only"
    } satisfies GatewayDecisionRecord;

    const dryRunAttempt = {
      record_kind: "execution_attempt",
      version: 1,
      execution_attempt_id: "execution-attempt-paper-dry-run-v1",
      runtime_ref: runtimeRef,
      order_intent_ref: ref("order_intent", orderIntent.order_intent_id),
      gateway_decision_ref: ref("gateway_decision", dryRunDecision.gateway_decision_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "binance_btc_perpetual_futures",
      trace_ref: traceRef,
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:01:02.000Z",
      completed_at: "2026-05-10T00:01:03.000Z",
      authority_status: "dry_run_only"
    } satisfies ExecutionAttemptRecord;

    expect(dryRunAttempt.gateway_decision_ref).toEqual(
      ref("gateway_decision", dryRunDecision.gateway_decision_id)
    );
    expect(orderIntent.authority_status).toBe("not_submitted");
    expect(dryRunDecision.authority_status).toBe("dry_run_only");
    expect(dryRunAttempt.authority_status).toBe("dry_run_only");
  });

  it("models allowed and rejected gateway decisions without submitting execution", () => {
    const runtimeRef = ref("trader_system_runtime", "runtime-paper-btc-breakout-v1");
    const orderIntentRef = ref("order_intent", "order-intent-paper-buy-v1");

    const allowedDecision = {
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: "gateway-decision-paper-allowed-v1",
      runtime_ref: runtimeRef,
      order_intent_ref: orderIntentRef,
      decision_outcome: "allowed",
      decision_reason: "dry_run_allowed",
      decided_at: "2026-05-10T00:02:00.000Z",
      authority_status: "not_live"
    } satisfies GatewayDecisionRecord;

    const rejectedDecision = {
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: "gateway-decision-risk-rejected-v1",
      runtime_ref: runtimeRef,
      order_intent_ref: orderIntentRef,
      decision_outcome: "rejected",
      decision_reason: "risk_limit_exceeded",
      decided_at: "2026-05-10T00:03:00.000Z",
      authority_status: "not_live"
    } satisfies GatewayDecisionRecord;

    const blockedAttempt = {
      record_kind: "execution_attempt",
      version: 1,
      execution_attempt_id: "execution-attempt-risk-blocked-v1",
      runtime_ref: runtimeRef,
      order_intent_ref: orderIntentRef,
      gateway_decision_ref: ref("gateway_decision", rejectedDecision.gateway_decision_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "binance_btc_perpetual_futures",
      status: "blocked",
      result_reason: "risk_limit_exceeded",
      created_at: "2026-05-10T00:03:01.000Z",
      authority_status: "not_submitted"
    } satisfies ExecutionAttemptRecord;

    expect(allowedDecision.decision_outcome).toBe("allowed");
    expect(rejectedDecision.decision_outcome).toBe("rejected");
    expect(blockedAttempt.gateway_decision_ref).toEqual(
      ref("gateway_decision", rejectedDecision.gateway_decision_id)
    );
    expect(blockedAttempt.authority_status).toBe("not_submitted");
  });
});
