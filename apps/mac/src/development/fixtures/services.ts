/** Explicit design fixtures; no account, member, resource or runtime data from a company. */
import type { Scenario } from "@/app/contracts";
import type {
  ServiceCollection,
  ServiceObservation,
} from "@/features/services/model";
const id = (n: number) =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const sampleService: ServiceObservation = {
  schema_version: 1,
  root_intent_id: id(1),
  work_id: id(2),
  operation: "prepare_daily_summary",
  target: "company-service",
  desired: "complete_original_call",
  state: "execution_pending_or_active",
  current_execution_id: id(3),
  can_stop: true,
  restarts_used: 0,
  policy: {
    max_restarts: 3,
    restart_window_seconds: 1800,
    backoff_seconds: 15,
  },
  restart_expires_at_seconds: Date.parse("2026-09-15T11:30:00Z") / 1000,
  compute_returned: false,
  never_dispatched: false,
  health: "not_observed",
  work_success_confirmed: false,
  effects_settled: false,
  observation: {
    source: "core_records",
    observed_at: "2026-09-15T11:04:12Z",
    authority_revision: 8,
    environment_id: id(90),
    firm_id: id(91),
  },
  dependencies: {
    targets: [
      {
        target: "company-service",
        operations: ["adapter.invoke", "service.manage"],
        selection: "selection_current",
        caller_access: "permitted",
        health: "not_observed",
      },
      {
        target: "company-db",
        operations: ["db.read", "db.write"],
        selection: "selection_current",
        caller_access: "permitted",
        health: "not_observed",
      },
    ],
    inputs: { total: 2, retained: 2, scope: "current_execution_inputs" },
  },
  effects: [
    {
      slot: "source-records",
      intent_id: id(4),
      operation: "db.read",
      state: "succeeded",
      receipt_available: true,
    },
  ],
  compute: { capacity: 8, committed: 5, available: 3, scope: "firm_compute" },
  history: [
    {
      execution_id: id(3),
      ordinal: 0,
      instance_id: id(5),
      generation: id(6),
      phase: "released",
      terminated: false,
      compute_returned: false,
    },
  ],
};
export function sampleServices(scenario: Scenario): ServiceCollection {
  const blocked = structuredClone(sampleService);
  blocked.root_intent_id = id(10);
  blocked.operation = "reconcile_resource_usage";
  blocked.state = "child_effect_unresolved";
  blocked.current_execution_id = id(11);
  blocked.history = [
    {
      ...blocked.history[0],
      execution_id: id(11),
      phase: "terminated",
      terminated: true,
      compute_returned: true,
    },
  ];
  blocked.compute_returned = true;
  blocked.effects[0] = {
    slot: "usage-record",
    intent_id: id(12),
    operation: "db.write",
    state: "running",
    receipt_available: false,
  };
  blocked.dependencies.targets[1].selection = "selection_changed";
  const waiting = structuredClone(sampleService);
  waiting.root_intent_id = id(20);
  waiting.operation = "build_research_index";
  waiting.current_execution_id = id(21);
  waiting.state = "restart_backoff";
  waiting.restarts_used = 1;
  waiting.compute_returned = true;
  waiting.history = [
    {
      ...waiting.history[0],
      phase: "terminated",
      terminated: true,
      compute_returned: true,
    },
    {
      ...waiting.history[0],
      execution_id: id(21),
      ordinal: 1,
      phase: "terminated",
      terminated: true,
      compute_returned: true,
    },
  ];
  if (scenario === "restricted") {
    blocked.state = "authority_blocked";
    blocked.can_stop = false;
    blocked.dependencies.targets[1].caller_access = "restricted";
  }
  return {
    source: "Sample observations",
    partial: scenario === "delayed",
    groups: [
      {
        workId: id(2),
        title: "Daily company operations",
        items:
          scenario === "empty" || scenario === "delayed"
            ? []
            : [blocked, sampleService, waiting],
        unavailable: scenario === "delayed",
        hasMore: false,
      },
    ],
  };
}
