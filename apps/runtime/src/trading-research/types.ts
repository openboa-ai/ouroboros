export type TradingResearchAgentProvider = "codex" | "claude" | "fixture";

export type TradingResearchMode = "replay";

export type TradingResearchDecision = "keep" | "discard" | "crash";

export interface ManagedResearchAgent {
  id: string;
  provider: TradingResearchAgentProvider;
  model?: string;
  permission_policy: "artifact_workspace_only" | "fixture_only";
}

export interface TradingSystemManifest {
  id: string;
  name: string;
  entrypoint: string[];
  editable_paths: string[];
  api_contract: "trading_api_provider_v1";
}

export interface AgentEditInput {
  agent: ManagedResearchAgent;
  artifact_dir: string;
  program_path: string;
  notebook_path: string;
  iteration: number;
  previous_best_score?: number;
}

export interface AgentEditResult {
  status: "edited" | "no_change" | "failed";
  summary: string;
  error?: string;
}

export interface TradingResearchAgentAdapter {
  readonly agent: ManagedResearchAgent;
  improveArtifact(input: AgentEditInput): Promise<AgentEditResult>;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  moving_average_fast: number;
  moving_average_slow: number;
  volatility: number;
  expected_direction: "long" | "short" | "flat";
  observed_at: string;
}

export interface AccountState {
  equity: number;
  max_position_notional: number;
  max_risk_fraction: number;
  target_risk_fraction: number;
}

export interface OrderIntent {
  symbol: string;
  side: "buy" | "sell" | "hold";
  quantity: number;
  order_type: "market" | "limit" | "none";
  reason?: string;
}

export interface OrderValidationResult {
  accepted: boolean;
  reason: string;
  notional: number;
  risk_fraction: number;
}

export interface TradingProviderRequestLog {
  at: string;
  method: string;
  path: string;
  body?: unknown;
  response_status: number;
}

export interface TradingSystemEvent {
  event: string;
  at?: string;
  [key: string]: unknown;
}

export interface ReplayTradingApiProviderSession {
  base_url: string;
  close(): Promise<void>;
  requests(): TradingProviderRequestLog[];
  scenario: ReplayTradingScenario;
}

export interface ReplayTradingScenario {
  market: MarketSnapshot;
  account: AccountState;
}

export interface ArtifactRunResult {
  status: "completed" | "crashed";
  artifact_dir: string;
  entrypoint: string[];
  events_path: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  events: TradingSystemEvent[];
  provider_requests: TradingProviderRequestLog[];
  error?: string;
}

export interface TradingEvaluationMetric {
  name: string;
  score: number;
  detail: string;
}

export interface TradingEvaluationResult {
  status: "accepted" | "disqualified";
  score: number;
  metrics: TradingEvaluationMetric[];
  summary: string;
  risk_decision: "valid_order_intent" | "invalid_order_intent" | "no_order_intent";
}

export interface TradingResearchNotebookEntry {
  iteration: number;
  decision: TradingResearchDecision;
  score: number;
  summary: string;
  agent_summary: string;
  artifact_dir: string;
  events_path: string;
  started_at: string;
  completed_at: string;
  evaluation: TradingEvaluationResult;
}

export interface TradingResearchNotebook {
  session_id: string;
  mode: TradingResearchMode;
  agent: ManagedResearchAgent;
  program_path: string;
  best_score?: number;
  best_artifact_dir?: string;
  entries: TradingResearchNotebookEntry[];
}

export interface TradingResearchLoopResult {
  session_id: string;
  run_root: string;
  notebook_path: string;
  best_score?: number;
  best_artifact_dir?: string;
  entries: TradingResearchNotebookEntry[];
}
