import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OperatorReadModel,
  OuroborosCommandRequest,
  TradingGatewayEnvironmentReadModel
} from "@ouroboros/domain";
import {
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
  loading: boolean;
  refreshing: boolean;
  operatorError?: string;
  gatewayError?: string;
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
  command: { status: "idle" }
};

export function useOperatorRuntime(): OperatorRuntimeController {
  const [state, setState] = useState<OperatorRuntimeState>(INITIAL_STATE);
  const mountedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const commandRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (commandRunningRef.current) {
      return;
    }

    const sequence = ++requestSequenceRef.current;
    setState((current) => ({
      ...current,
      refreshing: !current.loading
    }));

    const [operatorResult, gatewayResult] = await Promise.allSettled([
      fetchOperatorReadModel(),
      fetchTradingGatewayEnvironment()
    ]);

    if (!mountedRef.current || sequence !== requestSequenceRef.current) {
      return;
    }

    setState((current) => ({
      ...current,
      operator: operatorResult.status === "fulfilled"
        ? operatorResult.value
        : current.operator,
      gateway: gatewayResult.status === "fulfilled"
        ? gatewayResult.value
        : current.gateway,
      loading: false,
      refreshing: false,
      operatorError: operatorResult.status === "rejected"
        ? errorMessage(operatorResult.reason)
        : undefined,
      gatewayError: gatewayResult.status === "rejected"
        ? errorMessage(gatewayResult.reason)
        : undefined,
      lastOperatorReadAt: operatorResult.status === "fulfilled"
        ? new Date().toISOString()
        : current.lastOperatorReadAt
    }));
  }, []);

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
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const interval = window.setInterval(() => {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
