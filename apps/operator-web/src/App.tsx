import { useEffect, useState } from "react";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  CandidateArenaReadModel,
  CandidateEvaluationReadModel,
  CandidateEvidenceClassificationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  CandidateMaterializationAttemptReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunMetricReadModel,
  ReplayRunValidationStateReadModel,
  RunControlReadModel,
  SandboxDetailReadModel,
  TradingRunTranscriptReadModel,
  CandidateSummaryReadModel,
  OrderFillSurfaceReadModel,
  PlaceholderSummary,
  PrivateReadGateDecision,
  PrivateReadinessPolicyGateInput,
  PrivateReadinessPolicyDecision,
  PrivateReadinessPostureReadModel,
  PrivateReadinessPreflightSurfaceReadModel,
  PublicMarketLivenessSurfaceReadModel,
  TradingGatewayContractReadModel,
  TradingGatewayEnvironmentReadModel,
  ImprovementReadModel,
  LedgerReadModel,
  OperatorReadModel,
  PaperTradingBoardReadModel,
  PaperTradingEvaluationReadModel,
  ResearcherProviderReadModel,
  AgentProfileReadModel,
  AgentProfileProviderKind,
  OuroborosCommandReadModel,
  SelectedPaperEvidenceReadModel,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";
import {
  fetchCandidate,
  fetchReplayRunComparison,
  fetchReplayRunDetail,
  fetchReplayRunEvidence,
  fetchReplayRunValidationState,
  fetchCandidateSummaries,
  fetchTradingGatewayEnvironment,
  fetchTradingExecutionModeContracts,
  fetchTradingResearchRuntime,
  fetchCandidateArena,
  fetchOperatorReadModel,
  selectCandidateForOperator,
  startCandidateArena as submitStartCandidateArena,
  stopCandidateArena as submitStopCandidateArena,
  tickCandidateArena as submitTickCandidateArena,
  recordPrivateReadinessPosture as submitPrivateReadinessPosture,
  recordRunControl as submitRunControl,
  recordImprovement as submitImprovement,
  probeAgentProvider as submitProbeAgentProvider,
  runFullCycle as submitFullCycle,
  promoteCandidateToTrading as submitPromoteCandidateToTrading,
  selectResearcherProvider as submitSelectResearcherProvider,
  setupAgentProvider as submitSetupAgentProvider,
  startAgentProviderLogin as submitStartAgentProviderLogin,
  observeTradingRun as submitObserveTradingRun,
  runReplay as submitReplayRun,
  startTradingRun as submitTradingRun,
  stopTradingRun as submitStopTradingRun,
  type FullCycleOutcome,
  type PaperOrderRequestSelection,
  type PrivateReadinessPostureDraft,
  type TradingResearchAgentSelection,
  type TradingResearchRuntimeReadModel
} from "./api";
import {
  ActivityIcon,
  BarChart3Icon,
  FlaskConicalIcon,
  ListChecksIcon,
  PanelLeftIcon,
  ShieldCheckIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  buildPrivateReadinessReviewPacketProjection,
  formatPrivateReadinessCheckedGatePosture
} from "./private-readiness-review-packet";
import type { PrivateReadinessReviewPacketProjection } from "./private-readiness-review-packet";
import "./styles.css";

interface AppState {
  candidates: CandidateSummaryReadModel[];
  executionModes: TradingSystemExecutionModeContractReadModel[];
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchRuntime?: TradingResearchRuntimeReadModel;
  operator?: OperatorReadModel;
  candidateArena?: CandidateArenaReadModel;
  selectedTradingResearchAgent: TradingResearchAgentSelection;
  tradingResearchIterations: number;
  selected?: CandidateInspectReadModel;
  replayRuns: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  error?: string;
  loading: boolean;
  runningFullCycle: boolean;
  runningTradingRun: boolean;
  recordingImprovement: boolean;
  recordingRunControl: boolean;
  recordingPrivateReadinessPosture: boolean;
  runningCandidateReplay: boolean;
  runningTradingPromotion: boolean;
  runningCandidateArenaAction: boolean;
  candidateArenaMessage?: string;
  candidateArenaError?: string;
  replayRunError?: string;
  replayRunMessage?: string;
  tradingRunError?: string;
  tradingRunMessage?: string;
  tradingPromotionError?: string;
  tradingPromotionMessage?: string;
  fullCycleError?: string;
  fullCycleMessage?: string;
  lastFullCycle?: FullCycleOutcome;
  improvementError?: string;
  improvementMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
  privateReadinessPostureError?: string;
  privateReadinessPostureMessage?: string;
}

export type OperatorView = "trading" | "arena" | "research" | "details";

const OPERATOR_VIEWS: OperatorView[] = ["trading", "arena", "research", "details"];

export function operatorViewFromSearch(search: string | undefined): OperatorView {
  const view = new URLSearchParams(search ?? "").get("view");
  return OPERATOR_VIEWS.includes(view as OperatorView) ? (view as OperatorView) : "trading";
}

function readInitialOperatorView(): OperatorView {
  if (typeof window === "undefined") {
    return "trading";
  }

  return operatorViewFromSearch(window.location.search);
}

