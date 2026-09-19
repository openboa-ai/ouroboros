import {
  ArrowUpRight,
  Check,
  Circle,
  CircleHelp,
  Clock3,
  Layers3,
  RefreshCw,
  Square,
  Unplug,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ViewProps } from "@/app/contracts";
import { Button } from "@/ui/primitives/button";
import {
  EmptyState,
  Facts,
  RecordLink,
  SectionHeading,
} from "@/ui/components/patterns";
import {
  dependencyLabel,
  observedTime,
  serviceName,
  serviceState,
  shortId,
  type ServiceCollection,
  type ServiceObservation,
  type Tone,
} from "./model";
import type { PendingServiceStop } from "./stop";
import "./services.css";

function Signal({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className="service-signal type-meta" data-tone={tone}>
      <Circle size={6} fill="currentColor" />
      {children}
    </span>
  );
}
/** System answers which Company calls need attention without presenting them as platform services. */
export function ServiceList({
  collection,
  query,
  open,
}: { collection?: ServiceCollection; query: string } & Pick<
  ViewProps,
  "open"
>) {
  if (!collection)
    return (
      <EmptyState
        title="Company call observations unavailable"
        detail="This connection does not provide registered recovery records."
      />
    );
  const items = collection.groups.flatMap((g) =>
    g.items.map((item) => ({ item, work: g.title })),
  );
  const matches = items.filter(({ item, work }) =>
    `${serviceName(item)} ${item.target} ${work} ${serviceState(item.state).label}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const incomplete =
    collection.partial ||
    collection.groups.some((g) => g.hasMore || g.unavailable);
  return (
    <section className="service-list" aria-label="Company calls">
      <SectionHeading
        title="Company calls"
        note="Execution and recovery of registered calls"
      />
      <div className="service-list-meta type-meta muted">
        <span>
          {items.length} loaded
          {incomplete ? " · Partial coverage" : " in visible work"}
        </span>
        <span>{collection.source}</span>
      </div>
      {!!items.length && (
        <div className="service-column-head type-meta muted" aria-hidden="true">
          <span>Call / work</span>
          <span>Execution & recovery</span>
          <span>Restarts remaining</span>
          <span />
        </div>
      )}
      <div className="service-rows">
        {matches.map(({ item, work }) => {
          const status = serviceState(item.state);
          const problems = item.dependencies.targets.filter(
            (t) =>
              t.selection !== "selection_current" ||
              t.caller_access !== "permitted",
          ).length;
          return (
            <button
              className="service-row"
              key={item.root_intent_id}
              onClick={() =>
                open({
                  kind: "service-continuation",
                  id: item.root_intent_id,
                  workId: item.work_id,
                })
              }
            >
              <span className="service-call-name">
                <span className="type-control capitalize">
                  {serviceName(item)}
                </span>
                <span className="type-meta muted">{work}</span>
              </span>
              <span className="service-call-state">
                <Signal tone={status.tone}>{status.label}</Signal>
                <span className="type-meta muted">
                  {problems
                    ? `${problems} resource ${problems === 1 ? "check" : "checks"} need attention`
                    : "Health not measured"}
                </span>
              </span>
              <span className="service-budget">
                <span className="type-control tabular-nums">
                  {item.policy.max_restarts - item.restarts_used}{" "}
                  <span className="muted">/ {item.policy.max_restarts}</span>
                </span>
                <span className="type-meta muted">
                  {item.desired === "stopped"
                    ? "Recovery stopped"
                    : `Read ${observedTime(item.observation.observed_at)}`}
                </span>
              </span>
              <ArrowUpRight size={14} />
            </button>
          );
        })}
      </div>
      {!matches.length && (
        <EmptyState
          title={
            items.length
              ? "No matching calls"
              : collection.groups.some((g) => g.unavailable)
                ? "Call observations unavailable"
                : "No registered call recovery"
          }
          detail={
            items.length
              ? "Search covers the loaded calls and their work."
              : "Only calls with a recorded recovery policy appear here. Other services may exist."
          }
        />
      )}
      {collection.groups
        .filter((g) => g.unavailable || g.hasMore)
        .map((g) => (
          <div className="service-coverage type-meta muted" key={g.workId}>
            <Unplug size={14} />
            <span>
              {g.title} ·{" "}
              {g.unavailable
                ? "Observation unavailable"
                : "First 25 calls shown; more records exist"}
            </span>
          </div>
        ))}
    </section>
  );
}

export interface ServiceControl {
  busy: boolean;
  error: string;
  pending: PendingServiceStop | null;
  outcome: "unknown" | "recorded" | "missing" | "rejected";
  stop: () => void;
  check: () => void;
  refresh: () => void;
  review: () => void;
}
/** Purpose: follow one original call through replacement executions, dependencies and actual effects. */
export function ServiceDetail({
  service: s,
  open,
  discuss,
  control,
  source = "Core records",
}: Pick<ViewProps, "open" | "discuss"> & {
  service: ServiceObservation;
  control?: ServiceControl;
  source?: string;
}) {
  const status = serviceState(s.state),
    current = s.history.at(-1)!;
  const receipts = s.effects.filter((e) => e.receipt_available).length;
  return (
    <div className="service-detail">
      <header className="service-detail-heading">
        <div>
          <div className="type-meta muted">
            {source} · Read {observedTime(s.observation.observed_at)}
          </div>
          <h2 className="type-section capitalize">{serviceName(s)}</h2>
          <div className="type-meta muted">
            {s.target} · Call {shortId(s.root_intent_id)}
          </div>
        </div>
        <div className="service-actions">
          <Button
            variant="secondary"
            onClick={() =>
              discuss({
                label: serviceName(s),
                target: {
                  kind: "service-continuation",
                  id: s.root_intent_id,
                  workId: s.work_id,
                },
              })
            }
          >
            Discuss with CEO
          </Button>
          {control && (
            <Button
              variant="ghost"
              aria-label="Refresh service observation"
              disabled={control.busy}
              onClick={control.refresh}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>
      </header>
      <div className="service-status-band" data-tone={status.tone}>
        <Signal tone={status.tone}>{status.label}</Signal>
        <p className="type-data muted">{status.detail}</p>
      </div>
      <div className="service-metrics">
        <Metric
          icon={<Layers3 size={16} />}
          label="Current execution"
          value={current.phase?.replaceAll("_", " ") ?? "Not assigned"}
          note={shortId(s.current_execution_id)}
        />
        <Metric
          icon={<RefreshCw size={16} />}
          label="Restarts remaining"
          value={`${s.policy.max_restarts - s.restarts_used} / ${s.policy.max_restarts}`}
          note={`${s.policy.backoff_seconds}s backoff · Original allowance`}
        />
        <Metric
          icon={<CircleHelp size={16} />}
          label="Service health"
          value="Not measured"
          note="No qualified health probe"
        />
        <Metric
          icon={<Check size={16} />}
          label="Effect receipts"
          value={`${receipts} / ${s.effects.length}`}
          note="Receipts are separate from settlement"
        />
      </div>
      <div className="service-detail-columns">
        <div className="service-detail-main">
          <section>
            <SectionHeading
              title="Required resources"
              note="Selected configuration and original caller permissions"
            />
            <div className="service-dependencies">
              {s.dependencies.targets.map((t) => (
                <div className="service-dependency" key={t.target}>
                  <div className="service-call-name">
                    <span className="type-control">{t.target}</span>
                    <span className="type-meta muted">
                      {t.operations.join(" · ")}
                    </span>
                  </div>
                  <div className="service-call-state">
                    <Signal
                      tone={
                        t.selection === "selection_current"
                          ? "neutral"
                          : "attention"
                      }
                    >
                      {dependencyLabel(t.selection)}
                    </Signal>
                    <span className="type-meta muted">
                      Caller permission ·{" "}
                      {t.caller_access === "permitted"
                        ? "Permitted"
                        : "Restricted"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="service-inputs type-meta muted">
              <Layers3 size={14} />
              <span>
                {s.dependencies.inputs.retained} / {s.dependencies.inputs.total}{" "}
                current execution inputs retained
              </span>
            </div>
            <p className="type-meta muted">
              These checks do not measure availability or reserve dependency
              capacity. Execution and resource admission still apply.
            </p>
          </section>
          <section>
            <SectionHeading
              title="Execution history"
              note="Every replacement retains the original call"
            />
            <div className="service-history">
              {s.history.map((h) => (
                <RecordLink
                  key={h.execution_id}
                  variant="row"
                  title={`${h.ordinal === 0 ? "Original execution" : `Restart ${h.ordinal}`} · ${shortId(h.execution_id)}`}
                  meta={`${h.phase?.replaceAll("_", " ") ?? "Not assigned"} · ${h.terminated ? "Termination recorded" : "Termination not observed"} · ${h.compute_returned ? "Compute returned" : "Return not observed"}`}
                  onClick={() =>
                    open({ kind: "execution", id: h.execution_id })
                  }
                />
              ))}
            </div>
          </section>
          <section>
            <SectionHeading
              title="Resource effects"
              note="Results recorded for this original call"
            />
            {s.effects.length ? (
              s.effects.map((e) => (
                <RecordLink
                  key={e.intent_id}
                  variant="row"
                  title={`${e.slot} · ${e.operation}`}
                  meta={`${e.state} · ${e.receipt_available ? "Receipt available" : "Receipt pending"}`}
                  onClick={() =>
                    open({ kind: "control-request", id: e.intent_id })
                  }
                />
              ))
            ) : (
              <p className="type-data muted service-section-empty">
                No child resource requests recorded.
              </p>
            )}
          </section>
        </div>
        <aside className="service-detail-aside">
          <section className="service-policy">
            <SectionHeading title="Recovery policy" />
            <Facts
              rows={[
                [
                  "Desired outcome",
                  s.desired === "stopped"
                    ? "Remain stopped"
                    : "Complete the original call",
                ],
                [
                  "Recovery window ends",
                  observedTime(
                    new Date(s.restart_expires_at_seconds * 1000).toISOString(),
                  ),
                ],
                [
                  "Compute return",
                  s.never_dispatched
                    ? "Never dispatched"
                    : s.compute_returned
                      ? "Return confirmed"
                      : "Pending observation",
                ],
                [
                  "Firm compute available",
                  s.compute
                    ? `${s.compute.available} / ${s.compute.capacity} units`
                    : "Outside current scope",
                ],
              ]}
            />
            <Button
              variant="ghost"
              onClick={() => open({ kind: "work", id: s.work_id })}
            >
              Related work
              <ArrowUpRight size={14} />
            </Button>
          </section>
          <section className="service-stop">
            <SectionHeading title="Stop this call" />
            <p className="type-meta muted">
              Restrict its current execution and automatic recovery. Existing
              external effects still need reconciliation.
            </p>
            {!control ? (
              <>
                <Button variant="secondary" disabled>
                  <Square size={13} />
                  Preview only
                </Button>
                <p className="type-meta muted">
                  Sample controls do not submit requests.
                </p>
              </>
            ) : (
              <>
                {control.error && (
                  <p className="type-data service-error" role="alert">
                    {control.error}
                  </p>
                )}
                {!control.pending ? (
                  <Button
                    variant="destructive"
                    disabled={control.busy || !!control.error || !s.can_stop}
                    onClick={control.stop}
                  >
                    <Square size={13} />
                    Stop call & recovery
                  </Button>
                ) : (
                  <div className="service-stop-status" role="status">
                    <Signal
                      tone={
                        control.outcome === "recorded" ? "neutral" : "attention"
                      }
                    >
                      {control.outcome === "recorded"
                        ? "Restriction recorded"
                        : control.outcome === "missing"
                          ? "No receipt found"
                          : control.outcome === "rejected"
                            ? "Request rejected"
                            : "Request outcome unresolved"}
                    </Signal>
                    <span className="type-meta muted">
                      Request {shortId(control.pending.key)} · Execution{" "}
                      {shortId(control.pending.executionId)}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={control.busy}
                      onClick={control.check}
                    >
                      <Clock3 size={14} />
                      Check original request
                    </Button>
                    {control.pending.rejected && (
                      <Button
                        variant="ghost"
                        disabled={control.busy}
                        onClick={control.review}
                      >
                        Review current target
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
          <details className="service-reference">
            <summary className="type-meta muted">Record references</summary>
            <Facts
              rows={[
                ["Call", s.root_intent_id],
                ["Execution", s.current_execution_id],
                ["Authority revision", s.observation.authority_revision],
              ]}
            />
          </details>
        </aside>
      </div>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="service-metric">
      <div className="type-meta muted">
        {icon}
        {label}
      </div>
      <span className="type-control tabular-nums capitalize">{value}</span>
      <span className="type-meta muted">{note}</span>
    </div>
  );
}
