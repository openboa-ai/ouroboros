import { ConnectionScreen } from "@/features/connection/ConnectionScreen";
import { FilePortContext, browserFilePort } from "@/app/file-port";
import { nativeFilePort } from "@/data/native-file-port";
import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { EmptyState } from "@/ui/components/patterns";
import { ThemeToggle } from "@/ui/components/ThemeToggle";
import { ModuleBoundary } from "@/app/ModuleBoundary";
import { fetchLiveSnapshot, type LiveSnapshot } from "@/data/live";
import * as api from "./client";
const SampleWorkspace = lazy(() =>
  import("./development/SampleWorkspace").then((x) => ({
    default: x.SampleWorkspace,
  })),
);
const GatewayWorkspace = lazy(() =>
  import("./features/gateway/GatewayWorkspace").then((x) => ({
    default: x.GatewayWorkspace,
  })),
);
/** Native composition owns source selection. A failed connection cannot switch into samples. */
export default function App() {
  const refreshing = useRef<number | null>(null);
  const connectionEpoch = useRef(0);
  const requestSequence = useRef(0);
  useEffect(() => () => { connectionEpoch.current += 1; refreshing.current = null; }, []);
  const [mode, setMode] = useState<"welcome" | "sample" | "gateway">("welcome");
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect(pick: boolean) {
    if (refreshing.current !== null) return;
    const epoch = connectionEpoch.current, request = ++requestSequence.current;
    refreshing.current = request;
    setBusy(true);
    setError("");
    try {
      if (pick) await api.connectProfile();
      else if (mode !== "gateway") await api.connectSavedProfile();
      if (epoch !== connectionEpoch.current) return;
      const snapshot = await fetchLiveSnapshot();
      if (epoch !== connectionEpoch.current) return;
      setData(snapshot);
      setMode("gateway");
    } catch {
      if (epoch !== connectionEpoch.current) return;
      setError(
        api.native
          ? "The company could not be loaded. Check the selected profile and Gateway service. No sample data was substituted."
          : "Open the Mac app to connect an operating environment.",
      );
    } finally {
      if (refreshing.current === request) {
        refreshing.current = null;
        if (epoch === connectionEpoch.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    if (mode !== "gateway") return;
    let active = true;
    const timer = window.setInterval(() => {
      if (!active || document.hidden || refreshing.current !== null) return;
      const epoch = connectionEpoch.current, request = ++requestSequence.current;
      refreshing.current = request;
      void fetchLiveSnapshot().then(value => { if(active && epoch === connectionEpoch.current){setData(value);setError("");} }).catch(() => {if(active && epoch === connectionEpoch.current)setError("Latest observation unavailable. Retained records may be stale.");}).finally(()=>{if(refreshing.current === request)refreshing.current=null;});
    }, 30000);
    return () => {active=false;window.clearInterval(timer);};
  }, [mode]);
  const footer = (
    <div className="session-actions">
      <Button
        variant="secondary"
        aria-label="Change company connection"
        onClick={() => {
          connectionEpoch.current += 1;
          refreshing.current = null;
          setBusy(false);
          setData(null);
          setError("");
          setMode("welcome");
        }}
      >
        <LogOut size={14} />
        Change company connection
      </Button>
    </div>
  );
  return (
    <FilePortContext.Provider
      value={api.native ? nativeFilePort : browserFilePort}
    >
      <div className="native-app">
        {mode === "welcome" ? (
          <ConnectionScreen
            connect={connect}
            busy={busy}
            error={error}
            footer={<><ThemeToggle />{footer}</>}
            explore={() => {
              connectionEpoch.current += 1;
              refreshing.current = null;
              setBusy(false);
              setData(null);
              setError("");
              setMode("sample");
            }}
          />
        ) : (
          <>
            <ModuleBoundary>
              <Suspense
                fallback={
                  <EmptyState
                    title="Opening company"
                    detail="Loading the workspace."
                  />
                }
              >
                {mode === "sample" ? (
                  <SampleWorkspace footerAccessory={footer} />
                ) : (
                  data && (
                    <GatewayWorkspace
                      snapshot={data}
                      refresh={() => connect(false)}
                      footerAccessory={footer}
                    />
                  )
                )}
              </Suspense>
            </ModuleBoundary>
            {error && (
              <div className="connection-error" role="status">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </FilePortContext.Provider>
  );
}
