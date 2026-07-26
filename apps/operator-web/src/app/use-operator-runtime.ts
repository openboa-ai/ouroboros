import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArenaTradingSystemDetailReadModel,
  OperatorReadModel,
  OuroborosCommandRequest,
  ResearchSessionDetailReadModel,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import {
  fetchArenaTradingSystemDetail,
  fetchOperatorReadModel,
  fetchResearchSessionDetail,
  fetchTradingGatewayEnvironment,
  submitOuroborosCommand
} from "../api";

const OPERATOR_REFRESH_INTERVAL_MS = 5_000;
const OPERATOR_ROOT_REFRESH_DEADLINE_MS = 4_000;
const OPERATOR_DETAIL_REFRESH_DEADLINE_MS = 4_000;

export interface OperatorCommandState {
  status: "idle" | "running" | "succeeded" | "failed";
  label?: string;
  message?: string;
}

export interface OperatorRuntimeState {
  operator?: OperatorReadModel;
  gateway?: TradingGatewayEnvironmentReadModel;
  arenaDetail?: ArenaTradingSystemDetailReadModel;
  researchDetail?: ResearchSessionDetailReadModel;
  loading: boolean;
  refreshing: boolean;
  arenaDetailLoading: boolean;
  researchDetailLoading: boolean;
  operatorError?: string;
  gatewayError?: string;
  arenaDetailError?: string;
  researchDetailError?: string;
  lastOperatorReadAt?: string;
  command: OperatorCommandState;
}

export interface OperatorRuntimeController extends OperatorRuntimeState {
  refresh: () => Promise<void>;
  executeCommand: (
    label: string,
    request: OuroborosCommandRequest
  ) => Promise<OperatorReadModel | undefined>;
}

const INITIAL_STATE: OperatorRuntimeState = {
  loading: true,
  refreshing: false,
  arenaDetailLoading: false,
  researchDetailLoading: false,
  command: { status: "idle" }
};

interface DetailRefreshLane {
  request: (detailId: string | undefined) => void;
  cancel: () => void;
}

function createDetailRefreshLane<T>(options: {
  detailName: "Arena" | "Research";
  fetchDetail: (detailId: string, signal: AbortSignal) => Promise<T>;
  isCurrent: (detailId: string) => boolean;
  settle: (detailId: string, result: PromiseSettledResult<T>) => void;
}): DetailRefreshLane {
  let desiredDetailId: string | undefined;
  let queued = false;
  let active: {
    detailId: string;
    controller: AbortController;
    token: symbol;
    deadline: ReturnType<typeof globalThis.setTimeout>;
  } | undefined;

  const cancel = (): void => {
    desiredDetailId = undefined;
    queued = false;
    const stale = active;
    active = undefined;
    if (stale) {
      globalThis.clearTimeout(stale.deadline);
      stale.controller.abort();
    }
  };

  const start = (detailId: string): void => {
    queued = false;
    const controller = new AbortController();
    const token = Symbol(detailId);
    const deadline = globalThis.setTimeout(() => {
      const error = new Error(
        `${options.detailName} detail refresh exceeded ${OPERATOR_DETAIL_REFRESH_DEADLINE_MS}ms deadline`
      );
      controller.abort(error);
      finish(detailId, token, {
        status: "rejected",
        reason: error
      });
    }, OPERATOR_DETAIL_REFRESH_DEADLINE_MS);
    active = { detailId, controller, token, deadline };
    void options.fetchDetail(detailId, controller.signal).then(
      (value) => finish(detailId, token, {
        status: "fulfilled",
        value
      }),
      (reason: unknown) => finish(detailId, token, {
        status: "rejected",
        reason
      })
    );
  };

  const finish = (
    detailId: string,
    token: symbol,
    result: PromiseSettledResult<T>
  ): void => {
    if (active?.token !== token) {
      return;
    }
    const completed = active;
    active = undefined;
    globalThis.clearTimeout(completed.deadline);
    if (options.isCurrent(detailId)) {
      options.settle(detailId, result);
    }
    const nextDetailId = desiredDetailId;
    if (queued && nextDetailId) {
      start(nextDetailId);
    } else {
      queued = false;
    }
  };

  return {
    request(detailId) {
      desiredDetailId = detailId;
      if (!detailId) {
        cancel();
        return;
      }
      if (!active) {
        start(detailId);
        return;
      }
      if (active.detailId === detailId) {
        queued = true;
        return;
      }
      const stale = active;
      active = undefined;
      queued = false;
      globalThis.clearTimeout(stale.deadline);
      stale.controller.abort();
      start(detailId);
    },
    cancel
  };
}

