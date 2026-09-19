import type { InvestmentViewData, InvestmentObservation } from "./model";
import "./portfolio.css";
import { Observation, StateNotice } from "@/data/observation-presenters";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  FileText,
  MessageCircle,
  Table2,
} from "lucide-react";
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from "recharts";
import { Button } from "@/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/primitives/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";
import { ChartContainer, ChartTooltip } from "@/ui/primitives/chart";
import { Progress } from "@/ui/primitives/progress";
import {
  Amount,
  EmptyState,
  Member,
  SectionHeading,
  Status,
} from "@/ui/components/patterns";
import type { ViewProps } from "@/app/contracts";
import type { Period } from "./model";

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
// UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-01
// Data is an explicit local calibration fixture; screen reads never request a model or a trade.
export function PortfolioScreen({
  open: openDetail,
  discuss,
  scenario,
  model,
}: ViewProps & { model: InvestmentViewData }) {
  const [period, setPeriod] = useState<Period>("week");
  const open: ViewProps["open"] = (target) => openDetail({ period, ...target });
  const [metric, setMetric] = useState("pnl");
  const [tab, setTab] = useState("positions");
  const [dataVisible, setDataVisible] = useState(false);
  const unavailable = scenario === "restricted" || scenario === "empty";
  const periodLabel = model.periods[period].label;
  const data = model.series[period];
  const accountTime = model.observedAt;
  return (
    <div className="portfolio-screen">
      <StateNotice
        scenario={scenario}
        openConnections={() =>
          open({ kind: scenario === "uncertain" ? "order" : "connections" })
        }
      />
      <div className="portfolio-scope">
        <div className="scope-identity">
          <span className="type-control">{model.account}</span>
          <span className="type-meta muted">{model.connection}</span>
          <span className="type-meta muted">{model.unit}</span>
        </div>
        {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-03 — period affects history; current snapshots remain current. */}
        <Select
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          items={[
            { value: "week", label: model.periods.week.label },
            { value: "day", label: model.periods.day.label },
          ]}
        >
          <SelectTrigger aria-label="Reporting period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{model.periods.week.label}</SelectItem>
            <SelectItem value="day">{model.periods.day.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="portfolio-layout">
        <div className="capital-region">
          <div className="capital-summary">
            {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-04 — amount opens its observed composition. */}
            <button
              className="metric-button"
              onClick={() => open({ kind: "account", period })}
              aria-label="View account equity breakdown"
            >
              <span className="metric-label type-meta muted">
                Account equity <ChevronRight size={14} />
              </span>
              <Amount
                unit={model.unit}
                value={unavailable ? "—" : model.equity}
                role="amount"
              />
              <span className="type-meta muted">
                {unavailable
                  ? scenario === "empty"
                    ? "Not observed"
                    : "Access restricted"
                  : `${scenario === "delayed" ? "Last observed" : "Current"} · ${accountTime}`}
              </span>
            </button>
            {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-05 — period result is distinct from current unrealized value. */}
            <button
              className="metric-button"
              onClick={() => open({ kind: "pnl", period })}
              aria-label="View trading P&L breakdown"
            >
              <span className="metric-label type-meta muted">
                Trading P&L <span>{period === "week" ? "7D" : "1D"}</span>
                <ChevronRight size={14} />
              </span>
              <Amount
                unit={model.unit}
                value={unavailable ? "—" : model.periods[period].pnl}
                role="amount-secondary"
                positive={!unavailable}
              />
              <span className="type-meta muted">
                {unavailable
                  ? "Period result unavailable"
                  : "After trading fees & funding"}
              </span>
            </button>
          </div>
          <div className="capital-context">
            <button
              className="inline-link"
              onClick={() => open({ kind: "transaction", period })}
            >
              <ArrowDownLeft size={14} />
              <span className="type-data">
                {unavailable ? "—" : model.periods[period].deposit}{" "}
                <span className="type-meta muted">USDT net deposits</span>
              </span>
              <ChevronRight size={12} />
            </button>
            <button
              className="inline-link type-meta muted"
              onClick={() => open({ kind: "costs", period })}
            >
              Operating costs excluded
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
        {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-09 — known exposure and remaining orders take precedence over narrative. */}
        <aside className="exposure-region">
          <SectionHeading
            title={
              scenario === "delayed"
                ? "Last observed exposure"
                : "Current exposure"
            }
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="View position details"
                onClick={() => open({ kind: "position" })}
              >
                <ChevronRight />
              </Button>
            }
          />
          {unavailable ? (
            <EmptyState
              title={
                scenario === "empty"
                  ? "No position observed"
                  : "Position unavailable"
              }
              detail={
                scenario === "empty"
                  ? "Connect an account to observe positions."
                  : "Account access is restricted."
              }
            />
          ) : (
            <>
              <div className="exposure-identity">
                <span className="type-control">{model.position.contract}</span>
                <Status>{model.position.side}</Status>
                <span className="type-meta muted">
                  {model.position.quantity}
                </span>
              </div>
              <button
                className="notional-button"
                onClick={() => open({ kind: "position" })}
              >
                <span className="type-meta muted">Notional value</span>
                <Amount
                  unit={model.unit}
                  value={model.position.notional}
                  role="amount-secondary"
                />
              </button>
              <div className="exposure-secondary">
                <div>
                  <span className="type-meta muted">Position margin</span>
                  <Amount unit={model.unit} value={model.position.margin} />
                </div>
                <div>
                  <span className="type-meta muted">Unrealized P&L</span>
                  <Amount
                    unit={model.unit}
                    value={model.position.pnl}
                    positive
                  />
                </div>
              </div>
              <button
                className="order-preview"
                onClick={() => open({ kind: "order" })}
                aria-label="View partially filled buy order"
              >
                <span className="section-heading">
                  <span className="type-control">Open buy order</span>
                  <ChevronRight size={14} />
                </span>
                <span className="order-remaining">
                  <span className="type-meta muted">Remaining</span>
                  <span className="type-control tabular-nums">
                    {scenario === "uncertain"
                      ? "Unconfirmed"
                      : model.order.remaining}
                  </span>
                </span>
                <Progress
                  value={model.order.fillProgress}
                  aria-label={`Buy order filled ${model.order.filledTotal}`}
                />
                <span className="order-footer type-meta muted">
                  <span>
                    {scenario === "uncertain"
                      ? "Cancellation unconfirmed"
                      : "Partially filled"}
                  </span>
                  <span>{model.order.filledTotal}</span>
                </span>
              </button>
            </>
          )}
        </aside>
        <section className="chart-region" aria-label="Account performance">
          <SectionHeading
            title={
              metric === "pnl"
                ? "Trading performance"
                : "Account equity history"
            }
            note={
              metric === "pnl"
                ? "Trading P&L · transfers excluded"
                : "Account value · includes transfers"
            }
            action={
              <Tabs value={metric} onValueChange={setMetric}>
                <TabsList aria-label="Chart metric">
                  <TabsTrigger value="pnl">P&L</TabsTrigger>
                  <TabsTrigger value="equity">Equity</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          {unavailable ? (
            <EmptyState
              title="No chart data"
              detail={
                scenario === "restricted"
                  ? "The account history is not accessible."
                  : "Historical observations will appear after connection."
              }
            />
          ) : (
            <>
              <ChartContainer
                className="performance-chart"
                config={{
                  pnl: {
                    label: "Trading P&L",
                    color: "var(--portfolio-series)",
                  },
                  equity: {
                    label: "Account equity",
                    color: "var(--portfolio-series)",
                  },
                }}
              >
                <AreaChart
                  accessibilityLayer
                  data={data}
                  margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="portfolio-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--portfolio-series)"
                        stopOpacity={0.13}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--portfolio-series)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="index"
                    type="number"
                    domain={[0, data.length - 1]}
                    ticks={
                      period === "week"
                        ? [0, 4, 8, 12, 16, 20, 27]
                        : [0, 3, 6, 9, 11]
                    }
                    interval={0}
                    padding={{ left: 20, right: 16 }}
                    tickFormatter={(i) => data[i]?.label ?? ""}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    width={45}
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    domain={
                      metric === "pnl"
                        ? period === "week"
                          ? [0, 4000]
                          : [0, 800]
                        : period === "week"
                          ? [100000, 115000]
                          : [112800, 114000]
                    }
                    ticks={
                      metric === "pnl"
                        ? period === "week"
                          ? [0, 1000, 2000, 3000, 4000]
                          : [0, 200, 400, 600, 800]
                        : period === "week"
                          ? [100000, 105000, 110000, 115000]
                          : [112800, 113200, 113600, 114000]
                    }
                    tickFormatter={(v) =>
                      v >= 1000 ? `${v / 1000}k` : String(v)
                    }
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      const point = payload?.[0]?.payload as
                        InvestmentObservation | undefined;
                      return active && point ? (
                        <div className="chart-tooltip">
                          <span className="type-meta muted">{point.time}</span>
                          <span className="type-control">
                            {metric === "pnl"
                              ? "Trading P&L"
                              : "Account equity"}
                          </span>
                          <Amount
                            unit={model.unit}
                            value={money(
                              metric === "pnl" ? point.pnl : point.equity,
                            )}
                          />
                        </div>
                      ) : null;
                    }}
                  />
                  <Area
                    type="linear"
                    dataKey={metric}
                    stroke="var(--portfolio-series)"
                    strokeWidth={1.8}
                    fill="url(#portfolio-fill)"
                    isAnimationActive={false}
                  />
                  {metric === "equity" && period === "week" && (
                    <ReferenceDot
                      x={14}
                      y={data[14].equity}
                      r={4}
                      stroke="var(--card)"
                      fill="var(--primary)"
                    />
                  )}
                </AreaChart>
              </ChartContainer>
              <div className="chart-caption">
                <span className="type-meta muted">
                  {periodLabel} · USDT
                  {metric === "equity" && period === "week"
                    ? " · Deposit on Sep 10"
                    : ""}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setDataVisible(!dataVisible)}
                  aria-expanded={dataVisible}
                >
                  <Table2 size={13} />
                  {dataVisible ? "Hide data" : "View data"}
                </Button>
              </div>
              {dataVisible && (
                <div className="chart-data">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Observed at</TableHead>
                        <TableHead className="text-right">
                          {metric === "pnl" ? "Trading P&L" : "Account equity"}
                        </TableHead>
                        <TableHead>
                          <span className="sr-only">Details</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((point) => (
                        <TableRow key={point.index}>
                          <TableCell>{point.time}</TableCell>
                          <TableCell className="text-right">
                            {money(metric === "pnl" ? point.pnl : point.equity)}{" "}
                            USDT
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Inspect ${point.time}`}
                              onClick={() =>
                                open({
                                  kind: metric === "pnl" ? "pnl" : "account",
                                  period,
                                  observation: {
                                    time: point.time,
                                    value: money(
                                      metric === "pnl"
                                        ? point.pnl
                                        : point.equity,
                                    ),
                                    metric: metric === "pnl" ? "pnl" : "equity",
                                  },
                                })
                              }
                            >
                              <ChevronRight />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </section>
        {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-11 — current records and period activity keep distinct time scopes. */}
        <section className="records-region">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="section-heading">
              <TabsList variant="line" aria-label="Account records">
                <TabsTrigger value="positions">
                  Positions{" "}
                  <span className="tab-count">{unavailable ? "—" : "1"}</span>
                </TabsTrigger>
                <TabsTrigger value="orders">
                  Open orders{" "}
                  <span className="tab-count">{unavailable ? "—" : "1"}</span>
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <span className="type-meta muted">
                {tab === "activity"
                  ? periodLabel
                  : scenario === "delayed"
                    ? "Last observed"
                    : "Current"}
              </span>
            </div>
            {unavailable ? (
              <EmptyState
                title={
                  scenario === "empty"
                    ? "No account records yet"
                    : "Account records restricted"
                }
                detail={
                  scenario === "empty"
                    ? "Your positions, orders and transactions will appear here."
                    : "Open Connections to review account access."
                }
              />
            ) : (
              <>
                <TabsContent value="positions">
                  <Table className="position-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Price · USDT</TableHead>
                        <TableHead className="text-right">
                          Unrealized P&L
                        </TableHead>
                        <TableHead>
                          <span className="sr-only">Details</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <button
                            className="cell-link"
                            onClick={() => open({ kind: "position" })}
                          >
                            <span className="type-control">
                              {model.position.contract}
                            </span>
                            <span className="type-meta muted">Perpetual</span>
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="type-data">
                            {model.position.quantity}
                          </span>
                          <div className="type-meta muted">
                            {model.position.side}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="price-pair">
                            <span className="type-meta muted">Mark</span>
                            <span className="type-data tabular-nums">
                              {model.position.mark}
                            </span>
                            <span className="type-meta muted">Entry</span>
                            <span className="type-data muted tabular-nums">
                              {model.position.entry}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Amount
                            unit={model.unit}
                            value={model.position.pnl}
                            positive
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Open ${model.position.contract} position`}
                            onClick={() => open({ kind: "position" })}
                          >
                            <ChevronRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="orders">
                  <Table className="position-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Filled / total</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>
                          <span className="sr-only">Details</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <button
                            className="cell-link"
                            onClick={() => open({ kind: "order" })}
                          >
                            <span className="type-control">
                              {model.position.contract} · Buy
                            </span>
                            <span className="type-meta muted">
                              Limit · {model.order.limit}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell>{model.order.filledTotal}</TableCell>
                        <TableCell>
                          {scenario === "uncertain"
                            ? "Unconfirmed"
                            : model.order.remaining}
                        </TableCell>
                        <TableCell>
                          <Status>
                            {scenario === "uncertain"
                              ? "Unconfirmed"
                              : "Partial fill"}
                          </Status>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Open buy order"
                            onClick={() => open({ kind: "order" })}
                          >
                            <ChevronRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="activity">
                  <div className="activity-records">
                    <button
                      className="activity-row"
                      onClick={() => open({ kind: "order" })}
                    >
                      <span className="record-icon">
                        <ArrowUpRight size={16} />
                      </span>
                      <span className="record-copy">
                        <span className="type-control">
                          Buy order partially filled
                        </span>
                        <span className="type-meta muted">
                          {model.position.contract} · Sep 13,{" "}
                          {scenario === "delayed" ? "17:42" : "20:42"} KST
                        </span>
                      </span>
                      <span className="type-data">{model.order.remaining}</span>
                      <ChevronRight size={14} />
                    </button>
                    {period === "week" && (
                      <button
                        className="activity-row"
                        onClick={() => open({ kind: "transaction", period })}
                      >
                        <span className="record-icon">
                          <ArrowDownLeft size={16} />
                        </span>
                        <span className="record-copy">
                          <span className="type-control">Capital added</span>
                          <span className="type-meta muted">
                            Treasury · Sep 10, 12:00 KST
                          </span>
                        </span>
                        <Amount
                          unit={model.unit}
                          value={model.periods.week.deposit}
                        />
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
          <Observation
            scenario={scenario}
            onSource={() => open({ kind: "source" })}
          />
        </section>
        {/* UX: ../../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-15 — explanation and its source, not an invented work signal. */}
        <aside className="ceo-region">
          {unavailable ? (
            <EmptyState
              title={
                scenario === "restricted"
                  ? "Investment view restricted"
                  : "No investment view yet"
              }
              detail={
                scenario === "restricted"
                  ? "Account access is required to read this judgment."
                  : "A recorded judgment will appear here after observation."
              }
            />
          ) : (
            <>
              <div className="section-heading">
                <button
                  className="inline-link"
                  onClick={() => open({ kind: "member", id: model.ceo.id })}
                >
                  <Member name={model.ceo.name} role={model.ceo.role} compact />
                </button>
                <span className="type-meta muted">
                  Latest view · {model.ceo.writtenAt}
                </span>
              </div>
              <h2 className="type-section">{model.ceo.headline}</h2>
              <p className="type-body muted">{model.ceo.summary}</p>
              <div className="ceo-actions">
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "decision", id: "reconcile" })}
                >
                  <FileText size={14} />
                  View rationale
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    discuss({
                      label: model.ceo.contextLabel,
                      target: { kind: "decision", id: "reconcile", period },
                    })
                  }
                >
                  <MessageCircle size={14} />
                  Ask {model.ceo.name}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
