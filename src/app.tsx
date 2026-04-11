import { startTransition, useEffect, useState } from "react";
import { Activity, AlertTriangle, Bot, CandlestickChart, ShieldCheck } from "lucide-react";
import { AppShell } from "./components/app-shell";
import { AssetInspectorPanel } from "./components/asset-inspector-panel";
import { BundleImportPanel } from "./components/bundle-import-panel";
import { DashboardGrid } from "./components/dashboard-grid";
import { DecisionFeed } from "./components/decision-feed";
import { EquityAreaPanel } from "./components/equity-area-panel";
import { ExposurePanel } from "./components/exposure-panel";
import { ExportInspectorPanel } from "./components/export-inspector-panel";
import { LiveContextPanel } from "./components/live-context-panel";
import { OperationsPanel } from "./components/operations-panel";
import { PositionsPanel } from "./components/positions-panel";
import { PriceContextPanel } from "./components/price-context-panel";
import { SourceIngestPanel } from "./components/source-ingest-panel";
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
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
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
  const [detailErrors, setDetailErrors] = useState<Record<string, string | null>>({});
  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  async function loadBootstrapState() {
    setBootstrapError(null);
    try {
      const nextState = await workspaceService.getBootstrapState();
      applyNextState(nextState);
    } catch (error) {
      setBootstrapError(`Failed to boot workspace: ${errorMessage(error)}`);
    }
  }

  function setDetailError(scope: string, message: string | null) {
    startTransition(() => {
      setDetailErrors((current) => ({
        ...current,
        [scope]: message
      }));
    });
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextState = await workspaceService.getBootstrapState();
        if (cancelled) {
          return;
        }

        setBootstrapError(null);
        applyNextState(nextState);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBootstrapError(`Failed to boot workspace: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCheckpointId) {
      setSelectedCheckpointDetail(null);
      setDetailError("checkpoint", null);
      return;
    }

    let cancelled = false;

    setDetailError("checkpoint", null);

    void (async () => {
      try {
        const detail = await workspaceService.getCheckpointDetail(selectedCheckpointId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedCheckpointDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("checkpoint", `Checkpoint detail failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCheckpointId]);

  useEffect(() => {
    if (!state || !selectedCheckpointId) {
      setSelectedCheckpointComparison(null);
      setDetailError("checkpointComparison", null);
      return;
    }

    const currentCheckpoint =
      state.checkpoints.find(
        (checkpoint) => checkpoint.pathRef === state.workspaceIndex.active.currentCheckpointRef
      ) ?? state.checkpoints[0];
    if (!currentCheckpoint || currentCheckpoint.id === selectedCheckpointId) {
      setSelectedCheckpointComparison(null);
      setDetailError("checkpointComparison", null);
      return;
    }

    let cancelled = false;
    setDetailError("checkpointComparison", null);
    void (async () => {
      try {
        const comparison = await workspaceService.getCheckpointComparison(
          currentCheckpoint.id,
          selectedCheckpointId
        );
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedCheckpointComparison(comparison);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError(
          "checkpointComparison",
          `Checkpoint comparison failed: ${errorMessage(error)}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, selectedCheckpointId]);

  useEffect(() => {
    if (!selectedCollectionId) {
      setSelectedCollectionDetail(null);
      setDetailError("collection", null);
      return;
    }

    let cancelled = false;

    setDetailError("collection", null);

    void (async () => {
      try {
        const detail = await workspaceService.getCollectionDetail(selectedCollectionId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedCollectionDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("collection", `Collection detail failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId]);

  useEffect(() => {
    if (!selectedImportId) {
      setSelectedImportDetail(null);
      setSelectedImportComparison(null);
      setDetailError("import", null);
      setDetailError("importComparison", null);
      return;
    }

    let cancelled = false;

    setDetailError("import", null);
    setDetailError("importComparison", null);

    void (async () => {
      try {
        const detail = await workspaceService.getImportDetail(selectedImportId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedImportDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("import", `Import detail failed: ${errorMessage(error)}`);
      }
    })();

    void (async () => {
      try {
        const comparison = await workspaceService.getImportComparison(selectedImportId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedImportComparison(comparison);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError(
          "importComparison",
          `Import comparison failed: ${errorMessage(error)}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedImportId]);

  useEffect(() => {
    const nextBlobId = selectedCollectionDetail?.entries.find((entry) => entry.blobRef)?.blobRef ?? null;
    setSelectedBlobId((current) => (current === nextBlobId ? current : nextBlobId));
    setSelectedBlobDetail(null);
    setDetailError("blob", null);
  }, [selectedCollectionDetail]);

  useEffect(() => {
    if (!selectedBlobId) {
      setSelectedBlobDetail(null);
      setDetailError("blob", null);
      return;
    }

    let cancelled = false;

    setDetailError("blob", null);

    void (async () => {
      try {
        const detail = await workspaceService.getBlobDetail(selectedBlobId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedBlobDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("blob", `Blob detail failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBlobId]);

  useEffect(() => {
    if (!selectedOperationId) {
      setSelectedOperationDetail(null);
      setDetailError("operation", null);
      return;
    }

    let cancelled = false;

    setDetailError("operation", null);

    void (async () => {
      try {
        const detail = await workspaceService.getOperationDetail(selectedOperationId);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedOperationDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("operation", `Operation detail failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOperationId]);

  useEffect(() => {
    if (!selectedDocumentRef) {
      setSelectedDocumentDetail(null);
      setDetailError("document", null);
      return;
    }

    let cancelled = false;

    setDetailError("document", null);

    void (async () => {
      try {
        const detail = await workspaceService.getWorkspaceDocument(selectedDocumentRef);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSelectedDocumentDetail(detail);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("document", `Workspace document failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentRef]);

  useEffect(() => {
    const normalized = workspaceSearchQuery.trim();
    if (!normalized) {
      setWorkspaceSearchResults(null);
      setDetailError("search", null);
      return;
    }

    let cancelled = false;

    setDetailError("search", null);

    void (async () => {
      try {
        const results = await workspaceService.searchWorkspace(normalized);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setWorkspaceSearchResults(results);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDetailError("search", `Workspace search failed: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceSearchQuery, state]);

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
      setDetailErrors({});
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

  const workspaceDocuments: WorkspaceCatalogEntry[] = state.documentCatalog;
  const serviceAlerts = Object.entries(detailErrors)
    .filter(([, message]) => Boolean(message))
    .map(([scope, message]) => ({
      scope,
      message: message as string
    }));

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
                  void (async () => {
                    try {
                      const nextState = await workspaceService.flattenAllPositions();
                      applyNextState(nextState);
                      setCommandStatus("All positions flattened through the service layer.");
                    } catch (error) {
                      setCommandStatus(`Flatten all failed: ${errorMessage(error)}`);
                    }
                  })();
                }}
              >
                Flatten All Positions
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCommandStatus("Pausing automation...");
                  void (async () => {
                    try {
                      const nextState = await workspaceService.pauseGlobalAutomation();
                      applyNextState(nextState);
                      setCommandStatus("Global automation paused. Client is now in observer mode.");
                    } catch (error) {
                      setCommandStatus(`Pause automation failed: ${errorMessage(error)}`);
                    }
                  })();
                }}
              >
                Pause Global Automation
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCommandStatus("Creating export checkpoint...");
                  void (async () => {
                    try {
                      const nextState = await workspaceService.createExportCheckpoint();
                      applyNextState(nextState);
                      setCommandStatus(
                        "Fresh export checkpoint created from the live-centered asset."
                      );
                    } catch (error) {
                      setCommandStatus(`Create export checkpoint failed: ${errorMessage(error)}`);
                    }
                  })();
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
              setCommandStatus(`Staging bundle import from ${bundleRef}...`);
              const imported = await workspaceService.importExportBundle(bundleRef);
              const nextState = await workspaceService.getBootstrapState();
              applyNextState(nextState, {
                selectedImportId: imported.importId,
                selectedDocumentId: "selected-import",
                selectedDocumentRef: imported.importRef
              });
              setCommandStatus(`Bundle import staged from ${bundleRef}.`);
            }}
          />
          <SourceIngestPanel
            onSubmit={async (input) => {
              setCommandStatus(`Ingesting source entry for ${input.sourceRef}...`);
              const result = await workspaceService.ingestSourceEntry(input);
              const nextState = await workspaceService.getBootstrapState();
              applyNextState(nextState, {
                selectedCollectionId: result.collectionId,
                selectedDocumentId: "collections-index",
                selectedDocumentRef: nextState.workspaceIndex.indexes.collectionsRef
              });
              setCommandStatus(`Source entry ingested into collection ${result.collectionId}.`);
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
            onOpenDocument={(documentId, pathRef) => {
              setSelectedDocumentId(documentId);
              setSelectedDocumentRef(pathRef);
            }}
          />
          <WorkspaceIndexPanel
            workspaceIndex={state.workspaceIndex}
            onOpenDocument={(documentId, pathRef) => {
              setSelectedDocumentId(documentId);
              setSelectedDocumentRef(pathRef);
            }}
          />
          <ExportInspectorPanel
            exportInspector={state.exportInspector}
            onOpenDocument={(documentId, pathRef) => {
              setSelectedDocumentId(documentId);
              setSelectedDocumentRef(pathRef);
            }}
          />
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
                void (async () => {
                  try {
                    const nextState = await workspaceService.restoreCheckpoint(checkpointId);
                    applyNextState(nextState);
                    setCommandStatus(
                      checkpoint
                        ? `Live workspace restored from checkpoint ${checkpoint.alias}.`
                        : "Live workspace restored from checkpoint."
                    );
                  } catch (error) {
                    setCommandStatus(`Restore checkpoint failed: ${errorMessage(error)}`);
                  }
                })();
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
              setSelectedDocumentId(`ref:${documentRef}`);
              setSelectedDocumentRef(documentRef);
            }}
          />

        <ImportsPanel
          imports={state.imports}
          selectedImportId={selectedImportId}
          importDetail={selectedImportDetail}
          importComparison={selectedImportComparison}
          onSelectImport={setSelectedImportId}
          onActivateImport={(importId) => {
            const selectedImport = state.imports.find((item) => item.id === importId);
            setCommandStatus(
              selectedImport
                ? `Activating import ${selectedImport.id} as the live workspace...`
                : "Activating staged import as the live workspace..."
            );
            void (async () => {
              try {
                const nextState = await workspaceService.activateImportAsLive(importId);
                applyNextState(nextState, {
                  selectedImportId: importId,
                  selectedDocumentId: "strategy",
                  selectedDocumentRef: nextState.assetInspector.strategyRef
                });
                setCommandStatus(
                  selectedImport
                    ? `Import ${selectedImport.id} is now the active live workspace.`
                    : "Staged import activated as the live workspace."
                );
              } catch (error) {
                setCommandStatus(`Activate import failed: ${errorMessage(error)}`);
              }
            })();
          }}
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
