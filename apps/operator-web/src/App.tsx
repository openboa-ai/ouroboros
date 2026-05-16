import { useEffect, useState } from "react";
import type {
  CandidateEvaluationReadModel,
  CandidateEvidenceClassificationReadModel,
  CandidateInspectReadModel,
  CandidateLatestValidationStateReadModel,
  CandidateMaterializationAttemptReadModel,
  ReplayRunComparisonReadModel,
  ReplayRunDetailReadModel,
  ReplayRunEvidenceReadModel,
  ReplayRunValidationStateReadModel,
  ReplayRuntimeAuthorityReadModel,
  ReplayRuntimeControlReadModel,
  CandidateSummaryReadModel,
  OrderFillSurfaceReadModel,
  PlaceholderSummary,
  TradingSystemExecutionModeContractReadModel
} from "@ouroboros/domain";
import {
  fetchCandidate,
  fetchReplayRunComparison,
  fetchReplayRunDetail,
  fetchReplayRunEvidence,
  fetchReplayRunValidationState,
  fetchCandidateSummaries,
  fetchTradingExecutionModeContracts,
  recordReplayRuntimeAuthority,
  recordReplayRuntimeControl,
  runReplay as submitReplayRun
} from "./api";
import "./styles.css";

interface AppState {
  candidates: CandidateSummaryReadModel[];
  executionModes: TradingSystemExecutionModeContractReadModel[];
  selected?: CandidateInspectReadModel;
  replayRuns: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  error?: string;
  loading: boolean;
  recordingRuntimeAuthority: boolean;
  recordingRuntimeControl: boolean;
  runningCandidateReplay: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
  runtimeAuthorityError?: string;
  runtimeAuthorityMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
}

