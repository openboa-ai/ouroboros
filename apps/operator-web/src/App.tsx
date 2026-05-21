import { useEffect, useState } from "react";
import type {
  AccountPositionRiskMirrorSurfaceReadModel,
  CandidateEvaluationReadModel,
  CandidateEvidenceClassificationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  CandidateMaterializationAttemptReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
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
  recordPrivateReadinessPosture as submitPrivateReadinessPosture,
  recordRunControl as submitRunControl,
  recordImprovement as submitImprovement,
  observeTradingRun as submitObserveTradingRun,
  runReplay as submitReplayRun,
  startTradingRun as submitTradingRun,
  stopTradingRun as submitStopTradingRun,
  type PaperOrderRequestSelection,
  type PrivateReadinessPostureDraft
} from "./api";
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
  selected?: CandidateInspectReadModel;
  replayRuns: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  error?: string;
  loading: boolean;
  runningTradingRun: boolean;
  recordingImprovement: boolean;
  recordingRunControl: boolean;
  recordingPrivateReadinessPosture: boolean;
  runningCandidateReplay: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
  tradingRunError?: string;
  tradingRunMessage?: string;
  improvementError?: string;
  improvementMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
  privateReadinessPostureError?: string;
  privateReadinessPostureMessage?: string;
}

export function App() {
  const [state, setState] = useState<AppState>({
    candidates: [],
    executionModes: [],
    replayRuns: [],
    loading: true,
    runningTradingRun: false,
    recordingImprovement: false,
    recordingRunControl: false,
    recordingPrivateReadinessPosture: false,
    runningCandidateReplay: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [candidates, executionModes, tradingGatewayEnvironment] = await Promise.all([
          fetchCandidateSummaries(),
          fetchTradingExecutionModeContracts(),
          fetchTradingGatewayEnvironment()
        ]);
        const first = candidates[0];
        const selected = first ? await fetchCandidate(first.candidate_id) : undefined;
        const replayRuns = selected ? await fetchReplayRunEvidence(selected.candidate_id) : [];
        const replayRunSelection = selected
          ? await fetchReplayRunSelection(selected.candidate_id, replayRuns)
          : {};
        if (!cancelled) {
          setState({
            candidates,
            executionModes,
            tradingGatewayEnvironment,
            selected,
            replayRuns,
            selectedReplayRunId: replayRunSelection.selectedReplayRunId,
            replayRunDetail: replayRunSelection.replayRunDetail,
            replayRunComparison: replayRunSelection.replayRunComparison,
            replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
            replayRunValidationState: replayRunSelection.replayRunValidationState,
            loading: false,
            runningTradingRun: false,
            recordingImprovement: false,
            recordingRunControl: false,
            recordingPrivateReadinessPosture: false,
            runningCandidateReplay: false
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            candidates: [],
            executionModes: [],
            replayRuns: [],
            loading: false,
            runningTradingRun: false,
            recordingImprovement: false,
            recordingRunControl: false,
            recordingPrivateReadinessPosture: false,
            runningCandidateReplay: false,
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
      const selected = await fetchCandidate(candidateId);
      const replayRuns = await fetchReplayRunEvidence(candidateId);
      const replayRunSelection = await fetchReplayRunSelection(candidateId, replayRuns);
      setState((current) => ({
        ...current,
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
      const outcome = await submitTradingRun(
        candidate,
        paperOrderRequest === "rejected" ? { paper_order_request: paperOrderRequest } : {}
      );
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
        runningTradingRun: false,
        tradingRunMessage: paperOrderRequest === "rejected"
          ? `rejected paper order: ${outcome.execution_result?.status ?? "blocked"}`
          : `started: ${outcome.trading_run.lifecycle_status ?? "running"}`
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
      const selected = await fetchCandidate(candidate.candidate_id);
      setState((current) => ({
        ...current,
        selected,
        runningTradingRun: false,
        tradingRunMessage: `observed: ${outcome.trading_run.lifecycle_status ?? "unknown"}`
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
      const selected = await fetchCandidate(candidate.candidate_id);
      setState((current) => ({
        ...current,
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
        improvementMessage: `evaluation recorded: ${outcome.trading_evaluation_result.result_id}`
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
        runtimeControlMessage: "Run control recorded"
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
    <main className="shell">
      <aside className="sidebar" aria-label="Candidate list">
        <div className="brand">
          <span className="brand-mark">OU</span>
          <div>
            <h1>ouroboros</h1>
            <p>Operator inspect</p>
          </div>
        </div>
        {state.candidates.map((candidate) => (
          <CandidateSummaryRow
            active={state.selected?.candidate_id === candidate.candidate_id}
            candidate={candidate}
            key={candidate.candidate_id}
            onSelectCandidate={selectCandidate}
          />
        ))}
      </aside>

      <section className="content">
        {state.loading && <div className="status-panel">Loading fixture read model...</div>}
        {state.error && <div className="status-panel error">{state.error}</div>}
        {!state.loading && !state.error && state.selected && (
          <CandidateDetail
            candidate={state.selected}
            tradingGatewayEnvironment={state.tradingGatewayEnvironment}
            replayRuns={state.replayRuns}
            selectedReplayRunId={state.selectedReplayRunId}
            replayRunDetail={state.replayRunDetail}
            replayRunComparison={state.replayRunComparison}
            replayRunComparisonBaselineId={state.replayRunComparisonBaselineId}
            replayRunValidationState={state.replayRunValidationState}
            executionModes={state.executionModes}
            onSelectReplayRun={(runId) => void selectReplayRun(runId)}
            onRunCandidateReplay={state.selected.fixture_notice.mode === "local_promoted_candidate_bundle"
              ? () => void recordReplayRun()
              : undefined}
            onStartTradingRun={state.selected.ledger
              ? () => void startTradingRun()
              : undefined}
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
            runningTradingRun={state.runningTradingRun}
            recordingImprovement={state.recordingImprovement}
            recordingRunControl={state.recordingRunControl}
            recordingPrivateReadinessPosture={state.recordingPrivateReadinessPosture}
            runningCandidateReplay={state.runningCandidateReplay}
            replayRunError={state.replayRunError}
            replayRunMessage={state.replayRunMessage}
            tradingRunError={state.tradingRunError}
            tradingRunMessage={state.tradingRunMessage}
            improvementError={state.improvementError}
            improvementMessage={state.improvementMessage}
            runtimeControlError={state.runtimeControlError}
            runtimeControlMessage={state.runtimeControlMessage}
            privateReadinessPostureError={state.privateReadinessPostureError}
            privateReadinessPostureMessage={state.privateReadinessPostureMessage}
          />
        )}
      </section>
    </main>
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
    <button
      className={`candidate-row ${active ? "active" : ""}`}
      type="button"
      onClick={() => void onSelectCandidate(candidate.candidate_id)}
    >
      <span>{candidate.display_name}</span>
      <small>
        {candidate.status} · latest validation state: {latestValidationStateLabel(candidate.latest_validation_state)}
      </small>
    </button>
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

export function CandidateDetail({
  candidate,
  tradingGatewayEnvironment,
  replayRuns = [],
  selectedReplayRunId,
  replayRunDetail,
  replayRunComparison,
  replayRunComparisonBaselineId,
  replayRunValidationState,
  executionModes = [],
  onSelectReplayRun,
  onRunCandidateReplay,
  onStartTradingRun,
  onStartRejectedPaperOrder,
  onObserveTradingRun,
  onStopTradingRun,
  onRecordImprovement,
  onRecordRunControl,
  onRecordPrivateReadinessPosture,
  runningCandidateReplay = false,
  runningTradingRun = false,
  recordingImprovement = false,
  recordingRunControl = false,
  recordingPrivateReadinessPosture = false,
  replayRunError,
  replayRunMessage,
  tradingRunError,
  tradingRunMessage,
  improvementError,
  improvementMessage,
  runtimeControlError,
  runtimeControlMessage,
  privateReadinessPostureError,
  privateReadinessPostureMessage
}: {
  candidate: CandidateInspectReadModel;
  tradingGatewayEnvironment?: TradingGatewayEnvironmentReadModel;
  replayRuns?: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  executionModes?: TradingSystemExecutionModeContractReadModel[];
  onSelectReplayRun?: (runId: string) => void;
  onRunCandidateReplay?: () => void;
  onStartTradingRun?: () => void;
  onStartRejectedPaperOrder?: () => void;
  onObserveTradingRun?: () => void;
  onStopTradingRun?: () => void;
  onRecordImprovement?: () => void;
  onRecordRunControl?: () => void;
  onRecordPrivateReadinessPosture?: (draft: PrivateReadinessPostureDraft) => void;
  runningCandidateReplay?: boolean;
  runningTradingRun?: boolean;
  recordingImprovement?: boolean;
  recordingRunControl?: boolean;
  recordingPrivateReadinessPosture?: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
  tradingRunError?: string;
  tradingRunMessage?: string;
  improvementError?: string;
  improvementMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
  privateReadinessPostureError?: string;
  privateReadinessPostureMessage?: string;
}) {
  const ledger = candidate.ledger;

  return (
    <article className="detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">{candidate.fixture_notice.label}</p>
          <h2>{candidate.display_name}</h2>
          <p className="muted">
            {candidate.candidate_id} · {candidate.candidate_version.version_label}
          </p>
        </div>
        <div className="header-badges">
          <span className="mode-pill">{candidate.fixture_notice.mode}</span>
          {candidate.latest_validation_state && (
            <ValidationStateStatus validationState={candidate.latest_validation_state} compact />
          )}
        </div>
      </header>

      <section className="notice-band">
        {candidate.fixture_notice.statements.map((statement) => (
          <span key={statement}>{statement}</span>
        ))}
      </section>

      <TradingExecutionModesSection modes={executionModes} />

      <div className="section-grid">
        <InfoSection title="Trading System">
          <Field label="Status" value={candidate.status} />
          <Field label="Active version" value={candidate.active_version_id} />
          <Field label="Provenance refs" value={candidate.candidate_version.provenance_refs.map(formatRef).join(", ")} />
          {candidate.latest_validation_state && (
            <CandidateLatestValidationStateBlock validationState={candidate.latest_validation_state} />
          )}
        </InfoSection>

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

        <InfoSection title="Spec">
          <Field label="Ref" value={formatRef(candidate.spec.ref)} />
          <Field label="Summary" value={candidate.spec.summary} />
          <Field label="Market" value={`${candidate.spec.market} / ${candidate.spec.instrument}`} />
          <Field label="Stage profiles" value={candidate.spec.supported_stage_binding_profiles.join(", ")} />
        </InfoSection>

        <InfoSection title="System Code">
          <Field label="Ref" value={formatRef(candidate.program.ref)} />
          <Field label="Summary" value={candidate.program.summary} />
          <Field label="Manifest" value={formatRef(candidate.program.manifest.ref)} />
          <Field label="Runtime" value={candidate.program.manifest.declared_runtime} />
          <Placeholder item={candidate.program.validation} />
        </InfoSection>

        <InfoSection title="Capability Package">
          <Field label="Ref" value={formatRef(candidate.capability_package.ref)} />
          <Field label="Summary" value={candidate.capability_package.summary} />
          <Field label="Allowed stages" value={candidate.capability_package.manifest.allowed_stages.join(", ")} />
          <Field label="Declared permissions" value={candidate.capability_package.manifest.declared_permissions.join(", ")} />
          <Field label="Forbidden contents" value={candidate.capability_package.manifest.forbidden_contents.join(", ")} />
          <Placeholder item={candidate.capability_package.admission} />
          <Placeholder item={candidate.capability_package.grant} />
          <Placeholder item={candidate.capability_package.mount} />
        </InfoSection>

        <InfoSection title="Agent And Provider">
          <Placeholder item={candidate.agent_provider.agent_spec} />
          <Placeholder item={candidate.agent_provider.agent_session} />
          <Placeholder item={candidate.agent_provider.agent_run} />
          <Placeholder item={candidate.agent_provider.agent_event} />
          <Placeholder item={candidate.agent_provider.provider_readiness} />
          <Placeholder item={candidate.agent_provider.provider_probe_attempt} />
        </InfoSection>

        <MaterializationAttemptSection attempt={candidate.materialization_attempt} />

        <ImprovementSection
          improvement={candidate.improvement}
          onRecordImprovement={onRecordImprovement}
          recordingImprovement={recordingImprovement}
          improvementError={improvementError}
          improvementMessage={improvementMessage}
        />

        <InfoSection title="Trading Run">
          <div className={`evaluation-status ${candidate.runtime.runtime_lifecycle_status === "running" ? "counted" : "neutral"}`}>
            <span>Lifecycle</span>
            <strong>{candidate.runtime.runtime_lifecycle_status ?? "registered"}</strong>
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
                <button
                  className="runtime-command-button"
                  type="button"
                  onClick={onStartTradingRun}
                  disabled={runningTradingRun}
                >
                  {runningTradingRun ? "Working trading run" : "Start trading run"}
                </button>
              )}
              {onStartRejectedPaperOrder && (
                <button
                  className="runtime-command-button"
                  type="button"
                  onClick={onStartRejectedPaperOrder}
                  disabled={runningTradingRun}
                >
                  Run rejected paper order
                </button>
              )}
              {onObserveTradingRun && (
                <button
                  className="runtime-command-button"
                  type="button"
                  onClick={onObserveTradingRun}
                  disabled={runningTradingRun}
                >
                  Observe
                </button>
              )}
              {onStopTradingRun && (
                <button
                  className="runtime-command-button"
                  type="button"
                  onClick={onStopTradingRun}
                  disabled={runningTradingRun || candidate.runtime.runtime_lifecycle_status === "stopped"}
                >
                  Stop
                </button>
              )}
              <span>run_control / fixture_paper / not_live</span>
            </div>
          )}
          {tradingRunMessage && <div className="inline-status">{tradingRunMessage}</div>}
          {tradingRunError && <div className="inline-status error">{tradingRunError}</div>}
        </InfoSection>

        <TradingRunTranscriptSection transcript={candidate.runtime.transcript} />

        <SandboxSection sandbox={candidate.runtime.sandbox} />

        <TradingGatewayContractSection
          contract={candidate.trading_substrate?.latest_trading_gateway_contract}
        />

        <TradingGatewayEnvironmentSection environment={tradingGatewayEnvironment} />

        <LedgerSection
          ledger={ledger}
        />

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

        <InfoSection title="Trace And Evaluation">
          <EvaluationSection evaluation={candidate.evaluation} />
        </InfoSection>
      </div>
    </article>
  );
}

function SandboxSection({ sandbox }: { sandbox?: SandboxDetailReadModel }) {
  if (!sandbox) {
    return (
      <InfoSection title="Sandbox">
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
    <InfoSection title="Sandbox">
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
    <InfoSection title="Trading Run Transcript">
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
    <section className="execution-mode-panel" aria-label="Trading execution modes">
      <div>
        <p className="eyebrow">Execution modes</p>
        <h3>Backtest / paper / live contract</h3>
      </div>
      <div className="execution-mode-grid">
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
      </div>
    </section>
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
    <InfoSection title="Candidate Runs">
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
              <button
                aria-pressed={activeRunId === run.run_id}
                className={`run-history-row ${activeRunId === run.run_id ? "active" : ""}`}
                key={run.run_id}
                type="button"
                onClick={() => onSelectRun?.(run.run_id)}
              >
                <span>{run.run_id}</span>
                <small>
                  {run.status} / {run.runner_kind} / {run.authority_status}
                </small>
                <small>
                  {run.scenario_accepted}/{run.scenario_total} accepted · {run.completed_at}
                </small>
              </button>
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
          <button
            className="runtime-command-button"
            type="button"
            onClick={onRunCandidateReplay}
            disabled={runningCandidateReplay}
          >
            {runningCandidateReplay ? "Running replay" : "Run replay"}
          </button>
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
      <InfoSection title="Trading gateway contract">
        <div className="placeholder">
          <strong>No trading gateway contract</strong>
          <span>BTCUSDT gateway contract has not been projected</span>
          <span>not_live</span>
        </div>
      </InfoSection>
    );
  }

  return (
    <InfoSection title="Trading gateway contract">
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
    <InfoSection title="Trading gateway environment">
      <Field
        label="Exchange binding"
        value={`${environment.exchange_environment} / ${environment.exchange_environment_source}`}
      />
      <Field
        label="Configuration"
        value={`${environment.configuration_status} / ${environment.configuration_reason}`}
      />
      <Field label="REST base URL" value={environment.rest_base_url ?? "not_configured"} />
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
    <InfoSection title="Trading Substrate">
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
            <button
              className="runtime-command-button"
              type="submit"
              disabled={recordingPrivateReadinessPosture}
            >
              {recordingPrivateReadinessPosture ? "Saving posture" : "Save local posture"}
            </button>
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
    <InfoSection title="Run Control">
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
          <button
            className="runtime-command-button"
            type="button"
            onClick={onRecordRunControl}
            disabled={recordingRunControl}
          >
            {recordingRunControl ? "Recording pause" : "Record pause"}
          </button>
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
    <InfoSection title="Improvement">
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
          <button
            className="runtime-command-button"
            type="button"
            onClick={onRecordImprovement}
            disabled={recordingImprovement}
          >
            {recordingImprovement ? "Recording improvement" : "Record improvement"}
          </button>
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
    <InfoSection title="Ledger">
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
    <InfoSection title="Materialization Attempt">
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

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-section">
      <h3>{title}</h3>
      <div className="field-list">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value}</dd>
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
  return `${canonicalRefKind(ref.record_kind)}:${canonicalRefId(ref.id)}`;
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

function canonicalRefId(id: string): string {
  return id
    .replace(/^system-code/, "system-code")
    .replace(/^trading-run/, "trading-run")
    .replace(/^sandbox-placement/, "sandbox-placement")
    .replace(/^sandbox/, "sandbox")
    .replace(/^order-request/, "order-request")
    .replace(/^gateway-result/, "gateway-result")
    .replace(/^execution-result/, "execution-result")
    .replace(/^run-control-command/, "run-control-command")
    .replace(/^run-control-decision/, "run-control-decision");
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
