import { useEffect, useRef, useState } from "react";
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
import { buildTradingFirstViewportRecommendation, commandRemediation } from "@ouroboros/domain";
import {
  fetchCandidate,
  fetchReplayRunComparison,
  fetchReplayRunDetail,
  fetchReplayRunEvidence,
  fetchReplayRunValidationState,
  fetchCandidateSummaries,
  fetchTradingGatewayEnvironment,
  fetchTradingExecutionModeContracts,
  buildTradingResearchRuntimeFromOperator,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import {
  buildPrivateReadinessReviewPacketProjection,
  formatPrivateReadinessCheckedGatePosture
} from "./private-readiness-review-packet";
import type { PrivateReadinessReviewPacketProjection } from "./private-readiness-review-packet";
import {
  OperatorActionRow,
  OperatorAppHeader,
  OperatorAppMain,
  OperatorAppShell,
  OperatorEmptyState,
  OperatorEvidenceBlock,
  OperatorEvidencePanel,
  OperatorEvidenceRow,
  OperatorEvidenceStack,
  OperatorEvidenceStatus,
  OperatorField,
  OperatorFieldGrid,
  OperatorInfoSection,
  OperatorPage,
  OperatorPageHeader,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorSelectionItem,
  OperatorStat,
  OperatorStatusStack,
  OperatorStatusBadge,
  OperatorTabPanel,
  OperatorViewTabs,
  OperatorWorkspaceBody,
  OperatorWorkspacePanel,
  OperatorWorkspaceSplit,
  OperatorDetailText,
  operatorBadgeVariant,
  type OperatorStatusStackMessage,
  type OperatorViewTabItem
} from "./design-system";
import { OperatorDecisionPanel } from "@/sections/trading/operator-decision-panel";
import {
  ArenaAgentProviderSection,
  type ArenaAgentProviderOption,
  type ArenaAgentProviderProfile
} from "@/sections/arena/arena-agent-provider-section";
import { ArenaCommandBarSection } from "@/sections/arena/arena-command-bar-section";
import {
  ArenaCommandLogSection,
  type ArenaCommandLogEntry
} from "@/sections/arena/arena-command-log-section";
import {
  ArenaLeaderboardSection,
  type ArenaLeaderboardEntry
} from "@/sections/arena/arena-leaderboard-section";
import {
  ArenaLatestTicksSection,
  type ArenaLatestTickSummary
} from "@/sections/arena/arena-latest-ticks-section";
import {
  ArenaMetricStripSection,
  type ArenaMetricStripItem
} from "@/sections/arena/arena-metric-strip-section";
import {
  ArenaPaperBoardSection,
  type ArenaPaperBoardEntry
} from "@/sections/arena/arena-paper-board-section";
import {
  ArenaSelectedCandidateSection,
  type ArenaSelectedCandidateField
} from "@/sections/arena/arena-selected-candidate-section";
import {
  ResearchAgentCycleSection,
  type ResearchAgentCycleLineageField,
  type ResearchAgentCycleMetric
} from "@/sections/research/research-agent-cycle-section";
import {
  ResearchCycleSection,
  type ResearchCycleRow,
  type ResearchCycleStage
} from "@/sections/research/research-cycle-section";
import {
  ResearchFindingClustersSection,
  type ResearchFindingClusterEntry
} from "@/sections/research/research-finding-clusters-section";
import {
  ResearchPaperLearningSection,
  type ResearchPaperLearningField
} from "@/sections/research/research-paper-learning-section";
import {
  ResearchSignalsSection,
  type ResearchSignalMetric
} from "@/sections/research/research-signals-section";
import { PaperReviewSummarySection } from "@/sections/trading/paper-review-summary-section";
import { TradingCockpitSection } from "@/sections/trading/trading-cockpit-section";
import {
  TradingOrderStatusSection,
  type TradingOrderStatusBadge,
  type TradingOrderStatusStat
} from "@/sections/trading/trading-order-status-section";
import { TradingMarketSection } from "@/sections/trading/trading-market-section";
import {
  TradingMarketChart,
  type TradingMarketChartField,
  type TradingMarketChartPoint
} from "@/sections/trading/trading-market-chart";
import {
  TradingPaperReadbackSection,
  type TradingReadbackField
} from "@/sections/trading/trading-paper-readback-section";
import {
  TradingPromotionBoundarySection,
  type TradingPromotionBoundaryBadge,
  type TradingPromotionBoundaryField
} from "@/sections/trading/trading-promotion-boundary-section";
import {
  TradingSafetyBoundarySection,
  type TradingSafetyBoundaryBadge
} from "@/sections/trading/trading-safety-boundary-section";
import type { TradingSummaryMetric } from "@/sections/trading/trading-metrics";
import {
  TradingReviewPacketSection,
  type TradingReviewPacketField
} from "@/sections/trading/trading-review-packet-section";
import {
  OPERATOR_VIEWS,
  OperatorSidebar,
  type OperatorSidebarCandidate,
  type OperatorView
} from "@/shell/operator-sidebar";
import "./styles.css";

export type { OperatorView } from "@/shell/operator-sidebar";

export interface AppState {
  candidates: CandidateSummaryReadModel[];
  executionModes: TradingSystemExecutionModeContractReadModel[];
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  tradingResearchRuntime?: TradingResearchRuntimeReadModel;
  operator?: OperatorReadModel;
  candidateArena?: CandidateArenaReadModel;
  selectedTradingResearchAgent: TradingResearchAgentSelection;
  tradingResearchIterations: number;
  selected?: CandidateInspectReadModel;
  tradingReviewCandidate?: CandidateInspectReadModel;
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

export const OPERATOR_REFRESH_INTERVAL_MS = 5_000;

function operatorStatusMessages(
  ...messages: Array<OperatorStatusStackMessage | undefined>
): OperatorStatusStackMessage[] {
  return messages.filter((message): message is OperatorStatusStackMessage => Boolean(message));
}

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

async function fetchTradingReviewCandidate(
  operator: OperatorReadModel,
  selected?: CandidateInspectReadModel
): Promise<CandidateInspectReadModel | undefined> {
  const activeCandidateId = operator.trading_review.active_candidate_id;
  if (!activeCandidateId) {
    return undefined;
  }
  if (selected?.candidate_id === activeCandidateId) {
    return selected;
  }
  return fetchCandidate(activeCandidateId);
}

const OPERATOR_RUNTIME_TEXT_LIMIT = 500;
const OPERATOR_RUNTIME_OVERVIEW_TRUNCATED_MARKER = "runtime overview truncated";

export function candidateNeedsDetailFetch(candidate: CandidateInspectReadModel | null | undefined): boolean {
  if (!candidate) {
    return false;
  }
  const transcript = candidate.runtime.transcript;
  if (transcript && transcript.items.length < transcript.item_count) {
    return true;
  }
  if (
    transcript?.latest_item && transcriptItemHasTruncatedOverviewText(transcript.latest_item) ||
    transcript?.items.some(transcriptItemHasTruncatedOverviewText)
  ) {
    return true;
  }
  const sandbox = candidate.runtime.sandbox;
  if (!sandbox) {
    return false;
  }
  if (
    sandbox.logs.length < sandbox.log_refs.length ||
    sandbox.heartbeats.length < sandbox.heartbeat_refs.length ||
    sandbox.command_evidence.length < sandbox.command_evidence_refs.length
  ) {
    return true;
  }
  return sandbox.logs.some((log) => log.lines.some(isRuntimeOverviewTruncatedText)) ||
    sandbox.command_evidence.some((evidence) =>
      isRuntimeOverviewTruncatedText(evidence.stdout) ||
      isRuntimeOverviewTruncatedText(evidence.stderr)
    );
}

export function candidateDetailFetchKey(candidate: CandidateInspectReadModel | null | undefined): string {
  return candidate ? `${candidate.candidate_id}:${candidateNeedsDetailFetch(candidate) ? "overview" : "detail"}` : "none";
}

function transcriptItemHasTruncatedOverviewText(
  item: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number]
): boolean {
  return isRuntimeOverviewTruncatedText(item.label) || isRuntimeOverviewTruncatedText(item.summary);
}

function isRuntimeOverviewTruncatedText(value: string): boolean {
  return value.includes(OPERATOR_RUNTIME_OVERVIEW_TRUNCATED_MARKER) ||
    (value.length > OPERATOR_RUNTIME_TEXT_LIMIT && value.endsWith("..."));
}

function selectedCandidateForState(
  current: AppState,
  selected: CandidateInspectReadModel | null | undefined
): CandidateInspectReadModel | undefined {
  if (
    selected &&
    current.selected?.candidate_id === selected.candidate_id &&
    candidateNeedsDetailFetch(selected) &&
    !candidateNeedsDetailFetch(current.selected)
  ) {
    return mergeSelectedCandidateOverviewWithFullDetail(current.selected, selected);
  }
  return selected ?? undefined;
}

function mergeSelectedCandidateOverviewWithFullDetail(
  fullCandidate: CandidateInspectReadModel,
  overviewCandidate: CandidateInspectReadModel
): CandidateInspectReadModel {
  return {
    ...fullCandidate,
    ...overviewCandidate,
    runtime: {
      ...fullCandidate.runtime,
      ...overviewCandidate.runtime,
      sandbox: mergeSandboxOverviewWithFullDetail(
        fullCandidate.runtime.sandbox,
        overviewCandidate.runtime.sandbox
      ),
      transcript: mergeTranscriptOverviewWithFullDetail(
        fullCandidate.runtime.transcript,
        overviewCandidate.runtime.transcript
      )
    }
  };
}

function mergeTranscriptOverviewWithFullDetail(
  fullTranscript: CandidateInspectReadModel["runtime"]["transcript"],
  overviewTranscript: CandidateInspectReadModel["runtime"]["transcript"]
): CandidateInspectReadModel["runtime"]["transcript"] {
  if (!overviewTranscript) {
    return fullTranscript;
  }
  if (!fullTranscript) {
    return overviewTranscript;
  }
  const items = mergeRecordsByKey(
    fullTranscript.items,
    overviewTranscript.items,
    (item) => item.item_id,
    mergeTranscriptItemOverviewWithFullDetail
  );

  return {
    ...fullTranscript,
    ...overviewTranscript,
    latest_item: overviewTranscript.latest_item
      ? mergeTranscriptLatestItemOverviewWithFullDetail(items, overviewTranscript.latest_item)
      : overviewTranscript.latest_item,
    items
  };
}

function mergeTranscriptLatestItemOverviewWithFullDetail(
  mergedItems: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"],
  latestItem: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number]
) {
  return mergedItems.find((item) => item.item_id === latestItem.item_id) ?? latestItem;
}

function mergeTranscriptItemOverviewWithFullDetail(
  fullItem: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number],
  overviewItem: NonNullable<CandidateInspectReadModel["runtime"]["transcript"]>["items"][number]
) {
  return {
    ...fullItem,
    ...overviewItem,
    label: isRuntimeOverviewTruncatedText(overviewItem.label) ? fullItem.label : overviewItem.label,
    summary: isRuntimeOverviewTruncatedText(overviewItem.summary) ? fullItem.summary : overviewItem.summary
  };
}

function mergeSandboxOverviewWithFullDetail(
  fullSandbox: CandidateInspectReadModel["runtime"]["sandbox"],
  overviewSandbox: CandidateInspectReadModel["runtime"]["sandbox"]
): CandidateInspectReadModel["runtime"]["sandbox"] {
  if (!overviewSandbox) {
    return fullSandbox;
  }
  if (!fullSandbox) {
    return overviewSandbox;
  }
  return {
    ...fullSandbox,
    ...overviewSandbox,
    logs: mergeRecordsByKey(
      fullSandbox.logs,
      overviewSandbox.logs,
      (log) => refKey(log.log_ref),
      mergeSandboxLogOverviewWithFullDetail
    ),
    heartbeats: mergeRecordsByKey(
      fullSandbox.heartbeats,
      overviewSandbox.heartbeats,
      (heartbeat) => refKey(heartbeat.heartbeat_ref),
      (_fullHeartbeat, overviewHeartbeat) => overviewHeartbeat
    ),
    command_evidence: mergeRecordsByKey(
      fullSandbox.command_evidence,
      overviewSandbox.command_evidence,
      (evidence) => refKey(evidence.command_evidence_ref),
      mergeSandboxCommandEvidenceOverviewWithFullDetail
    )
  };
}

function mergeSandboxLogOverviewWithFullDetail(
  fullLog: NonNullable<CandidateInspectReadModel["runtime"]["sandbox"]>["logs"][number],
  overviewLog: NonNullable<CandidateInspectReadModel["runtime"]["sandbox"]>["logs"][number]
) {
  return {
    ...fullLog,
    ...overviewLog,
    lines: mergeRuntimeTextLines(fullLog.lines, overviewLog.lines)
  };
}

function mergeSandboxCommandEvidenceOverviewWithFullDetail(
  fullEvidence: NonNullable<CandidateInspectReadModel["runtime"]["sandbox"]>["command_evidence"][number],
  overviewEvidence: NonNullable<CandidateInspectReadModel["runtime"]["sandbox"]>["command_evidence"][number]
) {
  return {
    ...fullEvidence,
    ...overviewEvidence,
    stdout: mergeRuntimeText(fullEvidence.stdout, overviewEvidence.stdout),
    stderr: mergeRuntimeText(fullEvidence.stderr, overviewEvidence.stderr)
  };
}

function mergeRuntimeTextLines(fullLines: string[], overviewLines: string[]): string[] {
  if (!overviewLines.some(isRuntimeOverviewTruncatedText)) {
    return overviewLines;
  }
  const mergedLines = [...fullLines];
  for (const line of overviewLines) {
    if (isRuntimeOverviewTruncatedText(line) || mergedLines.includes(line)) {
      continue;
    }
    mergedLines.push(line);
  }
  return mergedLines;
}

function mergeRuntimeText(fullText: string, overviewText: string): string {
  return isRuntimeOverviewTruncatedText(overviewText) && !isRuntimeOverviewTruncatedText(fullText)
    ? fullText
    : overviewText;
}

function mergeRecordsByKey<T>(
  fullRecords: T[],
  overviewRecords: T[],
  keyFor: (record: T) => string,
  mergeRecord: (fullRecord: T, overviewRecord: T) => T
): T[] {
  const mergedRecords = [...fullRecords];
  const indexByKey = new Map<string, number>();
  fullRecords.forEach((record, index) => {
    indexByKey.set(keyFor(record), index);
  });
  for (const overviewRecord of overviewRecords) {
    const key = keyFor(overviewRecord);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, mergedRecords.length);
      mergedRecords.push(overviewRecord);
      continue;
    }
    mergedRecords[existingIndex] = mergeRecord(mergedRecords[existingIndex]!, overviewRecord);
  }
  return mergedRecords;
}

function refKey(ref: { record_kind: string; id: string }): string {
  return `${ref.record_kind}:${ref.id}`;
}