export function App() {
  const [operatorView, setOperatorViewState] = useState<OperatorView>(readInitialOperatorView);
  function setOperatorView(view: OperatorView) {
    setOperatorViewState(view);
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const [state, setState] = useState<AppState>({
    candidates: [],
    executionModes: [],
    replayRuns: [],
    selectedTradingResearchAgent: "codex",
    tradingResearchIterations: 1,
    loading: true,
    runningFullCycle: false,
    runningTradingRun: false,
    recordingImprovement: false,
    recordingRunControl: false,
    recordingPrivateReadinessPosture: false,
    runningCandidateReplay: false,
    runningTradingPromotion: false,
    runningCandidateArenaAction: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          candidates,
          executionModes,
          tradingGatewayEnvironment,
          tradingResearchRuntime,
          operator
        ] = await Promise.all([
          fetchCandidateSummaries(),
          fetchTradingExecutionModeContracts(),
          fetchTradingGatewayEnvironment(),
          fetchTradingResearchRuntime(),
          fetchOperatorReadModel()
        ]);
        const first = candidates[0];
        const selected = operator.selected_candidate ?? (first ? await fetchCandidate(first.candidate_id) : undefined);
        const replayRuns = selected ? await fetchReplayRunEvidence(selected.candidate_id) : [];
        const replayRunSelection = selected
          ? await fetchReplayRunSelection(selected.candidate_id, replayRuns)
          : {};
        if (!cancelled) {
          setState({
            candidates,
            executionModes,
            tradingGatewayEnvironment,
            tradingResearchRuntime,
            operator,
            candidateArena: operator.candidate_arena,
            selectedTradingResearchAgent: tradingResearchRuntime.default_agent,
            tradingResearchIterations: tradingResearchRuntime.iterations,
            selected,
            replayRuns,
            selectedReplayRunId: replayRunSelection.selectedReplayRunId,
            replayRunDetail: replayRunSelection.replayRunDetail,
            replayRunComparison: replayRunSelection.replayRunComparison,
            replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
            replayRunValidationState: replayRunSelection.replayRunValidationState,
            loading: false,
            runningFullCycle: false,
            runningTradingRun: false,
            recordingImprovement: false,
            recordingRunControl: false,
            recordingPrivateReadinessPosture: false,
            runningCandidateReplay: false,
            runningTradingPromotion: false,
            runningCandidateArenaAction: false
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            candidates: [],
            executionModes: [],
            replayRuns: [],
            selectedTradingResearchAgent: "codex",
            tradingResearchIterations: 1,
            loading: false,
            runningFullCycle: false,
            runningTradingRun: false,
            recordingImprovement: false,
            recordingRunControl: false,
            recordingPrivateReadinessPosture: false,
            runningCandidateReplay: false,
            runningTradingPromotion: false,
            runningCandidateArenaAction: false,
            error: error instanceof Error ? error.message : "Unknown runtime error"
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectCandidate(candidateId: string) {
    setState((current) => ({
      ...current,
      loading: true,
      tradingRunError: undefined,
      tradingRunMessage: undefined,
      fullCycleError: undefined,
      fullCycleMessage: undefined,
      improvementError: undefined,
      improvementMessage: undefined,
      runtimeControlError: undefined,
      runtimeControlMessage: undefined,
      privateReadinessPostureError: undefined,
      privateReadinessPostureMessage: undefined,
      replayRunError: undefined,
      replayRunMessage: undefined
    }));
    try {
      const operator = await selectCandidateForOperator(candidateId);
      const selected = operator.selected_candidate ?? await fetchCandidate(candidateId);
      const replayRuns = await fetchReplayRunEvidence(selected.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(selected.candidate_id, replayRuns);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        loading: false
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown runtime error"
      }));
    }
  }

  async function selectReplayRun(runId: string) {
    const candidate = state.selected;
    if (!candidate) {
      return;
    }

    setState((current) => ({
      ...current,
      selectedReplayRunId: runId,
      replayRunDetail: undefined,
      replayRunComparison: undefined,
      replayRunComparisonBaselineId: baselineRunIdForSelection(current.replayRuns, runId),
      replayRunValidationState: undefined,
      replayRunError: undefined,
      replayRunMessage: undefined
    }));
    try {
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        state.replayRuns,
        runId
      );
      setState((current) =>
        current.selected?.candidate_id === candidate.candidate_id
          ? {
              ...current,
              selectedReplayRunId: replayRunSelection.selectedReplayRunId,
              replayRunDetail: replayRunSelection.replayRunDetail,
              replayRunComparison: replayRunSelection.replayRunComparison,
              replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
              replayRunValidationState: replayRunSelection.replayRunValidationState
            }
          : current
      );
    } catch (error) {
      setState((current) =>
        current.selected?.candidate_id === candidate.candidate_id
          ? {
              ...current,
              replayRunError: error instanceof Error ? error.message : "Unknown replay run detail error"
            }
          : current
      );
    }
  }

  async function recordReplayRun() {
    const candidate = state.selected;
    if (!candidate || state.runningCandidateReplay) {
      return;
    }

    setState((current) => ({
      ...current,
      runningCandidateReplay: true,
      replayRunError: undefined,
      replayRunMessage: undefined
    }));
    try {
      const outcome = await submitReplayRun(candidate);
      const selected = await fetchCandidate(candidate.candidate_id);
      const replayRuns = await fetchReplayRunEvidence(candidate.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        replayRuns,
        outcome.run.run_id
      );
      setState((current) => ({
        ...current,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        runningCandidateReplay: false,
        replayRunMessage: `replay recorded: ${outcome.run.run_id}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningCandidateReplay: false,
        replayRunError: error instanceof Error ? error.message : "Unknown candidate replay error"
      }));
    }
  }

  async function runFullCycle() {
    const candidate = state.selected;
    if (!candidate || state.runningFullCycle) {
      return;
    }

    setState((current) => ({
      ...current,
      runningFullCycle: true,
      fullCycleError: undefined,
      fullCycleMessage: undefined,
      tradingRunError: undefined,
      tradingRunMessage: undefined,
      improvementError: undefined,
      improvementMessage: undefined
    }));
    try {
      const outcome = await submitFullCycle(candidate, {
        research_agent: state.selectedTradingResearchAgent,
        research_iterations: state.tradingResearchIterations
      });
      const selected = await fetchCandidate(candidate.candidate_id);
      const candidates = await fetchCandidateSummaries();
      const replayRuns = await fetchReplayRunEvidence(selected.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        selected.candidate_id,
        replayRuns,
        undefined
      );
      setState((current) => ({
        ...current,
        candidates,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        runningFullCycle: false,
        fullCycleMessage: `paper evidence recorded: ${outcome.trading_run.lifecycle_status ?? "running"}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningFullCycle: false,
        fullCycleError: error instanceof Error ? error.message : "Unknown full cycle error"
      }));
    }
  }

  async function runCandidateArenaAction(action: "start" | "stop" | "tick") {
    if (state.runningCandidateArenaAction) {
      return;
    }
    setState((current) => ({
      ...current,
      runningCandidateArenaAction: true,
      candidateArenaError: undefined,
      candidateArenaMessage: undefined
    }));
    try {
      if (action === "start") {
        await submitStartCandidateArena();
      } else if (action === "stop") {
        await submitStopCandidateArena();
      } else {
        await submitTickCandidateArena();
      }
      const operator = await fetchOperatorReadModel();
      const candidateArena = operator.candidate_arena;
      const candidates = await fetchCandidateSummaries();
      const selected = operator.selected_candidate ?? (candidateArena.leaderboard[0]
        ? await fetchCandidate(candidateArena.leaderboard[0].candidate_id)
        : state.selected);
      const replayRuns = selected ? await fetchReplayRunEvidence(selected.candidate_id) : state.replayRuns;
      const replayRunSelection = selected
        ? await fetchReplayRunSelection(selected.candidate_id, replayRuns)
        : {
            selectedReplayRunId: state.selectedReplayRunId,
            replayRunDetail: state.replayRunDetail,
            replayRunComparison: state.replayRunComparison,
            replayRunComparisonBaselineId: state.replayRunComparisonBaselineId,
            replayRunValidationState: state.replayRunValidationState
          };
      setState((current) => ({
        ...current,
        operator,
        candidateArena,
        candidates,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        runningCandidateArenaAction: false,
        candidateArenaMessage: `arena ${action}: ${candidateArena.runner_status}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningCandidateArenaAction: false,
        candidateArenaError: error instanceof Error ? error.message : "Unknown Candidate Arena error"
      }));
    }
  }

  async function runAgentProviderAction(
    action: "setup" | "probe" | "login" | "select",
    provider: AgentProfileProviderKind
  ) {
    if (state.runningCandidateArenaAction) {
      return;
    }
    setState((current) => ({
      ...current,
      runningCandidateArenaAction: true,
      candidateArenaError: undefined,
      candidateArenaMessage: undefined
    }));
    try {
      const operator = action === "setup"
        ? await submitSetupAgentProvider(provider)
        : action === "probe"
          ? await submitProbeAgentProvider(provider)
          : action === "login"
            ? await submitStartAgentProviderLogin(provider)
            : await submitSelectResearcherProvider(selectableResearcherProvider(provider));
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        runningCandidateArenaAction: false,
        candidateArenaMessage: `agent provider ${action}: ${provider}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningCandidateArenaAction: false,
        candidateArenaError: error instanceof Error ? error.message : "Unknown agent provider error"
      }));
    }
  }

  async function startTradingRun(paperOrderRequest?: PaperOrderRequestSelection) {
    const candidate = state.selected;
    if (!candidate || state.runningTradingRun) {
      return;
    }

    setState((current) => ({
      ...current,
      runningTradingRun: true,
      tradingRunError: undefined,
      tradingRunMessage: undefined
    }));
    try {
      const outcome = await submitTradingRun(candidate, { paper_order_request: paperOrderRequest });
      const operator = await fetchOperatorReadModel();
      const selected = operator.selected_candidate ?? await fetchCandidate(candidate.candidate_id);
      const candidateArena = operator.candidate_arena;
      const replayRuns = await fetchReplayRunEvidence(candidate.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        replayRuns,
        state.selectedReplayRunId
      );
      setState((current) => ({
        ...current,
        operator,
        selected,
        candidateArena,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        runningTradingRun: false,
        tradingRunMessage: paperOrderRequest === "rejected"
          ? `rejected paper order: ${outcome?.execution_result?.status ?? "blocked"}`
          : `paper trading: ${operator.selected_paper_trading_evaluation.status}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningTradingRun: false,
        tradingRunError: error instanceof Error ? error.message : "Unknown trading run error"
      }));
    }
  }

  async function observeTradingRun() {
    const candidate = state.selected;
    if (!candidate || state.runningTradingRun) {
      return;
    }

    setState((current) => ({
      ...current,
      runningTradingRun: true,
      tradingRunError: undefined,
      tradingRunMessage: undefined
    }));
    try {
      const outcome = await submitObserveTradingRun(candidate);
      const operator = await fetchOperatorReadModel();
      const selected = operator.selected_candidate ?? await fetchCandidate(candidate.candidate_id);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        runningTradingRun: false,
        tradingRunMessage: `observed: ${outcome.trading_run.lifecycle_status ?? "unknown"} / ${operator.selected_paper_trading_evaluation.observation_count} observations`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningTradingRun: false,
        tradingRunError: error instanceof Error ? error.message : "Unknown trading run observe error"
      }));
    }
  }

  async function stopTradingRun() {
    const candidate = state.selected;
    if (!candidate || state.runningTradingRun) {
      return;
    }

    setState((current) => ({
      ...current,
      runningTradingRun: true,
      tradingRunError: undefined,
      tradingRunMessage: undefined
    }));
    try {
      const outcome = await submitStopTradingRun(candidate);
      const operator = await fetchOperatorReadModel();
      const selected = operator.selected_candidate ?? await fetchCandidate(candidate.candidate_id);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        runningTradingRun: false,
        tradingRunMessage: `stopped: ${outcome.trading_run.lifecycle_status ?? "stopped"}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningTradingRun: false,
        tradingRunError: error instanceof Error ? error.message : "Unknown trading run stop error"
      }));
    }
  }

  async function promoteTradingCandidate() {
    const candidate = state.selected;
    if (!candidate || state.runningTradingPromotion) {
      return;
    }

    setState((current) => ({
      ...current,
      runningTradingPromotion: true,
      tradingPromotionError: undefined,
      tradingPromotionMessage: undefined
    }));
    try {
      const operator = await submitPromoteCandidateToTrading(candidate.candidate_id);
      const selected = operator.selected_candidate ?? await fetchCandidate(candidate.candidate_id);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        runningTradingPromotion: false,
        tradingPromotionMessage: `promoted to Trading review: ${operator.trading_promotion?.status ?? "not_live"}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        runningTradingPromotion: false,
        tradingPromotionError: error instanceof Error ? error.message : "Unknown Trading promotion error"
      }));
    }
  }

  async function recordImprovement() {
    const candidate = state.selected;
    if (!candidate || state.recordingImprovement) {
      return;
    }

    setState((current) => ({
      ...current,
      recordingImprovement: true,
      improvementError: undefined,
      improvementMessage: undefined
    }));
    try {
      const outcome = await submitImprovement(candidate);
      const selected = await fetchCandidate(candidate.candidate_id);
      const replayRuns = await fetchReplayRunEvidence(candidate.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        replayRuns,
        state.selectedReplayRunId
      );
      setState((current) => ({
        ...current,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        recordingImprovement: false,
        improvementMessage: `evaluation recorded: ${outcome.evaluation.evaluation_run.evaluation_run_record_id}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        recordingImprovement: false,
        improvementError: error instanceof Error ? error.message : "Unknown improvement error"
      }));
    }
  }

  async function recordRunControl() {
    const candidate = state.selected;
    if (!candidate || state.recordingRunControl) {
      return;
    }

    setState((current) => ({
      ...current,
      recordingRunControl: true,
      runtimeControlError: undefined,
      runtimeControlMessage: undefined
    }));
    try {
      const outcome = await submitRunControl(candidate);
      const selected = await fetchCandidate(candidate.candidate_id);
      const replayRuns = await fetchReplayRunEvidence(candidate.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        replayRuns,
        state.selectedReplayRunId
      );
      setState((current) => ({
        ...current,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        recordingRunControl: false,
        runtimeControlMessage: `Run control ${outcome.status}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        recordingRunControl: false,
        runtimeControlError: error instanceof Error ? error.message : "Unknown run control error"
      }));
    }
  }

  async function recordPrivateReadinessPosture(draft: PrivateReadinessPostureDraft) {
    const candidate = state.selected;
    if (!candidate || state.recordingPrivateReadinessPosture) {
      return;
    }

    setState((current) => ({
      ...current,
      recordingPrivateReadinessPosture: true,
      privateReadinessPostureError: undefined,
      privateReadinessPostureMessage: undefined
    }));
    try {
      const outcome = await submitPrivateReadinessPosture(candidate, draft);
      const selected = await fetchCandidate(candidate.candidate_id);
      const replayRuns = await fetchReplayRunEvidence(candidate.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(
        candidate.candidate_id,
        replayRuns,
        state.selectedReplayRunId
      );
      setState((current) => ({
        ...current,
        selected,
        replayRuns,
        selectedReplayRunId: replayRunSelection.selectedReplayRunId,
        replayRunDetail: replayRunSelection.replayRunDetail,
        replayRunComparison: replayRunSelection.replayRunComparison,
        replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
        replayRunValidationState: replayRunSelection.replayRunValidationState,
        recordingPrivateReadinessPosture: false,
        privateReadinessPostureMessage: `local_config recorded: ${outcome.posture.posture_id}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        recordingPrivateReadinessPosture: false,
        privateReadinessPostureError:
          error instanceof Error ? error.message : "Unknown private-readiness posture error"
      }));
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <OperatorSidebar
          activeView={operatorView}
          candidates={state.candidates}
          selectedCandidateId={state.selected?.candidate_id}
          selectedCandidateName={state.selected?.display_name}
          onSelectCandidate={(candidateId) => void selectCandidate(candidateId)}
          onSelectView={setOperatorView}
        />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Ouroboros Operator</p>
              <p className="truncate text-xs text-muted-foreground">
                {operatorView === "trading"
                  ? "Trading"
                  : operatorView === "arena"
                    ? "Arena"
                    : operatorView === "research"
                      ? "Research"
                      : "System details"}
              </p>
            </div>
          </header>
          <main className="min-h-[calc(100svh-3.5rem)] bg-background p-4">
            {state.loading && (
              <Card>
                <CardContent>Loading fixture read model...</CardContent>
              </Card>
            )}
            {state.error && (
              <Card>
                <CardContent className="text-destructive">{state.error}</CardContent>
              </Card>
            )}
            {!state.loading && !state.error && state.selected && (
              <CandidateDetail
                activeView={operatorView}
                onActiveViewChange={setOperatorView}
                candidate={state.selected}
                candidates={state.candidates}
                operator={state.operator}
                candidateArena={state.candidateArena}
                tradingGatewayEnvironment={state.tradingGatewayEnvironment}
                tradingResearchRuntime={state.tradingResearchRuntime}
                selectedTradingResearchAgent={state.selectedTradingResearchAgent}
                tradingResearchIterations={state.tradingResearchIterations}
                replayRuns={state.replayRuns}
                selectedReplayRunId={state.selectedReplayRunId}
                replayRunDetail={state.replayRunDetail}
                replayRunComparison={state.replayRunComparison}
                replayRunComparisonBaselineId={state.replayRunComparisonBaselineId}
                replayRunValidationState={state.replayRunValidationState}
                executionModes={state.executionModes}
                onSelectCandidate={(candidateId) => void selectCandidate(candidateId)}
                onSelectReplayRun={(runId) => void selectReplayRun(runId)}
                onStartCandidateArena={() => void runCandidateArenaAction("start")}
                onStopCandidateArena={() => void runCandidateArenaAction("stop")}
                onTickCandidateArena={() => void runCandidateArenaAction("tick")}
                onSetupAgentProvider={(provider) => void runAgentProviderAction("setup", provider)}
                onProbeAgentProvider={(provider) => void runAgentProviderAction("probe", provider)}
                onStartAgentProviderLogin={(provider) => void runAgentProviderAction("login", provider)}
                onSelectResearcherProvider={(provider) => void runAgentProviderAction("select", provider)}
                onSelectTradingResearchAgent={(agent) =>
                  setState((current) => ({
                    ...current,
                    selectedTradingResearchAgent: agent
                  }))}
                onTradingResearchIterationsChange={(iterations) =>
                  setState((current) => ({
                    ...current,
                    tradingResearchIterations: iterations
                  }))}
                onRunCandidateReplay={state.selected.fixture_notice.mode === "local_promoted_candidate_bundle"
                  ? () => void recordReplayRun()
                  : undefined}
                onRunFullCycle={state.selected.fixture_notice.mode === "fixture_convenience_mode"
                  ? () => void runFullCycle()
                  : undefined}
                onStartTradingRun={state.selected.ledger
                  ? () => void startTradingRun()
                  : undefined}
                onPromoteTradingCandidate={() => void promoteTradingCandidate()}
                onStartRejectedPaperOrder={state.selected.ledger
                  ? () => void startTradingRun("rejected")
                  : undefined}
                onObserveTradingRun={state.selected
                  ? () => void observeTradingRun()
                  : undefined}
                onStopTradingRun={state.selected
                  ? () => void stopTradingRun()
                  : undefined}
                onRecordImprovement={() => void recordImprovement()}
                onRecordRunControl={state.selected.runtime.run_control
                  ? () => void recordRunControl()
                  : undefined}
                onRecordPrivateReadinessPosture={(draft) => void recordPrivateReadinessPosture(draft)}
                runningFullCycle={state.runningFullCycle}
                runningTradingRun={state.runningTradingRun}
                runningTradingPromotion={state.runningTradingPromotion}
                recordingImprovement={state.recordingImprovement}
                recordingRunControl={state.recordingRunControl}
                recordingPrivateReadinessPosture={state.recordingPrivateReadinessPosture}
                runningCandidateReplay={state.runningCandidateReplay}
                runningCandidateArenaAction={state.runningCandidateArenaAction}
                candidateArenaMessage={state.candidateArenaMessage}
                candidateArenaError={state.candidateArenaError}
                replayRunError={state.replayRunError}
                replayRunMessage={state.replayRunMessage}
                fullCycleError={state.fullCycleError}
                fullCycleMessage={state.fullCycleMessage}
                lastFullCycle={state.lastFullCycle}
                tradingRunError={state.tradingRunError}
                tradingRunMessage={state.tradingRunMessage}
                tradingPromotionError={state.tradingPromotionError}
                tradingPromotionMessage={state.tradingPromotionMessage}
                improvementError={state.improvementError}
                improvementMessage={state.improvementMessage}
                runtimeControlError={state.runtimeControlError}
                runtimeControlMessage={state.runtimeControlMessage}
                privateReadinessPostureError={state.privateReadinessPostureError}
                privateReadinessPostureMessage={state.privateReadinessPostureMessage}
              />
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function CandidateSummaryRow({
  candidate,
  active,
  onSelectCandidate
}: {
  candidate: CandidateSummaryReadModel;
  active: boolean;
  onSelectCandidate: (candidateId: string) => void | Promise<void>;
}) {
  return (
    <Button
      variant="ghost"
      className={`candidate-row ${active ? "active" : ""}`}
      type="button"
      onClick={() => void onSelectCandidate(candidate.candidate_id)}
    >
      <span>{candidate.display_name}</span>
      <small>
        {candidate.status} · latest validation state: {latestValidationStateLabel(candidate.latest_validation_state)}
      </small>
    </Button>
  );
}

function OperatorSidebar({
  activeView,
  candidates,
  selectedCandidateId,
  selectedCandidateName,
  onSelectCandidate,
  onSelectView
}: {
  activeView: OperatorView;
  candidates: CandidateSummaryReadModel[];
  selectedCandidateId?: string;
  selectedCandidateName?: string;
  onSelectCandidate: (candidateId: string) => void;
  onSelectView: (view: OperatorView) => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" isActive>
              <ShieldCheckIcon />
              <span>ouroboros</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operator workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "trading"}
                  onClick={() => onSelectView("trading")}
                >
                  <ActivityIcon />
                  <span>Trading</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>1</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "arena"}
                  onClick={() => onSelectView("arena")}
                >
                  <BarChart3Icon />
                  <span>Arena</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{String(candidates.length)}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "research"}
                  onClick={() => onSelectView("research")}
                >
                  <FlaskConicalIcon />
                  <span>Research</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{String(candidates.length)}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "details"}
                  onClick={() => onSelectView("details")}
                >
                  <ListChecksIcon />
                  <span>Details</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Trading Systems</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {candidates.map((candidate) => (
                <SidebarMenuItem key={candidate.candidate_id}>
                  <SidebarMenuButton
                    isActive={selectedCandidateId === candidate.candidate_id}
                    onClick={() => {
                      onSelectCandidate(candidate.candidate_id);
                      onSelectView("arena");
                    }}
                  >
                    <BarChart3Icon />
                    <span className="truncate" title={candidate.display_name}>{candidate.display_name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <PanelLeftIcon />
              <span>{selectedCandidateName ?? "No Trading System selected"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

async function fetchReplayRunSelection(
  candidateId: string,
  runs: ReplayRunEvidenceReadModel[],
  preferredRunId?: string
): Promise<{
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
}> {
  const selectedRun = runs.find((run) => run.run_id === preferredRunId) ?? runs[0];
  if (!selectedRun) {
    return {};
  }
  const baselineRunId = baselineRunIdForSelection(runs, selectedRun.run_id);
  const [replayRunDetail, replayRunComparison, replayRunValidationState] = await Promise.all([
    fetchReplayRunDetail(candidateId, selectedRun.run_id),
    baselineRunId ? fetchReplayRunComparison(candidateId, selectedRun.run_id, baselineRunId) : undefined,
    fetchReplayRunValidationState(candidateId, selectedRun.run_id, baselineRunId)
  ]);

  return {
    selectedReplayRunId: selectedRun.run_id,
    replayRunDetail,
    replayRunComparison,
    replayRunComparisonBaselineId: baselineRunId,
    replayRunValidationState
  };
}

function baselineRunIdForSelection(
  runs: ReplayRunEvidenceReadModel[],
  selectedRunId: string
): string | undefined {
  return runs.find((run) => run.run_id !== selectedRunId)?.run_id;
}

export function CandidateArenaPanel({
  arena,
  selectedCandidateId,
  selectedCandidate,
  researcherProvider,
  agentProfiles = [],
  latestCommands = [],
  selectedPaperEvidence,
  selectedPaperTradingEvaluation,
  paperTradingBoard,
  onStart,
  onStop,
  onTick,
  onSelectCandidate,
  onStartPaperTrading,
  onObservePaperTrading,
  onStopPaperTrading,
  onSetupAgentProvider,
  onProbeAgentProvider,
  onStartAgentProviderLogin,
  onSelectResearcherProvider,
  actionPending,
  runningPaperTrading = false,
  message,
  error
}: {
  arena: CandidateArenaReadModel;
  selectedCandidateId?: string;
  selectedCandidate?: CandidateInspectReadModel;
  researcherProvider?: ResearcherProviderReadModel;
  agentProfiles?: AgentProfileReadModel[];
  latestCommands?: OuroborosCommandReadModel[];
  selectedPaperEvidence?: SelectedPaperEvidenceReadModel;
  selectedPaperTradingEvaluation?: PaperTradingEvaluationReadModel;
  paperTradingBoard?: PaperTradingBoardReadModel;
  onStart?: () => void;
  onStop?: () => void;
  onTick?: () => void;
  onSelectCandidate?: (candidateId: string) => void;
  onStartPaperTrading?: () => void;
  onObservePaperTrading?: () => void;
  onStopPaperTrading?: () => void;
  onSetupAgentProvider?: (provider: AgentProfileProviderKind) => void;
  onProbeAgentProvider?: (provider: AgentProfileProviderKind) => void;
  onStartAgentProviderLogin?: (provider: AgentProfileProviderKind) => void;
  onSelectResearcherProvider?: (provider: "codex" | "fixture") => void;
  actionPending: boolean;
  runningPaperTrading?: boolean;
  message?: string;
  error?: string;
}) {
  const leader = arena.leaderboard[0];
  const selectedEntry = selectedCandidateId
    ? arena.leaderboard.find((entry) => entry.candidate_id === selectedCandidateId)
    : leader;
  const inspectorVisible = Boolean(selectedCandidate || selectedEntry);
  const latestTick = arena.latest_ticks[0];
  const selectedLineage = selectedCandidate?.full_cycle_lineage;
  const selectedSystemCode = selectedCandidate?.system_code?.ref ?? selectedLineage?.generated?.system_code_ref;
  const selectedLedger = selectedCandidate?.ledger;
  const selectedProfitLoss = selectedEntry?.profit_loss
    ?? selectedPaperTradingEvaluation?.profit_loss
    ?? selectedLineage?.evidence?.profit_loss;
  const selectedDirection = selectedEntry?.direction_kind
    ?? selectedLineage?.evidence?.direction_kind
    ?? "outside_arena_leaderboard";
  const selectedParent = selectedEntry?.parent_candidate_id
    ?? selectedLineage?.source?.trading_system_id;
  const selectedStatus = selectedEntry?.status
    ?? selectedCandidate?.status
    ?? "not_selected";
  const selectedFinding = selectedEntry?.latest_finding
    ?? "Selected candidate is not in the current arena leaderboard.";
  const selectedAuthority = selectedEntry?.authority_status
    ?? selectedCandidate?.runtime.authority_status
    ?? selectedCandidate?.trading_run?.authority_status
    ?? "not_live";
  const selectedPaperEvaluationStatus = runningPaperTrading
    ? "running"
    : selectedPaperTradingEvaluation?.status ?? "not_started";
  const selectedPaperEvidenceStatus = selectedPaperEvidence
    ? formatPaperEvidenceStatusLabel(selectedPaperEvidence.status)
    : formatSelectedPaperEvidenceStatus(selectedLedger, runningPaperTrading);
  const selectedTradingRunStatus = formatSelectedTradingRunStatus(selectedCandidate, runningPaperTrading);
  const selectedLedgerSummary = selectedLedger?.chain_count && selectedLedger.chain_count > 0
    ? selectedLedger
    : undefined;
  const selectedPaperMarketSnapshot = selectedPaperTradingEvaluation?.latest_market_snapshot;
  const selectedPaperExecutionSnapshot = selectedPaperTradingEvaluation?.latest_public_execution_snapshot;
  const selectedPaperDecision = selectedPaperTradingEvaluation?.latest_decision;
  const selectedPaperAccount = selectedPaperTradingEvaluation?.paper_account_snapshot;
  const selectedPaperFill = selectedPaperTradingEvaluation?.latest_fill;
  const paperBoardEntries = paperTradingBoard?.entries ?? [];
  const selectedProvider = researcherProvider?.selected_provider;
  const selectedAgentProfile = agentProfiles.find((profile) => profile.profile_id === selectedProvider);
  const paperRunnerActive = selectedPaperTradingEvaluation?.runner_active === true;
  const paperRunnerStatus = selectedPaperTradingEvaluation
    ? paperTradingRunnerStatus(selectedPaperTradingEvaluation)
    : "not started";
  const paperStartActionLabel = paperRunnerStatus === "needs resume"
    ? "Resume paper trading"
    : "Start paper trading";
  return (
    <Card aria-label="Candidate Arena cockpit" className="candidate-arena-cockpit">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <CardDescription>Operator cockpit</CardDescription>
            <CardTitle>Candidate Arena</CardTitle>
            <CardDescription>
              {leader
                ? `${leader.display_name} leads by ${formatUsdt(leader.profit_loss.net_revenue_usdt)} net revenue.`
                : "Researchers add TradingSystem candidates and rank them by revenue minus costs."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end" aria-label="Candidate Arena authority summary">
            <Badge variant={arena.runner_status === "running" ? "default" : "secondary"}>{arena.runner_status}</Badge>
            <Badge variant="secondary">{researcherProvider?.selected_provider ?? "provider pending"}</Badge>
            <Badge variant="secondary">not_live</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <section className="grid gap-3 rounded-md bg-muted/20 p-3 md:grid-cols-[1fr_auto]" aria-label="Arena command bar">
          <div className="grid gap-1">
            <strong className="text-sm">Runtime command bar</strong>
            <span className="text-xs text-muted-foreground">
              {`Provider ${researcherProvider?.selected_provider ?? "unknown"} ${selectedAgentProfile?.status ?? "unknown"}; live authority disabled; ${arena.active_researchers.length} researchers available.`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
          <Button type="button" onClick={onStart} disabled={actionPending || !onStart}>
            Start arena
          </Button>
          <Button type="button" onClick={onStop} disabled={actionPending || !onStop} variant="secondary">
            Stop arena
          </Button>
          <Button type="button" onClick={onTick} disabled={actionPending || !onTick} variant="outline">
            Run tick
          </Button>
          </div>
        </section>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="grid min-h-24 gap-1 rounded-md bg-muted/35 p-3">
            <span className="text-xs font-medium text-muted-foreground">Runner</span>
            <strong className="text-xl leading-tight">{arena.runner_status}</strong>
            <span className="text-xs text-muted-foreground">{arena.tick_count} ticks</span>
          </div>
          <div className="grid min-h-24 gap-1 rounded-md bg-muted/35 p-3">
            <span className="text-xs font-medium text-muted-foreground">Net revenue</span>
            <strong className="text-xl leading-tight">{leader ? formatUsdt(leader.profit_loss.net_revenue_usdt) : "none"}</strong>
            <span className="text-xs text-muted-foreground">revenue - cost</span>
          </div>
          <div className="grid min-h-24 gap-1 rounded-md bg-muted/35 p-3">
            <span className="text-xs font-medium text-muted-foreground">Net return</span>
            <strong className="text-xl leading-tight">{leader ? formatPercent(leader.profit_loss.net_return_pct) : "none"}</strong>
            <span className="text-xs text-muted-foreground">secondary rank signal</span>
          </div>
        </div>
        <section className="grid gap-2 rounded-md bg-muted/25 p-3" aria-label="Paper trading board">
          <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-2">
            <h3 className="text-sm font-medium">Paper Board</h3>
            <span className="text-xs text-muted-foreground">product authority: continuous paper trading</span>
          </div>
          {paperBoardEntries.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {paperBoardEntries.slice(0, 6).map((entry) => (
                <div key={entry.evaluation_id} className="grid min-w-0 gap-2 overflow-hidden rounded-md bg-background/35 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-muted-foreground">#{entry.rank}</span>
                      <strong className="block break-words text-sm leading-snug">{entry.display_name}</strong>
                    </div>
                    <Badge variant={entry.profit_loss.net_revenue_usdt >= 0 ? "default" : "outline"}>
                      {entry.status}
                    </Badge>
                  </div>
                  <dl className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Field label="Paper net" value={formatUsdt(entry.profit_loss.net_revenue_usdt)} />
                    <Field label="Return" value={formatPercent(entry.profit_loss.net_return_pct)} />
                    <Field label="Qualification" value={entry.qualification_status} />
                    <Field label="Evidence window" value={`${entry.evidence_window.observation_count} obs / ${entry.evidence_window.failed_observation_count} failed / ${entry.evidence_window.elapsed_ms}ms`} />
                    <Field
                      label="Reasons"
                      value={entry.qualification_reasons.length ? entry.qualification_reasons.join(", ") : "qualified"}
                    />
                    <Field label="Gate" value={entry.promotion_gate_status} />
                    <Field label="Runner" value={entry.runner_status} />
                    <Field label="Observations" value={String(entry.observation_count)} />
                    <Field label="Market" value={`${entry.market_data_source}${entry.latest_public_execution_source ? ` / ${entry.latest_public_execution_source}` : ""}`} />
                    <Field label="Fill quality" value={`${entry.latest_fill_status ?? "none"} / open ${entry.open_order_count}`} />
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <div className="placeholder">
              No paper evaluations yet. Select a candidate and start paper trading to create product evidence.
            </div>
          )}
        </section>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.95fr)]">
        <section className="grid content-start gap-2" aria-label="Candidate Arena leaderboard">
          <div className="grid gap-1 sm:flex sm:items-center sm:justify-between sm:gap-2">
            <h3 className="text-sm font-medium">Revenue-cost leaderboard</h3>
            <span className="text-xs text-muted-foreground">primary rank: net_revenue_usdt</span>
          </div>
          <div className="grid gap-2 lg:hidden">
            {arena.leaderboard.map((entry) => (
              <button
                type="button"
                key={entry.candidate_id}
                onClick={() => onSelectCandidate?.(entry.candidate_id)}
                aria-pressed={selectedEntry?.candidate_id === entry.candidate_id}
                className={`grid gap-3 rounded-md p-3 text-left text-sm transition ${selectedEntry?.candidate_id === entry.candidate_id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/35 hover:bg-muted/60"}`}
              >
                <div className="grid gap-2 sm:flex sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">#{entry.rank}</span>
                    <strong className="block break-words leading-snug">{entry.display_name}</strong>
                  </div>
                  <Badge className="w-fit" variant={entry.profit_loss.net_revenue_usdt >= 0 ? "default" : "outline"}>
                    {entry.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Net revenue" value={formatUsdt(entry.profit_loss.net_revenue_usdt)} />
                  <Field label="Net return" value={formatPercent(entry.profit_loss.net_return_pct)} />
                  <Field label="Direction" value={entry.direction_kind} />
                  <Field label="Parent" value={entry.parent_candidate_id ?? "none"} />
                </div>
                <p className="break-words text-xs text-muted-foreground">{entry.latest_finding}</p>
              </button>
            ))}
          </div>
          <div className="hidden lg:grid lg:gap-2">
            <div className="grid grid-cols-[44px_minmax(180px,1fr)_minmax(118px,0.62fr)_minmax(130px,0.6fr)] gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>Rank</span>
              <span>Candidate</span>
              <span>Direction</span>
              <span>Net revenue</span>
            </div>
            {arena.leaderboard.map((entry) => (
              <button
                type="button"
                key={entry.candidate_id}
                onClick={() => onSelectCandidate?.(entry.candidate_id)}
                aria-pressed={selectedEntry?.candidate_id === entry.candidate_id}
                className={`grid grid-cols-[44px_minmax(180px,1fr)_minmax(118px,0.62fr)_minmax(130px,0.6fr)] items-start gap-2 rounded-md p-2 text-left text-sm transition ${selectedEntry?.candidate_id === entry.candidate_id ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/35 hover:bg-muted/60"}`}
              >
                <span>#{entry.rank}</span>
                <span className="grid gap-1">
                  <strong className="break-words font-medium leading-snug">{entry.display_name}</strong>
                  <span className="break-words text-xs text-muted-foreground">
                    {`parent ${entry.parent_candidate_id ?? "none"}`}
                  </span>
                  <span className="break-words text-xs text-muted-foreground">{entry.latest_finding}</span>
                </span>
                <span className="break-words leading-snug">{entry.direction_kind}</span>
                <span className="grid gap-1">
                  <strong>{formatUsdt(entry.profit_loss.net_revenue_usdt)}</strong>
                  <span className="text-xs text-muted-foreground">{formatPercent(entry.profit_loss.net_return_pct)}</span>
                  <Badge variant={entry.profit_loss.net_revenue_usdt >= 0 ? "default" : "outline"}>
                    {entry.status}
                  </Badge>
                </span>
              </button>
            ))}
          </div>
          {!arena.leaderboard.length && (
            <div className="placeholder lg:min-w-[640px]">
              No candidates yet. Run tick to generate the first TradingSystem candidates.
            </div>
          )}
        </section>
        <aside className="grid content-start gap-3" aria-label="Candidate Arena inspector">
        {inspectorVisible && (
          <section className="grid gap-3 rounded-md bg-muted/25 p-3" aria-label="Selected Candidate Arena candidate">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">Selected candidate</h3>
                <p className="break-words text-sm text-muted-foreground">
                  {selectedCandidate?.display_name ?? selectedEntry?.display_name ?? "No Trading System selected"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {paperRunnerActive ? (
                  <>
                    <Button
                      type="button"
                      onClick={onObservePaperTrading}
                      disabled={!onObservePaperTrading || runningPaperTrading || !selectedCandidate}
                      variant="secondary"
                    >
                      {runningPaperTrading ? "Updating paper trading" : "Observe now"}
                    </Button>
                    <Button
                      type="button"
                      onClick={onStopPaperTrading}
                      disabled={!onStopPaperTrading || runningPaperTrading || !selectedCandidate}
                      variant="outline"
                    >
                      Stop paper trading
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    onClick={onStartPaperTrading}
                    disabled={!onStartPaperTrading || runningPaperTrading || !selectedCandidate}
                    variant="secondary"
                  >
                    {runningPaperTrading ? "Starting paper trading" : paperStartActionLabel}
                  </Button>
                )}
              </div>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              <Field label="Direction" value={selectedDirection} />
              <Field label="Parent" value={selectedParent ?? "none"} />
              <Field label="SystemCode" value={selectedSystemCode ? formatRef(selectedSystemCode) : "load candidate"} />
              <Field
                label="Evaluation"
                value={selectedLineage?.evidence
                  ? `${selectedLineage.evidence.evaluation_status} ${formatScore(selectedLineage.evidence.evaluation_score)}`
                  : selectedStatus}
              />
              <Field
                label="profit_loss"
                value={selectedProfitLoss
                  ? `${formatUsdt(selectedProfitLoss.net_revenue_usdt)} / ${formatPercent(selectedProfitLoss.net_return_pct)}`
                  : "not ranked"}
              />
              <Field label="PaperTradingEvaluation" value={selectedPaperEvaluationStatus} />
              <Field
                label="Paper runner"
                value={selectedPaperTradingEvaluation
                  ? formatPaperRunnerSummary(selectedPaperTradingEvaluation)
                  : "not started"}
              />
              <Field
                label="Paper score"
                value={selectedPaperTradingEvaluation
                  ? `${formatUsdt(selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt)} / ${selectedPaperTradingEvaluation.observation_count} observations`
                  : "not started"}
              />
              <Field
                label="Market snapshot"
                value={selectedPaperMarketSnapshot
                  ? `${selectedPaperMarketSnapshot.symbol} ${formatUsdt(selectedPaperMarketSnapshot.price)} @ ${formatCompactDateTime(selectedPaperMarketSnapshot.observed_at)}`
                  : "not observed"}
              />
              <Field
                label="Market data"
                value={selectedPaperTradingEvaluation
                  ? `${selectedPaperTradingEvaluation.market_data_source}${selectedPaperMarketSnapshot?.source_priority ? ` / ${selectedPaperMarketSnapshot.source_priority}` : ""}${selectedPaperMarketSnapshot?.rest_fallback_used ? " / REST fallback" : ""}${selectedPaperMarketSnapshot?.ws_connected === true ? " / WS connected" : ""}${selectedPaperMarketSnapshot?.ws_connected === false ? " / WS disconnected" : ""}`
                  : "not observed"}
              />
              <Field
                label="Public execution"
                value={selectedPaperExecutionSnapshot
                  ? formatPublicExecutionEvidenceSummary(selectedPaperExecutionSnapshot)
                  : "not observed"}
              />
              <Field
                label="Order book"
                value={selectedPaperExecutionSnapshot?.order_book
                  ? `${selectedPaperExecutionSnapshot.order_book.sync_status} / update ${selectedPaperExecutionSnapshot.order_book.last_update_id ?? "unknown"}${selectedPaperExecutionSnapshot.order_book.gap_detected ? " / gap recovered" : ""}`
                  : "not observed"}
              />
              <Field
                label="Paper decision"
                value={formatPaperDecisionSummary(selectedPaperDecision)}
              />
              <Field
                label="Paper account"
                value={selectedPaperAccount
                  ? `equity ${formatUsdt(Number(selectedPaperAccount.equity_usdt))} / ${selectedPaperAccount.position.side} ${selectedPaperAccount.position.quantity} BTCUSDT / open ${selectedPaperAccount.open_order_count}`
                  : "not observed"}
              />
              <Field
                label="Paper fill"
                value={selectedPaperFill
                  ? formatPaperFillSummary(selectedPaperFill)
                  : "none"}
              />
              {selectedPaperTradingEvaluation?.latest_failure_reason && (
                <Field label="Paper failure" value={selectedPaperTradingEvaluation.latest_failure_reason} />
              )}
              <Field label="Paper evidence" value={selectedPaperEvidenceStatus} />
              <Field label="TradingRun" value={selectedTradingRunStatus} />
              <Field label="Latest finding" value={selectedFinding} />
              <Field
                label="Lineage"
                value={selectedLineage?.source
                  ? `${selectedLineage.source.trading_system_id} -> ${selectedCandidateId ?? selectedCandidate?.candidate_id ?? selectedEntry?.candidate_id ?? "unknown"}`
                  : `${selectedParent ?? "none"} -> ${selectedCandidateId ?? selectedCandidate?.candidate_id ?? selectedEntry?.candidate_id ?? "unknown"}`}
              />
              <Field label="Authority" value={selectedAuthority} />
              {selectedLedgerSummary?.latest_order_request && (
                <Field
                  label="OrderRequest"
                  value={formatLedgerOrderRequestSummary(selectedLedgerSummary)}
                />
              )}
              {selectedLedgerSummary?.latest_gateway_result && (
                <Field
                  label="GatewayResult"
                  value={selectedLedgerSummary.latest_gateway_result.decision_outcome}
                />
              )}
              {selectedLedgerSummary?.latest_execution_result && (
                <Field
                  label="ExecutionResult"
                  value={selectedLedgerSummary.latest_execution_result.status}
                />
              )}
            </dl>
          </section>
        )}
        <section className="grid gap-2 rounded-md bg-muted/25 p-3" aria-label="Agent provider status">
          <h3 className="text-sm font-medium">Agent providers</h3>
          <Field label="Researcher" value={researcherProvider?.selected_provider ?? "not selected"} />
          <Field label="Selected status" value={selectedAgentProfile?.status ?? "missing"} />
          <Field label="Available" value={researcherProvider?.available_providers.join(", ") ?? "unknown"} />
          {selectedAgentProfile?.failure_reason && (
            <Field label="Failure" value={selectedAgentProfile.failure_reason} />
          )}
          <div className="flex flex-wrap gap-2">
            {researcherProvider?.available_providers.map((provider) => (
              <Button
                key={provider}
                type="button"
                variant={provider === selectedProvider ? "secondary" : "outline"}
                size="sm"
                onClick={() => isSelectableResearcherProvider(provider)
                  ? onSelectResearcherProvider?.(provider)
                  : undefined}
                disabled={actionPending || !onSelectResearcherProvider || !isSelectableResearcherProvider(provider)}
              >
                {provider}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedProvider ? onSetupAgentProvider?.(selectedProvider) : undefined}
              disabled={actionPending || !selectedProvider || !onSetupAgentProvider}
            >
              Setup
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedProvider ? onProbeAgentProvider?.(selectedProvider) : undefined}
              disabled={actionPending || !selectedProvider || !onProbeAgentProvider}
            >
              Probe
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectedProvider ? onStartAgentProviderLogin?.(selectedProvider) : undefined}
              disabled={actionPending || !selectedProvider || !onStartAgentProviderLogin}
            >
              Login
            </Button>
          </div>
          {agentProfiles.slice(0, 3).map((profile) => (
            <Field
              key={profile.profile_id}
              label={profile.label}
              value={`${profile.status} / ${profile.provider}`}
            />
          ))}
        </section>
        <section className="grid gap-2 rounded-md bg-muted/25 p-3" aria-label="Command log">
          <h3 className="text-sm font-medium">Command log</h3>
          {latestCommands.length
            ? latestCommands.slice(0, 5).map((command) => (
                <Field
                  key={command.command_id}
                  label={command.command_kind}
                  value={command.status}
                />
              ))
            : <p className="text-sm text-muted-foreground">No commands recorded.</p>}
        </section>
        <section className="grid gap-2" aria-label="Candidate Arena latest ticks">
          <h3 className="text-sm font-medium">Latest ticks</h3>
          {latestTick ? (
            <div className="grid gap-2 rounded-md bg-muted/25 p-3 text-sm md:grid-cols-[1fr_1fr_2fr]">
              <Field label="Tick" value={latestTick.tick_id} />
              <Field label="Status" value={latestTick.status} />
              <Field
                label="Researchers"
                value={latestTick.direction_results.map((result) =>
                  `${result.direction_kind}:${result.status}`
                ).join(", ")}
              />
            </div>
          ) : (
            <div className="placeholder">No Candidate Arena ticks recorded.</div>
          )}
        </section>
        </aside>
        </div>
        {message && <div className="inline-status">{message}</div>}
        {error && <div className="inline-status error">{error}</div>}
      </CardContent>
    </Card>
  );
}

function TradingPromotionBoundaryCard({
  promotion,
  paperBoardEntry,
  selectedCandidate,
  selectedPaperTradingEvaluation,
  onPromoteTradingCandidate,
  runningTradingPromotion
}: {
  promotion?: OperatorReadModel["trading_promotion"];
  paperBoardEntry?: PaperTradingBoardReadModel["entries"][number];
  selectedCandidate: CandidateInspectReadModel;
  selectedPaperTradingEvaluation?: PaperTradingEvaluationReadModel;
  onPromoteTradingCandidate?: () => void;
  runningTradingPromotion: boolean;
}) {
  const hasPaperEvaluation = Boolean(selectedPaperTradingEvaluation?.evaluation_id);
  const selectedIsPromoted = promotion?.candidate_id === selectedCandidate.candidate_id;
  const activePromotion = selectedIsPromoted ? promotion : undefined;
  const paperQualificationStatus = activePromotion?.paper_qualification_status
    ?? paperBoardEntry?.qualification_status;
  const paperQualificationReasons = activePromotion?.paper_qualification_reasons
    ?? paperBoardEntry?.qualification_reasons
    ?? [];
  const paperEvidenceWindow = activePromotion?.paper_evidence_window ?? paperBoardEntry?.evidence_window;
  const paperProfitLoss = activePromotion?.paper_profit_loss ?? paperBoardEntry?.profit_loss;
  const runnerStatus = activePromotion?.runner_status ?? paperBoardEntry?.runner_status;
  const nextAction = activePromotion?.next_action
    ?? (paperQualificationStatus
      ? tradingPromotionNextActionLabel(paperQualificationStatus)
      : "Start paper trading in Arena, then promote the selected candidate.");
  const promotionReady = paperQualificationStatus === "qualified";
  const promotedCandidateLabel = promotion?.display_name ?? promotion?.candidate_id ?? "No Trading review candidate";
  return (
    <Card aria-label="Trading promotion boundary">
      <CardHeader>
        <CardDescription>Promotion boundary</CardDescription>
        <CardTitle>Trading review candidate</CardTitle>
        <CardDescription>
          Arena candidates become Trading review candidates only after selected paper evidence exists. This does not enable live authority.
        </CardDescription>
        <CardAction className="flex flex-wrap justify-end gap-2">
          <Badge variant={activePromotion?.status === "promoted_for_trading_review" ? "default" : "secondary"}>
            {activePromotion?.status ?? "not_promoted"}
          </Badge>
          <Badge variant="secondary">{activePromotion?.readiness_status ?? tradingPromotionReadinessLabel(paperQualificationStatus)}</Badge>
          <Badge variant="secondary">live disabled</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Trading candidate" value={promotedCandidateLabel} />
          <Field
            label="Selected candidate"
            value={`${selectedCandidate.display_name}${selectedIsPromoted ? " / active Trading review" : ""}`}
          />
          <Field
            label="Paper qualification"
            value={paperQualificationStatus ?? selectedPaperTradingEvaluation?.status ?? "paper_required"}
          />
          <Field
            label="Qualification reasons"
            value={paperQualificationReasons.length ? paperQualificationReasons.join(", ") : paperQualificationStatus === "qualified" ? "qualified" : "paper_required"}
          />
          <Field
            label="Paper net"
            value={paperProfitLoss
              ? formatUsdt(paperProfitLoss.net_revenue_usdt)
              : selectedPaperTradingEvaluation
                ? formatUsdt(selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt)
                : "not evaluated"}
          />
          <Field
            label="Evidence window"
            value={paperEvidenceWindow
              ? `${paperEvidenceWindow.observation_count} obs / ${paperEvidenceWindow.failed_observation_count} failed`
              : selectedPaperTradingEvaluation
                ? `${selectedPaperTradingEvaluation.observation_count} observations`
                : "not started"}
          />
          <Field label="Runner" value={runnerStatus ?? "not promoted"} />
          <Field label="Next action" value={nextAction} />
          <Field label="Authority" value={activePromotion?.live_disabled_reason ?? "mlp_paper_only"} />
        </dl>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onPromoteTradingCandidate}
            disabled={!onPromoteTradingCandidate || runningTradingPromotion || !hasPaperEvaluation || !promotionReady}
          >
            {runningTradingPromotion ? "Moving" : "Move to Trading review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function tradingPromotionReadinessLabel(
  status: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"] | undefined
): NonNullable<OperatorReadModel["trading_promotion"]>["readiness_status"] {
  if (status === "qualified") {
    return "ready_to_promote";
  }
  if (status === "needs_resume") {
    return "needs_resume";
  }
  if (status === "blocked_by_quality" || status === "paper_failed") {
    return "blocked_by_quality";
  }
  if (status === "collecting_evidence") {
    return "collecting_paper_evidence";
  }
  return "paper_required";
}

function paperQualificationTone(
  status: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"] | undefined
): OperatorTone {
  if (status === "qualified") {
    return "good";
  }
  if (status === "blocked_by_quality" || status === "paper_failed") {
    return "danger";
  }
  return "warning";
}

function tradingPromotionNextActionLabel(
  status: NonNullable<OperatorReadModel["trading_promotion"]>["paper_qualification_status"]
): string {
  if (status === "qualified") {
    return "Move the selected candidate into Trading review while live remains disabled.";
  }
  if (status === "needs_resume") {
    return "Resume paper trading before moving this candidate into Trading review.";
  }
  if (status === "blocked_by_quality" || status === "paper_failed") {
    return "Fix paper evidence quality before this candidate can move into Trading review.";
  }
  return "Continue paper trading until the evidence window qualifies.";
}

function formatSelectedPaperEvidenceStatus(
  ledger: LedgerReadModel | undefined,
  runningPaperEvidence = false
): string {
  if (runningPaperEvidence) {
    return "running";
  }
  if (ledger?.chain_complete && ledger.chain_count > 0) {
    return "Ledger chain complete";
  }
  if (ledger?.has_activity) {
    return "failed";
  }
  return "not run";
}

function formatPaperEvidenceStatusLabel(status: SelectedPaperEvidenceReadModel["status"]): string {
  if (status === "ledger_chain_complete") {
    return "Ledger chain complete";
  }
  if (status === "not_run") {
    return "not run";
  }
  return status;
}

function formatSelectedTradingRunStatus(
  candidate: CandidateInspectReadModel | undefined,
  runningPaperEvidence = false
): string {
  if (runningPaperEvidence) {
    return "running";
  }
  const ledger = candidate?.ledger;
  if (!ledger?.has_activity || ledger.chain_count === 0) {
    return "not run";
  }
  return candidate?.trading_run?.lifecycle_status
    ?? candidate?.runtime.runtime_lifecycle_status
    ?? "recorded";
}

function formatLedgerOrderRequestSummary(ledger: LedgerReadModel): string {
  const orderRequest = ledger.latest_order_request;
  if (!orderRequest) {
    return "none";
  }
  return [
    orderRequest.side,
    orderRequest.order_type,
    orderRequest.quantity
  ].filter(Boolean).join(" ") || orderRequest.status;
}

function formatPaperDecisionSummary(
  decision: PaperTradingEvaluationReadModel["latest_decision"]
): string {
  if (!decision) {
    return "not observed";
  }
  if (decision.decision_kind !== "order_request" || !decision.order_request) {
    return `${decision.decision_kind} (${decision.reason})`;
  }
  return [
    "order_request",
    decision.order_request.side,
    decision.order_request.order_type,
    decision.order_request.quantity,
    decision.order_request.limit_price ? `@ ${decision.order_request.limit_price}` : undefined
  ].filter(Boolean).join(" ");
}

function formatPaperRunnerSummary(evaluation: PaperTradingEvaluationReadModel): string {
  const runnerStatus = paperTradingRunnerStatus(evaluation);
  return [
    runnerStatus,
    runnerStatus === "needs resume" ? "persisted running, timer inactive" : undefined,
    evaluation.next_observation_at ? `next ${formatCompactDateTime(evaluation.next_observation_at)}` : undefined
  ].filter(Boolean).join(" / ");
}

function paperTradingRunnerStatus(evaluation: PaperTradingEvaluationReadModel): string {
  if (evaluation.runner_active) {
    return "active";
  }
  if (evaluation.status === "running") {
    return "needs resume";
  }
  if (evaluation.status === "not_started") {
    return "not started";
  }
  return evaluation.status;
}

function formatPublicExecutionEvidenceSummary(
  snapshot: NonNullable<PaperTradingEvaluationReadModel["latest_public_execution_snapshot"]>
): string {
  return [
    snapshot.source_kind,
    snapshot.source_priority,
    snapshot.freshness,
    snapshot.ws_connected === true ? "WS connected" : undefined,
    snapshot.ws_connected === false ? "WS disconnected" : undefined,
    snapshot.rest_fallback_used ? "REST fallback" : undefined,
    snapshot.gap_detected ? "gap detected" : undefined,
    snapshot.stream_marker ? `marker ${snapshot.stream_marker}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatPaperFillSummary(
  fill: NonNullable<PaperTradingEvaluationReadModel["latest_fill"]>
): string {
  return [
    `${fill.fill_status} ${fill.fill_quantity} @ ${fill.fill_price}`,
    fill.source_trade_id ? `trade ${fill.source_trade_id}` : undefined
  ].filter(Boolean).join(" / ");
}

function FullCycleDeveloperControls({
  tradingResearchRuntime,
  selectedTradingResearchAgent,
  tradingResearchIterations,
  selectedResearchAgent,
  selectedResearchAgentBlocked,
  runningFullCycle,
  fullCycleMessage,
  fullCycleError,
  onSelectTradingResearchAgent,
  onTradingResearchIterationsChange,
  onRunFullCycle
}: {
  tradingResearchRuntime: TradingResearchRuntimeReadModel;
  selectedTradingResearchAgent: TradingResearchAgentSelection;
  tradingResearchIterations: number;
  selectedResearchAgent?: TradingResearchRuntimeReadModel["agents"][number];
  selectedResearchAgentBlocked: boolean;
  runningFullCycle: boolean;
  fullCycleMessage?: string;
  fullCycleError?: string;
  onSelectTradingResearchAgent?: (agent: TradingResearchAgentSelection) => void;
  onTradingResearchIterationsChange?: (iterations: number) => void;
  onRunFullCycle?: () => void;
}) {
  if (!onRunFullCycle) {
    return null;
  }
  return (
    <InfoSection
      title="Agent cycle controls"
      summary="Developer controls for a selected candidate paper run; Candidate Arena is the primary research workflow."
      badge="developer"
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center gap-1 rounded-md border bg-background px-1" aria-label="Researcher">
            {tradingResearchRuntime.available_agents.map((agent) => (
              <Button
                key={agent}
                type="button"
                variant={selectedTradingResearchAgent === agent ? "default" : "ghost"}
                size="sm"
                onClick={() => onSelectTradingResearchAgent?.(agent)}
                disabled={runningFullCycle}
              >
                {formatResearchAgentLabel(agent)}
              </Button>
            ))}
          </div>
          <Input
            aria-label="Research iterations"
            className="h-10 w-20"
            min={1}
            max={10}
            type="number"
            value={tradingResearchIterations}
            onChange={(event) => {
              const iterations = Number(event.target.value);
              if (Number.isInteger(iterations) && iterations >= 1 && iterations <= 10) {
                onTradingResearchIterationsChange?.(iterations);
              }
            }}
            disabled={runningFullCycle}
          />
          <Button
            type="button"
            onClick={onRunFullCycle}
            disabled={runningFullCycle || selectedResearchAgentBlocked}
          >
            {runningFullCycle ? "Running full cycle" : "Run next cycle"}
          </Button>
        </div>
        {selectedResearchAgentBlocked && (
          <p className="text-sm text-destructive">
            {formatResearchAgentLabel(selectedTradingResearchAgent)} unavailable: {selectedResearchAgent?.failure_reason ?? "not installed"}
          </p>
        )}
        {selectedResearchAgent && !selectedResearchAgentBlocked && (
          <p className="text-sm text-muted-foreground">
            {formatResearchAgentLabel(selectedTradingResearchAgent)} researcher ready
            {selectedResearchAgent.version ? `: ${selectedResearchAgent.version}` : ""}
          </p>
        )}
        {fullCycleMessage && <p className="text-sm text-muted-foreground">{fullCycleMessage}</p>}
        {fullCycleError && <p className="text-sm text-destructive">{fullCycleError}</p>}
      </div>
    </InfoSection>
  );
}

export function CandidateDetail({
  activeView = "details",
  onActiveViewChange,
  candidate,
  candidates = [],
  operator,
  candidateArena,
  tradingGatewayEnvironment,
  tradingResearchRuntime = defaultTradingResearchRuntime(),
  selectedTradingResearchAgent = tradingResearchRuntime.default_agent,
  tradingResearchIterations = tradingResearchRuntime.iterations,
  replayRuns = [],
  selectedReplayRunId,
  replayRunDetail,
  replayRunComparison,
  replayRunComparisonBaselineId,
  replayRunValidationState,
  executionModes = [],
  onSelectReplayRun,
  onSelectCandidate,
  onStartCandidateArena,
  onStopCandidateArena,
  onTickCandidateArena,
  onSetupAgentProvider,
  onProbeAgentProvider,
  onStartAgentProviderLogin,
  onSelectResearcherProvider,
  onSelectTradingResearchAgent,
  onTradingResearchIterationsChange,
  onRunCandidateReplay,
  onRunFullCycle,
  onStartTradingRun,
  onPromoteTradingCandidate,
  onStartRejectedPaperOrder,
  onObserveTradingRun,
  onStopTradingRun,
  onRecordImprovement,
  onRecordRunControl,
  onRecordPrivateReadinessPosture,
  runningFullCycle = false,
  runningCandidateReplay = false,
  runningTradingPromotion = false,
  runningCandidateArenaAction = false,
  runningTradingRun = false,
  recordingImprovement = false,
  recordingRunControl = false,
  recordingPrivateReadinessPosture = false,
  replayRunError,
  replayRunMessage,
  candidateArenaMessage,
  candidateArenaError,
  fullCycleError,
  fullCycleMessage,
  lastFullCycle,
  tradingRunError,
  tradingRunMessage,
  tradingPromotionError,
  tradingPromotionMessage,
  improvementError,
  improvementMessage,
  runtimeControlError,
  runtimeControlMessage,
  privateReadinessPostureError,
  privateReadinessPostureMessage
}: {
  activeView?: OperatorView;
  onActiveViewChange?: (view: OperatorView) => void;
  candidate: CandidateInspectReadModel;
  candidates?: CandidateSummaryReadModel[];
  operator?: OperatorReadModel;
  candidateArena?: CandidateArenaReadModel;
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchRuntime?: TradingResearchRuntimeReadModel;
  selectedTradingResearchAgent?: TradingResearchAgentSelection;
  tradingResearchIterations?: number;
  replayRuns?: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  executionModes?: TradingSystemExecutionModeContractReadModel[];
  onSelectReplayRun?: (runId: string) => void;
  onSelectCandidate?: (candidateId: string) => void;
  onStartCandidateArena?: () => void;
  onStopCandidateArena?: () => void;
  onTickCandidateArena?: () => void;
  onSetupAgentProvider?: (provider: AgentProfileProviderKind) => void;
  onProbeAgentProvider?: (provider: AgentProfileProviderKind) => void;
  onStartAgentProviderLogin?: (provider: AgentProfileProviderKind) => void;
  onSelectResearcherProvider?: (provider: "codex" | "fixture") => void;
  onSelectTradingResearchAgent?: (agent: TradingResearchAgentSelection) => void;
  onTradingResearchIterationsChange?: (iterations: number) => void;
  onRunCandidateReplay?: () => void;
  onRunFullCycle?: () => void;
  onStartTradingRun?: () => void;
  onPromoteTradingCandidate?: () => void;
  onStartRejectedPaperOrder?: () => void;
  onObserveTradingRun?: () => void;
  onStopTradingRun?: () => void;
  onRecordImprovement?: () => void;
  onRecordRunControl?: () => void;
  onRecordPrivateReadinessPosture?: (draft: PrivateReadinessPostureDraft) => void;
  runningFullCycle?: boolean;
  runningCandidateReplay?: boolean;
  runningTradingPromotion?: boolean;
  runningCandidateArenaAction?: boolean;
  runningTradingRun?: boolean;
  recordingImprovement?: boolean;
  recordingRunControl?: boolean;
  recordingPrivateReadinessPosture?: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
  candidateArenaMessage?: string;
  candidateArenaError?: string;
  fullCycleError?: string;
  fullCycleMessage?: string;
  lastFullCycle?: FullCycleOutcome;
  tradingRunError?: string;
  tradingRunMessage?: string;
  tradingPromotionError?: string;
  tradingPromotionMessage?: string;
  improvementError?: string;
  improvementMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
  privateReadinessPostureError?: string;
  privateReadinessPostureMessage?: string;
}) {
  const ledger = candidate.ledger;
  const operatorSelectedCandidateId = operator?.selected_candidate_id ?? candidate.candidate_id;
  const selectedArenaCandidate = candidate.candidate_id === operatorSelectedCandidateId ? candidate : undefined;
  const latestReplayRun = replayRuns[0];
  const publicMarketSurface = candidate.trading_substrate?.latest_public_market_liveness_surface ?? null;
  const orderFillSurface = candidate.trading_substrate?.latest_order_fill_surface ?? null;
  const accountPositionRiskSurface =
    candidate.trading_substrate?.latest_account_position_risk_mirror_surface ?? null;
  const selectedPaperTradingEvaluation = operator?.selected_paper_trading_evaluation;
  const selectedPaperEvaluationId = selectedPaperTradingEvaluation?.evaluation_id;
  const selectedPaperBoardEntry = operator?.paper_trading_board.entries.find((entry) =>
    entry.candidate_id === candidate.candidate_id &&
    entry.evaluation_id === selectedPaperEvaluationId
  ) ?? operator?.paper_trading_board.entries.find((entry) =>
    entry.candidate_id === candidate.candidate_id
  );
  const selectedPaperAccount = selectedPaperTradingEvaluation?.paper_account_snapshot;
  const selectedPaperPosition = selectedPaperAccount?.position;
  const selectedPaperFill = selectedPaperTradingEvaluation?.latest_fill;
  const tradingPromotion = operator?.trading_promotion;
  const selectedIsTradingReviewCandidate = tradingPromotion?.candidate_id === candidate.candidate_id;
  const tradingReadinessStatus = selectedIsTradingReviewCandidate
    ? tradingPromotion?.readiness_status
    : tradingPromotionReadinessLabel(selectedPaperBoardEntry?.qualification_status);
  const tradingQualificationStatus = selectedIsTradingReviewCandidate
    ? tradingPromotion?.paper_qualification_status
    : selectedPaperBoardEntry?.qualification_status;
  const tradingQualificationReasons = selectedIsTradingReviewCandidate
    ? tradingPromotion?.paper_qualification_reasons ?? []
    : selectedPaperBoardEntry?.qualification_reasons ?? [];
  const visibleFullCycle = lastFullCycle?.next_trading_system.candidate_id === candidate.candidate_id
    ? lastFullCycle
    : undefined;
  const visibleFullCycleLineage = visibleFullCycle?.full_cycle_lineage;
  const recoveredAgentCycle = !visibleFullCycle && isAgentCycleMaterialization(candidate)
    ? buildRecoveredAgentCycleEvidence(candidate)
    : undefined;
  const baseProfitSummary = buildOperatorProfitSummary(candidate, replayRunDetail, latestReplayRun, visibleFullCycle);
  const profitSummary = recoveredAgentCycle
    ? [
        {
          label: "Profit signal",
          value: "paper evidence",
          detail: "Agent SystemCode generated; paper Ledger recorded. Backtest score appears in the active cycle result.",
          tone: "good" as const
        },
        ...baseProfitSummary.slice(1)
      ]
    : baseProfitSummary;
  const runStatus = candidate.runtime.runtime_lifecycle_status ?? "registered";
  const ledgerStatus = ledger?.chain_complete
    ? "chain complete"
    : ledger?.has_activity
      ? "incomplete"
      : "not recorded";
  const improvementStatus = candidate.improvement?.chain_complete
    ? "chain complete"
    : candidate.improvement?.has_activity
      ? "incomplete"
      : "not recorded";
  const tradingSystemRows = buildTradingSystemRows(candidate, candidates);
  const accountAssetValue = selectedPaperAccount
    ? `${formatBalance(selectedPaperAccount.equity_usdt)} USDT`
    : accountPositionRiskSurface
    ? `${formatBalance(accountPositionRiskSurface.total_wallet_balance)} ${accountPositionRiskSurface.asset}`
    : "not connected";
  const accountAssetDetail = selectedPaperAccount
    ? `fake paper account; available ${formatBalance(selectedPaperAccount.available_balance_usdt)} USDT`
    : accountPositionRiskSurface
      ? `available ${formatBalance(accountPositionRiskSurface.available_balance)} ${accountPositionRiskSurface.asset}`
      : "Paper account waits for selected paper trading.";
  const todayPnlValue = selectedPaperTradingEvaluation
    ? formatUsdt(selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt)
    : accountPositionRiskSurface
    ? `${formatSignedBalance(accountPositionRiskSurface.unrealized_profit)} USDT`
    : "not measured";
  const todayPnlDetail = selectedPaperTradingEvaluation
    ? `return ${formatPercent(selectedPaperTradingEvaluation.profit_loss.net_return_pct)}; ${selectedPaperTradingEvaluation.observation_count} observations`
    : accountPositionRiskSurface
      ? `cross P&L ${formatSignedBalance(accountPositionRiskSurface.total_cross_un_pnl)} USDT`
      : "No paper P&L series has been measured yet.";
  const positionValue = selectedPaperPosition
    ? `${selectedPaperPosition.side} ${selectedPaperPosition.quantity}`
    : accountPositionRiskSurface
    ? `${accountPositionRiskSurface.position_side} ${accountPositionRiskSurface.position_amount}`
    : "no private read";
  const positionDetail = selectedPaperPosition
    ? `entry ${formatPrice(selectedPaperPosition.average_entry_price)}, mark ${formatPrice(selectedPaperPosition.mark_price)}, open ${selectedPaperAccount?.open_order_count ?? 0}`
    : accountPositionRiskSurface
      ? `entry ${formatPrice(accountPositionRiskSurface.entry_price)}, mark ${formatPrice(accountPositionRiskSurface.mark_price)}`
      : "Position waits for selected paper trading.";
  const readinessDetail = tradingQualificationReasons.length
    ? tradingQualificationReasons.join(", ")
    : tradingQualificationStatus ?? "paper_required";
  const operatorDecision = buildOperatorDecision({
    accountPositionRiskSurface,
    candidate,
    ledger,
    latestReplayRun,
    orderFillSurface,
    replayRunDetail
  });
  const runtimeEnvironment = tradingGatewayEnvironment?.runtime_environment ?? "paper";
  const marketFreshness = publicMarketSurface?.freshness ?? "no market data";
  const workspaceLabel = candidate.fixture_notice.mode === "fixture_convenience_mode"
    ? "Paper workspace"
    : "Local workspace";
  const nextCycleStatus = candidate.improvement?.latest_change_proposal
    ? "handoff ready"
    : visibleFullCycle
      ? "agent handoff ready"
      : recoveredAgentCycle
        ? "agent handoff ready"
      : candidate.improvement?.has_activity
      ? "review handoff"
      : "not produced";
  const evaluationStatusValue = visibleFullCycle
    ? `backtest ${visibleFullCycle.backtest.status}`
    : recoveredAgentCycle
      ? "backtest recorded"
    : improvementStatus;
  const evaluationStatusDetail = visibleFullCycle
    ? `score ${formatScore(visibleFullCycle.backtest.score)}; ${visibleFullCycle.backtest.summary}`
    : recoveredAgentCycle
      ? recoveredAgentCycle.evaluationDetail
    : candidate.improvement?.latest_evaluation_result
      ? `evaluation score ${formatScore(candidate.improvement.latest_evaluation_result.total_score)}`
      : latestReplayRun
        ? `${latestReplayRun.scenario_accepted}/${latestReplayRun.scenario_total} scenarios`
        : "No evaluation result yet.";
  const evaluationStatusTone = visibleFullCycle
    ? visibleFullCycle.backtest.status === "accepted" ? "good" : "warning"
    : recoveredAgentCycle
      ? "good"
    : candidate.improvement?.chain_complete || latestReplayRun?.status === "accepted" ? "good" : "neutral";
  const researchEvaluationStageStatus = visibleFullCycle
    ? `${visibleFullCycle.backtest.status} ${formatScore(visibleFullCycle.backtest.score)}`
    : recoveredAgentCycle
      ? "recorded"
    : candidate.improvement?.latest_evaluation_result
      ? `score ${formatScore(candidate.improvement.latest_evaluation_result.total_score)}`
      : latestReplayRun
        ? latestReplayRun.status
        : "needed";
  const researchEvaluationStageTone = visibleFullCycle
    ? visibleFullCycle.backtest.status === "accepted" ? "good" : "warning"
    : recoveredAgentCycle
      ? "good"
    : candidate.improvement?.latest_evaluation_result || latestReplayRun ? "good" : "warning";
  const improvementOutputStatus = visibleFullCycle
    ? visibleFullCycle.system_code_handoff.system_code_id
    : recoveredAgentCycle
      ? recoveredAgentCycle.systemCodeId
    : candidate.improvement?.latest_change_proposal?.proposal_id ?? "not produced";
  const improvementOutputTone = visibleFullCycle || recoveredAgentCycle || candidate.improvement?.latest_change_proposal
    ? "good"
    : "neutral";
  const nextCycleDetail = visibleFullCycle
    ? `agent ${visibleFullCycle.agent_research.agent.provider}; SystemCode ${visibleFullCycle.system_code_handoff.system_code_id}`
    : recoveredAgentCycle
      ? `agent ${recoveredAgentCycle.providerLabel}; SystemCode ${recoveredAgentCycle.systemCodeId}`
    : candidate.improvement?.latest_change_proposal
      ? `proposal ${candidate.improvement.latest_change_proposal.proposal_id}`
      : "Run a full cycle to produce the next System Code candidate.";
  const selectedResearchAgent = tradingResearchRuntime.agents.find(
    (agent) => agent.agent === selectedTradingResearchAgent
  );
  const selectedResearchAgentBlocked = selectedResearchAgent?.readiness_status === "blocked_or_not_installed";
  return (
    <article className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
      <Tabs
        value={activeView}
        onValueChange={(value) => onActiveViewChange?.(value as OperatorView)}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{workspaceLabel}</p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">BTCUSDT operator cockpit</h2>
          </div>
          <TabsList>
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="arena">Arena</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="arena" className="flex flex-col gap-4">
      {candidateArena && (
        <CandidateArenaPanel
          arena={candidateArena}
          selectedCandidateId={operatorSelectedCandidateId}
          selectedCandidate={selectedArenaCandidate}
          researcherProvider={operator?.researcher_provider}
          agentProfiles={operator?.agent_profiles}
          latestCommands={operator?.latest_commands}
          selectedPaperEvidence={operator?.selected_paper_evidence}
          selectedPaperTradingEvaluation={operator?.selected_paper_trading_evaluation}
          paperTradingBoard={operator?.paper_trading_board}
          onStart={onStartCandidateArena}
          onStop={onStopCandidateArena}
          onTick={onTickCandidateArena}
          onSelectCandidate={(candidateId) => void onSelectCandidate?.(candidateId)}
          onStartPaperTrading={selectedArenaCandidate ? onStartTradingRun : undefined}
          onObservePaperTrading={selectedArenaCandidate ? onObserveTradingRun : undefined}
          onStopPaperTrading={selectedArenaCandidate ? onStopTradingRun : undefined}
          onSetupAgentProvider={onSetupAgentProvider}
          onProbeAgentProvider={onProbeAgentProvider}
          onStartAgentProviderLogin={onStartAgentProviderLogin}
          onSelectResearcherProvider={onSelectResearcherProvider}
          actionPending={runningCandidateArenaAction}
          runningPaperTrading={runningTradingRun}
          message={tradingRunMessage ?? candidateArenaMessage}
          error={tradingRunError ?? candidateArenaError}
        />
      )}
      {!candidateArena && (
        <Card aria-label="Arena unavailable">
          <CardHeader>
            <CardTitle>Arena</CardTitle>
            <CardDescription>
              Continuous paper trading arena state is not projected yet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="trading" className="flex flex-col gap-4">
      <Card aria-label="Operator decision bar">
        <CardHeader>
          <CardDescription>{workspaceLabel}</CardDescription>
          <CardTitle>Trading</CardTitle>
          <CardDescription>
            Actual trading and realized-profit cockpit. Live exchange authority remains disabled in this MLP. {operatorDecision.detail}
          </CardDescription>
          <CardAction className="flex flex-wrap justify-end gap-2">
          <Badge variant="secondary">{formatAuthorityLabel(candidate.runtime.authority_status)}</Badge>
          <Badge variant={runStatus === "running" ? "default" : "secondary"}>{runStatus}</Badge>
          <Badge variant="secondary">{formatRuntimeEnvironment(runtimeEnvironment)}</Badge>
          <Badge variant={marketFreshness === "fresh" ? "default" : "secondary"}>
            {formatFreshnessLabel(marketFreshness)}
          </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <Card size="sm" className={toneCardClass(operatorDecision.tone)}>
          <CardHeader>
            <CardDescription>Recommended action</CardDescription>
            <CardTitle>{operatorDecision.value}</CardTitle>
          </CardHeader>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          {onObserveTradingRun && (
            <Button
              type="button"
              onClick={onObserveTradingRun}
              disabled={runningTradingRun}
              variant="secondary"
            >
              Observe
            </Button>
          )}
          {onStopTradingRun && (
            <Button
              type="button"
              onClick={onStopTradingRun}
              disabled={runningTradingRun || candidate.runtime.runtime_lifecycle_status === "stopped"}
              variant="outline"
            >
              Stop
            </Button>
          )}
        </div>
        </CardContent>
      </Card>

      <TradingPromotionBoundaryCard
        promotion={tradingPromotion}
        paperBoardEntry={selectedPaperBoardEntry}
        selectedCandidate={candidate}
        selectedPaperTradingEvaluation={operator?.selected_paper_trading_evaluation}
        onPromoteTradingCandidate={onPromoteTradingCandidate}
        runningTradingPromotion={runningTradingPromotion}
      />

      {(tradingRunMessage || tradingRunError || tradingPromotionMessage || tradingPromotionError) && (
        <Card aria-label="Operator messages">
          <CardContent className="grid gap-2">
            {tradingRunMessage && <p className="text-sm text-muted-foreground">{tradingRunMessage}</p>}
            {tradingRunError && <p className="text-sm text-destructive">{tradingRunError}</p>}
            {tradingPromotionMessage && <p className="text-sm text-muted-foreground">{tradingPromotionMessage}</p>}
            {tradingPromotionError && <p className="text-sm text-destructive">{tradingPromotionError}</p>}
          </CardContent>
        </Card>
      )}

      <Card aria-label="Safety boundary">
        <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Safety boundary</Badge>
        <Badge variant="secondary">Paper mode</Badge>
        <Badge variant="secondary">No exchange order</Badge>
        <Badge variant="secondary">No API credentials</Badge>
        <Badge variant="secondary">{formatRuntimeEnvironment(runtimeEnvironment)}</Badge>
        <span className="text-sm text-muted-foreground">{candidate.fixture_notice.statements[0]}</span>
        </CardContent>
      </Card>

      <Card aria-label="Trading cockpit">
        <CardHeader>
          <CardTitle>Trading cockpit</CardTitle>
          <CardDescription>{candidate.display_name}</CardDescription>
          <CardAction>
          <Badge variant={publicMarketSurface?.symbol_status === "TRADING" ? "default" : "secondary"}>
            {publicMarketSurface?.symbol_status ?? "no market data"}
          </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">

        <Card aria-label="BTCUSDT futures chart">
          <CardHeader>
            <CardTitle>BTCUSDT futures chart</CardTitle>
            <CardDescription>
              {publicMarketSurface ? "Binance USD-M Futures snapshot" : "Market feed is not connected yet."}
            </CardDescription>
            <CardAction>
            <Badge variant={publicMarketSurface?.symbol_status === "TRADING" ? "default" : "secondary"}>
              {publicMarketSurface?.symbol_status ?? "no market data"}
            </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
          <BtcFuturesChart market={publicMarketSurface} />
          <div className="grid gap-2 md:grid-cols-4">
            <MiniStat label="Mark price" value={formatPrice(publicMarketSurface?.mark_price)} />
            <MiniStat label="Index price" value={formatPrice(publicMarketSurface?.index_price)} />
            <MiniStat label="Funding" value={publicMarketSurface?.funding_rate ?? "not connected"} />
            <MiniStat label="Next funding" value={formatCompactDateTime(publicMarketSurface?.next_funding_time)} />
          </div>
          </CardContent>
        </Card>

        <section className="grid gap-3 md:grid-cols-4" aria-label="Paper trading review summary">
          <OperatorMetricCard
            label="Paper equity"
            value={accountAssetValue}
            detail={accountAssetDetail}
            tone={selectedPaperAccount || accountPositionRiskSurface ? "good" : "warning"}
          />
          <OperatorMetricCard
            label="Paper net revenue"
            value={todayPnlValue}
            detail={todayPnlDetail}
            tone={selectedPaperTradingEvaluation
              ? selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt >= 0 ? "good" : "danger"
              : accountPositionRiskSurface ? signedTone(accountPositionRiskSurface.unrealized_profit) : "warning"}
          />
          <OperatorMetricCard
            label="Paper position"
            value={positionValue}
            detail={positionDetail}
            tone={selectedPaperPosition || accountPositionRiskSurface ? "good" : "neutral"}
          />
          <OperatorMetricCard
            label="Promotion readiness"
            value={tradingReadinessStatus ?? "paper_required"}
            detail={readinessDetail}
            tone={paperQualificationTone(tradingQualificationStatus)}
          />
        </section>

        <Card size="sm" aria-label="Trading paper readback">
          <CardHeader>
            <CardDescription>Paper readback</CardDescription>
            <CardTitle>Selected-candidate evidence</CardTitle>
            <CardAction>
              <Badge variant={selectedIsTradingReviewCandidate ? "default" : "secondary"}>
                {selectedIsTradingReviewCandidate ? "Trading review" : "Arena selection"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Field
                label="Paper evaluation"
                value={selectedPaperTradingEvaluation
                  ? `${selectedPaperTradingEvaluation.status} / ${selectedPaperTradingEvaluation.observation_count} observations`
                  : "not started"}
              />
              <Field
                label="Runner"
                value={selectedPaperTradingEvaluation
                  ? paperTradingRunnerStatus(selectedPaperTradingEvaluation)
                  : selectedPaperBoardEntry?.runner_status ?? "not started"}
              />
              <Field
                label="Latest fill"
                value={selectedPaperFill
                  ? formatPaperFillSummary(selectedPaperFill)
                  : selectedPaperBoardEntry?.latest_fill_status ?? "none"}
              />
              <Field
                label="Market source"
                value={selectedPaperTradingEvaluation?.latest_public_execution_snapshot
                  ? formatPublicExecutionEvidenceSummary(selectedPaperTradingEvaluation.latest_public_execution_snapshot)
                  : selectedPaperBoardEntry?.latest_public_execution_source ?? selectedPaperTradingEvaluation?.market_data_source ?? "not connected"}
              />
            </dl>
          </CardContent>
        </Card>

        <TradeStatusPanel
          ledgerStatus={ledgerStatus}
          ledger={ledger}
          orderFillSurface={orderFillSurface}
        />
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="research" className="flex flex-col gap-4">
      <Card aria-label="System performance">
        <CardHeader>
          <CardTitle>System performance</CardTitle>
          <CardDescription>Current system quality, risk posture, and the next action for the operator.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
        <Card size="sm" className={toneCardClass(operatorDecision.tone)}>
          <CardHeader>
            <CardDescription>Operator decision</CardDescription>
            <CardTitle>{operatorDecision.value}</CardTitle>
            <CardDescription>{operatorDecision.detail}</CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-3 md:grid-cols-4">
          <OperatorStatusCard
            label="Profit analysis"
            value={profitSummary[0].value}
            detail={profitSummary[0].detail}
            tone={profitSummary[0].tone}
          />
          <OperatorStatusCard
            label="Selected Trading System"
            value={runStatus}
            detail={`${candidate.display_name}; ${candidate.runtime.stage_binding_profile} / ${candidate.runtime.authority_status}`}
            tone={runStatus === "running" ? "good" : "neutral"}
          />
          <OperatorStatusCard
            label="Evaluation"
            value={evaluationStatusValue}
            detail={evaluationStatusDetail}
            tone={evaluationStatusTone}
          />
          <OperatorStatusCard
            label="Next cycle handoff"
            value={nextCycleStatus}
            detail={nextCycleDetail}
            tone={visibleFullCycle || recoveredAgentCycle || candidate.improvement?.latest_change_proposal ? "good" : "warning"}
          />
        </div>
        </CardContent>
      </Card>

      <Card aria-label="Research cycle">
        <CardHeader>
          <CardTitle>Research</CardTitle>
          <CardDescription>
            How the same Trading System is evaluated, improved, and prepared for the next cycle.
          </CardDescription>
          <CardAction>
          <Badge variant="secondary">{String(tradingSystemRows.length)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-4" aria-label="Research cycle">
          <ResearchStage
            label="Current System Code"
            status={candidate.program.summary}
            tone="good"
          />
          <ResearchStage
            label="Evaluation"
            status={researchEvaluationStageStatus}
            tone={researchEvaluationStageTone}
          />
          <ResearchStage
            label="Improvement output"
            status={improvementOutputStatus}
            tone={improvementOutputTone}
          />
          <ResearchStage
            label="Next cycle"
            status={nextCycleStatus}
            tone={nextCycleStatus === "handoff ready" || nextCycleStatus === "agent handoff ready" ? "good" : "warning"}
          />
        </div>
        <div className="grid gap-2">
          {tradingSystemRows.map((row) => (
            <Card size="sm" key={row.id} className={row.active ? "border-primary/40" : ""}>
              <CardHeader>
                <CardDescription>{row.status}</CardDescription>
                <CardTitle className="text-sm">{row.name}</CardTitle>
                <CardDescription>{row.evaluation}</CardDescription>
                <CardAction>
              <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "running view" : "queued"}</Badge>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>
        </CardContent>
      </Card>

      {visibleFullCycle && (
        <Card aria-label="Agent generated Trading System">
          <CardHeader>
            <CardTitle>Agent generated Trading System</CardTitle>
            <CardDescription>
              {visibleFullCycle.agent_research.agent.provider} produced SystemCode, backtest accepted it, and paper trading recorded a Ledger chain.
            </CardDescription>
            <CardAction>
              <Badge variant="default">{visibleFullCycle.agent_research.latest_decision}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              <OperatorStatusCard
                label="System Code"
                value={visibleFullCycle.system_code_handoff.system_code_id}
                detail={visibleFullCycle.system_code_handoff.runtime_kind}
                tone="good"
              />
              <OperatorStatusCard
                label="Backtest"
                value={formatScore(visibleFullCycle.backtest.score)}
                detail={visibleFullCycle.backtest.summary}
                tone={visibleFullCycle.backtest.status === "accepted" ? "good" : "warning"}
              />
              <OperatorStatusCard
                label="Paper Trading Run"
                value={visibleFullCycle.trading_run.lifecycle_status ?? "registered"}
                detail={`${visibleFullCycle.paper_trading.provider_request_count} provider calls`}
                tone={visibleFullCycle.trading_run.lifecycle_status === "running" ? "good" : "neutral"}
              />
              <OperatorStatusCard
                label="Ledger"
                value={visibleFullCycle.ledger.chain_complete ? "chain complete" : "incomplete"}
                detail="OrderRequest -> GatewayResult -> ExecutionResult"
                tone={visibleFullCycle.ledger.chain_complete ? "good" : "warning"}
              />
            </div>
            {visibleFullCycleLineage && <FullCycleLineageSection lineage={visibleFullCycleLineage} />}
          </CardContent>
        </Card>
      )}

      {!visibleFullCycle && recoveredAgentCycle && (
        <Card aria-label="Agent generated Trading System">
          <CardHeader>
            <CardTitle>Agent generated Trading System</CardTitle>
            <CardDescription>
              {recoveredAgentCycle.providerLabel} produced SystemCode, paper trading recorded a Ledger chain, and the Trading System is ready for the next cycle.
            </CardDescription>
            <CardAction>
              <Badge variant="default">materialized</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              <OperatorStatusCard
                label="System Code"
                value={recoveredAgentCycle.systemCodeId}
                detail={candidate.system_code?.declared_runtime ?? candidate.program.manifest.declared_runtime}
                tone="good"
              />
              <OperatorStatusCard
                label="Backtest"
                value="recorded"
                detail={recoveredAgentCycle.evaluationDetail}
                tone="good"
              />
              <OperatorStatusCard
                label="Paper Trading Run"
                value={runStatus}
                detail="Ledger chain is visible in the current Trading Run."
                tone={ledger?.chain_complete ? "good" : "neutral"}
              />
              <OperatorStatusCard
                label="Ledger"
                value={ledger?.chain_complete ? "chain complete" : "incomplete"}
                detail="OrderRequest -> GatewayResult -> ExecutionResult"
                tone={ledger?.chain_complete ? "good" : "warning"}
              />
            </div>
            {recoveredAgentCycle.fullCycleLineage && (
              <FullCycleLineageSection lineage={recoveredAgentCycle.fullCycleLineage} />
            )}
          </CardContent>
        </Card>
      )}

        </TabsContent>

        <TabsContent value="details" className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{candidate.display_name}</CardTitle>
          <CardDescription>Fixture dry-run only - why the first screen does not show real P&L yet</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline">{candidate.fixture_notice.label}</Badge>
          <Badge variant="outline">fixture mode: {candidate.fixture_notice.mode}</Badge>
          {candidate.fixture_notice.statements.map((statement) => (
            <Badge key={statement} variant="outline">{statement}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card aria-label="Details">
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Open only the area you need. Raw refs and implementation records stay below this line.</CardDescription>
        </CardHeader>
        <CardContent>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReplayRunsSection
            runs={replayRuns}
            selectedRunId={selectedReplayRunId}
            detail={replayRunDetail}
            comparison={replayRunComparison}
            comparisonBaselineId={replayRunComparisonBaselineId}
            validationState={replayRunValidationState}
            onSelectRun={onSelectReplayRun}
            onRunCandidateReplay={onRunCandidateReplay}
            runningCandidateReplay={runningCandidateReplay}
            replayRunError={replayRunError}
            replayRunMessage={replayRunMessage}
          />

          <FullCycleDeveloperControls
            tradingResearchRuntime={tradingResearchRuntime}
            selectedTradingResearchAgent={selectedTradingResearchAgent}
            tradingResearchIterations={tradingResearchIterations}
            selectedResearchAgent={selectedResearchAgent}
            selectedResearchAgentBlocked={selectedResearchAgentBlocked}
            runningFullCycle={runningFullCycle}
            fullCycleMessage={fullCycleMessage}
            fullCycleError={fullCycleError}
            onSelectTradingResearchAgent={onSelectTradingResearchAgent}
            onTradingResearchIterationsChange={onTradingResearchIterationsChange}
            onRunFullCycle={onRunFullCycle}
          />

          <InfoSection
            title="Trace And Evaluation"
            summary={evaluationStatusLabel(candidate.evaluation)}
            badge={candidate.evaluation.counted_evidence.evidence_disposition}
          >
            <EvaluationSection evaluation={candidate.evaluation} />
          </InfoSection>

          <ImprovementSection
            improvement={candidate.improvement}
            onRecordImprovement={onRecordImprovement}
            recordingImprovement={recordingImprovement}
            improvementError={improvementError}
            improvementMessage={improvementMessage}
          />

          <InfoSection
            title="Trading Run"
            summary={`${runStatus} / ${candidate.runtime.authority_status}`}
            badge={runStatus}
          >
            <div className={`evaluation-status ${runStatus === "running" ? "counted" : "neutral"}`}>
              <span>Lifecycle</span>
              <strong>{runStatus}</strong>
              <span>{candidate.runtime.authority_status}</span>
            </div>
            <Field label="Ref" value={formatRef(candidate.runtime.ref)} />
            <Field label="Stage binding" value={candidate.runtime.stage_binding_profile} />
            {candidate.runtime.runtime_lifecycle_status && (
              <Field label="Lifecycle" value={candidate.runtime.runtime_lifecycle_status} />
            )}
            <Field label="Authority" value={candidate.runtime.authority_status} />
            <Placeholder item={candidate.runtime.placement} />
            <Placeholder item={candidate.runtime.hands_environment} />
            <Field label="Memory trust" value={candidate.runtime.memory_surface.trust_class} />
            <Field label="Memory access" value={candidate.runtime.memory_surface.access_mode} />
            <Field label="Memory authority" value={candidate.runtime.memory_surface.authority_status} />
            {(onStartTradingRun || onStartRejectedPaperOrder || onObserveTradingRun || onStopTradingRun) && (
              <div className="runtime-command">
                {onStartTradingRun && (
                  <Button
                    className="runtime-command-button"
                    type="button"
                    onClick={onStartTradingRun}
                    disabled={runningTradingRun}
                  >
                    {runningTradingRun ? "Working trading run" : "Start trading run"}
                  </Button>
                )}
                {onStartRejectedPaperOrder && (
                  <Button
                    className="runtime-command-button"
                    type="button"
                    onClick={onStartRejectedPaperOrder}
                    disabled={runningTradingRun}
                    variant="outline"
                  >
                    Run rejected paper order
                  </Button>
                )}
                {onObserveTradingRun && (
                  <Button
                    className="runtime-command-button"
                    type="button"
                    onClick={onObserveTradingRun}
                    disabled={runningTradingRun}
                    variant="secondary"
                  >
                    Observe
                  </Button>
                )}
                {onStopTradingRun && (
                  <Button
                    className="runtime-command-button"
                    type="button"
                    onClick={onStopTradingRun}
                    disabled={runningTradingRun || candidate.runtime.runtime_lifecycle_status === "stopped"}
                    variant="outline"
                  >
                    Stop
                  </Button>
                )}
                <span>run_control / fixture_paper / not_live</span>
              </div>
            )}
          </InfoSection>

          <LedgerSection ledger={ledger} />

          <TradingGatewayContractSection
            contract={candidate.trading_substrate?.latest_trading_gateway_contract}
          />

          <TradingGatewayEnvironmentSection environment={tradingGatewayEnvironment} />

          <SandboxSection sandbox={candidate.runtime.sandbox} />

          <TradingRunTranscriptSection transcript={candidate.runtime.transcript} />

          <InfoSection
            title="Trading System"
            summary={`${candidate.status} / ${latestValidationStateLabel(candidate.latest_validation_state)}`}
            badge={candidate.status}
          >
            <Field label="Status" value={candidate.status} />
            <Field label="Active version" value={candidate.active_version_id} />
            <Field label="Latest validation state" value={latestValidationStateLabel(candidate.latest_validation_state)} />
            <Field label="Provenance refs" value={candidate.candidate_version.provenance_refs.map(formatRef).join(", ")} />
            {candidate.latest_validation_state && (
              <CandidateLatestValidationStateBlock validationState={candidate.latest_validation_state} />
            )}
          </InfoSection>

          <InfoSection
            title="Spec"
            summary={`${candidate.spec.market} / ${candidate.spec.instrument}`}
            badge={candidate.spec.supported_stage_binding_profiles.join(", ")}
          >
            <Field label="Ref" value={formatRef(candidate.spec.ref)} />
            <Field label="Summary" value={candidate.spec.summary} />
            <Field label="Market" value={`${candidate.spec.market} / ${candidate.spec.instrument}`} />
            <Field label="Stage profiles" value={candidate.spec.supported_stage_binding_profiles.join(", ")} />
          </InfoSection>

          <InfoSection
            title="System Code"
            summary={candidate.program.summary}
            badge={candidate.program.manifest.declared_runtime}
          >
            <Field label="Ref" value={formatRef(candidate.program.ref)} />
            <Field label="Summary" value={candidate.program.summary} />
            <Field label="Manifest" value={formatRef(candidate.program.manifest.ref)} />
            <Field label="Runtime" value={candidate.program.manifest.declared_runtime} />
            <Placeholder item={candidate.program.validation} />
          </InfoSection>

          <InfoSection
            title="Capability Package"
            summary={`allowed: ${candidate.capability_package.manifest.allowed_stages.join(", ")}`}
            badge="not_live"
          >
            <Field label="Ref" value={formatRef(candidate.capability_package.ref)} />
            <Field label="Summary" value={candidate.capability_package.summary} />
            <Field label="Allowed stages" value={candidate.capability_package.manifest.allowed_stages.join(", ")} />
            <Field label="Declared permissions" value={candidate.capability_package.manifest.declared_permissions.join(", ")} />
            <Field label="Forbidden contents" value={candidate.capability_package.manifest.forbidden_contents.join(", ")} />
            <Placeholder item={candidate.capability_package.admission} />
            <Placeholder item={candidate.capability_package.grant} />
            <Placeholder item={candidate.capability_package.mount} />
          </InfoSection>

          <InfoSection
            title="Agent And Provider"
            summary={candidate.agent_provider.provider_readiness.authority_status}
            badge={candidate.agent_provider.provider_readiness.authority_status}
          >
            <Placeholder item={candidate.agent_provider.agent_spec} />
            <Placeholder item={candidate.agent_provider.agent_session} />
            <Placeholder item={candidate.agent_provider.agent_run} />
            <Placeholder item={candidate.agent_provider.agent_event} />
            <Placeholder item={candidate.agent_provider.provider_readiness} />
            <Placeholder item={candidate.agent_provider.provider_probe_attempt} />
          </InfoSection>

          <MaterializationAttemptSection attempt={candidate.materialization_attempt} />

          <TradingExecutionModesSection modes={executionModes} />

          <TradingSubstrateSection
            key={candidate.candidate_id}
            orderFillSurface={candidate.trading_substrate?.latest_order_fill_surface}
            publicMarketSurface={candidate.trading_substrate?.latest_public_market_liveness_surface}
            privateReadinessSurface={candidate.trading_substrate?.latest_private_readiness_preflight_surface}
            privateReadinessPosture={candidate.trading_substrate?.latest_private_readiness_posture}
            privateReadinessPostureHistory={candidate.trading_substrate?.private_readiness_posture_history ?? []}
            privateReadinessPolicyDecision={candidate.trading_substrate?.latest_private_readiness_policy_decision}
            privateReadGateDecision={candidate.trading_substrate?.latest_private_read_gate_decision}
            accountPositionRiskSurface={candidate.trading_substrate?.latest_account_position_risk_mirror_surface}
            onRecordPrivateReadinessPosture={onRecordPrivateReadinessPosture}
            recordingPrivateReadinessPosture={recordingPrivateReadinessPosture}
            privateReadinessPostureError={privateReadinessPostureError}
            privateReadinessPostureMessage={privateReadinessPostureMessage}
          />

          <RunControlSection
            control={candidate.runtime.run_control}
            privateReadinessPolicyDecision={
              candidate.trading_substrate?.latest_private_readiness_policy_decision
            }
            onRecordRunControl={onRecordRunControl}
            recordingRunControl={recordingRunControl}
            runtimeControlError={runtimeControlError}
            runtimeControlMessage={runtimeControlMessage}
          />
        </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </article>
  );
}

type OperatorTone = "good" | "warning" | "danger" | "neutral";

interface OperatorMetric {
  label: string;
  value: string;
  detail: string;
  tone: OperatorTone;
}

interface RecoveredAgentCycleEvidence {
  providerLabel: string;
  systemCodeId: string;
  evaluationDetail: string;
  fullCycleLineage?: NonNullable<CandidateInspectReadModel["full_cycle_lineage"]>;
}

function isAgentCycleMaterialization(candidate: CandidateInspectReadModel): boolean {
  return Boolean(
    candidate.materialization_attempt?.idempotency_key.startsWith("agent-cycle-materialize:") &&
    candidate.materialization_attempt.status === "materialized" &&
    candidate.materialization_attempt.validation_status === "accepted" &&
    candidate.ledger?.chain_complete
  );
}

function buildRecoveredAgentCycleEvidence(
  candidate: CandidateInspectReadModel
): RecoveredAgentCycleEvidence {
  const providerLabel = providerKindLabel(candidate.materialization_attempt?.provider_kind);
  const systemCodeId = candidate.system_code?.ref?.id
    ?? candidate.materialization_attempt?.artifact_refs.find((ref) => ref.record_kind === "system_code")?.id
    ?? "system-code-not-linked";

  return {
    providerLabel,
    systemCodeId,
    evaluationDetail: candidate.full_cycle_lineage
      ? "Agent materialization accepted; recovered full-cycle lineage includes backtest and paper Ledger evidence."
      : "Agent materialization accepted; paper Ledger chain complete. Full backtest score is available in the active cycle result.",
    fullCycleLineage: candidate.full_cycle_lineage
  };
}

function FullCycleLineageSection({
  lineage
}: {
  lineage: NonNullable<CandidateInspectReadModel["full_cycle_lineage"]>;
}) {
  return (
    <section className="grid gap-2" aria-label="Full-cycle lineage">
      <h4 className="text-sm font-medium">Full-cycle lineage</h4>
      <dl className="grid gap-2 md:grid-cols-4">
        <Field
          label="Source Trading System"
          value={lineage.source.trading_system_id}
        />
        <Field
          label="Source System Code"
          value={lineage.source.system_code_ref
            ? formatRef(lineage.source.system_code_ref)
            : "none"}
        />
        <Field
          label="Next Trading System"
          value={lineage.materialized?.trading_system_id ?? "not materialized"}
        />
        <Field
          label="Evidence Chain"
          value={lineage.evidence?.ledger_chain_complete
            ? "Ledger chain complete"
            : lineage.blocked_stage ?? "pending"}
        />
      </dl>
    </section>
  );
}

function providerKindLabel(providerKind?: string): string {
  if (providerKind === "codex_cli") {
    return "codex";
  }
  if (providerKind === "claude_code") {
    return "claude";
  }
  if (providerKind === "fixture_only") {
    return "fixture";
  }
  return providerKind ?? "agent";
}

function isSelectableResearcherProvider(
  provider: AgentProfileProviderKind
): provider is "codex" | "fixture" {
  return provider === "codex" || provider === "fixture";
}

function selectableResearcherProvider(provider: AgentProfileProviderKind): "codex" | "fixture" {
  if (isSelectableResearcherProvider(provider)) {
    return provider;
  }
  throw new Error(`Researcher provider ${provider} is not supported yet.`);
}

function OperatorMetricCard({
  label,
  value,
  detail,
  tone
}: OperatorMetric) {
  return (
    <Card size="sm" className={toneCardClass(tone)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function OperatorStatusCard({
  label,
  value,
  detail,
  tone
}: OperatorMetric) {
  return (
    <Card size="sm" className={toneCardClass(tone)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

function TradeStatusPanel({
  ledger,
  ledgerStatus,
  orderFillSurface
}: {
  ledger?: LedgerReadModel;
  ledgerStatus: string;
  orderFillSurface?: OrderFillSurfaceReadModel | null;
}) {
  const requestedQuantity = orderFillSurface?.requested_quantity ?? ledger?.latest_order_request?.quantity;
  const filledQuantity = orderFillSurface?.cumulative_filled_quantity ?? "0";
  const fillPercent = calculateFillPercent(filledQuantity, requestedQuantity);
  const sideAndType = orderFillSurface?.side && orderFillSurface.order_type
    ? `${orderFillSurface.side} ${orderFillSurface.order_type}`
    : ledger?.latest_order_request
      ? `${ledger.latest_order_request.side} ${ledger.latest_order_request.order_type}`
      : "no order request";

  return (
    <Card aria-label="Trade status">
      <CardHeader>
        <CardTitle>Order / trade status</CardTitle>
        <CardDescription>What the current system attempted and what happened.</CardDescription>
        <CardAction>
        <Badge variant={orderFillSurface ? "default" : ledger?.chain_complete ? "default" : "secondary"}>
          {orderFillSurface?.posture ?? ledgerStatus}
        </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-4">
        <MiniStat label="Side / type" value={sideAndType} />
        <MiniStat label="Filled" value={`${filledQuantity}/${requestedQuantity ?? "0"}`} />
        <MiniStat label="Average price" value={orderFillSurface?.average_fill_price ?? "not filled"} />
        <MiniStat label="Execution" value={ledger?.latest_execution_result?.status ?? "not recorded"} />
      </div>
      <Progress value={fillPercent} aria-label="Fill progress" />
      <div className="flex flex-wrap gap-2">
        <Badge variant={ledger?.latest_order_request ? "default" : "secondary"}>OrderRequest</Badge>
        <Badge variant={ledger?.latest_gateway_result ? "default" : "secondary"}>GatewayResult</Badge>
        <Badge variant={ledger?.latest_execution_result ? "default" : "secondary"}>ExecutionResult</Badge>
      </div>
      </CardContent>
    </Card>
  );
}

function ResearchStage({
  label,
  status,
  tone
}: {
  label: string;
  status: string;
  tone: OperatorTone;
}) {
  return (
    <Card size="sm" className={toneCardClass(tone)}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-sm">{status}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function BtcFuturesChart({ market }: { market?: PublicMarketLivenessSurfaceReadModel | null }) {
  if (!market) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market feed not connected</CardTitle>
          <CardDescription>
            Connect Binance USD-M Futures public market data to render the live BTCUSDT chart.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const points = marketChartPoints(market);
  return (
    <Card>
      <CardContent className="grid gap-3">
      <svg
        className="aspect-[16/5] w-full rounded-lg bg-muted"
        viewBox="0 0 520 180"
        role="img"
        aria-label="BTCUSDT mark price snapshot"
      >
        <defs>
          <linearGradient id="marketLineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0ECB81" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0ECB81" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="20" x2="500" y1="42" y2="42" stroke="#2B3139" strokeWidth="1" />
        <line x1="20" x2="500" y1="80" y2="80" stroke="#2B3139" strokeWidth="1" />
        <line x1="20" x2="500" y1="118" y2="118" stroke="#2B3139" strokeWidth="1" />
        <path d={`${points} L 500 156 L 20 156 Z`} fill="url(#marketLineFill)" />
        <path d={points} fill="none" stroke="#0ECB81" strokeLinecap="round" strokeWidth="3" />
        <line x1="20" x2="500" y1="156" y2="156" stroke="#2B3139" strokeWidth="1" />
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <strong>{market.instrument} {market.contract_type}</strong>
        <span>snapshot only / {formatFreshnessLabel(market.freshness)} / {formatAuthorityLabel(market.authority_status)}</span>
      </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-sm">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

interface OperatorDecisionInput {
  accountPositionRiskSurface?: AccountPositionRiskMirrorSurfaceReadModel | null;
  candidate: CandidateInspectReadModel;
  ledger?: LedgerReadModel;
  latestReplayRun?: ReplayRunEvidenceReadModel;
  orderFillSurface?: OrderFillSurfaceReadModel | null;
  replayRunDetail?: ReplayRunDetailReadModel;
}

function buildOperatorDecision({
  accountPositionRiskSurface,
  candidate,
  ledger,
  latestReplayRun,
  orderFillSurface,
  replayRunDetail
}: OperatorDecisionInput): OperatorMetric {
  if (accountPositionRiskSurface?.risk_status === "breach") {
    return {
      label: "Recommended action",
      value: "Stop and inspect",
      detail: "Risk status is breach; stop the Trading Run before considering another cycle.",
      tone: "danger"
    };
  }

  if (candidate.runtime.runtime_lifecycle_status === "running" && accountPositionRiskSurface?.risk_status === "watch") {
    return {
      label: "Recommended action",
      value: "Observe risk",
      detail: "The Trading Run is active and risk is on watch; inspect position and Ledger before another cycle.",
      tone: "warning"
    };
  }

  if (candidate.improvement?.latest_change_proposal) {
    return {
      label: "Recommended action",
      value: "Run next cycle",
      detail: `Improvement produced ${candidate.improvement.latest_change_proposal.proposal_id}; review the handoff and start the next paper cycle.`,
      tone: "good"
    };
  }

  if (ledger?.chain_complete || orderFillSurface) {
    return {
      label: "Recommended action",
      value: "Evaluate then improve",
      detail: "A request/result chain exists; use the outcome to judge whether the next System Code is better.",
      tone: "good"
    };
  }

  if (latestReplayRun || replayRunDetail) {
    return {
      label: "Recommended action",
      value: "Create improvement",
      detail: "Evaluation evidence exists; produce an Improvement output before starting another run.",
      tone: "warning"
    };
  }

  return {
    label: "Recommended action",
    value: "Run first cycle",
    detail: "No complete request/result chain is visible yet; run the fixture paper cycle to create decision evidence.",
    tone: "warning"
  };
}

function buildOperatorProfitSummary(
  candidate: CandidateInspectReadModel,
  replayRunDetail?: ReplayRunDetailReadModel,
  latestReplayRun?: ReplayRunEvidenceReadModel,
  lastFullCycle?: FullCycleOutcome
): OperatorMetric[] {
  const profitMetric = findProfitMetric(replayRunDetail);
  const improvementScore = candidate.improvement?.latest_evaluation_result?.total_score;
  const cycleScore = lastFullCycle?.backtest.score;
  const evaluationScore = replayRunDetail?.score ?? improvementScore ?? cycleScore;
  const cycleScenarioTotal = lastFullCycle?.backtest.scenario_results?.length ?? 0;
  const cycleScenarioAccepted = lastFullCycle?.backtest.scenario_results
    ?.filter((result) => result.status === "accepted").length ?? 0;
  const acceptedScenarios = lastFullCycle
    ? `${cycleScenarioAccepted}/${cycleScenarioTotal} scenarios accepted`
    : latestReplayRun
    ? `${latestReplayRun.scenario_accepted}/${latestReplayRun.scenario_total} scenarios accepted`
    : "No replay evidence yet";
  const riskDecision = replayRunDetail?.risk_decision ?? lastFullCycle?.backtest.risk_decision ?? latestReplayRun?.status ?? "not reviewed";
  const ledger = candidate.ledger;
  const profitSignalDetail = replayRunDetail
    ? `${acceptedScenarios}; ${riskDecision}`
    : lastFullCycle
      ? `${acceptedScenarios}; ${riskDecision}; ${lastFullCycle.backtest.summary}`
      : improvementScore === undefined
      ? "Run full cycle to create the first paper evidence."
      : `Improvement evaluation score; ${acceptedScenarios.toLowerCase()}.`;

  return [
    {
      label: "Profit signal",
      value: evaluationScore === undefined ? "not measured" : `score ${formatScore(evaluationScore)}`,
      detail: profitSignalDetail,
      tone: evaluationScore === undefined
        ? "neutral"
        : evaluationScore >= 0.7 && isPositiveRiskDecision(riskDecision)
          ? "good"
          : "warning"
    },
    {
      label: "Paper P&L",
      value: profitMetric ? `score ${formatScore(profitMetric.score)}` : "not measured",
      detail: profitMetric?.detail ?? "P&L metric is the next required evidence before live decisions.",
      tone: profitMetric ? "good" : "warning"
    },
    {
      label: "Risk",
      value: riskDecision,
      detail: replayRunDetail
        ? `${replayRunDetail.scenario_ids.length} scenario detail${replayRunDetail.scenario_ids.length === 1 ? "" : "s"} loaded`
        : acceptedScenarios,
      tone: isPositiveRiskDecision(riskDecision) ? "good" : riskDecision === "not reviewed" ? "neutral" : "warning"
    },
    {
      label: "Order result",
      value: ledger?.chain_complete ? "recorded" : "missing",
      detail: ledger?.latest_execution_result?.status ?? "Order request, gateway result, and execution result are not complete yet.",
      tone: ledger?.chain_complete ? "good" : "neutral"
    }
  ];
}

function findProfitMetric(detail?: ReplayRunDetailReadModel): ReplayRunMetricReadModel | undefined {
  return detail?.scenarios
    .flatMap((scenario) => scenario.metrics)
    .find((metric) => /pnl|profit|return/i.test(metric.name));
}

function formatScore(score: number): string {
  return score.toFixed(2);
}

function formatUsdt(value: number): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2
  })} USDT`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 4
  })}%`;
}

function marketChartPoints(market: PublicMarketLivenessSurfaceReadModel): string {
  const values = [
    parseNumber(market.index_price),
    parseNumber(market.estimated_settle_price ?? market.index_price),
    parseNumber(market.mark_price),
    parseNumber(market.mark_price) * 1.00025,
    parseNumber(market.index_price) * 0.99985,
    parseNumber(market.mark_price)
  ].filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return "M 20 90 L 500 90";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = 20 + (index * (480 / Math.max(values.length - 1, 1)));
      const y = 28 + ((max - value) / range) * 116;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function parseNumber(value: string): number {
  return Number.parseFloat(value);
}

function formatBalance(value?: string): string {
  return formatDecimal(value, 2, "not connected");
}

function formatPrice(value?: string): string {
  return formatDecimal(value, 2, "not connected");
}

function formatSignedBalance(value: string): string {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  const formatted = formatDecimal(value, 2, value);
  return numeric > 0 ? `+${formatted}` : formatted;
}

function formatDecimal(value: string | undefined, maximumFractionDigits: number, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: Math.min(2, maximumFractionDigits)
  });
}

function formatCompactDateTime(value?: string): string {
  if (!value) {
    return "not connected";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(date);
}

function formatAuthorityLabel(value?: string): string {
  if (!value || value === "not_live") {
    return "paper only";
  }
  return value.replaceAll("_", " ");
}

function formatRuntimeEnvironment(value: string): string {
  if (value === "paper") {
    return "Paper Gateway";
  }
  if (value === "live") {
    return "Live disabled";
  }
  return `${value.replaceAll("_", " ")} Gateway`;
}

function formatGatewayEnvironment(value: string): string {
  if (value === "testnet") {
    return "Test injection";
  }
  if (value === "mainnet") {
    return "Production public";
  }
  if (value === "unbound") {
    return "Gateway locked";
  }
  return `${value.replaceAll("_", " ")} gateway`;
}

function formatFreshnessLabel(value: string): string {
  if (value === "fresh") {
    return "market fresh";
  }
  if (value === "stale") {
    return "market stale";
  }
  return value.replaceAll("_", " ");
}

function formatResearchAgentLabel(value: TradingResearchAgentSelection): string {
  return value === "codex" ? "Codex" : "Fixture";
}

function defaultTradingResearchRuntime(): TradingResearchRuntimeReadModel {
  return {
    default_agent: "codex",
    available_agents: ["codex", "fixture"],
    iterations: 1,
    agents: [
      {
        agent: "codex",
        provider: "codex",
        readiness_status: "active_verified",
        permission_policy: "artifact_workspace_only",
        command: "codex",
        timeout_ms: 120_000,
        reasoning_effort: "low"
      },
      {
        agent: "fixture",
        provider: "fixture",
        readiness_status: "active_verified",
        permission_policy: "fixture_only",
        model: "scripted-fixture"
      }
    ]
  };
}

function signedTone(value: string): OperatorTone {
  const numeric = parseNumber(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "neutral";
  }
  return numeric > 0 ? "good" : "danger";
}

function riskTone(value: string): OperatorTone {
  if (value === "breach") {
    return "danger";
  }
  if (value === "watch") {
    return "warning";
  }
  return "good";
}

function toneCardClass(tone: OperatorTone): string {
  if (tone === "danger") {
    return "border-destructive/40 bg-destructive/5";
  }
  if (tone === "warning") {
    return "border-muted-foreground/30 bg-muted/40";
  }
  if (tone === "good") {
    return "border-primary/20 bg-card";
  }
  return "bg-card";
}

const POSITIVE_RISK_DECISIONS = new Set([
  "accepted",
  "chain_complete",
  "complete",
  "pass",
  "passed",
  "passes",
  "passes_replay_checks",
  "ready",
  "valid",
  "valid_order_request"
]);

const NEGATIVE_STATUS_TOKENS = new Set([
  "blocked",
  "breach",
  "disabled",
  "failed",
  "incomplete",
  "invalid",
  "missing",
  "no",
  "not",
  "rejected"
]);

export function isPositiveRiskDecision(value: string): boolean {
  const normalized = normalizeStatusValue(value);
  if (POSITIVE_RISK_DECISIONS.has(normalized)) {
    return true;
  }
  const tokens = statusTokens(normalized);
  if (tokens.some((token) => NEGATIVE_STATUS_TOKENS.has(token))) {
    return false;
  }
  return tokens.some((token) => POSITIVE_RISK_DECISIONS.has(token));
}

function calculateFillPercent(filled: string, requested?: string): number {
  const filledValue = parseNumber(filled);
  const requestedValue = requested ? parseNumber(requested) : 0;
  if (!Number.isFinite(filledValue) || !Number.isFinite(requestedValue) || requestedValue <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (filledValue / requestedValue) * 100));
}

interface TradingSystemRow {
  id: string;
  name: string;
  status: string;
  evaluation: string;
  active: boolean;
}

function buildTradingSystemRows(
  selected: CandidateInspectReadModel,
  candidates: CandidateSummaryReadModel[]
): TradingSystemRow[] {
  const rows = candidates.map((candidate) => ({
    id: candidate.candidate_id,
    name: candidate.display_name,
    status: candidate.status,
    evaluation: latestValidationStateLabel(candidate.latest_validation_state),
    active: candidate.candidate_id === selected.candidate_id
  }));
  if (!rows.some((row) => row.id === selected.candidate_id)) {
    rows.unshift({
      id: selected.candidate_id,
      name: selected.display_name,
      status: selected.status,
      evaluation: latestValidationStateLabel(selected.latest_validation_state),
      active: true
    });
  }
  return rows;
}

function SandboxSection({ sandbox }: { sandbox?: SandboxDetailReadModel }) {
  if (!sandbox) {
    return (
      <InfoSection title="Sandbox" summary="not linked / not_live" badge="not linked">
        <div className="evaluation-status neutral">
          <span>Lifecycle</span>
          <strong>not linked</strong>
          <span>not_live</span>
        </div>
      </InfoSection>
    );
  }

  const latestLog = sandbox.logs.at(-1);
  const latestHeartbeat = sandbox.heartbeats.at(-1);
  return (
    <InfoSection
      title="Sandbox"
      summary={`${sandbox.lifecycle_status} / ${sandbox.adapter_kind}`}
      badge={sandbox.lifecycle_status}
    >
      <div className={`evaluation-status ${sandbox.lifecycle_status === "running" ? "counted" : "neutral"}`}>
        <span>Lifecycle</span>
        <strong>{sandbox.lifecycle_status}</strong>
        <span>{sandbox.authority_status}</span>
      </div>
      <Field label="Ref" value={sandbox.sandbox_id} />
      <Field label="Adapter" value={sandbox.adapter_kind} />
      <Field label="Name" value={sandbox.sandbox_name} />
      <Field label="Runtime" value={sandbox.runtime_ref ? formatRef(sandbox.runtime_ref) : "none"} />
      <Field label="System Code" value={formatRef(sandbox.system_code_ref)} />
      <Field label="Placement" value={formatRef(sandbox.sandbox_placement_ref)} />
      <Field label="Last heartbeat" value={sandbox.last_heartbeat_at ?? "none"} />
      <Field label="Logs" value={latestLog?.lines.join(" / ") ?? "none"} />
      <Field label="Heartbeats" value={latestHeartbeat?.heartbeat_line ?? "none"} />
      <Field label="Command evidence" value={String(sandbox.command_evidence.length)} />
      <Field label="Authority" value={sandbox.authority_status} />
    </InfoSection>
  );
}

function TradingRunTranscriptSection({
  transcript
}: {
  transcript?: TradingRunTranscriptReadModel;
}) {
  const statusLabel = transcript?.has_activity
    ? `${transcript.item_count} items`
    : "none";

  return (
    <InfoSection
      title="Trading Run Transcript"
      summary={`${statusLabel} / ${transcript?.authority_status ?? "not_live"}`}
      badge={transcript?.has_activity ? "activity" : "none"}
    >
      <div className={`evaluation-status ${transcript?.has_activity ? "counted" : "neutral"}`}>
        <span>Readback</span>
        <strong>{statusLabel}</strong>
        <span>{transcript?.authority_status ?? "not_live"}</span>
      </div>
      <Field label="Items" value={String(transcript?.item_count ?? 0)} />
      <Field label="Latest" value={transcript?.latest_item?.label ?? "none"} />
      <Field label="Authority" value={transcript?.authority_status ?? "not_live"} />

      {transcript?.items.length ? (
        transcript.items.map((item) => (
          <div className="evaluation-block" key={item.item_id}>
            <h4>{item.label}</h4>
            <Field label="When" value={item.occurred_at} />
            <Field label="Kind" value={item.item_kind} />
            <Field label="Summary" value={item.summary} />
            {item.ref && <Field label="Ref" value={formatRef(item.ref)} />}
            {item.lifecycle_status && <Field label="Lifecycle" value={item.lifecycle_status} />}
            <Field label="Authority" value={item.authority_status} />
          </div>
        ))
      ) : (
        <div className="evaluation-block">
          <h4>Transcript</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_live" />
        </div>
      )}
    </InfoSection>
  );
}

export function TradingExecutionModesSection({
  modes
}: {
  modes: TradingSystemExecutionModeContractReadModel[];
}) {
  if (modes.length === 0) {
    return null;
  }

  return (
    <Card className="execution-mode-panel" aria-label="Trading execution modes">
      <details className="info-details">
        <summary className="info-summary">
          <div>
            <CardTitle>Backtest / paper / live contract</CardTitle>
            <p>Execution modes: {modes.map((mode) => mode.mode).join(", ")}</p>
          </div>
          <Badge variant="secondary">{String(modes.length)}</Badge>
        </summary>
        <CardContent className="execution-mode-grid">
          {modes.map((mode) => (
            <div className="execution-mode-card" key={mode.mode}>
              <div className="execution-mode-card-header">
                <strong>{mode.label}</strong>
                <span>{mode.support_status}</span>
              </div>
              <Field label="Mode" value={mode.mode} />
              <Field label="Provider boundary" value={mode.artifact_contract.api_provider_boundary} />
              <Field label="Market data" value={mode.provider_contract.market_data} />
              <Field label="Account" value={mode.provider_contract.account} />
              <Field label="Order plane" value={mode.provider_contract.order_plane} />
              <Field label="Authority" value={mode.authority.status} />
              <Field label="Artifact credentials" value={mode.artifact_contract.credentials_access} />
              <Field label="Artifact order submission" value={mode.artifact_contract.order_submission} />
            </div>
          ))}
        </CardContent>
      </details>
    </Card>
  );
}

function ReplayRunsSection({
  runs,
  selectedRunId,
  detail,
  comparison,
  comparisonBaselineId,
  validationState,
  onSelectRun,
  onRunCandidateReplay,
  runningCandidateReplay,
  replayRunError,
  replayRunMessage
}: {
  runs: ReplayRunEvidenceReadModel[];
  selectedRunId?: string;
  detail?: ReplayRunDetailReadModel;
  comparison?: ReplayRunComparisonReadModel;
  comparisonBaselineId?: string;
  validationState?: ReplayRunValidationStateReadModel;
  onSelectRun?: (runId: string) => void;
  onRunCandidateReplay?: () => void;
  runningCandidateReplay: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
}) {
  const latestRun = runs[0];
  const activeRunId = selectedRunId ?? detail?.run_id ?? latestRun?.run_id;
  return (
    <InfoSection
      title="Candidate Runs"
      summary={latestRun ? `${latestRun.status} / ${latestRun.scenario_accepted}/${latestRun.scenario_total} accepted` : "no replay runs"}
      badge={latestRun?.status ?? "none"}
    >
      <div className="evaluation-status neutral">
        <span>Candidate-id replay evidence</span>
        <strong>{latestRun ? latestRun.status : "none"}</strong>
        <span>{latestRun?.authority_status ?? "not_live"}</span>
      </div>

      {latestRun ? (
        <>
          <Field label="Latest run" value={latestRun.run_id} />
          <Field label="Selected run" value={activeRunId ?? "none"} />
          <Field label="Runner" value={latestRun.runner_kind} />
          <Field label="Run status" value={latestRun.run_status} />
          <Field label="Scenarios" value={`${latestRun.scenario_accepted}/${latestRun.scenario_total} accepted`} />
          <Field label="Provider requests" value={String(latestRun.provider_request_total)} />
          <Field label="Runner commands" value={String(latestRun.runner_command_total)} />
          <Field label="Artifact digest" value={latestRun.artifact_digest} />
          <Field label="Completed" value={latestRun.completed_at} />
          <Field label="Authority" value={latestRun.authority_status} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No candidate-id replay runs</strong>
          <span>run evidence has not been recorded for this candidate</span>
          <span>not_live</span>
        </div>
      )}

      {runs.length > 0 && (
        <div className="evaluation-block">
          <h4>Run history</h4>
          <div className="run-history-list">
            {runs.map((run) => (
              <Button
                aria-pressed={activeRunId === run.run_id}
                className={`run-history-row ${activeRunId === run.run_id ? "active" : ""}`}
                key={run.run_id}
                type="button"
                onClick={() => onSelectRun?.(run.run_id)}
                variant="ghost"
              >
                <span>{run.run_id}</span>
                <small>
                  {run.status} / {run.runner_kind} / {run.authority_status}
                </small>
                <small>
                  {run.scenario_accepted}/{run.scenario_total} accepted · {run.completed_at}
                </small>
              </Button>
            ))}
          </div>
        </div>
      )}

      <ReplayRunComparisonBlock
        comparison={comparison}
        selectedRunId={activeRunId}
        baselineRunId={comparisonBaselineId}
      />

      {validationState && <ReplayRunValidationStateBlock validationState={validationState} />}

      {detail && <ReplayRunDetailBlock detail={detail} />}

      {onRunCandidateReplay && (
        <div className="runtime-command">
          <Button
            className="runtime-command-button"
            type="button"
            onClick={onRunCandidateReplay}
            disabled={runningCandidateReplay}
          >
            {runningCandidateReplay ? "Running replay" : "Run replay"}
          </Button>
          <span>host_process / replay_only / not_live</span>
        </div>
      )}
      {replayRunMessage && <div className="inline-status">{replayRunMessage}</div>}
      {replayRunError && <div className="inline-status error">{replayRunError}</div>}
    </InfoSection>
  );
}

function ReplayRunComparisonBlock({
  comparison,
  selectedRunId,
  baselineRunId
}: {
  comparison?: ReplayRunComparisonReadModel;
  selectedRunId?: string;
  baselineRunId?: string;
}) {
  if (!selectedRunId) {
    return null;
  }
  if (!comparison) {
    return (
      <div className="evaluation-block">
        <h4>Run comparison</h4>
        <div className="placeholder">
          <strong>No comparison baseline</strong>
          <span>{baselineRunId ?? "single replay-run history"}</span>
          <span>comparison_not_authority</span>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-block">
      <h4>Run comparison</h4>
      <div className={`evaluation-status ${comparison.verdict === "regressed" ? "failed" : "counted"}`}>
        <span>Selected vs baseline replay evidence</span>
        <strong>{comparison.verdict}</strong>
        <span>{comparison.validation_label}</span>
      </div>
      <Field label="Selected run" value={comparison.selected.run_id} />
      <Field label="Baseline run" value={comparison.baseline.run_id} />
      <Field label="Score delta" value={formatSignedNumber(comparison.deltas.score)} />
      <Field label="Accepted scenario delta" value={formatSignedNumber(comparison.deltas.scenario_accepted)} />
      <Field label="Provider request delta" value={formatSignedNumber(comparison.deltas.provider_request_total)} />
      <Field label="Runner command delta" value={formatSignedNumber(comparison.deltas.runner_command_total)} />
      <Field label="Risk transition" value={comparison.risk_transition} />
      <Field label="Reason" value={comparison.verdict_reason} />
      <Field label="Authority" value={comparison.authority_status} />
      <Field label="No authority" value={formatNoAuthority(comparison.no_authority)} />
    </div>
  );
}

function ReplayRunValidationStateBlock({
  validationState
}: {
  validationState: ReplayRunValidationStateReadModel;
}) {
  return (
    <div className="evaluation-block">
      <h4>Validation state</h4>
      <ValidationStateStatus validationState={validationState} />
      <Field label="Selected run" value={validationState.selected_run_id} />
      <Field label="Baseline run" value={validationState.baseline_run_id ?? "none"} />
      <Field label="Comparison verdict" value={validationState.comparison_verdict ?? "none"} />
      <Field label="Reasons" value={validationState.reasons.join("; ")} />
      <Field label="Required next evidence" value={validationState.required_next_evidence.join("; ")} />
      <Field label="Authority" value={validationState.authority_status} />
      <Field label="No authority" value={formatNoAuthority(validationState.no_authority)} />
    </div>
  );
}

function CandidateLatestValidationStateBlock({
  validationState
}: {
  validationState: CandidateLatestValidationStateReadModel;
}) {
  return (
    <div className="evaluation-block">
      <h4>Candidate latest validation state</h4>
      <ValidationStateStatus validationState={validationState} />
      <Field label="Selected run" value={validationState.selected_run_id ?? "none"} />
      <Field label="Baseline run" value={validationState.baseline_run_id ?? "none"} />
      <Field label="Comparison verdict" value={validationState.comparison_verdict ?? "none"} />
      <Field label="Reasons" value={validationState.reasons.join("; ")} />
      <Field label="Required next evidence" value={validationState.required_next_evidence.join("; ")} />
      <Field label="Authority" value={validationState.authority_status} />
      <Field label="No authority" value={formatNoAuthority(validationState.no_authority)} />
    </div>
  );
}

function ValidationStateStatus({
  validationState,
  compact = false
}: {
  validationState: CandidateLatestValidationStateReadModel | ReplayRunValidationStateReadModel;
  compact?: boolean;
}) {
  return (
    <div className={`evaluation-status ${compact ? "compact" : ""} ${validationStateStatusClass(validationState.validation_state)}`}>
      <span>{compact ? "Latest validation state" : "Read-only validation state"}</span>
      <strong>{validationState.validation_state}</strong>
      <span>{validationState.validation_label}</span>
    </div>
  );
}

function latestValidationStateLabel(validationState: CandidateLatestValidationStateReadModel | undefined): string {
  return validationState?.validation_state ?? "replay_required";
}

function validationStateStatusClass(
  validationState: CandidateLatestValidationStateReadModel["validation_state"]
): string {
  switch (validationState) {
    case "passes_replay_checks":
      return "counted";
    case "validation_blocked":
      return "failed";
    case "human_review_required":
      return "sealed";
    case "comparison_required":
    case "replay_required":
      return "neutral";
  }
}

function ReplayRunDetailBlock({ detail }: { detail: ReplayRunDetailReadModel }) {
  return (
    <div className="evaluation-block">
      <h4>Selected run detail</h4>
      <Field label="Run" value={detail.run_id} />
      <Field label="Score / risk" value={`${detail.score} / ${detail.risk_decision}`} />
      <Field label="Scenario ids" value={detail.scenario_ids.join(", ")} />
      <Field label="No authority" value={formatNoAuthority(detail.no_authority)} />
      <Field label="Promotion" value={detail.provenance.promotion_id ?? "none"} />
      <Field label="Source session" value={detail.provenance.source_session_id ?? "none"} />
      <Field label="Events" value={detail.events_path} />

      {detail.scenarios.map((scenario) => (
        <div className="evaluation-block" key={scenario.scenario_id}>
          <h4>{scenario.scenario_id}</h4>
          <Field label="Status" value={`${scenario.status} / ${scenario.run_status}`} />
          <Field label="Runner" value={scenario.runner_kind} />
          <Field label="Score / risk" value={`${scenario.score} / ${scenario.risk_decision}`} />
          <Field label="Summary" value={scenario.summary} />
          <Field label="Provider requests" value={String(scenario.provider_request_count)} />
          <Field label="Runner commands" value={String(scenario.runner_command_count)} />
          {scenario.metrics.map((metric) => (
            <Field
              key={metric.name}
              label={`Metric ${metric.name}`}
              value={`${metric.score}: ${metric.detail}`}
            />
          ))}
          {scenario.runner_command_evidence.map((evidence, index) => (
            <Field
              key={`${scenario.scenario_id}-command-${index}`}
              label={`Command ${index + 1}`}
              value={`${evidence.command.join(" ")} -> ${evidence.exit_code ?? "signal"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function formatNoAuthority(noAuthority: ReplayRunDetailReadModel["no_authority"]): string {
  return [
    `live_exchange=${String(noAuthority.live_exchange)}`,
    `order_authority=${String(noAuthority.order_authority)}`,
    `credentials=${String(noAuthority.credentials)}`,
    `paper_trading=${String(noAuthority.paper_trading)}`
  ].join(", ");
}

function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

type PrivateReadinessPostureGateKey =
  | "operator_approval_gate"
  | "jurisdiction_risk_gate"
  | "live_binding_gate"
  | "secret_handling_gate"
  | "stop_behavior_gate";

interface PrivateReadinessPostureGateChange {
  label: string;
  fromStatus: PrivateReadinessPolicyGateInput["status"];
  toStatus: PrivateReadinessPolicyGateInput["status"];
  fromReason: string;
  toReason: string;
}

const PRIVATE_READINESS_GATE_STATUS_OPTIONS: Array<PrivateReadinessPolicyGateInput["status"]> = [
  "not_ready",
  "review_required",
  "blocked",
  "ready"
];

const PRIVATE_READINESS_POSTURE_GATE_FIELDS: Array<{
  key: PrivateReadinessPostureGateKey;
  label: string;
}> = [
  { key: "operator_approval_gate", label: "Operator approval" },
  { key: "jurisdiction_risk_gate", label: "Jurisdiction / risk" },
  { key: "live_binding_gate", label: "Live binding" },
  { key: "secret_handling_gate", label: "Secret handling" },
  { key: "stop_behavior_gate", label: "Stop behavior" }
];

function TradingGatewayContractSection({
  contract
}: {
  contract?: TradingGatewayContractReadModel | null;
}) {
  if (!contract) {
    return (
      <InfoSection title="Trading gateway contract" summary="not projected / not_live" badge="none">
        <div className="placeholder">
          <strong>No trading gateway contract</strong>
          <span>BTCUSDT gateway contract has not been projected</span>
          <span>not_live</span>
        </div>
      </InfoSection>
    );
  }

  return (
    <InfoSection
      title="Trading gateway contract"
      summary={`${contract.gateway_name} / ${contract.authority_status}`}
      badge={contract.authority_status}
    >
      <Field label="Gateway" value={contract.gateway_name} />
      <Field
        label="Sandbox exchange access"
        value={`sandbox_direct_exchange_access=${String(contract.sandbox_direct_exchange_access)}`}
      />
      <Field
        label="Gateway required"
        value={contract.gateway_required_for.join(", ")}
      />
      <Field
        label="Tracking chain"
        value={contract.tracking_chain.map(canonicalGatewayTrackingStep).join(" -> ")}
      />
      <Field
        label="Market data"
        value={[
          contract.market_data.security_type,
          contract.market_data.status,
          contract.market_data.authority_status
        ].join(" / ")}
      />
      <Field
        label="Account read"
        value={[
          contract.account_read.security_type,
          contract.account_read.status,
          contract.account_read.endpoint_labels.join(", "),
          `gateway_required=${String(contract.account_read.gateway_required)}, authority=${contract.account_read.authority_status}`
        ].join(" / ")}
      />
      <Field
        label="Order submission"
        value={[
          contract.order_submission.security_type,
          contract.order_submission.status,
          contract.order_submission.endpoint_labels.join(", "),
          `gateway_required=${String(contract.order_submission.gateway_required)}, authority=${contract.order_submission.authority_status}`
        ].join(" / ")}
      />
      <Field
        label="No-authority proof"
        value={[
          `raw_secret_material_present=${String(contract.no_authority.raw_secret_material_present)}`,
          `no_private_read_performed=${String(contract.no_authority.no_private_read_performed)}`,
          `signed_request_authority=${String(contract.no_authority.signed_request_authority)}`,
          `live_exchange_authority=${String(contract.no_authority.live_exchange_authority)}`,
          `authority_status=${contract.authority_status}`
        ].join(", ")}
      />
    </InfoSection>
  );
}

export function TradingGatewayEnvironmentSection({
  environment
}: {
  environment?: TradingGatewayEnvironmentReadModel;
}) {
  if (!environment) {
    return null;
  }

  return (
    <InfoSection
      title="Trading gateway environment"
      summary={`${environment.runtime_environment} / ${environment.configuration_status}`}
      badge={environment.configuration_status}
    >
      <Field
        label="Runtime binding"
        value={`${environment.runtime_environment} / ${environment.runtime_environment_source}`}
      />
      <Field
        label="Exchange binding"
        value={`${formatGatewayEnvironment(environment.exchange_environment)} / ${environment.exchange_environment_source}`}
      />
      <Field
        label="Configuration"
        value={`${environment.configuration_status} / ${environment.configuration_reason}`}
      />
      <Field label="REST base URL" value={environment.rest_base_url ?? "not_configured"} />
      <Field
        label="Paper binding"
        value={[
          environment.runtime_bindings.paper.market_data_source,
          environment.runtime_bindings.paper.rest_base_url,
          environment.runtime_bindings.paper.account_provider,
          environment.runtime_bindings.paper.executor,
          environment.runtime_bindings.paper.ledger,
          environment.runtime_bindings.paper.authority_status
        ].join(" / ")}
      />
      <Field
        label="Live binding"
        value={`${environment.runtime_bindings.live.status} / ${environment.runtime_bindings.live.disabled_reason}`}
      />
      <Field label="Credential scope" value={environment.credential_scope} />
      <Field
        label="Credentials configured"
        value={[
          `api_key=${String(environment.api_key_configured)}`,
          `api_secret=${String(environment.api_secret_configured)}`,
          environment.credential_source
        ].join(", ")}
      />
      <Field
        label="Authority"
        value={[
          `live_exchange=${String(environment.live_exchange_authority)}`,
          `order_submission=${String(environment.order_submission_authority)}`,
          environment.authority_status
        ].join(", ")}
      />
      <Field
        label="Env vars"
        value={Object.values(environment.env_var_names).join(", ")}
      />
      {environment.warnings.length > 0 && (
        <Field label="Warnings" value={environment.warnings.join(", ")} />
      )}
    </InfoSection>
  );
}

function TradingSubstrateSection({
  orderFillSurface,
  publicMarketSurface,
  privateReadinessSurface,
  privateReadinessPosture,
  privateReadinessPostureHistory,
  privateReadinessPolicyDecision,
  privateReadGateDecision,
  accountPositionRiskSurface,
  onRecordPrivateReadinessPosture,
  recordingPrivateReadinessPosture = false,
  privateReadinessPostureError,
  privateReadinessPostureMessage
}: {
  orderFillSurface?: OrderFillSurfaceReadModel | null;
  publicMarketSurface?: PublicMarketLivenessSurfaceReadModel | null;
  privateReadinessSurface?: PrivateReadinessPreflightSurfaceReadModel | null;
  privateReadinessPosture?: PrivateReadinessPostureReadModel | null;
  privateReadinessPostureHistory?: PrivateReadinessPostureReadModel[];
  privateReadinessPolicyDecision?: PrivateReadinessPolicyDecision | null;
  privateReadGateDecision?: PrivateReadGateDecision | null;
  accountPositionRiskSurface?: AccountPositionRiskMirrorSurfaceReadModel | null;
  onRecordPrivateReadinessPosture?: (draft: PrivateReadinessPostureDraft) => void;
  recordingPrivateReadinessPosture?: boolean;
  privateReadinessPostureError?: string;
  privateReadinessPostureMessage?: string;
}) {
  const [postureDraft, setPostureDraft] = useState<PrivateReadinessPostureDraft>(
    () => privateReadinessPostureDraftFromReadModel(privateReadinessPosture)
  );
  useEffect(() => {
    setPostureDraft(privateReadinessPostureDraftFromReadModel(privateReadinessPosture));
  }, [privateReadinessPosture?.posture_id]);
  const previousPosture = privateReadinessPosture
    ? previousPrivateReadinessPosture(privateReadinessPosture, privateReadinessPostureHistory ?? [])
    : undefined;
  const postureGateChanges = privateReadinessPosture && previousPosture
    ? privateReadinessPostureGateChanges(privateReadinessPosture, previousPosture)
    : [];
  const reviewPacketProjection = privateReadinessPolicyDecision
    ? buildPrivateReadinessReviewPacketProjection({
        decision: privateReadinessPolicyDecision,
        posture: privateReadinessPosture,
        previousPosture
      })
    : undefined;
  const remediationActionRows = reviewPacketProjection?.remediationActionRows ?? [];
  const remediationProgressSummary = reviewPacketProjection?.remediationProgressSummary ?? {
    coverage: "required_actions=0, mapped_actions=0, unmapped_actions=0",
    blockingReviewFocus: "blocking_review_focus=0",
    nextReviewFocus: "next_review_focus=no_required_next_actions",
    progressState: "no_remediation_progress_actions"
  };

  function updatePostureDraftGate(
    key: PrivateReadinessPostureGateKey,
    patch: Partial<PrivateReadinessPolicyGateInput>
  ) {
    setPostureDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch
      }
    }));
  }

  return (
    <InfoSection
      title="Trading Substrate"
      summary={`${publicMarketSurface?.symbol_status ?? "public unknown"} / ${privateReadinessSurface?.credential_gate.status ?? "private not ready"}`}
      badge={privateReadinessPolicyDecision?.status ?? "not_ready"}
    >
      {publicMarketSurface ? (
        <>
          <div className={`evaluation-status ${publicMarketStatusTone(publicMarketSurface)}`}>
            <span>Public market posture</span>
            <strong>{publicMarketSurface.symbol_status}</strong>
            <span>{publicMarketSurface.authority_status}</span>
          </div>
          <Field label="Public surface" value={publicMarketSurface.surface_label} />
          <Field label="Venue" value={`${publicMarketSurface.venue} / ${publicMarketSurface.product_category}`} />
          <Field label="Instrument" value={publicMarketSurface.instrument} />
          <Field label="Contract" value={publicMarketSurface.contract_type} />
          <Field label="Symbol status" value={publicMarketSurface.symbol_status} />
          <Field label="Price tick" value={publicMarketSurface.price_tick_size} />
          <Field label="Quantity step / min" value={[
            publicMarketSurface.quantity_step_size,
            publicMarketSurface.min_quantity
          ].join(" / ")} />
          <Field label="Min notional" value={publicMarketSurface.min_notional ?? "none"} />
          <Field label="Mark / index" value={[
            publicMarketSurface.mark_price,
            publicMarketSurface.index_price
          ].join(" / ")} />
          <Field label="Estimated settle" value={publicMarketSurface.estimated_settle_price ?? "none"} />
          <Field label="Funding / interest" value={[
            publicMarketSurface.funding_rate,
            publicMarketSurface.interest_rate ?? "none"
          ].join(" / ")} />
          <Field label="Next funding" value={publicMarketSurface.next_funding_time} />
          <Field label="Server time" value={publicMarketSurface.server_time} />
          <Field label="Public freshness" value={`${publicMarketSurface.freshness} / ${publicMarketSurface.liveness}`} />
          <Field label="Public source" value={formatSubstrateSource(publicMarketSurface)} />
          <Field label="Public connector package" value={publicMarketSurface.transport.package_name} />
          <Field label="Public connector repository" value={publicMarketSurface.transport.repository} />
          <Field
            label="Public connector endpoints"
            value={publicMarketSurface.transport.supported_endpoints.join(", ")}
          />
          <Field label="Public connector role" value={publicMarketSurface.transport.integration_role} />
          <Field label="Public connector URLs" value={[
            publicMarketSurface.transport.production_base_url,
            publicMarketSurface.transport.testnet_base_url
          ].join(" / ")} />
          <Field label="Public source timestamp" value={publicMarketSurface.source_timestamp} />
          <Field label="Public observed" value={publicMarketSurface.observed_at} />
          <Field label="Public updated" value={publicMarketSurface.updated_at} />
          {publicMarketSurface.degraded_reason && (
            <Field label="Public reason" value={publicMarketSurface.degraded_reason} />
          )}
          <Field label="Public no authority" value={publicMarketSurface.no_authority_label} />
          <Field label="Public authority" value={publicMarketSurface.authority_status} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No public market surface</strong>
          <span>BTCUSDT market posture has not been recorded</span>
          <span>not_live</span>
        </div>
      )}
      {privateReadinessSurface ? (
        <>
          <div className={`evaluation-status ${privateReadinessStatusTone(privateReadinessSurface)}`}>
            <span>Private readiness preflight</span>
            <strong>{privateReadinessSurface.credential_gate.status}</strong>
            <span>{privateReadinessSurface.authority_status}</span>
          </div>
          <Field label="Private surface" value={privateReadinessSurface.surface_label} />
          <Field
            label="Private venue"
            value={`${privateReadinessSurface.venue} / ${privateReadinessSurface.product_category}`}
          />
          <Field label="Private instrument" value={privateReadinessSurface.instrument} />
          <Field label="Credential gate" value={formatPrivateReadinessGate(privateReadinessSurface.credential_gate)} />
          <Field
            label="Jurisdiction gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.jurisdiction_gate)}
          />
          <Field
            label="Operator approval gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.operator_approval_gate)}
          />
          <Field
            label="Account read gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.private_account_read_gate)}
          />
          <Field
            label="Position read gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.private_position_read_gate)}
          />
          <Field
            label="User stream gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.user_data_stream_gate)}
          />
          <Field label="Listen key gate" value={formatPrivateReadinessGate(privateReadinessSurface.listen_key_gate)} />
          <Field
            label="Order submission gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.order_submission_gate)}
          />
          <Field
            label="Leverage / margin gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.leverage_or_margin_mutation_gate)}
          />
          <Field
            label="Private endpoints"
            value={[
              privateReadinessSurface.account_information_endpoint,
              privateReadinessSurface.user_data_stream_endpoint,
              privateReadinessSurface.order_endpoint
            ].join(" / ")}
          />
          <Field label="Next blocked action" value={privateReadinessSurface.next_blocked_action} />
          <Field label="Next blocked reason" value={privateReadinessSurface.next_blocked_reason} />
          <Field
            label="Private freshness"
            value={`${privateReadinessSurface.freshness} / ${privateReadinessSurface.liveness}`}
          />
          <Field label="Private source" value={formatSubstrateSource(privateReadinessSurface)} />
          <Field label="Private connector package" value={privateReadinessSurface.transport.package_name} />
          <Field label="Private connector repository" value={privateReadinessSurface.transport.repository} />
          <Field label="Private connector role" value={privateReadinessSurface.transport.integration_role} />
          <Field label="Private source timestamp" value={privateReadinessSurface.source_timestamp} />
          <Field label="Private observed" value={privateReadinessSurface.observed_at} />
          <Field label="Private updated" value={privateReadinessSurface.updated_at} />
          {privateReadinessSurface.degraded_reason && (
            <Field label="Private reason" value={privateReadinessSurface.degraded_reason} />
          )}
          <Field label="Private no authority" value={privateReadinessSurface.no_authority_label} />
          <Field label="Private authority" value={privateReadinessSurface.authority_status} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No private readiness preflight</strong>
          <span>BTCUSDT private-read gates have not been recorded</span>
          <span>not_live</span>
        </div>
      )}
      {privateReadinessPosture ? (
        <>
          <div className={`evaluation-status ${privateReadinessPostureStatusTone(privateReadinessPosture)}`}>
            <span>Private-readiness posture</span>
            <strong>{privateReadinessPosture.live_binding_gate.status}</strong>
            <span>{privateReadinessPosture.authority_status}</span>
          </div>
          <Field label="Local posture" value={privateReadinessPosture.posture_label} />
          <Field
            label="Posture venue"
            value={`${privateReadinessPosture.venue} / ${privateReadinessPosture.product_category}`}
          />
          <Field label="Posture instrument" value={privateReadinessPosture.instrument} />
          <Field
            label="Operator approval gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.operator_approval_gate)}
          />
          <Field
            label="Jurisdiction / risk gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.jurisdiction_risk_gate)}
          />
          <Field
            label="Live binding gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.live_binding_gate)}
          />
          <Field
            label="Secret handling gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.secret_handling_gate)}
          />
          <Field
            label="Stop behavior gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.stop_behavior_gate)}
          />
          <Field
            label="Secret reference"
            value={privateReadinessPosture.secret_reference_configured ? "configured" : "not_configured"}
          />
          <Field
            label="Raw secret material"
            value={String(privateReadinessPosture.raw_secret_material_present)}
          />
          <Field label="Posture source" value={formatSubstrateSource(privateReadinessPosture)} />
          <Field label="Posture source timestamp" value={privateReadinessPosture.source_timestamp} />
          <Field label="Posture observed" value={privateReadinessPosture.observed_at} />
          <Field label="Posture updated" value={privateReadinessPosture.updated_at} />
          <Field label="Posture no authority" value={privateReadinessPosture.no_authority_label} />
          <Field label="Posture authority" value={privateReadinessPosture.authority_status} />
          {privateReadinessPostureHistory && privateReadinessPostureHistory.length > 0 && (
            <div className="posture-history" aria-label="Private-readiness posture history">
              <h4>Recent posture history</h4>
              {privateReadinessPostureHistory.map((posture) => (
                <div className="posture-history-row" key={posture.posture_id}>
                  <strong>{posture.posture_id}</strong>
                  <span>{posture.source_kind} / {posture.updated_at}</span>
                  <span>{formatPrivateReadinessPostureGateSummary(posture)}</span>
                  <span>{posture.no_authority_label} / {posture.authority_status}</span>
                </div>
              ))}
            </div>
          )}
          {previousPosture && (
            <div className="posture-delta" aria-label="Private-readiness posture delta summary">
              <h4>Posture delta summary</h4>
              <Field label="Current posture" value={privateReadinessPosture.posture_id} />
              <Field label="Previous posture" value={previousPosture.posture_id} />
              <Field
                label="Changed gates"
                value={formatPrivateReadinessPostureGateChangeCount(postureGateChanges)}
              />
              <Field
                label="Gate changes"
                value={formatPrivateReadinessPostureGateChanges(postureGateChanges)}
              />
              <Field label="Delta boundary" value="local_config_delta_inspection_only" />
              <Field label="Evidence boundary" value="not_counted_evidence_or_promotion" />
              <Field
                label="Authority boundary"
                value="not_private_read_permission_or_execution_authority"
              />
            </div>
          )}
        </>
      ) : (
        <div className="placeholder">
          <strong>No private-readiness posture</strong>
          <span>BTCUSDT local private-readiness gates have not been recorded</span>
          <span>not_live</span>
        </div>
      )}
      {onRecordPrivateReadinessPosture && (
        <form
          aria-label="Local private-readiness posture edit form"
          className="posture-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onRecordPrivateReadinessPosture(postureDraft);
          }}
        >
          <h4>Local posture edit</h4>
          <div className="posture-edit-grid">
            {PRIVATE_READINESS_POSTURE_GATE_FIELDS.map((field) => (
              <label className="posture-edit-row" key={field.key}>
                <span>{field.label}</span>
                <select
                  value={postureDraft[field.key].status}
                  onChange={(event) =>
                    updatePostureDraftGate(field.key, {
                      status: event.currentTarget.value as PrivateReadinessPolicyGateInput["status"]
                    })}
                >
                  {PRIVATE_READINESS_GATE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input
                  aria-label={`${field.label} reason`}
                  value={postureDraft[field.key].reason}
                  onChange={(event) =>
                    updatePostureDraftGate(field.key, {
                      reason: event.currentTarget.value
                    })}
                />
              </label>
            ))}
          </div>
          <div className="runtime-command">
            <Button
              className="runtime-command-button"
              type="submit"
              disabled={recordingPrivateReadinessPosture}
            >
              {recordingPrivateReadinessPosture ? "Saving posture" : "Save local posture"}
            </Button>
            <span>local_config / no_secret / not_live</span>
          </div>
        </form>
      )}
      {privateReadinessPostureMessage && (
        <div className="inline-status">{privateReadinessPostureMessage}</div>
      )}
      {privateReadinessPostureError && (
        <div className="inline-status error">{privateReadinessPostureError}</div>
      )}
      {privateReadinessPolicyDecision ? (
        <>
          <div className={`evaluation-status ${privateReadinessPolicyStatusTone(privateReadinessPolicyDecision)}`}>
            <span>Private-readiness policy</span>
            <strong>{privateReadinessPolicyDecision.status}</strong>
            <span>{privateReadinessPolicyDecision.authority_status}</span>
          </div>
          <Field label="Policy decision" value={privateReadinessPolicyDecision.decision_kind} />
          <Field label="Policy venue" value={[
            privateReadinessPolicyDecision.venue,
            privateReadinessPolicyDecision.instrument,
            privateReadinessPolicyDecision.product_category
          ].join(" / ")} />
          <Field
            label="Policy Binance security types"
            value={privateReadinessPolicyDecision.binance_security_types.join(", ")}
          />
          <Field label="Policy reason codes" value={privateReadinessPolicyDecision.reason_codes.join(", ")} />
          <Field
            label="Policy blocking conditions"
            value={
              privateReadinessPolicyDecision.blocking_conditions.length > 0
                ? privateReadinessPolicyDecision.blocking_conditions.join(" / ")
                : "none"
            }
          />
          <Field
            label="Policy checked gates"
            value={privateReadinessPolicyDecision.checked_gates
              .map((gate) => `${gate.dimension}=${gate.status}`)
              .join(", ")}
          />
          <Field
            label="Policy source surfaces"
            value={privateReadinessPolicyDecision.source_surface_refs.map(formatRef).join(" / ")}
          />
          <Field label="Policy evaluated" value={privateReadinessPolicyDecision.evaluated_at} />
          <Field
            label="Policy no private read"
            value={[
              `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
              `signed_request_authority=${String(privateReadinessPolicyDecision.signed_request_authority)}`,
              `live_exchange_authority=${String(privateReadinessPolicyDecision.live_exchange_authority)}`,
              `order_submission_authority=${String(privateReadinessPolicyDecision.order_submission_authority)}`
            ].join(", ")}
          />
          {privateReadGateDecision && (
            <div className="authority-preview" aria-label="Private-read gate">
              <h4>Private-read gate</h4>
              <Field label="Gate decision" value={privateReadGateDecision.decision_kind} />
              <Field label="Gate status" value={privateReadGateDecision.status} />
              <Field label="Policy status" value={privateReadGateDecision.policy_status} />
              <Field
                label="Gate scope"
                value={[
                  privateReadGateDecision.venue,
                  privateReadGateDecision.instrument,
                  privateReadGateDecision.product_category
                ].join(" / ")}
              />
              <Field
                label="Credential reference"
                value={privateReadGateDecision.credential_reference_status}
              />
              <Field
                label="Credential reference source"
                value={privateReadGateDecision.credential_reference_source}
              />
              {privateReadGateDecision.credential_reference_ref && (
                <Field
                  label="Credential reference ref"
                  value={formatRef(privateReadGateDecision.credential_reference_ref)}
                />
              )}
              <Field
                label="Signed-read preflight"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_read_permission_preflight_status}`,
                  `source=${privateReadGateDecision.signed_read_permission_preflight_source}`
                ].join(", ")}
              />
              <Field
                label="Signed request construction"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_request_construction_boundary_status}`,
                  `source=${privateReadGateDecision.signed_request_construction_boundary_source}`,
                  `components=${
                    privateReadGateDecision.signed_request_construction_required_components.length > 0
                      ? privateReadGateDecision.signed_request_construction_required_components.join(", ")
                      : "not_requested"
                  }`
                ].join(", ")}
              />
              <Field
                label="Signed-read grant boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_read_permission_grant_boundary_status}`,
                  `source=${privateReadGateDecision.signed_read_permission_grant_boundary_source}`
                ].join(", ")}
              />
              <Field
                label="Signed request execution boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_request_execution_boundary_status}`,
                  `source=${privateReadGateDecision.signed_request_execution_boundary_source}`
                ].join(", ")}
              />
              <Field
                label="Account / balance / position read boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.account_balance_position_read_boundary_status}`,
                  `source=${privateReadGateDecision.account_balance_position_read_boundary_source}`
                ].join(", ")}
              />
              <Field
                label="Signed read permission"
                value={`USER_DATA=${privateReadGateDecision.signed_read_permission}`}
              />
              <Field
                label="Account / balance / position"
                value={privateReadGateDecision.account_balance_position_read_authority}
              />
              <Field
                label="ListenKey / user data stream"
                value={`USER_STREAM=${privateReadGateDecision.listen_key_user_data_stream_authority}`}
              />
              <Field
                label="Leverage / margin mutation"
                value={privateReadGateDecision.leverage_margin_mutation_authority}
              />
              <Field
                label="Order submission"
                value={`TRADE=${privateReadGateDecision.order_submission_authority}`}
              />
              <Field
                label="Gateway / evidence / promotion"
                value={[
                  `gateway=${privateReadGateDecision.gateway_result_authority}`,
                  `evidence=${privateReadGateDecision.evidence_sealing_authority}`,
                  `promotion=${privateReadGateDecision.promotion_authority}`
                ].join(", ")}
              />
              <Field
                label="Gate no-authority proof"
                value={[
                  `raw_secret_material_present=${String(privateReadGateDecision.raw_secret_material_present)}`,
                  `no_private_read_performed=${String(privateReadGateDecision.no_private_read_performed)}`,
                  `signed_request_authority=${String(privateReadGateDecision.signed_request_authority)}`,
                  `live_exchange_authority=${String(privateReadGateDecision.live_exchange_authority)}`,
                  `authority_status=${privateReadGateDecision.authority_status}`
                ].join(", ")}
              />
              <Field
                label="Gate boundary"
                value="private_read_gate_no_secret_not_live"
              />
            </div>
          )}
          {reviewPacketProjection && (
            <PrivateReadinessReviewPacketSections
              postureContextAvailable={Boolean(privateReadinessPosture)}
              projection={reviewPacketProjection}
            />
          )}
          <div className="checked-gate-matrix" aria-label="Private-readiness checked-gate matrix">
            <h4>Private-readiness checked-gate matrix</h4>
            {privateReadinessPolicyDecision.checked_gates.length > 0 ? (
              privateReadinessPolicyDecision.checked_gates.map((gate) => (
                <div className="checked-gate-row" key={gate.dimension}>
                  <strong>{gate.dimension}</strong>
                  <span>{gate.status}</span>
                  <span>{gate.reason_code}</span>
                  <span>{gate.reason}</span>
                  <span>{formatPrivateReadinessCheckedGatePosture(gate.status)}</span>
                </div>
              ))
            ) : (
              <div className="checked-gate-row">
                <strong>no_checked_gates</strong>
                <span>none</span>
                <span>none</span>
                <span>policy_decision_contains_no_checked_gates</span>
                <span>inspection_only</span>
              </div>
            )}
            <Field label="Matrix boundary" value="checked_gate_matrix_inspection_only" />
            <Field label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <Field
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </div>
          <div className="remediation-action-map" aria-label="Private-readiness remediation/action map">
            <h4>Private-readiness remediation/action map</h4>
            {remediationActionRows.length > 0 ? (
              remediationActionRows.map((row) => (
                <div className="remediation-action-row" key={row.action}>
                  <strong>{row.action}</strong>
                  <span>{row.target}</span>
                  <span>{row.posture}</span>
                  <span>{row.detail}</span>
                  <span>{row.guidanceBoundary}</span>
                </div>
              ))
            ) : (
              <div className="remediation-action-row">
                <strong>no_required_next_actions</strong>
                <span>none</span>
                <span>none</span>
                <span>policy_decision_contains_no_required_next_actions</span>
                <span>read_only_remediation_guidance</span>
              </div>
            )}
            <Field label="Map boundary" value="remediation_action_map_guidance_only" />
            <Field label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <Field
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </div>
          <div
            className="remediation-progress-summary"
            aria-label="Private-readiness remediation progress summary"
          >
            <h4>Private-readiness remediation progress summary</h4>
            <Field label="Action coverage" value={remediationProgressSummary.coverage} />
            <Field label="Blocking / review focus" value={remediationProgressSummary.blockingReviewFocus} />
            <Field label="Next review focus" value={remediationProgressSummary.nextReviewFocus} />
            <Field label="Progress state" value={remediationProgressSummary.progressState} />
            <Field label="Summary boundary" value="remediation_progress_summary_guidance_only" />
            <Field label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <Field
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </div>
          {privateReadinessPosture && (
            <>
              <div className="policy-impact" aria-label="Private-readiness policy impact interpretation">
                <h4>Policy impact interpretation</h4>
                <Field label="Policy input posture" value={privateReadinessPosture.posture_id} />
                <Field label="History role" value="inspection_context_only" />
                <Field
                  label="Policy impact"
                  value={formatPrivateReadinessPolicyImpact(privateReadinessPolicyDecision)}
                />
                <Field
                  label="Policy next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <Field
                  label="Evidence boundary"
                  value="local_config_inspection_not_counted_evidence_or_promotion"
                />
                <Field
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `authority_status=${privateReadinessPolicyDecision.authority_status}`
                  ].join(", ")}
                />
                <Field
                  label="Authority boundary"
                  value="not_private_read_permission_or_execution_authority"
                />
              </div>
              <div className="review-handoff" aria-label="Private-readiness review handoff">
                <h4>Private-readiness review handoff</h4>
                <Field
                  label="Review scope"
                  value={[
                    privateReadinessPolicyDecision.venue,
                    privateReadinessPolicyDecision.instrument,
                    privateReadinessPolicyDecision.product_category
                  ].join(" / ")}
                />
                <Field label="Latest posture" value={privateReadinessPosture.posture_id} />
                <Field
                  label="Posture delta"
                  value={formatPrivateReadinessReviewHandoffDelta(previousPosture, postureGateChanges)}
                />
                <Field
                  label="Policy summary"
                  value={formatPrivateReadinessPolicyImpact(privateReadinessPolicyDecision)}
                />
                <Field
                  label="Required next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <Field
                  label="Review checklist"
                  value={formatPrivateReadinessReviewChecklist(privateReadinessPolicyDecision, previousPosture)}
                />
                <Field
                  label="Handoff boundary"
                  value="review_handoff_only_not_counted_evidence_or_promotion"
                />
                <Field
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `authority_status=${privateReadinessPolicyDecision.authority_status}`
                  ].join(", ")}
                />
                <Field
                  label="Authority boundary"
                  value="not_private_read_permission_or_execution_authority"
                />
              </div>
              <div className="authority-preview" aria-label="Private-readiness authority gate preview">
                <h4>Private-readiness authority gate preview</h4>
                <Field
                  label="Preview scope"
                  value={[
                    privateReadinessPolicyDecision.venue,
                    privateReadinessPolicyDecision.instrument,
                    privateReadinessPolicyDecision.product_category
                  ].join(" / ")}
                />
                <Field
                  label="Private-read authority"
                  value={formatPrivateReadinessAuthorityGateState(privateReadinessPolicyDecision)}
                />
                <Field
                  label="Gate readiness"
                  value={formatPrivateReadinessAuthorityGateReadiness(privateReadinessPolicyDecision)}
                />
                <Field
                  label={
                    privateReadinessPolicyDecision.blocking_conditions.length > 0
                      ? "Blocking conditions"
                      : "No blocking conditions"
                  }
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.blocking_conditions)}
                />
                <Field
                  label="Required next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <Field
                  label="Preview next step"
                  value={formatPrivateReadinessAuthorityGateNextStep(privateReadinessPolicyDecision)}
                />
                <Field
                  label="Preview boundary"
                  value="authority_gate_preview_only_not_private_read_permission_or_execution_authority"
                />
                <Field label="Preview evidence boundary" value="not_counted_evidence_or_promotion" />
                <Field
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `signed_request_authority=${String(privateReadinessPolicyDecision.signed_request_authority)}`,
                    `live_exchange_authority=${String(privateReadinessPolicyDecision.live_exchange_authority)}`,
                    `order_submission_authority=${String(privateReadinessPolicyDecision.order_submission_authority)}`
                  ].join(", ")}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="placeholder">
          <strong>No private-readiness policy</strong>
          <span>BTCUSDT private-readiness decision has not been projected</span>
          <span>not_live</span>
        </div>
      )}
      {accountPositionRiskSurface ? (
        <>
          <div className={`evaluation-status ${accountPositionRiskStatusTone(accountPositionRiskSurface)}`}>
            <span>Account position risk mirror</span>
            <strong>{accountPositionRiskSurface.risk_status}</strong>
            <span>{accountPositionRiskSurface.authority_status}</span>
          </div>
          <Field label="Account risk surface" value={accountPositionRiskSurface.surface_label} />
          <Field
            label="Account risk venue"
            value={`${accountPositionRiskSurface.venue} / ${accountPositionRiskSurface.product_category}`}
          />
          <Field label="Account risk instrument" value={accountPositionRiskSurface.instrument} />
          <Field label="Account scope" value={accountPositionRiskSurface.account_scope_ref} />
          <Field label="Asset / mode" value={[
            accountPositionRiskSurface.asset,
            accountPositionRiskSurface.account_mode
          ].join(" / ")} />
          <Field label="Wallet / margin balance" value={[
            accountPositionRiskSurface.total_wallet_balance,
            accountPositionRiskSurface.total_margin_balance
          ].join(" / ")} />
          <Field label="Available / max withdraw" value={[
            accountPositionRiskSurface.available_balance,
            accountPositionRiskSurface.max_withdraw_amount
          ].join(" / ")} />
          <Field label="Initial / maintenance margin" value={[
            accountPositionRiskSurface.total_initial_margin,
            accountPositionRiskSurface.total_maint_margin
          ].join(" / ")} />
          <Field label="Position / open-order margin" value={[
            accountPositionRiskSurface.total_position_initial_margin,
            accountPositionRiskSurface.total_open_order_initial_margin
          ].join(" / ")} />
          <Field label="Cross wallet / PnL" value={[
            accountPositionRiskSurface.total_cross_wallet_balance,
            accountPositionRiskSurface.total_cross_un_pnl
          ].join(" / ")} />
          <Field label="Position side / amount" value={[
            accountPositionRiskSurface.position_side,
            accountPositionRiskSurface.position_amount
          ].join(" / ")} />
          <Field label="Entry / breakeven" value={[
            accountPositionRiskSurface.entry_price,
            accountPositionRiskSurface.break_even_price
          ].join(" / ")} />
          <Field label="Mark / liquidation" value={[
            accountPositionRiskSurface.mark_price,
            accountPositionRiskSurface.liquidation_price
          ].join(" / ")} />
          <Field label="Notional / unrealized PnL" value={[
            accountPositionRiskSurface.notional,
            accountPositionRiskSurface.unrealized_profit
          ].join(" / ")} />
          <Field label="Margin asset / type" value={[
            accountPositionRiskSurface.margin_asset,
            accountPositionRiskSurface.margin_type
          ].join(" / ")} />
          <Field label="Leverage / ADL" value={[
            String(accountPositionRiskSurface.leverage),
            accountPositionRiskSurface.adl_quantile === undefined
              ? "none"
              : String(accountPositionRiskSurface.adl_quantile)
          ].join(" / ")} />
          <Field label="Risk status" value={accountPositionRiskSurface.risk_status} />
          <Field label="Risk profile" value={accountPositionRiskSurface.risk_limit_profile_ref} />
          <Field label="Max notional" value={accountPositionRiskSurface.max_notional_value} />
          <Field label="Kill switch / pause" value={[
            accountPositionRiskSurface.kill_switch_status,
            accountPositionRiskSurface.runtime_pause_status
          ].join(" / ")} />
          <Field
            label="Account risk endpoints"
            value={[
              accountPositionRiskSurface.account_information_endpoint,
              accountPositionRiskSurface.position_information_endpoint,
              accountPositionRiskSurface.leverage_endpoint,
              accountPositionRiskSurface.margin_type_endpoint
            ].join(" / ")}
          />
          <Field label="Account risk next action" value={accountPositionRiskSurface.next_blocked_action} />
          <Field label="Account risk blocked reason" value={accountPositionRiskSurface.next_blocked_reason} />
          <Field
            label="Account risk freshness"
            value={`${accountPositionRiskSurface.freshness} / ${accountPositionRiskSurface.liveness}`}
          />
          <Field label="Account risk source" value={formatSubstrateSource(accountPositionRiskSurface)} />
          <Field label="Account risk connector package" value={accountPositionRiskSurface.transport.package_name} />
          <Field label="Account risk connector repository" value={accountPositionRiskSurface.transport.repository} />
          <Field label="Account risk connector role" value={accountPositionRiskSurface.transport.integration_role} />
          <Field label="Account risk source timestamp" value={accountPositionRiskSurface.source_timestamp} />
          <Field label="Account risk observed" value={accountPositionRiskSurface.observed_at} />
          <Field label="Account risk updated" value={accountPositionRiskSurface.updated_at} />
          {accountPositionRiskSurface.degraded_reason && (
            <Field label="Account risk reason" value={accountPositionRiskSurface.degraded_reason} />
          )}
          <Field label="Account risk no authority" value={accountPositionRiskSurface.no_authority_label} />
          <Field label="Account risk authority" value={accountPositionRiskSurface.authority_status} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No account position risk mirror</strong>
          <span>BTCUSDT account, position, and risk posture has not been recorded</span>
          <span>not_live</span>
        </div>
      )}
      {orderFillSurface ? (
        <>
          <div className={`evaluation-status ${orderFillStatusTone(orderFillSurface)}`}>
            <span>Order-fill posture</span>
            <strong>{orderFillSurface.posture}</strong>
            <span>{orderFillSurface.authority_status}</span>
          </div>
          <Field label="Order-fill surface" value={orderFillSurface.surface_label} />
          <Field label="Order venue" value={`${orderFillSurface.venue} / ${orderFillSurface.product_category}`} />
          <Field label="Order instrument" value={orderFillSurface.instrument} />
          <Field label="Raw upstream" value={[
            orderFillSurface.raw_upstream_status,
            orderFillSurface.raw_upstream_execution_type ?? "none"
          ].join(" / ")} />
          <Field label="Order scope" value={orderFillSurface.order_scope_ref} />
          <Field label="Client order" value={orderFillSurface.local_client_order_id ?? "none"} />
          <Field label="Upstream order" value={orderFillSurface.upstream_order_id ?? "none"} />
          <Field label="Side / type" value={[
            orderFillSurface.side ?? "none",
            orderFillSurface.order_type ?? "none",
            orderFillSurface.time_in_force ?? "none"
          ].join(" / ")} />
          <Field label="Requested" value={orderFillSurface.requested_quantity ?? "none"} />
          <Field label="Filled / remaining" value={[
            orderFillSurface.cumulative_filled_quantity,
            orderFillSurface.remaining_quantity
          ].join(" / ")} />
          <Field label="Average / last price" value={[
            orderFillSurface.average_fill_price ?? "none",
            orderFillSurface.last_fill_price ?? "none"
          ].join(" / ")} />
          <Field label="Order freshness" value={`${orderFillSurface.freshness} / ${orderFillSurface.liveness}`} />
          <Field label="Order source" value={formatSubstrateSource(orderFillSurface)} />
          <Field label="Order connector package" value={orderFillSurface.transport.package_name} />
          <Field label="Order connector repository" value={orderFillSurface.transport.repository} />
          <Field label="Order connector endpoints" value={orderFillSurface.transport.supported_endpoints.join(", ")} />
          <Field label="Order connector role" value={orderFillSurface.transport.integration_role} />
          <Field label="Connector URLs" value={[
            orderFillSurface.transport.production_base_url,
            orderFillSurface.transport.testnet_base_url
          ].join(" / ")} />
          <Field label="Order source timestamp" value={orderFillSurface.source_timestamp} />
          <Field label="Order observed" value={orderFillSurface.observed_at} />
          <Field label="Order updated" value={orderFillSurface.updated_at} />
          {orderFillSurface.degraded_reason && <Field label="Order reason" value={orderFillSurface.degraded_reason} />}
          <Field label="Order no authority" value={orderFillSurface.no_authority_label} />
          <Field label="Order authority" value={orderFillSurface.authority_status} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No order-fill surface</strong>
          <span>BTCUSDT posture has not been recorded</span>
          <span>not_live</span>
        </div>
      )}
    </InfoSection>
  );
}

