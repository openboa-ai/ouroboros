export type TradingResearchAgentProvider = "codex" | "claude" | "fixture";

export type TradingResearchMode = "replay";

export type TradingResearchDecision = "keep" | "discard" | "crash";
export type TradingEvaluationStatus = "accepted" | "disqualified";
export type TradingRiskDecision = "valid_order_intent_draft" | "invalid_order_intent_draft" | "no_order_intent_draft";
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
}

export interface AccountState {
  equity: number;
  max_position_notional: number;
  max_risk_fraction: number;
  target_risk_fraction: number;
}

export interface OrderIntentDraft {
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
  scenario: ReplayTradingScenario;
}

export interface ReplayTradingScenario {
  id: string;
  description: string;
  market: MarketSnapshot;
  account: AccountState;
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

export interface TradingEvaluationResult {
  status: TradingEvaluationStatus;
  score: number;
  metrics: TradingEvaluationMetric[];
  summary: string;
  risk_decision: TradingRiskDecision;
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
  events_path: string;
  provider_request_count: number;
  runner_command_count: number;
  runner_command_evidence?: TradingArtifactCommandEvidenceSummary[];
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
