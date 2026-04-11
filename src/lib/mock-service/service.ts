import type {
  BootstrapState,
  CheckpointComparisonState,
  CheckpointDetailState,
  CheckpointSummary,
  CollectionDetailState,
  DecisionEntry,
  ExportBundleState,
  ImportBundleState,
  ImportComparisonState,
  ImportDetailState,
  ImportPreflightCheckState,
  ImportPreflightState,
  IngestSourceEntryInput,
  IngestSourceEntryResult,
  OperationDetailState,
  WorkspaceDocumentState,
  WorkspaceSearchResultState,
  WorkspaceService
} from "../service-contract";
import {
  buildDerivedState,
  buildDocumentBacklinks,
  buildExportBundle,
  buildTemplateBootstrapState,
  compareWorkspaceRefs
} from "./builders";
import { resolveMockDocumentContent } from "./document-content";
import {
  checkpointPath,
  collectionEntryPath,
  CURRENT_WORKSPACE_FILE_REFS,
  exportBundlePath,
  mockBlobIdFromText,
  operationPath,
  toUtcHourBucket,
  WORKSPACE_ROOT
} from "./paths";
import { createMockWorkspaceStore } from "./template-store";
import type {
  CollectionEntryRecord,
  ImportRecord,
  MockWorkspaceStore,
  OperationRecord
} from "./types";

export class MockWorkspaceService implements WorkspaceService {
  private readonly store: MockWorkspaceStore = createMockWorkspaceStore();
  private state: BootstrapState = buildTemplateBootstrapState(this.store);

