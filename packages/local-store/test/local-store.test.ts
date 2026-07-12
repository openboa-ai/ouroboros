import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FIXTURE_CANDIDATE_ID,
  FIXTURE_SYSTEM_CODE_ID,
  LocalStore,
  type SandboxObservationInput
} from "../src/index";
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
  CandidateAdmissionDecisionRecord,
  CandidateInspectReadModel,
  ImprovementProposalRecord,
  ResearchFindingRecord,
  ResearchDirectionKind,
  ResearchOrchestrationRunRecord,
  ImprovementProposalMaterializationInput,
  ImprovementProposalProviderFailureInput,
  ImprovementProposalProviderResult,
  LedgerInput,
  LedgerWriteOutcome,
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
  PaperTradingAccountSnapshot,
  PaperTradingComparisonActivationAttemptRecord,
  PaperTradingComparisonActivationOutcomeRecord,
  PaperTradingComparisonActivationRecord,
  PaperTradingComparisonActivationSide,
  PaperTradingComparisonActivationSideResultRecord,
  PaperTradingComparisonCheckpointAttemptRecord,
  PaperTradingComparisonCheckpointOutcomeRecord,
  PaperTradingComparisonCheckpointWriteContext,
  PaperTradingComparisonRuntimeWriteContext,
  PaperTradingComparisonTickAcknowledgementRecord,
  PaperTradingComparisonTickCaptureWriteContext,
  PaperTradingComparisonTickDeliveryRecord,
  PaperTradingComparisonTickIOWriteContext,
  PaperTradingComparisonCandidateSide,
  PaperTradingComparisonConfirmationCampaignRecord,
  PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  PaperTradingComparisonConfirmationSlotResult,
  PaperTradingComparisonCommitmentRecord,
  PaperTradingComparisonPolicy,
  PaperTradingComparisonPreparationRecord,
  PaperTradingComparisonResearchReleaseRecord,
  PaperTradingComparisonSide,
  PaperTradingComparisonTickRecord,
  PaperTradingComparisonVerdictRecord,
  PaperTradingEvaluationCommitmentRecord,
  PaperTradingEvaluationRecord,
  PaperTradingObservationRecord,
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
  TradingPromotionRecord,
  TradingRunRecord,
  TradingSystemCandidateRecord
} from "@ouroboros/domain";
import {
  PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT,
  PAPER_TRADING_COMPARISON_ZERO_SCORE,
  decidePaperTradingQualification,
  paperTradingComparisonActivationDigestInput,
  paperTradingComparisonActivationAttemptDigestInput,
  paperTradingComparisonActivationOutcomeDigestInput,
  paperTradingComparisonActivationPolicyFor,
  paperTradingComparisonActivationSideResultDigestInput,
  paperTradingComparisonCheckpointAttemptDigestInput,
  paperTradingComparisonCheckpointOutcomeDigestInput,
  paperTradingComparisonAdmissionDecisionDigestInput,
  paperTradingComparisonCandidateVersionDigestInput,
  paperTradingComparisonCommitmentDigestInput,
  paperTradingComparisonConfirmationCampaignDigestInput,
  paperTradingComparisonConfirmationCampaignOutcomeDigestInput,
  paperTradingComparisonEvaluationCommitmentRecordDigestInput,
  paperTradingComparisonEvaluationRecordDigestInput,
  paperTradingComparisonObservationChainDigestInput,
  paperTradingComparisonPersistedRecordDigestInput,
  paperTradingComparisonPreparationDigestInput,
  paperTradingComparisonResearchReleaseDigestInput,
  paperTradingComparisonRuntimeControlIdempotencyKey,
  paperTradingComparisonSystemCodeRecordDigestInput,
  paperTradingComparisonTickAcknowledgementDigestInput,
  paperTradingComparisonTickDeliveryDigestInput,
  paperTradingComparisonTickDigestInput,
  paperTradingComparisonTradingPromotionDigestInput,
  paperTradingComparisonQualificationResultDigestInput,
  paperTradingComparisonVerdictDigestInput,
  paperTradingEvaluationCommitmentDigestInput
} from "@ouroboros/domain";

type LocalStoreProjectionInternals = {
  rebuildProjectionsUnlocked(): Promise<void>;
};

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

  it("records and reloads an idempotent paper trading commitment", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const commitment = validPaperTradingCommitment();

    const recorded = await store.recordPaperTradingEvaluationCommitment(commitment);
    const repeated = await store.recordPaperTradingEvaluationCommitment(commitment);

    expect(repeated).toEqual(recorded);
    await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual([commitment]);

    const reloaded = new LocalStore(tmpDir);
    await expect(reloaded.getPaperTradingEvaluationCommitment(
      commitment.paper_trading_evaluation_commitment_id
    )).resolves.toEqual(commitment);
  });

  it("rejects relabeling an existing paper trading commitment", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const commitment = validPaperTradingCommitment();
    await store.recordPaperTradingEvaluationCommitment(commitment);

    const relabeled = withPaperTradingCommitmentDigest({
      ...commitment,
      evidence_purpose: "qualification",
      window_policy: {
        ...commitment.window_policy,
        release_policy: "sealed_until_adjudication"
      }
    });

    await expectStoreError(
      store.recordPaperTradingEvaluationCommitment(relabeled),
      "paper_trading_evaluation_commitment_conflict"
    );
    await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual([commitment]);
  });

  it("enforces paper trading commitment references and terminal invalidation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const commitment = validPaperTradingCommitment();
    const evaluation = validPaperTradingEvaluation(commitment);
    await store.recordPaperTradingEvaluationCommitment(commitment);

    await expectStoreError(
      store.recordPaperTradingEvaluation({
        ...evaluation,
        paper_trading_evaluation_commitment_ref: undefined
      }),
      "paper_trading_evaluation_commitment_required"
    );

    await store.recordPaperTradingEvaluation(evaluation);
    await expectStoreError(
      store.recordPaperTradingObservation(
        {
          ...validPaperTradingObservation(commitment, evaluation),
          paper_trading_evaluation_commitment_ref: {
            record_kind: "paper_trading_evaluation_commitment",
            id: "different-paper-commitment"
          }
        },
        {
          ...evaluation,
          observation_count: 1
        }
      ),
      "paper_trading_observation_commitment_mismatch"
    );

    const invalidated = await store.recordPaperTradingEvaluation({
      ...evaluation,
      status: "invalidated",
      invalidation_reason: "resolved_artifact_digest_mismatch",
      stopped_at: "2026-07-10T09:01:00.000Z"
    });
    await expectStoreError(
      store.recordPaperTradingEvaluation({
        ...invalidated,
        status: "running",
        invalidation_reason: undefined,
        stopped_at: undefined
      }),
      "paper_trading_evaluation_invalidation_terminal"
    );
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

  it("accepts Binance production public WebSocket and hybrid market source modes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const seeded = await readStoreJson<PublicMarketLivenessSurfaceRecord>(
      "substrate-state-surfaces",
      "items",
      "fixture-binance-btcusdt-public-market-liveness-surface-001.json"
    );

    const websocket = await store.recordPublicMarketLivenessSurface({
      ...seeded,
      public_market_liveness_surface_id: "binance-btcusdt-public-market-websocket-001",
      source_kind: "binance_production_public_websocket",
      source_ref: ref("binance_websocket_stream", "btcusdt-bookTicker-depth"),
      source_timestamp: "2026-05-16T00:00:05.000Z",
      observed_at: "2026-05-16T00:00:05.000Z",
      updated_at: "2026-05-16T00:00:05.000Z",
      freshness: "fresh",
      liveness: "connected",
      degraded_reason: undefined,
      fixture_backed: false,
      simulated: false,
      authority_status: "read_only"
    });
    const hybrid = await store.recordPublicMarketLivenessSurface({
      ...seeded,
      public_market_liveness_surface_id: "binance-btcusdt-public-market-hybrid-001",
      source_kind: "binance_production_public_hybrid",
      source_ref: ref("binance_public_market_hybrid", "btcusdt-rest-plus-websocket"),
      source_timestamp: "2026-05-16T00:00:06.000Z",
      observed_at: "2026-05-16T00:00:06.000Z",
      updated_at: "2026-05-16T00:00:06.000Z",
      freshness: "fresh",
      liveness: "connected",
      degraded_reason: undefined,
      fixture_backed: false,
      simulated: false,
      authority_status: "read_only"
    });

    const latest = await store.getLatestPublicMarketLivenessSurface(BINANCE_BTCUSDT_QUERY);
    const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);

    expect(websocket.source_kind).toBe("binance_production_public_websocket");
    expect(hybrid.source_kind).toBe("binance_production_public_hybrid");
    expect(latest).toMatchObject({
      surface_id: "binance-btcusdt-public-market-hybrid-001",
      source_kind: "binance_production_public_hybrid",
      fixture_backed: false,
      simulated: false,
      authority_status: "read_only"
    });
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

  it("self-heals a missing candidate projection index from authoritative records", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await rm(path.join(tmpDir, "read-models/candidates/index.json"), { force: true });

    await expect(store.listCandidates()).resolves.toMatchObject([
      {
        candidate_id: FIXTURE_CANDIDATE_ID,
        status: "fixture_only"
      }
    ]);
  });

  it("serializes concurrent candidate projection self-heal reads", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await rm(path.join(tmpDir, "read-models/candidates/index.json"), { force: true });

    const internals = store as unknown as LocalStoreProjectionInternals;
    const originalRebuild = internals.rebuildProjectionsUnlocked.bind(store);
    let rebuilds = 0;
    internals.rebuildProjectionsUnlocked = async () => {
      rebuilds += 1;
      await originalRebuild();
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () => store.listCandidates())
    );

    for (const candidates of results) {
      expect(candidates).toMatchObject([
        {
          candidate_id: FIXTURE_CANDIDATE_ID,
          status: "fixture_only"
        }
      ]);
    }
    expect(rebuilds).toBe(1);
  });

  it("queues explicit projection rebuild requests made while another rebuild is in flight", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const internals = store as unknown as LocalStoreProjectionInternals;
    const originalRebuild = internals.rebuildProjectionsUnlocked.bind(store);
    let rebuilds = 0;
    let firstRebuildStarted!: () => void;
    let releaseFirstRebuild!: () => void;
    const firstRebuildStartedPromise = new Promise<void>((resolve) => {
      firstRebuildStarted = resolve;
    });
    const releaseFirstRebuildPromise = new Promise<void>((resolve) => {
      releaseFirstRebuild = resolve;
    });

    internals.rebuildProjectionsUnlocked = async () => {
      rebuilds += 1;
      if (rebuilds === 1) {
        firstRebuildStarted();
        await releaseFirstRebuildPromise;
      }
      await originalRebuild();
    };

    const firstRebuild = store.rebuildProjections();
    await firstRebuildStartedPromise;
    const secondRebuild = store.rebuildProjections();
    releaseFirstRebuild();
    await Promise.all([firstRebuild, secondRebuild]);

    expect(rebuilds).toBe(2);
  });

  it("returns an empty candidate list when an uninitialized store has no projection index", async () => {
    const store = new LocalStore(tmpDir);

    await expect(store.listCandidates()).resolves.toEqual([]);
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

  it("creates isolated paper TradingRuns without changing the default candidate runtime", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const outcome = await store.materializeCandidate({
      ...validMaterializationInput(),
      idempotency_key: "multi-run-paper-candidate",
      system_code_ref: { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID }
    });
    if (outcome.status !== "materialized") {
      throw new Error("expected materialized candidate");
    }
    const candidate = outcome.candidate;
    const defaultRunId = candidate.runtime.ref.id;
    const firstInput = {
      idempotency_key: "comparison-a:champion",
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification" as const,
      created_at: "2026-07-10T00:00:00.000Z"
    };
    const first = await store.createPaperTradingRun(firstInput);
    const repeated = await store.createPaperTradingRun(firstInput);
    const second = await store.createPaperTradingRun({
      ...firstInput,
      idempotency_key: "comparison-b:champion",
      created_at: "2026-07-10T01:00:00.000Z"
    });

    expect(repeated).toEqual(first);
    expect(first.trading_run_id).not.toBe(defaultRunId);
    expect(second.trading_run_id).not.toBe(first.trading_run_id);
    expect(first.paper_evidence_purpose).toBe("qualification");
    expect(first.placement_ref.id).not.toBe(candidate.runtime.placement.ref.id);
    expect(first.hands_environment_ref.id).not.toBe(candidate.runtime.hands_environment.ref.id);
    expect(first.memory_surface_ref.id).not.toBe(candidate.runtime.memory_surface.ref.id);
    expect((await store.listTradingRunsForCandidateVersion(
      candidate.candidate_version.candidate_version_id
    )).map((run) => run.trading_run_id).sort()).toEqual([
      defaultRunId,
      first.trading_run_id,
      second.trading_run_id
    ].sort());

    const projected = await store.getCandidateForTradingRun(first.trading_run_id);
    expect(projected).toMatchObject({
      candidate_id: candidate.candidate_id,
      candidate_version: {
        candidate_version_id: candidate.candidate_version.candidate_version_id
      },
      runtime: {
        ref: { record_kind: "trading_run", id: first.trading_run_id },
        placement: { ref: first.placement_ref },
        hands_environment: { ref: first.hands_environment_ref },
        memory_surface: { ref: first.memory_surface_ref }
      },
      trading_run: {
        ref: { record_kind: "trading_run", id: first.trading_run_id }
      }
    });
    expect((await store.getCandidate(candidate.candidate_id))?.runtime.ref.id).toBe(defaultRunId);

    const qualificationCommitment = withPaperTradingCommitmentDigest({
      ...validPaperTradingCommitment(),
      paper_trading_evaluation_commitment_id: "paper-commitment-multi-run-qualification",
      evidence_purpose: "qualification",
      candidate_ref: first.candidate_ref!,
      candidate_version_ref: first.candidate_version_ref!,
      trading_run_ref: { record_kind: "trading_run", id: first.trading_run_id },
      window_policy: {
        ...validPaperTradingCommitment().window_policy,
        release_policy: "sealed_until_adjudication"
      },
      committed_at: "2026-07-10T00:00:00.000Z",
      commitment_digest: ""
    });
    const qualificationEvaluation = {
      ...validPaperTradingEvaluation(qualificationCommitment),
      paper_trading_evaluation_id: "paper-evaluation-multi-run-qualification",
      trading_run_ref: { record_kind: "trading_run", id: first.trading_run_id }
    };
    await expect(store.recordPaperTradingEvaluationCommitment(qualificationCommitment))
      .resolves.toEqual(qualificationCommitment);
    await expect(store.recordPaperTradingEvaluation(qualificationEvaluation))
      .resolves.toEqual(qualificationEvaluation);

    const defaultRunBeforeControl = await store.getTradingRun(defaultRunId);
    await store.recordRunControlAudit({
      ...validRunControlAuditInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "multi-run-qualification-pause",
      candidate_id: candidate.candidate_id,
      runtime_id: first.trading_run_id
    });
    expect((await store.getTradingRun(first.trading_run_id))?.runtime_lifecycle_status).toBe("paused");
    expect(await store.getTradingRun(defaultRunId)).toEqual(defaultRunBeforeControl);

    await store.recordLedger({
      ...validLedgerInput(candidate.candidate_version.candidate_version_id),
      idempotency_key: "multi-run-qualification-ledger",
      candidate_id: candidate.candidate_id,
      runtime_id: first.trading_run_id
    });
    expect((await store.getCandidateForTradingRun(first.trading_run_id))?.ledger?.has_activity)
      .toBe(true);
    expect((await store.getCandidate(candidate.candidate_id))?.ledger?.has_activity).toBe(false);

    const reloaded = new LocalStore(tmpDir);
    expect((await reloaded.getCandidateForTradingRun(first.trading_run_id))?.runtime).toMatchObject({
      ref: { record_kind: "trading_run", id: first.trading_run_id },
      runtime_lifecycle_status: "paused",
      placement: { ref: first.placement_ref },
      hands_environment: { ref: first.hands_environment_ref },
      memory_surface: { ref: first.memory_surface_ref }
    });
    expect((await reloaded.getCandidateForTradingRun(first.trading_run_id))?.ledger?.has_activity)
      .toBe(true);
    expect(await reloaded.getTradingRun(defaultRunId)).toEqual(defaultRunBeforeControl);
  });

  it("rejects invalid or conflicting paper TradingRun creation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const firstOutcome = await store.materializeCandidate({
      ...validMaterializationInput(),
      idempotency_key: "paper-run-validation-first",
      system_code_ref: { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID }
    });
    const secondOutcome = await store.materializeCandidate({
      ...validMaterializationInput(),
      idempotency_key: "paper-run-validation-second",
      provider: {
        ...validMaterializationInput().provider,
        agent_run_id: "paper-run-validation-second-agent-run",
        agent_event_id: "paper-run-validation-second-agent-event",
        trace_id: "paper-run-validation-second-trace"
      },
      system_code_ref: { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID }
    });
    if (firstOutcome.status !== "materialized" || secondOutcome.status !== "materialized") {
      throw new Error("expected paper run validation candidates");
    }
    const validInput = {
      idempotency_key: "paper-run-validation",
      candidate_id: firstOutcome.candidate.candidate_id,
      candidate_version_id: firstOutcome.candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification" as const,
      created_at: "2026-07-10T00:00:00.000Z"
    };

    await expectStoreError(
      store.createPaperTradingRun({ ...validInput, idempotency_key: "" }),
      "invalid_paper_trading_run_input"
    );
    await expectStoreError(
      store.createPaperTradingRun({
        ...validInput,
        evidence_purpose: "promotion" as "qualification"
      }),
      "invalid_paper_trading_run_input"
    );
    await expectStoreError(
      store.createPaperTradingRun({ ...validInput, candidate_id: "missing-candidate" }),
      "candidate_not_found"
    );
    await expectStoreError(
      store.createPaperTradingRun({ ...validInput, candidate_version_id: "missing-version" }),
      "candidate_version_not_found"
    );
    await expectStoreError(
      store.createPaperTradingRun({
        ...validInput,
        candidate_version_id: secondOutcome.candidate.candidate_version.candidate_version_id
      }),
      "candidate_version_mismatch"
    );

    const created = await store.createPaperTradingRun(validInput);
    await writeStoreJson(
      { ...created, system_code_ref: undefined },
      "trading-runs",
      "items",
      `${created.trading_run_id}.json`
    );
    expect(await store.getCandidateForTradingRun(created.trading_run_id)).toBeUndefined();
    await expectStoreError(
      store.createPaperTradingRun(validInput),
      "paper_trading_run_conflict"
    );
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

  it("records and reloads a policy-consistent candidate admission decision", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const records = validCandidateAdmissionRecords();
    const sourceSystemCode = validCandidateAdmissionSourceSystemCode();

    await store.recordSystemCode(sourceSystemCode);
    await store.recordExperimentRun(records.experiment);
    await store.recordTradingEvaluationResult(records.evaluation);
    await store.recordResearchFinding(records.finding);
    const recorded = await store.recordCandidateAdmissionDecision(records.admission);

    expect(recorded).toEqual(records.admission);
    await expect(store.listCandidateAdmissionDecisions()).resolves.toEqual([records.admission]);
    const persisted = await readStoreJson<CandidateAdmissionDecisionRecord>(
      "candidate-admission-decisions",
      "items",
      `${records.admission.candidate_admission_decision_id}.json`
    );
    expect(persisted).toEqual(records.admission);

    const reloadedStore = new LocalStore(tmpDir);
    await expect(reloadedStore.listCandidateAdmissionDecisions()).resolves.toEqual([
      records.admission
    ]);
  });

  it("rejects inconsistent or dangling candidate admission decisions", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const records = validCandidateAdmissionRecords();
    const sourceSystemCode = validCandidateAdmissionSourceSystemCode();

    await store.recordSystemCode(sourceSystemCode);
    await store.recordExperimentRun(records.experiment);
    await store.recordTradingEvaluationResult(records.evaluation);
    await store.recordResearchFinding(records.finding);

    await expectStoreError(
      store.recordCandidateAdmissionDecision({
        ...records.admission,
        status: "duplicate",
        reason: "no_candidate_change",
        runnable_paper_handoff: false
      }),
      "invalid_candidate_admission_decision_input"
    );
    await expectStoreError(
      store.recordCandidateAdmissionDecision({
        ...records.admission,
        source_artifact_digest: records.admission.submitted_artifact_digest
      }),
      "invalid_candidate_admission_decision_input"
    );
    await expectStoreError(
      store.recordCandidateAdmissionDecision({
        ...records.admission,
        submitted_artifact_digest: "sha256:not-the-referenced-system-code"
      }),
      "candidate_admission_reference_mismatch"
    );
    await expectStoreError(
      store.recordCandidateAdmissionDecision({
        ...records.admission,
        source_system_code_ref: {
          record_kind: "system_code",
          id: sourceSystemCode.system_code_id
        },
        source_artifact_digest: "sha256:not-the-referenced-source-system-code"
      } as CandidateAdmissionDecisionRecord),
      "candidate_admission_reference_mismatch"
    );
    await expectStoreError(
      store.recordCandidateAdmissionDecision({
        ...records.admission,
        research_finding_ref: {
          record_kind: "research_finding",
          id: "missing-research-finding"
        }
      }),
      "candidate_admission_reference_not_found"
    );
    await expect(countJsonFiles("candidate-admission-decisions", "items")).resolves.toBe(0);
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

  it("records exact paper comparison preparation replay and rejects drift or role-swapped active intent", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const championRunsBefore = await store.listTradingRunsForCandidateVersion(
      fixture.preparation.champion.candidate_version_ref.id
    );
    const first = await store.reservePaperTradingComparisonPreparation(fixture.preparation);
    const repeated = await store.reservePaperTradingComparisonPreparation(fixture.preparation);
    expect(repeated).toEqual(first);

    const swappedEvidence = await recordQualifiedPromotionEvidence(
      store,
      fixture.challenger,
      "role-swap",
      "2026-07-09T21:32:00.000Z"
    );
    const challengerRunsAfterRoleSwapEvidence = await store.listTradingRunsForCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    );
    const swappedPromotion: TradingPromotionRecord = {
      ...fixture.promotion,
      trading_promotion_id: "trading-promotion-role-swap",
      candidate_ref: { ...fixture.preparation.challenger.candidate_ref },
      candidate_version_ref: { ...fixture.preparation.challenger.candidate_version_ref },
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: swappedEvidence.evaluation.paper_trading_evaluation_id
      },
      promoted_at: "2026-07-09T22:03:00.000Z"
    };
    await overwriteComparisonFixtureRecord(
      store,
      "trading-promotions",
      swappedPromotion.trading_promotion_id,
      swappedPromotion
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(withPreparationDigest({
        ...fixture.preparation,
        comparison_policy: {
          ...fixture.preparation.comparison_policy,
          minimum_net_revenue_lift_usdt: 25
        },
        preparation_digest: ""
      })),
      "paper_trading_comparison_preparation_conflict"
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(withPreparationDigest({
        ...fixture.preparation,
        paper_trading_comparison_preparation_id: "paper-comparison-preparation-role-swap",
        paper_trading_comparison_commitment_id: "paper-comparison-role-swap",
        committed_at: "2026-07-10T00:00:02.000Z",
        champion: { ...fixture.preparation.challenger, role: "champion" },
        challenger: { ...fixture.preparation.champion, role: "challenger" },
        champion_selection: {
          selection_kind: "trading_review",
          trading_promotion_ref: {
            record_kind: "trading_promotion",
            id: swappedPromotion.trading_promotion_id
          },
          trading_promotion_digest: comparisonExactRecordDigest(
            paperTradingComparisonTradingPromotionDigestInput(swappedPromotion)
          ),
          paper_trading_evaluation_ref: { ...swappedPromotion.paper_trading_evaluation_ref },
          paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(swappedEvidence.evaluation)
          ),
          paper_trading_evaluation_commitment_ref: {
            record_kind: "paper_trading_evaluation_commitment",
            id: swappedEvidence.commitment.paper_trading_evaluation_commitment_id
          },
          paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(swappedEvidence.commitment)
          ),
          paper_trading_observation_chain_digest: comparisonExactRecordDigest(
            paperTradingComparisonObservationChainDigestInput(swappedEvidence.observations)
          )
        },
        preparation_digest: ""
      })),
      "paper_trading_comparison_champion_selection_mismatch"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([
      fixture.preparation
    ]);
    await expect(store.listTradingRunsForCandidateVersion(
      fixture.preparation.champion.candidate_version_ref.id
    )).resolves.toEqual(championRunsBefore);
    await expect(store.listTradingRunsForCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    )).resolves.toEqual(challengerRunsAfterRoleSwapEvidence);
  });

  it("serializes concurrent paper comparison preparation reservations for one candidate-version pair", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const competing = withPreparationDigest({
      ...fixture.preparation,
      paper_trading_comparison_preparation_id: "paper-comparison-preparation-competing",
      paper_trading_comparison_commitment_id: "paper-comparison-competing",
      preparation_digest: ""
    });
    const results = await Promise.allSettled([
      store.reservePaperTradingComparisonPreparation(fixture.preparation),
      store.reservePaperTradingComparisonPreparation(competing)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({
      code: "paper_trading_comparison_active_pair_conflict"
    });
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toHaveLength(1);
  });

  it("persists one exact terminal paper comparison verdict with idempotent replay", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPairedCheckpointAttributionFixture(store);
    const finalOutcome = await stopBothRunningRuntimeActivation(store, fixture);
    const verdict = await validIneligibleComparisonVerdict(
      store,
      fixture,
      finalOutcome
    );

    const first = await store.recordPaperTradingComparisonVerdict(verdict);
    const replay = await store.recordPaperTradingComparisonVerdict(verdict);

    expect(first).toEqual(verdict);
    expect(replay).toEqual(verdict);
    await expect(store.getPaperTradingComparisonVerdict(
      verdict.paper_trading_comparison_verdict_id
    )).resolves.toEqual(verdict);
    await expect(store.listPaperTradingComparisonVerdicts(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([verdict]);
    const reloaded = new LocalStore(tmpDir);
    await expect(reloaded.getPaperTradingComparisonVerdict(
      verdict.paper_trading_comparison_verdict_id
    )).resolves.toEqual(verdict);
  });

  it.each([
    ["malformed-shape", "invalid_paper_trading_comparison_verdict_input", (value: any) => {
      value.confirmation_count = 1;
      return value;
    }],
    ["digest-drift", "paper_trading_comparison_verdict_digest_mismatch", (value: any) => ({
      ...value,
      verdict_digest: "sha256:stale"
    })],
    ["final-outcome-drift", "paper_trading_comparison_verdict_graph_invalid", (value: any) =>
      withComparisonVerdictDigest({
        ...value,
        final_activation_outcome_ref: {
          ...value.final_activation_outcome_ref,
          id: "missing-final-outcome"
        },
        verdict_digest: ""
      })],
    ["side-digest-drift", "paper_trading_comparison_verdict_graph_invalid", (value: any) =>
      withComparisonVerdictDigest({
        ...value,
        champion: {
          ...value.champion,
          paper_trading_evaluation_record_digest: "sha256:stale-evaluation"
        },
        verdict_digest: ""
      })],
    ["qualification-count-drift", "paper_trading_comparison_verdict_graph_invalid", (value: any) => {
      const pairQualification = {
        ...value.pair_qualification,
        checkpoint_count: 0
      };
      return withComparisonVerdictDigest({
        ...value,
        pair_qualification: pairQualification,
        pair_qualification_digest: comparisonRecordDigest(
          paperTradingComparisonQualificationResultDigestInput(pairQualification)
        ),
        verdict_digest: ""
      });
    }],
    ["qualification-evidence-drift", "paper_trading_comparison_verdict_graph_invalid", (value: any) => {
      const pairQualification = {
        ...value.pair_qualification,
        champion: {
          ...value.pair_qualification.champion,
          evidence_window: {
            ...value.pair_qualification.champion.evidence_window,
            observation_count:
              value.pair_qualification.champion.evidence_window.observation_count + 1
          }
        }
      };
      return withComparisonVerdictDigest({
        ...value,
        pair_qualification: pairQualification,
        pair_qualification_digest: comparisonRecordDigest(
          paperTradingComparisonQualificationResultDigestInput(pairQualification)
        ),
        verdict_digest: ""
      });
    }]
  ])("rejects paper comparison verdict %s", async (_label, code, mutate) => {
    const store = new LocalStore(path.join(tmpDir, _label));
    await store.initialize();
    const fixture = await storedPairedCheckpointAttributionFixture(store);
    const finalOutcome = await stopBothRunningRuntimeActivation(store, fixture);
    const verdict = await validIneligibleComparisonVerdict(
      store,
      fixture,
      finalOutcome
    );

    await expectStoreError(
      store.recordPaperTradingComparisonVerdict(mutate(verdict)),
      code
    );
  });

  it("rejects changed replay and a second verdict for one comparison", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPairedCheckpointAttributionFixture(store);
    const finalOutcome = await stopBothRunningRuntimeActivation(store, fixture);
    const verdict = await validIneligibleComparisonVerdict(
      store,
      fixture,
      finalOutcome
    );
    await store.recordPaperTradingComparisonVerdict(verdict);
    const changedReplay = withComparisonVerdictDigest({
      ...verdict,
      evaluated_at: new Date(Date.parse(verdict.evaluated_at) + 1).toISOString(),
      verdict_digest: ""
    });
    const secondVerdict = withComparisonVerdictDigest({
      ...verdict,
      paper_trading_comparison_verdict_id: `${verdict.paper_trading_comparison_verdict_id}-2`,
      verdict_digest: ""
    });

    await expectStoreError(
      store.recordPaperTradingComparisonVerdict(changedReplay),
      "paper_trading_comparison_verdict_conflict"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonVerdict(secondVerdict),
      "paper_trading_comparison_verdict_conflict"
    );
  });

  it("releases an active candidate-version pair only after a terminal verdict", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPairedCheckpointAttributionFixture(store);
    const finalOutcome = await stopBothRunningRuntimeActivation(store, fixture);
    const nextPreparation = withPreparationDigest({
      ...fixture.preparation,
      paper_trading_comparison_preparation_id:
        "paper-comparison-preparation-after-verdict",
      paper_trading_comparison_commitment_id: "paper-comparison-after-verdict",
      committed_at: new Date(
        Date.parse(finalOutcome.completed_at) + 1_000
      ).toISOString(),
      preparation_digest: ""
    });

    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(nextPreparation),
      "paper_trading_comparison_active_pair_conflict"
    );
    const verdict = await validIneligibleComparisonVerdict(
      store,
      fixture,
      finalOutcome
    );
    await store.recordPaperTradingComparisonVerdict(verdict);

    await expect(store.reservePaperTradingComparisonPreparation(nextPreparation))
      .resolves.toEqual(nextPreparation);
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([
      fixture.preparation,
      nextPreparation
    ]);
  });

  it("persists and exactly replays one sealed paper confirmation campaign", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);

    const first = await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    const replay = await store.recordPaperTradingComparisonConfirmationCampaign(campaign);

    expect(first).toEqual(campaign);
    expect(replay).toEqual(campaign);
    await expect(store.getPaperTradingComparisonConfirmationCampaign(
      campaign.paper_trading_comparison_confirmation_campaign_id
    )).resolves.toEqual(campaign);
    await expect(store.listPaperTradingComparisonConfirmationCampaigns())
      .resolves.toEqual([campaign]);
    const reloaded = new LocalStore(tmpDir);
    await expect(reloaded.getPaperTradingComparisonConfirmationCampaign(
      campaign.paper_trading_comparison_confirmation_campaign_id
    )).resolves.toEqual(campaign);
  });

  it("rejects malformed, drifted, changed, and duplicate-source confirmation campaigns", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);

    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign({
        ...campaign,
        release_status: "released"
      } as never),
      "invalid_paper_trading_comparison_confirmation_campaign_input"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign({
        ...campaign,
        campaign_digest: "sha256:stale"
      }),
      "paper_trading_comparison_confirmation_campaign_digest_mismatch"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(
        withConfirmationCampaignDigest({
          ...campaign,
          source_comparison_digest: "sha256:wrong-source-comparison",
          campaign_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_graph_invalid"
    );
    const driftedSlots = structuredClone(campaign.slots);
    driftedSlots[0]!.paper_trading_comparison_commitment_id =
      "paper-trading-comparison-0000000000000000";
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(
        withConfirmationCampaignDigest({
          ...campaign,
          slots: driftedSlots,
          campaign_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_graph_invalid"
    );
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(
        withConfirmationCampaignDigest({
          ...campaign,
          committed_at: new Date(Date.parse(campaign.committed_at) + 1).toISOString(),
          campaign_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_conflict"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(
        validPaperTradingComparisonConfirmationCampaign(
          fixture,
          "paper-confirmation-campaign-store-duplicate-source"
        )
      ),
      "paper_trading_comparison_confirmation_campaign_source_conflict"
    );
  });

  it("lets only the exact ready confirmation slot own an active campaign pair", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    const slot1 = confirmationSlotPreparation(fixture, campaign, 1);
    const slot2 = confirmationSlotPreparation(fixture, campaign, 2);
    const arbitrary = withPreparationDigest({
      ...slot1,
      paper_trading_comparison_preparation_id: "paper-comparison-arbitrary-campaign",
      paper_trading_comparison_commitment_id: "paper-comparison-arbitrary-campaign",
      preparation_digest: ""
    });
    const driftedPolicy = withPreparationDigest({
      ...slot1,
      comparison_policy: {
        ...slot1.comparison_policy,
        minimum_net_revenue_lift_usdt:
          slot1.comparison_policy.minimum_net_revenue_lift_usdt + 1
      },
      preparation_digest: ""
    });
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);

    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(arbitrary),
      "paper_trading_comparison_active_campaign_pair_conflict"
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(driftedPolicy),
      "paper_trading_comparison_active_campaign_pair_conflict"
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(slot2),
      "paper_trading_comparison_confirmation_slot_not_ready"
    );
    await expect(store.reservePaperTradingComparisonPreparation(slot1))
      .resolves.toEqual(slot1);
    await expect(store.reservePaperTradingComparisonPreparation(slot1))
      .resolves.toEqual(slot1);

    const slot1Verdict = withComparisonVerdictDigest({
      ...fixture.verdict,
      paper_trading_comparison_verdict_id:
        `${campaign.slots[0]!.paper_trading_comparison_commitment_id}-verdict`,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: campaign.slots[0]!.paper_trading_comparison_commitment_id
      },
      paper_trading_comparison_commitment_digest: "sha256:confirmation-slot-1",
      pair_qualification: {
        ...fixture.verdict.pair_qualification,
        comparison_id: campaign.slots[0]!.paper_trading_comparison_commitment_id
      },
      pair_qualification_digest: comparisonRecordDigest(
        paperTradingComparisonQualificationResultDigestInput({
          ...fixture.verdict.pair_qualification,
          comparison_id: campaign.slots[0]!.paper_trading_comparison_commitment_id
        })
      ),
      window_started_at: new Date(Date.parse(campaign.committed_at) + 11_000)
        .toISOString(),
      window_ended_at: new Date(Date.parse(campaign.committed_at) + 12_000)
        .toISOString(),
      evaluated_at: new Date(Date.parse(campaign.committed_at) + 13_000)
        .toISOString(),
      verdict_digest: ""
    });
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-verdicts",
      slot1Verdict.paper_trading_comparison_verdict_id,
      slot1Verdict
    );

    await expect(store.reservePaperTradingComparisonPreparation(slot2))
      .resolves.toEqual(slot2);
  });

  it("rejects a confirmation campaign whose exact source verdict did not improve", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store, 2);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);

    expect(fixture.verdict.verdict_outcome).toBe("challenger_not_improved");
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(campaign),
      "paper_trading_comparison_confirmation_campaign_graph_invalid"
    );
  });

  it("rejects a confirmation campaign while a standalone comparison owns its pair", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    const standalone = withPreparationDigest({
      ...structuredClone(fixture.preparation),
      paper_trading_comparison_preparation_id:
        "paper-comparison-preparation-standalone-before-campaign",
      paper_trading_comparison_commitment_id:
        "paper-comparison-standalone-before-campaign",
      committed_at: new Date(Date.parse(fixture.verdict.evaluated_at) + 1_000)
        .toISOString(),
      preparation_digest: ""
    });
    await store.reservePaperTradingComparisonPreparation(standalone);

    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaign(campaign),
      "paper_trading_comparison_active_campaign_pair_conflict"
    );
  });

  it("enforces a confirmation campaign slot-1 first-tick deadline", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    const slot = await storedConfirmationSlotComparison(store, fixture, campaign, 1);
    const maximumDelay = campaign.campaign_policy.maximum_slot_start_delay_ms;

    await expectStoreError(
      store.recordPaperTradingComparisonTick(confirmationSlotFirstTick(
        slot.comparison,
        campaign.committed_at,
        1
      )),
      "paper_trading_comparison_confirmation_first_tick_time_mismatch"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonTick(confirmationSlotFirstTick(
        slot.comparison,
        new Date(Date.parse(campaign.committed_at) + maximumDelay + 1).toISOString(),
        1
      )),
      "paper_trading_comparison_confirmation_first_tick_time_mismatch"
    );
    const tick = confirmationSlotFirstTick(
      slot.comparison,
      new Date(Date.parse(campaign.committed_at) + 20_000).toISOString(),
      1
    );
    await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
    await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
  });

  it("enforces strict predecessor closure and deadline for a later campaign first tick", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    const slot1 = await storedConfirmationSlotComparison(store, fixture, campaign, 1);
    const slot1Tick = confirmationSlotFirstTick(
      slot1.comparison,
      new Date(Date.parse(campaign.committed_at) + 11_000).toISOString(),
      1
    );
    await store.recordPaperTradingComparisonTick(slot1Tick);
    const priorVerdict = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      1,
      "challenger_improved"
    );
    const slot = await storedConfirmationSlotComparison(store, fixture, campaign, 2);
    const maximumDelay = campaign.campaign_policy.maximum_slot_start_delay_ms;

    for (const observedAt of [
      priorVerdict.window_ended_at,
      priorVerdict.evaluated_at,
      new Date(Date.parse(priorVerdict.evaluated_at) + maximumDelay + 1).toISOString()
    ]) {
      await expectStoreError(
        store.recordPaperTradingComparisonTick(confirmationSlotFirstTick(
          slot.comparison,
          observedAt,
          2
        )),
        "paper_trading_comparison_confirmation_first_tick_time_mismatch"
      );
    }
    const tick = confirmationSlotFirstTick(
      slot.comparison,
      new Date(Date.parse(campaign.committed_at) + 21_000).toISOString(),
      2
    );
    await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
  });

  it("persists a complete confirmed campaign outcome and releases its pair", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    const slot1 = await storedConfirmationSlotComparison(store, fixture, campaign, 1);
    const slot1Tick = confirmationSlotFirstTick(
      slot1.comparison,
      new Date(Date.parse(campaign.committed_at) + 11_000).toISOString(),
      1
    );
    await store.recordPaperTradingComparisonTick(slot1Tick);
    const slot1Verdict = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      1,
      "challenger_improved"
    );
    await storedConfirmationSlotComparison(store, fixture, campaign, 2);
    const slot2Verdict = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      2,
      "challenger_improved"
    );
    const outcome = validConfirmationCampaignOutcome(
      campaign,
      [slot1Verdict, slot2Verdict]
    );
    const arbitrary = withPreparationDigest({
      ...confirmationSlotPreparation(fixture, campaign, 2),
      paper_trading_comparison_preparation_id:
        "paper-comparison-preparation-after-campaign-outcome",
      paper_trading_comparison_commitment_id:
        "paper-comparison-after-campaign-outcome",
      committed_at: new Date(Date.parse(outcome.evaluated_at) + 1_000).toISOString(),
      preparation_digest: ""
    });

    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(arbitrary),
      "paper_trading_comparison_active_campaign_pair_conflict"
    );
    await expect(store.recordPaperTradingComparisonConfirmationCampaignOutcome(outcome))
      .resolves.toEqual(outcome);
    await expect(store.recordPaperTradingComparisonConfirmationCampaignOutcome(outcome))
      .resolves.toEqual(outcome);
    await expect(store.getPaperTradingComparisonConfirmationCampaignOutcome(
      outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    )).resolves.toEqual(outcome);
    await expect(store.listPaperTradingComparisonConfirmationCampaignOutcomes(
      campaign.paper_trading_comparison_confirmation_campaign_id
    )).resolves.toEqual([outcome]);
    const reloaded = new LocalStore(tmpDir);
    await expect(reloaded.getPaperTradingComparisonConfirmationCampaignOutcome(
      outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    )).resolves.toEqual(outcome);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      slot1.champion.evaluation.paper_trading_evaluation_id,
      {
        ...slot1.champion.evaluation,
        status: "stopped",
        next_observation_at: undefined,
        stopped_at: new Date(Date.parse(outcome.evaluated_at) - 1).toISOString()
      }
    );
    await expect(store.recordPaperTradingComparisonTick(slot1Tick))
      .resolves.toEqual(slot1Tick);
    await expectStoreError(
      store.recordPaperTradingComparisonTick(withTickDigest({
        ...slot1Tick,
        paper_trading_comparison_tick_id: `${slot1Tick.paper_trading_comparison_tick_id}-late`,
        tick_digest: ""
      })),
      "paper_trading_comparison_confirmation_campaign_terminal"
    );
    await expect(store.reservePaperTradingComparisonPreparation(arbitrary))
      .resolves.toEqual(arbitrary);
  });

  it.each([
    ["not-improved", "challenger_not_improved", "challenger_not_improved"],
    ["ineligible", "comparison_ineligible", "comparison_ineligible"],
    ["expired", "slot_expired", undefined]
  ] as const)("persists a complete %s campaign outcome", async (
    label,
    expectedStatus,
    secondVerdictStatus
  ) => {
    const store = new LocalStore(path.join(tmpDir, label));
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    await storedConfirmationSlotComparison(store, fixture, campaign, 1);
    const first = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      1,
      "challenger_improved"
    );
    let outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
    if (secondVerdictStatus) {
      await storedConfirmationSlotComparison(store, fixture, campaign, 2);
      const second = await seedConfirmationSlotVerdict(
        store,
        fixture,
        campaign,
        2,
        secondVerdictStatus
      );
      outcome = validConfirmationCampaignOutcome(campaign, [first, second]);
    } else {
      outcome = validExpiredConfirmationCampaignOutcome(campaign, [first]);
      await expectStoreError(
        store.recordPaperTradingComparisonConfirmationCampaignOutcome(
          withConfirmationCampaignOutcomeDigest({
            ...outcome,
            evaluated_at: new Date(
              Date.parse(first.evaluated_at) +
                campaign.campaign_policy.maximum_slot_start_delay_ms
            ).toISOString(),
            outcome_digest: ""
          })
        ),
        "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid"
      );
    }

    await expect(store.recordPaperTradingComparisonConfirmationCampaignOutcome(outcome))
      .resolves.toMatchObject({
        campaign_outcome: "not_confirmed",
        promotion_eligibility: "not_eligible",
        next_action: "return_to_candidate_arena",
        slot_results: [{ status: "challenger_improved" }, { status: expectedStatus }]
      });
  });

  it("rejects incomplete, drifted, foreign, and changed campaign outcomes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedQualifiedComparisonVerdictFixture(store);
    const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
    await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
    await storedConfirmationSlotComparison(store, fixture, campaign, 1);
    const first = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      1,
      "challenger_improved"
    );
    await storedConfirmationSlotComparison(store, fixture, campaign, 2);
    const second = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      2,
      "challenger_improved"
    );
    const outcome = validConfirmationCampaignOutcome(campaign, [first, second]);

    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome({
        ...outcome,
        outcome_digest: "sha256:stale"
      }),
      "paper_trading_comparison_confirmation_campaign_outcome_digest_mismatch"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome({
        ...outcome,
        slot_results: outcome.slot_results.slice(0, 1)
      } as never),
      "invalid_paper_trading_comparison_confirmation_campaign_outcome_input"
    );
    const staleVerdictResults = structuredClone(outcome.slot_results);
    staleVerdictResults[1]!.verdict_digest = "sha256:stale-verdict";
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome(
        withConfirmationCampaignOutcomeDigest({
          ...outcome,
          slot_results: staleVerdictResults,
          outcome_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid"
    );
    const foreignResults = structuredClone(outcome.slot_results);
    foreignResults[1]!.paper_trading_comparison_commitment_ref.id =
      "foreign-comparison";
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome(
        withConfirmationCampaignOutcomeDigest({
          ...outcome,
          slot_results: foreignResults,
          outcome_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_outcome_graph_invalid"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome(
        withConfirmationCampaignOutcomeDigest({
          ...outcome,
          improved_count: 1,
          not_improved_count: 1,
          outcome_digest: ""
        })
      ),
      "invalid_paper_trading_comparison_confirmation_campaign_outcome_input"
    );
    await store.recordPaperTradingComparisonConfirmationCampaignOutcome(outcome);
    await expectStoreError(
      store.recordPaperTradingComparisonConfirmationCampaignOutcome(
        withConfirmationCampaignOutcomeDigest({
          ...outcome,
          evaluated_at: new Date(Date.parse(outcome.evaluated_at) + 1).toISOString(),
          outcome_digest: ""
        })
      ),
      "paper_trading_comparison_confirmation_campaign_outcome_conflict"
    );
  });

  it("persists, materializes, and exactly replays one comparison research release", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(store);

    await expect(store.recordPaperTradingComparisonResearchRelease(fixture.release))
      .resolves.toEqual(fixture.release);
    await expect(store.recordPaperTradingComparisonResearchRelease(fixture.release))
      .resolves.toEqual(fixture.release);
    await expect(store.getPaperTradingComparisonResearchRelease(
      fixture.release.paper_trading_comparison_research_release_id
    )).resolves.toEqual(fixture.release);
    await expect(store.listPaperTradingComparisonResearchReleases())
      .resolves.toEqual([fixture.release]);
    await expect(store.listResearchFindings()).resolves.toContainEqual(
      fixture.release.finding
    );
    await expect(store.listArtifactLineages()).resolves.toContainEqual(
      fixture.release.lineage
    );

    const reloaded = new LocalStore(tmpDir);
    await reloaded.initialize();
    await expect(reloaded.getPaperTradingComparisonResearchRelease(
      fixture.release.paper_trading_comparison_research_release_id
    )).resolves.toEqual(fixture.release);
    expect((await reloaded.listResearchFindings()).filter((finding) =>
      finding.research_finding_id === fixture.release.finding.research_finding_id
    )).toHaveLength(1);
    expect((await reloaded.listArtifactLineages()).filter((lineage) =>
      lineage.artifact_lineage_id === fixture.release.lineage.artifact_lineage_id
    )).toHaveLength(1);
  });

  it.each([
    ["campaign digest", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.comparison_confirmation.campaign_digest =
        "sha256:stale-campaign";
    }],
    ["outcome digest", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.comparison_confirmation.campaign_outcome_digest =
        "sha256:stale-outcome";
    }],
    ["final verdict digest", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.comparison_confirmation.final_verdict_digest =
        "sha256:stale-verdict";
    }],
    ["challenger candidate", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.candidate_ref = {
        ...fixture.campaign.champion.candidate_ref
      };
    }],
    ["challenger evaluation", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.paper_trading_evaluation_ref = {
        ...fixture.finalVerdict.champion.paper_trading_evaluation_ref
      };
    }],
    ["promotion time", (fixture: Awaited<ReturnType<
      typeof storedComparisonBackedTradingPromotionFixture
    >>) => {
      fixture.promotion.promoted_at = fixture.outcome.evaluated_at;
    }]
  ])("rejects comparison-backed TradingPromotion %s drift", async (
    label,
    mutate
  ) => {
    const store = new LocalStore(path.join(tmpDir, label.replaceAll(" ", "-")));
    await store.initialize();
    const fixture = await storedComparisonBackedTradingPromotionFixture(store);
    mutate(fixture);

    await expectStoreError(
      store.recordTradingPromotion(fixture.promotion),
      "trading_promotion_graph_invalid"
    );
  });

  it("rejects same-ID TradingPromotion mutation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonBackedTradingPromotionFixture(store);
    await overwriteComparisonFixtureRecord(
      store,
      "trading-promotions",
      fixture.promotion.trading_promotion_id,
      fixture.promotion
    );

    await expectStoreError(
      store.recordTradingPromotion({
        ...fixture.promotion,
        promoted_at: new Date(
          Date.parse(fixture.promotion.promoted_at) + 1
        ).toISOString()
      }),
      "trading_promotion_conflict"
    );
  });

  it.each([
    ["challenger_not_reproduced", "negative_result"],
    ["comparison_evidence_ineligible", "failure_analysis"],
    ["campaign_slot_expired", "failure_analysis"]
  ] as const)("persists and materializes %s campaign research evidence", async (
    releaseKind,
    findingKind
  ) => {
    const store = new LocalStore(path.join(tmpDir, releaseKind));
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(
      store,
      releaseKind
    );

    await expect(store.recordPaperTradingComparisonResearchRelease(fixture.release))
      .resolves.toMatchObject({
        release_kind: releaseKind,
        finding: { finding_kind: findingKind }
      });
    await expect(store.listResearchFindings()).resolves.toContainEqual(
      fixture.release.finding
    );
    await expect(store.listArtifactLineages()).resolves.toContainEqual(
      fixture.release.lineage
    );
    expect(fixture.release.finding.supporting_record_refs.map((ref) => ref.id))
      .not.toContain(fixture.campaign.source_verdict_ref.id);
  });

  it("recovers release materialization after a bundle-first crash", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(store);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-research-releases",
      fixture.release.paper_trading_comparison_research_release_id,
      fixture.release
    );

    expect((await store.listResearchFindings()).some((finding) =>
      finding.research_finding_id === fixture.release.finding.research_finding_id
    )).toBe(false);
    expect((await store.listArtifactLineages()).some((lineage) =>
      lineage.artifact_lineage_id === fixture.release.lineage.artifact_lineage_id
    )).toBe(false);

    const reloaded = new LocalStore(tmpDir);
    await reloaded.initialize();
    await expect(reloaded.recoverPaperTradingComparisonResearchReleases())
      .resolves.toEqual([fixture.release]);
    expect((await reloaded.listResearchFindings()).filter((finding) =>
      finding.research_finding_id === fixture.release.finding.research_finding_id
    )).toHaveLength(1);
    expect((await reloaded.listArtifactLineages()).filter((lineage) =>
      lineage.artifact_lineage_id === fixture.release.lineage.artifact_lineage_id
    )).toHaveLength(1);
  });

  it("rejects malformed, missing, late, and conflicting release authority", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(store);

    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease({
        ...fixture.release,
        promotion_authority: true
      } as never),
      "invalid_paper_trading_comparison_research_release_input"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease({
        ...fixture.release,
        release_digest: "sha256:stale-release"
      }),
      "paper_trading_comparison_research_release_digest_mismatch"
    );

    const outcomePath = path.join(
      store.root(),
      "paper-trading-comparison-confirmation-campaign-outcomes/items",
      `${encodeURIComponent(
        fixture.outcome.paper_trading_comparison_confirmation_campaign_outcome_id
      )}.json`
    );
    await rm(outcomePath);
    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease(fixture.release),
      "paper_trading_comparison_research_release_reference_not_found"
    );
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-confirmation-campaign-outcomes",
      fixture.outcome.paper_trading_comparison_confirmation_campaign_outcome_id,
      fixture.outcome
    );

    const lateSourceLineage = {
      ...fixture.sourceLineage,
      created_at: new Date(
        Date.parse(fixture.challengerAdmission.decided_at) + 1
      ).toISOString()
    };
    await overwriteComparisonFixtureRecord(
      store,
      "artifact-lineages",
      lateSourceLineage.artifact_lineage_id,
      lateSourceLineage
    );
    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease(
        withPaperTradingComparisonResearchReleaseDigests({
          ...fixture.release,
          source_lineage_record_digest: comparisonRecordDigest(
            paperTradingComparisonPersistedRecordDigestInput(lateSourceLineage)
          )
        })
      ),
      "paper_trading_comparison_research_release_graph_invalid"
    );
    await overwriteComparisonFixtureRecord(
      store,
      "artifact-lineages",
      fixture.sourceLineage.artifact_lineage_id,
      fixture.sourceLineage
    );

    await store.recordResearchFinding({
      ...fixture.release.finding,
      summary: `${fixture.release.finding.summary} conflict`
    });
    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease(fixture.release),
      "paper_trading_comparison_research_release_materialization_conflict"
    );
    await expect(store.getPaperTradingComparisonResearchRelease(
      fixture.release.paper_trading_comparison_research_release_id
    )).resolves.toBeUndefined();
  });

  it.each([
    ["challenger identity", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.candidate_ref.id = "foreign-candidate";
    }],
    ["candidate direction", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.direction_kind = "trend_following";
    }],
    ["campaign digest", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.campaign_digest = "sha256:foreign-campaign";
    }],
    ["source finding digest", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.source_finding_record_digest = "sha256:foreign-finding";
    }],
    ["classification", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.release_kind = "challenger_not_reproduced";
      value.finding.finding_kind = "negative_result";
    }],
    ["supporting refs", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.finding.supporting_record_refs.push({
        record_kind: "paper_trading_comparison_verdict",
        id: "foreign-verdict"
      });
    }],
    ["lineage parent", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.lineage.parent_system_code_ref = {
        record_kind: "system_code",
        id: "foreign-parent"
      };
    }],
    ["release timestamp", (value: PaperTradingComparisonResearchReleaseRecord) => {
      value.released_at = "2026-07-09T00:00:00.000Z";
      value.finding.created_at = value.released_at;
      value.lineage.created_at = value.released_at;
    }]
  ])("rejects comparison research release %s drift", async (_label, mutate) => {
    const store = new LocalStore(path.join(tmpDir, _label));
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(store);
    const release = structuredClone(fixture.release);
    mutate(release);

    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease(
        withPaperTradingComparisonResearchReleaseDigests(release)
      ),
      _label === "challenger identity"
        ? "paper_trading_comparison_research_release_reference_not_found"
        : "paper_trading_comparison_research_release_graph_invalid"
    );
  });

  it("freezes release-bound Finding and Lineage while accepting exact replay", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedPaperTradingComparisonResearchReleaseFixture(store);
    await store.recordPaperTradingComparisonResearchRelease(fixture.release);

    await expect(store.recordResearchFinding(fixture.release.finding))
      .resolves.toEqual(fixture.release.finding);
    await expect(store.recordArtifactLineage(fixture.release.lineage))
      .resolves.toEqual(fixture.release.lineage);
    await expectStoreError(
      store.recordResearchFinding({
        ...fixture.release.finding,
        summary: `${fixture.release.finding.summary} drift`
      }),
      "paper_trading_comparison_research_release_bound_record_conflict"
    );
    await expectStoreError(
      store.recordArtifactLineage({
        ...fixture.release.lineage,
        parent_system_code_ref: {
          record_kind: "system_code",
          id: "foreign-parent"
        }
      }),
      "paper_trading_comparison_research_release_bound_record_conflict"
    );
    const changedReplay = structuredClone(fixture.release);
    changedReplay.next_research_focus = `${changedReplay.next_research_focus} drift`;
    await expectStoreError(
      store.recordPaperTradingComparisonResearchRelease(
        withPaperTradingComparisonResearchReleaseDigests(changedReplay)
      ),
      "paper_trading_comparison_research_release_conflict"
    );
  });

  it.each(["evaluation-mutation", "observation-append"] as const)(
    "freezes selected paper comparison promotion evidence before any side write: %s",
    async (writer) => {
      const store = new LocalStore(path.join(tmpDir, writer));
      await store.initialize();
      const fixture = await comparisonPreparationFixture(store);
      const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
      const evaluationsBefore = await store.listPaperTradingEvaluations();
      await store.reservePaperTradingComparisonPreparation(fixture.preparation);
      const promotionEvidenceBefore = await promotionEvidenceSnapshot(store, fixture);
      await expectStoreError(
        invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
        "paper_trading_comparison_frozen_authority_write_conflict"
      );
      await expect(promotionEvidenceSnapshot(store, fixture)).resolves.toEqual(
        promotionEvidenceBefore
      );
      await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
        commitmentsBefore
      );
      await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
      await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    }
  );

  it.each(["evaluation-mutation", "observation-append"] as const)(
    "keeps selected paper comparison promotion evidence frozen after side creation: %s",
    async (writer) => {
      const store = new LocalStore(path.join(tmpDir, `after-sides-${writer}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      const sideBefore = await boundComparisonEvidenceSnapshot(store, fixture);
      const promotionBefore = await promotionEvidenceSnapshot(store, fixture);
      await expectStoreError(
        invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
        "paper_trading_comparison_frozen_authority_write_conflict"
      );
      await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(sideBefore);
      await expect(promotionEvidenceSnapshot(store, fixture)).resolves.toEqual(promotionBefore);
      await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    }
  );

  it.each(["evaluation-mutation", "observation-append"] as const)(
    "keeps selected paper comparison promotion evidence byte-identical after pair append: %s",
    async (writer) => {
      const store = new LocalStore(path.join(tmpDir, `after-pair-${writer}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      const before = {
        promotion: await promotionEvidenceSnapshot(store, fixture),
        graphBytes: await comparisonGraphByteSnapshot(store)
      };
      await expectStoreError(
        invokeFrozenPromotionEvidenceWriter(store, fixture, writer),
        "paper_trading_comparison_frozen_authority_write_conflict"
      );
      await expect(promotionEvidenceSnapshot(store, fixture)).resolves.toEqual(before.promotion);
      await expect(comparisonGraphByteSnapshot(store)).resolves.toEqual(before.graphBytes);
    }
  );

  it("atomically appends a valid paper comparison pair before a concurrent side mutation", async () => {
    const store = new InterleavingComparisonLocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    store.pauseExactRunRead();
    const pairAppend = store.recordPaperTradingComparisonCommitment(fixture.comparison);
    await store.exactRunReadEntered;
    const activeTransactionTail = store.comparisonTransactionTail();
    const sideMutation = store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      latest_score: {
        revenue_usdt: 1,
        cost_usdt: 0,
        net_revenue_usdt: 1,
        net_return_pct: 0.0001
      }
    });
    await expectComparisonWriterQueued(store, activeTransactionTail, sideMutation);
    store.releaseExactRunRead();
    await expect(pairAppend).resolves.toEqual(fixture.comparison);
    await expectStoreError(
      sideMutation,
      "paper_trading_comparison_inert_graph_mutation_forbidden"
    );
    await expect(store.getPaperTradingEvaluation(
      fixture.challengerEvaluation.paper_trading_evaluation_id
    )).resolves.toEqual(fixture.challengerEvaluation);
  });

  it("rejects paper comparison pair append when a side mutation wins the evidence transaction", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      latest_score: {
        revenue_usdt: 1,
        cost_usdt: 0,
        net_revenue_usdt: 1,
        net_return_pct: 0.0001
      }
    });
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(fixture.comparison),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  });

  const controlledPairWriterKinds = [
    "create-run-exact",
    "alternate-commitment",
    "alternate-commitment-evaluation-chain",
    "evaluation",
    "observation",
    "ledger",
    "run-control",
    "sandbox-start"
  ] as const;

  it.each(controlledPairWriterKinds)(
    "holds representative paper comparison %s writer behind pair validation",
    async (writer) => {
      const store = new InterleavingComparisonLocalStore(path.join(tmpDir, writer));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      store.pauseExactRunRead();
      const pairAppend = store.recordPaperTradingComparisonCommitment(fixture.comparison);
      await store.exactRunReadEntered;
      const activeTransactionTail = store.comparisonTransactionTail();
      const sideWriter = invokeBoundSideWriter(store, fixture, writer);
      await expectComparisonWriterQueued(store, activeTransactionTail, sideWriter);
      store.releaseExactRunRead();
      await expect(pairAppend).resolves.toEqual(fixture.comparison);
      if (writer === "create-run-exact") {
        await expect(sideWriter).resolves.toEqual(fixture.challengerRun);
      } else {
        await expectStoreError(
          sideWriter,
          "paper_trading_comparison_inert_graph_mutation_forbidden"
        );
      }
    }
  );

  it.each([
    "candidate-version-runtime",
    "system-code-entrypoint",
    "admission-content",
    "promotion-content",
    "promotion-evaluation-content",
    "promotion-commitment-content",
    "promotion-observation-content"
  ] as const)("rejects frozen paper comparison same-ID drift: %s", async (drift) => {
    const store = new LocalStore(path.join(tmpDir, drift));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    await store.reservePaperTradingComparisonPreparation(fixture.preparation);
    const tradingRunFilesBefore = (await readdir(
      path.join(store.root(), "trading-runs", "items")
    )).sort();
    if (drift === "candidate-version-runtime") {
      const record = (await store.getCandidateVersion(
        fixture.preparation.champion.candidate_version_ref.id
      ))!;
      await overwriteComparisonFixtureRecord(store, "candidate-versions", record.candidate_version_id, {
        ...record,
        runtime_ref: { record_kind: "trading_run", id: "same-id-drifted-default-run" }
      });
    } else if (drift === "system-code-entrypoint") {
      const record = (await store.getSystemCode(
        fixture.preparation.champion.system_code_ref.id
      ))!;
      await overwriteComparisonFixtureRecord(store, "system-codes", record.system_code_id, {
        ...record,
        entrypoint: ["python3", "same-id-drifted.py"],
        capability_policy_ref: {
          record_kind: "capability_policy",
          id: "same-id-drifted-capability-policy"
        }
      });
    } else if (drift === "admission-content") {
      const record = (await store.getCandidateAdmissionDecision(
        fixture.preparation.champion.candidate_admission_decision_ref.id
      ))!;
      await overwriteComparisonFixtureRecord(
        store,
        "candidate-admission-decisions",
        record.candidate_admission_decision_id,
        { ...record, decided_at: "2026-07-09T23:59:58.000Z" }
      );
    } else if (drift === "promotion-content") {
      const selection = fixture.preparation.champion_selection;
      if (selection.selection_kind !== "trading_review") throw new Error("expected selection");
      const record = (await store.getTradingPromotion(selection.trading_promotion_ref.id))!;
      await overwriteComparisonFixtureRecord(store, "trading-promotions", record.trading_promotion_id, {
        ...record,
        paper_trading_evaluation_ref: {
          record_kind: "paper_trading_evaluation",
          id: "same-id-drifted-selection-evaluation"
        }
      });
    } else if (drift === "promotion-evaluation-content") {
      const record = fixture.championPromotionEvidence.evaluation;
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-evaluations",
        record.paper_trading_evaluation_id,
        { ...record, latest_failure_reason: "same-id-promotion-evaluation-drift" }
      );
    } else if (drift === "promotion-commitment-content") {
      const record = fixture.championPromotionEvidence.commitment;
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-evaluation-commitments",
        record.paper_trading_evaluation_commitment_id,
        { ...record, committed_at: "2026-07-09T21:00:00.001Z" }
      );
    } else {
      const [record] = fixture.championPromotionEvidence.observations;
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-observations",
        record!.paper_trading_observation_id,
        { ...record, failure_reason: "same-id-promotion-observation-drift" }
      );
    }
    const commitmentsAfterTestDrift = await store.listPaperTradingEvaluationCommitments();
    const evaluationsAfterTestDrift = await store.listPaperTradingEvaluations();
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(fixture.preparation),
      "paper_trading_comparison_frozen_record_digest_mismatch"
    );
    await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
      commitmentsAfterTestDrift
    );
    await expect(store.listPaperTradingEvaluations()).resolves.toEqual(
      evaluationsAfterTestDrift
    );
    expect((await readdir(path.join(store.root(), "trading-runs", "items"))).sort())
      .toEqual(tradingRunFilesBefore);
  });

  it("keeps current materialization valid when optional record fields persist by omission", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const { system_code_ref: _systemCodeRef, ...withoutOptionalSystemCode } =
      validMaterializationInput();
    const outcome = await store.materializeCandidate(withoutOptionalSystemCode);
    expect(outcome.status).toBe("materialized");
    if (outcome.status !== "materialized") throw new Error("materialization failed");
    const version = await store.getCandidateVersion(
      outcome.candidate.candidate_version.candidate_version_id
    );
    expect(version).toBeDefined();
    expect(Object.hasOwn(version!, "system_code_ref")).toBe(false);
    expect(() => paperTradingComparisonCandidateVersionDigestInput(version!)).not.toThrow();
  });

  const preparationRejectionCases: Array<[string, ComparisonPreparationFixtureOptions]> = [
    ["missing admission", { omitChampionAdmission: true }],
    ["mismatched admission", { mismatchChampionAdmission: true }],
    ["duplicate admission", { championAdmissionStatus: "duplicate" }],
    ["quarantined admission", { championAdmissionStatus: "quarantined" }],
    ["admission after preparation", { futureChampionAdmission: true }],
    ["duplicate stored executable", { duplicateChallengerSystemCode: true }],
    ["missing champion promotion", { omitChampionPromotion: true }],
    ["mismatched champion promotion", { mismatchChampionPromotion: true }],
    ["missing promotion evaluation", { missingPromotionEvaluation: true }],
    ["wrong promotion evaluation refs", { wrongPromotionEvaluationRef: true }],
    ["qualification before champion admission", { preAdmissionQualification: true }],
    ["reversed promotion observation time", { reversePromotionObservationTime: true }],
    ["challenger SystemCode after admission", { challengerSystemCodeAfterAdmission: true }],
    ["promotion after preparation", { futureChampionPromotion: true }],
    ["bootstrap with existing promotion", { comparisonMode: "bootstrap" }]
  ];

  it.each(preparationRejectionCases)(
    "rejects %s before paper comparison preparation or side writes",
    async (_label, options) => {
      const store = new LocalStore(path.join(tmpDir, _label.replaceAll(" ", "-")));
      await store.initialize();
      const fixture = await comparisonPreparationFixture(store, options);
      const runsBefore = await store.listTradingRunsForCandidateVersion(
        fixture.preparation.champion.candidate_version_ref.id
      );
      const commitmentsBefore = await store.listPaperTradingEvaluationCommitments();
      const evaluationsBefore = await store.listPaperTradingEvaluations();
      await expectStoreError(
        store.reservePaperTradingComparisonPreparation(fixture.preparation),
        options.omitChampionAdmission
          ? "paper_trading_comparison_preparation_reference_not_found"
          : options.duplicateChallengerSystemCode
            ? "paper_trading_comparison_duplicate_executable"
            : options.championAdmissionStatus || options.mismatchChampionAdmission ||
                options.futureChampionAdmission || options.challengerSystemCodeAfterAdmission
              ? "paper_trading_comparison_candidate_not_admitted"
              : options.missingPromotionEvaluation
                ? "paper_trading_comparison_preparation_reference_not_found"
                : "paper_trading_comparison_champion_selection_mismatch"
      );
      await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
      await expect(store.listPaperTradingEvaluationCommitments()).resolves.toEqual(
        commitmentsBefore
      );
      await expect(store.listPaperTradingEvaluations()).resolves.toEqual(evaluationsBefore);
      await expect(store.listTradingRunsForCandidateVersion(
        fixture.preparation.champion.candidate_version_ref.id
      )).resolves.toEqual(runsBefore);
    }
  );

  it("isolates the exact paper comparison promotion evaluation ref with a second same-champion chain", async () => {
    const store = new LocalStore(path.join(tmpDir, "same-champion-exact-ref"));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store, {
      wrongPromotionEvaluationRef: true
    });
    const alternate = fixture.alternateChampionPromotionEvidence;
    const selection = fixture.preparation.champion_selection;
    if (!alternate || selection.selection_kind !== "trading_review") {
      throw new Error("alternate promotion evidence missing");
    }
    expect(alternate.commitment.candidate_ref).toEqual(
      fixture.championPromotionEvidence.commitment.candidate_ref
    );
    expect(fixture.promotion.paper_trading_evaluation_ref.id).not.toBe(
      selection.paper_trading_evaluation_ref.id
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(fixture.preparation),
      "paper_trading_comparison_champion_selection_mismatch"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  });

  it.each([
    "malformed-managed-provider",
    "wrong-system-code",
    "nested-fill-source-trade",
    "nested-public-execution-trade"
  ] as const)("rejects semantic paper comparison promotion closure corruption: %s", async (kind) => {
    const store = new LocalStore(path.join(tmpDir, kind));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const evidence = fixture.championPromotionEvidence;
    let commitment = evidence.commitment;
    let evaluation = evidence.evaluation;
    if (kind === "malformed-managed-provider") {
      commitment = withPaperTradingCommitmentDigest({
        ...commitment,
        provider_identity: {
          runtime_provider_kind: "managed_agent",
          agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
          model: {} as never,
          provider_configuration_digest: "sha256:provider",
          qualification_eligible: true
        },
        commitment_digest: ""
      });
    } else if (kind === "wrong-system-code") {
      commitment = withPaperTradingCommitmentDigest({
        ...commitment,
        system_code_ref: { record_kind: "system_code", id: "wrong-frozen-system-code" },
        commitment_digest: ""
      });
    } else if (kind === "nested-fill-source-trade") {
      evaluation = {
        ...evaluation,
        latest_fill: {
          fill_id: "fill-malformed",
          order_id: "order-malformed",
          fill_status: "filled",
          fill_price: "60000",
          fill_quantity: "0.01",
          fee_usdt: "0.1",
          slippage_usdt: "0",
          funding_usdt: "0",
          trade_time: evaluation.stopped_at!,
          source_trade_id: {} as never
        }
      };
    } else {
      evaluation = {
        ...evaluation,
        latest_public_execution_snapshot: {
          symbol: "BTCUSDT",
          observed_at: evaluation.stopped_at!,
          source_kind: "binance_production_public_rest",
          stream_marker: "malformed-aggregate-trade",
          agg_trades: [null] as never,
          authority_status: "read_only"
        }
      };
    }
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      commitment.paper_trading_evaluation_commitment_id,
      commitment
    );
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      evaluation.paper_trading_evaluation_id,
      evaluation
    );
    const selection = fixture.preparation.champion_selection;
    if (selection.selection_kind !== "trading_review") throw new Error("expected selection");
    const preparation = withPreparationDigest({
      ...fixture.preparation,
      champion_selection: {
        ...selection,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
        ),
        paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(evaluation)
        )
      },
      preparation_digest: ""
    });
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(preparation),
      "paper_trading_comparison_champion_selection_mismatch"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  });

  it.each([
    "missing-market",
    "failed-ratio",
    "accounting-discontinuity",
    "bad-commitment-self-digest"
  ] as const)("rejects directly stored unqualified paper comparison promotion evidence: %s", async (kind) => {
    const store = new LocalStore(path.join(tmpDir, `direct-qualification-${kind}`));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const selection = fixture.preparation.champion_selection;
    if (selection.selection_kind !== "trading_review") throw new Error("expected selection");
    let commitment = structuredClone(fixture.championPromotionEvidence.commitment);
    const evaluation = structuredClone(fixture.championPromotionEvidence.evaluation);
    const observations = structuredClone(fixture.championPromotionEvidence.observations);
    if (kind === "missing-market") {
      for (const observation of observations) delete observation.market_snapshot;
    } else if (kind === "failed-ratio") {
      for (const observation of observations.slice(0, 4)) {
        observation.status = "failed";
        observation.failure_reason = "isolated failed-ratio evidence";
      }
    } else if (kind === "accounting-discontinuity") {
      observations[0]!.score_delta.revenue_usdt = 1;
      observations[0]!.cumulative_score.revenue_usdt = 1;
    } else {
      commitment = {
        ...commitment,
        data_identity: {
          ...commitment.data_identity,
          market_data_configuration_digest: "sha256:self-digest-isolated-drift"
        }
      };
    }
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      commitment.paper_trading_evaluation_commitment_id,
      commitment
    );
    for (const observation of observations) {
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-observations",
        observation.paper_trading_observation_id,
        observation
      );
    }
    const preparation = withPreparationDigest({
      ...fixture.preparation,
      champion_selection: {
        ...selection,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
        ),
        paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(evaluation)
        ),
        paper_trading_observation_chain_digest: comparisonExactRecordDigest(
          paperTradingComparisonObservationChainDigestInput(observations)
        )
      },
      preparation_digest: ""
    });
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(preparation),
      "paper_trading_comparison_champion_selection_mismatch"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  });

  it("accepts a key-reordered but semantically identical paper comparison promotion account", async () => {
    const store = new LocalStore(path.join(tmpDir, "qualification-account-key-order"));
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const evaluation = structuredClone(fixture.championPromotionEvidence.evaluation);
    const account = evaluation.paper_account_snapshot;
    if (!account) throw new Error("qualification account missing");
    const reorderedPosition = Object.fromEntries(
      Object.entries(account.position).reverse()
    ) as unknown as PaperTradingAccountSnapshot["position"];
    evaluation.paper_account_snapshot = Object.fromEntries(
      Object.entries(account).reverse().map(([key, value]) =>
        key === "position" ? [key, reorderedPosition] : [key, value]
      )
    ) as unknown as PaperTradingAccountSnapshot;
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      evaluation.paper_trading_evaluation_id,
      evaluation
    );
    await expect(store.reservePaperTradingComparisonPreparation(fixture.preparation))
      .resolves.toEqual(fixture.preparation);
  });

  it("rejects a paper comparison preparation whose sides share one CandidateVersion", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const invalid = withPreparationDigest({
      ...fixture.preparation,
      challenger: {
        ...fixture.preparation.challenger,
        candidate_version_ref: { ...fixture.preparation.champion.candidate_version_ref }
      },
      preparation_digest: ""
    });
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(invalid),
      "invalid_paper_trading_comparison_preparation_input"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  });

  it("records and reloads an exact paper comparison commitment", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    const first = await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const repeated = await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    expect(repeated).toEqual(first);
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([
      fixture.comparison
    ]);
    const reloaded = new LocalStore(tmpDir);
    await expect(reloaded.getPaperTradingComparisonCommitment(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual(fixture.comparison);
  });

  it.each(["evaluation-content", "observation-chain"] as const)(
    "revalidates frozen paper comparison promotion %s before pair append",
    async (drift) => {
      const store = new LocalStore(path.join(tmpDir, `pair-revalidation-${drift}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      if (drift === "evaluation-content") {
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-evaluations",
          fixture.championPromotionEvidence.evaluation.paper_trading_evaluation_id,
          {
            ...fixture.championPromotionEvidence.evaluation,
            latest_failure_reason: "test-only-bypass-of-frozen-evidence-guard"
          }
        );
      } else {
        const last = fixture.championPromotionEvidence.observations.at(-1)!;
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-observations",
          last.paper_trading_observation_id,
          { ...last, market_snapshot: { ...last.market_snapshot!, price: 60_001 } }
        );
      }
      await expectStoreError(
        store.recordPaperTradingComparisonCommitment(fixture.comparison),
        "paper_trading_comparison_frozen_record_digest_mismatch"
      );
      await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    }
  );

  const postPairWriterCases = [
    ["createPaperTradingRun exact replay", "create-run-exact", "no_change"],
    ["recordPaperTradingEvaluationCommitment exact replay", "commitment-exact", "no_change"],
    ["recordPaperTradingEvaluation exact replay", "evaluation-exact", "no_change"],
    ["alternate commitment for bound run", "alternate-commitment", "reject"],
    ["alternate commitment/evaluation chain", "alternate-commitment-evaluation-chain", "reject"],
    ["recordPaperTradingEvaluation mutation", "evaluation", "reject"],
    ["recordPaperTradingObservation", "observation", "reject"],
    ["recordLedger", "ledger", "reject"],
    ["recordRunControlAudit", "run-control", "reject"],
    ["recordSandboxStart", "sandbox-start", "reject"],
    ["recordSandboxObservations", "sandbox-observations", "reject"],
    ["stopSandbox", "sandbox-stop", "reject"]
  ] as const;

  it.each(postPairWriterCases)(
    "serializes and guards post-paper-comparison writer: %s",
    async (_label, writer, expected) => {
      const store = new LocalStore(path.join(tmpDir, writer));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      if (writer === "sandbox-observations" || writer === "sandbox-stop") {
        await seedBoundSandboxForWriterTest(store, fixture);
      }
      const before = await boundComparisonEvidenceSnapshot(store, fixture);
      const call = invokeBoundSideWriter(store, fixture, writer);
      if (expected === "no_change") await expect(call).resolves.toBeDefined();
      else {
        await expectStoreError(call, "paper_trading_comparison_inert_graph_mutation_forbidden");
      }
      await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(before);
    }
  );

  it.each([
    ["recordSystemCode", "system-code"],
    ["recordCandidateAdmissionDecision", "admission"],
    ["recordTradingPromotion", "promotion"]
  ] as const)("rejects frozen paper comparison authority writer drift after pair: %s", async (_label, writer) => {
    const store = new LocalStore(path.join(tmpDir, writer));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const before = await boundComparisonEvidenceSnapshot(store, fixture);
    const call = writer === "system-code"
      ? store.recordSystemCode({
          ...(await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!,
          entrypoint: ["python3", "frozen-writer-drift.py"]
        })
      : writer === "admission"
        ? store.recordCandidateAdmissionDecision({
            ...(await store.getCandidateAdmissionDecision(
              fixture.preparation.champion.candidate_admission_decision_ref.id
            ))!,
            decided_at: "2026-07-09T20:55:00.001Z"
          })
        : store.recordTradingPromotion({
            ...fixture.promotion,
            promoted_at: "2026-07-09T21:31:00.001Z"
          });
    await expectStoreError(call, "paper_trading_comparison_frozen_authority_write_conflict");
    await expect(boundComparisonEvidenceSnapshot(store, fixture)).resolves.toEqual(before);
  });

  it("allows deterministic CandidateVersion materialization replay without changing frozen bytes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const versionBefore = await store.getCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    );
    await expect(store.materializeCandidate(fixture.challengerMaterializationInput))
      .resolves.toMatchObject({ status: "materialized" });
    await expect(store.getCandidateVersion(
      fixture.preparation.challenger.candidate_version_ref.id
    )).resolves.toEqual(versionBefore);
  });

  it("rejects paper comparison drift, preparation mismatch, and invalid side graphs", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment({
        ...fixture.comparison,
        committed_at: "2026-07-10T00:01:00.000Z"
      }),
      "paper_trading_comparison_commitment_conflict"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(withComparisonDigest({
        ...fixture.comparison,
        paper_trading_comparison_commitment_id: "paper-comparison-missing-preparation",
        preparation_ref: {
          record_kind: "paper_trading_comparison_preparation",
          id: "missing-paper-comparison-preparation"
        },
        commitment_digest: ""
      })),
      "paper_trading_comparison_preparation_reference_not_found"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(withComparisonDigest({
        ...fixture.comparison,
        paper_trading_comparison_commitment_id: "paper-comparison-zero-minimum",
        comparison_policy: {
          ...fixture.comparison.comparison_policy,
          minimum_observation_count: 0,
          minimum_elapsed_ms: 0
        },
        commitment_digest: ""
      })),
      "invalid_paper_trading_comparison_commitment_input"
    );
    const invalidStore = new LocalStore(path.join(tmpDir, "wrong-market"));
    await invalidStore.initialize();
    const invalidFixture = await storedComparisonFixture(invalidStore);
    await expectStoreError(
      invalidStore.recordPaperTradingComparisonCommitment(withComparisonDigest({
        ...invalidFixture.comparison,
        market_data_configuration_digest: "sha256:different-market",
        commitment_digest: ""
      })),
      "paper_trading_comparison_preparation_mismatch"
    );
  });

  it.each([
    ["provider-ineligible", "paper_trading_comparison_commitment_reference_mismatch"],
    ["window-policy-mismatch", "paper_trading_comparison_commitment_reference_mismatch"],
    ["duplicate-resolved-artifact", "paper_trading_comparison_commitment_reference_mismatch"],
    ["evaluation-outcome-state", "paper_trading_comparison_commitment_reference_mismatch"],
    ["replacement-evaluation-id", "paper_trading_comparison_commitment_reference_mismatch"],
    ["side-time-before-preparation", "paper_trading_comparison_commitment_reference_mismatch"],
    ["run-time-before-preparation", "paper_trading_comparison_commitment_reference_mismatch"]
  ] as const)("rejects malformed inert paper comparison side graph %s", async (malformation, code) => {
    const store = new LocalStore(path.join(tmpDir, malformation));
    await store.initialize();
    const fixture = await storedComparisonFixture(store, { malformation });
    await expectStoreError(store.recordPaperTradingComparisonCommitment(fixture.comparison), code);
    await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
  });

  it("rejects a paper comparison side that references the CandidateVersion default runtime", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    const version = (await store.getCandidateVersion(
      fixture.comparison.champion.candidate_version_ref.id
    ))!;
    const crafted = withComparisonDigest({
      ...fixture.comparison,
      champion: {
        ...fixture.comparison.champion,
        trading_run_ref: { ...version.runtime_ref }
      },
      commitment_digest: ""
    });
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(crafted),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
  });

  it.each([
    "commitment-authority",
    "private-exchange-access",
    "non-neutral-account",
    "ref-kind-drift"
  ] as const)("rejects persisted self-consistent paper comparison inert-state drift: %s", async (drift) => {
    const store = new LocalStore(path.join(tmpDir, drift));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const nonNeutralAccount = {
      ...structuredClone(PAPER_TRADING_COMPARISON_NEUTRAL_ACCOUNT),
      wallet_balance_usdt: "10001",
      available_balance_usdt: "10001",
      equity_usdt: "10001",
      realized_pnl_usdt: "1"
    };
    const changedCommitment = withPaperTradingCommitmentDigest({
      ...fixture.challengerCommitment,
      ...(drift === "commitment-authority" ? { authority_status: "live" as never } : {}),
      ...(drift === "private-exchange-access"
        ? { data_identity: {
            ...fixture.challengerCommitment.data_identity,
            private_exchange_access: "allowed" as never
          } }
        : {}),
      ...(drift === "non-neutral-account" ? { initial_account_snapshot: nonNeutralAccount } : {}),
      ...(drift === "ref-kind-drift"
        ? { candidate_ref: {
            record_kind: "same-id-wrong-kind",
            id: fixture.challengerCommitment.candidate_ref.id
          } }
        : {}),
      commitment_digest: ""
    });
    const changedEvaluation = drift === "non-neutral-account"
      ? { ...fixture.challengerEvaluation, paper_account_snapshot: nonNeutralAccount }
      : fixture.challengerEvaluation;
    const changedPair = withComparisonDigest({
      ...fixture.comparison,
      challenger: {
        ...fixture.comparison.challenger,
        paper_trading_evaluation_commitment_digest: changedCommitment.commitment_digest,
        paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationCommitmentRecordDigestInput(changedCommitment)
        ),
        paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
          paperTradingComparisonEvaluationRecordDigestInput(changedEvaluation)
        )
      },
      commitment_digest: ""
    });
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      changedCommitment.paper_trading_evaluation_commitment_id,
      changedCommitment
    );
    if (changedEvaluation !== fixture.challengerEvaluation) {
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-evaluations",
        fixture.challengerEvaluation.paper_trading_evaluation_id,
        changedEvaluation
      );
    }
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-commitments",
      changedPair.paper_trading_comparison_commitment_id,
      changedPair
    );
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(changedPair),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
  });

  it("rejects paper comparison same-ID side time rewrites while pair bytes stay unchanged", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const pairBefore = await readComparisonFixtureRecord<PaperTradingComparisonCommitmentRecord>(
      store,
      "paper-trading-comparison-commitments",
      fixture.comparison.paper_trading_comparison_commitment_id
    );
    const rewrittenAt = "2026-07-10T00:00:00.001Z";
    const changedCommitment = withPaperTradingCommitmentDigest({
      ...fixture.challengerCommitment,
      committed_at: rewrittenAt,
      commitment_digest: ""
    });
    const changedEvaluation = { ...fixture.challengerEvaluation, started_at: rewrittenAt };
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluation-commitments",
      changedCommitment.paper_trading_evaluation_commitment_id,
      changedCommitment
    );
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      changedEvaluation.paper_trading_evaluation_id,
      changedEvaluation
    );
    expect(changedCommitment.commitment_digest)
      .toBe(fixture.challengerCommitment.commitment_digest);
    await expectStoreError(
      store.recordPaperTradingComparisonCommitment(pairBefore),
      "paper_trading_comparison_commitment_reference_mismatch"
    );
  });

  it.each(["missing-provider-identity", "missing-account-position"] as const)(
    "returns a stable paper comparison graph error for persisted malformed nested data: %s",
    async (malformation) => {
      const store = new LocalStore(path.join(tmpDir, malformation));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      const { provider_identity: _providerIdentity, ...withoutProvider } =
        fixture.challengerCommitment;
      const { position: _position, ...accountWithoutPosition } =
        fixture.challengerCommitment.initial_account_snapshot;
      const malformedCommitment = withPaperTradingCommitmentDigest({
        ...(malformation === "missing-provider-identity"
          ? withoutProvider
          : {
              ...fixture.challengerCommitment,
              initial_account_snapshot: accountWithoutPosition as never
            }),
        commitment_digest: ""
      } as PaperTradingEvaluationCommitmentRecord);
      const malformedPair = withComparisonDigest({
        ...fixture.comparison,
        challenger: {
          ...fixture.comparison.challenger,
          paper_trading_evaluation_commitment_digest: malformedCommitment.commitment_digest,
          paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(malformedCommitment)
          )
        },
        commitment_digest: ""
      });
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-evaluation-commitments",
        malformedCommitment.paper_trading_evaluation_commitment_id,
        malformedCommitment
      );
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-comparison-commitments",
        malformedPair.paper_trading_comparison_commitment_id,
        malformedPair
      );
      await expectStoreError(
        store.recordPaperTradingComparisonCommitment(malformedPair),
        "paper_trading_comparison_commitment_reference_mismatch"
      );
    }
  );

  it.each([
    "commitment-shape",
    "evaluation-shape",
    "observation-identity",
    "commitment-json"
  ] as const)(
    "fails closed for malformed persisted paper comparison side data: %s",
    async (malformation) => {
      const store = new LocalStore(path.join(tmpDir, malformation));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      if (malformation === "commitment-shape") {
        const { committed_at: _committedAt, ...malformed } = fixture.challengerCommitment;
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-evaluation-commitments",
          fixture.challengerCommitment.paper_trading_evaluation_commitment_id,
          malformed
        );
      } else if (malformation === "evaluation-shape") {
        const { started_at: _startedAt, ...malformed } = fixture.challengerEvaluation;
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-evaluations",
          fixture.challengerEvaluation.paper_trading_evaluation_id,
          malformed
        );
      } else if (malformation === "observation-identity") {
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-observations",
          "paper-observation-malformed-comparison-side",
          {
            record_kind: "paper_trading_observation",
            version: 1,
            paper_trading_observation_id: "paper-observation-malformed-comparison-side"
          }
        );
      } else {
        await overwriteComparisonFixtureBytes(
          store,
          "paper-trading-evaluation-commitments",
          fixture.challengerCommitment.paper_trading_evaluation_commitment_id,
          "{not-valid-json\n"
        );
      }

      await expectStoreError(
        store.recordPaperTradingComparisonCommitment(fixture.comparison),
        "paper_trading_comparison_commitment_reference_mismatch"
      );
      await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
    }
  );

  it.each(["candidate", "candidate-version", "trading-run", "system-code"] as const)(
    "rejects persisted paper comparison same-ID loaded-record drift: %s",
    async (drift) => {
      const store = new LocalStore(path.join(tmpDir, drift));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      let replay = fixture.comparison;
      if (drift === "candidate") {
        const candidate = await readComparisonFixtureRecord<TradingSystemCandidateRecord>(
          store,
          "candidates",
          fixture.comparison.challenger.candidate_ref.id
        );
        await overwriteComparisonFixtureRecord(store, "candidates", candidate.candidate_id, {
          ...candidate,
          candidate_id: "same-path-drifted-candidate-id"
        });
      } else if (drift === "candidate-version") {
        const version = (await store.getCandidateVersion(
          fixture.comparison.challenger.candidate_version_ref.id
        ))!;
        const changedVersion = {
          ...version,
          runtime_ref: { ...fixture.comparison.challenger.trading_run_ref }
        };
        await overwriteComparisonFixtureRecord(
          store,
          "candidate-versions",
          version.candidate_version_id,
          changedVersion
        );
        replay = await rewriteFrozenSideDigestsForSemanticTest(store, fixture, {
          candidate_version_digest: comparisonExactRecordDigest(
            paperTradingComparisonCandidateVersionDigestInput(changedVersion)
          )
        });
      } else if (drift === "trading-run") {
        const run = (await store.getTradingRun(fixture.challengerRun.trading_run_id))!;
        await overwriteComparisonFixtureRecord(store, "trading-runs", run.trading_run_id, {
          ...run,
          trace_ref: { record_kind: "trace_placeholder", id: "unexpected-prestart-trace" }
        });
      } else {
        const code = (await store.getSystemCode(fixture.comparison.challenger.system_code_ref.id))!;
        const changedCode = { ...code, entrypoint: ["python3", "same-id-drifted-entrypoint.py"] };
        await overwriteComparisonFixtureRecord(
          store,
          "system-codes",
          code.system_code_id,
          changedCode
        );
        replay = await rewriteFrozenSideDigestsForSemanticTest(store, fixture, {
          system_code_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonSystemCodeRecordDigestInput(changedCode)
          )
        });
      }
      await expectStoreError(
        store.recordPaperTradingComparisonCommitment(replay),
        "paper_trading_comparison_commitment_reference_mismatch"
      );
    }
  );

  it.each(controlledPairWriterKinds)(
    "makes representative paper comparison %s writer visible when it wins before pair validation",
    async (writer) => {
      const store = new LocalStore(path.join(tmpDir, `writer-first-${writer}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await invokeBoundSideWriter(store, fixture, writer);
      if (writer === "create-run-exact") {
        await expect(store.recordPaperTradingComparisonCommitment(fixture.comparison))
          .resolves.toEqual(fixture.comparison);
      } else {
        await expectStoreError(
          store.recordPaperTradingComparisonCommitment(fixture.comparison),
          "paper_trading_comparison_commitment_reference_mismatch"
        );
        await expect(store.listPaperTradingComparisonCommitments()).resolves.toEqual([]);
      }
    }
  );

  it("serializes paper comparison champion currentness and append against promotion writes", async () => {
    const store = new InterleavingComparisonLocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    store.pauseLatestPromotionRead();
    const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
    await store.latestPromotionReadEntered;
    const activeTransactionTail = store.comparisonTransactionTail();
    const laterPromotionWrite = store.recordTradingPromotion(laterChampionPromotion(fixture));
    await expectComparisonWriterQueued(store, activeTransactionTail, laterPromotionWrite);
    store.releaseLatestPromotionRead();
    await expect(reservation).resolves.toEqual(fixture.preparation);
    await expectStoreError(
      laterPromotionWrite,
      "trading_promotion_reference_not_found"
    );
  });

  it("rejects a stale paper comparison selection when promotion wins the evidence transaction", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const laterPromotion = laterChampionPromotion(fixture);
    await overwriteComparisonFixtureRecord(
      store,
      "trading-promotions",
      laterPromotion.trading_promotion_id,
      laterPromotion
    );
    await expectStoreError(
      store.reservePaperTradingComparisonPreparation(fixture.preparation),
      "paper_trading_comparison_champion_selection_mismatch"
    );
    await expect(store.listPaperTradingComparisonPreparations()).resolves.toEqual([]);
  });

  it("blocks same-ID SystemCode drift until paper comparison reservation then rejects it", async () => {
    const store = new InterleavingComparisonLocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const code = (await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!;
    store.pauseLatestPromotionRead();
    const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
    await store.latestPromotionReadEntered;
    const activeTransactionTail = store.comparisonTransactionTail();
    const driftWrite = store.recordSystemCode({ ...code, entrypoint: ["python3", "drift.py"] });
    await expectComparisonWriterQueued(store, activeTransactionTail, driftWrite);
    store.releaseLatestPromotionRead();
    await expect(reservation).resolves.toEqual(fixture.preparation);
    await expectStoreError(
      driftWrite,
      "paper_trading_comparison_frozen_authority_write_conflict"
    );
  });

  it("freezes promotion evaluation content in the paper comparison reservation transaction", async () => {
    const store = new InterleavingComparisonLocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    store.pauseLatestPromotionRead();
    const reservation = store.reservePaperTradingComparisonPreparation(fixture.preparation);
    await store.latestPromotionReadEntered;
    const activeTransactionTail = store.comparisonTransactionTail();
    const evidenceWrite = store.recordPaperTradingEvaluation({
      ...fixture.championPromotionEvidence.evaluation,
      latest_failure_reason: "concurrent-promotion-evidence-drift"
    });
    await expectComparisonWriterQueued(store, activeTransactionTail, evidenceWrite);
    store.releaseLatestPromotionRead();
    await expect(reservation).resolves.toEqual(fixture.preparation);
    await expectStoreError(
      evidenceWrite,
      "paper_trading_comparison_frozen_authority_write_conflict"
    );
  });

  it("rejects same-ID SystemCode drift that reaches the paper comparison transaction first", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await comparisonPreparationFixture(store);
    const code = (await store.getSystemCode(fixture.preparation.champion.system_code_ref.id))!;
    await expectStoreError(
      store.recordSystemCode({ ...code, entrypoint: ["python3", "writer-first-drift.py"] }),
      "authority_evidence_identity_conflict"
    );
    await expect(store.getSystemCode(code.system_code_id)).resolves.toEqual(code);
    await expect(store.reservePaperTradingComparisonPreparation(fixture.preparation))
      .resolves.toEqual(fixture.preparation);
  });

  it("routes improvement proposal SystemCode writes through paper comparison identity checks", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    await store.recordResearchFinding(validResearchFindingRecord());
    await store.recordResearchFinding(validAntiHackingResearchFindingRecord());
    const improvementInput = validImprovementProposalMaterializationInput();
    const suffix = createHash("sha256")
      .update(improvementInput.idempotency_key)
      .digest("hex")
      .slice(0, 16);
    const frozenCode: SystemCodeRecord = {
      ...validProposedSystemCodeRecord(),
      system_code_id: `research-system-code-proposal-${suffix}`,
      artifact_digest: "sha256:frozen-improvement-system-code",
      entrypoint: ["python3", "frozen-improvement.py"]
    };
    const fixture = await comparisonPreparationFixture(store, {
      challengerSystemCode: frozenCode
    });
    await store.reservePaperTradingComparisonPreparation(fixture.preparation);
    const attemptsBefore = await store.listImprovementProposalMaterializationAttempts();
    const proposalsBefore = await store.listImprovementProposals();
    const lineagesBefore = await store.listArtifactLineages();
    await expectStoreError(
      store.materializeImprovementProposal(improvementInput),
      "paper_trading_comparison_frozen_authority_write_conflict"
    );
    await expect(store.listImprovementProposalMaterializationAttempts()).resolves.toEqual(
      attemptsBefore
    );
    await expect(store.listImprovementProposals()).resolves.toEqual(proposalsBefore);
    await expect(store.listArtifactLineages()).resolves.toEqual(lineagesBefore);
    await expect(store.getSystemCode(frozenCode.system_code_id)).resolves.toEqual(frozenCode);
  });

  it("records, reloads, lists, and exactly replays one paper comparison tick", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);

    await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
    await expect(store.recordPaperTradingComparisonTick(tick)).resolves.toEqual(tick);
    await expect(store.getPaperTradingComparisonTick(
      tick.paper_trading_comparison_tick_id
    )).resolves.toEqual(tick);
    await expect(store.listPaperTradingComparisonTicks(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([tick]);
  });

  it.each([
    ["digest", (tick: PaperTradingComparisonTickRecord) => ({
      ...tick,
      tick_digest: "sha256:wrong"
    }), "paper_trading_comparison_tick_digest_mismatch"],
    ["missing pair", (tick: PaperTradingComparisonTickRecord) => withTickDigest({
      ...tick,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: "missing-comparison"
      }
    }), "paper_trading_comparison_tick_reference_not_found"],
    ["pair digest", (tick: PaperTradingComparisonTickRecord) => withTickDigest({
      ...tick,
      paper_trading_comparison_commitment_digest: "sha256:wrong-comparison"
    }), "paper_trading_comparison_tick_reference_mismatch"],
    ["market configuration", (tick: PaperTradingComparisonTickRecord) => withTickDigest({
      ...tick,
      market_data_configuration_digest: "sha256:wrong-market"
    }), "paper_trading_comparison_tick_reference_mismatch"],
    ["capture before commitment", (tick: PaperTradingComparisonTickRecord) => withTickDigest({
      ...tick,
      observed_at: "2026-07-09T23:59:59.999Z"
    }), "paper_trading_comparison_tick_reference_mismatch"],
    ["capture before source evidence", (tick: PaperTradingComparisonTickRecord) => withTickDigest({
      ...tick,
      observed_at: "2026-07-10T00:00:00.150Z"
    }), "paper_trading_comparison_tick_reference_mismatch"]
  ] as const)("rejects paper comparison tick %s mismatch", async (_label, mutate, code) => {
    const store = new LocalStore(path.join(tmpDir, _label));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);

    await expectStoreError(
      store.recordPaperTradingComparisonTick(mutate(
        validPaperTradingComparisonTick(fixture.comparison)
      )),
      code
    );
    await expect(store.listPaperTradingComparisonTicks(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([]);
  });

  it("rejects alternate and same-ID drifted paper comparison first ticks", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);

    await expectStoreError(
      store.recordPaperTradingComparisonTick(withTickDigest({
        ...tick,
        paper_trading_comparison_tick_id: "paper-comparison-first-tick-alternate"
      })),
      "paper_trading_comparison_first_tick_conflict"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonTick(withTickDigest({
        ...tick,
        market_snapshot: { ...tick.market_snapshot, price: 60_001 }
      })),
      "paper_trading_comparison_tick_conflict"
    );
    await expect(store.listPaperTradingComparisonTicks(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([tick]);
  });

  it("serializes concurrent alternate paper comparison first ticks", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const first = validPaperTradingComparisonTick(fixture.comparison);
    const second = withTickDigest({
      ...first,
      paper_trading_comparison_tick_id: "paper-comparison-first-tick-concurrent"
    });

    const results = await Promise.allSettled([
      store.recordPaperTradingComparisonTick(first),
      store.recordPaperTradingComparisonTick(second)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({
      code: "paper_trading_comparison_first_tick_conflict"
    });
    await expect(store.listPaperTradingComparisonTicks(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toHaveLength(1);
  });

  it("fails closed on corrupt persisted paper comparison tick data", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const itemDir = path.join(store.root(), "paper-trading-comparison-ticks", "items");
    await mkdir(itemDir, { recursive: true });
    await writeFile(path.join(itemDir, "corrupt.json"), "{");

    await expectStoreError(
      store.listPaperTradingComparisonTicks(
        fixture.comparison.paper_trading_comparison_commitment_id
      ),
      "paper_trading_comparison_tick_reload_failed"
    );
  });

  it("fails closed on shape-valid persisted paper comparison tick digest drift", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-ticks",
      tick.paper_trading_comparison_tick_id,
      { ...tick, tick_digest: "sha256:persisted-drift" }
    );

    await expectStoreError(
      store.getPaperTradingComparisonTick(tick.paper_trading_comparison_tick_id),
      "paper_trading_comparison_tick_reload_failed"
    );
    await expectStoreError(
      store.listPaperTradingComparisonTicks(
        fixture.comparison.paper_trading_comparison_commitment_id
      ),
      "paper_trading_comparison_tick_reload_failed"
    );
  });

  it("rejects a paper comparison tick when the persisted pair is no longer inert", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      fixture.challengerEvaluation.paper_trading_evaluation_id,
      {
        ...fixture.challengerEvaluation,
        latest_score: {
          revenue_usdt: 1,
          cost_usdt: 0,
          net_revenue_usdt: 1,
          net_return_pct: 0.01
        }
      }
    );

    await expectStoreError(
      store.recordPaperTradingComparisonTick(
        validPaperTradingComparisonTick(fixture.comparison)
      ),
      "paper_trading_comparison_tick_graph_invalid"
    );
    await expect(store.listPaperTradingComparisonTicks(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([]);
  });

  it("records, reloads, lists, and exactly replays one paper comparison activation", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    const activation = validPaperTradingComparisonActivation(fixture.comparison, tick);
    const before = await comparisonActivationInvariantSnapshot(store);

    await expect(store.recordPaperTradingComparisonActivation(activation))
      .resolves.toEqual(activation);
    await expect(store.recordPaperTradingComparisonActivation(activation))
      .resolves.toEqual(activation);
    const reordered = Object.fromEntries(
      Object.entries(activation).reverse()
    ) as unknown as PaperTradingComparisonActivationRecord;
    await expect(store.recordPaperTradingComparisonActivation(reordered))
      .resolves.toEqual(activation);
    await expect(store.getPaperTradingComparisonActivation(
      activation.paper_trading_comparison_activation_id
    )).resolves.toEqual(activation);
    await expect(store.listPaperTradingComparisonActivations(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([activation]);
    await expect(comparisonActivationInvariantSnapshot(store)).resolves.toEqual(before);
  });

  it.each([
    ["digest", (activation: PaperTradingComparisonActivationRecord) => ({
      ...activation,
      activation_digest: "sha256:wrong"
    }), "paper_trading_comparison_activation_digest_mismatch"],
    ["missing pair", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        paper_trading_comparison_commitment_ref: {
          record_kind: "paper_trading_comparison_commitment",
          id: "missing-comparison"
        }
      }), "paper_trading_comparison_activation_reference_not_found"],
    ["pair digest", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        paper_trading_comparison_commitment_digest: "sha256:wrong-comparison"
      }), "paper_trading_comparison_activation_reference_mismatch"],
    ["tick ref", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        first_tick_ref: {
          record_kind: "paper_trading_comparison_tick",
          id: "missing-first-tick"
        }
      }), "paper_trading_comparison_activation_reference_mismatch"],
    ["tick digest", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({ ...activation, first_tick_digest: "sha256:wrong-tick" }),
      "paper_trading_comparison_activation_reference_mismatch"],
    ["market configuration", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        market_data_configuration_digest: "sha256:wrong-market"
      }), "paper_trading_comparison_activation_reference_mismatch"],
    ["side ref", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        challenger: {
          ...activation.challenger,
          trading_run_ref: { record_kind: "trading_run", id: "wrong-run" }
        }
      }), "paper_trading_comparison_activation_reference_mismatch"],
    ["policy", (activation: PaperTradingComparisonActivationRecord) =>
      withActivationDigest({
        ...activation,
        activation_policy: {
          ...activation.activation_policy,
          maximum_start_skew_ms: activation.activation_policy.maximum_start_skew_ms + 1
        }
      }), "paper_trading_comparison_activation_policy_mismatch"],
    ["authorization time", (activation: PaperTradingComparisonActivationRecord) => ({
      ...activation,
      authorized_at: "2026-07-10T00:00:00.999Z"
    }), "paper_trading_comparison_activation_time_mismatch"]
  ] as const)("rejects paper comparison activation %s mismatch without mutation", async (
    label,
    mutate,
    code
  ) => {
    const store = new LocalStore(path.join(tmpDir, `activation-${label}`));
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    const before = await comparisonActivationInvariantSnapshot(store);

    await expectStoreError(
      store.recordPaperTradingComparisonActivation(mutate(
        validPaperTradingComparisonActivation(fixture.comparison, tick)
      )),
      code
    );
    await expect(store.listPaperTradingComparisonActivations(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([]);
    await expect(comparisonActivationInvariantSnapshot(store)).resolves.toEqual(before);
  });

  it("rejects paper comparison activation with missing, non-sole, or corrupt first tick", async () => {
    for (const problem of ["missing", "non-sole", "corrupt"] as const) {
      const store = new LocalStore(path.join(tmpDir, `activation-tick-${problem}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      const tick = validPaperTradingComparisonTick(fixture.comparison);
      if (problem !== "missing") {
        await store.recordPaperTradingComparisonTick(tick);
      }
      if (problem === "non-sole") {
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-comparison-ticks",
          "paper-comparison-first-tick-alternate",
          withTickDigest({
            ...tick,
            paper_trading_comparison_tick_id: "paper-comparison-first-tick-alternate"
          })
        );
      }
      if (problem === "corrupt") {
        await overwriteComparisonFixtureBytes(
          store,
          "paper-trading-comparison-ticks",
          tick.paper_trading_comparison_tick_id,
          "{"
        );
      }

      await expectStoreError(
        store.recordPaperTradingComparisonActivation(
          validPaperTradingComparisonActivation(fixture.comparison, tick)
        ),
        problem === "missing"
          ? "paper_trading_comparison_activation_reference_not_found"
          : problem === "non-sole"
            ? "paper_trading_comparison_activation_reference_mismatch"
            : "paper_trading_comparison_activation_graph_invalid"
      );
    }
  });

  it("rejects paper comparison activation when the frozen pair is no longer inert", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      fixture.challengerEvaluation.paper_trading_evaluation_id,
      {
        ...fixture.challengerEvaluation,
        latest_score: {
          revenue_usdt: 1,
          cost_usdt: 0,
          net_revenue_usdt: 1,
          net_return_pct: 0.01
        }
      }
    );
    const before = await comparisonActivationInvariantSnapshot(store);

    await expectStoreError(
      store.recordPaperTradingComparisonActivation(
        validPaperTradingComparisonActivation(fixture.comparison, tick)
      ),
      "paper_trading_comparison_activation_graph_invalid"
    );
    await expect(comparisonActivationInvariantSnapshot(store)).resolves.toEqual(before);
  });

  it("rejects drifted and alternate paper comparison activations", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    const activation = validPaperTradingComparisonActivation(fixture.comparison, tick);
    await store.recordPaperTradingComparisonActivation(activation);

    await expectStoreError(
      store.recordPaperTradingComparisonActivation({
        ...activation,
        authorized_at: "2026-07-10T00:00:03.000Z"
      }),
      "paper_trading_comparison_activation_conflict"
    );
    await expectStoreError(
      store.recordPaperTradingComparisonActivation(withActivationDigest({
        ...activation,
        paper_trading_comparison_activation_id: "paper-comparison-activation-alternate"
      })),
      "paper_trading_comparison_activation_pair_conflict"
    );
    await expect(store.listPaperTradingComparisonActivations(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toEqual([activation]);
  });

  it("serializes concurrent alternate paper comparison activations", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const fixture = await storedComparisonFixture(store);
    await store.recordPaperTradingComparisonCommitment(fixture.comparison);
    const tick = validPaperTradingComparisonTick(fixture.comparison);
    await store.recordPaperTradingComparisonTick(tick);
    const first = validPaperTradingComparisonActivation(fixture.comparison, tick);
    const second = withActivationDigest({
      ...first,
      paper_trading_comparison_activation_id: "paper-comparison-activation-concurrent"
    });

    const results = await Promise.allSettled([
      store.recordPaperTradingComparisonActivation(first),
      store.recordPaperTradingComparisonActivation(second)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [rejected] = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected?.reason).toMatchObject({
      code: "paper_trading_comparison_activation_pair_conflict"
    });
    await expect(store.listPaperTradingComparisonActivations(
      fixture.comparison.paper_trading_comparison_commitment_id
    )).resolves.toHaveLength(1);
  });

  it("fails closed on corrupt or digest-drifted persisted paper comparison activation", async () => {
    for (const problem of ["corrupt", "digest"] as const) {
      const store = new LocalStore(path.join(tmpDir, `activation-reload-${problem}`));
      await store.initialize();
      const fixture = await storedComparisonFixture(store);
      await store.recordPaperTradingComparisonCommitment(fixture.comparison);
      const tick = validPaperTradingComparisonTick(fixture.comparison);
      await store.recordPaperTradingComparisonTick(tick);
      const activation = validPaperTradingComparisonActivation(fixture.comparison, tick);
      await store.recordPaperTradingComparisonActivation(activation);
      if (problem === "corrupt") {
        await overwriteComparisonFixtureBytes(
          store,
          "paper-trading-comparison-activations",
          activation.paper_trading_comparison_activation_id,
          "{"
        );
      } else {
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-comparison-activations",
          activation.paper_trading_comparison_activation_id,
          { ...activation, activation_digest: "sha256:persisted-drift" }
        );
      }

      await expectStoreError(
        store.getPaperTradingComparisonActivation(
          activation.paper_trading_comparison_activation_id
        ),
        "paper_trading_comparison_activation_reload_failed"
      );
      await expectStoreError(
        store.listPaperTradingComparisonActivations(
          fixture.comparison.paper_trading_comparison_commitment_id
        ),
        "paper_trading_comparison_activation_reload_failed"
      );
    }
  });

  describe("paper comparison runtime activation", () => {
    it("appends, reloads, lists, and semantically replays the exact first attempt", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      const before = await comparisonActivationInvariantSnapshot(store);

      await expect(store.recordPaperTradingComparisonActivationAttempt(attempt))
        .resolves.toEqual(attempt);
      await expect(store.recordPaperTradingComparisonActivationAttempt(attempt))
        .resolves.toEqual(attempt);
      const reordered = Object.fromEntries(
        Object.entries(attempt).reverse()
      ) as unknown as PaperTradingComparisonActivationAttemptRecord;
      await expect(store.recordPaperTradingComparisonActivationAttempt(reordered))
        .resolves.toEqual(attempt);
      await expectStoreError(
        store.recordPaperTradingComparisonActivationAttempt(
          withRuntimeActivationAttemptDigest({
            ...attempt,
            attempted_at: "2026-07-10T00:00:13.000Z",
            start_deadline_at: "2026-07-10T00:01:13.000Z"
          })
        ),
        "paper_trading_comparison_activation_attempt_conflict"
      );
      await expect(store.getPaperTradingComparisonActivationAttempt(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual(attempt);
      await expect(store.listPaperTradingComparisonActivationAttempts(
        fixture.activation.paper_trading_comparison_activation_id
      )).resolves.toEqual([attempt]);
      await expect(comparisonActivationInvariantSnapshot(store)).resolves.toEqual(before);
    });

    it.each([
      ["digest", (attempt: PaperTradingComparisonActivationAttemptRecord) => ({
        ...attempt,
        attempt_digest: "sha256:wrong"
      }), "paper_trading_comparison_activation_attempt_digest_mismatch"],
      ["activation", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          paper_trading_comparison_activation_ref: {
            record_kind: "paper_trading_comparison_activation",
            id: "missing-activation"
          }
        }), "paper_trading_comparison_activation_attempt_reference_not_found"],
      ["pair", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          paper_trading_comparison_commitment_digest: "sha256:wrong-pair"
        }), "paper_trading_comparison_activation_attempt_reference_mismatch"],
      ["tick", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          first_tick_digest: "sha256:wrong-tick"
        }), "paper_trading_comparison_activation_attempt_reference_mismatch"],
      ["side", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          challenger: {
            ...attempt.challenger,
            trading_run_ref: { record_kind: "trading_run", id: "wrong-run" }
          }
        }), "paper_trading_comparison_activation_attempt_reference_mismatch"],
      ["policy", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          activation_policy: {
            ...attempt.activation_policy,
            maximum_start_skew_ms: attempt.activation_policy.maximum_start_skew_ms + 1
          }
        }), "paper_trading_comparison_activation_attempt_policy_mismatch"],
      ["time", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          attempted_at: "2026-07-10T00:00:01.000Z",
          start_deadline_at: "2026-07-10T00:01:01.000Z"
        }), "paper_trading_comparison_activation_attempt_time_mismatch"],
      ["sequence", (attempt: PaperTradingComparisonActivationAttemptRecord) =>
        withRuntimeActivationAttemptDigest({
          ...attempt,
          attempt_sequence: 2,
          retry_index: 1
        }), "paper_trading_comparison_activation_attempt_sequence_mismatch"]
    ] as const)("rejects first attempt %s mismatch without mutation", async (
      label,
      mutate,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-attempt-${label}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);

      await expectStoreError(
        store.recordPaperTradingComparisonActivationAttempt(mutate(
          validRuntimeActivationAttempt(fixture.activation)
        )),
        code
      );
      await expect(store.listPaperTradingComparisonActivationAttempts(
        fixture.activation.paper_trading_comparison_activation_id
      )).resolves.toEqual([]);
    });

    it("serializes concurrent alternate attempts and keeps one open attempt", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const first = validRuntimeActivationAttempt(fixture.activation);
      const second = withRuntimeActivationAttemptDigest({
        ...first,
        paper_trading_comparison_activation_attempt_id: "runtime-attempt-alternate"
      });

      const results = await Promise.allSettled([
        store.recordPaperTradingComparisonActivationAttempt(first),
        store.recordPaperTradingComparisonActivationAttempt(second)
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason).toMatchObject({
          code: "paper_trading_comparison_activation_attempt_state_conflict"
        });
      await expect(store.listPaperTradingComparisonActivationAttempts(
        fixture.activation.paper_trading_comparison_activation_id
      )).resolves.toHaveLength(1);
    });

    it("admits retry only after the latest attempt stopped cleanly", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const first = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(first);
      const retry = validRuntimeActivationAttempt(fixture.activation, 2);

      await expectStoreError(
        store.recordPaperTradingComparisonActivationAttempt(retry),
        "paper_trading_comparison_activation_attempt_state_conflict"
      );
      await completeStoppedRuntimeActivationAttempt(store, first);
      await expect(store.recordPaperTradingComparisonActivationAttempt(retry))
        .resolves.toEqual(retry);
      await expect(store.listPaperTradingComparisonActivationAttempts(
        fixture.activation.paper_trading_comparison_activation_id
      )).resolves.toEqual([first, retry]);
    });

    it("rejects forged stopped-cleanly retry admission without side stop evidence", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const first = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(first);
      const forged = validRuntimeActivationOutcome(first, [
        validRuntimeActivationSideResult(first, "champion", "not_running"),
        validRuntimeActivationSideResult(first, "challenger", "not_running")
      ], "stopped_cleanly");
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-comparison-activation-outcomes",
        forged.paper_trading_comparison_activation_outcome_id,
        forged
      );

      await expectStoreError(
        store.recordPaperTradingComparisonActivationAttempt(
          validRuntimeActivationAttempt(fixture.activation, 2)
        ),
        "paper_trading_comparison_activation_attempt_state_conflict"
      );
    });

    it("enforces the frozen retry-count ceiling", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      for (let sequence = 1; sequence <= 4; sequence += 1) {
        const attempt = validRuntimeActivationAttempt(fixture.activation, sequence);
        await store.recordPaperTradingComparisonActivationAttempt(attempt);
        await completeStoppedRuntimeActivationAttempt(store, attempt);
      }

      await expectStoreError(
        store.recordPaperTradingComparisonActivationAttempt(
          validRuntimeActivationAttempt(fixture.activation, 5)
        ),
        "invalid_paper_trading_comparison_activation_attempt_input"
      );
      await expect(store.listPaperTradingComparisonActivationAttempts(
        fixture.activation.paper_trading_comparison_activation_id
      )).resolves.toHaveLength(4);
    });

    it.each(["both_running", "cleanup_required"] as const)(
      "blocks retry after %s",
      async (status) => {
        const store = new LocalStore(path.join(tmpDir, `runtime-block-${status}`));
        await store.initialize();
        const fixture = await storedRuntimeActivationFixture(store);
        const first = validRuntimeActivationAttempt(fixture.activation);
        await store.recordPaperTradingComparisonActivationAttempt(first);
        const outcome = withRuntimeActivationOutcomeDigest({
          ...validRuntimeActivationOutcome(first, [], status),
          outcome_reason: status === "both_running"
            ? "started_within_policy"
            : "side_result_persistence_failed",
          next_action: status === "both_running"
            ? "capture_first_paired_checkpoint"
            : "recover_cleanup",
          champion_latest_result_ref: status === "both_running"
            ? {
                record_kind: "paper_trading_comparison_activation_side_result",
                id: "unavailable-champion-result"
              }
            : undefined,
          challenger_latest_result_ref: status === "both_running"
            ? {
                record_kind: "paper_trading_comparison_activation_side_result",
                id: "unavailable-challenger-result"
              }
            : undefined
        });
        await overwriteComparisonFixtureRecord(
          store,
          "paper-trading-comparison-activation-outcomes",
          outcome.paper_trading_comparison_activation_outcome_id,
          outcome
        );

        await expectStoreError(
          store.recordPaperTradingComparisonActivationAttempt(
            validRuntimeActivationAttempt(fixture.activation, 2)
          ),
          "paper_trading_comparison_activation_attempt_state_conflict"
        );
      }
    );

    it("binds side results to the attempt, role sequence, policy, and current state", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const champion = validRuntimeActivationSideResult(attempt, "champion", "failed");

      await expect(store.recordPaperTradingComparisonActivationSideResult(champion))
        .resolves.toEqual(champion);
      await expect(store.recordPaperTradingComparisonActivationSideResult(champion))
        .resolves.toEqual(champion);
      await expectStoreError(
        store.recordPaperTradingComparisonActivationSideResult(
          withRuntimeActivationSideResultDigest({
            ...champion,
            stable_error_code: "drifted-error"
          })
        ),
        "paper_trading_comparison_activation_side_result_conflict"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationSideResult(
          withRuntimeActivationSideResultDigest({
            ...champion,
            paper_trading_comparison_activation_side_result_id: "alternate-start-result"
          })
        ),
        "paper_trading_comparison_activation_side_result_sequence_mismatch"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationSideResult(
          withRuntimeActivationSideResultDigest({
            ...validRuntimeActivationSideResult(attempt, "challenger", "failed"),
            trading_run_ref: { ...attempt.champion.trading_run_ref }
          })
        ),
        "paper_trading_comparison_activation_side_result_reference_mismatch"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationSideResult(
          withRuntimeActivationSideResultDigest({
            ...validRuntimeActivationSideResult(attempt, "challenger", "failed"),
            provider_request_count:
              attempt.activation_policy.maximum_provider_request_count_per_side + 1
          })
        ),
        "paper_trading_comparison_activation_side_result_policy_mismatch"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationSideResult(
          validRuntimeActivationSideResult(attempt, "challenger", "succeeded")
        ),
        "paper_trading_comparison_activation_side_result_state_mismatch"
      );
      await expect(store.getPaperTradingComparisonActivationSideResult(
        champion.paper_trading_comparison_activation_side_result_id
      )).resolves.toEqual(champion);
      await expect(store.listPaperTradingComparisonActivationSideResults(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([champion]);
    });

    it("rejects false pair outcomes then appends exact stopped-cleanly evidence", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const starts = await recordFailedRuntimeActivationStarts(store, attempt);

      await expectStoreError(
        store.recordPaperTradingComparisonActivationOutcome(
          validRuntimeActivationOutcome(attempt, starts, "both_running")
        ),
        "paper_trading_comparison_activation_outcome_state_mismatch"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationOutcome(
          validRuntimeActivationOutcome(attempt, starts, "stopped_cleanly")
        ),
        "paper_trading_comparison_activation_outcome_state_mismatch"
      );

      const stops = await recordNotRunningRuntimeActivationStops(store, attempt);
      const outcome = validRuntimeActivationOutcome(attempt, stops, "stopped_cleanly");
      await expect(store.recordPaperTradingComparisonActivationOutcome(outcome))
        .resolves.toEqual(outcome);
      await expectStoreError(
        store.recordPaperTradingComparisonActivationOutcome(
          withRuntimeActivationOutcomeDigest({
            ...outcome,
            completed_at: new Date(Date.parse(outcome.completed_at) + 1).toISOString()
          })
        ),
        "paper_trading_comparison_activation_outcome_conflict"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonActivationOutcome(
          validRuntimeActivationOutcome(attempt, stops, "stopped_cleanly", outcome)
        ),
        "paper_trading_comparison_activation_outcome_state_mismatch"
      );
      await expect(store.recordPaperTradingComparisonActivationOutcome(outcome))
        .resolves.toEqual(outcome);
      await expect(store.getPaperTradingComparisonActivationOutcome(
        outcome.paper_trading_comparison_activation_outcome_id
      )).resolves.toEqual(outcome);
      await expect(store.listPaperTradingComparisonActivationOutcomes(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([outcome]);
    });

    it("reconciles cleanup-required into a contiguous stopped-cleanly outcome", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const starts = await recordFailedRuntimeActivationStarts(store, attempt, true);
      const uncertain = validRuntimeActivationOutcome(attempt, starts, "cleanup_required");
      await store.recordPaperTradingComparisonActivationOutcome(uncertain);
      const stops = await recordNotRunningRuntimeActivationStops(store, attempt);
      const recovered = validRuntimeActivationOutcome(
        attempt,
        stops,
        "stopped_cleanly",
        uncertain
      );

      await expect(store.recordPaperTradingComparisonActivationOutcome(recovered))
        .resolves.toEqual(recovered);
      await expect(store.listPaperTradingComparisonActivationOutcomes(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([uncertain, recovered]);
    });

    it.each([
      ["attempt", "paper-trading-comparison-activation-attempts",
        "paper_trading_comparison_activation_attempt_reload_failed"],
      ["side-result", "paper-trading-comparison-activation-side-results",
        "paper_trading_comparison_activation_side_result_reload_failed"],
      ["outcome", "paper-trading-comparison-activation-outcomes",
        "paper_trading_comparison_activation_outcome_reload_failed"]
    ] as const)("fails closed on corrupt persisted %s", async (
      kind,
      collection,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-corrupt-${kind}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      if (kind !== "attempt") {
        const starts = await recordFailedRuntimeActivationStarts(store, attempt);
        if (kind === "outcome") {
          const stops = await recordNotRunningRuntimeActivationStops(store, attempt);
          await store.recordPaperTradingComparisonActivationOutcome(
            validRuntimeActivationOutcome(attempt, stops, "stopped_cleanly")
          );
        } else {
          expect(starts).toHaveLength(2);
        }
      }
      const itemDir = path.join(store.root(), collection, "items");
      await mkdir(itemDir, { recursive: true });
      await writeFile(path.join(itemDir, "corrupt.json"), "{");

      const listing = kind === "attempt"
        ? store.listPaperTradingComparisonActivationAttempts(
            fixture.activation.paper_trading_comparison_activation_id
          )
        : kind === "side-result"
          ? store.listPaperTradingComparisonActivationSideResults(
              attempt.paper_trading_comparison_activation_attempt_id
            )
          : store.listPaperTradingComparisonActivationOutcomes(
              attempt.paper_trading_comparison_activation_attempt_id
            );
      await expectStoreError(listing, code);
    });

    it.each([
      ["attempt", "paper-trading-comparison-activation-attempts",
        "paper_trading_comparison_activation_attempt_reload_failed"],
      ["side-result", "paper-trading-comparison-activation-side-results",
        "paper_trading_comparison_activation_side_result_reload_failed"],
      ["outcome", "paper-trading-comparison-activation-outcomes",
        "paper_trading_comparison_activation_outcome_reload_failed"]
    ] as const)("fails closed on shape-valid persisted %s digest drift", async (
      kind,
      collection,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-digest-${kind}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      let id = attempt.paper_trading_comparison_activation_attempt_id;
      let drifted: Record<string, unknown> = { ...attempt, attempt_digest: "sha256:drift" };
      if (kind === "side-result") {
        const result = validRuntimeActivationSideResult(attempt, "champion", "failed");
        await store.recordPaperTradingComparisonActivationSideResult(result);
        id = result.paper_trading_comparison_activation_side_result_id;
        drifted = { ...result, side_result_digest: "sha256:drift" };
      } else if (kind === "outcome") {
        const outcome = await completeStoppedRuntimeActivationAttempt(store, attempt);
        id = outcome.paper_trading_comparison_activation_outcome_id;
        drifted = { ...outcome, outcome_digest: "sha256:drift" };
      }
      await overwriteComparisonFixtureRecord(store, collection, id, drifted);

      const loaded = kind === "attempt"
        ? store.getPaperTradingComparisonActivationAttempt(id)
        : kind === "side-result"
          ? store.getPaperTradingComparisonActivationSideResult(id)
          : store.getPaperTradingComparisonActivationOutcome(id);
      await expectStoreError(loaded, code);
    });
  });

  describe("runtime activation write context", () => {
    it("permits the exact six start and stop Store transitions for one bound side", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const startContext = runtimeActivationWriteContext(attempt, "challenger", "start");
      const sandboxStart = runtimeActivationSandboxStart(fixture, attempt, "challenger");

      await expect(store.recordSandboxStart(sandboxStart, startContext))
        .resolves.toMatchObject({ sandbox: { lifecycle_status: "running" } });
      await expect(store.recordRunControlAudit(
        runtimeActivationRunControlInput(fixture, attempt, "challenger", "start"),
        startContext
      )).resolves.toMatchObject({
        decision: { resulting_lifecycle_status: "running" }
      });
      const running = runtimeActivationEvaluation(
        fixture,
        attempt,
        "challenger",
        "running"
      );
      await expect(store.recordPaperTradingEvaluation(running, startContext))
        .resolves.toEqual(running);
      const startResult = runtimeActivationSucceededStartResult(
        attempt,
        "challenger",
        sandboxStart.instance.sandbox_id
      );
      await store.recordPaperTradingComparisonActivationSideResult(startResult);

      const stopContext = runtimeActivationWriteContext(attempt, "challenger", "stop");
      await expect(store.recordRunControlAudit(
        runtimeActivationRunControlInput(fixture, attempt, "challenger", "stop"),
        stopContext
      )).resolves.toMatchObject({
        decision: { resulting_lifecycle_status: "stopped" }
      });
      const stoppedAt = new Date(Date.parse(attempt.attempted_at) + 7_000).toISOString();
      await expect(store.stopSandbox(
        { sandbox_id: sandboxStart.instance.sandbox_id, stopped_at: stoppedAt },
        {},
        stopContext
      )).resolves.toMatchObject({ sandbox: { lifecycle_status: "stopped" } });
      const stopped = runtimeActivationEvaluation(
        fixture,
        attempt,
        "challenger",
        "stopped"
      );
      await expect(store.recordPaperTradingEvaluation(stopped, stopContext))
        .resolves.toEqual(stopped);
      const stopResult = runtimeActivationSucceededStopResult(
        attempt,
        "challenger",
        sandboxStart.instance.sandbox_id
      );
      await store.recordPaperTradingComparisonActivationSideResult(stopResult);

      await expect(store.getTradingRun(attempt.challenger.trading_run_ref.id))
        .resolves.toMatchObject({ runtime_lifecycle_status: "stopped" });
      await expect(store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual(stopped);
      await expect(store.listPaperTradingObservations(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual([]);
      await expect(store.listPaperTradingComparisonActivationSideResults(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([startResult, stopResult]);
    });

    it("permits context-bound cleanup before a start side result is persisted", async () => {
      const store = new LocalStore(path.join(tmpDir, "runtime-partial-start-cleanup"));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const sandboxStart = runtimeActivationSandboxStart(
        fixture,
        attempt,
        "challenger"
      );
      await store.recordSandboxStart(
        sandboxStart,
        runtimeActivationWriteContext(attempt, "challenger", "start")
      );

      const stopContext = runtimeActivationWriteContext(attempt, "challenger", "stop");
      await expect(store.recordRunControlAudit(
        runtimeActivationRunControlInput(fixture, attempt, "challenger", "stop"),
        stopContext
      )).resolves.toMatchObject({
        decision: { resulting_lifecycle_status: "stopped" }
      });
      await store.stopSandbox({
        sandbox_id: sandboxStart.instance.sandbox_id,
        stopped_at: new Date(Date.parse(attempt.attempted_at) + 7_000).toISOString()
      }, {}, stopContext);
      const stopped = runtimeActivationEvaluation(
        fixture,
        attempt,
        "challenger",
        "stopped"
      );
      await store.recordPaperTradingEvaluation(stopped, stopContext);

      await expect(store.listPaperTradingComparisonActivationSideResults(
        attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([]);
      await expect(store.getTradingRun(attempt.challenger.trading_run_ref.id))
        .resolves.toMatchObject({ runtime_lifecycle_status: "stopped" });
      await expect(store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual(stopped);
    });

    it.each([
      ["missing", undefined, "paper_trading_comparison_inert_graph_mutation_forbidden"],
      ["null", () => null as unknown as PaperTradingComparisonRuntimeWriteContext,
        "invalid_paper_trading_comparison_runtime_write_context"],
      ["invalid", (context: PaperTradingComparisonRuntimeWriteContext) => ({
        ...context,
        paper_trading_comparison_activation_digest: ""
      }), "invalid_paper_trading_comparison_runtime_write_context"],
      ["activation digest", (context: PaperTradingComparisonRuntimeWriteContext) => ({
        ...context,
        paper_trading_comparison_activation_digest: "sha256:wrong"
      }), "paper_trading_comparison_runtime_write_context_reference_mismatch"],
      ["attempt digest", (context: PaperTradingComparisonRuntimeWriteContext) => ({
        ...context,
        paper_trading_comparison_activation_attempt_digest: "sha256:wrong"
      }), "paper_trading_comparison_runtime_write_context_reference_mismatch"],
      ["role", (context: PaperTradingComparisonRuntimeWriteContext) => ({
        ...context,
        role: "champion" as const
      }), "paper_trading_comparison_runtime_write_context_reference_mismatch"],
      ["operation", (context: PaperTradingComparisonRuntimeWriteContext) => ({
        ...context,
        operation: "stop" as const
      }), "paper_trading_comparison_runtime_write_context_writer_mismatch"]
    ] as const)("rejects %s runtime write context", async (_label, mutate, code) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-context-${_label}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const exact = runtimeActivationWriteContext(attempt, "challenger", "start");
      const context = mutate === undefined ? undefined : mutate(exact);

      await expectStoreError(
        store.recordSandboxStart(
          runtimeActivationSandboxStart(fixture, attempt, "challenger"),
          context as PaperTradingComparisonRuntimeWriteContext | undefined
        ),
        code
      );
    });

    it.each([
      ["sandbox state", async (
        store: LocalStore,
        fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
        attempt: PaperTradingComparisonActivationAttemptRecord,
        context: PaperTradingComparisonRuntimeWriteContext
      ) => store.recordSandboxStart({
        ...runtimeActivationSandboxStart(fixture, attempt, "challenger"),
        instance: {
          ...runtimeActivationSandboxStart(fixture, attempt, "challenger").instance,
          lifecycle_status: "failed"
        }
      }, context)],
      ["run control action", async (
        store: LocalStore,
        fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
        attempt: PaperTradingComparisonActivationAttemptRecord,
        context: PaperTradingComparisonRuntimeWriteContext
      ) => {
        const input = runtimeActivationRunControlInput(
          fixture,
          attempt,
          "challenger",
          "start"
        );
        return store.recordRunControlAudit({
          ...input,
          command: {
            ...input.command,
            action: "pause",
            requested_lifecycle_status: "paused"
          },
          decision: {
            ...input.decision,
            resulting_lifecycle_status: "paused"
          },
          audit_event: {
            ...input.audit_event,
            runtime_lifecycle_status: "paused"
          }
        }, context);
      }],
      ["evaluation evidence", async (
        store: LocalStore,
        fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
        attempt: PaperTradingComparisonActivationAttemptRecord,
        context: PaperTradingComparisonRuntimeWriteContext
      ) => {
        await store.recordSandboxStart(
          runtimeActivationSandboxStart(fixture, attempt, "challenger"),
          context
        );
        await store.recordRunControlAudit(
          runtimeActivationRunControlInput(fixture, attempt, "challenger", "start"),
          context
        );
        return store.recordPaperTradingEvaluation({
          ...runtimeActivationEvaluation(fixture, attempt, "challenger", "running"),
          observation_count: 1
        }, context);
      }]
    ] as const)("rejects runtime activation %s drift", async (_label, invoke) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-transition-${_label}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const context = runtimeActivationWriteContext(attempt, "challenger", "start");

      await expectStoreError(
        invoke(store, fixture, attempt, context),
        "paper_trading_comparison_runtime_write_transition_mismatch"
      );
    });

    it("rejects a context from a prior attempt", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const first = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(first);
      await completeStoppedRuntimeActivationAttempt(store, first);
      await store.recordPaperTradingComparisonActivationAttempt(
        validRuntimeActivationAttempt(fixture.activation, 2)
      );

      await expectStoreError(
        store.recordSandboxStart(
          runtimeActivationSandboxStart(fixture, first, "challenger"),
          runtimeActivationWriteContext(first, "challenger", "start")
        ),
        "paper_trading_comparison_runtime_write_state_conflict"
      );
    });

    it("rejects same-id runtime control audit drift", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const context = runtimeActivationWriteContext(attempt, "challenger", "start");
      await store.recordSandboxStart(
        runtimeActivationSandboxStart(fixture, attempt, "challenger"),
        context
      );
      const exact = runtimeActivationRunControlInput(
        fixture,
        attempt,
        "challenger",
        "start"
      );
      await store.recordRunControlAudit(exact, context);

      await expectStoreError(
        store.recordRunControlAudit({
          ...exact,
          command: { ...exact.command, reason_summary: "drifted replay" }
        }, context),
        "paper_trading_comparison_runtime_write_transition_mismatch"
      );
    });

    it("rejects sandbox placement mutation under exact start context", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      const sandbox = runtimeActivationSandboxStart(fixture, attempt, "challenger");
      const placement = await readComparisonFixtureRecord<SandboxPlacementRecord>(
        store,
        "sandbox-placements",
        fixture.challengerRun.placement_ref.id
      );

      await expectStoreError(
        store.recordSandboxStart({
          ...sandbox,
          placement: { ...placement, service_name: "drifted-placement" }
        }, runtimeActivationWriteContext(attempt, "challenger", "start")),
        "paper_trading_comparison_runtime_write_transition_mismatch"
      );
    });

    it.each([
      ["observation", "paper_trading_comparison_inert_graph_mutation_forbidden"],
      ["ledger", "paper_trading_comparison_inert_graph_mutation_forbidden"],
      ["sandbox-observations", "invalid_paper_trading_comparison_checkpoint_write_context"],
      ["commitment", "paper_trading_evaluation_commitment_conflict"],
      ["system-code", "paper_trading_comparison_frozen_authority_write_conflict"],
      ["admission", "paper_trading_comparison_frozen_authority_write_conflict"],
      ["promotion", "paper_trading_comparison_frozen_authority_write_conflict"]
    ] as const)("does not extend runtime context to forbidden %s writer", async (
      writer,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `runtime-forbidden-${writer}`));
      await store.initialize();
      const fixture = await storedRuntimeActivationFixture(store);
      const attempt = validRuntimeActivationAttempt(fixture.activation);
      await store.recordPaperTradingComparisonActivationAttempt(attempt);
      if (writer === "sandbox-observations") {
        await seedBoundSandboxForWriterTest(store, fixture);
      }

      await expectStoreError(
        invokeForbiddenBoundSideWriterWithContext(
          store,
          fixture,
          writer,
          runtimeActivationWriteContext(attempt, "challenger", "start")
        ),
        code
      );
    });
  });

  describe("paper comparison checkpoint lifecycle", () => {
    it("appends, reloads, lists, and semantically replays one exact checkpoint attempt", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);

      await expect(store.recordPaperTradingComparisonCheckpointAttempt(attempt))
        .resolves.toEqual(attempt);
      await expect(store.recordPaperTradingComparisonCheckpointAttempt(attempt))
        .resolves.toEqual(attempt);
      const reordered = Object.fromEntries(
        Object.entries(attempt).reverse()
      ) as unknown as PaperTradingComparisonCheckpointAttemptRecord;
      await expect(store.recordPaperTradingComparisonCheckpointAttempt(reordered))
        .resolves.toEqual(attempt);
      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointAttempt(
          withCheckpointAttemptDigest({
            ...attempt,
            attempted_at: new Date(Date.parse(attempt.attempted_at) + 1).toISOString(),
            checkpoint_deadline_at: new Date(
              Date.parse(attempt.checkpoint_deadline_at) + 1
            ).toISOString()
          })
        ),
        "paper_trading_comparison_checkpoint_attempt_conflict"
      );
      await expect(store.getPaperTradingComparisonCheckpointAttempt(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual(attempt);
      await expect(store.listPaperTradingComparisonCheckpointAttempts(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([attempt]);
    });

    it.each([
      ["digest", (attempt: PaperTradingComparisonCheckpointAttemptRecord) => ({
        ...attempt,
        attempt_digest: "sha256:wrong"
      }), "paper_trading_comparison_checkpoint_attempt_digest_mismatch"],
      ["activation outcome", (attempt: PaperTradingComparisonCheckpointAttemptRecord) =>
        withCheckpointAttemptDigest({
          ...attempt,
          activation_outcome_digest: "sha256:wrong"
        }), "paper_trading_comparison_checkpoint_attempt_reference_mismatch"],
      ["tick", (attempt: PaperTradingComparisonCheckpointAttemptRecord) =>
        withCheckpointAttemptDigest({
          ...attempt,
          tick_digest: "sha256:wrong"
        }), "paper_trading_comparison_checkpoint_attempt_reference_mismatch"],
      ["side evaluation", (attempt: PaperTradingComparisonCheckpointAttemptRecord) =>
        withCheckpointAttemptDigest({
          ...attempt,
          challenger: {
            ...attempt.challenger,
            evaluation_record_digest: "sha256:wrong"
          }
        }), "paper_trading_comparison_checkpoint_attempt_state_mismatch"],
      ["provider baseline", (attempt: PaperTradingComparisonCheckpointAttemptRecord) =>
        withCheckpointAttemptDigest({
          ...attempt,
          champion: {
            ...attempt.champion,
            provider_request_count_before: 0
          }
        }), "paper_trading_comparison_checkpoint_attempt_state_mismatch"]
    ] as const)("rejects checkpoint attempt %s mismatch without mutation", async (
      label,
      mutate,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `checkpoint-attempt-${label}`));
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);

      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointAttempt(
          mutate(validCheckpointAttempt(fixture))
        ),
        code
      );
      await expect(store.listPaperTradingComparisonCheckpointAttempts(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([]);
    });

    it("serializes alternate checkpoint attempts and keeps one open intent", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const first = validCheckpointAttempt(fixture);
      const alternate = withCheckpointAttemptDigest({
        ...first,
        paper_trading_comparison_checkpoint_attempt_id: "checkpoint-attempt-alternate"
      });

      const results = await Promise.allSettled([
        store.recordPaperTradingComparisonCheckpointAttempt(first),
        store.recordPaperTradingComparisonCheckpointAttempt(alternate)
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect((results.find((result) => result.status === "rejected") as PromiseRejectedResult)
        .reason).toMatchObject({
          code: "paper_trading_comparison_checkpoint_attempt_state_conflict"
        });
    });

    it("allows only checkpoint-authorized sandbox evidence refresh", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const sandboxId = fixture.startResults.find((result) =>
        result.role === "challenger"
      )?.sandbox_ref?.id;
      if (!sandboxId) throw new Error("missing challenger sandbox");
      const evaluationBefore = await store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      );
      const capturedAt = new Date(Date.parse(attempt.attempted_at) + 1_000)
        .toISOString();

      const refreshed = await Reflect.apply(store.recordSandboxObservations, store, [
        sandboxId,
        {
          lifecycle_status: "running",
          logs: [{
            record_kind: "sandbox_log",
            version: 1,
            sandbox_log_id: `${sandboxId}-checkpoint-log`,
            sandbox_ref: { record_kind: "sandbox", id: sandboxId },
            lines: ["{\"event\":\"hold\",\"reason\":\"checkpoint\"}"],
            captured_at: capturedAt,
            authority_status: "trace_only"
          }],
          heartbeats: [],
          command_evidence: []
        },
        checkpointWriteContext(fixture, attempt, "challenger")
      ]);

      expect(refreshed.logs).toHaveLength(1);
      await expect(store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual(evaluationBefore);
      await expect(store.listPaperTradingObservations(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual([]);
    });

    it("rejects checkpoint sandbox evidence when authority targets the other role", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const sandboxId = fixture.startResults.find((result) =>
        result.role === "challenger"
      )?.sandbox_ref?.id;
      if (!sandboxId) throw new Error("missing challenger sandbox");

      await expectStoreError(
        Reflect.apply(store.recordSandboxObservations, store, [
          sandboxId,
          { lifecycle_status: "running", logs: [], heartbeats: [], command_evidence: [] },
          checkpointWriteContext(fixture, attempt, "champion")
        ]),
        "paper_trading_comparison_checkpoint_write_context_reference_mismatch"
      );
    });

    it("rejects lifecycle mutation through checkpoint sandbox evidence authority", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const sandboxId = fixture.startResults.find((result) =>
        result.role === "challenger"
      )?.sandbox_ref?.id;
      if (!sandboxId) throw new Error("missing challenger sandbox");

      await expectStoreError(
        store.recordSandboxObservations(
          sandboxId,
          { lifecycle_status: "stopped", logs: [], heartbeats: [], command_evidence: [] },
          checkpointWriteContext(fixture, attempt, "challenger")
        ),
        "paper_trading_comparison_checkpoint_write_state_conflict"
      );
      await expect(store.getSandbox(sandboxId)).resolves.toMatchObject({
        lifecycle_status: "running"
      });
    });

    it("reserves paired outcome persistence for the atomic transaction", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);

      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointOutcome(
          validPairedCheckpointOutcome(attempt)
        ),
        "paper_trading_comparison_paired_checkpoint_transaction_required"
      );
      await expect(store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual([]);
    });

    it("appends an exact incomplete outcome only after symmetric cleanup", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const beforeCleanup = validIncompleteCheckpointOutcome(attempt);

      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointOutcome(beforeCleanup),
        "paper_trading_comparison_checkpoint_outcome_state_conflict"
      );
      await stopBothRunningRuntimeActivation(store, fixture);
      const outcome = validIncompleteCheckpointOutcome(attempt, {
        completedAt: new Date(
          Date.parse(fixture.outcome.completed_at) + 20_000
        ).toISOString()
      });

      await expect(store.recordPaperTradingComparisonCheckpointOutcome(outcome))
        .resolves.toEqual(outcome);
      await expect(store.recordPaperTradingComparisonCheckpointOutcome(outcome))
        .resolves.toEqual(outcome);
      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointOutcome(
          withCheckpointOutcomeDigest({
            ...outcome,
            stable_error_code: "drifted-error"
          })
        ),
        "paper_trading_comparison_checkpoint_outcome_conflict"
      );
      await expect(store.getPaperTradingComparisonCheckpointOutcome(
        outcome.paper_trading_comparison_checkpoint_outcome_id
      )).resolves.toEqual(outcome);
      await expect(store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual([outcome]);
    });

    it.each([
      ["attempt", "paper-trading-comparison-checkpoint-attempts",
        "paper_trading_comparison_checkpoint_attempt_reload_failed"],
      ["outcome", "paper-trading-comparison-checkpoint-outcomes",
        "paper_trading_comparison_checkpoint_outcome_reload_failed"]
    ] as const)("fails closed on corrupt persisted checkpoint %s", async (
      kind,
      collection,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `checkpoint-corrupt-${kind}`));
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      if (kind === "outcome") {
        await stopBothRunningRuntimeActivation(store, fixture);
        await store.recordPaperTradingComparisonCheckpointOutcome(
          validIncompleteCheckpointOutcome(attempt, {
            completedAt: new Date(
              Date.parse(fixture.outcome.completed_at) + 20_000
            ).toISOString()
          })
        );
      }
      const itemDir = path.join(store.root(), collection, "items");
      await mkdir(itemDir, { recursive: true });
      await writeFile(path.join(itemDir, "corrupt.json"), "{");

      const listing = kind === "attempt"
        ? store.listPaperTradingComparisonCheckpointAttempts(
            fixture.attempt.paper_trading_comparison_activation_attempt_id
          )
        : store.listPaperTradingComparisonCheckpointOutcomes(
            attempt.paper_trading_comparison_checkpoint_attempt_id
          );
      await expectStoreError(listing, code);
    });
  });

  describe("paired checkpoint transaction and ledger preview", () => {
    it("previews deterministic Ledger records without writing Store state", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const candidate = await store.getCandidate(FIXTURE_CANDIDATE_ID);
      if (!candidate) throw new Error("fixture candidate missing");
      const input = validLedgerInput(candidate.candidate_version.candidate_version_id);
      const before = await comparisonActivationInvariantSnapshot(store);

      const preview = await store.previewLedger(input);

      await expect(comparisonActivationInvariantSnapshot(store)).resolves.toEqual(before);
      const recorded = await store.recordLedger(input);
      expect(recorded).toEqual(preview);
    });

    it("commits both side observations and paired outcome through one exact bundle", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const input = await validPairedCheckpointTransactionInput(
        store,
        fixture,
        attempt,
        { championLedger: true }
      );

      const committed = await store.recordPaperTradingComparisonPairedCheckpoint(input);
      const replayed = await store.recordPaperTradingComparisonPairedCheckpoint(input);

      expect(committed).toEqual(input.outcome);
      expect(replayed).toEqual(committed);
      await expect(store.listPaperTradingObservations(
        attempt.champion.paper_trading_evaluation_ref.id
      )).resolves.toEqual([input.champion.observation]);
      await expect(store.listPaperTradingObservations(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual([input.challenger.observation]);
      await expect(store.getPaperTradingEvaluation(
        attempt.champion.paper_trading_evaluation_ref.id
      )).resolves.toEqual(input.champion.evaluation);
      await expect(store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual(input.challenger.evaluation);
      await expect(store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual([input.outcome]);
      expect(await readdir(path.join(
        store.root(),
        "paper-trading-comparison-checkpoint-transactions",
        "items"
      ))).toHaveLength(1);
      const championRun = await store.getTradingRun(
        attempt.champion.trading_run_ref.id
      );
      expect(championRun?.order_request_refs).toEqual([
        {
          record_kind: "order_request",
          id: input.champion.ledger_outcomes[0]?.order_request.order_request_id
        }
      ]);
    });

    it("keeps exact stop authority open after a paired checkpoint commit", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const input = await validPairedCheckpointTransactionInput(store, fixture, attempt);
      await store.recordPaperTradingComparisonPairedCheckpoint(input);
      const stopAuthority = runtimeActivationWriteContext(
        fixture.attempt,
        "challenger",
        "stop"
      );

      await expect(store.recordRunControlAudit(
        runtimeActivationRunControlInput(
          fixture,
          fixture.attempt,
          "challenger",
          "stop"
        ),
        stopAuthority
      )).resolves.toMatchObject({
        decision: { resulting_lifecycle_status: "stopped" }
      });
      await expect(store.getTradingRun(
        attempt.challenger.trading_run_ref.id
      )).resolves.toMatchObject({ runtime_lifecycle_status: "stopped" });
      const sandboxId = fixture.startResults.find((result) =>
        result.role === "challenger"
      )?.sandbox_ref?.id;
      if (!sandboxId) throw new Error("missing challenger sandbox");
      const stoppedAt = new Date(Date.parse(input.outcome.completed_at) + 1_000)
        .toISOString();
      await store.stopSandbox({ sandbox_id: sandboxId, stopped_at: stoppedAt }, {}, stopAuthority);
      await store.recordPaperTradingEvaluation({
        ...input.challenger.evaluation,
        status: "stopped",
        next_observation_at: undefined,
        stopped_at: stoppedAt
      }, stopAuthority);

      await expect(store.getPaperTradingEvaluation(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toMatchObject({
        status: "stopped",
        observation_count: 1,
        processed_trading_system_event_ids:
          input.challenger.evaluation.processed_trading_system_event_ids
      });
    });

    it("does not create a transaction bundle for invalid asymmetric input", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const input = await validPairedCheckpointTransactionInput(store, fixture, attempt);
      const invalid = {
        ...input,
        challenger: withPreparedCheckpointSideDigest({
          ...input.challenger,
          observation: {
            ...input.challenger.observation,
            paper_trading_comparison_tick_digest: "sha256:wrong-tick"
          }
        })
      };

      await expectStoreError(
        store.recordPaperTradingComparisonPairedCheckpoint(invalid),
        "paper_trading_comparison_paired_checkpoint_reference_mismatch"
      );
      await expect(readdir(path.join(
        store.root(),
        "paper-trading-comparison-checkpoint-transactions",
        "items"
      ))).rejects.toMatchObject({ code: "ENOENT" });
      await expect(store.listPaperTradingObservations(
        attempt.champion.paper_trading_evaluation_ref.id
      )).resolves.toEqual([]);
      await expect(store.listPaperTradingObservations(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual([]);
    });

    it("rematerializes missing paired records from the committed transaction bundle", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedBothRunningRuntimeActivationFixture(store);
      const attempt = validCheckpointAttempt(fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const input = await validPairedCheckpointTransactionInput(store, fixture, attempt);
      await store.recordPaperTradingComparisonPairedCheckpoint(input);

      await Promise.all([
        rm(path.join(
          store.root(),
          "paper-trading-observations/items",
          `${encodeURIComponent(input.champion.observation.paper_trading_observation_id)}.json`
        )),
        rm(path.join(
          store.root(),
          "paper-trading-observations/items",
          `${encodeURIComponent(input.challenger.observation.paper_trading_observation_id)}.json`
        )),
        rm(path.join(
          store.root(),
          "paper-trading-comparison-checkpoint-outcomes/items",
          `${encodeURIComponent(input.outcome.paper_trading_comparison_checkpoint_outcome_id)}.json`
        ))
      ]);

      const reloaded = new LocalStore(store.root());
      await expect(reloaded.recoverPaperTradingComparisonCheckpointTransactions())
        .resolves.toEqual([input.outcome]);
      await expect(reloaded.listPaperTradingObservations(
        attempt.champion.paper_trading_evaluation_ref.id
      )).resolves.toEqual([input.champion.observation]);
      await expect(reloaded.listPaperTradingObservations(
        attempt.challenger.paper_trading_evaluation_ref.id
      )).resolves.toEqual([input.challenger.observation]);
      await expect(reloaded.getPaperTradingComparisonCheckpointOutcome(
        input.outcome.paper_trading_comparison_checkpoint_outcome_id
      )).resolves.toEqual(input.outcome);
    });
  });

  describe("contiguous comparison tick", () => {
    it("appends, reloads, lists, and exactly replays one acknowledged next tick", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedAcknowledgedPairedCheckpointFixture(store);
      const nextTick = validNextPaperTradingComparisonTick(fixture);
      const authority = comparisonTickCaptureWriteContext(fixture);

      await expect(store.recordPaperTradingComparisonTick(nextTick, authority))
        .resolves.toEqual(nextTick);
      await expect(store.recordPaperTradingComparisonTick(nextTick, authority))
        .resolves.toEqual(nextTick);
      await expect(store.getPaperTradingComparisonTick(
        nextTick.paper_trading_comparison_tick_id
      )).resolves.toEqual(nextTick);
      await expect(store.listPaperTradingComparisonTicks(
        fixture.comparison.paper_trading_comparison_commitment_id
      )).resolves.toEqual([fixture.tick, nextTick]);
    });

    it("requires both exact first-tick acknowledgements and next-tick authority", async () => {
      const missingAuthorityStore = new LocalStore(path.join(tmpDir, "missing-authority"));
      await missingAuthorityStore.initialize();
      const acknowledged = await storedAcknowledgedPairedCheckpointFixture(
        missingAuthorityStore
      );
      await expectStoreError(
        missingAuthorityStore.recordPaperTradingComparisonTick(
          validNextPaperTradingComparisonTick(acknowledged)
        ),
        "invalid_paper_trading_comparison_tick_capture_context"
      );

      const missingAckStore = new LocalStore(path.join(tmpDir, "missing-ack"));
      await missingAckStore.initialize();
      const missingAck = await storedPairedCheckpointAttributionFixture(missingAckStore);
      await seedComparisonTickAttribution(missingAckStore, missingAck, ["champion"]);
      await expectStoreError(
        missingAckStore.recordPaperTradingComparisonTick(
          validNextPaperTradingComparisonTick(missingAck),
          comparisonTickCaptureWriteContext(missingAck)
        ),
        "paper_trading_comparison_tick_capture_state_conflict"
      );
    });

    it.each([
      ["stale previous outcome", (
        fixture: Awaited<ReturnType<typeof storedAcknowledgedPairedCheckpointFixture>>,
        tick: PaperTradingComparisonTickRecord,
        authority: PaperTradingComparisonTickCaptureWriteContext
      ) => ({
        tick,
        authority: { ...authority, previous_checkpoint_outcome_digest: "sha256:stale" }
      }), "paper_trading_comparison_tick_capture_reference_mismatch"],
      ["sequence gap", (
        _fixture: Awaited<ReturnType<typeof storedAcknowledgedPairedCheckpointFixture>>,
        tick: PaperTradingComparisonTickRecord,
        authority: PaperTradingComparisonTickCaptureWriteContext
      ) => ({
        tick: withTickDigest({ ...tick, sequence: 3 }),
        authority
      }), "paper_trading_comparison_tick_capture_state_conflict"],
      ["early cadence", (
        fixture: Awaited<ReturnType<typeof storedAcknowledgedPairedCheckpointFixture>>,
        tick: PaperTradingComparisonTickRecord,
        authority: PaperTradingComparisonTickCaptureWriteContext
      ) => ({
        tick: withTickDigest({
          ...tick,
          market_snapshot: {
            ...tick.market_snapshot,
            observed_at: new Date(Date.parse(fixture.tick.observed_at) + 1).toISOString()
          },
          public_execution_snapshot: {
            ...tick.public_execution_snapshot,
            observed_at: new Date(Date.parse(fixture.tick.observed_at) + 1).toISOString()
          },
          observed_at: new Date(Date.parse(fixture.tick.observed_at) + 2).toISOString()
        }),
        authority
      }), "paper_trading_comparison_tick_capture_state_conflict"],
      ["wrong predecessor", (
        _fixture: Awaited<ReturnType<typeof storedAcknowledgedPairedCheckpointFixture>>,
        tick: PaperTradingComparisonTickRecord,
        authority: PaperTradingComparisonTickCaptureWriteContext
      ) => ({
        tick: withTickDigest({
          ...tick,
          previous_tick_ref: {
            record_kind: "paper_trading_comparison_tick",
            id: "other-tick"
          }
        }),
        authority
      }), "paper_trading_comparison_tick_capture_reference_mismatch"]
    ] as const)("rejects %s for a contiguous comparison tick", async (
      _label,
      mutate,
      expectedCode
    ) => {
      const store = new LocalStore(path.join(tmpDir, _label));
      await store.initialize();
      const fixture = await storedAcknowledgedPairedCheckpointFixture(store);
      const changed = mutate(
        fixture,
        validNextPaperTradingComparisonTick(fixture),
        comparisonTickCaptureWriteContext(fixture)
      );

      await expectStoreError(
        store.recordPaperTradingComparisonTick(changed.tick, changed.authority),
        expectedCode
      );
      await expect(store.listPaperTradingComparisonTicks(
        fixture.comparison.paper_trading_comparison_commitment_id
      )).resolves.toEqual([fixture.tick]);
    });

    it("rejects an alternate tick at the already captured next sequence", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedAcknowledgedPairedCheckpointFixture(store);
      const nextTick = validNextPaperTradingComparisonTick(fixture);
      const authority = comparisonTickCaptureWriteContext(fixture);
      await store.recordPaperTradingComparisonTick(nextTick, authority);

      await expectStoreError(
        store.recordPaperTradingComparisonTick(withTickDigest({
          ...nextTick,
          paper_trading_comparison_tick_id: "paper-comparison-next-tick-alternate"
        }), authority),
        "paper_trading_comparison_tick_sequence_conflict"
      );
    });
  });

  describe("repeated paired checkpoint transaction", () => {
    it("accepts a bounded provider baseline after idempotent acknowledgement replay", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedCapturedNextComparisonTickFixture(store);
      const attempt = await validNextCheckpointAttempt(store, fixture);
      const replayedRequestBaseline = withCheckpointAttemptDigest({
        ...attempt,
        champion: {
          ...attempt.champion,
          provider_request_count_before:
            attempt.champion.provider_request_count_before + 1
        },
        challenger: {
          ...attempt.challenger,
          provider_request_count_before:
            attempt.challenger.provider_request_count_before + 2
        }
      });

      await expect(store.recordPaperTradingComparisonCheckpointAttempt(
        replayedRequestBaseline
      )).resolves.toEqual(replayedRequestBaseline);
    });

    it("rejects a replayed provider baseline above the frozen request cap", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedCapturedNextComparisonTickFixture(store);
      const attempt = await validNextCheckpointAttempt(store, fixture);
      const overCap = withCheckpointAttemptDigest({
        ...attempt,
        champion: {
          ...attempt.champion,
          provider_request_count_before:
            fixture.attempt.activation_policy.maximum_provider_request_count_per_side + 1
        }
      });

      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointAttempt(overCap),
        "paper_trading_comparison_checkpoint_attempt_state_mismatch"
      );
    });

    it("requires the exact previous paired outcome for checkpoint sequence 2", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedCapturedNextComparisonTickFixture(store);
      const attempt = await validNextCheckpointAttempt(store, fixture);
      const stale = withCheckpointAttemptDigest({
        ...attempt,
        previous_checkpoint_outcome_digest: "sha256:stale"
      });

      await expectStoreError(
        store.recordPaperTradingComparisonCheckpointAttempt(stale),
        "paper_trading_comparison_checkpoint_attempt_reference_mismatch"
      );
      await expect(store.listPaperTradingComparisonCheckpointAttempts(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([fixture.checkpointAttempt]);
    });

    it("atomically advances both acknowledged-silence sides from sequence 1 to 2", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRepeatedCheckpointIntentFixture(store);
      const input = await validRepeatedPairedCheckpointTransactionInput(store, fixture);

      await expect(store.recordPaperTradingComparisonPairedCheckpoint(input))
        .resolves.toEqual(input.outcome);
      await expect(store.recordPaperTradingComparisonPairedCheckpoint(input))
        .resolves.toEqual(input.outcome);

      await expect(store.listPaperTradingComparisonCheckpointAttempts(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([
        fixture.checkpointAttempt,
        fixture.nextCheckpointAttempt
      ]);
      for (const role of ["champion", "challenger"] as const) {
        await expect(store.listPaperTradingObservations(
          fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual([
          fixture.checkpoint[role].observation,
          input[role].observation
        ]);
        await expect(store.getPaperTradingEvaluation(
          fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual(input[role].evaluation);
        expect(input.outcome[role]).toMatchObject({
          observation_status: "no_order",
          tick_acknowledgement_ref: {
            id: fixture.nextAcknowledgements.find((record) =>
              record.role === role
            )?.paper_trading_comparison_tick_acknowledgement_id
          }
        });
      }
      expect(await readdir(path.join(
        store.root(),
        "paper-trading-comparison-checkpoint-transactions",
        "items"
      ))).toHaveLength(2);
    });

    it("rejects cross-role acknowledgement lineage before any sequence 2 mutation", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRepeatedCheckpointIntentFixture(store);
      const input = await validRepeatedPairedCheckpointTransactionInput(store, fixture);
      const challengerAcknowledgement = fixture.nextAcknowledgements.find((record) =>
        record.role === "challenger"
      );
      if (!challengerAcknowledgement) throw new Error("missing challenger acknowledgement");
      const invalid = {
        ...input,
        champion: withPreparedCheckpointSideDigest({
          ...input.champion,
          observation: {
            ...input.champion.observation,
            paper_trading_comparison_tick_acknowledgement_ref: {
              record_kind: "paper_trading_comparison_tick_acknowledgement",
              id: challengerAcknowledgement
                .paper_trading_comparison_tick_acknowledgement_id
            },
            paper_trading_comparison_tick_acknowledgement_digest:
              challengerAcknowledgement.acknowledgement_digest
          }
        })
      };

      await expectStoreError(
        store.recordPaperTradingComparisonPairedCheckpoint(invalid),
        "paper_trading_comparison_paired_checkpoint_reference_mismatch"
      );
      for (const role of ["champion", "challenger"] as const) {
        await expect(store.listPaperTradingObservations(
          fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual([fixture.checkpoint[role].observation]);
      }
      await expect(store.listPaperTradingComparisonCheckpointOutcomes(
        fixture.nextCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual([]);
    });

    it("records an incomplete sequence 2 outcome only after symmetric cleanup", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedCapturedNextComparisonTickFixture(store);
      const attempt = await validNextCheckpointAttempt(store, fixture);
      await store.recordPaperTradingComparisonCheckpointAttempt(attempt);
      const cleanup = await stopBothRunningRuntimeActivation(store, fixture);
      const outcome = validIncompleteCheckpointOutcome(attempt, {
        completedAt: new Date(Date.parse(cleanup.completed_at) + 1_000).toISOString()
      });

      await expect(store.recordPaperTradingComparisonCheckpointOutcome(outcome))
        .resolves.toEqual(outcome);
      await expect(store.listPaperTradingComparisonCheckpointOutcomes(
        attempt.paper_trading_comparison_checkpoint_attempt_id
      )).resolves.toEqual([outcome]);
      for (const role of ["champion", "challenger"] as const) {
        await expect(store.listPaperTradingObservations(
          attempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual([fixture.checkpoint[role].observation]);
      }
    });

    it("recovers missing sequence 2 records without replaying sequence 1 over newer state", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRepeatedCheckpointIntentFixture(store);
      const input = await validRepeatedPairedCheckpointTransactionInput(store, fixture);
      await store.recordPaperTradingComparisonPairedCheckpoint(input);

      await Promise.all([
        rm(path.join(
          store.root(),
          "paper-trading-observations/items",
          `${encodeURIComponent(input.champion.observation.paper_trading_observation_id)}.json`
        )),
        rm(path.join(
          store.root(),
          "paper-trading-observations/items",
          `${encodeURIComponent(input.challenger.observation.paper_trading_observation_id)}.json`
        )),
        rm(path.join(
          store.root(),
          "paper-trading-comparison-checkpoint-outcomes/items",
          `${encodeURIComponent(input.outcome.paper_trading_comparison_checkpoint_outcome_id)}.json`
        ))
      ]);

      const reloaded = new LocalStore(store.root());
      await expect(reloaded.recoverPaperTradingComparisonCheckpointTransactions())
        .resolves.toEqual([fixture.checkpoint.outcome, input.outcome]);
      for (const role of ["champion", "challenger"] as const) {
        await expect(reloaded.listPaperTradingObservations(
          fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual([
          fixture.checkpoint[role].observation,
          input[role].observation
        ]);
        await expect(reloaded.getPaperTradingEvaluation(
          fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
        )).resolves.toEqual(input[role].evaluation);
      }
    });

    it("preserves an exact stopped successor while recovering committed checkpoints", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedRepeatedCheckpointIntentFixture(store);
      const input = await validRepeatedPairedCheckpointTransactionInput(store, fixture);
      await store.recordPaperTradingComparisonPairedCheckpoint(input);

      const stoppedAt = "2026-07-10T00:10:00.000Z";
      for (const role of ["champion", "challenger"] as const) {
        const evaluation: PaperTradingEvaluationRecord = {
          ...input[role].evaluation,
          status: "stopped",
          next_observation_at: undefined,
          stopped_at: stoppedAt
        };
        const run = await store.getTradingRun(evaluation.trading_run_ref.id);
        if (!run) throw new Error(`missing ${role} TradingRun`);
        const stoppedRun: TradingRunRecord = {
          ...run,
          runtime_lifecycle_status: "stopped"
        };
        await writeStoreJson(
          stoppedRun,
          "trading-runs",
          "items",
          `${encodeURIComponent(stoppedRun.trading_run_id)}.json`
        );
        await writeStoreJson(
          evaluation,
          "paper-trading-evaluations",
          "items",
          `${encodeURIComponent(evaluation.paper_trading_evaluation_id)}.json`
        );
      }

      const reloaded = new LocalStore(store.root());
      await expect(reloaded.recoverPaperTradingComparisonCheckpointTransactions())
        .resolves.toEqual([fixture.checkpoint.outcome, input.outcome]);
      for (const role of ["champion", "challenger"] as const) {
        await expect(reloaded.getTradingRun(input[role].evaluation.trading_run_ref.id))
          .resolves.toMatchObject({ runtime_lifecycle_status: "stopped" });
        await expect(reloaded.getPaperTradingEvaluation(
          input[role].evaluation.paper_trading_evaluation_id
        )).resolves.toMatchObject({ status: "stopped", stopped_at: stoppedAt });
      }

      const championEvaluation = await reloaded.getPaperTradingEvaluation(
        input.champion.evaluation.paper_trading_evaluation_id
      );
      if (!championEvaluation) throw new Error("missing stopped champion evaluation");
      await writeStoreJson(
        {
          ...championEvaluation,
          latest_score: {
            ...championEvaluation.latest_score,
            net_revenue_usdt: championEvaluation.latest_score.net_revenue_usdt + 1
          }
        },
        "paper-trading-evaluations",
        "items",
        `${encodeURIComponent(championEvaluation.paper_trading_evaluation_id)}.json`
      );
      await expectStoreError(
        new LocalStore(store.root()).recoverPaperTradingComparisonCheckpointTransactions(),
        "paper_trading_comparison_paired_checkpoint_materialization_conflict"
      );
    });
  });

  describe("comparison tick attribution", () => {
    it("appends, reloads, lists, and semantically replays exact delivery and acknowledgement", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const delivery = validComparisonTickDelivery(fixture, "champion");
      const deliveryAuthority = comparisonTickIOWriteContext(
        fixture,
        "champion",
        "deliver_market_snapshot"
      );

      await expect(store.recordPaperTradingComparisonTickDelivery(
        delivery,
        deliveryAuthority
      )).resolves.toEqual(delivery);
      await expect(store.recordPaperTradingComparisonTickDelivery(
        Object.fromEntries(Object.entries(delivery).reverse()) as unknown as
          PaperTradingComparisonTickDeliveryRecord,
        deliveryAuthority
      )).resolves.toEqual(delivery);
      await expect(store.getPaperTradingComparisonTickDelivery(
        delivery.paper_trading_comparison_tick_delivery_id
      )).resolves.toEqual(delivery);
      await expect(store.listPaperTradingComparisonTickDeliveries(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([delivery]);

      const acknowledgement = validComparisonTickAcknowledgement(delivery);
      const acknowledgementAuthority = comparisonTickIOWriteContext(
        fixture,
        "champion",
        "acknowledge_tick"
      );
      await expect(store.recordPaperTradingComparisonTickAcknowledgement(
        acknowledgement,
        acknowledgementAuthority
      )).resolves.toEqual(acknowledgement);
      await expect(store.recordPaperTradingComparisonTickAcknowledgement(
        acknowledgement,
        acknowledgementAuthority
      )).resolves.toEqual(acknowledgement);
      await expect(store.getPaperTradingComparisonTickAcknowledgement(
        acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      )).resolves.toEqual(acknowledgement);
      await expect(store.listPaperTradingComparisonTickAcknowledgements(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([acknowledgement]);

      const reloaded = new LocalStore(store.root());
      await expect(reloaded.getPaperTradingComparisonTickDelivery(
        delivery.paper_trading_comparison_tick_delivery_id
      )).resolves.toEqual(delivery);
      await expect(reloaded.getPaperTradingComparisonTickAcknowledgement(
        acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      )).resolves.toEqual(acknowledgement);
    });

    it("rejects delivery replay drift and alternate identity for the same role and tick", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const delivery = validComparisonTickDelivery(fixture, "champion");
      const authority = comparisonTickIOWriteContext(
        fixture,
        "champion",
        "deliver_market_snapshot"
      );
      await store.recordPaperTradingComparisonTickDelivery(delivery, authority);

      await expectStoreError(
        store.recordPaperTradingComparisonTickDelivery(
          withComparisonTickDeliveryDigest({
            ...delivery,
            delivered_at: new Date(Date.parse(delivery.delivered_at) + 1).toISOString()
          }),
          authority
        ),
        "paper_trading_comparison_tick_delivery_conflict"
      );
      await expectStoreError(
        store.recordPaperTradingComparisonTickDelivery(
          withComparisonTickDeliveryDigest({
            ...delivery,
            paper_trading_comparison_tick_delivery_id: `${delivery.role}:alternate`
          }),
          authority
        ),
        "paper_trading_comparison_tick_delivery_conflict"
      );
      await expect(store.listPaperTradingComparisonTickDeliveries(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([delivery]);
    });

    it.each([
      ["role authority", (
        fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
        delivery: PaperTradingComparisonTickDeliveryRecord,
        authority: PaperTradingComparisonTickIOWriteContext
      ) => ({ delivery, authority: { ...authority, role: "challenger" as const } }),
      "paper_trading_comparison_tick_delivery_reference_mismatch"],
      ["runtime", (
        _fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
        delivery: PaperTradingComparisonTickDeliveryRecord,
        authority: PaperTradingComparisonTickIOWriteContext
      ) => ({
        delivery: withComparisonTickDeliveryDigest({
          ...delivery,
          trading_run_ref: { record_kind: "trading_run", id: "other-run" }
        }),
        authority
      }), "paper_trading_comparison_tick_delivery_reference_mismatch"],
      ["tick digest", (
        _fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
        delivery: PaperTradingComparisonTickDeliveryRecord,
        authority: PaperTradingComparisonTickIOWriteContext
      ) => ({
        delivery: withComparisonTickDeliveryDigest({
          ...delivery,
          tick_digest: "sha256:wrong"
        }),
        authority: { ...authority, tick_digest: "sha256:wrong" }
      }), "paper_trading_comparison_tick_delivery_reference_mismatch"],
      ["provider cap", (
        fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
        delivery: PaperTradingComparisonTickDeliveryRecord,
        authority: PaperTradingComparisonTickIOWriteContext
      ) => ({
        delivery: withComparisonTickDeliveryDigest({
          ...delivery,
          provider_request_count_at_delivery:
            fixture.attempt.activation_policy.maximum_provider_request_count_per_side + 1
        }),
        authority
      }), "paper_trading_comparison_tick_delivery_state_conflict"],
      ["pre-checkpoint time", (
        fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
        delivery: PaperTradingComparisonTickDeliveryRecord,
        authority: PaperTradingComparisonTickIOWriteContext
      ) => ({
        delivery: withComparisonTickDeliveryDigest({
          ...delivery,
          delivered_at: new Date(
            Date.parse(fixture.checkpoint.outcome.completed_at) - 1
          ).toISOString()
        }),
        authority
      }), "paper_trading_comparison_tick_delivery_state_conflict"]
    ] as const)("rejects comparison tick delivery %s mismatch", async (
      label,
      mutate,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `tick-delivery-${label}`));
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const delivery = validComparisonTickDelivery(fixture, "champion");
      const authority = comparisonTickIOWriteContext(
        fixture,
        "champion",
        "deliver_market_snapshot"
      );
      const malformed = mutate(fixture, delivery, authority);

      await expectStoreError(
        store.recordPaperTradingComparisonTickDelivery(
          malformed.delivery,
          malformed.authority
        ),
        code
      );
      await expect(store.listPaperTradingComparisonTickDeliveries(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([]);
    });

    it.each([
      ["missing delivery", (
        ack: PaperTradingComparisonTickAcknowledgementRecord
      ) => withComparisonTickAcknowledgementDigest({
        ...ack,
        delivery_ref: { ...ack.delivery_ref, id: "missing-delivery" }
      }), "paper_trading_comparison_tick_acknowledgement_reference_not_found"],
      ["role", (
        ack: PaperTradingComparisonTickAcknowledgementRecord
      ) => withComparisonTickAcknowledgementDigest({
        ...ack,
        role: "challenger"
      }), "paper_trading_comparison_tick_acknowledgement_reference_mismatch"],
      ["provider order", (
        ack: PaperTradingComparisonTickAcknowledgementRecord
      ) => withComparisonTickAcknowledgementDigest({
        ...ack,
        provider_request_count_at_acknowledgement: 1
      }), "paper_trading_comparison_tick_acknowledgement_state_conflict"],
      ["time order", (
        ack: PaperTradingComparisonTickAcknowledgementRecord
      ) => withComparisonTickAcknowledgementDigest({
        ...ack,
        acknowledged_at: "2026-07-10T00:00:00.000Z"
      }), "paper_trading_comparison_tick_acknowledgement_state_conflict"]
    ] as const)("rejects comparison tick acknowledgement %s mismatch", async (
      label,
      mutate,
      code
    ) => {
      const store = new LocalStore(path.join(tmpDir, `tick-ack-${label}`));
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const delivery = validComparisonTickDelivery(fixture, "champion");
      await store.recordPaperTradingComparisonTickDelivery(
        delivery,
        comparisonTickIOWriteContext(fixture, "champion", "deliver_market_snapshot")
      );

      await expectStoreError(
        store.recordPaperTradingComparisonTickAcknowledgement(
          mutate(validComparisonTickAcknowledgement(delivery)),
          comparisonTickIOWriteContext(fixture, "champion", "acknowledge_tick")
        ),
        code
      );
      await expect(store.listPaperTradingComparisonTickAcknowledgements(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([]);
    });

    it("requires the exact current both-running post-checkpoint graph", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const closed = validRuntimeActivationOutcome(
        fixture.attempt,
        fixture.startResults,
        "stopped_cleanly",
        fixture.outcome
      );
      await overwriteComparisonFixtureRecord(
        store,
        "paper-trading-comparison-activation-outcomes",
        closed.paper_trading_comparison_activation_outcome_id,
        closed
      );

      await expectStoreError(
        store.recordPaperTradingComparisonTickDelivery(
          validComparisonTickDelivery(fixture, "champion"),
          comparisonTickIOWriteContext(fixture, "champion", "deliver_market_snapshot")
        ),
        "paper_trading_comparison_tick_delivery_state_conflict"
      );
    });

    it("fails closed when persisted attribution or paired side evidence is corrupt", async () => {
      const store = new LocalStore(tmpDir);
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const delivery = validComparisonTickDelivery(fixture, "champion");
      await store.recordPaperTradingComparisonTickDelivery(
        delivery,
        comparisonTickIOWriteContext(fixture, "champion", "deliver_market_snapshot")
      );
      await overwriteComparisonFixtureBytes(
        store,
        "paper-trading-comparison-tick-deliveries",
        delivery.paper_trading_comparison_tick_delivery_id,
        "{broken"
      );

      await expectStoreError(
        store.getPaperTradingComparisonTickDelivery(
          delivery.paper_trading_comparison_tick_delivery_id
        ),
        "paper_trading_comparison_tick_delivery_reload_failed"
      );

      const graphStore = new LocalStore(path.join(tmpDir, "tick-corrupt-graph"));
      await graphStore.initialize();
      const graphFixture = await storedPairedCheckpointAttributionFixture(graphStore);
      await overwriteComparisonFixtureBytes(
        graphStore,
        "paper-trading-evaluations",
        graphFixture.checkpoint.champion.evaluation.paper_trading_evaluation_id,
        "{broken"
      );
      await expectStoreError(
        graphStore.recordPaperTradingComparisonTickDelivery(
          validComparisonTickDelivery(graphFixture, "champion"),
          comparisonTickIOWriteContext(
            graphFixture,
            "champion",
            "deliver_market_snapshot"
          )
        ),
        "paper_trading_comparison_tick_delivery_graph_invalid"
      );
    });

    it.each([
      "sandbox",
      "evaluation",
      "observation",
      "ledger",
      "run-control",
      "tick",
      "checkpoint",
      "promotion"
    ] as const)("does not extend tick IO context to forbidden %s writer", async (writer) => {
      const store = new LocalStore(path.join(tmpDir, `tick-io-forbidden-${writer}`));
      await store.initialize();
      const fixture = await storedPairedCheckpointAttributionFixture(store);
      const context = comparisonTickIOWriteContext(
        fixture,
        "challenger",
        "deliver_market_snapshot"
      );

      await expect(
        invokeForbiddenTickIOWriter(store, fixture, writer, context)
      ).rejects.toMatchObject({ name: "LocalStoreError" });
      await expect(store.listPaperTradingComparisonTickDeliveries(
        fixture.attempt.paper_trading_comparison_activation_attempt_id
      )).resolves.toEqual([]);
    });
  });
});

interface ComparisonPreparationFixtureOptions {
  championAdmissionStatus?: "admitted" | "duplicate" | "quarantined";
  omitChampionAdmission?: boolean;
  mismatchChampionAdmission?: boolean;
  futureChampionAdmission?: boolean;
  omitChampionPromotion?: boolean;
  mismatchChampionPromotion?: boolean;
  futureChampionPromotion?: boolean;
  missingPromotionEvaluation?: boolean;
  wrongPromotionEvaluationRef?: boolean;
  preAdmissionQualification?: boolean;
  reversePromotionObservationTime?: boolean;
  challengerSystemCodeAfterAdmission?: boolean;
  comparisonMode?: "bootstrap" | "champion_challenge";
  duplicateChallengerSystemCode?: boolean;
  challengerSystemCode?: SystemCodeRecord;
  comparisonPolicy?: Partial<PaperTradingComparisonPolicy>;
  challengerFullCycleDirection?: ResearchDirectionKind;
}

type ComparisonFlowFixtureOptions = {
  comparisonPolicy?: Partial<PaperTradingComparisonPolicy>;
  challengerFullCycleDirection?: ResearchDirectionKind;
};

async function overwriteComparisonFixtureRecord(
  store: LocalStore,
  collection: string,
  id: string,
  record: unknown
): Promise<void> {
  await mkdir(path.join(store.root(), collection, "items"), { recursive: true });
  await writeFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8"
  );
}

async function overwriteComparisonFixtureBytes(
  store: LocalStore,
  collection: string,
  id: string,
  bytes: string
): Promise<void> {
  await mkdir(path.join(store.root(), collection, "items"), { recursive: true });
  await writeFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    bytes,
    "utf8"
  );
}

async function readComparisonFixtureRecord<T>(
  store: LocalStore,
  collection: string,
  id: string
): Promise<T> {
  return JSON.parse(await readFile(
    path.join(store.root(), collection, "items", `${encodeURIComponent(id)}.json`),
    "utf8"
  )) as T;
}

async function comparisonPreparationFixture(
  store: LocalStore,
  options: ComparisonPreparationFixtureOptions = {}
) {
  const champion = await store.getCandidate(FIXTURE_CANDIDATE_ID);
  if (!champion) throw new Error("fixture champion was not materialized");
  const challengerCode = options.challengerSystemCode ?? {
    ...validProposedSystemCodeRecord(),
    system_code_id: "system-code-paper-comparison-challenger",
    artifact_digest: options.duplicateChallengerSystemCode
      ? (await store.getSystemCode(FIXTURE_SYSTEM_CODE_ID))!.artifact_digest
      : "sha256:paper-comparison-challenger",
    artifact_path: "fixtures/trading-systems/clock.py",
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-arena-paper-system-code"
    },
    created_at: options.challengerSystemCodeAfterAdmission
      ? "2026-07-09T20:57:00.000Z"
      : "2026-07-09T20:50:00.000Z",
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    }
  };
  await store.recordSystemCode(challengerCode);
  const challengerMaterializationInput: CandidateMaterializationInput = {
    ...validMaterializationInput(),
    idempotency_key: "paper-comparison-challenger",
    system_code_ref: options.duplicateChallengerSystemCode
      ? { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID }
      : { record_kind: "system_code", id: challengerCode.system_code_id },
    ...(options.challengerFullCycleDirection ? {
      full_cycle_lineage: {
        source: {
          trading_system_id: champion.candidate_id,
          candidate_version_id: champion.candidate_version.candidate_version_id,
          system_code_ref: {
            record_kind: "system_code",
            id: "system-code-comparison-admission-source-challenger"
          }
        },
        generated: {
          system_code_ref: {
            record_kind: "system_code",
            id: challengerCode.system_code_id
          },
          artifact_digest: challengerCode.artifact_digest,
          generated_by_agent: true
        },
        evaluation: {
          status: "accepted",
          score: 1,
          direction_kind: options.challengerFullCycleDirection
        }
      }
    } : {})
  };
  const challengerOutcome = await store.materializeCandidate(challengerMaterializationInput);
  if (challengerOutcome.status !== "materialized") {
    throw new Error("comparison challenger was not materialized");
  }
  const challenger = challengerOutcome.candidate;
  const championAdmission = await recordComparisonAdmissionEvidence(
    store,
    champion,
    "champion",
    options.championAdmissionStatus ?? "admitted",
    options.omitChampionAdmission ?? false,
    options.futureChampionAdmission
      ? "2026-07-10T00:01:00.000Z"
      : options.preAdmissionQualification
        ? "2026-07-09T21:15:00.000Z"
        : "2026-07-09T20:55:00.000Z"
  );
  const challengerAdmission = await recordComparisonAdmissionEvidence(
    store,
    challenger,
    "challenger",
    "admitted",
    false,
    "2026-07-09T20:56:00.000Z"
  );
  const comparisonMode = options.comparisonMode ?? "champion_challenge";
  let championPromotionEvidence = await recordQualifiedPromotionEvidence(
    store,
    champion,
    "champion",
    "2026-07-09T21:00:00.000Z"
  );
  if (options.reversePromotionObservationTime) {
    championPromotionEvidence = await reverseQualificationObservationTime(
      store,
      championPromotionEvidence
    );
  }
  const alternateChampionPromotionEvidence = options.wrongPromotionEvaluationRef
    ? await recordQualifiedPromotionEvidence(
        store,
        champion,
        "alternate-champion-authority",
        "2026-07-09T21:00:00.000Z"
      )
    : undefined;
  const promotion: TradingPromotionRecord = {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-comparison-champion",
    status: "promoted_for_trading_review",
    candidate_ref: options.mismatchChampionPromotion
      ? { record_kind: "trading_system_candidate", id: challenger.candidate_id }
      : { record_kind: "trading_system_candidate", id: champion.candidate_id },
    candidate_version_ref: options.mismatchChampionPromotion
      ? {
          record_kind: "candidate_version",
          id: challenger.candidate_version.candidate_version_id
        }
      : {
          record_kind: "candidate_version",
          id: champion.candidate_version.candidate_version_id
        },
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: championPromotionEvidence.evaluation.paper_trading_evaluation_id
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: "local-store-test-campaign"
      },
      campaign_digest: "sha256:local-store-test-campaign",
      campaign_outcome_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: "local-store-test-campaign-outcome"
      },
      campaign_outcome_digest: "sha256:local-store-test-campaign-outcome",
      final_verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: "local-store-test-final-verdict"
      },
      final_verdict_digest: "sha256:local-store-test-final-verdict"
    },
    promoted_at: options.futureChampionPromotion
      ? "2026-07-10T00:01:00.000Z"
      : "2026-07-09T21:31:00.000Z",
    authority_status: "not_live"
  };
  const promotionCampaign = {
    record_kind: "paper_trading_comparison_confirmation_campaign",
    paper_trading_comparison_confirmation_campaign_id:
      promotion.comparison_confirmation.campaign_ref.id,
    campaign_digest: promotion.comparison_confirmation.campaign_digest,
    challenger: {
      role: "challenger",
      candidate_ref: promotion.candidate_ref,
      candidate_version_ref: promotion.candidate_version_ref,
      system_code_ref: championPromotionEvidence.commitment.system_code_ref,
      system_code_artifact_digest:
        championPromotionEvidence.commitment.system_code_artifact_digest
    },
    comparison_policy: {
      ...validPaperTradingComparisonCommitment().comparison_policy,
      comparison_mode: "bootstrap"
    },
    evaluation_authority: "external_to_trading_systems",
    authority_status: "not_live"
  } as PaperTradingComparisonConfirmationCampaignRecord;
  installComparisonPromotionCampaignFixture(store, promotionCampaign);
  if (options.missingPromotionEvaluation) {
    await rm(path.join(
      store.root(),
      "paper-trading-evaluations/items",
      `${encodeURIComponent(championPromotionEvidence.evaluation.paper_trading_evaluation_id)}.json`
    ), { force: true });
  }
  if (!options.omitChampionPromotion) {
    await overwriteComparisonFixtureRecord(
      store,
      "trading-promotions",
      promotion.trading_promotion_id,
      promotion
    );
  }
  const preparationWithoutDigest: PaperTradingComparisonPreparationRecord = {
    record_kind: "paper_trading_comparison_preparation",
    version: 1,
    paper_trading_comparison_preparation_id: "paper-comparison-preparation-store-001",
    paper_trading_comparison_commitment_id: "paper-comparison-store-001",
    champion: await comparisonCandidateSide(
      store,
      "champion",
      champion,
      options.mismatchChampionAdmission ? challengerAdmission : championAdmission
    ),
    challenger: await comparisonCandidateSide(
      store,
      "challenger",
      challenger,
      challengerAdmission
    ),
    champion_selection: comparisonMode === "bootstrap"
      ? { selection_kind: "bootstrap" }
      : {
          selection_kind: "trading_review",
          trading_promotion_ref: {
            record_kind: "trading_promotion",
            id: promotion.trading_promotion_id
          },
          trading_promotion_digest: comparisonExactRecordDigest(
            paperTradingComparisonTradingPromotionDigestInput(promotion)
          ),
          paper_trading_evaluation_ref: {
            record_kind: "paper_trading_evaluation",
            id: (alternateChampionPromotionEvidence ?? championPromotionEvidence)
              .evaluation.paper_trading_evaluation_id
          },
          paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationRecordDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).evaluation
            )
          ),
          paper_trading_evaluation_commitment_ref: {
            record_kind: "paper_trading_evaluation_commitment",
            id: (alternateChampionPromotionEvidence ?? championPromotionEvidence)
              .commitment.paper_trading_evaluation_commitment_id
          },
          paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
            paperTradingComparisonEvaluationCommitmentRecordDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).commitment
            )
          ),
          paper_trading_observation_chain_digest: comparisonExactRecordDigest(
            paperTradingComparisonObservationChainDigestInput(
              (alternateChampionPromotionEvidence ?? championPromotionEvidence).observations
            )
          )
        },
    comparison_policy: {
      ...validPaperTradingComparisonCommitment().comparison_policy,
      comparison_mode: comparisonMode,
      ...options.comparisonPolicy
    },
    market_data_configuration_digest:
      validPaperTradingCommitment().data_identity.market_data_configuration_digest,
    paper_policy_identity: structuredClone(
      validPaperTradingComparisonCommitment().paper_policy_identity
    ),
    committed_at: "2026-07-10T00:00:00.000Z",
    preparation_digest: "",
    authority_status: "not_live"
  };
  return {
    champion,
    challenger,
    championAdmission,
    challengerAdmission,
    challengerMaterializationInput,
    promotion,
    promotionCampaign,
    championPromotionEvidence,
    alternateChampionPromotionEvidence,
    preparation: withPreparationDigest(preparationWithoutDigest)
  };
}

function installComparisonPromotionCampaignFixture(
  store: LocalStore,
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): void {
  const readPersisted = store
    .getPaperTradingComparisonConfirmationCampaign.bind(store);
  store.getPaperTradingComparisonConfirmationCampaign = async (
    campaignId: string
  ) => campaignId ===
    campaign.paper_trading_comparison_confirmation_campaign_id
    ? structuredClone(campaign)
    : readPersisted(campaignId);
}

async function comparisonCandidateSide(
  store: LocalStore,
  role: "champion" | "challenger",
  candidate: CandidateInspectReadModel,
  admission: CandidateAdmissionDecisionRecord
): Promise<PaperTradingComparisonCandidateSide> {
  const candidateVersion = await store.getCandidateVersion(
    candidate.candidate_version.candidate_version_id
  );
  const systemCode = candidateVersion?.system_code_ref
    ? await store.getSystemCode(candidateVersion.system_code_ref.id)
    : undefined;
  if (!candidateVersion || !systemCode) {
    throw new Error(`comparison ${role} exact CandidateVersion/SystemCode was not found`);
  }
  return {
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidateVersion.candidate_version_id
    },
    candidate_version_digest: comparisonExactRecordDigest(
      paperTradingComparisonCandidateVersionDigestInput(candidateVersion)
    ),
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonSystemCodeRecordDigestInput(systemCode)
    ),
    system_code_artifact_digest: systemCode.artifact_digest,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: admission.candidate_admission_decision_id
    },
    admission_decision_digest: comparisonExactRecordDigest(
      paperTradingComparisonAdmissionDecisionDigestInput(admission)
    )
  };
}

function comparisonExactRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

async function recordComparisonAdmissionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: "champion" | "challenger",
  status: "admitted" | "duplicate" | "quarantined",
  omitDecision: boolean,
  decidedAt?: string
): Promise<CandidateAdmissionDecisionRecord> {
  const systemCodeId = candidate.system_code?.ref?.id;
  const systemCode = systemCodeId ? await store.getSystemCode(systemCodeId) : undefined;
  if (!systemCode) throw new Error(`comparison ${suffix} SystemCode was not found`);
  const base = validCandidateAdmissionRecords();
  const sourceDigest = status === "duplicate"
    ? systemCode.artifact_digest
    : `sha256:comparison-admission-source-${suffix}`;
  const sourceSystemCode: SystemCodeRecord = {
    ...validCandidateAdmissionSourceSystemCode(),
    system_code_id: `system-code-comparison-admission-source-${suffix}`,
    artifact_digest: sourceDigest,
    created_at: "2026-07-09T20:51:00.000Z"
  };
  const experiment: ExperimentRunRecord = {
    ...base.experiment,
    experiment_run_id: `experiment-run-comparison-admission-${suffix}`,
    research_worker_ref: {
      record_kind: "research_worker",
      id: `research-worker-comparison-admission-${suffix}`
    },
    research_direction_ref: {
      record_kind: "research_direction",
      id: `research-direction-comparison-admission-${suffix}`
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: `trading-evaluation-task-comparison-admission-${suffix}`
    },
    submitted_at: "2026-07-09T20:52:00.000Z"
  };
  const evaluation: TradingEvaluationResultRecord = {
    ...base.evaluation,
    trading_evaluation_result_id: `trading-evaluation-result-comparison-admission-${suffix}`,
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: { ...experiment.trading_evaluation_task_ref },
    result_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    completed_at: "2026-07-09T20:53:00.000Z"
  };
  const finding: ResearchFindingRecord = {
    ...base.finding,
    research_finding_id: `research-finding-comparison-admission-${suffix}`,
    research_worker_ref: { ...experiment.research_worker_ref },
    research_direction_ref: { ...experiment.research_direction_ref },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    supporting_record_refs: [{
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    }],
    created_at: "2026-07-09T20:54:00.000Z"
  };
  const admission: CandidateAdmissionDecisionRecord = {
    ...base.admission,
    candidate_admission_decision_id: `candidate-admission-comparison-${suffix}`,
    source_system_code_ref: {
      record_kind: "system_code",
      id: sourceSystemCode.system_code_id
    },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    experiment_run_ref: { ...evaluation.experiment_run_ref },
    trading_evaluation_result_ref: { ...finding.trading_evaluation_result_ref },
    research_finding_ref: {
      record_kind: "research_finding",
      id: finding.research_finding_id
    },
    source_artifact_digest: sourceDigest,
    submitted_artifact_digest: systemCode.artifact_digest,
    research_worker_outcome: status === "duplicate" ? "unchanged" : "changed",
    evaluation_status: status === "quarantined" ? "quarantined_for_review" : "accepted",
    status,
    reason: status === "admitted"
      ? "evaluation_accepted"
      : status === "duplicate"
        ? "no_candidate_change"
        : "evaluation_quarantined",
    runnable_paper_handoff: status === "admitted",
    decided_at: decidedAt ?? base.admission.decided_at
  };
  await store.recordSystemCode(sourceSystemCode);
  await store.recordExperimentRun(experiment);
  await store.recordTradingEvaluationResult(evaluation);
  await store.recordResearchFinding(finding);
  if (!omitDecision) await store.recordCandidateAdmissionDecision(admission);
  return admission;
}

async function recordQualifiedPromotionEvidence(
  store: LocalStore,
  candidate: CandidateInspectReadModel,
  suffix: string,
  startedAt: string
): Promise<{
  run: TradingRunRecord;
  commitment: PaperTradingEvaluationCommitmentRecord;
  evaluation: PaperTradingEvaluationRecord;
  observations: PaperTradingObservationRecord[];
}> {
  const run = await store.createPaperTradingRun({
    idempotency_key: `promotion-evidence-${suffix}`,
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: startedAt
  });
  const systemCode = (await store.getSystemCode(run.system_code_ref!.id))!;
  const commitment = qualificationCommitment(
    candidate,
    run,
    systemCode,
    `paper-commitment-promotion-${suffix}`,
    startedAt
  );
  await store.recordPaperTradingEvaluationCommitment(commitment);
  let evaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(commitment),
    paper_trading_evaluation_id: `paper-evaluation-promotion-${suffix}`,
    candidate_ref: { ...commitment.candidate_ref },
    candidate_version_ref: { ...commitment.candidate_version_ref },
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    started_at: startedAt,
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  await store.recordPaperTradingEvaluation(evaluation);
  const observations: PaperTradingObservationRecord[] = [];
  for (let sequence = 1; sequence <= 30; sequence += 1) {
    const observedAt = new Date(Date.parse(startedAt) + sequence * 60_000).toISOString();
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id: `paper-observation-promotion-${suffix}-${sequence}`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: evaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...commitment.candidate_ref },
      candidate_version_ref: { ...commitment.candidate_version_ref },
      trading_run_ref: { ...commitment.trading_run_ref },
      sequence,
      status: "no_order",
      observed_at: observedAt,
      ...(sequence === 30
        ? {
            market_snapshot: {
              symbol: "BTCUSDT" as const,
              price: 60_000,
              observed_at: observedAt,
              source_kind: "binance_production_public_rest" as const,
              authority_status: "read_only" as const
            }
          }
        : {}),
      paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
      open_orders: [],
      processed_trading_system_event_ids: [],
      processed_public_trade_ids: [],
      score_delta: zeroPaperTradingProfitLoss(),
      cumulative_score: zeroPaperTradingProfitLoss(),
      authority_status: "not_live"
    };
    const { next_observation_at: _next, stopped_at: _stopped, ...previous } = evaluation;
    evaluation = {
      ...previous,
      status: sequence === 30 ? "stopped" : "running",
      observation_count: sequence,
      last_observed_at: observedAt,
      ...(sequence === 30
        ? { stopped_at: observedAt }
        : {
            next_observation_at: new Date(
              Date.parse(startedAt) + (sequence + 1) * 60_000
            ).toISOString()
          })
    };
    await store.recordPaperTradingObservation(observation, evaluation);
    observations.push(observation);
  }
  return { run, commitment, evaluation, observations };
}

async function reverseQualificationObservationTime(
  store: LocalStore,
  evidence: Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>
): Promise<Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>> {
  const observations = structuredClone(evidence.observations);
  const previous = observations[9];
  const current = observations[10];
  if (!previous || !current) throw new Error("qualification fixture requires observations");
  observations[10] = {
    ...current,
    observed_at: new Date(Date.parse(previous.observed_at) - 1_000).toISOString()
  };
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-observations",
    current.paper_trading_observation_id,
    observations[10]
  );
  return { ...evidence, observations };
}

function withPreparationDigest(
  preparation: PaperTradingComparisonPreparationRecord
): PaperTradingComparisonPreparationRecord {
  return {
    ...preparation,
    preparation_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonPreparationDigestInput(preparation))
      .digest("hex")}`
  };
}

async function storedComparisonFixture(
  store: LocalStore,
  input: {
    malformation?:
      | "provider-ineligible"
      | "window-policy-mismatch"
      | "duplicate-resolved-artifact"
      | "evaluation-outcome-state"
      | "replacement-evaluation-id"
      | "side-time-before-preparation"
      | "run-time-before-preparation";
    comparisonPolicy?: Partial<PaperTradingComparisonPolicy>;
    challengerFullCycleDirection?: ResearchDirectionKind;
  } = {}
) {
  const preparationFixture = await comparisonPreparationFixture(store, {
    comparisonPolicy: input.comparisonPolicy,
    challengerFullCycleDirection: input.challengerFullCycleDirection
  });
  const {
    champion,
    challenger,
    championAdmission,
    challengerAdmission,
    preparation,
    promotion,
    championPromotionEvidence,
    challengerMaterializationInput
  } = preparationFixture;
  await store.reservePaperTradingComparisonPreparation(preparation);
  const championRun = await store.createPaperTradingRun({
    idempotency_key: "paper-comparison-store:champion",
    candidate_id: champion.candidate_id,
    candidate_version_id: champion.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  const challengerRun = await store.createPaperTradingRun({
    idempotency_key: "paper-comparison-store:challenger",
    candidate_id: challenger.candidate_id,
    candidate_version_id: challenger.candidate_version.candidate_version_id,
    evidence_purpose: "qualification",
    created_at: "2026-07-10T00:00:00.000Z"
  });
  if (input.malformation === "run-time-before-preparation") {
    await overwriteComparisonFixtureRecord(store, "trading-runs", challengerRun.trading_run_id, {
      ...challengerRun,
      created_at: "2026-07-09T23:59:59.999Z"
    });
  }
  const championCommitment = qualificationCommitment(
    champion,
    championRun,
    (await store.getSystemCode(championRun.system_code_ref!.id))!,
    "paper-commitment-comparison-champion",
    preparation.committed_at
  );
  let challengerCommitment = qualificationCommitment(
    challenger,
    challengerRun,
    (await store.getSystemCode(challengerRun.system_code_ref!.id))!,
    "paper-commitment-comparison-challenger",
    preparation.committed_at
  );
  if (input.malformation === "provider-ineligible") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      provider_identity: {
        runtime_provider_kind: "managed_agent",
        agent_profile_ref: { record_kind: "agent_profile", id: "codex" },
        model: "gpt-5-codex",
        provider_configuration_digest: "sha256:well-shaped-ineligible-provider",
        qualification_eligible: false,
        ineligibility_reason: "provider_identity_unavailable"
      },
      commitment_digest: ""
    });
  }
  if (input.malformation === "window-policy-mismatch") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      window_policy: {
        ...challengerCommitment.window_policy,
        eligibility_policy_version: "paper-evidence-eligibility-v2"
      },
      commitment_digest: ""
    });
  }
  if (input.malformation === "duplicate-resolved-artifact") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      resolved_artifact_digest: championCommitment.resolved_artifact_digest,
      commitment_digest: ""
    });
  }
  if (input.malformation === "side-time-before-preparation") {
    challengerCommitment = withPaperTradingCommitmentDigest({
      ...challengerCommitment,
      committed_at: "2026-07-09T23:59:59.999Z",
      commitment_digest: ""
    });
  }
  const championEvaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(championCommitment),
    paper_trading_evaluation_id: "paper-evaluation-comparison-champion",
    candidate_ref: { ...championCommitment.candidate_ref },
    candidate_version_ref: { ...championCommitment.candidate_version_ref },
    trading_run_ref: { ...championCommitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: championCommitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: structuredClone(championCommitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  let challengerEvaluation: PaperTradingEvaluationRecord = {
    ...validPaperTradingEvaluation(challengerCommitment),
    paper_trading_evaluation_id: "paper-evaluation-comparison-challenger",
    candidate_ref: { ...challengerCommitment.candidate_ref },
    candidate_version_ref: { ...challengerCommitment.candidate_version_ref },
    trading_run_ref: { ...challengerCommitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: challengerCommitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    observation_count: 0,
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: structuredClone(challengerCommitment.initial_account_snapshot),
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: []
  };
  await store.recordPaperTradingEvaluationCommitment(championCommitment);
  await store.recordPaperTradingEvaluation(championEvaluation);
  await store.recordPaperTradingEvaluationCommitment(challengerCommitment);
  await store.recordPaperTradingEvaluation(challengerEvaluation);
  if (input.malformation === "evaluation-outcome-state") {
    challengerEvaluation = {
      ...challengerEvaluation,
      latest_score: {
        revenue_usdt: 1,
        cost_usdt: 0,
        net_revenue_usdt: 1,
        net_return_pct: 0.0001
      },
      next_observation_at: "2026-07-10T00:01:00.000Z"
    };
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-evaluations",
      challengerEvaluation.paper_trading_evaluation_id,
      challengerEvaluation
    );
  }
  if (input.malformation === "replacement-evaluation-id") {
    await store.recordPaperTradingEvaluation({
      ...challengerEvaluation,
      paper_trading_evaluation_id: "paper-evaluation-comparison-challenger-replacement"
    });
  }
  const comparison = withComparisonDigest({
    ...validPaperTradingComparisonCommitment(),
    paper_trading_comparison_commitment_id:
      preparation.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: preparation.paper_trading_comparison_preparation_id
    },
    champion: comparisonSide(preparation.champion, championCommitment, championEvaluation),
    challenger: comparisonSide(preparation.challenger, challengerCommitment, challengerEvaluation),
    champion_selection: structuredClone(preparation.champion_selection),
    comparison_policy: structuredClone(preparation.comparison_policy),
    market_data_configuration_digest: preparation.market_data_configuration_digest,
    paper_policy_identity: structuredClone(preparation.paper_policy_identity),
    committed_at: preparation.committed_at,
    commitment_digest: ""
  });
  return {
    champion,
    challenger,
    championRun,
    challengerRun,
    championCommitment,
    challengerCommitment,
    championEvaluation,
    challengerEvaluation,
    championAdmission,
    challengerAdmission,
    preparation,
    promotion,
    championPromotionEvidence,
    challengerMaterializationInput,
    comparison
  };
}

function qualificationCommitment(
  candidate: CandidateInspectReadModel,
  run: TradingRunRecord,
  systemCode: SystemCodeRecord,
  id: string,
  committedAt: string
): PaperTradingEvaluationCommitmentRecord {
  const base = validPaperTradingCommitment();
  return withPaperTradingCommitmentDigest({
    ...base,
    paper_trading_evaluation_commitment_id: id,
    evidence_purpose: "qualification",
    candidate_ref: { record_kind: "trading_system_candidate", id: candidate.candidate_id },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: candidate.candidate_version.candidate_version_id
    },
    trading_run_ref: { record_kind: "trading_run", id: run.trading_run_id },
    system_code_ref: { record_kind: "system_code", id: systemCode.system_code_id },
    system_code_artifact_digest: systemCode.artifact_digest,
    resolved_artifact_digest: `sha256:resolved-${systemCode.system_code_id}`,
    runtime_identity: {
      artifact_kind: systemCode.artifact_kind,
      runtime_kind: systemCode.runtime_kind,
      entrypoint: [...systemCode.entrypoint],
      ...(systemCode.artifact_runtime_contract_ref
        ? { artifact_runtime_contract_ref: { ...systemCode.artifact_runtime_contract_ref } }
        : {})
    },
    capability_policy_ref: { ...systemCode.capability_policy_ref },
    secret_policy_ref: { ...systemCode.secret_policy_ref },
    window_policy: {
      ...base.window_policy,
      release_policy: "sealed_until_adjudication"
    },
    committed_at: committedAt,
    commitment_digest: ""
  });
}

function comparisonSide(
  frozen: PaperTradingComparisonCandidateSide,
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluation: PaperTradingEvaluationRecord
): PaperTradingComparisonSide {
  return {
    ...structuredClone(frozen),
    trading_run_ref: { ...commitment.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    paper_trading_evaluation_commitment_digest: commitment.commitment_digest,
    paper_trading_evaluation_commitment_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationCommitmentRecordDigestInput(commitment)
    ),
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_record_digest: comparisonExactRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(evaluation)
    )
  };
}

function withComparisonDigest(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonCommitmentRecord {
  return {
    ...comparison,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonCommitmentDigestInput(comparison))
      .digest("hex")}`
  };
}

function validPaperTradingComparisonTick(
  comparison: PaperTradingComparisonCommitmentRecord
): PaperTradingComparisonTickRecord {
  return withTickDigest({
    record_kind: "paper_trading_comparison_tick",
    version: 1,
    paper_trading_comparison_tick_id: "paper-comparison-first-tick-store-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    sequence: 1,
    market_data_configuration_digest: comparison.market_data_configuration_digest,
    market_snapshot: {
      symbol: "BTCUSDT",
      price: 60_000,
      moving_average_fast: 60_100,
      moving_average_slow: 59_900,
      volatility: 0.01,
      expected_direction: "long",
      observed_at: "2026-07-10T00:00:00.100Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      authority_status: "read_only"
    },
    public_execution_snapshot: {
      symbol: "BTCUSDT",
      observed_at: "2026-07-10T00:00:00.200Z",
      source_kind: "binance_production_public_rest",
      source_priority: "rest_fallback",
      freshness: "fresh",
      ws_connected: false,
      rest_fallback_used: true,
      gap_detected: false,
      stream_marker: "paper-comparison-public-execution-001",
      agg_trades: [],
      authority_status: "read_only"
    },
    observed_at: "2026-07-10T00:00:01.000Z",
    tick_digest: "",
    authority_status: "not_live"
  });
}

function withTickDigest(
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonTickRecord {
  return {
    ...tick,
    tick_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonTickDigestInput(tick))
      .digest("hex")}`
  };
}

function validPaperTradingComparisonActivation(
  comparison: PaperTradingComparisonCommitmentRecord,
  tick: PaperTradingComparisonTickRecord
): PaperTradingComparisonActivationRecord {
  return withActivationDigest({
    record_kind: "paper_trading_comparison_activation",
    version: 1,
    paper_trading_comparison_activation_id: "paper-comparison-activation-store-001",
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    first_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: tick.paper_trading_comparison_tick_id
    },
    first_tick_digest: tick.tick_digest,
    champion: comparisonActivationSide(comparison.champion),
    challenger: comparisonActivationSide(comparison.challenger),
    market_data_configuration_digest: comparison.market_data_configuration_digest,
    activation_policy: paperTradingComparisonActivationPolicyFor(
      comparison.comparison_policy
    ),
    activation_scope: "qualification_pair",
    activation_status: "authorized",
    authorized_at: "2026-07-10T00:00:02.000Z",
    activation_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    private_exchange_access: "forbidden",
    credentials_access: "forbidden",
    authority_status: "not_live"
  });
}

function comparisonActivationSide(
  side: PaperTradingComparisonSide
): PaperTradingComparisonActivationSide {
  return {
    role: side.role,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...side.paper_trading_evaluation_commitment_ref
    },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref }
  };
}

function withActivationDigest(
  activation: PaperTradingComparisonActivationRecord
): PaperTradingComparisonActivationRecord {
  return {
    ...activation,
    activation_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonActivationDigestInput(activation))
      .digest("hex")}`
  };
}

async function storedRuntimeActivationFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedComparisonFixture(store, options);
  await store.recordPaperTradingComparisonCommitment(fixture.comparison);
  const tick = validPaperTradingComparisonTick(fixture.comparison);
  await store.recordPaperTradingComparisonTick(tick);
  const activation = validPaperTradingComparisonActivation(fixture.comparison, tick);
  await store.recordPaperTradingComparisonActivation(activation);
  return { ...fixture, tick, activation };
}

async function storedBothRunningRuntimeActivationFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedRuntimeActivationFixture(store, options);
  const attempt = validRuntimeActivationAttempt(fixture.activation);
  await store.recordPaperTradingComparisonActivationAttempt(attempt);
  const startResults: PaperTradingComparisonActivationSideResultRecord[] = [];
  for (const role of ["champion", "challenger"] as const) {
    const context = runtimeActivationWriteContext(attempt, role, "start");
    const sandbox = runtimeActivationSandboxStart(fixture, attempt, role);
    await store.recordSandboxStart(sandbox, context);
    await store.recordRunControlAudit(
      runtimeActivationRunControlInput(fixture, attempt, role, "start"),
      context
    );
    await store.recordPaperTradingEvaluation(
      runtimeActivationEvaluation(fixture, attempt, role, "running"),
      context
    );
    const result = runtimeActivationSucceededStartResult(
      attempt,
      role,
      sandbox.instance.sandbox_id
    );
    await store.recordPaperTradingComparisonActivationSideResult(result);
    startResults.push(result);
  }
  const outcome = validRuntimeActivationOutcome(attempt, startResults, "both_running");
  await store.recordPaperTradingComparisonActivationOutcome(outcome);
  return { ...fixture, attempt, startResults, outcome };
}

async function stopBothRunningRuntimeActivation(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedBothRunningRuntimeActivationFixture>>,
  options: { handoff?: boolean } = {}
): Promise<PaperTradingComparisonActivationOutcomeRecord> {
  const stopResults: PaperTradingComparisonActivationSideResultRecord[] = [];
  for (const role of ["champion", "challenger"] as const) {
    const context = runtimeActivationWriteContext(fixture.attempt, role, "stop");
    const sandboxId = fixture.startResults.find((result) => result.role === role)
      ?.sandbox_ref?.id;
    if (!sandboxId) throw new Error(`missing ${role} runtime sandbox`);
    const currentEvaluation = await store.getPaperTradingEvaluation(
      fixture.attempt[role].paper_trading_evaluation_ref.id
    );
    if (!currentEvaluation) throw new Error(`missing ${role} runtime evaluation`);
    const handoffBase = options.handoff
      ? Date.parse(currentEvaluation.last_observed_at ?? fixture.attempt.attempted_at)
      : Date.parse(fixture.attempt.attempted_at);
    const runControlInput = runtimeActivationRunControlInput(
      fixture,
      fixture.attempt,
      role,
      "stop"
    );
    await store.recordRunControlAudit(
      options.handoff
        ? {
            ...runControlInput,
            created_at: new Date(handoffBase + 1_000).toISOString()
          }
        : runControlInput,
      context
    );
    await store.stopSandbox({
      sandbox_id: sandboxId,
      stopped_at: new Date(handoffBase + (options.handoff ? 2_000 : 7_000))
        .toISOString()
    }, {}, context);
    await store.recordPaperTradingEvaluation(
      currentEvaluation.observation_count === 0
        ? runtimeActivationEvaluation(fixture, fixture.attempt, role, "stopped")
        : {
            ...currentEvaluation,
            status: "stopped",
            next_observation_at: undefined,
            stopped_at: new Date(handoffBase + (options.handoff ? 3_000 : 8_000))
              .toISOString()
          },
      context
    );
    const result = runtimeActivationSucceededStopResult(
      fixture.attempt,
      role,
      sandboxId,
      options.handoff ? "handoff_cleanup" : "policy_cleanup",
      options.handoff ? handoffBase : undefined
    );
    await store.recordPaperTradingComparisonActivationSideResult(result);
    stopResults.push(result);
  }
  const baseOutcome = validRuntimeActivationOutcome(
    fixture.attempt,
    stopResults,
    "stopped_cleanly",
    fixture.outcome
  );
  const outcome = options.handoff
    ? withRuntimeActivationOutcomeDigest({
        ...baseOutcome,
        outcome_reason: "handoff_cleanup",
        next_action: "checkpoint_handoff_complete",
        outcome_digest: ""
      })
    : baseOutcome;
  await store.recordPaperTradingComparisonActivationOutcome(outcome);
  return outcome;
}

function validCheckpointAttempt(
  fixture: Awaited<ReturnType<typeof storedBothRunningRuntimeActivationFixture>>
): PaperTradingComparisonCheckpointAttemptRecord {
  const attemptedAt = new Date(Date.parse(fixture.outcome.completed_at) + 1_000)
    .toISOString();
  const side = (role: "champion" | "challenger") => {
    const evaluation = runtimeActivationEvaluation(
      fixture,
      fixture.attempt,
      role,
      "running"
    );
    const startResult = fixture.startResults.find((result) => result.role === role);
    if (!startResult) throw new Error(`missing ${role} start result`);
    return {
      role,
      trading_run_ref: { ...fixture.attempt[role].trading_run_ref },
      paper_trading_evaluation_ref: {
        ...fixture.attempt[role].paper_trading_evaluation_ref
      },
      evaluation_record_digest: comparisonRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evaluation)
      ),
      observation_chain_digest: comparisonRecordDigest(
        paperTradingComparisonObservationChainDigestInput([])
      ),
      provider_request_count_before: startResult.provider_request_count
    };
  };
  return withCheckpointAttemptDigest({
    record_kind: "paper_trading_comparison_checkpoint_attempt",
    version: 1,
    paper_trading_comparison_checkpoint_attempt_id:
      `${fixture.attempt.paper_trading_comparison_activation_attempt_id}-checkpoint-1`,
    paper_trading_comparison_activation_ref: {
      ...fixture.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      fixture.attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: fixture.outcome.paper_trading_comparison_activation_outcome_id
    },
    activation_outcome_digest: fixture.outcome.outcome_digest,
    paper_trading_comparison_commitment_ref: {
      ...fixture.attempt.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      fixture.attempt.paper_trading_comparison_commitment_digest,
    tick_ref: { ...fixture.attempt.first_tick_ref },
    tick_digest: fixture.attempt.first_tick_digest,
    checkpoint_sequence: 1,
    champion: side("champion"),
    challenger: side("challenger"),
    attempted_at: attemptedAt,
    checkpoint_deadline_at: new Date(Date.parse(attemptedAt) + 60_000).toISOString(),
    attempt_status: "preparing",
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function checkpointWriteContext(
  fixture: Awaited<ReturnType<typeof storedBothRunningRuntimeActivationFixture>>,
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  role: "champion" | "challenger"
): PaperTradingComparisonCheckpointWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      ...attempt.paper_trading_comparison_activation_attempt_ref
    },
    paper_trading_comparison_activation_attempt_digest:
      attempt.paper_trading_comparison_activation_attempt_digest,
    activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: fixture.outcome.paper_trading_comparison_activation_outcome_id
    },
    activation_outcome_digest: fixture.outcome.outcome_digest,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    role,
    operation: "refresh_sandbox_evidence"
  };
}

function withCheckpointAttemptDigest(
  attempt: PaperTradingComparisonCheckpointAttemptRecord
): PaperTradingComparisonCheckpointAttemptRecord {
  return {
    ...attempt,
    attempt_digest: comparisonRecordDigest(
      paperTradingComparisonCheckpointAttemptDigestInput(attempt)
    )
  };
}

function validPairedCheckpointOutcome(
  attempt: PaperTradingComparisonCheckpointAttemptRecord
): PaperTradingComparisonCheckpointOutcomeRecord {
  const side = (role: "champion" | "challenger") => ({
    role,
    observation_ref: {
      record_kind: "paper_trading_observation",
      id: `${role}-checkpoint-observation-1`
    },
    observation_record_digest: `sha256:${role}-checkpoint-observation`,
    evaluation_record_digest: `sha256:${role}-checkpoint-evaluation`,
    ledger_chain_refs: [],
    observation_status: "no_order" as const,
    consumed_event_count: 0,
    provider_request_count_after: attempt[role].provider_request_count_before
  });
  return withCheckpointOutcomeDigest({
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id:
      `${attempt.paper_trading_comparison_checkpoint_attempt_id}-outcome`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    checkpoint_sequence: 1,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: side("champion"),
    challenger: side("challenger"),
    next_action: "serve_and_acknowledge_current_tick",
    completed_at: new Date(Date.parse(attempt.attempted_at) + 1_000).toISOString(),
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function validIncompleteCheckpointOutcome(
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  options: { completedAt?: string } = {}
): PaperTradingComparisonCheckpointOutcomeRecord {
  return withCheckpointOutcomeDigest({
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id:
      `${attempt.paper_trading_comparison_checkpoint_attempt_id}-outcome`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: attempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: attempt.attempt_digest,
    tick_ref: { ...attempt.tick_ref },
    tick_digest: attempt.tick_digest,
    checkpoint_sequence: attempt.checkpoint_sequence,
    outcome_status: "incomplete",
    outcome_reason: "side_preparation_failed",
    stable_error_code: "checkpoint_side_preparation_failed",
    next_action: "close_failed_comparison",
    completed_at: options.completedAt ?? new Date(
      Date.parse(attempt.attempted_at) + 1_000
    ).toISOString(),
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withCheckpointOutcomeDigest(
  outcome: PaperTradingComparisonCheckpointOutcomeRecord
): PaperTradingComparisonCheckpointOutcomeRecord {
  return {
    ...outcome,
    outcome_digest: comparisonRecordDigest(
      paperTradingComparisonCheckpointOutcomeDigestInput(outcome)
    )
  };
}

interface PreparedCheckpointSideFixture {
  role: "champion" | "challenger";
  ledger_inputs: LedgerInput[];
  ledger_outcomes: LedgerWriteOutcome[];
  observation: PaperTradingObservationRecord;
  evaluation: PaperTradingEvaluationRecord;
  consumed_event_count: number;
  provider_request_count_after: number;
  preparation_digest: string;
}

interface PairedCheckpointTransactionFixture {
  attempt: PaperTradingComparisonCheckpointAttemptRecord;
  outcome: PaperTradingComparisonCheckpointOutcomeRecord;
  champion: PreparedCheckpointSideFixture;
  challenger: PreparedCheckpointSideFixture;
}

async function validPairedCheckpointTransactionInput(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedBothRunningRuntimeActivationFixture>>,
  attempt: PaperTradingComparisonCheckpointAttemptRecord,
  options: { championLedger?: boolean } = {}
): Promise<PairedCheckpointTransactionFixture> {
  const prepare = async (
    role: "champion" | "challenger"
  ): Promise<PreparedCheckpointSideFixture> => {
    const candidate = role === "champion" ? fixture.champion : fixture.challenger;
    const current = await store.getPaperTradingEvaluation(
      attempt[role].paper_trading_evaluation_ref.id
    );
    if (!current) throw new Error(`missing ${role} checkpoint evaluation`);
    const withLedger = role === "champion" && options.championLedger === true;
    const ledgerInputs: LedgerInput[] = withLedger ? [{
      idempotency_key: `${attempt.paper_trading_comparison_checkpoint_attempt_id}:${role}:event-1`,
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      runtime_id: attempt[role].trading_run_ref.id,
      intent: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: String(fixture.tick.market_snapshot.price)
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        policy_ref: {
          record_kind: "runtime_operating_policy",
          id: "runtime-operating-policy-paper-v1"
        }
      },
      execution_result: {
        execution_mode: "host_local",
        completed_at: fixture.tick.observed_at
      },
      created_at: fixture.tick.observed_at
    }] : [];
    const ledgerOutcomes: LedgerWriteOutcome[] = [];
    for (const input of ledgerInputs) {
      ledgerOutcomes.push(await store.previewLedger(input));
    }
    const eventIds = withLedger ? [`${role}-checkpoint-event-1`] : [];
    const latestLedger = ledgerOutcomes.at(-1);
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id:
        `${attempt[role].paper_trading_evaluation_ref.id}-observation-0001`,
      paper_trading_evaluation_ref: {
        ...attempt[role].paper_trading_evaluation_ref
      },
      paper_trading_evaluation_commitment_ref: {
        ...fixture.attempt[role].paper_trading_evaluation_commitment_ref
      },
      paper_trading_comparison_tick_ref: { ...attempt.tick_ref },
      paper_trading_comparison_tick_digest: attempt.tick_digest,
      paper_trading_comparison_checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: attempt.paper_trading_comparison_checkpoint_attempt_id
      },
      paper_trading_comparison_checkpoint_attempt_digest: attempt.attempt_digest,
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: candidate.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: candidate.candidate_version.candidate_version_id
      },
      trading_run_ref: { ...attempt[role].trading_run_ref },
      sequence: 1,
      status: withLedger ? "recorded" : "no_order",
      observed_at: fixture.tick.observed_at,
      market_snapshot: structuredClone(fixture.tick.market_snapshot),
      public_execution_snapshot: structuredClone(
        fixture.tick.public_execution_snapshot
      ),
      ...(withLedger ? {
        decision: {
          decision_kind: "order_request" as const,
          source_kind: "trading_system_decision" as const,
          reason: "checkpoint_fixture_order",
          observed_at: fixture.tick.observed_at,
          order_request: {
            intent_kind: "place_order" as const,
            symbol: "BTCUSDT" as const,
            side: "buy" as const,
            order_type: "limit" as const,
            quantity: "0.001",
            limit_price: String(fixture.tick.market_snapshot.price)
          },
          authority_status: "trace_only" as const
        },
        ledger_ref: {
          record_kind: "ledger_chain",
          id: latestLedger!.order_request.order_request_id
        }
      } : {}),
      paper_account_snapshot: structuredClone(current.paper_account_snapshot),
      open_orders: structuredClone(current.open_orders ?? []),
      processed_trading_system_event_ids: eventIds,
      processed_public_trade_ids: structuredClone(
        current.processed_public_trade_ids ?? []
      ),
      score_delta: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
      cumulative_score: structuredClone(current.latest_score),
      authority_status: "not_live"
    };
    const evaluation: PaperTradingEvaluationRecord = {
      ...structuredClone(current),
      observation_count: 1,
      last_observed_at: fixture.tick.observed_at,
      next_observation_at: new Date(
        Date.parse(fixture.tick.observed_at) + current.interval_ms
      ).toISOString(),
      latest_public_execution_snapshot: structuredClone(
        fixture.tick.public_execution_snapshot
      ),
      processed_trading_system_event_ids: eventIds
    };
    return withPreparedCheckpointSideDigest({
      role,
      ledger_inputs: ledgerInputs,
      ledger_outcomes: ledgerOutcomes,
      observation,
      evaluation,
      consumed_event_count: eventIds.length,
      provider_request_count_after: attempt[role].provider_request_count_before,
      preparation_digest: ""
    });
  };
  const champion = await prepare("champion");
  const challenger = await prepare("challenger");
  const sideEvidence = (side: PreparedCheckpointSideFixture) => ({
    role: side.role,
    observation_ref: {
      record_kind: "paper_trading_observation",
      id: side.observation.paper_trading_observation_id
    },
    observation_record_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(side.observation)
    ),
    evaluation_record_digest: comparisonRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
    ),
    ledger_chain_refs: side.ledger_outcomes.map((ledger) => ({
      record_kind: "ledger_chain",
      id: ledger.order_request.order_request_id
    })),
    observation_status: side.observation.status,
    consumed_event_count:
      side.observation.processed_trading_system_event_ids?.length ?? 0,
    provider_request_count_after: attempt[side.role].provider_request_count_before
  });
  const outcome = withCheckpointOutcomeDigest({
    ...validPairedCheckpointOutcome(attempt),
    champion: sideEvidence(champion),
    challenger: sideEvidence(challenger)
  });
  return { attempt, outcome, champion, challenger };
}

async function storedPairedCheckpointAttributionFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedBothRunningRuntimeActivationFixture(store, options);
  const checkpointAttempt = validCheckpointAttempt(fixture);
  await store.recordPaperTradingComparisonCheckpointAttempt(checkpointAttempt);
  const checkpoint = await validPairedCheckpointTransactionInput(
    store,
    fixture,
    checkpointAttempt
  );
  await store.recordPaperTradingComparisonPairedCheckpoint(checkpoint);
  return { ...fixture, checkpointAttempt, checkpoint };
}

async function validIneligibleComparisonVerdict(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
  finalOutcome: PaperTradingComparisonActivationOutcomeRecord
): Promise<PaperTradingComparisonVerdictRecord> {
  const loaded = {} as Record<"champion" | "challenger", {
    commitment: PaperTradingEvaluationCommitmentRecord;
    evaluation: PaperTradingEvaluationRecord;
    observations: PaperTradingObservationRecord[];
  }>;
  for (const role of ["champion", "challenger"] as const) {
    const [commitment, evaluation] = await Promise.all([
      store.getPaperTradingEvaluationCommitment(
        fixture.attempt[role].paper_trading_evaluation_commitment_ref.id
      ),
      store.getPaperTradingEvaluation(
        fixture.attempt[role].paper_trading_evaluation_ref.id
      )
    ]);
    if (!commitment || !evaluation) {
      throw new Error(`missing ${role} verdict qualification evidence`);
    }
    loaded[role] = {
      commitment,
      evaluation,
      observations: await store.listPaperTradingObservations(
        evaluation.paper_trading_evaluation_id
      )
    };
  }
  const sideQualification = (role: "champion" | "challenger") =>
    decidePaperTradingQualification({
      commitment: loaded[role].commitment,
      evaluation: loaded[role].evaluation,
      observations: loaded[role].observations,
      runnerActive: false,
      policy: {
        minObservationCount:
          fixture.comparison.comparison_policy.minimum_observation_count,
        minElapsedMs: fixture.comparison.comparison_policy.minimum_elapsed_ms
      },
      commitmentDigestVerified: loaded[role].commitment.commitment_digest ===
        comparisonRecordDigest(
          paperTradingEvaluationCommitmentDigestInput(loaded[role].commitment)
        )
    });
  const pairQualification = {
    comparison_id: fixture.comparison.paper_trading_comparison_commitment_id,
    activation_id: fixture.activation.paper_trading_comparison_activation_id,
    activation_attempt_id:
      fixture.attempt.paper_trading_comparison_activation_attempt_id,
    qualification_status: "not_qualified" as const,
    qualification_reasons: [
      "comparison_window_not_completed_normally" as const,
      "comparison_minimum_observation_count_not_met" as const,
      "comparison_minimum_elapsed_not_met" as const,
      "champion_not_qualified" as const,
      "challenger_not_qualified" as const
    ],
    checkpoint_count: 1,
    champion: sideQualification("champion"),
    challenger: sideQualification("challenger"),
    authority_status: "not_verdict" as const
  };
  const side = (role: "champion" | "challenger") => ({
    role,
    candidate_ref: { ...fixture.comparison[role].candidate_ref },
    candidate_version_ref: { ...fixture.comparison[role].candidate_version_ref },
    system_code_ref: { ...fixture.comparison[role].system_code_ref },
    system_code_artifact_digest:
      fixture.comparison[role].system_code_artifact_digest,
    trading_run_ref: { ...fixture.comparison[role].trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...fixture.comparison[role].paper_trading_evaluation_commitment_ref
    },
    paper_trading_evaluation_commitment_record_digest:
      fixture.comparison[role].paper_trading_evaluation_commitment_record_digest,
    paper_trading_evaluation_ref: {
      ...fixture.comparison[role].paper_trading_evaluation_ref
    },
    paper_trading_evaluation_record_digest: comparisonRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(loaded[role].evaluation)
    ),
    paper_trading_observation_chain_digest: comparisonRecordDigest(
      paperTradingComparisonObservationChainDigestInput(loaded[role].observations)
    )
  });
  return withComparisonVerdictDigest({
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id:
      `${fixture.comparison.paper_trading_comparison_commitment_id}-verdict`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: fixture.comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: fixture.comparison.commitment_digest,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: fixture.activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: fixture.activation.activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: finalOutcome.paper_trading_comparison_activation_outcome_id
    },
    final_activation_outcome_digest: finalOutcome.outcome_digest,
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.tick.paper_trading_comparison_tick_id
    },
    latest_tick_digest: fixture.tick.tick_digest,
    checkpoint_outcome_refs: [{
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: fixture.checkpoint.outcome.paper_trading_comparison_checkpoint_outcome_id
    }],
    checkpoint_outcome_digests: [fixture.checkpoint.outcome.outcome_digest],
    pair_qualification: pairQualification,
    pair_qualification_digest: comparisonRecordDigest(
      paperTradingComparisonQualificationResultDigestInput(pairQualification)
    ),
    champion: side("champion"),
    challenger: side("challenger"),
    verdict_outcome: "comparison_ineligible",
    window_started_at: fixture.tick.observed_at,
    window_ended_at: fixture.tick.observed_at,
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: "not_applicable",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: "repair_evidence_or_rerun_comparison",
    evaluated_at: finalOutcome.completed_at,
    verdict_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

async function storedQualifiedComparisonVerdictFixture(
  store: LocalStore,
  minimumLiftUsdt = 0.5,
  challengerFullCycleDirection?: ResearchDirectionKind
) {
  const comparisonPolicy: Partial<PaperTradingComparisonPolicy> = {
    minimum_observation_count: 2,
    minimum_elapsed_ms: 1,
    maximum_observation_count: 2,
    minimum_net_revenue_lift_usdt: minimumLiftUsdt,
    required_confirmation_count: 2
  };
  const fixture = await storedRepeatedCheckpointIntentFixture(store, {
    comparisonPolicy,
    challengerFullCycleDirection
  });
  const input = await validRepeatedPairedCheckpointTransactionInput(store, fixture);
  const profitableAccount: PaperTradingAccountSnapshot = {
    ...structuredClone(input.challenger.observation.paper_account_snapshot!),
    wallet_balance_usdt: "10001",
    available_balance_usdt: "10001",
    equity_usdt: "10001",
    realized_pnl_usdt: "1"
  };
  const profitableScore = {
    revenue_usdt: 1,
    cost_usdt: 0,
    net_revenue_usdt: 1,
    net_return_pct: 0.01
  };
  const challenger = withPreparedCheckpointSideDigest({
    ...input.challenger,
    observation: {
      ...input.challenger.observation,
      paper_account_snapshot: profitableAccount,
      score_delta: profitableScore,
      cumulative_score: profitableScore
    },
    evaluation: {
      ...input.challenger.evaluation,
      latest_score: profitableScore,
      paper_account_snapshot: profitableAccount
    },
    preparation_digest: ""
  });
  const outcome = withCheckpointOutcomeDigest({
    ...input.outcome,
    challenger: {
      ...input.outcome.challenger!,
      observation_record_digest: comparisonRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(challenger.observation)
      ),
      evaluation_record_digest: comparisonRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(challenger.evaluation)
      )
    },
    outcome_digest: ""
  });
  await store.recordPaperTradingComparisonPairedCheckpoint({
    ...input,
    challenger,
    outcome
  });
  const finalOutcome = await stopBothRunningRuntimeActivation(store, fixture, {
    handoff: true
  });
  const loaded = {} as Record<"champion" | "challenger", {
    commitment: PaperTradingEvaluationCommitmentRecord;
    evaluation: PaperTradingEvaluationRecord;
    observations: PaperTradingObservationRecord[];
  }>;
  for (const role of ["champion", "challenger"] as const) {
    const commitment = await store.getPaperTradingEvaluationCommitment(
      fixture.attempt[role].paper_trading_evaluation_commitment_ref.id
    );
    const evaluation = await store.getPaperTradingEvaluation(
      fixture.attempt[role].paper_trading_evaluation_ref.id
    );
    if (!commitment || !evaluation) {
      throw new Error(`missing ${role} improved verdict evidence`);
    }
    loaded[role] = {
      commitment,
      evaluation,
      observations: await store.listPaperTradingObservations(
        evaluation.paper_trading_evaluation_id
      )
    };
  }
  const sideQualification = (role: "champion" | "challenger") =>
    decidePaperTradingQualification({
      commitment: loaded[role].commitment,
      evaluation: loaded[role].evaluation,
      observations: loaded[role].observations,
      runnerActive: false,
      policy: {
        minObservationCount: fixture.comparison.comparison_policy.minimum_observation_count,
        minElapsedMs: fixture.comparison.comparison_policy.minimum_elapsed_ms
      },
      commitmentDigestVerified: loaded[role].commitment.commitment_digest ===
        comparisonRecordDigest(
          paperTradingEvaluationCommitmentDigestInput(loaded[role].commitment)
        )
    });
  const pairQualification = {
    comparison_id: fixture.comparison.paper_trading_comparison_commitment_id,
    activation_id: fixture.activation.paper_trading_comparison_activation_id,
    activation_attempt_id:
      fixture.attempt.paper_trading_comparison_activation_attempt_id,
    qualification_status: "qualified" as const,
    qualification_reasons: [],
    checkpoint_count: 2,
    champion: sideQualification("champion"),
    challenger: sideQualification("challenger"),
    authority_status: "not_verdict" as const
  };
  const side = (role: "champion" | "challenger") => ({
    role,
    candidate_ref: { ...fixture.comparison[role].candidate_ref },
    candidate_version_ref: { ...fixture.comparison[role].candidate_version_ref },
    system_code_ref: { ...fixture.comparison[role].system_code_ref },
    system_code_artifact_digest:
      fixture.comparison[role].system_code_artifact_digest,
    trading_run_ref: { ...fixture.comparison[role].trading_run_ref },
    paper_trading_evaluation_commitment_ref: {
      ...fixture.comparison[role].paper_trading_evaluation_commitment_ref
    },
    paper_trading_evaluation_commitment_record_digest:
      fixture.comparison[role].paper_trading_evaluation_commitment_record_digest,
    paper_trading_evaluation_ref: {
      ...fixture.comparison[role].paper_trading_evaluation_ref
    },
    paper_trading_evaluation_record_digest: comparisonRecordDigest(
      paperTradingComparisonEvaluationRecordDigestInput(loaded[role].evaluation)
    ),
    paper_trading_observation_chain_digest: comparisonRecordDigest(
      paperTradingComparisonObservationChainDigestInput(loaded[role].observations)
    ),
    net_revenue_usdt: loaded[role].evaluation.latest_score.net_revenue_usdt,
    cost_usdt: loaded[role].evaluation.latest_score.cost_usdt
  });
  const improved = 1 >= minimumLiftUsdt;
  const verdict = withComparisonVerdictDigest({
    record_kind: "paper_trading_comparison_verdict",
    version: 1,
    paper_trading_comparison_verdict_id:
      `${fixture.comparison.paper_trading_comparison_commitment_id}-verdict`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: fixture.comparison.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: fixture.comparison.commitment_digest,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: fixture.activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: fixture.activation.activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    final_activation_outcome_ref: {
      record_kind: "paper_trading_comparison_activation_outcome",
      id: finalOutcome.paper_trading_comparison_activation_outcome_id
    },
    final_activation_outcome_digest: finalOutcome.outcome_digest,
    latest_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.nextTick.paper_trading_comparison_tick_id
    },
    latest_tick_digest: fixture.nextTick.tick_digest,
    checkpoint_outcome_refs: [fixture.checkpoint.outcome, outcome].map((record) => ({
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: record.paper_trading_comparison_checkpoint_outcome_id
    })),
    checkpoint_outcome_digests: [
      fixture.checkpoint.outcome.outcome_digest,
      outcome.outcome_digest
    ],
    pair_qualification: pairQualification,
    pair_qualification_digest: comparisonRecordDigest(
      paperTradingComparisonQualificationResultDigestInput(pairQualification)
    ),
    champion: side("champion"),
    challenger: side("challenger"),
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: 1,
      observed_lift_usdt: 1,
      minimum_lift_usdt: minimumLiftUsdt
    },
    verdict_outcome: improved ? "challenger_improved" : "challenger_not_improved",
    window_started_at: fixture.tick.observed_at,
    window_ended_at: fixture.nextTick.observed_at,
    evaluator_policy_version: "paper-comparison-verdict-v1",
    evaluation_authority: "external_to_trading_systems",
    confirmation_disposition: improved
      ? "requires_precommitted_campaign"
      : "not_applicable",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    next_action: improved
      ? "precommit_confirmation_campaign"
      : "return_to_candidate_arena",
    evaluated_at: finalOutcome.completed_at,
    verdict_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
  await store.recordPaperTradingComparisonVerdict(verdict);
  return { ...fixture, finalOutcome, verdict, pairQualification };
}

function validPaperTradingComparisonConfirmationCampaign(
  fixture: Awaited<ReturnType<typeof storedQualifiedComparisonVerdictFixture>>,
  campaignId = "paper-confirmation-campaign-store-001"
): PaperTradingComparisonConfirmationCampaignRecord {
  const slots = Array.from({ length: 2 }, (_, index) => {
    const slotIndex = index + 1;
    const comparisonIdempotencyKey =
      `paper-comparison-confirmation:${campaignId}:slot:${slotIndex}`;
    const suffix = createHash("sha256")
      .update(comparisonIdempotencyKey)
      .digest("hex")
      .slice(0, 16);
    return {
      slot_index: slotIndex,
      comparison_idempotency_key: comparisonIdempotencyKey,
      paper_trading_comparison_preparation_id:
        `paper-trading-comparison-preparation-${suffix}`,
      paper_trading_comparison_commitment_id: `paper-trading-comparison-${suffix}`
    };
  });
  return withConfirmationCampaignDigest({
    record_kind: "paper_trading_comparison_confirmation_campaign",
    version: 1,
    paper_trading_comparison_confirmation_campaign_id: campaignId,
    source_verdict_ref: {
      record_kind: "paper_trading_comparison_verdict",
      id: fixture.verdict.paper_trading_comparison_verdict_id
    },
    source_verdict_digest: fixture.verdict.verdict_digest,
    source_comparison_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: fixture.comparison.paper_trading_comparison_commitment_id
    },
    source_comparison_digest: fixture.comparison.commitment_digest,
    champion: structuredClone(fixture.preparation.champion),
    challenger: structuredClone(fixture.preparation.challenger),
    champion_selection: structuredClone(fixture.comparison.champion_selection),
    comparison_policy: structuredClone(fixture.comparison.comparison_policy),
    market_data_configuration_digest:
      fixture.comparison.market_data_configuration_digest,
    paper_policy_identity: structuredClone(fixture.comparison.paper_policy_identity),
    campaign_policy: {
      policy_version: "paper-comparison-confirmation-v1",
      required_window_count: 2,
      decision_rule: "all_reserved_windows_must_improve",
      slot_order_policy: "strict_sequence",
      non_overlap_policy: "strict",
      maximum_slot_start_delay_ms:
        fixture.comparison.comparison_policy.maximum_elapsed_ms,
      missed_slot_policy: "campaign_not_confirmed"
    },
    slots,
    committed_at: new Date(Date.parse(fixture.verdict.evaluated_at) + 1_000).toISOString(),
    campaign_digest: "",
    evaluation_authority: "external_to_trading_systems",
    promotion_eligibility: "not_eligible",
    release_status: "sealed",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withConfirmationCampaignDigest(
  campaign: PaperTradingComparisonConfirmationCampaignRecord
): PaperTradingComparisonConfirmationCampaignRecord {
  return {
    ...campaign,
    campaign_digest: comparisonRecordDigest(
      paperTradingComparisonConfirmationCampaignDigestInput(campaign)
    )
  };
}

function confirmationSlotPreparation(
  fixture: Awaited<ReturnType<typeof storedQualifiedComparisonVerdictFixture>>,
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number
): PaperTradingComparisonPreparationRecord {
  const slot = campaign.slots[slotIndex - 1];
  if (!slot) throw new Error(`missing confirmation slot ${slotIndex}`);
  return withPreparationDigest({
    ...structuredClone(fixture.preparation),
    paper_trading_comparison_preparation_id:
      slot.paper_trading_comparison_preparation_id,
    paper_trading_comparison_commitment_id:
      slot.paper_trading_comparison_commitment_id,
    champion: structuredClone(campaign.champion),
    challenger: structuredClone(campaign.challenger),
    champion_selection: structuredClone(campaign.champion_selection),
    comparison_policy: structuredClone(campaign.comparison_policy),
    market_data_configuration_digest: campaign.market_data_configuration_digest,
    paper_policy_identity: structuredClone(campaign.paper_policy_identity),
    committed_at: new Date(Date.parse(campaign.committed_at) + slotIndex * 10_000)
      .toISOString(),
    preparation_digest: ""
  });
}

async function storedConfirmationSlotComparison(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedQualifiedComparisonVerdictFixture>>,
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number
) {
  const preparation = confirmationSlotPreparation(fixture, campaign, slotIndex);
  await store.reservePaperTradingComparisonPreparation(preparation);
  const createSide = async (role: "champion" | "challenger") => {
    const candidate = role === "champion" ? fixture.champion : fixture.challenger;
    const run = await store.createPaperTradingRun({
      idempotency_key:
        `${campaign.slots[slotIndex - 1]!.comparison_idempotency_key}:${role}`,
      candidate_id: candidate.candidate_id,
      candidate_version_id: candidate.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: preparation.committed_at
    });
    const systemCode = await store.getSystemCode(run.system_code_ref!.id);
    if (!systemCode) throw new Error(`missing ${role} confirmation SystemCode`);
    const commitment = qualificationCommitment(
      candidate,
      run,
      systemCode,
      `${preparation.paper_trading_comparison_commitment_id}-${role}-commitment`,
      preparation.committed_at
    );
    const evaluation: PaperTradingEvaluationRecord = {
      ...validPaperTradingEvaluation(commitment),
      paper_trading_evaluation_id:
        `${preparation.paper_trading_comparison_commitment_id}-${role}-evaluation`,
      candidate_ref: { ...commitment.candidate_ref },
      candidate_version_ref: { ...commitment.candidate_version_ref },
      trading_run_ref: { ...commitment.trading_run_ref },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      },
      status: "not_started",
      observation_count: 0,
      latest_score: zeroPaperTradingProfitLoss(),
      paper_account_snapshot: structuredClone(commitment.initial_account_snapshot),
      open_orders: [],
      processed_trading_system_event_ids: [],
      processed_public_trade_ids: []
    };
    await store.recordPaperTradingEvaluationCommitment(commitment);
    await store.recordPaperTradingEvaluation(evaluation);
    return { run, commitment, evaluation };
  };
  const champion = await createSide("champion");
  const challenger = await createSide("challenger");
  const comparison = withComparisonDigest({
    ...validPaperTradingComparisonCommitment(),
    paper_trading_comparison_commitment_id:
      preparation.paper_trading_comparison_commitment_id,
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: preparation.paper_trading_comparison_preparation_id
    },
    champion: comparisonSide(
      preparation.champion,
      champion.commitment,
      champion.evaluation
    ),
    challenger: comparisonSide(
      preparation.challenger,
      challenger.commitment,
      challenger.evaluation
    ),
    champion_selection: structuredClone(campaign.champion_selection),
    comparison_policy: structuredClone(campaign.comparison_policy),
    market_data_configuration_digest: campaign.market_data_configuration_digest,
    paper_policy_identity: structuredClone(campaign.paper_policy_identity),
    committed_at: preparation.committed_at,
    commitment_digest: ""
  });
  await store.recordPaperTradingComparisonCommitment(comparison);
  return { preparation, comparison, champion, challenger };
}

function confirmationSlotFirstTick(
  comparison: PaperTradingComparisonCommitmentRecord,
  observedAt: string,
  slotIndex: number
): PaperTradingComparisonTickRecord {
  const tick = validPaperTradingComparisonTick(comparison);
  return withTickDigest({
    ...tick,
    paper_trading_comparison_tick_id:
      `${comparison.paper_trading_comparison_commitment_id}-first-tick-${slotIndex}`,
    market_snapshot: {
      ...tick.market_snapshot,
      observed_at: new Date(Date.parse(observedAt) - 2).toISOString()
    },
    public_execution_snapshot: {
      ...tick.public_execution_snapshot,
      observed_at: new Date(Date.parse(observedAt) - 1).toISOString(),
      stream_marker:
        `${comparison.paper_trading_comparison_commitment_id}-public-execution`
    },
    observed_at: observedAt,
    tick_digest: ""
  });
}

async function seedConfirmationSlotVerdict(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedQualifiedComparisonVerdictFixture>>,
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  slotIndex: number,
  status:
    | "challenger_improved"
    | "challenger_not_improved"
    | "comparison_ineligible"
): Promise<PaperTradingComparisonVerdictRecord> {
  const slot = campaign.slots[slotIndex - 1];
  if (!slot) throw new Error(`missing confirmation verdict slot ${slotIndex}`);
  const comparison = await store.getPaperTradingComparisonCommitment(
    slot.paper_trading_comparison_commitment_id
  );
  if (!comparison) throw new Error(`missing confirmation slot ${slotIndex} comparison`);
  const ineligible = status === "comparison_ineligible";
  const pairQualification = {
    ...structuredClone(fixture.verdict.pair_qualification),
    comparison_id: slot.paper_trading_comparison_commitment_id,
    ...(ineligible
      ? {
          qualification_status: "not_qualified" as const,
          qualification_reasons: [
            "comparison_window_not_completed_normally" as const
          ]
        }
      : {})
  };
  const improved = status === "challenger_improved";
  const champion = {
    ...structuredClone(fixture.verdict.champion),
    net_revenue_usdt: 0,
    cost_usdt: 0
  };
  const challenger = {
    ...structuredClone(fixture.verdict.challenger),
    net_revenue_usdt: improved ? 1 : 0,
    cost_usdt: 0
  };
  const baseTime = Date.parse(campaign.committed_at) + slotIndex * 10_000;
  const scoredVerdict = {
    ...structuredClone(fixture.verdict),
    paper_trading_comparison_verdict_id:
      `${slot.paper_trading_comparison_commitment_id}-verdict`,
    paper_trading_comparison_commitment_ref: {
      record_kind: "paper_trading_comparison_commitment",
      id: slot.paper_trading_comparison_commitment_id
    },
    paper_trading_comparison_commitment_digest: comparison.commitment_digest,
    pair_qualification: pairQualification,
    pair_qualification_digest: comparisonRecordDigest(
      paperTradingComparisonQualificationResultDigestInput(pairQualification)
    ),
    champion,
    challenger,
    metric: {
      metric_kind: "net_revenue_usdt",
      champion_value_usdt: 0,
      challenger_value_usdt: improved ? 1 : 0,
      observed_lift_usdt: improved ? 1 : 0,
      minimum_lift_usdt: campaign.comparison_policy.minimum_net_revenue_lift_usdt
    },
    verdict_outcome: status,
    window_started_at: new Date(baseTime + 1_000).toISOString(),
    window_ended_at: new Date(baseTime + 2_000).toISOString(),
    evaluated_at: new Date(baseTime + 3_000).toISOString(),
    confirmation_disposition: improved
      ? "requires_precommitted_campaign"
      : "not_applicable",
    next_action: improved
      ? "precommit_confirmation_campaign"
      : "return_to_candidate_arena",
    verdict_digest: ""
  };
  const verdict = ineligible
    ? withComparisonVerdictDigest((() => {
        const {
          net_revenue_usdt: _championNet,
          cost_usdt: _championCost,
          ...ineligibleChampion
        } = scoredVerdict.champion;
        const {
          net_revenue_usdt: _challengerNet,
          cost_usdt: _challengerCost,
          ...ineligibleChallenger
        } = scoredVerdict.challenger;
        const { metric: _metric, ...withoutMetric } = scoredVerdict;
        return {
          ...withoutMetric,
          champion: ineligibleChampion,
          challenger: ineligibleChallenger,
          verdict_outcome: "comparison_ineligible" as const,
          confirmation_disposition: "not_applicable" as const,
          next_action: "repair_evidence_or_rerun_comparison" as const,
          verdict_digest: ""
        } as PaperTradingComparisonVerdictRecord;
      })())
    : withComparisonVerdictDigest(scoredVerdict as PaperTradingComparisonVerdictRecord);
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-verdicts",
    verdict.paper_trading_comparison_verdict_id,
    verdict
  );
  return verdict;
}

function validConfirmationCampaignOutcome(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  verdicts: PaperTradingComparisonVerdictRecord[]
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const slotResults: PaperTradingComparisonConfirmationSlotResult[] = verdicts.map(
    (verdict, index) => ({
      slot_index: index + 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: campaign.slots[index]!.paper_trading_comparison_commitment_id
      },
      status: verdict.verdict_outcome === "challenger_improved"
        ? "challenger_improved"
        : verdict.verdict_outcome === "challenger_not_improved"
          ? "challenger_not_improved"
          : "comparison_ineligible",
      verdict_ref: {
        record_kind: "paper_trading_comparison_verdict",
        id: verdict.paper_trading_comparison_verdict_id
      },
      verdict_digest: verdict.verdict_digest,
      window_started_at: verdict.window_started_at,
      window_ended_at: verdict.window_ended_at
    })
  );
  const improvedCount = slotResults.filter((result) =>
    result.status === "challenger_improved").length;
  const confirmed = improvedCount === campaign.slots.length;
  const outcome = {
    record_kind: "paper_trading_comparison_confirmation_campaign_outcome" as const,
    version: 1 as const,
    paper_trading_comparison_confirmation_campaign_outcome_id:
      `${campaign.paper_trading_comparison_confirmation_campaign_id}-outcome`,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    slot_results: slotResults,
    improved_count: improvedCount,
    not_improved_count: slotResults.filter((result) =>
      result.status === "challenger_not_improved").length,
    ineligible_count: slotResults.filter((result) =>
      result.status === "comparison_ineligible").length,
    expired_count: 0,
    campaign_outcome: confirmed ? "confirmed_improvement" as const : "not_confirmed" as const,
    decision_rule: "all_reserved_windows_must_improve" as const,
    promotion_eligibility: confirmed ? "eligible" as const : "not_eligible" as const,
    release_status: "sealed" as const,
    next_action: confirmed
      ? "review_for_trading_promotion" as const
      : "return_to_candidate_arena" as const,
    evaluated_at: new Date(
      Math.max(...verdicts.map((verdict) => Date.parse(verdict.evaluated_at))) + 1_000
    ).toISOString(),
    outcome_digest: "",
    evaluation_authority: "external_to_trading_systems" as const,
    live_exchange_authority: false as const,
    order_submission_authority: false as const,
    authority_status: "not_live" as const
  };
  return {
    ...outcome,
    outcome_digest: comparisonRecordDigest(
      paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)
    )
  };
}

async function storedPaperTradingComparisonResearchReleaseFixture(
  store: LocalStore,
  releaseKind: PaperTradingComparisonResearchReleaseRecord["release_kind"] =
    "confirmed_improvement"
) {
  const fixture = await storedQualifiedComparisonVerdictFixture(
    store,
    0.5,
    "mean_reversion"
  );
  const sourceFinding = (await store.listResearchFindings()).find((finding) =>
    finding.research_finding_id === fixture.challengerAdmission.research_finding_ref.id
  );
  if (!sourceFinding) throw new Error("missing challenger admission Finding");
  const sourceLineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: "artifact-lineage-comparison-release-origin",
    child_system_code_ref: { ...fixture.challengerAdmission.system_code_ref },
    parent_system_code_ref: { ...fixture.challengerAdmission.source_system_code_ref },
    source_finding_refs: [{ ...fixture.challengerAdmission.research_finding_ref }],
    created_by_research_worker_ref: { ...sourceFinding.research_worker_ref },
    created_at: sourceFinding.created_at,
    authority_status: "lineage_only"
  };
  await store.recordArtifactLineage(sourceLineage);

  const campaign = validPaperTradingComparisonConfirmationCampaign(fixture);
  await store.recordPaperTradingComparisonConfirmationCampaign(campaign);
  await storedConfirmationSlotComparison(store, fixture, campaign, 1);
  const first = await seedConfirmationSlotVerdict(
    store,
    fixture,
    campaign,
    1,
    "challenger_improved"
  );
  let outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord;
  if (releaseKind === "campaign_slot_expired") {
    outcome = validExpiredConfirmationCampaignOutcome(campaign, [first]);
  } else {
    await storedConfirmationSlotComparison(store, fixture, campaign, 2);
    const second = await seedConfirmationSlotVerdict(
      store,
      fixture,
      campaign,
      2,
      releaseKind === "confirmed_improvement"
        ? "challenger_improved"
        : releaseKind === "challenger_not_reproduced"
          ? "challenger_not_improved"
          : "comparison_ineligible"
    );
    outcome = validConfirmationCampaignOutcome(campaign, [first, second]);
  }
  await store.recordPaperTradingComparisonConfirmationCampaignOutcome(outcome);
  const release = validPaperTradingComparisonResearchRelease(
    campaign,
    outcome,
    sourceFinding,
    sourceLineage
  );
  return {
    ...fixture,
    campaign,
    outcome,
    sourceFinding,
    sourceLineage,
    release
  };
}

async function storedComparisonBackedTradingPromotionFixture(store: LocalStore) {
  const fixture = await storedPaperTradingComparisonResearchReleaseFixture(
    store,
    "confirmed_improvement"
  );
  const finalResult = fixture.outcome.slot_results.at(-1);
  if (!finalResult?.verdict_ref || !finalResult.verdict_digest) {
    throw new Error("missing final confirmation verdict result");
  }
  const finalVerdict = await store.getPaperTradingComparisonVerdict(
    finalResult.verdict_ref.id
  );
  if (!finalVerdict) throw new Error("missing final confirmation verdict");
  const outcomeId =
    fixture.outcome.paper_trading_comparison_confirmation_campaign_outcome_id;
  const promotion: TradingPromotionRecord = {
    record_kind: "trading_promotion",
    version: 1,
    trading_promotion_id: "trading-promotion-" + outcomeId,
    status: "promoted_for_trading_review",
    candidate_ref: { ...fixture.campaign.challenger.candidate_ref },
    candidate_version_ref: {
      ...fixture.campaign.challenger.candidate_version_ref
    },
    paper_trading_evaluation_ref: {
      ...finalVerdict.challenger.paper_trading_evaluation_ref
    },
    comparison_confirmation: {
      basis_kind: "paper_trading_comparison_confirmation",
      campaign_ref: {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: fixture.campaign.paper_trading_comparison_confirmation_campaign_id
      },
      campaign_digest: fixture.campaign.campaign_digest,
      campaign_outcome_ref: {
        record_kind:
          "paper_trading_comparison_confirmation_campaign_outcome",
        id: outcomeId
      },
      campaign_outcome_digest: fixture.outcome.outcome_digest,
      final_verdict_ref: { ...finalResult.verdict_ref },
      final_verdict_digest: finalResult.verdict_digest
    },
    promoted_at: new Date(Date.parse(fixture.outcome.evaluated_at) + 1)
      .toISOString(),
    authority_status: "not_live"
  };
  return { ...fixture, finalVerdict, promotion };
}

function validPaperTradingComparisonResearchRelease(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord,
  sourceFinding: ResearchFindingRecord,
  sourceLineage: ArtifactLineageRecord
): PaperTradingComparisonResearchReleaseRecord {
  const decision = paperTradingComparisonResearchReleaseFixtureDecision(outcome);
  const releaseId =
    `${outcome.paper_trading_comparison_confirmation_campaign_outcome_id}-research-release`;
  const releasedAt = new Date(Date.parse(outcome.evaluated_at) + 1).toISOString();
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: `${releaseId}-finding`,
    research_worker_ref: { ...sourceFinding.research_worker_ref },
    research_direction_ref: { ...sourceFinding.research_direction_ref },
    experiment_run_ref: { ...sourceFinding.experiment_run_ref },
    trading_evaluation_result_ref: {
      ...sourceFinding.trading_evaluation_result_ref
    },
    finding_kind: decision.findingKind,
    summary: decision.summary,
    supporting_record_refs: [
      { record_kind: "research_finding", id: sourceFinding.research_finding_id },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign",
        id: campaign.paper_trading_comparison_confirmation_campaign_id
      },
      {
        record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
        id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
      },
      ...outcome.slot_results.flatMap((result) => result.verdict_ref
        ? [{ ...result.verdict_ref }]
        : [])
    ],
    created_at: releasedAt,
    authority_status: "research_trace_only"
  };
  const lineage: ArtifactLineageRecord = {
    record_kind: "artifact_lineage",
    version: 1,
    artifact_lineage_id: `${releaseId}-lineage`,
    child_system_code_ref: { ...sourceLineage.child_system_code_ref },
    ...(sourceLineage.parent_system_code_ref
      ? { parent_system_code_ref: { ...sourceLineage.parent_system_code_ref } }
      : {}),
    source_finding_refs: [
      ...sourceLineage.source_finding_refs.map((ref) => ({ ...ref })),
      { record_kind: "research_finding", id: finding.research_finding_id }
    ],
    created_by_research_worker_ref: { ...sourceFinding.research_worker_ref },
    created_at: releasedAt,
    authority_status: "lineage_only"
  };
  return withPaperTradingComparisonResearchReleaseDigests({
    record_kind: "paper_trading_comparison_research_release",
    version: 1,
    paper_trading_comparison_research_release_id: releaseId,
    campaign_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign",
      id: campaign.paper_trading_comparison_confirmation_campaign_id
    },
    campaign_digest: campaign.campaign_digest,
    campaign_outcome_ref: {
      record_kind: "paper_trading_comparison_confirmation_campaign_outcome",
      id: outcome.paper_trading_comparison_confirmation_campaign_outcome_id
    },
    campaign_outcome_digest: outcome.outcome_digest,
    candidate_ref: { ...campaign.challenger.candidate_ref },
    candidate_version_ref: { ...campaign.challenger.candidate_version_ref },
    system_code_ref: { ...campaign.challenger.system_code_ref },
    system_code_artifact_digest: campaign.challenger.system_code_artifact_digest,
    source_finding_ref: {
      record_kind: "research_finding",
      id: sourceFinding.research_finding_id
    },
    source_finding_record_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(sourceFinding)
    ),
    source_lineage_ref: {
      record_kind: "artifact_lineage",
      id: sourceLineage.artifact_lineage_id
    },
    source_lineage_record_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(sourceLineage)
    ),
    direction_kind: "mean_reversion",
    release_kind: decision.releaseKind,
    finding,
    finding_record_digest: "sha256:pending",
    lineage,
    lineage_record_digest: "sha256:pending",
    next_research_focus: decision.nextResearchFocus,
    released_at: releasedAt,
    release_digest: "sha256:pending",
    research_visibility: "released_to_research",
    evaluation_authority: "external_to_trading_systems",
    promotion_authority: false,
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "lineage_only"
  });
}

function paperTradingComparisonResearchReleaseFixtureDecision(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
) {
  const releaseKind = outcome.campaign_outcome === "confirmed_improvement"
    ? "confirmed_improvement" as const
    : outcome.not_improved_count > 0
      ? "challenger_not_reproduced" as const
      : outcome.ineligible_count > 0
        ? "comparison_evidence_ineligible" as const
        : "campaign_slot_expired" as const;
  const findingKind = releaseKind === "confirmed_improvement"
    ? "positive_result" as const
    : releaseKind === "challenger_not_reproduced"
      ? "negative_result" as const
      : "failure_analysis" as const;
  const nextResearchFocus = releaseKind === "confirmed_improvement"
    ? "Preserve the confirmed artifact lineage and generate controlled variants under new prospective evidence."
    : releaseKind === "challenger_not_reproduced"
      ? "Explain non-reproduction, preserve the negative result, and generate differentiated candidates under new prospective evidence."
      : releaseKind === "comparison_evidence_ineligible"
        ? "Repair comparison evidence and protocol quality before making an economic interpretation."
        : "Repair campaign scheduling and recovery before making an economic interpretation.";
  return {
    releaseKind,
    findingKind,
    summary: `Paper comparison confirmation campaign ${outcome.campaign_ref.id}: ` +
      `improved=${outcome.improved_count}, ` +
      `not_improved=${outcome.not_improved_count}, ` +
      `ineligible=${outcome.ineligible_count}, ` +
      `expired=${outcome.expired_count}; release=${releaseKind}.`,
    nextResearchFocus
  };
}

function withPaperTradingComparisonResearchReleaseDigests(
  release: PaperTradingComparisonResearchReleaseRecord
): PaperTradingComparisonResearchReleaseRecord {
  const withEmbeddedDigests = {
    ...release,
    finding_record_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(release.finding)
    ),
    lineage_record_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(release.lineage)
    ),
    release_digest: "sha256:pending"
  };
  return {
    ...withEmbeddedDigests,
    release_digest: comparisonRecordDigest(
      paperTradingComparisonResearchReleaseDigestInput(withEmbeddedDigests)
    )
  };
}

function validExpiredConfirmationCampaignOutcome(
  campaign: PaperTradingComparisonConfirmationCampaignRecord,
  completedVerdicts: PaperTradingComparisonVerdictRecord[]
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  const completed = validConfirmationCampaignOutcome(campaign, completedVerdicts);
  const slotResults: PaperTradingComparisonConfirmationSlotResult[] = [
    ...completed.slot_results,
    ...campaign.slots.slice(completedVerdicts.length).map((slot, index) => ({
      slot_index: completedVerdicts.length + index + 1,
      paper_trading_comparison_commitment_ref: {
        record_kind: "paper_trading_comparison_commitment",
        id: slot.paper_trading_comparison_commitment_id
      },
      status: "slot_expired" as const
    }))
  ];
  const applicableStart = completedVerdicts.at(-1)?.evaluated_at ?? campaign.committed_at;
  const outcome = {
    ...completed,
    slot_results: slotResults,
    improved_count: completedVerdicts.filter((verdict) =>
      verdict.verdict_outcome === "challenger_improved").length,
    not_improved_count: completedVerdicts.filter((verdict) =>
      verdict.verdict_outcome === "challenger_not_improved").length,
    ineligible_count: completedVerdicts.filter((verdict) =>
      verdict.verdict_outcome === "comparison_ineligible").length,
    expired_count: campaign.slots.length - completedVerdicts.length,
    campaign_outcome: "not_confirmed" as const,
    promotion_eligibility: "not_eligible" as const,
    next_action: "return_to_candidate_arena" as const,
    evaluated_at: new Date(
      Date.parse(applicableStart) +
        campaign.campaign_policy.maximum_slot_start_delay_ms + 1
    ).toISOString(),
    outcome_digest: ""
  };
  return {
    ...outcome,
    outcome_digest: comparisonRecordDigest(
      paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)
    )
  };
}

function withConfirmationCampaignOutcomeDigest(
  outcome: PaperTradingComparisonConfirmationCampaignOutcomeRecord
): PaperTradingComparisonConfirmationCampaignOutcomeRecord {
  return {
    ...outcome,
    outcome_digest: comparisonRecordDigest(
      paperTradingComparisonConfirmationCampaignOutcomeDigestInput(outcome)
    )
  };
}

function withComparisonVerdictDigest(
  verdict: PaperTradingComparisonVerdictRecord
): PaperTradingComparisonVerdictRecord {
  return {
    ...verdict,
    verdict_digest: comparisonRecordDigest(
      paperTradingComparisonVerdictDigestInput(verdict)
    )
  };
}

async function storedAcknowledgedPairedCheckpointFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedPairedCheckpointAttributionFixture(store, options);
  const attribution = await seedComparisonTickAttribution(
    store,
    fixture,
    ["champion", "challenger"]
  );
  return { ...fixture, ...attribution };
}

async function storedCapturedNextComparisonTickFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedAcknowledgedPairedCheckpointFixture(store, options);
  const nextTick = validNextPaperTradingComparisonTick(fixture);
  await store.recordPaperTradingComparisonTick(
    nextTick,
    comparisonTickCaptureWriteContext(fixture)
  );
  return { ...fixture, nextTick };
}

async function validNextCheckpointAttempt(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedCapturedNextComparisonTickFixture>>
): Promise<PaperTradingComparisonCheckpointAttemptRecord> {
  const attemptedAt = new Date(
    Math.max(
      Date.parse(fixture.nextTick.observed_at),
      Date.parse(fixture.checkpoint.outcome.completed_at)
    ) + 1_000
  ).toISOString();
  const side = async (role: "champion" | "challenger") => {
    const evaluation = await store.getPaperTradingEvaluation(
      fixture.attempt[role].paper_trading_evaluation_ref.id
    );
    if (!evaluation) throw new Error(`missing ${role} repeated evaluation`);
    const observations = await store.listPaperTradingObservations(
      evaluation.paper_trading_evaluation_id
    );
    const acknowledgement = fixture.acknowledgements.find((record) =>
      record.role === role
    );
    if (!acknowledgement) throw new Error(`missing ${role} previous acknowledgement`);
    return {
      role,
      trading_run_ref: { ...fixture.attempt[role].trading_run_ref },
      paper_trading_evaluation_ref: {
        ...fixture.attempt[role].paper_trading_evaluation_ref
      },
      evaluation_record_digest: comparisonRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(evaluation)
      ),
      observation_chain_digest: comparisonRecordDigest(
        paperTradingComparisonObservationChainDigestInput(observations)
      ),
      provider_request_count_before:
        acknowledgement.provider_request_count_at_acknowledgement
    };
  };
  return withCheckpointAttemptDigest({
    ...structuredClone(fixture.checkpointAttempt),
    paper_trading_comparison_checkpoint_attempt_id:
      `${fixture.attempt.paper_trading_comparison_activation_attempt_id}-checkpoint-2`,
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.nextTick.paper_trading_comparison_tick_id
    },
    tick_digest: fixture.nextTick.tick_digest,
    checkpoint_sequence: 2,
    previous_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: fixture.checkpoint.outcome.paper_trading_comparison_checkpoint_outcome_id
    },
    previous_checkpoint_outcome_digest: fixture.checkpoint.outcome.outcome_digest,
    champion: await side("champion"),
    challenger: await side("challenger"),
    attempted_at: attemptedAt,
    checkpoint_deadline_at: new Date(Date.parse(attemptedAt) + 60_000).toISOString(),
    attempt_digest: ""
  });
}

async function storedRepeatedCheckpointIntentFixture(
  store: LocalStore,
  options: ComparisonFlowFixtureOptions = {}
) {
  const fixture = await storedCapturedNextComparisonTickFixture(store, options);
  const nextCheckpointAttempt = await validNextCheckpointAttempt(store, fixture);
  await store.recordPaperTradingComparisonCheckpointAttempt(nextCheckpointAttempt);
  const attribution = await seedNextComparisonTickAttribution(
    store,
    fixture,
    nextCheckpointAttempt
  );
  return { ...fixture, nextCheckpointAttempt, ...attribution };
}

async function seedNextComparisonTickAttribution(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedCapturedNextComparisonTickFixture>>,
  attempt: PaperTradingComparisonCheckpointAttemptRecord
) {
  const nextDeliveries: PaperTradingComparisonTickDeliveryRecord[] = [];
  const nextAcknowledgements: PaperTradingComparisonTickAcknowledgementRecord[] = [];
  for (const role of ["champion", "challenger"] as const) {
    const delivery = withComparisonTickDeliveryDigest({
      record_kind: "paper_trading_comparison_tick_delivery",
      version: 1,
      paper_trading_comparison_tick_delivery_id:
        `${fixture.attempt.paper_trading_comparison_activation_attempt_id}:${role}:` +
        fixture.nextTick.paper_trading_comparison_tick_id,
      paper_trading_comparison_activation_ref: {
        ...fixture.attempt.paper_trading_comparison_activation_ref
      },
      paper_trading_comparison_activation_digest:
        fixture.attempt.paper_trading_comparison_activation_digest,
      paper_trading_comparison_activation_attempt_ref: {
        record_kind: "paper_trading_comparison_activation_attempt",
        id: fixture.attempt.paper_trading_comparison_activation_attempt_id
      },
      paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
      role,
      trading_run_ref: { ...fixture.attempt[role].trading_run_ref },
      tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: fixture.nextTick.paper_trading_comparison_tick_id
      },
      tick_digest: fixture.nextTick.tick_digest,
      tick_sequence: fixture.nextTick.sequence,
      provider_request_count_at_delivery:
        attempt[role].provider_request_count_before + 1,
      endpoint: "GET /market/snapshot",
      delivered_at: new Date(Date.parse(attempt.attempted_at) + 1_000).toISOString(),
      delivery_digest: "",
      live_exchange_authority: false,
      order_submission_authority: false,
      authority_status: "not_live"
    });
    const acknowledgement = validComparisonTickAcknowledgement(delivery);
    await store.recordPaperTradingComparisonTickDelivery(
      delivery,
      nextComparisonTickIOWriteContext(
        fixture,
        role,
        "deliver_market_snapshot"
      )
    );
    await store.recordPaperTradingComparisonTickAcknowledgement(
      acknowledgement,
      nextComparisonTickIOWriteContext(fixture, role, "acknowledge_tick")
    );
    nextDeliveries.push(delivery);
    nextAcknowledgements.push(acknowledgement);
  }
  return { nextDeliveries, nextAcknowledgements };
}

async function validRepeatedPairedCheckpointTransactionInput(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedRepeatedCheckpointIntentFixture>>
): Promise<PairedCheckpointTransactionFixture> {
  const prepare = async (
    role: "champion" | "challenger"
  ): Promise<PreparedCheckpointSideFixture> => {
    const current = await store.getPaperTradingEvaluation(
      fixture.nextCheckpointAttempt[role].paper_trading_evaluation_ref.id
    );
    const acknowledgement = fixture.nextAcknowledgements.find((record) =>
      record.role === role
    );
    if (!current || !acknowledgement) {
      throw new Error(`missing ${role} repeated checkpoint state`);
    }
    const candidate = role === "champion" ? fixture.champion : fixture.challenger;
    const observation: PaperTradingObservationRecord = {
      record_kind: "paper_trading_observation",
      version: 1,
      paper_trading_observation_id:
        `${current.paper_trading_evaluation_id}-observation-0002`,
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: current.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        ...fixture.attempt[role].paper_trading_evaluation_commitment_ref
      },
      paper_trading_comparison_tick_ref: {
        record_kind: "paper_trading_comparison_tick",
        id: fixture.nextTick.paper_trading_comparison_tick_id
      },
      paper_trading_comparison_tick_digest: fixture.nextTick.tick_digest,
      paper_trading_comparison_tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      },
      paper_trading_comparison_tick_acknowledgement_digest:
        acknowledgement.acknowledgement_digest,
      paper_trading_comparison_checkpoint_attempt_ref: {
        record_kind: "paper_trading_comparison_checkpoint_attempt",
        id: fixture.nextCheckpointAttempt
          .paper_trading_comparison_checkpoint_attempt_id
      },
      paper_trading_comparison_checkpoint_attempt_digest:
        fixture.nextCheckpointAttempt.attempt_digest,
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: candidate.candidate_id
      },
      candidate_version_ref: {
        record_kind: "candidate_version",
        id: candidate.candidate_version.candidate_version_id
      },
      trading_run_ref: { ...fixture.nextCheckpointAttempt[role].trading_run_ref },
      sequence: 2,
      status: "no_order",
      observed_at: fixture.nextTick.observed_at,
      market_snapshot: structuredClone(fixture.nextTick.market_snapshot),
      public_execution_snapshot: structuredClone(
        fixture.nextTick.public_execution_snapshot
      ),
      paper_account_snapshot: structuredClone(current.paper_account_snapshot),
      open_orders: structuredClone(current.open_orders ?? []),
      processed_trading_system_event_ids: structuredClone(
        current.processed_trading_system_event_ids ?? []
      ),
      processed_public_trade_ids: structuredClone(
        current.processed_public_trade_ids ?? []
      ),
      score_delta: structuredClone(PAPER_TRADING_COMPARISON_ZERO_SCORE),
      cumulative_score: structuredClone(current.latest_score),
      authority_status: "not_live"
    };
    const evaluation: PaperTradingEvaluationRecord = {
      ...structuredClone(current),
      observation_count: current.observation_count + 1,
      last_observed_at: fixture.nextTick.observed_at,
      next_observation_at: new Date(
        Date.parse(fixture.nextTick.observed_at) + current.interval_ms
      ).toISOString(),
      latest_public_execution_snapshot: structuredClone(
        fixture.nextTick.public_execution_snapshot
      )
    };
    return withPreparedCheckpointSideDigest({
      role,
      ledger_inputs: [],
      ledger_outcomes: [],
      observation,
      evaluation,
      consumed_event_count: 0,
      provider_request_count_after:
        acknowledgement.provider_request_count_at_acknowledgement,
      preparation_digest: ""
    });
  };
  const champion = await prepare("champion");
  const challenger = await prepare("challenger");
  const sideEvidence = (side: PreparedCheckpointSideFixture) => {
    const acknowledgement = fixture.nextAcknowledgements.find((record) =>
      record.role === side.role
    );
    if (!acknowledgement) throw new Error(`missing ${side.role} acknowledgement`);
    return {
      role: side.role,
      observation_ref: {
        record_kind: "paper_trading_observation",
        id: side.observation.paper_trading_observation_id
      },
      observation_record_digest: comparisonRecordDigest(
        paperTradingComparisonPersistedRecordDigestInput(side.observation)
      ),
      evaluation_record_digest: comparisonRecordDigest(
        paperTradingComparisonEvaluationRecordDigestInput(side.evaluation)
      ),
      ledger_chain_refs: [],
      observation_status: side.observation.status,
      consumed_event_count: 0,
      provider_request_count_after:
        acknowledgement.provider_request_count_at_acknowledgement,
      tick_acknowledgement_ref: {
        record_kind: "paper_trading_comparison_tick_acknowledgement",
        id: acknowledgement.paper_trading_comparison_tick_acknowledgement_id
      },
      tick_acknowledgement_digest: acknowledgement.acknowledgement_digest
    };
  };
  const outcome = withCheckpointOutcomeDigest({
    record_kind: "paper_trading_comparison_checkpoint_outcome",
    version: 1,
    paper_trading_comparison_checkpoint_outcome_id:
      `${fixture.nextCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id}-outcome`,
    checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: fixture.nextCheckpointAttempt.paper_trading_comparison_checkpoint_attempt_id
    },
    checkpoint_attempt_digest: fixture.nextCheckpointAttempt.attempt_digest,
    tick_ref: { ...fixture.nextCheckpointAttempt.tick_ref },
    tick_digest: fixture.nextCheckpointAttempt.tick_digest,
    checkpoint_sequence: 2,
    outcome_status: "paired",
    outcome_reason: "paired_checkpoint_recorded",
    champion: sideEvidence(champion),
    challenger: sideEvidence(challenger),
    next_action: "capture_next_tick",
    completed_at: new Date(
      Date.parse(fixture.nextCheckpointAttempt.attempted_at) + 3_000
    ).toISOString(),
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
  return {
    attempt: fixture.nextCheckpointAttempt,
    outcome,
    champion,
    challenger
  };
}

async function seedComparisonTickAttribution(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
  roles: readonly ("champion" | "challenger")[]
) {
  const deliveries: PaperTradingComparisonTickDeliveryRecord[] = [];
  const acknowledgements: PaperTradingComparisonTickAcknowledgementRecord[] = [];
  for (const role of roles) {
    const delivery = validComparisonTickDelivery(fixture, role);
    const acknowledgement = validComparisonTickAcknowledgement(delivery);
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-tick-deliveries",
      delivery.paper_trading_comparison_tick_delivery_id,
      delivery
    );
    await overwriteComparisonFixtureRecord(
      store,
      "paper-trading-comparison-tick-acknowledgements",
      acknowledgement.paper_trading_comparison_tick_acknowledgement_id,
      acknowledgement
    );
    deliveries.push(delivery);
    acknowledgements.push(acknowledgement);
  }
  return { deliveries, acknowledgements };
}

function validNextPaperTradingComparisonTick(
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>
): PaperTradingComparisonTickRecord {
  const observedAt = new Date(
    Date.parse(fixture.tick.observed_at) + fixture.comparison.comparison_policy.interval_ms
  ).toISOString();
  return withTickDigest({
    ...structuredClone(fixture.tick),
    paper_trading_comparison_tick_id: "paper-comparison-next-tick-store-002",
    sequence: 2,
    previous_tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.tick.paper_trading_comparison_tick_id
    },
    previous_tick_digest: fixture.tick.tick_digest,
    market_snapshot: {
      ...structuredClone(fixture.tick.market_snapshot),
      price: fixture.tick.market_snapshot.price + 100,
      observed_at: new Date(Date.parse(observedAt) - 2).toISOString()
    },
    public_execution_snapshot: {
      ...structuredClone(fixture.tick.public_execution_snapshot),
      observed_at: new Date(Date.parse(observedAt) - 1).toISOString(),
      stream_marker: "paper-comparison-public-execution-002"
    },
    observed_at: observedAt,
    tick_digest: ""
  });
}

function comparisonTickCaptureWriteContext(
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>
): PaperTradingComparisonTickCaptureWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...fixture.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      fixture.attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    previous_checkpoint_attempt_ref: {
      record_kind: "paper_trading_comparison_checkpoint_attempt",
      id: fixture.checkpointAttempt.paper_trading_comparison_checkpoint_attempt_id
    },
    previous_checkpoint_attempt_digest: fixture.checkpointAttempt.attempt_digest,
    previous_checkpoint_outcome_ref: {
      record_kind: "paper_trading_comparison_checkpoint_outcome",
      id: fixture.checkpoint.outcome.paper_trading_comparison_checkpoint_outcome_id
    },
    previous_checkpoint_outcome_digest: fixture.checkpoint.outcome.outcome_digest,
    operation: "capture_next_tick"
  };
}

function validComparisonTickDelivery(
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
  role: "champion" | "challenger"
): PaperTradingComparisonTickDeliveryRecord {
  const checkpointEvidence = fixture.checkpoint.outcome[role];
  if (!checkpointEvidence) throw new Error(`missing ${role} checkpoint evidence`);
  return withComparisonTickDeliveryDigest({
    record_kind: "paper_trading_comparison_tick_delivery",
    version: 1,
    paper_trading_comparison_tick_delivery_id:
      `${fixture.attempt.paper_trading_comparison_activation_attempt_id}:${role}:` +
      fixture.tick.paper_trading_comparison_tick_id,
    paper_trading_comparison_activation_ref: {
      ...fixture.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      fixture.attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    role,
    trading_run_ref: { ...fixture.attempt[role].trading_run_ref },
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.tick.paper_trading_comparison_tick_id
    },
    tick_digest: fixture.tick.tick_digest,
    tick_sequence: fixture.tick.sequence,
    provider_request_count_at_delivery:
      checkpointEvidence.provider_request_count_after + 1,
    endpoint: "GET /market/snapshot",
    delivered_at: new Date(
      Date.parse(fixture.checkpoint.outcome.completed_at) + 1_000
    ).toISOString(),
    delivery_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withComparisonTickDeliveryDigest(
  delivery: PaperTradingComparisonTickDeliveryRecord
): PaperTradingComparisonTickDeliveryRecord {
  return {
    ...delivery,
    delivery_digest: comparisonRecordDigest(
      paperTradingComparisonTickDeliveryDigestInput(delivery)
    )
  };
}

function validComparisonTickAcknowledgement(
  delivery: PaperTradingComparisonTickDeliveryRecord
): PaperTradingComparisonTickAcknowledgementRecord {
  return withComparisonTickAcknowledgementDigest({
    record_kind: "paper_trading_comparison_tick_acknowledgement",
    version: 1,
    paper_trading_comparison_tick_acknowledgement_id:
      `${delivery.paper_trading_comparison_tick_delivery_id}:acknowledgement`,
    delivery_ref: {
      record_kind: delivery.record_kind,
      id: delivery.paper_trading_comparison_tick_delivery_id
    },
    delivery_digest: delivery.delivery_digest,
    paper_trading_comparison_activation_attempt_ref: {
      ...delivery.paper_trading_comparison_activation_attempt_ref
    },
    paper_trading_comparison_activation_attempt_digest:
      delivery.paper_trading_comparison_activation_attempt_digest,
    role: delivery.role,
    trading_run_ref: { ...delivery.trading_run_ref },
    tick_ref: { ...delivery.tick_ref },
    tick_digest: delivery.tick_digest,
    tick_sequence: delivery.tick_sequence,
    provider_request_count_at_acknowledgement:
      delivery.provider_request_count_at_delivery + 1,
    endpoint: "POST /comparison/tick/ack",
    acknowledged_at: new Date(Date.parse(delivery.delivered_at) + 1_000).toISOString(),
    acknowledgement_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withComparisonTickAcknowledgementDigest(
  acknowledgement: PaperTradingComparisonTickAcknowledgementRecord
): PaperTradingComparisonTickAcknowledgementRecord {
  return {
    ...acknowledgement,
    acknowledgement_digest: comparisonRecordDigest(
      paperTradingComparisonTickAcknowledgementDigestInput(acknowledgement)
    )
  };
}

function comparisonTickIOWriteContext(
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
  role: "champion" | "challenger",
  operation: PaperTradingComparisonTickIOWriteContext["operation"]
): PaperTradingComparisonTickIOWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...fixture.attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      fixture.attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: fixture.attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: fixture.attempt.attempt_digest,
    role,
    trading_run_ref: { ...fixture.attempt[role].trading_run_ref },
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.tick.paper_trading_comparison_tick_id
    },
    tick_digest: fixture.tick.tick_digest,
    operation
  };
}

function nextComparisonTickIOWriteContext(
  fixture: Awaited<ReturnType<typeof storedCapturedNextComparisonTickFixture>>,
  role: "champion" | "challenger",
  operation: PaperTradingComparisonTickIOWriteContext["operation"]
): PaperTradingComparisonTickIOWriteContext {
  return {
    ...comparisonTickIOWriteContext(fixture, role, operation),
    tick_ref: {
      record_kind: "paper_trading_comparison_tick",
      id: fixture.nextTick.paper_trading_comparison_tick_id
    },
    tick_digest: fixture.nextTick.tick_digest
  };
}

function withPreparedCheckpointSideDigest(
  side: PreparedCheckpointSideFixture
): PreparedCheckpointSideFixture {
  const { preparation_digest: _digest, ...payload } = side;
  return {
    ...side,
    preparation_digest: comparisonRecordDigest(
      paperTradingComparisonPersistedRecordDigestInput(payload)
    )
  };
}

function comparisonRecordDigest(input: string): string {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

function validRuntimeActivationAttempt(
  activation: PaperTradingComparisonActivationRecord,
  sequence = 1
): PaperTradingComparisonActivationAttemptRecord {
  const attemptedAt = new Date(
    Date.parse(activation.authorized_at) + sequence * 10_000
  ).toISOString();
  const startDeadlineAt = new Date(
    Date.parse(attemptedAt) + activation.activation_policy.maximum_activation_elapsed_ms
  ).toISOString();
  return withRuntimeActivationAttemptDigest({
    record_kind: "paper_trading_comparison_activation_attempt",
    version: 1,
    paper_trading_comparison_activation_attempt_id:
      `paper-comparison-runtime-attempt-${sequence}`,
    paper_trading_comparison_activation_ref: {
      record_kind: "paper_trading_comparison_activation",
      id: activation.paper_trading_comparison_activation_id
    },
    paper_trading_comparison_activation_digest: activation.activation_digest,
    paper_trading_comparison_commitment_ref: {
      ...activation.paper_trading_comparison_commitment_ref
    },
    paper_trading_comparison_commitment_digest:
      activation.paper_trading_comparison_commitment_digest,
    first_tick_ref: { ...activation.first_tick_ref },
    first_tick_digest: activation.first_tick_digest,
    champion: structuredClone(activation.champion),
    challenger: structuredClone(activation.challenger),
    activation_policy: structuredClone(activation.activation_policy),
    attempt_sequence: sequence,
    retry_index: sequence - 1,
    start_mode: "parallel",
    attempt_status: "starting",
    attempted_at: attemptedAt,
    start_deadline_at: startDeadlineAt,
    attempt_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withRuntimeActivationAttemptDigest(
  attempt: PaperTradingComparisonActivationAttemptRecord
): PaperTradingComparisonActivationAttemptRecord {
  return {
    ...attempt,
    attempt_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonActivationAttemptDigestInput(attempt))
      .digest("hex")}`
  };
}

function validRuntimeActivationSideResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  outcome: "succeeded" | "failed" | "timed_out" | "not_running"
): PaperTradingComparisonActivationSideResultRecord {
  const side = attempt[role];
  const operation = outcome === "not_running" ? "stop" : "start";
  const effectStartedAt = new Date(
    Date.parse(attempt.attempted_at) + (operation === "start" ? 1_000 : 5_000)
  ).toISOString();
  const effectCompletedAt = new Date(Date.parse(effectStartedAt) + 1_000).toISOString();
  const failed = outcome === "failed" || outcome === "timed_out";
  return withRuntimeActivationSideResultDigest({
    record_kind: "paper_trading_comparison_activation_side_result",
    version: 1,
    paper_trading_comparison_activation_side_result_id:
      `${attempt.paper_trading_comparison_activation_attempt_id}-${role}-${operation}`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    role,
    operation_sequence: operation === "start" ? 1 : 2,
    operation,
    reason: operation === "start" ? "symmetric_start" : "partial_start_cleanup",
    outcome,
    trading_run_ref: { ...side.trading_run_ref },
    paper_trading_evaluation_ref: { ...side.paper_trading_evaluation_ref },
    ...(outcome === "succeeded"
      ? { sandbox_ref: { record_kind: "sandbox", id: `${role}-runtime-sandbox` } }
      : {}),
    runtime_lifecycle_status: outcome === "succeeded"
      ? "running"
      : outcome === "timed_out"
        ? "unknown"
        : "registered",
    evaluation_status: outcome === "succeeded"
      ? "running"
      : outcome === "timed_out"
        ? "unknown"
        : "not_started",
    provider_request_count: operation === "start" ? 1 : 0,
    effect_started_at: effectStartedAt,
    effect_completed_at: effectCompletedAt,
    ...(failed ? { stable_error_code: `runtime_${outcome}` } : {}),
    side_result_digest: "",
    authority_status: "not_live"
  });
}

function withRuntimeActivationSideResultDigest(
  result: PaperTradingComparisonActivationSideResultRecord
): PaperTradingComparisonActivationSideResultRecord {
  return {
    ...result,
    side_result_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonActivationSideResultDigestInput(result))
      .digest("hex")}`
  };
}

function validRuntimeActivationOutcome(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  latestResults: PaperTradingComparisonActivationSideResultRecord[],
  status: "both_running" | "stopped_cleanly" | "cleanup_required",
  previous?: PaperTradingComparisonActivationOutcomeRecord
): PaperTradingComparisonActivationOutcomeRecord {
  const champion = latestResults.find((result) => result.role === "champion");
  const challenger = latestResults.find((result) => result.role === "challenger");
  const timedOut = latestResults.some((result) => result.outcome === "timed_out");
  const latestCompletedAt = latestResults.reduce(
    (latest, result) => Math.max(latest, Date.parse(result.effect_completed_at)),
    Date.parse(attempt.attempted_at)
  );
  return withRuntimeActivationOutcomeDigest({
    record_kind: "paper_trading_comparison_activation_outcome",
    version: 1,
    paper_trading_comparison_activation_outcome_id:
      `${attempt.paper_trading_comparison_activation_attempt_id}-outcome-${previous ? 2 : 1}`,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    outcome_sequence: previous ? previous.outcome_sequence + 1 : 1,
    ...(previous ? {
      previous_outcome_ref: {
        record_kind: "paper_trading_comparison_activation_outcome",
        id: previous.paper_trading_comparison_activation_outcome_id
      }
    } : {}),
    outcome_status: status,
    outcome_reason: status === "both_running"
      ? "started_within_policy"
      : status === "cleanup_required"
        ? timedOut ? "start_timed_out" : "start_failed"
        : previous ? "restart_cleanup" : "start_failed",
    ...(champion ? {
      champion_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: champion.paper_trading_comparison_activation_side_result_id
      }
    } : {}),
    ...(challenger ? {
      challenger_latest_result_ref: {
        record_kind: "paper_trading_comparison_activation_side_result",
        id: challenger.paper_trading_comparison_activation_side_result_id
      }
    } : {}),
    next_action: status === "both_running"
      ? "capture_first_paired_checkpoint"
      : status === "stopped_cleanly"
        ? "retry_activation"
        : "recover_cleanup",
    completed_at: new Date(
      Math.max(latestCompletedAt, previous ? Date.parse(previous.completed_at) : 0) + 1_000
    ).toISOString(),
    outcome_digest: "",
    live_exchange_authority: false,
    order_submission_authority: false,
    authority_status: "not_live"
  });
}

function withRuntimeActivationOutcomeDigest(
  outcome: PaperTradingComparisonActivationOutcomeRecord
): PaperTradingComparisonActivationOutcomeRecord {
  return {
    ...outcome,
    outcome_digest: `sha256:${createHash("sha256")
      .update(paperTradingComparisonActivationOutcomeDigestInput(outcome))
      .digest("hex")}`
  };
}

async function recordFailedRuntimeActivationStarts(
  store: LocalStore,
  attempt: PaperTradingComparisonActivationAttemptRecord,
  includeTimeout = false
): Promise<PaperTradingComparisonActivationSideResultRecord[]> {
  const results = [
    validRuntimeActivationSideResult(
      attempt,
      "champion",
      includeTimeout ? "timed_out" : "failed"
    ),
    validRuntimeActivationSideResult(attempt, "challenger", "failed")
  ];
  for (const result of results) {
    await store.recordPaperTradingComparisonActivationSideResult(result);
  }
  return results;
}

async function recordNotRunningRuntimeActivationStops(
  store: LocalStore,
  attempt: PaperTradingComparisonActivationAttemptRecord
): Promise<PaperTradingComparisonActivationSideResultRecord[]> {
  const results = [
    validRuntimeActivationSideResult(attempt, "champion", "not_running"),
    validRuntimeActivationSideResult(attempt, "challenger", "not_running")
  ];
  for (const result of results) {
    await store.recordPaperTradingComparisonActivationSideResult(result);
  }
  return results;
}

async function completeStoppedRuntimeActivationAttempt(
  store: LocalStore,
  attempt: PaperTradingComparisonActivationAttemptRecord
): Promise<PaperTradingComparisonActivationOutcomeRecord> {
  await recordFailedRuntimeActivationStarts(store, attempt);
  const stops = await recordNotRunningRuntimeActivationStops(store, attempt);
  const outcome = validRuntimeActivationOutcome(attempt, stops, "stopped_cleanly");
  await store.recordPaperTradingComparisonActivationOutcome(outcome);
  return outcome;
}

function runtimeActivationWriteContext(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  operation: "start" | "stop"
): PaperTradingComparisonRuntimeWriteContext {
  return {
    paper_trading_comparison_activation_ref: {
      ...attempt.paper_trading_comparison_activation_ref
    },
    paper_trading_comparison_activation_digest:
      attempt.paper_trading_comparison_activation_digest,
    paper_trading_comparison_activation_attempt_ref: {
      record_kind: "paper_trading_comparison_activation_attempt",
      id: attempt.paper_trading_comparison_activation_attempt_id
    },
    paper_trading_comparison_activation_attempt_digest: attempt.attempt_digest,
    role,
    operation
  };
}

function runtimeActivationSandboxStart(
  fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger"
): SandboxObservationInput {
  const run = role === "champion" ? fixture.championRun : fixture.challengerRun;
  const startedAt = new Date(Date.parse(attempt.attempted_at) + 1_000).toISOString();
  return {
    instance: {
      record_kind: "sandbox",
      version: 1,
      sandbox_id: `${attempt.paper_trading_comparison_activation_attempt_id}-${role}-sandbox`,
      adapter_kind: "deterministic_test",
      system_code_ref: { ...run.system_code_ref! },
      runtime_ref: { record_kind: "trading_run", id: run.trading_run_id },
      sandbox_placement_ref: { ...run.placement_ref },
      lifecycle_status: "running",
      sandbox_name: `paper-comparison-runtime-${role}`,
      created_at: startedAt,
      started_at: startedAt,
      log_refs: [],
      heartbeat_refs: [],
      command_evidence_refs: [],
      authority_status: "not_live"
    }
  };
}

function runtimeActivationRunControlInput(
  fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  operation: "start" | "stop"
): RunControlAuditInput {
  const candidate = role === "champion" ? fixture.champion : fixture.challenger;
  const run = role === "champion" ? fixture.championRun : fixture.challengerRun;
  const lifecycleStatus = operation === "start" ? "running" : "stopped";
  return {
    idempotency_key: paperTradingComparisonRuntimeControlIdempotencyKey(
      runtimeActivationWriteContext(attempt, role, operation)
    ),
    candidate_id: candidate.candidate_id,
    candidate_version_id: candidate.candidate_version.candidate_version_id,
    runtime_id: run.trading_run_id,
    command: {
      action: operation,
      requested_lifecycle_status: lifecycleStatus,
      actor_kind: "human_operator",
      actor_ref: { record_kind: "operator", id: "runtime-activation-coordinator" },
      runtime_operating_policy_ref: {
        record_kind: "runtime_operating_policy",
        id: "runtime-operating-policy-paper-v1"
      },
      reason: "operator_request",
      reason_summary: `Paper comparison runtime ${operation}.`
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
      actor_ref: { record_kind: "operator", id: "runtime-activation-coordinator" },
      runtime_lifecycle_status: lifecycleStatus,
      message: `Paper comparison runtime ${operation} recorded.`
    },
    created_at: new Date(
      Date.parse(attempt.attempted_at) + (operation === "start" ? 2_000 : 6_000)
    ).toISOString()
  };
}

function runtimeActivationEvaluation(
  fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  status: "running" | "stopped"
): PaperTradingEvaluationRecord {
  const baseline = structuredClone(
    role === "champion" ? fixture.championEvaluation : fixture.challengerEvaluation
  );
  if (status === "running") {
    const transitionedAt = Date.parse(attempt.attempted_at) + 3_000;
    return {
      ...baseline,
      status,
      next_observation_at: new Date(
        transitionedAt + baseline.interval_ms
      ).toISOString()
    };
  }
  return {
    ...baseline,
    status,
    stopped_at: new Date(Date.parse(attempt.attempted_at) + 8_000).toISOString()
  };
}

function runtimeActivationSucceededStartResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  sandboxId: string
): PaperTradingComparisonActivationSideResultRecord {
  return withRuntimeActivationSideResultDigest({
    ...validRuntimeActivationSideResult(attempt, role, "succeeded"),
    sandbox_ref: { record_kind: "sandbox", id: sandboxId },
    effect_completed_at: new Date(Date.parse(attempt.attempted_at) + 4_000).toISOString()
  });
}

function runtimeActivationSucceededStopResult(
  attempt: PaperTradingComparisonActivationAttemptRecord,
  role: "champion" | "challenger",
  sandboxId: string,
  reason: "policy_cleanup" | "handoff_cleanup" = "policy_cleanup",
  effectBase?: number
): PaperTradingComparisonActivationSideResultRecord {
  return withRuntimeActivationSideResultDigest({
    ...validRuntimeActivationSideResult(attempt, role, "not_running"),
    reason,
    outcome: "succeeded",
    sandbox_ref: { record_kind: "sandbox", id: sandboxId },
    runtime_lifecycle_status: "stopped",
    evaluation_status: "stopped",
    ...(effectBase === undefined
      ? {
          effect_completed_at: new Date(
            Date.parse(attempt.attempted_at) + 9_000
          ).toISOString()
        }
      : {
          effect_started_at: new Date(effectBase + 1_000).toISOString(),
          effect_completed_at: new Date(effectBase + 4_000).toISOString()
        })
  });
}

async function comparisonActivationInvariantSnapshot(
  store: LocalStore
): Promise<Record<string, Array<{ file: string; bytes: string }>>> {
  const collections = [
    "candidates",
    "candidate-versions",
    "system-codes",
    "candidate-admission-decisions",
    "trading-promotions",
    "paper-trading-comparison-preparations",
    "paper-trading-comparison-commitments",
    "paper-trading-comparison-ticks",
    "trading-runs",
    "paper-trading-evaluation-commitments",
    "paper-trading-evaluations",
    "paper-trading-observations",
    "order-requests",
    "gateway-results",
    "execution-results",
    "run-control-commands",
    "run-control-decisions",
    "runtime-audit-events",
    "sandboxes",
    "sandbox-logs",
    "runtime-heartbeats",
    "sandbox-command-evidence"
  ];
  return Object.fromEntries(await Promise.all(collections.map(async (collection) => {
    const itemDir = path.join(store.root(), collection, "items");
    const files = (await readdir(itemDir).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    })).sort();
    return [collection, await Promise.all(files.map(async (file) => ({
      file,
      bytes: await readFile(path.join(itemDir, file), "utf8")
    })))] as const;
  })));
}

const boundSideWriterKinds = [
  "create-run-exact",
  "commitment-exact",
  "evaluation-exact",
  "alternate-commitment",
  "alternate-commitment-evaluation-chain",
  "evaluation",
  "observation",
  "ledger",
  "run-control",
  "sandbox-start",
  "sandbox-observations",
  "sandbox-stop"
] as const;
type BoundSideWriterKind = (typeof boundSideWriterKinds)[number];

async function invokeBoundSideWriter(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>,
  writer: BoundSideWriterKind
): Promise<unknown> {
  if (writer === "create-run-exact") {
    return store.createPaperTradingRun({
      idempotency_key: "paper-comparison-store:challenger",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      evidence_purpose: "qualification",
      created_at: fixture.preparation.committed_at
    });
  }
  if (writer === "commitment-exact") {
    return store.recordPaperTradingEvaluationCommitment(fixture.challengerCommitment);
  }
  if (writer === "evaluation-exact") {
    return store.recordPaperTradingEvaluation(fixture.challengerEvaluation);
  }
  if (writer === "evaluation") {
    return store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      latest_failure_reason: "post-pair-mutation"
    });
  }
  if (writer === "alternate-commitment" ||
    writer === "alternate-commitment-evaluation-chain") {
    const commitment = alternateSideCommitment(fixture);
    await store.recordPaperTradingEvaluationCommitment(commitment);
    if (writer === "alternate-commitment") return commitment;
    return store.recordPaperTradingEvaluation({
      ...fixture.challengerEvaluation,
      paper_trading_evaluation_id: "paper-evaluation-comparison-challenger-alternate-chain",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: commitment.paper_trading_evaluation_commitment_id
      }
    });
  }
  if (writer === "observation") {
    const observedAt = "2026-07-10T00:01:00.000Z";
    const observation = {
      ...validPaperTradingObservation(
        fixture.challengerCommitment,
        fixture.challengerEvaluation
      ),
      paper_trading_observation_id: "paper-observation-post-pair-mutation",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation" as const,
        id: fixture.challengerEvaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment" as const,
        id: fixture.challengerCommitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...fixture.challengerCommitment.candidate_ref },
      candidate_version_ref: { ...fixture.challengerCommitment.candidate_version_ref },
      trading_run_ref: { ...fixture.challengerCommitment.trading_run_ref },
      sequence: 1,
      observed_at: observedAt
    };
    return store.recordPaperTradingObservation(observation, {
      ...fixture.challengerEvaluation,
      status: "running",
      observation_count: 1,
      last_observed_at: observedAt,
      next_observation_at: "2026-07-10T00:02:00.000Z"
    });
  }
  if (writer === "ledger") {
    return store.recordLedger({
      ...validLedgerInput(fixture.challenger.candidate_version.candidate_version_id),
      idempotency_key: "post-pair-ledger",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      runtime_id: fixture.challengerRun.trading_run_id
    });
  }
  if (writer === "run-control") {
    return store.recordRunControlAudit({
      ...validRunControlAuditInput(
        fixture.challenger.candidate_version.candidate_version_id
      ),
      idempotency_key: "post-pair-run-control",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      runtime_id: fixture.challengerRun.trading_run_id
    });
  }
  const sandbox = boundSideSandboxInput(fixture);
  if (writer === "sandbox-start") return store.recordSandboxStart(sandbox);
  if (writer === "sandbox-observations") {
    return store.recordSandboxObservations(sandbox.instance.sandbox_id, {
      lifecycle_status: "running",
      logs: [],
      heartbeats: [],
      command_evidence: []
    });
  }
  return store.stopSandbox(
    { sandbox_id: sandbox.instance.sandbox_id, stopped_at: "2026-07-10T00:02:00.000Z" },
    {}
  );
}

async function invokeForbiddenBoundSideWriterWithContext(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedRuntimeActivationFixture>>,
  writer: "observation" | "ledger" | "sandbox-observations" |
    "commitment" | "system-code" | "admission" | "promotion",
  context: PaperTradingComparisonRuntimeWriteContext |
    PaperTradingComparisonTickIOWriteContext
): Promise<unknown> {
  if (writer === "observation") {
    const observedAt = new Date(Date.parse(fixture.activation.authorized_at) + 60_000)
      .toISOString();
    const observation = {
      ...validPaperTradingObservation(
        fixture.challengerCommitment,
        fixture.challengerEvaluation
      ),
      paper_trading_observation_id: "paper-observation-runtime-context-forbidden",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation" as const,
        id: fixture.challengerEvaluation.paper_trading_evaluation_id
      },
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment" as const,
        id: fixture.challengerCommitment.paper_trading_evaluation_commitment_id
      },
      candidate_ref: { ...fixture.challengerCommitment.candidate_ref },
      candidate_version_ref: { ...fixture.challengerCommitment.candidate_version_ref },
      trading_run_ref: { ...fixture.challengerCommitment.trading_run_ref },
      sequence: 1,
      observed_at: observedAt
    };
    return Reflect.apply(store.recordPaperTradingObservation, store, [
      observation,
      {
        ...fixture.challengerEvaluation,
        status: "running",
        observation_count: 1,
        last_observed_at: observedAt,
        next_observation_at: new Date(Date.parse(observedAt) + 60_000).toISOString()
      },
      context
    ]);
  }
  if (writer === "ledger") {
    return Reflect.apply(store.recordLedger, store, [{
      ...validLedgerInput(fixture.challenger.candidate_version.candidate_version_id),
      idempotency_key: "runtime-context-forbidden-ledger",
      candidate_id: fixture.challenger.candidate_id,
      candidate_version_id: fixture.challenger.candidate_version.candidate_version_id,
      runtime_id: fixture.challengerRun.trading_run_id
    }, context]);
  }
  if (writer === "sandbox-observations") {
    const sandbox = boundSideSandboxInput(fixture);
    return Reflect.apply(store.recordSandboxObservations, store, [
      sandbox.instance.sandbox_id,
      { lifecycle_status: "running", logs: [], heartbeats: [], command_evidence: [] },
      context
    ]);
  }
  if (writer === "system-code") {
    const systemCode = (await store.getSystemCode(
      fixture.preparation.challenger.system_code_ref.id
    ))!;
    return Reflect.apply(store.recordSystemCode, store, [{
      ...systemCode,
      entrypoint: ["python3", "runtime-context-forbidden.py"]
    }, context]);
  }
  if (writer === "commitment") {
    return Reflect.apply(store.recordPaperTradingEvaluationCommitment, store, [{
      ...fixture.challengerCommitment,
      committed_at: new Date(
        Date.parse(fixture.challengerCommitment.committed_at) + 1
      ).toISOString()
    }, context]);
  }
  if (writer === "admission") {
    const admission = (await store.getCandidateAdmissionDecision(
      fixture.preparation.challenger.candidate_admission_decision_ref.id
    ))!;
    return Reflect.apply(store.recordCandidateAdmissionDecision, store, [{
      ...admission,
      decided_at: new Date(Date.parse(admission.decided_at) + 1).toISOString()
    }, context]);
  }
  return Reflect.apply(store.recordTradingPromotion, store, [{
    ...fixture.promotion,
    promoted_at: new Date(Date.parse(fixture.promotion.promoted_at) + 1).toISOString()
  }, context]);
}

async function invokeForbiddenTickIOWriter(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedPairedCheckpointAttributionFixture>>,
  writer: "sandbox" | "evaluation" | "observation" | "ledger" |
    "run-control" | "tick" | "checkpoint" | "promotion",
  context: PaperTradingComparisonTickIOWriteContext
): Promise<unknown> {
  if (writer === "sandbox") {
    return Reflect.apply(store.recordSandboxStart, store, [
      runtimeActivationSandboxStart(fixture, fixture.attempt, "challenger"),
      context
    ]);
  }
  if (writer === "evaluation") {
    return Reflect.apply(store.recordPaperTradingEvaluation, store, [{
      ...fixture.checkpoint.challenger.evaluation,
      status: "stopped",
      next_observation_at: undefined,
      stopped_at: new Date(
        Date.parse(fixture.checkpoint.outcome.completed_at) + 2_000
      ).toISOString()
    }, context]);
  }
  if (writer === "observation" || writer === "ledger" || writer === "promotion") {
    return invokeForbiddenBoundSideWriterWithContext(
      store,
      fixture,
      writer,
      context
    );
  }
  if (writer === "run-control") {
    return Reflect.apply(store.recordRunControlAudit, store, [
      runtimeActivationRunControlInput(
        fixture,
        fixture.attempt,
        "challenger",
        "stop"
      ),
      context
    ]);
  }
  if (writer === "tick") {
    return Reflect.apply(store.recordPaperTradingComparisonTick, store, [
      withTickDigest({
        ...fixture.tick,
        paper_trading_comparison_tick_id: "forbidden-attribution-tick"
      }),
      context
    ]);
  }
  return Reflect.apply(store.recordPaperTradingComparisonCheckpointAttempt, store, [
    withCheckpointAttemptDigest({
      ...fixture.checkpointAttempt,
      paper_trading_comparison_checkpoint_attempt_id:
        "forbidden-attribution-checkpoint"
    }),
    context
  ]);
}

function alternateSideCommitment(
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): PaperTradingEvaluationCommitmentRecord {
  return withPaperTradingCommitmentDigest({
    ...fixture.challengerCommitment,
    paper_trading_evaluation_commitment_id:
      "paper-commitment-comparison-challenger-alternate-chain",
    commitment_digest: ""
  });
}

function boundSideSandboxInput(
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): SandboxObservationInput {
  return {
    instance: {
      record_kind: "sandbox",
      version: 1,
      sandbox_id: "sandbox-post-pair-writer",
      adapter_kind: "deterministic_test",
      system_code_ref: { ...fixture.challengerRun.system_code_ref! },
      runtime_ref: {
        record_kind: "trading_run",
        id: fixture.challengerRun.trading_run_id
      },
      sandbox_placement_ref: { ...fixture.challengerRun.placement_ref },
      lifecycle_status: "running",
      sandbox_name: "paper-comparison-post-pair-writer",
      created_at: "2026-07-10T00:01:00.000Z",
      started_at: "2026-07-10T00:01:00.000Z",
      log_refs: [],
      heartbeat_refs: [],
      command_evidence_refs: [],
      authority_status: "not_live"
    }
  };
}

async function seedBoundSandboxForWriterTest(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): Promise<void> {
  const sandbox = boundSideSandboxInput(fixture).instance;
  await overwriteComparisonFixtureRecord(store, "sandboxes", sandbox.sandbox_id, sandbox);
}

async function boundComparisonEvidenceSnapshot(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>
): Promise<unknown> {
  const collections = [
    "order-requests",
    "gateway-results",
    "execution-results",
    "run-control-commands",
    "run-control-decisions",
    "runtime-audit-events",
    "sandboxes",
    "sandbox-logs",
    "runtime-heartbeats",
    "sandbox-command-evidence"
  ];
  return {
    run: await store.getTradingRun(fixture.challengerRun.trading_run_id),
    commitment: await store.getPaperTradingEvaluationCommitment(
      fixture.challengerCommitment.paper_trading_evaluation_commitment_id
    ),
    evaluation: await store.getPaperTradingEvaluation(
      fixture.challengerEvaluation.paper_trading_evaluation_id
    ),
    observations: await store.listPaperTradingObservations(
      fixture.challengerEvaluation.paper_trading_evaluation_id
    ),
    allCommitments: await store.listPaperTradingEvaluationCommitments(),
    allEvaluations: await store.listPaperTradingEvaluations(),
    files: Object.fromEntries(await Promise.all(collections.map(async (collection) => [
      collection,
      await readdir(path.join(store.root(), collection, "items")).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      })
    ])))
  };
}

async function comparisonGraphByteSnapshot(
  store: LocalStore
): Promise<Record<string, Array<{ file: string; bytes: string }>>> {
  const collections = [
    "trading-promotions",
    "paper-trading-comparison-preparations",
    "paper-trading-comparison-commitments",
    "trading-runs",
    "paper-trading-evaluation-commitments",
    "paper-trading-evaluations",
    "paper-trading-observations"
  ];
  return Object.fromEntries(await Promise.all(collections.map(async (collection) => {
    const itemDir = path.join(store.root(), collection, "items");
    const files = (await readdir(itemDir).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    })).sort();
    return [collection, await Promise.all(files.map(async (file) => ({
      file,
      bytes: await readFile(path.join(itemDir, file), "utf8")
    })))] as const;
  })));
}

type PromotionEvidenceFixture = {
  championPromotionEvidence: Awaited<ReturnType<typeof recordQualifiedPromotionEvidence>>;
};

async function promotionEvidenceSnapshot(
  store: LocalStore,
  fixture: PromotionEvidenceFixture
): Promise<unknown> {
  const evidence = fixture.championPromotionEvidence;
  return {
    commitment: await store.getPaperTradingEvaluationCommitment(
      evidence.commitment.paper_trading_evaluation_commitment_id
    ),
    evaluation: await store.getPaperTradingEvaluation(
      evidence.evaluation.paper_trading_evaluation_id
    ),
    observations: await store.listPaperTradingObservations(
      evidence.evaluation.paper_trading_evaluation_id
    )
  };
}

async function invokeFrozenPromotionEvidenceWriter(
  store: LocalStore,
  fixture: PromotionEvidenceFixture,
  writer: "evaluation-mutation" | "observation-append"
): Promise<unknown> {
  const evidence = fixture.championPromotionEvidence;
  if (writer === "evaluation-mutation") {
    return store.recordPaperTradingEvaluation({
      ...evidence.evaluation,
      latest_failure_reason: "attempted-frozen-promotion-evaluation-mutation"
    });
  }
  const last = evidence.observations.at(-1);
  if (!last) throw new Error("promotion evidence fixture has no observations");
  const observedAt = new Date(Date.parse(last.observed_at) + 60_000).toISOString();
  const { market_snapshot: _marketSnapshot, ...lastWithoutMarketSnapshot } = last;
  const observation: PaperTradingObservationRecord = {
    ...lastWithoutMarketSnapshot,
    paper_trading_observation_id: `${last.paper_trading_observation_id}-append-attempt`,
    sequence: last.sequence + 1,
    observed_at: observedAt
  };
  const { stopped_at: _stoppedAt, ...evaluationWithoutStoppedAt } = evidence.evaluation;
  return store.recordPaperTradingObservation(observation, {
    ...evaluationWithoutStoppedAt,
    status: "stopped",
    observation_count: observation.sequence,
    last_observed_at: observedAt,
    next_observation_at: undefined,
    stopped_at: observedAt
  });
}

async function rewriteFrozenSideDigestsForSemanticTest(
  store: LocalStore,
  fixture: Awaited<ReturnType<typeof storedComparisonFixture>>,
  updates: Partial<PaperTradingComparisonSide>
): Promise<PaperTradingComparisonCommitmentRecord> {
  const preparation = withPreparationDigest({
    ...fixture.preparation,
    challenger: { ...fixture.preparation.challenger, ...updates },
    preparation_digest: ""
  });
  const pair = withComparisonDigest({
    ...fixture.comparison,
    challenger: { ...fixture.comparison.challenger, ...updates },
    commitment_digest: ""
  });
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-preparations",
    preparation.paper_trading_comparison_preparation_id,
    preparation
  );
  await overwriteComparisonFixtureRecord(
    store,
    "paper-trading-comparison-commitments",
    pair.paper_trading_comparison_commitment_id,
    pair
  );
  return pair;
}

class InterleavingComparisonLocalStore extends LocalStore {
  latestPromotionReadEntered: Promise<void> = Promise.resolve();
  exactRunReadEntered: Promise<void> = Promise.resolve();
  private markPromotionReadEntered: (() => void) | undefined;
  private promotionReadRelease: Promise<void> | undefined;
  private releasePromotionRead: (() => void) | undefined;
  private markRunReadEntered: (() => void) | undefined;
  private runReadRelease: Promise<void> | undefined;
  private releaseRunRead: (() => void) | undefined;

  comparisonTransactionTail(): Promise<void> {
    return (this as unknown as { comparisonEvidenceWriteQueue: Promise<void> })
      .comparisonEvidenceWriteQueue;
  }

  pauseLatestPromotionRead(): void {
    this.latestPromotionReadEntered = new Promise((resolve) => {
      this.markPromotionReadEntered = resolve;
    });
    this.promotionReadRelease = new Promise((resolve) => {
      this.releasePromotionRead = resolve;
    });
  }

  releaseLatestPromotionRead(): void { this.releasePromotionRead?.(); }

  pauseExactRunRead(): void {
    this.exactRunReadEntered = new Promise((resolve) => {
      this.markRunReadEntered = resolve;
    });
    this.runReadRelease = new Promise((resolve) => {
      this.releaseRunRead = resolve;
    });
  }

  releaseExactRunRead(): void { this.releaseRunRead?.(); }

  override async getLatestTradingPromotion(): Promise<TradingPromotionRecord | undefined> {
    const result = await super.getLatestTradingPromotion();
    if (this.promotionReadRelease) {
      this.markPromotionReadEntered?.();
      await this.promotionReadRelease;
      this.promotionReadRelease = undefined;
      this.releasePromotionRead = undefined;
      this.markPromotionReadEntered = undefined;
    }
    return result;
  }

  override async getTradingRun(tradingRunId: string): Promise<TradingRunRecord | undefined> {
    const result = await super.getTradingRun(tradingRunId);
    if (this.runReadRelease) {
      this.markRunReadEntered?.();
      await this.runReadRelease;
      this.runReadRelease = undefined;
      this.releaseRunRead = undefined;
      this.markRunReadEntered = undefined;
    }
    return result;
  }
}

function laterChampionPromotion(
  fixture: Awaited<ReturnType<typeof comparisonPreparationFixture>>
): TradingPromotionRecord {
  return {
    ...fixture.promotion,
    trading_promotion_id: "trading-promotion-after-reservation",
    promoted_at: "2026-07-09T23:59:59.500Z"
  };
}

async function expectComparisonWriterQueued(
  store: InterleavingComparisonLocalStore,
  activeTransactionTail: Promise<void>,
  writer: Promise<unknown>
): Promise<void> {
  let settled = false;
  void writer.then(
    () => { settled = true; },
    () => { settled = true; }
  );
  const queuedWriterTail = store.comparisonTransactionTail();
  expect(queuedWriterTail).not.toBe(activeTransactionTail);
  await Promise.resolve();
  expect(settled).toBe(false);
}

function validPaperTradingComparisonCommitment(): PaperTradingComparisonCommitmentRecord {
  return {
    record_kind: "paper_trading_comparison_commitment",
    version: 1,
    paper_trading_comparison_commitment_id: "paper-comparison-store-001",
    preparation_ref: {
      record_kind: "paper_trading_comparison_preparation",
      id: "paper-comparison-preparation-store-001"
    },
    champion: comparisonPlaceholderSide("champion"),
    challenger: comparisonPlaceholderSide("challenger"),
    champion_selection: {
      selection_kind: "trading_review",
      trading_promotion_ref: { record_kind: "trading_promotion", id: "replaced-promotion" },
      trading_promotion_digest: "sha256:replaced-promotion-record",
      paper_trading_evaluation_ref: {
        record_kind: "paper_trading_evaluation",
        id: "replaced-promotion-evaluation"
      },
      paper_trading_evaluation_record_digest: "sha256:replaced-promotion-evaluation-record",
      paper_trading_evaluation_commitment_ref: {
        record_kind: "paper_trading_evaluation_commitment",
        id: "replaced-promotion-commitment"
      },
      paper_trading_evaluation_commitment_record_digest:
        "sha256:replaced-promotion-commitment-record",
      paper_trading_observation_chain_digest: "sha256:replaced-promotion-observation-chain"
    },
    comparison_policy: {
      policy_version: "paper-comparison-v1",
      comparison_mode: "champion_challenge",
      symbol: "BTCUSDT",
      interval_ms: 60_000,
      minimum_observation_count: 30,
      minimum_elapsed_ms: 1_800_000,
      maximum_observation_count: 120,
      maximum_elapsed_ms: 7_200_000,
      maximum_start_skew_ms: 5_000,
      maximum_provider_request_count_per_side: 500,
      maximum_retry_count_per_side: 3,
      primary_metric: "net_revenue_usdt",
      minimum_net_revenue_lift_usdt: 10,
      required_confirmation_count: 2,
      require_non_overlapping_windows: true,
      require_both_qualified: true,
      release_policy: "sealed_until_adjudication"
    },
    market_data_configuration_digest: "sha256:market-data-configuration",
    paper_policy_identity: {
      market_data_policy_version: "binance-public-market-v1",
      gateway_policy_version: "paper-gateway-dry-run-v1",
      cost_policy_version: "paper-cost-8bps-v1",
      funding_policy_version: "paper-funding-engine-v1",
      slippage_policy_version: "paper-public-fill-slippage-v1",
      fill_policy_version: "paper-public-execution-fill-v1",
      risk_policy_version: "paper-risk-validation-v1",
      paper_account_policy_version: "fake-paper-account-10000usdt-v1",
      decision_event_protocol_version: "trading-system-paper-events-v1",
      persistent_state_boundary_version: "paper-engine-checkpoint-v1"
    },
    committed_at: "2026-07-10T00:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  };
}

function comparisonPlaceholderSide(role: "champion" | "challenger"): PaperTradingComparisonSide {
  return {
    role,
    candidate_ref: { record_kind: "trading_system_candidate", id: `replaced-${role}` },
    candidate_version_ref: { record_kind: "candidate_version", id: `replaced-${role}-version` },
    candidate_version_digest: `sha256:replaced-${role}-version-record`,
    system_code_ref: { record_kind: "system_code", id: `replaced-${role}-code` },
    system_code_record_digest: `sha256:replaced-${role}-code-record`,
    system_code_artifact_digest: `sha256:replaced-${role}-code-artifact`,
    candidate_admission_decision_ref: {
      record_kind: "candidate_admission_decision",
      id: `replaced-${role}-admission`
    },
    admission_decision_digest: `sha256:replaced-${role}-admission-record`,
    trading_run_ref: { record_kind: "trading_run", id: `replaced-${role}-run` },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: `replaced-${role}-commitment`
    },
    paper_trading_evaluation_commitment_digest: `sha256:replaced-${role}-commitment-content`,
    paper_trading_evaluation_commitment_record_digest:
      `sha256:replaced-${role}-commitment-record`,
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: `replaced-${role}-evaluation`
    },
    paper_trading_evaluation_record_digest: `sha256:replaced-${role}-evaluation-record`
  };
}

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

function validCandidateAdmissionRecords(): {
  experiment: ExperimentRunRecord;
  evaluation: TradingEvaluationResultRecord;
  finding: ResearchFindingRecord;
  admission: CandidateAdmissionDecisionRecord;
} {
  const experiment: ExperimentRunRecord = {
    record_kind: "experiment_run",
    version: 1,
    experiment_run_id: "experiment-run-candidate-admission-001",
    research_worker_ref: { record_kind: "research_worker", id: "research-worker-admission-001" },
    research_direction_ref: {
      record_kind: "research_direction",
      id: "research-direction-admission-001"
    },
    system_code_ref: { record_kind: "system_code", id: FIXTURE_SYSTEM_CODE_ID },
    trading_evaluation_task_ref: {
      record_kind: "trading_evaluation_task",
      id: "trading-evaluation-task-admission-001"
    },
    trace_ref: { record_kind: "trace_placeholder", id: "trace-candidate-admission-001" },
    submitted_at: "2026-07-10T00:00:00.000Z",
    status: "evaluated",
    authority_status: "not_live"
  };
  const evaluation: TradingEvaluationResultRecord = {
    record_kind: "trading_evaluation_result",
    version: 1,
    trading_evaluation_result_id: "trading-evaluation-result-candidate-admission-001",
    experiment_run_ref: { record_kind: "experiment_run", id: experiment.experiment_run_id },
    trading_evaluation_task_ref: experiment.trading_evaluation_task_ref,
    evaluator_ref: { record_kind: "external_evaluator", id: "candidate-admission-evaluator-v1" },
    result_status: "accepted",
    evidence_disposition: "not_counted",
    score_summary: {
      total_score: 0.7,
      oos_score: 0.7,
      drawdown_score: 0.7,
      turnover_score: 0.7,
      cost_survival_score: 0.7,
      reproducibility_score: 0.7,
      complexity_penalty: 0
    },
    metric_refs: [{ record_kind: "metric_snapshot", id: "metric-candidate-admission-001" }],
    evaluator_trace_ref: {
      record_kind: "trace_placeholder",
      id: "trace-evaluator-candidate-admission-001"
    },
    completed_at: "2026-07-10T00:01:00.000Z",
    authority_status: "not_counted"
  };
  const finding: ResearchFindingRecord = {
    record_kind: "research_finding",
    version: 1,
    research_finding_id: "research-finding-candidate-admission-001",
    research_worker_ref: experiment.research_worker_ref,
    research_direction_ref: experiment.research_direction_ref,
    experiment_run_ref: evaluation.experiment_run_ref,
    trading_evaluation_result_ref: {
      record_kind: "trading_evaluation_result",
      id: evaluation.trading_evaluation_result_id
    },
    finding_kind: "positive_result",
    summary: "Accepted external research evidence is eligible for candidate admission.",
    supporting_record_refs: [
      {
        record_kind: "trading_evaluation_result",
        id: evaluation.trading_evaluation_result_id
      }
    ],
    created_at: "2026-07-10T00:02:00.000Z",
    authority_status: "research_trace_only"
  };
  return {
    experiment,
    evaluation,
    finding,
    admission: {
      record_kind: "candidate_admission_decision",
      version: 1,
      candidate_admission_decision_id: "candidate-admission-decision-001",
      source_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-candidate-admission-source-001"
      },
      system_code_ref: experiment.system_code_ref,
      experiment_run_ref: evaluation.experiment_run_ref,
      trading_evaluation_result_ref: finding.trading_evaluation_result_ref,
      research_finding_ref: {
        record_kind: "research_finding",
        id: finding.research_finding_id
      },
      source_artifact_digest: "sha256:source-candidate-admission-001",
      submitted_artifact_digest: "sha256:fixture-clock-python-artifact-v1",
      research_worker_outcome: "changed",
      experiment_status: "evaluated",
      evaluation_status: "accepted",
      evidence_disposition: "not_counted",
      status: "admitted",
      reason: "evaluation_accepted",
      runnable_paper_handoff: true,
      decided_at: "2026-07-10T00:03:00.000Z",
      authority_status: "not_live"
    }
  };
}

function validCandidateAdmissionSourceSystemCode(): SystemCodeRecord {
  return {
    record_kind: "system_code",
    version: 1,
    system_code_id: "system-code-candidate-admission-source-001",
    artifact_kind: "python_file",
    artifact_path: "fixtures/trading-systems/clock.py",
    artifact_digest: "sha256:source-candidate-admission-001",
    runtime_kind: "python",
    entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "no-raw-secrets" },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "candidate-admission-source"
    },
    provenance_refs: [],
    status: "registered",
    created_at: "2026-07-10T00:00:00.000Z",
    authority_status: "not_live"
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

function validPaperTradingCommitment(): PaperTradingEvaluationCommitmentRecord {
  return withPaperTradingCommitmentDigest({
    record_kind: "paper_trading_evaluation_commitment",
    version: 1,
    paper_trading_evaluation_commitment_id: "paper-commitment-fixture-001",
    evidence_purpose: "research_feedback",
    candidate_ref: {
      record_kind: "trading_system_candidate",
      id: FIXTURE_CANDIDATE_ID
    },
    candidate_version_ref: {
      record_kind: "candidate_version",
      id: "fixture-candidate-version-001"
    },
    trading_run_ref: {
      record_kind: "trading_run",
      id: "fixture-trading-run-001"
    },
    system_code_ref: {
      record_kind: "system_code",
      id: FIXTURE_SYSTEM_CODE_ID
    },
    system_code_artifact_digest: "sha256:fixture-clock-python-artifact-v1",
    resolved_artifact_digest: "sha256:resolved-fixture-clock-python-artifact-v1",
    runtime_identity: {
      artifact_kind: "python_file",
      runtime_kind: "python",
      entrypoint: ["python3", "fixtures/trading-systems/clock.py"],
      artifact_runtime_contract_ref: {
        record_kind: "artifact_runtime_contract",
        id: "fixture-artifact-runtime-contract-clock-python-001"
      }
    },
    provider_identity: {
      runtime_provider_kind: "none",
      qualification_eligible: true
    },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "capability-policy-clock-fixture-v1"
    },
    secret_policy_ref: {
      record_kind: "secret_policy",
      id: "secret-policy-no-raw-values-v1"
    },
    policy_identity: {
      market_data_policy_version: "binance-public-market-v1",
      gateway_policy_version: "paper-gateway-dry-run-v1",
      cost_policy_version: "paper-cost-8bps-v1",
      funding_policy_version: "paper-funding-engine-v1",
      slippage_policy_version: "paper-public-fill-slippage-v1",
      fill_policy_version: "paper-public-execution-fill-v1",
      risk_policy_version: "paper-risk-validation-v1",
      paper_account_policy_version: "fake-paper-account-10000usdt-v1",
      decision_event_protocol_version: "trading-system-paper-events-v1",
      persistent_state_boundary_version: "paper-engine-checkpoint-v1"
    },
    data_identity: {
      symbol: "BTCUSDT",
      market_data_port: "gateway_owned",
      allowed_market_data_source: "binance_production_public_hybrid",
      market_data_configuration_digest: "sha256:fixture-market-data-configuration-v1",
      private_exchange_access: "forbidden",
      live_order_access: "forbidden"
    },
    window_policy: {
      interval_ms: 60_000,
      release_policy: "closed_observation",
      eligibility_policy_version: "paper-evidence-eligibility-v1"
    },
    initial_account_snapshot: initialPaperTradingAccountSnapshot(),
    committed_at: "2026-07-10T09:00:00.000Z",
    commitment_digest: "",
    authority_status: "not_live"
  });
}

function withPaperTradingCommitmentDigest(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationCommitmentRecord {
  return {
    ...commitment,
    commitment_digest: `sha256:${createHash("sha256")
      .update(paperTradingEvaluationCommitmentDigestInput(commitment))
      .digest("hex")}`
  };
}

function validPaperTradingEvaluation(
  commitment: PaperTradingEvaluationCommitmentRecord
): PaperTradingEvaluationRecord {
  return {
    record_kind: "paper_trading_evaluation",
    version: 1,
    paper_trading_evaluation_id: "paper-evaluation-fixture-001",
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: {
      record_kind: "trading_run",
      id: "fixture-trading-run-001"
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    status: "not_started",
    interval_ms: commitment.window_policy.interval_ms,
    observation_count: 0,
    started_at: commitment.committed_at,
    latest_score: zeroPaperTradingProfitLoss(),
    paper_account_snapshot: commitment.initial_account_snapshot,
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    authority_status: "not_live"
  };
}

function validPaperTradingObservation(
  commitment: PaperTradingEvaluationCommitmentRecord,
  evaluation: PaperTradingEvaluationRecord
): PaperTradingObservationRecord {
  return {
    record_kind: "paper_trading_observation",
    version: 1,
    paper_trading_observation_id: "paper-observation-fixture-0001",
    paper_trading_evaluation_ref: {
      record_kind: "paper_trading_evaluation",
      id: evaluation.paper_trading_evaluation_id
    },
    paper_trading_evaluation_commitment_ref: {
      record_kind: "paper_trading_evaluation_commitment",
      id: commitment.paper_trading_evaluation_commitment_id
    },
    candidate_ref: commitment.candidate_ref,
    candidate_version_ref: commitment.candidate_version_ref,
    trading_run_ref: evaluation.trading_run_ref,
    sequence: 1,
    status: "no_order",
    observed_at: "2026-07-10T09:01:00.000Z",
    paper_account_snapshot: commitment.initial_account_snapshot,
    open_orders: [],
    processed_trading_system_event_ids: [],
    processed_public_trade_ids: [],
    score_delta: zeroPaperTradingProfitLoss(),
    cumulative_score: zeroPaperTradingProfitLoss(),
    authority_status: "not_live"
  };
}

function initialPaperTradingAccountSnapshot(): PaperTradingEvaluationCommitmentRecord["initial_account_snapshot"] {
  return {
    wallet_balance_usdt: "10000",
    available_balance_usdt: "10000",
    equity_usdt: "10000",
    realized_pnl_usdt: "0",
    unrealized_pnl_usdt: "0",
    fee_paid_usdt: "0",
    slippage_paid_usdt: "0",
    funding_paid_usdt: "0",
    margin_reserved_usdt: "0",
    position: {
      symbol: "BTCUSDT",
      quantity: "0",
      side: "flat",
      mark_price: "0",
      notional_usdt: "0"
    },
    open_order_count: 0,
    authority_status: "not_live"
  };
}

function zeroPaperTradingProfitLoss() {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
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
