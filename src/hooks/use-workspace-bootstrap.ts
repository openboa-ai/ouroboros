import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { workspaceService } from "../lib/service-gateway";
import type { ApplyNextStateFn } from "./workspace-controller-types";

type UseWorkspaceBootstrapParams = {
  applyNextState: ApplyNextStateFn;
  setBootstrapError: Dispatch<SetStateAction<string | null>>;
  setCommandStatus: Dispatch<SetStateAction<string | null>>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useWorkspaceBootstrap({
  applyNextState,
  setBootstrapError,
  setCommandStatus
}: UseWorkspaceBootstrapParams) {
  const refreshInFlightRef = useRef(false);

  const loadBootstrapState = useCallback(async () => {
    setBootstrapError(null);
    try {
      const nextState = await workspaceService.getBootstrapState();
      applyNextState(nextState);
    } catch (error) {
      setBootstrapError(`Failed to boot workspace: ${errorMessage(error)}`);
    }
  }, [applyNextState, setBootstrapError]);

  const refreshWorkspace = useCallback(
    async (options?: { silent?: boolean }) => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      try {
        const nextState = await workspaceService.getBootstrapState();
        setBootstrapError(null);
        applyNextState(nextState, {
          preserveDetailState: true
        });
        if (!options?.silent) {
          setCommandStatus("Workspace refreshed through the service layer.");
        }
      } catch (error) {
        if (!options?.silent) {
          setCommandStatus(`Workspace refresh failed: ${errorMessage(error)}`);
        }
        setBootstrapError(
          (current) => current ?? `Failed to refresh workspace: ${errorMessage(error)}`
        );
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [applyNextState, setBootstrapError, setCommandStatus]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextState = await workspaceService.getBootstrapState();
        if (cancelled) {
          return;
        }

        setBootstrapError(null);
        applyNextState(nextState);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBootstrapError(`Failed to boot workspace: ${errorMessage(error)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyNextState, setBootstrapError]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshWorkspace({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshWorkspace]);

  return {
    loadBootstrapState,
    refreshWorkspace
  };
}
