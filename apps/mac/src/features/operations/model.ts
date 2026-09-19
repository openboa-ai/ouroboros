import type { DetailTarget } from "@/app/contracts";
import type { ServiceCollection } from "@/features/services/model";
export interface OperationalRecord {
  id: string; title: string; description: string; state: string; observed: string;
  owner?: string; next?: string; target: DetailTarget; fields?: [string,string][];
}
export interface OperationsModel {
  work: OperationalRecord[]; members: OperationalRecord[]; executions: OperationalRecord[];
  services: OperationalRecord[]; events: OperationalRecord[]; source: string;
  continuations?: ServiceCollection;
}
