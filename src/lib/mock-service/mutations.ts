import type {
  BootstrapState,
  DecisionEntry,
  ImportBundleState,
  IngestSourceEntryInput,
  IngestSourceEntryResult
} from "../service-contract";
import { MockWorkspaceContext } from "./context";
import {
  buildEvaluationDecision,
  evaluationCollectionRefs,
  evaluationRunRef,
  runMockReplay
} from "./evaluations";
import {
  checkpointPath,
  exportBundlePath,
  mockBlobIdFromText,
  toUtcHourBucket,
  WORKSPACE_ROOT
} from "./paths";
import type { CollectionEntryRecord } from "./types";

function makeDecision(
  context: MockWorkspaceContext,
  kind: string,
  tone: DecisionEntry["tone"],
  headline: string,
  reason: string,
  timestamp: string
): DecisionEntry {
  return {
    id: context.nextId("decision"),
    kind,
    tone,
    headline,
    reason,
    timestamp
  };
}

export async function pauseGlobalAutomation(
  context: MockWorkspaceContext
): Promise<BootstrapState> {
  const timestamp = context.nowLabel();
  context.store.runtimeStatusState = {
    ...context.store.runtimeStatusState,
    mode: "observer",
    automationStatus: "paused",
    statusNote: "Global automation was paused through the service boundary."
  };
  context.prependDecision(
    makeDecision(
      context,
      "Control",
      "warning",
      "Global automation paused",
      "The service layer accepted a pause command, switched the client to observer mode, and preserved the live-centered workspace context for inspection.",
      timestamp
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "pause_global_automation",
    scope: "live",
    status: "succeeded",
    summary: "Global automation paused through the service layer.",
    details:
      "The client requested a pause and the service boundary switched the live lane into observer mode while preserving workspace inspection state.",
    created_at: timestamp,
    related_refs: ["live/live-lane.json", "state/runtime-status.json", "state/decisions.json"]
  });
  context.syncDerivedState();
  return context.snapshot();
}

export async function flattenAllPositions(
  context: MockWorkspaceContext
): Promise<BootstrapState> {
  const checkpointId = context.randomId();
  const timestamp = context.nowLabel();
  context.store.runtimeStatusState = {
    ...context.store.runtimeStatusState,
    automationStatus: "intervention",
    statusNote: "Service-layer intervention flattened all live positions in the mock runtime.",
  };
  context.store.dashboardSeedState = {
    ...context.store.dashboardSeedState,
    metrics: context.store.dashboardSeedState.metrics.map((metric) =>
      metric.label === "Risk Budget"
        ? { ...metric, value: "0%", delta: "Reset after flatten-all intervention" }
        : metric
    )
  };
  context.store.positionsState.current = [];
  context.store.ordersState.current = [];
  context.store.positionsState.events.unshift({
    event_id: context.nextId("lane-event"),
    kind: "flatten-all",
    summary: "All live positions were flattened through the service layer.",
    timestamp
  });
  context.store.ordersState.events.unshift({
    event_id: context.nextId("lane-event"),
    kind: "flatten-all",
    summary: "All live orders were cleared after the flatten-all intervention.",
    timestamp
  });

  context.prependDecision(
    makeDecision(
      context,
      "Intervention",
      "warning",
      "All live positions flattened",
      "The service layer executed a mock flatten-all intervention and reset current positions and orders without bypassing the workspace contract.",
      timestamp
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "flatten_all_positions",
    scope: "live",
    status: "succeeded",
    summary: "Flatten-all intervention reset live positions and orders.",
    details:
      "The service boundary flattened current positions, cleared orders, and captured an incident checkpoint for the intervention.",
    created_at: timestamp,
    related_refs: [
      "state/runtime-status.json",
      "state/dashboard.json",
      "state/positions.json",
      "state/orders.json",
      "state/decisions.json",
      checkpointPath(checkpointId)
    ]
  });

  context.prependCheckpoint({
    id: checkpointId,
    alias: "incident-flatten-all",
    type: "incident",
    typeTone: "danger",
    summary: "Client-triggered flatten-all command captured as an incident checkpoint.",
    createdAt: timestamp,
    performance: "Live risk reset to flat",
    pathRef: checkpointPath(checkpointId)
  });
  context.syncDerivedState();
  return context.snapshot();
}