export function useOperatorRuntime(
  selectedArenaSystemId?: string,
  selectedResearchWorkItemId?: string
): OperatorRuntimeController {
  const [state, setState] = useState<OperatorRuntimeState>(INITIAL_STATE);
  const mountedRef = useRef(false);
  const operatorRef = useRef<OperatorReadModel | undefined>(undefined);
  const selectedArenaSystemIdRef = useRef(selectedArenaSystemId);
  const selectedResearchWorkItemIdRef = useRef(selectedResearchWorkItemId);
  const previousSelectionRef = useRef({
    selectedArenaSystemId,
    selectedResearchWorkItemId
  });
  const refreshRequestSequenceRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | undefined>(undefined);
  const refreshQueuedRef = useRef(false);
  const rootRefreshAbortControllerRef = useRef<AbortController | undefined>(undefined);
  const commandRequestSequenceRef = useRef(0);
  const commandRunningRef = useRef(false);
  const arenaDetailRefreshLaneRef = useRef<DetailRefreshLane | undefined>(undefined);
  const researchDetailRefreshLaneRef = useRef<DetailRefreshLane | undefined>(undefined);
  selectedArenaSystemIdRef.current = selectedArenaSystemId;
  selectedResearchWorkItemIdRef.current = selectedResearchWorkItemId;

  if (!arenaDetailRefreshLaneRef.current) {
    arenaDetailRefreshLaneRef.current = createDetailRefreshLane({
      detailName: "Arena",
      fetchDetail: (arenaDetailCandidateId, signal) =>
        fetchArenaTradingSystemDetail(arenaDetailCandidateId, signal),
      isCurrent: (arenaDetailCandidateId) => mountedRef.current &&
        selectedArenaSystemIdRef.current === arenaDetailCandidateId &&
        selectedArenaDetailCandidateId(
          operatorRef.current,
          arenaDetailCandidateId
        ) === arenaDetailCandidateId,
      settle: (arenaDetailCandidateId, result) => {
        setState((current) => ({
          ...current,
          arenaDetail: result.status === "fulfilled"
            ? result.value
            : current.arenaDetail?.candidate_id === arenaDetailCandidateId
              ? current.arenaDetail
              : undefined,
          arenaDetailLoading: false,
          arenaDetailError: result.status === "rejected"
            ? errorMessage(result.reason)
            : undefined
        }));
      }
    });
  }
  if (!researchDetailRefreshLaneRef.current) {
    researchDetailRefreshLaneRef.current = createDetailRefreshLane({
      detailName: "Research",
      fetchDetail: (researchDetailWorkItemId, signal) =>
        fetchResearchSessionDetail(researchDetailWorkItemId, signal),
      isCurrent: (researchDetailWorkItemId) => mountedRef.current &&
        selectedResearchWorkItemIdRef.current === researchDetailWorkItemId,
      settle: (researchDetailWorkItemId, result) => {
        setState((current) => ({
          ...current,
          ...settleResearchDetailRefresh({
            selectedResearchWorkItemId: researchDetailWorkItemId,
            currentDetail: current.researchDetail,
            result
          })
        }));
      }
    });
  }

  const performRefresh = useCallback(async () => {
    if (commandRunningRef.current) {
      return;
    }

    const sequence = ++refreshRequestSequenceRef.current;
    const requestedSelectedArenaSystemId = selectedArenaSystemIdRef.current;
    const requestedSelectedResearchWorkItemId =
      selectedResearchWorkItemIdRef.current;
    const pendingArenaDetailCandidateId = selectedArenaDetailCandidateId(
      operatorRef.current,
      requestedSelectedArenaSystemId
    );
    const pendingResearchDetailWorkItemId = selectedResearchDetailWorkItemId(
      operatorRef.current,
      requestedSelectedResearchWorkItemId
    );
    setState((current) => ({
      ...current,
      refreshing: !current.loading,
      arenaDetail: pendingArenaDetailCandidateId &&
        current.arenaDetail?.candidate_id === pendingArenaDetailCandidateId
        ? current.arenaDetail
        : undefined,
      arenaDetailLoading: Boolean(
        pendingArenaDetailCandidateId &&
        current.arenaDetail?.candidate_id !== pendingArenaDetailCandidateId
      ),
      arenaDetailError: undefined,
      researchDetail: pendingResearchDetailWorkItemId &&
        current.researchDetail?.research_work_item_id === pendingResearchDetailWorkItemId
        ? current.researchDetail
        : undefined,
      researchDetailLoading: Boolean(
        pendingResearchDetailWorkItemId &&
        current.researchDetail?.research_work_item_id !== pendingResearchDetailWorkItemId
      ),
      researchDetailError: undefined
    }));

    const rootRefreshController = new AbortController();
    rootRefreshAbortControllerRef.current = rootRefreshController;
    const rootRefreshDeadline = globalThis.setTimeout(() => {
      rootRefreshController.abort(new Error(
        `Operator root refresh exceeded ${OPERATOR_ROOT_REFRESH_DEADLINE_MS}ms deadline`
      ));
    }, OPERATOR_ROOT_REFRESH_DEADLINE_MS);
    const [operatorResult, gatewayResult] = await (async () => {
      try {
        return await Promise.allSettled([
          fetchOperatorReadModel(rootRefreshController.signal),
          fetchTradingGatewayEnvironment(rootRefreshController.signal)
        ]);
      } finally {
        globalThis.clearTimeout(rootRefreshDeadline);
        if (rootRefreshAbortControllerRef.current === rootRefreshController) {
          rootRefreshAbortControllerRef.current = undefined;
        }
      }
    })();

    if (!isOperatorRuntimeRequestCurrent(
      mountedRef.current,
      sequence,
      refreshRequestSequenceRef.current
    ) || !isOperatorRuntimeSelectionCurrent(
      requestedSelectedArenaSystemId,
      requestedSelectedResearchWorkItemId,
      selectedArenaSystemIdRef.current,
      selectedResearchWorkItemIdRef.current
    )) {
      return;
    }
    if (operatorResult.status === "fulfilled") {
      operatorRef.current = operatorResult.value;
    }
    const arenaDetailCandidateId = selectedArenaDetailCandidateId(
      operatorRef.current,
      requestedSelectedArenaSystemId
    );
    const researchDetailWorkItemId = selectedResearchDetailWorkItemId(
      operatorRef.current,
      requestedSelectedResearchWorkItemId
    );
    setState((current) => ({
      ...current,
      operator: operatorResult.status === "fulfilled"
        ? operatorResult.value
        : current.operator,
      gateway: gatewayResult.status === "fulfilled"
        ? gatewayResult.value
        : current.gateway,
      arenaDetail: !arenaDetailCandidateId
        ? undefined
        : current.arenaDetail?.candidate_id === arenaDetailCandidateId
          ? current.arenaDetail
          : undefined,
      loading: false,
      refreshing: false,
      arenaDetailLoading: Boolean(
        arenaDetailCandidateId &&
        current.arenaDetail?.candidate_id !== arenaDetailCandidateId
      ),
      researchDetail: !researchDetailWorkItemId
        ? undefined
        : current.researchDetail?.research_work_item_id === researchDetailWorkItemId
          ? current.researchDetail
          : undefined,
      researchDetailLoading: Boolean(
        researchDetailWorkItemId &&
        current.researchDetail?.research_work_item_id !== researchDetailWorkItemId
      ),
      operatorError: operatorResult.status === "rejected"
        ? errorMessage(operatorResult.reason)
        : undefined,
      gatewayError: gatewayResult.status === "rejected"
        ? errorMessage(gatewayResult.reason)
        : undefined,
      arenaDetailError: undefined,
      researchDetailError: undefined,
      lastOperatorReadAt: operatorResult.status === "fulfilled"
        ? new Date().toISOString()
        : current.lastOperatorReadAt
    }));
    arenaDetailRefreshLaneRef.current?.request(arenaDetailCandidateId);
    researchDetailRefreshLaneRef.current?.request(researchDetailWorkItemId);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return refreshInFlightRef.current;
    }

    const drainRefreshQueue = async (): Promise<void> => {
      do {
        refreshQueuedRef.current = false;
        await performRefresh();
      } while (mountedRef.current && refreshQueuedRef.current);
    };
    const inFlight = drainRefreshQueue().finally(() => {
      refreshInFlightRef.current = undefined;
    });
    refreshInFlightRef.current = inFlight;
    return inFlight;
  }, [performRefresh]);

  const executeCommand = useCallback(async (
    label: string,
    request: OuroborosCommandRequest
  ): Promise<OperatorReadModel | undefined> => {
    const sequence = ++commandRequestSequenceRef.current;
    refreshRequestSequenceRef.current += 1;
    commandRunningRef.current = true;
    rootRefreshAbortControllerRef.current?.abort(new Error(
      "Operator root refresh superseded by command execution"
    ));
    setState((current) => ({
      ...current,
      command: { status: "running", label, message: `${label} in progress` }
    }));

    try {
      const response = await submitOuroborosCommand(request);
      if (mountedRef.current && sequence === commandRequestSequenceRef.current) {
        operatorRef.current = response.operator;
        setState((current) => ({
          ...current,
          operator: response.operator,
          operatorError: undefined,
          lastOperatorReadAt: new Date().toISOString(),
          command: { status: "succeeded", label, message: `${label} completed` }
        }));
      }
      return response.operator;
    } catch (error) {
      if (mountedRef.current && sequence === commandRequestSequenceRef.current) {
        setState((current) => ({
          ...current,
          command: { status: "failed", label, message: errorMessage(error) }
        }));
      }
      return undefined;
    } finally {
      commandRunningRef.current = false;
      if (mountedRef.current) {
        void refresh();
      }
    }
  }, [refresh]);

  useEffect(() => {
    const previous = previousSelectionRef.current;
    if (previous.selectedArenaSystemId === selectedArenaSystemId &&
      previous.selectedResearchWorkItemId === selectedResearchWorkItemId) {
      return;
    }
    if (previous.selectedArenaSystemId !== selectedArenaSystemId) {
      arenaDetailRefreshLaneRef.current?.cancel();
    }
    if (previous.selectedResearchWorkItemId !== selectedResearchWorkItemId) {
      researchDetailRefreshLaneRef.current?.cancel();
    }
    previousSelectionRef.current = {
      selectedArenaSystemId,
      selectedResearchWorkItemId
    };
    refreshRequestSequenceRef.current += 1;
    rootRefreshAbortControllerRef.current?.abort(new Error(
      "Operator root refresh superseded by selection change"
    ));
    setState((current) => stateAfterOperatorSelectionChange(
      current,
      selectedArenaSystemId,
      selectedResearchWorkItemId
    ));
    if (!commandRunningRef.current) {
      void refresh();
    }
  }, [refresh, selectedArenaSystemId, selectedResearchWorkItemId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      if (!shouldRunAutomaticOperatorRefresh(document.visibilityState)) {
        return;
      }
      void refresh();
    }, OPERATOR_REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      refreshQueuedRef.current = false;
      rootRefreshAbortControllerRef.current?.abort(new Error(
        "Operator runtime unmounted"
      ));
      arenaDetailRefreshLaneRef.current?.cancel();
      researchDetailRefreshLaneRef.current?.cancel();
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
    executeCommand
  };
}

