import type {
  CandidateInspectReadModel,
  FullCycleLineageReadModel,
  Ref,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import type { OuroborosStorePort } from "../ports/store";
import type { GatewayRuntimeBinding } from "../trading/gateway/runtime-binding";
import type {
  ArtifactRunResult,
  ManagedResearchAgent,
  TradingEvaluationResult,
  TradingResearchAgentAdapter,
  TradingResearchDecision
} from "../trading/research/types";

export interface RunAgentTradingCycleInput {
  store: OuroborosStorePort;
  sourceSystemId: string;
  sourceCandidateVersionId: string;
  tradingGatewayEnvironment: TradingGatewayEnvironmentReadModel;
  gatewayRuntimeBinding?: GatewayRuntimeBinding;
  agentAdapter?: TradingResearchAgentAdapter;
  iterations?: number;
  repoRoot?: string;
}

export interface AgentTradingCycleOutcome {
  status: "completed";
  source_system_id: string;
  source_candidate_version_id: string;
  agent_research: {
    session_id: string;
    run_root: string;
    notebook_path: string;
    agent: ManagedResearchAgent;
    best_score?: number;
    best_artifact_dir: string;
    latest_decision: TradingResearchDecision;
    latest_summary: string;
  };
  system_code_handoff: {
    system_code_id: string;
    artifact_path: string;
    artifact_digest: string;
    runtime_kind: "python";
    declared_output_kinds: string[];
    generated_by_agent: true;
    authority_status: "not_live";
  };
  backtest: TradingEvaluationResult;
  full_cycle_lineage: FullCycleLineage;
  next_trading_system: CandidateInspectReadModel;
  trading_run_id: string;
  trading_run: {
    ref: Ref;
    stage: string;
    lifecycle_status?: string;
    authority_status: string;
  };
  paper_trading: {
    run_status: ArtifactRunResult["status"];
    events_path: string;
    provider_request_count: number;
    authority_status: "not_live";
  };
  order_request: NonNullable<CandidateInspectReadModel["ledger"]>["latest_order_request"];
  gateway_result: NonNullable<CandidateInspectReadModel["ledger"]>["latest_gateway_result"];
  execution_result: NonNullable<CandidateInspectReadModel["ledger"]>["latest_execution_result"];
  ledger: NonNullable<CandidateInspectReadModel["ledger"]>;
  run_control?: CandidateInspectReadModel["runtime"]["run_control"];
  transcript?: CandidateInspectReadModel["runtime"]["transcript"];
  trading_gateway_environment: TradingGatewayEnvironmentReadModel;
}

export type FullCycleLineage = FullCycleLineageReadModel;

/**
 * @deprecated CandidateArena is the only research-to-materialization path.
 */
export async function runAgentTradingCycle(
  _input: RunAgentTradingCycleInput
): Promise<AgentTradingCycleOutcome> {
  throw new Error("agent_trading_cycle_retired_use_candidate_arena");
}
