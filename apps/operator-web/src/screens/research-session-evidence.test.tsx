import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResearchSessionDetailReadModel } from "@ouroboros/domain";
import { ResearchSessionEvidence } from "./research-session-evidence";

function admittedDetail(): ResearchSessionDetailReadModel {
  return {
    identity_kind: "derived_projection",
    research_work_item_id: "work-item/exact 1",
    research_allocation_id: "allocation-1",
    direction_kind: "execution_cost_robustness",
    research_worker_id: "worker-1",
    commitment_id: "commitment-1",
    status: "admitted",
    status_basis: {
      basis_kind: "candidate_admission_decision",
      source_ref: { record_kind: "candidate_admission_decision", id: "admission-1" },
      authority_status: "read_only"
    },
    projection_health: "complete",
    degraded_reasons: [],
    trigger_availability: "available",
    trigger: {
      trigger_kind: "arena_event",
      trigger_id: "trigger-1",
      goal: "Reduce execution-cost sensitivity",
      goal_truncated: false,
      triggered_at: "2026-07-23T00:00:00.000Z",
      source_ref: { record_kind: "research_finding", id: "source-finding-1" },
      evidence_artifact_ref: { record_kind: "research_evidence_artifact", id: "evidence-1" },
      evidence_artifact_digest: "sha256:trigger-evidence",
      authority_status: "research_only"
    },
    methodology_availability: "available",
    methodology: {
      direction_kind: "execution_cost_robustness",
      hypothesis: "A stricter spread gate reduces adverse fills.",
      hypothesis_truncated: false,
      method: "Compare bounded spread-gate variants.",
      method_truncated: false,
      source_candidate_id: "source-candidate-1",
      evidence_artifact_ids: ["evidence-1"],
      authority_status: "research_only"
    },
    provider_availability: "available",
    provider: "codex_cli",
    model: "gpt-5",
    model_truncated: false,
    budget: {
      max_experiment_count: 3,
      completed_experiment_count: 3,
      max_development_submission_count: 2,
      development_submission_count: 2,
      remaining_development_submission_count: 0,
      authority_status: "research_only"
    },
    allocated_at: "2026-07-23T00:00:01.000Z",
    started_at: "2026-07-23T00:00:02.000Z",
    last_progress_at: "2026-07-23T00:05:00.000Z",
    completed_at: "2026-07-23T00:06:00.000Z",
    selected_submission_sequence: 2,
    admitted_candidate_id: "candidate / exact 1",
    latest_progress_summary: "Persisted terminal evidence is complete.",
    latest_progress_summary_truncated: false,
    authority_status: "research_only",
    evidence_inputs: [{
      evidence_artifact_id: "evidence-1",
      source_kind: "arena_failure",
      subject_ref: { record_kind: "paper_trading_evaluation", id: "paper-1" },
      artifact_ref: { record_kind: "artifact", id: "artifact-1" },
      artifact_digest: "sha256:evidence-input",
      summary: "Spread costs exceeded the bounded threshold.",
      truncated: false,
      captured_at: "2026-07-22T23:59:00.000Z",
      sanitization_status: "sanitized",
      qualification_evidence_hidden: true,
      authority_status: "research_only"
    }],
    development_submissions: [{
      submission_sequence: 1,
      decision: "discard",
      agent_status: "edited",
      evaluation_status: "accepted",
      risk_decision: "no_order_request",
      net_revenue_usdt: -1,
      summary: "First bounded submission was not selected.",
      summary_truncated: false,
      selected: false,
      artifact_availability: "not_persisted",
      authority_status: "research_only"
    }, {
      submission_sequence: 2,
      decision: "keep",
      agent_status: "edited",
      evaluation_status: "accepted",
      risk_decision: "valid_order_request",
      net_revenue_usdt: 2,
      summary: "Second bounded submission was selected.",
      summary_truncated: false,
      selected: true,
      artifact_availability: "selected_system_code_available",
      selected_system_code_ref: { record_kind: "system_code", id: "system-code-selected" },
      selected_system_code_artifact_digest: "sha256:selected-system-code",
      authority_status: "research_only"
    }],
    submission_history_availability: "checkpoint_summary",
    recorded_submission_count: 2,
    projected_submission_count: 2,
    omitted_submission_count: 0,
    submission_history_truncated: false,
    selected_artifact_availability: "available",
    selected_system_code_ref: { record_kind: "system_code", id: "system-code-selected" },
    selected_system_code_artifact_digest: "sha256:selected-system-code",
    admission_decision_ref: { record_kind: "candidate_admission_decision", id: "admission-1" },
    paper_handoff_conformance_ref: { record_kind: "paper_trading_handoff_conformance", id: "conformance-1" },
    notebook_summary: ["Retain the spread-gate hypothesis for the next generation."],
    notebook_summary_truncated: false,
    lifecycle_events: [{
      sequence: 1,
      occurred_at: "2026-07-23T00:00:01.000Z",
      event_kind: "allocation",
      summary: "Research allocation persisted.",
      summary_truncated: false,
      source_ref: { record_kind: "candidate_arena_research_allocation", id: "allocation-1" },
      sanitized: true,
      authority_status: "read_only"
    }],
    provider_logs_availability: "not_persisted",
    terminal_graph: {
      selected_sealed_evaluation: {
        trading_evaluation_result_ref: { record_kind: "trading_evaluation_result", id: "evaluation-result-1" },
        experiment_run_ref: { record_kind: "experiment_run", id: "experiment-run-1" },
        evaluation_phase: "sealed_admission",
        result_status: "accepted",
        evidence_disposition: "not_counted",
        completed_at: "2026-07-23T00:03:00.000Z",
        authority_status: "read_only"
      },
      admission: {
        candidate_admission_decision_ref: { record_kind: "candidate_admission_decision", id: "admission-1" },
        status: "admitted",
        reason: "evaluation_accepted",
        decided_at: "2026-07-23T00:04:00.000Z",
        authority_status: "read_only"
      },
      paper_handoff_conformance: {
        paper_trading_handoff_conformance_ref: { record_kind: "paper_trading_handoff_conformance", id: "conformance-1" },
        status: "passed",
        reason: "passed",
        completed_at: "2026-07-23T00:03:30.000Z",
        evidence_digest: "sha256:conformance",
        authority_status: "read_only"
      },
      finding: {
        research_finding_ref: { record_kind: "research_finding", id: "finding-1" },
        finding_kind: "positive_result",
        summary: "The selected candidate passed sealed admission.",
        summary_truncated: false,
        supporting_record_refs: [{ record_kind: "trading_evaluation_result", id: "evaluation-result-1" }],
        created_at: "2026-07-23T00:03:01.000Z",
        sanitized: true,
        authority_status: "read_only"
      },
      artifact_lineage: {
        artifact_lineage_ref: { record_kind: "artifact_lineage", id: "lineage-1" },
        child_system_code_ref: { record_kind: "system_code", id: "system-code-selected" },
        parent_system_code_ref: { record_kind: "system_code", id: "system-code-source" },
        source_finding_refs: [{ record_kind: "research_finding", id: "finding-1" }],
        created_by_research_worker_ref: { record_kind: "research_worker", id: "worker-1" },
        created_at: "2026-07-23T00:04:01.000Z",
        authority_status: "read_only"
      },
      admitted_arena_handoff: {
        candidate_arena_tick_ref: { record_kind: "candidate_arena_tick", id: "arena-tick-1" },
        candidate_ref: { record_kind: "trading_system_candidate", id: "candidate / exact 1" },
        direction_kind: "execution_cost_robustness",
        candidate_admission_decision_ref: { record_kind: "candidate_admission_decision", id: "admission-1" },
        completed_at: "2026-07-23T00:05:00.000Z",
        authority_status: "read_only"
      },
      authority_status: "read_only"
    }
  };
}

