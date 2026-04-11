import type { BootstrapState } from "../service-contract";
import { buildExportBundle } from "./builders";
import {
  checkpointPath,
  collectionEntryPath,
  operationPath,
  WORKSPACE_ROOT
} from "./paths";
import type { MockWorkspaceStore } from "./types";

function serializeRuntimeStatusDocument(state: BootstrapState) {
  return {
    mode: state.mode,
    automationStatus: state.automationStatus,
    statusNote: state.statusNote
  };
}

function serializeDashboardDocument(store: MockWorkspaceStore) {
  return {
    providers: store.dashboardSeedState.providers,
    metrics: store.dashboardSeedState.metrics,
    priceSeries: store.dashboardSeedState.priceSeries,
    equitySeries: store.dashboardSeedState.equitySeries,
    exposureSeries: store.dashboardSeedState.exposureSeries
  };
}

export function resolveMockDocumentContent(
  store: MockWorkspaceStore,
  state: BootstrapState,
  documentRef: string
): string {
  const checkpointWorkspaceMatch = documentRef.match(
    /var\/dev-workspace\/checkpoints\/items\/([^/]+)\/workspace\/(.+)$/
  );
  if (checkpointWorkspaceMatch) {
    return resolveMockDocumentContent(store, state, `${WORKSPACE_ROOT}/${checkpointWorkspaceMatch[2]}`);
  }

  const exportWorkspaceMatch = documentRef.match(
    /var\/dev-workspace\/exports\/generated\/([^/]+)\/workspace\/(.+)$/
  );
  if (exportWorkspaceMatch) {
    return resolveMockDocumentContent(store, state, `${WORKSPACE_ROOT}/${exportWorkspaceMatch[2]}`);
  }

  const importWorkspaceMatch = documentRef.match(
    /var\/dev-workspace\/imports\/items\/([^/]+)\/workspace\/(.+)$/
  );
  if (importWorkspaceMatch) {
    return resolveMockDocumentContent(store, state, `${WORKSPACE_ROOT}/${importWorkspaceMatch[2]}`);
  }

  if (documentRef === `${WORKSPACE_ROOT}/strategy.json`) {
    return JSON.stringify(store.strategyManifest, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/orchestrator/orchestrator.json`) {
    return JSON.stringify(store.orchestrator, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/live/live-lane.json`) {
    return JSON.stringify(store.liveLane, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/runtime-status.json`) {
    return JSON.stringify(serializeRuntimeStatusDocument(state), null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/agents/index.json`) {
    return JSON.stringify(store.agentsIndex, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/environments/index.json`) {
    return JSON.stringify(store.environmentsIndex, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/adapters/index.json`) {
    return JSON.stringify(store.adaptersIndex, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/evaluations/index.json`) {
    return JSON.stringify({ items: store.evaluationsState.items }, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/dashboard.json`) {
    return JSON.stringify(serializeDashboardDocument(store), null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/decisions.json`) {
    return JSON.stringify(store.decisionsState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/live-memory.json`) {
    return JSON.stringify(store.liveMemoryState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/orders.json`) {
    return JSON.stringify(store.ordersState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/positions.json`) {
    return JSON.stringify(store.positionsState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/exports/policy.json`) {
    return JSON.stringify(store.exportPolicy, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/imports/index.json`) {
    return JSON.stringify(store.importsState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/operations/index.json`) {
    return JSON.stringify(store.operationsState, null, 2);
  }

  const operationMatch = documentRef.match(/var\/dev-workspace\/operations\/items\/([^/]+)\/operation\.json$/);
  if (operationMatch) {
    const operation = store.operationsState.items.find((item) => item.operation_id === operationMatch[1]);
    if (operation) {
      return JSON.stringify(operation, null, 2);
    }
  }

  if (documentRef === `${WORKSPACE_ROOT}/checkpoints/index.json`) {
    return JSON.stringify(
      {
        current: {
          checkpoint_id: state.checkpoints[0]?.id ?? store.checkpointIndexSeed.current.checkpoint_id,
          alias: state.checkpoints[0]?.alias ?? store.checkpointIndexSeed.current.alias,
          type: state.checkpoints[0]?.type ?? store.checkpointIndexSeed.current.type
        },
        items: state.checkpoints.map((checkpoint) => ({
          checkpoint_id: checkpoint.id,
          alias: checkpoint.alias,
          type: checkpoint.type,
          type_tone: checkpoint.typeTone,
          summary: checkpoint.summary,
          created_at: checkpoint.createdAt,
          performance: checkpoint.performance,
          path_ref: checkpoint.pathRef
        }))
      },
      null,
      2
    );
  }

  if (documentRef === `${WORKSPACE_ROOT}/indexes/collections.json`) {
    return JSON.stringify({ items: store.collectionsState.items }, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/indexes/sessions.json`) {
    return JSON.stringify(store.sessionsState, null, 2);
  }
  if (documentRef === `${WORKSPACE_ROOT}/state/eval-summaries.json`) {
    return JSON.stringify(store.evalSummariesState, null, 2);
  }

  const sessionMatch = documentRef.match(/sessions\/items\/([^/]+)\/session\.json$/);
  if (sessionMatch) {
    const session = store.sessionsState.sessions.find((item) => item.session_id === sessionMatch[1]);
    if (session) {
      return JSON.stringify(
        {
          session_id: session.session_id,
          label: session.label,
          started_at: session.started_at,
          status: session.status,
          scope: "live",
          goal: "Keep the live trading context inspectable, exportable, and replayable.",
          context_refs: [
            "./live/live-lane.json",
            "./state/runtime-status.json",
            "./state/live-memory.json",
            "./state/positions.json",
            "./state/orders.json",
            "./state/eval-summaries.json"
          ],
          notes: [
            "Session records stay inside the workspace asset and are exposed through the service layer.",
            "These documents are part of the live trading context whenever they materially influence trading behavior."
          ]
        },
        null,
        2
      );
    }
  }

  const agentMatch = documentRef.match(/agents\/items\/([^/]+)\/agent\.json$/);
  if (agentMatch) {
    const agent = store.agentsIndex.agents.find((item) => item.id === agentMatch[1]);
    if (agent) {
      return JSON.stringify(
        {
          agent_id: agent.id,
          name: agent.name,
          kind: agent.kind,
          provider_policy: {
            mode: agent.provider_mode,
            preferred_providers:
              agent.name === "kairos-live-manager"
                ? ["claude-code", "codex"]
                : ["codex", "claude-code"]
          },
          environment_ref:
            agent.name === "kairos-live-manager"
              ? "../../environments/items/01963762-0ed3-70ba-bdae-5edf57c9d1de/environment.json"
              : "../../environments/items/01963763-147d-7488-acfb-77fd5c95dc0e/environment.json",
          workspace_refs:
            agent.name === "kairos-live-manager"
              ? {
                  live_lane_ref: "../../live/live-lane.json",
                  sessions_ref: "../../indexes/sessions.json"
                }
              : {
                  eval_summaries_ref: "../../state/eval-summaries.json",
                  collections_ref: "../../indexes/collections.json"
                }
        },
        null,
        2
      );
    }
  }

  const environmentMatch = documentRef.match(/environments\/items\/([^/]+)\/environment\.json$/);
  if (environmentMatch) {
    const environment = store.environmentsIndex.environments.find(
      (item) => item.id === environmentMatch[1]
    );
    if (environment) {
      return JSON.stringify(
        {
          environment_id: environment.id,
          name: environment.name,
          kind: environment.name.includes("live") ? "live" : "evaluation",
          capabilities: environment.name.includes("live")
            ? ["workspace-read", "workspace-write", "service-commands"]
            : ["workspace-read", "workspace-write", "service-commands", "collection-ingest"],
          notes: environment.name.includes("live")
            ? "Live trading workspace environment. Execution core remains outside this definition."
            : "Evaluation environment for backtest, paper, and evidence generation."
        },
        null,
        2
      );
    }
  }

  const adapterMatch = documentRef.match(/adapters\/items\/([^/]+)\/adapter\.json$/);
  if (adapterMatch) {
    const adapter = store.adapterDefinitions[adapterMatch[1]];
    if (adapter) {
      return JSON.stringify(adapter, null, 2);
    }
  }

  const evalSummaryMatch = documentRef.match(/eval-summaries\/items\/([^/]+)\/summary\.json$/);
  if (evalSummaryMatch) {
    const summary = store.evalSummariesState.summaries.find(
      (item) => item.summary_id === evalSummaryMatch[1]
    );
    if (summary) {
      return JSON.stringify(
        {
          summary_id: summary.summary_id,
          headline: summary.headline,
          created_at: summary.created_at,
          tone: "positive",
          decision: "keep-current-live-checkpoint",
          rationale: [
            "Recent paper candidates improved gross PnL but lost the edge once model cost and slippage were applied.",
            "Forced intervention frequency remained lower on the current live checkpoint than on the latest rejected candidates."
          ],
          evidence_refs: summary.evidence_refs ?? []
        },
        null,
        2
      );
    }
  }

  const evaluationRunMatch = documentRef.match(/evaluations\/items\/([^/]+)\/run\.json$/);
  if (evaluationRunMatch) {
    const run = store.evaluationsState.items.find((item) => item.run_id === evaluationRunMatch[1]);
    if (run) {
      return JSON.stringify(run, null, 2);
    }
  }

  const checkpointMatch = documentRef.match(/checkpoints\/items\/([^/]+)\/checkpoint\.json$/);
  if (checkpointMatch) {
    const checkpoint = state.checkpoints.find((item) => item.id === checkpointMatch[1]);
    if (checkpoint) {
      return JSON.stringify(
        {
          checkpoint_id: checkpoint.id,
          alias: checkpoint.alias,
          type: checkpoint.type,
          type_tone: checkpoint.typeTone,
          summary: checkpoint.summary,
          created_at: checkpoint.createdAt,
          performance: checkpoint.performance,
          path_ref: checkpoint.pathRef
        },
        null,
        2
      );
    }
  }

  const exportMatch = documentRef.match(/exports\/generated\/([^/]+)\/export\.json$/);
  if (exportMatch) {
    const checkpoint = state.checkpoints.find((item) => item.id === exportMatch[1]);
    if (checkpoint) {
      return JSON.stringify(buildExportBundle(store, checkpoint), null, 2);
    }
  }

  const importManifestMatch = documentRef.match(/imports\/items\/([^/]+)\/import\.json$/);
  if (importManifestMatch) {
    const imported = store.importsState.items.find((item) => item.import_id === importManifestMatch[1]);
    if (imported) {
      return JSON.stringify(imported, null, 2);
    }
  }

  const importBundleMatch = documentRef.match(/imports\/items\/([^/]+)\/bundle\/export\.json$/);
  if (importBundleMatch) {
    const imported = store.importsState.items.find((item) => item.import_id === importBundleMatch[1]);
    if (imported) {
      const matchingCheckpoint = state.checkpoints.find(
        (checkpoint) => checkpoint.pathRef === imported.checkpoint_ref
      );
      if (matchingCheckpoint) {
        return JSON.stringify(buildExportBundle(store, matchingCheckpoint), null, 2);
      }
    }
  }

  const collectionMatch = documentRef.match(/collections\/items\/([^/]+)\/collection\.json$/);
  if (collectionMatch) {
    const collection =
      store.collectionsState.items.find((item) => item.collection_id === collectionMatch[1]) ??
      store.collectionsState.items[0];
    return JSON.stringify(
      {
        ...collection,
        entry_shard_ref: `${WORKSPACE_ROOT}/collections/items/${collection.collection_id}/entries.ndjson`,
        notes:
          collection.source_ref === "binance-usdm:aggtrade:BTCUSDT"
            ? "Agg trades stay raw and source-centered. Market interpretation belongs in evaluation and session logs."
            : "Macro text is stored source-first. Symbol linkage and impact are deferred to agent logs."
      },
      null,
      2
    );
  }

  const shardMatch = documentRef.match(/collections\/items\/([^/]+)\/entries\.ndjson$/);
  if (shardMatch) {
    return (
      (store.entriesByCollection[shardMatch[1]] ?? [])
        .map((entry) => JSON.stringify(entry))
        .join("\n")
    );
  }

  const entryMatch = documentRef.match(/collections\/items\/([^/]+)\/entries\/([^/]+)\.json$/);
  if (entryMatch) {
    const [collectionId, entryId] = [entryMatch[1], entryMatch[2]];
    const collection =
      store.collectionsState.items.find((item) => item.collection_id === collectionId) ??
      store.collectionsState.items[0];
    const entry = (store.entriesByCollection[collectionId] ?? []).find(
      (item) => item.entry_id === entryId
    );
    if (entry) {
      return JSON.stringify(
        {
          entry_id: entry.entry_id,
          collection_id: collection.collection_id,
          kind: collection.kind,
          source_ref: entry.source_ref,
          event_time: entry.event_time,
          ingested_at: entry.ingested_at,
          content_hash: entry.content_hash,
          preview: entry.preview,
          collection_ref: "../collection.json",
          entry_shard_ref: "../entries.ndjson",
          blob_ref: entry.blob_ref,
          blob_path_ref: entry.blob_ref
            ? `../../../../blobs/${entry.blob_ref.replace(":", "/")}.txt`
            : undefined
        },
        null,
        2
      );
    }
  }

  const blobMatch = documentRef.match(/blobs\/sha256\/([a-f0-9]+)\.txt$/);
  if (blobMatch) {
    const blobId = `sha256:${blobMatch[1]}`;
    return store.blobContents[blobId] ?? "Blob content is unavailable in the mock service.";
  }

  return JSON.stringify({ unsupportedRef: documentRef }, null, 2);
}
