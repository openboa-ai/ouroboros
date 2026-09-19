import type { InvestmentTarget } from "@/domains/investment/model";
import { artifacts, earlierArtifacts, artifactAt } from "./fixtures/artifacts";
import { ActivityTimeline } from "@/ui/components/ActivityTimeline";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { OwnerControls } from "@/features/controls/OwnerControls";
import { resources } from "./fixtures/resources";
import { controlOptions } from "./fixtures/controls";
import { useFilePort } from "@/app/file-port";
import { useState, type ReactNode } from "react";
import { ArrowRight, Download, Search, Clock3 } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Input } from "@/ui/primitives/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import {
  Amount,
  EmptyState,
  Facts,
  Member,
  RecordLink,
  Status,
} from "@/ui/components/patterns";
import type { DetailTarget, InspectorProps } from "@/app/contracts";
import "@/ui/layouts/inspector.css";

// UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-17
// All records are local fixtures. These visibility rules demonstrate UI states, not authorization.
const periodData = {
  week: {
    label: "Sep 7–13, 2026",
    start: "100,000.00",
    deposit: "10,000.00",
    realized: "3,420.00",
    unrealized: "+360.00",
    fees: "110.00",
    funding: "20.00",
    pnl: "+3,650.00",
  },
  day: {
    label: "Sep 13, 2026",
    start: "113,030.00",
    deposit: "0.00",
    realized: "710.00",
    unrealized: "−60.00",
    fees: "25.00",
    funding: "5.00",
    pnl: "+620.00",
  },
};
type ArtifactKey = keyof typeof artifacts;
function artifactKey(id = ""): ArtifactKey {
  if (id.includes("funding")) return "funding-review";
  if (id.includes("weekly")) return "weekly-review";
  return "position-review";
}
function knownArtifact(id?: string) {
  return (
    !id ||
    [
      "position-review",
      "position",
      "funding-review",
      "funding",
      "weekly-review",
      "weekly",
      ...Object.values(artifacts).map((record) => record.path),
      ...Object.values(artifacts).map((record) => record.path.split("/").pop()),
    ].includes(id)
  );
}
function hasAccountContent(target: DetailTarget) {
  if (
    ["account", "pnl", "position", "order", "transaction"].includes(target.kind)
  )
    return true;
  if (target.kind === "source")
    return target.id !== "company" && target.id !== "research";
  if (target.kind === "artifact")
    return artifacts[artifactKey(target.id)].account;
  return target.kind === "decision" && !target.id?.includes("funding");
}
// This module intentionally supplies the parent's single-Sheet title contract alongside its body.
// eslint-disable-next-line react-refresh/only-export-components
export function detailTitle(reference: DetailTarget): string {
  const target = reference as InvestmentTarget;
  if (target.observation)
    return target.kind === "source"
      ? "Observation source"
      : target.observation.metric === "equity"
        ? "Account equity observation"
        : "Trading P&L observation";
  if (target.kind === "artifact")
    return knownArtifact(target.id)
      ? artifacts[artifactKey(target.id)].name
      : "Artifact unavailable";
  if (target.kind === "member")
    return target.id?.includes("nova") ? "Nova" : "Atlas";
  const titles: Record<string,string> = {
    account: "Account details",
    pnl: "Trading P&L details",
    position: "BTCUSDT position",
    order: "Buy order and fills",
    decision: "Rationale",
    execution: "Execution details",
    member: "Member",
    work: "Work details",
    artifact: "Artifact",
    costs: "Company operating costs",
    controls: "Owner controls",
    settings: "App settings",
    connections: "Connections",
    search: "Search company records",
    transaction: "Transaction details",
    source: "Source and coverage",
  };
  return titles[target.kind] ?? "Record details";
}
function money(value: string, positive = false) {
  return <Amount unit="USDT" value={value} positive={positive} />;
}
function Highlight({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="inspector-highlight">
      <span className="type-meta muted">{label}</span>
      <Amount
        unit="USDT"
        value={value}
        role="amount-secondary"
        positive={value.startsWith("+")}
      />
      {note && <span className="type-meta muted">{note}</span>}
    </div>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="inspector-group">
      <h3 className="type-section">{title}</h3>
      {children}
    </section>
  );
}
// UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-22
// Bounded text rendering for the two retained Markdown fixtures; React escapes every source line.
function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="inspector-report" aria-label="Report preview">
      {content
        .replace(/^(#{1,2} .+)$/gm, "\n$1\n")
        .trim()
        .split(/\n\s*\n/)
        .map((block, index) => {
          const lines = block.split("\n");
          if (lines.length === 1 && block.startsWith("# "))
            return (
              <h3 className="type-title" key={index}>
                {block.slice(2)}
              </h3>
            );
          if (lines.length === 1 && block.startsWith("## "))
            return (
              <h4 className="type-section" key={index}>
                {block.slice(3)}
              </h4>
            );
          if (lines.every((line) => /^[-*] /.test(line)))
            return (
              <ul className="type-body" key={index}>
                {lines.map((line, item) => (
                  <li key={item}>{line.slice(2)}</li>
                ))}
              </ul>
            );
          if (lines.every((line) => /^\d+\. /.test(line)))
            return (
              <ol className="type-body" key={index}>
                {lines.map((line, item) => (
                  <li key={item}>{line.replace(/^\d+\. /, "")}</li>
                ))}
              </ol>
            );
          return (
            <p className="type-body" key={index}>
              {lines.map((line, item) => (
                <span key={item}>
                  {line}
                  {item < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
        })}
    </article>
  );
}
export function InspectorContent({
  target: reference,
  scenario,
  open,
  discuss,
  updateDetail,
}: InspectorProps) {
  const files = useFilePort();
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState("");
  async function saveArtifact(record: (typeof artifacts)[ArtifactKey]) {
    setSaving(true);
    setSaveResult("");
    try {
      setSaveResult(
        await files.saveCopy({
          name: record.path
            .split("/")
            .at(-1)!
            .replace(/(\.[^.]+)$/, `.r${record.revision}$1`),
          content: record.content,
          mediaType: record.type,
        }),
      );
    } catch {
      setSaveResult(
        "File saving did not complete. Your selected revision is unchanged.",
      );
    } finally {
      setSaving(false);
    }
  }
  const [query, setQuery] = useState("");
  const target = reference as InvestmentTarget;
  const period = target.period ?? "week";
  const data = periodData[period];
  const restricted = scenario === "restricted";
  const empty = scenario === "empty";
  const uncertain = scenario === "uncertain";
  const delayed = scenario === "delayed";
  const activityHour = delayed ? "17" : "20";
  const memberStatus = (nova: boolean) =>
    empty
      ? "Idle"
      : delayed
        ? "Not observed"
        : nova
          ? "Working"
          : uncertain
            ? "Blocked"
            : "Waiting";
  const observed =
    scenario === "delayed" ? "Sep 13, 18:12 KST" : "Sep 13, 20:50 KST";
  const link = (
    kind: DetailTarget["kind"],
    title: string,
    meta?: string,
    id?: string,
  ) => (
    <RecordLink
      title={title}
      meta={meta}
      onClick={() => open({ kind, id, period })}
    />
  );
  const ask = (label = detailTitle(target)) => (
    <Button
      variant="secondary"
      className="inspector-question"
      onClick={() => discuss({ label, target })}
    >
      Ask CEO
      <ArrowRight size={14} />
    </Button>
  );
  const source = (id = "account") => (
    <Button
      variant="ghost"
      className="inspector-source"
      onClick={() => open({ ...target, kind: "source", id })}
    >
      <Clock3 size={14} />
      <span className="type-meta">View source and coverage</span>
    </Button>
  );
  const frame = (children: ReactNode) => (
    <div className="inspector-content">{children}</div>
  );

  // An empty company retains member identities and fixed controls, not synthetic work history.
  if (empty && target.kind === "artifact")
    return frame(
      <EmptyState
        title="No materials"
        detail="This company has no retained files or published revisions."
      />,
    );
  if (
    empty &&
    ["work", "execution", "decision", "costs", "source"].includes(target.kind)
  )
    return frame(
      <EmptyState
        title={
          target.kind === "source"
            ? "No observations"
            : target.kind === "costs"
              ? "No recorded costs"
              : target.kind === "execution"
                ? "No executions"
                : target.kind === "work"
                  ? "No current work"
                  : "No recorded rationale"
        }
        detail="No record exists for the selected context in this empty company."
        action={
          <Button
            variant="secondary"
            onClick={() => open({ kind: "connections" })}
          >
            View connections
          </Button>
        }
      />,
    );

  if (target.kind === "artifact" && !knownArtifact(target.id))
    return frame(
      <EmptyState
        title="Artifact not found"
        detail="This exact reference has no local sample. Another artifact or revision has not been substituted."
      />,
    );

  // UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#shared-states
  // Gate every account-bearing destination, including source, search, artifacts and linked rationale.
  if (restricted && hasAccountContent(target))
    return frame(
      <EmptyState
        title="Account access restricted"
        detail="The selected record is unavailable in this permission scenario. Company work and non-account reports remain accessible."
        action={
          <Button
            variant="secondary"
            onClick={() => open({ kind: "connections" })}
          >
            View connection
          </Button>
        }
      />,
    );
  if (empty && hasAccountContent(target))
    return frame(
      <EmptyState
        title="No account observations"
        detail="This new company has no account record for the selected context. No balance, position or result has been inferred."
        action={
          <Button
            variant="secondary"
            onClick={() => open({ kind: "connections" })}
          >
            View connection
          </Button>
        }
      />,
    );

  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-08
  if (
    target.observation &&
    (target.kind === "account" || target.kind === "pnl")
  ) {
    const point = target.observation;
    return frame(
      <>
        <Highlight
          label={
            point.metric === "equity"
              ? "Selected account equity"
              : "Selected cumulative trading P&L"
          }
          value={point.value}
          note={point.time}
        />
        <Facts
          rows={[
            ["Period", data.label],
            ["Source", "Synthetic chart observation"],
          ]}
        />
        <p className="type-body muted">
          Composition and transactions for this exact observation are not
          supplied. Current account values have not been substituted.
        </p>
        {source("history")}
        {ask(
          `${point.metric === "equity" ? "Account equity" : "Trading P&L"} · ${point.time} · ${point.value} USDT`,
        )}
      </>,
    );
  }
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-17
  if (target.kind === "account")
    return frame(
      <>
        <Highlight
          label="Current account equity"
          value="113,650.00"
          note={`Binance USDⓈ-M · ${observed}`}
        />
        <Tabs defaultValue="composition" key={`account-${period}`}>
          <TabsList aria-label="Account detail sections">
            <TabsTrigger value="composition">Composition</TabsTrigger>
            <TabsTrigger value="changes">Period changes</TabsTrigger>
          </TabsList>
          <TabsContent value="composition">
            <Facts
              rows={[
                ["Wallet balance", money("113,290.00")],
                ["Current unrealized P&L", money("+360.00", true)],
                ["Account equity", money("113,650.00")],
                ["Available balance", "Not supplied"],
              ]}
            />
            <p className="type-meta muted">
              Wallet balance plus current unrealized P&L forms this sample
              account equity. This is not whole-company net capital.
            </p>
            {link(
              "position",
              "View current position",
              "BTCUSDT · observed position and margin",
            )}
          </TabsContent>
          <TabsContent value="changes">
            <p className="type-meta muted">{data.label}</p>
            <Facts
              rows={[
                ["Opening account equity", money(data.start)],
                ["Net deposits", money(data.deposit)],
                ["Trading P&L", money(data.pnl, true)],
                ["Closing account equity", money("113,650.00")],
              ]}
            />
            {link(
              "transaction",
              "View capital movement",
              `${data.label} · confirmed sample records`,
              "deposit",
            )}
            {link(
              "pnl",
              "View trading result",
              "Trading activity is separate from capital contributed",
            )}
          </TabsContent>
        </Tabs>
        {source()}
        {ask(`Account equity · ${data.label}`)}
      </>,
    );
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-18
  if (target.kind === "pnl")
    return frame(
      <>
        <Highlight label="Trading P&L" value={data.pnl} note={data.label} />
        <Group title="How this sample result is composed">
          <Facts
            rows={[
              ["Realized trading result", money(`+${data.realized}`, true)],
              [
                "Change in unrealized P&L",
                money(data.unrealized, data.unrealized.startsWith("+")),
              ],
              ["Trading fees", money(`−${data.fees}`)],
              ["Funding", money(`−${data.funding}`)],
            ]}
          />
        </Group>
        <p className="type-body muted">
          This period result includes trading fees and funding. Deposits and
          company operating costs are excluded. Current unrealized P&L is a
          balance at a point in time; it is not added again.
        </p>
        {link(
          "transaction",
          "Trading fees and funding",
          `${data.label} · sample cost records`,
          "trading-costs",
        )}
        {link(
          "costs",
          "Company operating costs",
          "Separate company costs · not a whole-company profit calculation",
        )}
        {link(
          "artifact",
          "Read the weekly review",
          "Atlas · treasury · revision 4",
          "weekly-review",
        )}
        {source("pnl")}
        {ask(`Trading P&L · ${data.label}`)}
      </>,
    );
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-19
  if (target.kind === "position")
    return frame(
      <>
        <div className="inspector-heading-row">
          <Status>Current position</Status>
          <span className="type-meta muted">{observed}</span>
        </div>
        <div className="inspector-highlight">
          <span className="type-meta muted">BTCUSDT perpetual</span>
          <Amount value="0.20" unit="BTC" role="amount-secondary" />
          <Status>Long</Status>
        </div>
        <Facts
          rows={[
            ["Entry price", money("108,000.00")],
            ["Mark price", money("109,800.00")],
            ["Notional value", money("21,960.00")],
            ["Position margin", money("2,196.00")],
            ["Current unrealized P&L", money("+360.00", true)],
          ]}
        />
        <p className="type-meta muted">
          Filled position only. Open order quantity is separate; position margin
          is not a maximum-loss estimate.
        </p>
        {link(
          "order",
          "View related buy order",
          uncertain
            ? "Cancellation requested · outcome unknown"
            : "0.05 / 0.10 BTC filled",
          "buy",
        )}
        {link(
          "decision",
          "Why this position is being reviewed",
          `Atlas · written ${activityHour}:47 KST`,
          "reconcile",
        )}
        {source("position")}
        {ask("BTCUSDT position · Long 0.20 BTC")}
      </>,
    );
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-20
  if (target.kind === "order")
    return frame(
      <>
        <div className="inspector-heading-row">
          <Status>{uncertain ? "Outcome unknown" : "Partially filled"}</Status>
          <span className="type-meta muted">{observed}</span>
        </div>
        {uncertain && (
          <p className="inspector-notice type-body">
            Cancellation was requested. The final order state and remaining
            quantity have not been confirmed; the last observed fill is retained
            below.
          </p>
        )}
        <Facts
          rows={[
            ["Contract / side", "BTCUSDT · Buy"],
            ["Order type", "Limit"],
            ["Limit price", money("109,700.00")],
            ["Requested quantity", <Amount value="0.10" unit="BTC" />],
            [
              uncertain ? "Last confirmed filled" : "Filled quantity",
              <Amount value="0.05" unit="BTC" />,
            ],
            [
              "Remaining quantity",
              uncertain ? "Not confirmed" : <Amount value="0.05" unit="BTC" />,
            ],
          ]}
        />
        <Group title="Confirmed fill">
          <Facts
            rows={[
              ["Quantity", <Amount value="0.05" unit="BTC" />],
              ["Fill price", money("109,600.00")],
              ["Observed at", `Sep 13, ${activityHour}:46 KST`],
              ["Fill reference", "sample-fill-01"],
            ]}
          />
        </Group>
        {link(
          "position",
          "View related position",
          "Current position is separate from the order",
        )}
        {link(
          "decision",
          "View the recorded rationale",
          "Atlas · reconcile",
          "reconcile",
        )}
        {link(
          "execution",
          "View associated execution",
          "The execution record does not certify a fill",
          "run-atlas",
        )}
        <Group title="Cancel order">
          <Facts
            rows={[
              ["Target", "Sample BTCUSDT buy order"],
              [
                "Before",
                uncertain
                  ? "Cancellation outcome unknown"
                  : "0.05 BTC last observed remaining",
              ],
              ["Requested change", "Cancel any remaining order quantity"],
              [
                "Remaining obligations",
                "Confirmed fills and the current position remain",
              ],
            ]}
          />
          <Button disabled>Preview only — cancellation unavailable</Button>
        </Group>
        {source("order")}
        {ask("BTCUSDT buy order · sample-buy-order")}
      </>,
    );
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-21
  if (target.kind === "decision") {
    const research = target.id?.includes("funding");
    return frame(
      <>
        <Member
          name={research ? "Nova" : "Atlas"}
          role={research ? "Research" : "CEO"}
        />
        <Facts
          rows={[
            ["Written at", `Sep 13, ${activityHour}:47 KST`],
            [
              "Record",
              research ? "Funding observation review" : "Position review",
            ],
            ["Status", "Authored judgment · not an execution receipt"],
          ]}
        />
        <Group title="Recorded rationale">
          <p className="type-body">
            {research
              ? "Retain source timestamps and contract scope before comparing funding observations."
              : "Reconcile the partially filled order before reassessing exposure. Preserve confirmed fills while checking the remaining order state."}
          </p>
        </Group>
        <Group title="Next review condition">
          <p className="type-body">
            {research
              ? "Source coverage reviewed with Atlas."
              : "A new fill or reconciliation update."}
          </p>
          <p className="type-meta muted">
            This is the author's stated condition; it does not establish that a
            wake has been registered.
          </p>
        </Group>
        {!research &&
          link(
            "order",
            "Compare with observed order state",
            uncertain
              ? "Outcome unknown; the explanation cannot settle it"
              : "Confirmed partial fill",
            "buy",
          )}
        {link(
          "artifact",
          "Read the original report",
          `treasury · revision ${research ? 8 : 12}`,
          research ? "funding-review" : "position-review",
        )}
        {link(
          "work",
          "View the originating work",
          research ? "Funding research" : "Account reconciliation",
          research ? "funding" : "reconcile",
        )}
        {ask(`${research ? "Nova's funding" : "Atlas's position"} rationale`)}
      </>,
    );
  }
  // UX: ../../../../docs/design/PORTFOLIO_EXPERIENCE.md#p-22
  if (target.kind === "artifact") {
    const key = artifactKey(target.id);
    const original = artifactAt(key, target.revision);
    if (!original)
      return frame(
        <EmptyState
          title="Revision unavailable"
          detail="This exact revision is not retained. No current version was substituted."
        />,
      );
    const latest = artifacts[key];
    const earlier = earlierArtifacts[key];
    // Observation delay cannot rewrite an immutable published revision.
    const record = original;
    return frame(
      <>
        <Facts
          rows={[
            ["Workspace", "treasury"],
            ["Path", <code className="type-meta">{record.path}</code>],
            ["Revision", String(record.revision)],
            ["Author", record.author],
            [
              "Format",
              record.type === "application/json" ? "JSON" : "Markdown",
            ],
          ]}
        />
        <Tabs
          value={target.tab ?? "preview"}
          onValueChange={(tab) => updateDetail?.({ tab })}
          key={record.path}
        >
          <TabsList aria-label="Artifact display">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="reference">Reference</TabsTrigger>
            <TabsTrigger value="history">Versions</TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            {record.type === "text/markdown" ? (
              <MarkdownPreview content={record.content} />
            ) : (
              <pre className="inspector-document type-data">
                {record.content}
              </pre>
            )}
          </TabsContent>
          <TabsContent value="source">
            <pre className="inspector-document type-data">{record.content}</pre>
          </TabsContent>
          <TabsContent value="history">
            <ActivityTimeline
              label="Retained artifact revisions"
              items={[latest, earlier].map((version) => ({
                id: String(version.revision),
                time: `Revision ${version.revision}`,
                title:
                  version.revision === latest.revision
                    ? "Latest retained publication"
                    : "Earlier publication",
                state: "observed",
                detail:
                  version.revision === record.revision
                    ? "Currently viewing this exact revision"
                    : "Retained independently from the latest manifest",
                action: (
                  <Button
                    variant="ghost"
                    disabled={version.revision === record.revision}
                    onClick={() =>
                      open({
                        kind: "artifact",
                        id: key,
                        revision: version.revision,
                      })
                    }
                  >
                    Open revision {version.revision}
                  </Button>
                ),
              }))}
            />
            <div className="detail-note">
              <span className="type-control">
                Publication is not activation
              </span>
              <p className="type-data muted">
                Publication is retained in this sample. Technical verification,
                acceptance, activation and observed application have not been
                recorded for this material.
              </p>
            </div>
          </TabsContent>
          <TabsContent value="reference">
            <code className="inspector-reference type-data">
              treasury / revision {record.revision} / {record.path}
            </code>
            <p className="type-body muted">
              This exact local sample revision is opened. No latest-version
              substitution or remote file lookup occurs.
            </p>
          </TabsContent>
        </Tabs>
        <Button
          variant="secondary"
          disabled={saving}
          onClick={() => void saveArtifact(record)}
        >
          <Download size={16} />
          Save copy · revision {record.revision}
        </Button>
        <p className="type-meta muted" role="status">
          {saving
            ? "Choose where to save this revision…"
            : saveResult || "Saves the displayed revision."}
        </p>
        {link(
          "work",
          "View creating work",
          record.author,
          record.author === "Nova" ? "funding" : "reconcile",
        )}
        <Button
          variant="secondary"
          onClick={() =>
            discuss({
              label: `${record.name} · treasury / revision ${record.revision} / ${record.path}`,
              target: { kind: "artifact", id: key, revision: record.revision },
            })
          }
        >
          Ask CEO
          <ArrowRight size={14} />
        </Button>
      </>,
    );
  }
  if (target.kind === "transaction") {
    const isCost = target.id?.includes("cost") || target.id?.includes("fee");
    return frame(
      <>
        <p className="type-meta muted">{data.label}</p>
        <Status>Confirmed sample records</Status>
        {isCost ? (
          <Facts
            rows={[
              ["Trading fees", money(`−${data.fees}`)],
              ["Funding", money(`−${data.funding}`)],
              ["Included in", "Selected-period Trading P&L"],
            ]}
          />
        ) : period === "day" ? (
          <EmptyState
            title="No capital movements"
            detail="The sample ledger records zero deposits and withdrawals for Sep 13. This is an observed empty set, not missing history."
          />
        ) : (
          <Facts
            rows={[
              ["Type", "Deposit"],
              ["Amount", money("10,000.00")],
              ["Recorded at", "Sep 10, 2026"],
              ["Source", "Synthetic account ledger"],
              ["Treatment", "Capital contributed · excluded from Trading P&L"],
            ]}
          />
        )}
        {link("pnl", "View period trading result", data.label)}
        {link(
          "account",
          "View account movement",
          "Opening value, capital movement and closing value",
        )}
        {source("transactions")}
        {ask(
          `${isCost ? "Trading costs" : "Capital movements"} · ${data.label}`,
        )}
      </>,
    );
  }
  // UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#shared-states
  if (target.kind === "source")
    return frame(
      <>
        <Facts
          rows={[
            ["Environment", "Local design preview"],
            [
              "Record source",
              target.id === "company"
                ? "Synthetic company observations"
                : target.id === "research"
                  ? "Synthetic research report"
                  : "Synthetic account ledger",
            ],
            ["Exchange connection", "Not connected"],
            ["Observation", target.observation?.time ?? observed],
            ["Selected period", data.label],
            [
              "Coverage",
              target.observation
                ? "Selected chart point; no point-level composition supplied"
                : "Named sample records only · not whole-company accounting",
            ],
          ]}
        />
        {scenario === "delayed" && (
          <p className="inspector-notice type-body">
            The latest observation is retained above. Current activity has not
            been observed.
          </p>
        )}
        {uncertain && hasAccountContent(target) && (
          <p className="inspector-notice type-body">
            The order cancellation outcome remains unknown. This source view
            supplies no later exchange confirmation.
          </p>
        )}
        <p className="type-body muted">
          These fixtures demonstrate how the UI reads evidence. They do not
          establish live trading, independent verification or economic
          performance.
        </p>
        {link(
          "connections",
          "View connection status",
          "Exchange account is not connected",
        )}
      </>,
    );
  // UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#n-04
  if (target.kind === "costs" && period === "day")
    return frame(
      <EmptyState
        title="Daily operating costs not supplied"
        detail="Company operating costs are available for Sep 7–13 only. No daily amount has been inferred."
        action={
          <Button
            variant="secondary"
            onClick={() => open({ kind: "costs", period: "week" })}
          >
            View Sep 7–13 company costs
          </Button>
        }
      />,
    );
  if (target.kind === "costs")
    return frame(
      <>
        <Highlight
          label="Company operating costs"
          value="186.40"
          note="Sep 7–13, 2026 · separate from exchange trading costs"
        />
        <Facts
          rows={[
            ["Model use", money("138.40")],
            ["Compute", money("32.00")],
            ["Data", money("16.00")],
            [
              "Coverage",
              "Recorded sample charges; external owner-paid costs not supplied",
            ],
          ]}
        />
        <p className="type-body muted">
          These costs are not included in Trading P&L. No whole-company net
          profit is calculated. Estimates, measurements and invoices for the
          same charge are not added together.
        </p>
        {link(
          "execution",
          "View associated model and compute work",
          "Sample execution record",
          "run-atlas",
        )}
        {source("company")}
        {ask("Company operating costs · Sep 7–13")}
      </>,
    );
  // UX: ../../../../docs/design/COMPANY_EXPERIENCE.md#o-11
  if (
    target.kind === "member" ||
    target.kind === "work" ||
    target.kind === "execution"
  ) {
    const nova = Boolean(
      target.id?.includes("nova") || target.id?.includes("funding"),
    );
    const member = nova ? "Nova" : "Atlas";
    const work = nova ? "funding" : "reconcile";
    const currentWork = nova
      ? "Review funding costs"
      : "Reconcile the latest fill";
    const condition = nova
      ? "Complete source coverage check"
      : uncertain
        ? "Reconcile the original cancellation"
        : "Next order observation";
    if (empty)
      return frame(
        <>
          <Member name={member} role={nova ? "Research agent" : "CEO"} />
          <Status>Idle</Status>
          <Facts
            rows={[
              [
                "Responsibility",
                nova ? "Funding cost research" : "Investment oversight",
              ],
              ["Current work", "None"],
              ["Execution", "None"],
              ["Retained history", "No work or material records"],
            ]}
          />
          <p className="type-body muted">
            This member identity remains available before any work begins.
          </p>
          {ask(member)}
        </>,
      );
    return frame(
      <>
        <Member name={member} role={nova ? "Research agent" : "CEO"} />
        <Status>{memberStatus(nova)}</Status>
        <Facts
          rows={[
            [
              "Responsibility",
              nova ? "Funding cost research" : "Investment oversight",
            ],
            [delayed ? "Last recorded work" : "Current work", currentWork],
            ["Observation", observed],
            [
              delayed ? "Last known next condition" : "Next condition",
              condition,
            ],
            ["Record source", "Synthetic company observations"],
          ]}
        />
        {delayed && (
          <p className="inspector-notice type-body">
            Current activity is not observed. The work and events below are
            retained history.
          </p>
        )}
        {uncertain && !nova && (
          <p className="inspector-notice type-body">
            Cancellation response is missing. Reconciliation is blocked until
            the original outcome can be checked.
          </p>
        )}
        {target.kind === "member" && (
          <p className="type-body muted">
            This member identity continues across executions. The title and
            display name do not create permissions.
          </p>
        )}
        {target.kind === "execution" && (
          <>
            <Facts
              rows={[
                ["Execution reference", nova ? "run-nova" : "run-atlas"],
                [
                  "Started",
                  `Sep 13, ${activityHour}:${nova ? "42" : "40"} KST`,
                ],
                ["Model profile", "Codex · gpt-5.6-sol"],
                ["Completion", "No terminal event or resource return recorded"],
              ]}
            />
            <Group title="Recorded trace">
              <ol className="inspector-timeline type-data">
                <li>
                  {activityHour}:{nova ? "43:08" : "45:03"} · execution_self ·
                  execution identity confirmed.
                </li>
                {nova && (
                  <>
                    <li>
                      {activityHour}:44:12 · read_input · 2 source records read.
                    </li>
                    <li>
                      {activityHour}:46:21 · record_result · 1 result stored ·
                      db-047.
                    </li>
                    <li>
                      {activityHour}:48:09 · file.publish · treasury / revision
                      8 / reports/funding-review.md.
                    </li>
                  </>
                )}
              </ol>
              <p className="type-meta muted">
                Retained tool records. Publication and execution completion are
                separate observations.
              </p>
            </Group>
          </>
        )}
        {target.kind !== "member" &&
          link(
            "member",
            `View ${member}`,
            "Continuing identity and responsibility",
            nova ? "nova" : "atlas",
          )}
        {target.kind !== "work" &&
          link("work", "View assigned work", work, work)}
        {target.kind !== "execution" &&
          link(
            "execution",
            delayed ? "View retained execution" : "View current execution",
            nova ? "run-nova" : "run-atlas",
            nova ? "run-nova" : "run-atlas",
          )}
        {(!restricted || nova) &&
          link(
            "artifact",
            "View the retained report",
            `Written by ${member}`,
            nova ? "funding-review" : "position-review",
          )}
        {source("company")}
        {link(
          "controls",
          "Review execution stop",
          "Preview only",
          nova ? "run-nova" : "run-atlas",
        )}
        {ask(`${member} · ${work}`)}
      </>,
    );
  }
  // UX: ../../../../docs/design/UI_PURPOSE_CONTRACT.md#t-10
  if (target.kind === "controls")
    return (
      <OwnerControls
        target={target}
        open={open}
        discuss={discuss}
        scenario={scenario}
        options={controlOptions}
      />
    );
  if (target.kind === "connections")
    return (
      <ResourcesPanel
        target={target}
        open={open}
        discuss={discuss}
        scenario={scenario}
        records={resources}
        updateDetail={updateDetail}
      />
    );
  if (target.kind === "search") {
    const records: { label: string; meta: string; target: DetailTarget }[] = [
      {
        label: "Account equity",
        meta: "Account composition",
        target: { kind: "account", period },
      },
      {
        label: "Trading P&L",
        meta: data.label,
        target: { kind: "pnl", period },
      },
      {
        label: "BTCUSDT position",
        meta: "Current position",
        target: { kind: "position" },
      },
      {
        label: "BTCUSDT buy order",
        meta: "Order and fills",
        target: { kind: "order", id: "buy" },
      },
      {
        label: "Position review",
        meta: "treasury · revision 12",
        target: { kind: "artifact", id: "position-review" },
      },
      {
        label: "Funding review",
        meta: "treasury · revision 8",
        target: { kind: "artifact", id: "funding-review" },
      },
      {
        label: "Weekly review",
        meta: "treasury · revision 4",
        target: { kind: "artifact", id: "weekly-review" },
      },
      {
        label: "Atlas",
        meta: "Company member · CEO",
        target: { kind: "member", id: "atlas" },
      },
      {
        label: "Nova",
        meta: "Company member · Research",
        target: { kind: "member", id: "nova" },
      },
      {
        label: "Funding research",
        meta: "Assigned work",
        target: { kind: "work", id: "funding" },
      },
      {
        label: "Company operating costs",
        meta: "Recorded company usage",
        target: { kind: "costs" },
      },
    ];
    const matches = records.filter(
      (record) =>
        (!empty || record.target.kind === "member") &&
        (!restricted || !hasAccountContent(record.target)) &&
        `${record.label} ${record.meta}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return frame(
      <>
        <label className="type-control" htmlFor="inspector-record-search">
          Search local sample records
        </label>
        <Input
          id="inspector-record-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Account, member, order or report…"
        />
        <p className="type-meta muted">
          {empty
            ? "Only current member identities are available. No work, files or financial observations have been recorded."
            : "Only records visible in the selected scenario are listed."}
        </p>
        <div className="inspector-records">
          {matches.map((record) => (
            <RecordLink
              key={record.label}
              title={record.label}
              meta={record.meta}
              icon={<Search size={16} />}
              onClick={() => open(record.target)}
            />
          ))}
        </div>
        {!matches.length && (
          <EmptyState
            title="No matching records"
            detail="Try an available record name. Search covers these local fixtures only."
          />
        )}
      </>,
    );
  }
  return frame(
    <EmptyState
      title="Record unavailable"
      detail="This preview has no record for the selected reference."
    />,
  );
}
