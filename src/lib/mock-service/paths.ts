export const WORKSPACE_ROOT = "var/dev-workspace";

export const DEFAULT_EXCLUDED_PATHS = [
  "./workspace/checkpoints",
  "./workspace/exports/generated",
  "./workspace/secrets",
  "./workspace/credentials"
];

export const DEFAULT_INCLUDED_REFS = [
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
