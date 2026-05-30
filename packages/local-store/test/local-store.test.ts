import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, FIXTURE_SYSTEM_CODE_ID, LocalStore } from "../src/index";
import {
  BINANCE_BTCUSDT_QUERY,
  BINANCE_PRIVATE_READINESS_SECURITY_TYPES,
  binanceBtcusdtNoAuthoritySurfaceExpectation,
  binancePrivateReadinessPolicyDecisionNoAuthorityExpectation,
  binancePrivateReadinessPostureNoAuthorityExpectation,
  privateReadinessGate,
  privateReadinessPolicyGate,
  ref
} from "../../../test/support/binance-no-authority";
import type {
  AccountPositionRiskMirrorSurfaceRecord,
  ArtifactLineageRecord,
  ImprovementProposalRecord,
  ResearchFindingRecord,
  ResearchOrchestrationRunRecord,
  ImprovementProposalMaterializationInput,
  ImprovementProposalProviderFailureInput,
  ImprovementProposalProviderResult,
  LedgerInput,
  CandidateMaterializationInput,
  EvidenceClassificationRecord,
  EvaluationComparisonSetRecord,
  ExecutionResultRecord,
  ExperimentRunRecord,
  EvaluationRunRecord,
  EvidenceSealingDecisionRecord,
  GatewayResultRecord,
  OrderFillSurfaceRecord,
  OrderRequestRecord,
  PrivateReadinessPostureRecord,
  PrivateReadinessPreflightSurfaceRecord,
  PublicMarketLivenessSurfaceRecord,
  SystemCodeRecord,
  RuntimeAuditEventRecord,
  RuntimeHeartbeatRecord,
  RunControlAuditInput,
  RunControlCommandRecord,
  RunControlDecisionRecord,
  SandboxLogRecord,
  SandboxPlacementRecord,
  SandboxRecord,
  StageBindingRecord,
  TracePlaceholderRecord,
  TradingEvaluationResultRecord,
  TradingRunRecord
} from "@ouroboros/domain";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-store-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("LocalStore", () => {
  it("seeds fixture data idempotently", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const first = await readFile(
      path.join(tmpDir, "read-models/candidates/items", `${FIXTURE_CANDIDATE_ID}.json`),
      "utf8"
    );

    await store.initialize();
    const second = await readFile(
      path.join(tmpDir, "read-models/candidates/items", `${FIXTURE_CANDIDATE_ID}.json`),
      "utf8"
    );

    expect(second).toEqual(first);
  });

  it("rebuilds projections from authoritative item files", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();
    const after = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(after).toEqual(before);
    expect(after?.fixture_notice.mode).toEqual("fixture_convenience_mode");
    expect(after?.evaluation.run.status).toEqual("created");
    expect(after?.evaluation.run.authority_status).toEqual("not_counted");
    expect(after?.evaluation.sealing_decision.authority_status).toEqual("not_counted");
  });

  it("treats store ids as file names instead of path segments", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await writeFile(
      path.join(tmpDir, "read-models/candidates/outside.json"),
      `${JSON.stringify({ record_kind: "path_traversal_sentinel" }, null, 2)}\n`,
      "utf8"
    );

    await expect(store.getCandidate("../outside")).resolves.toBeUndefined();
    await expect(store.getCandidate(FIXTURE_CANDIDATE_ID)).resolves.toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID
    });
  });

  it("seeds a Binance BTCUSDT order-fill substrate surface into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const latest = await store.getLatestOrderFillSurface({
      ...BINANCE_BTCUSDT_QUERY
    });
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const item = await readStoreJson<OrderFillSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-order-fill-surface-001.json"
    );

    expect(item.record_kind).toBe("order_fill_surface");
    expect(latest).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation({
      surface_family: "order_fill",
      surface_label: "Binance BTCUSDT order_fill",
      posture: "partially_filled",
      raw_upstream_status: "PARTIALLY_FILLED",
      raw_upstream_execution_type: "TRADE",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_live_connector"
    }));
    expect(candidate?.trading_substrate?.latest_order_fill_surface).toEqual(latest);
  });

  it("seeds a Binance BTCUSDT public market and liveness surface into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const latest = await store.getLatestPublicMarketLivenessSurface({
      ...BINANCE_BTCUSDT_QUERY
    });
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const item = await readStoreJson<PublicMarketLivenessSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-public-market-liveness-surface-001.json"
    );

    expect(item.record_kind).toBe("public_market_liveness_surface");
    expect(latest).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation({
      surface_family: "public_market_liveness",
      surface_label: "Binance BTCUSDT public_market_liveness",
      symbol_status: "TRADING",
      contract_type: "PERPETUAL",
      price_tick_size: "0.10",
      quantity_step_size: "0.001",
      min_quantity: "0.001",
      min_notional: "100",
      mark_price: "65000.12340000",
      index_price: "64995.00000000",
      funding_rate: "0.00010000",
      next_funding_time: "2026-05-16T08:00:00.000Z",
      server_time: "2026-05-16T00:00:01.000Z",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_live_connector"
    }));
    expect(candidate?.trading_substrate?.latest_public_market_liveness_surface).toEqual(latest);
  });

  it("seeds a Binance BTCUSDT private-readiness preflight surface into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const latest = await store.getLatestPrivateReadinessPreflightSurface({
      ...BINANCE_BTCUSDT_QUERY
    });
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const item = await readStoreJson<PrivateReadinessPreflightSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-private-readiness-preflight-surface-001.json"
    );

    expect(item.record_kind).toBe("private_readiness_preflight_surface");
    expect(latest).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation({
      surface_family: "private_readiness_preflight",
      surface_label: "Binance BTCUSDT private_readiness_preflight",
      credential_gate: {
        status: "not_configured",
        enabled: false,
        reason: "no_binance_api_key_configured"
      },
      jurisdiction_gate: {
        status: "not_evaluated",
        enabled: false
      },
      operator_approval_gate: {
        status: "not_approved",
        enabled: false
      },
      private_account_read_gate: {
        status: "disabled",
        enabled: false
      },
      private_position_read_gate: {
        status: "disabled",
        enabled: false
      },
      user_data_stream_gate: {
        status: "disabled",
        enabled: false
      },
      listen_key_gate: {
        status: "disabled",
        enabled: false
      },
      order_submission_gate: {
        status: "disabled",
        enabled: false
      },
      leverage_or_margin_mutation_gate: {
        status: "disabled",
        enabled: false
      },
      account_information_endpoint: "GET /fapi/v3/account",
      user_data_stream_endpoint: "POST /fapi/v1/listenKey",
      order_endpoint: "POST /fapi/v1/order",
      next_blocked_action: "configure_private_read_credentials",
      next_blocked_reason: "credential_and_operator_gates_not_ready",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_private_authority"
    }));
    expect(candidate?.trading_substrate?.latest_private_readiness_preflight_surface).toEqual(latest);
    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision).toMatchObject({
      ...binancePrivateReadinessPolicyDecisionNoAuthorityExpectation([
        "configuration_not_ready",
        "operator_approval_missing",
        "jurisdiction_review_required",
        "live_binding_not_ready",
        "secret_handling_not_ready",
        "account_position_freshness_not_ready",
        "listen_key_not_ready",
        "user_data_stream_not_ready",
        "no_private_read_performed"
      ]),
      status: "not_ready",
      binance_security_types: [...BINANCE_PRIVATE_READINESS_SECURITY_TYPES],
      reason_codes: expect.arrayContaining([
        "configuration_not_ready",
        "operator_approval_missing",
        "jurisdiction_review_required",
        "live_binding_not_ready",
        "secret_handling_not_ready",
        "account_position_freshness_not_ready",
        "listen_key_not_ready",
        "user_data_stream_not_ready",
        "no_private_read_performed"
      ])
    });
    expect(candidate?.trading_substrate?.latest_private_read_gate_decision).toMatchObject({
      decision_kind: "private_read_gate_decision",
      status: "not_ready",
      policy_status: "not_ready",
      credential_reference_status: "not_configured",
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      leverage_margin_mutation_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_result_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      binance_security_types: [...BINANCE_PRIVATE_READINESS_SECURITY_TYPES],
      reason_codes: expect.arrayContaining([
        "private_read_gate_not_ready",
        "no_private_read_performed"
      ]),
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(candidate?.trading_substrate?.latest_trading_gateway_contract).toMatchObject({
      contract_kind: "trading_gateway_contract",
      gateway_name: "TradingGateway",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      product_category: "perpetual_futures",
      sandbox_direct_exchange_access: false,
      gateway_required_for: ["USER_DATA", "TRADE"],
      tracking_chain: ["order_request", "gateway_result", "execution_result"],
      market_data: {
        security_type: "MARKET_DATA",
        status: "enabled",
        source: "public_market_liveness_surface",
        authority_status: "not_live"
      },
      account_read: {
        security_type: "USER_DATA",
        status: "disabled",
        endpoint_labels: ["GET /fapi/v3/account", "GET /fapi/v3/positionRisk"],
        authority_status: "not_granted",
        gateway_required: true
      },
      order_submission: {
        security_type: "TRADE",
        status: "disabled",
        endpoint_labels: ["POST /fapi/v1/order"],
        authority_status: "not_granted",
        gateway_required: true
      },
      no_authority: {
        raw_secret_material_present: false,
        no_private_read_performed: true,
        signed_request_authority: false,
        live_exchange_authority: false
      },
      authority_status: "not_live"
    });
  });

  it("seeds a Binance BTCUSDT private-readiness posture into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const latest = await store.getLatestPrivateReadinessPosture({
      ...BINANCE_BTCUSDT_QUERY
    });
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const item = await readStoreJson<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      "items",
      "fixture-binance-btcusdt-private-readiness-posture-001.json"
    );

    expect(item.record_kind).toBe("private_readiness_posture");
    expect(latest).toMatchObject(binancePrivateReadinessPostureNoAuthorityExpectation({
      posture_id: "fixture-binance-btcusdt-private-readiness-posture-001",
      operator_approval_gate: {
        status: "not_ready",
        reason: "operator_live_private_read_approval_missing"
      },
      jurisdiction_risk_gate: {
        status: "review_required",
        reason: "operator_jurisdiction_not_recorded"
      },
      live_binding_gate: {
        status: "not_ready",
        reason: "live_binding_profile_not_configured"
      },
      secret_handling_gate: {
        status: "not_ready",
        reason: "secret_handling_profile_not_configured"
      },
      stop_behavior_gate: {
        status: "not_ready",
        reason: "operator_stop_behavior_not_recorded"
      },
      secret_reference_configured: false,
      raw_secret_material_present: false,
      source_kind: "fixture"
    }));
    expect(candidate?.trading_substrate?.latest_private_readiness_posture).toEqual(latest);
    expect(candidate?.trading_substrate?.private_readiness_posture_history).toEqual([latest]);
    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision?.checked_gates)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          dimension: "live_binding",
          reason: "live_binding_profile_not_configured"
        }),
        expect.objectContaining({
          dimension: "secret_handling",
          reason: "secret_handling_profile_not_configured"
        }),
        expect.objectContaining({
          dimension: "stop_behavior",
          reason: "operator_stop_behavior_not_recorded"
        })
      ]));
  });

  it("feeds private-readiness policy decisions from the latest stored posture", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const seeded = await readStoreJson<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      "items",
      "fixture-binance-btcusdt-private-readiness-posture-001.json"
    );
    const liveBindingGate = privateReadinessPolicyGate(
      "blocked",
      "operator_live_binding_blocked_for_test"
    );
    const operatorApprovalGate = privateReadinessPolicyGate(
      "blocked",
      "operator_approval_posture_blocked_for_test"
    );
    const jurisdictionRiskGate = privateReadinessPolicyGate(
      "review_required",
      "jurisdiction_risk_posture_review_for_test"
    );
    const secretReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );

    await store.recordPrivateReadinessPosture({
      ...seeded,
      private_readiness_posture_id: "local-binance-btcusdt-private-readiness-posture-002",
      operator_approval_gate: operatorApprovalGate,
      jurisdiction_risk_gate: jurisdictionRiskGate,
      live_binding_gate: liveBindingGate,
      source_kind: "local_config",
      source_ref: {
        record_kind: "local_private_readiness_posture",
        id: "local-binance-btcusdt-private-readiness-posture-002"
      },
      secret_reference_configured: true,
      secret_reference_ref: secretReference,
      raw_secret_material_present: false,
      fixture_backed: false,
      observed_at: "2026-05-16T00:00:05.000Z",
      updated_at: "2026-05-16T00:00:05.000Z"
    });

    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(candidate?.trading_substrate?.latest_private_readiness_posture).toMatchObject({
      posture_id: "local-binance-btcusdt-private-readiness-posture-002",
      operator_approval_gate: operatorApprovalGate,
      jurisdiction_risk_gate: jurisdictionRiskGate,
      live_binding_gate: liveBindingGate,
      source_kind: "local_config",
      secret_reference_configured: true,
      secret_reference_ref: secretReference,
      raw_secret_material_present: false,
      fixture_backed: false
    });
    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision).toMatchObject({
      status: "blocked",
      evaluated_at: "2026-05-16T00:00:05.000Z",
      reason_codes: expect.arrayContaining([
        "operator_approval_blocked",
        "jurisdiction_review_required",
        "live_binding_blocked"
      ]),
      blocking_conditions: expect.arrayContaining([
        "operator_approval: operator_approval_posture_blocked_for_test",
        "jurisdiction_risk: jurisdiction_risk_posture_review_for_test",
        "live_binding: operator_live_binding_blocked_for_test"
      ])
    });
    expect(candidate?.trading_substrate?.latest_private_read_gate_decision).toMatchObject({
      credential_reference_status: "reference_only",
      credential_reference_source: "private_readiness_posture",
      credential_reference_ref: secretReference,
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_result_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
  });

  it("projects USER_DATA signed-read permission preflight without granting private authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const seededPreflight = await readStoreJson<PrivateReadinessPreflightSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-private-readiness-preflight-surface-001.json"
    );
    const seededAccount = await readStoreJson<AccountPositionRiskMirrorSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-account-position-risk-mirror-surface-001.json"
    );
    const seededPosture = await readStoreJson<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      "items",
      "fixture-binance-btcusdt-private-readiness-posture-001.json"
    );
    const secretReference = ref(
      "secret_reference",
      "local-binance-btcusdt-user-data-read-reference"
    );
    const { degraded_reason: _accountDegradedReason, ...accountWithoutDegradedReason } =
      seededAccount;

    await store.recordPrivateReadinessPreflightSurface({
      ...seededPreflight,
      private_readiness_preflight_surface_id:
        "local-binance-btcusdt-private-readiness-preflight-signed-read-preflight",
      credential_gate: privateReadinessGate(
        "ready",
        true,
        "secret_reference_configured_without_values"
      ),
      jurisdiction_gate: privateReadinessGate(
        "ready",
        true,
        "operator_jurisdiction_recorded"
      ),
      operator_approval_gate: privateReadinessGate(
        "ready",
        true,
        "operator_signed_read_preflight_recorded"
      ),
      private_account_read_gate: privateReadinessGate(
        "ready",
        true,
        "USER_DATA_account_read_preflight_only"
      ),
      private_position_read_gate: privateReadinessGate(
        "ready",
        true,
        "USER_DATA_position_read_preflight_only"
      ),
      user_data_stream_gate: privateReadinessGate(
        "ready",
        true,
        "USER_STREAM_preflight_only_no_connection"
      ),
      listen_key_gate: privateReadinessGate(
        "ready",
        true,
        "listen_key_preflight_only_no_creation"
      ),
      next_blocked_action: "grant_signed_read_authority_before_private_user_data_reads",
      next_blocked_reason: "signed_read_permission_preflight_only",
      source_kind: "local_config",
      source_ref: ref(
        "local_private_readiness_preflight",
        "local-binance-btcusdt-private-readiness-preflight-signed-read-preflight"
      ),
      fixture_backed: false,
      source_timestamp: "2026-05-16T00:00:06.000Z",
      observed_at: "2026-05-16T00:00:06.000Z",
      updated_at: "2026-05-16T00:00:06.000Z"
    });
    await store.recordAccountPositionRiskMirrorSurface({
      ...accountWithoutDegradedReason,
      account_position_risk_mirror_surface_id:
        "local-binance-btcusdt-account-position-risk-mirror-signed-read-preflight",
      risk_status: "nominal",
      freshness: "fresh",
      liveness: "connected",
      next_blocked_action: "none",
      next_blocked_reason: "account_position_snapshot_preflight_only",
      source_kind: "local_config",
      source_ref: ref(
        "local_account_position_snapshot",
        "local-binance-btcusdt-account-position-risk-mirror-signed-read-preflight"
      ),
      fixture_backed: false,
      source_timestamp: "2026-05-16T00:00:07.000Z",
      observed_at: "2026-05-16T00:00:07.000Z",
      updated_at: "2026-05-16T00:00:07.000Z"
    });
    await store.recordPrivateReadinessPosture({
      ...seededPosture,
      private_readiness_posture_id:
        "local-binance-btcusdt-private-readiness-posture-signed-read-preflight",
      operator_approval_gate: privateReadinessPolicyGate(
        "ready",
        "operator_signed_read_preflight_recorded"
      ),
      jurisdiction_risk_gate: privateReadinessPolicyGate(
        "ready",
        "operator_jurisdiction_recorded"
      ),
      live_binding_gate: privateReadinessPolicyGate(
        "ready",
        "operator_bound_private_read_profile_recorded"
      ),
      secret_handling_gate: privateReadinessPolicyGate(
        "ready",
        "secret_reference_recorded_without_values"
      ),
      stop_behavior_gate: privateReadinessPolicyGate(
        "ready",
        "kill_switch_and_runtime_pause_semantics_recorded"
      ),
      secret_reference_configured: true,
      secret_reference_ref: secretReference,
      raw_secret_material_present: false,
      source_kind: "local_config",
      source_ref: ref(
        "local_private_readiness_posture",
        "local-binance-btcusdt-private-readiness-posture-signed-read-preflight"
      ),
      fixture_backed: false,
      source_timestamp: "2026-05-16T00:00:08.000Z",
      observed_at: "2026-05-16T00:00:08.000Z",
      updated_at: "2026-05-16T00:00:08.000Z"
    });

    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision)
      .toMatchObject({
        status: "ready",
        evaluated_at: "2026-05-16T00:00:08.000Z"
      });
    expect(candidate?.trading_substrate?.latest_private_read_gate_decision).toMatchObject({
      status: "ready_but_disabled",
      credential_reference_status: "reference_only",
      credential_reference_source: "private_readiness_posture",
      credential_reference_ref: secretReference,
      signed_read_permission_preflight_status: "preflight_only",
      signed_read_permission_preflight_source: "policy_decision",
      signed_request_construction_boundary_status: "dry_run_only",
      signed_request_construction_boundary_source: "policy_decision",
      signed_request_construction_required_components: [
        "API key",
        "timestamp",
        "recvWindow",
        "query string",
        "signature",
        "signed endpoint"
      ],
      signed_read_permission_grant_boundary_status: "decision_only",
      signed_read_permission_grant_boundary_source: "policy_decision",
      signed_request_execution_boundary_status: "decision_only",
      signed_request_execution_boundary_source: "policy_decision",
      account_balance_position_read_boundary_status: "decision_only",
      account_balance_position_read_boundary_source: "policy_decision",
      signed_read_permission: "not_granted",
      account_balance_position_read_authority: "not_granted",
      listen_key_user_data_stream_authority: "not_granted",
      leverage_margin_mutation_authority: "not_granted",
      order_submission_authority: "not_granted",
      gateway_result_authority: "not_granted",
      evidence_sealing_authority: "not_counted",
      promotion_authority: "not_granted",
      raw_secret_material_present: false,
      no_private_read_performed: true,
      signed_request_authority: false,
      live_exchange_authority: false,
      authority_status: "not_live"
    });
    expect(candidate?.trading_substrate?.latest_private_read_gate_decision?.reason_codes)
      .toEqual(expect.arrayContaining([
        "account_balance_position_read_boundary_only",
        "no_private_read_performed"
      ]));
  });

  it("records local private-readiness posture writes idempotently without private authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const input = {
      idempotency_key: "local-posture-write-test-001",
      operator_approval_gate: privateReadinessPolicyGate(
        "not_ready",
        "operator_approval_recorded_without_live_private_read"
      ),
      jurisdiction_risk_gate: privateReadinessPolicyGate(
        "review_required",
        "jurisdiction_risk_review_recorded_without_live_private_read"
      ),
      live_binding_gate: privateReadinessPolicyGate(
        "not_ready",
        "live_binding_profile_not_configured"
      ),
      secret_handling_gate: privateReadinessPolicyGate(
        "not_ready",
        "secret_reference_recorded_without_secret_material"
      ),
      stop_behavior_gate: privateReadinessPolicyGate(
        "not_ready",
        "operator_stop_behavior_not_recorded"
      ),
      secret_reference_configured: false,
      observed_at: "2026-05-16T00:00:07.000Z"
    };

    const first = await store.recordLocalPrivateReadinessPosture(input);
    const duplicate = await store.recordLocalPrivateReadinessPosture(input);
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(duplicate).toEqual(first);
    expect(first).toMatchObject(binancePrivateReadinessPostureNoAuthorityExpectation({
      posture_id: expect.stringContaining("local-binance-btcusdt-private-readiness-posture-"),
      source_kind: "local_config",
      fixture_backed: false,
      simulated: true,
      raw_secret_material_present: false,
      operator_approval_gate: input.operator_approval_gate,
      jurisdiction_risk_gate: input.jurisdiction_risk_gate,
      secret_handling_gate: input.secret_handling_gate,
      authority_status: "not_live"
    }));
    expect(candidate?.trading_substrate?.latest_private_readiness_posture).toEqual(first);
    expect(candidate?.trading_substrate?.private_readiness_posture_history?.at(0)).toEqual(first);
    expect(candidate?.trading_substrate?.private_readiness_posture_history?.at(1)).toMatchObject({
      posture_id: "fixture-binance-btcusdt-private-readiness-posture-001",
      source_kind: "fixture",
      authority_status: "not_live"
    });
    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision)
      .toMatchObject({
        status: "not_ready",
        reason_codes: expect.arrayContaining([
          "operator_approval_missing",
          "jurisdiction_review_required",
          "secret_handling_not_ready",
          "no_private_read_performed"
        ]),
        signed_request_authority: false,
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      });
    expect(JSON.stringify(first)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
  });

  it("projects private-readiness posture history newest first without private authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const baseInput = {
      operator_approval_gate: privateReadinessPolicyGate(
        "not_ready",
        "operator_approval_recorded_without_live_private_read"
      ),
      jurisdiction_risk_gate: privateReadinessPolicyGate(
        "review_required",
        "jurisdiction_risk_review_recorded_without_live_private_read"
      ),
      live_binding_gate: privateReadinessPolicyGate(
        "not_ready",
        "live_binding_profile_not_configured"
      ),
      secret_handling_gate: privateReadinessPolicyGate(
        "not_ready",
        "secret_reference_recorded_without_secret_material"
      ),
      stop_behavior_gate: privateReadinessPolicyGate(
        "not_ready",
        "operator_stop_behavior_not_recorded"
      ),
      secret_reference_configured: false
    };

    const first = await store.recordLocalPrivateReadinessPosture({
      ...baseInput,
      idempotency_key: "local-posture-history-test-001",
      observed_at: "2026-05-16T00:00:07.000Z"
    });
    const second = await store.recordLocalPrivateReadinessPosture({
      ...baseInput,
      idempotency_key: "local-posture-history-test-002",
      operator_approval_gate: privateReadinessPolicyGate(
        "ready",
        "operator_approval_recorded_in_local_history_test"
      ),
      observed_at: "2026-05-16T00:00:08.000Z"
    });

    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const history = candidate?.trading_substrate?.private_readiness_posture_history ?? [];

    expect(history.map((posture) => posture.posture_id)).toEqual([
      second.posture_id,
      first.posture_id,
      "fixture-binance-btcusdt-private-readiness-posture-001"
    ]);
    expect(history.map((posture) => posture.source_kind)).toEqual([
      "local_config",
      "local_config",
      "fixture"
    ]);
    expect(history.every((posture) => posture.authority_status === "not_live")).toBe(true);
    expect(JSON.stringify(history)).not.toMatch(
      /exchange_credentials|provider_api_key|apiKey|secretKey|signature|direct_exchange_order/
    );
  });

  it("keeps S40 posture records readable with default approval and jurisdiction gates", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const seeded = await readStoreJson<PrivateReadinessPostureRecord>(
      "private-readiness-postures",
      "items",
      "fixture-binance-btcusdt-private-readiness-posture-001.json"
    );
    const legacyPosture = {
      ...seeded,
      private_readiness_posture_id: "legacy-binance-btcusdt-private-readiness-posture-s40",
      observed_at: "2026-05-16T00:00:06.000Z",
      updated_at: "2026-05-16T00:00:06.000Z"
    };
    delete (legacyPosture as Partial<PrivateReadinessPostureRecord>).operator_approval_gate;
    delete (legacyPosture as Partial<PrivateReadinessPostureRecord>).jurisdiction_risk_gate;

    await writeStoreJson(
      legacyPosture,
      "private-readiness-postures",
      "items",
      "legacy-binance-btcusdt-private-readiness-posture-s40.json"
    );
    await store.rebuildProjections();

    const latest = await store.getLatestPrivateReadinessPosture(BINANCE_BTCUSDT_QUERY);
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(latest).toMatchObject(binancePrivateReadinessPostureNoAuthorityExpectation({
      posture_id: "legacy-binance-btcusdt-private-readiness-posture-s40",
      operator_approval_gate: {
        status: "not_ready",
        reason: "operator_live_private_read_approval_missing"
      },
      jurisdiction_risk_gate: {
        status: "review_required",
        reason: "operator_jurisdiction_not_recorded"
      }
    }));
    expect(candidate?.trading_substrate?.latest_private_readiness_policy_decision)
      .toMatchObject({
        reason_codes: expect.arrayContaining([
          "operator_approval_missing",
          "jurisdiction_review_required"
        ]),
        blocking_conditions: expect.arrayContaining([
          "operator_approval: operator_live_private_read_approval_missing",
          "jurisdiction_risk: operator_jurisdiction_not_recorded"
        ])
      });
  });

  it("seeds a Binance BTCUSDT account-position-risk mirror surface into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const latest = await store.getLatestAccountPositionRiskMirrorSurface({
      ...BINANCE_BTCUSDT_QUERY
    });
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    const item = await readStoreJson<AccountPositionRiskMirrorSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-account-position-risk-mirror-surface-001.json"
    );

    expect(item.record_kind).toBe("account_position_risk_mirror_surface");
    expect(latest).toMatchObject(binanceBtcusdtNoAuthoritySurfaceExpectation({
      surface_family: "account_position_risk_mirror",
      surface_label: "Binance BTCUSDT account_position_risk_mirror",
      account_scope_ref: "fixture-binance-usdt-account-mirror",
      asset: "USDT",
      account_mode: "single_asset",
      total_wallet_balance: "1250.00000000",
      total_unrealized_profit: "12.50000000",
      total_margin_balance: "1262.50000000",
      available_balance: "1100.00000000",
      max_withdraw_amount: "1100.00000000",
      total_initial_margin: "162.50000000",
      total_maint_margin: "35.00000000",
      position_side: "BOTH",
      position_amount: "0.015",
      entry_price: "65000.00000000",
      break_even_price: "65010.00000000",
      mark_price: "65833.33333333",
      unrealized_profit: "12.50000000",
      liquidation_price: "42000.00000000",
      notional: "987.50000000",
      margin_asset: "USDT",
      margin_type: "cross",
      leverage: 5,
      initial_margin: "150.00000000",
      maint_margin: "35.00000000",
      adl_quantile: 2,
      risk_status: "watch",
      kill_switch_status: "inactive",
      runtime_pause_status: "not_paused",
      account_information_endpoint: "GET /fapi/v3/account",
      position_information_endpoint: "GET /fapi/v3/positionRisk",
      leverage_endpoint: "POST /fapi/v1/leverage",
      margin_type_endpoint: "POST /fapi/v1/marginType",
      next_blocked_action: "configure_private_read_credentials",
      next_blocked_reason: "mirror_is_fixture_backed_no_signed_user_data_read",
      freshness: "stale",
      liveness: "degraded",
      degraded_reason: "fixture_seed_no_private_account_or_position_read"
    }));
    expect(candidate?.trading_substrate?.latest_account_position_risk_mirror_surface).toEqual(latest);
  });

  it("seeds a durable stage binding for fixture evaluation records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      "fixture-evaluation-run-001.json"
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${evaluationRun.stage_binding_ref.id}.json`
    );

    expect(stageBinding.record_kind).toBe("stage_binding");
    expect(stageBinding.candidate_ref.id).toBe(evaluationRun.candidate_ref.id);
    expect(stageBinding.candidate_version_ref.id).toBe(evaluationRun.candidate_version_ref.id);
    expect(stageBinding.stage).toBe("backtest");
    expect(stageBinding.authority_status).toBe("not_live");
  });

  it("lists candidate summaries from projections", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expect(store.listCandidates()).resolves.toMatchObject([
      {
        candidate_id: FIXTURE_CANDIDATE_ID,
        status: "fixture_only"
      }
    ]);
  });

  it("materializes a provider-shaped candidate and rebuilds it from authoritative item files", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await store.materializeCandidate(validMaterializationInput());

    expect(outcome.status).toBe("materialized");
    if (outcome.status !== "materialized") {
      throw new Error("expected materialized outcome");
    }
    expect(outcome.candidate.status).toBe("materialized");
    expect(outcome.candidate.display_name).toBe("generic market Perp Breakout Candidate");
    expect(outcome.candidate.materialization_attempt?.provider_kind).toBe("codex_cli");
    expect(outcome.candidate.materialization_attempt?.authority_label).toBe("provider_output_not_evidence");

    expect(outcome.candidate.evaluation.comparison_set.ref.id).not.toBe("fixture-evaluation-comparison-set-001");
    expect(outcome.candidate.evaluation.sealing_decision.ref.id).not.toBe("fixture-evidence-sealing-decision-001");

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(outcome.candidate.candidate_id);
    expect(reloaded?.materialization_attempt?.attempt_id).toBe(outcome.attempt.attempt_id);
    expect(reloaded?.evaluation.run.status).toBe("created");
    expect(reloaded?.evaluation.run.authority_status).toBe("not_counted");
    expect(reloaded?.evaluation.sealing_decision.authority_status).toBe("not_counted");
    expect(reloaded?.evaluation.comparison_set.ref.id).toBe(outcome.candidate.evaluation.comparison_set.ref.id);
    expect(reloaded?.evaluation.sealing_decision.ref.id).toBe(outcome.candidate.evaluation.sealing_decision.ref.id);

    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      `${outcome.candidate.evaluation.run.ref.id}.json`
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${evaluationRun.stage_binding_ref.id}.json`
    );
    expect(stageBinding.candidate_ref.id).toBe(outcome.candidate.candidate_id);
    expect(stageBinding.candidate_version_ref.id).toBe(outcome.candidate.candidate_version.candidate_version_id);
    expect(stageBinding.execution_mode).toBe("host_local");
  });

  it("creates and reloads evaluation run records for an existing active candidate version", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id);
    const outcome = await store.createEvaluationRunForCandidate(input);
    const repeated = await store.createEvaluationRunForCandidate(input);

    expect(repeated).toEqual(outcome);
    expect(outcome.candidate_id).toBe(FIXTURE_CANDIDATE_ID);
    expect(outcome.candidate_version_id).toBe(candidate.candidate_version.candidate_version_id);
    expect(outcome.stage_binding).toMatchObject({
      record_kind: "stage_binding",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      authority_status: "not_live"
    });
    expect(outcome.evaluation_run).toMatchObject({
      record_kind: "evaluation_run_record",
      status: "created",
      authority_status: "not_counted",
      trace_ref: input.trace_ref,
      evaluator_ref: input.evaluator_ref
    });
    expect(outcome.comparison_set.evaluation_run_refs).toEqual([
      { record_kind: "evaluation_run_record", id: outcome.evaluation_run.evaluation_run_record_id }
    ]);
    expect(outcome.sealing_decision).toMatchObject({
      evidence_disposition: "not_counted",
      authority_status: "not_counted",
      disposition_reason: "provider_output_trace_only"
    });
    expect(outcome.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification_kind: "trace_debug_material",
          classification_status: "trace_only",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "candidate_evidence",
          classification_status: "candidate",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "sealed_decision",
          classification_status: "sealed",
          authority_status: "not_counted"
        })
      ])
    );

    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${outcome.stage_binding.stage_binding_id}.json`
    );
    const evaluationRun = await readStoreJson<EvaluationRunRecord>(
      "evaluation-runs",
      "items",
      `${outcome.evaluation_run.evaluation_run_record_id}.json`
    );
    const comparisonSet = await readStoreJson<EvaluationComparisonSetRecord>(
      "evaluation-comparison-sets",
      "items",
      `${outcome.comparison_set.evaluation_comparison_set_id}.json`
    );
    const sealingDecision = await readStoreJson<EvidenceSealingDecisionRecord>(
      "evidence-sealing-decisions",
      "items",
      `${outcome.sealing_decision.evidence_sealing_decision_id}.json`
    );
    const classification = await readStoreJson<EvidenceClassificationRecord>(
      "evidence-classifications",
      "items",
      `${outcome.evidence_classifications[0]?.evidence_classification_id}.json`
    );

    expect(stageBinding.stage_binding_id).not.toBe(evaluationRun.evaluation_run_record_id);
    expect(comparisonSet.evaluation_comparison_set_id).not.toBe(sealingDecision.evidence_sealing_decision_id);
    expect(classification.record_kind).toBe("evidence_classification");
    expect(evaluationRun.stage_binding_ref).toEqual({
      record_kind: "stage_binding",
      id: stageBinding.stage_binding_id
    });
    expect(sealingDecision.evaluation_comparison_set_ref).toEqual({
      record_kind: "evaluation_comparison_set",
      id: comparisonSet.evaluation_comparison_set_id
    });

    const reloadedStore = new LocalStore(tmpDir);
    const reloaded = await reloadedStore.getCandidateEvaluationRun(
      outcome.evaluation_run.evaluation_run_record_id
    );
    expect(reloaded).toEqual(outcome);

    const replayRuns = await reloadedStore.listCandidateEvaluationRuns(FIXTURE_CANDIDATE_ID);
    expect(replayRuns.map((run) => run.evaluation_run.evaluation_run_record_id)).toContain(
      outcome.evaluation_run.evaluation_run_record_id
    );
    expect(replayRuns.every((run) => run.candidate_id === FIXTURE_CANDIDATE_ID)).toBe(true);
  });

  it("projects the latest stage-bound evaluation summary into candidate inspect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-latest-summary",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-latest-summary" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.has_runs).toBe(true);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: outcome.evaluation_run.evaluation_run_record_id,
      status: "created",
      stage: "backtest",
      profile: "backtest",
      execution_mode: "host_local",
      trace_ref: input.trace_ref,
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.latest_comparison_set).toMatchObject({
      comparison_set_id: outcome.comparison_set.evaluation_comparison_set_id,
      comparability_status: "not_evaluated",
      comparability_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.latest_sealing_decision).toMatchObject({
      sealing_decision_id: outcome.sealing_decision.evidence_sealing_decision_id,
      evidence_disposition: "not_counted",
      disposition_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification_kind: "trace_debug_material",
          classification_reason: "provider_output_trace_only"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted"
        })
      ])
    );
    expect(projected?.evaluation.run.ref.id).toBe(outcome.evaluation_run.evaluation_run_record_id);

    const evaluationReadModel = await readStoreJson(
      "read-models",
      "candidate-evaluations",
      "items",
      `${FIXTURE_CANDIDATE_ID}.json`
    );
    expect(evaluationReadModel).toMatchObject({
      has_runs: true,
      latest_run: {
        run_id: outcome.evaluation_run.evaluation_run_record_id,
        stage: "backtest"
      }
    });
  });

  it("selects latest evaluation run by creation recency, not completion time", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const olderOutcome = await store.createEvaluationRunForCandidate(
      validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
        idempotency_key: "evaluation-run-older-completes-late"
      })
    );
    const newerOutcome = await store.createEvaluationRunForCandidate(
      validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
        idempotency_key: "evaluation-run-newer-created-latest"
      })
    );

    await writeStoreJson(
      {
        ...olderOutcome.evaluation_run,
        created_at: "2026-05-07T00:00:00.000Z",
        completed_at: "2026-05-09T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${olderOutcome.evaluation_run.evaluation_run_record_id}.json`
    );
    await writeStoreJson(
      {
        ...newerOutcome.evaluation_run,
        created_at: "2026-05-08T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${newerOutcome.evaluation_run.evaluation_run_record_id}.json`
    );

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: newerOutcome.evaluation_run.evaluation_run_record_id,
      created_at: "2026-05-08T00:00:00.000Z"
    });
  });

  it("keeps trace/debug material distinct from counted evidence in candidate inspect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-trace-evidence-split",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-trace-evidence-split" }
    });
    await store.createEvaluationRunForCandidate(input);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.trace).toMatchObject({
      state: "linked",
      trace_ref: input.trace_ref,
      authority_label: "provider_output_not_evidence",
      authority_status: "not_counted",
      provider_output_artifact_refs: input.provider_output_artifact_refs,
      debug_artifact_refs: input.debug_artifact_refs
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "not_counted",
      disposition_reason: "provider_output_trace_only",
      authority_status: "not_counted"
    });
    expect(projected?.evaluation.counted_evidence).not.toHaveProperty("provider_output_artifact_refs");
    expect(projected?.evaluation.counted_evidence).not.toHaveProperty("debug_artifact_refs");
    expect(projected?.evaluation.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: input.trace_ref,
          classification_kind: "trace_debug_material",
          classification_status: "trace_only",
          authority_status: "not_counted"
        }),
        expect.objectContaining({
          classification_kind: "non_counted_evidence",
          classification_status: "not_counted",
          authority_status: "not_counted"
        })
      ])
    );
  });

  it("seals counted fixture evidence only through an explicit deterministic decision", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-explicit-counted-fixture",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-explicit-counted-fixture" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);
    const countedEvidenceRef = { record_kind: "fixture_evidence", id: "sealed-backtest-summary-001" };

    const sealed = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-counted-fixture",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      classified_refs: [countedEvidenceRef],
      sealed_at: "2026-05-08T00:00:00.000Z"
    });
    const repeated = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-counted-fixture",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      classified_refs: [countedEvidenceRef],
      sealed_at: "2026-05-08T00:00:00.000Z"
    });

    expect(repeated).toEqual(sealed);
    expect(sealed.sealing_decision).toMatchObject({
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      sealed_at: "2026-05-08T00:00:00.000Z",
      authority_status: "counted"
    });
    expect(sealed.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: countedEvidenceRef,
          classification_kind: "counted_evidence",
          classification_status: "counted",
          classification_reason: "sealed_counted_fixture_only_allowed_by_test",
          sealed_by_decision_ref: {
            record_kind: "evidence_sealing_decision",
            id: sealed.sealing_decision.evidence_sealing_decision_id
          },
          authority_status: "counted"
        }),
        expect.objectContaining({
          classification_kind: "sealed_decision",
          classification_status: "sealed",
          authority_status: "counted"
        })
      ])
    );

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_sealing_decision).toMatchObject({
      sealing_decision_id: sealed.sealing_decision.evidence_sealing_decision_id,
      evidence_disposition: "counted",
      authority_status: "counted"
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: true,
      evidence_disposition: "counted",
      disposition_reason: "sealed_counted_fixture_only_allowed_by_test",
      authority_status: "counted",
      sealed_at: "2026-05-08T00:00:00.000Z"
    });
  });

  it("records rejected evidence without counting provider output", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-explicit-rejected-provider-output",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-explicit-rejected-provider-output" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);

    const sealed = await store.sealEvaluationRunEvidence({
      idempotency_key: "seal-rejected-provider-output",
      evaluation_run_record_id: outcome.evaluation_run.evaluation_run_record_id,
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      classified_refs: input.provider_output_artifact_refs,
      sealed_at: "2026-05-08T01:00:00.000Z"
    });

    expect(sealed.sealing_decision).toMatchObject({
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    });
    expect(sealed.evidence_classifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classified_ref: input.provider_output_artifact_refs[0],
          classification_kind: "rejected_evidence",
          classification_status: "rejected",
          classification_reason: "method_not_authoritative",
          authority_status: "not_counted"
        })
      ])
    );

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "quarantined_for_review",
      disposition_reason: "method_not_authoritative",
      authority_status: "not_counted"
    });
  });

  it("projects a deterministic no-evaluation state when durable evaluation records are absent", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await rm(path.join(tmpDir, "evaluation-runs", "items"), { recursive: true, force: true });
    await rm(path.join(tmpDir, "evaluation-comparison-sets", "items"), { recursive: true, force: true });
    await rm(path.join(tmpDir, "evidence-sealing-decisions", "items"), { recursive: true, force: true });

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation).toMatchObject({
      has_runs: false,
      latest_run: null,
      latest_comparison_set: null,
      latest_sealing_decision: null,
      trace: {
        state: "none",
        provider_output_artifact_refs: [],
        debug_artifact_refs: [],
        authority_status: "not_counted"
      },
      evidence_classifications: [],
      counted_evidence: {
        counted: false,
        evidence_disposition: "not_counted",
        disposition_reason: "no_evaluation_runs",
        authority_status: "not_counted"
      },
      run: {
        status: "not_evaluated",
        authority_status: "not_counted"
      }
    });
  });

  it("projects failed evaluation runs with a deterministic error state", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id, {
      idempotency_key: "evaluation-run-failed-projection",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-failed-projection" }
    });
    const outcome = await store.createEvaluationRunForCandidate(input);
    await writeStoreJson(
      {
        ...outcome.evaluation_run,
        status: "failed",
        completed_at: "2026-05-07T00:00:00.000Z"
      } satisfies EvaluationRunRecord,
      "evaluation-runs",
      "items",
      `${outcome.evaluation_run.evaluation_run_record_id}.json`
    );

    await store.rebuildProjections();

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.evaluation.latest_run).toMatchObject({
      run_id: outcome.evaluation_run.evaluation_run_record_id,
      status: "failed",
      stage: "backtest",
      error_state: {
        code: "evaluation_failed",
        message: "evaluation run failed"
      }
    });
    expect(projected?.evaluation.counted_evidence).toMatchObject({
      counted: false,
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
  });

  it("records, deduplicates, and projects Ledger records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validLedgerInput(candidate.candidate_version.candidate_version_id);
    const first = await store.recordLedger(input);
    const second = await store.recordLedger(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: candidate.runtime.ref.id,
      order_request: {
        record_kind: "order_request",
        status: "proposed",
        authority_status: "not_submitted"
      },
      gateway_result: {
        record_kind: "gateway_result",
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        authority_status: "dry_run_only"
      },
      execution_result: {
        record_kind: "execution_result",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      }
    });
    expect(first.gateway_result.order_request_ref).toEqual({
      record_kind: "order_request",
      id: first.order_request.order_request_id
    });
    expect(first.execution_result.gateway_result_ref).toEqual({
      record_kind: "gateway_result",
      id: first.gateway_result.gateway_result_id
    });

    const orderIntent = await readStoreJson<OrderRequestRecord>(
      "order-requests",
      "items",
      `${first.order_request.order_request_id}.json`
    );
    const gatewayDecision = await readStoreJson<GatewayResultRecord>(
      "gateway-results",
      "items",
      `${first.gateway_result.gateway_result_id}.json`
    );
    const executionAttempt = await readStoreJson<ExecutionResultRecord>(
      "execution-results",
      "items",
      `${first.execution_result.execution_result_id}.json`
    );
    const stageBinding = await readStoreJson<StageBindingRecord>(
      "stage-bindings",
      "items",
      `${first.order_request.stage_binding_ref.id}.json`
    );
    expect(orderIntent.runtime_ref.id).toBe(candidate.runtime.ref.id);
    expect(stageBinding).toMatchObject({
      stage: "paper",
      profile: "paper",
      execution_mode: "host_local",
      candidate_ref: { id: FIXTURE_CANDIDATE_ID },
      candidate_version_ref: { id: candidate.candidate_version.candidate_version_id }
    });
    expect(gatewayDecision.order_request_ref.id).toBe(orderIntent.order_request_id);
    expect(executionAttempt.gateway_result_ref.id).toBe(gatewayDecision.gateway_result_id);
    await expect(countJsonFiles("stage-bindings", "items")).resolves.toBe(2);
    await expect(countJsonFiles("order-requests", "items")).resolves.toBe(1);
    await expect(countJsonFiles("gateway-results", "items")).resolves.toBe(1);
    await expect(countJsonFiles("execution-results", "items")).resolves.toBe(1);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.ledger).toMatchObject({
      ledger_kind: "ledger",
      has_activity: true,
      chain_complete: true,
      latest_order_request: {
        order_request_id: first.order_request.order_request_id,
        status: "proposed",
        authority_status: "not_submitted"
      },
      latest_gateway_result: {
        gateway_result_id: first.gateway_result.gateway_result_id,
        decision_outcome: "dry_run_only",
        authority_status: "dry_run_only"
      },
      latest_execution_result: {
        execution_result_id: first.execution_result.execution_result_id,
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
      },
      source_record_kinds: ["order_request", "gateway_result", "execution_result"]
    });

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(reloaded?.ledger?.latest_execution_result?.execution_result_id).toBe(
      first.execution_result.execution_result_id
    );
    expect(reloaded?.ledger?.chain_complete).toBe(true);
  });

  it("projects Ledger history for multiple order request chains", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const happyPath = await store.recordLedger({
      ...validLedgerInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "ledger-history-happy",
      created_at: "2026-05-21T00:00:00.000Z"
    });
    const rejectedPath = await store.recordLedger({
      ...validLedgerInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "ledger-history-rejected",
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0",
        limit_price: "60000"
      },
      gateway_result: {
        decision_outcome: "rejected",
        decision_reason: "risk_limit_exceeded"
      },
      execution_result: {
        execution_mode: "host_local",
        status: "blocked",
        result_reason: "risk_limit_exceeded"
      },
      created_at: "2026-05-21T00:00:01.000Z"
    });

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.ledger).toMatchObject({
      chain_count: 2,
      chains: [
        {
          chain_id: rejectedPath.order_request.order_request_id,
          chain_complete: true,
          order_request: {
            order_request_id: rejectedPath.order_request.order_request_id,
            quantity: "0"
          },
          gateway_result: {
            gateway_result_id: rejectedPath.gateway_result.gateway_result_id,
            decision_outcome: "rejected",
            decision_reason: "risk_limit_exceeded"
          },
          execution_result: {
            execution_result_id: rejectedPath.execution_result.execution_result_id,
            status: "blocked",
            result_reason: "risk_limit_exceeded"
          }
        },
        {
          chain_id: happyPath.order_request.order_request_id,
          chain_complete: true,
          order_request: {
            order_request_id: happyPath.order_request.order_request_id,
            quantity: "0.001"
          },
          gateway_result: {
            gateway_result_id: happyPath.gateway_result.gateway_result_id,
            decision_outcome: "dry_run_only",
            decision_reason: "paper_stage_only"
          },
          execution_result: {
            execution_result_id: happyPath.execution_result.execution_result_id,
            status: "dry_run_recorded",
            result_reason: "paper_stage_only"
          }
        }
      ]
    });
    expect(projected?.ledger?.latest_order_request?.order_request_id).toBe(
      rejectedPath.order_request.order_request_id
    );

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(reloaded?.ledger?.chain_count).toBe(2);
    expect(reloaded?.ledger?.chains[0].execution_result?.status).toBe("blocked");
    expect(reloaded?.ledger?.chains[1].execution_result?.status).toBe("dry_run_recorded");
  });

  it("keeps Ledger latest summary on the newest order request when older execution completes later", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const olderPath = await store.recordLedger({
      ...validLedgerInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "ledger-late-older-execution",
      execution_result: {
        ...validLedgerInput(candidate.candidate_version.candidate_version_id).execution_result,
        completed_at: "2026-05-21T00:10:00.000Z"
      },
      created_at: "2026-05-21T00:00:00.000Z"
    });
    const newerPath = await store.recordLedger({
      ...validLedgerInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "ledger-newer-order-request",
      execution_result: {
        ...validLedgerInput(candidate.candidate_version.candidate_version_id).execution_result,
        completed_at: "2026-05-21T00:02:00.000Z"
      },
      created_at: "2026-05-21T00:01:00.000Z"
    });

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.ledger?.chains.map((chain) => chain.chain_id)).toEqual([
      newerPath.order_request.order_request_id,
      olderPath.order_request.order_request_id
    ]);
    expect(projected?.ledger?.latest_order_request?.order_request_id).toBe(
      newerPath.order_request.order_request_id
    );
    expect(projected?.ledger?.latest_gateway_result?.gateway_result_id).toBe(
      newerPath.gateway_result.gateway_result_id
    );
    expect(projected?.ledger?.latest_execution_result?.execution_result_id).toBe(
      newerPath.execution_result.execution_result_id
    );
  });

  it("rejects invalid Ledger writes without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordLedger({
        ...validLedgerInput("fixture-candidate-version-001"),
        candidate_id: ""
      }),
      "invalid_ledger_input"
    );
    await expectStoreError(
      store.recordLedger({
        ...validLedgerInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await writeStoreJson(
      {
        record_kind: "trading_run",
        version: 1,
        trading_run_id: "foreign-runtime-001",
        stage_binding_profile: "paper",
        placement_ref: { record_kind: "sandbox_placement", id: "fixture-sandbox-placement-001" },
        hands_environment_ref: { record_kind: "hands_environment", id: "fixture-hands-environment-001" },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: "fixture-runtime-memory-surface-001" },
        authority_status: "not_live"
      } satisfies TradingRunRecord,
      "trading-runs",
      "items",
      "foreign-runtime-001.json"
    );
    await expectStoreError(
      store.recordLedger({
        ...validLedgerInput("fixture-candidate-version-001"),
        runtime_id: "foreign-runtime-001"
      }),
      "runtime_mismatch"
    );
    await expect(countJsonFiles("order-requests", "items")).resolves.toBe(0);
    await expect(countJsonFiles("gateway-results", "items")).resolves.toBe(0);
    await expect(countJsonFiles("execution-results", "items")).resolves.toBe(0);
  });

  it("records, deduplicates, and projects runtime control audit records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validRunControlAuditInput(candidate.candidate_version.candidate_version_id);
    const first = await store.recordRunControlAudit(input);
    const second = await store.recordRunControlAudit(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: candidate.runtime.ref.id,
      command: {
        record_kind: "run_control_command",
        action: "pause",
        status: "decided",
        authority_status: "control_only"
      },
      decision: {
        record_kind: "run_control_decision",
        decision_outcome: "allowed",
        decision_reason: "policy_allows_control",
        resulting_lifecycle_status: "paused",
        authority_status: "control_only"
      },
      audit_event: {
        record_kind: "runtime_audit_event",
        event_kind: "runtime_lifecycle_transitioned",
        runtime_lifecycle_status: "paused",
        authority_status: "audit_only"
      }
    });

    const command = await readStoreJson<RunControlCommandRecord>(
      "run-control-commands",
      "items",
      `${first.command.run_control_command_id}.json`
    );
    const decision = await readStoreJson<RunControlDecisionRecord>(
      "run-control-decisions",
      "items",
      `${first.decision.run_control_decision_id}.json`
    );
    const auditEvent = await readStoreJson<RuntimeAuditEventRecord>(
      "runtime-audit-events",
      "items",
      `${first.audit_event.runtime_audit_event_id}.json`
    );
    const runtime = await readStoreJson<TradingRunRecord>(
      "trading-runs",
      "items",
      `${candidate.runtime.ref.id}.json`
    );

    expect(command.runtime_ref).toEqual(candidate.runtime.ref);
    expect(command.runtime_ref.id).not.toBe(candidate.runtime.placement.ref.id);
    expect(decision.command_ref).toEqual({
      record_kind: "run_control_command",
      id: command.run_control_command_id
    });
    expect(auditEvent.supporting_record_refs).toEqual([
      { record_kind: "run_control_command", id: command.run_control_command_id },
      { record_kind: "run_control_decision", id: decision.run_control_decision_id }
    ]);
    expect(runtime.runtime_lifecycle_status).toBe("paused");
    expect(runtime.run_control_command_refs).toEqual([
      { record_kind: "run_control_command", id: command.run_control_command_id }
    ]);
    expect(runtime.run_control_decision_refs).toEqual([
      { record_kind: "run_control_decision", id: decision.run_control_decision_id }
    ]);
    expect(runtime.runtime_audit_event_refs).toEqual([
      { record_kind: "runtime_audit_event", id: auditEvent.runtime_audit_event_id }
    ]);
    await expect(countJsonFiles("run-control-commands", "items")).resolves.toBe(1);
    await expect(countJsonFiles("run-control-decisions", "items")).resolves.toBe(1);
    await expect(countJsonFiles("runtime-audit-events", "items")).resolves.toBe(1);

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.runtime.run_control).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_command: {
        command_id: command.run_control_command_id,
        action: "pause",
        status: "decided",
        authority_status: "control_only"
      },
      latest_decision: {
        decision_id: decision.run_control_decision_id,
        decision_outcome: "allowed",
        resulting_lifecycle_status: "paused",
        authority_status: "control_only"
      },
      latest_audit_event: {
        audit_event_id: auditEvent.runtime_audit_event_id,
        event_kind: "runtime_lifecycle_transitioned",
        runtime_lifecycle_status: "paused",
        authority_status: "audit_only"
      }
    });
    expect(projected?.runtime.placement.authority_status).toBe("not_launched");
    expect(JSON.stringify(projected?.runtime.run_control)).not.toMatch(
      /exchange_credentials|provider_api_key|direct_exchange_order|gateway_signing_material/
    );

    await rm(path.join(tmpDir, "read-models"), { recursive: true, force: true });
    await store.rebuildProjections();

    const reloaded = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(reloaded?.runtime.run_control?.latest_command?.command_id).toBe(
      command.run_control_command_id
    );
    expect(reloaded?.runtime.run_control?.chain_complete).toBe(true);
  });

  it("records start and stop lifecycle through Run Control audit records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const startInput = runControlLifecycleInput(
      candidate.candidate_version.candidate_version_id,
      candidate.runtime.ref.id,
      "start",
      "running"
    );
    const firstStart = await store.recordRunControlAudit(startInput);
    const duplicateStart = await store.recordRunControlAudit(startInput);

    expect(duplicateStart).toEqual(firstStart);
    expect(firstStart).toMatchObject({
      command: {
        action: "start",
        requested_lifecycle_status: "running"
      },
      decision: {
        resulting_lifecycle_status: "running"
      },
      audit_event: {
        runtime_lifecycle_status: "running"
      }
    });

    const running = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(running?.runtime.runtime_lifecycle_status).toBe("running");
    expect(running?.runtime.run_control).toBeDefined();
    expect(running?.runtime.run_control?.latest_command?.action).toBe("start");

    const stopInput = runControlLifecycleInput(
      candidate.candidate_version.candidate_version_id,
      candidate.runtime.ref.id,
      "stop",
      "stopped"
    );
    const firstStop = await store.recordRunControlAudit(stopInput);
    const duplicateStop = await store.recordRunControlAudit(stopInput);

    expect(duplicateStop).toEqual(firstStop);
    const stopped = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(stopped?.runtime.runtime_lifecycle_status).toBe("stopped");
    expect(stopped?.runtime.run_control).toBeDefined();
    expect(stopped?.runtime.run_control?.latest_command?.action).toBe("stop");
    expect(stopped?.runtime.transcript).toMatchObject({
      transcript_kind: "trading_run_transcript",
      has_activity: true,
      item_count: 6,
      authority_status: "not_live",
      latest_item: {
        item_kind: "run_control_audit",
        summary: "Trading Run stop recorded.",
        lifecycle_status: "stopped"
      }
    });
    expect(stopped?.runtime.transcript?.items.map((item) => item.item_kind)).toEqual([
      "run_control_command",
      "run_control_decision",
      "run_control_audit",
      "run_control_command",
      "run_control_decision",
      "run_control_audit"
    ]);
    await expect(countJsonFiles("run-control-commands", "items")).resolves.toBe(2);
    await expect(countJsonFiles("run-control-decisions", "items")).resolves.toBe(2);
    await expect(countJsonFiles("runtime-audit-events", "items")).resolves.toBe(2);
  });

  it("projects a linked Sandbox detail into candidate inspect read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate?.system_code?.ref) {
      throw new Error("expected fixture candidate system code");
    }

    const sandboxId = "sandbox-fixture-trading-run-readback";
    const placement: SandboxPlacementRecord = {
      record_kind: "sandbox_placement",
      version: 1,
      sandbox_placement_id: "sandbox-placement-fixture-trading-run-readback",
      placement_kind: "containerized_remote",
      tooling_kind: "docker_sandbox",
      sandbox_template_ref: { record_kind: "sandbox_template", id: "fixture-sandbox-template" },
      authority_status: "not_launched"
    };
    const log: SandboxLogRecord = {
      record_kind: "sandbox_log",
      version: 1,
      sandbox_log_id: "sandbox-log-fixture-trading-run-readback-start",
      sandbox_ref: { record_kind: "sandbox", id: sandboxId },
      lines: [
        "{\"at\":\"2026-05-20T00:00:00.000Z\",\"event\":\"order_request\",\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"order_type\":\"limit\",\"quantity\":\"0.001\",\"limit_price\":\"60000\"}",
        "{\"event\":\"runtime_heartbeat\",\"tick\":1}"
      ],
      captured_at: "2026-05-20T00:00:01.000Z",
      authority_status: "trace_only"
    };
    const heartbeat: RuntimeHeartbeatRecord = {
      record_kind: "runtime_heartbeat",
      version: 1,
      runtime_heartbeat_id: "runtime-heartbeat-fixture-trading-run-readback-001",
      sandbox_ref: { record_kind: "sandbox", id: sandboxId },
      heartbeat_line: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
      observed_at: "2026-05-20T00:00:01.000Z",
      authority_status: "trace_only"
    };
    const sandbox: SandboxRecord = {
      record_kind: "sandbox",
      version: 1,
      sandbox_id: sandboxId,
      adapter_kind: "deterministic_test",
      system_code_ref: candidate.system_code.ref,
      runtime_ref: candidate.runtime.ref,
      sandbox_placement_ref: { record_kind: "sandbox_placement", id: placement.sandbox_placement_id },
      lifecycle_status: "running",
      sandbox_name: "ouro-fixture-trading-run-readback",
      sandbox_ref: { record_kind: "docker_sandbox", id: "ouro-fixture-trading-run-readback" },
      created_at: "2026-05-20T00:00:00.000Z",
      started_at: "2026-05-20T00:00:00.000Z",
      last_heartbeat_at: heartbeat.observed_at,
      log_refs: [{ record_kind: "sandbox_log", id: log.sandbox_log_id }],
      heartbeat_refs: [{ record_kind: "runtime_heartbeat", id: heartbeat.runtime_heartbeat_id }],
      authority_status: "not_live"
    };

    await store.recordSandboxStart({
      instance: sandbox,
      placement,
      logs: [log],
      heartbeats: [heartbeat]
    });

    const projected = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projected?.runtime.sandbox).toMatchObject({
      sandbox_id: sandboxId,
      adapter_kind: "deterministic_test",
      runtime_ref: { id: candidate.runtime.ref.id },
      lifecycle_status: "running",
      logs: [
        {
          lines: [
            "{\"at\":\"2026-05-20T00:00:00.000Z\",\"event\":\"order_request\",\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"order_type\":\"limit\",\"quantity\":\"0.001\",\"limit_price\":\"60000\"}",
            "{\"event\":\"runtime_heartbeat\",\"tick\":1}"
          ]
        }
      ],
      heartbeats: [
        {
          heartbeat_line: "{\"event\":\"runtime_heartbeat\",\"tick\":1}"
        }
      ]
    });
    expect(projected?.runtime.placement.ref.id).toBe(placement.sandbox_placement_id);
    expect(projected?.runtime.transcript).toMatchObject({
      transcript_kind: "trading_run_transcript",
      has_activity: true,
      latest_item: {
        item_kind: "sandbox_log",
        summary: "{\"at\":\"2026-05-20T00:00:00.000Z\",\"event\":\"order_request\",\"symbol\":\"BTCUSDT\",\"side\":\"buy\",\"order_type\":\"limit\",\"quantity\":\"0.001\",\"limit_price\":\"60000\"} / {\"event\":\"runtime_heartbeat\",\"tick\":1}"
      }
    });
    expect(projected?.runtime.transcript?.items.map((item) => item.item_kind)).toContain(
      "sandbox_lifecycle"
    );
    expect(projected?.runtime.transcript?.items.map((item) => item.item_kind)).toContain(
      "sandbox_heartbeat"
    );
    expect(projected?.runtime.transcript?.items.map((item) => item.item_kind)).toContain(
      "sandbox_log"
    );
    expect(projected?.runtime.transcript?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_kind: "sandbox_order_request",
          summary: "BTCUSDT buy / limit / 0.001 @ 60000"
        })
      ])
    );
  });

  it("ignores legacy orphan sandbox logs and heartbeats when rebuilding read models", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate?.system_code?.ref) {
      throw new Error("expected fixture candidate system code");
    }

    const sandboxId = "sandbox-legacy-orphan-observation-guard";
    const placement: SandboxPlacementRecord = {
      record_kind: "sandbox_placement",
      version: 1,
      sandbox_placement_id: "sandbox-placement-legacy-orphan-observation-guard",
      placement_kind: "containerized_remote",
      tooling_kind: "docker_sandbox",
      sandbox_template_ref: { record_kind: "sandbox_template", id: "fixture-sandbox-template" },
      authority_status: "not_launched"
    };
    const log: SandboxLogRecord = {
      record_kind: "sandbox_log",
      version: 1,
      sandbox_log_id: "sandbox-log-legacy-orphan-observation-guard-valid",
      sandbox_ref: { record_kind: "sandbox", id: sandboxId },
      lines: ["{\"event\":\"runtime_heartbeat\",\"tick\":1}"],
      captured_at: "2026-05-20T00:00:01.000Z",
      authority_status: "trace_only"
    };
    const heartbeat: RuntimeHeartbeatRecord = {
      record_kind: "runtime_heartbeat",
      version: 1,
      runtime_heartbeat_id: "runtime-heartbeat-legacy-orphan-observation-guard-valid",
      sandbox_ref: { record_kind: "sandbox", id: sandboxId },
      heartbeat_line: "{\"event\":\"runtime_heartbeat\",\"tick\":1}",
      observed_at: "2026-05-20T00:00:01.000Z",
      authority_status: "trace_only"
    };
    const sandbox: SandboxRecord = {
      record_kind: "sandbox",
      version: 1,
      sandbox_id: sandboxId,
      adapter_kind: "deterministic_test",
      system_code_ref: candidate.system_code.ref,
      runtime_ref: candidate.runtime.ref,
      sandbox_placement_ref: { record_kind: "sandbox_placement", id: placement.sandbox_placement_id },
      lifecycle_status: "running",
      sandbox_name: "ouro-legacy-orphan-observation-guard",
      sandbox_ref: { record_kind: "docker_sandbox", id: "ouro-legacy-orphan-observation-guard" },
      created_at: "2026-05-20T00:00:00.000Z",
      started_at: "2026-05-20T00:00:00.000Z",
      last_heartbeat_at: heartbeat.observed_at,
      log_refs: [{ record_kind: "sandbox_log", id: log.sandbox_log_id }],
      heartbeat_refs: [{ record_kind: "runtime_heartbeat", id: heartbeat.runtime_heartbeat_id }],
      authority_status: "not_live"
    };

    await store.recordSandboxStart({
      instance: sandbox,
      placement,
      logs: [log],
      heartbeats: [heartbeat]
    });
    await writeStoreJson(
      {
        record_kind: "sandbox_log",
        version: 1,
        sandbox_log_id: "sandbox-log-legacy-missing-sandbox-ref",
        lines: ["legacy log without sandbox_ref"],
        captured_at: "2026-05-19T00:00:00.000Z",
        authority_status: "trace_only"
      },
      "sandbox-logs",
      "items",
      "sandbox-log-legacy-missing-sandbox-ref.json"
    );
    await writeStoreJson(
      {
        record_kind: "runtime_heartbeat",
        version: 1,
        runtime_heartbeat_id: "runtime-heartbeat-legacy-missing-sandbox-ref",
        heartbeat_line: "legacy heartbeat without sandbox_ref",
        observed_at: "2026-05-19T00:00:00.000Z",
        authority_status: "trace_only"
      },
      "runtime-heartbeats",
      "items",
      "runtime-heartbeat-legacy-missing-sandbox-ref.json"
    );

    const projectedSandbox = await store.getSandbox(sandboxId);
    expect(projectedSandbox?.logs).toHaveLength(1);
    expect(projectedSandbox?.heartbeats).toHaveLength(1);
    expect(projectedSandbox?.logs[0].log_ref.id).toBe(log.sandbox_log_id);
    expect(projectedSandbox?.heartbeats[0].heartbeat_ref.id).toBe(heartbeat.runtime_heartbeat_id);

    const projectedCandidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    expect(projectedCandidate?.runtime.sandbox?.sandbox_id).toBe(sandboxId);
    expect(projectedCandidate?.runtime.sandbox?.logs).toHaveLength(1);
    expect(projectedCandidate?.runtime.sandbox?.heartbeats).toHaveLength(1);
  });

  it("rejects invalid runtime control audit commands without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("fixture-candidate-version-001"),
        idempotency_key: ""
      }),
      "invalid_run_control_input"
    );
    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("fixture-candidate-version-001"),
        candidate_id: "missing-candidate"
      }),
      "candidate_not_found"
    );
    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("fixture-candidate-version-001"),
        runtime_id: "missing-runtime"
      }),
      "runtime_not_found"
    );
    await writeStoreJson(
      {
        record_kind: "trading_run",
        version: 1,
        trading_run_id: "foreign-runtime-001",
        stage_binding_profile: "paper",
        placement_ref: { record_kind: "sandbox_placement", id: "fixture-sandbox-placement-001" },
        hands_environment_ref: { record_kind: "hands_environment", id: "fixture-hands-environment-001" },
        memory_surface_ref: { record_kind: "runtime_memory_surface", id: "fixture-runtime-memory-surface-001" },
        authority_status: "not_live"
      } satisfies TradingRunRecord,
      "trading-runs",
      "items",
      "foreign-runtime-001.json"
    );
    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("fixture-candidate-version-001"),
        runtime_id: "foreign-runtime-001"
      }),
      "runtime_mismatch"
    );
    await expectStoreError(
      store.recordRunControlAudit({
        ...validRunControlAuditInput("fixture-candidate-version-001"),
        command: {
          ...validRunControlAuditInput("fixture-candidate-version-001").command,
          action: "launch_live" as "pause"
        }
      }),
      "invalid_run_control_input"
    );
    await expect(countJsonFiles("run-control-commands", "items")).resolves.toBe(0);
    await expect(countJsonFiles("run-control-decisions", "items")).resolves.toBe(0);
    await expect(countJsonFiles("runtime-audit-events", "items")).resolves.toBe(0);
  });

  it("records and reloads automated research findings as research trace only", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validResearchFindingRecord();

    const recorded = await store.recordResearchFinding(finding);
    const repeated = await store.recordResearchFinding(finding);

    expect(repeated).toEqual(recorded);
    expect(recorded).toMatchObject({
      record_kind: "research_finding",
      finding_kind: "positive_result",
      authority_status: "research_trace_only"
    });
    await expect(store.listResearchFindingsForExperiment("experiment-run-market-breakout-001")).resolves.toEqual([
      finding
    ]);
    await expect(store.listResearchFindingsForExperiment("experiment-run-other")).resolves.toEqual([]);

    const persisted = await readStoreJson<ResearchFindingRecord>(
      "research-findings",
      "items",
      `${finding.research_finding_id}.json`
    );
    expect(persisted).toEqual(finding);
    expect(JSON.stringify(persisted)).not.toMatch(/promotion_decision_ref|live_order_authority|exchange_credentials/);

    const reloadedStore = new LocalStore(tmpDir);
    await expect(reloadedStore.listResearchFindings()).resolves.toEqual([finding]);
  });

  it("records artifact change lineage linked to stored findings", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validResearchFindingRecord();
    const lineage = validArtifactLineageRecord();

    await store.recordResearchFinding(finding);
    const recorded = await store.recordArtifactLineage(lineage);
    const repeated = await store.recordArtifactLineage(lineage);

    expect(repeated).toEqual(recorded);
    expect(recorded).toMatchObject({
      record_kind: "artifact_lineage",
      child_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-market-breakout-v2"
      },
      parent_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-market-breakout-v1"
      },
      source_finding_refs: [
        { record_kind: "research_finding", id: finding.research_finding_id }
      ],
      authority_status: "lineage_only"
    });
    await expect(store.listArtifactLineagesForArtifact("system-code-market-breakout-v2"))
      .resolves.toEqual([lineage]);
    await expect(store.listArtifactLineagesForArtifact("system-code-market-breakout-v1"))
      .resolves.toEqual([lineage]);

    const persisted = await readStoreJson<ArtifactLineageRecord>(
      "artifact-lineages",
      "items",
      `${lineage.artifact_lineage_id}.json`
    );
    expect(persisted).toEqual(lineage);
    expect(JSON.stringify(persisted)).not.toMatch(/strategy_internals|live_order_authority|exchange_credentials/);
  });

  it("rejects invalid automated research finding and lineage records without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordResearchFinding({
        ...validResearchFindingRecord(),
        authority_status: "counted" as "research_trace_only"
      }),
      "invalid_research_finding_input"
    );
    await expectStoreError(
      store.recordArtifactLineage({
        ...validArtifactLineageRecord(),
        source_finding_refs: [{ record_kind: "research_finding", id: "missing-research-finding" }]
      }),
      "research_finding_not_found"
    );
    await expectStoreError(
      store.recordArtifactLineage({
        ...validArtifactLineageRecord(),
        child_system_code_ref: {
          record_kind: "provider_output_artifact",
          id: "not-executable"
        }
      } as unknown as ArtifactLineageRecord),
      "invalid_artifact_lineage_input"
    );
    await expect(countJsonFiles("research-findings", "items")).resolves.toBe(0);
    await expect(countJsonFiles("artifact-lineages", "items")).resolves.toBe(0);
  });

  it("records improvement proposals, proposed system codes, and orchestration runs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validResearchFindingRecord();
    const lineage = validArtifactLineageRecord();
    const proposal = validImprovementProposalRecord();
    const artifact = validProposedSystemCodeRecord();
    const run = validResearchOrchestrationRunRecord();

    await store.recordResearchFinding(finding);
    await store.recordArtifactLineage(lineage);
    await store.recordImprovementProposal(proposal);
    await store.recordSystemCode(artifact);
    await store.recordResearchOrchestrationRun(run);

    await expect(store.getSystemCode(artifact.system_code_id)).resolves.toEqual(artifact);
    await expect(store.listImprovementProposals()).resolves.toEqual([proposal]);
    await expect(store.listImprovementProposalsForFinding(finding.research_finding_id)).resolves.toEqual([
      proposal
    ]);
    await expect(store.listResearchOrchestrationRuns()).resolves.toEqual([run]);

    const persistedProposal = await readStoreJson<ImprovementProposalRecord>(
      "improvement-proposals",
      "items",
      `${proposal.improvement_proposal_id}.json`
    );
    const persistedRun = await readStoreJson<ResearchOrchestrationRunRecord>(
      "research-orchestration-runs",
      "items",
      `${run.research_orchestration_run_id}.json`
    );
    const persistedArtifact = await readStoreJson<SystemCodeRecord>(
      "system-codes",
      "items",
      `${artifact.system_code_id}.json`
    );
    expect(persistedProposal.authority_status).toBe("proposal_only");
    expect(persistedRun.authority_status).toBe("research_only");
    expect(persistedArtifact.authority_status).toBe("not_live");
    expect(JSON.stringify({ persistedProposal, persistedRun, persistedArtifact })).not.toMatch(
      /strategy_internals|venue_credentials|paper_order_authority|live_order_authority|promotion_decision_ref/
    );
  });

  it("projects the AAR-inspired improvement loop into candidate inspect", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validResearchFindingRecord();
    const lineage = validArtifactLineageRecord();
    const proposal = {
      ...validImprovementProposalRecord(),
      parent_system_code_ref: {
        record_kind: "system_code",
        id: FIXTURE_SYSTEM_CODE_ID
      }
    } satisfies ImprovementProposalRecord;
    const artifact = validProposedSystemCodeRecord();
    const run = validResearchOrchestrationRunRecord();
    const experiment = validExperimentRunRecord(proposal);
    const evaluationResult = validTradingEvaluationResultRecord(experiment);

    await store.recordResearchFinding(finding);
    await store.recordArtifactLineage(lineage);
    await store.recordImprovementProposal(proposal);
    await store.recordSystemCode(artifact);
    await store.recordResearchOrchestrationRun(run);
    await store.recordExperimentRun(experiment);
    await store.recordTradingEvaluationResult(evaluationResult);
    await store.rebuildProjections();

    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(candidate?.improvement).toMatchObject({
      improvement_kind: "improvement",
      source_model: "automated_alignment_researcher",
      proposal_chain_complete: false,
      evaluation_chain_complete: true,
      chain_complete: true,
      latest_source_finding: {
        finding_id: finding.research_finding_id,
        authority_status: "research_trace_only"
      },
      latest_change_proposal: {
        proposal_id: proposal.improvement_proposal_id,
        parent_system_code_ref: {
          record_kind: "system_code",
          id: FIXTURE_SYSTEM_CODE_ID
        },
        authority_status: "proposal_only"
      },
      latest_experiment: {
        experiment_id: experiment.experiment_run_id,
        authority_status: "not_live"
      },
      latest_evaluation_result: {
        result_id: evaluationResult.trading_evaluation_result_id,
        evidence_disposition: "not_counted",
        authority_status: "not_counted"
      },
      promotion: {
        status: "not_promoted",
        authority_status: "not_live"
      },
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        promotion: false
      }
    });
  });

  it("materializes accepted provider proposal output into owned automated research records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const finding = validResearchFindingRecord();
    const antiHackingFinding = validAntiHackingResearchFindingRecord();
    await store.recordResearchFinding(finding);
    await store.recordResearchFinding(antiHackingFinding);

    const input = validImprovementProposalMaterializationInput();
    const outcome = await store.materializeImprovementProposal(input);
    const repeated = await store.materializeImprovementProposal(input);

    expect(outcome.status).toBe("materialized");
    expect(repeated).toEqual(outcome);
    if (outcome.status !== "materialized") {
      throw new Error("expected materialized improvement proposal outcome");
    }
    expect(outcome.attempt).toMatchObject({
      provider: input.provider_result.provider,
      agent_run_ref: input.provider_result.agent_run_ref,
      trace_ref: input.provider_result.trace_ref,
      status: "materialized",
      validation_status: "accepted",
      authority_status: "proposal_input_only"
    });
    expect(outcome.proposal).toMatchObject({
      research_worker_ref: finding.research_worker_ref,
      research_direction_ref: finding.research_direction_ref,
      source_finding_refs: [{ record_kind: "research_finding", id: finding.research_finding_id }],
      anti_hacking_finding_refs: [
        { record_kind: "research_finding", id: antiHackingFinding.research_finding_id }
      ],
      authority_status: "proposal_only"
    });
    expect(outcome.system_code).toMatchObject({
      artifact_kind: "python_file",
      artifact_path: "fixtures/trading-systems/clock.py",
      status: "registered",
      authority_status: "not_live"
    });
    expect(outcome.system_code.provenance_refs).toEqual([
      { record_kind: "improvement_proposal", id: outcome.proposal.improvement_proposal_id },
      input.provider_result.agent_run_ref,
      input.provider_result.trace_ref,
      { record_kind: "research_finding", id: finding.research_finding_id }
    ]);
    await expect(store.listImprovementProposalMaterializationAttempts()).resolves.toEqual([outcome.attempt]);
    await expect(store.listImprovementProposals()).resolves.toEqual([outcome.proposal]);
    await expect(store.getSystemCode(outcome.system_code.system_code_id))
      .resolves.toEqual(outcome.system_code);
    await expect(store.listArtifactLineagesForArtifact(outcome.system_code.system_code_id))
      .resolves.toEqual([outcome.lineage]);
    expect(JSON.stringify(outcome)).not.toMatch(
      /strategy_internals|strategy_schema|exchange_credentials|paper_order_authority|live_order_authority|promotion_decision_ref|counted_evidence/i
    );
  });

  it("records rejected provider proposal output without durable improvement proposal records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await store.recordResearchFinding(validResearchFindingRecord());
    await store.recordResearchFinding(validAntiHackingResearchFindingRecord());

    const acceptedInput = validImprovementProposalMaterializationInput();
    const rejectedInput = {
      ...acceptedInput,
      provider_result: {
        ...acceptedInput.provider_result,
        output: {
          ...acceptedInput.provider_result.output,
          strategy_internals: { lookback: 14 }
        }
      }
    } as unknown as ImprovementProposalMaterializationInput;

    const outcome = await store.materializeImprovementProposal(rejectedInput);

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        provider: acceptedInput.provider_result.provider,
        agent_run_ref: acceptedInput.provider_result.agent_run_ref,
        trace_ref: acceptedInput.provider_result.trace_ref,
        status: "failed",
        validation_status: "rejected",
        failure_reason: "provider_output_rejected",
        authority_status: "proposal_input_only"
      }
    });
    await expect(store.listImprovementProposalMaterializationAttempts()).resolves.toEqual([outcome.attempt]);
    await expect(store.listImprovementProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toEqual([]);
  });

  it("rejects provider proposal output missing durable trace refs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await store.recordResearchFinding(validResearchFindingRecord());
    await store.recordResearchFinding(validAntiHackingResearchFindingRecord());

    const acceptedInput = validImprovementProposalMaterializationInput();
    const malformedInput = {
      ...acceptedInput,
      provider_result: {
        ...acceptedInput.provider_result,
        provider_output_artifact_refs: undefined
      }
    } as unknown as ImprovementProposalMaterializationInput;

    const outcome = await store.materializeImprovementProposal(malformedInput);

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "provider_output_schema_invalid",
        validation_status: "rejected",
        authority_status: "proposal_input_only"
      }
    });
    await expect(store.listImprovementProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toEqual([]);
  });

  it("records failed improvement proposal provider output without partial durable writes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const input = validImprovementProposalProviderFailureInput();

    const outcome = await store.recordImprovementProposalProviderFailure(input);
    const repeated = await store.recordImprovementProposalProviderFailure(input);

    expect(outcome).toEqual(repeated);
    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        provider: input.provider_result.provider,
        agent_run_ref: input.provider_result.agent_run_ref,
        trace_ref: input.provider_result.trace_ref,
        status: "failed",
        validation_status: "rejected",
        failure_reason: "improvement_proposal_provider_failed",
        authority_status: "proposal_input_only"
      }
    });
    await expect(store.listImprovementProposalMaterializationAttempts()).resolves.toEqual([outcome.attempt]);
    await expect(store.listImprovementProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toEqual([]);
  });

  it("rejects provider proposal output with missing source findings before durable writes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await store.materializeImprovementProposal(validImprovementProposalMaterializationInput());

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "improvement_proposal_source_finding_not_found",
        validation_status: "rejected",
        authority_status: "proposal_input_only"
      }
    });
    await expect(store.listImprovementProposals()).resolves.toEqual([]);
    await expect(store.listArtifactLineages()).resolves.toEqual([]);
  });

  it("rejects invalid improvement proposal and orchestration inputs without creating records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.recordImprovementProposal(validImprovementProposalRecord()),
      "research_finding_not_found"
    );

    const finding = validResearchFindingRecord();
    await store.recordResearchFinding(finding);
    await expectStoreError(
      store.recordImprovementProposal({
        ...validImprovementProposalRecord(),
        authority_status: "counted" as "proposal_only"
      }),
      "invalid_improvement_proposal_input"
    );
    await store.recordImprovementProposal(validImprovementProposalRecord());
    await expectStoreError(
      store.recordResearchOrchestrationRun({
        ...validResearchOrchestrationRunRecord(),
        output_artifact_proposal_ref: {
          record_kind: "improvement_proposal",
          id: "missing-proposal"
        }
      }),
      "improvement_proposal_not_found"
    );
    await expectStoreError(
      store.recordResearchOrchestrationRun({
        ...validResearchOrchestrationRunRecord(),
        authority_status: "counted" as "research_only"
      }),
      "invalid_research_orchestration_run_input"
    );
    await expect(countJsonFiles("research-orchestration-runs", "items")).resolves.toBe(0);
  });

  it("keeps evaluation provider output as trace material until explicitly sealed", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
    if (!candidate) {
      throw new Error("expected fixture candidate");
    }

    const input = validEvaluationRunInput(candidate.candidate_version.candidate_version_id);
    const outcome = await store.createEvaluationRunForCandidate(input);
    const trace = await readStoreJson<TracePlaceholderRecord>(
      "traces",
      "placeholders",
      `${outcome.trace.trace_id}.json`
    );
    const sealingDecision = await readStoreJson<Record<string, unknown>>(
      "evidence-sealing-decisions",
      "items",
      `${outcome.sealing_decision.evidence_sealing_decision_id}.json`
    );

    expect(trace.record_kind).toBe("trace_placeholder");
    expect(trace.provider_output_artifact_refs).toEqual(input.provider_output_artifact_refs);
    expect(trace.debug_artifact_refs).toEqual(input.debug_artifact_refs);
    expect(trace.authority_status).toBe("not_counted");
    expect(sealingDecision).not.toHaveProperty("provider_output_artifact_refs");
    expect(sealingDecision).not.toHaveProperty("artifact_refs");
    expect(sealingDecision).toMatchObject({
      evidence_disposition: "not_counted",
      authority_status: "not_counted"
    });
  });

  it("returns deterministic store errors for invalid evaluation run commands", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("missing-version"),
        candidate_version_id: "missing-version"
      }),
      "candidate_version_not_found"
    );
    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("fixture-candidate-version-001"),
        candidate_id: "missing-candidate"
      }),
      "candidate_not_found"
    );
    await expectStoreError(
      store.createEvaluationRunForCandidate({
        ...validEvaluationRunInput("fixture-candidate-version-001"),
        stage: "live" as "backtest"
      }),
      "unsupported_evaluation_stage"
    );
    await expectStoreError(
      store.sealEvaluationRunEvidence({
        idempotency_key: "missing-evaluation-run-seal",
        evaluation_run_record_id: "missing-evaluation-run",
        evidence_disposition: "not_counted",
        disposition_reason: "non_comparable"
      }),
      "evaluation_run_not_found"
    );
    await expectStoreError(
      store.sealEvaluationRunEvidence({
        idempotency_key: "invalid-counted-reason",
        evaluation_run_record_id: "fixture-evaluation-run-001",
        evidence_disposition: "counted",
        disposition_reason: "method_not_authoritative",
        classified_refs: [{ record_kind: "fixture_evidence", id: "bad-counted-reason" }]
      }),
      "invalid_evidence_sealing_input"
    );
  });

  it("keeps schema-invalid materialization attempts without creating a candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.listCandidates();

    const invalidInput = {
      ...validMaterializationInput(),
      idempotency_key: "codex-run-invalid-schema",
      candidate: {
        title: "",
        system_summary: "",
        first_market_scope: "external_trading_api_fixture"
      }
    } as CandidateMaterializationInput;

    const outcome = await store.materializeCandidate(invalidInput);
    const after = await store.listCandidates();
    const attempts = await store.listCandidateMaterializationAttempts();

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "schema_invalid",
        validation_status: "rejected"
      }
    });
    expect(after).toEqual(before);
    expect(attempts.some((attempt) => attempt.idempotency_key === "codex-run-invalid-schema")).toBe(true);

    const missingTitleInput = {
      ...validMaterializationInput(),
      idempotency_key: "codex-run-missing-title",
      candidate: {
        system_summary: "Missing title should be rejected instead of throwing.",
        first_market_scope: "external_trading_api_fixture"
      }
    } as unknown as CandidateMaterializationInput;
    await expect(store.materializeCandidate(missingTitleInput)).resolves.toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "schema_invalid",
        validation_status: "rejected"
      }
    });
  });

  it("keeps provider failures without creating a candidate", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const before = await store.listCandidates();

    const outcome = await store.recordCandidateMaterializationFailure({
      idempotency_key: "codex-run-provider-failed",
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      agent_run_id: "agent-run-provider-failed",
      trace_id: "trace-provider-failed",
      failure_reason: "provider_failed",
      artifact_refs: []
    });

    expect(outcome).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "provider_failed",
        authority_label: "provider_output_not_evidence"
      }
    });
    await expect(store.listCandidates()).resolves.toEqual(before);
  });

  it("deduplicates materialization by idempotency key", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const first = await store.materializeCandidate(validMaterializationInput());
    const second = await store.materializeCandidate(validMaterializationInput());
    const candidates = await store.listCandidates();

    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    if (first.status !== "materialized" || second.status !== "materialized") {
      throw new Error("expected materialized outcomes");
    }
    expect(second.candidate.candidate_id).toBe(first.candidate.candidate_id);
    expect(second.attempt.attempt_id).toBe(first.attempt.attempt_id);
    expect(candidates.filter((candidate) => candidate.status === "materialized")).toHaveLength(1);
  });
});

