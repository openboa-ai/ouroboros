import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OuroborosCommandRequest, ResearchSessionDetailReadModel } from "@ouroboros/domain";
import {
  ArrowLeft,
  Beaker,
  BookOpenCheck,
  BrainCircuit,
  FileClock,
  FlaskConical,
  GitBranch,
  Layers3,
  Pause,
  Play,
  Search,
  Zap
} from "lucide-react";
import {
  buildResearchSessionViewModel,
  type ResearchHistoryViewModel,
  type ResearchSessionViewModel,
  type ResearchWorkspaceViewModel
} from "@/app/operator-view-model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandConfirmation } from "@/components/command-confirmation";
import { OperatorMetricStrip } from "@/components/operator-metrics";
import { StatusBadge } from "@/components/operator-status";
import { focusNarrowDetail } from "@/lib/operator-focus";
import { formatCompactId, formatMoney, formatPercent, formatStatus, formatTimestamp } from "@/lib/operator-format";
import { cn } from "@/lib/utils";
import { ResearchSessionEvidence } from "@/screens/research-session-evidence";

export type ResearchMasterTab = "sessions" | "history";

const OPERATOR_RESEARCH_SESSION_RENDER_LIMIT = 60;
const RESEARCH_DEGRADED_REASON_RENDER_LIMIT = 3;
const RESEARCH_DEGRADED_REASON_LABELS: Record<
  ResearchSessionViewModel["degradedReasons"][number],
  string
> = {
  trigger_unavailable: "Trigger Unavailable",
  methodology_unavailable: "Methodology Unavailable",
  provider_unavailable: "Provider Unavailable",
  worker_unavailable: "Worker Unavailable",
  evidence_artifact_unavailable: "Evidence Artifact Unavailable",
  selected_artifact_unavailable: "Selected Artifact Unavailable",
  terminal_admission_unavailable: "Terminal Admission Unavailable",
  evaluation_graph_conflict: "Evaluation Graph Conflict",
  admission_graph_conflict: "Admission Graph Conflict",
  inactive_incomplete_graph: "Inactive Incomplete Graph"
};

export function resolveResearchMasterTab({
  currentTab,
  previousSessionCount,
  sessionCount,
  selectedId
}: {
  currentTab: ResearchMasterTab;
  previousSessionCount: number;
  sessionCount: number;
  selectedId?: string;
}): ResearchMasterTab {
  if (selectedId || (previousSessionCount === 0 && sessionCount > 0)) {
    return "sessions";
  }
  return currentTab;
}

export function closeResearchDetail({
  onSelect,
  originId,
  getOrigin,
  schedule = (callback) => requestAnimationFrame(callback)
}: {
  onSelect: (id?: string) => void;
  originId?: string;
  getOrigin: (id: string) => Pick<HTMLElement, "focus"> | undefined;
  schedule?: (callback: () => void) => void;
}): void {
  onSelect(undefined);
  if (!originId) return;
  schedule(() => getOrigin(originId)?.focus());
}

export function preserveResearchOrigin(originId?: string, selectedId?: string): string | undefined {
  return originId === selectedId ? originId : undefined;
}

