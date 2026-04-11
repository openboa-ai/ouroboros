import type { WorkspaceService } from "../service-contract";
import { tauriMutationTransport } from "./mutations";
import { tauriQueryTransport } from "./queries";

class TauriWorkspaceService implements WorkspaceService {
  getBootstrapState() {
    return tauriQueryTransport.getBootstrapState();
  }

  getCheckpointDetail(checkpointId: string) {
    return tauriQueryTransport.getCheckpointDetail(checkpointId);
  }

  getCheckpointComparison(baseCheckpointId: string, targetCheckpointId: string) {
    return tauriQueryTransport.getCheckpointComparison(baseCheckpointId, targetCheckpointId);
  }

  getCollectionDetail(collectionId: string) {
    return tauriQueryTransport.getCollectionDetail(collectionId);
  }

  getImportDetail(importId: string) {
    return tauriQueryTransport.getImportDetail(importId);
  }

  getImportComparison(importId: string) {
    return tauriQueryTransport.getImportComparison(importId);
  }

  getBlobDetail(blobId: string) {
    return tauriQueryTransport.getBlobDetail(blobId);
  }

  getEvaluationRunDetail(runId: string) {
    return tauriQueryTransport.getEvaluationRunDetail(runId);
  }

  getOperationDetail(operationId: string) {
    return tauriQueryTransport.getOperationDetail(operationId);
  }

  getWorkspaceDocument(documentRef: string) {
    return tauriQueryTransport.getWorkspaceDocument(documentRef);
  }

  searchWorkspace(query: string) {
    return tauriQueryTransport.searchWorkspace(query);
  }

  pauseGlobalAutomation() {
    return tauriMutationTransport.pauseGlobalAutomation();
  }

  flattenAllPositions() {
    return tauriMutationTransport.flattenAllPositions();
  }

  createExportCheckpoint() {
    return tauriMutationTransport.createExportCheckpoint();
  }

  exportCheckpoint(checkpointId: string) {
    return tauriMutationTransport.exportCheckpoint(checkpointId);
  }

  restoreCheckpoint(checkpointId: string) {
    return tauriMutationTransport.restoreCheckpoint(checkpointId);
  }

  activateImportAsLive(importId: string) {
    return tauriMutationTransport.activateImportAsLive(importId);
  }

  ingestSourceEntry(input: Parameters<WorkspaceService["ingestSourceEntry"]>[0]) {
    return tauriMutationTransport.ingestSourceEntry(input);
  }

  importExportBundle(bundleRef: string) {
    return tauriMutationTransport.importExportBundle(bundleRef);
  }

  runBacktest() {
    return tauriMutationTransport.runBacktest();
  }

  runPaperEvaluation() {
    return tauriMutationTransport.runPaperEvaluation();
  }
}

export const tauriWorkspaceService = new TauriWorkspaceService();
