import { describe, expect, it } from "vitest";
import { buildLedgerReadModel } from "./index";
import type {
  ExecutionResultRecord,
  GatewayResultRecord,
  OrderRequestRecord,
  LedgerSourceRecordsReadModel,
  Ref,
  TradingRunRecord
} from "./index";

const ref = (record_kind: string, id: string): Ref => ({ record_kind, id });

describe("bounded TradingRun authority records", () => {
  it("models logical runtime lifecycle without using placement as identity", () => {
    const runtime = {
      record_kind: "trading_run",
      version: 1,
      trading_run_id: "runtime-paper-market-breakout-v1",
      stage_binding_profile: "paper",
      runtime_lifecycle_status: "registered",
      candidate_ref: ref("trading_system_candidate", "candidate-market-breakout"),
      candidate_version_ref: ref("candidate_version", "candidate-version-market-breakout-v1"),
      stage_binding_ref: ref("stage_binding", "stage-binding-paper-v1"),
      placement_ref: ref("sandbox_placement", "sandbox-placement-compose-local"),
      hands_environment_ref: ref("hands_environment", "hands-environment-paper"),
      memory_surface_ref: ref("runtime_memory_surface", "runtime-memory-surface-paper-v1"),
      runtime_operating_policy_ref: ref("runtime_operating_policy", "runtime-operating-policy-paper-v1"),
      trace_ref: ref("trace_placeholder", "trace-runtime-paper-v1"),
      order_request_refs: [],
      gateway_result_refs: [],
      execution_result_refs: [],
      created_at: "2026-05-10T00:00:00.000Z",
      authority_status: "not_live"
    } satisfies TradingRunRecord;

    expect(runtime.trading_run_id).not.toBe(runtime.placement_ref.id);
    expect(runtime.runtime_lifecycle_status).toBe("registered");
    expect(runtime.authority_status).toBe("not_live");
  });

  it("models order request, gateway result, and dry-run execution without bypassing the gateway", () => {
    const runtimeRef = ref("trading_run", "runtime-paper-market-breakout-v1");
    const candidateRef = ref("trading_system_candidate", "candidate-market-breakout");
    const candidateVersionRef = ref("candidate_version", "candidate-version-market-breakout-v1");
    const stageBindingRef = ref("stage_binding", "stage-binding-paper-v1");
    const traceRef = ref("trace_placeholder", "trace-runtime-paper-v1");

    const orderIntent = {
      record_kind: "order_request",
      version: 1,
      order_request_id: "order-request-paper-buy-v1",
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
    } satisfies OrderRequestRecord;

    const dryRunDecision = {
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: "gateway-result-paper-dry-run-v1",
      runtime_ref: runtimeRef,
      order_request_ref: ref("order_request", orderIntent.order_request_id),
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      decided_at: "2026-05-10T00:01:01.000Z",
      policy_ref: ref("runtime_operating_policy", "runtime-operating-policy-paper-v1"),
      authority_status: "dry_run_only"
    } satisfies GatewayResultRecord;

    const dryRunAttempt = {
      record_kind: "execution_result",
      version: 1,
      execution_result_id: "execution-result-paper-dry-run-v1",
      runtime_ref: runtimeRef,
      order_request_ref: ref("order_request", orderIntent.order_request_id),
      gateway_result_ref: ref("gateway_result", dryRunDecision.gateway_result_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "external_trading_api_fixture",
      trace_ref: traceRef,
      status: "dry_run_recorded",
      result_reason: "paper_stage_only",
      created_at: "2026-05-10T00:01:02.000Z",
      completed_at: "2026-05-10T00:01:03.000Z",
      authority_status: "dry_run_only"
    } satisfies ExecutionResultRecord;

    expect(dryRunAttempt.gateway_result_ref).toEqual(
      ref("gateway_result", dryRunDecision.gateway_result_id)
    );
    expect(orderIntent.authority_status).toBe("not_submitted");
    expect(dryRunDecision.authority_status).toBe("dry_run_only");
    expect(dryRunAttempt.authority_status).toBe("dry_run_only");
  });

  it("models allowed and rejected gateway results without submitting execution", () => {
    const runtimeRef = ref("trading_run", "runtime-paper-market-breakout-v1");
    const orderIntentRef = ref("order_request", "order-request-paper-buy-v1");

    const allowedDecision = {
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: "gateway-result-paper-allowed-v1",
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      decision_outcome: "allowed",
      decision_reason: "dry_run_allowed",
      decided_at: "2026-05-10T00:02:00.000Z",
      authority_status: "not_live"
    } satisfies GatewayResultRecord;

    const rejectedDecision = {
      record_kind: "gateway_result",
      version: 1,
      gateway_result_id: "gateway-result-risk-rejected-v1",
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      decision_outcome: "rejected",
      decision_reason: "risk_limit_exceeded",
      decided_at: "2026-05-10T00:03:00.000Z",
      authority_status: "not_live"
    } satisfies GatewayResultRecord;

    const blockedAttempt = {
      record_kind: "execution_result",
      version: 1,
      execution_result_id: "execution-result-risk-blocked-v1",
      runtime_ref: runtimeRef,
      order_request_ref: orderIntentRef,
      gateway_result_ref: ref("gateway_result", rejectedDecision.gateway_result_id),
      stage: "paper",
      execution_mode: "containerized_local",
      venue_scope: "external_trading_api_fixture",
      status: "blocked",
      result_reason: "risk_limit_exceeded",
      created_at: "2026-05-10T00:03:01.000Z",
      authority_status: "not_submitted"
    } satisfies ExecutionResultRecord;

    expect(allowedDecision.decision_outcome).toBe("allowed");
    expect(rejectedDecision.decision_outcome).toBe("rejected");
    expect(blockedAttempt.gateway_result_ref).toEqual(
      ref("gateway_result", rejectedDecision.gateway_result_id)
    );
    expect(blockedAttempt.authority_status).toBe("not_submitted");
  });
});

describe("Ledger read model", () => {
  it("wraps empty source records as an empty Ledger", () => {
    const ledger = buildLedgerReadModel(emptyAuthority());

    expect(ledger).toMatchObject({
      ledger_kind: "ledger",
      has_activity: false,
      chain_complete: false,
      latest_order_request: null,
      latest_gateway_result: null,
      latest_execution_result: null,
      order_request: {
        label: "Order request",
        status: "not_submitted"
      },
      gateway_result: {
        label: "Gateway result",
        status: "not_evaluated"
      },
      execution_result: {
        label: "Execution result",
        status: "not_submitted"
      },
      authority_status: "not_live",
      no_authority: {
        live_exchange_authority: false,
        private_read_authority: false,
        order_submission_authority: false,
        credentials: false
      },
      source_record_kinds: ["order_request", "gateway_result", "execution_result"]
    });
  });

  it("wraps a complete order request, gateway result, and execution result chain", () => {
    const authority = completeAuthority();
    const ledger = buildLedgerReadModel(authority);

    expect(ledger).toMatchObject({
      ledger_kind: "ledger",
      has_activity: true,
      chain_complete: true,
      latest_order_request: {
        order_request_id: "order-request-paper-buy-v1",
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "60000",
        authority_status: "not_submitted"
      },
      latest_gateway_result: {
        gateway_result_id: "gateway-result-paper-dry-run-v1",
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        authority_status: "dry_run_only"
      },
      latest_execution_result: {
        execution_result_id: "execution-result-paper-dry-run-v1",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      },
      order_request: {
        label: "Order request",
        status: "proposed"
      },
      gateway_result: {
        label: "Gateway result",
        status: "dry_run_only"
      },
      execution_result: {
        label: "Execution result",
        status: "dry_run_recorded"
      }
    });
  });

  it("builds the public Ledger from source records", () => {
    const sourceRecords = completeAuthority();
    const ledger = buildLedgerReadModel(sourceRecords);

    expect(ledger).toMatchObject({
      ledger_kind: "ledger",
      chain_complete: true,
      latest_order_request: {
        order_request_id: "order-request-paper-buy-v1"
      },
      source_record_kinds: ["order_request", "gateway_result", "execution_result"]
    });
  });

  it("keeps Ledger chain history as newest first", () => {
    const sourceRecords = completeAuthority();
    const latestOrderRequest = sourceRecords.latest_order_request;
    const latestGatewayResult = sourceRecords.latest_gateway_result;
    const latestExecutionResult = sourceRecords.latest_execution_result;
    if (!latestOrderRequest || !latestGatewayResult || !latestExecutionResult) {
      throw new Error("expected complete source records");
    }
    const rejectedOrderRequest = {
      ...latestOrderRequest,
      order_request_id: "order-request-risk-rejected-v1",
      quantity: "0",
      created_at: "2026-05-10T00:02:00.000Z"
    } satisfies NonNullable<LedgerSourceRecordsReadModel["latest_order_request"]>;
    const rejectedGatewayResult = {
      ...latestGatewayResult,
      gateway_result_id: "gateway-result-risk-rejected-v1",
      order_request_ref: ref("order_request", rejectedOrderRequest.order_request_id),
      decision_outcome: "rejected" as const,
      decision_reason: "risk_limit_exceeded" as const,
      decided_at: "2026-05-10T00:02:01.000Z",
      authority_status: "not_live" as const
    } satisfies NonNullable<LedgerSourceRecordsReadModel["latest_gateway_result"]>;
    const rejectedExecutionResult = {
      ...latestExecutionResult,
      execution_result_id: "execution-result-risk-blocked-v1",
      order_request_ref: ref("order_request", rejectedOrderRequest.order_request_id),
      gateway_result_ref: ref("gateway_result", rejectedGatewayResult.gateway_result_id),
      status: "blocked" as const,
      result_reason: "risk_limit_exceeded" as const,
      created_at: "2026-05-10T00:02:02.000Z",
      authority_status: "not_submitted" as const
    } satisfies NonNullable<LedgerSourceRecordsReadModel["latest_execution_result"]>;
    const ledger = buildLedgerReadModel({
      ...sourceRecords,
      chain_count: 2,
      chains: [
        {
          chain_id: rejectedOrderRequest.order_request_id,
          chain_complete: true,
          occurred_at: rejectedExecutionResult.created_at,
          order_request: rejectedOrderRequest,
          gateway_result: rejectedGatewayResult,
          execution_result: rejectedExecutionResult,
          authority_status: "not_live"
        },
        sourceRecords.chains[0]
      ]
    });

    expect(ledger).toMatchObject({
      chain_count: 2,
      chains: [
        {
          chain_complete: true,
          order_request: {
            order_request_id: "order-request-risk-rejected-v1",
            quantity: "0"
          },
          gateway_result: {
            decision_outcome: "rejected",
            decision_reason: "risk_limit_exceeded"
          },
          execution_result: {
            status: "blocked",
            result_reason: "risk_limit_exceeded"
          }
        },
        {
          order_request: {
            order_request_id: "order-request-paper-buy-v1",
            quantity: "0.001"
          },
          gateway_result: {
            decision_outcome: "dry_run_only"
          },
          execution_result: {
            status: "dry_run_recorded"
          }
        }
      ]
    });
  });

  it("uses Ledger as the public read-model name", () => {
    const ledger = buildLedgerReadModel(emptyAuthority());

    expect(ledger.ledger_kind).toBe("ledger");
    expect(ledger.order_request.label).toBe("Order request");
  });
});

function emptyAuthority(): LedgerSourceRecordsReadModel {
  return {
    has_activity: false,
    chain_complete: false,
    chain_count: 0,
    chains: [],
    latest_order_request: null,
    latest_gateway_result: null,
    latest_execution_result: null,
    order_request: {
      ref: ref("order_request", "none"),
      label: "Order request",
      status: "not_submitted",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: ref("gateway_result", "none"),
      label: "Gateway result",
      status: "not_evaluated",
      authority_status: "not_live"
    },
    execution_result: {
      ref: ref("execution_result", "none"),
      label: "Execution result",
      status: "not_submitted",
      authority_status: "not_submitted"
    }
  };
}

function completeAuthority(): LedgerSourceRecordsReadModel {
  const latestOrderRequest = {
    order_request_id: "order-request-paper-buy-v1",
    intent_kind: "place_order",
    market_scope: "external_trading_api_fixture",
    side: "buy",
    order_type: "limit",
    quantity: "0.001",
    limit_price: "60000",
    status: "proposed",
    created_at: "2026-05-10T00:01:00.000Z",
    authority_status: "not_submitted"
  } satisfies LedgerSourceRecordsReadModel["latest_order_request"];
  const latestGatewayResult = {
    gateway_result_id: "gateway-result-paper-dry-run-v1",
    order_request_ref: ref("order_request", "order-request-paper-buy-v1"),
    decision_outcome: "dry_run_only",
    decision_reason: "paper_stage_only",
    decided_at: "2026-05-10T00:01:01.000Z",
    authority_status: "dry_run_only"
  } satisfies LedgerSourceRecordsReadModel["latest_gateway_result"];
  const latestExecutionResult = {
    execution_result_id: "execution-result-paper-dry-run-v1",
    order_request_ref: ref("order_request", "order-request-paper-buy-v1"),
    gateway_result_ref: ref("gateway_result", "gateway-result-paper-dry-run-v1"),
    stage: "paper",
    execution_mode: "host_local",
    venue_scope: "external_trading_api_fixture",
    status: "dry_run_recorded",
    result_reason: "paper_stage_only",
    created_at: "2026-05-10T00:01:02.000Z",
    authority_status: "dry_run_only"
  } satisfies LedgerSourceRecordsReadModel["latest_execution_result"];

  return {
    has_activity: true,
    chain_complete: true,
    chain_count: 1,
    chains: [
      {
        chain_id: "order-request-paper-buy-v1",
        chain_complete: true,
        occurred_at: "2026-05-10T00:01:02.000Z",
        order_request: latestOrderRequest,
        gateway_result: latestGatewayResult,
        execution_result: latestExecutionResult,
        authority_status: "not_live"
      }
    ],
    latest_order_request: latestOrderRequest,
    latest_gateway_result: latestGatewayResult,
    latest_execution_result: latestExecutionResult,
    order_request: {
      ref: ref("order_request", "order-request-paper-buy-v1"),
      label: "Order request",
      status: "proposed",
      authority_status: "not_submitted"
    },
    gateway_result: {
      ref: ref("gateway_result", "gateway-result-paper-dry-run-v1"),
      label: "Gateway result",
      status: "dry_run_only",
      authority_status: "dry_run_only"
    },
    execution_result: {
      ref: ref("execution_result", "execution-result-paper-dry-run-v1"),
      label: "Execution result",
      status: "dry_run_recorded",
      authority_status: "dry_run_only"
    }
  };
}