function markup(detail: ResearchSessionDetailReadModel): string {
  return renderToStaticMarkup(<ResearchSessionEvidence detail={detail} />);
}

describe("ResearchSessionEvidence", () => {
  it("renders complete admitted evidence in required order with an exact encoded Arena link", () => {
    const rendered = markup(admittedDetail());
    const headings = [
      "Identity, trigger, and methodology",
      "Sanitized evidence inputs",
      "Checkpoint submissions and selection",
      "Admission, conformance, Finding, lineage, and Arena handoff",
      "Notebook continuity",
      "Controlled lifecycle events",
      "Degradation and truncation"
    ];
    headings.forEach((heading, index) => {
      expect(rendered).toContain(heading);
      if (index > 0) expect(rendered.indexOf(heading)).toBeGreaterThan(rendered.indexOf(headings[index - 1]!));
    });
    expect(rendered).toContain("system-code-selected");
    expect(rendered).toContain("sha256:selected-system-code");
    expect(rendered).toContain("arena-tick-1");
    expect(rendered).toContain('href="#/arena?system=candidate+%2F+exact+1"');
  });

  it("renders trigger and durable checkpoint unavailability without inventing evidence", () => {
    const detail = {
      ...admittedDetail(),
      status: "running",
      trigger_availability: "unavailable",
      trigger: undefined,
      methodology_availability: "unavailable",
      methodology: undefined,
      provider_availability: "unavailable",
      provider: undefined,
      model: undefined,
      projection_health: "degraded",
      degraded_reasons: ["trigger_unavailable", "methodology_unavailable", "provider_unavailable"],
      development_submissions: [],
      submission_history_availability: "unavailable_until_checkpoint",
      recorded_submission_count: undefined,
      projected_submission_count: undefined,
      omitted_submission_count: undefined,
      submission_history_truncated: undefined,
      selected_artifact_availability: "unavailable",
      selected_submission_sequence: undefined,
      selected_system_code_ref: undefined,
      selected_system_code_artifact_digest: undefined,
      terminal_graph: { authority_status: "read_only" }
    } as unknown as ResearchSessionDetailReadModel;
    const rendered = markup(detail);
    expect(rendered).toContain("Trigger unavailable");
    expect(rendered).toContain("Unavailable until a terminal checkpoint is persisted");
    expect(rendered).toContain("Trigger Unavailable");
    expect(rendered).not.toContain("Reduce execution-cost sensitivity");
  });

  it("renders finished-without-submission and authoritative failed-closed lifecycle evidence without inferring restart", () => {
    const finished = {
      ...admittedDetail(),
      status: "finished_without_submission",
      selected_submission_sequence: undefined,
      admitted_candidate_id: undefined,
      development_submissions: [],
      recorded_submission_count: 0,
      projected_submission_count: 0,
      omitted_submission_count: 0,
      selected_artifact_availability: "not_selected",
      selected_system_code_ref: undefined,
      selected_system_code_artifact_digest: undefined,
      terminal_graph: { authority_status: "read_only" }
    } as unknown as ResearchSessionDetailReadModel;
    const restarted = {
      ...finished,
      status: "failed_closed",
      status_basis: { basis_kind: "research_worker_checkpoint", authority_status: "read_only" },
      projection_health: "degraded",
      degraded_reasons: ["inactive_incomplete_graph"],
      trigger: { ...admittedDetail().trigger, trigger_kind: "goal", goal: "Close interrupted research safely." },
      lifecycle_events: [{
        sequence: 1,
        occurred_at: "2026-07-23T00:07:00.000Z",
        event_kind: "checkpoint",
        summary: "Restart recovery closed the prior commitment.",
        summary_truncated: false,
        source_ref: { record_kind: "research_worker_checkpoint", id: "checkpoint-1" },
        sanitized: true,
        authority_status: "read_only"
      }]
    } as unknown as ResearchSessionDetailReadModel;
    expect(markup(finished)).toContain("Finished Without Submission");
    expect(markup(finished)).toContain("No development submission was selected");
    const restartedMarkup = markup(restarted);
    expect(restartedMarkup).toContain("Failed Closed");
    expect(restartedMarkup).toContain("Restart recovery closed the prior commitment.");
    expect(restartedMarkup).not.toContain("Failed Closed / Restart Recovery");
    expect(restartedMarkup).not.toContain("#/arena?system=");
  });

  it("does not label an ordinary failed-closed recovery trigger as restart recovery", () => {
    const detail = {
      ...admittedDetail(),
      status: "failed_closed",
      trigger: {
        ...admittedDetail().trigger,
        trigger_kind: "recovery",
        goal: "Reconcile a bounded operator-requested recovery."
      },
      terminal_graph: { authority_status: "read_only" },
      lifecycle_events: []
    } as unknown as ResearchSessionDetailReadModel;
    const rendered = markup(detail);

    expect(rendered).toContain("Failed Closed");
    expect(rendered).toContain("Recovery");
    expect(rendered).not.toContain("Restart Recovery");
  });

  it("shows omitted counts, every truncation signal, and non-selected artifact status", () => {
    const detail = admittedDetail();
    const truncated = {
      ...detail,
      latest_progress_summary_truncated: true,
      trigger: { ...detail.trigger, goal_truncated: true },
      methodology: { ...detail.methodology, hypothesis_truncated: true, method_truncated: true },
      evidence_inputs: detail.evidence_inputs.map((input) => ({ ...input, truncated: true })),
      development_submissions: detail.development_submissions.map((submission) => ({ ...submission, summary_truncated: true })),
      recorded_submission_count: 5,
      projected_submission_count: 2,
      omitted_submission_count: 3,
      submission_history_truncated: true,
      notebook_summary_truncated: true,
      lifecycle_events: detail.lifecycle_events.map((event) => ({ ...event, summary_truncated: true }))
    } as ResearchSessionDetailReadModel;
    const rendered = markup(truncated);
    for (const text of [
      "5 recorded", "2 projected", "3 omitted", "not_persisted", "Goal text truncated",
      "Hypothesis text truncated", "Method text truncated", "Latest progress truncated",
      "Notebook continuity truncated", "Lifecycle event summaries truncated"
    ]) expect(rendered).toContain(text);
  });

  it("enumerates only sanitized typed fields and never renders poison payload properties", () => {
    const privateKeyPoison = ["-----BEGIN", "PRIVATE", "KEY----- poison"].join(" ");
    const poisoned = {
      ...admittedDetail(),
      provider_stdout: "PROVIDER-STDOUT-POISON",
      workspace_path: "/Users/private-owner/workspace-poison",
      credential: "Bearer credential-poison",
      callback_url: "https://secret.example/poison",
      private_key: privateKeyPoison,
      raw_failure: "RAW-FAILURE-POISON"
    } as unknown as ResearchSessionDetailReadModel;
    const rendered = markup(poisoned);
    for (const poison of [
      "PROVIDER-STDOUT-POISON", "/Users/private-owner/workspace-poison", "Bearer credential-poison",
      "https://secret.example/poison", privateKeyPoison, "RAW-FAILURE-POISON"
    ]) expect(rendered).not.toContain(poison);
    expect(rendered).toContain("Provider logs are not persisted");
  });
});
