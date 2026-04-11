import { startTransition, useEffect, useRef, useState } from "react";
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
} from "../lib/service-contract";
import { workspaceService } from "../lib/service-gateway";
import type { ApplyNextStateOptions } from "./workspace-controller-types";
import { useWorkspaceActions } from "./use-workspace-actions";

export function useWorkspaceController() {
  const refreshInFlightRef = useRef(false);
  const [state, setState] = useState<BootstrapState | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
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
    options?: ApplyNextStateOptions
  ) {
    const preserveDetailState = options?.preserveDetailState ?? false;
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
    const checkpointChanged = nextCheckpointId !== selectedCheckpointId;
    const collectionChanged = nextCollectionId !== selectedCollectionId;
    const importChanged = nextImportId !== selectedImportId;
    const operationChanged = nextOperationId !== selectedOperationId;
    const documentChanged =
      nextDocumentId !== selectedDocumentId || nextDocumentRef !== selectedDocumentRef;
    const shouldClearSearchResults = !preserveDetailState || !workspaceSearchQuery.trim();

    startTransition(() => {
      setState(nextState);
      setLastSyncedAt(new Date().toISOString());
      if (!preserveDetailState) {
        setDetailErrors({});
      }
      if (preserveDetailState) {
        setDetailRefreshVersion((current) => current + 1);
      }
      setSelectedCheckpointId(nextCheckpointId);
      if (!preserveDetailState || checkpointChanged) {
        setSelectedCheckpointDetail(null);
        setSelectedCheckpointComparison(null);
      }
      setSelectedCollectionId(nextCollectionId);
      if (!preserveDetailState || collectionChanged) {
        setSelectedCollectionDetail(null);
      }
      setSelectedImportId(nextImportId);
      if (!preserveDetailState || importChanged) {
        setSelectedImportDetail(null);
        setSelectedImportComparison(null);
      }
      setSelectedBlobId(null);
      if (!preserveDetailState || collectionChanged) {
        setSelectedBlobDetail(null);
      }
      setSelectedOperationId(nextOperationId);
      if (!preserveDetailState || operationChanged) {
        setSelectedOperationDetail(null);
      }
      setSelectedDocumentId(nextDocumentId);
      setSelectedDocumentRef(nextDocumentRef);
      if (!preserveDetailState || documentChanged) {
        setSelectedDocumentDetail(null);
      }
      if (shouldClearSearchResults) {
        setWorkspaceSearchResults(null);
      }
    });
  }

  async function loadBootstrapState() {
    setBootstrapError(null);
    try {
      const nextState = await workspaceService.getBootstrapState();
      applyNextState(nextState);
    } catch (error) {
      setBootstrapError(`Failed to boot workspace: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function refreshWorkspace(options?: { silent?: boolean }) {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    try {
      const nextState = await workspaceService.getBootstrapState();
      setBootstrapError(null);
      applyNextState(nextState, {
        preserveDetailState: true
      });
      if (!options?.silent) {
        setCommandStatus("Workspace refreshed through the service layer.");
      }
    } catch (error) {
      if (!options?.silent) {
        setCommandStatus(
          `Workspace refresh failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      setBootstrapError(
        (current) =>
          current ??
          `Failed to refresh workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      refreshInFlightRef.current = false;
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
        setBootstrapError(
          `Failed to boot workspace: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshWorkspace({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timer);
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
          setDetailError(
            "checkpoint",
            `Checkpoint detail failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCheckpointId, detailRefreshVersion]);

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
            `Checkpoint comparison failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, selectedCheckpointId, detailRefreshVersion]);

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
          setDetailError(
            "collection",
            `Collection detail failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCollectionId, detailRefreshVersion]);

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
          setDetailError(
            "import",
            `Import detail failed: ${error instanceof Error ? error.message : String(error)}`
          );
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
            `Import comparison failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedImportId, detailRefreshVersion]);

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
          setDetailError(
            "blob",
            `Blob detail failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBlobId, detailRefreshVersion]);

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
          setDetailError(
            "operation",
            `Operation detail failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedOperationId, detailRefreshVersion]);

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
          setDetailError(
            "document",
            `Workspace document failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDocumentRef, detailRefreshVersion]);

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
          setDetailError(
            "search",
            `Workspace search failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceSearchQuery, state]);

  const serviceAlerts = Object.entries(detailErrors)
    .filter(([, message]) => Boolean(message))
    .map(([scope, message]) => ({
      scope,
      message: message as string
    }));

  const actions = useWorkspaceActions({
    state,
    setCommandStatus,
    applyNextState
  });

  return {
    state,
    bootstrapError,
    commandStatus,
    lastSyncedAt,
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
    refreshWorkspace,
    openWorkspaceDocument,
    selectDocument(documentId: string, pathRef: string) {
      setSelectedDocumentId(documentId);
      setSelectedDocumentRef(pathRef);
    },
    ...actions
  };
}
