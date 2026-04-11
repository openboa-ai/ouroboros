import { startTransition, useEffect, useState } from "react";
import type {
  BlobDetailState,
  BootstrapState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CollectionDetailState,
  ImportDetailState,
  ImportComparisonState,
  IngestSourceEntryInput,
  OperationDetailState,
  WorkspaceCatalogEntry,
  WorkspaceDocumentState,
  WorkspaceSearchResultState
} from "../lib/service-contract";
import { workspaceService } from "../lib/service-gateway";

export function useWorkspaceController() {
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

  function setDetailError(scope: string, message: string | null) {
    startTransition(() => {
      setDetailErrors((current) => ({
        ...current,
        [scope]: message
      }));
    });
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

  function latestOperationSelection(nextState: BootstrapState) {
    return nextState.operations[0]?.id ?? null;
  }

  function latestOperationDocumentRef(nextState: BootstrapState) {
    return nextState.operations[0]?.operationRef ?? nextState.assetInspector.strategyRef;
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

  function openWorkspaceDocument(documentId: string, pathRef: string) {
    setSelectedDocumentId(documentId);
    setSelectedDocumentRef(pathRef);
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
        if (!cancelled) {
          setDetailError("checkpoint", `Checkpoint detail failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError(
            "checkpointComparison",
            `Checkpoint comparison failed: ${errorMessage(error)}`
          );
        }
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
        if (!cancelled) {
          setDetailError("collection", `Collection detail failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError("import", `Import detail failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError(
            "importComparison",
            `Import comparison failed: ${errorMessage(error)}`
          );
        }
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
        if (!cancelled) {
          setDetailError("blob", `Blob detail failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError("operation", `Operation detail failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError("document", `Workspace document failed: ${errorMessage(error)}`);
        }
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
        if (!cancelled) {
          setDetailError("search", `Workspace search failed: ${errorMessage(error)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceSearchQuery, state]);

  async function runAction(
    startingStatus: string,
    action: () => Promise<void>
  ) {
    setCommandStatus(startingStatus);
    try {
      await action();
    } catch (error) {
      setCommandStatus(errorMessage(error));
    }
  }

  const serviceAlerts = Object.entries(detailErrors)
    .filter(([, message]) => Boolean(message))
    .map(([scope, message]) => ({
      scope,
      message: message as string
    }));

  return {
    state,
    bootstrapError,
    commandStatus,
    serviceAlerts,
    selections: {
      selectedCheckpointId,
      selectedCollectionId,
      selectedImportId,
      selectedOperationId,
      selectedDocumentId,
      selectedBlobId,
      workspaceSearchQuery
    },
    detailState: {
      selectedCheckpointDetail,
      selectedCheckpointComparison,
      selectedCollectionDetail,
      selectedImportDetail,
      selectedImportComparison,
      selectedBlobDetail,
      selectedOperationDetail,
      selectedDocumentDetail,
      workspaceSearchResults
    },
    workspaceDocuments: (state?.documentCatalog ?? []) as WorkspaceCatalogEntry[],
    setSelectedCheckpointId,
    setSelectedCollectionId,
    setSelectedImportId,
    setSelectedOperationId,
    setSelectedBlobId,
    setWorkspaceSearchQuery,
    loadBootstrapState,
    openWorkspaceDocument,
    selectDocument(documentId: string, pathRef: string) {
      setSelectedDocumentId(documentId);
      setSelectedDocumentRef(pathRef);
    },
    async flattenAllPositions() {
      await runAction("Flattening positions...", async () => {
        const nextState = await workspaceService.flattenAllPositions();
        applyNextState(nextState, {
          selectedOperationId: latestOperationSelection(nextState),
          selectedDocumentId: "latest-operation",
          selectedDocumentRef: latestOperationDocumentRef(nextState)
        });
        setCommandStatus("All positions flattened through the service layer.");
      });
    },
    async pauseGlobalAutomation() {
      await runAction("Pausing automation...", async () => {
        const nextState = await workspaceService.pauseGlobalAutomation();
        applyNextState(nextState, {
          selectedOperationId: latestOperationSelection(nextState),
          selectedDocumentId: "latest-operation",
          selectedDocumentRef: latestOperationDocumentRef(nextState)
        });
        setCommandStatus("Global automation paused. Client is now in observer mode.");
      });
    },
    async createExportCheckpoint() {
      await runAction("Creating export checkpoint...", async () => {
        const nextState = await workspaceService.createExportCheckpoint();
        applyNextState(nextState, {
          selectedOperationId: latestOperationSelection(nextState),
          selectedDocumentId: "latest-operation",
          selectedDocumentRef: latestOperationDocumentRef(nextState)
        });
        setCommandStatus("Fresh export checkpoint created from the live-centered asset.");
      });
    },
    async stageBundleImport(bundleRef: string) {
      await runAction(`Staging bundle import from ${bundleRef}...`, async () => {
        const imported = await workspaceService.importExportBundle(bundleRef);
        const nextState = await workspaceService.getBootstrapState();
        applyNextState(nextState, {
          selectedOperationId: latestOperationSelection(nextState),
          selectedImportId: imported.importId,
          selectedDocumentId: "selected-import",
          selectedDocumentRef: imported.importRef
        });
        setCommandStatus(`Bundle import staged from ${bundleRef}.`);
      });
    },
    async ingestSourceEntry(input: IngestSourceEntryInput) {
      await runAction(`Ingesting source entry for ${input.sourceRef}...`, async () => {
        const result = await workspaceService.ingestSourceEntry(input);
        const nextState = await workspaceService.getBootstrapState();
        applyNextState(nextState, {
          selectedOperationId: latestOperationSelection(nextState),
          selectedCollectionId: result.collectionId,
          selectedDocumentId: "collections-index",
          selectedDocumentRef: nextState.workspaceIndex.indexes.collectionsRef
        });
        setCommandStatus(`Source entry ingested into collection ${result.collectionId}.`);
      });
    },
    async exportCheckpoint(checkpointId: string) {
      const checkpoint = state?.checkpoints.find((item) => item.id === checkpointId);
      await runAction(
        checkpoint ? `Exporting checkpoint ${checkpoint.alias}...` : "Exporting checkpoint...",
        async () => {
          const nextState = await workspaceService.exportCheckpoint(checkpointId);
          applyNextState(nextState, {
            selectedOperationId: latestOperationSelection(nextState),
            selectedCheckpointId: checkpointId,
            selectedDocumentId: "selected-checkpoint",
            selectedDocumentRef:
              nextState.checkpoints.find((item) => item.id === checkpointId)?.pathRef ??
              nextState.assetInspector.currentCheckpointRef
          });
          setCommandStatus(
            checkpoint
              ? `Checkpoint ${checkpoint.alias} exported as a sanitized bundle.`
              : "Checkpoint exported as a sanitized bundle."
          );
        }
      );
    },
    async restoreCheckpoint(checkpointId: string) {
      const checkpoint = state?.checkpoints.find((item) => item.id === checkpointId);
      await runAction(
        checkpoint ? `Restoring checkpoint ${checkpoint.alias}...` : "Restoring checkpoint...",
        async () => {
          const nextState = await workspaceService.restoreCheckpoint(checkpointId);
          applyNextState(nextState, {
            selectedOperationId: latestOperationSelection(nextState),
            selectedDocumentId: "latest-operation",
            selectedDocumentRef: latestOperationDocumentRef(nextState)
          });
          setCommandStatus(
            checkpoint
              ? `Live workspace restored from checkpoint ${checkpoint.alias}.`
              : "Live workspace restored from checkpoint."
          );
        }
      );
    },
    async activateImport(importId: string) {
      const selectedImport = state?.imports.find((item) => item.id === importId);
      await runAction(
        selectedImport
          ? `Activating import ${selectedImport.id} as the live workspace...`
          : "Activating staged import as the live workspace...",
        async () => {
          const nextState = await workspaceService.activateImportAsLive(importId);
          applyNextState(nextState, {
            selectedOperationId: latestOperationSelection(nextState),
            selectedImportId: importId,
            selectedDocumentId: "strategy",
            selectedDocumentRef: nextState.assetInspector.strategyRef
          });
          setCommandStatus(
            selectedImport
              ? `Import ${selectedImport.id} is now the active live workspace.`
              : "Staged import activated as the live workspace."
          );
        }
      );
    }
  };
}