function validMaterializationInput(): CandidateMaterializationInput {
  return {
    idempotency_key: "codex-run-success-output-hash-001",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-codex-success-001",
      agent_event_id: "agent-event-codex-success-001",
      trace_id: "trace-codex-success-001",
      output_artifact_hash: "sha256:success-output-001"
    },
    candidate: {
      title: "generic market Perp Breakout Candidate",
      system_summary: "Agent-generated generic trading instruments breakout trading-system candidate.",
      first_market_scope: "external_trading_api_fixture"
    },
    spec: {
      summary: "Trade generic trading instruments using volatility breakouts and strict risk caps.",
      market: "ExternalTradingApiProvider",
      instrument: "generic trading instruments",
      supported_stage_binding_profiles: ["backtest", "paper", "live"]
    },
    program: {
      summary: "Generated behavior bundle that emits order requests only after validation.",
      declared_runtime: "python-sandbox-placeholder",
      declared_outputs: ["OrderRequest", "ProgramEvent", "Trace"]
    },
    capability_package: {
      summary: "generic trading market context and indicator package request.",
      allowed_stages: ["backtest", "paper"],
      declared_permissions: ["read_market_bars", "read_position_state"],
      forbidden_contents: ["exchange_credentials", "evaluator_hidden_labels", "live_order_authority"]
    },
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "codex-output-success-001" }]
  };
}