export async function createExportCheckpoint(
  context: MockWorkspaceContext
): Promise<BootstrapState> {
  const checkpointId = context.randomId();
  const alias = `export-${new Date().toISOString().slice(11, 16).replace(":", "")}`;
  const timestamp = context.nowLabel();

  context.store.runtimeStatusState = {
    ...context.store.runtimeStatusState,
    statusNote: "A fresh export checkpoint was created from the current live-centered asset."
  };

  context.prependCheckpoint({
    id: checkpointId,
    alias,
    type: "export",
    typeTone: "warning",
    summary: "Fresh export checkpoint created before generating a sanitized live-centered bundle.",
    createdAt: timestamp,
    performance: "Export policy sanitized-live-centered",
    pathRef: checkpointPath(checkpointId),
    exportBundleRef: exportBundlePath(checkpointId)
  });
  context.prependDecision(
    makeDecision(
      context,
      "Export",
      "neutral",
      "Export checkpoint created",
      "The service layer created a fresh checkpoint before export so the client can share a stable live-centered asset instead of a drifting mutable state.",
      timestamp
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "create_export_checkpoint",
    scope: "live",
    status: "succeeded",
    summary: `Export checkpoint ${alias} created for sanitized sharing.`,
    details:
      "The service layer created a fresh export checkpoint and materialized a sanitized bundle from the live-centered workspace state.",
    created_at: timestamp,
    related_refs: [
      "state/runtime-status.json",
      checkpointPath(checkpointId),
      exportBundlePath(checkpointId),
      "exports/policy.json"
    ]
  });
  context.syncDerivedState();
  return context.snapshot();
}

export async function exportCheckpoint(
  context: MockWorkspaceContext,
  checkpointId: string
): Promise<BootstrapState> {
  const target = context.state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
  if (!target) {
    throw new Error(`unknown checkpoint: ${checkpointId}`);
  }

  const timestamp = context.nowLabel();
  target.exportBundleRef = exportBundlePath(checkpointId);
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "export_checkpoint",
    scope: "workspace",
    status: "succeeded",
    summary: `Checkpoint ${target.alias} exported as a sanitized bundle.`,
    details:
      "The service layer materialized a sanitized export bundle from an existing checkpoint without mutating the active live lane.",
    created_at: timestamp,
    related_refs: [target.pathRef, exportBundlePath(checkpointId), "exports/policy.json"]
  });
  context.syncDerivedState();
  return context.snapshot();
}

export async function restoreCheckpoint(
  context: MockWorkspaceContext,
  checkpointId: string
): Promise<BootstrapState> {
  const target = context.state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
  if (!target) {
    throw new Error(`unknown checkpoint: ${checkpointId}`);
  }

  const anchorId = context.randomId();
  const timestamp = context.nowLabel();
  context.store.runtimeStatusState = {
    ...context.store.runtimeStatusState,
    statusNote: `Live workspace restored from checkpoint ${target.alias}.`
  };
  context.state = {
    ...context.state,
    workspace: {
      ...context.state.workspace,
      currentCheckpointAlias: target.alias
    }
  };
  context.prependCheckpoint({
    id: anchorId,
    alias: `incident-restore-anchor-${anchorId.slice(0, 8)}`,
    type: "incident",
    typeTone: "danger",
    summary: `Automatic pre-restore checkpoint created before restoring ${target.alias}.`,
    createdAt: timestamp,
    performance: "Rollback anchor for live workspace restore",
    pathRef: checkpointPath(anchorId)
  });
  context.prependDecision(
    makeDecision(
      context,
      "Restore",
      "warning",
      `Restored live workspace from ${target.alias}`,
      "The service layer reapplied the selected checkpoint snapshot as the active live workspace while preserving checkpoint and export history.",
      timestamp
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "restore_checkpoint",
    scope: "live",
    status: "succeeded",
    summary: `Live workspace restored from checkpoint ${target.alias}.`,
    details:
      "The service layer restored the selected checkpoint snapshot as the active live workspace and preserved the rollback anchor as an incident checkpoint.",
    created_at: timestamp,
    related_refs: [
      target.pathRef,
      checkpointPath(anchorId),
      "strategy.json",
      "state/runtime-status.json",
      "state/decisions.json"
    ]
  });
  context.syncDerivedState(target.pathRef, target.alias);
  return context.snapshot();
}

