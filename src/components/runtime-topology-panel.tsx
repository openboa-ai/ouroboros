import type { RuntimeTopologyState } from "../lib/service-contract";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

type RuntimeTopologyPanelProps = {
  runtimeTopology: RuntimeTopologyState;
  onOpenDocument: (documentId: string, pathRef: string) => void;
};

export function RuntimeTopologyPanel({
  runtimeTopology,
  onOpenDocument,
}: RuntimeTopologyPanelProps) {
  const { orchestrator, agents, environments } = runtimeTopology;

  return (
    <Card
      title="Runtime Topology"
      description="Managed-agent orchestration is a typed runtime surface, not just a generic workspace document."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="positive">{orchestrator.mode}</Badge>
          <Badge tone="neutral">{agents.length} agents</Badge>
          <Badge tone="warning">{environments.length} environments</Badge>
        </div>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Orchestrator</h3>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-50">{orchestrator.name}</p>
                <p className="mt-1 text-xs leading-5 text-ink-300">{orchestrator.id}</p>
              </div>
              <Button
                variant="ghost"
                className="h-auto px-0 py-0 text-xs text-ink-100"
                onClick={() => onOpenDocument("runtime:orchestrator", orchestrator.pathRef)}
              >
                {orchestrator.pathRef}
              </Button>
            </div>

            {orchestrator.notes.length > 0 ? (
              <div className="mt-3 space-y-2">
                {orchestrator.notes.map((note) => (
                  <p
                    key={note}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-ink-100"
                  >
                    {note}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-3 grid gap-2">
              <TopologyRefButton
                label="Agents"
                pathRef={orchestrator.topologyRefs.agentsRef}
                onOpen={onOpenDocument}
              />
              <TopologyRefButton
                label="Environments"
                pathRef={orchestrator.topologyRefs.environmentsRef}
                onOpen={onOpenDocument}
              />
              <TopologyRefButton
                label="Sessions"
                pathRef={orchestrator.topologyRefs.sessionsRef}
                onOpen={onOpenDocument}
              />
              <TopologyRefButton
                label="Live lane"
                pathRef={orchestrator.topologyRefs.liveLaneRef}
                onOpen={onOpenDocument}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Agents</h3>
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-50">{agent.name}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-300">
                      {agent.kind} · {agent.providerMode}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs text-ink-100"
                    onClick={() => onOpenDocument(`runtime:agent:${agent.id}`, agent.definitionRef)}
                  >
                    {agent.definitionRef}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.preferredProviders.map((provider) => (
                    <Badge key={`${agent.id}:${provider}`} tone="neutral">
                      {provider}
                    </Badge>
                  ))}
                  <Badge tone="warning">{agent.environmentName}</Badge>
                </div>

                <div className="mt-3">
                  <TopologyRefButton
                    label="Environment"
                    pathRef={agent.environmentRef}
                    onOpen={onOpenDocument}
                  />
                </div>

                {agent.workspaceRefs.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {agent.workspaceRefs.map((workspaceRef) => (
                      <TopologyRefButton
                        key={`${agent.id}:${workspaceRef.label}`}
                        label={workspaceRef.label}
                        pathRef={workspaceRef.pathRef}
                        onOpen={onOpenDocument}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-300">Environments</h3>
          <div className="space-y-3">
            {environments.map((environment) => (
              <div
                key={environment.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-50">{environment.name}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-300">{environment.kind}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="h-auto px-0 py-0 text-xs text-ink-100"
                    onClick={() =>
                      onOpenDocument(`runtime:environment:${environment.id}`, environment.definitionRef)
                    }
                  >
                    {environment.definitionRef}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {environment.capabilities.map((capability) => (
                    <Badge key={`${environment.id}:${capability}`} tone="neutral">
                      {capability}
                    </Badge>
                  ))}
                </div>

                {environment.notes ? (
                  <p className="mt-3 text-xs leading-5 text-ink-200">{environment.notes}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
}

function TopologyRefButton({
  label,
  pathRef,
  onOpen,
}: {
  label: string;
  pathRef: string;
  onOpen: (documentId: string, pathRef: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-300">{label}</p>
      <Button
        variant="ghost"
        className="mt-2 h-auto w-full justify-start break-all px-0 py-0 text-left text-xs leading-5 text-ink-100"
        onClick={() => onOpen(`runtime:${label}`, pathRef)}
      >
        {pathRef}
      </Button>
    </div>
  );
}
