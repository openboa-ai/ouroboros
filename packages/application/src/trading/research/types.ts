import type {
  PaperTradingHandoffConformanceReason,
  PaperTradingHandoffConformanceStatus,
  PaperTradingMarketDataFreshness,
  PaperTradingMarketDataSourceKind,
  PaperTradingMarketDataSourcePriority,
  PaperTradingComparisonTickContext,
  Ref,
  ResearchWorkerCheckpointNotebook,
  ResearchWorkerCheckpointTerminalReason,
  ResearchWorkerCheckpointTerminalStatus,
  ResearchPreflightCommitmentRecord,
  TradingEvaluationDisqualificationReason
} from "@ouroboros/domain";
import type {
  CandidateSandboxNetworkPolicyAttestationEvidence
} from "./candidate-sandbox-network-policy";

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
  limit_price?: string;
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

export interface TradingArtifactPaperHandoffProbeResult {
  status: "completed" | "crashed";
  runner_kind: TradingArtifactRunnerKind;
  artifact_dir: string;
  entrypoint: string[];
  instance_id: string;
  started_at: string;
  completed_at: string;
  timed_out: boolean;
  stdout: string;
  stderr: string;
  exit_code?: number;
  output_lines: string[];
  provider_requests: TradingProviderRequestLog[];
  candidate_effect?: {
    started_at: string;
    completed_at: string;
  };
  candidate_egress_policy_evidence?:
    CandidateSandboxNetworkPolicyAttestationEvidence;
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

export interface TradingPaperHandoffConformanceEvidence {
  protocol_version: "paper_trading_event_protocol_v1";
  system_code_artifact_digest: string;
  runner_kind: TradingArtifactRunnerKind;
  status: PaperTradingHandoffConformanceStatus;
  reason: PaperTradingHandoffConformanceReason;
  provider_request_count: number;
  decision_event_kind?: "order_request" | "hold" | "no_action";
  heartbeat_count: number;
  runtime_stopped: boolean;
  started_at: string;
  completed_at: string;
  runnable_paper_handoff: boolean;
  candidate_effect?: {
    started_at: string;
    completed_at: string;
  };
  candidate_egress_policy_evidence?:
    CandidateSandboxNetworkPolicyAttestationEvidence;
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
  paper_handoff_conformance?: TradingPaperHandoffConformanceEvidence;
}

export interface ResearchWorkerDevelopmentFeedback {
  status: TradingEvaluationStatus;
  score: number;
  metrics: TradingEvaluationMetric[];
  summary: string;
  risk_decision: TradingRiskDecision;
  profit_loss: TradingProfitLoss;
  disqualification_reason?: TradingEvaluationDisqualificationReason;
}

export type ResearchWorkerSessionStatus =
  | "open"
  | "selected"
  | "finished_without_submission"
  | "failed";

export interface ResearchWorkerToolStatus {
  session_status: ResearchWorkerSessionStatus;
  submission_limit: number;
  completed_submission_count: number;
  remaining_submission_count: number;
  selected_submission_sequence: number | null;
}

export interface ResearchWorkerDevelopmentSubmissionInput {
  idempotency_key: string;
  research_note: string;
}

export interface ResearchWorkerDevelopmentSubmissionRequest
  extends ResearchWorkerDevelopmentSubmissionInput {
  submission_sequence: number;
}

export interface ResearchWorkerDevelopmentEvaluationEvidence {
  submission_sequence: number;
  artifact_dir: string;
  artifact_digest: string;
  started_at: string;
  completed_at: string;
  evaluation: TradingEvaluationResult;
  feedback: ResearchWorkerDevelopmentFeedback;
}

export interface ResearchWorkerDevelopmentSubmissionResult {
  session_status: "open";
  submission_sequence: number;
  remaining_submission_count: number;
  feedback: ResearchWorkerDevelopmentFeedback;
}

export interface ResearchWorkerDevelopmentSelectionInput {
  idempotency_key: string;
  submission_sequence: number;
  reason: string;
}

export interface ResearchWorkerSelectionResult {
  session_status: "selected";
  submission_sequence: number;
  reason: string;
}

export interface ResearchWorkerFinishInput {
  idempotency_key: string;
  reason: string;
}

export interface ResearchWorkerFinishResult {
  session_status: "finished_without_submission";
  reason: string;
}

export interface ResearchWorkerToolPort {
  status(): Promise<ResearchWorkerToolStatus>;
  submitDevelopment(
    input: ResearchWorkerDevelopmentSubmissionInput
  ): Promise<ResearchWorkerDevelopmentSubmissionResult>;
  selectDevelopment(
    input: ResearchWorkerDevelopmentSelectionInput
  ): Promise<ResearchWorkerSelectionResult>;
  finishWithoutSubmission(
    input: ResearchWorkerFinishInput
  ): Promise<ResearchWorkerFinishResult>;
}

export interface ResearchWorkerSessionInput {
  artifact_dir: string;
  program_path: string;
  notebook_path: string;
  submission_limit: number;
  timeout_ms: number;
  arena_context?: string;
  tools: ResearchWorkerToolPort;
}

export type ResearchWorkerSessionResult =
  | {
      status: "selected";
      summary: string;
      selected_submission_sequence: number;
      provider_command_count: number;
    }
  | {
      status: "finished_without_submission";
      summary: string;
      provider_command_count: number;
    }
  | {
      status: "failed";
      summary: string;
      provider_command_count: number;
      failure_reason?: AgentEditFailureReason;
      error?: string;
    };

export interface ResearchWorkerSessionAdapter {
  readonly agent: ManagedResearchAgent;
  runSession(input: ResearchWorkerSessionInput): Promise<ResearchWorkerSessionResult>;
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
  selected_for_sealed_submission?: boolean;
}

export interface TradingResearchNotebook {
  session_id: string;
  mode: TradingResearchMode;
  agent: ManagedResearchAgent;
  program_path: string;
  prior_checkpoint?: TradingResearchPriorCheckpoint;
  best_score?: number;
  best_artifact_dir?: string;
  session_protocol_version?: "research_worker_autonomous_session_v1";
  session_status?: Exclude<ResearchWorkerSessionStatus, "open">;
  selected_development_submission?: number;
  entries: TradingResearchNotebookEntry[];
}

export interface TradingResearchPriorCheckpoint {
  research_worker_checkpoint_id: string;
  terminal_status: ResearchWorkerCheckpointTerminalStatus;
  terminal_reason: ResearchWorkerCheckpointTerminalReason;
  admission_status?: "admitted" | "duplicate" | "quarantined";
  admission_reason?: string;
  notebook: ResearchWorkerCheckpointNotebook;
}

export interface TradingResearchLoopResult {
  session_id: string;
  run_root: string;
  notebook_path: string;
  research_preflight_commitment: ResearchPreflightCommitmentRecord;
  best_score?: number;
  best_artifact_dir?: string;
  session_status?: Exclude<ResearchWorkerSessionStatus, "open">;
  selected_development_submission?: number;
  submitted_artifact_dir?: string;
  submitted_artifact_digest?: string;
  sealed_admission?: {
    commitment_id: string;
    commitment_digest: string;
    suite_digest: string;
    submission_sequence: 1;
    artifact_digest: string;
    events_path: string;
    evaluation: TradingEvaluationResult;
  };
  entries: TradingResearchNotebookEntry[];
}
