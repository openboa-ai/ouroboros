import { ActivityTimeline } from "@/ui/components/ActivityTimeline";
import type { CompanyViewData } from "@/features/company/model";
import { Observation } from "@/data/observation-presenters";
import { useId, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  FileText,
  MessageCircle,
  Shield,
  Terminal,
} from "lucide-react";
import { Button } from "@/ui/primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import {
  Member,
  SectionHeading,
  RecordLink,
  Facts,
  EmptyState,
  Status,
} from "@/ui/components/patterns";
import type { ViewProps } from "@/app/contracts";
import "@/features/company/company.css";

export function CompanyScreen({
  open,
  discuss,
  scenario,
  model,
}: ViewProps & { model: CompanyViewData }) {
  const { members, work, trace, history } = model;
  const [memberFilter, setMemberFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const traceId = useId();
  const empty = scenario === "empty";
  const delayed = scenario === "delayed";
  const restricted = scenario === "restricted";
  const uncertain = scenario === "uncertain";
  const activityHour = delayed ? "17" : "20";
  const visibleWork = empty
    ? []
    : work.filter(
        (item) => memberFilter === "all" || item.member === memberFilter,
      );
  const visibleTrace = empty
    ? []
    : trace.filter(
        (item) => memberFilter === "all" || item.member === memberFilter,
      );
  const memberStatus = (member: string) =>
    empty
      ? "Idle"
      : delayed
        ? "Not observed"
        : member === "nova"
          ? "Working"
          : uncertain
            ? "Blocked"
            : "Waiting";
  const observation = (
    <Observation
      scenario={empty ? "empty" : delayed ? "delayed" : "observed"}
      onSource={() => open({ kind: "source", id: "company" })}
    />
  );

  return (
    <div className="company-screen">
      {/* UX: ../../../../../docs/design/COMPANY_EXPERIENCE.md#o-02 — Priorities precede process counts. */}
      <section className="company-priority" aria-label="Current priorities">
        <div className="company-priority-copy">
          <SectionHeading
            title="Current priorities"
            note={
              empty
                ? "No operating view recorded"
                : `Operating view · Atlas · Written ${activityHour}:47 KST`
            }
          />
          {empty ? (
            <EmptyState
              title="No current work"
              detail="Members and retained records remain available."
            />
          ) : (
            <>
              <p className="type-section">
                Confirm the fill. Understand the carrying cost.
              </p>
              <p className="type-body muted">
                Atlas is waiting for a fresh order observation. Nova is checking
                the funding comparison before the next review.
              </p>
              <div className="company-inline">
                <Button
                  variant="secondary"
                  onClick={() =>
                    open({ kind: "decision", id: "position-review" })
                  }
                >
                  View rationale
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    discuss({
                      label: `Atlas’s operating view · ${activityHour}:47 KST`,
                      target: { kind: "decision", id: "position-review" },
                    })
                  }
                >
                  <MessageCircle data-icon="inline-start" />
                  Discuss with Atlas
                </Button>
              </div>
            </>
          )}
        </div>
        {/* UX: ../../../../../docs/design/COMPANY_EXPERIENCE.md#o-04 — Authored explanation and observed changes retain separate times. */}
        <div className="company-changes">
          <SectionHeading title="Recent changes" action={observation} />
          {empty ? (
            <p className="type-body muted">No recent changes in this sample.</p>
          ) : delayed ? (
            <p className="type-body muted">
              Current activity has not been observed. The latest retained
              summary was written at {activityHour}:47 KST.
            </p>
          ) : (
            <>
              <RecordLink
                variant="row"
                title="Funding comparison published"
                meta="Nova · 20:48 KST · revision 8"
                icon={<FileText size={16} />}
                onClick={() => open({ kind: "artifact", id: "funding-review" })}
              />
              <RecordLink
                variant="row"
                title={
                  uncertain
                    ? "Cancellation outcome unresolved"
                    : "Fill reconciliation updated"
                }
                meta="Atlas · 20:46 KST"
                icon={<Clock3 size={16} />}
                onClick={() => open({ kind: "work", id: "reconcile" })}
              />
            </>
          )}
        </div>
      </section>

      <div className="company-layout">
        {/* UX: ../../../../../docs/design/COMPANY_EXPERIENCE.md#o-03, #o-10, #o-13 — One work context, with secondary execution and evidence views. */}
        <Tabs defaultValue="work" className="company-activity">
          <div className="company-activity-toolbar">
            <TabsList aria-label="Company activity views">
              <TabsTrigger value="work">Work</TabsTrigger>
              <TabsTrigger value="executions">Executions</TabsTrigger>
              <TabsTrigger value="trace">Trace</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <Select
              value={memberFilter}
              onValueChange={(value) => setMemberFilter(value ?? "all")}
              items={{ all: "All members", atlas: "Atlas", nova: "Nova" }}
            >
              <SelectTrigger aria-label="Filter activity by member">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All members</SelectItem>
                <SelectItem value="atlas">Atlas</SelectItem>
                <SelectItem value="nova">Nova</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="work" className="company-tab-content">
            <div className="company-view-heading">
              <span className="type-meta muted">Current work</span>
              <span className="type-meta muted">
                {visibleWork.length} work items
              </span>
            </div>
            {visibleWork.length === 0 ? (
              <EmptyState
                title="No current work"
                detail="There is no work in this view. No new task is required to inspect the company."
              />
            ) : (
              visibleWork.map((item) => {
                const member = members.find(
                  (person) => person.id === item.member,
                )!;
                return (
                  <article className="company-work-row" key={item.id}>
                    <div className="company-work-main">
                      <RecordLink
                        variant="row"
                        title={item.title}
                        meta={
                          uncertain && item.id === "reconcile"
                            ? "Cancellation response missing; remaining quantity is unknown."
                            : item.result
                        }
                        onClick={() => open({ kind: "work", id: item.id })}
                      />
                      <p className="type-meta muted company-next">
                        {delayed ? "Last known condition" : "Condition"}:{" "}
                        {uncertain && item.id === "reconcile"
                          ? "Reconcile the original cancellation"
                          : item.next}
                      </p>
                    </div>
                    <div className="company-work-owner">
                      <Button
                        variant="ghost"
                        className="company-member-button"
                        onClick={() => open({ kind: "member", id: member.id })}
                      >
                        <Member name={member.name} role={member.role} compact />
                      </Button>
                      <Status>{memberStatus(member.id)}</Status>
                    </div>
                  </article>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="executions" className="company-tab-content">
            <div className="company-view-heading">
              <span className="type-meta muted">
                Current attempts · Sep 13, 2026
              </span>
              <span className="type-meta muted">KST</span>
            </div>
            {visibleWork.length === 0 ? (
              <EmptyState
                title="No executions in this view"
                detail="An idle member still retains their identity and history."
              />
            ) : (
              visibleWork.map((item) => (
                <article className="company-execution-row" key={item.execution}>
                  <RecordLink
                    variant="row"
                    title={
                      item.execution === "run-atlas"
                        ? "Atlas · Fill reconciliation"
                        : "Nova · Funding research"
                    }
                    meta={`${item.execution} · Started ${activityHour}:${item.member === "atlas" ? "40" : "42"} KST`}
                    icon={<Terminal size={16} />}
                    onClick={() =>
                      open({ kind: "execution", id: item.execution })
                    }
                  />
                  <div className="company-execution-state">
                    <Status>{memberStatus(item.member)}</Status>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        open({ kind: "controls", id: item.execution })
                      }
                    >
                      Stop execution
                    </Button>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="company-tab-content">
            <SectionHeading
              title="Company history"
              note="Decisions, responsibility and results"
            />
            {empty ? (
              <EmptyState
                title="No retained history"
                detail="No events are available for this sample company."
              />
            ) : (
              <ActivityTimeline
                label="Company history"
                items={history
                  .filter(
                    (e) => memberFilter === "all" || e.member === memberFilter,
                  )
                  .map((e) => ({
                    ...e,
                    state: "observed",
                    onOpen: () => open(e.target),
                  }))}
              />
            )}
          </TabsContent>
          <TabsContent value="trace" className="company-tab-content">
            <SectionHeading
              title="Recorded activity"
              note="Public tool calls and receipts · sample records · KST"
            />
            {restricted && (
              <div className="company-access-note" role="status">
                <Shield size={16} />
                <span className="type-data">
                  Tool payload access is restricted. Permitted event metadata
                  remains visible.
                </span>
              </div>
            )}
            {delayed && (
              <p className="type-meta muted">
                Retained events below are historical; current activity is not
                observed.
              </p>
            )}
            {visibleTrace.length === 0 ? (
              <EmptyState
                title="No retained activity"
                detail="No tool calls or receipts are available for this view."
              />
            ) : (
              <ol className="company-trace-list">
                {visibleTrace.map((event) => (
                  <li className="company-trace-event" key={event.id}>
                    <time className="type-meta muted company-trace-time">
                      {event.time.replace("20:", `${activityHour}:`)}
                    </time>
                    <div className="company-trace-body">
                      <Button
                        variant="ghost"
                        className="company-trace-trigger"
                        aria-expanded={expanded === event.id}
                        aria-controls={`${traceId}-${event.id}`}
                        onClick={() =>
                          setExpanded(expanded === event.id ? null : event.id)
                        }
                      >
                        <span className="company-trace-copy">
                          <span className="type-control">{event.tool}</span>
                          <span className="type-meta muted">
                            {event.source} ·{" "}
                            {event.member === "atlas" ? "Atlas" : "Nova"}
                          </span>
                        </span>
                        <ChevronDown
                          size={14}
                          className={
                            expanded === event.id ? "company-expanded" : ""
                          }
                        />
                      </Button>
                      <p className="type-data company-trace-result">
                        {event.result}
                      </p>
                      {expanded === event.id && (
                        <div
                          id={`${traceId}-${event.id}`}
                          className="company-trace-detail"
                        >
                          {restricted ? (
                            <p className="type-data muted">
                              Access restricted. Payload content is unavailable
                              in this view.
                            </p>
                          ) : (
                            <pre className="type-data">
                              {JSON.stringify(event.payload, null, 2)}
                            </pre>
                          )}
                          <Button
                            variant="secondary"
                            onClick={() => open(event.target)}
                          >
                            Open related record
                            <ArrowRight data-icon="inline-end" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>

        <aside
          className="company-members"
          aria-label="Members and recorded usage"
        >
          {/* UX: ../../../../../docs/design/COMPANY_EXPERIENCE.md#o-05, #o-06 — Continuing principals; two work-driven examples, not fixed departments. */}
          <section>
            <SectionHeading title="Members" note="2 members" />
            {members.map((member) => (
              <div className="company-roster-row" key={member.id}>
                <Button
                  variant="ghost"
                  className="company-member-button"
                  onClick={() => open({ kind: "member", id: member.id })}
                >
                  <Member name={member.name} role={member.role} />
                </Button>
                <div className="company-roster-context">
                  <span className="type-meta muted">
                    {member.responsibility}
                  </span>
                  <Status>{memberStatus(member.id)}</Status>
                </div>
              </div>
            ))}
          </section>
          {/* UX: ../../../../../docs/design/COMPANY_EXPERIENCE.md#o-15 — Attributed cost evidence, not an efficiency score or company profit. */}
          <section>
            <SectionHeading
              title="Operating costs"
              note="Company scope · Sep 7–13, 2026"
            />
            <Button
              variant="ghost"
              onClick={() => open({ kind: "costs", period: "week" })}
            >
              View company costs
              <ArrowRight data-icon="inline-end" />
            </Button>
          </section>
          <section>
            <SectionHeading title="Responsibility" />
            <Facts
              rows={[
                ["Operating lead", "Atlas"],
                ["Current handover", "None recorded"],
              ]}
            />
            <RecordLink
              variant="row"
              title="Assignment history"
              meta="Atlas · Operating lead"
              onClick={() => open({ kind: "member", id: "atlas" })}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
