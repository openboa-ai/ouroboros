import type {
  PaperTradingAccountSnapshot,
  PaperTradingFillSummary,
  PaperTradingOrderSummary,
  PaperTradingPublicExecutionSnapshotSummary,
  TradingProfitLossReadModel
} from "@ouroboros/domain";
import { PAPER_TRADING_ACCOUNT_EQUITY_USDT, PAPER_TRADING_COST_BPS } from "./evaluation";
import type { PaperTradingSystemEvent } from "./events";

export type { PaperTradingSystemEvent } from "./events";

const PAPER_MARGIN_FRACTION = 0.02;

export interface PaperTradingEngineState {
  account: PaperTradingAccountSnapshot;
  openOrders: PaperTradingOrderSummary[];
  processedTradingSystemEventIds: string[];
  processedPublicTradeIds: string[];
  latestFill?: PaperTradingFillSummary;
}

export interface PaperTradingEngineCheckpointInput {
  previous?: PaperTradingEngineState;
  marketPrice: number;
  observedAt: string;
  publicExecutionSnapshot?: PaperTradingPublicExecutionSnapshotSummary;
  events: PaperTradingSystemEvent[];
}

export interface PaperTradingEngineCheckpointResult extends PaperTradingEngineState {
  score: TradingProfitLossReadModel;
  scoreDelta: TradingProfitLossReadModel;
  processedEventIdsThisCheckpoint: string[];
}

export function initialPaperTradingEngineState(): PaperTradingEngineState {
  return {
    account: paperAccountSnapshot({
      walletBalance: PAPER_TRADING_ACCOUNT_EQUITY_USDT,
      realizedPnl: 0,
      unrealizedPnl: 0,
      feePaid: 0,
      slippagePaid: 0,
      fundingPaid: 0,
      positionQuantity: 0,
      averageEntryPrice: undefined,
      markPrice: 0
    }),
    openOrders: [],
    processedTradingSystemEventIds: [],
    processedPublicTradeIds: []
  };
}

export function restorePaperTradingEngineState(input: {
  account?: PaperTradingAccountSnapshot;
  openOrders?: PaperTradingOrderSummary[];
  processedTradingSystemEventIds?: string[];
  processedPublicTradeIds?: string[];
  latestFill?: PaperTradingFillSummary;
}): PaperTradingEngineState {
  return {
    account: input.account ?? initialPaperTradingEngineState().account,
    openOrders: [...(input.openOrders ?? [])],
    processedTradingSystemEventIds: [...(input.processedTradingSystemEventIds ?? [])],
    processedPublicTradeIds: [...(input.processedPublicTradeIds ?? [])],
    latestFill: input.latestFill
  };
}

export function applyPaperTradingCheckpoint(
  input: PaperTradingEngineCheckpointInput
): PaperTradingEngineCheckpointResult {
  const previous = input.previous ?? initialPaperTradingEngineState();
  const previousScore = paperTradingScoreFromAccount(previous.account);
  let mutable = mutableState(previous, input.marketPrice);
  const processedEventIdsThisCheckpoint: string[] = [];

  for (const event of input.events) {
    if (mutable.processedTradingSystemEventIds.includes(event.event_id)) {
      continue;
    }
    mutable.processedTradingSystemEventIds.push(event.event_id);
    processedEventIdsThisCheckpoint.push(event.event_id);
    if (event.event_kind === "order_request") {
      mutable.openOrders.push(orderFromEvent(event));
      continue;
    }
    if (event.event_kind === "cancel_order") {
      mutable.openOrders = mutable.openOrders.map((order) => (
        event.order_id === undefined || order.order_id === event.order_id
          ? { ...order, status: "canceled", remaining_quantity: "0", updated_at: input.observedAt }
          : order
      ));
    }
  }

  const needsExecutionEvidence = mutable.openOrders.some((order) =>
    order.status === "open" || order.status === "partially_filled"
  );
  if (needsExecutionEvidence && !input.publicExecutionSnapshot) {
    throw new Error("public_execution_stream_unavailable");
  }
  if (input.publicExecutionSnapshot) {
    mutable = fillOpenOrders(mutable, input.publicExecutionSnapshot, input.observedAt);
  }

  mutable.account = paperAccountSnapshot({
    ...mutable,
    markPrice: input.marketPrice
  });
  mutable.openOrders = mutable.openOrders.filter((order) =>
    order.status === "open" || order.status === "partially_filled"
  );

  const score = paperTradingScoreFromAccount(mutable.account);
  return {
    account: mutable.account,
    openOrders: mutable.openOrders,
    processedTradingSystemEventIds: mutable.processedTradingSystemEventIds,
    processedPublicTradeIds: mutable.processedPublicTradeIds,
    latestFill: mutable.latestFill,
    score,
    scoreDelta: subtractScore(score, previousScore),
    processedEventIdsThisCheckpoint
  };
}