function validEvaluationRunInput(
  candidateVersionId: string,
  overrides: Partial<ReturnType<typeof baseEvaluationRunInput>> = {}
) {
  return {
    ...baseEvaluationRunInput(candidateVersionId),
    ...overrides
  };
}

function baseEvaluationRunInput(candidateVersionId: string) {
  return {
    idempotency_key: "evaluation-run-fixture-backtest-output-hash-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    stage: "backtest" as const,
    execution_mode: "host_local" as const,
    trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluation-fixture-backtest-001" },
    evaluator_ref: { record_kind: "evaluation_provider", id: "deterministic-backtest-fixture" },
    provider_output_artifact_refs: [
      { record_kind: "provider_output_artifact", id: "evaluation-provider-output-001" }
    ],
    debug_artifact_refs: [
      { record_kind: "debug_artifact", id: "evaluation-debug-output-001" }
    ]
  };
}

function validLedgerInput(candidateVersionId: string): LedgerInput {
  return {
    idempotency_key: "ledger-dry-run-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    intent: {
      intent_kind: "place_order",
      side: "buy",
      order_type: "limit",
      quantity: "0.001",
      limit_price: "60000"
    },
    gateway_result: {
      decision_outcome: "dry_run_only",
      decision_reason: "paper_stage_only",
      policy_ref: { record_kind: "runtime_operating_policy", id: "runtime-operating-policy-paper-v1" }
    },
    execution_result: {
      execution_mode: "host_local",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-ledger-dry-run-001" },
      completed_at: "2026-05-10T00:01:00.000Z"
    },
    created_at: "2026-05-10T00:00:00.000Z"
  };
}

