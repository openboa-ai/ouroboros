import type { DetailTarget } from "@/app/contracts";
export interface ResourceRecord {
  id: string;
  name: string;
  purpose: string;
  category: "connection" | "resource" | "storage";
  state: string;
  owner: string;
  observed: string;
  facts: [string, string][];
  stages: { name: string; state: string }[];
  related?: DetailTarget;
  relatedLabel?: string;
}