function orderFromEvent(
  event: Extract<PaperTradingSystemEvent, { event_kind: "order_request" }>
): PaperTradingOrderSummary {
  const orderId = `paper-order-${safeSummaryId(event.event_id)}`;
  const createdAt = event.observed_at;
  if (event.gateway_outcome !== "dry_run_only") {
    return {
      order_id: orderId,
      event_id: event.event_id,
      side: event.order_request.side,
      order_type: event.order_request.order_type,
      quantity: event.order_request.quantity,
      limit_price: event.order_request.limit_price,
      status: "rejected",
      cumulative_filled_quantity: "0",
      remaining_quantity: "0",
      created_at: createdAt,
      updated_at: createdAt,
      ledger_ref: event.ledger_ref
    };
  }
  return {
    order_id: orderId,
    event_id: event.event_id,
    side: event.order_request.side,
    order_type: event.order_request.order_type,
    quantity: event.order_request.quantity,
    limit_price: event.order_request.limit_price,
    status: "open",
    cumulative_filled_quantity: "0",
    remaining_quantity: event.order_request.quantity,
    created_at: createdAt,
    updated_at: createdAt,
    ledger_ref: event.ledger_ref
  };
}

interface MutablePaperState {
  walletBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  feePaid: number;
  slippagePaid: number;
  fundingPaid: number;
  positionQuantity: number;
  averageEntryPrice?: number;
  markPrice: number;
  account: PaperTradingAccountSnapshot;
  openOrders: PaperTradingOrderSummary[];
  processedTradingSystemEventIds: string[];
  processedPublicTradeIds: string[];
  latestFill?: PaperTradingFillSummary;
}

function mutableState(previous: PaperTradingEngineState, markPrice: number): MutablePaperState {
  const positionQuantity = signedPositionQuantity(previous.account.position);
  return {
    walletBalance: parseDecimal(previous.account.wallet_balance_usdt, PAPER_TRADING_ACCOUNT_EQUITY_USDT),
    realizedPnl: parseDecimal(previous.account.realized_pnl_usdt),
    unrealizedPnl: parseDecimal(previous.account.unrealized_pnl_usdt),
    feePaid: parseDecimal(previous.account.fee_paid_usdt),
    slippagePaid: parseDecimal(previous.account.slippage_paid_usdt),
    fundingPaid: parseDecimal(previous.account.funding_paid_usdt),
    positionQuantity,
    averageEntryPrice: previous.account.position.average_entry_price
      ? parseDecimal(previous.account.position.average_entry_price)
      : undefined,
    markPrice,
    account: previous.account,
    openOrders: [...previous.openOrders],
    processedTradingSystemEventIds: [...previous.processedTradingSystemEventIds],
    processedPublicTradeIds: [...previous.processedPublicTradeIds],
    latestFill: previous.latestFill
  };
}

function signedPositionQuantity(position: PaperTradingAccountSnapshot["position"]): number {
  const quantity = parseDecimal(position.quantity);
  if (position.side === "short") {
    return -quantity;
  }
  if (position.side === "long") {
    return quantity;
  }
  return 0;
}

