import type {
  AssetInspectorState,
  AgentRuntimeState,
  BootstrapState,
  CheckpointSummary,
  DecisionEntry,
  EnvironmentRuntimeState,
  ExportBundleState,
  ExportInspectorState,
  LaneEventState,
  LiveContextState,
  OrchestratorRuntimeState,
  RuntimeTopologyState,
  WorkspaceIndexState
} from "../service-contract";
import { checkpointPath, exportBundlePath, WORKSPACE_ROOT } from "./paths";
import type { MockDerivedState, MockWorkspaceStore } from "./types";
import {
  buildCollections,
  buildDocumentCatalog,
  buildImports,
  buildOperations
} from "./catalog";

export function buildLaneEvents(store: MockWorkspaceStore): LaneEventState[] {
  return [
    ...store.positionsState.events.map((event) => ({
      id: event.event_id,
      scope: "positions" as const,
      kind: event.kind,
      summary: event.summary,
      timestamp: event.timestamp
    })),
    ...store.ordersState.events.map((event) => ({
      id: event.event_id,
      scope: "orders" as const,
      kind: event.kind,
      summary: event.summary,
      timestamp: event.timestamp
    }))
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function buildAssetInspector(
  checkpoints: CheckpointSummary[],
  currentCheckpointRef: string
): AssetInspectorState {
  const latestExport = checkpoints.find((checkpoint) => checkpoint.exportBundleRef);

  return {
    workspaceRoot: WORKSPACE_ROOT,
    strategyRef: `${WORKSPACE_ROOT}/strategy.json`,
    liveLaneRef: `${WORKSPACE_ROOT}/live/live-lane.json`,
    currentCheckpointRef,
    exportPolicyRef: `${WORKSPACE_ROOT}/exports/policy.json`,
    latestExportBundleRef: latestExport?.exportBundleRef,
    checkpointCount: checkpoints.length,
    exportCount: checkpoints.filter((checkpoint) => checkpoint.exportBundleRef).length
  };
}

export function buildWorkspaceIndex(
  store: MockWorkspaceStore,
  currentCheckpointRef: string
): WorkspaceIndexState {
  return {
    schemaVersion: store.strategyManifest.schema_version,
    active: {
      orchestratorRef: `${WORKSPACE_ROOT}/orchestrator/orchestrator.json`,
      liveLaneRef: `${WORKSPACE_ROOT}/live/live-lane.json`,
      currentCheckpointRef,
      exportPolicyRef: `${WORKSPACE_ROOT}/exports/policy.json`
    },
    indexes: {
      checkpointsRef: `${WORKSPACE_ROOT}/checkpoints/index.json`,
      agentsRef: `${WORKSPACE_ROOT}/agents/index.json`,
      environmentsRef: `${WORKSPACE_ROOT}/environments/index.json`,
      collectionsRef: `${WORKSPACE_ROOT}/indexes/collections.json`,
      importsRef: `${WORKSPACE_ROOT}/imports/index.json`,
      operationsRef: `${WORKSPACE_ROOT}/operations/index.json`,
      sessionsRef: `${WORKSPACE_ROOT}/indexes/sessions.json`
    },
    agentCount: store.agentsIndex.agents.length,
    environmentCount: store.environmentsIndex.environments.length,
    collectionCount: store.collectionsState.items.length,
    operationCount: store.operationsState.items.length,
    sessionCount: store.sessionsState.sessions.length
  };
}

function normalizeRef(pathRef: string) {
  return pathRef
    .split("/")
    .reduce<string[]>((segments, segment) => {
      if (!segment || segment === ".") {
        return segments;
      }
      if (segment === "..") {
        segments.pop();
        return segments;
      }
      segments.push(segment);
      return segments;
    }, [])
    .join("/");
}

function workspacePath(pathRef: string) {
  return `${WORKSPACE_ROOT}/${normalizeRef(pathRef)}`;
}

function workspacePathFrom(basePath: string, pathRef: string) {
  const baseSegments = normalizeRef(basePath).split("/");
  baseSegments.pop();
  return `${WORKSPACE_ROOT}/${normalizeRef([...baseSegments, pathRef].join("/"))}`;
}

export function buildRuntimeTopology(store: MockWorkspaceStore): RuntimeTopologyState {
  const environments = store.environmentsIndex.environments.map<EnvironmentRuntimeState>(
    (environment) => {
      const definition = store.environmentDefinitions[environment.id];
      return {
        id: environment.id,
        name: definition?.name ?? environment.name,
        kind: definition?.kind ?? "unknown",
        definitionRef: workspacePath(environment.definition_ref),
        capabilities: definition?.capabilities ?? [],
        notes: definition?.notes
      };
    }
  );

  const environmentNames = new Map(
    environments.map((environment) => [environment.definitionRef, environment.name])
  );

  const agents = store.agentsIndex.agents.map<AgentRuntimeState>((agent) => {
    const definition = store.agentDefinitions[agent.id];
    const definitionRef = workspacePath(`agents/${agent.definition_ref}`);
    const environmentRef = definition?.environment_ref
      ? workspacePathFrom(`agents/${agent.definition_ref}`, definition.environment_ref)
      : "";

    return {
      id: agent.id,
      name: definition?.name ?? agent.name,
      kind: definition?.kind ?? agent.kind,
      definitionRef,
      providerMode: definition?.provider_policy.mode ?? agent.provider_mode,
      preferredProviders: definition?.provider_policy.preferred_providers ?? [],
      environmentRef,
      environmentName: environmentNames.get(environmentRef) ?? "unknown",
      workspaceRefs: Object.entries(definition?.workspace_refs ?? {}).map(([label, pathRef]) => ({
        label,
        pathRef: workspacePathFrom(`agents/${agent.definition_ref}`, pathRef)
      }))
    };
  });

  const orchestrator = store.orchestrator;
  const orchestratorState: OrchestratorRuntimeState = {
    id: orchestrator.orchestrator_id,
    name: orchestrator.name,
    mode: orchestrator.mode,
    pathRef: `${WORKSPACE_ROOT}/orchestrator/orchestrator.json`,
    notes: orchestrator.notes ?? [],
    topologyRefs: {
      agentsRef: workspacePathFrom("orchestrator/orchestrator.json", orchestrator.topology_refs.agents_ref),
      environmentsRef: workspacePathFrom(
        "orchestrator/orchestrator.json",
        orchestrator.topology_refs.environments_ref
      ),
      sessionsRef: workspacePathFrom(
        "orchestrator/orchestrator.json",
        orchestrator.topology_refs.sessions_ref
      ),
      liveLaneRef: workspacePathFrom(
        "orchestrator/orchestrator.json",
        orchestrator.topology_refs.live_lane_ref
      )
    }
  };

  return {
    orchestrator: orchestratorState,
    agents,
    environments
  };
}

export function buildLiveContext(store: MockWorkspaceStore): LiveContextState {
  return {
    dashboardRef: `${WORKSPACE_ROOT}/state/dashboard.json`,
    decisionsRef: `${WORKSPACE_ROOT}/state/decisions.json`,
    memoryRef: `${WORKSPACE_ROOT}/state/live-memory.json`,
    positionsRef: `${WORKSPACE_ROOT}/state/positions.json`,
    ordersRef: `${WORKSPACE_ROOT}/state/orders.json`,
    memoryNotes: store.liveMemoryState.notes.map((note) => note.summary),
    sessions: store.sessionsState.sessions.map((session) => ({
      id: session.session_id,
      label: session.label,
      startedAt: session.started_at,
      status: session.status,
      pathRef: `${WORKSPACE_ROOT}/sessions/items/${session.session_id}/session.json`
    })),
    evaluationSummaries: store.evalSummariesState.summaries.map((summary) => ({
      id: summary.summary_id,
      headline: summary.headline,
      createdAt: summary.created_at,
      pathRef: `${WORKSPACE_ROOT}/eval-summaries/items/${summary.summary_id}/summary.json`,
      evidenceRefs: summary.evidence_refs ?? []
    })),
    positionEventCount: store.positionsState.events.length,
    orderEventCount: store.ordersState.events.length
  };
}

export function buildExportBundle(
  store: MockWorkspaceStore,
  checkpoint: CheckpointSummary
): ExportBundleState {
  const workspaceRef = `${WORKSPACE_ROOT}/exports/generated/${checkpoint.id}/workspace`;
  return {
    exportId: checkpoint.id,
    createdAt: checkpoint.createdAt,
    policyId: store.exportPolicy.policy_id,
    checkpointRef: checkpoint.pathRef,
    workspaceRef,
    bundleRef: exportBundlePath(checkpoint.id),
    includedRefs: store.strategyManifest.active
      ? [
          "./workspace/strategy.json",
          "./workspace/live/live-lane.json",
          "./workspace/state/dashboard.json",
          "./workspace/state/decisions.json",
          "./workspace/state/live-memory.json",
          "./workspace/state/orders.json",
          "./workspace/state/positions.json",
          "./workspace/state/eval-summaries.json",
          "./workspace/indexes/sessions.json",
          "./workspace/sessions/items/01962740-2f14-7f37-a9a5-1d3c5d9f1a01/session.json",
          "./workspace/eval-summaries/items/0196274f-40c8-73be-9f42-f5cf61951b44/summary.json"
        ].map((pathRef) => pathRef.replace("./workspace", workspaceRef))
      : [],
    excludedPaths: [
      "./workspace/checkpoints",
      "./workspace/exports/generated",
      "./workspace/secrets",
      "./workspace/credentials"
    ],
    sanitized: true
  };
}

export function buildExportInspector(
  store: MockWorkspaceStore,
  checkpoints: CheckpointSummary[]
): ExportInspectorState {
  const latestExport = checkpoints.find((checkpoint) => checkpoint.exportBundleRef);

  return {
    policyId: store.exportPolicy.policy_id,
    description: store.exportPolicy.description,
    latestBundle: latestExport ? buildExportBundle(store, latestExport) : null
  };
}

export function buildCheckpointSummaries(store: MockWorkspaceStore): CheckpointSummary[] {
  return store.checkpointIndexSeed.items.map((item) => ({
    id: item.checkpoint_id,
    alias: item.alias,
    type: item.type,
    typeTone: item.type_tone ?? "warning",
    summary: item.summary ?? "Checkpoint captured.",
    createdAt: item.created_at ?? "UTC unknown",
    performance: item.performance ?? "No summary",
    pathRef: checkpointPath(item.checkpoint_id),
    exportBundleRef: undefined
  }));
}

export function buildDerivedState(
  store: MockWorkspaceStore,
  checkpoints: CheckpointSummary[],
  currentCheckpointRef: string
): MockDerivedState {
  const assetInspector = buildAssetInspector(checkpoints, currentCheckpointRef);
  const exportInspector = buildExportInspector(store, checkpoints);

  return {
    checkpoints,
    currentCheckpointRef,
    assetInspector,
    workspaceIndex: buildWorkspaceIndex(store, currentCheckpointRef),
    runtimeTopology: buildRuntimeTopology(store),
    liveContext: buildLiveContext(store),
    exportInspector,
    collections: buildCollections(store),
    imports: buildImports(store),
    operations: buildOperations(store),
    documentCatalog: buildDocumentCatalog(store, currentCheckpointRef, exportInspector.latestBundle?.bundleRef),
    laneEvents: buildLaneEvents(store)
  };
}

export function buildTemplateBootstrapState(store: MockWorkspaceStore): BootstrapState {
  const checkpoints = buildCheckpointSummaries(store);
  const currentCheckpointRef = checkpointPath(store.checkpointIndexSeed.current.checkpoint_id);
  const derived = buildDerivedState(store, checkpoints, currentCheckpointRef);

  return {
    ...store.dashboardSeedState,
    workspace: {
      artifactId: store.strategyManifest.artifact_id,
      slug: store.strategyManifest.slug,
      liveLaneLabel: store.liveLane.label,
      currentCheckpointAlias: store.checkpointIndexSeed.current.alias,
      exportPolicyLabel: store.exportPolicy.policy_id
    },
    assetInspector: derived.assetInspector,
    workspaceIndex: derived.workspaceIndex,
    runtimeTopology: derived.runtimeTopology,
    liveContext: derived.liveContext,
    exportInspector: derived.exportInspector,
    positions: structuredClone(store.positionsState.current),
    orders: structuredClone(store.ordersState.current),
    laneEvents: derived.laneEvents,
    decisions: structuredClone(store.decisionsState.decisions),
    checkpoints: derived.checkpoints,
    collections: derived.collections,
    imports: derived.imports,
    operations: derived.operations,
    documentCatalog: derived.documentCatalog
  };
}

export function prependDecision(store: MockWorkspaceStore, decision: DecisionEntry) {
  store.decisionsState.decisions.unshift(decision);
}
