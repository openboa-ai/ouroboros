import { Activity, AlertTriangle, Bot, CandlestickChart, ShieldCheck } from "lucide-react";
import { AppShell } from "./components/app-shell";
import { AssetInspectorPanel } from "./components/asset-inspector-panel";
import { BundleImportPanel } from "./components/bundle-import-panel";
import { CollectionsPanel } from "./components/collections-panel";
import { DashboardGrid } from "./components/dashboard-grid";
import { DecisionFeed } from "./components/decision-feed";
import { EquityAreaPanel } from "./components/equity-area-panel";
import { ExposurePanel } from "./components/exposure-panel";
import { ExportInspectorPanel } from "./components/export-inspector-panel";
import { ImportsPanel } from "./components/imports-panel";
import { LiveContextPanel } from "./components/live-context-panel";
import { OperationsPanel } from "./components/operations-panel";
import { PositionsPanel } from "./components/positions-panel";
import { PriceContextPanel } from "./components/price-context-panel";
import { SourceIngestPanel } from "./components/source-ingest-panel";
import { StrategyTimeline } from "./components/strategy-timeline";
import { WorkspaceIndexPanel } from "./components/workspace-index-panel";
import { WorkspaceDocumentPanel } from "./components/workspace-document-panel";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { useWorkspaceController } from "./hooks/use-workspace-controller";

export function App() {
  const {
    state,
    bootstrapError,
    commandStatus,
    serviceAlerts,
    selections: {
      selectedBlobId,
      selectedCheckpointId,
      selectedCollectionId,
      selectedDocumentId,
      selectedImportId,
      selectedOperationId,
      workspaceSearchQuery
    },
    detailState: {
      selectedBlobDetail,
      selectedCheckpointComparison,
      selectedCheckpointDetail,
      selectedCollectionDetail,
      selectedDocumentDetail,
      selectedImportComparison,
      selectedImportDetail,
      selectedOperationDetail,
      workspaceSearchResults
    },
    workspaceDocuments,
    loadBootstrapState,
    openWorkspaceDocument,
    selectDocument,
    setSelectedBlobId,
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedImportId,
    setSelectedOperationId,
    setWorkspaceSearchQuery,
    flattenAllPositions,
    pauseGlobalAutomation,
    createExportCheckpoint,
    stageBundleImport,
    ingestSourceEntry,
    exportCheckpoint,
    restoreCheckpoint,
    activateImport
  } = useWorkspaceController();

  if (!state) {
    if (bootstrapError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-shell-950 px-6 text-ink-50">
          <Card
            title="AutoKairos failed to boot"
            description="The client could not load the workspace through the service boundary."
            className="w-full max-w-xl"
          >
            <div className="space-y-4">
              <p className="text-sm leading-6 text-ink-200">{bootstrapError}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  void loadBootstrapState();
                }}
              >
                Retry bootstrap
              </Button>
            </div>
          </Card>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-shell-950 text-ink-50">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-ink-300">AutoKairos</p>
          <p className="text-lg text-ink-50">Booting trading workspace...</p>
        </div>
      </main>
    );
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
                  void flattenAllPositions();
                }}
              >
                Flatten All Positions
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void pauseGlobalAutomation();
                }}
              >
                Pause Global Automation
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  void createExportCheckpoint();
                }}
              >
                Create Export Checkpoint
              </Button>
            </div>
            {commandStatus ? (
              <p className="mt-4 text-sm leading-6 text-ink-200">{commandStatus}</p>
            ) : null}
          </Card>

          <BundleImportPanel
            suggestedBundleRef={
              state.assetInspector.latestExportBundleRef ?? state.exportInspector.latestBundle?.bundleRef
            }
            onSubmit={async (bundleRef) => {
              await stageBundleImport(bundleRef);
            }}
          />

          <SourceIngestPanel
            onSubmit={async (input) => {
              await ingestSourceEntry(input);
            }}
          />

          {serviceAlerts.length > 0 ? (
            <Card
              title="Service Alerts"
              description="Asynchronous detail loaders surface here when the service boundary fails to resolve workspace state."
            >
              <div className="space-y-3">
                {serviceAlerts.map((alert) => (
                  <div
                    key={alert.scope}
                    className="rounded-2xl border border-accent-red/30 bg-accent-red/10 px-3 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-300">
                      {alert.scope}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-ink-50">{alert.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <AssetInspectorPanel
            assetInspector={state.assetInspector}
            onOpenDocument={openWorkspaceDocument}
          />

          <WorkspaceIndexPanel
            workspaceIndex={state.workspaceIndex}
            onOpenDocument={openWorkspaceDocument}
          />

          <ExportInspectorPanel
            exportInspector={state.exportInspector}
            onOpenDocument={openWorkspaceDocument}
          />

          <LiveContextPanel
            liveContext={state.liveContext}
            onOpenDocument={openWorkspaceDocument}
          />
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
              checkpointDetail={selectedCheckpointDetail}
              checkpointComparison={selectedCheckpointComparison}
              selectedCheckpointId={selectedCheckpointId}
              onSelectCheckpoint={setSelectedCheckpointId}
              onExportCheckpoint={(checkpointId) => {
                void exportCheckpoint(checkpointId);
              }}
              onOpenWorkspaceDocument={(documentRef) => {
                selectDocument(`ref:${documentRef}`, documentRef);
              }}
              onRestoreCheckpoint={(checkpointId) => {
                void restoreCheckpoint(checkpointId);
              }}
            />
          </div>
          <div className="space-y-6">
            <ExposurePanel series={state.exposureSeries} />
            <PositionsPanel
              positions={state.positions}
              orders={state.orders}
              laneEvents={state.laneEvents}
            />
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

        <CollectionsPanel
          collections={state.collections}
          selectedCollectionId={selectedCollectionId}
          collectionDetail={selectedCollectionDetail}
          selectedBlobId={selectedBlobId}
          blobDetail={selectedBlobDetail}
          onSelectCollection={setSelectedCollectionId}
          onSelectBlob={setSelectedBlobId}
          onOpenWorkspaceDocument={(documentRef) => {
            selectDocument(`ref:${documentRef}`, documentRef);
          }}
        />

        <ImportsPanel
          imports={state.imports}
          selectedImportId={selectedImportId}
          importDetail={selectedImportDetail}
          importComparison={selectedImportComparison}
          onSelectImport={setSelectedImportId}
          onActivateImport={(importId) => {
            void activateImport(importId);
          }}
          onOpenWorkspaceDocument={(documentRef) => {
            selectDocument(`ref:${documentRef}`, documentRef);
          }}
        />

        <OperationsPanel
          operations={state.operations}
          selectedOperationId={selectedOperationId}
          operationDetail={selectedOperationDetail}
          onSelectOperation={setSelectedOperationId}
          onOpenWorkspaceDocument={(documentRef) => {
            selectDocument(`ref:${documentRef}`, documentRef);
          }}
        />

        <WorkspaceDocumentPanel
          documents={workspaceDocuments}
          searchQuery={workspaceSearchQuery}
          searchResults={workspaceSearchResults}
          selectedDocumentId={selectedDocumentId}
          documentDetail={selectedDocumentDetail}
          onSearchQueryChange={setWorkspaceSearchQuery}
          onSelectDocument={selectDocument}
        />
      </section>
    </AppShell>
  );
}
