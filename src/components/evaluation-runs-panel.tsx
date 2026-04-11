import type {
  EvaluationRunDetailState,
  EvaluationRunSummaryState,
  ExchangeAdapterState
} from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type EvaluationRunsPanelProps = {
  adapters: ExchangeAdapterState[];
  evaluationRuns: EvaluationRunSummaryState[];
  selectedEvaluationRunId: string | null;
  evaluationRunDetail: EvaluationRunDetailState | null;
  onSelectEvaluationRun: (runId: string) => void;
  onRunBacktest: () => void;
  onRunPaperEvaluation: () => void;
  onOpenWorkspaceDocument: (documentRef: string) => void;
};

export function EvaluationRunsPanel({
  adapters,
  evaluationRuns,
  selectedEvaluationRunId,
  evaluationRunDetail,
  onSelectEvaluationRun,
  onRunBacktest,
  onRunPaperEvaluation,
  onOpenWorkspaceDocument
}: EvaluationRunsPanelProps) {
  const selected =
    evaluationRuns.find((run) => run.id === selectedEvaluationRunId) ?? evaluationRuns[0] ?? null;

  return (
    <Card
      title="Evaluation Runs"
      description="Backtests and paper evaluations run through the service layer and persist raw evidence refs back into the workspace."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onRunBacktest}>
            Run Backtest
          </Button>
          <Button variant="ghost" onClick={onRunPaperEvaluation}>
            Run Paper Evaluation
          </Button>
          <div className="flex flex-wrap gap-2">
            {adapters.map((adapter) => (
              <Badge key={adapter.id} tone={adapter.supportsLive ? "positive" : "warning"}>
                {adapter.name}
              </Badge>
            ))}
          </div>
        </div>

        {evaluationRuns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-sm leading-6 text-ink-300">
            No evaluation runs yet. Backtests and paper replays will appear here once the service
            layer persists them into the workspace.
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              {evaluationRuns.map((run) => {
                const isSelected = run.id === selected?.id;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => onSelectEvaluationRun(run.id)}
                    className={[
                      "grid w-full gap-3 rounded-2xl border p-4 text-left transition",
                      "lg:grid-cols-[1fr_auto]",
                      isSelected
                        ? "border-accent-teal/40 bg-accent-teal/10 shadow-panel"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    ].join(" ")}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-ink-50">{run.headline}</p>
                        <Badge tone={run.kind === "backtest" ? "neutral" : "warning"}>
                          {run.kind}
                        </Badge>
                        <Badge tone={run.netPnl >= 0 ? "positive" : "danger"}>
                          {run.netPnl >= 0 ? "positive" : "negative"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-ink-200">{run.summary}</p>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.16em] text-ink-300">
                      <p>{run.createdAt}</p>
                      <p className="mt-2">{run.tradeCount} trades</p>
                      <p className="mt-1">{run.netPnl.toFixed(2)} net</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && evaluationRunDetail ? (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={evaluationRunDetail.kind === "backtest" ? "neutral" : "warning"}>
                    {evaluationRunDetail.kind}
                  </Badge>
                  <Badge tone={evaluationRunDetail.status === "completed" ? "positive" : "warning"}>
                    {evaluationRunDetail.status}
                  </Badge>
                  <Badge tone={evaluationRunDetail.netPnl >= 0 ? "positive" : "danger"}>
                    net {evaluationRunDetail.netPnl.toFixed(2)}
                  </Badge>
                </div>

                <p className="text-sm leading-6 text-ink-200">{evaluationRunDetail.summary}</p>

                <dl className="space-y-3 text-sm">
                  <EvaluationRow label="Run document" value={evaluationRunDetail.pathRef} onOpen={onOpenWorkspaceDocument} />
                  <EvaluationRow label="Adapter" value={evaluationRunDetail.adapterName} />
                  <EvaluationRow label="Collections" value={`${evaluationRunDetail.collectionRefs.length} refs`} />
                  <EvaluationRow label="Gross PnL" value={evaluationRunDetail.grossPnl.toFixed(2)} />
                  <EvaluationRow label="Fees" value={evaluationRunDetail.feeCost.toFixed(2)} />
                  <EvaluationRow label="Slippage" value={evaluationRunDetail.slippageCost.toFixed(2)} />
                  <EvaluationRow label="Model Cost" value={evaluationRunDetail.modelCost.toFixed(2)} />
                </dl>

                <section className="space-y-2">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Trades</h3>
                  <div className="space-y-2">
                    {evaluationRunDetail.trades.slice(0, 6).map((trade, index) => (
                      <div
                        key={`${trade.symbol}-${trade.entryTime}-${index}`}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{trade.symbol}</Badge>
                          <Badge tone={trade.side === "LONG" ? "positive" : "warning"}>{trade.side}</Badge>
                          <Badge tone={trade.netPnl >= 0 ? "positive" : "danger"}>
                            {trade.netPnl.toFixed(2)}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-ink-300">
                          {trade.entryTime} {"->"} {trade.exitTime}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-ink-300">
                          {trade.entryPrice.toFixed(2)} {"->"} {trade.exitPrice.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Evidence refs</h3>
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="justify-start overflow-hidden text-ellipsis whitespace-nowrap"
                      onClick={() => onOpenWorkspaceDocument(evaluationRunDetail.pathRef)}
                    >
                      {evaluationRunDetail.pathRef}
                    </Button>
                    {evaluationRunDetail.collectionRefs.map((collectionRef) => (
                      <Button
                        key={collectionRef}
                        variant="ghost"
                        className="justify-start overflow-hidden text-ellipsis whitespace-nowrap"
                        onClick={() => onOpenWorkspaceDocument(collectionRef)}
                      >
                        {collectionRef}
                      </Button>
                    ))}
                  </div>
                </section>

                {evaluationRunDetail.notes.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Notes</h3>
                    <div className="space-y-2">
                      {evaluationRunDetail.notes.map((note) => (
                        <div
                          key={note}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-ink-100"
                        >
                          {note}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

function EvaluationRow({
  label,
  value,
  onOpen
}: {
  label: string;
  value: string;
  onOpen?: (documentRef: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</dt>
      <dd className="mt-2 break-all text-sm leading-6 text-ink-50">
        {onOpen ? (
          <button type="button" onClick={() => onOpen(value)} className="text-left hover:text-accent-teal">
            {value}
          </button>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