export function isOperatorRuntimeRequestCurrent(
  mounted: boolean,
  requestSequence: number,
  latestSequence: number
): boolean {
  return mounted && requestSequence === latestSequence;
}

export function isOperatorRuntimeSelectionCurrent(
  requestedArenaSystemId: string | undefined,
  requestedResearchWorkItemId: string | undefined,
  currentArenaSystemId: string | undefined,
  currentResearchWorkItemId: string | undefined
): boolean {
  return requestedArenaSystemId === currentArenaSystemId &&
    requestedResearchWorkItemId === currentResearchWorkItemId;
}

export function shouldRunAutomaticOperatorRefresh(
  visibilityState: DocumentVisibilityState
): boolean {
  return visibilityState !== "hidden";
}

export function stateAfterOperatorSelectionChange(
  current: OperatorRuntimeState,
  selectedArenaSystemId: string | undefined,
  selectedResearchWorkItemId: string | undefined
): OperatorRuntimeState {
  return {
    ...current,
    refreshing: false,
    arenaDetail: selectedArenaSystemId &&
      current.arenaDetail?.candidate_id === selectedArenaSystemId
      ? current.arenaDetail
      : undefined,
    arenaDetailLoading: false,
    arenaDetailError: undefined,
    researchDetail: selectedResearchWorkItemId &&
      current.researchDetail?.research_work_item_id === selectedResearchWorkItemId
      ? current.researchDetail
      : undefined,
    researchDetailLoading: false,
    researchDetailError: undefined
  };
}

