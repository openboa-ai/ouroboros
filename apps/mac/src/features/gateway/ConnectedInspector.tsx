import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ScreenContext } from "@/app/Workspace";
import type { DetailTarget } from "@/app/contracts";
import type { LiveModel } from "./model";
import { ConnectedService } from "./ConnectedService";
import { PublicationDetail } from "./PublicationDetail";
import { PublishedFile } from "@/features/library/PublishedFile";
import { Input } from "@/ui/primitives/input";
import { Button } from "@/ui/primitives/button";
import { RecordLink } from "@/ui/components/RecordLink";
import { Facts, EmptyState, Status } from "@/ui/components/patterns";
import { displayName } from "@/contracts/company-profile";
import { executionRows, record, rows, str, type JsonRecord } from "@/data/live";
export function ConnectedInspector({
  target,
  model,
  open,
  discuss,
}: ScreenContext & { target: DetailTarget; model: LiveModel }) {
  const [query, setQuery] = useState("");
  const [observed, setObserved] = useState<JsonRecord | null>(null),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<JsonRecord | null>(null),
    [busy, setBusy] = useState(false);
  const scope = `ouroboros.control.${model.snapshot.environment_id}.${str(model.snapshot.conditions.firm_id)}.${str(model.snapshot.conditions.principal_id)}.${target.id}`;
  const [pending, setPending] = useState<{
    key: string;
    revision: number;
    intent?: string;
  } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(scope) ?? "null");
    } catch {
      return null;
    }
  });
  useEffect(() => {
    let cancelled = false;
    if (["execution", "work", "control-request"].includes(target.kind))
      void invoke("inspect_record", {
        connectionGeneration: model.snapshot.connection_generation,
        kind:
          target.kind === "execution"
            ? "executions"
            : target.kind === "control-request"
              ? "intents"
              : "work",
        id: target.id,
      })
        .then((v) => {
          if (!cancelled) {
            setObserved(record(v));
            setError("");
          }
        })
        .catch(() => {
          if (!cancelled)
            setError(
              "Current record unavailable. Retained observations remain visible.",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [target, model.snapshot]);
  const execution = executionRows(model.snapshot).find(
    (e) => e.id === target.id,
  );
  const data =
    observed ??
    execution ??
    (target.kind === "event"
      ? model.snapshot.observations
          .flatMap((o) => rows(record(o.activity).items))
          .find((e) => String(e.sequence) === target.id)
      : rows(model.snapshot.work.items).find((w) => w.id === target.id));
  async function stop() {
    if (!execution || pending || busy) return;
    const request = {
      key: crypto.randomUUID(),
      revision: Number(model.snapshot.conditions.revision),
    };
    localStorage.setItem(scope, JSON.stringify(request));
    setPending(request);
    setBusy(true);
    try {
      const r = record(
        await invoke("company_command", {
          request: {
            connection_generation: model.snapshot.connection_generation,
            request_key: request.key,
            kind: "stop_execution",
            target_id: target.id,
            expected_revision: request.revision,
          },
        }),
      );
      const accepted = { ...request, intent: str(r.intent_id, "") };
      localStorage.setItem(scope, JSON.stringify(accepted));
      setPending(accepted);
      setReceipt({ recorded: true, intent: r });
      await model.refresh();
    } catch {
      setError(
        "Stop outcome unresolved. This request will not be resubmitted automatically.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reconcile() {
    setBusy(true);
    try {
      if (pending)
        setReceipt(
          record(
            await invoke("command_receipt", {
              connectionGeneration: model.snapshot.connection_generation,
              requestKey: pending.key,
              executionId: target.id,
              operation: "execution.stop",
            }),
          ),
        );
      await model.refresh();
    } catch {
      setError("The original request remains unresolved.");
    } finally {
      setBusy(false);
    }
  }
  if (target.kind === "search")
    return (
      <div className="inspector-content">
        <Input
          aria-label="Search loaded company records"
          placeholder="Work, agent, execution or event"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="type-meta muted">
          Search covers the records loaded in this environment.{" "}
          {model.snapshot.coverage}
        </p>
        {[
          ...model.operations.work,
          ...model.operations.members,
          ...model.operations.executions,
          ...model.operations.events,
        ]
          .filter((r) =>
            `${r.title} ${r.description} ${r.id}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .slice(0, 80)
          .map((r) => (
            <RecordLink
              key={`${r.target.kind}:${r.id}`}
              variant="row"
              title={r.title}
              meta={r.description}
              onClick={() => open(r.target)}
            />
          ))}
      </div>
    );
  if (target.kind === "service-continuation")
    return (
      <ConnectedService
        key={`${model.snapshot.connection_generation}:${target.id}`}
        target={target}
        snapshot={model.snapshot}
        open={open}
        discuss={discuss}
      />
    );
  if (target.kind === "package-artifact")
    return (
      <PublishedFile
        target={target}
        discuss={discuss}
        environmentId={model.snapshot.environment_id ?? ""}
        connectionGeneration={model.snapshot.connection_generation ?? ""}
      />
    );
  if (target.kind === "artifact")
    return (
      <PublishedFile
        target={target}
        discuss={discuss}
        environmentId={model.snapshot.environment_id ?? ""}
        connectionGeneration={model.snapshot.connection_generation ?? ""}
      />
    );
  if (target.kind === "publication")
    return (
      <PublicationDetail
        key={`${model.snapshot.environment_id}:${target.id}`}
        snapshot={model.snapshot}
        target={target}
        open={open}
      />
    );
  if (target.kind === "controls")
    return (
      <div className="inspector-content">
        <h2 className="type-section">Select an exact execution</h2>
        <p className="type-data muted">
          Stopping an execution retains company records and does not settle
          external obligations.
        </p>
        {model.operations.executions.map((e) => (
          <Button variant="secondary" key={e.id} onClick={() => open(e.target)}>
            {e.title} · {e.state}
          </Button>
        ))}
        {!model.operations.executions.length && (
          <EmptyState
            title="No execution targets"
            detail="No stoppable executions are currently observed."
          />
        )}
      </div>
    );
  if (target.kind === "member")
    return (
      <div className="inspector-content">
        <Facts
          rows={[
            ["Principal", target.id ?? ""],
            ["Display identity", displayName(model.profile, target.id ?? "")],
            ["Source", "Core principal referenced by admitted execution"],
          ]}
        />
        {executionRows(model.snapshot)
          .filter((e) => e.agent_principal_id === target.id)
          .map((e) => (
            <Button
              key={str(e.id)}
              variant="secondary"
              onClick={() => open({ kind: "execution", id: str(e.id) })}
            >
              Execution {str(e.id)}
            </Button>
          ))}
      </div>
    );
  if (target.kind === "source")
    return (
      <div className="inspector-content">
        <Facts
          rows={[
            ["Source", target.id ?? "Gateway"],
            ["Coverage", model.snapshot.coverage],
            ["Authority revision", String(model.snapshot.conditions.revision)],
            ["Runtime health", "Not provided by this observation source"],
          ]}
        />
      </div>
    );
  return (
    <div className="inspector-content">
      {!!data?.work_id && (
        <Button
          variant="secondary"
          onClick={() => open({ kind: "work", id: str(data.work_id) })}
        >
          Related work
        </Button>
      )}
      {!!data?.execution_id && (
        <Button
          variant="secondary"
          onClick={() =>
            open({ kind: "execution", id: str(data.execution_id) })
          }
        >
          Related execution
        </Button>
      )}
      {error && (
        <p role="alert" className="type-data">
          {error}
        </p>
      )}
      {data ? (
        <Facts
          rows={Object.entries(data)
            .filter(([, v]) => typeof v !== "object")
            .map(([k, v]) => [
              k.replaceAll("_", " "),
              v == null ? "Not observed" : String(v),
            ])}
        />
      ) : (
        <EmptyState
          title="Record unavailable"
          detail="No permitted observation is available for this reference."
        />
      )}
      {target.kind === "execution" && (
        <>
          <Facts
            rows={[
              ["Native turn", str(record(data?.native_turn).status)],
              ["Runtime phase", str(record(execution?.runtime).phase)],
              [
                "Resource return",
                data?.compute_return ? "Return recorded" : "Not observed",
              ],
              [
                "Native transcript",
                "Not exposed by the current observation API",
              ],
            ]}
          />
          {!pending ? (
            <Button
              variant="destructive"
              disabled={!execution?.can_stop || busy}
              onClick={() => void stop()}
            >
              Stop this execution
            </Button>
          ) : (
            <>
              <Status>
                {data?.terminated
                  ? "Termination observed"
                  : receipt?.recorded
                    ? "Request accepted · awaiting observed effects"
                    : "Request outcome unresolved"}
              </Status>
              <p className="type-meta muted">Request {pending.key}</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void reconcile()}
              >
                Check original request
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
