import type { DetailTarget } from "@/app/contracts";
export type Period = "week" | "day";
export interface InvestmentTarget extends DetailTarget {
  period?: Period;
  observation?: { time: string; value: string; metric: "equity" | "pnl" };
}
export interface InvestmentObservation {
  index: number;
  day: number;
  label: string;
  time: string;
  pnl: number;
  equity: number;
}
export interface InvestmentViewData {
  account: string;
  connection: string;
  unit: string;
  equity: string;
  observedAt: string;
  periods: Record<Period, { label: string; pnl: string; deposit: string }>;
  series: Record<Period, InvestmentObservation[]>;
  position: {
    contract: string;
    side: string;
    quantity: string;
    notional: string;
    margin: string;
    pnl: string;
    mark: string;
    entry: string;
  };
  order: {
    remaining: string;
    filledTotal: string;
    limit: string;
    fillProgress: number;
  };
  ceo: {
    id: string;
    name: string;
    role: string;
    writtenAt: string;
    headline: string;
    summary: string;
    contextLabel: string;
  };
}
