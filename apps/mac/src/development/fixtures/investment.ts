import type { Period } from "@/domains/investment/model";
import type { Scenario } from "@/app/contracts";
import type { InvestmentViewData } from "@/domains/investment/model";
const weeks = [
  0, 230, 160, 540, 410, 700, 610, 1150, 990, 1280, 1410, 1210, 1770, 1590,
  2010, 2190, 1860, 2220, 2670, 2400, 2730, 2990, 2810, 3210, 3100, 3370, 3290,
  3650,
];
const days = [0, 70, 15, 125, 210, 140, 290, 255, 430, 340, 470, 620];
function observations(period: Period, delayed = false) {
  return (period === "week" ? weeks : days).map((pnl, index, all) => {
    const day = period === "week" ? 7 + Math.floor(index / 4) : 13;
    const time =
      index === all.length - 1
        ? delayed
          ? "18:12"
          : "20:50"
        : `${String(period === "week" ? (index % 4) * 6 : Math.floor((index * (delayed ? 18 : 20)) / (all.length - 1))).padStart(2, "0")}:00`;
    return {
      index,
      day,
      label: period === "week" ? `Sep ${day}` : time,
      time: `Sep ${day}, 2026 · ${time} KST`,
      pnl,
      equity:
        (period === "week" ? 100000 + (index >= 14 ? 10000 : 0) : 113030) + pnl,
    };
  });
}

export function investmentFixture(scenario: Scenario): InvestmentViewData {
  const delayed = scenario === "delayed";
  return {
    account: "Treasury",
    connection: "Binance USDⓈ-M",
    unit: "USDT",
    equity: "113,650.00",
    observedAt: delayed ? "18:12 KST" : "20:50 KST",
    periods: {
      week: { label: "Sep 7–13, 2026", pnl: "+3,650.00", deposit: "10,000.00" },
      day: { label: "Sep 13, 2026", pnl: "+620.00", deposit: "0.00" },
    },
    series: {
      week: observations("week", delayed),
      day: observations("day", delayed),
    },
    position: {
      contract: "BTCUSDT",
      side: "Long",
      quantity: "0.20 BTC",
      notional: "21,960.00",
      margin: "2,196.00",
      pnl: "+360.00",
      mark: "109,800.00",
      entry: "108,000.00",
    },
    order: {
      remaining: "0.05 BTC",
      filledTotal: "0.05 / 0.10 BTC",
      limit: "109,700 USDT",
      fillProgress: 50,
    },
    ceo: {
      id: "atlas",
      name: "Atlas",
      role: "CEO",
      writtenAt: delayed ? "17:47" : "20:47",
      headline: "Reassess after the next fill",
      summary:
        "Keep the current position while the remaining order is reconciled.",
      contextLabel: "BTCUSDT · Position review · r12",
    },
  };
}
