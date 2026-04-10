import { startTransition, useEffect, useState } from "react";
import { Activity, AlertTriangle, Bot, CandlestickChart, ShieldCheck } from "lucide-react";
import { AppShell } from "./components/app-shell";
import { AssetInspectorPanel } from "./components/asset-inspector-panel";
import { DashboardGrid } from "./components/dashboard-grid";
import { DecisionFeed } from "./components/decision-feed";
import { EquityAreaPanel } from "./components/equity-area-panel";
import { ExposurePanel } from "./components/exposure-panel";
import { ExportInspectorPanel } from "./components/export-inspector-panel";
import { LiveContextPanel } from "./components/live-context-panel";
import { PositionsPanel } from "./components/positions-panel";
import { PriceContextPanel } from "./components/price-context-panel";
import { StrategyTimeline } from "./components/strategy-timeline";
import { WorkspaceIndexPanel } from "./components/workspace-index-panel";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import type { BootstrapState } from "./lib/service-contract";
import { workspaceService } from "./lib/service-gateway";

export function App() {
  const [state, setState] = useState<BootstrapState | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void workspaceService.getBootstrapState().then((nextState) => {
      if (cancelled) {
        return;
      }

      applyNextState(nextState);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-shell-950 text-ink-50">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-ink-300">
            AutoKairos
          </p>
          <p className="text-lg text-ink-50">Booting trading workspace...</p>
        </div>
      </main>
    );
  }

  function applyNextState(nextState: BootstrapState) {
    startTransition(() => {
      setState(nextState);
      setSelectedCheckpointId(nextState.checkpoints[0]?.id ?? null);
    });
  }

  return (
    <AppShell
      title="AutoKairos"
      subtitle="Live-centered trading client with service-owned workspace boundaries"
      aside={
        <div className="space-y-4">
          <Card title="Intervention Controls" description="The client issues commands through the service layer.">
            <div className="grid gap-3">
              <Button
                variant="danger"
                onClick={() => {
                  setCommandStatus("Flattening positions...");
                  void workspaceService.flattenAllPositions().then((nextState) => {
                    applyNextState(nextState);
                    setCommandStatus("All positions flattened through the service layer.");
                  });
                }}
              >
                Flatten All Positions
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCommandStatus("Pausing automation...");
                  void workspaceService.pauseGlobalAutomation().then((nextState) => {
                    applyNextState(nextState);
                    setCommandStatus("Global automation paused. Client is now in observer mode.");
                  });
                }}
              >
                Pause Global Automation
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCommandStatus("Creating export checkpoint...");
                  void workspaceService.createExportCheckpoint().then((nextState) => {
                    applyNextState(nextState);
                    setCommandStatus("Fresh export checkpoint created from the live-centered asset.");
                  });
                }}
              >
                Create Export Checkpoint
              </Button>
            </div>
            {commandStatus ? (
              <p className="mt-4 text-sm leading-6 text-ink-200">{commandStatus}</p>
            ) : null}
          </Card>
          <AssetInspectorPanel assetInspector={state.assetInspector} />
          <WorkspaceIndexPanel workspaceIndex={state.workspaceIndex} />
          <ExportInspectorPanel exportInspector={state.exportInspector} />
          <LiveContextPanel liveContext={state.liveContext} />
        </div>
      }
    >
      <section className="space-y-6">
        <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={state.mode}>{state.mode.toUpperCase()}</Badge>
                <Badge tone="neutral">Artifact {state.workspace.slug}</Badge>
                <Badge tone="positive">Checkpoint {state.workspace.currentCheckpointAlias}</Badge>
                <Badge tone={state.automationStatus === "active" ? "positive" : "warning"}>
                  Automation {state.automationStatus}
                </Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-ink-50">
                  One live book. Continuous research.
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-200">
                  The official client remains dashboard-first. It renders live context, provider health,
                  interventions, and checkpoint lineage without exposing the workspace as a public API.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {state.providers.map((provider) => (
                <div
                  key={provider.name}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-300">
                    <Bot className="size-4" />
                    {provider.name}
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink-50">{provider.statusLabel}</p>
                  <p className="mt-1 text-xs text-ink-300">{provider.usageLabel}</p>
                </div>
              ))}
            </div>
          </div>
          {state.statusNote ? (
            <p className="mt-4 text-sm leading-6 text-ink-200">{state.statusNote}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge tone="positive" icon={ShieldCheck}>
              Protective stops enforced
            </Badge>
            <Badge tone="warning" icon={CandlestickChart}>
              Charts are live-first surfaces
            </Badge>
            <Badge tone="neutral" icon={Activity}>
              Service-layer workspace access only
            </Badge>
            <Badge tone="warning" icon={AlertTriangle}>
              Forced interventions stay visible
            </Badge>
          </div>
        </Card>

        <DashboardGrid metrics={state.metrics} />

        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <div className="space-y-6">
            <PriceContextPanel series={state.priceSeries} />
            <EquityAreaPanel series={state.equitySeries} />
            <StrategyTimeline
              checkpoints={state.checkpoints}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={setSelectedCheckpointId}
            />
          </div>
          <div className="space-y-6">
            <ExposurePanel series={state.exposureSeries} />
            <PositionsPanel positions={state.positions} orders={state.orders} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <DecisionFeed decisions={state.decisions} />
          <Card title="Client Rules" description="V0 scaffold assumptions reflected in code.">
            <ul className="space-y-3 text-sm text-ink-200">
              <li>Official clients talk to the service layer, not directly to workspace storage.</li>
              <li>Main dashboard prioritizes live positions, exposure, PnL, and intervention controls.</li>
              <li>Reasoning stays visible but short on the primary surface.</li>
              <li>`observer`, `paper`, and `live` remain visually distinct.</li>
              <li>Any artifact that materially affects live trading remains export-targetable.</li>
            </ul>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
