import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OuroborosCommandRequest } from "@ouroboros/domain";
import {
  ArrowLeft,
  Beaker,
  BrainCircuit,
  FileClock,
  FlaskConical,
  Pause,
  Play,
  Search,
  Zap
} from "lucide-react";
import type {
  ResearchSessionViewModel,
  ResearchWorkspaceViewModel
} from "@/app/operator-view-model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandConfirmation } from "@/components/command-confirmation";
import { OperatorMetricStrip } from "@/components/operator-metrics";
import { StatusBadge } from "@/components/operator-status";
import { focusNarrowDetail } from "@/lib/operator-focus";
import { formatCompactId, formatStatus, formatTimestamp } from "@/lib/operator-format";
import { cn } from "@/lib/utils";

export function ResearchScreen({
  view,
  selectedId,
  commandRunning,
  onSelect,
  onCommand
}: {
  view: ResearchWorkspaceViewModel;
  selectedId?: string;
  commandRunning: boolean;
  onSelect: (id?: string) => void;
  onCommand: (label: string, request: OuroborosCommandRequest) => void;
}) {
  const detailFocusRef = useRef<HTMLButtonElement>(null);
  const selected = selectedId
    ? view.sessions.find((session) => session.id === selectedId)
    : undefined;
  const activeSessions = view.sessions.filter((session) => [
    "allocating",
    "running",
    "awaiting_selection",
    "sealed_admission",
    "recovering"
  ].includes(session.status));

  useEffect(() => {
    if (selectedId) {
      focusNarrowDetail(detailFocusRef.current);
    }
  }, [selectedId]);

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
              No actual `research_operations` sessions or completed tick history is present. This is not a healthy empty session queue.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <OperatorMetricStrip metrics={[
        { label: "Actual sessions", value: String(view.sessions.length), detail: `${activeSessions.length} active` },
        {
          label: "Capacity",
          value: view.capacity ? `${view.capacity.active_session_count} / ${view.capacity.max_concurrent_sessions}` : "Unavailable",
          detail: view.capacity ? `${view.capacity.queued_session_count} queued` : "Projection required"
        },
        { label: "Completed ticks", value: String(view.history.length), detail: "Historical outcomes" },
        { label: "Authority", value: "Research only", detail: "No admission self-authority" }
      ]} />

      {view.emptyState === "available_empty" && view.history.length === 0 ? (
        <Empty className="min-h-72 border-b">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FlaskConical aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No Research sessions</EmptyTitle>
            <EmptyDescription>
              The Research projection is available and currently contains no queued or historical session.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view.sessions.length > 0 || view.history.length > 0 ? (
        <div className="grid min-h-[36rem] border-b lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.6fr)]">
          <ResearchMaster
            view={view}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          <ResearchDetail
            backButtonRef={detailFocusRef}
            session={selected}
            selectedId={selectedId}
            onBack={() => onSelect(undefined)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ResearchMaster({
  view,
  selectedId,
  onSelect
}: {
  view: ResearchWorkspaceViewModel;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"sessions" | "history">(
    view.sessions.length > 0 ? "sessions" : "history"
  );
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
          ) : null}
        </div>
        <TabsContent value="sessions" className="mt-0 divide-y">
          {filtered.map((session) => (
            <button
              className={cn(
                "w-full px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selectedId === session.id && "bg-brand/8"
              )}
              key={session.id}
              onClick={() => onSelect(session.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{session.goal}</span>
                <StatusBadge status={session.status} />
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{formatStatus(session.direction)}</span>
              <span className="mt-2 block">
                <Progress
                  aria-label={`${session.completedExperimentCount} of ${session.maxExperimentCount} experiments completed`}
                  value={session.maxExperimentCount > 0
                    ? (session.completedExperimentCount / session.maxExperimentCount) * 100
                    : 0}
                />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                {session.completedExperimentCount} / {session.maxExperimentCount} experiments
              </span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No actual sessions match this filter.</p>
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
                {tick.createdCandidateCount} candidates across {tick.directionCount} directions
              </p>
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

function ResearchDetail({
  backButtonRef,
  session,
  selectedId,
  onBack
}: {
  backButtonRef: RefObject<HTMLButtonElement | null>;
  session?: ResearchSessionViewModel;
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

  if (!session) {
    return (
      <div className="p-4">
        <Button ref={backButtonRef} className="mb-4 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <Alert variant="warning">
          <AlertTitle>Selected session is not in the current projection</AlertTitle>
          <AlertDescription>The URL identity remains stable, but current Research evidence no longer contains it.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const experimentProgress = session.maxExperimentCount > 0
    ? (session.completedExperimentCount / session.maxExperimentCount) * 100
    : 0;

  return (
    <section className="min-w-0">
      <div className="border-b px-4 py-4">
        <Button ref={backButtonRef} className="mb-2 -ml-2 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">{session.goal}</h3>
          <StatusBadge status={session.status} />
          <StatusBadge status={session.triggerKind} />
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{session.id}</p>
      </div>

      <OperatorMetricStrip metrics={[
        {
          label: "Experiments",
          value: `${session.completedExperimentCount} / ${session.maxExperimentCount}`,
          detail: `${Math.round(experimentProgress)}% complete`
        },
        {
          label: "Submissions",
          value: `${session.developmentSubmissionCount} / ${session.maxDevelopmentSubmissionCount}`,
          detail: "Development only"
        },
        { label: "Evidence inputs", value: String(session.evidenceArtifactCount), detail: "Sanitized artifacts" },
        { label: "Provider", value: session.provider, detail: session.model ?? "Model unavailable" }
      ]} className="border-t-0" />

      <section className="border-b p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Experiment budget</span>
          <span className="tabular-nums">{Math.round(experimentProgress)}%</span>
        </div>
        <Progress value={experimentProgress} />
        <p className="mt-3 text-sm">{session.latestProgressSummary}</p>
        <p className="mt-1 text-xs text-muted-foreground">Last progress {formatTimestamp(session.lastProgressAt)}</p>
      </section>

      <div className="grid divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <section className="p-4">
          <h4 className="text-sm font-semibold">Methodology</h4>
          <dl className="mt-3 space-y-4 text-sm">
            <ResearchField label="Direction" value={formatStatus(session.direction)} />
            <ResearchField label="Hypothesis" value={session.hypothesis} />
            <ResearchField label="Method" value={session.method} />
          </dl>
        </section>
        <section className="p-4">
          <h4 className="text-sm font-semibold">Identity and handoff</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <ResearchField label="Allocation" value={formatCompactId(session.allocationId)} mono />
            <ResearchField label="Worker" value={formatCompactId(session.workerId)} mono />
            <ResearchField label="Worker session" value={formatCompactId(session.workerSessionId)} mono />
            <ResearchField label="Commitment" value={formatCompactId(session.commitmentId)} mono />
            <ResearchField label="Started" value={formatTimestamp(session.startedAt)} />
            <ResearchField label="Completed" value={formatTimestamp(session.completedAt)} />
            <ResearchField label="Admitted candidate" value={formatCompactId(session.admittedCandidateId)} mono />
          </dl>
        </section>
      </div>

      <div className="border-t p-4">
        <Alert variant="info">
          <BrainCircuit aria-hidden="true" />
          <AlertTitle>Submission artifacts and logs unavailable</AlertTitle>
          <AlertDescription>
            The current Operator response contains a session summary only. Development submissions, notebook continuity, admission evidence, and sanitized logs are not fabricated by this screen.
          </AlertDescription>
        </Alert>
      </div>
    </section>
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