  private buildImportPreflight(record: ImportRecord): ImportPreflightState {
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
        id: "export-policy-ref",
        severity: "ok",
        label: "Export policy ref",
        detail: "Mock staged imports always include an export policy reference."
      },
      {
        id: "checkpoint-ref",
        severity: this.state.checkpoints.some((checkpoint) => checkpoint.pathRef === record.checkpoint_ref)
          ? "ok"
          : "warning",
        label: "Checkpoint ref",
        detail: this.state.checkpoints.some((checkpoint) => checkpoint.pathRef === record.checkpoint_ref)
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

  async getBootstrapState(): Promise<BootstrapState> {
    return structuredClone(this.state);
  }

  async getCheckpointDetail(checkpointId: string): Promise<CheckpointDetailState> {
    const checkpoint =
      this.state.checkpoints.find((item) => item.id === checkpointId) ?? this.state.checkpoints[0];

    return {
      id: checkpoint.id,
      alias: checkpoint.alias,
      type: checkpoint.type,
      typeTone: checkpoint.typeTone,
      summary: checkpoint.summary,
      createdAt: checkpoint.createdAt,
      performance: checkpoint.performance,
      checkpointRef: checkpoint.pathRef,
      snapshotWorkspaceRef: `${WORKSPACE_ROOT}/checkpoints/items/${checkpoint.id}/workspace`,
      workspaceFileRefs: CURRENT_WORKSPACE_FILE_REFS.map((pathRef) =>
        pathRef.replace(WORKSPACE_ROOT, `${WORKSPACE_ROOT}/checkpoints/items/${checkpoint.id}/workspace`)
      ),
      exportBundle:
        checkpoint.type === "export" && checkpoint.exportBundleRef
          ? buildExportBundle(this.store, checkpoint)
          : null
    };
  }

  async getCheckpointComparison(
    baseCheckpointId: string,
    targetCheckpointId: string
  ): Promise<CheckpointComparisonState> {
    const base = await this.getCheckpointDetail(baseCheckpointId);
    const target = await this.getCheckpointDetail(targetCheckpointId);
    const baseFiles = new Set(base.workspaceFileRefs);
    const targetFiles = new Set(target.workspaceFileRefs);
    const fileKeys = new Set<string>([...baseFiles, ...targetFiles]);
    const files: CheckpointComparisonState["files"] = [];
    let changedCount = 0;
    let addedCount = 0;
    let removedCount = 0;

    for (const fullRef of fileKeys) {
      const baseHas = baseFiles.has(fullRef);
      const targetHas = targetFiles.has(fullRef);
      const relativePath = fullRef
        .replace(`${base.snapshotWorkspaceRef}/`, "")
        .replace(`${target.snapshotWorkspaceRef}/`, "");

      let status: "added" | "removed" | "changed" | null = null;
      if (baseHas && targetHas) {
        const baseContent = this.resolveDocumentContent(fullRef);
        const targetRef = fullRef.replace(base.snapshotWorkspaceRef, target.snapshotWorkspaceRef);
        const targetContent = this.resolveDocumentContent(targetRef);
        if (baseContent !== targetContent) {
          status = "changed";
          changedCount += 1;
          files.push({ relativePath, status, baseRef: fullRef, targetRef });
        }
        continue;
      }
      if (baseHas) {
        status = "removed";
        removedCount += 1;
      } else if (targetHas) {
        status = "added";
        addedCount += 1;
      }

      if (status) {
        files.push({
          relativePath,
          status,
          baseRef: baseHas ? fullRef : undefined,
          targetRef: targetHas ? fullRef : undefined
        });
      }
    }

    return {
      baseCheckpointId: base.id,
      baseAlias: base.alias,
      targetCheckpointId: target.id,
      targetAlias: target.alias,
      comparedFileCount: files.length,
      changedCount,
      addedCount,
      removedCount,
      summary: `${changedCount} changed, ${addedCount} added, ${removedCount} removed between ${base.alias} and ${target.alias}.`,
      files
    };
  }

  async getCollectionDetail(collectionId: string): Promise<CollectionDetailState> {
    const collection =
      this.store.collectionsState.items.find((item) => item.collection_id === collectionId) ??
      this.store.collectionsState.items[0];
    const entries = this.store.entriesByCollection[collection.collection_id] ?? [];

    return {
      id: collection.collection_id,
      kind: collection.kind,
      sourceRef: collection.source_ref,
      timeBucket: collection.time_bucket,
      timeRangeLabel: `${collection.time_range.start} -> ${collection.time_range.end}`,
      entryCount: collection.entry_count ?? 0,
      contentHash: collection.content_hash,
      collectionRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/collection.json`,
      entryShardRef: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`,
      notes:
        collection.source_ref === "binance-usdm:aggtrade:BTCUSDT"
          ? "Agg trades stay raw and source-centered. Market interpretation belongs in evaluation and session logs."
          : "Macro text is stored source-first. Symbol linkage and impact are deferred to agent logs.",
      entries: entries.map((entry) => ({
        id: entry.entry_id,
        sourceRef: entry.source_ref,
        eventTime: entry.event_time,
        ingestedAt: entry.ingested_at,
        contentHash: entry.content_hash,
        preview: entry.preview,
        entryPathRef: collectionEntryPath(collection.collection_id, entry.entry_id),
        blobRef: entry.blob_ref,
        blobPathRef: entry.blob_ref
          ? `${WORKSPACE_ROOT}/blobs/${entry.blob_ref.replace(":", "/")}.txt`
          : undefined
      }))
    };
  }

  async getImportDetail(importId: string): Promise<ImportDetailState> {
    const record = this.store.importsState.items.find((item) => item.import_id === importId);
    if (!record) {
      throw new Error(`unknown import: ${importId}`);
    }

    const workspaceRef = `${WORKSPACE_ROOT}/imports/items/${record.import_id}/workspace`;
    return {
      id: record.import_id,
      importedAt: record.imported_at,
      sourceBundleRef: record.source_bundle_ref,
      importRef: `${WORKSPACE_ROOT}/imports/items/${record.import_id}/import.json`,
      workspaceRef,
      checkpointRef: record.checkpoint_ref,
      policyId: record.policy_id,
      sanitized: record.sanitized,
      bundleRef: `${WORKSPACE_ROOT}/imports/items/${record.import_id}/bundle/export.json`,
      workspaceFileRefs: CURRENT_WORKSPACE_FILE_REFS.map((pathRef) =>
        pathRef.replace(WORKSPACE_ROOT, workspaceRef)
      ),
      preflight: this.buildImportPreflight(record)
    };
  }

  async getImportComparison(importId: string): Promise<ImportComparisonState> {
    const detail = await this.getImportDetail(importId);
    const files = compareWorkspaceRefs(
      CURRENT_WORKSPACE_FILE_REFS,
      detail.workspaceFileRefs,
      WORKSPACE_ROOT,
      detail.workspaceRef
    );
    const addedCount = files.filter((file) => file.status === "added").length;
    const removedCount = files.filter((file) => file.status === "removed").length;

    return {
      importId: detail.id,
      sourceBundleRef: detail.sourceBundleRef,
      comparedFileCount: files.length,
      changedCount: 0,
      addedCount,
      removedCount,
      summary: `${0} changed, ${addedCount} added, ${removedCount} removed between the current workspace and import ${detail.id}.`,
      files
    };
  }

  async getBlobDetail(blobId: string) {
    const contentText =
      this.store.blobContents[blobId] ?? "Blob content is unavailable in the mock service.";

    return {
      id: blobId,
      blobPathRef: `${WORKSPACE_ROOT}/blobs/${blobId.replace(":", "/")}.txt`,
      byteLength: new TextEncoder().encode(contentText).length,
      lineCount: contentText.split("\n").length,
      contentText
    };
  }

  async getOperationDetail(operationId: string): Promise<OperationDetailState> {
    const operation = this.store.operationsState.items.find((item) => item.operation_id === operationId);
    if (!operation) {
      throw new Error(`unknown operation: ${operationId}`);
    }

    const relatedRefs = (operation.related_refs ?? []).map((pathRef) =>
      pathRef.startsWith(WORKSPACE_ROOT) ? pathRef : `${WORKSPACE_ROOT}/${pathRef}`
    );
    const unresolvedRefs: string[] = [];
    const relatedDocuments = relatedRefs.map((pathRef) => {
      const document = this.state.documentCatalog.find((item) => item.pathRef === pathRef);
      if (document) {
        return {
          pathRef: document.pathRef,
          label: document.label,
          description: document.description,
          category: document.category,
          resolved: true
        };
      }

      unresolvedRefs.push(pathRef);
      return {
        pathRef,
        label: pathRef.split("/").pop() ?? pathRef,
        description:
          "Workspace reference captured by the service layer but not indexed in the current document catalog.",
        category: "reference",
        resolved: false
      };
    });

    return {
      id: operation.operation_id,
      kind: operation.kind,
      scope: operation.scope,
      status: operation.status,
      summary: operation.summary,
      details: operation.details,
      createdAt: operation.created_at,
      operationRef: operationPath(operation.operation_id),
      relatedRefs,
      relatedDocuments,
      unresolvedRefs
    };
  }

  async getWorkspaceDocument(documentRef: string): Promise<WorkspaceDocumentState> {
    const contentText = this.resolveDocumentContent(documentRef);
    const format = documentRef.endsWith(".ndjson")
      ? "ndjson"
      : documentRef.endsWith(".json")
        ? "json"
        : "text";

    return {
      pathRef: documentRef,
      format,
      byteLength: new TextEncoder().encode(contentText).length,
      lineCount: contentText.split("\n").length,
      contentText,
      backlinks: buildDocumentBacklinks(this.store, this.state, documentRef)
    };
  }

  async searchWorkspace(query: string): Promise<WorkspaceSearchResultState[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const results: WorkspaceSearchResultState[] = [];

    for (const document of this.state.documentCatalog) {
      const metadataHaystack = [
        document.label,
        document.description,
        document.pathRef,
        document.category
      ]
        .join(" ")
        .toLowerCase();
      if (metadataHaystack.includes(normalized)) {
        results.push({
          id: document.id,
          category: document.category,
          label: document.label,
          description: document.description,
          pathRef: document.pathRef,
          matchKind: "metadata"
        });
        continue;
      }

      const contentText = this.resolveDocumentContent(document.pathRef);
      const excerpt = contentText
        .split("\n")
        .find((line) => line.toLowerCase().includes(normalized))
        ?.trim()
        .slice(0, 180);
      if (!excerpt) {
        continue;
      }

      results.push({
        id: document.id,
        category: document.category,
        label: document.label,
        description: document.description,
        pathRef: document.pathRef,
        matchKind: "content",
        excerpt
      });
    }

    results.sort((left, right) => {
      const rank = (matchKind: "metadata" | "content") => (matchKind === "metadata" ? 2 : 1);
      return rank(right.matchKind) - rank(left.matchKind) || left.label.localeCompare(right.label);
    });

    return results.slice(0, 24);
  }

  async pauseGlobalAutomation(): Promise<BootstrapState> {
    const timestamp = this.nowLabel();
    this.store.liveLane.mode = "observer";
    this.state = {
      ...this.state,
      mode: "observer",
      automationStatus: "paused",
      statusNote: "Global automation was paused through the service boundary."
    };
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Control",
      tone: "warning",
      headline: "Global automation paused",
      reason:
        "The service layer accepted a pause command, switched the client to observer mode, and preserved the live-centered workspace context for inspection.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "pause_global_automation",
      scope: "live",
      status: "succeeded",
      summary: "Global automation paused through the service layer.",
      details:
        "The client requested a pause and the service boundary switched the live lane into observer mode while preserving workspace inspection state.",
      created_at: timestamp,
      related_refs: ["live/live-lane.json", "state/dashboard.json", "state/decisions.json"]
    });
    this.syncDerivedState();
    return structuredClone(this.state);
  }

  async flattenAllPositions(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
    const timestamp = this.nowLabel();
    this.state = {
      ...this.state,
      statusNote: "Service-layer intervention flattened all live positions in the mock runtime.",
      metrics: this.state.metrics.map((metric) =>
        metric.label === "Risk Budget"
          ? { ...metric, value: "0%", delta: "Reset after flatten-all intervention" }
          : metric
      )
    };
    this.store.positionsState.current = [];
    this.store.ordersState.current = [];
    this.store.positionsState.events.unshift({
      event_id: this.nextId("lane-event"),
      kind: "flatten-all",
      summary: "All live positions were flattened through the service layer.",
      timestamp
    });
    this.store.ordersState.events.unshift({
      event_id: this.nextId("lane-event"),
      kind: "flatten-all",
      summary: "All live orders were cleared after the flatten-all intervention.",
      timestamp
    });

    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Intervention",
      tone: "warning",
      headline: "All live positions flattened",
      reason:
        "The service layer executed a mock flatten-all intervention and reset current positions and orders without bypassing the workspace contract.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "flatten_all_positions",
      scope: "live",
      status: "succeeded",
      summary: "Flatten-all intervention reset live positions and orders.",
      details:
        "The service boundary flattened current positions, cleared orders, and captured an incident checkpoint for the intervention.",
      created_at: timestamp,
      related_refs: [
        "state/dashboard.json",
        "state/positions.json",
        "state/orders.json",
        "state/decisions.json",
        checkpointPath(checkpointId)
      ]
    });

    this.prependCheckpoint({
      id: checkpointId,
      alias: "incident-flatten-all",
      type: "incident",
      typeTone: "danger",
      summary: "Client-triggered flatten-all command captured as an incident checkpoint.",
      createdAt: timestamp,
      performance: "Live risk reset to flat",
      pathRef: checkpointPath(checkpointId)
    });
    this.syncDerivedState();
    return structuredClone(this.state);
  }

  async createExportCheckpoint(): Promise<BootstrapState> {
    const checkpointId = crypto.randomUUID();
    const alias = `export-${new Date().toISOString().slice(11, 16).replace(":", "")}`;
    const timestamp = this.nowLabel();

    this.state = {
      ...this.state,
      statusNote: "A fresh export checkpoint was created from the current live-centered asset."
    };

    this.prependCheckpoint({
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
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Export",
      tone: "neutral",
      headline: "Export checkpoint created",
      reason:
        "The service layer created a fresh checkpoint before export so the client can share a stable live-centered asset instead of a drifting mutable state.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "create_export_checkpoint",
      scope: "live",
      status: "succeeded",
      summary: `Export checkpoint ${alias} created for sanitized sharing.`,
      details:
        "The service layer created a fresh export checkpoint and materialized a sanitized bundle from the live-centered workspace state.",
      created_at: timestamp,
      related_refs: [checkpointPath(checkpointId), exportBundlePath(checkpointId), "exports/policy.json"]
    });
    this.syncDerivedState();
    return structuredClone(this.state);
  }

  async exportCheckpoint(checkpointId: string): Promise<BootstrapState> {
    const target = this.state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!target) {
      throw new Error(`unknown checkpoint: ${checkpointId}`);
    }

    const timestamp = this.nowLabel();
    target.exportBundleRef = exportBundlePath(checkpointId);
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "export_checkpoint",
      scope: "workspace",
      status: "succeeded",
      summary: `Checkpoint ${target.alias} exported as a sanitized bundle.`,
      details:
        "The service layer materialized a sanitized export bundle from an existing checkpoint without mutating the active live lane.",
      created_at: timestamp,
      related_refs: [target.pathRef, exportBundlePath(checkpointId), "exports/policy.json"]
    });
    this.syncDerivedState();
    return structuredClone(this.state);
  }

  async restoreCheckpoint(checkpointId: string): Promise<BootstrapState> {
    const target = this.state.checkpoints.find((checkpoint) => checkpoint.id === checkpointId);
    if (!target) {
      throw new Error(`unknown checkpoint: ${checkpointId}`);
    }

    const anchorId = crypto.randomUUID();
    const timestamp = this.nowLabel();
    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: target.alias
      },
      statusNote: `Live workspace restored from checkpoint ${target.alias}.`
    };
    this.prependCheckpoint({
      id: anchorId,
      alias: `incident-restore-anchor-${anchorId.slice(0, 8)}`,
      type: "incident",
      typeTone: "danger",
      summary: `Automatic pre-restore checkpoint created before restoring ${target.alias}.`,
      createdAt: timestamp,
      performance: "Rollback anchor for live workspace restore",
      pathRef: checkpointPath(anchorId)
    });
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Restore",
      tone: "warning",
      headline: `Restored live workspace from ${target.alias}`,
      reason:
        "The service layer reapplied the selected checkpoint snapshot as the active live workspace while preserving checkpoint and export history.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "restore_checkpoint",
      scope: "live",
      status: "succeeded",
      summary: `Live workspace restored from checkpoint ${target.alias}.`,
      details:
        "The service layer restored the selected checkpoint snapshot as the active live workspace and preserved the rollback anchor as an incident checkpoint.",
      created_at: timestamp,
      related_refs: [target.pathRef, checkpointPath(anchorId), "strategy.json", "state/decisions.json"]
    });
    this.syncDerivedState(target.pathRef, target.alias);
    return structuredClone(this.state);
  }

  async activateImportAsLive(importId: string): Promise<BootstrapState> {
    const record = this.store.importsState.items.find((item) => item.import_id === importId);
    if (!record) {
      throw new Error(`unknown import: ${importId}`);
    }
    const preflight = this.buildImportPreflight(record);
    if (preflight.status !== "ready") {
      throw new Error(`import ${importId} failed activation preflight: ${preflight.summary}`);
    }

    const timestamp = this.nowLabel();
    const rollbackAnchorId = crypto.randomUUID();
    const targetCheckpoint =
      this.state.checkpoints.find((checkpoint) => checkpoint.pathRef === record.checkpoint_ref) ?? null;

    this.state = {
      ...this.state,
      statusNote: targetCheckpoint
        ? `Staged import ${importId} is now live and anchored at checkpoint ${targetCheckpoint.alias}.`
        : `Staged import ${importId} is now live.`
    };
    this.prependCheckpoint({
      id: rollbackAnchorId,
      alias: `incident-import-activation-anchor-${rollbackAnchorId.slice(0, 8)}`,
      type: "incident",
      typeTone: "danger",
      summary: `Automatic pre-activation checkpoint created before activating import ${importId}.`,
      createdAt: timestamp,
      performance: "Rollback anchor for staged import activation",
      pathRef: checkpointPath(rollbackAnchorId)
    });
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Import",
      tone: "neutral",
      headline: `Activated import ${importId} as live`,
      reason:
        "The service layer promoted a staged import into the live workspace while preserving checkpoint and operation history inside the mock runtime.",
      timestamp
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
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
        checkpointPath(rollbackAnchorId).replace(`${WORKSPACE_ROOT}/`, "")
      ]
    });

    if (targetCheckpoint) {
      this.syncDerivedState(targetCheckpoint.pathRef, targetCheckpoint.alias);
    } else {
      this.syncDerivedState();
    }
    return structuredClone(this.state);
  }

  async ingestSourceEntry(input: IngestSourceEntryInput): Promise<IngestSourceEntryResult> {
    const payload = input.bodyText ?? input.preview;
    if (!payload) {
      throw new Error("Mock ingest requires bodyText or preview");
    }

    const timeBucket = toUtcHourBucket(input.eventTime);
    const existing = this.store.collectionsState.items.find(
      (item) =>
        item.kind === input.kind &&
        item.source_ref === input.sourceRef &&
        item.time_bucket === timeBucket
    );
    const collectionId = existing?.collection_id ?? `mock-${crypto.randomUUID()}`;
    const createdCollection = !existing;
    const blobId = mockBlobIdFromText(payload);

    if (!this.store.blobContents[blobId]) {
      this.store.blobContents[blobId] = payload;
    }
    if (!this.store.entriesByCollection[collectionId]) {
      this.store.entriesByCollection[collectionId] = [];
    }

    const entry: CollectionEntryRecord = {
      entry_id: crypto.randomUUID(),
      source_ref: input.sourceRef,
      event_time: input.eventTime,
      ingested_at: input.ingestedAt,
      content_hash: blobId,
      blob_ref: blobId,
      preview: input.preview
    };
    this.store.entriesByCollection[collectionId].push(entry);

    const entries = this.store.entriesByCollection[collectionId];
    const nextTimeRange = {
      start: entries[0]?.event_time ?? input.eventTime,
      end: entries[entries.length - 1]?.event_time ?? input.eventTime
    };

    if (existing) {
      existing.entry_count = entries.length;
      existing.content_hash = blobId;
      existing.time_range = nextTimeRange;
    } else {
      this.store.collectionsState.items.unshift({
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

    this.prependOperation({
      operation_id: crypto.randomUUID(),
      kind: "ingest_source_entry",
      scope: "workspace",
      status: "succeeded",
      summary: `Ingested ${input.sourceRef} into collection ${collectionId}.`,
      details:
        "The service layer materialized a source-centered collection shard, appended an entry NDJSON record, and persisted an immutable blob for the entry body.",
      created_at: this.nowLabel(),
      related_refs: [
        `collections/items/${collectionId}/collection.json`,
        `collections/items/${collectionId}/entries.ndjson`,
        `blobs/${blobId.replace(":", "/")}.txt`
      ]
    });
    this.syncDerivedState();

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

  async importExportBundle(bundleRef: string): Promise<ImportBundleState> {
    const importId = crypto.randomUUID();
    const importedAt = this.nowLabel();
    const record: ImportRecord = {
      import_id: importId,
      imported_at: importedAt,
      source_bundle_ref: bundleRef,
      bundle_ref: "./bundle/export.json",
      workspace_ref: "./workspace",
      checkpoint_ref: this.state.assetInspector.currentCheckpointRef,
      policy_id: this.store.exportPolicy.policy_id,
      sanitized: true
    };

    this.store.importsState.items.unshift(record);
    this.prependDecision({
      id: this.nextId("decision"),
      kind: "Import",
      tone: "neutral",
      headline: "Sanitized export staged as import",
      reason:
        "The service layer staged a sanitized export bundle into the workspace imports area without mutating the active live workspace.",
      timestamp: importedAt
    });
    this.prependOperation({
      operation_id: crypto.randomUUID(),
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
    this.syncDerivedState();

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

  private prependCheckpoint(checkpoint: CheckpointSummary) {
    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: checkpoint.alias
      },
      checkpoints: [checkpoint, ...this.state.checkpoints]
    };
  }

  private prependDecision(decision: DecisionEntry) {
    this.store.decisionsState.decisions.unshift(decision);
  }

  private prependOperation(operation: OperationRecord) {
    this.store.operationsState.items.unshift(operation);
  }

  private syncDerivedState(currentCheckpointRef?: string, currentCheckpointAlias?: string) {
    const resolvedCheckpointRef =
      currentCheckpointRef ?? this.state.checkpoints[0]?.pathRef ?? checkpointPath(this.store.checkpointIndexSeed.current.checkpoint_id);
    const resolvedCheckpointAlias =
      currentCheckpointAlias ??
      this.state.workspace.currentCheckpointAlias ??
      this.store.checkpointIndexSeed.current.alias;
    const checkpoints = this.state.checkpoints;
    const derived = buildDerivedState(this.store, checkpoints, resolvedCheckpointRef);

    this.state = {
      ...this.state,
      workspace: {
        ...this.state.workspace,
        currentCheckpointAlias: resolvedCheckpointAlias
      },
      assetInspector: derived.assetInspector,
      workspaceIndex: derived.workspaceIndex,
      liveContext: derived.liveContext,
      exportInspector: derived.exportInspector,
      positions: structuredClone(this.store.positionsState.current),
      orders: structuredClone(this.store.ordersState.current),
      laneEvents: derived.laneEvents,
      decisions: structuredClone(this.store.decisionsState.decisions),
      checkpoints,
      collections: derived.collections,
      imports: derived.imports,
      operations: derived.operations,
      documentCatalog: derived.documentCatalog
    };
  }

  private nextId(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  private nowLabel() {
    return `UTC ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  }

  private resolveDocumentContent(documentRef: string) {
    return resolveMockDocumentContent(this.store, this.state, documentRef);
  }
}

export const mockWorkspaceService = new MockWorkspaceService();
