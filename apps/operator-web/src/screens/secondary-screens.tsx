import type {
  OperatorReadModel,
  OuroborosCommandRequest,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import {
  Activity,
  CheckCircle2,
  Eye,
  KeyRound,
  Play,
  RefreshCw,
  ServerCog,
  Shield,
  Square,
  TerminalSquare,
  Wifi
} from "lucide-react";
import { providerControlAvailability } from "@/app/operator-provider-controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { CommandConfirmation } from "@/components/command-confirmation";
import { OperatorMetricStrip } from "@/components/operator-metrics";
import { StatusBadge } from "@/components/operator-status";
import { formatCompactId, formatMoney, formatPercent, formatStatus, formatTimestamp } from "@/lib/operator-format";

interface SecondaryScreenProps {
  operator: OperatorReadModel;
  commandRunning: boolean;
  onCommand: (label: string, request: OuroborosCommandRequest) => void;
}

export function TradingScreen({ operator, commandRunning, onCommand }: SecondaryScreenProps) {
  const review = operator.trading_review;
  const subject = tradingSubjectEvidence(operator);
  const evaluation = subject.evaluation;
  const candidateId = review.active_candidate_id ?? evaluation.candidate_id ?? operator.selected_candidate_id ?? undefined;
  const tradingRunId = evaluation.trading_run_id ?? review.paper_board_entry?.trading_run_id;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <section className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Selected paper handoff</h2>
            <StatusBadge status={review.readiness_status} />
            <StatusBadge status={evaluation.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{review.next_action}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={commandRunning || !candidateId || evaluation.runner_active}
            onClick={() => candidateId && onCommand("Start paper TradingRun", {
              command_kind: "trading_run.start",
              payload: { candidate_id: candidateId }
            })}
          >
            <Play data-icon="inline-start" aria-hidden="true" /> Start paper
          </Button>
          <Button
            disabled={commandRunning || !tradingRunId}
            variant="outline"
            onClick={() => tradingRunId && onCommand("Observe paper TradingRun", {
              command_kind: "trading_run.observe",
              payload: { trading_run_id: tradingRunId }
            })}
          >
            <Eye data-icon="inline-start" aria-hidden="true" /> Observe
          </Button>
          <CommandConfirmation
            title="Stop the selected paper TradingRun?"
            description="The paper runner stops while durable evaluation, Gateway, and Ledger evidence remains available. No live authority changes."
            confirmLabel="Stop paper run"
            destructive
            onConfirm={() => tradingRunId && onCommand("Stop paper TradingRun", {
              command_kind: "trading_run.stop",
              payload: { trading_run_id: tradingRunId }
            })}
            trigger={(
              <Button disabled={commandRunning || !tradingRunId || !evaluation.runner_active} variant="destructive">
                <Square data-icon="inline-start" aria-hidden="true" /> Stop
              </Button>
            )}
          />
        </div>
      </section>

      <div className="px-4 pb-4">
        <Alert variant="warning">
          <Shield aria-hidden="true" />
          <AlertTitle>Live trading is disabled</AlertTitle>
          <AlertDescription>
            This surface controls paper evidence and Trading review only. Private read, order submission, credentials, and live exchange authority are all false.
          </AlertDescription>
        </Alert>
      </div>

      <OperatorMetricStrip metrics={[
        {
          label: "Net revenue",
          value: formatMoney(subject.profitLoss?.net_revenue_usdt),
          tone: (subject.profitLoss?.net_revenue_usdt ?? 0) > 0 ? "positive" : (subject.profitLoss?.net_revenue_usdt ?? 0) < 0 ? "negative" : "default"
        },
        { label: "Net return", value: formatPercent(subject.profitLoss?.net_return_pct) },
        { label: "Observations", value: String(evaluation.observation_count), detail: evaluation.runner_active ? "Runner active" : "Runner inactive" },
        { label: "Ledger", value: formatStatus(subject.ledgerStatus), detail: subject.ledgerChainComplete ? "Chain complete" : "Chain incomplete" }
      ]} />

      <div className="grid divide-y border-b xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        <section className="p-4">
          <h3 className="text-sm font-semibold">Review subject</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <ReadField label="Candidate" value={formatCompactId(candidateId)} mono />
            <ReadField label="Evaluation" value={formatCompactId(evaluation.evaluation_id)} mono />
            <ReadField label="TradingRun" value={formatCompactId(tradingRunId)} mono />
            <ReadField label="Selected matches review" value={subject.selectedMatchesReview === undefined ? "Not applicable" : subject.selectedMatchesReview ? "Yes" : "No"} />
          </dl>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold">Evidence quality</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <ReadField label="Qualification" value={formatStatus(subject.qualificationStatus ?? "unavailable")} />
            <ReadField label="Verdict" value={formatStatus(subject.verdict)} />
            <ReadField label="Top blocker" value={subject.topBlocker ? formatStatus(subject.topBlocker) : "None"} />
            <ReadField label="Market source" value={formatStatus(evaluation.market_data_source)} />
          </dl>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold">Runner</h3>
          <dl className="mt-3 space-y-3 text-sm">
            <ReadField label="Status" value={formatStatus(subject.runnerStatus)} />
            <ReadField label="Last observed" value={formatTimestamp(evaluation.last_observed_at)} />
            <ReadField label="Next observation" value={formatTimestamp(evaluation.next_observation_at)} />
            <ReadField label="Latest failure" value={evaluation.latest_failure_reason ?? "None observed"} />
          </dl>
        </section>
      </div>
    </div>
  );
}

export function EvidenceScreen({ operator }: Pick<SecondaryScreenProps, "operator">) {
  const subject = tradingSubjectEvidence(operator);
  const evaluation = subject.evaluation;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <section className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Durable evidence readback</h2>
          <StatusBadge status={subject.ledgerStatus} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Evaluation, Gateway, Ledger, lineage, and command provenance.</p>
      </section>

      <OperatorMetricStrip metrics={[
        { label: "Evaluation", value: formatCompactId(evaluation.evaluation_id), detail: formatStatus(evaluation.status) },
        { label: "Ledger chain", value: subject.ledgerChainComplete ? "Complete" : "Incomplete", detail: formatStatus(subject.ledgerStatus) },
        { label: "Order requests", value: subject.latestOrderRequestId ? "Observed" : "None", detail: formatCompactId(subject.latestOrderRequestId) },
        { label: "Commands", value: String(operator.latest_commands.length), detail: "Latest durable results" }
      ]} />

      <div className="grid divide-y border-b xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        <section className="p-4">
          <h3 className="text-sm font-semibold">Provenance chain</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <ReadField label="Market data" value={formatStatus(evaluation.market_data_source)} />
            <ReadField label="Public execution" value={subject.latestPublicExecutionSource ? formatStatus(subject.latestPublicExecutionSource) : "Unavailable"} />
            <ReadField label="Latest decision" value={subject.latestDecisionKind ? formatStatus(subject.latestDecisionKind) : "No order decision"} />
            <ReadField label="Gateway outcome" value={subject.latestGatewayOutcome ?? "Unavailable"} />
            <ReadField label="Execution status" value={subject.latestExecutionStatus ?? "Unavailable"} />
            <ReadField label="Lineage" value={formatStatus(subject.lineageStatus)} />
          </dl>
        </section>
        <section className="p-4">
          <h3 className="text-sm font-semibold">Evidence authority</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <ReadField label="Evaluation authority" value="External to TradingSystem" />
            <ReadField label="Live exchange" value="Disabled" />
            <ReadField label="Private read" value="Disabled" />
            <ReadField label="Order submission" value="Disabled" />
            <ReadField label="Credentials" value="Unavailable to system" />
            <ReadField label="Next action" value={operator.trading_review.next_action} />
          </dl>
        </section>
      </div>

      <section className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <TerminalSquare className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Command outcomes</h3>
        </div>
        <div className="overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Completed</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operator.latest_commands.map((command) => (
                <TableRow key={command.command_id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatTimestamp(command.completed_at)}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{command.command_kind}</TableCell>
                  <TableCell><StatusBadge status={command.status} /></TableCell>
                  <TableCell className="min-w-56 text-sm text-muted-foreground">{command.summary ?? command.error ?? "No summary"}</TableCell>
                </TableRow>
              ))}
              {operator.latest_commands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No command outcomes recorded.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function tradingSubjectEvidence(operator: OperatorReadModel) {
  const review = operator.trading_review;
  const activeReview = Boolean(review.active_candidate_id);
  const evaluation = activeReview
    ? review.paper_trading_evaluation
    : operator.selected_paper_trading_evaluation;
  const boardEntry = activeReview
    ? review.paper_board_entry
    : operator.paper_trading_board.entries.find((entry) =>
        entry.candidate_id === evaluation.candidate_id &&
        (!evaluation.evaluation_id || entry.evaluation_id === evaluation.evaluation_id)
      );
  const packet = activeReview ? review.review_packet : undefined;
  const qualificationStatus = packet?.verdict.qualification_status ?? boardEntry?.qualification_status;
  const qualificationReasons = packet?.evidence_quality.qualification_reasons ??
    boardEntry?.qualification_reasons ??
    [];

  return {
    evaluation,
    profitLoss: packet?.performance.profit_loss ?? boardEntry?.profit_loss ?? evaluation.profit_loss,
    qualificationStatus,
    verdict: packet?.verdict.severity ?? qualificationStatus ?? "unavailable",
    topBlocker: packet?.verdict.top_blocker ??
      boardEntry?.blocker_density.top_blocker ??
      qualificationReasons[0],
    runnerStatus: packet?.runner.runner_status ??
      boardEntry?.runner_status ??
      paperEvaluationRunnerStatus(evaluation),
    ledgerStatus: packet?.ledger.evidence_status ?? paperEvaluationLedgerStatus(evaluation),
    ledgerChainComplete: packet?.ledger.ledger_chain_complete ?? evaluation.ledger_chain_complete,
    latestOrderRequestId: packet?.ledger.latest_order_request_id ?? evaluation.latest_order_request_id,
    latestGatewayOutcome: packet?.ledger.latest_gateway_outcome ?? evaluation.latest_gateway_outcome,
    latestExecutionStatus: packet?.ledger.latest_execution_status ?? evaluation.latest_execution_status,
    latestDecisionKind: packet?.ledger.latest_decision_kind ?? evaluation.latest_decision?.decision_kind,
    latestPublicExecutionSource: packet?.provenance.latest_public_execution_source ??
      boardEntry?.latest_public_execution_source ??
      evaluation.latest_public_execution_snapshot?.source_priority,
    lineageStatus: packet?.lineage.lineage_status ?? "unavailable",
    selectedMatchesReview: packet?.subject.selected_matches_trading_review
  };
}

function paperEvaluationRunnerStatus(
  evaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): NonNullable<OperatorReadModel["trading_review"]["review_packet"]["runner"]["runner_status"]> {
  if (evaluation.runner_active) {
    return "active";
  }
  return evaluation.status === "running" ? "needs_resume" : "inactive";
}

function paperEvaluationLedgerStatus(
  evaluation: OperatorReadModel["selected_paper_trading_evaluation"]
): OperatorReadModel["trading_review"]["review_packet"]["ledger"]["evidence_status"] {
  if (evaluation.ledger_chain_complete) {
    return "complete_chain";
  }
  const latestDecisionKind = evaluation.latest_decision?.decision_kind;
  if (latestDecisionKind === "hold" || latestDecisionKind === "no_action") {
    return "no_order_checkpoint";
  }
  if (
    evaluation.latest_order_request_id ||
    evaluation.latest_gateway_outcome ||
    evaluation.latest_execution_status ||
    evaluation.latest_fill
  ) {
    return "incomplete_chain";
  }
  return "not_observed";
}

export function SystemScreen({
  operator,
  gateway,
  gatewayError,
  commandRunning,
  onCommand
}: SecondaryScreenProps & {
  gateway?: TradingGatewayEnvironmentReadModel;
  gatewayError?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <section className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Runtime and provider control</h2>
          <StatusBadge status={operator.runtime_supervisor.status} />
          <StatusBadge status={gateway?.configuration_status ?? "gateway_unavailable"} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Coordination health, providers, public Gateway, and explicit authority boundaries.</p>
      </section>

      {gatewayError ? (
        <div className="px-4 pb-4">
          <Alert variant="warning">
            <Wifi aria-hidden="true" />
            <AlertTitle>Gateway environment readback unavailable</AlertTitle>
            <AlertDescription>{gatewayError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <OperatorMetricStrip metrics={[
        { label: "Supervisor", value: formatStatus(operator.runtime_supervisor.status), detail: `Checkpoint ${operator.runtime_supervisor.checkpoint_sequence}` },
        { label: "Runtime lanes", value: String(operator.runtime_supervisor.lanes.length), detail: `${operator.runtime_supervisor.lanes.filter((lane) => lane.desired).length} desired` },
        { label: "Research provider", value: operator.researcher_provider.selected_provider, detail: "Research authority only" },
        { label: "Gateway", value: gateway ? formatStatus(gateway.configuration_status) : "Unavailable", detail: gateway?.exchange_environment ?? "No readback" }
      ]} />

      <section className="border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <ServerCog className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Supervisor lanes</h3>
        </div>
        <div className="overflow-x-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lane</TableHead>
                <TableHead>Desired</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Next retry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operator.runtime_supervisor.lanes.map((lane) => (
                <TableRow key={lane.lane}>
                  <TableCell className="font-medium">{formatStatus(lane.lane)}</TableCell>
                  <TableCell>{lane.desired ? "Yes" : "No"}</TableCell>
                  <TableCell><StatusBadge status={lane.status} /></TableCell>
                  <TableCell className="tabular-nums">{lane.attempt_count}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums">{formatTimestamp(lane.next_retry_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="border-b p-4">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Managed research providers</h3>
        </div>
        <div className="divide-y border">
          {operator.agent_profiles.map((profile) => {
            const selected = operator.researcher_provider.selected_provider === profile.provider;
            const controls = providerControlAvailability(profile.status, selected);
            return (
              <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between" key={profile.profile_id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{profile.label}</span>
                    <StatusBadge status={profile.status} />
                    {selected ? (
                      <StatusBadge status="selected" label="Selected" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.version ?? profile.failure_reason ?? "Version unavailable"} · No trading authority
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={commandRunning || !controls.canSetup}
                    size="sm"
                    variant="outline"
                    onClick={() => onCommand(`Setup ${profile.label}`, {
                      command_kind: "agent_provider.setup",
                      payload: { provider: profile.provider }
                    })}
                  >
                    <ServerCog data-icon="inline-start" aria-hidden="true" /> Setup
                  </Button>
                  <Button
                    disabled={commandRunning || !controls.canProbe}
                    size="sm"
                    variant="outline"
                    onClick={() => onCommand(`Probe ${profile.label}`, {
                      command_kind: "agent_provider.probe",
                      payload: { provider: profile.provider }
                    })}
                  >
                    <RefreshCw data-icon="inline-start" aria-hidden="true" /> Probe
                  </Button>
                  <Button
                    disabled={commandRunning || !controls.canLogin}
                    size="sm"
                    variant="outline"
                    onClick={() => onCommand(`Login ${profile.label}`, {
                      command_kind: "agent_provider.login.start",
                      payload: { provider: profile.provider }
                    })}
                  >
                    <KeyRound data-icon="inline-start" aria-hidden="true" /> Login
                  </Button>
                  <Button
                    disabled={commandRunning || !controls.canSelect}
                    size="sm"
                    onClick={() => onCommand(`Select ${profile.label}`, {
                      command_kind: "researcher.provider.select",
                      payload: { provider: profile.provider }
                    })}
                  >
                    <CheckCircle2 data-icon="inline-start" aria-hidden="true" /> Select
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Gateway environment</h3>
        </div>
        {gateway ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <ReadField label="Venue" value={formatStatus(gateway.venue)} />
              <ReadField label="Instrument" value={gateway.instrument} mono />
              <ReadField label="Exchange environment" value={formatStatus(gateway.exchange_environment)} />
              <ReadField label="Public REST" value={gateway.rest_base_url ?? "Unavailable"} mono />
              <ReadField label="Credential scope" value={formatStatus(gateway.credential_scope)} />
              <ReadField label="API key configured" value={gateway.api_key_configured ? "Yes" : "No"} />
              <ReadField label="API secret configured" value={gateway.api_secret_configured ? "Yes" : "No"} />
              <ReadField label="Live exchange" value="Disabled" />
            </dl>
            {gateway.warnings.length > 0 ? (
              <>
                <Separator className="my-4" />
                <ul className="space-y-1 text-sm text-warning-foreground dark:text-warning">
                  {gateway.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No Gateway environment readback is available.</p>
        )}
      </section>
    </div>
  );
}

function ReadField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-1 break-words font-mono text-xs" : "mt-1 break-words"}>{value}</dd>
    </div>
  );
}