function fillOpenOrders(
  state: MutablePaperState,
  publicExecution: PaperTradingPublicExecutionSnapshotSummary,
  observedAt: string
): MutablePaperState {
  let next = { ...state, openOrders: [...state.openOrders] };
  const updatedOrders: PaperTradingOrderSummary[] = [];
  const consumedPublicTradeIds = new Set<string>();
  const consumedPublicTradeQuantities = new Map<string, number>();
  for (const order of next.openOrders) {
    if (order.status !== "open" && order.status !== "partially_filled") {
      updatedOrders.push(order);
      continue;
    }
    if (order.order_type === "market") {
      const ticker = publicExecution.book_ticker;
      if (!ticker) {
        updatedOrders.push(order);
        continue;
      }
      const tickerTime = ticker.event_time ?? publicExecution.observed_at;
      if (!tradeCanFillOrderAfterCreation(tickerTime, order.created_at)) {
        updatedOrders.push(order);
        continue;
      }
      const fillPrice = parseDecimal(order.side === "buy" ? ticker.ask_price : ticker.bid_price);
      const topQuantity = parseDecimal(order.side === "buy" ? ticker.ask_quantity : ticker.bid_quantity);
      const fillQuantity = Math.min(parseDecimal(order.remaining_quantity), topQuantity);
      if (fillQuantity <= 0) {
        updatedOrders.push(order);
        continue;
      }
      next = applyFill(next, order, {
        price: fillPrice,
        quantity: fillQuantity,
        remainingQuantityBeforeFill: parseDecimal(order.remaining_quantity),
        tradeTime: tickerTime,
        sourceTradeId: `${publicExecution.stream_marker}:bookTicker`
      });
      updatedOrders.push(updatedOrderAfterFill(order, fillPrice, fillQuantity, observedAt));
      continue;
    }

    let remaining = parseDecimal(order.remaining_quantity);
    let cumulative = parseDecimal(order.cumulative_filled_quantity);
    let weightedNotional = parseDecimal(order.average_fill_price) * cumulative;
    let status: PaperTradingOrderSummary["status"] = order.status;
    for (const trade of publicExecution.agg_trades) {
      if (remaining <= 0 || next.processedPublicTradeIds.includes(trade.trade_id)) {
        continue;
      }
      const tradeQuantity = parseDecimal(trade.quantity);
      const consumedQuantity = consumedPublicTradeQuantities.get(trade.trade_id) ?? 0;
      const availableTradeQuantity = Math.max(0, tradeQuantity - consumedQuantity);
      if (availableTradeQuantity <= 0) {
        continue;
      }
      if (!tradeCanFillOrderAfterCreation(trade.trade_time, order.created_at)) {
        continue;
      }
      const tradePrice = parseDecimal(trade.price);
      const canFill = order.side === "buy"
        ? tradePrice <= parseDecimal(order.limit_price)
        : tradePrice >= parseDecimal(order.limit_price);
      if (!canFill) {
        continue;
      }
      const fillQuantity = Math.min(remaining, availableTradeQuantity);
      if (fillQuantity <= 0) {
        continue;
      }
      consumedPublicTradeQuantities.set(trade.trade_id, consumedQuantity + fillQuantity);
      consumedPublicTradeIds.add(trade.trade_id);
      next = applyFill(next, order, {
        price: tradePrice,
        quantity: fillQuantity,
        remainingQuantityBeforeFill: remaining,
        tradeTime: trade.trade_time,
        sourceTradeId: trade.trade_id
      });
      remaining -= fillQuantity;
      cumulative += fillQuantity;
      weightedNotional += tradePrice * fillQuantity;
      status = remaining <= 1e-12 ? "filled" : "partially_filled";
    }
    updatedOrders.push({
      ...order,
      status,
      cumulative_filled_quantity: formatDecimal(cumulative),
      remaining_quantity: formatDecimal(Math.max(0, remaining)),
      average_fill_price: cumulative > 0 ? formatDecimal(weightedNotional / cumulative) : order.average_fill_price,
      updated_at: observedAt
    });
  }
  for (const tradeId of consumedPublicTradeIds) {
    if (!next.processedPublicTradeIds.includes(tradeId)) {
      next.processedPublicTradeIds.push(tradeId);
    }
  }
  next.openOrders = updatedOrders;
  return next;
}

function tradeCanFillOrderAfterCreation(tradeTime: string, orderCreatedAt: string): boolean {
  const tradeEpochMs = Date.parse(tradeTime);
  const orderEpochMs = Date.parse(orderCreatedAt);
  if (!Number.isFinite(tradeEpochMs) || !Number.isFinite(orderEpochMs)) {
    return false;
  }
  return tradeEpochMs >= orderEpochMs;
}

function updatedOrderAfterFill(
  order: PaperTradingOrderSummary,
  fillPrice: number,
  fillQuantity: number,
  observedAt: string
): PaperTradingOrderSummary {
  const previousCumulative = parseDecimal(order.cumulative_filled_quantity);
  const previousRemaining = parseDecimal(order.remaining_quantity);
  const cumulative = previousCumulative + fillQuantity;
  const remaining = Math.max(0, previousRemaining - fillQuantity);
  const previousAverageNotional = parseDecimal(order.average_fill_price) * previousCumulative;
  return {
    ...order,
    status: remaining <= 1e-12 ? "filled" : "partially_filled",
    cumulative_filled_quantity: formatDecimal(cumulative),
    remaining_quantity: formatDecimal(remaining),
    average_fill_price: formatDecimal((previousAverageNotional + fillPrice * fillQuantity) / cumulative),
    updated_at: observedAt
  };
}

