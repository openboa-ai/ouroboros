import { useEffect, useState } from "react";
import type {
  CandidateEvaluationReadModel,
  CandidateEvidenceClassificationReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateRunEvidenceReadModel,
  CandidateRuntimeAuthorityReadModel,
  CandidateRuntimeControlReadModel,
  CandidateSummaryReadModel,
  PlaceholderSummary
} from "@ouroboros/domain";
import {
  fetchCandidate,
  fetchCandidateRunEvidence,
  fetchCandidateSummaries,
  recordCandidateRuntimeAuthority,
  recordCandidateRuntimeControl
} from "./api";
import "./styles.css";

interface AppState {
  candidates: CandidateSummaryReadModel[];
  selected?: CandidateInspectReadModel;
  candidateRuns: CandidateRunEvidenceReadModel[];
  error?: string;
  loading: boolean;
  recordingRuntimeAuthority: boolean;
  recordingRuntimeControl: boolean;
  runtimeAuthorityError?: string;
  runtimeAuthorityMessage?: string;
  runtimeControlError?: string;
  runtimeControlMessage?: string;
}

export function App() {
  const [state, setState] = useState<AppState>({
    candidates: [],
    candidateRuns: [],
    loading: true,
    recordingRuntimeAuthority: false,
    recordingRuntimeControl: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const candidates = await fetchCandidateSummaries();
        const first = candidates[0];
        const selected = first ? await fetchCandidate(first.candidate_id) : undefined;
        const candidateRuns = selected ? await fetchCandidateRunEvidence(selected.candidate_id) : [];
        if (!cancelled) {
          setState({
            candidates,
            selected,
            candidateRuns,
            loading: false,
            recordingRuntimeAuthority: false,
            recordingRuntimeControl: false
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            candidates: [],
            candidateRuns: [],
            loading: false,
            recordingRuntimeAuthority: false,
            recordingRuntimeControl: false,
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
      runtimeControlMessage: undefined
    }));
    try {
      const selected = await fetchCandidate(candidateId);
      const candidateRuns = await fetchCandidateRunEvidence(candidateId);
      setState((current) => ({ ...current, selected, candidateRuns, loading: false }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown runtime error"
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
      const outcome = await recordCandidateRuntimeAuthority(candidate);
      const selected = await fetchCandidate(candidate.candidate_id);
      const candidateRuns = await fetchCandidateRunEvidence(candidate.candidate_id);
      setState((current) => ({
        ...current,
        selected,
        candidateRuns,
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
      const outcome = await recordCandidateRuntimeControl(candidate);
      const selected = await fetchCandidate(candidate.candidate_id);
      const candidateRuns = await fetchCandidateRunEvidence(candidate.candidate_id);
      setState((current) => ({
        ...current,
        selected,
        candidateRuns,
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
          <span className="brand-mark">AK</span>
          <div>
            <h1>ouroboros</h1>
            <p>Operator inspect</p>
          </div>
        </div>
        {state.candidates.map((candidate) => (
          <button
            className={`candidate-row ${state.selected?.candidate_id === candidate.candidate_id ? "active" : ""}`}
            key={candidate.candidate_id}
            type="button"
            onClick={() => void selectCandidate(candidate.candidate_id)}
          >
            <span>{candidate.display_name}</span>
            <small>{candidate.status}</small>
          </button>
        ))}
      </aside>

      <section className="content">
        {state.loading && <div className="status-panel">Loading fixture read model...</div>}
        {state.error && <div className="status-panel error">{state.error}</div>}
        {!state.loading && !state.error && state.selected && (
          <CandidateDetail
            candidate={state.selected}
            candidateRuns={state.candidateRuns}
            onRecordRuntimeAuthority={state.selected.runtime.bounded_authority
              ? () => void recordRuntimeAuthority()
              : undefined}
            onRecordRuntimeControl={state.selected.runtime.runtime_control
              ? () => void recordRuntimeControl()
              : undefined}
            recordingRuntimeAuthority={state.recordingRuntimeAuthority}
            recordingRuntimeControl={state.recordingRuntimeControl}
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

export function CandidateDetail({
  candidate,
  candidateRuns = [],
  onRecordRuntimeAuthority,
  onRecordRuntimeControl,
  recordingRuntimeAuthority = false,
  recordingRuntimeControl = false,
  runtimeAuthorityError,
  runtimeAuthorityMessage,
  runtimeControlError,
  runtimeControlMessage
}: {
  candidate: CandidateInspectReadModel;
  candidateRuns?: CandidateRunEvidenceReadModel[];
  onRecordRuntimeAuthority?: () => void;
  onRecordRuntimeControl?: () => void;
  recordingRuntimeAuthority?: boolean;
  recordingRuntimeControl?: boolean;
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
        <span className="mode-pill">{candidate.fixture_notice.mode}</span>
      </header>

      <section className="notice-band">
        {candidate.fixture_notice.statements.map((statement) => (
          <span key={statement}>{statement}</span>
        ))}
      </section>

      <div className="section-grid">
        <InfoSection title="Candidate">
          <Field label="Status" value={candidate.status} />
          <Field label="Active version" value={candidate.active_version_id} />
          <Field label="Provenance refs" value={candidate.candidate_version.provenance_refs.map(formatRef).join(", ")} />
        </InfoSection>

        <CandidateRunsSection runs={candidateRuns} />

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

function CandidateRunsSection({ runs }: { runs: CandidateRunEvidenceReadModel[] }) {
  const latestRun = runs[0];
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

      {runs.slice(1, 5).map((run) => (
        <div className="evaluation-block" key={run.run_id}>
          <h4>{run.run_id}</h4>
          <Field label="Runner" value={run.runner_kind} />
          <Field label="Status" value={`${run.status} / ${run.run_status}`} />
          <Field label="Scenarios" value={`${run.scenario_accepted}/${run.scenario_total} accepted`} />
          <Field label="Authority" value={run.authority_status} />
        </div>
      ))}
    </InfoSection>
  );
}

function RuntimeControlSection({
  control,
  onRecordRuntimeControl,
  recordingRuntimeControl,
  runtimeControlError,
  runtimeControlMessage
}: {
  control?: CandidateRuntimeControlReadModel;
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
        <span>Logical TraderSystemRuntime state</span>
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
  authority?: CandidateRuntimeAuthorityReadModel;
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
      <Field label="Order intent" value={authority?.order_intent.status ?? "not_submitted"} />
      <Field label="Gateway decision" value={authority?.gateway_decision.status ?? "not_evaluated"} />
      <Field label="Execution attempt" value={authority?.execution_attempt.status ?? "not_submitted"} />

      {authority?.latest_order_intent ? (
        <div className="evaluation-block">
          <h4>Latest order intent</h4>
          <Field label="Intent" value={authority.latest_order_intent.intent_kind} />
          <Field label="Status" value={authority.latest_order_intent.status} />
          <Field label="Side / type" value={`${authority.latest_order_intent.side ?? "none"} / ${authority.latest_order_intent.order_type ?? "none"}`} />
          <Field label="Quantity" value={authority.latest_order_intent.quantity ?? "none"} />
          <Field label="Limit" value={authority.latest_order_intent.limit_price ?? "none"} />
          <Field label="Authority" value={authority.latest_order_intent.authority_status} />
        </div>
      ) : (
        <div className="evaluation-block">
          <h4>Latest order intent</h4>
          <Field label="Status" value="none" />
          <Field label="Authority" value="not_submitted" />
        </div>
      )}

      {authority?.latest_gateway_decision ? (
        <div className="evaluation-block">
          <h4>Latest gateway decision</h4>
          <Field label="Outcome" value={authority.latest_gateway_decision.decision_outcome} />
          <Field label="Reason" value={authority.latest_gateway_decision.decision_reason} />
          <Field label="Order intent" value={formatRef(authority.latest_gateway_decision.order_intent_ref)} />
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
