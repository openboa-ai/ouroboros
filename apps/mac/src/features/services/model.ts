/** Core observations only. A matching dependency or a running process is not a health probe. */
export interface ServiceObservation {
  schema_version: 1;
  root_intent_id: string;
  work_id: string;
  operation: string;
  target: string;
  desired: "complete_original_call" | "stopped";
  state: string;
  current_execution_id: string;
  can_stop: boolean;
  restarts_used: number;
  policy: {
    max_restarts: number;
    restart_window_seconds: number;
    backoff_seconds: number;
  };
  restart_expires_at_seconds: number;
  compute_returned: boolean;
  never_dispatched: boolean;
  health: "not_observed";
  work_success_confirmed: false;
  effects_settled: false;
  observation: {
    source: "core_records";
    observed_at: string;
    authority_revision: number;
    environment_id: string;
    firm_id: string;
  };
  dependencies: {
    targets: {
      target: string;
      operations: string[];
      selection: string;
      caller_access: "permitted" | "restricted";
      health: "not_observed";
    }[];
    inputs: {
      total: number;
      retained: number;
      scope: "current_execution_inputs";
    };
  };
  effects: {
    slot: string;
    intent_id: string;
    operation: string;
    state: string;
    receipt_available: boolean;
  }[];
  compute: {
    capacity: number;
    committed: number;
    available: number;
    scope: "firm_compute";
  } | null;
  history: {
    execution_id: string;
    ordinal: number;
    instance_id: string | null;
    generation: string | null;
    phase: string | null;
    terminated: boolean;
    compute_returned: boolean;
  }[];
}
export interface ServiceScope {
  environmentId: string;
  firmId: string;
  workId?: string;
  rootId?: string;
}
export interface ServiceGroup {
  workId: string;
  title: string;
  items: ServiceObservation[];
  unavailable: boolean;
  hasMore: boolean;
}
export interface ServiceCollection {
  groups: ServiceGroup[];
  partial: boolean;
  source: string;
}
type Json = Record<string, unknown>;
const object = (v: unknown): Json =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const integer = (v: unknown): v is number =>
  Number.isSafeInteger(v) && Number(v) >= 0;
const identifier = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 512;
const array = (v: unknown, check: (item: Json) => boolean): boolean =>
  Array.isArray(v) && v.every((x) => check(object(x)));

export function readService(
  value: unknown,
  scope: ServiceScope,
): ServiceObservation {
  const v = object(value),
    o = object(v.observation),
    p = object(v.policy),
    d = object(v.dependencies),
    inputs = object(d.inputs),
    c = object(v.compute);
  const valid =
    v.schema_version === 1 &&
    identifier(v.root_intent_id) &&
    identifier(v.work_id) &&
    identifier(v.current_execution_id) &&
    (!scope.rootId || v.root_intent_id === scope.rootId) &&
    (!scope.workId || v.work_id === scope.workId) &&
    o.source === "core_records" &&
    o.environment_id === scope.environmentId &&
    o.firm_id === scope.firmId &&
    text(o.observed_at) &&
    Number.isFinite(Date.parse(o.observed_at)) &&
    integer(o.authority_revision) &&
    text(v.operation) &&
    text(v.target) &&
    text(v.state) &&
    ["complete_original_call", "stopped"].includes(String(v.desired)) &&
    typeof v.can_stop === "boolean" &&
    integer(v.restarts_used) &&
    integer(p.max_restarts) &&
    p.max_restarts >= 1 &&
    p.max_restarts <= 32 &&
    v.restarts_used <= p.max_restarts &&
    integer(p.restart_window_seconds) &&
    p.restart_window_seconds > 0 &&
    integer(p.backoff_seconds) &&
    p.backoff_seconds > 0 &&
    typeof v.restart_expires_at_seconds === "number" &&
    Number.isFinite(v.restart_expires_at_seconds) &&
    typeof v.compute_returned === "boolean" &&
    typeof v.never_dispatched === "boolean" &&
    v.health === "not_observed" &&
    v.work_success_confirmed === false &&
    v.effects_settled === false &&
    integer(inputs.total) &&
    integer(inputs.retained) &&
    inputs.retained <= inputs.total &&
    inputs.scope === "current_execution_inputs" &&
    array(
      d.targets,
      (t) =>
        text(t.target) &&
        Array.isArray(t.operations) &&
        t.operations.every(text) &&
        text(t.selection) &&
        ["permitted", "restricted"].includes(String(t.caller_access)) &&
        t.health === "not_observed",
    ) &&
    array(
      v.effects,
      (e) =>
        text(e.slot) &&
        identifier(e.intent_id) &&
        text(e.operation) &&
        text(e.state) &&
        typeof e.receipt_available === "boolean",
    ) &&
    (v.compute === null ||
      (integer(c.capacity) &&
        integer(c.committed) &&
        integer(c.available) &&
        c.available === c.capacity - c.committed &&
        c.scope === "firm_compute")) &&
    array(
      v.history,
      (h) =>
        identifier(h.execution_id) &&
        integer(h.ordinal) &&
        (h.instance_id === null || identifier(h.instance_id)) &&
        (h.generation === null || identifier(h.generation)) &&
        (h.phase === null || text(h.phase)) &&
        typeof h.terminated === "boolean" &&
        typeof h.compute_returned === "boolean",
    );
  if (!valid)
    throw new Error(
      "Service observation unavailable or from a different scope.",
    );
  const result = v as unknown as ServiceObservation;
  if (
    result.history.length !== result.restarts_used + 1 ||
    result.history.some((h, i) => h.ordinal !== i) ||
    result.history.at(-1)?.execution_id !== result.current_execution_id ||
    new Set(result.history.map((h) => h.execution_id)).size !==
      result.history.length
  )
    throw new Error("Incomplete execution history.");
  return result;
}