export async function activateImportAsLive(
  context: MockWorkspaceContext,
  importId: string
): Promise<BootstrapState> {
  const record = context.store.importsState.items.find((item) => item.import_id === importId);
  if (!record) {
    throw new Error(`unknown import: ${importId}`);
  }
  const preflight = context.buildImportPreflight(record);
  if (preflight.status !== "ready") {
    throw new Error(`import ${importId} failed activation preflight: ${preflight.summary}`);
  }

  const timestamp = context.nowLabel();
  const rollbackAnchorId = context.randomId();
  const targetCheckpoint =
    context.state.checkpoints.find((checkpoint) => checkpoint.pathRef === record.checkpoint_ref) ?? null;

  context.store.runtimeStatusState = {
    ...context.store.runtimeStatusState,
    statusNote: targetCheckpoint
      ? `Staged import ${importId} is now live and anchored at checkpoint ${targetCheckpoint.alias}.`
      : `Staged import ${importId} is now live.`
  };
  context.prependCheckpoint({
    id: rollbackAnchorId,
    alias: `incident-import-activation-anchor-${rollbackAnchorId.slice(0, 8)}`,
    type: "incident",
    typeTone: "danger",
    summary: `Automatic pre-activation checkpoint created before activating import ${importId}.`,
    createdAt: timestamp,
    performance: "Rollback anchor for staged import activation",
    pathRef: checkpointPath(rollbackAnchorId)
  });
  context.prependDecision(
    makeDecision(
      context,
      "Import",
      "neutral",
      `Activated import ${importId} as live`,
      "The service layer promoted a staged import into the live workspace while preserving checkpoint and operation history inside the mock runtime.",
      timestamp
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "activate_import_as_live",
    scope: "live",
    status: "succeeded",
    summary: `Activated staged import ${importId} as the current live workspace.`,
    details:
      "The service layer replaced live-facing workspace state with the staged import and kept service-owned roots intact.",
    created_at: timestamp,
    related_refs: [
      `imports/items/${importId}/import.json`,
      targetCheckpoint?.pathRef.replace(`${WORKSPACE_ROOT}/`, "") ?? "strategy.json",
      "strategy.json",
      "state/runtime-status.json",
      checkpointPath(rollbackAnchorId).replace(`${WORKSPACE_ROOT}/`, "")
    ]
  });

  if (targetCheckpoint) {
    context.syncDerivedState(targetCheckpoint.pathRef, targetCheckpoint.alias);
  } else {
    context.syncDerivedState();
  }
  return context.snapshot();
}

export async function ingestSourceEntry(
  context: MockWorkspaceContext,
  input: IngestSourceEntryInput
): Promise<IngestSourceEntryResult> {
  const payload = input.bodyText ?? input.preview;
  if (!payload) {
    throw new Error("Mock ingest requires bodyText or preview");
  }

  const timeBucket = toUtcHourBucket(input.eventTime);
  const existing = context.store.collectionsState.items.find(
    (item) =>
      item.kind === input.kind &&
      item.source_ref === input.sourceRef &&
      item.time_bucket === timeBucket
  );
  const collectionId = existing?.collection_id ?? `mock-${context.randomId()}`;
  const createdCollection = !existing;
  const blobId = mockBlobIdFromText(payload);

  if (!context.store.blobContents[blobId]) {
    context.store.blobContents[blobId] = payload;
  }
  if (!context.store.entriesByCollection[collectionId]) {
    context.store.entriesByCollection[collectionId] = [];
  }

  const entry: CollectionEntryRecord = {
    entry_id: context.randomId(),
    source_ref: input.sourceRef,
    event_time: input.eventTime,
    ingested_at: input.ingestedAt,
    content_hash: blobId,
    blob_ref: blobId,
    preview: input.preview
  };
  context.store.entriesByCollection[collectionId].push(entry);

  const entries = context.store.entriesByCollection[collectionId];
  const nextTimeRange = {
    start: entries[0]?.event_time ?? input.eventTime,
    end: entries[entries.length - 1]?.event_time ?? input.eventTime
  };

  if (existing) {
    existing.entry_count = entries.length;
    existing.content_hash = blobId;
    existing.time_range = nextTimeRange;
  } else {
    context.store.collectionsState.items.unshift({
      collection_id: collectionId,
      kind: input.kind,
      source_ref: input.sourceRef,
      time_bucket: timeBucket,
      time_range: nextTimeRange,
      entry_count: 1,
      content_hash: blobId,
      path_ref: `../collections/items/${collectionId}/collection.json`
    });
  }

  context.prependOperation({
    operation_id: context.randomId(),
    kind: "ingest_source_entry",
    scope: "workspace",
    status: "succeeded",
    summary: `Ingested ${input.sourceRef} into collection ${collectionId}.`,
    details:
      "The service layer materialized a source-centered collection shard, appended an entry NDJSON record, and persisted an immutable blob for the entry body.",
    created_at: context.nowLabel(),
    related_refs: [
      `collections/items/${collectionId}/collection.json`,
      `collections/items/${collectionId}/entries.ndjson`,
      `blobs/${blobId.replace(":", "/")}.txt`
    ]
  });
  context.syncDerivedState();

  return {
    collectionId,
    collectionRef: `${WORKSPACE_ROOT}/collections/items/${collectionId}/collection.json`,
    entryId: entry.entry_id,
    entryShardRef: `${WORKSPACE_ROOT}/collections/items/${collectionId}/entries.ndjson`,
    timeBucket,
    entryCount: entries.length,
    blobId,
    createdCollection
  };
}

