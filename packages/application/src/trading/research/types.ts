import type {
  PaperTradingMarketDataFreshness,
  PaperTradingMarketDataSourceKind,
  PaperTradingMarketDataSourcePriority,
  PaperTradingComparisonTickContext,
  Ref,
  TradingEvaluationDisqualificationReason
} from "@ouroboros/domain";

export type TradingResearchAgentProvider = "codex" | "claude_code" | "fixture";

export type TradingResearchMode = "replay";

export type TradingResearchDecision = "keep" | "discard" | "crash";
export type TradingEvaluationStatus = "accepted" | "disqualified";
export type TradingRiskDecision = "valid_order_request" | "invalid_order_request" | "no_order_request";
export type TradingArtifactRunnerKind = "host_process" | "docker_sandboxes_sbx";

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
  arena_context?: string;
}

export interface AgentEditResult {
  status: "edited" | "no_change" | "failed";
  summary: string;
  changed_paths?: string[];
  failure_reason?: AgentEditFailureReason;
  command?: string[];
  stdout?: string;
  stderr?: string;
  error?: string;
}

export type AgentEditFailureReason =
  | "codex_cli_unavailable"
  | "codex_environment_blocked"
  | "codex_timed_out"
  | "codex_cli_failed";

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
  source_kind?: PaperTradingMarketDataSourceKind;
  source_priority?: PaperTradingMarketDataSourcePriority;
  freshness?: PaperTradingMarketDataFreshness;
  ws_connected?: boolean;
  rest_fallback_used?: boolean;
  gap_detected?: boolean;
  last_update_id?: string;
  stream_marker?: string;
}

export interface PaperTradingApiProviderComparisonTickHooks {
  deliver(input: {
    market: MarketSnapshot;
    provider_request_count: number;
    delivered_at: string;
  }): Promise<PaperTradingComparisonTickContext | undefined>;
  acknowledge(input: {
    context: unknown;
    provider_request_count: number;
    acknowledged_at: string;
  }): Promise<{
    acknowledgement_ref: Ref;
    acknowledgement_digest: string;
  }>;
}

export type TradingApiMarketSnapshot = Omit<MarketSnapshot, "expected_direction">;

export interface AccountState {
  equity: number;
  max_position_notional: number;
  max_risk_fraction: number;
  target_risk_fraction: number;
}

export type TradingApiAccountState = Omit<AccountState, "target_risk_fraction">;

export interface OrderRequest {
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
  sandbox_base_url?: string;
  close(): Promise<void>;
  requests(): TradingProviderRequestLog[];
  candidate_input: ReplayTradingCandidateInput;
}

export interface ReplayTradingCandidateInput {
  market: TradingApiMarketSnapshot;
  account: TradingApiAccountState;
}

export interface ReplayTradingScenario {
  id: string;
  description: string;
  market: MarketSnapshot;
  account: AccountState;
  outcome: ReplayTradingScenarioOutcome;
}

export interface ReplayTradingScenarioOutcome {
  exit_price: number;
  fee_bps: number;
  slippage_bps: number;
  funding_bps: number;
}

export interface ArtifactRunResult {
  status: "completed" | "crashed";
  runner_kind: TradingArtifactRunnerKind;
  artifact_dir: string;
  entrypoint: string[];
  events_path: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  events: TradingSystemEvent[];
  provider_requests: TradingProviderRequestLog[];
  sandbox_name?: string;
  command_evidence?: TradingArtifactCommandEvidence[];
  error?: string;
}

export interface TradingArtifactCommandEvidence {
  command: string[];
  exit_code: number | null;
  signal?: string;
  timed_out?: boolean;
  error_message?: string;
  stdout: string;
  stderr: string;
  started_at: string;
  completed_at: string;
}

export interface TradingArtifactCommandEvidenceSummary {
  command: string[];
  exit_code: number | null;
  signal?: string;
  timed_out?: boolean;
  error_message?: string;
  stdout_preview: string;
  stderr_preview: string;
  started_at: string;
  completed_at: string;
}

export interface TradingEvaluationMetric {
  name: string;
  score: number;
  detail: string;
}

export interface TradingProfitLoss {
  revenue_usdt: number;
  cost_usdt: number;
  net_revenue_usdt: number;
  net_return_pct: number;
}

export interface TradingEvaluationResult {
  status: TradingEvaluationStatus;
  score: number;
  metrics: TradingEvaluationMetric[];
  summary: string;
  risk_decision: TradingRiskDecision;
  profit_loss: TradingProfitLoss;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
  scenario_results?: TradingScenarioEvaluationResult[];
}

export interface TradingScenarioEvaluationResult {
  scenario_id: string;
  runner_kind: TradingArtifactRunnerKind;
  sandbox_name?: string;
  status: TradingEvaluationStatus;
  run_status: ArtifactRunResult["status"];
  score: number;
  metrics: TradingEvaluationMetric[];
  summary: string;
  risk_decision: TradingRiskDecision;
  profit_loss: TradingProfitLoss;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
  events_path: string;
  provider_request_count: number;
  runner_command_count: number;
  runner_command_evidence?: TradingArtifactCommandEvidenceSummary[];
  candidate_events: TradingSystemEvent[];
  provider_requests: TradingProviderRequestLog[];
}

export interface TradingResearchNotebookEntry {
  iteration: number;
  decision: TradingResearchDecision;
  score: number;
  summary: string;
  agent_status: AgentEditResult["status"];
  agent_summary: string;
  agent_changed_paths?: string[];
  agent_failure_reason?: AgentEditFailureReason;
  agent_command?: string[];
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
