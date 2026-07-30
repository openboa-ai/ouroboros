import type { ResearchSessionDetailReadModel } from "@ouroboros/domain";
import { operatorRouteHref } from "@/app/operator-route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/operator-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatMoney, formatStatus, formatTimestamp } from "@/lib/operator-format";
import { cn } from "@/lib/utils";

export function ResearchSessionEvidence({ detail }: { detail: ResearchSessionDetailReadModel }) {
  const terminal = detail.terminal_graph;
  const handoff = terminal.admitted_arena_handoff;
  const truncationMessages = researchTruncationMessages(detail);

  return (
    <div className="border-t">
      <section className="p-4" aria-labelledby="research-identity-title">
        <SectionTitle id="research-identity-title">Identity, trigger, and methodology</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={detail.status} />
          <StatusBadge status={detail.projection_health} />
          <StatusBadge status={detail.status_basis.basis_kind} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Research work item" value={detail.research_work_item_id} mono />
          <Field label="Allocation" value={detail.research_allocation_id} mono />
          <Field label="Research worker" value={detail.research_worker_id ?? "Unavailable"} mono />
          <Field label="Commitment" value={detail.commitment_id ?? "Unavailable"} mono />
          <Field label="Lifecycle" value={formatStatus(detail.status)} />
          <Field label="Direction" value={formatStatus(detail.direction_kind)} />
          <Field label="Provider" value={detail.provider_availability === "available"
            ? `${formatStatus(detail.provider)}${detail.model ? ` / ${detail.model}` : ""}`
            : "Unavailable"} />
          <Field label="Status basis" value={formatStatus(detail.status_basis.basis_kind)} />
          <Field label="Allocated" value={formatTimestamp(detail.allocated_at)} />
          <Field label="Started" value={formatTimestamp(detail.started_at)} />
          <Field label="Last progress" value={formatTimestamp(detail.last_progress_at)} />
          <Field label="Completed" value={formatTimestamp(detail.completed_at)} />
          <Field label="Experiment budget" value={`${detail.budget.completed_experiment_count} / ${detail.budget.max_experiment_count}`} />
          <Field label="Submission budget" value={`${detail.budget.development_submission_count} / ${detail.budget.max_development_submission_count}`} />
          <Field label="Remaining submissions" value={String(detail.budget.remaining_development_submission_count)} />
          <Field label="Latest progress" value={detail.latest_progress_summary} />
        </dl>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border p-3">
            <h5 className="text-xs font-semibold text-muted-foreground">Trigger</h5>
            {detail.trigger_availability === "available" ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Kind" value={formatStatus(detail.trigger.trigger_kind)} />
                <Field label="Trigger ID" value={detail.trigger.trigger_id} mono />
                <Field label="Goal" value={detail.trigger.goal} />
                <Field label="Triggered" value={formatTimestamp(detail.trigger.triggered_at)} />
                <Field label="Evidence artifact" value={detail.trigger.evidence_artifact_ref?.id ?? "Unavailable"} mono />
                <Field label="Evidence digest" value={detail.trigger.evidence_artifact_digest ?? "Unavailable"} mono />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Trigger unavailable. See the recorded degradation reason below.</p>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <h5 className="text-xs font-semibold text-muted-foreground">Methodology</h5>
            {detail.methodology_availability === "available" ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Direction" value={formatStatus(detail.methodology.direction_kind)} />
                <Field label="Source candidate" value={detail.methodology.source_candidate_id ?? "Unavailable"} mono />
                <Field label="Hypothesis" value={detail.methodology.hypothesis} />
                <Field label="Method" value={detail.methodology.method} />
                <Field label="Evidence artifact IDs" value={detail.methodology.evidence_artifact_ids.length > 0
                  ? detail.methodology.evidence_artifact_ids.join(", ")
                  : "None recorded"} mono />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Methodology unavailable. No hypothesis or method is inferred.</p>
            )}
          </div>
        </div>
      </section>

      <section className="border-t p-4" aria-labelledby="research-inputs-title">
        <SectionTitle id="research-inputs-title">Sanitized evidence inputs</SectionTitle>
        {detail.evidence_inputs.length > 0 ? (
          <div className="mt-3 space-y-3">
            {detail.evidence_inputs.map((input) => (
              <article className="rounded-lg border p-3" key={input.evidence_artifact_id}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={input.source_kind} />
                  <StatusBadge status={input.sanitization_status} />
                  {input.truncated ? <StatusBadge status="truncated" /> : null}
                </div>
                <p className="mt-2 break-words text-sm">{input.summary}</p>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <Field label="Evidence artifact" value={input.evidence_artifact_id} mono />
                  <Field label="Artifact digest" value={input.artifact_digest} mono />
                  <Field label="Captured" value={formatTimestamp(input.captured_at)} />
                  <Field label="Qualification evidence" value="Hidden from ResearchWorker" />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No sanitized evidence inputs are recorded for this session.</p>
        )}
      </section>

      <section className="border-t p-4" aria-labelledby="research-submissions-title">
        <SectionTitle id="research-submissions-title">Checkpoint submissions and selection</SectionTitle>
        {detail.submission_history_availability === "checkpoint_summary" ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground tabular-nums">
              {detail.recorded_submission_count} recorded · {detail.projected_submission_count} projected · {detail.omitted_submission_count} omitted
            </p>
            {detail.development_submissions.length > 0 ? (
              <Table className="mt-3 min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Sequence</TableHead>
                    <TableHead scope="col">Decision</TableHead>
                    <TableHead scope="col">Evaluation</TableHead>
                    <TableHead scope="col">Risk</TableHead>
                    <TableHead scope="col">Net revenue</TableHead>
                    <TableHead scope="col">Summary</TableHead>
                    <TableHead scope="col">Artifact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.development_submissions.map((submission) => (
                    <TableRow key={submission.submission_sequence}>
                      <TableCell className="tabular-nums">{submission.submission_sequence}</TableCell>
                      <TableCell><StatusBadge status={submission.decision} /></TableCell>
                      <TableCell><StatusBadge status={submission.evaluation_status} /></TableCell>
                      <TableCell><StatusBadge status={submission.risk_decision} /></TableCell>
                      <TableCell>{formatMoney(submission.net_revenue_usdt)}</TableCell>
                      <TableCell className="min-w-60 whitespace-normal break-words">
                        {submission.summary}{submission.summary_truncated ? " (truncated)" : ""}
                      </TableCell>
                      <TableCell className="min-w-56 whitespace-normal break-all font-mono text-xs">
                        {submission.selected
                          ? `${submission.selected_system_code_ref.id} / ${submission.selected_system_code_artifact_digest}`
                          : <code>not_persisted</code>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No development submissions were recorded in the checkpoint.</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Unavailable until a terminal checkpoint is persisted.</p>
        )}
        <div className="mt-4 rounded-lg border p-3">
          <h5 className="text-xs font-semibold text-muted-foreground">Exact selected artifact</h5>
          {detail.selected_artifact_availability === "available" ? (
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <Field label="Submission" value={String(detail.selected_submission_sequence)} />
              <Field label="SystemCode" value={detail.selected_system_code_ref.id} mono />
              <Field label="Artifact digest" value={detail.selected_system_code_artifact_digest} mono />
            </dl>
          ) : detail.selected_artifact_availability === "not_selected" ? (
            <p className="mt-2 text-sm text-muted-foreground">No development submission was selected.</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Selected artifact unavailable; no identity is inferred.</p>
          )}
        </div>
      </section>

      <section className="border-t p-4" aria-labelledby="research-terminal-title">
        <SectionTitle id="research-terminal-title">Admission, conformance, Finding, lineage, and Arena handoff</SectionTitle>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Sealed evaluation" value={terminal.selected_sealed_evaluation
            ? `${formatStatus(terminal.selected_sealed_evaluation.result_status)} / ${formatStatus(terminal.selected_sealed_evaluation.evidence_disposition)}`
            : "Unavailable"} />
          <Field label="Evaluation result" value={terminal.selected_sealed_evaluation?.trading_evaluation_result_ref.id ?? "Unavailable"} mono />
          <Field label="Admission" value={terminal.admission
            ? `${formatStatus(terminal.admission.status)} / ${formatStatus(terminal.admission.reason)}`
            : "Unavailable"} />
          <Field label="Admission decision" value={terminal.admission?.candidate_admission_decision_ref.id ?? detail.admission_decision_ref?.id ?? "Unavailable"} mono />
          <Field label="Paper conformance" value={terminal.paper_handoff_conformance
            ? `${formatStatus(terminal.paper_handoff_conformance.status)} / ${formatStatus(terminal.paper_handoff_conformance.reason)}`
            : "Unavailable"} />
          <Field label="Conformance record" value={terminal.paper_handoff_conformance?.paper_trading_handoff_conformance_ref.id ?? detail.paper_handoff_conformance_ref?.id ?? "Unavailable"} mono />
          <Field label="Conformance digest" value={terminal.paper_handoff_conformance?.evidence_digest ?? "Unavailable"} mono />
          <Field label="Finding" value={terminal.finding
            ? `${formatStatus(terminal.finding.finding_kind)}: ${terminal.finding.summary}`
            : "Unavailable"} />
          <Field label="Finding record" value={terminal.finding?.research_finding_ref.id ?? "Unavailable"} mono />
          <Field label="Lineage" value={terminal.artifact_lineage?.artifact_lineage_ref.id ?? "Unavailable"} mono />
          <Field label="Child SystemCode" value={terminal.artifact_lineage?.child_system_code_ref.id ?? "Unavailable"} mono />
          <Field label="Parent SystemCode" value={terminal.artifact_lineage?.parent_system_code_ref?.id ?? "Unavailable"} mono />
        </dl>
        {handoff ? (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/8 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Exact admitted Arena handoff</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{handoff.candidate_ref.id}</p>
              </div>
              <a
                className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                href={operatorRouteHref({ section: "arena", selectedId: handoff.candidate_ref.id })}
              >
                Open admitted candidate in Arena
              </a>
            </div>
            <dl className="mt-3 grid gap-3 border-t pt-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Arena tick" value={handoff.candidate_arena_tick_ref.id} mono />
              <Field label="Candidate" value={handoff.candidate_ref.id} mono />
              <Field label="Direction" value={formatStatus(handoff.direction_kind)} />
              <Field label="Admission decision" value={handoff.candidate_admission_decision_ref.id} mono />
              <Field label="Handoff completed" value={formatTimestamp(handoff.completed_at)} />
            </dl>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No exact admitted Arena handoff is recorded.</p>
        )}
      </section>

      <section className="border-t p-4" aria-labelledby="research-notebook-title">
        <SectionTitle id="research-notebook-title">Notebook continuity</SectionTitle>
        {detail.notebook_summary.length > 0 ? (
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {detail.notebook_summary.map((entry, index) => <li className="break-words" key={`${index}:${entry}`}>{entry}</li>)}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No bounded notebook continuity is recorded.</p>
        )}
      </section>

      <section className="border-t p-4" aria-labelledby="research-lifecycle-title">
        <SectionTitle id="research-lifecycle-title">Controlled lifecycle events</SectionTitle>
        {detail.lifecycle_events.length > 0 ? (
          <Table className="mt-3 min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Sequence</TableHead>
                <TableHead scope="col">Occurred</TableHead>
                <TableHead scope="col">Kind</TableHead>
                <TableHead scope="col">Summary</TableHead>
                <TableHead scope="col">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.lifecycle_events.map((event) => (
                <TableRow key={event.sequence}>
                  <TableCell>{event.sequence}</TableCell>
                  <TableCell>{formatTimestamp(event.occurred_at)}</TableCell>
                  <TableCell><StatusBadge status={event.event_kind} /></TableCell>
                  <TableCell className="min-w-64 whitespace-normal break-words">{event.summary}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal break-all font-mono text-xs">{event.source_ref.record_kind}:{event.source_ref.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No controlled lifecycle events are recorded.</p>
        )}
        <Alert className="mt-4" variant="info">
          <AlertTitle>Provider logs are not persisted</AlertTitle>
          <AlertDescription>
            Only sanitized, controlled lifecycle summaries are available. Provider stdout, stderr, and mutable workspace logs are unavailable.
          </AlertDescription>
        </Alert>
      </section>

      <section className="border-t p-4" aria-labelledby="research-degradation-title">
        <SectionTitle id="research-degradation-title">Degradation and truncation</SectionTitle>
        {detail.degraded_reasons.length > 0 ? (
          <Alert className="mt-3" variant="warning">
            <AlertTitle>Projection degraded</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {detail.degraded_reasons.map((reason) => <li key={reason}>{formatStatus(reason)}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No projection degradation recorded.</p>
        )}
        {truncationMessages.length > 0 ? (
          <Alert className="mt-3" variant="info">
            <AlertTitle>Bounded projection truncation</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {truncationMessages.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No projection truncation recorded.</p>
        )}
      </section>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return <h4 id={id} className="text-sm font-semibold">{children}</h4>;
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words [overflow-wrap:anywhere]", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function researchTruncationMessages(detail: ResearchSessionDetailReadModel): string[] {
  const messages: string[] = [];
  if (detail.trigger_availability === "available" && detail.trigger.goal_truncated) messages.push("Goal text truncated");
  if (detail.methodology_availability === "available" && detail.methodology.hypothesis_truncated) messages.push("Hypothesis text truncated");
  if (detail.methodology_availability === "available" && detail.methodology.method_truncated) messages.push("Method text truncated");
  if (detail.provider_availability === "available" && detail.model_truncated) messages.push("Provider model text truncated");
  if (detail.latest_progress_summary_truncated) messages.push("Latest progress truncated");
  if (detail.evidence_inputs.some((input) => input.truncated)) messages.push("Evidence input summaries truncated");
  if (detail.development_submissions.some((submission) => submission.summary_truncated)) messages.push("Submission summaries truncated");
  if (detail.submission_history_availability === "checkpoint_summary" && detail.submission_history_truncated) {
    messages.push(`Submission history truncated: ${detail.omitted_submission_count} omitted`);
  }
  if (detail.notebook_summary_truncated) messages.push("Notebook continuity truncated");
  if (detail.lifecycle_events.some((event) => event.summary_truncated)) messages.push("Lifecycle event summaries truncated");
  if (detail.terminal_graph.finding?.summary_truncated) messages.push("Finding summary truncated");
  return messages;
}