export function applyOperatorRefreshState(
  current: AppState,
  operator: OperatorReadModel,
  selected: CandidateInspectReadModel | null | undefined = operator.selected_candidate ?? current.selected,
  tradingReviewCandidate?: CandidateInspectReadModel
): AppState {
  const tradingResearchRuntime = buildTradingResearchRuntimeFromOperator(operator);
  const selectedTradingResearchAgent = tradingResearchRuntime.available_agents.includes(
    current.selectedTradingResearchAgent
  )
    ? current.selectedTradingResearchAgent
    : tradingResearchRuntime.default_agent;

  return {
    ...current,
    operator,
    candidateArena: operator.candidate_arena,
    tradingResearchRuntime,
    selectedTradingResearchAgent,
    selected: selectedCandidateForState(current, selected),
    tradingReviewCandidate
  };
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
  const selectedCandidateIdRef = useRef<string | undefined>(undefined);
  const selectedCandidateDetailFetchKey = candidateDetailFetchKey(state.selected);

  useEffect(() => {
    selectedCandidateIdRef.current = state.selected?.candidate_id;
  }, [state.selected?.candidate_id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          candidates,
          executionModes,
          tradingGatewayEnvironment,
          operator
        ] = await Promise.all([
          fetchCandidateSummaries(),
          fetchTradingExecutionModeContracts(),
          fetchTradingGatewayEnvironment(),
          fetchOperatorReadModel()
        ]);
        const tradingResearchRuntime = buildTradingResearchRuntimeFromOperator(operator);
        const first = candidates[0];
        const selected = operator.selected_candidate ?? (first ? await fetchCandidate(first.candidate_id) : undefined);
        const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
        const replayRuns = selected ? await fetchReplayRunEvidence(selected.candidate_id) : [];
        const replayRunSelection = selected
          ? await fetchReplayRunSelection(selected.candidate_id, replayRuns)
          : {};
        if (!cancelled) {
          selectedCandidateIdRef.current = selected?.candidate_id;
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
            tradingReviewCandidate,
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
    const refreshIntervalId = typeof window === "undefined"
      ? undefined
      : window.setInterval(() => {
          void refreshOperatorReadModel();
        }, OPERATOR_REFRESH_INTERVAL_MS);

    async function refreshOperatorReadModel() {
      try {
        const operator = await fetchOperatorReadModel();
        const selected = operator.selected_candidate ?? (
          operator.selected_candidate_id &&
            operator.selected_candidate_id !== selectedCandidateIdRef.current
            ? await fetchCandidate(operator.selected_candidate_id)
            : undefined
        );
        const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
        const selectedChanged = Boolean(
          selected?.candidate_id &&
          selected.candidate_id !== selectedCandidateIdRef.current
        );
        const replayRuns = selectedChanged && selected
          ? await fetchReplayRunEvidence(selected.candidate_id)
          : undefined;
        const replayRunSelection = selectedChanged && selected && replayRuns
          ? await fetchReplayRunSelection(selected.candidate_id, replayRuns)
          : undefined;
        if (!cancelled) {
          if (selectedChanged) {
            selectedCandidateIdRef.current = selected?.candidate_id;
          }
          setState((current) => ({
            ...applyOperatorRefreshState(
              current,
              operator,
              selected ?? current.selected,
              tradingReviewCandidate
            ),
            ...(selectedChanged
              ? {
                  replayRuns: replayRuns ?? [],
                  selectedReplayRunId: replayRunSelection?.selectedReplayRunId,
                  replayRunDetail: replayRunSelection?.replayRunDetail,
                  replayRunComparison: replayRunSelection?.replayRunComparison,
                  replayRunComparisonBaselineId: replayRunSelection?.replayRunComparisonBaselineId,
                  replayRunValidationState: replayRunSelection?.replayRunValidationState,
                  replayRunError: undefined,
                  replayRunMessage: undefined
                }
              : {})
          }));
        }
      } catch (_error) {
        // Keep the last known operator read model visible; command actions surface explicit errors.
      }
    }

    return () => {
      cancelled = true;
      if (refreshIntervalId !== undefined) {
        window.clearInterval(refreshIntervalId);
      }
    };
  }, []);

  useEffect(() => {
    const selectedCandidate = state.selected;
    if (operatorView !== "details" || !selectedCandidate || !candidateNeedsDetailFetch(selectedCandidate)) {
      return;
    }
    const selectedCandidateId = selectedCandidate.candidate_id;
    let cancelled = false;

    async function loadSelectedCandidateDetail() {
      try {
        const selected = await fetchCandidate(selectedCandidateId);
        if (cancelled) {
          return;
        }
        setState((current) => current.selected?.candidate_id === selected.candidate_id
          ? {
              ...current,
              selected
            }
          : current);
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "Unknown candidate detail error"
          }));
        }
      }
    }

    void loadSelectedCandidateDetail();
    return () => {
      cancelled = true;
    };
  }, [operatorView, selectedCandidateDetailFetchKey]);

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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
      const replayRuns = await fetchReplayRunEvidence(selected.candidate_id);
      const replayRunSelection = await fetchReplayRunSelection(selected.candidate_id, replayRuns);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
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
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, state.selected);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
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
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        tradingReviewCandidate,
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
      const tradingReviewCandidate = await fetchTradingReviewCandidate(operator, selected);
      setState((current) => ({
        ...current,
        operator,
        candidateArena: operator.candidate_arena,
        selected,
        tradingReviewCandidate,
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

  const sidebarCandidates: OperatorSidebarCandidate[] = state.candidates.map((candidate) => ({
    candidateId: candidate.candidate_id,
    displayName: candidate.display_name
  }));

  return (
    <OperatorAppShell
      sidebar={(
        <OperatorSidebar
          activeView={operatorView}
          candidates={sidebarCandidates}
          loading={state.loading && state.candidates.length === 0}
          selectedCandidateId={state.selected?.candidate_id}
          selectedCandidateName={state.selected?.display_name}
          onSelectCandidate={(candidateId) => void selectCandidate(candidateId)}
          onSelectView={setOperatorView}
        />
      )}
    >
      <OperatorAppHeader
        title="Ouroboros Operator"
        subtitle={operatorView === "trading"
          ? "Trading"
          : operatorView === "arena"
            ? "Arena"
            : operatorView === "research"
              ? "Research"
              : "System details"}
      />
          <OperatorAppMain>
            {state.loading && (
              <OperatorPanel aria-label="Loading read model">
                <OperatorSectionHeader
                  title="Loading read model"
                  description="Loading fixture read model..."
                />
              </OperatorPanel>
            )}
            {state.error && (
              <OperatorPanel aria-label="Read model error">
                <OperatorSectionHeader
                  title="Read model error"
                  description={state.error}
                />
              </OperatorPanel>
            )}
            {!state.loading && !state.error && state.selected && (
              <CandidateDetail
                activeView={operatorView}
                onActiveViewChange={setOperatorView}
                candidate={state.selected}
                tradingReviewCandidate={state.tradingReviewCandidate}
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
          </OperatorAppMain>
    </OperatorAppShell>
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
  const paperBoardSectionEntries: ArenaPaperBoardEntry[] = paperBoardEntries.slice(0, 6).map((entry) => ({
    evaluationId: entry.evaluation_id,
    displayName: entry.display_name,
    rankLabel: `#${entry.rank}`,
    status: entry.status,
    qualificationStatus: entry.qualification_status,
    tone: entry.profit_loss.net_revenue_usdt >= 0 ? "counted" : "neutral",
    paperNet: formatUsdt(entry.profit_loss.net_revenue_usdt),
    paperReturn: formatPercent(entry.profit_loss.net_return_pct),
    trend: formatPaperBoardTrend(entry),
    blockerDensity: formatPaperBoardBlockerDensity(entry),
    evidenceWindow: `${entry.evidence_window.observation_count} obs / ${entry.evidence_window.failed_observation_count} failed / ${entry.evidence_window.elapsed_ms}ms`,
    qualificationReasons: entry.qualification_reasons.length ? entry.qualification_reasons.join(", ") : "qualified",
    promotionGate: entry.promotion_gate_status,
    runnerStatus: entry.runner_status,
    observationCount: String(entry.observation_count),
    marketProvenance: `${entry.market_data_source}${entry.latest_public_execution_source ? ` / ${entry.latest_public_execution_source}` : ""}`,
    fillQuality: `${entry.latest_fill_status ?? "none"} / open ${entry.open_order_count}`
  }));
  const arenaLeaderboardEntries: ArenaLeaderboardEntry[] = arena.leaderboard.map((entry) => ({
    candidateId: entry.candidate_id,
    rankLabel: `#${entry.rank}`,
    displayName: entry.display_name,
    status: entry.status,
    statusVariant: entry.profit_loss.net_revenue_usdt >= 0 ? "default" : "outline",
    direction: entry.direction_kind,
    parent: entry.parent_candidate_id ?? "none",
    researchPreflightNet: formatUsdt(entry.profit_loss.net_revenue_usdt),
    researchPreflightReturn: formatPercent(entry.profit_loss.net_return_pct),
    latestFinding: entry.latest_finding
  }));
  const selectedProvider = researcherProvider?.selected_provider;
  const selectedAgentProfile = agentProfiles.find((profile) => profile.profile_id === selectedProvider);
  const arenaAgentProviderProfiles: ArenaAgentProviderProfile[] = agentProfiles.slice(0, 3).map((profile) => ({
    id: profile.profile_id,
    label: profile.label,
    value: `${profile.status} / ${profile.provider}`
  }));
  const arenaAgentProviderOptions: ArenaAgentProviderOption[] = (researcherProvider?.available_providers ?? []).map((provider) => ({
    provider,
    selectableProvider: isSelectableResearcherProvider(provider) ? provider : undefined,
    selected: provider === selectedProvider,
    disabled: actionPending
  }));
  const arenaResearchProviderSummary = `Provider ${researcherProvider?.selected_provider ?? "unknown"} ${selectedAgentProfile?.status ?? "unknown"}; live authority disabled; ${arena.active_researchers.length} researchers available.`;
  const arenaMetricStripItems: ArenaMetricStripItem[] = [
    {
      label: "Arena runner",
      value: arena.runner_status,
      detail: `${arena.tick_count} ticks`
    },
    {
      label: "ResearchPreflight net",
      value: leader ? formatUsdt(leader.profit_loss.net_revenue_usdt) : "none",
      detail: "revenue - cost"
    },
    {
      label: "ResearchPreflight return",
      value: leader ? formatPercent(leader.profit_loss.net_return_pct) : "none",
      detail: "secondary rank signal"
    }
  ];
  const arenaCommandLogEntries: ArenaCommandLogEntry[] = latestCommands.slice(0, 5).map((command) => {
    const remediation = commandRemediation(command);

    return {
      id: command.command_id,
      title: command.command_kind,
      status: command.error ? `${command.status} / ${command.error}` : command.status,
      remediationGroup: remediation?.group,
      visibleSurface: remediation?.surface,
      nextStep: remediation?.remediation,
      authority: remediation?.authority_status
    };
  });
  const arenaLatestTickSummary: ArenaLatestTickSummary | undefined = latestTick
    ? {
        tickId: latestTick.tick_id,
        status: latestTick.status,
        generated: formatCandidateArenaTickGenerated(latestTick),
        directions: formatCandidateArenaTickDirections(latestTick),
        efficiency: formatCandidateArenaTickEfficiency(latestTick)
      }
    : undefined;
  const paperRunnerActive = selectedPaperTradingEvaluation?.runner_active === true;
  const paperRunnerStatus = selectedPaperTradingEvaluation
    ? paperTradingRunnerStatus(selectedPaperTradingEvaluation)
    : "not started";
  const paperStartActionLabel = paperRunnerStatus === "needs resume"
    ? "Resume paper trading"
    : "Start paper trading";
  const selectedCandidateIdentity = selectedCandidateId
    ?? selectedCandidate?.candidate_id
    ?? selectedEntry?.candidate_id
    ?? "unknown";
  const arenaSelectedCandidateFields: ArenaSelectedCandidateField[] = [
    { label: "Direction", value: selectedDirection },
    { label: "Parent", value: selectedParent ?? "none" },
    { label: "System Code", value: selectedSystemCode ? formatRef(selectedSystemCode) : "load candidate" },
    {
      label: "ResearchPreflight",
      value: selectedLineage?.evidence
        ? `${selectedLineage.evidence.evaluation_status} ${formatScore(selectedLineage.evidence.evaluation_score)}`
        : selectedStatus
    },
    {
      label: "Research leaderboard",
      value: selectedProfitLoss
        ? `${formatUsdt(selectedProfitLoss.net_revenue_usdt)} / ${formatPercent(selectedProfitLoss.net_return_pct)}`
        : "not ranked"
    },
    { label: "Paper Trading Evaluation", value: selectedPaperEvaluationStatus },
    {
      label: "Paper runner",
      value: selectedPaperTradingEvaluation
        ? formatPaperRunnerSummary(selectedPaperTradingEvaluation)
        : "not started"
    },
    {
      label: "Paper score",
      value: selectedPaperTradingEvaluation
        ? `${formatUsdt(selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt)} / ${selectedPaperTradingEvaluation.observation_count} observations`
        : "not started"
    },
    { label: "Paper market snapshot", value: formatPaperMarketSnapshotSummary(selectedPaperMarketSnapshot) },
    { label: "Gateway market data", value: formatGatewayMarketDataSummary(selectedPaperTradingEvaluation) },
    {
      label: "Public execution evidence",
      value: selectedPaperExecutionSnapshot
        ? formatPublicExecutionEvidenceSummary(selectedPaperExecutionSnapshot)
        : "not observed"
    },
    {
      label: "Public order book evidence",
      value: formatPublicOrderBookEvidenceSummary(selectedPaperExecutionSnapshot)
    },
    { label: "Paper decision", value: formatPaperDecisionSummary(selectedPaperDecision) },
    {
      label: "Paper account",
      value: selectedPaperAccount
        ? `equity ${formatUsdt(Number(selectedPaperAccount.equity_usdt))} / ${selectedPaperAccount.position.side} ${selectedPaperAccount.position.quantity} BTCUSDT / open ${selectedPaperAccount.open_order_count}`
        : "not observed"
    },
    {
      label: "Paper fill",
      value: selectedPaperFill ? formatPaperFillSummary(selectedPaperFill) : "none"
    },
    ...(selectedPaperTradingEvaluation?.latest_failure || selectedPaperTradingEvaluation?.latest_failure_reason
      ? [{ label: "Paper failure", value: formatPaperFailure(selectedPaperTradingEvaluation) }]
      : []),
    { label: "Paper evidence", value: selectedPaperEvidenceStatus },
    { label: "Trading Run", value: selectedTradingRunStatus },
    { label: "Latest finding", value: selectedFinding },
    {
      label: "Candidate lineage",
      value: selectedLineage?.source
        ? `${selectedLineage.source.trading_system_id} -> ${selectedCandidateIdentity}`
        : `${selectedParent ?? "none"} -> ${selectedCandidateIdentity}`
    },
    { label: "Selected candidate authority", value: selectedAuthority },
    ...(selectedLedgerSummary?.latest_order_request
      ? [{ label: "OrderRequest", value: formatLedgerOrderRequestSummary(selectedLedgerSummary) }]
      : []),
    ...(selectedLedgerSummary?.latest_gateway_result
      ? [{ label: "GatewayResult", value: selectedLedgerSummary.latest_gateway_result.decision_outcome }]
      : []),
    ...(selectedLedgerSummary?.latest_execution_result
      ? [{ label: "ExecutionResult", value: selectedLedgerSummary.latest_execution_result.status }]
      : [])
  ];
  return (
    <OperatorWorkspacePanel aria-label="Candidate Arena cockpit">
      <OperatorSectionHeader
        eyebrow="Operator cockpit"
        title="Candidate Arena"
        description={leader
          ? `${leader.display_name} leads by ${formatUsdt(leader.profit_loss.net_revenue_usdt)} net revenue.`
          : "Researchers add TradingSystem candidates and rank them by revenue minus costs."}
        actions={(
          <>
            <Badge variant={arena.runner_status === "running" ? "default" : "secondary"}>{arena.runner_status}</Badge>
            <Badge variant="secondary">{researcherProvider?.selected_provider ?? "provider pending"}</Badge>
            <Badge variant="secondary">not_live</Badge>
          </>
        )}
      />
      <OperatorWorkspaceBody>
        <ArenaCommandBarSection
          researchProviderSummary={arenaResearchProviderSummary}
          startDisabled={actionPending}
          stopDisabled={actionPending}
          tickDisabled={actionPending}
          onStart={onStart}
          onStop={onStop}
          onTick={onTick}
        />
        <ArenaMetricStripSection metrics={arenaMetricStripItems} />
        <ArenaPaperBoardSection entries={paperBoardSectionEntries} />
        <OperatorWorkspaceSplit
          inspectorLabel="Candidate Arena inspector"
          inspector={(
            <>
              {inspectorVisible && (
                <ArenaSelectedCandidateSection
                  description={selectedCandidate?.display_name ?? selectedEntry?.display_name ?? "No Trading System selected"}
                  fields={arenaSelectedCandidateFields}
                  paperRunnerActive={paperRunnerActive}
                  runningPaperTrading={runningPaperTrading}
                  paperStartActionLabel={paperStartActionLabel}
                  startPaperDisabled={!onStartPaperTrading || runningPaperTrading || !selectedCandidate}
                  observePaperDisabled={!onObservePaperTrading || runningPaperTrading || !selectedCandidate}
                  stopPaperDisabled={!onStopPaperTrading || runningPaperTrading || !selectedCandidate}
                  onStartPaperTrading={onStartPaperTrading}
                  onObservePaperTrading={onObservePaperTrading}
                  onStopPaperTrading={onStopPaperTrading}
                />
              )}
              <ArenaAgentProviderSection
                researcher={researcherProvider?.selected_provider ?? "not selected"}
                selectedStatus={selectedAgentProfile?.status ?? "missing"}
                available={researcherProvider?.available_providers.join(", ") ?? "unknown"}
                failure={selectedAgentProfile?.failure_reason}
                profiles={arenaAgentProviderProfiles}
                providerOptions={arenaAgentProviderOptions}
                setupDisabled={actionPending || !selectedProvider || !onSetupAgentProvider}
                probeDisabled={actionPending || !selectedProvider || !onProbeAgentProvider}
                loginDisabled={actionPending || !selectedProvider || !onStartAgentProviderLogin}
                onSelectProvider={onSelectResearcherProvider}
                onSetup={selectedProvider && onSetupAgentProvider ? () => onSetupAgentProvider(selectedProvider) : undefined}
                onProbe={selectedProvider && onProbeAgentProvider ? () => onProbeAgentProvider(selectedProvider) : undefined}
                onLogin={selectedProvider && onStartAgentProviderLogin
                  ? () => onStartAgentProviderLogin(selectedProvider)
                  : undefined}
              />
              <ArenaCommandLogSection entries={arenaCommandLogEntries} />
              <ArenaLatestTicksSection tick={arenaLatestTickSummary} />
            </>
          )}
        >
          <ArenaLeaderboardSection
            entries={arenaLeaderboardEntries}
            selectedCandidateId={selectedEntry?.candidate_id}
            onSelectCandidate={onSelectCandidate}
          />
        </OperatorWorkspaceSplit>
        <OperatorStatusStack
          messages={operatorStatusMessages(
            message
              ? { id: "arena-message", value: message }
              : undefined,
            error
              ? { id: "arena-error", tone: "error", value: error }
              : undefined
          )}
        />
      </OperatorWorkspaceBody>
    </OperatorWorkspacePanel>
  );
}

function TradingPromotionBoundaryCard({
  promotion,
  tradingReview,
  paperBoardEntry,
  selectedCandidate,
  tradingReviewCandidate,
  selectedPaperTradingEvaluation,
  onSelectCandidate,
  onPromoteTradingCandidate,
  runningTradingPromotion
}: {
  promotion?: OperatorReadModel["trading_promotion"];
  tradingReview?: OperatorReadModel["trading_review"];
  paperBoardEntry?: PaperTradingBoardReadModel["entries"][number];
  selectedCandidate: CandidateInspectReadModel;
  tradingReviewCandidate?: CandidateInspectReadModel;
  selectedPaperTradingEvaluation?: PaperTradingEvaluationReadModel;
  onSelectCandidate?: (candidateId: string) => void;
  onPromoteTradingCandidate?: () => void;
  runningTradingPromotion: boolean;
}) {
  const hasPaperEvaluation = Boolean(selectedPaperTradingEvaluation?.evaluation_id);
  const selectedIsPromoted = tradingReview?.selected_matches_trading_review ??
    promotion?.candidate_id === selectedCandidate.candidate_id;
  const activePromotion = selectedIsPromoted ? promotion : undefined;
  const activeReviewCandidateId = tradingReview?.active_candidate_id ?? promotion?.candidate_id;
  const activeReviewLabel = tradingReview?.display_name ??
    tradingReviewCandidate?.display_name ??
    promotion?.display_name ??
    activeReviewCandidateId ??
    "No Trading review candidate";
  const paperQualificationStatus = tradingReview?.paper_qualification_status
    ?? activePromotion?.paper_qualification_status
    ?? paperBoardEntry?.qualification_status;
  const paperQualificationReasons = tradingReview?.paper_qualification_reasons
    ?? activePromotion?.paper_qualification_reasons
    ?? paperBoardEntry?.qualification_reasons
    ?? [];
  const selectedPromotionQualificationStatus = paperBoardEntry?.qualification_status;
  const paperEvidenceWindow = tradingReview?.paper_evidence_window ??
    activePromotion?.paper_evidence_window ??
    paperBoardEntry?.evidence_window;
  const paperProfitLoss = tradingReview?.paper_profit_loss ??
    activePromotion?.paper_profit_loss ??
    paperBoardEntry?.profit_loss;
  const runnerStatus = tradingReview?.runner_status ?? activePromotion?.runner_status ?? paperBoardEntry?.runner_status;
  const reviewMismatch = tradingReview?.status === "promoted_for_trading_review" &&
    !tradingReview.selected_matches_trading_review;
  const promotionCondition = reviewMismatch
    ? selectedPromotionQualificationStatus === "qualified"
      ? "selected qualified Arena candidate can replace active Trading review target"
      : "selected Arena candidate is not the active Trading review target"
    : paperQualificationStatus
      ? `${paperQualificationStatus}${paperQualificationReasons.length ? ` / ${paperQualificationReasons.join(", ")}` : ""}`
      : hasPaperEvaluation
        ? "paper evidence present"
        : "paper evidence required";
  const promotionReady = selectedPromotionQualificationStatus === "qualified";
  const promotionBoundaryBadges: TradingPromotionBoundaryBadge[] = [
    {
      label: tradingReview?.status ?? activePromotion?.status ?? "not_promoted",
      variant: tradingReview?.status === "promoted_for_trading_review" ? "default" : "secondary"
    },
    {
      label: tradingReview?.readiness_status ??
        activePromotion?.readiness_status ??
        tradingPromotionReadinessLabel(paperQualificationStatus),
      variant: "secondary"
    },
    {
      label: reviewMismatch
        ? "Arena selection differs"
        : selectedIsPromoted
          ? "active target"
          : "candidate review",
      variant: reviewMismatch ? "destructive" : "secondary"
    },
    {
      label: "live disabled",
      variant: "secondary"
    }
  ];
  const promotionBoundaryFields: TradingPromotionBoundaryField[] = [
    { label: "Trading review target", value: activeReviewLabel },
    {
      label: "Arena selected candidate",
      value: `${selectedCandidate.display_name}${selectedIsPromoted ? " / active Trading review" : reviewMismatch ? " / not Trading review" : ""}`
    },
    {
      label: "Paper qualification",
      value: paperQualificationStatus ?? selectedPaperTradingEvaluation?.status ?? "paper_required"
    },
    {
      label: "Qualification reasons",
      value: paperQualificationReasons.length
        ? paperQualificationReasons.join(", ")
        : paperQualificationStatus === "qualified"
          ? "qualified"
          : "paper_required"
    },
    {
      label: "Paper net",
      value: paperProfitLoss
        ? formatUsdt(paperProfitLoss.net_revenue_usdt)
        : selectedPaperTradingEvaluation
          ? formatUsdt(selectedPaperTradingEvaluation.profit_loss.net_revenue_usdt)
          : "not evaluated"
    },
    {
      label: "Evidence window",
      value: paperEvidenceWindow
        ? `${paperEvidenceWindow.observation_count} obs / ${paperEvidenceWindow.failed_observation_count} failed`
        : selectedPaperTradingEvaluation
          ? `${selectedPaperTradingEvaluation.observation_count} observations`
          : "not started"
    },
    { label: "Paper runner", value: runnerStatus ?? "not promoted" },
    { label: "Promotion condition", value: promotionCondition },
    {
      label: "Review authority",
      value: tradingReview?.live_disabled_reason ?? activePromotion?.live_disabled_reason ?? "mlp_paper_only"
    }
  ];
  return (
    <TradingPromotionBoundarySection
      badges={promotionBoundaryBadges}
      fields={promotionBoundaryFields}
      showOpenActiveTarget={reviewMismatch && Boolean(activeReviewCandidateId)}
      openActiveTargetDisabled={!onSelectCandidate}
      promoteDisabled={runningTradingPromotion || !hasPaperEvaluation || !promotionReady}
      promoteLabel={runningTradingPromotion ? "Moving" : reviewMismatch ? "Replace Trading review target" : "Move to Trading review"}
      onOpenActiveTarget={activeReviewCandidateId && onSelectCandidate
        ? () => onSelectCandidate(activeReviewCandidateId)
        : undefined}
      onPromoteTradingCandidate={onPromoteTradingCandidate}
    />
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

function formatTradingReviewRunnerSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.runner.runner_status ?? (packet.runner.runner_active ? "active" : "unknown"),
    packet.runner.trading_run_status ? `run ${packet.runner.trading_run_status}` : undefined,
    packet.runner.last_observed_at ? `last ${formatCompactDateTime(packet.runner.last_observed_at)}` : undefined,
    packet.runner.next_observation_at ? `next ${formatCompactDateTime(packet.runner.next_observation_at)}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewSubjectSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.subject.display_name ?? packet.subject.candidate_id ?? "no Trading review target",
    packet.subject.promoted_at ? `promoted ${formatCompactDateTime(packet.subject.promoted_at)}` : undefined,
    `selected ${packet.subject.selected_matches_trading_review ? "matches" : "differs"}`
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewEvidenceWindowSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const window = packet.evidence_quality.evidence_window;
  if (!window) {
    return "paper required";
  }
  return [
    `${window.observation_count} obs`,
    `${window.failed_observation_count} failed`,
    `${window.elapsed_ms}ms`,
    window.first_observed_at ? `first ${formatCompactDateTime(window.first_observed_at)}` : undefined,
    window.last_observed_at ? `last ${formatCompactDateTime(window.last_observed_at)}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewLedgerSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.ledger.evidence_status,
    packet.ledger.ledger_chain_complete ? "chain complete" : "chain incomplete",
    packet.ledger.latest_order_request_id ? `order ${packet.ledger.latest_order_request_id}` : undefined,
    packet.ledger.latest_gateway_outcome ? `gateway ${packet.ledger.latest_gateway_outcome}` : undefined,
    packet.ledger.latest_execution_status ? `execution ${packet.ledger.latest_execution_status}` : undefined,
    packet.ledger.latest_decision_kind ? `decision ${packet.ledger.latest_decision_kind}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewAuthoritySummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const noAuthority = packet.authority.no_authority;
  return [
    packet.authority.authority_status,
    packet.authority.live_disabled_reason,
    `live_exchange=${String(noAuthority.live_exchange_authority)}, private_read=${String(noAuthority.private_read_authority)}, order_submission=${String(noAuthority.order_submission_authority)}, credentials=${String(noAuthority.credentials)}`
  ].join(" / ");
}

function formatTradingReviewBlockerSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  if (packet.evidence_quality.blocker_groups.length === 0) {
    return "none";
  }
  return packet.evidence_quality.blocker_groups
    .map((group) => [
      group.group_kind,
      group.severity,
      group.blockers.join(", "),
      group.summary,
      `next ${group.next_action}`
    ].join(" / "))
    .join("; ");
}

function formatTradingReviewRiskSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.risk.account ? `equity ${packet.risk.account.equity_usdt} USDT` : "account missing",
    packet.risk.account ? `available ${packet.risk.account.available_balance_usdt} USDT` : undefined,
    packet.risk.position
      ? `position ${packet.risk.position.side} ${packet.risk.position.quantity} ${packet.risk.position.symbol} notional ${packet.risk.position.notional_usdt}`
      : "position missing",
    `open ${packet.risk.open_order_count}`,
    `fill ${packet.risk.latest_fill_status ?? "none"}`,
    packet.risk.latest_failure || packet.risk.latest_failure_reason
      ? `failure ${formatPaperFailure(packet.risk)}`
      : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewLineageSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  return [
    packet.lineage.lineage_status,
    packet.lineage.direction_kind,
    packet.lineage.parent_candidate_id ? `parent ${packet.lineage.parent_candidate_id}` : undefined,
    packet.lineage.latest_finding,
    packet.lineage.evaluation_status ? `evaluation ${packet.lineage.evaluation_status}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewLineageLearningSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const learning = packet.lineage.paper_board_learning;
  if (!learning) {
    return "none";
  }
  return [
    learning.rank ? `rank #${learning.rank}` : "unranked",
    learning.qualification_status,
    `${learning.net_revenue_usdt} net USDT`,
    `${learning.observation_count} obs`,
    learning.top_blocker ? `top ${learning.top_blocker}` : undefined,
    `next ${learning.next_research_focus}`
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewProvenanceSummary(
  packet: OperatorReadModel["trading_review"]["review_packet"]
): string {
  const orderBook = packet.provenance.order_book;
  return [
    packet.provenance.market_data_source ?? "no market",
    packet.provenance.latest_public_execution_source ?? "no public execution",
    packet.provenance.latest_public_execution_freshness,
    packet.provenance.latest_public_execution_ws_connected === true ? "WS connected" : undefined,
    packet.provenance.latest_public_execution_ws_connected === false ? "WS disconnected" : undefined,
    packet.provenance.latest_public_execution_rest_fallback_used ? "REST fallback" : undefined,
    packet.provenance.latest_public_execution_stream_marker
      ? `marker ${packet.provenance.latest_public_execution_stream_marker}`
      : undefined,
    `fill ${packet.provenance.latest_fill_status ?? "none"}`,
    orderBook ? formatTradingReviewOrderBookSummary(orderBook) : "order book missing"
  ].filter(Boolean).join(" / ");
}

function formatTradingReviewOrderBookSummary(
  orderBook: NonNullable<OperatorReadModel["trading_review"]["review_packet"]["provenance"]["order_book"]>
): string {
  return [
    `order book ${orderBook.sync_status}`,
    orderBook.last_update_id ? `update ${orderBook.last_update_id}` : undefined,
    orderBook.previous_final_update_id ? `prev ${orderBook.previous_final_update_id}` : undefined,
    orderBook.depth_level_count !== undefined ? `depth ${orderBook.depth_level_count}` : undefined,
    orderBook.gap_detected ? "gap recovered" : undefined
  ].filter(Boolean).join(" ");
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

function formatPaperMarketSnapshotSummary(
  snapshot?: PaperTradingEvaluationReadModel["latest_market_snapshot"]
): string {
  return snapshot
    ? `${snapshot.symbol} ${formatUsdt(snapshot.price)} @ ${formatCompactDateTime(snapshot.observed_at)}`
    : "not observed";
}

function formatGatewayMarketDataSummary(evaluation?: PaperTradingEvaluationReadModel): string {
  if (!evaluation) {
    return "not observed";
  }
  const snapshot = evaluation.latest_market_snapshot;
  return [
    evaluation.market_data_source,
    snapshot?.source_priority,
    snapshot?.rest_fallback_used ? "REST fallback" : undefined,
    snapshot?.ws_connected === true ? "WS connected" : undefined,
    snapshot?.ws_connected === false ? "WS disconnected" : undefined
  ].filter(Boolean).join(" / ");
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

function formatPublicOrderBookEvidenceSummary(
  snapshot?: PaperTradingEvaluationReadModel["latest_public_execution_snapshot"]
): string {
  const orderBook = snapshot?.order_book;
  return orderBook
    ? `${orderBook.sync_status} / update ${orderBook.last_update_id ?? "unknown"}${orderBook.gap_detected ? " / gap recovered" : ""}`
    : "not observed";
}

function formatPaperFillSummary(
  fill: NonNullable<PaperTradingEvaluationReadModel["latest_fill"]>
): string {
  return [
    `${fill.fill_status} ${fill.fill_quantity} @ ${fill.fill_price}`,
    fill.source_trade_id ? `trade ${fill.source_trade_id}` : undefined
  ].filter(Boolean).join(" / ");
}

function formatPaperFailure(input: {
  latest_failure?: PaperTradingEvaluationReadModel["latest_failure"];
  latest_failure_reason?: string;
}): string {
  if (input.latest_failure) {
    return `${input.latest_failure.failure_kind} / ${input.latest_failure.summary} / next ${input.latest_failure.next_action} / raw ${input.latest_failure.reason}`;
  }
  return input.latest_failure_reason ?? "none";
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
    <OperatorInfoSection
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
    </OperatorInfoSection>
  );
}

export function CandidateDetail({
  activeView = "details",
  onActiveViewChange,
  candidate,
  tradingReviewCandidate,
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
  tradingReviewCandidate?: CandidateInspectReadModel;
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
  const selectedPaperTradingEvaluationWithEvidence = selectedPaperTradingEvaluation?.evaluation_id
    ? selectedPaperTradingEvaluation
    : undefined;
  const selectedPaperEvaluationId = selectedPaperTradingEvaluationWithEvidence?.evaluation_id;
  const selectedPaperBoardEntry = operator?.paper_trading_board.entries.find((entry) =>
    entry.candidate_id === candidate.candidate_id &&
    entry.evaluation_id === selectedPaperEvaluationId
  ) ?? operator?.paper_trading_board.entries.find((entry) =>
    entry.candidate_id === candidate.candidate_id
  );
  const selectedPaperAccount = selectedPaperTradingEvaluationWithEvidence?.paper_account_snapshot;
  const selectedPaperPosition = selectedPaperAccount?.position;
  const selectedPaperFill = selectedPaperTradingEvaluationWithEvidence?.latest_fill;
  const tradingPromotion = operator?.trading_promotion;
  const tradingReview = operator?.trading_review;
  const tradingReviewCandidateId = tradingReview?.active_candidate_id;
  const activeTradingReviewCandidate = tradingReviewCandidate ??
    (tradingReviewCandidateId === candidate.candidate_id ? candidate : undefined);
  const tradingCandidate = activeTradingReviewCandidate ?? candidate;
  const tradingLedger = tradingCandidate.ledger;
  const tradingPublicMarketSurface = tradingCandidate.trading_substrate?.latest_public_market_liveness_surface ?? null;
  const tradingOrderFillSurface = tradingCandidate.trading_substrate?.latest_order_fill_surface ?? null;
  const tradingAccountPositionRiskSurface =
    tradingCandidate.trading_substrate?.latest_account_position_risk_mirror_surface ?? null;
  const tradingPaperTradingEvaluation = tradingReview?.paper_trading_evaluation;
  const tradingPaperTradingEvaluationWithEvidence = tradingPaperTradingEvaluation?.evaluation_id
    ? tradingPaperTradingEvaluation
    : undefined;
  const tradingPaperBoardEntry = tradingReview?.paper_board_entry ?? selectedPaperBoardEntry;
  const tradingPaperAccount = tradingPaperTradingEvaluationWithEvidence?.paper_account_snapshot;
  const tradingPaperPosition = tradingPaperAccount?.position;
  const tradingPaperFill = tradingPaperTradingEvaluationWithEvidence?.latest_fill;
  const tradingPaperMarketSnapshot = tradingPaperTradingEvaluationWithEvidence?.latest_market_snapshot;
  const tradingPaperExecutionSnapshot =
    tradingPaperTradingEvaluationWithEvidence?.latest_public_execution_snapshot;
  const selectedIsTradingReviewCandidate = tradingReview?.selected_matches_trading_review ??
    tradingPromotion?.candidate_id === candidate.candidate_id;
  const tradingReviewMismatch = tradingReview?.status === "promoted_for_trading_review" &&
    !tradingReview.selected_matches_trading_review;
  const tradingReadinessStatus = tradingReview?.readiness_status
    ?? tradingPromotionReadinessLabel(tradingPaperBoardEntry?.qualification_status);
  const tradingQualificationStatus = tradingReview?.paper_qualification_status
    ?? tradingPaperBoardEntry?.qualification_status;
  const tradingQualificationReasons = tradingReview?.paper_qualification_reasons
    ?? tradingPaperBoardEntry?.qualification_reasons
    ?? [];
  const tradingReviewPacket = tradingReview?.review_packet;
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
  const runStatus = tradingCandidate.runtime.runtime_lifecycle_status ?? "registered";
  const ledgerStatus = ledger?.chain_complete
    ? "chain complete"
    : ledger?.has_activity
      ? "incomplete"
      : "not recorded";
  const tradingLedgerStatus = tradingLedger?.chain_complete
    ? "chain complete"
    : tradingLedger?.has_activity
      ? "incomplete"
      : "not recorded";
  const improvementStatus = candidate.improvement?.chain_complete
    ? "chain complete"
    : candidate.improvement?.has_activity
      ? "incomplete"
      : "not recorded";
  const tradingSystemRows = buildTradingSystemRows(candidate, candidates);
  const accountAssetValue = tradingPaperAccount
    ? `${formatBalance(tradingPaperAccount.equity_usdt)} USDT`
    : "not started";
  const accountAssetDetail = tradingPaperAccount
    ? `paper risk account; available ${formatBalance(tradingPaperAccount.available_balance_usdt)} USDT`
    : "Paper account waits for Trading review paper evaluation.";
  const todayPnlValue = tradingPaperTradingEvaluationWithEvidence
    ? formatUsdt(tradingPaperTradingEvaluationWithEvidence.profit_loss.net_revenue_usdt)
    : "not measured";
  const todayPnlDetail = tradingPaperTradingEvaluationWithEvidence
    ? `return ${formatPercent(tradingPaperTradingEvaluationWithEvidence.profit_loss.net_return_pct)}; ${tradingPaperTradingEvaluationWithEvidence.observation_count} observations`
    : "No paper P&L series has been measured yet.";
  const positionValue = tradingPaperPosition
    ? `${tradingPaperPosition.side} ${tradingPaperPosition.quantity}`
    : "no paper position";
  const positionDetail = tradingPaperPosition
    ? `entry ${formatPrice(tradingPaperPosition.average_entry_price)}, mark ${formatPrice(tradingPaperPosition.mark_price)}, open ${tradingPaperAccount?.open_order_count ?? 0}`
    : "Position waits for Trading review paper evaluation.";
  const readinessDetail = tradingQualificationReasons.length
    ? tradingQualificationReasons.join(", ")
    : tradingQualificationStatus ?? "paper_required";
  const operatorDecision = buildOperatorDecision({
    accountPositionRiskSurface: tradingAccountPositionRiskSurface,
    candidate: tradingCandidate,
    ledger: tradingLedger,
    latestReplayRun: tradingCandidate.candidate_id === candidate.candidate_id ? latestReplayRun : undefined,
    orderFillSurface: tradingOrderFillSurface,
    replayRunDetail: tradingCandidate.candidate_id === candidate.candidate_id ? replayRunDetail : undefined,
    tradingReviewPacket
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
  const paperBoardLearning = tradingReviewPacket?.lineage.paper_board_learning;
  const findingClusters = operator?.candidate_arena.finding_clusters ?? candidateArena?.finding_clusters ?? [];
  const tabStateBadges = operatorTabStateBadges(operator);
  const tradingCommandRemediations = (operator?.latest_commands ?? []).flatMap((command) => {
    const remediation = commandRemediation(command);
    return remediation ? [{ command, remediation }] : [];
  });
  const tradingReviewPacketFields: TradingReviewPacketField[] = tradingReviewPacket
    ? [
        {
          label: "Packet verdict",
          value: `${tradingReviewPacket.verdict.severity} / ${tradingReviewPacket.verdict.top_blocker ?? "none"}`
        },
        {
          label: "Subject",
          value: formatTradingReviewSubjectSummary(tradingReviewPacket)
        },
        {
          label: "Paper rank",
          value: tradingReviewPacket.performance.rank
            ? `#${tradingReviewPacket.performance.rank} / ${formatUsdt(tradingReviewPacket.performance.profit_loss?.net_revenue_usdt ?? 0)}`
            : tradingReviewPacket.performance.profit_loss
              ? formatUsdt(tradingReviewPacket.performance.profit_loss.net_revenue_usdt)
              : "not ranked"
        },
        {
          label: "Blocker groups",
          value: tradingReviewPacket.evidence_quality.blocker_groups.length
            ? tradingReviewPacket.evidence_quality.blocker_groups.map((group) => group.group_kind).join(", ")
            : "none"
        },
        { label: "Blocker detail", value: formatTradingReviewBlockerSummary(tradingReviewPacket) },
        { label: "Evidence window", value: formatTradingReviewEvidenceWindowSummary(tradingReviewPacket) },
        { label: "Runner health", value: formatTradingReviewRunnerSummary(tradingReviewPacket) },
        { label: "Ledger", value: formatTradingReviewLedgerSummary(tradingReviewPacket) },
        { label: "Lineage", value: formatTradingReviewLineageSummary(tradingReviewPacket) },
        ...(tradingReviewPacket.lineage.paper_board_learning
          ? [{ label: "Lineage learning", value: formatTradingReviewLineageLearningSummary(tradingReviewPacket) }]
          : []),
        { label: "Packet next action", value: tradingReviewPacket.next_action },
        { label: "Packet authority", value: formatTradingReviewAuthoritySummary(tradingReviewPacket) },
        { label: "Provenance", value: formatTradingReviewProvenanceSummary(tradingReviewPacket) },
        { label: "Risk", value: formatTradingReviewRiskSummary(tradingReviewPacket) }
      ]
    : [];
  const tradingMarketStatus = tradingPublicMarketSurface?.symbol_status ?? "no market data";
  const tradingMarketStatusVariant = tradingPublicMarketSurface?.symbol_status === "TRADING" ? "default" : "secondary";
  const tradingMarketMetrics: TradingSummaryMetric[] = [
    { label: "Mark price", value: formatPrice(tradingPublicMarketSurface?.mark_price) },
    { label: "Index price", value: formatPrice(tradingPublicMarketSurface?.index_price) },
    { label: "Funding", value: tradingPublicMarketSurface?.funding_rate ?? "not connected" },
    { label: "Next funding", value: formatCompactDateTime(tradingPublicMarketSurface?.next_funding_time) }
  ];
  const tradingMarketChartFields: TradingMarketChartField[] = tradingPublicMarketSurface
    ? [
      { label: "Source mode", value: formatMarketSourceMode(tradingPublicMarketSurface) },
      { label: "Freshness / liveness", value: formatMarketFreshness(tradingPublicMarketSurface) },
      { label: "Observed", value: formatCompactDateTime(tradingPublicMarketSurface.observed_at) },
      {
        label: "Boundary",
        value: `${formatAuthorityLabel(tradingPublicMarketSurface.authority_status)} / ${tradingPublicMarketSurface.no_authority_label}`
      }
    ]
    : [
      { label: "Market feed", value: "not connected" },
      { label: "Required boundary", value: "Gateway-owned MarketDataPort" }
    ];
  const tradingMarketChartPoints = tradingPublicMarketSurface
    ? marketChartPoints(tradingPublicMarketSurface)
    : [];
  const tradingMarketInstrumentLabel = tradingPublicMarketSurface
    ? `${tradingPublicMarketSurface.instrument} ${tradingPublicMarketSurface.contract_type}`
    : "Market feed";
  const tradingMarketFooterDetail = tradingPublicMarketSurface
    ? `snapshot only / ${formatFreshnessLabel(tradingPublicMarketSurface.freshness)} / ${formatAuthorityLabel(tradingPublicMarketSurface.authority_status)}`
    : "Gateway-owned MarketDataPort";
  const tradingSafetyBoundaryBadges: TradingSafetyBoundaryBadge[] = [
    { label: "Safety boundary", variant: "outline" },
    { label: "Paper mode", variant: "secondary" },
    { label: "No exchange order", variant: "secondary" },
    { label: "No API credentials", variant: "secondary" },
    { label: formatRuntimeEnvironment(runtimeEnvironment), variant: "secondary" }
  ];
  const paperReviewSummaryMetrics: TradingSummaryMetric[] = [
    {
      label: "Paper risk equity",
      value: accountAssetValue,
      detail: accountAssetDetail,
      className: toneCardClass(tradingPaperAccount ? "good" : "warning")
    },
    {
      label: "Paper score",
      value: todayPnlValue,
      detail: todayPnlDetail,
      className: toneCardClass(tradingPaperTradingEvaluationWithEvidence
        ? tradingPaperTradingEvaluationWithEvidence.profit_loss.net_revenue_usdt >= 0 ? "good" : "danger"
        : "warning")
    },
    {
      label: "Paper risk position",
      value: positionValue,
      detail: positionDetail,
      className: toneCardClass(tradingPaperPosition ? "good" : "neutral")
    },
    {
      label: "Review readiness",
      value: tradingReadinessStatus ?? "paper_required",
      detail: readinessDetail,
      className: toneCardClass(paperQualificationTone(tradingQualificationStatus))
    }
  ];
  const tradingReadbackFields: TradingReadbackField[] = [
    {
      label: "Paper Trading Evaluation",
      value: tradingPaperTradingEvaluationWithEvidence
        ? `${tradingPaperTradingEvaluationWithEvidence.status} / ${tradingPaperTradingEvaluationWithEvidence.observation_count} observations`
        : "not started"
    },
    {
      label: "Paper runner",
      value: tradingPaperTradingEvaluationWithEvidence
        ? paperTradingRunnerStatus(tradingPaperTradingEvaluationWithEvidence)
        : tradingPaperBoardEntry?.runner_status ?? "not started"
    },
    {
      label: "Paper market snapshot",
      value: formatPaperMarketSnapshotSummary(tradingPaperMarketSnapshot)
    },
    {
      label: "Gateway market data",
      value: formatGatewayMarketDataSummary(tradingPaperTradingEvaluationWithEvidence)
    },
    {
      label: "Paper fill",
      value: tradingPaperFill
        ? formatPaperFillSummary(tradingPaperFill)
        : tradingPaperBoardEntry?.latest_fill_status ?? "none"
    },
    {
      label: "Public execution evidence",
      value: tradingPaperExecutionSnapshot
        ? formatPublicExecutionEvidenceSummary(tradingPaperExecutionSnapshot)
        : tradingPaperBoardEntry?.latest_public_execution_source ?? "not connected"
    },
    {
      label: "Public order book evidence",
      value: formatPublicOrderBookEvidenceSummary(tradingPaperExecutionSnapshot)
    },
    ...(tradingPaperTradingEvaluationWithEvidence?.latest_failure ||
      tradingPaperTradingEvaluationWithEvidence?.latest_failure_reason ||
      tradingPaperBoardEntry?.latest_failure ||
      tradingPaperBoardEntry?.latest_failure_reason
      ? [{
          label: "Paper failure",
          value: formatPaperFailure({
            latest_failure: tradingPaperTradingEvaluationWithEvidence?.latest_failure ??
              tradingPaperBoardEntry?.latest_failure,
            latest_failure_reason: tradingPaperTradingEvaluationWithEvidence?.latest_failure_reason ??
              tradingPaperBoardEntry?.latest_failure_reason
          })
        }]
      : [])
  ];
  const paperLearningFields: ResearchPaperLearningField[] = paperBoardLearning
    ? [
        {
          label: "Paper rank",
          value: paperBoardLearning.rank ? `#${paperBoardLearning.rank}` : "unranked"
        },
        {
          label: "Paper score",
          value: `${formatUsdt(paperBoardLearning.net_revenue_usdt)} / ${formatPercent(paperBoardLearning.net_return_pct)}`
        },
        {
          label: "Qualification",
          value: paperBoardLearning.qualification_status ?? "not qualified"
        },
        {
          label: "Top blocker",
          value: paperBoardLearning.top_blocker ?? "none"
        },
        {
          label: "Observations",
          value: String(paperBoardLearning.observation_count)
        },
        {
          label: "Next focus",
          value: paperBoardLearning.next_research_focus
        }
      ]
    : [];
  const researchFindingClusterEntries: ResearchFindingClusterEntry[] = findingClusters.slice(0, 6).map((cluster) => ({
    id: [
      cluster.direction_kind,
      cluster.top_blocker ?? "none",
      cluster.market_regime,
      cluster.protocol_failure_kind ?? "none"
    ].join("|"),
    title: `${cluster.direction_kind} / ${cluster.market_regime}`,
    value: cluster.blocker_group_kind ?? "no blocker group",
    detail: `${cluster.candidate_count} ${cluster.candidate_count === 1 ? "candidate" : "candidates"} / ${cluster.authority_status}`,
    fields: [
      { label: "Top blocker", value: cluster.top_blocker ?? "none" },
      { label: "Protocol failure", value: cluster.protocol_failure_kind ?? "none" },
      { label: "Latest finding", value: cluster.latest_finding ?? "none" },
      { label: "Next focus", value: cluster.next_research_focus }
    ],
    boundaryFields: [
      { label: "ResearchWorker input", value: "next-generation context only" },
      {
        label: "Cluster boundary",
        value: "no rank, no qualification, no Trading review blocker, no direction scheduling, no promotion"
      }
    ]
  }));
  const researchReviewSignal: ResearchSignalMetric = {
    label: "Trading review signal",
    value: operatorDecision.value,
    detail: operatorDecision.detail,
    className: toneCardClass(operatorDecision.tone)
  };
  const researchSignalMetrics: ResearchSignalMetric[] = [
    {
      label: "ResearchPreflight score",
      value: profitSummary[0].value,
      detail: profitSummary[0].detail,
      className: toneCardClass(profitSummary[0].tone)
    },
    {
      label: "Selected Trading System",
      value: runStatus,
      detail: `${candidate.display_name}; ${candidate.runtime.stage_binding_profile} / ${candidate.runtime.authority_status}`,
      className: toneCardClass(runStatus === "running" ? "good" : "neutral")
    },
    {
      label: "ResearchPreflight status",
      value: evaluationStatusValue,
      detail: evaluationStatusDetail,
      className: toneCardClass(evaluationStatusTone)
    },
    {
      label: "Next cycle handoff",
      value: nextCycleStatus,
      detail: nextCycleDetail,
      className: toneCardClass(visibleFullCycle || recoveredAgentCycle || candidate.improvement?.latest_change_proposal
        ? "good"
        : "warning")
    }
  ];
  const researchCycleStages: ResearchCycleStage[] = [
    {
      label: "Current System Code",
      status: candidate.program.summary,
      tone: "counted"
    },
    {
      label: "ResearchPreflight",
      status: researchEvaluationStageStatus,
      tone: researchCycleTone(researchEvaluationStageTone)
    },
    {
      label: "Candidate handoff",
      status: improvementOutputStatus,
      tone: researchCycleTone(improvementOutputTone)
    },
    {
      label: "Next cycle",
      status: nextCycleStatus,
      tone: researchNextCycleTone(nextCycleStatus)
    }
  ];
  const researchCycleRows: ResearchCycleRow[] = tradingSystemRows.map((row) => ({
    id: row.id,
    status: row.status,
    name: row.name,
    evaluation: row.evaluation,
    active: row.active
  }));
  const visibleFullCycleMetrics: ResearchAgentCycleMetric[] = visibleFullCycle
    ? [
        {
          label: "System Code",
          value: visibleFullCycle.system_code_handoff.system_code_id,
          detail: visibleFullCycle.system_code_handoff.runtime_kind,
          className: toneCardClass("good")
        },
        {
          label: "Backtest",
          value: formatScore(visibleFullCycle.backtest.score),
          detail: visibleFullCycle.backtest.summary,
          className: toneCardClass(visibleFullCycle.backtest.status === "accepted" ? "good" : "warning")
        },
        {
          label: "Paper Trading Run",
          value: visibleFullCycle.trading_run.lifecycle_status ?? "registered",
          detail: `${visibleFullCycle.paper_trading.provider_request_count} provider calls`,
          className: toneCardClass(visibleFullCycle.trading_run.lifecycle_status === "running" ? "good" : "neutral")
        },
        {
          label: "Ledger",
          value: visibleFullCycle.ledger.chain_complete ? "chain complete" : "incomplete",
          detail: "OrderRequest -> GatewayResult -> ExecutionResult",
          className: toneCardClass(visibleFullCycle.ledger.chain_complete ? "good" : "warning")
        }
      ]
    : [];
  const visibleFullCycleLineageFields = visibleFullCycleLineage
    ? fullCycleLineageFields(visibleFullCycleLineage)
    : undefined;
  const recoveredAgentCycleMetrics: ResearchAgentCycleMetric[] = recoveredAgentCycle
    ? [
        {
          label: "System Code",
          value: recoveredAgentCycle.systemCodeId,
          detail: candidate.system_code?.declared_runtime ?? candidate.program.manifest.declared_runtime,
          className: toneCardClass("good")
        },
        {
          label: "Backtest",
          value: "recorded",
          detail: recoveredAgentCycle.evaluationDetail,
          className: toneCardClass("good")
        },
        {
          label: "Paper Trading Run",
          value: runStatus,
          detail: "Ledger chain is visible in the current Trading Run.",
          className: toneCardClass(ledger?.chain_complete ? "good" : "neutral")
        },
        {
          label: "Ledger",
          value: ledger?.chain_complete ? "chain complete" : "incomplete",
          detail: "OrderRequest -> GatewayResult -> ExecutionResult",
          className: toneCardClass(ledger?.chain_complete ? "good" : "warning")
        }
      ]
    : [];
  const recoveredAgentCycleLineageFields = recoveredAgentCycle?.fullCycleLineage
    ? fullCycleLineageFields(recoveredAgentCycle.fullCycleLineage)
    : undefined;
  const viewTabs: OperatorViewTabItem<OperatorView>[] = [
    {
      value: "trading",
      label: "Trading",
      badge: tabStateBadges.trading,
      badgeAriaLabel: "Trading tab state badge"
    },
    {
      value: "arena",
      label: "Arena",
      badge: tabStateBadges.arena,
      badgeAriaLabel: "Arena tab state badge"
    },
    {
      value: "research",
      label: "Research",
      badge: tabStateBadges.research,
      badgeAriaLabel: "Research tab state badge"
    },
    {
      value: "details",
      label: "Details"
    }
  ];
  return (
    <OperatorPage>
      <Tabs
        value={activeView}
        onValueChange={(value) => onActiveViewChange?.(value as OperatorView)}
      >
        <OperatorPageHeader
          eyebrow={workspaceLabel}
          title="BTCUSDT operator cockpit"
          actions={(
            <OperatorViewTabs items={viewTabs} />
          )}
        />

        <OperatorTabPanel value="arena">
      {candidateArena && (
        <CandidateArenaPanel
          arena={candidateArena}
          selectedCandidateId={operatorSelectedCandidateId}
          selectedCandidate={selectedArenaCandidate}
          researcherProvider={operator?.researcher_provider}
          agentProfiles={operator?.agent_profiles}
          latestCommands={operator?.latest_commands}
          selectedPaperEvidence={operator?.selected_paper_evidence}
          selectedPaperTradingEvaluation={selectedPaperTradingEvaluationWithEvidence}
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
        <OperatorPanel aria-label="Arena unavailable">
          <OperatorSectionHeader
            title="Arena"
            description="Continuous paper trading arena state is not projected yet."
          />
        </OperatorPanel>
      )}
        </OperatorTabPanel>

        <OperatorTabPanel value="trading">
      <OperatorDecisionPanel
        workspaceLabel={workspaceLabel}
        detail={operatorDecision.detail}
        badges={(
          <>
            <Badge variant="secondary">{formatAuthorityLabel(tradingCandidate.runtime.authority_status)}</Badge>
            <Badge variant={runStatus === "running" ? "default" : "secondary"}>{runStatus}</Badge>
            <Badge variant="secondary">{formatRuntimeEnvironment(runtimeEnvironment)}</Badge>
            <Badge variant={marketFreshness === "fresh" ? "default" : "secondary"}>
              {formatFreshnessLabel(marketFreshness)}
            </Badge>
          </>
        )}
        recommendedAction={{
          value: operatorDecision.value,
          className: toneCardClass(operatorDecision.tone)
        }}
        actions={(
          <>
            {onObserveTradingRun && (
              <Button
                type="button"
                onClick={onObserveTradingRun}
                disabled={runningTradingRun || tradingReviewMismatch}
                variant="secondary"
              >
                Observe paper
              </Button>
            )}
            {onStopTradingRun && (
              <Button
                type="button"
                onClick={onStopTradingRun}
                disabled={runningTradingRun || tradingReviewMismatch || tradingCandidate.runtime.runtime_lifecycle_status === "stopped"}
                variant="outline"
              >
                Stop paper
              </Button>
            )}
          </>
        )}
      />

      {tradingReviewPacket && (
        <TradingReviewPacketSection
          severity={tradingReviewPacket.verdict.severity}
          severityVariant={tradingReviewSeverityVariant(tradingReviewPacket.verdict.severity)}
          fields={tradingReviewPacketFields}
        />
      )}

      <TradingPromotionBoundaryCard
        promotion={tradingPromotion}
        tradingReview={tradingReview}
        paperBoardEntry={selectedPaperBoardEntry}
        selectedCandidate={candidate}
        tradingReviewCandidate={activeTradingReviewCandidate}
        selectedPaperTradingEvaluation={selectedPaperTradingEvaluationWithEvidence}
        onSelectCandidate={onSelectCandidate}
        onPromoteTradingCandidate={onPromoteTradingCandidate}
        runningTradingPromotion={runningTradingPromotion}
      />

      {(tradingRunMessage ||
        tradingRunError ||
        tradingPromotionMessage ||
        tradingPromotionError ||
        tradingCommandRemediations.length > 0) && (
        <OperatorPanel aria-label="Operator messages">
          <OperatorSectionHeader
            title="Operator messages"
            description="Recent Trading command outcomes and remediation surfaces."
          />
          <OperatorStatusStack
            messages={operatorStatusMessages(
              tradingRunMessage
                ? { id: "trading-run-message", value: tradingRunMessage }
                : undefined,
              tradingRunError
                ? { id: "trading-run-error", tone: "error", value: tradingRunError }
                : undefined,
              tradingPromotionMessage
                ? { id: "trading-promotion-message", value: tradingPromotionMessage }
                : undefined,
              tradingPromotionError
                ? { id: "trading-promotion-error", tone: "error", value: tradingPromotionError }
                : undefined
            )}
          />
            {tradingCommandRemediations.length > 0 && (
              <OperatorEvidenceStack>
                {tradingCommandRemediations.map(({ command, remediation }) => (
                  <OperatorEvidenceBlock
                    key={command.command_id}
                    title={command.command_kind}
                  >
                    <OperatorEvidenceRow>
                      <OperatorField
                        label="Status"
                        value={command.error ? `${command.status} / ${command.error}` : command.status}
                      />
                      <OperatorField label="Remediation group" value={remediation.group} />
                      <OperatorField label="Visible surface" value={remediation.surface} />
                      <OperatorField label="Remediation next step" value={remediation.remediation} />
                      <OperatorField label="Command authority" value={remediation.authority_status} />
                    </OperatorEvidenceRow>
                  </OperatorEvidenceBlock>
                ))}
              </OperatorEvidenceStack>
            )}
        </OperatorPanel>
      )}

      <TradingSafetyBoundarySection
        badges={tradingSafetyBoundaryBadges}
        detail={tradingCandidate.fixture_notice.statements[0]}
      />

      <TradingCockpitSection
        candidateName={tradingCandidate.display_name}
        status={tradingMarketStatus}
        statusVariant={tradingMarketStatusVariant}
      >

        <TradingMarketSection
          description={tradingPublicMarketSurface
              ? "Binance USD-M Futures snapshot"
              : "Market feed is not connected yet."}
          status={tradingMarketStatus}
          statusVariant={tradingMarketStatusVariant}
          metrics={tradingMarketMetrics}
        >
          <TradingMarketChart
            fields={tradingMarketChartFields}
            points={tradingMarketChartPoints}
            instrumentLabel={tradingMarketInstrumentLabel}
            footerDetail={tradingMarketFooterDetail}
          />
        </TradingMarketSection>

        <PaperReviewSummarySection metrics={paperReviewSummaryMetrics} />

        <TradingPaperReadbackSection
          badgeLabel={selectedIsTradingReviewCandidate ? "Trading review" : "Arena selection differs"}
          badgeVariant={selectedIsTradingReviewCandidate ? "default" : "secondary"}
          fields={tradingReadbackFields}
        />

        <TradeStatusPanel
          ledgerStatus={tradingLedgerStatus}
          ledger={tradingLedger}
          orderFillSurface={tradingOrderFillSurface}
          reviewLedger={tradingReviewPacket?.ledger}
        />
      </TradingCockpitSection>

        </OperatorTabPanel>

        <OperatorTabPanel value="research">
      {paperBoardLearning && (
        <ResearchPaperLearningSection
          authorityStatus={paperBoardLearning.authority_status}
          summary={paperBoardLearning.summary}
          fields={paperLearningFields}
        />
      )}
      {researchFindingClusterEntries.length > 0 && (
        <ResearchFindingClustersSection entries={researchFindingClusterEntries} />
      )}
      <ResearchSignalsSection
        reviewSignal={researchReviewSignal}
        metrics={researchSignalMetrics}
      />
      <ResearchCycleSection
        rowCount={tradingSystemRows.length}
        stages={researchCycleStages}
        rows={researchCycleRows}
      />
      {visibleFullCycle && (
        <ResearchAgentCycleSection
          title="Agent generated Trading System"
          description={`${visibleFullCycle.agent_research.agent.provider} produced SystemCode, backtest accepted it, and paper trading recorded a Ledger chain.`}
          badgeLabel={visibleFullCycle.agent_research.latest_decision}
          metrics={visibleFullCycleMetrics}
          lineageFields={visibleFullCycleLineageFields}
        />
      )}
      {!visibleFullCycle && recoveredAgentCycle && (
        <ResearchAgentCycleSection
          title="Agent generated Trading System"
          description={`${recoveredAgentCycle.providerLabel} produced SystemCode, paper trading recorded a Ledger chain, and the Trading System is ready for the next cycle.`}
          badgeLabel="materialized"
          metrics={recoveredAgentCycleMetrics}
          lineageFields={recoveredAgentCycleLineageFields}
        />
      )}

        </OperatorTabPanel>

        <OperatorTabPanel value="details">
      <OperatorPanel aria-label="Fixture notice">
        <OperatorSectionHeader
          title={candidate.display_name}
          description="Fixture dry-run only - why the first screen does not show real P&L yet"
          actions={(
            <>
              <OperatorStatusBadge
                value={candidate.fixture_notice.label}
                variant="outline"
                multiline
              />
              <OperatorStatusBadge
                value={`fixture mode: ${candidate.fixture_notice.mode}`}
                variant="outline"
                multiline
              />
            </>
          )}
        />
        <OperatorActionRow className="justify-start">
          {candidate.fixture_notice.statements.map((statement) => (
            <OperatorStatusBadge
              key={statement}
              value={statement}
              variant="outline"
              multiline
            />
          ))}
        </OperatorActionRow>
      </OperatorPanel>

      <OperatorPanel aria-label="Details boundary">
        <OperatorSectionHeader
          eyebrow="Raw evidence boundary"
          title="Developer/detail records"
          description="Product decisions stay in Trading, Arena, and Research. Product blockers stay in Trading, Arena, and Research. Details keeps raw records, compatibility tools, and low-level evidence inspectable without creating promotion authority."
          actions={(
            <>
            <Badge variant="secondary">read only by default</Badge>
            <Badge variant="secondary">No promotion authority</Badge>
            </>
          )}
        />
          <OperatorFieldGrid density="dense">
            <OperatorField label="Owns" value="raw records, developer controls, compatibility evidence" />
            <OperatorField label="Reads" value="Candidate inspect model and low-level substrate records" />
            <OperatorField label="Never does" value="qualify, promote, or enable live/private exchange authority" />
            <OperatorField label="Use for" value="inspection after the product loop has named the decision path" />
          </OperatorFieldGrid>
      </OperatorPanel>

      <OperatorPanel aria-label="Details">
        <OperatorSectionHeader
          title="Details"
          description="Open only the area you need. Raw refs and implementation records stay below this line."
        />
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

          <OperatorInfoSection
            title="ResearchPreflight Evidence"
            summary={evaluationStatusLabel(candidate.evaluation)}
            badge={candidate.evaluation.counted_evidence.evidence_disposition}
          >
            <EvaluationSection evaluation={candidate.evaluation} />
          </OperatorInfoSection>

          <ImprovementSection
            improvement={candidate.improvement}
            onRecordImprovement={onRecordImprovement}
            recordingImprovement={recordingImprovement}
            improvementError={improvementError}
            improvementMessage={improvementMessage}
          />

          <OperatorInfoSection
            title="Trading Run"
            summary={`${runStatus} / ${candidate.runtime.authority_status}`}
            badge={runStatus}
          >
            <OperatorEvidenceStack>
              <OperatorEvidenceStatus
                label="Lifecycle"
                value={runStatus}
                detail={candidate.runtime.authority_status}
                tone={runStatus === "running" ? "counted" : "neutral"}
              />
              <OperatorEvidenceRow>
                <OperatorField label="Ref" value={formatRef(candidate.runtime.ref)} />
                <OperatorField label="Stage binding" value={candidate.runtime.stage_binding_profile} />
                {candidate.runtime.runtime_lifecycle_status && (
                  <OperatorField label="Lifecycle" value={candidate.runtime.runtime_lifecycle_status} />
                )}
                <OperatorField label="Trading run authority" value={candidate.runtime.authority_status} />
                <Placeholder item={candidate.runtime.placement} />
                <Placeholder item={candidate.runtime.hands_environment} />
                <OperatorField label="Memory trust" value={candidate.runtime.memory_surface.trust_class} />
                <OperatorField label="Memory access" value={candidate.runtime.memory_surface.access_mode} />
                <OperatorField label="Memory authority" value={candidate.runtime.memory_surface.authority_status} />
              </OperatorEvidenceRow>
              {(onStartTradingRun || onStartRejectedPaperOrder || onObserveTradingRun || onStopTradingRun) && (
                <OperatorActionRow>
                  {onStartTradingRun && (
                    <Button
                      type="button"
                      onClick={onStartTradingRun}
                      disabled={runningTradingRun}
                    >
                      {runningTradingRun ? "Working trading run" : "Start trading run"}
                    </Button>
                  )}
                  {onStartRejectedPaperOrder && (
                    <Button
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
                  <OperatorDetailText as="span">run_control / fixture_paper / not_live</OperatorDetailText>
                </OperatorActionRow>
              )}
            </OperatorEvidenceStack>
          </OperatorInfoSection>

          <LedgerSection ledger={ledger} />

          <TradingGatewayContractSection
            contract={candidate.trading_substrate?.latest_trading_gateway_contract}
          />

          <TradingGatewayEnvironmentSection environment={tradingGatewayEnvironment} />

          <SandboxSection sandbox={candidate.runtime.sandbox} />

          <TradingRunTranscriptSection transcript={candidate.runtime.transcript} />

          <OperatorInfoSection
            title="Trading System"
            summary={`${candidate.status} / ${latestValidationStateLabel(candidate.latest_validation_state)}`}
            badge={candidate.status}
          >
            <OperatorField label="Status" value={candidate.status} />
            <OperatorField label="Active version" value={candidate.active_version_id} />
            <OperatorField label="Latest validation state" value={latestValidationStateLabel(candidate.latest_validation_state)} />
            <OperatorField label="Provenance refs" value={candidate.candidate_version.provenance_refs.map(formatRef).join(", ")} />
            {candidate.latest_validation_state && (
              <CandidateLatestValidationStateBlock validationState={candidate.latest_validation_state} />
            )}
          </OperatorInfoSection>

          <OperatorInfoSection
            title="Spec"
            summary={`${candidate.spec.market} / ${candidate.spec.instrument}`}
            badge={candidate.spec.supported_stage_binding_profiles.join(", ")}
          >
            <OperatorField label="Ref" value={formatRef(candidate.spec.ref)} />
            <OperatorField label="Summary" value={candidate.spec.summary} />
            <OperatorField label="Market" value={`${candidate.spec.market} / ${candidate.spec.instrument}`} />
            <OperatorField label="Stage profiles" value={candidate.spec.supported_stage_binding_profiles.join(", ")} />
          </OperatorInfoSection>

          <OperatorInfoSection
            title="System Code"
            summary={candidate.program.summary}
            badge={candidate.program.manifest.declared_runtime}
          >
            <OperatorField label="Ref" value={formatRef(candidate.program.ref)} />
            <OperatorField label="Summary" value={candidate.program.summary} />
            <OperatorField label="Manifest" value={formatRef(candidate.program.manifest.ref)} />
            <OperatorField label="Runtime" value={candidate.program.manifest.declared_runtime} />
            <Placeholder item={candidate.program.validation} />
          </OperatorInfoSection>

          <OperatorInfoSection
            title="Capability Package"
            summary={`allowed: ${candidate.capability_package.manifest.allowed_stages.join(", ")}`}
            badge="not_live"
          >
            <OperatorField label="Ref" value={formatRef(candidate.capability_package.ref)} />
            <OperatorField label="Summary" value={candidate.capability_package.summary} />
            <OperatorField label="Allowed stages" value={candidate.capability_package.manifest.allowed_stages.join(", ")} />
            <OperatorField label="Declared permissions" value={candidate.capability_package.manifest.declared_permissions.join(", ")} />
            <OperatorField label="Forbidden contents" value={candidate.capability_package.manifest.forbidden_contents.join(", ")} />
            <Placeholder item={candidate.capability_package.admission} />
            <Placeholder item={candidate.capability_package.grant} />
            <Placeholder item={candidate.capability_package.mount} />
          </OperatorInfoSection>

          <OperatorInfoSection
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
          </OperatorInfoSection>

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
      </OperatorPanel>
        </OperatorTabPanel>
      </Tabs>
    </OperatorPage>
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

function fullCycleLineageFields(
  lineage: NonNullable<CandidateInspectReadModel["full_cycle_lineage"]>
): ResearchAgentCycleLineageField[] {
  return [
    {
      label: "Source Trading System",
      value: lineage.source.trading_system_id
    },
    {
      label: "Source System Code",
      value: lineage.source.system_code_ref
        ? formatRef(lineage.source.system_code_ref)
        : "none"
    },
    {
      label: "Next Trading System",
      value: lineage.materialized?.trading_system_id ?? "not materialized"
    },
    {
      label: "Evidence Chain",
      value: lineage.evidence?.ledger_chain_complete
        ? "Ledger chain complete"
        : lineage.blocked_stage ?? "pending"
    }
  ];
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

function operatorTabStateBadges(
  operator: OperatorReadModel | undefined
): Partial<Record<Exclude<OperatorView, "details">, string>> {
  if (!operator) {
    return {};
  }

  const selectedPaperEvaluationId = operator.selected_paper_trading_evaluation.evaluation_id;
  const selectedPaperBoardEntry = operator.paper_trading_board.entries.find((entry) =>
    (selectedPaperEvaluationId && entry.evaluation_id === selectedPaperEvaluationId) ||
    entry.candidate_id === operator.selected_candidate_id
  );
  const selectedProviderProfile = operator.agent_profiles.find((profile) =>
    profile.profile_id === operator.researcher_provider.selected_provider
  );

  return {
    trading: operator.trading_review.status === "promoted_for_trading_review" ? "review" : undefined,
    arena: selectedPaperBoardEntry?.qualification_status === "collecting_evidence" ? "collecting" : undefined,
    research: selectedProviderProfile && selectedProviderProfile.status !== "authenticated"
      ? "provider blocked"
      : undefined
  };
}

function selectableResearcherProvider(provider: AgentProfileProviderKind): "codex" | "fixture" {
  if (isSelectableResearcherProvider(provider)) {
    return provider;
  }
  throw new Error(`Researcher provider ${provider} is not supported yet.`);
}

function OperatorStatusCard({
  label,
  value,
  detail,
  tone
}: OperatorMetric) {
  return (
    <OperatorStat label={label} value={value} detail={detail} className={toneCardClass(tone)} />
  );
}

function TradeStatusPanel({
  ledger,
  ledgerStatus,
  orderFillSurface,
  reviewLedger
}: {
  ledger?: LedgerReadModel;
  ledgerStatus: string;
  orderFillSurface?: OrderFillSurfaceReadModel | null;
  reviewLedger?: OperatorReadModel["trading_review"]["review_packet"]["ledger"];
}) {
  const noOrderCheckpoint = reviewLedger?.evidence_status === "no_order_checkpoint";
  const requestedQuantity = orderFillSurface?.requested_quantity ?? ledger?.latest_order_request?.quantity;
  const filledQuantity = orderFillSurface?.cumulative_filled_quantity ?? "0";
  const fillPercent = calculateFillPercent(filledQuantity, requestedQuantity);
  const sideAndType = noOrderCheckpoint
    ? `No order emitted / ${reviewLedger.latest_decision_kind ?? "no_order_checkpoint"}`
    : orderFillSurface?.side && orderFillSurface.order_type
    ? `${orderFillSurface.side} ${orderFillSurface.order_type}`
    : ledger?.latest_order_request
      ? `${ledger.latest_order_request.side} ${ledger.latest_order_request.order_type}`
      : "no order request";
  const filledValue = noOrderCheckpoint ? "not applicable" : `${filledQuantity}/${requestedQuantity ?? "0"}`;
  const averagePriceValue = noOrderCheckpoint
    ? "not applicable"
    : orderFillSurface?.average_fill_price ?? "not filled";
  const executionValue = noOrderCheckpoint
    ? "no execution expected"
    : ledger?.latest_execution_result?.status ?? "not recorded";
  const statusBadgeLabel = noOrderCheckpoint
    ? reviewLedger.evidence_status
    : orderFillSurface?.posture ?? ledgerStatus;
  const statusBadge: TradingOrderStatusBadge = {
    label: statusBadgeLabel,
    variant: noOrderCheckpoint || orderFillSurface || ledger?.chain_complete ? "default" : "secondary"
  };
  const stats: TradingOrderStatusStat[] = [
    { label: "Paper order / decision", value: sideAndType },
    { label: "Paper filled", value: filledValue },
    { label: "Paper average price", value: averagePriceValue },
    { label: "Paper execution", value: executionValue }
  ];
  const chainBadges: TradingOrderStatusBadge[] = noOrderCheckpoint
    ? [
      { label: "TradingSystemDecision", variant: "default" },
      { label: reviewLedger.latest_decision_kind ?? "no_order_checkpoint", variant: "secondary" }
    ]
    : [
      { label: "OrderRequest", variant: ledger?.latest_order_request ? "default" : "secondary" },
      { label: "GatewayResult", variant: ledger?.latest_gateway_result ? "default" : "secondary" },
      { label: "ExecutionResult", variant: ledger?.latest_execution_result ? "default" : "secondary" }
    ];

  return (
    <TradingOrderStatusSection
      statusBadge={statusBadge}
      stats={stats}
      progressValue={noOrderCheckpoint ? undefined : fillPercent}
      chainBadges={chainBadges}
    />
  );
}

function formatMarketSourceMode(market: PublicMarketLivenessSurfaceReadModel): string {
  if (market.fixture_backed || market.simulated || market.source_kind === "fixture") {
    return `fixture / ${market.simulated ? "simulated" : "read-only"}`;
  }
  if (market.source_kind === "binance_market_data_rest") {
    return "Binance market data REST / read-only public";
  }
  if (market.source_kind === "binance_production_public_rest") {
    return "Binance public REST / read-only public";
  }
  if (market.source_kind === "binance_production_public_websocket") {
    return "Binance public WebSocket / read-only public";
  }
  if (market.source_kind === "binance_production_public_hybrid") {
    return "Binance public hybrid / read-only public";
  }
  if (market.source_kind === "binance_production_public_stream") {
    return "Binance public stream / read-only public";
  }
  if (market.source_kind === "binance_rest_query") {
    return "Binance REST query / read-only public";
  }
  if (market.source_kind === "binance_user_data_stream") {
    return "Binance user data stream / read-only";
  }
  if (market.source_kind === "local_config") {
    return "local config / read-only";
  }
  const exhaustiveSourceKind: never = market.source_kind;
  return exhaustiveSourceKind;
}

function formatMarketFreshness(market: PublicMarketLivenessSurfaceReadModel): string {
  const base = `${formatFreshnessLabel(market.freshness)} / ${market.liveness}`;
  return market.degraded_reason ? `${base} / ${market.degraded_reason}` : base;
}

interface OperatorDecisionInput {
  accountPositionRiskSurface?: AccountPositionRiskMirrorSurfaceReadModel | null;
  candidate: CandidateInspectReadModel;
  ledger?: LedgerReadModel;
  latestReplayRun?: ReplayRunEvidenceReadModel;
  orderFillSurface?: OrderFillSurfaceReadModel | null;
  replayRunDetail?: ReplayRunDetailReadModel;
  tradingReviewPacket?: OperatorReadModel["trading_review"]["review_packet"];
}

function buildOperatorDecision({
  accountPositionRiskSurface,
  candidate,
  ledger,
  latestReplayRun,
  orderFillSurface,
  replayRunDetail,
  tradingReviewPacket
}: OperatorDecisionInput): OperatorMetric {
  return buildTradingFirstViewportRecommendation({
    trading_review_packet: tradingReviewPacket,
    compatibility: {
      risk_status: accountPositionRiskSurface?.risk_status,
      runtime_lifecycle_status: candidate.runtime.runtime_lifecycle_status,
      has_improvement_proposal: Boolean(candidate.improvement?.latest_change_proposal),
      improvement_proposal_id: candidate.improvement?.latest_change_proposal?.proposal_id,
      has_ledger_evidence: Boolean(ledger?.chain_complete || orderFillSurface),
      has_replay_evidence: Boolean(latestReplayRun || replayRunDetail)
    }
  });
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

function formatPaperBoardTrend(entry: PaperTradingBoardReadModel["entries"][number]): string {
  return [
    entry.trend.direction,
    formatSignedUsdt(entry.trend.net_revenue_delta_usdt),
    formatSignedPercent(entry.trend.net_return_delta_pct),
    `${entry.trend.observation_count_delta} obs`,
    entry.trend.authority_status
  ].join(" / ");
}

function formatPaperBoardBlockerDensity(entry: PaperTradingBoardReadModel["entries"][number]): string {
  return [
    `${entry.blocker_density.blocker_count} blockers`,
    `density ${entry.blocker_density.blocker_density}`,
    `failed ${entry.blocker_density.failed_observation_ratio}`,
    `top ${entry.blocker_density.top_blocker ?? "none"}`,
    entry.blocker_density.authority_status
  ].join(" / ");
}

function formatSignedUsdt(value: number): string {
  return `${value > 0 ? "+" : ""}${formatUsdt(value)}`;
}

function formatSignedPercent(value: number): string {
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function formatCandidateArenaTickGenerated(tick: CandidateArenaReadModel["latest_ticks"][number]): string {
  const failedCount = tick.direction_results.filter((result) => result.status === "failed").length;
  return `${tick.created_candidate_ids.length} created / ${failedCount} failed`;
}

function formatCandidateArenaTickDirections(tick: CandidateArenaReadModel["latest_ticks"][number]): string {
  return tick.direction_results.map((result) =>
    `${result.direction_kind}:${result.status}`
  ).join(", ");
}

function formatCandidateArenaTickEfficiency(tick: CandidateArenaReadModel["latest_ticks"][number]): string {
  const summaries = tick.direction_results
    .filter((result) => result.research_efficiency)
    .map((result) => {
      const efficiency = result.research_efficiency!;
      return `${result.direction_kind}: ${efficiency.provider_request_total} provider / ${efficiency.runner_command_total} runner / ${efficiency.scenario_count} scenarios / ${efficiency.elapsed_ms}ms / ${efficiency.authority_status}`;
    });
  return summaries.length ? summaries.join("; ") : "not recorded";
}

function marketChartPoints(market: PublicMarketLivenessSurfaceReadModel): TradingMarketChartPoint[] {
  const values: Array<[string, number]> = [
    ["index", parseNumber(market.index_price)],
    ...(market.estimated_settle_price
      ? [["settle", parseNumber(market.estimated_settle_price)] as [string, number]]
      : []),
    ["mark", parseNumber(market.mark_price)]
  ];
  return values
    .filter(([, value]) => Number.isFinite(value))
    .map(([label, price]) => ({ label, price }));
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

function researchCycleTone(tone: OperatorTone): ResearchCycleStage["tone"] {
  if (tone === "good") {
    return "counted";
  }
  if (tone === "danger") {
    return "failed";
  }
  if (tone === "warning") {
    return "failed";
  }
  return "neutral";
}

function researchNextCycleTone(status: string): ResearchCycleStage["tone"] {
  return status === "handoff ready" || status === "agent handoff ready" ? "counted" : "neutral";
}

function tradingReviewSeverityVariant(severity: string): "default" | "destructive" | "secondary" {
  if (severity === "ready") {
    return "default";
  }
  if (severity === "blocked" || severity === "failed" || severity === "mismatch") {
    return "destructive";
  }
  return "secondary";
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
      <OperatorInfoSection title="Sandbox" summary="not linked / not_live" badge="not linked">
        <OperatorEvidenceStack>
          <OperatorEvidenceStatus
            label="Lifecycle"
            value="not linked"
            detail="not_live"
            tone="neutral"
          />
        </OperatorEvidenceStack>
      </OperatorInfoSection>
    );
  }

  const latestLog = sandbox.logs.at(-1);
  const latestHeartbeat = sandbox.heartbeats.at(-1);
  return (
    <OperatorInfoSection
      title="Sandbox"
      summary={`${sandbox.lifecycle_status} / ${sandbox.adapter_kind}`}
      badge={sandbox.lifecycle_status}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Lifecycle"
          value={sandbox.lifecycle_status}
          detail={sandbox.authority_status}
          tone={sandbox.lifecycle_status === "running" ? "counted" : "neutral"}
        />
        <OperatorEvidenceRow>
          <OperatorField label="Ref" value={sandbox.sandbox_id} />
          <OperatorField label="Adapter" value={sandbox.adapter_kind} />
          <OperatorField label="Name" value={sandbox.sandbox_name} />
          <OperatorField label="Runtime" value={sandbox.runtime_ref ? formatRef(sandbox.runtime_ref) : "none"} />
          <OperatorField label="System Code" value={formatRef(sandbox.system_code_ref)} />
          <OperatorField label="Placement" value={formatRef(sandbox.sandbox_placement_ref)} />
          <OperatorField label="Last heartbeat" value={sandbox.last_heartbeat_at ?? "none"} />
          <OperatorField label="Logs" value={latestLog?.lines.join(" / ") ?? "none"} />
          <OperatorField label="Heartbeats" value={latestHeartbeat?.heartbeat_line ?? "none"} />
          <OperatorField label="Command evidence" value={String(sandbox.command_evidence.length)} />
          <OperatorField label="Sandbox authority" value={sandbox.authority_status} />
        </OperatorEvidenceRow>
      </OperatorEvidenceStack>
    </OperatorInfoSection>
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
    <OperatorInfoSection
      title="Trading Run Transcript"
      summary={`${statusLabel} / ${transcript?.authority_status ?? "not_live"}`}
      badge={transcript?.has_activity ? "activity" : "none"}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Readback"
          value={statusLabel}
          detail={transcript?.authority_status ?? "not_live"}
          tone={transcript?.has_activity ? "counted" : "neutral"}
        />
        <OperatorEvidenceRow>
          <OperatorField label="Items" value={String(transcript?.item_count ?? 0)} />
          <OperatorField label="Latest" value={transcript?.latest_item?.label ?? "none"} />
          <OperatorField label="Transcript authority" value={transcript?.authority_status ?? "not_live"} />
        </OperatorEvidenceRow>

        {transcript?.items.length ? (
          transcript.items.map((item) => (
            <OperatorEvidenceBlock title={item.label} key={item.item_id}>
              <OperatorEvidenceRow>
                <OperatorField label="When" value={item.occurred_at} />
                <OperatorField label="Kind" value={item.item_kind} />
                <OperatorField label="Summary" value={item.summary} />
                {item.ref && <OperatorField label="Ref" value={formatRef(item.ref)} />}
                {item.lifecycle_status && <OperatorField label="Lifecycle" value={item.lifecycle_status} />}
                <OperatorField label="Transcript event authority" value={item.authority_status} />
              </OperatorEvidenceRow>
            </OperatorEvidenceBlock>
          ))
        ) : (
          <OperatorEmptyState
            title="Transcript"
            description="none"
            detail="Transcript event authority: not_live"
          />
        )}
      </OperatorEvidenceStack>
    </OperatorInfoSection>
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
    <OperatorPanel className="execution-mode-panel" aria-label="Trading execution modes">
      <OperatorSectionHeader
        title="Backtest / paper / live contract"
        description={`Execution modes: ${modes.map((mode) => mode.mode).join(", ")}`}
        actions={<Badge variant="secondary">{String(modes.length)}</Badge>}
      />
      <OperatorEvidenceStack className="execution-mode-grid">
        {modes.map((mode) => (
          <OperatorEvidenceBlock
            title={mode.label}
            key={mode.mode}
            aria-label={`${mode.label} execution mode`}
          >
            <OperatorEvidenceStatus
              label="Execution mode support"
              value={mode.support_status}
              detail={mode.authority.status}
              tone={mode.support_status === "available" ? "counted" : "neutral"}
            />
            <OperatorEvidenceRow>
              <OperatorField label="Execution mode" value={mode.mode} />
              <OperatorField label="Provider boundary" value={mode.artifact_contract.api_provider_boundary} />
              <OperatorField label="Market data" value={mode.provider_contract.market_data} />
              <OperatorField label="Account" value={mode.provider_contract.account} />
            </OperatorEvidenceRow>
            <OperatorEvidenceRow>
              <OperatorField label="Order plane" value={mode.provider_contract.order_plane} />
              <OperatorField label="Execution mode authority" value={mode.authority.status} />
              <OperatorField label="Artifact credentials" value={mode.artifact_contract.credentials_access} />
              <OperatorField label="Artifact order submission" value={mode.artifact_contract.order_submission} />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        ))}
      </OperatorEvidenceStack>
    </OperatorPanel>
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
    <OperatorInfoSection
      title="Candidate Runs"
      summary={latestRun ? `${latestRun.status} / ${latestRun.scenario_accepted}/${latestRun.scenario_total} accepted` : "no replay runs"}
      badge={latestRun?.status ?? "none"}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Candidate-id replay evidence"
          value={latestRun ? latestRun.status : "none"}
          detail={latestRun?.authority_status ?? "not_live"}
          tone={latestRun?.status === "succeeded" ? "counted" : latestRun?.status === "failed" ? "failed" : "neutral"}
        />

        {latestRun ? (
          <OperatorEvidenceBlock title="Latest replay run" aria-label="Latest replay run">
            <OperatorEvidenceRow>
              <OperatorField label="Latest run" value={latestRun.run_id} />
              <OperatorField label="Selected run" value={activeRunId ?? "none"} />
              <OperatorField label="Replay runner" value={latestRun.runner_kind} />
              <OperatorField label="Run status" value={latestRun.run_status} />
              <OperatorField label="Scenarios" value={`${latestRun.scenario_accepted}/${latestRun.scenario_total} accepted`} />
              <OperatorField label="Provider requests" value={String(latestRun.provider_request_total)} />
              <OperatorField label="Replay runner commands" value={String(latestRun.runner_command_total)} />
              <OperatorField label="Artifact digest" value={latestRun.artifact_digest} />
              <OperatorField label="Completed" value={latestRun.completed_at} />
              <OperatorField label="Replay authority" value={latestRun.authority_status} />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        ) : (
          <OperatorEmptyState
            title="No candidate-id replay runs"
            description="run evidence has not been recorded for this candidate"
            detail="not_live"
          >
            <span>Replay runner: none</span>
            <span>Replay authority: not_live</span>
          </OperatorEmptyState>
        )}

        {runs.length > 0 && (
          <OperatorEvidenceBlock title="Run history" aria-label="Run history">
            <OperatorEvidenceStack>
              {runs.map((run) => (
                <OperatorSelectionItem
                  active={activeRunId === run.run_id}
                  key={run.run_id}
                  type="button"
                  onClick={() => onSelectRun?.(run.run_id)}
                  title={run.run_id}
                  detail={`${run.status} / ${run.runner_kind} / ${run.authority_status}`}
                  meta={`${run.scenario_accepted}/${run.scenario_total} accepted · ${run.completed_at}`}
                />
              ))}
            </OperatorEvidenceStack>
          </OperatorEvidenceBlock>
        )}

        <ReplayRunComparisonBlock
          comparison={comparison}
          selectedRunId={activeRunId}
          baselineRunId={comparisonBaselineId}
        />

        {validationState && <ReplayRunValidationStateBlock validationState={validationState} />}

        {detail && <ReplayRunDetailBlock detail={detail} />}

        {onRunCandidateReplay && (
          <OperatorActionRow>
            <Button
              type="button"
              onClick={onRunCandidateReplay}
              disabled={runningCandidateReplay}
            >
              {runningCandidateReplay ? "Running replay" : "Run replay"}
            </Button>
            <OperatorDetailText as="span">host_process / replay_only / not_live</OperatorDetailText>
          </OperatorActionRow>
        )}
        <OperatorStatusStack
          messages={operatorStatusMessages(
            replayRunMessage
              ? { id: "replay-run-message", value: replayRunMessage }
              : undefined,
            replayRunError
              ? { id: "replay-run-error", tone: "error", value: replayRunError }
              : undefined
          )}
        />
      </OperatorEvidenceStack>
    </OperatorInfoSection>
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
      <OperatorEvidenceBlock title="Run comparison" aria-label="Run comparison">
        <OperatorEmptyState
          title="No comparison baseline"
          description={baselineRunId ?? "single replay-run history"}
          detail="comparison_not_authority"
        />
      </OperatorEvidenceBlock>
    );
  }

  return (
    <OperatorEvidenceBlock title="Run comparison" aria-label="Run comparison">
      <OperatorEvidenceStatus
        label="Selected vs baseline replay evidence"
        value={comparison.verdict}
        detail={comparison.validation_label}
        tone={comparison.verdict === "regressed" ? "failed" : "counted"}
      />
      <OperatorEvidenceRow>
        <OperatorField label="Selected run" value={comparison.selected.run_id} />
        <OperatorField label="Baseline run" value={comparison.baseline.run_id} />
        <OperatorField label="Score delta" value={formatSignedNumber(comparison.deltas.score)} />
        <OperatorField label="Accepted scenario delta" value={formatSignedNumber(comparison.deltas.scenario_accepted)} />
        <OperatorField label="Provider request delta" value={formatSignedNumber(comparison.deltas.provider_request_total)} />
        <OperatorField label="Runner command delta" value={formatSignedNumber(comparison.deltas.runner_command_total)} />
        <OperatorField label="Risk transition" value={comparison.risk_transition} />
        <OperatorField label="Reason" value={comparison.verdict_reason} />
        <OperatorField label="Replay comparison authority" value={comparison.authority_status} />
        <OperatorField label="Replay comparison no authority" value={formatNoAuthority(comparison.no_authority)} />
      </OperatorEvidenceRow>
    </OperatorEvidenceBlock>
  );
}

function ReplayRunValidationStateBlock({
  validationState
}: {
  validationState: ReplayRunValidationStateReadModel;
}) {
  return (
    <OperatorEvidenceBlock title="Validation state" aria-label="Validation state">
      <ValidationStateStatus validationState={validationState} />
      <OperatorEvidenceRow>
        <OperatorField label="Selected run" value={validationState.selected_run_id} />
        <OperatorField label="Baseline run" value={validationState.baseline_run_id ?? "none"} />
        <OperatorField label="Comparison verdict" value={validationState.comparison_verdict ?? "none"} />
        <OperatorField label="Reasons" value={validationState.reasons.join("; ")} />
        <OperatorField label="Required next evidence" value={validationState.required_next_evidence.join("; ")} />
        <OperatorField label="Replay validation authority" value={validationState.authority_status} />
        <OperatorField label="Replay validation no authority" value={formatNoAuthority(validationState.no_authority)} />
      </OperatorEvidenceRow>
    </OperatorEvidenceBlock>
  );
}

function CandidateLatestValidationStateBlock({
  validationState
}: {
  validationState: CandidateLatestValidationStateReadModel;
}) {
  return (
    <OperatorEvidenceBlock title="Candidate latest validation state" aria-label="Candidate latest validation state">
      <ValidationStateStatus validationState={validationState} />
      <OperatorEvidenceRow>
        <OperatorField label="Selected run" value={validationState.selected_run_id ?? "none"} />
        <OperatorField label="Baseline run" value={validationState.baseline_run_id ?? "none"} />
        <OperatorField label="Comparison verdict" value={validationState.comparison_verdict ?? "none"} />
        <OperatorField label="Reasons" value={validationState.reasons.join("; ")} />
        <OperatorField label="Required next evidence" value={validationState.required_next_evidence.join("; ")} />
        <OperatorField label="Candidate validation authority" value={validationState.authority_status} />
        <OperatorField label="Candidate validation no authority" value={formatNoAuthority(validationState.no_authority)} />
      </OperatorEvidenceRow>
    </OperatorEvidenceBlock>
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
    <OperatorEvidenceStatus
      label={compact ? "Latest validation state" : "Read-only validation state"}
      value={validationState.validation_state}
      detail={validationState.validation_label}
      tone={validationStateStatusClass(validationState.validation_state)}
    />
  );
}

function latestValidationStateLabel(validationState: CandidateLatestValidationStateReadModel | undefined): string {
  return validationState?.validation_state ?? "replay_required";
}

function validationStateStatusClass(
  validationState: CandidateLatestValidationStateReadModel["validation_state"]
): "neutral" | "counted" | "failed" | "sealed" {
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
    <>
      <OperatorEvidenceBlock title="Selected run detail" aria-label="Selected run detail">
        <OperatorEvidenceRow>
          <OperatorField label="Run" value={detail.run_id} />
          <OperatorField label="Score / risk" value={`${detail.score} / ${detail.risk_decision}`} />
          <OperatorField label="Scenario ids" value={detail.scenario_ids.join(", ")} />
          <OperatorField label="Replay detail no authority" value={formatNoAuthority(detail.no_authority)} />
          <OperatorField label="Promotion" value={detail.provenance.promotion_id ?? "none"} />
          <OperatorField label="Source session" value={detail.provenance.source_session_id ?? "none"} />
          <OperatorField label="Events" value={detail.events_path} />
        </OperatorEvidenceRow>
      </OperatorEvidenceBlock>

      {detail.scenarios.map((scenario) => (
        <OperatorEvidenceBlock title={scenario.scenario_id} key={scenario.scenario_id}>
          <OperatorEvidenceRow>
            <OperatorField label="Status" value={`${scenario.status} / ${scenario.run_status}`} />
            <OperatorField label="Replay scenario runner" value={scenario.runner_kind} />
            <OperatorField label="Score / risk" value={`${scenario.score} / ${scenario.risk_decision}`} />
            <OperatorField label="Summary" value={scenario.summary} />
            <OperatorField label="Provider requests" value={String(scenario.provider_request_count)} />
            <OperatorField label="Replay scenario runner commands" value={String(scenario.runner_command_count)} />
            {scenario.metrics.map((metric) => (
              <OperatorField
                key={metric.name}
                label={`Metric ${metric.name}`}
                value={`${metric.score}: ${metric.detail}`}
              />
            ))}
            {scenario.runner_command_evidence.map((evidence, index) => (
              <OperatorField
                key={`${scenario.scenario_id}-command-${index}`}
                label={`Command ${index + 1}`}
                value={`${evidence.command.join(" ")} -> ${evidence.exit_code ?? "signal"}`}
              />
            ))}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>
      ))}
    </>
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
      <OperatorInfoSection title="Trading gateway contract" summary="not projected / not_live" badge="none">
        <OperatorEmptyState
          title="No trading gateway contract"
          description="BTCUSDT gateway contract has not been projected"
          detail="not_live"
        />
      </OperatorInfoSection>
    );
  }

  return (
    <OperatorInfoSection
      title="Trading gateway contract"
      summary={`${contract.gateway_name} / ${contract.authority_status}`}
      badge={contract.authority_status}
    >
      <OperatorField label="Gateway" value={contract.gateway_name} />
      <OperatorField
        label="Sandbox exchange access"
        value={`sandbox_direct_exchange_access=${String(contract.sandbox_direct_exchange_access)}`}
      />
      <OperatorField
        label="Gateway required"
        value={contract.gateway_required_for.join(", ")}
      />
      <OperatorField
        label="Tracking chain"
        value={contract.tracking_chain.map(canonicalGatewayTrackingStep).join(" -> ")}
      />
      <OperatorField
        label="Market data"
        value={[
          contract.market_data.security_type,
          contract.market_data.status,
          contract.market_data.authority_status
        ].join(" / ")}
      />
      <OperatorField
        label="Account read"
        value={[
          contract.account_read.security_type,
          contract.account_read.status,
          contract.account_read.endpoint_labels.join(", "),
          `gateway_required=${String(contract.account_read.gateway_required)}, authority=${contract.account_read.authority_status}`
        ].join(" / ")}
      />
      <OperatorField
        label="Order submission"
        value={[
          contract.order_submission.security_type,
          contract.order_submission.status,
          contract.order_submission.endpoint_labels.join(", "),
          `gateway_required=${String(contract.order_submission.gateway_required)}, authority=${contract.order_submission.authority_status}`
        ].join(" / ")}
      />
      <OperatorField
        label="No-authority proof"
        value={[
          `raw_secret_material_present=${String(contract.no_authority.raw_secret_material_present)}`,
          `no_private_read_performed=${String(contract.no_authority.no_private_read_performed)}`,
          `signed_request_authority=${String(contract.no_authority.signed_request_authority)}`,
          `live_exchange_authority=${String(contract.no_authority.live_exchange_authority)}`,
          `authority_status=${contract.authority_status}`
        ].join(", ")}
      />
    </OperatorInfoSection>
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
    <OperatorInfoSection
      title="Trading gateway environment"
      summary={`${environment.runtime_environment} / ${environment.configuration_status}`}
      badge={environment.configuration_status}
    >
      <OperatorField
        label="Runtime binding"
        value={`${environment.runtime_environment} / ${environment.runtime_environment_source}`}
      />
      <OperatorField
        label="Exchange binding"
        value={`${formatGatewayEnvironment(environment.exchange_environment)} / ${environment.exchange_environment_source}`}
      />
      <OperatorField
        label="Configuration"
        value={`${environment.configuration_status} / ${environment.configuration_reason}`}
      />
      <OperatorField label="REST base URL" value={environment.rest_base_url ?? "not_configured"} />
      <OperatorField
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
      <OperatorField
        label="Live binding"
        value={`${environment.runtime_bindings.live.status} / ${environment.runtime_bindings.live.disabled_reason}`}
      />
      <OperatorField label="Credential scope" value={environment.credential_scope} />
      <OperatorField
        label="Credentials configured"
        value={[
          `api_key=${String(environment.api_key_configured)}`,
          `api_secret=${String(environment.api_secret_configured)}`,
          environment.credential_source
        ].join(", ")}
      />
      <OperatorField
        label="Gateway environment authority"
        value={[
          `live_exchange=${String(environment.live_exchange_authority)}`,
          `order_submission=${String(environment.order_submission_authority)}`,
          environment.authority_status
        ].join(", ")}
      />
      <OperatorField
        label="Env vars"
        value={Object.values(environment.env_var_names).join(", ")}
      />
      {environment.warnings.length > 0 && (
        <OperatorField label="Warnings" value={environment.warnings.join(", ")} />
      )}
    </OperatorInfoSection>
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
    <OperatorInfoSection
      title="Trading Substrate"
      summary={`${publicMarketSurface?.symbol_status ?? "public unknown"} / ${privateReadinessSurface?.credential_gate.status ?? "private not ready"}`}
      badge={privateReadinessPolicyDecision?.status ?? "not_ready"}
    >
      <OperatorEvidenceStack>
      {publicMarketSurface ? (
        <OperatorEvidenceBlock title="Public market posture" aria-label="Public market posture">
          <OperatorEvidenceStatus
            label="Public market posture"
            value={publicMarketSurface.symbol_status}
            detail={publicMarketSurface.authority_status}
            tone={publicMarketStatusTone(publicMarketSurface)}
          />
          <OperatorField label="Public surface" value={publicMarketSurface.surface_label} />
          <OperatorField label="Venue" value={`${publicMarketSurface.venue} / ${publicMarketSurface.product_category}`} />
          <OperatorField label="Instrument" value={publicMarketSurface.instrument} />
          <OperatorField label="Contract" value={publicMarketSurface.contract_type} />
          <OperatorField label="Symbol status" value={publicMarketSurface.symbol_status} />
          <OperatorField label="Price tick" value={publicMarketSurface.price_tick_size} />
          <OperatorField label="Quantity step / min" value={[
            publicMarketSurface.quantity_step_size,
            publicMarketSurface.min_quantity
          ].join(" / ")} />
          <OperatorField label="Min notional" value={publicMarketSurface.min_notional ?? "none"} />
          <OperatorField label="Mark / index" value={[
            publicMarketSurface.mark_price,
            publicMarketSurface.index_price
          ].join(" / ")} />
          <OperatorField label="Estimated settle" value={publicMarketSurface.estimated_settle_price ?? "none"} />
          <OperatorField label="Funding / interest" value={[
            publicMarketSurface.funding_rate,
            publicMarketSurface.interest_rate ?? "none"
          ].join(" / ")} />
          <OperatorField label="Next funding" value={publicMarketSurface.next_funding_time} />
          <OperatorField label="Server time" value={publicMarketSurface.server_time} />
          <OperatorField label="Public freshness" value={`${publicMarketSurface.freshness} / ${publicMarketSurface.liveness}`} />
          <OperatorField label="Public source" value={formatSubstrateSource(publicMarketSurface)} />
          <OperatorField label="Public connector package" value={publicMarketSurface.transport.package_name} />
          <OperatorField label="Public connector repository" value={publicMarketSurface.transport.repository} />
          <OperatorField
            label="Public connector endpoints"
            value={publicMarketSurface.transport.supported_endpoints.join(", ")}
          />
          <OperatorField label="Public connector role" value={publicMarketSurface.transport.integration_role} />
          <OperatorField label="Public connector URLs" value={[
            publicMarketSurface.transport.production_base_url,
            publicMarketSurface.transport.testnet_base_url
          ].join(" / ")} />
          <OperatorField label="Public source timestamp" value={publicMarketSurface.source_timestamp} />
          <OperatorField label="Public observed" value={publicMarketSurface.observed_at} />
          <OperatorField label="Public updated" value={publicMarketSurface.updated_at} />
          {publicMarketSurface.degraded_reason && (
            <OperatorField label="Public reason" value={publicMarketSurface.degraded_reason} />
          )}
          <OperatorField label="Public no authority" value={publicMarketSurface.no_authority_label} />
          <OperatorField label="Public authority" value={publicMarketSurface.authority_status} />
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No public market surface"
          description="BTCUSDT market posture has not been recorded"
          detail="not_live"
        />
      )}
      {privateReadinessSurface ? (
        <OperatorEvidenceBlock title="Private readiness preflight" aria-label="Private readiness preflight">
          <OperatorEvidenceStatus
            label="Private readiness preflight"
            value={privateReadinessSurface.credential_gate.status}
            detail={privateReadinessSurface.authority_status}
            tone={privateReadinessStatusTone(privateReadinessSurface)}
          />
          <OperatorField label="Private surface" value={privateReadinessSurface.surface_label} />
          <OperatorField
            label="Private venue"
            value={`${privateReadinessSurface.venue} / ${privateReadinessSurface.product_category}`}
          />
          <OperatorField label="Private instrument" value={privateReadinessSurface.instrument} />
          <OperatorField label="Credential gate" value={formatPrivateReadinessGate(privateReadinessSurface.credential_gate)} />
          <OperatorField
            label="Jurisdiction gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.jurisdiction_gate)}
          />
          <OperatorField
            label="Operator approval gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.operator_approval_gate)}
          />
          <OperatorField
            label="Account read gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.private_account_read_gate)}
          />
          <OperatorField
            label="Position read gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.private_position_read_gate)}
          />
          <OperatorField
            label="User stream gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.user_data_stream_gate)}
          />
          <OperatorField label="Listen key gate" value={formatPrivateReadinessGate(privateReadinessSurface.listen_key_gate)} />
          <OperatorField
            label="Order submission gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.order_submission_gate)}
          />
          <OperatorField
            label="Leverage / margin gate"
            value={formatPrivateReadinessGate(privateReadinessSurface.leverage_or_margin_mutation_gate)}
          />
          <OperatorField
            label="Private endpoints"
            value={[
              privateReadinessSurface.account_information_endpoint,
              privateReadinessSurface.user_data_stream_endpoint,
              privateReadinessSurface.order_endpoint
            ].join(" / ")}
          />
          <OperatorField label="Next blocked action" value={privateReadinessSurface.next_blocked_action} />
          <OperatorField label="Next blocked reason" value={privateReadinessSurface.next_blocked_reason} />
          <OperatorField
            label="Private freshness"
            value={`${privateReadinessSurface.freshness} / ${privateReadinessSurface.liveness}`}
          />
          <OperatorField label="Private source" value={formatSubstrateSource(privateReadinessSurface)} />
          <OperatorField label="Private connector package" value={privateReadinessSurface.transport.package_name} />
          <OperatorField label="Private connector repository" value={privateReadinessSurface.transport.repository} />
          <OperatorField label="Private connector role" value={privateReadinessSurface.transport.integration_role} />
          <OperatorField label="Private source timestamp" value={privateReadinessSurface.source_timestamp} />
          <OperatorField label="Private observed" value={privateReadinessSurface.observed_at} />
          <OperatorField label="Private updated" value={privateReadinessSurface.updated_at} />
          {privateReadinessSurface.degraded_reason && (
            <OperatorField label="Private reason" value={privateReadinessSurface.degraded_reason} />
          )}
          <OperatorField label="Private no authority" value={privateReadinessSurface.no_authority_label} />
          <OperatorField label="Private authority" value={privateReadinessSurface.authority_status} />
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No private readiness preflight"
          description="BTCUSDT private-read gates have not been recorded"
          detail="not_live"
        />
      )}
      {privateReadinessPosture ? (
        <OperatorEvidenceBlock title="Private-readiness posture" aria-label="Private-readiness posture">
          <OperatorEvidenceStatus
            label="Private-readiness posture"
            value={privateReadinessPosture.live_binding_gate.status}
            detail={privateReadinessPosture.authority_status}
            tone={privateReadinessPostureStatusTone(privateReadinessPosture)}
          />
          <OperatorField label="Local posture" value={privateReadinessPosture.posture_label} />
          <OperatorField
            label="Posture venue"
            value={`${privateReadinessPosture.venue} / ${privateReadinessPosture.product_category}`}
          />
          <OperatorField label="Posture instrument" value={privateReadinessPosture.instrument} />
          <OperatorField
            label="Operator approval gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.operator_approval_gate)}
          />
          <OperatorField
            label="Jurisdiction / risk gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.jurisdiction_risk_gate)}
          />
          <OperatorField
            label="Live binding gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.live_binding_gate)}
          />
          <OperatorField
            label="Secret handling gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.secret_handling_gate)}
          />
          <OperatorField
            label="Stop behavior gate"
            value={formatPrivateReadinessPolicyGate(privateReadinessPosture.stop_behavior_gate)}
          />
          <OperatorField
            label="Secret reference"
            value={privateReadinessPosture.secret_reference_configured ? "configured" : "not_configured"}
          />
          <OperatorField
            label="Raw secret material"
            value={String(privateReadinessPosture.raw_secret_material_present)}
          />
          <OperatorField label="Posture source" value={formatSubstrateSource(privateReadinessPosture)} />
          <OperatorField label="Posture source timestamp" value={privateReadinessPosture.source_timestamp} />
          <OperatorField label="Posture observed" value={privateReadinessPosture.observed_at} />
          <OperatorField label="Posture updated" value={privateReadinessPosture.updated_at} />
          <OperatorField label="Posture no authority" value={privateReadinessPosture.no_authority_label} />
          <OperatorField label="Posture authority" value={privateReadinessPosture.authority_status} />
          {privateReadinessPostureHistory && privateReadinessPostureHistory.length > 0 && (
            <OperatorEvidenceBlock title="Recent posture history" aria-label="Private-readiness posture history">
              <OperatorEvidenceStack>
              {privateReadinessPostureHistory.map((posture) => (
                <OperatorEvidenceRow key={posture.posture_id}>
                  <OperatorField label="Posture" value={posture.posture_id} />
                  <OperatorField label="Source / updated" value={`${posture.source_kind} / ${posture.updated_at}`} />
                  <OperatorField label="Gate summary" value={formatPrivateReadinessPostureGateSummary(posture)} />
                  <OperatorField label="Authority" value={`${posture.no_authority_label} / ${posture.authority_status}`} />
                </OperatorEvidenceRow>
              ))}
              </OperatorEvidenceStack>
            </OperatorEvidenceBlock>
          )}
          {previousPosture && (
            <div className="posture-delta" aria-label="Private-readiness posture delta summary">
              <h4>Posture delta summary</h4>
              <OperatorField label="Current posture" value={privateReadinessPosture.posture_id} />
              <OperatorField label="Previous posture" value={previousPosture.posture_id} />
              <OperatorField
                label="Changed gates"
                value={formatPrivateReadinessPostureGateChangeCount(postureGateChanges)}
              />
              <OperatorField
                label="Gate changes"
                value={formatPrivateReadinessPostureGateChanges(postureGateChanges)}
              />
              <OperatorField label="Delta boundary" value="local_config_delta_inspection_only" />
              <OperatorField label="Evidence boundary" value="not_counted_evidence_or_promotion" />
              <OperatorField
                label="Authority boundary"
                value="not_private_read_permission_or_execution_authority"
              />
            </div>
          )}
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No private-readiness posture"
          description="BTCUSDT local private-readiness gates have not been recorded"
          detail="not_live"
        />
      )}
      {onRecordPrivateReadinessPosture && (
        <OperatorEvidenceBlock title="Local posture edit" aria-label="Local posture edit">
          <form
            aria-label="Local private-readiness posture edit form"
            className="posture-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              onRecordPrivateReadinessPosture(postureDraft);
            }}
          >
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
            <OperatorActionRow>
              <Button
                type="submit"
                disabled={recordingPrivateReadinessPosture}
              >
                {recordingPrivateReadinessPosture ? "Saving posture" : "Save local posture"}
              </Button>
              <OperatorDetailText as="span">local_config / no_secret / not_live</OperatorDetailText>
            </OperatorActionRow>
          </form>
        </OperatorEvidenceBlock>
      )}
      <OperatorStatusStack
        messages={operatorStatusMessages(
          privateReadinessPostureMessage
            ? { id: "private-readiness-posture-message", value: privateReadinessPostureMessage }
            : undefined,
          privateReadinessPostureError
            ? { id: "private-readiness-posture-error", tone: "error", value: privateReadinessPostureError }
            : undefined
        )}
      />
      {privateReadinessPolicyDecision ? (
        <OperatorEvidenceBlock title="Private-readiness policy" aria-label="Private-readiness policy">
          <OperatorEvidenceStatus
            label="Private-readiness policy"
            value={privateReadinessPolicyDecision.status}
            detail={privateReadinessPolicyDecision.authority_status}
            tone={privateReadinessPolicyStatusTone(privateReadinessPolicyDecision)}
          />
          <OperatorField label="Policy decision" value={privateReadinessPolicyDecision.decision_kind} />
          <OperatorField label="Policy venue" value={[
            privateReadinessPolicyDecision.venue,
            privateReadinessPolicyDecision.instrument,
            privateReadinessPolicyDecision.product_category
          ].join(" / ")} />
          <OperatorField
            label="Policy Binance security types"
            value={privateReadinessPolicyDecision.binance_security_types.join(", ")}
          />
          <OperatorField label="Policy reason codes" value={privateReadinessPolicyDecision.reason_codes.join(", ")} />
          <OperatorField
            label="Policy blocking conditions"
            value={
              privateReadinessPolicyDecision.blocking_conditions.length > 0
                ? privateReadinessPolicyDecision.blocking_conditions.join(" / ")
                : "none"
            }
          />
          <OperatorField
            label="Policy checked gates"
            value={privateReadinessPolicyDecision.checked_gates
              .map((gate) => `${gate.dimension}=${gate.status}`)
              .join(", ")}
          />
          <OperatorField
            label="Policy source surfaces"
            value={privateReadinessPolicyDecision.source_surface_refs.map(formatRef).join(" / ")}
          />
          <OperatorField label="Policy evaluated" value={privateReadinessPolicyDecision.evaluated_at} />
          <OperatorField
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
              <OperatorField label="Gate decision" value={privateReadGateDecision.decision_kind} />
              <OperatorField label="Gate status" value={privateReadGateDecision.status} />
              <OperatorField label="Policy status" value={privateReadGateDecision.policy_status} />
              <OperatorField
                label="Gate scope"
                value={[
                  privateReadGateDecision.venue,
                  privateReadGateDecision.instrument,
                  privateReadGateDecision.product_category
                ].join(" / ")}
              />
              <OperatorField
                label="Credential reference"
                value={privateReadGateDecision.credential_reference_status}
              />
              <OperatorField
                label="Credential reference source"
                value={privateReadGateDecision.credential_reference_source}
              />
              {privateReadGateDecision.credential_reference_ref && (
                <OperatorField
                  label="Credential reference ref"
                  value={formatRef(privateReadGateDecision.credential_reference_ref)}
                />
              )}
              <OperatorField
                label="Signed-read preflight"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_read_permission_preflight_status}`,
                  `source=${privateReadGateDecision.signed_read_permission_preflight_source}`
                ].join(", ")}
              />
              <OperatorField
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
              <OperatorField
                label="Signed-read grant boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_read_permission_grant_boundary_status}`,
                  `source=${privateReadGateDecision.signed_read_permission_grant_boundary_source}`
                ].join(", ")}
              />
              <OperatorField
                label="Signed request execution boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.signed_request_execution_boundary_status}`,
                  `source=${privateReadGateDecision.signed_request_execution_boundary_source}`
                ].join(", ")}
              />
              <OperatorField
                label="Account / balance / position read boundary"
                value={[
                  `USER_DATA=${privateReadGateDecision.account_balance_position_read_boundary_status}`,
                  `source=${privateReadGateDecision.account_balance_position_read_boundary_source}`
                ].join(", ")}
              />
              <OperatorField
                label="Signed read permission"
                value={`USER_DATA=${privateReadGateDecision.signed_read_permission}`}
              />
              <OperatorField
                label="Account / balance / position"
                value={privateReadGateDecision.account_balance_position_read_authority}
              />
              <OperatorField
                label="ListenKey / user data stream"
                value={`USER_STREAM=${privateReadGateDecision.listen_key_user_data_stream_authority}`}
              />
              <OperatorField
                label="Leverage / margin mutation"
                value={privateReadGateDecision.leverage_margin_mutation_authority}
              />
              <OperatorField
                label="Order submission"
                value={`TRADE=${privateReadGateDecision.order_submission_authority}`}
              />
              <OperatorField
                label="Gateway / evidence / promotion"
                value={[
                  `gateway=${privateReadGateDecision.gateway_result_authority}`,
                  `evidence=${privateReadGateDecision.evidence_sealing_authority}`,
                  `promotion=${privateReadGateDecision.promotion_authority}`
                ].join(", ")}
              />
              <OperatorField
                label="Gate no-authority proof"
                value={[
                  `raw_secret_material_present=${String(privateReadGateDecision.raw_secret_material_present)}`,
                  `no_private_read_performed=${String(privateReadGateDecision.no_private_read_performed)}`,
                  `signed_request_authority=${String(privateReadGateDecision.signed_request_authority)}`,
                  `live_exchange_authority=${String(privateReadGateDecision.live_exchange_authority)}`,
                  `authority_status=${privateReadGateDecision.authority_status}`
                ].join(", ")}
              />
              <OperatorField
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
          <OperatorEvidencePanel
            className="checked-gate-matrix"
            label="Private-readiness checked-gate matrix"
          >
            {privateReadinessPolicyDecision.checked_gates.length > 0 ? (
              privateReadinessPolicyDecision.checked_gates.map((gate) => (
                <OperatorEvidenceRow className="checked-gate-row" key={gate.dimension}>
                  <strong>{gate.dimension}</strong>
                  <span>{gate.status}</span>
                  <span>{gate.reason_code}</span>
                  <span>{gate.reason}</span>
                  <span>{formatPrivateReadinessCheckedGatePosture(gate.status)}</span>
                </OperatorEvidenceRow>
              ))
            ) : (
              <OperatorEvidenceRow className="checked-gate-row">
                <strong>no_checked_gates</strong>
                <span>none</span>
                <span>none</span>
                <span>policy_decision_contains_no_checked_gates</span>
                <span>inspection_only</span>
              </OperatorEvidenceRow>
            )}
            <OperatorField label="Matrix boundary" value="checked_gate_matrix_inspection_only" />
            <OperatorField label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <OperatorField
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </OperatorEvidencePanel>
          <OperatorEvidencePanel
            className="remediation-action-map"
            label="Private-readiness remediation/action map"
          >
            {remediationActionRows.length > 0 ? (
              remediationActionRows.map((row) => (
                <OperatorEvidenceRow className="remediation-action-row" key={row.action}>
                  <strong>{row.action}</strong>
                  <span>{row.target}</span>
                  <span>{row.posture}</span>
                  <span>{row.detail}</span>
                  <span>{row.guidanceBoundary}</span>
                </OperatorEvidenceRow>
              ))
            ) : (
              <OperatorEvidenceRow className="remediation-action-row">
                <strong>no_required_next_actions</strong>
                <span>none</span>
                <span>none</span>
                <span>policy_decision_contains_no_required_next_actions</span>
                <span>read_only_remediation_guidance</span>
              </OperatorEvidenceRow>
            )}
            <OperatorField label="Map boundary" value="remediation_action_map_guidance_only" />
            <OperatorField label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <OperatorField
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </OperatorEvidencePanel>
          <OperatorEvidencePanel
            className="remediation-progress-summary"
            label="Private-readiness remediation progress summary"
          >
            <OperatorField label="Action coverage" value={remediationProgressSummary.coverage} />
            <OperatorField label="Blocking / review focus" value={remediationProgressSummary.blockingReviewFocus} />
            <OperatorField label="Next review focus" value={remediationProgressSummary.nextReviewFocus} />
            <OperatorField label="Progress state" value={remediationProgressSummary.progressState} />
            <OperatorField label="Summary boundary" value="remediation_progress_summary_guidance_only" />
            <OperatorField label="Evidence boundary" value="not_counted_evidence_or_promotion" />
            <OperatorField
              label="Authority boundary"
              value="not_private_read_permission_or_execution_authority"
            />
          </OperatorEvidencePanel>
          {privateReadinessPosture && (
            <>
              <OperatorEvidencePanel
                className="policy-impact"
                label="Private-readiness policy impact interpretation"
                title="Policy impact interpretation"
              >
                <OperatorField label="Policy input posture" value={privateReadinessPosture.posture_id} />
                <OperatorField label="History role" value="inspection_context_only" />
                <OperatorField
                  label="Policy impact"
                  value={formatPrivateReadinessPolicyImpact(privateReadinessPolicyDecision)}
                />
                <OperatorField
                  label="Policy next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <OperatorField
                  label="Evidence boundary"
                  value="local_config_inspection_not_counted_evidence_or_promotion"
                />
                <OperatorField
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `authority_status=${privateReadinessPolicyDecision.authority_status}`
                  ].join(", ")}
                />
                <OperatorField
                  label="Authority boundary"
                  value="not_private_read_permission_or_execution_authority"
                />
              </OperatorEvidencePanel>
              <OperatorEvidencePanel
                className="review-handoff"
                label="Private-readiness review handoff"
              >
                <OperatorField
                  label="Review scope"
                  value={[
                    privateReadinessPolicyDecision.venue,
                    privateReadinessPolicyDecision.instrument,
                    privateReadinessPolicyDecision.product_category
                  ].join(" / ")}
                />
                <OperatorField label="Latest posture" value={privateReadinessPosture.posture_id} />
                <OperatorField
                  label="Posture delta"
                  value={formatPrivateReadinessReviewHandoffDelta(previousPosture, postureGateChanges)}
                />
                <OperatorField
                  label="Policy summary"
                  value={formatPrivateReadinessPolicyImpact(privateReadinessPolicyDecision)}
                />
                <OperatorField
                  label="Required next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <OperatorField
                  label="Review checklist"
                  value={formatPrivateReadinessReviewChecklist(privateReadinessPolicyDecision, previousPosture)}
                />
                <OperatorField
                  label="Handoff boundary"
                  value="review_handoff_only_not_counted_evidence_or_promotion"
                />
                <OperatorField
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `authority_status=${privateReadinessPolicyDecision.authority_status}`
                  ].join(", ")}
                />
                <OperatorField
                  label="Authority boundary"
                  value="not_private_read_permission_or_execution_authority"
                />
              </OperatorEvidencePanel>
              <OperatorEvidencePanel
                className="authority-preview"
                label="Private-readiness authority gate preview"
              >
                <OperatorField
                  label="Preview scope"
                  value={[
                    privateReadinessPolicyDecision.venue,
                    privateReadinessPolicyDecision.instrument,
                    privateReadinessPolicyDecision.product_category
                  ].join(" / ")}
                />
                <OperatorField
                  label="Private-read authority"
                  value={formatPrivateReadinessAuthorityGateState(privateReadinessPolicyDecision)}
                />
                <OperatorField
                  label="Gate readiness"
                  value={formatPrivateReadinessAuthorityGateReadiness(privateReadinessPolicyDecision)}
                />
                <OperatorField
                  label={
                    privateReadinessPolicyDecision.blocking_conditions.length > 0
                      ? "Blocking conditions"
                      : "No blocking conditions"
                  }
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.blocking_conditions)}
                />
                <OperatorField
                  label="Required next actions"
                  value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
                />
                <OperatorField
                  label="Preview next step"
                  value={formatPrivateReadinessAuthorityGateNextStep(privateReadinessPolicyDecision)}
                />
                <OperatorField
                  label="Preview boundary"
                  value="authority_gate_preview_only_not_private_read_permission_or_execution_authority"
                />
                <OperatorField label="Preview evidence boundary" value="not_counted_evidence_or_promotion" />
                <OperatorField
                  label="No-authority proof"
                  value={[
                    `no_private_read_performed=${String(privateReadinessPolicyDecision.no_private_read_performed)}`,
                    `signed_request_authority=${String(privateReadinessPolicyDecision.signed_request_authority)}`,
                    `live_exchange_authority=${String(privateReadinessPolicyDecision.live_exchange_authority)}`,
                    `order_submission_authority=${String(privateReadinessPolicyDecision.order_submission_authority)}`
                  ].join(", ")}
                />
              </OperatorEvidencePanel>
            </>
          )}
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No private-readiness policy"
          description="BTCUSDT private-readiness decision has not been projected"
          detail="not_live"
        />
      )}
      {accountPositionRiskSurface ? (
        <OperatorEvidenceBlock title="Account position risk mirror" aria-label="Account position risk mirror">
          <OperatorEvidenceStatus
            label="Account position risk mirror"
            value={accountPositionRiskSurface.risk_status}
            detail={accountPositionRiskSurface.authority_status}
            tone={accountPositionRiskStatusTone(accountPositionRiskSurface)}
          />
          <OperatorField label="Account risk surface" value={accountPositionRiskSurface.surface_label} />
          <OperatorField
            label="Account risk venue"
            value={`${accountPositionRiskSurface.venue} / ${accountPositionRiskSurface.product_category}`}
          />
          <OperatorField label="Account risk instrument" value={accountPositionRiskSurface.instrument} />
          <OperatorField label="Account scope" value={accountPositionRiskSurface.account_scope_ref} />
          <OperatorField label="Asset / mode" value={[
            accountPositionRiskSurface.asset,
            accountPositionRiskSurface.account_mode
          ].join(" / ")} />
          <OperatorField label="Wallet / margin balance" value={[
            accountPositionRiskSurface.total_wallet_balance,
            accountPositionRiskSurface.total_margin_balance
          ].join(" / ")} />
          <OperatorField label="Available / max withdraw" value={[
            accountPositionRiskSurface.available_balance,
            accountPositionRiskSurface.max_withdraw_amount
          ].join(" / ")} />
          <OperatorField label="Initial / maintenance margin" value={[
            accountPositionRiskSurface.total_initial_margin,
            accountPositionRiskSurface.total_maint_margin
          ].join(" / ")} />
          <OperatorField label="Position / open-order margin" value={[
            accountPositionRiskSurface.total_position_initial_margin,
            accountPositionRiskSurface.total_open_order_initial_margin
          ].join(" / ")} />
          <OperatorField label="Cross wallet / PnL" value={[
            accountPositionRiskSurface.total_cross_wallet_balance,
            accountPositionRiskSurface.total_cross_un_pnl
          ].join(" / ")} />
          <OperatorField label="Position side / amount" value={[
            accountPositionRiskSurface.position_side,
            accountPositionRiskSurface.position_amount
          ].join(" / ")} />
          <OperatorField label="Entry / breakeven" value={[
            accountPositionRiskSurface.entry_price,
            accountPositionRiskSurface.break_even_price
          ].join(" / ")} />
          <OperatorField label="Mark / liquidation" value={[
            accountPositionRiskSurface.mark_price,
            accountPositionRiskSurface.liquidation_price
          ].join(" / ")} />
          <OperatorField label="Notional / unrealized PnL" value={[
            accountPositionRiskSurface.notional,
            accountPositionRiskSurface.unrealized_profit
          ].join(" / ")} />
          <OperatorField label="Margin asset / type" value={[
            accountPositionRiskSurface.margin_asset,
            accountPositionRiskSurface.margin_type
          ].join(" / ")} />
          <OperatorField label="Leverage / ADL" value={[
            String(accountPositionRiskSurface.leverage),
            accountPositionRiskSurface.adl_quantile === undefined
              ? "none"
              : String(accountPositionRiskSurface.adl_quantile)
          ].join(" / ")} />
          <OperatorField label="Risk status" value={accountPositionRiskSurface.risk_status} />
          <OperatorField label="Risk profile" value={accountPositionRiskSurface.risk_limit_profile_ref} />
          <OperatorField label="Max notional" value={accountPositionRiskSurface.max_notional_value} />
          <OperatorField label="Kill switch / pause" value={[
            accountPositionRiskSurface.kill_switch_status,
            accountPositionRiskSurface.runtime_pause_status
          ].join(" / ")} />
          <OperatorField
            label="Account risk endpoints"
            value={[
              accountPositionRiskSurface.account_information_endpoint,
              accountPositionRiskSurface.position_information_endpoint,
              accountPositionRiskSurface.leverage_endpoint,
              accountPositionRiskSurface.margin_type_endpoint
            ].join(" / ")}
          />
          <OperatorField label="Account risk next action" value={accountPositionRiskSurface.next_blocked_action} />
          <OperatorField label="Account risk blocked reason" value={accountPositionRiskSurface.next_blocked_reason} />
          <OperatorField
            label="Account risk freshness"
            value={`${accountPositionRiskSurface.freshness} / ${accountPositionRiskSurface.liveness}`}
          />
          <OperatorField label="Account risk source" value={formatSubstrateSource(accountPositionRiskSurface)} />
          <OperatorField label="Account risk connector package" value={accountPositionRiskSurface.transport.package_name} />
          <OperatorField label="Account risk connector repository" value={accountPositionRiskSurface.transport.repository} />
          <OperatorField label="Account risk connector role" value={accountPositionRiskSurface.transport.integration_role} />
          <OperatorField label="Account risk source timestamp" value={accountPositionRiskSurface.source_timestamp} />
          <OperatorField label="Account risk observed" value={accountPositionRiskSurface.observed_at} />
          <OperatorField label="Account risk updated" value={accountPositionRiskSurface.updated_at} />
          {accountPositionRiskSurface.degraded_reason && (
            <OperatorField label="Account risk reason" value={accountPositionRiskSurface.degraded_reason} />
          )}
          <OperatorField label="Account risk no authority" value={accountPositionRiskSurface.no_authority_label} />
          <OperatorField label="Account risk authority" value={accountPositionRiskSurface.authority_status} />
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No account position risk mirror"
          description="BTCUSDT account, position, and risk posture has not been recorded"
          detail="not_live"
        />
      )}
      {orderFillSurface ? (
        <OperatorEvidenceBlock title="Order-fill posture" aria-label="Order-fill posture">
          <OperatorEvidenceStatus
            label="Order-fill posture"
            value={orderFillSurface.posture}
            detail={orderFillSurface.authority_status}
            tone={orderFillStatusTone(orderFillSurface)}
          />
          <OperatorField label="Order-fill surface" value={orderFillSurface.surface_label} />
          <OperatorField label="Order venue" value={`${orderFillSurface.venue} / ${orderFillSurface.product_category}`} />
          <OperatorField label="Order instrument" value={orderFillSurface.instrument} />
          <OperatorField label="Raw upstream" value={[
            orderFillSurface.raw_upstream_status,
            orderFillSurface.raw_upstream_execution_type ?? "none"
          ].join(" / ")} />
          <OperatorField label="Order scope" value={orderFillSurface.order_scope_ref} />
          <OperatorField label="Client order" value={orderFillSurface.local_client_order_id ?? "none"} />
          <OperatorField label="Upstream order" value={orderFillSurface.upstream_order_id ?? "none"} />
          <OperatorField label="Order side / type" value={[
            orderFillSurface.side ?? "none",
            orderFillSurface.order_type ?? "none",
            orderFillSurface.time_in_force ?? "none"
          ].join(" / ")} />
          <OperatorField label="Requested" value={orderFillSurface.requested_quantity ?? "none"} />
          <OperatorField label="Filled / remaining" value={[
            orderFillSurface.cumulative_filled_quantity,
            orderFillSurface.remaining_quantity
          ].join(" / ")} />
          <OperatorField label="Average / last price" value={[
            orderFillSurface.average_fill_price ?? "none",
            orderFillSurface.last_fill_price ?? "none"
          ].join(" / ")} />
          <OperatorField label="Order freshness" value={`${orderFillSurface.freshness} / ${orderFillSurface.liveness}`} />
          <OperatorField label="Order source" value={formatSubstrateSource(orderFillSurface)} />
          <OperatorField label="Order connector package" value={orderFillSurface.transport.package_name} />
          <OperatorField label="Order connector repository" value={orderFillSurface.transport.repository} />
          <OperatorField label="Order connector endpoints" value={orderFillSurface.transport.supported_endpoints.join(", ")} />
          <OperatorField label="Order connector role" value={orderFillSurface.transport.integration_role} />
          <OperatorField label="Connector URLs" value={[
            orderFillSurface.transport.production_base_url,
            orderFillSurface.transport.testnet_base_url
          ].join(" / ")} />
          <OperatorField label="Order source timestamp" value={orderFillSurface.source_timestamp} />
          <OperatorField label="Order observed" value={orderFillSurface.observed_at} />
          <OperatorField label="Order updated" value={orderFillSurface.updated_at} />
          {orderFillSurface.degraded_reason && <OperatorField label="Order reason" value={orderFillSurface.degraded_reason} />}
          <OperatorField label="Order no authority" value={orderFillSurface.no_authority_label} />
          <OperatorField label="Order authority" value={orderFillSurface.authority_status} />
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEmptyState
          title="No order-fill surface"
          description="BTCUSDT posture has not been recorded"
          detail="not_live"
        />
      )}
      </OperatorEvidenceStack>
    </OperatorInfoSection>
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
      <OperatorEvidencePanel
        className="review-packet-completion-readiness-summary"
        label="Private-readiness review packet completion/readiness summary"
      >
        <OperatorField
          label="Completion/readiness summary"
          value={projection.completionReadinessSummary.countSummary}
        />
        <OperatorField
          label="Next review focus"
          value={projection.completionReadinessSummary.nextReviewFocus}
        />
        <OperatorField
          label="Next completion focus"
          value={projection.completionReadinessSummary.nextCompletionFocus}
        />
        <OperatorField
          label="Readiness state"
          value={projection.completionReadinessSummary.readinessState}
        />
        <OperatorField
          label="Completion/readiness context"
          value={projection.completionReadinessSummary.boundary}
        />
        <ReviewPacketBoundaryFields
          label="Completion/readiness boundary"
          value="review_packet_completion_readiness_navigation_only"
        />
      </OperatorEvidencePanel>

      <OperatorEvidencePanel
        className="review-packet-index"
        label="Private-readiness review packet index"
      >
        {projection.indexEntries.map((entry) => (
          <OperatorEvidenceRow className="review-packet-index-row" key={entry.step}>
            <strong>{entry.step}</strong>
            <span>{entry.surface}</span>
            <span>{entry.role}</span>
            <span>{entry.boundary}</span>
          </OperatorEvidenceRow>
        ))}
        <OperatorField
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
      </OperatorEvidencePanel>

      <OperatorEvidencePanel
        className="review-packet-availability-summary"
        label="Private-readiness review packet availability summary"
      >
        {projection.availabilitySummary.rows.map((row) => (
          <OperatorEvidenceRow className="review-packet-availability-row" key={row.step}>
            <strong>{row.step}</strong>
            <span>{row.availability}</span>
            <span>{row.detail}</span>
            <span>{row.boundary}</span>
          </OperatorEvidenceRow>
        ))}
        <OperatorField
          label="Availability summary"
          value={projection.availabilitySummary.countSummary}
        />
        <ReviewPacketBoundaryFields
          label="Availability boundary"
          value="review_packet_availability_summary_navigation_only"
        />
      </OperatorEvidencePanel>

      <OperatorEvidencePanel
        className="review-packet-gap-summary"
        label="Private-readiness review packet gap summary"
      >
        <OperatorField label="Gap summary" value={projection.gapSummary.countSummary} />
        <OperatorField label="Next gap focus" value={projection.gapSummary.nextGapFocus} />
        <OperatorField label="Gap state" value={projection.gapSummary.gapState} />
        <ReviewPacketBoundaryFields
          label="Gap boundary"
          value="review_packet_gap_summary_navigation_only"
        />
      </OperatorEvidencePanel>

      <OperatorEvidencePanel
        className="review-packet-resolution-checklist"
        label="Private-readiness review packet resolution checklist"
      >
        {projection.resolutionChecklist.items.map((item) => (
          <OperatorEvidenceRow className="review-packet-resolution-row" key={`${item.item}-${item.source}`}>
            <strong>{item.item}</strong>
            <span>{item.source}</span>
            <span>{item.status}</span>
            <span>{item.detail}</span>
            <span>{item.boundary}</span>
          </OperatorEvidenceRow>
        ))}
        <OperatorField
          label="Resolution checklist"
          value={projection.resolutionChecklist.countSummary}
        />
        <OperatorField
          label="Next resolution focus"
          value={projection.resolutionChecklist.nextResolutionFocus}
        />
        <OperatorField
          label="Checklist state"
          value={projection.resolutionChecklist.checklistState}
        />
        <ReviewPacketBoundaryFields
          label="Checklist boundary"
          value="review_packet_resolution_checklist_navigation_only"
        />
      </OperatorEvidencePanel>

      <OperatorEvidencePanel
        className="review-packet-source-provenance-summary"
        label="Private-readiness review packet source/provenance summary"
      >
        {projection.sourceProvenanceSummary.rows.map((row) => (
          <OperatorEvidenceRow className="review-packet-source-provenance-row" key={`${row.item}-${row.source}`}>
            <strong>{row.item}</strong>
            <span>{row.source}</span>
            <span>{row.provenance}</span>
            <span>{row.detail}</span>
            <span>{row.boundary}</span>
          </OperatorEvidenceRow>
        ))}
        <OperatorField
          label="Source/provenance summary"
          value={projection.sourceProvenanceSummary.countSummary}
        />
        <OperatorField
          label="Next source focus"
          value={projection.sourceProvenanceSummary.nextSourceFocus}
        />
        <OperatorField
          label="Source state"
          value={projection.sourceProvenanceSummary.sourceState}
        />
        <ReviewPacketBoundaryFields
          label="Source/provenance boundary"
          value="review_packet_source_provenance_navigation_only"
        />
      </OperatorEvidencePanel>
    </>
  );
}

function ReviewPacketBoundaryFields({ label, value }: { label: string; value: string }) {
  return (
    <>
      <OperatorField label={label} value={value} />
      <OperatorField label="Evidence boundary" value="not_counted_evidence_or_promotion" />
      <OperatorField
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
    <OperatorInfoSection
      title="Run Control"
      summary={`${statusLabel} / ${control?.audit_event.authority_status ?? "not_live"}`}
      badge={control?.latest_command?.action ?? statusLabel}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Trading run state"
          value={statusLabel}
          detail={control?.audit_event.authority_status ?? "not_live"}
          tone={control?.chain_complete ? "counted" : "neutral"}
        />

        <OperatorEvidenceRow>
          <OperatorField label="Activity" value={control?.has_activity ? "recorded" : "none"} />
          <OperatorField label="Complete chain" value={control?.chain_complete ? "yes" : "no"} />
          <OperatorField label="Command" value={control?.command.status ?? "pending_decision"} />
          <OperatorField label="Decision" value={control?.decision.status ?? "not_evaluated"} />
          <OperatorField label="Audit event" value={control?.audit_event.status ?? "not_recorded"} />
        </OperatorEvidenceRow>

        {privateReadinessPolicyDecision && (
          <OperatorEvidenceBlock
            title="Private-readiness policy alignment"
            aria-label="Run-control private-readiness policy alignment"
          >
            <OperatorEvidenceRow>
              <OperatorField
                label="Policy alignment"
                value={runtimeControlPolicyAlignment(privateReadinessPolicyDecision)}
              />
              <OperatorField label="Policy status" value={privateReadinessPolicyDecision.status} />
              <OperatorField
                label="Policy reason codes"
                value={formatPolicyListSummary(privateReadinessPolicyDecision.reason_codes)}
              />
              <OperatorField
                label="Required next actions"
                value={formatPolicyListSummary(privateReadinessPolicyDecision.required_next_actions)}
              />
              <OperatorField label="Control boundary" value="control_only / audit_only / not_live" />
              <OperatorField label="Authority boundary" value="not_private_read_permission_or_execution_authority" />
              <OperatorField
                label="Execution boundary"
                value="not_order_request_gateway_result_evidence_or_promotion"
              />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        )}

        <OperatorEvidenceBlock title="Latest control command">
          <OperatorEvidenceRow>
            {control?.latest_command ? (
              <>
                <OperatorField label="Action" value={control.latest_command.action} />
                <OperatorField label="Status" value={control.latest_command.status} />
                <OperatorField label="Actor" value={control.latest_command.actor_kind} />
                <OperatorField label="Reason" value={control.latest_command.reason} />
                <OperatorField label="Command authority" value={control.latest_command.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Command authority" value="not_live" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Latest control decision">
          <OperatorEvidenceRow>
            {control?.latest_decision ? (
              <>
                <OperatorField label="Outcome" value={control.latest_decision.decision_outcome} />
                <OperatorField label="Reason" value={control.latest_decision.decision_reason} />
                <OperatorField label="Command" value={formatRef(control.latest_decision.command_ref)} />
                <OperatorField label="Lifecycle" value={control.latest_decision.resulting_lifecycle_status ?? "unchanged"} />
                <OperatorField label="Decision authority" value={control.latest_decision.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Outcome" value="not_evaluated" />
                <OperatorField label="Decision authority" value="not_live" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Latest audit event">
          <OperatorEvidenceRow>
            {control?.latest_audit_event ? (
              <>
                <OperatorField label="Event" value={control.latest_audit_event.event_kind} />
                <OperatorField label="Command" value={control.latest_audit_event.command_ref ? formatRef(control.latest_audit_event.command_ref) : "none"} />
                <OperatorField label="Decision" value={control.latest_audit_event.decision_ref ? formatRef(control.latest_audit_event.decision_ref) : "none"} />
                <OperatorField label="Lifecycle" value={control.latest_audit_event.runtime_lifecycle_status ?? "unchanged"} />
                <OperatorField label="Audit authority" value={control.latest_audit_event.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Audit authority" value="not_live" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        {onRecordRunControl && (
          <OperatorActionRow>
            <Button
              type="button"
              onClick={onRecordRunControl}
              disabled={recordingRunControl}
            >
              {recordingRunControl ? "Recording pause" : "Record pause"}
            </Button>
            <OperatorDetailText as="span">control_only / audit_only / not_live</OperatorDetailText>
          </OperatorActionRow>
        )}
      </OperatorEvidenceStack>
      <OperatorStatusStack
        messages={operatorStatusMessages(
          runtimeControlMessage
            ? { id: "run-control-message", value: runtimeControlMessage }
            : undefined,
          runtimeControlError
            ? { id: "run-control-error", tone: "error", value: runtimeControlError }
            : undefined
        )}
      />
    </OperatorInfoSection>
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
    <OperatorInfoSection
      title="Improvement"
      summary={`proposal ${improvement?.proposal_chain_complete ? "complete" : "incomplete"} / evaluation ${improvement?.evaluation_chain_complete ? "complete" : "incomplete"}`}
      badge={statusLabel}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Proposal / experiment / evaluation"
          value={statusLabel}
          detail={improvement?.promotion.authority_status ?? "not_live"}
          tone={improvement?.chain_complete ? "counted" : "neutral"}
        />

        <OperatorEvidenceRow>
          <OperatorField label="Source model" value={improvement?.source_model ?? "automated_alignment_researcher"} />
          <OperatorField label="Proposal chain" value={improvement?.proposal_chain_complete ? "complete" : "incomplete"} />
          <OperatorField label="Evaluation chain" value={improvement?.evaluation_chain_complete ? "complete" : "incomplete"} />
          <OperatorField label="No-authority boundary" value={`live_exchange=${String(improvement?.no_authority.live_exchange ?? false)}, order_authority=${String(improvement?.no_authority.order_authority ?? false)}, credentials=${String(improvement?.no_authority.credentials ?? false)}`} />
        </OperatorEvidenceRow>

        <OperatorEvidenceBlock title="Source finding">
          <OperatorEvidenceRow>
            {improvement?.latest_source_finding ? (
              <>
                <OperatorField label="Finding" value={improvement.latest_source_finding.finding_id} />
                <OperatorField label="Kind" value={improvement.latest_source_finding.finding_kind} />
                <OperatorField label="Summary" value={improvement.latest_source_finding.summary} />
                <OperatorField label="Source finding authority" value={improvement.latest_source_finding.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Source finding authority" value="research_trace_only" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Change proposal">
          <OperatorEvidenceRow>
            {improvement?.latest_change_proposal ? (
              <>
                <OperatorField label="Proposal" value={improvement.latest_change_proposal.proposal_id} />
                <OperatorField label="Status" value={improvement.latest_change_proposal.status} />
                <OperatorField label="System code" value={formatRef(improvement.latest_change_proposal.proposed_system_code_ref)} />
                <OperatorField label="Parent code" value={improvement.latest_change_proposal.parent_system_code_ref ? formatRef(improvement.latest_change_proposal.parent_system_code_ref) : "none"} />
                <OperatorField label="Summary" value={improvement.latest_change_proposal.proposal_summary} />
                <OperatorField label="Change proposal authority" value={improvement.latest_change_proposal.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Change proposal authority" value="proposal_only" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        {improvement?.latest_materialization && (
          <OperatorEvidenceBlock title="Materialization">
            <OperatorEvidenceRow>
              <OperatorField label="Attempt" value={improvement.latest_materialization.attempt_id} />
              <OperatorField label="Status" value={improvement.latest_materialization.status} />
              <OperatorField label="Validation" value={improvement.latest_materialization.validation_status} />
              <OperatorField label="Materialization authority" value={improvement.latest_materialization.authority_status} />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        )}

        <OperatorEvidenceBlock title="Experiment">
          <OperatorEvidenceRow>
            {improvement?.latest_experiment ? (
              <>
                <OperatorField label="Experiment" value={improvement.latest_experiment.experiment_id} />
                <OperatorField label="Status" value={improvement.latest_experiment.status} />
                <OperatorField label="System code" value={formatRef(improvement.latest_experiment.system_code_ref)} />
                <OperatorField label="Experiment authority" value={improvement.latest_experiment.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Experiment authority" value="not_live" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Evaluation result">
          <OperatorEvidenceRow>
            {improvement?.latest_evaluation_result ? (
              <>
                <OperatorField label="Result" value={improvement.latest_evaluation_result.result_id} />
                <OperatorField label="Status" value={improvement.latest_evaluation_result.result_status} />
                <OperatorField label="Disposition" value={improvement.latest_evaluation_result.evidence_disposition} />
                <OperatorField label="Score" value={String(improvement.latest_evaluation_result.total_score)} />
                <OperatorField label="Evaluation result authority" value={improvement.latest_evaluation_result.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Evaluation result authority" value="not_counted" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Evidence">
          <OperatorEvidenceRow>
            <OperatorField label="Status" value={improvement?.evidence.status ?? "missing"} />
            <OperatorField label="Reason" value={improvement?.evidence.reason ?? "evaluation_required"} />
            <OperatorField label="Improvement evidence authority" value={improvement?.evidence.authority_status ?? "not_counted"} />
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Promotion">
          <OperatorEvidenceRow>
            <OperatorField label="Status" value={improvement?.promotion.status ?? "not_promoted"} />
            <OperatorField label="Reason" value={improvement?.promotion.reason ?? "promotion_requires_sealed_evidence"} />
            <OperatorField label="Improvement promotion authority" value={improvement?.promotion.authority_status ?? "not_live"} />
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        {onRecordImprovement && (
          <OperatorActionRow>
            <Button
              type="button"
              onClick={onRecordImprovement}
              disabled={recordingImprovement}
            >
              {recordingImprovement ? "Recording improvement" : "Record improvement"}
            </Button>
            <OperatorDetailText as="span">proposal_only / sandbox_evaluation / not_live</OperatorDetailText>
          </OperatorActionRow>
        )}
      </OperatorEvidenceStack>
      <OperatorStatusStack
        messages={operatorStatusMessages(
          improvementMessage
            ? { id: "improvement-message", value: improvementMessage }
            : undefined,
          improvementError
            ? { id: "improvement-error", tone: "error", value: improvementError }
            : undefined
        )}
      />
    </OperatorInfoSection>
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
    <OperatorInfoSection
      title="Ledger"
      summary={`Order request -> Gateway result -> Execution result: ${statusLabel}`}
      badge={statusLabel}
    >
      <OperatorEvidenceStack>
        <OperatorEvidenceStatus
          label="Request / decision / result"
          value={statusLabel}
          detail={ledger?.authority_status ?? "not_live"}
          tone={ledger?.chain_complete ? "counted" : "neutral"}
        />

        <OperatorEvidenceRow>
          <OperatorField label="Complete chain" value={ledger?.chain_complete ? "yes" : "no"} />
          <OperatorField label="Order request" value={ledger?.order_request.status ?? "not_submitted"} />
          <OperatorField label="Gateway result" value={ledger?.gateway_result.status ?? "not_evaluated"} />
          <OperatorField label="Execution result" value={ledger?.execution_result.status ?? "not_submitted"} />
        </OperatorEvidenceRow>

        <OperatorEvidenceBlock title="Order request">
          <OperatorEvidenceRow>
            {ledger?.latest_order_request ? (
              <>
                <OperatorField label="Intent" value={ledger.latest_order_request.intent_kind} />
                <OperatorField label="Status" value={ledger.latest_order_request.status} />
                <OperatorField label="Order side / type" value={`${ledger.latest_order_request.side ?? "none"} / ${ledger.latest_order_request.order_type ?? "none"}`} />
                <OperatorField label="Quantity" value={ledger.latest_order_request.quantity ?? "none"} />
                <OperatorField label="Limit" value={ledger.latest_order_request.limit_price ?? "none"} />
                <OperatorField label="Order request authority" value={ledger.latest_order_request.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Order request authority" value="not_submitted" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Gateway result">
          <OperatorEvidenceRow>
            {ledger?.latest_gateway_result ? (
              <>
                <OperatorField label="Outcome" value={ledger.latest_gateway_result.decision_outcome} />
                <OperatorField label="Reason" value={ledger.latest_gateway_result.decision_reason} />
                <OperatorField label="Order request" value={formatRef(ledger.latest_gateway_result.order_request_ref)} />
                <OperatorField label="Gateway result authority" value={ledger.latest_gateway_result.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Outcome" value="not_evaluated" />
                <OperatorField label="Gateway result authority" value="not_live" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Execution result">
          <OperatorEvidenceRow>
            {ledger?.latest_execution_result ? (
              <>
                <OperatorField label="Stage" value={ledger.latest_execution_result.stage} />
                <OperatorField label="Execution result mode" value={ledger.latest_execution_result.execution_mode} />
                <OperatorField label="Status" value={ledger.latest_execution_result.status} />
                <OperatorField label="Reason" value={ledger.latest_execution_result.result_reason} />
                <OperatorField label="Gateway result" value={formatRef(ledger.latest_execution_result.gateway_result_ref)} />
                <OperatorField label="Execution result authority" value={ledger.latest_execution_result.authority_status} />
              </>
            ) : (
              <>
                <OperatorField label="Status" value="none" />
                <OperatorField label="Execution result authority" value="not_submitted" />
              </>
            )}
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        <OperatorEvidenceBlock title="Ledger history">
          <OperatorEvidenceRow>
            <OperatorField label="Chains" value={`${ledger?.chain_count ?? 0} chains`} />
            <OperatorField label="Latest first" value={ledger?.chains.length ? "yes" : "none"} />
          </OperatorEvidenceRow>
        </OperatorEvidenceBlock>

        {ledger?.chains.map((chain, index) => (
          <OperatorEvidenceBlock title={`Ledger chain ${index + 1}`} key={chain.chain_id}>
            <OperatorEvidenceRow>
              <OperatorField label="Complete" value={chain.chain_complete ? "yes" : "no"} />
              <OperatorField
                label="Order request"
                value={`${chain.order_request.side ?? "none"} / ${chain.order_request.order_type ?? "none"} / ${chain.order_request.quantity ?? "none"} @ ${chain.order_request.limit_price ?? "none"}`}
              />
              <OperatorField
                label="Gateway result"
                value={chain.gateway_result
                  ? `${chain.gateway_result.decision_outcome} / ${chain.gateway_result.decision_reason}`
                  : "not_evaluated"}
              />
              <OperatorField
                label="Execution result"
                value={chain.execution_result
                  ? `${chain.execution_result.status} / ${chain.execution_result.result_reason}`
                  : "not_submitted"}
              />
              <OperatorField label="Ledger chain authority" value={chain.authority_status} />
            </OperatorEvidenceRow>
          </OperatorEvidenceBlock>
        ))}
      </OperatorEvidenceStack>

    </OperatorInfoSection>
  );
}

function EvaluationSection({ evaluation }: { evaluation: CandidateEvaluationReadModel }) {
  const latestRun = evaluation.latest_run;
  const latestComparisonSet = evaluation.latest_comparison_set;
  const latestSealingDecision = evaluation.latest_sealing_decision;

  return (
    <OperatorEvidenceStack>
      <OperatorEvidenceStatus
        label="ResearchPreflight state"
        value={evaluationStatusLabel(evaluation)}
        detail={evaluation.counted_evidence.disposition_reason}
        tone={evaluationStatusTone(evaluation)}
      />

      {latestRun ? (
        <OperatorEvidenceBlock title="Latest ResearchPreflight run">
          <OperatorField label="ResearchPreflight run" value={latestRun.run_id} />
          <OperatorField label="ResearchPreflight status" value={latestRun.status} />
          <OperatorField label="Stage binding" value={`${latestRun.stage ?? "missing"} / ${latestRun.profile ?? "missing"}`} />
          <OperatorField label="Execution mode context" value={latestRun.execution_mode ?? "missing"} />
          <OperatorField label="ResearchPreflight trace" value={formatRef(latestRun.trace_ref)} />
          <OperatorField label="ResearchPreflight run authority" value={latestRun.authority_status} />
          {latestRun.error_state && <OperatorField label="ResearchPreflight error" value={latestRun.error_state.message} />}
        </OperatorEvidenceBlock>
      ) : (
        <OperatorEvidenceBlock title="No ResearchPreflight runs">
          <OperatorField label="ResearchPreflight status" value={evaluation.run.status} />
          <OperatorField label="ResearchPreflight run authority" value={evaluation.run.authority_status} />
          <OperatorField label="Reason" value={evaluation.counted_evidence.disposition_reason} />
        </OperatorEvidenceBlock>
      )}

      <OperatorEvidenceBlock title="ResearchPreflight comparison set">
        {latestComparisonSet ? (
          <>
            <OperatorField label="Comparability" value={latestComparisonSet.comparability_status} />
            <OperatorField label="Reason" value={latestComparisonSet.comparability_reason} />
            <OperatorField label="Comparison set authority" value={latestComparisonSet.authority_status} />
          </>
        ) : (
          <>
            <OperatorField label="Comparison set status" value={evaluation.comparison_set.status} />
            <OperatorField label="Comparison set authority" value={evaluation.comparison_set.authority_status} />
          </>
        )}
      </OperatorEvidenceBlock>

      <OperatorEvidenceBlock title="Provider trace material">
        <OperatorField label="Trace state" value={evaluation.trace.state} />
        <OperatorField label="Provider trace" value={evaluation.trace.trace_ref ? formatRef(evaluation.trace.trace_ref) : "none"} />
        <OperatorField label="Trace material authority" value={evaluation.trace.authority_status} />
        {evaluation.trace.authority_label && <OperatorField label="Label" value={evaluation.trace.authority_label} />}
        <OperatorField label="Provider artifacts" value={formatRefs(evaluation.trace.provider_output_artifact_refs)} />
        <OperatorField label="Debug artifacts" value={formatRefs(evaluation.trace.debug_artifact_refs)} />
      </OperatorEvidenceBlock>

      <OperatorEvidenceBlock title="Counted evidence state">
        <OperatorField label="Counted evidence" value={evaluation.counted_evidence.counted ? "yes" : "no"} />
        <OperatorField label="Evidence disposition" value={evaluation.counted_evidence.evidence_disposition} />
        <OperatorField label="Evidence reason" value={evaluation.counted_evidence.disposition_reason} />
        <OperatorField label="Counted evidence authority" value={evaluation.counted_evidence.authority_status} />
        {evaluation.counted_evidence.sealed_at && <OperatorField label="Sealed at" value={evaluation.counted_evidence.sealed_at} />}
        {latestSealingDecision ? (
          <>
            <OperatorField label="Sealing decision" value={latestSealingDecision.sealing_decision_id} />
            <OperatorField label="Decision disposition" value={latestSealingDecision.evidence_disposition} />
            <OperatorField label="Sealing decision authority" value={latestSealingDecision.authority_status} />
            <OperatorField label="Decision refs" value={formatRefs(latestSealingDecision.evaluation_run_refs)} />
          </>
        ) : (
          <>
            <OperatorField label="Sealing decision" value={evaluation.sealing_decision.status} />
            <OperatorField label="Sealing decision authority" value={evaluation.sealing_decision.authority_status} />
          </>
        )}
      </OperatorEvidenceBlock>

      <OperatorEvidenceBlock title="Evidence classifications">
        {evaluation.evidence_classifications.length > 0 ? (
          <OperatorEvidenceStack>
            {evaluation.evidence_classifications.map((classification) => (
              <EvidenceClassificationItem
                classification={classification}
                key={classification.classification_id}
              />
            ))}
          </OperatorEvidenceStack>
        ) : (
          <OperatorField label="Classifications" value="none" />
        )}
      </OperatorEvidenceBlock>
    </OperatorEvidenceStack>
  );
}

function EvidenceClassificationItem({
  classification
}: {
  classification: CandidateEvidenceClassificationReadModel;
}) {
  return (
    <OperatorEvidenceRow>
      <strong>{classification.classification_kind}</strong>
      <span>{classification.classification_status}</span>
      <span>{formatRef(classification.classified_ref)}</span>
      <span>{classification.classification_reason}</span>
      <span>{classification.authority_status}</span>
      {classification.sealed_by_decision_ref && <span>{formatRef(classification.sealed_by_decision_ref)}</span>}
    </OperatorEvidenceRow>
  );
}

function MaterializationAttemptSection({ attempt }: { attempt?: CandidateMaterializationAttemptReadModel }) {
  return (
    <OperatorInfoSection
      title="Materialization Attempt"
      summary={attempt ? `${attempt.status} / ${attempt.validation_status}` : "none"}
      badge={attempt?.status ?? "none"}
    >
      {attempt ? (
        <>
          <OperatorField label="Attempt" value={attempt.attempt_id} />
          <OperatorField label="Provider / model" value={`${attempt.provider_kind} / ${attempt.model}`} />
          <OperatorField label="Status" value={attempt.status} />
          <OperatorField label="Validation" value={attempt.validation_status} />
          {attempt.failure_reason && <OperatorField label="Failure reason" value={attempt.failure_reason} />}
          {attempt.resulting_candidate_ref && (
            <OperatorField label="Result candidate" value={formatRef(attempt.resulting_candidate_ref)} />
          )}
          <OperatorField label="Agent run" value={formatRef(attempt.agent_run_ref)} />
          <OperatorField label="Provider trace" value={formatRef(attempt.trace_ref)} />
          <OperatorField label="Authority label" value={attempt.authority_label} />
        </>
      ) : (
        <OperatorEmptyState
          title="No materialization attempt"
          description="provider output has not created a candidate"
          detail="provider_output_not_evidence"
        />
      )}
    </OperatorInfoSection>
  );
}

export function badgeVariant(badge: string): "default" | "secondary" | "outline" | "destructive" {
  return operatorBadgeVariant(badge);
}

function normalizeStatusValue(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function statusTokens(normalizedValue: string): string[] {
  return normalizedValue.split("_").filter(Boolean);
}

function Placeholder({ item }: { item: PlaceholderSummary }) {
  return (
    <OperatorEmptyState
      title={item.label}
      description={formatRef(item.ref)}
      detail={item.authority_status}
    />
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
