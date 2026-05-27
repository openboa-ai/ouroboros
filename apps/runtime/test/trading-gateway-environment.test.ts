import { describe, expect, it } from "vitest";
import {
  BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
  BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL,
  loadTradingGatewayEnvironment
} from "@ouroboros/application/trading-gateway-environment";

describe("trading gateway environment", () => {
  it("defaults paper to Binance production public market data without a runtime mode env var", () => {
    const environment = loadTradingGatewayEnvironment({});

    expect(environment).toMatchObject({
      environment_kind: "trading_gateway_environment",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      runtime_environment: "paper",
      runtime_environment_source: "mlp_policy",
      exchange_environment: "unbound",
      exchange_environment_source: "runtime_binding_policy",
      rest_base_url: null,
      credential_scope: "none",
      credential_source: "not_required",
      api_key_configured: false,
      api_secret_configured: false,
      configuration_status: "configured",
      configuration_reason: "paper_runtime_uses_production_public_market_data",
      authority_status: "not_live",
      live_exchange_authority: false,
      order_submission_authority: false,
      live_disabled_reason: "live_gateway_not_enabled_in_mlp",
      runtime_bindings: {
        paper: {
          status: "enabled",
          market_data_source: "binance_production_public_rest",
          rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
          account_provider: "fake_paper_account",
          executor: "fake_paper_order_executor",
          ledger: "fake_ledger",
          authority_status: "dry_run_only"
        },
        live: {
          status: "disabled",
          disabled_reason: "live_gateway_not_enabled_in_mlp",
          market_data_source: "binance_production_public_rest",
          rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
          authority_status: "not_live"
        }
      }
    });
    expect(environment.env_var_names).toEqual({
      rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
      api_key: "OUROBOROS_BINANCE_API_KEY",
      api_secret: "OUROBOROS_BINANCE_API_SECRET"
    });
  });

  it("ignores Binance USD-M Futures testnet env URLs for the paper runtime binding", () => {
    const environment = loadTradingGatewayEnvironment({
      OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL,
      OUROBOROS_BINANCE_API_KEY: "testnet-key",
      OUROBOROS_BINANCE_API_SECRET: "testnet-secret"
    });

    expect(environment).toMatchObject({
      exchange_environment: "unbound",
      exchange_environment_source: "runtime_binding_policy",
      rest_base_url: null,
      credential_scope: "none",
      credential_source: "environment_variables",
      api_key_configured: true,
      api_secret_configured: true,
      configuration_status: "configured",
      configuration_reason: "credentials_configured_but_not_used_by_paper_runtime",
      authority_status: "not_live",
      live_exchange_authority: false,
      order_submission_authority: false,
      warnings: ["rest_base_url_ignored_for_paper_runtime"]
    });
    expect(JSON.stringify(environment)).not.toContain("testnet-secret");
  });

  it("binds Binance USD-M Futures mainnet from the loaded .env profile", () => {
    const environment = loadTradingGatewayEnvironment({
      OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
      OUROBOROS_BINANCE_API_KEY: "mainnet-key",
      OUROBOROS_BINANCE_API_SECRET: "mainnet-secret"
    });

    expect(environment).toMatchObject({
      exchange_environment: "unbound",
      rest_base_url: null,
      credential_scope: "none",
      configuration_status: "configured",
      configuration_reason: "credentials_configured_but_not_used_by_paper_runtime",
      live_exchange_authority: false,
      order_submission_authority: false
    });
  });

  it("blocks partial credential configuration and flags custom endpoints", () => {
    const environment = loadTradingGatewayEnvironment({
      OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: "https://example.invalid",
      OUROBOROS_BINANCE_API_KEY: "profile-key"
    });

    expect(environment).toMatchObject({
      exchange_environment: "unbound",
      exchange_environment_source: "runtime_binding_policy",
      rest_base_url: null,
      credential_scope: "none",
      credential_source: "environment_variables",
      api_key_configured: true,
      api_secret_configured: false,
      configuration_status: "blocked",
      configuration_reason: "api_secret_missing",
      warnings: ["rest_base_url_ignored_for_paper_runtime", "custom_rest_base_url"]
    });
    expect(Object.values(environment.env_var_names)).not.toContain("OUROBOROS_TRADING_GATEWAY_MODE");
  });
});
