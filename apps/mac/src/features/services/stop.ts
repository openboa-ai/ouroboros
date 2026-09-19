import type { ServiceObservation } from "./model";
export interface PendingServiceStop {
  key: string;
  rootId: string;
  executionId: string;
  rejected?: boolean;
}
export interface ServiceConnection {
  environmentId: string;
  firmId: string;
  principalId: string;
  generation: string;
}
export type ServiceTransport = (
  command: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
type StorageReference = Pick<Storage, "getItem" | "setItem">;
export function stopStorageKey(c: ServiceConnection, root: string) {
  return `ouroboros.service-stop.${c.environmentId}.${c.firmId}.${c.principalId}.${root}`;
}
export function readPendingStop(
  storage: StorageReference,
  scope: string,
  root: string,
): PendingServiceStop | null {
  const raw = storage.getItem(scope);
  if (!raw) return null;
  const v = JSON.parse(raw);
  if (
    v?.rootId !== root ||
    typeof v.executionId !== "string" ||
    typeof v.key !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(v.key) ||
    !/^[0-9a-f-]{36}$/i.test(v.executionId)
  )
    throw new Error(
      "The saved stop reference cannot be read. No new request was sent.",
    );
  return {
    key: v.key,
    rootId: v.rootId,
    executionId: v.executionId,
    rejected: v.rejected === true,
  };
}
/** Persist before transport. Uncertain responses and later refreshes never replace this target/key. */
export async function stopService(
  transport: ServiceTransport,
  storage: StorageReference,
  connection: ServiceConnection,
  service: ServiceObservation,
  onRetained: (p: PendingServiceStop) => void,
) {
  const scope = stopStorageKey(connection, service.root_intent_id);
  if (
    !service.can_stop ||
    !connection.generation ||
    service.observation.environment_id !== connection.environmentId ||
    service.observation.firm_id !== connection.firmId
  )
    throw new Error("Refresh the current service before stopping it.");
  if (readPendingStop(storage, scope, service.root_intent_id))
    throw new Error(
      "Check the original stop request before taking another action.",
    );
  const pending: PendingServiceStop = {
    key: crypto.randomUUID(),
    rootId: service.root_intent_id,
    executionId: service.current_execution_id,
  };
  storage.setItem(scope, JSON.stringify(pending));
  onRetained(pending);
  const value = (await transport("stop_service_continuation", {
    request: {
      connection_generation: connection.generation,
      root_intent_id: pending.rootId,
      expected_execution_id: pending.executionId,
      request_key: pending.key,
    },
  })) as Record<string, unknown>;
  if (value?.outcome === "rejected") {
    pending.rejected = true;
    storage.setItem(scope, JSON.stringify(pending));
    onRetained(pending);
    return "rejected" as const;
  }
  if (value?.outcome !== "recorded" || value.termination_confirmed !== false)
    throw new Error("The stop outcome could not be verified.");
  return "recorded" as const;
}
/** Explicit review may retire a definitively rejected request; an uncertain request is retained. */
export function reviewRejectedStop(
  storage: StorageReference & Pick<Storage, "removeItem">,
  scope: string,
  root: string,
) {
  const pending = readPendingStop(storage, scope, root);
  if (!pending?.rejected)
    throw new Error("The original request remains unresolved.");
  storage.setItem(`${scope}.rejected.${pending.key}`, JSON.stringify(pending));
  storage.removeItem(scope);
}
/** Read-only even when the original request is missing. Reconnection never resubmits a stop. */
export async function checkServiceStop(
  transport: ServiceTransport,
  c: ServiceConnection,
  pending: PendingServiceStop,
): Promise<boolean> {
  const value = (await transport("service_continuation_stop_request", {
    connectionGeneration: c.generation,
    rootIntentId: pending.rootId,
    requestKey: pending.key,
  })) as Record<string, unknown>;
  const receipt = value?.receipt as Record<string, unknown> | null;
  if (
    value?.source !== "core_request_record" ||
    value.resubmitted !== false ||
    value.root_intent_id !== pending.rootId ||
    value.request_key !== pending.key ||
    typeof value.recorded !== "boolean" ||
    (value.recorded
      ? receipt?.root_intent_id !== pending.rootId ||
        receipt?.execution_id !== pending.executionId ||
        receipt?.restriction_recorded !== true
      : receipt !== null)
  )
    throw new Error("The original stop result could not be verified.");
  return value.recorded;
}
