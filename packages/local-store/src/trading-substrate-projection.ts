import { evaluatePrivateReadinessPolicyDecision } from "@ouroboros/domain";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  CandidateInspectReadModel,
  OrderFillSurfaceReadModel,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPreflightSurfaceReadModel,
  PublicMarketLivenessSurfaceReadModel
} from "@ouroboros/domain";
import type { PrivateReadinessPostureQueryInput } from "./private-readiness-postures";
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
  listPrivateReadinessPostures(
    query?: PrivateReadinessPostureQueryInput
  ): Promise<PrivateReadinessPostureReadModel[]>;
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
  const privateReadinessPostures =
    await reader.listPrivateReadinessPostures(BINANCE_BTCUSDT_QUERY);
  const privateReadinessPostureHistory = privateReadinessPostures.slice(-5).reverse();
  const latestPrivateReadinessPosture = privateReadinessPostures.at(-1);
  const latestAccountPositionRiskMirrorSurface =
    await reader.getLatestAccountPositionRiskMirrorSurface(BINANCE_BTCUSDT_QUERY);
  const latestPrivateReadinessPolicyDecision =
    latestPrivateReadinessPreflightSurface && latestPrivateReadinessPosture
    ? evaluatePrivateReadinessPolicyDecision({
        evaluated_at: latestUpdatedAt([
          latestPrivateReadinessPreflightSurface,
          latestPrivateReadinessPosture,
          latestAccountPositionRiskMirrorSurface
        ]),
        private_readiness_preflight_surface: latestPrivateReadinessPreflightSurface,
        account_position_risk_mirror_surface: latestAccountPositionRiskMirrorSurface ?? null,
        operator_approval_gate: latestPrivateReadinessPosture.operator_approval_gate,
        jurisdiction_risk_gate: latestPrivateReadinessPosture.jurisdiction_risk_gate,
        live_binding_gate: latestPrivateReadinessPosture.live_binding_gate,
        secret_handling_gate: latestPrivateReadinessPosture.secret_handling_gate,
        stop_behavior_gate: latestPrivateReadinessPosture.stop_behavior_gate
      })
    : null;

  return {
    latest_order_fill_surface: latestOrderFillSurface ?? null,
    latest_public_market_liveness_surface: latestPublicMarketLivenessSurface ?? null,
    latest_private_readiness_preflight_surface: latestPrivateReadinessPreflightSurface ?? null,
    latest_private_readiness_posture: latestPrivateReadinessPosture ?? null,
    private_readiness_posture_history: privateReadinessPostureHistory,
    latest_private_readiness_policy_decision: latestPrivateReadinessPolicyDecision,
    latest_account_position_risk_mirror_surface: latestAccountPositionRiskMirrorSurface ?? null
  };
}

function latestUpdatedAt(
  inputs: ReadonlyArray<{ updated_at: string } | null | undefined>
): string {
  const timestamps = inputs
    .map((input) => input?.updated_at)
    .filter((timestamp): timestamp is string => typeof timestamp === "string");
  return timestamps.sort().at(-1) ?? new Date(0).toISOString();
}