export function ResearchScreen({
  view,
  detail,
  detailLoading = false,
  detailError,
  selectedId,
  commandRunning,
  onSelect,
  onCommand
}: {
  view: ResearchWorkspaceViewModel;
  detail?: ResearchSessionDetailReadModel;
  detailLoading?: boolean;
  detailError?: string;
  selectedId?: string;
  commandRunning: boolean;
  onSelect: (id?: string) => void;
  onCommand: (label: string, request: OuroborosCommandRequest) => void;
}) {
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const narrowCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const originSessionIdRef = useRef<string | undefined>(undefined);
  const exactDetail = selectedId && detail?.research_work_item_id === selectedId ? detail : undefined;
  const selected = selectedId
    ? view.sessions.find((session) => session.id === selectedId) ??
      (exactDetail ? buildResearchSessionViewModel(exactDetail) : undefined)
    : undefined;
  const activeSessions = view.sessions.filter((session) => [
    "allocating",
    "running",
    "awaiting_selection",
    "sealed_admission",
    "recovering"
  ].includes(session.status));
  const recordedSessionCount = view.sessionWindow?.recordedCount ?? view.sessions.length;

  useEffect(() => {
    if (selectedId) {
      focusNarrowDetail(detailHeadingRef.current);
    }
  }, [selectedId]);

  useEffect(() => {
    originSessionIdRef.current = preserveResearchOrigin(originSessionIdRef.current, selectedId);
  }, [selectedId]);

  const selectFromNarrowCard = (id: string) => {
    originSessionIdRef.current = id;
    onSelect(id);
  };

  const backToSessions = () => closeResearchDetail({
    onSelect,
    originId: originSessionIdRef.current,
    getOrigin: (id) => narrowCardRefs.current.get(id)
  });

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <section className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Methodology workspace</h2>
            <StatusBadge
              status={view.loopStatus}
              label={`Loop ${formatStatus(view.loopStatus).toLowerCase()}`}
            />
            <StatusBadge
              status={view.availability}
              label={view.availability === "authoritative"
                ? "Session projection"
                : view.availability === "history_only"
                  ? "History only"
                  : "Projection unavailable"}
            />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Evidence-fed ResearchWorker sessions generating bounded TradingSystem candidates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={commandRunning || view.loopStatus === "running"}
            onClick={() => onCommand("Start Research loop", { command_kind: "arena.start" })}
          >
            <Play data-icon="inline-start" aria-hidden="true" /> Start
          </Button>
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Run Research tick", { command_kind: "arena.tick" })}
          >
            <Zap data-icon="inline-start" aria-hidden="true" /> Run tick
          </Button>
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Run Research cycle", { command_kind: "arena.cycle" })}
          >
            <Beaker data-icon="inline-start" aria-hidden="true" /> Run cycle
          </Button>
          <CommandConfirmation
            title="Stop the Research loop?"
            description="This stops new CandidateArena research work. It does not alter existing admissions, paper evidence, or Trading authority."
            confirmLabel="Stop Research"
            destructive
            onConfirm={() => onCommand("Stop Research loop", { command_kind: "arena.stop" })}
            trigger={(
              <Button disabled={commandRunning || view.loopStatus === "stopped"} variant="destructive">
                <Pause data-icon="inline-start" aria-hidden="true" /> Stop
              </Button>
            )}
          />
        </div>
      </section>

      {view.availability === "history_only" ? (
        <div className="px-4 pb-4">
          <Alert variant="info">
            <FileClock aria-hidden="true" />
            <AlertTitle>Research session projection pending</AlertTitle>
            <AlertDescription>
              Completed CandidateArena ticks are shown as historical outcomes only. Configured researcher directions are not presented as running sessions.
            </AlertDescription>
          </Alert>
        </div>
      ) : view.availability === "unavailable" ? (
        <div className="px-4 pb-4">
          <Alert variant="warning">
            <BrainCircuit aria-hidden="true" />
            <AlertTitle>Research projection unavailable</AlertTitle>
            <AlertDescription>
              The Research operations projection could not be rebuilt. CandidateArena history and other Operator surfaces remain available; this is not a healthy empty session queue.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <OperatorMetricStrip metrics={[
        {
          label: "Actual sessions",
          value: String(recordedSessionCount),
          detail: view.sessionWindow?.truncated
            ? `${activeSessions.length} active · ${view.sessionWindow.projectedCount} projected · ${view.sessionWindow.omittedCount} omitted`
            : `${activeSessions.length} active`
        },
        {
          label: "Capacity",
          value: view.capacity ? `${view.capacity.active_session_count} / ${view.capacity.max_concurrent_sessions}` : "Unavailable",
          detail: view.capacity ? `${view.capacity.queued_session_count} queued` : "Projection required"
        },
        { label: "Completed ticks", value: String(view.history.length), detail: "Historical outcomes" },
        { label: "Authority", value: "Research only", detail: "No admission self-authority" }
      ]} />

      {view.emptyState === "available_empty" && view.history.length === 0 && !selectedId ? (
        <Empty className="min-h-72 border-b">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FlaskConical aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No Research sessions</EmptyTitle>
            <EmptyDescription>
              The Research projection is available and currently contains no queued or historical session.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view.sessions.length > 0 || view.history.length > 0 || selectedId ? (
        <div className="grid min-h-[36rem] border-b lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.6fr)]">
          <ResearchMaster
            view={view}
            selectedId={selectedId}
            onSelect={onSelect}
            onSelectNarrow={selectFromNarrowCard}
            narrowCardRefs={narrowCardRefs}
          />
          <ResearchDetail
            detailHeadingRef={detailHeadingRef}
            session={selected}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            selectedId={selectedId}
            onBack={backToSessions}
          />
        </div>
      ) : null}

      <ResearchContext view={view} />
    </div>
  );
}

function ResearchMaster({
  view,
  selectedId,
  onSelect,
  onSelectNarrow,
  narrowCardRefs
}: {
  view: ResearchWorkspaceViewModel;
  selectedId?: string;
  onSelect: (id: string) => void;
  onSelectNarrow: (id: string) => void;
  narrowCardRefs: RefObject<Map<string, HTMLButtonElement>>;
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ResearchMasterTab>(
    selectedId || view.sessions.length > 0 ? "sessions" : "history"
  );
  const previousSessionCountRef = useRef(view.sessions.length);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return view.sessions;
    }
    return view.sessions.filter((session) => (
      `${session.goal} ${session.hypothesis} ${session.direction} ${session.id}`
        .toLowerCase()
        .includes(normalized)
    ));
  }, [query, view.sessions]);
  const visibleSessions = useMemo(
    () => boundedResearchSessions(filtered, selectedId),
    [filtered, selectedId]
  );

  useEffect(() => {
    setActiveTab((currentTab) => resolveResearchMasterTab({
      currentTab,
      previousSessionCount: previousSessionCountRef.current,
      sessionCount: view.sessions.length,
      selectedId
    }));
    previousSessionCountRef.current = view.sessions.length;
  }, [selectedId, view.sessions.length]);

  return (
    <section className={cn("min-w-0 border-r", selectedId && "max-lg:hidden")} aria-label="Research work">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "sessions" || value === "history") {
            setActiveTab(value);
          }
        }}
      >
        <div className="flex flex-col gap-2 border-b p-3">
          <TabsList className="w-full">
            <TabsTrigger value="sessions" className="flex-1">Sessions {view.sessions.length}</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Tick history {view.history.length}</TabsTrigger>
          </TabsList>
          {activeTab === "sessions" ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label="Filter Research sessions"
                  className="pl-8"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter methodology sessions"
                />
              </div>
              {view.sessionWindow?.truncated ? (
                <p className="break-words text-xs text-muted-foreground">
                  Bounded summary projection: {view.sessionWindow.projectedCount} of {view.sessionWindow.recordedCount} sessions · {view.sessionWindow.omittedCount} omitted · exact URL detail remains available.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <TabsContent value="sessions" className="mt-0">
          <div className="hidden lg:block">
            <Table className="min-w-[1100px] table-fixed">
              <TableHeader>
                <TableRow>
                  {[
                    "Lifecycle", "Methodology", "Direction", "Trigger", "Provider",
                    "Budget", "Submissions", "Result", "Latest progress"
                  ].map((header) => <TableHead scope="col" key={header}>{header}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSessions.map((session) => (
                  <TableRow data-state={selectedId === session.id ? "selected" : undefined} key={session.id}>
                    <TableCell className="whitespace-normal">
                      <button
                        aria-current={selectedId === session.id ? "true" : undefined}
                        className="min-h-10 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onSelect(session.id)}
                        type="button"
                      >
                        <span className="flex flex-wrap gap-1">
                          <StatusBadge status={session.status} />
                          <StatusBadge status={session.projectionHealth} />
                        </span>
                        <span className="mt-1 block break-all font-mono text-[0.6875rem] text-muted-foreground">{session.id}</span>
                        {researchSessionDegradationSummary(session) ? (
                          <span className="mt-1 block break-words text-xs text-warning">
                            {researchSessionDegradationSummary(session)}
                          </span>
                        ) : null}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {session.methodologyAvailability === "available" ? (
                        <>
                          <span className="block">{session.hypothesis || "Hypothesis unavailable"}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{session.method || "Method unavailable"}</span>
                        </>
                      ) : "Methodology unavailable"}
                    </TableCell>
                    <TableCell className="whitespace-normal">{formatStatus(session.direction)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {session.triggerAvailability === "available" ? (
                        <>
                          <span className="block">{formatStatus(session.triggerKind)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{session.goal || "Goal unavailable"}</span>
                        </>
                      ) : "Trigger unavailable"}
                    </TableCell>
                    <TableCell className="whitespace-normal">{session.providerAvailability === "available"
                      ? `${formatStatus(session.provider)}${session.model ? ` / ${session.model}` : ""}`
                      : "Unavailable"}</TableCell>
                    <TableCell className="whitespace-normal tabular-nums">{session.completedExperimentCount} / {session.maxExperimentCount}</TableCell>
                    <TableCell className="whitespace-normal tabular-nums">{session.developmentSubmissionCount} / {session.maxDevelopmentSubmissionCount}</TableCell>
                    <TableCell className="whitespace-normal break-all">{researchSessionResult(session)}</TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {session.latestProgressSummary}
                      <span className="mt-1 block text-xs text-muted-foreground">{formatTimestamp(session.lastProgressAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y lg:hidden">
            {visibleSessions.map((session) => (
              <button
                aria-current={selectedId === session.id ? "true" : undefined}
                className={cn(
                  "min-h-10 w-full px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selectedId === session.id && "bg-brand/8"
                )}
                key={session.id}
                onClick={() => onSelectNarrow(session.id)}
                ref={(node) => {
                  if (node) narrowCardRefs.current.set(session.id, node);
                  else narrowCardRefs.current.delete(session.id);
                }}
                type="button"
              >
                <span className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-medium">{researchSessionHeading(session)}</span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1">
                    <StatusBadge status={session.status} />
                    <StatusBadge status={session.projectionHealth} />
                  </span>
                </span>
                {researchSessionDegradationSummary(session) ? (
                  <span className="mt-1 block break-words text-xs text-warning">
                    {researchSessionDegradationSummary(session)}
                  </span>
                ) : null}
                <span className="mt-1 block break-words text-xs text-muted-foreground">
                  {formatStatus(session.direction)} · {session.providerAvailability === "available" ? formatStatus(session.provider) : "Provider unavailable"}
                </span>
                <span className="mt-1 block break-words text-xs text-muted-foreground">
                  {researchSessionTriggerSummary(session)}
                </span>
                <span className="mt-1 block break-words text-xs text-muted-foreground">
                  {researchSessionMethodologySummary(session)}
                </span>
                <span className="mt-2 block">
                  <Progress
                    aria-label={`${session.completedExperimentCount} of ${session.maxExperimentCount} experiments completed`}
                    value={session.maxExperimentCount > 0
                      ? (session.completedExperimentCount / session.maxExperimentCount) * 100
                      : 0}
                  />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                  {session.completedExperimentCount} / {session.maxExperimentCount} experiments · {session.developmentSubmissionCount} / {session.maxDevelopmentSubmissionCount} submissions
                </span>
                <span className="mt-1 block break-words text-xs text-muted-foreground">{session.latestProgressSummary}</span>
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No actual sessions match this filter.</p>
          ) : null}
          {visibleSessions.length < filtered.length ? (
            <p className="px-4 py-3 text-center text-xs text-muted-foreground">
              Showing {visibleSessions.length} of {filtered.length} matching sessions
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="history" className="mt-0 divide-y">
          {view.history.map((tick) => (
            <div className="px-4 py-3" key={tick.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{formatCompactId(tick.id)}</span>
                <StatusBadge status={tick.status} />
              </div>
              <p className="mt-2 text-sm">
                {tick.createdCandidateCount} generated · {tick.failedDirectionCount} failed · {tick.directionCount} directions
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tick.sourceCandidate
                  ? `Source ${formatStatus(tick.sourceCandidate.sourceKind)} · ${tick.sourceCandidate.displayName} · ${formatCompactId(tick.sourceCandidate.candidateId)}${tick.sourceCandidate.netRevenueUsdt === undefined ? "" : ` · ${formatMoney(tick.sourceCandidate.netRevenueUsdt)}`}`
                  : "Source candidate not recorded"}
              </p>
              {tick.directions.length > 0 ? (
                <div className="mt-3 divide-y border-y">
                  {tick.directions.map((direction) => {
                    const outcome = researchHistoryOutcome(direction);
                    const efficiency = direction.researchEfficiency;
                    return (
                      <div className="py-2" key={direction.direction}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium">{formatStatus(direction.direction)}</span>
                          <StatusBadge status={direction.status} />
                        </div>
                        <p className="mt-1 break-words text-xs text-muted-foreground">{outcome}</p>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {efficiency
                            ? `${efficiency.providerRequestTotal} provider · ${efficiency.runnerCommandTotal} runner · ${efficiency.scenarioCount} scenarios · ${efficiency.elapsedMs}ms · ${formatStatus(efficiency.authorityStatus)}`
                            : "Research efficiency not recorded"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">Completed {formatTimestamp(tick.completedAt)}</p>
            </div>
          ))}
          {view.history.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No completed CandidateArena ticks.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function boundedResearchSessions(
  sessions: ResearchSessionViewModel[],
  selectedId?: string
): ResearchSessionViewModel[] {
  if (sessions.length <= OPERATOR_RESEARCH_SESSION_RENDER_LIMIT) {
    return sessions;
  }

  const visible = sessions.slice(0, OPERATOR_RESEARCH_SESSION_RENDER_LIMIT);
  if (!selectedId || visible.some((session) => session.id === selectedId)) {
    return visible;
  }

  const selected = sessions.find((session) => session.id === selectedId);
  return selected
    ? [...visible.slice(0, OPERATOR_RESEARCH_SESSION_RENDER_LIMIT - 1), selected]
    : visible;
}

function researchSessionDegradationSummary(
  session: ResearchSessionViewModel
): string | undefined {
  if (session.degradedReasons.length === 0) return undefined;

  const uniqueReasons = [...new Set(session.degradedReasons)];
  const labels = uniqueReasons
    .slice(0, RESEARCH_DEGRADED_REASON_RENDER_LIMIT)
    .map((reason) => RESEARCH_DEGRADED_REASON_LABELS[reason] ?? "Unknown degradation reason");
  const omittedCount = uniqueReasons.length - labels.length;
  return omittedCount > 0
    ? `${labels.join(" · ")} · +${omittedCount} more`
    : labels.join(" · ");
}

function researchSessionResult(session: ResearchSessionViewModel): string {
  if (session.admittedCandidateId) return session.admittedCandidateId;
  if (session.status === "finished_without_submission") return "No submission";
  return formatStatus(session.status);
}

function researchSessionHeading(session: ResearchSessionViewModel): string {
  if (session.triggerAvailability === "available" && session.goal.trim()) return session.goal;
  if (session.methodologyAvailability === "available" && session.hypothesis.trim()) return session.hypothesis;
  return "Research session";
}

function researchSessionTriggerSummary(session: ResearchSessionViewModel): string {
  if (session.triggerAvailability !== "available") return "Trigger unavailable";
  return `Trigger: ${formatStatus(session.triggerKind)} · ${session.goal || "Goal unavailable"}`;
}

function researchSessionMethodologySummary(session: ResearchSessionViewModel): string {
  if (session.methodologyAvailability !== "available") return "Methodology unavailable";
  return `Hypothesis: ${session.hypothesis || "Unavailable"} · Method: ${session.method || "Unavailable"}`;
}

function researchHistoryOutcome(direction: ResearchHistoryViewModel["directions"][number]): string {
  if (direction.candidateId) return direction.candidateId;
  if (direction.error !== undefined) return "Research direction failed; failure detail is unavailable.";
  return direction.finding ?? "No output recorded";
}

function ResearchDetail({
  detailHeadingRef,
  session,
  detail,
  detailLoading,
  detailError,
  selectedId,
  onBack
}: {
  detailHeadingRef: RefObject<HTMLHeadingElement | null>;
  session?: ResearchSessionViewModel;
  detail?: ResearchSessionDetailReadModel;
  detailLoading: boolean;
  detailError?: string;
  selectedId?: string;
  onBack: () => void;
}) {
  if (!selectedId) {
    return (
      <Empty className="max-lg:hidden">
        <EmptyHeader>
          <EmptyMedia variant="icon"><FlaskConical aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>Select a Research session</EmptyTitle>
          <EmptyDescription>Inspect its trigger, hypothesis, method, bounded progress, and candidate handoff.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!session && detailLoading) {
    return (
      <div className="min-w-0 p-4">
        <Button className="mb-4 min-h-10 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <h3 ref={detailHeadingRef} className="sr-only" tabIndex={-1}>Loading Research session</h3>
        <Alert variant="info">
          <AlertTitle>Loading persisted Research evidence</AlertTitle>
          <AlertDescription>
            The URL identity remains stable while its exact session detail is read independently of the bounded summary list.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-w-0 p-4">
        <Button className="mb-4 min-h-10 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <h3 ref={detailHeadingRef} className="sr-only" tabIndex={-1}>Unavailable Research session</h3>
        <Alert variant="warning">
          <AlertTitle>Selected session is not in the current projection</AlertTitle>
          <AlertDescription>The URL identity remains stable, but current Research evidence no longer contains it.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const exactDetail = detail?.research_work_item_id === selectedId ? detail : undefined;

  return (
    <section className="min-w-0">
      <div className="border-b px-4 py-4">
        <Button className="mb-2 -ml-2 min-h-10 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h3
            ref={detailHeadingRef}
            className="min-w-0 break-words text-base font-semibold outline-none [overflow-wrap:anywhere] focus-visible:ring-2 focus-visible:ring-ring"
            tabIndex={-1}
          >
            {researchSessionHeading(session)}
          </h3>
          <StatusBadge status={session.status} />
          {session.triggerAvailability === "available"
            ? <StatusBadge status={session.triggerKind} />
            : <StatusBadge status="unavailable" label="Trigger unavailable" />}
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{session.id}</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <ResearchField label="Trigger" value={researchSessionTriggerSummary(session)} />
          <ResearchField label="Methodology" value={researchSessionMethodologySummary(session)} />
        </dl>
      </div>
      {detailError ? (
        <div className="p-4 pb-0">
          <Alert variant="warning">
            <AlertTitle>{exactDetail ? "Research detail refresh degraded" : "Research detail unavailable"}</AlertTitle>
            <AlertDescription>
              {exactDetail
                ? `The last safe exact detail remains visible. Latest refresh failed: ${detailError}`
                : `Exact persisted detail could not be loaded: ${detailError}`}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {detailLoading && !exactDetail ? (
        <div className="p-4">
          <Alert variant="info">
            <AlertTitle>Loading persisted Research evidence</AlertTitle>
            <AlertDescription>The summary remains visible while the exact selected detail is read.</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {exactDetail ? <ResearchSessionEvidence detail={exactDetail} /> : !detailLoading ? (
        <div className="p-4">
          <Alert variant="info">
            <AlertTitle>Persisted detail unavailable</AlertTitle>
            <AlertDescription>
              The authoritative session summary remains visible. Submission, notebook, terminal, and lifecycle evidence is not inferred.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </section>
  );
}

function ResearchContext({ view }: { view: ResearchWorkspaceViewModel }) {
  if (!view.paperLearning && !view.generalization && view.findingClusters.length === 0) {
    return null;
  }

  return (
    <div aria-label="Research evidence context">
      {view.paperLearning ? <PaperLearningReadback learning={view.paperLearning} /> : null}
      {view.generalization ? <ResearchGeneralizationReadback generalization={view.generalization} /> : null}
      {view.findingClusters.length > 0 ? <FindingClustersReadback view={view} /> : null}
    </div>
  );
}

function PaperLearningReadback({
  learning
}: {
  learning: NonNullable<ResearchWorkspaceViewModel["paperLearning"]>;
}) {
  return (
    <section className="border-b px-4 py-4" aria-labelledby="paper-learning-title">
      <div className="flex flex-wrap items-center gap-2">
        <BookOpenCheck className="size-4 text-brand" aria-hidden="true" />
        <h3 id="paper-learning-title" className="text-sm font-semibold">Paper evidence learning</h3>
        <StatusBadge status={learning.authority_status} />
      </div>
      <p className="mt-2 max-w-4xl text-sm">{learning.summary}</p>
      <ResearchFields fields={[
        { label: "Paper rank", value: learning.rank !== undefined ? `#${learning.rank}` : "Unranked" },
        { label: "Net revenue", value: formatMoney(learning.net_revenue_usdt) },
        { label: "Net return", value: formatPercent(learning.net_return_pct) },
        { label: "Qualification", value: formatStatus(learning.qualification_status ?? "unavailable") },
        { label: "Observations", value: String(learning.observation_count) },
        { label: "Top blocker", value: formatStatus(learning.top_blocker ?? "none") },
        { label: "Latest failure", value: learning.latest_failure_summary ?? formatStatus(learning.latest_failure_kind ?? "none") },
        { label: "Next research focus", value: learning.next_research_focus }
      ]} />
      {learning.qualification_reasons.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Qualification blockers</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {learning.qualification_reasons.map((reason) => (
              <li key={reason}>{formatStatus(reason)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ResearchGeneralizationReadback({
  generalization
}: {
  generalization: NonNullable<ResearchWorkspaceViewModel["generalization"]>;
}) {
  const active = generalization.active_protocol;
  const latest = generalization.latest_outcome;
  const latestDecision = generalization.latest_policy_decision;
  const effectiveDecision = generalization.effective_policy_decision;

  return (
    <section className="border-b px-4 py-4" aria-labelledby="research-generalization-title">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-4 text-brand" aria-hidden="true" />
        <h3 id="research-generalization-title" className="text-sm font-semibold">Research generalization</h3>
        <StatusBadge status={generalization.status} />
        <StatusBadge status={generalization.authority_status} />
      </div>
      <ResearchFields fields={[
        { label: "Lifecycle", value: formatStatus(generalization.status) },
        { label: "Protocols", value: String(generalization.protocol_count) },
        { label: "Outcomes", value: String(generalization.outcome_count) },
        {
          label: "Effective policy",
          value: effectiveDecision?.effective_default_mode
            ? formatStatus(effectiveDecision.effective_default_mode)
            : "Unavailable"
        }
      ]} />

      {active ? (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Active prospective protocol</h4>
          <ResearchFields fields={[
            { label: "Protocol", value: active.research_generalization_protocol_id, mono: true },
            { label: "Committed", value: formatTimestamp(active.committed_at) },
            { label: "Collection deadline", value: formatTimestamp(active.collection_deadline_at) },
            { label: "Assigned", value: `${active.assigned_study_count} / ${active.planned_study_count}` },
            { label: "Terminal", value: `${active.terminal_study_count} / ${active.planned_study_count}` },
            { label: "Next action", value: formatStatus(active.next_action) },
            { label: "Authority", value: formatStatus(active.authority_status) }
          ]} />
          {active.condition_blocks.length > 0 ? (
            <div className="mt-4 divide-y border-y">
              {active.condition_blocks.map((block) => (
                <div className="grid gap-1 py-2 text-sm sm:grid-cols-[minmax(8rem,0.6fr)_1fr]" key={block.condition_block}>
                  <span className="font-medium">{formatStatus(block.condition_block)}</span>
                  <span className="text-muted-foreground">
                    {block.assigned_study_count} / {block.planned_study_count} assigned; {block.terminal_study_count} / {block.planned_study_count} terminal
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {latest ? (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Latest prospective outcome</h4>
          <ResearchFields fields={[
            { label: "Inference", value: formatStatus(latest.inference_status) },
            { label: "Adjudicated", value: formatTimestamp(latest.adjudicated_at) },
            { label: "Completed studies", value: `${latest.completed_study_count} / ${latest.planned_study_count}` },
            { label: "Missing / ineligible", value: `${latest.missing_study_count} / ${latest.ineligible_study_count}` },
            { label: "Non-tied / tied", value: `${latest.non_tied_study_count} / ${latest.tied_study_count}` },
            { label: "Exact sign-test p", value: String(latest.exact_sign_test_p_value) },
            {
              label: "Equal-weight mean",
              value: latest.equal_weight_mean_rate_difference === null
                ? "Unavailable"
                : String(latest.equal_weight_mean_rate_difference)
            },
            { label: "Distinct baselines", value: String(latest.distinct_baseline_count) },
            {
              label: "Harmful blocks",
              value: latest.harmful_condition_blocks.length > 0
                ? latest.harmful_condition_blocks.map(formatStatus).join(", ")
                : "None"
            },
            { label: "Decision eligibility", value: formatStatus(latest.policy_decision_eligibility) },
            { label: "Next action", value: formatStatus(latest.next_action) },
            {
              label: "Authority",
              value: `policy replacement ${latest.policy_replacement_authority}; promotion ${latest.promotion_authority}; order ${latest.order_submission_authority}; live ${latest.live_exchange_authority}`
            }
          ]} />
        </div>
      ) : null}

      {latestDecision ? (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Latest research-policy decision</h4>
          <ResearchFields fields={[
            { label: "Decision", value: latestDecision.research_generalization_policy_decision_id, mono: true },
            { label: "Protocol", value: latestDecision.research_generalization_protocol_id, mono: true },
            { label: "Outcome", value: latestDecision.research_generalization_outcome_id, mono: true },
            { label: "Status", value: formatStatus(latestDecision.decision_status) },
            { label: "Reason", value: formatStatus(latestDecision.decision_reason) },
            { label: "Effective mode", value: formatStatus(latestDecision.effective_default_mode ?? "none") },
            { label: "Decided", value: formatTimestamp(latestDecision.decided_at) },
            { label: "Authority", value: formatStatus(latestDecision.authority_status) }
          ]} />
        </div>
      ) : null}

      {effectiveDecision ? (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-semibold">Effective policy application</h4>
          <ResearchFields fields={[
            { label: "Decision", value: effectiveDecision.research_generalization_policy_decision_id, mono: true },
            { label: "Mode", value: formatStatus(effectiveDecision.effective_default_mode) },
            { label: "Application", value: formatStatus(effectiveDecision.application.application_status) },
            { label: "Allocations", value: String(effectiveDecision.application.allocation_count) },
            { label: "Completed ticks", value: String(effectiveDecision.application.completed_tick_count) },
            {
              label: "Latest allocation",
              value: formatCompactId(effectiveDecision.application.latest_allocation?.candidate_arena_research_allocation_id),
              mono: true
            },
            { label: "Authority", value: formatStatus(effectiveDecision.authority_status) }
          ]} />
        </div>
      ) : null}
    </section>
  );
}

function FindingClustersReadback({ view }: { view: ResearchWorkspaceViewModel }) {
  const visibleClusters = view.findingClusters.slice(0, 6);
  return (
    <section className="border-b px-4 py-4" aria-labelledby="finding-clusters-title">
      <div className="flex flex-wrap items-center gap-2">
        <Layers3 className="size-4 text-brand" aria-hidden="true" />
        <h3 id="finding-clusters-title" className="text-sm font-semibold">Research learning clusters</h3>
        <StatusBadge status="not_promotion_authority" />
      </div>
      <div className="mt-3 divide-y border-y">
        {visibleClusters.map((cluster) => (
          <article
            className="grid gap-3 py-3 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]"
            key={`${cluster.direction_kind}:${cluster.top_blocker ?? "none"}:${cluster.market_regime}:${cluster.protocol_failure_kind ?? "none"}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">{formatStatus(cluster.direction_kind)} / {formatStatus(cluster.market_regime)}</h4>
                <StatusBadge status={cluster.blocker_group_kind ?? "no_blocker_group"} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {cluster.candidate_count} {cluster.candidate_count === 1 ? "candidate" : "candidates"}
              </p>
            </div>
            <ResearchFields fields={[
              { label: "Top blocker", value: formatStatus(cluster.top_blocker ?? "none") },
              { label: "Protocol failure", value: formatStatus(cluster.protocol_failure_kind ?? "none") },
              { label: "Latest finding", value: cluster.latest_finding ?? "None" },
              { label: "Next research focus", value: cluster.next_research_focus }
            ]} compact />
          </article>
        ))}
      </div>
      {visibleClusters.length < view.findingClusters.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {visibleClusters.length} of {view.findingClusters.length} clusters
        </p>
      ) : null}
    </section>
  );
}

function ResearchFields({
  fields,
  compact = false
}: {
  fields: Array<{ label: string; value: string; mono?: boolean }>;
  compact?: boolean;
}) {
  return (
    <dl className={cn(
      "mt-3 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4",
      compact && "mt-0 xl:grid-cols-2"
    )}>
      {fields.map((field) => (
        <ResearchField key={field.label} label={field.label} value={field.value} mono={field.mono} />
      ))}
    </dl>
  );
}

function ResearchField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