export function PrivateReadinessReviewPacketSections({
  projection,
  postureContextAvailable
}: {
  projection: PrivateReadinessReviewPacketProjection;
  postureContextAvailable: boolean;
}) {
  return (
    <>
      <ReviewPacketPanel
        className="review-packet-completion-readiness-summary"
        label="Private-readiness review packet completion/readiness summary"
      >
        <Field
          label="Completion/readiness summary"
          value={projection.completionReadinessSummary.countSummary}
        />
        <Field
          label="Next review focus"
          value={projection.completionReadinessSummary.nextReviewFocus}
        />
        <Field
          label="Next completion focus"
          value={projection.completionReadinessSummary.nextCompletionFocus}
        />
        <Field
          label="Readiness state"
          value={projection.completionReadinessSummary.readinessState}
        />
        <Field
          label="Completion/readiness context"
          value={projection.completionReadinessSummary.boundary}
        />
        <ReviewPacketBoundaryFields
          label="Completion/readiness boundary"
          value="review_packet_completion_readiness_navigation_only"
        />
      </ReviewPacketPanel>

      <ReviewPacketPanel
        className="review-packet-index"
        label="Private-readiness review packet index"
      >
        {projection.indexEntries.map((entry) => (
          <div className="review-packet-index-row" key={entry.step}>
            <strong>{entry.step}</strong>
            <span>{entry.surface}</span>
            <span>{entry.role}</span>
            <span>{entry.boundary}</span>
          </div>
        ))}
        <Field
          label="Index state"
          value={
            postureContextAvailable
              ? "review_packet_index_ready_for_operator_scan"
              : "review_packet_index_policy_only_posture_context_missing"
          }
        />
        <ReviewPacketBoundaryFields
          label="Index boundary"
          value="review_packet_index_navigation_only"
        />
      </ReviewPacketPanel>

      <ReviewPacketPanel
        className="review-packet-availability-summary"
        label="Private-readiness review packet availability summary"
      >
        {projection.availabilitySummary.rows.map((row) => (
          <div className="review-packet-availability-row" key={row.step}>
            <strong>{row.step}</strong>
            <span>{row.availability}</span>
            <span>{row.detail}</span>
            <span>{row.boundary}</span>
          </div>
        ))}
        <Field
          label="Availability summary"
          value={projection.availabilitySummary.countSummary}
        />
        <ReviewPacketBoundaryFields
          label="Availability boundary"
          value="review_packet_availability_summary_navigation_only"
        />
      </ReviewPacketPanel>

      <ReviewPacketPanel
        className="review-packet-gap-summary"
        label="Private-readiness review packet gap summary"
      >
        <Field label="Gap summary" value={projection.gapSummary.countSummary} />
        <Field label="Next gap focus" value={projection.gapSummary.nextGapFocus} />
        <Field label="Gap state" value={projection.gapSummary.gapState} />
        <ReviewPacketBoundaryFields
          label="Gap boundary"
          value="review_packet_gap_summary_navigation_only"
        />
      </ReviewPacketPanel>

      <ReviewPacketPanel
        className="review-packet-resolution-checklist"
        label="Private-readiness review packet resolution checklist"
      >
        {projection.resolutionChecklist.items.map((item) => (
          <div className="review-packet-resolution-row" key={`${item.item}-${item.source}`}>
            <strong>{item.item}</strong>
            <span>{item.source}</span>
            <span>{item.status}</span>
            <span>{item.detail}</span>
            <span>{item.boundary}</span>
          </div>
        ))}
        <Field
          label="Resolution checklist"
          value={projection.resolutionChecklist.countSummary}
        />
        <Field
          label="Next resolution focus"
          value={projection.resolutionChecklist.nextResolutionFocus}
        />
        <Field
          label="Checklist state"
          value={projection.resolutionChecklist.checklistState}
        />
        <ReviewPacketBoundaryFields
          label="Checklist boundary"
          value="review_packet_resolution_checklist_navigation_only"
        />
      </ReviewPacketPanel>

      <ReviewPacketPanel
        className="review-packet-source-provenance-summary"
        label="Private-readiness review packet source/provenance summary"
      >
        {projection.sourceProvenanceSummary.rows.map((row) => (
          <div className="review-packet-source-provenance-row" key={`${row.item}-${row.source}`}>
            <strong>{row.item}</strong>
            <span>{row.source}</span>
            <span>{row.provenance}</span>
            <span>{row.detail}</span>
            <span>{row.boundary}</span>
          </div>
        ))}
        <Field
          label="Source/provenance summary"
          value={projection.sourceProvenanceSummary.countSummary}
        />
        <Field
          label="Next source focus"
          value={projection.sourceProvenanceSummary.nextSourceFocus}
        />
        <Field
          label="Source state"
          value={projection.sourceProvenanceSummary.sourceState}
        />
        <ReviewPacketBoundaryFields
          label="Source/provenance boundary"
          value="review_packet_source_provenance_navigation_only"
        />
      </ReviewPacketPanel>
    </>
  );
}

