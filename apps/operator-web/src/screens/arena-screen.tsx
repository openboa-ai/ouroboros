import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { OuroborosCommandRequest } from "@ouroboros/domain";
import {
  ArrowLeft,
  FileCheck2,
  Gauge,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Square,
  Trophy,
  Zap
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  isComparableArenaRevenueSystem,
  type ArenaSystemViewModel,
  type ArenaWorkspaceViewModel
} from "@/app/operator-view-model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { CommandConfirmation } from "@/components/command-confirmation";
import { OperatorMetricStrip } from "@/components/operator-metrics";
import { StatusBadge } from "@/components/operator-status";
import { focusNarrowDetail } from "@/lib/operator-focus";
import { formatCompactId, formatMoney, formatPercent, formatStatus, formatTimestamp } from "@/lib/operator-format";
import { cn } from "@/lib/utils";

const ARENA_CHART_CONFIG = {
  netRevenue: {
    label: "Net revenue",
    color: "var(--chart-1)"
  }
} satisfies ChartConfig;

const OPERATOR_LEADERBOARD_RENDER_LIMIT = 60;

export function ArenaScreen({
  view,
  selectedId,
  commandRunning,
  onSelect,
  onCommand
}: {
  view: ArenaWorkspaceViewModel;
  selectedId?: string;
  commandRunning: boolean;
  onSelect: (id?: string) => void;
  onCommand: (label: string, request: OuroborosCommandRequest) => void;
}) {
  const detailFocusRef = useRef<HTMLButtonElement>(null);
  const selected = selectedId
    ? view.systems.find((system) => system.id === selectedId)
    : undefined;
  const rankedSystems = view.systems.filter((system) => system.rank !== undefined);
  const comparableRevenueSystems = view.systems.filter(isComparableArenaRevenueSystem);
  const netRevenue = comparableRevenueSystems.reduce(
    (sum, system) => sum + system.netRevenueUsdt,
    0
  );

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
            <h2 className="text-lg font-semibold">Paper evaluation field</h2>
            <StatusBadge
              status={view.loopStatus}
              label={`Loop ${formatStatus(view.loopStatus).toLowerCase()}`}
            />
            <StatusBadge
              status={view.availability}
              label={view.availability === "compatibility"
                ? "Compatibility evidence"
                : view.availability === "unavailable"
                  ? "Projection unavailable"
                  : "Authoritative projection"}
            />
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Continuous paper TradingSystems ranked only by comparable external evidence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={commandRunning || view.loopStatus === "running"}
            onClick={() => onCommand("Start Arena", { command_kind: "arena.start" })}
          >
            <Play data-icon="inline-start" aria-hidden="true" />
            Start
          </Button>
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Run Arena tick", { command_kind: "arena.tick" })}
          >
            <Zap data-icon="inline-start" aria-hidden="true" />
            Tick
          </Button>
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Run Arena cycle", { command_kind: "arena.cycle" })}
          >
            <Gauge data-icon="inline-start" aria-hidden="true" />
            Cycle
          </Button>
          <CommandConfirmation
            title="Stop the Arena loop?"
            description="This stops new Arena loop work. Existing durable paper evidence remains available and no live authority is changed."
            confirmLabel="Stop Arena"
            destructive
            onConfirm={() => onCommand("Stop Arena", { command_kind: "arena.stop" })}
            trigger={(
              <Button disabled={commandRunning || view.loopStatus === "stopped"} variant="destructive">
                <Pause data-icon="inline-start" aria-hidden="true" />
                Stop
              </Button>
            )}
          />
        </div>
      </section>

      {view.availability === "compatibility" ? (
        <div className="px-4 pb-4">
          <Alert variant="info">
            <FileCheck2 aria-hidden="true" />
            <AlertTitle>Arena operations projection pending</AlertTitle>
            <AlertDescription>
              Rows below are actual continuous paper board evidence. Session isolation, trace, and log detail remain unavailable until the Arena runtime projection is connected.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {view.availability === "unavailable" ? (
        <div className="px-4 pb-4">
          <Alert variant="warning">
            <ShieldCheck aria-hidden="true" />
            <AlertTitle>Arena projection unavailable</AlertTitle>
            <AlertDescription>
              No `arena_operations` projection or paper board evidence is present. This is not rendered as a healthy empty Arena.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <OperatorMetricStrip metrics={[
        {
          label: "Paper systems",
          value: String(view.systems.length),
          detail: `${rankedSystems.length} ranked`
        },
        {
          label: "Active sessions",
          value: String(view.capacity?.active_session_count ?? view.systems.filter((system) => system.lifecycle === "running").length),
          detail: view.capacity ? `${view.capacity.queued_session_count} queued` : "From visible evidence"
        },
        {
          label: "Net revenue",
          value: formatMoney(comparableRevenueSystems.length > 0 ? netRevenue : undefined),
          tone: netRevenue > 0 ? "positive" : netRevenue < 0 ? "negative" : "default"
        },
        {
          label: "Authority",
          value: "Paper only",
          detail: "Live disabled"
        }
      ]} />

      {comparableRevenueSystems.length > 0 ? (
        <section className="border-b px-4 py-4" aria-labelledby="arena-performance-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 id="arena-performance-title" className="text-sm font-semibold">Comparable net revenue</h3>
              <p className="text-xs text-muted-foreground">Actual visible paper evidence, not ResearchPreflight scores</p>
            </div>
          </div>
          <ChartContainer config={ARENA_CHART_CONFIG} className="h-40 w-full">
            <BarChart
              accessibilityLayer
              data={comparableRevenueSystems
                .slice(0, 8)
                .map((system) => ({ name: system.name, netRevenue: system.netRevenueUsdt }))}
              layout="vertical"
              margin={{ left: 0, right: 16 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                dataKey="name"
                type="category"
                width={112}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}...` : value}
              />
              <ReferenceLine x={0} stroke="var(--border)" />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="netRevenue" fill="var(--color-netRevenue)" radius={2} />
            </BarChart>
          </ChartContainer>
        </section>
      ) : null}

      {view.emptyState === "available_empty" ? (
        <Empty className="min-h-72 border-b">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Trophy aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No admitted paper systems</EmptyTitle>
            <EmptyDescription>
              The Arena projection is available and currently contains no TradingSystem sessions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : view.systems.length > 0 ? (
        <div className="grid min-h-[34rem] border-b lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.65fr)]">
          <ArenaSystemList
            systems={view.systems}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          <ArenaSystemDetail
            backButtonRef={detailFocusRef}
            system={selected}
            selectedId={selectedId}
            commandRunning={commandRunning}
            onBack={() => onSelect(undefined)}
            onCommand={onCommand}
          />
        </div>
      ) : null}
    </div>
  );
}

function ArenaSystemList({
  systems,
  selectedId,
  onSelect
}: {
  systems: ArenaSystemViewModel[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState("all");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return systems.filter((system) => (
      (lifecycle === "all" || system.lifecycle === lifecycle) &&
      (!normalized || `${system.name} ${system.id} ${system.direction ?? ""}`.toLowerCase().includes(normalized))
    ));
  }, [lifecycle, query, systems]);
  const visibleSystems = useMemo(
    () => boundedArenaSystems(filtered, selectedId),
    [filtered, selectedId]
  );
  const lifecycleOptions = [...new Set(systems.map((system) => system.lifecycle))];

  return (
    <section className={cn("min-w-0 border-r", selectedId && "max-lg:hidden")} aria-label="Arena systems">
      <div className="flex gap-2 border-b p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Filter Arena systems"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter systems"
          />
        </div>
        <NativeSelect
          aria-label="Filter by lifecycle"
          value={lifecycle}
          onChange={(event) => setLifecycle(event.target.value)}
        >
          <NativeSelectOption value="all">All states</NativeSelectOption>
          {lifecycleOptions.map((option) => (
            <NativeSelectOption key={option} value={option}>{formatStatus(option)}</NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="divide-y">
        {visibleSystems.map((system) => (
          <button
            className={cn(
              "grid min-h-20 w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              selectedId === system.id && "bg-brand/8"
            )}
            key={system.id}
            onClick={() => onSelect(system.id)}
            type="button"
          >
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{system.name}</span>
                <StatusBadge status={system.lifecycle} />
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {system.direction ? formatStatus(system.direction) : formatCompactId(system.evaluationId)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                {system.observationCount} observations
              </span>
            </span>
            <span className="text-right">
              <span className={cn(
                "block text-sm font-semibold tabular-nums",
                (system.netRevenueUsdt ?? 0) > 0 && "text-success",
                (system.netRevenueUsdt ?? 0) < 0 && "text-destructive"
              )}>
                {formatMoney(system.netRevenueUsdt)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
                {system.rank ? `#${system.rank}` : formatStatus(system.rankStatus)}
                {system.qualificationStatus ? ` · ${formatStatus(system.qualificationStatus)}` : ""}
              </span>
            </span>
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No systems match this filter.</p>
        ) : null}
        {visibleSystems.length < filtered.length ? (
          <p className="px-4 py-3 text-center text-xs text-muted-foreground">
            Showing {visibleSystems.length} of {filtered.length} matching systems
          </p>
        ) : null}
      </div>
    </section>
  );
}

function boundedArenaSystems(
  systems: ArenaSystemViewModel[],
  selectedId?: string
): ArenaSystemViewModel[] {
  if (systems.length <= OPERATOR_LEADERBOARD_RENDER_LIMIT) {
    return systems;
  }

  const visible = systems.slice(0, OPERATOR_LEADERBOARD_RENDER_LIMIT);
  if (!selectedId || visible.some((system) => system.id === selectedId)) {
    return visible;
  }

  const selected = systems.find((system) => system.id === selectedId);
  return selected
    ? [...visible.slice(0, OPERATOR_LEADERBOARD_RENDER_LIMIT - 1), selected]
    : visible;
}

function ArenaSystemDetail({
  backButtonRef,
  system,
  selectedId,
  commandRunning,
  onBack,
  onCommand
}: {
  backButtonRef: RefObject<HTMLButtonElement | null>;
  system?: ArenaSystemViewModel;
  selectedId?: string;
  commandRunning: boolean;
  onBack: () => void;
  onCommand: (label: string, request: OuroborosCommandRequest) => void;
}) {
  if (!selectedId) {
    return (
      <Empty className="max-lg:hidden">
        <EmptyHeader>
          <EmptyMedia variant="icon"><Trophy aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>Select a TradingSystem</EmptyTitle>
          <EmptyDescription>Inspect exact paper performance, lifecycle, evidence identity, and available commands.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!system) {
    return (
      <div className="p-4">
        <Button ref={backButtonRef} className="mb-4 lg:hidden" variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
        </Button>
        <Alert variant="warning">
          <AlertTitle>Selected system is not in the current projection</AlertTitle>
          <AlertDescription>The URL selection is preserved, but current runtime evidence no longer contains this identity.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasPaperQuality = Boolean(
    system.evidenceWindow ||
    system.trend ||
    system.blockerDensity ||
    system.marketDataSource ||
    system.latestPublicExecutionSource ||
    system.latestFillStatus ||
    system.openOrderCount !== undefined
  );

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-3 border-b px-4 py-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Button ref={backButtonRef} className="mb-2 -ml-2 lg:hidden" variant="ghost" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" /> Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words text-base font-semibold [overflow-wrap:anywhere]">{system.name}</h3>
            <StatusBadge status={system.lifecycle} />
            <StatusBadge status={system.rankStatus} />
            {system.qualificationStatus ? <StatusBadge status={system.qualificationStatus} /> : null}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{system.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Select candidate", {
              command_kind: "candidate.select",
              payload: { candidate_id: system.id }
            })}
          >
            <ShieldCheck data-icon="inline-start" aria-hidden="true" /> Select
          </Button>
          <Button
            disabled={commandRunning}
            variant="outline"
            onClick={() => onCommand("Run paper evidence", {
              command_kind: "candidate.paper_evidence.run",
              payload: { candidate_id: system.id }
            })}
          >
            <FileCheck2 data-icon="inline-start" aria-hidden="true" /> Evidence
          </Button>
          <CommandConfirmation
            title="Promote this candidate for Trading review?"
            description="Promotion changes the selected paper review target only. It does not grant private, order-submission, or live exchange authority."
            confirmLabel="Promote for review"
            onConfirm={() => onCommand("Promote candidate", {
              command_kind: "trading_candidate.promote",
              payload: { candidate_id: system.id }
            })}
            trigger={(
              <Button
                disabled={commandRunning || system.qualificationStatus !== "qualified"}
              >
                <Trophy data-icon="inline-start" aria-hidden="true" /> Promote
              </Button>
            )}
          />
          {system.tradingRunId && (
            system.lifecycle === "running" ||
            system.lifecycle === "recovering" ||
            system.lifecycle === "waiting_resume"
          ) ? (
            <CommandConfirmation
              title="Stop this paper TradingRun?"
              description="The exact paper run will stop. Existing observations, Ledger records, and evaluation evidence remain durable."
              confirmLabel="Stop paper run"
              destructive
              onConfirm={() => onCommand("Stop paper run", {
                command_kind: "trading_run.stop",
                payload: { trading_run_id: system.tradingRunId }
              })}
              trigger={(
                <Button disabled={commandRunning} variant="destructive">
                  <Square data-icon="inline-start" aria-hidden="true" /> Stop run
                </Button>
              )}
            />
          ) : null}
        </div>
      </div>

      <OperatorMetricStrip metrics={[
        {
          label: "Net revenue",
          value: formatMoney(system.netRevenueUsdt),
          tone: (system.netRevenueUsdt ?? 0) > 0 ? "positive" : (system.netRevenueUsdt ?? 0) < 0 ? "negative" : "default"
        },
        { label: "Net return", value: formatPercent(system.netReturnPct) },
        { label: "Revenue / cost", value: `${formatMoney(system.revenueUsdt)} / ${formatMoney(system.costUsdt)}` },
        { label: "Observations", value: String(system.observationCount), detail: `${system.failedObservationCount} failed` }
      ]} className="border-t-0" />

      <div className="grid divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <section className="p-4">
          <h4 className="text-sm font-semibold">Identity and comparison</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <DetailField label="Candidate version" value={formatCompactId(system.versionId)} mono />
            <DetailField label="Evaluation" value={formatCompactId(system.evaluationId)} mono />
            <DetailField label="TradingRun" value={formatCompactId(system.tradingRunId)} mono />
            <DetailField label="Source" value={formatStatus(system.source)} />
            <DetailField label="Comparability" value={formatStatus(system.comparability)} />
            <DetailField label="Rank" value={system.rank ? `#${system.rank}` : formatStatus(system.rankStatus)} />
            <DetailField label="Qualification" value={formatStatus(system.qualificationStatus ?? "unavailable")} />
          </dl>
          {system.unrankedReasons.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Unranked reasons</p>
              <ul className="mt-2 space-y-1 text-sm">
                {system.unrankedReasons.map((reason) => <li key={reason}>{formatStatus(reason)}</li>)}
              </ul>
            </div>
          ) : null}
          {system.qualificationReasons.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Qualification blockers</p>
              <ul className="mt-2 space-y-1 text-sm">
                {system.qualificationReasons.map((reason) => <li key={reason}>{formatStatus(reason)}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
        <section className="p-4">
          <h4 className="text-sm font-semibold">Lifecycle readback</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <DetailField label="Last observation" value={formatTimestamp(system.lastObservedAt)} />
            <DetailField label="Next observation" value={formatTimestamp(system.nextObservationAt)} />
            <DetailField label="Lifecycle" value={formatStatus(system.lifecycle)} />
            <DetailField label="Latest failure" value={system.latestFailure ?? "None observed"} />
          </dl>
        </section>
      </div>

      {hasPaperQuality ? (
        <section className="border-t p-4" aria-labelledby="arena-paper-quality-title">
          <h4 id="arena-paper-quality-title" className="text-sm font-semibold">Paper evidence quality</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <DetailField
              label="Evidence window"
              value={system.evidenceWindow
                ? `${system.evidenceWindow.observation_count} observations / ${system.evidenceWindow.failed_observation_count} failed`
                : "Unavailable"}
            />
            <DetailField
              label="Elapsed"
              value={system.evidenceWindow ? `${system.evidenceWindow.elapsed_ms} ms` : "Unavailable"}
            />
            <DetailField label="First observed" value={formatTimestamp(system.evidenceWindow?.first_observed_at)} />
            <DetailField label="Last observed" value={formatTimestamp(system.evidenceWindow?.last_observed_at)} />
            <DetailField label="Trend" value={system.trend ? formatStatus(system.trend.direction) : "Unavailable"} />
            <DetailField label="Revenue delta" value={formatMoney(system.trend?.net_revenue_delta_usdt)} />
            <DetailField label="Return delta" value={formatPercent(system.trend?.net_return_delta_pct)} />
            <DetailField label="Observation delta" value={formatSignedCount(system.trend?.observation_count_delta)} />
            <DetailField
              label="Blockers"
              value={system.blockerDensity ? `${system.blockerDensity.blocker_count} blockers` : "Unavailable"}
            />
            <DetailField
              label="Blocker density"
              value={formatRatioPercent(system.blockerDensity?.blocker_density)}
            />
            <DetailField
              label="Failed observation ratio"
              value={formatRatioPercent(system.blockerDensity?.failed_observation_ratio)}
            />
            <DetailField
              label="Top blocker"
              value={system.blockerDensity?.top_blocker
                ? formatStatus(system.blockerDensity.top_blocker)
                : "None"}
            />
            <DetailField
              label="Market source"
              value={system.marketDataSource ? formatStatus(system.marketDataSource) : "Unavailable"}
            />
            <DetailField
              label="Public execution"
              value={system.latestPublicExecutionSource
                ? formatStatus(system.latestPublicExecutionSource)
                : "Unavailable"}
            />
            <DetailField
              label="Latest fill"
              value={system.latestFillStatus ? formatStatus(system.latestFillStatus) : "None"}
            />
            <DetailField
              label="Open orders"
              value={system.openOrderCount === undefined
                ? "Unavailable"
                : `${system.openOrderCount} open ${system.openOrderCount === 1 ? "order" : "orders"}`}
            />
            <DetailField
              label="Signal authority"
              value={system.blockerDensity?.authority_status || system.trend?.authority_status
                ? formatStatus(system.blockerDensity?.authority_status ?? system.trend!.authority_status)
                : "Unavailable"}
            />
          </dl>
        </section>
      ) : null}

      <div className="border-t p-4">
        <Alert variant="info">
          <FileCheck2 aria-hidden="true" />
          <AlertTitle>Trace, logs, and sandbox detail unavailable</AlertTitle>
          <AlertDescription>
            The current Operator response contains an honest summary only. No trace event, log entry, isolation state, or artifact identity is synthesized by the UI.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function formatRatioPercent(value: number | undefined): string {
  return formatPercent(value === undefined ? undefined : value * 100);
}

function formatSignedCount(value: number | undefined): string {
  if (value === undefined) {
    return "Unavailable";
  }
  return value > 0 ? `+${value}` : String(value);
}
