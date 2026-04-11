import type {
  BootstrapState,
  CheckpointSummary,
  DecisionEntry,
  ImportPreflightCheckState,
  ImportPreflightState
} from "../service-contract";
import { buildDerivedState, buildTemplateBootstrapState } from "./builders";
import { resolveMockDocumentContent } from "./document-content";
import { checkpointPath } from "./paths";
import { createMockWorkspaceStore } from "./template-store";
import type {
  ImportRecord,
  MockWorkspaceStore,
  OperationRecord
} from "./types";

export class MockWorkspaceContext {
  readonly store: MockWorkspaceStore = createMockWorkspaceStore();
  private currentState: BootstrapState = buildTemplateBootstrapState(this.store);

  get state(): BootstrapState {
    return this.currentState;
  }

  set state(nextState: BootstrapState) {
    this.currentState = nextState;
  }

  snapshot(): BootstrapState {
    return structuredClone(this.currentState);
  }

  randomId() {
    return crypto.randomUUID();
  }

  buildImportPreflight(record: ImportRecord): ImportPreflightState {
    const checkpointExists = this.currentState.checkpoints.some(
      (checkpoint) => checkpoint.pathRef === record.checkpoint_ref
    );
    const checks: ImportPreflightCheckState[] = [
      {
        id: "sanitized-bundle",
        severity: record.sanitized ? "ok" : "blocked",
        label: "Sanitized bundle",
        detail: record.sanitized
          ? "Import bundle is marked sanitized and can be considered for live activation."
          : "Import bundle is not sanitized and must never become live."
      },
      {
        id: "strategy-entrypoint",
        severity: "ok",
        label: "strategy.json entrypoint",
        detail: "Mock imports always carry a strategy entrypoint and workspace root."
      },
      {
        id: "live-lane-ref",
        severity: "ok",
        label: "Live lane ref",
        detail: "Mock staged imports always include a live lane reference."
      },
      {
        id: "runtime-status-ref",
        severity: "ok",
        label: "Runtime status ref",
        detail: "Mock staged imports always include the authoritative runtime control-state document."
      },
      {
        id: "export-policy-ref",
        severity: "ok",
        label: "Export policy ref",
        detail: "Mock staged imports always include an export policy reference."
      },
      {
        id: "checkpoint-ref",
        severity: checkpointExists ? "ok" : "warning",
        label: "Checkpoint ref",
        detail: checkpointExists
          ? "Imported checkpoint ref resolves to a local checkpoint."
          : "Imported checkpoint ref would require the service layer to anchor a fresh local incident checkpoint."
      }
    ];

    const blockedCount = checks.filter((check) => check.severity === "blocked").length;
    const warningCount = checks.filter((check) => check.severity === "warning").length;

    return {
      status: blockedCount > 0 ? "blocked" : "ready",
      summary:
        blockedCount > 0
          ? `${blockedCount} blocking issue(s) and ${warningCount} warning(s) must be resolved before activation.`
          : warningCount > 0
            ? `Activation is ready with ${warningCount} warning(s); the service layer will compensate where possible.`
            : "Activation is ready. Import manifest passed service-owned preflight.",
      checks
    };
  }

  prependCheckpoint(checkpoint: CheckpointSummary) {
    this.currentState = {
      ...this.currentState,
      workspace: {
        ...this.currentState.workspace,
        currentCheckpointAlias: checkpoint.alias
      },
      checkpoints: [checkpoint, ...this.currentState.checkpoints]
    };
  }

  prependDecision(decision: DecisionEntry) {
    this.store.decisionsState.decisions.unshift(decision);
  }

  prependOperation(operation: OperationRecord) {
    this.store.operationsState.items.unshift(operation);
  }

  syncDerivedState(currentCheckpointRef?: string, currentCheckpointAlias?: string) {
    const resolvedCheckpointRef =
      currentCheckpointRef ??
      this.currentState.checkpoints[0]?.pathRef ??
      checkpointPath(this.store.checkpointIndexSeed.current.checkpoint_id);
    const resolvedCheckpointAlias =
      currentCheckpointAlias ??
      this.currentState.workspace.currentCheckpointAlias ??
      this.store.checkpointIndexSeed.current.alias;
    const checkpoints = this.currentState.checkpoints;
    const derived = buildDerivedState(this.store, checkpoints, resolvedCheckpointRef);

    this.currentState = {
      ...this.currentState,
      ...this.store.runtimeStatusState,
      ...this.store.dashboardSeedState,
      workspace: {
        ...this.currentState.workspace,
        currentCheckpointAlias: resolvedCheckpointAlias
      },
      assetInspector: derived.assetInspector,
      workspaceIndex: derived.workspaceIndex,
      runtimeTopology: derived.runtimeTopology,
      liveContext: derived.liveContext,
      exportInspector: derived.exportInspector,
      adapters: derived.adapters,
      positions: structuredClone(this.store.positionsState.current),
      orders: structuredClone(this.store.ordersState.current),
      laneEvents: derived.laneEvents,
      decisions: structuredClone(this.store.decisionsState.decisions),
      checkpoints,
      collections: derived.collections,
      evaluationRuns: derived.evaluationRuns,
      imports: derived.imports,
      operations: derived.operations,
      documentCatalog: derived.documentCatalog
    };
  }

  nextId(prefix: string) {
    return `${prefix}-${this.randomId()}`;
  }

  nowLabel() {
    return `UTC ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  }

  resolveDocumentContent(documentRef: string) {
    return resolveMockDocumentContent(this.store, this.currentState, documentRef);
  }
}
