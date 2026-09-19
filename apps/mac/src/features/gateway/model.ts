import type { DetailTarget } from "@/app/contracts";
import type { CompanyProfile } from "@/contracts/company-profile";
import type { NotificationController } from "@/data/notifications";
import type { CompanyConfigurationController } from "@/data/company-configuration";
import type { LiveSnapshot } from "@/data/live";
import type { Room } from "@/features/conversations/model";
import type { OperationsModel } from "@/features/operations/model";
export interface LiveModel {
  packageError: string;
  profile: CompanyProfile | null;
  notifications: NotificationController;
  configuration: CompanyConfigurationController;
  snapshot: LiveSnapshot;
  operations: OperationsModel;
  rooms: Room[];
  refresh: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  roomError: string;
}

export const connectedDetailTitle = (target: DetailTarget) =>
  ({
    "service-continuation": "Call recovery",
    execution: "Execution",
    member: "Member",
    work: "Work",
    event: "Recorded event",
    source: "Observation source",
    controls: "Owner controls",
    artifact: "Published file",
    search: "Search records",
    publication: "Publication",
    "control-request": "Control request",
  })[target.kind] ?? "Record";
