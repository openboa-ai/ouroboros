import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Workspace } from "@/app/Workspace";
import { useNotifications } from "@/data/notifications";
import { notificationBadges } from "@/features/notifications/model";
import { useCompanyConfiguration } from "@/data/company-configuration";
import { useCompanyPackages } from "@/data/company-packages";
import {
  companyPageEntries,
  type ModuleDefinition,
  type WidgetDefinition,
} from "@/contracts/modules";
import { displayName } from "@/contracts/company-profile";
import { OperationWidget } from "@/features/operations/Operations";
import { operationsFor, loadRooms, str, type LiveSnapshot } from "@/data/live";
import type { Room } from "@/features/conversations/model";
import { Button } from "@/ui/primitives/button";
import { ConnectedScreen } from "./ConnectedScreen";
import { ConnectedInspector } from "./ConnectedInspector";
import { connectedDetailTitle, type LiveModel } from "./model";
export function GatewayWorkspace({
  snapshot,
  refresh,
  footerAccessory,
}: {
  snapshot: LiveSnapshot;
  refresh: () => Promise<void>;
  footerAccessory?: ReactNode;
}) {
  const notifications = useNotifications(snapshot);
  const moduleRegistry = useRef<readonly ModuleDefinition[]>([]);
  const configurationBase = useCompanyConfiguration(
    snapshot,
    () => moduleRegistry.current,
  );
  const packages = useCompanyPackages(
    configurationBase.error ? null : configurationBase.observed,
    snapshot.environment_id ?? "",
    str(snapshot.conditions.principal_id),
    snapshot.connection_generation,
  );
  useEffect(() => {
    moduleRegistry.current = packages.modules;
  }, [packages.modules]);
  const configuration = { ...configurationBase, modules: packages.modules };
  const [rooms, setRooms] = useState<Room[]>([]),
    [roomError, setRoomError] = useState("");
  async function refreshRooms() {
    try {
      setRooms(await loadRooms(snapshot));
      setRoomError("");
    } catch {
      setRoomError(
        "The room history could not be read with the current identity.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    void loadRooms(snapshot)
      .then((r) => {
        if (active) {
          setRooms(r);
          setRoomError("");
        }
      })
      .catch(() => {
        if (active) setRoomError("Conversation history unavailable.");
      });
    return () => {
      active = false;
    };
  }, [snapshot]);
  const operations = useMemo(() => {
    const value = operationsFor(snapshot);
    return {
      ...value,
      members: value.members.map((m) => ({
        ...m,
        title: displayName(packages.profile, m.id),
        description:
          packages.profile?.people.find((p) => p.principalId === m.id)
            ?.description ?? "Display profile not observed",
      })),
      work: value.work.map((w) => ({
        ...w,
        owner: w.owner ? displayName(packages.profile, w.owner) : undefined,
      })),
    };
  }, [snapshot, packages.profile]);
  const model: LiveModel = {
    packageError: packages.error,
    profile: packages.profile,
    notifications,
    configuration,
    snapshot,
    operations,
    rooms: rooms.map((r) => ({
      ...r,
      messages: r.messages.map((m) => ({
        ...m,
        author:
          m.authorId &&
          packages.profile?.people.some((p) => p.principalId === m.authorId)
            ? displayName(packages.profile, m.authorId)
            : m.author,
      })),
    })),
    refresh,
    refreshRooms,
    roomError,
  };
  const widgets = useMemo<WidgetDefinition[]>(
    () => [
      {
        id: "workspace.work",
        title: "Current work",
        description: "Visible work and its purpose",
        provider: "Workspace",
        sizes: ["medium", "wide"],
        Component: (p) => (
          <OperationWidget
            {...p}
            records={operations.work}
            empty="No work observed"
          />
        ),
      },
      {
        id: "workspace.executions",
        title: "Current executions",
        description: "Observed execution records",
        provider: "Workspace",
        sizes: ["medium", "wide"],
        Component: (p) => (
          <OperationWidget
            {...p}
            records={operations.executions}
            empty="No executions observed"
          />
        ),
      },
      {
        id: "workspace.system",
        title: "System observations",
        description: "Verified reads and missing health data",
        provider: "Workspace",
        sizes: ["small", "medium"],
        Component: (p) => (
          <OperationWidget
            {...p}
            records={operations.services}
            empty="No observations"
          />
        ),
      },
      ...packages.modules.flatMap((m) => m.widgets),
    ],
    [operations, packages.modules],
  );
  return (
    <Workspace
      adapter={{
        company:
          packages.profile?.name ??
          `Company ${str(snapshot.conditions.firm_id).slice(0, 8)}`,
        owner: displayName(
          packages.profile,
          str(snapshot.conditions.principal_id),
        ),
        source: "Gateway",
        subtitle: "Connected company",
        scope: `${snapshot.environment_id}.${str(snapshot.conditions.firm_id)}.${str(snapshot.conditions.principal_id)}`,
        scenario: "observed",
        model,
        Screen: ConnectedScreen,
        Inspector: ConnectedInspector,
        detailTitle: connectedDetailTitle,
        footerAccessory,
        badges: { ...notificationBadges(notifications.page?.unread) },
        headerAccessory: () => (
          <Button variant="ghost" onClick={() => void refresh()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        ),
        widgets,
        companyPages: companyPageEntries(configuration.current),
      }}
    />
  );
}
