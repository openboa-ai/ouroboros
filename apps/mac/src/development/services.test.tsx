import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleService, sampleServices } from "./fixtures/services";
import {
  readService,
  readServiceGroup,
  serviceState,
} from "@/features/services/model";
import {
  ServiceDetail,
  ServiceList,
  type ServiceControl,
} from "@/features/services/Services";
import {
  checkServiceStop,
  readPendingStop,
  reviewRejectedStop,
  stopService,
  stopStorageKey,
  type ServiceConnection,
} from "@/features/services/stop";
import { operationsFor, type LiveSnapshot } from "@/data/live";
const fresh = () => structuredClone(sampleService);
const scope = {
  environmentId: sampleService.observation.environment_id,
  firmId: sampleService.observation.firm_id,
  rootId: sampleService.root_intent_id,
  workId: sampleService.work_id,
};
const connection: ServiceConnection = {
  ...scope,
  principalId: "owner",
  generation: "connection-1",
};
const page = () => ({
  schema_version: 1,
  source: "core_service_records",
  work_id: scope.workId,
  coverage: "registered_call_continuations",
  health_assessed: false,
  has_more: false,
  items: [fresh()],
});
const callbacks = { open: vi.fn(), discuss: vi.fn() };
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
};

describe("owner service observation", () => {
  it("accepts scoped metadata and nullable unassigned execution history", () => {
    expect(readService(fresh(), scope).health).toBe("not_observed");
    const v = fresh();
    v.history[0] = {
      ...v.history[0],
      instance_id: null,
      generation: null,
      phase: null,
    };
    expect(readService(v, scope).history[0].phase).toBeNull();
  });
  it("rejects a different environment, firm, work or root", () => {
    for (const key of ["environmentId", "firmId", "rootId", "workId"])
      expect(() =>
        readService(fresh(), { ...scope, [key]: "other" }),
      ).toThrow();
  });
  it("rejects unsupported schemas, claimed health, invalid budgets and incomplete history", () => {
    for (const patch of [
      { schema_version: 2 },
      { health: "healthy" },
      { work_success_confirmed: true },
      { restarts_used: 4 },
      { history: [] },
      { dependencies: {} },
      {
        compute: {
          capacity: 8,
          committed: 5,
          available: 8,
          scope: "firm_compute",
        },
      },
    ])
      expect(() => readService({ ...fresh(), ...patch }, scope)).toThrow();
    const v = fresh();
    v.history[0].execution_id = v.work_id;
    expect(() => readService(v, scope)).toThrow("Incomplete");
  });
  it("treats a new state as unknown, never successful", () => {
    const v = readService({ ...fresh(), state: "future-state" }, scope);
    expect(serviceState(v.state)).toMatchObject({
      label: "Unknown state",
      tone: "attention",
    });
  });
  it("rejects duplicate, over-limit and mismatched pages", () => {
    expect(readServiceGroup(page(), scope, "Work").items).toHaveLength(1);
    for (const patch of [
      { work_id: "wrong" },
      { items: [fresh(), fresh()] },
      { items: Array(26).fill(fresh()) },
      { health_assessed: true },
      { source: "model_report" },
    ])
      expect(() =>
        readServiceGroup({ ...page(), ...patch }, scope, "Work"),
      ).toThrow();
  });
  it("keeps failures in one work separate from visible calls and execution observations", () => {
    const snapshot: LiveSnapshot = {
      schema_version: 2,
      source: "gateway",
      environment_id: scope.environmentId,
      conditions: { firm_id: scope.firmId, principal_id: "owner", revision: 8 },
      work: {
        items: [
          { id: scope.workId, purpose: "Work" },
          { id: "other", purpose: "Other work" },
        ],
      },
      observations: [
        {
          work_id: scope.workId,
          services: page(),
          executions: { items: [{ id: "execution-1", work_id: scope.workId }] },
        },
        { work_id: "other", services: { unavailable: true } },
      ],
      coverage: "partial",
    };
    const result = operationsFor(snapshot);
    expect(result.continuations?.groups[0].items).toHaveLength(1);
    expect(result.continuations?.groups[1].unavailable).toBe(true);
    expect(result.executions).toHaveLength(1);
    delete snapshot.observations[0].services;
    expect(operationsFor(snapshot).continuations?.groups[0].unavailable).toBe(
      true,
    );
  });
  it("renders sample controls disabled and keeps process completion separate from outcome", () => {
    const html = renderToStaticMarkup(
      <ServiceDetail
        service={{ ...fresh(), state: "program_completed" }}
        {...callbacks}
      />,
    );
    expect(html).toContain("Preview only");
    expect(html).toContain("disabled");
    expect(html).toContain("Program exited successfully");
    expect(html).toContain("business result");
    expect(html).toContain("Service health");
    expect(callbacks.open).not.toHaveBeenCalled();
    expect(callbacks.discuss).not.toHaveBeenCalled();
  });
  it("keeps accepted stop, pending termination, and external effects visibly separate", () => {
    const control: ServiceControl = {
      busy: false,
      error: "",
      pending: {
        key: scope.rootId,
        rootId: scope.rootId,
        executionId: sampleService.current_execution_id,
      },
      outcome: "recorded",
      stop: vi.fn(),
      check: vi.fn(),
      refresh: vi.fn(),
      review: vi.fn(),
    };
    const html = renderToStaticMarkup(
      <ServiceDetail
        service={{ ...fresh(), desired: "stopped", state: "stopping" }}
        control={control}
        {...callbacks}
      />,
    );
    for (const text of [
      "Restriction recorded",
      "Termination and resource return",
      "Check original request",
      "external effects",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Stop observed");
    expect(control.stop).not.toHaveBeenCalled();
  });
  it("does not render unavailable coverage as a healthy empty company", () => {
    const unavailable = renderToStaticMarkup(
      <ServiceList
        collection={sampleServices("delayed")}
        query=""
        open={callbacks.open}
      />,
    );
    expect(unavailable).toContain("Partial coverage");
    expect(unavailable).toContain("Call observations unavailable");
    const empty = renderToStaticMarkup(
      <ServiceList
        collection={sampleServices("empty")}
        query=""
        open={callbacks.open}
      />,
    );
    expect(empty).toContain("No registered call recovery");
    expect(empty).toContain("Other services may exist");
  });
});

describe("service stop request continuity", () => {
  it("persists the exact execution before sending and retains it after a lost response", async () => {
    const storage = memory(),
      key = stopStorageKey(connection, scope.rootId),
      retained = vi.fn();
    const transport = vi.fn(async (_command, args) => {
      const saved = readPendingStop(storage, key, scope.rootId)!;
      expect(
        (
          args as {
            request: { expected_execution_id: string; request_key: string };
          }
        ).request,
      ).toMatchObject({
        expected_execution_id: saved.executionId,
        request_key: saved.key,
      });
      throw new Error("response lost");
    });
    await expect(
      stopService(transport, storage, connection, fresh(), retained),
    ).rejects.toThrow();
    expect(readPendingStop(storage, key, scope.rootId)?.executionId).toBe(
      sampleService.current_execution_id,
    );
    await expect(
      stopService(transport, storage, connection, fresh(), retained),
    ).rejects.toThrow("original");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(() => reviewRejectedStop(storage, key, scope.rootId)).toThrow(
      "unresolved",
    );
  });
  it("does not send if local persistence fails, authority is absent or connection differs", async () => {
    const transport = vi.fn(),
      storage = memory();
    storage.setItem = () => {
      throw new Error("full");
    };
    await expect(
      stopService(transport, storage, connection, fresh(), vi.fn()),
    ).rejects.toThrow("full");
    await expect(
      stopService(
        transport,
        memory(),
        connection,
        { ...fresh(), can_stop: false },
        vi.fn(),
      ),
    ).rejects.toThrow();
    await expect(
      stopService(
        transport,
        memory(),
        { ...connection, environmentId: "other" },
        fresh(),
        vi.fn(),
      ),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("queries a retained request read-only after reconnection, even when it is missing", async () => {
    const pending = {
      key: scope.rootId,
      rootId: scope.rootId,
      executionId: sampleService.current_execution_id,
    };
    const transport = vi.fn(async () => ({
      source: "core_request_record",
      root_intent_id: pending.rootId,
      request_key: pending.key,
      recorded: false,
      receipt: null,
      resubmitted: false,
    }));
    expect(
      await checkServiceStop(
        transport,
        { ...connection, generation: "new-connection" },
        pending,
      ),
    ).toBe(false);
    expect(transport).toHaveBeenCalledExactlyOnceWith(
      "service_continuation_stop_request",
      {
        connectionGeneration: "new-connection",
        rootIntentId: pending.rootId,
        requestKey: pending.key,
      },
    );
  });
  it("refuses mismatched receipts instead of reporting acceptance", async () => {
    const pending = {
      key: scope.rootId,
      rootId: scope.rootId,
      executionId: sampleService.current_execution_id,
    };
    const response = {
      source: "core_request_record",
      root_intent_id: pending.rootId,
      request_key: pending.key,
      recorded: true,
      resubmitted: false,
      receipt: {
        root_intent_id: pending.rootId,
        execution_id: pending.executionId,
        restriction_recorded: true,
      },
    };
    expect(
      await checkServiceStop(async () => response, connection, pending),
    ).toBe(true);
    await expect(
      checkServiceStop(
        async () => ({
          ...response,
          receipt: { ...response.receipt, execution_id: scope.rootId },
        }),
        connection,
        pending,
      ),
    ).rejects.toThrow();
  });
  it("requires explicit review of rejection before a new exact target can be submitted", async () => {
    const storage = memory(),
      key = stopStorageKey(connection, scope.rootId),
      transport = vi.fn(async () => ({ outcome: "rejected" }));
    expect(
      await stopService(transport, storage, connection, fresh(), vi.fn()),
    ).toBe("rejected");
    const original = readPendingStop(storage, key, scope.rootId)!;
    const next = fresh();
    next.current_execution_id = scope.workId;
    await expect(
      stopService(transport, storage, connection, next, vi.fn()),
    ).rejects.toThrow("original");
    reviewRejectedStop(storage, key, scope.rootId);
    expect(storage.getItem(`${key}.rejected.${original.key}`)).not.toBeNull();
    expect(readPendingStop(storage, key, scope.rootId)).toBeNull();
    expect(transport).toHaveBeenCalledTimes(1);
    await stopService(
      async () => ({ outcome: "recorded", termination_confirmed: false }),
      storage,
      connection,
      next,
      vi.fn(),
    );
    expect(readPendingStop(storage, key, scope.rootId)?.executionId).toBe(
      scope.workId,
    );
  });
  it("partitions retained references by environment, company and owner, not transient connection", () => {
    const key = stopStorageKey(connection, scope.rootId);
    expect(
      stopStorageKey({ ...connection, generation: "new" }, scope.rootId),
    ).toBe(key);
    for (const field of ["environmentId", "firmId", "principalId"])
      expect(
        stopStorageKey({ ...connection, [field]: "other" }, scope.rootId),
      ).not.toBe(key);
  });
});

// The test runner can attach sanitized output produced by the disposable Core SQL suite.
if (process.env.OURO_SERVICE_OBSERVATION_FILE)
  it("accepts the actual Core SQL projection and renders its detail", () => {
    const value = JSON.parse(
      readFileSync(process.env.OURO_SERVICE_OBSERVATION_FILE!, "utf8"),
    );
    const first = value.items[0];
    const group = readServiceGroup(
      value,
      {
        environmentId: first.observation.environment_id,
        firmId: first.observation.firm_id,
        workId: value.work_id,
      },
      "Disposable contract work",
    );
    expect(group.items).toHaveLength(1);
    const html = renderToStaticMarkup(
      <ServiceDetail service={group.items[0]} {...callbacks} />,
    );
    expect(html).toContain("read snapshot");
    expect(html).toContain("Receipt available");
    expect(html).not.toContain("PRIVATE-COMPANY");
  });
