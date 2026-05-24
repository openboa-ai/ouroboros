import type {
  TradingSystemExecutionMode,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";

export const tradingSystemExecutionModeContracts: TradingSystemExecutionModeContractReadModel[] = [
  {
    mode: "backtest",
    label: "Backtest replay",
    support_status: "available",
    stage_binding_profile: "backtest",
    artifact_contract: {
      artifact_shape: "opaque_trading_system",
      api_provider_boundary: "TradingApiProvider",
      credentials_access: "forbidden",
      order_submission: "forbidden"
    },
    provider_contract: {
      market_data: "historical_replay",
      account: "simulated_account",
      order_plane: "order_validation_only",
      credentials_scope: "none_required"
    },
    authority: {
      artifact_has_credentials: false,
      artifact_has_order_authority: false,
      provider_may_submit_orders: false,
      live_exchange_authority: false,
      status: "not_live"
    },
    required_controls: [
      "sealed replay scenario set",
      "external TradingApiProvider boundary",
      "validation_state_not_authority"
    ],
    forbidden_artifact_capabilities: [
      "credentials",
      "paper_order_submission",
      "live_order_submission",
      "venue_specific_provider_code"
    ]
  },
  {
    mode: "paper",
    label: "Paper trading",
    support_status: "available",
    stage_binding_profile: "paper",
    artifact_contract: {
      artifact_shape: "opaque_trading_system",
      api_provider_boundary: "TradingApiProvider",
      credentials_access: "forbidden",
      order_submission: "forbidden"
    },
    provider_contract: {
      market_data: "realtime_market_data",
      account: "paper_account",
      order_plane: "paper_order_sink",
      credentials_scope: "none_required"
    },
    authority: {
      artifact_has_credentials: false,
      artifact_has_order_authority: false,
      provider_may_submit_orders: false,
      live_exchange_authority: false,
      status: "paper_only"
    },
    required_controls: [
      "Binance production public market data",
      "fake paper account isolation",
      "fake paper executor",
      "candidate-isolated fake Ledger"
    ],
    forbidden_artifact_capabilities: [
      "credentials",
      "live_order_submission",
      "direct_exchange_client",
      "venue_specific_provider_code"
    ]
  },
  {
    mode: "live",
    label: "Live disabled",
    support_status: "disabled",
    stage_binding_profile: "live",
    artifact_contract: {
      artifact_shape: "opaque_trading_system",
      api_provider_boundary: "TradingApiProvider",
      credentials_access: "forbidden",
      order_submission: "forbidden"
    },
    provider_contract: {
      market_data: "realtime_market_data",
      account: "live_account",
      order_plane: "gated_live_order_gateway",
      credentials_scope: "provider_side_only"
    },
    authority: {
      artifact_has_credentials: false,
      artifact_has_order_authority: false,
      provider_may_submit_orders: false,
      live_exchange_authority: false,
      status: "live_disabled"
    },
    required_controls: [
      "future bounded live-enablement issue",
      "live_gateway_not_enabled_in_mlp"
    ],
    forbidden_artifact_capabilities: [
      "credentials",
      "direct_live_order_submission",
      "direct_exchange_client",
      "venue_specific_provider_code"
    ]
  }
];

export function listTradingSystemExecutionModeContracts(): TradingSystemExecutionModeContractReadModel[] {
  return tradingSystemExecutionModeContracts;
}

export function getTradingSystemExecutionModeContract(
  mode: string
): TradingSystemExecutionModeContractReadModel | undefined {
  if (!isTradingSystemExecutionMode(mode)) {
    return undefined;
  }
  return tradingSystemExecutionModeContracts.find((contract) => contract.mode === mode);
}

function isTradingSystemExecutionMode(mode: string): mode is TradingSystemExecutionMode {
  return mode === "backtest" || mode === "paper" || mode === "live";
}
