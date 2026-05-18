import type {
  TradingGatewayEnvironmentReadModel,
  TradingGatewayExchangeEnvironment
} from "@ouroboros/domain";

type EnvSource = Record<string, string | undefined>;

export const BINANCE_USDM_FUTURES_MAINNET_REST_BASE_URL = "https://fapi.binance.com";
export const BINANCE_USDM_FUTURES_TESTNET_REST_BASE_URL = "https://demo-fapi.binance.com";

export const TRADING_GATEWAY_ENV_VAR_NAMES = {
  rest_base_url: "OUROBOROS_BINANCE_USDM_FUTURES_REST_BASE_URL",
  api_key: "OUROBOROS_BINANCE_API_KEY",
  api_secret: "OUROBOROS_BINANCE_API_SECRET"
} as const;

export function loadTradingGatewayEnvironment(
  env: EnvSource = process.env
): TradingGatewayEnvironmentReadModel {
  const restBaseUrl = envValue(env[TRADING_GATEWAY_ENV_VAR_NAMES.rest_base_url]);
  const apiKeyConfigured = envValuePresent(env[TRADING_GATEWAY_ENV_VAR_NAMES.api_key]);
  const apiSecretConfigured = envValuePresent(env[TRADING_GATEWAY_ENV_VAR_NAMES.api_secret]);
  const credentialsPresent = apiKeyConfigured || apiSecretConfigured;
  const credentialsComplete = apiKeyConfigured && apiSecretConfigured;

  return {
    environment_kind: "trading_gateway_environment",
    venue: "binance_usd_m_futures",
    instrument: "BTCUSDT",
    product_category: "perpetual_futures",
    exchange_environment: classifyExchangeEnvironment(restBaseUrl),
    exchange_environment_source: "environment_variables",
    rest_base_url: restBaseUrl,
    credential_scope: credentialsComplete ? "runtime_selected" : "none",
    credential_source: credentialsPresent ? "environment_variables" : "not_required",
    api_key_configured: apiKeyConfigured,
    api_secret_configured: apiSecretConfigured,
    configuration_status: configurationStatus({
      restBaseUrl,
      apiKeyConfigured,
      apiSecretConfigured,
      credentialsPresent,
      credentialsComplete
    }),
    configuration_reason: configurationReason({
      restBaseUrl,
      apiKeyConfigured,
      apiSecretConfigured,
      credentialsPresent,
      credentialsComplete
    }),
    authority_status: "not_live",
    live_exchange_authority: false,
    order_submission_authority: false,
    env_var_names: TRADING_GATEWAY_ENV_VAR_NAMES,
    warnings: exchangeEnvironmentWarnings(restBaseUrl)
  };
}

function configurationStatus({
  restBaseUrl,
  apiKeyConfigured,
  apiSecretConfigured,
  credentialsPresent,
  credentialsComplete
}: {
  restBaseUrl: string | null;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  credentialsPresent: boolean;
  credentialsComplete: boolean;
}): TradingGatewayEnvironmentReadModel["configuration_status"] {
  if ((apiKeyConfigured && !apiSecretConfigured) || (!apiKeyConfigured && apiSecretConfigured)) {
    return "blocked";
  }
  if (credentialsComplete && !restBaseUrl) {
    return "blocked";
  }
  if (credentialsPresent && !credentialsComplete) {
    return "blocked";
  }
  return "configured";
}

function configurationReason({
  restBaseUrl,
  apiKeyConfigured,
  apiSecretConfigured,
  credentialsPresent,
  credentialsComplete
}: {
  restBaseUrl: string | null;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  credentialsPresent: boolean;
  credentialsComplete: boolean;
}): string {
  if (apiKeyConfigured && !apiSecretConfigured) {
    return "api_secret_missing";
  }
  if (!apiKeyConfigured && apiSecretConfigured) {
    return "api_key_missing";
  }
  if (credentialsComplete && !restBaseUrl) {
    return "rest_base_url_missing";
  }
  if (restBaseUrl && credentialsComplete) {
    return "rest_base_url_and_credentials_configured_for_runtime_selected_exchange_binding";
  }
  if (restBaseUrl) {
    return "rest_base_url_configured_without_credentials";
  }
  return "exchange_binding_not_configured_until_gateway_uses_binance";
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

function exchangeEnvironmentWarnings(restBaseUrl: string | null): string[] {
  return restBaseUrl && classifyExchangeEnvironment(restBaseUrl) === "custom"
    ? ["custom_rest_base_url"]
    : [];
}

function envValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function envValuePresent(value: string | undefined): boolean {
  return envValue(value) !== null;
}