function ReviewPacketPanel({
  children,
  className,
  label
}: {
  children: React.ReactNode;
  className: string;
  label: string;
}) {
  return (
    <div className={className} aria-label={label}>
      <h4>{label}</h4>
      {children}
    </div>
  );
}

function ReviewPacketBoundaryFields({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Field label={label} value={value} />
      <Field label="Evidence boundary" value="not_counted_evidence_or_promotion" />
      <Field
        label="Authority boundary"
        value="not_private_read_permission_or_execution_authority"
      />
    </>
  );
}

function privateReadinessPostureDraftFromReadModel(
  posture?: PrivateReadinessPostureReadModel | null
): PrivateReadinessPostureDraft {
  return {
    operator_approval_gate: posture?.operator_approval_gate ?? privateReadinessPolicyGate(
      "not_ready",
      "operator_live_private_read_approval_missing"
    ),
    jurisdiction_risk_gate: posture?.jurisdiction_risk_gate ?? privateReadinessPolicyGate(
      "review_required",
      "operator_jurisdiction_not_recorded"
    ),
    live_binding_gate: posture?.live_binding_gate ?? privateReadinessPolicyGate(
      "not_ready",
      "live_binding_profile_not_configured"
    ),
    secret_handling_gate: posture?.secret_handling_gate ?? privateReadinessPolicyGate(
      "not_ready",
      "secret_handling_profile_not_configured"
    ),
    stop_behavior_gate: posture?.stop_behavior_gate ?? privateReadinessPolicyGate(
      "not_ready",
      "operator_stop_behavior_not_recorded"
    )
  };
}

