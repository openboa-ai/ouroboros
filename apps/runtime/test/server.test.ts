import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_CANDIDATE_ID, FIXTURE_SYSTEM_CODE_ID, LocalStore } from "@ouroboros/local-store";
import { buildServer } from "../src/server";
import { CandidateArenaRunner, buildCandidateArenaReadModel, runCandidateArenaTick } from "../src/candidate-arena";
import {
  BINANCE_BTCUSDT_QUERY,
  BINANCE_PRIVATE_READINESS_SECURITY_TYPES,
  binanceBtcusdtNoAuthoritySurfaceExpectation,
  binancePrivateReadinessPolicyDecisionNoAuthorityExpectation,
  binancePrivateReadinessPostureNoAuthorityExpectation,
  expectNoPrivateReadSecrets,
  privateReadinessPolicyGate
} from "../../../test/support/binance-no-authority";
import type {
  LedgerInput,
  CandidateMaterializationInput,
  RunControlAuditInput,
  TradingRunRecord
} from "@ouroboros/domain";
import { OUROBOROS_COMMAND_KINDS } from "@ouroboros/domain";
import { FixtureEvaluationProviderAdapter } from "../src/providers/fixture-evaluation-provider";
import { BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL } from "../src/trading-gateway-environment";
import type {
  CandidateEvaluationRequest,
  CandidateGenerationProviderResult,
  RuntimeProviderAdapter
} from "../src/providers/runtime-provider-adapter";
import type {
  AgentEditInput,
  AgentEditResult,
  TradingResearchAgentAdapter
} from "../src/trading-research/types";
import type { TradingResearchRuntimeAgent } from "../src/trading-research/runtime-config";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "ouroboros-runtime-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("runtime read-only API", () => {
  it("serves health and candidate read models", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      binancePublicMarketClient: binancePublicMarketClient({
        markPrice: "65000.12340000",
        indexPrice: "64995.00000000",
        fundingRate: "0.00010000",
        observedServerTime: 1778889601000,
        markTime: 1778889600000
      })
    });
    const health = await server.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: "ok",
      mode: "fixture_convenience_mode",
      trading_gateway_environment: {
        runtime_environment: "paper",
        runtime_environment_source: "mlp_policy",
        exchange_environment: "unbound",
        exchange_environment_source: "runtime_binding_policy",
        rest_base_url: null,
        authority_status: "not_live"
      }
    });

    const tradingGatewayEnvironment = await server.inject({
      method: "GET",
      url: "/api/trading-gateway/environment"
    });
    expect(tradingGatewayEnvironment.statusCode).toBe(200);
    expect(tradingGatewayEnvironment.json()).toMatchObject({
      trading_gateway_environment: {
        environment_kind: "trading_gateway_environment",
        runtime_environment: "paper",
        runtime_environment_source: "mlp_policy",
        exchange_environment: "unbound",
        exchange_environment_source: "runtime_binding_policy",
        credential_scope: "none",
        configuration_status: "configured",
        live_exchange_authority: false,
        order_submission_authority: false,
        live_disabled_reason: "live_gateway_not_enabled_in_mlp"
      }
    });

    const executionModes = await server.inject({ method: "GET", url: "/api/trading-execution-modes" });
    expect(executionModes.statusCode).toBe(200);
    expect(executionModes.json()).toMatchObject({
      modes: [
        {
          mode: "backtest",
          support_status: "available",
          artifact_contract: {
            api_provider_boundary: "TradingApiProvider",
            credentials_access: "forbidden",
            order_submission: "forbidden"
          },
          provider_contract: {
            market_data: "historical_replay",
            order_plane: "order_validation_only"
          },
          authority: {
            artifact_has_credentials: false,
            artifact_has_order_authority: false,
            live_exchange_authority: false,
            status: "not_live"
          }
        },
        {
          mode: "paper",
          support_status: "available",
          provider_contract: {
            market_data: "realtime_market_data",
            account: "paper_account",
            order_plane: "paper_order_sink",
            credentials_scope: "none_required"
          },
          authority: {
            provider_may_submit_orders: false,
            live_exchange_authority: false,
            status: "paper_only"
          }
        },
        {
          mode: "live",
          support_status: "disabled",
          provider_contract: {
            account: "live_account",
            order_plane: "gated_live_order_gateway",
            credentials_scope: "provider_side_only"
          },
          authority: {
            provider_may_submit_orders: false,
            live_exchange_authority: false,
            status: "live_disabled"
          }
        }
      ]
    });

    const liveMode = await server.inject({ method: "GET", url: "/api/trading-execution-modes/live" });
    expect(liveMode.statusCode).toBe(200);
    expect(liveMode.json()).toMatchObject({
      mode: {
        mode: "live",
        artifact_contract: {
          credentials_access: "forbidden",
          order_submission: "forbidden"
        },
        authority: {
          live_exchange_authority: false,
          status: "live_disabled"
        }
      }
    });

    const missingMode = await server.inject({ method: "GET", url: "/api/trading-execution-modes/direct-broker" });
    expect(missingMode.statusCode).toBe(404);
    expect(missingMode.json()).toMatchObject({
      error: "trading_execution_mode_not_found"
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      candidates: [{
        candidate_id: FIXTURE_CANDIDATE_ID,
        latest_validation_state: {
          validation_state: "replay_required",
          validation_label: "validation_state_not_authority",
          authority_status: "not_live"
        }
      }]
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      fixture_notice: { mode: "fixture_convenience_mode" },
      runtime: {
        authority_status: "not_live",
        memory_surface: {
          access_mode: "read_only",
          authority_status: "not_evidence"
        }
      },
      latest_validation_state: {
        validation_state: "replay_required",
        reasons: [
          "no replay-run evidence has been recorded",
          "validation state cannot be inferred without replay evidence"
        ],
        required_next_evidence: [
          "record at least one candidate replay run",
          "record a second replay run to establish a comparison baseline"
        ],
        validation_label: "validation_state_not_authority"
      }
    });

    await server.close();
  });

  it("serves the latest Binance BTCUSDT order-fill substrate surface without authority", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      binancePublicMarketClient: binancePublicMarketClient({
        markPrice: "65000.12340000",
        indexPrice: "64995.00000000",
        fundingRate: "0.00010000",
        observedServerTime: 1778889601000,
        markTime: 1778889600000
      })
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/order-fill/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      surface: binanceBtcusdtNoAuthoritySurfaceExpectation({
        surface_family: "order_fill",
        surface_label: "Binance BTCUSDT order_fill",
        posture: "partially_filled",
        raw_upstream_status: "PARTIALLY_FILLED",
        raw_upstream_execution_type: "TRADE",
        freshness: "stale",
        liveness: "degraded"
      })
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_order_fill_surface: {
          surface_label: "Binance BTCUSDT order_fill",
          posture: "partially_filled",
          authority_status: "not_live"
        }
      }
    });

    await server.close();
  });

  it("serves the latest Binance BTCUSDT public market and liveness surface without authority", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      binancePublicMarketClient: binancePublicMarketClient({
        markPrice: "65000.12340000",
        indexPrice: "64995.00000000",
        fundingRate: "0.00010000",
        observedServerTime: 1778889601000,
        markTime: 1778889600000
      })
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/public-market/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      surface: binanceBtcusdtNoAuthoritySurfaceExpectation({
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
        freshness: "fresh",
        liveness: "connected",
        fixture_backed: false,
        simulated: false,
        authority_status: "read_only"
      })
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_public_market_liveness_surface: {
          surface_label: "Binance BTCUSDT public_market_liveness",
          symbol_status: "TRADING",
          authority_status: "read_only"
        }
      }
    });

    await server.close();
  });

  it("refreshes Binance BTCUSDT public market data through the explicit public-market endpoint", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      tradingGatewayEnv: {
        OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL
      },
      binancePublicMarketClient: binancePublicMarketClient({
        markPrice: "65123.45000000",
        indexPrice: "65120.00000000",
        fundingRate: "0.00020000",
        observedServerTime: 1778889661000,
        markTime: 1778889660000
      })
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/public-market/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      refresh_status: "recorded",
      surface: {
        surface_label: "Binance BTCUSDT public_market_liveness",
        mark_price: "65123.45000000",
        source_kind: "binance_market_data_rest",
        fixture_backed: false,
        simulated: false,
        authority_status: "read_only"
      }
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_public_market_liveness_surface: {
          mark_price: "65123.45000000",
          index_price: "65120.00000000",
          funding_rate: "0.00020000",
          freshness: "fresh",
          liveness: "connected",
          source_kind: "binance_market_data_rest",
          fixture_backed: false,
          simulated: false,
          authority_status: "read_only"
        }
      }
    });

    await server.close();
  });

  it("does not refresh Binance public market data during candidate inspect", async () => {
    let refreshCallCount = 0;
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      tradingGatewayEnv: {
        OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL
      },
      binancePublicMarketClient: {
        async exchangeInformation() {
          refreshCallCount += 1;
          throw new Error("unexpected Binance public market refresh");
        },
        async markPrice(_request?: { symbol?: string }) {
          refreshCallCount += 1;
          throw new Error("unexpected Binance public market refresh");
        },
        async checkServerTime() {
          refreshCallCount += 1;
          throw new Error("unexpected Binance public market refresh");
        },
        async klineCandlestickData() {
          refreshCallCount += 1;
          throw new Error("unexpected Binance public market refresh");
        }
      }
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_public_market_liveness_surface: {
          source_kind: "fixture",
          fixture_backed: true,
          authority_status: "not_live"
        }
      }
    });
    expect(refreshCallCount).toBe(0);

    await server.close();
  });

  it("keeps candidate inspect available when Binance public market refresh fails", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs"),
      tradingGatewayEnv: {
        OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL
      },
      binancePublicMarketClient: failingBinancePublicMarketClient()
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_public_market_liveness_surface: {
          source_kind: "fixture",
          fixture_backed: true,
          authority_status: "not_live"
        }
      }
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/public-market/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      refresh_status: "failed",
      refresh_reason: "binance public market unavailable",
      surface: {
        source_kind: "fixture",
        fixture_backed: true
      }
    });

    await server.close();
  });

  it("serves the latest Binance BTCUSDT private-readiness preflight surface without private authority", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/private-readiness/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      surface: binanceBtcusdtNoAuthoritySurfaceExpectation({
        surface_family: "private_readiness_preflight",
        surface_label: "Binance BTCUSDT private_readiness_preflight",
        credential_gate: {
          status: "not_configured",
          enabled: false
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
        liveness: "degraded"
      })
    });

    const body = JSON.stringify(surface.json());
    expectNoPrivateReadSecrets(body);

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_private_readiness_preflight_surface: {
          surface_label: "Binance BTCUSDT private_readiness_preflight",
          credential_gate: {
            status: "not_configured",
            enabled: false
          },
          order_submission_gate: {
            status: "disabled",
            enabled: false
          },
          authority_status: "not_live"
        },
        latest_private_readiness_posture: binancePrivateReadinessPostureNoAuthorityExpectation({
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
          raw_secret_material_present: false
        }),
        latest_private_readiness_policy_decision: {
          ...binancePrivateReadinessPolicyDecisionNoAuthorityExpectation([
            "configuration_not_ready",
            "operator_approval_missing",
            "jurisdiction_review_required",
            "live_binding_not_ready",
            "secret_handling_not_ready",
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
            "no_private_read_performed"
          ])
        }
      }
    });

    await server.close();
  });

  it("records Binance BTCUSDT private-readiness posture writes without private authority", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });
    const payload = {
      idempotency_key: "runtime-private-readiness-posture-write-001",
      venue: BINANCE_BTCUSDT_QUERY.venue,
      instrument: BINANCE_BTCUSDT_QUERY.instrument,
      product_category: "perpetual_futures",
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

    const first = await server.inject({
      method: "POST",
      url: "/api/trading-substrate/private-readiness-posture",
      payload
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/api/trading-substrate/private-readiness-posture",
      payload
    });
    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "recorded",
      posture: binancePrivateReadinessPostureNoAuthorityExpectation({
        posture_id: expect.stringContaining("local-binance-btcusdt-private-readiness-posture-"),
        source_kind: "local_config",
        fixture_backed: false,
        raw_secret_material_present: false,
        operator_approval_gate: payload.operator_approval_gate,
        jurisdiction_risk_gate: payload.jurisdiction_risk_gate,
        secret_handling_gate: payload.secret_handling_gate,
        authority_status: "not_live"
      })
    });
    expectNoPrivateReadSecrets(JSON.stringify(first.json()));

    const latest = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/private-readiness-posture/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(latest.statusCode).toBe(200);
    expect(latest.json()).toMatchObject({
      posture: {
        posture_id: first.json().posture.posture_id,
        source_kind: "local_config",
        fixture_backed: false,
        authority_status: "not_live"
      }
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_private_readiness_posture: {
          posture_id: first.json().posture.posture_id,
          source_kind: "local_config",
          fixture_backed: false,
          raw_secret_material_present: false,
          authority_status: "not_live"
        },
        private_readiness_posture_history: [
          {
            posture_id: first.json().posture.posture_id,
            source_kind: "local_config",
            raw_secret_material_present: false,
            authority_status: "not_live"
          },
          {
            posture_id: "fixture-binance-btcusdt-private-readiness-posture-001",
            source_kind: "fixture",
            authority_status: "not_live"
          }
        ],
        latest_private_readiness_policy_decision: {
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
        }
      }
    });

    await server.close();
  });

  it("rejects invalid private-readiness posture writes before local storage", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });
    const payload = {
      idempotency_key: "runtime-private-readiness-posture-write-rejected",
      venue: BINANCE_BTCUSDT_QUERY.venue,
      instrument: BINANCE_BTCUSDT_QUERY.instrument,
      product_category: "perpetual_futures",
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

    const missingGate = await server.inject({
      method: "POST",
      url: "/api/trading-substrate/private-readiness-posture",
      payload: {
        idempotency_key: "runtime-private-readiness-posture-missing-gate",
        secret_reference_configured: false
      }
    });
    expect(missingGate.statusCode).toBe(422);
    expect(missingGate.json()).toMatchObject({
      error: "private_readiness_posture_record_failed",
      reason: "invalid_private_readiness_posture_request"
    });

    const unsupportedScope = await server.inject({
      method: "POST",
      url: "/api/trading-substrate/private-readiness-posture",
      payload: {
        ...payload,
        idempotency_key: "runtime-private-readiness-posture-unsupported",
        instrument: "ETHUSDT"
      }
    });
    expect(unsupportedScope.statusCode).toBe(422);
    expect(unsupportedScope.json()).toMatchObject({
      error: "private_readiness_posture_record_failed",
      reason: "unsupported_private_readiness_posture_scope"
    });

    const rawSecret = await server.inject({
      method: "POST",
      url: "/api/trading-substrate/private-readiness-posture",
      payload: {
        ...payload,
        idempotency_key: "runtime-private-readiness-posture-raw-secret",
        secretKey: "fixture-raw-secret"
      }
    });
    expect(rawSecret.statusCode).toBe(422);
    expect(rawSecret.json()).toMatchObject({
      error: "private_readiness_posture_record_failed",
      reason: "raw_secret_material_forbidden"
    });

    await server.close();
  });

  it("serves the latest Binance BTCUSDT account-position-risk mirror surface without private authority", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: path.join(tmpDir, "empty-replay-runs")
    });

    const surface = await server.inject({
      method: "GET",
      url: `/api/trading-substrate/account-position-risk/latest?venue=${BINANCE_BTCUSDT_QUERY.venue}&instrument=${BINANCE_BTCUSDT_QUERY.instrument}`
    });
    expect(surface.statusCode).toBe(200);
    expect(surface.json()).toMatchObject({
      surface: binanceBtcusdtNoAuthoritySurfaceExpectation({
        surface_family: "account_position_risk_mirror",
        surface_label: "Binance BTCUSDT account_position_risk_mirror",
        account_scope_ref: "fixture-binance-usdt-account-mirror",
        asset: "USDT",
        account_mode: "single_asset",
        total_wallet_balance: "1250.00000000",
        total_unrealized_profit: "12.50000000",
        total_margin_balance: "1262.50000000",
        available_balance: "1100.00000000",
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
        liveness: "degraded"
      })
    });

    const body = JSON.stringify(surface.json());
    expectNoPrivateReadSecrets(body);

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      trading_substrate: {
        latest_account_position_risk_mirror_surface: {
          surface_label: "Binance BTCUSDT account_position_risk_mirror",
          risk_status: "watch",
          kill_switch_status: "inactive",
          authority_status: "not_live"
        }
      }
    });

    await server.close();
  });

  it("adds latest replay-run validation state summaries to candidate list and detail", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    await writeReplayRunRecord(runRoot, {
      run_id: "candidate-posture-baseline",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      artifact_digest: "sha256:baseline",
      score: 0.6,
      risk_decision: "valid_order_request",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "candidate-posture-baseline", "output"),
      events_path: path.join(runRoot, "candidate-posture-baseline", "output", "replay-set.json"),
      started_at: "2026-05-14T10:59:00.000Z",
      completed_at: "2026-05-14T11:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "candidate-posture-latest",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      artifact_digest: "sha256:latest",
      score: 0.85,
      risk_decision: "valid_order_request",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "candidate-posture-latest", "output"),
      events_path: path.join(runRoot, "candidate-posture-latest", "output", "replay-set.json"),
      started_at: "2026-05-14T11:59:00.000Z",
      completed_at: "2026-05-14T12:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      replayRunRoot: runRoot
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json().candidates[0]).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      latest_validation_state: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected_run_id: "candidate-posture-latest",
        baseline_run_id: "candidate-posture-baseline",
        comparison_verdict: "improved",
        validation_state: "passes_replay_checks",
        validation_label: "validation_state_not_authority",
        authority_status: "not_live",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      latest_validation_state: {
        selected_run_id: "candidate-posture-latest",
        baseline_run_id: "candidate-posture-baseline",
        validation_state: "passes_replay_checks",
        reasons: [
          "selected run improved against baseline",
          "all selected scenarios were accepted",
          "selected score meets the evidence threshold"
        ],
        required_next_evidence: [
          "human review of replay evidence",
          "future promotion issue with explicit authority scope"
        ]
      }
    });

    await server.close();
  });

  it("returns 404 for an unknown candidate", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const response = await server.inject({ method: "GET", url: "/api/candidates/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    await server.close();
  });

  it("lists local replay-run evidence for operator inspection", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-newer",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 10,
      artifact_digest: "sha256:newer",
      completed_at: "2026-05-13T15:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-older",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 0,
      artifact_digest: "sha256:older",
      completed_at: "2026-05-13T14:00:00.000Z",
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-other",
      candidate_id: "other-candidate",
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 1,
      provider_request_total: 3,
      runner_command_total: 0,
      artifact_digest: "sha256:other",
      completed_at: "2026-05-13T16:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      replayRunRoot: runRoot
    });

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs?limit=2`
    });

    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      runs: [
        {
          run_id: "replay-run-newer",
          candidate_id: FIXTURE_CANDIDATE_ID,
          runner_kind: "docker_sandboxes_sbx",
          status: "accepted",
          run_status: "completed",
          scenario_accepted: 2,
          scenario_total: 2,
          provider_request_total: 6,
          runner_command_total: 10,
          artifact_digest: "sha256:newer",
          authority_status: "not_live"
        },
        {
          run_id: "replay-run-older",
          candidate_id: FIXTURE_CANDIDATE_ID,
          runner_kind: "host_process"
        }
      ]
    });
    expect(replayRuns.json().runs).toHaveLength(2);

    const allRuns = await server.inject({
      method: "GET",
      url: "/api/replay-runs?limit=1"
    });
    expect(allRuns.statusCode).toBe(200);
    expect(allRuns.json().runs[0]).toMatchObject({
      run_id: "replay-run-other",
      candidate_id: "other-candidate"
    });

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/replay-runs"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    await server.close();
  });

  it("surfaces promoted local candidate bundles with replay-run evidence", async () => {
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const replayRunRoot = path.join(tmpDir, "replay-runs");
    const candidateId = "trading-system-candidate-promoted-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, candidateId);
    await writeReplayRunRecord(replayRunRoot, {
      run_id: "promoted-replay-run",
      candidate_id: candidateId,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 10,
      artifact_digest: "sha256:promoted",
      completed_at: "2026-05-14T10:00:00.000Z",
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.statusCode).toBe(200);
    expect(list.json().candidates[0]).toMatchObject({
      candidate_id: candidateId,
      status: "materialized",
      fixture_notice: {
        mode: "local_promoted_candidate_bundle",
        label: "Promoted local candidate bundle"
      }
    });
    expect(list.json().candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidate_id: FIXTURE_CANDIDATE_ID })
    ]));

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: candidateId,
      display_name: "Promoted Trading research Candidate",
      status: "materialized",
      program: {
        manifest: {
          declared_runtime: "python python3 run.py",
          declared_outputs: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
        }
      },
      runtime: {
        authority_status: "not_live",
        memory_surface: {
          access_mode: "read_only",
          authority_status: "not_evidence"
        }
      },
      evaluation: {
        has_runs: false,
        counted_evidence: {
          disposition_reason: "no_evaluation_runs",
          authority_status: "not_counted"
        }
      }
    });
    expect(detail.json().runtime).not.toHaveProperty("ledger");
    expect(detail.json().runtime).not.toHaveProperty("run_control");

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}/replay-runs`
    });
    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json()).toMatchObject({
      candidate_id: candidateId,
      runs: [
        {
          run_id: "promoted-replay-run",
          candidate_id: candidateId,
          runner_kind: "docker_sandboxes_sbx",
          artifact_digest: "sha256:promoted",
          authority_status: "not_live"
        }
      ]
    });

    await server.close();
  });

  it("creates promoted candidate replay runs through the runtime API", async () => {
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const replayRunRoot = path.join(tmpDir, "replay-runs");
    const candidateId = "trading-system-candidate-promoted-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, candidateId);

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot
    });

    const created = await server.inject({
      method: "POST",
      url: `/api/candidates/${candidateId}/replay-runs`,
      payload: {
        runner_kind: "host_process"
      }
    });
    expect(created.statusCode, created.body).toBe(201);
    const createdRunId = created.json().run.run_id;
    expect(createdRunId).toMatch(/^replay-run-/);
    expect(created.json()).toMatchObject({
      candidate_id: candidateId,
      run: {
        run_id: createdRunId,
        candidate_id: candidateId,
        runner_kind: "host_process",
        status: "accepted",
        run_status: "completed",
        scenario_accepted: 2,
        scenario_total: 2,
        provider_request_total: 6,
        runner_command_total: 0,
        authority_status: "not_live"
      }
    });
    expect(created.json().run.artifact_digest).toMatch(/^sha256:/);

    const replayRuns = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}/replay-runs`
    });
    expect(replayRuns.statusCode).toBe(200);
    expect(replayRuns.json().runs[0]).toMatchObject({
      run_id: createdRunId,
      candidate_id: candidateId,
      authority_status: "not_live"
    });

    const clientRunIdRejected = await server.inject({
      method: "POST",
      url: `/api/candidates/${candidateId}/replay-runs`,
      payload: {
        run_id: "client-selected-run-id",
        runner_kind: "host_process"
      }
    });
    expect(clientRunIdRejected.statusCode).toBe(422);
    expect(clientRunIdRejected.json()).toMatchObject({
      error: "replay_run_rejected",
      reason: "client_run_id_not_supported",
      candidate_id: candidateId
    });

    const fixtureRejected = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs`,
      payload: { runner_kind: "host_process" }
    });
    expect(fixtureRejected.statusCode).toBe(422);
    expect(fixtureRejected.json()).toMatchObject({
      error: "replay_run_rejected",
      reason: "promoted_candidate_bundle_required",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    const sbxRejected = await server.inject({
      method: "POST",
      url: `/api/candidates/${candidateId}/replay-runs`,
      payload: {
        runner_kind: "docker_sandboxes_sbx"
      }
    });
    expect(sbxRejected.statusCode).toBe(422);
    expect(sbxRejected.json()).toMatchObject({
      error: "replay_run_rejected",
      reason: "docker_sandboxes_sbx_runtime_disabled",
      candidate_id: candidateId
    });

    await server.close();
  });

  it("reads replay-run detail evidence for scenario drilldown", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const otherCandidateId = "trading-system-candidate-other-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, otherCandidateId);
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-detail",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 1,
      provider_request_total: 3,
      runner_command_total: 2,
      artifact_digest: "sha256:detail",
      started_at: "2026-05-14T12:00:00.000Z",
      completed_at: "2026-05-14T12:01:00.000Z",
      score: 1,
      risk_decision: "valid_order_request",
      scenario_ids: ["trend_long"],
      output_dir: path.join(runRoot, "replay-run-detail", "output"),
      events_path: path.join(runRoot, "replay-run-detail", "output", "replay-set.json"),
      scenario_results: [
        {
          scenario_id: "trend_long",
          runner_kind: "docker_sandboxes_sbx",
          sandbox_name: "ouro-s22-detail",
          status: "accepted",
          run_status: "completed",
          score: 1,
          risk_decision: "valid_order_request",
          summary: "Accepted order request with score 1.000.",
          events_path: path.join(runRoot, "replay-run-detail", "output", "trend_long", "events.jsonl"),
          provider_request_count: 3,
          runner_command_count: 2,
          metrics: [
            {
              name: "provider_boundary",
              score: 0.2,
              detail: "market/account/order validation went through the external provider"
            }
          ],
          runner_command_evidence: [
            {
              command: ["sbx", "version"],
              exit_code: 0,
              stdout_preview: "Docker Sandboxes",
              stderr_preview: "",
              started_at: "2026-05-14T12:00:01.000Z",
              completed_at: "2026-05-14T12:00:02.000Z"
            }
          ]
        }
      ],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      provenance: {
        promotion_id: "promotion-detail",
        source_session_id: "research-detail"
      },
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot: runRoot
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-detail`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      run: {
        run_id: "replay-run-detail",
        candidate_id: FIXTURE_CANDIDATE_ID,
        score: 1,
        risk_decision: "valid_order_request",
        scenario_ids: ["trend_long"],
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        },
        provenance: {
          promotion_id: "promotion-detail",
          source_session_id: "research-detail"
        },
        scenarios: [
          {
            scenario_id: "trend_long",
            runner_kind: "docker_sandboxes_sbx",
            sandbox_name: "ouro-s22-detail",
            status: "accepted",
            risk_decision: "valid_order_request",
            metrics: [
              {
                name: "provider_boundary",
                score: 0.2
              }
            ],
            runner_command_evidence: [
              {
                command: ["sbx", "version"],
                exit_code: 0,
                stdout_preview: "Docker Sandboxes",
                stderr_preview: ""
              }
            ]
          }
        ]
      }
    });

    const mismatch = await server.inject({
      method: "GET",
      url: `/api/candidates/${otherCandidateId}/replay-runs/replay-run-detail`
    });
    expect(mismatch.statusCode).toBe(404);
    expect(mismatch.json()).toEqual({
      error: "replay_run_not_found",
      candidate_id: otherCandidateId,
      run_id: "replay-run-detail"
    });

    const missingRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/missing-run`
    });
    expect(missingRun.statusCode).toBe(404);
    expect(missingRun.json()).toEqual({
      error: "replay_run_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "missing-run"
    });

    await server.close();
  });

  it("compares selected replay-run evidence against a baseline run", async () => {
    const runRoot = path.join(tmpDir, "replay-runs");
    const promotedCandidateRoot = path.join(tmpDir, "trading-system-candidates");
    const otherCandidateId = "trading-system-candidate-other-001";
    await writePromotedCandidateBundle(promotedCandidateRoot, otherCandidateId);
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-selected",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "docker_sandboxes_sbx",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 2,
      scenario_total: 2,
      provider_request_total: 6,
      runner_command_total: 4,
      artifact_digest: "sha256:selected",
      started_at: "2026-05-14T13:00:00.000Z",
      completed_at: "2026-05-14T13:01:00.000Z",
      score: 0.85,
      risk_decision: "valid_order_request",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "replay-run-selected", "output"),
      events_path: path.join(runRoot, "replay-run-selected", "output", "replay-set.json"),
      scenario_results: [],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      authority_status: "not_live"
    });
    await writeReplayRunRecord(runRoot, {
      run_id: "replay-run-baseline",
      candidate_id: FIXTURE_CANDIDATE_ID,
      runner_kind: "host_process",
      status: "accepted",
      run_status: "completed",
      scenario_accepted: 1,
      scenario_total: 2,
      provider_request_total: 5,
      runner_command_total: 0,
      artifact_digest: "sha256:baseline",
      started_at: "2026-05-14T12:00:00.000Z",
      completed_at: "2026-05-14T12:01:00.000Z",
      score: 0.6,
      risk_decision: "valid_order_request",
      scenario_ids: ["trend_long", "range_short"],
      output_dir: path.join(runRoot, "replay-run-baseline", "output"),
      events_path: path.join(runRoot, "replay-run-baseline", "output", "replay-set.json"),
      scenario_results: [],
      no_authority: {
        live_exchange: false,
        order_authority: false,
        credentials: false,
        paper_trading: false
      },
      authority_status: "not_live"
    });

    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot,
      replayRunRoot: runRoot
    });

    const comparison = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison?baseline_run_id=replay-run-baseline`
    });
    expect(comparison.statusCode).toBe(200);
    expect(comparison.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      comparison: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected: {
          run_id: "replay-run-selected",
          score: 0.85,
          scenario_accepted: 2,
          authority_status: "not_live"
        },
        baseline: {
          run_id: "replay-run-baseline",
          score: 0.6,
          scenario_accepted: 1,
          authority_status: "not_live"
        },
        baseline_selection: "explicit_baseline_run_id",
        deltas: {
          score: 0.25,
          scenario_accepted: 1,
          scenario_total: 0,
          provider_request_total: 1,
          runner_command_total: 4
        },
        risk_transition: "valid_order_request -> valid_order_request",
        verdict: "improved",
        authority_status: "not_live",
        validation_label: "comparison_not_authority",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const missingBaseline = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison?baseline_run_id=missing-run`
    });
    expect(missingBaseline.statusCode).toBe(404);
    expect(missingBaseline.json()).toEqual({
      error: "replay_run_comparison_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "replay-run-selected",
      baseline_run_id: "missing-run"
    });

    const mismatch = await server.inject({
      method: "GET",
      url: `/api/candidates/${otherCandidateId}/replay-runs/replay-run-selected/comparison?baseline_run_id=replay-run-baseline`
    });
    expect(mismatch.statusCode).toBe(404);
    expect(mismatch.json()).toEqual({
      error: "replay_run_comparison_not_found",
      candidate_id: otherCandidateId,
      run_id: "replay-run-selected",
      baseline_run_id: "replay-run-baseline"
    });

    const missingQuery = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/comparison`
    });
    expect(missingQuery.statusCode).toBe(422);
    expect(missingQuery.json()).toEqual({
      error: "replay_run_comparison_rejected",
      reason: "missing_baseline_run_id",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "replay-run-selected"
    });

    const validationState = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/validation-state?baseline_run_id=replay-run-baseline`
    });
    expect(validationState.statusCode).toBe(200);
    expect(validationState.json()).toMatchObject({
      candidate_id: FIXTURE_CANDIDATE_ID,
      validation_state: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        selected_run_id: "replay-run-selected",
        baseline_run_id: "replay-run-baseline",
        comparison_verdict: "improved",
        validation_state: "passes_replay_checks",
        reasons: [
          "selected run improved against baseline",
          "all selected scenarios were accepted",
          "selected score meets the evidence threshold"
        ],
        required_next_evidence: [
          "human review of replay evidence",
          "future promotion issue with explicit authority scope"
        ],
        authority_status: "not_live",
        validation_label: "validation_state_not_authority",
        no_authority: {
          live_exchange: false,
          order_authority: false,
          credentials: false,
          paper_trading: false
        }
      }
    });

    const noBaseline = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/replay-run-selected/validation-state`
    });
    expect(noBaseline.statusCode).toBe(200);
    expect(noBaseline.json()).toMatchObject({
      validation_state: {
        selected_run_id: "replay-run-selected",
        validation_state: "comparison_required",
        validation_label: "validation_state_not_authority"
      }
    });

    const missingPostureRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/replay-runs/missing-run/validation-state`
    });
    expect(missingPostureRun.statusCode).toBe(404);
    expect(missingPostureRun.json()).toEqual({
      error: "replay_run_validation_state_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      run_id: "missing-run"
    });

    await server.close();
  });

  it("creates and reads deterministic candidate evaluation runs", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const create = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        idempotency_key: "runtime-api-evaluation-test-001",
        execution_mode: "host_local"
      }
    });

    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created).toMatchObject({
      status: "created",
      evaluation: {
        candidate_id: FIXTURE_CANDIDATE_ID,
        candidate_version_id: candidateVersionId,
        stage_binding: {
          stage: "backtest",
          profile: "backtest",
          execution_mode: "host_local",
          authority_status: "not_live"
        },
        evaluation_run: {
          status: "created",
          authority_status: "not_counted",
          evaluator_ref: {
            record_kind: "evaluation_provider",
            id: "deterministic-backtest-fixture"
          }
        },
        trace: {
          authority_label: "provider_output_not_evidence",
          authority_status: "not_counted"
        },
        sealing_decision: {
          evidence_disposition: "not_counted",
          authority_status: "not_counted"
        },
        evidence_classifications: expect.arrayContaining([
          expect.objectContaining({
            classification_kind: "trace_debug_material",
            classification_status: "trace_only",
            authority_status: "not_counted"
          })
        ])
      }
    });
    expect(created.evaluation.trace.provider_output_artifact_refs).toHaveLength(1);
    expect(created.evaluation.trace.debug_artifact_refs).toHaveLength(1);

    const detail = await server.inject({
      method: "GET",
      url: `/api/evaluation-runs/${created.evaluation.evaluation_run.evaluation_run_record_id}`
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual(created.evaluation);

    const list = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().evaluation_runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluation_run: expect.objectContaining({
            evaluation_run_record_id: created.evaluation.evaluation_run.evaluation_run_record_id,
            authority_status: "not_counted"
          }),
          sealing_decision: expect.objectContaining({
            evidence_disposition: "not_counted"
          })
        })
      ])
    );

    const defaultHostMode = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: { candidate_version_id: candidateVersionId }
    });
    const defaultContainerMode = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        execution_mode: "containerized_local"
      }
    });
    const invalidModeAfterDefaultRun = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidateVersionId,
        execution_mode: "unsupported_mode"
      }
    });

    expect(defaultHostMode.statusCode).toBe(201);
    expect(defaultContainerMode.statusCode).toBe(201);
    expect(defaultHostMode.json().evaluation.stage_binding.execution_mode).toBe("host_local");
    expect(defaultContainerMode.json().evaluation.stage_binding.execution_mode).toBe("containerized_local");
    expect(defaultHostMode.json().evaluation.evaluation_run.evaluation_run_record_id).not.toBe(
      defaultContainerMode.json().evaluation.evaluation_run.evaluation_run_record_id
    );
    expect(invalidModeAfterDefaultRun.statusCode).toBe(422);
    expect(invalidModeAfterDefaultRun.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "unsupported_execution_mode"
    });

    await server.close();
  });

  it("records and reads Ledger through the runtime API", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const initialLedger = await server.inject({
      method: "GET",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`
    });
    expect(initialLedger.statusCode).toBe(200);
    expect(initialLedger.json()).toMatchObject({
      system_id: FIXTURE_CANDIDATE_ID,
      trading_run_id: candidate.json().runtime.ref.id,
      ledger: {
        ledger_kind: "ledger",
        has_activity: false,
        chain_complete: false
      }
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
      payload: validLedgerInput(candidateVersionId)
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
      payload: validLedgerInput(candidateVersionId)
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "recorded",
      system_id: FIXTURE_CANDIDATE_ID,
      trading_run_id: candidate.json().runtime.ref.id,
      order_request: {
        status: "proposed",
        authority_status: "not_submitted"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "paper_stage_only",
        authority_status: "dry_run_only"
      },
      execution_result: {
        stage: "paper",
        execution_mode: "host_local",
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      }
    });

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.json().ledger).toMatchObject({
      ledger_kind: "ledger",
      has_activity: true,
      chain_complete: true,
      latest_order_request: {
        order_request_id: first.json().order_request.order_request_id,
        authority_status: "not_submitted"
      },
      latest_gateway_result: {
        gateway_result_id: first.json().gateway_result.gateway_result_id,
        authority_status: "dry_run_only"
      },
      latest_execution_result: {
        execution_result_id: first.json().execution_result.execution_result_id,
        authority_status: "dry_run_only"
      }
    });

    const projectedLedger = await server.inject({
      method: "GET",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`
    });
    expect(projectedLedger.json().ledger.latest_execution_result.execution_result_id).toBe(
      first.json().execution_result.execution_result_id
    );

    await server.close();
  });

  it("starts a fixture trading run and reads the Ledger through the runtime API", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "started",
      trading_run: {
        lifecycle_status: "running",
        authority_status: "not_live"
      },
      run_control: {
        latest_command: {
          action: "start",
          status: "decided"
        },
        latest_decision: {
          resulting_lifecycle_status: "running"
        },
        latest_audit_event: {
          runtime_lifecycle_status: "running"
        }
      },
      order_request: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0.001",
        limit_price: "60000",
        status: "proposed",
        authority_status: "not_submitted"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "dry_run_allowed",
        authority_status: "dry_run_only"
      },
      execution_result: {
        stage: "paper",
        execution_mode: "host_local",
        status: "dry_run_recorded",
        result_reason: "dry_run_allowed",
        authority_status: "dry_run_only"
      },
      trading_gateway_environment: {
        environment_kind: "trading_gateway_environment",
        runtime_environment: "paper",
        runtime_environment_source: "mlp_policy",
        exchange_environment: "unbound",
        exchange_environment_source: "runtime_binding_policy",
        configuration_status: "configured",
        authority_status: "not_live",
        live_exchange_authority: false,
        order_submission_authority: false,
        live_disabled_reason: "live_gateway_not_enabled_in_mlp"
      },
      ledger: {
        ledger_kind: "ledger",
        has_activity: true,
        chain_complete: true,
        latest_order_request: {
          authority_status: "not_submitted"
        },
        latest_gateway_result: {
          decision_outcome: "dry_run_only",
          authority_status: "dry_run_only"
        },
        latest_execution_result: {
          status: "dry_run_recorded",
          authority_status: "dry_run_only"
        }
      },
      sandbox: {
        adapter_kind: "deterministic_test",
        runtime_ref: { record_kind: "trading_run" },
        lifecycle_status: "stopped",
        authority_status: "not_live"
      },
      transcript: {
        transcript_kind: "trading_run_transcript",
        has_activity: true,
        authority_status: "not_live"
      }
    });
    expect(first.json().sandbox.runtime_ref.id).toBe(first.json().trading_run_id);
    expect(first.json().sandbox.command_evidence[0]).toMatchObject({
      exit_code: 0,
      command: expect.arrayContaining([
        "python3",
        "fixtures/trading-systems/clock.py",
        "--instance-id",
        first.json().sandbox.sandbox_id
      ])
    });
    expect(first.json().sandbox.logs[0].lines.join("\n")).toContain("order_request");
    expect(first.json().sandbox.logs[0].lines.join("\n")).toContain("BTCUSDT");
    expect(first.json().sandbox.logs[0].lines.join("\n")).toContain("runtime_heartbeat");
    expect(first.json().sandbox.heartbeats.length).toBeGreaterThan(0);
    expect(first.json().transcript.item_count).toBeGreaterThanOrEqual(10);
    expect(first.json().transcript.items.map((item: { item_kind: string }) => item.item_kind))
      .toEqual(expect.arrayContaining([
        "run_control_command",
        "run_control_decision",
        "run_control_audit",
        "sandbox_lifecycle",
        "sandbox_heartbeat",
        "sandbox_log",
        "sandbox_order_request",
        "order_request",
        "gateway_result",
        "execution_result"
      ]));

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.json().runtime.runtime_lifecycle_status).toBe("running");
    expect(updatedCandidate.json().runtime.run_control.latest_command).toMatchObject({
      action: "start",
      status: "decided"
    });
    expect(updatedCandidate.json().ledger).toMatchObject({
      ledger_kind: "ledger",
      chain_complete: true,
      latest_execution_result: {
        execution_result_id: first.json().execution_result.execution_result_id
      }
    });
    const tradingRunId = updatedCandidate.json().runtime.ref.id;
    expect(updatedCandidate.json().runtime.sandbox).toMatchObject({
      sandbox_id: first.json().sandbox.sandbox_id,
      adapter_kind: "deterministic_test",
      runtime_ref: { id: tradingRunId },
      lifecycle_status: "stopped"
    });
    expect(updatedCandidate.json().runtime.transcript).toMatchObject({
      authority_status: "not_live"
    });
    expect(updatedCandidate.json().runtime.transcript.item_count).toBeGreaterThanOrEqual(10);

    const runDetail = await server.inject({
      method: "GET",
      url: `/api/trading-runs/${tradingRunId}`
    });
    expect(runDetail.statusCode).toBe(200);
    expect(runDetail.json()).toMatchObject({
      trading_run_id: tradingRunId,
      trading_run: {
        ref: { record_kind: "trading_run", id: tradingRunId },
        stage: "paper",
        lifecycle_status: "running",
        authority_status: "not_live"
      },
      ledger: {
        ledger_kind: "ledger",
        chain_complete: true
      },
      run_control: {
        latest_command: {
          action: "start"
        }
      },
      sandbox: {
        sandbox_id: first.json().sandbox.sandbox_id,
        lifecycle_status: "stopped"
      },
      transcript: {
        authority_status: "not_live"
      }
    });
    expect(runDetail.json().transcript.item_count).toBeGreaterThanOrEqual(10);

    const observed = await server.inject({
      method: "POST",
      url: `/api/trading-runs/${tradingRunId}/observe`
    });
    expect(observed.statusCode).toBe(200);
    expect(observed.json()).toMatchObject({
      status: "observed",
      trading_run_id: tradingRunId,
      trading_run: {
        lifecycle_status: "running"
      },
      run_control: {
        latest_command: {
          action: "start"
        }
      },
      ledger: {
        chain_complete: true
      },
      sandbox: {
        lifecycle_status: "stopped",
        authority_status: "not_live"
      },
      transcript: {
        authority_status: "not_live"
      }
    });
    expect(observed.json().transcript.item_count).toBeGreaterThanOrEqual(10);
    expect(observed.json().transcript.items
      .some((item: { item_kind: string; summary: string }) => (
        item.item_kind === "sandbox_order_request" &&
        item.summary.includes("BTCUSDT buy / limit / 0.001 @ 60000")
      )))
      .toBe(true);
    expect(observed.json().sandbox.logs[0].lines.join("\n")).toContain("runtime_heartbeat");

    const stopped = await server.inject({
      method: "POST",
      url: `/api/trading-runs/${tradingRunId}/stop`
    });
    expect(stopped.statusCode).toBe(201);
    expect(stopped.json()).toMatchObject({
      status: "stopped",
      trading_run_id: tradingRunId,
      trading_run: {
        lifecycle_status: "stopped"
      },
      run_control: {
        latest_command: {
          action: "stop",
          status: "decided"
        },
        latest_decision: {
          resulting_lifecycle_status: "stopped"
        },
        latest_audit_event: {
          runtime_lifecycle_status: "stopped"
        }
      },
      sandbox: {
        sandbox_id: first.json().sandbox.sandbox_id,
        lifecycle_status: "stopped",
        authority_status: "not_live"
      },
      transcript: {
        has_activity: true
      }
    });
    expect(stopped.json().sandbox.logs.at(-1).lines.join("\n")).toContain("runtime_stopped");
    expect(stopped.json().transcript.items.map((item: { item_kind: string }) => item.item_kind))
      .toContain("run_control_audit");
    expect(stopped.json().transcript.items
      .some((item: { summary: string }) => item.summary.includes("runtime_stopped")))
      .toBe(true);

    await server.close();
  });

  it("rejects disabled live Gateway binding requests with the stable MLP reason", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`,
      payload: { runtime_environment: "live" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "gateway_runtime_binding_disabled",
      reason: "live_gateway_not_enabled_in_mlp",
      runtime_environment: "live"
    });

    await server.close();
  });

  it("exposes Codex-first trading research runtime config and lets full-cycle runs select it", async () => {
    const selectedAgents: TradingResearchRuntimeAgent[] = [];
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchRuntimeConfig: {
        default_agent: "codex",
        available_agents: ["codex", "fixture"],
        iterations: 2,
        codex: {
          command: "codex-test-bin",
          model: "test-model",
          timeout_ms: 30_000,
          reasoning_effort: "medium"
        }
      },
      tradingResearchProbeExecFile: async (_file, args) => {
        expect(args).toEqual(["--version"]);
        return { stdout: "codex-cli 0.130.0\n", stderr: "" };
      },
      tradingResearchAgentFactory: (agent) => {
        selectedAgents.push(agent);
        return agent === "codex"
          ? new ScriptedCodexTradingResearchAgentAdapter()
          : new ScriptedFixtureTradingResearchAgentAdapter();
      },
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const runtime = await server.inject({
      method: "GET",
      url: "/api/trading-research/runtime"
    });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json()).toMatchObject({
      trading_research_runtime: {
        default_agent: "codex",
        available_agents: ["codex", "fixture"],
        iterations: 2,
        agents: [
          {
            agent: "codex",
            provider: "codex",
            readiness_status: "active_verified",
            command: "codex-test-bin",
            model: "test-model",
            reasoning_effort: "medium",
            version: "codex-cli 0.130.0"
          },
          {
            agent: "fixture",
            provider: "fixture",
            readiness_status: "active_verified"
          }
        ]
      }
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`,
      payload: {
        research_agent: "codex",
        research_iterations: 1
      }
    });

    expect(response.statusCode).toBe(201);
    expect(selectedAgents).toEqual(["codex"]);
    expect(response.json()).toMatchObject({
      status: "completed",
      agent_research: {
        agent: {
          provider: "codex",
          permission_policy: "artifact_workspace_only"
        }
      },
      trading_gateway_environment: {
        authority_status: "not_live"
      }
    });

    await server.close();
  });

  it("rejects invalid trading research full-cycle selection input", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const invalidAgent = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`,
      payload: { research_agent: "open-code" }
    });
    expect(invalidAgent.statusCode).toBe(400);
    expect(invalidAgent.json()).toMatchObject({
      error: "invalid_research_agent",
      allowed_values: ["codex", "fixture"]
    });

    const invalidIterations = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`,
      payload: { research_iterations: 0 }
    });
    expect(invalidIterations.statusCode).toBe(400);
    expect(invalidIterations.json()).toMatchObject({
      error: "invalid_research_iterations",
      allowed_range: "1..10"
    });

    await server.close();
  });

  it("creates and ranks Candidate Arena candidates by net revenue", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchRuntimeConfig: {
        default_agent: "fixture",
        available_agents: ["fixture"],
        iterations: 1,
        codex: {
          command: "codex",
          timeout_ms: 30_000,
          reasoning_effort: "low"
        }
      }
    });

    const tick = await server.inject({
      method: "POST",
      url: "/api/candidate-arena/tick"
    });
    expect(tick.statusCode).toBe(201);
    expect(tick.json()).toMatchObject({
      status: "completed",
      created_candidate_count: 5,
      arena: {
        arena_kind: "candidate_arena",
        runner_status: "stopped",
        tick_count: 1,
        authority_status: "not_live"
      }
    });

    const arena = tick.json().arena;
    expect(arena.latest_ticks).toHaveLength(1);
    expect(arena.latest_ticks[0]).toMatchObject({
      tick_id: "tick-1",
      status: "completed",
      created_candidate_ids: expect.arrayContaining(arena.leaderboard.map(
        (entry: { candidate_id: string }) => entry.candidate_id
      )),
      authority_status: "not_live"
    });
    expect(arena.active_researchers.map((researcher: { direction_kind: string }) => researcher.direction_kind)).toEqual([
      "trend_following",
      "mean_reversion",
      "volatility_regime",
      "funding_aware_risk",
      "execution_cost_robustness"
    ]);
    expect(arena.leaderboard).toHaveLength(5);
    expect(arena.leaderboard[0]).toMatchObject({
      rank: 1,
      status: "accepted",
      profit_loss: {
        net_revenue_usdt: expect.any(Number),
        net_return_pct: expect.any(Number)
      }
    });
    expect(arena.leaderboard[0].profit_loss.net_revenue_usdt)
      .toBeGreaterThanOrEqual(arena.leaderboard.at(-1).profit_loss.net_revenue_usdt);
    expect(arena.leaderboard.some((entry: { profit_loss: { net_revenue_usdt: number } }) =>
      entry.profit_loss.net_revenue_usdt < 0
    )).toBe(true);

    const fetched = await server.inject({
      method: "GET",
      url: "/api/candidate-arena"
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().candidate_arena.leaderboard.map((entry: { rank: number }) => entry.rank))
      .toEqual([1, 2, 3, 4, 5]);
    expect(fetched.json().candidate_arena.latest_ticks[0]).toMatchObject({
      tick_id: "tick-1",
      status: "completed"
    });

    await server.close();
  });

  it("runs Candidate Arena actions through the shared Ouroboros command endpoint and operator read model", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchRuntimeConfig: {
        default_agent: "fixture",
        available_agents: ["fixture"],
        iterations: 1,
        codex: {
          command: "codex",
          timeout_ms: 30_000,
          reasoning_effort: "low"
        }
      },
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const initialOperator = await server.inject({
      method: "GET",
      url: "/api/operator"
    });
    expect(initialOperator.statusCode).toBe(200);
    expect(initialOperator.json()).toMatchObject({
      operator: {
        command_descriptors: expect.arrayContaining(
          OUROBOROS_COMMAND_KINDS.map((commandKind) => expect.objectContaining({
            command_kind: commandKind
          }))
        ),
        candidate_arena: {
          runner_status: "stopped",
          tick_count: 0,
          authority_status: "not_live"
        },
        selected_candidate_id: null,
        selected_candidate: null,
        selected_paper_evidence: {
          status: "not_run",
          authority_status: "not_live"
        },
        researcher_provider: {
          selected_provider: "fixture",
          available_providers: expect.arrayContaining(["fixture", "codex"])
        },
        agent_profiles: expect.arrayContaining([
          expect.objectContaining({
            profile_id: "codex",
            provider: "codex",
            status: "not_configured"
          }),
          expect.objectContaining({
            profile_id: "fixture",
            provider: "fixture",
            status: "authenticated"
          })
        ]),
        latest_commands: []
      }
    });

    const tick = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: { command_kind: "arena.tick" }
    });
    expect(tick.statusCode, JSON.stringify(tick.json())).toBe(200);
    expect(tick.json()).toMatchObject({
      command: {
        command_kind: "arena.tick",
        status: "succeeded"
      },
      result: {
        created_candidate_count: 5,
        arena: {
          tick_count: 1,
          authority_status: "not_live"
        }
      },
      operator: {
        candidate_arena: {
          tick_count: 1
        }
      }
    });

    const candidateId = tick.json().result.created_candidate_ids[0] as string;
    const selected = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "candidate.select",
        payload: { candidate_id: candidateId }
      }
    });
    expect(selected.statusCode, JSON.stringify(selected.json())).toBe(200);
    expect(selected.json()).toMatchObject({
      command: {
        command_kind: "candidate.select",
        status: "succeeded"
      },
      operator: {
        selected_candidate_id: candidateId,
        selected_candidate: {
          candidate_id: candidateId
        },
        selected_paper_evidence: {
          status: "not_run",
          ledger_chain_complete: false,
          authority_status: "not_live"
        }
      }
    });

    const paperEvidence = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "candidate.paper_evidence.run",
        payload: { candidate_id: candidateId }
      }
    });
    expect(paperEvidence.statusCode, JSON.stringify(paperEvidence.json())).toBe(200);
    expect(paperEvidence.json()).toMatchObject({
      command: {
        command_kind: "candidate.paper_evidence.run",
        status: "succeeded"
      },
      operator: {
        selected_candidate_id: candidateId,
        selected_paper_evidence: {
          status: "ledger_chain_complete",
          ledger_chain_complete: true,
          ledger_chain_count: 1,
          latest_gateway_outcome: "dry_run_only",
          latest_execution_status: "dry_run_recorded",
          authority_status: "not_live"
        }
      }
    });

    const operator = await server.inject({
      method: "GET",
      url: "/api/operator"
    });
    expect(operator.statusCode).toBe(200);
    expect(operator.json().operator.latest_commands.map(
      (command: { command_kind: string }) => command.command_kind
    )).toEqual([
      "candidate.paper_evidence.run",
      "candidate.select",
      "arena.tick"
    ]);

    await server.close();
  });

  it("sets up and probes managed Codex agent profiles without using the host Codex home", async () => {
    const execCalls: Array<{
      file: string;
      args: string[];
      env?: NodeJS.ProcessEnv;
    }> = [];
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      agentProfileExecFile: async (file, args, options) => {
        execCalls.push({ file, args, env: options?.env });
        return {
          stdout: args.includes("--version") ? "codex 1.2.3\n" : "Logged in as managed researcher\n",
          stderr: ""
        };
      }
    });

    const setup = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.setup",
        payload: { provider: "codex" }
      }
    });
    expect(setup.statusCode, JSON.stringify(setup.json())).toBe(200);
    expect(setup.json()).toMatchObject({
      command: {
        command_kind: "agent_provider.setup",
        status: "succeeded"
      },
      result: {
        profile: {
          profile_id: "codex",
          provider: "codex",
          status: "configured"
        }
      }
    });

    const probe = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.probe",
        payload: { provider: "codex" }
      }
    });
    expect(probe.statusCode, JSON.stringify(probe.json())).toBe(200);
    expect(probe.json()).toMatchObject({
      command: {
        command_kind: "agent_provider.probe",
        status: "succeeded"
      },
      result: {
        profile: {
          profile_id: "codex",
          provider: "codex",
          status: "authenticated",
          version: "codex 1.2.3"
        }
      }
    });
    expect(execCalls).toEqual([
      expect.objectContaining({
        file: "codex",
        args: ["--version"],
        env: expect.objectContaining({
          CODEX_HOME: path.join(tmpDir, "agent-profiles", "codex", "codex-home"),
          HOME: path.join(tmpDir, "agent-profiles", "codex", "home")
        })
      }),
      expect.objectContaining({
        file: "codex",
        args: ["login", "status"],
        env: expect.objectContaining({
          CODEX_HOME: path.join(tmpDir, "agent-profiles", "codex", "codex-home"),
          HOME: path.join(tmpDir, "agent-profiles", "codex", "home")
        })
      })
    ]);
    expect(execCalls.every((call) => call.env?.CODEX_HOME !== process.env.CODEX_HOME)).toBe(true);

    await server.close();
  });

  it("keeps managed agent login local to the CLI instead of exposing it through commands", async () => {
    const execCalls: string[] = [];
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      agentProfileExecFile: async (file, args) => {
        execCalls.push(`${file} ${args.join(" ")}`);
        return {
          stdout: "",
          stderr: ""
        };
      }
    });

    const login = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.login.start",
        payload: { provider: "codex" }
      }
    });

    expect(login.statusCode).toBe(403);
    expect(login.json()).toMatchObject({
      error: "agent_provider_login_requires_local_cli",
      provider: "codex",
      required_command: "ouroboros agent login codex",
      command: {
        command_kind: "agent_provider.login.start",
        status: "failed"
      }
    });
    expect(execCalls).toEqual([]);

    await server.close();
  });

  it("rejects future agent providers explicitly instead of treating them as Codex", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir)
    });

    const setup = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.setup",
        payload: {
          provider: "claude_code"
        }
      }
    });
    expect(setup.statusCode).toBe(422);
    expect(setup.json()).toMatchObject({
      error: "unsupported_agent_provider",
      provider: "claude_code",
      supported_providers: ["codex", "fixture"]
    });

    await server.close();
  });

  it("lets the researcher select one authenticated provider from available agent providers", async () => {
    const selectedAgents: string[] = [];
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      agentProfileExecFile: async (_file, args) => ({
        stdout: args.includes("--version") ? "codex 1.2.3\n" : "Logged in as managed researcher\n",
        stderr: ""
      }),
      tradingResearchRuntimeConfig: {
        default_agent: "fixture",
        available_agents: ["codex", "fixture"],
        iterations: 1,
        codex: {
          command: "codex",
          timeout_ms: 30_000,
          reasoning_effort: "low"
        }
      },
      tradingResearchAgentFactory: (agent) => {
        selectedAgents.push(agent);
        return new ScriptedCodexTradingResearchAgentAdapter();
      }
    });

    const setup = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.setup",
        payload: { provider: "codex" }
      }
    });
    expect(setup.statusCode).toBe(200);

    const selectBeforeAuth = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "researcher.provider.select",
        payload: { provider: "codex" }
      }
    });
    expect(selectBeforeAuth.statusCode).toBe(409);
    expect(selectBeforeAuth.json()).toMatchObject({
      error: "agent_provider_not_authenticated",
      provider: "codex",
      profile_status: "configured",
      required_command: "ouroboros agent login codex"
    });

    const probe = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "agent_provider.probe",
        payload: { provider: "codex" }
      }
    });
    expect(probe.statusCode, JSON.stringify(probe.json())).toBe(200);

    const select = await server.inject({
      method: "POST",
      url: "/api/commands",
      payload: {
        command_kind: "researcher.provider.select",
        payload: { provider: "codex" }
      }
    });
    expect(select.statusCode, JSON.stringify(select.json())).toBe(200);
    expect(select.json()).toMatchObject({
      command: {
        command_kind: "researcher.provider.select",
        status: "succeeded"
      },
      operator: {
        researcher_provider: {
          selected_provider: "codex",
          available_providers: expect.arrayContaining(["codex", "fixture"])
        }
      }
    });

    const tick = await server.inject({
      method: "POST",
      url: "/api/candidate-arena/tick"
    });
    expect(tick.statusCode).toBe(201);
    expect(selectedAgents).toContain("codex");

    await server.close();
  });

  it("persists Candidate Arena tick history while keeping successful directions when one researcher fails", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new MeanReversionThrowingTradingResearchAgentAdapter()
    }, "stopped", 1);

    expect(outcome).toMatchObject({
      status: "completed",
      created_candidate_count: 1,
      created_candidate_ids: [expect.any(String)],
      arena: {
        latest_ticks: [
          {
            status: "completed_with_errors",
            created_candidate_ids: [expect.any(String)],
            direction_results: [
              {
                direction_kind: "trend_following",
                status: "created",
                candidate_id: expect.any(String)
              },
              {
                direction_kind: "mean_reversion",
                status: "failed",
                error: "fixture_direction_failed"
              }
            ],
            authority_status: "not_live"
          }
        ]
      }
    });
    expect(outcome.arena.leaderboard).toHaveLength(1);
    expect(outcome.arena.active_researchers.find(
      (researcher) => researcher.direction_kind === "mean_reversion"
    )?.status).toBe("failed");

    const reloadedStore = new LocalStore(tmpDir);
    await reloadedStore.initialize();
    const reloadedArena = await buildCandidateArenaReadModel(reloadedStore, "stopped", 0);
    expect(reloadedArena.latest_ticks[0]).toMatchObject({
      status: "completed_with_errors",
      created_candidate_ids: outcome.created_candidate_ids
    });
  });

  it("runs Candidate Arena research directions concurrently before recording outcomes", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    let activeEdits = 0;
    let maxActiveEdits = 0;

    const outcome = await runCandidateArenaTick({
      store,
      directions: ["trend_following", "mean_reversion"],
      researchAgent: "codex",
      agentFactory: () => new ConcurrentScriptedTradingResearchAgentAdapter({
        onEditStart() {
          activeEdits += 1;
          maxActiveEdits = Math.max(maxActiveEdits, activeEdits);
        },
        onEditEnd() {
          activeEdits -= 1;
        }
      })
    }, "stopped", 1);

    expect(maxActiveEdits).toBeGreaterThan(1);
    expect(outcome.created_candidate_count).toBe(2);
    expect(outcome.arena.latest_ticks[0]).toMatchObject({
      status: "completed",
      created_candidate_ids: expect.arrayContaining(outcome.created_candidate_ids)
    });
  });

  it("starts and stops one in-memory Candidate Arena runner idempotently", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });

    const firstStart = await server.inject({ method: "POST", url: "/api/candidate-arena/start" });
    const secondStart = await server.inject({ method: "POST", url: "/api/candidate-arena/start" });
    const stop = await server.inject({ method: "POST", url: "/api/candidate-arena/stop" });

    expect(firstStart.statusCode).toBe(202);
    expect(secondStart.statusCode).toBe(202);
    expect(secondStart.json()).toMatchObject({
      status: "already_running",
      candidate_arena: {
        runner_status: "running"
      }
    });
    expect(stop.statusCode).toBe(202);
    expect(stop.json()).toMatchObject({
      status: "stopped",
      candidate_arena: {
        runner_status: "stopped"
      }
    });
    await waitForCondition(async () => (await store.listCandidateArenaTicks()).length === 1);

    await server.close();
  });

  it("starts the Candidate Arena runner by scheduling an immediate first tick", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const runner = new CandidateArenaRunner({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new ScriptedCodexTradingResearchAgentAdapter()
    }, 30_000);

    expect(runner.start()).toBe("started");
    await waitForCondition(async () => (await store.listCandidateArenaTicks()).length === 1);

    expect(runner.status()).toBe("running");
    expect(runner.ticks()).toBe(1);
    expect((await store.listCandidateArenaTicks())[0]).toMatchObject({
      tick_id: "tick-1",
      status: "completed",
      authority_status: "not_live"
    });
    expect(runner.stop()).toBe("stopped");
  });

  it("stops the Candidate Arena runner before the next scheduled tick", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const runner = new CandidateArenaRunner({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new ScriptedCodexTradingResearchAgentAdapter()
    }, 1_000);

    expect(runner.start()).toBe("started");
    await waitForCondition(async () => (await store.listCandidateArenaTicks()).length === 1);
    expect(runner.stop()).toBe("stopped");
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(runner.status()).toBe("stopped");
    expect(runner.ticks()).toBe(1);
    expect(await store.listCandidateArenaTicks()).toHaveLength(1);
  });

  it("records paper Gateway and Ledger evidence only after an arena candidate is selected", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const tick = await server.inject({
      method: "POST",
      url: "/api/candidate-arena/tick"
    });

    expect(tick.statusCode).toBe(201);
    expect(tick.json().created_candidate_count).toBeGreaterThan(0);
    const candidateId = tick.json().created_candidate_ids[0] as string;

    const beforeRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}`
    });
    expect(beforeRun.statusCode).toBe(200);
    expect(beforeRun.json().ledger).toMatchObject({
      has_activity: false,
      chain_count: 0
    });

    const run = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${candidateId}/trading-runs`
    });

    expect(run.statusCode, JSON.stringify(run.json())).toBe(201);
    expect(run.json()).toMatchObject({
      trading_run: {
        authority_status: "not_live"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        authority_status: "dry_run_only"
      },
      execution_result: {
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      },
      ledger: {
        ledger_kind: "ledger",
        chain_complete: true,
        authority_status: "not_live"
      },
      trading_gateway_environment: {
        authority_status: "not_live",
        live_exchange_authority: false,
        order_submission_authority: false
      }
    });

    const afterRun = await server.inject({
      method: "GET",
      url: `/api/candidates/${candidateId}`
    });
    expect(afterRun.statusCode).toBe(200);
    expect(afterRun.json()).toMatchObject({
      ledger: {
        latest_order_request: {
          order_request_id: run.json().ledger.latest_order_request.order_request_id
        },
        latest_gateway_result: {
          gateway_result_id: run.json().ledger.latest_gateway_result.gateway_result_id
        },
        latest_execution_result: {
          execution_result_id: run.json().ledger.latest_execution_result.execution_result_id
        }
      },
      runtime: {
        authority_status: "not_live"
      }
    });

    const arena = await server.inject({
      method: "GET",
      url: "/api/candidate-arena"
    });
    expect(arena.statusCode).toBe(200);
    expect(arena.json().candidate_arena).toMatchObject({
      authority_status: "not_live",
      live_disabled: true,
      leaderboard: expect.arrayContaining([
        expect.objectContaining({
          candidate_id: candidateId,
          authority_status: "not_live"
        })
      ])
    });

    await server.close();
  });

  it("feeds selected paper evidence and findings into the next Candidate Arena research context", async () => {
    const store = new LocalStore(tmpDir);
    await store.initialize();
    const tick = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => new ScriptedCodexTradingResearchAgentAdapter()
    }, "stopped", 1);
    expect(
      tick.created_candidate_count,
      JSON.stringify(tick.arena.latest_ticks[0]?.direction_results)
    ).toBe(1);
    const candidateId = tick.created_candidate_ids[0]!;

    const server = await buildServer({
      store,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const run = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${candidateId}/trading-runs`
    });
    expect(run.statusCode, JSON.stringify(run.json())).toBe(201);
    expect(run.json().ledger.chain_complete).toBe(true);

    const capturingAdapter = new CapturingScriptedTradingResearchAgentAdapter();
    const nextTick = await runCandidateArenaTick({
      store,
      directions: ["trend_following"],
      researchAgent: "codex",
      agentFactory: () => capturingAdapter
    }, "stopped", 2);

    expect(nextTick.status).toBe("completed");
    const context = JSON.parse(capturingAdapter.lastArenaContext ?? "{}");
    expect(context.latest_findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: candidateId,
        finding: expect.any(String)
      })
    ]));
    expect(context.selected_paper_evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        candidate_id: candidateId,
        ledger_chain_complete: true,
        ledger_chain_count: 1,
        latest_order_request_id: run.json().ledger.latest_order_request.order_request_id,
        latest_gateway_outcome: "dry_run_only",
        latest_execution_status: "dry_run_recorded",
        authority_status: "not_live"
      })
    ]));

    await server.close();
  });

  it("runs an agent-generated Trading System through backtest and paper trading in one visible cycle", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toMatchObject({
      status: "completed",
      agent_research: {
        session_id: first.json().agent_research.session_id,
        agent: {
          provider: "fixture"
        }
      },
      system_code_handoff: {
        system_code_id: first.json().system_code_handoff.system_code_id,
        generated_by_agent: true
      },
      next_trading_system: {
        candidate_id: first.json().next_trading_system.candidate_id
      },
      ledger: {
        latest_order_request: {
          order_request_id: first.json().ledger.latest_order_request.order_request_id
        },
        latest_gateway_result: {
          gateway_result_id: first.json().ledger.latest_gateway_result.gateway_result_id
        },
        latest_execution_result: {
          execution_result_id: first.json().ledger.latest_execution_result.execution_result_id
        }
      }
    });
    expect(first.json()).toMatchObject({
      status: "completed",
      source_system_id: FIXTURE_CANDIDATE_ID,
      agent_research: {
        agent: {
          provider: "fixture",
          permission_policy: "fixture_only"
        },
        best_score: 1,
        latest_decision: "keep"
      },
      system_code_handoff: {
        generated_by_agent: true,
        runtime_kind: "python",
        declared_output_kinds: expect.arrayContaining(["order_request"]),
        authority_status: "not_live"
      },
      backtest: {
        status: "accepted",
        score: 1,
        risk_decision: "valid_order_request",
        scenario_results: [
          expect.objectContaining({ scenario_id: "trend_long", status: "accepted" }),
          expect.objectContaining({ scenario_id: "range_flat", status: "accepted" })
        ]
      },
      next_trading_system: {
        status: "materialized",
        spec: {
          market: "Binance USD-M Futures",
          instrument: "BTCUSDT"
        },
        system_code: {
          declared_runtime: "python"
        }
      },
      trading_run: {
        lifecycle_status: "running",
        authority_status: "not_live"
      },
      paper_trading: {
        run_status: "completed",
        provider_request_count: expect.any(Number),
        authority_status: "not_live"
      },
      gateway_result: {
        decision_outcome: "dry_run_only",
        decision_reason: "dry_run_allowed",
        authority_status: "dry_run_only"
      },
      execution_result: {
        status: "dry_run_recorded",
        authority_status: "dry_run_only"
      },
      ledger: {
        ledger_kind: "ledger",
        chain_complete: true
      },
      full_cycle_lineage: {
        handoff_status: "runnable",
        source: {
          trading_system_id: FIXTURE_CANDIDATE_ID,
          system_code_ref: {
            record_kind: "system_code",
            id: FIXTURE_SYSTEM_CODE_ID
          }
        },
        generated: {
          generated_by_agent: true,
          system_code_ref: {
            record_kind: "system_code"
          }
        },
        materialized: {
          system_code_ref: {
            record_kind: "system_code"
          }
        },
        evidence: {
          evaluation_status: "accepted",
          trading_run_id: expect.any(String),
          gateway_result_outcome: "dry_run_only",
          ledger_chain_complete: true
        }
      },
      trading_gateway_environment: {
        authority_status: "not_live",
        live_exchange_authority: false,
        order_submission_authority: false
      }
    });
    expect(first.json().next_trading_system.candidate_id).not.toBe(FIXTURE_CANDIDATE_ID);
    expect(first.json().next_trading_system.system_code.ref.id).toBe(
      first.json().system_code_handoff.system_code_id
    );
    expect(first.json().full_cycle_lineage.generated.system_code_ref.id).toBe(
      first.json().system_code_handoff.system_code_id
    );
    expect(first.json().full_cycle_lineage.materialized.trading_system_id).toBe(
      first.json().next_trading_system.candidate_id
    );
    expect(first.json().full_cycle_lineage.materialized.system_code_ref.id).toBe(
      first.json().system_code_handoff.system_code_id
    );
    expect(first.json().paper_trading.provider_request_count).toBeGreaterThanOrEqual(3);

    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${first.json().next_trading_system.candidate_id}`
    });
    expect(candidate.statusCode).toBe(200);
    expect(candidate.json()).toMatchObject({
      candidate_id: first.json().next_trading_system.candidate_id,
      system_code: {
        ref: {
          id: first.json().system_code_handoff.system_code_id
        }
      },
      evaluation: {
        has_runs: true,
        latest_run: {
          status: "created",
          authority_status: "not_counted"
        }
      },
      runtime: {
        runtime_lifecycle_status: "running",
        transcript: {
          has_activity: true
        }
      },
      ledger: {
        chain_complete: true
      },
      full_cycle_lineage: {
        handoff_status: "runnable",
        source: {
          trading_system_id: FIXTURE_CANDIDATE_ID,
          candidate_version_id: "fixture-candidate-version-001",
          system_code_ref: {
            record_kind: "system_code",
            id: FIXTURE_SYSTEM_CODE_ID
          }
        },
        generated: {
          system_code_ref: {
            record_kind: "system_code",
            id: first.json().system_code_handoff.system_code_id
          },
          artifact_digest: first.json().system_code_handoff.artifact_digest,
          generated_by_agent: true
        },
        materialized: {
          trading_system_id: first.json().next_trading_system.candidate_id,
          candidate_version_id: first.json().next_trading_system.candidate_version.candidate_version_id,
          system_code_ref: {
            record_kind: "system_code",
            id: first.json().system_code_handoff.system_code_id
          }
        },
        evidence: {
          evaluation_status: "accepted",
          evaluation_score: 1,
          trading_run_id: first.json().next_trading_system.runtime.ref.id,
          gateway_result_outcome: "dry_run_only",
          ledger_chain_complete: true
        }
      }
    });
    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.json().candidates.map((item: { candidate_id: string }) => item.candidate_id))
      .toContain(first.json().next_trading_system.candidate_id);

    await server.close();
  });

  it("preserves source-to-next full-cycle lineage when running another cycle", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    expect(first.statusCode).toBe(201);

    const second = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${first.json().next_trading_system.candidate_id}/full-cycle-runs`
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().full_cycle_lineage).toMatchObject({
      handoff_status: "runnable",
      source: {
        trading_system_id: first.json().next_trading_system.candidate_id,
        system_code_ref: {
          record_kind: "system_code",
          id: first.json().system_code_handoff.system_code_id
        }
      },
      materialized: {
        system_code_ref: {
          record_kind: "system_code",
          id: second.json().system_code_handoff.system_code_id
        }
      },
      evidence: {
        ledger_chain_complete: true
      }
    });
    expect(second.json().next_trading_system.candidate_id).not.toBe(
      first.json().next_trading_system.candidate_id
    );
    expect(second.json().ledger.chain_count).toBe(1);
    expect(first.json().ledger.chain_count).toBe(1);
    expect(second.json().ledger.latest_order_request.order_request_id).not.toBe(
      first.json().ledger.latest_order_request.order_request_id
    );

    const secondCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${second.json().next_trading_system.candidate_id}`
    });
    expect(secondCandidate.statusCode).toBe(200);
    expect(secondCandidate.json().full_cycle_lineage).toMatchObject({
      handoff_status: "runnable",
      source: {
        trading_system_id: first.json().next_trading_system.candidate_id,
        candidate_version_id: first.json().next_trading_system.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: first.json().system_code_handoff.system_code_id
        }
      },
      materialized: {
        trading_system_id: second.json().next_trading_system.candidate_id,
        candidate_version_id: second.json().next_trading_system.candidate_version.candidate_version_id,
        system_code_ref: {
          record_kind: "system_code",
          id: second.json().system_code_handoff.system_code_id
        }
      },
      evidence: {
        ledger_chain_complete: true
      }
    });

    await server.close();
  });

  it("seeds full-cycle research from the selected Trading System SystemCode artifact", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({
      store,
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });
    const sourceArtifactDir = path.join(tmpDir, "source-trading-system-artifact");
    await cp(path.join(process.cwd(), "artifacts/trading-system"), sourceArtifactDir, { recursive: true });
    const sourceRunPath = path.join(sourceArtifactDir, "run.py");
    const sourceRun = await readFile(sourceRunPath, "utf8");
    const markedSource = sourceRun.replace(
      "RISK_FRACTION = 0.01",
      "RISK_FRACTION = 0.03\nSOURCE_SYSTEM_MARKER = 'lineage-source-artifact'"
    );
    await writeFile(sourceRunPath, markedSource, "utf8");
    const artifactDigest = createHash("sha256").update(markedSource).digest("hex");
    const sourceSystemCodeId = "system-code-source-lineage-test";
    await store.recordSystemCode({
      record_kind: "system_code",
      version: 1,
      system_code_id: sourceSystemCodeId,
      artifact_kind: "python_file",
      artifact_path: sourceArtifactDir,
      artifact_digest: `sha256:${artifactDigest}`,
      runtime_kind: "python",
      entrypoint: ["python3", "run.py"],
      declared_output_contract: {
        contract_kind: "opaque_runtime_boundary",
        declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
      },
      secret_policy_ref: { record_kind: "secret_policy", id: "secret-policy-no-raw-values-v1" },
      capability_policy_ref: { record_kind: "capability_policy", id: "capability-policy-test-lineage" },
      provenance_refs: [{ record_kind: "provider_output_artifact", id: "source-lineage-artifact" }],
      status: "registered",
      created_at: "2026-05-24T00:00:00.000Z",
      authority_status: "not_live"
    });
    const materializationInput = validMaterializationInput();
    const materialized = await store.materializeCandidate({
      ...materializationInput,
      idempotency_key: "runtime-source-artifact-lineage-001",
      provider: {
        ...materializationInput.provider,
        agent_run_id: "agent-run-source-artifact-lineage-001",
        agent_event_id: "agent-event-source-artifact-lineage-001",
        trace_id: "trace-source-artifact-lineage-001",
        output_artifact_hash: `sha256:${artifactDigest}`
      },
      candidate: {
        ...materializationInput.candidate,
        title: "Source lineage Trading System",
        system_summary: "Trading System with a unique source SystemCode marker."
      },
      artifact_refs: [{ record_kind: "system_code", id: sourceSystemCodeId }],
      system_code_ref: { record_kind: "system_code", id: sourceSystemCodeId }
    });
    expect(materialized.status).toBe("materialized");
    if (materialized.status !== "materialized") {
      throw new Error("source lineage materialization failed");
    }

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${materialized.candidate.candidate_id}/full-cycle-runs`
    });
    expect(response.statusCode).toBe(201);
    const generatedSource = await readFile(response.json().system_code_handoff.artifact_path, "utf8");
    expect(generatedSource).toContain("SOURCE_SYSTEM_MARKER = 'lineage-source-artifact'");
    expect(generatedSource).toContain("RISK_FRACTION = 0.02");

    await server.close();
  });

  it("reports the backtest for the materialized best full-cycle artifact", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchIterations: 2,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      agent_research: {
        best_score: 1,
        latest_decision: "discard"
      },
      backtest: {
        status: "accepted",
        score: 1,
        risk_decision: "valid_order_request"
      }
    });

    await server.close();
  });

  it("rejects unsupported paper order request choices on full-cycle agent runs", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`,
      payload: { paper_order_request: "rejected" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "invalid_paper_order_request",
      allowed_values: ["valid"]
    });

    await server.close();
  });

  it("returns a structured full-cycle failure when Binance paper market snapshot is unavailable", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchIterations: 1,
      binancePublicMarketClient: failingBinancePublicMarketClient()
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "full_cycle_failed",
      reason: "binance_public_market_snapshot_unavailable:binance public market unavailable",
      full_cycle_lineage: {
        handoff_status: "blocked",
        blocked_stage: "paper_trading",
        blocked_reason: "binance_public_market_snapshot_unavailable:binance public market unavailable",
        source: {
          trading_system_id: FIXTURE_CANDIDATE_ID,
          system_code_ref: {
            record_kind: "system_code",
            id: FIXTURE_SYSTEM_CODE_ID
          }
        }
      }
    });

    await server.close();
  });

  it("does not materialize the next Trading System when paper Gateway validation rejects the order", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchAgentAdapter: new RejectedPaperOrderTradingResearchAgentAdapter(),
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "full_cycle_failed",
      reason: "agent_trading_cycle_rejected_paper_order_request",
      full_cycle_lineage: {
        handoff_status: "blocked",
        blocked_stage: "paper_gateway",
        blocked_reason: "agent_trading_cycle_rejected_paper_order_request",
        source: {
          trading_system_id: FIXTURE_CANDIDATE_ID,
          system_code_ref: {
            record_kind: "system_code",
            id: FIXTURE_SYSTEM_CODE_ID
          }
        }
      }
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.json().candidates
      .some((item: { display_name?: string }) => item.display_name === "Agent generated BTCUSDT Trading System"))
      .toBe(false);

    await server.close();
  });

  it("does not materialize the next Trading System when paper validation cannot form a Ledger chain", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      tradingResearchAgentAdapter: new NoOrderRequestTradingResearchAgentAdapter(),
      tradingResearchIterations: 1,
      binancePublicMarketClient: fixtureBinancePublicMarketClient()
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/full-cycle-runs`
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "full_cycle_failed",
      reason: "agent_trading_cycle_missing_order_request"
    });

    const list = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(list.json().candidates
      .some((item: { display_name?: string }) => item.display_name === "Agent generated BTCUSDT Trading System"))
      .toBe(false);

    await server.close();
  });

  it("records a rejected paper order through Gateway validation and Ledger readback", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const happyPath = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`
    });
    const rejected = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`,
      payload: { paper_order_request: "rejected" }
    });
    const duplicateRejected = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/trading-runs`,
      payload: { paper_order_request: "rejected" }
    });

    expect(happyPath.statusCode).toBe(201);
    expect(rejected.statusCode).toBe(201);
    expect(duplicateRejected.statusCode).toBe(201);
    expect(duplicateRejected.json()).toEqual(rejected.json());
    expect(happyPath.json().gateway_result.decision_outcome).toBe("dry_run_only");
    expect(rejected.json().sandbox.sandbox_id).not.toBe(happyPath.json().sandbox.sandbox_id);
    expect(rejected.json()).toMatchObject({
      status: "started",
      trading_run: {
        lifecycle_status: "running",
        authority_status: "not_live"
      },
      order_request: {
        intent_kind: "place_order",
        side: "buy",
        order_type: "limit",
        quantity: "0",
        limit_price: "60000",
        status: "proposed",
        authority_status: "not_submitted"
      },
      gateway_result: {
        decision_outcome: "rejected",
        decision_reason: "risk_limit_exceeded",
        authority_status: "not_live"
      },
      execution_result: {
        stage: "paper",
        execution_mode: "host_local",
        status: "blocked",
        result_reason: "risk_limit_exceeded",
        authority_status: "not_submitted"
      },
      ledger: {
        chain_complete: true,
        latest_gateway_result: {
          decision_outcome: "rejected",
          decision_reason: "risk_limit_exceeded"
        },
        latest_execution_result: {
          status: "blocked",
          result_reason: "risk_limit_exceeded"
        }
      },
      transcript: {
        has_activity: true,
        authority_status: "not_live"
      }
    });
    expect(rejected.json().sandbox.logs[0].lines.join("\n")).toContain("\"quantity\": \"0\"");
    expect(rejected.json().transcript.items
      .some((item: { item_kind: string; summary: string }) => (
        item.item_kind === "sandbox_order_request" &&
        item.summary.includes("BTCUSDT buy / limit / 0 @ 60000")
      )))
      .toBe(true);
    expect(rejected.json().transcript.items
      .some((item: { item_kind: string; summary: string }) => (
        item.item_kind === "gateway_result" &&
        item.summary.includes("rejected / risk_limit_exceeded")
      )))
      .toBe(true);
    expect(rejected.json().transcript.items
      .some((item: { item_kind: string; summary: string }) => (
        item.item_kind === "execution_result" &&
        item.summary.includes("blocked / risk_limit_exceeded")
      )))
      .toBe(true);

    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(candidate.json().ledger.latest_gateway_result.decision_outcome).toBe("rejected");
    expect(candidate.json().ledger.latest_execution_result.status).toBe("blocked");
    expect(candidate.json().runtime.sandbox.sandbox_id).toBe(rejected.json().sandbox.sandbox_id);

    await server.close();
  });

  it("records a fixture AAR improvement and reads it through candidate inspect", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/improvements`
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/improvements`
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json().improvement).toMatchObject({
      improvement_kind: "improvement",
      proposal_chain_complete: true,
      evaluation_chain_complete: true,
      chain_complete: true
    });
    expect(first.json()).toMatchObject({
      status: "evaluated",
      improvement: {
        improvement_kind: "improvement",
        source_model: "automated_alignment_researcher",
        proposal_chain_complete: true,
        evaluation_chain_complete: true,
        chain_complete: true,
        latest_source_finding: {
          authority_status: "research_trace_only"
        },
        latest_change_proposal: {
          status: "proposed",
          authority_status: "proposal_only"
        },
        latest_experiment: {
          status: "evaluated",
          authority_status: "not_live"
        },
        latest_evaluation_result: {
          result_status: "accepted",
          evidence_disposition: "not_counted",
          authority_status: "not_counted"
        },
        evidence: {
          status: "not_sealed",
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
      }
    });

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.statusCode).toBe(200);
    expect(updatedCandidate.json().improvement).toMatchObject({
      improvement_kind: "improvement",
      source_model: "automated_alignment_researcher",
      chain_complete: true,
      latest_change_proposal: {
        proposal_id: first.json().proposal.improvement_proposal_id
      },
      latest_experiment: {
        experiment_id: first.json().experiment.experiment_run_id
      },
      latest_evaluation_result: {
        result_id: first.json().trading_evaluation_result.trading_evaluation_result_id
      }
    });

    await server.close();
  });

  it("returns deterministic Ledger API errors", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/trading-systems/missing/ledger"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "trading_system_not_found",
      system_id: "missing"
    });
    const missingCandidatePost = await server.inject({
      method: "POST",
      url: "/api/trading-systems/missing/run-control",
      payload: validRunControlInput(candidateVersionId)
    });
    expect(missingCandidatePost.statusCode).toBe(404);
    expect(missingCandidatePost.json()).toEqual({
      error: "trading_system_not_found",
      system_id: "missing"
    });

    const missingFields = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
      payload: { candidate_version_id: candidateVersionId }
    });
    expect(missingFields.statusCode).toBe(422);
    expect(missingFields.json()).toMatchObject({
      error: "ledger_record_failed",
      reason: "invalid_ledger_request",
      system_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidOutcome = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
      payload: {
        ...validLedgerInput(candidateVersionId),
        gateway_result: {
          decision_outcome: "live_allowed",
          decision_reason: "paper_stage_only"
        }
      }
    });
    expect(invalidOutcome.statusCode).toBe(422);
    expect(invalidOutcome.json()).toMatchObject({
      error: "ledger_record_failed",
      reason: "invalid_ledger_input",
      system_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/ledger`,
      payload: {
        ...validLedgerInput("missing-candidate-version"),
        candidate_version_id: "missing-candidate-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      error: "ledger_record_failed",
      reason: "candidate_version_not_found",
      system_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: "missing-candidate-version"
    });

    await server.close();
  });

  it("records and reads run control through the runtime API", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const initialControl = await server.inject({
      method: "GET",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`
    });
    expect(initialControl.statusCode).toBe(200);
    expect(initialControl.json()).toMatchObject({
      system_id: FIXTURE_CANDIDATE_ID,
      runtime_id: candidate.json().runtime.ref.id,
      run_control: {
        has_activity: false,
        chain_complete: false
      }
    });

    const first = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: validRunControlInput(candidateVersionId)
    });
    const duplicate = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: validRunControlInput(candidateVersionId)
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.json()).toEqual(first.json());
    expect(first.json()).toMatchObject({
      status: "recorded",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId,
      runtime_id: candidate.json().runtime.ref.id,
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

    const updatedCandidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    expect(updatedCandidate.json().runtime.run_control).toMatchObject({
      has_activity: true,
      chain_complete: true,
      latest_command: {
        command_id: first.json().command.run_control_command_id,
        action: "pause",
        authority_status: "control_only"
      },
      latest_decision: {
        decision_id: first.json().decision.run_control_decision_id,
        decision_outcome: "allowed",
        resulting_lifecycle_status: "paused"
      },
      latest_audit_event: {
        audit_event_id: first.json().audit_event.runtime_audit_event_id,
        event_kind: "runtime_lifecycle_transitioned",
        authority_status: "audit_only"
      }
    });
    expect(updatedCandidate.json().runtime.placement.authority_status).toBe("not_launched");
    expect(JSON.stringify(updatedCandidate.json().runtime.run_control)).not.toMatch(
      /exchange_credentials|provider_api_key|direct_exchange_order|gateway_signing_material/
    );

    const projectedControl = await server.inject({
      method: "GET",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`
    });
    expect(projectedControl.json().run_control.latest_command.command_id).toBe(
      first.json().command.run_control_command_id
    );

    await server.close();
  });

  it("returns deterministic run control API errors", async () => {
    const store = new LocalStore(tmpDir);
    const server = await buildServer({ store });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });
    const candidateVersionId = candidate.json().candidate_version.candidate_version_id;

    const missingCandidate = await server.inject({
      method: "GET",
      url: "/api/trading-systems/missing/run-control"
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "trading_system_not_found",
      system_id: "missing"
    });

    const missingFields = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: { candidate_version_id: candidateVersionId }
    });
    expect(missingFields.statusCode).toBe(422);
    expect(missingFields.json()).toMatchObject({
      error: "run_control_record_failed",
      reason: "invalid_run_control_request",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidAction = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: {
        ...validRunControlInput(candidateVersionId),
        command: {
          ...validRunControlInput(candidateVersionId).command,
          action: "launch_live"
        }
      }
    });
    expect(invalidAction.statusCode).toBe(422);
    expect(invalidAction.json()).toMatchObject({
      error: "run_control_record_failed",
      reason: "invalid_run_control_input",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: candidateVersionId
    });

    const invalidOutcome = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: {
        ...validRunControlInput(candidateVersionId),
        decision: {
          ...validRunControlInput(candidateVersionId).decision,
          decision_outcome: "live_allowed"
        }
      }
    });
    expect(invalidOutcome.statusCode).toBe(422);
    expect(invalidOutcome.json()).toMatchObject({
      reason: "invalid_run_control_input"
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: {
        ...validRunControlInput("missing-candidate-version"),
        candidate_version_id: "missing-candidate-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      reason: "candidate_version_not_found",
      candidate_version_id: "missing-candidate-version"
    });

    const missingRuntime = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: {
        ...validRunControlInput(candidateVersionId),
        runtime_id: "missing-runtime"
      }
    });
    expect(missingRuntime.statusCode).toBe(422);
    expect(missingRuntime.json()).toMatchObject({
      reason: "runtime_not_found",
      candidate_version_id: candidateVersionId
    });

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
    const runtimeMismatch = await server.inject({
      method: "POST",
      url: `/api/trading-systems/${FIXTURE_CANDIDATE_ID}/run-control`,
      payload: {
        ...validRunControlInput(candidateVersionId),
        runtime_id: "foreign-runtime-001"
      }
    });
    expect(runtimeMismatch.statusCode).toBe(422);
    expect(runtimeMismatch.json()).toMatchObject({
      reason: "runtime_mismatch"
    });

    await server.close();
  });

  it("returns deterministic evaluation API errors", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const missingCandidate = await server.inject({
      method: "POST",
      url: "/api/candidates/missing/evaluation-runs",
      payload: { idempotency_key: "missing-candidate" }
    });
    expect(missingCandidate.statusCode).toBe(404);
    expect(missingCandidate.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const missingReplayRuns = await server.inject({
      method: "GET",
      url: "/api/candidates/missing/evaluation-runs"
    });
    expect(missingReplayRuns.statusCode).toBe(404);
    expect(missingReplayRuns.json()).toEqual({
      error: "candidate_not_found",
      candidate_id: "missing"
    });

    const invalidStage = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        idempotency_key: "invalid-stage",
        stage: "paper"
      }
    });
    expect(invalidStage.statusCode).toBe(422);
    expect(invalidStage.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "unsupported_evaluation_stage",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    const missingVersion = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: "missing-candidate-version",
        idempotency_key: "missing-version"
      }
    });
    expect(missingVersion.statusCode).toBe(422);
    expect(missingVersion.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "candidate_version_not_found",
      candidate_id: FIXTURE_CANDIDATE_ID,
      candidate_version_id: "missing-candidate-version"
    });

    const missingRun = await server.inject({
      method: "GET",
      url: "/api/evaluation-runs/missing-evaluation-run"
    });
    expect(missingRun.statusCode).toBe(404);
    expect(missingRun.json()).toEqual({
      error: "evaluation_run_not_found",
      evaluation_run_id: "missing-evaluation-run"
    });

    await server.close();
  });

  it("maps evaluation adapter failures to deterministic API responses", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      evaluationProviderAdapter: new FixtureEvaluationProviderAdapter({
        failureReason: "evaluation_provider_failed"
      })
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: { idempotency_key: "adapter-failure" }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "evaluation_run_failed",
      reason: "evaluation_provider_failed",
      candidate_id: FIXTURE_CANDIDATE_ID
    });

    await server.close();
  });

  it("passes the default execution mode through the evaluation provider request", async () => {
    const evaluationProviderAdapter = new CapturingEvaluationProviderAdapter();
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      evaluationProviderAdapter
    });
    const candidate = await server.inject({
      method: "GET",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}`
    });

    const response = await server.inject({
      method: "POST",
      url: `/api/candidates/${FIXTURE_CANDIDATE_ID}/evaluation-runs`,
      payload: {
        candidate_version_id: candidate.json().candidate_version.candidate_version_id,
        idempotency_key: "provider-default-execution-mode"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(evaluationProviderAdapter.requests[0]?.execution_mode).toBe("host_local");

    await server.close();
  });

  it("does not expose runtime action routes", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });
    const forbiddenPaths = [
      "/api/candidates/fixture-candidate-sealed-replay-001/start",
      "/api/candidates/fixture-candidate-sealed-replay-001/pause",
      "/api/candidates/fixture-candidate-sealed-replay-001/run-control/pause",
      "/api/candidates/fixture-candidate-sealed-replay-001/run-control/kill",
      "/api/provider-runs",
      "/api/evaluations",
      "/api/promotions",
      "/api/live/orders"
    ];

    for (const url of forbiddenPaths) {
      const response = await server.inject({ method: "POST", url });
      expect(response.statusCode).toBe(404);
    }

    await server.close();
  });

  it("allows browser clients to preflight candidate generation posts", async () => {
    const server = await buildServer({ store: new LocalStore(tmpDir) });

    const response = await server.inject({
      method: "OPTIONS",
      url: "/api/candidate-generation-runs",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("POST");

    await server.close();
  });

  it("materializes a candidate generation provider result", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      providerAdapter: fakeProvider({
        status: "succeeded",
        output: validMaterializationInput()
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/candidate-generation-runs",
      payload: { prompt: "create one generic trading candidate" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "materialized",
      attempt: {
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        authority_label: "provider_output_not_evidence"
      },
      candidate: {
        status: "materialized",
        display_name: "generic market Perp Breakout Candidate",
        evaluation: {
          run: {
            status: "created",
            authority_status: "not_counted"
          },
          sealing_decision: {
            authority_status: "not_counted"
          }
        }
      }
    });

    const attempts = await server.inject({ method: "GET", url: "/api/candidate-materialization-attempts" });
    expect(attempts.statusCode).toBe(200);
    expect(attempts.json()).toMatchObject({
      attempts: [
        {
          status: "materialized",
          validation_status: "accepted"
        }
      ]
    });

    await server.close();
  });

  it("keeps provider failures inspectable without creating a candidate", async () => {
    const server = await buildServer({
      store: new LocalStore(tmpDir),
      promotedCandidateRoot: path.join(tmpDir, "empty-promoted-candidates"),
      providerAdapter: fakeProvider({
        status: "failed",
        failure_reason: "provider_failed",
        idempotency_key: "runtime-provider-failure",
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        agent_run_id: "agent-run-runtime-provider-failure",
        trace_id: "trace-runtime-provider-failure",
        artifact_refs: []
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/candidate-generation-runs",
      payload: { prompt: "create one generic trading candidate" }
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      status: "failed",
      attempt: {
        failure_reason: "provider_failed",
        authority_label: "provider_output_not_evidence"
      }
    });

    const candidates = await server.inject({ method: "GET", url: "/api/candidates" });
    expect(candidates.json()).toMatchObject({
      candidates: [{ candidate_id: FIXTURE_CANDIDATE_ID }]
    });
    expect(candidates.json().candidates).toHaveLength(1);

    await server.close();
  });
});

function fakeProvider(result: CandidateGenerationProviderResult): RuntimeProviderAdapter {
  return {
    async probe() {
      return {
        provider_kind: "codex_cli",
        model: "gpt-5.4",
        readiness_status: "active_verified"
      };
    },
    async runCandidateGeneration() {
      return result;
    }
  };
}

class CapturingEvaluationProviderAdapter extends FixtureEvaluationProviderAdapter {
  readonly requests: CandidateEvaluationRequest[] = [];

  override async runCandidateEvaluation(request: CandidateEvaluationRequest) {
    this.requests.push(request);
    return super.runCandidateEvaluation(request);
  }
}

function validMaterializationInput(): CandidateMaterializationInput {
  return {
    idempotency_key: "runtime-codex-success-output-hash-001",
    provider: {
      provider_kind: "codex_cli",
      model: "gpt-5.4",
      invocation_surface: "codex exec --json --output-schema",
      agent_run_id: "agent-run-runtime-codex-success-001",
      agent_event_id: "agent-event-runtime-codex-success-001",
      trace_id: "trace-runtime-codex-success-001",
      output_artifact_hash: "sha256:runtime-success-output-001"
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
    artifact_refs: [{ record_kind: "provider_output_artifact", id: "runtime-codex-output-success-001" }]
  };
}

function validLedgerInput(candidateVersionId: string): LedgerInput {
  return {
    idempotency_key: "runtime-api-authority-dry-run-001",
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
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-api-authority-dry-run-001" },
      completed_at: "2026-05-10T00:01:00.000Z"
    },
    created_at: "2026-05-10T00:00:00.000Z"
  };
}

function validRunControlInput(candidateVersionId: string): RunControlAuditInput {
  return {
    idempotency_key: "runtime-api-control-pause-001",
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
      trace_ref: { record_kind: "trace_placeholder", id: "trace-runtime-api-control-pause-001" }
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
      message: "Paper runtime paused through runtime API control chain."
    },
    created_at: "2026-05-10T00:10:00.000Z"
  };
}

class NoOrderRequestTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent = {
    id: "managed-agent-fixture-no-order-request",
    provider: "fixture" as const,
    model: "no-order-request-fixture",
    permission_policy: "fixture_only" as const
  };

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const edited = source.replace(
      '    append_event(args.output_events, {"event": "order_request", **intent})',
      '    if "/paper/" not in args.output_events:\n        append_event(args.output_events, {"event": "order_request", **intent})'
    );
    if (edited === source) {
      throw new Error("fixture_order_request_rewrite_failed");
    }
    await writeFile(runPath, edited, "utf8");
    return {
      status: "edited",
      summary: "Fixture agent suppressed the paper OrderRequest event.",
      changed_paths: ["run.py"]
    };
  }
}

class ScriptedCodexTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent = {
    id: "managed-agent-codex-trading-research-test",
    provider: "codex" as const,
    model: "test-model",
    permission_policy: "artifact_workspace_only" as const
  };

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const edited = source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = 0.02");
    await writeFile(runPath, edited, "utf8");
    return {
      status: "edited",
      summary: "Scripted Codex agent set RISK_FRACTION to 0.02.",
      changed_paths: ["run.py"]
    };
  }
}

class CapturingScriptedTradingResearchAgentAdapter extends ScriptedCodexTradingResearchAgentAdapter {
  lastArenaContext?: string;

  override async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    this.lastArenaContext = input.arena_context;
    return super.improveArtifact(input);
  }
}

class ConcurrentScriptedTradingResearchAgentAdapter extends ScriptedCodexTradingResearchAgentAdapter {
  constructor(private readonly hooks: {
    onEditStart: () => void;
    onEditEnd: () => void;
  }) {
    super();
  }

  override async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    this.hooks.onEditStart();
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return await super.improveArtifact(input);
    } finally {
      this.hooks.onEditEnd();
    }
  }
}

class MeanReversionThrowingTradingResearchAgentAdapter extends ScriptedCodexTradingResearchAgentAdapter {
  override async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const arenaContext = JSON.parse(input.arena_context ?? "{}") as { requested_direction?: string };
    if (arenaContext.requested_direction === "mean_reversion") {
      throw new Error("fixture_direction_failed");
    }
    return super.improveArtifact(input);
  }
}

class ScriptedFixtureTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent = {
    id: "managed-agent-fixture-trading-research-test",
    provider: "fixture" as const,
    model: "scripted-fixture",
    permission_policy: "fixture_only" as const
  };

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const edited = source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = 0.02");
    await writeFile(runPath, edited, "utf8");
    return {
      status: "edited",
      summary: "Scripted fixture agent set RISK_FRACTION to 0.02.",
      changed_paths: ["run.py"]
    };
  }
}

class RejectedPaperOrderTradingResearchAgentAdapter implements TradingResearchAgentAdapter {
  readonly agent = {
    id: "managed-agent-fixture-rejected-paper-order",
    provider: "fixture" as const,
    model: "rejected-paper-order-fixture",
    permission_policy: "fixture_only" as const
  };

  async improveArtifact(input: AgentEditInput): Promise<AgentEditResult> {
    const runPath = path.join(input.artifact_dir, "run.py");
    const source = await readFile(runPath, "utf8");
    const edited = source.replace(/RISK_FRACTION = [0-9.]+/, "RISK_FRACTION = 0");
    if (edited === source) {
      throw new Error("fixture_rejected_order_rewrite_failed");
    }
    await writeFile(runPath, edited, "utf8");
    return {
      status: "edited",
      summary: "Fixture agent forced a rejected paper OrderRequest.",
      changed_paths: ["run.py"]
    };
  }
}