export async function importExportBundle(
  context: MockWorkspaceContext,
  bundleRef: string
): Promise<ImportBundleState> {
  const importId = context.randomId();
  const importedAt = context.nowLabel();
  const record = {
    import_id: importId,
    imported_at: importedAt,
    source_bundle_ref: bundleRef,
    bundle_ref: "./bundle/export.json",
    workspace_ref: "./workspace",
    checkpoint_ref: context.state.assetInspector.currentCheckpointRef,
    policy_id: context.store.exportPolicy.policy_id,
    sanitized: true
  };

  context.store.importsState.items.unshift(record);
  context.prependDecision(
    makeDecision(
      context,
      "Import",
      "neutral",
      "Sanitized export staged as import",
      "The service layer staged a sanitized export bundle into the workspace imports area without mutating the active live workspace.",
      importedAt
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: "import_export_bundle",
    scope: "workspace",
    status: "succeeded",
    summary: `Staged sanitized export bundle as import ${importId}.`,
    details:
      "The service layer copied a sanitized export bundle into the workspace imports area without mutating the active live lane.",
    created_at: importedAt,
    related_refs: [
      `imports/items/${importId}/import.json`,
      `imports/items/${importId}/bundle/export.json`,
      `imports/items/${importId}/workspace`
    ]
  });
  context.syncDerivedState();

  return {
    importId,
    importedAt,
    sourceBundleRef: bundleRef,
    importRef: `${WORKSPACE_ROOT}/imports/items/${importId}/import.json`,
    workspaceRef: `${WORKSPACE_ROOT}/imports/items/${importId}/workspace`,
    checkpointRef: record.checkpoint_ref,
    policyId: record.policy_id,
    sanitized: record.sanitized
  };
}

async function runEvaluation(
  context: MockWorkspaceContext,
  kind: "backtest" | "paper"
): Promise<BootstrapState> {
  const timestamp = context.nowLabel();
  const runId = context.randomId();
  const replay = runMockReplay(kind, context.store.dashboardSeedState.priceSeries);
  const adapterId = "01963a00-1111-7111-8111-111111111111";
  const adapterRef = `${WORKSPACE_ROOT}/adapters/items/${adapterId}/adapter.json`;
  const collectionRefs = evaluationCollectionRefs(context.store);

  context.store.evaluationsState.items.unshift({
    run_id: runId,
    kind,
    status: "completed",
    headline: replay.headline,
    summary: replay.summary,
    created_at: timestamp,
    adapter_ref: adapterRef,
    adapter_name: "simulated-exchange",
    collection_refs: collectionRefs,
    gross_pnl: replay.grossPnl,
    fee_cost: replay.feeCost,
    slippage_cost: replay.slippageCost,
    model_cost: replay.modelCost,
    net_pnl: replay.netPnl,
    trade_count: replay.tradeCount,
    position_count: replay.positionCount,
    path_ref: evaluationRunRef(runId),
    equity_curve: replay.equityCurve,
    trades: replay.trades.map((trade) => ({
      symbol: trade.symbol,
      side: trade.side,
      entry_time: trade.entryTime,
      exit_time: trade.exitTime,
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      net_pnl: trade.netPnl
    })),
    notes: replay.notes
  });
  context.store.evalSummariesState.summaries.unshift({
    summary_id: runId,
    headline: replay.headline,
    created_at: timestamp,
    path_ref: `../eval-summaries/items/${runId}/summary.json`,
    evidence_refs: [evaluationRunRef(runId), ...collectionRefs]
  });
  context.prependDecision(
    buildEvaluationDecision(
      context.nextId("decision"),
      kind,
      replay.headline,
      replay.summary,
      timestamp,
      replay.netPnl >= 0 ? "positive" : "warning"
    )
  );
  context.prependOperation({
    operation_id: context.randomId(),
    kind: kind === "backtest" ? "run_backtest" : "run_paper_evaluation",
    scope: "workspace",
    status: "succeeded",
    summary: `${kind === "backtest" ? "Backtest" : "Paper replay"} completed via simulated exchange adapter.`,
    details:
      "The service layer persisted an evaluation run, linked the result into live evaluation summaries, and kept raw evidence refs for replay.",
    created_at: timestamp,
    related_refs: [
      evaluationRunRef(runId),
      `${WORKSPACE_ROOT}/evaluations/index.json`,
      `${WORKSPACE_ROOT}/state/eval-summaries.json`,
      `${WORKSPACE_ROOT}/state/decisions.json`,
      ...collectionRefs
    ]
  });
  context.syncDerivedState();
  return context.snapshot();
}

export async function runBacktest(
  context: MockWorkspaceContext
): Promise<BootstrapState> {
  return runEvaluation(context, "backtest");
}

export async function runPaperEvaluation(
  context: MockWorkspaceContext
): Promise<BootstrapState> {
  return runEvaluation(context, "paper");
}