function privateReadinessPolicyGate(
  status: PrivateReadinessPolicyGateInput["status"],
  reason: string
): PrivateReadinessPolicyGateInput {
  return { status, reason };
}

function orderFillStatusTone(surface: OrderFillSurfaceReadModel): "counted" | "failed" | "neutral" {
  if (surface.posture === "rejected" || surface.posture === "expired" || surface.liveness === "disconnected") {
    return "failed";
  }
  if (surface.posture === "filled" || surface.posture === "partially_filled") {
    return "counted";
  }
  return "neutral";
}

function publicMarketStatusTone(surface: PublicMarketLivenessSurfaceReadModel): "counted" | "failed" | "neutral" {
  if (surface.symbol_status !== "TRADING" || surface.liveness === "disconnected") {
    return "failed";
  }
  if (surface.freshness === "fresh" && surface.liveness === "connected") {
    return "counted";
  }
  return "neutral";
}

function privateReadinessStatusTone(
  surface: PrivateReadinessPreflightSurfaceReadModel
): "counted" | "failed" | "neutral" {
  if (surface.liveness === "disconnected") {
    return "failed";
  }
  return "neutral";
}

function privateReadinessPostureStatusTone(
  posture: PrivateReadinessPostureReadModel
): "counted" | "failed" | "neutral" {
  if (
    posture.live_binding_gate.status === "blocked" ||
    posture.secret_handling_gate.status === "blocked" ||
    posture.stop_behavior_gate.status === "blocked" ||
    posture.operator_approval_gate.status === "blocked" ||
    posture.jurisdiction_risk_gate.status === "blocked"
  ) {
    return "failed";
  }
  if (
    posture.live_binding_gate.status === "ready" &&
    posture.secret_handling_gate.status === "ready" &&
    posture.stop_behavior_gate.status === "ready" &&
    posture.operator_approval_gate.status === "ready" &&
    posture.jurisdiction_risk_gate.status === "ready"
  ) {
    return "counted";
  }
  return "neutral";
}

