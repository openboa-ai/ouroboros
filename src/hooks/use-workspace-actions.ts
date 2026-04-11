import type { Dispatch, SetStateAction } from "react";
import type { BootstrapState, IngestSourceEntryInput } from "../lib/service-contract";
import { workspaceService } from "../lib/service-gateway";
import type { ApplyNextStateFn } from "./workspace-controller-types";

type UseWorkspaceActionsParams = {
  state: BootstrapState | null;
  setCommandStatus: Dispatch<SetStateAction<string | null>>;
  applyNextState: ApplyNextStateFn;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function latestOperationSelection(nextState: BootstrapState) {
  return nextState.operations[0]?.id ?? null;
}

function latestOperationDocumentRef(nextState: BootstrapState) {
  return nextState.operations[0]?.operationRef ?? nextState.assetInspector.strategyRef;
}

function latestEvaluationSelection(nextState: BootstrapState) {
  return nextState.evaluationRuns[0]?.id ?? null;
}

function latestEvaluationDocumentRef(nextState: BootstrapState) {
  return nextState.evaluationRuns[0]?.pathRef ?? nextState.assetInspector.strategyRef;
}

export function useWorkspaceActions({
  state,
  setCommandStatus,
  applyNextState
}: UseWorkspaceActionsParams) {
  async function runAction(startingStatus: string, action: () => Promise<void>) {
    setCommandStatus(startingStatus);
    try {
      await action();
    } catch (error) {
      setCommandStatus(errorMessage(error));
    }
  }

  return {
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
    async runBacktest() {
      await runAction("Running backtest...", async () => {
        const nextState = await workspaceService.runBacktest();
        applyNextState(nextState, {
          selectedEvaluationRunId: latestEvaluationSelection(nextState),
          selectedOperationId: latestOperationSelection(nextState),
          selectedDocumentId: "latest-evaluation-run",
          selectedDocumentRef: latestEvaluationDocumentRef(nextState)
        });
        const latestRun = nextState.evaluationRuns[0];
        setCommandStatus(
          latestRun
            ? `Backtest completed. ${latestRun.tradeCount} trades, net PnL ${latestRun.netPnl.toFixed(2)}.`
            : "Backtest completed."
        );
      });
    },
    async runPaperEvaluation() {
      await runAction("Running paper evaluation...", async () => {
        const nextState = await workspaceService.runPaperEvaluation();
        applyNextState(nextState, {
          selectedEvaluationRunId: latestEvaluationSelection(nextState),
          selectedOperationId: latestOperationSelection(nextState),
          selectedDocumentId: "latest-evaluation-run",
          selectedDocumentRef: latestEvaluationDocumentRef(nextState)
        });
        const latestRun = nextState.evaluationRuns[0];
        setCommandStatus(
          latestRun
            ? `Paper evaluation completed. ${latestRun.tradeCount} trades, net PnL ${latestRun.netPnl.toFixed(2)}.`
            : "Paper evaluation completed."
        );
      });
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
