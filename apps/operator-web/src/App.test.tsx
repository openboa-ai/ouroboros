import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ArenaTradingSystemDetailReadModel,
  ResearchSessionDetailReadModel
} from "@ouroboros/domain";
import type {
  ArenaSystemDetailViewModel,
  ArenaWorkspaceViewModel,
  ResearchWorkspaceViewModel
} from "./app/operator-view-model";
import {
  fetchOperatorReadModel,
  fetchResearchSessionDetail,
  fetchTradingGatewayEnvironment
} from "./api";
import {
  isOperatorRuntimeRequestCurrent,
  isOperatorRuntimeSelectionCurrent,
  selectedArenaDetailCandidateId,
  selectedResearchDetailWorkItemId,
  settleResearchDetailRefresh,
  stateAfterOperatorSelectionChange,
  shouldRunAutomaticOperatorRefresh,
  type OperatorRuntimeState
} from "./app/use-operator-runtime";
import { ArenaScreen } from "./screens/arena-screen";
import { ResearchScreen } from "./screens/research-screen";

const srcRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(srcRoot);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.doUnmock("react");
  vi.doUnmock("./api");
  vi.resetModules();
});

describe("greenfield Operator entrypoint", () => {
  it("routes the application through the new shell and five owned screens", () => {
    const source = readFileSync(join(srcRoot, "App.tsx"), "utf8");

    expect(source).toContain("OperatorShell");
    expect(source).toContain("ArenaScreen");
    expect(source).toContain("ResearchScreen");
    expect(source).toContain("TradingScreen");
    expect(source).toContain("EvidenceScreen");
    expect(source).toContain("SystemScreen");
    expect(source).not.toContain("active_researchers");
  });

  it("removes the old presentation hierarchy instead of retaining a migration shell", () => {
    for (const legacyPath of ["design-system", "sections", "shell"]) {
      expect(existsSync(join(srcRoot, legacyPath))).toBe(false);
    }
  });

  it("keeps boot and fatal states inside the same brand contract", () => {
    const indexSource = readFileSync(join(appRoot, "index.html"), "utf8");
    const mainSource = readFileSync(join(srcRoot, "main.tsx"), "utf8");

    for (const source of [indexSource, mainSource]) {
      expect(source).toContain("#F37021");
      expect(source).toContain("#17120F");
      expect(source).not.toContain("#111827");
    }

    expect(indexSource).toContain('aria-label="Loading Ouroboros Operator"');
    expect(mainSource).toContain('aria-label="Ouroboros Operator render failure"');
  });

  it("skips automatic runtime polling while the document is hidden", () => {
    const source = readFileSync(join(srcRoot, "app", "use-operator-runtime.ts"), "utf8");

    expect(source).toContain("document.visibilityState");
    expect(source).toContain('"hidden"');
  });

  it("replaces a stuck root refresh without overlapping or duplicating detail", async () => {
    vi.useFakeTimers();
    const effects: Array<() => void | (() => void)> = [];
    vi.doMock("react", () => ({
      useCallback: (callback: unknown) => callback,
      useEffect: (effect: () => void | (() => void)) => {
        effects.push(effect);
      },
      useRef: (initialValue: unknown) => ({ current: initialValue }),
      useState: (initialValue: unknown) => {
        let currentValue = initialValue;
        return [currentValue, (update: unknown) => {
          currentValue = typeof update === "function"
            ? (update as (current: unknown) => unknown)(currentValue)
            : update;
        }];
      }
    }));

    const detailRequests: Array<Deferred<ResearchSessionDetailReadModel>> = [];
    const fetchResearchDetail = vi.fn((_researchWorkItemId: string) => {
      const request = deferred<ResearchSessionDetailReadModel>();
      detailRequests.push(request);
      return request.promise;
    });
    const operatorSnapshot = {
      research_operations: {
        sessions: []
      }
    };
    const rootSignals: AbortSignal[] = [];
    let liveRootGenerations = 0;
    let maxLiveRootGenerations = 0;
    const fetchOperator = vi.fn((signal?: AbortSignal) => {
      liveRootGenerations += 1;
      maxLiveRootGenerations = Math.max(
        maxLiveRootGenerations,
        liveRootGenerations
      );
      if (fetchOperator.mock.calls.length === 1) {
        if (signal) rootSignals.push(signal);
        return new Promise<never>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            liveRootGenerations -= 1;
            reject(signal.reason ?? new Error("root refresh aborted"));
          }, { once: true });
        });
      }
      liveRootGenerations -= 1;
      return Promise.resolve(operatorSnapshot);
    });
    const fetchGateway = vi.fn(async () => ({}));
    vi.doMock("./api", () => ({
      fetchArenaTradingSystemDetail: vi.fn(),
      fetchOperatorReadModel: fetchOperator,
      fetchResearchSessionDetail: fetchResearchDetail,
      fetchTradingGatewayEnvironment: fetchGateway,
      submitOuroborosCommand: vi.fn()
    }));

    const visibility = { state: "visible" as DocumentVisibilityState };
    const setIntervalSpy = vi.fn((handler: TimerHandler, timeout?: number) =>
      globalThis.setInterval(handler, timeout)
    );
    vi.stubGlobal("document", {
      get visibilityState() {
        return visibility.state;
      }
    });
    vi.stubGlobal("window", {
      clearInterval: (interval: ReturnType<typeof setInterval>) =>
        globalThis.clearInterval(interval),
      setInterval: setIntervalSpy
    });

    vi.resetModules();
    const { useOperatorRuntime: useTestOperatorRuntime } = await import(
      "./app/use-operator-runtime"
    );
    const runtime = useTestOperatorRuntime(undefined, "research-session-slow");
    const cleanups = effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchOperator).toHaveBeenCalledTimes(1);
    expect(fetchGateway).toHaveBeenCalledTimes(1);
    expect(detailRequests).toHaveLength(0);

    const queuedManualRefresh = runtime.refresh();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchOperator).toHaveBeenCalledTimes(4);
    expect(fetchGateway).toHaveBeenCalledTimes(4);
    expect(detailRequests).toHaveLength(2);
    expect(maxLiveRootGenerations).toBe(1);
    expect(rootSignals).toHaveLength(1);
    expect(rootSignals[0]?.aborted).toBe(true);
    await queuedManualRefresh;

    await runtime.refresh();
    expect(fetchOperator).toHaveBeenCalledTimes(5);
    expect(fetchGateway).toHaveBeenCalledTimes(5);
    expect(detailRequests).toHaveLength(2);

    detailRequests[0]?.resolve({
      research_work_item_id: "research-session-slow"
    } as ResearchSessionDetailReadModel);
    await vi.advanceTimersByTimeAsync(0);
    expect(detailRequests).toHaveLength(2);

    detailRequests[1]?.resolve({
      research_work_item_id: "research-session-slow"
    } as ResearchSessionDetailReadModel);
    await vi.advanceTimersByTimeAsync(0);
    expect(detailRequests).toHaveLength(3);

    detailRequests[2]?.resolve({
      research_work_item_id: "research-session-slow"
    } as ResearchSessionDetailReadModel);
    await vi.advanceTimersByTimeAsync(0);

    visibility.state = "hidden";
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchOperator).toHaveBeenCalledTimes(5);
    expect(fetchGateway).toHaveBeenCalledTimes(5);
    expect(detailRequests).toHaveLength(3);

    visibility.state = "visible";
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchOperator).toHaveBeenCalledTimes(6);
    expect(fetchGateway).toHaveBeenCalledTimes(6);
    expect(detailRequests).toHaveLength(4);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    detailRequests[3]?.resolve({
      research_work_item_id: "research-session-slow"
    } as ResearchSessionDetailReadModel);
    await vi.advanceTimersByTimeAsync(0);
    for (const cleanup of cleanups.reverse()) cleanup();
  });

  it("times out both hung detail lanes, retains last-safe evidence, and drains one queued retry", async () => {
    vi.useFakeTimers();
    const effects: Array<() => void | (() => void)> = [];
    let latestState: OperatorRuntimeState | undefined;
    vi.doMock("react", () => ({
      useCallback: (callback: unknown) => callback,
      useEffect: (effect: () => void | (() => void)) => {
        effects.push(effect);
      },
      useRef: (initialValue: unknown) => ({ current: initialValue }),
      useState: (initialValue: OperatorRuntimeState) => {
        let currentValue = initialValue;
        latestState = currentValue;
        return [currentValue, (update: OperatorRuntimeState | ((current: OperatorRuntimeState) => OperatorRuntimeState)) => {
          currentValue = typeof update === "function" ? update(currentValue) : update;
          latestState = currentValue;
        }];
      }
    }));

    const arenaRequests: Array<{
      request: Deferred<ArenaTradingSystemDetailReadModel>;
      signal: AbortSignal;
    }> = [];
    const researchRequests: Array<{
      request: Deferred<ResearchSessionDetailReadModel>;
      signal: AbortSignal;
    }> = [];
    const fetchArenaDetail = vi.fn((_candidateId: string, signal: AbortSignal) => {
      const request = deferred<ArenaTradingSystemDetailReadModel>();
      arenaRequests.push({ request, signal });
      return request.promise;
    });
    const fetchResearchDetail = vi.fn((_researchWorkItemId: string, signal: AbortSignal) => {
      const request = deferred<ResearchSessionDetailReadModel>();
      researchRequests.push({ request, signal });
      return request.promise;
    });
    const operatorSnapshot = {
      arena_operations: {
        systems: [{ candidate_id: "arena-system-1" }]
      },
      research_operations: {
        sessions: [{ research_work_item_id: "research-session-1" }]
      }
    };
    vi.doMock("./api", () => ({
      fetchArenaTradingSystemDetail: fetchArenaDetail,
      fetchOperatorReadModel: vi.fn(async () => operatorSnapshot),
      fetchResearchSessionDetail: fetchResearchDetail,
      fetchTradingGatewayEnvironment: vi.fn(async () => ({})),
      submitOuroborosCommand: vi.fn()
    }));
    vi.stubGlobal("document", { visibilityState: "visible" });
    vi.stubGlobal("window", {
      clearInterval: (interval: ReturnType<typeof setInterval>) =>
        globalThis.clearInterval(interval),
      setInterval: (handler: TimerHandler, timeout?: number) =>
        globalThis.setInterval(handler, timeout)
    });

    vi.resetModules();
    const { useOperatorRuntime: useTestOperatorRuntime } = await import(
      "./app/use-operator-runtime"
    );
    const runtime = useTestOperatorRuntime("arena-system-1", "research-session-1");
    const cleanups = effects.flatMap((effect) => {
      const cleanup = effect();
      return cleanup ? [cleanup] : [];
    });
    await vi.advanceTimersByTimeAsync(0);

    const safeArenaDetail = {
      candidate_id: "arena-system-1",
      display_name: "Last safe Arena detail"
    } as unknown as ArenaTradingSystemDetailReadModel;
    const safeResearchDetail = {
      research_work_item_id: "research-session-1",
      latest_progress_summary: "Last safe Research detail"
    } as unknown as ResearchSessionDetailReadModel;
    arenaRequests[0]?.request.resolve(safeArenaDetail);
    researchRequests[0]?.request.resolve(safeResearchDetail);
    await vi.advanceTimersByTimeAsync(0);
    expect(latestState?.arenaDetail).toBe(safeArenaDetail);
    expect(latestState?.researchDetail).toBe(safeResearchDetail);

    await runtime.refresh();
    expect(arenaRequests).toHaveLength(2);
    expect(researchRequests).toHaveLength(2);
    await runtime.refresh();
    await runtime.refresh();
    expect(arenaRequests).toHaveLength(2);
    expect(researchRequests).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(arenaRequests[1]?.signal.aborted).toBe(true);
    expect(researchRequests[1]?.signal.aborted).toBe(true);
    expect(arenaRequests).toHaveLength(3);
    expect(researchRequests).toHaveLength(3);
    expect(latestState?.arenaDetail).toBe(safeArenaDetail);
    expect(latestState?.researchDetail).toBe(safeResearchDetail);
    expect(latestState?.arenaDetailError).toMatch(
      /Arena detail refresh exceeded \d+ms deadline/
    );
    expect(latestState?.researchDetailError).toMatch(
      /Research detail refresh exceeded \d+ms deadline/
    );

    const retainedResearchWarning = latestState?.researchDetailError;
    await runtime.refresh();
    expect(researchRequests).toHaveLength(3);
    expect(latestState?.researchDetail).toBe(safeResearchDetail);
    expect(latestState?.researchDetailError).toBe(retainedResearchWarning);

    arenaRequests[1]?.request.resolve({
      candidate_id: "arena-system-1",
      display_name: "Late stale Arena detail"
    } as unknown as ArenaTradingSystemDetailReadModel);
    researchRequests[1]?.request.resolve({
      research_work_item_id: "research-session-1",
      latest_progress_summary: "Late stale Research detail"
    } as unknown as ResearchSessionDetailReadModel);
    await vi.advanceTimersByTimeAsync(0);
    expect(latestState?.arenaDetail).toBe(safeArenaDetail);
    expect(latestState?.researchDetail).toBe(safeResearchDetail);
    expect(arenaRequests).toHaveLength(3);
    expect(researchRequests).toHaveLength(3);

    const recoveredArenaDetail = {
      candidate_id: "arena-system-1",
      display_name: "Recovered Arena detail"
    } as unknown as ArenaTradingSystemDetailReadModel;
    const recoveredResearchDetail = {
      research_work_item_id: "research-session-1",
      latest_progress_summary: "Recovered Research detail"
    } as unknown as ResearchSessionDetailReadModel;
    arenaRequests[2]?.request.resolve(recoveredArenaDetail);
    researchRequests[2]?.request.resolve(recoveredResearchDetail);
    await vi.advanceTimersByTimeAsync(0);
    expect(latestState?.arenaDetail).toBe(recoveredArenaDetail);
    expect(latestState?.researchDetail).toBe(recoveredResearchDetail);
    expect(latestState?.arenaDetailError).toBeUndefined();
    expect(latestState?.researchDetailError).toBeUndefined();

    await runtime.refresh();
    expect(arenaRequests).toHaveLength(4);
    expect(researchRequests).toHaveLength(4);
    for (const cleanup of cleanups.reverse()) cleanup();
    expect(arenaRequests[3]?.signal.aborted).toBe(true);
    expect(researchRequests[3]?.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(arenaRequests).toHaveLength(4);
    expect(researchRequests).toHaveLength(4);
    expect(latestState?.arenaDetailError).toBeUndefined();
    expect(latestState?.researchDetailError).toBeUndefined();
  });

  it("refreshes the selected Arena detail in the existing five-second loop", () => {
    const appSource = readFileSync(join(srcRoot, "App.tsx"), "utf8");
    const runtimeSource = readFileSync(
      join(srcRoot, "app", "use-operator-runtime.ts"),
      "utf8"
    );

    expect(appSource).toContain(
      "useOperatorRuntime(selectedArenaSystemId, selectedResearchWorkItemId)"
    );
    expect(runtimeSource).toContain("selectedArenaDetailCandidateId");
    expect(runtimeSource).toContain(
      "fetchArenaTradingSystemDetail(arenaDetailCandidateId, signal)"
    );
    expect(runtimeSource).toContain("Promise.allSettled");
    expect(runtimeSource).toContain("5_000");
    expect(runtimeSource).toContain(`arenaDetailLoading: Boolean(
        arenaDetailCandidateId &&
        current.arenaDetail?.candidate_id !== arenaDetailCandidateId
      )`);
  });

  it("requests Arena detail only for a selected authoritative projection row", () => {
    expect(selectedArenaDetailCandidateId(undefined, "legacy-candidate")).toBeUndefined();
    expect(selectedArenaDetailCandidateId({
      arena_operations: undefined
    }, "legacy-candidate")).toBeUndefined();
    expect(selectedArenaDetailCandidateId({
      arena_operations: {
        systems: [{ candidate_id: "authoritative-candidate" }]
      }
    }, "authoritative-candidate")).toBe("authoritative-candidate");
    expect(selectedArenaDetailCandidateId({
      arena_operations: {
        systems: [{ candidate_id: "authoritative-candidate" }]
      }
    }, "stale-candidate")).toBeUndefined();
  });

  it("fetches one exact canonical Research session path segment", async () => {
    const detail = researchDetailResponseFixture("research/session 1");
    const researchWorkItemId = detail.research_work_item_id;
    const fetchMock = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ) => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await expect(fetchResearchSessionDetail(
      researchWorkItemId,
      controller.signal
    )).resolves.toBe(detail);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      new RegExp(`/api/research/sessions/${researchWorkItemId}$`)
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("rejects a successful Research detail envelope whose ID does not match the requested session", async () => {
    const requestedId = researchDetailResponseFixture(
      "requested-session"
    ).research_work_item_id;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        research_session: {
          research_work_item_id: "different-session"
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResearchSessionDetail(requestedId)).rejects.toThrow(
      "Failed to load Research session: invalid response"
    );
  });

  it("rejects an extended successful Research detail envelope", async () => {
    const detail = researchDetailResponseFixture("extended-envelope");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        research_session: detail,
        authority_hint: "unexpected"
      })
    })));

    await expect(fetchResearchSessionDetail(detail.research_work_item_id))
      .rejects.toThrow("Failed to load Research session: invalid response");
  });

  it.each([
    ["a top-level extension field", (detail: Record<string, unknown>) => {
      detail.authority_hint = "unexpected";
    }],
    ["a nested budget extension field", (detail: Record<string, unknown>) => {
      (detail.budget as Record<string, unknown>).authority_hint = "unexpected";
    }],
    ["a missing tick identity", (detail: Record<string, unknown>) => {
      delete detail.tick_id;
    }],
    ["an overlong tick identity", (detail: Record<string, unknown>) => {
      detail.tick_id = "t".repeat(201);
    }],
    ["server-overlong sanitized projection text", (
      detail: Record<string, unknown>
    ) => {
      detail.latest_progress_summary = "x".repeat(501);
    }],
    ["a work-item identity from another direction", (
      detail: Record<string, unknown>
    ) => {
      detail.direction_kind = "mean_reversion";
    }],
    ["missing evidence arrays", (detail: Record<string, unknown>) => {
      delete detail.evidence_inputs;
    }],
    ["an invalid trigger discriminant", (detail: Record<string, unknown>) => {
      detail.trigger_availability = "available";
    }],
    ["an unsafe unavailable-provider payload", (detail: Record<string, unknown>) => {
      detail.model = "unexpected-model";
    }],
    ["a non-string optional identity", (detail: Record<string, unknown>) => {
      detail.research_worker_id = {};
    }],
    ["an unsupported lifecycle status", (detail: Record<string, unknown>) => {
      detail.status = "live";
    }],
    ["an active queue basis from another allocation", (
      detail: Record<string, unknown>
    ) => {
      const basis = detail.status_basis as Record<string, unknown>;
      const source = basis.source_ref as Record<string, unknown>;
      source.id = "allocation-other";
    }],
    ["a running runtime basis from another commitment", (
      detail: Record<string, unknown>
    ) => {
      configureRunningResearchDetail(detail);
      const basis = detail.status_basis as Record<string, unknown>;
      const source = basis.source_ref as Record<string, unknown>;
      source.id = "commitment-other";
    }],
    ["an allocating runtime basis with a source ref", (
      detail: Record<string, unknown>
    ) => {
      configureRuntimeResearchDetail(detail, "allocating");
      (detail.status_basis as Record<string, unknown>).source_ref = {
        record_kind: "research_preflight_commitment",
        id: "commitment-unexpected"
      };
    }],
    ["a failed runtime basis with a source ref", (
      detail: Record<string, unknown>
    ) => {
      configureRuntimeResearchDetail(detail, "failed_closed");
      (detail.status_basis as Record<string, unknown>).source_ref = {
        record_kind: "research_preflight_commitment",
        id: "commitment-unexpected"
      };
    }],
    ["a lifecycle event before its allocation", (detail: Record<string, unknown>) => {
      detail.lifecycle_events = [{
        sequence: 1,
        occurred_at: "2026-07-27T23:59:59.000Z",
        event_kind: "checkpoint",
        summary: "Unexpected pre-allocation checkpoint.",
        summary_truncated: false,
        source_ref: {
          record_kind: "research_worker_checkpoint",
          id: "checkpoint-before-allocation"
        },
        sanitized: true,
        authority_status: "read_only"
      }, {
        ...(detail.lifecycle_events as Record<string, unknown>[])[0],
        sequence: 2
      }];
    }],
    ["a running start before allocation", (detail: Record<string, unknown>) => {
      configureRunningResearchDetail(detail);
      detail.started_at = "2026-07-27T23:59:59.000Z";
    }],
    ["a completed timestamp that differs from its terminal event", (
      detail: Record<string, unknown>
    ) => {
      configureLifecycleStatusBasis(
        detail,
        "research_worker_checkpoint",
        "checkpoint",
        "checkpoint-bound",
        "checkpoint-bound"
      );
      detail.completed_at = "2026-07-28T00:00:02.000Z";
    }],
    ["a queued session with an invented completed timestamp", (
      detail: Record<string, unknown>
    ) => {
      detail.completed_at = "2026-07-28T00:00:00.000Z";
    }],
    ["a terminal status completed without a terminal event", (
      detail: Record<string, unknown>
    ) => {
      configureRuntimeResearchDetail(detail, "failed_closed");
      detail.completed_at = "2026-07-28T00:00:00.000Z";
    }],
    ["checkpoint history that contradicts its budget count", (
      detail: Record<string, unknown>
    ) => {
      configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
      detail.budget = {
        max_experiment_count: 1,
        completed_experiment_count: 0,
        max_development_submission_count: 1,
        development_submission_count: 0,
        remaining_development_submission_count: 1,
        authority_status: "research_only"
      };
    }],
    ["a selected sequence beyond its recorded history", (
      detail: Record<string, unknown>
    ) => {
      configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
      detail.selected_submission_sequence = 2;
    }],
    ["a projected sequence beyond its recorded history", (
      detail: Record<string, unknown>
    ) => {
      configureTerminalSelectionDetail(detail, [unselectedSubmissionFixture(2)]);
      detail.recorded_submission_count = 1;
      detail.projected_submission_count = 1;
    }],
    ["unavailable history with a projected submission", (
      detail: Record<string, unknown>
    ) => {
      const submission = unselectedSubmissionFixture(1);
      detail.development_submissions = [submission];
      detail.notebook_summary = [submission.summary];
    }],
    ["unavailable history with a consumed submission budget", (
      detail: Record<string, unknown>
    ) => {
      detail.budget = {
        max_experiment_count: 1,
        completed_experiment_count: 0,
        max_development_submission_count: 1,
        development_submission_count: 1,
        remaining_development_submission_count: 0,
        authority_status: "research_only"
      };
    }],
    ["trigger evidence without a source ref", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      delete (detail.trigger as Record<string, unknown>).source_ref;
    }],
    ["an Arena event trigger without evidence", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      const trigger = detail.trigger as Record<string, unknown>;
      delete trigger.evidence_artifact_ref;
      delete trigger.evidence_artifact_digest;
      detail.evidence_inputs = [];
    }],
    ["a live event trigger without source or evidence", (
      detail: Record<string, unknown>
    ) => {
      configureTriggerEvidenceDetail(detail);
      const trigger = detail.trigger as Record<string, unknown>;
      trigger.trigger_kind = "live_event";
      delete trigger.source_ref;
      delete trigger.evidence_artifact_ref;
      delete trigger.evidence_artifact_digest;
      detail.evidence_inputs = [];
    }],
    ["a trigger recorded after allocation", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      (detail.trigger as Record<string, unknown>).triggered_at =
        "2026-07-28T00:00:01.000Z";
    }],
    ["a trigger without its exact evidence ID", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      evidence.evidence_artifact_id = "evidence-other";
    }],
    ["duplicate evidence for one trigger", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      (detail.evidence_inputs as Record<string, unknown>[]).push({ ...evidence });
    }],
    ["duplicate evidence IDs outside trigger projection", (
      detail: Record<string, unknown>
    ) => {
      configureTriggerEvidenceDetail(detail);
      detail.trigger_availability = "unavailable";
      delete detail.trigger;
      setDegradedReason(detail, "trigger_unavailable", true);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      (detail.evidence_inputs as Record<string, unknown>[]).push({ ...evidence });
    }],
    ["a trigger evidence digest mismatch", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      evidence.artifact_digest = `sha256:${"e".repeat(64)}`;
    }],
    ["trigger evidence captured after the trigger", (
      detail: Record<string, unknown>
    ) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      evidence.captured_at = "2026-07-28T00:00:00.000Z";
    }],
    ["trigger evidence from another source", (detail: Record<string, unknown>) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      evidence.artifact_ref = {
        record_kind: "paper_trading_evaluation",
        id: "paper-evaluation-other"
      };
    }],
    ["evidence provenance with a role-incompatible artifact kind", (
      detail: Record<string, unknown>
    ) => {
      configureTriggerEvidenceDetail(detail);
      const evidence = (detail.evidence_inputs as Record<string, unknown>[])[0]!;
      evidence.artifact_ref = {
        record_kind: "paper_trading_observation",
        id: "paper-evaluation-trigger"
      };
      (detail.trigger as Record<string, unknown>).source_ref =
        evidence.artifact_ref;
    }],
    ["an unavailable trigger without its visible degraded reason", (
      detail: Record<string, unknown>
    ) => {
      setDegradedReason(detail, "trigger_unavailable", false);
    }],
    ["an available trigger retaining an unavailable degraded reason", (
      detail: Record<string, unknown>
    ) => {
      configureTriggerEvidenceDetail(detail);
      setDegradedReason(detail, "trigger_unavailable", true);
    }],
    ["a status-basis mismatch", (detail: Record<string, unknown>) => {
      detail.status_basis = {
        basis_kind: "candidate_admission_decision",
        source_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-wrong-status"
        },
        authority_status: "read_only"
      };
    }],
    ["an incomplete persisted graph basis without its degraded reason", (
      detail: Record<string, unknown>
    ) => {
      configureRecoveringResearchDetail(detail);
      setDegradedReason(detail, "inactive_incomplete_graph", false);
    }],
    ["a malformed terminal graph", (detail: Record<string, unknown>) => {
      detail.terminal_graph = { authority_status: "read_only", admission: {} };
    }],
    ["an unproven admitted handoff", (detail: Record<string, unknown>) => {
      detail.terminal_graph = {
        authority_status: "read_only",
        admitted_arena_handoff: {
          candidate_arena_tick_ref: {
            record_kind: "candidate_arena_tick",
            id: "tick-unproven"
          },
          candidate_ref: {
            record_kind: "trading_system_candidate",
            id: "candidate-unproven"
          },
          direction_kind: "trend_following",
          candidate_admission_decision_ref: {
            record_kind: "candidate_admission_decision",
            id: "admission-unproven"
          },
          completed_at: "2026-07-28T00:00:01.000Z",
          authority_status: "read_only"
        }
      };
    }],
    ["a mismatched admitted authority graph", (detail: Record<string, unknown>) => {
      configureAdmittedResearchDetail(detail, "candidate-different");
    }],
    ["an admission status basis from another decision", (detail: Record<string, unknown>) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      detail.status_basis = {
        basis_kind: "candidate_admission_decision",
        source_ref: {
          record_kind: "candidate_admission_decision",
          id: "admission-other"
        },
        authority_status: "read_only"
      };
    }],
    ["an admission status that contradicts its decision", (detail: Record<string, unknown>) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      detail.status = "duplicate";
    }],
    ["an admitted handoff without an available selected artifact", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      configureUnavailableTerminalSelection(detail);
    }],
    ["an admitted handoff without a finding", (detail: Record<string, unknown>) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      delete (detail.terminal_graph as Record<string, unknown>).finding;
    }],
    ["an admitted lineage for another selected artifact", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      const graph = detail.terminal_graph as Record<string, unknown>;
      const lineage = graph.artifact_lineage as Record<string, unknown>;
      lineage.child_system_code_ref = {
        record_kind: "system_code",
        id: "system-code-other"
      };
    }],
    ["an admitted lineage sourced from another finding", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      const graph = detail.terminal_graph as Record<string, unknown>;
      const lineage = graph.artifact_lineage as Record<string, unknown>;
      lineage.source_finding_refs = [{
        record_kind: "research_finding",
        id: "finding-other"
      }];
    }],
    ["lineage without a handoff or available selected artifact", (
      detail: Record<string, unknown>
    ) => {
      configureLineageWithoutHandoff(detail);
      configureUnavailableTerminalSelection(detail);
    }],
    ["an evaluation lifecycle event from another record", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      mutateLifecycleSource(detail, "evaluation", "evaluation-other");
    }],
    ["an evaluation lifecycle timestamp from another record version", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      const graph = detail.terminal_graph as Record<string, unknown>;
      (graph.selected_sealed_evaluation as Record<string, unknown>).completed_at =
        "2026-07-28T00:00:00.000Z";
    }],
    ["an admission lifecycle event from another record", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      mutateLifecycleSource(detail, "admission", "admission-other");
    }],
    ["an admission lifecycle timestamp from another record version", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      const graph = detail.terminal_graph as Record<string, unknown>;
      (graph.admission as Record<string, unknown>).decided_at =
        "2026-07-28T00:00:00.000Z";
    }],
    ["a handoff lifecycle event from another record", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      mutateLifecycleSource(detail, "handoff_conformance", "conformance-other");
    }],
    ["a handoff lifecycle timestamp from another record version", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      const graph = detail.terminal_graph as Record<string, unknown>;
      (graph.paper_handoff_conformance as Record<string, unknown>).completed_at =
        "2026-07-28T00:00:00.000Z";
    }],
    ["an admitted tick lifecycle event from another record", (
      detail: Record<string, unknown>
    ) => {
      configureAdmittedResearchDetail(detail, "candidate-top-level");
      mutateLifecycleSource(detail, "tick", "tick-other");
    }],
    ["a checkpoint status basis without its lifecycle source", (
      detail: Record<string, unknown>
    ) => {
      configureLifecycleStatusBasis(
        detail,
        "research_worker_checkpoint",
        "checkpoint",
        "checkpoint-basis",
        "checkpoint-other"
      );
    }],
    ["a tick status basis without its lifecycle source", (
      detail: Record<string, unknown>
    ) => {
      configureLifecycleStatusBasis(
        detail,
        "candidate_arena_tick",
        "tick",
        "tick-basis",
        "tick-other"
      );
    }],
    ["a contradictory admission pair", (detail: Record<string, unknown>) => {
      detail.admission_decision_ref = {
        record_kind: "candidate_admission_decision",
        id: "admission-contradictory"
      };
      detail.terminal_graph = {
        authority_status: "read_only",
        admission: {
          candidate_admission_decision_ref: {
            record_kind: "candidate_admission_decision",
            id: "admission-contradictory"
          },
          status: "admitted",
          reason: "research_worker_failed",
          decided_at: "2026-07-28T00:00:01.000Z",
          authority_status: "read_only"
        }
      };
    }],
    ["a contradictory conformance pair", (detail: Record<string, unknown>) => {
      detail.paper_handoff_conformance_ref = {
        record_kind: "paper_trading_handoff_conformance",
        id: "conformance-contradictory"
      };
      detail.terminal_graph = {
        authority_status: "read_only",
        paper_handoff_conformance: {
          paper_trading_handoff_conformance_ref: {
            record_kind: "paper_trading_handoff_conformance",
            id: "conformance-contradictory"
          },
          status: "passed",
          reason: "private_or_live_authority",
          completed_at: "2026-07-28T00:00:01.000Z",
          evidence_digest: `sha256:${"b".repeat(64)}`,
          authority_status: "read_only"
        }
      };
    }],
    ["a mismatched selected artifact", (detail: Record<string, unknown>) => {
      configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
      detail.selected_submission_sequence = 1;
      detail.selected_system_code_ref = {
        record_kind: "system_code",
        id: "system-code-different"
      };
      detail.selected_system_code_artifact_digest =
        `sha256:${"c".repeat(64)}`;
    }],
    ["multiple selected submissions", (detail: Record<string, unknown>) => {
      configureTerminalSelectionDetail(detail, [
        selectedSubmissionFixture(1),
        selectedSubmissionFixture(2)
      ]);
    }],
    ["an invalid selected artifact digest", (detail: Record<string, unknown>) => {
      configureTerminalSelectionDetail(detail, []);
      detail.selected_system_code_artifact_digest = "not-a-digest";
    }]
  ])("rejects a same-ID Research detail with %s", async (_label, mutate) => {
    const detail = researchDetailResponseFixture(
      "requested-session"
    ) as unknown as Record<string, unknown>;
    mutate(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(
      String(detail.research_work_item_id)
    )).rejects.toThrow(
      "Failed to load Research session: invalid response"
    );
  });

  it("accepts an exactly bound admitted Research authority graph", async () => {
    const detail = researchDetailResponseFixture(
      "admitted-session"
    ) as unknown as Record<string, unknown>;
    configureAdmittedResearchDetail(detail, "candidate-top-level");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("accepts server-parity 200-character projection identifiers", async () => {
    const detail = researchDetailResponseFixture(
      "max-length-identifiers"
    ) as unknown as Record<string, unknown>;
    const allocationId = "a".repeat(200);
    const workItemId = researchWorkItemIdFixture(
      allocationId,
      String(detail.direction_kind)
    );
    detail.research_allocation_id = allocationId;
    detail.research_work_item_id = workItemId;
    detail.tick_id = "t".repeat(200);
    ((detail.status_basis as Record<string, unknown>)
      .source_ref as Record<string, unknown>).id = allocationId;
    (((detail.lifecycle_events as Record<string, unknown>[])[0]!
      .source_ref) as Record<string, unknown>).id = allocationId;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(workItemId)).resolves.toBe(detail);
  });

  it("accepts a selected artifact for a failed-closed Research session", async () => {
    const detail = researchDetailResponseFixture(
      "failed-closed-selected-artifact"
    ) as unknown as Record<string, unknown>;
    configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("accepts an exact admitted handoff when bounded history omits its selected row", async () => {
    const detail = researchDetailResponseFixture(
      "admitted-session-with-omitted-history"
    ) as unknown as Record<string, unknown>;
    configureAdmittedResearchDetail(detail, "candidate-top-level");
    detail.development_submissions = [];
    detail.notebook_summary = [];
    detail.notebook_summary_truncated = false;
    detail.recorded_submission_count = 1;
    detail.projected_submission_count = 0;
    detail.omitted_submission_count = 1;
    detail.submission_history_truncated = true;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(
      String(detail.research_work_item_id)
    )).resolves.toBe(detail);
  });

  it("accepts an exact admitted handoff without optional artifact lineage", async () => {
    const detail = researchDetailResponseFixture(
      "admitted-session-without-lineage"
    ) as unknown as Record<string, unknown>;
    configureAdmittedResearchDetail(detail, "candidate-top-level");
    delete (detail.terminal_graph as Record<string, unknown>).artifact_lineage;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(
      String(detail.research_work_item_id)
    )).resolves.toBe(detail);
  });

  it("accepts a running runtime basis bound to its commitment lifecycle", async () => {
    const detail = researchDetailResponseFixture(
      "running-session"
    ) as unknown as Record<string, unknown>;
    configureRunningResearchDetail(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it.each(["allocating", "failed_closed"] as const)(
    "accepts a %s runtime basis without a source ref",
    async (status) => {
      const sessionId = `${status}-runtime-session`;
      const detail = researchDetailResponseFixture(
        sessionId
      ) as unknown as Record<string, unknown>;
      configureRuntimeResearchDetail(detail, status);
      vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ research_session: detail })
      })));

      await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
        .resolves.toBe(detail);
    }
  );

  it("accepts exact selected lineage without an admitted handoff", async () => {
    const detail = researchDetailResponseFixture(
      "lineage-without-handoff"
    ) as unknown as Record<string, unknown>;
    configureLineageWithoutHandoff(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("accepts exact pre-allocation Arena trigger evidence", async () => {
    const detail = researchDetailResponseFixture(
      "trigger-evidence-session"
    ) as unknown as Record<string, unknown>;
    configureTriggerEvidenceDetail(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("keeps a recovering session incomplete when a terminal tick coexists", async () => {
    const detail = researchDetailResponseFixture(
      "recovering-with-tick"
    ) as unknown as Record<string, unknown>;
    configureRecoveringResearchDetail(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("accepts a failed-closed checkpoint basis that retains the incomplete-graph reason", async () => {
    const detail = researchDetailResponseFixture(
      "failed-closed-checkpoint-with-incomplete-graph"
    ) as unknown as Record<string, unknown>;
    configureLifecycleStatusBasis(
      detail,
      "research_worker_checkpoint",
      "checkpoint",
      "checkpoint-bound",
      "checkpoint-bound"
    );
    setDegradedReason(detail, "inactive_incomplete_graph", true);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(String(detail.research_work_item_id)))
      .resolves.toBe(detail);
  });

  it("uses the latest terminal lifecycle time for completed Research", async () => {
    const detail = researchDetailResponseFixture(
      "completed-with-checkpoint-and-tick"
    ) as unknown as Record<string, unknown>;
    configureCompletedResearchDetail(detail);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ research_session: detail })
    })));

    await expect(fetchResearchSessionDetail(
      String(detail.research_work_item_id)
    )).resolves.toBe(detail);
  });

  it("distinguishes an exact Research 404 from projection or transport unavailability", async () => {
    const missingId = canonicalResearchSessionIdFixture("missing-session");
    const genericId = canonicalResearchSessionIdFixture("generic-404");
    const mismatchedId = canonicalResearchSessionIdFixture("mismatched-session");
    const differentId = canonicalResearchSessionIdFixture("different-session");
    const extraFieldId = canonicalResearchSessionIdFixture("extra-field-session");
    const bodylessId = canonicalResearchSessionIdFixture("bodyless-session");
    const unavailableId = canonicalResearchSessionIdFixture("unavailable-session");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: "research_session_not_found",
          research_work_item_id: missingId
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: "not_found" })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: "research_session_not_found",
          research_work_item_id: differentId
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: "research_session_not_found",
          research_work_item_id: extraFieldId,
          detail: "not part of the exact absence contract"
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => {
          throw new SyntaxError("empty body");
        }
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResearchSessionDetail(missingId)).resolves.toBeUndefined();
    await expect(fetchResearchSessionDetail(genericId)).rejects.toThrow(
      "Failed to load Research session: 404"
    );
    await expect(fetchResearchSessionDetail(mismatchedId)).rejects.toThrow(
      "Failed to load Research session: 404"
    );
    await expect(fetchResearchSessionDetail(extraFieldId)).rejects.toThrow(
      "Failed to load Research session: 404"
    );
    await expect(fetchResearchSessionDetail(bodylessId)).rejects.toThrow(
      "Failed to load Research session: 404"
    );
    await expect(fetchResearchSessionDetail(unavailableId)).rejects.toThrow(
      "Failed to load Research session: 503"
    );
  });

  it("forwards one cancellation signal to operator and gateway root reads", async () => {
    const fetchMock = vi.fn(async (
      input: RequestInfo | URL,
      _init?: RequestInit
    ) => ({
      ok: true,
      status: 200,
      json: async () => String(input).endsWith("/api/operator")
        ? { operator: {} }
        : { trading_gateway_environment: {} }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await Promise.all([
      fetchOperatorReadModel(controller.signal),
      fetchTradingGatewayEnvironment(controller.signal)
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
  });

  it("drives exact Research detail from hash selection outside the bounded summary list", () => {
    const appSource = readFileSync(join(srcRoot, "App.tsx"), "utf8");
    expect(selectedResearchDetailWorkItemId(undefined, "research-session-1"))
      .toBe("research-session-1");
    const compatibilityOnlyOperator = {
      research_operations: undefined,
      candidate_arena: {
        latest_ticks: [{ tick_id: "research-session-1" }]
      }
    };
    expect(selectedResearchDetailWorkItemId(
      compatibilityOnlyOperator,
      "research-session-1"
    )).toBe("research-session-1");
    expect(selectedResearchDetailWorkItemId({
      research_operations: {
        sessions: [{ research_work_item_id: "research-session-1" }]
      }
    }, "research-session-1")).toBe("research-session-1");
    expect(selectedResearchDetailWorkItemId({
      research_operations: {
        sessions: [{ research_work_item_id: "research-session-1" }]
      }
    }, "outside-bounded-summary")).toBe("outside-bounded-summary");
    expect(appSource).toContain('route.section === "research"');
    expect(appSource).toContain(
      "useOperatorRuntime(selectedArenaSystemId, selectedResearchWorkItemId)"
    );
  });

  it("retains only same-ID last-safe Research session detail when a refresh fails", () => {
    const first = {
      research_work_item_id: "research-session-1"
    } as unknown as ResearchSessionDetailReadModel;
    const second = {
      research_work_item_id: "research-session-2"
    } as unknown as ResearchSessionDetailReadModel;
    const rejected = {
      status: "rejected",
      reason: new Error("detail transport unavailable")
    } as const;

    expect(settleResearchDetailRefresh({
      selectedResearchWorkItemId: "research-session-1",
      currentDetail: first,
      result: rejected
    })).toEqual({
      researchDetail: first,
      researchDetailLoading: false,
      researchDetailError: "detail transport unavailable"
    });
    expect(settleResearchDetailRefresh({
      selectedResearchWorkItemId: "research-session-2",
      currentDetail: first,
      result: rejected
    })).toEqual({
      researchDetail: undefined,
      researchDetailLoading: false,
      researchDetailError: "detail transport unavailable"
    });
    expect(settleResearchDetailRefresh({
      selectedResearchWorkItemId: undefined,
      currentDetail: first,
      result: { status: "fulfilled", value: second }
    })).toEqual({
      researchDetail: undefined,
      researchDetailLoading: false,
      researchDetailError: undefined
    });
  });

  it("rejects stale Research session responses and shares the one hidden-aware refresh timer", () => {
    const runtimeSource = readFileSync(
      join(srcRoot, "app", "use-operator-runtime.ts"),
      "utf8"
    );
    expect(isOperatorRuntimeRequestCurrent(true, 1, 2)).toBe(false);
    expect(isOperatorRuntimeRequestCurrent(true, 2, 2)).toBe(true);
    expect(isOperatorRuntimeRequestCurrent(false, 2, 2)).toBe(false);
    expect(shouldRunAutomaticOperatorRefresh("hidden")).toBe(false);
    expect(shouldRunAutomaticOperatorRefresh("visible")).toBe(true);
    expect(runtimeSource.match(/if \(!isOperatorRuntimeRequestCurrent/g))
      .toHaveLength(1);
    expect(runtimeSource.match(/window\.setInterval/g)).toHaveLength(1);
    expect(runtimeSource).toContain("5_000");
  });

  it("refreshes the latest Research session after selection changes during a command", () => {
    const runtimeSource = readFileSync(
      join(srcRoot, "app", "use-operator-runtime.ts"),
      "utf8"
    );
    const detailA = {
      research_work_item_id: "research-session-a"
    } as unknown as ResearchSessionDetailReadModel;
    const completedCommand = {
      status: "succeeded" as const,
      label: "Run command",
      message: "Run command completed"
    };
    const state: OperatorRuntimeState = {
      researchDetail: detailA,
      loading: false,
      refreshing: false,
      arenaDetailLoading: false,
      researchDetailLoading: false,
      researchDetailError: "old detail error",
      command: completedCommand
    };

    expect(stateAfterOperatorSelectionChange(
      state,
      undefined,
      "research-session-b"
    )).toMatchObject({
      researchDetail: undefined,
      researchDetailLoading: false,
      researchDetailError: undefined,
      command: completedCommand
    });
    expect(stateAfterOperatorSelectionChange(
      state,
      undefined,
      "research-session-a"
    )).toMatchObject({
      researchDetail: detailA,
      researchDetailError: "old detail error"
    });
    expect(isOperatorRuntimeSelectionCurrent(
      "arena-a",
      "research-session-a",
      "arena-a",
      "research-session-a"
    )).toBe(true);
    expect(isOperatorRuntimeSelectionCurrent(
      "arena-a",
      "research-session-a",
      "arena-a",
      "research-session-b"
    )).toBe(false);
    expect(isOperatorRuntimeSelectionCurrent(
      "arena-a",
      "research-session-a",
      "arena-b",
      "research-session-a"
    )).toBe(false);

    expect(runtimeSource).toContain(
      "const selectedArenaSystemIdRef = useRef(selectedArenaSystemId);"
    );
    expect(runtimeSource).toContain(
      "const selectedResearchWorkItemIdRef = useRef(selectedResearchWorkItemId);"
    );
    expect(runtimeSource).toContain(
      "selectedResearchWorkItemIdRef.current = selectedResearchWorkItemId;"
    );
    expect(runtimeSource).toContain("const refreshRequestSequenceRef = useRef(0);");
    expect(runtimeSource).toContain("const commandRequestSequenceRef = useRef(0);");
    expect(runtimeSource).toContain("const performRefresh = useCallback(async () => {");
    expect(runtimeSource).toContain("const refresh = useCallback((): Promise<void> => {");
    expect(runtimeSource).not.toContain(
      "}, [selectedArenaSystemId, selectedResearchWorkItemId]);"
    );
    expect(runtimeSource.indexOf("if (commandRunningRef.current)")).toBeLessThan(
      runtimeSource.indexOf("const sequence = ++refreshRequestSequenceRef.current")
    );
    expect(runtimeSource.match(/!isOperatorRuntimeSelectionCurrent/g))
      .toHaveLength(1);
    expect(runtimeSource).toContain("void refresh();");
  });

  it("moves focus into narrow Arena and Research detail panes", () => {
    const arenaSource = readFileSync(
      join(srcRoot, "screens", "arena-screen.tsx"),
      "utf8"
    );
    expect(arenaSource).toContain("focusNarrowDetail(detailFocusRef.current)");
    expect(arenaSource).toContain("backButtonRef={detailFocusRef}");
    expect(arenaSource).toContain("ref={backButtonRef}");

    const researchSource = readFileSync(
      join(srcRoot, "screens", "research-screen.tsx"),
      "utf8"
    );
    expect(researchSource).toContain("focusNarrowDetail(detailHeadingRef.current)");
    expect(researchSource).toContain("detailHeadingRef={detailHeadingRef}");
    expect(researchSource).toContain("ref={detailHeadingRef}");
    expect(researchSource).toContain("tabIndex={-1}");
  });

  it("keeps CandidateArena generation controls on the Research surface", () => {
    const arenaSource = readFileSync(
      join(srcRoot, "screens", "arena-screen.tsx"),
      "utf8"
    );
    const researchSource = readFileSync(
      join(srcRoot, "screens", "research-screen.tsx"),
      "utf8"
    );

    for (const command of ["start", "tick", "cycle", "stop"]) {
      const request = `command_kind: "arena.${command}"`;
      expect(arenaSource).not.toContain(request);
      expect(researchSource).toContain(request);
    }
  });

  it("renders actual Arena summary evidence with inspectable commands", () => {
    const view: ArenaWorkspaceViewModel = {
      availability: "authoritative",
      loopStatus: "running",
      capacity: {
        max_concurrent_sessions: 2,
        active_session_count: 1,
        queued_session_count: 0
      },
      latestSystemId: "candidate-1",
      emptyState: "none",
      systems: [{
        id: "candidate-1",
        versionId: "candidate-1-v1",
        evaluationId: "evaluation-1",
        tradingRunId: "run-1",
        name: "Adaptive trend",
        direction: "trend_following",
        lifecycle: "running",
        runnerStatus: "active",
        sandboxStatus: "running",
        latestDecision: "hold",
        rankStatus: "provisional_ranked",
        rank: 1,
        comparability: "comparable",
        unrankedReasons: [],
        qualificationReasons: [],
        netRevenueUsdt: 12,
        netReturnPct: 1.2,
        revenueUsdt: 15,
        costUsdt: 3,
        observationCount: 20,
        failedObservationCount: 0,
        source: "arena_operations",
        detailAvailability: "summary_only"
      }]
    };
    const detail: ArenaSystemDetailViewModel = {
      id: "candidate-1",
      admissionDecisionId: "admission-1",
      handoffConformanceId: "handoff-1",
      isolation: {
        isolationId: "sandbox-1",
        sandboxStatus: "running",
        workspaceIdentity: "workspace-1",
        networkPolicyStatus: "verified",
        egressAttestationStatus: "verified"
      },
      manifest: {
        summary: "Adaptive trend artifact",
        declaredRuntime: "python",
        declaredOutputs: ["order_request"],
        allowedStages: ["paper"],
        declaredPermissions: ["public_market_data"],
        forbiddenContents: ["credentials"]
      },
      openOrders: [],
      traceEvents: [{
        sequence: 1,
        occurredAt: "2026-07-18T00:20:00.000Z",
        eventKind: "recovery",
        summary: "Restart recovery completed",
        recordRef: undefined
      }],
      logEntries: [{
        sequence: 1,
        occurredAt: "2026-07-18T00:20:01.000Z",
        level: "info",
        source: "sandbox",
        message: "paper log line"
      }],
      artifactRefs: [{ record_kind: "system_code", id: "code-1" }],
      traceTruncated: false,
      logsTruncated: false
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        detail={detail}
        detailLoading={false}
        selectedId="candidate-1"
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Adaptive trend");
    expect(markup).toContain("12.00 USDT");
    expect(markup).toContain("Runner active");
    expect(markup).toContain("Sandbox running");
    expect(markup).toContain("> Evidence</button>");
    expect(markup).toContain("workspace-1");
    expect(markup).toContain("Restart recovery completed");
    expect(markup).toContain("paper log line");
    expect(markup).not.toContain("Trace, logs, and sandbox detail unavailable");
  });

  it("excludes unranked Arena revenue from the comparable headline", () => {
    const ranked: ArenaWorkspaceViewModel["systems"][number] = {
      id: "ranked-candidate",
      name: "Ranked candidate",
      lifecycle: "running",
      rankStatus: "provisional_ranked",
      rank: 1,
      comparability: "comparable",
      unrankedReasons: [],
      qualificationReasons: [],
      netRevenueUsdt: 4,
      observationCount: 10,
      failedObservationCount: 0,
      source: "arena_operations",
      detailAvailability: "summary_only"
    };
    const view: ArenaWorkspaceViewModel = {
      availability: "authoritative",
      loopStatus: "running",
      emptyState: "none",
      systems: [ranked, {
        ...ranked,
        id: "ineligible-candidate",
        name: "Ineligible candidate",
        rankStatus: "unranked",
        rank: undefined,
        comparability: "ineligible",
        unrankedReasons: ["evidence_purpose_not_rankable"],
        netRevenueUsdt: 999
      }]
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("4.00 USDT");
    expect(markup).not.toContain("1,003.00 USDT");
  });

  it("bounds Arena rows while preserving a selected system outside the first page", () => {
    const systems: ArenaWorkspaceViewModel["systems"] = Array.from(
      { length: 65 },
      (_, index) => ({
        id: `candidate-${String(index).padStart(3, "0")}`,
        name: `Candidate ${String(index).padStart(3, "0")}`,
        lifecycle: "stopped",
        rankStatus: "unranked",
        comparability: "comparable",
        unrankedReasons: [],
        qualificationReasons: [],
        observationCount: 0,
        failedObservationCount: 0,
        source: "arena_operations",
        detailAvailability: "summary_only"
      })
    );
    const view: ArenaWorkspaceViewModel = {
      availability: "authoritative",
      loopStatus: "stopped",
      emptyState: "none",
      systems
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        selectedId="candidate-064"
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain(">Candidate 058<");
    expect(markup).not.toContain(">Candidate 059<");
    expect(markup.split(">Candidate 064<")).toHaveLength(3);
  });

  it("renders completed Research ticks as history without inventing sessions", () => {
    const view: ResearchWorkspaceViewModel = {
      availability: "history_only",
      loopStatus: "projection_pending",
      sessions: [],
      history: [{
        id: "tick-1",
        status: "completed",
        startedAt: "2026-07-18T00:00:00.000Z",
        completedAt: "2026-07-18T00:05:00.000Z",
        createdCandidateCount: 1,
        createdCandidateIds: ["candidate-1"],
        directionCount: 2,
        failedDirectionCount: 1,
        sourceCandidate: {
          sourceKind: "paper_board_leader",
          candidateId: "source-candidate",
          displayName: "Source candidate",
          netRevenueUsdt: 12
        },
        directions: [{
          direction: "trend_following",
          status: "created",
          candidateId: "candidate-1",
          researchEfficiency: {
            providerRequestTotal: 2,
            runnerCommandTotal: 3,
            scenarioCount: 4,
            elapsedMs: 500,
            authorityStatus: "not_promotion_authority"
          }
        }, {
          direction: "mean_reversion",
          status: "failed",
          error: "provider_unavailable"
        }]
      }],
      findingClusters: [],
      emptyState: "projection_unavailable"
    };

    const markup = renderToStaticMarkup(
      <ResearchScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Research session projection pending");
    expect(markup).toContain("Tick history 1");
    expect(markup).toContain("1 generated · 1 failed · 2 directions");
    expect(markup).toContain("Source candidate");
    expect(markup).toContain("Trend Following");
    expect(markup).toContain("candidate-1");
    expect(markup).toContain("2 provider · 3 runner · 4 scenarios · 500ms");
    expect(markup).toContain(
      "Research direction failed; failure detail is unavailable."
    );
    expect(markup).not.toContain("provider_unavailable");
    expect(markup).not.toContain("Filter Research sessions");
    expect(markup).not.toContain("configured-only");
  });

  it("renders read-only Research learning context without inventing a session", () => {
    const view = {
      availability: "history_only",
      loopStatus: "stopped",
      sessions: [],
      history: [],
      emptyState: "projection_unavailable",
      paperLearning: {
        rank: 2,
        net_revenue_usdt: 7,
        net_return_pct: 0.7,
        observation_count: 18,
        qualification_status: "collecting_evidence",
        qualification_reasons: ["min_observation_count_not_met"],
        top_blocker: "min_observation_count_not_met",
        summary: "Paper evidence is positive but incomplete.",
        next_research_focus: "Test slower cadence variants.",
        authority_status: "lineage_only"
      },
      generalization: {
        status: "collecting",
        protocol_count: 1,
        outcome_count: 0,
        active_protocol: null,
        latest_outcome: null,
        latest_policy_decision: null,
        effective_policy_decision: null,
        authority_status: "not_promotion_authority"
      },
      findingClusters: [{
        direction_kind: "trend_following",
        top_blocker: "min_observation_count_not_met",
        blocker_group_kind: "evidence_window",
        market_regime: "long",
        candidate_count: 2,
        candidate_ids: ["candidate-1", "candidate-2"],
        latest_finding: "Needs a longer evidence window.",
        next_research_focus: "Test slower cadence variants.",
        authority_status: "not_promotion_authority"
      }]
    } as unknown as ResearchWorkspaceViewModel;

    const markup = renderToStaticMarkup(
      <ResearchScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Paper evidence learning");
    expect(markup).toContain("Paper evidence is positive but incomplete.");
    expect(markup).toContain("Research generalization");
    expect(markup).toContain("Research learning clusters");
    expect(markup).toContain("Test slower cadence variants.");
    expect(markup).not.toContain("Filter Research sessions");
  });

  it("distinguishes loop state from projection availability", () => {
    const view: ArenaWorkspaceViewModel = {
      availability: "unavailable",
      loopStatus: "stopped",
      systems: [],
      emptyState: "projection_unavailable"
    };

    const markup = renderToStaticMarkup(
      <ArenaScreen
        view={view}
        commandRunning={false}
        onSelect={vi.fn()}
        onCommand={vi.fn()}
      />
    );

    expect(markup).toContain("Loop stopped");
    expect(markup).toContain("Projection unavailable");
  });
});

function researchDetailResponseFixture(
  _label: string
): ResearchSessionDetailReadModel {
  const researchAllocationId = "allocation-api-detail";
  const directionKind = "trend_following" as const;
  const researchWorkItemId = researchWorkItemIdFixture(
    researchAllocationId,
    directionKind
  );
  return {
    identity_kind: "derived_projection",
    research_work_item_id: researchWorkItemId,
    research_allocation_id: researchAllocationId,
    tick_id: "tick-api-detail",
    direction_kind: directionKind,
    status: "queued",
    status_basis: {
      basis_kind: "active_tick_queue",
      source_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: "allocation-api-detail"
      },
      authority_status: "read_only"
    },
    projection_health: "degraded",
    degraded_reasons: [
      "trigger_unavailable",
      "methodology_unavailable",
      "provider_unavailable",
      "worker_unavailable",
      "selected_artifact_unavailable"
    ],
    budget: {
      max_experiment_count: 1,
      completed_experiment_count: 0,
      max_development_submission_count: 1,
      development_submission_count: 0,
      remaining_development_submission_count: 1,
      authority_status: "research_only"
    },
    allocated_at: "2026-07-28T00:00:00.000Z",
    last_progress_at: "2026-07-28T00:00:00.000Z",
    latest_progress_summary: "Queued for bounded Research.",
    latest_progress_summary_truncated: false,
    trigger_availability: "unavailable",
    methodology_availability: "unavailable",
    provider_availability: "unavailable",
    authority_status: "research_only",
    evidence_inputs: [],
    development_submissions: [],
    notebook_summary: [],
    notebook_summary_truncated: false,
    lifecycle_events: [{
      sequence: 1,
      occurred_at: "2026-07-28T00:00:00.000Z",
      event_kind: "allocation",
      summary: "Research allocation recorded.",
      summary_truncated: false,
      source_ref: {
        record_kind: "candidate_arena_research_allocation",
        id: "allocation-api-detail"
      },
      sanitized: true,
      authority_status: "read_only"
    }],
    provider_logs_availability: "not_persisted",
    terminal_graph: { authority_status: "read_only" },
    submission_history_availability: "unavailable_until_checkpoint",
    selected_artifact_availability: "unavailable"
  };
}

function researchWorkItemIdFixture(
  researchAllocationId: string,
  directionKind: string
): string {
  const digest = createHash("sha256").update(JSON.stringify({
    research_allocation_id: researchAllocationId,
    direction_kind: directionKind
  })).digest("hex");
  return `research-session-v1-${digest}`;
}

function canonicalResearchSessionIdFixture(label: string): string {
  return `research-session-v1-${createHash("sha256").update(label).digest("hex")}`;
}

function setDegradedReason(
  detail: Record<string, unknown>,
  reason: string,
  present: boolean
): void {
  const reasons = detail.degraded_reasons as string[];
  detail.degraded_reasons = present
    ? [...new Set([...reasons, reason])]
    : reasons.filter((entry) => entry !== reason);
  detail.projection_health = (detail.degraded_reasons as string[]).length === 0
    ? "complete"
    : "degraded";
}

function configureRuntimeResearchDetail(
  detail: Record<string, unknown>,
  status: "allocating" | "failed_closed"
): void {
  detail.status = status;
  detail.status_basis = {
    basis_kind: "runtime_research_work_item",
    authority_status: "read_only"
  };
  setDegradedReason(detail, "inactive_incomplete_graph", false);
}

function configureRunningResearchDetail(detail: Record<string, unknown>): void {
  detail.status = "running";
  detail.commitment_id = "commitment-bound";
  detail.started_at = "2026-07-28T00:00:01.000Z";
  detail.last_progress_at = "2026-07-28T00:00:01.000Z";
  detail.status_basis = {
    basis_kind: "runtime_research_work_item",
    source_ref: {
      record_kind: "research_preflight_commitment",
      id: "commitment-bound"
    },
    authority_status: "read_only"
  };
  detail.lifecycle_events = [
    ...(detail.lifecycle_events as Record<string, unknown>[]),
    {
      sequence: 2,
      occurred_at: "2026-07-28T00:00:01.000Z",
      event_kind: "commitment",
      summary: "Research preflight committed.",
      summary_truncated: false,
      source_ref: {
        record_kind: "research_preflight_commitment",
        id: "commitment-bound"
      },
      sanitized: true,
      authority_status: "read_only"
    }
  ];
}

function configureRecoveringResearchDetail(detail: Record<string, unknown>): void {
  detail.status = "recovering";
  detail.status_basis = {
    basis_kind: "incomplete_persisted_graph",
    authority_status: "read_only"
  };
  setDegradedReason(detail, "inactive_incomplete_graph", true);
  detail.last_progress_at = "2026-07-28T00:00:01.000Z";
  detail.lifecycle_events = [
    ...(detail.lifecycle_events as Record<string, unknown>[]),
    {
      sequence: 2,
      occurred_at: "2026-07-28T00:00:01.000Z",
      event_kind: "tick",
      summary: "Terminal tick awaits graph recovery.",
      summary_truncated: false,
      source_ref: {
        record_kind: "candidate_arena_tick",
        id: "tick-awaiting-recovery"
      },
      sanitized: true,
      authority_status: "read_only"
    }
  ];
}

function configureCompletedResearchDetail(detail: Record<string, unknown>): void {
  configureLifecycleStatusBasis(
    detail,
    "research_worker_checkpoint",
    "checkpoint",
    "checkpoint-bound",
    "checkpoint-bound"
  );
  detail.completed_at = "2026-07-28T00:00:02.000Z";
  detail.last_progress_at = "2026-07-28T00:00:02.000Z";
  detail.lifecycle_events = [
    ...(detail.lifecycle_events as Record<string, unknown>[]),
    {
      sequence: 3,
      occurred_at: "2026-07-28T00:00:02.000Z",
      event_kind: "tick",
      summary: "Candidate Arena tick completed.",
      summary_truncated: false,
      source_ref: {
        record_kind: "candidate_arena_tick",
        id: "tick-after-checkpoint"
      },
      sanitized: true,
      authority_status: "read_only"
    }
  ];
}

function configureLineageWithoutHandoff(detail: Record<string, unknown>): void {
  configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
  const admittedGraph = admittedTerminalGraphFixture("candidate-unused");
  detail.terminal_graph = {
    finding: admittedGraph.finding,
    artifact_lineage: admittedGraph.artifact_lineage,
    authority_status: "read_only"
  };
}

function configureTriggerEvidenceDetail(detail: Record<string, unknown>): void {
  const sourceRef = {
    record_kind: "paper_trading_evaluation",
    id: "paper-evaluation-trigger"
  };
  const evidenceDigest = `sha256:${"f".repeat(64)}`;
  detail.trigger_availability = "available";
  setDegradedReason(detail, "trigger_unavailable", false);
  detail.trigger = {
    trigger_kind: "arena_event",
    trigger_id: "trigger-bound",
    goal: "Investigate exact bounded paper evidence.",
    goal_truncated: false,
    triggered_at: "2026-07-27T23:59:59.000Z",
    source_ref: sourceRef,
    evidence_artifact_ref: {
      record_kind: "research_evidence_artifact",
      id: "evidence-trigger"
    },
    evidence_artifact_digest: evidenceDigest,
    authority_status: "research_only"
  };
  detail.evidence_inputs = [{
    evidence_artifact_id: "evidence-trigger",
    source_kind: "arena_paper_result",
    subject_ref: {
      record_kind: "trading_system_candidate",
      id: "candidate-trigger"
    },
    artifact_ref: sourceRef,
    artifact_digest: evidenceDigest,
    summary: "Sanitized bounded trigger evidence.",
    truncated: false,
    captured_at: "2026-07-27T23:59:58.000Z",
    sanitization_status: "sanitized",
    qualification_evidence_hidden: true,
    authority_status: "research_only"
  }];
}

function admittedTerminalGraphFixture(candidateId: string): Record<string, unknown> {
  return {
    authority_status: "read_only",
    selected_sealed_evaluation: {
      trading_evaluation_result_ref: {
        record_kind: "trading_evaluation_result",
        id: "evaluation-bound"
      },
      experiment_run_ref: {
        record_kind: "experiment_run",
        id: "experiment-bound"
      },
      evaluation_phase: "sealed_admission",
      result_status: "accepted",
      evidence_disposition: "not_counted",
      completed_at: "2026-07-28T00:00:01.000Z",
      authority_status: "read_only"
    },
    admission: {
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-bound"
      },
      status: "admitted",
      reason: "evaluation_accepted",
      decided_at: "2026-07-28T00:00:01.000Z",
      authority_status: "read_only"
    },
    paper_handoff_conformance: {
      paper_trading_handoff_conformance_ref: {
        record_kind: "paper_trading_handoff_conformance",
        id: "conformance-bound"
      },
      status: "passed",
      reason: "passed",
      completed_at: "2026-07-28T00:00:01.000Z",
      evidence_digest: `sha256:${"a".repeat(64)}`,
      authority_status: "read_only"
    },
    finding: {
      research_finding_ref: {
        record_kind: "research_finding",
        id: "finding-bound"
      },
      finding_kind: "positive_result",
      summary: "Selected evidence remained bounded.",
      summary_truncated: false,
      supporting_record_refs: [{
        record_kind: "trading_evaluation_result",
        id: "evaluation-bound"
      }],
      created_at: "2026-07-28T00:00:01.000Z",
      sanitized: true,
      authority_status: "read_only"
    },
    artifact_lineage: {
      artifact_lineage_ref: {
        record_kind: "artifact_lineage",
        id: "lineage-bound"
      },
      child_system_code_ref: {
        record_kind: "system_code",
        id: "system-code-1"
      },
      source_finding_refs: [{
        record_kind: "research_finding",
        id: "finding-bound"
      }],
      created_at: "2026-07-28T00:00:01.000Z",
      authority_status: "read_only"
    },
    admitted_arena_handoff: {
      candidate_arena_tick_ref: {
        record_kind: "candidate_arena_tick",
        id: "tick-bound"
      },
      candidate_ref: {
        record_kind: "trading_system_candidate",
        id: candidateId
      },
      direction_kind: "trend_following",
      candidate_admission_decision_ref: {
        record_kind: "candidate_admission_decision",
        id: "admission-bound"
      },
      completed_at: "2026-07-28T00:00:02.000Z",
      authority_status: "read_only"
    }
  };
}

function configureAdmittedResearchDetail(
  detail: Record<string, unknown>,
  terminalCandidateId: string
): void {
  configureTerminalSelectionDetail(detail, [selectedSubmissionFixture(1)]);
  detail.status = "admitted";
  detail.status_basis = {
    basis_kind: "candidate_admission_decision",
    source_ref: {
      record_kind: "candidate_admission_decision",
      id: "admission-bound"
    },
    authority_status: "read_only"
  };
  setDegradedReason(detail, "inactive_incomplete_graph", false);
  detail.budget = {
    max_experiment_count: 1,
    completed_experiment_count: 1,
    max_development_submission_count: 1,
    development_submission_count: 1,
    remaining_development_submission_count: 0,
    authority_status: "research_only"
  };
  detail.completed_at = "2026-07-28T00:00:02.000Z";
  detail.admitted_candidate_id = "candidate-top-level";
  detail.admission_decision_ref = {
    record_kind: "candidate_admission_decision",
    id: "admission-bound"
  };
  detail.paper_handoff_conformance_ref = {
    record_kind: "paper_trading_handoff_conformance",
    id: "conformance-bound"
  };
  detail.terminal_graph = admittedTerminalGraphFixture(terminalCandidateId);
  detail.last_progress_at = "2026-07-28T00:00:02.000Z";
  detail.lifecycle_events = admittedLifecycleEventsFixture();
}

function admittedLifecycleEventsFixture(): Record<string, unknown>[] {
  const events = [{
    occurred_at: "2026-07-28T00:00:00.000Z",
    event_kind: "allocation",
    summary: "Research allocation recorded.",
    source_ref: {
      record_kind: "candidate_arena_research_allocation",
      id: "allocation-api-detail"
    }
  }, {
    occurred_at: "2026-07-28T00:00:01.000Z",
    event_kind: "admission",
    summary: "Candidate admission admitted.",
    source_ref: {
      record_kind: "candidate_admission_decision",
      id: "admission-bound"
    }
  }, {
    occurred_at: "2026-07-28T00:00:01.000Z",
    event_kind: "evaluation",
    summary: "Sealed evaluation accepted.",
    source_ref: {
      record_kind: "trading_evaluation_result",
      id: "evaluation-bound"
    }
  }, {
    occurred_at: "2026-07-28T00:00:01.000Z",
    event_kind: "handoff_conformance",
    summary: "Paper handoff conformance passed.",
    source_ref: {
      record_kind: "paper_trading_handoff_conformance",
      id: "conformance-bound"
    }
  }, {
    occurred_at: "2026-07-28T00:00:02.000Z",
    event_kind: "tick",
    summary: "Candidate Arena tick completed.",
    source_ref: {
      record_kind: "candidate_arena_tick",
      id: "tick-bound"
    }
  }];
  return events.map((event, index) => ({
    ...event,
    sequence: index + 1,
    summary_truncated: false,
    sanitized: true,
    authority_status: "read_only"
  }));
}

function configureUnavailableTerminalSelection(
  detail: Record<string, unknown>
): void {
  detail.development_submissions = [];
  detail.notebook_summary = [];
  detail.notebook_summary_truncated = false;
  detail.recorded_submission_count = 0;
  detail.projected_submission_count = 0;
  detail.omitted_submission_count = 0;
  detail.submission_history_truncated = false;
  detail.budget = {
    max_experiment_count: 1,
    completed_experiment_count: 1,
    max_development_submission_count: 1,
    development_submission_count: 0,
    remaining_development_submission_count: 1,
    authority_status: "research_only"
  };
  detail.selected_artifact_availability = "unavailable";
  setDegradedReason(detail, "selected_artifact_unavailable", true);
  delete detail.selected_submission_sequence;
  delete detail.selected_system_code_ref;
  delete detail.selected_system_code_artifact_digest;
}

function mutateLifecycleSource(
  detail: Record<string, unknown>,
  eventKind: string,
  sourceId: string
): void {
  const events = detail.lifecycle_events as Record<string, unknown>[];
  const event = events.find((entry) => entry.event_kind === eventKind)!;
  const source = event.source_ref as Record<string, unknown>;
  source.id = sourceId;
}

function configureLifecycleStatusBasis(
  detail: Record<string, unknown>,
  basisKind: "research_worker_checkpoint" | "candidate_arena_tick",
  eventKind: "checkpoint" | "tick",
  basisId: string,
  eventId: string
): void {
  detail.status = "failed_closed";
  detail.status_basis = {
    basis_kind: basisKind,
    source_ref: {
      record_kind: basisKind,
      id: basisId
    },
    authority_status: "read_only"
  };
  setDegradedReason(detail, "inactive_incomplete_graph", false);
  detail.completed_at = "2026-07-28T00:00:01.000Z";
  detail.last_progress_at = "2026-07-28T00:00:01.000Z";
  detail.lifecycle_events = [
    ...(detail.lifecycle_events as Record<string, unknown>[]),
    {
      sequence: 2,
      occurred_at: "2026-07-28T00:00:01.000Z",
      event_kind: eventKind,
      summary: "Terminal Research lifecycle recorded.",
      summary_truncated: false,
      source_ref: {
        record_kind: basisKind,
        id: eventId
      },
      sanitized: true,
      authority_status: "read_only"
    }
  ];
}

function configureTerminalSelectionDetail(
  detail: Record<string, unknown>,
  submissions: Record<string, unknown>[]
): void {
  detail.status = "failed_closed";
  detail.status_basis = {
    basis_kind: "incomplete_persisted_graph",
    authority_status: "read_only"
  };
  setDegradedReason(detail, "inactive_incomplete_graph", true);
  detail.development_submissions = submissions;
  detail.notebook_summary = submissions.map((submission) => submission.summary);
  detail.notebook_summary_truncated = submissions.some(
    (submission) => submission.summary_truncated === true
  );
  detail.submission_history_availability = "checkpoint_summary";
  detail.recorded_submission_count = submissions.length;
  detail.projected_submission_count = submissions.length;
  detail.omitted_submission_count = 0;
  detail.submission_history_truncated = false;
  const maxDevelopmentSubmissionCount = Math.max(1, submissions.length);
  detail.budget = {
    max_experiment_count: 1,
    completed_experiment_count: 0,
    max_development_submission_count: maxDevelopmentSubmissionCount,
    development_submission_count: submissions.length,
    remaining_development_submission_count:
      maxDevelopmentSubmissionCount - submissions.length,
    authority_status: "research_only"
  };
  detail.selected_artifact_availability = "available";
  setDegradedReason(detail, "selected_artifact_unavailable", false);
  detail.selected_submission_sequence = 1;
  detail.selected_system_code_ref = {
    record_kind: "system_code",
    id: "system-code-1"
  };
  detail.selected_system_code_artifact_digest = `sha256:${"d".repeat(64)}`;
}

function selectedSubmissionFixture(sequence: number): Record<string, unknown> {
  return {
    submission_sequence: sequence,
    decision: "keep",
    agent_status: "edited",
    evaluation_status: "accepted",
    risk_decision: "valid_order_request",
    net_revenue_usdt: 1,
    summary: `Selected submission ${sequence}.`,
    summary_truncated: false,
    authority_status: "research_only",
    selected: true,
    artifact_availability: "selected_system_code_available",
    selected_system_code_ref: {
      record_kind: "system_code",
      id: `system-code-${sequence}`
    },
    selected_system_code_artifact_digest: sequence === 1
      ? `sha256:${"d".repeat(64)}`
      : `sha256:${"e".repeat(64)}`
  };
}

function unselectedSubmissionFixture(sequence: number): Record<string, unknown> {
  return {
    submission_sequence: sequence,
    decision: "discard",
    agent_status: "no_change",
    evaluation_status: "disqualified",
    risk_decision: "no_order_request",
    net_revenue_usdt: 0,
    summary: `Unselected submission ${sequence}.`,
    summary_truncated: false,
    authority_status: "research_only",
    selected: false,
    artifact_availability: "not_persisted"
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
