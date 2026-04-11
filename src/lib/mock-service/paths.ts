export const WORKSPACE_ROOT = "var/dev-workspace";

export const DEFAULT_EXCLUDED_PATHS = [
  "./workspace/checkpoints",
  "./workspace/exports/generated",
  "./workspace/secrets",
  "./workspace/credentials"
];

export const DEFAULT_INCLUDED_REFS = [
  "./workspace/strategy.json",
  "./workspace/orchestrator/orchestrator.json",
  "./workspace/live/live-lane.json",
  "./workspace/agents/index.json",
  "./workspace/agents/items/0196375e-6f98-7d61-9a1b-d12c8f95fd55/agent.json",
  "./workspace/agents/items/01963760-0f86-7caf-8e5b-aecf7a760089/agent.json",
  "./workspace/environments/index.json",
  "./workspace/environments/items/01963762-0ed3-70ba-bdae-5edf57c9d1de/environment.json",
  "./workspace/environments/items/01963763-147d-7488-acfb-77fd5c95dc0e/environment.json",
  "./workspace/adapters/index.json",
  "./workspace/adapters/items/01963a00-1111-7111-8111-111111111111/adapter.json",
  "./workspace/adapters/items/01963a00-2222-7222-8222-222222222222/adapter.json",
  "./workspace/evaluations/index.json",
  "./workspace/state/runtime-status.json",
  "./workspace/state/dashboard.json",
  "./workspace/state/decisions.json",
  "./workspace/state/live-memory.json",
  "./workspace/state/orders.json",
  "./workspace/state/positions.json",
  "./workspace/state/eval-summaries.json",
  "./workspace/indexes/sessions.json",
  "./workspace/sessions/items/01962740-2f14-7f37-a9a5-1d3c5d9f1a01/session.json",
  "./workspace/eval-summaries/items/0196274f-40c8-73be-9f42-f5cf61951b44/summary.json"
];

export const CURRENT_WORKSPACE_FILE_REFS = DEFAULT_INCLUDED_REFS.map((pathRef) =>
  pathRef.replace("./workspace", WORKSPACE_ROOT)
);

export function checkpointPath(checkpointId: string) {
  return `${WORKSPACE_ROOT}/checkpoints/items/${checkpointId}/checkpoint.json`;
}

export function exportBundlePath(checkpointId: string) {
  return `${WORKSPACE_ROOT}/exports/generated/${checkpointId}/export.json`;
}

export function operationPath(operationId: string) {
  return `${WORKSPACE_ROOT}/operations/items/${operationId}/operation.json`;
}

export function evaluationRunPath(runId: string) {
  return `${WORKSPACE_ROOT}/evaluations/items/${runId}/run.json`;
}

export function collectionEntryPath(collectionId: string, entryId: string) {
  return `${WORKSPACE_ROOT}/collections/items/${collectionId}/entries/${entryId}.json`;
}

export function normalizeWorkspaceRef(pathRef: string) {
  return pathRef.startsWith(WORKSPACE_ROOT) ? pathRef : `${WORKSPACE_ROOT}/${pathRef}`;
}

export function toUtcHourBucket(eventTime: string) {
  return `${eventTime.slice(0, 13)}:00:00Z`;
}

export function mockBlobIdFromText(content: string) {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sha256:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
