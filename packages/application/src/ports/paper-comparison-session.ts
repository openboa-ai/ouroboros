import type {
  PaperTradingComparisonActivationSide,
  PaperTradingComparisonActivationSideResultReason,
  PaperTradingComparisonCheckpointWriteContext,
  PaperTradingComparisonRuntimeWriteContext,
  PaperTradingComparisonTickIOWriteContext,
  PaperTradingComparisonTickRecord,
  PaperTradingEvaluationStatus,
  Ref,
  SandboxLifecycleStatus,
  TradingRunLifecycleStatus
} from "@ouroboros/domain";
import type { GatewayMarketDataPort } from "./market-data";
import type { PreparedPaperTradingComparisonCheckpointSide } from "./store";

export interface PaperTradingComparisonSessionSideStatus {
  role: "champion" | "challenger";
  trading_run_ref: Ref;
  paper_trading_evaluation_ref: Ref;
  sandbox_ref?: Ref;
  runtime_lifecycle_status: TradingRunLifecycleStatus | "unknown";
  evaluation_status: PaperTradingEvaluationStatus | "unknown";
  sandbox_lifecycle_status?: SandboxLifecycleStatus;
  sandbox_started_at?: string;
  provider_request_count: number;
  provider_session_active: boolean;
  observed_at: string;
  authority_status: "not_live";
}

export interface PaperTradingComparisonSessionPort {
  startComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    marketData: GatewayMarketDataPort;
    deadlineAt: string;
    maximumProviderRequestCount: number;
    signal: AbortSignal;
  }): Promise<PaperTradingComparisonSessionSideStatus>;
  stopComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
    deadlineAt: string;
    reason: PaperTradingComparisonActivationSideResultReason;
  }): Promise<PaperTradingComparisonSessionSideStatus>;
  inspectComparisonSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonRuntimeWriteContext;
  }): Promise<PaperTradingComparisonSessionSideStatus>;
  enableComparisonTickAttributionSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonTickIOWriteContext;
    tick: PaperTradingComparisonTickRecord;
  }): Promise<void>;
  prepareComparisonCheckpointSide(input: {
    side: PaperTradingComparisonActivationSide;
    authority: PaperTradingComparisonCheckpointWriteContext;
    tick: PaperTradingComparisonTickRecord;
    deadlineAt: string;
    maximumProviderRequestCount: number;
    signal: AbortSignal;
  }): Promise<PreparedPaperTradingComparisonCheckpointSide>;
}
