import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArenaTradingSystemDetailReadModel,
  OperatorReadModel,
  OuroborosCommandRequest,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import {
  fetchArenaTradingSystemDetail,
  fetchOperatorReadModel,
  fetchTradingGatewayEnvironment,
  submitOuroborosCommand
} from "../api";

const OPERATOR_REFRESH_INTERVAL_MS = 5_000;

export interface OperatorCommandState {
  status: "idle" | "running" | "succeeded" | "failed";
  label?: string;
  message?: string;
}

export interface OperatorRuntimeState {
  operator?: OperatorReadModel;
  gateway?: TradingGatewayEnvironmentReadModel;
  arenaDetail?: ArenaTradingSystemDetailReadModel;
  loading: boolean;
  refreshing: boolean;
  arenaDetailLoading: boolean;
  operatorError?: string;
  gatewayError?: string;
  arenaDetailError?: string;
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
  command: { status: "idle" }
};

export function useOperatorRuntime(
  selectedArenaSystemId?: string
): OperatorRuntimeController {
  const [state, setState] = useState<OperatorRuntimeState>(INITIAL_STATE);
  const mountedRef = useRef(false);
  const operatorRef = useRef<OperatorReadModel | undefined>(undefined);
  const requestSequenceRef = useRef(0);
  const commandRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (commandRunningRef.current) {
      return;
    }

    const sequence = ++requestSequenceRef.current;
    const pendingArenaDetailCandidateId = selectedArenaDetailCandidateId(
      operatorRef.current,
      selectedArenaSystemId
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
      arenaDetailError: undefined
    }));

    const [operatorResult, gatewayResult] = await Promise.allSettled([
      fetchOperatorReadModel(),
      fetchTradingGatewayEnvironment()
    ]);

    if (!mountedRef.current || sequence !== requestSequenceRef.current) {
      return;
    }
    if (operatorResult.status === "fulfilled") {
      operatorRef.current = operatorResult.value;
    }
    const arenaDetailCandidateId = selectedArenaDetailCandidateId(
      operatorRef.current,
      selectedArenaSystemId
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
      refreshing: Boolean(arenaDetailCandidateId),
      arenaDetailLoading: Boolean(
        arenaDetailCandidateId &&
        current.arenaDetail?.candidate_id !== arenaDetailCandidateId
      ),
      operatorError: operatorResult.status === "rejected"
        ? errorMessage(operatorResult.reason)
        : undefined,
      gatewayError: gatewayResult.status === "rejected"
        ? errorMessage(gatewayResult.reason)
        : undefined,
      arenaDetailError: undefined,
      lastOperatorReadAt: operatorResult.status === "fulfilled"
        ? new Date().toISOString()
        : current.lastOperatorReadAt
    }));
    if (!arenaDetailCandidateId) {
      return;
    }
    const [arenaDetailResult] = await Promise.allSettled([
      fetchArenaTradingSystemDetail(arenaDetailCandidateId)
    ]);

    if (!mountedRef.current || sequence !== requestSequenceRef.current) {
      return;
    }

    setState((current) => ({
      ...current,
      arenaDetail: arenaDetailResult.status === "fulfilled"
        ? arenaDetailResult.value
        : current.arenaDetail?.candidate_id === arenaDetailCandidateId
          ? current.arenaDetail
          : undefined,
      refreshing: false,
      arenaDetailLoading: false,
      arenaDetailError: arenaDetailResult.status === "rejected"
        ? errorMessage(arenaDetailResult.reason)
        : undefined
    }));
  }, [selectedArenaSystemId]);

  const executeCommand = useCallback(async (
    label: string,
    request: OuroborosCommandRequest
  ): Promise<OperatorReadModel | undefined> => {
    const sequence = ++requestSequenceRef.current;
    commandRunningRef.current = true;
    setState((current) => ({
      ...current,
      command: { status: "running", label, message: `${label} in progress` }
    }));

    try {
      const response = await submitOuroborosCommand(request);
      if (mountedRef.current && sequence === requestSequenceRef.current) {
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
      if (mountedRef.current && sequence === requestSequenceRef.current) {
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
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void refresh();
    }, OPERATOR_REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  return {
    ...state,
    refresh,
    executeCommand
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
