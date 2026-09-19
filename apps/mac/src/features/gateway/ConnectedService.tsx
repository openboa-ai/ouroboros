import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DetailTarget, ViewProps } from "@/app/contracts";
import type { LiveSnapshot } from "@/data/live";
import { EmptyState } from "@/ui/components/patterns";
import { Button } from "@/ui/primitives/button";
import {
  readService,
  type ServiceObservation,
} from "@/features/services/model";
import {
  ServiceDetail,
  type ServiceControl,
} from "@/features/services/Services";
import {
  checkServiceStop,
  readPendingStop,
  reviewRejectedStop,
  stopService,
  stopStorageKey,
  type PendingServiceStop,
  type ServiceConnection,
} from "@/features/services/stop";

/** Keyed by connection generation and root; old async results cannot act on a new connection. */
export function ConnectedService({
  target,
  snapshot,
  open,
  discuss,
}: Pick<ViewProps, "open" | "discuss"> & {
  target: DetailTarget;
  snapshot: LiveSnapshot;
}) {
  const rootId = target.id ?? "",
    workId = typeof target.workId === "string" ? target.workId : undefined;
  const environmentId = snapshot.environment_id ?? "",
    firmId = String(snapshot.conditions.firm_id),
    principalId = String(snapshot.conditions.principal_id),
    generation = snapshot.connection_generation ?? "";
  const [initial] = useState(() => {
    try {
      return {
        pending: readPendingStop(
          localStorage,
          stopStorageKey(
            { environmentId, firmId, principalId, generation },
            rootId,
          ),
          rootId,
        ),
        error: "",
      };
    } catch {
      return {
        pending: null,
        error:
          "The saved stop reference is unavailable. No new request was sent.",
      };
    }
  });
  const [service, setService] = useState<ServiceObservation | null>(null),
    [error, setError] = useState(initial.error),
    [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingServiceStop | null>(
      initial.pending,
    ),
    [outcome, setOutcome] = useState<ServiceControl["outcome"]>(
      initial.pending?.rejected ? "rejected" : "unknown",
    );
  const alive = useRef(true),
    action = useRef(false),
    reads = useRef(0);
  const load = useCallback(() => {
    const read = ++reads.current;
    return invoke("inspect_service_continuation", {
      connectionGeneration: generation,
      rootIntentId: rootId,
    })
      .then((value) => {
        const next = readService(value, {
          environmentId,
          firmId,
          workId,
          rootId,
        });
        if (alive.current && reads.current === read) {
          setService(next);
          setError(initial.error);
        }
      })
      .catch(() => {
        if (alive.current && reads.current === read) {
          setService(null);
          setError(
            "The current call cannot be read with this connection. Refresh does not submit a control request.",
          );
        }
      });
  }, [environmentId, firmId, generation, rootId, workId, initial.error]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    void load();
  }, [load, snapshot]);
  async function run(kind: "stop" | "check" | "review") {
    if (action.current) return;
    action.current = true;
    setBusy(true);
    setError("");
    const connection: ServiceConnection = {
      environmentId,
      firmId,
      principalId,
      generation,
    };
    try {
      if (kind === "stop" && service && !pending) {
        const result = await stopService(
          invoke,
          localStorage,
          connection,
          service,
          (p) => {
            if (alive.current) setPending({ ...p });
          },
        );
        if (alive.current) setOutcome(result);
      } else if (kind === "check" && pending) {
        const recorded = await checkServiceStop(invoke, connection, pending);
        if (alive.current)
          setOutcome(
            recorded ? "recorded" : pending.rejected ? "rejected" : "missing",
          );
      } else if (kind === "review" && pending?.rejected) {
        reviewRejectedStop(
          localStorage,
          stopStorageKey(connection, rootId),
          rootId,
        );
        if (alive.current) {
          setPending(null);
          setOutcome("unknown");
          setService(null);
        }
      }
      if (alive.current) await load();
    } catch {
      if (alive.current)
        setError(
          "The stop outcome is unresolved. Check the original request; it will not be resubmitted automatically.",
        );
    } finally {
      action.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!service)
    return (
      <EmptyState
        title={
          error ? "Call observation unavailable" : "Loading call observation"
        }
        detail={
          error || "Reading the exact call and current authority from Gateway."
        }
        action={
          error ? (
            <Button variant="secondary" onClick={() => void load()}>
              Refresh observation
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <ServiceDetail
      service={service}
      open={open}
      discuss={discuss}
      control={{
        pending,
        outcome,
        busy,
        error,
        stop: () => void run("stop"),
        check: () => void run("check"),
        review: () => void run("review"),
        refresh: () => void load(),
      }}
    />
  );
}
