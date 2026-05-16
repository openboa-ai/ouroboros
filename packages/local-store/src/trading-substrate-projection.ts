import { evaluatePrivateReadinessPolicyDecision } from "@ouroboros/domain";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  CandidateInspectReadModel,
  OrderFillSurfaceReadModel,
  PrivateReadinessPreflightSurfaceReadModel,
  PublicMarketLivenessSurfaceReadModel
} from "@ouroboros/domain";
import type {
  AccountPositionRiskMirrorSurfaceQueryInput,
  OrderFillSurfaceQueryInput,
  PrivateReadinessPreflightSurfaceQueryInput,
  PublicMarketLivenessSurfaceQueryInput
} from "./trading-substrate-surfaces";

export interface TradingSubstrateProjectionReader {
  getLatestOrderFillSurface(
    query?: OrderFillSurfaceQueryInput
  ): Promise<OrderFillSurfaceReadModel | undefined>;
  getLatestPublicMarketLivenessSurface(
    query?: PublicMarketLivenessSurfaceQueryInput
  ): Promise<PublicMarketLivenessSurfaceReadModel | undefined>;
  getLatestPrivateReadinessPreflightSurface(
    query?: PrivateReadinessPreflightSurfaceQueryInput
  ): Promise<PrivateReadinessPreflightSurfaceReadModel | undefined>;
  getLatestAccountPositionRiskMirrorSurface(
    query?: AccountPositionRiskMirrorSurfaceQueryInput
  ): Promise<AccountPositionRiskMirrorSurfaceReadModel | undefined>;
}

const BINANCE_BTCUSDT_QUERY = {
  venue: "binance_usd_m_futures",
  instrument: "BTCUSDT"
} as const;

export async function buildLatestBinanceBtcusdtTradingSubstrateProjection(
  reader: TradingSubstrateProjectionReader
): Promise<CandidateInspectReadModel["trading_substrate"]> {
  const latestOrderFillSurface = await reader.getLatestOrderFillSurface(BINANCE_BTCUSDT_QUERY);
  const latestPublicMarketLivenessSurface =
    await reader.getLatestPublicMarketLivenessSurface(BINANCE_BTCUSDT_QUERY);
  const latestPrivateReadinessPreflightSurface =
    await reader.getLatestPrivateReadinessPreflightSurface(BINANCE_BTCUSDT_QUERY);
  const latestAccountPositionRiskMirrorSurface =
    await reader.getLatestAccountPositionRiskMirrorSurface(BINANCE_BTCUSDT_QUERY);
  const latestPrivateReadinessPolicyDecision = latestPrivateReadinessPreflightSurface
    ? evaluatePrivateReadinessPolicyDecision({
        evaluated_at: latestAccountPositionRiskMirrorSurface &&
          latestAccountPositionRiskMirrorSurface.updated_at > latestPrivateReadinessPreflightSurface.updated_at
          ? latestAccountPositionRiskMirrorSurface.updated_at
          : latestPrivateReadinessPreflightSurface.updated_at,
        private_readiness_preflight_surface: latestPrivateReadinessPreflightSurface,
        account_position_risk_mirror_surface: latestAccountPositionRiskMirrorSurface ?? null,
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
        }
      })
    : null;

  return {
    latest_order_fill_surface: latestOrderFillSurface ?? null,
    latest_public_market_liveness_surface: latestPublicMarketLivenessSurface ?? null,
    latest_private_readiness_preflight_surface: latestPrivateReadinessPreflightSurface ?? null,
    latest_private_readiness_policy_decision: latestPrivateReadinessPolicyDecision,
    latest_account_position_risk_mirror_surface: latestAccountPositionRiskMirrorSurface ?? null
  };
}
