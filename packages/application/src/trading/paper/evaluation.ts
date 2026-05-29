import type {
  LedgerChainReadModel,
  OrderRequestReadModel,
  PaperTradingMarketSnapshotSummary,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import type { MarketSnapshot } from "../research/types";

export const PAPER_TRADING_ACCOUNT_EQUITY_USDT = 10_000;
export const PAPER_TRADING_COST_BPS = {
  fee_bps: 4,
  slippage_bps: 3,
  funding_bps: 1
} as const;

export function zeroPaperTradingProfitLoss(): TradingProfitLossReadModel {
  return {
    revenue_usdt: 0,
    cost_usdt: 0,
    net_revenue_usdt: 0,
    net_return_pct: 0
  };
}

export function marketSnapshotSummary(
  market: MarketSnapshot
): PaperTradingMarketSnapshotSummary {
  return {
    symbol: "BTCUSDT",
    price: market.price,
    moving_average_fast: market.moving_average_fast,
    moving_average_slow: market.moving_average_slow,
    volatility: market.volatility,
    expected_direction: market.expected_direction,
    observed_at: market.observed_at,
    source_kind: market.source_kind ?? "binance_production_public_rest",
    source_priority: market.source_priority,
    freshness: market.freshness,
    ws_connected: market.ws_connected,
    rest_fallback_used: market.rest_fallback_used,
    gap_detected: market.gap_detected,
    last_update_id: market.last_update_id,
    stream_marker: market.stream_marker,
    authority_status: "read_only"
  };
}

export function scorePaperTradingOrder(input: {
  orderRequest?: Pick<OrderRequestReadModel, "side" | "quantity" | "limit_price"> | null;
  marketPrice: number;
  accountEquity?: number;
}): TradingProfitLossReadModel {
  const order = input.orderRequest;
  const quantity = parseFiniteNumber(order?.quantity);
  const entryPrice = parseFiniteNumber(order?.limit_price) ?? input.marketPrice;
  if (!order?.side || !quantity || !entryPrice) {
    return zeroPaperTradingProfitLoss();
  }

  const revenue = order.side === "sell"
    ? (entryPrice - input.marketPrice) * quantity
    : (input.marketPrice - entryPrice) * quantity;
  const notional = Math.abs(quantity * entryPrice);
  const cost = notional *
    (PAPER_TRADING_COST_BPS.fee_bps + PAPER_TRADING_COST_BPS.slippage_bps + PAPER_TRADING_COST_BPS.funding_bps) /
    10_000;
  const net = revenue - cost;
  const equity = input.accountEquity ?? PAPER_TRADING_ACCOUNT_EQUITY_USDT;
  return {
    revenue_usdt: roundProfit(revenue),
    cost_usdt: roundProfit(cost),
    net_revenue_usdt: roundProfit(net),
    net_return_pct: roundProfit(net / equity * 100)
  };
}

export function scorePaperLedgerChain(input: {
  chain?: LedgerChainReadModel | null;
  marketPrice: number;
  accountEquity?: number;
}): TradingProfitLossReadModel {
  if (
    !input.chain?.chain_complete ||
    input.chain.gateway_result?.decision_outcome !== "dry_run_only" ||
    input.chain.execution_result?.status !== "dry_run_recorded"
  ) {
    return zeroPaperTradingProfitLoss();
  }
  return scorePaperTradingOrder({
    orderRequest: input.chain.order_request,
    marketPrice: input.marketPrice,
    accountEquity: input.accountEquity
  });
}

export function addPaperTradingProfitLoss(
  left: TradingProfitLossReadModel,
  right: TradingProfitLossReadModel,
  accountEquity = PAPER_TRADING_ACCOUNT_EQUITY_USDT
): TradingProfitLossReadModel {
  const net = left.net_revenue_usdt + right.net_revenue_usdt;
  return {
    revenue_usdt: roundProfit(left.revenue_usdt + right.revenue_usdt),
    cost_usdt: roundProfit(left.cost_usdt + right.cost_usdt),
    net_revenue_usdt: roundProfit(net),
    net_return_pct: roundProfit(net / accountEquity * 100)
  };
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
