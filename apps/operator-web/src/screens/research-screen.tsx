import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OuroborosCommandRequest } from "@ouroboros/domain";
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
import { formatCompactId, formatMoney, formatPercent, formatStatus, formatTimestamp } from "@/lib/operator-format";
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

      <ResearchContext view={view} />

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
                    const outcome = direction.candidateId ?? direction.error ?? direction.finding ?? "No output recorded";
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