export function selectedArenaDetailCandidateId(
  operator: {
    arena_operations?: {
      systems: ReadonlyArray<{ candidate_id: string }>;
    } | undefined;
  } | undefined,
  selectedArenaSystemId: string | undefined
): string | undefined {
  if (!selectedArenaSystemId) return undefined;
  return operator?.arena_operations?.systems.some((entry) =>
    entry.candidate_id === selectedArenaSystemId
  )
    ? selectedArenaSystemId
    : undefined;
}

export function selectedResearchDetailWorkItemId(
  _operator: {
    research_operations?: {
      sessions: ReadonlyArray<{ research_work_item_id: string }>;
    } | undefined;
  } | undefined,
  selectedResearchWorkItemId: string | undefined
): string | undefined {
  return selectedResearchWorkItemId;
}

export function settleResearchDetailRefresh(input: {
  selectedResearchWorkItemId: string | undefined;
  currentDetail: ResearchSessionDetailReadModel | undefined;
  result: PromiseSettledResult<ResearchSessionDetailReadModel | undefined>;
}): Pick<
  OperatorRuntimeState,
  "researchDetail" | "researchDetailLoading" | "researchDetailError"
> {
  if (!input.selectedResearchWorkItemId) {
    return {
      researchDetail: undefined,
      researchDetailLoading: false,
      researchDetailError: undefined
    };
  }
  if (input.result.status === "fulfilled") {
    return {
      researchDetail: input.result.value?.research_work_item_id ===
        input.selectedResearchWorkItemId
        ? input.result.value
        : undefined,
      researchDetailLoading: false,
      researchDetailError: undefined
    };
  }
  return {
    researchDetail: input.currentDetail?.research_work_item_id ===
      input.selectedResearchWorkItemId
      ? input.currentDetail
      : undefined,
    researchDetailLoading: false,
    researchDetailError: errorMessage(input.result.reason)
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