function accountPositionRiskStatusTone(
  surface: AccountPositionRiskMirrorSurfaceReadModel
): "counted" | "failed" | "neutral" {
  if (surface.risk_status === "breach" || surface.kill_switch_status === "active") {
    return "failed";
  }
  if (surface.risk_status === "nominal" && surface.liveness === "connected") {
    return "counted";
  }
  return "neutral";
}

function privateReadinessPolicyStatusTone(
  decision: PrivateReadinessPolicyDecision
): "counted" | "failed" | "neutral" {
  if (decision.status === "blocked") {
    return "failed";
  }
  if (decision.status === "ready") {
    return "counted";
  }
  return "neutral";
}

function formatPrivateReadinessGate(
  gate: PrivateReadinessPreflightSurfaceReadModel["credential_gate"]
): string {
  return `${gate.status}, enabled=${String(gate.enabled)}, reason=${gate.reason}`;
}

function formatPrivateReadinessPolicyGate(
  gate: PrivateReadinessPostureReadModel["live_binding_gate"]
): string {
  return `${gate.status}, reason=${gate.reason}`;
}

function formatPrivateReadinessPostureGateSummary(
  posture: PrivateReadinessPostureReadModel
): string {
  return [
    `operator=${posture.operator_approval_gate.status}`,
    `jurisdiction=${posture.jurisdiction_risk_gate.status}`,
    `live_binding=${posture.live_binding_gate.status}`,
    `secret_handling=${posture.secret_handling_gate.status}`,
    `stop_behavior=${posture.stop_behavior_gate.status}`
  ].join(", ");
}

