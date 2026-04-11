import { Activity, AlertTriangle, Bot, CandlestickChart, ShieldCheck } from "lucide-react";
import type { WorkspaceControllerViewModel } from "../hooks/use-workspace-controller";
import { automationStatusTone } from "../lib/runtime-state-presenters";
import { AppShell } from "./app-shell";
import { AssetInspectorPanel } from "./asset-inspector-panel";
import { BundleImportPanel } from "./bundle-import-panel";
import { CollectionsPanel } from "./collections-panel";
import { DashboardGrid } from "./dashboard-grid";
import { DecisionFeed } from "./decision-feed";
import { EquityAreaPanel } from "./equity-area-panel";
import { EvaluationRunsPanel } from "./evaluation-runs-panel";
import { ExposurePanel } from "./exposure-panel";
import { ExportInspectorPanel } from "./export-inspector-panel";
import { ImportsPanel } from "./imports-panel";
import { LiveContextPanel } from "./live-context-panel";
import { OperationsPanel } from "./operations-panel";
import { PositionsPanel } from "./positions-panel";
import { PriceContextPanel } from "./price-context-panel";
import { RuntimeTopologyPanel } from "./runtime-topology-panel";
import { SourceIngestPanel } from "./source-ingest-panel";
import { StrategyTimeline } from "./strategy-timeline";
import { WorkspaceDocumentPanel } from "./workspace-document-panel";
import { WorkspaceIndexPanel } from "./workspace-index-panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

const CLIENT_RULES = [
  "Official clients talk to the service layer, not directly to workspace storage.",
  "Main dashboard prioritizes live positions, exposure, PnL, and intervention controls.",
  "Reasoning stays visible but short on the primary surface.",
  "`observer`, `paper`, and `live` remain visually distinct.",
  "Any artifact that materially affects live trading remains export-targetable."
] as const;

type WorkspaceDashboardScreenProps = {
  controller: WorkspaceControllerViewModel;
};

export function WorkspaceDashboardScreen({
  controller
}: WorkspaceDashboardScreenProps) {
  const {
    state,
    commandStatus,
    lastSyncedAt,
    serviceAlerts,
    selections: {
      selectedBlobId,
      selectedCheckpointId,
      selectedCollectionId,
      selectedDocumentId,
      selectedEvaluationRunId,
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
      selectedEvaluationRunDetail,
      selectedImportComparison,
      selectedImportDetail,
      selectedOperationDetail,
      workspaceSearchResults
    },
    workspaceDocuments,
    refreshWorkspace,
    openWorkspaceDocument,
    selectDocument,
    setSelectedBlobId,
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedEvaluationRunId,
    setSelectedImportId,
    setSelectedOperationId,
    setWorkspaceSearchQuery,
    flattenAllPositions,
    pauseGlobalAutomation,
    createExportCheckpoint,
    stageBundleImport,
    ingestSourceEntry,
    runBacktest,
    runPaperEvaluation,
    exportCheckpoint,
    restoreCheckpoint,
    activateImport
  } = controller;

  if (!state) {
    return null;
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
              <Button
                variant="ghost"
                onClick={() => {
                  void refreshWorkspace();
                }}
              >
                Refresh Workspace
              </Button>
            </div>
            {commandStatus ? (
              <p className="mt-4 text-sm leading-6 text-ink-200">{commandStatus}</p>
            ) : null}
            {lastSyncedAt ? (
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-300">
                Last sync {lastSyncedAt}
              </p>
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

          <RuntimeTopologyPanel
            runtimeTopology={state.runtimeTopology}
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
                <Badge tone={automationStatusTone(state.automationStatus)}>
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
              {CLIENT_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
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

        <EvaluationRunsPanel
          adapters={state.adapters}
          evaluationRuns={state.evaluationRuns}
          selectedEvaluationRunId={selectedEvaluationRunId}
          evaluationRunDetail={selectedEvaluationRunDetail}
          onSelectEvaluationRun={setSelectedEvaluationRunId}
          onRunBacktest={() => {
            void runBacktest();
          }}
          onRunPaperEvaluation={() => {
            void runPaperEvaluation();
          }}
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
