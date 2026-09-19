import type { Scenario, ViewProps } from "@/app/contracts";
import { defineCompanyModule } from "@/contracts/company-sdk";
import type { ModuleDefinition } from "@/contracts/modules";
import { Amount, EmptyState, RecordLink } from "@/ui/components/patterns";
import { PortfolioScreen } from "./Portfolio";
import type { InvestmentViewData } from "./model";

/** The source adapter supplies observations; the common app never imports financial models. */
export function createInvestmentModule(readModel: (scenario: Scenario) => InvestmentViewData | null): ModuleDefinition {
  function Portfolio(props: ViewProps) {
    const model = readModel(props.scenario);
    if (!model) return <EmptyState title="Portfolio unavailable" detail="No permitted account observations are available from this connection." />;
    return <PortfolioScreen {...props} model={model} open={target => props.open({ ...target, module: "investment" })} discuss={context => props.discuss({ ...context, target: { ...context.target, module: "investment" } })} />;
  }
  function Equity(props: ViewProps) {
    const model = readModel(props.scenario);
    if (!model || props.scenario === "empty" || props.scenario === "restricted") return <EmptyState title={props.scenario === "restricted" ? "Account access restricted" : "Account not observed"} detail="No account amount is available in this view." />;
    return <div className="widget-stat"><Amount unit={model.unit} value={model.equity} role="amount" /><span className="type-meta muted">{model.account} · {props.scenario === "delayed" ? "Last observed" : "Observed"} {model.observedAt}</span><RecordLink variant="row" title="Account details" onClick={() => props.open({ module: "investment", kind: "account" })} /></div>;
  }
  function Exposure(props: ViewProps) {
    const model = readModel(props.scenario);
    if (!model || props.scenario === "empty" || props.scenario === "restricted") return <EmptyState title="Position unavailable" detail="No permitted position observation is available in this view." />;
    return <div className="widget-stat"><span className="type-control">{model.position.contract} · {model.position.side}</span><Amount unit={model.unit} value={model.position.notional} role="amount-secondary" /><span className="type-meta muted">Notional value · {model.position.quantity} · Observed {model.observedAt}</span><RecordLink variant="row" title="Position details" onClick={() => props.open({ module: "investment", kind: "position" })} /></div>;
  }
  return defineCompanyModule({
    id: "investment", version: "1.0.0", name: "Portfolio",
    pages: [{ id: "portfolio", title: "Portfolio", Screen: Portfolio }],
    widgets: [
      { id: "investment.equity", title: "Account equity", description: "Observed account equity with its account and timestamp", provider: "Company · Portfolio", sizes: ["small", "medium"], Component: Equity },
      { id: "investment.exposure", title: "Current exposure", description: "Observed position exposure and its supporting record", provider: "Company · Portfolio", sizes: ["small", "medium"], Component: Exposure },
    ],
  });
}
