import type { ArenaSystemDetailViewModel } from "@/app/operator-view-model";
import { StatusBadge } from "@/components/operator-status";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  formatCompactId,
  formatStatus,
  formatTimestamp
} from "@/lib/operator-format";

export function ArenaSystemEvidence({
  detail
}: {
  detail: ArenaSystemDetailViewModel;
}) {
  const account = detail.paperAccountSnapshot;
  const position = account?.position;

  return (
    <div className="border-t">
      <section className="p-4" aria-labelledby="arena-isolation-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 id="arena-isolation-title" className="text-sm font-semibold">
              Isolation and SystemCode
            </h4>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {detail.manifest.summary}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              status={detail.isolation.sandboxStatus}
              label={`Sandbox ${formatStatus(detail.isolation.sandboxStatus).toLowerCase()}`}
            />
            <StatusBadge
              status={detail.isolation.networkPolicyStatus}
              label={`Network ${formatStatus(detail.isolation.networkPolicyStatus).toLowerCase()}`}
            />
            <StatusBadge
              status={detail.isolation.egressAttestationStatus}
              label={`Egress ${formatStatus(detail.isolation.egressAttestationStatus).toLowerCase()}`}
            />
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <EvidenceField label="Isolation" value={formatCompactId(detail.isolation.isolationId)} mono />
          <EvidenceField label="Workspace identity" value={detail.isolation.workspaceIdentity ?? "Unavailable"} mono />
          <EvidenceField label="Runtime" value={detail.manifest.declaredRuntime ?? "Unavailable"} />
          <EvidenceField label="Declared outputs" value={formatList(detail.manifest.declaredOutputs)} />
          <EvidenceField label="Allowed stages" value={formatList(detail.manifest.allowedStages)} />
          <EvidenceField label="Permissions" value={formatList(detail.manifest.declaredPermissions)} />
          <EvidenceField label="Forbidden contents" value={formatList(detail.manifest.forbiddenContents)} />
          <EvidenceField label="Admission decision" value={formatCompactId(detail.admissionDecisionId)} mono />
          <EvidenceField label="Handoff conformance" value={formatCompactId(detail.handoffConformanceId)} mono />
        </dl>
      </section>

      <section className="border-t p-4" aria-labelledby="arena-account-title">
        <h4 id="arena-account-title" className="text-sm font-semibold">
          Paper account and execution
        </h4>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <EvidenceField label="Wallet" value={formatUsdt(account?.wallet_balance_usdt)} />
          <EvidenceField label="Equity" value={formatUsdt(account?.equity_usdt)} />
          <EvidenceField label="Realized P&amp;L" value={formatUsdt(account?.realized_pnl_usdt)} />
          <EvidenceField label="Unrealized P&amp;L" value={formatUsdt(account?.unrealized_pnl_usdt)} />
          <EvidenceField label="Position" value={position ? formatStatus(position.side) : "Unavailable"} />
          <EvidenceField label="Position quantity" value={position?.quantity ?? "Unavailable"} />
          <EvidenceField label="Mark price" value={position?.mark_price ?? "Unavailable"} />
          <EvidenceField label="Open orders" value={String(account?.open_order_count ?? detail.openOrders.length)} />
          <EvidenceField label="Market snapshot" value={detail.latestMarketSnapshot
            ? `${detail.latestMarketSnapshot.symbol} ${detail.latestMarketSnapshot.price}`
            : "Unavailable"} />
          <EvidenceField label="Market observed" value={formatTimestamp(detail.latestMarketSnapshot?.observed_at)} />
          <EvidenceField label="Latest decision" value={detail.latestDecision
            ? formatStatus(detail.latestDecision.decision_kind)
            : "Unavailable"} />
          <EvidenceField label="Decision reason" value={detail.latestDecision?.reason ?? "Unavailable"} />
        </dl>

        <div className="mt-5">
          <h5 className="text-xs font-medium text-muted-foreground">Open orders</h5>
          {detail.openOrders.length > 0 ? (
            <Table className="mt-2 table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Side</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.openOrders.map((order) => (
                  <TableRow key={order.order_id}>
                    <TableCell>{formatStatus(order.side)}</TableCell>
                    <TableCell>{formatStatus(order.order_type)}</TableCell>
                    <TableCell className="font-mono text-xs">{order.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{order.remaining_quantity}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell>{formatTimestamp(order.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No open orders in the latest paper snapshot.</p>
          )}
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <EvidenceField label="Latest fill" value={detail.latestFill
            ? formatStatus(detail.latestFill.fill_status)
            : "None observed"} />
          <EvidenceField label="Fill price" value={detail.latestFill?.fill_price ?? "Unavailable"} />
          <EvidenceField label="Fill quantity" value={detail.latestFill?.fill_quantity ?? "Unavailable"} />
          <EvidenceField label="Fill time" value={formatTimestamp(detail.latestFill?.trade_time)} />
        </dl>
      </section>

      <section className="grid border-t xl:grid-cols-2 xl:divide-x" aria-label="Arena provenance">
        <div className="p-4">
          <h4 className="text-sm font-semibold">Lineage</h4>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <EvidenceField label="Handoff" value={detail.lineage
              ? formatStatus(detail.lineage.handoff_status)
              : "Unavailable"} />
            <EvidenceField label="Source system" value={formatCompactId(detail.lineage?.source.trading_system_id)} mono />
            <EvidenceField label="Source version" value={formatCompactId(detail.lineage?.source.candidate_version_id)} mono />
            <EvidenceField label="Blocked stage" value={detail.lineage?.blocked_stage
              ? formatStatus(detail.lineage.blocked_stage)
              : "None"} />
          </dl>
        </div>
        <div className="border-t p-4 xl:border-t-0">
          <h4 className="text-sm font-semibold">Artifact references</h4>
          {detail.artifactRefs.length > 0 ? (
            <ul className="mt-3 divide-y border-y">
              {detail.artifactRefs.map((ref) => (
                <li className="grid gap-1 py-2 text-xs sm:grid-cols-[12rem_minmax(0,1fr)]" key={`${ref.record_kind}:${ref.id}`}>
                  <span className="text-muted-foreground">{formatStatus(ref.record_kind)}</span>
                  <span className="break-all font-mono">{ref.id}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No artifact references available.</p>
          )}
        </div>
      </section>

      <section className="border-t p-4" aria-labelledby="arena-trace-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="arena-trace-title" className="text-sm font-semibold">Trace events</h4>
          {detail.traceTruncated ? <StatusBadge status="truncated" label="Older events omitted" /> : null}
        </div>
        {detail.traceEvents.length > 0 ? (
          <ScrollArea className="mt-3 max-h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead className="w-44">Observed</TableHead>
                  <TableHead className="w-48">Kind</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.traceEvents.map((event) => (
                  <TableRow key={event.sequence}>
                    <TableCell className="tabular-nums">{event.sequence}</TableCell>
                    <TableCell>{formatTimestamp(event.occurredAt)}</TableCell>
                    <TableCell><StatusBadge status={event.eventKind} /></TableCell>
                    <TableCell className="min-w-64 whitespace-normal break-words">{event.summary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No typed trace events available.</p>
        )}
      </section>

      <section className="border-t p-4" aria-labelledby="arena-log-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="arena-log-title" className="text-sm font-semibold">Structured TradingSystem logs</h4>
          {detail.logsTruncated ? <StatusBadge status="truncated" label="Unsafe or older lines omitted" /> : null}
        </div>
        {detail.logEntries.length > 0 ? (
          <ScrollArea className="mt-3 max-h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead className="w-44">Captured</TableHead>
                  <TableHead className="w-24">Level</TableHead>
                  <TableHead className="w-36">Source</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.logEntries.map((entry) => (
                  <TableRow key={entry.sequence}>
                    <TableCell className="tabular-nums">{entry.sequence}</TableCell>
                    <TableCell>{formatTimestamp(entry.occurredAt)}</TableCell>
                    <TableCell><StatusBadge status={entry.level} /></TableCell>
                    <TableCell>{formatStatus(entry.source)}</TableCell>
                    <TableCell className="min-w-64 whitespace-normal break-words font-mono text-xs">{entry.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No safe structured log entries available.</p>
        )}
      </section>
    </div>
  );
}

function EvidenceField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono
        ? "mt-1 break-all font-mono text-xs"
        : "mt-1 break-words [overflow-wrap:anywhere]"}>
        {value}
      </dd>
    </div>
  );
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map(formatStatus).join(", ") : "None declared";
}

function formatUsdt(value: string | undefined): string {
  return value === undefined ? "Unavailable" : `${value} USDT`;
}
