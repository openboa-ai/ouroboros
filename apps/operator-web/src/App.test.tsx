import { existsSync, readFileSync } from "node:fs";
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

  it("fetches one exact Research session path segment with one encoding pass", async () => {
    const detail = {
      research_work_item_id: "research/session 1"
    } as unknown as ResearchSessionDetailReadModel;
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
      "research/session 1",
      controller.signal
    )).resolves.toBe(detail);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /\/api\/research\/sessions\/research%2Fsession%201$/
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
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
    ).researchDetail).toBe(detailA);
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
