export type {
  AutomationStatus,
  ImportPreflightSeverity,
  ImportPreflightStatus,
  OperationStatus,
  OrchestratorMode,
  TradingMode,
} from "./states";

export type ProviderStatus = {
  name: "Codex" | "Claude Code";
  statusLabel: string;
  usageLabel: string;
};

export type MetricCardData = {
  label: string;
  value: string;
  delta: string;
  description: string;
  icon: "momentum" | "risk" | "leverage" | "up" | "down";
};

export type PricePoint = {
  label: string;
  btc: number;
  eth: number;
};

export type EquityPoint = {
  label: string;
  value: number;
};

export type ExposurePoint = {
  symbol: string;
  value: number;
};

export type LivePosition = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: string;
  entry: string;
  pnl: string;
  protectiveStop: string;
  contextTag: string;
};

export type LiveOrder = {
  id: string;
  symbol: string;
  kind: string;
  status: string;
  statusTone: "neutral" | "positive" | "warning" | "danger";
  summary: string;
};

export type LaneEventState = {
  id: string;
  scope: "positions" | "orders";
  kind: string;
  summary: string;
  timestamp: string;
};

export type DecisionEntry = {
  id: string;
  kind: string;
  tone: "positive" | "warning" | "neutral";
  headline: string;
  reason: string;
  timestamp: string;
};