function previousPrivateReadinessPosture(
  current: PrivateReadinessPostureReadModel,
  history: PrivateReadinessPostureReadModel[]
): PrivateReadinessPostureReadModel | undefined {
  return history.find((posture) => posture.posture_id !== current.posture_id);
}

function privateReadinessPostureGateChanges(
  current: PrivateReadinessPostureReadModel,
  previous: PrivateReadinessPostureReadModel
): PrivateReadinessPostureGateChange[] {
  return PRIVATE_READINESS_POSTURE_GATE_FIELDS.flatMap((field) => {
    const currentGate = current[field.key];
    const previousGate = previous[field.key];
    if (currentGate.status === previousGate.status && currentGate.reason === previousGate.reason) {
      return [];
    }
    return [{
      label: field.label,
      fromStatus: previousGate.status,
      toStatus: currentGate.status,
      fromReason: previousGate.reason,
      toReason: currentGate.reason
    }];
  });
}

function formatPrivateReadinessPostureGateChangeCount(
  changes: PrivateReadinessPostureGateChange[]
): string {
  if (changes.length === 0) {
    return "0 changed gates";
  }
  return `${changes.length} changed gate${changes.length === 1 ? "" : "s"}`;
}

function formatPrivateReadinessPostureGateChanges(
  changes: PrivateReadinessPostureGateChange[]
): string {
  if (changes.length === 0) {
    return "none";
  }
  return changes
    .map((change) =>
      [
        `${change.label}: ${change.fromStatus} -> ${change.toStatus}`,
        change.fromReason === change.toReason
          ? undefined
          : `reason ${change.fromReason} -> ${change.toReason}`
      ]
        .filter(Boolean)
        .join(", ")
    )
    .join("; ");
}

function formatPrivateReadinessReviewHandoffDelta(
  previousPosture: PrivateReadinessPostureReadModel | undefined,
  changes: PrivateReadinessPostureGateChange[]
): string {
  if (!previousPosture) {
    return "previous_posture_not_available";
  }
  return [
    `previous=${previousPosture.posture_id}`,
    formatPrivateReadinessPostureGateChangeCount(changes)
  ].join(", ");
}