function applyFill(
  state: MutablePaperState,
  order: PaperTradingOrderSummary,
  fill: {
    price: number;
    quantity: number;
    remainingQuantityBeforeFill: number;
    tradeTime: string;
    sourceTradeId?: string;
  }
): MutablePaperState {
  if (fill.quantity <= 0 || fill.price <= 0) {
    return state;
  }
  const notional = Math.abs(fill.price * fill.quantity);
  const fee = notional * PAPER_TRADING_COST_BPS.fee_bps / 10_000;
  const slippage = notional * PAPER_TRADING_COST_BPS.slippage_bps / 10_000;
  const funding = notional * PAPER_TRADING_COST_BPS.funding_bps / 10_000;
  const signedFillQuantity = order.side === "buy" ? fill.quantity : -fill.quantity;
  const positionUpdate = applyPositionFill({
    positionQuantity: state.positionQuantity,
    averageEntryPrice: state.averageEntryPrice,
    signedFillQuantity,
    fillPrice: fill.price
  });
  const latestFill: PaperTradingFillSummary = {
    fill_id: `paper-fill-${safeSummaryId(order.order_id)}-${safeSummaryId(fill.sourceTradeId ?? fill.tradeTime)}`,
    order_id: order.order_id,
    fill_status: Math.abs(fill.remainingQuantityBeforeFill - fill.quantity) <= 1e-12
      ? "filled"
      : "partially_filled",
    fill_price: formatDecimal(fill.price),
    fill_quantity: formatDecimal(fill.quantity),
    fee_usdt: formatDecimal(fee),
    slippage_usdt: formatDecimal(slippage),
    funding_usdt: formatDecimal(funding),
    trade_time: fill.tradeTime,
    source_trade_id: fill.sourceTradeId
  };
  const walletBalance = state.walletBalance + positionUpdate.realizedPnlDelta - fee - slippage - funding;
  return {
    ...state,
    walletBalance,
    realizedPnl: state.realizedPnl + positionUpdate.realizedPnlDelta,
    feePaid: state.feePaid + fee,
    slippagePaid: state.slippagePaid + slippage,
    fundingPaid: state.fundingPaid + funding,
    positionQuantity: positionUpdate.positionQuantity,
    averageEntryPrice: positionUpdate.averageEntryPrice,
    latestFill
  };
}

function applyPositionFill(input: {
  positionQuantity: number;
  averageEntryPrice?: number;
  signedFillQuantity: number;
  fillPrice: number;
}): { positionQuantity: number; averageEntryPrice?: number; realizedPnlDelta: number } {
  const existing = input.positionQuantity;
  const fill = input.signedFillQuantity;
  if (Math.abs(existing) <= 1e-12) {
    return {
      positionQuantity: fill,
      averageEntryPrice: input.fillPrice,
      realizedPnlDelta: 0
    };
  }
  if (Math.sign(existing) === Math.sign(fill)) {
    const nextQuantity = existing + fill;
    const currentNotional = Math.abs(existing) * (input.averageEntryPrice ?? input.fillPrice);
    const fillNotional = Math.abs(fill) * input.fillPrice;
    return {
      positionQuantity: nextQuantity,
      averageEntryPrice: Math.abs(nextQuantity) <= 1e-12
        ? undefined
        : (currentNotional + fillNotional) / Math.abs(nextQuantity),
      realizedPnlDelta: 0
    };
  }

  const closingQuantity = Math.min(Math.abs(existing), Math.abs(fill));
  const averageEntryPrice = input.averageEntryPrice ?? input.fillPrice;
  const realizedPnlDelta = existing > 0
    ? (input.fillPrice - averageEntryPrice) * closingQuantity
    : (averageEntryPrice - input.fillPrice) * closingQuantity;
  const nextQuantity = existing + fill;
  return {
    positionQuantity: Math.abs(nextQuantity) <= 1e-12 ? 0 : nextQuantity,
    averageEntryPrice: Math.abs(nextQuantity) <= 1e-12
      ? undefined
      : Math.sign(nextQuantity) === Math.sign(existing)
        ? averageEntryPrice
        : input.fillPrice,
    realizedPnlDelta
  };
}