export function App() {
  const [state, setState] = useState<AppState>({
    candidates: [],
    executionModes: [],
    replayRuns: [],
    loading: true,
    recordingRuntimeAuthority: false,
    recordingRuntimeControl: false,
    runningCandidateReplay: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [candidates, executionModes] = await Promise.all([
          fetchCandidateSummaries(),
          fetchTradingExecutionModeContracts()
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
            selected,
            replayRuns,
            selectedReplayRunId: replayRunSelection.selectedReplayRunId,
            replayRunDetail: replayRunSelection.replayRunDetail,
            replayRunComparison: replayRunSelection.replayRunComparison,
            replayRunComparisonBaselineId: replayRunSelection.replayRunComparisonBaselineId,
            replayRunValidationState: replayRunSelection.replayRunValidationState,
            loading: false,
            recordingRuntimeAuthority: false,
            recordingRuntimeControl: false,
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
            recordingRuntimeAuthority: false,
            recordingRuntimeControl: false,
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
      runtimeAuthorityError: undefined,
      runtimeAuthorityMessage: undefined,
      runtimeControlError: undefined,
      runtimeControlMessage: undefined,
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

  async function recordRuntimeAuthority() {
    const candidate = state.selected;
    if (!candidate || state.recordingRuntimeAuthority) {
      return;
    }

    setState((current) => ({
      ...current,
      recordingRuntimeAuthority: true,
      runtimeAuthorityError: undefined,
      runtimeAuthorityMessage: undefined
    }));
    try {
      const outcome = await recordReplayRuntimeAuthority(candidate);
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
        recordingRuntimeAuthority: false,
        runtimeAuthorityMessage: `dry_run_only recorded: ${outcome.execution_attempt.execution_attempt_id}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        recordingRuntimeAuthority: false,
        runtimeAuthorityError: error instanceof Error ? error.message : "Unknown runtime authority error"
      }));
    }
  }

  async function recordRuntimeControl() {
    const candidate = state.selected;
    if (!candidate || state.recordingRuntimeControl) {
      return;
    }

    setState((current) => ({
      ...current,
      recordingRuntimeControl: true,
      runtimeControlError: undefined,
      runtimeControlMessage: undefined
    }));
    try {
      const outcome = await recordReplayRuntimeControl(candidate);
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
        recordingRuntimeControl: false,
        runtimeControlMessage: `control_only recorded: ${outcome.command.runtime_control_command_id}`
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        recordingRuntimeControl: false,
        runtimeControlError: error instanceof Error ? error.message : "Unknown runtime control error"
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
            onRecordRuntimeAuthority={state.selected.runtime.bounded_authority
              ? () => void recordRuntimeAuthority()
              : undefined}
            onRecordRuntimeControl={state.selected.runtime.runtime_control
              ? () => void recordRuntimeControl()
              : undefined}
            recordingRuntimeAuthority={state.recordingRuntimeAuthority}
            recordingRuntimeControl={state.recordingRuntimeControl}
            runningCandidateReplay={state.runningCandidateReplay}
            replayRunError={state.replayRunError}
            replayRunMessage={state.replayRunMessage}
            runtimeAuthorityError={state.runtimeAuthorityError}
            runtimeAuthorityMessage={state.runtimeAuthorityMessage}
            runtimeControlError={state.runtimeControlError}
            runtimeControlMessage={state.runtimeControlMessage}
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
  replayRuns = [],
  selectedReplayRunId,
  replayRunDetail,
  replayRunComparison,
  replayRunComparisonBaselineId,
  replayRunValidationState,
  executionModes = [],
  onSelectReplayRun,
  onRunCandidateReplay,
  onRecordRuntimeAuthority,
  onRecordRuntimeControl,
  runningCandidateReplay = false,
  recordingRuntimeAuthority = false,
  recordingRuntimeControl = false,
  replayRunError,
  replayRunMessage,
  runtimeAuthorityError,
  runtimeAuthorityMessage,
  runtimeControlError,
  runtimeControlMessage
}: {
  candidate: CandidateInspectReadModel;
  replayRuns?: ReplayRunEvidenceReadModel[];
  selectedReplayRunId?: string;
  replayRunDetail?: ReplayRunDetailReadModel;
  replayRunComparison?: ReplayRunComparisonReadModel;
  replayRunComparisonBaselineId?: string;
  replayRunValidationState?: ReplayRunValidationStateReadModel;
  executionModes?: TradingSystemExecutionModeContractReadModel[];
  onSelectReplayRun?: (runId: string) => void;
  onRunCandidateReplay?: () => void;
  onRecordRuntimeAuthority?: () => void;
  onRecordRuntimeControl?: () => void;
  runningCandidateReplay?: boolean;
  recordingRuntimeAuthority?: boolean;
  recordingRuntimeControl?: boolean;
  replayRunError?: string;
  replayRunMessage?: string;
  runtimeAuthorityError?: string;
  runtimeAuthorityMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
}) {
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
        <InfoSection title="Candidate">
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

        <InfoSection title="Program">
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

        <InfoSection title="Runtime">
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
        </InfoSection>

        <TradingSubstrateSection surface={candidate.trading_substrate?.latest_order_fill_surface} />

        <RuntimeControlSection
          control={candidate.runtime.runtime_control}
          onRecordRuntimeControl={onRecordRuntimeControl}
          recordingRuntimeControl={recordingRuntimeControl}
          runtimeControlError={runtimeControlError}
          runtimeControlMessage={runtimeControlMessage}
        />

        <RuntimeAuthoritySection
          authority={candidate.runtime.bounded_authority}
          onRecordRuntimeAuthority={onRecordRuntimeAuthority}
          recordingRuntimeAuthority={recordingRuntimeAuthority}
          runtimeAuthorityError={runtimeAuthorityError}
          runtimeAuthorityMessage={runtimeAuthorityMessage}
        />

        <InfoSection title="Trace And Evaluation">
          <EvaluationSection evaluation={candidate.evaluation} />
        </InfoSection>
      </div>
    </article>
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

function TradingSubstrateSection({
  surface
}: {
  surface?: OrderFillSurfaceReadModel | null;
}) {
  return (
    <InfoSection title="Trading Substrate">
      {surface ? (
        <>
          <div className={`evaluation-status ${substrateStatusTone(surface)}`}>
            <span>Order-fill posture</span>
            <strong>{surface.posture}</strong>
            <span>{surface.authority_status}</span>
          </div>
          <Field label="Surface" value={surface.surface_label} />
          <Field label="Venue" value={`${surface.venue} / ${surface.product_category}`} />
          <Field label="Instrument" value={surface.instrument} />
          <Field label="Raw upstream" value={[
            surface.raw_upstream_status,
            surface.raw_upstream_execution_type ?? "none"
          ].join(" / ")} />
          <Field label="Order scope" value={surface.order_scope_ref} />
          <Field label="Client order" value={surface.local_client_order_id ?? "none"} />
          <Field label="Upstream order" value={surface.upstream_order_id ?? "none"} />
          <Field label="Side / type" value={[
            surface.side ?? "none",
            surface.order_type ?? "none",
            surface.time_in_force ?? "none"
          ].join(" / ")} />
          <Field label="Requested" value={surface.requested_quantity ?? "none"} />
          <Field label="Filled / remaining" value={[
            surface.cumulative_filled_quantity,
            surface.remaining_quantity
          ].join(" / ")} />
          <Field label="Average / last price" value={[
            surface.average_fill_price ?? "none",
            surface.last_fill_price ?? "none"
          ].join(" / ")} />
          <Field label="Freshness" value={`${surface.freshness} / ${surface.liveness}`} />
          <Field label="Source" value={formatSubstrateSource(surface)} />
          <Field label="Connector package" value={surface.transport.package_name} />
          <Field label="Connector repository" value={surface.transport.repository} />
          <Field label="Connector endpoints" value={surface.transport.supported_endpoints.join(", ")} />
          <Field label="Connector role" value={surface.transport.integration_role} />
          <Field label="Connector URLs" value={[
            surface.transport.production_base_url,
            surface.transport.testnet_base_url
          ].join(" / ")} />
          <Field label="Source timestamp" value={surface.source_timestamp} />
          <Field label="Observed" value={surface.observed_at} />
          <Field label="Updated" value={surface.updated_at} />
          {surface.degraded_reason && <Field label="Reason" value={surface.degraded_reason} />}
          <Field label="No authority" value={surface.no_authority_label} />
          <Field label="Authority" value={surface.authority_status} />
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

function substrateStatusTone(surface: OrderFillSurfaceReadModel): "counted" | "failed" | "neutral" {
  if (surface.posture === "rejected" || surface.posture === "expired" || surface.liveness === "disconnected") {
    return "failed";
  }
  if (surface.posture === "filled" || surface.posture === "partially_filled") {
    return "counted";
  }
  return "neutral";
}

function formatSubstrateSource(surface: OrderFillSurfaceReadModel): string {
  return [
    surface.source_kind,
    surface.fixture_backed ? "fixture-backed" : "external",
    surface.simulated ? "simulated" : "observed",
    surface.source_ref ? formatRef(surface.source_ref) : "none"
  ].join(" / ");
}

function RuntimeControlSection({
  control,
  onRecordRuntimeControl,
  recordingRuntimeControl,
  runtimeControlError,
  runtimeControlMessage
}: {
  control?: ReplayRuntimeControlReadModel;
  onRecordRuntimeControl?: () => void;
  recordingRuntimeControl: boolean;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
}) {
  const statusLabel = control?.chain_complete
    ? "chain complete"
    : control?.has_activity
      ? "incomplete"
      : "none";

  return (
    <InfoSection title="Runtime Control">
      <div className={`evaluation-status ${control?.chain_complete ? "counted" : "neutral"}`}>
        <span>Logical TradingSystemRuntime state</span>
        <strong>{statusLabel}</strong>
        <span>{control?.audit_event.authority_status ?? "not_live"}</span>
      </div>

      <Field label="Activity" value={control?.has_activity ? "recorded" : "none"} />
      <Field label="Complete chain" value={control?.chain_complete ? "yes" : "no"} />
      <Field label="Command" value={control?.command.status ?? "pending_decision"} />
      <Field label="Decision" value={control?.decision.status ?? "not_evaluated"} />
      <Field label="Audit event" value={control?.audit_event.status ?? "not_recorded"} />

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

      {onRecordRuntimeControl && (
        <div className="runtime-command">
          <button
            className="runtime-command-button"
            type="button"
            onClick={onRecordRuntimeControl}
            disabled={recordingRuntimeControl}
          >
            {recordingRuntimeControl ? "Recording pause" : "Record pause control"}
          </button>
          <span>control_only / audit_only / not_live</span>
        </div>
      )}
      {runtimeControlMessage && <div className="inline-status">{runtimeControlMessage}</div>}
      {runtimeControlError && <div className="inline-status error">{runtimeControlError}</div>}
    </InfoSection>
  );
}

function RuntimeAuthoritySection({
  authority,
  onRecordRuntimeAuthority,
  recordingRuntimeAuthority,
  runtimeAuthorityError,
  runtimeAuthorityMessage
}: {
  authority?: ReplayRuntimeAuthorityReadModel;
  onRecordRuntimeAuthority?: () => void;
  recordingRuntimeAuthority: boolean;
  runtimeAuthorityError?: string;
  runtimeAuthorityMessage?: string;
}) {
  const statusLabel = authority?.chain_complete
    ? "chain complete"
    : authority?.has_activity
      ? "incomplete"
      : "none";

  return (
    <InfoSection title="Runtime Authority">
      <div className={`evaluation-status ${authority?.chain_complete ? "counted" : "neutral"}`}>
        <span>Bounded paper state</span>
        <strong>{statusLabel}</strong>
        <span>{authority?.execution_attempt.authority_status ?? "not_submitted"}</span>
      </div>

      <Field label="Activity" value={authority?.has_activity ? "recorded" : "none"} />
      <Field label="Complete chain" value={authority?.chain_complete ? "yes" : "no"} />
      <Field label="Order intent draft" value={authority?.order_intent_draft.status ?? "not_submitted"} />
      <Field label="Gateway decision" value={authority?.gateway_decision.status ?? "not_evaluated"} />
      <Field label="Execution attempt" value={authority?.execution_attempt.status ?? "not_submitted"} />

      {authority?.latest_order_intent_draft ? (
        <div className="evaluation-block">
          <h4>Latest order intent draft</h4>
          <Field label="Intent" value={authority.latest_order_intent_draft.intent_kind} />
          <Field label="Status" value={authority.latest_order_intent_draft.status} />
          <Field label="Side / type" value={`${authority.latest_order_intent_draft.side ?? "none"} / ${authority.latest_order_intent_draft.order_type ?? "none"}`} />
          <Field label="Quantity" value={authority.latest_order_intent_draft.quantity ?? "none"} />
          <Field label="Limit" value={authority.latest_order_intent_draft.limit_price ?? "none"} />
          <Field label="Authority" value={authority.latest_order_intent_draft.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest order intent draft</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_submitted" />
        </div>
      )}

      {authority?.latest_gateway_decision ? (
        <div className="evaluation-block">
          <h4>Latest gateway decision</h4>
          <Field label="Outcome" value={authority.latest_gateway_decision.decision_outcome} />
          <Field label="Reason" value={authority.latest_gateway_decision.decision_reason} />
          <Field label="Order intent draft" value={formatRef(authority.latest_gateway_decision.order_intent_draft_ref)} />
          <Field label="Authority" value={authority.latest_gateway_decision.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest gateway decision</h4>
          <Field label="Outcome" value="not_evaluated" />
          <Field label="Authority" value="not_live" />
        </div>
      )}

      {authority?.latest_execution_attempt ? (
        <div className="evaluation-block">
          <h4>Latest execution attempt</h4>
          <Field label="Stage" value={authority.latest_execution_attempt.stage} />
          <Field label="Mode" value={authority.latest_execution_attempt.execution_mode} />
          <Field label="Status" value={authority.latest_execution_attempt.status} />
          <Field label="Reason" value={authority.latest_execution_attempt.result_reason} />
          <Field label="Gateway decision" value={formatRef(authority.latest_execution_attempt.gateway_decision_ref)} />
          <Field label="Authority" value={authority.latest_execution_attempt.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest execution attempt</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_submitted" />
        </div>
      )}

      {onRecordRuntimeAuthority && (
        <div className="runtime-command">
          <button
            className="runtime-command-button"
            type="button"
            onClick={onRecordRuntimeAuthority}
            disabled={recordingRuntimeAuthority}
          >
            {recordingRuntimeAuthority ? "Recording dry-run" : "Record dry-run intent"}
          </button>
          <span>dry_run_only / paper_stage_only / not_live</span>
        </div>
      )}
      {runtimeAuthorityMessage && <div className="inline-status">{runtimeAuthorityMessage}</div>}
      {runtimeAuthorityError && <div className="inline-status error">{runtimeAuthorityError}</div>}
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
  return `${ref.record_kind}:${ref.id}`;
}

function formatRefs(refs: Array<{ record_kind: string; id: string }>) {
  return refs.length > 0 ? refs.map(formatRef).join(", ") : "none";
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