function validRunControlAuditInput(candidateVersionId: string): RunControlAuditInput {
  return {
    idempotency_key: "run-control-pause-001",
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    command: {
      action: "pause",
      requested_lifecycle_status: "paused",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-sjson" },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      reason: "operator_request",
      reason_summary: "Pause paper runtime for operator review.",
      trace_ref: { record_kind: "trace_placeholder", id: "trace-run-control-pause-001" }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: {
        record_kind: "runtime_policy_engine",
        id: "runtime-policy-engine-fixture"
      },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      resulting_lifecycle_status: "paused"
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-sjson" },
      runtime_lifecycle_status: "paused",
      message: "Paper runtime paused through run-control audit chain."
    },
    created_at: "2026-05-10T00:10:00.000Z"
  };
}

function runControlLifecycleInput(
  candidateVersionId: string,
  runtimeId: string,
  action: "start" | "stop",
  lifecycleStatus: "running" | "stopped"
): RunControlAuditInput {
  return {
    idempotency_key: `trading-run-${action}:${runtimeId}:${candidateVersionId}`,
    candidate_id: FIXTURE_CANDIDATE_ID,
    candidate_version_id: candidateVersionId,
    runtime_id: runtimeId,
    command: {
      action,
      requested_lifecycle_status: lifecycleStatus,
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      reason: "operator_request",
      reason_summary: `Operator requested Trading Run ${action}.`,
      trace_ref: { record_kind: "trace_placeholder", id: `trace-${action}-${runtimeId}` }
    },
    decision: {
      decision_outcome: "allowed",
      decision_reason: "policy_allows_control",
      decided_by_actor_kind: "policy_engine",
      decided_by_actor_ref: {
        record_kind: "runtime_policy_engine",
        id: "runtime-policy-engine-fixture"
      },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      resulting_lifecycle_status: lifecycleStatus
    },
    audit_event: {
      event_kind: "runtime_lifecycle_transitioned",
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "operator-web" },
      runtime_lifecycle_status: lifecycleStatus,
      message: `Trading Run ${action} recorded.`
    },
    created_at: `2026-05-20T00:00:0${action === "start" ? "1" : "2"}.000Z`
  };
}

