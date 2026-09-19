import type { DetailTarget } from "@/app/contracts";

/** Preview and conversation references preserve the same immutable file and read scope. */
export function materialTarget(file: Material): DetailTarget {
  return {
    kind: "artifact",
    id: file.id,
    revision: file.revision,
    workspace: file.workspace,
    path: file.path,
    workId: file.work,
    delegationId: file.delegationId,
    targetId: file.targetId,
  };
}

export interface Material {
  id: string;
  title: string;
  purpose: string;
  format: string;
  kind: string;
  author: string;
  role: string;
  work: string;
  workLabel: string;
  revision: number;
  path: string;
  time: string;
  date?: string;
  authorId?: string;
  workspace?: string;
  delegationId?: string;
  targetId?: string;
}
