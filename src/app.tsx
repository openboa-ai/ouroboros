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
import { OperationsPanel } from "./components/operations-panel";
import { PositionsPanel } from "./components/positions-panel";
import { PriceContextPanel } from "./components/price-context-panel";
import { StrategyTimeline } from "./components/strategy-timeline";
import { WorkspaceIndexPanel } from "./components/workspace-index-panel";
import {
  WorkspaceDocumentPanel
} from "./components/workspace-document-panel";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import type {
  BlobDetailState,
  BootstrapState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportDetailState,
  ImportComparisonState,
  OperationDetailState,
  WorkspaceCatalogEntry,
  WorkspaceDocumentState,
  WorkspaceSearchResultState
} from "./lib/service-contract";
import { workspaceService } from "./lib/service-gateway";
import { CollectionsPanel } from "./components/collections-panel";
import { ImportsPanel } from "./components/imports-panel";

export function App() {
  const [state, setState] = useState<BootstrapState | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [selectedCheckpointDetail, setSelectedCheckpointDetail] = useState<CheckpointDetailState | null>(
    null
  );
  const [selectedCheckpointComparison, setSelectedCheckpointComparison] =
    useState<CheckpointComparisonState | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedCollectionDetail, setSelectedCollectionDetail] = useState<CollectionDetailState | null>(
    null
  );
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [selectedImportDetail, setSelectedImportDetail] = useState<ImportDetailState | null>(null);
  const [selectedImportComparison, setSelectedImportComparison] = useState<ImportComparisonState | null>(
    null
  );
  const [selectedBlobId, setSelectedBlobId] = useState<string | null>(null);
  const [selectedBlobDetail, setSelectedBlobDetail] = useState<BlobDetailState | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [selectedOperationDetail, setSelectedOperationDetail] = useState<OperationDetailState | null>(
    null
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentRef, setSelectedDocumentRef] = useState<string | null>(null);
  const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<WorkspaceDocumentState | null>(
    null
  );
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState("");
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<
    WorkspaceSearchResultState[] | null
  >(null);
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

  useEffect(() => {
    if (!selectedCheckpointId) {
      setSelectedCheckpointDetail(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getCheckpointDetail(selectedCheckpointId).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedCheckpointDetail(detail);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCheckpointId]);

  useEffect(() => {
    if (!state || !selectedCheckpointId) {
      setSelectedCheckpointComparison(null);
      return;
    }

    const currentCheckpoint =
      state.checkpoints.find(
        (checkpoint) => checkpoint.pathRef === state.workspaceIndex.active.currentCheckpointRef
      ) ?? state.checkpoints[0];
    if (!currentCheckpoint || currentCheckpoint.id === selectedCheckpointId) {
      setSelectedCheckpointComparison(null);
      return;
    }

    let cancelled = false;
    void workspaceService
      .getCheckpointComparison(currentCheckpoint.id, selectedCheckpointId)
      .then((comparison) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedCheckpointComparison(comparison);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [state, selectedCheckpointId]);

  useEffect(() => {
    if (!selectedCollectionId) {
      setSelectedCollectionDetail(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getCollectionDetail(selectedCollectionId).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedCollectionDetail(detail);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!selectedImportId) {
      setSelectedImportDetail(null);
      setSelectedImportComparison(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getImportDetail(selectedImportId).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedImportDetail(detail);
      });
    });

    void workspaceService.getImportComparison(selectedImportId).then((comparison) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedImportComparison(comparison);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedImportId]);

  useEffect(() => {
    const nextBlobId = selectedCollectionDetail?.entries.find((entry) => entry.blobRef)?.blobRef ?? null;
    setSelectedBlobId((current) => (current === nextBlobId ? current : nextBlobId));
    setSelectedBlobDetail(null);
  }, [selectedCollectionDetail]);

  useEffect(() => {
    if (!selectedBlobId) {
      setSelectedBlobDetail(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getBlobDetail(selectedBlobId).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedBlobDetail(detail);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedBlobId]);

  useEffect(() => {
    if (!selectedOperationId) {
      setSelectedOperationDetail(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getOperationDetail(selectedOperationId).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedOperationDetail(detail);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedOperationId]);

  useEffect(() => {
    if (!selectedDocumentRef) {
      setSelectedDocumentDetail(null);
      return;
    }

    let cancelled = false;

    void workspaceService.getWorkspaceDocument(selectedDocumentRef).then((detail) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setSelectedDocumentDetail(detail);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentRef]);

  useEffect(() => {
    const normalized = workspaceSearchQuery.trim();
    if (!normalized) {
      setWorkspaceSearchResults(null);
      return;
    }

    let cancelled = false;

    void workspaceService.searchWorkspace(normalized).then((results) => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setWorkspaceSearchResults(results);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceSearchQuery, state]);

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

  function applyNextState(
    nextState: BootstrapState,
    options?: {
      selectedCheckpointId?: string | null;
      selectedCollectionId?: string | null;
      selectedImportId?: string | null;
      selectedOperationId?: string | null;
      selectedDocumentId?: string | null;
      selectedDocumentRef?: string | null;
    }
  ) {
    const nextCheckpointId =
      options?.selectedCheckpointId ??
      nextState.checkpoints.find(
        (checkpoint) => checkpoint.pathRef === nextState.assetInspector.currentCheckpointRef
      )?.id ??
      nextState.checkpoints[0]?.id ??
      null;
    const nextCollectionId =
      options?.selectedCollectionId ??
      nextState.collections.find((collection) => collection.id === selectedCollectionId)?.id ??
      nextState.collections[0]?.id ??
      null;
    const nextImportId =
      options?.selectedImportId ??
      nextState.imports.find((item) => item.id === selectedImportId)?.id ??
      nextState.imports[0]?.id ??
      null;
    const nextOperationId =
      options?.selectedOperationId ??
      nextState.operations.find((item) => item.id === selectedOperationId)?.id ??
      nextState.operations[0]?.id ??
      null;
    const nextDocumentId = options?.selectedDocumentId ?? "strategy";
    const nextDocumentRef = options?.selectedDocumentRef ?? nextState.assetInspector.strategyRef;

    startTransition(() => {
      setState(nextState);
      setSelectedCheckpointId(nextCheckpointId);
      setSelectedCheckpointDetail(null);
      setSelectedCheckpointComparison(null);
      setSelectedCollectionId(nextCollectionId);
      setSelectedCollectionDetail(null);
      setSelectedImportId(nextImportId);
      setSelectedImportDetail(null);
      setSelectedImportComparison(null);
      setSelectedBlobId(null);
      setSelectedBlobDetail(null);
      setSelectedOperationId(nextOperationId);
      setSelectedOperationDetail(null);
      setSelectedDocumentId(nextDocumentId);
      setSelectedDocumentRef(nextDocumentRef);
      setSelectedDocumentDetail(null);
      setWorkspaceSearchResults(null);
    });
  }

  const workspaceDocuments: WorkspaceCatalogEntry[] = [
    ...state.documentCatalog,
    ...(selectedBlobDetail
      ? [
          {
            id: "selected-blob",
            category: "blob" as const,
            label: "selected blob",
            description: "Immutable source body resolved from the selected entry.",
            pathRef: selectedBlobDetail.blobPathRef
          }
        ]
      : [])
  ];

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
              <Button
                variant="ghost"
                onClick={() => {
                  const bundleRef =
                    state.assetInspector.latestExportBundleRef ?? state.exportInspector.latestBundle?.bundleRef;
                  if (!bundleRef) {
                    setCommandStatus("Create an export checkpoint before staging an import.");
                    return;
                  }

                  setCommandStatus("Staging latest sanitized export...");
                  void workspaceService.importExportBundle(bundleRef).then(async (imported) => {
                    const nextState = await workspaceService.getBootstrapState();
                    applyNextState(nextState, {
                      selectedImportId: imported.importId,
                      selectedDocumentId: "selected-import",
                      selectedDocumentRef: imported.importRef
                    });
                    setCommandStatus("Latest sanitized export staged into workspace imports.");
                  });
                }}
              >
                Stage Latest Export
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const eventTime = new Date().toISOString();
                  const preview = `Operator note captured at ${eventTime}`;
                  setCommandStatus("Ingesting sample source entry...");
                  void workspaceService
                    .ingestSourceEntry({
                      kind: "raw",
                      sourceRef: "notes:operator:runtime",
                      eventTime,
                      ingestedAt: eventTime,
                      preview,
                      bodyText: `${preview}\n\nReason: keep the source pipeline visible inside the workspace asset.`
                    })
                    .then(async (result) => {
                      const nextState = await workspaceService.getBootstrapState();
                      applyNextState(nextState, {
                        selectedCollectionId: result.collectionId,
                        selectedDocumentId: "collections-index",
                        selectedDocumentRef: nextState.workspaceIndex.indexes.collectionsRef
                      });
                      setCommandStatus("Sample source entry ingested into the current workspace.");
                    });
                }}
              >
                Ingest Sample Source
              </Button>
            </div>
            {commandStatus ? (
              <p className="mt-4 text-sm leading-6 text-ink-200">{commandStatus}</p>
            ) : null}
          </Card>
          <AssetInspectorPanel assetInspector={state.assetInspector} />
          <WorkspaceIndexPanel workspaceIndex={state.workspaceIndex} />
          <ExportInspectorPanel exportInspector={state.exportInspector} />
          <LiveContextPanel
            liveContext={state.liveContext}
            onOpenDocument={(documentId, pathRef) => {
              setSelectedDocumentId(documentId);
              setSelectedDocumentRef(pathRef);
            }}
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
              onOpenWorkspaceDocument={(documentRef) => {
                setSelectedDocumentId(`ref:${documentRef}`);
                setSelectedDocumentRef(documentRef);
              }}
              onRestoreCheckpoint={(checkpointId) => {
                const checkpoint = state.checkpoints.find((item) => item.id === checkpointId);
                setCommandStatus(
                  checkpoint
                    ? `Restoring checkpoint ${checkpoint.alias}...`
                    : "Restoring checkpoint..."
                );
                void workspaceService.restoreCheckpoint(checkpointId).then((nextState) => {
                  applyNextState(nextState);
                  setCommandStatus(
                    checkpoint
                      ? `Live workspace restored from checkpoint ${checkpoint.alias}.`
                      : "Live workspace restored from checkpoint."
                  );
                });
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
        />

        <ImportsPanel
          imports={state.imports}
          selectedImportId={selectedImportId}
          importDetail={selectedImportDetail}
          importComparison={selectedImportComparison}
          onSelectImport={setSelectedImportId}
          onOpenWorkspaceDocument={(documentRef) => {
            setSelectedDocumentId(`ref:${documentRef}`);
            setSelectedDocumentRef(documentRef);
          }}
        />

        <OperationsPanel
          operations={state.operations}
          selectedOperationId={selectedOperationId}
          operationDetail={selectedOperationDetail}
          onSelectOperation={setSelectedOperationId}
          onOpenWorkspaceDocument={(documentRef) => {
            setSelectedDocumentId(`ref:${documentRef}`);
            setSelectedDocumentRef(documentRef);
          }}
        />

        <WorkspaceDocumentPanel
          documents={workspaceDocuments}
          searchQuery={workspaceSearchQuery}
          searchResults={workspaceSearchResults}
          selectedDocumentId={selectedDocumentId}
          documentDetail={selectedDocumentDetail}
          onSearchQueryChange={setWorkspaceSearchQuery}
          onSelectDocument={(documentId, pathRef) => {
            setSelectedDocumentId(documentId);
            setSelectedDocumentRef(pathRef);
          }}
        />
      </section>
    </AppShell>
  );
}