function validResearchFindingRecord(): ResearchFindingRecord {
  return {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: "research-finding-market-breakout-oos-001",
    research_worker_ref: { record_kind: "research_worker", id: "research-worker-breakout-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-breakout-001"
    },
    experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-market-breakout-001" },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: "trading-evaluation-result-market-breakout-001"
    },
    finding_kind: "positive_result",
    summary: "Breakout artifact improved held-out generic trading score after fees without gaining authority.",
    supporting_record_refs: [
      { record_kind: "trading_evaluation_result", id: "trading-evaluation-result-market-breakout-001" },
      { record_kind: "metric_snapshot", id: "metric-market-breakout-oos-001" }
    ],
    created_at: "2026-05-11T00:00:00.000Z",
    authority_status: "research_trace_only"
  };
}

function validAntiHackingResearchFindingRecord(): ResearchFindingRecord {
  return {
    ...validResearchFindingRecord(),
    research_finding_id: "research-finding-market-breakout-lookahead-001",
    finding_kind: "anti_hacking_case",
    summary: "Reject lookahead leakage while proposing the next opaque artifact.",
    supporting_record_refs: [
      { record_kind: "metric_snapshot", id: "metric-market-breakout-lookahead-001" }
    ],
    created_at: "2026-05-11T00:01:00.000Z"
  };
}

