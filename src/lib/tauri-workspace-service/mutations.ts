import type {
  BootstrapState,
  ImportBundleState,
  IngestSourceEntryInput,
  IngestSourceEntryResult,
} from "../service-contract";
import { invoke } from "./invoke";

export const tauriMutationTransport = {
  pauseGlobalAutomation() {
    return invoke<BootstrapState>("pause_global_automation");
  },
  flattenAllPositions() {
    return invoke<BootstrapState>("flatten_all_positions");
  },
  createExportCheckpoint() {
    return invoke<BootstrapState>("create_export_checkpoint");
  },
  exportCheckpoint(checkpointId: string) {
    return invoke<BootstrapState>("export_checkpoint", { checkpointId });
  },
  restoreCheckpoint(checkpointId: string) {
    return invoke<BootstrapState>("restore_checkpoint", { checkpointId });
  },
  activateImportAsLive(importId: string) {
    return invoke<BootstrapState>("activate_import_as_live", { importId });
  },
  ingestSourceEntry(input: IngestSourceEntryInput) {
    return invoke<IngestSourceEntryResult>("ingest_source_entry", { input });
  },
  importExportBundle(bundleRef: string) {
    return invoke<ImportBundleState>("import_export_bundle", { bundleRef });
  },
  runBacktest() {
    return invoke<BootstrapState>("run_backtest");
  },
  runPaperEvaluation() {
    return invoke<BootstrapState>("run_paper_evaluation");
  },
};
