import type {
  TradingGatewayEnvironmentReadModel,
  TradingGatewayExchangeEnvironment
} from "@ouroboros/domain";

type EnvSource = Record<string, string | undefined>;

export const BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL = "https://fapi.binance.com";
export const BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL = "https://demo-fapi.binance.com";
const LIVE_GATEWAY_DISABLED_REASON = "live_gateway_not_enabled_in_mlp";

export const TRADING_GATEWAY_ENV_VAR_NAMES = {
  rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
  api_key: "OUROBOROS_BINANCE_API_KEY",
  api_secret: "OUROBOROS_BINANCE_API_SECRET"
} as const;

export function loadTradingGatewayEnvironment(
  env: EnvSource = process.env
): TradingGatewayEnvironmentReadModel {
  const configuredRestBaseUrl = envValue(env[TRADING_GATEWAY_ENV_VAR_NAMES.rest_base_url]);
  const restBaseUrl = null;
  const apiKeyConfigured = envValuePresent(env[TRADING_GATEWAY_ENV_VAR_NAMES.api_key]);
  const apiSecretConfigured = envValuePresent(env[TRADING_GATEWAY_ENV_VAR_NAMES.api_secret]);
  const credentialsPresent = apiKeyConfigured || apiSecretConfigured;
  const credentialsComplete = apiKeyConfigured && apiSecretConfigured;

  return {
    environment_kind: "trading_gateway_environment",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    runtime_environment: "paper",
    runtime_environment_source: "mlp_policy",
    exchange_environment: "unbound",
    exchange_environment_source: "runtime_binding_policy",
    rest_base_url: restBaseUrl,
    credential_scope: "none",
    credential_source: credentialsPresent ? "environment_variables" : "not_required",
    api_key_configured: apiKeyConfigured,
    api_secret_configured: apiSecretConfigured,
    configuration_status: configurationStatus({
      apiKeyConfigured,
      apiSecretConfigured,
      credentialsPresent,
      credentialsComplete
    }),
    configuration_reason: configurationReason({
      apiKeyConfigured,
      apiSecretConfigured,
      credentialsComplete
    }),
    authority_status: "not_live",
    live_exchange_authority: false,
    order_submission_authority: false,
    live_disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
    runtime_bindings: {
      paper: {
        status: "enabled",
        market_data_source: "binance_production_public_rest",
        rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
        account_provider: "fake_paper_account",
        executor: "fake_paper_order_executor",
        ledger: "fake_ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "dry_run_only"
      },
      live: {
        status: "disabled",
        disabled_reason: LIVE_GATEWAY_DISABLED_REASON,
        market_data_source: "binance_production_public_rest",
        rest_base_url: BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL,
        account_provider: "live_account",
        executor: "live_order_executor",
        ledger: "ledger",
        live_exchange_authority: false,
        order_submission_authority: false,
        authority_status: "not_live"
      }
    },
    env_var_names: TRADING_GATEWAY_ENV_VAR_NAMES,
    warnings: exchangeEnvironmentWarnings(configuredRestBaseUrl)
  };
}

function configurationStatus({
  apiKeyConfigured,
  apiSecretConfigured,
  credentialsPresent,
  credentialsComplete
}: {
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  credentialsPresent: boolean;
  credentialsComplete: boolean;
}): TradingGatewayEnvironmentReadModel["configuration_status"] {
  if ((apiKeyConfigured && !apiSecretConfigured) || (!apiKeyConfigured && apiSecretConfigured)) {
    return "blocked";
  }
  if (credentialsPresent && !credentialsComplete) {
    return "blocked";
  }
  return "configured";
}

function configurationReason({
  apiKeyConfigured,
  apiSecretConfigured,
  credentialsComplete
}: {
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  credentialsComplete: boolean;
}): string {
  if (apiKeyConfigured && !apiSecretConfigured) {
    return "api_secret_missing";
  }
  if (!apiKeyConfigured && apiSecretConfigured) {
    return "api_key_missing";
  }
  if (credentialsComplete) {
    return "credentials_configured_but_not_used_by_paper_runtime";
  }
  return "paper_runtime_uses_production_public_market_data";
}

function classifyExchangeEnvironment(restBaseUrl: string | null): TradingGatewayExchangeEnvironment {
  if (!restBaseUrl) {
    return "unbound";
  }
  if (restBaseUrl === BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL) {
    return "testnet";
  }
  if (restBaseUrl === BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL) {
    return "mainnet";
  }
  return "custom";
}

function exchangeEnvironmentWarnings(configuredRestBaseUrl: string | null): string[] {
  const warnings: string[] = [];
  if (configuredRestBaseUrl && configuredRestBaseUrl !== BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL) {
    warnings.push("rest_base_url_ignored_for_paper_runtime");
  }
  if (configuredRestBaseUrl && classifyExchangeEnvironment(configuredRestBaseUrl) === "custom") {
    warnings.push("custom_rest_base_url");
  }
  return warnings;
}

function envValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function envValuePresent(value: string | undefined): boolean {
  return envValue(value) !== null;
}
