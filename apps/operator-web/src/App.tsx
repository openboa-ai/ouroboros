import { useEffect, useMemo, useState } from "react";
import type { OuroborosCommandRequest } from "@ouroboros/domain";
import { AlertTriangle } from "lucide-react";
import { operatorRouteHref, parseOperatorRoute, type OperatorRoute } from "@/app/operator-route";
import {
  buildArenaSystemDetailViewModel,
  buildArenaWorkspaceViewModel,
  buildResearchWorkspaceViewModel
} from "@/app/operator-view-model";
import { useOperatorRuntime } from "@/app/use-operator-runtime";
import {
  OperatorLoadingShell,
  OperatorShell,
  OperatorUnavailableShell
} from "@/components/operator-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArenaScreen } from "@/screens/arena-screen";
import { ResearchScreen } from "@/screens/research-screen";
import { EvidenceScreen, SystemScreen, TradingScreen } from "@/screens/secondary-screens";
import "./styles.css";

export function App() {
  const [route, setRoute] = useState<OperatorRoute>(() => (
    parseOperatorRoute(window.location.hash, window.location.search)
  ));
  const selectedArenaSystemId = route.section === "arena"
    ? route.selectedId
    : undefined;
  const runtime = useOperatorRuntime(selectedArenaSystemId);
  const arenaView = useMemo(
    () => runtime.operator ? buildArenaWorkspaceViewModel(runtime.operator) : undefined,
    [runtime.operator]
  );
  const researchView = useMemo(
    () => runtime.operator ? buildResearchWorkspaceViewModel(runtime.operator) : undefined,
    [runtime.operator]
  );
  const arenaDetail = useMemo(() => {
    const detail = runtime.arenaDetail;
    return detail && detail.candidate_id === selectedArenaSystemId
      ? buildArenaSystemDetailViewModel(detail)
      : undefined;
  }, [runtime.arenaDetail, selectedArenaSystemId]);

  useEffect(() => {
    const synchronizeRoute = () => {
      const parsed = parseOperatorRoute(window.location.hash, window.location.search);
      const canonical = operatorRouteHref(parsed);
      if (window.location.hash !== canonical) {
        window.history.replaceState(null, "", canonical);
      }
      setRoute(parsed);
    };

    synchronizeRoute();
    window.addEventListener("hashchange", synchronizeRoute);
    return () => window.removeEventListener("hashchange", synchronizeRoute);
  }, []);

  const navigate = (nextRoute: OperatorRoute) => {
    const href = operatorRouteHref(nextRoute);
    if (window.location.hash === href) {
      setRoute(nextRoute);
      return;
    }
    window.location.hash = href.slice(1);
  };

  if (runtime.loading && !runtime.operator) {
    return <OperatorLoadingShell />;
  }

  if (!runtime.operator || !arenaView || !researchView) {
    return <OperatorUnavailableShell error={runtime.operatorError ?? "Runtime did not return an OperatorReadModel."} />;
  }

  const operator = runtime.operator;
  const commandRunning = runtime.command.status === "running";
  const onCommand = (label: string, request: OuroborosCommandRequest) => {
    void runtime.executeCommand(label, request);
  };

  return (
    <OperatorShell
      route={route}
      runtimeStatus={operator.runtime_supervisor.status}
      lastOperatorReadAt={runtime.lastOperatorReadAt}
      refreshing={runtime.refreshing}
      command={runtime.command}
      onRefresh={() => void runtime.refresh()}
    >
      {runtime.operatorError ? (
        <div className="px-4 pt-4">
          <Alert variant="warning">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Operator refresh degraded</AlertTitle>
            <AlertDescription>
              The last successful read remains visible. Latest refresh failed: {runtime.operatorError}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {route.section === "arena" ? (
        <ArenaScreen
          view={arenaView}
          detail={arenaDetail}
          detailLoading={runtime.arenaDetailLoading}
          detailError={runtime.arenaDetailError}
          selectedId={route.selectedId}
          commandRunning={commandRunning}
          onSelect={(selectedId) => navigate({ section: "arena", selectedId })}
          onCommand={onCommand}
        />
      ) : null}
      {route.section === "research" ? (
        <ResearchScreen
          view={researchView}
          selectedId={route.selectedId}
          commandRunning={commandRunning}
          onSelect={(selectedId) => navigate({ section: "research", selectedId })}
          onCommand={onCommand}
        />
      ) : null}
      {route.section === "trading" ? (
        <TradingScreen
          operator={operator}
          commandRunning={commandRunning}
          onCommand={onCommand}
        />
      ) : null}
      {route.section === "evidence" ? <EvidenceScreen operator={operator} /> : null}
      {route.section === "system" ? (
        <SystemScreen
          operator={operator}
          gateway={runtime.gateway}
          gatewayError={runtime.gatewayError}
          commandRunning={commandRunning}
          onCommand={onCommand}
        />
      ) : null}
    </OperatorShell>
  );
}
