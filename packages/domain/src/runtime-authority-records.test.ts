import { describe, expect, it } from "vitest";
import { buildTradingLedgerReadModel } from "./index";
import type {
  ExecutionAttemptRecord,
  GatewayDecisionRecord,
  OrderIntentDraftRecord,
  ReplayRuntimeAuthorityReadModel,
  Ref,
  TradingSystemRuntimeRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("bounded TradingSystemRuntime authority records", () => {
  it("models logical runtime lifecycle without using placement as identity", () => {
    const runtime = {
      record_kind: "trading_system_runtime",
      version: 1,
      trading_system_runtime_id: "runtime-paper-market-breakout-v1",
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "registered",
      candidate_ref: ref("trading_system_candidate", "candidate-market-breakout"),
      candidate_version_ref: ref("candidate_version", "candidate-version-market-breakout-v1"),
      stage_binding_ref: ref("stage_binding", "stage-binding-paper-v1"),
      placement_ref: ref("runtime_placement", "runtime-placement-compose-local"),
      hands_environment_ref: ref("hands_environment", "hands-environment-paper"),
      memory_surface_ref: ref("runtime_memory_surface", "runtime-memory-surface-paper-v1"),
      runtime_operating_policy_ref: ref("runtime_operating_policy", "runtime-operating-policy-paper-v1"),
      trace_ref: ref("trace_placeholder", "trace-runtime-paper-v1"),
      order_intent_draft_refs: [],
      gateway_decision_refs: [],
      execution_attempt_refs: [],
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies TradingSystemRuntimeRecord;

    expect(runtime.trading_system_runtime_id).not.toBe(runtime.placement_ref.id);
    expect(runtime.runtime_lifecycle_status).toBe("registered");
    expect(runtime.authority_status).toBe("not_live");
  });

  it("models order intent draft, gateway decision, and dry-run execution without bypassing the gateway", () => {
    const runtimeRef = ref("trading_system_runtime", "runtime-paper-market-breakout-v1");
    const candidateRef = ref("trading_system_candidate", "candidate-market-breakout");
    const candidateVersionRef = ref("candidate_version", "candidate-version-market-breakout-v1");
    const stageBindingRef = ref("stage_binding", "stage-binding-paper-v1");
    const traceRef = ref("trace_placeholder", "trace-runtime-paper-v1");

    const orderIntent = {
      record_kind: "order_intent_draft",
      version: 1,
      order_intent_draft_id: "order-intent-draft-paper-buy-v1",
      runtime_ref: runtimeRef,
      candidate_ref: candidateRef,
      candidate_version_ref: candidateVersionRef,
      stage_binding_ref: stageBindingRef,
      trace_ref: traceRef,
      intent_kind: "place_order",
      market_scope: "external_trading_api_fixture",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:01:00.000Z",
      authority_status: "not_submitted"
    } satisfies OrderIntentDraftRecord;

    const dryRunDecision = {
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: "gateway-decision-paper-dry-run-v1",
      runtime_ref: runtimeRef,
      order_intent_draft_ref: ref("order_intent_draft", orderIntent.order_intent_draft_id),
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
      order_intent_draft_ref: ref("order_intent_draft", orderIntent.order_intent_draft_id),
      gateway_decision_ref: ref("gateway_decision", dryRunDecision.gateway_decision_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "external_trading_api_fixture",
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
    const runtimeRef = ref("trading_system_runtime", "runtime-paper-market-breakout-v1");
    const orderIntentRef = ref("order_intent_draft", "order-intent-draft-paper-buy-v1");

    const allowedDecision = {
      record_kind: "gateway_decision",
      version: 1,
      gateway_decision_id: "gateway-decision-paper-allowed-v1",
      runtime_ref: runtimeRef,
      order_intent_draft_ref: orderIntentRef,
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
      order_intent_draft_ref: orderIntentRef,
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
      order_intent_draft_ref: orderIntentRef,
      gateway_decision_ref: ref("gateway_decision", rejectedDecision.gateway_decision_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "external_trading_api_fixture",
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

describe("TradingLedger read model", () => {
  it("wraps an empty bounded authority chain as an empty TradingLedger", () => {
    const ledger = buildTradingLedgerReadModel(emptyAuthority());

    expect(ledger).toMatchObject({
      ledger_kind: "trading_ledger",
      has_activity: false,
      chain_complete: false,
      latest_order_intent: null,
      latest_gateway_decision: null,
      latest_execution_attempt: null,
      order_intent: {
        label: "Order intent",
        status: "not_submitted"
      },
      gateway_decision: {
        label: "Gateway decision",
        status: "not_evaluated"
      },
      execution_attempt: {
        label: "Execution attempt",
        status: "not_submitted"
      },
      authority_status: "not_live",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      },
      compatibility: {
        source_projection: "runtime.bounded_authority",
        source_record_kinds: [
          "order_intent_draft",
          "gateway_decision",
          "execution_attempt"
        ]
      }
    });
  });

  it("wraps a complete order intent, gateway decision, and execution attempt chain", () => {
    const authority = completeAuthority();
    const ledger = buildTradingLedgerReadModel(authority);

    expect(ledger).toMatchObject({
      ledger_kind: "trading_ledger",
      has_activity: true,
      chain_complete: true,
      latest_order_intent: {
        order_intent_draft_id: "order-intent-draft-paper-buy-v1",
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "60000",
        authority_status: "not_submitted"
      },
      latest_gateway_decision: {
        gateway_decision_id: "gateway-decision-paper-dry-run-v1",
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        authority_status: "dry_run_only"
      },
      latest_execution_attempt: {
        execution_attempt_id: "execution-attempt-paper-dry-run-v1",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      },
      order_intent: {
        label: "Order intent",
        status: "proposed"
      },
      gateway_decision: {
        label: "Gateway decision",
        status: "dry_run_only"
      },
      execution_attempt: {
        label: "Execution attempt",
        status: "dry_run_recorded"
      },
      authority_status: "not_live"
    });
  });
});

function emptyAuthority(): ReplayRuntimeAuthorityReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    latest_order_intent_draft: null,
    latest_gateway_decision: null,
    latest_execution_attempt: null,
    order_intent_draft: {
      ref: ref("order_intent_draft", "none"),
      label: "Order intent draft",
      status: "not_submitted",
      authority_status: "not_submitted"
    },
    gateway_decision: {
      ref: ref("gateway_decision", "none"),
      label: "Gateway decision",
      status: "not_evaluated",
      authority_status: "not_live"
    },
    execution_attempt: {
      ref: ref("execution_attempt", "none"),
      label: "Execution attempt",
      status: "not_submitted",
      authority_status: "not_submitted"
    }
  };
}

function completeAuthority(): ReplayRuntimeAuthorityReadModel {
  return {
    has_activity: true,
    chain_complete: true,
    latest_order_intent_draft: {
      order_intent_draft_id: "order-intent-draft-paper-buy-v1",
      intent_kind: "place_order",
      market_scope: "external_trading_api_fixture",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000",
      status: "proposed",
      created_at: "2026-05-10T00:01:00.000Z",
      authority_status: "not_submitted"
    },
    latest_gateway_decision: {
      gateway_decision_id: "gateway-decision-paper-dry-run-v1",
      order_intent_draft_ref: ref("order_intent_draft", "order-intent-draft-paper-buy-v1"),
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:01:01.000Z",
      authority_status: "dry_run_only"
    },
    latest_execution_attempt: {
      execution_attempt_id: "execution-attempt-paper-dry-run-v1",
      order_intent_draft_ref: ref("order_intent_draft", "order-intent-draft-paper-buy-v1"),
      gateway_decision_ref: ref("gateway_decision", "gateway-decision-paper-dry-run-v1"),
      stage: "paper",
      execution_mode: "host_local",
      venue_scope: "external_trading_api_fixture",
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:01:02.000Z",
      authority_status: "dry_run_only"
    },
    order_intent_draft: {
      ref: ref("order_intent_draft", "order-intent-draft-paper-buy-v1"),
      label: "Order intent draft",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_decision: {
      ref: ref("gateway_decision", "gateway-decision-paper-dry-run-v1"),
      label: "Gateway decision",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_attempt: {
      ref: ref("execution_attempt", "execution-attempt-paper-dry-run-v1"),
      label: "Execution attempt",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}