function validArtifactLineageRecord(): ArtifactLineageRecord {
  return {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-market-breakout-v2",
    child_system_code_ref: {
      record_kind: "system_code",
      id: "system-code-market-breakout-v2"
    },
    parent_system_code_ref: {
      record_kind: "system_code",
      id: "system-code-market-breakout-v1"
    },
    source_finding_refs: [
      { record_kind: "research_finding", id: "research-finding-market-breakout-oos-001" }
    ],
    created_by_research_worker_ref: { record_kind: "research_worker", id: "research-worker-breakout-001" },
    created_at: "2026-05-11T00:05:00.000Z",
    authority_status: "lineage_only"
  };
}

function validImprovementProposalMaterializationInput(): ImprovementProposalMaterializationInput {
  const providerResult = validImprovementProposalProviderResult();
  if (providerResult.status !== "succeeded") {
    throw new Error("expected provider success");
  }
  return {
    idempotency_key: "improvement-proposal-materialization-provider-output-001",
    provider_result: providerResult,
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_runtime_contract_ref: {
      record_kind: "artifact_runtime_contract",
      id: "artifact-runtime-contract-python-clock-v1"
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "provider-improvement-proposal" },
    created_at: "2026-05-11T00:07:00.000Z"
  };
}

function validImprovementProposalProviderFailureInput(): ImprovementProposalProviderFailureInput {
  const providerResult = {
    status: "failed",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema"
    },
    failure_reason: "improvement_proposal_provider_failed",
    agent_run_ref: { record_kind: "agent_run", id: "agent-run-improvement-proposal-provider-failed-001" },
    agent_event_refs: [
      { record_kind: "agent_event", id: "agent-event-improvement-proposal-provider-failed-001" }
    ],
    trace_ref: { record_kind: "trace_placeholder", id: "trace-improvement-proposal-provider-failed-001" },
    provider_output_artifact_refs: [
      { record_kind: "improvement_proposal_provider_output_artifact", id: "provider-output-json-failed-001" }
    ],
    debug_artifact_refs: [
      { record_kind: "debug_artifact", id: "provider-debug-improvement-proposal-failed-001" }
    ],
    idempotency_key: "improvement-proposal-provider-output-failed-001",
    authority_status: "proposal_input_only"
  } satisfies ImprovementProposalProviderResult;
  if (providerResult.status !== "failed") {
    throw new Error("expected provider failure");
  }
  return {
    idempotency_key: "improvement-proposal-materialization-provider-output-failed-001",
    provider_result: providerResult,
    created_at: "2026-05-11T00:08:00.000Z"
  };
}

