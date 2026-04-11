import type {
  DecisionEntry,
  EvaluationRunDetailState
} from "../service-contract";
import { evaluationRunPath, WORKSPACE_ROOT } from "./paths";
import type { CollectionEntryRecord, MockWorkspaceStore } from "./types";

export type MockEvaluationKind = "backtest" | "paper";

type MockReplayTrade = EvaluationRunDetailState["trades"][number];

type MockReplayResult = {
  headline: string;
  summary: string;
  grossPnl: number;
  feeCost: number;
  slippageCost: number;
  modelCost: number;
  netPnl: number;
  tradeCount: number;
  positionCount: number;
  equityCurve: EvaluationRunDetailState["equityCurve"];
  trades: MockReplayTrade[];
  notes: string[];
};

function replayBars(kind: MockEvaluationKind, priceSeries: MockWorkspaceStore["dashboardSeedState"]["priceSeries"]) {
  if (kind === "paper" && priceSeries.length > 4) {
    return priceSeries.slice(-4);
  }
  return priceSeries;
}

function symbolNotional(symbol: "BTCUSDT" | "ETHUSDT") {
  return symbol === "BTCUSDT" ? 1600 : 900;
}

function pushTrade(
  trades: MockReplayTrade[],
  symbol: "BTCUSDT" | "ETHUSDT",
  previousPrice: number,
  currentPrice: number,
  label: string
) {
  const side = currentPrice >= previousPrice ? "LONG" : "SHORT";
  trades.push({
    symbol,
    side,
    entryTime: label,
    exitTime: label,
    entryPrice: previousPrice,
    exitPrice: currentPrice,
    netPnl: 0
  });
}

export function runMockReplay(
  kind: MockEvaluationKind,
  priceSeries: MockWorkspaceStore["dashboardSeedState"]["priceSeries"]
): MockReplayResult {
  const bars = replayBars(kind, priceSeries);
  if (bars.length < 2) {
    return {
      headline: `${kind === "backtest" ? "Backtest" : "Paper replay"} skipped: not enough market bars`,
      summary: "At least two market bars are required to produce a replay run.",
      grossPnl: 0,
      feeCost: 0,
      slippageCost: 0,
      modelCost: 0,
      netPnl: 0,
      tradeCount: 0,
      positionCount: 0,
      equityCurve: priceSeries.map((point) => ({ label: point.label, value: 0 })),
      trades: [],
      notes: ["Replay aborted because the price series contained fewer than two bars."]
    };
  }

  const feeRate = 0.0004;
  const slippageRate = kind === "backtest" ? 0.0002 : 0.0003;
  const modelCost = bars.length * (kind === "backtest" ? 0.35 : 0.25);
  const trades: MockReplayTrade[] = [];
  const equityCurve: EvaluationRunDetailState["equityCurve"] = [];
  let grossPnl = 0;
  let feeCost = 0;
  let slippageCost = 0;

  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];

    for (const [symbol, previousPrice, currentPrice] of [
      ["BTCUSDT", previous.btc, current.btc] as const,
      ["ETHUSDT", previous.eth, current.eth] as const
    ]) {
      const sign = currentPrice >= previousPrice ? 1 : -1;
      const notional = symbolNotional(symbol);
      const pnl = ((currentPrice - previousPrice) / previousPrice) * notional * sign;
      const fee = notional * feeRate;
      const slippage = notional * slippageRate;

      grossPnl += pnl;
      feeCost += fee;
      slippageCost += slippage;
      pushTrade(trades, symbol, previousPrice, currentPrice, current.label);
      trades[trades.length - 1].netPnl = Number((pnl - fee - slippage).toFixed(2));
    }

    equityCurve.push({
      label: current.label,
      value: Math.round(grossPnl - feeCost - slippageCost - modelCost)
    });
  }

  const netPnl = grossPnl - feeCost - slippageCost - modelCost;
  if (equityCurve.length > 0) {
    equityCurve[equityCurve.length - 1] = {
      ...equityCurve[equityCurve.length - 1],
      value: Math.round(netPnl)
    };
  }

  return {
    headline:
      netPnl >= 0
        ? `${kind === "backtest" ? "Backtest" : "Paper replay"} net PnL stayed positive after fees, slippage, and model cost.`
        : `${kind === "backtest" ? "Backtest" : "Paper replay"} lost edge after fees, slippage, and model cost.`,
    summary: `${kind === "backtest" ? "Backtest" : "Paper replay"} produced ${trades.length} trades across ${bars.length} replay bars with net PnL $${netPnl.toFixed(2)}.`,
    grossPnl,
    feeCost,
    slippageCost,
    modelCost,
    netPnl,
    tradeCount: trades.length,
    positionCount: 2,
    equityCurve,
    trades,
    notes: [
      "Mock replay uses a deterministic bar-by-bar directional fill model.",
      "Net PnL is after fees, slippage, and model cost."
    ]
  };
}

export function buildEvaluationDecision(
  id: string,
  kind: MockEvaluationKind,
  headline: string,
  summary: string,
  timestamp: string,
  tone: DecisionEntry["tone"]
): DecisionEntry {
  return {
    id,
    kind: kind === "backtest" ? "Backtest Evaluation" : "Paper Evaluation",
    tone,
    headline,
    reason: summary,
    timestamp
  };
}

export function evaluationCollectionRefs(store: MockWorkspaceStore) {
  return store.collectionsState.items.map(
    (item) => `${WORKSPACE_ROOT}/collections/items/${item.collection_id}/collection.json`
  );
}

export function evaluationRunRef(runId: string) {
  return evaluationRunPath(runId);
}