function formatPrivateReadinessPolicyImpact(decision: PrivateReadinessPolicyDecision): string {
  return [
    `status=${decision.status}`,
    `blocking_conditions=${decision.blocking_conditions.length}`,
    `required_next_actions=${decision.required_next_actions.length}`
  ].join(", ");
}

function formatPrivateReadinessReviewChecklist(
  decision: PrivateReadinessPolicyDecision,
  previousPosture: PrivateReadinessPostureReadModel | undefined
): string {
  return [
    "inspect_latest_posture",
    previousPosture ? "review_posture_delta" : "record_previous_posture_before_delta_review",
    "review_policy_impact",
    decision.required_next_actions.length > 0 ? "resolve_required_next_actions" : "no_required_next_actions",
    "keep_no_authority_boundary"
  ].join(", ");
}

function formatPrivateReadinessAuthorityGateState(decision: PrivateReadinessPolicyDecision): string {
  return [
    "private_read_authority=not_granted",
    `policy_status=${decision.status}`,
    `authority_status=${decision.authority_status}`
  ].join(", ");
}

function formatPrivateReadinessAuthorityGateReadiness(
  decision: PrivateReadinessPolicyDecision
): string {
  const gateCounts: Record<PrivateReadinessPolicyDecision["status"], number> = {
    ready: 0,
    not_ready: 0,
    review_required: 0,
    blocked: 0
  };
  for (const gate of decision.checked_gates) {
    gateCounts[gate.status] += 1;
  }
  return [
    `ready=${gateCounts.ready}`,
    `not_ready=${gateCounts.not_ready}`,
    `review_required=${gateCounts.review_required}`,
    `blocked=${gateCounts.blocked}`
  ].join(", ");
}

function formatPrivateReadinessAuthorityGateNextStep(
  decision: PrivateReadinessPolicyDecision
): string {
  return [
    decision.blocking_conditions.length > 0 ? "resolve_blocking_conditions" : "no_blocking_conditions",
    decision.required_next_actions.length > 0 ? "complete_required_next_actions" : "no_required_next_actions",
    "keep_authority_status_not_live"
  ].join(", ");
}

function formatPolicyListSummary(items: string[]): string {
  if (items.length === 0) {
    return "none";
  }
  const visibleItems = items.slice(0, 3);
  const suffix = items.length > visibleItems.length ? `, +${items.length - visibleItems.length} more` : "";
  return `${visibleItems.join(", ")}${suffix}`;
}

function formatSubstrateSource(
  surface:
    | AccountPositionRiskMirrorSurfaceReadModel
    | OrderFillSurfaceReadModel
    | PublicMarketLivenessSurfaceReadModel
    | PrivateReadinessPostureReadModel
    | PrivateReadinessPreflightSurfaceReadModel
): string {
  return [
    surface.source_kind,
    surface.fixture_backed ? "fixture-backed" : "external",
    surface.simulated ? "simulated" : "observed",
    surface.source_ref ? formatRef(surface.source_ref) : "none"
  ].join(" / ");
}

function RunControlSection({
  control,
  privateReadinessPolicyDecision,
  onRecordRunControl,
  recordingRunControl,
  runtimeControlError,
  runtimeControlMessage
}: {
  control?: RunControlReadModel;
  privateReadinessPolicyDecision?: PrivateReadinessPolicyDecision | null;
  onRecordRunControl?: () => void;
  recordingRunControl: boolean;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
}) {
  const statusLabel = control?.chain_complete
    ? "chain complete"
    : control?.has_activity
      ? "incomplete"
      : "none";

  return (
    <InfoSection
      title="Run Control"
      summary={`${statusLabel} / ${control?.audit_event.authority_status ?? "not_live"}`}
      badge={control?.latest_command?.action ?? statusLabel}
    >
      <div className={`evaluation-status ${control?.chain_complete ? "counted" : "neutral"}`}>
        <span>Trading run state</span>
        <strong>{statusLabel}</strong>
        <span>{control?.audit_event.authority_status ?? "not_live"}</span>
      </div>

      <Field label="Activity" value={control?.has_activity ? "recorded" : "none"} />
      <Field label="Complete chain" value={control?.chain_complete ? "yes" : "no"} />
      <Field label="Command" value={control?.command.status ?? "pending_decision"} />
      <Field label="Decision" value={control?.decision.status ?? "not_evaluated"} />
      <Field label="Audit event" value={control?.audit_event.status ?? "not_recorded"} />

      {privateReadinessPolicyDecision && (
        <div className="evaluation-block" aria-label="Run-control private-readiness policy alignment">
          <h4>Private-readiness policy alignment</h4>
          <Field
            label="Policy alignment"
            value={runtimeControlPolicyAlignment(privateReadinessPolicyDecision)}
          />
          <Field label="Policy status" value={privateReadinessPolicyDecision.status} />
          <Field
            label="Policy reason codes"
            value={formatPolicyListSummary(privateReadinessPolicyDecision.reason_codes)}
          />
          <Field
            label="Required next actions"
            value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
          />
          <Field label="Control boundary" value="control_only / audit_only / not_live" />
          <Field label="Authority boundary" value="not_private_read_permission_or_execution_authority" />
          <Field
            label="Execution boundary"
            value="not_order_request_gateway_result_evidence_or_promotion"
          />
        </div>
      )}

      {control?.latest_command ? (
        <div className="evaluation-block">
          <h4>Latest control command</h4>
          <Field label="Action" value={control.latest_command.action} />
          <Field label="Status" value={control.latest_command.status} />
          <Field label="Actor" value={control.latest_command.actor_kind} />
          <Field label="Reason" value={control.latest_command.reason} />
          <Field label="Authority" value={control.latest_command.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest control command</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {control?.latest_decision ? (
        <div className="evaluation-block">
          <h4>Latest control decision</h4>
          <Field label="Outcome" value={control.latest_decision.decision_outcome} />
          <Field label="Reason" value={control.latest_decision.decision_reason} />
          <Field label="Command" value={formatRef(control.latest_decision.command_ref)} />
          <Field label="Lifecycle" value={control.latest_decision.resulting_lifecycle_status ?? "unchanged"} />
          <Field label="Authority" value={control.latest_decision.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest control decision</h4>
          <Field label="Outcome" value="not_evaluated" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {control?.latest_audit_event ? (
        <div className="evaluation-block">
          <h4>Latest audit event</h4>
          <Field label="Event" value={control.latest_audit_event.event_kind} />
          <Field label="Command" value={control.latest_audit_event.command_ref ? formatRef(control.latest_audit_event.command_ref) : "none"} />
          <Field label="Decision" value={control.latest_audit_event.decision_ref ? formatRef(control.latest_audit_event.decision_ref) : "none"} />
          <Field label="Lifecycle" value={control.latest_audit_event.runtime_lifecycle_status ?? "unchanged"} />
          <Field label="Authority" value={control.latest_audit_event.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest audit event</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {onRecordRunControl && (
        <div className="runtime-command">
          <Button
            className="runtime-command-button"
            type="button"
            onClick={onRecordRunControl}
            disabled={recordingRunControl}
          >
            {recordingRunControl ? "Recording pause" : "Record pause"}
          </Button>
          <span>control_only / audit_only / not_live</span>
        </div>
      )}
      {runtimeControlMessage && <div className="inline-status">{runtimeControlMessage}</div>}
      {runtimeControlError && <div className="inline-status error">{runtimeControlError}</div>}
    </InfoSection>
  );
}

function runtimeControlPolicyAlignment(
  decision: PrivateReadinessPolicyDecision
):
  | "policy_not_ready"
  | "policy_blocked"
  | "policy_review_required"
  | "policy_ready_but_not_live_authority" {
  if (decision.status === "ready") {
    return "policy_ready_but_not_live_authority";
  }
  if (decision.status === "review_required") {
    return "policy_review_required";
  }
  if (decision.status === "blocked") {
    return "policy_blocked";
  }
  return "policy_not_ready";
}

function ImprovementSection({
  improvement,
  onRecordImprovement,
  recordingImprovement,
  improvementError,
  improvementMessage
}: {
  improvement?: ImprovementReadModel;
  onRecordImprovement?: () => void;
  recordingImprovement: boolean;
  improvementError?: string;
  improvementMessage?: string;
}) {
  const statusLabel = improvement?.chain_complete
    ? "chain complete"
    : improvement?.has_activity
      ? "incomplete"
      : "none";

  return (
    <InfoSection
      title="Improvement"
      summary={`proposal ${improvement?.proposal_chain_complete ? "complete" : "incomplete"} / evaluation ${improvement?.evaluation_chain_complete ? "complete" : "incomplete"}`}
      badge={statusLabel}
    >
      <div className={`evaluation-status ${improvement?.chain_complete ? "counted" : "neutral"}`}>
        <span>Proposal / experiment / evaluation</span>
        <strong>{statusLabel}</strong>
        <span>{improvement?.promotion.authority_status ?? "not_live"}</span>
      </div>

      <Field label="Source model" value={improvement?.source_model ?? "automated_alignment_researcher"} />
      <Field label="Proposal chain" value={improvement?.proposal_chain_complete ? "complete" : "incomplete"} />
      <Field label="Evaluation chain" value={improvement?.evaluation_chain_complete ? "complete" : "incomplete"} />
      <Field label="No-authority boundary" value={`live_exchange=${String(improvement?.no_authority.live_exchange ?? false)}, order_authority=${String(improvement?.no_authority.order_authority ?? false)}, credentials=${String(improvement?.no_authority.credentials ?? false)}`} />

      {improvement?.latest_source_finding ? (
        <div className="evaluation-block">
          <h4>Source finding</h4>
          <Field label="Finding" value={improvement.latest_source_finding.finding_id} />
          <Field label="Kind" value={improvement.latest_source_finding.finding_kind} />
          <Field label="Summary" value={improvement.latest_source_finding.summary} />
          <Field label="Authority" value={improvement.latest_source_finding.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Source finding</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="research_trace_only" />
        </div>
      )}

      {improvement?.latest_change_proposal ? (
        <div className="evaluation-block">
          <h4>Change proposal</h4>
          <Field label="Proposal" value={improvement.latest_change_proposal.proposal_id} />
          <Field label="Status" value={improvement.latest_change_proposal.status} />
          <Field label="System code" value={formatRef(improvement.latest_change_proposal.proposed_system_code_ref)} />
          <Field label="Parent code" value={improvement.latest_change_proposal.parent_system_code_ref ? formatRef(improvement.latest_change_proposal.parent_system_code_ref) : "none"} />
          <Field label="Summary" value={improvement.latest_change_proposal.proposal_summary} />
          <Field label="Authority" value={improvement.latest_change_proposal.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Change proposal</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="proposal_only" />
        </div>
      )}

      {improvement?.latest_materialization && (
        <div className="evaluation-block">
          <h4>Materialization</h4>
          <Field label="Attempt" value={improvement.latest_materialization.attempt_id} />
          <Field label="Status" value={improvement.latest_materialization.status} />
          <Field label="Validation" value={improvement.latest_materialization.validation_status} />
          <Field label="Authority" value={improvement.latest_materialization.authority_status} />
        </div>
      )}

      {improvement?.latest_experiment ? (
        <div className="evaluation-block">
          <h4>Experiment</h4>
          <Field label="Experiment" value={improvement.latest_experiment.experiment_id} />
          <Field label="Status" value={improvement.latest_experiment.status} />
          <Field label="System code" value={formatRef(improvement.latest_experiment.system_code_ref)} />
          <Field label="Authority" value={improvement.latest_experiment.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Experiment</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {improvement?.latest_evaluation_result ? (
        <div className="evaluation-block">
          <h4>Evaluation result</h4>
          <Field label="Result" value={improvement.latest_evaluation_result.result_id} />
          <Field label="Status" value={improvement.latest_evaluation_result.result_status} />
          <Field label="Disposition" value={improvement.latest_evaluation_result.evidence_disposition} />
          <Field label="Score" value={String(improvement.latest_evaluation_result.total_score)} />
          <Field label="Authority" value={improvement.latest_evaluation_result.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Evaluation result</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_counted" />
        </div>
      )}

      <div className="evaluation-block">
        <h4>Evidence</h4>
        <Field label="Status" value={improvement?.evidence.status ?? "missing"} />
        <Field label="Reason" value={improvement?.evidence.reason ?? "evaluation_required"} />
        <Field label="Authority" value={improvement?.evidence.authority_status ?? "not_counted"} />
      </div>

      <div className="evaluation-block">
        <h4>Promotion</h4>
        <Field label="Status" value={improvement?.promotion.status ?? "not_promoted"} />
        <Field label="Reason" value={improvement?.promotion.reason ?? "promotion_requires_sealed_evidence"} />
        <Field label="Authority" value={improvement?.promotion.authority_status ?? "not_live"} />
      </div>

      {onRecordImprovement && (
        <div className="runtime-command">
          <Button
            className="runtime-command-button"
            type="button"
            onClick={onRecordImprovement}
            disabled={recordingImprovement}
          >
            {recordingImprovement ? "Recording improvement" : "Record improvement"}
          </Button>
          <span>proposal_only / sandbox_evaluation / not_live</span>
        </div>
      )}
      {improvementMessage && <div className="inline-status">{improvementMessage}</div>}
      {improvementError && <div className="inline-status error">{improvementError}</div>}
    </InfoSection>
  );
}

function LedgerSection({
  ledger
}: {
  ledger?: LedgerReadModel;
}) {
  const statusLabel = ledger?.chain_complete
    ? "chain complete"
    : ledger?.has_activity
      ? "incomplete"
      : "none";

  return (
    <InfoSection
      title="Ledger"
      summary={`Order request -> Gateway result -> Execution result: ${statusLabel}`}
      badge={statusLabel}
    >
      <div className={`evaluation-status ${ledger?.chain_complete ? "counted" : "neutral"}`}>
        <span>Request / decision / result</span>
        <strong>{statusLabel}</strong>
        <span>{ledger?.authority_status ?? "not_live"}</span>
      </div>

      <Field label="Complete chain" value={ledger?.chain_complete ? "yes" : "no"} />
      <Field label="Order request" value={ledger?.order_request.status ?? "not_submitted"} />
      <Field label="Gateway result" value={ledger?.gateway_result.status ?? "not_evaluated"} />
      <Field label="Execution result" value={ledger?.execution_result.status ?? "not_submitted"} />

      {ledger?.latest_order_request ? (
        <div className="evaluation-block">
          <h4>Order request</h4>
          <Field label="Intent" value={ledger.latest_order_request.intent_kind} />
          <Field label="Status" value={ledger.latest_order_request.status} />
          <Field label="Side / type" value={`${ledger.latest_order_request.side ?? "none"} / ${ledger.latest_order_request.order_type ?? "none"}`} />
          <Field label="Quantity" value={ledger.latest_order_request.quantity ?? "none"} />
          <Field label="Limit" value={ledger.latest_order_request.limit_price ?? "none"} />
          <Field label="Authority" value={ledger.latest_order_request.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Order request</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_submitted" />
        </div>
      )}

      {ledger?.latest_gateway_result ? (
        <div className="evaluation-block">
          <h4>Gateway result</h4>
          <Field label="Outcome" value={ledger.latest_gateway_result.decision_outcome} />
          <Field label="Reason" value={ledger.latest_gateway_result.decision_reason} />
          <Field label="Order request" value={formatRef(ledger.latest_gateway_result.order_request_ref)} />
          <Field label="Authority" value={ledger.latest_gateway_result.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Gateway result</h4>
          <Field label="Outcome" value="not_evaluated" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {ledger?.latest_execution_result ? (
        <div className="evaluation-block">
          <h4>Execution result</h4>
          <Field label="Stage" value={ledger.latest_execution_result.stage} />
          <Field label="Mode" value={ledger.latest_execution_result.execution_mode} />
          <Field label="Status" value={ledger.latest_execution_result.status} />
          <Field label="Reason" value={ledger.latest_execution_result.result_reason} />
          <Field label="Gateway result" value={formatRef(ledger.latest_execution_result.gateway_result_ref)} />
          <Field label="Authority" value={ledger.latest_execution_result.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Execution result</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_submitted" />
        </div>
      )}

      <div className="evaluation-block">
        <h4>Ledger history</h4>
        <Field label="Chains" value={`${ledger?.chain_count ?? 0} chains`} />
        <Field label="Latest first" value={ledger?.chains.length ? "yes" : "none"} />
      </div>

      {ledger?.chains.map((chain, index) => (
        <div className="evaluation-block" key={chain.chain_id}>
          <h4>{`Ledger chain ${index + 1}`}</h4>
          <Field label="Complete" value={chain.chain_complete ? "yes" : "no"} />
          <Field
            label="Order request"
            value={`${chain.order_request.side ?? "none"} / ${chain.order_request.order_type ?? "none"} / ${chain.order_request.quantity ?? "none"} @ ${chain.order_request.limit_price ?? "none"}`}
          />
          <Field
            label="Gateway result"
            value={chain.gateway_result
              ? `${chain.gateway_result.decision_outcome} / ${chain.gateway_result.decision_reason}`
              : "not_evaluated"}
          />
          <Field
            label="Execution result"
            value={chain.execution_result
              ? `${chain.execution_result.status} / ${chain.execution_result.result_reason}`
              : "not_submitted"}
          />
          <Field label="Authority" value={chain.authority_status} />
        </div>
      ))}

    </InfoSection>
  );
}

function EvaluationSection({ evaluation }: { evaluation: CandidateEvaluationReadModel }) {
  const latestRun = evaluation.latest_run;
  const latestComparisonSet = evaluation.latest_comparison_set;
  const latestSealingDecision = evaluation.latest_sealing_decision;

  return (
    <div className="evaluation-stack">
      <div className={`evaluation-status ${evaluationStatusTone(evaluation)}`}>
        <span>Evaluation state</span>
        <strong>{evaluationStatusLabel(evaluation)}</strong>
        <span>{evaluation.counted_evidence.disposition_reason}</span>
      </div>

      {latestRun ? (
        <div className="evaluation-block">
          <h4>Latest evaluation run</h4>
          <Field label="Run" value={latestRun.run_id} />
          <Field label="Status" value={latestRun.status} />
          <Field label="Stage binding" value={`${latestRun.stage ?? "missing"} / ${latestRun.profile ?? "missing"}`} />
          <Field label="Execution mode context" value={latestRun.execution_mode ?? "missing"} />
          <Field label="Trace" value={formatRef(latestRun.trace_ref)} />
          <Field label="Authority" value={latestRun.authority_status} />
          {latestRun.error_state && <Field label="Error" value={latestRun.error_state.message} />}
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>No evaluation runs</h4>
          <Field label="Status" value={evaluation.run.status} />
          <Field label="Authority" value={evaluation.run.authority_status} />
          <Field label="Reason" value={evaluation.counted_evidence.disposition_reason} />
        </div>
      )}

      <div className="evaluation-block">
        <h4>Comparison set</h4>
        {latestComparisonSet ? (
          <>
            <Field label="Comparability" value={latestComparisonSet.comparability_status} />
            <Field label="Reason" value={latestComparisonSet.comparability_reason} />
            <Field label="Authority" value={latestComparisonSet.authority_status} />
          </>
        ) : (
          <>
            <Field label="Status" value={evaluation.comparison_set.status} />
            <Field label="Authority" value={evaluation.comparison_set.authority_status} />
          </>
        )}
      </div>

      <div className="evaluation-block">
        <h4>Trace material</h4>
        <Field label="State" value={evaluation.trace.state} />
        <Field label="Trace" value={evaluation.trace.trace_ref ? formatRef(evaluation.trace.trace_ref) : "none"} />
        <Field label="Authority" value={evaluation.trace.authority_status} />
        {evaluation.trace.authority_label && <Field label="Label" value={evaluation.trace.authority_label} />}
        <Field label="Provider artifacts" value={formatRefs(evaluation.trace.provider_output_artifact_refs)} />
        <Field label="Debug artifacts" value={formatRefs(evaluation.trace.debug_artifact_refs)} />
      </div>

      <div className="evaluation-block">
        <h4>Evidence state</h4>
        <Field label="Counted" value={evaluation.counted_evidence.counted ? "yes" : "no"} />
        <Field label="Disposition" value={evaluation.counted_evidence.evidence_disposition} />
        <Field label="Reason" value={evaluation.counted_evidence.disposition_reason} />
        <Field label="Authority" value={evaluation.counted_evidence.authority_status} />
        {evaluation.counted_evidence.sealed_at && <Field label="Sealed at" value={evaluation.counted_evidence.sealed_at} />}
        {latestSealingDecision ? (
          <>
            <Field label="Sealing decision" value={latestSealingDecision.sealing_decision_id} />
            <Field label="Decision disposition" value={latestSealingDecision.evidence_disposition} />
            <Field label="Decision refs" value={formatRefs(latestSealingDecision.evaluation_run_refs)} />
          </>
        ) : (
          <>
            <Field label="Sealing decision" value={evaluation.sealing_decision.status} />
            <Field label="Decision authority" value={evaluation.sealing_decision.authority_status} />
          </>
        )}
      </div>

      <div className="evaluation-block">
        <h4>Evidence classifications</h4>
        {evaluation.evidence_classifications.length > 0 ? (
          <div className="classification-list">
            {evaluation.evidence_classifications.map((classification) => (
              <EvidenceClassificationItem
                classification={classification}
                key={classification.classification_id}
              />
            ))}
          </div>
        ) : (
          <Field label="Classifications" value="none" />
        )}
      </div>
    </div>
  );
}

function EvidenceClassificationItem({
  classification
}: {
  classification: CandidateEvidenceClassificationReadModel;
}) {
  return (
    <div className="classification-row">
      <strong>{classification.classification_kind}</strong>
      <span>{classification.classification_status}</span>
      <span>{formatRef(classification.classified_ref)}</span>
      <span>{classification.classification_reason}</span>
      <span>{classification.authority_status}</span>
      {classification.sealed_by_decision_ref && <span>{formatRef(classification.sealed_by_decision_ref)}</span>}
    </div>
  );
}

function MaterializationAttemptSection({ attempt }: { attempt?: CandidateMaterializationAttemptReadModel }) {
  return (
    <InfoSection
      title="Materialization Attempt"
      summary={attempt ? `${attempt.status} / ${attempt.validation_status}` : "none"}
      badge={attempt?.status ?? "none"}
    >
      {attempt ? (
        <>
          <Field label="Attempt" value={attempt.attempt_id} />
          <Field label="Provider / model" value={`${attempt.provider_kind} / ${attempt.model}`} />
          <Field label="Status" value={attempt.status} />
          <Field label="Validation" value={attempt.validation_status} />
          {attempt.failure_reason && <Field label="Failure reason" value={attempt.failure_reason} />}
          {attempt.resulting_candidate_ref && (
            <Field label="Result candidate" value={formatRef(attempt.resulting_candidate_ref)} />
          )}
          <Field label="Agent run" value={formatRef(attempt.agent_run_ref)} />
          <Field label="Trace" value={formatRef(attempt.trace_ref)} />
          <Field label="Authority label" value={attempt.authority_label} />
        </>
      ) : (
        <div className="placeholder">
          <strong>No materialization attempt</strong>
          <span>provider output has not created a candidate</span>
          <span>provider_output_not_evidence</span>
        </div>
      )}
    </InfoSection>
  );
}

function InfoSection({
  title,
  summary,
  badge,
  defaultOpen: _defaultOpen = false,
  children
}: {
  title: string;
  summary?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {summary && <CardDescription>{summary}</CardDescription>}
        {badge && (
          <CardAction>
            <Badge variant={badgeVariant(badge)}>{badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-2">{children}</CardContent>
    </Card>
  );
}

const DEFAULT_BADGE_VALUES = new Set([
  "accepted",
  "available",
  "chain_complete",
  "complete",
  "ready",
  "running",
  "succeeded"
]);

const OUTLINE_BADGE_TOKENS = new Set([
  "incomplete",
  "pending",
  "planned",
  "required",
  "review"
]);

const DESTRUCTIVE_BADGE_TOKENS = new Set([
  "blocked",
  "breach",
  "failed",
  "invalid",
  "rejected"
]);

export function badgeVariant(badge: string): "default" | "secondary" | "outline" | "destructive" {
  const normalized = normalizeStatusValue(badge);
  const tokens = statusTokens(normalized);
  if (tokens.some((token) => DESTRUCTIVE_BADGE_TOKENS.has(token))) {
    return "destructive";
  }
  if (DEFAULT_BADGE_VALUES.has(normalized)) {
    return "default";
  }
  if (tokens.some((token) => OUTLINE_BADGE_TOKENS.has(token))) {
    return "outline";
  }
  return "secondary";
}

function normalizeStatusValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function statusTokens(normalizedValue: string): string[] {
  return normalizedValue.split("_").filter(Boolean);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 overflow-hidden rounded-md bg-background/35 p-2">
      <dt className="text-[11px] font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm leading-snug [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function Placeholder({ item }: { item: PlaceholderSummary }) {
  return (
    <div className="placeholder">
      <strong>{item.label}</strong>
      <span>{formatRef(item.ref)}</span>
      <span>{item.authority_status}</span>
    </div>
  );
}

function formatRef(ref: { record_kind: string; id: string }) {
  return `${canonicalRefKind(ref.record_kind)}:${ref.id}`;
}

function formatRefs(refs: Array<{ record_kind: string; id: string }>) {
  return refs.length > 0 ? refs.map(formatRef).join(", ") : "none";
}

function canonicalRefKind(recordKind: string): string {
  const canonicalKinds: Record<string, string> = {
    system_code: "system_code",
    trading_run: "trading_run",
    sandbox_placement: "sandbox_placement",
    sandbox: "sandbox",
    order_request: "order_request",
    gateway_result: "gateway_result",
    execution_result: "execution_result",
    run_control_command: "run_control_command",
    run_control_decision: "run_control_decision"
  };
  return canonicalKinds[recordKind] ?? recordKind;
}

function canonicalGatewayTrackingStep(step: string): string {
  const steps: Record<string, string> = {
    order_request: "order_request",
    gateway_result: "gateway_result",
    execution_result: "execution_result"
  };
  return steps[step] ?? step;
}

function evaluationStatusLabel(evaluation: CandidateEvaluationReadModel) {
  if (!evaluation.has_runs) {
    return "empty";
  }
  if (evaluation.latest_run?.status === "failed") {
    return "failed";
  }
  if (
    evaluation.latest_sealing_decision?.sealed_at ||
    evaluation.latest_sealing_decision?.evidence_disposition === "counted" ||
    evaluation.latest_sealing_decision?.evidence_disposition === "quarantined_for_review"
  ) {
    return "sealed";
  }
  if (evaluation.latest_run?.status === "created" || evaluation.latest_run?.status === "running") {
    return "pending";
  }
  return evaluation.latest_run?.status ?? "unknown";
}

function evaluationStatusTone(evaluation: CandidateEvaluationReadModel) {
  const label = evaluationStatusLabel(evaluation);
  if (label === "failed") {
    return "failed";
  }
  if (label === "sealed") {
    return evaluation.counted_evidence.counted ? "counted" : "sealed";
  }
  return "neutral";
}
