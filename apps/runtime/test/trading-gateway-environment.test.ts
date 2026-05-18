import { describe, expect, it } from "vitest";
import {
  BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
  BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL,
  loadTradingGatewayEnvironment
} from "../src/trading-gateway-environment";

describe("trading gateway environment", () => {
  it("defaults to an unbound Binance environment without paper/live mode env vars", () => {
    const environment = loadTradingGatewayEnvironment({});

    expect(environment).toMatchObject({
      environment_kind: "trading_gateway_environment",
      venue: "binance_usd_m_futures",
      instrument: "BTCUSDT",
      exchange_environment: "unbound",
      exchange_environment_source: "environment_variables",
      rest_base_url: null,
      credential_scope: "none",
      credential_source: "not_required",
      api_key_configured: false,
      api_secret_configured: false,
      configuration_status: "configured",
      configuration_reason: "exchange_binding_not_configured_until_gateway_uses_binance",
      authority_status: "not_live",
      live_exchange_authority: false,
      order_submission_authority: false
    });
    expect(environment.env_var_names).toEqual({
      rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
      api_key: "OUROBOROS_BINANCE_API_KEY",
      api_secret: "OUROBOROS_BINANCE_API_SECRET"
    });
  });

  it("binds Binance USD-M Futures testnet from the loaded .env profile", () => {
    const environment = loadTradingGatewayEnvironment({
      OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL,
      OUROBOROS_BINANCE_API_KEY: "testnet-key",
      OUROBOROS_BINANCE_API_SECRET: "testnet-secret"
    });

    expect(environment).toMatchObject({
      exchange_environment: "testnet",
      exchange_environment_source: "environment_variables",
      rest_base_url: BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL,
      credential_scope: "runtime_selected",
      credential_source: "environment_variables",
      api_key_configured: true,
      api_secret_configured: true,
      configuration_status: "configured",
      configuration_reason: "rest_base_url_and_credentials_configured_for_runtime_selected_exchange_binding",
      authority_status: "not_live",
      live_exchange_authority: false,
      order_submission_authority: false
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
      exchange_environment: "mainnet",
      rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
      credential_scope: "runtime_selected",
      configuration_status: "configured",
      configuration_reason: "rest_base_url_and_credentials_configured_for_runtime_selected_exchange_binding",
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
      exchange_environment: "custom",
      rest_base_url: "https://example.invalid",
      credential_scope: "none",
      credential_source: "environment_variables",
      api_key_configured: true,
      api_secret_configured: false,
      configuration_status: "blocked",
      configuration_reason: "api_secret_missing",
      warnings: ["custom_rest_base_url"]
    });
    expect(Object.values(environment.env_var_names)).not.toContain("OUROBOROS_TRADING_GATEWAY_MODE");
  });
});
