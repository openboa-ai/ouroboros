import type { ScreenContext } from "@/app/Workspace";
import type { Destination } from "@/app/contracts";
import type { LiveModel } from "./model";
import { NotificationsScreen } from "@/features/notifications/Notifications";
import { openNotificationSource } from "@/features/notifications/open-source";
import { OperationsScreen } from "@/features/operations/Operations";
import { ConversationsScreen } from "@/features/conversations/Conversations";
import { LibraryScreen } from "@/features/library/Library";
import { CompanyPageScreen } from "@/modules/CompanyPage";
import { ConnectedCompanySettings } from "@/modules/ConnectedCompanySettings";
import { ModuleInventory } from "@/modules/ModuleInventory";
import { Facts, EmptyState } from "@/ui/components/patterns";
import { Button } from "@/ui/primitives/button";
import { liveMaterials } from "@/data/catalog";
import { sendRoomMessage, str } from "@/data/live";
export function ConnectedScreen({
  destination,
  model,
  ...p
}: ScreenContext & { destination: Destination; model: LiveModel }) {
  if (destination === "notifications")
    return (
      <NotificationsScreen
        {...model.notifications}
        open={(location) => {
          if (
            model.notifications.page?.items.find(
              (item) => item.id === location.notificationId,
            )?.read_at === null
          )
            void model.notifications
              .read([location.notificationId])
              .catch(() => {});
          openNotificationSource(location, p);
        }}
      />
    );
  if (["work", "agents", "system"].includes(destination))
    return (
      <OperationsScreen
        {...p}
        kind={destination as "work" | "agents" | "system"}
        model={model.operations}
      />
    );
  if (destination === "conversations")
    return model.roomError ? (
      <EmptyState
        title="Conversations unavailable"
        detail={model.roomError}
        action={
          <Button onClick={() => void model.refreshRooms()}>
            Try loading again
          </Button>
        }
      />
    ) : (
      <ConversationsScreen
        {...p}
        rooms={model.rooms}
        delivery={{
          send: (room, text, key, reply, context) =>
            sendRoomMessage(model.snapshot, room, text, key, reply, context),
          refresh: model.refreshRooms,
        }}
      />
    );
  if (destination === "library")
    return (
      <LibraryScreen
        {...p}
        materials={liveMaterials(model.snapshot)}
        sourceLabel="Gateway · confirmed publications in visible work"
      />
    );
  if (destination === "settings/company")
    return (
      <ConnectedCompanySettings {...p} configuration={model.configuration} />
    );
  if (destination === "settings/modules")
    return (
      <ModuleInventory
        error={model.packageError}
        modules={model.configuration.modules}
        current={model.configuration.current}
        scope={str(model.snapshot.conditions.firm_id)}
      />
    );
  if (destination === "settings/connections")
    return (
      <div className="settings-page">
        <h2 className="type-section">Current connection</h2>
        <Facts
          rows={[
            ["Source", "Authenticated Gateway"],
            ["Company", str(model.snapshot.conditions.firm_id)],
            ["Identity", str(model.snapshot.conditions.principal_id)],
            ["Authority revision", String(model.snapshot.conditions.revision)],
            ["Profile", "Managed by the native Mac client"],
          ]}
        />
      </div>
    );
  if (destination === "settings/maintenance")
    return (
      <div className="settings-page">
        <Facts
          rows={[
            ["Runtime liveness", "Not observed by the current API"],
            ["Backup verification", "Not provided"],
            ["Recovery verification", "Not provided"],
            ["Window close", "Does not issue an operation-stop request"],
          ]}
        />
      </div>
    );
  if (destination.startsWith("company/"))
    return (
      <CompanyPageScreen
        {...p}
        pageId={destination.slice(8)}
        modules={model.configuration.modules}
        composition={model.configuration.current}
        scope={str(model.snapshot.conditions.firm_id)}
      />
    );
  return (
    <EmptyState
      title="View unavailable"
      detail="This view is not registered for the connected company."
    />
  );
}