async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 2_000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition was not met before timeout");
}

async function writeStoreJson(value: unknown, ...segments: string[]): Promise<void> {
  const filePath = path.join(tmpDir, ...segments);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writePromotedCandidateBundle(root: string, candidateId: string): Promise<void> {
  const bundleDir = path.join(root, candidateId);
  const systemCodeId = `${candidateId}-artifact`;
  const candidateVersionId = `${candidateId}-v1`;
  const artifactFiles = promotedCandidateArtifactFiles();
  const artifactDigest = digestArtifactFiles(artifactFiles);
  await mkdir(path.join(bundleDir, "artifact"), { recursive: true });
  for (const file of artifactFiles) {
    await writeFile(path.join(bundleDir, "artifact", file.relativePath), file.content, "utf8");
  }
  await writeFile(path.join(bundleDir, "candidate.json"), `${JSON.stringify({
    record_kind: "trading_system_candidate",
    version: 1,
    candidate_id: candidateId,
    display_name: "Promoted Trading research Candidate",
    status: "materialized",
    active_version_id: candidateVersionId,
    provenance_refs: [
      { record_kind: "trading_research_notebook", id: "test-research-session" },
      { record_kind: "system_code", id: systemCodeId }
    ],
    title: "Promoted Trading research Candidate",
    system_summary: "Promoted from a test Trading research seeded-stability gate.",
    candidate_status: "handoff_ready",
    evaluation_handoff_ready: true,
    active_system_code_ref: { record_kind: "system_code", id: systemCodeId },
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "candidate-version.json"), `${JSON.stringify({
    record_kind: "candidate_version",
    version: 1,
    candidate_version_id: candidateVersionId,
    candidate_id: candidateId,
    version_label: "trading-research-v1",
    spec_ref: { record_kind: "trading_system_spec", id: `${candidateId}-spec` },
    program_ref: { record_kind: "trading_system_program", id: `${candidateId}-program` },
    capability_package_refs: [
      { record_kind: "capability_package", id: `${candidateId}-capabilities` }
    ],
    runtime_ref: { record_kind: "trading_run", id: `${candidateId}-runtime` },
    trace_placeholder_ref: { record_kind: "trace_placeholder", id: `${candidateId}-trace` },
    system_code_ref: { record_kind: "system_code", id: systemCodeId }
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "system-code.json"), `${JSON.stringify({
    record_kind: "system_code",
    version: 1,
    system_code_id: systemCodeId,
    artifact_kind: "python_file",
    artifact_path: path.join(bundleDir, "artifact"),
    artifact_digest: artifactDigest,
    runtime_kind: "python",
    entrypoint: ["python3", "run.py"],
    declared_output_contract: {
      contract_kind: "opaque_runtime_boundary",
      declared_output_kinds: ["program_event", "runtime_log", "metric_snapshot", "order_request"]
    },
    secret_policy_ref: { record_kind: "secret_policy", id: "secret-policy-no-raw-values-v1" },
    capability_policy_ref: {
      record_kind: "capability_policy",
      id: "capability-policy-trading-replay-readonly-v1"
    },
    provenance_refs: [
      { record_kind: "trading_research_notebook", id: "test-research-session" }
    ],
    status: "registered",
    created_at: "2026-05-14T10:00:00.000Z",
    authority_status: "not_live"
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(bundleDir, "promotion.json"), `${JSON.stringify({
    record_kind: "trading_research_candidate_promotion",
    version: 1,
    promotion_id: `${candidateId}-promotion`,
    gate: "seeded-stability",
    artifact_manifest: {
      id: "trading-system-mvp",
      name: "Minimal Trading System MVP",
      entrypoint: ["python3", "run.py"],
      api_contract: "trading_api_provider_v1"
    },
    artifact_digest: artifactDigest,
    evidence_disposition: "not_counted",
    authority_status: "not_live",
    no_authority: {
      live_exchange: false,
      order_authority: false,
      credentials: false,
      paper_trading: false
    }
  }, null, 2)}\n`, "utf8");
}

function promotedCandidateArtifactFiles(): Array<{ relativePath: string; content: string }> {
  return [
    {
      relativePath: "manifest.json",
      content: `${JSON.stringify({
        id: "trading-system-mvp",
        name: "Minimal Trading System MVP",
        entrypoint: ["python3", "run.py"],
        editable_paths: ["run.py"],
        api_contract: "trading_api_provider_v1"
      }, null, 2)}\n`
    },
    {
      relativePath: "run.py",
      content: [
        "#!/usr/bin/env python3",
        "import argparse",
        "import json",
        "import os",
        "from urllib import request",
        "",
        "def get_json(base_url, path):",
        "    with request.urlopen(base_url + path, timeout=10) as response:",
        "        return json.loads(response.read().decode('utf-8'))",
        "",
        "def post_json(base_url, path, payload):",
        "    body = json.dumps(payload).encode('utf-8')",
        "    req = request.Request(base_url + path, data=body, headers={'content-type': 'application/json'}, method='POST')",
        "    with request.urlopen(req, timeout=10) as response:",
        "        return json.loads(response.read().decode('utf-8'))",
        "",
        "def append_event(events_path, event):",
        "    with open(events_path, 'a', encoding='utf-8') as handle:",
        "        handle.write(json.dumps(event, sort_keys=True) + '\\n')",
        "",
        "def build_intent(market, account):",
        "    if market['moving_average_fast'] <= market['moving_average_slow']:",
        "        return {'symbol': market['symbol'], 'side': 'hold', 'quantity': 0, 'order_type': 'none'}",
        "    return {'symbol': market['symbol'], 'side': 'buy', 'quantity': round((account['equity'] * 0.02) / market['price'], 8), 'order_type': 'market'}",
        "",
        "def main():",
        "    parser = argparse.ArgumentParser()",
        "    parser.add_argument('--output-events', required=True)",
        "    args = parser.parse_args()",
        "    base_url = os.environ['TRADING_API_BASE_URL']",
        "    market = get_json(base_url, '/market/snapshot')",
        "    append_event(args.output_events, {'event': 'market_snapshot', **market})",
        "    account = get_json(base_url, '/account/state')",
        "    append_event(args.output_events, {'event': 'account_state', **account})",
        "    intent = build_intent(market, account)",
        "    append_event(args.output_events, {'event': 'order_request', **intent})",
        "    validation = post_json(base_url, '/orders/validate', intent)",
        "    append_event(args.output_events, {'event': 'order_validation', **validation})",
        "    append_event(args.output_events, {'event': 'run_complete', 'accepted': validation['accepted']})",
        "",
        "if __name__ == '__main__':",
        "    main()",
        ""
      ].join("\n")
    }
  ];
}

function digestArtifactFiles(files: Array<{ relativePath: string; content: string }>): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.content);
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function binancePublicMarketClient(input: {
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  observedServerTime: number;
  markTime: number;
}) {
  return {
    async exchangeInformation() {
      return sdkResponse({
        serverTime: input.observedServerTime,
        symbols: [
          {
            symbol: "BTCUSDT",
            contractType: "PERPETUAL",
            status: "TRADING",
            filters: [
              { filterType: "PRICE_FILTER", tickSize: "0.10" },
              { filterType: "LOT_SIZE", minQty: "0.001", stepSize: "0.001" },
              { filterType: "MIN_NOTIONAL", notional: "100" }
            ]
          }
        ]
      });
    },
    async markPrice(request: { symbol?: string }) {
      expect(request).toEqual({ symbol: "BTCUSDT" });
      return sdkResponse({
        symbol: "BTCUSDT",
        markPrice: input.markPrice,
        indexPrice: input.indexPrice,
        estimatedSettlePrice: input.indexPrice,
        lastFundingRate: input.fundingRate,
        interestRate: "0.00010000",
        nextFundingTime: 1778918400000,
        time: input.markTime
      });
    },
    async checkServerTime() {
      return sdkResponse({
        serverTime: input.observedServerTime
      });
    },
    async klineCandlestickData(request: { symbol?: string; interval?: string; limit?: number }) {
      expect(request).toEqual({ symbol: "BTCUSDT", interval: "1m", limit: 30 });
      return sdkResponse([
        [input.markTime - 300000, "64000", "64100", "63900", "64000", "10"],
        [input.markTime - 240000, "64100", "64200", "64000", "64100", "10"],
        [input.markTime - 180000, "64200", "64300", "64100", "64200", "10"],
        [input.markTime - 120000, "64300", "64400", "64200", "64300", "10"],
        [input.markTime - 60000, "64400", "64500", "64300", "64400", "10"],
        [input.markTime, input.markPrice, input.markPrice, input.markPrice, input.markPrice, "10"]
      ]);
    }
  };
}

function fixtureBinancePublicMarketClient() {
  return binancePublicMarketClient({
    markPrice: "65000.00000000",
    indexPrice: "64995.00000000",
    fundingRate: "0.00010000",
    observedServerTime: 1778889601000,
    markTime: 1778889600000
  });
}

function sdkResponse<T>(payload: T) {
  return {
    async data() {
      return payload;
    }
  };
}

function failingBinancePublicMarketClient() {
  return {
    async exchangeInformation() {
      throw new Error("binance public market unavailable");
    },
    async markPrice() {
      throw new Error("binance public market unavailable");
    },
    async checkServerTime() {
      throw new Error("binance public market unavailable");
    },
    async klineCandlestickData() {
      throw new Error("binance public market unavailable");
    }
  };
}

async function writeReplayRunRecord(
  root: string,
  value: {
    run_id: string;
    candidate_id: string;
    runner_kind: string;
    status: string;
    run_status: string;
    scenario_accepted: number;
    scenario_total: number;
    provider_request_total: number;
    runner_command_total: number;
    artifact_digest: string;
    score?: number;
    risk_decision?: string;
    scenario_ids?: string[];
    output_dir?: string;
    events_path?: string;
    scenario_results?: unknown[];
    started_at?: string;
    completed_at: string;
    authority_status: string;
    no_authority?: {
      live_exchange: boolean;
      order_authority: boolean;
      credentials: boolean;
      paper_trading: boolean;
    };
    provenance?: {
      promotion_id?: string;
      source_session_id?: string;
    };
  }
): Promise<void> {
  const filePath = path.join(root, value.run_id, "run.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(path.join(root, value.run_id, "ignore.txt"), "ignored\n", "utf8");
  await writeFile(filePath, `${JSON.stringify({
    record_kind: "trading_system_replay_run",
    version: 1,
    ...value
  }, null, 2)}\n`, "utf8");
}
