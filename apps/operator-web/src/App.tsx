import { useEffect, useState } from "react";
import type {
  CandidateEvaluationReadModel,
  CandidateEvidenceClassificationReadModel,
  CandidateInspectReadModel,
  CandidateMaterializationAttemptReadModel,
  CandidateSummaryReadModel,
  PlaceholderSummary
} from "@ouroboros/domain";
import { fetchCandidate, fetchCandidateSummaries } from "./api";
import "./styles.css";

interface AppState {
  candidates: CandidateSummaryReadModel[];
  selected?: CandidateInspectReadModel;
  error?: string;
  loading: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>({ candidates: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const candidates = await fetchCandidateSummaries();
        const first = candidates[0];
        const selected = first ? await fetchCandidate(first.candidate_id) : undefined;
        if (!cancelled) {
          setState({ candidates, selected, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            candidates: [],
            loading: false,
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
    setState((current) => ({ ...current, loading: true }));
    try {
      const selected = await fetchCandidate(candidateId);
      setState((current) => ({ ...current, selected, loading: false }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown runtime error"
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
        {!state.loading && !state.error && state.selected && <CandidateDetail candidate={state.selected} />}
      </section>
    </main>
  );
}

export function CandidateDetail({ candidate }: { candidate: CandidateInspectReadModel }) {
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
          <Field label="Authority" value={candidate.runtime.authority_status} />
          <Placeholder item={candidate.runtime.placement} />
          <Placeholder item={candidate.runtime.hands_environment} />
          <Field label="Memory trust" value={candidate.runtime.memory_surface.trust_class} />
          <Field label="Memory access" value={candidate.runtime.memory_surface.access_mode} />
          <Field label="Memory authority" value={candidate.runtime.memory_surface.authority_status} />
        </InfoSection>

        <InfoSection title="Trace And Evaluation">
          <EvaluationSection evaluation={candidate.evaluation} />
        </InfoSection>
      </div>
    </article>
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