export function readServiceGroup(
  value: unknown,
  scope: ServiceScope & { workId: string },
  title: string,
): ServiceGroup {
  const v = object(value);
  if (
    v.schema_version !== 1 ||
    v.source !== "core_service_records" ||
    v.work_id !== scope.workId ||
    v.coverage !== "registered_call_continuations" ||
    v.health_assessed !== false ||
    typeof v.has_more !== "boolean" ||
    !Array.isArray(v.items) ||
    v.items.length > 25
  )
    throw new Error("Service coverage unavailable.");
  const items = v.items.map((item) => readService(item, scope));
  if (new Set(items.map((item) => item.root_intent_id)).size !== items.length)
    throw new Error("Duplicate service records.");
  return {
    workId: scope.workId,
    title,
    items,
    unavailable: false,
    hasMore: v.has_more,
  };
}

export type Tone = "neutral" | "attention" | "active";
const states: Record<string, [string, Tone, string]> = {
  execution_pending_or_active: [
    "Execution in progress",
    "active",
    "The current execution has not reported termination.",
  ],
  authority_blocked: [
    "Permission or selection changed",
    "attention",
    "The original call no longer meets its current authority or selected resource requirements.",
  ],
  compute_return_pending: [
    "Awaiting resource return",
    "attention",
    "Termination is recorded. Compute return is still pending.",
  ],
  child_effect_unresolved: [
    "Effect unresolved",
    "attention",
    "A resource request needs a final result before recovery can proceed.",
  ],
  program_completed: [
    "Program exited successfully",
    "neutral",
    "The program exited with code 0. Its business result and external obligations require separate evidence.",
  ],
  transfer_recovery_required: [
    "File transfer needs review",
    "attention",
    "The recorded file transfer cannot be replayed into a different instance.",
  ],
  restart_window_expired: [
    "Recovery window expired",
    "neutral",
    "No more automatic restarts are permitted by this policy.",
  ],
  restart_limit_reached: [
    "Restart allowance used",
    "attention",
    "The original restart allowance has been consumed.",
  ],
  restart_backoff: [
    "Waiting to recover",
    "neutral",
    "The previous execution returned its resources. Recovery is waiting for the configured backoff.",
  ],
  restart_eligible: [
    "Awaiting recovery admission",
    "neutral",
    "Recovery is eligible for a fresh admission. Current permissions and capacity still apply.",
  ],
  execution_restricted: [
    "Execution restricted",
    "attention",
    "The current execution is restricted. Automatic recovery is blocked.",
  ],
  stopping: [
    "Stopping",
    "attention",
    "The restriction is recorded. Termination and resource return are still being observed.",
  ],
  stopped: [
    "Stop observed",
    "neutral",
    "The call is restricted and its execution resources were returned or never dispatched. External effects remain separate.",
  ],
};
export function serviceState(state: string) {
  const [label, tone, detail] = states[state] ?? [
    "Unknown state",
    "attention",
    "This state is not supported by the current app.",
  ];
  return { label, tone, detail };
}
export const serviceName = (s: ServiceObservation) =>
  s.operation.replaceAll("_", " ");
export const shortId = (id: string) => id.slice(0, 8);
export const observedTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export const dependencyLabel = (state: string) =>
  ({
    selection_current: "Selection matches",
    selection_changed: "Selection changed",
    disabled: "Disabled",
    not_registered: "Not registered",
  })[state] ?? "Unknown selection";