function validImprovementProposalProviderResult(): ImprovementProposalProviderResult {
  return {
    status: "succeeded",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema"
    },
    output: {
      output_kind: "improvement_proposal_input",
      trading_evaluation_task_ref: {
        record_kind: "trading_evaluation_task",
        id: "trading-evaluation-task-market-breakout-001"
      },
      source_finding_refs: [
        { record_kind: "research_finding", id: "research-finding-market-breakout-oos-001" }
      ],
      anti_hacking_finding_refs: [
        { record_kind: "research_finding", id: "research-finding-market-breakout-lookahead-001" }
      ],
      parent_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-market-breakout-v1"
      },
      proposal_summary: "Provider output proposes the next opaque generic market breakout artifact input.",
      requested_change_summary: "Reduce drawdown while preserving sealed evaluator constraints.",
      expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
      proposed_artifact_refs: [
        { record_kind: "provider_artifact_hint", id: "provider-output-market-breakout-v2" }
      ],
      output_authority_status: "proposal_input_only"
    },
    agent_run_ref: { record_kind: "agent_run", id: "agent-run-improvement-proposal-provider-001" },
    agent_event_refs: [
      { record_kind: "agent_event", id: "agent-event-improvement-proposal-provider-001" }
    ],
    trace_ref: { record_kind: "trace_placeholder", id: "trace-improvement-proposal-provider-001" },
    provider_output_artifact_refs: [
      { record_kind: "improvement_proposal_provider_output_artifact", id: "provider-output-json-001" }
    ],
    debug_artifact_refs: [
      { record_kind: "debug_artifact", id: "provider-debug-improvement-proposal-001" }
    ],
    idempotency_key: "improvement-proposal-provider-output-001",
    authority_status: "proposal_input_only"
  };
}

