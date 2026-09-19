import type { DetailTarget } from "@/app/contracts";
export interface CompanyViewData {
  history: readonly {
    id: string;
    member: string;
    time: string;
    title: string;
    detail: string;
    target: DetailTarget;
  }[];
  members: readonly {
    id: string;
    name: string;
    role: string;
    responsibility: string;
    work: string;
  }[];
  work: readonly {
    id: string;
    member: string;
    title: string;
    result: string;
    next: string;
    execution: string;
  }[];
  trace: readonly {
    id: string;
    member: string;
    time: string;
    tool: string;
    source: string;
    result: string;
    target: DetailTarget;
    payload: object;
  }[];
}