function paperAccountSnapshot(input: {
  walletBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  feePaid: number;
  slippagePaid: number;
  fundingPaid: number;
  positionQuantity: number;
  averageEntryPrice?: number;
  markPrice: number;
  openOrders?: PaperTradingOrderSummary[];
}): PaperTradingAccountSnapshot {
  const positionQuantity = input.positionQuantity;
  const averageEntryPrice = input.averageEntryPrice;
  const unrealizedPnl = averageEntryPrice === undefined || Math.abs(positionQuantity) <= 1e-12
    ? 0
    : positionQuantity > 0
      ? (input.markPrice - averageEntryPrice) * positionQuantity
      : (averageEntryPrice - input.markPrice) * Math.abs(positionQuantity);
  const notional = Math.abs(positionQuantity * input.markPrice);
  const marginReserved = notional * PAPER_MARGIN_FRACTION;
  const equity = input.walletBalance + unrealizedPnl;
  return {
    wallet_balance_usdt: formatDecimal(input.walletBalance),
    available_balance_usdt: formatDecimal(equity - marginReserved),
    equity_usdt: formatDecimal(equity),
    realized_pnl_usdt: formatDecimal(input.realizedPnl),
    unrealized_pnl_usdt: formatDecimal(unrealizedPnl),
    fee_paid_usdt: formatDecimal(input.feePaid),
    slippage_paid_usdt: formatDecimal(input.slippagePaid),
    funding_paid_usdt: formatDecimal(input.fundingPaid),
    margin_reserved_usdt: formatDecimal(marginReserved),
    position: {
      symbol: "BTCUSDT",
      quantity: formatDecimal(Math.abs(positionQuantity)),
      side: positionQuantity > 0 ? "long" : positionQuantity < 0 ? "short" : "flat",
      average_entry_price: averageEntryPrice === undefined ? undefined : formatDecimal(averageEntryPrice),
      mark_price: formatDecimal(input.markPrice),
      notional_usdt: formatDecimal(notional)
    },
    open_order_count: input.openOrders?.filter((order) =>
      order.status === "open" || order.status === "partially_filled"
    ).length ?? 0,
    authority_status: "not_live"
  };
}

export function paperTradingScoreFromAccount(
  account: PaperTradingAccountSnapshot,
  initialEquityUsdt = PAPER_TRADING_ACCOUNT_EQUITY_USDT
): TradingProfitLossReadModel {
  const revenue = parseDecimal(account.realized_pnl_usdt) + parseDecimal(account.unrealized_pnl_usdt);
  const cost = parseDecimal(account.fee_paid_usdt) +
    parseDecimal(account.slippage_paid_usdt) +
    parseDecimal(account.funding_paid_usdt);
  const net = parseDecimal(account.equity_usdt) - initialEquityUsdt;
  return {
    revenue_usdt: roundProfit(revenue),
    cost_usdt: roundProfit(cost),
    net_revenue_usdt: roundProfit(net),
    net_return_pct: roundProfit(net / initialEquityUsdt * 100)
  };
}

function subtractScore(
  right: TradingProfitLossReadModel,
  left: TradingProfitLossReadModel
): TradingProfitLossReadModel {
  return {
    revenue_usdt: roundProfit(right.revenue_usdt - left.revenue_usdt),
    cost_usdt: roundProfit(right.cost_usdt - left.cost_usdt),
    net_revenue_usdt: roundProfit(right.net_revenue_usdt - left.net_revenue_usdt),
    net_return_pct: roundProfit(right.net_return_pct - left.net_return_pct)
  };
}

function parseDecimal(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return (Math.round(value * 1_000_000_000_000) / 1_000_000_000_000)
    .toFixed(12)
    .replace(/\.?0+$/, "");
}

function roundProfit(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function safeSummaryId(value: string): string {
  const chars: string[] = [];
  let previousWasSeparator = true;
  for (const char of value) {
    if (chars.length >= 80) {
      break;
    }
    if (isSafeSummaryIdChar(char)) {
      chars.push(char);
      previousWasSeparator = false;
      continue;
    }
    if (!previousWasSeparator) {
      chars.push("-");
      previousWasSeparator = true;
    }
  }
  while (chars.at(-1) === "-") {
    chars.pop();
  }
  return chars.join("") || "event";
}

function isSafeSummaryIdChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === "_" ||
    char === "-"
  );
}