function validImprovementProposalRecord(): ImprovementProposalRecord {
  return {
    record_kind: "improvement_proposal",
    version: 1,
    improvement_proposal_id: "improvement-proposal-market-breakout-v2",
    research_worker_ref: { record_kind: "research_worker", id: "research-worker-breakout-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-breakout-001"
    },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "trading-evaluation-task-market-breakout-001"
    },
    proposed_system_code_ref: {
      record_kind: "system_code",
      id: "system-code-market-breakout-v2"
    },
    parent_system_code_ref: {
      record_kind: "system_code",
      id: "system-code-market-breakout-v1"
    },
    source_finding_refs: [
      { record_kind: "research_finding", id: "research-finding-market-breakout-oos-001" }
    ],
    proposal_summary: "Propose a next opaque generic market breakout artifact candidate.",
    requested_change_summary: "Reduce drawdown while preserving cost survival.",
    expected_improvement_summary: "Improve held-out robustness under the same sealed evaluator.",
    created_at: "2026-05-11T00:06:00.000Z",
    status: "proposed",
    authority_status: "proposal_only"
  };
}

function validProposedSystemCodeRecord(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-market-breakout-v2",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:proposal-market-breakout-v2",
    runtime_kind: "python",
    entrypoint: ["python", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "runtime_heartbeat", "metric_snapshot"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: { record_kind: "capability_policy", id: "fixture-improvement-proposal" },
    provenance_refs: [
      { record_kind: "improvement_proposal", id: "improvement-proposal-market-breakout-v2" },
      { record_kind: "research_finding", id: "research-finding-market-breakout-oos-001" }
    ],
    status: "registered",
    created_at: "2026-05-11T00:06:00.000Z",
    authority_status: "not_live"
  };
}

function validResearchOrchestrationRunRecord(): ResearchOrchestrationRunRecord {
  return {
    record_kind: "research_orchestration_run",
    version: 1,
    research_orchestration_run_id: "research-orchestration-run-market-breakout-v2",
    research_worker_ref: { record_kind: "research_worker", id: "research-worker-breakout-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-breakout-001"
    },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "trading-evaluation-task-market-breakout-001"
    },
    input_finding_refs: [
      { record_kind: "research_finding", id: "research-finding-market-breakout-oos-001" }
    ],
    input_lineage_refs: [
      { record_kind: "artifact_lineage", id: "artifact-lineage-market-breakout-v2" }
    ],
    output_artifact_proposal_ref: {
      record_kind: "improvement_proposal",
      id: "improvement-proposal-market-breakout-v2"
    },
    output_system_code_ref: {
      record_kind: "system_code",
      id: "system-code-market-breakout-v2"
    },
    output_lineage_ref: {
      record_kind: "artifact_lineage",
      id: "artifact-lineage-market-breakout-v2"
    },
    trace_ref: { record_kind: "trace_placeholder", id: "trace-research-orchestration-market-breakout-v2" },
    started_at: "2026-05-11T00:06:00.000Z",
    completed_at: "2026-05-11T00:06:01.000Z",
    status: "proposed",
    authority_status: "research_only"
  };
}

function validExperimentRunRecord(proposal: ImprovementProposalRecord): ExperimentRunRecord {
  return {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "experiment-run-market-breakout-v2",
    research_worker_ref: proposal.research_worker_ref,
    research_direction_ref: proposal.research_direction_ref,
    system_code_ref: proposal.proposed_system_code_ref,
    trading_evaluation_task_ref: proposal.trading_evaluation_task_ref,
    sandbox_ref: {
      record_kind: "sandbox",
      id: "sandbox-market-breakout-v2"
    },
    runtime_trace_refs: [
      { record_kind: "trace_placeholder", id: "trace-runtime-market-breakout-v2" }
    ],
    trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-market-breakout-v2" },
    submitted_at: "2026-05-11T00:07:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
}

function validTradingEvaluationResultRecord(
  experiment: ExperimentRunRecord
): TradingEvaluationResultRecord {
  return {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "trading-evaluation-result-market-breakout-v2",
    experiment_run_ref: {
      record_kind: "experiment_run",
      id: experiment.experiment_run_id
    },
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    evaluator_ref: { record_kind: "external_evaluator", id: "sealed-replay-fixture-evaluator-v1" },
    result_status: "accepted",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: 0.71,
      oos_score: 0.7,
      drawdown_score: 0.78,
      turnover_score: 0.62,
      cost_survival_score: 0.74,
      reproducibility_score: 0.77,
      complexity_penalty: 0.01
    },
    metric_refs: [
      { record_kind: "metric_snapshot", id: "metric-market-breakout-v2" }
    ],
    evaluator_trace_ref: { record_kind: "trace_placeholder", id: "trace-evaluator-market-breakout-v2" },
    completed_at: "2026-05-11T00:08:00.000Z",
    authority_status: "not_counted"
  };
}

async function expectStoreError(promise: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await promise;
    throw new Error(`expected local-store error ${expectedCode}`);
  } catch (error) {
    expect(error).toMatchObject({
      name: "LocalStoreError",
      code: expectedCode
    });
  }
}

async function readStoreJson<T>(...segments: string[]): Promise<T> {
  const text = await readFile(path.join(tmpDir, ...segments), "utf8");
  return JSON.parse(text) as T;
}

async function countJsonFiles(...segments: string[]): Promise<number> {
  try {
    const entries = await readdir(path.join(tmpDir, ...segments));
    return entries.filter((entry) => entry.endsWith(".json")).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}

async function writeStoreJson(value: unknown, ...segments: string[]): Promise<void> {
  await writeFile(path.join(tmpDir, ...segments), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
